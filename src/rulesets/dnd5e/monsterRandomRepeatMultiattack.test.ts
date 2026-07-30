import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { getDnd5eSrdMonsterBySlug } from './monsters'

function combatant(input: {
  id: string
  initiative: number
  controller: 'dm' | 'player'
  statBlockId?: string
  x?: number
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 50,
    maxHp: 50,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x ?? 0, y: 0 },
    concentrating: false,
    statBlockId: input.statBlockId,
  })
}

function state() {
  return startDnd5eHeadlessCombat('violet-fungus-repeat', [
    combatant({
      id: 'fungus',
      initiative: 20,
      controller: 'dm',
      statBlockId: 'srd-5.1:violet-fungus',
    }),
    combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
  ])
}

function attackRolls(count: number) {
  return Array.from({ length: count }, () => ({
    targetId: 'hero',
    d20: 10,
    damageRolls: [[1]],
  }))
}

describe('random-repeat monster Multiattack', () => {
  it('declares Violet Fungus 1d4 Rotting Touch as a deterministic Headless action', () => {
    const action = getDnd5eSrdMonsterBySlug('violet-fungus')
      ?.actions.find((candidate) => candidate.id === 'multiattack')

    expect(action).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      randomRepeat: {
        actionId: 'rotting-touch',
        dieSides: 4,
        minimum: 1,
        maximum: 4,
      },
    })
  })

  it('uses the submitted count die and spends only one action', () => {
    const result = resolveDnd5eHeadlessAction(state(), {
      type: 'monster-action',
      actorId: 'fungus',
      actionId: 'multiattack',
      randomRepeatRoll: 3,
      rolls: attackRolls(3),
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.currentHp).toBe(47)
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(3)
    expect(result.events.filter((event) =>
      event.type === 'turn-resource-spent' &&
      event.actorId === 'fungus' &&
      event.resource === 'action')).toHaveLength(1)
    expect(result.events).toContainEqual({
      type: 'monster-multiattack-random-repeat-resolved',
      actorId: 'fungus',
      actionId: 'multiattack',
      roll: 3,
      attackCount: 3,
    })
  })

  it('rejects a missing, out-of-range, or mismatched count atomically', () => {
    for (const action of [
      {
        type: 'monster-action' as const,
        actorId: 'fungus',
        actionId: 'multiattack',
        rolls: attackRolls(1),
      },
      {
        type: 'monster-action' as const,
        actorId: 'fungus',
        actionId: 'multiattack',
        randomRepeatRoll: 5,
        rolls: attackRolls(5),
      },
      {
        type: 'monster-action' as const,
        actorId: 'fungus',
        actionId: 'multiattack',
        randomRepeatRoll: 3,
        rolls: attackRolls(2),
      },
    ]) {
      const result = resolveDnd5eHeadlessAction(state(), action)
      expect(result).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
      expect(result.state.combatants.hero.currentHp).toBe(50)
      expect(result.state.combatants.fungus.turn.actionAvailable).toBe(true)
    }
  })
})
