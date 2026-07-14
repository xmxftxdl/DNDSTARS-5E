import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { DND5E_FIGHTER_STARTING_EQUIPMENT, defaultEquipmentForDnd5eCharacter, dnd5eArmorClass, dnd5eWeaponAttackProfile } from './equipment'

function fighter(patch: Partial<Character> = {}): Character {
  return {
    id: 'fighter', name: '战士', player: '', avatar: '', accent: '', race: '人类', charClass: '战士', level: 1, background: '士兵', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: ['str', 'con'], skills: ['athletics'], maxHp: 12, currentHp: 12, tempHp: 0, hitDice: '1d10', ac: 10, speed: 30, initiativeBonus: 0,
    saveDC: 10, actionPoints: 2, currentAP: 2, passivePerception: 10, inspiration: 0, mana: 0, maxMana: 0, traits: [], combatSkills: [], conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
    ...patch,
  }
}

describe('D&D 5e 2014 fighter equipment', () => {
  it('provides longsword, shield, and chain mail as the ready-to-play kit', () => {
    const equipment = defaultEquipmentForDnd5eCharacter({ charClass: '战士' })
    expect(equipment).toMatchObject({
      mainWeapon: { name: '长剑' },
      offHand: { name: '盾牌' },
      armor: { name: '链甲' },
    })
    expect(defaultEquipmentForDnd5eCharacter({ charClass: '法师' })).toBeUndefined()
  })

  it('derives AC 18 and a proficient +5 longsword attack', () => {
    const character = fighter()
    expect(dnd5eArmorClass(character)).toBe(18)
    expect(dnd5eWeaponAttackProfile(character)).toMatchObject({
      weaponName: '长剑',
      attackAbility: 'str',
      attackModifier: 5,
      damage: { count: 1, sides: 8, bonus: 3, type: 'slashing' },
      reachFeet: 5,
    })
  })

  it('applies the 2014 Dueling damage bonus while a shield is held', () => {
    const character = fighter({ dnd5eClassChoices: { fighter: { fightingStyles: ['dueling'] } } })
    expect(dnd5eWeaponAttackProfile(character)?.damage.bonus).toBe(5)
  })
})
