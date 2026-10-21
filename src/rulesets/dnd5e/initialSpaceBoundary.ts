/** Host-captured occupied volume. It never follows either the bearer or caster. */
export interface Dnd5eInitialSpaceBoundary {
  mapId: string
  x: number
  y: number
  halfWidthUnits: number
  bottomFeet: number
  topFeet: number
}

export function normalizeDnd5eInitialSpaceBoundary(value: unknown): Dnd5eInitialSpaceBoundary | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some(key => !['mapId', 'x', 'y', 'halfWidthUnits', 'bottomFeet', 'topFeet'].includes(key)) ||
    typeof raw.mapId !== 'string' || raw.mapId.trim().length < 1 || raw.mapId.length > 256 ||
    !['x', 'y', 'halfWidthUnits', 'bottomFeet', 'topFeet'].every(key => typeof raw[key] === 'number' && Number.isFinite(raw[key])) ||
    Number(raw.halfWidthUnits) <= 0 || Number(raw.topFeet) <= Number(raw.bottomFeet)) return undefined
  return { mapId: raw.mapId, x: Number(raw.x), y: Number(raw.y), halfWidthUnits: Number(raw.halfWidthUnits),
    bottomFeet: Number(raw.bottomFeet), topFeet: Number(raw.topFeet) }
}

export function dnd5eInitialSpaceContainsPoint(boundary: Dnd5eInitialSpaceBoundary, point: {
  mapId: string; x: number; y: number; elevationFeet: number
}): boolean {
  return boundary.mapId === point.mapId && [point.x, point.y, point.elevationFeet].every(Number.isFinite) &&
    Math.abs(point.x - boundary.x) <= boundary.halfWidthUnits + 1e-6 &&
    Math.abs(point.y - boundary.y) <= boundary.halfWidthUnits + 1e-6 &&
    point.elevationFeet >= boundary.bottomFeet - 1e-6 && point.elevationFeet <= boundary.topFeet + 1e-6
}

/** Full occupancy is required for movement; checking only the center misses partial crossings. */
export function dnd5eInitialSpaceContainsVolume(boundary: Dnd5eInitialSpaceBoundary,
  volume: Dnd5eInitialSpaceBoundary): boolean {
  return [-1, 1].every(dx => [-1, 1].every(dy => [volume.bottomFeet, volume.topFeet].every(elevationFeet =>
    dnd5eInitialSpaceContainsPoint(boundary, { mapId: volume.mapId,
      x: volume.x + dx * volume.halfWidthUnits, y: volume.y + dy * volume.halfWidthUnits, elevationFeet }))))
}
