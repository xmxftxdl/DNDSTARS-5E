import { expect, it } from 'vitest'
import { mutateCampaignTimeState } from '../../scripts/shared-server-core.mjs'
import { advanceCampaignTimeSnapshot, normalizeSharedCampaignTime, validateSharedCampaignTime } from './campaignTime'

const host = { role: 'dm', memberId: 'host' }
const start = { operation: 'start-interaction', id: 'talk-1', sourceId: 'source', bearerId: 'listener', effectId: 'effect-1', packageId: 'test.social', requiredRounds: 10, expectedWorldMinute: 480 }
const interactionEntities = [{ id: 'source', effects: [] }, { id: 'listener', effects: [{ id: 'effect-1', source: { actorId: 'source', pluginId: 'test.social' }, duration: { type: 'rounds', remainingRounds: 10 }, completionGrant: { activityIds: ['finish'], availableRounds: 10 } }] }]
const run = (state: unknown, mutation: Record<string, unknown>, member: Record<string, unknown> | null | undefined = host) => mutateCampaignTimeState(state, mutation, 10, member, { host, interactionEntities })
const requireState = (result: ReturnType<typeof run>) => {
  if (!result.ok) throw Error(result.error)
  expect(validateSharedCampaignTime(result.next)).toBe(true)
  const state = normalizeSharedCampaignTime(result.next)
  if (!state.interactions) throw Error('Expected interaction records')
  return { ...state, interactions: state.interactions }
}
const success = (state: unknown, mutation: Record<string, unknown>) => requireState(run(state, mutation))


it('authenticates interaction mutations and derives start time/authority on the server', () => {
  for (const member of [undefined, null, {}, { memberId: 'player', role: 'player' }, { memberId: 'spectator', role: 'spectator' }]) {
    // Avoid the helper default for explicit undefined.
    expect(mutateCampaignTimeState(null, start, 10, member, { host })).toMatchObject({ ok: false, error: 'dm-authority-required' })
  }
  const result = run(null, { ...start, startedAtWorldMinute: 0, startedByMemberId: 'forged', status: 'completed' })
  expect(result.ok).toBe(true)
  const state = requireState(result)
  expect(state.interactions).toEqual([expect.objectContaining({ startedAtWorldMinute: 480, startedByMemberId: 'host', status: 'active' })])
  expect(state.worldMinute).toBe(480)
  expect(validateSharedCampaignTime(state)).toBe(true)
  expect(normalizeSharedCampaignTime(JSON.parse(JSON.stringify(state))).interactions).toEqual(state.interactions)
})

it('retains identity through retries and interruption without resuming a terminal record', () => {
  const first = success(null, start)
  expect(success(first, start)).toEqual(first)
  expect(run(first, { ...start, bearerId: 'other' })).toMatchObject({ ok: false, error: 'interaction-id-conflict' })
  expect(run(first, { ...start, id: 'second' })).toMatchObject({ ok: false, error: 'interaction-already-started' })
  expect(run(first, { ...start, id: 'second', effectId: 'second', expectedWorldMinute: 479 })).toMatchObject({ ok: false, error: 'stale-interaction-clock' })
  const interrupt = { operation: 'interrupt-interaction', id: start.id, expectedWorldMinute: 480 }
  const stopped = success(first, interrupt)
  expect(stopped.interactions[0]).toMatchObject({ status: 'interrupted', interruptionReason: 'host-interrupted', interruptedAtWorldMinute: 480 })
  expect(success(stopped, interrupt)).toEqual(stopped)
  expect(success(stopped, start)).toEqual(stopped)
  expect(first.interactions[0].status).toBe('active')
})

it.each(['advance', 'short-rest', 'long-rest', 'set-time'])('interrupts unverified interaction on ordinary %s progression', operation => {
  const first = success(null, start)
  const mutation = operation === 'set-time' ? { operation, displayMode: 'campaign-day', day: 1, hour: 8, minute: 1 } : { operation, minutes: 1 }
  const next = success(first, mutation)
  expect(next.interactions[0]).toMatchObject({ status: 'interrupted', interruptionReason: 'unverified-time-advance', interruptedAtWorldMinute: next.worldMinute })
  expect(validateSharedCampaignTime(next)).toBe(true)
  expect(success(next, start).interactions[0].status).toBe('interrupted')
  if (operation === 'advance') {
    const snapshot = advanceCampaignTimeSnapshot({ state: first, minutes: 1, reason: 'Test', now: 10 })!
    expect(snapshot.interactions).toEqual(next.interactions)
  }
})

it('rejects malformed persisted records instead of silently resetting the campaign clock', () => {
  const first = success(null, start)
  for (const patch of [{ status: 'completed' }, { requiredRounds: 0 }, { sourceId: '' }, { startedAtWorldMinute: 481 }]) {
    const corrupt = { ...first, interactions: [{ ...first.interactions[0], ...patch }] }
    expect(validateSharedCampaignTime(corrupt)).toBe(false)
    expect(run(corrupt, { operation: 'advance', minutes: 1 })).toMatchObject({ ok: false, error: 'invalid-campaign-interactions' })
  }
  for (const requiredRounds of [0, -1, 1.5, 14401]) expect(run(null, { ...start, requiredRounds }).ok).toBe(false)
})


it('rejects missing, substituted and ambiguous server participants/effects rather than trusting request snapshots', () => {
  const mutate = (entities?: unknown) => mutateCampaignTimeState(null, { ...start, interactionEntities }, 10, host, { host, interactionEntities: entities })
  expect(mutate()).toMatchObject({ ok: false, error: 'interaction-snapshot-required' })
  expect(mutate([])).toMatchObject({ ok: false, error: 'interaction-participant-unavailable' })
  expect(mutate([...interactionEntities, interactionEntities[0]])).toMatchObject({ ok: false, error: 'interaction-participant-unavailable' })
  for (const change of ['removed', 'source', 'package', 'rounds', 'suppressed', 'duplicate']) {
    const entities = structuredClone(interactionEntities)
    const effects = entities[1].effects
    if (change === 'removed') entities[1].effects = []
    if (change === 'source') effects[0].source.actorId = 'foreign'
    if (change === 'package') effects[0].source.pluginId = 'foreign'
    if (change === 'rounds') effects[0].duration.remainingRounds = 1
    if (change === 'suppressed') Object.assign(effects[0], { suspendedBy: ['blocker'] })
    if (change === 'duplicate') effects.push(structuredClone(effects[0]))
    expect(mutate(entities).ok, change).toBe(false)
  }
  expect(mutate(interactionEntities).ok).toBe(true)
})
