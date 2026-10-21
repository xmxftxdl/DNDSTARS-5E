import { afterEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityTriggerContextV1 } from './dnd5eActivityContracts'
import {
  canonicalDnd5eTriggerEventV1,
  validateDnd5eActivityTriggerContextV1,
  dnd5eContextPredicateSatisfiedV1,
  matchDnd5eActivityInvocationV1,
  resolveDnd5eActivityInvocationV1,
} from './dnd5eActivityInvocation'
import {
  clearDnd5eActivityRegistryForTests,
  listAvailableRegisteredDnd5eActivitiesV1,
  registerDnd5eActivityPackage,
} from './dnd5eActivityRegistry'

it('never treats mounted, unknown, forced or teleport movement as voluntary movement', () => {
  for (const movementKind of [undefined, 'voluntary', 'mounted', 'forced', 'teleport'] as const) {
    const context: Dnd5eActivityTriggerContextV1 = {
      eventId: 'movement-1', event: 'movement-completed', eligibleActorIds: ['hero'], eligibleTargetIds: ['hero'],
      source: { kind: 'movement', distanceFeet: 5, completed: true, movementKind },
    }
    expect(dnd5eContextPredicateSatisfiedV1({ kind: 'movement-property', movementKind: 'voluntary' },
      JSON.parse(JSON.stringify(context)))).toBe(movementKind === 'voluntary')
    expect(dnd5eContextPredicateSatisfiedV1({ kind: 'movement-property', movementKind: 'mounted' }, context)).toBe(movementKind === 'mounted')
  }
})

const followUp: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1,
  id: 'light-weapon-follow-up',
  name: 'Light weapon follow-up',
  activation: { kind: 'bonus-action', cost: 1 },
  invocation: {
    kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice', retention: 'until-turn-end',
  },
  target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5 },
  requirements: [
    { kind: 'event-source', source: 'attack' },
    { kind: 'weapon-property', property: 'light', present: true },
    { kind: 'action-economy-available', economy: 'bonus-action' },
  ],
  consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
  outcomes: [{
    id: 'resolve', when: { kind: 'always' }, operations: [{
      id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 1 }, damageType: 'slashing',
    }],
  }],
  automation: automationCapabilityFromLegacyStatus('full'),
}

const attackContext: Dnd5eActivityTriggerContextV1 = {
  eventId: 'event-attack-1',
  event: 'attack-resolved',
  source: {
    kind: 'attack', id: 'shortsword', activityId: 'weapon-attack', mode: 'melee', result: 'hit',
    weaponId: 'shortsword', weaponProperties: ['light', 'finesse'],
  },
  eligibleActorIds: ['fighter'],
  eligibleTargetIds: ['goblin'],
  actionEconomyAvailable: { 'bonus-action': true },
}

afterEach(clearDnd5eActivityRegistryForTests)

it('distinguishes an inventory weapon instance from its Host-resolved base definition', () => {
  const context: Dnd5eActivityTriggerContextV1 = { ...attackContext,
    source: { kind: 'attack', mode: 'ranged', weaponId: 'owned-bow-42', weaponBaseId: 'dnd5e-longbow' } }
  for (const identity of [undefined, 'instance', 'base'] as const) {
    for (const id of ['owned-bow-42', 'dnd5e-longbow', 'dnd5e-shortbow']) {
      const predicate = { kind: 'attack-weapon' as const, identity, weaponIds: [id] }
      expect(dnd5eContextPredicateSatisfiedV1(predicate, JSON.parse(JSON.stringify(context))))
        .toBe(id === (identity === 'base' ? 'dnd5e-longbow' : 'owned-bow-42'))
      expect(validateDnd5eActivityDefinitionV1({ ...followUp, requirements: [predicate] })).toEqual([])
    }
  }
  expect(dnd5eContextPredicateSatisfiedV1({ kind: 'attack-weapon', identity: 'base', weaponIds: ['dnd5e-longbow'] },
    { ...context, source: { kind: 'attack', mode: 'ranged', weaponId: 'dnd5e-longbow' } })).toBe(false)
  expect(dnd5eContextPredicateSatisfiedV1({ kind: 'attack-weapon', identity: 'base', weaponIds: ['dnd5e-longbow'] }, undefined)).toBe(false)
  expect(validateDnd5eActivityDefinitionV1({ ...followUp,
    requirements: [{ kind: 'attack-weapon', identity: 'either', weaponIds: ['dnd5e-longbow'] } as never] }))
    .toContainEqual(expect.stringContaining('.identity'))
})

