import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  dnd5ePluginSubclassSpellIds,
  registerDnd5eRulesPlugin,
} from './pluginApi'
import { buildDnd5eSpellAdvancementPlanFromSelections } from './spellAdvancement'
import {
  dnd5eSelectedSpellIdsForClass,
  dnd5eSpellcastingClassIdForSpell,
} from './spells'

const PLUGIN_ID = 'com.example.subclass-spell-lists'
const ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 16 }

function passive(id: string) {
  return {
    schemaVersion: 1 as const,
    id,
    name: id,
    description: '测试子职法术表。',
    level: 1,
    trigger: { kind: 'active-use' as const },
    targeting: { kind: 'self' as const },
    effects: [],
    automation: 'manual' as const,
  }
}

const domain: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'test-domain',
  classId: 'cleric',
  name: '测试领域',
  summary: '验证始终准备法术。',
  spellLists: [{
    id: 'domain-spells',
    name: '领域法术',
    mode: 'always-prepared',
    entries: [
      { classLevel: 1, spellIds: ['fireball', 'local-radiance'] },
      { classLevel: 5, spellIds: ['haste'] },
    ],
  }],
  abilities: [passive('domain-spells')],
}

const patron: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'test-patron',
  classId: 'warlock',
  name: '测试宗主',
  summary: '验证扩展法术选择。',
  spellLists: [{
    id: 'expanded-spells',
    name: '扩展法术',
    mode: 'expanded-list',
    entries: [{ classLevel: 1, spellIds: ['faerie-fire'] }],
  }],
  abilities: [passive('expanded-spells')],
}

function cleric(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'cleric', name: 'Cleric', player: '', avatar: '', accent: '',
    race: '人类', charClass: '牧师', level: 5, background: '侍僧', experience: 0, reputation: 0,
    abilities: ABILITIES, savingThrows: [], skills: [], maxHp: 30, currentHp: 30, tempHp: 0,
    hitDice: '5d8', ac: 16, speed: 30, initiativeBonus: 0, saveDC: 14, passivePerception: 10,
    inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: {
      classes: {
        cleric: {
          subclass: `${PLUGIN_ID}:test-domain`,
          selections: { 'spell-prepared': [] },
        },
      },
    },
  }
}

describe('declarative subclass spell lists', () => {
  it('grants always-prepared spells and exposes expanded-list spells to advancement', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Subclass Spell Lists',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Test',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerSpell({
          id: 'local-radiance',
          name: '本地辉光',
          level: 1,
          school: 'evocation',
          ritual: false,
          castingTime: { value: 1, unit: 'action' },
          range: { type: 'distance', feet: 30 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false },
          classes: ['cleric'],
          description: '测试同一个插件内的法术引用会自动取得命名空间。',
        })
        api.registerDeclarativeSubclass(domain)
        api.registerDeclarativeSubclass(patron)
      },
    })
    try {
      expect(dnd5ePluginSubclassSpellIds(`${PLUGIN_ID}:test-domain`, 4, 'always-prepared'))
        .toEqual(['fireball', `${PLUGIN_ID}:local-radiance`])
      expect(dnd5ePluginSubclassSpellIds(`${PLUGIN_ID}:test-domain`, 5, 'always-prepared'))
        .toEqual(['fireball', `${PLUGIN_ID}:local-radiance`, 'haste'])
      expect(dnd5eSelectedSpellIdsForClass(cleric(), 'cleric')).toEqual(
        expect.arrayContaining(['fireball', `${PLUGIN_ID}:local-radiance`, 'haste']),
      )
      expect(dnd5eSpellcastingClassIdForSpell(cleric(), 'fireball', 'cleric', ['wizard']))
        .toBe('cleric')

      const plan = buildDnd5eSpellAdvancementPlanFromSelections({
        classId: 'warlock',
        fromClassLevel: 0,
        toClassLevel: 1,
        subclassId: `${PLUGIN_ID}:test-patron`,
        selections: {},
      })
      expect(plan?.spellOptions.map((spell) => spell.id)).toContain('faerie-fire')
    } finally {
      dispose()
    }
  })
})
