#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const outputDir = path.join(root, 'docs', 'headless-semantic-audit')
const sourceRoot = path.join(root, 'src')
const decisions = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts', 'data', 'srd-spell-headless-decisions.json'), 'utf8'),
).decisions
const reviewedSpellText = JSON.parse(
  fs.readFileSync(path.join(root, 'content', 'srd51', 'spells.zh.reviewed.json'), 'utf8'),
)
const generatedMonsters = JSON.parse(
  fs.readFileSync(path.join(root, 'src', 'rulesets', 'dnd5e', 'generated', 'srdMonsters.generated.json'), 'utf8'),
).monsters

function walkFiles(directory, predicate) {
  const rows = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) rows.push(...walkFiles(absolute, predicate))
    else if (predicate(absolute)) rows.push(absolute)
  }
  return rows
}

function relative(file) {
  return path.relative(root, file).replaceAll('\\', '/')
}

const sourceFiles = walkFiles(sourceRoot, (file) => /\.(?:ts|tsx)$/.test(file))
const testFiles = sourceFiles.filter((file) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(file))
const runtimeFiles = sourceFiles.filter((file) => !/\.(?:test|spec)\.(?:ts|tsx)$/.test(file))
const textCache = new Map()
function fileText(file) {
  if (!textCache.has(file)) textCache.set(file, fs.readFileSync(file, 'utf8'))
  return textCache.get(file)
}

function quotedToken(text, token) {
  return text.includes(`'${token}'`) || text.includes(`"${token}"`) || text.includes(`\`${token}\``)
}

function directSpellTests(spell) {
  const ids = [spell.id, `spell:${spell.id}`]
  const names = [spell.name, spell.englishName].filter(Boolean)
  return testFiles.filter((file) => {
    const text = fileText(file)
    return ids.some((id) => quotedToken(text, id)) || names.some((name) => name.length > 3 && text.includes(name))
  }).map(relative)
}

function directMonsterTests(monster, member, section) {
  return testFiles.filter((file) => {
    const text = fileText(file)
    const exactActionKey = section && member?.id
      ? `${monster.slug}:${section}:${member.id}`
      : undefined
    if (exactActionKey && quotedToken(text, exactActionKey)) return true
    const hasMonster = quotedToken(text, monster.slug) || quotedToken(text, monster.id) ||
      (monster.englishName?.length > 4 && text.includes(monster.englishName))
    if (!hasMonster) return false
    if (!member) return true
    const tokens = [member.id, member.name, member.englishName].filter((token) => typeof token === 'string' && token.length > 2)
    return tokens.some((token) => quotedToken(text, token) || text.includes(token))
  }).map(relative)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function countBy(rows, key) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row[key]))].sort().map((value) => [value, rows.filter((row) => row[key] === value).length]),
  )
}

function operations(activity) {
  const activities = Array.isArray(activity) ? activity : activity ? [activity] : []
  return activities.flatMap((entry) => entry?.outcomes?.flatMap((outcome) => outcome.operations ?? []) ?? [])
}

function serializedActivity(activity) {
  return JSON.stringify(activity ?? {}).toLowerCase()
}

const spellExpectationDetectors = [
  ['saving-throw', /必须进行(?:一次)?[^。；\n]{0,30}豁免|进行一次[^。；\n]{0,30}豁免|通过一次[^。；\n]{0,30}豁免|对抗[^。；\n]{0,20}豁免/],
  ['half-on-save', /豁免成功[^。；\n]*(?:一半|减半)|成功时[^。；\n]*(?:一半|减半)|只受一半伤害/],
  ['spell-attack', /法术攻击|法术攻击检定/],
  ['damage', /\d+d\d+[^。；\n]{0,40}伤害|受到\s*\d+[^。；\n]{0,40}伤害/],
  ['healing', /恢复[^。；\n]{0,30}生命值|治疗|生命值恢复/],
  ['concentration', /专注/],
  ['area', /锥状|球状|立方|线状|半径[^。；\n]{0,20}(?:区域|球)|区域内的每个|以[^。；\n]{0,30}为中心/],
  ['condition', /目盲|失明|魅惑|恐慌|受惊|麻痹|震慑|倒地|束缚|擒抱|中毒|隐形|隐匿|失能/],
  ['turn-trigger', /回合开始|回合结束|结束其回合|首次进入|每当[^。；\n]{0,20}进入|进入(?:该|此|法术|受守护)?区域时|离开(?:该|此)?区域时/],
  ['movement', /推离|拉近|被推|移动至|传送|飞行速度|游泳速度|攀爬速度|速度加倍|速度降低/],
  ['reaction', /施法时间[^。\n]*反应|以一个反应|使用你的反应/],
  ['sustained-control', /附赠动作[^。；\n]*(?:移动|攻击|操控|重复|再次)|每个回合[^。；\n]*动作/],
]

function spellExpectations(catalog) {
  const reference = reviewedSpellText[catalog.id] ?? {}
  const text = [reference.castingTime, reference.duration, reference.description, reference.higherLevels].filter(Boolean).join('\n')
  const expected = spellExpectationDetectors.filter(([, pattern]) => pattern.test(text)).map(([id]) => id)
  if (reference.higherLevels) expected.push('slot-scaling')
  return { reference, text, expected: unique(expected) }
}

