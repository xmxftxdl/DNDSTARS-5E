import { describe, expect, it } from 'vitest'
import { dnd5ePersistentAreaRenderPreset } from './persistentAreaRenderPreset'

describe('dnd5ePersistentAreaRenderPreset', () => {
  it('将新旧防护法阵区域都路由到专用动画', () => {
    expect(dnd5ePersistentAreaRenderPreset({
      sourceKind: 'core-spell',
      coreSpellId: 'magic-circle',
      visual: { preset: 'arcane', intensity: 'normal' },
    })).toBe('magic-circle')
    expect(dnd5ePersistentAreaRenderPreset({
      sourceKind: 'core-spell',
      coreSpellId: 'magic-circle',
    })).toBe('magic-circle')
  })

  it('保留其他区域的既有表现预设', () => {
    expect(dnd5ePersistentAreaRenderPreset({
      sourceKind: 'core-spell',
      coreSpellId: 'fog-cloud',
      visual: { preset: 'fog-cloud', intensity: 'normal' },
    })).toBe('fog-cloud')
    expect(dnd5ePersistentAreaRenderPreset({
      sourceKind: 'plugin-feature',
      visual: { preset: 'arcane', intensity: 'subtle' },
    })).toBe('arcane')
  })
})
