import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

// Routing hints only. A keyword match must never certify support or classify a
// deterministic rule as narrative. Decisions require separate code/test evidence.
const families = [
  ['target-geometry', '目标、区域与位移', /目标|区域|范围|距离|体型|视线|可见|掩蔽|遮蔽|掩护|传送|移动|推离|推开|地形|高度|飞行|坠落|位移|顶起|目的地|占据空间|视觉阻挡|实体阻挡|穿越|以太|传感器|毒气|雾气|target|placement|line.of.sight|teleport/iu],
  ['attack-damage-events', '攻击、伤害与事件', /攻击|命中|伤害|豁免|重击|反应|骰|减免|减伤|抗性|免疫|attack|damage|saving|roll|before-/iu],
  ['lifecycle-resource', '生命周期、资源与后续动作', /持续|专注|回合|次数|休息|消耗|材料|资源|终止|结束|清理|触发|授予|后续|永久|每天|每日|七天|再次施放|同一时间|同时维持|来源级数量|存活|grants|resource|duration|concentration|reachability/iu],
  ['items-objects', '物品、装备与场景对象', /物品|物体|物件|武器|弹药|装备|库存|穿戴|持握|火焰|门锁|负重|堡垒|城堡|神庙|石柱|岩石部件|家具|食物|菜肴|item|weapon|object|inventory/iu],
  ['summons-control', '召唤、控制与怪物资料', /召唤|召来|坐骑|尸体|遗体|怪物|恶魔|魔鬼|仆役|造妖|命令|控制权|失控|summon|monster|companion|corpse/iu],
  ['character-options', '角色选项、变形与能力', /子职|专长|等级|熟练|职业|变形|形态|属性|生命值上限|选择|subclass|feat|ability|transformation|advancement/iu],
  ['source-evidence', '来源、数据与歧义核对', /原文|资料|缺少|未提供|没有提供|未说明|不明确|歧义|译|属性块|目录|叙事|description|source|missing/iu],
  ['contract-integration', '协议、执行绑定与完整度', /协议|接口|字段|声明|Activity|Headless|绑定|schema|invalid|手动|裁定|完整度|自动化|可执行/iu],
]

export function suggestFullbookMechanismFamilies(message) {
  const matches = families.filter(([, , expression]) => expression.test(message)).map(([key]) => key)
  return matches.length ? matches : ['unclassified']
}

const hash = value => createHash('sha256').update(value).digest('hex')
const latest = candidates => [...candidates].sort((a, b) => String(b.finished ?? '').localeCompare(String(a.finished ?? '')) || String(a.run ?? '').localeCompare(String(b.run ?? '')))[0]

export function buildFullbookMechanismBacklog(input, inputSha256) {
  if (!input || !Array.isArray(input.entries) || input.entries.length === 0) throw Error('Expected a nonempty consolidated inventory')
  const ids = new Set(), issues = new Map()
  const entries = input.entries.map(entry => {
    if (typeof entry.sourceId !== 'string' || !entry.sourceId || ids.has(entry.sourceId)) throw Error('Missing or duplicate source id')
    ids.add(entry.sourceId)
    const ready = entry.candidates?.filter(candidate => candidate.status === 'ready-for-behavior-tests') ?? []
    // Preserve earlier valid candidates: a later failed regeneration is not an
    // excuse to discard an independently current-preflight-ready artifact.
    const candidate = latest(ready.length ? ready : entry.candidates ?? [])
    if (entry.status === 'ready-for-behavior-tests' && !ready.length) throw Error('Ready entry has no ready candidate')
    if (entry.status !== 'ready-for-behavior-tests' && ready.length) throw Error('Blocked entry contradicts its ready candidate')
    const messages = ready.length ? [] : candidate?.issues?.length ? candidate.issues : ['缺少当前可检查的配置或具体失败证据。']
    const issueIds = [...new Set(messages.map(message => {
      if (typeof message !== 'string' || !message.trim()) throw Error('Invalid diagnostic')
      const text = message.trim().replace(/\s+/gu, ' '), id = hash(text)
      let issue = issues.get(id)
      if (!issue) {
        issue = { id, diagnostic: text, suggestedFamilies: suggestFullbookMechanismFamilies(text),
          reviewStatus: 'unreviewed', decision: null, evidence: [], sources: [] }
        issues.set(id, issue)
      }
      if (!issue.sources.some(source => source.sourceId === entry.sourceId)) issue.sources.push({ sourceId: entry.sourceId, name: entry.name, kind: entry.kind, run: candidate?.run ?? null })
      return id
    }))]
    return { sourceId: entry.sourceId, name: entry.name, kind: entry.kind, preflightStatus: entry.status,
      selectedRun: candidate?.run ?? null, selectedRunFinished: candidate?.finished ?? null,
      issueIds, behaviorVerified: false }
  })
  const list = [...issues.values()].sort((a, b) => a.id.localeCompare(b.id))
  const groups = [...families.map(([id, label]) => [id, label]), ['unclassified', '未分类']].map(([id, label]) => {
    const matching = list.filter(issue => issue.suggestedFamilies.includes(id))
    return { id, label, issueCount: matching.length, affectedEntryCount: new Set(matching.flatMap(issue => issue.sources.map(source => source.sourceId))).size,
      issueIds: matching.map(issue => issue.id) }
  })
  return { schemaVersion: 1, inputSha256, inputCheckedAt: input.updatedAt ?? null,
    classificationOnly: true, apiCalls: 0, behaviorVerified: false, fullBookCertified: false,
    note: '机制标签仅用于分派，允许重叠，不代表支持性判断。不得将未审阅问题认定为叙事或已实现。',
    counts: { entries: entries.length, preflightReady: entries.filter(entry => entry.preflightStatus === 'ready-for-behavior-tests').length,
      blocked: entries.filter(entry => entry.preflightStatus !== 'ready-for-behavior-tests').length, distinctDiagnostics: list.length,
      issueEntryLinks: entries.reduce((total, entry) => total + entry.issueIds.length, 0), reviewedIssues: 0 },
    groups, entries, issues: list }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--output') throw Error('Usage: node scripts/audit-fullbook-mechanism-backlog.mjs --input <consolidated.json> --output <private-backlog.json>')
  const source = await readFile(args[1], 'utf8')
  const report = buildFullbookMechanismBacklog(JSON.parse(source), hash(source))
  // Never overwrite a saved review or the source report. A new revision needs
  // a distinct filename so explicit review decisions cannot silently vanish.
  await writeFile(args[3], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  process.stdout.write(JSON.stringify({ counts: report.counts, groups: report.groups.map(({ issueIds, ...group }) => group) }, null, 2) + '\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1 })
