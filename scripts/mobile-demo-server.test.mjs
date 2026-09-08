import test from 'node:test'
import assert from 'node:assert/strict'
import { publicMobilePlayerSession, validateMobileMoveIntent } from '../packages/mobile-protocol/runtime.mjs'

const session = publicMobilePlayerSession({
  sessionId: 's1', roomId: 'r1', campaignId: 'c1', userId: 'u1', playerId: 'p1',
  controlledTokenIds: ['own-token'], expiresAt: '2099-01-01T00:00:00.000Z',
})

test('mobile session is player-only and cannot carry DM capabilities', () => {
  assert.equal(session.sessionType, 'mobile-player')
  assert.equal(session.permissions.editScene, false)
  assert.equal(session.permissions.controlMonsters, false)
})

test('mobile movement fails closed for an uncontrolled token', () => {
  const result = validateMobileMoveIntent({
    schemaVersion: 1, tokenId: 'monster-token', expectedRevision: 3, destination: { x: 10, y: 20 },
  }, session)
  assert.deepEqual(result, { ok: false, reason: 'token-not-controlled' })
})

test('mobile movement accepts finite coordinates for the controlled token', () => {
  const result = validateMobileMoveIntent({
    schemaVersion: 1, tokenId: 'own-token', expectedRevision: 3, destination: { x: 10, y: 20 },
  }, session)
  assert.equal(result.ok, true)
})

