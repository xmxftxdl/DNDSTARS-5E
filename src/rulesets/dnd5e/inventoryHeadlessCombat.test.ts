import { describe, expect, it } from 'vitest'
import type { Dnd5eInventoryHeadlessEffectSnapshot } from '../../types/inventory'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { dnd5eInventoryEffectRollKey } from './inventoryHeadlessRuntime'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function combatant(id: string, initiative: number, patch: Record<string, unknown> = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: id === 'attacker' ? 'player' : 'dm',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function effectSnapshot(input: {
  instanceId: string
  equipmentId: string
  effect: Dnd5eInventoryHeadlessEffectSnapshot['effect']
}): Dnd5eInventoryHeadlessEffectSnapshot {
  return {
    instanceId: input.instanceId,
    templateId: `plugin:${input.instanceId}`,
    itemName: input.instanceId,
    equipmentId: input.equipmentId,
    equippedSlot: 'mainWeapon',
    effectId: input.effect.id ?? input.effect.kind,
    effect: input.effect,
    resources: {
      charges: {
        id: 'charges',
        label: 'Charges',
        current: 1,
        maximum: 1,
        resetOn: 'long-rest',
      },
    },
  }
}

describe('inventory effects in the authoritative combat damage pipeline', () => {
  it('adds Host-validated on-hit damage and consumes the equipped item resource', () => {
    const bonus = effectSnapshot({
      instanceId: 'flame-blade',
      equipmentId: 'plugin:flame-blade',
      effect: {
        schemaVersion: 1,
        id: 'flame-hit',
        kind: 'on-hit-bonus-damage',
        trigger: 'after-attack-hit',
        appliesTo: 'attacks-with-this-weapon',
        damage: { count: 1, sides: 6, bonus: 0 },
        damageType: 'fire',
        resourceId: 'charges',
        resourceCost: 1,
      },
    })
    const attacker = combatant('attacker', 20, {
      inventoryHeadlessEffects: [bonus],
      inventoryRevision: 0,
    })
    const target = combatant('target', 10)
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('inventory-on-hit', [attacker, target]),
      {
        type: 'attack',
        actorId: attacker.id,
        targetId: target.id,
        attackModifier: 5,
        d20: 15,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
        classDamageContext: {
          weaponId: 'plugin:flame-blade',
          mode: 'melee',
          finesse: false,
          strengthBased: true,
          weaponDamageSides: 8,
          damageType: 'slashing',
          adjacentEnemyOfTarget: false,
        },
        inventoryEffectRolls: {
          [dnd5eInventoryEffectRollKey('flame-blade', 'flame-hit')]: [4],
        },
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(11)
    expect(result.state.combatants[attacker.id].inventoryRevision).toBe(1)
    expect(result.state.combatants[attacker.id].inventoryHeadlessEffects?.[0]
      .resources.charges.current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'inventory-headless-effect-applied',
      actorId: attacker.id,
      targetId: target.id,
      effectKind: 'on-hit-bonus-damage',
      amount: 4,
      damageType: 'fire',
    }))
  })

  it('settles on-hit item damage inside an opportunity-attack transaction', () => {
    const bonus = effectSnapshot({
      instanceId: 'reactive-blade',
      equipmentId: 'plugin:reactive-blade',
      effect: {
        schemaVersion: 1,
        id: 'reactive-hit',
        kind: 'on-hit-bonus-damage',
        trigger: 'after-attack-hit',
        appliesTo: 'attacks-with-this-weapon',
        damage: { count: 1, sides: 6, bonus: 1 },
        damageType: 'inherit',
        resourceId: 'charges',
        resourceCost: 1,
      },
    })
    const attacker = combatant('attacker', 20, {
      inventoryHeadlessEffects: [bonus],
      inventoryRevision: 0,
    })
    const target = combatant('target', 10)
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('inventory-reaction-hit', [attacker, target]),
      {
        type: 'opportunity-attack',
        actorId: attacker.id,
        targetId: target.id,
        attackModifier: 5,
        d20: 15,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
        classDamageContext: {
          weaponId: 'plugin:reactive-blade',
          mode: 'melee',
          finesse: false,
          strengthBased: true,
          weaponDamageSides: 8,
          damageType: 'slashing',
          adjacentEnemyOfTarget: false,
        },
        inventoryEffectRolls: {
          [dnd5eInventoryEffectRollKey('reactive-blade', 'reactive-hit')]: [3],
        },
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(11)
    expect(result.state.combatants[attacker.id].turn.reactionAvailable).toBe(false)
    expect(result.state.combatants[attacker.id].inventoryRevision).toBe(1)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'inventory-headless-effect-applied',
      actorId: attacker.id,
      targetId: target.id,
      amount: 4,
      damageType: 'slashing',
    }))
  })

  it('fails closed when a reaction hit omits required item-effect dice', () => {
    const bonus = effectSnapshot({
      instanceId: 'guard-blade',
      equipmentId: 'plugin:guard-blade',
      effect: {
        schemaVersion: 1,
        id: 'guard-hit',
        kind: 'on-hit-bonus-damage',
        trigger: 'after-attack-hit',
        appliesTo: 'attacks-with-this-weapon',
        damage: { count: 1, sides: 6, bonus: 0 },
        damageType: 'force',
        resourceId: 'charges',
        resourceCost: 1,
      },
    })
    const attacker = combatant('attacker', 20, { inventoryHeadlessEffects: [bonus] })
    const target = combatant('target', 10)
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('inventory-reaction-missing-roll', [attacker, target]),
      {
        type: 'opportunity-attack',
        actorId: attacker.id,
        targetId: target.id,
        attackModifier: 5,
        d20: 15,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
        classDamageContext: {
          weaponId: 'plugin:guard-blade',
          mode: 'melee',
          finesse: false,
          strengthBased: true,
          weaponDamageSides: 8,
          damageType: 'slashing',
          adjacentEnemyOfTarget: false,
        },
      },
    )

    expect(result).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('reduces incoming damage and applies a death-prevention effect in the same damage transaction', () => {
    const reduction = effectSnapshot({
      instanceId: 'warding-armor',
      equipmentId: 'plugin:warding-armor',
      effect: {
        schemaVersion: 1,
        id: 'ward',
        kind: 'damage-reduction',
        trigger: 'before-damage',
        amount: 2,
        resourceId: 'charges',
        resourceCost: 1,
      },
    })
    const prevention = effectSnapshot({
      instanceId: 'last-stand-ring',
      equipmentId: 'plugin:last-stand-ring',
      effect: {
        schemaVersion: 1,
        id: 'last-stand',
        kind: 'death-prevention',
        trigger: 'before-drop-to-zero',
        hitPointsAfter: 1,
        resourceId: 'charges',
        resourceCost: 1,
      },
    })
    const attacker = combatant('attacker', 20)
    const target = combatant('target', 10, {
      controller: 'player',
      currentHp: 5,
      maxHp: 20,
      inventoryHeadlessEffects: [reduction, prevention],
      inventoryRevision: 0,
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('inventory-defense', [attacker, target]),
      {
        type: 'attack',
        actorId: attacker.id,
        targetId: target.id,
        attackModifier: 5,
        d20: 15,
        damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'slashing' },
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(1)
    expect(result.state.combatants[target.id].inventoryRevision).toBe(2)
    expect(result.state.combatants[target.id].inventoryHeadlessEffects?.every(
      (entry) => entry.resources.charges.current === 0,
    )).toBe(true)
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'inventory-headless-effect-applied',
        actorId: target.id,
        effectKind: 'damage-reduction',
        amount: 2,
      }),
      expect.objectContaining({
        type: 'inventory-headless-effect-applied',
        actorId: target.id,
        effectKind: 'death-prevention',
        amount: 1,
      }),
    ]))
  })
})
