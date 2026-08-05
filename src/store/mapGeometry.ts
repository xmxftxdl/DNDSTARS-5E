import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import {
  createEmptyMapGeometry,
  MAP_GEOMETRY_MAX_ENTITIES,
  MAP_GEOMETRY_RESOURCE,
  MAP_GEOMETRY_SCHEMA_VERSION,
  mapGeometryAbsoluteElevationAtPoint,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryDoorPhysicalState,
  mapGeometryMoveOpening,
  mapGeometryOpeningOverlaps,
  mapGeometryRelationshipIssues,
  mapGeometryReprojectWallAttachments,
  mapGeometryTerrainElevationAtPoint,
  normalizeSharedMapGeometry,
  normalizeMapGeometry,
  setMapGeometryRuntime,
  type MapGeometryDoorState,
  type MapGeometryEntity,
  type MapGeometryEntityPatch,
  type MapGeometryPoint,
  type MapGeometryState,
  type MapGeometryVisionSettings,
  type SharedMapGeometryState,
} from '../lib/mapGeometry'
import { loadSharedResource, saveSharedResourceWithResult } from '../composition/browserSharedRoomResources'
import { createSharedWriteWatermark } from '../lib/sharedWriteWatermark'
import { campaignLightIsActive } from '../lib/campaignTime'
import type { Dnd5eMapEnvironment } from '../rulesets/dnd5e/environmentRules'

interface MapGeometryStoreState {
  maps: MapGeometryState[]
  selectedEntityId: string | null
  historyByMapId: Record<string, MapGeometryState[]>
  futureByMapId: Record<string, MapGeometryState[]>
  loadShared: () => Promise<void>
  selectEntity: (entityId: string | null) => void
  addEntity: (mapId: string, entity: MapGeometryEntity) => boolean
  updateEntity: (mapId: string, entityId: string, patch: MapGeometryEntityPatch) => void
  applyAuthorityEntityUpdate: (mapId: string, entityId: string, patch: MapGeometryEntityPatch) => void
  setEntityPoints: (mapId: string, entityId: string, points: MapGeometryPoint[]) => boolean
  removeEntity: (mapId: string, entityId: string) => void
  setDoorState: (mapId: string, doorId: string, state: MapGeometryDoorState) => void
  applyAuthorityDoorState: (mapId: string, doorId: string, state: MapGeometryDoorState) => void
  setVision: (mapId: string, patch: Partial<MapGeometryVisionSettings>) => void
  setEnvironment: (mapId: string, environment: Dnd5eMapEnvironment) => void
  clearMap: (mapId: string) => void
  duplicateEntity: (mapId: string, entityId: string, offset?: number) => string | undefined
  replaceMap: (mapId: string, geometry: MapGeometryState) => boolean
  expireTimedLights: (worldMinute: number) => number
  undo: (mapId: string) => void
  redo: (mapId: string) => void
}

const sharedWriteWatermark = createSharedWriteWatermark()

function publish(state: Pick<MapGeometryStoreState, 'maps'>): void {
  if (!canWriteSharedState()) return
  if (state.maps.some((map) => mapGeometryRelationshipIssues(map).length > 0)) return
  const ticket = sharedWriteWatermark.begin()
  const updatedAt = ticket.updatedAt
  const payload: SharedMapGeometryState = {
    schemaVersion: MAP_GEOMETRY_SCHEMA_VERSION,
    maps: state.maps.map((map) => ({ ...map, updatedAt })),
    updatedAt,
  }
  void saveSharedResourceWithResult(MAP_GEOMETRY_RESOURCE, payload)
    .then((result) => {
      sharedWriteWatermark.settle(ticket, result.status === 'saved')
    })
    .catch((error) => {
      sharedWriteWatermark.settle(ticket, false)
      console.error('地图几何共享保存失败', error)
    })
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
    windows: (map.windows ?? []).map(update),
    obstacles: map.obstacles.map(update),
    lights: (map.lights ?? []).map(update),
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
  if (copy.kind === 'door' || copy.kind === 'window') return {
    ...copy,
    points: [points[0], points[1]],
    parentWallId: undefined,
    parentWallSegmentIndex: undefined,
    wallEdgeId: undefined,
    startT: undefined,
    endT: undefined,
  }
  if (copy.kind === 'wall') return {
    ...copy,
    edgeIds: copy.points.slice(0, -1).map(() => crypto.randomUUID()),
  }
  if (copy.kind === 'light') return { ...copy, points: [points[0]] }
  return copy
}

