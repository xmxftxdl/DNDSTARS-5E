import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'

it.each(['marker', 'condition', 'modifier', 'extension'] as const)('preserves a one-use %s grant through archive export, independent installs and Host consumption', async variant => {
  const namespace = 'test.single-use-archive'
  const automation = automationCapabilityFromLegacyStatus('full')
  const base = { schemaVersion: 1 as const, activation: { kind: 'free' as const },
    target: { kind: 'self' as const }, automation, legacySource: { kind: 'feature' as const, id: 'gift' } }
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic single-use module', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'gift', name: 'Gift', automation,
      payload: { id: 'gift', name: 'Gift', summary: 'Synthetic', description: 'Synthetic fixture', automation: 'full' },
      activities: [{ ...base, id: 'gift', name: 'Gift',
        effects: [{ schemaVersion: 1, id: 'grant', name: 'Grant', grants: ['follow-up'], grantsSingleUse: true,
          duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' }, stacking: 'replace',
          conditions: variant === 'condition' ? ['prone'] : [],
          extensionCondition: variant === 'extension' ? 'test-single-use-grant' : undefined,
          modifiers: variant === 'modifier' ? [{ kind: 'speed', mode: 'add', value: { kind: 'constant', value: 5 } }] : [] }],
        outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'grant', kind: 'apply-effect', target: 'actor', effectId: 'grant' }] }],
      }, { ...base, id: 'follow-up', name: 'Follow-up', requiresEffectGrant: true,
        outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 2 } }] }],
      }],
    }],
  }
  const original = structuredClone(bundle)
  let bytes = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(bytes)
    expect(decoded.bundle.definitions[0].activities![0].effects![0].grantsSingleUse).toBe(true)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      expect(getRegisteredDnd5eActivity(namespace, 'gift')?.effects?.[0].grantsSingleUse).toBe(true)
      const actor = createDnd5eCombatant({ id: 'hero', name: 'Hero', controller: 'player', initiative: 20,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
        armorClass: 12, currentHp: 10, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
        pluginFeatureIds: [`${namespace}:gift`] })
      const opponent = { ...structuredClone(actor), id: 'opponent', controller: 'dm' as const, initiative: 10, pluginFeatureIds: [] }
      let state = startDnd5eHeadlessCombat(`archive-${installation}`, [actor, opponent])
      const run = (activityId: string) => resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
        command: { schemaVersion: 1, commandId: `${installation}:${activityId}`, actorId: 'hero', packageId: namespace,
          packageVersion: '1.0.0', activityId, targetIds: ['hero'], expectedRevision: 1 }, authoritativeRolls: {}, confirmedBy: 'actor' })
      expect(run('follow-up').result.ok).toBe(false)
      const grant = run('gift')
      expect(grant.result.ok, JSON.stringify(grant)).toBe(true)
      if (grant.phase !== 'commit' || !grant.result.ok) throw Error('Grant did not commit')
      state = JSON.parse(JSON.stringify(grant.result.state))
      expect(state.combatants.hero.classState.activeEffects).toContainEqual(expect.objectContaining({ grantedActivitiesSingleUse: true }))
      const consumed = run('follow-up')
      expect(consumed.result.ok, JSON.stringify(consumed)).toBe(true)
      if (consumed.phase !== 'commit' || !consumed.result.ok) throw Error('Follow-up did not commit')
      state = JSON.parse(JSON.stringify(consumed.result.state))
      expect(state.combatants.hero.currentHp).toBe(12)
      expect((state.combatants.hero.classState.activeEffects ?? []).some(effect => effect.grantedActivities?.includes('follow-up'))).toBe(false)
      expect(run('follow-up').result.ok).toBe(false)
      expect(state.combatants.hero.currentHp).toBe(12)
      bytes = await exportDnd5eStarMod(decoded.bundle)
    } finally { dispose() }
    expect(getRegisteredDnd5eActivity(namespace, 'gift')).toBeUndefined()
  }
  expect(bundle).toEqual(original)
})