describe('unified Activity invocation', () => {
  it('includes critical results in hit/miss while retaining exact critical predicates', () => {
    const results = ['hit', 'miss', 'critical-hit', 'critical-miss'] as const
    for (const actual of results) for (const required of results) {
      const context: Dnd5eActivityTriggerContextV1 = {
        ...attackContext, source: {kind:'attack',mode:'melee',result:actual},
      }
      expect(dnd5eContextPredicateSatisfiedV1({kind:'attack-result',result:required},context)).toBe(
        actual === required || required === 'hit' && actual === 'critical-hit' || required === 'miss' && actual === 'critical-miss')
    }
    expect(dnd5eContextPredicateSatisfiedV1({kind:'attack-result',result:'hit'},undefined)).toBe(false)
    expect(dnd5eContextPredicateSatisfiedV1({kind:'attack-result',result:'hit'},{...attackContext,source:{kind:'spell',id:'sample',level:0}})).toBe(false)
  })
  it('normalizes legacy event names without changing stored packages', () => {
    expect(canonicalDnd5eTriggerEventV1('on-hit')).toBe('attack-hit')
    expect(resolveDnd5eActivityInvocationV1({
      ...followUp,
      invocation: undefined,
      triggers: [{ id: 'legacy-trigger', event: 'on-hit', activityId: followUp.id }],
    })).toMatchObject({ kind: 'triggered', event: 'attack-hit' })
  })

  it('requires the exact Host window, eligible actor/targets, contextual predicates, and actor confirmation', () => {
    expect(matchDnd5eActivityInvocationV1({
      activity: followUp, actorId: 'fighter', targetIds: ['goblin'], confirmedBy: 'actor',
    })).toMatchObject({ ok: false, reason: 'trigger-context-required' })

    expect(matchDnd5eActivityInvocationV1({
      activity: followUp, actorId: 'fighter', targetIds: ['goblin'], triggerContext: attackContext,
    })).toMatchObject({ ok: false, reason: 'confirmation-required' })

    expect(matchDnd5eActivityInvocationV1({
      activity: followUp,
      actorId: 'fighter',
      targetIds: ['goblin'],
      triggerContext: {
        ...attackContext,
        source: attackContext.source.kind === 'attack'
          ? { ...attackContext.source, weaponProperties: ['finesse'] }
          : attackContext.source,
      },
      confirmedBy: 'actor',
    })).toMatchObject({ ok: false, reason: 'trigger-mismatch' })

    expect(matchDnd5eActivityInvocationV1({
      activity: followUp, actorId: 'fighter', targetIds: ['goblin'], triggerContext: attackContext, confirmedBy: 'actor',
    })).toMatchObject({ ok: true })
  })

  it('discovers trigger choices across registered packages through one Host query', () => {
    registerDnd5eActivityPackage({ packageId: 'test.activities', packageVersion: '1.0.0', activities: [followUp] })
    expect(listAvailableRegisteredDnd5eActivitiesV1({
      triggerContext: attackContext, actorId: 'fighter', targetIds: ['goblin'],
    })).toMatchObject([{
      packageId: 'test.activities',
      confirmation: 'actor-choice',
      retention: 'until-turn-end',
      activity: { id: 'light-weapon-follow-up' },
    }])
  })

  it('matches an exact Host-generated stable definition id', () => {
    const definitionId = 'dnd5e-2014:srd-5.1:attack:shortsword'
    const activity: Dnd5eActivityDefinitionV1 = {
      ...followUp,
      requirements: [{ kind: 'activity-definition', definitionId }],
    }
    expect(matchDnd5eActivityInvocationV1({
      activity,
      actorId: 'fighter',
      targetIds: ['goblin'],
      triggerContext: {
        ...attackContext,
        source: { ...attackContext.source, definitionId, executionId: 'attack-execution-1' },
      },
      confirmedBy: 'actor',
    })).toMatchObject({ ok: true })
    expect(matchDnd5eActivityInvocationV1({
      activity,
      actorId: 'fighter',
      targetIds: ['goblin'],
      triggerContext: {
        ...attackContext,
        source: {
          ...attackContext.source,
          definitionId: 'dnd5e-2014:srd-5.1:attack:longsword',
          executionId: 'attack-execution-2',
        },
      },
      confirmedBy: 'actor',
    })).toMatchObject({ ok: false, reason: 'trigger-mismatch' })
  })

  it('trusts attack proficiency only when it is present in the Host event envelope', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...followUp,
      requirements: [{ kind: 'attack-proficiency', proficient: true }],
    }
    if (attackContext.source.kind !== 'attack') throw new Error('test attack context is invalid')
    expect(matchDnd5eActivityInvocationV1({
      activity, actorId: 'fighter', targetIds: ['goblin'],
      triggerContext: { ...attackContext, source: { ...attackContext.source, proficient: false } },
      confirmedBy: 'actor',
    })).toMatchObject({ ok: false, reason: 'trigger-mismatch' })
    expect(matchDnd5eActivityInvocationV1({
      activity, actorId: 'fighter', targetIds: ['goblin'],
      triggerContext: { ...attackContext, source: { ...attackContext.source, proficient: true } },
      confirmedBy: 'actor',
    })).toMatchObject({ ok: true })
  })
})

