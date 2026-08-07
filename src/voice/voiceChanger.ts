export type VoiceBaseProfileId = 'original' | 'masculine' | 'feminine'

export type VoiceEffectPresetId =
  | 'natural'
  | 'deep-lord'
  | 'aged-sage'
  | 'sharp-witch'
  | 'child-fey'
  | 'goblin'
  | 'orc'
  | 'giant'
  | 'demon'
  | 'ghost'
  | 'construct'
  | 'dragon'

export interface VoiceChangerSelection {
  baseProfileId: VoiceBaseProfileId
  effectPresetId: VoiceEffectPresetId
}

export interface VoiceBaseProfileDefinition {
  id: VoiceBaseProfileId
  label: string
  description: string
  pitchSemitones: number
  lowShelfDb: number
  highShelfDb: number
}

export interface VoiceEffectPresetDefinition {
  id: VoiceEffectPresetId
  label: string
  description: string
  pitchSemitones: number
  highpassHz: number
  lowpassHz: number
  lowShelfDb: number
  highShelfDb: number
  drive: number
  tremoloDepth: number
  tremoloRateHz: number
  echoMs: number
  echoFeedback: number
  reverbMix: number
  outputGain: number
}

export interface VoiceNpcQuickSlot {
  shortcut: number
  npcTokenId: string
  npcName: string
  mapId?: string
  selection: VoiceChangerSelection
}

export interface VoiceChangerConfigV1 {
  schemaVersion: 1
  selection: VoiceChangerSelection
  activeShortcut?: number
  slots: VoiceNpcQuickSlot[]
}

export const VOICE_BASE_PROFILES: readonly VoiceBaseProfileDefinition[] = [
  {
    id: 'original',
    label: '原声',
    description: '保留 DM 原本的基础声线。',
    pitchSemitones: 0,
    lowShelfDb: 0,
    highShelfDb: 0,
  },
  {
    id: 'masculine',
    label: '自然男声',
    description: '降低音高并加强低频，可供女性或高音 DM 塑造男声。',
    pitchSemitones: -2.5,
    lowShelfDb: 2.5,
    highShelfDb: -1.5,
  },
  {
    id: 'feminine',
    label: '自然女声',
    description: '提高音高并调整共鸣明亮度，可供男性或低音 DM 塑造女声。',
    pitchSemitones: 3.5,
    lowShelfDb: -3,
    highShelfDb: 3.5,
  },
] as const

