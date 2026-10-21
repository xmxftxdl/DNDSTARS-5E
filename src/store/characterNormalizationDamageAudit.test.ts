import { describe, expect, it } from 'vitest'
import {
  dnd5eCoreSpellComponentRequirements,
  dnd5eSpellComponentCheck,
  dnd5eSpellComponentsAvailable,
} from '../rulesets/dnd5e/spellComponents'
import { normalizeCharacter, serializeDnd5eCharacterSnapshot } from './characters'
import { projectCharactersForRoomMember } from '../../scripts/shared-server-core.mjs'
import { dnd5eEffectiveCharacterMovementProfile } from '../rulesets/dnd5e/characterMovement'

describe('character normalization damage-path audit', () => {
  it('does not invent starter armor when a viewer reloads a redacted fighter', () => {
    const fighter = normalizeCharacter({ id: 'fighter', name: 'Fighter',
      roomMemberId: 'dm', charClass: '战士', level: 6, dnd5eClassLevels: { fighter: 6 },
      speed: 30, abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      equipment: {}, conditions: [] })
    const snapshot = projectCharactersForRoomMember({ characters: [fighter] }, { memberId: 'viewer' })
    const reloaded = normalizeCharacter(JSON.parse(JSON.stringify(snapshot.characters[0])))
    expect(reloaded.equipment).toEqual({})
    expect(dnd5eEffectiveCharacterMovementProfile(reloaded).walkSpeed).toBe(30)
    expect(fighter.equipment).toEqual({})
  })
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
