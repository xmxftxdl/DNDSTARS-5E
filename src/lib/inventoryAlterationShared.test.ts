import { expect, it } from 'vitest'
import { inventoryAlterationIssue } from '../../shared/inventory-alteration.mjs'
import { projectCharactersForRoomMember, validateSharedStateShape } from '../../scripts/shared-server-core.mjs'
import { validateAndMigrateSharedResource } from './sharedResourceValidation'

const tag = 'item-lease:11111111-1111-1111-1111-111111111111'
function fixture() {
  const original = { instanceId: 'ordinary', templateId: 'secret:original', quantity: 3, identified: false, acquiredAt: 0,
    item: { id: 'secret:original', name: 'Hidden original', category: 'magic-item', rulesText: 'SECRET RULE', magicItem: { rarity: 'rare' } } }
  return { characters: [{ id: 'owner', name: 'Owner', roomMemberId: 'player', visibleToPlayers: true,
    dnd5eInventory: { schemaVersion: 3, revision: 2,
      entries: [{ instanceId: 'altered', templateId: 'public:form', quantity: 2, identified: true,
        item: { id: 'public:form', name: 'Public form' }, sourceEffectTag: tag, sourceEffectOwnerId: 'owner',
        spellAlteration: { sourceEffectTag: tag, sourceEffectOwnerId: 'owner', original } }],
      releasedObjects: [{ ...original, instanceId: 'released', quantity: 1 }],
    } }], selectedId: 'owner', updatedAt: 1 }
}

it('accepts matched alteration and released records on server and client without losing them', () => {
  const state = fixture(), before = structuredClone(state)
  expect(inventoryAlterationIssue(state.characters[0].dnd5eInventory)).toBeNull()
  expect(validateSharedStateShape('characters', state).ok).toBe(true)
  expect(validateAndMigrateSharedResource('characters', state).status).not.toBe('invalid')
  expect(state).toEqual(before)
})

it.each(['binding', 'quantity', 'nested', 'released-duplicate', 'released-equipped', 'released-form', 'bad-array'] as const)('rejects %s on both validation paths', mode => {
  const state = fixture(), inventory = state.characters[0].dnd5eInventory
  if (mode === 'binding') inventory.entries[0].spellAlteration.sourceEffectOwnerId = 'other'
  if (mode === 'quantity') inventory.entries[0].quantity = 4
  if (mode === 'nested') Object.assign(inventory.entries[0].spellAlteration.original, { spellAlteration: {} })
  if (mode === 'released-duplicate') inventory.releasedObjects[0].instanceId = 'altered'
  if (mode === 'released-equipped') Object.assign(inventory.releasedObjects[0], { equippedSlot: 'mainWeapon' })
  if (mode === 'released-form') Object.assign(inventory.releasedObjects[0], { spellAlteration: {} })
  if (mode === 'bad-array') Object.assign(inventory, { entries: {} })
  expect(inventoryAlterationIssue(inventory)).not.toBeNull()
  expect(validateSharedStateShape('characters', state).ok).toBe(false)
  expect(validateAndMigrateSharedResource('characters', state).status).toBe('invalid')
})

it('hides original and released unidentified secrets from owner projection without mutating Host data', () => {
  const state = fixture(), before = structuredClone(state)
  const projected = projectCharactersForRoomMember(state, { memberId: 'player' })
  expect(JSON.stringify(projected)).not.toContain('SECRET RULE')
  expect(JSON.stringify(projected)).not.toContain('secret:original')
  expect(JSON.stringify(projected)).toContain('public:form')
  expect(validateSharedStateShape('characters', projected).ok).toBe(true)
  expect(state).toEqual(before)
})
