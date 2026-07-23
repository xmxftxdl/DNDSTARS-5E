import { describe, expect, it } from 'vitest'
import { createSharedWriteWatermark } from './sharedWriteWatermark'

describe('shared write watermark', () => {
  it('blocks an older remote snapshot while a local write is pending', () => {
    const watermark = createSharedWriteWatermark(10)
    watermark.begin(20)
    expect(watermark.shouldApplyRemote(19)).toBe(false)
    expect(watermark.shouldApplyRemote(20)).toBe(true)
  })

  it('releases the pending guard when the authoritative write is rejected', () => {
    const watermark = createSharedWriteWatermark(10)
    const ticket = watermark.begin(20)
    expect(watermark.settle(ticket, false)).toBe(true)
    expect(watermark.shouldApplyRemote(11)).toBe(true)
  })

  it('ignores settlement from a superseded local write', () => {
    const watermark = createSharedWriteWatermark(10)
    const first = watermark.begin(20)
    const second = watermark.begin(21)
    expect(watermark.settle(first, true)).toBe(false)
    expect(watermark.shouldApplyRemote(20)).toBe(false)
    expect(watermark.settle(second, true)).toBe(true)
    expect(watermark.shouldApplyRemote(20)).toBe(false)
    expect(watermark.shouldApplyRemote(21)).toBe(true)
  })
})
