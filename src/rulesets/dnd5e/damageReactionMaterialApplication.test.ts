import { expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation } from './items'
import { dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'
import { createDnd5eDamageReactionMaterialLedger } from './damageReactionMaterialLedger'
import { mergeDnd5eReactionMaterialsIntoMapPlan } from './damageReactionMaterialApplication'
import type { Dnd5eMapResultPlan } from './mapBridge'

function fixture() {
  const initial = normalizeCharacter({ id: 'mage', name: 'Mage', charClass: '法师', level: 3, currentHp: 20, maxHp: 20 })
  const granted = applyDnd5eInventoryMutation([initial], { type: 'grant', characterId: initial.id, templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 1 })
  if (!granted.ok) throw new Error('Fixture grant failed')
  const character = granted.characters[0]
  const ledger = createDnd5eDamageReactionMaterialLedger({ token: character })
  const material = dnd5eSpellMaterialConsumptionPlan(character, { label: 'Powder', options: [{ label: 'Powder', components: [{ tag: 'gold-dust', label: 'Powder', quantity: 1, consumed: true }] }] })!
  ledger.settle('checkpoint', 'token', material)
  const application: Dnd5eMapResultPlan = { map: { id: 'map', tokens: [] } as unknown as BattleMap,
    characters: [{ ...character, currentHp: 18, classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 2 } } }],
    changedCharacterIds: [], changedTokenIds: [], characterPatches: { mage: { currentHp: 18, classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 2 } } } } }
  return { application, changes: ledger.finish(), materialId: material.allocations[0].instanceId }
}

it('adds material-only owners to the atomic patch without replacing HP or slot changes', () => {
  const { application, changes, materialId } = fixture(), before = structuredClone(application)
  const merged = mergeDnd5eReactionMaterialsIntoMapPlan(application, changes)
  expect(merged.changedCharacterIds).toEqual(['mage'])
  expect(merged.characterPatches?.mage).toMatchObject({ currentHp: 18, classResources: { 'dnd5e-spell-slot-1': { current: 0 } } })
  expect(merged.characters[0].dnd5eInventory!.entries.some(entry => entry.instanceId === materialId)).toBe(false)
  expect(merged.characterPatches?.mage.dnd5eInventory).toEqual(merged.characters[0].dnd5eInventory)
  expect(application).toEqual(before)
  expect(() => mergeDnd5eReactionMaterialsIntoMapPlan(merged, changes)).toThrow('application-conflict')
})

it.each(['revision', 'quantity', 'equipment', 'missing-owner', 'duplicate-owner'] as const)('rejects %s conflicts without partially modifying the application', mode => {
  const { application, changes } = fixture()
  if (mode === 'revision') application.characters[0].dnd5eInventory!.revision!++
  if (mode === 'quantity') application.characters[0].dnd5eInventory!.entries[0].quantity++
  if (mode === 'equipment') application.characters[0].equipment = {}
  if (mode === 'missing-owner') application.characters = []
  const before = structuredClone(application)
  expect(() => mergeDnd5eReactionMaterialsIntoMapPlan(application, mode === 'duplicate-owner' ? [...changes, ...changes] : changes)).toThrow(/reaction-material-/)
  expect(application).toEqual(before)
})
