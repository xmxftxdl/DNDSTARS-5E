import { describe, expect, it } from 'vitest'
import {
  dnd5eActiveAbilityCheckDisadvantages,
  dnd5eActiveSavingThrowDisadvantages,
} from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eSourceLinkedRelations,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterActionRoll,
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
  abilities?: Dnd5eCombatant['abilities']
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    statBlockId: input.statBlockId,
    abilities: input.abilities ?? ABILITIES,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 300,
    maxHp: 300,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x, y: 0 },
    sizeRank: 2,
    concentrating: false,
  })
}

function encounter(
  targets: readonly { id: string; x: number }[],
): Dnd5eHeadlessCombatState {
  const roper = getDnd5eSrdMonsterBySlug('roper')!
  const source = combatant({
    id: 'roper',
    initiative: 20,
    controller: 'dm',
    x: 0,
    statBlockId: roper.id,
    abilities: roper.abilities,
  })
  const combatants = [
    source,
    ...targets.map((target, index) => combatant({
      id: target.id,
      initiative: 10 - index,
      controller: 'player',
      x: target.x,
    })),
  ]
  const state = startDnd5eHeadlessCombat('roper-reel', combatants)
  state.coordinateUnitsPerFoot = 1
  state.distanceFeetByCombatantPair = Object.fromEntries(
    targets.map((target) => [
      dnd5eCombatantPairKey(source.id, target.id),
      Math.abs(target.x),
    ]),
  )
  return state
}

function attackRoll(
  actionId: 'tendril' | 'bite',
  targetId: string,
): Dnd5eMonsterActionRoll {
  const action = getDnd5eSrdMonsterBySlug('roper')!.actions.find(
    (candidate) => candidate.id === actionId,
  )!
  return {
    targetId,
    d20: 10,
    damageRolls: action.attack!.damage.map((damage) =>
      Array.from({ length: damage.count }, () => 1)),
    onHitEffectRolls: actionId === 'tendril'
      ? [{ effectId: 'tendril-grapple' }]
      : undefined,
  }
}

function tendril(
  state: Dnd5eHeadlessCombatState,
  targetId: string,
): Dnd5eHeadlessCombatState {
  const result = resolveDnd5eHeadlessAction(state, {
    type: 'monster-action',
    actorId: 'roper',
    actionId: 'tendril',
    rolls: [attackRoll('tendril', targetId)],
  })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) return state
  result.state.combatants.roper.turn.actionAvailable = true
  return result.state
}

describe('Roper Tendril and Reel', () => {
  it('reels every tendril-linked target and preserves the Strength disadvantages', () => {
    let state = encounter([
      { id: 'east', x: 40 },
      { id: 'west', x: -30 },
    ])
    state = tendril(state, 'east')
    state = tendril(state, 'west')

    const eastEffects = state.combatants.east.classState.activeEffects
    expect(dnd5eActiveAbilityCheckDisadvantages(eastEffects)).toContain('str')
    expect(dnd5eActiveSavingThrowDisadvantages(eastEffects)).toContain('str')
    expect(dnd5eSourceLinkedRelations(state, 'roper', 'tendril')).toHaveLength(2)

    const reeled = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: 'roper',
      actionId: 'reel',
      forcedMovements: [
        { targetId: 'east', to: { x: 15, y: 0 }, distanceFeet: 25 },
        { targetId: 'west', to: { x: -5, y: 0 }, distanceFeet: 25 },
      ],
    })
    expect(reeled.ok, reeled.ok ? undefined : reeled.reason).toBe(true)
    if (!reeled.ok) return
    expect(reeled.state.combatants.east.position).toEqual({ x: 15, y: 0 })
    expect(reeled.state.combatants.west.position).toEqual({ x: -5, y: 0 })
    expect(reeled.events.filter((event) => event.type === 'moved'))
      .toHaveLength(2)
    expect(dnd5eSourceLinkedRelations(
      reeled.state,
      'roper',
      'tendril',
    )).toHaveLength(2)
  })

  it('rejects an incomplete or forged Reel payload atomically', () => {
    let state = encounter([
      { id: 'east', x: 40 },
      { id: 'west', x: -30 },
    ])
    state = tendril(state, 'east')
    state = tendril(state, 'west')

    const rejected = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: 'roper',
      actionId: 'reel',
      forcedMovements: [
        { targetId: 'east', to: { x: 15, y: 0 }, distanceFeet: 25 },
      ],
    })
    expect(rejected).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(state.combatants.east.position).toEqual({ x: 40, y: 0 })
    expect(state.combatants.west.position).toEqual({ x: -30, y: 0 })
    expect(state.combatants.roper.turn.actionAvailable).toBe(true)

    const awayFromSource = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: 'roper',
      actionId: 'reel',
      forcedMovements: [
        { targetId: 'east', to: { x: 50, y: 0 }, distanceFeet: 10 },
        { targetId: 'west', to: { x: -5, y: 0 }, distanceFeet: 25 },
      ],
    })
    expect(awayFromSource).toMatchObject({
      ok: false,
      reason: 'invalid-dice',
    })
    expect(state.combatants.east.position).toEqual({ x: 40, y: 0 })
  })

  it('resolves four Tendrils, Reel, then Bite as one atomic Multiattack', () => {
    const state = encounter([{ id: 'hero', x: 30 }])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'roper',
      actionId: 'multiattack',
      steps: [
        ...Array.from({ length: 4 }, () => ({
          kind: 'weapon' as const,
          actionId: 'tendril',
          roll: attackRoll('tendril', 'hero'),
        })),
        {
          kind: 'special',
          actionId: 'reel',
          forcedMovements: [{
            targetId: 'hero',
            to: { x: 5, y: 0 },
            distanceFeet: 25,
          }],
        },
        {
          kind: 'weapon',
          actionId: 'bite',
          roll: attackRoll('bite', 'hero'),
        },
      ],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.position).toEqual({ x: 5, y: 0 })
    expect(result.state.combatants.hero.currentHp).toBeLessThan(300)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-multiattack-composite-resolved',
      actorId: 'roper',
      resolvedActionIds: [
        'tendril',
        'tendril',
        'tendril',
        'tendril',
        'reel',
        'bite',
      ],
    }))
    expect(result.events.filter((event) =>
      event.type === 'turn-resource-spent' &&
      event.actorId === 'roper' &&
      event.resource === 'action')).toHaveLength(1)
  })

  it('keeps missed Tendrils committed and leaves the unavailable Bite unused', () => {
    const state = encounter([{ id: 'hero', x: 30 }])
    const missedTendril = {
      targetId: 'hero',
      d20: 1,
      damageRolls: [],
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'roper',
      actionId: 'multiattack',
      steps: [
        ...Array.from({ length: 4 }, () => ({
          kind: 'weapon' as const,
          actionId: 'tendril',
          roll: missedTendril,
        })),
        {
          kind: 'special',
          actionId: 'reel',
          forcedMovements: [],
        },
        {
          kind: 'weapon',
          actionId: 'bite',
          // The Host prepares the complete atomic sequence before Tendril
          // outcomes are known. Core must ignore this roll once no relation
          // exists for its concrete target.
          roll: attackRoll('bite', 'hero'),
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.currentHp).toBe(300)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-multiattack-composite-resolved',
      actorId: 'roper',
      resolvedActionIds: ['tendril', 'tendril', 'tendril', 'tendril', 'reel'],
      skippedActionIds: ['bite'],
    }))
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(4)
  })
})
