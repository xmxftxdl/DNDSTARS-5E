import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from '../rulesets/dnd5e/headlessCombatEngine'
import { formatDnd5eCombatLogDetails } from './combatLogDetails'

describe('formatDnd5eCombatLogDetails', () => {
  it('does not repeat attack-resolved when a full attack trace is supplied', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'attack-resolved',
      actorId: 'hero',
      targetId: 'wolf',
      d20: 18,
      total: 23,
      armorClass: 12,
      hit: true,
      critical: false,
    }], {
      resolveName: (id) => id,
      extra: [
        '攻击资格 · Headless 已验证目标与距离。',
        '攻击骰 · 普通（1d20）；各骰面 18；最终采用 18；调整值 +5。',
        '结果 · 23 vs AC 12：命中。',
      ],
    })

    expect(details).toContain('攻击骰 · 普通（1d20）；各骰面 18；最终采用 18；调整值 +5。')
    expect(details).toContain('结果 · 23 vs AC 12：命中。')
    expect(details.some((line) => line.includes('命中检定 d20 18'))).toBe(false)
  })

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

  it('默认明细上限仍保留真实 9 环魔法飞弹的公式、逐枚结果和总伤害', () => {
    const abilities = {
      str: 10, dex: 14, con: 14, int: 18, wis: 12, cha: 10,
    } as const
    const wizard = createDnd5eCombatant({
      id: 'wizard',
      name: '新冒险者',
      controller: 'player',
      initiative: 20,
      abilities,
      proficiencyBonus: 4,
      armorClass: 13,
      currentHp: 50,
      maxHp: 50,
      temporaryHp: 0,
      speed: 30,
      position: { x: 0, y: 0 },
      concentrating: false,
      classId: 'wizard',
      subclassId: 'evocation',
      level: 10,
      classSelections: { 'spell-prepared': ['magic-missile'] },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const target = createDnd5eCombatant({
      id: 'target',
      name: '针刺魔',
      controller: 'dm',
      initiative: 10,
      abilities,
      proficiencyBonus: 4,
      armorClass: 15,
      currentHp: 200,
      maxHp: 200,
      temporaryHp: 0,
      speed: 30,
      position: { x: 5, y: 0 },
      concentrating: false,
    })
    const projectileTargetIds = Array.from({ length: 11 }, () => target.id)
    const resolved = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('magic-missile-default-log-limit', [wizard, target]),
      {
        type: 'cast-spell',
        actorId: wizard.id,
        targetId: target.id,
        targetIds: [target.id],
        projectileTargetIds,
        spellId: 'magic-missile',
        slotLevel: 9,
        effectRolls: Array.from({ length: 11 }, () => 1),
      },
    )

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    const details = formatDnd5eCombatLogDetails(resolved.events, {
      resolveName,
      extra: ['法术：魔法飞弹｜9 环法术位｜目标 针刺魔'],
    })

    expect(details).toContain(
      '新冒险者｜法师特性「强化塑能」｜智力调整值 +4 加入魔法飞弹的第一枚飞弹的伤害掷骰',
    )
    expect(details).toContain(
      '新冒险者｜魔法飞弹（9环）｜共 11 枚｜每枚 1d4+1 力场伤害',
    )
    expect(details.some((line) => line.startsWith('逐枚结算（#1–#5）｜'))).toBe(true)
    expect(details.some((line) => line.startsWith('逐枚结算（#11–#11）｜'))).toBe(true)
    expect(details).toContain('魔法飞弹总伤害｜26 点｜实际生效 11/11 枚')
    expect(details).toContain('生命值结算｜针刺魔：HP 200 → 174')
    expect(details.some((line) => line.includes('针刺魔｜受到'))).toBe(false)
    expect(Math.max(...details.map((line) => line.length))).toBeLessThan(1_000)
  })

  it('仅压缩已关联的魔法飞弹直伤，并保留其他来源的二次伤害', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'spell-cast',
        actorId: 'wizard',
        targetId: 'target',
        spellId: 'magic-missile',
        slotLevel: 1,
      },
      {
        type: 'damage-applied',
        sourceId: 'wizard',
        targetId: 'target',
        amount: 2,
        hpBefore: 50,
        hpAfter: 48,
        temporaryHpBefore: 0,
        temporaryHpAfter: 0,
        damageTypes: ['force'],
      },
      {
        type: 'damage-applied',
        sourceId: 'trap',
        targetId: 'wizard',
        amount: 3,
        hpBefore: 20,
        hpAfter: 17,
        temporaryHpBefore: 0,
        temporaryHpAfter: 0,
        damageTypes: ['fire'],
      },
      {
        type: 'magic-missile-damage-resolved',
        actorId: 'wizard',
        spellId: 'magic-missile',
        slotLevel: 1,
        dieSides: 4,
        baseBonusPerProjectile: 1,
        projectiles: [{
          targetId: 'target',
          dieRoll: 1,
          featureBonus: 0,
          cuttingWordsReduction: 0,
          damageBeforeDefenses: 2,
          finalDamage: 2,
          outcome: 'damage',
        }],
        totalDamage: 2,
      },
    ], { resolveName })

    expect(details).toContain('生命值结算｜针刺魔：HP 50 → 48')
    expect(details).not.toContain('针刺魔｜受到 2 点伤害｜HP 50 → 48')
    expect(details).toContain('新冒险者｜受到 3 点伤害｜HP 20 → 17')
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

  it('records Host random-table checks and distinguishes a no-slot core spell', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'post-spell-random-table-check-required',
        actorId: 'hero',
        featureId: 'fixture.table-check',
        spellId: 'magic-missile',
        spellLevel: 1,
        slotLevel: 1,
        forceTable: false,
        triggerDieSides: 20,
        triggerValues: [1],
        tableDieSides: 100,
      },
      {
        type: 'post-spell-random-table-check-resolved',
        actorId: 'hero',
        featureId: 'fixture.table-check',
        triggerRoll: 1,
        triggered: true,
      },
      {
        type: 'spell-cast',
        actorId: 'hero',
        targetId: 'hero',
        spellId: 'fireball',
        slotLevel: 3,
        slotConsumed: false,
      },
      {
        type: 'post-spell-random-table-outcome-resolved',
        actorId: 'hero',
        featureId: 'fixture.table-check',
        tableRoll: 42,
        outcomeId: 'synthetic-centered-spell',
        automation: 'full',
        spellId: 'fireball',
        targetIds: ['hero', 'wolf'],
      },
      {
        type: 'post-spell-random-table-manual-adjudication-required',
        actorId: 'hero',
        featureId: 'fixture.table-check',
        adjudicationId: 'adjudication-50',
        sourceSpellId: 'magic-missile',
        tableRoll: 50,
      },
      {
        type: 'post-spell-random-table-manual-adjudication-resolved',
        actorId: 'hero',
        featureId: 'fixture.table-check',
        adjudicationId: 'adjudication-50',
        tableRoll: 50,
        decision: 'cancelled',
        effectCount: 0,
        note: '无需额外效果',
      },
    ], { resolveName })

    expect(details).toContain('艾莉雅｜施法后随机表待判定｜掷 d20，1 时触发')
    expect(details).toContain('艾莉雅｜施法后随机表已触发｜触发骰 1')
    expect(details).toContain('艾莉雅 → 艾莉雅｜施放 fireball｜按 3 环结算，不消耗法术位')
    expect(details).toContain('艾莉雅｜随机表结果 42（synthetic-centered-spell）｜自动结算 fireball')
    expect(details).toContain('艾莉雅｜随机表结果 50 未接入自动结算｜战斗结算已暂停，等待 DM 裁定')
    expect(details).toContain('艾莉雅｜随机表结果 50 的 DM 裁定已完成｜已跳过该结果｜备注：无需额外效果')
  })
})
