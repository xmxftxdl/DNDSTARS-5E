import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5ePendingMonsterDeathAreaEffects,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterDeathAreaEffectSnapshot,
} from './headlessCombatEngine'

const ABILITIES = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

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
    abilities: ABILITIES,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function expectSuccess(result: Dnd5eActionResult) {
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result
}

function kill(
  state: Dnd5eHeadlessCombatState,
  attackerId: string,
  targetId: string,
): Dnd5eActionResult {
  return resolveDnd5eHeadlessAction(state, {
    type: 'attack',
    actorId: attackerId,
    targetId,
    attackModifier: 20,
    d20: 15,
    damage: {
      count: 1,
      sides: 4,
      bonus: 0,
      rolls: [4],
      type: 'force',
    },
  })
}

function singleTargetDeathScenario(
  slug: string,
  radiusFeet: number,
): {
  killed: Dnd5eActionResult & { ok: true }
  snapshot: Dnd5eMonsterDeathAreaEffectSnapshot
} {
  const killer = combatant('killer', 40)
  const source = combatant('source', 30, {
    controller: 'dm',
    statBlockId: `srd-5.1:${slug}`,
    currentHp: 1,
  })
  const target = combatant('target', 20)
  const anchor = combatant('anchor', 10, { controller: 'dm' })
  const state = startDnd5eHeadlessCombat(
    `death-area-${slug}`,
    [killer, source, target, anchor],
  )
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey(source.id, target.id)]: radiusFeet,
    [dnd5eCombatantPairKey(source.id, killer.id)]: 100,
    [dnd5eCombatantPairKey(source.id, anchor.id)]: 100,
  }

  const killed = expectSuccess(kill(state, killer.id, source.id))
  const snapshots = dnd5ePendingMonsterDeathAreaEffects(killed.state)
  expect(snapshots).toHaveLength(1)
  return { killed, snapshot: snapshots[0] }
}

function resolveSingleTargetDeathArea(input: {
  state: Dnd5eHeadlessCombatState
  snapshot: Dnd5eMonsterDeathAreaEffectSnapshot
  d20: number
  damageRolls: readonly number[]
}): Dnd5eActionResult {
  return resolveDnd5eHeadlessAction(input.state, {
    type: 'resolve-monster-death-area-effect',
    actorId: input.snapshot.sourceId,
    snapshotId: input.snapshot.id,
    resolution: {
      schemaVersion: 1,
      targetIds: ['target'],
      targetSavingThrows: [{ targetId: 'target', d20: input.d20 }],
      damageRolls: input.damageRolls,
    },
  })
}

