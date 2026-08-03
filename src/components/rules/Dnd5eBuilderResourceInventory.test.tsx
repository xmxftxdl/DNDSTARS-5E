import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Dnd5eBuilderResourceInventory from './Dnd5eBuilderResourceInventory'
import {
  dnd5eBuilderAutomationStatus,
  summarizeDnd5eBuilderResourceInventory,
  type Dnd5eBuilderResourceInventoryEntry,
} from './dnd5eBuilderResourceInventoryModel'

const entries: readonly Dnd5eBuilderResourceInventoryEntry[] = [
  {
    id: 'custom-fighter',
    name: '自定义战士',
    automation: { full: 2, partial: 1, manual: 0, referenceOnly: 0 },
  },
  {
    id: 'lore-only',
    name: '资料职业',
    automation: { full: 0, partial: 0, manual: 0, referenceOnly: 1 },
  },
]

describe('Dnd5eBuilderResourceInventory', () => {
  it('按能力数量汇总 Headless 覆盖，并区分资源数量', () => {
    expect(summarizeDnd5eBuilderResourceInventory(entries)).toMatchObject({
      resources: 2,
      automationUnits: 4,
      full: 2,
      partial: 1,
      manual: 0,
      referenceOnly: 1,
      partialResources: 1,
      referenceOnlyResources: 1,
    })
    expect(dnd5eBuilderAutomationStatus(entries[0].automation)).toBe('partial')
    expect(dnd5eBuilderAutomationStatus(entries[1].automation)).toBe('reference-only')
  })

  it('只渲染传入的当前分类资源', () => {
    const markup = renderToStaticMarkup(createElement(Dnd5eBuilderResourceInventory, {
      sectionLabel: '职业',
      entries,
    }))
    expect(markup).toContain('已接入的职业')
    expect(markup).toContain('自定义战士')
    expect(markup).toContain('资料职业')
    expect(markup).not.toContain('怪物工坊')
  })
})
