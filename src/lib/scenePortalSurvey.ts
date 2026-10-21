/** DM-authored, map-relative coverage, including portals outside the battle map. */
export interface ScenePortalSurvey {
  centerX: number
  centerY: number
  elevationFeet: number
  radiusFeet: number
  externalPortals: Array<{
    eastFeet: number
    northFeet: number
    elevationFeet: number
    destinationPlane: string
    enabled: boolean
  }>
}

export function validScenePortalSurvey(value: unknown): value is ScenePortalSurvey {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as ScenePortalSurvey
  return [v.centerX, v.centerY, v.elevationFeet, v.radiusFeet].every(n => typeof n === 'number' && Number.isFinite(n)) &&
    v.radiusFeet > 0 && v.radiusFeet <= 1_000_000 && Array.isArray(v.externalPortals) && v.externalPortals.length <= 100 &&
    v.externalPortals.every(p => !!p && typeof p === 'object' &&
      [p.eastFeet, p.northFeet, p.elevationFeet].every(n => typeof n === 'number' && Number.isFinite(n)) &&
      typeof p.enabled === 'boolean' && typeof p.destinationPlane === 'string' &&
      p.destinationPlane.trim().length > 0 && p.destinationPlane.length <= 120 &&
      !/[\u0000-\u001f\u007f]/.test(p.destinationPlane))
}
