export class DmActionTransactionCoordinator {
  private queue: Promise<void> = Promise.resolve()

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
}
