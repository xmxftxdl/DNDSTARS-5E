import { describe, expect, it } from 'vitest'
import {
  dnd5eCombatantClassLevel,
  dnd5eCombatantHasSubclass,
  dnd5eCombatantPairKey,
  dnd5eDirectedCombatantPairKey,
} from './headlessCombatPrimitives'

describe('Headless combat primitives', () => {
  it('reads primary and multiclass levels with bounded values', () => {
    expect(dnd5eCombatantClassLevel({ classId: 'fighter', level: 5 }, 'fighter')).toBe(5)
    expect(dnd5eCombatantClassLevel({
      classId: 'fighter',
      level: 5,
      classLevels: { fighter: 4, wizard: 21 },
    }, 'wizard')).toBe(20)
    expect(dnd5eCombatantClassLevel({ classId: 'fighter', level: 5 }, 'wizard')).toBe(0)
  })

  it('resolves subclasses from the matching class slot', () => {
    expect(dnd5eCombatantHasSubclass({
      classId: 'fighter',
      subclassId: 'champion',
    }, 'fighter', 'champion')).toBe(true)
    expect(dnd5eCombatantHasSubclass({
      classId: 'fighter',
      subclassId: 'champion',
      subclassIds: { wizard: 'evocation' },
    }, 'wizard', 'evocation')).toBe(true)
  })

  it('uses symmetric and directional relationship keys deliberately', () => {
    expect(dnd5eCombatantPairKey('b', 'a')).toBe(dnd5eCombatantPairKey('a', 'b'))
    expect(dnd5eDirectedCombatantPairKey('b', 'a')).not.toBe(dnd5eDirectedCombatantPairKey('a', 'b'))
  })
})
