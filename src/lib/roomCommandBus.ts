export interface RoomCommandEnvelope {
  id: string
  type: string
  aggregateId: string
  /**
   * Additional aggregates touched by the same command. The command waits for
   * every listed aggregate and then occupies all of them with one shared tail,
   * so commands that overlap on any entity remain ordered without forcing
   * unrelated room mutations through one global queue.
   */
  relatedAggregateIds?: readonly string[]
  issuedAt: number
}

export type RoomCommandHandler<
  Command extends RoomCommandEnvelope,
  Result,
> = (command: Command) => Result | Promise<Result>

/**
 * Serializes mutations for the same room aggregate and deduplicates replayed
 * command IDs. It deliberately contains no React or Store dependency.
 */
export class RoomCommandBus<
  Command extends RoomCommandEnvelope,
  Result,
> {
  private readonly queues = new Map<string, Promise<void>>()
  private readonly completed = new Map<string, Promise<Result>>()
  private readonly handler: RoomCommandHandler<Command, Result>
  private readonly retainedCommandCount: number

  constructor(
    handler: RoomCommandHandler<Command, Result>,
    retainedCommandCount = 500,
  ) {
    this.handler = handler
    this.retainedCommandCount = retainedCommandCount
  }

  dispatch(command: Command): Promise<Result> {
    const replay = this.completed.get(command.id)
    if (replay) return replay

    const aggregateIds = [...new Set([
      command.aggregateId,
      ...(command.relatedAggregateIds ?? []),
    ])]
    const previous = [...new Set(aggregateIds
      .map((aggregateId) => this.queues.get(aggregateId))
      .filter((queued): queued is Promise<void> => queued !== undefined))]
    let resolveResult!: (result: Result | PromiseLike<Result>) => void
    let rejectResult!: (reason?: unknown) => void
    const result = new Promise<Result>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })
    this.completed.set(command.id, result)

    const execute = async () => {
      try {
        resolveResult(await this.handler(command))
      } catch (error) {
        this.completed.delete(command.id)
        rejectResult(error)
      }
    }
    const queued = previous.length > 0
      ? Promise.all(previous.map((pending) => pending.catch(() => undefined))).then(execute)
      : execute()
    const tail = Promise.resolve(queued).then(() => undefined, () => undefined)
    for (const aggregateId of aggregateIds) {
      this.queues.set(aggregateId, tail)
    }
    void tail.finally(() => {
      for (const aggregateId of aggregateIds) {
        if (this.queues.get(aggregateId) === tail) {
          this.queues.delete(aggregateId)
        }
      }
      this.trimCompleted()
    })
    return result
  }

  private trimCompleted(): void {
    while (this.completed.size > this.retainedCommandCount) {
      const oldest = this.completed.keys().next().value as string | undefined
      if (!oldest) return
      this.completed.delete(oldest)
    }
  }
}
