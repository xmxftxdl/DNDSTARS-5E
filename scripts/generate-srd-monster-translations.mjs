import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_PATH = resolve(ROOT, 'src/rulesets/dnd5e/generated/srdMonsters.generated.json')
const REVIEWED_PATH = resolve(ROOT, 'content/srd51/monsters.zh.reviewed.json')
const TERMS_PATH = resolve(ROOT, 'content/srd51/monster-terms.zh.json')
const NAMES_PATH = resolve(ROOT, 'content/srd51/monster-names.zh.json')
const RULE_NAMES_PATH = resolve(ROOT, 'content/srd51/monster-rule-names.zh.json')
const WORKBOOK_PATH = resolve(ROOT, 'tmp/srd51-monsters.zh.workbook.json')
const OUTPUT_PATH = resolve(ROOT, 'src/rulesets/dnd5e/generated/srdMonsterTranslationsZh.reviewed.generated.json')
const SPELLS_REVIEWED_PATH = resolve(ROOT, 'content/srd51/spells.zh.reviewed.json')
const EXPECTED_COUNT = 334

function cliArgs() {
  return {
    emitReviewed: process.argv.includes('--emit-reviewed'),
    emit: process.argv.includes('--emit'),
  }
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
}

function translatableAction(action) {
  return { id: action.id, englishName: action.name, descriptionEnglish: action.description }
}

function workbookTranslatedRows(sourceRows, reviewedRows = [], monster) {
  const reviewedById = new Map(reviewedRows.map((row) => [String(row.id ?? row.index), row]))
  return sourceRows.map((row) => {
    const stableId = String(row.id ?? row.index)
    return {
      ...(row.id !== undefined ? { id: row.id } : { index: row.index }),
      name: ruleNames[row.englishName] ?? '',
      description: reviewedById.get(stableId)?.description
        ?? controlledMonsterText(row.descriptionEnglish, monster)
        ?? '',
    }
  })
}

const damageTerms = {
  acid: '强酸', bludgeoning: '钝击', cold: '冷冻', fire: '火焰', force: '力场', lightning: '闪电',
  necrotic: '黯蚀', piercing: '穿刺', poison: '毒素', psychic: '心灵', radiant: '光耀', slashing: '挥砍', thunder: '雷鸣',
}

const abilityTerms = {
  Strength: '力量', Dexterity: '敏捷', Constitution: '体质', Intelligence: '智力', Wisdom: '感知', Charisma: '魅力',
}

function translateDamageSequence(source) {
  let text = source
  text = text.replace(/(\d+(?: \([^)]*\))?) (acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder) damage/g,
    (_, amount, type) => `${amount} 点${damageTerms[type]}伤害`)
  text = text.replace(/ plus /g, '，外加 ').replace(/ or /g, '，或造成 ')
  return /[A-Za-z]{2,}/.test(text.replace(/\d+d\d+/g, '')) ? undefined : text
}

function translateTarget(source) {
  const fixed = ({
    'one target': '单一目标',
    'one creature': '单一生物',
    'one creature or object': '单一生物或物体',
    'one prone creature': '单一倒地生物',
    'one willing creature': '单一自愿生物',
    'one Large or smaller creature': '单一大型或更小的生物',
    'one Medium or smaller creature': '单一中型或更小的生物',
    "one creature in the swarm's space": '群集空间内的单一生物',
    "one target in the swarm's space": '群集空间内的单一目标',
  })[source]
  if (fixed) return fixed
  if (/^one target not grappled by the [a-z -]+$/.test(source)) return '未被攻击者擒抱的单一目标'
  return undefined
}

