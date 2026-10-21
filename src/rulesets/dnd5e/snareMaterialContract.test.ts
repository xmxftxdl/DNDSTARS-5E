import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eSpellMaterialConsumption, dnd5eSpellMaterialConsumptionPlan, type Dnd5eSpellMaterialRequirement } from './spellMaterials'

// Synthetic module material: one explicitly tagged, measured 25-foot piece, not an inferred fraction of a coil.
const requirement: Dnd5eSpellMaterialRequirement = { label: '25-foot rope segment', options: [{ label: 'Rope',
  components: [{ tag: 'test.snare:rope-25-feet', label: '25-foot rope segment', quantity: 1, consumed: true }] }] }
function caster(tagged = true) {
  return normalizeCharacter({ id: 'caster', name: 'Caster', charClass: '法师', level: 3, maxHp: 20, currentHp: 20,
    dnd5eInventory: { schemaVersion: 3, revision: 0, entries: [{ instanceId: 'rope', templateId: 'test.snare:rope', quantity: 2, acquiredAt: 1,
      item: { id: 'test.snare:rope', name: '25-foot rope segment', category: 'adventuring-gear', icon: 'generic', stackable: true,
        description: 'Synthetic material fixture', rulesText: '', source: { book: 'Synthetic', license: 'Test' },
        ...(tagged ? { spellcastingMaterial: { tags: ['test.snare:rope-25-feet'], unitValueGp: 0 } } : {}) } }] } })
}

it('consumes one measured piece, preserves the remainder after reload, and rejects replay', () => {
  const actor = caster(), plan = dnd5eSpellMaterialConsumptionPlan(actor, requirement)!
  expect(plan.allocations).toMatchObject([{ instanceId: 'rope', quantity: 1, consumed: true }])
  const settled = applyDnd5eSpellMaterialConsumption(actor, plan)
  expect(settled.ok).toBe(true)
  const restored = normalizeCharacter(JSON.parse(JSON.stringify(settled.character)))
  expect(restored.dnd5eInventory?.entries[0].quantity).toBe(1)
  expect(applyDnd5eSpellMaterialConsumption(restored, plan)).toMatchObject({ ok: false, reason: 'stale-inventory-revision' })
  expect(actor.dnd5eInventory?.entries[0].quantity).toBe(2)
})

it('does not infer material identity or length from an item name', () => {
  expect(dnd5eSpellMaterialConsumptionPlan(caster(false), requirement)).toBeUndefined()
  const actor = caster()
  actor.dnd5eInventory!.entries = []
  expect(dnd5eSpellMaterialConsumptionPlan(actor, requirement)).toBeUndefined()
})
