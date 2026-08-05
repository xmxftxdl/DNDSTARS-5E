import {
  createDnd5eCustomMonsterMechanicDraft,
  type Dnd5eCustomMonsterMechanicDraft,
  type Dnd5eCustomMonsterSpellDraft,
} from './customMonsterWorkshop'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'

export interface Dnd5eFeatureAutoParseResult {
  mechanic?: Dnd5eCustomMonsterMechanicDraft
  warnings: string[]
}

const DAMAGE_TYPE_TERMS: ReadonlyArray<[RegExp, Dnd5eDamageType]> = [
  [/强酸|acid/i, 'acid'], [/钝击|bludgeoning/i, 'bludgeoning'], [/冷冻|cold/i, 'cold'],
  [/火焰|fire/i, 'fire'], [/力场|force/i, 'force'], [/闪电|lightning/i, 'lightning'],
  [/黯蚀|死灵|necrotic/i, 'necrotic'], [/穿刺|piercing/i, 'piercing'], [/毒素|poison/i, 'poison'],
  [/心灵|psychic/i, 'psychic'], [/光耀|radiant/i, 'radiant'], [/挥砍|slashing/i, 'slashing'],
  [/雷鸣|thunder/i, 'thunder'],
]

function slug(value: string): string {
  const normalized = value.normalize('NFKD').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (normalized) return normalized.slice(0, 48)
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  }
  return `feature-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function explicitDamageType(text: string): Dnd5eDamageType | undefined {
  return DAMAGE_TYPE_TERMS.find(([pattern]) => pattern.test(text))?.[1]
}

/**
 * 将一条常见的自然语言特性转换为 Host 白名单机制。
 * 解析器只接受能够无歧义落入现有协议的纵向切片；其余内容返回警告，
 * 不会猜测或静默标记为完全自动化。
 */
export function parseDnd5eFeatureMechanicText(text: string): Dnd5eFeatureAutoParseResult {
  const source = text.replace(/\r\n?/g, '\n').trim()
  if (!source) return { warnings: ['请先粘贴特性名称和规则正文。'] }
  const [heading, ...bodyParts] = source.split(/[:：]\s*/)
  const body = bodyParts.length > 0 ? bodyParts.join('：').trim() : source
  const name = bodyParts.length > 0 ? heading.trim() : '自动解析特性'
  const mechanic = createDnd5eCustomMonsterMechanicDraft()
  mechanic.id = `mechanic-${slug(name)}`
  mechanic.name = name
  mechanic.hpPercentageAtOrBelow = undefined
  mechanic.hpPercentageAtOrAbove = undefined

  const inclusiveBelow = body.match(/(?:当前\s*)?(?:HP|生命值|血量)\s*(?:<=|≤|不高于|至多|低于或等于|小于或等于)\s*(\d+)/i)
  const strictBelow = body.match(/(?:当前\s*)?(?:HP|生命值|血量)\s*(?:<|低于|小于)\s*(\d+)/i)
  if (inclusiveBelow) mechanic.hpAtOrBelow = Number(inclusiveBelow[1])
  else if (strictBelow) mechanic.hpBelow = Number(strictBelow[1])

  if (/受到[^。；\n]*伤害(?:后|时)/i.test(body)) {
    mechanic.trigger = 'after-damaged'
    mechanic.triggerSubject = 'self'
  } else if (/(?:造成的所有伤害|造成[^。；\n]*伤害(?:后|时)|每当[^。；\n]*造成伤害)/i.test(body)) {
    mechanic.trigger = 'after-dealt-damage'
    mechanic.triggerSubject = 'self'
  } else if (/(?:攻击)?命中(?:后|时)/i.test(body)) {
    mechanic.trigger = 'after-hit'
    mechanic.triggerSubject = 'self'
  } else {
    return { warnings: ['未识别到安全支持的触发时机；请手动选择触发器。'] }
  }

  const extraDamage = body.match(/(?:额外|追加|增加|获得[^。；\n]*加值)[^。；\n]*?(\d+d\d+(?:\s*[+\-−]\s*\d+)?)/i)
  if (!extraDamage) {
    return { warnings: ['未识别到额外伤害骰；当前不会自动创建可能错误的效果。'] }
  }
  mechanic.effectKind = 'damage'
  mechanic.effectTarget = mechanic.trigger === 'after-damaged' ? 'damage-source' : 'trigger-target'
  mechanic.healingDice = extraDamage[1].replace(/\s+/g, '').replace('−', '-')
  const type = explicitDamageType(body)
  const asksToInherit = /(?:继承|相同|同种|原)(?:本次|此次|该次|原)?伤害类型/i.test(body)
  mechanic.damageType = type ?? (asksToInherit || mechanic.trigger === 'after-dealt-damage'
    ? 'inherit-trigger'
    : 'force')
  mechanic.limit = /每回合(?:至多)?一次/i.test(body) ? 'once-per-turn' : 'unlimited'
  mechanic.requiresPositiveHp = true
  mechanic.automation = 'full'

  const warnings: string[] = []
  if (!type && mechanic.damageType !== 'inherit-trigger') {
    warnings.push('正文没有明确伤害类型；已使用力场伤害，请保存前核对。')
  }
  if (mechanic.hpBelow == null && mechanic.hpAtOrBelow == null && /(?:HP|生命值|血量)/i.test(body)) {
    warnings.push('正文提到了生命值，但没有识别到“低于／不高于固定数值”的条件。')
  }
  return { mechanic, warnings }
}

function normalizedSpellNeedle(value: string): string {
  return value.toLocaleLowerCase('en-US').replace(/[’']/g, '').replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

const SPELL_LOOKUP = new Map(
  DND5E_SRD_SPELL_CATALOG.flatMap((spell) => [
    [normalizedSpellNeedle(spell.id), spell] as const,
    [normalizedSpellNeedle(spell.name), spell] as const,
    [normalizedSpellNeedle(spell.englishName), spell] as const,
  ]),
)

const SPELL_NAME_ALIASES = new Map<string, string>([
  [normalizedSpellNeedle('冰冻射线'), normalizedSpellNeedle('ray-of-frost')],
  [normalizedSpellNeedle('冰霜射线'), normalizedSpellNeedle('ray-of-frost')],
])

const CHINESE_SPELL_LEVELS: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}

/** 从逗号、顿号或换行分隔的法术文本中识别 SRD 5.1 法术。 */
export function parseDnd5eSpellListText(text: string): {
  spells: Dnd5eCustomMonsterSpellDraft[]
  unknown: string[]
} {
  const candidates = text
    .replace(/^(?:戏法|Cantrips?|\d+(?:st|nd|rd|th)?\s*level|\d+\s*环)[^:：]*[:：]/gim, '')
    .split(/[,，、;\n]+/)
    .map((entry) => entry.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean)
  const spells: Dnd5eCustomMonsterSpellDraft[] = []
  const unknown: string[] = []
  for (const candidate of candidates) {
    const needle = normalizedSpellNeedle(candidate)
    const found = SPELL_LOOKUP.get(SPELL_NAME_ALIASES.get(needle) ?? needle)
    if (!found) {
      unknown.push(candidate)
      continue
    }
    if (spells.some((spell) => spell.id === found.id)) continue
    spells.push({
      id: found.id,
      name: found.name,
      level: found.level,
      usageKind: 'slots',
      usageMax: 1,
    })
  }
  return { spells, unknown }
}

/** 识别标准属性块中的“戏法／N 环”法术行，并保留随意、法术位或每日次数。 */
export function parseDnd5eSpellcastingText(text: string): {
  spells: Dnd5eCustomMonsterSpellDraft[]
  slots: Record<string, number>
  unknown: string[]
  unknownDetails: Array<{
    name: string
    level: number
    usageKind: Dnd5eCustomMonsterSpellDraft['usageKind']
    usageMax: number
  }>
} {
  const spells: Dnd5eCustomMonsterSpellDraft[] = []
  const slots: Record<string, number> = {}
  const unknown: string[] = []
  const unknownDetails: Array<{
    name: string
    level: number
    usageKind: Dnd5eCustomMonsterSpellDraft['usageKind']
    usageMax: number
  }> = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.trim().match(
      /^(戏法|Cantrips?|\d+(?:st|nd|rd|th)?\s*level|(?:\d+|[一二三四五六七八九])\s*环)\s*(?:[（(]([^）)]*)[）)])?\s*[:：]\s*(.+)$/i,
    )
    if (!match) continue
    const levelText = match[1]
    const chineseLevel = CHINESE_SPELL_LEVELS[levelText.trim()[0]]
    const level = /戏法|cantrip/i.test(levelText)
      ? 0
      : Number(levelText.match(/\d+/)?.[0] ?? chineseLevel ?? 0)
    const usageText = match[2] ?? ''
    const parsed = parseDnd5eSpellListText(match[3])
    unknown.push(...parsed.unknown)
    const slotCount = Number(usageText.match(/(\d+)\s*(?:slots?|法术位)/i)?.[1] ?? 0)
    if (level > 0 && slotCount > 0) slots[String(level)] = slotCount
    const perDay = Number(usageText.match(/(\d+)\s*\/\s*(?:day|日)/i)?.[1] ?? 0)
    const atWill = level === 0 || /at will|随意/i.test(usageText)
    const usageKind: Dnd5eCustomMonsterSpellDraft['usageKind'] = perDay > 0
      ? 'per-day'
      : atWill ? 'at-will' : 'slots'
    for (const name of parsed.unknown) {
      if (unknownDetails.some((entry) => normalizedSpellNeedle(entry.name) === normalizedSpellNeedle(name))) continue
      unknownDetails.push({ name, level, usageKind, usageMax: perDay || 1 })
    }
    for (const spell of parsed.spells) {
      const normalized: Dnd5eCustomMonsterSpellDraft = {
        ...spell,
        level,
        usageKind,
        usageMax: perDay || 1,
      }
      const existing = spells.findIndex((entry) => entry.id === spell.id)
      if (existing >= 0) spells[existing] = normalized
      else spells.push(normalized)
    }
  }
  return { spells, slots, unknown, unknownDetails }
}

export function isDnd5eDamageType(value: string): value is Dnd5eDamageType {
  return (DND5E_DAMAGE_TYPES as readonly string[]).includes(value)
}
