import type {
  CampaignRestRecoveryEntry,
  CampaignRestRecoveryReport,
  SharedCampaignTimeState,
} from '../../lib/campaignTime'
import { campaignDawnsCrossed, canBenefitFromLongRest } from '../../lib/campaignTime'
import { classResourceDefinitions, getClassResource } from '../../lib/classResources'
import type { Character } from '../../types/character'
import { reconcileDnd5eCharacterCampaignTime } from './campaignTimeRules'
import {
  dnd5eSpellSlotRecoveryFeature,
  dnd5eSpellSlotRecoveryLimit,
} from './restFeatures'

export interface Dnd5eRestRecoveryReportInput {
  characters: readonly Character[]
  restKind: 'short-rest' | 'long-rest'
  beneficiaryCharacterIds: readonly string[]
  currentWorldMinute: number
  completionWorldMinute: number
  ignoreLongRestCooldown?: boolean
}

function outcome(before: number, after: number): CampaignRestRecoveryEntry['outcome'] {
  return after > before ? 'restored' : after < before ? 'cleared' : 'unchanged'
}

function appliesOnRest(
  resetOn: 'combat' | 'short-rest' | 'long-rest',
  restKind: Dnd5eRestRecoveryReportInput['restKind'],
): boolean {
  return resetOn === restKind || (restKind === 'long-rest' && (resetOn === 'short-rest' || resetOn === 'combat'))
}

function reportHitDice(
  before: Character,
  after: Character,
  restKind: Dnd5eRestRecoveryReportInput['restKind'],
): CampaignRestRecoveryEntry[] {
  return (before.hitPointDice ?? []).map((pool) => {
    const next = after.hitPointDice?.find((candidate) => candidate.sides === pool.sides) ?? pool
    return {
      category: 'hit-dice',
      label: `d${pool.sides} 生命骰`,
      outcome: restKind === 'short-rest' ? 'available' : outcome(pool.current, next.current),
      before: pool.current,
      after: next.current,
      maximum: pool.max,
      detail: restKind === 'short-rest'
        ? `短休中可消耗，当前剩余 ${pool.current}/${pool.max} 枚`
        : '长休恢复至少一枚、至多总生命骰的一半',
    }
  })
}

function reportFeatureResources(
  before: Character,
  after: Character,
  restKind: Dnd5eRestRecoveryReportInput['restKind'],
): CampaignRestRecoveryEntry[] {
  const definitions = classResourceDefinitions(after)
  return definitions.flatMap((definition) => {
    if (!appliesOnRest(definition.resetOn, restKind)) return []
    const previous = getClassResource(before, definition.key)
    const next = getClassResource(after, definition.key)
    if (!previous || !next) return []
    return [{
      category: 'feature-resource' as const,
      label: definition.label,
      outcome: outcome(previous.current, next.current),
      before: previous.current,
      after: next.current,
      maximum: next.max,
      detail: definition.resetOn === 'short-rest' ? '短休或长休恢复' : definition.resetOn === 'combat' ? '战斗／长休恢复' : '长休恢复',
    }]
  })
}

function reportItemResources(
  before: Character,
  after: Character,
  restKind: Dnd5eRestRecoveryReportInput['restKind'],
): CampaignRestRecoveryEntry[] {
  return (before.dnd5eInventory?.entries ?? []).flatMap((entry) => {
    const nextEntry = after.dnd5eInventory?.entries.find((candidate) => candidate.instanceId === entry.instanceId)
    const resources = Object.values(entry.resources ?? {})
    const results: CampaignRestRecoveryEntry[] = resources.flatMap((resource) => {
      const next = nextEntry?.resources?.[resource.id] ?? resource
      const applies = resource.resetOn === restKind ||
        (restKind === 'long-rest' && resource.resetOn === 'short-rest') ||
        next.current !== resource.current
      if (!applies) return []
      return [{
        category: 'item-resource' as const,
        label: `${entry.item.name} · ${resource.label}`,
        outcome: outcome(resource.current, next.current),
        before: resource.current,
        after: next.current,
        maximum: next.maximum,
        detail: resource.resetOn === 'short-rest'
          ? '短休或长休恢复'
          : resource.resetOn === 'dawn'
            ? '休息期间跨越黎明后恢复'
            : '长休恢复',
      }]
    })
    if (entry.attunementPending && nextEntry?.attuned) {
      results.push({
        category: 'item-resource',
        label: `${entry.item.name} · 同调`,
        outcome: 'restored',
        detail: '短休完成，同调现已生效',
      })
    }
    return results
  })
}

function reportShortRestChoices(character: Character): CampaignRestRecoveryEntry[] {
  const feature = dnd5eSpellSlotRecoveryFeature(character)
  if (!feature) return []
  const resourceKey = feature === 'arcane-recovery'
    ? 'dnd5e-arcane-recovery'
    : 'dnd5e-natural-recovery'
  const resource = character.classResources?.[resourceKey]
  const hasMissingEligibleSlot = Array.from({ length: 5 }, (_, index) => index + 1).some((level) => {
    const slot = character.classResources?.[`dnd5e-spell-slot-${level}`]
    return slot != null && slot.current < slot.max
  })
  if (!resource || resource.current < 1 || !hasMissingEligibleSlot) return []
  const label = feature === 'arcane-recovery' ? '奥术回想' : '自然恢复'
  return [{
    category: 'feature-resource',
    label,
    outcome: 'available',
    before: resource.current,
    after: resource.current,
    maximum: resource.max,
    detail: `玩家可选择恢复总环级不超过 ${dnd5eSpellSlotRecoveryLimit(character)} 的1至5环法术位`,
  }]
}

