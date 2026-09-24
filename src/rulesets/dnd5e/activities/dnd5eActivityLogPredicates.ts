import type { Dnd5ePredicateV1 } from './dnd5eEffectContracts'
import { dnd5eConditionLabel } from '../conditions'
const labels: Record<Dnd5ePredicateV1['kind'],string> = {
  'minimum-level':'角色等级','class-level':'职业等级','hp-percentage':'生命值比例','hp-value':'生命值','ability-score':'属性值','condition':'状态','illumination':'光照','airborne-state':'空中状态','target-relation':'敌我关系','target-identity':'目标身份','owned-companion':'所属伙伴','can-hear-source':'能听到来源','active-effect':'已有持续效果','distance':'距离','resource':'资源余量','resource-capacity':'资源恢复空间','once-per-turn':'每回合使用次数','event-source':'触发事件来源','activity-definition':'指定规则动作','weapon-property':'武器属性','attack-proficiency':'攻击熟练','attack-weapon':'指定攻击武器','attack-origin':'攻击动作来源','attack-hands':'握持方式','attack-mode':'攻击方式','attack-result':'命中结果','attack-outcome':'攻击后果','damage-type':'伤害类型','damage-event':'伤害事件','size-rank':'体型','creature-type':'生物类型','movement-distance':'移动距离','movement-property':'移动方式','spell-used':'所用法术','skill-used':'所用技能','action-economy-available':'动作余量','armor-equipped':'穿着护甲','armor-proficiency':'护甲熟练','held-item':'手持物品','free-hands':'空闲手数','spellcasting-capability':'施法能力','choice':'选定选项',
}
const comparisons = {'below':'低于','at-most':'不超过','at-least':'至少','above':'高于'}
export function activityLogPredicate(predicate: Dnd5ePredicateV1): string {
  const subject = 'subject' in predicate ? predicate.subject === 'actor' ? '使用者' : '目标' : ''
  switch (predicate.kind) {
    case 'hp-value': case 'hp-percentage': return `${subject}${labels[predicate.kind]}${comparisons[predicate.comparison]}${typeof predicate.value === 'number' ? predicate.value : '本次规则计算的阈值'}${predicate.kind === 'hp-percentage' ? '%' : ''}`
    case 'condition': return `${subject}${predicate.present ? '具有' : '不具有'}${dnd5eConditionLabel(predicate.condition)}状态`
    case 'minimum-level': return `角色等级至少 ${predicate.level}`
    case 'class-level': return `对应职业等级至少 ${predicate.minimum}`
    case 'free-hands': return `${subject}至少有 ${predicate.minimum} 只空闲手`
    case 'distance': case 'movement-distance': return `${labels[predicate.kind]}${predicate.minimumFeet == null ? '' : `至少 ${predicate.minimumFeet} 尺`}${predicate.maximumFeet == null ? '' : `不超过 ${predicate.maximumFeet} 尺`}`
    case 'target-identity': return predicate.identity === 'self' ? '目标是使用者自身' : '目标是其他生物'
    case 'target-relation': return `目标关系：${{self:'自身',ally:'盟友',enemy:'敌人',any:'任意'}[predicate.relation]}`
    case 'attack-result': return `攻击${{hit:'命中',miss:'未命中','critical-hit':'重击','critical-miss':'大失败'}[predicate.result]}`
    case 'once-per-turn': return '本回合尚未用尽该特性次数'
    default: return `${subject}${labels[predicate.kind]}满足该分支要求`
  }
}
