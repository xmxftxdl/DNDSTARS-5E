import type { AbilityKey } from './dnd'
import { dnd5eConditionLabel } from '../rulesets/dnd5e/conditions'
import type { Dnd5eCombatEvent } from '../rulesets/dnd5e/headlessCombatEngine'

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力',
}

const TURN_RESOURCE_LABELS: Record<string, string> = {
  action: '动作',
  bonusAction: '附赠动作',
  reaction: '反应',
  objectInteraction: '物品互动',
  movement: '移动力',
}

const CLASS_RESOURCE_LABELS: Record<string, string> = {
  actionSurge: '动作如潮',
  bardicInspiration: '吟游激励',
  channelDivinity: '引导神力',
  divineSense: '神圣感知',
  indomitable: '不屈',
  ki: '气',
  layOnHands: '圣疗池',
  rage: '狂暴',
  secondWind: '回气',
  sorceryPoints: '术法点',
  superiorityDice: '卓越骰',
  wildShape: '荒野变形',
  fighterIndomitable: '不屈',
  'dnd5e-ki': '气',
  'dnd5e-pact-slot': '契约法术位',
}

const CLASS_DAMAGE_LABELS: Record<string, string> = {
  'sneak-attack': '偷袭',
  'colossus-slayer': '巨像屠夫',
  'brutal-critical': '残暴重击',
  'improved-divine-smite': '强化神圣斩击',
  'divine-smite': '神圣斩击',
  huntersMark: '猎人印记',
  'hunters-mark': '猎人印记',
  'divine-strike': '神圣打击',
  lifedrinker: '饮命者',
  'foe-slayer': '屠灭众敌',
}

