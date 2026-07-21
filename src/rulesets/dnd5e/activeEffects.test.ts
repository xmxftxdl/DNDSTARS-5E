import { describe, expect, it } from 'vitest'
import {
  applyDnd5eActiveEffect,
  createDnd5eConditionEffect,
  dnd5eActiveEffectsPreventReactions,
  dnd5eActiveSpeedPenalty,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
  removeDnd5eActiveEffectsForEvent,
  validateDnd5eActiveEffectsStrict,
} from './activeEffects'
import {
  activeEffectFromDnd5eTimedEffect,
  migrateDnd5eCombatStateEffects,
  migrateDnd5eTimedEffects,
  migrateLegacyDnd5eConditions,
} from './legacyActiveEffectMigration'

describe('D&D 5e ActiveEffectInstance', () => {
  it('deterministically migrates legacy standard and plugin condition strings', () => {
    const first = migrateLegacyDnd5eConditions({ targetId: 'hero', conditions: ['目盲', 'plugin:marked', 'blinded'] })
    const second = migrateLegacyDnd5eConditions({ targetId: 'hero', conditions: ['目盲', 'plugin:marked', 'blinded'] })
    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
    expect(first[0]).toMatchObject({ standardCondition: 'blinded', appliedAt: 0 })
    expect(dnd5eConditionsFromActiveEffects(first)).toEqual(['目盲', 'plugin:marked'])
  })

  it('rejects immunities and refreshes duplicate duration', () => {
    const existing = createDnd5eConditionEffect({
      condition: 'blinded', targetId: 'target', source: { kind: 'spell', actorId: 'caster' },
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' }, appliedAt: 1,
    })
    const incoming = { ...existing, id: 'new-id', duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' } as const }
    expect(applyDnd5eActiveEffect({ effects: [], incoming, conditionImmunities: ['blinded'] }).status)
      .toBe('rejected-immune')
    const refreshed = applyDnd5eActiveEffect({ effects: [existing], incoming })
    expect(refreshed.status).toBe('refreshed')
    expect(refreshed.effects).toEqual([expect.objectContaining({ id: existing.id, duration: incoming.duration })])
  })

  it('removes matching break triggers without touching other effects', () => {
    const damage = createDnd5eConditionEffect({
      condition: 'charmed', targetId: 'target', source: { kind: 'feature' }, breakOn: ['takes-damage'],
    })
    const move = createDnd5eConditionEffect({
      condition: 'grappled', targetId: 'target', source: { kind: 'feature' }, breakOn: ['moves'],
    })
    const resolved = removeDnd5eActiveEffectsForEvent({ effects: [damage, move], trigger: 'takes-damage' })
    expect(resolved.removed.map((effect) => effect.standardCondition)).toEqual(['charmed'])
    expect(resolved.effects.map((effect) => effect.standardCondition)).toEqual(['grappled'])
  })

  it('mirrors and removes stale legacy timed effects', () => {
    const timed = {
      id: 'ray:caster:target', sourceActorId: 'caster', sourceSpellId: 'ray-of-frost',
      kind: 'speed-penalty' as const, amount: 10, expiresAt: 'source-next-turn-start' as const,
    }
    const mirrored = activeEffectFromDnd5eTimedEffect(timed, 'target')
    expect(mirrored).toMatchObject({ legacyTimedEffectId: timed.id, source: { actorId: 'caster' } })
    expect(migrateDnd5eTimedEffects({ targetId: 'target', timedEffects: [], activeEffects: [mirrored] })).toEqual([])
  })

  it('drops malformed shared/plugin lifecycle values at the runtime boundary', () => {
    expect(normalizeDnd5eActiveEffects([{
      schemaVersion: 1, id: 'bad', definitionId: 'condition:blinded', label: '坏状态', kind: 'condition',
      source: { kind: 'network' }, duration: { type: 'forever-and-ever' },
      stackingKey: 'bad', stackingPolicy: 'overwrite-everything',
    }])).toEqual([])
  })

  it('strictly rejects malformed remote values instead of silently repairing them', () => {
    const effect = createDnd5eConditionEffect({
      id: 'blind', condition: 'blinded', targetId: 'target', source: { kind: 'dm' },
    })
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      duration: { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' },
    }])).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.stringContaining('remainingRounds')]) })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end', lastTickTurnKey: '' },
    }])).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.stringContaining('lastTickTurnKey')]) })
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, potency: 'lots' }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('potency')]),
    })
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, potency: Number.POSITIVE_INFINITY }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('potency')]),
    })
  })

  it('migrates old timed mechanics once and then treats them as native active effects', () => {
    const migrated = migrateDnd5eCombatStateEffects({
      targetId: 'target',
      conditions: ['blinded'],
      state: {
        timedEffects: [
          { id: 'slow', sourceActorId: 'caster', sourceSpellId: 'ray-of-frost', kind: 'speed-penalty', amount: 10, expiresAt: 'source-next-turn-start' },
          { id: 'shock', sourceActorId: 'caster', sourceSpellId: 'shocking-grasp', kind: 'reaction-lock', expiresAt: 'target-next-turn-start' },
        ],
      },
    })
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.conditions).toEqual(['blinded'])
    expect(dnd5eActiveSpeedPenalty(migrated.activeEffects)).toBe(10)
    expect(dnd5eActiveEffectsPreventReactions(migrated.activeEffects)).toBe(true)
    const second = migrateDnd5eCombatStateEffects({
      targetId: 'target', state: { schemaVersion: 2, activeEffects: migrated.activeEffects },
      conditions: migrated.conditions,
    })
    expect(second).toEqual(migrated)
  })
})
