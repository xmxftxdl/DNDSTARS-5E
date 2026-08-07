import { Radio, UserRoundCog, Volume2, X } from 'lucide-react'
import { useMemo } from 'react'
import { useMapStore } from '../store/maps'
import {
  VOICE_BASE_PROFILES,
  VOICE_EFFECT_PRESETS,
  type VoiceBaseProfileId,
  type VoiceEffectPresetId,
  type VoiceNpcQuickSlot,
} from '../voice/voiceChanger'
import { useVoiceRoom } from '../voice/useVoiceRoom'

interface NpcVoiceOption {
  value: string
  mapId: string
  mapName: string
  tokenId: string
  tokenName: string
}

function encodedNpcValue(mapId: string, tokenId: string): string {
  return JSON.stringify([mapId, tokenId])
}

export default function NpcVoiceChangerPanel() {
  const voice = useVoiceRoom()
  const maps = useMapStore((state) => state.maps)
  const npcOptions = useMemo<NpcVoiceOption[]>(() => maps.flatMap((map) => map.tokens
    .filter((token) => token.type === 'npc' || token.type === 'enemy')
    .map((token) => ({
      value: encodedNpcValue(map.id, token.id),
      mapId: map.id,
      mapName: map.name,
      tokenId: token.id,
      tokenName: token.label?.trim() || '未命名 NPC',
    })))
    .sort((left, right) => left.mapName.localeCompare(right.mapName, 'zh-CN') || left.tokenName.localeCompare(right.tokenName, 'zh-CN')), [maps])

  if (voice.session?.role !== 'dm') return null

  const config = voice.voiceChangerConfig
  const activeSlot = config.activeShortcut
    ? config.slots.find((slot) => slot.shortcut === config.activeShortcut)
    : undefined

  const updateSlot = (shortcut: number, patch: Partial<VoiceNpcQuickSlot>) => {
    const current = config.slots.find((slot) => slot.shortcut === shortcut)
    if (!current && (!patch.npcTokenId || !patch.npcName)) return
    voice.setVoiceNpcQuickSlot({
      shortcut,
      npcTokenId: patch.npcTokenId ?? current?.npcTokenId ?? '',
      npcName: patch.npcName ?? current?.npcName ?? '未命名 NPC',
      ...(patch.mapId ?? current?.mapId ? { mapId: patch.mapId ?? current?.mapId } : {}),
      selection: patch.selection ?? current?.selection ?? config.selection,
    })
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-violet-300/15 bg-violet-950/10">
      <div className="flex flex-wrap items-start gap-3 border-b border-white/8 px-4 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
          <UserRoundCog className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-100">DM NPC 变声台</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            先选择男声、女声或原声，再叠加角色效果。数字 1–9 切换完整 NPC 声线；在输入框内不会触发快捷键。
          </p>
        </div>
        <div className="rounded-xl border border-violet-300/15 bg-black/20 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">当前身份</p>
          <p className="mt-0.5 text-xs font-bold text-violet-200">{activeSlot ? `${activeSlot.shortcut} · ${activeSlot.npcName}` : '未绑定 NPC'}</p>
        </div>
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-300">基础声线</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {VOICE_BASE_PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  title={profile.description}
                  onClick={() => voice.setVoiceChangerSelection({ ...config.selection, baseProfileId: profile.id })}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${config.selection.baseProfileId === profile.id ? 'border-violet-300/50 bg-violet-500/20 text-violet-100' : 'border-white/8 bg-black/15 text-slate-400 hover:border-white/15 hover:text-slate-200'}`}
                >
                  {profile.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-bold text-slate-300">
            角色效果
            <select
              value={config.selection.effectPresetId}
              onChange={(event) => voice.setVoiceChangerSelection({
                ...config.selection,
                effectPresetId: event.target.value as VoiceEffectPresetId,
              })}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-200"
            >
              {VOICE_EFFECT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>

          <div className="rounded-xl border border-white/8 bg-black/15 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Volume2 className="h-3.5 w-3.5 text-violet-300" />
              {VOICE_BASE_PROFILES.find((entry) => entry.id === config.selection.baseProfileId)?.label}
              <span className="text-slate-600">＋</span>
              {VOICE_EFFECT_PRESETS.find((entry) => entry.id === config.selection.effectPresetId)?.label}
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
              {VOICE_EFFECT_PRESETS.find((entry) => entry.id === config.selection.effectPresetId)?.description}
            </p>
            {!voice.state.voiceChangerSupported && (
              <p className="mt-2 text-[11px] text-amber-300">当前浏览器不支持实时音频处理，将继续发送原始麦克风声音。</p>
            )}
            {!voice.state.microphoneEnabled && (
              <p className="mt-2 text-[11px] text-cyan-300">配置已保存；打开麦克风后自动应用。</p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-slate-300">NPC 快捷槽</p>
            <span className="text-[11px] text-slate-500">点击槽位或按数字键切换</span>
          </div>
          <div className="mt-2 grid gap-2">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((shortcut) => {
              const slot = config.slots.find((candidate) => candidate.shortcut === shortcut)
              const slotValue = slot ? encodedNpcValue(slot.mapId ?? '', slot.npcTokenId) : ''
              return (
                <div
                  key={shortcut}
                  className={`grid items-center gap-2 rounded-xl border p-2 sm:grid-cols-[36px_minmax(140px,1fr)_110px_130px_34px] ${config.activeShortcut === shortcut ? 'border-violet-300/45 bg-violet-500/10' : 'border-white/8 bg-black/10'}`}
                >
                  <button
                    type="button"
                    disabled={!slot}
                    onClick={() => voice.activateVoiceNpcQuickSlot(shortcut)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${config.activeShortcut === shortcut ? 'bg-violet-400 text-violet-950' : 'bg-white/5 text-slate-400 disabled:opacity-35'}`}
                    title={slot ? `切换为 ${slot.npcName}` : `快捷键 ${shortcut} 尚未绑定`}
                  >
                    {shortcut}
                  </button>
                  <select
                    aria-label={`快捷键 ${shortcut} 的 NPC`}
                    value={slotValue}
                    onChange={(event) => {
                      if (!event.target.value) {
                        voice.setVoiceNpcQuickSlot({ shortcut, clear: true })
                        return
                      }
                      const option = npcOptions.find((candidate) => candidate.value === event.target.value)
                      if (!option) return
                      updateSlot(shortcut, {
                        npcTokenId: option.tokenId,
                        npcName: option.tokenName,
                        mapId: option.mapId,
                        selection: slot?.selection ?? config.selection,
                      })
                    }}
                    className="min-w-0 rounded-lg border border-white/8 bg-slate-950 px-2 py-2 text-xs text-slate-200"
                  >
                    <option value="">选择 NPC／怪物…</option>
                    {npcOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.tokenName} · {option.mapName}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`快捷键 ${shortcut} 的基础声线`}
                    value={slot?.selection.baseProfileId ?? config.selection.baseProfileId}
                    disabled={!slot}
                    onChange={(event) => updateSlot(shortcut, {
                      selection: {
                        ...(slot?.selection ?? config.selection),
                        baseProfileId: event.target.value as VoiceBaseProfileId,
                      },
                    })}
                    className="rounded-lg border border-white/8 bg-slate-950 px-2 py-2 text-xs text-slate-200 disabled:opacity-35"
                  >
                    {VOICE_BASE_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                  </select>
                  <select
                    aria-label={`快捷键 ${shortcut} 的角色效果`}
                    value={slot?.selection.effectPresetId ?? config.selection.effectPresetId}
                    disabled={!slot}
                    onChange={(event) => updateSlot(shortcut, {
                      selection: {
                        ...(slot?.selection ?? config.selection),
                        effectPresetId: event.target.value as VoiceEffectPresetId,
                      },
                    })}
                    className="rounded-lg border border-white/8 bg-slate-950 px-2 py-2 text-xs text-slate-200 disabled:opacity-35"
                  >
                    {VOICE_EFFECT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                  </select>
                  <button
                    type="button"
                    aria-label={`清除快捷键 ${shortcut}`}
                    disabled={!slot}
                    onClick={() => voice.setVoiceNpcQuickSlot({ shortcut, clear: true })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-25"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/8 px-4 py-3 text-[11px] text-slate-500">
        <Radio className="h-3.5 w-3.5 text-emerald-400" />
        变声只处理 DM 本地发布的麦克风轨道；玩家不会获得 DM 的快捷槽或配置。
      </div>
    </section>
  )
}
