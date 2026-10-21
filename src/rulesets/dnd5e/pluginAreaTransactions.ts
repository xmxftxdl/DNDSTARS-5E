import { dnd5eMappedObjectProximityIncludes } from './persistentAreaMappedObjectProximity'
import { dnd5ePersistentAreaAllowsTarget } from './persistentAreaGeometry'
import { dnd5ePersistentAreaRemainingTargetBudget } from './persistentAreaTriggerBudget'
import {dnd5eAreaAnchorPush} from './areaAnchorPush'
import { planDnd5ePersistentAreaCaptiveRise } from './persistentAreaCaptiveRise'
import {createPersistentAreaDestructibleRestraint} from './persistentAreaDestructibleRestraint'
import { syncDnd5eSubmergedBreathingClock } from './headlessCombatEngine'
import { tokenCenterForAnchorCell } from '../../lib/gridCombat'
import { mapGeometryTerrainElevationAtPoint, mapGeometryRuntimeForMap, mapGeometryTokenElevation, mapGeometryMovementBlocked } from '../../lib/mapGeometry'
import { dnd5eMappedVerticalDisplacement } from './verticalDisplacement'
import { planDnd5ePersistentAreaCapacity, normalizeDnd5ePersistentAreaCapacity, type Dnd5ePersistentAreaCapacityPlan } from './persistentAreaCapacity'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'
import { dnd5ePersistentAreaSizeSaveSucceeds } from './persistentAreaTypes'
import { dnd5eNearestOutsideAreaMovementV1, dnd5ePersistentAreaPushMovementV1 } from './activities/dnd5eActivityMapInteraction'
import { persistentAreaCreatureTypesAllowed, persistentAreaSizeAllowed } from './persistentAreaCreatureFilter'
import { dnd5eIsSourceSpellSummon } from './sourceSpellSummon'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { resolveDnd5eRollMode } from './rollMode'
import {
  dnd5eCombatantHasConcentrationCheckAdvantage,
  dnd5eCombatantIsFlying,
  dnd5eEffectiveFlySpeed,
  dnd5eCombatantCanSee,
  dnd5eDirectedCombatantPairKey,
  dnd5eCombatantHasConcentrationEffect,
  resolveDnd5ePersistentAreaTrigger,
  applyDnd5eStandardConditionEffect,
  removeDnd5eCombatantActiveEffectsByIds,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5ePersistentAreaDmAdjustment,
  type Dnd5eSpellDamageMaxDieBonusUse,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import {
  dnd5ePersistentAreaTriggerTimingIsSimultaneousWave,
  recordDnd5ePersistentAreaTrigger,
  type Dnd5ePersistentAreaTriggerCandidate,
} from './pluginAreas'
import { dnd5ePersistentAreaConditionEffects } from './persistentAreaConditionEffects'
import { recordDnd5eStraightMovement } from './straightMovementStreak'

/** Read current character/monster/form size through the same bridge used by final settlement. */
export function dnd5ePersistentAreaSizeRanks(input: {
  map: BattleMap; characters: readonly Character[]; round: number
}): ReadonlyMap<string, number | undefined> | undefined {
  if (!input.map.dnd5ePluginAreas?.some(area => area.triggers?.some(trigger => trigger.targetSizeRanks !== undefined))) return undefined
  const snapshot = createDnd5eMapCombatSnapshot({ ...input, combatId: `area-size:${input.map.id}`,
    initiativeOrder: input.map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type))
      .map(token => ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0 })) })
  return new Map(Object.values(snapshot.state.combatants).map(actor => [actor.id, actor.sizeRank]))
}

/** Host-derived capability context; no snapshot is built when no flight-gated trigger exists. */
export function dnd5ePersistentAreaFlightCapableTokenIds(input: {
  map: BattleMap; characters: readonly Character[]; round: number
}): ReadonlySet<string> | undefined {
  if (!input.map.dnd5ePluginAreas?.some(area => area.triggers?.some(trigger => trigger.requiresTargetFlying))) return undefined
  const snapshot = createDnd5eMapCombatSnapshot({ map: input.map, characters: input.characters, round: input.round,
    combatId: `area-flight:${input.map.id}`, initiativeOrder: input.map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type))
      .map(token => ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0 })) })
  return new Set(Object.values(snapshot.state.combatants).filter(actor => actor.traversalMode === 'fly' && (dnd5eEffectiveFlySpeed(actor) ?? 0) > 0).map(actor => actor.id))
}

export interface Dnd5ePersistentAreaDamageRollRequest {
  areaId: string
  rollerTokenId: string
  triggerId: string
  timing: Dnd5ePersistentAreaTriggerCandidate['trigger']['timing']
  count: number
  sides: number
  label: string
  targetName: string
}