export const VOICE_EFFECT_PRESETS: readonly VoiceEffectPresetDefinition[] = [
  { id: 'natural', label: '自然', description: '只使用基础声线，不叠加角色效果。', pitchSemitones: 0, highpassHz: 55, lowpassHz: 16_000, lowShelfDb: 0, highShelfDb: 0, drive: 0, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 0, echoFeedback: 0, reverbMix: 0, outputGain: 1 },
  { id: 'deep-lord', label: '深沉领主', description: '沉稳、厚重，适合贵族、统帅与反派首领。', pitchSemitones: -2, highpassHz: 55, lowpassHz: 10_000, lowShelfDb: 4, highShelfDb: -1, drive: 0.04, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 75, echoFeedback: 0.08, reverbMix: 0.12, outputGain: 0.93 },
  { id: 'aged-sage', label: '年迈智者', description: '略显沙哑与迟暮，适合长者、学者和隐士。', pitchSemitones: -0.8, highpassHz: 105, lowpassHz: 8_500, lowShelfDb: -1, highShelfDb: -2, drive: 0.08, tremoloDepth: 0.025, tremoloRateHz: 5.2, echoMs: 0, echoFeedback: 0, reverbMix: 0.05, outputGain: 0.94 },
  { id: 'sharp-witch', label: '尖锐巫婆', description: '尖锐而干涩，适合女巫、鬼婆与刻薄角色。', pitchSemitones: 2.8, highpassHz: 150, lowpassHz: 11_000, lowShelfDb: -3, highShelfDb: 4, drive: 0.13, tremoloDepth: 0.015, tremoloRateHz: 7, echoMs: 0, echoFeedback: 0, reverbMix: 0.08, outputGain: 0.86 },
  { id: 'child-fey', label: '幼童／精灵', description: '轻盈明亮，适合幼童、小妖精与轻灵生物。', pitchSemitones: 4.5, highpassHz: 120, lowpassHz: 15_000, lowShelfDb: -3, highShelfDb: 3, drive: 0, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 0, echoFeedback: 0, reverbMix: 0.06, outputGain: 0.9 },
  { id: 'goblin', label: '哥布林', description: '高亢、粗糙而躁动。', pitchSemitones: 5.2, highpassHz: 170, lowpassHz: 8_000, lowShelfDb: -3, highShelfDb: 2, drive: 0.2, tremoloDepth: 0.02, tremoloRateHz: 9, echoMs: 0, echoFeedback: 0, reverbMix: 0, outputGain: 0.78 },
  { id: 'orc', label: '兽人', description: '低沉、粗粝，带有明显胸腔感。', pitchSemitones: -4, highpassHz: 50, lowpassHz: 7_000, lowShelfDb: 6, highShelfDb: -2, drive: 0.16, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 0, echoFeedback: 0, reverbMix: 0.04, outputGain: 0.8 },
  { id: 'giant', label: '巨人', description: '极低音与宽阔空间感，适合巨人和泰坦。', pitchSemitones: -6, highpassHz: 45, lowpassHz: 5_000, lowShelfDb: 7, highShelfDb: -3, drive: 0.08, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 95, echoFeedback: 0.12, reverbMix: 0.2, outputGain: 0.82 },
  { id: 'demon', label: '恶魔', description: '低沉失真并带短促回声，适合邪魔与异界存在。', pitchSemitones: -4.5, highpassHz: 55, lowpassHz: 7_500, lowShelfDb: 5, highShelfDb: 1, drive: 0.38, tremoloDepth: 0.035, tremoloRateHz: 13, echoMs: 105, echoFeedback: 0.2, reverbMix: 0.24, outputGain: 0.65 },
  { id: 'ghost', label: '幽灵', description: '空灵、漂浮并带长回声，适合亡灵与幻影。', pitchSemitones: 1, highpassHz: 190, lowpassHz: 10_000, lowShelfDb: -4, highShelfDb: 2, drive: 0.02, tremoloDepth: 0.08, tremoloRateHz: 4, echoMs: 190, echoFeedback: 0.3, reverbMix: 0.48, outputGain: 0.72 },
  { id: 'construct', label: '构装体', description: '金属、机械且带规则振幅，适合魔像与机械生命。', pitchSemitones: -0.5, highpassHz: 210, lowpassHz: 3_600, lowShelfDb: 1, highShelfDb: 1, drive: 0.3, tremoloDepth: 0.22, tremoloRateHz: 18, echoMs: 55, echoFeedback: 0.1, reverbMix: 0.08, outputGain: 0.7 },
  { id: 'dragon', label: '龙族', description: '深厚、威严并带洞窟般回响。', pitchSemitones: -5, highpassHz: 45, lowpassHz: 8_000, lowShelfDb: 8, highShelfDb: -1, drive: 0.14, tremoloDepth: 0.015, tremoloRateHz: 3, echoMs: 125, echoFeedback: 0.16, reverbMix: 0.36, outputGain: 0.75 },
] as const

const BASE_PROFILE_IDS = new Set(VOICE_BASE_PROFILES.map((entry) => entry.id))
const EFFECT_PRESET_IDS = new Set(VOICE_EFFECT_PRESETS.map((entry) => entry.id))

export const DEFAULT_VOICE_CHANGER_SELECTION: VoiceChangerSelection = {
  baseProfileId: 'original',
  effectPresetId: 'natural',
}

export const DEFAULT_VOICE_CHANGER_CONFIG: VoiceChangerConfigV1 = {
  schemaVersion: 1,
  selection: DEFAULT_VOICE_CHANGER_SELECTION,
  slots: [],
}

export function isVoiceChangerBypassed(selection: VoiceChangerSelection): boolean {
  return selection.baseProfileId === 'original' && selection.effectPresetId === 'natural'
}

export function normalizeVoiceChangerSelection(value: unknown): VoiceChangerSelection {
  const candidate = value && typeof value === 'object' ? value as Partial<VoiceChangerSelection> : {}
  return {
    baseProfileId: BASE_PROFILE_IDS.has(candidate.baseProfileId as VoiceBaseProfileId)
      ? candidate.baseProfileId as VoiceBaseProfileId
      : DEFAULT_VOICE_CHANGER_SELECTION.baseProfileId,
    effectPresetId: EFFECT_PRESET_IDS.has(candidate.effectPresetId as VoiceEffectPresetId)
      ? candidate.effectPresetId as VoiceEffectPresetId
      : DEFAULT_VOICE_CHANGER_SELECTION.effectPresetId,
  }
}

