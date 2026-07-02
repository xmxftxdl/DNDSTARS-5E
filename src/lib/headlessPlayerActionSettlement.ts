import type { SharedPlayerActionState } from './sharedCombatTypes'
import type { HeadlessCombatEvent, HeadlessCombatResult } from './headlessDmCombatEngine'

export interface HeadlessSettlementLog {
  text: string
  kind: 'turn'
  round?: number
}

export interface HeadlessPlayerActionSettlementPlan {
  status: 'accepted' | 'rejected'
  shouldComplete: true
  ackReason?: string
  acceptedPosition?: { x: number; y: number }
  acceptedReason?: string
  logs: HeadlessSettlementLog[]
}

export function planHeadlessPlayerActionSettlement(input: {
  action: SharedPlayerActionState
  result: HeadlessCombatResult
  acceptedPosition?: { x: number; y: number }
  acceptedReason?: string
  previousRound?: number
  rejectReason?: (reason: string) => string
}): HeadlessPlayerActionSettlementPlan {
  if (!input.result.ok) {
    return {
      status: 'rejected',
      shouldComplete: true,
      ackReason: input.rejectReason?.(input.result.reason) ?? input.result.reason,
      logs: [],
    }
  }

  return {
    status: 'accepted',
    shouldComplete: true,
    acceptedPosition: input.acceptedPosition,
    acceptedReason: input.acceptedReason,
    logs: headlessResultLogs(input.result.events, input.previousRound),
  }
}

export function headlessResultLogs(
  events: HeadlessCombatEvent[],
  previousRound?: number,
): HeadlessSettlementLog[] {
  const logs: HeadlessSettlementLog[] = []
  for (const event of events) {
    if (event.type === 'log') logs.push({ text: event.text, kind: 'turn' })
    if (previousRound != null && event.type === 'turn-advanced' && event.round > previousRound) {
      logs.push({ text: `进入第 ${event.round} 回合`, kind: 'turn', round: event.round })
    }
  }
  return logs
}

export function tokenMovedEvent(
  events: HeadlessCombatEvent[],
  tokenId: string,
): Extract<HeadlessCombatEvent, { type: 'token-moved' }> | undefined {
  return events.find(
    (event): event is Extract<HeadlessCombatEvent, { type: 'token-moved' }> =>
      event.type === 'token-moved' && event.tokenId === tokenId,
  )
}
