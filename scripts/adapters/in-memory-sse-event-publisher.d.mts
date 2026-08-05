export interface InMemorySseEventPublisherOptions {
  eventClients: Map<string, Set<any>>
  eventBacklog: Map<string, unknown[]>
  storageKey(channel: string): string
  projectPayload(channel: string, payload: any, viewer: any): any
  replaySlice(entries: unknown[]): unknown[]
  pushBacklog(entries: unknown[], payload: unknown): unknown[]
  capChannels(backlog: Map<string, unknown[]>, limit: number, protectedKeys: Set<string>): void
  channelLimit: number
  streamId: string
  currentSequence(): number
  nextSequence(): number
  now?: () => number
  heartbeatMs?: number
  telemetry?: import('../ports/server-telemetry.mjs').ServerTelemetryPort
}

export interface EventPublisherPort {
  subscribe(channel: string, response: any, viewer: any): () => void
  publish(channel: string, payload: any): void
  publishBestEffort(channel: string, payload: any): boolean
}

export function createInMemorySseEventPublisher(
  options: InMemorySseEventPublisherOptions,
): EventPublisherPort
