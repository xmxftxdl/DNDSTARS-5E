import { describe, expect, it, vi } from 'vitest'
import { observeHeadlessResolution, setHeadlessResolutionObserver } from './headlessResolutionObserver'

describe('Headless resolution observer port', () => {
  it('observes without becoming part of settlement', () => {
    const observer = vi.fn(() => { throw new Error('telemetry failed') })
    const dispose = setHeadlessResolutionObserver(observer)
    expect(() => observeHeadlessResolution({ source: 1, action: 2, result: 3 })).not.toThrow()
    expect(observer).toHaveBeenCalledOnce()
    dispose()
  })
})
