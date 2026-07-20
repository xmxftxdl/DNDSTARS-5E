import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import Card from './Card'
import {
  combatantContributionScore,
  type CombatantStatistics,
  type CombatStatisticsSession,
} from '../lib/combatStatistics'
import { useCombatStatisticsStore } from '../store/combatStatistics'
import { useMapStore } from '../store/maps'

const CAMPAIGN_TOTAL = '__campaign_total__'

const numericFields: Array<keyof CombatantStatistics> = [
  'damageDealt', 'damageTaken', 'healingDone', 'healingReceived', 'temporaryHpGranted',
  'damagePrevented', 'hostileConditionsApplied', 'attacks', 'hits', 'criticalHits',
  'knockouts', 'kills', 'alliesRescued', 'successfulSaves', 'failedSaves',
  'concentrationChecks', 'concentrationMaintained', 'actionsSpent', 'bonusActionsSpent',
  'reactionsSpent', 'movementSpentFeet', 'classResourcesSpent', 'spellSlotsSpent',
]

function sum(entries: CombatantStatistics[], field: keyof CombatantStatistics): number {
  return entries.reduce((total, entry) => {
    const value = entry[field]
    return total + (typeof value === 'number' ? value : 0)
  }, 0)
}

function aggregateCombatStatistics(sessions: CombatStatisticsSession[]): CombatantStatistics[] {
  const aggregate = new Map<string, CombatantStatistics>()
  for (const session of sessions) {
    for (const entry of Object.values(session.combatants)) {
      const key = `${entry.side}:${entry.combatantId}`
      const current = aggregate.get(key)
      if (!current) {
        aggregate.set(key, { ...entry })
        continue
      }
      current.name = entry.name || current.name
      for (const field of numericFields) {
        const value = entry[field]
        if (typeof value === 'number') (current[field] as number) += value
      }
    }
  }
  return [...aggregate.values()]
}

function TeamTable({ label, entries }: { label: string; entries: CombatantStatistics[] }) {
  if (entries.length === 0) return null
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</h4>
        <span className="text-xs tabular-nums text-slate-500">{entries.length} 个单位</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-white/[0.04] text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold">角色</th>
              <th className="px-3 py-2 text-right font-semibold">输出</th>
              <th className="px-3 py-2 text-right font-semibold">承伤</th>
              <th className="px-3 py-2 text-right font-semibold">治疗</th>
              <th className="px-3 py-2 text-right font-semibold">减伤</th>
              <th className="px-3 py-2 text-right font-semibold">控制</th>
              <th className="px-3 py-2 text-right font-semibold">击倒/击杀</th>
              <th className="px-3 py-2 text-right font-semibold">救援</th>
              <th className="px-3 py-2 text-right font-semibold">贡献</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={`${entry.side}:${entry.combatantId}`} className="border-t border-white/[0.06] text-slate-200">
                <td className="max-w-48 truncate px-3 py-2 font-semibold" title={entry.name}>{entry.name}</td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-200">{entry.damageDealt}</td>
                <td className="px-3 py-2 text-right tabular-nums">{entry.damageTaken}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-200">{entry.healingDone}</td>
                <td className="px-3 py-2 text-right tabular-nums text-sky-200">{entry.damagePrevented}</td>
                <td className="px-3 py-2 text-right tabular-nums text-violet-200">{entry.hostileConditionsApplied}</td>
                <td className="px-3 py-2 text-right tabular-nums">{entry.knockouts}/{entry.kills}</td>
                <td className="px-3 py-2 text-right tabular-nums">{entry.alliesRescued}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-amber-200">
                  {combatantContributionScore(entry)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatSessionTime(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

export default function CampaignCombatStatisticsPanel() {
  const sessions = useCombatStatisticsStore((state) => state.sessions)
  const maps = useMapStore((state) => state.maps)
  const [selected, setSelected] = useState(CAMPAIGN_TOTAL)
  const orderedSessions = useMemo(
    () => [...sessions].sort((left, right) => right.updatedAt - left.updatedAt),
    [sessions],
  )
  const selectedSession = orderedSessions.find((session) => session.combatId === selected)
  const entries = useMemo(
    () => (selected === CAMPAIGN_TOTAL || !selectedSession
      ? aggregateCombatStatistics(orderedSessions)
      : Object.values(selectedSession.combatants)),
    [orderedSessions, selected, selectedSession],
  )
  const ranked = [...entries].sort((left, right) => combatantContributionScore(right) - combatantContributionScore(left))
  const party = ranked.filter((entry) => entry.side !== 'enemy')
  const enemies = ranked.filter((entry) => entry.side === 'enemy')
  const mapNames = new Map(maps.map((map) => [map.id, map.name]))
  const viewLabel = selectedSession
    ? `${mapNames.get(selectedSession.mapId) ?? '未命名地图'} · 第 ${selectedSession.lastRound} 轮`
    : `战役累计 · ${sessions.length} 场战斗`

  const metrics = [
    { label: '团队输出', value: sum(party, 'damageDealt'), tone: 'text-rose-200' },
    { label: '团队承伤', value: sum(party, 'damageTaken'), tone: 'text-slate-100' },
    { label: '团队治疗', value: sum(party, 'healingDone'), tone: 'text-emerald-200' },
    { label: '团队贡献', value: party.reduce((total, entry) => total + combatantContributionScore(entry), 0), tone: 'text-amber-200' },
  ]

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="rounded-xl bg-emerald-500/15 p-3 text-emerald-300">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">战斗统计</h3>
            <p className="mt-1 text-sm text-slate-500">{viewLabel}</p>
          </div>
        </div>
        {orderedSessions.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-400">
            查看范围
            <select
              value={selectedSession ? selectedSession.combatId : CAMPAIGN_TOTAL}
              onChange={(event) => setSelected(event.target.value)}
              className="min-w-56 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value={CAMPAIGN_TOTAL}>战役累计（{orderedSessions.length} 场）</option>
              {orderedSessions.map((session) => (
                <option key={session.combatId} value={session.combatId}>
                  {mapNames.get(session.mapId) ?? '未命名地图'} · {formatSessionTime(session.startedAt)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-white/5 bg-slate-950/35 px-3 py-3 text-center">
            <p className={`text-xl font-bold tabular-nums ${metric.tone}`}>{metric.value}</p>
            <p className="mt-1 text-xs text-slate-500">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {ranked.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
            <p className="text-sm text-slate-400">还没有可统计的 Headless 战斗事件。</p>
            <p className="mt-1 text-xs text-slate-600">在战斗地图中开始战斗并完成结算后，结果会自动同步到这里。</p>
          </div>
        ) : (
          <>
            <TeamTable label="玩家与友方" entries={party} />
            <TeamTable label="敌方" entries={enemies} />
          </>
        )}
        <p className="px-1 text-xs leading-relaxed text-slate-500">
          贡献值用于复盘：输出、治疗、临时生命与减伤按实际数值计入；控制每次 5 分，击杀与救援每次 10 分。它不是 D&amp;D 5e 规则数值，DM 仍应结合战术、探索与叙事贡献判断。
        </p>
      </div>
    </Card>
  )
}
