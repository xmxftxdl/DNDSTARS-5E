import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import {
  createEmptyMapFog,
  MAP_FOG_MAX_SHAPES,
  MAP_FOG_RESOURCE,
  MAP_FOG_SCHEMA_VERSION,
  normalizeSharedMapFog,
  type FogShape,
  type MapFogState,
  type SharedMapFogState,
} from '../lib/fogOfWar'
import { loadSharedResource, saveSharedResource } from '../lib/sharedApi'

interface FogStoreState {
  maps: MapFogState[]
  redoByMap: Record<string, FogShape[]>
  loadShared: () => Promise<void>
  fill: (mapId: string) => void
  clear: (mapId: string) => void
  addShape: (mapId: string, shape: FogShape) => void
  undo: (mapId: string) => void
  redo: (mapId: string) => void
  setStyle: (mapId: string, patch: Pick<Partial<MapFogState>, 'color' | 'opacity'>) => void
}

let lastSharedUpdatedAt = 0

function publish(state: Pick<FogStoreState, 'maps'>): void {
  if (!canWriteSharedState()) return
  const updatedAt = Math.max(Date.now(), lastSharedUpdatedAt + 1)
  // 记录本端已发布的时间戳，防止一次由旧事件触发的 loadShared 用
  // 保存前的快照覆盖刚画好的迷雾。
  lastSharedUpdatedAt = updatedAt
  const payload: SharedMapFogState = {
    schemaVersion: MAP_FOG_SCHEMA_VERSION,
    maps: state.maps.map((map) => ({ ...map, shapes: map.shapes.map((shape) => ({ ...shape })), updatedAt })),
    updatedAt,
  }
  void saveSharedResource(MAP_FOG_RESOURCE, payload)
}

function mutateMap(
  maps: MapFogState[],
  mapId: string,
  mutate: (fog: MapFogState) => MapFogState,
): MapFogState[] {
  const existing = maps.find((map) => map.mapId === mapId) ?? createEmptyMapFog(mapId)
  const next = mutate(existing)
  return [...maps.filter((map) => map.mapId !== mapId), { ...next, updatedAt: Date.now() }]
}

export const useFogStore = create<FogStoreState>()(
  persist(
    (set, get) => ({
      maps: [],
      redoByMap: {},
      loadShared: async () => {
        const shared = await loadSharedResource<SharedMapFogState>(MAP_FOG_RESOURCE)
        const normalized = normalizeSharedMapFog(shared)
        if (!normalized || normalized.updatedAt < lastSharedUpdatedAt) return
        lastSharedUpdatedAt = normalized.updatedAt
        set({ maps: normalized.maps, redoByMap: {} })
      },
      fill: (mapId) => {
        set((state) => ({
          maps: mutateMap(state.maps, mapId, (fog) => ({ ...fog, filled: true, shapes: [] })),
          redoByMap: { ...state.redoByMap, [mapId]: [] },
        }))
        publish(get())
      },
      clear: (mapId) => {
        set((state) => ({
          maps: mutateMap(state.maps, mapId, (fog) => ({ ...fog, filled: false, shapes: [] })),
          redoByMap: { ...state.redoByMap, [mapId]: [] },
        }))
        publish(get())
      },
      addShape: (mapId, shape) => {
        set((state) => ({
          maps: mutateMap(state.maps, mapId, (fog) => ({
            ...fog,
            shapes: [...fog.shapes.filter((entry) => entry.id !== shape.id), shape].slice(-MAP_FOG_MAX_SHAPES),
          })),
          redoByMap: { ...state.redoByMap, [mapId]: [] },
        }))
        publish(get())
      },
      undo: (mapId) => {
        set((state) => {
          const fog = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapFog(mapId)
          const shape = fog.shapes.at(-1)
          if (!shape) return state
          return {
            maps: mutateMap(state.maps, mapId, (current) => ({ ...current, shapes: current.shapes.slice(0, -1) })),
            redoByMap: { ...state.redoByMap, [mapId]: [...(state.redoByMap[mapId] ?? []), shape] },
          }
        })
        publish(get())
      },
      redo: (mapId) => {
        set((state) => {
          const redo = state.redoByMap[mapId] ?? []
          const shape = redo.at(-1)
          if (!shape) return state
          return {
            maps: mutateMap(state.maps, mapId, (fog) => ({ ...fog, shapes: [...fog.shapes, shape] })),
            redoByMap: { ...state.redoByMap, [mapId]: redo.slice(0, -1) },
          }
        })
        publish(get())
      },
      setStyle: (mapId, patch) => {
        set((state) => ({ maps: mutateMap(state.maps, mapId, (fog) => ({ ...fog, ...patch })) }))
        publish(get())
      },
    }),
    {
      name: 'dndstars-map-fog',
      partialize: (state) => ({ maps: state.maps }),
    },
  ),
)
