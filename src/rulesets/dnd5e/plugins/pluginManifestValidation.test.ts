import { describe, expect, it } from 'vitest'
import { DND5E_PLUGIN_CONTENT_CATEGORY_IDS } from '../../../../shared/plugin-content-category.mjs'
import { validateDnd5eRulesPluginManifest } from './pluginManifestValidation'
import type { Dnd5eRulesPluginManifest } from './pluginManifestContracts'

const BASE_MANIFEST: Dnd5eRulesPluginManifest = {
  id: 'com.example.category-test',
  name: '分类测试扩展',
  version: '1.0.0',
  apiVersion: 2,
  rulesetId: 'dnd5e-2014-srd-5.1',
  publisher: 'DNDSTARS Tests',
  license: 'CC0-1.0',
}

describe('plugin manifest content category validation', () => {
  it('accepts every marketplace content category from the shared contract', () => {
    for (const contentCategory of DND5E_PLUGIN_CONTENT_CATEGORY_IDS) {
      expect(() => validateDnd5eRulesPluginManifest({
        ...BASE_MANIFEST,
        contentCategory,
      })).not.toThrow()
    }
  })

  it('rejects unknown categories', () => {
    expect(() => validateDnd5eRulesPluginManifest({
      ...BASE_MANIFEST,
      contentCategory: 'unknown' as Dnd5eRulesPluginManifest['contentCategory'],
    })).toThrow('Invalid plugin content category')
  })
})
