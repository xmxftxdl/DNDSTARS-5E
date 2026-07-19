import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import {
  createEmptyMapGeometry,
  MAP_GEOMETRY_MAX_ENTITIES,
  MAP_GEOMETRY_RESOURCE,
  MAP_GEOMETRY_SCHEMA_VERSION,
  normalizeSharedMapGeometry,
  normalizeMapGeometry,
  setMapGeometryRuntime,
  type MapGeometryDoorState,
  type MapGeometryEntity,
  type MapGeometryEntityPatch,
  type MapGeometryState,
  type MapGeometryVisionSettings,
  type SharedMapGeometryState,
} from '../lib/mapGeometry'
import { loadSharedResource, saveSharedResource } from '../lib/sharedApi'

interface MapGeometryStoreState {
  maps: MapGeometryState[]
  selectedEntityId: string | null
  historyByMapId: Record<string, MapGeometryState[]>
  futureByMapId: Record<string, MapGeometryState[]>
  loadShared: () => Promise<void>
  selectEntity: (entityId: string | null) => void
  addEntity: (mapId: string, entity: MapGeometryEntity) => void
  updateEntity: (mapId: string, entityId: string, patch: MapGeometryEntityPatch) => void
  removeEntity: (mapId: string, entityId: string) => void
  setDoorState: (mapId: string, doorId: string, state: MapGeometryDoorState) => void
  setVision: (mapId: string, patch: Partial<MapGeometryVisionSettings>) => void
  clearMap: (mapId: string) => void
  duplicateEntity: (mapId: string, entityId: string, offset?: number) => string | undefined
  replaceMap: (mapId: string, geometry: MapGeometryState) => boolean
  undo: (mapId: string) => void
  redo: (mapId: string) => void
}

let lastSharedUpdatedAt = 0

function publish(state: Pick<MapGeometryStoreState, 'maps'>): void {
  if (!canWriteSharedState()) return
  const updatedAt = Math.max(Date.now(), lastSharedUpdatedAt + 1)
  const payload: SharedMapGeometryState = {
    schemaVersion: MAP_GEOMETRY_SCHEMA_VERSION,
    maps: state.maps.map((map) => ({ ...map, updatedAt })),
    updatedAt,
  }
  void saveSharedResource(MAP_GEOMETRY_RESOURCE, payload)
}

function mutateMap(
  maps: MapGeometryState[],
  mapId: string,
  mutate: (map: MapGeometryState) => MapGeometryState,
): MapGeometryState[] {
  const current = maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
  const next = { ...mutate(current), updatedAt: Date.now() }
  return [...maps.filter((map) => map.mapId !== mapId), next]
}

function replaceEntity(map: MapGeometryState, entityId: string, patch: MapGeometryEntityPatch): MapGeometryState {
  const update = <T extends MapGeometryEntity>(entity: T): T =>
    entity.id === entityId ? { ...entity, ...patch, id: entity.id, kind: entity.kind } as T : entity
  return {
    ...map,
    walls: map.walls.map(update),
    doors: map.doors.map(update),
    obstacles: map.obstacles.map(update),
  }
}

const HISTORY_LIMIT = 50

function snapshot(map: MapGeometryState): MapGeometryState {
  return structuredClone(map)
}

function pushHistory(state: MapGeometryStoreState, mapId: string, current: MapGeometryState) {
  return {
    historyByMapId: {
      ...state.historyByMapId,
      [mapId]: [...(state.historyByMapId[mapId] ?? []), snapshot(current)].slice(-HISTORY_LIMIT),
    },
    futureByMapId: { ...state.futureByMapId, [mapId]: [] },
  }
}

function offsetEntity(entity: MapGeometryEntity, offset: number): MapGeometryEntity {
  const points = entity.points.map((point) => ({ x: point.x + offset, y: point.y + offset }))
  const copy = {
    ...entity,
    id: crypto.randomUUID(),
    label: `${entity.label} 副本`.slice(0, 120),
    createdAt: Date.now(),
    points,
  }
  return copy.kind === 'door' ? { ...copy, points: [points[0], points[1]] } : copy
}

