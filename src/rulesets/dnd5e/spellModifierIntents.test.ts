import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  dnd5eAvailableSpellModifierIntents,
  dnd5eSpellModifierIntentIdsFromOptions,
  resolveDnd5eSpellModifierIntents,
  toggleDnd5eSpellModifierIntent,
  type Dnd5eSpellModifierIntentId,
} from './spellModifierIntents'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: '施法者',
    player: '玩家',
    avatar: '🧙',
    accent: 'from-violet-600 to-indigo-700',
    race: '人类',
    charClass: '术士',
    level: 10,
    background: '侍僧',
    experience: 0,
    reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 18 },
    savingThrows: ['con', 'cha'],
    skills: [],
    maxHp: 62,
    currentHp: 62,
    tempHp: 0,
    hitDice: '10d6',
    ac: 15,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 16,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eClassLevels: { sorcerer: 10 },
    dnd5eClassChoices: {
      classes: {
        sorcerer: {
          subclass: 'draconic',
          selections: {
            metamagic: ['careful', 'quickened', 'empowered'],
            'dragon-ancestor': ['red-fire'],
            'spell-known': ['fireball'],
            'spell-cantrips': ['fire-bolt'],
          },
        },
      },
    },
    classResources: {
      'dnd5e-sorcery-points': { current: 10, max: 10 },
      'dnd5e-spell-slot-3': { current: 2, max: 3 },
    },
    ...patch,
  }
}

describe('Dnd5eSpellModifierIntentV1', () => {
  it('按职业等级、子职与角色选择生成预激活能力', () => {
    const sorcerer = dnd5eAvailableSpellModifierIntents(character())
    expect(sorcerer.map((entry) => entry.definition.id)).toEqual([
      'metamagic-careful',
      'metamagic-empowered',
      'metamagic-quickened',
      'draconic-elemental-resistance',
    ])

    const wizard = dnd5eAvailableSpellModifierIntents(character({
      charClass: '法师',
      level: 14,
      dnd5eClassLevels: { wizard: 14 },
      dnd5eClassChoices: { classes: { wizard: { subclass: 'evocation', selections: {} } } },
      classResources: {},
    }))
    expect(wizard.map((entry) => entry.definition.id)).toEqual([
      'evocation-sculpt-spells',
      'evocation-overchannel',
    ])
  })

  it('同一时间只保留一种主要超魔法，但强效法术可以叠加', () => {
    let selected = new Set<Dnd5eSpellModifierIntentId>()
    selected = toggleDnd5eSpellModifierIntent(selected, 'metamagic-careful')
    selected = toggleDnd5eSpellModifierIntent(selected, 'metamagic-quickened')
    expect([...selected]).toEqual(['metamagic-quickened'])
    selected = toggleDnd5eSpellModifierIntent(selected, 'metamagic-empowered')
    expect([...selected]).toEqual(['metamagic-quickened', 'metamagic-empowered'])
  })

  it('将谨慎法术解析为需要补充目标的 Host 白名单选项', () => {
    const result = resolveDnd5eSpellModifierIntents({
      character: character(),
      castingClassId: 'sorcerer',
      spellId: 'fireball',
      slotLevel: 3,
      modifierIds: ['metamagic-careful'],
    })
    expect(result).toMatchObject({
      ok: true,
      options: { metamagic: { kind: 'careful' } },
      effectiveEconomy: 'action',
      requiresTargetConfiguration: true,
      resourceCosts: { 'dnd5e-sorcery-points': 1 },
    })
  })

  it('瞬发法术切换为附赠动作，并允许强效法术并用', () => {
    const result = resolveDnd5eSpellModifierIntents({
      character: character(),
      castingClassId: 'sorcerer',
      spellId: 'fire-bolt',
      slotLevel: 0,
      modifierIds: ['metamagic-quickened', 'metamagic-empowered'],
    })
    expect(result).toMatchObject({
      ok: true,
      options: { metamagic: { kind: 'quickened' }, empowered: true },
      effectiveEconomy: 'bonus-action',
      resourceCosts: { 'dnd5e-sorcery-points': 3 },
    })
  })

  it('合并计算资源消耗并在总费用超出时拒绝', () => {
    const result = resolveDnd5eSpellModifierIntents({
      character: character({
        classResources: { 'dnd5e-sorcery-points': { current: 2, max: 10 } },
      }),
      castingClassId: 'sorcerer',
      spellId: 'fire-bolt',
      slotLevel: 0,
      modifierIds: ['metamagic-quickened', 'metamagic-empowered'],
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('')).toContain('资源不足')
  })

  it('拒绝未拥有能力、错误施法来源与不兼容法术', () => {
    const unowned = resolveDnd5eSpellModifierIntents({
      character: character(),
      castingClassId: 'sorcerer',
      spellId: 'fireball',
      slotLevel: 3,
      modifierIds: ['metamagic-twinned'],
    })
    expect(unowned.ok).toBe(false)
    expect(unowned.reasons.join('')).toContain('未拥有')

    const wrongSource = resolveDnd5eSpellModifierIntents({
      character: character(),
      castingClassId: 'wizard',
      spellId: 'fireball',
      slotLevel: 3,
      modifierIds: ['metamagic-careful'],
    })
    expect(wrongSource.ok).toBe(false)
    expect(wrongSource.reasons.join('')).toContain('术士施法来源')
  })

  it('只从白名单布尔字段重建稳定的意图 ID', () => {
    expect(dnd5eSpellModifierIntentIdsFromOptions({
      sculptSpell: true,
      metamagic: { kind: 'heightened', heightenedTargetId: 'enemy' },
      empowered: true,
    })).toEqual([
      'evocation-sculpt-spells',
      'metamagic-heightened',
      'metamagic-empowered',
    ])
  })
})
