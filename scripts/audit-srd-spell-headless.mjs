import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const decisionsPath = resolve(root, 'scripts/data/srd-spell-headless-decisions.json')
const jsonPath = resolve(root, 'docs/srd-spell-headless-audit.json')
const markdownPath = resolve(root, 'docs/srd-spell-headless-audit.md')
const runtimeDecisionsPath = resolve(root, 'src/rulesets/dnd5e/generated/srdSpellHeadlessDecisions.generated.json')
const checkOnly = process.argv.includes('--check')

const decisionFile = JSON.parse(readFileSync(decisionsPath, 'utf8'))
if (decisionFile.schemaVersion !== 1 || !decisionFile.decisions || typeof decisionFile.decisions !== 'object') {
  throw new Error('Invalid SRD spell Headless decision file')
}

const vite = await createServer({
  root,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

let catalogModule
let spellsModule
let spellbookModule
try {
  ;[catalogModule, spellsModule, spellbookModule] = await Promise.all([
    vite.ssrLoadModule('/src/rulesets/dnd5e/spellCatalog.ts'),
    vite.ssrLoadModule('/src/rulesets/dnd5e/spells.ts'),
    vite.ssrLoadModule('/src/rulesets/dnd5e/spellbook.ts'),
  ])
} finally {
  await vite.close()
}

const catalog = catalogModule.DND5E_SRD_SPELL_CATALOG
const combatById = new Map(spellsModule.DND5E_SRD_COMBAT_SPELLS.map((spell) => [spell.id, spell]))
const spellbookById = new Map(spellbookModule.dnd5eSpellbookEntries([]).map((spell) => [spell.id, spell]))
const decisionIds = Object.keys(decisionFile.decisions)
const catalogIds = new Set(catalog.map((spell) => spell.id))
const expectedDecisionIds = catalog.filter((spell) => !combatById.has(spell.id)).map((spell) => spell.id)

const errors = []
if (catalog.length !== 319) errors.push(`Expected 319 SRD spells, received ${catalog.length}`)
if (combatById.size !== 123) errors.push(`Expected 123 implemented Headless spells, received ${combatById.size}`)
for (const id of decisionIds) {
  if (!catalogIds.has(id)) errors.push(`Decision references unknown SRD spell: ${id}`)
  if (combatById.has(id)) errors.push(`Decision duplicates an implemented core spell: ${id}`)
  const decision = decisionFile.decisions[id]
  if (!Array.isArray(decision) || !['full', 'partial', 'manual'].includes(decision[0]) || decision.length < 2) {
    errors.push(`Invalid decision tuple: ${id}`)
  } else if (decision.slice(1).some((code) => typeof code !== 'string' || !code.trim())) {
    errors.push(`Invalid decision code: ${id}`)
  }
}
for (const id of expectedDecisionIds) {
  if (!Object.hasOwn(decisionFile.decisions, id)) errors.push(`Missing decision for SRD spell: ${id}`)
}
if (decisionIds.length !== expectedDecisionIds.length) {
  errors.push(`Expected ${expectedDecisionIds.length} unimplemented decisions, received ${decisionIds.length}`)
}
if (errors.length) throw new Error(errors.join('\n'))

function currentAutomation(spellId) {
  const spellbook = spellbookById.get(spellId)
  if (!spellbook) throw new Error(`Spellbook entry missing for ${spellId}`)
  return spellbook.headless ? spellbook.automationLevel : 'manual'
}

const entries = catalog.map((spell) => {
  const combat = combatById.get(spell.id)
  const spellbook = spellbookById.get(spell.id)
  if (combat) {
    const current = currentAutomation(spell.id)
    const target = current === 'full' ? 'full' : 'partial'
    return {
      id: spell.id,
      name: spell.name,
      englishName: spell.englishName,
      level: spell.level,
      classes: [...spell.classes],
      current,
      target,
      implementation: 'core-spell-transaction',
      migration: 'native-activity-projection',
      codes: [combat.effect, 'legacy-core-transaction'],
      review: spellbook?.automationReason ?? '现有核心 Headless 事务已覆盖规则定义中的确定性结算。',
    }
  }
  const [target, ...codes] = decisionFile.decisions[spell.id]
  return {
    id: spell.id,
    name: spell.name,
    englishName: spell.englishName,
    level: spell.level,
    classes: [...spell.classes],
    current: 'manual',
    target,
    implementation: 'catalog-only',
    migration: target === 'full' ? 'implement-full' : target === 'partial' ? 'implement-partial' : 'keep-dm',
    codes,
    review: target === 'full'
      ? '规则的强制结果由有限选择、权威骰值和可观察状态决定，可迁移为完整 Headless。'
      : target === 'partial'
        ? '确定性条款可以进入 Headless，但至少一项结果依赖开放式语言、DM 选择、场景语义或未建模世界状态。'
        : '主要产出是 DM 回答、叙事交互或开放式现实改写，不应伪装成自动结算。',
  }
})

function countBy(values, select) {
  const counts = {}
  for (const value of values) {
    const key = select(value)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)))
}

