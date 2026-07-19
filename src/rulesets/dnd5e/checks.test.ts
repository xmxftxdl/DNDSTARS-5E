import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  dnd5eAbilityCheckMode,
  dnd5eAbilityCheckModifier,
  dnd5eSkillCheckModifier,
  dnd5eSkillCheckProficiencyRank,
  resolveDnd5eAbilityCheck,
  resolveDnd5eInitiative,
} from './checks'

function character(patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'hero', name: '英雄', player: '', avatar: '', accent: '',
    race: '人类', charClass: '战士', level: 1, background: '', experience: 0, reputation: 0,
    abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '1d8', ac: 10, speed: 30, initiativeBonus: 0,
    saveDC: 10, passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

describe('SRD 5.1 ability checks', () => {
  it('applies Jack of All Trades and Remarkable Athlete only to unproficient checks', () => {
    const bard = character({ charClass: '吟游诗人', level: 5 })
    const champion = character({
      charClass: '战士', level: 7,
      dnd5eClassChoices: { fighter: { subclass: 'champion', fightingStyles: ['defense'] } },
    })
    expect(dnd5eAbilityCheckModifier(bard, 'dex')).toBe(3) // DEX +2, half PB +1
    expect(dnd5eAbilityCheckModifier(bard, 'dex', 1)).toBe(5)
    expect(dnd5eAbilityCheckModifier(champion, 'dex')).toBe(4) // DEX +2, half PB rounded up +2
  })

  it('derives skill proficiency, Expertise, and Lore bonus proficiencies from class choices', () => {
    const bard = character({
      charClass: '吟游诗人', level: 5, abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 16 },
      skills: ['performance'],
      dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: {
        expertise: ['performance'],
        'lore-bonus-skills': ['stealth'],
      } } } },
    })
    expect(dnd5eSkillCheckProficiencyRank(bard, 'performance')).toBe(2)
    expect(dnd5eSkillCheckModifier(bard, 'performance')).toBe(9)
    expect(dnd5eSkillCheckProficiencyRank(bard, 'stealth')).toBe(1)
    expect(dnd5eSkillCheckModifier(bard, 'stealth')).toBe(5)
  })

  it('grants Deception and Persuasion proficiency through Beguiling Influence', () => {
    const warlock = character({
      charClass: '邪术师', level: 2,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
      dnd5eClassChoices: { classes: { warlock: { selections: {
        'eldritch-invocations': ['beguiling-influence'],
      } } } },
    })
    expect(dnd5eSkillCheckProficiencyRank(warlock, 'deception')).toBe(1)
    expect(dnd5eSkillCheckModifier(warlock, 'persuasion')).toBe(5)
    expect(dnd5eSkillCheckProficiencyRank(warlock, 'intimidation')).toBe(0)
  })

  it('applies Reliable Talent before resolving a proficient Rogue check', () => {
    const rogue = character({
      charClass: '游荡者', level: 11, abilities: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
      skills: ['stealth'],
      dnd5eClassChoices: { classes: { rogue: { subclass: 'thief', selections: { expertise: ['stealth'] } } } },
    })
    const result = resolveDnd5eAbilityCheck({ character: rogue, ability: 'dex', rolls: [4], proficiencyRank: 2 })
    expect(result.roll.d20).toBe(10)
    expect(result.roll.total).toBe(22)
    expect(result.reliableTalentApplied).toBe(true)
  })

  it('resolves Feral Instinct advantage and cancels it against exhaustion disadvantage', () => {
    const barbarian = character({ charClass: '野蛮人', level: 7 })
    expect(dnd5eAbilityCheckMode(barbarian, { initiative: true })).toBe('advantage')
    expect(resolveDnd5eInitiative({ character: barbarian, rolls: [4, 17] }).roll.total).toBe(19)
    const exhausted = { ...barbarian, exhaustionLevel: 1 }
    expect(dnd5eAbilityCheckMode(exhausted, { initiative: true })).toBe('normal')
    expect(resolveDnd5eInitiative({ character: exhausted, rolls: [9] }).roll.total).toBe(11)
  })

  it('uses the Strength score as the minimum total for Indomitable Might', () => {
    const barbarian = character({
      charClass: '野蛮人', level: 18,
      abilities: { str: 20, dex: 10, con: 18, int: 8, wis: 10, cha: 8 },
    })
    const result = resolveDnd5eAbilityCheck({ character: barbarian, ability: 'str', rolls: [2] })
    expect(result.roll.total).toBe(20)
    expect(result.indomitableMightApplied).toBe(true)
    expect(resolveDnd5eAbilityCheck({ character: barbarian, ability: 'dex', rolls: [2] }).indomitableMightApplied).toBe(false)
  })
})
