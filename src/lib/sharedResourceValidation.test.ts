import { describe, expect, it } from 'vitest'
import { validateAndMigrateSharedResource } from './sharedResourceValidation'
import { createDnd5eConditionEffect } from '../rulesets/dnd5e/activeEffects'

describe('shared resource runtime validation', () => {
  it('covers every current shared envelope and allows future plugin objects', () => {
    const resources: Record<string, object> = {
      characters: { characters: [], updatedAt: 1 },
      maps: { maps: [], updatedAt: 1 },
      spellbook: { spells: [], updatedAt: 1 },
      combat: { active: false, updatedAt: 1 },
      'combat-log': { entries: [], updatedAt: 1 },
      'dice-events': { events: [], updatedAt: 1 },
      'combat-interrupts': { interrupts: [], updatedAt: 1 },
      'player-action-requests': { requests: [], updatedAt: 1 },
      'player-action-processed': { actionIds: [], updatedAt: 1 },
      'dm-authority-ready': { ready: false, updatedAt: 1 },
      'player-action': { id: 'action', updatedAt: 1 },
      'player-action-ack': { id: 'ack', updatedAt: 1 },
      dice: { id: 'dice', updatedAt: 1 },
      'future-plugin-state': { schemaVersion: 1, payload: {} },
    }
    for (const [name, value] of Object.entries(resources)) {
      expect(validateAndMigrateSharedResource(name, value).status, name).toBe('valid')
    }
  })

  it('rejects broken envelopes instead of passing them to a Store', () => {
    expect(validateAndMigrateSharedResource('characters', null).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('characters', { characters: 'broken' }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('maps', { maps: [{ id: '' }] }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('spellbook', { spells: 'broken' }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('combat', { active: 'yes' }).status).toBe('invalid')
  })

  it('physically migrates the retired enemy AP ledger', () => {
    const result = validateAndMigrateSharedResource('combat', {
      active: true,
      enemyApByToken: { goblin: { current: 1, max: 2 } },
    })
    expect(result.status).toBe('migrated')
    if (result.status !== 'migrated') throw new Error('expected migration')
    expect(result.value.enemyApByToken).toBeUndefined()
  })

  it('migrates legacy condition/timed state into schema v2 at the shared boundary', () => {
    const result = validateAndMigrateSharedResource('characters', {
      characters: [{
        id: 'hero', name: '英雄', conditions: ['blinded'],
        dnd5eCombatState: {
          timedEffects: [{
            id: 'ray', sourceActorId: 'wizard', sourceSpellId: 'ray-of-frost',
            kind: 'speed-penalty', amount: 10, expiresAt: 'source-next-turn-start',
          }],
        },
      }],
    })
    expect(result.status).toBe('migrated')
    if (result.status !== 'migrated') throw new Error('expected migration')
    const character = (result.value.characters as Array<Record<string, unknown>>)[0]
    expect(character.conditions).toEqual(['blinded'])
    const combatState = character.dnd5eCombatState as {
      schemaVersion?: number
      activeEffects?: Array<{ standardCondition?: string; modifiers?: { speedPenaltyFeet?: number } }>
      timedEffects?: unknown
    }
    expect(combatState.schemaVersion).toBe(2)
    expect(combatState.activeEffects?.some((effect) => effect.standardCondition === 'blinded')).toBe(true)
    expect(combatState.activeEffects?.some((effect) => effect.modifiers?.speedPenaltyFeet === 10)).toBe(true)
    expect(combatState.timedEffects).toBeUndefined()
  })

  it('accepts an empty condition projection without manufacturing combat state', () => {
    const result = validateAndMigrateSharedResource('characters', {
      characters: [{ id: 'hero', name: '英雄', conditions: [] }],
    })
    expect(result.status).toBe('valid')
  })

  it('fails closed for malformed v2 effects and a forged conditions projection', () => {
    const effect = createDnd5eConditionEffect({
      id: 'blind', condition: 'blinded', targetId: 'hero', source: { kind: 'dm' },
    })
    expect(validateAndMigrateSharedResource('characters', {
      characters: [{
        id: 'hero', conditions: ['blinded'],
        dnd5eCombatState: { schemaVersion: 2, activeEffects: [{ ...effect, duration: { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' } }] },
      }],
    }).status).toBe('invalid')
    expect(validateAndMigrateSharedResource('characters', {
      characters: [{
        id: 'hero', conditions: [],
        dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect] },
      }],
    }).status).toBe('invalid')
  })
})
