import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { Character } from '../../types/character'
import { dnd5eAttackRollRerollCandidates } from './inventoryHeadlessEffects'

function hero(current: number): Character {
  return normalizeCharacter({
    id: 'hero', name: '英雄', player: '玩家', charClass: '战士', level: 1, maxHp: 12, currentHp: 12,
    equipment: { mainWeapon: { id: 'plugin:blade', name: '命运刃', slot: 'mainWeapon', dnd5e: { kind: 'weapon', category: 'martial', mode: 'melee', damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str' } } },
    dnd5eInventory: {
      schemaVersion: 2,
      entries: [{
        instanceId: 'blade-1', templateId: 'plugin:blade', quantity: 1, acquiredAt: 1, equippedSlot: 'mainWeapon',
        item: {
          id: 'plugin:blade', name: '命运刃', category: 'equipment', icon: 'weapon', description: '测试', rulesText: '测试', stackable: false,
          equipment: { id: 'plugin:blade', name: '命运刃', slot: 'mainWeapon', dnd5e: { kind: 'weapon', category: 'martial', mode: 'melee', damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str' } },
          resources: [{ id: 'charges', label: '充能', maximum: 4, resetOn: 'dawn' }],
          headlessEffects: [{ kind: 'attack-roll-reroll', resourceId: 'charges', maximumDice: 1, trigger: 'after-attack-roll', appliesTo: 'attacks-with-this-weapon' }],
          source: { book: '测试', license: 'CC0' },
        },
        resources: { charges: { id: 'charges', label: '充能', current, maximum: 4, resetOn: 'dawn' } },
      }],
    },
  })
}

describe('inventory Headless effects', () => {
  it('offers an equipped matching weapon with a non-zero resource', () => {
    expect(dnd5eAttackRollRerollCandidates(hero(4), 'plugin:blade')).toEqual([
      expect.objectContaining({ instanceId: 'blade-1', itemName: '命运刃', resource: expect.objectContaining({ current: 4 }) }),
    ])
  })

  it('does not offer a depleted resource or a different weapon', () => {
    expect(dnd5eAttackRollRerollCandidates(hero(0), 'plugin:blade')).toEqual([])
    expect(dnd5eAttackRollRerollCandidates(hero(4), 'plugin:other')).toEqual([])
  })
})