function coreSpellEvidence(spell, expectation) {
  switch (expectation) {
    case 'saving-throw': return Boolean(spell.saveAbility || spell.unwillingSaveAbility)
    case 'half-on-save': return spell.damageOnSuccessfulSave === 'half'
    case 'spell-attack': return spell.effect === 'spell-attack' || Boolean(spell.spellAttackMode) || Boolean(spell.baseProjectiles) || Boolean(spell.sustainedAttack?.spellAttackMode)
    case 'damage': return Boolean(spell.damageType && spell.dice?.count > 0) || Boolean(spell.additionalDamageComponents?.length) || Boolean(spell.delayedDamage) || Boolean(spell.sustainedAttack?.dice?.count)
    case 'healing': return spell.effect === 'healing' || spell.effect === 'heal' || spell.fixedHealing != null || spell.healingPool != null
    case 'concentration': return spell.concentration === true
    case 'area': return spell.target === 'area' && Boolean(spell.area)
    case 'condition': return Boolean(spell.onHitEffect || spell.onFailedSaveEffect || spell.appliedEffect || spell.conditionOptions?.length)
    case 'turn-trigger': return spell.effect === 'persistent-area' || Boolean(spell.delayedDamage || spell.sustainedAttack)
    case 'movement': return spell.onFailedSaveEffect === 'thunderwave-push' || ['fly', 'longstrider', 'jump', 'expeditious-retreat'].includes(spell.appliedEffect)
    case 'reaction': return spell.castingTime === 'reaction'
    case 'sustained-control': return Boolean(spell.sustainedAttack) || spell.effect === 'persistent-area'
    case 'slot-scaling': return Boolean(
      spell.dice?.perHigherSlot || spell.fixedHealingPerHigherSlot || spell.additionalTargetsPerHigherSlot ||
      spell.additionalProjectilesPerHigherSlot || spell.areaRadiusFeetPerHigherSlot ||
      spell.additionalDamageComponents?.some((entry) => entry.dice?.additionalDieEverySlotLevels) ||
      spell.sustainedAttack?.dice?.additionalDieEverySlotLevels,
    )
    default: return false
  }
}

const activityExpectationAliases = {
  'saving-throw': ['saving-throw', 'save-ability', 'save-dc'],
  'half-on-save': ['half', 'successful-save'],
  'spell-attack': ['spell-attack'],
  damage: ['damage', 'periodic-damage'],
  healing: ['healing', 'heal', 'hit-points'],
  concentration: ['concentration'],
  area: ['area', 'radiusfeet', 'lengthfeet', 'widthfeet'],
  condition: ['condition', 'apply-effect', 'modifier', 'hiddenbody'],
  'turn-trigger': ['turn-start', 'turn-end', 'on-enter', 'on-leave', 'trigger'],
  movement: ['movement', 'teleport', 'speed', 'push', 'pull', 'anchor', 'caster'],
  reaction: ['reaction'],
  'sustained-control': ['bonus-action', 'granted-activity', 'grant-basic-action', 'entity-movement', 'extra-action', 'action-economy'],
  'slot-scaling': ['higher-slot', 'slot-level', 'slot-delta', 'scaling'],
}

