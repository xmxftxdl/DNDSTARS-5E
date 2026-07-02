import { describe, expect, it } from 'vitest'
import {
  applyTraitFeatureRank,
  CLASS_FEATURE_DEFS,
  createClassTrait,
  formatFeatureDescription,
  getClassFeatureDef,
  isArcherLineFeatureKey,
  maxQiForLevel,
  piercingInsightExtraD4,
  piercingInsightHpThresholdPercent,
  syncQiForCharacter,
  TRAIT_CHOICE_GROUPS,
  type ClassFeatureKey,
} from './traitRegistry'
import type { Character } from '../types/character'

const DOC_GROUPS = [
  ['archer-lv1', 1, ['doubleArrow', 'armorPiercingArrow']],
  ['archer-lv3', 3, ['stableMind', 'eagleEye']],
  ['archer-lv5', 5, ['preciseStrike', 'galeCombo']],
  ['archer-lv8', 8, ['agileLeap', 'wildernessGuide']],
  ['archer-lv12', 12, ['piercingInsight', 'silentDraw']],
  ['windrunner-lv15', 15, ['animalMastery', 'calmMind', 'arcaneSurge']],
  ['windrunner-lv20', 20, ['huntingMark', 'arcaneDevour', 'calmSpirit']],
  ['windrunner-lv25', 25, ['trackingArrow', 'explosiveArrow', 'runeArrow']],
  ['windrunner-lv30', 30, ['swiftShot', 'huntingCombo', 'swiftRecall']],
  ['windrunner-lv35', 35, ['focusedSpirit', 'shadowVeil']],
  ['windrunner-lv40', 40, ['stillWater', 'finale', 'arcaneDance']],
  ['shadowdancer-lv15', 15, ['galeDancer', 'takeoff']],
  ['shadowdancer-lv20', 20, ['comboFist', 'multiStrike']],
  ['shadowdancer-lv25', 25, ['illusionDance', 'flexibleBody']],
  ['shadowdancer-lv30', 30, ['waterWalk', 'heavyFist']],
  ['shadowdancer-lv35', 35, ['critBlock', 'fateShackle']],
  ['shadowdancer-lv40', 40, ['showtime', 'windBlade']],
] as const

function shadowDancerForQi(patch: Partial<Character>): Character {
  return {
    id: 'qi-test',
    name: '影舞者',
    player: '',
    avatar: '',
    accent: '',
    race: '',
    charClass: '影舞者',
    level: 30,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 1,
    currentHp: 1,
    tempHp: 0,
    hitDice: '1d6',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
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

const DOC_FEATURE_KEYS = new Set<ClassFeatureKey>([
  'doubleArrow',
  'armorPiercingArrow',
  'stableMind',
  'eagleEye',
  'preciseStrike',
  'galeCombo',
  'agileLeap',
  'wildernessGuide',
  'piercingInsight',
  'silentDraw',
  'animalMastery',
  'calmMind',
  'arcaneSurge',
  'huntingMark',
  'arcaneDevour',
  'calmSpirit',
  'trackingArrow',
  'explosiveArrow',
  'runeArrow',
  'swiftShot',
  'huntingCombo',
  'swiftRecall',
  'focusedSpirit',
  'shadowVeil',
  'stillWater',
  'finale',
  'arcaneDance',
  'galeDancer',
  'takeoff',
  'comboFist',
  'multiStrike',
  'illusionDance',
  'flexibleBody',
  'waterWalk',
  'heavyFist',
  'critBlock',
  'fateShackle',
  'showtime',
  'windBlade',
  'transcendentSoul',
])

describe('archer document feature config', () => {
  it('matches the document choice levels and feature options', () => {
    for (const [id, minLevel, featureKeys] of DOC_GROUPS) {
      const group = TRAIT_CHOICE_GROUPS.find((g) => g.id === id)
      expect(group, id).toBeTruthy()
      expect(group!.minLevel, id).toBe(minLevel)
      expect(group!.options.filter((o) => o.kind === 'feature').map((o) => o.featureKey), id).toEqual(featureKeys)
    }

    const auto = TRAIT_CHOICE_GROUPS.find((g) => g.id === 'shadowdancer-lv45')
    expect(auto?.minLevel).toBe(45)
    expect(auto?.autoGrantFeatures).toEqual(['transcendentSoul'])
  })

  it('has no extra active archer-line features outside the document', () => {
    for (const def of CLASS_FEATURE_DEFS) {
      if (def.deprecated) continue
      expect(DOC_FEATURE_KEYS.has(def.key), def.key).toBe(true)
      expect(isArcherLineFeatureKey(def.key), def.key).toBe(true)
    }
  })

  it('formats every document feature at ranks 1-4 without stale placeholders', () => {
    for (const key of DOC_FEATURE_KEYS) {
      const def = getClassFeatureDef(key)
      expect(def, key).toBeTruthy()
      for (const rank of [1, 2, 3, 4]) {
        const trait = applyTraitFeatureRank(createClassTrait(key), rank)
        const text = formatFeatureDescription(def!, rank)
        expect(trait.name, key).toBe(def!.name)
        expect(text, `${key}@${rank}`).not.toMatch(/\{(?:uses|rank|range|dice|value)\}/)
      }
    }
  })

  it('uses the current names for restored features', () => {
    expect(getClassFeatureDef('stableMind')?.name).toBe('残影脱身')
    expect(getClassFeatureDef('swiftShot')?.name).toBe('波澜不惊')
    expect(getClassFeatureDef('swiftShot')?.description).toContain('切换静心/气喘状态')
    expect(getClassFeatureDef('finale')?.description).toContain('消耗 2 AP')
  })

  it('documents piercing insight hp thresholds and extra damage by rank', () => {
    expect([1, 2, 3, 4].map(piercingInsightHpThresholdPercent)).toEqual([20, 25, 40, 50])
    expect([1, 2, 3, 4].map(piercingInsightExtraD4)).toEqual([1, 2, 2, 3])
    const def = getClassFeatureDef('piercingInsight')!
    expect([1, 2, 3, 4].map((rank) => formatFeatureDescription(def, rank))).toEqual([
      '当你攻击一名生命值少于 20% 的敌人时，额外造成 1D4 点穿刺伤害。',
      '当你攻击一名生命值少于 25% 的敌人时，额外造成 2D4 点穿刺伤害。',
      '当你攻击一名生命值少于 40% 的敌人时，额外造成 2D4 点穿刺伤害。',
      '当你攻击一名生命值少于 50% 的敌人时，额外造成 3D4 点穿刺伤害。',
    ])
  })

  it('preserves current shadow dancer qi while syncing derived character data', () => {
    expect(maxQiForLevel(30)).toBe(99)
    expect(syncQiForCharacter(shadowDancerForQi({ qi: 98 })).qi).toBe(98)
    expect(syncQiForCharacter(shadowDancerForQi({ qi: undefined })).qi).toBe(99)
    expect(syncQiForCharacter(shadowDancerForQi({ qi: 120 })).qi).toBe(99)
  })
})
