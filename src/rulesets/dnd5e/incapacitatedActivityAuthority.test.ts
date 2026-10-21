import './activeEffects'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, commitDnd5eActivityExecution, applyDnd5eStandardConditionEffect, type Dnd5eCombatEvent } from './headlessCombatEngine'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { listDnd5eActivityTriggerWindowsV1, dnd5eActivityTriggerContextsFromCombatEventV1 } from './activities/dnd5eActivityTriggerWindows'
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

const packageId = 'test.zero-trigger'
function definition(): Dnd5eActivityDefinitionV1 {
  return { schemaVersion: 1, id: 'protectors', name: 'Synthetic protectors', activation: { kind: 'free' },
    usableWhileIncapacitated: true, target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'protectors' },
    invocation: { kind: 'triggered', event: 'self-dropped-to-zero', confirmation: 'actor-choice', retention: 'single-event' },
    consumption: [{ kind: 'resource', resourceId: 'protectors-uses', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
    outcomes: [{ id: 'protectors', when: { kind: 'always' }, operations: [{ id: 'summon', kind: 'summon',
      monsterId: 'srd-5.1:wolf', count: { kind: 'constant', value: 4 }, timing: 'immediate', durationRounds: 600,
      concentration: false, side: 'ally', autonomousBehavior: 'protect-source', commandPolicy: 'persistent-order' }] }],
    automation: automationCapabilityFromLegacyStatus('full') }
}
it.each(['accepted', 'declined', 'placement-failed'] as const)('only a confirmed Host self-drop event can summon while at zero HP (%s)', async mode => {
  const accepted = mode !== 'declined'
  const activity = definition(), registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
  try {
    const actor = createDnd5eCombatant({ id: 'owner', name: 'Owner', controller: 'player', initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 },
      concentrating: false, usesDeathSaves: true, pluginFeatureIds: [packageId + ':protectors'],
      classResources: { 'protectors-uses': { current: 1, max: 1 } } })
    const enemy = createDnd5eCombatant({ ...actor, id: 'enemy', controller: 'dm', initiative: 20, pluginFeatureIds: [] })
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'grant', definitionId: 'grant', label: 'Grant',
      targetId: actor.id, source: { kind: 'feature', pluginId: packageId }, duration: { type: 'permanent' }, grantedActivities: [activity.id] })]
    const state = startDnd5eHeadlessCombat('zero', [actor, enemy])
    const hit = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'enemy', targetId: 'owner', attackModifier: 20,
      d20: 15, damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'bludgeoning' } })
    expect(hit.ok).toBe(true)
    expect(hit.state.combatants.owner.currentHp).toBe(0)
    const windows = listDnd5eActivityTriggerWindowsV1({ state: hit.state, events: hit.events, eventBatchId: 'drop' })
    const window = windows.find(w => w.triggerContext.event === 'self-dropped-to-zero')!
    expect(window?.triggerContext.eligibleActorIds).toEqual(['owner'])
    expect(windows.filter(w => w.triggerContext.event === 'self-dropped-to-zero')).toHaveLength(1)
    const damage = hit.events.find(e => e.type === 'damage-applied')!
    if (damage.type !== 'damage-applied') throw Error('Missing damage transition')
    for (const transition of [{ ...damage, hpBefore: 0 }, { ...damage, hpAfter: 1 }]) {
      expect(dnd5eActivityTriggerContextsFromCombatEventV1(hit.state, transition, 0, 'non-drop', [transition])
        .some(c => c.event === 'self-dropped-to-zero')).toBe(false)
    }
    for (const hpBefore of [0, 10]) {
      const reduction = { type: 'hit-points-reduced-to-zero' as const, sourceId: 'enemy', targetId: 'owner', hpBefore }
      expect(dnd5eActivityTriggerContextsFromCombatEventV1(hit.state, reduction, 0, 'reduction', [reduction])
        .some(c => c.event === 'self-dropped-to-zero')).toBe(hpBefore > 0)
    }
    const direct = () => resolveRegisteredDnd5eActivityInCombatV1({ state: hit.state, combatRevision: 1,
      command: { schemaVersion: 1, commandId: 'direct', actorId: 'owner', packageId, packageVersion: '1.0.0',
        activityId: activity.id, targetIds: ['owner'], expectedRevision: 1, triggerEventId: window.triggerContext.eventId },
      triggerContext: window.triggerContext, authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(direct().result.ok).toBe(false)
    let handoffs = 0
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: hit.state, events: hit.events, eventBatchId: 'drop', combatRevision: 1,
      confirm: async () => accepted, roll: async () => [], settleMapHandoffs: async request => {
        handoffs++
        expect(request.committed.activityHandoffs?.summons).toEqual([expect.objectContaining({
          monsterId: 'srd-5.1:wolf', count: 4, durationRounds: 600, concentration: false,
          autonomousBehavior: 'protect-source', commandPolicy: 'persistent-order',
        })])
        return mode === 'placement-failed' ? { ok: false, reason: 'placement-cancelled' } : { ok: true }
      } })
    expect(settled.diagnostics, JSON.stringify(settled.diagnostics)).toContainEqual(expect.objectContaining({ activityId: activity.id, status: mode === 'placement-failed' ? 'unsupported' : accepted ? 'resolved' : 'declined' }))
    expect(handoffs).toBe(accepted ? 1 : 0)
    expect(settled.state.combatants.owner.classResources['protectors-uses'].current).toBe(mode === 'accepted' ? 0 : 1)
    expect(settled.state.combatants.owner.currentHp).toBe(0)
    expect(direct().result.ok).toBe(false)
    if (mode === 'placement-failed') {
      const retry = await settleDnd5eActivityTriggerWindowsV1({ state: settled.state, events: hit.events,
        eventBatchId: 'drop', combatRevision: 2, confirm: async () => true, roll: async () => [],
        settleMapHandoffs: async () => { handoffs++; return { ok: true } } })
      expect(retry.diagnostics).toContainEqual(expect.objectContaining({ activityId: activity.id, status: 'resolved' }))
      expect(handoffs).toBe(2)
      expect(retry.state.combatants.owner.classResources['protectors-uses'].current).toBe(0)
      return
    }
    const replay = await settleDnd5eActivityTriggerWindowsV1({ state: settled.state, events: hit.events, eventBatchId: 'drop', combatRevision: 2,
      confirm: async () => true, roll: async () => [], settleMapHandoffs: async () => { throw Error('replayed handoff') } })
    expect(replay.diagnostics.some(d => d.status === 'resolved')).toBe(false)
  } finally { registration.dispose() }
})

