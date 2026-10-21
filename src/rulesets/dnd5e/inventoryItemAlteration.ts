import type { Character } from '../../types/character'
import type { Dnd5eInventoryEntry, Dnd5eInventoryItemTemplate } from '../../types/inventory'

type Result = { ok: true; character: Character; instanceId: string } | { ok: false; reason: string }

/** Host-only batch primitive. Callers authorize every owner and physical reach
 * before entering here. All revisions refer to the same pre-action snapshot;
 * no partial roster is published if a later selection fails. */
export function alterDnd5eInventoryItemBatch(characters: readonly Character[], input: {
  quantity: number
  originalTemplateIds: readonly string[]
  selections: readonly { ownerId: string; instanceId: string; quantity: number; expectedInventoryRevision: number; splitInstanceId?: string }[]
  alteration: Omit<Parameters<typeof alterDnd5eInventoryItem>[1], 'quantity' | 'instanceId' | 'expectedInventoryRevision' | 'splitInstanceId'>
}): { ok: true; characters: Character[]; instances: { ownerId: string; instanceId: string }[] } | { ok: false; reason: string } {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || !input.selections.length ||
      input.selections.length > input.quantity || input.selections.some(selection => !Number.isSafeInteger(selection.quantity) || selection.quantity < 1) ||
      input.selections.reduce((total, selection) => total + selection.quantity, 0) !== input.quantity)
    return { ok: false, reason: 'invalid-quantity' }
  const identities = new Set<string>()
  for (const selection of input.selections) {
    const identity = JSON.stringify([selection.ownerId, selection.instanceId])
    if (identities.has(identity)) return { ok: false, reason: 'duplicate-item-selection' }
    identities.add(identity)
    const owners = characters.filter(character => character.id === selection.ownerId)
    if (owners.length !== 1) return { ok: false, reason: 'item-owner-unavailable' }
    const inventory = owners[0].dnd5eInventory
    if (!inventory || !Number.isSafeInteger(selection.expectedInventoryRevision) || (inventory.revision ?? 0) !== selection.expectedInventoryRevision)
      return { ok: false, reason: 'stale-inventory-revision' }
    const matches = inventory.entries.filter(entry => entry.instanceId === selection.instanceId)
    if (matches.length !== 1 || !input.originalTemplateIds.includes(matches[0].templateId))
      return { ok: false, reason: 'item-not-found' }
  }
  let staged = [...characters]
  const instances: { ownerId: string; instanceId: string }[] = []
  for (const selection of input.selections) {
    const owner = staged.find(character => character.id === selection.ownerId)!
    if (selection.splitInstanceId && staged.some(character => character.dnd5eInventory?.entries.some(entry => entry.instanceId === selection.splitInstanceId)))
      return { ok: false, reason: 'split-instance-required' }
    const result = alterDnd5eInventoryItem(owner, { ...input.alteration, ...selection,
      expectedInventoryRevision: owner.dnd5eInventory!.revision ?? 0 })
    if (!result.ok) return result
    staged = staged.map(character => character.id === owner.id ? result.character : character)
    instances.push({ ownerId: owner.id, instanceId: result.instanceId })
  }
  return { ok: true, characters: staged, instances }
}

/** Pure Host primitive. The caller must authorize the selected object/template,
 * bind an actual effect for reversible alterations, and commit the returned
 * roster under its original CAS. Permanent conversion never creates a lease. */
