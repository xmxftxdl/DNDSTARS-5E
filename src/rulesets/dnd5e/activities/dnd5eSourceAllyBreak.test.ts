import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect, validateDnd5eActiveEffectsStrict, type Dnd5eActiveEffectBreakTrigger } from '../activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eDirectedCombatantPairKey } from '../headlessCombatPrimitives'

const packageId = 'test.source-ally-break'
const creature = (id: string, controller: 'player' | 'dm', initiative: number) => createDnd5eCombatant({ id, name: id, controller, initiative,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 15,
  currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })

it.each((['direct', 'plugin'] as const).flatMap(route => [false, true].map(ignoreCover => ({ route, ignoreCover }))))('uses fresh Host defenses between continuation attacks (%j)', ({ route, ignoreCover }) => {
  const root: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'first', name: 'First', activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
    checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', attackBonus: { kind: 'constant', value: 7 }, rollMode: 'normal', scope: 'per-target', delivery: 'ranged' }],
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'attack', result: 'success' }, operations: [{ id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 3 }, damageType: 'force' }] }],
    continuation: { nextActivityId: 'second', maximumSteps: 2, excludePreviousTargets: false },
    automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'first' },
  }
  const second: Dnd5eActivityDefinitionV1 = { ...root, id: 'second', name: 'Second', activation: { kind: 'free' }, consumption: [], continuation: undefined, requiresContinuationFrom: 'first' }
  for (const definition of [root, second]) expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [root, second] })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Chain', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    for (const definition of [root, second]) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
      api.registerFeature({ id: definition.id, name: definition.name, description: 'Test', summary: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
    }
  } })
  try {
    const actor = creature('actor', 'player', 20), target = creature('target', 'dm', 10)
    actor.pluginFeatureIds = [`${packageId}:first`]
    actor.ignoreRangedWeaponCoverBonus = ignoreCover
    target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'guard', definitionId: 'guard', label: 'Guard', targetId: target.id, source: { kind: 'feature', actorId: actor.id }, breakOn: ['attacked-by-source-or-ally'], modifiers: { armorClassBonus: 4 } })]
    let state = startDnd5eHeadlessCombat('sequential', [actor, target])
    state.distanceFeetByCombatantPair = { ['actor\u0000target']: 5 }
    state.coverBonusByCombatantPair = { [dnd5eDirectedCombatantPairKey('actor', 'target')]: 2 }
    const run = (activityId: string, commandId: string, d20 = 10, continuationId?: string) => route === 'direct'
      ? resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: { 'attack:target': { values: [d20] } }, command: { schemaVersion: 1, commandId, actorId: 'actor', packageId, packageVersion: '1.0.0', activityId, targetIds: ['target'], expectedRevision: 1, continuationId } }).result
      : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: activityId, featureId: `${packageId}:${activityId}`, actorId: 'actor', targetId: 'target', transactionId: commandId, hostEntitlement: continuationId ? { kind: 'active-effect', effectId: 'continuation:' + continuationId } : undefined, distanceFeet: 5, rolls: { 'attack:target': { values: [d20], modifier: 0, total: d20 } }, payload: continuationId ? { activityContinuationId: continuationId } : {} })
    expect(run('second', 'bypass').ok).toBe(false)
    const first = run('first', 'first-command')
    expect(first.ok, JSON.stringify(first)).toBe(true)
    if (!first.ok) throw Error('First stage failed')
    expect(first.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', armorClass: ignoreCover ? 19 : 21, hit: false }))
    state = JSON.parse(JSON.stringify(first.state))
    const afterFirst = structuredClone(state)
    expect(run('second', 'invalid-second', 0, 'first-command').ok).toBe(false)
    expect(state).toEqual(afterFirst)
    const followup = run('second', 'second-command', 10, 'first-command')
    expect(followup.ok, JSON.stringify(followup)).toBe(true)
    if (!followup.ok) throw Error('Second stage failed')
    expect(followup.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', armorClass: ignoreCover ? 15 : 17, hit: true }))
    expect(followup.state.combatants.target.currentHp).toBe(17)
    expect(followup.state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(followup.events.some(event => event.type === 'turn-resource-spent')).toBe(false)
    state = followup.state
    expect(run('second', 'third-command', 10, 'first-command').ok).toBe(false)
    expect(run('second', 'second-command', 10, 'first-command').ok).toBe(false)
  } finally { dispose(); registration.dispose() }
})