const capabilityAliases = {
  'max-hit-points': ['hit-point-maximum'],
  'mode-choice': ['"choices"', '"choiceid"', '"optionid"', '"grants"'],
  'entity-movement': ['"movement"', 'maximumfeet'],
  'sensor-vision': ['sharevisionwithsource', 'darkvisionrangefeet', 'sensor', 'truesight'],
  'movement-blocking': ['"blocking"', '"movement":true'],
  'teleport-save': ['teleportationexitsavingthrow'],
  'condition-lifecycle': ['condition', 'apply-effect', 'duration'],
  'effect-modifier': ['modifier', 'apply-effect', 'rule-state'],
  'saving-throw-modifier': ['saving-throw', 'roll-mode', 'modifier'],
  'skill-check-modifier': ['skill-check', 'modifier', 'bonus'],
  'movement-capability': ['movement', 'speed'],
  'movement-mode': ['movement', 'speed', 'fly', 'swim', 'climb'],
  'movement-modifier': ['movement', 'speed'],
  'movement-rate': ['movement', 'speed', 'maximumfeetperround', 'controlled-descent'],
  'persistent-sense': ['effect', 'sense', 'duration'],
  'sensor-information': ['sensor', 'information', 'manual-adjudication'],
  'stat-transform': ['form', 'transform', 'modifier', 'rule-state'],
  'target-linked-effect': ['target-linked', 'apply-effect', 'rule-state'],
  'typed-target': ['creature-type', 'target', 'requirement'],
  'visibility-rule': ['visibility', 'visible', 'obscuration'],
  'turn-trigger': ['turn-start', 'turn-end', 'trigger'],
  'event-trigger': ['trigger', 'on-enter', 'on-leave'],
  'slot-scaling': ['higher-slot', 'slot-level', 'slot-delta', 'scaling'],
  'damage-scaling': ['higher-slot', 'slot-level', 'slot-delta', 'scaling', 'damage'],
  'save-ends': ['repeat-save', 'saving-throw', 'duration'],
  'source-aura': ['aura', 'radiusfeet', 'source'],
  'source-anchoring': ['anchor', 'source'],
  'on-hit-rider': ['on-hit-bonus-damage', 'onhittargeteffect'],
  'visibility-effect': ['revealinvisible', 'preventinvisibility', 'emittedlight'],
  'long-term-state': ['establish-spell-authority', 'permanent', 'maturesafterminutes'],
  'death-handoff': ['revive', 'clone-receptacle'],
  'body-snapshot': ['clone-receptacle'],
  'forced-movement': ['forcedmovement', 'directional-compulsion', 'repeatsaveaftermovement'],
  'multi-save-counter': ['successesrequired', 'failuresrequired'],
  'item-generation': ['grant-inventory-item'],
  'inventory-effect': ['inventory-item', 'purify-inventory-item', 'break-inventory-item-attunement'],
  'effect-removal': ['remove-effect', 'remove-standard-condition', 'remove-effects-by-tag', 'purify-'],
  'planar-state': ['planar-phase', 'banished', 'terrain-merge', 'dismissal'],
  'reaction-trigger': ['"kind":"reaction"', 'after-fall-start'],
  'falling-state': ['safe-fall', 'controlled-descent', 'magically-held-aloft', 'magicallyheldaloft'],
  'damage-reflection': ['after-damage', 'retaliation-damage'],
  'multi-cell-template': ['instancecount', 'instanceadjacency'],
  'corpse-state': ['corpse-preservation'],
  'resurrection-timer': ['maximumdeathagerounds', 'corpse-preservation'],
  'damage-pool': ['maximumtotaldamage'],
  'area-movement': ['translateawayfromsourcefeet', 'grantedactivities'],
  'terrain-geometry': ['terrain-merge', 'planar-phase'],
  'ejection-damage': ['eject-minor', 'eject-major', 'meld-minor-damage', 'meld-major-damage'],
  'attack-redirection': ['attack-decoys'],
  'duplicate-counter': ['attack-decoys', 'redirectminimumd20'],
  'attack-resolution': ['attack-decoys', 'armorclassbase'],
  'effect-suppression': ['spell-targeting-immunity'],
  'targeting-immunity': ['spell-targeting-immunity'],
  'world-object': ['purify-map-consumables', 'modify-map-object'],
  'body-restoration': ['bodyrestoration', 'restorebody'],
  'item-link': ['break-inventory-item-attunement'],
  'condition-restoration': ['removeconditions', 'restorebody'],
  'long-term-penalty': ['longrestpenalty'],
  'vertical-movement': ['"mode":"ascend"', 'verticaldestination'],
  'round-timeline': ['minimumlifecycleadvances', 'maximumlifecycleadvances'],
  'multi-effect': ['lifecycle', 'triggers'],
  communication: ['open-communication', 'telepathic-bond', 'speechunderstoodby'],
  'language-capability': ['language-capability', 'telepathic-bond'],
  'extra-turns': ['grant-extra-turns'],
  'random-table': ['grant-extra-turns', '"kind":"dice"'],
  'effect-break': ['endonaffectother'],
  'occupant-permissions': ['entrypermission', 'occupants-at-creation'],
  'effect-detection': ['truesight', 'see-invisible'],
  'planar-sight': ['truesight'],
  'transition-timer': ['aftereffectends'],
  'area-lifecycle': ['persistent-area', 'duration', 'trigger'],
  'area-movement': ['persistent-area', 'movement'],
  'line-of-effect': ['line-of-effect', 'visible'],
  'roll-mode-modifier': ['advantage', 'disadvantage', 'roll-mode', 'modifier'],
  'minimum-roll': ['minimum', 'd20'],
  'maximum-healing': ['maximum-healing', 'healing'],
  'damage-resistance': ['resistance', 'damage'],
  'damage-immunity': ['immunity', 'damage'],
  'condition-immunity': ['condition-immunity', 'immunity'],
  'effect-immunity': ['effect-immunity', 'immunity'],
  'periodic-damage': ['periodic-damage', 'damage', 'trigger'],
  'periodic-healing': ['periodic-healing', 'healing', 'trigger'],
  'granted-activity': ['grant', 'activity'],
  'summon-companion': ['summon', 'companion'],
  'persistent-area': ['persistent-area'],
}

function activityHas(activity, token) {
  const serialized = serializedActivity(activity)
  const aliases = capabilityAliases[token] ?? activityExpectationAliases[token] ?? [token]
  return aliases.some((alias) => serialized.includes(alias))
}

function runtimeConsumersForActivity(activity) {
  const stateIds = operations(activity)
    .filter((operation) => operation.kind === 'mechanic' && operation.handlerId === 'core.rule-state')
    .map((operation) => operation.parameters?.['state-id'])
    .filter(Boolean)
  return Object.fromEntries(stateIds.map((stateId) => {
    const files = runtimeFiles.filter((file) => {
      const rel = relative(file)
      if (rel.endsWith('dnd5eSrdAuditedSpellActivities.ts')) return false
      return fileText(file).includes(stateId)
    }).map(relative)
    return [stateId, files]
  }))
}

function runtimeSpellReferences(spellId) {
  return runtimeFiles.filter((file) => {
    const rel = relative(file)
    if (!rel.startsWith('src/rulesets/dnd5e/') && !rel.startsWith('src/pages/maps/')) return false
    if (
      rel.endsWith('/spells.ts') || rel.endsWith('/spellCatalog.ts') ||
      rel.endsWith('/dnd5eSrdAuditedSpellActivities.ts') || rel.includes('Descriptions') || rel.includes('Names')
    ) return false
    return quotedToken(fileText(file), spellId) || quotedToken(fileText(file), `spell:${spellId}`)
  }).map(relative)
}

