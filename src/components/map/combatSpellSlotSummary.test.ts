import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { dnd5eCombatSpellSlotSummary } from './combatSpellSlotSummary'

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: 'wizard',
    name: '艾琳',
    player: '玩家一',
    avatar: '🧙',
    accent: 'from-violet-500 to-indigo-700',
    race: '人类',
    charClass: '法师',
    level: 5,
    background: '侍僧',
    experience: 6500,
    reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'],
    skills: [],
    maxHp: 32,
    currentHp: 32,
    tempHp: 0,
    hitDice: '5d6',
    initiativeBonus: 0,
    saveDC: 15,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    rulesetId: 'dnd5e-2014-srd-5.1',
    classResources: {
      'dnd5e-spell-slot-1': { current: 2, max: 4 },
      'dnd5e-spell-slot-2': { current: 0, max: 3 },
      'dnd5e-spell-slot-3': { current: 1, max: 2 },
    },
    ...overrides,
  } as Character
}

describe('dnd5eCombatSpellSlotSummary', () => {
  it('读取各环权威剩余法术位', () => {
    expect(dnd5eCombatSpellSlotSummary(character()).map(({ label, current, max }) => ({
      label,
      current,
      max,
    }))).toEqual([
      { label: '1环', current: 2, max: 4 },
      { label: '2环', current: 0, max: 3 },
      { label: '3环', current: 1, max: 2 },
    ])
  })

  it('支持兼职共享法术位和邪术师契约位', () => {
    const mixed = character({
      level: 6,
      dnd5eClassLevels: { wizard: 5, warlock: 1 },
      classResources: {
        'dnd5e-spell-slot-1': { current: 3, max: 4 },
        'dnd5e-spell-slot-2': { current: 2, max: 3 },
        'dnd5e-spell-slot-3': { current: 1, max: 2 },
        'dnd5e-pact-slot': { current: 0, max: 1 },
      },
    })

    expect(dnd5eCombatSpellSlotSummary(mixed).map(({ label, current, max }) => ({
      label,
      current,
      max,
    }))).toEqual([
      { label: '1环', current: 3, max: 4 },
      { label: '契约1环', current: 0, max: 1 },
      { label: '2环', current: 2, max: 3 },
      { label: '3环', current: 1, max: 2 },
    ])
  })
})
