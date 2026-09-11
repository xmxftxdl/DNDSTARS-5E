import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { AudioLines, ChevronDown, ChevronUp, Mic, MicOff, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useVoiceRoom } from '../../voice/useVoiceRoom'

export default function MapVoicePanel({ belowInitiative = false }: { belowInitiative?: boolean }) {
  const voice = useVoiceRoom()
  const [expanded, setExpanded] = useState(true)
  const panelRef = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null)
  const suppressClick = useRef(false)
  const clampPosition = (x: number, y: number) => {
    const panel = panelRef.current
    const parent = panel?.parentElement
    return {
      x: Math.max(8, Math.min(x, (parent?.clientWidth ?? 0) - (panel?.offsetWidth ?? 0) - 8)),
      y: Math.max(8, Math.min(y, (parent?.clientHeight ?? 0) - (panel?.offsetHeight ?? 0) - 8)),
    }
  }
  useEffect(() => {
    const panel = panelRef.current
    if (!panel?.parentElement) return
    const observer = new ResizeObserver(() => setPosition((current) => {
      if (!current) return current
      const next = clampPosition(current.x, current.y)
      return next.x === current.x && next.y === current.y ? current : next
    }))
    observer.observe(panel)
    observer.observe(panel.parentElement)
    return () => observer.disconnect()
  }, [])
  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !panelRef.current) return
    suppressClick.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      left: panelRef.current.offsetLeft, top: panelRef.current.offsetTop }
  }
  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = drag.current
    if (!origin || origin.pointerId !== event.pointerId) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    if (Math.hypot(dx, dy) < 4 && !suppressClick.current) return
    suppressClick.current = true
    setPosition(clampPosition(origin.left + dx, origin.top + dy))
  }
  if (!voice.session) return null
  const config = voice.voiceChangerConfig
  const active = config.slots.find((slot) => slot.shortcut === config.activeShortcut)
  const campaignId = voice.session.campaignId ?? voice.session.roomId
  return (
    <aside ref={panelRef} className="map-voice-panel" data-below-initiative={belowInitiative || undefined} aria-label="地图房间语音"
      style={position ? { left: position.x, top: position.y, right: 'auto' } : undefined}>
      <button type="button" className="flex w-full shrink-0 items-center gap-2 px-3 py-2 text-xs text-slate-200 cursor-grab touch-none select-none active:cursor-grabbing"
        title="拖动标题移动面板；点击折叠或展开"
        onPointerDown={startDrag} onPointerMove={moveDrag}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null; suppressClick.current = true }}
        aria-expanded={expanded} aria-label={expanded ? '折叠房间语音' : '展开房间语音'}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return }
          setExpanded((value) => !value)
        }}>
        <AudioLines className="h-4 w-4 shrink-0 text-cyan-300" />
        <span className="min-w-0 flex-1 truncate text-left">{active ? `扮演：${active.npcName}` : '房间语音'}</span>
        <span className="text-slate-400">{voice.connected ? voice.state.participants.length : '未连接'}</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && <div className="map-voice-panel__body space-y-2 border-t border-white/10 p-2">
        {voice.connected ? <ul className="space-y-1" aria-label="语音成员">
          {voice.state.participants.map((participant) => <li key={participant.identity}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${participant.speaking ? 'bg-emerald-400/15 ring-1 ring-emerald-300/35' : ''}`}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${participant.speaking ? 'bg-emerald-300' : 'bg-slate-500'}`} />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{participant.displayName}{participant.local ? '（你）' : ''}</span>
            <span className="text-[10px] text-slate-400">{participant.role === 'dm' ? 'DM' : participant.role === 'spectator' ? '观战' : '玩家'}</span>
            {participant.microphoneEnabled ? <Mic aria-label="麦克风已开启" className="h-3 w-3 text-slate-400" /> : <MicOff aria-label="已静音" className="h-3 w-3 text-slate-500" />}
          </li>)}
        </ul> : <p className="px-1 text-[11px] text-slate-400">{voice.notice ?? '加入语音后显示通话成员。'}</p>}
        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          {!voice.connected ? <button type="button" disabled={voice.joining || voice.enabled !== true}
            onClick={() => void voice.connect()} className="rounded-md bg-cyan-400/10 px-2 py-1 text-xs text-cyan-200 disabled:opacity-40">
            {voice.joining ? '连接中…' : '加入语音'}
          </button> : voice.state.canPublish ? <button type="button"
            onClick={() => void voice.setMicrophoneEnabled(!voice.state.microphoneEnabled).catch(() => undefined)}
            className="rounded-md px-2 py-1 text-xs text-cyan-200 hover:bg-white/10">
            {voice.state.microphoneEnabled ? '关闭麦克风' : '开启麦克风'}
          </button> : <span className="text-xs text-slate-400">正在收听</span>}
          <Link to={`/campaign/${encodeURIComponent(campaignId)}/communications?tab=voice`} aria-label="语音与变声设置" title="语音与变声设置" className="rounded-md p-1 text-slate-400 hover:text-white"><Settings2 className="h-4 w-4" /></Link>
        </div>
      </div>}
    </aside>
  )
}
