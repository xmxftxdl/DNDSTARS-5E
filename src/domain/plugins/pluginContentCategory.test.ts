import { describe, expect, it } from 'vitest'
import {
  DND5E_PLUGIN_CONTENT_CATEGORIES,
  DND5E_PLUGIN_CONTENT_CATEGORY_IDS,
  dnd5ePluginContentCategoryLabel,
  isDnd5ePluginContentCategory,
} from '../../../shared/plugin-content-category.mjs'

describe('D&D 5e plugin content categories', () => {
  it('provides stable unique marketplace category ids', () => {
    expect(new Set(DND5E_PLUGIN_CONTENT_CATEGORY_IDS).size).toBe(DND5E_PLUGIN_CONTENT_CATEGORY_IDS.length)
    expect(DND5E_PLUGIN_CONTENT_CATEGORY_IDS).toEqual([
      'adventure', 'monsters', 'items', 'classes', 'subclasses', 'spells',
      'feats', 'races', 'backgrounds', 'rules', 'assets', 'mixed',
    ])
  })

  it('uses reader-facing Chinese labels and a safe legacy fallback', () => {
    expect(dnd5ePluginContentCategoryLabel('adventure')).toBe('模组与冒险')
    expect(dnd5ePluginContentCategoryLabel('items')).toBe('装备与道具')
    expect(dnd5ePluginContentCategoryLabel('unknown')).toBe('综合内容包')
    expect(isDnd5ePluginContentCategory('backgrounds')).toBe(true)
    expect(isDnd5ePluginContentCategory('unknown')).toBe(false)
    expect(DND5E_PLUGIN_CONTENT_CATEGORIES.every((category) => category.description.length > 0)).toBe(true)
  })
})
