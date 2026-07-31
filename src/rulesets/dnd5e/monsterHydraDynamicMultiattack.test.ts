import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  dnd5eHydraHeadCount,
  dnd5eMonsterMultiattackRuntimeActionIds,
} from './monsterDynamicMultiattack'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
} from './mapBridge'
import { getDnd5eSrdMonsterBySlug } from './monsters'
import type { BattleMap } from '../../store/maps'

function combatant(input: {
  id: string
  initiative: number
  controller: 'dm' | 'player'
  statBlockId?: string
  currentHp?: number
  maxHp?: number
  x?: number
  classState?: Partial<Dnd5eCombatant['classState']>
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    abilities: { str: 20, dex: 12, con: 20, int: 2, wis: 10, cha: 7 },
    proficiencyBonus: 3,
    armorClass: input.statBlockId ? 15 : 10,
    currentHp: input.currentHp ?? 200,
    maxHp: input.maxHp ?? 200,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x ?? 0, y: 0 },
    concentrating: false,
    statBlockId: input.statBlockId,
    classState: input.classState,
  })
}

function state(input?: {
  hydraCurrentHp?: number
  hydraMaxHp?: number
  hydraClassState?: Partial<Dnd5eCombatant['classState']>
}): Dnd5eHeadlessCombatState {
  return startDnd5eHeadlessCombat('hydra-dynamic-heads', [
    combatant({
      id: 'hero',
      initiative: 20,
      controller: 'player',
      x: 5,
    }),
    combatant({
      id: 'hydra',
      initiative: 10,
      controller: 'dm',
      statBlockId: 'srd-5.1:hydra',
      currentHp: input?.hydraCurrentHp ?? 172,
      maxHp: input?.hydraMaxHp ?? 172,
      classState: input?.hydraClassState,
    }),
  ])
}

function damageHydra(
  source: Dnd5eHeadlessCombatState,
  amount: number,
  type: 'fire' | 'slashing' = 'slashing',
) {
  return resolveDnd5eHeadlessAction(source, {
    type: 'attack',
    actorId: 'hero',
    targetId: 'hydra',
    attackModifier: 20,
    d20: 10,
    spendAction: false,
    damage: {
      count: 1,
      sides: 100,
      bonus: 0,
      rolls: [amount],
      type,
    },
  })
}

function hydraBiteRolls(count: number) {
  return Array.from({ length: count }, () => ({
    targetId: 'hero',
    d20: 10,
    damageRolls: [[1]],
  }))
}