it('rejects unknown equipment classifications and spell attacks for weapon-category requirements', () => {
  for (const category of ['weapon', 'spell'] as const) for (const weaponCategory of [undefined, 'simple', 'martial'] as const) {
    const context: Dnd5eActivityTriggerContextV1 = { ...attackContext,
      source: { kind: 'attack', mode: category === 'spell' ? 'spell' : 'melee', category, weaponCategory } }
    expect(dnd5eContextPredicateSatisfiedV1({ kind: 'attack-weapon-category', categories: ['simple', 'martial'] }, context))
      .toBe(category === 'weapon' && weaponCategory != null)
  }
  for (const categories of [[], ['simple', 'simple'], ['natural'], null]) {
    const activity = structuredClone(followUp)
    activity.requirements = [{ kind: 'attack-weapon-category', categories } as never]
    expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('.categories'))).toBe(true)
  }
  expect(validateDnd5eActivityDefinitionV1({ ...followUp,
    requirements: [{ kind: 'attack-weapon-category', categories: ['simple', 'martial'] }] })).toEqual([])
  expect(dnd5eActivityAutomationAnalysisV1({ ...followUp,
    requirements: [{ kind: 'attack-weapon-category', categories: ['simple', 'martial'] }] }))
    .toMatchObject({ capability: { level: 'full', limitations: [] }, missingComponents: [],
      handlerIds: expect.arrayContaining(['core.predicate.attack-weapon-category']) })
})


it.each([undefined, 5, 10, -1, Number.NaN, Number.POSITIVE_INFINITY])('checks only validated attack movement snapshots: %s',distance=>{
  const context:Dnd5eActivityTriggerContextV1={eventId:'attack',event:'attack-hit',eligibleActorIds:['hero'],eligibleTargetIds:['target'],
    source:{kind:'attack',mode:'melee',result:'hit',precedingStraightMovementFeet:distance}}
  const valid=distance==null || Number.isFinite(distance)&&distance>=0
  expect(validateDnd5eActivityTriggerContextV1(context).length===0).toBe(valid)
  expect(dnd5eContextPredicateSatisfiedV1({kind:'movement-distance',basis:'before-attack-straight-streak',minimumFeet:10},context)).toBe(distance===10)
  expect(dnd5eContextPredicateSatisfiedV1({kind:'movement-distance',basis:'straight-streak',minimumFeet:10},context)).toBe(false)
})
