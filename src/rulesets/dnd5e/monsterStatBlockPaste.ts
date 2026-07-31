import type { AbilityKey } from '../../lib/dnd'
import {
  createDnd5eCustomMonsterActionDraft,
  createDnd5eCustomMonsterDraft,
  createDnd5eCustomMonsterTraitDraft,
  dnd5eCustomMonsterDraftFromStatBlock,
  type Dnd5eCustomMonsterActionDraft,
  type Dnd5eCustomMonsterDraft,
  type Dnd5eCustomMonsterTraitDraft,
} from './customMonsterWorkshop'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'
import type { Dnd5eDamageType, Dnd5eMonsterSize } from './monsters'
import {
  parseDnd5eFeatureMechanicText,
  parseDnd5eSpellcastingText,
} from './monsterContentAutoParser'

export interface Dnd5ePastedMonsterParseResult {
  draft: Dnd5eCustomMonsterDraft
  recognizedFields: string[]
  warnings: string[]
  sourceFormat: 'monster-json' | 'stat-block-text'
}

const ABILITIES: Array<[AbilityKey, RegExp]> = [
  ['str', /(?:\bSTR\b|力量)\s*[:：]?\s*(\d{1,2})/i],
  ['dex', /(?:\bDEX\b|敏捷)\s*[:：]?\s*(\d{1,2})/i],
  ['con', /(?:\bCON\b|体质)\s*[:：]?\s*(\d{1,2})/i],
  ['int', /(?:\bINT\b|智力)\s*[:：]?\s*(\d{1,2})/i],
  ['wis', /(?:\bWIS\b|感知)\s*[:：]?\s*(\d{1,2})/i],
  ['cha', /(?:\bCHA\b|魅力)\s*[:：]?\s*(\d{1,2})/i],
]

const SIZE_MAP: Array<[RegExp, Dnd5eMonsterSize]> = [
  [/\bTiny\b|微型/i, '微型'],
  [/\bSmall\b|小型/i, '小型'],
  [/\bMedium\b|中型/i, '中型'],
  [/\bLarge\b|(?<!超)大型/i, '大型'],
  [/\bHuge\b|超大型/i, '超大型'],
  [/\bGargantuan\b|巨型/i, '巨型'],
]

const DAMAGE_TYPES: Array<[RegExp, Dnd5eDamageType]> = [
  [/\bacid\b|强酸/i, 'acid'],
  [/\bbludgeoning\b|钝击/i, 'bludgeoning'],
  [/\bcold\b|寒冷/i, 'cold'],
  [/\bfire\b|火焰/i, 'fire'],
  [/\bforce\b|力场/i, 'force'],
  [/\blightning\b|闪电/i, 'lightning'],
  [/\bnecrotic\b|黯蚀|死灵/i, 'necrotic'],
  [/\bpiercing\b|穿刺/i, 'piercing'],
  [/\bpoison\b|毒素/i, 'poison'],
  [/\bpsychic\b|心灵/i, 'psychic'],
  [/\bradiant\b|光耀/i, 'radiant'],
  [/\bslashing\b|挥砍/i, 'slashing'],
  [/\bthunder\b|雷鸣/i, 'thunder'],
]

const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700,
  '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000,
  '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000,
  '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000,
  '29': 135000, '30': 155000,
}

const SKILL_NAMES: Record<string, string> = {
  acrobatics: '杂技', 'sleight of hand': '巧手', stealth: '隐匿', arcana: '奥秘',
  history: '历史', investigation: '调查', nature: '自然', religion: '宗教',
  'animal handling': '驯兽', insight: '洞悉', medicine: '医药', perception: '察觉',
  survival: '生存', deception: '欺瞒', intimidation: '威吓', performance: '表演',
  persuasion: '游说', athletics: '运动',
  杂技: '杂技', 巧手: '巧手', 隐匿: '隐匿', 奥秘: '奥秘', 历史: '历史', 调查: '调查',
  自然: '自然', 宗教: '宗教', 驯兽: '驯兽', 洞悉: '洞悉', 医药: '医药', 察觉: '察觉',
  生存: '生存', 欺瞒: '欺瞒', 威吓: '威吓', 表演: '表演', 游说: '游说', 运动: '运动',
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim()
}

