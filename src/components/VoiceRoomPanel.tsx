import { useState } from 'react'
import {
  AudioLines,
  Headphones,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { RoomRole } from '../lib/roomSession'
import { useVoiceRoom } from '../voice/useVoiceRoom'
import NpcVoiceChangerPanel from './NpcVoiceChangerPanel'

function roleLabel(role: RoomRole) {
  if (role === 'dm') return 'DM'
  if (role === 'spectator') return '观战'
  return '玩家'
}

export default function VoiceRoomPanel() {
  const voice = useVoiceRoom()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pushToTalk, setPushToTalk] = useState(false)

  const setPushToTalkActive = (active: boolean) => {
    if (!pushToTalk || !voice.state.canPublish) return
    void voice.setMicrophoneEnabled(active).catch(() => undefined)
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-slate-950/55 shadow-2xl shadow-cyan-950/10">
      <div className="flex flex-wrap items-center gap-4 border-b border-white/8 px-5 py-5">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${voice.connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
          {voice.state.connectionState === 'connecting' || voice.state.connectionState === 'reconnecting'
            ? <LoaderCircle className="h-5 w-5 animate-spin" />
            : <AudioLines className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-100">房间语音</h2>
          <p className="mt-1 text-sm text-slate-400">
            {voice.connected
              ? `${voice.state.participants.length} 人在线 · ${roleLabel(voice.session?.role ?? 'player')}`
              : voice.notice ?? (voice.enabled === null
                ? '正在检测语音服务……'
                : voice.enabled ? '加入后可与当前房间成员通话。' : '当前服务器尚未启用房间语音。')}
          </p>
        </div>

        {!voice.connected ? (
          <button
            type="button"
            onClick={() => void voice.connect()}
            disabled={voice.joining || voice.enabled !== true}
            className="rounded-xl bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {voice.joining ? '连接中……' : '加入语音'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {voice.state.canPublish && (
              <button
                type="button"
                title={voice.state.microphoneEnabled ? '关闭麦克风' : '打开麦克风'}
                onClick={() => void voice.setMicrophoneEnabled(!voice.state.microphoneEnabled).catch(() => undefined)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${voice.state.microphoneEnabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}
              >
                {voice.state.microphoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              title={voice.state.deafened ? '恢复收听' : '停止收听'}
              onClick={() => void voice.setDeafened(!voice.state.deafened)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${voice.state.deafened ? 'bg-amber-500/20 text-amber-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              {voice.state.deafened ? <VolumeX className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => void voice.disconnect()}
              className="flex h-10 items-center gap-2 rounded-xl bg-rose-500/10 px-3 text-sm text-rose-200 hover:bg-rose-500/20"
            >
              <PhoneOff className="h-4 w-4" /> 离开
            </button>
          </div>
        )}
      </div>

      <div className="p-5">
        {voice.connected ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {voice.state.participants.map((participant) => (
                <div
                  key={participant.identity}
                  className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 ${participant.speaking ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-white/8 bg-white/[0.025]'}`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${participant.speaking ? 'animate-pulse bg-emerald-300' : 'bg-slate-600'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-200">{participant.displayName}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{roleLabel(participant.role)}{participant.local ? ' · 你' : ''}</p>
                  </div>
                  {!participant.microphoneEnabled && <MicOff className="h-4 w-4 shrink-0 text-slate-600" />}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/8 pt-4">
              {voice.state.canPublish && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      checked={pushToTalk}
                      onChange={(event) => {
                        setPushToTalk(event.target.checked)
                        if (event.target.checked) void voice.setMicrophoneEnabled(false)
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
                      className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 active:bg-cyan-500/30"
                    >
                      按住发言
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
                className="ml-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"
              >
                <Settings2 className="h-4 w-4" /> 音频设备
              </button>
            </div>

            {settingsOpen && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-white/8 bg-black/20 p-4 sm:grid-cols-2">
                <label className="text-xs text-slate-400">
                  麦克风
                  <select
                    value={voice.state.activeInputDeviceId ?? ''}
                    onChange={(event) => void voice.setInputDevice(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-200"
                  >
                    <option value="">系统默认</option>
                    {voice.state.inputDevices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>{device.label || `麦克风 ${index + 1}`}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  输出设备
                  <select
                    value={voice.state.activeOutputDeviceId ?? ''}
                    onChange={(event) => void voice.setOutputDevice(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-200"
                  >
                    <option value="">系统默认</option>
                    {voice.state.outputDevices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>{device.label || `扬声器 ${index + 1}`}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/8 bg-black/10 px-6 text-center">
            <AudioLines className="h-10 w-10 text-slate-700" />
            <p className="mt-4 text-sm font-semibold text-slate-300">尚未加入房间语音</p>
            <p className="mt-2 max-w-lg text-xs leading-6 text-slate-500">语音连接独立于战斗与地图同步；离开这个页面不会断开语音。</p>
          </div>
        )}

        {voice.state.error && <p className="mt-3 text-sm text-rose-300">{voice.state.error}</p>}
        {voice.state.deafened && (
          <p className="mt-3 flex items-center gap-2 text-sm text-amber-200"><Volume2 className="h-4 w-4" /> 当前已停止播放其他成员语音。</p>
        )}
        <NpcVoiceChangerPanel />
      </div>
    </section>
  )
}
