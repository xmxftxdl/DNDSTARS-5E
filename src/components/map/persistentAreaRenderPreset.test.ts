import { describe, expect, it } from 'vitest'
import { dnd5ePersistentAreaRenderPreset } from './persistentAreaRenderPreset'

describe('dnd5ePersistentAreaRenderPreset', () => {
  it.each(['magic-circle', 'alarm'])('将新旧 %s 区域都路由到专用动画', (spellId) => {
    expect(dnd5ePersistentAreaRenderPreset({
      sourceKind: 'core-spell',
      coreSpellId: spellId,
      visual: { preset: 'arcane', intensity: 'normal' },
    })).toBe(spellId)
    expect(dnd5ePersistentAreaRenderPreset({
      sourceKind: 'core-spell',
      coreSpellId: spellId,
    })).toBe(spellId)
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
