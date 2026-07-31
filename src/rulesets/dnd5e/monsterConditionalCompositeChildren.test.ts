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
  statBlockId?: string
  abilities?: Dnd5eCombatant['abilities']
  sizeRank?: number
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
    sizeRank: input.sizeRank ?? 2,
    concentrating: false,
  })
}

function encounter(
  slug: string,
  targets: readonly {
    id: string
    x: number
    sizeRank?: number
  }[] = [{ id: 'hero', x: 5 }],
): Dnd5eHeadlessCombatState {
  const monster = getDnd5eSrdMonsterBySlug(slug)!
  const source = combatant({
    id: 'monster',
    controller: 'dm',
    initiative: 20,
    x: 0,
    statBlockId: monster.id,
    abilities: monster.abilities,
    sizeRank: 5,
  })
  const heroes = targets.map((target, index) =>
    combatant({
      ...target,
      controller: 'player',
      initiative: 10 - index,
    }))
  const state = startDnd5eHeadlessCombat(
    `conditional-composite:${slug}`,
    [source, ...heroes],
  )
  state.coordinateUnitsPerFoot = 1
  state.distanceFeetByCombatantPair = Object.fromEntries(
    targets.map((target) => [
      dnd5eCombatantPairKey(source.id, target.id),
      target.x,
    ]),
  )
  return state
}

function minimumDamageRolls(
  slug: string,
  actionId: string,
): readonly (readonly number[])[] {
  const attack = getDnd5eSrdMonsterBySlug(slug)?.actions.find(
    (action) => action.id === actionId,
  )?.attack
  expect(attack, `${slug}/${actionId}`).toBeDefined()
  return attack!.damage.map((damage) =>
    Array.from({ length: damage.count }, () => 1))
}

function miss(targetId = 'hero'): Dnd5eMonsterActionRoll {
  return { targetId, d20: 1, damageRolls: [] }
}

function relationHit(
  slug: 'kraken',
  actionId: 'tentacle',
  targetId: string,
): Dnd5eMonsterActionRoll {
  return {
    targetId,
    d20: 2,
    damageRolls: minimumDamageRolls(slug, actionId),
    onHitEffectRolls: [{ effectId: 'tentacle-grapple' }],
  }
}

function sourceRelationTargets(
  state: Dnd5eHeadlessCombatState,
  slotGroup: string,
): string[] {
  return Object.values(state.combatants).flatMap((target) =>
    (target.classState.activeEffects ?? []).flatMap((effect) =>
      effect.dependsOnEffectId == null &&
      effect.source.actorId === 'monster' &&
      effect.relation?.slotGroup === slotGroup
        ? [target.id]
        : []))
}

