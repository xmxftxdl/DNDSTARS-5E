import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import {
  MAP_EXPLORATION_MAX_POLYGONS_PER_MEMBER,
  MAP_EXPLORATION_RESOURCE,
  MAP_EXPLORATION_SCHEMA_VERSION,
  mapExplorationPolygonSignature,
  normalizeSharedMapExploration,
  type MapExplorationMapState,
  type SharedMapExplorationState,
} from '../lib/mapExploration'
import type { MapGeometryPoint } from '../lib/mapGeometry'
import { loadSharedResource, saveSharedResourceWithResult } from '../composition/browserSharedRoomResources'
import { createSharedWriteWatermark } from '../lib/sharedWriteWatermark'

interface MapExplorationStoreState {
  maps: MapExplorationMapState[]
  loadShared: () => Promise<void>
  record: (mapId: string, memberId: string, polygons: readonly MapGeometryPoint[][]) => void
  clearMember: (mapId: string, memberId: string) => void
}

const sharedWriteWatermark = createSharedWriteWatermark()

function publish(maps: MapExplorationMapState[]) {
  if (!canWriteSharedState()) return
  const ticket = sharedWriteWatermark.begin()
  const updatedAt = ticket.updatedAt
  const payload: SharedMapExplorationState = { schemaVersion: MAP_EXPLORATION_SCHEMA_VERSION, maps, updatedAt }
  void saveSharedResourceWithResult(MAP_EXPLORATION_RESOURCE, payload).then((result) => {
    sharedWriteWatermark.settle(ticket, result.status === 'saved')
  })
}

export const useMapExplorationStore = create<MapExplorationStoreState>()(
  persist((set, get) => ({
    maps: [],
    loadShared: async () => {
      const shared = normalizeSharedMapExploration(await loadSharedResource(MAP_EXPLORATION_RESOURCE))
      if (!shared) return
      if (!sharedWriteWatermark.shouldApplyRemote(shared.updatedAt)) return
      sharedWriteWatermark.acceptRemote(shared.updatedAt)
      set({ maps: shared.maps })
    },
    record: (mapId, memberId, polygons) => {
      const valid = polygons.filter((polygon) => polygon.length >= 3)
      if (!memberId || valid.length === 0) return
      const now = Date.now()
      set((state) => {
        const current = state.maps.find((map) => map.mapId === mapId) ?? { mapId, byMemberId: {}, updatedAt: now }
        const member = current.byMemberId[memberId] ?? { polygons: [], updatedAt: now }
        const signatures = new Set(member.polygons.map(mapExplorationPolygonSignature))
        const additions = valid.filter((polygon) => {
          const signature = mapExplorationPolygonSignature(polygon)
          if (signatures.has(signature)) return false
          signatures.add(signature)
          return true
        }).map((polygon) => polygon.map((point) => ({ ...point })))
        if (additions.length === 0) return state
        const nextMap: MapExplorationMapState = {
          ...current,
          byMemberId: {
            ...current.byMemberId,
            [memberId]: {
              polygons: [...member.polygons, ...additions].slice(-MAP_EXPLORATION_MAX_POLYGONS_PER_MEMBER),
              updatedAt: now,
            },
          },
          updatedAt: now,
        }
        const maps = [...state.maps.filter((map) => map.mapId !== mapId), nextMap]
        queueMicrotask(() => publish(get().maps))
        return { maps }
      })
    },
    clearMember: (mapId, memberId) => {
      set((state) => {
        const current = state.maps.find((map) => map.mapId === mapId)
        if (!current?.byMemberId[memberId]) return state
        const byMemberId = { ...current.byMemberId }
        delete byMemberId[memberId]
        const nextMap = { ...current, byMemberId, updatedAt: Date.now() }
        const maps = [...state.maps.filter((map) => map.mapId !== mapId), nextMap]
        queueMicrotask(() => publish(get().maps))
        return { maps }
      })
    },
  }), {
    name: 'dndstars-map-exploration',
    partialize: (state) => ({ maps: state.maps }),
  }),
)
