import { describe, expect, it } from 'vitest'
import { formatDnd5eCombatLogDetails } from './combatLogDetails'

describe('formatDnd5eCombatLogDetails', () => {
  const resolveName = (id: string) => ({ hero: '艾莉雅', wolf: '恐狼' })[id] ?? id

  it('展开命中、伤害、生命值和豁免过程', () => {
    const details = formatDnd5eCombatLogDetails([
      { type: 'attack-resolved', actorId: 'hero', targetId: 'wolf', d20: 14, total: 19, armorClass: 15, hit: true, critical: false },
      { type: 'damage-applied', sourceId: 'hero', targetId: 'wolf', amount: 8, hpBefore: 22, hpAfter: 14, temporaryHpBefore: 2, temporaryHpAfter: 0 },
      { type: 'saving-throw-resolved', targetId: 'wolf', ability: 'str', d20: 7, modifier: 3, total: 10, dc: 13, success: false },
    ], { resolveName })

    expect(details).toContain('艾莉雅 → 恐狼｜命中检定 d20 14，总值 19 vs AC 15｜命中')
    expect(details).toContain('恐狼｜受到 8 点伤害｜HP 22 → 14｜临时 HP 2 → 0')
    expect(details).toContain('恐狼｜力量豁免 d20 7 +3 = 10 vs DC 13｜失败')
  })

  it('显示资源消耗，并限制过长的明细', () => {
    const details = formatDnd5eCombatLogDetails([
      { type: 'turn-resource-spent', actorId: 'hero', resource: 'action' },
      { type: 'class-resource-spent', actorId: 'hero', resourceKey: 'superiorityDice', current: 2, max: 4 },
    ], { resolveName, extra: ['长剑｜1d8 挥砍伤害'], limit: 2 })

    expect(details[0]).toBe('长剑｜1d8 挥砍伤害')
    expect(details[1]).toBe('艾莉雅｜消耗动作')
    expect(details[2]).toBe('另有 1 项结算事件未展开')
  })
})
