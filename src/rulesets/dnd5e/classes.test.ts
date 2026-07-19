import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  DND5E_SRD_CLASS_DEFINITIONS,
  applyDnd5eInitiativeResourceFeatures,
  applyDnd5eShortRestResourceFeatures,
  dnd5eAllClassChoiceGroups,
  dnd5eBarbarianRageDamage,
  dnd5eBarbarianRageUses,
  dnd5eBardicInspirationDie,
  dnd5eBardSongOfRestDie,
  dnd5eClericDestroyUndeadCr,
  dnd5eClassDefinition,
  dnd5eClassChoiceOptionAvailable,
  dnd5eClassProgression,
  dnd5eClassSpellSlots,
  dnd5eMonkMartialArtsDie,
  dnd5ePactSlotLevel,
  dnd5ePreparedSpellCount,
  dnd5eRogueSneakAttackDice,
  dnd5eWalkingSpeed,
  dnd5eClimbingMovementCost,
  dnd5eRunningJumpBonusFeet,
  dnd5eIgnoresMagicItemRequirements,
  dnd5eThiefReflexesInitiative,
  dnd5eDruidWildShapeLimits,
  dnd5eEffectiveSavingThrowProficiencies,
  dnd5eSelfSavingThrowAuraBonus,
  dnd5eSpellSaveDc,
  dnd5eUnproficientAbilityCheckBonus,
} from './classes'