const REMOVAL_REASON_LABELS: Record<string, string> = {
  expired: '持续时间结束',
  'save-succeeded': '豁免成功',
  'concentration-ended': '专注结束',
  'source-incapacitated': '擒抱者失能',
  'out-of-range': '超出擒抱触及范围',
  'takes-damage': '受到伤害',
  'targeted-by-attack': '成为攻击目标',
  'hit-by-attack': '被攻击命中',
  'makes-attack': '发动攻击',
  'casts-spell': '施放法术',
  moves: '发生移动',
  dm: 'DM 移除',
  healed: '获得治疗',
  death: '目标死亡',
  awakened: '被动作唤醒',
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

function hpChange(before: number, after: number): string {
  return `HP ${before} → ${after}`
}

function resourceLabel(resource: string): string {
  return CLASS_RESOURCE_LABELS[resource] ?? TURN_RESOURCE_LABELS[resource] ?? resource
}

function effectDefinitionLabel(definitionId: string): string {
  return definitionId.startsWith('condition:')
    ? dnd5eConditionLabel(definitionId.slice('condition:'.length))
    : definitionId
}

function eventDetails(event: Dnd5eCombatEvent, resolveName: (id: string) => string): string[] {
  switch (event.type) {
    case 'attack-resolved':
      return [
        `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜命中检定 d20 ${event.d20}，总值 ${event.total} vs AC ${event.armorClass}｜${event.critical ? '重击' : event.hit ? '命中' : '未命中'}`,
      ]
    case 'damage-applied': {
      const tempHp = event.temporaryHpBefore !== event.temporaryHpAfter
        ? `｜临时 HP ${event.temporaryHpBefore} → ${event.temporaryHpAfter}`
        : ''
      return [`${resolveName(event.targetId)}｜受到 ${event.amount} 点伤害｜${hpChange(event.hpBefore, event.hpAfter)}${tempHp}`]
    }
    case 'class-damage-applied':
      return [`${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜${CLASS_DAMAGE_LABELS[event.source] ?? event.source}造成 ${event.amount} 点额外伤害`]
    case 'damage-reduced':
      return [`${resolveName(event.targetId)}｜伤害减免 ${event.amount}（${event.damageBefore} → ${event.damageAfter}）${event.caught ? '｜接住投射物' : ''}`]
    case 'healing-applied':
      return [`${resolveName(event.targetId)}｜恢复 ${event.amount} 点生命值｜${hpChange(event.hpBefore, event.hpAfter)}`]
    case 'temporary-hit-points-gained':
      return [`${resolveName(event.actorId)}｜获得 ${event.amount} 点临时 HP｜当前 ${event.current}`]
    case 'saving-throw-resolved':
      return [
        `${resolveName(event.targetId)}｜${ABILITY_LABELS[event.ability]}豁免 d20 ${event.d20} ${signed(event.modifier)} = ${event.total} vs DC ${event.dc}｜${event.success ? '成功' : '失败'}`,
      ]
    case 'ability-check-resolved':
      return [
        `${resolveName(event.actorId)}｜${ABILITY_LABELS[event.ability]}${event.skill ? `（${event.skill}）` : ''}检定 d20 ${event.d20} ${signed(event.modifier)} = ${event.total}${event.dc === undefined ? '' : ` vs DC ${event.dc}`}｜${event.success === undefined ? event.mode === 'advantage' ? '优势' : event.mode === 'disadvantage' ? '劣势' : '普通' : event.success ? '成功' : '失败'}`,
      ]
    case 'turn-resource-spent':
      return [`${resolveName(event.actorId)}｜消耗${event.amount && event.amount !== 1 ? ` ${event.amount} 点` : ''}${resourceLabel(event.resource)}`]
    case 'class-resource-spent':
      return [`${resolveName(event.actorId)}｜消耗${resourceLabel(event.resourceKey)}｜剩余 ${event.current}/${event.max}`]
    case 'class-resource-restored':
      return [`${resolveName(event.actorId)}｜恢复${resourceLabel(event.resourceKey)}｜当前 ${event.current}/${event.max}`]
    case 'spell-cast':
      return [`${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜施放 ${event.spellId}｜使用 ${event.slotLevel} 环法术位`]
    case 'sleep-resolved':
      return [`${resolveName(event.actorId)}｜睡眠术生命值池 ${event.hitPointPool}｜影响 ${event.affectedTargetIds.length > 0 ? event.affectedTargetIds.map(resolveName).join('、') : '无'}｜剩余 ${event.remainingHitPoints}`]
    case 'sleeping-creature-awakened':
      return [`${resolveName(event.actorId)}｜使用动作唤醒 ${resolveName(event.targetId)}`]
    case 'delayed-spell-damage-triggered':
      return [`${event.sourceId ? resolveName(event.sourceId) : '法术来源'} → ${resolveName(event.targetId)}｜${event.spellId} 的延迟伤害触发｜造成 ${event.amount} 点伤害`]
    case 'condition-applied':
      return [`${resolveName(event.targetId)}｜获得状态：${dnd5eConditionLabel(event.condition)}｜来源：${resolveName(event.actorId)}`]
    case 'condition-ended':
      return [`${resolveName(event.targetId)}｜状态结束：${dnd5eConditionLabel(event.condition)}`]
    case 'active-effect-applied':
      return [`${resolveName(event.targetId)}｜效果生效：${effectDefinitionLabel(event.definitionId)}`]
    case 'active-effect-refreshed':
      return [`${resolveName(event.targetId)}｜效果刷新：${effectDefinitionLabel(event.definitionId)}`]
    case 'active-effect-removed':
      return [`${resolveName(event.targetId)}｜效果结束：${effectDefinitionLabel(event.definitionId)}｜${REMOVAL_REASON_LABELS[event.reason] ?? event.reason}`]
    case 'active-effect-save-required':
      return [`${resolveName(event.targetId)}｜需进行${ABILITY_LABELS[event.ability]}豁免 DC ${event.dc}（${event.timing === 'target-turn-start' ? '回合开始' : event.timing === 'target-turn-end' ? '回合结束' : '受到伤害'}${event.mode === 'advantage' ? '，优势' : event.mode === 'disadvantage' ? '，劣势' : ''}）`]
    case 'active-effect-save-resolved':
      return [`${resolveName(event.targetId)}｜持续效果${ABILITY_LABELS[event.ability]}豁免 ${event.total} vs DC ${event.dc}｜${event.success ? '成功' : '失败'}`]
    case 'concentration-check-required':
      return [`${resolveName(event.targetId)}｜需进行专注豁免 DC ${event.dc}`]
    case 'concentration-resolved':
      return [`${resolveName(event.actorId)}｜专注豁免 d20 ${event.d20}，总值 ${event.total} vs DC ${event.dc}｜${event.success ? '维持专注' : '专注中断'}`]
    case 'death-save-failure':
      return [`${resolveName(event.targetId)}｜死亡豁免失败｜累计 ${event.failures} 次`]
    case 'death-save-resolved':
      return [`${resolveName(event.actorId)}｜死亡豁免 d20 ${event.d20}｜成功 ${event.successes} / 失败 ${event.failures}${event.dead ? '｜死亡' : event.stable ? '｜伤势稳定' : event.currentHp > 0 ? `｜恢复至 ${event.currentHp} HP` : ''}`]
    case 'hit-points-reduced-to-zero':
      return [`${resolveName(event.targetId)}｜生命值降至 0（受伤前 ${event.hpBefore} HP）`]
    case 'instant-death':
      return [`${resolveName(event.targetId)}｜受到大规模伤害并立即死亡（受伤前 ${event.hpBefore} HP）`]
    case 'death-ward-triggered':
      return [`${resolveName(event.targetId)}｜死亡防护触发（${event.trigger === 'damage' ? '伤害' : '即死效果'}）`]
    case 'moved':
      return [`${resolveName(event.actorId)}｜移动 ${event.distance} 尺｜(${event.from.x}, ${event.from.y}) → (${event.to.x}, ${event.to.y})`]
    case 'legendary-resistance-used':
      return [`${resolveName(event.targetId)}｜使用传奇抗性｜剩余 ${event.remainingUses} 次`]
    case 'counterspell-resolved':
      return [`${resolveName(event.actorId)}反制 ${resolveName(event.casterId)} 的 ${event.spellId}｜${event.success ? '反制成功' : '反制失败'}${event.dc === undefined ? '' : `｜检定 ${event.abilityCheckTotal ?? '—'} vs DC ${event.dc}`}`]
    case 'undead-fortitude-resolved':
      return [`${resolveName(event.targetId)}｜亡灵坚韧 ${event.total} vs DC ${event.dc}｜${event.success ? '保留 1 HP' : '失败'}`]
    case 'relentless-rage-resolved':
      return [`${resolveName(event.actorId)}｜不屈狂怒 ${event.total} vs DC ${event.dc}｜${event.success ? '保留 1 HP' : '失败'}`]
    case 'combat-ended':
      return ['战斗状态已结束，回合资源与中断窗口已关闭']
    default:
      return []
  }
}

export interface CombatLogDetailOptions {
  resolveName?: (id: string) => string
  extra?: readonly string[]
  limit?: number
}

/** 将 Headless 事件转成适合玩家阅读的结算明细；摘要仍由调用方保留。 */
export function formatDnd5eCombatLogDetails(
  events: readonly Dnd5eCombatEvent[],
  options: CombatLogDetailOptions = {},
): string[] {
  const resolveName = options.resolveName ?? ((id: string) => id)
  const all = [
    ...(options.extra ?? []).filter((line) => line.trim().length > 0),
    ...events.flatMap((event) => eventDetails(event, resolveName)),
  ]
  const unique = all.filter((line, index) => all.indexOf(line) === index)
  const limit = Math.max(1, options.limit ?? 14)
  if (unique.length <= limit) return unique
  return [...unique.slice(0, limit), `另有 ${unique.length - limit} 项结算事件未展开`]
}
