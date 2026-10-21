/** Conditions measured from the Effect's original source, not its bearer. */
export interface Dnd5eSourceProximityAttack {
  rangeFeet: number
  requiresMutualSight?: boolean
  requiresSourceSeeTarget?: boolean
}

export function validDnd5eSourceProximityAttack(value: unknown): value is Dnd5eSourceProximityAttack {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return Object.keys(v).every(key => ['rangeFeet', 'requiresMutualSight', 'requiresSourceSeeTarget'].includes(key)) &&
    typeof v.rangeFeet === 'number' && Number.isFinite(v.rangeFeet) && v.rangeFeet >= 0 && v.rangeFeet <= 10000 &&
    ['requiresMutualSight', 'requiresSourceSeeTarget'].every(key => v[key] === undefined || typeof v[key] === 'boolean')
}
