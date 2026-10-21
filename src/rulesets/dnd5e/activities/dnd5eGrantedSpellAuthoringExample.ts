import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

/** Synthetic spell: illustrative numbers, not a transcription of any source. */
export const DND5E_GRANTED_SPELL_AUTHORING_EXAMPLE: readonly Dnd5eActivityDefinitionV1[] = [
  {
    schemaVersion: 1, id: 'example-cast', name: 'Synthetic preparation',
    legacySource: { kind: 'spell', id: 'example-granted-spell' },
    activation: { kind: 'action' }, target: { kind: 'self' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    effects: [{ schemaVersion: 1, id: 'example-authorization', name: 'Synthetic authorization',
      duration: { kind: 'rounds', rounds: 2, expiresAt: 'target-turn-end' }, stacking: 'replace',
      grants: ['example-follow-up'] }],
    outcomes: [{ id: 'cast', when: { kind: 'always' }, operations: [
      { id: 'authorize', kind: 'apply-effect', target: 'actor', effectId: 'example-authorization' },
    ] }], automation: automationCapabilityFromLegacyStatus('full'),
  },
  {
    schemaVersion: 1, id: 'example-follow-up', name: 'Synthetic follow-up',
    legacySource: { kind: 'spell', id: 'example-granted-spell' }, requiresEffectGrant: true,
    activation: { kind: 'bonus-action' }, target: { kind: 'self' },
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [
      { id: 'benefit', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 2 } },
    ] }], automation: automationCapabilityFromLegacyStatus('full'),
  },
]
