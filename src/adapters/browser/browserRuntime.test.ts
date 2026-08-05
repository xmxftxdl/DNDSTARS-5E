import { describe, expect, it, vi } from 'vitest'
import { browserRuntime } from './browserRuntime'

describe('browserRuntime', () => {
  it('creates bounded die values and prefixed IDs', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1234)
    expect(browserRuntime.integer(6, 6)).toBe(6)
    expect(browserRuntime.create('combat')).toMatch(/^combat-1234-/)
    now.mockRestore()
  })
})
