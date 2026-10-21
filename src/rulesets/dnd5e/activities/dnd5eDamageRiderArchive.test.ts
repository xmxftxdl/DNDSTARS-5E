import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, endDnd5eConcentration } from '../headlessCombatEngine'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it.each(['direct', 'compiled'] as const)('reinstalls an exported grant/suppression/damage-source chain (%s)', async route => {
  const namespace = 'test.archived-damage-rider'
  const base = { schemaVersion: 1 as const, activation: { kind: 'free' as const },
    automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature' as const, id: 'benefit' } }
  const cast: Dnd5eActivityDefinitionV1 = { ...base, id: 'cast', name: 'Synthetic cast',
    target: { kind: 'creature', count: 1, relation: 'any', rangeFeet: 60 },
    effects: [{ schemaVersion: 1, id: 'grant', name: 'Synthetic grant', concentration: true, stacking: 'replace',
      duration: { kind: 'concentration', maximumRounds: 10 }, grants: ['rider'],
      modifiers: [{ kind: 'suppress-damage-resistance', damageType: 'fire' }] }],
    outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'grant', kind: 'apply-effect', target: 'target', effectId: 'grant' }] }] }
  const rider: Dnd5eActivityDefinitionV1 = { ...base, id: 'rider', name: 'Synthetic rider', target: { kind: 'self' }, requiresEffectGrant: true,
    invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic' },
    requirements: [{ kind: 'damage-type', damageTypes: ['fire'] }, { kind: 'once-per-turn', key: 'bonus' }],
    outcomes: [{ id: 'bonus', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'actor',
      damageType: 'fire', damageSource: 'grant-source', magical: true, amount: { kind: 'constant', value: 7 } }] }] }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic chain', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'benefit', name: 'Synthetic chain',
      automation: base.automation, activities: [cast, rider],
      payload: { id: 'benefit', name: 'Synthetic chain', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }] }
  const original = structuredClone(bundle)
  let archive = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(archive)
    expect(decoded.bundle.definitions[0].activities).toEqual(original.definitions[0].activities)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player',
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
        currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
      const caster = make('caster', 20), target = make('target', 10)
      caster.pluginFeatureIds = [`${namespace}:benefit`]
      target.damageResistances = ['fire']
      const start = startDnd5eHeadlessCombat('archive-chain', [caster, target])
      start.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(caster.id, target.id)]: 5 }
      const castResult = route === 'compiled' ? { phase: 'commit' as const, result: resolveDnd5eHeadlessAction(start, {
        type: 'plugin', pluginId: namespace, actionId: 'cast', featureId: `${namespace}:benefit`, actorId: caster.id,
        targetId: target.id, targetIds: [target.id], distanceFeet: 5, rolls: {} }) } : resolveRegisteredDnd5eActivityInCombatV1({ state: start, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {},
        command: { schemaVersion: 1, commandId: 'cast', actorId: caster.id, packageId: namespace, packageVersion: '1.0.0',
          activityId: 'cast', targetIds: [target.id], expectedRevision: 1 } })
      expect(castResult.result.ok, JSON.stringify(castResult)).toBe(true)
      if (castResult.phase !== 'commit' || !castResult.result.ok) throw Error('Cast failed')
      let state = JSON.parse(JSON.stringify(castResult.result.state)) as typeof start
      const grant = state.combatants.target.classState.activeEffects?.find(effect => effect.grantedActivities?.includes('rider'))
      expect(state.combatants.target.classState.activeEffects, JSON.stringify(state.combatants.target.classState.activeEffects)).toEqual(expect.arrayContaining([expect.objectContaining({ modifiers: expect.objectContaining({ suppressDamageResistance: 'fire' }) })]))
      expect(grant?.source.actorId).toBe(caster.id)
      const attack = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: caster.id, targetId: target.id, attackModifier: 10,
        d20: 15, damage: { count: 1, sides: 8, rolls: [8], bonus: 0, type: 'fire' } })
      expect(attack.ok).toBe(true)
      expect(attack.state.combatants.target.currentHp).toBe(32)
      const settled = await settleDnd5eActivityTriggerWindowsV1({ state: attack.state, events: attack.events, eventBatchId: 'hit', combatRevision: 2,
        confirm: async () => { throw Error('Automatic') }, roll: async () => { throw Error('Constant') } })
      expect(settled.diagnostics.filter(item => item.status !== 'resolved')).toEqual([])
      expect(settled.state.combatants.target.currentHp).toBe(25)
      expect(settled.events).toContainEqual(expect.objectContaining({ type: 'damage-applied', sourceId: caster.id, targetId: target.id, amount: 7 }))
      state = JSON.parse(JSON.stringify(settled.state))
      endDnd5eConcentration(state, state.combatants.caster, [])
      expect(state.combatants.target.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('rider'))).not.toBe(true)
      const afterEnd = await settleDnd5eActivityTriggerWindowsV1({ state, events: attack.events, eventBatchId: 'after-end', combatRevision: 3,
        confirm: async () => { throw Error('Expired') }, roll: async () => { throw Error('Expired') } })
      expect(afterEnd.state.combatants.target.currentHp).toBe(25)
      expect(afterEnd.events).toEqual([])
      expect(state.combatants.target.damageResistances).toEqual(['fire'])
      for (const actorId of [caster.id, target.id]) {
        const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
        expect(ended.ok).toBe(true)
        state = ended.state
      }
      const restored = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: caster.id, targetId: target.id, attackModifier: 10,
        d20: 15, damage: { count: 1, sides: 8, rolls: [8], bonus: 0, type: 'fire' } })
      expect(restored.ok).toBe(true)
      expect(restored.state.combatants.target.currentHp).toBe(21)
      const expired = await settleDnd5eActivityTriggerWindowsV1({ state: restored.state, events: restored.events, eventBatchId: 'fresh-turn-after-end', combatRevision: 4,
        confirm: async () => { throw Error('Expired') }, roll: async () => { throw Error('Expired') } })
      expect(expired.events).toEqual([])
      archive = await exportDnd5eStarMod(decoded.bundle)
    } finally { dispose() }
  }
  expect(bundle).toEqual(original)
}, 20000)
