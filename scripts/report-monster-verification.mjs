import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const root = process.cwd()
const input = path.resolve(process.env.STARS_MONSTER_INVENTORY_DIR ?? '.codex-temp/monster-verification-20260904')
const output = path.resolve('docs/monster-verification-2026-09-04')
for (const directory of [input, output]) if (path.relative(root, directory).startsWith('..')) throw new Error('verification paths must stay inside repository')
const read = (name, fallback = []) => fs.existsSync(path.join(input, name)) ? JSON.parse(fs.readFileSync(path.join(input, name), 'utf8')) : fallback
const catalog = read('catalog.json')
if (catalog.length !== 334) throw new Error(`Expected reviewed 334-monster inventory; received ${catalog.length}`)
const abolethMultiattackUiPath = path.join(root, '.codex-temp', 'aboleth-verification-20260905', 'ui-evidence.json')
const abolethMultiattackUi = fs.existsSync(abolethMultiattackUiPath)
  ? JSON.parse(fs.readFileSync(abolethMultiattackUiPath, 'utf8'))
  : null
const dryadShillelaghUiPath = path.join(root, '.codex-temp', 'monster-headless-followup-20260905', 'ui-evidence.json')
const dryadShillelaghUi = fs.existsSync(dryadShillelaghUiPath)
  ? JSON.parse(fs.readFileSync(dryadShillelaghUiPath, 'utf8'))
  : null
const krakenLightningUiPath = path.join(root, '.codex-temp', 'kraken-lightning-verification-20260905', 'ui-evidence.json')
const krakenLightningUi = fs.existsSync(krakenLightningUiPath)
  ? JSON.parse(fs.readFileSync(krakenLightningUiPath, 'utf8'))
  : null
const krakenBiteUiPath = path.join(root, '.codex-temp', 'kraken-bite-verification-20260905', 'ui-evidence.json')
const krakenBiteUi = fs.existsSync(krakenBiteUiPath)
  ? JSON.parse(fs.readFileSync(krakenBiteUiPath, 'utf8'))
  : null
const mummySandUiPath = path.join(root, '.codex-temp', 'mummy-sand-verification-20260905', 'ui-evidence.json')
const mummySandUi = fs.existsSync(mummySandUiPath)
  ? JSON.parse(fs.readFileSync(mummySandUiPath, 'utf8'))
  : null
const homunculusBiteUiPath = path.join(root, '.codex-temp', 'homunculus-bite-verification-20260905', 'ui-evidence.json')
const homunculusBiteUi = fs.existsSync(homunculusBiteUiPath)
  ? JSON.parse(fs.readFileSync(homunculusBiteUiPath, 'utf8'))
  : null
const nightmareEtherealUiPath = path.join(root, '.codex-temp', 'nightmare-ethereal-verification-20260905', 'ui-evidence.json')
const nightmareEtherealUi = fs.existsSync(nightmareEtherealUiPath)
  ? JSON.parse(fs.readFileSync(nightmareEtherealUiPath, 'utf8'))
  : null
const blinkDogTeleportUiPath = path.join(root, '.codex-temp', 'blink-dog-teleport-verification-20260905', 'ui-evidence.json')
const blinkDogTeleportUi = fs.existsSync(blinkDogTeleportUiPath)
  ? JSON.parse(fs.readFileSync(blinkDogTeleportUiPath, 'utf8'))
  : null
const monsterUiCatchupDirectory = path.join(root, '.codex-temp', 'monster-ui-catchup-20260905')
const monsterUiCatchupBySlug = new Map(
  ['purple-worm', 'tribal-warrior', 'guard'].flatMap((slug) => {
    const file = path.join(monsterUiCatchupDirectory, `${slug}.json`)
    return fs.existsSync(file) ? [[slug, JSON.parse(fs.readFileSync(file, 'utf8'))]] : []
  }),
)
const challengeValue = rating => {
  const [numerator, denominator] = String(rating ?? '0').split('/').map(Number)
  return denominator ? numerator / denominator : numerator || 0
}
const orderedCatalog = [...catalog].sort((left, right) =>
  challengeValue(right.challenge?.rating) - challengeValue(left.challenge?.rating) ||
  left.name.localeCompare(right.name, 'zh-CN'))
const fullSuite = read('full-suite-final.json', null)
const runtime = ['weapon', 'area', 'multiattack', 'special', 'legendary', 'trait', 'trigger', 'lifecycle', 'defense', 'on-hit', 'calendar'].flatMap(kind =>
  read(`${kind}-runtime.json`).map(record => ({ ...record, verificationFamily: kind })))
// These existing regression suites exercise the remaining relation/reaction
// handlers. Retain assertion names instead of manufacturing runtime events.
const targeted = read('area-tests.json', null)?.testResults ?? []
const semanticTargeted = read('semantic-boundaries-tests.json', null)?.testResults ?? []
const targetedActions = [
  ...['bandit-captain', 'erinyes', 'gladiator', 'knight', 'marilith', 'noble'].map(slug =>
    [slug, 'reactions', 'parry', 'monsterParryHeadless.test.ts', slug]),
  ['chain-devil', 'reactions', 'unnerving-mask', 'monsterChainDevilUnnervingMaskHeadless.test.ts'],
  ['roper', 'actions', 'reel', 'monsterRoperReelMultiattack.test.ts'],
  ['shambling-mound', 'actions', 'engulf', 'monsterShamblingMoundEngulf.test.ts'],
]
for (const [slug, section, actionId, file, filter] of targetedActions) {
  const suite = targeted.find(suite => suite.name.endsWith('/' + file))
  if (!suite || suite.status !== 'passed') continue
  for (const assertion of suite.assertionResults.filter(assertion => assertion.status === 'passed' && (!filter || assertion.fullName.includes(filter))))
    runtime.push({ slug, section, actionId, scenario: assertion.fullName, verificationFamily: 'targeted', testFile: file })
}
const krakenFlingSuite = semanticTargeted.find(suite =>
  suite.name.endsWith('/monsterKrakenFling.test.ts'))
if (krakenFlingSuite?.status === 'passed') {
  for (const actionId of ['fling', 'legendary-fling']) {
    runtime.push({
      slug: 'kraken',
      section: actionId === 'fling' ? 'actions' : 'legendaryActions',
      actionId,
      scenario: 'relation, size, forced movement, collision damage, prone, release, rollback',
      verificationFamily: 'semantic',
      testFile: 'monsterKrakenFling.test.ts',
    })
  }
}
const krakenLightningSuite = semanticTargeted.find(suite =>
  suite.name.endsWith('/monsterKrakenBoundaryVerification.test.ts'))
if (krakenLightningSuite?.status === 'passed') {
  for (const [section, actionId] of [
    ['actions', 'lightning-storm'],
    ['legendaryActions', 'lightning-storm-costs-2-actions'],
  ]) {
    runtime.push({
      slug: 'kraken',
      section,
      actionId,
      scenario: 'three independent bolts, repeated targets, per-bolt saves, legendary cost, atomic rollback',
      verificationFamily: 'semantic',
      testFile: 'monsterKrakenBoundaryVerification.test.ts',
    })
  }
}
const swallowLifecycleSuite = semanticTargeted.find(suite =>
  suite.name.endsWith('/monsterComplexRelationMultiattacks.test.ts'))
if (swallowLifecycleSuite?.status === 'passed') {
  for (const [slug, actionId] of [
    ['kraken', 'bite'],
    ['purple-worm', 'bite'],
  ]) {
    runtime.push({
      slug,
      section: 'actions',
      actionId,
      scenario: 'swallow relation, total cover, internal attack, source death, movement-cost corpse exit, prone',
      verificationFamily: 'semantic',
      testFile: 'monsterComplexRelationMultiattacks.test.ts',
    })
  }
}
const abolethRuntimeSuite = read('legendary-tests.json', null)?.testResults
  ?.find(suite => suite.name.endsWith('/monsterResourceActions.test.ts'))
