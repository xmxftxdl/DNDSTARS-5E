import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eMonsterActionRoll,
} from './headlessCombatEngine'
import {
  dnd5eMonsterMultiattackConstraint,
  dnd5eMonsterMultiattackSupportsSingleTarget,
} from './monsterMultiattackConstraints'

function combatant(input: {
  id: string
  initiative: number
  controller: 'dm' | 'player'
  statBlockId?: string
  x?: number
  airborne?: boolean
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 200,
    maxHp: 200,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x ?? 0, y: 0 },
    airborne: input.airborne,
    concentrating: false,
    statBlockId: input.statBlockId,
  })
}

function rolls(
  entries: readonly {
    targetId: string
    d20: number
    damageRolls: readonly (readonly number[])[]
    onHitEffectRolls?: Dnd5eMonsterActionRoll['onHitEffectRolls']
  }[],
): readonly Dnd5eMonsterActionRoll[] {
  return entries
}

describe('monster Multiattack occurrence constraints', () => {
  it('publishes stable shared constraints for conditional and split-target attacks', () => {
    expect(dnd5eMonsterMultiattackConstraint(
      'srd-5.1:grick',
      'multiattack',
    )).toMatchObject({
      occurrences: [{
        occurrenceIndex: 1,
        requiresPreviousHitAt: 0,
        sameTargetAs: 0,
      }],
    })
    expect(dnd5eMonsterMultiattackSupportsSingleTarget(
      'srd-5.1:tyrannosaurus-rex',
      'multiattack',
    )).toBe(false)
    expect(dnd5eMonsterMultiattackSupportsSingleTarget(
      'srd-5.1:kraken',
      'multiattack-flings',
    )).toBe(false)
    expect(dnd5eMonsterMultiattackSupportsSingleTarget(
      'srd-5.1:tarrasque',
      'multiattack-swallow',
    )).toBe(true)
  })

  it('only resolves the Grick beak when its tentacles hit the same target', () => {
    const state = startDnd5eHeadlessCombat('grick-conditional', [
      combatant({
        id: 'grick',
        initiative: 20,
        controller: 'dm',
        statBlockId: 'srd-5.1:grick',
      }),
      combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
    ])
    const missed = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'grick',
      actionId: 'multiattack',
      rolls: rolls([
        { targetId: 'hero', d20: 1, damageRolls: [[1, 1]] },
        { targetId: 'hero', d20: 20, damageRolls: [[1]] },
      ]),
    })

    expect(missed.ok, missed.ok ? undefined : missed.reason).toBe(true)
    if (!missed.ok) return
    expect(missed.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(1)
    expect(missed.state.combatants.hero.currentHp).toBe(200)

    const hitState = startDnd5eHeadlessCombat('grick-conditional-hit', [
      combatant({
        id: 'grick',
        initiative: 20,
        controller: 'dm',
        statBlockId: 'srd-5.1:grick',
      }),
      combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
    ])
    const hit = resolveDnd5eHeadlessAction(hitState, {
      type: 'monster-action',
      actorId: 'grick',
      actionId: 'multiattack',
      rolls: rolls([
        { targetId: 'hero', d20: 10, damageRolls: [[1, 1]] },
        { targetId: 'hero', d20: 10, damageRolls: [[1]] },
      ]),
    })

    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    if (!hit.ok) return
    expect(hit.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(2)
  })

  it('keeps the Tyrannosaurus split-target requirement authoritative', () => {
    const state = startDnd5eHeadlessCombat('tyrannosaurus-split-target', [
      combatant({
        id: 'tyrannosaurus',
        initiative: 20,
        controller: 'dm',
        statBlockId: 'srd-5.1:tyrannosaurus-rex',
      }),
      combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
    ])

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'tyrannosaurus',
      actionId: 'multiattack',
      rolls: rolls([
        { targetId: 'hero', d20: 1, damageRolls: [] },
        { targetId: 'hero', d20: 1, damageRolls: [] },
      ]),
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('lets a Giant Crocodile tail the same target after Bite misses', () => {
    const state = startDnd5eHeadlessCombat('crocodile-bite-miss', [
      combatant({
        id: 'crocodile',
        initiative: 20,
        controller: 'dm',
        statBlockId: 'srd-5.1:giant-crocodile',
      }),
      combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'crocodile',
      actionId: 'multiattack',
      rolls: rolls([
        { targetId: 'hero', d20: 1, damageRolls: [[1, 1, 1]] },
        { targetId: 'hero', d20: 10, damageRolls: [[1, 1]] },
      ]),
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(2)
    expect(result.state.combatants.hero.currentHp).toBeLessThan(200)
  })

  it('commits Bite but skips same-target Tail after Bite grapples', () => {
    const state = startDnd5eHeadlessCombat('crocodile-bite-hit', [
      combatant({
        id: 'crocodile',
        initiative: 20,
        controller: 'dm',
        statBlockId: 'srd-5.1:giant-crocodile',
      }),
      combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'crocodile',
      actionId: 'multiattack',
      rolls: rolls([
        {
          targetId: 'hero',
          d20: 10,
          damageRolls: [[1, 1, 1]],
          onHitEffectRolls: [{ effectId: 'bite-grapple' }],
        },
        { targetId: 'hero', d20: 10, damageRolls: [[1, 1]] },
      ]),
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    const attacks = result.events.filter((event) =>
      event.type === 'attack-resolved')
    expect(attacks).toHaveLength(1)
    expect(result.state.combatants.hero.classState.activeEffects?.some(
      (effect) => effect.relation?.slotGroup === 'bite',
    )).toBe(true)
  })

  it('allows the Tyrannosaurus bite and tail against two different targets', () => {
    const state = startDnd5eHeadlessCombat('tyrannosaurus-two-targets', [
      combatant({
        id: 'tyrannosaurus',
        initiative: 20,
        controller: 'dm',
        statBlockId: 'srd-5.1:tyrannosaurus-rex',
      }),
      combatant({ id: 'hero-a', initiative: 10, controller: 'player', x: 5 }),
      combatant({ id: 'hero-b', initiative: 5, controller: 'player', x: 5 }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'tyrannosaurus',
      actionId: 'multiattack',
      rolls: rolls([
        { targetId: 'hero-a', d20: 1, damageRolls: [] },
        { targetId: 'hero-b', d20: 1, damageRolls: [] },
      ]),
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved').map((event) =>
      event.type === 'attack-resolved' ? event.targetId : undefined,
    )).toEqual(['hero-a', 'hero-b'])
  })

  it('only enables the Wyvern claw replacement while airborne', () => {
    const createState = (airborne: boolean) =>
      startDnd5eHeadlessCombat(`wyvern-airborne-${airborne}`, [
        combatant({
          id: 'wyvern',
          initiative: 20,
          controller: 'dm',
          statBlockId: 'srd-5.1:wyvern',
          airborne,
        }),
        combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
      ])
    const action = {
      type: 'monster-action' as const,
      actorId: 'wyvern',
      actionId: 'multiattack-bite-and-claws',
      rolls: rolls([
        { targetId: 'hero', d20: 1, damageRolls: [] },
        { targetId: 'hero', d20: 1, damageRolls: [] },
      ]),
    }

    expect(resolveDnd5eHeadlessAction(createState(false), action))
      .toMatchObject({ ok: false, reason: 'invalid-monster-action' })
    expect(resolveDnd5eHeadlessAction(createState(true), action).ok).toBe(true)
  })
})
