import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { restoreClassResources, syncCharacterClassResources } from '../../lib/classResources'
import { validateCombatStartResourceRecovery } from '../../lib/resourceRestRecovery'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { recoverDnd5eCombatStartResources } from './combatStartResources'

it.each(['feature', 'feat'] as const)('round trips conditional initiative recovery for %s without changing rest policy', async kind => {
  const namespace = `test.initiative-recovery-${kind}`, key = `${namespace}:charges`
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic initiative recovery', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind, id: 'recovery', name: 'Recovery',
      automation: automationCapabilityFromLegacyStatus('full'),
      payload: { id: 'recovery', name: 'Recovery', summary: 'Synthetic', description: 'Fixture', automation: 'full',
        resources: [{ id: 'charges', label: 'Charges', maximum: 3, resetOn: 'long-rest',
          combatStartRecovery: { mode: 'restore', amount: 1, onlyWhenEmpty: true, minimumClassLevel: { classId: 'fighter', level: 10 } },
        }],
      },
    }],
  }
  let archive = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(archive)
    expect(decoded.bundle.definitions[0].payload).toEqual(bundle.definitions[0].payload)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      for (const fighterLevel of [9, 10, 15]) for (const current of [0, 1, 3]) {
        const actor = syncCharacterClassResources(normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '战士', level: 20,
          dnd5eClassLevels: { fighter: fighterLevel, wizard: 20 - fighterLevel },
          ...(kind === 'feature' ? { dnd5ePluginFeatureIds: [`${namespace}:recovery`] } : { dnd5eFeatIds: [`${namespace}:recovery`] }),
          classResources: { [key]: { current, max: 3 } },
        }))
        const result = recoverDnd5eCombatStartResources(actor)
        expect(result.classResources?.[key].current).toBe(current === 0 && fighterLevel >= 10 ? 1 : current)
        expect(syncCharacterClassResources(JSON.parse(JSON.stringify(result))).classResources?.[key]).toEqual(result.classResources?.[key])
        expect(recoverDnd5eCombatStartResources(result).classResources?.[key]).toEqual(result.classResources?.[key])
        expect(restoreClassResources(actor, 'short-rest').classResources?.[key].current).toBe(current)
        expect(restoreClassResources(actor, 'long-rest').classResources?.[key].current).toBe(3)
      }
    } finally { dispose() }
    archive = await exportDnd5eStarMod(decoded.bundle)
  }
})

it('rejects malformed initiative recovery policies instead of silently restoring everything', () => {
  for (const value of [null, [], {}, { mode: 'restore', amount: -1 }, { mode: 'restore', amount: 1, onlyWhenEmpty: 'yes' },
    { mode: 'restore', amount: 1, minimumClassLevel: { classId: 'fighter', level: 0 } },
    { mode: 'restore', amount: 1, minimumClassLevel: { classId: 'fighter', level: 21 } },
    { mode: 'restore', amount: 1, unexpected: true }]) {
    expect(() => validateCombatStartResourceRecovery(value)).toThrow()
  }
})
