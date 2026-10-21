import { dnd5eExhaustionState, dnd5eSourcedExhaustionLevel, adjustDnd5eOrdinaryExhaustion } from './sourcedExhaustion'
import {dnd5eTempleCampaignHealingBonus,type TempleCampaignHealingContext} from './templeCampaignHealing'
import {dnd5eNativeMonsterBreathing} from './monsterBreathing'
import { campaignUnappliedEffectMinutes, characterCombatClockKey } from '../../../shared/combat-round-credits.mjs'
import { dnd5eConcentrationDefenseBonus } from './concentrationDefense'
import type { CampaignRestFeatureD20Roll, SharedCampaignTimeState } from '../../lib/campaignTime'
import { dnd5eLinkedEffectLifetimeEnded, type Dnd5eEffectLifetimePeer } from './linkedEffectLifetimes'
import { settleDnd5eEndedSpellMaterialEscrows } from './spellMaterialEscrow'
import { recordDnd5eTimedAwakening } from './awakeningEvents'
import { reconcileDnd5eDreamContactRoster } from './dreamContact'
import { campaignDawnsCrossed, canBenefitFromLongRest } from '../../lib/campaignTime'
import { restoreClassResources } from '../../lib/classResources'
import type { Character } from '../../types/character'
import { planDnd5eExpiredRestCompletions } from './restCompletion'
import { recordDnd5eRestActivityWindow } from './restActivityWindows'
import {
  applyDnd5eShortRestResourceFeatures,
  dnd5eSelfSavingThrowAuraBonus,
} from './classes'
import {
  resolveDnd5eAttunementAfterShortRest,
  expireDnd5eInventoryItemsAtWorldMinute,
  expireDnd5eSourceBoundInventoryRoster,
  normalizeDnd5eInventory,
  restoreDnd5eInventoryResources,
} from './items'
import { dnd5eCharacterClassLevel } from './multiclass'
import { advanceDnd5eDivineInterventionCalendarDays } from './restFeatures'
import {
  appendDnd5eHitPointMaximumReduction,
  advanceDnd5eHitPointMaximumReductionDurations,
  normalizeDnd5eHitPointMaximumReductionLedger,
  recoverDnd5eHitPointMaximumReductions,
  recoverDnd5eHitPointMaximumReductionsForEffect,
} from './hitPointMaximumReductions'
import { dnd5eStoredD20ReplacementFeaturesForCharacter } from './pluginApi'
import {
  dnd5eActiveHitPointMaximumBonus,
  dnd5eActiveEnvironmentalCapabilities,
  dnd5eActiveSavingThrowAdvantages,
  dnd5eActiveSavingThrowBonus,
  dnd5eActiveSavingThrowDisadvantages,
  createDnd5eMechanicalEffect,
  effectiveDnd5eActiveEffects,
  reconcileDnd5eEffectCompletionRequirements,
  projectDnd5eActiveEffectState,
  removeDnd5eActiveEffectsByIds,
  removeDnd5eActiveEffectsForEvent,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import { migrateCharacterToDnd5e } from './character'
import { dnd5eStandardConditionId } from './conditions'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'

function dnd5eSecretChestLossD100(recordId: string, dueWorldMinute: number): number {
  let hash = 2166136261
  const seed = `secret-chest-loss:${recordId}:${dueWorldMinute}`
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  return (Math.abs(hash | 0) % 100) + 1
}

/** Applies every elapsed post-60-day Secret Chest loss check exactly once. */
function reconcileDnd5eSecretChestAuthority(
  character: Character,
  toWorldMinute: number,
): Character {
  const records = character.dnd5eCombatState?.spellAuthorityRecords
  if (!records) return character
  const nextRecords = { ...records }
  let changed = false
  const lostInstanceIds = new Set<string>()
  const lostRecordIds = new Set<string>()
  for (const record of Object.values(records)) {
    if (
      record.kind !== 'linked-planar-object' || record.profile !== 'secret-chest' ||
      record.lossRiskStartsAtWorldMinute == null || record.planarState !== 'ethereal'
    ) continue
    let due = Math.max(
      record.lossRiskStartsAtWorldMinute + 1_440,
      (record.lastLossCheckWorldMinute ?? record.lossRiskStartsAtWorldMinute) + 1_440,
    )
    let lastLossCheckWorldMinute = record.lastLossCheckWorldMinute
    let lost = false
    while (due <= toWorldMinute) {
      const day = Math.max(1, Math.floor((due - record.lossRiskStartsAtWorldMinute) / 1_440))
      lastLossCheckWorldMinute = due
      if (dnd5eSecretChestLossD100(record.id, due) <= Math.min(100, day * 5)) {
        lost = true
        break
      }
      due += 1_440
    }
    if (lost) {
      delete nextRecords[record.id]
      lostInstanceIds.add(record.inventoryInstanceId)
      lostRecordIds.add(record.id)
      changed = true
    } else if (lastLossCheckWorldMinute !== record.lastLossCheckWorldMinute) {
      nextRecords[record.id] = { ...record, lastLossCheckWorldMinute }
      changed = true
    }
  }
  if (!changed) return character
  const inventory = normalizeDnd5eInventory(character)
  const entries = lostRecordIds.size > 0
    ? inventory.entries.filter((entry) =>
        !lostInstanceIds.has(entry.instanceId) &&
        (entry.linkedSpellAuthorityRecordId == null ||
          !lostRecordIds.has(entry.linkedSpellAuthorityRecordId)))
    : inventory.entries
  const activeEffects = lostRecordIds.size > 0
    ? (character.dnd5eCombatState?.activeEffects ?? []).filter((effect) =>
        !effect.definitionId.includes(':secret-chest-controller'))
    : character.dnd5eCombatState?.activeEffects
  return {
    ...character,
    dnd5eInventory: lostRecordIds.size > 0 ? {
      ...inventory, revision: (inventory.revision ?? 0) + 1, entries,
    } : inventory,
    dnd5eCombatState: {
      ...character.dnd5eCombatState,
      spellAuthorityRecords: Object.keys(nextRecords).length ? nextRecords : undefined,
      activeEffects: activeEffects?.length ? activeEffects : undefined,
    },
  }
}

export interface Dnd5eCampaignTimeReconcileResult {
  character: Character
  changed: boolean
  dawnsApplied: number
  longRestsApplied: number
  longRestsBlocked: number
}

function applyDawn(character: Character, dawns: number): Character {
  if (dawns < 1) return character
  let next = advanceDnd5eDivineInterventionCalendarDays(character, dawns)
  for (let dawn = 0; dawn < dawns; dawn += 1) {
    next = restoreDnd5eInventoryResources(next, 'dawn')
  }
  return next
}

export function applyDnd5eShortRestBenefits(character: Character, completionWorldMinute?: number): Character {
  if (dnd5eRestBenefitsPrevented(character)) return character
  return resolveDnd5eAttunementAfterShortRest(applyDnd5eGrantedShortRestBenefits(character, completionWorldMinute))
}

export function dnd5eRestBenefitsPrevented(character: Character): boolean {
  return effectiveDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects)
    .some(effect => effect.modifiers?.preventRestBenefits === true)
}