describe('SRD monster death-area Headless runtime', () => {
  it('creates one authoritative pending snapshot when a death-area monster dies', () => {
    const { killed, snapshot } = singleTargetDeathScenario('steam-mephit', 5)

    expect(snapshot).toEqual({
      id: `${killed.state.combatId}:death-area:source:death-burst`,
      sourceId: 'source',
      ruleId: 'death-burst',
      targetIds: ['target'],
      createdRound: 1,
    })
    expect(killed.events).toContainEqual({
      type: 'monster-death-area-effect-pending',
      snapshot,
    })
  })

  it('applies half of Balor Death Throes damage on a successful save', () => {
    const { killed, snapshot } = singleTargetDeathScenario('balor', 30)
    const resolved = expectSuccess(resolveSingleTargetDeathArea({
      state: killed.state,
      snapshot,
      d20: 20,
      damageRolls: Array(20).fill(1),
    }))

    expect(resolved.state.combatants.target.currentHp).toBe(90)
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'monster-death-area-effect-resolved',
      sourceId: 'source',
      ruleId: 'death-throes',
      targetIds: ['target'],
      damage: 20,
    }))
  })

  it('applies no Steam Mephit Death Burst damage on a successful save', () => {
    const { killed, snapshot } = singleTargetDeathScenario('steam-mephit', 5)
    const resolved = expectSuccess(resolveSingleTargetDeathArea({
      state: killed.state,
      snapshot,
      d20: 20,
      damageRolls: [8],
    }))

    expect(resolved.state.combatants.target.currentHp).toBe(100)
    expect(resolved.events).not.toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      targetId: 'target',
    }))
  })

  it('blinds a target that fails a Dust Mephit Death Burst save', () => {
    const { killed, snapshot } = singleTargetDeathScenario('dust-mephit', 5)
    const resolved = expectSuccess(resolveSingleTargetDeathArea({
      state: killed.state,
      snapshot,
      d20: 1,
      damageRolls: [],
    }))
    const target = resolved.state.combatants.target

    expect(target.conditions).toContain('blinded')
    expect(target.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'blinded',
      duration: expect.objectContaining({
        type: 'rounds',
        remainingRounds: 10,
        tickOn: 'target-turn-end',
      }),
      repeatSave: expect.objectContaining({
        ability: 'con',
        dc: 10,
        timing: 'target-turn-end',
        onSuccess: 'remove',
      }),
    }))
  })

  it('allows one death-area effect per source even if that source is revived and dies again', () => {
    const { killed, snapshot } = singleTargetDeathScenario('steam-mephit', 5)
    const resolved = expectSuccess(resolveSingleTargetDeathArea({
      state: killed.state,
      snapshot,
      d20: 20,
      damageRolls: [1],
    }))
    expect(dnd5ePendingMonsterDeathAreaEffects(resolved.state)).toHaveLength(0)

    const revived = structuredClone(resolved.state)
    revived.active = true
    revived.initiativeIndex = revived.initiativeOrder.indexOf('killer')
    revived.combatants.killer.turn.actionAvailable = true
    revived.combatants.source.currentHp = 1
    revived.combatants.source.deathSaves = {
      successes: 0,
      failures: 0,
      stable: false,
      dead: false,
    }
    const killedAgain = expectSuccess(kill(revived, 'killer', 'source'))

    expect(dnd5ePendingMonsterDeathAreaEffects(killedAgain.state)).toHaveLength(0)
    expect(killedAgain.events).not.toContainEqual(expect.objectContaining({
      type: 'monster-death-area-effect-pending',
      snapshot: expect.objectContaining({ sourceId: 'source' }),
    }))
  })

  it('queues the next death-area effect when one burst kills another source', () => {
    const killer = combatant('killer', 50)
    const balor = combatant('balor', 40, {
      controller: 'dm',
      statBlockId: 'srd-5.1:balor',
      currentHp: 1,
    })
    const steam = combatant('steam', 30, {
      controller: 'dm',
      statBlockId: 'srd-5.1:steam-mephit',
      currentHp: 1,
      maxHp: 10,
    })
    const witness = combatant('witness', 20)
    const anchor = combatant('anchor', 10, { controller: 'dm' })
    const state = startDnd5eHeadlessCombat(
      'death-area-chain',
      [killer, balor, steam, witness, anchor],
    )
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(balor.id, steam.id)]: 30,
      [dnd5eCombatantPairKey(balor.id, witness.id)]: 35,
      [dnd5eCombatantPairKey(balor.id, killer.id)]: 100,
      [dnd5eCombatantPairKey(balor.id, anchor.id)]: 100,
      [dnd5eCombatantPairKey(steam.id, witness.id)]: 5,
      [dnd5eCombatantPairKey(steam.id, killer.id)]: 100,
      [dnd5eCombatantPairKey(steam.id, anchor.id)]: 100,
    }

    const killed = expectSuccess(kill(state, killer.id, balor.id))
    const balorSnapshot = dnd5ePendingMonsterDeathAreaEffects(killed.state)[0]
    expect(balorSnapshot).toMatchObject({
      sourceId: balor.id,
      ruleId: 'death-throes',
      targetIds: [steam.id],
    })

    const resolved = expectSuccess(resolveDnd5eHeadlessAction(killed.state, {
      type: 'resolve-monster-death-area-effect',
      actorId: balor.id,
      snapshotId: balorSnapshot.id,
      resolution: {
        schemaVersion: 1,
        targetIds: [steam.id],
        targetSavingThrows: [{ targetId: steam.id, d20: 1 }],
        damageRolls: Array(20).fill(1),
      },
    }))
    const chained = dnd5ePendingMonsterDeathAreaEffects(resolved.state)

    expect(resolved.state.combatants.steam.deathSaves.dead).toBe(true)
    expect(chained).toHaveLength(1)
    expect(chained[0]).toMatchObject({
      sourceId: steam.id,
      ruleId: 'death-burst',
      targetIds: [witness.id],
    })
    expect(resolved.events).toContainEqual({
      type: 'monster-death-area-effect-pending',
      snapshot: chained[0],
    })
  })
})
