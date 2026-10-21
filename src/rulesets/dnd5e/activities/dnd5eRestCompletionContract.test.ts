import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { commitDnd5eActivityExecution, createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { createDnd5eConditionEffect } from '../activeEffects'
import { planDnd5eExpiredRestCompletions } from '../restCompletion'
import { normalizeDnd5eActiveEffects } from '../activeEffects'
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './dnd5eActivityTriggerWindows'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'synthetic-rest', name: 'Synthetic rest', activation: { kind: 'action' },
  target: { kind: 'creature', relation: 'ally', count: 1, rangeFeet: 30, requiresWilling: true },
  consumption: [{ kind: 'spell-slot', minimumLevel: 3, level: 'selected', amount: 1, consumeOn: 'resolve' },
    { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
  effects: [{ schemaVersion: 1, id: 'sleep', name: 'Sleep', stacking: 'replace',
    duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' }, conditions: ['unconscious'],
    breakOn: ['takes-damage', 'awakened'], completionReward: { kind: 'short-rest', requiresCondition: 'unconscious' } }],
  outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'sleep', kind: 'apply-effect', target: 'target', effectId: 'sleep' }] }],
  automation: automationCapabilityFromLegacyStatus('full'),
}

const actor = (id: string, initiative: number) => createDnd5eCombatant({
  id, name: id, initiative, controller: 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
  position: { x: 0, y: 0 }, concentrating: false, classResources: { 'dnd5e-spell-slot-3': { current: 2, max: 2 }, focus: { current: 0, max: 1 } },
  classResourceResets: { focus: 'short-rest', 'dnd5e-spell-slot-3': 'long-rest' },
})

it('round-trips a free self dismissal and ends an action-blocking effect off turn without spending resources', () => {
  const definition: Dnd5eActivityDefinitionV1 = JSON.parse(JSON.stringify({
    ...activity, id: 'self-dismissal', consumption: [],
    effects: [{ schemaVersion: 1, id: 'sleep', name: 'Trance', stacking: 'replace',
      duration: { kind: 'permanent' }, modifiers: [{ kind: 'prevent-actions' }],
      removalAction: { label: 'End trance', economy: 'free', selfOnly: true, maxDistanceFeet: 0 } }],
  }))
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const state = startDnd5eHeadlessCombat('free-dismissal', [actor('caster', 20), actor('target', 10)])
  const resolution = resolveDnd5eActivity({ activity: definition,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster),
    targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.target)],
    rolls: {}, willingTargetIds: ['target'], distanceFeetByTargetId: { target: 5 } })
  const applied = commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: definition.id,
    targetIds: ['target'], resolution, source: { kind: 'spell', id: definition.id, packageId: 'test.dismissal' } })
  expect(applied.ok).toBe(true)
  if (!applied.ok) return
  const target = applied.state.combatants.target
  target.classState.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(target.classState.activeEffects)))
  const effect = target.classState.activeEffects![0]
  expect(effect.removal?.action).toMatchObject({ economy: 'free', selfOnly: true, maxDistanceFeet: 0 })
  target.turn.actionAvailable = false
  const before = structuredClone(applied.state)
  const dismiss = { type: 'remove-active-effect' as const, actorId: 'target', targetId: 'target', effectId: effect.id }
  expect(resolveDnd5eHeadlessAction(applied.state, { ...dismiss, actorId: 'caster' }).ok).toBe(false)
  expect(resolveDnd5eHeadlessAction(applied.state, { ...dismiss, d20: 20 }).ok).toBe(false)
  const ended = resolveDnd5eHeadlessAction(applied.state, dismiss)
  expect(ended.ok, ended.ok ? undefined : ended.reason).toBe(true)
  expect((ended.state.combatants.target.classState.activeEffects ?? []).some(value => value.id === effect.id)).toBe(false)
  expect(ended.state.combatants.target.turn).toEqual(before.combatants.target.turn)
  expect(ended.events.some(event => event.type === 'turn-resource-spent')).toBe(false)
  expect(applied.state).toEqual(before)
  expect(resolveDnd5eHeadlessAction(ended.state, dismiss).ok).toBe(false)
  for (const invalid of [{ selfOnly: undefined }, { maxDistanceFeet: 5 }, { abilityCheck: { ability: 'str', dc: 10 } }]) {
    const malformed = structuredClone(definition)
    Object.assign(malformed.effects![0].removalAction!, invalid)
    expect(validateDnd5eActivityDefinitionV1(malformed)).not.toEqual([])
    const saved = structuredClone(effect)
    Object.assign(saved.removal!.action!, invalid)
    expect(normalizeDnd5eActiveEffects([saved])).toEqual([])
  }
})

