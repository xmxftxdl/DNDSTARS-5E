import type { Character } from '../../types/character'
import type { Dnd5eSpellMaterialEscrow } from '../../types/inventory'
import { applyDnd5eSpellMaterialConsumption, type Dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'

type Result = { ok: true; character: Character } | { ok: false; character: Character; reason: string }

/** Shared binding for a primary cast and its transaction-local reservation. */
export function dnd5eSpellMaterialEscrowBinding(castId: string, spellId: string) {
  return { id: castId, sourceSpellId: spellId, sourceEffectId: `material-lifetime:${castId}` }
}

/** Inventory removal is a reservation, not destruction; the exact components remain in escrow. */
export function reserveDnd5eSpellMaterials(
  character: Character,
  plan: Dnd5eSpellMaterialConsumptionPlan,
  binding: Pick<Dnd5eSpellMaterialEscrow, 'id' | 'sourceSpellId' | 'sourceEffectId'>,
): Result {
  if ([binding.id, binding.sourceSpellId, binding.sourceEffectId].some(value => typeof value !== 'string' || !value.trim() || value.length > 300)) {
    return { ok: false, character, reason: 'invalid-material-binding' }
  }
  const inventory = character.dnd5eInventory
  const existing = inventory?.spellMaterialEscrows?.find(record => record.id === binding.id)
  if (existing) return existing.sourceEffectId === binding.sourceEffectId && existing.sourceSpellId === binding.sourceSpellId
    ? { ok: true, character }
    : { ok: false, character, reason: 'conflicting-material-binding' }
  const quantities = new Map<string, number>()
  for (const allocation of plan.allocations) {
    if (!Number.isSafeInteger(allocation.quantity) || allocation.quantity < 1) return { ok: false, character, reason: 'invalid-material-quantity' }
    if (allocation.consumed) quantities.set(allocation.instanceId, (quantities.get(allocation.instanceId) ?? 0) + allocation.quantity)
  }
  const settled = applyDnd5eSpellMaterialConsumption(character, { ...plan, consumptionTiming: 'cast' })
  if (!settled.ok) return settled
  if (!quantities.size) return { ok: true, character }
  const entries = [...quantities].map(([instanceId, quantity]) => ({
    ...structuredClone(inventory!.entries.find(entry => entry.instanceId === instanceId)!), quantity,
    equippedSlot: undefined, containerInstanceId: undefined,
  }))
  const record: Dnd5eSpellMaterialEscrow = { ...binding, label: plan.requirementLabel, status: 'reserved', entries }
  return { ok: true, character: { ...settled.character, dnd5eInventory: {
    ...settled.character.dnd5eInventory!, spellMaterialEscrows: [...(inventory?.spellMaterialEscrows ?? []), record],
  } } }
}

/** Called with a complete authoritative set, never with a player's visible effect projection. */
export function settleDnd5eEndedSpellMaterialEscrows(
  character: Character,
  liveEffectIds: ReadonlySet<string>,
): { character: Character; consumedEscrowIds: string[] } {
  const inventory = character.dnd5eInventory
  const consumedEscrowIds: string[] = []
  const records = inventory?.spellMaterialEscrows?.map(record => {
    if (record.status !== 'reserved' || liveEffectIds.has(record.sourceEffectId)) return record
    consumedEscrowIds.push(record.id)
    return { ...record, status: 'consumed' as const, entries: [] }
  })
  if (!consumedEscrowIds.length) return { character, consumedEscrowIds }
  return { character: { ...character, dnd5eInventory: { ...inventory!,
    revision: (inventory!.revision ?? 0) + 1, spellMaterialEscrows: records,
  } }, consumedEscrowIds }
}
