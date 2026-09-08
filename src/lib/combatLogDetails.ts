import type { AbilityKey } from './dnd'
import { dnd5eConditionLabel } from '../rulesets/dnd5e/conditions'
import { DND5E_DAMAGE_TYPE_LABELS } from '../rulesets/dnd5e/damageTypes'
import type { Dnd5eCombatEvent } from '../rulesets/dnd5e/headlessCombatEngine'
import { DND5E_SPELL_SCHOOL_LABELS } from '../rulesets/dnd5e/spellbook'
import { DND5E_SRD_SPELL_NAMES_ZH } from '../rulesets/dnd5e/spellNamesZh'
import { getDnd5eSrdCombatSpell } from '../rulesets/dnd5e/spells'

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
  'divine-favor': '神恩',
  'divine-strike': '神圣打击',
  'weapon-damage-rider': '特性附伤',
  lifedrinker: '饮命者',
  'foe-slayer': '屠灭众敌',
}

const CLASS_STATE_LABELS: Record<string, string> = {
  'shield-spell': '护盾术',
  'post-spell-random-table-check': '施法后随机表判定',
  'post-spell-random-table-manual-adjudication': '随机表 DM 裁定',
  dodging: '闪避',
  raging: '狂暴',
  hidden: '隐藏',
  'wild-shape': '荒野变形',
  'hurl-through-hell-ready': '坠入地狱预备',
  'vicious-mockery': '恶言相加',
  'reckless-attack': '鲁莽攻击',
}

