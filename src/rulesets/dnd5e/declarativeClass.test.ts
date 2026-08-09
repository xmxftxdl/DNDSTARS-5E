import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  DND5E_DECLARATIVE_CLASS_SCHEMA_VERSION,
  declarativeClassContentBindingV1,
  declarativeClassCompatibilityReportV1,
  resolveDeclarativeClassAdvancementV1,
  validateDeclarativeClassDefinitionV1,
  type DeclarativeClassDefinitionV1,
} from './declarativeClass'
import { dnd5eAttacksPerAttackAction, dnd5eClassDefinition } from './classes'
import { classResourceDefinitions, restoreClassResources, syncCharacterClassResources } from '../../lib/classResources'
import { dnd5eStartingEquipmentPlan } from './startingEquipment'
import { migrateCharacterToDnd5e } from './character'
import {
  dnd5eD20ChoiceRerollFeaturesForCharacter,
  dnd5ePluginFeatAvailableForCharacter,
  dnd5eCharacterHasPluginFeature,
  registerDnd5eRulesPlugin,
  registeredDnd5ePluginFeats,
} from './pluginApi'

function classDefinition(): DeclarativeClassDefinitionV1 {
  return {
    schemaVersion: DND5E_DECLARATIVE_CLASS_SCHEMA_VERSION,
    id: 'warden',
    name: '守望者',
    summary: '测试声明式职业。',
    hitDie: 10,
    primaryAbilities: ['wis'],
    savingThrows: ['wis', 'con'],
    armorProficiencies: ['轻甲', '中甲'],
    weaponProficiencies: ['简易武器'],
    skills: { choiceCount: 2, options: ['perception', 'survival'] },
    multiclassPrerequisites: [{ oneOf: ['wis'], minimum: 13 }],
    features: [{ id: 'watchful', level: 1, name: '警觉守望', description: '由 DM 裁定。', automation: 'manual' }],
    spellcasting: { kind: 'half-prepared', ability: 'wis', ritualCasting: false, focus: '护符' },
    startingEquipment: {
      fixedGrants: [{ templateId: 'srd-5.1:item:torch', quantity: 2 }],
    },
  }
}

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero', name: 'Hero', player: '', avatar: '', accent: '', race: '人类', charClass: '战士', level: 4,
    background: '侍僧', experience: 0, reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '1d10', ac: 10, speed: 30, initiativeBonus: 0,
    saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

