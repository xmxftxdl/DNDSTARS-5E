import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DND5E_INVENTORY_ICON_IDS } from '../../types/inventory'
import Dnd5eInventoryGlyph from './Dnd5eInventoryGlyph'

describe('Dnd5eInventoryGlyph', () => {
  it('has original multicolour SVG artwork for every inventory icon id', () => {
    expect(DND5E_INVENTORY_ICON_IDS).toHaveLength(68)

    for (const icon of DND5E_INVENTORY_ICON_IDS) {
      const html = renderToStaticMarkup(createElement(Dnd5eInventoryGlyph, { icon }))
      expect(html, icon).toContain('<svg')
      expect(html, icon).toContain(`data-inventory-glyph="${icon}"`)
      expect(html, icon).toContain('data-icon-tone="multicolor"')
      expect(html, icon).toMatch(/#[0-9A-F]{6}/i)
    }
  })
})
