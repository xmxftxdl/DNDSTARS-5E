import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import {
  DND5E_SRD_GEAR_ITEM_TEMPLATES,
  DND5E_SRD_ITEM_TEMPLATES,
  applyDnd5eInventoryMutation,
  createDnd5eInventoryForCharacter,
  normalizeDnd5eInventory,
  resolveDnd5eAttunementAfterShortRest,
  restoreDnd5eInventoryResources,
  spendDnd5eInventoryResource,
} from './items'
import { DND5E_LONGSWORD } from './equipment'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createCombatTransaction } from '../../lib/combatTransaction'
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
    }, {
      turnEconomy: economy,
      transaction: createCombatTransaction({
        id: 'potion-use', mapId: 'map', combatId: 'combat', actorId: hero.id,
        actionId: 'potion-use', actionKind: 'item-use', now: 1,
      }),
    })
    expect(used).toMatchObject({ ok: true, healingRolled: 9, healingApplied: 9, spentEconomy: 'action' })
    expect(used.characters[0].currentHp).toBe(18)
    expect(used.characters[0].dnd5eCombatState?.caltropsSpeedPenaltyFeet).toBeUndefined()
    expect(inventoryEntry(used.characters[0], stack.templateId).quantity).toBe(1)
    expect(used.transaction).toMatchObject({ status: 'committed', actionKind: 'item-use' })
    expect(used.transaction?.rollLedger.entries).toContainEqual(expect.objectContaining({
      kind: 'healing', dice: { sides: 4, values: [4, 3] }, modifier: 2,
    }))
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

  it('prepares one attunement, completes it on a short rest, and enforces the three-item limit', () => {
    const hero = character('attuner')
    let characters: Character[] = [hero]
    const templateIds = [
      'srd-5.1:magic-item:amulet-of-health',
      'srd-5.1:magic-item:cloak-of-protection',
      'srd-5.1:magic-item:ring-of-protection',
      'srd-5.1:magic-item:ring-of-warmth',
    ]
    for (const templateId of templateIds) {
      characters = applyDnd5eInventoryMutation(characters, {
        type: 'grant', characterId: hero.id, templateId, quantity: 1,
      }).characters
    }
    for (const templateId of templateIds.slice(0, 3)) {
      const entry = inventoryEntry(characters[0], templateId)
      characters = applyDnd5eInventoryMutation(characters, {
        type: 'prepare-attunement', characterId: hero.id, instanceId: entry.instanceId,
      }).characters
      characters = [resolveDnd5eAttunementAfterShortRest(characters[0], 100)]
    }
    expect(characters[0].dnd5eInventory?.entries.filter((entry) => entry.attuned)).toHaveLength(3)
    const fourth = inventoryEntry(characters[0], templateIds[3])
    expect(applyDnd5eInventoryMutation(characters, {
      type: 'prepare-attunement', characterId: hero.id, instanceId: fourth.instanceId,
    })).toMatchObject({ ok: false, reason: 'attunement-limit' })
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

  it('rehydrates previously granted SRD magic items with the latest complete rule text', () => {
    const hero = character('amulet-owner')
    const legacyAmulet = {
      ...DND5E_SRD_ITEM_TEMPLATES.find((item) => item.id === 'srd-5.1:magic-item:amulet-of-the-planes')!,
      description: '极珍稀奇物，需要同调。',
      rulesText: '旧目录占位文案。',
      use: undefined,
    }
    const normalized = normalizeDnd5eInventory({
      ...hero,
      dnd5eInventory: {
        schemaVersion: 2,
        entries: [{
          instanceId: 'old-amulet',
          templateId: legacyAmulet.id,
          item: legacyAmulet,
          quantity: 1,
          acquiredAt: 1,
        }],
      },
    })

    expect(normalized.entries[0].item.description).toContain('跨位面旅行')
    expect(normalized.entries[0].item.rulesText).toContain('DC 15 智力检定')
    expect(normalized.entries[0].item.use).toMatchObject({
      economy: 'action', consumeQuantity: 0, effect: { kind: 'dm-adjudication' },
    })
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