function canonicalizeEditorEntity(entity: MapGeometryEntity): MapGeometryEntity {
  if (entity.kind === 'wall') {
    return {
      ...entity,
      edgeIds: entity.points.slice(0, -1).map((_, index) => entity.edgeIds?.[index] ?? crypto.randomUUID()),
    }
  }
  if (entity.kind === 'door') {
    const openState = mapGeometryDoorOpenState(entity)
    const lockState = mapGeometryDoorLockState(entity)
    const physicalState = mapGeometryDoorPhysicalState(entity)
    const state = openState === 'open' ? 'open' : lockState === 'locked' ? 'locked' : 'closed'
    return { ...entity, state, openState, lockState, physicalState }
  }
  return entity
}

function pointsNear(a: MapGeometryPoint | undefined, b: MapGeometryPoint | undefined, tolerance = 2): boolean {
  return !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) <= tolerance
}

function snapWallPointsToJunctions(
  geometry: MapGeometryState,
  wallId: string,
  points: MapGeometryPoint[],
  tolerance = 8,
): MapGeometryPoint[] {
  const junctions = geometry.walls
    .filter((wall) => wall.id !== wallId)
    .flatMap((wall) => [wall.points[0], wall.points.at(-1)!])
  return points.map((point) => {
    const nearest = junctions
      .map((junction) => ({ junction, distance: Math.hypot(point.x - junction.x, point.y - junction.y) }))
      .filter(({ distance }) => distance <= tolerance)
      .sort((left, right) => left.distance - right.distance)[0]
    return nearest ? { ...nearest.junction } : point
  })
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
        if (!sharedWriteWatermark.shouldApplyRemote(normalized.updatedAt)) return
        sharedWriteWatermark.acceptRemote(normalized.updatedAt)
        setMapGeometryRuntime(normalized.maps)
        set({ maps: normalized.maps, historyByMapId: {}, futureByMapId: {} })
        if (canWriteSharedState() && shared?.schemaVersion !== MAP_GEOMETRY_SCHEMA_VERSION) publish(get())
      },
      selectEntity: (selectedEntityId) => set({ selectedEntityId }),
      addEntity: (mapId, entity) => {
        const nextEntity = canonicalizeEditorEntity(entity)
        let applied = false
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          let selectedEntityId = nextEntity.id
          const maps = mutateMap(state.maps, mapId, (map) => {
            const count = map.walls.length + map.doors.length + (map.windows?.length ?? 0) + map.obstacles.length + (map.lights?.length ?? 0)
            if (count >= MAP_GEOMETRY_MAX_ENTITIES) return map
            const existingEntities = [
              ...map.walls, ...map.doors, ...(map.windows ?? []), ...map.obstacles, ...(map.lights ?? []),
            ]
            if (existingEntities.some((candidate) => candidate.id === nextEntity.id)) return map
            if (nextEntity.kind === 'wall') {
              const existingEdgeIds = new Set(map.walls.flatMap((wall) =>
                wall.points.slice(0, -1).map((_, index) => wall.edgeIds?.[index] ?? `edge:${wall.id}:${index}`),
              ))
              if (nextEntity.edgeIds?.some((edgeId) => existingEdgeIds.has(edgeId))) return map
            }
            if ((nextEntity.kind === 'door' || nextEntity.kind === 'window') && mapGeometryOpeningOverlaps(map, nextEntity)) return map
            if (nextEntity.kind === 'wall') {
              const extend = map.walls.find((wall) =>
                (wall.material ?? 'stone') === (nextEntity.material ?? 'stone') &&
                pointsNear(wall.points.at(-1), nextEntity.points[0]),
              )
              if (extend) {
                applied = true
                selectedEntityId = extend.id
                return {
                  ...map,
                  walls: map.walls.map((wall) => wall.id === extend.id
                    ? {
                        ...wall,
                        points: [...wall.points, ...nextEntity.points.slice(1)],
                        edgeIds: [
                          ...(wall.edgeIds ?? wall.points.slice(0, -1).map((_, index) => `edge:${wall.id}:${index}`)),
                          ...(nextEntity.edgeIds ?? [crypto.randomUUID()]),
                        ],
                      }
                    : wall),
                }
              }
            }
            applied = true
            return nextEntity.kind === 'wall'
              ? { ...map, walls: [...map.walls, nextEntity] }
              : nextEntity.kind === 'door'
                ? { ...map, doors: [...map.doors, nextEntity] }
                : nextEntity.kind === 'window'
                  ? { ...map, windows: [...(map.windows ?? []), nextEntity] }
                : nextEntity.kind === 'obstacle'
                  ? { ...map, obstacles: [...map.obstacles, nextEntity] }
                  : { ...map, lights: [...(map.lights ?? []), nextEntity] }
          })
          if (!applied) return state
          setMapGeometryRuntime(maps)
          return { maps, selectedEntityId, ...pushHistory(state, mapId, current) }
        })
        if (applied) publish(get())
        return applied
      },
      updateEntity: (mapId, entityId, patch) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const candidate = replaceEntity(current, entityId, patch)
          const entity = [
            ...candidate.walls, ...candidate.doors, ...(candidate.windows ?? []),
            ...candidate.obstacles, ...(candidate.lights ?? []),
          ].find((entry) => entry.id === entityId)
          const next = entity ? replaceEntity(candidate, entityId, canonicalizeEditorEntity(entity)) : candidate
          if (mapGeometryRelationshipIssues(next).length > 0) return state
          const maps = mutateMap(state.maps, mapId, () => next)
          setMapGeometryRuntime(maps)
          return { maps, ...pushHistory(state, mapId, current) }
        })
        publish(get())
      },
      applyAuthorityEntityUpdate: (mapId, entityId, patch) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const candidate = replaceEntity(current, entityId, patch)
          const entity = [
            ...candidate.walls, ...candidate.doors, ...(candidate.windows ?? []),
            ...candidate.obstacles, ...(candidate.lights ?? []),
          ].find((entry) => entry.id === entityId)
          const next = entity ? replaceEntity(candidate, entityId, canonicalizeEditorEntity(entity)) : candidate
          if (mapGeometryRelationshipIssues(next).length > 0) return state
          const maps = mutateMap(state.maps, mapId, () => next)
          setMapGeometryRuntime(maps)
          return { maps, ...pushHistory(state, mapId, current) }
        })
      },
      setEntityPoints: (mapId, entityId, points) => {
        let applied = false
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const entity = [
            ...current.walls, ...current.doors, ...(current.windows ?? []),
            ...current.obstacles, ...(current.lights ?? []),
          ].find((candidate) => candidate.id === entityId)
          if (!entity) return state
          let next: MapGeometryState | undefined
          if (entity.kind === 'wall') {
            next = mapGeometryReprojectWallAttachments(current, entityId, snapWallPointsToJunctions(current, entityId, points))
          }
          else if (entity.kind === 'door' || entity.kind === 'window') {
            if (points.length !== 2) return state
            next = mapGeometryMoveOpening(current, entityId, [points[0], points[1]], 40)
          } else if (entity.kind === 'light') {
            if (points.length !== 1) return state
            const oldGroundElevation = mapGeometryTerrainElevationAtPoint(current, entity.points[0])
            const newGroundElevation = mapGeometryTerrainElevationAtPoint(current, points[0])
            const heightAboveGround =
              mapGeometryAbsoluteElevationAtPoint(current, entity.points[0], entity.elevationFeet) -
              oldGroundElevation
            next = replaceEntity(current, entityId, {
              points,
              elevationFeet: newGroundElevation + heightAboveGround,
            })
          } else if (points.length >= 3) next = replaceEntity(current, entityId, { points })
          if (!next) return state
          applied = true
          const maps = [...state.maps.filter((map) => map.mapId !== mapId), { ...next, updatedAt: Date.now() }]
          setMapGeometryRuntime(maps)
          return { maps, ...pushHistory(state, mapId, current) }
        })
        if (applied) publish(get())
        return applied
      },
      removeEntity: (mapId, entityId) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const removedWall = current.walls.find((wall) => wall.id === entityId)
          const removedEdgeIds = new Set(removedWall?.points.slice(0, -1).map((_, index) =>
            removedWall.edgeIds?.[index] ?? `edge:${removedWall.id}:${index}`,
          ) ?? [])
          const maps = mutateMap(state.maps, mapId, (map) => ({
            ...map,
            walls: map.walls.filter((entity) => entity.id !== entityId),
            doors: map.doors.filter((entity) =>
              entity.id !== entityId && entity.parentWallId !== entityId && !removedEdgeIds.has(entity.wallEdgeId ?? ''),
            ),
            windows: (map.windows ?? []).filter((entity) =>
              entity.id !== entityId && entity.parentWallId !== entityId && !removedEdgeIds.has(entity.wallEdgeId ?? ''),
            ),
            obstacles: map.obstacles.filter((entity) => entity.id !== entityId),
            lights: (map.lights ?? []).filter((entity) => entity.id !== entityId),
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
            doors: map.doors.map((door) => door.id === doorId
              ? canonicalizeEditorEntity({
                  ...door,
                  state: doorState,
                  openState: doorState === 'open' ? 'open' : 'closed',
                  lockState: doorState === 'locked' ? 'locked' : 'unlocked',
                }) as typeof door
              : door),
          }))
          setMapGeometryRuntime(maps)
          return { maps, ...pushHistory(state, mapId, current) }
        })
        publish(get())
      },
      applyAuthorityDoorState: (mapId, doorId, doorState) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const maps = mutateMap(state.maps, mapId, (map) => ({
            ...map,
            doors: map.doors.map((door) => door.id === doorId
              ? canonicalizeEditorEntity({
                  ...door,
                  state: doorState,
                  openState: doorState === 'open' ? 'open' : 'closed',
                  lockState: doorState === 'locked' ? 'locked' : 'unlocked',
                }) as typeof door
              : door),
          }))
          setMapGeometryRuntime(maps)
          return { maps, ...pushHistory(state, mapId, current) }
        })
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
      setEnvironment: (mapId, environment) => {
        set((state) => {
          const current = state.maps.find((map) => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
          const maps = mutateMap(state.maps, mapId, (map) => ({ ...map, environment }))
          setMapGeometryRuntime(maps)
          return { maps, ...pushHistory(state, mapId, current) }
        })
        publish(get())
      },
      expireTimedLights: (worldMinute) => {
        let expired = 0
        set((state) => {
          const maps = state.maps.map((map) => ({
            ...map,
            lights: (map.lights ?? []).map((light) => {
              if (!light.enabled || campaignLightIsActive(light, worldMinute)) return light
              expired += 1
              return { ...light, enabled: false }
            }),
          }))
          if (expired > 0) setMapGeometryRuntime(maps)
          return expired > 0 ? { maps } : state
        })
        if (expired > 0) publish(get())
        return expired
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
        const source = [...current.walls, ...current.doors, ...(current.windows ?? []), ...current.obstacles, ...(current.lights ?? [])].find((entity) => entity.id === entityId)
        if (!source) return undefined
        const entity = offsetEntity(source, offset)
        return get().addEntity(mapId, entity) ? entity.id : undefined
      },
      replaceMap: (mapId, geometry) => {
        if (geometry.mapId !== mapId) return false
        if (mapGeometryRelationshipIssues(geometry).length > 0) return false
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