it('imports and executes a public rest-denial effect through the registered Headless action', () => {
  const packageId = 'test.rest-denial'
  const definition: Dnd5eActivityDefinitionV1 = JSON.parse(JSON.stringify({
    ...activity, id: 'nightmare-denial',
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    effects: [{ schemaVersion: 1, id: 'sleep', name: 'Denied rest', stacking: 'replace',
      duration: { kind: 'permanent' }, modifiers: [{ kind: 'prevent-rest-benefits' }] }],
    legacySource: { kind: 'feature', id: 'nightmare-denial' },
  }))
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const coverage = dnd5eActivityAutomationAnalysisV1(definition)
  expect(coverage.missingComponents).toEqual([])
  expect(coverage.handledComponents).toContain('effect-modifier:prevent-rest-benefits')
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Rest denial', version: '1.0.0',
    apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({ id: definition.id, name: 'Denied rest', summary: 'Synthetic', description: 'Synthetic',
      automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
  } })
  try {
    const state = startDnd5eHeadlessCombat('imported-denial', [actor('caster', 20), actor('target', 10)])
    state.combatants.caster.pluginFeatureIds = [`${packageId}:${definition.id}`]
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'target')]: 5 }
    const result = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId,
      actionId: definition.id, featureId: `${packageId}:${definition.id}`, actorId: 'caster',
      targetId: 'target', targetIds: ['target'], distanceFeet: 5, rolls: {}, payload: {} })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const saved = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(result.state.combatants.target.classState.activeEffects)))
    expect(saved).toHaveLength(1)
    expect(saved[0].modifiers?.preventRestBenefits).toBe(true)
    expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
    expect(state.combatants.target.classState.activeEffects ?? []).toEqual([])
  } finally { dispose() }
})

it('round-trips public completion configuration through resolution and authoritative expiry, rejecting repeat casts before costs', () => {
  const definition: Dnd5eActivityDefinitionV1 = JSON.parse(JSON.stringify(activity))
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  expect(() => compileDnd5eActivityHeadlessAction(definition, { outerSpellTransaction: true })).not.toThrow()
  let state = startDnd5eHeadlessCombat('public-rest', [actor('caster', 20), actor('target', 10)])
  const resolve = () => resolveDnd5eActivity({ activity: definition,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster),
    targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.target)],
    castLevel: 3, rolls: {}, willingTargetIds: ['target'], distanceFeetByTargetId: { target: 5 },
  })
  const committed = commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: definition.id, castLevel: 3,
    targetIds: ['target'], resolution: resolve(), source: { kind: 'spell', id: definition.id, packageId: 'test.rest' } })
  expect(committed.ok).toBe(true)
  if (!committed.ok) return
  state = committed.state
  expect(state.combatants.caster.classResources['dnd5e-spell-slot-3'].current).toBe(1)
  expect(state.combatants.caster.turn.actionAvailable).toBe(false)
  expect(state.combatants.target.classState.activeEffects?.[0]).toMatchObject({
    completionReward: { kind: 'short-rest' }, completionRequirement: { condition: 'unconscious', interrupted: false },
  })
  for (const actorId of ['caster', 'target']) {
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    state = ended.state
  }
  expect(state.combatants.target.classResources.focus.current).toBe(1)
  const before = structuredClone(state)
  const rejected = commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: definition.id, castLevel: 3,
    targetIds: ['target'], resolution: resolve(), source: { kind: 'spell', id: definition.id, packageId: 'test.rest' } })
  expect(rejected).toMatchObject({ ok: false, reason: 'invalid-target' })
  expect(rejected.state.combatants.caster.classResources).toEqual(before.combatants.caster.classResources)
  expect(rejected.state.combatants.caster.turn).toEqual(before.combatants.caster.turn)
})