function reportLongRestState(before: Character, after: Character): CampaignRestRecoveryEntry[] {
  const entries: CampaignRestRecoveryEntry[] = [{
    category: 'hit-points',
    label: '生命值',
    outcome: outcome(before.currentHp, after.currentHp),
    before: before.currentHp,
    after: after.currentHp,
    maximum: after.maxHp,
  }]
  if (before.maxHp !== after.maxHp) entries.push({
    category: 'hit-points',
    label: '生命值上限',
    outcome: outcome(before.maxHp, after.maxHp),
    before: before.maxHp,
    after: after.maxHp,
    maximum: after.maxHp,
    detail: '恢复可在长休结束时解除的生命值上限削减',
  })
  if ((before.tempHp ?? 0) > 0) entries.push({
    category: 'hit-points',
    label: '临时生命值',
    outcome: 'cleared',
    before: before.tempHp ?? 0,
    after: after.tempHp ?? 0,
    detail: '完成长休后清除',
  })
  if ((before.exhaustionLevel ?? 0) > 0) entries.push({
    category: 'state',
    label: '力竭等级',
    outcome: outcome(before.exhaustionLevel ?? 0, after.exhaustionLevel ?? 0),
    before: before.exhaustionLevel ?? 0,
    after: after.exhaustionLevel ?? 0,
    detail: '完成长休降低 1 级',
  })
  if (before.concentrating) entries.push({
    category: 'state',
    label: '法术专注',
    outcome: 'cleared',
    detail: '长休结束时停止专注',
  })
  if ((before.deathSaveSuccesses ?? 0) > 0 || (before.deathSaveFailures ?? 0) > 0 || before.deathSaveStable) {
    entries.push({
      category: 'state',
      label: '死亡豁免记录',
      outcome: 'cleared',
      detail: '成功、失败与伤势稳定记录已重置',
    })
  }
  const previousDivineCooldown = before.dnd5eCombatState?.divineInterventionCooldownDays
  const nextDivineCooldown = after.dnd5eCombatState?.divineInterventionCooldownDays
  if (previousDivineCooldown != null && nextDivineCooldown != null && previousDivineCooldown !== nextDivineCooldown) {
    entries.push({
      category: 'feature-resource',
      label: '神迹冷却',
      outcome: 'cleared',
      before: previousDivineCooldown,
      after: nextDivineCooldown,
      detail: '休息期间跨越战役日历边界',
    })
  }
  if (!before.dnd5eCombatState?.tranquilityActive && after.dnd5eCombatState?.tranquilityActive) {
    entries.push({
      category: 'feature-resource',
      label: '空灵体',
      outcome: 'restored',
      detail: '长休结束后重新生效',
    })
  }
  return entries
}

export function buildDnd5eRestRecoveryReports(
  input: Dnd5eRestRecoveryReportInput,
): CampaignRestRecoveryReport[] {
  const beneficiaries = new Set(input.beneficiaryCharacterIds)
  return input.characters.flatMap((character) => {
    if (character.rulesetId !== 'dnd5e-2014-srd-5.1' || !beneficiaries.has(character.id)) return []
    const blocked = input.restKind === 'long-rest' && input.ignoreLongRestCooldown !== true &&
      !canBenefitFromLongRest(character.dnd5eLastLongRestWorldMinute, input.completionWorldMinute)
    if (blocked) return [{
      characterId: character.id,
      characterName: character.name,
      entries: [{
        category: 'state',
        label: '长休收益',
        outcome: 'blocked',
        detail: '距离上次获得长休收益不足 24 小时',
      }],
    }]
    const clock: SharedCampaignTimeState = {
      schemaVersion: 2,
      worldMinute: input.completionWorldMinute,
      displayMode: 'campaign-day',
      displayMinuteOffset: 0,
      timers: [],
      advances: [{
        id: 'rest-recovery-preview',
        kind: input.restKind,
        fromWorldMinute: input.currentWorldMinute,
        toWorldMinute: input.completionWorldMinute,
        minutes: input.completionWorldMinute - input.currentWorldMinute,
        reason: '休息恢复预览',
        dawnsCrossed: campaignDawnsCrossed(input.currentWorldMinute, input.completionWorldMinute),
        expiredTimerIds: [],
        beneficiaryCharacterIds: [character.id],
        ...(input.ignoreLongRestCooldown === true ? { ignoreLongRestCooldown: true } : {}),
        createdAt: 0,
      }],
      updatedAt: 0,
    }
    const after = reconcileDnd5eCharacterCampaignTime({
      ...character,
      dnd5eWorldTimeAppliedMinute: input.currentWorldMinute,
    }, clock).character
    const entries = [
      ...(input.restKind === 'long-rest' ? reportLongRestState(character, after) : []),
      ...(input.restKind === 'short-rest' ? reportShortRestChoices(after) : []),
      ...reportHitDice(character, after, input.restKind),
      ...reportFeatureResources(character, after, input.restKind),
      ...reportItemResources(character, after, input.restKind),
    ]
    return [{
      characterId: character.id,
      characterName: character.name,
      entries: entries.length > 0 ? entries : [{
        category: 'state',
        label: '休息收益',
        outcome: 'unchanged',
        detail: '当前没有需要恢复的资源',
      }],
    }]
  })
}
