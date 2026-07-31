import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eSourceLinkedRelations,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { getDnd5eSrdMonsterBySlug } from './monsters'

const ABILITIES = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

function combatant(input: {
  id: string
  initiative: number
  controller: 'dm' | 'player'
  x: number
  statBlockId?: string
  sizeRank?: number
  conditionImmunities?: Dnd5eCombatant['conditionImmunities']
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    statBlockId: input.statBlockId,
    abilities: ABILITIES,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x, y: 0 },
    sizeRank: input.sizeRank ?? 2,
    conditionImmunities: input.conditionImmunities,
    concentrating: false,
  })
}

function encounter(
  sizeRank = 2,
  conditionImmunities?: Dnd5eCombatant['conditionImmunities'],
): Dnd5eHeadlessCombatState {
  const state = startDnd5eHeadlessCombat('shambling-engulf', [
    combatant({
      id: 'mound',
      initiative: 20,
      controller: 'dm',
      x: 0,
      statBlockId: 'srd-5.1:shambling-mound',
      sizeRank: 3,
    }),
    combatant({
      id: 'hero',
      initiative: 10,
      controller: 'player',
      x: 5,
      sizeRank,
      conditionImmunities,
    }),
  ])
  state.coordinateUnitsPerFoot = 1
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey('mound', 'hero')]: 5,
  }
  return state
}

function slamRoll(d20: number) {
  const slam = getDnd5eSrdMonsterBySlug('shambling-mound')!.actions.find(
    (action) => action.id === 'slam',
  )!
  return {
    targetId: 'hero',
    d20,
    damageRolls: slam.attack!.damage.map((damage) =>
      Array.from({ length: damage.count }, () => 1)),
  }
}

function engulf(
  state: Dnd5eHeadlessCombatState,
  firstD20 = 10,
  secondD20 = 10,
) {
  return resolveDnd5eHeadlessAction(state, {
    type: 'monster-multiattack-composite',
    schemaVersion: 1,
    actorId: 'mound',
    actionId: 'multiattack',
    steps: [
      {
        kind: 'weapon',
        actionId: 'slam',
        roll: slamRoll(firstD20),
      },
      {
        kind: 'weapon',
        actionId: 'slam',
        roll: slamRoll(secondD20),
      },
      {
        kind: 'special',
        actionId: 'engulf',
        targetId: 'hero',
      },
    ],
  })
}

