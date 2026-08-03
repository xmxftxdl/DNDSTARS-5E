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
  private readonly latestQueued = new Map<string, {
    command: Command
    commandIds: Set<string>
    started: boolean
    result: Promise<Result>
    aggregateIds: string[]
    tail?: Promise<void>
  }>()
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

    return this.enqueue(command, () => command, new Set([command.id]))
  }

  /**
   * Keeps one queued command for a rapidly changing value. Once a command has
   * started it is never replaced, but all newer commands sharing `latestKey`
   * collapse into one trailing queue position. Commands submitted afterwards
   * still wait for that position, preserving aggregate ordering.
   */
  dispatchLatest(command: Command, latestKey: string): Promise<Result> {
    const replay = this.completed.get(command.id)
    if (replay) return replay

    const queued = this.latestQueued.get(latestKey)
    const queuedStillLast = queued && queued.tail && queued.aggregateIds.every(
      (aggregateId) => this.queues.get(aggregateId) === queued.tail,
    )
    if (queued && !queued.started && queuedStillLast) {
      queued.command = command
      queued.commandIds.add(command.id)
      this.completed.set(command.id, queued.result)
      return queued.result
    }

    const slot = {
      command,
      commandIds: new Set([command.id]),
      started: false,
      result: undefined as unknown as Promise<Result>,
      aggregateIds: [] as string[],
      tail: undefined as Promise<void> | undefined,
    }
    slot.result = this.enqueue(command, () => {
      slot.started = true
      if (this.latestQueued.get(latestKey) === slot) this.latestQueued.delete(latestKey)
      return slot.command
    }, slot.commandIds, (tail, aggregateIds) => {
      slot.tail = tail
      slot.aggregateIds = aggregateIds
    })
    if (!slot.started) this.latestQueued.set(latestKey, slot)
    return slot.result
  }

  private enqueue(
    initialCommand: Command,
    resolveCommand: () => Command,
    commandIds: Set<string>,
    onQueued?: (tail: Promise<void>, aggregateIds: string[]) => void,
  ): Promise<Result> {

    const aggregateIds = [...new Set([
      initialCommand.aggregateId,
      ...(initialCommand.relatedAggregateIds ?? []),
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
    this.completed.set(initialCommand.id, result)

    const execute = async () => {
      const command = resolveCommand()
      try {
        resolveResult(await this.handler(command))
      } catch (error) {
        for (const commandId of commandIds) this.completed.delete(commandId)
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
    onQueued?.(tail, aggregateIds)
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
