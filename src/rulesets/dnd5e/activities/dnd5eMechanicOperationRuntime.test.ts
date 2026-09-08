import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'

const actor = (id: string, controller: string): Dnd5eActivityActorSnapshot => ({
  id,
  controller,
  level: 5,
  proficiencyBonus: 3,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  currentHp: 20,
  maxHp: 20,
  armorClass: 12,
  conditions: [],
})

function reflectionActivity(handlerId = 'core.event-damage-reflection'): Dnd5eActivityDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'damage-reflection',
    name: 'Damage reflection',
    activation: { kind: 'passive' },
    invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic' },
    target: { kind: 'creature', relation: 'enemy', count: 1 },
    outcomes: [{
      id: 'reflect',
      when: { kind: 'always' },
      operations: [{
        id: 'reflect-event-damage',
        kind: 'mechanic',
        handlerId,
        target: 'target',
        parameters: {
          multiplier: 0.5,
          'maximum-damage': 5,
          'damage-type': 'fire',
          magical: true,
        },
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('manual'),
  }
}

describe('D&D 5e executable mechanic operations', () => {
  it('derives coverage from the concrete handler and resolves only capability proposals', () => {
    const activity = reflectionActivity()
    const analysis = dnd5eActivityAutomationAnalysisV1(activity)

    expect(analysis.capability.level).toBe('full')
    expect(analysis.requiredComponents).toContain('mechanic:core.event-damage-reflection')
    expect(analysis.handlerIds).toContain('core.event-damage-reflection')

    const source = actor('defender', 'players')
    const attacker = actor('attacker', 'monsters')
    const result = resolveDnd5eActivity({
      activity,
      actor: source,
      targets: [attacker],
      rolls: {},
      triggerContext: {
        eventId: 'activity-event:combat:42:after-damage',
        event: 'after-damage',
        source: {
          kind: 'combat',
          id: 'damage-taken',
          damage: {
            amount: 12,
            temporaryHitPointsBefore: 0,
            temporaryHitPointsAfter: 0,
            damageTypes: ['slashing'],
          },
        },
        eligibleActorIds: [source.id],
        eligibleTargetIds: [attacker.id],
      },
      confirmedBy: 'system',
    })

    expect(result).toMatchObject({
      ok: true,
      status: 'resolved',
      proposals: [{
        kind: 'deal-damage',
        operationId: 'reflect-event-damage',
        targetId: attacker.id,
        amount: 5,
        damageType: 'fire',
        magical: true,
      }],
    })
  })

  it('reports an unregistered handler instead of trusting coarse automation metadata', () => {
    const analysis = dnd5eActivityAutomationAnalysisV1(reflectionActivity('room.unknown-handler'))
    expect(analysis.capability.level).toBe('assisted')
    expect(analysis.missingComponents).toContain('mechanic:room.unknown-handler')
  })

  it('rejects nested executable-looking parameters at the Activity boundary', () => {
    const activity = reflectionActivity()
    const operation = activity.outcomes[0].operations[0]
    const invalid = {
      ...activity,
      outcomes: [{
        ...activity.outcomes[0],
        operations: [{ ...operation, parameters: { payload: { arbitrary: 'code' } } }],
      }],
    } as unknown as Dnd5eActivityDefinitionV1
    expect(validateDnd5eActivityDefinitionV1(invalid)).toContain(
      'activity.outcomes[0].operations[0] mechanic handler declaration is invalid',
    )
  })
})
