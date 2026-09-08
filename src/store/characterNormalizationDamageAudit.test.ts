import { describe, expect, it } from 'vitest'
import {
  dnd5eCoreSpellComponentRequirements,
  dnd5eSpellComponentCheck,
  dnd5eSpellComponentsAvailable,
} from '../rulesets/dnd5e/spellComponents'
import { normalizeCharacter, serializeDnd5eCharacterSnapshot } from './characters'

describe('character normalization damage-path audit', () => {
  // The shared DM/player path normalizes a character again after a persisted
  // snapshot is read. An explicitly empty loadout must therefore survive more
  // than one normalization pass; otherwise a caster can acquire default gear
  // after refresh and have a valid spell rejected as hands-occupied.
  it('keeps an explicitly empty caster loadout stable across a shared snapshot reload', () => {
    const first = normalizeCharacter({
      id: 'empty-loadout-druid',
      name: 'Empty Loadout Druid',
      charClass: '德鲁伊',
      dnd5eClassLevels: { druid: 5 },
      level: 5,
      conditions: [],
      equipment: {},
      dnd5eInventory: {
        schemaVersion: 3,
        entries: [{
          instanceId: 'component-pouch',
          templateId: 'srd-5.1:item:component-pouch',
          item: {
            id: 'srd-5.1:item:component-pouch',
            name: '材料包',
            category: 'container',
            icon: 'generic',
            description: '',
            rulesText: '',
            stackable: false,
            source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
          },
          quantity: 1,
          acquiredAt: 1,
        }],
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      },
    })
    const reloaded = normalizeCharacter(serializeDnd5eCharacterSnapshot(first))
    const check = dnd5eSpellComponentCheck(
      reloaded,
      dnd5eCoreSpellComponentRequirements('moonbeam'),
      'druid',
    )

    expect(reloaded.equipment).toEqual({})
    expect(check).toMatchObject({
      somatic: 'available',
      material: 'focus-or-pouch',
    })
    expect(dnd5eSpellComponentsAvailable(check)).toBe(true)
  })
})