const REMOVAL_REASON_LABELS: Record<string, string> = {
  expired: '持续时间结束',
  'save-succeeded': '豁免成功',
  'concentration-ended': '专注结束',
  'source-incapacitated': '擒抱者失能',
  'out-of-range': '超出擒抱触及范围',
  'takes-damage': '受到伤害',
  'targeted-by-spell': '成为法术目标',
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

function classStateLabel(stateKey: string): string {
  return CLASS_STATE_LABELS[stateKey] ?? stateKey
}

type DamageAppliedEvent = Extract<Dnd5eCombatEvent, { type: 'damage-applied' }>
type MagicMissileDamageEvent = Extract<
  Dnd5eCombatEvent,
  { type: 'magic-missile-damage-resolved' }
>
type PersistentAreaTriggeredEvent = Extract<
  Dnd5eCombatEvent,
  { type: 'persistent-area-triggered' }
>

const MAGIC_MISSILE_PROJECTILES_PER_DETAIL = 5
const COMBAT_LOG_ENTITY_NAME_MAX_LENGTH = 120

function compactCombatLogName(name: string): string {
  if (name.length <= COMBAT_LOG_ENTITY_NAME_MAX_LENGTH) return name
  return `${name.slice(0, COMBAT_LOG_ENTITY_NAME_MAX_LENGTH - 1)}…`
}

function magicMissileHpDetails(
  damageEvents: readonly DamageAppliedEvent[],
  resolveName: (id: string) => string,
): string[] {
  const byTarget = new Map<string, {
    hpBefore: number
    hpAfter: number
    temporaryHpBefore: number
    temporaryHpAfter: number
  }>()
  for (const event of damageEvents) {
    const current = byTarget.get(event.targetId)
    if (current) {
      current.hpAfter = event.hpAfter
      current.temporaryHpAfter = event.temporaryHpAfter
    } else {
      byTarget.set(event.targetId, {
        hpBefore: event.hpBefore,
        hpAfter: event.hpAfter,
        temporaryHpBefore: event.temporaryHpBefore,
        temporaryHpAfter: event.temporaryHpAfter,
      })
    }
  }
  const targetDetails = [...byTarget].map(([targetId, hp]) => {
    const temporaryHp = hp.temporaryHpBefore !== hp.temporaryHpAfter
      ? `，临时 HP ${hp.temporaryHpBefore} → ${hp.temporaryHpAfter}`
      : ''
    return `${compactCombatLogName(resolveName(targetId))}：HP ${hp.hpBefore} → ${hp.hpAfter}${temporaryHp}`
  })
  const lines: string[] = []
  for (let index = 0; index < targetDetails.length; index += 4) {
    lines.push(`生命值结算｜${targetDetails.slice(index, index + 4).join('；')}`)
  }
  return lines
}

function magicMissileDetails(
  event: MagicMissileDamageEvent,
  resolveName: (id: string) => string,
  damageEvents: readonly DamageAppliedEvent[],
): string[] {
  const projectileDetails = event.projectiles.map((projectile, index) => {
    const targetName = compactCombatLogName(resolveName(projectile.targetId))
    const rollExpression = [
      `d${event.dieSides}(${projectile.dieRoll})`,
      `${signed(event.baseBonusPerProjectile)}`,
      ...(projectile.featureBonus > 0
        ? [`强化塑能（智力）${signed(projectile.featureBonus)}`]
        : []),
    ].join(' ')
    if (projectile.outcome === 'shielded') {
      return `#${index + 1} → ${targetName}：${rollExpression}，被护盾术免疫`
    }
    if (projectile.outcome === 'limited-magic-immunity') {
      return `#${index + 1} → ${targetName}：${rollExpression}，被有限魔法免疫抵消`
    }
    const reduction = projectile.cuttingWordsReduction > 0
      ? ` - 斩词${projectile.cuttingWordsReduction}`
      : ''
    const defenses = projectile.finalDamage !== projectile.damageBeforeDefenses
      ? ` → 防御调整后 ${projectile.finalDamage}`
      : ''
    return `#${index + 1} → ${targetName}：${rollExpression}${reduction} = ${projectile.damageBeforeDefenses}${defenses}`
  })
  const projectileLines: string[] = []
  for (
    let index = 0;
    index < projectileDetails.length;
    index += MAGIC_MISSILE_PROJECTILES_PER_DETAIL
  ) {
    const end = Math.min(
      projectileDetails.length,
      index + MAGIC_MISSILE_PROJECTILES_PER_DETAIL,
    )
    const range = projectileDetails.length > MAGIC_MISSILE_PROJECTILES_PER_DETAIL
      ? `（#${index + 1}–#${end}）`
      : ''
    projectileLines.push(
      `逐枚结算${range}｜${projectileDetails.slice(index, end).join('；')}`,
    )
  }
  const effectiveProjectiles = event.projectiles.filter(
    (projectile) => projectile.outcome === 'damage',
  ).length
  return [
    `${compactCombatLogName(resolveName(event.actorId))}｜魔法飞弹（${event.slotLevel}环）｜共 ${event.projectiles.length} 枚｜每枚 1d${event.dieSides}${signed(event.baseBonusPerProjectile)} 力场伤害`,
    ...projectileLines,
    `魔法飞弹总伤害｜${event.totalDamage} 点｜实际生效 ${effectiveProjectiles}/${event.projectiles.length} 枚`,
    ...magicMissileHpDetails(damageEvents, resolveName),
  ]
}

function correlateMagicMissileDamageEvents(events: readonly Dnd5eCombatEvent[]): {
  matchedBySummaryIndex: ReadonlyMap<number, readonly DamageAppliedEvent[]>
  suppressedDamageIndexes: ReadonlySet<number>
} {
  const matchedBySummaryIndex = new Map<number, readonly DamageAppliedEvent[]>()
  const suppressedDamageIndexes = new Set<number>()

  events.forEach((event, summaryIndex) => {
    if (event.type !== 'magic-missile-damage-resolved') return
    let castIndex = -1
    for (let index = summaryIndex - 1; index >= 0; index -= 1) {
      const candidate = events[index]
      if (
        candidate.type === 'spell-cast' &&
        candidate.actorId === event.actorId &&
        candidate.spellId === event.spellId
      ) {
        castIndex = index
        break
      }
    }
    if (castIndex < 0) return

    const expectedProjectiles = event.projectiles.filter(
      (projectile) => projectile.outcome === 'damage',
    )
    if (expectedProjectiles.length === 0) return
    const candidateIndexes: number[] = []
    for (let index = castIndex + 1; index < summaryIndex; index += 1) {
      const candidate = events[index]
      if (
        candidate.type === 'damage-applied' &&
        candidate.sourceId === event.actorId &&
        candidate.damageTypes?.includes('force') &&
        !suppressedDamageIndexes.has(index)
      ) candidateIndexes.push(index)
    }
    // Suppress only an exact one-to-one sequence. If another same-source force
    // effect appears in the interval, retaining every generic line is safer.
    if (candidateIndexes.length !== expectedProjectiles.length) return
    const matched: DamageAppliedEvent[] = []
    for (let index = 0; index < expectedProjectiles.length; index += 1) {
      const projectile = expectedProjectiles[index]
      const candidate = events[candidateIndexes[index]]
      if (
        candidate.type !== 'damage-applied' ||
        candidate.targetId !== projectile.targetId ||
        candidate.amount !== projectile.finalDamage
      ) return
      matched.push(candidate)
    }
    for (const index of candidateIndexes) suppressedDamageIndexes.add(index)
    matchedBySummaryIndex.set(summaryIndex, matched)
  })

  return { matchedBySummaryIndex, suppressedDamageIndexes }
}

function spellLabel(spellId: string): string {
  // Keep the existing stable spell identifiers in generic audit entries. The
  // Feather Fall reaction is the exception here because its Chinese name is
  // needed to make the prevention source explicit next to the fall result.
  return spellId === 'feather-fall' ? '羽落术' : spellId
}

function fallingDamageDetails(
  event: Extract<Dnd5eCombatEvent, { type: 'falling-damage-resolved' }>,
  resolveName: (id: string) => string,
  revealDice: boolean,
): string[] {
  if (event.damage === 0 && event.dice > 0) {
    const source = event.prevention?.label
      ?? (event.prevention?.definitionId.includes('feather-fall') ? '羽落术' : undefined)
      ?? '安全坠落效果'
    return [
      `${resolveName(event.actorId)}｜坠落 ${event.distanceFeet} 尺｜${source}保护｜${revealDice ? `原为 ${event.dice}d6，未投掷` : '坠落伤害未投掷'}｜实际 0 点｜安全落地`,
    ]
  }
  if (revealDice && event.rolls?.length === event.dice && event.rolls.length > 0) {
    return [
      `${resolveName(event.actorId)}｜坠落 ${event.distanceFeet} 尺｜${event.dice}d6 骰面：${event.rolls.join(' + ')} = ${event.rolls.reduce((sum, roll) => sum + roll, 0)}｜实际 ${event.damage} 点伤害${event.landedProne ? '｜落地倒地' : ''}`,
    ]
  }
  return [
    `${resolveName(event.actorId)}｜坠落 ${event.distanceFeet} 尺｜${revealDice ? `${event.dice}d6 = ` : '受到 '}${event.damage} 点伤害${event.landedProne ? '｜落地倒地' : ''}`,
  ]
}

const DETECTION_MODE_LABELS: Record<string, string> = {
  magic: '魔法',
  'planar-creatures': '异界生物',
  'poison-disease': '毒素或疾病',
}

const DETECTION_CATEGORY_LABELS: Record<string, string> = {
  magic: '魔法',
  'magic-item': '魔法物品',
  aberration: '异怪',
  celestial: '天界生物',
  elemental: '元素生物',
  fey: '妖精',
  fiend: '邪魔',
  undead: '亡灵',
  poison: '毒素',
  'poisonous-creature': '带毒生物',
  disease: '疾病',
}

function correlatePersistentAreaDamageEvents(
  events: readonly Dnd5eCombatEvent[],
  alreadySuppressed: ReadonlySet<number>,
): {
  matchedBySummaryIndex: ReadonlyMap<number, DamageAppliedEvent>
  suppressedDamageIndexes: ReadonlySet<number>
} {
  const matchedBySummaryIndex = new Map<number, DamageAppliedEvent>()
  const suppressedDamageIndexes = new Set<number>()

  events.forEach((event, summaryIndex) => {
    if (event.type !== 'persistent-area-triggered' || !event.damageResolution) return
    for (let index = summaryIndex - 1; index >= 0; index -= 1) {
      const candidate = events[index]
      if (candidate.type === 'persistent-area-triggered') break
      if (
        candidate.type === 'damage-applied' &&
        candidate.sourceId === event.actorId &&
        candidate.targetId === event.targetId &&
        candidate.amount === event.damageResolution.finalDamage &&
        candidate.damageTypes?.includes(event.damageResolution.damageType) &&
        !alreadySuppressed.has(index) &&
        !suppressedDamageIndexes.has(index)
      ) {
        matchedBySummaryIndex.set(summaryIndex, candidate)
        suppressedDamageIndexes.add(index)
        break
      }
    }
  })

  return { matchedBySummaryIndex, suppressedDamageIndexes }
}

function persistentAreaDamageDetails(
  event: PersistentAreaTriggeredEvent,
  resolveName: (id: string) => string,
  damageEvent?: DamageAppliedEvent,
): string[] {
  const resolution = event.damageResolution
  if (!resolution) return []
  const rollTotal = resolution.roll.rolls.reduce((sum, roll) => sum + roll, 0)
  const dice = `${resolution.roll.rolls.length}d${resolution.roll.sides} 骰面：${resolution.roll.rolls.join(' + ')} = ${rollTotal}`
  const bonusDice = resolution.roll.bonusDice
    ? `｜额外骰 ${resolution.roll.bonusDice.rolls.length}d${resolution.roll.bonusDice.sides}：${resolution.roll.bonusDice.rolls.join(' + ')} = ${resolution.roll.bonusDice.rolls.reduce((sum, roll) => sum + roll, 0)}`
    : ''
  const saveAdjustment = resolution.damageAfterSavingThrow !== resolution.damageBeforeSavingThrow
    ? `｜豁免调整 ${resolution.damageBeforeSavingThrow} → ${resolution.damageAfterSavingThrow}`
    : ''
  const defenseKinds = [...new Set(resolution.defenses.map((defense) =>
    defense.kind === 'immune'
      ? '免疫'
      : defense.kind === 'resistant'
        ? '抗性'
        : '易伤',
  ))].join('、')
  const defenseAdjustment = resolution.damageAfterDefenses !== resolution.damageAfterSavingThrow
    ? `｜${defenseKinds || '防御'}调整 ${resolution.damageAfterSavingThrow} → ${resolution.damageAfterDefenses}`
    : ''
  const dmAdjustment = resolution.damageAfterDmAdjustment !== resolution.damageAfterDefenses
    ? `｜DM 调整 ${resolution.damageAfterDefenses} → ${resolution.damageAfterDmAdjustment}`
    : ''
  const mitigationAdjustment = resolution.finalDamage !== resolution.damageAfterDmAdjustment
    ? `｜减伤/中断调整 ${resolution.damageAfterDmAdjustment} → ${resolution.finalDamage}`
    : ''
  const hp = damageEvent
    ? `｜${hpChange(damageEvent.hpBefore, damageEvent.hpAfter)}${
      damageEvent.temporaryHpBefore !== damageEvent.temporaryHpAfter
        ? `｜临时 HP ${damageEvent.temporaryHpBefore} → ${damageEvent.temporaryHpAfter}`
        : ''
    }`
    : ''
  return [
    `${resolveName(event.targetId)}｜${DND5E_DAMAGE_TYPE_LABELS[resolution.damageType]}伤害明细｜${dice}｜固定加值 ${signed(resolution.roll.modifier)}${bonusDice}｜原始伤害 ${resolution.damageBeforeSavingThrow}${saveAdjustment}${defenseAdjustment}${dmAdjustment}${mitigationAdjustment}｜最终伤害 ${resolution.finalDamage}${hp}`,
  ]
}

function eventDetails(
  event: Dnd5eCombatEvent,
  resolveName: (id: string) => string,
  formatPosition: (position: { x: number; y: number }) => string,
  correlatedDamageEvents: readonly DamageAppliedEvent[] = [],
  correlatedPersistentAreaDamageEvent?: DamageAppliedEvent,
  creatureFormRevertedByDamage = false,
): string[] {
  switch (event.type) {
    case 'attack-resolved':
      return [
        `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜命中检定 d20 ${event.d20}，总值 ${event.total} vs AC ${event.armorClass}｜${event.critical ? '重击' : event.hit ? '命中' : '未命中'}`,
      ]
    case 'attack-decoy-resolved':
      return [
        `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜攻击诱饵重定向 d20 ${event.redirectD20} vs ${event.minimumD20}｜${
          !event.redirected
            ? '攻击仍指向本体'
            : event.decoyHit
              ? `命中诱饵（攻击 ${event.attackTotal} vs AC ${event.decoyArmorClass}），剩余 ${event.remaining}`
              : `攻击转向诱饵但未命中（攻击 ${event.attackTotal} vs AC ${event.decoyArmorClass}），剩余 ${event.remaining}`
        }`,
      ]
    case 'damage-applied': {
      const tempHp = event.temporaryHpBefore !== event.temporaryHpAfter
        ? `｜临时 HP ${event.temporaryHpBefore} → ${event.temporaryHpAfter}`
        : ''
      if (creatureFormRevertedByDamage) {
        const temporaryHpAbsorbed = Math.max(0, event.temporaryHpBefore - event.temporaryHpAfter)
        const formHpBefore = event.creatureFormHpBefore ?? event.hpBefore
        const overflowDamage = event.creatureFormOverflowDamage ??
          Math.max(0, event.amount - temporaryHpAbsorbed - formHpBefore)
        const originalHpBefore = event.creatureFormOriginalHpBefore ?? event.hpAfter + overflowDamage
        return [
          `${resolveName(event.targetId)}｜受到 ${event.amount} 点伤害｜形态 HP ${formHpBefore} → 0，恢复原形｜${overflowDamage} 点溢出伤害，原形 HP ${originalHpBefore} → ${event.hpAfter}${tempHp}`,
        ]
      }
      return [`${resolveName(event.targetId)}｜受到 ${event.amount} 点伤害｜${hpChange(event.hpBefore, event.hpAfter)}${tempHp}`]
    }
    case 'damage-defense-resolved': {
      const damageType = event.damageType
        ? DND5E_DAMAGE_TYPE_LABELS[event.damageType]
        : '未分类'
      const defenseKinds = [...new Set(event.defenses.map((defense) =>
        defense.kind === 'immune'
          ? '免疫'
          : defense.kind === 'resistant'
            ? '抗性'
            : '易伤',
      ))].join('、')
      const source = event.damageSource.delivery === 'weapon-attack'
        ? `${event.damageSource.magical ? '魔法' : '非魔法'}武器攻击${
          event.damageSource.weaponMaterial === 'adamantine'
            ? '（精金）'
            : event.damageSource.weaponMaterial === 'silvered'
              ? '（镀银）'
              : '（普通材质）'
        }`
        : event.damageSource.delivery === 'spell'
          ? '法术伤害'
          : '其他伤害'
      return [
        `${resolveName(event.targetId)}｜${damageType}伤害${defenseKinds}生效｜${event.damageBefore} → ${event.damageAfter}｜来源：${source}`,
      ]
    }
    case 'class-damage-applied':
      return [`${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜${CLASS_DAMAGE_LABELS[event.source] ?? event.source}造成 ${event.amount} 点额外伤害`]
    case 'movement-granted':
      return [`${resolveName(event.actorId)}｜获得 ${event.amount} 尺额外移动力`]
    case 'disengage-granted':
      return [`${resolveName(event.actorId)}｜获得撤离状态`]
    case 'exhaustion-adjusted':
      return [`${resolveName(event.actorId)}｜力竭等级 ${event.before} → ${event.after}（${event.amount >= 0 ? '+' : ''}${event.amount}）`]
    case 'ability-score-restored':
      return [`${resolveName(event.targetId)}｜${event.ability.toUpperCase()} ${event.scoreBefore} → ${event.scoreAfter}（恢复 ${event.amount}）`]
    case 'hit-point-maximum-restored':
      return [`${resolveName(event.targetId)}｜最大 HP ${event.maximumBefore} → ${event.maximumAfter}（恢复 ${event.amount}）`]
    case 'damage-reduced':
      return [`${resolveName(event.targetId)}｜伤害减免 ${event.amount}（${event.damageBefore} → ${event.damageAfter}）${event.caught ? '｜接住投射物' : ''}`]
    case 'inventory-headless-effect-applied': {
      if (event.effectKind !== 'damage-reduction') return []
      const roll = event.dice
        ? `｜减伤骰 ${event.dice.rolls.map((value) => `d${event.dice!.sides}(${value})`).join(' + ')}${event.dice.bonus === 0 ? '' : ` ${signed(event.dice.bonus)}`}`
        : ''
      return [`${resolveName(event.actorId)}｜${event.itemName} 减免 ${event.amount} 点伤害${roll}`]
    }
    case 'healing-applied':
      return [`${resolveName(event.targetId)}｜恢复 ${event.amount} 点生命值｜${hpChange(event.hpBefore, event.hpAfter)}`]
    case 'activity-formula-roll-resolved': {
      const canonicalActivityId = event.activityId.startsWith('spell:')
        ? event.activityId.slice('spell:'.length)
        : event.activityId
      const activityName = DND5E_SRD_SPELL_NAMES_ZH[canonicalActivityId] ?? event.activityId
      const dice = event.dice.map((die) =>
        `${die.count}d${die.sides} [${die.values.join(', ')}]`).join(' + ')
      const adjustment = event.formulaAdjustment === 0 ? '' : ` ${signed(event.formulaAdjustment)}`
      return [
        `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜${activityName}治疗骰 ${dice}${adjustment} = ${event.total}`,
      ]
    }
    case 'temporary-hit-points-gained':
      return [`${resolveName(event.actorId)}｜本次提供 ${event.offered} 点临时 HP｜净增加 ${event.amount}｜当前 ${event.current}`]
    case 'saving-throw-resolved':
      return [
        event.automaticOutcome === 'allied-unresisted-failure'
          ? `${resolveName(event.targetId)}｜同阵营目标未抵抗｜${ABILITY_LABELS[event.ability]}豁免自动视为失败（d20 ${event.d20} ${signed(event.modifier)} = ${event.total} 未参与判定）`
          : event.automaticOutcome === 'condition-immunity-success'
            ? `${resolveName(event.targetId)}｜相应状态免疫｜${ABILITY_LABELS[event.ability]}豁免自动成功（d20 ${event.d20} ${signed(event.modifier)} = ${event.total} 未参与判定）`
            : `${resolveName(event.targetId)}｜${ABILITY_LABELS[event.ability]}豁免 d20 ${event.d20} ${signed(event.modifier)} = ${event.total} vs DC ${event.dc}｜${event.success ? '成功' : '失败'}`,
      ]
    case 'persistent-area-triggered': {
      const timing = {
        'on-create': '首次创建',
        'on-enter': '进入区域',
        'on-move-distance': '区域内移动',
        'on-area-move-impact': '区域移动撞击',
        'turn-start': '回合开始',
        'turn-end': '回合结束',
        'source-turn-start': '来源回合开始',
        'on-detonate': '区域引爆',
      }[event.timing]
      const save = event.saveSuccess == null
        ? ''
        : `｜豁免${event.saveSuccess ? '成功' : '失败'}`
      const damage = event.damage > 0 ? `｜最终伤害 ${event.damage}` : ''
      const condition = event.conditionApplied
        ? `｜施加${dnd5eConditionLabel(event.conditionApplied)}`
        : ''
      const notification = event.notification?.delivery === 'mental-to-source'
        ? '｜向来源发出心灵警报'
        : event.notification?.delivery === 'audible'
          ? `｜发出声音警报（${event.notification.audibleRadiusFeet} 尺内可听）`
          : ''
      return [
        `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜持续区域 ${event.triggerId}（${timing}）${save}${damage}${condition}${notification}`,
        ...persistentAreaDamageDetails(
          event,
          resolveName,
          correlatedPersistentAreaDamageEvent,
        ),
      ]
    }
    case 'spell-damage-feature-bonus-applied': {
      const spellName = getDnd5eSrdCombatSpell(event.spellId)?.name ?? event.spellId
      const application = event.application === 'first-projectile'
        ? '第一枚飞弹的伤害掷骰'
        : '一次法术伤害掷骰'
      return [
        `${resolveName(event.actorId)}｜法师特性「强化塑能」｜${ABILITY_LABELS[event.ability]}调整值 ${signed(event.amount)} 加入${spellName}的${application}`,
      ]
    }
    case 'spell-sculpted': {
      const spellName = getDnd5eSrdCombatSpell(event.spellId)?.name ?? event.spellId
      return [
        `${resolveName(event.targetId)}｜受到${resolveName(event.actorId)}的法师特性「法术塑形」保护｜对${spellName}的豁免自动成功，且不受伤害`,
      ]
    }
    case 'magic-missile-damage-resolved':
      return magicMissileDetails(event, resolveName, correlatedDamageEvents)
    case 'spell-saving-throw-damage-resolved': {
      const spellName = getDnd5eSrdCombatSpell(event.spellId)?.name ?? event.spellId
      const rollDetails = event.components.flatMap((component, index) => {
        if (!component.roll) return []
        const damageType = component.damageType
          ? DND5E_DAMAGE_TYPE_LABELS[component.damageType]
          : event.components.length > 1 ? `第 ${index + 1} 组` : ''
        const formula = `${component.roll.rolls.length}d${component.roll.sides}${component.roll.bonus === 0 ? '' : signed(component.roll.bonus)}`
        const faces = component.roll.rolls.join(' + ')
        const adjustment = component.roll.total === component.damageBeforeSavingThrow
          ? ''
          : `；规则调整后 ${component.damageBeforeSavingThrow}`
        return [`${spellName}${damageType}伤害骰 ${formula}：${faces}${component.roll.bonus === 0 ? '' : ` ${signed(component.roll.bonus)}`} = ${component.roll.total}${adjustment}`]
      })
      const saveResult = event.saveSucceeded
        ? event.successfulSave === 'half'
          ? `豁免成功减半为 ${event.damageAfterSavingThrow}`
          : `豁免成功，伤害降为 ${event.damageAfterSavingThrow}`
        : `豁免失败，伤害为 ${event.damageAfterSavingThrow}`
      const defenses = event.components.flatMap((component) =>
        component.defenses.map((defense) => {
          const damageType = component.damageType
            ? DND5E_DAMAGE_TYPE_LABELS[component.damageType]
            : '伤害'
          return `${damageType}${
            defense.kind === 'immune'
              ? '免疫'
              : defense.kind === 'resistant'
                ? '抗性'
                : '易伤'
          }`
        }),
      )
      const defenseResult = defenses.length > 0
        ? `${resolveName(event.targetId)}${[...new Set(defenses)].join('、')}，最终 ${event.finalDamage}`
        : `最终 ${event.finalDamage}`
      return [
        ...rollDetails,
        `${spellName}伤害 ${event.damageBeforeSavingThrow}；${saveResult}；${defenseResult}`,
      ]
    }
    case 'spell-attack-damage-resolved': {
      const spellName = getDnd5eSrdCombatSpell(event.spellId)?.name ?? event.spellId
      const damageType = event.damageType ? DND5E_DAMAGE_TYPE_LABELS[event.damageType] : ''
      const formula = `${event.roll.rolls.length}d${event.roll.sides}${event.roll.bonus === 0 ? '' : signed(event.roll.bonus)}`
      const faces = event.roll.rolls.join(' + ')
      const attackAdjustment = event.damageAfterAttackAdjustments === event.roll.total
        ? ''
        : `｜攻击与目标调整 ${event.roll.total} → ${event.damageAfterAttackAdjustments}`
      const finalAdjustment = event.finalDamage === event.damageAfterAttackAdjustments
        ? ''
        : `｜最终伤害 ${event.finalDamage}`
      return [
        `${spellName}${damageType}伤害骰 ${formula}：${faces}${event.roll.bonus === 0 ? '' : ` ${signed(event.roll.bonus)}`} = ${event.roll.total}${event.critical ? '｜重击' : ''}${attackAdjustment}${finalAdjustment}`,
      ]
    }
    case 'ability-check-resolved':
      return [
        `${resolveName(event.actorId)}｜${ABILITY_LABELS[event.ability]}${event.skill ? `（${event.skill}）` : ''}检定 d20 ${event.d20} ${signed(event.modifier)} = ${event.total}${event.dc === undefined ? '' : ` vs DC ${event.dc}`}｜${event.success === undefined ? event.mode === 'advantage' ? '优势' : event.mode === 'disadvantage' ? '劣势' : '普通' : event.success ? '成功' : '失败'}`,
      ]
    case 'turn-resource-spent':
      return [`${resolveName(event.actorId)}｜消耗${event.amount && event.amount !== 1 ? ` ${event.amount} 点` : ''}${resourceLabel(event.resource)}`]
    case 'basic-action-adjudication-requested':
      return [`${resolveName(event.actorId)}｜${event.economy === 'bonusAction' ? '附赠动作' : '动作'}声明：${event.description}`]
    case 'audible-event-emitted':
      return [`${resolveName(event.actorId)}｜${event.label}｜可听范围 ${event.audibleRadiusFeet} 尺`]
    case 'class-resource-spent':
      return [`${resolveName(event.actorId)}｜消耗${resourceLabel(event.resourceKey)}｜剩余 ${event.current}/${event.max}`]
    case 'class-resource-restored':
      return [`${resolveName(event.actorId)}｜恢复${resourceLabel(event.resourceKey)}｜当前 ${event.current}/${event.max}`]
    case 'class-state-changed':
      return [`${resolveName(event.actorId)}｜${classStateLabel(event.stateKey)}${event.active ? '生效' : '结束'}${event.value == null ? '' : `｜数值 ${event.value}`}${event.targetId ? `｜目标 ${resolveName(event.targetId)}` : ''}`]
    case 'creature-transformation-unaffected':
      return [
        `${resolveName(event.targetId)}｜形态未改变｜${event.reason === 'shapechanger' ? '目标是变形生物或具有不可变形态' : '目标生命值为 0'}，法术已施放但不产生效果`,
      ]
    case 'spell-cast':
      return [`${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜施放 ${spellLabel(event.spellId)}｜${event.slotLevel === 0
        ? '使用戏法（不消耗法术位）'
        : event.slotConsumed === false
          ? `按 ${event.slotLevel} 环结算，不消耗法术位`
          : `使用 ${event.slotLevel} 环法术位`}`]
    case 'spell-dispelled': {
      const spellName = DND5E_SRD_SPELL_NAMES_ZH[event.spellId]
        ?? getDnd5eSrdCombatSpell(event.spellId)?.name
        ?? event.spellId
      const resolution = event.dc == null
        ? `目标法术 ${event.spellLevel} 环不高于解除魔法所用环位｜自动结束`
        : `施法属性检定 ${event.total ?? '—'} vs DC ${event.dc}｜${event.success ? '成功' : '失败，效果保留'}`
      return [
        `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜解除${spellName}（${event.spellLevel}环）｜${resolution}`,
      ]
    }
    case 'spell-effect-suppressed-by-area':
      return [
        `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜${event.spellId}效果被${event.reason === 'antimagic' ? '反魔法力场' : `法术屏障${event.areaId ? `（${event.areaId}）` : ''}`}压制｜未产生法术效果`,
      ]
    case 'slow-spell-delay-resolved':
      return [
        `${resolveName(event.actorId)}｜缓慢术施法延迟 d20 ${event.d20}｜${event.delayed
          ? `${event.spellId} 暂不生效，须在下回合再用动作完成`
          : `${event.spellId} 立即生效`}`,
      ]
    case 'slow-delayed-spell-completed':
      return [`${resolveName(event.actorId)}｜使用本回合动作完成缓慢术延迟的 ${event.spellId}`]
    case 'slow-delayed-spell-wasted':
      return [`${resolveName(event.actorId)}｜缓慢术延迟的 ${event.spellId} 未能完成，法术浪费｜${event.reason}`]
    case 'spell-detection-updated': {
      const spellName = DND5E_SRD_SPELL_NAMES_ZH[event.spellId]
        ?? getDnd5eSrdCombatSpell(event.spellId)?.name
        ?? event.spellId
      const detectionLabel = DETECTION_MODE_LABELS[event.mode] ?? event.mode
      if (event.presences.length === 0) {
        return [`${resolveName(event.actorId)}｜${spellName}更新｜30 尺内未感知到${detectionLabel}存在`]
      }
      if (event.mode === 'magic' && event.revealAuras !== true) {
        return [`${resolveName(event.actorId)}｜${spellName}更新｜30 尺内感知到魔法存在；需另用一个动作显化可见目标的灵光并辨识学派`]
      }
      const revealedPresences = event.mode === 'magic' && event.revealAuras === true
        ? event.presences.filter((presence) => presence.auraVisible !== false)
        : event.presences
      if (event.mode === 'magic' && event.revealAuras === true && revealedPresences.length === 0) {
        return [`${resolveName(event.actorId)}｜${spellName}更新｜30 尺内感知到魔法存在；当前没有可见的承载魔法目标可显化灵光`]
      }
      return revealedPresences.map((presence) => {
        const categories = presence.categories
          .map((category) => DETECTION_CATEGORY_LABELS[category] ?? category)
          .join('、')
        const schools = presence.spellSchools?.length
          ? `；${presence.spellSchools.map((school) => `${DND5E_SPELL_SCHOOL_LABELS[school]}学派`).join('、')}`
          : ''
        const sources = presence.sourceRulesIds.length > 0
          ? `；来源 ${presence.sourceRulesIds.join('、')}`
          : ''
        const magicItems = presence.magicItemNames?.length
          ? `；魔法物品 ${presence.magicItemNames.join('、')}`
          : ''
        return `${resolveName(event.actorId)}｜${spellName}更新｜${resolveName(presence.targetId)}（${presence.distanceFeet} 尺；${categories}${schools}${magicItems}${sources}）`
      })
    }
    case 'item-last-charge-check':
      return [
        `${resolveName(event.actorId)}｜${event.itemName}最后一发检定 d${event.dieSides} = ${event.roll}｜${event.destroyed ? '物品损毁' : '物品保留'}`,
      ]
    case 'post-spell-random-table-check-required':
      return [
        `${resolveName(event.actorId)}｜施法后随机表待判定｜${event.forceTable ? '直接进入结果表' : `掷 d${event.triggerDieSides}，${event.triggerValues.join('、')} 时触发`}`,
      ]
    case 'post-spell-random-table-check-resolved':
      return [
        `${resolveName(event.actorId)}｜施法后随机表${event.triggered ? '已触发' : '未触发'}${event.triggerRoll == null ? '' : `｜触发骰 ${event.triggerRoll}`}`,
      ]
    case 'post-spell-random-table-outcome-resolved':
      return [
        `${resolveName(event.actorId)}｜随机表结果 ${event.tableRoll}${event.outcomeId ? `（${event.outcomeId}）` : ''}｜${event.automation === 'full' ? event.spellId ? `自动结算 ${event.spellId}` : '自动结算完成' : '交由 DM 手动裁定'}`,
      ]
    case 'post-spell-random-table-manual-adjudication-required':
      return [
        `${resolveName(event.actorId)}｜随机表结果 ${event.tableRoll}${event.outcomeId ? `（${event.outcomeId}）` : ''} 未接入自动结算｜战斗结算已暂停，等待 DM 裁定`,
      ]
    case 'post-spell-random-table-manual-adjudication-resolved':
      return [
        `${resolveName(event.actorId)}｜随机表结果 ${event.tableRoll} 的 DM 裁定已完成｜${event.decision === 'approved' ? `已应用 ${event.effectCount} 项最终效果` : '已跳过该结果'}${event.note ? `｜备注：${event.note}` : ''}`,
      ]
    case 'sleep-resolved':
      return [`${resolveName(event.actorId)}｜睡眠术生命值池 ${event.hitPointPool}｜影响 ${event.affectedTargetIds.length > 0 ? event.affectedTargetIds.map(resolveName).join('、') : '无'}｜剩余 ${event.remainingHitPoints}`]
    case 'color-spray-resolved':
      return [`${resolveName(event.actorId)}｜七彩喷射生命值池 ${event.hitPointPool}｜目盲 ${event.affectedTargetIds.length > 0 ? event.affectedTargetIds.map(resolveName).join('、') : '无'}｜剩余 ${event.remainingHitPoints}`]
    case 'sleeping-creature-awakened':
      return [`${resolveName(event.actorId)}｜使用动作唤醒 ${resolveName(event.targetId)}`]
    case 'delayed-spell-damage-triggered':
      return [`${event.sourceId ? resolveName(event.sourceId) : '法术来源'} → ${resolveName(event.targetId)}｜${event.spellId} 的延迟伤害触发｜造成 ${event.amount} 点伤害`]
    case 'condition-applied':
      return [`${resolveName(event.targetId)}｜获得状态：${dnd5eConditionLabel(event.condition)}｜来源：${resolveName(event.actorId)}`]
    case 'condition-ended':
      return [`${resolveName(event.targetId)}｜状态结束：${dnd5eConditionLabel(event.condition)}`]
    case 'contest-resolved':
      return [`${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜${event.contest === 'grapple' ? '擒抱' : event.contest === 'shove' ? '推撞' : '挣脱擒抱'} ${event.actorTotal} vs ${event.targetTotal}｜${event.success ? '成功' : '失败'}${event.outcome ? `｜${event.outcome === 'prone' ? '击倒' : '推开'}` : ''}`]
    case 'active-effect-applied':
      return [`${resolveName(event.targetId)}｜效果生效：${effectDefinitionLabel(event.definitionId)}`]
    case 'active-effect-refreshed':
      return [`${resolveName(event.targetId)}｜效果刷新：${effectDefinitionLabel(event.definitionId)}`]
    case 'optional-bonus-die-used':
      return [`${resolveName(event.targetId)}｜${event.rollKind === 'saving-throw' ? '豁免' : '属性检定'}奖励骰：${event.label} d${event.dieSides}=${event.roll}｜已消耗`]
    case 'active-effect-removed':
      return [`${resolveName(event.targetId)}｜效果结束：${effectDefinitionLabel(event.definitionId)}｜${REMOVAL_REASON_LABELS[event.reason] ?? event.reason}`]
    case 'active-effect-save-required':
      return [`${resolveName(event.targetId)}｜需进行${ABILITY_LABELS[event.ability]}豁免 DC ${event.dc}（${event.timing === 'target-turn-start' ? '回合开始' : event.timing === 'target-turn-end' ? '回合结束' : '受到伤害'}${event.mode === 'advantage' ? '，优势' : event.mode === 'disadvantage' ? '，劣势' : ''}）`]
    case 'active-effect-save-resolved':
      return [`${resolveName(event.targetId)}｜持续效果${ABILITY_LABELS[event.ability]}豁免 ${event.total} vs DC ${event.dc}｜${event.success ? '成功' : '失败'}`]
    case 'active-effect-random-condition-resolved':
      return [
        `${resolveName(event.targetId)}｜回合结束随机状态 1d${event.dieSides} = ${event.roll} vs 触发下限 ${event.minimum}｜${
          event.triggered ? `触发 ${event.condition}` : '未触发'
        }`,
      ]
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
      return [`${resolveName(event.targetId)}｜立即死亡（死亡前 ${event.hpBefore} HP）`]
    case 'death-ward-triggered':
      return [`${resolveName(event.targetId)}｜死亡防护触发（${event.trigger === 'damage' ? '伤害' : '即死效果'}）`]
    case 'hostile-targeting-prevented':
      return [`${resolveName(event.actorId)}无法指定 ${resolveName(event.targetId)}｜${event.source === 'sanctuary' ? '庇护术' : event.source === 'nature-sanctuary' ? '自然庇护' : '宁静心境'}阻止敌对目标选择`]
    case 'moved':
      return [`${resolveName(event.actorId)}｜移动 ${event.distance} 尺｜${formatPosition(event.from)} → ${formatPosition(event.to)}`]
    case 'teleported':
      return [`${resolveName(event.actorId)}｜${event.spellId}传送 ${event.distanceFeet} 尺｜${formatPosition(event.from)} → ${formatPosition(event.to)}`]
    case 'elevation-changed':
      return [`${resolveName(event.actorId)}｜${event.mode === 'fly' ? '飞行' : event.mode === 'climb' ? '攀爬' : '移动'}高度变化 ${event.fromElevationFeet} 尺 → ${event.toElevationFeet} 尺`]
    case 'falling-damage-resolved':
      return fallingDamageDetails(event, resolveName, true)
    case 'controlled-descent-resolved':
      return [`${resolveName(event.actorId)}｜受控下降 ${event.distanceFeet} 尺｜${event.landed ? '安全落地' : `仍在空中（高度 ${event.toElevationFeet} 尺）`}`]
    case 'legendary-resistance-used':
      return [`${resolveName(event.targetId)}｜使用传奇抗性｜剩余 ${event.remainingUses} 次`]
    case 'counterspell-resolved':
      return [`${resolveName(event.actorId)}反制 ${resolveName(event.casterId)} 的 ${event.spellId}｜${event.success ? '反制成功' : '反制失败'}${event.dc === undefined ? '' : `｜检定 ${event.abilityCheckTotal ?? '—'} vs DC ${event.dc}`}`]
    case 'spell-interception-resolved':
      return [
        `${resolveName(event.actorId)}以 ${event.featureId} 拦截 ${resolveName(event.casterId)} 的 ${event.spellId}｜施法者豁免 ${event.savingThrowTotal} vs DC ${event.dc}｜${event.success ? '豁免成功，法术照常生效' : [
          event.negatedForSelf ? '对拦截者无效' : '未抵消法术',
          event.temporaryAccessGranted ? `临时掌握 ${event.durationRounds} 轮` : '',
          event.sourceCastingProhibited ? `原施法者被封锁 ${event.durationRounds} 轮` : '',
        ].filter(Boolean).join('、')}`,
      ]
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
  /** Projects engine-space coordinates into player-facing coordinates such as map cells. */
  formatPosition?: (position: { x: number; y: number }) => string
  extra?: readonly string[]
  limit?: number
}

/**
 * Player-safe projection for a DM secret roll. It intentionally keeps the
 * authoritative outcome (hit/miss, final damage, HP and conditions) while
 * removing die faces, modifiers and target numbers.
 */
export function formatDnd5eSecretCombatOutcomeDetails(
  events: readonly Dnd5eCombatEvent[],
  options: Omit<CombatLogDetailOptions, 'extra'> = {},
): string[] {
  const resolveName = options.resolveName ?? ((id: string) => id)
  const formatPosition = options.formatPosition ?? ((position) => `(${position.x}, ${position.y})`)
  const lines = events.flatMap((event): string[] => {
    switch (event.type) {
      case 'attack-resolved':
        return [
          `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜攻击结果：${event.critical ? '重击' : event.hit ? '命中' : '未命中'}`,
        ]
      case 'attack-decoy-resolved':
        return [
          `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜${!event.redirected
            ? '攻击仍指向本体'
            : event.decoyHit
              ? `命中诱饵，剩余 ${event.remaining}`
              : `攻击转向诱饵但未命中，剩余 ${event.remaining}`}`,
        ]
      case 'inventory-headless-effect-applied':
        return event.effectKind === 'damage-reduction'
          ? [`${resolveName(event.actorId)}｜${event.itemName}减免 ${event.amount} 点伤害`]
          : []
      case 'activity-formula-roll-resolved':
        return [`${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜治疗结算 ${event.total} 点`]
      case 'saving-throw-resolved':
        return [
          `${resolveName(event.targetId)}｜${ABILITY_LABELS[event.ability]}豁免结果：${event.success ? '成功' : '失败'}`,
        ]
      case 'persistent-area-triggered': {
        const save = event.saveSuccess == null ? '' : `｜豁免${event.saveSuccess ? '成功' : '失败'}`
        const damage = event.damage > 0 ? `｜最终伤害 ${event.damage}` : ''
        const condition = event.conditionApplied
          ? `｜施加${dnd5eConditionLabel(event.conditionApplied)}`
          : ''
        return [
          `${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜持续区域触发${save}${damage}${condition}`,
        ]
      }
      case 'spell-damage-feature-bonus-applied': {
        const spellName = getDnd5eSrdCombatSpell(event.spellId)?.name ?? event.spellId
        return [`${resolveName(event.actorId)}｜法师特性「强化塑能」已应用于${spellName}`]
      }
      case 'magic-missile-damage-resolved':
        return [`${resolveName(event.actorId)}｜魔法飞弹最终造成 ${event.totalDamage} 点伤害`]
      case 'spell-saving-throw-damage-resolved': {
        const spellName = getDnd5eSrdCombatSpell(event.spellId)?.name ?? event.spellId
        return [
          `${resolveName(event.targetId)}｜${spellName}豁免${event.saveSucceeded ? '成功' : '失败'}｜最终伤害 ${event.finalDamage}`,
        ]
      }
      case 'spell-attack-damage-resolved': {
        const spellName = getDnd5eSrdCombatSpell(event.spellId)?.name ?? event.spellId
        return [`${resolveName(event.targetId)}｜${spellName}最终伤害 ${event.finalDamage}`]
      }
      case 'ability-check-resolved':
        return [
          `${resolveName(event.actorId)}｜${ABILITY_LABELS[event.ability]}${event.skill ? `（${event.skill}）` : ''}检定结果：${event.success == null ? '已结算' : event.success ? '成功' : '失败'}`,
        ]
      case 'slow-spell-delay-resolved':
        return [`${resolveName(event.actorId)}｜缓慢术施法延迟结果：${event.delayed ? `${event.spellId} 延迟至下回合` : `${event.spellId} 立即生效`}`]
      case 'item-last-charge-check':
        return [`${resolveName(event.actorId)}｜${event.itemName}最后一发检定：${event.destroyed ? '物品损毁' : '物品保留'}`]
      case 'post-spell-random-table-check-required':
        return [`${resolveName(event.actorId)}｜施法后随机表待判定`]
      case 'post-spell-random-table-check-resolved':
        return [`${resolveName(event.actorId)}｜施法后随机表${event.triggered ? '已触发' : '未触发'}`]
      case 'post-spell-random-table-outcome-resolved':
        return [`${resolveName(event.actorId)}｜随机表结果${event.automation === 'full' ? '已自动结算' : '交由 DM 手动裁定'}`]
      case 'post-spell-random-table-manual-adjudication-required':
        return [`${resolveName(event.actorId)}｜随机表结果等待 DM 裁定，战斗结算已暂停`]
      case 'post-spell-random-table-manual-adjudication-resolved':
        return [`${resolveName(event.actorId)}｜随机表 DM 裁定${event.decision === 'approved' ? '已应用' : '已跳过'}`]
      case 'sleep-resolved':
        return [`${resolveName(event.actorId)}｜睡眠术影响：${event.affectedTargetIds.length > 0 ? event.affectedTargetIds.map(resolveName).join('、') : '无目标'}`]
      case 'color-spray-resolved':
        return [`${resolveName(event.actorId)}｜七彩喷射目盲：${event.affectedTargetIds.length > 0 ? event.affectedTargetIds.map(resolveName).join('、') : '无目标'}`]
      case 'contest-resolved':
        return [`${resolveName(event.actorId)} → ${resolveName(event.targetId)}｜${event.contest === 'grapple' ? '擒抱' : event.contest === 'shove' ? '推撞' : '挣脱擒抱'}结果：${event.success ? '成功' : '失败'}${event.outcome ? `｜${event.outcome === 'prone' ? '击倒' : '推开'}` : ''}`]
      case 'optional-bonus-die-used':
        return [`${resolveName(event.targetId)}｜${event.label}奖励骰已使用并消耗`]
      case 'active-effect-save-required':
        return [`${resolveName(event.targetId)}｜需进行${ABILITY_LABELS[event.ability]}豁免`]
    case 'active-effect-save-resolved':
      return [`${resolveName(event.targetId)}｜持续效果${ABILITY_LABELS[event.ability]}豁免结果：${event.success ? '成功' : '失败'}`]
    case 'active-effect-random-condition-resolved':
      return [
        `${resolveName(event.targetId)}｜回合结束随机状态 1d${event.dieSides} = ${event.roll} vs 触发下限 ${event.minimum}｜${
          event.triggered ? `触发 ${event.condition}` : '未触发'
        }`,
      ]
      case 'concentration-check-required':
        return [`${resolveName(event.targetId)}｜需进行专注豁免`]
      case 'concentration-resolved':
        return [`${resolveName(event.actorId)}｜${event.success ? '维持专注' : '专注中断'}`]
      case 'death-save-resolved':
        return [`${resolveName(event.actorId)}｜死亡豁免结果：成功 ${event.successes} / 失败 ${event.failures}${event.dead ? '｜死亡' : event.stable ? '｜伤势稳定' : event.currentHp > 0 ? `｜恢复至 ${event.currentHp} HP` : ''}`]
      case 'falling-damage-resolved':
        return fallingDamageDetails(event, resolveName, false)
      case 'controlled-descent-resolved':
        return [`${resolveName(event.actorId)}｜受控下降 ${event.distanceFeet} 尺｜${event.landed ? '安全落地' : '仍在空中'}`]
      case 'counterspell-resolved':
        return [`${resolveName(event.actorId)}反制 ${resolveName(event.casterId)} 的 ${event.spellId}｜${event.success ? '反制成功' : '反制失败'}`]
      case 'spell-interception-resolved':
        return [`${resolveName(event.actorId)}拦截 ${resolveName(event.casterId)} 的 ${event.spellId}｜${event.success ? '豁免成功，法术照常生效' : event.negatedForSelf ? '对拦截者无效' : '未抵消法术'}`]
      case 'undead-fortitude-resolved':
        return [`${resolveName(event.targetId)}｜亡灵坚韧：${event.success ? '成功，保留 1 HP' : '失败'}`]
      case 'relentless-rage-resolved':
        return [`${resolveName(event.actorId)}｜不屈狂怒：${event.success ? '成功，保留 1 HP' : '失败'}`]
      default: {
        const creatureFormRevertedByDamage = event.type === 'damage-applied' &&
          event.creatureFormHpBefore != null
        return eventDetails(
          event,
          resolveName,
          formatPosition,
          [],
          undefined,
          creatureFormRevertedByDamage,
        )
      }
    }
  })
  const unique = lines.filter((line, index) => line.trim().length > 0 && lines.indexOf(line) === index)
  const limit = Math.max(1, options.limit ?? 32)
  if (unique.length <= limit) return unique
  return [...unique.slice(0, limit), `另有 ${unique.length - limit} 项结算结果未展开`]
}

/** 将 Headless 事件转成适合玩家阅读的结算明细；摘要仍由调用方保留。 */
export function formatDnd5eCombatLogDetails(
  events: readonly Dnd5eCombatEvent[],
  options: CombatLogDetailOptions = {},
): string[] {
  const resolveName = options.resolveName ?? ((id: string) => id)
  const formatPosition = options.formatPosition ?? ((position) => `(${position.x}, ${position.y})`)
  const magicMissileCorrelation = correlateMagicMissileDamageEvents(events)
  const persistentAreaCorrelation = correlatePersistentAreaDamageEvents(
    events,
    magicMissileCorrelation.suppressedDamageIndexes,
  )
  const suppressedDamageIndexes = new Set([
    ...magicMissileCorrelation.suppressedDamageIndexes,
    ...persistentAreaCorrelation.suppressedDamageIndexes,
  ])
  const hasExplicitAttackTrace = (options.extra ?? []).some((line) =>
    line.startsWith('攻击资格 ·'))
  const semanticSummaryLines: string[] = []
  const regularEventLines: string[] = []
  events.forEach((event, index) => {
    if (suppressedDamageIndexes.has(index)) return
    if (hasExplicitAttackTrace && event.type === 'attack-resolved') return
    const creatureFormRevertedByDamage = event.type === 'damage-applied' &&
      event.creatureFormHpBefore != null
    const lines = eventDetails(
      event,
      resolveName,
      formatPosition,
      magicMissileCorrelation.matchedBySummaryIndex.get(index),
      persistentAreaCorrelation.matchedBySummaryIndex.get(index),
      creatureFormRevertedByDamage,
    )
    if (
      event.type === 'spell-damage-feature-bonus-applied' ||
      event.type === 'magic-missile-damage-resolved'
    ) semanticSummaryLines.push(...lines)
    else regularEventLines.push(...lines)
  })
  const all = [
    ...(options.extra ?? []).filter((line) => line.trim().length > 0),
    ...semanticSummaryLines,
    ...regularEventLines,
  ]
  const unique = all.filter((line, index) => all.indexOf(line) === index)
  const limit = Math.max(1, options.limit ?? 32)
  if (unique.length <= limit) return unique
  return [...unique.slice(0, limit), `另有 ${unique.length - limit} 项结算事件未展开`]
}