const abolethMultiattackAssertion = abolethRuntimeSuite?.assertionResults.find(assertion =>
  assertion.status === 'passed' &&
  assertion.fullName.includes('resolves all three aboleth Tentacle attacks and their disease saves independently'))
if (abolethMultiattackAssertion) {
  runtime.push({
    slug: 'aboleth', section: 'actions', actionId: 'multiattack',
    scenario: 'three targets: failed save / successful save / disease immunity',
    verificationFamily: 'legendary', testFile: 'monsterResourceActions.test.ts',
  })
  runtime.push({
    slug: 'aboleth', section: 'actions', actionId: 'tentacle',
    scenario: 'persistent disease: failed save / successful save / disease immunity',
    verificationFamily: 'legendary', testFile: 'monsterResourceActions.test.ts',
  })
}
const actionRegressions = [
  ['lich', 'legendaryActions', 'cantrip', 'legendary-tests.json', 'monsterResourceActions.test.ts', 'Lich Cantrip'],
  ['androsphinx', 'legendaryActions', 'cast-a-spell-costs-3-actions', 'semantic-boundaries-tests.json', 'monsterCoreSpellAction.test.ts', 'off-turn Sphinx spell'],
  ['gynosphinx', 'legendaryActions', 'cast-a-spell-costs-3-actions', 'semantic-boundaries-tests.json', 'monsterCoreSpellAction.test.ts', 'off-turn Sphinx spell'],
  ['ghost', 'actions', 'etherealness', 'semantic-boundaries-tests.json', 'monsterTeleportInvisibility.test.ts', 'Etherealness'],
  ['succubus-incubus', 'actions', 'etherealness', 'semantic-boundaries-tests.json', 'monsterTeleportInvisibility.test.ts', 'Etherealness'],
  ['succubus-incubus', 'actions', 'draining-kiss', 'semantic-boundaries-tests.json', 'monsterTeleportInvisibility.test.ts', 'Draining Kiss'],
  ['nightmare', 'actions', 'ethereal-stride-self-only', 'semantic-boundaries-tests.json', 'monsterTeleportInvisibility.test.ts', 'Nightmare zero-passenger Ethereal Stride'],
  ['blink-dog', 'actions', 'teleport-only', 'semantic-boundaries-tests.json', 'monsterTeleportInvisibility.test.ts', 'Blink Dog teleport-only choice'],
]
for (const [slug, section, actionId, reportFile, testFile, pattern] of actionRegressions) {
  const report = read(reportFile, null)
  const suite = report?.testResults.find(candidate => candidate.name.endsWith('/' + testFile))
  if (!suite || suite.status !== 'passed') continue
  const assertions = suite.assertionResults.filter(assertion =>
    assertion.status === 'passed' && assertion.fullName.includes(pattern))
  for (const assertion of assertions) runtime.push({
    slug, section, actionId, scenario: assertion.fullName,
    verificationFamily: reportFile.startsWith('legendary') ? 'legendary' : 'semantic',
    testFile,
  })
}
// Explicit links to existing trigger regressions. Only passing runtime assertions
// are linked; schema declarations alone never satisfy a trait trigger.
const traitRegressions = [
  ['aboleth', 'mucous-cloud', 'lifecycle', 'lifecycle-tests.json', 'monsters.test.ts', 'resolves the aboleth mucous cloud'],
  ['goblin', 'nimble-escape', 'lifecycle', 'lifecycle-tests.json', 'monsters.test.ts', 'validates Nimble Escape'],
  ['assassin', 'assassinate', 'trigger', 'trigger-tests.json', 'monsterCatalogAttackTraitRuntime.test.ts', 'gives Assassin|turns an Assassin'],
  ['spy', 'sneak-attack', 'trigger', 'trigger-tests.json', 'monsterCatalogAttackTraitRuntime.test.ts', 'Spy Sneak Attack'],
  ['hobgoblin', 'martial-advantage', 'trigger', 'trigger-tests.json', 'monsterCatalogAttackTraitRuntime.test.ts', 'Hobgoblin Martial Advantage'],
  ['marilith', 'reactive', 'targeted', 'area-tests.json', 'monsterParryHeadless.test.ts', 'Reactive'],
  ['flesh-golem', 'berserk', 'lifecycle', 'lifecycle-tests.json', 'fleshGolemHeadless.test.ts', 'low-HP d6 Berserk|nearer allied creature|ends Berserk'],
  ['flesh-golem', 'damage-aversion', 'lifecycle', 'lifecycle-tests.json', 'fleshGolemHeadless.test.ts', 'fire aversion'],
  ['flesh-golem', 'damage-absorption', 'lifecycle', 'lifecycle-tests.json', 'fleshGolemHeadless.test.ts', 'lightning damage into healing'],
  ['berserker', 'reckless', 'lifecycle', 'lifecycle-tests.json', 'monsterTriggeredAttackTraits.test.ts', 'Berserker and Minotaur Reckless lifecycle'],
  ['minotaur', 'reckless', 'lifecycle', 'lifecycle-tests.json', 'monsterTriggeredAttackTraits.test.ts', 'Berserker and Minotaur Reckless lifecycle'],
  ['bugbear', 'surprise-attack', 'lifecycle', 'lifecycle-tests.json', 'monsterTriggeredAttackTraits.test.ts', 'inherits bugbear primary damage'],
  ['doppelganger', 'surprise-attack', 'lifecycle', 'lifecycle-tests.json', 'monsterTriggeredAttackTraits.test.ts', 'inherits doppelganger primary damage|applies Doppelganger Surprise|does not append Surprise'],
  ['doppelganger', 'ambusher-attack-advantage', 'lifecycle', 'lifecycle-tests.json', 'monsterTriggeredAttackTraits.test.ts', 'grants Doppelganger Ambusher'],
]
for (const [slug, kind, family, reportFile, testFile, pattern] of traitRegressions) {
  const monster = catalog.find(monster => monster.slug === slug)
  const traitIndex = monster?.traits.findIndex(trait => trait.rule?.kind === kind)
  const report = read(reportFile, null)
  const suite = report?.testResults.find(suite => suite.name.endsWith('/' + testFile))
  if (traitIndex == null || traitIndex < 0 || !suite || suite.status !== 'passed') continue
  for (const assertion of suite.assertionResults.filter(assertion => assertion.status === 'passed' && new RegExp(pattern).test(assertion.fullName)))
    runtime.push({ slug, traitIndex, scenario: assertion.fullName, verificationFamily: family, testFile })
}
const assassinSneakIndex = catalog.find(monster => monster.slug === 'assassin').traits.findIndex(trait => trait.rule?.kind === 'sneak-attack')
for (const record of runtime.filter(record => record.slug === 'assassin' && record.verificationFamily === 'weapon' && ['hit', 'critical'].includes(record.scenario)))
  runtime.push({ ...record, traitIndex: assassinSneakIndex, actionId: undefined,
    scenario: record.actionId + ': ' + record.scenario + ' (Sneak Attack damage included in asserted HP delta)' })
