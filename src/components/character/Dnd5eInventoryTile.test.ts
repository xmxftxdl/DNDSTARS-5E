import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import Dnd5eInventoryTile from './Dnd5eInventoryTile'

const equippedEntry: Dnd5eInventoryEntry = {
  instanceId: 'equipped-longsword',
  templateId: 'srd-5.1:item:longsword',
  quantity: 1,
  equippedSlot: 'mainWeapon',
  acquiredAt: 1,
  item: {
    id: 'srd-5.1:item:longsword',
    name: '长剑',
    category: 'equipment',
    icon: 'weapon',
    description: '一把长剑。',
    rulesText: '近战武器攻击。',
    stackable: false,
    source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
  },
}

describe('Dnd5eInventoryTile', () => {
  it('does not repeat an equipped badge inside an equipment-slot tile', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eInventoryTile, {
      entry: equippedEntry,
      compact: true,
    }))

    expect(html).toContain('长剑')
    expect(html).not.toContain('已装备')
    expect(html).toContain('data-icon-detail="colored-sword"')
    expect(html).toContain('data-inventory-glyph="sword"')
    expect(html).toContain('data-icon-tone="multicolor"')
  })
})