/** Grants recovery benefits without inventing time spent on a separate attunement activity.
 * Call only after the granting effect's full completion has been established by Host.
 * This function neither advances the campaign clock nor spends Hit Dice automatically.
 */
export function applyDnd5eGrantedShortRestBenefits(character: Character, completionWorldMinute?: number): Character {
  if (dnd5eRestBenefitsPrevented(character)) return character
  const remainingEffects = removeDnd5eActiveEffectsForEvent({
    effects: character.dnd5eCombatState?.activeEffects,
    trigger: 'short-rest-complete',
  }).effects
  const remainingAbilityReductions = character.dnd5eCombatState?.abilityScoreReductionLedger
    ?.filter((entry) => entry.recovery !== 'short-or-long-rest')
  const restored = restoreDnd5eInventoryResources(
    applyDnd5eShortRestResourceFeatures(restoreClassResources({
      ...character,
      dnd5eCombatState: character.dnd5eCombatState ? {
        ...character.dnd5eCombatState,
        relentlessRageDc: undefined,
        relentlessRagePendingDc: undefined,
        abilityScoreReductionLedger: remainingAbilityReductions?.length
          ? remainingAbilityReductions
          : undefined,
        activeEffects: remainingEffects.length > 0 ? remainingEffects : undefined,
      } : undefined,
    }, 'short-rest')),
    'short-rest',
  )
  return completionWorldMinute == null ? restored : recordDnd5eRestActivityWindow(restored, 'short-rest-complete', completionWorldMinute)
}

export interface Dnd5eCampaignTimeReconcileContext {
  /** Authoritative game clock used for Host-stamped phase deadlines. */
  worldSecond?: number
  /** Map-authoritative elevation at the start of this clock interval. */
  airborne?: boolean
  /** Host scene at the start of a stationary time advance. Never supplied by a player action. */
  templeHealing?: TempleCampaignHealingContext
  cannotRegainHitPoints?: boolean
  intrinsicBreathing?: { canBreatheWater?: boolean; doesNotNeedAir?: boolean }
}

function dnd5eBoundedEffectRemainingRounds(
  effect: Dnd5eActiveEffectInstance,
): number | undefined {
  if (effect.duration.type === 'rounds') return effect.duration.remainingRounds
  if (effect.duration.type === 'concentration' && effect.duration.remainingRounds != null) {
    return effect.duration.remainingRounds
  }
  return undefined
}

/**
 * Projects how far an already-airborne token descends during an exploration
 * clock jump. This covers both a currently active controlled descent and the
 * portion of the interval after a flight effect with an after-effect expires.
 */
export function dnd5eCampaignTimeControlledDescentDistanceFeet(
  character: Character,
  elapsedMinutes: number,
): number {
  const elapsedRounds = Math.max(0, Math.floor(elapsedMinutes * 10))
  if (elapsedRounds < 1) return 0
  let maximumDistanceFeet = 0
  for (const effect of effectiveDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects)) {
    const direct = effect.modifiers?.controlledDescent
    if (direct) {
      const remainingRounds = dnd5eBoundedEffectRemainingRounds(effect) ?? elapsedRounds
      maximumDistanceFeet = Math.max(
        maximumDistanceFeet,
        Math.min(elapsedRounds, remainingRounds) * direct.maximumFeetPerRound,
      )
    }
    const restriction = effect.afterEffectEnds
    const remainingRounds = dnd5eBoundedEffectRemainingRounds(effect)
    if (
      !restriction?.controlledDescent ||
      restriction.trigger === 'manual-removal' ||
      remainingRounds == null
    ) continue
    const roundsAfterExpiry = Math.max(0, elapsedRounds - remainingRounds)
    const restrictionRounds = restriction.duration === 'rounds'
      ? restriction.rounds ?? 1
      : 1
    maximumDistanceFeet = Math.max(
      maximumDistanceFeet,
      Math.min(roundsAfterExpiry, restrictionRounds) *
        restriction.controlledDescent.maximumFeetPerRound,
    )
  }
  return maximumDistanceFeet
}

/**
 * Exploration time and combat rounds are two views of the same six-second
 * duration. Advancing the campaign clock therefore ages bounded ActiveEffects
 * by ten rounds per elapsed minute, including bounded concentration effects.
 */
export function advanceDnd5eCampaignTimedActiveEffects(
  character: Character,
  elapsedMinutes: number,
  context: Dnd5eCampaignTimeReconcileContext = {},
): Character {
  let advanced = advanceTimedActiveEffects(character, elapsedMinutes, context)
  const liveEffectIds = new Set((advanced.dnd5eCombatState?.activeEffects ?? []).map(effect => effect.id))
  let reductionLedger = normalizeDnd5eHitPointMaximumReductionLedger(advanced.dnd5eCombatState?.hitPointMaximumReductionLedger)
  const endedOwners = new Set(reductionLedger?.entries.flatMap(entry =>
    entry.recovery === 'effect-removal' && entry.sourceEffectId && !liveEffectIds.has(entry.sourceEffectId)
      ? [entry.sourceEffectId] : []) ?? [])
  for (const effectId of endedOwners) {
    const restored = recoverDnd5eHitPointMaximumReductionsForEffect(reductionLedger, effectId)
    reductionLedger = restored.ledger
    if (restored.maximum != null) advanced = { ...advanced, maxHp: restored.maximum,
      currentHp: Math.min(advanced.currentHp, restored.maximum + dnd5eActiveHitPointMaximumBonus(advanced.dnd5eCombatState?.activeEffects)),
      dnd5eCombatState: { ...advanced.dnd5eCombatState, hitPointMaximumReductionLedger: reductionLedger } }
  }
  const effectiveMaximum = advanced.maxHp + dnd5eActiveHitPointMaximumBonus(advanced.dnd5eCombatState?.activeEffects)
  if (advanced.currentHp > effectiveMaximum) advanced = { ...advanced, currentHp: effectiveMaximum }
  const temporarySource = advanced.dnd5eCombatState?.temporaryHitPointsSource
  if (temporarySource?.effectDefinitionId && !(advanced.dnd5eCombatState?.activeEffects ?? []).some(effect => {
    const prefix = temporarySource.effectDefinitionId!
    return effect.source.actorId === temporarySource.actorId && [effect.definitionId, effect.stackingKey].some(value =>
      value === prefix || value?.startsWith(`${prefix}:`) || value?.includes(`:${prefix}:`))
  })) advanced = { ...advanced, tempHp: 0, dnd5eCombatState: { ...advanced.dnd5eCombatState, temporaryHitPointsSource: undefined } }

  return recordDnd5eTimedAwakening(character, settleDnd5eEndedSpellMaterialEscrows(advanced,
    new Set((advanced.dnd5eCombatState?.activeEffects ?? []).map(effect => effect.id)),
  ).character, elapsedMinutes)
}