describe('DeclarativeClassV1 and independent feats', () => {
  it('validates, registers and removes a versioned class with starting equipment', () => {
    const definition = classDefinition()
    expect(() => validateDeclarativeClassDefinitionV1(definition)).not.toThrow()
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.declarative-class', name: '职业测试包', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
      },
      setup(api) { api.registerDeclarativeClass(definition) },
    })
    try {
      expect(dnd5eClassDefinition('test.declarative-class:warden')).toMatchObject({ name: '守望者', hitDie: 10 })
      expect(dnd5eClassDefinition('守望者')?.features[0]).toMatchObject({ name: '警觉守望', level: 1 })
      expect(dnd5eStartingEquipmentPlan('守望者', '').fixedGrants).toEqual([
        { templateId: 'srd-5.1:item:torch', quantity: 2 },
      ])
    } finally {
      dispose()
    }
    expect(dnd5eClassDefinition('test.declarative-class:warden')).toBeUndefined()
  })

  it('downgrades class prose instead of silently claiming full Headless automation', () => {
    const definition = classDefinition()
    definition.features = [{ ...definition.features[0], automation: 'full' }]
    expect(declarativeClassCompatibilityReportV1([definition])).toMatchObject({ full: 0, partial: 1, manual: 0 })
  })

  it('resolves level grants, resource growth, ASI, subclass and Extra Attack without mutating a character', () => {
    const definition: DeclarativeClassDefinitionV1 = {
      ...classDefinition(),
      subclass: { level: 3, id: 'path', name: '符文之路', summary: '测试子职。' },
      advancements: [
        { level: 1, grants: ['rune-strike'] },
        { level: 3, subclassChoice: true },
        { level: 4, abilityScoreImprovement: true },
        { level: 5, attacksPerAction: 2 },
      ],
      resources: [{
        id: 'runes', label: '符文充能', shortLabel: '符文', resetOn: 'short-rest',
        maximumByLevel: [2, 2, 3, 3, 4],
      }],
    }
    expect(() => validateDeclarativeClassDefinitionV1(definition)).not.toThrow()
    const resolution = resolveDeclarativeClassAdvancementV1({
      classDefinition: definition, previousLevel: 0, nextLevel: 5, ownerPluginId: 'test.runes',
    })
    expect(resolution).toMatchObject({
      grantedFeatureIds: ['test.runes:rune-strike'],
      subclassSelectionRequired: true,
      abilityScoreImprovementLevels: [4],
      attacksPerAction: 2,
    })
    expect(resolution.resourceUpdates).toEqual([{
      id: 'runes', key: 'test.runes:runes', previousMaximum: 0, maximum: 4,
    }])
    expect(definition.advancements?.[0].grants).toEqual(['rune-strike'])
  })

  it('derives class feature ownership and resources from installed content and actual class level', () => {
    const definition: DeclarativeClassDefinitionV1 = {
      ...classDefinition(),
      advancements: [
        { level: 1, grants: ['rune-strike'] },
        { level: 5, attacksPerAction: 2 },
      ],
      resources: [{ id: 'runes', label: '符文充能', resetOn: 'short-rest', maximumByLevel: [2, 2, 3, 3, 4] }],
    }
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.runes', name: '符文职业包', version: '1.2.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeature({
          id: 'rune-strike', name: '符文打击', summary: '测试。', description: '测试。', automation: 'manual',
        })
        api.registerDeclarativeClass(definition)
      },
    })
    try {
      const warden = character({
        rulesetId: 'dnd5e-2014-srd-5.1', charClass: '守望者', level: 5,
        dnd5eClassLevels: { 'test.runes:warden': 5 },
      })
      expect(dnd5eCharacterHasPluginFeature(warden, 'test.runes:rune-strike')).toBe(true)
      expect(classResourceDefinitions(warden)).toContainEqual(expect.objectContaining({
        key: 'test.runes:runes', label: '符文充能', resetOn: 'short-rest',
      }))
      expect(syncCharacterClassResources(warden).classResources?.['test.runes:runes']).toEqual({ current: 4, max: 4 })
      expect(dnd5eAttacksPerAttackAction(warden)).toBe(2)
      expect(migrateCharacterToDnd5e(warden)).toMatchObject({
        pluginFeatureIds: ['test.runes:rune-strike'],
        classResources: { 'test.runes:runes': { current: 4, max: 4 } },
      })
      expect(declarativeClassContentBindingV1('test.runes:warden')).toEqual({
        classId: 'test.runes:warden', packageId: 'test.runes', packageVersion: '1.2.0', contentVersion: 1,
      })
    } finally {
      dispose()
    }
  })

  it('registers a feat and revalidates level, ability and race prerequisites on the Host', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.feat-editor', name: '专长测试包', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'star-sight', name: '星视', summary: '测试专长。', description: '获得特殊感知。', automation: 'manual',
          prerequisite: { minimumLevel: 4, abilityScores: { wis: 13 }, raceIds: ['人类'] },
        })
      },
    })
    try {
      const feat = registeredDnd5ePluginFeats()[0]
      expect(feat.id).toBe('test.feat-editor:star-sight')
      expect(dnd5ePluginFeatAvailableForCharacter(feat, character())).toBe(true)
      expect(dnd5ePluginFeatAvailableForCharacter(feat, character({ level: 3 }))).toBe(false)
      expect(dnd5ePluginFeatAvailableForCharacter(feat, character({ race: '精灵' }))).toBe(false)
    } finally {
      dispose()
    }
  })

  it('registers feat-owned reroll uses and only exposes the ability while a use remains', () => {
    const pluginId = 'test.choice-reroll-feat'
    const featId = `${pluginId}:lucky`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: '选择重掷测试包', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'lucky', name: '幸运', summary: '选择额外 d20。', description: '结果确定前可选择额外投掷。',
          automation: 'full',
          resources: [{ id: 'luck-points', label: '幸运点', maximum: 3, resetOn: 'long-rest' }],
          declarativeAbility: {
            schemaVersion: 1, id: 'lucky-reroll', name: '幸运', description: '选择额外 d20。', level: 1,
            trigger: { kind: 'after-d20-roll' },
            cost: { economy: 'none', resources: [{ resourceId: 'luck-points', amount: 1 }] },
            targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'd20-choice-reroll',
              rollKinds: ['attack', 'ability-check', 'saving-throw'],
              scopes: ['self-roll', 'attack-against-self'],
              additionalDice: 1,
              selection: 'owner-chooses',
            },
            automation: 'full',
          },
        })
      },
    })
    try {
      const owner = syncCharacterClassResources(character({
        rulesetId: 'dnd5e-2014-srd-5.1',
        dnd5eFeatIds: [featId],
      }))
      expect(owner.classResources?.[`${pluginId}:luck-points`]).toEqual({ current: 3, max: 3 })
      expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'saving-throw', 'self-roll'))
        .toEqual([expect.objectContaining({
          resourceCosts: [{ resourceKey: `${pluginId}:luck-points`, amount: 1 }],
        })])
      expect(dnd5eD20ChoiceRerollFeaturesForCharacter({
        ...owner,
        classResources: { ...owner.classResources, [`${pluginId}:luck-points`]: { current: 0, max: 3 } },
      }, 'saving-throw', 'self-roll')).toEqual([])
      expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'saving-throw', 'attack-against-self')).toEqual([])
      expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'attack', 'attack-against-self')).toHaveLength(1)
      const depleted = {
        ...owner,
        classResources: { ...owner.classResources, [`${pluginId}:luck-points`]: { current: 0, max: 3 } },
      }
      expect(restoreClassResources(depleted, 'short-rest').classResources?.[`${pluginId}:luck-points`]?.current).toBe(0)
      expect(restoreClassResources(depleted, 'long-rest').classResources?.[`${pluginId}:luck-points`]?.current).toBe(3)
    } finally {
      dispose()
    }
  })

  it('rejects unknown fields and invalid class tables fail closed', () => {
    expect(() => validateDeclarativeClassDefinitionV1({ ...classDefinition(), execute: 'alert(1)' })).toThrow('不支持的字段')
    expect(() => validateDeclarativeClassDefinitionV1({
      ...classDefinition(),
      spellcasting: { kind: 'full-known', ability: 'int', ritualCasting: false, focus: '法器', spellsKnown: Array(21).fill(1) },
    })).toThrow('已知法术表无效')
  })
})