export function normalizeVoiceChangerConfig(value: unknown): VoiceChangerConfigV1 {
  const candidate = value && typeof value === 'object' ? value as Partial<VoiceChangerConfigV1> : {}
  const slots = Array.isArray(candidate.slots)
    ? candidate.slots.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const slot = entry as Partial<VoiceNpcQuickSlot>
      const shortcut = Math.trunc(Number(slot.shortcut))
      if (shortcut < 1 || shortcut > 9 || typeof slot.npcTokenId !== 'string' || !slot.npcTokenId.trim()) return []
      return [{
        shortcut,
        npcTokenId: slot.npcTokenId.trim(),
        npcName: typeof slot.npcName === 'string' && slot.npcName.trim() ? slot.npcName.trim().slice(0, 80) : '未命名 NPC',
        ...(typeof slot.mapId === 'string' && slot.mapId.trim() ? { mapId: slot.mapId.trim() } : {}),
        selection: normalizeVoiceChangerSelection(slot.selection),
      }]
    })
      .sort((left, right) => left.shortcut - right.shortcut)
      .filter((slot, index, all) => index === all.findIndex((candidateSlot) => candidateSlot.shortcut === slot.shortcut))
    : []
  const activeShortcut = Math.trunc(Number(candidate.activeShortcut))
  return {
    schemaVersion: 1,
    selection: normalizeVoiceChangerSelection(candidate.selection),
    ...(activeShortcut >= 1 && activeShortcut <= 9 && slots.some((slot) => slot.shortcut === activeShortcut)
      ? { activeShortcut }
      : {}),
    slots,
  }
}

export function voiceChangerStorageKey(roomId: string, memberId: string): string {
  return `astraltrace-voice-changer:v1:${roomId}:${memberId}`
}

export function loadVoiceChangerConfig(storage: Pick<Storage, 'getItem'> | undefined, key: string): VoiceChangerConfigV1 {
  if (!storage) return DEFAULT_VOICE_CHANGER_CONFIG
  try {
    const raw = storage.getItem(key)
    return raw ? normalizeVoiceChangerConfig(JSON.parse(raw)) : DEFAULT_VOICE_CHANGER_CONFIG
  } catch {
    return DEFAULT_VOICE_CHANGER_CONFIG
  }
}

export function saveVoiceChangerConfig(storage: Pick<Storage, 'setItem'> | undefined, key: string, value: VoiceChangerConfigV1): void {
  if (!storage) return
  storage.setItem(key, JSON.stringify(normalizeVoiceChangerConfig(value)))
}

export function voiceShortcutFromKeyboardEvent(event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'repeat' | 'code' | 'target'>): number | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return null
  const target = event.target as (EventTarget & {
    isContentEditable?: boolean
    closest?: (selector: string) => Element | null
  }) | null
  if (target && (
    target.isContentEditable === true
    || target.closest?.('input, textarea, select, button, [contenteditable="true"], [role="textbox"]')
  )) return null
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code)
  return match ? Number(match[1]) : null
}

export function voiceChangerParameters(selection: VoiceChangerSelection) {
  const base = VOICE_BASE_PROFILES.find((entry) => entry.id === selection.baseProfileId) ?? VOICE_BASE_PROFILES[0]
  const effect = VOICE_EFFECT_PRESETS.find((entry) => entry.id === selection.effectPresetId) ?? VOICE_EFFECT_PRESETS[0]
  return {
    pitchRatio: 2 ** (Math.max(-10, Math.min(10, base.pitchSemitones + effect.pitchSemitones)) / 12),
    highpassHz: effect.highpassHz,
    lowpassHz: effect.lowpassHz,
    lowShelfDb: base.lowShelfDb + effect.lowShelfDb,
    highShelfDb: base.highShelfDb + effect.highShelfDb,
    drive: effect.drive,
    tremoloDepth: effect.tremoloDepth,
    tremoloRateHz: effect.tremoloRateHz,
    echoSeconds: effect.echoMs / 1_000,
    echoFeedback: effect.echoFeedback,
    reverbMix: effect.reverbMix,
    outputGain: effect.outputGain,
  }
}