function integerMatch(text: string, pattern: RegExp): number | undefined {
  const value = text.match(pattern)?.[1]
  if (value == null) return undefined
  const number = Number(value.replaceAll(',', ''))
  return Number.isFinite(number) ? Math.trunc(number) : undefined
}

function signedInteger(value: string): number {
  return Number(value.replace(/\s+/g, '').replace('−', '-'))
}

function damageTypeFromText(value: string): Dnd5eDamageType {
  return DAMAGE_TYPES.find(([pattern]) => pattern.test(value))?.[1] ?? 'bludgeoning'
}

function damageTypesFromText(value: string): Dnd5eDamageType[] {
  return DAMAGE_TYPES.filter(([pattern]) => pattern.test(value)).map(([, type]) => type)
}

function lineValue(lines: readonly string[], labels: RegExp): string | undefined {
  for (const line of lines) {
    const match = line.match(labels)
    if (match) return match[1]?.trim()
  }
  return undefined
}

function abilityScores(lines: readonly string[], text: string): Partial<Record<AbilityKey, number>> {
  const result: Partial<Record<AbilityKey, number>> = {}
  for (const [key, pattern] of ABILITIES) {
    const score = integerMatch(text, pattern)
    if (score != null && score >= 1 && score <= 30) result[key] = score
  }
  if (Object.keys(result).length === 6) return result
  const headerIndex = lines.findIndex((line) =>
    /STR.*DEX.*CON.*INT.*WIS.*CHA/i.test(line) || /力量.*敏捷.*体质.*智力.*感知.*魅力/.test(line))
  if (headerIndex >= 0 && lines[headerIndex + 1]) {
    const values = [...lines[headerIndex + 1].matchAll(/(\d{1,2})(?:\s*\([+−-]?\d+\))?/g)]
      .map((match) => Number(match[1]))
      .filter((score) => score >= 1 && score <= 30)
    if (values.length >= 6) {
      ;(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).forEach((key, index) => {
        result[key] = values[index]
      })
    }
  }
  return result
}

function parseBonuses(value: string, kind: 'saving-throw' | 'skill') {
  return [...value.matchAll(/([A-Za-z][A-Za-z ]+|[\u4e00-\u9fff]{2,6})\s*([+−-]\s*\d+)/g)]
    .map((match) => ({ label: match[1].trim(), bonus: signedInteger(match[2]) }))
    .filter((entry) => Number.isFinite(entry.bonus) && (
      kind === 'saving-throw' || SKILL_NAMES[entry.label.toLowerCase()] || SKILL_NAMES[entry.label]
    ))
}

function splitNamedEntries(lines: readonly string[]): Array<{ name: string; description: string }> {
  const entries: Array<{ name: string; description: string }> = []
  for (const line of lines) {
    const match = line.match(/^(.{1,80}?)[.。]\s*(.+)$/)
    if (match) {
      entries.push({ name: match[1].trim(), description: match[2].trim() })
    } else if (entries.length > 0) {
      entries[entries.length - 1].description += ` ${line}`
    }
  }
  return entries
}

function traitDraft(name: string, description: string): Dnd5eCustomMonsterTraitDraft {
  const draft = { ...createDnd5eCustomMonsterTraitDraft(), name, description }
  if (/Nimble Escape|灵巧脱逃/i.test(name)) draft.ruleKind = 'nimble-escape'
  else if (/Undead Fortitude|亡灵坚韧/i.test(name)) draft.ruleKind = 'undead-fortitude'
  else if (/Regeneration|再生/i.test(name)) draft.ruleKind = 'regeneration'
  else if (/Magic Resistance|魔法抗性/i.test(name)) draft.ruleKind = 'magic-resistance'
  else if (/Ambusher|伏击者/i.test(name)) draft.ruleKind = 'ambusher'
  else if (/Charge|冲锋/i.test(name)) draft.ruleKind = 'charge-damage'
  else if (/Keen (?:Smell|Hearing|Sight)|敏锐(?:嗅觉|听觉|视觉)/i.test(name)) draft.ruleKind = 'keen-sense'
  else if (/Swarm|集群/i.test(name)) draft.ruleKind = 'swarm'
  if (draft.ruleKind !== 'none') draft.automation = 'headless'
  return draft
}

