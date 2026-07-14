import { describe, expect, it } from 'vitest'
import {
  fighterActionSurgeUses,
  fighterAttacksPerAttackAction,
  fighterFeaturesAtLevel,
  fighterIndomitableUses,
  fighterProgression,
} from './fighter'

describe('D&D 5e 2014 fighter progression', () => {
  it('covers every level from 1 through 20', () => {
    const progression = fighterProgression('champion')
    expect(progression).toHaveLength(20)
    expect(progression.map((entry) => entry.level)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
    expect(progression.every((entry) => entry.features.length > 0)).toBe(true)
    expect(progression[0].features.map((feature) => feature.name)).toEqual(['战斗风格', '回气'])
    expect(progression[19].features.map((feature) => feature.name)).toEqual(['额外攻击（4次）'])
  })

  it('scales attacks, Action Surge, and Indomitable at their 2014 levels', () => {
    expect([1, 5, 11, 20].map(fighterAttacksPerAttackAction)).toEqual([1, 2, 3, 4])
    expect([1, 2, 16, 17].map(fighterActionSurgeUses)).toEqual([0, 1, 1, 2])
    expect([8, 9, 13, 17].map(fighterIndomitableUses)).toEqual([0, 1, 2, 3])
  })

  it('uses subclass features at levels 3, 7, 10, 15, and 18', () => {
    expect(fighterFeaturesAtLevel(3, 'champion').map((feature) => feature.name)).toContain('精通重击')
    expect(fighterFeaturesAtLevel(7, 'battle-master').map((feature) => feature.name)).toContain('知己知彼')
    expect(fighterFeaturesAtLevel(10, 'eldritch-knight').map((feature) => feature.name)).toContain('奥法打击')
    expect(fighterFeaturesAtLevel(15, 'champion').map((feature) => feature.name)).toContain('卓越重击')
    expect(fighterFeaturesAtLevel(18, 'battle-master').map((feature) => feature.name)).toContain('精通战斗卓越（d12）')
  })

  it('keeps generic archetype milestones until a subclass is selected', () => {
    expect(fighterFeaturesAtLevel(7).map((feature) => feature.name)).toEqual(['武术范型特性'])
    expect(fighterFeaturesAtLevel(10).map((feature) => feature.name)).toEqual(['武术范型特性'])
  })
})
