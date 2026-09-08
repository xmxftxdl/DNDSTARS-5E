import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatEvent,
} from '../rulesets/dnd5e/headlessCombatEngine'
import {
  formatDnd5eCombatLogDetails,
  formatDnd5eSecretCombatOutcomeDetails,
} from './combatLogDetails'

describe('formatDnd5eCombatLogDetails', () => {
  const resolveName = (id: string) => ({
    hero: '艾莉雅',
    wizard: '新冒险者',
    target: '针刺魔',
    wolf: '恐狼',
    'barbed-devil': '针刺魔',
  })[id] ?? id

  it('expands a Blink random-condition result with the actual die and trigger threshold', () => {
    expect(formatDnd5eCombatLogDetails([{
      type: 'active-effect-random-condition-resolved',
      targetId: 'wizard', effectId: 'blink', roll: 17,
      dieSides: 20, minimum: 11, condition: 'banished', triggered: true,
    }], { resolveName })).toEqual([
      '新冒险者｜回合结束随机状态 1d20 = 17 vs 触发下限 11｜触发 banished',
    ])
  })

  it('暗骰玩家投影保留命中、最终伤害、HP 与状态，但不泄露骰值、加值、AC 或 DC', () => {
    const details = formatDnd5eSecretCombatOutcomeDetails([
      {
        type: 'attack-resolved', actorId: 'barbed-devil', targetId: 'hero',
        d20: 18, total: 24, armorClass: 16, hit: true, critical: false,
      },
      {
        type: 'saving-throw-resolved', targetId: 'hero', ability: 'dex',
        d20: 4, modifier: 3, total: 7, dc: 14, success: false,
      },
      {
        type: 'damage-applied', sourceId: 'barbed-devil', targetId: 'hero', amount: 11,
        hpBefore: 31, hpAfter: 22, temporaryHpBefore: 2, temporaryHpAfter: 0,
      },
      {
        type: 'condition-applied', actorId: 'barbed-devil', targetId: 'hero', condition: 'poisoned',
      },
    ], { resolveName })

    expect(details).toEqual([
      '针刺魔 → 艾莉雅｜攻击结果：命中',
      '艾莉雅｜敏捷豁免结果：失败',
      '艾莉雅｜受到 11 点伤害｜HP 31 → 22｜临时 HP 2 → 0',
      '艾莉雅｜获得状态：中毒｜来源：针刺魔',
    ])
    expect(details.join('\n')).not.toMatch(/d20|AC|DC|\+3|总值/)
  })

  it('暗骰玩家投影明确公开未命中且不会伪造伤害', () => {
    const details = formatDnd5eSecretCombatOutcomeDetails([{
      type: 'attack-resolved', actorId: 'barbed-devil', targetId: 'hero',
      d20: 2, total: 8, armorClass: 16, hit: false, critical: false,
    }], { resolveName })

    expect(details).toEqual(['针刺魔 → 艾莉雅｜攻击结果：未命中'])
    expect(details.join('\n')).not.toMatch(/d20|AC|8|16/)
  })

  it('preserves the declared text of an authoritative basic action in the combat log', () => {
    expect(formatDnd5eCombatLogDetails([{
      type: 'basic-action-adjudication-requested',
      actorId: 'wizard',
      economy: 'bonusAction',
      description: '向受控骷髅下达同一心灵命令：守卫这里。',
    }], { resolveName: () => '法师' })).toEqual([
      '法师｜附赠动作声明：向受控骷髅下达同一心灵命令：守卫这里。',
    ])
  })

  it('describes instant death without falsely classifying every source as massive damage', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'instant-death', sourceId: 'caster', targetId: 'target', hpBefore: 100,
    }], { resolveName: (id) => id === 'target' ? '丘陵巨人' : id })

    expect(details).toContain('丘陵巨人｜立即死亡（死亡前 100 HP）')
    expect(details.some((line) => line.includes('伤害'))).toBe(false)
  })

  it('explains creature-form overflow damage across the restored hit-point pool', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'class-state-changed', actorId: 'target',
        stateKey: 'creature-form:polymorph', active: false,
      },
      {
        type: 'damage-applied', sourceId: 'caster', targetId: 'target', amount: 33,
        hpBefore: 1, hpAfter: 12, temporaryHpBefore: 0, temporaryHpAfter: 0,
        creatureFormHpBefore: 1, creatureFormOverflowDamage: 32, creatureFormOriginalHpBefore: 44,
      },
    ], { resolveName: (id) => id === 'target' ? '丘陵巨人' : id })

    expect(details).toContain(
      '丘陵巨人｜受到 33 点伤害｜形态 HP 1 → 0，恢复原形｜32 点溢出伤害，原形 HP 44 → 12',
    )
  })

  it('keeps the exact original hit points when overflow damage also drops the original form to zero', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'class-state-changed', actorId: 'target',
        stateKey: 'creature-form:polymorph', active: false,
      },
      {
        type: 'damage-applied', sourceId: 'caster', targetId: 'target', amount: 33,
        hpBefore: 1, hpAfter: 0, temporaryHpBefore: 0, temporaryHpAfter: 0,
        creatureFormHpBefore: 1, creatureFormOverflowDamage: 32, creatureFormOriginalHpBefore: 12,
      },
    ], { resolveName: (id) => id === 'target' ? '丘陵巨人' : id })

    expect(details).toContain(
      '丘陵巨人｜受到 33 点伤害｜形态 HP 1 → 0，恢复原形｜32 点溢出伤害，原形 HP 12 → 0',
    )
  })

  it('does not reinterpret later falling damage as a second creature-form reversion', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'damage-applied', sourceId: 'minotaur', targetId: 'target', amount: 22,
        hpBefore: 15, hpAfter: 58, temporaryHpBefore: 0, temporaryHpAfter: 0,
        creatureFormHpBefore: 15, creatureFormOverflowDamage: 7, creatureFormOriginalHpBefore: 65,
      },
      {
        type: 'class-state-changed', actorId: 'target',
        stateKey: 'creature-form:polymorph', active: false,
      },
      {
        type: 'damage-applied', targetId: 'target', amount: 10,
        hpBefore: 58, hpAfter: 48, temporaryHpBefore: 0, temporaryHpAfter: 0,
        damageTypes: ['bludgeoning'],
      },
      {
        type: 'falling-damage-resolved', actorId: 'target', distanceFeet: 40,
        dice: 4, rolls: [5, 1, 2, 2], damage: 10, landedProne: true,
      },
    ], { resolveName: (id) => id === 'target' ? '新冒险者' : id })

    expect(details).toContain(
      '新冒险者｜受到 22 点伤害｜形态 HP 15 → 0，恢复原形｜7 点溢出伤害，原形 HP 65 → 58',
    )
    expect(details).toContain('新冒险者｜受到 10 点伤害｜HP 58 → 48')
    expect(details).not.toContain(
      '新冒险者｜受到 10 点伤害｜形态 HP 58 → 0，恢复原形｜0 点溢出伤害，原形 HP 48 → 48',
    )
  })

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

  it('shows the independent attack-decoy roll, decoy AC, and remaining count', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'attack-decoy-resolved', actorId: 'hero', targetId: 'wolf',
      effectId: 'mirror', redirectD20: 8, minimumD20: 6, redirected: true,
      attackTotal: 14, decoyArmorClass: 12, decoyHit: true, remaining: 2,
    }], { resolveName })

    expect(details).toContain(
      '艾莉雅 → 恐狼｜攻击诱饵重定向 d20 8 vs 6｜命中诱饵（攻击 14 vs AC 12），剩余 2',
    )
  })

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

  it('明确区分同阵营目标未抵抗与骰值判定失败', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'saving-throw-resolved', targetId: 'wolf', ability: 'con',
      d20: 19, modifier: 4, total: 23, dc: 19, success: false,
      automaticOutcome: 'allied-unresisted-failure',
    }], { resolveName })

    expect(details).toContain(
      '恐狼｜同阵营目标未抵抗｜体质豁免自动视为失败（d20 19 +4 = 23 未参与判定）',
    )
  })

  it('把持续区域的触发、豁免、伤害和 HP 变化保留在同一组明细中', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'saving-throw-resolved', targetId: 'target', ability: 'dex',
        d20: 7, modifier: 2, total: 9, dc: 15, success: false,
      },
      {
        type: 'damage-applied', sourceId: 'wizard', targetId: 'target', amount: 20,
        hpBefore: 40, hpAfter: 20, temporaryHpBefore: 0, temporaryHpAfter: 0,
        damageTypes: ['fire'],
      },
      {
        type: 'persistent-area-triggered', actorId: 'wizard', targetId: 'target',
        areaId: 'core-spell-area:wall', triggerId: 'wall-of-fire-create',
        timing: 'on-create', saveSuccess: false, damage: 20,
        damageResolution: {
          damageType: 'fire',
          roll: { sides: 8, rolls: [3, 6, 4, 2, 5], modifier: 0, total: 20 },
          damageBeforeSavingThrow: 20,
          damageAfterSavingThrow: 20,
          damageAfterDefenses: 20,
          damageAfterDmAdjustment: 20,
          finalDamage: 20,
          defenses: [],
        },
      },
    ], { resolveName })

    expect(details).toContain('针刺魔｜敏捷豁免 d20 7 +2 = 9 vs DC 15｜失败')
    expect(details.some((line) => line.includes('针刺魔｜受到 20 点伤害'))).toBe(false)
    expect(details).toContain(
      '新冒险者 → 针刺魔｜持续区域 wall-of-fire-create（首次创建）｜豁免失败｜最终伤害 20',
    )
    expect(details).toContain(
      '针刺魔｜火焰伤害明细｜5d8 骰面：3 + 6 + 4 + 2 + 5 = 20｜固定加值 +0｜原始伤害 20｜最终伤害 20｜HP 40 → 20',
    )
  })

  it('解释持续区域发出的心灵与声音通知', () => {
    const base = {
      type: 'persistent-area-triggered' as const,
      actorId: 'wizard', targetId: 'target', areaId: 'alarm-zone',
      timing: 'on-enter' as const, damage: 0,
    }
    const details = formatDnd5eCombatLogDetails([
      { ...base, triggerId: 'alarm-mental', notification: { delivery: 'mental-to-source' as const } },
      { ...base, triggerId: 'alarm-audible', notification: { delivery: 'audible' as const, audibleRadiusFeet: 60 } },
    ], { resolveName })

    expect(details).toContain(
      '新冒险者 → 针刺魔｜持续区域 alarm-mental（进入区域）｜向来源发出心灵警报',
    )
    expect(details).toContain(
      '新冒险者 → 针刺魔｜持续区域 alarm-audible（进入区域）｜发出声音警报（60 尺内可听）',
    )
  })

  it('逐段解释持续区域的固定加值、豁免、防御、DM 与减伤调整', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'damage-applied', sourceId: 'wizard', targetId: 'target', amount: 1,
        hpBefore: 80, hpAfter: 79, temporaryHpBefore: 0, temporaryHpAfter: 0,
        damageTypes: ['fire'],
      },
      {
        type: 'persistent-area-triggered', actorId: 'wizard', targetId: 'target',
        areaId: 'plugin-area:test', triggerId: 'test-trigger', timing: 'turn-start',
        saveSuccess: true, damage: 1,
        damageResolution: {
          damageType: 'fire',
          roll: { sides: 6, rolls: [4, 5], modifier: 3, total: 12 },
          damageBeforeSavingThrow: 12,
          damageAfterSavingThrow: 6,
          damageAfterDefenses: 3,
          damageAfterDmAdjustment: 2,
          finalDamage: 1,
          defenses: [],
        },
      },
    ], { resolveName })

    expect(details).toContain(
      '针刺魔｜火焰伤害明细｜2d6 骰面：4 + 5 = 9｜固定加值 +3｜原始伤害 12｜豁免调整 12 → 6｜防御调整 6 → 3｜DM 调整 3 → 2｜减伤/中断调整 2 → 1｜最终伤害 1｜HP 80 → 79',
    )
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
        roll: {
          sides: 6,
          rolls: [6, 4, 5],
          bonus: 0,
          total: 15,
        },
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

    expect(details).toContain('燃烧之手火焰伤害骰 3d6：6 + 4 + 5 = 15')
    expect(details).toContain('燃烧之手伤害 15；豁免成功减半为 7；针刺魔火焰免疫，最终 0')
  })

  it('展开法术攻击命中的逐枚伤害骰与最终伤害', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-attack-damage-resolved',
      actorId: 'wizard',
      targetId: 'target',
      spellId: 'ray-of-frost',
      slotLevel: 0,
      critical: false,
      damageType: 'cold',
      roll: {
        sides: 8,
        rolls: [6, 2, 7, 5],
        bonus: 5,
        total: 25,
      },
      damageAfterAttackAdjustments: 25,
      finalDamage: 25,
    }], { resolveName })

    expect(details).toContain('冷冻射线寒冷伤害骰 4d8+5：6 + 2 + 7 + 5 +5 = 25')
  })

  it('解释普通武器伤害被血肉魔像免疫而归零', () => {
    const details = formatDnd5eCombatLogDetails([
      {
        type: 'damage-defense-resolved',
        sourceId: 'hero',
        targetId: 'flesh-golem',
        damageType: 'slashing',
        damageBefore: 11,
        damageAfter: 0,
        defenses: [{
          kind: 'immune',
          multiplier: 0,
          damageBefore: 11,
          damageAfter: 0,
          reasons: ['conditional:0:immune'],
        }],
        damageSource: {
          delivery: 'weapon-attack',
          magical: false,
        },
      },
      {
        type: 'damage-applied',
        sourceId: 'hero',
        targetId: 'flesh-golem',
        amount: 0,
        hpBefore: 93,
        hpAfter: 93,
        temporaryHpBefore: 0,
        temporaryHpAfter: 0,
        damageTypes: ['slashing'],
      },
    ], {
      resolveName: (id) => id === 'flesh-golem' ? '血肉魔像' : id,
    })

    expect(details).toContain('血肉魔像｜挥砍伤害免疫生效｜11 → 0｜来源：非魔法武器攻击（普通材质）')
    expect(details).toContain('血肉魔像｜受到 0 点伤害｜HP 93 → 93')
  })

  it('展开火球术共享的 8d6 每颗骰面和最终伤害', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-saving-throw-damage-resolved',
      actorId: 'wizard',
      targetId: 'target',
      spellId: 'fireball',
      ability: 'dex',
      saveSucceeded: false,
      successfulSave: 'half',
      damageBeforeSavingThrow: 32,
      damageAfterSavingThrow: 32,
      finalDamage: 32,
      components: [{
        damageType: 'fire',
        roll: { sides: 6, rolls: [6, 5, 4, 3, 2, 1, 6, 5], bonus: 0, total: 32 },
        damageBeforeSavingThrow: 32,
        damageAfterSavingThrow: 32,
        finalDamage: 32,
        defenses: [],
      }],
    }], { resolveName })

    expect(details).toContain('火球术火焰伤害骰 8d6：6 + 5 + 4 + 3 + 2 + 1 + 6 + 5 = 32')
    expect(details).toContain('火球术伤害 32；豁免失败，伤害为 32；最终 32')
  })

  it('明确记录法术塑形保护目标自动成功且不受范围法术伤害', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-sculpted',
      actorId: 'wizard',
      targetId: 'ally',
      spellId: 'fireball',
    }], {
      resolveName: (id) => ({ wizard: 'Test01', ally: 'Test02' })[id] ?? id,
    })

    expect(details).toEqual([
      'Test02｜受到Test01的法师特性「法术塑形」保护｜对火球术的豁免自动成功，且不受伤害',
    ])
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

  it('records Feather Fall as prevented damage instead of an impossible zero dice total', () => {
    const events: Dnd5eCombatEvent[] = [
      {
        type: 'spell-cast', actorId: 'hero', targetId: 'wolf',
        spellId: 'feather-fall', slotLevel: 1,
      },
      {
        type: 'falling-damage-resolved', actorId: 'wolf', distanceFeet: 40,
        dice: 4, damage: 0, landedProne: false,
        prevention: {
          kind: 'controlled-descent',
          definitionId: 'activity:srd-5.1:spell:feather-fall:modifiers:0',
          label: '羽落术',
        },
      },
    ]
    const details = formatDnd5eCombatLogDetails(events, { resolveName })
    const secretDetails = formatDnd5eSecretCombatOutcomeDetails(events, { resolveName })

    expect(details).toContain('艾莉雅 → 恐狼｜施放 羽落术｜使用 1 环法术位')
    expect(details).toContain('恐狼｜坠落 40 尺｜羽落术保护｜原为 4d6，未投掷｜实际 0 点｜安全落地')
    expect(details.join('\n')).not.toContain('4d6 = 0')
    expect(secretDetails).toContain('恐狼｜坠落 40 尺｜羽落术保护｜坠落伤害未投掷｜实际 0 点｜安全落地')
  })

  it('shows every actual falling-damage die when Feather Fall is not used', () => {
    expect(formatDnd5eCombatLogDetails([{
      type: 'falling-damage-resolved', actorId: 'wolf', distanceFeet: 40,
      dice: 4, rolls: [2, 5, 3, 6], damage: 16, landedProne: true,
    }], { resolveName })).toContain(
      '恐狼｜坠落 40 尺｜4d6 骰面：2 + 5 + 3 + 6 = 16｜实际 16 点伤害｜落地倒地',
    )
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

  it('shows authoritative optional bonus-die consumption', () => {
    expect(formatDnd5eCombatLogDetails([{
      type: 'optional-bonus-die-used',
      targetId: 'hero',
      effectId: 'effect-resistance',
      definitionId: 'monster.trait.resistance',
      sourceRulesId: 'monster.trait.resistance',
      label: '战争抗性',
      rollKind: 'saving-throw',
      dieSides: 6,
      roll: 4,
    }], { resolveName })).toContain('艾莉雅｜豁免奖励骰：战争抗性 d6=4｜已消耗')
  })

  it('shows the item damage-reduction dice and final prevented amount', () => {
    expect(formatDnd5eCombatLogDetails([{
      type: 'inventory-headless-effect-applied',
      actorId: 'hero',
      targetId: 'hero',
      instanceId: 'ward-item',
      effectId: 'damage-reduction',
      itemName: '守护腰带',
      effectKind: 'damage-reduction',
      amount: 6,
      dice: { sides: 6, rolls: [4], bonus: 2 },
    }], { resolveName })).toContain('艾莉雅｜守护腰带 减免 6 点伤害｜减伤骰 d6(4) +2')
  })

  it('shows every die in an Activity healing formula', () => {
    expect(formatDnd5eCombatLogDetails([{
      type: 'activity-formula-roll-resolved',
      actorId: 'hero', targetId: 'wolf', activityId: 'spell:regenerate',
      operationId: 'regenerate-initial-healing', kind: 'healing', castLevel: 8,
      total: 36, formulaAdjustment: 15,
      dice: [{
        rollId: 'regenerate-initial-healing', count: 4, sides: 8,
        values: [2, 7, 4, 8],
      }],
    }], { resolveName })).toContain('艾莉雅 → 恐狼｜再生术治疗骰 4d8 [2, 7, 4, 8] +15 = 36')
  })

  it('labels a cantrip as slot-free instead of inventing a 0-level spell slot', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-cast', actorId: 'hero', targetId: 'wolf',
      spellId: 'produce-flame', slotLevel: 0,
    }], { resolveName })

    expect(details).toContain('艾莉雅 → 恐狼｜施放 produce-flame｜使用戏法（不消耗法术位）')
    expect(details.some((line) => line.includes('0 环法术位'))).toBe(false)
  })

  it('shows Dispel Magic checks, failures, and higher-slot automatic dispels', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-dispelled', actorId: 'hero', targetId: 'wolf',
      spellId: 'haste', spellLevel: 5, effectId: 'haste-effect',
      dc: 15, total: 20, success: true,
    }, {
      type: 'spell-dispelled', actorId: 'hero', targetId: 'wolf',
      spellId: 'haste', spellLevel: 5, effectId: 'haste-effect',
      dc: 15, total: 13, success: false,
    }, {
      type: 'spell-dispelled', actorId: 'hero', targetId: 'wolf',
      spellId: 'haste', spellLevel: 5, effectId: 'haste-effect',
      success: true,
    }], { resolveName })

    expect(details).toContain('艾莉雅 → 恐狼｜解除加速术（5环）｜施法属性检定 20 vs DC 15｜成功')
    expect(details).toContain('艾莉雅 → 恐狼｜解除加速术（5环）｜施法属性检定 13 vs DC 15｜失败，效果保留')
    expect(details).toContain('艾莉雅 → 恐狼｜解除加速术（5环）｜目标法术 5 环不高于解除魔法所用环位｜自动结束')
  })

  it('explains when antimagic consumes a cast but suppresses its effect', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-effect-suppressed-by-area',
      actorId: 'hero',
      targetId: 'wolf',
      spellId: 'fire-bolt',
      spellLevel: 0,
      reason: 'antimagic',
    }], { resolveName })

    expect(details).toEqual([
      '艾莉雅 → 恐狼｜fire-bolt效果被反魔法力场压制｜未产生法术效果',
    ])
  })

  it('exposes an audible Activity event and its exact radius', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'audible-event-emitted',
      actorId: 'hero',
      activityId: 'knock',
      label: '敲击术巨响',
      audibleRadiusFeet: 300,
    }], { resolveName })

    expect(details).toEqual(['艾莉雅｜敲击术巨响｜可听范围 300 尺'])
  })

  it('shows persistent spell-detection targets, distances, schools, and sources', () => {
    const details = formatDnd5eCombatLogDetails([{
      type: 'spell-detection-updated',
      actorId: 'hero',
      spellId: 'detect-magic',
      mode: 'magic',
      revealAuras: true,
      presences: [{
        targetId: 'wizard',
        distanceFeet: 15,
        categories: ['magic'],
        spellSchools: ['divination', 'transmutation'],
        sourceRulesIds: ['detect-magic', 'longstrider'],
      }],
    }], { resolveName })

    expect(details).toContain('艾莉雅｜侦测魔法更新｜新冒险者（15 尺；魔法；预言学派、变化学派；来源 detect-magic、longstrider）')
    expect(formatDnd5eCombatLogDetails([{
      type: 'spell-detection-updated',
      actorId: 'hero',
      spellId: 'detect-magic',
      mode: 'magic',
      presences: [{
        targetId: 'wizard', distanceFeet: 15, categories: ['magic'],
        spellSchools: ['transmutation'], sourceRulesIds: ['longstrider'],
      }],
    }], { resolveName })).toContain('艾莉雅｜侦测魔法更新｜30 尺内感知到魔法存在；需另用一个动作显化可见目标的灵光并辨识学派')
    expect(formatDnd5eCombatLogDetails([{
      type: 'spell-detection-updated',
      actorId: 'hero',
      spellId: 'detect-magic',
      mode: 'magic',
      presences: [],
    }], { resolveName })).toContain('艾莉雅｜侦测魔法更新｜30 尺内未感知到魔法存在')
    expect(formatDnd5eCombatLogDetails([{
      type: 'spell-detection-updated',
      actorId: 'hero',
      spellId: 'detect-poison-and-disease',
      mode: 'poison-disease',
      presences: [{
        targetId: 'wizard', distanceFeet: 15,
        categories: ['poisonous-creature'], sourceRulesIds: [],
      }],
    }], { resolveName })).toContain('艾莉雅｜侦测毒性和疾病更新｜新冒险者（15 尺；带毒生物）')
  })
})
