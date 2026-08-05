import type {
  MapGeometryEntity,
  MapGeometryPoint,
  MapGeometryState,
} from '../../lib/mapGeometry'

export type MapEditingRejection =
  | 'dm-authority-required'
  | 'terrain-editing-locked-during-combat'
  | 'entity-not-found'
  | 'store-rejected'

export type MapEditingResult =
  | { ok: true }
  | { ok: false; reason: MapEditingRejection }

export interface MapEditingCoordinatorPorts {
  isDm: () => boolean
  combatActive: () => boolean
  addEntity: (mapId: string, entity: MapGeometryEntity) => boolean
  removeEntity: (mapId: string, entityId: string) => void
  setEntityPoints: (mapId: string, entityId: string, points: MapGeometryPoint[]) => boolean
  replaceMap: (mapId: string, geometry: MapGeometryState) => boolean
  selectEntity: (entityId: string | null) => void
}

function terrainMutationLocked(entity: MapGeometryEntity): boolean {
  return entity.kind === 'obstacle' && (
    entity.terrainRegion === true ||
    (entity.terrainElevationFeet ?? 0) !== 0
  )
}

function findGeometryEntity(
  geometry: MapGeometryState | undefined,
  entityId: string,
): MapGeometryEntity | undefined {
  if (!geometry) return undefined
  return [
    ...geometry.walls,
    ...geometry.doors,
    ...(geometry.windows ?? []),
    ...geometry.obstacles,
    ...(geometry.lights ?? []),
  ].find((candidate) => candidate.id === entityId)
}

/** DM-only gateway for editor mutations; runtime door transactions remain separate. */
export class MapEditingCoordinator {
  private readonly ports: MapEditingCoordinatorPorts

  constructor(ports: MapEditingCoordinatorPorts) {
    this.ports = ports
  }

  commit(mapId: string, entity: MapGeometryEntity): MapEditingResult {
    if (!this.ports.isDm()) return { ok: false, reason: 'dm-authority-required' }
    if (this.ports.combatActive() && terrainMutationLocked(entity)) {
      return { ok: false, reason: 'terrain-editing-locked-during-combat' }
    }
    return this.ports.addEntity(mapId, entity)
      ? { ok: true }
      : { ok: false, reason: 'store-rejected' }
  }

  remove(mapId: string, geometry: MapGeometryState | undefined, entityId: string): MapEditingResult {
    if (!this.ports.isDm()) return { ok: false, reason: 'dm-authority-required' }
    const entity = findGeometryEntity(geometry, entityId)
    if (!entity) return { ok: false, reason: 'entity-not-found' }
    if (this.ports.combatActive() && terrainMutationLocked(entity)) {
      return { ok: false, reason: 'terrain-editing-locked-during-combat' }
    }
    this.ports.removeEntity(mapId, entityId)
    return { ok: true }
  }

  setPoints(
    mapId: string,
    geometry: MapGeometryState | undefined,
    entityId: string,
    points: MapGeometryPoint[],
  ): MapEditingResult {
    if (!this.ports.isDm()) return { ok: false, reason: 'dm-authority-required' }
    const entity = findGeometryEntity(geometry, entityId)
    if (!entity) return { ok: false, reason: 'entity-not-found' }
    if (this.ports.combatActive() && terrainMutationLocked(entity)) {
      return { ok: false, reason: 'terrain-editing-locked-during-combat' }
    }
    return this.ports.setEntityPoints(mapId, entityId, points)
      ? { ok: true }
      : { ok: false, reason: 'store-rejected' }
  }

  replace(mapId: string, geometry: MapGeometryState): MapEditingResult {
    if (!this.ports.isDm()) return { ok: false, reason: 'dm-authority-required' }
    if (this.ports.combatActive() && geometry.obstacles.some(terrainMutationLocked)) {
      return { ok: false, reason: 'terrain-editing-locked-during-combat' }
    }
    return this.ports.replaceMap(mapId, geometry)
      ? { ok: true }
      : { ok: false, reason: 'store-rejected' }
  }

  select(entityId: string | null): void {
    this.ports.selectEntity(entityId)
  }
}