function translateSpellcastingDescription(source, monster) {
  if (!source || !monster?.spellcasting || source !== monster.spellcasting.description) return undefined
  const actor = monsterNames[monster.slug]
  let text = source

  const spellEntries = Object.entries(spellsReviewed)
    .map(([id, spell]) => ({ id, english: monster.spellcasting.spells.find((entry) => entry.id === id)?.name, chinese: spell.name }))
    .filter((entry) => entry.english && entry.chinese)
    .sort((a, b) => b.english.length - a.english.length)
  for (const { english, chinese } of spellEntries) {
    text = text.replace(new RegExp(`\\b${english.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi'), chinese)
  }

  text = text
    .replace(/^The [^.]+ is an? (\d+)(?:st|nd|rd|th)-level spellcaster\./, `${actor}是一名 $1 级施法者。`)
    .replace(/^The [^']+'s innate spell ?casting ability is (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/, `${actor}的天生施法关键属性为 $1`)
    .replace(/^The [^']+'s spell ?casting ability is (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/, `${actor}的施法关键属性为 $1`)
    .replace(/Its spell ?casting ability is (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/g, '其施法关键属性为 $1')
    .replace(/Its innate spellcasting ability is (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/g, '其天生施法关键属性为 $1')

  for (const [english, chinese] of Object.entries(abilityTerms)) text = text.replaceAll(english, chinese)

  text = text
    .replace(/\(spell save DC (\d+), ([+-]\d+) to hit with spell attacks\)/g, '（法术豁免 DC $1，法术攻击命中 $2）')
    .replace(/\(spell save DC (\d+)\)/g, '（法术豁免 DC $1）')
    .replace(/\(spell save DC (\d+), ([+-]\d+) to hit with ranged spell attacks\)/g, '（法术豁免 DC $1，远程法术攻击命中 $2）')
    .replace(/It can innately cast the following spells, requiring no material components:/g, '它可以天生施展以下法术，无需材料成分：')
    .replace(/It can innately cast the following spells, requiring no components:/g, '它可以天生施展以下法术，无需任何成分：')
    .replace(/(?:The [^.]+|She) can innately cast the following spells, requiring no material components:/g, `${actor}可以天生施展以下法术，无需材料成分：`)
    .replace(/(?:The [^.]+|It) can innately cast the following spells, requiring only verbal components:/g, `${actor}可以天生施展以下法术，且只需言语成分：`)
    .replace(/It can innately cast the following spells, requiring no material components\./g, '它可以天生施展以下法术，无需材料成分。')
    .replace(/The [^.]+ can innately cast the following spells, requiring no components:/g, `${actor}可以天生施展以下法术，无需任何成分：`)
    .replace(/It requires no material components to cast its spells\./g, '它施展这些法术时无需材料成分。')
    .replace(/, and it needs only verbal components to cast its spells\./g, '，且施展这些法术时只需言语成分。')
    .replace(/The [^.]+ can cast ([^.]*) at will and has the following wizard spells prepared:/g, `${actor}可以随意施展 $1，并准备了以下法师法术：`)
    .replace(/(?:The [^.]+|It) has (?:the )?following (cleric|druid|wizard) spells prepared:/g, (_, list) => `${actor}准备了以下${({ cleric: '牧师', druid: '德鲁伊', wizard: '法师' })[list]}法术：`)
    .replace(/The mephit can innately cast ([^(,.]+)( \(spell save DC \d+\))?, requiring no material components\./g, (_, spell, dc = '') => `${actor}可以天生施展 ${spell}${dc}，无需材料成分。`)
    .replace(/At will:/g, '随意：')
    .replace(/(\d+)\/day each:/g, '每日各 $1 次：')
    .replace(/(\d+)\/day:/g, '每日 $1 次：')
    .replace(/- Cantrips \(at will\):/g, '- 戏法（随意）：')
    .replace(/Cantrips \(at will\):/g, '戏法（随意）：')
    .replace(/- (\d+)(?:st|nd|rd|th) level \((\d+) slots?\):/g, '- $1 环（$2 个法术位）：')
    .replace(/\(self only\)/g, '（仅自身）')
    .replace(/\(any humanoid form\)/g, '（任意人形生物形态）')
    .replace(/\(air elemental only\)/g, '（仅限风元素）')
    .replace(/\(fire elemental only\)/g, '（仅限火元素）')
    .replace(/\(can create wine instead of water\)/g, '（可以改为创造葡萄酒而非水）')
    .replace(/\* The archmage casts these spells on itself before combat\./g, `* ${actor}会在战斗前对自己施展这些法术。`)

  text = text.split('\n').map((line) => {
    if (/^(?:- |随意：|每日)/.test(line)) return line.replace(/, /g, '、')
    return line
  }).join('\n')
  text = text
    .replace(/ and /g, '与')
    .replace(/, /g, '、')
    .replace(/\s+(?=[\u3400-\u9fff（])/g, '')
    .replace(/(?<=[\u3400-\u9fff）。])\s+/g, '')
    .replace(/\s+([，。：])/g, '$1')
    .replace(/([（])\s+/g, '$1')
    .replace(/\s+([）])/g, '$1')
    .replace(/\. /g, '。')
    .replace(/\.$/g, '。')

  if (/[A-Za-z]{2,}/.test(text.replaceAll('DC', ''))) {
    if (process.env.DEBUG_MONSTER_SPELLCASTING === monster.slug) console.error(text)
    return undefined
  }
  return text
}

function attackPrefix(match, target) {
  const [, mode, kind, bonus, , reachOnly, rangeOnly, mixedReach, mixedRange] = match
  const attackKind = `${mode === 'Melee' ? '近战' : mode === 'Ranged' ? '远程' : '近战或远程'}${kind === 'Weapon' ? '武器' : '法术'}攻击`
  const distance = reachOnly ? `触及 ${reachOnly} 尺`
    : rangeOnly ? `射程 ${rangeOnly} 尺`
      : `触及 ${mixedReach} 尺或射程 ${mixedRange} 尺`
  return `${attackKind}：命中 ${bonus}，${distance}，${target}。命中：`
}

function translateAttackText(source) {
  const match = source.match(/^(Melee|Ranged|Melee or Ranged) (Weapon|Spell) Attack: ([+-]\d+) to hit, (reach ([\d/]+) ft\.|range ([\d/]+) ft\.|reach ([\d/]+) ft\. or range ([\d/]+) ft\.), ([^.]+)\. Hit: (.+)\.$/s)
  if (!match) return undefined
  const [, mode, kind, bonus, , reachOnly, rangeOnly, mixedReach, mixedRange, targetEnglish, hitEnglish] = match
  const target = translateTarget(targetEnglish)
  const hit = translateDamageSequence(hitEnglish)
  if (!target || !hit) return undefined
  return `${attackPrefix(match, target)}${hit}。`
}

function translateAttackWithEffects(source, actor) {
  const match = source.match(/^(Melee|Ranged|Melee or Ranged) (Weapon|Spell) Attack: ([+-]\d+) to hit, (reach ([\d/]+) ft\.|range ([\d/]+) ft\.|reach ([\d/]+) ft\. or range ([\d/]+) ft\.), ([^.]+)\. Hit: (.+)$/s)
  if (!match) return undefined
  const target = translateTarget(match[9])
  if (!target) return undefined
  const hit = match[10]
  let effect
  let body

  effect = hit.match(/^The target must make a DC (\d+) Constitution saving throw, taking (\d+ \([^)]+\)) poison damage on a failed save, or half as much damage on a successful one\.$/)
  if (effect) body = `目标必须进行一次 DC ${effect[1]} 的体质豁免；失败时受到 ${effect[2]} 点毒素伤害，成功时伤害减半。`

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage)\. If the target is a creature, it must succeed on a DC (\d+) Strength saving throw or be knocked prone\.$/)
  if (effect && damageTerms[effect[2]]) {
    body = `${effect[1].replace(`${effect[2]} damage`, `点${damageTerms[effect[2]]}伤害`)}。如果目标是生物，它必须通过一次 DC ${effect[3]} 的力量豁免，否则倒地。`
  }

  effect ??= hit.match(/^(\d+ \([^)]+\) (\w+) damage),? or (\d+ \([^)]+\) \w+ damage) if used with two hands(?: to make a melee attack)?\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    const first = translateDamageSequence(effect[1])
    const second = translateDamageSequence(effect[3])
    if (first && second) body = `${first}；若以双手发动近战攻击，则造成 ${second}。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage) in melee or (\d+ \([^)]+\) \w+ damage) at range\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `近战时造成 ${translateDamageSequence(effect[1])}；远程时造成 ${translateDamageSequence(effect[3])}。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage), or (\d+ \([^)]+\) \w+ damage) if the swarm has half of its hit points or fewer\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `${translateDamageSequence(effect[1])}；若该群集当前生命值不高于其生命值上限的一半，则改为 ${translateDamageSequence(effect[3])}。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage), and the target must make a DC (\d+) Constitution saving throw, taking (\d+ \([^)]+\)) poison damage on a failed save, or half as much damage on a successful one\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `${translateDamageSequence(effect[1])}，且目标必须进行一次 DC ${effect[3]} 的体质豁免；失败时受到 ${effect[4]} 点毒素伤害，成功时伤害减半。`
  }

  effect = hit.match(/^(\d+(?: \([^)]+\))? (\w+) damage), and the target must (?:make|succeed on) a DC (\d+) Constitution saving throw,? (?:taking|or take) (\d+ \([^)]+\)) poison damage on a failed save, or half as much damage on a successful one\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `${translateDamageSequence(effect[1])}，且目标必须进行一次 DC ${effect[3]} 的体质豁免；失败时受到 ${effect[4]} 点毒素伤害，成功时伤害减半。`
  }

  effect = hit.match(/^(\d+(?: \([^)]+\))? (\w+) damage), and the target must succeed on a DC (\d+) Constitution saving throw or take (\d+ \([^)]+\)) poison damage\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `${translateDamageSequence(effect[1])}，且目标必须通过一次 DC ${effect[3]} 的体质豁免，否则受到 ${effect[4]} 点毒素伤害。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage), and the target must (?:make|succeed on) a DC (\d+) Constitution saving throw,? (?:taking|or take) (\d+ \([^)]+\)) poison damage on a failed save, or half as much damage on a successful one\. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour, even after regaining hit points, and is paralyzed while poisoned in this way\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `${translateDamageSequence(effect[1])}，且目标必须进行一次 DC ${effect[3]} 的体质豁免；失败时受到 ${effect[4]} 点毒素伤害，成功时伤害减半。如果该毒素伤害使目标降至 0 点生命值，目标陷入稳定，但中毒 1 小时；即使恢复生命值后也依然如此，且以此方式中毒时陷入麻痹。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage), and the target is grappled \(escape DC (\d+)\)\. Until this grapple ends, (?:the creature|the target) is restrained, and the [a-z -]+ can't (constrict|bite|use its talons on) another target\.?$/)
  if (!body && effect && damageTerms[effect[2]]) {
    const blockedAction = effect[4] === 'constrict' ? '缠绕' : effect[4] === 'bite' ? '啮咬' : '爪击'
    body = `${translateDamageSequence(effect[1])}，且目标被擒抱（逃脱 DC ${effect[3]}）。擒抱结束前，目标陷入束缚，且${actor}无法对另一个目标使用${blockedAction}。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage), and the target is grappled \(escape DC (\d+)\)\. The [a-z -]+ has two claws, each of which can grapple only one target\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `${translateDamageSequence(effect[1])}，且目标被擒抱（逃脱 DC ${effect[3]}）。${actor}有两只螯肢，每只螯肢只能擒抱一个目标。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage)\. If the target is a creature other than an elf or undead, it must succeed on a DC (\d+) Constitution saving throw or be paralyzed for 1 minute\. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `${translateDamageSequence(effect[1])}。如果目标是精灵或不死生物以外的生物，它必须通过一次 DC ${effect[3]} 的体质豁免，否则麻痹 1 分钟。目标可以在其每个回合结束时重新进行豁免，成功时结束自身效应。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage plus \d+ \([^)]+\) poison damage), and the target must succeed on a DC (\d+) Constitution saving throw or become poisoned for 1 minute\. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `${translateDamageSequence(effect[1])}，且目标必须通过一次 DC ${effect[3]} 的体质豁免，否则中毒 1 分钟。目标可以在其每个回合结束时重新进行豁免，成功时结束自身效应。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage)\. If the target is a humanoid, it must succeed on a DC (\d+) Constitution saving throw or be cursed with (werebear|wereboar|wererat|weretiger|werewolf) lycanthropy\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    const curse = ({ werebear: '熊人', wereboar: '野猪人', wererat: '鼠人', weretiger: '虎人', werewolf: '狼人' })[effect[4]]
    body = `${translateDamageSequence(effect[1])}。如果目标是人形生物，它必须通过一次 DC ${effect[3]} 的体质豁免，否则遭受${curse}兽化诅咒。`
  }

  effect = hit.match(/^(\d+ \([^)]+\) (\w+) damage)\. If the target is a flammable object that isn't being worn or carried, it also catches fire\.$/)
  if (!body && effect && damageTerms[effect[2]]) {
    body = `${translateDamageSequence(effect[1])}。如果目标是未被穿戴或携带的可燃物体，它还会被点燃。`
  }

  return body ? `${attackPrefix(match, target)}${body}` : undefined
}

