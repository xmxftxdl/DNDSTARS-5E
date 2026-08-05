import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ChevronDown, Download, FileText, Swords, Trash2 } from 'lucide-react'
import Card from './Card'
import {
  combatLogArchiveFilename,
  formatCombatLogArchiveText,
  type CombatStatisticsSession,
} from '../lib/combatStatistics'
import { loadSharedResource } from '../composition/browserSharedRoomResources'
import { showAppConfirm } from '../lib/appDialog'
import type { SharedCombatLogState, SharedCombatState } from '../lib/sharedCombatTypes'
import { useCombatStatisticsStore } from '../store/combatStatistics'
import { useMapStore } from '../store/maps'
import type { BattleMap } from '../store/maps'

const KIND_LABEL = {
  system: '规则',
  turn: '回合',
  attack: '攻击',
  damage: '结算',
} as const

function formatArchiveTime(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function CombatArchiveDetails({ session }: { session: CombatStatisticsSession }) {
  const entries = [...session.logEntries ?? []].sort((left, right) =>
    left.round - right.round || left.id - right.id)
  return (
    <div className="border-t border-white/[0.07] bg-black/10 px-4 py-3">
      <div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1">
        {entries.map((entry) => (
          <article
            key={`${session.combatId}:${entry.id}`}
            className="rounded-lg border border-white/[0.07] bg-void-950/45 px-3 py-2"
          >
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold text-slate-500">
              <span className="tabular-nums">R{entry.round}</span>
              <span className="tabular-nums">{entry.time}</span>
              <span className="rounded bg-white/5 px-1.5 py-0.5">{KIND_LABEL[entry.kind]}</span>
            </div>
            <p className="text-xs font-semibold leading-5 text-slate-200">{entry.text}</p>
            {entry.details?.length ? (
              <ul className="mt-2 space-y-1 border-l border-violet-400/20 pl-3 text-[11px] leading-5 text-slate-400">
                {entry.details.map((detail, index) => (
                  <li key={`${entry.id}:detail:${index}`}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  )
}

export function CampaignCombatLogArchiveView({
  sessions,
  hydrated,
  maps,
  onDelete,
}: {
  sessions: readonly CombatStatisticsSession[]
  hydrated: boolean
  maps: readonly BattleMap[]
  onDelete?: (combatId: string) => Promise<boolean>
}) {
  const [expandedCombatId, setExpandedCombatId] = useState<string>()
  const [deletingCombatId, setDeletingCombatId] = useState<string>()
  const [deleteError, setDeleteError] = useState<string>()
  const archived = useMemo(() => sessions
    .filter((session) => (session.logEntries?.length ?? 0) > 0)
    .sort((left, right) =>
      (right.endedAt ?? right.updatedAt) - (left.endedAt ?? left.updatedAt)), [sessions])

  const exportAll = () => {
    const body = archived.map((session) => formatCombatLogArchiveText(session)).join('\n\n' + '='.repeat(72) + '\n\n')
    const stamp = new Date().toISOString().slice(0, 10)
    downloadText(`DNDSTARS-全部战斗记录-${stamp}.txt`, body)
  }

  const requestDelete = async (session: CombatStatisticsSession) => {
    if (!onDelete || deletingCombatId) return
    const mapName = session.mapName ?? maps.find((map) => map.id === session.mapId)?.name ?? session.mapId
    const confirmed = await showAppConfirm({
      title: '删除战斗 LOG',
      message: `确定删除“${mapName}”的战斗 LOG 吗？仅删除日志正文，战斗统计和经验结算仍会保留。`,
      confirmLabel: '删除 LOG',
      tone: 'danger',
    })
    if (!confirmed) return
    setDeleteError(undefined)
    setDeletingCombatId(session.combatId)
    try {
      const deleted = await onDelete(session.combatId)
      if (!deleted) {
        setDeleteError('删除未能同步到战役存档，请检查连接后重试。')
        return
      }
      setExpandedCombatId((current) => current === session.combatId ? undefined : current)
    } catch (error) {
      console.error('[combat-log] delete failed', error)
      setDeleteError('删除失败，请稍后重试。')
    } finally {
      setDeletingCombatId(undefined)
    }
  }

  return (
    <section aria-label="历史战斗记录">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <Archive className="h-4 w-4" />
          历史战斗记录
        </h3>
        {archived.length > 0 ? (
          <button
            type="button"
            onClick={exportAll}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
          >
            <Download className="h-3.5 w-3.5" />
            导出全部
          </button>
        ) : null}
      </div>
      {deleteError ? (
        <p role="alert" className="mb-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {deleteError}
        </p>
      ) : null}
      <Card className="overflow-hidden !p-0">
        {!hydrated ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">正在读取战役档案…</div>
        ) : archived.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-9 text-center">
            <FileText className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-300">还没有已归档的战斗记录</p>
            <p className="mt-1 text-xs text-slate-500">下一场战斗结束后，完整战斗 LOG 会自动保存在这里。</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.07]">
            {archived.map((session) => {
              const expanded = expandedCombatId === session.combatId
              const mapName = session.mapName ?? maps.find((map) => map.id === session.mapId)?.name ?? session.mapId
              const participants = Object.values(session.combatants)
              return (
                <div key={session.combatId}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedCombatId(expanded ? undefined : session.combatId)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-expanded={expanded}
                    >
                      <span className="rounded-xl bg-rose-500/10 p-2 text-rose-300">
                        <Swords className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-100">{mapName}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {formatArchiveTime(session.endedAt ?? session.updatedAt)} · {session.lastRound} 回合 · {session.logEntries?.length ?? 0} 条记录 · {participants.length} 名单位
                        </span>
                      </span>
                      <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadText(combatLogArchiveFilename(session), formatCombatLogArchiveText(session))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-violet-400/30 hover:text-violet-200"
                      >
                        <Download className="h-3.5 w-3.5" />
                        导出 TXT
                      </button>
                      {onDelete ? (
                        <button
                          type="button"
                          disabled={deletingCombatId != null}
                          onClick={() => { void requestDelete(session) }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/20 bg-rose-500/5 px-2.5 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-wait disabled:opacity-50"
                          aria-label={`删除 ${mapName} 的战斗 LOG`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingCombatId === session.combatId ? '删除中…' : '删除'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {expanded ? <CombatArchiveDetails session={session} /> : null}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </section>
  )
}

export default function CampaignCombatLogArchivePanel() {
  const sessions = useCombatStatisticsStore((state) => state.sessions)
  const hydrated = useCombatStatisticsStore((state) => state.hydrated)
  const archiveCombatLog = useCombatStatisticsStore((state) => state.archiveCombatLog)
  const deleteCombatLog = useCombatStatisticsStore((state) => state.deleteCombatLog)
  const maps = useMapStore((state) => state.maps)
  const migrationAttemptRef = useRef('')

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    void Promise.all([
      loadSharedResource<SharedCombatState>('combat'),
      loadSharedResource<SharedCombatLogState>('combat-log'),
    ]).then(async ([combat, log]) => {
      if (cancelled || combat?.active || !log?.entries.length) return
      const key = `${log.mapId}:${log.updatedAt}:${log.entries[0]?.id ?? ''}`
      if (migrationAttemptRef.current === key) return
      migrationAttemptRef.current = key
      const currentSessions = useCombatStatisticsStore.getState().sessions
      const wasDeleted = currentSessions.some((session) =>
        session.mapId === log.mapId &&
        session.logDeletedAt != null &&
        session.endedAt === log.updatedAt)
      if (wasDeleted) return
      const exact = combat?.combatId
        ? currentSessions.find((session) => session.combatId === combat.combatId)
        : undefined
      const target = exact?.mapId === log.mapId
        ? exact
        : [...currentSessions]
            .filter((session) => session.mapId === log.mapId)
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .find((session) => !session.logEntries?.length && !session.logDeletedAt)
      if (target?.logEntries?.length || target?.logDeletedAt) return
      const latestEntryId = Math.max(0, ...log.entries.map((entry) => entry.id))
      const combatId = target?.combatId ?? `legacy-log:${log.mapId}:${latestEntryId}`
      await archiveCombatLog({
        combatId,
        mapId: log.mapId,
        mapName: maps.find((map) => map.id === log.mapId)?.name,
        entries: log.entries,
        startedAt: target?.startedAt ?? log.updatedAt,
        endedAt: log.updatedAt,
        lastRound: Math.max(0, ...log.entries.map((entry) => entry.round)),
      })
    }).catch((error) => {
      console.error('[combat-log] legacy archive migration failed', error)
    })
    return () => {
      cancelled = true
    }
  }, [archiveCombatLog, hydrated, maps])

  return (
    <CampaignCombatLogArchiveView
      sessions={sessions}
      hydrated={hydrated}
      maps={maps}
      onDelete={deleteCombatLog}
    />
  )
}