it('rejects completion rewards without the declared timed condition', () => {
  for (const overrides of [{ conditions: [] }, { conditions: ['poisoned'] }, { duration: { kind: 'permanent' } },
    { completionReward: { kind: 'long-rest', requiresCondition: 'unconscious' } }]) {
    const malformed = { ...activity, effects: [{ ...activity.effects![0], ...overrides }] } as Dnd5eActivityDefinitionV1
    expect(validateDnd5eActivityDefinitionV1(malformed).some(issue => issue.includes('completionReward'))).toBe(true)
  }
})

it('preflights every compiled plugin target before applying the first effect or spending an action', () => {
  const packageId = 'test.rest.plugin'
  const definition: Dnd5eActivityDefinitionV1 = { ...activity,
    target: { kind: 'creature', relation: 'any', count: 2, rangeFeet: 30, requiresWilling: true },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    legacySource: { kind: 'feature', id: activity.id },
  }
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Rest regression', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({ id: definition.id, name: 'Rest', summary: 'Synthetic', description: 'Synthetic', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
  } })
  try {
    const state = startDnd5eHeadlessCombat('compiled-rest', [actor('caster',20),actor('eligible',15),actor('blocked',10)])
    state.combatants.caster.pluginFeatureIds = [`${packageId}:${definition.id}`]
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster','eligible')]: 5, [dnd5eCombatantPairKey('caster','blocked')]: 5 }
    const effect = createDnd5eConditionEffect({ id: 'completed', condition: 'unconscious', targetId: 'blocked',
      source: { kind: 'plugin', pluginId: packageId, rulesId: `${packageId}:${definition.id}` },
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
      completionRequirement: { condition: 'unconscious', interrupted: false }, completionReward: { kind: 'short-rest' },
    })
    state.combatants.blocked.classState.activeEffects = planDnd5eExpiredRestCompletions({targetId:'blocked',effects:[effect],expiredEffectIds:[effect.id]}).lockouts
    const result=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:packageId,actionId:definition.id,featureId:`${packageId}:${definition.id}`,actorId:'caster',targetId:'eligible',targetIds:['eligible','blocked'],distanceFeet:5,rolls:{},payload:{activityWillingTargetIds:['eligible','blocked']}})
    expect(result).toMatchObject({ok:false,reason:'invalid-target'})
    expect(result.state.combatants.eligible.conditions).not.toContain('unconscious')
    expect(result.state.combatants.caster.turn.actionAvailable).toBe(true)
  } finally { dispose() }
})

