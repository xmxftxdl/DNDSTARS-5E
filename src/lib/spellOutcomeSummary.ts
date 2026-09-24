import type { Dnd5eCombatEvent } from '../rulesets/dnd5e/headlessCombatEngine'
import { dnd5eConditionLabel } from '../rulesets/dnd5e/conditions'
import { DND5E_DAMAGE_TYPE_LABELS } from '../rulesets/dnd5e/damageTypes'
import { registeredCombatLogName } from '../rulesets/dnd5e/combatLogContext'

/** Describe observed outcomes only; never infer success just from a spell's description. */
export function spellOutcomeSummary(input: {
  spellId: string
  actorId: string
  events: readonly Dnd5eCombatEvent[]
  resolveName: (id: string) => string
  createdAreaCount?: number
  summonedCount?: number
}): string {
  const { events, resolveName } = input
  if (events.some((event) => event.type === 'counterspell-resolved' && event.success && event.casterId === input.actorId)) {
    return '被法术反制，未产生法术效果'
  }
  const lines = new Set<string>()
  const damage = new Map<string, { amount: number; types: Set<string> }>()
  const healing = new Map<string, number>()
  for (const event of events) {
    if (event.type === 'damage-applied') {
      const value = damage.get(event.targetId) ?? { amount: 0, types: new Set<string>() }
      value.amount += event.amount
      for (const type of event.damageTypes ?? []) value.types.add(DND5E_DAMAGE_TYPE_LABELS[type])
      damage.set(event.targetId, value)
    } else if (event.type === 'healing-applied') {
      healing.set(event.targetId, (healing.get(event.targetId) ?? 0) + event.amount)
    }
  }
  for (const [id, value] of damage) lines.add(`${resolveName(id)}受到 ${value.amount} 点${[...value.types].join('、')}伤害`)
  for (const [id, amount] of healing) lines.add(`${resolveName(id)}恢复 ${amount} 点生命值`)
  for (const event of events) {
    if (event.type === 'condition-applied') {
      lines.add(`${resolveName(event.targetId)}陷入${dnd5eConditionLabel(event.condition)}`)
    } else if (event.type === 'active-effect-applied' || event.type === 'active-effect-refreshed') {
      const condition = event.logContext?.effect?.standardCondition
      if (condition && events.some((candidate) => candidate.type === 'condition-applied' && candidate.targetId === event.targetId && candidate.condition === condition)) continue
      const label = event.logContext?.effect?.label ?? registeredCombatLogName(event.definitionId)
      if (label) lines.add(`${resolveName(event.targetId)}${event.type === 'active-effect-refreshed' ? '刷新' : '获得'}${label}效果`)
    } else if (event.type === 'attack-resolved' && !event.hit) {
      lines.add(`对${resolveName(event.targetId)}的攻击未命中`)
    } else if (event.type === 'saving-throw-resolved') {
      lines.add(`${resolveName(event.targetId)}豁免${event.success ? '成功' : '失败'}`)
    } else if (event.type === 'creature-revived') {
      lines.add(`${resolveName(event.targetId)}复活`)
    }
  }
  if ((input.createdAreaCount ?? 0) > 0) {
    lines.add(input.spellId === 'rope-trick'
      ? '魔绳术空间已创建；可点击地图上的绳索，选择进入空间'
      : `地图上已生成 ${input.createdAreaCount} 处法术区域`)
  }
  if ((input.summonedCount ?? 0) > 0) lines.add(`${input.summonedCount} 个召唤单位加入战斗`)
  const outcomes = [...lines]
  if (!outcomes.length) return '施法已完成，具体效果见结算详情'
  return outcomes.slice(0, 5).join('；') + (outcomes.length > 5 ? `；另有 ${outcomes.length - 5} 项结果，见结算详情` : '')
}

/** Historical generic entries carry insufficient facts to reconstruct their effects. */
export function legacyPlayerSpellSummary(text: string): string {
  if (!text.includes('统一 Activity 已结算') && !text.includes('统一 规则 已结算')) return text
  return text.replace('施放插件法术', '施放')
    .replace(/统一 (?:Activity|规则) 已结算/, '施法已完成，具体效果见结算详情')
}
