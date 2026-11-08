import { describe, expect, it, vi } from 'vitest'
import {
  CHARACTER_INITIATIVE_PORTRAIT_HEIGHT,
  CHARACTER_INITIATIVE_PORTRAIT_WIDTH,
  CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH,
  characterPortraitBlob,
  drawCharacterPortraitCrop,
  isCharacterPortraitDataUrl,
  normalizeCharacterInitiativePortrait,
  normalizeCharacterPortrait,
  normalizeCharacterTokenPortrait,
  validateCharacterPortraitFile,
} from './characterPortrait'

describe('character portrait persistence boundary', () => {
  it('decodes portrait bytes locally without a data URL network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    try {
      for (const type of ['png', 'jpeg', 'webp']) {
        const blob = characterPortraitBlob(`data:image/${type};base64,AAEC/w==`)
        expect(blob.type).toBe(`image/${type}`)
        expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0, 1, 2, 255])
      }
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(() => characterPortraitBlob('https://example.test/npc.png')).toThrow('画像数据无效')
      expect(() => characterPortraitBlob('data:text/html;base64,YWJj')).toThrow('画像数据无效')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('accepts supported compact image data URLs and rejects unsafe values', () => {
    const valid = 'data:image/webp;base64,YWJjZA=='
    expect(isCharacterPortraitDataUrl(valid)).toBe(true)
    expect(normalizeCharacterPortrait(valid)).toBe(valid)
    expect(normalizeCharacterInitiativePortrait(valid)).toBe(valid)
    expect(normalizeCharacterTokenPortrait(valid)).toBe(valid)
    expect(normalizeCharacterPortrait('https://example.test/portrait.png')).toBeUndefined()
    expect(normalizeCharacterPortrait('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined()
    expect(normalizeCharacterPortrait(`data:image/png;base64,${'A'.repeat(CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH)}`)).toBeUndefined()
  })

  it('renders a portrait-derived initiative crop at the initiative card aspect ratio', () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    } as unknown as CanvasRenderingContext2D
    const image = { naturalWidth: 480, naturalHeight: 640 } as HTMLImageElement

    drawCharacterPortraitCrop(
      context,
      image,
      { centerX: 0.5, centerY: 0.5, zoom: 1 },
      CHARACTER_INITIATIVE_PORTRAIT_WIDTH,
      CHARACTER_INITIATIVE_PORTRAIT_HEIGHT,
    )

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 288, 376)
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, -4, 288, 384)
  })

  it('validates source type, size, and empty files before decoding', () => {
    expect(validateCharacterPortraitFile({ type: 'image/png', size: 1024 })).toBeNull()
    expect(validateCharacterPortraitFile({ type: 'image/gif', size: 1024 })).toContain('PNG')
    expect(validateCharacterPortraitFile({ type: 'image/jpeg', size: 0 })).toContain('为空')
    expect(validateCharacterPortraitFile({ type: 'image/webp', size: 13 * 1024 * 1024 })).toContain('12 MB')
  })
})
