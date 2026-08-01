import { describe, expect, it } from 'vitest'
import {
  completeDnd5eMonsterTakeoverAtSafePoint,
  createDnd5eMonsterControlState,
  dnd5eMonsterAutomationEnabled,
  dnd5eMonsterManualMovementEnabled,
  normalizeDnd5eMonsterControlState,
  requestDnd5eMonsterTakeover,
  resumeDnd5eMonsterAutomation,
} from './monsterControlState'

describe('monster control state', () => {
  it('defaults to the settlement mode without inventing a pending pause', () => {
    expect(createDnd5eMonsterControlState('automatic', 10)).toEqual({
      schemaVersion: 1,
      mode: 'automatic',
      pauseRequested: false,
      updatedAt: 10,
    })
    expect(createDnd5eMonsterControlState('manual', 10).mode).toBe('manual')
  })

  it('hands over immediately when no Headless event is in flight', () => {
    const state = requestDnd5eMonsterTakeover(
      createDnd5eMonsterControlState('automatic', 10),
      { currentTokenId: 'goblin-1', eventInFlight: false, now: 20 },
    )
    expect(state).toMatchObject({
      mode: 'manual',
      pauseRequested: false,
      controlledTokenId: 'goblin-1',
    })
  })

  it('waits for the current action to settle before handing control to the DM', () => {
    const pending = requestDnd5eMonsterTakeover(
      createDnd5eMonsterControlState('automatic', 10),
      { currentTokenId: 'goblin-1', eventInFlight: true, now: 20 },
    )
    expect(pending).toMatchObject({
      mode: 'automatic',
      pauseRequested: true,
      controlledTokenId: 'goblin-1',
    })
    expect(dnd5eMonsterAutomationEnabled(pending, 'automatic')).toBe(true)

    const handedOver = completeDnd5eMonsterTakeoverAtSafePoint(
      pending,
      'goblin-1',
      30,
    )
    expect(handedOver).toMatchObject({
      mode: 'manual',
      pauseRequested: false,
      controlledTokenId: 'goblin-1',
    })
  })

  it('does not hand a different monster an old pending takeover', () => {
    const pending = requestDnd5eMonsterTakeover(
      createDnd5eMonsterControlState('automatic', 10),
      { currentTokenId: 'goblin-1', eventInFlight: true, now: 20 },
    )
    expect(completeDnd5eMonsterTakeoverAtSafePoint(pending, 'goblin-2', 30))
      .toEqual(pending)
  })

  it('authorizes Headless click movement only for the current enemy after takeover', () => {
    const manual = requestDnd5eMonsterTakeover(
      createDnd5eMonsterControlState('automatic', 10),
      { currentTokenId: 'ankheg-1', eventInFlight: false, now: 20 },
    )
    const input = {
      combatActive: true,
      currentTokenId: 'ankheg-1',
      token: { id: 'ankheg-1', type: 'enemy' },
    }

    expect(dnd5eMonsterManualMovementEnabled(manual, input)).toBe(true)
    expect(dnd5eMonsterManualMovementEnabled(manual, {
      ...input,
      token: { id: 'ankheg-2', type: 'enemy' },
    })).toBe(false)
    expect(dnd5eMonsterManualMovementEnabled(manual, {
      ...input,
      token: { id: 'ankheg-1', type: 'player' },
    })).toBe(false)
    expect(dnd5eMonsterManualMovementEnabled(manual, {
      ...input,
      combatActive: false,
    })).toBe(false)
    expect(dnd5eMonsterManualMovementEnabled(
      createDnd5eMonsterControlState('automatic', 30),
      input,
    )).toBe(false)
  })

  it('resumes automation and normalizes legacy or malformed snapshots', () => {
    const manual = requestDnd5eMonsterTakeover(
      createDnd5eMonsterControlState('automatic', 10),
      { eventInFlight: false, now: 20 },
    )
    expect(resumeDnd5eMonsterAutomation(manual, 30)).toEqual({
      schemaVersion: 1,
      mode: 'automatic',
      pauseRequested: false,
      updatedAt: 30,
    })
    expect(normalizeDnd5eMonsterControlState({ mode: 'manual' }, 'automatic', 40))
      .toEqual(createDnd5eMonsterControlState('automatic', 40))
    expect(normalizeDnd5eMonsterControlState(
      {
        schemaVersion: 1,
        mode: 'automatic',
        pauseRequested: true,
        controlledTokenId: ' goblin-1 ',
        requestedAt: 20,
        updatedAt: 20,
      },
      'automatic',
      40,
    ).controlledTokenId).toBe('goblin-1')
  })
})
