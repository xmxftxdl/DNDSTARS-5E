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
    expect(details).toContain('攻击骰 · 劣势（2d20 取低）；各骰面 18 / 6；最终采用 6；调整值 +5（祝福术 +3）。')
    expect(details).toContain('结果 · 11 vs AC 15：未命中。')
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