export function dnd5ePersistentAreaDamageWaveKey(
  input: Pick<Dnd5ePersistentAreaDamageRollRequest, 'areaId' | 'triggerId' | 'timing'>,
): string | undefined {
  return dnd5ePersistentAreaTriggerTimingIsSimultaneousWave(input.timing)
    ? `${input.areaId}\u0000${input.triggerId}`
    : undefined
}

/**
 * A simultaneous area pulse is one damage roll applied to every affected
 * target. Saves and resistances still resolve per target, but they must not
 * cause the UI settlement loop to roll a fresh damage pool for each creature.
 */
export function createDnd5ePersistentAreaDamageRollCoordinator(
  rollDice: (
    count: number,
    sides: number,
    label: string,
    targetName: string,
    ownership: { rollerTokenId: string },
  ) => Promise<readonly number[]>,
) {
  const rollsByWave = new Map<string, Promise<readonly number[]>>()
  return (input: Dnd5ePersistentAreaDamageRollRequest): Promise<readonly number[]> => {
    if (input.count === 0) return Promise.resolve([])
    const waveKey = dnd5ePersistentAreaDamageWaveKey(input)
    if (!waveKey) return rollDice(input.count, input.sides, input.label, input.targetName, { rollerTokenId: input.rollerTokenId })
    const existing = rollsByWave.get(waveKey)
    if (existing) return existing
    const pending = rollDice(input.count, input.sides, input.label, input.targetName, { rollerTokenId: input.rollerTokenId })
    rollsByWave.set(waveKey, pending)
    return pending
  }
}

/**
 * Returns every saving throw that belongs to the same already-started area
 * wave. Presentation can collect these rolls before the shared damage pool is
 * rolled, while ordinary enter/turn triggers remain strictly per creature.
 */
export function dnd5ePersistentAreaSavingThrowWaveCandidates(
  candidates: readonly Dnd5ePersistentAreaTriggerCandidate[],
  anchor: Dnd5ePersistentAreaTriggerCandidate,
): readonly Dnd5ePersistentAreaTriggerCandidate[] {
  const waveKey = dnd5ePersistentAreaDamageWaveKey({
    areaId: anchor.area.id,
    triggerId: anchor.trigger.id,
    timing: anchor.trigger.timing,
  })
  if (!waveKey || !anchor.trigger.savingThrow || anchor.trigger.sourceChoosesTargets || anchor.trigger.sourceMayDecline) return []
  return candidates.filter((candidate) =>
    !!candidate.trigger.savingThrow &&
    !candidate.trigger.sourceChoosesTargets &&
    !candidate.trigger.sourceMayDecline &&
    dnd5ePersistentAreaDamageWaveKey({
      areaId: candidate.area.id,
      triggerId: candidate.trigger.id,
      timing: candidate.trigger.timing,
    }) === waveKey,
  )
}

/**
 * Completes the saving-throw phase of every simultaneous area wave before the
 * caller is allowed to enter its damage/application phase. Keeping this
 * barrier outside the per-target settlement loop prevents one target's damage
 * dice from appearing between another two targets' saves.
 */
export async function collectDnd5ePersistentAreaSavingThrowWaveResults<Result>(input: {
  candidates: readonly Dnd5ePersistentAreaTriggerCandidate[]
  resolve: (candidate: Dnd5ePersistentAreaTriggerCandidate) => Promise<Result | undefined>
}): Promise<ReadonlyMap<string, Result>> {
  const results = new Map<string, Result>()
  const completedWaves = new Set<string>()
  for (const anchor of input.candidates) {
    const waveKey = dnd5ePersistentAreaDamageWaveKey({
      areaId: anchor.area.id,
      triggerId: anchor.trigger.id,
      timing: anchor.trigger.timing,
    })
    if (!waveKey || completedWaves.has(waveKey)) continue
    const waveCandidates = dnd5ePersistentAreaSavingThrowWaveCandidates(input.candidates, anchor)
    if (waveCandidates.length < 2) continue
    completedWaves.add(waveKey)
    for (const candidate of waveCandidates) {
      const result = await input.resolve(candidate)
      if (result !== undefined) results.set(candidate.transactionId, result)
    }
  }
  return results
}

export interface PreparedDnd5ePersistentAreaTrigger {
  candidate: Dnd5ePersistentAreaTriggerCandidate
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  targetName: string
  save?: {
    allowWillingFailure: boolean
    ability: NonNullable<Dnd5ePersistentAreaTriggerCandidate['trigger']['savingThrow']>['ability']
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }
}

