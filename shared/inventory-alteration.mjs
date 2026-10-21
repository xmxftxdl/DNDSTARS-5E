const plain = value => value != null && typeof value === 'object' && !Array.isArray(value)
const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 300
const physical = entry => plain(entry) && id(entry.instanceId) && id(entry.templateId) &&
  Number.isSafeInteger(entry.quantity) && entry.quantity > 0 && plain(entry.item) && entry.item.id === entry.templateId

/** Validate only the new Host-owned fields; legacy inventories remain readable. */
export function inventoryAlterationIssue(inventory) {
  if (inventory == null) return null
  if (!plain(inventory)) return 'invalid-inventory'
  for (const entry of Array.isArray(inventory.entries) ? inventory.entries : []) {
    if (entry?.spellAlteration == null) continue
    const record = entry.spellAlteration
    if (!physical(entry) || !plain(record) || !id(record.sourceEffectTag) || !record.sourceEffectTag.startsWith('item-lease:') ||
        !id(record.sourceEffectOwnerId) || record.sourceEffectTag !== entry.sourceEffectTag || record.sourceEffectOwnerId !== entry.sourceEffectOwnerId ||
        !physical(record.original) || record.original.spellAlteration != null || record.original.sourceEffectTag != null ||
        record.original.quantity < entry.quantity) return 'invalid-item-alteration'
  }
  if (inventory.releasedObjects != null) {
    if (!Array.isArray(inventory.releasedObjects) || !Array.isArray(inventory.entries)) return 'invalid-released-objects'
    const ids = new Set((inventory.entries ?? []).map(entry => entry?.instanceId))
    for (const entry of inventory.releasedObjects) {
      if (!physical(entry) || entry.spellAlteration != null || entry.sourceEffectTag != null || entry.equippedSlot != null ||
          entry.containerInstanceId != null || ids.has(entry.instanceId)) return 'invalid-released-object'
      ids.add(entry.instanceId)
    }
  }
  return null
}
