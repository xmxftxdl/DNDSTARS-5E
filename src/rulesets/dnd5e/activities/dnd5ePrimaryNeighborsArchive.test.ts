import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, type Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey } from '../headlessCombatPrimitives'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const namespace = 'test.primary-neighbors'
const automation = automationCapabilityFromLegacyStatus('full')
const amount = { kind: 'maximum' as const, values: [{ kind: 'constant' as const, value: 1 },
  { kind: 'reference' as const, reference: { kind: 'actor-ability-modifier' as const, ability: 'cha' as const } }] }
const primary: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'primary', name: 'Synthetic primary',
  legacySource: { kind: 'feature', id: 'primary' }, activation: { kind: 'bonus-action' }, automation,
  target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30, requiresLineOfSight: true },
  requirements: [{ kind: 'active-effect', subject: 'target', source: 'self', present: true,
    anyOf: [{ effectId: 'named-curse' }, { tags: ['curse', 'test:class-curse'] }] }],
  consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
  effects: [{ schemaVersion: 1, id: 'window', name: 'Synthetic window', duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-end' },
    tags: ['test:pulse-window'], stacking: 'replace', grants: ['neighbors'], grantsSingleUse: true }],
  outcomes: [{ id: 'primary', when: { kind: 'always' }, operations: [
    { id: 'damage', kind: 'damage', target: 'target', damageType: 'psychic', amount },
    { id: 'grant', kind: 'apply-effect', target: 'actor', effectId: 'window' },
  ] }],
}
const neighbors: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'neighbors', name: 'Synthetic neighbors',
  legacySource: primary.legacySource, activation: { kind: 'free' }, automation, requiresEffectGrant: true,
  invocation: { kind: 'triggered', event: 'feature-used', confirmation: 'automatic', retention: 'single-event',
    effectGrantScope: 'trigger-execution', expireGrantAtWindowEnd: true },
  target: { kind: 'area', origin: 'event-target', shape: 'sphere', relation: 'any', radiusFeet: 5,
    includeSelf: true, excludeEventTarget: true, selection: 'choose-any', requiresLineOfEffect: true },
  requirements: [{ kind: 'event-source', source: 'feature', activityId: 'primary' },
    { kind: 'active-effect', subject: 'actor', source: 'self', present: true, anyOf: [{ tags: ['test:pulse-window'] }] }],
  outcomes: [{ id: 'neighbors', when: { kind: 'always' }, operations: [
    { id: 'damage', kind: 'damage', target: 'target', damageType: 'psychic', amount },
  ] }],
}
function combat(cha = 16) {
  const actors = ['actor', 'primary', 'near', 'unchosen', 'outside', 'blocked'].map((id, i) => createDnd5eCombatant({
    id, name: id, controller: i ? 'dm' : 'player', initiative: 30 - i, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha },
    proficiencyBonus: 3, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 25 + i * 50, y: 25 }, concentrating: false, pluginFeatureIds: i ? [] : [`${namespace}:primary`] }))
  const state = startDnd5eHeadlessCombat('primary-neighbors', actors)
  state.distanceFeetByCombatantPair = Object.fromEntries([
    ['actor', 'primary', 10], ['primary', 'near', 5], ['primary', 'unchosen', 5], ['primary', 'outside', 30], ['primary', 'blocked', 5],
  ].map(([a, b, distance]) => [dnd5eCombatantPairKey(a as string, b as string), distance as number]))
  state.lineOfEffectBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey('primary', 'blocked')]: true }
  state.combatants.primary.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'synthetic-curse', label: 'Synthetic curse',
    targetId: 'primary', source: { kind: 'feature', actorId: 'actor' }, duration: { type: 'permanent' }, tags: ['curse', 'test:class-curse'] })]
  state.combatants.near.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'invisible', targetId: 'near', source: { kind: 'spell' } })]
  state.combatants.near.conditions = ['invisible']
  return state
}
async function install(secondary = neighbors) {
  expect(validateDnd5eActivityDefinitionV1(primary)).toEqual([])
  expect(validateDnd5eActivityDefinitionV1(neighbors)).toEqual([])
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic primary/neighbor module', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'primary', name: 'Synthetic primary',
      automation, activities: [primary, secondary], payload: { id: 'primary', name: 'Synthetic primary', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  return registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
}

it('rejects an unavailable actor resource before asking for a triggered choice', async () => {
  const dispose = await install({ ...neighbors,
    invocation: { ...neighbors.invocation!, confirmation: 'actor-choice' },
    requirements: [...neighbors.requirements!,
      { kind: 'resource', resourceId: 'test:unavailable', minimum: { kind: 'constant', value: 1 } }],
  })
  try {
    const started = run(combat(), 'registered')
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: started.state, events: started.events,
      eventBatchId: 'no-resource', combatRevision: 2,
      confirm: async () => { throw Error('Unavailable resource must not prompt') },
      roll: async () => { throw Error('Unavailable resource must not roll') },
    })
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({ reason: 'requirements-not-met' }))
    expect(settled.state.combatants.near.currentHp).toBe(started.state.combatants.near.currentHp)
  } finally { dispose() }
})
function run(state: Dnd5eHeadlessCombatState, entry: 'registered' | 'compiled', commandId = 'primary-command') {
  if (entry === 'compiled') return resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'primary',
    featureId: `${namespace}:primary`, actorId: 'actor', targetId: 'primary', targetIds: ['primary'], distanceFeet: 10, rolls: {}, payload: {} })
  const result = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, authoritativeRolls: {}, confirmedBy: 'actor',
    command: { schemaVersion: 1, commandId, actorId: 'actor', packageId: namespace, packageVersion: '1.0.0',
      activityId: 'primary', targetIds: ['primary'], expectedRevision: 1 } })
  if (result.phase !== 'commit') throw Error(JSON.stringify(result))
  return result.result
}

