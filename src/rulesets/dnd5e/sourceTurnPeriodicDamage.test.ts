import { describe, expect, it } from 'vitest'
import {
  createDnd5eMechanicalEffect,
  normalizeDnd5eActiveEffects,
} from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5ePendingTurnStartPeriodicDamage,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'

const abilities = {
  str: 14,
  dex: 14,
  con: 14,
  int: 10,
  wis: 12,
  cha: 10,
} as const

function combatant(
  id: string,
  initiative: number,
  patch: Record<string, unknown> = {},
) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'dm',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 50,
    maxHp: 50,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function periodicEffect(input: {
  id: string
  sourceId: string
  targetId: string
  timing: 'source-turn-start' | 'target-turn-start'
  savingThrow?: {
    ability: 'con'
    dc: number
    magical?: boolean
    damageOnSuccessfulSave: 'none' | 'half'
  }
}) {
  return createDnd5eMechanicalEffect({
    id: input.id,
    definitionId: `test:${input.id}`,
    label: input.id,
    source: {
      kind: 'monster',
      actorId: input.sourceId,
      rulesId: `test:${input.id}`,
    },
    targetId: input.targetId,
    periodicDamage: {
      timing: input.timing,
      count: 2,
      sides: 8,
      modifier: 4,
      type: 'bludgeoning',
      savingThrow: input.savingThrow,
    },
  })
}