describe('conditional composite Multiattack children', () => {
  it('keeps two missed Kraken Tentacles and marks the now-unusable Fling unused', () => {
    const result = resolveDnd5eHeadlessAction(encounter('kraken'), {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'monster',
      actionId: 'multiattack-two-tentacles-and-fling',
      steps: [
        { kind: 'weapon', actionId: 'tentacle', roll: miss() },
        { kind: 'weapon', actionId: 'tentacle', roll: miss() },
        {
          kind: 'special',
          actionId: 'fling',
          targetId: 'hero',
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.position).toEqual({ x: 5, y: 0 })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-multiattack-composite-resolved',
      resolvedActionIds: ['tentacle', 'tentacle'],
      skippedActionIds: ['fling'],
    }))
    expect(result.events.filter((event) =>
      event.type === 'turn-resource-spent' &&
      event.actorId === 'monster' &&
      event.resource === 'action')).toHaveLength(1)
  })

  it('consumes two distinct Kraken relations in sequence', () => {
    const initial = encounter('kraken', [
      { id: 'hero-1', x: 5 },
      { id: 'hero-2', x: 10 },
    ])
    const prelinked = resolveDnd5eHeadlessAction(initial, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'tentacle',
      rolls: [relationHit('kraken', 'tentacle', 'hero-1')],
    })
    expect(prelinked.ok, prelinked.ok ? undefined : prelinked.reason).toBe(true)
    if (!prelinked.ok) return
    prelinked.state.combatants.monster.turn.actionAvailable = true

    const result = resolveDnd5eHeadlessAction(prelinked.state, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'monster',
      actionId: 'multiattack-tentacle-and-two-flings',
      steps: [
        {
          kind: 'weapon',
          actionId: 'tentacle',
          roll: relationHit('kraken', 'tentacle', 'hero-2'),
        },
        {
          kind: 'special',
          actionId: 'fling',
          targetId: 'hero-1',
          forcedMovements: [{
            targetId: 'hero-1',
            to: { x: 35, y: 0 },
            distanceFeet: 30,
          }],
          damageRolls: [1, 1, 1],
        },
        {
          kind: 'special',
          actionId: 'fling',
          targetId: 'hero-2',
          forcedMovements: [{
            targetId: 'hero-2',
            to: { x: 40, y: 0 },
            distanceFeet: 30,
          }],
          damageRolls: [1, 1, 1],
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants['hero-1'].position).toEqual({ x: 35, y: 0 })
    expect(result.state.combatants['hero-2'].position).toEqual({ x: 40, y: 0 })
    expect(sourceRelationTargets(result.state, 'tentacle')).toEqual([])
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-multiattack-composite-resolved',
      resolvedActionIds: ['tentacle', 'fling', 'fling'],
      skippedActionIds: [],
    }))
  })

  it('atomically rejects two executable Kraken Flings aimed at one relation target', () => {
    const initial = encounter('kraken', [
      { id: 'hero-1', x: 5 },
      { id: 'hero-2', x: 10 },
    ])
    const prelinked = resolveDnd5eHeadlessAction(initial, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'tentacle',
      rolls: [relationHit('kraken', 'tentacle', 'hero-1')],
    })
    expect(prelinked.ok, prelinked.ok ? undefined : prelinked.reason).toBe(true)
    if (!prelinked.ok) return
    prelinked.state.combatants.monster.turn.actionAvailable = true
    const before = structuredClone(prelinked.state)

    const result = resolveDnd5eHeadlessAction(prelinked.state, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'monster',
      actionId: 'multiattack-tentacle-and-two-flings',
      steps: [
        {
          kind: 'weapon',
          actionId: 'tentacle',
          roll: relationHit('kraken', 'tentacle', 'hero-2'),
        },
        {
          kind: 'special',
          actionId: 'fling',
          targetId: 'hero-1',
          forcedMovements: [{
            targetId: 'hero-1',
            to: { x: 35, y: 0 },
            distanceFeet: 30,
          }],
          damageRolls: [1, 1, 1],
        },
        {
          kind: 'special',
          actionId: 'fling',
          targetId: 'hero-1',
        },
      ],
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(result.state).toEqual(before)
  })

  it('marks a later Kraken Fling unused after the prior Fling exhausts relations', () => {
    const initial = encounter('kraken')
    const prelinked = resolveDnd5eHeadlessAction(initial, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'tentacle',
      rolls: [relationHit('kraken', 'tentacle', 'hero')],
    })
    expect(prelinked.ok, prelinked.ok ? undefined : prelinked.reason).toBe(true)
    if (!prelinked.ok) return
    prelinked.state.combatants.monster.turn.actionAvailable = true

    const result = resolveDnd5eHeadlessAction(prelinked.state, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'monster',
      actionId: 'multiattack-tentacle-and-two-flings',
      steps: [
        { kind: 'weapon', actionId: 'tentacle', roll: miss() },
        {
          kind: 'special',
          actionId: 'fling',
          targetId: 'hero',
          forcedMovements: [{
            targetId: 'hero',
            to: { x: 35, y: 0 },
            distanceFeet: 30,
          }],
          damageRolls: [1, 1, 1],
        },
        {
          kind: 'special',
          actionId: 'fling',
          targetId: 'hero',
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.position).toEqual({ x: 35, y: 0 })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-multiattack-composite-resolved',
      resolvedActionIds: ['tentacle', 'fling'],
      skippedActionIds: ['fling'],
    }))
  })

  it('marks Chuul Tentacles unused when both Pincers miss', () => {
    const result = resolveDnd5eHeadlessAction(encounter('chuul'), {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'monster',
      actionId: 'multiattack-pincers-and-tentacles',
      steps: [
        { kind: 'weapon', actionId: 'pincer', roll: miss() },
        { kind: 'weapon', actionId: 'pincer', roll: miss() },
        {
          kind: 'special',
          actionId: 'tentacles',
          targetId: 'hero',
          d20: 1,
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.conditions).not.toContain('poisoned')
    expect(result.state.combatants.hero.conditions).not.toContain('paralyzed')
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-multiattack-composite-resolved',
      resolvedActionIds: ['pincer', 'pincer'],
      skippedActionIds: ['tentacles'],
    }))
  })

  it('rejects relation-only Kraken and Tarrasque variants at the boundary', () => {
    const kraken = encounter('kraken')
    const krakenBefore = structuredClone(kraken)
    const flings = resolveDnd5eHeadlessAction(kraken, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'monster',
      actionId: 'multiattack-flings',
      steps: [
        { kind: 'skip', actionId: 'fling' },
        { kind: 'skip', actionId: 'fling' },
        { kind: 'skip', actionId: 'fling' },
      ],
    })
    expect(flings).toMatchObject({
      ok: false,
      reason: 'invalid-monster-action',
    })
    expect(flings.state).toEqual(krakenBefore)

    const tarrasque = encounter('tarrasque')
    const tarrasqueBefore = structuredClone(tarrasque)
    const swallow = resolveDnd5eHeadlessAction(tarrasque, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'monster',
      actionId: 'multiattack-swallow',
      steps: [
        { kind: 'weapon', actionId: 'swallow', roll: miss() },
        { kind: 'weapon', actionId: 'claw', roll: miss() },
        { kind: 'weapon', actionId: 'claw', roll: miss() },
        { kind: 'weapon', actionId: 'horns', roll: miss() },
        { kind: 'weapon', actionId: 'tail', roll: miss() },
      ],
    })
    expect(swallow).toMatchObject({
      ok: false,
      reason: 'invalid-monster-action',
    })
    expect(swallow.state).toEqual(tarrasqueBefore)
  })

  it('automatically skips a declared conditional child when its resource is unavailable', () => {
    const state = encounter('gibbering-mouther')
    state.combatants.monster.classState.monsterRechargeReadyByActionId = {
      'blinding-spittle': false,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'monster',
      actionId: 'multiattack',
      steps: [
        { kind: 'weapon', actionId: 'bites', roll: miss() },
        {
          kind: 'area',
          actionId: 'blinding-spittle',
          resolution: {
            schemaVersion: 1,
            targetIds: ['hero'],
            targetSavingThrows: [{ targetId: 'hero', d20: 1 }],
            damageRolls: [],
          },
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.conditions).not.toContain('blinded')
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-multiattack-composite-resolved',
      resolvedActionIds: ['bites'],
      skippedActionIds: ['blinding-spittle'],
    }))
  })
})
