import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory, expireDnd5eSourceBoundInventoryRoster } from './items'
import { alterDnd5eInventoryItem, alterDnd5eInventoryItemBatch, restoreDnd5eInventoryItem, releaseDnd5eAlteredProjectile } from './inventoryItemAlteration'

it.each(['same-owner', 'different-owner', 'stale-last', 'duplicate', 'wrong-total', 'bound-last', 'wrong-template', 'duplicate-owner'] as const)(
  'settles multiple physical stacks atomically: %s', mode => {
    const { character, entry, input } = fixture()
    const second = { ...structuredClone(entry), instanceId: 'second-stack', quantity: 2 }
    const other = { ...structuredClone(character), id: 'other', dnd5eInventory: { ...character.dnd5eInventory!, entries: [second] } }
    const different = mode === 'different-owner' || mode === 'duplicate-owner'
    const roster = different ? [character, other] : [{ ...character, dnd5eInventory: { ...character.dnd5eInventory!, entries: [entry, second] } }]
    if (mode === 'duplicate-owner') roster.push(structuredClone(other))
    if (mode === 'bound-last') second.sourceEffectTag = input.sourceEffectTag
    const selections = [
      { ownerId: character.id, instanceId: entry.instanceId, quantity: 1, expectedInventoryRevision: input.expectedInventoryRevision, splitInstanceId: 'first-split' },
      { ownerId: different ? other.id : character.id, instanceId: mode === 'duplicate' ? entry.instanceId : second.instanceId, quantity: 2,
        expectedInventoryRevision: input.expectedInventoryRevision + (mode === 'stale-last' ? 1 : 0), splitInstanceId: 'second-split' },
    ]
    const before = structuredClone(roster)
    const result = alterDnd5eInventoryItemBatch(roster, { selections, quantity: mode === 'wrong-total' ? 2 : 3,
      originalTemplateIds: mode === 'wrong-template' ? ['missing'] : [entry.templateId], alteration: input })
    expect(result.ok).toBe(mode === 'same-owner' || mode === 'different-owner')
    expect(roster).toEqual(before)
    if (!result.ok) { expect(result).not.toHaveProperty('characters'); return }
    expect(result.instances).toHaveLength(2)
    expect(result.characters.flatMap(c => c.dnd5eInventory!.entries).filter(e => e.spellAlteration).reduce((n,e) => n+e.quantity,0)).toBe(3)
    const restored = expireDnd5eSourceBoundInventoryRoster(result.characters)
    expect(restored.flatMap(c => c.dnd5eInventory!.entries).every(e => !e.spellAlteration)).toBe(true)
    expect(restored.flatMap(c => c.dnd5eInventory!.entries).reduce((n,e) => n+e.quantity,0))
      .toBe(before.flatMap(c => c.dnd5eInventory!.entries).reduce((n,e) => n+e.quantity,0))
  })

function fixture() {
  const owner = normalizeCharacter({ id: 'owner', name: 'Owner' })
  const granted = applyDnd5eInventoryMutation([owner], { type: 'grant', characterId: owner.id, templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 5 })
  if (!granted.ok) throw new Error('Fixture grant failed')
  const character = granted.characters[0]
  const entry = character.dnd5eInventory!.entries.find(value => value.templateId === 'srd-5.1:item:gold-dust-25gp')!
  return { character, entry, input: { expectedInventoryRevision: character.dnd5eInventory!.revision ?? 0, instanceId: entry.instanceId,
    quantity: 3, splitInstanceId: 'altered-three', replacement: { ...entry.item, id: 'synthetic:altered', name: 'Altered material' },
    sourceEffectTag: 'item-lease:11111111-1111-1111-1111-111111111111', sourceEffectOwnerId: character.id, sourceSpellcastingModifier: 4 } }
}

it('splits selected units, preserves unselected objects, and restores after durable round-trip without duplicating quantity', () => {
  const { character, entry, input } = fixture(), before = structuredClone(character)
  const changed = alterDnd5eInventoryItem(character, input)
  expect(changed.ok).toBe(true)
  if (!changed.ok) throw new Error(changed.reason)
  expect(changed.character.dnd5eInventory!.entries.find(value => value.instanceId === entry.instanceId)!.quantity).toBe(2)
  const loaded = JSON.parse(JSON.stringify(changed.character)) as typeof character
  loaded.dnd5eInventory = normalizeDnd5eInventory(loaded)
  const restored = restoreDnd5eInventoryItem(loaded, changed.instanceId, input.sourceEffectTag)
  expect(restored.ok).toBe(true)
  if (!restored.ok) throw new Error(restored.reason)
  const recovered = restored.character.dnd5eInventory!.entries.find(value => value.instanceId === changed.instanceId)!
  expect(recovered.templateId).toBe(entry.templateId)
  expect(recovered.quantity).toBe(3)
  expect(recovered.spellAlteration).toBeUndefined()
  expect(recovered.sourceEffectTag).toBeUndefined()
  expect(restored.character.dnd5eInventory!.entries.filter(value => value.templateId === entry.templateId).reduce((sum, value) => sum + value.quantity, 0)).toBe(5)
  expect(restoreDnd5eInventoryItem(restored.character, changed.instanceId, input.sourceEffectTag).ok).toBe(false)
  expect(alterDnd5eInventoryItem(changed.character, input)).toEqual({ ok: false, reason: 'stale-inventory-revision' })
  expect(character).toEqual(before)
})

