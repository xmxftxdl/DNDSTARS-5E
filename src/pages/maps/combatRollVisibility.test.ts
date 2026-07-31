import { describe, expect, it } from 'vitest'
import {
  redactSecretMonsterCombatLog,
  shouldHideMonsterCombatRoll,
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

  it('将玩家共享日志压缩为结果，不泄露骰值或修正值', () => {
    expect(redactSecretMonsterCombatLog('地精短弓 d20=17 +4 命中 AC 14。')).toBe('怪物暗骰：攻击命中。')
    expect(redactSecretMonsterCombatLog('巨龙敏捷豁免 d20=3，总值 8，豁免失败。')).toBe('怪物暗骰：豁免失败。')
    expect(redactSecretMonsterCombatLog('吐息充能：d6=6，充能完成。')).toBe('怪物暗骰：充能成功。')
    expect(redactSecretMonsterCombatLog('吐息充能：d6=2，本回合仍不可用。')).toBe('怪物暗骰：充能失败。')
  })
})
