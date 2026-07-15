import { describe, expect, it } from 'vitest'
import { parseBoundedNumberDraft, resolveBoundedNumberDraft } from './numberInput'

describe('character sheet bounded number input', () => {
  it('keeps the previous value while the user temporarily clears the field', () => {
    expect(resolveBoundedNumberDraft('', 12, 1, 20)).toBe(12)
    expect(resolveBoundedNumberDraft('   ', 12, 1, 20)).toBe(12)
  })

  it('commits finite integer values within the configured bounds', () => {
    expect(resolveBoundedNumberDraft('7.9', 12, 1, 20)).toBe(7)
    expect(resolveBoundedNumberDraft('0', 12, 1, 20)).toBe(1)
    expect(resolveBoundedNumberDraft('21', 12, 1, 20)).toBe(20)
    expect(resolveBoundedNumberDraft('not-a-number', 12, 1, 20)).toBe(12)
  })

  it('recognizes valid drafts for immediate auto-save without committing an empty field', () => {
    expect(parseBoundedNumberDraft('', 1, 20)).toBeNull()
    expect(parseBoundedNumberDraft('12', 1, 20)).toBe(12)
    expect(parseBoundedNumberDraft('21', 1, 20)).toBe(20)
    expect(parseBoundedNumberDraft('invalid', 1, 20)).toBeNull()
  })
})
