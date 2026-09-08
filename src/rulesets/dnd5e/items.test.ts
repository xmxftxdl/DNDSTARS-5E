import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import {
  DND5E_SRD_GEAR_ITEM_TEMPLATES,
  DND5E_SRD_ITEM_TEMPLATES,
  applyDnd5eInventoryGrantBundle,
  applyDnd5eInventoryActivityCosts,
  applyDnd5eLinkedSpellAuthorityInventoryHandoff,
  applyDnd5eInstantSummonsSapphireDispel,
  applyDnd5eInventoryMutation,
  createDnd5eInventoryForCharacter,
  consumeDnd5eWeaponAmmunition,
  dnd5eInstantSummonsSapphireDispelTarget,
  dnd5eInventoryEntryIsUnidentifiedMagicItem,
  dnd5eInventoryIdentificationCandidates,
  dnd5eInventoryIdentificationOptionLabel,
  dnd5eInventoryItemTemplate,
  dnd5eInventoryLoad,
  expireDnd5eInventoryItemsAtWorldMinute,
  normalizeDnd5eInventory,
  resolveDnd5eAttunementAfterShortRest,
  restoreDnd5eInventoryResources,
  spendDnd5eInventoryResource,
} from './items'
import { DND5E_LONGSWORD } from './equipment'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createCombatTransaction } from '../../lib/combatTransaction'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { createDnd5eMechanicalEffect } from './activeEffects'
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
  it('doubles carrying capacity from Bull Strength without changing encumbrance thresholds', () => {
    const hero = character('bull-strength')
    hero.abilities.str = 10
    hero.dnd5eCombatState = {
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'srd-5.1:spell:enhance-ability',
        label: '强化属性：公牛之力',
        source: { kind: 'spell', actorId: 'cleric' },
        targetId: hero.id,
        modifiers: { abilityCheckAdvantages: ['str'], carryingCapacityMultiplier: 2 },
      })],
    }
    expect(dnd5eInventoryLoad(hero)).toMatchObject({
      carryingCapacityLb: 300,
      encumberedThresholdLb: 50,
      heavilyEncumberedThresholdLb: 100,
    })
  })

  it('publishes equipment and adventuring item templates with attribution', () => {
    expect(DND5E_SRD_ITEM_TEMPLATES.some((item) => item.category === 'equipment')).toBe(true)
    expect(DND5E_SRD_GEAR_ITEM_TEMPLATES.some((item) => item.id === 'srd-5.1:item:potion-of-healing')).toBe(true)
    expect(DND5E_SRD_ITEM_TEMPLATES.every((item) => item.source.book === 'SRD 5.1')).toBe(true)
    expect(DND5E_SRD_ITEM_TEMPLATES.every((item) => item.source.license === 'CC BY 4.0')).toBe(true)
  })

  it('explains versatile weapon damage in plain one-handed and two-handed terms', () => {
    const longsword = DND5E_SRD_ITEM_TEMPLATES.find((item) =>
      item.id === 'srd-5.1:equipment:dnd5e-longsword',
    )
    const spear = DND5E_SRD_ITEM_TEMPLATES.find((item) =>
      item.id === 'srd-5.1:equipment:dnd5e-spear',
    )

    expect(longsword?.rulesText).toContain('多才多艺：单手攻击使用 1d8 伤害骰；双手攻击改用 1d10')
    expect(spear?.rulesText).toContain('多才多艺：单手攻击使用 1d6 伤害骰；双手攻击改用 1d8')
  })

  it('publishes a concrete effect description instead of a generic item label', () => {
    expect(DND5E_SRD_ITEM_TEMPLATES.every((item) =>
      item.description.trim().length >= 24 && item.description.length <= 2_000 &&
      item.rulesText.trim().length >= 24 && item.rulesText.length <= 20_000 &&
      !item.description.includes('SRD 5.1 冒险装备') &&
      !item.description.includes('暂无额外规则效果'),
    )).toBe(true)
  })

  it('expands every core weapon property into its actual rule', () => {
    const propertyLabel = (property: string) => property.startsWith('投掷')
      ? '投掷：'
      : property.startsWith('多才多艺')
        ? '多才多艺：'
        : `${property}：`
    const weapons = DND5E_SRD_ITEM_TEMPLATES.filter((item) =>
      item.id.startsWith('srd-5.1:equipment:') && item.equipment?.dnd5e?.kind === 'weapon',
    )

    for (const item of weapons) {
      const rules = item.equipment?.dnd5e
      if (rules?.kind !== 'weapon') continue
      for (const property of rules.properties ?? []) {
        expect(item.rulesText, `${item.name}: ${property}`).toContain(propertyLabel(property))
      }
    }
    expect(DND5E_SRD_ITEM_TEMPLATES.find((item) => item.id.endsWith(':dnd5e-lance'))?.rulesText)
      .toContain('未骑乘时使用骑枪需要双手')
    expect(DND5E_SRD_ITEM_TEMPLATES.find((item) => item.id.endsWith(':dnd5e-net'))?.rulesText)
      .toContain('捕网的 AC 为 10')
  })

  it('equips an arcane focus in either hand and defaults to the free off hand', () => {
    const focusTemplate = DND5E_SRD_GEAR_ITEM_TEMPLATES.find((item) => item.id === 'srd-5.1:item:arcane-focus')
    expect(focusTemplate?.equipment).toMatchObject({
      id: 'dnd5e-arcane-focus',
      slot: 'mainWeapon',
      allowedSlots: ['mainWeapon', 'offHand'],
      spellcastingFocusClassIds: ['wizard', 'sorcerer', 'warlock'],
    })

    const hero = { ...character('focus-hero'), equipment: { mainWeapon: DND5E_LONGSWORD } }
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:item:arcane-focus', quantity: 1,
    })
    const focus = inventoryEntry(granted.characters[0], 'srd-5.1:item:arcane-focus')
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: hero.id, instanceId: focus.instanceId,
    })

    expect(equipped.ok).toBe(true)
    expect(equipped.characters[0].equipment?.offHand?.id).toBe('dnd5e-arcane-focus')
    expect(inventoryEntry(equipped.characters[0], 'srd-5.1:item:arcane-focus').equippedSlot).toBe('offHand')

    const replayed = applyDnd5eInventoryMutation(equipped.characters, {
      type: 'equip', characterId: hero.id, instanceId: focus.instanceId,
    })
    expect(replayed.ok).toBe(true)
    expect(replayed.characters[0].equipment?.mainWeapon?.id).toBe(DND5E_LONGSWORD.id)
    expect(replayed.characters[0].equipment?.offHand?.id).toBe('dnd5e-arcane-focus')
    expect(normalizeDnd5eInventory(replayed.characters[0]).entries.filter(
      (candidate) => candidate.item.equipment?.id === 'dnd5e-arcane-focus',
    )).toEqual([
      expect.objectContaining({ instanceId: focus.instanceId, equippedSlot: 'offHand' }),
    ])

    const persisted = normalizeCharacter(equipped.characters[0])
    expect(persisted.equipment?.offHand).toMatchObject({
      id: 'dnd5e-arcane-focus',
      allowedSlots: ['mainWeapon', 'offHand'],
      spellcastingFocusClassIds: ['wizard', 'sorcerer', 'warlock'],
    })
  })

  it('keeps an equipped jade circlet equipped after a shared snapshot round-trip', () => {
    const hero = character('shapechange-wizard')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id,
      templateId: 'srd-5.1:item:jade-circlet-1500gp', quantity: 1,
    })
    const circlet = inventoryEntry(granted.characters[0], 'srd-5.1:item:jade-circlet-1500gp')
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: hero.id, instanceId: circlet.instanceId,
    })
    expect(equipped.ok).toBe(true)

    const persisted = normalizeCharacter(equipped.characters[0])
    expect(persisted.equipment?.helmet?.id).toBe('srd-5.1:equipment:jade-circlet-1500gp')
    expect(inventoryEntry(persisted, 'srd-5.1:item:jade-circlet-1500gp').equippedSlot).toBe('helmet')
  })

  it('migrates a legacy arcane focus that was incorrectly stored as an unidentified magic item', () => {
    const hero = character('legacy-focus')
    hero.dnd5eInventory = {
      schemaVersion: 3,
      entries: [{
        instanceId: 'legacy-focus-instance',
        templateId: 'srd-5.1:magic-item:arcane-focus',
        item: {
          id: 'srd-5.1:magic-item:arcane-focus',
          name: '奥术法器',
          category: 'magic-item',
          icon: 'magic-wand',
          description: '旧存档错误分类。',
          rulesText: '旧存档错误分类。',
          stackable: false,
          magicItem: { kind: 'wand', rarity: 'common', attunement: 'none', automation: 'dm-adjudication' },
          source: { book: '旧存档', license: '本地内容' },
        },
        quantity: 1,
        identified: false,
        acquiredAt: 1,
      }],
    }

    const normalized = normalizeDnd5eInventory(hero)
    expect(normalized.entries[0]).toMatchObject({
      identified: true,
      item: {
        id: 'srd-5.1:item:arcane-focus',
        category: 'adventuring-gear',
        icon: 'spellcasting-focus',
        equipment: {
          allowedSlots: ['mainWeapon', 'offHand'],
          spellcastingFocusClassIds: ['wizard', 'sorcerer', 'warlock'],
        },
      },
    })
    expect(normalized.entries[0].item.magicItem).toBeUndefined()

    const equipped = applyDnd5eInventoryMutation([{ ...hero, dnd5eInventory: normalized }], {
      type: 'equip', characterId: hero.id, instanceId: 'legacy-focus-instance', slot: 'offHand',
    })
    expect(equipped.ok).toBe(true)
    expect(equipped.characters[0].equipment?.offHand?.id).toBe('dnd5e-arcane-focus')
  })

  it('equips Staff of Striking as a magical quarterstaff in a free hand', () => {
    const hero = { ...character('striking-staff-hero'), equipment: { mainWeapon: DND5E_LONGSWORD } }
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:magic-item:staff-of-striking', quantity: 1,
    })
    const staff = inventoryEntry(granted.characters[0], 'srd-5.1:magic-item:staff-of-striking')
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: hero.id, instanceId: staff.instanceId,
    })

    expect(equipped.ok).toBe(true)
    expect(equipped.characters[0].equipment?.offHand).toMatchObject({
      id: 'srd-5.1:magic-item:staff-of-striking',
      baseEquipmentId: 'dnd5e-quarterstaff',
      dnd5e: { kind: 'weapon', magical: true },
    })
    expect(inventoryEntry(equipped.characters[0], staff.templateId).equippedSlot).toBe('offHand')
  })

  it('does not infer a focus declaration from an ordinary weapon or shield', () => {
    const quarterstaff = DND5E_SRD_ITEM_TEMPLATES.find((item) =>
      item.id === 'srd-5.1:equipment:dnd5e-quarterstaff',
    )
    const shield = DND5E_SRD_ITEM_TEMPLATES.find((item) =>
      item.id === 'srd-5.1:equipment:dnd5e-shield',
    )

    expect(quarterstaff?.equipment?.spellcastingFocusClassIds).toBeUndefined()
    expect(shield?.equipment?.spellcastingFocusClassIds).toBeUndefined()
    expect(quarterstaff?.rulesText).not.toContain('施法法器')
    expect(shield?.rulesText).not.toContain('施法法器')
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

  it('equips two different rings without replacing the first ring', () => {
    const hero = character('two-rings')
    let characters = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1,
    }).characters
    characters = applyDnd5eInventoryMutation(characters, {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:magic-item:ring-of-warmth', quantity: 1,
    }).characters
    const protection = inventoryEntry(characters[0], 'srd-5.1:magic-item:ring-of-protection')
    const warmth = inventoryEntry(characters[0], 'srd-5.1:magic-item:ring-of-warmth')

    const first = applyDnd5eInventoryMutation(characters, {
      type: 'equip', characterId: hero.id, instanceId: protection.instanceId,
    })
    const second = applyDnd5eInventoryMutation(first.characters, {
      type: 'equip', characterId: hero.id, instanceId: warmth.instanceId,
    })

    expect(second.ok).toBe(true)
    expect(second.characters[0].equipment?.ring?.id).toBe(protection.item.equipment?.id)
    expect(second.characters[0].equipment?.ring2?.id).toBe(warmth.item.equipment?.id)
    expect(normalizeDnd5eInventory(second.characters[0]).entries.filter((entry) => entry.equippedSlot === 'ring' || entry.equippedSlot === 'ring2')).toHaveLength(2)
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

  it('ends Mage Armor when the target equips body armor', () => {
    const mageArmor = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:mage-armor',
      label: '法师护甲',
      targetId: 'wizard',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'mage-armor', spellLevel: 1 },
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
    })
    const wizard = {
      ...character('wizard'),
      dnd5eCombatState: { activeEffects: [mageArmor], conditions: [] },
    }
    const granted = applyDnd5eInventoryMutation([wizard], {
      type: 'grant',
      characterId: wizard.id,
      templateId: 'srd-5.1:equipment:dnd5e-leather-armor',
      quantity: 1,
    })
    expect(granted.ok).toBe(true)
    const armor = inventoryEntry(granted.characters[0], 'srd-5.1:equipment:dnd5e-leather-armor')
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip',
      characterId: wizard.id,
      instanceId: armor.instanceId,
    })
    expect(equipped.ok).toBe(true)
    expect(equipped.characters[0].dnd5eCombatState?.activeEffects ?? []).toEqual([])
  })

  it('ends Shillelagh when its held weapon is unequipped or replaced by another physical club', () => {
    const shillelagh = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:shillelagh',
      label: '橡棍术',
      targetId: 'druid',
      source: { kind: 'spell', actorId: 'druid', rulesId: 'shillelagh' },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: {
        shillelagh: {
          weaponId: 'dnd5e-club',
          spellcastingAbility: 'wis',
          spellcastingModifier: 5,
        },
      },
    })
    const druid = character('druid')
    const granted = applyDnd5eInventoryMutation([druid], {
      type: 'grant', characterId: druid.id,
      templateId: 'srd-5.1:equipment:dnd5e-club', quantity: 2,
    })
    const clubs = normalizeDnd5eInventory(granted.characters[0]).entries.filter((entry) =>
      entry.templateId === 'srd-5.1:equipment:dnd5e-club')
    expect(clubs).toHaveLength(2)
    const firstEquipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: druid.id, instanceId: clubs[0].instanceId, slot: 'mainWeapon',
    })
    const enchanted = firstEquipped.characters.map((candidate) => candidate.id === druid.id
      ? { ...candidate, dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [shillelagh] } }
      : candidate)

    const unequipped = applyDnd5eInventoryMutation(enchanted, {
      type: 'unequip', characterId: druid.id, instanceId: clubs[0].instanceId,
    })
    expect(unequipped.ok).toBe(true)
    expect(unequipped.characters[0].dnd5eCombatState?.activeEffects).toBeUndefined()

    const reenchanted = firstEquipped.characters.map((candidate) => candidate.id === druid.id
      ? { ...candidate, dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [shillelagh] } }
      : candidate)
    const replaced = applyDnd5eInventoryMutation(reenchanted, {
      type: 'equip', characterId: druid.id, instanceId: clubs[1].instanceId, slot: 'mainWeapon',
    })
    expect(replaced.ok).toBe(true)
    expect(replaced.characters[0].equipment?.mainWeapon?.id).toBe('dnd5e-club')
    expect(replaced.characters[0].dnd5eCombatState?.activeEffects).toBeUndefined()
  })

  it('ends Warding Bond immediately when either participant removes the required platinum ring', () => {
    const cleric = character('cleric')
    const ally = character('ally')
    let participants = [cleric, ally]
    for (const participant of participants) {
      const granted = applyDnd5eInventoryMutation(participants, {
        type: 'grant', characterId: participant.id,
        templateId: 'srd-5.1:item:platinum-ring-50gp', quantity: 1,
      })
      expect(granted.ok).toBe(true)
      participants = granted.characters
      const ring = inventoryEntry(
        participants.find((candidate) => candidate.id === participant.id)!,
        'srd-5.1:item:platinum-ring-50gp',
      )
      const equipped = applyDnd5eInventoryMutation(participants, {
        type: 'equip', characterId: participant.id, instanceId: ring.instanceId,
      })
      expect(equipped.ok).toBe(true)
      participants = equipped.characters
    }

    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:warding-bond',
      label: '守护之链',
      targetId: ally.id,
      source: {
        kind: 'spell', actorId: 'cleric-token', actorName: cleric.name,
        characterId: cleric.id, rulesId: 'warding-bond', spellLevel: 2,
      },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      modifiers: { armorClassBonus: 1, savingThrowBonus: 1, resistanceToAllDamage: true },
    })
    const bonded = participants.map((participant) => participant.id === ally.id
      ? { ...participant, dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [effect] } }
      : participant)

    for (const participantId of [cleric.id, ally.id]) {
      const participant = bonded.find((candidate) => candidate.id === participantId)!
      const ring = inventoryEntry(participant, 'srd-5.1:item:platinum-ring-50gp')
      const unequipped = applyDnd5eInventoryMutation(structuredClone(bonded), {
        type: 'unequip', characterId: participantId, instanceId: ring.instanceId,
      })
      expect(unequipped.ok).toBe(true)
      expect(unequipped.characters.find((candidate) => candidate.id === ally.id)
        ?.dnd5eCombatState?.activeEffects ?? []).toEqual([])
    }
  })

  it('ends Contingency immediately when its 1,500 gp statuette leaves the caster inventory', () => {
    const wizard = character('contingency-wizard')
    const granted = applyDnd5eInventoryMutation([wizard], {
      type: 'grant', characterId: wizard.id,
      templateId: 'srd-5.1:item:contingency-statuette-1500gp', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    const statuette = inventoryEntry(
      granted.characters[0],
      'srd-5.1:item:contingency-statuette-1500gp',
    )
    const contingency = createDnd5eMechanicalEffect({
      definitionId: 'activity:contingency:contingency-mirror-image-takes-damage:extension',
      label: '触发术·储存镜影术',
      tags: ['contingency', 'stored-spell', 'stored-spell:mirror-image'],
      targetId: wizard.id,
      source: {
        kind: 'spell', actorId: wizard.id, characterId: wizard.id,
        rulesId: 'contingency', spellLevel: 6,
      },
      duration: { type: 'rounds', remainingRounds: 144_000, tickOn: 'target-turn-end' },
      grantedActivities: ['spell:contingency:trigger:mirror-image:takes-damage'],
    })
    const active = granted.characters.map((candidate) => candidate.id === wizard.id
      ? { ...candidate, dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [contingency] } }
      : candidate)
    const removed = applyDnd5eInventoryMutation(active, {
      type: 'discard', characterId: wizard.id, instanceId: statuette.instanceId, quantity: 1,
    })
    expect(removed.ok).toBe(true)
    expect(removed.characters[0].dnd5eCombatState?.activeEffects ?? []).toEqual([])
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

  it('heals the selected creature while the source pays the item cost', () => {
    const source = character('healer', 20)
    const target = character('wounded-ally', 4)
    const granted = applyDnd5eInventoryMutation([source, target], {
      type: 'grant', characterId: source.id, templateId: 'srd-5.1:item:potion-of-healing', quantity: 2,
    })
    const stack = inventoryEntry(granted.characters[0], 'srd-5.1:item:potion-of-healing')
    const revision = normalizeDnd5eInventory(granted.characters[0]).revision ?? 0

    const used = applyDnd5eInventoryMutation(granted.characters, {
      type: 'use',
      characterId: source.id,
      targetCharacterId: target.id,
      instanceId: stack.instanceId,
      healingRolls: [3, 2],
      receiptId: 'combat:item-use:heal-ally',
      expectedInventoryRevision: revision,
    })

    expect(used).toMatchObject({ ok: true, healingRolled: 7, healingApplied: 7 })
    expect(used.characters.find((candidate) => candidate.id === source.id)?.currentHp).toBe(20)
    expect(used.characters.find((candidate) => candidate.id === target.id)?.currentHp).toBe(11)
    expect(inventoryEntry(used.characters[0], stack.templateId).quantity).toBe(1)
  })

  it('restores only a selected expended spell slot and spends a rechargeable item resource', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.slot-recovery', name: 'Slot Recovery', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerItem({
          id: 'pearl', name: '回魔珍珠', category: 'equipment', icon: 'magic-wondrous',
          description: '测试。', rulesText: '恢复一个至多 3 环的已消耗法术位。', stackable: false,
          equipment: { slot: 'necklace' },
          resources: [{ id: 'charges', label: '充能', maximum: 1, resetOn: 'long-rest' }],
          use: {
            economy: 'action', consumeQuantity: 0,
            resourceCost: { resourceId: 'charges', amount: 1 },
            effect: {
              kind: 'spell-slot-recovery', maximumSlotLevel: 3, amount: 1,
              selection: 'selected-expended-slot',
            },
          },
        })
      },
    })
    try {
      const wizard = {
        ...character('slot-wizard'),
        classResources: {
          'dnd5e-spell-slot-1': { current: 0, max: 2 },
          'dnd5e-spell-slot-3': { current: 1, max: 1 },
        },
      }
      const granted = applyDnd5eInventoryMutation([wizard], {
        type: 'grant', characterId: wizard.id,
        templateId: 'com.example.slot-recovery:pearl', quantity: 1,
      })
      const entry = inventoryEntry(granted.characters[0], 'com.example.slot-recovery:pearl')
      const used = applyDnd5eInventoryMutation(granted.characters, {
        type: 'use', characterId: wizard.id, instanceId: entry.instanceId,
        spellSlotLevel: 1, receiptId: 'slot-recovery:1',
      })
      expect(used).toMatchObject({ ok: true, spellSlotLevel: 1, spellSlotsRecovered: 1 })
      expect(used.characters[0].classResources?.['dnd5e-spell-slot-1']).toEqual({ current: 1, max: 2 })
      expect(inventoryEntry(used.characters[0], entry.templateId).resources?.charges.current).toBe(0)

      const unavailable = applyDnd5eInventoryMutation(granted.characters, {
        type: 'use', characterId: wizard.id, instanceId: entry.instanceId, spellSlotLevel: 3,
      })
      expect(unavailable).toMatchObject({ ok: false, reason: 'spell-slot-unavailable' })
      const invalid = applyDnd5eInventoryMutation(granted.characters, {
        type: 'use', characterId: wizard.id, instanceId: entry.instanceId, spellSlotLevel: 4,
      })
      expect(invalid).toMatchObject({ ok: false, reason: 'invalid-spell-slot' })
    } finally {
      dispose()
    }
  })

  it('requires attunement for Pearl of Power and restores its daily use at dawn', () => {
    const wizard = {
      ...character('pearl-wizard'),
      classResources: { 'dnd5e-spell-slot-2': { current: 0, max: 2 } },
    }
    const granted = applyDnd5eInventoryMutation([wizard], {
      type: 'grant', characterId: wizard.id,
      templateId: 'srd-5.1:magic-item:pearl-of-power', quantity: 1,
    })
    const pearl = inventoryEntry(granted.characters[0], 'srd-5.1:magic-item:pearl-of-power')
    expect(applyDnd5eInventoryMutation(granted.characters, {
      type: 'use', characterId: wizard.id, instanceId: pearl.instanceId, spellSlotLevel: 2,
    })).toMatchObject({ ok: false, reason: 'item-inactive' })

    const attuned = {
      ...granted.characters[0],
      dnd5eInventory: {
        ...granted.characters[0].dnd5eInventory!,
        entries: granted.characters[0].dnd5eInventory!.entries.map((entry) =>
          entry.instanceId === pearl.instanceId ? { ...entry, attuned: true } : entry,
        ),
      },
    }
    const used = applyDnd5eInventoryMutation([attuned], {
      type: 'use', characterId: wizard.id, instanceId: pearl.instanceId,
      spellSlotLevel: 2, receiptId: 'pearl-of-power:daily-use',
    })
    expect(used).toMatchObject({ ok: true, spellSlotLevel: 2, spellSlotsRecovered: 1 })
    expect(inventoryEntry(used.characters[0], pearl.templateId).resources?.['daily-use'].current).toBe(0)
    const afterDawn = restoreDnd5eInventoryResources(used.characters[0], 'dawn')
    expect(inventoryEntry(afterDawn, pearl.templateId).resources?.['daily-use'].current).toBe(1)
  })

  it('persists item-use receipts and rejects stale inventory revisions', () => {
    const hero = character('receipt-hero')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:item:potion-of-healing', quantity: 1,
    })
    const stack = inventoryEntry(granted.characters[0], 'srd-5.1:item:potion-of-healing')
    const revision = normalizeDnd5eInventory(granted.characters[0]).revision ?? 0
    const mutation = {
      type: 'use' as const,
      characterId: hero.id,
      instanceId: stack.instanceId,
      healingRolls: [1, 1],
      receiptId: 'combat:item-use:once',
      expectedInventoryRevision: revision,
    }
    const used = applyDnd5eInventoryMutation(granted.characters, mutation)
    expect(used.ok).toBe(true)
    expect(normalizeDnd5eInventory(used.characters[0]).authorityUseReceipts).toContain(mutation.receiptId)
    expect(applyDnd5eInventoryMutation(used.characters, mutation)).toMatchObject({ ok: true, deduplicated: true })

    expect(applyDnd5eInventoryMutation(granted.characters, {
      ...mutation,
      receiptId: 'combat:item-use:stale',
      expectedInventoryRevision: revision + 1,
    })).toMatchObject({ ok: false, reason: 'stale-inventory-revision' })
  })

  it('spends Activity charges from the item instance, not class resources', () => {
    const hero = character('charged-item')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:item:potion-of-healing', quantity: 2,
    })
    const stack = inventoryEntry(granted.characters[0], 'srd-5.1:item:potion-of-healing')
    const revision = normalizeDnd5eInventory(granted.characters[0]).revision ?? 0
    const spent = applyDnd5eInventoryActivityCosts(granted.characters[0], {
      instanceId: stack.instanceId,
      costs: [{ kind: 'quantity', amount: 1 }],
      receiptId: 'activity:item:quantity',
      expectedInventoryRevision: revision,
    })
    expect(spent.ok).toBe(true)
    if (!spent.ok) return
    expect(inventoryEntry(spent.character, stack.templateId).quantity).toBe(1)
    expect(spent.character.classResources?.['item:srd-5.1:item:potion-of-healing:quantity']).toBeUndefined()
    expect(applyDnd5eInventoryActivityCosts(spent.character, {
      instanceId: stack.instanceId,
      costs: [{ kind: 'quantity', amount: 1 }],
      receiptId: 'activity:item:quantity',
      expectedInventoryRevision: revision,
    })).toMatchObject({ ok: true, deduplicated: true })
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

  it('rejects Instant Summons objects over ten pounds or longer than six feet at Host authority', () => {
    const source = character('instant-summons-size-guard')
    const baseItem = {
      id: 'test:instant-summons-object', name: '测试物件', category: 'adventuring-gear' as const,
      icon: 'generic' as const, description: '测试', rulesText: '测试', stackable: false,
      source: { book: 'test', license: 'test' },
    }
    const sapphireTemplate = dnd5eInventoryItemTemplate('srd-5.1:item:sapphire-1000gp')!
    const withInventory = {
      ...source,
      dnd5eInventory: {
        schemaVersion: 3 as const,
        revision: 0,
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
        entries: [
          { instanceId: 'too-heavy', templateId: 'test:too-heavy', item: { ...baseItem, weightLb: 11 }, quantity: 1, acquiredAt: 1 },
          { instanceId: 'too-long', templateId: 'test:too-long', item: { ...baseItem, weightLb: 1, longestDimensionFeet: 7 }, quantity: 1, acquiredAt: 1 },
          { instanceId: 'at-limits', templateId: 'test:at-limits', item: { ...baseItem, weightLb: 10, longestDimensionFeet: 6 }, quantity: 1, acquiredAt: 1 },
          { instanceId: 'sapphire', templateId: sapphireTemplate.id, item: sapphireTemplate, quantity: 1, acquiredAt: 1 },
        ],
        authorityGrantReceipts: [], authorityUseReceipts: [],
      },
    }
    const establish = (inventoryInstanceId: string, receiptId: string) =>
      applyDnd5eLinkedSpellAuthorityInventoryHandoff([withInventory], {
        sourceCharacterId: source.id,
        sourceActorAuthorityId: 'instant-summons-size-token',
        receiptId,
        expectedInventoryRevision: 0,
        establishments: [{
          kind: 'establish-spell-authority', operationId: 'bind-object',
          sourceActivityId: 'spell:instant-summons', sourceActorId: 'instant-summons-size-token',
          targetId: 'instant-summons-size-token', recordKind: 'linked-planar-object',
          linkedObjectProfile: 'instant-summons', inventoryInstanceId,
        }],
      })
    expect(establish('too-heavy', 'instant-summons:too-heavy'))
      .toMatchObject({ ok: false, reason: 'inventory-context-required' })
    expect(establish('too-long', 'instant-summons:too-long'))
      .toMatchObject({ ok: false, reason: 'inventory-context-required' })
    expect(establish('at-limits', 'instant-summons:at-limits')).toMatchObject({ ok: true })
  })

  it('preserves an Instant Summons object across transfer, consumes the sapphire, and reports another holder', () => {
    const caster = character('instant-summons-caster')
    const holder = character('instant-summons-holder')
    let characters = applyDnd5eInventoryMutation([caster, holder], {
      type: 'grant', characterId: caster.id,
      templateId: 'srd-5.1:item:small-knife', quantity: 1,
    }).characters
    characters = applyDnd5eInventoryMutation(characters, {
      type: 'grant', characterId: caster.id,
      templateId: 'srd-5.1:item:sapphire-1000gp', quantity: 1,
    }).characters
    const knife = inventoryEntry(characters[0], 'srd-5.1:item:small-knife')
    const recordId = `linked-planar-object:instant-summons:instant-summons-token:${knife.instanceId}`
    const established = applyDnd5eLinkedSpellAuthorityInventoryHandoff(characters, {
      sourceCharacterId: caster.id,
      sourceActorAuthorityId: 'instant-summons-token',
      receiptId: 'instant-summons:establish',
      expectedInventoryRevision: normalizeDnd5eInventory(characters[0]).revision,
      establishments: [{
        kind: 'establish-spell-authority', operationId: 'bind-object',
        sourceActivityId: 'spell:instant-summons', sourceActorId: 'instant-summons-token',
        targetId: 'instant-summons-token', recordKind: 'linked-planar-object',
        linkedObjectProfile: 'instant-summons', inventoryInstanceId: knife.instanceId,
      }],
    })
    expect(established.ok).toBe(true)
    if (!established.ok) return
    expect(inventoryEntry(established.characters[0], knife.templateId)).toMatchObject({
      instanceId: knife.instanceId,
      planarState: 'material',
      linkedSpellAuthorityRecordId: recordId,
    })
    expect(inventoryEntry(established.characters[0], 'srd-5.1:item:sapphire-1000gp')).toMatchObject({
      linkedSpellFocusAuthorityRecordId: recordId,
    })

    const transferred = applyDnd5eInventoryMutation(established.characters, {
      type: 'transfer', characterId: caster.id, targetCharacterId: holder.id,
      instanceId: knife.instanceId, quantity: 1,
    })
    expect(transferred.ok).toBe(true)
    expect(normalizeDnd5eInventory(transferred.characters[0]).entries.some((entry) =>
      entry.instanceId === knife.instanceId)).toBe(false)
    expect(inventoryEntry(transferred.characters[1], knife.templateId)).toMatchObject({
      instanceId: knife.instanceId,
      linkedSpellAuthorityRecordId: recordId,
    })

    const recalled = applyDnd5eLinkedSpellAuthorityInventoryHandoff(transferred.characters, {
      sourceCharacterId: caster.id,
      sourceActorAuthorityId: 'instant-summons-token',
      receiptId: 'instant-summons:recall',
      transitions: [{
        kind: 'transition-spell-authority', operationId: 'recall-object',
        sourceActivityId: 'spell:instant-summons:recall', sourceActorId: 'instant-summons-token',
        targetId: 'instant-summons-token', recordKind: 'linked-planar-object',
        linkedObjectProfile: 'instant-summons', authorityRecordId: recordId,
        transition: 'recall-to-source',
      }],
    })
    expect(recalled.ok).toBe(true)
    if (!recalled.ok) return
    expect(recalled).toMatchObject({
      recalled: false,
      holderCharacterId: holder.id,
      holderName: holder.name,
    })
    expect(normalizeDnd5eInventory(recalled.characters[0]).entries.some((entry) =>
      entry.templateId === 'srd-5.1:item:sapphire-1000gp')).toBe(false)
    expect(inventoryEntry(recalled.characters[1], knife.templateId)).toMatchObject({
      instanceId: knife.instanceId,
      planarState: 'material',
      linkedSpellAuthorityRecordId: undefined,
    })
  })

  it('keeps simultaneous Instant Summons links on different sapphires and ends only the selected link', () => {
    const characterId = 'multi-link-caster'
    const actorId = 'multi-link-token'
    let characters = applyDnd5eInventoryMutation([character(characterId)], {
      type: 'grant', characterId, templateId: 'srd-5.1:item:small-knife', quantity: 1,
    }).characters
    characters = applyDnd5eInventoryMutation(characters, {
      type: 'grant', characterId, templateId: 'srd-5.1:item:parchment-sheet', quantity: 1,
    }).characters
    characters = applyDnd5eInventoryMutation(characters, {
      type: 'grant', characterId, templateId: 'srd-5.1:item:sapphire-1000gp', quantity: 2,
    }).characters
    const knife = inventoryEntry(characters[0], 'srd-5.1:item:small-knife')
    const parchment = inventoryEntry(characters[0], 'srd-5.1:item:parchment-sheet')
    const establish = (
      current: Character[],
      instanceId: string,
      receiptId: string,
      spellLevel: number,
    ) => applyDnd5eLinkedSpellAuthorityInventoryHandoff(current, {
      sourceCharacterId: characterId, sourceActorAuthorityId: actorId, receiptId,
      expectedInventoryRevision: normalizeDnd5eInventory(current[0]).revision,
      establishments: [{
        kind: 'establish-spell-authority', operationId: 'bind-object',
        sourceActivityId: 'spell:instant-summons', sourceActorId: actorId,
        targetId: actorId, recordKind: 'linked-planar-object', spellLevel,
        linkedObjectProfile: 'instant-summons', inventoryInstanceId: instanceId,
      }],
    })
    const first = establish(characters, knife.instanceId, 'instant-summons:multi:one', 6)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = establish(first.characters, parchment.instanceId, 'instant-summons:multi:two', 8)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    const knifeRecordId = `linked-planar-object:instant-summons:${actorId}:${knife.instanceId}`
    const parchmentRecordId = `linked-planar-object:instant-summons:${actorId}:${parchment.instanceId}`
    const focusRecordIds = normalizeDnd5eInventory(second.characters[0]).entries
      .flatMap((entry) => entry.linkedSpellFocusAuthorityRecordId ? [entry.linkedSpellFocusAuthorityRecordId] : [])
    expect(new Set(focusRecordIds)).toEqual(new Set([knifeRecordId, parchmentRecordId]))

    const controller = createDnd5eMechanicalEffect({
      definitionId: 'activity:instant-summons:instant-summons-controller:modifiers:0',
      label: '瞬间召唤·物品连结',
      source: {
        kind: 'spell', actorId, pluginId: 'srd-5.1', rulesId: 'instant-summons',
        spellLevel: 8, magical: true,
      },
      targetId: actorId,
      grantedActivities: ['spell:instant-summons:recall'],
      duration: { type: 'permanent' },
    })
    const afterFirstHeadlessTransition: Character[] = [{
      ...second.characters[0],
      dnd5eCombatState: {
        ...(second.characters[0].dnd5eCombatState ?? { schemaVersion: 2 as const }),
        activeEffects: [controller],
        spellAuthorityRecords: {
          [parchmentRecordId]: {
            schemaVersion: 1, id: parchmentRecordId, kind: 'linked-planar-object',
            profile: 'instant-summons', sourceActorId: actorId, subjectActorId: actorId,
            sourceActivityId: 'spell:instant-summons', createdWorldMinute: 2,
            inventoryInstanceId: parchment.instanceId, spellLevel: 8, planarState: 'material',
          },
        },
      },
    }]
    const recall = (current: Character[], recordId: string, receiptId: string) =>
      applyDnd5eLinkedSpellAuthorityInventoryHandoff(current, {
        sourceCharacterId: characterId, sourceActorAuthorityId: actorId, receiptId,
        transitions: [{
          kind: 'transition-spell-authority', operationId: 'recall-object',
          sourceActivityId: 'spell:instant-summons:recall', sourceActorId: actorId,
          targetId: actorId, recordKind: 'linked-planar-object',
          linkedObjectProfile: 'instant-summons', authorityRecordId: recordId,
          transition: 'recall-to-source',
        }],
      })
    const recalledKnife = recall(afterFirstHeadlessTransition, knifeRecordId, 'instant-summons:multi:recall-one')
    expect(recalledKnife.ok).toBe(true)
    if (!recalledKnife.ok) return
    expect(recalledKnife.characters[0].dnd5eCombatState?.activeEffects?.map((effect) => effect.id))
      .toEqual([controller.id])
    expect(normalizeDnd5eInventory(recalledKnife.characters[0]).entries.find((entry) =>
      entry.instanceId === parchment.instanceId)).toMatchObject({
        linkedSpellAuthorityRecordId: parchmentRecordId,
      })
    expect(normalizeDnd5eInventory(recalledKnife.characters[0]).entries
      .filter((entry) => entry.templateId === 'srd-5.1:item:sapphire-1000gp')
      .reduce((sum, entry) => sum + entry.quantity, 0)).toBe(1)

    const afterSecondHeadlessTransition: Character[] = [{
      ...recalledKnife.characters[0],
      dnd5eCombatState: {
        ...(recalledKnife.characters[0].dnd5eCombatState ?? { schemaVersion: 2 as const }),
        activeEffects: [controller],
        spellAuthorityRecords: undefined,
      },
    }]
    const recalledParchment = recall(
      afterSecondHeadlessTransition,
      parchmentRecordId,
      'instant-summons:multi:recall-two',
    )
    expect(recalledParchment.ok).toBe(true)
    if (!recalledParchment.ok) return
    expect(recalledParchment.characters[0].dnd5eCombatState?.activeEffects).toBeUndefined()
    expect(normalizeDnd5eInventory(recalledParchment.characters[0]).entries
      .filter((entry) => entry.templateId === 'srd-5.1:item:sapphire-1000gp')
      .reduce((sum, entry) => sum + entry.quantity, 0)).toBe(0)
  })

  it('ends Instant Summons when Dispel Magic targets its exact sapphire without consuming it', () => {
    const actorId = 'instant-summons-token'
    let characters = applyDnd5eInventoryMutation([character('dispel-caster')], {
      type: 'grant', characterId: 'dispel-caster',
      templateId: 'srd-5.1:item:small-knife', quantity: 1,
    }).characters
    characters = applyDnd5eInventoryMutation(characters, {
      type: 'grant', characterId: 'dispel-caster',
      templateId: 'srd-5.1:item:sapphire-1000gp', quantity: 1,
    }).characters
    const knife = inventoryEntry(characters[0], 'srd-5.1:item:small-knife')
    const recordId = `linked-planar-object:instant-summons:${actorId}:${knife.instanceId}`
    const established = applyDnd5eLinkedSpellAuthorityInventoryHandoff(characters, {
      sourceCharacterId: 'dispel-caster', sourceActorAuthorityId: actorId,
      receiptId: 'instant-summons:dispel-establish',
      expectedInventoryRevision: normalizeDnd5eInventory(characters[0]).revision,
      establishments: [{
        kind: 'establish-spell-authority', operationId: 'bind-object',
        sourceActivityId: 'spell:instant-summons', sourceActorId: actorId,
        targetId: actorId, recordKind: 'linked-planar-object',
        linkedObjectProfile: 'instant-summons', inventoryInstanceId: knife.instanceId,
      }],
    })
    expect(established.ok).toBe(true)
    if (!established.ok) return
    const controller = createDnd5eMechanicalEffect({
      definitionId: 'activity:instant-summons:instant-summons-controller:modifiers:0',
      label: '瞬间召唤·物品连结',
      source: {
        kind: 'spell', actorId, pluginId: 'srd-5.1', rulesId: 'instant-summons',
        spellLevel: 6, magical: true,
      },
      targetId: actorId,
      grantedActivities: ['spell:instant-summons:recall'],
      duration: { type: 'permanent' },
    })
    const withAuthority = established.characters.map((candidate) => candidate.id === 'dispel-caster'
      ? {
          ...candidate,
          dnd5eCombatState: {
            ...(candidate.dnd5eCombatState ?? { schemaVersion: 2 as const }),
            activeEffects: [controller],
            spellAuthorityRecords: {
              [recordId]: {
                schemaVersion: 1 as const, id: recordId, kind: 'linked-planar-object' as const,
                sourceActorId: actorId, subjectActorId: actorId,
                sourceActivityId: 'spell:instant-summons', createdWorldMinute: 1,
                profile: 'instant-summons' as const, inventoryInstanceId: knife.instanceId,
                planarState: 'material' as const,
              },
            },
          },
        }
      : candidate)
    const sapphire = inventoryEntry(withAuthority[0], 'srd-5.1:item:sapphire-1000gp')
    const target = dnd5eInstantSummonsSapphireDispelTarget(withAuthority, sapphire.instanceId)
    expect(target).toMatchObject({ recordId, sourceActorAuthorityId: actorId })
    if (!target) return
    const dispelled = applyDnd5eInstantSummonsSapphireDispel(withAuthority, target)
    expect(dispelled.ok).toBe(true)
    if (!dispelled.ok) return
    expect(inventoryEntry(dispelled.characters[0], 'srd-5.1:item:sapphire-1000gp')).toMatchObject({
      instanceId: sapphire.instanceId,
      quantity: 1,
      linkedSpellFocusAuthorityRecordId: undefined,
    })
    expect(inventoryEntry(dispelled.characters[0], 'srd-5.1:item:small-knife'))
      .toMatchObject({ linkedSpellAuthorityRecordId: undefined })
    expect(dispelled.characters[0].dnd5eCombatState?.spellAuthorityRecords?.[recordId]).toBeUndefined()
    expect(dispelled.characters[0].dnd5eCombatState?.activeEffects).toBeUndefined()
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

  it('cannot bypass a structured class attunement requirement with UI confirmation', () => {
    const fighter = character('fighter')
    const granted = applyDnd5eInventoryMutation([fighter], {
      type: 'grant', characterId: fighter.id, templateId: 'srd-5.1:magic-item:holy-avenger', quantity: 1,
    })
    const holyAvenger = inventoryEntry(granted.characters[0], 'srd-5.1:magic-item:holy-avenger')
    expect(applyDnd5eInventoryMutation(granted.characters, {
      type: 'prepare-attunement', characterId: fighter.id, instanceId: holyAvenger.instanceId,
      dmPrerequisiteConfirmed: true,
    })).toMatchObject({ ok: false, reason: 'attunement-prerequisite' })

    const thief = normalizeCharacter({
      ...character('thief'), charClass: '游荡者', level: 13,
      dnd5eClassLevels: { rogue: 13 },
      dnd5eClassChoices: { classes: { rogue: { subclass: 'thief' } } },
    })
    const thiefGranted = applyDnd5eInventoryMutation([thief], {
      type: 'grant', characterId: thief.id, templateId: 'srd-5.1:magic-item:holy-avenger', quantity: 1,
    })
    const thiefItem = inventoryEntry(thiefGranted.characters[0], 'srd-5.1:magic-item:holy-avenger')
    expect(applyDnd5eInventoryMutation(thiefGranted.characters, {
      type: 'prepare-attunement', characterId: thief.id, instanceId: thiefItem.instanceId,
    })).toMatchObject({ ok: true })
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
    expect(migrated.schemaVersion).toBe(3)
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
    const afterDawn = restoreDnd5eInventoryResources(afterLong, 'dawn')
    expect(afterDawn.dnd5eInventory?.entries[0]).toMatchObject({ resources: { dawn: { current: 2 } } })
  })

  it('rolls dawn charge recovery and resolves last-charge destruction on the authoritative item instance', () => {
    const hero = character('wand-owner')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id,
      templateId: 'srd-5.1:magic-item:wand-of-magic-missiles', quantity: 1,
    })
    const wand = inventoryEntry(granted.characters[0], 'srd-5.1:magic-item:wand-of-magic-missiles')
    const partiallySpent = applyDnd5eInventoryActivityCosts(granted.characters[0], {
      instanceId: wand.instanceId,
      costs: [{ kind: 'resource', resourceId: 'charges', amount: 5 }],
      receiptId: 'wand:spend-five',
      expectedInventoryRevision: normalizeDnd5eInventory(granted.characters[0]).revision ?? 0,
    })
    expect(partiallySpent.ok).toBe(true)
    if (!partiallySpent.ok) return
    expect(inventoryEntry(partiallySpent.character, wand.templateId).resources?.charges.current).toBe(2)
    const recovered = restoreDnd5eInventoryResources(partiallySpent.character, 'dawn', {
      [`${wand.instanceId}:charges`]: [2],
    })
    expect(inventoryEntry(recovered, wand.templateId).resources?.charges.current).toBe(5)

    const lastCharge = applyDnd5eInventoryActivityCosts(recovered, {
      instanceId: wand.instanceId,
      costs: [{ kind: 'resource', resourceId: 'charges', amount: 5 }],
      receiptId: 'wand:last-charge',
      expectedInventoryRevision: normalizeDnd5eInventory(recovered).revision ?? 0,
      lastChargeDestructionRolls: { charges: 1 },
    })
    expect(lastCharge).toMatchObject({
      ok: true,
      lastChargeChecks: [{ resourceId: 'charges', roll: 1, dieSides: 20, destroyed: true }],
    })
    if (!lastCharge.ok) return
    expect(normalizeDnd5eInventory(lastCharge.character).entries.some(
      (entry) => entry.instanceId === wand.instanceId,
    )).toBe(false)
  })

  it('migrates currency, calculates coin weight, and rejects overspending', () => {
    const hero = { ...character('coin-hero'), abilities: { ...character('coin-hero').abilities, str: 10 } }
    const added = applyDnd5eInventoryMutation([hero], {
      type: 'adjust-currency', characterId: hero.id, currency: 'gp', delta: 250,
    })
    expect(added.ok).toBe(true)
    expect(added.characters[0].dnd5eInventory).toMatchObject({ schemaVersion: 3, currency: { gp: 250 } })
    expect(dnd5eInventoryLoad(added.characters[0])).toMatchObject({ currencyWeightLb: 5, carryingCapacityLb: 150 })
    expect(applyDnd5eInventoryMutation(added.characters, {
      type: 'adjust-currency', characterId: hero.id, currency: 'gp', delta: -251,
    })).toMatchObject({ ok: false, reason: 'insufficient-currency' })
  })

  it('enforces container capacity and prevents container cycles', () => {
    let characters = applyDnd5eInventoryMutation([character('packer')], {
      type: 'grant', characterId: 'packer', templateId: 'srd-5.1:item:backpack', quantity: 1,
    }).characters
    characters = applyDnd5eInventoryMutation(characters, {
      type: 'grant', characterId: 'packer', templateId: 'srd-5.1:item:chest', quantity: 1,
    }).characters
    characters = applyDnd5eInventoryMutation(characters, {
      type: 'grant', characterId: 'packer', templateId: 'srd-5.1:item:rope-hempen-50-feet', quantity: 4,
    }).characters
    const backpack = inventoryEntry(characters[0], 'srd-5.1:item:backpack')
    const chest = inventoryEntry(characters[0], 'srd-5.1:item:chest')
    const rope = inventoryEntry(characters[0], 'srd-5.1:item:rope-hempen-50-feet')
    expect(applyDnd5eInventoryMutation(characters, {
      type: 'set-container', characterId: 'packer', instanceId: rope.instanceId, containerInstanceId: backpack.instanceId,
    })).toMatchObject({ ok: false, reason: 'container-capacity' })
    const nested = applyDnd5eInventoryMutation(characters, {
      type: 'set-container', characterId: 'packer', instanceId: backpack.instanceId, containerInstanceId: chest.instanceId,
    })
    expect(nested.ok).toBe(true)
    expect(applyDnd5eInventoryMutation(nested.characters, {
      type: 'set-container', characterId: 'packer', instanceId: chest.instanceId, containerInstanceId: backpack.instanceId,
    })).toMatchObject({ ok: false, reason: 'container-cycle' })
  })

  it('keeps unidentified magic item rules inactive until DM identification', () => {
    const hero = character('unknown-owner')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1, identified: false,
    })
    const ring = inventoryEntry(granted.characters[0], 'srd-5.1:magic-item:ring-of-protection')
    expect(ring.identified).toBe(false)
    expect(applyDnd5eInventoryMutation(granted.characters, {
      type: 'prepare-attunement', characterId: hero.id, instanceId: ring.instanceId,
    })).toMatchObject({ ok: false, reason: 'item-unidentified' })
    const identified = applyDnd5eInventoryMutation(granted.characters, {
      type: 'identify', characterId: hero.id, instanceId: ring.instanceId,
    })
    expect(inventoryEntry(identified.characters[0], ring.templateId).identified).toBe(true)
  })

  it('lists only unidentified magic instances and includes their rarity', () => {
    const hero = character('identify-candidates')
    const unidentifiedGrant = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id,
      templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1, identified: false,
    })
    const withMundane = applyDnd5eInventoryMutation(unidentifiedGrant.characters, {
      type: 'grant', characterId: hero.id,
      templateId: 'srd-5.1:item:rope-hempen-50-feet', quantity: 1,
    })
    const entries = normalizeDnd5eInventory(withMundane.characters[0]).entries
    const candidates = entries.filter(dnd5eInventoryEntryIsUnidentifiedMagicItem)

    expect(candidates).toHaveLength(1)
    expect(dnd5eInventoryIdentificationOptionLabel(candidates[0]!)).toBe('防护戒指（稀有）')
  })

  it('keeps a player-redacted magic item eligible for Identify without revealing its template', () => {
    const hero = character('projected-identify-candidate')
    const projected = normalizeDnd5eInventory({
      ...hero,
      dnd5eInventory: {
        schemaVersion: 3,
        revision: 7,
        entries: [{
          instanceId: 'mystery-1',
          templateId: 'unidentified:mystery-1',
          item: {
            id: 'unidentified:mystery-1',
            name: '未鉴定物品',
            category: 'magic-item',
            icon: 'generic',
            description: '该物品尚未鉴定。',
            rulesText: '鉴定完成后才会公开其名称与规则效果。',
            stackable: false,
            source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
          },
          quantity: 1,
          identified: false,
          unidentifiedMagicItemRarity: 'legendary',
          acquiredAt: 1,
        }],
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      },
    }).entries[0]!

    expect(projected.identified).toBe(false)
    expect(dnd5eInventoryEntryIsUnidentifiedMagicItem(projected)).toBe(true)
    expect(dnd5eInventoryIdentificationOptionLabel(projected)).toBe('未鉴定物品（传奇）')
    expect(projected.templateId).toBe('unidentified:mystery-1')
  })

  it('lists every visible player inventory as character - item - rarity', () => {
    const first = character('first-owner')
    first.name = '艾拉'
    first.visibleToPlayers = true
    const second = character('second-owner')
    second.name = '博林'
    second.visibleToPlayers = true
    const hidden = character('hidden-owner')
    hidden.name = '隐藏角色'
    hidden.visibleToPlayers = false

    const firstGrant = applyDnd5eInventoryMutation([first], {
      type: 'grant', characterId: first.id,
      templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1, identified: false,
    }).characters[0]!
    const secondGrant = applyDnd5eInventoryMutation([second], {
      type: 'grant', characterId: second.id,
      templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1, identified: false,
    }).characters[0]!
    const hiddenGrant = applyDnd5eInventoryMutation([hidden], {
      type: 'grant', characterId: hidden.id,
      templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1, identified: false,
    }).characters[0]!

    const candidates = dnd5eInventoryIdentificationCandidates([firstGrant, secondGrant, hiddenGrant])
    expect(candidates.map((candidate) => candidate.characterId)).toEqual(['first-owner', 'second-owner'])
    expect(candidates.map((candidate) => candidate.label)).toEqual([
      '艾拉 - 防护戒指 - 稀有',
      '博林 - 防护戒指 - 稀有',
    ])
    expect(candidates.every((candidate) => candidate.inventoryRevision > 0)).toBe(true)
  })

  it('deduplicates an authoritative Identify mutation with its durable command receipt', () => {
    const hero = character('identify-owner')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id,
      templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1, identified: false,
    })
    const owner = granted.characters[0]
    const ring = inventoryEntry(owner, 'srd-5.1:magic-item:ring-of-protection')
    const revision = normalizeDnd5eInventory(owner).revision ?? 0
    const identified = applyDnd5eInventoryMutation([owner], {
      type: 'identify', characterId: hero.id, instanceId: ring.instanceId,
      receiptId: 'activity:identify:command-1', expectedInventoryRevision: revision,
    })
    expect(identified.ok).toBe(true)
    expect(inventoryEntry(identified.characters[0], ring.templateId).identified).toBe(true)
    expect(normalizeDnd5eInventory(identified.characters[0]).authorityUseReceipts)
      .toContain('activity:identify:command-1')
    const replay = applyDnd5eInventoryMutation(identified.characters, {
      type: 'identify', characterId: hero.id, instanceId: ring.instanceId,
      receiptId: 'activity:identify:command-1', expectedInventoryRevision: revision,
    })
    expect(replay).toMatchObject({ ok: true, deduplicated: true })
  })

  it('rejects mundane and already identified objects as Identify targets', () => {
    const hero = character('mundane-identify-owner')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id,
      templateId: 'srd-5.1:item:rope-hempen-50-feet', quantity: 1,
    })
    const owner = granted.characters[0]
    const rope = inventoryEntry(owner, 'srd-5.1:item:rope-hempen-50-feet')
    expect(applyDnd5eInventoryMutation([owner], {
      type: 'identify', characterId: hero.id, instanceId: rope.instanceId,
      receiptId: 'activity:identify:mundane',
      expectedInventoryRevision: normalizeDnd5eInventory(owner).revision ?? 0,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const ringGranted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id,
      templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1, identified: true,
    })
    const ring = inventoryEntry(ringGranted.characters[0], 'srd-5.1:magic-item:ring-of-protection')
    expect(applyDnd5eInventoryMutation(ringGranted.characters, {
      type: 'identify', characterId: hero.id, instanceId: ring.instanceId,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('lets the DM author poison and disease on food before an authoritative purification', () => {
    const hero = character('purify-owner')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:item:rations-one-day', quantity: 2,
    })
    const rations = inventoryEntry(granted.characters[0], 'srd-5.1:item:rations-one-day')
    const contaminated = applyDnd5eInventoryMutation(granted.characters, {
      type: 'set-consumable-contaminants', characterId: hero.id, instanceId: rations.instanceId,
      contaminants: ['poison', 'disease'],
    })
    expect(inventoryEntry(contaminated.characters[0], rations.templateId).contaminants)
      .toEqual(['poison', 'disease'])
    const revision = normalizeDnd5eInventory(contaminated.characters[0]).revision ?? 0
    const purified = applyDnd5eInventoryMutation(contaminated.characters, {
      type: 'purify-consumable', characterId: hero.id, instanceId: rations.instanceId,
      receiptId: 'activity:purify:command-1', expectedInventoryRevision: revision,
    })
    expect(purified.ok).toBe(true)
    expect(inventoryEntry(purified.characters[0], rations.templateId).contaminants).toHaveLength(0)
    expect(purified.message).toContain('毒素与疾病污染已被清除')
  })

  it('consumes standard ammunition without deleting unrelated inventory', () => {
    const hero = character('archer')
    const granted = applyDnd5eInventoryMutation([hero], {
      type: 'grant', characterId: hero.id, templateId: 'srd-5.1:item:arrows', quantity: 2,
    })
    const fired = consumeDnd5eWeaponAmmunition(granted.characters[0], 'dnd5e-longbow')
    expect(fired.ok).toBe(true)
    if (!fired.ok) return
    expect(inventoryEntry(fired.character, 'srd-5.1:item:arrows').quantity).toBe(1)
    const last = consumeDnd5eWeaponAmmunition(fired.character, 'dnd5e-longbow')
    expect(last.ok).toBe(true)
    if (!last.ok) return
    expect(consumeDnd5eWeaponAmmunition(last.character, 'dnd5e-longbow')).toMatchObject({ ok: false, reason: 'ammunition-unavailable' })
  })

  it('atomically grants an interaction reward and deduplicates the authority receipt', () => {
    const hero = character('searcher')
    const receiptId = 'scene-interaction:scene:bookshelf:character:searcher'
    const granted = applyDnd5eInventoryGrantBundle([hero], {
      characterId: hero.id,
      receiptId,
      grants: [
        { templateId: 'srd-5.1:item:potion-of-healing', quantity: 1 },
        { templateId: 'missing-template', quantity: 1 },
      ],
    })
    expect(granted).toMatchObject({ ok: false, reason: 'template-not-found' })
    expect(granted.characters[0].dnd5eInventory?.entries).toEqual([])

    const valid = applyDnd5eInventoryGrantBundle([hero], {
      characterId: hero.id,
      receiptId,
      grants: [{ templateId: 'srd-5.1:item:potion-of-healing', quantity: 1 }],
      currencyGrants: [{ currency: 'gp', amount: 12 }],
    })
    expect(valid.ok).toBe(true)
    expect(inventoryEntry(valid.characters[0], 'srd-5.1:item:potion-of-healing').quantity).toBe(1)
    expect(valid.characters[0].dnd5eInventory?.currency?.gp).toBe(12)
    expect(valid.characters[0].dnd5eInventory?.authorityGrantReceipts).toContain(receiptId)

    const replayed = applyDnd5eInventoryGrantBundle(valid.characters, {
      characterId: hero.id,
      receiptId,
      grants: [{ templateId: 'srd-5.1:item:potion-of-healing', quantity: 1 }],
      currencyGrants: [{ currency: 'gp', amount: 12 }],
    })
    expect(replayed).toMatchObject({ ok: true, deduplicated: true })
    expect(inventoryEntry(replayed.characters[0], 'srd-5.1:item:potion-of-healing').quantity).toBe(1)
    expect(replayed.characters[0].dnd5eInventory?.currency?.gp).toBe(12)

    const invalidCurrency = applyDnd5eInventoryGrantBundle([hero], {
      characterId: hero.id,
      receiptId: `${receiptId}:invalid`,
      grants: [{ templateId: 'srd-5.1:item:potion-of-healing', quantity: 1 }],
      currencyGrants: [{ currency: 'gp', amount: -1 }],
    })
    expect(invalidCurrency).toMatchObject({ ok: false, reason: 'invalid-currency' })
    expect(invalidCurrency.characters[0].dnd5eInventory?.entries).toEqual([])
  })

  it('uses deterministic Goodberries and expires generated provisions on the campaign clock', () => {
    const hero = character('goodberry-owner', 10)
    const granted = applyDnd5eInventoryGrantBundle([hero], {
      characterId: hero.id,
      receiptId: 'spell:goodberry:cast-1',
      grants: [{
        templateId: 'srd-5.1:item:goodberry',
        quantity: 10,
        expiresAtWorldMinute: 2_440,
        generatedByRulesId: 'activity:srd-5.1:spell-goodberry-cast',
      }],
    })
    expect(granted.ok).toBe(true)
    const berries = inventoryEntry(granted.characters[0], 'srd-5.1:item:goodberry')
    expect(berries).toMatchObject({
      quantity: 10,
      expiresAtWorldMinute: 2_440,
      generatedByRulesId: 'activity:srd-5.1:spell-goodberry-cast',
    })

    const eaten = applyDnd5eInventoryMutation(granted.characters, {
      type: 'use', characterId: hero.id, instanceId: berries.instanceId, healingRolls: [],
    })
    expect(eaten).toMatchObject({ ok: true, healingRolled: 1, healingApplied: 1 })
    expect(eaten.characters[0].currentHp).toBe(11)
    expect(inventoryEntry(eaten.characters[0], 'srd-5.1:item:goodberry').quantity).toBe(9)

    const beforeExpiry = expireDnd5eInventoryItemsAtWorldMinute(eaten.characters[0], 2_439)
    expect(inventoryEntry(beforeExpiry, 'srd-5.1:item:goodberry').quantity).toBe(9)
    const expired = expireDnd5eInventoryItemsAtWorldMinute(beforeExpiry, 2_440)
    expect(normalizeDnd5eInventory(expired).entries.some((entry) =>
      entry.templateId === 'srd-5.1:item:goodberry')).toBe(false)
  })
})
