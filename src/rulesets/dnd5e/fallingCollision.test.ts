import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange } from './headlessCombatEngine'
import { fallingCollisionRollKey } from './fallingCollision'

function fixture(height = 40, fallerSize = 2, targetSize = 2) {
  const base = { name: 'unit', controller: 'dm' as const, initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 50, maxHp: 50,
    temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false }
  const flyer = createDnd5eCombatant({ ...base, id: 'flyer', sizeRank: fallerSize,
    elevationFeet: height, groundElevationFeet: 0, airborne: true, movementSpeeds: { walk: 30, fly: 60 } })
  const victim = createDnd5eCombatant({ ...base, id: 'victim', sizeRank: targetSize, position: { ...base.position } })
  const before = startDnd5eHeadlessCombat('fall', [flyer, victim])
  const after = structuredClone(before)
  after.combatants.flyer.movementSpeeds = { walk: 30 }
  return { before, after }
}
function resolve(d20: number, height = 40, fallerSize = 2, targetSize = 2) {
  const { before, after } = fixture(height, fallerSize, targetSize)
  return resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, {
    flyer: Array.from({ length: Math.floor(height / 10) }, () => 4),
    ...(fallerSize && targetSize ? { [fallingCollisionRollKey('flyer', 'victim')]: [d20] } : {}),
  })
}
describe('Tasha falling onto a creature', () => {
  it('preserves DM placement above ground for a creature without flight', () => {
    const { before, after } = fixture()
    before.combatants.flyer.movementSpeeds = { walk: 30 }
    before.combatants.flyer.elevationFeet = 0
    before.combatants.flyer.airborne = false
    expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after)).toEqual([])
    const result = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, {})
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.state.combatants.flyer).toMatchObject({ elevationFeet: 40, currentHp: 50 })
    const higher = structuredClone(after)
    higher.combatants.flyer.elevationFeet = 55
    expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(after, higher)).toEqual([])
  })

  it('previews the ground target and requires its D20 before committing', () => {
    const { before, after } = fixture()
    expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after)[0].collision)
      .toMatchObject({ targetId: 'victim', mode: 'normal', modifier: 0 })
    const result = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, { flyer: [4, 4, 4, 4] })
    expect(result.ok).toBe(false)
    expect(result.state).toBe(before)
    expect(before.combatants.flyer.currentHp).toBe(50)
  })
  it('splits one damage pool and knocks both creatures prone on a failed DC 15 save', () => {
    const result = resolve(14)
    expect(result.ok).toBe(true)
    expect(result.state.combatants.flyer.currentHp).toBe(42)
    expect(result.state.combatants.victim.currentHp).toBe(42)
    expect(result.state.combatants.flyer.conditions).toContain('prone')
    expect(result.state.combatants.victim.conditions).toContain('prone')
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'falling-collision-resolved', success: false, damage: 8 }))
  })
  it('leaves the ground creature unharmed on a successful save', () => {
    const result = resolve(15)
    expect(result.ok).toBe(true)
    expect(result.state.combatants.flyer.currentHp).toBe(34)
    expect(result.state.combatants.victim.currentHp).toBe(50)
    expect(result.state.combatants.victim.conditions).not.toContain('prone')
  })
  it.each([[0, 2], [2, 0]])('excludes Tiny creatures (%s, %s)', (a, b) => {
    const result = resolve(1, 40, a, b)
    expect(result.ok).toBe(true)
    expect(result.state.combatants.victim.currentHp).toBe(50)
    expect(result.state.combatants.flyer.currentHp).toBe(34)
  })
  it('does not knock a creature two sizes larger prone', () => {
    const result = resolve(1, 40, 2, 4)
    expect(result.ok).toBe(true)
    expect(result.state.combatants.victim.currentHp).toBe(42)
    expect(result.state.combatants.victim.conditions).not.toContain('prone')
  })
  it('can knock the impacted creature prone even below 10 feet without damage', () => {
    const result = resolve(1, 5)
    expect(result.ok).toBe(true)
    expect(result.state.combatants.flyer.currentHp).toBe(50)
    expect(result.state.combatants.victim.currentHp).toBe(50)
    expect(result.state.combatants.victim.conditions).toContain('prone')
  })
  it('rounds each half down and applies individual resistance after splitting', () => {
    const { before, after } = fixture()
    after.combatants.victim.damageResistances = ['bludgeoning']
    const result = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, {
      flyer: [4, 4, 4, 3], [fallingCollisionRollKey('flyer', 'victim')]: [1],
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.flyer.currentHp).toBe(43)
    expect(result.state.combatants.victim.currentHp).toBe(47)
  })
  it('rejects stale collision dice after landing', () => {
    const result = resolve(1)
    const replay = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(result.state, result.state, {
      flyer: [4, 4, 4, 4], [fallingCollisionRollKey('flyer', 'victim')]: [1],
    })
    expect(replay.ok).toBe(false)
    expect(replay.state.combatants.victim.currentHp).toBe(42)
  })
  it('requires an explicit DM choice when the landing covers several creatures', () => {
    const { before, after } = fixture()
    before.combatants.second = { ...structuredClone(before.combatants.victim), id: 'second' }
    after.combatants.second = structuredClone(before.combatants.second)
    const preview = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after)[0]
    expect(preview.collision).toBeUndefined()
    expect(preview.collisionCandidates?.map(item => item.targetId)).toEqual(['second', 'victim'])
    expect(resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, { flyer: [4, 4, 4, 4] }).ok).toBe(false)
    const selected = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, {
      flyer: [4, 4, 4, 4], [fallingCollisionRollKey('flyer', 'second')]: [1],
    })
    expect(selected.ok).toBe(true)
    expect(selected.state.combatants.second.currentHp).toBe(42)
    expect(selected.state.combatants.victim.currentHp).toBe(50)
    expect(resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, {
      flyer: [4, 4, 4, 4], [fallingCollisionRollKey('flyer', 'second')]: [1],
      [fallingCollisionRollKey('flyer', 'victim')]: [1],
    }).ok).toBe(false)
  })
  it('uses map coordinate scaling and only intersecting footprints', () => {
    const { before, after } = fixture()
    before.coordinateUnitsPerFoot = after.coordinateUnitsPerFoot = 4
    before.combatants.victim.position.x = after.combatants.victim.position.x = 19
    expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after)[0].collision?.targetId).toBe('victim')
    before.combatants.victim.position.x = after.combatants.victim.position.x = 20
    expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after)[0].collision).toBeUndefined()
  })
  it('adds the target saving throw bonus rather than treating a natural 1 as automatic failure', () => {
    const { before, after } = fixture()
    after.combatants.victim.savingThrowBonuses.dex = 14
    const result = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, {
      flyer: [4, 4, 4, 4], [fallingCollisionRollKey('flyer', 'victim')]: [1],
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.victim.currentHp).toBe(50)
    expect(result.state.combatants.flyer.currentHp).toBe(34)
  })
})
