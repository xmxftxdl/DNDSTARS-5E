import type { CampaignRestFeatureD20Roll, SharedCampaignTimeState } from '../../lib/campaignTime'
import { campaignDawnsCrossed, canBenefitFromLongRest } from '../../lib/campaignTime'
import { restoreClassResources } from '../../lib/classResources'
import type { Character } from '../../types/character'
import { applyDnd5eShortRestResourceFeatures } from './classes'
import {
  resolveDnd5eAttunementAfterShortRest,
  restoreDnd5eInventoryResources,
} from './items'
import { dnd5eCharacterClassLevel } from './multiclass'
import { advanceDnd5eDivineInterventionCalendarDays } from './restFeatures'
import {
  advanceDnd5eHitPointMaximumReductionDurations,
  normalizeDnd5eHitPointMaximumReductionLedger,
  recoverDnd5eHitPointMaximumReductions,
} from './hitPointMaximumReductions'
import { dnd5eStoredD20ReplacementFeaturesForCharacter } from './pluginApi'
import { removeDnd5eActiveEffectsForEvent } from './activeEffects'

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

export function applyDnd5eShortRestBenefits(character: Character): Character {
  const remainingEffects = removeDnd5eActiveEffectsForEvent({
    effects: character.dnd5eCombatState?.activeEffects,
    trigger: 'short-rest-complete',
  }).effects
  return resolveDnd5eAttunementAfterShortRest(restoreDnd5eInventoryResources(
    applyDnd5eShortRestResourceFeatures(restoreClassResources({
      ...character,
      dnd5eCombatState: character.dnd5eCombatState ? {
        ...character.dnd5eCombatState,
        relentlessRageDc: undefined,
        relentlessRagePendingDc: undefined,
        abilityScoreReductionLedger: undefined,
        activeEffects: remainingEffects.length > 0 ? remainingEffects : undefined,
      } : undefined,
    }, 'short-rest')),
    'short-rest',
  ))
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

export function applyDnd5eLongRestBenefits(
  character: Character,
  completionWorldMinute: number,
  restFeatureD20Rolls: readonly CampaignRestFeatureD20Roll[] = [],
): Character {
  const gainsTranquility = dnd5eCharacterClassLevel(character, 'monk') >= 11 &&
    character.dnd5eClassChoices?.classes?.monk?.subclass === 'open-hand'
  const divineInterventionCooldownDays = character.dnd5eCombatState?.divineInterventionCooldownDays
  const maximumReductionRecovery = recoverDnd5eHitPointMaximumReductions(
    normalizeDnd5eHitPointMaximumReductionLedger(
      character.dnd5eCombatState?.hitPointMaximumReductionLedger,
    ),
    'long-rest',
  )
  const restoredMaximum = maximumReductionRecovery.maximum ?? character.maxHp
  const exhaustionLevel = character.rulesetId === 'dnd5e-2014-srd-5.1'
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
      gainsTranquility ||
      divineInterventionCooldownDays ||
      maximumReductionRecovery.ledger ||
      Object.keys(storedD20ByFeatureId).length > 0
      ? {
          ...(gainsTranquility ? { tranquilityActive: true } : {}),
          ...(divineInterventionCooldownDays ? { divineInterventionCooldownDays } : {}),
          ...(maximumReductionRecovery.ledger
            ? {
                hitPointMaximumReductionLedger:
                  maximumReductionRecovery.ledger,
              }
            : {}),
          ...(Object.keys(storedD20ByFeatureId).length > 0
            ? { declarativeStoredD20ByFeatureId: storedD20ByFeatureId }
            : {}),
        }
      : undefined,
  }, 'long-rest'), 'long-rest')
  return divineInterventionCooldownDays
    ? advanceDnd5eDivineInterventionCalendarDays(restored, 0)
    : restored
}

/**
 * 将权威时间线幂等地投影到单个角色。首次接入只建立基线，不会把旧战役历史
 * 重新结算到刚创建或刚迁移的角色。
 */
export function reconcileDnd5eCharacterCampaignTime(
  character: Character,
  clock: SharedCampaignTimeState,
): Dnd5eCampaignTimeReconcileResult {
  if (character.rulesetId !== 'dnd5e-2014-srd-5.1') {
    return { character, changed: false, dawnsApplied: 0, longRestsApplied: 0, longRestsBlocked: 0 }
  }
  const appliedMinute = character.dnd5eWorldTimeAppliedMinute
  if (!Number.isSafeInteger(appliedMinute) || appliedMinute! < 0 || appliedMinute! > clock.worldMinute) {
    return {
      character: { ...character, dnd5eWorldTimeAppliedMinute: clock.worldMinute },
      changed: true,
      dawnsApplied: 0,
      longRestsApplied: 0,
      longRestsBlocked: 0,
    }
  }
  if (appliedMinute === clock.worldMinute) {
    return { character, changed: false, dawnsApplied: 0, longRestsApplied: 0, longRestsBlocked: 0 }
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
      next = applyDnd5eShortRestBenefits(next)
    }
    if (advance.kind === 'long-rest' && isRestBeneficiary) {
      if (
        advance.ignoreLongRestCooldown === true ||
        canBenefitFromLongRest(next.dnd5eLastLongRestWorldMinute, advance.toWorldMinute)
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
  const timedMaximumReduction = advanceDnd5eHitPointMaximumReductionDurations(
    normalizeDnd5eHitPointMaximumReductionLedger(
      next.dnd5eCombatState?.hitPointMaximumReductionLedger,
    ),
    Math.max(0, clock.worldMinute - appliedMinute!) * 10,
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
  next = { ...next, dnd5eWorldTimeAppliedMinute: clock.worldMinute }
  return {
    character: next,
    changed: true,
    dawnsApplied,
    longRestsApplied,
    longRestsBlocked,
  }
}
