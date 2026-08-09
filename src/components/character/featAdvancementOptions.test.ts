import { describe, expect, it } from 'vitest'
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import { dnd5eAdvancementFeatOptions } from './featAdvancementOptions'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: '测试角色',
    player: '玩家',
    avatar: '',
    accent: '',
    race: '人类',
    charClass: '战士',
    level: 4,
    background: '侍僧',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

describe('升级专长候选', () => {
  it('保留不满足前提的 SRD 专长，并明确显示不可选原因', () => {
    const grappler = dnd5eAdvancementFeatOptions(character()).find(
      (feat) => feat.id === 'srd5.1:grappler',
    )

    expect(grappler).toMatchObject({
      name: '擒抱者',
      eligible: false,
      disabledReason: '需要力量 13',
      sourceLabel: 'SRD 5.1',
    })
  })

  it('属性满足前提时允许在四级选择擒抱者', () => {
    const grappler = dnd5eAdvancementFeatOptions(character({
      abilities: { str: 13, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    })).find((feat) => feat.id === 'srd5.1:grappler')

    expect(grappler).toMatchObject({ eligible: true, disabledReason: undefined })
  })

  it('将规则包导入的专长加入同一升级选择器', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.level-up-feat',
        name: '升级专长测试包',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Test',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'watchful',
          name: '警觉观察',
          summary: '测试导入专长。',
          description: '仅用于验证升级选择。',
          automation: 'manual',
          prerequisite: { minimumLevel: 4 },
        })
      },
    })

    try {
      expect(dnd5eAdvancementFeatOptions(character())).toContainEqual(expect.objectContaining({
        id: 'test.level-up-feat:watchful',
        name: '警觉观察',
        eligible: true,
        sourceLabel: '升级专长测试包 · CC0-1.0',
      }))
    } finally {
      dispose()
    }
  })

  it('已经拥有的专长仍可审计，但不能重复选择', () => {
    const grappler = dnd5eAdvancementFeatOptions(character({
      dnd5eFeatIds: ['srd5.1:grappler'],
      abilities: { str: 13, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    })).find((feat) => feat.id === 'srd5.1:grappler')

    expect(grappler).toMatchObject({ eligible: false, disabledReason: '已经拥有' })
  })
})
