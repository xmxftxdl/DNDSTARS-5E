import type { Dnd5eInventoryEntry } from '../../types/inventory'

/** Flat physical subtree. Every child must lead back to the one root container. */
export function normalizeDnd5eMapInventoryContents(root: Dnd5eInventoryEntry | undefined, value: unknown): Dnd5eInventoryEntry[] | undefined {
  if (value == null) return []
  if (!root || root.item.category !== 'container' || !Array.isArray(value) || value.length > 999) return undefined
  const entries = new Map<string, Dnd5eInventoryEntry>([[root.instanceId, root]])
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || typeof raw.instanceId !== 'string' || !raw.instanceId || raw.instanceId.length > 300 ||
      entries.has(raw.instanceId) || typeof raw.templateId !== 'string' || !raw.item || typeof raw.item !== 'object' ||
      !Number.isSafeInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 1000 || raw.equippedSlot ||
      typeof raw.containerInstanceId !== 'string') return undefined
    entries.set(raw.instanceId, raw)
  }
  for (const raw of value) {
    const seen = new Set<string>([raw.instanceId])
    let cursor = raw
    while (cursor.instanceId !== root.instanceId) {
      const parent = entries.get(cursor.containerInstanceId)
      if (!parent || parent.item.category !== 'container' || seen.has(parent.instanceId)) return undefined
      seen.add(parent.instanceId)
      cursor = parent
    }
  }
  return structuredClone(value) as Dnd5eInventoryEntry[]
}

export function dnd5eInventoryContainerContents(root: Dnd5eInventoryEntry, entries: readonly Dnd5eInventoryEntry[]): Dnd5eInventoryEntry[] {
  const ids = new Set([root.instanceId]), contents: Dnd5eInventoryEntry[] = []
  for (let changed = true; changed;) {
    changed = false
    for (const entry of entries) if (!ids.has(entry.instanceId) && entry.containerInstanceId && ids.has(entry.containerInstanceId)) {
      ids.add(entry.instanceId); contents.push(entry); changed = true
    }
  }
  return contents
}