/** One target-controller decision per trigger transaction, shared by the save wave and commit pass. */
export function createDnd5ePersistentAreaWillingFailureCoordinator(
  request: (prepared: PreparedDnd5ePersistentAreaTrigger) => Promise<boolean>,
): (prepared: PreparedDnd5ePersistentAreaTrigger) => Promise<boolean> {
  const choices = new Map<string, Promise<boolean>>()
  return prepared => {
    if (!prepared.save?.allowWillingFailure) return Promise.resolve(false)
    const key = prepared.candidate.transactionId
    let pending = choices.get(key)
    if (!pending) {
      pending = Promise.resolve().then(() => request(prepared)).then(choice => choice === true)
      choices.set(key, pending)
    }
    return pending
  }
}

export function prepareDnd5ePersistentAreaTrigger(input: {
  worldMinute?: number
  combatId: string
  round: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  candidate: Dnd5ePersistentAreaTriggerCandidate
}, hostState?: Dnd5eHeadlessCombatState): { ok: true; prepared: PreparedDnd5ePersistentAreaTrigger } | { ok: false; reason: string } {
  // Host-owned continuation state, never an action payload. Project its current
  // positions/effects for spatial checks without rebuilding combat resources.
  let continuationSnapshot: ReturnType<typeof createDnd5eMapCombatSnapshot> | undefined
  if (hostState) {
    if (hostState.mapId !== input.map.id || hostState.combatId !== input.combatId || hostState.round !== input.round) {
      return { ok: false, reason: 'persistent-area-state-mismatch' }
    }
    const state = structuredClone(hostState)
    const characterIdByCombatantId = Object.fromEntries(input.map.tokens.flatMap(token =>
      token.characterId && !token.dnd5eSimulacrum ? [[token.id, token.characterId]] : []))
    if (Object.keys(state.combatants).some(id => !input.map.tokens.some(token => token.id === id))) {
      return { ok: false, reason: 'combatant-missing' }
    }
    const projected = planDnd5eMapResultApplication({ state, map: structuredClone(input.map),
      characters: structuredClone([...input.characters]), characterIdByCombatantId, events: [] })
    input = { ...input, map: projected.map, characters: projected.characters }
    continuationSnapshot = { state, characterIdByCombatantId }
  }
  const trigger = input.candidate.trigger
  const currentArea = input.map.dnd5ePluginAreas?.find(area => area.id === input.candidate.area.id) ?? input.candidate.area
  if (trigger.timing !== 'on-detonate' && currentArea.permanent !== true && input.round > currentArea.expiresAfterRound) {
    return { ok: false, reason: 'persistent-area-expired' }
  }
  if (dnd5ePersistentAreaRemainingTargetBudget(currentArea, trigger, input.candidate.turnKey) <= 0) {
    return { ok: false, reason: 'persistent-area-exhausted' }
  }
  const currentTarget = input.map.tokens.find(token => token.id === input.candidate.targetToken.id)
  if ((trigger.proximityObjectKind && (!currentTarget || !dnd5eMappedObjectProximityIncludes(input.map, currentArea, trigger, currentTarget))) ||
    (trigger.targetRelation && (!currentTarget || !dnd5ePersistentAreaAllowsTarget({...currentArea, relation: trigger.targetRelation}, currentTarget, input.map)))) {
    return { ok: false, reason: 'invalid-target' }
  }
  const initiativeOrder = [...input.initiativeOrder]
  if (trigger.capacity) {
    const minimum = Math.min(0, ...initiativeOrder.map(entry => entry.roll))
    for (const token of input.map.tokens) {
      if (!['player', 'enemy', 'npc'].includes(token.type)) continue
      if (token.characterId && !token.dnd5eSimulacrum && !input.characters.some(character => character.id === token.characterId)) {
        return { ok: false, reason: 'combatant-missing' }
      }
      if (!initiativeOrder.some(entry => entry.tokenId === token.id)) initiativeOrder.push({
        tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: minimum - initiativeOrder.length - 1,
      })
    }
  }
  if (trigger.maximumTotalUses != null && (input.candidate.area.triggerReceipts ?? []).filter(receipt =>
    !receipt.declined && receipt.triggerId === (trigger.frequencyGroupId ?? trigger.id),
  ).length >= trigger.maximumTotalUses) return { ok: false, reason: 'persistent-area-exhausted' }
  const snapshot = continuationSnapshot ?? createDnd5eMapCombatSnapshot({
    worldMinute: input.worldMinute,
    combatId: input.combatId,
    round: input.round,
    turnSlotId: input.initiativeOrder.find((entry) => entry.tokenId === input.candidate.targetToken.id)?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder,
  })
  const source = snapshot.state.combatants[input.candidate.area.sourceTokenId]
  const target = snapshot.state.combatants[input.candidate.targetToken.id]
  if (!source || !target || target.deathSaves.dead) return { ok: false, reason: 'combatant-missing' }
  if (trigger.requiresSourceSpellSummon && !dnd5eIsSourceSpellSummon(input.map, source.id, target.id)) return { ok: false, reason: 'invalid-target' }
  if (trigger.condition?.fearSourceIsAnchor && !snapshot.state.spatialEffectSources?.[input.candidate.area.anchorTokenId ?? '']) {
    return { ok: false, reason: 'invalid-target' }
  }
  if (trigger.targetSeesAnchorOnCreate && (trigger.timing !== 'on-create' || target.conditions.includes('blinded') ||
    !dnd5ePersistentAreaObserverSeesAnchor(input.map, input.candidate.area, target.id))) return { ok: false, reason: 'invalid-target' }
  if (trigger.requiresTargetFlying && !dnd5eCombatantIsFlying(target)) return { ok: false, reason: 'target-not-flying' }
  if (trigger.requiresTargetGrounded && (!Number.isFinite(target.elevationFeet) || !Number.isFinite(target.groundElevationFeet) ||
    Math.abs(target.elevationFeet! - target.groundElevationFeet!) > 1e-4)) return { ok: false, reason: 'invalid-target' }
  if (!persistentAreaSizeAllowed(trigger, target.sizeRank)) return { ok: false, reason: 'invalid-target' }
  if (trigger.requiresSourceLineOfEffect && source.id !== target.id &&
    snapshot.state.lineOfEffectBlockedByCombatantPair?.[dnd5eDirectedCombatantPairKey(source.id, target.id)]) return { ok: false, reason: 'invalid-target' }
  if (input.candidate.trigger.requiresSourceVision && source.id !== target.id &&
    !dnd5eCombatantCanSee(snapshot.state, source.id, target.id)) return { ok: false, reason: 'invalid-target' }
  if (!persistentAreaCreatureTypesAllowed(input.candidate.trigger, target.creatureType ? [target.creatureType] : [])) {
    return { ok: false, reason: 'invalid-target' }
  }
  if (input.candidate.trigger.endTargetConcentrationOnFailedSave && !target.concentrating) {
    return { ok: false, reason: 'target-not-concentrating' }
  }
  const saveContext = {
    effectVisible: true,
    sourceCreatureType: source.creatureType,
    // Persistent areas can be routed through the structured-partial spell path
    // without also having a direct combat-spell definition. Their provenance,
    // rather than a second registry lookup, is authoritative for Magic Resistance.
    sourceIsSpell: input.candidate.area.sourceKind === 'core-spell',
    sourceIsMagical: input.candidate.area.sourceKind === 'core-spell'
      ? input.candidate.trigger.savingThrow?.magical !== false
      : input.candidate.trigger.savingThrow?.magical === true,
  } as const
  const skipSaveCondition = input.candidate.trigger.skipSaveWhenSourceConditionActive
  const hasSourceCondition = skipSaveCondition
    ? dnd5ePersistentAreaConditionEffects({ effects: target.classState.activeEffects,
        condition: skipSaveCondition, sourceId: source.id, areaId: input.candidate.area.id,
        legacyCoreSpellId: input.candidate.area.coreSpellId }).length > 0
    : false
  const save = input.candidate.trigger.savingThrow && !hasSourceCondition &&
    !dnd5ePersistentAreaSizeSaveSucceeds(input.candidate.trigger.savingThrow, target.sizeRank)
    ? {
        allowWillingFailure: input.candidate.trigger.savingThrow.allowWillingFailure === true,
        ability: input.candidate.trigger.savingThrow.ability,
        dc: input.candidate.trigger.savingThrow.dc,
        mode: resolveDnd5eRollMode({
          requestedMode: dnd5eSavingThrowMode(
            target,
            input.candidate.trigger.savingThrow.ability,
            saveContext,
          ),
          advantage: [{
            active: input.candidate.trigger.savingThrow.advantageIfTargetHasSwimSpeed === true &&
              (target.movementSpeeds?.swim ?? 0) > 0,
            reason: 'persistent-area-swim-speed',
          }, {
            active: input.candidate.trigger.endTargetConcentrationOnFailedSave === true &&
              dnd5eCombatantHasConcentrationCheckAdvantage(target),
            reason: 'concentration-check-advantage',
          }],
          disadvantage: [{
            active: input.candidate.trigger.savingThrow.shapechangerDisadvantage === true &&
              target.shapechanger === true,
            reason: 'moonbeam-shapechanger',
          }],
        }).mode,
        blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, target.id, 'bless'),
        baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, target.id, 'bane'),
      }
    : undefined
  return {
    ok: true,
    prepared: {
      candidate: input.candidate,
      state: snapshot.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      targetName: target.name,
      save,
    },
  }
}

