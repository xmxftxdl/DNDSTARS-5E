import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES,
  dnd5ePluginImageAsset,
  registerDnd5ePluginImageAsset,
  validateDnd5ePluginImageAsset,
} from './pluginAssets'

function png(byteLength: number) {
  const bytes = Buffer.alloc(byteLength, 1)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return { id: 'test-image', mediaType: 'image/png' as const, dataBase64: bytes.toString('base64') }
}

afterEach(() => vi.restoreAllMocks())

describe('plugin image validation', () => {
  it.each([12, 13, 14, 15, DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES])(
    'keeps the exact decoded size for a %i byte image', (byteLength) => {
      const definition = png(byteLength)
      expect(validateDnd5ePluginImageAsset(definition)).toEqual({ byteLength, dataBase64: definition.dataBase64 })
    },
  )

  it('validates a maximum-size image without decoding its entire payload', () => {
    const decode = vi.spyOn(globalThis, 'atob')
    validateDnd5ePluginImageAsset(png(DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES))
    expect(decode).toHaveBeenCalledOnce()
    expect(decode.mock.calls[0]![0].length).toBeLessThanOrEqual(16)
  })

  it('checks the full alphabet and padding even beyond the signature', () => {
    const definition = png(60)
    for (const suffix of ['!', '=', '===', '=AAA', '-AAA', '_AAA']) {
      expect(() => validateDnd5ePluginImageAsset({
        ...definition, dataBase64: definition.dataBase64 + suffix,
      })).toThrow('base64')
    }
    expect(() => validateDnd5ePluginImageAsset({
      ...definition, dataBase64: definition.dataBase64.slice(0, -1),
    })).toThrow('base64')
  })

  it('preserves whitespace normalization and rejects undersized, oversized and mismatched images', () => {
    const definition = png(24)
    expect(validateDnd5ePluginImageAsset({
      ...definition, dataBase64: ` \n${definition.dataBase64.slice(0, 16)}\t${definition.dataBase64.slice(16)} `,
    })).toEqual({ byteLength: 24, dataBase64: definition.dataBase64 })
    expect(() => validateDnd5ePluginImageAsset(png(9))).toThrow('size')
    expect(() => validateDnd5ePluginImageAsset(png(DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES + 1))).toThrow('size')
    expect(() => validateDnd5ePluginImageAsset({ ...definition, mediaType: 'image/jpeg' })).toThrow('do not match')
    expect(() => validateDnd5ePluginImageAsset({ ...definition, mediaType: 'image/webp' })).toThrow('do not match')
  })

  it('still registers the complete image for display and removes it on disposal', () => {
    const definition = png(27)
    const registered = registerDnd5ePluginImageAsset('local.asset-test', definition)
    try {
      expect(dnd5ePluginImageAsset(registered.id)).toMatchObject({
        byteLength: 27, dataUrl: `data:image/png;base64,${definition.dataBase64}`,
      })
    } finally { registered.dispose() }
    expect(dnd5ePluginImageAsset(registered.id)).toBeUndefined()
  })
})
