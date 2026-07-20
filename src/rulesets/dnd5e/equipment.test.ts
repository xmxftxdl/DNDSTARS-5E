import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { DND5E_FIGHTER_STARTING_EQUIPMENT, DND5E_OFFHAND_SHORTSWORD, DND5E_SHORTSWORD, defaultEquipmentForDnd5eCharacter, dnd5eArmorClass, dnd5eOffHandWeaponAttackProfile, dnd5eWeaponAttackProfile } from './equipment'
import { dnd5eWalkingSpeed } from './classes'

function fighter(patch: Partial<Character> = {}): Character {
  return {
    id: 'fighter', name: '战士', player: '', avatar: '', accent: '', race: '人类', charClass: '战士', level: 1, background: '士兵', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: ['str', 'con'], skills: ['athletics'], maxHp: 12, currentHp: 12, tempHp: 0, hitDice: '1d10', ac: 10, speed: 30, initiativeBonus: 0,
    saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
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
    expect(defaultEquipmentForDnd5eCharacter({ charClass: '法师' })?.mainWeapon?.name).toBe('长棍')
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

  it('omits the ability modifier from off-hand damage unless Two-Weapon Fighting is selected', () => {
    const equipment = { mainWeapon: DND5E_SHORTSWORD, offHand: DND5E_OFFHAND_SHORTSWORD }
    expect(dnd5eOffHandWeaponAttackProfile(fighter({ equipment }))?.damage.bonus).toBe(0)
    expect(dnd5eOffHandWeaponAttackProfile(fighter({
      equipment,
      dnd5eClassChoices: { fighter: { fightingStyles: ['two-weapon-fighting'] } },
    }))?.damage.bonus).toBe(3)
  })

  it('uses the versatile die and enables Great Weapon Fighting only while wielded in two hands', () => {
    const twoHanded = fighter({
      equipment: { mainWeapon: DND5E_FIGHTER_STARTING_EQUIPMENT.mainWeapon },
      dnd5eClassChoices: { fighter: { fightingStyles: ['great-weapon-fighting'] } },
    })
    expect(dnd5eWeaponAttackProfile(twoHanded)).toMatchObject({
      greatWeaponFighting: true,
      damage: { sides: 10, bonus: 3 },
    })
    const shielded = fighter({ dnd5eClassChoices: { fighter: { fightingStyles: ['great-weapon-fighting'] } } })
    expect(dnd5eWeaponAttackProfile(shielded)).toMatchObject({
      greatWeaponFighting: false,
      damage: { sides: 8, bonus: 3 },
    })
  })

  it('applies Defense AC and Champion expanded critical ranges', () => {
    const defended = fighter({ dnd5eClassChoices: { fighter: { fightingStyles: ['defense'] } } })
    expect(dnd5eArmorClass(defended)).toBe(19)
    const improved = fighter({ level: 3, dnd5eClassChoices: { fighter: { subclass: 'champion', fightingStyles: [] } } })
    const superior = fighter({ level: 15, dnd5eClassChoices: { fighter: { subclass: 'champion', fightingStyles: [] } } })
    expect(dnd5eWeaponAttackProfile(improved)?.criticalThreshold).toBe(19)
    expect(dnd5eWeaponAttackProfile(superior)?.criticalThreshold).toBe(18)
  })

  it('applies SRD unarmored-defense and Draconic Resilience AC formulas', () => {
    const unarmored = { mainWeapon: DND5E_FIGHTER_STARTING_EQUIPMENT.mainWeapon }
    expect(dnd5eArmorClass(fighter({ charClass: '野蛮人', equipment: unarmored, abilities: { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 } }))).toBe(15)
    expect(dnd5eArmorClass(fighter({ charClass: '武僧', equipment: unarmored, abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 18, cha: 8 } }))).toBe(17)
    expect(dnd5eArmorClass(fighter({
      charClass: '术士', equipment: unarmored, abilities: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
      dnd5eClassChoices: { classes: { sorcerer: { subclass: 'draconic' } } },
    }))).toBe(15)
  })

  it('uses the paladin and ranger fighting-style selections in attack and AC math', () => {
    const paladin = fighter({ charClass: '圣武士', dnd5eClassChoices: { classes: { paladin: { selections: { 'fighting-style': ['dueling'] } } } } })
    expect(dnd5eWeaponAttackProfile(paladin)?.damage.bonus).toBe(5)
    const ranger = fighter({ charClass: '游侠', dnd5eClassChoices: { classes: { ranger: { selections: { 'fighting-style': ['defense'] } } } } })
    expect(dnd5eArmorClass(ranger)).toBe(19)
  })

  it('adds the authoritative barbarian Rage bonus only to Strength melee damage', () => {
    const barbarian = fighter({
      charClass: '野蛮人',
      level: 9,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '野蛮人' }),
      dnd5eCombatState: { raging: true, rageTurnsRemaining: 10 },
    })
    expect(dnd5eWeaponAttackProfile(barbarian)?.damage).toMatchObject({ sides: 12, bonus: 6 })
    expect(dnd5eWeaponAttackProfile({ ...barbarian, dnd5eCombatState: undefined })?.damage.bonus).toBe(3)
  })

  it('adds Sacred Weapon Charisma to the paladin attack roll without changing damage', () => {
    const paladin = fighter({
      charClass: '圣武士',
      level: 5,
      abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 18 },
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '圣武士' }),
      dnd5eCombatState: { sacredWeaponTurnsRemaining: 10 },
    })
    expect(dnd5eWeaponAttackProfile(paladin)).toMatchObject({ attackModifier: 10, damage: { bonus: 3 } })
  })

  it('applies declarative equipment effects without leaking a weapon bonus to the other hand', () => {
    const character = fighter({
      equipment: {
        mainWeapon: {
          ...DND5E_SHORTSWORD,
          id: 'plugin:main-plus-one',
          effects: { weaponAttackBonus: 1, weaponDamageBonus: 1 },
        },
        offHand: {
          ...DND5E_OFFHAND_SHORTSWORD,
          id: 'plugin:offhand-plus-two',
          effects: { weaponAttackBonus: 2, weaponDamageBonus: 2 },
        },
        armor: DND5E_FIGHTER_STARTING_EQUIPMENT.armor,
        necklace: {
          id: 'plugin:cloak', name: '测试斗篷', slot: 'necklace',
          effects: { armorClassBonus: 1, savingThrowBonus: 1, speedBonusFeet: 5 },
        },
      },
    })
    expect(dnd5eWeaponAttackProfile(character)).toMatchObject({ attackModifier: 6, damage: { bonus: 4 } })
    expect(dnd5eOffHandWeaponAttackProfile(character)).toMatchObject({ attackModifier: 7, damage: { bonus: 2 } })
    expect(dnd5eArmorClass(character)).toBe(17)
    expect(dnd5eWalkingSpeed(character)).toBe(35)
  })
})
