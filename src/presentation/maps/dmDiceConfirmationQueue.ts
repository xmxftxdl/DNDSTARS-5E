export interface DmDiceConfirmation {
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
  return (request: DmDiceConfirmation): Promise<number[]> => {
    const result = tail.then(async () => {
      const values = await present(request)
      if (values.length !== request.values.length || values.some(value =>
        !Number.isInteger(value) || value < 1 || value > request.sides)) {
        throw new Error('骰子确认结果无效')
      }
      return values
    })
    tail = result.catch(() => undefined)
    return result
  }
}
