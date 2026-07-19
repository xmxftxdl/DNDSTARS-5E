import { BarChart3, RotateCcw, X } from 'lucide-react'
import {
  combatantContributionScore,
  type CombatantStatistics,
  type CombatStatisticsSession,
} from '../../lib/combatStatistics'

interface Props {
  session?: CombatStatisticsSession
  open: boolean
  onOpenChange: (open: boolean) => void
  onReset?: () => void
}

function sum(entries: CombatantStatistics[], field: keyof CombatantStatistics): number {
  return entries.reduce((total, entry) => total + (typeof entry[field] === 'number' ? entry[field] as number : 0), 0)
}

function TeamSection({ label, entries }: { label: string; entries: CombatantStatistics[] }) {
  if (entries.length === 0) return null
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</h4>
        <span className="text-[10px] tabular-nums text-slate-500">{entries.length} 个单位</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full min-w-[680px] text-left text-[11px]">
          <thead className="bg-white/[0.04] text-slate-400">
            <tr>
              <th className="px-2 py-1.5 font-semibold">角色</th>
              <th className="px-2 py-1.5 text-right font-semibold">输出</th>
              <th className="px-2 py-1.5 text-right font-semibold">承伤</th>
              <th className="px-2 py-1.5 text-right font-semibold">治疗</th>
              <th className="px-2 py-1.5 text-right font-semibold">减伤</th>
              <th className="px-2 py-1.5 text-right font-semibold">控制</th>
              <th className="px-2 py-1.5 text-right font-semibold">击倒/击杀</th>
              <th className="px-2 py-1.5 text-right font-semibold">救援</th>
              <th className="px-2 py-1.5 text-right font-semibold">贡献</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.combatantId} className="border-t border-white/[0.06] text-slate-200">
                <td className="max-w-40 truncate px-2 py-1.5 font-semibold" title={entry.name}>{entry.name}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-rose-200">{entry.damageDealt}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{entry.damageTaken}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-emerald-200">{entry.healingDone}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-sky-200">{entry.damagePrevented}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-violet-200">{entry.hostileConditionsApplied}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{entry.knockouts}/{entry.kills}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{entry.alliesRescued}</td>
                <td className="px-2 py-1.5 text-right font-bold tabular-nums text-amber-200">
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

export default function CombatStatisticsPanel({ session, open, onOpenChange, onReset }: Props) {
  const entries = Object.values(session?.combatants ?? {})
    .sort((left, right) => combatantContributionScore(right) - combatantContributionScore(left))
  const party = entries.filter((entry) => entry.side !== 'enemy')
  const enemies = entries.filter((entry) => entry.side === 'enemy')

  if (!open) return (
    <button
      type="button"
      onClick={() => onOpenChange(true)}
      className="absolute bottom-3 left-3 z-40 flex items-center gap-2 rounded-xl border border-white/10 bg-void-950/88 px-3 py-2 text-xs font-bold text-slate-200 shadow-xl backdrop-blur-md hover:bg-white/10"
      title="查看 Headless 战斗统计"
    >
      <BarChart3 className="h-3.5 w-3.5 text-emerald-200" />
      战斗统计
    </button>
  )

  return (
    <div className="absolute bottom-3 left-3 z-40 w-[min(48rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-void-950/94 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <BarChart3 className="h-4 w-4 text-emerald-200" />
        <span className="text-sm font-bold text-slate-100">Headless 战斗统计</span>
        {session && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">第 {session.lastRound} 轮</span>}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            <RotateCcw className="h-3 w-3" />
            重置本场
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className={`${onReset ? '' : 'ml-auto '}flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-slate-100`}
          title="收起战斗统计"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 border-b border-white/8 p-3">
        {[
          ['总输出', sum(entries, 'damageDealt'), 'text-rose-200'],
          ['总承伤', sum(entries, 'damageTaken'), 'text-slate-200'],
          ['总治疗', sum(entries, 'healingDone'), 'text-emerald-200'],
          ['控制效果', sum(entries, 'hostileConditionsApplied'), 'text-violet-200'],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-lg bg-white/[0.04] px-2 py-2 text-center">
            <div className={`text-base font-bold tabular-nums ${tone}`}>{value}</div>
            <div className="text-[10px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>
      <div className="max-h-[50vh] space-y-3 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">本场还没有可统计的 Headless 结算事件。</p>
        ) : (
          <>
            <TeamSection label="玩家与友方" entries={party} />
            <TeamSection label="敌方" entries={enemies} />
          </>
        )}
        <p className="px-1 text-[10px] leading-relaxed text-slate-500">
          贡献值用于快速复盘：输出、治疗、临时生命、减伤按实际数值计入；控制每次 5 分，击杀与救援每次 10 分。它不是 D&amp;D 5e 规则数值，DM 应结合战术、探索与叙事贡献判断。
        </p>
      </div>
    </div>
  )
}
