import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import { dnd5eMonsterTurnEventLogEntries } from './monsterTurnEventLog'

function monsterToken(input: { id: string; label: string; poolId: string }): Token {
  return {
    ...input,
    x: 0,
    y: 0,
    color: '#ef4444',
    emoji: '👹',
    size: 1,
    type: 'enemy',
  }
}

describe('怪物回合事件战斗日志', () => {
  it('记录血肉魔像回合开始的狂暴 d6，而不是只播放骰子动画', () => {
    const entries = dnd5eMonsterTurnEventLogEntries([{
      type: 'monster-berserk-resolved',
      actorId: 'flesh-golem',
      roll: 3,
      berserk: false,
    }], [monsterToken({
      id: 'flesh-golem',
      label: '血肉魔像',
      poolId: 'srd-5.1:flesh-golem',
    })])

    expect(entries).toEqual([{
      kind: 'system',
      text: '血肉魔像的狂暴检定：1d6 = 3（需要 6），未进入狂暴状态。',
    }])
  })

  it('记录已消耗怪物能力的充能检定结果与阈值', () => {
    const entries = dnd5eMonsterTurnEventLogEntries([{
      type: 'monster-recharge-resolved',
      actorId: 'ankheg',
      actionId: 'acid-spray',
      roll: 5,
      ready: true,
    }], [monsterToken({
      id: 'ankheg',
      label: '掘地虫',
      poolId: 'srd-5.1:ankheg',
    })])

    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('system')
    expect(entries[0].text).toContain('掘地虫')
    expect(entries[0].text).toContain('1d6 = 5（需要 6–6）')
    expect(entries[0].text).toContain('充能完成')
  })
})
