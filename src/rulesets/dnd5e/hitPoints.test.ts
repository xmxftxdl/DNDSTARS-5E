import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  dnd5eFixedMaxHp,
  dnd5eHitPointMaximumMode,
  dnd5eManualMaxHp,
  resolveDnd5eShortRestHitDice,
  syncDnd5eHitPoints,
  syncDnd5ePrimalChampion,
} from './hitPoints'
import { registerDnd5eRulesPlugin } from './pluginApi'

function fighter(patch: Partial<Character> = {}): Character {
  return {
    id: 'fighter',
    name: '战士',
    player: '',
    avatar: '',
    accent: '',
    race: '人类',
    charClass: '战士',
    level: 1,
    background: '侍僧',
    experience: 0,
    reputation: 0,
    abilities: { str: 16, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: ['athletics'],
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d10',
    ac: 18,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    
    
    passivePerception: 10,
    inspiration: 0,
    
    
    
    
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    rulesetId: 'dnd5e-2014-srd-5.1',
    ...patch,
  }
}

describe('D&D 5e 2014 character hit points', () => {
  it('repairs an impossible level-12 fighter 1/1 save with the fixed HP rule', () => {
    const result = syncDnd5eHitPoints(fighter({
      level: 12,
      maxHp: 1,
      currentHp: 1,
      hitPointDice: [{ sides: 10, current: 1, max: 1 }],
    }))

    expect(result).toMatchObject({
      level: 12,
      maxHp: 76,
      currentHp: 76,
      hitDice: '12d10',
      hitPointMaximumMode: 'fixed',
      hitPointDice: [{ sides: 10, current: 12, max: 12 }],
    })
  })

  it('uses the fighter fixed value and preserves damage when gaining a level', () => {
    const result = syncDnd5eHitPoints(fighter({
      level: 6,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      maxHp: 44,
      currentHp: 20,
      hitPointMaximumMode: 'fixed',
      hitPointDice: [{ sides: 10, current: 3, max: 5 }],
    }))

    expect(dnd5eFixedMaxHp(result)).toBe(52)
    expect(result).toMatchObject({
      maxHp: 52,
      currentHp: 28,
      hitPointDice: [{ sides: 10, current: 4, max: 6 }],
    })
  })

  it('preserves a plausible rolled total from an older save as manual HP', () => {
    const character = fighter({
      level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      maxHp: 47,
      currentHp: 19,
      hitPointDice: [{ sides: 10, current: 2, max: 5 }],
    })

    expect(dnd5eHitPointMaximumMode(character)).toBe('manual')
    expect(syncDnd5eHitPoints(character)).toMatchObject({
      maxHp: 47,
      currentHp: 19,
      hitPointMaximumMode: 'manual',
    })
    expect(syncDnd5eHitPoints(character).hitPointRolls).toHaveLength(5)
  })

  it('applies Constitution to every recorded manual Hit Die result', () => {
    const manual = fighter({
      level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      hitPointMaximumMode: 'manual',
      hitPointRolls: [10, 3, 8, 1, 5],
      maxHp: 1,
      currentHp: 1,
    })
    expect(dnd5eManualMaxHp(manual)).toBe(37)
    expect(syncDnd5eHitPoints(manual)).toMatchObject({ maxHp: 37, currentHp: 37 })
  })

  it('retroactively recalculates manual HP when the Constitution modifier changes', () => {
    const before = syncDnd5eHitPoints(fighter({
      level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      hitPointMaximumMode: 'manual',
      hitPointRolls: [10, 3, 8, 1, 5],
      maxHp: 37,
      currentHp: 20,
    }))
    const after = syncDnd5eHitPoints({
      ...before,
      abilities: { ...before.abilities, con: 16 },
    })
    expect(after).toMatchObject({ maxHp: 42, currentHp: 25 })
  })

  it('applies the minimum one HP gain separately to low rolls with negative Constitution', () => {
    const sorcerer = fighter({
      charClass: '术士', level: 3, hitDice: '3d6',
      abilities: { str: 8, dex: 14, con: 6, int: 10, wis: 10, cha: 16 },
      hitPointMaximumMode: 'manual',
      hitPointRolls: [6, 1, 3],
    })
    expect(dnd5eManualMaxHp(sorcerer)).toBe(6)
  })

  it('does not revive a dead character while repairing its maximum', () => {
    expect(syncDnd5eHitPoints(fighter({ level: 12, maxHp: 1, currentHp: 0 }))).toMatchObject({
      maxHp: 76,
      currentHp: 0,
    })
  })

  it('adds one hit point per sorcerer level for selected Draconic Resilience', () => {
    const sorcerer = fighter({
      charClass: '术士',
      level: 5,
      hitDice: '5d6',
      abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
      dnd5eClassChoices: { classes: { sorcerer: { subclass: 'draconic' } } },
    })
    expect(dnd5eFixedMaxHp(sorcerer)).toBe(37)
  })

  it('applies an imported racial per-level HP bonus to fixed and manual totals', () => {
    const pluginId = 'local.test.hill-dwarf'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Hill Dwarf Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerRace({
          id: 'hill-dwarf',
          name: '丘陵矮人测试',
          speedFeet: 25,
          hitPointsPerLevelBonus: 1,
        })
      },
    })
    try {
      const hillDwarf = fighter({
        race: '丘陵矮人测试',
        dnd5eRaceId: `${pluginId}:hill-dwarf`,
        level: 5,
        maxHp: 39,
        currentHp: 39,
        hitPointMaximumMode: 'fixed',
      })
      expect(dnd5eFixedMaxHp(hillDwarf)).toBe(39)
      expect(dnd5eManualMaxHp({
        ...hillDwarf,
        hitPointRolls: [10, 5, 5, 5, 5],
      })).toBe(35)
      expect(syncDnd5eHitPoints(hillDwarf)).toMatchObject({
        maxHp: 39,
        currentHp: 39,
      })
    } finally {
      dispose()
    }
  })

  it('applies Primal Champion once and reverses it when the Barbarian drops below level 20', () => {
    const level20 = syncDnd5ePrimalChampion(fighter({
      charClass: '野蛮人', level: 20,
      abilities: { str: 20, dex: 12, con: 18, int: 10, wis: 10, cha: 10 },
    }))
    expect(level20).toMatchObject({
      abilities: { str: 24, con: 22 }, dnd5ePrimalChampionApplied: true,
    })
    expect(syncDnd5ePrimalChampion(level20).abilities).toMatchObject({ str: 24, con: 22 })

    const level19 = syncDnd5ePrimalChampion({ ...level20, level: 19 })
    expect(level19.abilities).toMatchObject({ str: 20, con: 18 })
    expect(level19.dnd5ePrimalChampionApplied).toBeUndefined()
  })

  it('recalculates fixed HP after Primal Champion raises Constitution', () => {
    const barbarian = syncDnd5eHitPoints(fighter({
      charClass: '野蛮人', level: 20, hitDice: '19d12', maxHp: 176, currentHp: 176,
      hitPointMaximumMode: 'fixed',
      abilities: { str: 20, dex: 12, con: 20, int: 10, wis: 10, cha: 10 },
    }))
    expect(barbarian).toMatchObject({
      abilities: { str: 24, con: 24 }, maxHp: 285, currentHp: 285,
      hitDice: '20d12', dnd5ePrimalChampionApplied: true,
    })
  })

  it('spends Hit Dice and applies Song of Rest only once per short-rest settlement', () => {
    const result = resolveDnd5eShortRestHitDice({
      character: fighter({
        level: 5,
        currentHp: 10,
        maxHp: 50,
        abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
        hitPointDice: [{ sides: 10, current: 4, max: 5 }],
      }),
      spends: [{ poolIndex: 0, rolls: [3, 8] }],
      songOfRest: { dieSides: 8, roll: 6 },
    })

    expect(result).toMatchObject({
      hitDiceSpent: 2,
      hitDiceHealing: 15,
      songOfRestHealing: 6,
      healingApplied: 21,
      character: { currentHp: 31, hitPointDice: [{ sides: 10, current: 2, max: 5 }] },
    })
  })

  it('caps short-rest healing at maximum HP and rejects forged dice', () => {
    const character = fighter({ currentHp: 8, maxHp: 10, hitPointDice: [{ sides: 10, current: 1, max: 1 }] })
    expect(resolveDnd5eShortRestHitDice({
      character,
      spends: [{ poolIndex: 0, rolls: [10] }],
      songOfRest: { dieSides: 6, roll: 6 },
    }).healingApplied).toBe(2)
    expect(() => resolveDnd5eShortRestHitDice({
      character,
      spends: [{ poolIndex: 0, rolls: [11] }],
    })).toThrow(RangeError)
  })

  it('uses each class hit die and class level for a multiclass fixed maximum', () => {
    const result = syncDnd5eHitPoints(fighter({
      level: 6,
      dnd5eClassLevels: { fighter: 5, wizard: 1 },
      abilities: { str: 16, dex: 12, con: 14, int: 13, wis: 10, cha: 10 },
      maxHp: 44,
      currentHp: 44,
      hitPointMaximumMode: 'fixed',
      hitPointDice: [{ sides: 10, current: 5, max: 5 }],
    }))
    expect(result.maxHp).toBe(50)
    expect(result.currentHp).toBe(50)
    expect(result.hitPointDice).toEqual([
      { sides: 10, current: 5, max: 5 },
      { sides: 6, current: 1, max: 1 },
    ])
  })
})
