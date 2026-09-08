import type { LocalAiBridgeStartOptions } from './local-ai-bridge-core.mjs'

export const LOCAL_AI_CONFIG_SCHEMA_VERSION: 1

export interface LocalAiPersistentConfigInput {
  apiUrl: string
  apiKey: string
  imageApiUrl?: string
  imageApiKey?: string
  ocrApiUrl?: string
  ocrApiKey?: string
  ocrEngineId?: string
  allowedOrigins?: string[]
}

export interface LocalAiPersistentConfig extends LocalAiPersistentConfigInput {
  schemaVersion: 1
  modelPolicyVersion: number
  models: object
  secretStorage: string
  savedAt: number
}

export interface LocalAiConfigFiles {
  directory: string
  config: string
  secret: string
  key: string
  usage: string
  playerUsage: string
}

export function defaultLocalAiConfigDirectory(options?: {
  platform?: NodeJS.Platform
  env?: Record<string, string | undefined>
  home?: string
}): string

export function saveLocalAiBridgeConfig(
  input: LocalAiPersistentConfigInput,
  options?: { directory?: string; platform?: NodeJS.Platform },
): Promise<{ config: LocalAiPersistentConfig; files: LocalAiConfigFiles }>

export function loadLocalAiBridgeConfig(options?: {
  directory?: string
  platform?: NodeJS.Platform
}): Promise<{
  found: boolean
  config: LocalAiPersistentConfig | null
  files: LocalAiConfigFiles
}>

export function localAiBridgeOptionsFromConfig(
  config: LocalAiPersistentConfig | null,
  env?: Record<string, string | undefined>,
): LocalAiBridgeStartOptions
