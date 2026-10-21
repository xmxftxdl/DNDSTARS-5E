import type { Character } from '../../types/character'
import { applyDnd5eSpellMaterialConsumption, type Dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'

export interface Dnd5eReactionMaterialChange {
  characterId: string
  expectedInventoryRevision: number
  beforeInventory: Character['dnd5eInventory']
  beforeEquipment: Character['equipment']
  inventory: Character['dnd5eInventory']
  equipment: Character['equipment']
}

/** Transaction-local only. Never publishes and never mutates source characters. */
export function createDnd5eDamageReactionMaterialLedger(charactersByCombatantId: Readonly<Record<string, Character>>) {
  const ownerByCombatant = new Map<string, string>()
  const original = new Map<string, Character>(), current = new Map<string, Character>()
  for (const [actorId, character] of Object.entries(charactersByCombatantId)) {
    const prior = original.get(character.id)
    if (prior && JSON.stringify(prior) !== JSON.stringify(character)) throw new Error('reaction-material-owner-snapshot-conflict')
    ownerByCombatant.set(actorId, character.id)
    original.set(character.id, structuredClone(character))
    current.set(character.id, structuredClone(character))
  }
  const receipts = new Map<string, string>()
  let ended = false
  const active = () => { if (ended) throw new Error('reaction-material-ledger-ended') }
  return {
    characters(): Readonly<Record<string, Character>> {
      active()
      return Object.fromEntries([...ownerByCombatant].map(([actorId, owner]) => [actorId, structuredClone(current.get(owner)!)]))
    },
    character(actorId: string): Character | undefined {
      active()
      const value = current.get(ownerByCombatant.get(actorId) ?? '')
      return value ? structuredClone(value) : undefined
    },
    settle(receiptId: string, actorId: string, plan: Dnd5eSpellMaterialConsumptionPlan): void {
      active()
      if (!receiptId.trim()) throw new Error('reaction-material-receipt-required')
      const owner = ownerByCombatant.get(actorId)
      const character = owner ? current.get(owner) : undefined
      if (!owner || !character) throw new Error('reaction-material-owner-missing')
      const signature = JSON.stringify({ owner, plan })
      if (receipts.has(receiptId)) {
        if (receipts.get(receiptId) !== signature) throw new Error('reaction-material-receipt-conflict')
        return
      }
      const settled = applyDnd5eSpellMaterialConsumption(character, plan)
      if (!settled.ok) throw new Error(`reaction-material-${settled.reason}`)
      current.set(owner, settled.character)
      receipts.set(receiptId, signature)
    },
    finish(): readonly Dnd5eReactionMaterialChange[] {
      active()
      ended = true
      return [...current].flatMap(([id, character]) => {
        const before = original.get(id)!
        if (JSON.stringify(character.dnd5eInventory) === JSON.stringify(before.dnd5eInventory) &&
            JSON.stringify(character.equipment) === JSON.stringify(before.equipment)) return []
        return [{ characterId: id, expectedInventoryRevision: before.dnd5eInventory?.revision ?? 0,
          beforeInventory: structuredClone(before.dnd5eInventory), beforeEquipment: structuredClone(before.equipment), inventory: structuredClone(character.dnd5eInventory), equipment: structuredClone(character.equipment) }]
      })
    },
    cancel() { ended = true; current.clear(); receipts.clear() },
  }
}