it('rejects broad incapacitation permissions on ordinary actions or other events', () => {
  expect(validateDnd5eActivityDefinitionV1(definition())).toEqual([])
  for (const activity of [{ ...definition(), activation: { kind: 'action' as const } },
    { ...definition(), invocation: { kind: 'triggered' as const, event: 'turn-start' as const, confirmation: 'actor-choice' as const, retention: 'single-event' as const } }]) {
    expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('usableWhileIncapacitated'))).toBe(true)
  }
})


it.each([true, false, undefined])('only an explicit involuntary incapacitation transition triggers: %s', async involuntary => {
  const activity = definition()
  activity.invocation = { kind: 'triggered', event: 'self-involuntarily-incapacitated', confirmation: 'actor-choice', retention: 'single-event' }
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
  try {
    const actor = createDnd5eCombatant({ id: 'owner', name: 'Owner', controller: 'player', initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 },
      concentrating: false, usesDeathSaves: true, pluginFeatureIds: [packageId + ':protectors'],
      classResources: { 'protectors-uses': { current: 1, max: 1 } } })
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'grant', definitionId: 'grant', label: 'Grant',
      targetId: actor.id, source: { kind: 'feature', pluginId: packageId }, duration: { type: 'permanent' }, grantedActivities: [activity.id] })]
    const enemy = createDnd5eCombatant({ ...actor, id: 'enemy', controller: 'dm', initiative: 20, pluginFeatureIds: [] })
    const state = startDnd5eHeadlessCombat('incap', [actor, enemy])
    const immune = structuredClone(state.combatants.owner)
    immune.conditionImmunities = ['paralyzed']
    const immuneEvents: Dnd5eCombatEvent[] = []
    expect(applyDnd5eStandardConditionEffect(immune, state.combatants.enemy,
      { rulesId: 'immune', condition: 'paralyzed', duration: { type: 'permanent' }, involuntary: true }, immuneEvents)).toBe(false)
    expect(immuneEvents.some(event => event.type === 'condition-applied')).toBe(false)
    const apply = (condition: 'paralyzed' | 'stunned') => {
      const events: Dnd5eCombatEvent[] = []
      applyDnd5eStandardConditionEffect(state.combatants.owner, state.combatants.enemy,
        { rulesId: 'test-incap', condition, duration: { type: 'permanent' }, involuntary }, events)
      return events
    }
    const events = apply('paralyzed')
    const windows = listDnd5eActivityTriggerWindowsV1({ state, events, eventBatchId: 'incap' })
    expect(windows.filter(w => w.triggerContext.event === 'self-involuntarily-incapacitated')).toHaveLength(involuntary === true ? 1 : 0)
    const repeated = apply('stunned')
    expect(listDnd5eActivityTriggerWindowsV1({ state, events: repeated, eventBatchId: 'repeat' })
      .some(w => w.triggerContext.event === 'self-involuntarily-incapacitated')).toBe(false)
    let handoffs = 0
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state, events, eventBatchId: 'incap', combatRevision: 1,
      confirm: async () => true, roll: async () => [], settleMapHandoffs: async () => { handoffs++; return { ok: true } } })
    expect(handoffs).toBe(involuntary === true ? 1 : 0)
    expect(settled.state.combatants.owner.currentHp).toBe(10)
    expect(settled.state.combatants.owner.classResources['protectors-uses'].current).toBe(involuntary === true ? 0 : 1)
  } finally { registration.dispose() }
})


