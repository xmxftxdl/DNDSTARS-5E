import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant } from './headlessCombatEngine'
import {
  dnd5eInventoryEffectRollKey,
  dnd5eOnHitBonusDamageRequirements,
  resolveDnd5eInventoryDamageReduction,
  resolveDnd5eInventoryDeathPrevention,
  resolveDnd5eOnHitBonusDamage,
} from './inventoryHeadlessRuntime'
import type { Dnd5eInventoryHeadlessEffectSnapshot } from '../../types/inventory'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function snapshot(
  effect: Dnd5eInventoryHeadlessEffectSnapshot['effect'],
  current = 4,
): Dnd5eInventoryHeadlessEffectSnapshot {
  return {
    instanceId: 'item-1',
    templateId: 'plugin:item',
    itemName: '测试魔法物品',
    equipmentId: 'plugin:weapon',
    equippedSlot: 'mainWeapon',
    effectId: effect.id ?? effect.kind,
    effect,
    resources: {
      charges: { id: 'charges', label: '充能', current, maximum: 4, resetOn: 'long-rest' },
    },
  }
}

function combatant(effects: Dnd5eInventoryHeadlessEffectSnapshot[]) {
  return createDnd5eCombatant({
    id: 'hero', name: 'Hero', controller: 'player', initiative: 10,
    abilities, proficiencyBonus: 2, armorClass: 16, currentHp: 20, maxHp: 20,
    temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    inventoryHeadlessEffects: effects,
    inventoryRevision: 0,
  })
}

describe('inventory Headless runtime V1', () => {
  it('derives and validates on-hit bonus damage rolls, then spends the instance resource', () => {
    const effect = snapshot({
      schemaVersion: 1,
      id: 'flame-hit',
      kind: 'on-hit-bonus-damage',
      trigger: 'after-attack-hit',
      appliesTo: 'attacks-with-this-weapon',
      damage: { count: 1, sides: 6, bonus: 2 },
      damageType: 'fire',
      doubleDiceOnCritical: true,
      oncePerTurn: true,
      resourceId: 'charges',
      resourceCost: 1,
    })
    const actor = combatant([effect])
    const key = dnd5eInventoryEffectRollKey('item-1', 'flame-hit')
    expect(dnd5eOnHitBonusDamageRequirements({
      combatant: actor, weaponId: 'plugin:weapon', critical: true, turnKey: 'combat:1:hero',
    })).toContainEqual(expect.objectContaining({ key, count: 2, sides: 6, damageType: 'fire' }))

    expect(resolveDnd5eOnHitBonusDamage({
      combatant: actor,
      weaponId: 'plugin:weapon',
      inheritedDamageType: 'slashing',
      critical: true,
      turnKey: 'combat:1:hero',
      rolls: { [key]: [4, 5] },
    })).toMatchObject({
      ok: true,
      components: [{ total: 11, type: 'fire', application: { kind: 'on-hit-bonus-damage' } }],
    })
    expect(actor.inventoryHeadlessEffects?.[0].resources.charges.current).toBe(3)
    expect(actor.inventoryRevision).toBe(1)
    expect(dnd5eOnHitBonusDamageRequirements({
      combatant: actor, weaponId: 'plugin:weapon', critical: false, turnKey: 'combat:1:hero',
    })).toEqual([])
  })

  it('applies damage reduction once per turn and fails closed on a depleted charge', () => {
    const actor = combatant([snapshot({
      schemaVersion: 1,
      id: 'ward',
      kind: 'damage-reduction',
      trigger: 'before-damage',
      amount: 5,
      damageTypes: ['slashing'],
      oncePerTurn: true,
      resourceId: 'charges',
      resourceCost: 1,
    })])
    expect(resolveDnd5eInventoryDamageReduction({
      combatant: actor, amount: 12, damageTypes: ['slashing'], turnKey: 'combat:1:hero',
    })).toMatchObject({ amount: 7, applications: [{ amount: 5, kind: 'damage-reduction' }] })
    expect(resolveDnd5eInventoryDamageReduction({
      combatant: actor, amount: 12, damageTypes: ['slashing'], turnKey: 'combat:1:hero',
    })).toMatchObject({ amount: 12, applications: [] })
  })

  it('never spends a shared item resource more than once in one resolution', () => {
    const first = snapshot({
      schemaVersion: 1,
      id: 'a-fire',
      kind: 'on-hit-bonus-damage',
      trigger: 'after-attack-hit',
      appliesTo: 'weapon-attacks',
      damage: { count: 1, sides: 6, bonus: 0 },
      damageType: 'fire',
      resourceId: 'charges',
      resourceCost: 1,
    }, 1)
    const second = snapshot({
      schemaVersion: 1,
      id: 'b-cold',
      kind: 'on-hit-bonus-damage',
      trigger: 'after-attack-hit',
      appliesTo: 'weapon-attacks',
      damage: { count: 1, sides: 6, bonus: 0 },
      damageType: 'cold',
      resourceId: 'charges',
      resourceCost: 1,
    }, 1)
    const actor = combatant([first, second])
    const requirements = dnd5eOnHitBonusDamageRequirements({
      combatant: actor,
      critical: false,
      turnKey: 'combat:1:hero',
    })

    expect(requirements).toHaveLength(1)
    expect(requirements[0].effectId).toBe('a-fire')
    const result = resolveDnd5eOnHitBonusDamage({
      combatant: actor,
      inheritedDamageType: 'slashing',
      critical: false,
      turnKey: 'combat:1:hero',
      rolls: { [requirements[0].key]: [3] },
    })
    expect(result).toMatchObject({ ok: true, components: [{ total: 3, type: 'fire' }] })
    expect(actor.inventoryHeadlessEffects?.every(
      (entry) => entry.resources.charges.current === 0,
    )).toBe(true)
  })

  it('prevents dropping to zero but does not override massive-damage death by default', () => {
    const effect = snapshot({
      schemaVersion: 1,
      id: 'last-stand',
      kind: 'death-prevention',
      trigger: 'before-drop-to-zero',
      hitPointsAfter: 1,
      resourceId: 'charges',
      resourceCost: 1,
    })
    const actor = combatant([effect])
    actor.currentHp = 0
    expect(resolveDnd5eInventoryDeathPrevention({
      combatant: actor, remainingDamageAfterZero: 5,
    })).toMatchObject({ kind: 'death-prevention', amount: 1 })
    expect(actor.currentHp).toBe(1)

    const massive = combatant([effect])
    massive.currentHp = 0
    expect(resolveDnd5eInventoryDeathPrevention({
      combatant: massive, remainingDamageAfterZero: massive.maxHp,
    })).toBeUndefined()
    expect(massive.currentHp).toBe(0)
  })
})