function advanceTimedActiveEffects(
  character: Character,
  elapsedMinutes: number,
  context: Dnd5eCampaignTimeReconcileContext = {},
): Character {
  const elapsedRounds = Math.max(0, Math.floor(elapsedMinutes * 10))
  const phaseDeadline = (effect: Dnd5eActiveEffectInstance) =>
    effect.modifiers?.planarPhase?.plane === 'ethereal' && Number.isSafeInteger(effect.explorationExpiresAtWorldSecond) &&
      context.worldSecond != null ? effect.explorationExpiresAtWorldSecond : undefined
  if (elapsedRounds < 1 && !(character.dnd5eCombatState?.activeEffects ?? []).some(effect => {
    const deadline = phaseDeadline(effect)
    return deadline != null && context.worldSecond! >= deadline
  })) return character
  const effects = reconcileDnd5eEffectCompletionRequirements(character.dnd5eCombatState?.activeEffects ?? [])
  const priorConcentrationRounds = character.dnd5eCombatState?.concentrationRoundsRemaining
  const advancedConcentrationRounds = priorConcentrationRounds == null
    ? undefined
    : Math.max(0, priorConcentrationRounds - elapsedRounds)
  const concentrationSummaryExpired = character.concentrating === true &&
    priorConcentrationRounds != null && advancedConcentrationRounds === 0
  const expiredIds: string[] = []
  const completedConcentrationSourceIds = new Set<string>()
  const effectiveEffectIds = new Set(effectiveDnd5eActiveEffects(effects).map((effect) => effect.id))
  const breathing = character.dnd5eCombatState?.submergedBreathing?.collapsed
    ? context.intrinsicBreathing ?? { canBreatheWater:
      dnd5eNativeMonsterBreathing(character.dnd5eCombatState?.wildShapeFormId).canBreatheWater === true ||
      migrateCharacterToDnd5e(character).canBreatheWater === true }
    : undefined
  const breathingCapabilities = breathing ? dnd5eActiveEnvironmentalCapabilities(effects, breathing) : undefined
  const suffocationBlockedRounds = character.dnd5eCombatState?.submergedBreathing?.collapsed &&
    !breathing?.doesNotNeedAir && !breathingCapabilities?.canBreatheWater && !breathingCapabilities?.doesNotNeedAir
    ? Math.max(0,...effects.filter(effect=>effectiveEffectIds.has(effect.id)&&effect.modifiers?.submerged===true)
      .map(effect=>dnd5eBoundedEffectRemainingRounds(effect)??elapsedRounds)) : 0
  const healingBlockedRounds = context.cannotRegainHitPoints || (character.currentHp === 0 && (character.deathSaveFailures ?? 0) >= 3)
    ? elapsedRounds : Math.max(0, ...effects.filter(effect => effectiveEffectIds.has(effect.id) &&
      (effect.modifiers?.preventHealing === true || effect.definitionId === 'srd-5.1:spell:chill-touch:no-healing'))
      .map(effect => dnd5eBoundedEffectRemainingRounds(effect) ?? elapsedRounds), suffocationBlockedRounds)
  let periodicHealing = 0
  let bodyRestored = false
  const advanced = effects.map((effect) => {
    const deadline = phaseDeadline(effect)
    if (deadline != null) {
      if (context.worldSecond! >= deadline) expiredIds.push(effect.id)
      return effect
    }
    if (elapsedRounds < 1) return effect
    // Campaign jumps currently contain no participant-continuity evidence.
    // Do not let an unverified interval shorten a preparation that can later
    // complete at a combat boundary and mint an Activity entitlement.
    if (effect.completionGrant) {
      expiredIds.push(effect.id)
      return effect
    }
    const boundedRemainingRounds = effect.duration.type === 'rounds' ||
      (effect.duration.type === 'concentration' && effect.duration.remainingRounds != null)
      ? effect.duration.remainingRounds ?? elapsedRounds
      : elapsedRounds
    const activeElapsedRounds = effectiveEffectIds.has(effect.id)
      ? Math.min(elapsedRounds, boundedRemainingRounds)
      : 0
    if (effect.periodicHealing && activeElapsedRounds > 0) {
      periodicHealing += effect.periodicHealing.amount * Math.max(0, activeElapsedRounds - healingBlockedRounds)
      if (context.templeHealing && effect.source.kind === 'spell' && effect.periodicHealing.amount > 0) {
        periodicHealing += dnd5eTempleCampaignHealingBonus(context.templeHealing, effect.source.spellLevel ?? 0, activeElapsedRounds, healingBlockedRounds)
      }
    }
    const bodyRoundsRemaining = effect.bodyRestoration?.roundsRemaining
    const nextBodyRoundsRemaining = bodyRoundsRemaining == null
      ? undefined
      : Math.max(0, bodyRoundsRemaining - activeElapsedRounds)
    if (bodyRoundsRemaining != null && bodyRoundsRemaining > 0 && nextBodyRoundsRemaining === 0) {
      bodyRestored = true
    }
    const bodyRestoration = nextBodyRoundsRemaining == null
      ? undefined
      : nextBodyRoundsRemaining === 0
        ? undefined
        : { ...effect.bodyRestoration!, roundsRemaining: nextBodyRoundsRemaining }
    // Exploration advances have elapsed whole rounds; a next-turn boundary
    // cannot keep a one-turn gate alive indefinitely outside initiative.
    if (effect.duration.type === 'until-turn-boundary') {
      expiredIds.push(effect.id)
      return effect
    }
    if (effect.duration.type === 'rounds') {
      const remainingRounds = effect.duration.remainingRounds - elapsedRounds
      if (remainingRounds < 1) expiredIds.push(effect.id)
      return {
        ...effect,
        duration: { ...effect.duration, remainingRounds: Math.max(1, remainingRounds) },
        bodyRestoration,
      }
    }
    if (effect.duration.type === 'concentration' && effect.duration.remainingRounds != null) {
      const remainingRounds = effect.duration.remainingRounds - elapsedRounds
      if (remainingRounds < 1 && effect.persistAfterConcentrationCompletes === true) {
        completedConcentrationSourceIds.add(effect.duration.sourceActorId)
        return {
          ...effect,
          duration: { type: 'permanent' as const },
          persistAfterConcentrationCompletes: undefined,
          bodyRestoration,
        }
      }
      if (remainingRounds < 1) expiredIds.push(effect.id)
      return {
        ...effect,
        duration: { ...effect.duration, remainingRounds: Math.max(1, remainingRounds) },
        bodyRestoration,
      }
    }
    return bodyRoundsRemaining == null ? effect : { ...effect, bodyRestoration }
  })
  const removedExpired = removeDnd5eActiveEffectsByIds({ effects: advanced, ids: expiredIds, allowProtectedLifecycle: true }).effects
  const afterEffects = effects.flatMap((effect) => {
    if (!expiredIds.includes(effect.id)) return []
    const restriction = effect.afterEffectEnds
    if (
      !restriction ||
      restriction.trigger === 'manual-removal' ||
      (restriction.requiresAirborne === true && context.airborne !== true)
    ) return []
    const originalRemainingRounds = dnd5eBoundedEffectRemainingRounds(effect)
    if (originalRemainingRounds == null) return []
    const totalAfterRounds = restriction.duration === 'rounds'
      ? restriction.rounds ?? 1
      : 1
    const elapsedAfterExpiry = Math.max(0, elapsedRounds - originalRemainingRounds)
    const remainingRounds = totalAfterRounds - elapsedAfterExpiry
    if (remainingRounds < 1) return []
    return [createDnd5eMechanicalEffect({
      definitionId: `${effect.definitionId}:after-effect-ends`,
      label: `${effect.label}（结束后）`,
      source: {
        ...effect.source,
        rulesId: `${effect.source.rulesId ?? effect.definitionId}:after-effect-ends`,
      },
      targetId: character.id,
      duration: { type: 'rounds', remainingRounds, tickOn: 'target-turn-end' },
      stackingPolicy: 'refresh-duration',
      stackingKey: `${effect.definitionId}:after-effect-ends:${character.id}`,
      modifiers: {
        preventActions: restriction.preventActions || undefined,
        speedOverrideFeet: restriction.preventMovement ? 0 : undefined,
        controlledDescent: restriction.controlledDescent
          ? { ...restriction.controlledDescent }
          : undefined,
      },
    })]
  })
  const withAfterEffects = [...removedExpired, ...afterEffects]
  const remainingIdSet = new Set(withAfterEffects.map((effect) => effect.id))
  const remaining = withAfterEffects.map(
    (effect) => {
      // A prior interrupted save can already have removed the transition while
      // leaving its id in suspendedBy. Reconcile against all effects that still
      // exist, not only ids that happened to expire in this exact tick.
      const suspendedBy = effect.suspendedBy?.filter((effectId) => remainingIdSet.has(effectId))
      if ((suspendedBy?.length ?? 0) === (effect.suspendedBy?.length ?? 0)) return effect
      return { ...effect, suspendedBy: suspendedBy?.length ? suspendedBy : undefined }
    },
  )
  const restCompletions = planDnd5eExpiredRestCompletions({targetId:character.id,effects,expiredEffectIds:expiredIds})
  const healedCurrentHp = periodicHealing > 0
    ? Math.min(character.maxHp + dnd5eActiveHitPointMaximumBonus(effects), character.currentHp + periodicHealing)
    : character.currentHp
  const recoveredFromZero = character.currentHp === 0 && healedCurrentHp > 0
  const projection = projectDnd5eActiveEffectState([...remaining,...restCompletions.lockouts].filter(effect =>
    !(recoveredFromZero && effect.standardCondition === 'unconscious' && effect.source.rulesId === 'zero-hit-points')))
  const expiredConcentrationSources = new Set(effects.flatMap((effect) =>
    expiredIds.includes(effect.id) && effect.duration.type === 'concentration'
      ? [effect.duration.sourceActorId]
      : [],
  ))
  for (const sourceId of completedConcentrationSourceIds) expiredConcentrationSources.add(sourceId)
  const priorConcentrationSources = character.dnd5eCombatState?.concentrationEffectsBySource ?? {}
  if (concentrationSummaryExpired) {
    for (const [sourceId, spellId] of Object.entries(priorConcentrationSources)) {
      if (spellId === character.dnd5eCombatState?.concentrationSpellId) {
        expiredConcentrationSources.add(sourceId)
      }
    }
  }
  const concentrationEnded = Object.entries(priorConcentrationSources).some(([sourceId, spellId]) =>
    expiredConcentrationSources.has(sourceId) &&
    spellId === character.dnd5eCombatState?.concentrationSpellId,
  ) || concentrationSummaryExpired
  const concentrationEffectsBySource = Object.fromEntries(
    Object.entries(priorConcentrationSources).filter(([sourceId]) =>
      !expiredConcentrationSources.has(sourceId)),
  )
  const result: Character = {
    ...character,
    currentHp: healedCurrentHp,
    ...(recoveredFromZero ? { deathSaveSuccesses: 0, deathSaveFailures: 0, deathSaveStable: false } : {}),
    // `conditions` is the compatibility projection of ActiveEffects. Keeping
    // the expired label here would make the shared-state validator reject the
    // otherwise-correct effect removal.
    conditions: projection.conditions,
    ...(concentrationEnded ? { concentrating: false } : {}),
    dnd5eCombatState: {
      ...character.dnd5eCombatState,
      ...(periodicHealing > 0 && character.dnd5eCombatState?.wildShapeFormId ? { wildShapeCurrentHp: healedCurrentHp } : {}),
      ...(concentrationSummaryExpired &&
        character.dnd5eCombatState?.wildShapePermanentAfterConcentrationCompletes === true
        ? {
            wildShapePermanent: true,
            wildShapePermanentAfterConcentrationCompletes: undefined,
            wildShapeRoundsRemaining: undefined,
            wildShapeSourceActorId: undefined,
          }
        : {}),
      ...(bodyRestored ? { bodyPresent: true, missingBodyParts: undefined } : {}),
      activeEffects: projection.activeEffects,
      concentrationEffectsBySource: Object.keys(concentrationEffectsBySource).length
        ? concentrationEffectsBySource
        : undefined,
      ...(!concentrationEnded && advancedConcentrationRounds != null
        ? { concentrationRoundsRemaining: advancedConcentrationRounds }
        : {}),
      ...(concentrationEnded ? {
        ...(character.dnd5eCombatState?.concentrationSpellId
          ? {
              lastCompletedConcentration: {
                spellId: character.dnd5eCombatState.concentrationSpellId,
                completedWorldMinute: Math.max(
                  0,
                  (character.dnd5eWorldTimeAppliedMinute ?? 0) +
                    Math.ceil((priorConcentrationRounds ?? 0) / 10),
                ),
              },
            }
          : {}),
        concentrationSpellId: undefined,
        concentrationSpellLevel: undefined,
        concentrationTargetIds: undefined,
        concentrationRoundsRemaining: undefined,
        concentrationStartedTurnKey: undefined,
        concentrationTickOn: undefined,
        concentrationLastTickTurnKey: undefined,
        huntersMarkTargetId: undefined,
      } : {}),
    },
  }
  if (!restCompletions.completed.length) return result
  const sourceMinute=character.dnd5eWorldTimeAppliedMinute
  const completionMinute=sourceMinute == null ? undefined : sourceMinute + Math.ceil(Math.max(...restCompletions.completed.map(effect=>effect.duration.type==='rounds'?effect.duration.remainingRounds:0))/10)
  return applyDnd5eGrantedShortRestBenefits(result,completionMinute)
}

