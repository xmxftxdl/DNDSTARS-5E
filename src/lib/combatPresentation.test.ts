import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publishSharedEvent, sampleSharedServerClock } from './sharedApi'
import {
  COMBAT_PRESENTATION_CHANNEL,
  COMBAT_PRESENTATION_EVENT_TTL_MS,
  EMPTY_COMBAT_PRESENTATION_STATE,
  FIRE_BOLT_ANIMATION_DURATION_MS,
  combatPresentationProjectilesForMap,
  parseCombatPresentationEvent,
  publishFireBoltPresentation,
  reduceCombatPresentationState,
  refreshCombatPresentationClock,
} from './combatPresentation'

vi.mock('./sharedApi', () => ({
  publishSharedEvent: vi.fn(async () => undefined),
  sampleSharedServerClock: vi.fn(async () => ({ offsetMs: 500, roundTripMs: 4, sampledAt: Date.now() })),
}))

const fireBolt = {
  schemaVersion: 1 as const,
  id: 'fire-bolt-transaction-1',
  type: 'spell-projectile' as const,
  mapId: 'map-a',
  transactionId: 'transaction-1',
  spellId: 'fire-bolt' as const,
  sourceTokenId: 'wizard',
  targetTokenId: 'goblin',
  outcome: 'hit' as const,
  createdAt: 1_000,
  expiresAt: 2_500,
}

const map = {
  id: 'map-a',
  gridSize: 50,
  tokens: [
    { id: 'wizard', x: 50, y: 100, size: 1 },
    { id: 'goblin', x: 250, y: 100, size: 1 },
  ],
}

describe('combat presentation events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses bounded Fire Bolt events and rejects unsupported spell effects', () => {
    expect(parseCombatPresentationEvent(fireBolt)).toEqual(fireBolt)
    expect(parseCombatPresentationEvent({ ...fireBolt, spellId: 'ray-of-frost' })).toBeNull()
    expect(parseCombatPresentationEvent({ ...fireBolt, expiresAt: fireBolt.createdAt + 6_000 })).toBeNull()
  })

  it('deduplicates dual-endpoint delivery and expires transient events', () => {
    const once = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, fireBolt, 1_100)
    expect(reduceCombatPresentationState(once, { ...fireBolt }, 1_100)).toBe(once)
    expect(reduceCombatPresentationState(once, null, 2_501).spellProjectiles).toEqual([])
  })

  it('builds a direct hit and a deterministic miss beside the target', () => {
    const hitState = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, fireBolt, 1_100)
    const [hit] = combatPresentationProjectilesForMap(hitState, map, 1_100)
    expect(hit).toMatchObject({ kind: 'fire-bolt', hit: true, to: { x: 250, y: 100 } })
    expect(hit.from.x).toBeGreaterThan(50)
    expect(hit.durationMs).toBe(FIRE_BOLT_ANIMATION_DURATION_MS)

    const missState = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, {
      ...fireBolt, id: 'fire-bolt-transaction-2', outcome: 'miss',
    }, 1_100)
    const [miss] = combatPresentationProjectilesForMap(missState, map, 1_100)
    expect(miss.hit).toBe(false)
    expect(miss.to).not.toEqual({ x: 250, y: 100 })
  })

  it('does not reveal a projectile endpoint when either projected token is absent', () => {
    const state = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, fireBolt, 1_100)
    expect(combatPresentationProjectilesForMap(state, {
      ...map,
      tokens: map.tokens.filter((token) => token.id !== 'goblin'),
    }, 1_100)).toEqual([])
  })

  it('publishes a complete server-clock event that the receiving parser accepts', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    await refreshCombatPresentationClock(true)
    await publishFireBoltPresentation({
      id: 'fire-bolt-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-live-1',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
      outcome: 'hit',
    })
    expect(sampleSharedServerClock).toHaveBeenCalled()
    expect(publishSharedEvent).toHaveBeenCalledWith(COMBAT_PRESENTATION_CHANNEL, expect.objectContaining({
      createdAt: 10_500,
      expiresAt: 10_500 + COMBAT_PRESENTATION_EVENT_TTL_MS,
    }))
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    vi.useRealTimers()
  })
})
