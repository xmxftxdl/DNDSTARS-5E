import { useMemo, useState } from 'react'
import {
  Activity,
  Crosshair,
  Dices,
  HeartPulse,
  ShieldCheck,
  Target,
} from 'lucide-react'
import Card from './Card'
import {
  combatantDamagePerTurn,
  combatantDefensiveContributionIndex,
  combatantHealingPerTurn,
  combatantOffensiveContributionIndex,
  emptyD20FaceCounts,
  type CombatantStatistics,
  type CombatStatisticsSession,
} from '../lib/combatStatistics'
import { useCombatStatisticsStore } from '../store/combatStatistics'
import { useGroupAbilityChecksStore } from '../store/groupAbilityChecks'
import { useMapStore } from '../store/maps'
import { useRoomCommunicationsStore } from '../store/roomCommunications'

const CAMPAIGN_TOTAL = '__campaign_total__'

type AnalyticsEntry = CombatantStatistics & {
  analyticsKey: string
}

const numericFields: Array<keyof CombatantStatistics> = [
  'turnsTaken', 'turnTrackedDamageDealt', 'turnTrackedHealingDone',
  'damageDealt', 'damageTaken', 'healingDone', 'healingReceived',
  'temporaryHpGranted', 'damagePrevented', 'hostileConditionsApplied', 'attacks',
  'hits', 'criticalHits', 'knockouts', 'kills', 'alliesRescued', 'successfulSaves',
  'failedSaves', 'concentrationChecks', 'concentrationMaintained', 'actionsSpent',
  'bonusActionsSpent', 'reactionsSpent', 'movementSpentFeet', 'classResourcesSpent',
  'spellSlotsSpent',
]

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}

