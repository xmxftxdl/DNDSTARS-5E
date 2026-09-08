import { describe, expect, it } from 'vitest'
import {
  formatDnd5eAttackResolutionTrace,
  formatDnd5eForcedMovementResolutionTrace,
  formatDnd5eSavingThrowResolutionTrace,
} from './combatResolutionTrace'

describe('formatDnd5eSavingThrowResolutionTrace', () => {
  it('shows magic resistance as the rule source behind a second d20', () => {
    const details = formatDnd5eSavingThrowResolutionTrace({
      targetName: '针刺魔',
      ability: 'con',
      mode: 'advantage',
      baseMode: {
        mode: 'advantage',
        advantageReasons: ['magic-resistance'],
        disadvantageReasons: [],
        advantage: [{
          id: 'magic-resistance',
          label: '魔法抗性',
          detail: '对法术或其他魔法效应的豁免具有优势。',
        }],
        disadvantage: [],
      },
      d20: 4,
      d20Second: 17,
    })

    expect(details).toEqual([
      '规则依据 · 针刺魔的体质豁免：优势 · 魔法抗性：对法术或其他魔法效应的豁免具有优势。',
      '骰子选择 · 优势（2d20 取高）；骰面 4 / 17 → 17。',
    ])
  })

  it('makes advantage and disadvantage cancellation explicit', () => {
    const details = formatDnd5eSavingThrowResolutionTrace({
      targetName: '测试目标',
      ability: 'dex',
      mode: 'normal',
      baseMode: {
        mode: 'normal',
        advantageReasons: ['magic-resistance'],
        disadvantageReasons: ['exhaustion-level-3'],
        advantage: [{ id: 'magic-resistance', label: '魔法抗性', detail: '对法术或其他魔法效应的豁免具有优势。' }],
        disadvantage: [{ id: 'exhaustion-level-3', label: '力竭（3级或更高）', detail: '力量、敏捷与体质豁免具有劣势。' }],
      },
      d20: 12,
    })

    expect(details).toContain('抵消关系 · 同时具有优势与劣势，按 5e 规则抵消为普通骰。')
  })

  it('records the spatial, dice, and reaction stages of an attack', () => {
    const details = formatDnd5eAttackResolutionTrace({
      actorName: '冒险者', targetName: '针刺魔', distanceFeet: 10, rangeLabel: '常规射程 80 尺',
      actorElevationFeet: 40, targetElevationFeet: 0, cover: 'half', mode: 'disadvantage',
      d20: 18, d20Second: 6, modifier: 5, modifierDetails: ['祝福术 +3'],
      total: 11, targetArmorClass: 15, hit: false,
      reactionDetails: ['诗人满足视线、60 尺与反应条件，消耗反应发动尖刻言辞 -2。'],
    })

    expect(details).toContain('攻击资格 · Headless 已验证目标与距离；效果线和视线状态已纳入本次结算；距离 10 尺（常规射程 80 尺）。')
    expect(details).toContain('空间判定 · 冒险者海拔 40 尺；针刺魔海拔 0 尺；掩护：半身掩护（AC +2）。')
    expect(details).toContain('攻击骰 · 劣势（2d20 取低）；采用劣势的原因：本次旧结算记录未保存具体规则来源；各骰面 18 / 6；最终采用 6；调整值 +5（祝福术 +3）。')
    expect(details).toContain('结果 · 11 vs AC 15：未命中。')
  })

  it('states the concrete source of attack disadvantage', () => {
    const details = formatDnd5eAttackResolutionTrace({
      actorName: '弓手', targetName: '兽人', distanceFeet: 30, rangeLabel: '射程 80/320 尺',
      actorElevationFeet: 0, targetElevationFeet: 0, mode: 'disadvantage',
      modeReasons: {
        advantage: [],
        disadvantage: ['远程攻击者 5 尺内有敌人', '目标正在闪避'],
      },
      d20: 19, d20Second: 10, modifier: 8, total: 18,
      targetArmorClass: 16, hit: true,
    })

    expect(details).toContain('优劣势依据 · 劣势：远程攻击者 5 尺内有敌人、目标正在闪避。')
    expect(details).toContain('攻击骰 · 劣势（2d20 取低）；采用劣势的原因：远程攻击者 5 尺内有敌人、目标正在闪避；各骰面 19 / 10；最终采用 10；调整值 +8。')
  })

  it('reads the authoritative roll-mode reason fields used by prepared attacks', () => {
    const details = formatDnd5eAttackResolutionTrace({
      actorName: '战士', targetName: '目盲目标', distanceFeet: 5, rangeLabel: '触及 5 尺',
      actorElevationFeet: 0, targetElevationFeet: 0, mode: 'advantage',
      modeReasons: {
        advantageReasons: ['目标处于目盲状态'],
        disadvantageReasons: [],
      },
      d20: 7, d20Second: 16, modifier: 6, total: 22,
      targetArmorClass: 14, hit: true,
    })

    expect(details).toContain('优劣势依据 · 优势：目标处于目盲状态。')
    expect(details).toContain('攻击骰 · 优势（2d20 取高）；采用优势的原因：目标处于目盲状态；各骰面 7 / 16；最终采用 16；调整值 +6。')
    expect(details.join('\n')).not.toContain('权威结算指定优势')
  })

  it('accepts a partial mode-reason record from monster attacks', () => {
    const details = formatDnd5eAttackResolutionTrace({
      actorName: '狒狒', targetName: '法师', distanceFeet: 5, rangeLabel: '触及 5 尺',
      actorElevationFeet: 0, targetElevationFeet: 0, mode: 'normal',
      modeReasons: { advantage: ['集群战术'] },
      d20: 12, modifier: 1, total: 13, targetArmorClass: 13, hit: true,
    })

    expect(details).toContain('优劣势依据 · 优势：集群战术。')
    expect(details).toContain('结果 · 13 vs AC 13：命中。')
  })

  it('explains when attack advantage and disadvantage cancel', () => {
    const details = formatDnd5eAttackResolutionTrace({
      actorName: '潜行者', targetName: '倒地目标', distanceFeet: 20, rangeLabel: '射程 80/320 尺',
      actorElevationFeet: 0, targetElevationFeet: 0, mode: 'normal',
      modeReasons: {
        advantage: ['目标看不见攻击者'],
        disadvantage: ['目标倒地且攻击距离超过 5 尺'],
      },
      d20: 12, modifier: 6, total: 18, targetArmorClass: 15, hit: true,
    })

    expect(details).toContain('优劣势依据 · 优势：目标看不见攻击者；劣势：目标倒地且攻击距离超过 5 尺。')
    expect(details).toContain('抵消关系 · 本次同时存在优势与劣势，按 D&D 5e 规则互相抵消，最终使用普通攻击骰。')
  })

  it('does not infer a fall solely from a lower destination terrain', () => {
    const details = formatDnd5eForcedMovementResolutionTrace({
      targetName: '针刺魔', from: { x: 10, y: 10 }, to: { x: 20, y: 10 },
      formatPosition: ({ x, y }) => `格（X=${x}, Y=${y}）`, distanceFeet: 10,
      sourceElevationFeet: 40, sourceGroundElevationFeet: 0, landingGroundElevationFeet: 0,
      groundedAtSource: false, fallDistanceFeet: 0,
    })

    expect(details).toContain('坠落结论 · 起点不在地面支撑上，系统不从地形差自动推定坠落；需要 DM 裁定。')
    expect(details.some((detail) => detail.includes('坠落伤害'))).toBe(false)
  })
})
