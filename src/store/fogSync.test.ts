import { describe, expect, it, vi } from 'vitest'
import { createEmptyMapFog } from '../lib/fogOfWar'
import { createEmptyMapGeometry } from '../lib/mapGeometry'

vi.mock('../composition/browserSharedRoomResources', () => ({
  loadSharedResource: vi.fn(),
  saveSharedResourceWithResult: vi.fn().mockResolvedValue({ status: 'saved' }),
}))
import { loadSharedResource } from '../composition/browserSharedRoomResources'
import { useFogStore } from './fog'
import { useMapGeometryStore } from './mapGeometry'

describe('authoritative fog recovery', () => {
  it('clears both player masks when a newer revision restores older empty content', async () => {
    const covered = { ...createEmptyMapFog('map-1'), filled: true }
    vi.mocked(loadSharedResource).mockResolvedValue({
      schemaVersion: 1, updatedAt: 200, _sync: { revision: 10 }, maps: [covered],
    })
    await useFogStore.getState().loadShared()
    vi.mocked(loadSharedResource).mockResolvedValue({
      schemaVersion: 1, updatedAt: 200, _sync: { revision: 10 },
      maps: [{ ...createEmptyMapGeometry('map-1'), darknessFog: covered }],
    })
    await useMapGeometryStore.getState().loadShared()
    expect(useFogStore.getState().maps[0].filled).toBe(true)
    expect(useMapGeometryStore.getState().maps[0].darknessFog?.filled).toBe(true)

    const empty = { ...covered, filled: false, shapes: [] }
    vi.mocked(loadSharedResource).mockResolvedValue({
      schemaVersion: 1, updatedAt: 100, _sync: { revision: 11 }, maps: [empty],
    })
    await useFogStore.getState().loadShared()
    vi.mocked(loadSharedResource).mockResolvedValue({
      schemaVersion: 1, updatedAt: 100, _sync: { revision: 11 },
      maps: [{ ...createEmptyMapGeometry('map-1'), darknessFog: empty }],
    })
    await useMapGeometryStore.getState().loadShared()
    expect(useFogStore.getState().maps[0]).toMatchObject({ filled: false, shapes: [] })
    expect(useMapGeometryStore.getState().maps[0].darknessFog).toMatchObject({ filled: false, shapes: [] })
  })
})
