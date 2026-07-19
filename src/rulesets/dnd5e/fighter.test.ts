import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  FIGHTER_FIGHTING_STYLE_OPTIONS,
  fighterActionSurgeUses,
  fighterAttacksPerAttackAction,
  fighterFeaturesAtLevel,
  fighterFightingStyleSelectionLimit,
  fighterIndomitableUses,
  fighterProgression,
  fighterSelectedFightingStyles,
  fighterRemarkableAthleteBonus,
  fighterRemarkableAthleteRunningLongJumpBonus,
  fighterSurvivorHealing,
  registeredFighterSubclasses,
} from './fighter'

function fighter(patch: Partial<Character> = {}): Character {
  return {
    id: 'fighter', name: '战士', player: '', avatar: '', accent: '', race: '人类', charClass: '战士', level: 1,
    background: '侍僧', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 12, currentHp: 12, tempHp: 0, hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 0,
    saveDC: 10, passivePerception: 10, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

describe('D&D 5e 2014 SRD fighter progression', () => {
  it('covers every level from 1 through 20', () => {
    const progression = fighterProgression('champion')
    expect(progression).toHaveLength(20)
    expect(progression.map((entry) => entry.level)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
    expect(progression.every((entry) => entry.features.length > 0)).toBe(true)
    expect(progression[0].features.map((feature) => feature.name)).toEqual(['战斗风格', '回气'])
    expect(progression[19].features.map((feature) => feature.name)).toEqual(['额外攻击（3）'])
  })

  it('calculates the Champion level 7 and level 18 mechanics', () => {
    const champion = fighter({
      level: 18,
      currentHp: 40,
      maxHp: 100,
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      dnd5eClassChoices: { fighter: { subclass: 'champion', fightingStyles: ['defense'] } },
    })
    expect(fighterRemarkableAthleteBonus(champion, 'str', false)).toBe(3)
    expect(fighterRemarkableAthleteBonus(champion, 'str', true)).toBe(0)
    expect(fighterRemarkableAthleteBonus(champion, 'wis', false)).toBe(0)
    expect(fighterRemarkableAthleteRunningLongJumpBonus(champion)).toBe(3)
    expect(fighterSurvivorHealing(champion)).toBe(7)
    expect(fighterSurvivorHealing({ ...champion, currentHp: 51 })).toBe(0)
    expect(fighterSurvivorHealing({ ...champion, currentHp: 0 })).toBe(0)
  })

  it('scales attacks, Action Surge, and Indomitable at their 2014 levels', () => {
    expect([1, 5, 11, 20].map(fighterAttacksPerAttackAction)).toEqual([1, 2, 3, 4])
    expect([1, 2, 16, 17].map(fighterActionSurgeUses)).toEqual([0, 1, 1, 2])
    expect([8, 9, 13, 17].map(fighterIndomitableUses)).toEqual([0, 1, 2, 3])
  })

  it('bundles only the Champion martial archetype from SRD 5.1', () => {
    expect(registeredFighterSubclasses().map((subclass) => subclass.id)).toEqual(['champion'])
    expect(registeredFighterSubclasses()[0].rulesTextSource).toBe('srd-5.1-translation')
    expect(fighterFeaturesAtLevel(3, 'champion').map((feature) => feature.name)).toContain('精通重击')
    expect(fighterFeaturesAtLevel(15, 'champion').map((feature) => feature.name)).toContain('卓越重击')
    const championFeatures = fighterProgression('champion')
      .flatMap((entry) => entry.features)
      .filter((feature) => feature.source === 'champion')
    expect(championFeatures.map((feature) => feature.name)).toEqual([
      '精通重击',
      '运动健将',
      '额外战斗风格',
      '卓越重击',
      '生存者',
    ])
  })

  it('keeps generic archetype milestones until an installed subclass is selected', () => {
    expect(fighterFeaturesAtLevel(7).map((feature) => feature.name)).toEqual(['武术范型特性'])
    expect(fighterFeaturesAtLevel(10, 'missing.plugin:subclass').map((feature) => feature.name)).toEqual(['武术范型特性'])
  })

  it('allows one fighting style except for a level 10+ Champion, who may select two', () => {
    const ordinary = fighter({ level: 20, dnd5eClassChoices: { fighter: { fightingStyles: ['defense', 'dueling'] } } })
    const champion = fighter({ level: 10, dnd5eClassChoices: { fighter: { subclass: 'champion', fightingStyles: ['defense', 'dueling', 'archery'] } } })
    expect(fighterFightingStyleSelectionLimit(ordinary)).toBe(1)
    expect(fighterSelectedFightingStyles(ordinary)).toEqual(['defense'])
    expect(fighterFightingStyleSelectionLimit(champion)).toBe(2)
    expect(fighterSelectedFightingStyles(champion)).toEqual(['defense', 'dueling'])
  })

  it('keeps the complete SRD 5.1 fighting-style conditions in the Chinese summaries', () => {
    const style = (id: string) => FIGHTER_FIGHTING_STYLE_OPTIONS.find((option) => option.id === id)?.summary ?? ''
    expect(style('great-weapon-fighting')).toContain('必须采用新结果')
    expect(style('great-weapon-fighting')).toContain('双手或两用属性')
    expect(style('protection')).toContain('距你 5 尺内')
    expect(style('protection')).toContain('反应')
    expect(style('protection')).toContain('劣势')
    expect(style('two-weapon-fighting')).toContain('属性调整值')
  })
})
