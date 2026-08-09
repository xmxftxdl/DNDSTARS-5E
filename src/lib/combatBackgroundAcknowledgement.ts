import type {
  Mode,
  SharedDiceState,
  SharedPlayerActionAckState,
} from './sharedCombatTypes'

export const COMBAT_PLAYBACK_EVENT_MAX_AGE_MS = 60_000

export function shouldSilentlyConsumeDiceEvent(input: {
  event?: SharedDiceState | null
  mode: Mode
  now: number
  seenIds: ReadonlySet<string>
}): boolean {
  const event = input.event
  if (!event || !event.id || input.seenIds.has(event.id)) return false
  if (event.sourceMode === input.mode) return false
  if (event.visibility === 'dm' && input.mode !== 'dm') return false
  if (input.now - event.updatedAt > COMBAT_PLAYBACK_EVENT_MAX_AGE_MS) return false
  return true
}

export function shouldConsumeBackgroundPlayerActionAck(input: {
  ack?: SharedPlayerActionAckState | null
  roomMemberId: string
  seenIds: ReadonlySet<string>
}): boolean {
  const ack = input.ack
  if (!ack?.id || input.seenIds.has(ack.id)) return false
  return !ack.recipientMemberId || ack.recipientMemberId === input.roomMemberId
}
