import type { SharedRollRequestPreview } from './useDicePresentation'

/** Keep broadcasts in arrival order so a DM correction cannot be replaced by the next roll. */
export function enqueueDicePreview(queue: SharedRollRequestPreview[], incoming: SharedRollRequestPreview | null): SharedRollRequestPreview[] {
  if (!incoming) return []
  if (queue.some(item => item.id === incoming.id)) return queue
  return [...queue, incoming]
}
export function finishDicePreview(queue: SharedRollRequestPreview[], id: string): SharedRollRequestPreview[] {
  return queue[0]?.id === id ? queue.slice(1) : queue
}
