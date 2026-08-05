export interface InitiativeAdvanceInput<TEntry> {
  order: readonly TEntry[]
  index: number
  round: number
  reorderForRound: (order: readonly TEntry[], round: number) => TEntry[]
}

export type InitiativeAdvanceResult<TEntry> =
  | { kind: 'empty' }
  | { kind: 'repair-index'; index: 0 }
  | {
      kind: 'advanced'
      previousRound: number
      round: number
      wrapped: boolean
      index: number
      order: TEntry[]
      entry: TEntry
    }

/** Pure initiative transition. Authority publication and UI projection happen outside. */
export function advanceInitiative<TEntry>(
  input: InitiativeAdvanceInput<TEntry>,
): InitiativeAdvanceResult<TEntry> {
  if (input.order.length === 0) return { kind: 'empty' }
  const current = input.order[input.index] ?? input.order[0]
  if (!current) return { kind: 'repair-index', index: 0 }

  const wrapped = input.index + 1 >= input.order.length
  const round = wrapped ? input.round + 1 : input.round
  const order = wrapped
    ? input.reorderForRound(input.order, round)
    : [...input.order]
  const index = wrapped ? 0 : input.index + 1
  const entry = order[index]
  if (!entry) return { kind: 'repair-index', index: 0 }
  return {
    kind: 'advanced',
    previousRound: input.round,
    round,
    wrapped,
    index,
    order,
    entry,
  }
}
