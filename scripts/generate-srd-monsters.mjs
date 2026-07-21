import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_COMMIT = 'b75592547b78d431c20226a347688a0746abdfb1'
const SOURCE_URL = `https://raw.githubusercontent.com/5e-bits/5e-database/${SOURCE_COMMIT}/src/2014/en/5e-SRD-Monsters.json`
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(SCRIPT_DIR, '..')
const OUTPUT = resolve(ROOT, 'src/rulesets/dnd5e/generated/srdMonsters.generated.json')

const SIZE_LABELS = {
  Tiny: '微型',
  Small: '小型',
  Medium: '中型',
  Large: '大型',
  Huge: '超大型',
  Gargantuan: '巨型',
}

const TYPE_LABELS = {
  aberration: '异怪',
  beast: '野兽',
  celestial: '天界生物',
  construct: '构装体',
  dragon: '龙',
  elemental: '元素生物',
  fey: '精类',
  fiend: '邪魔',
  giant: '巨人',
  humanoid: '类人生物',
  monstrosity: '怪兽',
  ooze: '软泥怪',
  plant: '植物',
  undead: '亡灵',
}

const DAMAGE_TYPES = new Set([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
])

const ABILITY_KEYS = {
  str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha',
  strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
}

function args() {
  const sourceIndex = process.argv.indexOf('--source')
  const outputIndex = process.argv.indexOf('--output')
  return {
    source: sourceIndex >= 0 ? process.argv[sourceIndex + 1] : SOURCE_URL,
    output: outputIndex >= 0 ? resolve(process.cwd(), process.argv[outputIndex + 1]) : OUTPUT,
  }
}

async function readSource(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source)
    if (!response.ok) throw new Error(`SRD monster source returned HTTP ${response.status}`)
    return response.json()
  }
  return JSON.parse(await readFile(resolve(process.cwd(), source), 'utf8'))
}

function slug(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'action'
}

function uniqueActionIds(actions) {
  const used = new Map()
  return actions.map((action) => {
    const base = slug(action.name)
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  })
}

function firstFeet(value) {
  const match = String(value ?? '').match(/(\d+)\s*ft/i)
  return match ? Number(match[1]) : 0
}

function normalizedSpeed(speed = {}) {
  const result = { walk: firstFeet(speed.walk) }
  for (const key of ['fly', 'swim', 'climb', 'burrow']) {
    const feet = firstFeet(speed[key])
    if (feet > 0) result[key] = feet
  }
  if (/hover/i.test(String(speed.fly ?? ''))) result.hover = true
  return result
}

function dice(value) {
  const match = String(value ?? '').replace(/\s+/g, '').match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/i)
  if (!match) return null
  const count = Number(match[1])
  const sides = Number(match[2])
  const bonus = match[3] ? Number(`${match[3]}${match[4]}`) : 0
  return { count, sides, bonus }
}

function damageAverage(parsed) {
  return Math.floor(parsed.count * (parsed.sides + 1) / 2 + parsed.bonus)
}

function normalizedDamage(entries = []) {
  return entries.flatMap((entry) => {
    const parsed = dice(entry?.damage_dice)
    const type = entry?.damage_type?.index
    if (!parsed || !DAMAGE_TYPES.has(type)) return []
    return [{ average: damageAverage(parsed), ...parsed, type }]
  })
}

function attackMode(description) {
  const text = String(description ?? '')
  if (/Melee or Ranged (?:Weapon|Spell) Attack/i.test(text)) return 'melee-or-ranged'
  if (/Ranged (?:Weapon|Spell) Attack/i.test(text)) return 'ranged'
  return 'melee'
}

function normalizedAttack(action) {
  if (!Number.isFinite(action?.attack_bonus)) return null
  const damages = normalizedDamage(action.damage)
  if (damages.length === 0) return null
  const description = String(action.desc ?? '')
  const reach = description.match(/reach\s+(\d+)\s*ft/i)
  const range = description.match(/range\s+(\d+)(?:\/(\d+))?\s*ft/i)
  const target = description.match(/(?:ft\.?,?\s*)([^.]+)\.\s*Hit:/i)?.[1]?.trim() ?? 'one target'
  const result = {
    mode: attackMode(description),
    toHit: Number(action.attack_bonus),
    target,
    damage: damages,
  }
  if (reach) result.reachFeet = Number(reach[1])
  if (range) result.rangeFeet = { normal: Number(range[1]), long: Number(range[2] ?? range[1]) }
  return result
}

function safelyAutomatedWeapon(action, attack) {
  if (!attack || action.dc || action.usage || action.options) return false
  const text = String(action.desc ?? '')
  return !/(saving throw|must succeed|is grappled|escape dc|knocked prone|restrained|poisoned|paralyzed|unconscious|swallow|regains? hit points|reduces? (?:its|the target)|teleport|recharge|until the|at the (?:start|end)|each creature|cone|line that is|radius|area|half of its hit points|damage, or|\bif the\b|if it is|attaches to|is cursed|catches fire|while enlarged|with shillelagh|in (?:small|medium|large|huge|gargantuan) form|one prone creature)/i.test(text)
}

