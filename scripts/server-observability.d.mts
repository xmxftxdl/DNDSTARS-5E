export interface ReadinessResult {
  ready: boolean
  details?: unknown
  error?: string
}

export class ServerObservability {
  constructor(options?: {
    service?: string
    buildId?: string
    startedAt?: number
  })
  log(level: string, event: string, fields?: Record<string, unknown>): void
  observeRequest(req: unknown, res: unknown, parsed: URL): string
  checkReadiness(check: () => unknown | Promise<unknown>): Promise<ReadinessResult>
  alert(kind: string, details: Record<string, unknown>): Promise<void>
  metrics(extra?: Record<string, number>): string
  metricsAuthorized(req: { headers: Record<string, unknown> }): boolean
}
