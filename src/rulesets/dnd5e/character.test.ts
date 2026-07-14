import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e, normalizeLegacyAbilityScore } from './character'

function legacyCharacter(): Character {
  return {
    id: 'hero', name: 'Hero', player: 'P1', avatar: '🛡️', accent: 'blue', race: '', charClass: 'Legacy Archer', level: 5, background: '', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, savingThrows: ['str', 'con'], skills: ['athletics'], maxHp: 40, currentHp: 30, tempHp: 4, hitDice: '1d10', ac: 17, speed: 30, initiativeBonus: 1,
    saveDC: 99, actionPoints: 9, currentAP: 7, passivePerception: 10, inspiration: 1, mana: 99, maxMana: 99, traits: [], combatSkills: [], conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

describe('D&D 5e character boundary', () => {
  it('converts the inherited 25-baseline ability scale', () => {
    expect(normalizeLegacyAbilityScore(25)).toBe(10)
    expect(normalizeLegacyAbilityScore(30)).toBe(12)
    expect(normalizeLegacyAbilityScore(50)).toBe(20)
  })
  it('drops legacy AP and custom combat fields from the SRD model', () => {
    const migrated = migrateCharacterToDnd5e(legacyCharacter())
    expect(migrated).toMatchObject({ level: 5, armorClass: 17, hitPointDice: [{ sides: 10, current: 5, max: 5 }], inspiration: true })
    expect(JSON.stringify(migrated)).not.toMatch(/actionPoints|currentAP|saveDC|mana|combatSkills|traits/)
  })

  it('creates an authoritative combatant with SRD proficiency and initiative', () => {
    const character = migrateCharacterToDnd5e(legacyCharacter())
    const combatant = createCombatantFromDnd5eCharacter({ character, controller: 'player', initiativeD20: 12, position: { x: 5, y: 5 } })
    expect(combatant).toMatchObject({ initiative: 15, proficiencyBonus: 3, turn: { actionAvailable: true, reactionAvailable: true, movementRemaining: 30 } })
  })
})
