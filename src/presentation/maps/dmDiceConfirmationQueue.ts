import type { DiceCheckPresentation } from './diceCheckPresentation'
export interface DmDiceConfirmation {
  check?: DiceCheckPresentation
  id: string
  label: string
  targetName: string
  sides: number
  values: number[]
  visibility: 'public' | 'dm-only'
}

/** Confirmation has no timer: only the DM's submitted faces release the next group. */
export function createDmDiceConfirmationQueue(
  present: (request: DmDiceConfirmation) => Promise<number[]>,
) {
  let tail: Promise<unknown> = Promise.resolve()
  const cancellations = new Set<(error: Error) => void>()
  const enqueue = (request: DmDiceConfirmation): Promise<number[]> => {
    let cancel!: (error: Error) => void
    let cancelled = false
    const cancellation = new Promise<never>((_resolve, reject) => {
      cancel = error => { cancelled = true; reject(error) }
    })
    cancellations.add(cancel)
    const result = tail.then(async () => {
      if (cancelled) throw new Error('combat-dice-cancelled')
      const values = await Promise.race([present(request), cancellation])
      if (values.length !== request.values.length || values.some(value =>
        !Number.isInteger(value) || value < 1 || value > request.sides)) {
        throw new Error('骰子确认结果无效')
      }
      return values
    })
    const cancellable = Promise.race([result, cancellation]).finally(() => cancellations.delete(cancel))
    tail = cancellable.catch(() => undefined)
    return cancellable
  }
  return Object.assign(enqueue, {
    cancelAll: () => {
      for (const cancel of cancellations) cancel(new Error('combat-dice-cancelled'))
      cancellations.clear()
    },
  })
}