it.each(['registered', 'compiled'] as const)('settles an exported primary plus optional neighbors once, across JSON reload: %s', async entry => {
  const dispose = await install()
  try {
    for (const mode of ['selected', 'zero', 'cancel', 'outside', 'duplicate', 'primary-again', 'blocked', 'minimum', 'lethal', 'unconscious'] as const) {
      const state = combat(mode === 'minimum' ? 6 : 16)
      if (mode === 'lethal') state.combatants.primary.currentHp = 2
      if (mode === 'unconscious') {
        state.combatants.near.currentHp = 0
        state.combatants.near.usesDeathSaves = true
        state.combatants.near.conditions = [...state.combatants.near.conditions, 'unconscious']
        state.combatants.near.classState.activeEffects = [...state.combatants.near.classState.activeEffects ?? [],
          createDnd5eConditionEffect({ condition: 'unconscious', targetId: 'near', source: { kind: 'spell' } })]
      }
      const original = structuredClone(state)
      const started = run(state, entry)
      expect(started.ok, JSON.stringify(started)).toBe(true)
      if (!started.ok) continue
      const damage = mode === 'minimum' ? 1 : 3
      expect(started.state.combatants.primary.currentHp).toBe(mode === 'lethal' ? 0 : 20 - damage)
      expect(started.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
      const grant = started.state.combatants.actor.classState.activeEffects!.find(effect => effect.grantedActivities?.includes('neighbors'))!
      expect(grant.source.executionId).toBeTruthy()
      expect(started.events.find(event => event.type === 'activity-resolved')).toMatchObject({ executionId: grant.source.executionId })
      // Persist both the Host state and its committed event; changing delivery batch IDs must not change provenance.
      const restored = JSON.parse(JSON.stringify(started)) as typeof started
      const chosen = mode === 'zero' ? [] : mode === 'cancel' ? undefined : mode === 'outside' ? ['outside'] :
        mode === 'duplicate' ? ['near', 'near'] : mode === 'primary-again' ? ['primary'] : mode === 'blocked' ? ['blocked'] : ['near']
      let prompts = 0
      const settled = await settleDnd5eActivityTriggerWindowsV1({ state: restored.state, events: restored.events,
        eventBatchId: 'delivery-after-reload', combatRevision: 2,
        confirm: async () => { throw Error('Only target selection is needed') }, roll: async () => { throw Error('Fixed damage needs no dice') },
        selectTargets: async ({ candidates }) => { prompts++; expect(candidates.map(c => c.id)).toEqual(['near', 'unchosen']); return chosen },
      })
      expect(prompts, mode).toBe(1)
      const affected = ['selected', 'minimum', 'lethal'].includes(mode)
      expect(settled.state.combatants.near.currentHp, mode).toBe(mode === 'unconscious' ? 0 : affected ? 20 - damage : 20)
      if (mode === 'unconscious') expect(settled.state.combatants.near.deathSaves.failures).toBe(1)
      expect(settled.state.combatants.primary.currentHp).toBe(mode === 'lethal' ? 0 : 20 - damage)
      for (const id of ['unchosen', 'outside', 'blocked']) expect(settled.state.combatants[id].currentHp).toBe(20)
      expect(settled.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
      expect(settled.state.combatants.actor.turn.actionAvailable).toBe(true)
      expect(settled.state.combatants.actor.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('neighbors')) ?? false).toBe(false)
      const replay = await settleDnd5eActivityTriggerWindowsV1({ state: JSON.parse(JSON.stringify(settled.state)), events: restored.events,
        eventBatchId: 'replayed-under-another-id', combatRevision: 3, confirm: async () => { throw Error('Replay') },
        selectTargets: async () => { throw Error('Replay') }, roll: async () => { throw Error('Replay') } })
      expect(replay.state).toEqual(settled.state)
      expect(state).toEqual(original)
    }
  } finally { dispose() }
}, 20_000)

it('rejects old and missing event provenance, preserving an unrelated grant when the matching window closes', async () => {
  const dispose = await install()
  try {
    const started = run(combat(), 'registered')
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const stale = structuredClone(started.state)
    stale.combatants.actor.classState.activeEffects![0].source.executionId = 'new-execution'
    expect(listDnd5eActivityTriggerWindowsV1({ state: stale, events: started.events, eventBatchId: 'stale' })).toEqual([])
    const missing = structuredClone(started.events)
    for (const event of missing) if (event.type === 'activity-resolved') delete event.executionId
    expect(listDnd5eActivityTriggerWindowsV1({ state: started.state, events: missing, eventBatchId: 'missing' })).toEqual([])
    const simultaneous = structuredClone(started.state)
    const grant = simultaneous.combatants.actor.classState.activeEffects![0]
    simultaneous.combatants.actor.classState.activeEffects!.unshift({ ...structuredClone(grant), id: 'other-grant', source: { ...grant.source, executionId: 'other-execution' } })
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: simultaneous, events: started.events, eventBatchId: 'cancel-one',
      combatRevision: 2, confirm: async () => true, roll: async () => [], selectTargets: async () => undefined })
    expect(settled.state.combatants.actor.classState.activeEffects!.filter(effect => effect.grantedActivities?.includes('neighbors')).map(effect => effect.source.executionId)).toEqual(['other-execution'])
  } finally { dispose() }
}, 20_000)

