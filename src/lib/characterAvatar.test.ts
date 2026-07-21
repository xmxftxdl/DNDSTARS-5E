import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARACTER_AVATAR, normalizeCharacterAvatar } from './characterAvatar'

describe('character avatar', () => {
  it('keeps exactly one visible grapheme for a character and its map token', () => {
    expect(normalizeCharacterAvatar('🧙‍♀️🧝')).toBe('🧙‍♀️')
    expect(normalizeCharacterAvatar('战士')).toBe('战')
  })

  it('uses the D&D character fallback for an empty value', () => {
    expect(normalizeCharacterAvatar('   ')).toBe(DEFAULT_CHARACTER_AVATAR)
  })
})
