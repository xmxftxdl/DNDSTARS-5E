import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, CheckCircle2, Coffee, MoonStar, X } from 'lucide-react'
import {
  formatCampaignTime,
  type CampaignRestRecoveryEntry,
  type CampaignTimeAdvance,
  type CampaignTimer,
} from '../lib/campaignTime'
import { useCampaignTimeStore } from '../store/campaignTime'
import { useCharacterStore } from '../store/characters'
import { useMapGeometryStore } from '../store/mapGeometry'
import { useMapStore } from '../store/maps'
import { getRoomSession } from '../lib/roomSession'
import { roomOwnedPlayerCharacters } from '../lib/playerView'
import Dnd5eShortRestRecoveryActions from './Dnd5eShortRestRecoveryActions'

const RECOVERY_CATEGORY_LABELS: Record<CampaignRestRecoveryEntry['category'], string> = {
  'hit-points': '生命值',
  'hit-dice': '生命骰',
  'feature-resource': '特性与法术资源',
  'item-resource': '魔法物品与充能',
  state: '状态',
}

function restReceiptStorageKey(): string {
  return `stars-rest-recovery-receipts-v1:${getRoomSession()?.roomId ?? 'local'}`
}

function readRestReceipts(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const value = JSON.parse(window.localStorage.getItem(restReceiptStorageKey()) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeRestReceipts(receipts: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(restReceiptStorageKey(), JSON.stringify([...receipts].slice(-64)))
  } catch {
    // 浏览器禁止持久化时，当前会话内的 ref 仍可防止重复弹窗。
  }
}

function recoveryValue(entry: CampaignRestRecoveryEntry): string | null {
  if (entry.before == null && entry.after == null) return null
  const maximum = entry.maximum == null ? '' : ` / ${entry.maximum}`
  if (entry.before == null) return `${entry.after ?? 0}${maximum}`
  if (entry.after == null || entry.before === entry.after) return `${entry.before}${maximum}`
  return `${entry.before} → ${entry.after}${maximum}`
}

export default function CampaignTimeSystem({ isDm }: { isDm: boolean }) {
  const clock = useCampaignTimeStore((state) => state.state)
  const mutate = useCampaignTimeStore((state) => state.mutate)
  const characters = useCharacterStore((state) => state.characters)
  const maps = useMapStore((state) => state.maps)
  const geometryMaps = useMapGeometryStore((state) => state.maps)
  const [notification, setNotification] = useState<CampaignTimer | null>(null)
  const [restAdvance, setRestAdvance] = useState<CampaignTimeAdvance | null>(null)
  const seenTimerIds = useRef(new Set<string>())
  const seenRestIds = useRef(readRestReceipts())
  const roomSession = getRoomSession()
  const playerOwnedCharacterIds = useMemo(() => {
    if (roomSession?.role !== 'player') return new Set<string>()
    return new Set(roomOwnedPlayerCharacters(characters, roomSession.roomId, roomSession.memberId)
      .map((character) => character.id))
  }, [characters, roomSession?.memberId, roomSession?.role, roomSession?.roomId])

  useEffect(() => {
    if (isDm) {
      void useCharacterStore.getState().reconcileCampaignTimeAndSave(clock).catch((error) => {
        console.error('[campaign-time] character reconciliation failed', error)
      })
      useMapStore.getState().expireTimedLights(clock.worldMinute)
      useMapGeometryStore.getState().expireTimedLights(clock.worldMinute)
    }
  }, [characters, clock, geometryMaps, isDm, maps])

  useEffect(() => {
    if (notification) return
    const newlyExpired = clock.timers.find((timer) =>
      timer.status === 'expired' && !seenTimerIds.current.has(timer.id),
    )
    if (newlyExpired) setNotification(newlyExpired)
  }, [clock.timers, notification])

  useEffect(() => {
    if (restAdvance) return
    const unseen = [...clock.advances].reverse().find((advance) =>
      (advance.kind === 'short-rest' || advance.kind === 'long-rest') &&
      (advance.restRecoveryReports?.length ?? 0) > 0 &&
      !seenRestIds.current.has(advance.id),
    )
    if (unseen) setRestAdvance(unseen)
  }, [clock.advances, restAdvance])

  const close = () => {
    if (!notification) return
    seenTimerIds.current.add(notification.id)
    setNotification(null)
  }
  const closeRest = () => {
    if (!restAdvance) return
    seenRestIds.current.add(restAdvance.id)
    writeRestReceipts(seenRestIds.current)
    setRestAdvance(null)
  }
  return (
    <>
      {restAdvance && <div className="fixed inset-0 z-[520] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="rest-recovery-title" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-indigo-300/20 bg-slate-950 shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-300">
                {restAdvance.kind === 'long-rest' ? <MoonStar className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                权威休息结算
              </p>
              <h2 id="rest-recovery-title" className="mt-2 text-xl font-bold text-slate-100">
                {restAdvance.kind === 'long-rest' ? '长休恢复完成' : '短休恢复完成'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{formatCampaignTime(restAdvance.toWorldMinute)} · 以下结果已同步至角色卡</p>
            </div>
            <button type="button" onClick={closeRest} className="rounded-xl border border-white/10 p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="关闭休息结算"><X className="h-5 w-5" /></button>
          </header>
          <div className="overflow-y-auto px-5 py-5 sm:px-7">
            <div className="grid gap-4 lg:grid-cols-2">
              {restAdvance.restRecoveryReports?.map((report) => (
                <article key={report.characterId} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate font-semibold text-slate-100">{report.characterName}</h3>
                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">已结算</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {report.entries.map((entry, index) => {
                      const value = recoveryValue(entry)
                      const positive = entry.outcome === 'restored' || entry.outcome === 'cleared'
                      return <div key={`${entry.category}:${entry.label}:${index}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${positive ? 'text-emerald-300' : entry.outcome === 'blocked' ? 'text-amber-300' : 'text-slate-600'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-200">{entry.label}</p>
                              {value && <span className="font-mono text-xs font-bold text-indigo-200">{value}</span>}
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500">{RECOVERY_CATEGORY_LABELS[entry.category]}{entry.detail ? ` · ${entry.detail}` : ''}</p>
                          </div>
                        </div>
                      </div>
                    })}
                  </div>
                  {restAdvance.kind === 'short-rest' && playerOwnedCharacterIds.has(report.characterId) && (
                    <Dnd5eShortRestRecoveryActions
                      advance={restAdvance}
                      characterId={report.characterId}
                    />
                  )}
                </article>
              ))}
            </div>
          </div>
          <footer className="border-t border-white/10 px-5 py-4 sm:px-7">
            <button type="button" onClick={closeRest} className="w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-400">确认恢复结果</button>
          </footer>
        </section>
      </div>}

      {notification && <div className="fixed right-5 top-5 z-[400] w-80 rounded-2xl border border-amber-400/30 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">
            {notification.kind === 'concentration' ? '非战斗专注到期' : '战役提醒到期'}
          </p>
          <p className="mt-1 break-words text-sm text-slate-300">{notification.label}</p>
          <p className="mt-2 text-[11px] text-slate-500">{formatCampaignTime(clock)}</p>
          {isDm && (
            <button
              type="button"
              onClick={() => void mutate({ operation: 'dismiss-timer', timerId: notification.id }).then(close)}
              className="mt-3 rounded-lg bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/25"
            >
              确认并归档
            </button>
          )}
        </div>
        <button type="button" onClick={close} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200" title="关闭提醒">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>}
    </>
  )
}
