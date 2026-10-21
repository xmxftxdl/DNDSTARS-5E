export interface GeometryDurability { hitPoints: number; maxHitPoints: number; damageThreshold: number; armorClass?: number; damageImmunities?: readonly string[] }
export function normalizeGeometryDurability(value: unknown): GeometryDurability | undefined
export function geometryEntityDestroyed(entity: { dnd5eDurability?: unknown } | undefined): boolean
export function damageGeometryEntity(entity: { dnd5eDurability?: unknown } | undefined, amount: number, damageType?: string): { dnd5eDurability: GeometryDurability } | undefined
