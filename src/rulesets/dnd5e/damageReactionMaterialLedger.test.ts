import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation } from './items'
import { dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'
import { createDnd5eDamageReactionMaterialLedger } from './damageReactionMaterialLedger'

function fixture() {
  const character = normalizeCharacter({ id: 'mage', name: 'Mage', charClass: '法师', level: 3 })
  const granted = applyDnd5eInventoryMutation([character], { type: 'grant', characterId: character.id, templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 2 })
  if (!granted.ok) throw new Error('fixture material grant failed')
  return granted.characters[0]
}
const requirement = { label: 'Synthetic powder', options: [{ label: 'Powder', components: [{ tag: 'gold-dust', label: 'Powder', quantity: 1, minimumUnitValueGp: 25, consumed: true }] }] }

it('shares inventory across tokens, deduplicates replay receipts and emits only one final inventory change', () => {
  const character = fixture(), before = structuredClone(character)
  const ledger = createDnd5eDamageReactionMaterialLedger({ first: character, second: structuredClone(character) })
  const first = dnd5eSpellMaterialConsumptionPlan(ledger.character('first')!, requirement)!
  ledger.settle('checkpoint-1', 'first', first)
  ledger.settle('checkpoint-1', 'first', structuredClone(first))
  const materialId = first.allocations[0].instanceId
  expect(ledger.character('second')!.dnd5eInventory!.entries.find(entry => entry.instanceId === materialId)!.quantity).toBe(1)
  expect(() => ledger.settle('checkpoint-2', 'second', first)).toThrow('stale-inventory-revision')
  const second = dnd5eSpellMaterialConsumptionPlan(ledger.character('second')!, requirement)!
  ledger.settle('checkpoint-2', 'second', second)
  expect(() => ledger.settle('checkpoint-1', 'first', second)).toThrow('receipt-conflict')
  const changes = ledger.finish()
  expect(changes).toHaveLength(1)
  expect(changes[0].inventory!.entries).toEqual(character.dnd5eInventory!.entries.filter(entry => entry.instanceId !== materialId))
  expect(changes[0].expectedInventoryRevision).toBe(character.dnd5eInventory!.revision)
  expect(changes[0].beforeInventory).toEqual(character.dnd5eInventory)
  expect(character).toEqual(before)
  expect(() => ledger.finish()).toThrow('ledger-ended')
})

it('cancels staged consumption without publishing and rejects conflicting owner snapshots', () => {
  const character = fixture(), before = structuredClone(character)
  const ledger = createDnd5eDamageReactionMaterialLedger({ token: character })
  ledger.settle('checkpoint', 'token', dnd5eSpellMaterialConsumptionPlan(character, requirement)!)
  ledger.cancel()
  expect(() => ledger.finish()).toThrow('ledger-ended')
  expect(character).toEqual(before)
  const conflicting = structuredClone(character)
  conflicting.dnd5eInventory!.revision = (conflicting.dnd5eInventory!.revision ?? 0) + 1
  expect(() => createDnd5eDamageReactionMaterialLedger({ first: character, second: conflicting })).toThrow('snapshot-conflict')
})

it('produces no write for retained materials and does not pretend to support spell-end escrow', () => {
  const character = fixture()
  const ledger = createDnd5eDamageReactionMaterialLedger({ token: character })
  const retained = structuredClone(requirement)
  retained.options[0].components[0].consumed = false
  ledger.settle('retained', 'token', dnd5eSpellMaterialConsumptionPlan(character, retained)!)
  const escrow = { ...dnd5eSpellMaterialConsumptionPlan(character, requirement)!, consumptionTiming: 'spell-end' as const }
  expect(() => ledger.settle('escrow', 'token', escrow)).toThrow('material-unavailable')
  expect(ledger.finish()).toEqual([])
})
