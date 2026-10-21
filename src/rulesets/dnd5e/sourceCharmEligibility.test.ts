import { expect, it } from 'vitest'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { createDnd5eConditionEffect } from './activeEffects'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { validateDnd5eActivityPredicateV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5ePredicateV1 } from './activities/dnd5eEffectContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { dnd5eActiveCharmSourceIds } from './sourceCharmEligibility'

it.each([0, 30, 30.01, undefined])('imports selected charm with authoritative distance %s and author duration across reload', async distance => {
  const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Selected charm', version: '1.0.0',
    features: [{ id: 'charm', name: 'Charm', summary: 'Fixture', description: 'Fixture', automation: 'full' }],
    activities: [{ schemaVersion: 1, id: 'charm', name: 'Charm', activation: { kind: 'action' },
      legacySource: { kind: 'feature', id: 'charm' }, target: { kind: 'creature', relation: 'any', count: 1 },
      choices: [{ id: 'friend', label: 'Friend', optionsFrom: 'combat-creatures', options: [] }],
      effects: [{ schemaVersion: 1, id: 'charm', name: 'Charm', conditions: ['charmed'], stacking: 'replace',
        duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' } }],
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect',
        target: 'target', effectId: 'charm', charmedSourceChoiceId: 'friend', conditionSourceMaximumDistanceFeet: 30 }] }],
      automation: automationCapabilityFromLegacyStatus('full') }],
  }))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const author = make('author', 20)
    author.pluginFeatureIds = [`${pkg.manifest.id}:charm`]
    let state = startDnd5eHeadlessCombat('selected-charm', [author, make('friend', 15), make('target', 10)])
    if (distance != null) state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('target', 'friend')]: distance }
    const result = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: pkg.manifest.id, actionId: 'charm',
      featureId: author.pluginFeatureIds[0], actorId: 'author', targetId: 'target', targetIds: ['target'],
      payload: { activityChoices: { friend: 'friend' }, distanceFeetBetweenTargets: { target: { friend: 0 } } }, rolls: {} })
    const allowed = distance != null && distance <= 30
    expect(result.ok, result.ok ? '' : result.reason).toBe(allowed)
    const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
      command: { schemaVersion: 1, commandId: 'selected-charm', actorId: 'author',
        packageId: pkg.manifest.id, packageVersion: pkg.manifest.version, activityId: 'charm',
        targetIds: ['target'], choices: { friend: 'friend' }, expectedRevision: 1 },
      authoritativeRolls: {}, confirmedBy: 'actor' }).result
    expect(direct.ok, JSON.stringify(direct)).toBe(allowed)
    if (direct.ok) expect(dnd5eActiveCharmSourceIds(direct.state.combatants.target.classState.activeEffects)).toEqual(['friend'])
    if (!allowed) { expect(result.state.combatants.target.classState.activeEffects ?? []).toEqual([]); return }
    state = JSON.parse(JSON.stringify(result.state))
    expect(dnd5eActiveCharmSourceIds(state.combatants.target.classState.activeEffects)).toEqual(['friend'])
    expect(state.combatants.target.classState.activeEffects?.find(e => e.standardCondition === 'charmed')?.source.actorId).toBe('author')
    for (const actorId of ['author', 'friend', 'target']) {
      const next = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
      expect(next.ok).toBe(true); state = JSON.parse(JSON.stringify(next.state))
      expect(dnd5eActiveCharmSourceIds(state.combatants.target.classState.activeEffects)).toEqual(actorId === 'target' ? [] : ['friend'])
    }
  } finally { dispose() }
})

it.each(['ally', 'own-charm', 'other-charm', 'no-charm', 'suspended', 'suppressed', 'forged', 'selected-other', 'selected-caster'])('enforces ally or own charm against Host state: %s', async scenario => {
  const imported = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Charm eligibility test', version: '1.0.0',
    features: [{ id: 'grant', name: 'Grant', summary: 'Synthetic fixture', description: 'Synthetic fixture', automation: 'full' }],
    activities: [{ schemaVersion: 1, id: 'grant', name: 'Grant', activation: { kind: 'action' },
      legacySource: { kind: 'feature', id: 'grant' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 5 },
      requirements: [{ kind: 'target-relation', relation: 'ally', orCharmedByActor: true }],
      outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'hp', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 3 } }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }],
  }))
  const pkg = imported.package
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const make = (id: string, controller: 'player' | 'dm') => createDnd5eCombatant({ id, name: id, controller,
      initiative: id === 'caster' ? 20 : 10, abilities: { str: 10, dex: 10, con: 10, int: 2, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
      position: { x: 0, y: 0 }, concentrating: false })
    const caster = make('caster', 'player'), beast = make('beast', scenario === 'ally' ? 'player' : 'dm')
    caster.pluginFeatureIds = [`${pkg.manifest.id}:grant`]
    if (['own-charm', 'other-charm', 'suspended', 'suppressed', 'selected-other', 'selected-caster'].includes(scenario)) {
      const effect = createDnd5eConditionEffect({ condition: 'charmed', targetId: beast.id,
        source: { kind: 'spell', actorId: ['other-charm', 'selected-caster'].includes(scenario) ? 'other' : caster.id } })
      if (scenario.startsWith('selected-')) effect.tags = ['condition-entity:' + (scenario === 'selected-caster' ? caster.id : 'other')]
      if (scenario === 'suspended') effect.suspendedBy = ['test']
      beast.classState.activeEffects = [effect]
      beast.conditions = ['charmed']
    }
    if (scenario === 'suppressed') beast.magicSuppressed = true
    const state = startDnd5eHeadlessCombat('test', [caster, beast, make('other', 'player')])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(caster.id, beast.id)]: 5 }
    const action = { type: 'plugin' as const, pluginId: pkg.manifest.id, actionId: 'grant',
      featureId: caster.pluginFeatureIds[0], actorId: caster.id, targetId: beast.id, targetIds: [beast.id], distanceFeet: 5, rolls: {} }
    if (scenario === 'forged') Object.assign(action, { charmedByActorIds: [caster.id] })
    const result = resolveDnd5eHeadlessAction(state, action)
    const allowed = scenario === 'ally' || scenario === 'own-charm' || scenario === 'selected-caster'
    expect(result.ok, result.ok ? '' : result.reason).toBe(allowed)
    expect(result.state.combatants.beast.temporaryHp).toBe(allowed ? 3 : 0)
  } finally { dispose() }
})

it.each([
  { kind: 'target-relation', relation: 'ally', orCharmedByActor: false },
  { kind: 'target-relation', relation: 'enemy', orCharmedByActor: true },
  { kind: 'target-relation', relation: 'any', orCharmedByActor: 'yes' },
])('rejects malformed charm alternatives %j', value => {
  expect(validateDnd5eActivityPredicateV1(value as Dnd5ePredicateV1).length).toBeGreaterThan(0)
})
