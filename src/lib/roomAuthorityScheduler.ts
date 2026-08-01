/**
 * One browser-side authority lane for mutations that can touch combat state.
 * Server CAS remains the final authority; this scheduler prevents the DM UI's
 * HP/token commands, player action settlement, and monster attacks from
 * rebasing local snapshots over one another before they reach that boundary.
 */
export class RoomAuthorityScheduler {
  private tail: Promise<void> = Promise.resolve()
  private inFlight = new Map<string, Promise<unknown>>()

  run<T>(transactionId: string, task: () => Promise<T>): Promise<T> {
    const replay = this.inFlight.get(transactionId)
    if (replay) return replay as Promise<T>
    const result = this.tail.then(task)
    this.inFlight.set(transactionId, result)
    this.tail = result.then(() => undefined, () => undefined)
    void result.finally(() => {
      if (this.inFlight.get(transactionId) === result) this.inFlight.delete(transactionId)
    }).catch(() => undefined)
    return result
  }
}

export const appRoomAuthorityScheduler = new RoomAuthorityScheduler()
