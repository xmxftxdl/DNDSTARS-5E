export interface RoomCommandEnvelope {
  id: string
  type: string
  aggregateId: string
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

    const previous = this.queues.get(command.aggregateId)
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
    const queued = previous
      ? previous.catch(() => undefined).then(execute)
      : execute()
    const tail = Promise.resolve(queued).then(() => undefined, () => undefined)
    this.queues.set(command.aggregateId, tail)
    void tail.finally(() => {
      if (this.queues.get(command.aggregateId) === tail) {
        this.queues.delete(command.aggregateId)
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
