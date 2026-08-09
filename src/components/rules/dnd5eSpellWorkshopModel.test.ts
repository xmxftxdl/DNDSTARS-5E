import { describe, expect, it } from 'vitest'
import {
  buildDnd5eSpellIconPrompt,
  dnd5eSpellIconAssetDataUrl,
  dnd5eSpellIconAssetFromFile,
  dnd5eSpellPreviewClassId,
  dnd5eSpellWorkshopHeadlessReady,
  dnd5eSpellWorkshopHeadlessStatus,
} from './dnd5eSpellWorkshopModel'

const ONE_PIXEL_PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
), (character) => character.charCodeAt(0))

describe('dnd5eSpellWorkshopModel', () => {
  it('does not report an enabled but effectless spell as complete Headless', () => {
    expect(dnd5eSpellWorkshopHeadlessStatus({
      enabled: true,
      damageEnabled: false,
      conditionEnabled: false,
    })).toBe('partial')
    expect(dnd5eSpellWorkshopHeadlessReady({
      enabled: true,
      damageEnabled: true,
      conditionEnabled: false,
    })).toBe(true)
    expect(dnd5eSpellWorkshopHeadlessStatus({
      enabled: false,
      damageEnabled: true,
      conditionEnabled: false,
    })).toBe('reference-only')
  })

  it('converts a validated local PNG into a portable spell icon asset', async () => {
    const file = new File([ONE_PIXEL_PNG], 'thunderclap.png', { type: 'image/png' })
    const asset = await dnd5eSpellIconAssetFromFile('thunderclap', file)
    expect(asset).toMatchObject({ id: 'spell-thunderclap-icon', mediaType: 'image/png' })
    expect(dnd5eSpellIconAssetDataUrl(asset)).toMatch(/^data:image\/png;base64,/)
  })

  it('rejects executable vector images', async () => {
    const file = new File(['<svg/>'], 'spell.svg', { type: 'image/svg+xml' })
    await expect(dnd5eSpellIconAssetFromFile('unsafe', file)).rejects.toThrow('PNG、JPG 或 WebP')
  })

  it('asks the image model for foreground art and leaves class framing to the app', () => {
    const prompt = buildDnd5eSpellIconPrompt({
      name: '星火矛',
      englishName: 'Starfire Lance',
      school: 'evocation',
      damageType: 'radiant',
      description: 'A lance of stellar fire strikes one target.',
    })
    expect(prompt).toContain('Starfire Lance')
    expect(prompt).toContain('Do not draw a frame')
    expect(prompt).toContain('class-specific background')
    expect(prompt).toContain('fully transparent alpha background')
    expect(prompt).toContain('No scenery, backdrop, gradient')
  })

  it('previews the most recently selected spell class', () => {
    expect(dnd5eSpellPreviewClassId(['artificer', 'paladin'])).toBe('paladin')
    expect(dnd5eSpellPreviewClassId([])).toBe('wizard')
  })
})
