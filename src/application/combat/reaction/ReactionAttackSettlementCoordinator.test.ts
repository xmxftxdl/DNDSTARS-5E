import { describe, expect, it, vi } from 'vitest'
import type { Dnd5eInventoryHeadlessEffectSnapshot } from '../../../types/inventory'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../../../rulesets/dnd5e/headlessCombatEngine'
import { dnd5eInventoryEffectRollKey } from '../../../rulesets/dnd5e/inventoryHeadlessRuntime'
import { coordinateDnd5eReactionAttackInventorySettlement } from './ReactionAttackSettlementCoordinator'

describe('ReactionAttackSettlementCoordinator', () => {
  it('collects critical item dice and includes fixed bonuses in the damage preview', async () => {
    const effect: Dnd5eInventoryHeadlessEffectSnapshot = {
      instanceId: 'storm-spear',
      templateId: 'plugin:storm-spear',
      itemName: '风暴长矛',
      equipmentId: 'plugin:storm-spear',
      equippedSlot: 'mainWeapon',
      effectId: 'storm-hit',
      effect: {
        schemaVersion: 1,
        id: 'storm-hit',
        kind: 'on-hit-bonus-damage',
        trigger: 'after-attack-hit',
        appliesTo: 'attacks-with-this-weapon',
        damage: { count: 1, sides: 6, bonus: 2 },
        damageType: 'lightning',
      },
      resources: {},
    }
    const actor = createDnd5eCombatant({
      id: 'actor', name: 'actor', controller: 'player', initiative: 10,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      proficiencyBonus: 2, armorClass: 15, currentHp: 20, maxHp: 20,
      temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      inventoryHeadlessEffects: [effect],
    })
    const state = startDnd5eHeadlessCombat('reaction-roll-plan', [actor])
    const rollDice = vi.fn(async () => [3, 4])

    const settlement = await coordinateDnd5eReactionAttackInventorySettlement({
      state,
      actor: state.combatants[actor.id],
      weaponId: 'plugin:storm-spear',
      hit: true,
      critical: true,
      targetLabel: '目标',
      rollDice,
    })

    expect(rollDice).toHaveBeenCalledWith(2, 6, '风暴长矛 · 命中后额外伤害', '目标')
    expect(settlement.inventoryEffectRolls).toEqual({
      [dnd5eInventoryEffectRollKey('storm-spear', 'storm-hit')]: [3, 4],
    })
    expect(settlement.inventoryDamageTotal).toBe(9)
  })

  it('does not roll item effects when the reaction attack misses', async () => {
    const actor = createDnd5eCombatant({
      id: 'actor', name: 'actor', controller: 'player', initiative: 10,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      proficiencyBonus: 2, armorClass: 15, currentHp: 20, maxHp: 20,
      temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    })
    const rollDice = vi.fn(async () => [1])
    const settlement = await coordinateDnd5eReactionAttackInventorySettlement({
      state: startDnd5eHeadlessCombat('reaction-miss', [actor]),
      actor,
      hit: false,
      critical: false,
      targetLabel: '目标',
      rollDice,
    })
    expect(settlement).toEqual({ inventoryDamageTotal: 0 })
    expect(rollDice).not.toHaveBeenCalled()
  })
})
