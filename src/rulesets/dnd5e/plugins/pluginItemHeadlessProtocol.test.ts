import { describe, expect, it } from 'vitest'
import { validateAndNormalizeDnd5ePluginItemHeadlessProtocol } from './pluginItemHeadlessProtocol'

type ProtocolDefinition = Parameters<
  typeof validateAndNormalizeDnd5ePluginItemHeadlessProtocol
>[0]['definition']

function definition(effect: NonNullable<ProtocolDefinition['use']>['effect']): ProtocolDefinition {
  return {
    use: {
      economy: 'action',
      consumeQuantity: 0,
      effect,
    },
  }
}

describe('plugin item Headless spell protocol', () => {
  it('accepts only a whitelisted core spell with the fixed authority values its resolution needs', () => {
    expect(validateAndNormalizeDnd5ePluginItemHeadlessProtocol({
      itemId: 'test.circlet',
      definition: definition({
        kind: 'spell-cast',
        schemaVersion: 1,
        spellId: 'scorching-ray',
        castAtLevel: 2,
        spellAttackBonus: 5,
      }),
      hasEquipment: false,
    })).toMatchObject({
      use: {
        effect: {
          kind: 'spell-cast',
          spellId: 'scorching-ray',
          castAtLevel: 2,
          spellAttackBonus: 5,
        },
      },
    })

    expect(validateAndNormalizeDnd5ePluginItemHeadlessProtocol({
      itemId: 'test.ring',
      definition: definition({
        kind: 'spell-cast',
        schemaVersion: 1,
        spellId: 'jump',
        castAtLevel: 1,
        targeting: 'self-only',
      }),
      hasEquipment: false,
    }).use?.effect).toMatchObject({ kind: 'spell-cast', spellId: 'jump', targeting: 'self-only' })
  })

  it('rejects unknown spells, reaction spells and missing fixed attack or save values', () => {
    for (const effect of [
      { kind: 'spell-cast', schemaVersion: 1, spellId: 'not-a-core-spell', castAtLevel: 1 },
      { kind: 'spell-cast', schemaVersion: 1, spellId: 'shield', castAtLevel: 1 },
      { kind: 'spell-cast', schemaVersion: 1, spellId: 'scorching-ray', castAtLevel: 2 },
      { kind: 'spell-cast', schemaVersion: 1, spellId: 'fireball', castAtLevel: 3 },
    ] as const) {
      expect(() => validateAndNormalizeDnd5ePluginItemHeadlessProtocol({
        itemId: 'test.invalid',
        definition: definition(effect),
        hasEquipment: false,
      })).toThrow('Invalid plugin item spell cast')
    }
  })

  it('accepts multiple Host-validated spell actions sharing one recoverable charge pool', () => {
    const normalized = validateAndNormalizeDnd5ePluginItemHeadlessProtocol({
      itemId: 'test.shared-staff',
      definition: {
        resources: [{
          id: 'charges', label: '充能', maximum: 10, initial: 10, resetOn: 'dawn',
          recovery: { kind: 'dice', trigger: 'dawn', dice: { count: 1, sides: 6, bonus: 4 } },
          lastChargeDestruction: { trigger: 'spend-last-charge', dieSides: 20, destroyOn: 1 },
        }],
        useActions: [{
          id: 'heal-1', label: '疗伤术', economy: 'action', consumeQuantity: 0,
          resourceCost: { resourceId: 'charges', amount: 1 },
          effect: {
            kind: 'spell-cast', schemaVersion: 1, spellId: 'cure-wounds', castAtLevel: 1,
            useCharacterSpellcasting: true,
          },
        }, {
          id: 'heal-2', label: '二环疗伤术', economy: 'action', consumeQuantity: 0,
          resourceCost: { resourceId: 'charges', amount: 2 },
          effect: {
            kind: 'spell-cast', schemaVersion: 1, spellId: 'cure-wounds', castAtLevel: 2,
            useCharacterSpellcasting: true,
          },
        }],
      },
      hasEquipment: true,
    })
    expect(normalized.useActions).toHaveLength(2)
    expect(normalized.resources?.[0]).toMatchObject({
      recovery: { dice: { count: 1, sides: 6, bonus: 4 } },
      lastChargeDestruction: { dieSides: 20, destroyOn: 1 },
    })

    expect(() => validateAndNormalizeDnd5ePluginItemHeadlessProtocol({
      itemId: 'test.duplicate-action',
      definition: {
        resources: [{ id: 'charges', label: '充能', maximum: 2, resetOn: 'dawn' }],
        useActions: [0, 1].map(() => ({
          id: 'same', label: '重复', economy: 'action' as const, consumeQuantity: 0,
          resourceCost: { resourceId: 'charges', amount: 1 },
          effect: { kind: 'spell-cast' as const, schemaVersion: 1 as const, spellId: 'jump', castAtLevel: 1 },
        })),
      },
      hasEquipment: false,
    })).toThrow('Duplicate plugin item action')
  })

  it('accepts structured damage-reduction dice and rejects ambiguous formulas', () => {
    const normalized = validateAndNormalizeDnd5ePluginItemHeadlessProtocol({
      itemId: 'test.dice-ward',
      definition: {
        headlessEffects: [{
          schemaVersion: 1, id: 'ward', kind: 'damage-reduction', trigger: 'before-damage',
          dice: { count: 1, sides: 6, bonus: 2 },
        }],
      },
      hasEquipment: true,
    })
    expect(normalized.headlessEffects?.[0]).toMatchObject({
      kind: 'damage-reduction', dice: { count: 1, sides: 6, bonus: 2 },
    })

    expect(() => validateAndNormalizeDnd5ePluginItemHeadlessProtocol({
      itemId: 'test.ambiguous-ward',
      definition: ({
        headlessEffects: [{
          schemaVersion: 1, id: 'ward', kind: 'damage-reduction', trigger: 'before-damage',
          amount: 2,
          dice: { count: 1, sides: 4, bonus: 0 },
        }],
      } as unknown as ProtocolDefinition),
      hasEquipment: true,
    })).toThrow('Invalid plugin item damage reduction effect')
  })
})
