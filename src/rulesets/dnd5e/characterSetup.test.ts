import { describe, expect, it } from 'vitest'
import {
  applyDnd5eRacialAbilityBonuses,
  DEFAULT_DND5E_BEGINNER_PREFERENCES,
  dnd5eClassAbilityFit,
  dnd5ePointBuyRemaining,
  dnd5eRacialAbilityBonuses,
  rankDnd5eClasses,
  recommendDnd5eCharacter,
  recommendDnd5eRaces,
  recommendedDnd5eBaseAbilities,
  rollDnd5eFourD6DropLowest,
} from './characterSetup'
import { registerDnd5eRulesPlugin } from './pluginApi'

describe('D&D 5e 2014 character setup', () => {
  it('recommends a divine support character from beginner preferences', () => {
    expect(recommendDnd5eCharacter({
      ...DEFAULT_DND5E_BEGINNER_PREFERENCES,
      combat: 'support', role: 'support', power: 'divine', heritage: 'sturdy', order: 'lawful', morality: 'good',
    })).toMatchObject({ charClass: '牧师', race: '矮人', alignment: '守序善良', background: '侍僧' })
  })

  it('makes the party-role answer materially change the live class ranking', () => {
    const defensive = rankDnd5eClasses({ ...DEFAULT_DND5E_BEGINNER_PREFERENCES, role: 'defense' })
    const exploration = rankDnd5eClasses({ ...DEFAULT_DND5E_BEGINNER_PREFERENCES, role: 'exploration' })
    expect(defensive[0].charClass).toBe('战士')
    expect(exploration[0].charClass).toBe('游侠')
    expect(exploration.find((candidate) => candidate.charClass === '游侠')!.score)
      .toBeGreaterThan(exploration.find((candidate) => candidate.charClass === '战士')!.score)
  })

  it('uses actual ability allocation and class primary abilities for race advice', () => {
    const strengthFighter = recommendDnd5eRaces('战士', { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 })
    const dexterityFighter = recommendDnd5eRaces('战士', { str: 8, dex: 15, con: 14, int: 10, wis: 12, cha: 13 })
    expect(strengthFighter[0].reasons.join('')).toContain('力量')
    expect(['半兽人', '龙裔']).toContain(strengthFighter[0].race)
    expect(dexterityFighter[0].reasons.join('')).toContain('敏捷')
    expect(['精灵', '半身人']).toContain(dexterityFighter[0].race)
    expect(dnd5eClassAbilityFit('战士', dexterityFighter[0].finalAbilities).primaryAbilities).toEqual(['dex'])
  })

  it('assigns the standard array by class priority and applies 2014 racial bonuses last', () => {
    const base = recommendedDnd5eBaseAbilities('法师')
    expect(base).toEqual({ str: 8, dex: 13, con: 14, int: 15, wis: 12, cha: 10 })
    expect(applyDnd5eRacialAbilityBonuses(base, dnd5eRacialAbilityBonuses('侏儒'))).toEqual({
      str: 8, dex: 13, con: 14, int: 17, wis: 12, cha: 10,
    })
  })

  it('uses the 27-point 2014 purchase table', () => {
    expect(dnd5ePointBuyRemaining({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(0)
  })

  it('applies an active plugin race fixed and flexible bonuses', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.setup-race', name: 'Setup Race', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerRace({
          id: 'starfolk', name: '星裔创建测试', speedFeet: 35,
          abilityBonuses: { cha: 2 }, flexibleAbilityBonus: { count: 1, amount: 1, exclude: ['cha'] },
        })
      },
    })
    try {
      expect(dnd5eRacialAbilityBonuses('com.example.setup-race:starfolk', ['dex'])).toEqual({
        str: 0, dex: 1, con: 0, int: 0, wis: 0, cha: 2,
      })
    } finally {
      dispose()
    }
  })

  it('rolls 4d6 and discards exactly one lowest die', () => {
    const values = [0, 0.2, 0.7, 0.99]
    let index = 0
    expect(rollDnd5eFourD6DropLowest(() => values[index++])).toEqual({
      dice: [1, 2, 5, 6], discardedIndex: 0, total: 13,
    })
  })
})
