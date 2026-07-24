import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e, normalizeLegacyAbilityScore } from './character'
import { registerDnd5eRulesPlugin } from './pluginApi'

function legacyCharacter(): Character {
  return {
    id: 'hero', name: 'Hero', player: 'P1', avatar: '🛡️', accent: 'blue', race: '', charClass: 'Legacy Archer', level: 5, background: '', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, savingThrows: ['str', 'con'], skills: ['athletics'], maxHp: 40, currentHp: 30, tempHp: 4, hitDice: '1d10', ac: 17, speed: 30, initiativeBonus: 1,
    saveDC: 99, passivePerception: 10, inspiration: 1, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
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
    expect(migrated).toMatchObject({ level: 5, armorClass: 12, hitPointDice: [{ sides: 10, current: 5, max: 5 }], inspiration: true })
    expect(JSON.stringify(migrated)).not.toMatch(/actionPoints|currentAP|saveDC|mana|combatSkills|traits/)
  })

  it('creates an authoritative combatant with SRD proficiency and initiative', () => {
    const character = migrateCharacterToDnd5e({ ...legacyCharacter(), concentrating: true })
    const combatant = createCombatantFromDnd5eCharacter({ character, controller: 'player', initiativeD20: 12, position: { x: 5, y: 5 } })
    expect(combatant).toMatchObject({ concentrating: true, initiative: 15, proficiencyBonus: 3, turn: { actionAvailable: true, reactionAvailable: true, movementRemaining: 30 } })
  })

  it('projects elf Fey Ancestry as magical Sleep immunity', () => {
    const character = migrateCharacterToDnd5e({ ...legacyCharacter(), race: '精灵' })
    const combatant = createCombatantFromDnd5eCharacter({
      character, controller: 'player', initiativeD20: 12, position: { x: 5, y: 5 },
    })
    expect(combatant.conditionImmunities).toEqual(expect.arrayContaining(['magical-sleep', '魔法睡眠']))
  })

  it('projects equipped saving-throw effects into every Headless saving throw', () => {
    const migrated = migrateCharacterToDnd5e({
      ...legacyCharacter(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      equipment: {
        ring: { id: 'plugin:lucky-ring', name: '测试戒指', slot: 'ring', effects: { savingThrowBonus: 1 } },
      },
    })
    const combatant = createCombatantFromDnd5eCharacter({
      character: migrated, controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 },
    })
    expect(combatant.savingThrowBonuses).toMatchObject({ str: 7, dex: 3, con: 6, int: 1, wis: 2, cha: 0 })
  })

  it('projects plugin-background skills into the Headless proficiency snapshot', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.background', name: 'Background Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerBackground({
          id: 'observer', name: '观察者', skillProficiencies: ['insight', 'perception'],
        })
      },
    })
    try {
      const migrated = migrateCharacterToDnd5e({
        ...legacyCharacter(), rulesetId: 'dnd5e-2014-srd-5.1',
        background: '观察者', dnd5eBackgroundId: 'com.example.background:observer', skills: [],
      })
      expect(migrated.skillProficiencies).toEqual(expect.arrayContaining(['insight', 'perception']))
    } finally {
      dispose()
    }
  })

  it('applies 2014 exhaustion maximum-HP and death thresholds at the Headless boundary', () => {
    const exhausted = migrateCharacterToDnd5e({ ...legacyCharacter(), exhaustionLevel: 4, maxHp: 41, currentHp: 40 })
    expect(exhausted).toMatchObject({ exhaustionLevel: 4, maxHp: 20, currentHp: 20 })
    expect(migrateCharacterToDnd5e({ ...legacyCharacter(), exhaustionLevel: 6 }).currentHp).toBe(0)
  })

  it('rehydrates a persisted Wild Shape while retaining the body HP pool', () => {
    const source: Character = {
      ...legacyCharacter(),
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '德鲁伊',
      level: 2,
      currentHp: 16,
      maxHp: 20,
      dnd5eClassChoices: { classes: { druid: { selections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] } } } },
      dnd5eCombatState: {
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeCurrentHp: 7,
        wildShapeRoundsRemaining: 500,
        wildShapeOriginalCurrentHp: 16,
        wildShapeOriginalMaxHp: 20,
        wildShapeOriginalArmorClass: 12,
        wildShapeOriginalSpeed: 30,
        wildShapeOriginalAbilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
        wildShapeOriginalSavingThrowBonuses: { str: 3, dex: 2, con: 2, int: 2, wis: 3, cha: -1 },
      },
    }
    const combatant = createCombatantFromDnd5eCharacter({
      character: migrateCharacterToDnd5e(source), controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 },
    })
    expect(combatant).toMatchObject({
      currentHp: 7,
      maxHp: 11,
      armorClass: 13,
      statBlockId: 'srd-5.1:wolf',
      classState: { wildShapeOriginalCurrentHp: 16, wildShapeCurrentHp: 7 },
    })
  })
})
