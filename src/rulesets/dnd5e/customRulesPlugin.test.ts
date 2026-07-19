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
})
