import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import {
  DND5E_SRD_GEAR_ITEM_TEMPLATES,
  DND5E_SRD_ITEM_TEMPLATES,
  applyDnd5eInventoryMutation,
  createDnd5eInventoryForCharacter,
} from './items'
import { DND5E_LONGSWORD } from './equipment'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { registerDnd5eRulesPlugin } from './pluginApi'
import type { Character } from '../../types/character'

function character(id: string, currentHp = 10) {
  return normalizeCharacter({
    id,
    name: id,
    player: id,
    charClass: '战士',
    maxHp: 20,
    currentHp,
    equipment: {},
    dnd5eInventory: { schemaVersion: 1, entries: [] },
  })
}

function inventoryEntry(character: Character, templateId: string) {
  const entry = character.dnd5eInventory?.entries.find((candidate) => candidate.templateId === templateId)
  expect(entry, `missing inventory entry ${templateId}`).toBeDefined()
  return entry!
}

describe('SRD 5.1 inventory', () => {
  it('publishes equipment and adventuring item templates with attribution', () => {
    expect(DND5E_SRD_ITEM_TEMPLATES.some((item) => item.category === 'equipment')).toBe(true)
    expect(DND5E_SRD_GEAR_ITEM_TEMPLATES.some((item) => item.id === 'srd-5.1:item:potion-of-healing')).toBe(true)
    expect(DND5E_SRD_ITEM_TEMPLATES.every((item) => item.source.book === 'SRD 5.1')).toBe(true)
    expect(DND5E_SRD_ITEM_TEMPLATES.every((item) => item.source.license === 'CC BY 4.0')).toBe(true)
  })

  it('grants and equips an active room-plugin equipment template', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.inventory-item', name: 'Inventory Item', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerItem({
          id: 'cloak', name: '测试斗篷', category: 'equipment', icon: 'armor',
          description: '测试。', rulesText: 'AC +1。', stackable: false,
          equipment: { slot: 'necklace', effects: { armorClassBonus: 1 } },
        })
      },
    })
    try {
      const hero = character('plugin-hero')
      const granted = applyDnd5eInventoryMutation([hero], {
        type: 'grant', characterId: hero.id, templateId: 'com.example.inventory-item:cloak', quantity: 1,
      })
      expect(granted.ok).toBe(true)
      const entry = inventoryEntry(granted.characters[0], 'com.example.inventory-item:cloak')
      const equipped = applyDnd5eInventoryMutation(granted.characters, {
        type: 'equip', characterId: hero.id, instanceId: entry.instanceId,
      })
      expect(equipped.characters[0].equipment?.necklace).toMatchObject({
        id: 'com.example.inventory-item:cloak', effects: { armorClassBonus: 1 },
      })
    } finally {
      dispose()
    }
  })

  it('migrates currently equipped gear into deterministic inventory instances', () => {
    const inventory = createDnd5eInventoryForCharacter({
      id: 'fighter',
      equipment: { mainWeapon: DND5E_LONGSWORD },
    })
    expect(inventory.entries).toHaveLength(1)
    expect(inventory.entries[0]).toMatchObject({
      instanceId: 'equipped:fighter:mainWeapon:dnd5e-longsword',
      equippedSlot: 'mainWeapon',
      quantity: 1,
    })
  })

  it('grants, stacks and authoritatively uses a healing potion', () => {
    const hero = { ...character('hero', 9), dnd5eCombatState: { caltropsSpeedPenaltyFeet: 10 } }
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:item:potion-of-healing', quantity: 2,
    })
    expect(granted.ok).toBe(true)
    const stack = inventoryEntry(granted.characters[0], 'srd-5.1:item:potion-of-healing')
    expect(stack.quantity).toBe(2)

    const economy = createDnd5eTurnEconomyCounts('combat:1:hero')
    const used = applyDnd5eInventoryMutation(granted.characters, {
      type: 'use', characterId: hero.id, instanceId: stack.instanceId, healingRolls: [4, 3],
    }, { turnEconomy: economy })
    expect(used).toMatchObject({ ok: true, healingRolled: 9, healingApplied: 9, spentEconomy: 'action' })
    expect(used.characters[0].currentHp).toBe(18)
    expect(used.characters[0].dnd5eCombatState?.caltropsSpeedPenaltyFeet).toBeUndefined()
    expect(inventoryEntry(used.characters[0], stack.templateId).quantity).toBe(1)
  })

  it('does not consume an item when the combat action is unavailable', () => {
    const hero = character('hero')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:item:potion-of-healing', quantity: 1,
    })
    const stack = inventoryEntry(granted.characters[0], 'srd-5.1:item:potion-of-healing')
    const economy = createDnd5eTurnEconomyCounts('combat:1:hero')
    economy.action.current = 0
    const used = applyDnd5eInventoryMutation(granted.characters, {
      type: 'use', characterId: hero.id, instanceId: stack.instanceId, healingRolls: [1, 1],
    }, { turnEconomy: economy })
    expect(used).toMatchObject({ ok: false, reason: 'action-unavailable' })
    expect(inventoryEntry(used.characters[0], stack.templateId).quantity).toBe(1)
  })

  it('transfers item quantities without duplicating stacks', () => {
    const source = character('source')
    const target = character('target')
    const granted = applyDnd5eInventoryMutation([source, target], {
      type: 'grant', characterId: source.id, templateId: 'srd-5.1:item:torch', quantity: 4,
    })
    const stack = inventoryEntry(granted.characters[0], 'srd-5.1:item:torch')
    const transferred = applyDnd5eInventoryMutation(granted.characters, {
      type: 'transfer', characterId: source.id, targetCharacterId: target.id, instanceId: stack.instanceId, quantity: 3,
    })
    expect(transferred.ok).toBe(true)
    expect(inventoryEntry(transferred.characters[0], stack.templateId).quantity).toBe(1)
    expect(inventoryEntry(transferred.characters[1], stack.templateId).quantity).toBe(3)
  })

  it('tracks all ten healer kit uses without consuming the kit early', () => {
    const hero = character('healer')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:item:healers-kit', quantity: 1,
    })
    let current = granted.characters
    let stack = inventoryEntry(current[0], 'srd-5.1:item:healers-kit')
    expect(stack.remainingCharges).toBe(10)
    for (let index = 0; index < 9; index += 1) {
      const used = applyDnd5eInventoryMutation(current, { type: 'use', characterId: hero.id, instanceId: stack.instanceId })
      expect(used.ok).toBe(true)
      current = used.characters
      stack = inventoryEntry(current[0], 'srd-5.1:item:healers-kit')
    }
    expect(stack.remainingCharges).toBe(1)
    const finalUse = applyDnd5eInventoryMutation(current, { type: 'use', characterId: hero.id, instanceId: stack.instanceId })
    expect(finalUse.characters[0].dnd5eInventory!.entries.some((entry) => entry.templateId === stack.templateId)).toBe(false)
  })
})