it.each(['apply-standard-condition', 'apply-effect'] as const)('derives consent per target from a failed save for %s', kind => {
  const actor = createDnd5eCombatant({ id: 'caster', name: 'Caster', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const targets = ['failed', 'willing', 'passed'].map(id => createDnd5eCombatant({ ...actor, id, controller: 'dm', initiative: 10 }))
  const state = startDnd5eHeadlessCombat('save-consent', [actor, ...targets])
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'paralysis', name: 'Synthetic paralysis',
    activation: { kind: 'free' }, target: { kind: 'creature', relation: 'any', count: 3, rangeFeet: 30 },
    checks: [{ id: 'save', rollId: 'save', kind: 'saving-throw', ability: 'wis', dc: { kind: 'constant', value: 15 }, scope: 'per-target', allowWillingFailure: true }],
    effects: [{ schemaVersion: 1, id: 'paralysis', name: 'Paralysis', stacking: 'replace', conditions: ['paralyzed'], duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' } }],
    outcomes: [{ id: 'fail', when: { kind: 'check', checkId: 'save', result: 'failure' }, operations: [kind === 'apply-effect'
      ? { id: 'condition', kind, target: 'target', effectId: 'paralysis' }
      : { id: 'condition', kind, target: 'target', condition: 'paralyzed', duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' } }] }],
    automation: automationCapabilityFromLegacyStatus('full') }
  const result = resolveDnd5eActivity({ activity, actor: dnd5eActivityActorSnapshotFromCombatantV1(actor, actor, state),
    targets: targets.map(target => dnd5eActivityActorSnapshotFromCombatantV1(target, actor, state)),
    distanceFeetByTargetId: { failed: 5, willing: 5, passed: 5 }, willingTargetIds: ['willing'], rolls: { 'save:failed': { values: [1] }, 'save:passed': { values: [20] } } })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) return
  const conditions = result.proposals.filter(p => p.kind === kind)
  expect(conditions).toEqual(expect.arrayContaining([
    expect.objectContaining({ targetId: 'failed', involuntary: true }),
    expect.objectContaining({ targetId: 'willing' }),
  ]))
  expect(conditions).toHaveLength(2)
  expect(conditions.find(p => 'targetId' in p && p.targetId === 'willing')).not.toHaveProperty('involuntary')
  const committed = commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: activity.id,
    targetIds: targets.map(target => target.id), resolution: result })
  expect(committed.ok, JSON.stringify(committed)).toBe(true)
  const triggers = committed.events.flatMap((event, index) =>
    dnd5eActivityTriggerContextsFromCombatEventV1(committed.state, event, index, 'save-commit', committed.events))
    .filter(context => context.event === 'self-involuntarily-incapacitated')
  expect(triggers.map(context => context.eligibleActorIds)).toEqual([['failed']])
})
