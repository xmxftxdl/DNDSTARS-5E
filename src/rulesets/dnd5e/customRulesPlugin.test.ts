import { describe, expect, it } from 'vitest'
import {
  buildDnd5eCustomRulesPluginSource,
  validateDnd5eCustomRulesPluginDraft,
  type Dnd5eCustomRulesPluginDraft,
} from './customRulesPlugin'

function draft(): Dnd5eCustomRulesPluginDraft {
  return {
    manifest: {
      id: 'local.dm.character-rules',
      name: '房间角色规则',
      version: '1.0.0',
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'DM',
      license: '自定义内容；由房间 DM 负责授权',
    },
    races: [{
      id: 'starfolk',
      name: '星裔',
      speedFeet: 30,
      abilityBonuses: { cha: 2 },
      flexibleAbilityBonus: { count: 1, amount: 1, exclude: ['cha'] },
    }],
    backgrounds: [],
    features: [],
    spells: [],
    items: [],
    abilityGenerationMethods: [{
      id: 'heroic-array',
      name: '英雄数组',
      summary: 'DM 自定义数组。',
      kind: 'standard-array',
      scores: [16, 15, 14, 12, 10, 8],
    }],
  }
}

describe('DM custom rules plugin builder', () => {
  it('emits a self-contained sandbox-compatible module', () => {
    const source = buildDnd5eCustomRulesPluginSource(draft())
    expect(source).toContain('api.registerRace(race)')
    expect(source).toContain('api.registerAbilityGenerationMethod(method)')
    expect(source).toContain('api.registerBackground(background)')
    expect(source).toContain('api.registerFeature(feature)')
    expect(source).toContain('api.registerSpell(spell)')
    expect(source).toContain('api.registerItem(item)')
    expect(source.trimEnd()).toMatch(/export default plugin;$/)
  })

  it('rejects incomplete point-buy tables', () => {
    const value = draft()
    value.abilityGenerationMethods = [{
      id: 'broken-buy', name: '错误购点', summary: '缺少成本。', kind: 'point-buy',
      budget: 27, minimum: 8, maximum: 10, costs: { 8: 0, 9: 1 },
    }]
    expect(validateDnd5eCustomRulesPluginDraft(value)).toContain('购点规则 错误购点 的 10 分成本无效。')
  })

  it('serializes background, feature, spell and item forms into one installable package', () => {
    const value = draft()
    value.backgrounds = [{ id: 'observer', name: '观察者', skillProficiencies: ['insight', 'perception'] }]
    value.features = [{
      id: 'steady-eye', name: '沉着观察', summary: '测试特性。', description: '由 DM 裁定。',
      minimumLevel: 1, automation: 'manual',
    }]
    value.spells = [{
      id: 'guiding-glow', name: '引导微光', level: 0, school: 'evocation', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
      components: { verbal: true, somatic: true, material: false },
      duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'],
      description: '原创测试法术。', automation: { mode: 'reference-only' },
    }]
    value.items = [{
      id: 'observer-ring', name: '观察者戒指', category: 'equipment', icon: 'generic',
      description: '测试装备。', rulesText: '察看 UI 注册结果。', stackable: false,
      equipment: { slot: 'ring', effects: { savingThrowBonus: 1 } },
    }]
    const source = buildDnd5eCustomRulesPluginSource(value)
    expect(source).toContain('"observer-ring"')
    expect(source).toContain('"guiding-glow"')
    expect(source).toContain('api.registerBackground(background)')
    expect(validateDnd5eCustomRulesPluginDraft(value)).toEqual([])
  })
})