describe('SRD 5.1 class catalog', () => {
  it('contains exactly the twelve 2014 SRD classes with their only bundled subclasses', () => {
    expect(DND5E_SRD_CLASS_DEFINITIONS.map((definition) => definition.name)).toEqual([
      '野蛮人', '吟游诗人', '牧师', '德鲁伊', '战士', '武僧',
      '圣武士', '游侠', '游荡者', '术士', '邪术师', '法师',
    ])
    expect(DND5E_SRD_CLASS_DEFINITIONS.map((definition) => definition.subclass.name)).toEqual([
      '狂战士道途', '逸闻学院', '生命领域', '大地结社', '勇士', '散打宗',
      '奉献之誓', '猎人', '盗贼', '龙族血脉', '邪魔宗主', '塑能学派',
    ])
  })

  it('records class hit dice and saving throw proficiencies', () => {
    expect(dnd5eClassDefinition('barbarian')).toMatchObject({ hitDie: 12, savingThrows: ['str', 'con'] })
    expect(dnd5eClassDefinition('法师')).toMatchObject({ hitDie: 6, savingThrows: ['int', 'wis'] })
    expect(dnd5eClassDefinition('paladin')).toMatchObject({ hitDie: 10, savingThrows: ['wis', 'cha'] })
  })

  it('builds a full 1-20 progression and inserts SRD subclass features at their levels', () => {
    for (const definition of DND5E_SRD_CLASS_DEFINITIONS) {
      const progression = dnd5eClassProgression(definition)
      expect(progression).toHaveLength(20)
      expect(progression.map((entry) => entry.level)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
    }
    const rogue = dnd5eClassProgression(dnd5eClassDefinition('rogue')!)
    expect(rogue[2].features.map((feature) => feature.name)).toEqual(expect.arrayContaining(['游荡者范型', '快手', '飞檐走壁']))
    const wizard = dnd5eClassProgression(dnd5eClassDefinition('wizard')!)
    expect(wizard[1].features.map((feature) => feature.name)).toEqual(expect.arrayContaining(['奥术传承', '塑能学者', '法术塑形']))
  })

  it('uses the 2014 full, half, and pact slot progressions', () => {
    const bard = dnd5eClassDefinition('bard')!
    const paladin = dnd5eClassDefinition('paladin')!
    const warlock = dnd5eClassDefinition('warlock')!
    expect(dnd5eClassSpellSlots(bard, 5)).toEqual([4, 3, 2])
    expect(dnd5eClassSpellSlots(bard, 20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1])
    expect(dnd5eClassSpellSlots(paladin, 1)).toEqual([])
    expect(dnd5eClassSpellSlots(paladin, 17)).toEqual([4, 3, 3, 3, 1])
    expect(dnd5eClassSpellSlots(warlock, 1)).toEqual([1])
    expect(dnd5eClassSpellSlots(warlock, 17)).toEqual([4])
    expect([1, 3, 5, 7, 9].map(dnd5ePactSlotLevel)).toEqual([1, 2, 3, 4, 5])
  })

  it('records level-scaled martial values and class choices', () => {
    expect([1, 3, 6, 12, 17, 20].map(dnd5eBarbarianRageUses)).toEqual([2, 3, 4, 5, 6, Number.POSITIVE_INFINITY])
    expect([1, 9, 16].map(dnd5eBarbarianRageDamage)).toEqual([2, 3, 4])
    expect([1, 5, 11, 17].map(dnd5eMonkMartialArtsDie)).toEqual([4, 6, 8, 10])
    expect([1, 3, 19].map(dnd5eRogueSneakAttackDice)).toEqual([1, 2, 10])
    expect(dnd5eAllClassChoiceGroups(dnd5eClassDefinition('ranger')!).map((group) => group.id)).toEqual([
      'favored-enemy', 'favored-terrain', 'fighting-style', 'hunters-prey', 'defensive-tactics', 'multiattack', 'superior-hunters-defense',
    ])
    expect(dnd5eAllClassChoiceGroups(dnd5eClassDefinition('warlock')!).find((group) => group.id === 'eldritch-invocations')?.options).toHaveLength(32)
  })

  it('enforces Eldritch Invocation level, pact boon, and known-spell prerequisites', () => {
    const invocationGroup = dnd5eAllClassChoiceGroups(dnd5eClassDefinition('warlock')!)
      .find((group) => group.id === 'eldritch-invocations')!
    const option = (id: string) => invocationGroup.options.find((candidate) => candidate.id === id)!
    const level4: Pick<Character, 'level' | 'dnd5eClassChoices'> = {
      level: 4,
      dnd5eClassChoices: { classes: { warlock: { selections: {
        'spell-cantrips': ['eldritch-blast'],
        'pact-boon': ['blade'],
      } } } },
    }
    expect(dnd5eClassChoiceOptionAvailable(level4, 'warlock', option('agonizing-blast'))).toBe(true)
    expect(dnd5eClassChoiceOptionAvailable(level4, 'warlock', option('thirsting-blade'))).toBe(false)
    expect(dnd5eClassChoiceOptionAvailable({ ...level4, level: 5 }, 'warlock', option('thirsting-blade'))).toBe(true)
    expect(dnd5eClassChoiceOptionAvailable({
      ...level4,
      level: 15,
      dnd5eClassChoices: { classes: { warlock: { selections: { 'spell-cantrips': ['eldritch-blast'], 'pact-boon': ['tome'] } } } },
    }, 'warlock', option('chains-of-carceri'))).toBe(false)
  })

  it('applies barbarian and unarmored monk speed increases', () => {
    expect(dnd5eWalkingSpeed({ charClass: '野蛮人', level: 5, speed: 30 })).toBe(40)
    expect(dnd5eWalkingSpeed({ charClass: '武僧', level: 18, speed: 30 })).toBe(60)
    expect(dnd5eWalkingSpeed({ charClass: '武僧', level: 18, speed: 30, equipment: { armor: { id: 'leather', name: '皮甲', slot: 'armor' } } })).toBe(30)
    expect(dnd5eWalkingSpeed({ charClass: '野蛮人', level: 5, speed: 30, exhaustionLevel: 2 })).toBe(20)
    expect(dnd5eWalkingSpeed({ charClass: '武僧', level: 18, speed: 30, exhaustionLevel: 5 })).toBe(0)
  })

  it('exposes Thief movement, magic-item, and Reflexes rules to their owning systems', () => {
    const thief = {
      charClass: '游荡者', level: 17,
      abilities: { str: 10, dex: 18, con: 12, int: 10, wis: 10, cha: 10 },
      dnd5eClassChoices: { classes: { rogue: { subclass: 'thief' } } },
    } as const
    expect(dnd5eClimbingMovementCost(thief, 20)).toBe(20)
    expect(dnd5eRunningJumpBonusFeet(thief)).toBe(4)
    expect(dnd5eIgnoresMagicItemRequirements(thief)).toBe(true)
    expect(dnd5eThiefReflexesInitiative(thief, 18)).toBe(8)
    expect(dnd5eThiefReflexesInitiative(thief, 18, true)).toBeUndefined()
    expect(dnd5eClimbingMovementCost({ charClass: '游荡者', level: 2 }, 20)).toBe(40)
  })

  it('exposes the Champion Remarkable Athlete running-jump bonus to movement systems', () => {
    expect(dnd5eRunningJumpBonusFeet({
      charClass: '战士', level: 7,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      dnd5eClassChoices: { fighter: { subclass: 'champion' } },
    })).toBe(3)
  })

  it('derives other level-scaled class and spellcasting values', () => {
    expect([1, 5, 10, 15].map(dnd5eBardicInspirationDie)).toEqual([6, 8, 10, 12])
    expect([1, 2, 9, 13, 17].map(dnd5eBardSongOfRestDie)).toEqual([0, 6, 8, 10, 12])
    expect([4, 5, 8, 11, 14, 17].map(dnd5eClericDestroyUndeadCr)).toEqual([undefined, '1/2', '1', '2', '3', '4'])
    expect(dnd5eDruidWildShapeLimits(2)).toEqual({ maxChallengeRating: '1/4', swim: false, fly: false })
    expect(dnd5eDruidWildShapeLimits(8)).toEqual({ maxChallengeRating: '1', swim: true, fly: true })
    expect(dnd5ePreparedSpellCount({ charClass: '法师', level: 5, abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 } })).toBe(9)
    expect(dnd5eSpellSaveDc({ charClass: '法师', level: 5, abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 } })).toBe(15)
  })

  it('applies Jack of All Trades, Diamond Soul, Slippery Mind, and the paladin self aura', () => {
    expect(dnd5eUnproficientAbilityCheckBonus({ charClass: '吟游诗人', level: 9 }, 'dex')).toBe(2)
    expect(dnd5eUnproficientAbilityCheckBonus({ charClass: '战士', level: 9, dnd5eClassChoices: { fighter: { subclass: 'champion' } } }, 'con')).toBe(2)
    expect(dnd5eEffectiveSavingThrowProficiencies({ charClass: '武僧', level: 14, savingThrows: ['str', 'dex'] })).toHaveLength(6)
    expect(dnd5eEffectiveSavingThrowProficiencies({ charClass: '游荡者', level: 15, savingThrows: ['dex', 'int'] })).toContain('wis')
    expect(dnd5eSelfSavingThrowAuraBonus({ charClass: '圣武士', level: 6, abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 18 } })).toBe(4)
  })

  it('applies level-20 initiative and short-rest resource recovery features', () => {
    const base = {
      rulesetId: 'dnd5e-2014-srd-5.1', id: 'hero', name: 'Hero', player: '', avatar: '', accent: '',
      race: '人类', charClass: '吟游诗人', level: 20, background: '', experience: 0, reputation: 0,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 }, savingThrows: [], skills: [],
      maxHp: 100, currentHp: 100, tempHp: 0, hitDice: '20d8', ac: 10, speed: 30, initiativeBonus: 0,
      saveDC: 10, passivePerception: 10, inspiration: 0,
      conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    } as Character
    const bard = { ...base, classResources: { 'dnd5e-bardic-inspiration': { current: 0, max: 4 } } }
    expect(applyDnd5eInitiativeResourceFeatures(bard).classResources?.['dnd5e-bardic-inspiration'].current).toBe(1)
    const monk = { ...base, charClass: '武僧', classResources: { 'dnd5e-ki': { current: 0, max: 20 } } }
    expect(applyDnd5eInitiativeResourceFeatures(monk).classResources?.['dnd5e-ki'].current).toBe(4)
    const sorcerer = { ...base, charClass: '术士', classResources: { 'dnd5e-sorcery-points': { current: 13, max: 20 } } }
    expect(applyDnd5eShortRestResourceFeatures(sorcerer).classResources?.['dnd5e-sorcery-points'].current).toBe(17)
  })
})