function countCodes(values) {
  const counts = new Map()
  for (const value of values) {
    for (const code of value.codes) counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].sort(([leftCode, leftCount], [rightCode, rightCount]) =>
    rightCount - leftCount || leftCode.localeCompare(rightCode)))
}

const targetCounts = countBy(entries, (entry) => entry.target)
const currentCounts = countBy(entries, (entry) => entry.current)
const newlyFull = entries.filter((entry) => entry.current === 'manual' && entry.target === 'full')
const newlyPartial = entries.filter((entry) => entry.current === 'manual' && entry.target === 'partial')
const report = {
  schemaVersion: 1,
  generatedBy: 'scripts/audit-srd-spell-headless.mjs',
  criteria: {
    full: 'All mandatory outcomes are determined by bounded choices, authoritative rolls, registered content and observable state.',
    partial: 'A deterministic subset can be authoritative, but at least one mandatory clause depends on natural language, GM selection, scene semantics or unmodelled world state.',
    manual: 'The spell primarily produces narrative answers, negotiation or open-ended reality changes; only cost/logging should be automated.',
  },
  summary: {
    catalog: entries.length,
    implemented: entries.filter((entry) => entry.implementation !== 'catalog-only').length,
    catalogOnly: entries.filter((entry) => entry.implementation === 'catalog-only').length,
    current: currentCounts,
    target: targetCounts,
    newlyEligibleFull: entries.filter((entry) => entry.current === 'manual' && entry.target === 'full').length,
    newlyEligiblePartial: entries.filter((entry) => entry.current === 'manual' && entry.target === 'partial').length,
    keepDm: entries.filter((entry) => entry.target === 'manual').length,
  },
  capabilityDemand: {
    fullCandidates: countCodes(newlyFull),
    partialCandidates: countCodes(newlyPartial),
  },
  entries,
}

const json = `${JSON.stringify(report, null, 2)}\n`
const runtimeDecisions = `${JSON.stringify({
  schemaVersion: decisionFile.schemaVersion,
  decisions: decisionFile.decisions,
}, null, 2)}\n`
const labels = { full: '完整 Headless', partial: '半自动', manual: 'DM/资料' }
const migrationLabels = {
  'native-activity-projection': '迁移为原生 Activity',
  'implement-full': '新增完整实现',
  'implement-partial': '新增机械部分',
  'keep-dm': '保留 DM',
}
const escapeCell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>')
const capabilityRows = [...new Set([
  ...Object.keys(report.capabilityDemand.fullCandidates),
  ...Object.keys(report.capabilityDemand.partialCandidates),
])].map((code) => ({
  code,
  full: report.capabilityDemand.fullCandidates[code] ?? 0,
  partial: report.capabilityDemand.partialCandidates[code] ?? 0,
})).sort((left, right) => right.full + right.partial - left.full - left.partial || left.code.localeCompare(right.code))
const table = (rows) => [
  '| 环级 | 法术 | 当前 | 目标 | 迁移动作 | 能力/阻塞代码 |',
  '|---:|---|---|---|---|---|',
  ...rows.map((entry) => `| ${entry.level} | ${escapeCell(entry.name)}<br><code>${entry.id}</code> | ${labels[entry.current]} | ${labels[entry.target]} | ${migrationLabels[entry.migration]} | ${entry.codes.map((code) => `\`${code}\``).join('、')} |`),
].join('\n')
const markdown = `# SRD 5.1 法术 Headless 全量审计

