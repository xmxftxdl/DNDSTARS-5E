import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { createDnd5eConditionEffect } from '../activeEffects'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { rollDnd5eActivityTriggerDiceV1 } from './dnd5eActivityTriggerSettlement'

const cases = ['hearing', 'shared-language', 'comprehension', 'actor-speech', 'target-speech', 'identity', 'companion', 'condition', 'ability'] as const
it.each(cases)('checks %s from Host facts before shared damage and target save dice', async kind => {
  for (const eligible of [true, false]) {
    const make = (id: string) => createDnd5eCombatant({ id, name: id, initiative: 10, controller: 'dm',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const actor = make('actor'), target = make('target')
    actor.languages = ['Common']
    target.languages = eligible ? ['Common'] : ['Elvish']
    if (kind === 'hearing' && !eligible) {
      target.conditions = ['deafened']
      target.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'deafened', targetId: target.id,
        source: { kind: 'feature', actorId: actor.id } })]
    }
    if (kind === 'actor-speech') actor.soundSuppressed = !eligible
    if (kind === 'target-speech') target.soundSuppressed = !eligible
    if (kind === 'companion') target.summonedSourceCombatantId = eligible ? actor.id : 'other'
    if (kind === 'condition' && eligible) {
      target.conditions = ['prone']
      target.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'prone', targetId: target.id,
        source: { kind: 'feature', actorId: actor.id } })]
    }
    if (kind === 'ability') target.abilities.int = eligible ? 10 : 2
    const requirements: NonNullable<Dnd5eActivityDefinitionV1['requirements']> = kind === 'hearing' ? [{ kind: 'can-hear-source' }]
      : kind === 'shared-language' ? [{ kind: 'shared-language' }]
        : kind === 'comprehension' ? [{ kind: 'can-understand-source-language' }]
          : kind === 'actor-speech' ? [{ kind: 'can-speak', subject: 'actor' }]
            : kind === 'target-speech' ? [{ kind: 'can-speak', subject: 'target' }]
              : kind === 'identity' ? [{ kind: 'target-identity', identity: 'other' }]
                : kind === 'companion' ? [{ kind: 'owned-companion', subject: 'target' }]
                  : kind === 'condition' ? [{ kind: 'condition', subject: 'target', condition: 'prone', present: true }]
                    : [{ kind: 'ability-score', subject: 'target', ability: 'int', comparison: 'above', value: 3 }]
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'eligibility', name: 'Eligibility',
      activation: { kind: 'free' }, target: { kind: 'creature', relation: 'any', count: 1, includeSelf: true }, requirements,
      automation: automationCapabilityFromLegacyStatus('full'),
      checks: [{ id: 'save', kind: 'saving-throw', scope: 'per-target', rollId: 'save', ability: 'wis', dc: { kind: 'constant', value: 12 } }],
      outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', damageType: 'psychic',
        target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } }] }] }
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const state = startDnd5eHeadlessCombat('eligibility', [actor, target])
    const before = structuredClone(state)
    const targetId = kind === 'identity' && !eligible ? actor.id : target.id
    const requests: string[] = []
    const result = await rollDnd5eActivityTriggerDiceV1({ state, actorId: actor.id, targetIds: [targetId],
      available: { packageId: 'test.eligibility', packageVersion: '1.0.0', activity, confirmation: 'automatic', retention: 'single-event' },
      triggerContext: { eventId: 'event', event: 'after-damage', source: { kind: 'combat', id: 'damage' },
        eligibleActorIds: [actor.id], eligibleTargetIds: [targetId] },
      roll: async request => { requests.push(request.id); return [1] } })
    if (eligible) {
      expect(result).not.toHaveProperty('unsupported')
      expect(requests).toEqual(['damage', 'save:target'])
    } else {
      expect(result).toEqual({ unsupported: 'activity-target-requirements-not-met' })
      expect(requests).toEqual([])
    }
    expect(state).toEqual(before)
  }
})
