import { describe, expect, it } from 'vitest'
import type { MobileCharacterView, MobileSpellView } from '../../../../packages/mobile-protocol/src'
import { mobileAvailableSpellSlotLevels, mobileSpellBaseSlotLevel } from './mobileSpellCasting'

function character(overrides: Partial<MobileCharacterView> = {}): MobileCharacterView {
  return {
    id: 'wizard', name: '法师', player: '玩家', avatar: '🧙', race: '人类', charClass: '法师', level: 7,
    background: '侍僧', experience: 0, abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'], skills: [], maxHp: 40, currentHp: 40, tempHp: 0, ac: 13, speed: 30,
    initiativeBonus: 2, saveDC: 15, passivePerception: 11, conditions: [],
    classLevels: { wizard: 7 },
    classResources: {
      'dnd5e-spell-slot-3': { current: 1, max: 3 },
      'dnd5e-spell-slot-4': { current: 1, max: 1 },
    },
    ...overrides,
  }
}

function spell(overrides: Partial<MobileSpellView> = {}): MobileSpellView {
  return {
    id: 'fireball', name: '火球术', level: 3, classes: ['wizard'], headless: true,
    automationLevel: 'full', catalogOnly: false, prepared: true, known: true, inSpellbook: true,
    castingClassId: 'wizard', ...overrides,
  }
}

describe('移动端升环手势规则', () => {
  it('普通点击始终保留基础环位，即使角色拥有更高环位', () => {
    expect(mobileSpellBaseSlotLevel(spell(), character())).toBe(3)
    expect(mobileAvailableSpellSlotLevels(spell(), character())).toEqual([3, 4])
  })

  it('长按配置只列出当前确实可用的环位', () => {
    expect(mobileAvailableSpellSlotLevels(spell(), character({
      classResources: {
        'dnd5e-spell-slot-3': { current: 0, max: 3 },
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
      },
    }))).toEqual([4])
  })

  it('契约魔法固定使用当前契约环级，不开放普通升环选择', () => {
    const warlock = character({
      charClass: '邪术师', level: 7, classLevels: { warlock: 7 },
      classResources: { 'dnd5e-pact-slot': { current: 2, max: 2 } },
    })
    const pactSpell = spell({ id: 'hex', name: '妖术', level: 1, classes: ['warlock'], castingClassId: 'warlock' })
    expect(mobileSpellBaseSlotLevel(pactSpell, warlock)).toBe(4)
    expect(mobileAvailableSpellSlotLevels(pactSpell, warlock)).toEqual([4])
  })
})
