import { describe, expect, it } from 'vitest'
import type { Dnd5eInventoryEntry, Dnd5eInventoryItemTemplate } from '../../types/inventory'
import { dnd5eInventoryBrowserEntries } from './inventoryBrowserModel'

function entry(
  instanceId: string,
  name: string,
  category: Dnd5eInventoryItemTemplate['category'],
  weightLb: number,
  acquiredAt: number,
): Dnd5eInventoryEntry {
  return {
    instanceId,
    templateId: `test:${instanceId}`,
    quantity: 1,
    acquiredAt,
    item: {
      id: `test:${instanceId}`,
      name,
      category,
      icon: 'generic',
      description: `${name}的说明`,
      rulesText: `${name}的规则`,
      weightLb,
      stackable: false,
      source: { book: '测试', license: '测试' },
    },
  }
}

const entries = [
  entry('sword', '长剑', 'equipment', 3, 1),
  entry('potion', '治疗药水', 'consumable', 0.5, 3),
  entry('rope', '麻绳', 'adventuring-gear', 10, 2),
]

describe('BG-style inventory browser model', () => {
  it('searches all inventory text without separating equipment from items', () => {
    expect(dnd5eInventoryBrowserEntries(entries, {
      query: '药水', category: 'all', sort: 'name',
    }).map((item) => item.instanceId)).toEqual(['potion'])
  })

  it('filters categories and sorts by total weight or acquisition time', () => {
    expect(dnd5eInventoryBrowserEntries(entries, {
      query: '', category: 'equipment', sort: 'weight',
    }).map((item) => item.instanceId)).toEqual(['sword'])
    expect(dnd5eInventoryBrowserEntries(entries, {
      query: '', category: 'all', sort: 'newest',
    }).map((item) => item.instanceId)).toEqual(['potion', 'rope', 'sword'])
  })
})