/**
 * A long-cast spell is resolved from the pre-cast character snapshot, while the
 * campaign clock is advanced before that snapshot is committed. Mark only the
 * effects created/refreshed by the completed cast so the subsequent campaign-
 * time reconciliation does not age them through time that elapsed before they
 * existed. Pre-existing effects deliberately receive no compensation.
 */
export function compensateDnd5eCompletedLongCastEffects(
  character: Character,
  effectSelectors: readonly string[],
  elapsedCastingMinutes: number,
  completedConcentrationSpellId?: string,
): Character {
  const elapsedRounds = Math.max(0, Math.floor(elapsedCastingMinutes)) * 10
  const concentrationRoundsRemaining = character.dnd5eCombatState?.concentrationRoundsRemaining
  const completedConcentration = !!completedConcentrationSpellId &&
    character.concentrating === true &&
    character.dnd5eCombatState?.concentrationSpellId === completedConcentrationSpellId &&
    concentrationRoundsRemaining != null
  if (elapsedRounds < 1 || (effectSelectors.length === 0 && !completedConcentration)) return character
  const compensatedEffectSelectors = new Set(effectSelectors)
  let compensatedConcentration = completedConcentration
  let changed = completedConcentration
  const activeEffects = (character.dnd5eCombatState?.activeEffects ?? []).map((effect) => {
    if (
      !compensatedEffectSelectors.has(effect.id) &&
      !compensatedEffectSelectors.has(effect.definitionId)
    ) return effect
    if (effect.duration.type === 'rounds') {
      changed = true
      return {
        ...effect,
        duration: {
          ...effect.duration,
          remainingRounds: effect.duration.remainingRounds + elapsedRounds,
        },
        bodyRestoration: effect.bodyRestoration
          ? {
              ...effect.bodyRestoration,
              roundsRemaining: effect.bodyRestoration.roundsRemaining + elapsedRounds,
            }
          : undefined,
      }
    }
    if (effect.duration.type === 'concentration' && effect.duration.remainingRounds != null) {
      changed = true
      compensatedConcentration = true
      return {
        ...effect,
        duration: {
          ...effect.duration,
          remainingRounds: effect.duration.remainingRounds + elapsedRounds,
        },
        bodyRestoration: effect.bodyRestoration
          ? {
              ...effect.bodyRestoration,
              roundsRemaining: effect.bodyRestoration.roundsRemaining + elapsedRounds,
            }
          : undefined,
      }
    }
    return effect
  })
  if (!changed) return character
  return {
    ...character,
    dnd5eCombatState: {
      ...character.dnd5eCombatState,
      activeEffects,
      ...(compensatedConcentration && concentrationRoundsRemaining != null
        ? { concentrationRoundsRemaining: concentrationRoundsRemaining + elapsedRounds }
        : {}),
    },
  }
}

