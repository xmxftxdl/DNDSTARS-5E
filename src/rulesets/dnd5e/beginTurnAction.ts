import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { AbilityKey } from '../../lib/dnd'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eClassDefinitionForCharacter } from './classes'
import {
  dnd5eCombatantHasConcentrationEffect,
  dnd5ePendingTurnStartPeriodicDamage,
  prepareDnd5eTurnStartGazeRequirements,
  previewDnd5eTurnStartBoundary,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterMechanicRoll,
  type Dnd5eMonsterRechargeRoll,
  type Dnd5eTurnStartGazeRequirement,
  type Dnd5eTurnStartGazeResolution,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import {
  type Dnd5eActiveEffectInstance,
  type Dnd5eActiveEffectPeriodicDamageRoll,
  type Dnd5eActiveEffectSavingThrowRoll,
} from './activeEffects'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import type { Dnd5eDamageType } from './damageTypes'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5eMonsterRechargeActions } from './monsterGenericAbilities'
import {
  dnd5eEligibleMonsterMechanics,
  dnd5eMonsterMechanicDiceRequirements,
  type Dnd5eMonsterMechanicDiceRequirement,
} from './monsterAutomation'

export type Dnd5eBeginTurnRejectReason =
  | 'invalid-actor'
  | 'combatant-missing'
  | 'invalid-action'

export interface PreparedDnd5eTurnStartSavingThrow {
  effect: Dnd5eActiveEffectInstance
  targetId: string
  targetName: string
  modifier: number
  dc: number
  mode: 'normal' | 'advantage' | 'disadvantage'
  blessed: boolean
  baned: boolean
}

export interface PreparedDnd5eTurnStartPeriodicDamage {
  effect: Dnd5eActiveEffectInstance
  targetId: string
  targetName: string
  count: number
  sides: number
  modifier: number
  damageType?: Dnd5eDamageType
  savingThrow?: {
    ability: AbilityKey
    dc: number
    modifier: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
    halflingLucky: boolean
    legendaryResistanceUses: number
  }
}

export interface PreparedDnd5eBeginTurnMonsterMechanic {
  actorId: string
  actorName: string
  mechanicId: string
  mechanicName: string
  targetId?: string
  effects: readonly Dnd5eMonsterMechanicDiceRequirement[]
}

export interface PreparedDnd5eBeginTurn {
  actor?: Character
  actorName: string
  actorToken: Token
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
  turnSlotId: string
  alreadyResolved: boolean
  turnStartActiveEffectPeriodicDamage: readonly PreparedDnd5eTurnStartPeriodicDamage[]
  turnStartActiveEffectSavingThrows: readonly PreparedDnd5eTurnStartSavingThrow[]
  turnStartGazeRequirements: readonly Dnd5eTurnStartGazeRequirement[]
  monsterRechargeRolls: readonly {
    actorId: string
    actorName: string
    actionId: string
    actionName: string
    dieSides: number
    minimum: number
  }[]
  monsterMechanicRolls: readonly PreparedDnd5eBeginTurnMonsterMechanic[]
}

export interface Dnd5eBeginTurnContext {
  combatId: string
  round: number
  initiativeIndex: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
}

function turnStartSavingThrowModifier(
  target: Dnd5eHeadlessCombatState['combatants'][string],
  ability: AbilityKey,
): number {
  return target.savingThrowBonuses[ability] ??
    Math.floor((target.abilities[ability] - 10) / 2)
}

