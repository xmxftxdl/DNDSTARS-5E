import {
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import { DND5E_DAMAGE_TYPES } from './damageTypes'

export interface Dnd5eMonsterSchemaIssue {
  monsterId: string
  actionId?: string
  code:
    | 'invalid-stat-block'
    | 'duplicate-monster-id'
    | 'duplicate-monster-slug'
    | 'duplicate-action-id'
    | 'invalid-weapon-attack'
    | 'unstructured-on-hit-rule'
    | 'invalid-multiattack-sequence'
    | 'unsupported-action-kind'
  message: string
}

export type Dnd5eMonsterActionAutomation = 'headless' | 'dm-adjudication' | 'invalid'

const SIZE_VALUES = new Set(['微型', '小型', '中型', '大型', '超大型', '巨型'])
const DAMAGE_TYPE_VALUES = new Set<string>(DND5E_DAMAGE_TYPES)
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ACTION_KINDS = new Set(['weapon-attack', 'multiattack', 'other'])
const ATTACK_MODES = new Set(['melee', 'ranged', 'melee-or-ranged'])
const ID_PATTERN = /^(?:srd-5\.1|room-monster):[a-z0-9][a-z0-9-]{0,95}$/
const DICE_PATTERN = /^\d+d\d+(?:\s*[+\-−]\s*\d+)?$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function finiteInteger(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max
}

function requiredText(value: unknown, max = 20_000): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function issue(monsterId: string, message: string, actionId?: string): Dnd5eMonsterSchemaIssue {
  return { monsterId, actionId, code: 'invalid-stat-block', message }
}

function validateDamage(raw: unknown): boolean {
  if (!isRecord(raw)) return false
  return finiteInteger(raw.average, 0, 1_000_000) &&
    finiteInteger(raw.count, 0, 1_000) &&
    finiteInteger(raw.sides, 2, 1_000_000) &&
    finiteInteger(raw.bonus, -1_000_000, 1_000_000) &&
    typeof raw.type === 'string' && DAMAGE_TYPE_VALUES.has(raw.type)
}

function validateDamageList(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length >= 1 && raw.length <= 16 && raw.every(validateDamage)
}

function actionShapeIsValid(action: unknown): action is Dnd5eMonsterAction {
  if (!isRecord(action) || !requiredText(action.id, 120) || !requiredText(action.name, 240) ||
    !requiredText(action.description) || typeof action.kind !== 'string' || !ACTION_KINDS.has(action.kind)) return false
  if (action.automation != null && action.automation !== 'headless' && action.automation !== 'dm-adjudication') return false
  if (action.sequence != null && (!Array.isArray(action.sequence) || action.sequence.some((entry) => !requiredText(entry, 120)))) return false
  if (action.usage != null && (
    !isRecord(action.usage) || action.usage.kind !== 'recharge' ||
    !finiteInteger(action.usage.dieSides, 2, 100) ||
    !finiteInteger(action.usage.minimum, 1, Number(action.usage.dieSides))
  )) return false
  if (action.legendaryCost != null && !finiteInteger(action.legendaryCost, 1, 10)) return false
  if (action.referencedActionId != null && !requiredText(action.referencedActionId, 120)) return false
  if (action.attack == null) return true
  const attack = action.attack
  if (!isRecord(attack) || typeof attack.mode !== 'string' || !ATTACK_MODES.has(attack.mode) ||
    !finiteInteger(attack.toHit, -100, 100) || !requiredText(attack.target, 500) ||
    !validateDamageList(attack.damage)) return false
  if (attack.damageAtHalfHp != null && !validateDamageList(attack.damageAtHalfHp)) return false
  if (attack.reachFeet != null && !finiteInteger(attack.reachFeet, 0, 10_000)) return false
  if (attack.rangeFeet != null && (!isRecord(attack.rangeFeet) ||
    !finiteInteger(attack.rangeFeet.normal, 0, 100_000) || !finiteInteger(attack.rangeFeet.long, 0, 100_000) ||
    Number(attack.rangeFeet.long) < Number(attack.rangeFeet.normal))) return false
  if (attack.onHit != null && !requiredText(attack.onHit)) return false
  if (attack.onHitRule != null) {
    if (!isRecord(attack.onHitRule) || attack.onHitRule.kind !== 'saving-throw-condition' ||
      !ABILITY_KEYS.includes(attack.onHitRule.ability as typeof ABILITY_KEYS[number]) ||
      !finiteInteger(attack.onHitRule.dc, 1, 100) || attack.onHitRule.condition !== 'prone') return false
  }
  return true
}

function traitShapeIsValid(raw: unknown): boolean {
  if (!isRecord(raw) || !requiredText(raw.name, 240) || !requiredText(raw.description)) return false
  if (raw.automation != null && raw.automation !== 'headless' && raw.automation !== 'dm-adjudication') return false
  if (raw.rule == null) return true
  if (!isRecord(raw.rule) || typeof raw.rule.kind !== 'string') return false
  if (raw.rule.kind === 'undead-fortitude') {
    return finiteInteger(raw.rule.dcBase, 1, 100) &&
      Array.isArray(raw.rule.excludedDamageTypes) && raw.rule.excludedDamageTypes.every((type) => DAMAGE_TYPE_VALUES.has(String(type))) &&
      typeof raw.rule.excludedOnCritical === 'boolean'
  }
  if (raw.rule.kind === 'regeneration') {
    return finiteInteger(raw.rule.amount, 1, 1_000_000) && typeof raw.rule.requiresPositiveHp === 'boolean' &&
      Array.isArray(raw.rule.suppressedByDamageTypes) && raw.rule.suppressedByDamageTypes.every((type) => DAMAGE_TYPE_VALUES.has(String(type))) &&
      typeof raw.rule.diesAtZeroWhenSuppressed === 'boolean'
  }
  if (raw.rule.kind === 'swarm') {
    return raw.rule.cannotRegainHitPoints === true && raw.rule.cannotGainTemporaryHitPoints === true
  }
  return false
}

export function dnd5eMonsterActionAutomation(action: Dnd5eMonsterAction): Dnd5eMonsterActionAutomation {
  if (action.automation === 'dm-adjudication') return 'dm-adjudication'
  if (action.kind === 'other') return action.automation === 'headless' ? 'invalid' : 'dm-adjudication'
  if (action.kind === 'multiattack') return action.sequence?.length ? 'headless' : 'invalid'
  if (!action.attack || action.attack.damage.length < 1) return 'invalid'
  if (action.attack.onHit && !action.attack.onHitRule) return 'invalid'
  return 'headless'
}

function validateActionList(
  monster: Dnd5eMonsterStatBlock,
  actions: readonly Dnd5eMonsterAction[],
  section: string,
): Dnd5eMonsterSchemaIssue[] {
  const issues: Dnd5eMonsterSchemaIssue[] = []
  const ids = new Set<string>()
  for (const action of actions) {
    const rawAction: unknown = action
    if (!actionShapeIsValid(rawAction)) {
      issues.push({
        monsterId: monster.id,
        actionId: isRecord(rawAction) && typeof rawAction.id === 'string' ? rawAction.id : undefined,
        code: 'invalid-stat-block',
        message: `${section}包含无效动作结构`,
      })
      continue
    }
    if (ids.has(action.id)) {
      issues.push({ monsterId: monster.id, actionId: action.id, code: 'duplicate-action-id', message: `${section}动作 ID 重复：${action.id}` })
    }
    ids.add(action.id)
    const automation = dnd5eMonsterActionAutomation(action)
    if (automation === 'invalid') {
      const code = action.kind === 'multiattack' ? 'invalid-multiattack-sequence'
        : action.kind === 'weapon-attack' && action.attack?.onHit && !action.attack.onHitRule
          ? 'unstructured-on-hit-rule'
          : action.kind === 'weapon-attack' ? 'invalid-weapon-attack' : 'unsupported-action-kind'
      issues.push({ monsterId: monster.id, actionId: action.id, code, message: `${section}动作 ${action.name} 缺少可验证的 Headless 结构` })
    }
  }
  for (const action of actions) {
    if (!actionShapeIsValid(action) || action.kind !== 'multiattack' || dnd5eMonsterActionAutomation(action) !== 'headless') continue
    for (const childId of action.sequence ?? []) {
      const child = actions.find((candidate) => candidate.id === childId)
      if (!child || child.kind !== 'weapon-attack' || dnd5eMonsterActionAutomation(child) !== 'headless') {
        issues.push({
          monsterId: monster.id,
          actionId: action.id,
          code: 'invalid-multiattack-sequence',
          message: `${section}多重攻击引用了不存在或不能由 Headless 结算的动作：${childId}`,
        })
      }
    }
  }
  return issues
}

function validateCoreShape(raw: unknown): Dnd5eMonsterSchemaIssue[] {
  const monsterId = isRecord(raw) && typeof raw.id === 'string' ? raw.id : 'unknown-monster'
  if (!isRecord(raw)) return [issue(monsterId, '怪物数据必须是对象')]
  const issues: Dnd5eMonsterSchemaIssue[] = []
  if (!requiredText(raw.id, 120) || !ID_PATTERN.test(String(raw.id))) issues.push(issue(monsterId, '怪物 ID 必须使用 srd-5.1: 或 room-monster: 命名空间'))
  if (!requiredText(raw.slug, 96) || !/^[a-z0-9][a-z0-9-]*$/.test(String(raw.slug))) issues.push(issue(monsterId, '怪物 slug 无效'))
  if (!requiredText(raw.name, 240) || !requiredText(raw.englishName, 240)) issues.push(issue(monsterId, '怪物名称无效'))
  if (raw.source !== 'SRD 5.1' && raw.source !== 'DM 自定义') issues.push(issue(monsterId, '怪物来源无效'))
  if (raw.source === 'SRD 5.1' && !String(raw.id).startsWith('srd-5.1:')) issues.push(issue(monsterId, 'SRD 怪物 ID 命名空间错误'))
  if (raw.source === 'DM 自定义' && !String(raw.id).startsWith('room-monster:')) issues.push(issue(monsterId, '自定义怪物 ID 命名空间错误'))
  if (raw.sourcePage != null && !finiteInteger(raw.sourcePage, 1, 10_000)) issues.push(issue(monsterId, '来源页码无效'))
  if (!SIZE_VALUES.has(String(raw.size)) || !requiredText(raw.creatureType, 120) || !requiredText(raw.alignment, 240)) issues.push(issue(monsterId, '体型、类型或阵营无效'))
  if (raw.subtypes != null && (!Array.isArray(raw.subtypes) || raw.subtypes.length > 32 || raw.subtypes.some((entry) => !requiredText(entry, 240)))) issues.push(issue(monsterId, '生物亚型无效'))
  if (!isRecord(raw.armorClass) || !finiteInteger(raw.armorClass.value, 1, 100)) issues.push(issue(monsterId, '护甲等级无效'))
  if (!isRecord(raw.hitPoints) || !finiteInteger(raw.hitPoints.average, 1, 1_000_000) ||
    typeof raw.hitPoints.dice !== 'string' || !DICE_PATTERN.test(raw.hitPoints.dice)) issues.push(issue(monsterId, '生命值或生命骰无效'))
  const speed = isRecord(raw.speed) ? raw.speed : null
  if (!speed || !finiteInteger(speed.walk, 0, 10_000) ||
    ['fly', 'swim', 'climb', 'burrow'].some((key) => speed[key] != null && !finiteInteger(speed[key], 0, 10_000)) ||
    (speed.hover != null && typeof speed.hover !== 'boolean')) issues.push(issue(monsterId, '移动速度无效'))
  const abilities = isRecord(raw.abilities) ? raw.abilities : null
  if (!abilities || ABILITY_KEYS.some((key) => !finiteInteger(abilities[key], 1, 30))) issues.push(issue(monsterId, '六项属性值必须是 1–30 的整数'))
  if (raw.savingThrows != null && (!isRecord(raw.savingThrows) || Object.entries(raw.savingThrows).some(([key, value]) => !ABILITY_KEYS.includes(key as typeof ABILITY_KEYS[number]) || !finiteInteger(value, -100, 100)))) issues.push(issue(monsterId, '豁免加值无效'))
  if (raw.skills != null && (!Array.isArray(raw.skills) || raw.skills.length > 64 || raw.skills.some((skill) => !isRecord(skill) || !requiredText(skill.key, 120) || !requiredText(skill.name, 240) || !finiteInteger(skill.bonus, -100, 100)))) issues.push(issue(monsterId, '技能数据无效'))
  if (!Array.isArray(raw.senses) || raw.senses.length > 32 || raw.senses.some((sense) => !isRecord(sense) || !requiredText(sense.name, 120) ||
    (sense.distanceFeet != null && !finiteInteger(sense.distanceFeet, 0, 100_000)))) issues.push(issue(monsterId, '感官数据无效'))
  if (!finiteInteger(raw.passivePerception, 0, 100)) issues.push(issue(monsterId, '被动察觉无效'))
  if (!Array.isArray(raw.languages) || raw.languages.length > 64 || raw.languages.some((language) => !requiredText(language, 500))) issues.push(issue(monsterId, '语言数据无效'))
  if (!isRecord(raw.challenge) || !requiredText(raw.challenge.rating, 16) || !finiteInteger(raw.challenge.xp, 0, 100_000_000)) issues.push(issue(monsterId, '挑战等级或经验值无效'))
  if (raw.legendaryResistanceUses != null && !finiteInteger(raw.legendaryResistanceUses, 0, 99)) {
    issues.push(issue(monsterId, '传奇抗性次数无效'))
  }
  if (!Array.isArray(raw.traits) || raw.traits.length > 128 || raw.traits.some((trait) => !traitShapeIsValid(trait))) issues.push(issue(monsterId, '特性数据无效'))
  if (!Array.isArray(raw.actions) || raw.actions.length > 128) issues.push(issue(monsterId, '动作列表无效'))
  for (const [key, label] of [['reactions', '反应'], ['legendaryActions', '传奇动作'], ['lairActions', '巢穴动作']] as const) {
    if (raw[key] != null && (!Array.isArray(raw[key]) || raw[key].length > 128)) issues.push(issue(monsterId, `${label}列表无效`))
  }
  if (raw.spellcasting != null) {
    const spellcasting = isRecord(raw.spellcasting) ? raw.spellcasting : null
    const slots = isRecord(spellcasting?.slots) ? spellcasting.slots : null
    const spells = Array.isArray(spellcasting?.spells) ? spellcasting.spells : null
    if (
      !spellcasting || !requiredText(spellcasting.description) ||
      (spellcasting.automation !== 'headless' && spellcasting.automation !== 'dm-adjudication') ||
      (spellcasting.casterLevel != null && !finiteInteger(spellcasting.casterLevel, 1, 30)) ||
      (spellcasting.ability != null && !ABILITY_KEYS.includes(spellcasting.ability as typeof ABILITY_KEYS[number])) ||
      (spellcasting.saveDc != null && !finiteInteger(spellcasting.saveDc, 1, 100)) ||
      (spellcasting.attackBonus != null && !finiteInteger(spellcasting.attackBonus, -100, 100)) ||
      (spellcasting.componentsRequired != null && (
        !Array.isArray(spellcasting.componentsRequired) ||
        spellcasting.componentsRequired.some((entry) => !['V', 'S', 'M'].includes(String(entry)))
      )) ||
      (spellcasting.slots != null && (!slots || Object.entries(slots).some(([level, count]) =>
        !/^[1-9]$/.test(level) || !finiteInteger(count, 0, 99)
      ))) ||
      (spellcasting.spells != null && (!spells || spells.some((spell) =>
        !isRecord(spell) || !requiredText(spell.id, 120) || !requiredText(spell.name, 240) ||
        !finiteInteger(spell.level, 0, 9) || (spell.usage != null && (
          !isRecord(spell.usage) ||
          (spell.usage.kind !== 'at-will' && !(spell.usage.kind === 'per-day' && finiteInteger(spell.usage.max, 1, 99)))
        ))
      )))
    ) issues.push(issue(monsterId, '施法数据无效'))
  }
  if (!requiredText(raw.description)) issues.push(issue(monsterId, '怪物简介无效'))
  for (const key of ['damageVulnerabilities', 'damageResistances', 'damageImmunities'] as const) {
    if (raw[key] != null && (!Array.isArray(raw[key]) || raw[key].some((entry) => typeof entry !== 'string' || !DAMAGE_TYPE_VALUES.has(entry)))) {
      issues.push(issue(monsterId, `${key} 包含未知伤害类型`))
    }
  }
  if (raw.conditionImmunities != null && (!Array.isArray(raw.conditionImmunities) || raw.conditionImmunities.some((entry) => !requiredText(entry, 120)))) {
    issues.push(issue(monsterId, '状态免疫数据无效'))
  }
  if (raw.capabilities != null) {
    const capabilities = isRecord(raw.capabilities) ? raw.capabilities : null
    if (!capabilities || [
      'swarm', 'shapechanger', 'regeneration', 'spellcaster', 'legendary', 'hasFlySpeed', 'hasSwimSpeed',
    ].some((key) => typeof capabilities[key] !== 'boolean')) {
      issues.push(issue(monsterId, '能力标签数据无效'))
    }
  }
  return issues
}

export function validateDnd5eMonsterSchema(monster: Dnd5eMonsterStatBlock): Dnd5eMonsterSchemaIssue[] {
  const issues = validateCoreShape(monster)
  if (issues.length > 0) return issues
  issues.push(...validateActionList(monster, monster.actions, '动作'))
  for (const [label, actions] of [
    ['反应', monster.reactions],
    ['传奇动作', monster.legendaryActions],
    ['巢穴动作', monster.lairActions],
  ] as const) {
    if (Array.isArray(actions)) issues.push(...validateActionList(monster, actions, label))
  }
  for (const action of monster.legendaryActions ?? []) {
    if (action.referencedActionId && !monster.actions.some((candidate) => candidate.id === action.referencedActionId)) {
      issues.push({
        monsterId: monster.id,
        actionId: action.id,
        code: 'invalid-stat-block',
        message: `传奇动作引用了不存在的普通动作：${action.referencedActionId}`,
      })
    }
  }
  return issues
}

export function parseDnd5eMonsterStatBlock(raw: unknown):
  | { ok: true; value: Dnd5eMonsterStatBlock }
  | { ok: false; issues: Dnd5eMonsterSchemaIssue[] } {
  const coreIssues = validateCoreShape(raw)
  if (coreIssues.length > 0) return { ok: false, issues: coreIssues }
  const monster = structuredClone(raw) as Dnd5eMonsterStatBlock
  const issues = validateDnd5eMonsterSchema(monster)
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: monster }
}

export function validateDnd5eMonsterCatalog(monsters: readonly Dnd5eMonsterStatBlock[]): Dnd5eMonsterSchemaIssue[] {
  const issues = monsters.flatMap(validateDnd5eMonsterSchema)
  const ids = new Set<string>()
  const slugs = new Set<string>()
  for (const monster of monsters) {
    if (ids.has(monster.id)) issues.push({ monsterId: monster.id, code: 'duplicate-monster-id', message: `怪物 ID 重复：${monster.id}` })
    else ids.add(monster.id)
    if (slugs.has(monster.slug)) issues.push({ monsterId: monster.id, code: 'duplicate-monster-slug', message: `怪物 slug 重复：${monster.slug}` })
    else slugs.add(monster.slug)
  }
  return issues
}
