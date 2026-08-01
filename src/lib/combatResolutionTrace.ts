import type { AbilityKey } from './dnd'
import type { Dnd5eSavingThrowModeExplanation } from '../rulesets/dnd5e/passiveDefenses'

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力',
}

function rollModeLabel(mode: 'normal' | 'advantage' | 'disadvantage'): string {
  return mode === 'advantage' ? '优势（2d20 取高）' : mode === 'disadvantage' ? '劣势（2d20 取低）' : '普通（1d20）'
}

const COVER_LABELS: Record<'none' | 'half' | 'three-quarters' | 'total', string> = {
  none: '无遮蔽',
  half: '半身掩护（AC +2）',
  'three-quarters': '四分之三掩护（AC +5）',
  total: '全掩护',
}

/** Explains the concrete eligibility, dice, and reaction stages of an attack. */
export function formatDnd5eAttackResolutionTrace(input: {
  actorName: string
  targetName: string
  distanceFeet: number
  rangeLabel: string
  actorElevationFeet: number
  targetElevationFeet: number
  cover?: 'none' | 'half' | 'three-quarters' | 'total'
  coverOverriddenByDm?: boolean
  mode: 'normal' | 'advantage' | 'disadvantage'
  d20: number
  d20Second?: number
  modifier: number
  modifierDetails?: readonly string[]
  total: number
  targetArmorClass: number
  hit: boolean
  critical?: boolean
  reactionDetails?: readonly string[]
}): string[] {
  const rolledFaces = input.d20Second == null
    ? `${input.d20}`
    : `${input.d20} / ${input.d20Second}`
  const selected = input.d20Second == null
    ? input.d20
    : input.mode === 'advantage'
      ? Math.max(input.d20, input.d20Second)
      : input.mode === 'disadvantage'
        ? Math.min(input.d20, input.d20Second)
        : input.d20
  const elevationDetail = input.actorElevationFeet === input.targetElevationFeet
    ? `双方海拔均为 ${input.actorElevationFeet} 尺`
    : `${input.actorName}海拔 ${input.actorElevationFeet} 尺；${input.targetName}海拔 ${input.targetElevationFeet} 尺`
  const modifierDetail = input.modifierDetails?.filter(Boolean).join('；')
  return [
    `攻击资格 · Headless 已验证目标与距离；效果线和视线状态已纳入本次结算；距离 ${input.distanceFeet} 尺（${input.rangeLabel}）。`,
    `空间判定 · ${elevationDetail}；${input.cover ? `掩护：${COVER_LABELS[input.cover]}${input.coverOverriddenByDm ? '（DM 覆盖）' : ''}。` : '掩护：已由 Headless 计入目标 AC。'}`,
    `攻击骰 · ${rollModeLabel(input.mode)}；各骰面 ${rolledFaces}；最终采用 ${selected}；调整值 ${input.modifier >= 0 ? '+' : ''}${input.modifier}${modifierDetail ? `（${modifierDetail}）` : ''}。`,
    ...(input.reactionDetails ?? []).filter(Boolean).map((detail) => `反应资格/消耗 · ${detail}`),
    `结果 · ${input.total} vs AC ${input.targetArmorClass}：${input.critical ? '重击' : input.hit ? '命中' : '未命中'}。`,
  ]
}

/** Explains why a forced move does or does not produce falling damage. */
export function formatDnd5eForcedMovementResolutionTrace(input: {
  targetName: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  formatPosition: (position: { x: number; y: number }) => string
  distanceFeet: number
  sourceElevationFeet: number
  sourceGroundElevationFeet: number
  landingGroundElevationFeet: number
  groundedAtSource: boolean
  fallDistanceFeet: number
  fallingDamageRolls?: readonly number[]
  dmAdjudicatedFall?: boolean
}): string[] {
  const fallDamage = (input.fallingDamageRolls ?? []).reduce((total, roll) => total + roll, 0)
  const positionLine = `强制移动 · ${input.targetName}：${input.formatPosition(input.from)} → ${input.formatPosition(input.to)}，推移 ${input.distanceFeet} 尺。`
  const terrainLine = `高程核对 · 起点生物海拔 ${input.sourceElevationFeet} 尺／地面 ${input.sourceGroundElevationFeet} 尺；落点地面 ${input.landingGroundElevationFeet} 尺。`
  if (input.fallDistanceFeet <= 0 && !input.dmAdjudicatedFall) {
    return [
      positionLine,
      terrainLine,
      input.groundedAtSource
        ? '坠落结论 · 未离开高于落点的支撑面，不结算坠落伤害。'
        : '坠落结论 · 起点不在地面支撑上，系统不从地形差自动推定坠落；需要 DM 裁定。',
    ]
  }
  return [
    positionLine,
    terrainLine,
    input.dmAdjudicatedFall && !input.groundedAtSource
      ? `坠落结论 · DM 裁定离开支撑面并坠落 ${input.fallDistanceFeet} 尺。`
      : `坠落结论 · 起点受地面支撑，落点更低，坠落 ${input.fallDistanceFeet} 尺。`,
    `坠落伤害 · ${input.fallingDamageRolls?.length ? `${input.fallingDamageRolls.join(' + ')} = ${fallDamage}` : '0'} 点；落地倒地。`,
  ]
}

/**
 * Converts an authoritative saving-throw decision into a compact audit trail
 * suitable for the shared combat log. The caller supplies dice faces because
 * visuals may resolve asynchronously before Headless receives the action.
 */
export function formatDnd5eSavingThrowResolutionTrace(input: {
  targetName: string
  ability: AbilityKey
  mode: 'normal' | 'advantage' | 'disadvantage'
  baseMode: Dnd5eSavingThrowModeExplanation
  d20: number
  d20Second?: number
  additionalRuleDetails?: readonly string[]
}): string[] {
  const reasons = [
    ...input.baseMode.advantage.map((reason) => `优势 · ${reason.label}：${reason.detail}`),
    ...input.baseMode.disadvantage.map((reason) => `劣势 · ${reason.label}：${reason.detail}`),
    ...(input.additionalRuleDetails ?? []),
  ]
  const baseCancellation = input.baseMode.advantage.length > 0 && input.baseMode.disadvantage.length > 0
  const selected = input.d20Second == null
    ? `${input.d20}`
    : input.mode === 'advantage'
      ? `${input.d20} / ${input.d20Second} → ${Math.max(input.d20, input.d20Second)}`
      : input.mode === 'disadvantage'
        ? `${input.d20} / ${input.d20Second} → ${Math.min(input.d20, input.d20Second)}`
        : `${input.d20} / ${input.d20Second}`
  return [
    `规则依据 · ${input.targetName}的${ABILITY_LABELS[input.ability]}豁免：${reasons.length > 0 ? reasons.join('；') : '没有适用的优势或劣势来源。'}`,
    ...(baseCancellation ? ['抵消关系 · 同时具有优势与劣势，按 5e 规则抵消为普通骰。'] : []),
    `骰子选择 · ${rollModeLabel(input.mode)}；骰面 ${selected}。`,
  ]
}