function safelyAutomatedMultiattack(description) {
  return !/(\bcan\b|\bmay\b|\bor\b|\bif\b|form|recharge|uses? its)/i.test(String(description ?? ''))
}

function normalizedActions(rawActions = [], forcedDmAdjudication = false) {
  const ids = uniqueActionIds(rawActions)
  const idByName = new Map(rawActions.map((action, index) => [String(action.name ?? '').toLowerCase(), ids[index]]))
  const actions = rawActions.map((action, index) => {
    const id = ids[index]
    const name = String(action.name ?? 'Unnamed action')
    const description = String(action.desc ?? '')
    if (Array.isArray(action.actions)) {
      const sequence = action.actions.flatMap((child) => {
        const childId = idByName.get(String(child.action_name ?? '').toLowerCase())
        return childId ? Array.from({ length: Math.max(0, Number(child.count) || 0) }, () => childId) : []
      })
      return { id, name, description, kind: 'multiattack', sequence, automation: 'dm-adjudication' }
    }
    const attack = normalizedAttack(action)
    if (attack) {
      return {
        id, name, description, kind: 'weapon-attack', attack,
        automation: !forcedDmAdjudication && safelyAutomatedWeapon(action, attack) ? 'headless' : 'dm-adjudication',
      }
    }
    return { id, name, description, kind: 'other', automation: 'dm-adjudication' }
  })
  for (const action of actions) {
    if (action.kind !== 'multiattack' || action.sequence.length === 0) continue
    const children = action.sequence.map((id) => actions.find((candidate) => candidate.id === id))
    if (safelyAutomatedMultiattack(action.description) && children.every((child) => child?.kind === 'weapon-attack' && child.automation === 'headless')) {
      action.automation = 'headless'
    }
  }
  return actions
}

function normalizedProficiencies(proficiencies = []) {
  const savingThrows = {}
  const skills = []
  for (const item of proficiencies) {
    const index = String(item?.proficiency?.index ?? '')
    const bonus = Number(item?.value)
    if (!Number.isFinite(bonus)) continue
    if (index.startsWith('saving-throw-')) {
      const key = ABILITY_KEYS[index.slice('saving-throw-'.length)]
      if (key) savingThrows[key] = bonus
    } else if (index.startsWith('skill-')) {
      skills.push({ key: index.slice('skill-'.length), name: String(item.proficiency.name ?? index), bonus })
    }
  }
  return {
    ...(Object.keys(savingThrows).length > 0 ? { savingThrows } : {}),
    ...(skills.length > 0 ? { skills } : {}),
  }
}

function normalizedDamageTypes(values = []) {
  return values.map((value) => String(value).toLowerCase()).filter((value) => DAMAGE_TYPES.has(value))
}

function normalizedSenses(senses = {}) {
  const labels = { darkvision: '黑暗视觉', blindsight: '盲视', tremorsense: '震颤感知', truesight: '真实视觉' }
  return Object.entries(senses).flatMap(([key, value]) => {
    if (key === 'passive_perception' || !labels[key]) return []
    const distanceFeet = firstFeet(value)
    return [{ name: labels[key], ...(distanceFeet > 0 ? { distanceFeet } : {}) }]
  })
}

function normalizedLanguages(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '--' || text === '—') return []
  return text.split(',').map((entry) => entry.trim()).filter(Boolean)
}

function challengeRating(value) {
  const number = Number(value)
  if (number === 0.125) return '1/8'
  if (number === 0.25) return '1/4'
  if (number === 0.5) return '1/2'
  return String(number)
}

function normalizedArmorClass(entries = []) {
  const first = entries.find((entry) => Number.isFinite(entry?.value))
  const noteParts = entries.flatMap((entry) => [
    ...(Array.isArray(entry?.armor) ? entry.armor.map((armor) => armor?.name).filter(Boolean) : []),
    ...(entry?.spell?.name ? [entry.spell.name] : []),
  ])
  return { value: Number(first?.value) || 10, ...(noteParts.length ? { note: noteParts.join(', ') } : {}) }
}

