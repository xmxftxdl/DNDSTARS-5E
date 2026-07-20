import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import {
  DND5E_SRD_GEAR_ITEM_TEMPLATES,
  DND5E_SRD_ITEM_TEMPLATES,
  applyDnd5eInventoryMutation,
  createDnd5eInventoryForCharacter,
  normalizeDnd5eInventory,
  restoreDnd5eInventoryResources,
  spendDnd5eInventoryResource,
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
    expect(stack.resources?.uses.current).toBe(10)
    for (let index = 0; index < 9; index += 1) {
      const used = applyDnd5eInventoryMutation(current, { type: 'use', characterId: hero.id, instanceId: stack.instanceId })
      expect(used.ok).toBe(true)
      current = used.characters
      stack = inventoryEntry(current[0], 'srd-5.1:item:healers-kit')
    }
    expect(stack.resources?.uses.current).toBe(1)
    const finalUse = applyDnd5eInventoryMutation(current, { type: 'use', characterId: hero.id, instanceId: stack.instanceId })
    const depleted = inventoryEntry(finalUse.characters[0], stack.templateId)
    expect(depleted.quantity).toBe(1)
    expect(depleted.resources?.uses.current).toBe(0)
    const exhausted = applyDnd5eInventoryMutation(finalUse.characters, { type: 'use', characterId: hero.id, instanceId: stack.instanceId })
    expect(exhausted).toMatchObject({ ok: false, reason: 'insufficient-quantity' })
  })

  it('migrates V1 remainingCharges to an instance resource and never deletes a depleted instance', () => {
    const hero = character('legacy')
    const kit = DND5E_SRD_GEAR_ITEM_TEMPLATES.find((item) => item.id === 'srd-5.1:item:healers-kit')!
    const legacy = {
      ...hero,
      dnd5eInventory: {
        schemaVersion: 1 as const,
        entries: [{ instanceId: 'legacy-kit', templateId: kit.id, item: kit, quantity: 1, remainingCharges: 0, acquiredAt: 1 }],
      },
    }
    const migrated = normalizeDnd5eInventory(legacy)
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.entries[0].remainingCharges).toBeUndefined()
    expect(migrated.entries[0].resources?.uses).toMatchObject({ current: 0, maximum: 10 })
  })

  it('spends generic item resources without changing quantity', () => {
    const hero = character('resource-hero')
    const item = DND5E_SRD_ITEM_TEMPLATES[0]
    const withResource = {
      ...hero,
      dnd5eInventory: {
        schemaVersion: 2 as const,
        entries: [{
          instanceId: 'charged-item', templateId: 'test:charged-item',
          item: { ...item, id: 'test:charged-item', resources: [{ id: 'charges', label: '充能', maximum: 4, resetOn: 'dawn' as const }] },
          quantity: 1,
          resources: { charges: { id: 'charges', label: '充能', current: 1, maximum: 4, resetOn: 'dawn' as const } },
          acquiredAt: 1,
        }],
      },
    }
    const spent = spendDnd5eInventoryResource(withResource, 'charged-item', 'charges')
    expect(spent.ok).toBe(true)
    if (!spent.ok) return
    expect(spent.resource.current).toBe(0)
    expect(spent.character.dnd5eInventory?.entries[0]).toMatchObject({ quantity: 1, resources: { charges: { current: 0 } } })
  })

  it('restores short/long-rest instance resources without deleting dawn or depleted instances', () => {
    const hero = character('rest-resource-hero')
    const item = DND5E_SRD_ITEM_TEMPLATES[0]
    const withResources: Character = {
      ...hero,
      dnd5eInventory: {
        schemaVersion: 2,
        entries: [{
          instanceId: 'rest-item', templateId: 'test:rest-item', quantity: 1, acquiredAt: 1,
          item: {
            ...item,
            id: 'test:rest-item',
            resources: [
              { id: 'short', label: '短休', maximum: 4, resetOn: 'short-rest' },
              { id: 'long', label: '长休', maximum: 3, resetOn: 'long-rest' },
              { id: 'dawn', label: '黎明', maximum: 2, resetOn: 'dawn' },
            ],
          },
          resources: {
            short: { id: 'short', label: '短休', current: 0, maximum: 4, resetOn: 'short-rest' },
            long: { id: 'long', label: '长休', current: 0, maximum: 3, resetOn: 'long-rest' },
            dawn: { id: 'dawn', label: '黎明', current: 0, maximum: 2, resetOn: 'dawn' },
          },
        }],
      },
    }
    const afterShort = restoreDnd5eInventoryResources(withResources, 'short-rest')
    expect(afterShort.dnd5eInventory?.entries[0]).toMatchObject({
      quantity: 1, resources: { short: { current: 4 }, long: { current: 0 }, dawn: { current: 0 } },
    })
    const afterLong = restoreDnd5eInventoryResources(afterShort, 'long-rest')
    expect(afterLong.dnd5eInventory?.entries[0]).toMatchObject({
      quantity: 1, resources: { short: { current: 4 }, long: { current: 3 }, dawn: { current: 0 } },
    })
  })
})
