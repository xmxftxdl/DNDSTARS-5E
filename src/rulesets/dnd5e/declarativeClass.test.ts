import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import {
  DND5E_DECLARATIVE_CLASS_SCHEMA_VERSION,
  declarativeClassCompatibilityReportV1,
  validateDeclarativeClassDefinitionV1,
  type DeclarativeClassDefinitionV1,
} from './declarativeClass'
import { dnd5eClassDefinition } from './classes'
import { dnd5eStartingEquipmentPlan } from './startingEquipment'
import {
  dnd5ePluginFeatAvailableForCharacter,
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

  it('rejects unknown fields and invalid class tables fail closed', () => {
    expect(() => validateDeclarativeClassDefinitionV1({ ...classDefinition(), execute: 'alert(1)' })).toThrow('不支持的字段')
    expect(() => validateDeclarativeClassDefinitionV1({
      ...classDefinition(),
      spellcasting: { kind: 'full-known', ability: 'int', ritualCasting: false, focus: '法器', spellsKnown: Array(21).fill(1) },
    })).toThrow('已知法术表无效')
  })
})
