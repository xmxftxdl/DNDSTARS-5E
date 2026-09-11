import type { DiceCheckOutcome } from './diceCheckOutcome'

interface CueLedger {
  seen: string[]
  previews: Record<string, boolean>
}
const key = 'astraltrace:dice-check-cues:v2'

/** Keep preview/final deduplication across page reloads, including suppressed finals. */
export function createDiceCheckCueLedger(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  let state: CueLedger = { seen: [], previews: {} }
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? 'null')
    if (saved && Array.isArray(saved.seen) && saved.previews && typeof saved.previews === 'object') {
      state = saved
    }
  } catch { /* Fall back to an in-memory ledger. */ }
  return (outcome: DiceCheckOutcome): boolean => {
    const identity = outcome.rollId && outcome.values
      ? JSON.stringify([outcome.rollId, outcome.kind, outcome.mode, outcome.values, outcome.success])
      : outcome.id
    if (state.seen.includes(identity) || state.seen.includes(outcome.id)) return false
    const signature = outcome.rollId ? JSON.stringify([outcome.kind, outcome.rollId]) : undefined
    let show = true
    if (outcome.provisional && signature) state.previews[signature] = outcome.success
    else if (signature && signature in state.previews) {
      show = state.previews[signature] !== outcome.success
      delete state.previews[signature]
    }
    state.seen = [...state.seen, identity, outcome.id].slice(-600)
    state.previews = Object.fromEntries(Object.entries(state.previews).slice(-100))
    try { storage?.setItem(key, JSON.stringify(state)) } catch { /* Retain memory fallback. */ }
    return show
  }
}
