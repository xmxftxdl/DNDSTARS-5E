import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'

/** Fictional authoring example; values and eligibility must come from the source. */
export const DND5E_NATIVE_SUBCLASS_REST_EXAMPLE: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'example-rest-armor', name: '示例休息护甲附魔',
  activation: { kind: 'free' }, target: { kind: 'self' },
  invocation: { kind: 'triggered', event: 'long-rest-complete', confirmation: 'actor-choice', retention: 'single-event' },
  legacySource: { kind: 'subclass-ability', id: 'example-school:example-gift' },
  automation: automationCapabilityFromLegacyStatus('full'),
  effects: [{
    schemaVersion: 1, id: 'example-armor', name: '示例物品效果', stacking: 'replace',
    duration: { kind: 'permanent' }, breakOn: ['source-long-rest-complete', 'source-dies'],
    modifiers: [{ kind: 'armor-enchantment', itemSelection: 'inventory-item', requiresNonmagical: true,
      armorClassBonus: { kind: 'constant', value: 1 } }],
  }],
  outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
    { kind: 'apply-effect', id: 'bind-armor', target: 'actor', effectId: 'example-armor' },
  ] }],
}
