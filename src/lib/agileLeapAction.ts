import type {
  HeadlessAgileLeapReadyAction,
  HeadlessCombatResult,
} from './headlessDmCombatEngine'

export function buildAgileLeapReadyAction(input: {
  actorTokenId: string
  characterId: string
  feet: number
}): HeadlessAgileLeapReadyAction {
  return {
    type: 'agile-leap-ready',
    actorTokenId: input.actorTokenId,
    characterId: input.characterId,
    feet: input.feet,
  }
}

export type AgileLeapReadySettlementPlan =
  | {
      status: 'rejected'
      reason: string
    }
  | {
      status: 'accepted'
      logs: Array<{ text: string; kind: 'turn' }>
    }

export function planAgileLeapReadySettlement(result: HeadlessCombatResult): AgileLeapReadySettlementPlan {
  if (!result.ok) {
    return {
      status: 'rejected',
      reason: result.reason,
    }
  }

  return {
    status: 'accepted',
    logs: result.events
      .filter((event): event is Extract<typeof event, { type: 'log' }> => event.type === 'log')
      .map((event) => ({ text: event.text, kind: 'turn' })),
  }
}
