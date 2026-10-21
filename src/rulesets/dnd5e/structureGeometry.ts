import { MAP_GEOMETRY_MAX_ENTITIES, normalizeMapGeometry, type MapGeometryState, type MapGeometryObstacle, type MapGeometryDoor } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import type { Dnd5eStructureSectionV1 } from './structureSections'

/** Project exact solid volumes; a thin wall must not become a full grid square. */
export function placeDnd5eStructureSections(input: {
  map: BattleMap; geometry: MapGeometryState; structureId: string;
  sections: readonly Dnd5eStructureSectionV1[];
  surfaceMaterial?: MapGeometryObstacle['surfaceMaterial'];
  /** Replace entire selected sections; lintels and neighboring sections remain solid. */
  openings?: readonly { sectionId: string; kind: 'door' | 'arch'; open?: boolean }[];
  origin: { x: number; y: number }; rotationDegrees: number; elevationFeet: number; createdAt: number;
}): MapGeometryState {
  const { map, geometry, sections } = input
  const scale = map.gridSize / (map.feetPerCell ?? 5)
  if (geometry.mapId !== map.id || !/^[a-z0-9][a-z0-9._:-]{0,95}$/.test(input.structureId) ||
    !Number.isFinite(scale) || scale <= 0 || !sections.length ||
    ![input.origin.x,input.origin.y,input.rotationDegrees,input.elevationFeet,input.createdAt].every(Number.isFinite)) {
    throw new Error('structure-placement-invalid')
  }
  const entities = [...geometry.walls,...geometry.doors,...(geometry.windows ?? []),...geometry.obstacles,...(geometry.lights ?? [])]
  if (entities.length + sections.length > MAP_GEOMETRY_MAX_ENTITIES) throw new Error('structure-map-budget-exceeded')
  const ids = new Set(entities.map(entity => entity.id))
  const sectionIds = new Set(sections.map(section => section.id))
  const openings = new Map<string, { kind: 'door' | 'arch'; open?: boolean }>()
  for (const opening of input.openings ?? []) {
    if (!sectionIds.has(opening.sectionId) || openings.has(opening.sectionId) ||
      !['door', 'arch'].includes(opening.kind) || (opening.open !== undefined && typeof opening.open !== 'boolean')) {
      throw new Error('structure-opening-invalid')
    }
    openings.set(opening.sectionId, opening)
  }
  const doors: MapGeometryDoor[] = []
  const angle = input.rotationDegrees * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle)
  const transform = (x: number, y: number) => ({ x: input.origin.x + (x*cos-y*sin)*scale, y: input.origin.y + (x*sin+y*cos)*scale })
  const obstacles: MapGeometryObstacle[] = sections.flatMap(section => {
    if (section.combatProfile.damageResistances?.length || section.combatProfile.damageVulnerabilities?.length) {
      throw new Error('structure-geometry-defense-unsupported')
    }
    const id = `${input.structureId}:${section.id}`
    if (ids.has(id)) throw new Error('structure-entity-id-conflict')
    ids.add(id)
    const dx = section.to.x-section.from.x, dy = section.to.y-section.from.y, length = Math.hypot(dx,dy)
    if (!(length > 0) || !Number.isFinite(length) || !(section.thicknessInches > 0)) throw new Error('structure-section-invalid')
    const half = section.thicknessInches/24, ox = -dy/length*half, oy = dx/length*half
    const points = [transform(section.from.x+ox,section.from.y+oy),transform(section.to.x+ox,section.to.y+oy),
      transform(section.to.x-ox,section.to.y-oy),transform(section.from.x-ox,section.from.y-oy)]
    if (points.some(point => point.x < 0 || point.y < 0 || point.x > map.width || point.y > map.height)) throw new Error('structure-outside-map')
    const durability = {hitPoints:section.maxHp,maxHitPoints:section.maxHp,damageThreshold:section.combatProfile.damageThreshold??0,
      armorClass:section.combatProfile.armorClass,damageImmunities:section.combatProfile.damageImmunities}
    const opening = openings.get(section.id)
    if (opening) {
      if (opening.kind === 'door') doors.push({ id, kind: 'door', label: section.wallId,
        points: [transform(section.from.x, section.from.y), transform(section.to.x, section.to.y)],
        state: opening.open ? 'open' : 'closed', openState: opening.open ? 'open' : 'closed',
        lockState: 'unlocked', physicalState: 'intact', secret: false,
        blocksMovement: true, blocksVision: true, blocksLineOfEffect: true,
        baseHeightFeet: input.elevationFeet + section.bottomFeet, heightFeet: section.heightFeet,
        dnd5eDurability: durability, createdAt: input.createdAt })
      return []
    }
    return [{ id,kind:'obstacle' as const,label:section.wallId,points,cover:'total' as const,
      blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,
      baseHeightFeet:input.elevationFeet+section.bottomFeet,heightFeet:section.heightFeet,createdAt:input.createdAt,
      dnd5eDurability:durability,surfaceMaterial:input.surfaceMaterial,
    }]
  })
  const result = normalizeMapGeometry({...geometry,obstacles:[...geometry.obstacles,...obstacles],doors:[...geometry.doors,...doors]})
  if (!result) throw new Error('structure-geometry-invalid')
  return result
}
