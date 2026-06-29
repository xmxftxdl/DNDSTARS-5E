import { describe, expect, it } from 'vitest'
import { shouldSendPlayerReadyFeatureToDm } from './playerFeatureActivation'

describe('player feature activation routing', () => {
  it('routes player-triggered active features through the DM authority path', () => {
    expect(shouldSendPlayerReadyFeatureToDm('doubleArrow')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('preciseStrike')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('eagleEye')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('stillWater')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('finale')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('flexibleBody')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('showtime')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('windBlade')).toBe(true)
  })

  it('does not route passive features as player action requests', () => {
    expect(shouldSendPlayerReadyFeatureToDm('calmMind')).toBe(false)
    expect(shouldSendPlayerReadyFeatureToDm('huntingMark')).toBe(false)
  })
})
