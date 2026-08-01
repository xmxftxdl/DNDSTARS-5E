import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { getDnd5eSrdCombatSpell } from './spells'

const abilities = { str: 10, dex: 10, con: 12, int: 10, wis: 18, cha: 10 } as const

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Parameters<typeof createDnd5eCombatant>[0]> = {},
) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 3,
    armorClass: 14,
    currentHp: 10,
    maxHp: 30,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('Prayer of Healing Headless', () => {
  it('declares the SRD multi-target healing and upcast rules', () => {
    expect(getDnd5eSrdCombatSpell('prayer-of-healing')).toMatchObject({
      level: 2,
      classes: ['cleric'],
      rangeFeet: 30,
      target: 'ally',
      effect: 'healing',
      requiresVisibleTarget: true,
      dice: { count: 2, sides: 8, perHigherSlot: 1 },
      addSpellcastingModifier: true,
      maximumTargets: 6,
    })
  })

  it('applies one upcast healing roll to every selected target and caps hit points', () => {
    const cleric = combatant('cleric', 20, {
      classId: 'cleric',
      level: 5,
      classSelections: { 'spell-prepared': ['prayer-of-healing'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const first = combatant('first', 10, { currentHp: 1, maxHp: 30 })
    const second = combatant('second', 5, { currentHp: 25, maxHp: 30 })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('prayer-of-healing', [cleric, first, second]),
      {
        type: 'cast-spell',
        actorId: cleric.id,
        targetId: first.id,
        targetIds: [first.id, second.id],
        spellId: 'prayer-of-healing',
        slotLevel: 3,
        effectRolls: [3, 4, 5],
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[first.id].currentHp).toBe(17)
    expect(result.state.combatants[second.id].currentHp).toBe(30)
    expect(result.state.combatants[cleric.id].classResources['dnd5e-spell-slot-3'].current).toBe(0)
    expect(result.events).toContainEqual({
      type: 'healing-applied', targetId: first.id, amount: 16, hpBefore: 1, hpAfter: 17,
    })
    expect(result.events).toContainEqual({
      type: 'healing-applied', targetId: second.id, amount: 5, hpBefore: 25, hpAfter: 30,
    })
  })

  it.each(['undead', 'construct'])('rejects %s targets without spending the spell slot', (creatureType) => {
    const cleric = combatant('cleric', 20, {
      classId: 'cleric',
      level: 3,
      classSelections: { 'spell-prepared': ['prayer-of-healing'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const invalidTarget = combatant('invalid-target', 10, { creatureType })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat(`prayer-of-healing-${creatureType}`, [cleric, invalidTarget]),
      {
        type: 'cast-spell',
        actorId: cleric.id,
        targetId: invalidTarget.id,
        spellId: 'prayer-of-healing',
        slotLevel: 2,
        effectRolls: [4, 4],
      },
    )

    expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(result.state.combatants[cleric.id].classResources['dnd5e-spell-slot-2'].current).toBe(1)
  })
})