function translateDragonBreathWeapons(source) {
  if (!/^The dragon uses one of the following breath weapons[.:]\n/.test(source)) return undefined
  const entries = source.split('\n').slice(1)
  const labels = {
    'Acid Breath': '强酸吐息', 'Cold Breath': '冷冻吐息', 'Fire Breath': '火焰吐息',
    'Lightning Breath': '闪电吐息', 'Sleep Breath': '睡眠吐息', 'Repulsion Breath': '斥力吐息',
    'Slowing Breath': '迟缓吐息', 'Weakening Breath': '衰弱吐息', 'Paralyzing Breath': '麻痹吐息',
  }
  const translated = []
  for (const entry of entries) {
    const split = entry.match(/^([A-Za-z ]+)\. (.+)$/s)
    if (!split || !labels[split[1]]) return undefined
    const [, label, rule] = split
    let match = rule.match(/^The dragon exhales (acid|fire|lightning|an icy blast) in an? (\d+)-foot (line that is (\d+) feet wide|cone)\. Each creature in that (?:line|area) must make a DC (\d+) (Dexterity|Constitution) saving throw, taking (\d+ \([^)]+\)) (acid|fire|lightning|cold) damage on a failed save, or half as much damage on a successful one\.$/)
    if (match) {
      const [, substance, length, shape, width, dc, ability, amount, type] = match
      const substanceZh = ({ acid: '强酸', fire: '火焰', lightning: '闪电', 'an icy blast': '寒冰气流' })[substance]
      const area = shape === 'cone' ? `${length} 尺锥状区域` : `一道长 ${length} 尺、宽 ${width} 尺的线状区域`
      translated.push(`${labels[label]}。该龙向${area}喷吐${substanceZh}。区域内每个生物都必须进行一次 DC ${dc} 的${abilityTerms[ability]}豁免；失败时受到 ${amount} 点${damageTerms[type]}伤害，成功时伤害减半。`)
      continue
    }
    match = rule.match(/^The dragon exhales sleep gas in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Constitution saving throw or fall unconscious for (\d+) minutes?\. This effect ends for a creature if the creature takes damage or someone uses an action to wake it\.$/)
    if (match) {
      translated.push(`${labels[label]}。该龙向 ${match[1]} 尺锥状区域喷吐睡眠气体。区域内每个生物都必须通过一次 DC ${match[2]} 的体质豁免，否则陷入昏迷 ${match[3]} 分钟。若该生物受到伤害，或有人使用一个动作将其唤醒，此效应结束。`)
      continue
    }
    match = rule.match(/^The dragon exhales repulsion energy in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Strength saving throw\. On a failed save, the creature is pushed (\d+) feet away from the dragon\.$/)
    if (match) {
      translated.push(`${labels[label]}。该龙向 ${match[1]} 尺锥状区域喷吐斥力能量。区域内每个生物都必须进行一次 DC ${match[2]} 的力量豁免；失败时被推离该龙 ${match[3]} 尺。`)
      continue
    }
    match = rule.match(/^The dragon exhales gas in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Constitution saving throw\. On a failed save, the creature can't use reactions, its speed is halved, and it can't make more than one attack on its turn\. In addition, the creature can use either an action or a bonus action on its turn, but not both\. These effects last for 1 minute\. The creature can repeat the saving throw at the end of each of its turns, ending the effect on itself with a successful save\.$/)
    if (match) {
      translated.push(`${labels[label]}。该龙向 ${match[1]} 尺锥状区域喷吐气体。区域内每个生物都必须进行一次 DC ${match[2]} 的体质豁免。失败时，该生物无法使用反应，速度减半，且在其回合内至多发动一次攻击；此外，它在回合内只能使用动作或附赠动作之一，不能两者都用。这些效应持续 1 分钟。该生物可以在其每个回合结束时重新进行豁免，成功时结束自身效应。`)
      continue
    }
    match = rule.match(/^The dragon exhales gas in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Strength saving throw or have disadvantage on Strength-based attack rolls, Strength checks, and Strength saving throws for 1 minute\. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success\.$/)
    if (match) {
      translated.push(`${labels[label]}。该龙向 ${match[1]} 尺锥状区域喷吐气体。区域内每个生物都必须通过一次 DC ${match[2]} 的力量豁免，否则在 1 分钟内，使用力量的攻击检定、力量检定与力量豁免均具有劣势。该生物可以在其每个回合结束时重新进行豁免，成功时结束自身效应。`)
      continue
    }
    match = rule.match(/^The dragon exhales paralyzing gas in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Constitution saving throw or be paralyzed for 1 minute\. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success\.$/)
    if (match) {
      translated.push(`${labels[label]}。该龙向 ${match[1]} 尺锥状区域喷吐麻痹气体。区域内每个生物都必须通过一次 DC ${match[2]} 的体质豁免，否则麻痹 1 分钟。该生物可以在其每个回合结束时重新进行豁免，成功时结束自身效应。`)
      continue
    }
    return undefined
  }
  return `该龙使用以下吐息武器之一。\n${translated.join('\n')}`
}

