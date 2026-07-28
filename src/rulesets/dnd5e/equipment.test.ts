import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  DND5E_DAGGER,
  DND5E_BATTLEAXE,
  DND5E_CLUB,
  DND5E_DART,
  DND5E_FIGHTER_STARTING_EQUIPMENT,
  DND5E_HAND_CROSSBOW,
  DND5E_LEATHER_ARMOR,
  DND5E_LIGHT_CROSSBOW,
  DND5E_LONGBOW,
  DND5E_OFFHAND_SHORTSWORD,
  DND5E_QUARTERSTAFF,
  DND5E_SHIELD,
  DND5E_SHORTSWORD,
  DND5E_SLING,
  defaultEquipmentForDnd5eCharacter,
  dnd5eArmorClass,
  dnd5eArmorProficient,
  dnd5eArmorProficiencies,
  dnd5eOffHandWeaponAttackProfile,
  dnd5eShillelaghAttackChoice,
  dnd5eWeaponDamageSource,
  dnd5eWeaponAttackProfile,
  dnd5eWeaponProficient,
  dnd5eWearingUnproficientArmor,
  normalizeDnd5eCharacterEquipment,
} from './equipment'
import { dnd5eWalkingSpeed } from './classes'
import { createDnd5eMechanicalEffect, DND5E_COMBAT_STATE_SCHEMA_VERSION } from './activeEffects'
import { registerDnd5eRulesPlugin } from './pluginApi'

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

  it('round-trips authoritative magic and special-material weapon provenance', () => {
    const silveredMagicWeapon = structuredClone(DND5E_SHORTSWORD)
    silveredMagicWeapon.id = 'plugin:moon-silver-shortsword'
    silveredMagicWeapon.baseEquipmentId = DND5E_SHORTSWORD.id
    if (silveredMagicWeapon.dnd5e?.kind !== 'weapon') throw new Error('test weapon missing rules')
    silveredMagicWeapon.dnd5e.magical = true
    silveredMagicWeapon.dnd5e.specialMaterial = 'silvered'

    const normalized = normalizeDnd5eCharacterEquipment({
      charClass: '战士',
      equipment: structuredClone({ mainWeapon: silveredMagicWeapon }),
    })
    expect(normalized?.mainWeapon?.dnd5e).toMatchObject({
      kind: 'weapon',
      magical: true,
      specialMaterial: 'silvered',
    })
    expect(dnd5eWeaponDamageSource(normalized?.mainWeapon)).toEqual({
      weaponId: silveredMagicWeapon.id,
      magical: true,
      specialMaterial: 'silvered',
    })
  })

  it('migrates legacy +N magic weapons and drops invalid provenance values', () => {
    const legacyMagicWeapon = {
      ...structuredClone(DND5E_SHORTSWORD),
      id: 'srd-5.1:magic-item:weapon-shortsword-plus-1',
      baseEquipmentId: DND5E_SHORTSWORD.id,
      effects: { weaponAttackBonus: 1, weaponDamageBonus: 1 },
    }
    expect(dnd5eWeaponDamageSource(legacyMagicWeapon)).toEqual({
      weaponId: legacyMagicWeapon.id,
      magical: true,
    })
    expect(normalizeDnd5eCharacterEquipment({
      charClass: '战士',
      equipment: { mainWeapon: legacyMagicWeapon },
    })?.mainWeapon?.dnd5e).toMatchObject({ kind: 'weapon', magical: true })

    const malformed = structuredClone(DND5E_SHORTSWORD)
    if (malformed.dnd5e?.kind !== 'weapon') throw new Error('test weapon missing rules')
    const malformedRules = malformed.dnd5e as unknown as Record<string, unknown>
    malformedRules.magical = 'yes'
    malformedRules.specialMaterial = 'mithral'
    const sanitized = normalizeDnd5eCharacterEquipment({
      charClass: '战士',
      equipment: { mainWeapon: malformed },
    })?.mainWeapon?.dnd5e
    expect(sanitized?.kind === 'weapon' && sanitized.magical).toBeUndefined()
    expect(sanitized?.kind === 'weapon' && sanitized.specialMaterial).toBeUndefined()
  })

  it('derives AC 18 and a proficient +5 longsword attack', () => {
    const character = fighter()
    expect(dnd5eArmorClass(character)).toBe(18)
    expect(dnd5eWeaponAttackProfile(character)).toMatchObject({
      weaponName: '长剑',
      attackAbility: 'str',
      proficient: true,
      attackModifier: 5,
      damage: { count: 1, sides: 8, bonus: 3, type: 'slashing' },
      reachFeet: 5,
    })
  })

  it('uses the chosen Shillelagh ability for attack and damage while keeping a d8 weapon die', () => {
    const shillelagh = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:shillelagh',
      label: '橡棍术',
      targetId: 'fighter',
      source: { kind: 'spell', actorId: 'fighter', rulesId: 'shillelagh' },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: {
        shillelagh: {
          weaponId: DND5E_CLUB.id,
          spellcastingAbility: 'wis',
          spellcastingModifier: 4,
        },
      },
    })
    const druid = fighter({
      charClass: '德鲁伊',
      abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 18, cha: 10 },
      equipment: { mainWeapon: DND5E_CLUB },
      dnd5eCombatState: { schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION, activeEffects: [shillelagh] },
    })
    expect(dnd5eShillelaghAttackChoice(druid)).toMatchObject({
      weaponId: DND5E_CLUB.id,
      spellcastingAbility: 'wis',
      spellcastingModifier: 4,
      strengthModifier: 0,
    })
    expect(dnd5eWeaponAttackProfile(druid, { shillelaghAbility: 'spellcasting' })).toMatchObject({
      attackAbility: 'wis',
      attackModifier: 6,
      damage: { sides: 8, bonus: 4 },
    })
    expect(dnd5eWeaponAttackProfile(druid, { shillelaghAbility: 'str' })).toMatchObject({
      attackAbility: 'str',
      attackModifier: 2,
      damage: { sides: 8, bonus: 0 },
    })
  })

  it('does not add proficiency when a class uses a weapon it is not proficient with', () => {
    const wizard = fighter({ charClass: '法师', equipment: { mainWeapon: DND5E_FIGHTER_STARTING_EQUIPMENT.mainWeapon } })
    expect(dnd5eWeaponAttackProfile(wizard)).toMatchObject({ proficient: false, attackModifier: 3 })
  })

  it('uses the exact SRD wizard weapon list and does not confuse Light with proficiency', () => {
    const wizard = fighter({ charClass: '法师', level: 5 })
    for (const weapon of [DND5E_DAGGER, DND5E_DART, DND5E_SLING, DND5E_QUARTERSTAFF, DND5E_LIGHT_CROSSBOW]) {
      expect(dnd5eWeaponProficient(wizard, weapon)).toBe(true)
    }
    expect(dnd5eWeaponProficient(wizard, {
      ...DND5E_DAGGER,
      id: 'srd-5.1:magic-item:weapon-dagger-plus-1',
      baseEquipmentId: DND5E_DAGGER.id,
    })).toBe(true)
    expect(DND5E_HAND_CROSSBOW.dnd5e).toMatchObject({ kind: 'weapon', category: 'martial' })
    expect(DND5E_HAND_CROSSBOW.dnd5e?.kind === 'weapon' && DND5E_HAND_CROSSBOW.dnd5e.properties).toContain('轻型')
    expect(dnd5eWeaponProficient(wizard, DND5E_HAND_CROSSBOW)).toBe(false)
  })

  it('keeps armor AC while enforcing wizard armor and shield proficiency separately', () => {
    const wizard = fighter({
      charClass: '法师',
      abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 12, cha: 8 },
      equipment: { mainWeapon: DND5E_QUARTERSTAFF, armor: DND5E_LEATHER_ARMOR, offHand: DND5E_SHIELD },
    })
    expect([...dnd5eArmorProficiencies(wizard)]).toEqual([])
    expect(dnd5eArmorProficient(wizard, DND5E_LEATHER_ARMOR)).toBe(false)
    expect(dnd5eArmorProficient(wizard, DND5E_SHIELD)).toBe(false)
    expect(dnd5eWearingUnproficientArmor(wizard)).toBe(true)
    expect(dnd5eArmorClass(wizard)).toBe(15)
  })

  it('adds weapon and armor proficiencies granted by an imported race', () => {
    const pluginId = 'com.example.racial-training'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Racial Training', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerRace({
          id: 'mountain-kin', name: '山地族测试', speedFeet: 25,
          armorProficiencies: ['light', 'medium'],
          weaponProficiencies: ['dnd5e-battleaxe'],
        })
      },
    })
    try {
      const wizard = fighter({
        race: '山地族测试',
        dnd5eRaceId: `${pluginId}:mountain-kin`,
        charClass: '法师',
      })
      expect([...dnd5eArmorProficiencies(wizard)]).toEqual(['light', 'medium'])
      expect(dnd5eWeaponProficient(wizard, DND5E_BATTLEAXE)).toBe(true)
      expect(dnd5eWeaponProficient(wizard, DND5E_LONGBOW)).toBe(false)
    } finally {
      dispose()
    }
  })

  it('applies deterministic core dwarf weapon training', () => {
    const wizard = fighter({ race: '矮人', charClass: '法师' })
    expect(dnd5eWeaponProficient(wizard, DND5E_BATTLEAXE)).toBe(true)
    expect(dnd5eWeaponProficient(wizard, DND5E_LONGBOW)).toBe(false)
  })

  it('recomputes unarmored AC instead of preserving a stale saved value', () => {
    const wizard = fighter({
      charClass: '法师',
      dnd5eClassLevels: { wizard: 20 },
      level: 20,
      ac: 22,
      abilities: { str: 16, dex: 14, con: 15, int: 9, wis: 13, cha: 11 },
      equipment: { mainWeapon: DND5E_QUARTERSTAFF },
    })
    expect(dnd5eArmorClass(wizard)).toBe(12)
  })

  it('applies starting-class and multiclass armor proficiency without granting heavy armor to a multiclass fighter', () => {
    const fighterWizard = fighter({
      charClass: '法师',
      level: 6,
      dnd5eClassLevels: { wizard: 5, fighter: 1 },
    })
    expect([...dnd5eArmorProficiencies(fighterWizard)].sort()).toEqual(['light', 'medium', 'shield'])
    expect(dnd5eArmorProficient(fighterWizard, DND5E_LEATHER_ARMOR)).toBe(true)
    expect(dnd5eArmorProficient(fighterWizard, DND5E_FIGHTER_STARTING_EQUIPMENT.armor)).toBe(false)
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
    expect(dnd5eWeaponAttackProfile(twoHanded, { forceOneHanded: true })).toMatchObject({
      greatWeaponFighting: false,
      damage: { sides: 8, bonus: 3 },
    })
    const shielded = fighter({ dnd5eClassChoices: { fighter: { fightingStyles: ['great-weapon-fighting'] } } })
    expect(dnd5eWeaponAttackProfile(shielded)).toMatchObject({
      greatWeaponFighting: false,
      damage: { sides: 8, bonus: 3 },
    })
    expect(dnd5eWeaponAttackProfile(fighter({
      equipment: { mainWeapon: DND5E_LONGBOW, offHand: DND5E_SHIELD },
    }))).toBeUndefined()
    expect(dnd5eWeaponAttackProfile(fighter({
      equipment: { mainWeapon: DND5E_LONGBOW },
    }), { forceOneHanded: true })).toBeUndefined()
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
    const paladin = fighter({ charClass: '圣武士', level: 2, dnd5eClassChoices: { classes: { paladin: { selections: { 'fighting-style': ['dueling'] } } } } })
    expect(dnd5eWeaponAttackProfile(paladin)?.damage.bonus).toBe(5)
    const ranger = fighter({ charClass: '游侠', level: 2, dnd5eClassChoices: { classes: { ranger: { selections: { 'fighting-style': ['defense'] } } } } })
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

  it('reduces speed for unmet heavy-armor Strength and preserves Dwarven Speed', () => {
    const weak = fighter({
      abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    })
    expect(dnd5eWalkingSpeed(weak)).toBe(20)
    expect(dnd5eWalkingSpeed({ ...weak, race: '矮人' })).toBe(30)
  })
})
