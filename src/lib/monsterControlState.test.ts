import { describe, expect, it } from 'vitest'
import {
  createDnd5eMonsterControlState,
  dnd5eMonsterManualControlEnabled,
  dnd5eMonsterManualMovementEnabled,
  isDnd5eMonsterControlStateV1,
  isDnd5eMonsterControlWireStateV1,
  normalizeDnd5eMonsterControlState,
} from './monsterControlState'

describe('permanent DM monster control', () => {
  it('always creates manual control regardless of settlement mode', () => {
    expect(createDnd5eMonsterControlState('automatic', 10)).toEqual({
      schemaVersion: 1,
      mode: 'manual',
      pauseRequested: false,
      updatedAt: 10,
    })
    expect(createDnd5eMonsterControlState('manual', 20).mode).toBe('manual')
  })

  it('migrates legacy automatic snapshots to permanent manual control', () => {
    expect(normalizeDnd5eMonsterControlState({
      schemaVersion: 1,
      mode: 'automatic',
      pauseRequested: true,
      controlledTokenId: ' goblin ',
      requestedAt: 20,
      updatedAt: 20,
    }, 'automatic', 30)).toEqual({
      schemaVersion: 1,
      mode: 'manual',
      pauseRequested: false,
      controlledTokenId: 'goblin',
      updatedAt: 20,
    })
  })

  it('accepts automatic only through the wire migration validator', () => {
    const legacy = {
      schemaVersion: 1,
      mode: 'automatic',
      pauseRequested: false,
      updatedAt: 1,
    }
    expect(isDnd5eMonsterControlStateV1(legacy)).toBe(false)
    expect(isDnd5eMonsterControlWireStateV1(legacy)).toBe(true)
    expect(isDnd5eMonsterControlWireStateV1({
      schemaVersion: 1,
      mode: 'ai',
      pauseRequested: false,
      updatedAt: 1,
    })).toBe(false)
  })

  it('allows only the current enemy token to use manual movement in combat', () => {
    const state = createDnd5eMonsterControlState('automatic', 10)
    expect(dnd5eMonsterManualControlEnabled(state)).toBe(true)
    expect(dnd5eMonsterManualMovementEnabled(state, {
      combatActive: true,
      currentTokenId: 'goblin',
      token: { id: 'goblin', type: 'enemy' },
    })).toBe(true)
    expect(dnd5eMonsterManualMovementEnabled(state, {
      combatActive: true,
      currentTokenId: 'goblin',
      token: { id: 'orc', type: 'enemy' },
    })).toBe(false)
  })
})