it.each(['spell', 'feature', 'item', 'action'] as const)('expires only matching single-use %s completion grants for actor and targets', async kind => {
  const { registerDnd5eActivityPackage } = await import('./dnd5eActivityRegistry')
  const { expireDnd5eActivityWindowGrants } = await import('../headlessCombatEngine')
  const event = kind === 'spell' ? 'spell-resolved' : kind === 'feature' ? 'feature-used' : kind === 'item' ? 'item-used' : 'action-resolved'
  const followUp: Dnd5eActivityDefinitionV1 = { ...neighbors, invocation: { ...neighbors.invocation!, kind: 'triggered' as const, event,
    confirmation: 'automatic' as const, effectGrantScope: 'trigger-execution' as const, retention: 'single-event' as const, expireGrantAtWindowEnd: true as const } }
  const registration = registerDnd5eActivityPackage({ packageId: namespace, packageVersion: '1.0.0', activities: [followUp] })
  try {
    const state = combat()
    for (const id of ['actor', 'primary']) state.combatants[id].classState.activeEffects = ['matching', 'other', 'ongoing'].map(name => createDnd5eMechanicalEffect({
      id: `${id}-${name}`, definitionId: 'window', label: 'Window', targetId: id, duration: { type: 'permanent' },
      source: { kind: 'feature', actorId: 'actor', pluginId: namespace, executionId: name === 'other' ? 'other' : 'execution' },
      grantedActivities: name === 'ongoing' ? ['neighbors', 'unregistered-ongoing'] : ['neighbors'], grantedActivitiesSingleUse: true,
    }))
    const before = structuredClone(state)
    const events = [{ type: 'activity-resolved' as const, actorId: 'actor', targetIds: ['primary'], sourceKind: kind,
      sourceId: 'primary', activityId: 'primary', executionId: 'execution' }]
    const closed = expireDnd5eActivityWindowGrants(state, events)
    for (const id of ['actor', 'primary']) expect(closed.state.combatants[id].classState.activeEffects!.map(effect => effect.id)).toEqual([`${id}-other`, `${id}-ongoing`])
    expect(state).toEqual(before)
    expect(expireDnd5eActivityWindowGrants(closed.state, events).state).toBe(closed.state)
    expect(expireDnd5eActivityWindowGrants(state, [{ ...events[0], executionId: undefined }]).state).toBe(state)
  } finally { registration.dispose() }
})

