import { describe, expect, it } from 'vitest'
import {
  redactSecretMonsterCombatLog,
  resolveCombatD20RollerSide,
  shouldHideCombatRollForExplicitRoller,
  shouldHideMonsterCombatRoll,
  shouldRedactSecretMonsterSavingThrow,
} from './combatRollVisibility'

describe('combatRollVisibility', () => {
  it('只在 DM 关闭战斗明骰且当前为怪物回合时隐藏投掷', () => {
    expect(shouldHideMonsterCombatRoll({
      mode: 'dm', combatActive: true, combatRollsVisible: false, currentTurnTokenType: 'enemy',
    })).toBe(true)
    expect(shouldHideMonsterCombatRoll({
      mode: 'dm', combatActive: true, combatRollsVisible: true, currentTurnTokenType: 'enemy',
    })).toBe(false)
    expect(shouldHideMonsterCombatRoll({
      mode: 'player', combatActive: true, combatRollsVisible: false, currentTurnTokenType: 'enemy',
    })).toBe(false)
    expect(shouldHideMonsterCombatRoll({
      mode: 'dm', combatActive: true, combatRollsVisible: false, currentTurnTokenType: 'player',
    })).toBe(false)
  })

  it('不会把怪物回合中的玩家豁免继承为怪物暗骰', () => {
    expect(shouldHideCombatRollForExplicitRoller({
      hideCurrentMonsterRoll: true,
      explicitRollerSide: 'player',
    })).toBe(false)
    expect(shouldHideCombatRollForExplicitRoller({
      hideCurrentMonsterRoll: true,
      explicitRollerSide: 'enemy',
    })).toBe(true)
    expect(shouldHideCombatRollForExplicitRoller({
      hideCurrentMonsterRoll: true,
    })).toBe(true)
  })

  it('DM 开启暗骰后，怪物在玩家回合做豁免仍保持暗骰', () => {
    expect(shouldHideCombatRollForExplicitRoller({
      hideCurrentMonsterRoll: false,
      hideMonsterRolls: true,
      explicitRollerSide: 'enemy',
    })).toBe(true)
    expect(shouldHideCombatRollForExplicitRoller({
      hideCurrentMonsterRoll: true,
      hideMonsterRolls: true,
      explicitRollerSide: 'player',
    })).toBe(false)
  })

  it('从豁免或检定的命名目标恢复投骰方，但不会把攻击目标误当成攻击者', () => {
    expect(resolveCombatD20RollerSide({
      rollKind: 'saving-throw', namedTargetSide: 'player',
    })).toBe('player')
    expect(resolveCombatD20RollerSide({
      rollKind: 'ability-check', namedTargetSide: 'enemy',
    })).toBe('enemy')
    expect(resolveCombatD20RollerSide({
      rollKind: 'attack', namedTargetSide: 'player',
    })).toBeUndefined()
    expect(resolveCombatD20RollerSide({
      rollKind: 'saving-throw', explicitRollerSide: 'enemy', namedTargetSide: 'player',
    })).toBe('enemy')
  })

  it('只隐去 DM 暗骰中怪物豁免的详细日志', () => {
    const enemyTokenIds = new Set(['minotaur'])
    expect(shouldRedactSecretMonsterSavingThrow({
      hideMonsterRolls: true,
      enemyTokenIds,
      events: [{ type: 'saving-throw-resolved', targetId: 'minotaur' }],
    })).toBe(true)
    expect(shouldRedactSecretMonsterSavingThrow({
      hideMonsterRolls: true,
      enemyTokenIds,
      events: [{ type: 'saving-throw-resolved', targetId: 'player-1' }],
    })).toBe(false)
    expect(shouldRedactSecretMonsterSavingThrow({
      hideMonsterRolls: false,
      enemyTokenIds,
      events: [{ type: 'saving-throw-resolved', targetId: 'minotaur' }],
    })).toBe(false)
  })

  it('将玩家共享日志压缩为结果，不泄露骰值或修正值', () => {
    expect(redactSecretMonsterCombatLog('地精短弓 d20=17 +4 命中 AC 14。')).toBe('怪物暗骰：攻击命中。')
    expect(redactSecretMonsterCombatLog('巨龙敏捷豁免 d20=3，总值 8，豁免失败。')).toBe('怪物暗骰：豁免失败。')
    expect(redactSecretMonsterCombatLog('吐息充能：d6=6，充能完成。')).toBe('怪物暗骰：充能成功。')
    expect(redactSecretMonsterCombatLog('吐息充能：d6=2，本回合仍不可用。')).toBe('怪物暗骰：充能失败。')
  })

  it('暗骰摘要仍公开命中结论和最终伤害，但不公开骰值、加值或 AC', () => {
    const redacted = redactSecretMonsterCombatLog(
      '红龙雏龙使用啮咬攻击 Test01：d20=17 +6 命中 AC 14；共造成 11 点穿刺伤害。',
    )
    expect(redacted).toBe('怪物暗骰：攻击命中；最终造成 11 点伤害。')
    expect(redacted).not.toMatch(/d20|\+6|AC 14/)
  })

  it('多重攻击公开混合命中结论与总伤害，而不会误报为全部未命中', () => {
    expect(redactSecretMonsterCombatLog(
      '石像鬼使用多重攻击：啮咬命中；爪击未命中；共造成 7 点伤害。',
    )).toBe('怪物暗骰：攻击已结算（包含命中与未命中）；最终造成 7 点伤害。')
  })
})
