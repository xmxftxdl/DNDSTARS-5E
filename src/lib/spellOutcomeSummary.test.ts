import { describe, expect, it } from 'vitest'
import { legacyPlayerSpellSummary, spellOutcomeSummary } from './spellOutcomeSummary'
import type { Dnd5eCombatEvent } from '../rulesets/dnd5e/headlessCombatEngine'

const base = { spellId: 'test-spell', actorId: 'caster', resolveName: (id: string) => id === 'target' ? '地精' : '法师' }
describe('player spell outcome summaries', () => {
  it('totals actual damage per target, without exposing HP or DC', () => {
    const event = { type: 'damage-applied' as const, targetId: 'target', amount: 4, hpBefore: 20, hpAfter: 16, temporaryHpBefore: 0, temporaryHpAfter: 0, damageTypes: ['fire' as const] }
    const text = spellOutcomeSummary({ ...base, events: [event, { ...event, amount: 7, hpBefore: 16, hpAfter: 9 }] })
    expect(text).toBe('地精受到 11 点火焰伤害')
  })
  it('does not claim a spell succeeded when it was counterspelled', () => {
    const event: Dnd5eCombatEvent = { type: 'counterspell-resolved', actorId: 'target', casterId: 'caster', spellId: 'test-spell', spellLevel: 3, slotLevel: 3, success: true }
    expect(spellOutcomeSummary({ ...base, events: [event], createdAreaCount: 1 })).toBe('被法术反制，未产生法术效果')
  })
  it('gives rope instructions only when the map actually created its area', () => {
    expect(spellOutcomeSummary({ ...base, spellId: 'rope-trick', events: [] })).not.toContain('空间已创建')
    expect(spellOutcomeSummary({ ...base, spellId: 'rope-trick', events: [], createdAreaCount: 1 })).toContain('可点击地图上的绳索')
  })
  it('describes actual healing and observed effects', () => {
    expect(spellOutcomeSummary({ ...base, events: [
      { type: 'healing-applied', targetId: 'target', amount: 3, hpBefore: 10, hpAfter: 13 },
      { type: 'active-effect-applied', targetId: 'target', effectId: 'effect', definitionId: 'mirror-image', logContext: { effect: { label: '镜影术', source: { kind: 'spell', rulesId: 'mirror-image' }, duration: { type: 'rounds', remainingRounds: 10, tickOn: 'source-turn-start' } } } },
    ] })).toContain('地精恢复 3 点生命值；地精获得镜影术效果')
  })
  it('changes only legacy boilerplate, without fabricating historical outcomes', () => {
    expect(legacyPlayerSpellSummary('法师施放插件法术魔绳术（2环位）：统一 Activity 已结算。')).toBe('法师施放魔绳术（2环位）：施法已完成，具体效果见结算详情。')
    expect(legacyPlayerSpellSummary('法师施放火球术，造成 20 点伤害。')).toBe('法师施放火球术，造成 20 点伤害。')
  })
})
