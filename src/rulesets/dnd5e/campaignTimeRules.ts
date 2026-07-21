import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import { campaignDawnsCrossed, canBenefitFromLongRest } from '../../lib/campaignTime'
import { restoreClassResources } from '../../lib/classResources'
import type { Character } from '../../types/character'
import { restoreDnd5eInventoryResources } from './items'
import { dnd5eCharacterClassLevel } from './multiclass'
import { advanceDnd5eDivineInterventionCalendarDays } from './restFeatures'

export interface Dnd5eCampaignTimeReconcileResult {
  character: Character
  changed: boolean
  dawnsApplied: number
  longRestsApplied: number
  longRestsBlocked: number
}

function applyDawn(character: Character, dawns: number): Character {
  if (dawns < 1) return character
  return restoreDnd5eInventoryResources(
    advanceDnd5eDivineInterventionCalendarDays(character, dawns),
    'dawn',
  )
}

export function applyDnd5eLongRestBenefits(character: Character, completionWorldMinute: number): Character {
  const gainsTranquility = dnd5eCharacterClassLevel(character, 'monk') >= 11 &&
    character.dnd5eClassChoices?.classes?.monk?.subclass === 'open-hand'
  const divineInterventionCooldownDays = character.dnd5eCombatState?.divineInterventionCooldownDays
  const exhaustionLevel = character.rulesetId === 'dnd5e-2014-srd-5.1'
    ? Math.max(0, Math.floor(character.exhaustionLevel ?? 0) - 1)
    : character.exhaustionLevel
  const restored = restoreDnd5eInventoryResources(restoreClassResources({
    ...character,
    exhaustionLevel,
    currentHp: character.maxHp,
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
    dnd5eCombatState: gainsTranquility || divineInterventionCooldownDays
      ? {
          ...(gainsTranquility ? { tranquilityActive: true } : {}),
          ...(divineInterventionCooldownDays ? { divineInterventionCooldownDays } : {}),
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
    if (advance.kind === 'long-rest') {
      if (canBenefitFromLongRest(next.dnd5eLastLongRestWorldMinute, advance.toWorldMinute)) {
        next = applyDnd5eLongRestBenefits(next, advance.toWorldMinute)
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
  next = { ...next, dnd5eWorldTimeAppliedMinute: clock.worldMinute }
  return {
    character: next,
    changed: true,
    dawnsApplied,
    longRestsApplied,
    longRestsBlocked,
  }
}