function normalizedSpellcasting(abilities = []) {
  const spellcasting = abilities.find((ability) => /spellcasting/i.test(String(ability?.name ?? '')))
  if (!spellcasting) return undefined
  const description = String(spellcasting.desc ?? '')
  const level = description.match(/(\d+)(?:st|nd|rd|th)-level spellcaster/i)
  const ability = description.match(/spellcasting ability is (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i)
  const saveDc = description.match(/spell save DC\s*(\d+)/i)
  const attackBonus = description.match(/([+-]\d+) to hit with spell attacks/i)
  return {
    description,
    ...(level ? { casterLevel: Number(level[1]) } : {}),
    ...(ability ? { ability: ABILITY_KEYS[ability[1].toLowerCase()] } : {}),
    ...(saveDc ? { saveDc: Number(saveDc[1]) } : {}),
    ...(attackBonus ? { attackBonus: Number(attackBonus[1]) } : {}),
    automation: 'dm-adjudication',
  }
}

function normalizedMonster(raw) {
  const type = String(raw.type ?? '')
  const swarm = /^swarm of /i.test(type)
  const baseType = swarm ? 'beast' : type.toLowerCase()
  const subtypes = [raw.subtype, swarm ? '群集' : null].filter(Boolean).map(String)
  const traits = (raw.special_abilities ?? []).map((trait) => ({
    name: String(trait.name ?? 'Unnamed trait'),
    description: String(trait.desc ?? ''),
    automation: 'dm-adjudication',
  }))
  const legendaryResistance = traits.find((trait) => /legendary resistance/i.test(trait.name))
  const legendaryUses = Number(legendaryResistance?.usage?.times ?? legendaryResistance?.name.match(/\((\d+)\/day\)/i)?.[1])
  return {
    id: `srd-5.1:${raw.index}`,
    slug: String(raw.index),
    name: String(raw.name),
    englishName: String(raw.name),
    source: 'SRD 5.1',
    size: SIZE_LABELS[raw.size] ?? '中型',
    creatureType: TYPE_LABELS[baseType] ?? type,
    ...(subtypes.length ? { subtypes } : {}),
    alignment: String(raw.alignment ?? 'unaligned'),
    armorClass: normalizedArmorClass(raw.armor_class),
    hitPoints: { average: Number(raw.hit_points) || 1, dice: String(raw.hit_points_roll ?? raw.hit_dice ?? '1d8') },
    speed: normalizedSpeed(raw.speed),
    abilities: {
      str: Number(raw.strength), dex: Number(raw.dexterity), con: Number(raw.constitution),
      int: Number(raw.intelligence), wis: Number(raw.wisdom), cha: Number(raw.charisma),
    },
    ...normalizedProficiencies(raw.proficiencies),
    damageVulnerabilities: normalizedDamageTypes(raw.damage_vulnerabilities),
    damageResistances: normalizedDamageTypes(raw.damage_resistances),
    damageImmunities: normalizedDamageTypes(raw.damage_immunities),
    conditionImmunities: (raw.condition_immunities ?? []).map((entry) => String(entry?.name ?? entry?.index ?? '')).filter(Boolean),
    senses: normalizedSenses(raw.senses),
    passivePerception: Number(raw.senses?.passive_perception) || 10,
    languages: normalizedLanguages(raw.languages),
    challenge: { rating: challengeRating(raw.challenge_rating), xp: Number(raw.xp) || 0 },
    ...(Number.isFinite(legendaryUses) ? { legendaryResistanceUses: legendaryUses } : {}),
    traits,
    actions: normalizedActions(raw.actions),
    ...(Array.isArray(raw.reactions) && raw.reactions.length > 0
      ? { reactions: normalizedActions(raw.reactions, true) }
      : {}),
    ...(Array.isArray(raw.legendary_actions) && raw.legendary_actions.length > 0
      ? { legendaryActions: normalizedActions(raw.legendary_actions, true) }
      : {}),
    ...(normalizedSpellcasting(raw.special_abilities) ? { spellcasting: normalizedSpellcasting(raw.special_abilities) } : {}),
    capabilities: {
      swarm,
      shapechanger: /shapechanger/i.test(String(raw.subtype ?? '')),
      regeneration: traits.some((trait) => /regeneration/i.test(trait.name)),
      spellcaster: !!normalizedSpellcasting(raw.special_abilities),
      legendary: Array.isArray(raw.legendary_actions) && raw.legendary_actions.length > 0,
      hasFlySpeed: firstFeet(raw.speed?.fly) > 0,
      hasSwimSpeed: firstFeet(raw.speed?.swim) > 0,
    },
    description: `${raw.name} — SRD 5.1 monster stat block.`,
  }
}

const { source, output } = args()
const raw = await readSource(source)
if (!Array.isArray(raw) || raw.length < 300) throw new Error(`Expected at least 300 SRD monsters, received ${Array.isArray(raw) ? raw.length : 'non-array'}`)
const monsters = raw.map(normalizedMonster).sort((left, right) => left.englishName.localeCompare(right.englishName, 'en'))
const ids = new Set(monsters.map((monster) => monster.id))
if (ids.size !== monsters.length) throw new Error('Generated monster ids are not unique')

const artifact = {
  schemaVersion: 1,
  source: {
    rules: 'System Reference Document 5.1',
    rulesUrl: 'https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf',
    license: 'CC BY 4.0',
    transcription: '5e-bits/5e-database',
    transcriptionCommit: SOURCE_COMMIT,
    transcriptionUrl: SOURCE_URL,
  },
  count: monsters.length,
  monsters,
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(`Generated ${monsters.length} SRD monsters -> ${output}`)