describe('source-turn-start periodic damage', () => {
  it('collects source-owned effects across targets without firing another target turn', () => {
    const onA = periodicEffect({
      id: 'shared',
      sourceId: 'source',
      targetId: 'target-a',
      timing: 'source-turn-start',
    })
    const onB = periodicEffect({
      id: 'shared',
      sourceId: 'source',
      targetId: 'target-b',
      timing: 'source-turn-start',
    })
    const targetTimedOnSource = periodicEffect({
      id: 'self-tick',
      sourceId: 'target-a',
      targetId: 'source',
      timing: 'target-turn-start',
    })
    const unrelatedTargetTimed = periodicEffect({
      id: 'not-this-turn',
      sourceId: 'source',
      targetId: 'target-b',
      timing: 'target-turn-start',
    })
    const state = startDnd5eHeadlessCombat('source-periodic', [
      combatant('source', 20, {
        classState: { activeEffects: [targetTimedOnSource] },
      }),
      combatant('target-a', 10, {
        classState: { activeEffects: [onA] },
      }),
      combatant('target-b', 5, {
        classState: { activeEffects: [onB, unrelatedTargetTimed] },
      }),
    ])

    expect(dnd5ePendingTurnStartPeriodicDamage(state, 'source').map(
      ({ target, effect }) => `${target.id}:${effect.id}`,
    )).toEqual([
      'source:self-tick',
      'target-a:shared',
      'target-b:shared',
    ])

    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'begin-turn',
      actorId: 'source',
      turnSlotId: 'source',
      turnStartActiveEffectPeriodicDamageRolls: [
        { effectId: 'self-tick', targetId: 'source', rolls: [1, 1] },
        { effectId: 'shared', targetId: 'target-a', rolls: [2, 2] },
        { effectId: 'shared', targetId: 'target-b', rolls: [3, 3] },
      ],
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.source.currentHp).toBe(44)
    expect(resolved.state.combatants['target-a'].currentHp).toBe(42)
    expect(resolved.state.combatants['target-b'].currentHp).toBe(40)
    expect(resolved.events.filter((event) =>
      event.type === 'active-effect-periodic-damage-triggered',
    )).toHaveLength(3)

    const retry = resolveDnd5eHeadlessAction(resolved.state, {
      type: 'begin-turn',
      actorId: 'source',
      turnSlotId: 'source',
    })
    expect(retry.ok, retry.ok ? undefined : retry.reason).toBe(true)
    if (!retry.ok) return
    expect(retry.state.combatants['target-a'].currentHp).toBe(42)
    expect(retry.events).not.toContainEqual(expect.objectContaining({
      type: 'active-effect-periodic-damage-triggered',
    }))
  })

  it('requires the exact effectId and targetId pair and rolls back atomically', () => {
    const effect = periodicEffect({
      id: 'same-id',
      sourceId: 'source',
      targetId: 'target',
      timing: 'source-turn-start',
    })
    const state = startDnd5eHeadlessCombat('strict-pair', [
      combatant('source', 20),
      combatant('target', 10, {
        classState: { activeEffects: [effect] },
      }),
    ])
    const invalid = resolveDnd5eHeadlessAction(state, {
      type: 'begin-turn',
      actorId: 'source',
      turnSlotId: 'source',
      turnStartActiveEffectPeriodicDamageRolls: [
        { effectId: 'same-id', targetId: 'source', rolls: [8, 8] },
      ],
    })
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(invalid.state.combatants.target.currentHp).toBe(50)
    expect(invalid.events).toEqual([])
  })

  it('settles source-owned target damage while end-turn advances to that source', () => {
    const effect = periodicEffect({
      id: 'next-source-tick',
      sourceId: 'source',
      targetId: 'target',
      timing: 'source-turn-start',
    })
    const state = startDnd5eHeadlessCombat('end-turn-source-periodic', [
      combatant('current', 30),
      combatant('source', 20),
      combatant('target', 10, {
        classState: { activeEffects: [effect] },
      }),
    ])
    const advanced = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn',
      actorId: 'current',
      nextTurnSlotId: 'source',
      turnStartActiveEffectPeriodicDamageRolls: [{
        effectId: effect.id,
        targetId: 'target',
        rolls: [4, 4],
      }],
    })
    expect(advanced.ok, advanced.ok ? undefined : advanced.reason).toBe(true)
    if (!advanced.ok) return
    expect(advanced.state.combatants.target.currentHp).toBe(38)
    expect(advanced.state.initiativeIndex).toBe(1)
  })

  it('resolves a declared save, requires the mode dice, and supports legendary resistance', () => {
    const effect = periodicEffect({
      id: 'engulf-tick',
      sourceId: 'source',
      targetId: 'target',
      timing: 'source-turn-start',
      savingThrow: {
        ability: 'con',
        dc: 14,
        magical: true,
        damageOnSuccessfulSave: 'none',
      },
    })
    const baseState = startDnd5eHeadlessCombat('periodic-save', [
      combatant('source', 20),
      combatant('target', 10, {
        magicResistance: true,
        classState: {
          activeEffects: [effect],
          legendaryResistanceUses: 1,
        },
      }),
    ])

    const missingAdvantageDie = resolveDnd5eHeadlessAction(baseState, {
      type: 'begin-turn',
      actorId: 'source',
      turnSlotId: 'source',
      turnStartActiveEffectPeriodicDamageRolls: [{
        effectId: effect.id,
        targetId: 'target',
        rolls: [8, 8],
        d20: 1,
      }],
    })
    expect(missingAdvantageDie).toMatchObject({
      ok: false,
      reason: 'invalid-dice',
    })
    expect(missingAdvantageDie.state.combatants.target.currentHp).toBe(50)

    const failed = resolveDnd5eHeadlessAction(baseState, {
      type: 'begin-turn',
      actorId: 'source',
      turnSlotId: 'source',
      turnStartActiveEffectPeriodicDamageRolls: [{
        effectId: effect.id,
        targetId: 'target',
        rolls: [8, 8],
        d20: 1,
        d20Second: 2,
      }],
    })
    expect(failed.ok, failed.ok ? undefined : failed.reason).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.target.currentHp).toBe(30)

    const resisted = resolveDnd5eHeadlessAction(baseState, {
      type: 'begin-turn',
      actorId: 'source',
      turnSlotId: 'source',
      turnStartActiveEffectPeriodicDamageRolls: [{
        effectId: effect.id,
        targetId: 'target',
        rolls: [8, 8],
        d20: 1,
        d20Second: 2,
        legendaryResistance: true,
      }],
    })
    expect(resisted.ok, resisted.ok ? undefined : resisted.reason).toBe(true)
    if (!resisted.ok) return
    expect(resisted.state.combatants.target.currentHp).toBe(50)
    expect(
      resisted.state.combatants.target.classState.legendaryResistanceUses,
    ).toBe(0)
    expect(resisted.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: 'target',
      ability: 'con',
      success: true,
    }))
    expect(resisted.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-periodic-damage-triggered',
      targetId: 'target',
      amount: 0,
    }))
  })

  it('normalizes the bounded periodic saving-throw declaration', () => {
    const effect = periodicEffect({
      id: 'normalized',
      sourceId: 'source',
      targetId: 'target',
      timing: 'source-turn-start',
      savingThrow: {
        ability: 'con',
        dc: 14,
        damageOnSuccessfulSave: 'none',
      },
    })
    const normalized = normalizeDnd5eActiveEffects([
      JSON.parse(JSON.stringify(effect)),
    ])
    expect(normalized[0]?.periodicDamage?.savingThrow).toEqual({
      ability: 'con',
      dc: 14,
      magical: undefined,
      damageOnSuccessfulSave: 'none',
    })
  })
})
