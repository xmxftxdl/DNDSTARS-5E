import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterActionRoll,
} from './headlessCombatEngine'
import { getDnd5eSrdMonsterBySlug } from './monsters'

const KRAKEN = getDnd5eSrdMonsterBySlug('kraken')!
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
  controller: 'dm' | 'player'
  initiative: number
  x: number
  sizeRank: number
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
    currentHp: 500,
    maxHp: 500,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x, y: 0 },
    sizeRank: input.sizeRank,
    concentrating: false,
  })
}

function encounter(targetSizeRank = 3): Dnd5eHeadlessCombatState {
  const kraken = combatant({
    id: 'kraken',
    controller: 'dm',
    initiative: 20,
    x: 0,
    sizeRank: 5,
    statBlockId: KRAKEN.id,
    abilities: KRAKEN.abilities,
  })
  const hero = combatant({
    id: 'hero',
    controller: 'player',
    initiative: 10,
    x: 5,
    sizeRank: targetSizeRank,
  })
  const state = startDnd5eHeadlessCombat('kraken-fling', [kraken, hero])
  state.coordinateUnitsPerFoot = 1
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey('kraken', 'hero')]: 5,
  }
  return state
}

function tentacleRoll(): Dnd5eMonsterActionRoll {
  return {
    targetId: 'hero',
    d20: 2,
    damageRolls: [[1, 1, 1]],
    onHitEffectRolls: [{
      effectId: 'tentacle-grapple',
    }],
  }
}

function sourceTentacleRelations(state: Dnd5eHeadlessCombatState) {
  return (state.combatants.hero.classState.activeEffects ?? []).filter(
    (effect) =>
      effect.dependsOnEffectId == null &&
      effect.source.actorId === 'kraken' &&
      effect.relation?.slotGroup === 'tentacle',
  )
}

describe('Kraken Fling Headless transaction', () => {
  it('publishes reviewed +17 attacks and a strict throw rule', () => {
    expect(KRAKEN.actions.find((action) => action.id === 'bite')?.attack?.toHit)
      .toBe(17)
    expect(KRAKEN.actions.find((action) => action.id === 'tentacle')?.attack?.toHit)
      .toBe(17)
    expect(KRAKEN.actions.find((action) => action.id === 'fling')).toMatchObject({
      kind: 'other',
      automation: 'headless',
      relationRequirement: {
        kind: 'target-linked-to-source',
        slotGroup: 'tentacle',
      },
      rule: {
        kind: 'throw-linked-target',
        slotGroup: 'tentacle',
        maximumDistanceFeet: 60,
        targetMaxSizeRank: 3,
        collisionDamage: {
          distanceFeetPerDie: 10,
          sides: 6,
          type: 'bludgeoning',
        },
        conditionAfterThrow: 'prone',
      },
    })
  })

  it('creates and releases the exact tentacle relation inside one composite Multiattack', () => {
    const result = resolveDnd5eHeadlessAction(encounter(), {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'kraken',
      actionId: 'multiattack-two-tentacles-and-fling',
      steps: [
        {
          kind: 'weapon',
          actionId: 'tentacle',
          roll: tentacleRoll(),
        },
        {
          kind: 'weapon',
          actionId: 'tentacle',
          roll: tentacleRoll(),
        },
        {
          kind: 'special',
          actionId: 'fling',
          targetId: 'hero',
          forcedMovements: [{
            targetId: 'hero',
            to: { x: 35, y: 0 },
            distanceFeet: 30,
          }],
          damageRolls: [1, 2, 3],
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.position).toEqual({ x: 35, y: 0 })
    expect(result.state.combatants.hero.currentHp).toBe(468)
    expect(result.state.combatants.hero.conditions).toContain('prone')
    expect(result.state.combatants.hero.conditions).not.toContain('grappled')
    expect(result.state.combatants.hero.conditions).not.toContain('restrained')
    expect(sourceTentacleRelations(result.state)).toEqual([])
    expect(result.events.filter((event) =>
      event.type === 'turn-resource-spent' &&
      event.actorId === 'kraken' &&
      event.resource === 'action')).toHaveLength(1)
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'monster-special-action-resolved',
        actorId: 'kraken',
        actionId: 'fling',
        targetId: 'hero',
        damage: 6,
      }),
      expect.objectContaining({
        type: 'moved',
        actorId: 'hero',
        distance: 30,
      }),
    ]))
  })

  it('rejects fabricated distance or incomplete collision dice atomically', () => {
    const linked = resolveDnd5eHeadlessAction(encounter(), {
      type: 'monster-action',
      actorId: 'kraken',
      actionId: 'tentacle',
      rolls: [tentacleRoll()],
    })
    expect(linked.ok, linked.ok ? undefined : linked.reason).toBe(true)
    if (!linked.ok) return
    linked.state.combatants.kraken.turn.actionAvailable = true
    const before = structuredClone(linked.state)

    const wrongDistance = resolveDnd5eHeadlessAction(linked.state, {
      type: 'monster-special-action',
      actorId: 'kraken',
      actionId: 'fling',
      targetId: 'hero',
      forcedMovements: [{
        targetId: 'hero',
        to: { x: 35, y: 0 },
        distanceFeet: 20,
      }],
      damageRolls: [1, 1],
    })
    expect(wrongDistance).toMatchObject({
      ok: false,
      reason: 'invalid-target',
    })
    expect(wrongDistance.state).toEqual(before)

    const incompleteDice = resolveDnd5eHeadlessAction(linked.state, {
      type: 'monster-special-action',
      actorId: 'kraken',
      actionId: 'fling',
      targetId: 'hero',
      forcedMovements: [{
        targetId: 'hero',
        to: { x: 35, y: 0 },
        distanceFeet: 30,
      }],
      damageRolls: [1, 1],
    })
    expect(incompleteDice).toMatchObject({
      ok: false,
      reason: 'invalid-dice',
    })
    expect(incompleteDice.state).toEqual(before)
  })

  it('keeps a Huge grappled target linked because Fling only accepts Large or smaller', () => {
    const linked = resolveDnd5eHeadlessAction(encounter(4), {
      type: 'monster-action',
      actorId: 'kraken',
      actionId: 'tentacle',
      rolls: [tentacleRoll()],
    })
    expect(linked.ok, linked.ok ? undefined : linked.reason).toBe(true)
    if (!linked.ok) return
    expect(sourceTentacleRelations(linked.state)).toHaveLength(1)
    linked.state.combatants.kraken.turn.actionAvailable = true

    const result = resolveDnd5eHeadlessAction(linked.state, {
      type: 'monster-special-action',
      actorId: 'kraken',
      actionId: 'fling',
      targetId: 'hero',
      forcedMovements: [{
        targetId: 'hero',
        to: { x: 35, y: 0 },
        distanceFeet: 30,
      }],
      damageRolls: [],
    })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(sourceTentacleRelations(result.state)).toHaveLength(1)
    expect(result.state.combatants.hero.position).toEqual({ x: 5, y: 0 })
  })
})
