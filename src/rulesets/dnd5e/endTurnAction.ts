import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { AbilityKey } from '../../lib/dnd'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
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
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eIsIncapacitated, dnd5eSavingThrowMode } from './passiveDefenses'
import { dnd5eHeightenedSavingThrowMode } from './spells'
import {
  dnd5eActiveFlySpeed,
  dnd5eActiveSafeFallFeet,
  dnd5eConditionsFromActiveEffects,
  removeDnd5eActiveEffectsByStandardCondition,
  type Dnd5eActiveEffectInstance,
  type Dnd5eActiveEffectPeriodicDamageRoll,
  type Dnd5eActiveEffectSavingThrowRoll,
} from './activeEffects'
import type { Dnd5eDamageType } from './damageTypes'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5eMonsterRechargeActions } from './monsterGenericAbilities'
import {
  dnd5eEligibleMonsterMechanics,
  dnd5eMonsterMechanicDiceRequirements,
  type Dnd5eMonsterMechanicDiceRequirement,
} from './monsterAutomation'
import {
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
} from '../../lib/mapGeometry'
import { dnd5eTotemWarriorFeatureForCombatant } from './totemWarrior'

export type Dnd5eEndTurnRejectReason = 'invalid-action' | 'invalid-actor' | 'combatant-missing'

export interface PreparedDnd5eMonsterMechanicRoll {
  actorId: string
  actorName: string
  mechanicId: string
  mechanicName: string
  targetId?: string
  effects: readonly Dnd5eMonsterMechanicDiceRequirement[]
}

export interface PreparedDnd5ePlayerEndTurn {
  actor?: Character
  actorName: string
  actorToken: Token
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
  activeEffectSavingThrows: readonly {
    effect: Dnd5eActiveEffectInstance
    modifier: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }[]
  turnStartActiveEffectSavingThrows: readonly {
    effect: Dnd5eActiveEffectInstance
    targetId: string
    targetName: string
    modifier: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }[]
  turnStartActiveEffectPeriodicDamage: readonly {
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
  }[]
  turnStartGazeRequirements: readonly Dnd5eTurnStartGazeRequirement[]
  totemEagleFall?: {
    landingElevationFeet: number
    distanceFeet: number
    fallingDamageDice: number
  }
  nextTurnSlotId?: string
  nextMonsterRechargeRolls: readonly {
    actorId: string
    actorName: string
    actionId: string
    actionName: string
    dieSides: number
    minimum: number
  }[]
  currentMonsterMechanicRolls: readonly PreparedDnd5eMonsterMechanicRoll[]
  nextMonsterMechanicRolls: readonly PreparedDnd5eMonsterMechanicRoll[]
}