function actionDraft(name: string, description: string): Dnd5eCustomMonsterActionDraft {
  const base = createDnd5eCustomMonsterActionDraft()
  const isAttack = /(?:Weapon|Spell) Attack|武器攻击|法术攻击|命中[：:]/i.test(description)
  const mode = /Melee or Ranged|近战或远程/i.test(description)
    ? 'melee-or-ranged'
    : /Ranged|远程/i.test(description) ? 'ranged' : 'melee'
  if (!isAttack) {
    return { ...base, name, description, kind: 'other', automation: 'dm-adjudication' }
  }
  const toHitMatch = description.match(/([+−-]\s*\d+)\s*to hit|命中\s*[：:]?\s*([+−-]\s*\d+)/i)
  const toHit = toHitMatch ? signedInteger(toHitMatch[1] ?? toHitMatch[2]) : base.toHit
  const reachFeet = integerMatch(description, /(?:reach|触及)\s*(\d+)\s*(?:ft\.?|feet|尺)/i) ?? base.reachFeet
  const range = description.match(/(?:range|射程)\s*(\d+)(?:\s*\/\s*(\d+))?\s*(?:ft\.?|feet|尺)/i)
  const hitText = description.match(/(?:Hit|命中)[：:]\s*(.+)$/i)?.[1] ?? description
  const dice = hitText.match(/(\d+d\d+(?:\s*[+−-]\s*\d+)?)/i)?.[1]?.replace(/\s+/g, '').replace('−', '-')
  const recharge = name.match(/(?:Recharge|充能)\s*(\d)(?:\s*[–—-]\s*6)?/i)
  const save = description.match(/DC\s*(\d+)\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|力量|敏捷|体质|智力|感知|魅力)/i)
  const saveAbility = save
    ? ({ strength: 'str', 力量: 'str', dexterity: 'dex', 敏捷: 'dex', constitution: 'con', 体质: 'con',
        intelligence: 'int', 智力: 'int', wisdom: 'wis', 感知: 'wis', charisma: 'cha', 魅力: 'cha' } as Record<string, AbilityKey>)[save[2].toLowerCase()] ?? base.onHitSaveAbility
    : base.onHitSaveAbility
  return {
    ...base,
    id: `attack-${name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'pasted'}`,
    name: name.replace(/\s*\((?:Recharge|充能).+?\)\s*$/i, '').trim(),
    description,
    kind: 'weapon-attack',
    automation: save && !/(?:knocked prone|倒地)/i.test(description) ? 'dm-adjudication' : 'headless',
    mode,
    toHit,
    reachFeet,
    rangeNormal: range ? Number(range[1]) : base.rangeNormal,
    rangeLong: range?.[2] ? Number(range[2]) : range ? Number(range[1]) : base.rangeLong,
    damageDice: dice ?? base.damageDice,
    damageType: damageTypeFromText(hitText),
    usageKind: recharge ? 'recharge' : 'at-will',
    rechargeMinimum: recharge ? Number(recharge[1]) : base.rechargeMinimum,
    onHitSaveEnabled: !!save,
    onHitSaveDc: save ? Number(save[1]) : base.onHitSaveDc,
    onHitSaveAbility: saveAbility,
    onHitCondition: /(?:knocked prone|倒地)/i.test(description) ? 'prone' : base.onHitCondition,
  }
}

function sectionLines(lines: readonly string[], heading: RegExp, stop: RegExp): string[] {
  const index = lines.findIndex((line) => heading.test(line))
  if (index < 0) return []
  const output: string[] = []
  for (const line of lines.slice(index + 1)) {
    if (stop.test(line)) break
    output.push(line)
  }
  return output
}

