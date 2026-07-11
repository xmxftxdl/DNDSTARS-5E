import type {
  HeadlessCombatResult,
  HeadlessDmCombatState,
  HeadlessEndTurnAction,
} from './headlessDmCombatEngine'
import { resolveHeadlessDmAuthorityAction } from './headlessDmAuthority'

export function clearCharacterScopedRecord<T>(
  record: Record<string, T>,
  characterId: string,
): Record<string, T> {
  const prefix = `${characterId}:`
  let changed = false
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith(prefix)) {
      changed = true
      continue
    }
    next[key] = value
  }
  return changed ? next : record
}

export function removeDisengagedCharacterId(prev: Set<string>, characterId: string): Set<string> {
  if (!prev.has(characterId)) return prev
  const next = new Set(prev)
  next.delete(characterId)
  return next
}

export function buildHeadlessEndTurnAction(input: {
  actorTokenId: string
  characterId?: string
}): HeadlessEndTurnAction {
  return {
    type: 'end-turn',
    actorTokenId: input.actorTokenId,
    characterId: input.characterId,
  }
}

export function resolveHeadlessEndTurnAuthority(input: {
  state: HeadlessDmCombatState
  actorTokenId: string
  characterId?: string
}): HeadlessCombatResult {
  return resolveHeadlessDmAuthorityAction(input.state, buildHeadlessEndTurnAction(input))
}

export type HeadlessEndTurnSettlementPlan =
  | {
      status: 'rejected'
      log: { text: string; kind: 'system' }
    }
  | {
      status: 'accepted'
      logs: Array<{ text: string; kind: 'turn'; round?: number }>
      shouldResetInitiativeScroll: boolean
    }

export function planHeadlessEndTurnSettlement(input: {
  result: HeadlessCombatResult
  previousRound: number
}): HeadlessEndTurnSettlementPlan {
  if (!input.result.ok) {
    return {
      status: 'rejected',
      log: {
        text: `回合推进失败：${input.result.reason}`,
        kind: 'system',
      },
    }
  }

  const logs: Array<{ text: string; kind: 'turn'; round?: number }> = []
  let shouldResetInitiativeScroll = false
  for (const event of input.result.events) {
    if (event.type === 'log') logs.push({ text: event.text, kind: 'turn' })
    if (event.type === 'turn-advanced' && event.round > input.previousRound) {
      logs.push({ text: `进入第 ${event.round} 回合`, kind: 'turn', round: event.round })
      shouldResetInitiativeScroll = true
    }
  }

  return {
    status: 'accepted',
    logs,
    shouldResetInitiativeScroll,
  }
}
