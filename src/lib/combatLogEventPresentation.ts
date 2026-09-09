import type { Dnd5eCombatEvent } from '../rulesets/dnd5e/headlessCombatEngine'
import { registeredCombatLogName } from '../rulesets/dnd5e/combatLogContext'
import { dnd5eConditionLabel } from '../rulesets/dnd5e/conditions'

const terms: Record<string, string> = {
  'turn-start':'回合开始','turn-end':'回合结束','before-damaged':'受到伤害前','after-hit':'命中后','after-attack-hit':'攻击命中后',
  'after-move-hit':'移动后命中','after-miss':'攻击未命中后','when-hit':'被命中时','target-killed':'目标死亡时','after-dealt-damage':'造成伤害后',
  'after-damaged':'受到伤害后','saving-throw-magic':'魔法豁免时','saving-throw-physical':'物理豁免时','movement':'移动时','phase-transition':'阶段转换时',
  'target-turn-start':'目标回合开始','target-turn-end':'目标回合结束','source-turn-start':'来源回合开始','source-turn-end':'来源回合结束',
  'attack':'攻击','move':'移动','end-turn':'结束回合','start-turn':'开始回合','plugin':'规则动作','cast-spell':'施法','spell':'施法','plugin-spell':'规则施法',
  'careful':'谨慎法术','distant':'远距法术','empowered':'强效法术','extended':'延效法术','heightened':'升阶法术','quickened':'瞬发法术','subtle':'精妙法术','twinned':'孪生法术',
  'aberration':'异怪','beast':'野兽','celestial':'天界生物','construct':'构装生物','dragon':'龙','elemental':'元素生物','fey':'妖精','fiend':'邪魔','giant':'巨人','humanoid':'类人生物','monstrosity':'怪兽','ooze':'泥怪','plant':'植物','undead':'亡灵',
  'invalid-target':'目标不符合条件','invalid-class-feature':'特性使用条件不满足','invalid-dice':'骰据不符合规则','action-unavailable':'动作已用尽','reaction-unavailable':'反应已用尽','class-resource-unavailable':'特性资源不足','invalid-plugin-action':'规则动作不可用',
}
export function combatLogTerm(value: string): string { return terms[value] ?? (/^[a-z][a-z0-9:-]*$/i.test(value) ? `规则项（编号：${value}）` : value) }

/** Resolve only identifier fields, preserving user-authored names and descriptions. */
export function presentCombatLogEvent(event: Dnd5eCombatEvent, lines: string[], name: (id: string) => string): string[] {
  const replacements = new Map<string, string>()
  for (const [field, value] of Object.entries(event)) {
    if (typeof value !== 'string' || !['featureId','abilityId','definitionId','spellId','activityId','actionId','stateKey','weaponId','monsterId','fromStatBlockId','toStatBlockId','childActionId'].includes(field)) continue
    const label = event.logContext?.names?.[value] ?? registeredCombatLogName(value)
    if (label) replacements.set(value, label)
    else if (!value.startsWith('activity:') && /^[a-z][a-z0-9:-]*$/i.test(value)) replacements.set(value, `未命名${field === 'featureId' || field === 'abilityId' ? '特性' : '规则项'}（编号：${value}）`)
  }
  if (event.type === 'activity-resolved') replacements.set(event.sourceId, event.logContext?.names?.[event.sourceId] ?? registeredCombatLogName(event.sourceId) ?? `规则来源（编号：${event.sourceId}）`)
  if ('trigger' in event && typeof event.trigger === 'string' && event.type !== 'ready-declared' && event.type !== 'readied-action-triggered') replacements.set(event.trigger, combatLogTerm(event.trigger))
  if (event.type === 'metamagic-applied') replacements.set(event.kind, combatLogTerm(event.kind))
  if (event.type === 'declarative-subclass-trigger-rejected') replacements.set(event.reason, combatLogTerm(event.reason))
  if (event.type === 'creature-types-sensed') for (const type of event.creatureTypes) replacements.set(type, combatLogTerm(type))
  if (event.type === 'monster-mechanic-trigger-pending') {
    replacements.set(event.snapshot.event, combatLogTerm(event.snapshot.event))
    replacements.set(event.snapshot.mechanicId, registeredCombatLogName(event.snapshot.mechanicId) ?? `待结算特性（编号：${event.snapshot.mechanicId}）`)
  }
  let suffix = ''
  const context = event.logContext
  if (context?.activityTrigger) suffix += `｜触发依据：${context.activityTrigger.activityName} · ${context.activityTrigger.conditions.join('；') || '该分支直接生效'}`
  if (context && ['active-effect-applied','active-effect-refreshed','active-effect-removed','class-state-changed'].includes(event.type)) {
    if (context.sourceActorId) suffix += `｜来源：${name(context.sourceActorId)}${context.sourceName ? ` · ${context.sourceName}` : ''}`
    if (context.actionType) suffix += `｜结算动作：${combatLogTerm(context.actionType)}`
    if (context.precedingOutcomes?.length) suffix += `｜此前结算：${context.precedingOutcomes.join('、')}`
    const duration = context.effect?.duration
    if (duration) suffix += `｜持续：${duration.type === 'permanent' ? '直到被解除' : duration.type === 'rounds' ? `${duration.remainingRounds} 回合` : duration.type === 'until-turn-boundary' ? `至${combatLogTerm(duration.boundary)}` : `维持专注${duration.remainingRounds == null ? '' : `，最多 ${duration.remainingRounds} 回合`}`}`
    if (context.effect?.standardCondition) suffix += `｜状态：${dnd5eConditionLabel(context.effect.standardCondition)}`
  }
  return lines.map(line => {
    // One pass: names containing another id must not be localized a second time.
    const entries = [...replacements].filter(([id,label]) => id !== label).sort((a,b) => b[0].length-a[0].length)
    if (entries.length) {
      const pattern = new RegExp(entries.map(([id]) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
      line = line.replace(pattern, id => replacements.get(id)!)
    }
    return line + suffix
  })
}
