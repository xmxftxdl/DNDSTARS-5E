import { describe, expect, it } from 'vitest'
import {
  appendDnd5eRepeatedProjectileTarget,
  dnd5eRepeatedProjectileTargetsComplete,
  dnd5eRepeatedProjectileTargetsRemaining,
} from './spellProjectileTargeting'

describe('repeated spell projectile targeting', () => {
  it('allocates each Magic Missile dart independently and preserves duplicate targets', () => {
    const first = appendDnd5eRepeatedProjectileTarget({
      maximumTargets: 3,
      targetTokenIds: [],
    }, 'goblin-a')
    const second = appendDnd5eRepeatedProjectileTarget({
      maximumTargets: 3,
      targetTokenIds: first,
    }, 'goblin-a')
    const third = appendDnd5eRepeatedProjectileTarget({
      maximumTargets: 3,
      targetTokenIds: second,
    }, 'goblin-b')

    expect(third).toEqual(['goblin-a', 'goblin-a', 'goblin-b'])
    expect(dnd5eRepeatedProjectileTargetsComplete({
      maximumTargets: 3,
      targetTokenIds: third,
    })).toBe(true)
  })

  it('does not accept more projectiles than the spell grants', () => {
    expect(appendDnd5eRepeatedProjectileTarget({
      maximumTargets: 3,
      targetTokenIds: ['a', 'b', 'c'],
    }, 'd')).toEqual(['a', 'b', 'c'])
  })

  it('reports how many projectile targets still need to be chosen', () => {
    expect(dnd5eRepeatedProjectileTargetsRemaining({
      maximumTargets: 5,
      targetTokenIds: ['a', 'a'],
    })).toBe(3)
  })
})