function spellRow(catalog, coreSpell, activity, target) {
  const { reference, expected } = spellExpectations(catalog)
  const tests = directSpellTests(catalog)
  const runtimeReferences = runtimeSpellReferences(catalog.id)
  const targetCapabilities = decisions[catalog.id]?.slice(1) ?? []
  const semanticGaps = []
  const unprovenCapabilities = []
  const runtimeSpecializations = []
  const consumers = activity ? runtimeConsumersForActivity(activity) : {}
  const concreteRuleStateConsumers = unique(Object.values(consumers).flat())
  if (coreSpell) {
    for (const expectation of expected) {
      if (coreSpellEvidence(coreSpell, expectation)) continue
      if (runtimeReferences.length > 0 && tests.length > 0) runtimeSpecializations.push(expectation)
      else semanticGaps.push(`原文要求 ${expectation}，核心定义及专用运行时均无完整证据`)
    }
  } else if (activity) {
    for (const expectation of expected) {
      if (activityHas(activity, expectation)) continue
      if (runtimeReferences.length > 0 && tests.length > 0) runtimeSpecializations.push(expectation)
      else semanticGaps.push(`原文要求 ${expectation}，Activity 及专用运行时均无完整证据`)
    }
    for (const capability of targetCapabilities) {
      if (activityHas(activity, capability)) continue
      if ((runtimeReferences.length > 0 || concreteRuleStateConsumers.length > 0) && tests.length > 0) runtimeSpecializations.push(capability)
      else unprovenCapabilities.push(capability)
    }
  } else if (target !== 'manual') {
    semanticGaps.push('没有可执行核心定义或 Activity')
  }
  for (const [stateId, files] of Object.entries(consumers)) {
    if (files.length === 0) semanticGaps.push(`规则状态 ${stateId} 没有生产运行时消费者`)
  }
  let status
  if (target === 'manual') status = 'manual'
  else if (target === 'partial') status = 'partial'
  else if (semanticGaps.length) status = 'semantic-gap'
  else if (unprovenCapabilities.length) status = 'evidence-gap'
  else if (tests.length === 0) status = 'implemented-unverified'
  else status = 'verified-full'
  return {
    id: catalog.id,
    name: catalog.name,
    englishName: catalog.englishName,
    level: catalog.level,
    implementation: coreSpell ? 'core-transaction' : activity ? 'audited-activity' : 'none',
    declaredTarget: coreSpell ? 'full' : target ?? 'unclassified',
    status,
    expectedSemantics: expected,
    expectedCapabilities: targetCapabilities,
    semanticGaps,
    unprovenCapabilities,
    runtimeSpecializations: unique(runtimeSpecializations),
    runtimeReferences,
    ruleStateConsumers: consumers,
    directTests: tests,
    reference: {
      castingTime: reference.castingTime,
      range: reference.range,
      duration: reference.duration,
    },
  }
}

const actionConditionWords = /grappled|restrained|poisoned|prone|stunned|paralyzed|charmed|frightened|blinded|deafened|incapacitated|unconscious|petrified|擒抱|束缚|中毒|倒地|震慑|麻痹|魅惑|恐慌|目盲|耳聋|失能|昏迷|石化/i
const traitCombatWords = /attack|damage|saving throw|hit points|turn|speed|armor class|\bAC\b|resistan|immun|regain|dies|death|initiative|grapple|reaction|opportunity|critical|frightened|poisoned|prone|stunned|paralyzed|charmed|restrained|incapacitated|攻击|伤害|豁免|生命值|回合|速度|抗性|免疫|死亡|先攻|擒抱|反应|借机|重击|恐慌|中毒|倒地|震慑|麻痹|魅惑|束缚|失能/i
const traitExplorationWords = /perception|stealth|ability check|hearing|smell|sight|camouflage|track|sense|察觉|隐匿|属性检定|听觉|嗅觉|视觉|伪装|追踪|感知/i
const excludedNarrativeTraitNames = /^(shapechanger|change shape|false appearance|illusory appearance|变形生物|改变形态|虚假外貌|幻象外貌)$/i

function rawMonster(monster) {
  return generatedMonsters.find((entry) => entry.slug === monster.slug)
}

function sectionMembers(monster, section) {
  return monster[section] ?? []
}

function rawAction(monster, section, action) {
  const raw = rawMonster(monster)
  const pool = raw?.[section] ?? []
  return pool.find((entry) => entry.id === action.id) ?? pool.find((entry) => entry.name === action.name)
}

function actionHasSuccessHalf(action) {
  const serialized = JSON.stringify(action)
  return serialized.includes('"damageOnSuccessfulSave":"half"') || serialized.includes('"onSuccess":"half"')
}

