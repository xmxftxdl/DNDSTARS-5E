import { describe, expect, it } from 'vitest'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import { dnd5eInventoryDropDecision } from './inventoryDragModel'

function equipmentEntry(slot: 'mainWeapon' | 'armor' | 'ring' | 'belt', identified = true): Dnd5eInventoryEntry {
  return {
    instanceId: `entry:${slot}`,
    templateId: `item:${slot}`,
    quantity: 1,
    acquiredAt: 1,
    identified,
    item: {
      id: `item:${slot}`,
      name: slot,
      category: 'equipment',
      icon: slot === 'armor' ? 'armor' : 'weapon',
      description: '',
      rulesText: '',
      stackable: false,
      equipment: { id: `item:${slot}`, name: slot, slot },
      source: { book: '测试', license: '测试' },
    },
  }
}

describe('inventory drag destinations', () => {
  it('only accepts equipment in its declared slot', () => {
    const sword = equipmentEntry('mainWeapon')
    expect(dnd5eInventoryDropDecision(sword, { kind: 'equipment', slot: 'mainWeapon' })).toEqual({
      accepted: true,
      action: 'equip',
    })
    expect(dnd5eInventoryDropDecision(sword, { kind: 'equipment', slot: 'armor' })).toMatchObject({ accepted: false })
    expect(dnd5eInventoryDropDecision(equipmentEntry('armor', false), { kind: 'equipment', slot: 'armor' })).toMatchObject({ accepted: false })
  })

  it('accepts any existing inventory instance in the seven quick slots', () => {
    expect(dnd5eInventoryDropDecision(equipmentEntry('mainWeapon'), { kind: 'quickbar', slotIndex: 6 })).toEqual({
      accepted: true,
      action: 'assign-quickbar',
    })
    expect(dnd5eInventoryDropDecision(equipmentEntry('mainWeapon'), { kind: 'quickbar', slotIndex: 7 })).toMatchObject({ accepted: false })
  })

  it('accepts a ring in either ring slot and a belt only in the belt slot', () => {
    const ring = equipmentEntry('ring')
    expect(dnd5eInventoryDropDecision(ring, { kind: 'equipment', slot: 'ring' })).toMatchObject({ accepted: true })
    expect(dnd5eInventoryDropDecision(ring, { kind: 'equipment', slot: 'ring2' })).toMatchObject({ accepted: true })
    expect(dnd5eInventoryDropDecision(ring, { kind: 'equipment', slot: 'belt' })).toMatchObject({ accepted: false })

    const belt = equipmentEntry('belt')
    expect(dnd5eInventoryDropDecision(belt, { kind: 'equipment', slot: 'belt' })).toMatchObject({ accepted: true })
    expect(dnd5eInventoryDropDecision(belt, { kind: 'equipment', slot: 'ring' })).toMatchObject({ accepted: false })
  })
})