export const useMapGeometryStore = create<MapGeometryStoreState>()(
  persist(
    (set, get) => ({
      maps: [],
      selectedEntityId: null,
      historyByMapId: {},
      futureByMapId: {},
      loadShared: async () => {
        const shared = await loadSharedResource<SharedMapGeometryState>(MAP_GEOMETRY_RESOURCE)
        const normalized = normalizeSharedMapGeometry(shared)
        if (!normalized) {
          if (canWriteSharedState() && get().maps.length > 0) publish(get())
          return
        }
        if (normalized.updatedAt < lastSharedUpdatedAt) return
        lastSharedUpdatedAt = normalized.updatedAt
        setMapGeometryRuntime(normalized.maps)
        set({ maps: normalized.maps, historyByMapId: {}, futureByMapId: {} })
      },
      selectEntity: (selectedEntityId) => set({ selectedEntityId }),
      addEntity: (mapId, entity) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const maps = mutateMap(state.maps, mapId, (map) => {
            const count = map.walls.length + map.doors.length + map.obstacles.length
            if (count >= MAP_GEOMETRY_MAX_ENTITIES) return map
            return entity.kind === 'wall'
              ? { ...map, walls: [...map.walls, entity] }
              : entity.kind === 'door'
                ? { ...map, doors: [...map.doors, entity] }
                : { ...map, obstacles: [...map.obstacles, entity] }
          })
          setMapGeometryRuntime(maps)
          return { maps, selectedEntityId: entity.id, ...pushHistory(state, mapId, current) }
        })
        publish(get())
      },
      updateEntity: (mapId, entityId, patch) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const maps = mutateMap(state.maps, mapId, (map) => replaceEntity(map, entityId, patch))
          setMapGeometryRuntime(maps)
          return { maps, ...pushHistory(state, mapId, current) }
        })
        publish(get())
      },
      removeEntity: (mapId, entityId) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const maps = mutateMap(state.maps, mapId, (map) => ({
            ...map,
            walls: map.walls.filter((entity) => entity.id !== entityId),
            doors: map.doors.filter((entity) => entity.id !== entityId),
            obstacles: map.obstacles.filter((entity) => entity.id !== entityId),
          }))
          setMapGeometryRuntime(maps)
          return {
            maps,
            selectedEntityId: state.selectedEntityId === entityId ? null : state.selectedEntityId,
            ...pushHistory(state, mapId, current),
          }
        })
        publish(get())
      },
      setDoorState: (mapId, doorId, doorState) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const maps = mutateMap(state.maps, mapId, (map) => ({
            ...map,
            doors: map.doors.map((door) => door.id === doorId ? { ...door, state: doorState } : door),
          }))
          setMapGeometryRuntime(maps)
          return { maps, ...pushHistory(state, mapId, current) }
        })
        publish(get())
      },
      setVision: (mapId, patch) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const maps = mutateMap(state.maps, mapId, (map) => ({ ...map, vision: { ...map.vision, ...patch } }))
          setMapGeometryRuntime(maps)
          return { maps, ...pushHistory(state, mapId, current) }
        })
        publish(get())
      },
      clearMap: (mapId) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const maps = mutateMap(state.maps, mapId, (map) => ({ ...createEmptyMapGeometry(mapId), vision: map.vision }))
          setMapGeometryRuntime(maps)
          return { maps, selectedEntityId: null, ...pushHistory(state, mapId, current) }
        })
        publish(get())
      },
      duplicateEntity: (mapId, entityId, offset = 12) => {
        const state = get()
        const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
        const source = [...current.walls, ...current.doors, ...current.obstacles].find((entity) => entity.id === entityId)
        if (!source) return undefined
        const entity = offsetEntity(source, offset)
        get().addEntity(mapId, entity)
        return entity.id
      },
      replaceMap: (mapId, geometry) => {
        if (geometry.mapId !== mapId) return false
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const next = { ...snapshot(geometry), mapId, updatedAt: Date.now() }
          const maps = [...state.maps.filter((map) => map.mapId !== mapId), next]
          setMapGeometryRuntime(maps)
          return { maps, selectedEntityId: null, ...pushHistory(state, mapId, current) }
        })
        publish(get())
        return true
      },
      undo: (mapId) => {
        const state = get()
        const history = state.historyByMapId[mapId] ?? []
        const previous = history.at(-1)
        if (!previous) return
        const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
        const maps = [...state.maps.filter((map) => map.mapId !== mapId), { ...snapshot(previous), updatedAt: Date.now() }]
        setMapGeometryRuntime(maps)
        set({
          maps,
          selectedEntityId: null,
          historyByMapId: { ...state.historyByMapId, [mapId]: history.slice(0, -1) },
          futureByMapId: { ...state.futureByMapId, [mapId]: [...(state.futureByMapId[mapId] ?? []), snapshot(current)].slice(-HISTORY_LIMIT) },
        })
        publish(get())
      },
      redo: (mapId) => {
        const state = get()
        const future = state.futureByMapId[mapId] ?? []
        const next = future.at(-1)
        if (!next) return
        const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
        const maps = [...state.maps.filter((map) => map.mapId !== mapId), { ...snapshot(next), updatedAt: Date.now() }]
        setMapGeometryRuntime(maps)
        set({
          maps,
          selectedEntityId: null,
          historyByMapId: { ...state.historyByMapId, [mapId]: [...(state.historyByMapId[mapId] ?? []), snapshot(current)].slice(-HISTORY_LIMIT) },
          futureByMapId: { ...state.futureByMapId, [mapId]: future.slice(0, -1) },
        })
        publish(get())
      },
    }),
    {
      name: 'dndstars-map-geometry',
      partialize: (state) => ({ maps: state.maps }),
      onRehydrateStorage: () => (state) => {
        if (state?.maps) {
          state.maps = state.maps.map((map) => normalizeMapGeometry(map) ?? createEmptyMapGeometry(map.mapId))
          setMapGeometryRuntime(state.maps)
        }
      },
    },
  ),
)
