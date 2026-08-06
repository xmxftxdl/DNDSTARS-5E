import { useEffect, useState } from 'react'
import {
  AudioLines,
  ChevronDown,
  ChevronUp,
  Headphones,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { getRoomVoiceStatus, requestRoomVoiceAccess, roomApiErrorMessage } from '../lib/roomApi'
import type { RoomSession } from '../lib/roomSession'
import { LiveKitVoiceProvider } from '../voice/liveKitVoiceProvider'
import {
  INITIAL_VOICE_PROVIDER_SNAPSHOT,
  type VoiceProviderSnapshot,
} from '../voice/voiceTypes'

interface VoiceRoomSystemProps {
  session: RoomSession
  sidebarCollapsed: boolean
}

function roleLabel(role: RoomSession['role']) {
  if (role === 'dm') return 'DM'
  if (role === 'spectator') return '观战'
  return '玩家'
}

export default function VoiceRoomSystem({ session, sidebarCollapsed }: VoiceRoomSystemProps) {
  const [provider] = useState(() => new LiveKitVoiceProvider())
  const [providerState, setProviderState] = useState<VoiceProviderSnapshot>(INITIAL_VOICE_PROVIDER_SNAPSHOT)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [joining, setJoining] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pushToTalk, setPushToTalk] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => provider.subscribe(setProviderState), [provider])

  useEffect(() => {
    let disposed = false
    void getRoomVoiceStatus(session).then((status) => {
      if (!disposed) setEnabled(status.enabled)
    }).catch((error) => {
      if (!disposed) {
        setEnabled(false)
        setNotice(roomApiErrorMessage(error))
      }
    })
    return () => {
      disposed = true
      void provider.disconnect()
    }
  }, [provider, session])

  const connected = providerState.connectionState === 'connected' || providerState.connectionState === 'reconnecting'
  const connect = async () => {
    if (joining || connected) return
    setJoining(true)
    setNotice(null)
    try {
      const access = await requestRoomVoiceAccess(session)
      if (!access.enabled) {
        setEnabled(false)
        setNotice('当前服务器尚未启用房间语音。')
        return
      }
      await provider.connect(access)
      setExpanded(true)
    } catch (error) {
      setNotice(roomApiErrorMessage(error))
    } finally {
      setJoining(false)
    }
  }

  const disconnect = async () => {
    await provider.disconnect()
    setSettingsOpen(false)
    setExpanded(false)
  }

  const toggleMicrophone = async () => {
    await provider.setMicrophoneEnabled(!providerState.microphoneEnabled).catch(() => undefined)
  }

  const setPushToTalkActive = (active: boolean) => {
    if (!pushToTalk || !providerState.canPublish) return
    void provider.setMicrophoneEnabled(active).catch(() => undefined)
  }

  const voiceLabel = enabled === null
    ? '正在检测语音服务'
    : enabled ? '房间语音' : '语音未启用'

  return (
    <section
      aria-label="房间语音"
      className="fixed bottom-4 z-[90] transition-[left] duration-200"
      style={{ left: sidebarCollapsed ? 16 : 272 }}
    >
      <div className="glass w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
            {providerState.connectionState === 'reconnecting'
              ? <LoaderCircle className="h-4 w-4 animate-spin" />
              : <AudioLines className="h-4 w-4" />}
          </span>
          <button
            type="button"
            onClick={() => connected && setExpanded((value) => !value)}
            className="min-w-0 flex-1 text-left"
            disabled={!connected}
          >
            <span className="block truncate text-sm font-semibold text-slate-100">{voiceLabel}</span>
            <span className="block truncate text-[11px] text-slate-400">
              {connected
                ? `${providerState.participants.length} 人在线 · ${roleLabel(session.role)}`
                : notice ?? (enabled === false ? '配置 LiveKit 后即可使用' : '语音与战斗结算相互独立')}
            </span>
          </button>
          {!connected ? (
            <button
              type="button"
              onClick={() => void connect()}
              disabled={joining || enabled !== true}
              className="rounded-xl bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {joining ? '连接中…' : '加入语音'}
            </button>
          ) : (
            <>
              {providerState.canPublish && (
                <button
                  type="button"
                  title={providerState.microphoneEnabled ? '关闭麦克风' : '打开麦克风'}
                  onClick={() => void toggleMicrophone()}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${providerState.microphoneEnabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}
                >
                  {providerState.microphoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </button>
              )}
              <button
                type="button"
                title={providerState.deafened ? '恢复收听' : '耳机静音'}
                onClick={() => void provider.setDeafened(!providerState.deafened)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${providerState.deafened ? 'bg-amber-500/20 text-amber-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                {providerState.deafened ? <VolumeX className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10"
                aria-label={expanded ? '收起语音成员' : '展开语音成员'}
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </>
          )}
        </div>

        {connected && expanded && (
          <div className="border-t border-white/8 px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {providerState.participants.map((participant) => (
                <div
                  key={participant.identity}
                  className={`flex max-w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${participant.speaking ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-100' : 'border-white/8 bg-white/[0.035] text-slate-300'}`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${participant.speaking ? 'animate-pulse bg-emerald-300' : 'bg-slate-600'}`} />
                  <span className="truncate font-medium">{participant.displayName}</span>
                  <span className="text-[10px] text-slate-500">{roleLabel(participant.role)}</span>
                  {!participant.microphoneEnabled && <MicOff className="h-3 w-3 shrink-0 text-slate-500" />}
                </div>
              ))}
            </div>

            {providerState.canPublish && (
              <div className="mt-3 flex items-center gap-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={pushToTalk}
                    onChange={(event) => {
                      setPushToTalk(event.target.checked)
                      if (event.target.checked) void provider.setMicrophoneEnabled(false)
                    }}
                  />
                  按住说话
                </label>
                {pushToTalk && (
                  <button
                    type="button"
                    onPointerDown={() => setPushToTalkActive(true)}
                    onPointerUp={() => setPushToTalkActive(false)}
                    onPointerCancel={() => setPushToTalkActive(false)}
                    onPointerLeave={() => setPushToTalkActive(false)}
                    className="ml-auto rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 active:bg-cyan-500/30"
                  >
                    按住发言
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3">
              <button
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200"
              >
                <Settings2 className="h-3.5 w-3.5" /> 音频设备
              </button>
              <button
                type="button"
                onClick={() => void disconnect()}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
              >
                <PhoneOff className="h-3.5 w-3.5" /> 离开语音
              </button>
            </div>

            {settingsOpen && (
              <div className="mt-3 grid gap-2 rounded-xl border border-white/8 bg-black/20 p-3 sm:grid-cols-2">
                <label className="text-[11px] text-slate-400">
                  麦克风
                  <select
                    value={providerState.activeInputDeviceId ?? ''}
                    onChange={(event) => void provider.setInputDevice(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="">系统默认</option>
                    {providerState.inputDevices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>{device.label || `麦克风 ${index + 1}`}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-slate-400">
                  输出设备
                  <select
                    value={providerState.activeOutputDeviceId ?? ''}
                    onChange={(event) => void provider.setOutputDevice(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="">系统默认</option>
                    {providerState.outputDevices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>{device.label || `扬声器 ${index + 1}`}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {providerState.error && <p className="mt-2 text-[11px] text-rose-300">{providerState.error}</p>}
            {providerState.deafened && (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-200"><Volume2 className="h-3 w-3" /> 当前已停止播放其他成员语音。</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
