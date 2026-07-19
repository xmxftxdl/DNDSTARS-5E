import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import {
  createEmptyMapGeometry,
  MAP_GEOMETRY_MAX_ENTITIES,
  MAP_GEOMETRY_RESOURCE,
  MAP_GEOMETRY_SCHEMA_VERSION,
  normalizeSharedMapGeometry,
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
  loadShared: () => Promise<void>
  selectEntity: (entityId: string | null) => void
  addEntity: (mapId: string, entity: MapGeometryEntity) => void
  updateEntity: (mapId: string, entityId: string, patch: MapGeometryEntityPatch) => void
  removeEntity: (mapId: string, entityId: string) => void
  setDoorState: (mapId: string, doorId: string, state: MapGeometryDoorState) => void
  setVision: (mapId: string, patch: Partial<MapGeometryVisionSettings>) => void
  clearMap: (mapId: string) => void
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

export const useMapGeometryStore = create<MapGeometryStoreState>()(
  persist(
    (set, get) => ({
      maps: [],
      selectedEntityId: null,
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
        set({ maps: normalized.maps })
      },
      selectEntity: (selectedEntityId) => set({ selectedEntityId }),
      addEntity: (mapId, entity) => {
        set((state) => {
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
          return { maps, selectedEntityId: entity.id }
        })
        publish(get())
      },
      updateEntity: (mapId, entityId, patch) => {
        set((state) => {
          const maps = mutateMap(state.maps, mapId, (map) => replaceEntity(map, entityId, patch))
          setMapGeometryRuntime(maps)
          return { maps }
        })
        publish(get())
      },
      removeEntity: (mapId, entityId) => {
        set((state) => {
          const maps = mutateMap(state.maps, mapId, (map) => ({
            ...map,
            walls: map.walls.filter((entity) => entity.id !== entityId),
            doors: map.doors.filter((entity) => entity.id !== entityId),
            obstacles: map.obstacles.filter((entity) => entity.id !== entityId),
          }))
          setMapGeometryRuntime(maps)
          return { maps, selectedEntityId: state.selectedEntityId === entityId ? null : state.selectedEntityId }
        })
        publish(get())
      },
      setDoorState: (mapId, doorId, doorState) => {
        set((state) => {
          const maps = mutateMap(state.maps, mapId, (map) => ({
            ...map,
            doors: map.doors.map((door) => door.id === doorId ? { ...door, state: doorState } : door),
          }))
          setMapGeometryRuntime(maps)
          return { maps }
        })
        publish(get())
      },
      setVision: (mapId, patch) => {
        set((state) => {
          const maps = mutateMap(state.maps, mapId, (map) => ({ ...map, vision: { ...map.vision, ...patch } }))
          setMapGeometryRuntime(maps)
          return { maps }
        })
        publish(get())
      },
      clearMap: (mapId) => {
        set((state) => {
          const maps = mutateMap(state.maps, mapId, (map) => ({ ...createEmptyMapGeometry(mapId), vision: map.vision }))
          setMapGeometryRuntime(maps)
          return { maps, selectedEntityId: null }
        })
        publish(get())
      },
    }),
    {
      name: 'dndstars-map-geometry',
      partialize: (state) => ({ maps: state.maps }),
      onRehydrateStorage: () => (state) => {
        if (state?.maps) setMapGeometryRuntime(state.maps)
      },
    },
  ),
)
