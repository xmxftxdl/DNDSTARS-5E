import type { DiceRoll } from '../components/DiceRollOverlay'
import type { Mode, SharedDiceState } from './sharedCombatTypes'

export type SharedDiceEventApplyDecision =
  | {
      status: 'ignored'
      reason:
        | 'missing-state'
        | 'wrong-map'
        | 'same-source'
        | 'stale'
        | 'rolling'
        | 'seen'
        | 'missing-roll'
        | 'private-roll'
    }
  | {
      status: 'apply'
      id: string
      roll: DiceRoll
    }

export function resolveSharedDiceEventApply(input: {
  state?: SharedDiceState | null
  mapId: string
  mode: Mode
  now: number
  seenIds: ReadonlySet<string>
  maxAgeMs?: number
}): SharedDiceEventApplyDecision {
  const state = input.state
  if (!state) return { status: 'ignored', reason: 'missing-state' }
  if (state.mapId !== input.mapId) return { status: 'ignored', reason: 'wrong-map' }
  if (state.sourceMode === input.mode) return { status: 'ignored', reason: 'same-source' }
  if (state.visibility === 'dm' && input.mode !== 'dm') return { status: 'ignored', reason: 'private-roll' }
  if (input.now - state.updatedAt > (input.maxAgeMs ?? 60000)) {
    return { status: 'ignored', reason: 'stale' }
  }
  if (state.status === 'rolling') return { status: 'ignored', reason: 'rolling' }
  if (input.seenIds.has(state.id)) return { status: 'ignored', reason: 'seen' }
  if (!state.roll) return { status: 'ignored', reason: 'missing-roll' }
  return { status: 'apply', id: state.id, roll: state.roll }
}