function normalizedActionDescription(description) {
  return String(description ?? '')
    .replace(/^Headless[^\n]*\n/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function actionSemanticIssues(monster, section, action) {
  const raw = rawAction(monster, section, action)
  const text = raw?.description ?? action.description ?? ''
  const serialized = JSON.stringify(action).toLowerCase()
  const issues = []
  const siblingEvidence = ['actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions']
    .flatMap((key) => sectionMembers(monster, key))
    .filter((entry) => normalizedActionDescription(entry.description) === normalizedActionDescription(action.description))
  const aggregateEvidence = siblingEvidence.length > 0 ? siblingEvidence : [action]
  const allMonsterActions = ['actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions']
    .flatMap((key) => sectionMembers(monster, key))
  if (action.kind === 'multiattack' && action.sequence?.length) {
    const actionById = new Map(
      ['actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions']
        .flatMap((key) => sectionMembers(monster, key))
        .map((entry) => [entry.id, entry]),
    )
    for (const actionId of action.sequence) {
      const child = actionById.get(actionId)
      if (child) aggregateEvidence.push(child)
    }
  }
  if (action.kind === 'weapon-attack') {
    if (!action.attack && !action.referencedActionId) issues.push('武器攻击缺少 attack 结构或引用动作')
    const toHit = text.match(/\+(\d+) to hit|命中\s*\+(\d+)/i)
    if (toHit && Number(toHit[1] ?? toHit[2]) !== action.attack?.toHit) issues.push('命中加值与原文不一致')
    const reach = text.match(/reach\s+(\d+)\s*ft|触及\s*(\d+)\s*尺/i)
    if (reach && Number(reach[1] ?? reach[2]) !== action.attack?.reachFeet) issues.push('触及距离与原文不一致')
    const range = text.match(/range\s+(\d+)(?:\s*\/\s*(\d+))?\s*ft|射程\s*(\d+)(?:\s*\/\s*(\d+))?\s*尺/i)
    if (range && action.attack && (action.attack.mode === 'ranged' || action.attack.mode === 'melee-or-ranged')) {
      const normal = Number(range[1] ?? range[3])
      const long = Number(range[2] ?? range[4] ?? normal)
      if (normal !== action.attack?.rangeFeet?.normal || long !== action.attack?.rangeFeet?.long) issues.push('射程与原文不一致')
    }
  }
  const dicePools = []
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    if (Number.isFinite(value.count) && Number.isFinite(value.sides)) {
      dicePools.push({ count: Number(value.count), sides: Number(value.sides), bonus: Number(value.bonus ?? value.modifier ?? 0) })
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child === 'object') visit(child)
    }
  }
  aggregateEvidence.forEach(visit)
  const dice = [...text.matchAll(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/gi)]
  for (const match of dice) {
    const expectedPool = {
      count: Number(match[1]),
      sides: Number(match[2]),
      bonus: match[4] ? Number(match[4]) * (match[3] === '-' ? -1 : 1) : 0,
    }
    const found = dicePools.some((pool) => pool.count === expectedPool.count && pool.sides === expectedPool.sides && pool.bonus === expectedPool.bonus)
    const randomRepeatDie = action.kind === 'multiattack' && action.randomRepeat?.dieSides === expectedPool.sides && expectedPool.count === 1
    if (!found && !randomRepeatDie) issues.push(`原文骰池 ${match[0].replaceAll(' ', '')} 未进入结构`)
  }
  if (/must (?:make|succeed on)[^.]{0,50}saving throw|必须[^。；\n]{0,40}豁免|进行一次[^。；\n]{0,30}豁免/i.test(text) && !serialized.includes('saving-throw') && !serialized.includes('saving_throw') && !serialized.includes('"ability"')) {
    issues.push('原文包含豁免，但动作无结构化豁免')
  }
  if (/half as much|half damage|伤害减半|一半伤害/i.test(text) && !actionHasSuccessHalf(action)) issues.push('原文要求成功半伤，但结构未声明半伤')
  if (
    action.kind !== 'multiattack' && actionConditionWords.test(text) &&
    !action.attack?.onHitEffects?.length && !action.attack?.onHitRule && !action.rule && !action.referencedActionId && !action.targetEligibility
  ) issues.push('原文包含状态/擒抱附效，但无结构化附效')
  if (
    action.kind !== 'multiattack' && /escape\s+dc|逃脱\s*dc/i.test(text) &&
    !JSON.stringify(aggregateEvidence).toLowerCase().includes('escapedc') &&
    !allMonsterActions.some((entry) => entry.id.startsWith(`${action.id}-`) && JSON.stringify(entry).toLowerCase().includes('escapedc'))
  ) issues.push('原文包含逃脱 DC，但结构未声明逃脱')
  if (/maximum hit point|hit point maximum|生命值上限/i.test(text) && !/maximumhitpoints?|hitpointmaximum|hit-point-maximum/i.test(serialized)) issues.push('原文包含生命值上限改变，但结构未声明')
  if (/repeat the saving throw|repeat this saving throw|再次进行.*豁免|重复.*豁免/i.test(text) && !/repeatsave|repeat-save/i.test(serialized)) issues.push('原文包含重复豁免，但结构未声明')
  if (/recharge\s*\d|充能\s*\d/i.test(`${raw?.name ?? ''} ${text}`) && !action.usage) issues.push('原文包含充能，但结构未声明资源')
  if (action.kind === 'multiattack') {
    if (!action.sequence?.length && !action.randomRepeat) issues.push('多重攻击没有可执行序列')
    if (/\binstead\b|\beither\b|或者|也可以改为|改为/i.test(text)) {
      const siblings = ['actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions']
        .flatMap((key) => sectionMembers(monster, key))
        .filter((entry) => entry.kind === 'multiattack' && normalizedActionDescription(entry.description) === normalizedActionDescription(action.description))
      if (siblings.length < 2 && !serialized.includes('variant') && !serialized.includes('choice')) issues.push('原文包含多重攻击替代分支，但未发现结构化变体')
    }
  }
  if (action.kind === 'other' && action.automation === 'headless' && !action.rule && !action.referencedActionId && !action.movement) issues.push('Headless 其他动作缺少可执行规则')
  return unique(issues)
}

function memberComplexity(action) {
  const text = action.description ?? ''
  if (action.kind !== 'weapon-attack') return 'complex'
  return /saving throw|豁免|grapple|擒抱|restrain|束缚|poisoned|中毒|prone|倒地|maximum hit point|生命值上限|repeat|再次|until|直到/i.test(text)
    ? 'complex'
    : 'simple-attack'
}

