export const CAMPAIGN_TIME_RESOURCE = 'campaign-time'
export const CAMPAIGN_TIME_SCHEMA_VERSION = 1
export const CAMPAIGN_TIME_DEFAULT_WORLD_MINUTE = 8 * 60
export const CAMPAIGN_TIME_TIMER_LIMIT = 256
export const CAMPAIGN_TIME_ADVANCE_LIMIT = 512
export const CAMPAIGN_TIME_MAX_ADVANCE_MINUTES = 365 * 24 * 60

export type CampaignTimerKind = 'reminder' | 'concentration'
export type CampaignTimerStatus = 'active' | 'expired' | 'dismissed' | 'cancelled'

export interface CampaignTimer {
  id: string
  kind: CampaignTimerKind
  label: string
  characterId?: string
  characterName?: string
  spellId?: string
  createdAtWorldMinute: number
  expiresAtWorldMinute: number
  status: CampaignTimerStatus
  createdAt: number
  expiredAtWorldMinute?: number
  dismissedAt?: number
  cancelledAt?: number
}

export interface CampaignTimeAdvance {
  id: string
  kind: 'advance' | 'long-rest'
  fromWorldMinute: number
  toWorldMinute: number
  minutes: number
  reason: string
  dawnsCrossed: number
  expiredTimerIds: string[]
  createdAt: number
}

export interface SharedCampaignTimeState {
  schemaVersion: typeof CAMPAIGN_TIME_SCHEMA_VERSION
  worldMinute: number
  timers: CampaignTimer[]
  advances: CampaignTimeAdvance[]
  updatedAt: number
}

export type CampaignTimeMutation =
  | { operation: 'advance'; minutes: number; reason?: string }
  | { operation: 'long-rest'; reason?: string }
  | {
      operation: 'create-timer'
      kind: CampaignTimerKind
      label: string
      durationMinutes: number
      characterId?: string
      characterName?: string
      spellId?: string
    }
  | { operation: 'dismiss-timer'; timerId: string }
  | { operation: 'cancel-timer'; timerId: string }

export type CampaignLightSourceKind = 'permanent' | 'torch' | 'candle' | 'lamp' | 'hooded-lantern' | 'spell' | 'custom'

export interface CampaignTimedLight {
  enabled?: boolean
  sourceKind?: CampaignLightSourceKind
  startedAtWorldMinute?: number
  durationMinutes?: number
  expiresAtWorldMinute?: number
}

export interface CampaignLightPreset {
  id: Exclude<CampaignLightSourceKind, 'spell' | 'custom'>
  label: string
  brightRadiusFeet: number
  dimRadiusFeet: number
  durationMinutes?: number
  color: string
}