/** Preview only; primary damage and receipt are not committed before both saves settle. */
export function prepareDnd5ePersistentAreaConditionSave(
  input: Parameters<typeof resolvePreparedDnd5ePersistentAreaTrigger>[0],
): PreparedDnd5ePersistentAreaTrigger | undefined {
  const p=input.prepared,save=p.candidate.trigger.conditionSavingThrow
  if(!save)return undefined
  const primary=resolvePreparedDnd5ePersistentAreaTrigger({...input,conditionSave:undefined,prepared:{...p,
    candidate:{...p.candidate,trigger:{...p.candidate.trigger,conditionSavingThrow:undefined,condition:undefined}}}})
  if(!primary.result.ok||!primary.application)return undefined
  const receipt=primary.result.events.find(event=>event.type==='persistent-area-triggered')
  const target=primary.result.state.combatants[p.candidate.targetToken.id]
  if(receipt?.type!=='persistent-area-triggered'||receipt.saveSuccess!==false||target.deathSaves.dead||
    dnd5ePersistentAreaSizeSaveSucceeds(save,target.sizeRank))return undefined
  const ready=prepareDnd5ePersistentAreaTrigger({combatId:p.state.combatId,round:p.state.round,
    worldMinute:p.state.companionScene?.worldMinute,map:primary.application.map,characters:primary.application.characters,
    initiativeOrder:p.state.initiativeOrder.map((id,index)=>({tokenId:id,label:p.state.combatants[id].name,roll:-index,color:'',emoji:''})),
    candidate:{...p.candidate,trigger:{id:p.candidate.trigger.id,label:p.candidate.trigger.label,timing:p.candidate.trigger.timing,
      savingThrow:save,condition:p.candidate.trigger.condition}}})
  return ready.ok?ready.prepared:undefined
}