function actionRows(monsters, coverageRows) {
  const coverageByKey = new Map(coverageRows.map((row) => [`${row.monsterId}:${row.section}:${row.actionId}`, row]))
  return monsters.flatMap((monster) => ['actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions'].flatMap((section) =>
    sectionMembers(monster, section).map((action) => {
      const coverage = coverageByKey.get(`${monster.id}:${section}:${action.id}`)
      const issues = actionSemanticIssues(monster, section, action)
      const tests = directMonsterTests(monster, action, section)
      const complexity = memberComplexity(action)
      let status
      if (coverage?.effectiveAutomation === 'non-combat') status = 'non-combat'
      else if (coverage?.effectiveAutomation === 'dm-adjudication') status = 'manual'
      else if (coverage?.effectiveAutomation !== 'headless') status = 'structural-gap'
      else if (issues.length) status = 'semantic-gap'
      else if (complexity === 'complex' && tests.length === 0) status = 'implemented-unverified'
      else status = 'verified-full'
      if (status === 'semantic-gap' && issues.every((issue) => issue.includes('与原文不一致'))) status = 'source-data-mismatch'
      return {
        monsterId: monster.id,
        monster: monster.name,
        slug: monster.slug,
        section,
        actionId: action.id,
        action: action.name,
        kind: action.kind,
        complexity,
        declaredAutomation: action.automation ?? 'implicit',
        structuralAutomation: coverage?.effectiveAutomation ?? 'unknown',
        status,
        issues,
        directTests: tests,
      }
    }),
  ))
}

function rawTrait(monster, index, trait) {
  const raw = rawMonster(monster)
  return raw?.traits?.[index] ?? raw?.traits?.find((entry) => entry.name === trait.name)
}

function runtimeRuleEvidence(kind) {
  if (!kind) return []
  return runtimeFiles.filter((file) => {
    const rel = relative(file)
    if (rel.endsWith('/monsters.ts') || rel.endsWith('/monsterSchema.ts') || rel.endsWith('/monsterHeadlessCoverage.ts')) return false
    const text = fileText(file)
    return quotedToken(text, kind)
  }).map(relative)
}

function ruleKindTests(kind) {
  if (!kind) return []
  return testFiles.filter((file) => quotedToken(fileText(file), kind)).map(relative)
}

function traitRows(monsters) {
  return monsters.flatMap((monster) => monster.traits.map((trait, traitIndex) => {
    const raw = rawTrait(monster, traitIndex, trait)
    const text = raw?.description ?? trait.description ?? ''
    const battleImpact = traitCombatWords.test(text)
    const explorationImpact = traitExplorationWords.test(text)
    const excludedNarrative = excludedNarrativeTraitNames.test(raw?.name ?? trait.name)
    const kind = trait.rule?.kind
    const runtimeConsumers = runtimeRuleEvidence(kind)
    const tests = unique([
      ...directMonsterTests(monster, { id: kind, name: trait.name, englishName: raw?.name }),
      ...ruleKindTests(kind),
    ])
    const issues = []
    const delegatedSpellcasting = /^(spellcasting|innate spellcasting)$/i.test(raw?.name ?? '') && Boolean(monster.spellcasting)
    if (trait.automation === 'headless' && !trait.rule) issues.push('Headless 特质没有结构化 rule')
    if (trait.automation === 'headless' && trait.rule && runtimeConsumers.length === 0) issues.push(`规则 ${kind} 没有生产运行时消费者`)
    if (trait.automation !== 'headless' && battleImpact && !delegatedSpellcasting && !excludedNarrative) issues.push('原文包含战斗效果但仍依赖 DM 裁定')
    let status
    if (delegatedSpellcasting) status = 'delegated-to-monster-spells'
    else if (excludedNarrative) status = 'excluded-narrative-transform'
    else if (issues.length) status = trait.automation === 'headless' ? 'semantic-gap' : 'combat-manual-gap'
    else if (trait.automation === 'headless') status = tests.length === 0 ? 'implemented-unverified' : 'verified-full'
    else if (trait.automation !== 'headless' && explorationImpact) status = 'exploration-manual-gap'
    else if (!battleImpact) status = 'non-combat-or-narrative'
    else status = 'implemented-unverified'
    return {
      monsterId: monster.id,
      monster: monster.name,
      slug: monster.slug,
      traitIndex,
      trait: trait.name,
      sourceTrait: raw?.name,
      declaredAutomation: trait.automation ?? 'implicit',
      ruleKind: kind,
      battleImpact,
      explorationImpact,
      excludedNarrative,
      delegatedSpellcasting,
      status,
      issues,
      runtimeConsumers,
      directTests: tests,
    }
  }))
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(' | ') : typeof value === 'object' && value != null ? JSON.stringify(value) : String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function csv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n') + '\n'
}

function markdownTable(rows, columns) {
  const escape = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
  return [
    `| ${columns.map((column) => column.label).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((column) => escape(column.value(row))).join(' | ')} |`),
  ].join('\n')
}

