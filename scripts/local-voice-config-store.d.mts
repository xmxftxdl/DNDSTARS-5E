export interface LocalVoicePersistentConfigInput {
  serverUrl: string
  apiKey: string
  apiSecret: string
}

export interface LocalVoicePersistentConfig extends LocalVoicePersistentConfigInput {
  schemaVersion: 1
  secretStorage: string
  savedAt: number
}

export interface LocalVoiceConfigFiles {
  directory: string
  config: string
  secret: string
  key: string
}

export function defaultLocalVoiceConfigDirectory(options?: {
  platform?: NodeJS.Platform
  env?: Record<string, string | undefined>
  home?: string
}): string

export function saveLocalVoiceConfig(
  input: LocalVoicePersistentConfigInput,
  options?: { directory?: string; platform?: NodeJS.Platform },
): Promise<{ config: LocalVoicePersistentConfig; files: LocalVoiceConfigFiles }>

export function loadLocalVoiceConfig(options?: {
  directory?: string
  platform?: NodeJS.Platform
}): Promise<{
  found: boolean
  config: LocalVoicePersistentConfig | null
  files: LocalVoiceConfigFiles
}>

export function applyLocalVoiceConfigToEnvironment(
  config: LocalVoicePersistentConfig | null,
  env?: Record<string, string | undefined>,
): Record<string, string | undefined>