it.each(['wake', 'damage'] as const)('reuses the existing %s action to interrupt an imported rest without awarding recovery', mode => {
  let state = startDnd5eHeadlessCombat(`public-rest-${mode}`, [actor('caster', 20), actor('helper', 15), actor('target', 10)])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('helper', 'target')]: 5 }
  const resolution = resolveDnd5eActivity({ activity,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster),
    targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.target)],
    castLevel: 3, rolls: {}, willingTargetIds: ['target'], distanceFeetByTargetId: { target: 5 },
  })
  const cast = commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: activity.id, castLevel: 3,
    targetIds: ['target'], resolution, source: { kind: 'spell', id: activity.id, packageId: 'test.rest' } })
  expect(cast.ok).toBe(true)
  if (!cast.ok) return
  const next = resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: 'caster' })
  expect(next.ok).toBe(true)
  if (!next.ok) return
  const interrupted = resolveDnd5eHeadlessAction(next.state, mode === 'wake'
    ? { type: 'wake-sleeping-creature', actorId: 'helper', targetId: 'target' }
    : { type: 'attack', actorId: 'helper', targetId: 'target', attackModifier: 20,
      d20: 10, d20Second: 15, damage: { count: 1, sides: 4, bonus: 0, rolls: [1, 1], type: 'bludgeoning' } })
  expect(interrupted.ok, interrupted.ok ? undefined : interrupted.reason).toBe(true)
  if (!interrupted.ok) return
  expect(interrupted.state.combatants.helper.turn.actionAvailable).toBe(false)
  expect(interrupted.state.combatants.target.conditions).not.toContain('unconscious')
  expect(interrupted.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', reason: mode === 'wake' ? 'awakened' : 'takes-damage' }))
  {
    const eventIndex = interrupted.events.findIndex(event => event.type === 'sleeping-creature-awakened')
    expect(eventIndex).toBeGreaterThanOrEqual(0)
    const event = interrupted.events[eventIndex]
    const contexts = dnd5eActivityTriggerContextsFromCombatEventV1(interrupted.state,
      JSON.parse(JSON.stringify(event)), eventIndex, 'wake-transaction')
    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toMatchObject({ event: 'creature-awakened',
      eligibleActorIds: ['target'], eligibleTargetIds: ['target'] })
    expect(dnd5eActivityTriggerContextsFromCombatEventV1(interrupted.state, event,
      eventIndex, 'wake-transaction')[0].eventId).toBe(contexts[0].eventId)
  }
  state = interrupted.state
  for (const actorId of ['helper', 'target']) {
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    state = ended.state
  }
  expect(state.combatants.target.classResources.focus.current).toBe(0)
  expect(state.combatants.target.classState.lastGrantedShortRest).toBeUndefined()
  expect(state.combatants.target.classState.activeEffects?.some(effect => effect.definitionId.startsWith('rest-completion:')) ?? false).toBe(false)
})

it.each(['not-sleep', 'still-unconscious', 'zero-hp'] as const)('does not report waking when damage leaves %s', mode => {
  const state = startDnd5eHeadlessCombat(`not-awake-${mode}`, [actor('helper', 20), actor('target', 10)])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('helper', 'target')]: 5 }
  const sleep = createDnd5eConditionEffect({ id: 'sleep', condition: 'unconscious', targetId: 'target',
    source: { kind: 'spell', rulesId: mode === 'not-sleep' ? 'test-knockout' : 'sleep' },
    breakOn: mode === 'not-sleep' ? ['takes-damage'] : ['takes-damage', 'awakened'] })
  state.combatants.target.classState.activeEffects = [sleep]
  state.combatants.target.conditions = ['unconscious']
  if (mode === 'still-unconscious') state.combatants.target.classState.activeEffects.push(
    createDnd5eConditionEffect({ id: 'other-unconscious', condition: 'unconscious', targetId: 'target',
      source: { kind: 'spell', rulesId: 'test-other' } }))
  const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'helper', targetId: 'target',
    attackModifier: 20, d20: 10, d20Second: 15,
    damage: { count: 1, sides: 4, bonus: mode === 'zero-hp' ? 30 : 0, rolls: [1, 1], type: 'bludgeoning' } })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.events.filter(event => event.type === 'sleeping-creature-awakened')).toEqual([])
})

it.each([true, false])('emits one boundary-expiry wake event only for sleep (%s)', isSleep => {
  let state = startDnd5eHeadlessCombat('sleep-expiry', [actor('caster', 20), actor('target', 10)])
  const sleep = createDnd5eConditionEffect({ id: 'timed-unconscious', condition: 'unconscious', targetId: 'target',
    source: { kind: 'spell', rulesId: 'test-duration' },
    breakOn: isSleep ? ['awakened'] : undefined,
    duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' } })
  state.combatants.target.classState.activeEffects = [sleep]
  state.combatants.target.conditions = ['unconscious']
  const wakingEvents = []
  for (const actorId of ['caster', 'target', 'caster', 'target']) {
    const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    wakingEvents.push(...result.events.filter(event => event.type === 'sleeping-creature-awakened'))
    state = result.state
  }
  expect(wakingEvents).toHaveLength(isSleep ? 1 : 0)
  expect(state.combatants.target.conditions).not.toContain('unconscious')
})
