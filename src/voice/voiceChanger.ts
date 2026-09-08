export type VoiceBaseProfileId = 'original' | 'masculine' | 'feminine'

export type VoiceEffectPresetId =
  | 'natural'
  | 'warm-natural'
  | 'crisp-natural'
  | 'reserved-natural'
  | 'hushed-natural'
  | 'weary-natural'
  | 'airy-natural'
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

export type VoicePersonaPresetId =
  | 'custom'
  | 'warm-elder'
  | 'reserved-noble'
  | 'brisk-clerk'
  | 'hushed-agent'
  | 'weary-guard'
  | 'bright-elf'
  | 'distant-scholar'
  | 'genial-merchant'

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

export interface VoicePersonaPresetDefinition {
  id: Exclude<VoicePersonaPresetId, 'custom'>
  label: string
  description: string
  selection: VoiceChangerSelection
  performanceCue: string
}

export interface VoiceNpcQuickSlot {
  shortcut: number
  npcTokenId?: string
  npcName: string
  mapId?: string
  personaPresetId?: VoicePersonaPresetId
  performanceCue?: string
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
  { id: 'warm-natural', label: '温暖自然', description: '轻微增加低频与亲和感，仍然保持自然人声。', pitchSemitones: -0.35, highpassHz: 55, lowpassHz: 15_000, lowShelfDb: 1.6, highShelfDb: -0.6, drive: 0.01, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 0, echoFeedback: 0, reverbMix: 0.015, outputGain: 0.98 },
  { id: 'crisp-natural', label: '清晰利落', description: '略微提高明亮度和咬字存在感，适合办事员与军官。', pitchSemitones: 0.45, highpassHz: 75, lowpassHz: 16_000, lowShelfDb: -0.5, highShelfDb: 1.5, drive: 0, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 0, echoFeedback: 0, reverbMix: 0, outputGain: 0.97 },
  { id: 'reserved-natural', label: '克制端正', description: '略收窄频段并压低高频，适合贵族、法官与外交官。', pitchSemitones: -0.55, highpassHz: 65, lowpassHz: 12_500, lowShelfDb: 1.2, highShelfDb: -1.1, drive: 0.012, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 0, echoFeedback: 0, reverbMix: 0.025, outputGain: 0.96 },
  { id: 'hushed-natural', label: '低声隐秘', description: '柔化高频与气口，适合密探、神官耳语和谨慎角色。', pitchSemitones: -0.7, highpassHz: 70, lowpassHz: 9_500, lowShelfDb: 0.8, highShelfDb: -2.2, drive: 0, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 0, echoFeedback: 0, reverbMix: 0.025, outputGain: 0.9 },
  { id: 'weary-natural', label: '疲惫沙哑', description: '略低沉、略暗，但不会变成明显的怪物声线。', pitchSemitones: -1.05, highpassHz: 85, lowpassHz: 8_800, lowShelfDb: 0.5, highShelfDb: -2.1, drive: 0.045, tremoloDepth: 0.008, tremoloRateHz: 4.5, echoMs: 0, echoFeedback: 0, reverbMix: 0.015, outputGain: 0.92 },
  { id: 'airy-natural', label: '轻盈通透', description: '轻微提高音高和空气感，适合精灵、年轻学者与诗人。', pitchSemitones: 1.05, highpassHz: 90, lowpassHz: 16_000, lowShelfDb: -1.2, highShelfDb: 1.6, drive: 0, tremoloDepth: 0, tremoloRateHz: 0, echoMs: 0, echoFeedback: 0, reverbMix: 0.035, outputGain: 0.94 },
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

export const VOICE_PERSONA_PRESETS: readonly VoicePersonaPresetDefinition[] = [
  {
    id: 'warm-elder',
    label: '温和长者',
    description: '可靠、包容，适合村长、老店主和家族长辈。',
    selection: { baseProfileId: 'masculine', effectPresetId: 'warm-natural' },
    performanceCue: '语速偏慢 · 音量适中 · 句尾放缓 · 先称呼对方再回答',
  },
  {
    id: 'reserved-noble',
    label: '冷静贵族',
    description: '克制而有距离，适合贵族、官员与外交使节。',
    selection: { baseProfileId: 'masculine', effectPresetId: 'reserved-natural' },
    performanceCue: '语速从容 · 少用语气词 · 停顿后下结论 · 很少提高音量',
  },
  {
    id: 'brisk-clerk',
    label: '急促书记官',
    description: '清晰、忙碌、信息密集，适合书记员、向导和管家。',
    selection: { baseProfileId: 'original', effectPresetId: 'crisp-natural' },
    performanceCue: '语速偏快 · 咬字清楚 · 连续列举 · 常用“首先、其次”',
  },
  {
    id: 'hushed-agent',
    label: '低声密探',
    description: '谨慎、简短、近似耳语，适合间谍、盗贼和线人。',
    selection: { baseProfileId: 'original', effectPresetId: 'hushed-natural' },
    performanceCue: '音量偏低 · 句子短 · 先观察再开口 · 重要词前停顿',
  },
  {
    id: 'weary-guard',
    label: '疲惫卫兵',
    description: '略显沙哑和不耐烦，适合守卫、老兵与佣兵。',
    selection: { baseProfileId: 'masculine', effectPresetId: 'weary-natural' },
    performanceCue: '语速平缓 · 叹气较多 · 回答简短 · 被催促时才提高音量',
  },
  {
    id: 'bright-elf',
    label: '明亮精灵',
    description: '轻盈但不过度尖锐，适合精灵、诗人与年轻法师。',
    selection: { baseProfileId: 'feminine', effectPresetId: 'airy-natural' },
    performanceCue: '语速轻快 · 句间留白 · 描述多用自然意象 · 很少打断别人',
  },
  {
    id: 'distant-scholar',
    label: '疏离学者',
    description: '理性、精确、缺少情绪起伏，适合法师和研究者。',
    selection: { baseProfileId: 'original', effectPresetId: 'reserved-natural' },
    performanceCue: '语速适中 · 音调平稳 · 先纠正术语 · 用完整句表达',
  },
  {
    id: 'genial-merchant',
    label: '热情商人',
    description: '亲近、活跃、带销售感，适合商人、旅店主和中间人。',
    selection: { baseProfileId: 'original', effectPresetId: 'warm-natural' },
    performanceCue: '语速略快 · 音量明亮 · 常重复客人称呼 · 报价前先铺垫好处',
  },
] as const

const BASE_PROFILE_IDS = new Set(VOICE_BASE_PROFILES.map((entry) => entry.id))
const EFFECT_PRESET_IDS = new Set(VOICE_EFFECT_PRESETS.map((entry) => entry.id))
const PERSONA_PRESET_IDS = new Set<VoicePersonaPresetId>([
  'custom',
  ...VOICE_PERSONA_PRESETS.map((entry) => entry.id),
])

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
      const npcName = typeof slot.npcName === 'string' ? slot.npcName.trim().slice(0, 80) : ''
      if (shortcut < 1 || shortcut > 9 || !npcName) return []
      const npcTokenId = typeof slot.npcTokenId === 'string' ? slot.npcTokenId.trim() : ''
      const personaPresetId = PERSONA_PRESET_IDS.has(slot.personaPresetId as VoicePersonaPresetId)
        ? slot.personaPresetId as VoicePersonaPresetId
        : undefined
      const performanceCue = typeof slot.performanceCue === 'string'
        ? slot.performanceCue.trim().slice(0, 240)
        : ''
      return [{
        shortcut,
        npcName,
        ...(npcTokenId ? { npcTokenId } : {}),
        ...(npcTokenId && typeof slot.mapId === 'string' && slot.mapId.trim() ? { mapId: slot.mapId.trim() } : {}),
        ...(personaPresetId ? { personaPresetId } : {}),
        ...(performanceCue ? { performanceCue } : {}),
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

export function toggleVoiceChangerShortcut(config: VoiceChangerConfigV1, shortcut: number): VoiceChangerConfigV1 {
  const normalized = normalizeVoiceChangerConfig(config)
  const slot = normalized.slots.find((candidate) => candidate.shortcut === shortcut)
  if (!slot) return normalized
  if (normalized.activeShortcut === shortcut) {
    return {
      ...normalized,
      selection: DEFAULT_VOICE_CHANGER_SELECTION,
      activeShortcut: undefined,
    }
  }
  return {
    ...normalized,
    selection: slot.selection,
    activeShortcut: shortcut,
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

export function loadVoiceChangerConfigWithFallback(
  storage: Pick<Storage, 'getItem'> | undefined,
  key: string,
  fallbackKey?: string,
): VoiceChangerConfigV1 {
  if (!storage) return DEFAULT_VOICE_CHANGER_CONFIG
  try {
    const primary = storage.getItem(key)
    if (primary) return normalizeVoiceChangerConfig(JSON.parse(primary))
    if (fallbackKey && fallbackKey !== key) {
      const fallback = storage.getItem(fallbackKey)
      if (fallback) return normalizeVoiceChangerConfig(JSON.parse(fallback))
    }
  } catch {
    return DEFAULT_VOICE_CHANGER_CONFIG
  }
  return DEFAULT_VOICE_CHANGER_CONFIG
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
