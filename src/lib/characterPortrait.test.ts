import { describe, expect, it } from 'vitest'
import {
  CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH,
  isCharacterPortraitDataUrl,
  normalizeCharacterPortrait,
  validateCharacterPortraitFile,
} from './characterPortrait'

describe('character portrait persistence boundary', () => {
  it('accepts supported compact image data URLs and rejects unsafe values', () => {
    const valid = 'data:image/webp;base64,YWJjZA=='
    expect(isCharacterPortraitDataUrl(valid)).toBe(true)
    expect(normalizeCharacterPortrait(valid)).toBe(valid)
    expect(normalizeCharacterPortrait('https://example.test/portrait.png')).toBeUndefined()
    expect(normalizeCharacterPortrait('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined()
    expect(normalizeCharacterPortrait(`data:image/png;base64,${'A'.repeat(CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH)}`)).toBeUndefined()
  })

  it('validates source type, size, and empty files before decoding', () => {
    expect(validateCharacterPortraitFile({ type: 'image/png', size: 1024 })).toBeNull()
    expect(validateCharacterPortraitFile({ type: 'image/gif', size: 1024 })).toContain('PNG')
    expect(validateCharacterPortraitFile({ type: 'image/jpeg', size: 0 })).toContain('为空')
    expect(validateCharacterPortraitFile({ type: 'image/webp', size: 13 * 1024 * 1024 })).toContain('12 MB')
  })
})
