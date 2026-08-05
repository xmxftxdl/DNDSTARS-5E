import { describe, expect, it } from 'vitest'
import { DND5E_CORE_SPELL_AREA_DECLARATIONS } from './coreSpellAreas'
import { DND5E_CORE_SPELL_AREA_VISUALS } from './coreSpellAreaVisuals'

describe('核心持续区域表现注册表', () => {
  it('与 Headless 区域声明保持一一对应', () => {
    expect(Object.keys(DND5E_CORE_SPELL_AREA_VISUALS).sort()).toEqual(
      DND5E_CORE_SPELL_AREA_DECLARATIONS.map((entry) => entry.spellId).sort(),
    )
    for (const declaration of DND5E_CORE_SPELL_AREA_DECLARATIONS) {
      expect(DND5E_CORE_SPELL_AREA_VISUALS[declaration.spellId]).toEqual(declaration.visual)
    }
  })
})
