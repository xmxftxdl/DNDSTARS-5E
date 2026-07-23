export const SCENE_AUDIO_LIBRARY_RESOURCE = 'scene-audio-library'
export const SCENE_AUDIO_PLAYBACK_RESOURCE = 'scene-audio-playback'
export const SCENE_AUDIO_SCHEMA_VERSION = 1
export const SCENE_AUDIO_MAX_ASSETS = 80
export const SCENE_AUDIO_MAX_BYTES = 24 * 1024 * 1024

export type SceneAudioKind = 'music' | 'ambience' | 'sfx'
export type SceneAudioPlaybackStatus = 'stopped' | 'playing' | 'paused'

export interface SceneAudioAsset {
  id: string
  name: string
  fileName: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number
  kind: SceneAudioKind
  createdAt: number
}

export interface SharedSceneAudioLibraryState {
  schemaVersion: typeof SCENE_AUDIO_SCHEMA_VERSION
  assets: SceneAudioAsset[]
  updatedAt: number
}

export interface SharedSceneAudioPlaybackState {
  schemaVersion: typeof SCENE_AUDIO_SCHEMA_VERSION
  status: SceneAudioPlaybackStatus
  assetId?: string
  assetName?: string
  positionSeconds: number
  anchorServerMs: number
  loop: boolean
  volume: number
  fadeMs: number
  updatedAt: number
}

export type SceneAudioPlaybackMutation =
  | { operation: 'play'; assetId: string; loop: boolean; volume: number; positionSeconds?: number; fadeMs?: number }
  | { operation: 'pause' | 'resume' | 'stop' }
  | { operation: 'seek'; positionSeconds: number }
  | { operation: 'set-volume'; volume: number }

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function timestamp(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0
}

function normalizeAsset(value: unknown): SceneAudioAsset | null {
  if (!object(value)) return null
  const id = boundedText(value.id, 160)
  const name = boundedText(value.name, 160)
  const fileName = boundedText(value.fileName, 240)
  const mimeType = boundedText(value.mimeType, 100).toLowerCase()
  const sizeBytes = Number(value.sizeBytes)
  const durationSeconds = Number(value.durationSeconds)
  const kind = value.kind === 'music' || value.kind === 'sfx' ? value.kind : 'ambience'
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !name || !fileName || !mimeType.startsWith('audio/') ||
    !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > SCENE_AUDIO_MAX_BYTES ||
    !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 24 * 60 * 60) return null
  return { id, name, fileName, mimeType, sizeBytes, durationSeconds, kind, createdAt: timestamp(value.createdAt) }
}

export function emptySceneAudioLibrary(): SharedSceneAudioLibraryState {
  return { schemaVersion: SCENE_AUDIO_SCHEMA_VERSION, assets: [], updatedAt: 0 }
}

export function emptySceneAudioPlayback(): SharedSceneAudioPlaybackState {
  return {
    schemaVersion: SCENE_AUDIO_SCHEMA_VERSION,
    status: 'stopped',
    positionSeconds: 0,
    anchorServerMs: 0,
    loop: false,
    volume: 0.7,
    fadeMs: 0,
    updatedAt: 0,
  }
}

export function normalizeSharedSceneAudioLibrary(value: unknown): SharedSceneAudioLibraryState {
  const source = object(value) ? value : {}
  return {
    schemaVersion: SCENE_AUDIO_SCHEMA_VERSION,
    assets: (Array.isArray(source.assets) ? source.assets : []).map(normalizeAsset)
      .filter((asset): asset is SceneAudioAsset => asset !== null)
      .slice(-SCENE_AUDIO_MAX_ASSETS),
    updatedAt: timestamp(source.updatedAt),
  }
}

export function validateSharedSceneAudioLibrary(value: unknown): boolean {
  if (!object(value) || value.schemaVersion !== SCENE_AUDIO_SCHEMA_VERSION || !Array.isArray(value.assets) || value.assets.length > SCENE_AUDIO_MAX_ASSETS) return false
  const normalized = normalizeSharedSceneAudioLibrary(value)
  return normalized.assets.length === value.assets.length && new Set(normalized.assets.map((asset) => asset.id)).size === normalized.assets.length
}

export function normalizeSharedSceneAudioPlayback(value: unknown): SharedSceneAudioPlaybackState {
  const source = object(value) ? value : {}
  const status = source.status === 'playing' || source.status === 'paused' ? source.status : 'stopped'
  const assetId = boundedText(source.assetId, 160)
  const active = status !== 'stopped' && /^[a-zA-Z0-9_-]+$/.test(assetId)
  return {
    schemaVersion: SCENE_AUDIO_SCHEMA_VERSION,
    status: active ? status : 'stopped',
    ...(active ? { assetId, assetName: boundedText(source.assetName, 160) || '场景音频' } : {}),
    positionSeconds: Math.max(0, Number(source.positionSeconds) || 0),
    anchorServerMs: timestamp(source.anchorServerMs),
    loop: active && source.loop === true,
    volume: Math.min(1, Math.max(0, source.volume == null ? 0.7 : Number(source.volume) || 0)),
    fadeMs: Math.min(10_000, Math.max(0, Math.floor(Number(source.fadeMs) || 0))),
    updatedAt: timestamp(source.updatedAt),
  }
}

export function validateSharedSceneAudioPlayback(value: unknown): boolean {
  if (!object(value) || value.schemaVersion !== SCENE_AUDIO_SCHEMA_VERSION || !['stopped', 'playing', 'paused'].includes(String(value.status))) return false
  const normalized = normalizeSharedSceneAudioPlayback(value)
  if (value.status !== normalized.status || !Number.isFinite(value.positionSeconds) || Number(value.positionSeconds) < 0 ||
    !Number.isFinite(value.anchorServerMs) || !Number.isFinite(value.updatedAt) ||
    typeof value.loop !== 'boolean' || !Number.isFinite(value.volume) || Number(value.volume) < 0 || Number(value.volume) > 1 ||
    !Number.isInteger(value.fadeMs) || Number(value.fadeMs) < 0 || Number(value.fadeMs) > 10_000) return false
  return normalized.status === 'stopped' || (!!normalized.assetId && !!normalized.assetName)
}

export function sceneAudioPositionAt(
  playback: SharedSceneAudioPlaybackState,
  serverNowMs: number,
  durationSeconds: number,
): number {
  const elapsed = playback.status === 'playing'
    ? Math.max(0, serverNowMs - playback.anchorServerMs) / 1_000
    : 0
  const position = Math.max(0, playback.positionSeconds + elapsed)
  if (durationSeconds <= 0) return position
  return playback.loop ? position % durationSeconds : Math.min(durationSeconds, position)
}