export function parseDnd5ePastedMonster(value: string): Dnd5ePastedMonsterParseResult {
  const text = normalizeText(value)
  if (!text) throw new Error('请先粘贴怪物属性块。')
  if (text.length > 1_000_000) throw new Error('粘贴内容超过 1 MB，请拆分或改用 JSON 文件导入。')

  if (text.startsWith('{')) {
    try {
      const raw = JSON.parse(text) as unknown
      const parsed = parseDnd5eMonsterStatBlock(raw)
      if (parsed.ok) {
        return {
          draft: dnd5eCustomMonsterDraftFromStatBlock(parsed.value),
          recognizedFields: ['完整 monsterSchema JSON'],
          warnings: [],
          sourceFormat: 'monster-json',
        }
      }
    } catch {
      // 继续按普通属性块解析，并在最终结果中提示。
    }
  }

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const draft = createDnd5eCustomMonsterDraft()
  const recognizedFields: string[] = []
  const warnings: string[] = []
  const mark = (label: string) => { if (!recognizedFields.includes(label)) recognizedFields.push(label) }

  const firstStatIndex = lines.findIndex((line) =>
    /^(?:Armor Class|Hit Points|Speed|护甲等级|护甲值|生命值|速度)\b/i.test(line))
  const headerLines = lines.slice(0, firstStatIndex >= 0 ? firstStatIndex : Math.min(2, lines.length))
  if (headerLines[0]) {
    draft.name = headerLines[0]
    draft.englishName = /^[\x20-\x7e]+$/.test(headerLines[0]) ? headerLines[0] : ''
    mark('名称')
  }
  const classification = headerLines[1] ?? ''
  const size = SIZE_MAP.find(([pattern]) => pattern.test(classification))?.[1]
  if (size) { draft.size = size; mark('体型') }
  if (classification) {
    const withoutSize = classification
      .replace(/^(?:Tiny|Small|Medium|Large|Huge|Gargantuan|微型|小型|中型|大型|超大型|巨型)\s*/i, '')
    const comma = withoutSize.lastIndexOf(',')
    const chineseComma = withoutSize.lastIndexOf('，')
    const splitAt = Math.max(comma, chineseComma)
    if (splitAt >= 0) {
      draft.creatureType = withoutSize.slice(0, splitAt).trim()
      draft.alignment = withoutSize.slice(splitAt + 1).trim()
      mark('生物类型')
      mark('阵营')
    }
  }

  const acLine = lineValue(lines, /^(?:Armor Class|AC|护甲等级|护甲值)\s*[:：]?\s*(.+)$/i)
  if (acLine) {
    draft.armorClass = integerMatch(acLine, /(\d+)/) ?? draft.armorClass
    draft.armorClassNote = acLine.match(/[（(](.+)[）)]/)?.[1] ?? ''
    mark('AC')
  }
  const hpLine = lineValue(lines, /^(?:Hit Points|HP|生命值)\s*[:：]?\s*(.+)$/i)
  if (hpLine) {
    draft.hitPointsAverage = integerMatch(hpLine, /(\d+)/) ?? draft.hitPointsAverage
    draft.hitPointsDice = hpLine.match(/[（(](\d+d\d+(?:\s*[+−-]\s*\d+)?)[）)]/i)?.[1]?.replace(/\s+/g, '').replace('−', '-') ?? draft.hitPointsDice
    mark('HP')
  }
  const speedLine = lineValue(lines, /^(?:Speed|速度)\s*[:：]?\s*(.+)$/i)
  if (speedLine) {
    const speed = (label: RegExp) => integerMatch(speedLine, new RegExp(`${label.source}\\s*(\\d+)\\s*(?:ft\\.?|feet|尺)`, 'i'))
    draft.walk = speed(/(?:walk(?:ing)?|步行)?/) ?? draft.walk
    draft.fly = speed(/(?:fly|flying|飞行)/) ?? 0
    draft.swim = speed(/(?:swim|swimming|游泳)/) ?? 0
    draft.climb = speed(/(?:climb|climbing|攀爬)/) ?? 0
    draft.burrow = speed(/(?:burrow|burrowing|掘穴)/) ?? 0
    draft.hover = /hover|悬浮/i.test(speedLine)
    mark('速度')
  }

  const scores = abilityScores(lines, text)
  if (Object.keys(scores).length > 0) {
    draft.abilities = { ...draft.abilities, ...scores }
    mark('六项属性')
  } else warnings.push('未识别六项属性值。')

  const savingLine = lineValue(lines, /^(?:Saving Throws|豁免)\s*[:：]?\s*(.+)$/i)
  if (savingLine) {
    const keyByName: Record<string, AbilityKey> = {
      str: 'str', 力量: 'str', dex: 'dex', 敏捷: 'dex', con: 'con', 体质: 'con',
      int: 'int', 智力: 'int', wis: 'wis', 感知: 'wis', cha: 'cha', 魅力: 'cha',
    }
    for (const entry of parseBonuses(savingLine, 'saving-throw')) {
      const key = keyByName[entry.label.toLowerCase()] ?? keyByName[entry.label]
      if (key) draft.savingThrows[key] = entry.bonus
    }
    mark('豁免')
  }
  const skillsLine = lineValue(lines, /^(?:Skills|技能)\s*[:：]?\s*(.+)$/i)
  if (skillsLine) {
    draft.skills = parseBonuses(skillsLine, 'skill').map((entry, index) => {
      const label = entry.label.toLowerCase()
      return {
        id: `pasted-skill-${index}`,
        key: label.replace(/\s+/g, '-'),
        name: SKILL_NAMES[label] ?? SKILL_NAMES[entry.label] ?? entry.label,
        bonus: entry.bonus,
      }
    })
    mark('技能')
  }

  const sensesLine = lineValue(lines, /^(?:Senses|感官)\s*[:：]?\s*(.+)$/i)
  if (sensesLine) {
    draft.passivePerception = integerMatch(sensesLine, /(?:passive Perception|被动察觉)\s*(\d+)/i) ?? draft.passivePerception
    draft.senses = [...sensesLine.matchAll(/([^,，;；]+?)\s*(\d+)\s*(?:ft\.?|feet|尺)/gi)]
      .filter((match) => !/passive Perception|被动察觉/i.test(match[1]))
      .map((match, index) => ({ id: `pasted-sense-${index}`, name: match[1].trim(), distanceFeet: Number(match[2]) }))
    mark('感官')
  }
  const languages = lineValue(lines, /^(?:Languages|语言)\s*[:：]?\s*(.+)$/i)
  if (languages) { draft.languages = languages; mark('语言') }
  const challenge = lineValue(lines, /^(?:Challenge|挑战等级|CR)\s*[:：]?\s*(.+)$/i)
  if (challenge) {
    const rating = challenge.match(/(?:CR\s*)?(\d+\/\d+|\d+)/i)?.[1]
    if (rating) {
      draft.challengeRating = rating
      draft.xp = integerMatch(challenge, /\(?([\d,]+)\s*XP\)?/i) ?? XP_BY_CR[rating] ?? draft.xp
      mark('CR 与 XP')
    }
  }

  const vulnerabilityLine = lineValue(lines, /^(?:Damage Vulnerabilities|伤害易伤)\s*[:：]?\s*(.+)$/i)
  if (vulnerabilityLine) { draft.damageVulnerabilities = damageTypesFromText(vulnerabilityLine); mark('伤害易伤') }
  const resistanceLine = lineValue(lines, /^(?:Damage Resistances|伤害抗性)\s*[:：]?\s*(.+)$/i)
  if (resistanceLine) { draft.damageResistances = damageTypesFromText(resistanceLine); mark('伤害抗性') }
  const immunityLine = lineValue(lines, /^(?:Damage Immunities|伤害免疫)\s*[:：]?\s*(.+)$/i)
  if (immunityLine) { draft.damageImmunities = damageTypesFromText(immunityLine); mark('伤害免疫') }

  const sectionHeading = /^(?:Actions?|动作|Bonus Actions?|附赠动作|Reactions?|反应|Legendary Actions?|传奇动作|Lair Actions?|巢穴动作)\s*$/i
  const firstSection = lines.findIndex((line) => sectionHeading.test(line))
  const traitStart = lines.findIndex((line) => /^(?:Challenge|挑战等级|CR)\b/i.test(line))
  const traitLines = traitStart >= 0
    ? lines.slice(traitStart + 1, firstSection >= 0 ? firstSection : lines.length)
      .filter((line) => !/^(?:Proficiency Bonus|熟练加值)\b/i.test(line))
    : []
  draft.traits = splitNamedEntries(traitLines).map((entry) => traitDraft(entry.name, entry.description))
  if (draft.traits.length > 0) mark('特性')
  draft.headlessMechanics = draft.traits.flatMap((trait) => {
    const parsed = parseDnd5eFeatureMechanicText(`${trait.name}：${trait.description}`)
    return parsed.mechanic ? [parsed.mechanic] : []
  })
  if (draft.headlessMechanics.length > 0) mark('Headless 特性机制')

  const parsedSpellcasting = parseDnd5eSpellcastingText(text)
  if (parsedSpellcasting.spells.length > 0) {
    draft.spellcastingEnabled = true
    draft.spells = parsedSpellcasting.spells
    draft.spellSlots = parsedSpellcasting.slots
    mark('法术列表')
    if (parsedSpellcasting.unknown.length > 0) {
      warnings.push(`以下法术未在 SRD 5.1 目录中识别：${parsedSpellcasting.unknown.join('、')}。`)
    }
  }
  const actionSections: Array<{
    label: string
    heading: RegExp
    stop: RegExp
    category: Dnd5eCustomMonsterActionDraft['category']
  }> = [
    {
      label: '动作',
      heading: /^(?:Actions?|动作)\s*$/i,
      stop: /^(?:Bonus Actions?|附赠动作|Reactions?|反应|Legendary Actions?|传奇动作|Lair Actions?|巢穴动作)\s*$/i,
      category: 'action',
    },
    {
      label: '附赠动作',
      heading: /^(?:Bonus Actions?|附赠动作)\s*$/i,
      stop: /^(?:Reactions?|反应|Legendary Actions?|传奇动作|Lair Actions?|巢穴动作)\s*$/i,
      category: 'bonus-action',
    },
    {
      label: '反应',
      heading: /^(?:Reactions?|反应)\s*$/i,
      stop: /^(?:Legendary Actions?|传奇动作|Lair Actions?|巢穴动作)\s*$/i,
      category: 'reaction',
    },
    {
      label: '传奇动作',
      heading: /^(?:Legendary Actions?|传奇动作)\s*$/i,
      stop: /^(?:Lair Actions?|巢穴动作)\s*$/i,
      category: 'legendary',
    },
    {
      label: '巢穴动作',
      heading: /^(?:Lair Actions?|巢穴动作)\s*$/i,
      stop: /$^/,
      category: 'lair',
    },
  ]
  draft.actions = actionSections.flatMap(({ label, heading, stop, category }) => {
    const entries = splitNamedEntries(sectionLines(lines, heading, stop))
      .map((entry) => ({ ...actionDraft(entry.name, entry.description), category }))
    if (entries.length > 0) mark(label)
    return entries
  })
  if (draft.actions.length > 0) mark('动作')
  else {
    draft.actions = [createDnd5eCustomMonsterActionDraft()]
    warnings.push('未识别动作段落；已保留一个默认攻击，保存前请检查。')
  }
  if (draft.traits.some((trait) => /Spellcasting|施法/i.test(trait.name)) && parsedSpellcasting.spells.length === 0) {
    warnings.push('识别到施法特性；法术列表和法术位需要在“施法”区域人工核对。')
  }

  const minimumReliable = ['名称', 'AC', 'HP', '六项属性']
  const missing = minimumReliable.filter((field) => !recognizedFields.includes(field))
  if (missing.length > 0) warnings.push(`关键字段未识别：${missing.join('、')}。请在覆盖表单前核对原文格式。`)
  draft.description = `由粘贴的 D&D 5e 属性块自动填写。原始文本中的复杂施法、多重攻击和特殊机制仍需人工核对。`

  return { draft, recognizedFields, warnings, sourceFormat: 'stat-block-text' }
}