it.each(['attacked-by-source-or-ally', 'damaged-by-source-or-ally'] as const)('removes %s between native Multiattack occurrences and rolls back invalid later dice', trigger => {
  const actor = creature('actor', 'dm', 20), target = creature('target', 'player', 10)
  actor.statBlockId = 'srd-5.1:owlbear'
  target.currentHp = target.maxHp = 100
  target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'guard', definitionId: 'guard', label: 'Guard', targetId: 'target', source: { kind: 'feature', actorId: 'actor' }, breakOn: [trigger], modifiers: { armorClassBonus: 4 } })]
  const witness = creature('witness', 'player', 5)
  witness.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'witness-guard', definitionId: 'witness-guard', label: 'Witness guard', targetId: witness.id, source: { kind: 'feature', actorId: actor.id }, breakOn: [trigger === 'attacked-by-source-or-ally' ? 'witnesses-ally-attacked' : 'witnesses-ally-damaged'], modifiers: { speedBonusFeet: 1 } })]
  const state = startDnd5eHeadlessCombat('ordered-harm', [actor, target, witness]), before = structuredClone(state)
  const first = trigger === 'attacked-by-source-or-ally' ? { targetId: 'target', d20: 10, damageRolls: [] } : { targetId: 'target', d20: 15, damageRolls: [[3]] }
  const resolve = (damageRolls: number[][]) => resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: 'actor', actionId: 'multiattack', rolls: [first, { targetId: 'target', d20: 10, damageRolls }] })
  const result = resolve([[3, 3]])
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('Expected Multiattack')
  expect(result.events.filter(event => event.type === 'attack-resolved')).toEqual([
    expect.objectContaining({ armorClass: 19, hit: trigger === 'damaged-by-source-or-ally' }),
    expect.objectContaining({ armorClass: 15, hit: true }),
  ])
  const removalIndex = result.events.findIndex(event => event.type === 'active-effect-removed' && event.effectId === 'guard')
  expect(result.state.combatants.witness.classState.activeEffects?.some(effect => effect.id === 'witness-guard') ?? false).toBe(false)
  expect(removalIndex).toBeGreaterThan(result.events.findIndex(event => event.type === 'attack-resolved'))
  expect(removalIndex).toBeLessThan(result.events.findLastIndex(event => event.type === 'attack-resolved'))
  const failed = resolve([[99, 3]])
  expect(failed.ok).toBe(false)
  expect(failed.state.combatants.target.currentHp).toBe(before.combatants.target.currentHp)
  expect(failed.state.combatants.target.classState.activeEffects?.some(effect => effect.id === 'guard')).toBe(true)
  expect(failed.state.combatants.witness.classState.activeEffects?.some(effect => effect.id === 'witness-guard')).toBe(true)
  expect(state).toEqual(before)
})

