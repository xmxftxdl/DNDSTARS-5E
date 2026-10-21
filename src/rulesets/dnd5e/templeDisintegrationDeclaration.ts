export interface Dnd5eTempleDisintegrationDeclaration {
  schemaVersion: 1
  entityId: string
  point: { x: number; y: number; elevationFeet: number }
}

/** A player declares a target only; never accepts geometry, effects, range or costs. */
export function normalizeDnd5eTempleDisintegrationDeclaration(value: unknown): Dnd5eTempleDisintegrationDeclaration | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const item = value as Record<string, unknown>
  if (Object.keys(item).some(key => !['schemaVersion','entityId','point'].includes(key)) || item.schemaVersion !== 1 ||
    typeof item.entityId !== 'string' || !item.entityId || item.entityId.length > 160 || item.entityId.trim() !== item.entityId ||
    !item.point || typeof item.point !== 'object' || Array.isArray(item.point)) return undefined
  const point = item.point as Record<string, unknown>
  if (Object.keys(point).some(key => !['x','y','elevationFeet'].includes(key)) ||
    !['x','y','elevationFeet'].every(key => typeof point[key] === 'number' && Number.isFinite(point[key]))) return undefined
  return { schemaVersion: 1, entityId: item.entityId, point: { x: point.x as number, y: point.y as number, elevationFeet: point.elevationFeet as number } }
}
