import { describe, expect, it } from 'vitest'
import mapsPageSource from '../pages/MapsPage.tsx?raw'
import roomSharedStateSyncSource from './roomSharedStateSync.ts?raw'

const mapsInvalidationSubscriptions = (source: string): string[] =>
  source.match(/subscribeSharedResourceInvalidation\(\s*['"]maps['"]/g) ?? []

describe('room shared-state sync topology', () => {
  it('keeps maps invalidation under the room-wide coordinator only', () => {
    expect(mapsInvalidationSubscriptions(roomSharedStateSyncSource)).toHaveLength(1)
    expect(mapsInvalidationSubscriptions(mapsPageSource)).toHaveLength(0)
  })

  it('uses a slower recovery cadence for low-frequency room resources', () => {
    expect(roomSharedStateSyncSource).toContain('const coldSubscriptionOptions = { immediate: false, recoveryMs: 60_000 }')
    expect(roomSharedStateSyncSource).toContain(
      'subscribeSharedResourceInvalidation(SHARED_SPELLBOOK_RESOURCE, loadSharedSpellbook, coldSubscriptionOptions)',
    )
    expect(roomSharedStateSyncSource).toContain(
      'subscribeSharedResourceInvalidation(SCENE_AUDIO_LIBRARY_RESOURCE, loadSharedSceneAudioLibrary, coldSubscriptionOptions)',
    )
  })
})
