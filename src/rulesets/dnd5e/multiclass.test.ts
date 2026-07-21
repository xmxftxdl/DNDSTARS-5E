import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  addDnd5eMulticlassLevel,
  dnd5eCharacterClassLevel,
  dnd5eMulticlassCasterLevel,
  dnd5eMulticlassPactSlots,
  dnd5eMulticlassSpellSlots,
  removeDnd5eMulticlassLevel,
  validateDnd5eMulticlassLevelGain,
} from './multiclass'

const character = (patch: Partial<Character> = {}): Character => ({
  rulesetId: 'dnd5e-2014-srd-5.1', id: 'hero', name: '英雄', player: '', avatar: '', accent: '',
  race: '人类', charClass: '战士', level: 5, background: '', experience: 0, reputation: 0,
  abilities: { str: 16, dex: 14, con: 14, int: 13, wis: 13, cha: 13 }, savingThrows: ['str', 'con'], skills: [],
  maxHp: 40, currentHp: 40, tempHp: 0, hitDice: '5d10', ac: 16, speed: 30, initiativeBonus: 2,
  saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], backstory: '', notes: '', dmNotes: '', visibleToPlayers: true,
  ...patch,
})

describe('D&D 5e 2014 multiclassing', () => {
  it('migrates a legacy single-class character without changing total level', () => {
    expect(dnd5eCharacterClassLevel(character(), 'fighter')).toBe(5)
  })

  it('requires both the existing and target class prerequisites', () => {
    expect(validateDnd5eMulticlassLevelGain(character({ abilities: { str: 12, dex: 12, con: 14, int: 16, wis: 10, cha: 10 } }), 'wizard'))
      .toEqual({ ok: false, reason: 'current-class-prerequisite' })
    expect(validateDnd5eMulticlassLevelGain(character({ abilities: { str: 16, dex: 12, con: 14, int: 12, wis: 10, cha: 10 } }), 'wizard'))
      .toEqual({ ok: false, reason: 'target-class-prerequisite' })
  })

  it('adds a class level while preserving the primary class', () => {
    const next = addDnd5eMulticlassLevel(character(), 'wizard')
    expect(next).toMatchObject({ charClass: '战士', level: 6, dnd5eClassLevels: { fighter: 5, wizard: 1 } })
  })

  it('undoes an accidentally added multiclass level without removing the starting class', () => {
    const mixed = addDnd5eMulticlassLevel(character(), 'wizard')
    expect(removeDnd5eMulticlassLevel(mixed, 'wizard')).toMatchObject({
      level: 5, dnd5eClassLevels: { fighter: 5 },
    })
    expect(removeDnd5eMulticlassLevel(character({ level: 1, dnd5eClassLevels: { fighter: 1 } }), 'fighter'))
      .toMatchObject({ level: 1, dnd5eClassLevels: { fighter: 1 } })
  })

  it('combines full and half caster levels and keeps pact magic separate', () => {
    const mixed = character({
      charClass: '法师', level: 10,
      dnd5eClassLevels: { wizard: 5, paladin: 4, warlock: 1 },
    })
    expect(dnd5eMulticlassCasterLevel(mixed)).toBe(7)
    expect(dnd5eMulticlassSpellSlots(mixed)).toEqual([4, 3, 3, 1])
    expect(dnd5eMulticlassPactSlots(mixed)).toEqual({ count: 1, slotLevel: 1 })
  })

  it('keeps the class spell-slot table when only one class grants Spellcasting', () => {
    expect(dnd5eMulticlassSpellSlots(character({
      level: 5,
      dnd5eClassLevels: { paladin: 5 },
    }))).toEqual([4, 2])
    expect(dnd5eMulticlassSpellSlots(character({
      level: 6,
      dnd5eClassLevels: { fighter: 1, paladin: 5 },
    }))).toEqual([4, 2])
  })
})