describe('Hydra runtime heads and dynamic Multiattack', () => {
  it('expands the catalog Multiattack from persisted current heads', () => {
    const monster = getDnd5eSrdMonsterBySlug('hydra')
    const action = monster?.actions.find((candidate) =>
      candidate.id === 'multiattack')
    const actor = combatant({
      id: 'hydra',
      initiative: 20,
      controller: 'dm',
      statBlockId: 'srd-5.1:hydra',
      classState: { monsterHydraHeadCount: 7 },
    })

    expect(monster).toBeDefined()
    expect(action).toBeDefined()
    if (!monster || !action) return
    expect(dnd5eMonsterMultiattackRuntimeActionIds({
      monster,
      action,
      actor,
    })).toEqual(Array.from({ length: 7 }, () => 'bite'))
  })

  it('severs at most one head after 25 cumulative damage in one turn', () => {
    const first = damageHydra(state(), 10)
    expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
    if (!first.ok) return
    expect(dnd5eHydraHeadCount(first.state.combatants.hydra)).toBe(5)

    const threshold = damageHydra(first.state, 15)
    expect(threshold.ok, threshold.ok ? undefined : threshold.reason).toBe(true)
    if (!threshold.ok) return
    expect(dnd5eHydraHeadCount(threshold.state.combatants.hydra)).toBe(4)
    expect(threshold.events).toContainEqual(expect.objectContaining({
      type: 'monster-hydra-head-severed',
      actorId: 'hydra',
      damageTakenThisTurn: 25,
      headCount: 4,
    }))

    const excess = damageHydra(threshold.state, 50)
    expect(excess.ok, excess.ok ? undefined : excess.reason).toBe(true)
    if (!excess.ok) return
    expect(dnd5eHydraHeadCount(excess.state.combatants.hydra)).toBe(4)
  })

  it('requires exactly one Bite per current head in the atomic transaction', () => {
    const damaged = damageHydra(state(), 25)
    expect(damaged.ok, damaged.ok ? undefined : damaged.reason).toBe(true)
    if (!damaged.ok) return
    const hydraTurn = resolveDnd5eHeadlessAction(damaged.state, {
      type: 'end-turn',
      actorId: 'hero',
    })
    expect(hydraTurn.ok, hydraTurn.ok ? undefined : hydraTurn.reason).toBe(true)
    if (!hydraTurn.ok) return

    const staleFive = resolveDnd5eHeadlessAction(hydraTurn.state, {
      type: 'monster-action',
      actorId: 'hydra',
      actionId: 'multiattack',
      rolls: hydraBiteRolls(5),
    })
    expect(staleFive).toMatchObject({
      ok: false,
      reason: 'invalid-monster-action',
    })
    expect(staleFive.state.combatants.hydra.turn.actionAvailable).toBe(true)

    const currentFour = resolveDnd5eHeadlessAction(staleFive.state, {
      type: 'monster-action',
      actorId: 'hydra',
      actionId: 'multiattack',
      rolls: hydraBiteRolls(4),
    })
    expect(
      currentFour.ok,
      currentFour.ok ? undefined : currentFour.reason,
    ).toBe(true)
    if (!currentFour.ok) return
    expect(currentFour.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(4)
  })

  it('regrows two heads and heals 20 HP at the end of its turn', () => {
    const damaged = damageHydra(state(), 25)
    expect(damaged.ok, damaged.ok ? undefined : damaged.reason).toBe(true)
    if (!damaged.ok) return
    const hydraTurn = resolveDnd5eHeadlessAction(damaged.state, {
      type: 'end-turn',
      actorId: 'hero',
    })
    expect(hydraTurn.ok, hydraTurn.ok ? undefined : hydraTurn.reason).toBe(true)
    if (!hydraTurn.ok) return
    const ended = resolveDnd5eHeadlessAction(hydraTurn.state, {
      type: 'end-turn',
      actorId: 'hydra',
    })

    expect(ended.ok, ended.ok ? undefined : ended.reason).toBe(true)
    if (!ended.ok) return
    expect(dnd5eHydraHeadCount(ended.state.combatants.hydra)).toBe(6)
    expect(ended.state.combatants.hydra.currentHp).toBe(167)
    expect(ended.events).toContainEqual({
      type: 'monster-hydra-heads-regrown',
      actorId: 'hydra',
      headsRegrown: 2,
      headCount: 6,
      healing: 20,
      hpAfter: 167,
    })
  })

  it('suppresses end-turn regrowth after fire damage since its last turn', () => {
    const damaged = damageHydra(state(), 25, 'fire')
    expect(damaged.ok, damaged.ok ? undefined : damaged.reason).toBe(true)
    if (!damaged.ok) return
    const hydraTurn = resolveDnd5eHeadlessAction(damaged.state, {
      type: 'end-turn',
      actorId: 'hero',
    })
    expect(hydraTurn.ok, hydraTurn.ok ? undefined : hydraTurn.reason).toBe(true)
    if (!hydraTurn.ok) return
    const ended = resolveDnd5eHeadlessAction(hydraTurn.state, {
      type: 'end-turn',
      actorId: 'hydra',
    })

    expect(ended.ok, ended.ok ? undefined : ended.reason).toBe(true)
    if (!ended.ok) return
    expect(dnd5eHydraHeadCount(ended.state.combatants.hydra)).toBe(4)
    expect(ended.state.combatants.hydra.currentHp).toBe(147)
    expect(ended.events).toContainEqual({
      type: 'monster-hydra-regrowth-suppressed',
      actorId: 'hydra',
      headsLost: 1,
      headCount: 4,
      damageType: 'fire',
    })
    expect(
      ended.state.combatants.hydra.classState
        .monsterHydraFireDamageSinceLastTurn,
    ).toBeUndefined()
  })

  it('dies immediately when its last head is severed', () => {
    const result = damageHydra(state({
      hydraClassState: { monsterHydraHeadCount: 1 },
    }), 25)

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(dnd5eHydraHeadCount(result.state.combatants.hydra)).toBe(0)
    expect(result.state.combatants.hydra.currentHp).toBe(0)
    expect(result.state.combatants.hydra.deathSaves.dead).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-hydra-head-severed',
      actorId: 'hydra',
      headCount: 0,
    }))
  })

  it('persists the head ledger through the map authority bridge', () => {
    const map: BattleMap = {
      id: 'hydra-map',
      name: 'Hydra Map',
      width: 500,
      height: 500,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [
        {
          id: 'hero',
          label: 'Hero',
          x: 50,
          y: 0,
          color: '#fff',
          emoji: '',
          size: 1,
          type: 'player',
          hp: 100,
          maxHp: 100,
        },
        {
          id: 'hydra',
          label: 'Hydra',
          x: 0,
          y: 0,
          color: '#fff',
          emoji: '',
          size: 3,
          type: 'enemy',
          poolId: 'srd-5.1:hydra',
          hp: 147,
          maxHp: 172,
          dnd5eCombatState: {
            monsterHydraHeadCount: 4,
            monsterHydraHeadsLostSinceLastTurn: 1,
            monsterHydraDamageTurnKey: 'combat:1:hero',
            monsterHydraDamageTakenThisTurn: 25,
            monsterHydraHeadSeveredTurnKey: 'combat:1:hero',
            monsterHydraFireDamageSinceLastTurn: true,
          },
        },
      ],
    }
    const initiativeOrder = [
      { tokenId: 'hero', label: 'Hero', emoji: '', color: '', roll: 20 },
      { tokenId: 'hydra', label: 'Hydra', emoji: '', color: '', roll: 10 },
    ]
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'combat',
      map,
      characters: [],
      initiativeOrder,
    })
    expect(snapshot.state.combatants.hydra.classState).toMatchObject({
      monsterHydraHeadCount: 4,
      monsterHydraHeadsLostSinceLastTurn: 1,
      monsterHydraDamageTakenThisTurn: 25,
      monsterHydraFireDamageSinceLastTurn: true,
    })

    const application = planDnd5eMapResultApplication({
      state: snapshot.state,
      map,
      characters: [],
      characterIdByCombatantId: {},
    })
    expect(
      application.map.tokens.find((token) => token.id === 'hydra')
        ?.dnd5eCombatState,
    ).toMatchObject({
      monsterHydraHeadCount: 4,
      monsterHydraHeadsLostSinceLastTurn: 1,
      monsterHydraDamageTakenThisTurn: 25,
      monsterHydraFireDamageSinceLastTurn: true,
    })
  })
})
