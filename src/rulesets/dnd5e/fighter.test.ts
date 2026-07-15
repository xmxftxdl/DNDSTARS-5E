import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  FIGHTER_FIGHTING_STYLE_OPTIONS,
  FIGHTER_MANEUVER_OPTIONS,
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
  fighterSuperiorityDiceMax,
} from './fighter'

describe('D&D 5e 2014 fighter progression', () => {
  it('covers every level from 1 through 20', () => {
    const progression = fighterProgression('champion')
    expect(progression).toHaveLength(20)
    expect(progression.map((entry) => entry.level)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
    expect(progression.every((entry) => entry.features.length > 0)).toBe(true)
    expect(progression[0].features.map((feature) => feature.name)).toEqual(['战斗风格', '回气'])
    expect(progression[19].features.map((feature) => feature.name)).toEqual(['额外攻击（3）'])
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
    expect(fighterFeaturesAtLevel(18, 'battle-master').map((feature) => feature.name)).toContain('精通卓越战技（d12）')
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
    expect([2, 3, 7, 15].map(fighterSuperiorityDiceMax)).toEqual([0, 4, 5, 6])
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

  it('keeps the complete 2014 fighting-style conditions in the Chinese summaries', () => {
    const style = (id: string) => FIGHTER_FIGHTING_STYLE_OPTIONS.find((option) => option.id === id)?.summary ?? ''
    expect(style('great-weapon-fighting')).toContain('必须采用新结果')
    expect(style('great-weapon-fighting')).toContain('双手或两用属性')
    expect(style('protection')).toContain('距你 5 尺内')
    expect(style('protection')).toContain('反应')
    expect(style('protection')).toContain('劣势')
    expect(style('two-weapon-fighting')).toContain('属性调整值')
  })

  it('includes all sixteen 2014 Battle Master maneuvers with their decisive limits', () => {
    const maneuver = (id: string) => FIGHTER_MANEUVER_OPTIONS.find((option) => option.id === id)?.summary ?? ''
    expect(FIGHTER_MANEUVER_OPTIONS).toHaveLength(16)
    expect(maneuver('commanders-strike')).toContain('放弃其中一次攻击')
    expect(maneuver('commanders-strike')).toContain('附赠动作')
    expect(maneuver('commanders-strike')).toContain('反应')
    expect(maneuver('precision-attack')).toContain('效果生效前')
    expect(maneuver('pushing-attack')).toContain('大型或更小')
    expect(maneuver('pushing-attack')).toContain('15 尺')
    expect(maneuver('sweeping-attack')).toContain('原攻击检定也能命中')
    expect(maneuver('trip-attack')).toContain('大型或更小')
  })

  it('does not mix Battle Master resource growth into other subclass feature effects', () => {
    const knowYourEnemy = fighterFeaturesAtLevel(7, 'battle-master').find((feature) => feature.id === 'battle-master-know-your-enemy')
    const relentless = fighterFeaturesAtLevel(15, 'battle-master').find((feature) => feature.id === 'battle-master-relentless')
    expect(knowYourEnemy?.description).toContain('至少 1 分钟')
    expect(knowYourEnemy?.description).not.toContain('卓越骰增至')
    expect(relentless?.description).toContain('没有可用的卓越骰')
    expect(relentless?.description).not.toContain('总数增至')
  })
})
