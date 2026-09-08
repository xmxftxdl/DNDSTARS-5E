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
  it('逐项记录困惑术 d10 行为、d8 方向与随机近战目标', () => {
    const confused = monsterToken({ id: 'confused', label: '受惑守卫', poolId: 'srd-5.1:guard' })
    const target = monsterToken({ id: 'target', label: '邻近狒狒', poolId: 'srd-5.1:baboon' })
    const entries = dnd5eMonsterTurnEventLogEntries([{
      type: 'confused-turn-behavior-resolved', actorId: confused.id, effectId: 'confusion-1',
      roll: 1, mode: 'random-movement-no-action', directionRoll: 6,
    }, {
      type: 'confused-turn-behavior-resolved', actorId: confused.id, effectId: 'confusion-1',
      roll: 4, mode: 'no-movement-or-action',
    }, {
      type: 'confused-turn-behavior-resolved', actorId: confused.id, effectId: 'confusion-1',
      roll: 8, mode: 'random-melee-attack', forcedTargetId: target.id,
    }, {
      type: 'confused-turn-behavior-resolved', actorId: confused.id, effectId: 'confusion-1',
      roll: 10, mode: 'normal',
    }], [confused, target])

    expect(entries.map((entry) => entry.text)).toEqual([
      '受惑守卫的困惑行为：1d10 = 1，1d8 = 6（西南），必须沿该方向用尽移动力，且不能执行动作。',
      '受惑守卫的困惑行为：1d10 = 4，本回合不能移动，也不能执行动作。',
      '受惑守卫的困惑行为：1d10 = 8，必须用动作对触及范围内随机目标“邻近狒狒”进行一次近战攻击。',
      '受惑守卫的困惑行为：1d10 = 10，本回合可以正常行动。',
    ])
  })

  it('记录闪现术的 d20、阈值以及是否暂时进入以太位面', () => {
    const wizard = monsterToken({ id: 'wizard', label: '全法术测试法师', poolId: 'wizard' })
    const entries = dnd5eMonsterTurnEventLogEntries([{
      type: 'active-effect-random-condition-resolved',
      targetId: wizard.id,
      effectId: 'blink',
      roll: 10,
      dieSides: 20,
      minimum: 11,
      condition: 'banished',
      triggered: false,
    }, {
      type: 'active-effect-random-condition-resolved',
      targetId: wizard.id,
      effectId: 'blink',
      roll: 11,
      dieSides: 20,
      minimum: 11,
      condition: 'banished',
      triggered: true,
    }], [wizard])

    expect(entries.map((entry) => entry.text)).toEqual([
      '全法术测试法师的回合结束随机状态检定：1d20 = 10（触发 11–20），未触发。',
      '全法术测试法师的回合结束随机状态检定：1d20 = 11（触发 11–20），触发，暂时进入以太位面，直到其下回合开始。',
    ])
  })

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

  it('记录回合开始灵光的能力、DC、总值、结果与来源免疫', () => {
    const tokens = [
      monsterToken({ id: 'hezrou', label: '赫兹鲁魔', poolId: 'srd-5.1:hezrou' }),
      monsterToken({ id: 'target', label: '测试目标', poolId: 'srd-5.1:guard' }),
    ]
    const entries = dnd5eMonsterTurnEventLogEntries([{
      type: 'monster-turn-start-gaze-save-resolved',
      sourceId: 'hezrou',
      targetId: 'target',
      ruleId: 'stench',
      featureName: '恶臭',
      effectKind: 'aura',
      condition: 'poisoned',
      ability: 'con',
      dc: 14,
      total: 16,
      success: true,
      immediatelyPetrified: false,
    }], tokens)

    expect(entries).toEqual([{
      kind: 'system',
      text: '测试目标受到赫兹鲁魔的“恶臭”影响：体质豁免 16 vs DC 14，成功并获得对该来源的免疫。',
    }])
  })
})
