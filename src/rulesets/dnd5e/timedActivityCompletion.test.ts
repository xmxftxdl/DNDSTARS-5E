import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { settleDnd5eCampaignPreparationCompletion, createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { planDnd5eTimedActivityCompletions } from './timedActivityCompletion'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

const packageId = 'test.timed-completion'
const timer = () => createDnd5eMechanicalEffect({ id: 'timer', definitionId: 'timer', label: 'Preparation', targetId: 'actor',
  source: { kind: 'feature', actorId: 'actor', pluginId: packageId }, duration: { type: 'rounds', remainingRounds: 2, tickOn: 'target-turn-end' },
  completionGrant: { activityIds: ['finish'], availableRounds: 10 }, modifiers: { speedBonusFeet: 1 } })

it('normalizes the delayed grant and rejects malformed persisted authority', () => {
  const effect = timer()
  expect(normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))[0].completionGrant).toEqual(effect.completionGrant)
  for (const grant of [{ activityIds: [], availableRounds: 1 }, { activityIds: ['finish'], availableRounds: 0 }, { activityIds: ['bad id'], availableRounds: 1 }, { activityIds: ['finish'], availableRounds: 1, recipient: 'stranger' }, { activityIds: ['finish'], availableRounds: 1, bindTarget: 'stranger' }, { activityIds: ['finish'], availableRounds: 1, singleUse: false }]) {
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, completionGrant: grant }]).issues.length).toBeGreaterThan(0)
  }
})

it('plans only natural, unsuspended expiry from a present source and deduplicates existing receipts', () => {
  const effect = timer()
  const input = { targetId: 'actor', effects: [effect], expiredEffectIds: ['timer'], liveSourceIds: new Set(['actor']), appliedTurnKey: 'turn' }
  expect(planDnd5eTimedActivityCompletions({ ...input, expiredEffectIds: [] })).toEqual([])
  expect(planDnd5eTimedActivityCompletions({ ...input, liveSourceIds: new Set() })).toEqual([])
  expect(planDnd5eTimedActivityCompletions({ ...input, effects: [{ ...effect, suspendedBy: ['blocked'] }] })).toEqual([])
  const grants = planDnd5eTimedActivityCompletions(input)
  expect(grants).toHaveLength(1)
  expect(planDnd5eTimedActivityCompletions({ ...input, effects: [effect, ...grants.map(grant => grant.effect)] })).toEqual([])
})

it('keeps a minimum-duration activity available until use with its interruption rules intact', () => {
  const effect = timer()
  effect.completionGrant = { activityIds: ['finish'], availableRounds: 1, singleUse: true, continueUntilUsed: true }
  effect.removal = { sourceLink: { sourceMustNotBeIncapacitated: true } }
  effect.breakOn = ['takes-damage']
  const restored = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
  expect(restored[0].completionGrant?.continueUntilUsed).toBe(true)
  const grants = planDnd5eTimedActivityCompletions({ targetId: 'actor', effects: restored,
    expiredEffectIds: ['timer'], liveSourceIds: new Set(['actor']), appliedTurnKey: 'turn' })
  expect(grants).toHaveLength(1)
  expect(grants[0].effect.duration).toEqual({ type: 'permanent' })
  expect(grants[0].effect.removal).toEqual(effect.removal)
  expect(grants[0].effect.breakOn).toEqual(['takes-damage'])
  expect(grants[0].effect.grantedActivitiesSingleUse).toBe(true)
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
    currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  actor.classState.activeEffects=restored
  const state=startDnd5eHeadlessCombat('noncombat-completion',[actor]);state.active=false
  const completed=settleDnd5eCampaignPreparationCompletion({state,bearerId:'actor',effectId:'timer',interactionId:'perform',overshootRounds:5})
  expect(completed.state.combatants.actor.classState.activeEffects?.find(e=>e.id==='timer:completed')?.duration).toEqual({type:'permanent'})
  expect(completed.state.combatants.actor.classState.activeEffects?.some(e=>e.id==='timer')).toBe(false)
  expect(completed.events).toContainEqual(expect.objectContaining({type:'active-effect-applied',effectId:'timer:completed'}))
  for (const invalid of [{...effect.completionGrant,singleUse:undefined}, {...effect.completionGrant,recipient:'source'}, {...effect.completionGrant,continueUntilUsed:false}]) {
    expect(validateDnd5eActiveEffectsStrict([{...effect,completionGrant:invalid}]).issues.length).toBeGreaterThan(0)
  }
})

