import { describe, expect, it } from 'vitest'
import { createLatestTokenMovePreviewTracker } from './latestTokenMovePreview'

describe('latest Token move preview tracker', () => {
  it('does not let an older queued save release a newer drag preview', () => {
    const tracker = createLatestTokenMovePreviewTracker()
    const first = tracker.begin('monster')
    const second = tracker.begin('monster')

    expect(tracker.complete('monster', first)).toBe(false)
    expect(tracker.isPending('monster')).toBe(true)
    expect(tracker.complete('monster', second)).toBe(true)
    expect(tracker.isPending('monster')).toBe(false)
  })

  it('tracks different Tokens independently', () => {
    const tracker = createLatestTokenMovePreviewTracker()
    const monster = tracker.begin('monster')
    const hero = tracker.begin('hero')

    expect(tracker.complete('monster', monster)).toBe(true)
    expect(tracker.isPending('hero')).toBe(true)
    expect(tracker.complete('hero', hero)).toBe(true)
  })
})
