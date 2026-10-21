/** Host-owned planar dimensions; orientation is independent of the caster's later position. */
export interface Dnd5ePersistentRectGeometry {
  widthFeet: number
  lengthFeet: number
  direction: { dc: number; dr: number }
  gridAligned: boolean
  /** Rotation about the center: pitch raises the length axis; roll rotates its cross-section. */
  pitchDegrees?: number
  rollDegrees?: number
}

export function normalizeDnd5ePersistentRectGeometry(value: unknown): Dnd5ePersistentRectGeometry | undefined {
  if (!value || typeof value !== 'object') return undefined
  const geometry = value as Partial<Dnd5ePersistentRectGeometry>
  const { widthFeet, lengthFeet, direction, gridAligned } = geometry
  if (typeof widthFeet !== 'number' || !Number.isFinite(widthFeet) || widthFeet <= 0 || widthFeet > 10000 ||
      typeof lengthFeet !== 'number' || !Number.isFinite(lengthFeet) || lengthFeet <= 0 || lengthFeet > 10000 ||
      typeof gridAligned !== 'boolean' || !direction ||
      !Number.isFinite(direction.dc) || !Number.isFinite(direction.dr)) return undefined
  const magnitude = Math.hypot(direction.dc, direction.dr)
  if (magnitude < 1e-9 || Math.abs(magnitude - 1) > 1e-6) return undefined
  for (const angle of [geometry.pitchDegrees, geometry.rollDegrees]) {
    if (angle != null && (typeof angle !== 'number' || !Number.isFinite(angle) || angle < -180 || angle > 180 || gridAligned)) return undefined
  }
  return { widthFeet, lengthFeet, gridAligned, direction: { dc: direction.dc / magnitude, dr: direction.dr / magnitude },
    ...(geometry.pitchDegrees != null ? {pitchDegrees:geometry.pitchDegrees} : {}),
    ...(geometry.rollDegrees != null ? {rollDegrees:geometry.rollDegrees} : {}) }
}
