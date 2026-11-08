import { beforeEach, expect, it } from 'vitest'
import { getSharedSyncHealth, recordSharedReadFailure, recordSharedReadSuccess, recordSharedWrite, resetSharedSyncHealthForTests, settleSharedRecovery } from './sharedSyncHealth'

beforeEach(resetSharedSyncHealthForTests)
it('does not report recovery while another subscription is still failing', () => {
  recordSharedReadFailure('maps:1')
  recordSharedReadFailure('characters:2')
  recordSharedReadSuccess('maps:1')
  settleSharedRecovery()
  recordSharedWrite('combat', 3)
  expect(getSharedSyncHealth().status).toBe('recovering')
  recordSharedReadSuccess('characters:2')
  expect(getSharedSyncHealth().status).toBe('healthy')
})
it('keeps separate subscriptions to the same resource independent', () => {
  recordSharedReadFailure('maps:1')
  recordSharedReadSuccess('maps:2')
  expect(getSharedSyncHealth().status).toBe('recovering')
  recordSharedReadSuccess('maps:1')
  expect(getSharedSyncHealth().status).toBe('healthy')
})
