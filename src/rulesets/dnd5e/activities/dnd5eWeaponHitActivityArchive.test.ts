import { resolveDnd5eActionWithDamageReactions } from '../damageReactionFlow'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eHeadlessTurnKey, type Dnd5eAction } from '../headlessCombatEngine'
import { createDnd5eWeaponHitSession } from '../weaponHitSession'
import { resolveDnd5eWeaponHitActivity } from './dnd5eWeaponHitActivity'
import { createDnd5eRegisteredWeaponHitSession } from './dnd5eRegisteredWeaponHitSession'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import { listDnd5eWeaponHitActivities } from './dnd5eWeaponHitDiscovery'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const namespace = 'test.hit-import', resourceId = 'dnd5e-ki'
const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'bonus', name: 'Synthetic optional hit bonus',
  activation: { kind: 'free' }, invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice', retention: 'single-event' },
  target: { kind: 'creature', count: 1, relation: 'enemy' },
  requirements: [{ kind: 'once-per-turn', key: 'import-hit' }, { kind: 'attack-weapon-category', categories: ['simple', 'martial'] },
    { kind: 'turn-owner', owner: 'actor' }, { kind: 'attack-weapon', weaponIds: ['sword'] }],
  consumption: [{ kind: 'resource', resourceId, amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
  outcomes: [{ id: 'bonus', when: { kind: 'always' }, operations: [{ id: 'bonus', kind: 'damage', target: 'target',
    amount: { kind: 'constant', value: 0 }, damageType: 'inherit-primary', critical: 'double-dice',
    weaponDiceFromTrigger: { rollId: 'extra', count: 1 } }] }],
  automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'bonus' },
}

