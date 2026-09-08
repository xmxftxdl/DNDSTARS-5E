import { describe, expect, it } from 'vitest'
import { createMobileDnd5eCharacter, MOBILE_CHARACTER_CLASS_OPTIONS } from './createMobileCharacter'

const ownership = {
  roomId: 'ROOM01',
  roomMemberId: 'member-player1',
  ownerAccountId: 'account-1',
  player: '测试玩家',
}

const standardAbilities = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } as const

describe('mobile D&D 5e character creation', () => {
  it.each(MOBILE_CHARACTER_CLASS_OPTIONS)('creates a complete level-one %s', (charClass) => {
    const character = createMobileDnd5eCharacter({
      name: `${charClass}测试`, charClass, race: '人类', background: '侍僧', alignment: '中立善良',
      abilityMethod: 'standard-array', baseAbilities: { ...standardAbilities },
    }, ownership)
    expect(character.rulesetId).toBe('dnd5e-2014-srd-5.1')
    expect(character.roomMemberId).toBe(ownership.roomMemberId)
    expect(character.ownerAccountId).toBe(ownership.ownerAccountId)
    expect(character.level).toBe(1)
    expect(character.maxHp).toBeGreaterThan(0)
    expect(character.currentHp).toBe(character.maxHp)
    expect(character.savingThrows).toHaveLength(2)
    expect(character.dnd5eInventory?.entries.length).toBeGreaterThan(0)
    expect(character.dnd5eClassLevels?.[Object.keys(character.dnd5eClassLevels)[0]]).toBe(1)
  })

  it('applies background skills and account-safe ownership fields', () => {
    const character = createMobileDnd5eCharacter({
      name: '星桥', charClass: '法师', race: '半精灵', background: '侍僧', alignment: '混乱善良',
      abilityMethod: 'standard-array', baseAbilities: { ...standardAbilities },
    }, ownership)
    expect(character.skills).toEqual(expect.arrayContaining(['insight', 'religion']))
    expect(character.dnd5eAbilityGeneration?.halfElfChoices).toHaveLength(2)
    expect(character.ac).toBeGreaterThanOrEqual(10)
  })

  it('preserves a manually assigned point-buy array instead of class auto-allocation', () => {
    const baseAbilities = { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 8 }
    const character = createMobileDnd5eCharacter({
      name: '点购法师', charClass: '法师', race: '人类', background: '侍僧', alignment: '中立善良',
      abilityMethod: 'point-buy', baseAbilities,
    }, ownership)
    expect(character.dnd5eAbilityGeneration?.method).toBe('point-buy')
    expect(character.dnd5eAbilityGeneration?.baseScores).toEqual(baseAbilities)
    expect(character.abilities.int).toBe(16)
    expect(character.abilities.str).toBe(9)
  })

  it('rejects an incomplete or duplicated rolled allocation', () => {
    expect(() => createMobileDnd5eCharacter({
      name: '非法投掷', charClass: '战士', race: '人类', background: '侍僧', alignment: '中立善良',
      abilityMethod: 'roll-4d6', baseAbilities: { ...standardAbilities },
      abilityRolls: [], rollAssignments: {},
    }, ownership)).toThrow('rolled-abilities-not-fully-assigned')
  })
})
