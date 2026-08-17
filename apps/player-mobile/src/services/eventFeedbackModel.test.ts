import { describe, expect, it } from 'vitest'
import { mobileActionAckKey, mobileActionAckMessage, mobileCombatLogKey, mobileCombatLogMessage } from './eventFeedbackModel'

describe('mobile global event feedback', () => {
  it('deduplicates Host ACKs by id and authoritative update time', () => {
    const accepted = { id: 'ack-1', actionId: 'action-1', status: 'accepted' as const, updatedAt: 42 }
    expect(mobileActionAckKey(accepted)).toBe('ack-1:42')
    expect(mobileActionAckMessage(accepted, () => '')).toContain('Host 接受')
    expect(mobileActionAckMessage({ ...accepted, status: 'rejected', reason: 'invalid-target' }, (reason) => reason === 'invalid-target' ? '目标无效' : '')).toBe('行动被拒绝：目标无效')
  })

  it('uses the shared combat log as non-map-page feedback without replaying presentation events', () => {
    const entry = { id: 7, round: 2, text: '火球术造成 28 点火焰伤害', kind: 'damage' as const, time: '20:18' }
    expect(mobileCombatLogKey(entry)).toBe('7:20:18:火球术造成 28 点火焰伤害')
    expect(mobileCombatLogMessage(entry)).toBe('战斗日志：火球术造成 28 点火焰伤害')
  })
})