it.each(['stale', 'quantity', 'duplicate-split', 'non-stackable', 'modifier', 'resource'] as const)('rejects %s without modifying the input', mode => {
  const { character, input } = fixture()
  if (mode === 'stale') input.expectedInventoryRevision++
  if (mode === 'quantity') input.quantity = 6
  if (mode === 'duplicate-split') input.splitInstanceId = input.instanceId
  if (mode === 'non-stackable') input.replacement.stackable = false
  if (mode === 'modifier') input.sourceSpellcastingModifier = 100
  if (mode === 'resource') character.dnd5eInventory!.entries.find(value => value.instanceId === input.instanceId)!.remainingCharges = 1
  const before = structuredClone(character)
  expect(alterDnd5eInventoryItem(character, input).ok).toBe(false)
  expect(character).toEqual(before)
})


it('retains original identity through real transfer and restores in the current holder when the source ends', () => {
  const { character, entry, input } = fixture()
  const changed = alterDnd5eInventoryItem(character, input)
  if (!changed.ok) throw new Error(changed.reason)
  const holder = normalizeCharacter({ id: 'holder', name: 'Holder' })
  const transferred = applyDnd5eInventoryMutation([changed.character, holder], { type: 'transfer', characterId: character.id,
    targetCharacterId: holder.id, instanceId: changed.instanceId, quantity: 3 })
  expect(transferred.ok).toBe(true)
  const held = transferred.characters[1].dnd5eInventory!.entries.find(value => value.instanceId === changed.instanceId)!
  expect(held.spellAlteration!.original.templateId).toBe(entry.templateId)
  expect(held.quantity).toBe(3)
  // Omitting the source owner is unknown, not proof that its effect ended.
  expect(expireDnd5eSourceBoundInventoryRoster([transferred.characters[1]])[0]).toEqual(transferred.characters[1])
  const expired = expireDnd5eSourceBoundInventoryRoster(transferred.characters)
  const recovered = expired[1].dnd5eInventory!.entries.find(value => value.instanceId === changed.instanceId)!
  expect(recovered.templateId).toBe(entry.templateId)
  expect(recovered.quantity).toBe(3)
  expect(recovered.spellAlteration).toBeUndefined()
  expect(expired[0].dnd5eInventory!.entries.find(value => value.instanceId === entry.instanceId)!.quantity).toBe(2)
  expect(expireDnd5eSourceBoundInventoryRoster(expired)).toEqual(expired)
})

it('keeps released ordinary objects outside usable inventory through normalization and releases the final unit once', () => {
  const { character, input } = fixture()
  const changed = alterDnd5eInventoryItem(character, input)
  if (!changed.ok) throw new Error(changed.reason)
  let current = changed.character
  for (let index = 0; index < 3; index++) {
    const released = releaseDnd5eAlteredProjectile(current, changed.instanceId)
    if (!released.ok) throw new Error(released.reason)
    current = JSON.parse(JSON.stringify(released.character)) as typeof character
    current.dnd5eInventory = normalizeDnd5eInventory(current)
    expect(current.dnd5eInventory.releasedObjects).toHaveLength(index + 1)
    expect(current.dnd5eInventory.entries.find(entry => entry.instanceId === changed.instanceId)?.quantity ?? 0).toBe(2 - index)
  }
  expect(new Set(current.dnd5eInventory!.releasedObjects!.map(entry => entry.instanceId)).size).toBe(3)
  expect(current.dnd5eInventory!.releasedObjects!.every(entry => !entry.sourceEffectTag && !entry.spellAlteration && !entry.equippedSlot)).toBe(true)
  expect(releaseDnd5eAlteredProjectile(current, changed.instanceId).ok).toBe(false)
  expect(expireDnd5eSourceBoundInventoryRoster([current])[0].dnd5eInventory!.releasedObjects).toEqual(current.dnd5eInventory!.releasedObjects)
})