/** Stable fallback used only when replaying a legacy long-rest event without Host dice. */
export function dnd5eLongRestStoredD20(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  return (Math.abs(hash | 0) % 20) + 1
}

export function dnd5eCampaignRepeatSaveD20(
  effectId: string,
  characterId: string,
  dueWorldMinute: number,
  index = 0,
): number {
  return dnd5eLongRestStoredD20(
    `campaign-repeat-save:${effectId}:${characterId}:${dueWorldMinute}:${index}`,
  )
}

export function dnd5eCampaignRepeatSaveReductionRoll(
  effectId: string,
  characterId: string,
  dueWorldMinute: number,
  count: number,
  sides: number,
  bonus: number,
): number {
  let total = Math.floor(bonus)
  for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
    let hash = 2166136261
    const seed = `campaign-repeat-reduction:${effectId}:${characterId}:${dueWorldMinute}:${index}`
    for (let characterIndex = 0; characterIndex < seed.length; characterIndex += 1) {
      hash ^= seed.charCodeAt(characterIndex)
      hash = Math.imul(hash, 16777619)
    }
    hash ^= hash >>> 16
    total += (Math.abs(hash | 0) % Math.max(2, Math.floor(sides))) + 1
  }
  return Math.max(0, total)
}

function dnd5eCampaignRepeatSaveModifier(character: Character, ability: keyof Character['abilities']): number {
  const snapshot = migrateCharacterToDnd5e(character)
  const proficient = snapshot.savingThrowProficiencies.includes(ability)
  return rules.abilityModifier(Math.max(1, snapshot.abilities[ability])) +
    (proficient ? rules.proficiencyBonus(Math.max(1, Math.min(20, snapshot.level))) : 0) +
    (snapshot.savingThrowEquipmentBonus ?? 0) +
    (snapshot.savingThrowPluginBonus ?? 0) +
    dnd5eConcentrationDefenseBonus(snapshot.pluginFeatureIds, snapshot.concentrating ? snapshot.classState.concentrationSpellId : undefined, 'savingThrows') +
    dnd5eSelfSavingThrowAuraBonus({ ...character, abilities: snapshot.abilities }) +
    dnd5eActiveSavingThrowBonus(character.dnd5eCombatState?.activeEffects, ability, {
      proficiencyBonus: rules.proficiencyBonus(snapshot.level), savingThrowProficiencies: snapshot.savingThrowProficiencies,
    }) +
    (character.dnd5eCombatState?.resurrectionPenalty?.value ?? 0)
}

function dnd5eCampaignRepeatSaveRoll(
  character: Character,
  effect: NonNullable<NonNullable<Character['dnd5eCombatState']>['activeEffects']>[number],
  dueWorldMinute: number,
): number {
  const repeat = effect.calendarRepeatSave!
  const activeEffects = character.dnd5eCombatState?.activeEffects
  const advantage = dnd5eActiveSavingThrowAdvantages(activeEffects).includes(repeat.ability) ||
    migrateCharacterToDnd5e(character).racialSavingThrowAdvantages?.magicAbilities
      ?.includes(repeat.ability) === true
  const disadvantage = dnd5eActiveSavingThrowDisadvantages(activeEffects).includes(repeat.ability)
  const first = dnd5eCampaignRepeatSaveD20(effect.id, character.id, dueWorldMinute, 0)
  if (advantage === disadvantage) return first
  const second = dnd5eCampaignRepeatSaveD20(effect.id, character.id, dueWorldMinute, 1)
  return advantage ? Math.max(first, second) : Math.min(first, second)
}