const ui = ['monsters', 'weapons', 'specials'].flatMap(mode => {
  const directory = path.join(input, 'ui-cases', mode)
  return fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => name.endsWith('.json'))
    .map(name => ({ ...JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')), evidenceFile: `ui-cases/${mode}/${name}` })) : []
})
const latestTests = [
  ['semantic', 'semantic-boundaries-tests.json'], ['weapon', 'weapon-boundaries-tests.json'], ['area', 'area-tests.json'], ['multiattack', 'multiattack-tests.json'],
  ['special', 'legendary-tests.json'], ['legendary', 'legendary-tests.json'],
  ['trait', 'trait-tests.json'], ['trigger', 'trigger-tests.json'], ['targeted', 'area-tests.json'],
  ['lifecycle', 'lifecycle-tests.json'], ['defense', 'defense-tests.json'],
  ['on-hit', 'on-hit-tests.json'], ['calendar', 'calendar-tests.json'], ['attack-authority', 'attack-authority-tests.json'],
].map(([kind, name]) => {
  const report = read(name, null)
  return { kind, report, name }
})
const cleanRuntimeSuites = new Set(latestTests.filter(entry => entry.report && entry.report.numFailedTests === 0 && entry.report.numPassedTests > 0).map(entry => entry.kind))
const escape = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
const fields = (value, prefix = '') => {
  if (Array.isArray(value)) return [...new Set(value.flatMap(item => fields(item, `${prefix}[]`)))]
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => fields(item, prefix ? `${prefix}.${key}` : key))
  return [prefix]
}
const summaries = []
fs.mkdirSync(path.join(output, 'monsters'), { recursive: true })
fs.mkdirSync(path.join(output, 'evidence'), { recursive: true })

for (const monster of orderedCatalog) {
  const records = runtime.filter(record => record.slug === monster.slug)
  const uiRecords = ui.filter(record => record.slug === monster.slug)
  const latestMonsterUi = uiRecords.filter(record => record.mode === 'monsters').sort((a, b) => (a.finishedAt ?? '').localeCompare(b.finishedAt ?? '')).at(-1)
  const specialUiRecords = uiRecords.filter(record => record.mode === 'specials')
    .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
  const sections = [['actions', '动作'], ['bonusActions', '附赠动作'], ['reactions', '反应'], ['legendaryActions', '传奇动作'], ['lairActions', '巢穴动作']]
  const actions = sections.flatMap(([key, label]) => (monster[key] ?? []).map(action => ({ action, key, label })))
  const rows = actions.map(({ action, key, label }) => {
    const matched = records.filter(record => record.actionId === action.id && (record.section ?? 'actions') === key)
    // An explicit semantic boundary suite supersedes incidental records from a
    // broader catalog family that may contain an unrelated failure elsewhere.
    const suiteClean = matched.some(record =>
      record.verificationFamily === 'semantic' && cleanRuntimeSuites.has('semantic')) ||
      matched.every(record => cleanRuntimeSuites.has(record.verificationFamily))
    // Rejected invalid input is an expected passing branch in these suites.
    const passed = matched.length > 0 && suiteClean
    return { section: key, sectionLabel: label, id: action.id, name: action.name, automation: action.automation,
      rule: action.rule?.kind ?? action.kind, fieldPaths: fields(action),
      runtime: passed ? '通过' : matched.length ? '需复核当前测试结果' : action.automation === 'headless' ? '尚未纳入本次目录矩阵' : 'DM 裁定 / 非战斗',
      scenarios: [...new Set(matched.map(record => record.scenario))] }
  })
  const uncovered = rows.filter(row => row.automation === 'headless' && row.runtime !== '通过')
  const manual = rows.filter(row => row.automation !== 'headless')
  const traitRows = (monster.traits ?? []).map((trait, index) => {
    const matched = records.filter(record => record.traitIndex === index)
    return { id: trait.id, name: trait.name, automation: trait.automation, rule: trait.rule?.kind, fields: fields(trait),
      runtime: matched.length && matched.every(record => cleanRuntimeSuites.has(record.verificationFamily)) ? '通过' : trait.automation === 'headless' ? '待专项确认' : 'DM 裁定 / 情境判断',
      scenarios: [...new Set(matched.map(record => record.scenario))], boundaries: [...new Set(matched.map(record => record.boundary).filter(Boolean))] }
  })
  const bugs = []
  if (['vampire-mist', 'vampire-bat'].includes(monster.slug)) bugs.push('已修复：目录原先从本体复制了当前形态不允许的传奇攻击。雾化形态不再提供传奇动作；蝙蝠形态保留移动与啃咬，移除传奇徒手打击。已验证旧动作 ID 在权威入口被拒绝，且不扣点、不伤害目标。')
  if (['giant-rat-diseased', 'mummy', 'mummy-lord'].includes(monster.slug)) bugs.push('已修复：命中特效声明的每 24 小时降低生命值上限原先被运行状态丢弃，时钟也未执行。现已覆盖状态持久化、时间边界、重复同步去重、连续两次恶化、重施不推迟原时钟、治愈后的上限恢复，以及木乃伊诅咒将上限降至零时的遗体毁灭。')
  if (['minotaur', 'berserker'].includes(monster.slug)) bugs.push('已修复：鲁莽攻击必须在本回合显式启用；启用本身不消耗动作。攻击者优势与敌人攻击它的优势分别结算，来源下一回合开始时清除。牛头人的完整双端 UI 周期已另行手动复核。')
  if (monster.slug === 'aboleth') bugs.push('已修复：旧语义安全名单会把已结构化的触手重新降级，并连带禁用多重攻击。触手现使用逐次命中的持久疾病效果；三次触手各自结算体质豁免，疾病免疫会跳过豁免，多重攻击只消耗一次动作。7073/7074 双端真实 UI 已验证三次命中、疾病状态、HP 与日志同步。')
  if (monster.slug === 'aboleth') bugs.push('保留边界：疾病最初 1 分钟后的“离水时不能恢复生命值”、每 10 分钟 1d12 强酸伤害、浸湿皮肤豁免，以及治疗术／6 环以上治病法术的解除限制，依赖战役时间、环境和施法来源；当前会保留来源绑定疾病记录，由 DM 处理这些跨场景分支。')
  if (['animated-armor', 'flying-sword', 'rug-of-smothering'].includes(monster.slug)) bugs.push('已修复：反魔法易感特性原先被怪物自身 schema 拒绝；目录往返解析已通过。')
  if (monster.slug === 'kraken') bugs.push('已修复：闪电风暴现在要求恰好分配三束闪电，同一生物可重复选择；每束独立进行 DC 23 敏捷豁免和 4d10 雷电伤害结算。普通动作只消耗一次动作，传奇版只消耗 2 点；缺束、多束或骰值不完整会原子回滚。')
  if (monster.slug === 'kraken') bugs.push('保留边界：当前地图战斗目标模型只把生物交给豁免处理器；原文允许闪电命中物体，物体作为目标时仍需 DM 裁定。')
  if (monster.slug === 'kraken') bugs.push('已修复：安全名单曾把已经完整结构化的触手、抓取关系、甩掷移动、碰撞伤害、倒地及其多重攻击和传奇引用全部降级。现已恢复 Headless；关系容量、目标体型、距离、移动、伤害骰、一次动作消耗和失败时原子回滚均由权威引擎验证。')
  if (monster.slug === 'kraken') bugs.push('已修复：啃咬现在只接受已被触手抓住的大型或更小目标；命中后结束触手抓取并建立吞咽关系，自动处理目盲、束缚、12d6 胃酸、50 点体内伤害触发的 DC 25 反刍、体内外全掩护，以及死亡后花费 15 尺移动离开尸体并倒地。')
  if (monster.slug === 'purple-worm') bugs.push('已修复：尾部螫针已有完整的命中、穿刺伤害、DC 19 体质豁免、12d6 毒素伤害及成功减半结算，却被安全名单误降级。现已恢复为 Headless。')
  if (monster.slug === 'purple-worm') bugs.push('已修复：啃咬的吞咽关系现已覆盖 DC 19 敏捷豁免、体内外全掩护、6d6 胃酸、30 点体内伤害触发的 DC 21 反刍，以及紫虫死亡后花费 20 尺移动离开尸体并倒地；啃咬及多重攻击现可由 Headless 完整结算。')
  if (monster.slug === 'lich') bugs.push('已修复：传奇动作“戏法”不再整体降级为 DM 裁定。回合结束窗口只列出巫妖法术表中的 0 环法术；已注册的冷冻射线走统一 Headless 攻击、伤害、减速与传奇动作点结算，法师之手和魔法伎俩仍按所选法术进入 DM 裁定。非戏法与巫妖自己回合的伪造请求会被原子拒绝。')
  if (['androsphinx', 'gynosphinx'].includes(monster.slug)) bugs.push('已修复：传奇动作“施放法术”现在是交互式 Headless 选择入口。选中的每一道法术独立检查处理器与剩余法术位；完整处理器直接结算目标、骰子、效果、法术位和 3 点传奇动作，叙事或缺少处理器的法术只把该次选择交给 DM。')
  if (monster.slug === 'solar') bugs.push('保留边界：飞剑需要一个持续存在且可独立移动的剑实体、每轮奖励动作指令、可见性判断、以太阳神侍为来源的受击/效果代理，以及太阳神侍死亡时坠落。当前地图与怪物状态模型尚未同时表达这些字段，因此继续由 DM 裁定，避免只自动结算首次攻击后丢失后续生命周期。')
  if (monster.slug === 'ghost') bugs.push('已修复：以太化现在是自身位面切换的 Headless 动作。进入后会写入永久位面状态，允许穿过物质碰撞并使用不受限的垂直移动，同时双向阻止跨位面视线、攻击与效果；再次使用会只移除该怪物动作创建的位面状态。伪造目标或骰值会在消耗动作前拒绝。')
  if (monster.slug === 'succubus-incubus') bugs.push('已修复：以太化现在通过与幽灵相同的自身位面切换事务自动结算，并保留其“魔法”来源字段。怪物控制栏提供无目标执行按钮，进入／返回都会消耗一次动作并同步地图状态。')
  if (monster.slug === 'succubus-incubus') bugs.push('已修复：吸命之吻现在验证 5 尺距离，以及“被同一来源魅惑或由 DM 明确确认自愿”的目标资格；随后自动完成 DC 15 体质豁免、5d10+5 心灵伤害、成功减半、按实际承受伤害降低生命上限、长休恢复记录，以及生命上限降至 0 时立即死亡。')
  if (monster.slug === 'mummy-lord') bugs.push('已修复：沙旋风现在以 Headless 传奇移动窗口结算，固定授予 60 尺可选移动并扣除 2 点；移动窗口内免疫所有伤害及擒抱、石化、倒地、束缚、震慑，移动完成或先攻边界改变时立即清除。7073/7074 双端真实 UI 已验证点数、落点、状态和日志同步。')
  if (monster.slug === 'homunculus') bugs.push('已修复：啃咬不再因“豁免失败 5 点或更多”而整体降级。命中后会自动结算 DC 10 体质豁免；普通失败中毒 1 分钟，深度失败额外掷 1d10 分钟，并让中毒与昏迷共享该持续时间。昏迷依赖中毒，受伤或被唤醒会结束。7073/7074 双端真实 UI 已验证掷出 5 分钟后写入 50 回合的两种状态、1 点伤害和双端日志。')
  if (monster.slug === 'nightmare') bugs.push('已修复：以太步行原文允许梦魇兽选择零名同行者，因此新增“仅自身”Headless 分支。执行后会自动写入以太位面、忽略物质碰撞、不受限垂直移动与跨位面效果抑制字段；再次执行可返回物质位面。携带至多三名 5 尺内自愿生物的完整分支仍由 DM 裁定。7073/7074 双端真实 UI 已验证动作消耗、位面效果和日志同步。')
  if (monster.slug === 'blink-dog') bugs.push('已修复：传送原文中的啃咬是可选项，因此新增“不啃咬、仅传送”的完整 Headless 分支。普通怪物传送现已接入地图落点选择，并由 Host 重新检查 40 尺范围、可见、未占据、地图边界和几何阻挡；成功后消耗动作与充能。原先包含传送前／后啃咬顺序的复合入口仍由 DM 裁定。7073/7074 双端真实 UI 已验证移动 40 尺、HP 不变、充能消耗和日志同步。')
  if (monster.slug === 'ice-devil') bugs.push('保留边界：冰墙包含墙段实体、每段 AC/HP、抗性与火焰易伤、被墙穿过时的推向一侧选择、首次敏捷豁免，以及持续冷气范围和进入触发。当前不能完整表达所有墙段生命周期，因此继续由 DM 裁定。')
  if (['vampire-bat', 'vampire-vampire'].includes(monster.slug)) bugs.push('保留边界：夜之子需要户外且非日光环境、两种不同召唤表、1d4 轮延迟到达、持续一小时／来源死亡结束和奖励动作遣散；现有召唤规则只支持单一怪物类型与固定出现时机，因此继续由 DM 裁定。')
  if (monster.slug === 'djinni') bugs.push('保留边界：制造旋风需要持续、可移动且依赖视线的区域实体，并携带被束缚目标、处理进入触发、营救检定和脱离放置。现有区域规则尚不能完整结算这些关系字段。')
  if (monster.slug === 'treant') bugs.push('保留边界：活化树木要求选择真实地形树，创建带临时属性覆盖的树人实体，并跟踪一天、距离、来源死亡、奖励动作解除和重新扎根。当前召唤模型没有地形实体选择与属性覆盖。')
  if (monster.slug === 'chain-devil') bugs.push('保留边界：活化锁链会建立四个独立物体生物，各自拥有 AC、HP、抗性、免疫、擒抱和动作抑制，并动态扩展多重攻击；当前召唤与关系模型不能一次完整承载这些字段。')
  if (monster.slug === 'cloaker') bugs.push('保留边界：幻象需要在非明亮光照下创建三个分身，并同时拦截攻击与有害法术；分身还要独立使用斗篷怪 AC／豁免并在进入明亮光照时消失。现有镜影拦截器只完整覆盖攻击，尚未覆盖有害法术与光照生命周期，因此不能安全开放整项 Headless。')
  if (monster.slug === 'shield-guardian') bugs.push('保留边界：护盾反应必须先知道护符当前佩戴者，并验证守卫与佩戴者相距 5 尺；现有战斗状态没有护符所有权／佩戴关系，无法可靠选择被保护目标，因此继续由 DM 裁定。')
  if (monster.slug === 'stone-giant') bugs.push('保留边界：接岩石只对“岩石或类似物体”的投掷命中触发，随后还要消耗反应并通过 DC 10 敏捷豁免才能完全免除钝击伤害。当前通用攻击载荷没有可信的投射物类别字段，不能把所有远程攻击误判成岩石。')
  if (monster.slug === 'air-elemental') bugs.push('保留边界：旋风的首次力量豁免与伤害可结构化，但随机方向抛飞、撞击物体的逐 10 尺伤害、撞上另一生物时的第二次敏捷豁免与倒地必须绑定同一次移动事务；完整碰撞链建立前继续由 DM 裁定。')
  if (monster.slug === 'water-elemental') bugs.push('保留边界：淹没需要按体型维护“一只大型或两只中型以下”的容量、擒抱／束缚／无法呼吸、每回合开始伤害、成功目标自行移出占地，以及第三方救援检定；现有单次范围豁免不能完整表达这些跨回合关系。')
  if (monster.slug === 'night-hag') bugs.push('保留边界：以太化本身可复用位面切换处理器，但夜巫必须持有心石才能使用；怪物物品栏尚未权威记录心石的持有、转移和失去，不能跳过这个先决条件自动结算。')
  if (monster.slug === 'unicorn') bugs.push('保留边界：传送必须同时选择独角兽与至多三个 5 尺内、可见且自愿的生物，并前往一英里内熟悉地点；当前怪物传送只支持单体地图内落点，不能丢失同行目标与熟悉地点字段。')
  if (monster.slug === 'wraith') bugs.push('保留边界：制造幽魂需要确认 10 尺内人形尸体在一分钟内暴死，在尸体位置或最近空位生成幽魂，并把来源控制上限维持在七只；尸体时间账本虽已存在，召唤放置和来源控制容量还没有合并为一个原子事务。')
  if (['druid', 'dryad'].includes(monster.slug)) bugs.push('已修复：怪物核心法术现在能完整施放橡棍术，把 10 回合效果绑定到德鲁伊长棍或树精短棒，并记录各自的施法属性。强化攻击分支只有在该来源效果实际存在时才开放；未施法、效果过期或伪造分支会在扣除动作前被拒绝。')
  if (['half-red-dragon-veteran', 'veteran', 'hobgoblin'].includes(monster.slug)) bugs.push('已修复：长剑原文的一手／双手伤害选择不再导致整项动作降级。两种握法现在是独立 Headless 动作，分别校验 1d8 与 1d10 伤害；半红龙老兵和老兵还提供只用长剑、双手长剑，以及带可选短剑的完整多重攻击分支。')
  if (['gnoll', 'guard', 'tribal-warrior'].includes(monster.slug)) bugs.push('已修复：长矛的近战／投掷与双手近战分支已拆成明确 Headless 动作。单手分支保留 5 尺触及、20/60 尺射程与 1d6 伤害；双手近战分支限定近战并使用 1d8，不再因选择字段而整体交给 DM。')
  if (monster.legendaryActions?.some(action => action.rule?.kind === 'ability-check')) bugs.push('已修复入口：传奇侦测不再错误要求 DM 手工裁定；检定骰、修正值与传奇动作点走 Headless。真实 UI 专项已验证按钮、窗口、点数消耗及双端日志。')
  if (monster.legendaryActions?.some(action => ['legendary-wing-attack', 'grant-movement'].includes(action.rule?.kind))) bugs.push('已修复运行时与入口：传奇移动使用当前窗口内的一次可选额度，不再累加到普通移动池；翼击限定飞行。已覆盖超距、模式错误、重复和过期请求；真实 UI 专项已覆盖取消移动与完成移动。')
  if (latestMonsterUi?.status === 'failed') bugs.push('UI 用例当前失败，尚不能认定为怪物规则缺陷：需要区分实际产品问题、测试前置条件和开发过程中的热更新中断。详见证据摘要。')
  const uncoveredTraits = traitRows.filter(trait => trait.automation === 'headless' && trait.runtime !== '通过')
  const monsterUiCatchup = monsterUiCatchupBySlug.get(monster.slug)
  const supplementalUiRecords = [
    monster.slug === 'aboleth' ? abolethMultiattackUi : null,
    monster.slug === 'dryad' ? dryadShillelaghUi : null,
    monster.slug === 'kraken' ? krakenLightningUi : null,
    monster.slug === 'kraken' ? krakenBiteUi : null,
    monster.slug === 'mummy-lord' ? mummySandUi : null,
    monster.slug === 'homunculus' ? homunculusBiteUi : null,
    monster.slug === 'nightmare' ? nightmareEtherealUi : null,
    monster.slug === 'blink-dog' ? blinkDogTeleportUi : null,
    monsterUiCatchup,
  ].filter(Boolean)
  const effectiveUiStatus = latestMonsterUi?.status === 'failed'
    ? 'failed'
    : supplementalUiRecords.some(record => record.status === 'passed')
      ? 'passed'
      : latestMonsterUi?.status ?? 'pending'
  const verdict = effectiveUiStatus === 'failed'
    ? 'UI 待复核'
    : uncovered.length || uncoveredTraits.length
      ? '部分验证通过，仍有覆盖缺口'
      : manual.length
        ? 'Headless 已验证，仍有 DM 裁定边界'
        : effectiveUiStatus === 'pending'
          ? '数值验证通过，UI 待执行'
          : '本次已覆盖范围通过'
  const result = { id: monster.id, slug: monster.slug, name: monster.name, verdict, bugs, rows,
    ui: [
      ...uiRecords.map(({ dock, dmText, playerText, actorState, ...record }) => record),
      ...(monster.slug === 'aboleth' && abolethMultiattackUi
        ? [{ ...abolethMultiattackUi, mode: 'multiattack-special', actionId: 'multiattack' }]
        : []),
      ...(monster.slug === 'dryad' && dryadShillelaghUi
        ? [{ ...dryadShillelaghUi, mode: 'spell-action-special', actionId: 'club-shillelagh' }]
        : []),
      ...(monster.slug === 'kraken' && krakenLightningUi
        ? [{ ...krakenLightningUi, mode: 'area-action-special', actionId: 'lightning-storm' }]
        : []),
      ...(monster.slug === 'kraken' && krakenBiteUi
        ? [{ ...krakenBiteUi, mode: 'swallow-lifecycle-special', actionId: 'bite' }]
        : []),
      ...(monster.slug === 'mummy-lord' && mummySandUi
        ? [{ ...mummySandUi, mode: 'protected-legendary-movement-special', actionId: 'whirlwind-of-sand-costs-2-actions' }]
        : []),
      ...(monster.slug === 'homunculus' && homunculusBiteUi
        ? [{ ...homunculusBiteUi, mode: 'margin-duration-on-hit-special', actionId: 'bite' }]
        : []),
      ...(monster.slug === 'nightmare' && nightmareEtherealUi
        ? [{ ...nightmareEtherealUi, mode: 'self-only-planar-toggle-special', actionId: 'ethereal-stride-self-only' }]
        : []),
      ...(monster.slug === 'blink-dog' && blinkDogTeleportUi
        ? [{ ...blinkDogTeleportUi, mode: 'teleport-only-special', actionId: 'teleport-only' }]
        : []),
      ...(monsterUiCatchup
        ? [{ ...monsterUiCatchup, mode: 'weapon-ui-catchup' }]
        : []),
    ],
    traitFields: traitRows,
    runtimeInvocationCount: records.length, uncoveredActionCount: uncovered.length, uncoveredTraitCount: uncoveredTraits.length }
  fs.writeFileSync(path.join(output, 'evidence', `${monster.slug}.json`), JSON.stringify(result, null, 2) + '\n')
  const uiText = supplementalUiRecords.some(record => record.status === 'passed')
    ? '本轮专项双端真实 UI 已通过；完整场景、状态字段和同步证据见下方对应小节。'
    : latestMonsterUi?.status === 'passed'
    ? `通过：${latestMonsterUi.actionName}。已验证真实 DM 控制台点击、选择目标、动作消耗、玩家日志同步及玩家先攻栏 HP。HP ${latestMonsterUi.beforeHp} → ${latestMonsterUi.afterHp}/${latestMonsterUi.afterMaximumHp}。`
    : latestMonsterUi?.status === 'inspect-only' ? '已打开真实怪物控制台；该怪物无可直接执行的 Headless 武器动作，此用例未宣称完成战斗结算。'
      : latestMonsterUi?.status === 'failed' ? `当前失败：${escape(latestMonsterUi.error)}` : '尚待本次端到端批次执行。'
  const specialUiText = specialUiRecords.length
    ? specialUiRecords.map(record => `- ${record.status === 'passed' ? '通过' : '失败'}：${record.actionName ?? '无可用传奇动作'}（场景 ${record.index}）${record.dmLog ? `；DM 日志：${escape(record.dmLog)}` : ''}`).join('\n')
    : '- 本怪物没有本轮新增专项 UI 场景。'
  const multiattackUiText = monster.slug !== 'aboleth'
    ? []
    : abolethMultiattackUi?.status === 'passed'
      ? [
          '### 多重攻击专项 UI', '',
          `- 通过：7073/7074 双端真实页面一次选择目标后完成三次触手；HP ${abolethMultiattackUi.beforeHp} → ${abolethMultiattackUi.afterHp}，写入疾病持久效果，DM 与玩家日志一致。`, '',
          `> ${escape(abolethMultiattackUi.dmLog)}`, '',
        ]
      : ['### 多重攻击专项 UI', '', '- 尚未取得通过证据。', '']
  const shillelaghUiText = monster.slug !== 'dryad'
    ? []
    : dryadShillelaghUi?.status === 'passed'
      ? [
          '### 橡棍术专项 UI', '',
          `- 通过：7073/7074 双端真实页面验证强化木棒在施法前禁用；施法后写入绑定短棒、魅力属性与 +4 调整值的 10 回合效果并解锁动作；攻击使目标 HP 120 → ${dryadShillelaghUi.afterAttack?.currentHp}。`, '',
          `> ${escape(dryadShillelaghUi.dmLog)}`, '',
        ]
      : ['### 橡棍术专项 UI', '', '- 尚未取得通过证据。', '']
  const krakenLightningUiText = monster.slug !== 'kraken'
    ? []
    : krakenLightningUi?.status === 'passed'
      ? [
          '### 闪电风暴专项 UI', '',
          `- 通过：7073/7074 双端真实页面显示 0/3、1/3、2/3 分配进度，并允许对同一目标连续点击三次；结算使目标 HP ${krakenLightningUi.settlement?.hpBefore} → ${krakenLightningUi.settlement?.hpAfter}，DM 与玩家日志一致。`, '',
          `> ${escape(krakenLightningUi.dmLog)}`, '',
        ]
      : ['### 闪电风暴专项 UI', '', '- 尚未取得通过证据。', '']
  const krakenBiteUiText = monster.slug !== 'kraken'
    ? []
    : krakenBiteUi?.status === 'passed'
      ? [
          '### 啃咬与吞咽专项 UI', '',
          `- 通过：7073/7074 双端真实页面完成触手命中、回合推进和下一轮啃咬。目标 HP ${krakenBiteUi.beforeHp} → ${krakenBiteUi.afterTentacle?.currentHp} → ${krakenBiteUi.afterBite?.currentHp}；触手擒抱被吞咽关系替换，写入目盲、束缚和 12d6 来源回合胃酸，动作余量为 ${krakenBiteUi.afterBite?.actionAvailable}，DM 与玩家日志一致。`, '',
          `> ${escape(krakenBiteUi.dmLogs?.join(' / '))}`, '',
        ]
      : ['### 啃咬与吞咽专项 UI', '', '- 尚未取得通过证据。', '']
  const mummySandUiText = monster.slug !== 'mummy-lord'
    ? []
    : mummySandUi?.status === 'passed'
      ? [
          '### 沙旋风专项 UI', '',
          `- 通过：7073/7074 双端真实页面完成传奇窗口选择、2 点传奇动作扣除和地图移动。传奇点 ${mummySandUi.before?.legendaryPoints} → ${mummySandUi.afterPurchase?.dnd5eCombatState?.monsterLegendaryActionPoints}；授予 ${mummySandUi.afterPurchase?.dnd5eCombatState?.monsterLegendaryMovement?.maximumFeet} 尺移动、全伤害免疫与五项状态免疫，移动后临时窗口已清除，DM 与玩家日志一致。`, '',
          `> ${escape(mummySandUi.dmLog)}`, '',
        ]
      : ['### 沙旋风专项 UI', '', '- 尚未取得通过证据。', '']
  const homunculusBiteUiText = monster.slug !== 'homunculus'
    ? []
    : homunculusBiteUi?.status === 'passed'
      ? [
          '### 啃咬毒素专项 UI', '',
          `- 通过：7073/7074 双端真实页面完成命中、深度失败豁免和额外持续时间结算。目标 HP ${homunculusBiteUi.before?.currentHp} → ${homunculusBiteUi.after?.currentHp}；持续时间骰为 ${homunculusBiteUi.after?.durationRollValue} 分钟，中毒与昏迷均写入 ${homunculusBiteUi.after?.durationRounds} 回合，昏迷包含受伤／唤醒中断并依赖中毒，DM 与玩家日志一致。`, '',
          `> ${escape(homunculusBiteUi.dmLog)}`, '',
        ]
      : ['### 啃咬毒素专项 UI', '', '- 尚未取得通过证据。', '']
  const nightmareEtherealUiText = monster.slug !== 'nightmare'
    ? []
    : nightmareEtherealUi?.status === 'passed'
      ? [
          '### 仅自身以太步专项 UI', '',
          `- 通过：7073/7074 双端真实页面保留完整同行分支为 DM 裁定，并执行零乘客“仅自身”分支。动作余量变为 ${nightmareEtherealUi.actionAvailable}；效果写入以太位面、物质碰撞穿越、不受限垂直移动和跨位面效果抑制，DM 与玩家日志一致。`, '',
          `> ${escape(nightmareEtherealUi.dmLog)}`, '',
        ]
      : ['### 仅自身以太步专项 UI', '', '- 尚未取得通过证据。', '']
  const blinkDogTeleportUiText = monster.slug !== 'blink-dog'
    ? []
    : blinkDogTeleportUi?.status === 'passed'
      ? [
          '### 仅传送专项 UI', '',
          `- 通过：7073/7074 双端真实页面保留原复合动作为 DM 裁定，并执行“不啃咬、仅传送”分支。闪现犬从 (${blinkDogTeleportUi.before?.x}, ${blinkDogTeleportUi.before?.y}) 移至 (${blinkDogTeleportUi.after?.x}, ${blinkDogTeleportUi.after?.y})，HP 保持 ${blinkDogTeleportUi.after?.hp}，动作余量变为 ${blinkDogTeleportUi.actionAvailable}，充能标记为已消耗，DM 与玩家日志一致。`, '',
          `> ${escape(blinkDogTeleportUi.dmLog)}`, '',
        ]
      : ['### 仅传送专项 UI', '', '- 尚未取得通过证据。', '']
  const monsterUiCatchupText = !monsterUiCatchup
    ? []
    : monsterUiCatchup.status === 'passed'
      ? [
          '### 战斗动作 UI 补验', '',
          `- 通过：7073/7074 双端真实页面执行${monsterUiCatchup.actionName}。目标 HP ${monsterUiCatchup.beforeHp} → ${monsterUiCatchup.afterHp}，动作余量变为 ${monsterUiCatchup.actionAvailable}，DM 与玩家日志一致。`, '',
          `> ${escape(monsterUiCatchup.dmLog)}`, '',
        ]
      : ['### 战斗动作 UI 补验', '', '- 尚未取得通过证据。', '']
  const fvttReviewText = monster.slug === 'aboleth'
    ? [
        '## FVTT 对照', '',
        '- Foundry D&D5e 的 Activities 数据模型提供 Attack、Save、Forward 与已应用效果容器，可作为动作结构化的对应层。',
        '- Foundry D&D5e 的 SRD 5.1 怪物更新清单把底栖魔鱼的黏液云、触手与奴役标为没有适用 Active Effect；因此本仓库不能只等待 FVTT 核心补齐，而是在自身 Headless 入口实现逐击豁免和持久疾病记录。',
        '- 参考：[Activities](https://github.com/foundryvtt/dnd5e/wiki/Activities)、[SRD 5.1 Monster Update List #6712](https://github.com/foundryvtt/dnd5e/issues/6712)。', '',
      ]
    : []
  const text = [
    `# ${monster.name}（${monster.englishName ?? monster.slug}）`, '',
    `规则 ID：\`${monster.id}\`。结论：**${verdict}**。`, '',
    '## 已知问题与边界', '',
    ...(bugs.length ? bugs.map(bug => `- ${bug}`) : ['本次已完成的用例尚未确认新的怪物专属缺陷；这不代表未覆盖分支没有问题。']), '',
    `当前仍有 ${uncovered.length} 个 Headless 动作未被本次目录矩阵完整确认，${manual.length} 个动作使用 DM 裁定或属于非战斗能力。`, '',
    '## 实际 UI', '', uiText, '',
    ...(latestMonsterUi?.dmLog ? [`> ${escape(latestMonsterUi.dmLog)}`, ''] : []),
    ...multiattackUiText,
    ...shillelaghUiText,
    ...krakenLightningUiText,
    ...krakenBiteUiText,
    ...mummySandUiText,
    ...homunculusBiteUiText,
    ...nightmareEtherealUiText,
    ...blinkDogTeleportUiText,
    ...monsterUiCatchupText,
    '### 传奇与特殊动作专项', '', specialUiText, '',
    '## 动作逐项', '',
    '| 分组 | 动作 / ID | 声明 | 结算类型 | 本次运行验证 | 场景 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.sectionLabel} | ${escape(row.name)} / \`${row.id}\` | ${row.automation ?? '未标记'} | ${row.rule} | ${row.runtime} | ${row.scenarios.join('、') || '—'} |`), '',
    '## 字段验证范围', '',
    '全部字段通过目录导出和公开 schema 重新解析。武器矩阵检查未命中、命中、重击、伤害数值、动作消耗、非法骰值和射程边界；虫群另查半血伤害。范围矩阵检查声明变体、豁免与资源边界。多重攻击矩阵执行完整序列并检查一次动作消耗。', '',
    '**不能将 schema 接受、一次执行成功或 UI 标签视为所有字段的分支验证。** 命中特效的持续时钟、免疫与移除、目标组合、移动地形、法术选择及跨回合组合仍需结合专项用例逐项确认。', '',
    '每个动作的完整字段路径与实际运行场景保存在本怪物的 JSON 证据中，可用于继续补齐字段级断言。', '',
    ...fvttReviewText,
    '## 特性', '',
    '| 特性 | 自动化声明 | 结构化规则 | 本次专项矩阵 | 场景 |', '| --- | --- | --- | --- | --- |',
    ...traitRows.map(trait => `| ${escape(trait.name)} | ${trait.automation ?? '未标记'} | ${trait.rule ?? '无结构化处理器'} | ${trait.runtime} | ${escape(trait.scenarios.join('、') || '—')} |`), '',
    '特性列表表示目录现状；除上面明确列出的定向回归外，不以本次武器攻击代替回合开始、受击、死亡、重生等特性的独立触发验证。', '',
    '## 复查材料', '',
    `- [本怪物字段与结果证据](../evidence/${monster.slug}.json)`,
    ...(monster.slug === 'aboleth' ? ['- [多重攻击真实 UI 证据](../evidence/aboleth-multiattack-ui.json)'] : []),
    ...(monster.slug === 'dryad' ? ['- [橡棍术真实 UI 证据](../evidence/dryad-shillelagh-ui.json)'] : []),
    ...(monster.slug === 'kraken' ? ['- [闪电风暴真实 UI 证据](../evidence/kraken-lightning-ui.json)'] : []),
    ...(monster.slug === 'kraken' ? ['- [啃咬与吞咽真实 UI 证据](../evidence/kraken-bite-ui.json)'] : []),
    ...(monster.slug === 'mummy-lord' ? ['- [沙旋风真实 UI 证据](../evidence/mummy-lord-whirlwind-of-sand-ui.json)'] : []),
    ...(monster.slug === 'homunculus' ? ['- [啃咬毒素真实 UI 证据](../evidence/homunculus-bite-ui.json)'] : []),
    ...(monster.slug === 'nightmare' ? ['- [仅自身以太步真实 UI 证据](../evidence/nightmare-ethereal-stride-ui.json)'] : []),
    ...(monster.slug === 'blink-dog' ? ['- [仅传送真实 UI 证据](../evidence/blink-dog-teleport-ui.json)'] : []),
    ...(monsterUiCatchup ? [`- [战斗动作真实 UI 证据](../evidence/${monster.slug}-combat-ui.json)`] : []),
    '- [总索引与运行说明](../README.md)',
    '- 测试源码：`src/rulesets/dnd5e/monsterCatalogWeaponVerification.test.ts`、`monsterCatalogAreaVerification.test.ts`、`monsterCatalogMultiattackVerification.test.ts`；实际 UI：`e2e/monster-catalog-verification.spec.ts`。', '',
  ].join('\n')
  fs.writeFileSync(path.join(output, 'monsters', `${monster.slug}.md`), text)
  if (monster.slug === 'aboleth' && abolethMultiattackUi) {
    fs.writeFileSync(
      path.join(output, 'evidence', 'aboleth-multiattack-ui.json'),
      JSON.stringify(abolethMultiattackUi, null, 2) + '\n',
    )
  }
  if (monster.slug === 'dryad' && dryadShillelaghUi) {
    fs.writeFileSync(
      path.join(output, 'evidence', 'dryad-shillelagh-ui.json'),
      JSON.stringify(dryadShillelaghUi, null, 2) + '\n',
    )
  }
  if (monster.slug === 'kraken' && krakenLightningUi) {
    fs.writeFileSync(
      path.join(output, 'evidence', 'kraken-lightning-ui.json'),
      JSON.stringify(krakenLightningUi, null, 2) + '\n',
    )
  }
  if (monster.slug === 'kraken' && krakenBiteUi) {
    fs.writeFileSync(
      path.join(output, 'evidence', 'kraken-bite-ui.json'),
      JSON.stringify(krakenBiteUi, null, 2) + '\n',
    )
  }
  if (monster.slug === 'mummy-lord' && mummySandUi) {
    fs.writeFileSync(
      path.join(output, 'evidence', 'mummy-lord-whirlwind-of-sand-ui.json'),
      JSON.stringify(mummySandUi, null, 2) + '\n',
    )
  }
  if (monster.slug === 'homunculus' && homunculusBiteUi) {
    fs.writeFileSync(
      path.join(output, 'evidence', 'homunculus-bite-ui.json'),
      JSON.stringify(homunculusBiteUi, null, 2) + '\n',
    )
  }
  if (monster.slug === 'nightmare' && nightmareEtherealUi) {
    fs.writeFileSync(
      path.join(output, 'evidence', 'nightmare-ethereal-stride-ui.json'),
      JSON.stringify(nightmareEtherealUi, null, 2) + '\n',
    )
  }
  if (monster.slug === 'blink-dog' && blinkDogTeleportUi) {
    fs.writeFileSync(
      path.join(output, 'evidence', 'blink-dog-teleport-ui.json'),
      JSON.stringify(blinkDogTeleportUi, null, 2) + '\n',
    )
  }
  if (monsterUiCatchup) {
    fs.writeFileSync(
      path.join(output, 'evidence', `${monster.slug}-combat-ui.json`),
      JSON.stringify(monsterUiCatchup, null, 2) + '\n',
    )
  }
  summaries.push({ slug: monster.slug, name: monster.name, challengeRating: monster.challenge.rating,
    verdict, runtime: records.length, uncovered: uncovered.length, manual: manual.length, ui: effectiveUiStatus })
}
const counts = values => Object.fromEntries([...new Set(values)].map(value => [value, values.filter(entry => entry === value).length]))
const manifest = { generatedAt: new Date().toISOString(), catalogSha256: createHash('sha256').update(fs.readFileSync(path.join(input, 'catalog.json'))).digest('hex'),
  monsters: summaries.length, ui: counts(summaries.map(entry => entry.ui)), cleanRuntimeSuites: [...cleanRuntimeSuites],
  fullSuite: fullSuite ? { passed: fullSuite.numPassedTests, failed: fullSuite.numFailedTests, pending: fullSuite.numPendingTests } : null,
  suites: latestTests.map(({ kind, name, report }) => ({ kind, source: name, passed: report?.numPassedTests ?? 0, failed: report?.numFailedTests ?? null })), summaries }
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
fs.writeFileSync(path.join(output, 'ui-execution-order.json'), JSON.stringify({
  order: 'challenge-rating-descending-then-name',
  count: summaries.length,
  monsters: summaries.map((entry, index) => ({ index, challengeRating: entry.challengeRating, slug: entry.slug, name: entry.name })),
}, null, 2) + '\n')
fs.writeFileSync(path.join(output, 'README.md'), [
  '# 全目录怪物验证 · 2026-09-04', '',
  `已为全部 **${summaries.length} 只怪物**建立独立报告。该目录按实际证据生成；目录批次已完成，组合场景的覆盖边界见下文。`, '',
  `UI 当前结果：${Object.entries(manifest.ui).map(([status, count]) => `${status} ${count}`).join('；')}。`, '',
  '## 修复与验证', '',
  '- 鲁莽攻击改为主动选择；修复玩家攻击鲁莽怪物时，UI 预掷骰及通用 Headless 武器入口遗漏优势的问题。',
  '- 修复底栖魔鱼触手被旧安全名单重新降级的问题；触手疾病改为每次命中独立结算的持久效果，多重攻击恢复 Headless。',
  '- 修复患病巨鼠与两类木乃伊的每 24 小时生命值上限恶化；验证持久化、重复同步和解除后的恢复。',
  '- 修复吸血鬼形态非法传奇攻击；克拉肯闪电风暴改为恰好三束的 Headless 分配，支持重复目标、逐束豁免与独立 4d10 伤害。',
  '- 修复克拉肯与紫虫等吞咽动作的关系生命周期、体内外全掩护、周期伤害、反刍和来源死亡脱离；修复木乃伊领主沙旋风的 60 尺传奇移动及窗口内伤害／状态免疫。',
  '- 修复魔宠人偶啃咬：普通失败中毒 1 分钟；失败 5 点或更多时额外掷 1d10 分钟，同时中毒和昏迷，并在受伤或被唤醒时结束昏迷。',
  '- 修复梦魇兽以太步行：新增原文允许的零乘客“仅自身”Headless 分支，自动结算位面切换与跨位面抑制；携带至多三名自愿生物的完整分支仍由 DM 裁定。',
  '- 修复普通怪物 Headless 传送的控制栏落点入口；闪现犬新增“不啃咬、仅传送”分支，自动检查 40 尺、可见、空位、地图几何、动作与充能。',
  '- 补验紫虫尾部螫针、部落战士双手长矛和守卫双手长矛的真实 Headless 战斗 UI；三个场景均完成伤害、动作消耗与双端日志同步。',
  '- 修复怪物橡棍术：树精／德鲁伊会创建绑定武器与施法属性的持续效果，强化攻击只在效果有效时开放；树精已通过 7073/7074 双端真实 UI 的禁用、解锁、伤害与日志同步验证。',
  '- 修复奥术之手切换持续指令时错误终止自身专注；修复具体法术卷轴缺失图标回退。',
  '- 修复冻寒之触对亡灵的来源专属劣势在部分 Headless 攻击入口未生效；覆盖普通／怪物武器、法术与逐束攻击。',
  '- 修复玩家移动提交后的未定义变量、专注详情的变量初始化顺序、移动登录 token 恢复及跨房间迟到响应问题。',
  '- 同步反魔法易感 schema；修复依赖审计的旧版本硬约束及失败处理。构建的类型/架构阻断另行跟踪，不能据此宣称可发布。', '',
  '## 环境与证据', '',
  '- DM `http://127.0.0.1:6973`，玩家 `http://127.0.0.1:6974`；使用独立数据和缓存目录。',
  '- 底栖魔鱼修复后的多重攻击专项另用 DM `7073`、玩家 `7074`，避免修改旧的全目录验证快照。',
  '- 树精橡棍术专项复用 DM `7073`、玩家 `7074`，保存了施法前禁用、施法后效果字段、攻击伤害和双端日志证据。',
  '- 克拉肯闪电风暴专项复用 DM `7073`、玩家 `7074`，保存了三束重复目标分配、生命值变化和双端日志证据。',
  '- 克拉肯吞咽、木乃伊领主沙旋风、魔宠人偶啃咬、梦魇兽仅自身以太步和闪现犬仅传送专项复用 DM `7073`、玩家 `7074`，保存了关系、移动窗口、状态持续时间、位面／落点字段和双端日志证据。',
  '- 紫虫、部落战士和守卫的旧只读 UI 记录已在 `7073/7074` 以当前源码补跑为实际战斗通过；总表以专项证据覆盖旧快照状态。',
  '- 目录数值矩阵通过真实 Headless 公共入口结算；端到端测试通过实际网页按钮和目标选择操作。场景夹具只负责初始数据。',
  '- UI 原始 JSON、通过截图、失败截图和只读后台观察记录保存在 `.codex-temp/monster-verification-20260904/`。',
  '- 本目录保留每怪物的精简证据 JSON、字段路径及报告，避免只依赖临时日志。',
  '- `ui-execution-order.json` 固化本轮真实 UI 的执行顺序：先按 CR 从高到低，同 CR 再按名称排序。',
  '- 不以资料里的 Headless 标签证明 UI 已连通；不将 DM 裁定能力自动计为实现缺陷；不将测试夹具/热更新失败直接认定为产品 bug。', '',
  '## 最终检查', '',
  `- 全目录审查基线 Vitest：${fullSuite?.numPassedTests ?? '未运行'} 通过，${fullSuite?.numFailedTests ?? '未知'} 失败，${fullSuite?.numPendingTests ?? '未知'} 跳过／待定；本轮新增改动均另跑对应目录、运行时与 UI 验证。`,
  '- 根目录 TypeScript 检查和本任务相关 ESLint 已通过。标准 build 仍会被 13 项架构预算拦截，详情见 `WORKLOG.md`。', '',
  '## 复跑', '',
  '先使用独立共享目录启动上述两个服务，运行目录测试生成清单，再生成场景夹具。端到端测试会覆盖该隔离目录的战斗数据，不能指向日常战役服务。', '',
  '```powershell',
  "$env:STARS_MONSTER_INVENTORY_DIR='.codex-temp/monster-verification-20260904'",
  'node scripts/verify-monster-catalog.mjs',
  '# 另一个终端启动隔离服务；端口被占用时会拒绝启动',
  'node scripts/start-monster-verification.mjs',
  '# 服务就绪后，在本终端运行真实浏览器测试',
  'npx playwright test --config e2e/monster-verification.config.ts',
  'node scripts/report-monster-verification.mjs', '```', '',
  '验证脚本会保存各矩阵的 JSON reporter 结果；生成器只有在对应套件整体无失败时，才把动作矩阵标为通过。', '',
  '## 逐怪物索引（CR 从高到低）', '', '| CR | 怪物 | 数值用例数 | Headless 待覆盖动作 | DM 裁定／非战斗动作 | UI | 当前结论 |', '| ---: | --- | ---: | ---: | ---: | --- | --- |',
  ...summaries.map(entry => `| ${entry.challengeRating} | [${entry.name}](monsters/${entry.slug}.md) | ${entry.runtime} | ${entry.uncovered} | ${entry.manual} | ${entry.ui} | ${entry.verdict} |`), '',
].join('\n'))
console.log(JSON.stringify({ monsters: summaries.length, ui: manifest.ui, cleanRuntimeSuites: manifest.cleanRuntimeSuites }))