it.each(['complete', 'removed', 'suppressed'] as const)('uses actual turn boundaries before granting a consumable completion Activity (%s)', mode => {
  const finish: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'finish', name: 'Finish', activation: { kind: 'free' }, target: { kind: 'self' },
    requirements: [{ kind: 'active-effect', subject: 'actor', effectId: 'timer:completed', present: true, source: 'self' }],
    outcomes: [{ id: 'finish', when: { kind: 'always' }, operations: [
      { id: 'consume', kind: 'remove-effect', target: 'actor', effectId: 'timer:completed', source: 'self' },
      { id: 'benefit', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 3 } },
    ] }], automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'finish' },
  }
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [finish] })
  try {
    const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 15, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    actor.classState.activeEffects = [timer()]
    const other = createDnd5eCombatant({ ...actor, id: 'other', name: 'Other', initiative: 10, classState: undefined })
    let state = startDnd5eHeadlessCombat('timer', [actor, other])
    const use = () => resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {}, command: { schemaVersion: 1, commandId: 'use', actorId: 'actor', packageId, packageVersion: '1.0.0', activityId: 'finish', targetIds: ['actor'], expectedRevision: 1 } })
    expect(use().result.ok).toBe(false)
    const advance = () => {
      const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'actor' })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      state = JSON.parse(JSON.stringify(result.state))
      const otherTurn = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'other' })
      expect(otherTurn.ok, JSON.stringify(otherTurn)).toBe(true)
      state = JSON.parse(JSON.stringify(otherTurn.state))
    }
    advance()
    expect(use().result.ok).toBe(false)
    if (mode === 'removed') state.combatants.actor.classState.activeEffects = []
    if (mode === 'suppressed') state.combatants.actor.classState.activeEffects![0].suspendedBy = ['blocked']
    advance()
    const completed = use()
    expect(completed.result.ok, JSON.stringify(completed)).toBe(mode === 'complete')
    if (completed.phase === 'commit' && completed.result.ok) {
      state = completed.result.state
      expect(state.combatants.actor.temporaryHp).toBe(3)
      expect(use().result.ok).toBe(false)
    }
    advance()
    expect(use().result.ok).toBe(false)
  } finally { registration.dispose() }
})


it.each((['direct', 'plugin'] as const).flatMap(route => ['marker', 'condition', 'modifier', 'compound'].map(shape => ({ route, shape }))))('imports a delayed grant through actual Activity settlement (%j)', async ({ route, shape }) => {
  const { validateDnd5eActivityDefinitionV1 } = await import('./activities/dnd5eActivityValidation')
  const { registerDnd5eRulesPlugin } = await import('./pluginApi')
  const { compileDnd5eActivityHeadlessAction } = await import('./activities/dnd5eActivityHeadlessCompiler')
  const { dnd5ePluginFeatureActionFromActivityV1 } = await import('./activities/dnd5eActivityFeatureActionAdapter')
  const prepare: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'prepare', name: 'Prepare', activation: { kind: 'free' }, target: { kind: 'self' },
    effects: [{ schemaVersion: 1, id: 'preparation', name: 'Preparation', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 2, expiresAt: 'target-turn-end' },
      completionGrant: { activityIds: ['finish'], availableRounds: 1, recipient: 'source', bindTarget: 'source' },
      conditions: shape === 'condition' || shape === 'compound' ? ['prone'] : undefined,
      modifiers: shape === 'modifier' || shape === 'compound' ? [{ kind: 'speed', mode: 'add', value: { kind: 'constant', value: 1 } }] : undefined }],
    outcomes: [{ id: 'prepare', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'preparation' }] }],
    automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'prepare' },
  }
  const finish: Dnd5eActivityDefinitionV1 = { ...prepare, id: 'finish', name: 'Finish', effects: [], legacySource: { kind: 'feature', id: 'finish' },
    outcomes: [{ id: 'finish', when: { kind: 'always' }, operations: [{ id: 'benefit', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 3 } }] }] }
  expect(validateDnd5eActivityDefinitionV1(prepare)).toEqual([])
  for (const completionGrant of [[], { activityIds: ['finish'], availableRounds: 0 }, { activityIds: ['finish', 'finish'], availableRounds: 1 }, { activityIds: ['finish'], availableRounds: 1, unexpected: true }, { activityIds: ['finish'], availableRounds: 1, singleUse: false }]) {
    const invalid = structuredClone(prepare)
    Object.assign(invalid.effects![0], { completionGrant })
    expect(validateDnd5eActivityDefinitionV1(invalid).join(' ')).toContain('completionGrant')
  }
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: JSON.parse(JSON.stringify([prepare, finish])) })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Timed', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    for (const definition of [prepare, finish]) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
      api.registerFeature({ id: definition.id, name: definition.name, description: 'Test', summary: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
    }
  } })
  try {
    const creature = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 15, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const actor = creature('actor', 20)
    actor.pluginFeatureIds = [packageId + ':prepare']
    let state = startDnd5eHeadlessCombat('public-timer', [actor, creature('other', 10)])
    const run = (activityId: string) => route === 'direct'
      ? resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {}, command: { schemaVersion: 1, commandId: activityId, actorId: 'actor', packageId, packageVersion: '1.0.0', activityId, targetIds: ['actor'], expectedRevision: 1 } }).result
      : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: activityId, featureId: packageId + ':' + activityId, actorId: 'actor', targetId: 'actor', rolls: {}, hostEntitlement: activityId === 'finish' ? { kind: 'active-effect', effectId: state.combatants.actor.classState.activeEffects?.find(effect => effect.grantedActivities?.includes('finish'))?.id ?? 'missing' } : undefined })
    expect(run('finish').ok).toBe(false)
    const start = run('prepare')
    expect(start.ok, JSON.stringify(start)).toBe(true)
    if (!start.ok) throw Error("Preparation failed")
    state = JSON.parse(JSON.stringify(start.state))
    expect(state.combatants.actor.classState.activeEffects?.filter(effect => effect.completionGrant)).toHaveLength(1)
    expect(run('finish').ok).toBe(false)
    const advance = () => { for (const actorId of ['actor', 'other']) {
      const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      state = JSON.parse(JSON.stringify(result.state))
    } }
    advance()
    expect(run('finish').ok).toBe(false)
    advance()
    expect(run('finish').ok).toBe(false)
    expect(state.combatants.actor.classState.activeEffects?.find(effect => effect.completionGrant)?.duration).toMatchObject({ remainingRounds: 1 })
    advance()
    expect(state.combatants.actor.classState.activeEffects?.filter(effect => effect.grantedActivities?.includes('finish'))).toHaveLength(1)
    const completed = run('finish')
    expect(completed.ok, JSON.stringify(completed)).toBe(true)
    if (!completed.ok) throw Error("Completion failed")
    expect(completed.state.combatants.actor.temporaryHp).toBe(3)
    state = completed.state
    advance()
    expect(run('finish').ok).toBe(false)
  } finally { dispose(); registration.dispose() }
})


