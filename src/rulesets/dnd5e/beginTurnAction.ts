import{readDnd5eInitiativeBeginTurnSource}from'./initiativeOriginal'
import { dnd5eHeightenedSavingThrowMode } from './spells'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { AbilityKey } from '../../lib/dnd'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eClassDefinitionForCharacter } from './classes'
import {
  dnd5eActiveEffectRepeatSaveEligibleAtBoundary,
  dnd5eCombatantHasConcentrationEffect,
  dnd5ePendingTurnStartPeriodicDamage,
  prepareDnd5eTurnStartGazeRequirements,
  previewDnd5eTurnStartBoundary,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterMechanicRoll,
  type Dnd5eMonsterRechargeRoll,
  type Dnd5eTurnStartGazeRequirement,
  type Dnd5eTurnStartGazeResolution,
} from './headlessCombatEngine'
import {
  resolveDnd5eActionWithAirborneFallPreview,
  type Dnd5eAirborneFallDamageRolls,
  type Dnd5eAirborneFallPreview,
} from './airborneFallActionResolution'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import {
  reconcileDnd5eCompoundRepeatSaveEffects,
  type Dnd5eActiveEffectInstance,
  type Dnd5eActiveEffectPeriodicDamageRoll,
  type Dnd5eActiveEffectSavingThrowRoll,
} from './activeEffects'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import type { Dnd5eDamageType } from './damageTypes'
import { getDnd5eSrdMonster } from './monsters'
import {
  dnd5eMonsterRechargeActions,
  dnd5eMonsterTurnStartTraitRollRequirements,
} from './monsterGenericAbilities'
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
  /** Preview after turn-boundary resource refresh, before saves settle. */
  turnStartState: Dnd5eHeadlessCombatState
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
  worldMinute?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
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
  if (slot?.firstRoundOnly && input.round > 1) {
    return { ok: false, reason: 'invalid-action' }
  }
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
    worldMinute: input.worldMinute,
    combatId: input.combatId,
    round: input.round,
    turnSlotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const initiativeSource=readDnd5eInitiativeBeginTurnSource(input)
  if(initiativeSource)for(const[id,combatant]of Object.entries(snapshot.state.combatants)){const actual=initiativeSource.state.combatants[id];if(!actual)throw Error('initiative-original:actual-same-begin-roster-required');combatant.turn=structuredClone(actual.turn)}
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
    : reconcileDnd5eCompoundRepeatSaveEffects(previewActor.classState.activeEffects).flatMap((effect) => {
        const repeatSave = effect.repeatSave
        if (
          repeatSave?.timing !== 'target-turn-start' ||
          !dnd5eActiveEffectRepeatSaveEligibleAtBoundary(snapshot.state, actorToken.id, effect)
        ) return []
        const source = effect.source.actorId
          ? preview.combatants[effect.source.actorId]
          : undefined
        return [{
          effect,
          targetId: previewActor.id,
          targetName: previewActor.name,
          modifier: turnStartSavingThrowModifier(previewActor, repeatSave.ability),
          dc: repeatSave.dc,
          mode: dnd5eHeightenedSavingThrowMode(dnd5eSavingThrowMode(previewActor, repeatSave.ability, {
            effectVisible: effect.visibility !== 'dm-only',
            condition: effect.standardCondition,
            sourceCreatureType: source?.creatureType,
            sourceIsSpell: effect.source.kind === 'spell',
            sourceIsMagical: effect.source.magical === true,
          }), repeatSave.disadvantage === true),
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
    : [...dnd5eMonsterRechargeActions(monster).flatMap((action) => {
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
      }), ...dnd5eMonsterTurnStartTraitRollRequirements({
        monster,
        currentHp: previewActor.currentHp,
        berserk: previewActor.classState.monsterBerserk === true,
      }).map((requirement) => ({
        actorId: previewActor.id,
        actorName: previewActor.name,
        actionId: requirement.id,
        actionName: requirement.name,
        dieSides: requirement.dieSides,
        minimum: requirement.minimum,
      }))]
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
      turnStartState: preview,
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
  savingThrowCounterattacks?: import('./headlessCombatEngine').Dnd5eAction['savingThrowCounterattacks']
  turnStartActiveEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]
  turnStartActiveEffectPeriodicDamageRolls?: readonly Dnd5eActiveEffectPeriodicDamageRoll[]
  turnStartGazeResolutions?: readonly Dnd5eTurnStartGazeResolution[]
  monsterRechargeRolls?: readonly Dnd5eMonsterRechargeRoll[]
  monsterMechanicRolls?: readonly Dnd5eMonsterMechanicRoll[]
  optionalBonusDice?: readonly import('./headlessCombatEngine').Dnd5eOptionalBonusDieUse[]
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
}): {
  ok: true
  actor?: Character
  actorName: string
  actorToken: Token
  result: Dnd5eActionResult
  application: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
} | {
  ok: false
  reason: Dnd5eBeginTurnRejectReason
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
} {
  const prepared = prepareDnd5eBeginTurn(input)
  if (!prepared.ok) return prepared
  const provenanceInput = snapshotActualBeginTurnInput(input)
  const provenancePrepared = snapshotActualBeginTurnData(prepared.prepared)
  const {
    actor,
    actorName,
    actorToken,
    state,
    characterIdByCombatantId,
    turnSlotId,
  } = prepared.prepared
  const { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(state, {
    type: 'begin-turn',
    savingThrowCounterattacks: input.savingThrowCounterattacks,
    actionAlreadyConsumed: input.turnEconomy?.turnKey === `${input.combatId}:${input.round}:${turnSlotId}` && input.turnEconomy.action.current === 0,
    actorId: actorToken.id,
    turnSlotId,
    turnStartActiveEffectSavingThrows: input.turnStartActiveEffectSavingThrows,
    turnStartActiveEffectPeriodicDamageRolls:
      input.turnStartActiveEffectPeriodicDamageRolls,
    turnStartGazeResolutions: input.turnStartGazeResolutions,
    nextMonsterRechargeRolls: input.monsterRechargeRolls,
    nextMonsterMechanicRolls: input.monsterMechanicRolls,
    optionalBonusDice: input.optionalBonusDice,
  }, input.airborneFallDamageRollsByCombatantId)
  if (!result.ok) return { ok: false, reason: 'invalid-action', airborneFalls }
  const application = planDnd5eMapResultApplication({
    state: result.state,
    map: input.map,
    characters: input.characters,
    characterIdByCombatantId,
    events: [...result.events],
  })
  const actual = {
    ok: true as const,
    actor,
    actorName,
    actorToken,
    result,
    airborneFalls,
    application,
  }
  const proof={input:provenanceInput,prepared:provenancePrepared,actual,signature:JSON.stringify(actual)}
  actualBeginTurnResults.set(actual,proof)
  actualBeginTurnResults.set(result,proof)
  return actual
}

type ActualBeginTurnInput=Parameters<typeof resolveDnd5eBeginTurn>[0]
type ActualBeginTurnSuccess=Extract<ReturnType<typeof resolveDnd5eBeginTurn>,{ok:true}>
const actualBeginTurnResults=new WeakMap<object,{input:ActualBeginTurnInput;prepared:PreparedDnd5eBeginTurn;actual:ActualBeginTurnSuccess;signature:string}>()
function assertActualBeginTurnData(value:unknown,seen=new WeakSet<object>()){
 if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value)
 for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){if(descriptor.get||descriptor.set||typeof descriptor.value==='function')throw Error('begin-turn:actual-own-data-required');if('value'in descriptor)assertActualBeginTurnData(descriptor.value,seen)}
 if(value instanceof Map)for(const[key,child]of value){assertActualBeginTurnData(key,seen);assertActualBeginTurnData(child,seen)}
 if(value instanceof Set)for(const child of value)assertActualBeginTurnData(child,seen)
}
function snapshotActualBeginTurnData<T>(value:T):T{assertActualBeginTurnData(value);return JSON.parse(JSON.stringify(value))as T}
function snapshotActualBeginTurnInput(input:ActualBeginTurnInput):ActualBeginTurnInput{
 const keys=['worldMinute','turnEconomy','combatId','round','initiativeIndex','map','characters','initiativeOrder','savingThrowCounterattacks','turnStartActiveEffectSavingThrows','turnStartActiveEffectPeriodicDamageRolls','turnStartGazeResolutions','monsterRechargeRolls','monsterMechanicRolls','optionalBonusDice','airborneFallDamageRollsByCombatantId']as const
 const own=Object.fromEntries(keys.flatMap(key=>{const descriptor=Object.getOwnPropertyDescriptor(input,key);if(!descriptor)return[];if(descriptor.get||descriptor.set)throw Error('begin-turn:actual-own-data-required');return[[key,descriptor.value]]}))
 return snapshotActualBeginTurnData(own)as ActualBeginTurnInput
}
/** Mechanical provenance only. This reader grants no Room, controller, dice,
 * continuation or world-publication permission and exposes no issuer. */
export function readDnd5eActualBeginTurnResult(value:object){
 const proof=actualBeginTurnResults.get(value);if(!proof)throw Error('begin-turn:actual-native-result-required')
 assertActualBeginTurnData(proof.actual)
 if(JSON.stringify(proof.actual)!==proof.signature)throw Error('begin-turn:actual-unchanged-native-result-required')
 return{resolve:resolveDnd5eBeginTurn,input:snapshotActualBeginTurnData(proof.input),prepared:snapshotActualBeginTurnData(proof.prepared),result:snapshotActualBeginTurnData(proof.actual.result),signature:proof.signature}
}
