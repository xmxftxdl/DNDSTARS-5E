import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { resolveDnd5eRollMode } from './rollMode'
import {
  dnd5eCombatantHasConcentrationCheckAdvantage,
  dnd5eCombatantHasConcentrationEffect,
  resolveDnd5ePersistentAreaTrigger,
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
import { normalizeDnd5eActiveEffects } from './activeEffects'

export interface Dnd5ePersistentAreaDamageRollRequest {
  areaId: string
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
  ) => Promise<readonly number[]>,
) {
  const rollsByWave = new Map<string, Promise<readonly number[]>>()
  return (input: Dnd5ePersistentAreaDamageRollRequest): Promise<readonly number[]> => {
    if (input.count === 0) return Promise.resolve([])
    const waveKey = dnd5ePersistentAreaDamageWaveKey(input)
    if (!waveKey) return rollDice(input.count, input.sides, input.label, input.targetName)
    const existing = rollsByWave.get(waveKey)
    if (existing) return existing
    const pending = rollDice(input.count, input.sides, input.label, input.targetName)
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
  if (!waveKey || !anchor.trigger.savingThrow || anchor.trigger.sourceChoosesTargets) return []
  return candidates.filter((candidate) =>
    !!candidate.trigger.savingThrow &&
    !candidate.trigger.sourceChoosesTargets &&
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
    ability: NonNullable<Dnd5ePersistentAreaTriggerCandidate['trigger']['savingThrow']>['ability']
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }
}

export function prepareDnd5ePersistentAreaTrigger(input: {
  combatId: string
  round: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  candidate: Dnd5ePersistentAreaTriggerCandidate
}): { ok: true; prepared: PreparedDnd5ePersistentAreaTrigger } | { ok: false; reason: string } {
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    turnSlotId: input.initiativeOrder.find((entry) => entry.tokenId === input.candidate.targetToken.id)?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const source = snapshot.state.combatants[input.candidate.area.sourceTokenId]
  const target = snapshot.state.combatants[input.candidate.targetToken.id]
  if (!source || !target || target.deathSaves.dead) return { ok: false, reason: 'combatant-missing' }
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
    ? normalizeDnd5eActiveEffects(target.classState.activeEffects).some((effect) =>
        effect.standardCondition === skipSaveCondition &&
        effect.source.actorId === source.id &&
        effect.source.rulesId === input.candidate.area.coreSpellId,
      )
    : false
  const save = input.candidate.trigger.savingThrow && !hasSourceCondition
    ? {
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

export function resolvePreparedDnd5ePersistentAreaTrigger(input: {
  prepared: PreparedDnd5ePersistentAreaTrigger
  d20?: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  blessRoll?: number
  baneRoll?: number
  rerollD20?: number
  rerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  optionalBonusDice?: readonly import('./headlessCombatEngine').Dnd5eOptionalBonusDieUse[]
  damageRolls?: readonly number[]
  spellDamageMaxDieBonus?: Dnd5eSpellDamageMaxDieBonusUse
  dmAdjustment?: Dnd5ePersistentAreaDmAdjustment
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5ePersistentAreaTrigger(prepared.state, {
    areaId: prepared.candidate.area.id,
    areaSourceKind: prepared.candidate.area.sourceKind,
    coreSpellId: prepared.candidate.area.coreSpellId,
    castingClassId: prepared.candidate.area.castingClassId,
    sourceId: prepared.candidate.area.sourceTokenId,
    targetId: prepared.candidate.targetToken.id,
    trigger: prepared.candidate.trigger,
    d20: input.d20,
    d20Second: input.d20Second,
    halflingLuckyD20: input.halflingLuckyD20,
    halflingLuckyD20Second: input.halflingLuckyD20Second,
    blessRoll: input.blessRoll,
    baneRoll: input.baneRoll,
    rerollD20: input.rerollD20,
    rerollD20Second: input.rerollD20Second,
    bardicInspirationRoll: input.bardicInspirationRoll,
    darkOnesOwnLuckRoll: input.darkOnesOwnLuckRoll,
    optionalBonusDice: input.optionalBonusDice,
    damageRolls: input.damageRolls,
    spellDamageMaxDieBonus: input.spellDamageMaxDieBonus,
    dmAdjustment: input.dmAdjustment,
  })
  if (!result.ok) return { result }
  const triggerEvent = result.events.find((event) =>
    event.type === 'persistent-area-triggered' &&
    event.areaId === prepared.candidate.area.id &&
    event.triggerId === prepared.candidate.trigger.id &&
    event.targetId === prepared.candidate.targetToken.id
  )
  const appliedDamage = triggerEvent?.type === 'persistent-area-triggered'
    ? triggerEvent.damage
    : 0
  const map = {
    ...prepared.map,
    dnd5ePluginAreas: recordDnd5ePersistentAreaTrigger(
      prepared.map.dnd5ePluginAreas,
      prepared.candidate,
      result.state.round,
      appliedDamage,
      triggerEvent?.type === 'persistent-area-triggered' ? triggerEvent.saveSuccess : undefined,
    ),
  }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
      events: [...result.events],
    }),
  }
}