it.each(['clear', 'missing-source', 'silent-source', 'unconscious-source', 'deaf-bearer', 'language-lost', 'out-of-range'] as const)('checks continuity before the final expiry boundary and never resumes interrupted preparation (%s)', scenario => {
  const creature = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, languages: ['Common'], proficiencyBonus: 2,
    armorClass: 15, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const bearer = creature('bearer', 20), other = creature('other', 10), source = creature('source', 0)
  bearer.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'conversation', definitionId: 'conversation', label: 'Conversation', targetId: 'bearer',
    source: { kind: 'feature', actorId: 'source', pluginId: packageId }, duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
    removal: { sourceLink: { requiresSourceCommunication: true, requiresSharedLanguage: true, maximumDistanceFeet: 10 } },
    completionGrant: { activityIds: ['finish'], availableRounds: 10 } })]
  let state = startDnd5eHeadlessCombat('last-boundary', [bearer, other, source])
  state.distanceFeetByCombatantPair = { ['bearer\u0000source']: 5 }
  if (scenario === 'missing-source') { delete state.combatants.source; state.initiativeOrder = ['bearer', 'other'] }
  if (scenario === 'silent-source') source.soundSuppressed = true
  if (scenario === 'unconscious-source') state.combatants.source.currentHp = 0
  if (scenario === 'deaf-bearer') {
    state.combatants.bearer.conditions = ['deafened']
    state.combatants.bearer.classState.activeEffects = [...state.combatants.bearer.classState.activeEffects!, createDnd5eConditionEffect({ id: 'deaf', condition: 'deafened', targetId: 'bearer', source: { kind: 'feature', actorId: 'source' } })]
  }
  if (scenario === 'language-lost') state.combatants.bearer.languages = ['Elvish']
  if (scenario === 'out-of-range') state.distanceFeetByCombatantPair = { ['bearer\u0000source']: 20 }
  if (scenario === 'silent-source') state.combatants.source.soundSuppressed = true
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'bearer' })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('Boundary failed')
  expect(state).toEqual(before)
  state = JSON.parse(JSON.stringify(result.state))
  expect(state.combatants.bearer.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('finish')) ?? false).toBe(scenario === 'clear')
  if (scenario !== 'clear') {
    expect(state.combatants.bearer.classState.activeEffects?.some(effect => effect.id === 'conversation') ?? false).toBe(false)
    state.combatants.source = creature('source', 0)
    state.distanceFeetByCombatantPair = { ['bearer\u0000source']: 5 }
    state.combatants.bearer.languages = ['Common']
    state.combatants.bearer.conditions = []
    state.combatants.bearer.classState.activeEffects = state.combatants.bearer.classState.activeEffects?.filter(effect => effect.id !== 'deaf')
    const restored = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'other' })
    expect(restored.ok, JSON.stringify(restored)).toBe(true)
    expect(restored.state.combatants.bearer.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('finish')) ?? false).toBe(false)
  }
})


