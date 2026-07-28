import { useEffect, useRef, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { formatCampaignTime, type CampaignTimer } from '../lib/campaignTime'
import { useCampaignTimeStore } from '../store/campaignTime'
import { useCharacterStore } from '../store/characters'
import { useMapGeometryStore } from '../store/mapGeometry'
import { useMapStore } from '../store/maps'

export default function CampaignTimeSystem({ isDm }: { isDm: boolean }) {
  const clock = useCampaignTimeStore((state) => state.state)
  const mutate = useCampaignTimeStore((state) => state.mutate)
  const characters = useCharacterStore((state) => state.characters)
  const maps = useMapStore((state) => state.maps)
  const geometryMaps = useMapGeometryStore((state) => state.maps)
  const [notification, setNotification] = useState<CampaignTimer | null>(null)
  const seenTimerIds = useRef(new Set<string>())

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

  if (!notification) return null
  const close = () => {
    seenTimerIds.current.add(notification.id)
    setNotification(null)
  }
  return (
    <div className="fixed right-5 top-5 z-[400] w-80 rounded-2xl border border-amber-400/30 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
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
    </div>
  )
}