const scenarios = ([false, true]).flatMap(critical => [
  ...(['weapon', 'formula', 'constant', 'radiant', 'magical', 'faces'] as const).map(mode => ({ critical, mode, automatic: false })),
  ...(['weapon', 'constant', 'faces'] as const).map(mode => ({ critical, mode, automatic: true })),
])
it.each(scenarios)('exports, installs and authorizes hit damage (%j)', async ({critical, mode, automatic}) => {
  const definition = structuredClone(activity)
  if (definition.invocation?.kind === 'triggered' && automatic) definition.invocation.confirmation = 'automatic'
  const operation = definition.outcomes[0].operations[0]
  if (operation.kind !== 'damage') throw Error('expected damage')
  if (mode !== 'weapon') {
    delete operation.weaponDiceFromTrigger
    const halfLevel = { kind: 'floor' as const, value: { kind: 'multiply' as const, values: [
      { kind: 'reference' as const, reference: { kind: 'actor-class-level' as const, classId: 'fighter' } },
      { kind: 'constant' as const, value: 0.5 },
    ] } }
    operation.amount = mode === 'constant' ? halfLevel : { kind: 'add', values: [
      { kind: 'dice', rollId: 'extra', count: 1, sides: 4 },
      ...(mode === 'formula' ? [{ kind: 'dice' as const, rollId: 'other', count: 1, sides: 8 }] : []), halfLevel,
    ] }
  }
  if (mode === 'radiant') operation.damageType = 'radiant'
  if (mode === 'magical') operation.magical = true
  if (mode === 'faces') definition.scaling = [{ basis: 'custom-table', classId: 'fighter',
    table: [{ level: 3, value: 0 }, { level: 5, value: 1 }, { level: 11, value: 2 }],
    adjustments: [{ operationId: 'bonus', diceSidesPerStep: 2 }] }]
  const factor = critical ? 2 : 1
  const bonus = mode === 'weapon' ? 3 * factor : mode === 'formula' ? 6 * factor + 2 : mode === 'constant' ? 2 : 3 * factor + 2
  const expectedHp = 20 - (mode === 'radiant' || mode === 'magical'
    ? Math.floor(3 * factor / 2) + bonus * (mode === 'radiant' ? 2 : 1)
    : Math.floor((3 * factor + bonus) / 2))

  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic hit', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'bonus', name: 'Bonus',
      automation: activity.automation, activities: [definition], payload: { id: 'bonus', name: 'Bonus', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const make = (id: string) => createDnd5eCombatant({ id, name: id, initiative: id === 'actor' ? 20 : 10,
      controller: id === 'actor' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
      concentrating: false, position: { x: 0, y: 0 }, classResources: { [resourceId]: { current: 1, max: 1 } } })
    const actor = make('actor'), target = make('target')
    actor.classLevels = { fighter: 5 }
    actor.pluginFeatureIds = [`${namespace}:bonus`]
    target.damageResistances = mode === 'magical' ? [] : ['slashing']
    if (mode === 'magical') target.damageDefenseRules = [{ outcome: 'resistant', damageTypes: ['slashing'], magical: false }]
    if (mode === 'radiant') target.damageVulnerabilities = ['radiant']
    const state = startDnd5eHeadlessCombat('import-hit', [actor, target])
    const original = structuredClone(state)
    const action: Dnd5eAction = { type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 5,
      d20: critical ? 20 : 18, damage: { count: 1, sides: 6, bonus: 0, rolls: critical ? [3, 3] : [3], type: 'slashing' },
      classDamageContext: { mode: 'melee', weaponId: 'sword', weaponCategory: 'martial', weaponDamageSides: 6,
        finesse: false, strengthBased: true, damageType: 'slashing', adjacentEnemyOfTarget: false } }
    const session = createDnd5eWeaponHitSession(state, action, () => true)
    const pending = session.run(state)
    if (pending.status !== 'pending') throw Error('expected hit')
    const input = { state: pending.snapshot, event: pending.event, eventBatchId: 'import-hit', combatRevision: 1,
      packageId: namespace, packageVersion: '1.0.0', activityId: 'bonus',
      authoritativeRolls: Object.fromEntries((mode === 'constant' ? [] : mode === 'formula' ? ['extra', 'other'] : ['extra']).map(id => [id, { values: critical ? [3, 3] : [3] }])) }
    const snapshotBeforeDiscovery = structuredClone(pending.snapshot)
    const offers = listDnd5eWeaponHitActivities(input)
    expect(offers).toHaveLength(1)
    expect(offers[0].rolls).toEqual(mode === 'constant' ? [] : mode === 'formula'
      ? [{ id: 'extra', count: factor, sides: 4 }, { id: 'other', count: factor, sides: 8 }]
      : [{ id: 'extra', count: factor, sides: mode === 'weapon' || mode === 'faces' ? 6 : 4 }])
    expect(pending.snapshot).toEqual(snapshotBeforeDiscovery)
    for (const boundary of ['other-turn', 'ended-combat', 'wrong-weapon', 'missing-weapon'] as const) {
      const changedState = structuredClone(pending.snapshot), changedEvent = structuredClone(pending.event)
      if (boundary === 'other-turn') changedState.initiativeIndex = 1
      if (boundary === 'ended-combat') changedState.active = false
      if (boundary === 'wrong-weapon') changedEvent.weaponId = 'bow'
      if (boundary === 'missing-weapon') delete changedEvent.weaponId
      const guarded = { ...input, state: changedState, event: changedEvent }
      expect(listDnd5eWeaponHitActivities(guarded), boundary).toEqual([])
      expect(resolveDnd5eWeaponHitActivity(guarded).ok, boundary).toBe(false)
      expect(changedState.combatants.actor.classResources[resourceId].current).toBe(1)
      expect(changedState.combatants.target.currentHp).toBe(20)
    }
    const exhausted = structuredClone(pending.snapshot); exhausted.combatants.actor.classResources[resourceId].current = 0
    expect(listDnd5eWeaponHitActivities({ ...input, state: exhausted })).toEqual([])
    expect(resolveDnd5eWeaponHitActivity({ ...input, state: exhausted })).toMatchObject({ ok: false, reason: 'weapon-hit-resource-unavailable' })
    expect(listDnd5eWeaponHitActivities({ ...input, event: { ...pending.event, hit: false } })).toEqual([])
    // Spell hits are supported by the shared adapter, but cannot satisfy this weapon-only Activity's trigger.
    expect(resolveDnd5eWeaponHitActivity({ ...input, event: { ...pending.event, attackCategory: 'spell' } })).toMatchObject({ ok: false, reason: 'trigger-mismatch' })
    expect(listDnd5eWeaponHitActivities({ ...input, event: { ...pending.event, attackCategory: 'spell' } })).toEqual([])
    expect(resolveDnd5eWeaponHitActivity({ ...input, packageVersion: '2.0.0' })).toMatchObject({ ok: false, reason: 'content-version-mismatch' })
    expect(resolveDnd5eWeaponHitActivity({ ...input, expectedDefinitionSignature: 'stale' })).toMatchObject({ ok: false, reason: 'weapon-hit-activity-changed' })
    const unowned = structuredClone(pending.snapshot); unowned.combatants.actor.pluginFeatureIds = []
    expect(resolveDnd5eWeaponHitActivity({ ...input, state: unowned })).toMatchObject({ ok: false, reason: 'weapon-hit-activity-not-owned' })
    expect(resolveDnd5eWeaponHitActivity({ ...input, authoritativeRolls: { extra: { values: [7] } } })).toMatchObject({ ok: false })
    expect(resolveDnd5eWeaponHitActivity({ ...input, authoritativeRolls: { ...input.authoritativeRolls, injected: { values: [6] } } })).toMatchObject({ ok: false, reason: 'invalid-rolls' })
    const used = structuredClone(pending.snapshot)
    used.combatants.actor.classState.declarativeUsedTurnKeys = { 'import-hit': dnd5eHeadlessTurnKey(used, 'actor') }
    expect(resolveDnd5eWeaponHitActivity({ ...input, state: used })).toMatchObject({ ok: false, reason: 'requirement-failed' })
    expect(listDnd5eWeaponHitActivities({ ...input, state: used })).toEqual([])
    const selected = resolveDnd5eWeaponHitActivity(input)
    expect(selected.ok, JSON.stringify(selected)).toBe(true)
    if (!selected.ok) throw Error(selected.reason)
    expect(selected.decision.usageKeys).toEqual(['import-hit'])
    expect(selected.decision.resourceCosts).toEqual([{ resourceId, amount: 1 }])
    const resolved = session.resume(state, pending.event, pending.index, selected.decision)
    if (resolved.status !== 'resolved') throw Error('expected commit')
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants.target.currentHp).toBe(expectedHp)
    expect(resolved.result.state.combatants.actor.classResources[resourceId].current).toBe(0)
    expect(resolved.result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
    expect(state).toEqual(original)
    for (const accepted of automatic ? [true] : [false, true]) {
      const wrapped = createDnd5eRegisteredWeaponHitSession({ state, action, combatRevision: 1,
        packageId: namespace, packageVersion: '1.0.0', activityId: 'bonus', eventBatchId: 'wrapped-hit' })
      const offer = wrapped.run(state)
      if (offer.status !== 'pending') throw Error('expected pending offer')
      offer.snapshot.combatants.target.currentHp = 1
      offer.event.weaponDamageDice!.sides = 20
      const finished = wrapped.resume(state, accepted, input.authoritativeRolls)
      if (finished.status !== 'resolved' || !finished.result.ok) throw Error(JSON.stringify(finished))
      expect(finished.result.state.combatants.target.currentHp).toBe(accepted ? expectedHp : critical ? 17 : 19)
      expect(finished.result.state.combatants.actor.classResources[resourceId].current).toBe(accepted ? 0 : 1)
      expect(finished.result.state.combatants.actor.classState.declarativeUsedTurnKeys?.['import-hit'])
        .toBe(accepted ? dnd5eHeadlessTurnKey(state, 'actor') : undefined)
      const serialized = JSON.parse(JSON.stringify(finished.result))
      const windows = listDnd5eActivityTriggerWindowsV1({ state: serialized.state, events: serialized.events, eventBatchId: 'after-commit' })
      expect(windows.flatMap(window => window.available).some(entry => entry.packageId === namespace && entry.activity.id === 'bonus')).toBe(false)
      expect(listDnd5eWeaponHitActivities({ state: serialized.state,
        event: serialized.events.find((event: { type: string }) => event.type === 'attack-resolved'), eventBatchId: 'after-commit', combatRevision: 2 })).toEqual([])
      expect(wrapped.resume(state, accepted, input.authoritativeRolls)).toMatchObject({ status: 'rejected' })
    }
    const prompts: string[] = [], diceRequests: { count: number; sides: number }[] = []
    const driven = await resolveDnd5eActionWithDamageReactions({ state, action, combatRevision: 1,
      authorityUnchanged: () => true, confirm: async request => { prompts.push(request.activity.id); return { accepted: true } },
      roll: async request => { diceRequests.push({ count: request.count, sides: request.sides }); return Array(request.count).fill(3) },
    })
    expect(driven.ok).toBe(true)
    expect(prompts).toEqual(automatic ? [] : ['bonus'])
    expect(diceRequests).toEqual(offers[0].rolls.map(({count, sides}) => ({count, sides})))
    expect(driven.state.combatants.target.currentHp).toBe(expectedHp)
    expect(driven.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
    if (mode === 'radiant') expect(driven.events).toContainEqual(expect.objectContaining({ type: 'damage-applied', damageTypes: expect.arrayContaining(['slashing', 'radiant']) }))
    expect(driven.state.combatants.actor.classResources[resourceId].current).toBe(0)
    expect(state).toEqual(original)
    const changed = createDnd5eRegisteredWeaponHitSession({ state, action, combatRevision: 1,
      packageId: namespace, packageVersion: '1.0.0', activityId: 'bonus', eventBatchId: 'changed-hit' })
    expect(changed.run(state).status).toBe('pending')
    dispose()
    expect(changed.resume(state, true, input.authoritativeRolls)).toEqual({ status: 'rejected', reason: 'changed-definition' })
  } finally { dispose() }
}, 20000)
