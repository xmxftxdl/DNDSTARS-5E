import { describe, expect, it } from 'vitest'
import type { SharedCombatInterruptQueueState } from '../../lib/combatInterruptQueue'
import type { DmAdjudicationInterruptPayload } from '../../lib/combatInterruptProtocol'
import type { SharedCombatFlowPauseV1 } from '../../lib/sharedCombatTypes'
import {
  recoverableDmAdjudicationPause,
  resumableCombatFlowPause,
} from './dmAdjudicationFlowPauseRecovery'

const interruptId = 'dm-adjudication:area-trigger:sleet-storm'
const pause: SharedCombatFlowPauseV1 = {
  schemaVersion: 1,
  reason: 'dm-adjudication',
  phase: 'adjudicating',
  pausedAt: 100,
  interruptId,
  label: '雪雨暴·回合开始',
}
const payload: DmAdjudicationInterruptPayload = {
  contextKind: 'persistent-area-trigger',
  actionId: 'area-trigger:sleet-storm',
  casterName: '法师 → 强盗头目',
  spellId: 'sleet-storm',
  spellName: '雪雨暴·回合开始',
  spellLevel: 0,
  slotLevel: 0,
  castingTime: 'action',
  description: '区域触发。',
  concentration: false,
}

function queue(status: 'pending' | 'answered' | 'done' | 'rolled-back'): SharedCombatInterruptQueueState {
  return {
    mapId: 'map-1',
    interrupts: [{
      id: interruptId,
      transactionId: 'transaction:sleet-storm',
      mapId: 'map-1',
      kind: 'dm-adjudication',
      status,
      phase: 'before-action',
      timeoutPolicy: 'wait-for-dm',
      payload,
      expiresAt: 10_000,
      createdAt: 100,
      updatedAt: 200,
      ...(status === 'answered' ? { response: { decision: 'cancelled', effects: [] } } : {}),
    }],
    updatedAt: 200,
    revision: 1,
  }
}

describe('DM 裁决暂停刷新恢复', () => {
  it('让已渲染的等待继续状态覆盖仍停在裁定中的旧 ref', () => {
    const awaitingResume: SharedCombatFlowPauseV1 = {
      ...pause,
      phase: 'awaiting-resume',
      resolvedAt: 200,
    }
    expect(resumableCombatFlowPause({
      rendered: awaitingResume,
      current: pause,
    })).toEqual(awaitingResume)
    expect(resumableCombatFlowPause({
      rendered: pause,
      current: awaitingResume,
    })).toBeUndefined()
  })

  it.each(['answered', 'done', 'rolled-back'] as const)(
    '把持久化的 %s 裁决推进到显式继续门闩',
    (status) => {
      expect(recoverableDmAdjudicationPause({ mapId: 'map-1', pause, queue: queue(status) }))
        .toEqual({ interruptId })
    },
  )

  it('不恢复仍在等待 DM 的裁决', () => {
    expect(recoverableDmAdjudicationPause({ mapId: 'map-1', pause, queue: queue('pending') }))
      .toBeUndefined()
  })

  it('不跨地图或恢复手动暂停', () => {
    expect(recoverableDmAdjudicationPause({ mapId: 'map-2', pause, queue: queue('answered') }))
      .toBeUndefined()
    expect(recoverableDmAdjudicationPause({
      mapId: 'map-1',
      pause: { ...pause, reason: 'manual', phase: 'paused', interruptId: undefined },
      queue: queue('answered'),
    })).toBeUndefined()
  })
})