function writeReports(report) {
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(path.join(outputDir, 'spells.csv'), csv(report.spells.rows, [
    'id', 'name', 'englishName', 'level', 'implementation', 'declaredTarget', 'status', 'expectedSemantics',
    'expectedCapabilities', 'semanticGaps', 'unprovenCapabilities', 'runtimeSpecializations', 'runtimeReferences', 'directTests',
  ]))
  fs.writeFileSync(path.join(outputDir, 'monster-actions.csv'), csv(report.monsterActions.rows, [
    'monsterId', 'monster', 'slug', 'section', 'actionId', 'action', 'kind', 'complexity',
    'declaredAutomation', 'structuralAutomation', 'status', 'issues', 'directTests',
  ]))
  fs.writeFileSync(path.join(outputDir, 'monster-traits.csv'), csv(report.monsterTraits.rows, [
    'monsterId', 'monster', 'slug', 'traitIndex', 'trait', 'sourceTrait', 'declaredAutomation', 'ruleKind',
    'battleImpact', 'status', 'issues', 'runtimeConsumers', 'directTests',
  ]))
  fs.writeFileSync(path.join(outputDir, 'monster-spells.csv'), csv(report.monsterSpells.rows, [
    'monsterId', 'monster', 'slug', 'spellId', 'spell', 'spellAuditStatus', 'status', 'issues',
  ]))

  const semanticSpellGaps = report.spells.rows.filter((row) => row.status === 'semantic-gap')
  const semanticActionGaps = report.monsterActions.rows.filter((row) => row.status === 'semantic-gap')
  const structuralActionGaps = report.monsterActions.rows.filter((row) => row.status === 'structural-gap')
  const combatTraitGaps = report.monsterTraits.rows.filter((row) => row.status === 'combat-manual-gap')
  const traitGapCounts = Object.entries(combatTraitGaps.reduce((counts, row) => {
    const key = row.sourceTrait ?? row.trait
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  const monsterSpellGapIds = unique(report.monsterSpells.rows.filter((row) => row.status === 'semantic-gap').map((row) => row.spellId))
  const bulletList = (rows) => rows.length > 0 ? rows.map((row) => `- ${row}`).join('\n') : '- 无'
  const summary = `# D&D 5e Headless 语义完整性审查\n\n` +
    `生成时间：${report.generatedAt}\n\n` +
    `## 审查口径\n\n` +
    `本报告不采用 \`automation: headless\`、UI 徽章或 schema 通过作为“完整自动化”的证据。` +
    `每条规则同时核对原文语义、结构化定义、生产运行时消费者与直接测试。\n\n` +
    `- **verified-full**：未发现原文语义缺口；复杂规则具有生产消费者和直接测试。\n` +
    `- **implemented-unverified**：结构与消费者看似存在，但缺少该条目的直接结算测试。\n` +
    `- **semantic-gap / structural-gap**：原文条款未进入结构、消费者缺失或结构无效。\n` +
    `- **partial / manual / combat-manual-gap**：仍存在明确或隐含 DM 裁定；其中 combat-manual-gap 会直接影响战斗。\n\n` +
    `## 总览\n\n` +
    `| 范围 | 总数 | 状态统计 |\n| --- | ---: | --- |\n` +
    `| 法术 | ${report.spells.rows.length} | ${Object.entries(report.spells.summary).map(([key, value]) => `${key} ${value}`).join('；')} |\n` +
    `| 怪物动作 | ${report.monsterActions.rows.length} | ${Object.entries(report.monsterActions.summary).map(([key, value]) => `${key} ${value}`).join('；')} |\n` +
    `| 怪物特质 | ${report.monsterTraits.rows.length} | ${Object.entries(report.monsterTraits.summary).map(([key, value]) => `${key} ${value}`).join('；')} |\n` +
    `| 怪物法术引用 | ${report.monsterSpells.rows.length} | ${Object.entries(report.monsterSpells.summary).map(([key, value]) => `${key} ${value}`).join('；')} |\n\n` +
    `## 高置信语义缺口\n\n` +
    `### 法术（${semanticSpellGaps.length}）\n\n` +
    bulletList(semanticSpellGaps.map((row) => `\`${row.id}\` ${row.name}：${row.semanticGaps.join('；')}`)) + '\n\n' +
    `### 已标 Headless、但原文条款未闭环的怪物动作（${semanticActionGaps.length}）\n\n` +
    bulletList(semanticActionGaps.map((row) => `${row.monster} / ${row.action}：${row.issues.join('；')}`)) + '\n\n' +
    `### 结构缺失怪物动作（${structuralActionGaps.length}）\n\n` +
    bulletList(structuralActionGaps.map((row) => `${row.monster} / ${row.action}${row.issues.length ? `：${row.issues.join('；')}` : ''}`)) + '\n\n' +
    `### 仍由 DM 裁定的战斗特质（${combatTraitGaps.length}）\n\n` +
    bulletList(traitGapCounts.slice(0, 30).map(([name, count]) => `${name}：${count} 个怪物实例`)) + '\n\n' +
    `### 怪物施法兼容缺口\n\n` +
    `共有 ${report.monsterSpells.summary['semantic-gap'] ?? 0} 次法术引用、${monsterSpellGapIds.length} 个不同法术没有通过完整怪物施法语义审查。` +
    `逐个怪物和法术见 \`monster-spells.csv\`。\n\n` +
    `## 重要限制\n\n` +
    `静态语义审查能证明“字段与消费者是否存在”，不能替代浏览器内完整战斗 E2E。` +
    `因此所有缺少逐条直接测试的复杂能力都保守列为 implemented-unverified，而不是完整。\n\n` +
    `逐条结果见同目录 CSV；完整机器可读证据见 \`report.json\`。\n`
  fs.writeFileSync(path.join(outputDir, 'SUMMARY.md'), summary)

  const full = `# 逐条 Headless 审查\n\n` +
    `## 法术（${report.spells.rows.length}）\n\n` +
    markdownTable(report.spells.rows, [
      { label: 'ID', value: (row) => row.id },
      { label: '名称', value: (row) => row.name },
      { label: '来源', value: (row) => row.implementation },
      { label: '结论', value: (row) => row.status },
      { label: '缺口', value: (row) => [...row.semanticGaps, ...row.unprovenCapabilities.map((value) => `未证明能力 ${value}`)].join('；') },
      { label: '直接测试', value: (row) => row.directTests.join('<br>') },
    ]) + `\n\n## 怪物动作（${report.monsterActions.rows.length}）\n\n` +
    markdownTable(report.monsterActions.rows, [
      { label: '怪物', value: (row) => row.monster },
      { label: '栏位', value: (row) => row.section },
      { label: '动作', value: (row) => row.action },
      { label: '结论', value: (row) => row.status },
      { label: '缺口', value: (row) => row.issues.join('；') },
      { label: '直接测试', value: (row) => row.directTests.join('<br>') },
    ]) + `\n\n## 怪物特质（${report.monsterTraits.rows.length}）\n\n` +
    markdownTable(report.monsterTraits.rows, [
      { label: '怪物', value: (row) => row.monster },
      { label: '特质', value: (row) => row.trait },
      { label: '规则', value: (row) => row.ruleKind },
      { label: '结论', value: (row) => row.status },
      { label: '缺口', value: (row) => row.issues.join('；') },
      { label: '直接测试', value: (row) => row.directTests.join('<br>') },
    ]) + `\n\n## 怪物法术引用（${report.monsterSpells.rows.length}）\n\n` +
    markdownTable(report.monsterSpells.rows, [
      { label: '怪物', value: (row) => row.monster },
      { label: '法术', value: (row) => row.spell },
      { label: '法术审查', value: (row) => row.spellAuditStatus },
      { label: '结论', value: (row) => row.status },
      { label: '缺口', value: (row) => row.issues.join('；') },
    ]) + '\n'
  fs.writeFileSync(path.join(outputDir, 'FULL-AUDIT.md'), full)
}

const vite = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const [catalogModule, spellModule, auditedModule, monsterModule, coverageModule] = await Promise.all([
    vite.ssrLoadModule('/src/rulesets/dnd5e/spellCatalog.ts'),
    vite.ssrLoadModule('/src/rulesets/dnd5e/spells.ts'),
    vite.ssrLoadModule('/src/rulesets/dnd5e/activities/dnd5eSrdAuditedSpellActivities.ts'),
    vite.ssrLoadModule('/src/rulesets/dnd5e/monsters.ts'),
    vite.ssrLoadModule('/src/rulesets/dnd5e/monsterHeadlessCoverage.ts'),
  ])
  const coreById = new Map(spellModule.DND5E_SRD_COMBAT_SPELLS.map((spell) => [spell.id, spell]))
  const auditedFull = new Set(auditedModule.DND5E_SRD_AUDITED_FULL_SPELL_IDS)
  const auditedPartial = new Set(auditedModule.DND5E_SRD_AUDITED_PARTIAL_SPELL_IDS)
  const auditedContentById = new Map([
    ...auditedModule.dnd5eSrdAuditedFullContentDefinitionsV1(),
    ...auditedModule.dnd5eSrdAuditedPartialContentDefinitionsV1(),
  ].map((entry) => [entry.id, entry]))
  const spells = catalogModule.DND5E_SRD_SPELL_CATALOG.map((catalog) => {
    const core = coreById.get(catalog.id)
    const target = core ? 'full' : auditedFull.has(catalog.id) ? 'full' : auditedPartial.has(catalog.id) ? 'partial' : decisions[catalog.id]?.[0]
    const definition = core ? undefined : auditedModule.dnd5eSrdAuditedSpellDefinitionV1(catalog.id)
    const contentDefinition = core ? undefined : auditedContentById.get(catalog.id)
    const activity = contentDefinition?.activities ?? (definition ? [auditedModule.dnd5eSrdAuditedSpellActivityV1(catalog.id)] : undefined)
    return spellRow(catalog, core, activity, target)
  })
  const monsterCoverage = coverageModule.auditDnd5eMonsterHeadlessCoverage()
  const actions = actionRows(monsterModule.DND5E_SRD_MONSTERS, monsterCoverage.actions.rows)
  const traits = traitRows(monsterModule.DND5E_SRD_MONSTERS)
  const spellById = new Map(spells.map((spell) => [spell.id, spell]))
  const monsterById = new Map(monsterModule.DND5E_SRD_MONSTERS.map((monster) => [monster.id, monster]))
  const monsterSpells = monsterCoverage.spells.occurrences.map((occurrence) => {
    const monster = monsterById.get(occurrence.monsterId)
    const spell = spellById.get(occurrence.spellId)
    const issues = []
    if (!spell) issues.push('法术不在 SRD 审查目录')
    else if (spell.status !== 'verified-full') issues.push(`继承法术结论：${spell.status}`)
    if (occurrence.compatibility !== 'full') issues.push(occurrence.reason ?? `怪物施法兼容性：${occurrence.compatibility}`)
    return {
      monsterId: occurrence.monsterId,
      monster: monster?.name ?? occurrence.slug,
      slug: occurrence.slug,
      spellId: occurrence.spellId,
      spell: occurrence.spellName,
      spellAuditStatus: spell?.status ?? 'missing',
      status: issues.length ? 'semantic-gap' : 'verified-full',
      issues,
    }
  })
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    evidencePolicy: {
      ignoresLabelsAsProof: true,
      verifiedRequires: ['source semantics', 'structured declaration', 'production runtime consumer', 'direct test for complex mechanics'],
    },
    spells: { summary: countBy(spells, 'status'), rows: spells },
    monsterActions: { summary: countBy(actions, 'status'), rows: actions },
    monsterTraits: { summary: countBy(traits, 'status'), rows: traits },
    monsterSpells: { summary: countBy(monsterSpells, 'status'), rows: monsterSpells },
  }
  writeReports(report)
  console.log(JSON.stringify({
    outputDir: relative(outputDir),
    spells: report.spells.summary,
    monsterActions: report.monsterActions.summary,
    monsterTraits: report.monsterTraits.summary,
    monsterSpells: report.monsterSpells.summary,
  }, null, 2))
} finally {
  await vite.close()
}
