import { Radio, Sparkles, UserRoundCog, Volume2, X } from 'lucide-react'
import { useMemo } from 'react'
import { useMapStore } from '../store/maps'
import {
  VOICE_BASE_PROFILES,
  VOICE_EFFECT_PRESETS,
  VOICE_PERSONA_PRESETS,
  type VoiceBaseProfileId,
  type VoiceEffectPresetId,
  type VoiceNpcQuickSlot,
  type VoicePersonaPresetId,
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
    const npcName = (patch.npcName ?? current?.npcName ?? '').slice(0, 80)
    if (!npcName.trim()) {
      voice.setVoiceNpcQuickSlot({ shortcut, clear: true })
      return
    }
    const npcTokenId = patch.npcTokenId ?? current?.npcTokenId
    const mapId = patch.mapId ?? current?.mapId
    voice.setVoiceNpcQuickSlot({
      shortcut,
      npcName,
      ...(npcTokenId ? { npcTokenId } : {}),
      ...(npcTokenId && mapId ? { mapId } : {}),
      ...(patch.personaPresetId ?? current?.personaPresetId
        ? { personaPresetId: patch.personaPresetId ?? current?.personaPresetId }
        : {}),
      ...(patch.performanceCue ?? current?.performanceCue
        ? { performanceCue: patch.performanceCue ?? current?.performanceCue }
        : {}),
      selection: patch.selection ?? current?.selection ?? config.selection,
    })
  }

  const applyPersonaPreset = (shortcut: number, presetId: VoicePersonaPresetId) => {
    const current = config.slots.find((slot) => slot.shortcut === shortcut)
    if (presetId === 'custom') {
      updateSlot(shortcut, {
        npcName: current?.npcName || `角色 ${shortcut}`,
        personaPresetId: 'custom',
      })
      return
    }
    const preset = VOICE_PERSONA_PRESETS.find((entry) => entry.id === presetId)
    if (!preset) return
    updateSlot(shortcut, {
      npcName: current?.npcName || `角色 ${shortcut}`,
      personaPresetId: preset.id,
      performanceCue: preset.performanceCue,
      selection: preset.selection,
    })
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-violet-300/15 bg-violet-950/10">
      <div className="flex flex-wrap items-start gap-3 border-b border-white/8 px-4 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
          <UserRoundCog className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-100">DM 角色变声台</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            为本场常用 NPC 预设身份声线。数字 1–9 切换完整角色声线；再次按下当前数字键恢复原声。
          </p>
        </div>
        <div className="rounded-xl border border-violet-300/15 bg-black/20 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">当前身份</p>
          <p className="mt-0.5 text-xs font-bold text-violet-200">{activeSlot ? `${activeSlot.shortcut} · ${activeSlot.npcName}` : '原声'}</p>
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
            <p className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              本场 NPC 声线预设
            </p>
            <span className="text-[11px] text-slate-500">优先按身份与说话习惯区分，不必按种族套音色</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            一键模板只做细微音色变化；语速、停顿和口头习惯会保存为 DM 表演提示。所有快捷槽跟随当前战役保存。
          </p>
          <div className="mt-2 grid gap-2">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((shortcut) => {
              const slot = config.slots.find((candidate) => candidate.shortcut === shortcut)
              const slotValue = slot?.npcTokenId ? encodedNpcValue(slot.mapId ?? '', slot.npcTokenId) : ''
              return (
                <div
                  key={shortcut}
                  className={`grid items-center gap-2 rounded-xl border p-2 sm:grid-cols-[36px_minmax(110px,0.8fr)_minmax(140px,1fr)_140px_34px] ${config.activeShortcut === shortcut ? 'border-violet-300/45 bg-violet-500/10' : 'border-white/8 bg-black/10'}`}
                >
                  <button
                    type="button"
                    disabled={!slot}
                    onClick={() => voice.activateVoiceNpcQuickSlot(shortcut)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${config.activeShortcut === shortcut ? 'bg-violet-400 text-violet-950' : 'bg-white/5 text-slate-400 disabled:opacity-35'}`}
                    title={slot ? (config.activeShortcut === shortcut ? '恢复原声' : `切换为 ${slot.npcName}`) : `快捷键 ${shortcut} 尚未配置`}
                  >
                    {shortcut}
                  </button>
                  <input
                    aria-label={`快捷键 ${shortcut} 的角色名称`}
                    value={slot?.npcName ?? ''}
                    maxLength={80}
                    placeholder="自定义角色名"
                    onChange={(event) => updateSlot(shortcut, { npcName: event.target.value })}
                    className="min-w-0 rounded-lg border border-white/8 bg-slate-950 px-2 py-2 text-xs text-slate-200 placeholder:text-slate-600"
                  />
                  <select
                    aria-label={`快捷键 ${shortcut} 关联的地图角色`}
                    value={slotValue}
                    onChange={(event) => {
                      if (!event.target.value) {
                        if (slot) voice.setVoiceNpcQuickSlot({
                          shortcut,
                          npcName: slot.npcName,
                          selection: slot.selection,
                          ...(slot.personaPresetId ? { personaPresetId: slot.personaPresetId } : {}),
                          ...(slot.performanceCue ? { performanceCue: slot.performanceCue } : {}),
                        })
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
                    <option value="">不关联地图角色</option>
                    {npcOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.tokenName} · {option.mapName}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`快捷键 ${shortcut} 的人物模板`}
                    value={slot?.personaPresetId ?? 'custom'}
                    onChange={(event) => applyPersonaPreset(shortcut, event.target.value as VoicePersonaPresetId)}
                    className="rounded-lg border border-violet-300/15 bg-slate-950 px-2 py-2 text-xs text-violet-100"
                  >
                    <option value="custom">自定义声线</option>
                    {VOICE_PERSONA_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
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
                  {slot && (
                    <div className="grid gap-2 sm:col-start-2 sm:col-span-4 sm:grid-cols-[minmax(220px,1fr)_110px_130px]">
                      <input
                        aria-label={`快捷键 ${shortcut} 的表演提示`}
                        value={slot.performanceCue ?? ''}
                        maxLength={240}
                        placeholder="表演提示：语速、停顿、口头习惯……"
                        onChange={(event) => updateSlot(shortcut, {
                          personaPresetId: 'custom',
                          performanceCue: event.target.value,
                        })}
                        className="min-w-0 rounded-lg border border-white/8 bg-black/20 px-2 py-2 text-[11px] text-slate-300 placeholder:text-slate-600"
                      />
                      <select
                        aria-label={`快捷键 ${shortcut} 的基础声线`}
                        value={slot.selection.baseProfileId}
                        onChange={(event) => updateSlot(shortcut, {
                          personaPresetId: 'custom',
                          selection: {
                            ...slot.selection,
                            baseProfileId: event.target.value as VoiceBaseProfileId,
                          },
                        })}
                        className="rounded-lg border border-white/8 bg-slate-950 px-2 py-2 text-xs text-slate-200"
                      >
                        {VOICE_BASE_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                      </select>
                      <select
                        aria-label={`快捷键 ${shortcut} 的角色效果`}
                        value={slot.selection.effectPresetId}
                        onChange={(event) => updateSlot(shortcut, {
                          personaPresetId: 'custom',
                          selection: {
                            ...slot.selection,
                            effectPresetId: event.target.value as VoiceEffectPresetId,
                          },
                        })}
                        className="rounded-lg border border-white/8 bg-slate-950 px-2 py-2 text-xs text-slate-200"
                      >
                        {VOICE_EFFECT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                      </select>
                    </div>
                  )}
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
