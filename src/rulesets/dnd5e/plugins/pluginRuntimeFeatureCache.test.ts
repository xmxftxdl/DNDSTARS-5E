import { describe, expect, it } from 'vitest'
import type { Character } from '../../../types/character'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { registerContentDefinitionPackage } from '../../../domain/content/contentDefinitionRegistry'
import { registerDnd5eRulesPlugin, type Dnd5eRulesPlugin } from '../pluginApi'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginFeatureDefinition,
  registeredDnd5ePluginFeatures,
  runtimeDnd5ePluginFeatures,
} from './pluginContentCatalog'

const id = 'local.runtime-feature-cache'
const featureId = `${id}:guard`
function plugin(isAvailable?: (character: Character) => boolean, bonus = 1): Dnd5eRulesPlugin {
  return {
    manifest: { id, name: 'Runtime cache', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
    setup(api) {
      api.registerFeature({ id: 'guard', name: 'Guard', summary: 'Guard', description: 'Guard', automation: 'full',
        staticModifiers: { armorClassBonus: bonus }, isAvailable })
    },
  }
}

describe('runtime feature definition cache', () => {
  it('reuses immutable definitions while preserving editable public copies', () => {
    const dispose = registerDnd5eRulesPlugin(plugin())
    try {
      const first = runtimeDnd5ePluginFeatures()
      const feature = first.find(entry => entry.id === featureId)!
      expect(runtimeDnd5ePluginFeatures()).toBe(first)
      expect(Object.isFrozen(feature.staticModifiers)).toBe(true)
      expect(() => { feature.staticModifiers!.armorClassBonus = 99 }).toThrow()
      const editable = dnd5ePluginFeatureDefinition(featureId)!
      editable.staticModifiers!.armorClassBonus = 8
      expect(runtimeDnd5ePluginFeatures().find(entry => entry.id === featureId)?.staticModifiers?.armorClassBonus).toBe(1)
      expect(registeredDnd5ePluginFeatures().find(entry => entry.id === featureId)?.staticModifiers?.armorClassBonus).toBe(1)
    } finally { dispose() }
  })

  it('invalidates after unload and replacement, including the same ID and version', () => {
    const dispose = registerDnd5eRulesPlugin(plugin())
    const before = runtimeDnd5ePluginFeatures()
    dispose()
    expect(runtimeDnd5ePluginFeatures().some(entry => entry.id === featureId)).toBe(false)
    const replacement = registerDnd5eRulesPlugin(plugin(undefined, 3))
    try {
      expect(runtimeDnd5ePluginFeatures()).not.toBe(before)
      expect(runtimeDnd5ePluginFeatures().find(entry => entry.id === featureId)?.staticModifiers?.armorClassBonus).toBe(3)
    } finally { replacement() }
  })

  it('evaluates eligibility against the current actor on every call', () => {
    const dispose = registerDnd5eRulesPlugin(plugin(actor => actor.level >= 5))
    const actor = { level: 4, charClass: '', race: '', dnd5ePluginFeatureIds: [featureId] } as Character
    try {
      expect(dnd5eCharacterHasPluginFeature(actor, featureId)).toBe(false)
      actor.level = 5
      expect(dnd5eCharacterHasPluginFeature(actor, featureId)).toBe(true)
      actor.dnd5ePluginFeatureIds = []
      expect(dnd5eCharacterHasPluginFeature(actor, featureId)).toBe(false)
    } finally { dispose() }
  })

  it('also invalidates when unified content changes independently of the plugin registry', () => {
    const dispose = registerDnd5eRulesPlugin(plugin())
    const before = runtimeDnd5ePluginFeatures()
    const content = registerContentDefinitionPackage({ packageId: id, packageVersion: '1.0.0', definitions: [{
      schemaVersion: 1, id: 'guard', namespace: id, version: '1.0.0', kind: 'feature', name: 'Guard',
      payload: { id: 'guard', automation: 'manual' }, automation: automationCapabilityFromLegacyStatus('manual'),
    }] })
    try {
      expect(runtimeDnd5ePluginFeatures()).not.toBe(before)
      expect(runtimeDnd5ePluginFeatures().find(entry => entry.id === featureId)?.automation).toBe('manual')
      content.dispose()
      expect(runtimeDnd5ePluginFeatures().find(entry => entry.id === featureId)?.automation).toBe('full')
    } finally { content.dispose(); dispose() }
  })
})
