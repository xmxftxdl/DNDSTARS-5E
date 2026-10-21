import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation } from './items'
import { dnd5eInventoryPassiveEffects } from './inventoryPassiveEffects'
import { dnd5eInventoryHeadlessEffectSnapshots } from './inventoryHeadlessRuntime'
import { dnd5eEquippedEffectTotal } from './equipmentEffects'

it.each(['polymorph', 'true-polymorph', 'animal-shapes'] as const)('suspends merged equipment and item use in %s', wildShapeMode => {
  const initial = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '战士', level: 2, maxHp: 20, currentHp: 10 })
  const granted = applyDnd5eInventoryMutation([initial], { type: 'grant', characterId: initial.id,
    templateId: 'srd-5.1:item:potion-of-healing', quantity: 1 })
  expect(granted.ok).toBe(true)
  const hero = granted.characters[0]
  const entry = hero.dnd5eInventory!.entries[0]
  entry.equippedSlot = 'mainWeapon'
  entry.item = { ...entry.item, headlessEffects: [{ schemaVersion: 1, id: 'ward', kind: 'equipped-passive', modifiers: { armorClassBonus: 2 } }] }
  hero.equipment = { mainWeapon: { id: 'test-ward', name: 'Ward', slot: 'mainWeapon', effects: { savingThrowBonus: 2 } } }
  entry.templateId = 'test:ward'
  entry.item = { ...entry.item, id: 'test:ward', category: 'equipment', stackable: false,
    equipment: hero.equipment.mainWeapon }
  expect(dnd5eInventoryHeadlessEffectSnapshots(hero)).toHaveLength(1)
  const effects = dnd5eInventoryPassiveEffects(hero)
  expect(effects.some(effect => effect.id.startsWith('inventory-equipped-passive:'))).toBe(true)
  expect(dnd5eEquippedEffectTotal(hero, 'savingThrowBonus')).toBe(2)
  hero.dnd5eCombatState = { wildShapeFormId: 'srd-5.1:wolf', wildShapeMode, activeEffects: effects }
  expect(dnd5eInventoryPassiveEffects(hero).some(effect => effect.id.startsWith('inventory-equipped-passive:'))).toBe(false)
  expect(dnd5eInventoryHeadlessEffectSnapshots(hero)).toEqual([])
  expect(dnd5eEquippedEffectTotal(hero, 'savingThrowBonus')).toBe(0)
  const before = JSON.stringify(hero)
  expect(applyDnd5eInventoryMutation([hero], { type: 'use', characterId: hero.id, instanceId: entry.instanceId, healingRolls: [1, 1] }))
    .toMatchObject({ ok: false, reason: 'item-inactive' })
  expect(JSON.stringify(hero)).toBe(before)
  hero.dnd5eCombatState = undefined
  expect(dnd5eInventoryHeadlessEffectSnapshots(hero)).toHaveLength(1)
  expect(dnd5eEquippedEffectTotal(hero, 'savingThrowBonus')).toBe(2)
})
