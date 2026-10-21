import { expect, it } from 'vitest'
import { appendCampaignEnvironmentalExposure, validCampaignEnvironmentalExposures, type CampaignEnvironmentalExposure } from '../../shared/campaign-environmental-exposures.mjs'
import { normalizeSharedCampaignTime, validateSharedCampaignTime, advanceCampaignTimeSnapshot } from './campaignTime'
import { validateSharedStateShape, mutateCampaignTimeState } from '../../scripts/shared-server-core.mjs'

const receipt = (patch: Partial<CampaignEnvironmentalExposure> = {}): CampaignEnvironmentalExposure => ({
  id: 'exposure:1', subjectId: 'character:hero', hazard: 'extreme-cold',
  fromWorldMinute: 420, toWorldMinute: 480, dc: 10, outcome: 'failure', ...patch,
})

it('keeps receipts through JSON reload and time advancement; rejects duplicate intervals even with a new ID', () => {
  const first = appendCampaignEnvironmentalExposure(undefined, receipt(), 480)
  if (!first.ok) throw Error(first.reason)
  const clock = normalizeSharedCampaignTime({ worldMinute: 480, environmentalExposures: first.receipts })
  const later = advanceCampaignTimeSnapshot({ state: clock, minutes: 60, reason: 'Travel', now: 2, advanceId: 'later' })!
  const restored = normalizeSharedCampaignTime(JSON.parse(JSON.stringify(later)))
  expect(validateSharedCampaignTime(restored)).toBe(true)
  expect(restored.environmentalExposures).toEqual([receipt()])
  expect(appendCampaignEnvironmentalExposure(restored.environmentalExposures, receipt({ id: 'retry' }), 540))
    .toEqual({ ok: false, reason: 'environmental-exposure-already-settled' })
  expect(appendCampaignEnvironmentalExposure(restored.environmentalExposures, receipt({ id: 'next', fromWorldMinute: 480, toWorldMinute: 540 }), 540).ok).toBe(true)
})

it.each(['protected', 'success', 'failure'] as const)('deduplicates %s outcomes, overlapping periods and partial retries', outcome => {
  const rows = [receipt({ outcome })], before = structuredClone(rows)
  for (const [fromWorldMinute, toWorldMinute] of [[410, 430], [430, 450], [400, 500], [470, 500]]) {
    expect(appendCampaignEnvironmentalExposure(rows, receipt({ id: 'new', fromWorldMinute, toWorldMinute }), 540).ok).toBe(false)
  }
  expect(rows).toEqual(before)
})

it('separates actors and hazards but never reuses a receipt ID', () => {
  const rows = [receipt()]
  expect(appendCampaignEnvironmentalExposure(rows, receipt({ id: 'other', subjectId: 'character:other' }), 480).ok).toBe(true)
  expect(appendCampaignEnvironmentalExposure(rows, receipt({ id: 'heat', hazard: 'extreme-heat' }), 480).ok).toBe(true)
  expect(appendCampaignEnvironmentalExposure(rows, receipt({ subjectId: 'character:other' }), 480).ok).toBe(false)
})

it.each([
  { fromWorldMinute: 480 }, { toWorldMinute: 481 }, { fromWorldMinute: -1 }, { dc: 0 }, { dc: 1.5 },
  { subjectId: '' }, { outcome: 'pending' }, { hazard: 'fire' },
])('rejects invalid or future receipts in client validation: %j', patch => {
  const invalid = { ...receipt(), ...patch }
  expect(validCampaignEnvironmentalExposures([invalid], 480)).toBe(false)
  expect(validateSharedCampaignTime({ ...normalizeSharedCampaignTime(null), environmentalExposures: [invalid] })).toBe(false)
})

it('rejects overlapping persisted records and does not prune replay protection at capacity', () => {
  expect(validCampaignEnvironmentalExposures([receipt(), receipt({ id: 'overlap' })], 480)).toBe(false)
  const rows = Array.from({ length: 4096 }, (_, index) => receipt({ id: `id:${index}`, subjectId: `actor:${index}` }))
  expect(appendCampaignEnvironmentalExposure(rows, receipt({ id: 'extra', subjectId: 'extra' }), 480))
    .toEqual({ ok: false, reason: 'environmental-exposure-record-limit' })
  expect(rows).toHaveLength(4096)
})

it('applies the same validation to Host shared-state writes', () => {
  const state = { ...normalizeSharedCampaignTime(null), environmentalExposures: [receipt()] }
  expect(validateSharedStateShape('campaign-time', state)).toEqual({ ok: true })
  for (const rows of [[receipt(), receipt({ id: 'duplicate-period' })], [receipt({ toWorldMinute: 481 })], null]) {
    expect(validateSharedStateShape('campaign-time', { ...state, environmentalExposures: rows }))
      .toEqual({ ok: false, reason: 'invalid-environmental-exposures' })
    expect(mutateCampaignTimeState({ ...state, environmentalExposures: rows }, { operation: 'advance', minutes: 60 }, 1, { role: 'dm', memberId: 'host' }))
      .toMatchObject({ ok: false, error: 'invalid-environmental-exposures' })
  }
})
