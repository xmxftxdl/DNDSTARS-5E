import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AudioLines, LoaderCircle, Mic, MicOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  clampVoiceFloatingDockY,
  defaultVoiceFloatingDockY,
} from '../voice/voiceFloatingDock'
import { useVoiceRoom } from '../voice/useVoiceRoom'

interface DragState {
  pointerId: number
  startClientY: number
  startTop: number
  moved: boolean
}

export default function VoiceRoomSystem() {
  const navigate = useNavigate()
  const voice = useVoiceRoom()
  const storageKey = `stars-voice-floating-dock-y:v1:${voice.session?.memberId ?? 'anonymous'}`
  const [top, setTop] = useState(() => {
    const stored = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(stored) && stored > 0
      ? clampVoiceFloatingDockY(stored, window.innerHeight)
      : defaultVoiceFloatingDockY(window.innerHeight)
  })
  const drag = useRef<DragState | null>(null)
  const suppressClick = useRef(false)
  const activeVoiceSlot = voice.voiceChangerConfig.activeShortcut
    ? voice.voiceChangerConfig.slots.find((slot) => slot.shortcut === voice.voiceChangerConfig.activeShortcut)
    : undefined

  useEffect(() => {
    const keepInsideViewport = () => setTop((value) => clampVoiceFloatingDockY(value, window.innerHeight))
    window.addEventListener('resize', keepInsideViewport)
    return () => window.removeEventListener('resize', keepInsideViewport)
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startTop: top,
      moved: false,
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    const delta = event.clientY - active.startClientY
    if (Math.abs(delta) >= 4) active.moved = true
    setTop(clampVoiceFloatingDockY(active.startTop + delta, window.innerHeight))
  }

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    const finalTop = clampVoiceFloatingDockY(
      active.startTop + event.clientY - active.startClientY,
      window.innerHeight,
    )
    suppressClick.current = active.moved
    drag.current = null
    setTop(finalTop)
    window.localStorage.setItem(storageKey, String(finalTop))
  }

  const openVoicePage = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const campaignId = voice.session?.campaignId ?? voice.session?.roomId
    if (!campaignId) return
    navigate(`/campaign/${encodeURIComponent(campaignId)}/communications?tab=voice`)
  }

  const Icon = voice.state.connectionState === 'connecting' || voice.state.connectionState === 'reconnecting'
    ? LoaderCircle
    : voice.connected && voice.state.canPublish
      ? voice.state.microphoneEnabled ? Mic : MicOff
      : AudioLines

  return (
    <button
      type="button"
      aria-label={activeVoiceSlot ? `打开房间语音；当前 NPC：${activeVoiceSlot.npcName}` : '打开房间语音；可上下拖动'}
      title={activeVoiceSlot ? `当前 NPC：${activeVoiceSlot.npcName}；拖动调整位置，点击打开语音` : '拖动调整位置；点击打开房间语音'}
      onClick={openVoicePage}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      className={`fixed right-4 z-[90] flex h-[52px] w-[52px] touch-none select-none items-center justify-center rounded-2xl border shadow-2xl backdrop-blur-xl transition-[background-color,border-color,color,transform] hover:scale-105 ${voice.connected ? 'border-emerald-300/35 bg-emerald-950/90 text-emerald-200' : 'border-cyan-300/20 bg-slate-950/90 text-cyan-200'}`}
      style={{ top }}
    >
      <Icon className={`h-5 w-5 ${voice.state.connectionState === 'connecting' || voice.state.connectionState === 'reconnecting' ? 'animate-spin' : ''}`} />
      {voice.connected && (
        <span className="absolute -left-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1 text-[10px] font-black leading-5 text-emerald-950">
          {Math.min(99, voice.state.participants.length)}
        </span>
      )}
      {activeVoiceSlot && (
        <span className="absolute -bottom-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-violet-200/40 bg-violet-500 px-1 text-[10px] font-black leading-5 text-white">
          {activeVoiceSlot.shortcut}
        </span>
      )}
      {voice.enabled === false && <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-slate-500" />}
    </button>
  )
}
