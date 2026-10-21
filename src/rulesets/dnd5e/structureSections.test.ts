import { expect, it } from 'vitest'
import { buildDnd5eStructureSections, type Dnd5eStructureWallV1, type Dnd5eStructureSectionPolicyV1 } from './structureSections'
import { dnd5eAttackableMapObject } from './mapObjectCombatProfile'

const policy: Dnd5eStructureSectionPolicyV1 = { widthFeet: 10, heightFeet: 10, hitPointsPerInch: 30,
  combatProfile: { armorClass: 15, damageImmunities: ['poison', 'psychic'] } }
const wall: Dnd5eStructureWallV1 = { id: 'outer-north', from: { x: 20, y: 0 }, to: { x: 100, y: 0 },
  bottomFeet: 0, heightFeet: 20, thicknessInches: 12 }

it('keeps each vertical stone section independently attackable with thickness-based HP', () => {
  const input = JSON.stringify({ wall, policy })
  const sections = buildDnd5eStructureSections([wall], policy)
  expect(sections).toHaveLength(16)
  expect(new Set(sections.map(section => section.id)).size).toBe(16)
  expect(sections[0]).toMatchObject({ from: { x: 20, y: 0 }, to: { x: 30, y: 0 }, bottomFeet: 0, heightFeet: 10, maxHp: 360 })
  expect(sections.at(-1)).toMatchObject({ from: { x: 90, y: 0 }, to: { x: 100, y: 0 }, bottomFeet: 10, heightFeet: 10 })
  const profile = dnd5eAttackableMapObject({ type: 'obstacle', hp: sections[0].maxHp, maxHp: sections[0].maxHp,
    dnd5eObjectState: { combatProfile: sections[0].combatProfile } })
  expect(profile).toMatchObject({ armorClass: 15, currentHp: 360, damageImmunities: ['poison', 'psychic'] })
  expect(buildDnd5eStructureSections([{ ...wall, thicknessInches: 6 }], policy)[0].maxHp).toBe(180)
  expect(JSON.stringify({ wall, policy })).toBe(input)
})

it('handles rotated walls and short final sections without extending the building footprint', () => {
  const sections = buildDnd5eStructureSections([{ ...wall, from: { x: 5, y: 5 }, to: { x: 14, y: 17 }, heightFeet: 15, bottomFeet: 10 }], policy)
  expect(sections).toHaveLength(4)
  expect(sections[0].to).toEqual({ x: 11, y: 13 })
  expect(sections.at(-1)).toMatchObject({ to: { x: 14, y: 17 }, bottomFeet: 20, heightFeet: 5 })
})

it('rejects missing thickness, duplicate ids, impossible dimensions and excessive section budgets', () => {
  for (const patch of [{ thicknessInches: undefined }, { heightFeet: NaN }, { thicknessInches: -1 }, { to: wall.from }, { heightFeet: 1e9 }]) {
    expect(() => buildDnd5eStructureSections([{ ...wall, ...patch } as Dnd5eStructureWallV1], policy)).toThrow()
  }
  expect(() => buildDnd5eStructureSections([wall, wall], policy)).toThrow()
  expect(() => buildDnd5eStructureSections([wall], { ...policy, widthFeet: 0 })).toThrow()
})
