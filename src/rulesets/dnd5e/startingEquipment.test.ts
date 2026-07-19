import { describe, expect, it } from 'vitest'
import { DND5E_2014_CLASS_OPTIONS } from './characterOptions'
import { dnd5eInventoryItemTemplate } from './items'
import {
  defaultDnd5eStartingEquipmentSelection,
  dnd5eStartingEquipmentPickerKey,
  dnd5eStartingEquipmentPlan,
  resolveDnd5eStartingEquipment,
} from './startingEquipment'

describe('SRD 5.1 starting equipment', () => {
  it('provides a resolvable choice plan for every core class', () => {
    for (const charClass of DND5E_2014_CLASS_OPTIONS) {
      const plan = dnd5eStartingEquipmentPlan(charClass, '自定义背景')
      expect(plan.groups.length, `${charClass} should have starting choices`).toBeGreaterThan(0)
      for (const entry of plan.fixedGrants) expect(dnd5eInventoryItemTemplate(entry.templateId)).toBeDefined()
      for (const group of plan.groups) {
        expect(group.options.length).toBeGreaterThan(0)
        for (const option of group.options) {
          for (const entry of option.grants) expect(dnd5eInventoryItemTemplate(entry.templateId)).toBeDefined()
          for (const picker of option.pickers ?? []) {
            expect(picker.equipmentIds).toContain(picker.defaultEquipmentId)
            for (const equipmentId of picker.equipmentIds) {
              expect(dnd5eInventoryItemTemplate(`srd-5.1:equipment:${equipmentId}`)).toBeDefined()
            }
          }
        }
      }
      const resolved = resolveDnd5eStartingEquipment('hero', plan, defaultDnd5eStartingEquipmentSelection(plan))
      expect(resolved.inventory.entries.length).toBeGreaterThan(0)
    }
  })

  it('creates the default fighter kit as equipped gear plus a complete inventory pack', () => {
    const plan = dnd5eStartingEquipmentPlan('战士', '自定义背景')
    const resolved = resolveDnd5eStartingEquipment('fighter', plan, defaultDnd5eStartingEquipmentSelection(plan))
    expect(resolved.equipment).toMatchObject({
      mainWeapon: { name: '长剑' },
      offHand: { name: '盾牌' },
      armor: { name: '链甲' },
    })
    expect(resolved.inventory.entries.find((entry) => entry.templateId === 'srd-5.1:item:torch')?.quantity).toBe(10)
    expect(resolved.inventory.entries.find((entry) => entry.templateId === 'srd-5.1:item:crossbow-bolts')?.quantity).toBe(20)
    expect(resolved.inventory.entries.some((entry) => entry.equippedSlot === 'mainWeapon' && entry.item.name === '长剑')).toBe(true)
  })

  it('honors alternate fighter armor and two-weapon selections', () => {
    const plan = dnd5eStartingEquipmentPlan('战士', '自定义背景')
    const selection = defaultDnd5eStartingEquipmentSelection(plan)
    selection.optionIds['fighter-armor'] = 'leather-and-longbow'
    selection.optionIds['fighter-weapons'] = 'two-weapons'
    selection.equipmentIds[dnd5eStartingEquipmentPickerKey('fighter-weapons', 'weapon-1')] = 'dnd5e-greataxe'
    selection.equipmentIds[dnd5eStartingEquipmentPickerKey('fighter-weapons', 'weapon-2')] = 'dnd5e-longsword'
    const resolved = resolveDnd5eStartingEquipment('fighter', plan, selection)
    expect(resolved.equipment).toMatchObject({ mainWeapon: { name: '巨斧' }, armor: { name: '皮甲' } })
    expect(resolved.equipment?.offHand).toBeUndefined()
    expect(resolved.inventory.entries.some((entry) => entry.item.name === '长弓')).toBe(true)
    expect(resolved.inventory.entries.find((entry) => entry.templateId === 'srd-5.1:item:arrows')?.quantity).toBe(20)
  })

  it('adds the SRD acolyte background equipment and its selected devotional item', () => {
    const plan = dnd5eStartingEquipmentPlan('牧师', '侍僧')
    const selection = defaultDnd5eStartingEquipmentSelection(plan)
    selection.optionIds['acolyte-devotion'] = 'prayer-wheel'
    const resolved = resolveDnd5eStartingEquipment('cleric', plan, selection)
    expect(resolved.inventory.entries.some((entry) => entry.templateId === 'srd-5.1:item:prayer-wheel')).toBe(true)
    expect(resolved.inventory.entries.find((entry) => entry.templateId === 'srd-5.1:item:incense-block')?.quantity).toBe(5)
    expect(resolved.inventory.entries.some((entry) => entry.templateId === 'srd-5.1:item:coin-pouch-15gp')).toBe(true)
  })
})
