import { describe, expect, it } from 'vitest'
import { dnd5eUnderwaterWeaponAttack } from './environmentRules'

describe('D&D 5e environmental combat', () => {
  it('applies underwater melee exceptions and swimming speed', () => {
    expect(dnd5eUnderwaterWeaponAttack({ environment: 'underwater', weaponId: 'dnd5e-longsword', mode: 'melee', distanceFeet: 5 })).toMatchObject({ disadvantage: true })
    expect(dnd5eUnderwaterWeaponAttack({ environment: 'underwater', weaponId: 'dnd5e-dagger', mode: 'melee', distanceFeet: 5 })).toMatchObject({ disadvantage: false })
    expect(dnd5eUnderwaterWeaponAttack({ environment: 'underwater', weaponId: 'dnd5e-longsword', mode: 'melee', distanceFeet: 5, hasSwimmingSpeed: true })).toMatchObject({ disadvantage: false })
  })

  it('automatically misses ranged attacks beyond normal range underwater', () => {
    expect(dnd5eUnderwaterWeaponAttack({ environment: 'underwater', weaponId: 'dnd5e-longbow', mode: 'ranged', distanceFeet: 200, normalRangeFeet: 150 })).toEqual({ automaticMiss: true, disadvantage: false })
    expect(dnd5eUnderwaterWeaponAttack({ environment: 'underwater', weaponId: 'dnd5e-light-crossbow', mode: 'ranged', distanceFeet: 60, normalRangeFeet: 80 })).toEqual({ automaticMiss: false, disadvantage: false })
  })
})