export function prepareDnd5eBeginTurn(
  input: Dnd5eBeginTurnContext,
): { ok: true; prepared: PreparedDnd5eBeginTurn } |
  { ok: false; reason: Dnd5eBeginTurnRejectReason } {
  const slot = input.initiativeOrder[input.initiativeIndex]
  const actorToken = slot
    ? input.map.tokens.find((token) => token.id === slot.tokenId)
    : undefined
  const actor = actorToken?.characterId
    ? input.characters.find((character) => character.id === actorToken.characterId)
    : undefined
  const monster = actorToken?.poolId
    ? getDnd5eSrdMonster(actorToken.poolId)
    : undefined
  if (!slot || !actorToken || (actor ? !dnd5eClassDefinitionForCharacter(actor) : !monster)) {
    return { ok: false, reason: 'invalid-actor' }
  }
  const turnSlotId = slot.slotId ?? slot.tokenId
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    turnSlotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  snapshot.state.initiativeIndex = input.initiativeIndex
  snapshot.state.turnSlotId = turnSlotId
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (!actorCombatant) return { ok: false, reason: 'combatant-missing' }
  const turnKey = `${snapshot.state.combatId}:${snapshot.state.round}:${turnSlotId}`
  const alreadyResolved = actorCombatant.classState.turnStartResolvedTurnKey === turnKey
  const preview = alreadyResolved
    ? snapshot.state
    : previewDnd5eTurnStartBoundary(
        snapshot.state,
        actorCombatant.id,
        turnSlotId,
        snapshot.state.round,
      )
  if (!preview) return { ok: false, reason: 'combatant-missing' }
  const previewActor = preview.combatants[actorCombatant.id]
  if (!previewActor) return { ok: false, reason: 'combatant-missing' }

  const turnStartActiveEffectSavingThrows = alreadyResolved
    ? []
    : (previewActor.classState.activeEffects ?? []).flatMap((effect) => {
        const repeatSave = effect.repeatSave
        if (repeatSave?.timing !== 'target-turn-start') return []
        const source = effect.source.actorId
          ? preview.combatants[effect.source.actorId]
          : undefined
        return [{
          effect,
          targetId: previewActor.id,
          targetName: previewActor.name,
          modifier: turnStartSavingThrowModifier(previewActor, repeatSave.ability),
          dc: repeatSave.dc,
          mode: dnd5eSavingThrowMode(previewActor, repeatSave.ability, {
            effectVisible: effect.visibility !== 'dm-only',
            condition: effect.standardCondition,
            sourceCreatureType: source?.creatureType,
            sourceIsSpell: effect.source.kind === 'spell',
            sourceIsMagical: effect.source.magical === true,
          }),
          blessed: dnd5eCombatantHasConcentrationEffect(
            preview,
            previewActor.id,
            'bless',
          ),
          baned: dnd5eCombatantHasConcentrationEffect(
            preview,
            previewActor.id,
            'bane',
          ),
        }]
      })
  const turnStartActiveEffectPeriodicDamage = alreadyResolved
    ? []
    : dnd5ePendingTurnStartPeriodicDamage(
        preview,
        previewActor.id,
      ).map(({ target, effect }) => {
        const periodicDamage = effect.periodicDamage!
        const savingThrow = periodicDamage.savingThrow
        const source = effect.source.actorId
          ? preview.combatants[effect.source.actorId]
          : undefined
        return {
          effect,
          targetId: target.id,
          targetName: target.name,
          count: periodicDamage.count,
          sides: periodicDamage.sides,
          modifier: periodicDamage.modifier ?? 0,
          damageType: periodicDamage.type,
          savingThrow: savingThrow
            ? {
                ability: savingThrow.ability,
                dc: savingThrow.dc,
                modifier: turnStartSavingThrowModifier(target, savingThrow.ability),
                mode: dnd5eSavingThrowMode(target, savingThrow.ability, {
                  effectVisible: effect.visibility !== 'dm-only',
                  condition: effect.standardCondition,
                  sourceCreatureType: source?.creatureType,
                  sourceIsSpell: effect.source.kind === 'spell',
                  sourceIsMagical:
                    savingThrow.magical ?? effect.source.magical === true,
                }),
                blessed: dnd5eCombatantHasConcentrationEffect(
                  preview,
                  target.id,
                  'bless',
                ),
                baned: dnd5eCombatantHasConcentrationEffect(
                  preview,
                  target.id,
                  'bane',
                ),
                halflingLucky: target.racialRules?.halflingLucky === true,
                legendaryResistanceUses: Math.max(
                  0,
                  Math.floor(target.classState.legendaryResistanceUses ?? 0),
                ),
              }
            : undefined,
        }
      })
  const turnStartGazeRequirements = alreadyResolved
    ? []
    : prepareDnd5eTurnStartGazeRequirements(
        snapshot.state,
        actorCombatant.id,
        turnSlotId,
        snapshot.state.round,
      )
  const monsterRechargeRolls = alreadyResolved
    ? []
    : dnd5eMonsterRechargeActions(monster).flatMap((action) => {
        const usage = action.usage
        if (
          usage?.kind !== 'recharge' ||
          previewActor.classState.monsterRechargeReadyByActionId?.[action.id] !== false
        ) return []
        return [{
          actorId: previewActor.id,
          actorName: previewActor.name,
          actionId: action.id,
          actionName: action.name,
          dieSides: usage.dieSides,
          minimum: usage.minimum,
        }]
      })
  const monsterMechanicRolls = alreadyResolved
    ? []
    : dnd5eEligibleMonsterMechanics(monster, 'turn-start', {
        combatId: snapshot.state.combatId,
        round: snapshot.state.round,
        actorId: actorCombatant.id,
        currentHp: actorCombatant.currentHp,
        maxHp: actorCombatant.maxHp,
        usedKeys: actorCombatant.classState.declarativeUsedTurnKeys,
      }).map((mechanic) => ({
        actorId: previewActor.id,
        actorName: previewActor.name,
        mechanicId: mechanic.id,
        mechanicName: mechanic.name,
        effects: dnd5eMonsterMechanicDiceRequirements(mechanic),
      }))

  return {
    ok: true,
    prepared: {
      actor,
      actorName: actor?.name ?? actorToken.label,
      actorToken,
      state: snapshot.state,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      turnSlotId,
      alreadyResolved,
      turnStartActiveEffectPeriodicDamage,
      turnStartActiveEffectSavingThrows,
      turnStartGazeRequirements,
      monsterRechargeRolls,
      monsterMechanicRolls,
    },
  }
}

