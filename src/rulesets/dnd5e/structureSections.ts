import { normalizeDnd5eMapObjectCombatProfile, type Dnd5eMapObjectCombatProfile } from './mapObjectCombatProfile'

/** Feet in a blueprint's local coordinate system, before map placement. */
export interface Dnd5eStructureWallV1 {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  bottomFeet: number
  heightFeet: number
  thicknessInches: number
}

export interface Dnd5eStructureSectionV1 extends Dnd5eStructureWallV1 {
  wallId: string
  maxHp: number
  combatProfile: Dnd5eMapObjectCombatProfile
}

export interface Dnd5eStructureSectionPolicyV1 {
  widthFeet: number
  heightFeet: number
  hitPointsPerInch: number
  combatProfile: Dnd5eMapObjectCombatProfile
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const positive = (value: unknown): value is number => finite(value) && value > 0
const point = (value: unknown): value is { x: number; y: number } => !!value && typeof value === 'object' &&
  finite((value as { x?: unknown }).x) && finite((value as { y?: unknown }).y)

/** All validation precedes output. No map or imported blueprint is mutated. */
export function buildDnd5eStructureSections(
  walls: readonly Dnd5eStructureWallV1[], policy: Dnd5eStructureSectionPolicyV1,
): Dnd5eStructureSectionV1[] {
  const profile = normalizeDnd5eMapObjectCombatProfile(policy?.combatProfile)
  if (!profile || !positive(policy.widthFeet) || !positive(policy.heightFeet) ||
    !positive(policy.hitPointsPerInch) || !Array.isArray(walls) || !walls.length || walls.length > 4096) {
    throw new Error('structure-section-policy-invalid')
  }
  const ids = new Set<string>()
  let total = 0
  const plans = walls.map(wall => {
    if (!wall || typeof wall.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,95}$/.test(wall.id) || ids.has(wall.id) ||
      !point(wall.from) || !point(wall.to) || !finite(wall.bottomFeet) ||
      !positive(wall.heightFeet) || !positive(wall.thicknessInches)) throw new Error('structure-wall-invalid')
    ids.add(wall.id)
    const length = Math.hypot(wall.to.x - wall.from.x, wall.to.y - wall.from.y)
    if (!positive(length)) throw new Error('structure-wall-invalid')
    const columns = Math.ceil(length / policy.widthFeet - 1e-9)
    const rows = Math.ceil(wall.heightFeet / policy.heightFeet - 1e-9)
    const hp = wall.thicknessInches * policy.hitPointsPerInch
    total += columns * rows
    if (columns < 1 || rows < 1 || !Number.isSafeInteger(total) || total > 16384 ||
      !Number.isSafeInteger(hp) || hp < 1 || hp > 1_000_000) throw new Error('structure-section-budget-invalid')
    return { wall, length, columns, rows, hp }
  })
  return plans.flatMap(({ wall, length, columns, rows, hp }) => {
    const sections: Dnd5eStructureSectionV1[] = []
    const at = (distance: number) => ({
      x: wall.from.x + (wall.to.x - wall.from.x) * distance / length,
      y: wall.from.y + (wall.to.y - wall.from.y) * distance / length,
    })
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      sections.push({
        id: `${wall.id}.${row}.${column}`, wallId: wall.id,
        from: at(column * policy.widthFeet), to: at(Math.min(length, (column + 1) * policy.widthFeet)),
        bottomFeet: wall.bottomFeet + row * policy.heightFeet,
        heightFeet: Math.min(policy.heightFeet, wall.heightFeet - row * policy.heightFeet),
        thicknessInches: wall.thicknessInches, maxHp: hp,
        combatProfile: { ...profile,
          ...(profile.damageImmunities ? { damageImmunities: [...profile.damageImmunities] } : {}),
          ...(profile.damageResistances ? { damageResistances: [...profile.damageResistances] } : {}),
          ...(profile.damageVulnerabilities ? { damageVulnerabilities: [...profile.damageVulnerabilities] } : {}),
        },
      })
    }
    return sections
  })
}