export function prepareDnd5ePlayerEndTurn(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
}): { ok: true; prepared: PreparedDnd5ePlayerEndTurn } | { ok: false; reason: Dnd5eEndTurnRejectReason } {
  if (input.action.type !== 'end-turn' && input.action.type !== 'dnd5e-death-save') {
    return { ok: false, reason: 'invalid-action' }
  }
  const actorToken = input.map.tokens.find((token) => token.id === input.action.actorTokenId)
  const actor = actorToken?.characterId
    ? input.characters.find((character) => character.id === actorToken.characterId)
    : undefined
  const monster = actorToken?.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  if (!actorToken || (actor ? !dnd5eClassDefinitionForCharacter(actor) : !monster)) {
    return { ok: false, reason: 'invalid-actor' }
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const requestedSlot = input.initiativeOrder[input.action.initiativeIndex]
  if (requestedSlot?.firstRoundOnly && input.action.round > 1) {
    return { ok: false, reason: 'invalid-action' }
  }
  const actorIndex = requestedSlot?.tokenId === actorToken.id
    ? input.action.initiativeIndex
    : snapshot.state.initiativeOrder.indexOf(actorToken.id)
  if (actorIndex < 0 || !snapshot.state.combatants[actorToken.id]) return { ok: false, reason: 'combatant-missing' }
  snapshot.state.initiativeIndex = actorIndex
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  const fearSourceId = actorCombatant.classState.intimidatingPresenceSourceId
  const fearSourceToken = fearSourceId ? input.map.tokens.find((token) => token.id === fearSourceId) : undefined
  if (
    fearSourceToken &&
    tokenFootprintDistanceCells(actorToken, fearSourceToken, input.map) *
      Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) > 60
  ) {
    actorCombatant.classState.intimidatingPresenceSourceId = undefined
    actorCombatant.classState.intimidatingPresenceRoundsRemaining = undefined
    actorCombatant.classState.activeEffects = removeDnd5eActiveEffectsByStandardCondition({
      effects: actorCombatant.classState.activeEffects,
      condition: 'frightened',
    }).effects
    actorCombatant.conditions = dnd5eConditionsFromActiveEffects(actorCombatant.classState.activeEffects)
  }
  const activeEffectSavingThrows = (actorCombatant.classState.activeEffects ?? []).flatMap((effect) => {
    if (effect.repeatSave?.timing !== 'target-turn-end') return []
    const repeatSave = effect.repeatSave
    const source = effect.source.actorId ? snapshot.state.combatants[effect.source.actorId] : undefined
    let mode = dnd5eSavingThrowMode(actorCombatant, repeatSave.ability, {
      effectVisible: effect.visibility !== 'dm-only',
      condition: effect.standardCondition,
      sourceCreatureType: source?.creatureType,
      sourceIsSpell: effect.source.kind === 'spell',
    })
    const creatureType = (actorCombatant.creatureType ?? '').trim().toLowerCase()
    if (
      effect.source.rulesId === 'sunburst' &&
      (creatureType === 'undead' || creatureType.includes('亡灵') || creatureType === 'ooze' || creatureType.includes('泥怪'))
    ) mode = dnd5eHeightenedSavingThrowMode(mode, true)
    return [{
      effect,
      modifier: actorCombatant.savingThrowBonuses[repeatSave.ability] ??
        Math.floor((actorCombatant.abilities[repeatSave.ability] - 10) / 2),
      dc: repeatSave.dc,
      mode,
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
    }]
  })
  const nextCombatantId = snapshot.state.initiativeOrder[(actorIndex + 1) % snapshot.state.initiativeOrder.length]
  const nextCombatant = snapshot.state.combatants[nextCombatantId]
  const nextInitiativeIndex = (actorIndex + 1) % input.initiativeOrder.length
  const nextTurnSlotId = input.initiativeOrder[nextInitiativeIndex]?.slotId
  const nextTurnRound = snapshot.state.round +
    (actorIndex + 1 >= snapshot.state.initiativeOrder.length ? 1 : 0)
  const nextMonster = nextCombatant?.statBlockId ? getDnd5eSrdMonster(nextCombatant.statBlockId) : undefined
  const nextMonsterRechargeRolls = nextCombatant ? dnd5eMonsterRechargeActions(nextMonster).flatMap((monsterAction) => {
    const usage = monsterAction.usage
    if (usage?.kind !== 'recharge' || nextCombatant.classState.monsterRechargeReadyByActionId?.[monsterAction.id] !== false) return []
    return [{
      actorId: nextCombatant.id,
      actorName: nextCombatant.name,
      actionId: monsterAction.id,
      actionName: monsterAction.name,
      dieSides: usage.dieSides,
      minimum: usage.minimum,
    }]
  }) : []
  const currentMonsterMechanicRolls = dnd5eEligibleMonsterMechanics(monster, 'turn-end', {
    combatId: snapshot.state.combatId,
    round: snapshot.state.round,
    actorId: actorCombatant.id,
    currentHp: actorCombatant.currentHp,
    maxHp: actorCombatant.maxHp,
    usedKeys: actorCombatant.classState.declarativeUsedTurnKeys,
  }).map((mechanic) => ({
    actorId: actorCombatant.id,
    actorName: actorCombatant.name,
    mechanicId: mechanic.id,
    mechanicName: mechanic.name,
    effects: dnd5eMonsterMechanicDiceRequirements(mechanic),
  }))
  const nextMonsterMechanicRolls = nextCombatant ? dnd5eEligibleMonsterMechanics(nextMonster, 'turn-start', {
    combatId: snapshot.state.combatId,
    round: nextTurnRound,
    actorId: nextCombatant.id,
    currentHp: nextCombatant.currentHp,
    maxHp: nextCombatant.maxHp,
    usedKeys: nextCombatant.classState.declarativeUsedTurnKeys,
  }).map((mechanic) => ({
    actorId: nextCombatant.id,
    actorName: nextCombatant.name,
    mechanicId: mechanic.id,
    mechanicName: mechanic.name,
    effects: dnd5eMonsterMechanicDiceRequirements(mechanic),
  })) : []
  const turnStartPreview = nextCombatant
    ? previewDnd5eTurnStartBoundary(
        snapshot.state,
        nextCombatant.id,
        nextTurnSlotId,
        nextTurnRound,
      )
    : undefined
  const previewNextCombatant = nextCombatant
    ? turnStartPreview?.combatants[nextCombatant.id]
    : undefined
  const turnStartActiveEffectSavingThrows = (previewNextCombatant?.classState.activeEffects ?? []).flatMap((effect) => {
    if (effect.repeatSave?.timing !== 'target-turn-start') return []
    const repeatSave = effect.repeatSave
    const source = effect.source.actorId
      ? turnStartPreview?.combatants[effect.source.actorId]
      : undefined
    return [{
      effect,
      targetId: previewNextCombatant!.id,
      targetName: previewNextCombatant!.name,
      modifier: previewNextCombatant!.savingThrowBonuses[repeatSave.ability] ??
        Math.floor((previewNextCombatant!.abilities[repeatSave.ability] - 10) / 2),
      dc: repeatSave.dc,
      mode: dnd5eSavingThrowMode(previewNextCombatant!, repeatSave.ability, {
        effectVisible: effect.visibility !== 'dm-only',
        condition: effect.standardCondition,
        sourceCreatureType: source?.creatureType,
        sourceIsSpell: effect.source.kind === 'spell',
        sourceIsMagical: effect.source.magical === true,
      }),
      blessed: turnStartPreview
        ? dnd5eCombatantHasConcentrationEffect(turnStartPreview, previewNextCombatant!.id, 'bless')
        : false,
      baned: turnStartPreview
        ? dnd5eCombatantHasConcentrationEffect(turnStartPreview, previewNextCombatant!.id, 'bane')
        : false,
    }]
  })
  const turnStartActiveEffectPeriodicDamage = previewNextCombatant && turnStartPreview
    ? dnd5ePendingTurnStartPeriodicDamage(
        turnStartPreview,
        previewNextCombatant.id,
      ).map(({ target, effect }) => {
        const periodicDamage = effect.periodicDamage!
        const savingThrow = periodicDamage.savingThrow
        const source = effect.source.actorId
          ? turnStartPreview.combatants[effect.source.actorId]
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
                modifier: target.savingThrowBonuses[savingThrow.ability] ??
                  Math.floor((target.abilities[savingThrow.ability] - 10) / 2),
                mode: dnd5eSavingThrowMode(target, savingThrow.ability, {
                  effectVisible: effect.visibility !== 'dm-only',
                  condition: effect.standardCondition,
                  sourceCreatureType: source?.creatureType,
                  sourceIsSpell: effect.source.kind === 'spell',
                  sourceIsMagical:
                    savingThrow.magical ?? effect.source.magical === true,
                }),
                blessed: dnd5eCombatantHasConcentrationEffect(
                  turnStartPreview,
                  target.id,
                  'bless',
                ),
                baned: dnd5eCombatantHasConcentrationEffect(
                  turnStartPreview,
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
    : []
  const turnStartGazeRequirements = nextCombatant
    ? prepareDnd5eTurnStartGazeRequirements(
        snapshot.state,
        nextCombatant.id,
        nextTurnSlotId,
        nextTurnRound,
      )
    : []
  const eagleAttunement =
    !!dnd5eTotemWarriorFeatureForCombatant(
      actorCombatant,
      'totemic-attunement-eagle',
    )
  const hasOtherFlight = Math.max(
    actorCombatant.movementSpeeds?.fly ?? 0,
    dnd5eActiveFlySpeed(actorCombatant.classState.activeEffects) ?? 0,
  ) > 0
  const landingElevationFeet = mapGeometryTerrainElevationAtPoint(
    mapGeometryRuntimeForMap(input.map.id),
    actorToken,
  )
  const eagleFallDistanceFeet = Math.max(
    0,
    (actorCombatant.elevationFeet ?? landingElevationFeet) - landingElevationFeet,
  )
  const safeFall = eagleFallDistanceFeet <= dnd5eActiveSafeFallFeet(
    actorCombatant.classState.activeEffects,
  ) && !dnd5eIsIncapacitated(actorCombatant)
  const totemEagleFall =
    eagleAttunement &&
    !hasOtherFlight &&
    actorCombatant.airborne === true
      ? {
          landingElevationFeet,
          distanceFeet: eagleFallDistanceFeet,
          fallingDamageDice: safeFall
            ? 0
            : Math.min(20, Math.floor(eagleFallDistanceFeet / 10)),
        }
      : undefined
  return {
    ok: true,
    prepared: {
      actor,
      actorName: actor?.name ?? actorToken.label,
      actorToken,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      activeEffectSavingThrows,
      turnStartActiveEffectSavingThrows,
      turnStartActiveEffectPeriodicDamage,
      turnStartGazeRequirements,
      totemEagleFall,
      nextTurnSlotId,
      nextMonsterRechargeRolls,
      currentMonsterMechanicRolls,
      nextMonsterMechanicRolls,
    },
  }
}

export function resolveDnd5ePlayerEndTurn(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  activeEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]
  turnStartActiveEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]
  turnStartActiveEffectPeriodicDamageRolls?: readonly Dnd5eActiveEffectPeriodicDamageRoll[]
  turnStartGazeResolutions?: readonly Dnd5eTurnStartGazeResolution[]
  nextMonsterRechargeRolls?: readonly Dnd5eMonsterRechargeRoll[]
  currentMonsterMechanicRolls?: readonly Dnd5eMonsterMechanicRoll[]
  nextMonsterMechanicRolls?: readonly Dnd5eMonsterMechanicRoll[]
  totemEagleFallingDamageRolls?: readonly number[]
}): {
  ok: true
  actor?: Character
  actorName: string
  actorToken: Token
  result: Dnd5eActionResult
  application: Dnd5eMapResultPlan
} | { ok: false; reason: Dnd5eEndTurnRejectReason } {
  const prepared = prepareDnd5ePlayerEndTurn(input)
  if (!prepared.ok) return prepared
  const { actor, actorName, actorToken, state, characterIdByCombatantId } = prepared.prepared
  const result = resolveDnd5eHeadlessAction(
    state,
    {
      type: 'end-turn', actorId: actorToken.id,
      activeEffectSavingThrows: input.activeEffectSavingThrows,
      turnStartActiveEffectSavingThrows: input.turnStartActiveEffectSavingThrows,
      turnStartActiveEffectPeriodicDamageRolls:
        input.turnStartActiveEffectPeriodicDamageRolls,
      turnStartGazeResolutions: input.turnStartGazeResolutions,
      nextTurnSlotId: prepared.prepared.nextTurnSlotId,
      currentMonsterMechanicRolls: input.currentMonsterMechanicRolls,
      nextMonsterRechargeRolls: input.nextMonsterRechargeRolls,
      nextMonsterMechanicRolls: input.nextMonsterMechanicRolls,
      totemEagleLandingElevationFeet:
        prepared.prepared.totemEagleFall?.landingElevationFeet,
      totemEagleFallingDamageRolls: input.totemEagleFallingDamageRolls,
    },
  )
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
