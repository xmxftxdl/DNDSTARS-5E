import { describe, expect, it } from 'vitest'
import type {
  Dnd5eAction,
  Dnd5eActionResult,
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from '../rulesets/dnd5e/headlessCombatEngine'
import {
  applyDnd5eCombatStatisticsObservation,
  combatantContributionScore,
  normalizeSharedCombatStatistics,
  type CombatStatisticsSide,
} from './combatStatistics'

function state(patch: Record<string, unknown> = {}): Dnd5eHeadlessCombatState {
  const combatant = (id: string, name: string, controller: 'dm' | 'player', currentHp: number, usesDeathSaves: boolean) => ({
    id, name, controller, currentHp, usesDeathSaves,
    temporaryHp: 0, classState: {},
  })
  return {
    combatId: 'combat-1', rulesetId: 'dnd5e-2014-srd-5.1', active: true, round: 2, initiativeIndex: 0,
    initiativeOrder: ['fighter', 'goblin', 'cleric'],
    combatants: {
      fighter: combatant('fighter', '战士', 'player', 30, true),
      cleric: combatant('cleric', '牧师', 'player', 24, true),
      goblin: combatant('goblin', '地精', 'dm', 0, false),
    },
    ...patch,
  } as unknown as Dnd5eHeadlessCombatState
}

const sides: Record<string, CombatStatisticsSide> = { fighter: 'player', cleric: 'player', goblin: 'enemy' }

function observe(input: {
  receiptId: string
  actorId: string
  events: Dnd5eCombatEvent[]
  source?: Dnd5eHeadlessCombatState
  resultState?: Dnd5eHeadlessCombatState
}) {
  const source = input.source ?? state()
  const action = { type: 'move', actorId: input.actorId, to: { x: 0, y: 0 }, distance: 0 } as Dnd5eAction
  const result: Dnd5eActionResult = { ok: true, state: input.resultState ?? source, events: input.events }
  return {
    mapId: 'map-1', source, action, result,
    receiptId: input.receiptId, observedAt: Number(input.receiptId.replace(/\D/g, '')) || 1,
    sideByCombatantId: sides,
  }
}

describe('Headless combat statistics', () => {
  it('uses effective damage, attributes healing and records control, defeat, and rescue contributions', () => {
    let session = applyDnd5eCombatStatisticsObservation(undefined, observe({
      receiptId: 'r1', actorId: 'fighter',
      events: [
        { type: 'attack-resolved', actorId: 'fighter', targetId: 'goblin', d20: 20, total: 25, armorClass: 15, hit: true, critical: true },
        { type: 'damage-applied', sourceId: 'fighter', targetId: 'goblin', amount: 60, hpBefore: 40, hpAfter: 0, temporaryHpBefore: 5, temporaryHpAfter: 0 },
        { type: 'condition-applied', actorId: 'fighter', targetId: 'goblin', condition: 'prone' },
      ],
    }))
    session = applyDnd5eCombatStatisticsObservation(session, observe({
      receiptId: 'r2', actorId: 'cleric',
      events: [{ type: 'healing-applied', targetId: 'fighter', amount: 8, hpBefore: 0, hpAfter: 8 }],
    }))

    expect(session.combatants.fighter).toMatchObject({
      damageDealt: 45, attacks: 1, hits: 1, criticalHits: 1,
      hostileConditionsApplied: 1, knockouts: 1, kills: 1,
    })
    expect(session.combatants.goblin.damageTaken).toBe(45)
    expect(session.combatants.cleric).toMatchObject({ healingDone: 8, alliesRescued: 1 })
    expect(session.combatants.fighter.healingReceived).toBe(8)
    expect(combatantContributionScore(session.combatants.fighter)).toBe(60)
  })

  it('counts action economy, class resources, slots, saves, concentration, and damage prevention', () => {
    const session = applyDnd5eCombatStatisticsObservation(undefined, observe({
      receiptId: 'r3', actorId: 'cleric',
      events: [
        { type: 'turn-resource-spent', actorId: 'cleric', resource: 'action' },
        { type: 'turn-resource-spent', actorId: 'cleric', resource: 'bonusAction' },
        { type: 'turn-resource-spent', actorId: 'cleric', resource: 'reaction' },
        { type: 'turn-resource-spent', actorId: 'cleric', resource: 'movement', amount: 15 },
        { type: 'class-resource-spent', actorId: 'cleric', resourceKey: 'channel-divinity', current: 0, max: 1 },
        { type: 'spell-cast', actorId: 'cleric', targetId: 'fighter', spellId: 'cure-wounds', slotLevel: 2 },
        { type: 'saving-throw-resolved', targetId: 'cleric', ability: 'wis', d20: 14, modifier: 5, total: 19, dc: 15, success: true },
        { type: 'concentration-resolved', actorId: 'cleric', d20: 12, total: 15, dc: 10, success: true },
        { type: 'damage-reduced', targetId: 'cleric', source: 'deflect-missiles', d10: 8, modifier: 5, amount: 13, damageBefore: 16, damageAfter: 3, caught: false },
      ],
    }))
    expect(session.combatants.cleric).toMatchObject({
      actionsSpent: 1, bonusActionsSpent: 1, reactionsSpent: 1, movementSpentFeet: 15,
      classResourcesSpent: 1, spellSlotsSpent: 1, successfulSaves: 1,
      concentrationChecks: 1, concentrationMaintained: 1, damagePrevented: 13,
    })
  })

  it('deduplicates replayed Headless transactions and fails closed on damaged shared data', () => {
    const observation = observe({
      receiptId: 'same', actorId: 'fighter',
      events: [{ type: 'damage-applied', sourceId: 'fighter', targetId: 'goblin', amount: 5, hpBefore: 5, hpAfter: 0, temporaryHpBefore: 0, temporaryHpAfter: 0 }],
    })
    const first = applyDnd5eCombatStatisticsObservation(undefined, observation)
    const replayed = applyDnd5eCombatStatisticsObservation(first, observation)
    expect(replayed.combatants.fighter.damageDealt).toBe(5)

    const shared = { schemaVersion: 1, sessions: [replayed], updatedAt: 10 }
    expect(normalizeSharedCombatStatistics(shared)?.sessions).toHaveLength(1)
    expect(normalizeSharedCombatStatistics({
      ...shared,
      sessions: [{ ...replayed, combatants: { fighter: { ...replayed.combatants.fighter, damageDealt: -1 } } }],
    })).toBeUndefined()
  })
})
