import { afterEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityTriggerContextV1 } from './dnd5eActivityContracts'
import {
  canonicalDnd5eTriggerEventV1,
  matchDnd5eActivityInvocationV1,
  resolveDnd5eActivityInvocationV1,
} from './dnd5eActivityInvocation'
import {
  clearDnd5eActivityRegistryForTests,
  listAvailableRegisteredDnd5eActivitiesV1,
  registerDnd5eActivityPackage,
} from './dnd5eActivityRegistry'

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

describe('unified Activity invocation', () => {
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
