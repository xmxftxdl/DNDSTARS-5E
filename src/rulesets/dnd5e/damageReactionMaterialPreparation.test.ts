import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation } from './items'
import { dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'
import { reserveDnd5eSpellMaterials, dnd5eSpellMaterialEscrowBinding } from './spellMaterialEscrow'
import { prepareDnd5eDamageReactionMaterialCharacters } from './damageReactionMaterialPreparation'

function fixture() {
  const original = normalizeCharacter({ id: 'mage', name: 'Mage', charClass: '法师', level: 3 })
  const grant = applyDnd5eInventoryMutation([original], { type: 'grant', characterId: original.id,
    templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 2 })
  if (!grant.ok) throw new Error('Fixture grant failed')
  const actor = grant.characters[0]
  const plan = dnd5eSpellMaterialConsumptionPlan(actor, { label: 'Powder', options: [{ label: 'Powder', components: [
    { tag: 'gold-dust', label: 'Powder', quantity: 1, consumed: true },
  ] }] })!
  return { actor, plan }
}

it('reserves the primary cost for every token of that owner without consuming source inventory', () => {
  const { actor, plan } = fixture(), before = structuredClone(actor)
  const other = normalizeCharacter({ id: 'other', name: 'Other' })
  const prepared = prepareDnd5eDamageReactionMaterialCharacters({ first: actor, second: actor, other },
    { actor, characters: [actor, other], spellMaterialPlan: plan })
  for (const token of ['first', 'second']) {
    expect(prepared[token].dnd5eInventory!.revision).toBe((actor.dnd5eInventory!.revision ?? 0) + 1)
    expect(prepared[token].dnd5eInventory!.entries.find(entry => entry.instanceId === plan.allocations[0].instanceId)!.quantity).toBe(1)
  }
  expect(prepared.other).toEqual(other)
  expect(actor).toEqual(before)
  prepared.first.dnd5eInventory!.entries[0].quantity = 99
  expect(prepared.second).not.toEqual(prepared.first)
})

it('uses the owning prepared transaction inventory instead of a stale live roster', () => {
  const { actor } = fixture()
  const staged = structuredClone(actor)
  staged.dnd5eInventory!.revision = (staged.dnd5eInventory!.revision ?? 0) + 1
  expect(prepareDnd5eDamageReactionMaterialCharacters({ token: actor }, { characters: [staged] }).token).toEqual(staged)
})

it('rejects invalid primary plans and missing ownership before offering reactions', () => {
  const { actor, plan } = fixture(), before = structuredClone(actor)
  expect(() => prepareDnd5eDamageReactionMaterialCharacters({ token: actor }, { actor, spellMaterialPlan: plan })).toThrow('owner-required')
  expect(() => prepareDnd5eDamageReactionMaterialCharacters({ token: actor }, { actor, characters: [actor],
    spellMaterialPlan: { ...plan, expectedInventoryRevision: plan.expectedInventoryRevision + 1 } })).toThrow('stale-inventory-revision')
  expect(actor).toEqual(before)
})

it('does not turn a spell-end reservation into an immediate consumption', () => {
  const { actor, plan } = fixture()
  const endPlan = { ...plan, consumptionTiming: 'spell-end' as const }
  const prepared = { actor, characters: [actor], action: { id: 'cast' }, spell: { id: 'spell' }, spellMaterialPlan: endPlan }
  const reserved = prepareDnd5eDamageReactionMaterialCharacters({ token: actor }, prepared).token
  const primary = reserveDnd5eSpellMaterials(actor, endPlan, dnd5eSpellMaterialEscrowBinding('cast', 'spell'))
  expect(primary.ok).toBe(true)
  expect(reserved).toEqual(primary.character)
  expect(reserved.dnd5eInventory!.spellMaterialEscrows![0]).toMatchObject({ status: 'reserved', sourceEffectId: 'material-lifetime:cast' })
  expect(reserved.dnd5eInventory!.spellMaterialEscrows![0].entries[0].quantity).toBe(1)
  expect(actor.dnd5eInventory!.spellMaterialEscrows ?? []).toEqual([])
  expect(() => prepareDnd5eDamageReactionMaterialCharacters({ token: actor }, { actor, characters: [actor], spellMaterialPlan: endPlan })).toThrow('binding-required')
})
