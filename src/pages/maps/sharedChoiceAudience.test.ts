import { describe, expect, it } from 'vitest'
import { sharedChoiceAudience } from './sharedChoiceAudience'

describe('shared choice recipient ownership', () => {
  it.each(['actor', 'target'] as const)('routes a DM-owned %s choice to the DM', audience => {
    expect(sharedChoiceAudience(audience, 'dm-member', 'dm-member')).toBe('dm')
    expect(sharedChoiceAudience(audience, 'player-member', 'dm-member')).toBe(audience)
    expect(sharedChoiceAudience(audience, undefined, 'dm-member')).toBe(audience)
    expect(sharedChoiceAudience(audience, undefined, undefined)).toBe(audience)
  })
  it('preserves explicit DM adjudication for a player-owned character', () => {
    expect(sharedChoiceAudience('dm', 'player-member', 'dm-member')).toBe('dm')
  })
})
