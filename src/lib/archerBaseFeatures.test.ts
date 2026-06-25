import { describe, expect, it } from 'vitest'
import type { Character, CombatSkill, Trait } from '../types/character'
import {
  agileLeapMoveFeet,
  canOfferAgileLeap,
  resolveDodgeCheck,
} from './archerBaseFeatures'
import { applyTraitFeatureRank, canUseDoubleArrow, createClassTrait } from './classFeatures'

function makeCharacter(patch: Partial<Character> = {}): Character {
  return {
    id: 'test-char',
    name: 'Test Character',
    player: '',
    avatar: '',
    accent: '',
    race: '',
    charClass: '',
    level: 8,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d8',
    ac: 14,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    actionPoints: 2,
    currentAP: 2,
    passivePerception: 10,
    inspiration: 0,
    mana: 0,
    maxMana: 0,
    traits: [],
    combatSkills: [],
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function agileLeapTrait(level: number, uses = 2): Trait {
  return {
    ...createClassTrait('agileLeap'),
    level,
    uses,
    maxUses: 2,
  }
}

describe('resolveDodgeCheck', () => {
  it('succeeds when the incoming attack total is lower than AC', () => {
    const target = makeCharacter({ ac: 14 })

    expect(resolveDodgeCheck(target, 4, 9)).toMatchObject({
      dodged: true,
      d20: 9,
      attackBonus: 4,
      total: 13,
      targetAc: 14,
    })
  })

  it('fails when the incoming attack total meets AC', () => {
    const target = makeCharacter({ ac: 14 })

    expect(resolveDodgeCheck(target, 4, 10)).toMatchObject({
      dodged: false,
      total: 14,
      targetAc: 14,
    })
  })
})

describe('agileLeap', () => {
  it('has two long-rest uses regardless of rank and scales movement by 5 feet per rank', () => {
    expect(agileLeapMoveFeet(makeCharacter())).toBe(0)
    expect(agileLeapMoveFeet(makeCharacter({ traits: [agileLeapTrait(1)] }))).toBe(10)
    expect(agileLeapMoveFeet(makeCharacter({ traits: [agileLeapTrait(2)] }))).toBe(15)
    expect(agileLeapMoveFeet(makeCharacter({ traits: [agileLeapTrait(4)] }))).toBe(25)
  })

  it('can only be offered while the feature has remaining uses', () => {
    expect(canOfferAgileLeap(makeCharacter())).toBe(false)
    expect(canOfferAgileLeap(makeCharacter({ traits: [agileLeapTrait(1, 0)] }))).toBe(false)
    expect(canOfferAgileLeap(makeCharacter({ traits: [agileLeapTrait(1, 1)] }))).toBe(true)
  })

  it('is not offered again while a leap movement is already pending', () => {
    expect(
      canOfferAgileLeap(
        makeCharacter({
          traits: [agileLeapTrait(1, 1)],
          combatBuffs: { agileLeapMoveFeet: 10 },
        }),
      ),
    ).toBe(false)
  })
})

describe('doubleArrow', () => {
  const basicShot = {
    id: 'basic-shot',
    name: '基础射击',
    skillTreeId: 'basicShot',
    damageCount: 1,
    damageSides: 8,
    damageBonus: 0,
    arrowShots: 1,
    tags: ['ranged'],
  } as CombatSkill

  it('starts at two long-rest uses and gains one use per feature rank', () => {
    const rank1 = createClassTrait('doubleArrow')
    const rank3 = applyTraitFeatureRank(rank1, 3)

    expect(rank1.maxUses).toBe(2)
    expect(rank1.uses).toBe(2)
    expect(rank3.maxUses).toBe(4)
    expect(rank3.uses).toBe(4)
  })

  it('only applies to a one-arrow ranged basic shot', () => {
    const character = makeCharacter({ traits: [createClassTrait('doubleArrow')] })

    expect(canUseDoubleArrow(character, basicShot)).toBe(true)
    expect(canUseDoubleArrow(character, { ...basicShot, arrowShots: 2 })).toBe(false)
    expect(
      canUseDoubleArrow(character, {
        ...basicShot,
        id: 'non-basic',
        name: '多重射击',
        skillTreeId: 'multiShot',
      }),
    ).toBe(false)
  })
})