export function resolvePreparedDnd5ePersistentAreaTrigger(input: {
  disadvantageNegationChoice?: Parameters<typeof resolveDnd5ePersistentAreaTrigger>[1]['disadvantageNegationChoice']
  prepared: PreparedDnd5ePersistentAreaTrigger
  conditionSave?: Parameters<typeof resolveDnd5ePersistentAreaTrigger>[1]['conditionSave']
  d20?: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  blessRoll?: number
  baneRoll?: number
  rerollResourceKey?: string; rerollD20?: number
  rerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  optionalBonusDice?: readonly import('./headlessCombatEngine').Dnd5eOptionalBonusDieUse[]
  damageRolls?: readonly number[]
  healingRolls?: readonly number[]
  sourceConsent?: boolean
  /** Host-obtained target-controller choice, never a claim from the area creator. */
  willingFailure?: boolean
  /** Host's explicit 1-based capacity draws; empty until the deterministic planner requests them. */
  capacityRandomResults?: readonly number[]
  spellDamageMaxDieBonus?: Dnd5eSpellDamageMaxDieBonusUse
  dmAdjustment?: Dnd5ePersistentAreaDmAdjustment
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan;
  capacitySelection?: Extract<Dnd5ePersistentAreaCapacityPlan, { kind: 'random-selection-required' }> } {
  const { prepared } = input
  // A stale map must fail before projecting effects; the map bridge requires every combatant token.
  const mapTokenIds = new Set(prepared.map.tokens.map(token => token.id))
  if (Object.keys(prepared.state.combatants).some(id => !mapTokenIds.has(id))) {
    return { result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' } }
  }
  const result = resolveDnd5ePersistentAreaTrigger(prepared.state, {
    disadvantageNegationChoice: input.disadvantageNegationChoice,
    areaMapId: prepared.map.id,
    areaId: prepared.candidate.area.id,
    areaOrigin: prepared.candidate.area.anchorCell
      ? { ...tokenCenterForAnchorCell(prepared.candidate.area.anchorCell, { size: 1 }, prepared.map),
        elevationFeet: prepared.candidate.area.vertical?.mode === 'volume'
          ? prepared.candidate.area.vertical.baseElevationFeet + (prepared.candidate.area.vertical.shape === 'sphere' ? prepared.candidate.area.vertical.heightFeet / 2 : 0)
          : mapGeometryTerrainElevationAtPoint(prepared.state.companionScene?.geometry ?? undefined, tokenCenterForAnchorCell(prepared.candidate.area.anchorCell, { size: 1 }, prepared.map)) } : undefined,
    areaSourceKind: prepared.candidate.area.sourceKind,
    coreSpellId: prepared.candidate.area.coreSpellId,
    castingClassId: prepared.candidate.area.castingClassId,
    sourceId: prepared.candidate.area.sourceTokenId,
    targetId: prepared.candidate.targetToken.id,
    trigger: prepared.candidate.trigger,
    conditionSave: input.conditionSave,
    d20: input.d20,
    d20Second: input.d20Second,
    halflingLuckyD20: input.halflingLuckyD20,
    halflingLuckyD20Second: input.halflingLuckyD20Second,
    blessRoll: input.blessRoll,
    baneRoll: input.baneRoll,
    rerollResourceKey: input.rerollResourceKey,
    rerollD20: input.rerollD20,
    rerollD20Second: input.rerollD20Second,
    bardicInspirationRoll: input.bardicInspirationRoll,
    darkOnesOwnLuckRoll: input.darkOnesOwnLuckRoll,
    optionalBonusDice: input.optionalBonusDice,
    damageRolls: input.damageRolls,
    healingRolls: input.healingRolls,
    sourceConsent: input.sourceConsent,
    willingFailure: input.willingFailure,
    spellDamageMaxDieBonus: input.spellDamageMaxDieBonus,
    dmAdjustment: input.dmAdjustment,
  })
  if (!result.ok) return { result }
  if (prepared.candidate.trigger.boundRestraintRiseFeet != null) {
    const target = result.state.combatants[prepared.candidate.targetToken.id]
    const before = target.elevationFeet ?? target.groundElevationFeet ?? 0
    target.elevationFeet = planDnd5ePersistentAreaCaptiveRise({map: prepared.map, area: prepared.candidate.area,
      token: prepared.candidate.targetToken, effects: target.classState.activeEffects,
      elevationFeet: before, distanceFeet: prepared.candidate.trigger.boundRestraintRiseFeet})
    if (target.elevationFeet > before) target.airborne = true
  }
  const events = [...result.events]
  const triggerEvent = result.events.find((event) =>
    event.type === 'persistent-area-triggered' &&
    event.areaId === prepared.candidate.area.id &&
    event.triggerId === prepared.candidate.trigger.id &&
    event.targetId === prepared.candidate.targetToken.id
  )
  const appliedDamage = triggerEvent?.type === 'persistent-area-triggered'
    ? triggerEvent.damage
    : 0
  if (prepared.candidate.trigger.condition?.fearSourceIsAnchor && triggerEvent?.type === 'persistent-area-triggered' &&
    triggerEvent.conditionApplied === 'frightened') {
    const area = prepared.candidate.area
    const target = result.state.combatants[prepared.candidate.targetToken.id]
    const ids = new Set(dnd5ePersistentAreaConditionEffects({ effects: target.classState.activeEffects,
      areaId: area.id, sourceId: area.sourceTokenId, condition: 'frightened' }).map(effect => effect.id))
    target.classState.activeEffects = target.classState.activeEffects?.map(effect => ids.has(effect.id)
      ? { ...effect, tags: [...(effect.tags ?? []), `condition-entity:${area.anchorTokenId}`],
          ...(effect.repeatSave ? { repeatSave: { ...effect.repeatSave, requiresSourceNotVisible: true } } : {}) } : effect)
  }
  const capacity = prepared.candidate.trigger.capacity
  if (prepared.candidate.trigger.condition?.suspendAboveGroundFeet !== undefined && triggerEvent?.type === 'persistent-area-triggered' &&
    triggerEvent.conditionApplied === 'restrained') {
    const target = result.state.combatants[prepared.candidate.targetToken.id]
    const before = prepared.state.combatants[target.id]
    const token = prepared.map.tokens.find(entry => entry.id === target.id)!
    const geometry = mapGeometryRuntimeForMap(prepared.map.id)
    const sweep = dnd5eMappedVerticalDisplacement({ map: prepared.map, geometry, token,
      fromFeet: before.elevationFeet!, toFeet: target.elevationFeet! })
    if (sweep.blocked || mapGeometryMovementBlocked({ map: prepared.map, geometry, token, to: token,
      fromElevationFeet: before.elevationFeet, toElevationFeet: target.elevationFeet }).blocked) {
      return { result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' } }
    }
  }
  if (prepared.candidate.trigger.condition?.endsWithArea &&
    triggerEvent?.type === 'persistent-area-triggered' && !triggerEvent.declined && triggerEvent.conditionApplied === 'restrained') {
    const area = prepared.candidate.area
    const target = result.state.combatants[prepared.candidate.targetToken.id]
    const ids = new Set(dnd5ePersistentAreaConditionEffects({ effects: target.classState.activeEffects,
      areaId: area.id, sourceId: area.sourceTokenId, condition: 'restrained' }).map(effect => effect.id))
    target.classState.activeEffects = target.classState.activeEffects?.map(effect => ids.has(effect.id)
      ? { ...effect, areaLifetime: { mapId: prepared.map.id, areaId: area.id, sourceActorId: area.sourceTokenId } } : effect)
  }
  if (capacity && triggerEvent?.type === 'persistent-area-triggered' && !triggerEvent.declined && triggerEvent.conditionApplied === 'restrained') {
    const fail = () => ({ result: { ok: false as const, state: prepared.state, events: [], reason: 'invalid-target' as const } })
    if (!normalizeDnd5ePersistentAreaCapacity(capacity)) return fail()
    const area = prepared.candidate.area
    const entrantId = prepared.candidate.targetToken.id
    const entrant = result.state.combatants[entrantId]
    const lifetimeEffectIds = new Set(dnd5ePersistentAreaConditionEffects({ effects: entrant.classState.activeEffects,
      areaId: area.id, sourceId: area.sourceTokenId, condition: 'restrained' }).map(effect => effect.id))
    entrant.classState.activeEffects = entrant.classState.activeEffects?.map(effect => lifetimeEffectIds.has(effect.id)
      ? { ...effect, areaLifetime: { mapId: prepared.map.id, areaId: area.id, sourceActorId: area.sourceTokenId } } : effect)
    let projected = planDnd5eMapResultApplication({ state: result.state, map: prepared.map,
      characters: prepared.characters, characterIdByCombatantId: prepared.characterIdByCombatantId, events }).map
    const existing = projected.tokens.filter(token => token.id !== entrantId &&
      dnd5eTokenIntersectsPersistentAreaAt(token, projected, area, token) &&
      dnd5ePersistentAreaConditionEffects({ effects: result.state.combatants[token.id]?.classState.activeEffects,
        areaId: area.id, sourceId: area.sourceTokenId, condition: 'restrained' }).length > 0)
      .map(token => ({ targetId: token.id, sizeRank: result.state.combatants[token.id].sizeRank }))
    const plan = planDnd5ePersistentAreaCapacity({ policy: capacity, existing,
      entrant: { targetId: entrantId, sizeRank: result.state.combatants[entrantId].sizeRank }, randomResults: input.capacityRandomResults })
    if (plan.kind === 'invalid') return fail()
    if (plan.kind === 'random-selection-required') return { result: {
      ok: false, state: prepared.state, events: [], reason: 'invalid-dice' }, capacitySelection: plan }
    for (const targetId of plan.expelledIds) {
      const target = result.state.combatants[targetId]
      const destination = dnd5eNearestOutsideAreaMovementV1({ map: projected, area, targetTokenId: targetId,
        maximumOutsideDistanceFeet: capacity.maximumOutsideDistanceFeet })
      if (!destination) return fail()
      const token = projected.tokens.find(token => token.id === targetId)!
      const geometry = mapGeometryRuntimeForMap(projected.id)
      const fromElevationFeet = mapGeometryTokenElevation(geometry, token)
      const toElevationFeet = mapGeometryTokenElevation(geometry, { ...token, ...destination.position })
      // Vertical ejection requires landing/fall rules, which this admission policy does not imply.
      if (fromElevationFeet !== toElevationFeet) return fail()
      const effects = dnd5ePersistentAreaConditionEffects({ effects: target.classState.activeEffects,
        areaId: area.id, sourceId: area.sourceTokenId, condition: 'restrained' })
      const removed = removeDnd5eCombatantActiveEffectsByIds(result.state, targetId, effects.map(effect => effect.id), 'released', events)
      if (removed.length !== effects.length) return fail()
      const from = { ...target.position }
      target.position = { ...destination.position }
      target.elevationFeet = toElevationFeet
      if (capacity.proneOnExpulsion) applyDnd5eStandardConditionEffect(target, result.state.combatants[area.sourceTokenId], {
        rulesId: `persistent-area:${area.id}:capacity-expulsion`, condition: 'prone', duration: { type: 'permanent' },
        sourceKind: 'feature', magical: false,
      }, events)
      events.push({ type: 'moved', actorId: targetId, sourceActorId: area.sourceTokenId, from, to: { ...target.position },
        fromElevationFeet, toElevationFeet, distance: destination.distanceFeet, movementKind: 'forced' })
      recordDnd5eStraightMovement(result.state, events.slice(-1))
      projected = planDnd5eMapResultApplication({ state: result.state, map: projected,
        characters: prepared.characters, characterIdByCombatantId: prepared.characterIdByCombatantId, events }).map
    }
  }
  const movement = prepared.candidate.trigger.forcedMovement
  if (movement && triggerEvent?.type === 'persistent-area-triggered' && !triggerEvent.declined && (
    movement.appliesOn === 'always' ||
    (movement.appliesOn === 'successful-save' && triggerEvent.saveSuccess === true) ||
    (movement.appliesOn === 'failed-save' && triggerEvent.saveSuccess === false)
  )) {
    const targetId = prepared.candidate.targetToken.id
    const movementMap = planDnd5eMapResultApplication({ state: result.state, map: prepared.map,
      characters: prepared.characters, characterIdByCombatantId: prepared.characterIdByCombatantId,
      events }).map
    if ((movement.mode === 'push-from-area-anchor' || movement.mode === 'pull-to-area-anchor') && !prepared.candidate.area.anchorCell) {
      return { result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' } }
    }
    const destination = movement.mode === 'push-from-area-anchor' && prepared.candidate.area.vertical?.mode === 'volume'
      ? dnd5eAreaAnchorPush({map:movementMap,area:prepared.candidate.area,targetTokenId:targetId,distanceFeet:movement.distanceFeet})
      : movement.mode === 'nearest-outside-area'
      ? dnd5eNearestOutsideAreaMovementV1({ map: movementMap, area: prepared.candidate.area, targetTokenId: targetId,
          maximumOutsideDistanceFeet: movement.maximumOutsideDistanceFeet })
      : dnd5ePersistentAreaPushMovementV1({ map: movementMap, sourceTokenId: prepared.candidate.area.sourceTokenId,
        targetTokenId: targetId, distanceFeet: movement.distanceFeet,
        direction: movement.mode === 'push-fixed-direction' ? movement.direction : undefined,
        mode: movement.mode === 'pull-to-area-anchor' ? 'pull' : 'push',
        originCell: movement.mode === 'push-from-area-anchor' || movement.mode === 'pull-to-area-anchor' ? prepared.candidate.area.anchorCell : undefined })
    // Never commit damage, conditions or a receipt while silently omitting required displacement.
    if (!destination) return { result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' } }
    const target = result.state.combatants[targetId]
    if (destination.distanceFeet > 0) {
      const from = { ...target.position }
      target.position = { ...destination.position }
      const fromElevationFeet=target.elevationFeet
      if ('elevationFeet' in destination && typeof destination.elevationFeet==='number') target.elevationFeet=destination.elevationFeet
      if ('groundElevationFeet' in destination && typeof destination.groundElevationFeet==='number') target.groundElevationFeet=destination.groundElevationFeet
      if ('elevationFeet' in destination) target.airborne=(target.elevationFeet??0)>(target.groundElevationFeet??0)+1e-7
      events.push({ type: 'moved', actorId: targetId, sourceActorId: prepared.candidate.area.sourceTokenId,
        fromElevationFeet,toElevationFeet:target.elevationFeet,
        from, to: { ...destination.position }, distance: destination.distanceFeet, movementKind: 'forced' })
      recordDnd5eStraightMovement(result.state, events.slice(-1))
    }
  }
  const restraintDeclaration=prepared.candidate.trigger.condition?.destructibleRestraint
  const restraint=restraintDeclaration && triggerEvent?.type==='persistent-area-triggered' && triggerEvent.conditionApplied==='restrained'
    ? createPersistentAreaDestructibleRestraint({map:prepared.map,state:result.state,area:prepared.candidate.area,targetId:prepared.candidate.targetToken.id,declaration:restraintDeclaration}) : undefined
  if(restraintDeclaration && triggerEvent?.type==='persistent-area-triggered' && triggerEvent.conditionApplied==='restrained' && !restraint)
    return {result:{ok:false,state:prepared.state,events:[],reason:'invalid-target'}}
  const map = {
    ...prepared.map,
    dnd5ePluginAreas: recordDnd5ePersistentAreaTrigger(
      prepared.map.dnd5ePluginAreas,
      prepared.candidate,
      result.state.round,
      appliedDamage,
      triggerEvent?.type === 'persistent-area-triggered' ? triggerEvent.saveSuccess : undefined,
      triggerEvent?.type === 'persistent-area-triggered' ? triggerEvent.declined : undefined,
    ),
  }
  if(restraint)map.dnd5ePluginAreas=[...(map.dnd5ePluginAreas??[]),restraint]
  syncDnd5eSubmergedBreathingClock(result.state)
  return {
    result: { ...result, events },
    application: planDnd5eMapResultApplication({
      state: result.state,
      map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
      events,
    }),
  }
}

/** Host UI boundary: resolve bounded random requests and reuse their values for the same transaction. */
export function createDnd5ePersistentAreaCapacityCoordinator(
  roll: (request: { sides: number; candidateIds: readonly string[]; prepared: PreparedDnd5ePersistentAreaTrigger }) => Promise<number>,
) {
  const rolls = new Map<string, Promise<number>>()
  return async (input: Parameters<typeof resolvePreparedDnd5ePersistentAreaTrigger>[0]) => {
    const capacityRandomResults: number[] = []
    for (let count = 0; count <= 64; count++) {
      const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ ...input, capacityRandomResults })
      if (!resolved.capacitySelection) return { ...resolved, capacityRandomResults: [...capacityRandomResults] }
      const request = resolved.capacitySelection
      const key = JSON.stringify([input.prepared.candidate.transactionId, capacityRandomResults, request.candidateIds])
      let pending = rolls.get(key)
      if (!pending) {
        pending = Promise.resolve().then(() => roll({ ...request, prepared: input.prepared }))
        rolls.set(key, pending)
      }
      capacityRandomResults.push(await pending)
    }
    return { result: { ok: false as const, state: input.prepared.state, events: [], reason: 'invalid-dice' as const }, capacityRandomResults: [...capacityRandomResults] }
  }
}
import { dnd5ePersistentAreaObserverSeesAnchor } from './persistentAreaObserverVision'