function formatSessionTime(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function analyticsEntry(
  session: CombatStatisticsSession,
  entry: CombatantStatistics,
  maps: ReturnType<typeof useMapStore.getState>['maps'],
): AnalyticsEntry {
  const tokenCharacterId = maps
    .find((map) => map.id === session.mapId)
    ?.tokens.find((token) => token.id === entry.combatantId)
    ?.characterId
  const characterId = entry.characterId ?? tokenCharacterId
  return {
    ...entry,
    characterId,
    turnsTaken: Number.isFinite(entry.turnsTaken) ? entry.turnsTaken : 0,
    turnTrackedDamageDealt: Number.isFinite(entry.turnTrackedDamageDealt) ? entry.turnTrackedDamageDealt : 0,
    turnTrackedHealingDone: Number.isFinite(entry.turnTrackedHealingDone) ? entry.turnTrackedHealingDone : 0,
    combatD20FaceCounts: Array.isArray(entry.combatD20FaceCounts)
      ? [...entry.combatD20FaceCounts]
      : emptyD20FaceCounts(),
    analyticsKey: characterId ? `character:${characterId}` : `${entry.side}:${entry.combatantId}`,
  }
}

function aggregateCombatStatistics(
  sessions: CombatStatisticsSession[],
  maps: ReturnType<typeof useMapStore.getState>['maps'],
): AnalyticsEntry[] {
  const aggregate = new Map<string, AnalyticsEntry>()
  for (const session of sessions) {
    for (const rawEntry of Object.values(session.combatants)) {
      const entry = analyticsEntry(session, rawEntry, maps)
      const current = aggregate.get(entry.analyticsKey)
      if (!current) {
        aggregate.set(entry.analyticsKey, entry)
        continue
      }
      current.name = entry.name || current.name
      current.characterId = entry.characterId ?? current.characterId
      for (const field of numericFields) {
        const value = entry[field]
        if (typeof value === 'number') (current[field] as number) += value
      }
      entry.combatD20FaceCounts.forEach((count, index) => {
        current.combatD20FaceCounts[index] += count
      })
    }
  }
  return [...aggregate.values()]
}

function nonCombatD20FaceCounts(input: {
  entry: AnalyticsEntry
  checks: ReturnType<typeof useGroupAbilityChecksStore.getState>['state']['checks']
  messages: ReturnType<typeof useRoomCommunicationsStore.getState>['chat']['messages']
  startedAt?: number
  endedAt?: number
}): number[] {
  const counts = emptyD20FaceCounts()
  const characterId = input.entry.characterId
  if (!characterId) return counts
  const inWindow = (timestamp: number) =>
    (input.startedAt == null || timestamp >= input.startedAt) &&
    (input.endedAt == null || timestamp <= input.endedAt)
  for (const check of input.checks) {
    for (const result of check.results) {
      if (
        result.characterId !== characterId ||
        result.source === 'passive-only' ||
        !inWindow(result.rolledAt) ||
        !Number.isInteger(result.d20) ||
        result.d20 < 1 ||
        result.d20 > 20
      ) continue
      counts[result.d20 - 1] += 1
    }
  }
  for (const message of input.messages) {
    const roll = message.roll
    if (
      message.persona.sourceId !== characterId ||
      !roll ||
      roll.sides !== 20 ||
      !inWindow(message.createdAt)
    ) continue
    for (const value of roll.values) {
      if (Number.isInteger(value) && value >= 1 && value <= 20) counts[value - 1] += 1
    }
  }
  return counts
}

function contributionLabel(value: number): string {
  return `${formatDecimal(value)}%`
}

function TeamTable({
  label,
  entries,
  selectedKey,
  onSelect,
}: {
  label: string
  entries: AnalyticsEntry[]
  selectedKey?: string
  onSelect: (key: string) => void
}) {
  if (entries.length === 0) return null
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</h4>
        <span className="text-xs tabular-nums text-slate-500">{entries.length} 个单位</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="bg-white/[0.04] text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold">角色</th>
              <th className="px-3 py-2 text-right font-semibold">回合</th>
              <th className="px-3 py-2 text-right font-semibold">每回合伤害</th>
              <th className="px-3 py-2 text-right font-semibold">有效伤害</th>
              <th className="px-3 py-2 text-right font-semibold">治疗</th>
              <th className="px-3 py-2 text-right font-semibold">命中率</th>
              <th className="px-3 py-2 text-right font-semibold">豁免率</th>
              <th className="px-3 py-2 text-right font-semibold">进攻指数</th>
              <th className="px-3 py-2 text-right font-semibold">防御/支援</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.analyticsKey}
                className={`cursor-pointer border-t border-white/[0.06] transition-colors ${
                  selectedKey === entry.analyticsKey ? 'bg-violet-500/10 text-white' : 'text-slate-200 hover:bg-white/[0.035]'
                }`}
                onClick={() => onSelect(entry.analyticsKey)}
              >
                <td className="max-w-48 truncate px-3 py-2 font-semibold" title={entry.name}>{entry.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{entry.turnsTaken}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-200">
                  {formatDecimal(combatantDamagePerTurn(entry))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{entry.damageDealt}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-200">{entry.healingDone}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(percentage(entry.hits, entry.attacks))}%</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatDecimal(percentage(entry.successfulSaves, entry.successfulSaves + entry.failedSaves))}%
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-amber-200">
                  {contributionLabel(combatantOffensiveContributionIndex(entry, entries))}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-sky-200">
                  {contributionLabel(combatantDefensiveContributionIndex(entry, entries))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function D20Distribution({
  counts,
  scope,
  onScopeChange,
}: {
  counts: number[]
  scope: 'combat' | 'all'
  onScopeChange: (scope: 'combat' | 'all') => void
}) {
  const maximum = Math.max(1, ...counts)
  const total = counts.reduce((sum, count) => sum + count, 0)
  const average = total > 0
    ? counts.reduce((sum, count, index) => sum + count * (index + 1), 0) / total
    : 0
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Dices className="h-4 w-4 text-violet-300" />
            天然 d20 点数分布
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            {total} 次样本 · 平均 {formatDecimal(average)} · 战斗数据记录最终采用骰
          </p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-slate-950 p-1 text-xs">
          <button
            type="button"
            onClick={() => onScopeChange('combat')}
            className={`rounded-md px-3 py-1.5 ${scope === 'combat' ? 'bg-violet-500/25 text-violet-100' : 'text-slate-500'}`}
          >
            仅战斗
          </button>
          <button
            type="button"
            onClick={() => onScopeChange('all')}
            className={`rounded-md px-3 py-1.5 ${scope === 'all' ? 'bg-violet-500/25 text-violet-100' : 'text-slate-500'}`}
          >
            战斗＋非战斗
          </button>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <div className="grid h-40 min-w-[640px] grid-cols-20 items-end gap-1.5">
          {counts.map((count, index) => {
            const face = index + 1
            return (
              <div key={face} className="flex h-full flex-col justify-end gap-1 text-center">
                <span className="text-[10px] tabular-nums text-slate-500">{count || ''}</span>
                <div className="flex h-28 items-end rounded-sm bg-white/[0.025]">
                  <div
                    className={`w-full rounded-sm transition-[height] ${
                      face === 1 ? 'bg-rose-500/75' : face === 20 ? 'bg-emerald-400/80' : 'bg-violet-500/65'
                    }`}
                    style={{ height: count > 0 ? `${Math.max(5, (count / maximum) * 100)}%` : '0%' }}
                    title={`${face}：${count} 次`}
                  />
                </div>
                <span className={`text-[10px] tabular-nums ${face === 1 ? 'text-rose-300' : face === 20 ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {face}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function CampaignAdvancedAnalyticsPanel() {
  const sessions = useCombatStatisticsStore((state) => state.sessions)
  const maps = useMapStore((state) => state.maps)
  const checks = useGroupAbilityChecksStore((state) => state.state.checks)
  const messages = useRoomCommunicationsStore((state) => state.chat.messages)
  const [selected, setSelected] = useState(CAMPAIGN_TOTAL)
  const [selectedCombatantKey, setSelectedCombatantKey] = useState<string>()
  const [rollScope, setRollScope] = useState<'combat' | 'all'>('combat')

  const orderedSessions = useMemo(
    () => [...sessions].sort((left, right) => right.updatedAt - left.updatedAt),
    [sessions],
  )
  const selectedSession = orderedSessions.find((session) => session.combatId === selected)
  const entries = useMemo(
    () => selected === CAMPAIGN_TOTAL || !selectedSession
      ? aggregateCombatStatistics(orderedSessions, maps)
      : Object.values(selectedSession.combatants).map((entry) => analyticsEntry(selectedSession, entry, maps)),
    [maps, orderedSessions, selected, selectedSession],
  )
  const party = entries
    .filter((entry) => entry.side !== 'enemy')
    .sort((left, right) =>
      combatantDamagePerTurn(right) - combatantDamagePerTurn(left) || right.damageDealt - left.damageDealt,
    )
  const selectedEntry = party.find((entry) => entry.analyticsKey === selectedCombatantKey) ?? party[0]
  const mapNames = new Map(maps.map((map) => [map.id, map.name]))
  const viewLabel = selectedSession
    ? `${mapNames.get(selectedSession.mapId) ?? '未命名地图'} · 第 ${selectedSession.lastRound} 轮`
    : `战役累计 · ${sessions.length} 场战斗`
  const experienceTotal = selectedSession?.experienceSettlement?.totalXp ??
    orderedSessions.reduce((total, session) => total + (session.experienceSettlement?.totalXp ?? 0), 0)
  const totalPartyTurns = party.reduce((total, entry) => total + entry.turnsTaken, 0)
  const totalPartyAttacks = party.reduce((total, entry) => total + entry.attacks, 0)
  const totalPartyHits = party.reduce((total, entry) => total + entry.hits, 0)
  const metrics = [
    {
      label: '团队每回合伤害',
      value: formatDecimal(party.reduce((total, entry) => total + entry.damageDealt, 0) / Math.max(1, totalPartyTurns)),
      tone: 'text-rose-200',
      icon: Activity,
    },
    {
      label: '团队命中率',
      value: `${formatDecimal(percentage(totalPartyHits, totalPartyAttacks))}%`,
      tone: 'text-amber-200',
      icon: Crosshair,
    },
    {
      label: '有效治疗',
      value: party.reduce((total, entry) => total + entry.healingDone, 0),
      tone: 'text-emerald-200',
      icon: HeartPulse,
    },
    {
      label: '减伤与临时生命',
      value: party.reduce((total, entry) => total + entry.damagePrevented + entry.temporaryHpGranted, 0),
      tone: 'text-sky-200',
      icon: ShieldCheck,
    },
    {
      label: '战役经验',
      value: experienceTotal,
      tone: 'text-violet-200',
      icon: Target,
    },
  ]

  const distribution = useMemo(() => {
    if (!selectedEntry) return emptyD20FaceCounts()
    const counts = [...selectedEntry.combatD20FaceCounts]
    if (rollScope === 'combat') return counts
    const additional = nonCombatD20FaceCounts({
      entry: selectedEntry,
      checks,
      messages,
      startedAt: selectedSession?.startedAt,
      endedAt: selectedSession?.updatedAt,
    })
    return counts.map((count, index) => count + additional[index])
  }, [checks, messages, rollScope, selectedEntry, selectedSession])

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="rounded-xl bg-violet-500/15 p-3 text-violet-300">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">进阶数据</h3>
            <p className="mt-1 text-sm text-slate-500">{viewLabel}</p>
          </div>
        </div>
        {orderedSessions.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-400">
            数据范围
            <select
              value={selectedSession ? selectedSession.combatId : CAMPAIGN_TOTAL}
              onChange={(event) => {
                setSelected(event.target.value)
                setSelectedCombatantKey(undefined)
              }}
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

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map(({ label, value, tone, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-slate-950/35 px-3 py-3">
            <Icon className={`h-4 w-4 ${tone}`} />
            <p className={`mt-2 text-xl font-bold tabular-nums ${tone}`}>{value}</p>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {party.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
            <p className="text-sm text-slate-400">还没有可分析的 Headless 战斗事件。</p>
            <p className="mt-1 text-xs text-slate-600">完成一场战斗后，这里会生成角色级趋势和骰点分布。</p>
          </div>
        ) : (
          <>
            <TeamTable
              label="玩家与友方"
              entries={party}
              selectedKey={selectedEntry?.analyticsKey}
              onSelect={setSelectedCombatantKey}
            />
            {selectedEntry && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
                <D20Distribution counts={distribution} scope={rollScope} onScopeChange={setRollScope} />
                <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
                  <h4 className="text-sm font-semibold text-slate-200">{selectedEntry.name} · 行动效率</h4>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    {[
                      ['每回合伤害', formatDecimal(combatantDamagePerTurn(selectedEntry))],
                      ['每回合治疗', formatDecimal(combatantHealingPerTurn(selectedEntry))],
                      ['暴击率', `${formatDecimal(percentage(selectedEntry.criticalHits, selectedEntry.attacks))}%`],
                      ['专注维持', `${formatDecimal(percentage(selectedEntry.concentrationMaintained, selectedEntry.concentrationChecks))}%`],
                      ['承受伤害', selectedEntry.damageTaken],
                      ['阻止伤害', selectedEntry.damagePrevented],
                      ['控制次数', selectedEntry.hostileConditionsApplied],
                      ['击倒 / 击杀', `${selectedEntry.knockouts} / ${selectedEntry.kills}`],
                      ['每回合动作', formatDecimal(selectedEntry.actionsSpent / Math.max(1, selectedEntry.turnsTaken))],
                      ['法术位 / 职业资源', `${selectedEntry.spellSlotsSpent} / ${selectedEntry.classResourcesSpent}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="mt-1 text-base font-semibold tabular-nums text-slate-200">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}
          </>
        )}
        <p className="px-1 text-xs leading-relaxed text-slate-500">
          进攻与防御/支援指数表示角色在同阵营有效伤害、命中、控制、击倒/击杀，以及治疗、临时生命、减伤、救援和成功豁免中的相对占比；同队合计约为 100%，不是 D&amp;D 5e 规则数值。非战斗骰点目前来自群体检定与带角色身份的聊天 /roll，手动实体骰不会被推测记录。
        </p>
      </div>
    </Card>
  )
}