it('emits one resolved spell window when a cast and compiled completion share Host provenance', async () => {
  const { dnd5eActivityTriggerContextsFromCombatEventV1: contexts } = await import('./dnd5eActivityTriggerWindows')
  const state = combat()
  const cast = { type: 'spell-cast' as const, actorId: 'actor', targetId: 'primary', spellId: 'test.spell:pulse', slotLevel: 3, executionId: 'execution' }
  const completion = { type: 'activity-resolved' as const, actorId: 'actor', targetIds: ['primary', 'near'], sourceKind: 'spell' as const,
    sourceId: 'test.spell:pulse', activityId: 'pulse', castLevel: 3, executionId: 'execution' }
  const events = [cast, completion]
  const windows = events.flatMap((event, i) => contexts(state, event, i, 'delivery', events))
  expect(windows.map(window => window.event)).toEqual(['spell-cast', 'spell-resolved'])
  expect(windows[1].eligibleTargetIds).toEqual(['primary', 'near'])
  expect(windows.every(window => window.source.executionId === 'execution')).toBe(true)
  for (const unmatched of [{ ...completion, executionId: 'another' }, { ...completion, sourceId: 'other' }, { ...completion, actorId: 'other' }]) {
    expect(contexts(state, cast, 0, 'delivery', [cast, unmatched]).map(window => window.event)).toEqual(['spell-cast', 'spell-resolved'])
  }
  expect(contexts(state, { ...cast, executionId: undefined }, 0, 'legacy').map(window => window.event)).toEqual(['spell-cast', 'spell-resolved'])
})

it.each([true, false])('inherits the proper source level for actor effect alternatives (execution-bound=%s)', async bound => {
  const secondary: Dnd5eActivityDefinitionV1 = { ...neighbors,
    invocation: { kind: 'triggered', event: 'feature-used', confirmation: 'automatic', retention: 'single-event',
      effectGrantScope: bound ? 'trigger-execution' : undefined, expireGrantAtWindowEnd: bound ? true : undefined },
    outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target',
      damageType: 'psychic', amount: { kind: 'reference', reference: { kind: 'cast-level' } } }] }],
  }
  const dispose = await install(secondary)
  try {
    const started = run(combat(), 'registered')
    if (!started.ok) throw Error(JSON.stringify(started))
    const grant = started.state.combatants.actor.classState.activeEffects![0]
    grant.source.spellLevel = 4
    started.state.combatants.actor.classState.activeEffects!.push({ ...structuredClone(grant), id: 'unrelated-high-level',
      suspendedBy: bound ? undefined : ['suppression'], source: { ...grant.source, spellLevel: 9, executionId: 'other-execution' } })
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: started.state, events: started.events,
      eventBatchId: 'source-level', combatRevision: 2, confirm: async () => true, roll: async () => [], selectTargets: async () => ['near'] })
    expect(settled.state.combatants.near.currentHp, JSON.stringify(settled.diagnostics)).toBe(16)
  } finally { dispose() }
}, 30_000)