describe('Shambling Mound Engulf Multiattack', () => {
  it('turns two Slam hits into one carried engulf relation and spends one action', () => {
    const result = engulf(encounter())
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return

    expect(result.state.combatants.hero.conditions).toEqual(
      expect.arrayContaining(['grappled', 'restrained', 'blinded']),
    )
    const relation = dnd5eSourceLinkedRelations(
      result.state,
      'mound',
      'engulf',
    )
    expect(relation).toHaveLength(1)
    expect(relation[0]?.effect.relation).toMatchObject({
      kind: 'engulfed',
      movement: 'carry-target',
    })
    expect(relation[0]?.effect.periodicDamage).toMatchObject({
      timing: 'source-turn-start',
      count: 2,
      sides: 8,
      modifier: 4,
      savingThrow: {
        ability: 'con',
        dc: 14,
        damageOnSuccessfulSave: 'none',
      },
    })
    expect(result.events.filter((event) =>
      event.type === 'turn-resource-spent' &&
      event.actorId === 'mound' &&
      event.resource === 'action')).toHaveLength(1)

    const moved = resolveDnd5eHeadlessAction(result.state, {
      type: 'move',
      actorId: 'mound',
      to: { x: 10, y: 0 },
      distance: 10,
    })
    expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.mound.position).toEqual({ x: 10, y: 0 })
    expect(moved.state.combatants.hero.position).toEqual({ x: 15, y: 0 })
  })

  it('keeps the parent transaction successful but does not engulf after a miss or an oversized target', () => {
    const missed = engulf(encounter(), 1, 10)
    expect(missed.ok, missed.ok ? undefined : missed.reason).toBe(true)
    if (missed.ok) {
      expect(dnd5eSourceLinkedRelations(missed.state, 'mound', 'engulf'))
        .toHaveLength(0)
      expect(missed.state.combatants.hero.conditions).not.toContain('restrained')
    }

    const large = engulf(encounter(3))
    expect(large.ok, large.ok ? undefined : large.reason).toBe(true)
    if (large.ok) {
      expect(dnd5eSourceLinkedRelations(large.state, 'mound', 'engulf'))
        .toHaveLength(0)
    }
  })

  it('keeps independent Engulf conditions when the target is immune to restrained', () => {
    const result = engulf(encounter(2, ['restrained']))
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return

    expect(result.state.combatants.hero.conditions).toContain('grappled')
    expect(result.state.combatants.hero.conditions).toContain('blinded')
    expect(result.state.combatants.hero.conditions).not.toContain('restrained')
    expect(dnd5eSourceLinkedRelations(result.state, 'mound', 'engulf'))
      .toHaveLength(1)
  })

  it('rejects a forged Engulf target atomically', () => {
    const state = encounter()
    state.combatants.other = combatant({
      id: 'other',
      initiative: 5,
      controller: 'player',
      x: 5,
    })
    state.initiativeOrder = [...state.initiativeOrder, 'other']
    state.initiativeSlotIds = [
      ...(state.initiativeSlotIds ?? state.initiativeOrder.slice(0, -1)),
      'other',
    ]
    state.distanceFeetByCombatantPair = {
      ...state.distanceFeetByCombatantPair,
      [dnd5eCombatantPairKey('mound', 'other')]: 5,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'mound',
      actionId: 'multiattack',
      steps: [
        { kind: 'weapon', actionId: 'slam', roll: slamRoll(10) },
        { kind: 'weapon', actionId: 'slam', roll: slamRoll(10) },
        {
          kind: 'special',
          actionId: 'engulf',
          targetId: 'other',
        },
      ],
    })
    expect(result).toMatchObject({
      ok: false,
      reason: 'invalid-monster-action',
    })
    expect(result.state.combatants.hero.currentHp).toBe(100)
    expect(result.state.combatants.mound.turn.actionAvailable).toBe(true)
  })

  it('resolves the target save at the mound turn start and lets an escaped target clear the full relation tree', () => {
    const initial = engulf(encounter())
    expect(initial.ok, initial.ok ? undefined : initial.reason).toBe(true)
    if (!initial.ok) return
    const periodic = initial.state.combatants.hero.classState.activeEffects?.find(
      (effect) => effect.periodicDamage?.timing === 'source-turn-start',
    )
    expect(periodic).toBeTruthy()

    const heroTurn = resolveDnd5eHeadlessAction(initial.state, {
      type: 'end-turn',
      actorId: 'mound',
    })
    expect(heroTurn.ok, heroTurn.ok ? undefined : heroTurn.reason).toBe(true)
    if (!heroTurn.ok) return
    const nextMoundTurn = resolveDnd5eHeadlessAction(heroTurn.state, {
      type: 'end-turn',
      actorId: 'hero',
      turnStartActiveEffectPeriodicDamageRolls: [{
        effectId: periodic!.id,
        targetId: 'hero',
        rolls: [8, 8],
        d20: 1,
      }],
    })
    expect(nextMoundTurn.ok, nextMoundTurn.ok ? undefined : nextMoundTurn.reason)
      .toBe(true)
    if (!nextMoundTurn.ok) return
    // Two minimum-damage Slams deal 12 first; the failed save then deals 20.
    expect(nextMoundTurn.state.combatants.hero.currentHp).toBe(68)

    const nextHeroTurn = resolveDnd5eHeadlessAction(nextMoundTurn.state, {
      type: 'end-turn',
      actorId: 'mound',
    })
    expect(nextHeroTurn.ok, nextHeroTurn.ok ? undefined : nextHeroTurn.reason)
      .toBe(true)
    if (!nextHeroTurn.ok) return
    const root = dnd5eSourceLinkedRelations(
      nextHeroTurn.state,
      'mound',
      'engulf',
    )[0]?.effect
    expect(root).toBeTruthy()
    const escaped = resolveDnd5eHeadlessAction(nextHeroTurn.state, {
      type: 'escape-active-effect',
      actorId: 'hero',
      effectId: root!.id,
      d20: 20,
    })
    expect(escaped.ok, escaped.ok ? undefined : escaped.reason).toBe(true)
    if (!escaped.ok) return
    expect(dnd5eSourceLinkedRelations(escaped.state, 'mound', 'engulf'))
      .toHaveLength(0)
    expect(escaped.state.combatants.hero.conditions).not.toContain('grappled')
    expect(escaped.state.combatants.hero.conditions).not.toContain('restrained')
    expect(escaped.state.combatants.hero.conditions).not.toContain('blinded')
  })

  it('retains Engulf while the mound is incapacitated and still resolves its source-turn damage', () => {
    const initial = engulf(encounter())
    expect(initial.ok, initial.ok ? undefined : initial.reason).toBe(true)
    if (!initial.ok) return
    const periodic = initial.state.combatants.hero.classState.activeEffects?.find(
      (effect) => effect.periodicDamage?.timing === 'source-turn-start',
    )
    expect(periodic).toBeTruthy()
    initial.state.combatants.mound.conditions = ['stunned']

    const heroTurn = resolveDnd5eHeadlessAction(initial.state, {
      type: 'end-turn',
      actorId: 'mound',
    })
    expect(heroTurn.ok, heroTurn.ok ? undefined : heroTurn.reason).toBe(true)
    if (!heroTurn.ok) return
    expect(dnd5eSourceLinkedRelations(heroTurn.state, 'mound', 'engulf'))
      .toHaveLength(1)

    const nextMoundTurn = resolveDnd5eHeadlessAction(heroTurn.state, {
      type: 'end-turn',
      actorId: 'hero',
      turnStartActiveEffectPeriodicDamageRolls: [{
        effectId: periodic!.id,
        targetId: 'hero',
        rolls: [1, 1],
        d20: 1,
      }],
    })
    expect(nextMoundTurn.ok, nextMoundTurn.ok ? undefined : nextMoundTurn.reason)
      .toBe(true)
    if (!nextMoundTurn.ok) return
    // Two minimum-damage Slams deal 12; Engulf then deals 6 despite Stunned.
    expect(nextMoundTurn.state.combatants.hero.currentHp).toBe(82)
    expect(dnd5eSourceLinkedRelations(nextMoundTurn.state, 'mound', 'engulf'))
      .toHaveLength(1)
  })
})
