import {
  NOOP_COMMAND_TELEMETRY,
  type CommandTelemetryIdentity,
  type CommandTelemetryPort,
} from '../../ports/commandTelemetry'

export interface RoomCommandEnvelope {
  id: string
  type: string
  aggregateId: string
  relatedAggregateIds?: readonly string[]
  issuedAt: number
}

export type RoomCommandHandler<Command extends RoomCommandEnvelope, Result> =
  (command: Command) => Result | Promise<Result>

export interface RoomCommandBusOptions {
  retainedCommandCount?: number
  telemetry?: CommandTelemetryPort
  now?: () => number
}

/**
 * Application service that serializes writes sharing an authoritative aggregate,
 * deduplicates transaction IDs and reports queue/execution latency through a Port.
 */
export class RoomCommandBus<Command extends RoomCommandEnvelope, Result> {
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
  private readonly telemetry: CommandTelemetryPort
  private readonly now: () => number

  constructor(
    handler: RoomCommandHandler<Command, Result>,
    retainedCommandCountOrOptions: number | RoomCommandBusOptions = 500,
  ) {
    this.handler = handler
    const options = typeof retainedCommandCountOrOptions === 'number'
      ? { retainedCommandCount: retainedCommandCountOrOptions }
      : retainedCommandCountOrOptions
    this.retainedCommandCount = options.retainedCommandCount ?? 500
    this.telemetry = options.telemetry ?? NOOP_COMMAND_TELEMETRY
    this.now = options.now ?? (() => globalThis.performance?.now() ?? Date.now())
  }

  dispatch(command: Command): Promise<Result> {
    const replay = this.completed.get(command.id)
    if (replay) return replay
    return this.enqueue(command, () => command, new Set([command.id]))
  }

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
    const queuedAt = this.now()

    let resolveResult!: (result: Result | PromiseLike<Result>) => void
    let rejectResult!: (reason?: unknown) => void
    const result = new Promise<Result>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })
    this.completed.set(initialCommand.id, result)

    const execute = async () => {
      const command = resolveCommand()
      this.telemetry.queued(this.telemetryIdentity(command, aggregateIds, { queuedAt }))
      const startedAt = this.now()
      const identity = this.telemetryIdentity(command, aggregateIds, {
        queuedAt,
        startedAt,
        queueDurationMs: Math.max(0, startedAt - queuedAt),
      })
      this.telemetry.started(identity)
      try {
        const value = await this.handler(command)
        const finishedAt = this.now()
        this.telemetry.finished({
          ...identity,
          finishedAt,
          executionDurationMs: Math.max(0, finishedAt - startedAt),
          totalDurationMs: Math.max(0, finishedAt - queuedAt),
          outcome: 'success',
        })
        resolveResult(value)
      } catch (error) {
        for (const commandId of commandIds) this.completed.delete(commandId)
        const finishedAt = this.now()
        this.telemetry.finished({
          ...identity,
          finishedAt,
          executionDurationMs: Math.max(0, finishedAt - startedAt),
          totalDurationMs: Math.max(0, finishedAt - queuedAt),
          outcome: 'failure',
        })
        rejectResult(error)
      }
    }
    const queued = previous.length > 0
      ? Promise.all(previous.map((pending) => pending.catch(() => undefined))).then(execute)
      : execute()
    const tail = Promise.resolve(queued).then(() => undefined, () => undefined)
    for (const aggregateId of aggregateIds) this.queues.set(aggregateId, tail)
    onQueued?.(tail, aggregateIds)
    void tail.finally(() => {
      for (const aggregateId of aggregateIds) {
        if (this.queues.get(aggregateId) === tail) this.queues.delete(aggregateId)
      }
      this.trimCompleted()
    })
    return result
  }

  private telemetryIdentity<T extends object>(
    command: Command,
    aggregateIds: readonly string[],
    timing: T,
  ): CommandTelemetryIdentity & T {
    return {
      commandId: command.id,
      commandType: command.type,
      aggregateIds,
      ...timing,
    }
  }

  private trimCompleted(): void {
    while (this.completed.size > this.retainedCommandCount) {
      const oldest = this.completed.keys().next().value as string | undefined
      if (!oldest) return
      this.completed.delete(oldest)
    }
  }
}
