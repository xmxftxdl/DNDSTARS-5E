import { describe, expect, it } from 'vitest'
import { createSharedWriteWatermark } from './sharedWriteWatermark'

describe('shared write watermark', () => {
  it('accepts restored content with an older timestamp and a newer server revision', () => {
    const watermark = createSharedWriteWatermark()
    watermark.acceptRemote(200, 10)
    expect(watermark.shouldApplyRemote(100, 11)).toBe(true)
    watermark.acceptRemote(100, 11)
    expect(watermark.shouldApplyRemote(300, 10)).toBe(false)
    expect(watermark.shouldApplyRemote(100, 11)).toBe(true)
  })

  it('waits for a pending save to settle before applying restored content', () => {
    const watermark = createSharedWriteWatermark()
    watermark.acceptRemote(200, 10)
    const ticket = watermark.begin(300)
    expect(watermark.shouldApplyRemote(100, 11)).toBe(false)
    watermark.settle(ticket, false)
    expect(watermark.shouldApplyRemote(100, 11)).toBe(true)
  })

  it('rejects snapshots older than an acknowledged local server revision', () => {
    const watermark = createSharedWriteWatermark()
    const ticket = watermark.begin(200)
    watermark.settle(ticket, true, 12)
    expect(watermark.shouldApplyRemote(300, 11)).toBe(false)
    expect(watermark.shouldApplyRemote(100, 13)).toBe(true)
  })
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
