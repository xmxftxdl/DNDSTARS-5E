import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { dnd5eActiveOptionalBonusDice } from './activeEffects'

const abilities = { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 10 } as const

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('SRD 5.1 可选奖励骰 ActiveEffect', () => {
  it('神导术授予可选 d4，跳过时保留，使用后加入属性检定并结束效果与专注', () => {
    const cleric = combatant('cleric', 20, {
      classId: 'cleric',
      level: 1,
      classSelections: { 'spell-cantrips': ['guidance'] },
    })
    const ally = combatant('ally', 10)
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('guidance', [cleric, ally]),
      {
        type: 'cast-spell',
        actorId: cleric.id,
        targetId: ally.id,
        spellId: 'guidance',
        slotLevel: 0,
        effectRolls: [],
      },
    )
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return

    const effect = dnd5eActiveOptionalBonusDice(
      cast.state.combatants[ally.id].classState.activeEffects,
      'ability-check',
    )[0]
    expect(effect).toMatchObject({
      definitionId: 'srd-5.1:spell:guidance',
      modifiers: {
        optionalBonusDie: {
          sides: 4,
          appliesTo: ['ability-check'],
          consumeOnUse: true,
        },
      },
    })
    expect(cast.state.combatants[cleric.id].concentrating).toBe(true)

    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(ally.id)
    const skipped = resolveDnd5eHeadlessAction(structuredClone(cast.state), {
      type: 'ability-check',
      actorId: ally.id,
      ability: 'dex',
      d20: 8,
      dc: 13,
    })
    expect(skipped.ok).toBe(true)
    if (!skipped.ok) return
    expect(skipped.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      total: 10,
      success: false,
    }))
    expect(dnd5eActiveOptionalBonusDice(
      skipped.state.combatants[ally.id].classState.activeEffects,
      'ability-check',
    )).toHaveLength(1)

    const used = resolveDnd5eHeadlessAction(cast.state, {
      type: 'ability-check',
      actorId: ally.id,
      ability: 'dex',
      d20: 8,
      dc: 13,
      optionalBonusDice: [{
        effectId: effect.id,
        targetId: ally.id,
        rollKind: 'ability-check',
        roll: 3,
      }],
    })
    expect(used.ok, used.ok ? undefined : used.reason).toBe(true)
    if (!used.ok) return
    expect(used.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      total: 13,
      success: true,
      optionalBonusDieApplied: 3,
    }))
    expect(used.events).toContainEqual(expect.objectContaining({
      type: 'optional-bonus-die-used',
      effectId: effect.id,
      rollKind: 'ability-check',
      roll: 3,
    }))
    expect(used.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      effectId: effect.id,
      reason: 'consumed',
    }))
    expect(used.state.combatants[cleric.id].concentrating).toBe(false)
    expect(used.state.combatants[ally.id].classState.activeEffects ?? []).not.toContainEqual(
      expect.objectContaining({ id: effect.id }),
    )
  })

  it('抗力术可加入法术豁免，并由 Host 拒绝伪造效果与超骰面结果', () => {
    const cleric = combatant('cleric', 20, {
      classId: 'cleric',
      level: 1,
      classSelections: { 'spell-cantrips': ['resistance'] },
    })
    const ally = combatant('ally', 10)
    const enemy = combatant('enemy', 5, {
      controller: 'dm',
      classId: 'sorcerer',
      level: 1,
      abilities: { ...abilities, cha: 16 },
      classSelections: { 'spell-cantrips': ['poison-spray'] },
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('resistance', [cleric, ally, enemy]),
      {
        type: 'cast-spell',
        actorId: cleric.id,
        targetId: ally.id,
        spellId: 'resistance',
        slotLevel: 0,
        effectRolls: [],
      },
    )
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    const effect = dnd5eActiveOptionalBonusDice(
      cast.state.combatants[ally.id].classState.activeEffects,
      'saving-throw',
    )[0]
    expect(effect).toBeDefined()

    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(enemy.id)
    const forged = resolveDnd5eHeadlessAction(structuredClone(cast.state), {
      type: 'cast-spell',
      actorId: enemy.id,
      targetId: ally.id,
      spellId: 'poison-spray',
      slotLevel: 0,
      savingThrowD20: 8,
      effectRolls: [],
      optionalBonusDice: [{
        effectId: 'forged-effect',
        targetId: ally.id,
        rollKind: 'saving-throw',
        roll: 5,
      }],
    })
    expect(forged.ok).toBe(false)
    if (!forged.ok) expect(forged.reason).toBe('invalid-dice')
    expect(dnd5eActiveOptionalBonusDice(
      forged.state.combatants[ally.id].classState.activeEffects,
      'saving-throw',
    )).toHaveLength(1)

    const resolved = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell',
      actorId: enemy.id,
      targetId: ally.id,
      spellId: 'poison-spray',
      slotLevel: 0,
      savingThrowD20: 8,
      effectRolls: [],
      optionalBonusDice: [{
        effectId: effect.id,
        targetId: ally.id,
        rollKind: 'saving-throw',
        roll: 3,
      }],
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: ally.id,
      total: 13,
      success: true,
    }))
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'optional-bonus-die-used',
      effectId: effect.id,
      rollKind: 'saving-throw',
      roll: 3,
    }))
    expect(resolved.state.combatants[ally.id].currentHp).toBe(20)
    expect(resolved.state.combatants[cleric.id].concentrating).toBe(false)
  })
})