it.each(['direct', 'plugin'] as const)('delivers a participant-bound completion to the source and consumes it once (%s)', async route => {
  const { registerDnd5eRulesPlugin } = await import('./pluginApi')
  const { compileDnd5eActivityHeadlessAction } = await import('./activities/dnd5eActivityHeadlessCompiler')
  const { dnd5ePluginFeatureActionFromActivityV1 } = await import('./activities/dnd5eActivityFeatureActionAdapter')
  const finish: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'finish', name: 'Finish', activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    requiresEffectGrant: true,
    outcomes: [{ id: 'finish', when: { kind: 'always' }, operations: [
      { id: 'benefit', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 3 } },
    ] }], automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'finish' },
  }
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [finish] })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Timed', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(finish))
    api.registerFeature({ id: finish.id, name: finish.name, description: 'Test', summary: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(finish) })
  } })
  try {
    const creature = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 15,
      currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const source = creature('source', 20), bearer = creature('bearer', 10), other = creature('other', 0)
    source.pluginFeatureIds = [packageId + ':finish']
    bearer.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'talk', definitionId: 'talk', label: 'Talk', targetId: 'bearer', source: { kind: 'feature', actorId: 'source', pluginId: packageId },
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' }, completionGrant: { activityIds: ['finish'], availableRounds: 10, recipient: 'source', bindTarget: 'bearer', singleUse: true } })]
    let state = startDnd5eHeadlessCombat('bound', [source, bearer, other])
    state.distanceFeetByCombatantPair = { ['bearer\u0000source']: 5, ['other\u0000source']: 5 }
    const run = (targetId: string, forgedTargetIds?: string[], grantId = 'talk:completed') => route === 'direct'
      ? resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {}, command: { schemaVersion: 1, commandId: 'finish', actorId: 'source', packageId, packageVersion: '1.0.0', activityId: 'finish', targetIds: forgedTargetIds ?? [targetId], expectedRevision: 1 } }).result
      : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: 'finish', featureId: packageId + ':finish', actorId: 'source', targetId, targetIds: forgedTargetIds, distanceFeet: 5, rolls: {}, hostEntitlement: { kind: 'active-effect', effectId: grantId } })
    expect(run('bearer').ok).toBe(false)
    for (const actorId of ['source', 'bearer', 'other']) {
      const next = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
      expect(next.ok, JSON.stringify(next)).toBe(true)
      state = JSON.parse(JSON.stringify(next.state))
    }
    expect(state.combatants.bearer.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('finish')) ?? false).toBe(false)
    const receipt = state.combatants.source.classState.activeEffects?.find(effect => effect.id === 'talk:completed')
    expect(receipt?.grantedActivityTargetIds).toEqual(['bearer'])
    for (const invalid of [[], [''], [' padded '], [1]]) expect(validateDnd5eActiveEffectsStrict([{ ...receipt, grantedActivityTargetIds: invalid }]).issues.length).toBeGreaterThan(0)
    expect(validateDnd5eActiveEffectsStrict([receipt]).issues).toEqual([])
    const before = structuredClone(state)
    expect(run('other').ok).toBe(false)
    expect(run('other', route === 'plugin' ? ['bearer'] : ['bearer', 'other']).ok).toBe(false)
    expect(state).toEqual(before)
    if (!receipt) throw Error('Missing receipt')
    expect(receipt.grantedActivitiesSingleUse).toBe(true)
    state.combatants.source.classState.activeEffects = [...state.combatants.source.classState.activeEffects!, { ...receipt, id: 'other-receipt', grantedActivityTargetIds: ['other'] }]
    state.combatants.source.turn.actionAvailable = false
    const beforeFailed = structuredClone(state)
    expect(run('bearer').ok).toBe(false)
    expect(state).toEqual(beforeFailed)
    state.combatants.source.turn.actionAvailable = true
    const success = run('bearer')
    expect(success.ok, JSON.stringify(success)).toBe(true)
    if (!success.ok) throw Error('Bound completion failed')
    state = success.state
    expect(state.combatants.bearer.temporaryHp).toBe(3)
    expect(state.combatants.other.temporaryHp).toBe(0)
    expect(state.combatants.source.classState.activeEffects?.map(effect => effect.id)).toContain('other-receipt')
    state.combatants.source.turn.actionAvailable = true
    expect(run('bearer').ok).toBe(false)
    const second = run('other', undefined, 'other-receipt')
    expect(second.ok, JSON.stringify(second)).toBe(true)
    if (!second.ok) throw Error('Second bound receipt failed')
    expect(second.state.combatants.other.temporaryHp).toBe(3)
    expect(second.state.combatants.source.classState.activeEffects?.some(effect => effect.grantedActivities?.includes('finish')) ?? false).toBe(false)
  } finally { dispose(); registration.dispose() }
})

