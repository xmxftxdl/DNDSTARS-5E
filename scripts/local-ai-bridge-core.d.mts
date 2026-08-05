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
  allowedOrigins?: readonly string[]
  pairingCode?: string
  accessToken?: string
}

export interface LocalAiBridgeController {
  host: string
  port: number
  url: string
  getPairingCode(): string
  close(): Promise<void>
}

export function startLocalAiBridge(options?: LocalAiBridgeStartOptions): Promise<LocalAiBridgeController>
