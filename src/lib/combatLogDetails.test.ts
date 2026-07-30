import { describe, expect, it } from 'vitest'
import { formatDnd5eCombatLogDetails } from './combatLogDetails'

describe('formatDnd5eCombatLogDetails', () => {
  const resolveName = (id: string) => ({
    hero: '艾莉雅',
    wizard: '新冒险者',
    target: '针刺魔',
    wolf: '恐狼',
    'barbed-devil': '针刺魔',
  })[id] ?? id

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

  it('解释范围法术成功豁免减半后被伤害免疫归零', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-saving-throw-damage-resolved',
      actorId: 'hero',
      targetId: 'barbed-devil',
      spellId: 'burning-hands',
      ability: 'dex',
      saveSucceeded: true,
      successfulSave: 'half',
      damageBeforeSavingThrow: 15,
      damageAfterSavingThrow: 7,
      finalDamage: 0,
      components: [{
        damageType: 'fire',
        damageBeforeSavingThrow: 15,
        damageAfterSavingThrow: 7,
        finalDamage: 0,
        defenses: [{
          kind: 'immune',
          multiplier: 0,
          damageBefore: 7,
          damageAfter: 0,
          reasons: ['static:immune:fire'],
        }],
      }],
    }], { resolveName })

    expect(details).toContain('燃烧之手伤害 15；豁免成功减半为 7；针刺魔火焰免疫，最终 0')
  })

  it('展开强化塑能来源以及魔法飞弹的公式、逐枚伤害和总伤害', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'spell-damage-feature-bonus-applied',
        actorId: 'wizard',
        spellId: 'magic-missile',
        featureId: 'evocation-empowered',
        ability: 'int',
        amount: 4,
        application: 'first-projectile',
      },
      {
        type: 'magic-missile-damage-resolved',
        actorId: 'wizard',
        spellId: 'magic-missile',
        slotLevel: 3,
        dieSides: 4,
        baseBonusPerProjectile: 1,
        projectiles: [
          {
            targetId: 'target',
            dieRoll: 4,
            featureBonus: 4,
            cuttingWordsReduction: 0,
            damageBeforeDefenses: 9,
            finalDamage: 9,
            outcome: 'damage',
          },
          {
            targetId: 'target',
            dieRoll: 3,
            featureBonus: 0,
            cuttingWordsReduction: 0,
            damageBeforeDefenses: 4,
            finalDamage: 4,
            outcome: 'damage',
          },
          {
            targetId: 'target',
            dieRoll: 2,
            featureBonus: 0,
            cuttingWordsReduction: 0,
            damageBeforeDefenses: 3,
            finalDamage: 3,
            outcome: 'damage',
          },
          {
            targetId: 'target',
            dieRoll: 1,
            featureBonus: 0,
            cuttingWordsReduction: 0,
            damageBeforeDefenses: 2,
            finalDamage: 2,
            outcome: 'damage',
          },
          {
            targetId: 'target',
            dieRoll: 4,
            featureBonus: 0,
            cuttingWordsReduction: 0,
            damageBeforeDefenses: 5,
            finalDamage: 5,
            outcome: 'damage',
          },
        ],
        totalDamage: 23,
      },
    ], { resolveName })

    expect(details).toContain(
      '新冒险者｜法师特性「强化塑能」｜智力调整值 +4 加入魔法飞弹的第一枚飞弹的伤害掷骰',
    )
    expect(details).toContain(
      '新冒险者｜魔法飞弹（3环）｜共 5 枚｜每枚 1d4+1 力场伤害',
    )
    expect(details).toContain(
      '逐枚结算｜#1 → 针刺魔：d4(4) +1 强化塑能（智力）+4 = 9；#2 → 针刺魔：d4(3) +1 = 4；#3 → 针刺魔：d4(2) +1 = 3；#4 → 针刺魔：d4(1) +1 = 2；#5 → 针刺魔：d4(4) +1 = 5',
    )
    expect(details).toContain('魔法飞弹总伤害｜23 点｜实际生效 5/5 枚')
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