for (const includeSource of [true, false]) {
const triggers: Dnd5eActiveEffectBreakTrigger[] = includeSource
  ? ['attacked-by-source-or-ally', 'damaged-by-source-or-ally', 'forced-save-by-source-or-ally']
  : ['attacked-by-source-ally', 'damaged-by-source-ally', 'forced-save-by-source-ally']
for (const mode of ['attack', 'damage', 'zero-damage', 'save'] as const) {
  for (const relationship of ['source', 'ally', 'enemy', 'missing'] as const) {
    it(`${mode} ends only the matching preexisting source/ally effect (${relationship}, includeSource=${includeSource}) in both Host routes`, () => {
      const trigger = triggers[mode === 'attack' ? 0 : mode === 'save' ? 2 : 1]!
      const activity: Dnd5eActivityDefinitionV1 = {
        schemaVersion: 1, id: 'harm', name: 'Harm', activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
        consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
        checks: mode === 'attack' ? [{ id: 'roll', rollId: 'roll', kind: 'attack-roll', attackBonus: { kind: 'constant', value: 0 }, scope: 'per-target', rollMode: 'normal', delivery: 'ranged' }] : mode === 'save' ? [{ id: 'roll', rollId: 'roll', kind: 'saving-throw', ability: 'wis', dc: { kind: 'constant', value: 10 }, scope: 'per-target', rollMode: 'normal' }] : [],
        effects: [{ schemaVersion: 1, id: 'fresh', name: 'Fresh', stacking: 'stack', duration: { kind: 'permanent' }, breakOn: [trigger], modifiers: [{ kind: 'speed', mode: 'add', value: { kind: 'constant', value: 1 } }] }],
        outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [
          ...(mode === 'damage' || mode === 'zero-damage' ? [{ id: 'damage', kind: 'damage' as const, target: 'target' as const, amount: { kind: 'constant' as const, value: mode === 'damage' ? 3 : 0 }, damageType: 'force' as const }] : []),
          ...(mode === 'damage' ? [{ id: 'second-damage', kind: 'damage' as const, target: 'target' as const, amount: { kind: 'constant' as const, value: 3 }, damageType: 'force' as const }] : []),
          { id: 'fresh', kind: 'apply-effect', target: 'target', effectId: 'fresh' },
        ] }], automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'harm' },
      }
      expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
      const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
      const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Harm', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
        api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
        api.registerFeature({ id: 'harm', name: 'Harm', description: 'Test', summary: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
      } })
      try {
        const state = startDnd5eHeadlessCombat('break', [creature('actor', 'player', 20), creature('source', relationship === 'enemy' ? 'dm' : 'player', 15), creature('target', 'dm', 10)])
        const sourceId = relationship === 'source' ? 'actor' : relationship === 'missing' ? 'unknown' : 'source'
        state.combatants.actor.pluginFeatureIds = [`${packageId}:harm`]
        state.distanceFeetByCombatantPair = { ['actor\u0000target']: 5 }
        state.combatants.target.classState.activeEffects = triggers.map((kind, i) => createDnd5eMechanicalEffect({ id: `old-${i}`, definitionId: `old-${i}`, label: 'Old', targetId: 'target', source: { kind: 'feature', actorId: sourceId }, breakOn: [kind], modifiers: { speedBonusFeet: 1, ...((kind === 'damaged-by-source-or-ally' || kind === 'damaged-by-source-ally') ? { resistanceToAllDamage: true } : {}) } }))
        expect(validateDnd5eActiveEffectsStrict(state.combatants.target.classState.activeEffects).issues).toEqual([])
        const before = structuredClone(state)
        const rolls: Record<string, { values: number[]; modifier: number; total: number }> = mode === 'damage' || mode === 'zero-damage' ? {} : { 'roll:target': { values: [2], modifier: 0, total: 2 } }
        const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, command: { schemaVersion: 1, commandId: 'harm', actorId: 'actor', packageId, packageVersion: '1.0.0', activityId: 'harm', targetIds: ['target'], expectedRevision: 1 }, authoritativeRolls: rolls, confirmedBy: 'actor' })
        const plugin = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: 'harm', featureId: `${packageId}:harm`, actorId: 'actor', targetId: 'target', distanceFeet: 5, rolls })
        for (const result of [direct.result, plugin]) {
          expect(result.ok, JSON.stringify(result)).toBe(true)
          if (!result.ok) throw Error('Expected settlement')
          const removed = mode !== 'zero-damage' && ((includeSource && relationship === 'source') || relationship === 'ally')
          const effects = result.state.combatants.target.classState.activeEffects ?? []
          expect(effects.some(effect => effect.id === `old-${triggers.indexOf(trigger)}`)).toBe(!removed)
          expect(effects.filter(effect => effect.id.startsWith('old-'))).toHaveLength(removed ? 2 : 3)
          expect(effects.some(effect => effect.definitionId.includes('fresh'))).toBe(true)
          if (mode === 'damage') expect(result.state.combatants.target.currentHp).toBe(removed ? 16 : 18)
          expect(result.events.filter(event => event.type === 'active-effect-removed' && event.reason === trigger)).toHaveLength(removed ? 1 : 0)
          if (mode === 'attack') expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: false }))
        }
        expect(state).toEqual(before)
      } finally { dispose(); registration.dispose() }
    })
  }
}

}