export function resolveDnd5eBeginTurn(input: Dnd5eBeginTurnContext & {
  turnStartActiveEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]
  turnStartActiveEffectPeriodicDamageRolls?: readonly Dnd5eActiveEffectPeriodicDamageRoll[]
  turnStartGazeResolutions?: readonly Dnd5eTurnStartGazeResolution[]
  monsterRechargeRolls?: readonly Dnd5eMonsterRechargeRoll[]
  monsterMechanicRolls?: readonly Dnd5eMonsterMechanicRoll[]
}): {
  ok: true
  actor?: Character
  actorName: string
  actorToken: Token
  result: Dnd5eActionResult
  application: Dnd5eMapResultPlan
} | { ok: false; reason: Dnd5eBeginTurnRejectReason } {
  const prepared = prepareDnd5eBeginTurn(input)
  if (!prepared.ok) return prepared
  const {
    actor,
    actorName,
    actorToken,
    state,
    characterIdByCombatantId,
    turnSlotId,
  } = prepared.prepared
  const result = resolveDnd5eHeadlessAction(state, {
    type: 'begin-turn',
    actorId: actorToken.id,
    turnSlotId,
    turnStartActiveEffectSavingThrows: input.turnStartActiveEffectSavingThrows,
    turnStartActiveEffectPeriodicDamageRolls:
      input.turnStartActiveEffectPeriodicDamageRolls,
    turnStartGazeResolutions: input.turnStartGazeResolutions,
    nextMonsterRechargeRolls: input.monsterRechargeRolls,
    nextMonsterMechanicRolls: input.monsterMechanicRolls,
  })
  if (!result.ok) return { ok: false, reason: 'invalid-action' }
  return {
    ok: true,
    actor,
    actorName,
    actorToken,
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId,
    }),
  }
}