export function alterDnd5eInventoryItem(character: Character, input: {
  expectedInventoryRevision: number
  instanceId: string
  quantity: number
  replacement: Dnd5eInventoryItemTemplate
  sourceEffectTag?: string
  sourceEffectOwnerId?: string
  permanent?: true
  splitInstanceId?: string
  sourceSpellcastingModifier?: number
}): Result {
  const inventory = character.dnd5eInventory
  if (!inventory || (inventory.revision ?? 0) !== input.expectedInventoryRevision) return { ok: false, reason: 'stale-inventory-revision' }
  const matches = inventory.entries.filter(entry => entry.instanceId === input.instanceId)
  if (matches.length !== 1) return { ok: false, reason: 'item-not-found' }
  const original = matches[0]
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > original.quantity) return { ok: false, reason: 'invalid-quantity' }
  if (!input.replacement.id || (input.permanent === true
    ? input.sourceEffectTag != null || input.sourceEffectOwnerId != null || input.sourceSpellcastingModifier != null
    : !input.sourceEffectTag?.startsWith('item-lease:') || !input.sourceEffectOwnerId?.trim())) return { ok: false, reason: 'invalid-binding' }
  if (original.spellAlteration || original.sourceEffectTag || original.linkedSpellAuthorityRecordId || original.linkedSpellFocusAuthorityRecordId)
    return { ok: false, reason: 'item-already-bound' }
  // Resource-bearing/container transformations need explicit capacity/recovery semantics.
  if (original.condition?.destroyed || original.item.category === 'container' || input.replacement.category === 'container' ||
      Object.keys(original.resources ?? {}).length || original.remainingCharges != null || original.attuned || original.attunementPending)
    return { ok: false, reason: 'unsupported-item-state' }
  // A permanent conversion cannot launder an expiring, released or inaccessible
  // object into permanent usable stock, or invent resource recovery semantics.
  if (input.permanent && (original.expiresAtWorldMinute != null || original.releasedByCharacterId != null ||
      original.planarState === 'ethereal' || input.replacement.resources?.length))
    return { ok: false, reason: 'unsupported-item-state' }
  if (input.quantity > 1 && !input.replacement.stackable) return { ok: false, reason: 'replacement-not-stackable' }
  if (input.sourceSpellcastingModifier != null && (!Number.isInteger(input.sourceSpellcastingModifier) || input.sourceSpellcastingModifier < -5 || input.sourceSpellcastingModifier > 10))
    return { ok: false, reason: 'invalid-source-modifier' }
  const split = input.quantity !== original.quantity
  if (split && (!input.splitInstanceId?.trim() || inventory.entries.some(entry => entry.instanceId === input.splitInstanceId)))
    return { ok: false, reason: 'split-instance-required' }
  if (split && original.equippedSlot) return { ok: false, reason: 'split-equipped-item' }
  const instanceId = split ? input.splitInstanceId! : original.instanceId
  const altered: Dnd5eInventoryEntry = {
    ...structuredClone(original), instanceId, quantity: input.quantity,
    templateId: input.replacement.id, item: structuredClone(input.replacement), equippedSlot: undefined,
    resources: undefined, remainingCharges: undefined, condition: undefined, identified: true,
    sourceEffectTag: input.sourceEffectTag, sourceEffectOwnerId: input.sourceEffectOwnerId,
    sourceSpellcastingModifier: input.sourceSpellcastingModifier,
    spellAlteration: input.permanent ? undefined : { sourceEffectTag: input.sourceEffectTag!, sourceEffectOwnerId: input.sourceEffectOwnerId!, original: structuredClone(original) },
  }
  const entries = inventory.entries.flatMap(entry => entry.instanceId !== original.instanceId ? [entry]
    : split ? [{ ...entry, quantity: entry.quantity - input.quantity }, altered] : [altered])
  const equipment = original.equippedSlot && !split
    ? Object.fromEntries(Object.entries(character.equipment ?? {}).filter(([slot]) => slot !== original.equippedSlot)) : character.equipment
  return { ok: true, instanceId, character: { ...character, equipment,
    dnd5eInventory: { ...inventory, revision: (inventory.revision ?? 0) + 1, entries } } }
}

/** Preserve the current holder, quantity and container; never restore an old
 * equip slot or the full quantity from the original pre-split stack. */
export function restoreDnd5eInventoryItem(character: Character, instanceId: string, sourceEffectTag: string): Result {
  const inventory = character.dnd5eInventory
  const entry = inventory?.entries.find(candidate => candidate.instanceId === instanceId)
  const alteration = entry?.spellAlteration
  if (!inventory || !entry || !alteration || alteration.sourceEffectTag !== sourceEffectTag || entry.sourceEffectTag !== sourceEffectTag)
    return { ok: false, reason: 'alteration-not-found' }
  const original: Dnd5eInventoryEntry = { ...structuredClone(alteration.original), instanceId: entry.instanceId,
    quantity: entry.quantity, containerInstanceId: entry.containerInstanceId, equippedSlot: undefined, acquiredAt: entry.acquiredAt }
  const equipment = entry.equippedSlot ? Object.fromEntries(Object.entries(character.equipment ?? {}).filter(([slot]) => slot !== entry.equippedSlot)) : character.equipment
  return { ok: true, instanceId, character: { ...character, equipment,
    dnd5eInventory: { ...inventory, revision: (inventory.revision ?? 0) + 1,
      entries: inventory.entries.map(candidate => candidate.instanceId === instanceId ? original : candidate) } } }
}

/** End magic on exactly one thrown object without returning it to usable stock. */
export function releaseDnd5eAlteredProjectile(character: Character, instanceId: string): Result {
  const inventory = character.dnd5eInventory
  const entry = inventory?.entries.find(candidate => candidate.instanceId === instanceId)
  if (!inventory || !entry?.spellAlteration || entry.spellAlteration.sourceEffectTag !== entry.sourceEffectTag ||
      !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) return { ok: false, reason: 'alteration-not-found' }
  const releasedId = `released:${entry.instanceId}:${inventory.revision ?? 0}`
  if (inventory.entries.some(candidate => candidate.instanceId === releasedId) || inventory.releasedObjects?.some(candidate => candidate.instanceId === releasedId))
    return { ok: false, reason: 'released-instance-conflict' }
  const original: Dnd5eInventoryEntry = { ...structuredClone(entry.spellAlteration.original), instanceId: releasedId,
    quantity: 1, containerInstanceId: undefined, equippedSlot: undefined, acquiredAt: entry.acquiredAt }
  const equipment = entry.quantity === 1 && entry.equippedSlot
    ? Object.fromEntries(Object.entries(character.equipment ?? {}).filter(([slot]) => slot !== entry.equippedSlot)) : character.equipment
  return { ok: true, instanceId: releasedId, character: { ...character, equipment, dnd5eInventory: {
    ...inventory, revision: (inventory.revision ?? 0) + 1,
    entries: inventory.entries.flatMap(candidate => candidate.instanceId !== instanceId ? [candidate]
      : candidate.quantity > 1 ? [{ ...candidate, quantity: candidate.quantity - 1 }] : []),
    releasedObjects: [...(inventory.releasedObjects ?? []), original],
  } } }
}
