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

  it('projects movement positions into the current map grid when supplied', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'moved', actorId: 'hero', distance: 10,
        from: { x: 542.5, y: 542.5 }, to: { x: 472.5, y: 472.5 },
      },
      {
        type: 'teleported', actorId: 'hero', spellId: 'misty-step', distanceFeet: 30,
        from: { x: 472.5, y: 472.5 }, to: { x: 262.5, y: 332.5 },
        fromElevationFeet: 0, toElevationFeet: 0,
      },
    ], {
      resolveName,
      formatPosition: ({ x, y }) => `格（X=${Math.floor(x / 70)}, Y=${Math.floor(y / 70)}）`,
    })

    expect(details).toContain('艾莉雅｜移动 10 尺｜格（X=7, Y=7） → 格（X=6, Y=6）')
    expect(details).toContain('艾莉雅｜misty-step传送 30 尺｜格（X=6, Y=6） → 格（X=3, Y=4）')
  })

  it('records condition, resource, contest, and falling outcomes in one audit trail', () => {
    const details = formatDnd5eCombatLogDetails([
      { type: 'class-resource-spent', actorId: 'hero', resourceKey: 'dnd5e-ki', current: 2, max: 3 },
      { type: 'turn-resource-spent', actorId: 'hero', resource: 'reaction' },
      { type: 'class-state-changed', actorId: 'hero', stateKey: 'shield-spell', active: true, value: 1 },
      { type: 'contest-resolved', actorId: 'hero', targetId: 'wolf', contest: 'shove', targetDefense: 'athletics', actorTotal: 17, targetTotal: 9, success: true, outcome: 'push' },
      { type: 'falling-damage-resolved', actorId: 'wolf', distanceFeet: 20, dice: 2, damage: 8, landedProne: true },
    ], { resolveName })

    expect(details).toContain('艾莉雅｜消耗气｜剩余 2/3')
    expect(details).toContain('艾莉雅｜消耗反应')
    expect(details).toContain('艾莉雅｜护盾术生效｜数值 1')
    expect(details).toContain('艾莉雅 → 恐狼｜推撞 17 vs 9｜成功｜推开')
    expect(details).toContain('恐狼｜坠落 20 尺｜2d6 = 8 点伤害｜落地倒地')
  })
})
