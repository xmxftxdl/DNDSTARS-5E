import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  dnd5eMonsterMultiattackChildResourcesAvailable,
  dnd5eMonsterMultiattackChildUsageCounts,
} from './monsterMultiattackResources'
import type { Dnd5eMonsterAction } from './monsters'

const RESOURCE_ACTIONS = [
  {
    id: 'tail-spike',
    name: 'Tail Spike',
    description: '',
    kind: 'weapon-attack',
    automation: 'headless',
    usage: { kind: 'per-day', max: 24 },
  },
  {
    id: 'multiattack-tail-spikes',
    name: 'Multiattack (Tail Spikes)',
    description: '',
    kind: 'multiattack',
    automation: 'headless',
    sequence: ['tail-spike', 'tail-spike', 'tail-spike'],
  },
] as const satisfies readonly Dnd5eMonsterAction[]

function combatant(
  id: string,
  initiative: number,
  controller: 'dm' | 'player',
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: controller === 'dm' ? 0 : 50, y: 0 },
    concentrating: false,
  })
}

describe('monster Multiattack child resources', () => {
  it('counts repeated resource-owning child actions without charging the wrapper', () => {
    const action = RESOURCE_ACTIONS[1]
    const counts = dnd5eMonsterMultiattackChildUsageCounts(
      { actions: RESOURCE_ACTIONS },
      action,
    )

    expect([...counts]).toEqual([['tail-spike', 3]])
    expect(dnd5eMonsterMultiattackChildResourcesAvailable(
      { actions: RESOURCE_ACTIONS },
      action,
      { usesByActionId: { 'tail-spike': { current: 3, max: 24 } } },
    )).toBe(true)
    expect(dnd5eMonsterMultiattackChildResourcesAvailable(
      { actions: RESOURCE_ACTIONS },
      action,
      { usesByActionId: { 'tail-spike': { current: 2, max: 24 } } },
    )).toBe(false)
  })

  it('atomically consumes three Manticore tail spikes for one Multiattack action', () => {
    const manticore = combatant('manticore', 20, 'dm')
    manticore.statBlockId = 'srd-5.1:manticore'
    manticore.classState.monsterActionUsesByActionId = {
      'tail-spike': { current: 24, max: 24 },
    }
    const state = startDnd5eHeadlessCombat('manticore-tail-spikes', [
      manticore,
      combatant('hero', 10, 'player'),
    ])

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'manticore',
      actionId: 'multiattack-tail-spikes',
      rolls: Array.from({ length: 3 }, () => ({
        targetId: 'hero',
        d20: 10,
        damageRolls: [[1]],
      })),
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(
      result.state.combatants.manticore.classState
        .monsterActionUsesByActionId?.['tail-spike'],
    ).toEqual({ current: 21, max: 24 })
    expect(result.state.combatants.hero.currentHp).toBe(88)
    expect(result.events.filter((event) =>
      event.type === 'turn-resource-spent' &&
      event.actorId === 'manticore' &&
      event.resource === 'action')).toHaveLength(1)
  })

  it('rejects the whole transaction before spending the action when only two spikes remain', () => {
    const manticore = combatant('manticore', 20, 'dm')
    manticore.statBlockId = 'srd-5.1:manticore'
    manticore.classState.monsterActionUsesByActionId = {
      'tail-spike': { current: 2, max: 24 },
    }
    const state = startDnd5eHeadlessCombat('manticore-tail-spikes-empty', [
      manticore,
      combatant('hero', 10, 'player'),
    ])

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'manticore',
      actionId: 'multiattack-tail-spikes',
      rolls: Array.from({ length: 3 }, () => ({
        targetId: 'hero',
        d20: 10,
        damageRolls: [[1]],
      })),
    })

    expect(result).toMatchObject({ ok: false, reason: 'class-resource-unavailable' })
    expect(
      result.state.combatants.manticore.classState
        .monsterActionUsesByActionId?.['tail-spike'],
    ).toEqual({ current: 2, max: 24 })
    expect(result.state.combatants.manticore.turn.actionAvailable).toBe(true)
    expect(result.state.combatants.hero.currentHp).toBe(100)
  })
})
