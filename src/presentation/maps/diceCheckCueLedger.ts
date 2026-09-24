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
    const signature = outcome.rollId ? JSON.stringify([outcome.kind, outcome.rollId]) : undefined
    const correctedPreview = outcome.provisional && signature && signature in state.previews &&
      state.previews[signature] !== outcome.success
    if (state.seen.includes(identity) && !correctedPreview) return false
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

/** Corrections to one roll replace its pending/visible cue instead of trailing it. */
export function enqueueDiceCheckCue(queue: DiceCheckOutcome[], outcome: DiceCheckOutcome): DiceCheckOutcome[] {
  const index = queue.findIndex(item => outcome.rollId
    ? item.rollId === outcome.rollId && item.kind === outcome.kind
    : item.id === outcome.id)
  if (index < 0) return [...queue, outcome]
  return queue.map((item, candidate) => candidate === index ? outcome : item)
}
