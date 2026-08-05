import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { buildDnd5eRestRecoveryReports } from './campaignRestRecovery'

function fighter(id: string): Character {
  return {
    id,
    name: `战士 ${id}`,
    player: '玩家',
    avatar: '',
    accent: 'from-violet-500',
    race: '人类',
    charClass: '战士',
    dnd5eClassLevels: { fighter: 4 },
    level: 4,
    background: '士兵',
    experience: 0,
    reputation: 0,
    rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 36,
    currentHp: 5,
    tempHp: 3,
    hitDice: '4d10',
    hitPointDice: [{ sides: 10, current: 1, max: 4 }],
    ac: 16,
    speed: 30,
    initiativeBonus: 1,
    saveDC: 13,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    classResources: {
      fighterSecondWind: { current: 0, max: 1 },
      fighterActionSurge: { current: 0, max: 1 },
    },
    dnd5eInventory: {
      schemaVersion: 3,
      entries: [{
        instanceId: 'ring',
        templateId: 'rest-ring',
        quantity: 1,
        acquiredAt: 1,
        item: {
          id: 'rest-ring',
          name: '休憩指环',
          category: 'magic-item',
          icon: 'magic-ring',
          description: '测试',
          rulesText: '测试',
          stackable: false,
          resources: [{ id: 'charge', label: '充能', maximum: 4, resetOn: 'short-rest' }],
          source: { book: 'DM 自定义', license: '用户内容' },
        },
        resources: {
          charge: { id: 'charge', label: '充能', current: 1, maximum: 4, resetOn: 'short-rest' },
        },
      }, {
        instanceId: 'dawn-wand',
        templateId: 'dawn-wand',
        quantity: 1,
        acquiredAt: 2,
        item: {
          id: 'dawn-wand',
          name: '晨曦魔杖',
          category: 'magic-item',
          icon: 'magic-wand',
          description: '测试',
          rulesText: '测试',
          stackable: false,
          resources: [{ id: 'charge', label: '充能', maximum: 7, resetOn: 'dawn' }],
          source: { book: 'DM 自定义', license: '用户内容' },
        },
        resources: {
          charge: { id: 'charge', label: '充能', current: 2, maximum: 7, resetOn: 'dawn' },
        },
      }],
    },
  }
}

function wizard(id: string): Character {
  return {
    ...fighter(id),
    name: `法师 ${id}`,
    charClass: '法师',
    dnd5eClassLevels: { wizard: 4 },
    hitDice: '4d6',
    hitPointDice: [{ sides: 6, current: 2, max: 4 }],
    classResources: {
      'dnd5e-arcane-recovery': { current: 1, max: 1 },
      'dnd5e-spell-slot-1': { current: 1, max: 4 },
      'dnd5e-spell-slot-2': { current: 0, max: 3 },
    },
    dnd5eInventory: undefined,
  }
}

describe('D&D 5e rest recovery report', () => {
  it('lists short-rest features, magic-item charges and spendable hit dice', () => {
    const reports = buildDnd5eRestRecoveryReports({
      characters: [fighter('hero'), fighter('other')],
      restKind: 'short-rest',
      beneficiaryCharacterIds: ['hero'],
      currentWorldMinute: 480,
      completionWorldMinute: 540,
    })

    expect(reports).toHaveLength(1)
    expect(reports[0].entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '回气', before: 0, after: 1, outcome: 'restored' }),
      expect.objectContaining({ label: '休憩指环 · 充能', before: 1, after: 4, outcome: 'restored' }),
      expect.objectContaining({ label: 'd10 生命骰', outcome: 'available', before: 1, after: 1 }),
    ]))
  })

  it('reports long-rest hit points, hit dice and cleared temporary hit points', () => {
    const [report] = buildDnd5eRestRecoveryReports({
      characters: [fighter('hero')],
      restKind: 'long-rest',
      beneficiaryCharacterIds: ['hero'],
      currentWorldMinute: 0,
      completionWorldMinute: 480,
    })

    expect(report.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '生命值', before: 5, after: 36, outcome: 'restored' }),
      expect.objectContaining({ label: '临时生命值', before: 3, after: 0, outcome: 'cleared' }),
      expect.objectContaining({ label: 'd10 生命骰', before: 1, after: 3, maximum: 4 }),
      expect.objectContaining({ label: '晨曦魔杖 · 充能', before: 2, after: 7, outcome: 'restored' }),
    ]))
  })

  it('lists every spell-slot tier restored by a long rest', () => {
    const [report] = buildDnd5eRestRecoveryReports({
      characters: [wizard('mage')],
      restKind: 'long-rest',
      beneficiaryCharacterIds: ['mage'],
      currentWorldMinute: 480,
      completionWorldMinute: 960,
    })

    expect(report.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '1环法术位', before: 1, after: 4, outcome: 'restored' }),
      expect.objectContaining({ label: '2环法术位', before: 0, after: 3, outcome: 'restored' }),
    ]))
  })

  it('offers Arcane Recovery after a wizard finishes a short rest', () => {
    const [report] = buildDnd5eRestRecoveryReports({
      characters: [wizard('mage')],
      restKind: 'short-rest',
      beneficiaryCharacterIds: ['mage'],
      currentWorldMinute: 480,
      completionWorldMinute: 540,
    })

    expect(report.entries).toContainEqual(expect.objectContaining({
      label: '奥术回想',
      outcome: 'available',
      before: 1,
      after: 1,
      detail: expect.stringContaining('总环级不超过 2'),
    }))
  })
})
