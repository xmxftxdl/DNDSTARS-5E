import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { DND5E_LONGBOW } from './equipment'
import { applyDnd5eInventoryMutation } from './items'
import { applyDnd5eCounterattackInventoryCosts } from './counterattackInventory'
import type { Dnd5eCombatEvent } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import type { BattleMap } from '../../store/maps'

function fixture() {
  const base = normalizeCharacter({ id: 'hunter', name: 'Hunter', charClass: '游侠', level: 15,
    equipment: { mainWeapon: DND5E_LONGBOW } })
  return applyDnd5eInventoryMutation([base], {
    type: 'grant', characterId: base.id, templateId: 'srd-5.1:item:arrows', quantity: 2,
  }).characters[0]
}
const count = (character: ReturnType<typeof fixture>) => character.dnd5eInventory?.entries
  .filter(entry => entry.item.ammunitionKind === 'arrow').reduce((sum, entry) => sum + entry.quantity, 0) ?? 0
const event = (hit: boolean, index = 0): Dnd5eCombatEvent => ({
  type: 'saving-throw-counterattack-resolved', actorId: 'hunter-token', targetId: 'source', index,
  weaponId: DND5E_LONGBOW.id, attackMade: true, hit, thrown: false,
})
const bindings = { 'hunter-token': 'hunter' }

it.each([true, false])('projects one arrow for a real counterattack, hit=%s', hit => {
  const character = fixture(), before = structuredClone(character)
  const projected = applyDnd5eCounterattackInventoryCosts(character, [event(hit)], bindings)
  expect(count(projected)).toBe(count(character) - 1)
  expect(character).toEqual(before)
  expect(applyDnd5eCounterattackInventoryCosts(character, [event(hit)], bindings)).toEqual(projected)
})
it('does not charge an unmade attack or another character and rejects duplicate costs', () => {
  const character = fixture()
  expect(applyDnd5eCounterattackInventoryCosts(character, [{ ...event(false), attackMade: false } as Dnd5eCombatEvent], bindings)).toBe(character)
  expect(applyDnd5eCounterattackInventoryCosts(character, [event(false)], {})).toBe(character)
  expect(() => applyDnd5eCounterattackInventoryCosts(character, [event(false), event(false)], bindings)).toThrow('duplicate-counterattack')
})
it('rejects insufficient ammunition without mutating the parent inventory', () => {
  const character = fixture(), before = structuredClone(character)
  expect(() => applyDnd5eCounterattackInventoryCosts(character, [event(false, 0), event(false, 1), event(false, 2)], bindings)).toThrow('ammunition-unavailable')
  expect(character).toEqual(before)
})
it('includes a cost-only counterattack inventory patch in the parent map plan', () => {
  const character = fixture()
  const map: BattleMap = { id: 'counter-map', name: 'Counter', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'hunter-token', characterId: character.id, type: 'player', label: 'Hunter',
      x: 25, y: 25, size: 1, color: '', emoji: '' }] }
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'counter', round: 1, map, characters: [character],
    initiativeOrder: [{ tokenId: 'hunter-token', label: 'Hunter', roll: 10, emoji: '', color: '' }] })
  const plan = planDnd5eMapResultApplication({ ...snapshot, map, characters: [character], events: [event(false)] })
  expect(count(plan.characters[0])).toBe(count(character) - 1)
  expect(plan.changedCharacterIds).toContain(character.id)
  expect(plan.characterPatches?.[character.id]?.dnd5eInventory).toEqual(plan.characters[0].dnd5eInventory)
  expect(count(character)).toBe(2)
})