function controlledMonsterText(source, monster) {
  if (!source || !monster) return undefined
  const spellcasting = translateSpellcastingDescription(source, monster)
  if (spellcasting) return spellcasting
  const actor = monsterNames[monster.slug]
  const trimmedSource = source.trim()
  const attackSource = trimmedSource.endsWith('.') ? trimmedSource : `${trimmedSource}.`
  const attack = translateAttackText(attackSource) ?? translateAttackWithEffects(attackSource, actor)
  if (attack) return attack
  const breathWeapons = translateDragonBreathWeapons(source)
  if (breathWeapons) return breathWeapons
  let match
  const actionPhraseTerms = {
    bite: '啃咬', claw: '爪击', claws: '爪击', fist: '拳击', slam: '猛击',
    greatsword: '巨剑', greatclub: '巨棒', longsword: '长剑', shortsword: '短剑',
    tentacle: '触手', tail: '尾击', greataxe: '巨斧', scimitar: '弯刀', longbow: '长弓',
    stomp: '践踏', gore: '顶撞', hooves: '蹄击', ram: '冲撞', pike: '长枪', horn: '角撞', tusk: '獠牙', tusks: '獠牙',
    beak: '啼击', talons: '爪击', sting: '蜤针', whip: '长鞭', dagger: '匕首',
    spear: '长矛', beard: '胡须', glaive: '长柄刀', chain: '锁链', chains: '锁链',
    pincer: '螯肢', pincers: '螯肢', rotting: '腐烂拳击', unarmed: '徒手打击',
    morningstar: '晨星锤', quarterstaff: '长棍', mace: '钉头锤', hammer: '战锤',
  }
  const exact = {
    "Magical darkness doesn't impede the devil's darkvision.": '魔法黑暗不会妨碍该魔鬼的黑暗视觉。',
    'The devil has advantage on saving throws against spells and other magical effects.': '该魔鬼对抗法术和其他魔法效应的豁免具有优势。',
    'The golem is immune to any spell or effect that would alter its form.': '该魔像免疫任何会改变其形态的法术或效应。',
    'The golem has advantage on saving throws against spells and other magical effects.': '该魔像对抗法术和其他魔法效应的豁免具有优势。',
    "The golem's weapon attacks are magical.": '该魔像的武器攻击视为魔法攻击。',
    'The spider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.': '该蜘蛛无需进行属性检定即可攀爬困难表面，包括倒挂在天花板上。',
    'The spider ignores movement restrictions caused by webbing.': '该蜘蛛忽略蛛网造成的移动限制。',
    'The vampire can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.': '该吸血鬼无需进行属性检定即可攀爬困难表面，包括倒挂在天花板上。',
    'The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, difficult terrain composed of ice or snow doesn\'t cost it extra movement.': '该龙无需进行属性检定即可在冰面上移动或攀爬。此外，由冰雪构成的困难地形不会使它花费额外移动力。',
    'The swarm can occupy another creature\'s space and vice versa, and the swarm can move through any opening large enough for a Tiny insect. The swarm can\'t regain hit points or gain temporary hit points.': '该群集可以占据其他生物的空间，其他生物也可以占据该群集的空间；该群集能穿过任何足以让微型昆虫通过的开口。该群集无法恢复生命值，也无法获得临时生命值。',
  }
  if (exact[source]) return exact[source]
  if (/^The [a-z -]+ can breathe air and water\.$/.test(source)) {
    return `${actor}可以呼吸空气和水。`
  }
  if (source === 'If the dragon fails a saving throw, it can choose to succeed instead.') {
    return '如果该龙一次豁免失败，它可以选择改为成功。'
  }
  if (source === 'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.') {
    return '该龙可以使用骇人威仪，随后发动三次攻击：一次啃咬与两次爪击。'
  }
  if (source === 'The dragon makes three attacks: one with its bite and two with its claws.') {
    return '该龙发动三次攻击：一次啃咬与两次爪击。'
  }
  if (source === 'The dragon makes a Wisdom (Perception) check.') return '该龙进行一次感知（察觉）检定。'
  if (source === 'The aboleth makes a Wisdom (Perception) check.') return '底栖魔鱼进行一次感知（察觉）检定。'
  if (source === 'The dragon makes a tail attack.') return '该龙发动一次尾击。'
  if (source === 'The aboleth makes one tail attack.') return '底栖魔鱼发动一次尾击。'

  if (/^If the [a-z -]+ fails a saving throw, it can choose to succeed instead\.$/.test(source)) {
    return `如果${actor}一次豁免失败，它可以选择改为成功。`
  }

  if (source.startsWith('The dragon magically polymorphs into a humanoid or beast that has a challenge rating no higher than its own,')) {
    return '该龙魔法般变成挑战等级不高于它自身的人形生物或野兽，或变回其真实形态。它死亡时会恢复真实形态。它穿戴或携带的任何装备会被新形态吸收，或由新形态继续穿戴或携带（由该龙选择）。\n在新形态中，该龙保留其阵营、生命值、生命骰、说话能力、熟练项、传奇抗性、巢穴动作、智力、感知与魅力属性值，以及此动作。除此以外，其数据与能力均替换为新形态的数据与能力，但不获得新形态的职业特性或传奇动作。'
  }

  match = source.match(/^The [a-z -]+ is incapacitated while in the area of an antimagic field\. If targeted by dispel magic, the [a-z -]+ must succeed on a Constitution saving throw against the caster's spell save DC or fall unconscious for 1 minute\.$/)
  if (match) return `${actor}处于反魔法力场的区域内时陷入失能。如果成为魔法解除的目标，它必须进行一次对抗施法者法术豁免 DC 的体质豁免，失败时昏迷 1 分钟。`

  match = source.match(/^The [a-z -]+ magically teleports, along with any equipment it is wearing or carrying, up to (\d+) (?:ft\.|feet) to an unoccupied space it can see\.$/)
  if (match) return `${actor}连同其穿戴或携带的任何装备，魔法般传送至多 ${match[1]} 尺，到达它能看见的一处未占据空间。`
  match = source.match(/^The [a-z -]+ magically teleports, along with any equipment it is wearing or carrying, up to (\d+) ft\. to an unoccupied space it can see\. Before or after teleporting, the [a-z -]+ can make one bite attack\.$/)
  if (match) return `${actor}连同其穿戴或携带的任何装备，魔法般传送至多 ${match[1]} 尺，到达它能看见的一处未占据空间。它可以在传送前或传送后发动一次啮咬攻击。`

  match = source.match(/^The [a-z -]+ adds (\d+) to its AC against one melee attack that would hit it\. To do so, the [a-z -]+ must see the attacker and be wielding a melee weapon\.$/)
  if (match) return `${actor}将自己对一次原本会命中的近战攻击的 AC 提高 ${match[1]}。它必须能看见攻击者，且正持用一件近战武器。`

  if (/^The [a-z -]+ has advantage on melee attack rolls against any creature that doesn't have all its hit points\.$/.test(source)) {
    return `${actor}对生命值未满的任何生物发动近战攻击时，攻击检定具有优势。`
  }

  match = source.match(/^The [a-z -]+'s long jump is up to (\d+) ft\. and its high jump is up to (\d+) ft\., with or without a running start\.$/)
  if (match) return `无论是否助跑，${actor}都能跳远至多 ${match[1]} 尺，跳高至多 ${match[2]} 尺。`

  if (/^The [a-z -]+ can move through other creatures and objects as if they were difficult terrain\. It takes \d+ \([^)]+\) force damage if it ends its turn inside an object\.$/.test(source)) {
    match = source.match(/It takes (\d+ \([^)]+\)) force damage/)
    return `${actor}可以穿过其他生物和物体，并将其视为困难地形。如果它在物体内结束回合，则受到 ${match[1]} 点力场伤害。`
  }

  if (/^The [a-z -]+ moves up to its speed without provoking opportunity attacks\.$/.test(source)) {
    return `${actor}可以移动至多等于其速度的距离，且不会引发借机攻击。`
  }
  match = source.match(/^When the [a-z -]+ reduces a creature to 0 hit points with a melee attack on its turn, the [a-z -]+ can take a bonus action to move up to half its speed and make a bite attack\.$/)
  if (match) return `当${actor}在自己的回合中用近战攻击使一个生物降至 0 点生命值时，它可以使用一个附赠动作，移动至多等于其速度一半的距离，并发动一次啮咬攻击。`
  if (/^The goblin can take the Disengage or Hide action as a bonus action on each of its turns\.$/.test(source)) return '地精可以在其每个回合中，使用一个附赠动作执行脱离或藏匿动作。'
  if (/^As a bonus action, the orc can move up to its speed toward a hostile creature that it can see\.$/.test(source)) return '半兽人可以使用一个附赠动作，向它能看见的敌对生物移动至多等于其速度的距离。'
  if (/^The elemental can burrow through nonmagical, unworked earth and stone\./.test(source)) return '该元素可以在非魔法且未经加工的泥土与石材中挖掘移动。以此方式移动时，它不会扰动所穿过的材料。'
  if (/^The grimlock can't use its blindsight while deafened and unable to smell\.$/.test(source)) return '恐爪怪在耳聋且无法嗅闻时，无法使用盲视。'
  if (/^The mule is considered to be a Large animal for the purpose of determining its carrying capacity\.$/.test(source)) return '在确定运载能力时，骡子被视为大型动物。'
  match = source.match(/^With a (\d+)-foot running start, the [a-z -]+ can long jump up to (\d+) ft\.\.$/)
  if (match) return `${actor}助跑 ${match[1]} 尺后，可以跳远至多 ${match[2]} 尺。`
  if (/^When a jelly that is Medium or larger is subjected to lightning or slashing damage, it splits into two new jellies/.test(source)) return '当一只中型或更大的果冻怪受到闪电或挥砍伤害时，如果它至少还有 10 点生命值，便分裂成两只新的果冻怪。每只新果冻怪的生命值等于原果冻怪当前生命值的一半，向下取整。新果冻怪的体型比原果冻怪小一级。'
  if (/^If damage reduces the zombie to 0 hit points, it must make a Constitution saving throw with a DC of 5\+the damage taken/.test(source)) return '如果伤害使僵尸降至 0 点生命值，除非该伤害为光耀伤害或来自暴击，否则僵尸必须进行一次体质豁免，DC 等于 5＋所受伤害值。成功时，僵尸改为降至 1 点生命值。'
  if (/^The [a-z -]+ makes one unarmed strike\.$/.test(source)) return `${actor}发动一次徒手打击。`
  if (/^The [a-z -]+ makes two melee attacks\.$/.test(source)) return `${actor}发动两次近战攻击。`
  if (/^The [a-z -]+ makes two ranged attacks\.$/.test(source)) return `${actor}发动两次远程攻击。`
  if (/^The lizardfolk makes two melee attacks, each one with a different weapon\.$/.test(source)) return '蜥蜴人发动两次近战攻击，且每次必须使用不同的武器。'
  if (/^The scout makes two melee attacks or two ranged attacks\.$/.test(source)) return '斟候发动两次近战攻击或两次远程攻击。'
  if (/^The veteran makes two longsword attacks\./.test(source)) return '老兵发动两次长剑攻击。如果它已拔出短剑，还可以发动一次短剑攻击。'
  if (/^The fungus makes 1d4 Rotting Touch attacks\.$/.test(source)) return '该真菌发动 1d4 次腐烂之触攻击。'
  if (/^In bear form, the werebear makes two claw attacks\./.test(source)) return '熊人在熊形态下发动两次爪击；在人形态下发动两次巨斧攻击；在混种形态下，可以像熊形态或人形态那样攻击。'
  if (/^In humanoid form, the weretiger makes two scimitar attacks or two longbow attacks\./.test(source)) return '虎人在人形态下发动两次弯刀攻击或两次长弓攻击；在混种形态下，可以像人形态那样攻击，或发动两次爪击。'
  if (/^The werewolf makes two attacks: two with its spear/.test(source)) return '狼人发动两次攻击：在人形态下发动两次长矛攻击，或在混种形态下发动一次啮咬与一次爪击。'
  if (/^The captain makes three melee attacks: two with its scimitar and one with its dagger\. Or the captain makes two ranged attacks with its daggers\.$/.test(source)) return '强盗队长发动三次近战攻击：两次弯刀攻击与一次匕首攻击；或用匕首发动两次远程攻击。'
  if (/^The [a-z -]+ makes two scimitar attacks or uses its Hurl Flame twice\.$/.test(source)) return `${actor}发动两次弯刀攻击，或使用两次掷火。`
  if (/^The drider makes three attacks, either with its longsword or its longbow\. It can replace one of those attacks with a bite attack\.$/.test(source)) return '蛛化精灵使用长剑或长弓发动三次攻击。它可以将其中一次替换为啮咬攻击。'
  if (/^The grick makes one attack with its tentacles\./.test(source)) return '格利克怪用触手发动一次攻击。如果该攻击命中，它可以对同一目标再发动一次啼击攻击。'

  match = source.match(/^The [a-z -]+ touches another creature\. The target magically regains (\d+ \([^)]+\)) hit points and is freed from any curse, disease, poison, blindness, or deafness\.$/)
  if (match) return `${actor}触碰另一个生物。目标魔法般恢复 ${match[1]} 点生命值，并解除其身上的任何诅咒、疾病、中毒、目盲或耳聋。`

  match = source.match(/^The [a-z -]+ can hold its breath for (\d+) hours?\.$/)
  if (match) return `${actor}可以屏息 ${match[1]} 小时。`
  if (/^The [a-z -]+ knows if it hears a lie\.$/.test(source)) return `${actor}听到谎言时会知道那是谎言。`
  if (/^The [a-z -]+ has advantage on saving throws against being frightened\.$/.test(source)) return `${actor}对抗恐慌的豁免具有优势。`
  if (/^The [a-z -]+ has advantage on Strength and Dexterity saving throws made against effects that would knock it prone\.$/.test(source)) return `${actor}对抗会使其倒地的效应时，力量与敏捷豁免具有优势。`
  match = source.match(/^Once per turn, the [a-z -]+ can deal an extra (\d+ \([^)]+\)) damage to a creature it hits with a weapon attack if that creature is within 5 ft\. of an ally of the [a-z -]+ that isn't incapacitated\.$/)
  if (match) return `每回合一次，如果${actor}用武器攻击命中一个生物，且该生物 5 尺内有一名未陷入失能的${actor}盟友，该攻击额外造成 ${match[1]} 点伤害。`
  match = source.match(/^The hound exhales fire in a (\d+)-foot cone\. Each creature in that area must make a DC (\d+) Dexterity saving throw, taking (\d+ \([^)]+\)) fire damage on a failed save, or half as much damage on a successful one\.$/)
  if (match) return `${actor}向 ${match[1]} 尺锥状区域喷吐火焰。区域内每个生物都必须进行一次 DC ${match[2]} 的敏捷豁免；失败时受到 ${match[3]} 点火焰伤害，成功时伤害减半。`
  match = source.match(/^The (?:veteran|dragon|chimera head) exhales fire in a (\d+)-foot cone\. Each creature in that area must make a DC (\d+) Dexterity saving throw, taking (\d+ \([^)]+\)) fire damage on a failed save, or half as much damage on a successful one\.$/)
  if (match) return `${actor}向 ${match[1]} 尺锥状区域喷吐火焰。区域内每个生物都必须进行一次 DC ${match[2]} 的敏捷豁免；失败时受到 ${match[3]} 点火焰伤害，成功时伤害减半。`
  match = source.match(/^If the wereboar moves at least (\d+) feet straight toward a target and then hits it with its tusks on the same turn, the target takes an extra (\d+ \([^)]+\)) slashing damage\. If the target is a creature, it must succeed on a DC (\d+) Strength saving throw or be knocked prone\.$/)
  if (match) return `如果野猪人直线向目标移动至少 ${match[1]} 尺，并在同一回合以獠牙命中目标，该攻击额外造成 ${match[2]} 点挥砍伤害。如果目标是生物，它必须通过一次 DC ${match[3]} 的力量豁免，否则倒地。`
  match = source.match(/^The (?:dragon|wolf) exhales (?:an icy blast of hail|a blast of freezing wind) in a (\d+)-foot cone\. Each creature in that area must make a DC (\d+) (Constitution|Dexterity) saving throw, taking (\d+ \([^)]+\)) cold damage on a failed save, or half as much damage on a successful one\.$/)
  if (match) return `${actor}向 ${match[1]} 尺锥状区域喷吐冰冷气流。区域内每个生物都必须进行一次 DC ${match[2]} 的${abilityTerms[match[3]]}豁免；失败时受到 ${match[4]} 点冷冻伤害，成功时伤害减半。`
  match = source.match(/^Any creature that starts its turn within (\d+) feet of the [a-z -]+ must succeed on a DC (\d+) Constitution saving throw or be poisoned until the start of its next turn\. On a successful saving throw, the creature is immune to the [a-z -]+'s stench for 24 hours\.$/)
  if (match) return `任何在${actor} ${match[1]} 尺内开始回合的生物，都必须通过一次 DC ${match[2]} 的体质豁免，否则中毒至其下个回合开始。豁免成功时，该生物在接下来的 24 小时内免疫${actor}的恶臭。`
  match = source.match(/^The giant hurls a magical lightning bolt at a point it can see within (\d+) feet of it\. Each creature within (\d+) feet of that point must make a DC (\d+) Dexterity saving throw, taking (\d+ \([^)]+\)) lightning damage on a failed save, or half as much damage on a successful one\.$/)
  if (match) return `${actor}向它 ${match[1]} 尺内能看见的一点掷出一道魔法闪电。该点 ${match[2]} 尺内的每个生物都必须进行一次 DC ${match[3]} 的敏捷豁免；失败时受到 ${match[4]} 点闪电伤害，成功时伤害减半。`
  if (/^The golem targets one or more creatures it can see within 10 ft\. of it\./.test(source)) return '该魔像选择它 10 尺内能看见的一个或多个生物。每个目标都必须对此魔法进行一次 DC 17 的感知豁免。失败时，目标无法使用反应，速度减半，且在其回合内至多发动一次攻击。此外，目标在回合内只能使用动作或附赠动作之一，不能两者都用。这些效应持续 1 分钟。目标可以在其每个回合结束时重新进行豁免，成功时结束自身效应。'
  match = source.match(/^When bright light or a creature is within (\d+) feet of the shrieker, it emits a shriek audible within (\d+) feet of it\. The shrieker continues to shriek until the disturbance moves out of range and for 1d4 of the shrieker's turns afterward$/)
  if (match) return `当明亮光照或一个生物位于尖叫菇 ${match[1]} 尺内时，它会发出在 ${match[2]} 尺内可闻的尖叫。尖叫菇会持续尖叫，直到干扰源离开范围，并在此后继续 1d4 个尖叫菇回合。`
  if (/^The planetar's weapon attacks are magical\./.test(source)) return '星界使者的武器攻击视为魔法攻击。当星界使者用任何武器命中时，该武器额外造成 5d8 点光耀伤害（已计入攻击）。'
  match = source.match(/^The (werebear|wereboar|wererat|weretiger|werewolf) can use its action to polymorph into (?:a |an )?(.+), or back into its true form, which is humanoid\. Its statistics, other than its (size and AC|AC|size), are the same in each form\. Any equipment it is wearing or carrying isn't transformed\. It reverts to its true form if it dies\.$/)
  if (match) {
    const kind = ({ werebear: '熊人', wereboar: '野猪人', wererat: '鼠人', weretiger: '虎人', werewolf: '狼人' })[match[1]]
    const forms = match[2]
      .replace('Large bear-humanoid hybrid or into a Large bear', '大型的熊—人混种形态或大型熊')
      .replace('boar-humanoid hybrid or into a boar', '野猪—人混种形态或野猪')
      .replace('rat-humanoid hybrid or into a giant rat', '鼠—人混种形态或巨鼠')
      .replace('tiger-humanoid hybrid or into a tiger', '虎—人混种形态或老虎')
      .replace('wolf-humanoid hybrid or into a wolf', '狼—人混种形态或狼')
    if (!/[A-Za-z]{2,}/.test(forms)) {
      const exception = ({ 'size and AC': '体型与 AC', AC: 'AC', size: '体型' })[match[3]]
      return `${kind}可以使用一个动作变成${forms}，或变回其人形生物的真实形态。除${exception}外，它在各形态下的数据均相同。它穿戴或携带的任何装备不会变形。它死亡时会恢复真实形态。`
    }
  }
  if (/^If it dies, the naga returns to life in 1d6 days/.test(source)) return '如果那伽死亡，它会在 1d6 日后复活，并恢复全部生命值。只有祝愿术能阻止此特性生效。'
  match = source.match(/^The raven can mimic simple sounds it has heard, such as a person whispering, a baby crying, or an animal chittering\. A creature that hears the sounds can tell they are imitations with a successful DC (\d+) Wisdom \(Insight\) check\.$/)
  if (match) return `渡鸦可以模仿它听过的简单声音，例如人的耳语、婴儿的哭声或动物的叫声。听到声音的生物可以通过一次 DC ${match[1]} 的感知（洞悉）检定，辨认出这些声音是模仿的。`
  if (/^As a bonus action, the spider can magically shift from the Material Plane to the Ethereal Plane, or vice versa\.$/.test(source)) return '该蜘蛛可以使用一个附赠动作，魔法般从物质位面转移到以太位面，或从以太位面转移回物质位面。'
  match = source.match(/^The troll regains (\d+) hit points at the start of its turn\. If the troll takes acid or fire damage, this trait doesn't function at the start of the troll's next turn\. The troll dies only if it starts its turn with 0 hit points and doesn't regenerate\.$/)
  if (match) return `巨魔在其回合开始时恢复 ${match[1]} 点生命值。如果巨魔受到强酸或火焰伤害，此特性不会在它的下个回合开始时生效。只有当巨魔以 0 点生命值开始回合且未能再生时，它才会死亡。`
  if (/^The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny (?:quipper|rat|raven)\./.test(source)) return '该群集可以占据其他生物的空间，其他生物也可以占据该群集的空间；该群集能穿过任何足以让构成它的微型生物通过的开口。该群集无法恢复生命值，也无法获得临时生命值。'
  match = source.match(/^If the horse moves at least (\d+) ft\. straight toward a creature and then hits it with a hooves attack on the same turn, that target must succeed on a DC (\d+) Strength saving throw or be knocked prone\. If the target is prone, the horse can make another attack with its hooves against it as a bonus action\.$/)
  if (match) return `如果该马直线向一个生物移动至少 ${match[1]} 尺，并在同一回合以蹄击命中它，目标必须通过一次 DC ${match[2]} 的力量豁免，否则倒地。如果目标已倒地，该马可以使用一个附赠动作，对其再发动一次蹄击攻击。`

  match = source.match(/^The [a-z -]+ has advantage on Wisdom \(Perception\) checks that rely on (hearing|sight|smell|hearing or sight|hearing or smell|sight or smell)\.$/)
  if (match) {
    const sense = ({ hearing: '听觉', sight: '视觉', smell: '嗅觉', 'hearing or sight': '听觉或视觉', 'hearing or smell': '听觉或嗅觉', 'sight or smell': '视觉或嗅觉' })[match[1]]
    return `${actor}进行依赖${sense}的感知（察觉）检定时具有优势。`
  }

  match = source.match(/^The [a-z -]+ has advantage on an attack roll against a creature if at least one of the [a-z -]+'s allies is within 5 ft\. of the creature and the ally isn't incapacitated\.$/)
  if (match) return `如果一个生物 5 尺内至少有一名未陷入失能的${actor}盟友，${actor}对该生物的攻击检定具有优势。`

  if (/^The [a-z -]+ can breathe only underwater\.$/.test(source)) return `${actor}只能在水下呼吸。`
  if (source === 'The frog can breathe air and water') return `${actor}可以呼吸空气和水。`
  if (/^The (?:bat|dolphin) can't use its blindsight while deafened\.$/.test(source)) return `${actor}处于耳聋时无法使用盲视。`
  if (/^The [a-z -]+ doesn't provoke opportunity attacks when it flies out of an enemy's reach\.$/.test(source)) return `${actor}飞离敌人触及范围时不会引发借机攻击。`
  if (/^The [a-z -]+ has advantage on saving throws against spells and other magical effects\.$/.test(source)) return `${actor}对抗法术和其他魔法效应的豁免具有优势。`
  if (/^The [a-z -]+'s weapon attacks are magical\.$/.test(source)) return `${actor}的武器攻击视为魔法攻击。`
  if (/^The [a-z -]+ can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check\.$/.test(source)) return `${actor}无需进行属性检定即可攀爬困难表面，包括倒挂在天花板上。`
  if (/^The [a-z -]+ ignores movement restrictions caused by webbing\.$/.test(source)) return `${actor}忽略蛛网造成的移动限制。`
  if (/^While in contact with a web, the [a-z -]+ knows the exact location of any other creature in contact with the same web\.$/.test(source)) return `${actor}接触蛛网时，会知道所有接触同一蛛网的其他生物的精确位置。`
  if (/^The [a-z -]+ deals double damage to objects and structures\.$/.test(source)) return `${actor}对物体和建筑造成双倍伤害。`

  match = source.match(/^The [a-z -]+ can hold its breath for (\d+) minutes?\.$/)
  if (match) return `${actor}可以屏息 ${match[1]} 分钟。`

  match = source.match(/^While in sunlight, the [a-z -]+ has disadvantage on attack rolls, as well as on Wisdom \(Perception\) checks that rely on sight\.$/)
  if (match) return `${actor}处于阳光下时，攻击检定以及依赖视觉的感知（察觉）检定具有劣势。`

  match = source.match(/^The [a-z -]+ has advantage on (Dexterity \(Stealth\)|Wisdom \(Perception\)) checks made to (hide|hide in) (rocky|snowy|underwater) terrain\.$/)
  if (match) {
    const check = match[1].startsWith('Dexterity') ? '敏捷（隐匿）' : '感知（察觉）'
    const terrain = ({ rocky: '岩石', snowy: '雪地', underwater: '水下' })[match[3]]
    return `${actor}在${terrain}地形中进行${check}检定时具有优势。`
  }

  match = source.match(/^If the [a-z -]+ takes (\d+) damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead\.$/)
  if (match) return `如果一次不超过 ${match[1]} 点的伤害原本会使${actor}降至 0 点生命值，它会改为降至 1 点生命值。`

  match = source.match(/^At the start of its turn, the [a-z -]+ can gain advantage on all melee weapon attack rolls during that turn, but attack rolls against it have advantage until the start of its next turn\.$/)
  if (match) return `在其回合开始时，${actor}可以令自己在该回合的所有近战武器攻击检定具有优势；但直至其下回合开始，针对它的攻击检定也具有优势。`

  match = source.match(/^The [a-z -]+ can move through a space as narrow as 1 inch wide without squeezing\.$/)
  if (match) return `${actor}可以穿过宽度窄至 1 英寸的空间，且无需挤入。`

  const appearanceTerms = {
    'a normal suit of armor': '普通护甲', 'a normal shrub': '普通灌木', 'a normal tree': '普通树木',
    'an ordinary fungus': '普通真菌', 'a cave formation such as a stalactite or stalagmite': '钟乳石或石笋等洞穴岩层',
    'a normal sword': '一把普通长剑', 'an inanimate statue': '一尊没有生命的雕像',
  }
  match = source.match(/^While the [a-z -]+ remains motionless, it is indistinguishable from (.+)\.$/)
  if (match && appearanceTerms[match[1]]) return `${actor}保持静止时，与${appearanceTerms[match[1]]}别无二致。`
  match = source.match(/^While the [a-z -]+ remains motionless and isn't flying, it is indistinguishable from (.+)\.$/)
  if (match && appearanceTerms[match[1]]) return `${actor}保持静止且未在飞行时，与${appearanceTerms[match[1]]}别无二致。`
  match = source.match(/^While the [a-z -]+ remains motion less, it is indistinguishable from (.+)\.$/)
  if (match && appearanceTerms[match[1]]) return `${actor}保持静止时，与${appearanceTerms[match[1]]}别无二致。`

  match = source.match(/^The [a-z -]+ sheds bright light in a (\d+)-foot radius and dim light for an additional (\d+) (?:ft\.|feet)\.?$/)
  if (match) return `${actor}在 ${match[1]} 尺半径内散发明亮光照，并在其外 ${match[2]} 尺散发微光光照。`

  match = source.match(/^If the [a-z -]+ dies, its body disintegrates (.+), leaving behind only equipment (?:the [a-z -]+|it) was wearing or carrying\.$/)
  if (match) {
    const manner = match[1] === 'into a warm breeze' ? '化作一阵暖风消散' : match[1] === 'in a flash of fire and puff of smoke' ? '在火光与烟雾中消散' : undefined
    if (manner) return `${actor}死亡时，身体会${manner}，只留下它穿戴或携带的装备。`
  }

  if (/^The [a-z -]+ has advantage on saving throws against being charmed or frightened\.$/.test(source)) {
    return `${actor}对抗魅惑或恐慌的豁免具有优势。`
  }
  if (/^The [a-z -]+ has advantage on saving throws against being charmed, and magic can't put the [a-z -]+ to sleep\.$/.test(source)) {
    return `${actor}对抗魅惑的豁免具有优势，且魔法无法使其入睡。`
  }
  if (/^The [a-z -]+ has advantage on Wisdom \(Perception\) checks and on saving throws against being blinded, charmed, deafened, frightened, stunned, (?:or|and) knocked unconscious\.$/.test(source)) {
    return `${actor}的感知（察觉）检定，以及对抗目盲、魅惑、耳聋、恐慌、震慑或昏迷的豁免具有优势。`
  }

  match = source.match(/^If the [a-z -]+ moves at least (\d+) (?:ft\.|feet) straight toward (?:a target|a creature) and then hits it with (?:a|its) ([a-z]+) attack on the same turn, (?:the|that) target (takes an extra (\d+ \([^)]+\))(?: (acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder))? damage|must succeed on a DC (\d+) Strength saving throw or be knocked prone)\.?(?: If the target is a creature, it must succeed on a DC (\d+) Strength saving throw or be knocked prone\.)?(?: If the target is prone, the [a-z -]+ can make (?:one|another) ([a-z]+) attack against it as a bonus action\.)?$/)
  if (match) {
    const [, distance, attackEnglish, , extra, damageType, firstDc, secondDc, bonusAttackEnglish] = match
    const attackZh = actionPhraseTerms[attackEnglish] ?? ruleNames[attackEnglish[0].toUpperCase() + attackEnglish.slice(1)]
    const parts = [`如果${actor}直线向目标移动至少 ${distance} 尺，并在同一回合以${attackZh}命中目标，`]
    if (extra) parts.push(`目标额外受到 ${extra}${damageType ? ` 点${damageTerms[damageType]}伤害` : ' 点伤害'}。`)
    const dc = firstDc ?? secondDc
    if (dc) parts.push(`目标必须通过一次 DC ${dc} 的力量豁免，否则倒地。`)
    if (bonusAttackEnglish) {
      const bonusAttackZh = actionPhraseTerms[bonusAttackEnglish] ?? ruleNames[bonusAttackEnglish[0].toUpperCase() + bonusAttackEnglish.slice(1)]
      parts.push(`如果目标已倒地，${actor}可以用一个附赠动作对其发动一次${bonusAttackZh}攻击。`)
    }
    return parts.join('')
  }

  match = source.match(/^The [a-z -]+ makes (one|two|three|four) ([a-z]+) attacks?\.$/)
  if (match && actionPhraseTerms[match[2]]) {
    const count = ({ one: '一次', two: '两次', three: '三次', four: '四次' })[match[1]]
    return `${actor}发动${count}${actionPhraseTerms[match[2]]}攻击。`
  }

  match = source.match(/^The [a-z -]+ makes two attacks: one with its ([a-z]+) and one with its ([a-z]+)\.$/)
  if (match && actionPhraseTerms[match[1]] && actionPhraseTerms[match[2]]) {
    return `${actor}发动两次攻击：一次${actionPhraseTerms[match[1]]}与一次${actionPhraseTerms[match[2]]}。`
  }

  match = source.match(/^The [a-z -]+ makes three attacks: (?:one with its ([a-z]+) and two with its ([a-z]+)|two with its ([a-z]+) and one with its ([a-z]+))\.$/)
  if (match) {
    const one = match[1] ?? match[4]
    const two = match[2] ?? match[3]
    if (actionPhraseTerms[one] && actionPhraseTerms[two]) return `${actor}发动三次攻击：一次${actionPhraseTerms[one]}与两次${actionPhraseTerms[two]}。`
  }

  match = source.match(/^The [a-z -]+ makes two attacks, only one of which can be (?:a |with its )?([a-z]+)(?: attack)?\.$/)
  if (match && actionPhraseTerms[match[1]]) return `${actor}发动两次攻击，其中至多一次可以是${actionPhraseTerms[match[1]]}。`

  match = source.match(/^The dragon beats its wings\. Each creature within (\d+) ft\. of the dragon must succeed on a DC (\d+) Dexterity saving throw or take (\d+ \([^)]+\)) bludgeoning damage and be knocked prone\. The dragon can then fly up to half its flying speed\.$/)
  if (match) return `该龙拍打双翼。该龙 ${match[1]} 尺内每个生物必须通过一次 DC ${match[2]} 的敏捷豁免，否则受到 ${match[3]} 点钝击伤害并倒地。随后，该龙可以飞行至多等于其飞行速度一半的距离。`

  match = source.match(/^Each creature of the dragon's choice that is within 120 (?:feet|ft\.) of the dragon and aware of it must succeed on a DC (\d+) Wisdom saving throw or become frightened for 1 minute\. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success\. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours ?\.$/)
  if (match) return `该龙选择的、位于其 120 尺内且能感知到它的每个生物，都必须通过一次 DC ${match[1]} 的感知豁免，否则陷入恐慌 1 分钟。生物可以在其每个回合结束时再次进行此豁免；成功时结束自身效应。如果生物豁免成功或效应对其结束，则接下来的 24 小时内免疫该龙的骇人威仪。`

  match = source.match(/^The dragon exhales (acid|fire|lightning|poisonous gas|an icy blast) in a (\d+)-foot (line that is (\d+) (?:feet|ft\.) wide|cone)\. Each creature in that (?:line|area) must make a DC (\d+) (Dexterity|Constitution) saving throw, taking (\d+ \([^)]+\)) (acid|fire|lightning|poison|cold) damage on a failed save, or half as much damage on a successful one\.$/)
  if (match) {
    const [, substance, length, shape, width, dc, ability, amount, type] = match
    const substanceZh = ({ acid: '强酸', fire: '火焰', lightning: '闪电', 'poisonous gas': '毒气', 'an icy blast': '寒冰气流' })[substance]
    const area = shape === 'cone' ? `${length} 尺锥状区域` : `一道长 ${length} 尺、宽 ${width} 尺的线状区域`
    return `该龙向${area}喷吐${substanceZh}。区域内每个生物都必须进行一次 DC ${dc} 的${abilityTerms[ability]}豁免；失败时受到 ${amount} 点${damageTerms[type]}伤害，成功时受到一半伤害。`
  }
  return undefined
}

function translateTerm(section, source, context) {
  const translated = terms[section]?.[source]
  if (!translated) throw new Error(`missing monster term: ${section}.${source} (${context})`)
  return translated
}

function resolvedFixedTerms(monster) {
  return {
    alignment: translateTerm('alignments', monster.alignment, monster.slug),
    subtypes: (monster.subtypes ?? []).map((value) => translateTerm('subtypes', value, monster.slug)),
    armorClassNote: monster.armorClass.note
      ? translateTerm('armorClassNotes', monster.armorClass.note, monster.slug)
      : '',
    skills: (monster.skills ?? []).map(({ key }) => ({ key, name: translateTerm('skills', key, monster.slug) })),
    languages: monster.languages.map((value) => translateTerm('languages', value, monster.slug)),
    conditionImmunities: (monster.conditionImmunities ?? [])
      .map((value) => translateTerm('conditionImmunities', value, monster.slug)),
  }
}

function workbookRow(monster, reviewed = {}) {
  const fixed = resolvedFixedTerms(monster)
  return {
    id: monster.slug,
    englishName: monster.englishName,
    sourceBook: 'SRD 5.1',
    source: {
      alignmentEnglish: monster.alignment,
      subtypesEnglish: monster.subtypes ?? [],
      armorClassNoteEnglish: monster.armorClass.note ?? '',
      skillsEnglish: (monster.skills ?? []).map(({ key, name }) => ({ key, name })),
      languagesEnglish: monster.languages,
      conditionImmunitiesEnglish: monster.conditionImmunities ?? [],
      traitsEnglish: monster.traits.map((trait, index) => ({ index, englishName: trait.name, descriptionEnglish: trait.description })),
      actionsEnglish: monster.actions.map(translatableAction),
      reactionsEnglish: (monster.reactions ?? []).map(translatableAction),
      legendaryActionsEnglish: (monster.legendaryActions ?? []).map(translatableAction),
      lairActionsEnglish: (monster.lairActions ?? []).map(translatableAction),
      spellcastingDescriptionEnglish: monster.spellcasting?.description ?? '',
      descriptionEnglish: monster.description,
    },
    translation: {
      name: monsterNames[monster.slug] ?? '',
      alignment: fixed.alignment,
      subtypes: fixed.subtypes,
      armorClassNote: fixed.armorClassNote,
      skills: fixed.skills,
      languages: fixed.languages,
      conditionImmunities: fixed.conditionImmunities,
      traits: workbookTranslatedRows(
        monster.traits.map((trait, index) => ({ index, englishName: trait.name, descriptionEnglish: trait.description })),
        reviewed.traits,
        monster,
      ),
      actions: workbookTranslatedRows(monster.actions.map(translatableAction), reviewed.actions, monster),
      reactions: workbookTranslatedRows((monster.reactions ?? []).map(translatableAction), reviewed.reactions, monster),
      legendaryActions: workbookTranslatedRows((monster.legendaryActions ?? []).map(translatableAction), reviewed.legendaryActions, monster),
      lairActions: workbookTranslatedRows((monster.lairActions ?? []).map(translatableAction), reviewed.lairActions, monster),
      spellcastingDescription: reviewed.spellcastingDescription
        ?? translateSpellcastingDescription(monster.spellcasting?.description, monster)
        ?? '',
      description: reviewed.description ?? '',
      reviewedBy: reviewed.reviewedBy ?? '',
      reviewedAt: reviewed.reviewedAt ?? '',
    },
  }
}

function requireText(record, field, id) {
  if (!String(record[field] ?? '').trim()) throw new Error(`${id}: missing ${field}`)
}

function validateKeyedText(source, translated, key, id, monster) {
  const rows = Array.isArray(translated) ? translated : []
  const translatedById = new Map(rows.map((row) => [String(row.id ?? row.key ?? row.index), row]))
  const sourceIds = new Set(source.map((row) => String(row.id ?? row.key ?? row.index)))
  const unknown = [...translatedById.keys()].filter((stableId) => !sourceIds.has(stableId))
  if (unknown.length) throw new Error(`${id}: ${key} contains unknown rows: ${unknown.join(', ')}`)
  for (const sourceRow of source) {
    const stableId = String(sourceRow.id ?? sourceRow.key ?? sourceRow.index)
    const row = translatedById.get(stableId)
    if (!ruleNames[sourceRow.name ?? sourceRow.englishName]) {
      throw new Error(`${id}.${key}.${stableId}: missing reviewed rule name`)
    }
    if ('descriptionEnglish' in sourceRow || 'description' in sourceRow) {
      const description = row?.description ?? controlledMonsterText(sourceRow.descriptionEnglish ?? sourceRow.description, monster)
      if (!String(description ?? '').trim()) throw new Error(`${id}.${key}.${stableId}: missing contextual description`)
    }
  }
}

function validateRecord(monster, record) {
  const id = monster.slug
  if (!monsterNames[id]) throw new Error(`${id}: missing reviewed monster name`)
  for (const field of ['reviewedBy', 'reviewedAt']) requireText(record, field, id)
  validateKeyedText(monster.traits.map((trait, index) => ({ index, ...trait })), record.traits, 'traits', id, monster)
  validateKeyedText(monster.actions, record.actions, 'actions', id, monster)
  validateKeyedText(monster.reactions ?? [], record.reactions, 'reactions', id, monster)
  validateKeyedText(monster.legendaryActions ?? [], record.legendaryActions, 'legendaryActions', id, monster)
  validateKeyedText(monster.lairActions ?? [], record.lairActions, 'lairActions', id, monster)
  if (monster.spellcasting?.description && !String(
    record.spellcastingDescription ?? translateSpellcastingDescription(monster.spellcasting.description, monster) ?? '',
  ).trim()) {
    throw new Error(`${id}: missing spellcastingDescription`)
  }
}

function normalizedRows(sourceRows, translatedRows, monster) {
  const translatedById = new Map((translatedRows ?? []).map((row) => [String(row.id ?? row.index), row]))
  return sourceRows.map((sourceRow) => {
    const stableId = String(sourceRow.id ?? sourceRow.index)
    const translated = translatedById.get(stableId)
    return {
      ...(sourceRow.id !== undefined ? { id: sourceRow.id } : { index: sourceRow.index }),
      name: ruleNames[sourceRow.name],
      description: translated?.description ?? controlledMonsterText(sourceRow.description, monster),
    }
  })
}

function normalizedRecord(monster, record) {
  validateRecord(monster, record)
  const fixed = resolvedFixedTerms(monster)
  return {
    name: monsterNames[monster.slug],
    ...fixed,
    traits: normalizedRows(monster.traits.map((trait, index) => ({ index, ...trait })), record.traits, monster),
    actions: normalizedRows(monster.actions, record.actions, monster),
    reactions: normalizedRows(monster.reactions ?? [], record.reactions, monster),
    legendaryActions: normalizedRows(monster.legendaryActions ?? [], record.legendaryActions, monster),
    lairActions: normalizedRows(monster.lairActions ?? [], record.lairActions, monster),
    spellcastingDescription: record.spellcastingDescription
      ?? translateSpellcastingDescription(monster.spellcasting?.description, monster)
      ?? '',
    description: record.description ?? `${monsterNames[monster.slug]} — SRD 5.1 怪物数据卡。`,
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt,
  }
}

const { emitReviewed, emit } = cliArgs()
const artifact = await readJson(SOURCE_PATH)
const terms = await readJson(TERMS_PATH)
const monsterNames = await readJson(NAMES_PATH)
const ruleNames = await readJson(RULE_NAMES_PATH)
const spellsReviewed = await readJson(SPELLS_REVIEWED_PATH)
if (!Array.isArray(artifact?.monsters) || artifact.monsters.length !== EXPECTED_COUNT) {
  throw new Error(`expected ${EXPECTED_COUNT} SRD monsters`)
}
const reviewed = await readJson(REVIEWED_PATH, {})
if (!reviewed || Array.isArray(reviewed) || typeof reviewed !== 'object') throw new Error('reviewed monster translations must be an object')
const monstersBySlug = new Map(artifact.monsters.map((monster) => [monster.slug, monster]))
const missingNames = artifact.monsters.filter((monster) => !monsterNames[monster.slug]).map((monster) => monster.slug)
const extraNames = Object.keys(monsterNames).filter((id) => !monstersBySlug.has(id))
if (missingNames.length || extraNames.length) {
  throw new Error(`monster name coverage mismatch; missing: ${missingNames.join(', ')}; extra: ${extraNames.join(', ')}`)
}
const sourceRuleNames = new Set(artifact.monsters.flatMap((monster) => [
  ...monster.traits,
  ...monster.actions,
  ...(monster.reactions ?? []),
  ...(monster.legendaryActions ?? []),
  ...(monster.lairActions ?? []),
].map((row) => row.name)))
const missingRuleNames = [...sourceRuleNames].filter((name) => !ruleNames[name])
const extraRuleNames = Object.keys(ruleNames).filter((name) => !sourceRuleNames.has(name))
if (missingRuleNames.length || extraRuleNames.length) {
  throw new Error(`monster rule-name coverage mismatch; missing: ${missingRuleNames.join(', ')}; extra: ${extraRuleNames.join(', ')}`)
}
const unknown = Object.keys(reviewed).filter((id) => !monstersBySlug.has(id))
if (unknown.length) throw new Error(`unknown reviewed monster IDs: ${unknown.join(', ')}`)

await mkdir(dirname(WORKBOOK_PATH), { recursive: true })
await writeFile(WORKBOOK_PATH, `${JSON.stringify(artifact.monsters.map((monster) => workbookRow(monster, reviewed[monster.slug])), null, 2)}\n`, 'utf8')
console.log(`wrote monster review workbook: ${WORKBOOK_PATH}`)

const output = {}
for (const [id, record] of Object.entries(reviewed)) output[id] = normalizedRecord(monstersBySlug.get(id), record)
if (emit && Object.keys(output).length !== EXPECTED_COUNT) {
  throw new Error(`${EXPECTED_COUNT - Object.keys(output).length} monster translations still need contextual review`)
}
if (emitReviewed || emit) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`wrote ${OUTPUT_PATH} (${Object.keys(output).length} context-reviewed entries)`)
}