function reconcileDnd5eCalendarEffects(
  character: Character,
  fromWorldMinute: number,
  toWorldMinute: number,
): { character: Character; changed: boolean } {
  const initialIds = (character.dnd5eCombatState?.activeEffects ?? [])
    .filter((effect) => effect.calendarRepeatSave != null || effect.campaignPeriodicHitPointMaximumReduction != null)
    .map((effect) => effect.id)
  if (initialIds.length === 0) return { character, changed: false }

  let next = character
  let changed = false
  for (const effectId of initialIds) {
    const effect = next.dnd5eCombatState?.activeEffects?.find((candidate) => candidate.id === effectId)
    const repeat = effect?.calendarRepeatSave
    const periodic = effect?.campaignPeriodicHitPointMaximumReduction
    const calendar = repeat ?? periodic
    const intervalMinutes = repeat?.intervalMinutes ?? (periodic ? periodic.intervalHours * 60 : 0)
    if (!effect || !calendar || !Number.isSafeInteger(intervalMinutes) || intervalMinutes < 1) continue
    let dueWorldMinute = calendar.nextWorldMinute ?? fromWorldMinute + intervalMinutes
    let lastResolvedWorldMinute = calendar.lastResolvedWorldMinute
    let removeOnSuccess = false
    while (dueWorldMinute <= toWorldMinute) {
      if (lastResolvedWorldMinute == null || lastResolvedWorldMinute < dueWorldMinute) {
        const successfulSave = repeat != null &&
          dnd5eCampaignRepeatSaveRoll(next, effect, dueWorldMinute) +
          dnd5eCampaignRepeatSaveModifier(next, repeat.ability) >= repeat.dc
        const reduction = repeat?.maximumHitPointReductionOnFailure ?? periodic?.reduction
        lastResolvedWorldMinute = dueWorldMinute
        if (successfulSave) {
          if (repeat?.onSuccess === 'remove') {
            removeOnSuccess = true
            break
          }
        } else if (reduction) {
          const amount = dnd5eCampaignRepeatSaveReductionRoll(
            effect.id,
            next.id,
            dueWorldMinute,
            reduction.count,
            reduction.sides,
            reduction.bonus,
          )
          const ledger = normalizeDnd5eHitPointMaximumReductionLedger(
            next.dnd5eCombatState?.hitPointMaximumReductionLedger,
          )
          const entryId = `campaign:${effect.id}:${dueWorldMinute}`
          if (amount > 0 && !ledger?.entries.some((entry) => entry.id === entryId)) {
            const reduced = appendDnd5eHitPointMaximumReduction({
              ledger,
              currentMaximum: next.maxHp,
              entry: {
                id: entryId,
                amount,
                recovery: 'effect-removal',
                sourceActorId: effect.source.actorId,
                sourceActionId: effect.source.rulesId,
                sourceEffectId: effect.id,
              },
            })
            next = {
              ...next,
              maxHp: reduced.maximum,
              currentHp: Math.min(next.currentHp, reduced.maximum),
              ...(reduced.maximum === 0
                ? { deathSaveSuccesses: 0, deathSaveFailures: 3, deathSaveStable: false }
                : {}),
              dnd5eCombatState: {
                ...next.dnd5eCombatState,
                hitPointMaximumReductionLedger: reduced.ledger,
                ...(reduced.maximum === 0 && periodic?.onMaximumZero === 'destroy-body'
                  ? { bodyPresent: false } : {}),
              },
            }
            changed = true
          }
        }
      }
      dueWorldMinute += intervalMinutes
    }

    const recoveryGroups = new Set((effect.tags ?? [])
      .filter((tag) => tag.startsWith('ability-recovery-group:'))
      .map((tag) => tag.slice('ability-recovery-group:'.length)))
    if (removeOnSuccess) {
      const activeEffectsBeforeRemoval = next.dnd5eCombatState?.activeEffects ?? []
      const directRemovalIds = activeEffectsBeforeRemoval
        .filter((candidate) => candidate.id === effect.id || candidate.tags?.some((tag) =>
          tag.startsWith('ability-recovery-group:') &&
          recoveryGroups.has(tag.slice('ability-recovery-group:'.length))))
        .map((candidate) => candidate.id)
      const activeEffects = removeDnd5eActiveEffectsByIds({
        effects: activeEffectsBeforeRemoval,
        ids: directRemovalIds,
      }).effects
      const abilityScoreReductionLedger = next.dnd5eCombatState?.abilityScoreReductionLedger
        ?.filter((entry) => !entry.recoveryGroupId || !recoveryGroups.has(entry.recoveryGroupId))
      const maximumRecovery = recoverDnd5eHitPointMaximumReductionsForEffect(
        normalizeDnd5eHitPointMaximumReductionLedger(
          next.dnd5eCombatState?.hitPointMaximumReductionLedger,
        ),
        effect.id,
      )
      next = {
        ...next,
        maxHp: maximumRecovery.maximum ?? next.maxHp,
        currentHp: maximumRecovery.maximum == null
          ? next.currentHp
          : Math.min(next.currentHp, maximumRecovery.maximum),
        dnd5eCombatState: {
          ...next.dnd5eCombatState,
          activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
          abilityScoreReductionLedger: abilityScoreReductionLedger?.length
            ? abilityScoreReductionLedger
            : undefined,
          hitPointMaximumReductionLedger: maximumRecovery.ledger,
        },
      }
      changed = true
      continue
    }

    if (
      calendar.nextWorldMinute !== dueWorldMinute ||
      calendar.lastResolvedWorldMinute !== lastResolvedWorldMinute
    ) {
      next = {
        ...next,
        dnd5eCombatState: {
          ...next.dnd5eCombatState,
          activeEffects: next.dnd5eCombatState?.activeEffects?.map((candidate) =>
            candidate.id === effect.id
              ? {
                  ...candidate,
                  ...(repeat ? { calendarRepeatSave: {
                    ...repeat, nextWorldMinute: dueWorldMinute, lastResolvedWorldMinute,
                  } } : { campaignPeriodicHitPointMaximumReduction: {
                    ...periodic!, nextWorldMinute: dueWorldMinute, lastResolvedWorldMinute,
                  } }),
                }
              : candidate),
        },
      }
      changed = true
    }
  }
  return { character: next, changed }
}

