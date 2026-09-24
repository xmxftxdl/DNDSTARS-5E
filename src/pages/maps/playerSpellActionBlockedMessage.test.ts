import { expect, it } from 'vitest'
import { playerSpellActionBlockedMessage } from './playerSpellActionAuthority'

it('explains a recovery pause instead of blaming initiative', () => {
  expect(playerSpellActionBlockedMessage({ combatActive: true, combatFlowPaused: true, authorityReady: true, pendingAction: false })).toContain('战斗已暂停')
})
it('distinguishes synchronization and pending actions from initiative', () => {
  expect(playerSpellActionBlockedMessage({ combatActive: true, combatFlowPaused: false, authorityReady: false, pendingAction: false })).toContain('同步战斗状态')
  expect(playerSpellActionBlockedMessage({ combatActive: true, combatFlowPaused: false, authorityReady: true, pendingAction: true })).toContain('上一项行动')
})
it('does not apply a stale pause outside combat', () => {
  expect(playerSpellActionBlockedMessage({ combatActive: false, combatFlowPaused: true, authorityReady: false, pendingAction: false })).toContain('Token')
})
