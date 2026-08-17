export const LOCAL_AI_BRIDGE_SCHEMA_VERSION: 1
export const LOCAL_AI_BRIDGE_DEFAULT_PORT: number
export const LOCAL_AI_BRIDGE_DEFAULT_ORIGINS: readonly string[]

export interface LocalAiBridgeStartOptions {
  host?: '127.0.0.1' | '::1' | 'localhost'
  port?: number
  ollamaUrl?: string
  llamaCppUrl?: string
  externalApiUrl?: string
  externalApiKey?: string
  externalModelId?: string
  externalModelDisplayName?: string
  externalModelContextWindow?: string | number
  externalExtractionApiUrl?: string
  externalExtractionApiKey?: string
  externalExtractionModelId?: string
  externalExtractionModelDisplayName?: string
  externalExtractionModelContextWindow?: string | number
  externalSynthesisApiUrl?: string
  externalSynthesisApiKey?: string
  externalSynthesisModelId?: string
  externalSynthesisModelDisplayName?: string
  externalSynthesisModelContextWindow?: string | number
  externalImageApiUrl?: string
  externalImageApiKey?: string
  externalImageModelId?: string
  externalImageDefaultQuality?: string
  ocrApiUrl?: string
  ocrApiKey?: string
  ocrEngineId?: string
  allowedOrigins?: readonly string[]
  pairingCode?: string
  accessToken?: string
  usageAuditPath?: string
  billingPolicy?: import('../shared/ai-model-policy.mjs').AiCreditPolicyV1
}

export interface LocalAiBridgeController {
  host: string
  port: number
  url: string
  getPairingCode(): string
  close(): Promise<void>
}

export function safeAuditError(error: unknown): string
export function errorWithUsage<T extends Error>(error: T, usage?: unknown): T
export function estimatedStructuredInputTokens(request: Record<string, unknown>): number
export function openAiStrictJsonSchema(schema: unknown): unknown
export function externalModelApiUrl(value: string): URL
export function appendApiPath(baseUrl: string | URL, pathName: string): URL
export function fetchJson(
  url: string | URL,
  init?: RequestInit,
  timeoutMs?: number,
  externalSignal?: AbortSignal | null,
): Promise<unknown>
export function createUsageAuditStore(file?: string, policy?: import('../shared/ai-model-policy.mjs').AiCreditPolicyV1): {
  begin(input: Record<string, unknown>): Promise<Record<string, unknown>>
  settle(reservation: Record<string, unknown>, input: Record<string, unknown>): Promise<Record<string, unknown>>
  recent(limit?: number): Promise<Record<string, unknown>[]>
}
export function generateStructured(input: Record<string, unknown>): Promise<Record<string, unknown>>
export function generateExternalImage(input: Record<string, unknown>): Promise<{
  schemaVersion: 1
  modelId: string
  quality: 'low'
  mimeType: 'image/png'
  dataUrl: string
}>

export function startLocalAiBridge(options?: LocalAiBridgeStartOptions): Promise<LocalAiBridgeController>