export function applyDnd5eLongRestBenefits(
  character: Character,
  completionWorldMinute: number,
  restFeatureD20Rolls: readonly CampaignRestFeatureD20Roll[] = [],
): Character {
  if (dnd5eRestBenefitsPrevented(character)) return character
  // Own-source rest expiry must precede healing: otherwise an effect-owned
  // maximum debit is restored only in the later roster pass, after HP healed.
  const effects = character.dnd5eCombatState?.activeEffects ?? []
  const ownSourceExpiryIds = effects.filter(effect =>
    (effect.source.characterId ?? effect.source.actorId) === character.id &&
    effect.breakOn?.includes('source-long-rest-complete') &&
    effect.source.lastLongRestWorldMinute !== undefined &&
    completionWorldMinute > (effect.source.lastLongRestWorldMinute ?? -1),
  ).map(effect => effect.id)
  const remainingEffects = removeDnd5eActiveEffectsForEvent({
    effects: removeDnd5eActiveEffectsByIds({ effects, ids: ownSourceExpiryIds, allowProtectedLifecycle: true }).effects,
    trigger: 'long-rest-complete',
  }).effects.filter((effect) => !(
    effect.standardCondition === 'unconscious' &&
    effect.source.rulesId === 'zero-hit-points'
  ))
  // Settle ledgers owned by removed effects before choosing the healing cap.
  character = advanceDnd5eCampaignTimedActiveEffects({ ...character,
    dnd5eCombatState: { ...character.dnd5eCombatState, activeEffects: remainingEffects },
  }, 0)
  const recoveredConditions = (character.conditions ?? []).filter((condition) =>
    dnd5eStandardConditionId(condition) !== 'unconscious')
  const gainsTranquility = dnd5eCharacterClassLevel(character, 'monk') >= 11 &&
    character.dnd5eClassChoices?.classes?.monk?.subclass === 'open-hand'
  const divineInterventionCooldownDays = character.dnd5eCombatState?.divineInterventionCooldownDays
  const currentResurrectionPenalty = character.dnd5eCombatState?.resurrectionPenalty
  const recoveredResurrectionPenalty = currentResurrectionPenalty
    ? Math.min(
        0,
        Math.floor(currentResurrectionPenalty.value) +
          Math.max(1, Math.floor(currentResurrectionPenalty.recoveryPerLongRest)),
      )
    : 0
  const resurrectionPenalty = recoveredResurrectionPenalty < 0 && currentResurrectionPenalty
    ? {
        value: recoveredResurrectionPenalty,
        recoveryPerLongRest: Math.max(1, Math.floor(currentResurrectionPenalty.recoveryPerLongRest)),
      }
    : undefined
  const maximumReductionRecovery = recoverDnd5eHitPointMaximumReductions(
    normalizeDnd5eHitPointMaximumReductionLedger(
      character.dnd5eCombatState?.hitPointMaximumReductionLedger,
    ),
    'long-rest',
  )
  const restoredMaximum = maximumReductionRecovery.maximum ?? character.maxHp
  const sourcedExhaustion = character.rulesetId === 'dnd5e-2014-srd-5.1' && character.dnd5eCombatState?.sourcedExhaustion
    ? adjustDnd5eOrdinaryExhaustion(dnd5eExhaustionState(character.dnd5eCombatState.sourcedExhaustion, character.exhaustionLevel), -1)
    : undefined
  const exhaustionLevel = sourcedExhaustion ? dnd5eSourcedExhaustionLevel(sourcedExhaustion)
    : character.rulesetId === 'dnd5e-2014-srd-5.1'
      ? Math.max(0, Math.floor(character.exhaustionLevel ?? 0) - 1)
      : character.exhaustionLevel
  const storedD20ByFeatureId = Object.fromEntries(
    dnd5eStoredD20ReplacementFeaturesForCharacter(character).map(({ feature, count }) => {
      const authoritative = restFeatureD20Rolls.find((entry) =>
        entry.characterId === character.id && entry.featureId === feature.id)
      const values = authoritative?.values.length === count && authoritative.values.every((value) =>
        Number.isInteger(value) && value >= 1 && value <= 20)
        ? [...authoritative.values]
        : Array.from({ length: count }, (_, index) => dnd5eLongRestStoredD20(
            `${character.id}:${feature.id}:${completionWorldMinute}:${index}`,
          ))
      return [feature.id, values]
    }),
  )
  const restored = restoreDnd5eInventoryResources(restoreClassResources({
    ...character,
    exhaustionLevel,
    maxHp: restoredMaximum,
    currentHp: restoredMaximum,
    tempHp: 0,
    conditions: recoveredConditions,
    hitPointDice: character.hitPointDice?.map((pool) => ({
      ...pool,
      current: Math.min(pool.max, pool.current + Math.max(1, Math.floor(pool.max / 2))),
    })),
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    deathSaveStable: false,
    concentrating: false,
    dnd5eLastLongRestWorldMinute: completionWorldMinute,
    dnd5eCombatState:
      sourcedExhaustion ||
      gainsTranquility ||
      divineInterventionCooldownDays ||
      maximumReductionRecovery.ledger ||
      resurrectionPenalty ||
      remainingEffects.length > 0 ||
      Object.keys(storedD20ByFeatureId).length > 0
      ? {
          ...(sourcedExhaustion ? { sourcedExhaustion } : {}),
          ...(gainsTranquility ? { tranquilityActive: true } : {}),
          ...(divineInterventionCooldownDays ? { divineInterventionCooldownDays } : {}),
          ...(maximumReductionRecovery.ledger
            ? {
                hitPointMaximumReductionLedger:
                  maximumReductionRecovery.ledger,
              }
            : {}),
          ...(resurrectionPenalty ? { resurrectionPenalty } : {}),
          ...(remainingEffects.length > 0 ? { activeEffects: remainingEffects } : {}),
          ...(Object.keys(storedD20ByFeatureId).length > 0
            ? { declarativeStoredD20ByFeatureId: storedD20ByFeatureId }
            : {}),
        }
      : undefined,
  }, 'long-rest'), 'long-rest')
  const result = divineInterventionCooldownDays
    ? advanceDnd5eDivineInterventionCalendarDays(restored, 0)
    : restored
  return recordDnd5eRestActivityWindow(result, 'long-rest-complete', completionWorldMinute)
}

/**
 * 将权威时间线幂等地投影到单个角色。首次接入只建立基线，不会把旧战役历史
 * 重新结算到刚创建或刚迁移的角色。
 */
