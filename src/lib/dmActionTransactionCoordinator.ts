export class DmActionTransactionCoordinator {
  private queue: Promise<void> = Promise.resolve()
  private inFlight = new Map<string, Promise<void>>()

  enqueue(run: () => Promise<void>, recover: (error: unknown) => Promise<void>): Promise<void> {
    const task = this.queue.then(async () => {
      try {
        await run()
      } catch (error) {
        await recover(error)
        throw error
      }
    })
    this.queue = task.catch(() => undefined)
    return task
  }

  /** 同一共享动作 ID 在当前 DM 权威进程中只能进入一次结算链。 */
  enqueueTransaction(
    transactionId: string,
    run: () => Promise<void>,
    recover: (error: unknown) => Promise<void>,
  ): Promise<void> {
    const existing = this.inFlight.get(transactionId)
    if (existing) return existing
    const task = this.enqueue(run, recover)
    this.inFlight.set(transactionId, task)
    void task.finally(() => {
      if (this.inFlight.get(transactionId) === task) this.inFlight.delete(transactionId)
    }).catch(() => undefined)
    return task
  }

  isLocked(transactionId: string): boolean {
    return this.inFlight.has(transactionId)
  }
}
