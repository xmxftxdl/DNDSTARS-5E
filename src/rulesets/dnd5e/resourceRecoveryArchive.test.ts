import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { restoreClassResources, spendClassResource, syncCharacterClassResources } from '../../lib/classResources'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { recoverDnd5eCombatStartResources } from './combatStartResources'

it.each((['feature', 'feat'] as const).flatMap(kind => [undefined, 0].map(initialCurrent => ({ kind, initialCurrent }))))('preserves resource policies across export and independent reinstallation (%j)', async ({ kind, initialCurrent }) => {
  const namespace = `test.archive-recovery-${kind}`
  const resourceId = `${namespace}:charges`
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic recovery module', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind, id: 'recovery', name: 'Recovery',
      automation: automationCapabilityFromLegacyStatus('full'),
      payload: { id: 'recovery', name: 'Recovery', summary: 'Synthetic', description: 'Synthetic policy fixture', automation: 'full',
        resources: [{ id: 'charges', label: 'Charges', maximum: 5, resetOn: 'long-rest', restoreOnCombatStart: true,
          ...(initialCurrent === undefined ? {} : { initialCurrent }),
          restRecovery: { 'short-rest': { mode: 'restore', amount: 1, onlyWhenEmpty: true }, 'long-rest': { mode: 'set', amount: 1 } },
        }],
      },
    }],
  }
  const original = structuredClone(bundle)
  for (const resources of [[], [{ id: 'charges', label: 'Charges', maximum: 5, resetOn: 'long-rest',
    restRecovery: { 'short-rest': { mode: 'restore', amount: 1, onlyWhenEmpty: 'yes' } },
  }], [{ id: 'charges', label: 'Charges', maximum: 0, resetOn: 'short-rest' }],
  [{ id: 'charges', label: 'Charges', maximum: 5, resetOn: 'short-rest', initialCurrent: -1 }]]) {
    const invalid = structuredClone(bundle)
    // Deliberately malformed wire data; keep invalid types outside the typed bundle contract.
    Object.assign(invalid.definitions[0].payload, { resources })
    await expect(exportDnd5eStarMod(invalid)).rejects.toThrow()
  }
  let archive = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(archive)
    expect(decoded.bundle.definitions[0].payload).toMatchObject(original.definitions[0].payload)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const created = syncCharacterClassResources(normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20,
        ...(kind === 'feature' ? { dnd5ePluginFeatureIds: [`${namespace}:recovery`] } : { dnd5eFeatIds: [`${namespace}:recovery`] }),
      }))
      expect(created.classResources?.[resourceId].current).toBe(initialCurrent ?? 5)
      const actor = recoverDnd5eCombatStartResources(created)
      expect(actor.classResources?.[resourceId]).toEqual({ current: 5, max: 5 })
      const empty = spendClassResource(actor, resourceId, 5)!
      expect(syncCharacterClassResources(JSON.parse(JSON.stringify(empty))).classResources?.[resourceId].current).toBe(0)
      expect(restoreClassResources(empty, 'short-rest').classResources?.[resourceId].current).toBe(1)
      expect(restoreClassResources(actor, 'short-rest').classResources?.[resourceId].current).toBe(5)
      expect(restoreClassResources(actor, 'long-rest').classResources?.[resourceId].current).toBe(1)
      expect(recoverDnd5eCombatStartResources(empty).classResources?.[resourceId].current).toBe(5)
      archive = await exportDnd5eStarMod(decoded.bundle)
    } finally { dispose() }
    const uninstalled = normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20 })
    expect(uninstalled.classResources?.[resourceId]).toBeUndefined()
  }
  expect(bundle).toEqual(original)
})
