import { describe, expect, it } from 'vitest'
import {
  campaignDawnsCrossed,
  campaignGregorianDate,
  campaignLightIsActive,
  campaignLightPresetPatch,
  canBenefitFromLongRest,
  formatCampaignTime,
  normalizeSharedCampaignTime,
  validateSharedCampaignTime,
} from './campaignTime'

describe('campaign time model', () => {
  it('formats a stable day and clock and counts 06:00 dawn boundaries', () => {
    expect(formatCampaignTime(8 * 60)).toBe('第 1 日 08:00')
    expect(formatCampaignTime(1_440 + 75)).toBe('第 2 日 01:15')
    expect(campaignDawnsCrossed(5 * 60, 6 * 60)).toBe(1)
    expect(campaignDawnsCrossed(8 * 60, 1_440 + 8 * 60)).toBe(1)
  })

  it('formats a Gregorian campaign clock without using the browser timezone', () => {
    const clock = normalizeSharedCampaignTime({
      schemaVersion: 2,
      worldMinute: 480,
      displayMode: 'gregorian',
      displayMinuteOffset: 0,
      calendarEpochDate: '1992-10-10',
      timers: [],
      advances: [],
      updatedAt: 1,
    })
    expect(formatCampaignTime(clock)).toBe('1992年10月10日 08:00')
    expect(campaignGregorianDate({ ...clock, worldMinute: 1_440 + 75 })).toBe('1992-10-11')
  })

  it('requires 24 campaign hours between long-rest benefits', () => {
    expect(canBenefitFromLongRest(undefined, 960)).toBe(true)
    expect(canBenefitFromLongRest(960, 2_399)).toBe(false)
    expect(canBenefitFromLongRest(960, 2_400)).toBe(true)
  })

  it('creates timed light patches and expires them on the authoritative clock', () => {
    const torch = campaignLightPresetPatch('torch', 480)
    expect(torch).toMatchObject({ brightRadiusFeet: 20, dimRadiusFeet: 20, expiresAtWorldMinute: 540 })
    expect(campaignLightIsActive(torch, 539)).toBe(true)
    expect(campaignLightIsActive(torch, 540)).toBe(false)
  })

  it('fails closed for malformed envelopes while preserving a safe default', () => {
    expect(validateSharedCampaignTime({ schemaVersion: 1, worldMinute: -1, timers: [], advances: [], updatedAt: 0 })).toBe(false)
    expect(validateSharedCampaignTime({ schemaVersion: 2, worldMinute: 480, displayMode: 'gregorian', displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 0 })).toBe(false)
    expect(normalizeSharedCampaignTime(null)).toMatchObject({ schemaVersion: 2, worldMinute: 480, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], advances: [] })
    expect(normalizeSharedCampaignTime({ schemaVersion: 1, worldMinute: 600, timers: [], advances: [], updatedAt: 1 }))
      .toMatchObject({ schemaVersion: 2, worldMinute: 600, displayMode: 'campaign-day', displayMinuteOffset: 0 })
  })
})
