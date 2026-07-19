import { describe, expect, it } from 'vitest'
import {
  dnd5eActiveStandardConditions,
  dnd5eConditionAbilityCheckDisadvantage,
  dnd5eConditionGrantsAttackAdvantage,
  dnd5eConditionHitIsAutomaticCritical,
  dnd5eConditionImposesAttackDisadvantage,
  dnd5eConditionIncapacitated,
  dnd5eConditionSavingThrowAutomaticallyFails,
  dnd5eConditionSavingThrowDisadvantage,
  dnd5eConditionSetsSpeedToZero,
  dnd5eStandardConditionId,
  setDnd5eStandardCondition,
} from './conditions'
import {
  applyDnd5eStandardConditionEffect,
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatEvent,
} from './headlessCombatEngine'
import { dnd5eConditionsFromActiveEffects, migrateLegacyDnd5eConditions } from './activeEffects'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

function combatant(id: string, initiative: number, conditions: string[] = []) {
  const result = createDnd5eCombatant({
    id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false,
  })
  const activeEffects = migrateLegacyDnd5eConditions({ targetId: id, conditions })
  result.classState.activeEffects = activeEffects
  result.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
  return result
}

describe('D&D 5e 2014 standard condition engine', () => {
  it('normalizes Chinese and English aliases to stable condition IDs', () => {
    expect(dnd5eStandardConditionId('目盲')).toBe('blinded')
    expect(dnd5eStandardConditionId('STUNNED')).toBe('stunned')
    expect(dnd5eStandardConditionId('惊惧')).toBe('frightened')
    expect(dnd5eActiveStandardConditions({ conditions: ['目盲', 'blinded', '束缚'] }))
      .toEqual(['blinded', 'restrained'])
  })

  it('exposes the mechanical flags used by Headless combat', () => {
    expect(dnd5eConditionSetsSpeedToZero({ conditions: ['restrained'] })).toBe(true)
    expect(dnd5eConditionIncapacitated({ conditions: ['paralyzed'] })).toBe(true)
    expect(dnd5eConditionImposesAttackDisadvantage({ attacker: { conditions: ['poisoned'] } })).toBe(true)
    expect(dnd5eConditionAbilityCheckDisadvantage({ conditions: ['中毒'] })).toBe(true)
    expect(dnd5eConditionGrantsAttackAdvantage({ target: { conditions: ['stunned'] } })).toBe(true)
    expect(dnd5eConditionSavingThrowDisadvantage({ conditions: ['restrained'] }, 'dex')).toBe(true)
    expect(dnd5eConditionSavingThrowAutomaticallyFails({ conditions: ['paralyzed'] }, 'str')).toBe(true)
    expect(dnd5eConditionSavingThrowAutomaticallyFails({ conditions: ['paralyzed'] }, 'con')).toBe(false)
    expect(dnd5eConditionHitIsAutomaticCritical({ target: { conditions: ['unconscious'] }, distanceFeet: 5 })).toBe(true)
    expect(dnd5eConditionHitIsAutomaticCritical({ target: { conditions: ['unconscious'] }, distanceFeet: 10 })).toBe(false)
  })

  it('adds and removes canonical DM condition labels without deleting plugin conditions', () => {
    const added = setDnd5eStandardCondition({
      conditions: ['目盲', 'blinded', 'plugin.example:marked'],
      condition: 'poisoned',
      active: true,
    })
    expect(added).toEqual({
      ok: true,
      conditions: ['blinded', 'plugin.example:marked', 'poisoned'],
    })

    expect(setDnd5eStandardCondition({
      conditions: added.conditions,
      condition: 'blinded',
      active: false,
    })).toEqual({
      ok: true,
      conditions: ['plugin.example:marked', 'poisoned'],
    })
  })

  it('rejects adding an immune condition but still permits removing one', () => {
    expect(setDnd5eStandardCondition({
      conditions: [],
      condition: 'poisoned',
      active: true,
      conditionImmunities: ['中毒'],
    })).toEqual({ ok: false, reason: 'condition-immune', conditions: [] })

    expect(setDnd5eStandardCondition({
      conditions: ['poisoned'],
      condition: 'poisoned',
      active: false,
      conditionImmunities: ['poisoned'],
    })).toEqual({ ok: true, conditions: [] })
  })

  it('only applies frightened attack disadvantage when its source is visible', () => {
    const attacker = { conditions: ['frightened'] }
    expect(dnd5eConditionImposesAttackDisadvantage({ attacker })).toBe(false)
    expect(dnd5eConditionImposesAttackDisadvantage({ attacker, frighteningSourceVisible: true })).toBe(true)
  })

  it('keeps a condition until every structured source has ended', () => {
    const state = startDnd5eHeadlessCombat('multi-source-condition', [
      combatant('source-b', 30), combatant('target', 20), combatant('source-a', 10),
    ])
    const events: Dnd5eCombatEvent[] = []
    applyDnd5eStandardConditionEffect(state.combatants.target, state.combatants['source-a'], {
      id: 'source-a:blind', rulesId: 'spell-a', condition: 'blinded',
      duration: { type: 'until-turn-boundary', boundary: 'source-turn-start' },
    }, events)
    applyDnd5eStandardConditionEffect(state.combatants.target, state.combatants['source-b'], {
      id: 'source-b:blind', rulesId: 'spell-b', condition: 'blinded',
      duration: { type: 'rounds', remainingRounds: 2, tickOn: 'target-turn-end' },
    }, events)

    const targetTurn = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'source-b' })
    expect(targetTurn.ok).toBe(true)
    const sourceATurn = resolveDnd5eHeadlessAction(targetTurn.state, { type: 'end-turn', actorId: 'target' })
    expect(sourceATurn.ok).toBe(true)
    expect(sourceATurn.state.combatants.target.conditions).toContain('blinded')
    expect(sourceATurn.state.combatants.target.classState.activeEffects).toEqual([
      expect.objectContaining({
        id: 'source-b:blind',
        source: expect.objectContaining({ rulesId: 'spell-b' }),
        duration: expect.objectContaining({ remainingRounds: 1 }),
      }),
    ])
  })

  it('prevents an incapacitated active creature from taking normal actions', () => {
    const state = startDnd5eHeadlessCombat('incapacitated-action', [
      combatant('actor', 20, ['paralyzed']), combatant('other', 10),
    ])
    expect(resolveDnd5eHeadlessAction(state, { type: 'dash', actorId: 'actor' }))
      .toMatchObject({ ok: false, reason: 'invalid-actor' })
  })
})