本报告由 \`npm run audit:srd-spell-headless\` 从当前 SRD 目录、核心 Headless 注册表与人工逐法术决定生成。它只记录结构化机制与迁移判断，不复制法术正文。

## 判定标准

- **完整 Headless**：所有强制结果都可由有限选择、权威骰值、已注册内容和可观察状态决定。
- **半自动**：确定性条款可以自动结算，但至少一项强制条款依赖开放式语言、DM 选择、场景语义或未建模世界状态。
- **DM/资料**：主要产出是 DM 回答、叙事交互、协商或开放式现实改写；只自动处理消耗、专注、日志与暂停。

## 汇总

> “目标”表示完成所列通用原语后的可达等级，不表示法术今天已经接入。产品 UI 必须继续根据注册 operation 与 handler 计算当前覆盖率。

| 指标 | 数量 |
|---|---:|
| SRD 法术总数 | ${report.summary.catalog} |
| 当前已接入 Headless | ${report.summary.implemented} |
| 当前完整 / 半自动 / DM | ${currentCounts.full ?? 0} / ${currentCounts.partial ?? 0} / ${currentCounts.manual ?? 0} |
| 目标完整 / 半自动 / DM | ${targetCounts.full ?? 0} / ${targetCounts.partial ?? 0} / ${targetCounts.manual ?? 0} |
| 新增可完整迁移 | ${report.summary.newlyEligibleFull} |
| 新增只能半自动 | ${report.summary.newlyEligiblePartial} |
| 应保留 DM | ${report.summary.keepDm} |

## 通用原语需求

下表按逐法术决定中的能力/阻塞代码聚合。完整候选列表示实现该原语后可继续向完整 Headless 迁移的法术数；半自动列表示该原语只能自动化其中的确定性条款。

| 原语/阻塞代码 | 完整候选 | 半自动候选 | 合计 |
|---|---:|---:|---:|
${capabilityRows.map((row) => `| \`${row.code}\` | ${row.full} | ${row.partial} | ${row.full + row.partial} |`).join('\n')}

## 推荐迁移顺序

1. **基础权威结算**：豁免、持续区域、持续时间、条件生命周期、模式选择与升环；这批复用面最大，且大多不依赖新地图实体。
2. **实体与状态交接**：召唤伙伴、形态目录、HP/死亡交接、位面状态、物品链接与资源限制。
3. **地图与世界对象**：地形几何、移动阻挡、光照/传感器、门与容器状态、跨场景目的地注册表。
4. **半自动 DM 桥**：开放文本触发、语义命令/遵从、幻象内容、DM 选怪与 NPC 回答；只把确定性子步骤交给 Headless，并在语义边界暂停。

## 已有 Headless 法术

${table(entries.filter((entry) => entry.implementation !== 'catalog-only'))}

## 可新增为完整 Headless

${table(entries.filter((entry) => entry.current === 'manual' && entry.target === 'full'))}

## 只能新增为半自动

${table(entries.filter((entry) => entry.current === 'manual' && entry.target === 'partial'))}

## 保留 DM/资料模式

${table(entries.filter((entry) => entry.target === 'manual'))}
`

function compare(path, expected) {
  let actual = ''
  try { actual = readFileSync(path, 'utf8') } catch {}
  if (actual !== expected) throw new Error(`Generated audit is stale: ${path}`)
}

if (checkOnly) {
  compare(jsonPath, json)
  compare(markdownPath, markdown)
  compare(runtimeDecisionsPath, runtimeDecisions)
} else {
  writeFileSync(jsonPath, json, 'utf8')
  writeFileSync(markdownPath, markdown, 'utf8')
  writeFileSync(runtimeDecisionsPath, runtimeDecisions, 'utf8')
}

process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`)
