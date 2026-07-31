import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { dnd5eCombatSpellDamagePreview } from './combatSpellDamagePresentation'

function wizard(patch: Partial<Character> = {}): Character {
  return {
    id: 'wizard',
    name: '新冒险者',
    player: '玩家',
    avatar: '🧙',
    accent: 'from-blue-600 to-violet-700',
    race: '人类',
    charClass: '法师',
    level: 5,
    background: '学者',
    experience: 0,
    reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'],
    skills: [],
    maxHp: 30,
    currentHp: 30,
    tempHp: 0,
    hitDice: '5d6',
    ac: 13,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 15,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    rulesetId: 'dnd5e-2014-srd-5.1',
    dnd5eClassLevels: { wizard: 5 },
    ...patch,
  }
}

describe('combat spell damage presentation', () => {
  it('writes Magic Missile as per-dart 1d4+1 and scales projectile count with the pinned slot', () => {
    expect(dnd5eCombatSpellDamagePreview(wizard(), 'wizard', 'magic-missile', 1))
      .toMatchObject({
        slotLevel: 1,
        summary: '3枚飞弹，每枚1d4+1力场伤害；合计3d4+3',
      })
    expect(dnd5eCombatSpellDamagePreview(wizard(), 'wizard', 'magic-missile', 3)?.summary)
      .toBe('5枚飞弹，每枚1d4+1力场伤害；合计5d4+5')
  })

  it('uses the selected slot when presenting ordinary upcast damage', () => {
    expect(dnd5eCombatSpellDamagePreview(wizard(), 'wizard', 'burning-hands', 1)?.summary)
      .toBe('3d6火焰伤害')
    expect(dnd5eCombatSpellDamagePreview(wizard(), 'wizard', 'burning-hands', 4)?.summary)
      .toBe('6d6火焰伤害')
  })

  it('uses sustained immediate-attack scaling and the casting modifier for Spiritual Weapon', () => {
    const cleric = wizard({
      id: 'cleric',
      name: '牧师',
      charClass: '牧师',
      level: 7,
      abilities: { str: 12, dex: 10, con: 14, int: 8, wis: 18, cha: 12 },
      dnd5eClassLevels: { cleric: 7 },
    })

    expect(dnd5eCombatSpellDamagePreview(cleric, 'cleric', 'spiritual-weapon', 2)?.summary)
      .toBe('1d8+4力场伤害')
    expect(dnd5eCombatSpellDamagePreview(cleric, 'cleric', 'spiritual-weapon', 4)?.summary)
      .toBe('2d8+4力场伤害')
  })

  it('shows each legal higher-slot damage allocation for Flame Strike', () => {
    const cleric = wizard({
      id: 'cleric',
      name: '牧师',
      charClass: '牧师',
      level: 11,
      abilities: { str: 12, dex: 10, con: 14, int: 8, wis: 18, cha: 12 },
      dnd5eClassLevels: { cleric: 11 },
    })

    expect(dnd5eCombatSpellDamagePreview(cleric, 'cleric', 'flame-strike', 5)?.summary)
      .toBe('4d6火焰伤害＋4d6光耀伤害')
    expect(dnd5eCombatSpellDamagePreview(cleric, 'cleric', 'flame-strike', 6)?.summary)
      .toBe('5d6火焰伤害＋4d6光耀伤害，或4d6火焰伤害＋5d6光耀伤害')
  })

  it('includes automatic subclass damage bonuses without multiplying them per missile', () => {
    const evoker = wizard({
      level: 10,
      abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
      dnd5eClassLevels: { wizard: 10 },
      dnd5eClassChoices: {
        classes: {
          wizard: {
            subclass: 'evocation',
            selections: { 'spell-prepared': ['magic-missile'] },
          },
        },
      },
    })
    expect(dnd5eCombatSpellDamagePreview(evoker, 'wizard', 'magic-missile', 1))
      .toEqual({
        slotLevel: 1,
        summary: '3枚飞弹，每枚1d4+1力场伤害；合计3d4+8',
        featureBonuses: ['强化塑能 +5（一次伤害掷骰）'],
      })
  })

  it('does not show a damage row for utility spells', () => {
    expect(dnd5eCombatSpellDamagePreview(wizard(), 'wizard', 'darkvision', 2))
      .toBeUndefined()
  })
})
