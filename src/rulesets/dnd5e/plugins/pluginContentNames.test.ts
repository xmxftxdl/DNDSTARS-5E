import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from '../contentPackageV2'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import {
  registeredDnd5ePluginContentNames,
  registeredDnd5ePluginRaces,
  registeredDnd5ePluginFeatures,
  registeredDnd5ePluginSpells,
  registeredDnd5ePluginItems,
  registeredDnd5ePluginFeats,
  registeredDnd5ePluginBackgrounds,
  registeredDnd5ePluginMonsters,
  registeredDnd5ePluginSubclasses,
} from './pluginContentCatalog'

describe('lightweight plugin content inventory', () => {
  it('matches the existing runtime catalogs without exposing their executable payloads', () => {
    const source = readFileSync(new URL('../../../../examples/original-content-v2.dndstars5e', import.meta.url))
    const content = parseDnd5eContentPackageV2(Uint8Array.from(source).buffer)!
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(content))
    try {
      const expected = [
        ['race', registeredDnd5ePluginRaces()], ['feature', registeredDnd5ePluginFeatures()],
        ['spell', registeredDnd5ePluginSpells()], ['item', registeredDnd5ePluginItems()],
        ['feat', registeredDnd5ePluginFeats()], ['background', registeredDnd5ePluginBackgrounds()],
        ['monster', registeredDnd5ePluginMonsters()], ['subclass', registeredDnd5ePluginSubclasses()],
      ] as const
      const names = registeredDnd5ePluginContentNames().filter(entry => entry.ownerPluginId === content.manifest.id)
      for (const [category, entries] of expected) {
        expect(names.filter(entry => entry.category === category).sort((a, b) => a.id.localeCompare(b.id))).toEqual(entries
          .filter(entry => entry.ownerPluginId === content.manifest.id)
          .map(({ id, ownerPluginId, name }) => ({ category, id, ownerPluginId, name }))
          .sort((a, b) => a.id.localeCompare(b.id)))
      }
      expect(names.every(entry => Object.keys(entry).sort().join(',') === 'category,id,name,ownerPluginId')).toBe(true)
      names[0].name = 'caller mutation'
      expect(registeredDnd5ePluginContentNames().some(entry => entry.name === 'caller mutation')).toBe(false)
    } finally { dispose() }
    expect(registeredDnd5ePluginContentNames().some(entry => entry.ownerPluginId === content.manifest.id)).toBe(false)
  })
})
