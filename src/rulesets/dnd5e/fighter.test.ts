import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  fighterActionSurgeUses,
  fighterAttacksPerAttackAction,
  fighterFeaturesAtLevel,
  fighterFightingStyleSelectionLimit,
  fighterIndomitableUses,
  fighterManeuverSaveDc,
  fighterManeuversKnown,
  fighterProgression,
  fighterSelectedFightingStyles,
  fighterSelectedManeuvers,
  fighterSuperiorityDieSides,
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

  it('allows one fighting style except for a level 10+ Champion, who may select two', () => {
    const ordinary: Pick<Character, 'level' | 'dnd5eClassChoices'> = { level: 20, dnd5eClassChoices: { fighter: { subclass: 'battle-master', fightingStyles: ['defense', 'dueling'] } } }
    const champion: Pick<Character, 'level' | 'dnd5eClassChoices'> = { level: 10, dnd5eClassChoices: { fighter: { subclass: 'champion', fightingStyles: ['defense', 'dueling', 'archery'] } } }
    expect(fighterFightingStyleSelectionLimit(ordinary)).toBe(1)
    expect(fighterSelectedFightingStyles(ordinary)).toEqual(['defense'])
    expect(fighterFightingStyleSelectionLimit(champion)).toBe(2)
    expect(fighterSelectedFightingStyles(champion)).toEqual(['defense', 'dueling'])
  })

  it('scales Battle Master maneuver choices and superiority dice at 2014 levels', () => {
    expect([3, 7, 10, 15].map(fighterManeuversKnown)).toEqual([3, 5, 7, 9])
    expect([3, 10, 18].map(fighterSuperiorityDieSides)).toEqual([8, 10, 12])
    const battleMaster: Pick<Character, 'level' | 'abilities' | 'dnd5eClassChoices'> = {
      level: 7,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      dnd5eClassChoices: {
        fighter: {
          subclass: 'battle-master',
          maneuverAbility: 'str',
          maneuvers: ['trip-attack', 'riposte', 'parry', 'precision-attack', 'rally', 'pushing-attack'],
        },
      },
    }
    expect(fighterSelectedManeuvers(battleMaster)).toEqual(['trip-attack', 'riposte', 'parry', 'precision-attack', 'rally'])
    expect(fighterManeuverSaveDc(battleMaster)).toBe(14)
  })
})
