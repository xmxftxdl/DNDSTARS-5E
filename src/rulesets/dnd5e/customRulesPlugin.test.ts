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
    expect(source).toContain('api.registerHeadlessAction(compileHeadlessAction(action))')
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

  it('compiles damage, healing, condition and interrupt settings into a capability-only resolver', () => {
    const value = draft()
    value.features = [{
      id: 'stellar-pulse', name: '星辉脉冲', summary: '测试自动特性。', description: '结算组合效果。',
      minimumLevel: 1, automation: 'full',
      action: {
        id: 'stellar-pulse', label: '释放星辉脉冲', economy: 'action',
        targeting: { kind: 'area', relation: 'enemy', maximumTargets: 8, template: {
          shape: 'circle', origin: 'point', radiusFeet: 10, placeRangeFeet: 60,
        } },
        interrupt: {
          prompt: '是否结算？', audience: 'dm',
          options: [{ id: 'apply', label: '结算' }, { id: 'cancel', label: '取消' }],
          defaultOptionId: 'cancel', timeoutMs: 30_000,
        },
      },
    }]
    value.headlessActions = [{
      id: 'stellar-pulse', label: '星辉脉冲', requiredInterruptOptionId: 'apply',
      effects: [
        { kind: 'damage', dice: { count: 2, sides: 6, modifier: 1 }, damageType: 'radiant' },
        { kind: 'healing', dice: { count: 1, sides: 4, modifier: 2 } },
        { kind: 'condition', condition: 'blinded', duration: {
          expiresAt: 'target-turn-end-save', remainingRounds: 2, saveAbility: 'con', saveDc: 14,
        } },
      ],
    }]
    const source = buildDnd5eCustomRulesPluginSource(value)
    const executable = source.replace('export default plugin;', 'return plugin;')
    const plugin = new Function(executable)() as {
      setup(api: Record<string, (...args: unknown[]) => unknown>): void
    }
    let action: {
      rolls: { id: string; count: number; sides: number; modifier: number }[]
      resolve(context: Record<string, unknown>): { kind: string; reason?: string }
    } | undefined
    const api = new Proxy({}, {
      get: (_target, key) => key === 'registerHeadlessAction'
        ? (definition: typeof action) => { action = definition }
        : () => undefined,
    }) as Record<string, (...args: unknown[]) => unknown>
    plugin.setup(api)
    expect(action?.rolls).toEqual([
      expect.objectContaining({ id: 'effect-0', count: 2, sides: 6, modifier: 1 }),
      expect.objectContaining({ id: 'effect-1', count: 1, sides: 4, modifier: 2 }),
    ])
    const operations: unknown[] = []
    const context = {
      action: { interruptChoiceId: 'apply' }, actor: { id: 'actor' }, target: { id: 'target' },
      targets: [{ id: 'target' }],
      rolls: { 'effect-0': { total: 9 }, 'effect-1': { total: 5 } },
      dealDamage: (targetId: string, amount: number, damageType: string) => operations.push({ kind: 'damage', targetId, amount, damageType }),
      heal: (targetId: string, amount: number) => operations.push({ kind: 'healing', targetId, amount }),
      applyStandardCondition: (targetId: string, condition: string, duration: unknown) => operations.push({ kind: 'condition', targetId, condition, duration }),
      fail: (reason: string) => ({ kind: 'failure', reason }),
      succeed: () => ({ kind: 'success' }),
    }
    expect(action?.resolve(context)).toEqual({ kind: 'success' })
    expect(operations).toEqual([
      { kind: 'damage', targetId: 'target', amount: 9, damageType: 'radiant' },
      { kind: 'healing', targetId: 'target', amount: 5 },
      expect.objectContaining({ kind: 'condition', targetId: 'target', condition: 'blinded' }),
    ])
    expect(action?.resolve({ ...context, action: { interruptChoiceId: 'cancel' } })).toEqual({
      kind: 'failure', reason: 'invalid-plugin-action',
    })
  })

  it('rejects automated declarations without a matching Headless recipe', () => {
    const value = draft()
    value.features = [{
      id: 'missing-effect', name: '缺少效果', summary: '测试。', description: '测试。',
      automation: 'full',
      action: { id: 'missing-effect', label: '使用', economy: 'action', targeting: { kind: 'self' } },
    }]
    expect(validateDnd5eCustomRulesPluginDraft(value)).toContain('自动化行动 missing-effect 缺少 Headless 效果配方。')
  })
})
