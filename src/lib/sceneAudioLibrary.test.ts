import { describe, expect, it } from 'vitest'
import {
  normalizeSharedSceneAudioPlayback,
  sceneAudioPositionAt,
  validateSharedSceneAudioLibrary,
  validateSharedSceneAudioPlayback,
} from './sceneAudioLibrary'

const asset = {
  id: 'scene-audio-rain', name: 'Rain', fileName: 'rain.ogg', mimeType: 'audio/ogg',
  sizeBytes: 1_024, durationSeconds: 90, kind: 'ambience', createdAt: 1,
}

describe('scene audio shared model', () => {
  it('accepts bounded room audio metadata and rejects unsafe ids', () => {
    expect(validateSharedSceneAudioLibrary({ schemaVersion: 1, assets: [asset], updatedAt: 1 })).toBe(true)
    expect(validateSharedSceneAudioLibrary({ schemaVersion: 1, assets: [{ ...asset, id: '../rain' }], updatedAt: 1 })).toBe(false)
    expect(validateSharedSceneAudioLibrary({ schemaVersion: 1, assets: [asset, asset], updatedAt: 1 })).toBe(false)
  })

  it('validates authoritative playback anchors', () => {
    const playback = {
      schemaVersion: 1, status: 'playing', assetId: asset.id, assetName: asset.name,
      positionSeconds: 5, anchorServerMs: 1_000, loop: true, volume: 0.7, fadeMs: 0, updatedAt: 1_000,
    }
    expect(validateSharedSceneAudioPlayback(playback)).toBe(true)
    expect(validateSharedSceneAudioPlayback({ ...playback, volume: 2 })).toBe(false)
    expect(normalizeSharedSceneAudioPlayback(null)).toMatchObject({ status: 'stopped', volume: 0.7 })
  })

  it('computes a shared position from server time and wraps looping ambience', () => {
    const playback = normalizeSharedSceneAudioPlayback({
      schemaVersion: 1, status: 'playing', assetId: asset.id, assetName: asset.name,
      positionSeconds: 85, anchorServerMs: 1_000, loop: true, volume: 0.7, fadeMs: 0, updatedAt: 1_000,
    })
    expect(sceneAudioPositionAt(playback, 11_000, 90)).toBe(5)
    expect(sceneAudioPositionAt({ ...playback, loop: false }, 11_000, 90)).toBe(90)
  })
})
