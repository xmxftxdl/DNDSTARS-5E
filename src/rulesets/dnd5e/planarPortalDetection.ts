import type { OrchestratedScene } from '../../lib/sceneOrchestration'
import { validScenePortalSurvey } from '../../lib/scenePortalSurvey'
import { dnd5eMapPlaneRelation } from './mapPlane'

type SurveyMap = { id: string; dnd5ePlane?: string; gridSize: number; feetPerCell?: number }
export type Dnd5ePlanarPortalReport =
  | { status: 'unavailable'; reason: 'incomplete-survey' | 'invalid-map-scale' | 'unknown-destination-plane' }
  | { status: 'none' }
  | { status: 'found'; distanceFeet: number; bearingDegrees: number; elevationDegrees: number }

/**
 * Host-only query. Completeness is derived from DM-authored survey coverage;
 * an empty loaded map alone never proves a one-mile survey is complete.
 * Only the report may be shared: no trigger IDs, destination IDs or names.
 */
export function detectDnd5ePlanarPortal(input: {
  map: SurveyMap
  maps: readonly Pick<SurveyMap, 'id' | 'dnd5ePlane'>[]
  scenes: readonly OrchestratedScene[]
  origin: { x: number; y: number; elevationFeet?: number }
  rangeFeet: number
}): Dnd5ePlanarPortalReport {
  const scale = (input.map.feetPerCell ?? 5) / input.map.gridSize
  if (!Number.isFinite(input.map.gridSize) || input.map.gridSize <= 0 ||
    !Number.isFinite(input.map.feetPerCell ?? 5) || (input.map.feetPerCell ?? 5) <= 0 ||
    !Number.isFinite(scale) || scale <= 0 || !Number.isFinite(input.rangeFeet) || input.rangeFeet <= 0 ||
    !Number.isFinite(input.origin.x) || !Number.isFinite(input.origin.y) ||
    !Number.isFinite(input.origin.elevationFeet ?? 0))
    return { status: 'unavailable', reason: 'invalid-map-scale' }
  const scenes = input.scenes.filter(scene => scene.mapId === input.map.id)
  const surveys = scenes.map(scene => scene.planarPortalSurvey).filter(validScenePortalSurvey)
  const covered = surveys.some(survey => Math.hypot(
    (input.origin.x - survey.centerX) * scale,
    (input.origin.y - survey.centerY) * scale,
    (input.origin.elevationFeet ?? 0) - survey.elevationFeet,
  ) + input.rangeFeet <= survey.radiusFeet)
  if (!covered) return { status: 'unavailable', reason: 'incomplete-survey' }
  let nearest: { distanceFeet: number; bearingDegrees: number; elevationDegrees: number } | undefined
  let unknownDistance = Infinity
  const consider = (dxFeet: number, dyFeet: number, heightFeet: number, relation: 'same' | 'different' | 'unknown') => {
    const horizontalFeet = Math.hypot(dxFeet, dyFeet)
    const distanceFeet = Math.hypot(horizontalFeet, heightFeet)
    if (!Number.isFinite(distanceFeet) || distanceFeet > input.rangeFeet) return
    if (relation === 'unknown') { unknownDistance = Math.min(unknownDistance, distanceFeet); return }
    if (relation !== 'different' || (nearest && nearest.distanceFeet <= distanceFeet)) return
    nearest = { distanceFeet, bearingDegrees: (Math.atan2(dxFeet, -dyFeet) * 180 / Math.PI + 360) % 360,
      elevationDegrees: Math.atan2(heightFeet, horizontalFeet) * 180 / Math.PI }
  }
  for (const survey of surveys) {
    for (const portal of survey.externalPortals) {
      if (!portal.enabled) continue
      consider((survey.centerX - input.origin.x) * scale + portal.eastFeet,
        (survey.centerY - input.origin.y) * scale - portal.northFeet,
        portal.elevationFeet - (input.origin.elevationFeet ?? 0),
        dnd5eMapPlaneRelation(input.map, { id: `${input.map.id}:external-destination`, dnd5ePlane: portal.destinationPlane }))
    }
  }
  for (const scene of scenes) {
    for (const trigger of scene.triggers) {
      if (!trigger.enabled) continue
      // The region's center is the portal's authored position, not its exit.
      const x = trigger.region.x + (trigger.region.kind === 'rect' ? trigger.region.width / 2 : 0)
      const y = trigger.region.y + (trigger.region.kind === 'rect' ? trigger.region.height / 2 : 0)
      const dx = x - input.origin.x, dy = y - input.origin.y
      const horizontalFeet = Math.hypot(dx, dy) * scale
      if (!Number.isFinite(horizontalFeet) || horizontalFeet > input.rangeFeet) continue
      for (const action of trigger.actions) {
        if (action.kind !== 'teleport' || !action.enabled || action.isPortal !== true) continue
        const heightFeet = (action.portalElevationFeet ?? 0) - (input.origin.elevationFeet ?? 0)
        const destination = input.maps.find(map => map.id === action.targetMapId)
        const relation = destination ? dnd5eMapPlaneRelation(input.map, destination) : 'unknown'
        consider(dx * scale, dy * scale, heightFeet, relation)
      }
    }
  }
  if (unknownDistance <= (nearest?.distanceFeet ?? Infinity) && Number.isFinite(unknownDistance))
    return { status: 'unavailable', reason: 'unknown-destination-plane' }
  return nearest ? { status: 'found', ...nearest } : { status: 'none' }
}