export const CAMPAIGN_LIGHT_PRESETS: readonly CampaignLightPreset[] = [
  { id: 'permanent', label: '永久光源', brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fbbf24' },
  { id: 'torch', label: '火把（1 小时）', brightRadiusFeet: 20, dimRadiusFeet: 20, durationMinutes: 60, color: '#f97316' },
  { id: 'candle', label: '蜡烛（1 小时）', brightRadiusFeet: 5, dimRadiusFeet: 5, durationMinutes: 60, color: '#fde68a' },
  { id: 'lamp', label: '油灯（6 小时）', brightRadiusFeet: 15, dimRadiusFeet: 30, durationMinutes: 360, color: '#fbbf24' },
  { id: 'hooded-lantern', label: '附盖提灯（6 小时）', brightRadiusFeet: 30, dimRadiusFeet: 30, durationMinutes: 360, color: '#fbbf24' },
]

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function bounded(value: unknown, length: number): string {
  return typeof value === 'string' ? value.trim().slice(0, length) : ''
}

function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number | undefined {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : undefined
}

function normalizeTimer(value: unknown): CampaignTimer | null {
  if (!object(value)) return null
  const id = bounded(value.id, 160)
  const label = bounded(value.label, 160)
  const kind = value.kind
  const status = value.status
  const createdAtWorldMinute = integer(value.createdAtWorldMinute)
  const expiresAtWorldMinute = integer(value.expiresAtWorldMinute)
  const createdAt = integer(value.createdAt)
  if (
    !id || !label || (kind !== 'reminder' && kind !== 'concentration') ||
    !['active', 'expired', 'dismissed', 'cancelled'].includes(String(status)) ||
    createdAtWorldMinute == null || expiresAtWorldMinute == null || expiresAtWorldMinute <= createdAtWorldMinute ||
    createdAt == null
  ) return null
  return {
    id,
    kind,
    label,
    characterId: bounded(value.characterId, 160) || undefined,
    characterName: bounded(value.characterName, 80) || undefined,
    spellId: bounded(value.spellId, 160) || undefined,
    createdAtWorldMinute,
    expiresAtWorldMinute,
    status: status as CampaignTimerStatus,
    createdAt,
    expiredAtWorldMinute: value.expiredAtWorldMinute == null ? undefined : integer(value.expiredAtWorldMinute),
    dismissedAt: value.dismissedAt == null ? undefined : integer(value.dismissedAt),
    cancelledAt: value.cancelledAt == null ? undefined : integer(value.cancelledAt),
  }
}

function normalizeAdvance(value: unknown): CampaignTimeAdvance | null {
  if (!object(value)) return null
  const id = bounded(value.id, 160)
  const kind = value.kind
  const fromWorldMinute = integer(value.fromWorldMinute)
  const toWorldMinute = integer(value.toWorldMinute)
  const minutes = integer(value.minutes, 1, CAMPAIGN_TIME_MAX_ADVANCE_MINUTES)
  const dawnsCrossed = integer(value.dawnsCrossed, 0, 366)
  const createdAt = integer(value.createdAt)
  if (
    !id || (kind !== 'advance' && kind !== 'long-rest') || fromWorldMinute == null ||
    toWorldMinute == null || minutes == null || toWorldMinute - fromWorldMinute !== minutes ||
    dawnsCrossed == null || createdAt == null
  ) return null
  const expiredTimerIds = Array.isArray(value.expiredTimerIds)
    ? [...new Set(value.expiredTimerIds.map((entry) => bounded(entry, 160)).filter(Boolean))].slice(0, CAMPAIGN_TIME_TIMER_LIMIT)
    : []
  return {
    id,
    kind,
    fromWorldMinute,
    toWorldMinute,
    minutes,
    reason: bounded(value.reason, 160) || (kind === 'long-rest' ? '完成长休' : '推进时间'),
    dawnsCrossed,
    expiredTimerIds,
    createdAt,
  }
}

export function normalizeSharedCampaignTime(value: unknown): SharedCampaignTimeState {
  const source = object(value) ? value : {}
  const worldMinute = integer(source.worldMinute) ?? CAMPAIGN_TIME_DEFAULT_WORLD_MINUTE
  return {
    schemaVersion: CAMPAIGN_TIME_SCHEMA_VERSION,
    worldMinute,
    timers: (Array.isArray(source.timers) ? source.timers : [])
      .map(normalizeTimer)
      .filter((entry): entry is CampaignTimer => entry !== null)
      .slice(-CAMPAIGN_TIME_TIMER_LIMIT),
    advances: (Array.isArray(source.advances) ? source.advances : [])
      .map(normalizeAdvance)
      .filter((entry): entry is CampaignTimeAdvance => entry !== null)
      .slice(-CAMPAIGN_TIME_ADVANCE_LIMIT),
    updatedAt: integer(source.updatedAt) ?? 0,
  }
}

export function validateSharedCampaignTime(value: unknown): boolean {
  if (!object(value) || value.schemaVersion !== CAMPAIGN_TIME_SCHEMA_VERSION || !Array.isArray(value.timers) || !Array.isArray(value.advances)) return false
  if (value.timers.length > CAMPAIGN_TIME_TIMER_LIMIT || value.advances.length > CAMPAIGN_TIME_ADVANCE_LIMIT) return false
  if (integer(value.worldMinute) == null || integer(value.updatedAt) == null) return false
  const normalized = normalizeSharedCampaignTime(value)
  if (normalized.timers.length !== value.timers.length || normalized.advances.length !== value.advances.length) return false
  if (new Set(normalized.timers.map((entry) => entry.id)).size !== normalized.timers.length) return false
  if (new Set(normalized.advances.map((entry) => entry.id)).size !== normalized.advances.length) return false
  return normalized.advances.every((advance, index, all) => {
    if (advance.toWorldMinute > normalized.worldMinute) return false
    return index === 0 || advance.fromWorldMinute >= all[index - 1].toWorldMinute
  })
}

export function campaignDay(worldMinute: number): number {
  return Math.floor(Math.max(0, worldMinute) / 1_440) + 1
}

export function campaignMinuteOfDay(worldMinute: number): number {
  return Math.max(0, Math.floor(worldMinute)) % 1_440
}

export function formatCampaignTime(worldMinute: number): string {
  const minuteOfDay = campaignMinuteOfDay(worldMinute)
  const hour = Math.floor(minuteOfDay / 60).toString().padStart(2, '0')
  const minute = (minuteOfDay % 60).toString().padStart(2, '0')
  return `第 ${campaignDay(worldMinute)} 日 ${hour}:${minute}`
}

export function formatCampaignDuration(minutes: number): string {
  const value = Math.max(0, Math.floor(minutes))
  const days = Math.floor(value / 1_440)
  const hours = Math.floor(value % 1_440 / 60)
  const remainder = value % 60
  return [days ? `${days} 天` : '', hours ? `${hours} 小时` : '', remainder || (!days && !hours) ? `${remainder} 分钟` : '']
    .filter(Boolean)
    .join(' ')
}

/** 以每日 06:00 为黎明；只统计向前跨过的黎明边界。 */
export function campaignDawnsCrossed(fromWorldMinute: number, toWorldMinute: number): number {
  const from = Math.max(0, Math.floor(fromWorldMinute))
  const to = Math.max(from, Math.floor(toWorldMinute))
  return Math.max(0, Math.floor((to - 360) / 1_440) - Math.floor((from - 360) / 1_440))
}

export function canBenefitFromLongRest(lastLongRestWorldMinute: number | undefined, completionWorldMinute: number): boolean {
  return lastLongRestWorldMinute == null || completionWorldMinute - lastLongRestWorldMinute >= 1_440
}

export function campaignLightIsActive(light: CampaignTimedLight | null | undefined, worldMinute: number): boolean {
  if (light?.enabled !== true) return false
  return !Number.isFinite(light.expiresAtWorldMinute) || worldMinute < Number(light.expiresAtWorldMinute)
}

export function campaignLightRemainingMinutes(light: CampaignTimedLight | null | undefined, worldMinute: number): number | undefined {
  if (!Number.isFinite(light?.expiresAtWorldMinute)) return undefined
  return Math.max(0, Math.floor(Number(light!.expiresAtWorldMinute) - worldMinute))
}

export function campaignLightPresetPatch(presetId: CampaignLightPreset['id'], worldMinute: number) {
  const preset = CAMPAIGN_LIGHT_PRESETS.find((entry) => entry.id === presetId) ?? CAMPAIGN_LIGHT_PRESETS[0]
  return {
    enabled: true,
    sourceKind: preset.id,
    brightRadiusFeet: preset.brightRadiusFeet,
    dimRadiusFeet: preset.dimRadiusFeet,
    color: preset.color,
    startedAtWorldMinute: preset.durationMinutes == null ? undefined : Math.max(0, Math.floor(worldMinute)),
    durationMinutes: preset.durationMinutes,
    expiresAtWorldMinute: preset.durationMinutes == null
      ? undefined
      : Math.max(0, Math.floor(worldMinute)) + preset.durationMinutes,
  }
}