export function reconcileDnd5eCharacterCampaignTime(
  character: Character,
  clock: SharedCampaignTimeState,
  context: Dnd5eCampaignTimeReconcileContext = {},
): Dnd5eCampaignTimeReconcileResult {
  context = { ...context, worldSecond: clock.worldMinute * 60 + (clock.worldSecondRemainder ?? 0) }
  if (character.rulesetId !== 'dnd5e-2014-srd-5.1') {
    return { character, changed: false, dawnsApplied: 0, longRestsApplied: 0, longRestsBlocked: 0 }
  }
  const appliedMinute = character.dnd5eWorldTimeAppliedMinute
  // Character snapshots and the campaign clock are committed atomically for
  // long-cast actions, but an already-running reconciliation can still carry
  // the previous clock value. Never move a valid character baseline backwards:
  // doing so would make the next clock observation age the same effects twice.
  if (Number.isSafeInteger(appliedMinute) && appliedMinute! > clock.worldMinute) {
    return { character, changed: false, dawnsApplied: 0, longRestsApplied: 0, longRestsBlocked: 0 }
  }
  if (!Number.isSafeInteger(appliedMinute) || appliedMinute! < 0) {
    const calendar = reconcileDnd5eCalendarEffects(character, clock.worldMinute, clock.worldMinute)
    // Existing absolute deadlines remain authoritative on first hydration,
    // without aging legacy effects by an unknown amount of campaign history.
    const advanced = advanceDnd5eCampaignTimedActiveEffects(calendar.character, 0, context)
    return {
      character: {
        ...expireDnd5eInventoryItemsAtWorldMinute(advanced, clock.worldMinute),
        dnd5eWorldTimeAppliedMinute: clock.worldMinute,
      },
      changed: true,
      dawnsApplied: 0,
      longRestsApplied: 0,
      longRestsBlocked: 0,
    }
  }
  if (appliedMinute === clock.worldMinute) {
    const calendar = reconcileDnd5eCalendarEffects(character, appliedMinute!, clock.worldMinute)
    const advanced = advanceDnd5eCampaignTimedActiveEffects(calendar.character, 0, context)
    return {
      character: advanced,
      changed: calendar.changed || advanced !== calendar.character,
      dawnsApplied: 0,
      longRestsApplied: 0,
      longRestsBlocked: 0,
    }
  }

  let next = character
  let cursor = appliedMinute!
  let dawnsApplied = 0
  let longRestsApplied = 0
  let longRestsBlocked = 0
  for (const advance of clock.advances) {
    if (advance.toWorldMinute <= cursor || advance.toWorldMinute > clock.worldMinute) continue
    const dawns = campaignDawnsCrossed(cursor, advance.toWorldMinute)
    if (dawns > 0) {
      next = applyDawn(next, dawns)
      dawnsApplied += dawns
    }
    const isRestBeneficiary = advance.beneficiaryCharacterIds == null ||
      advance.beneficiaryCharacterIds.includes(character.id)
    if (advance.kind === 'short-rest' && isRestBeneficiary) {
      next = applyDnd5eShortRestBenefits(next, advance.toWorldMinute)
    }
    if (advance.kind === 'long-rest' && isRestBeneficiary) {
      if (
        !dnd5eRestBenefitsPrevented(next) && (
          advance.ignoreLongRestCooldown === true ||
          canBenefitFromLongRest(next.dnd5eLastLongRestWorldMinute, advance.toWorldMinute))
      ) {
        next = applyDnd5eLongRestBenefits(
          next,
          advance.toWorldMinute,
          advance.restFeatureD20Rolls,
        )
        longRestsApplied += 1
      } else {
        longRestsBlocked += 1
      }
    }
    cursor = advance.toWorldMinute
  }
  if (cursor < clock.worldMinute) {
    const dawns = campaignDawnsCrossed(cursor, clock.worldMinute)
    if (dawns > 0) {
      next = applyDawn(next, dawns)
      dawnsApplied += dawns
    }
  }
  const effectMinutes = campaignUnappliedEffectMinutes(clock, appliedMinute!, characterCombatClockKey(character.id))
  const timedMaximumReduction = advanceDnd5eHitPointMaximumReductionDurations(
    normalizeDnd5eHitPointMaximumReductionLedger(
      next.dnd5eCombatState?.hitPointMaximumReductionLedger,
    ),
    Math.round(effectMinutes * 10),
  )
  if (timedMaximumReduction.maximum != null) {
    next = {
      ...next,
      maxHp: timedMaximumReduction.maximum,
      currentHp: Math.min(next.currentHp, timedMaximumReduction.maximum),
      dnd5eCombatState: {
        ...next.dnd5eCombatState,
        hitPointMaximumReductionLedger: timedMaximumReduction.ledger,
      },
    }
  }
  next = advanceDnd5eCampaignTimedActiveEffects(
    next,
    effectMinutes,
    context,
  )
  const calendar = reconcileDnd5eCalendarEffects(next, appliedMinute!, clock.worldMinute)
  next = reconcileDnd5eSecretChestAuthority(calendar.character, clock.worldMinute)
  next = {
    ...expireDnd5eInventoryItemsAtWorldMinute(next, clock.worldMinute),
    dnd5eWorldTimeAppliedMinute: clock.worldMinute,
  }
  return {
    character: next,
    changed: true,
    dawnsApplied,
    longRestsApplied,
    longRestsBlocked,
  }
}


/** Reconcile source-owned lifetimes across the complete authoritative character roster. */
export function reconcileDnd5eSourceEffectLifecycles(characters: readonly Character[], externalPeers: readonly Dnd5eEffectLifetimePeer[] = []): Character[] {
  let reconciled = characters.map(bearer => {
    const effects = bearer.dnd5eCombatState?.activeEffects ?? []
    const expired = effects.filter(effect => {
      const sourceId = effect.source.characterId ?? effect.source.actorId
      if (!sourceId) return false
      const candidates = characters.filter(character => character.id === sourceId)
      if (candidates.length !== 1) return false
      const source = candidates[0]
      if (effect.breakOn?.includes('source-dies') && source.currentHp <= 0 && (source.deathSaveFailures ?? 0) >= 3) return true
      const marker = effect.source.lastLongRestWorldMinute
      return effect.breakOn?.includes('source-long-rest-complete') === true && marker !== undefined &&
        source.dnd5eLastLongRestWorldMinute != null && source.dnd5eLastLongRestWorldMinute > (marker ?? -1)
    })
    if (!expired.length) return bearer
    const remaining = removeDnd5eActiveEffectsByIds({effects,ids:expired.map(effect => effect.id),allowProtectedLifecycle:true}).effects
    const projection = projectDnd5eActiveEffectState(remaining)
    return advanceDnd5eCampaignTimedActiveEffects({...bearer, conditions:projection.conditions,
      dnd5eCombatState:{...bearer.dnd5eCombatState,activeEffects:projection.activeEffects}},0)
  })
  const limit = reconciled.reduce((sum, bearer) => sum + (bearer.dnd5eCombatState?.activeEffects?.length ?? 0), 0)
  for (let pass = 0; pass <= limit; pass++) {
    const peers = reconciled.map(bearer => ({ actorId: bearer.id, characterId: bearer.id,
      dead: bearer.currentHp <= 0 && (bearer.deathSaveFailures ?? 0) >= 3,
      effects: bearer.dnd5eCombatState?.activeEffects ?? [] }))
    const allPeers = [...peers, ...externalPeers.filter(peer => !peer.characterId || !peers.some(local => local.characterId === peer.characterId))]
    let changed = false
    reconciled = reconciled.map((bearer, index) => {
      const effects = bearer.dnd5eCombatState?.activeEffects ?? []
      const expired = effects.filter(effect => dnd5eLinkedEffectLifetimeEnded(effect, peers[index].dead, allPeers))
      if (!expired.length) return bearer
      changed = true
      const remaining = removeDnd5eActiveEffectsByIds({ effects, ids: expired.map(effect => effect.id), allowProtectedLifecycle: true }).effects
      const projection = projectDnd5eActiveEffectState(remaining)
      return advanceDnd5eCampaignTimedActiveEffects({ ...bearer, conditions: projection.conditions,
        dnd5eCombatState: { ...bearer.dnd5eCombatState, activeEffects: projection.activeEffects } }, 0)
    })
    if (!changed) break
  }
  return reconciled
}

/** The roster pass runs after all individual rests, so iteration order cannot change expiry. */
export function reconcileDnd5eCampaignRosterSourceEffects(results: readonly Dnd5eCampaignTimeReconcileResult[]): Dnd5eCampaignTimeReconcileResult[] {
  const characters = reconcileDnd5eSourceEffectLifecycles(results.map(result => result.character))
  // Collect only after every character's clock/source expiry has settled. A
  // transferred stack still belongs to its original source, not its holder.
  const cleaned = reconcileDnd5eDreamContactRoster(expireDnd5eSourceBoundInventoryRoster(characters))
  return results.map((result,index) => {
    const character = cleaned[index]
    return character === result.character ? result : {...result,character,changed:true}
  })
}
