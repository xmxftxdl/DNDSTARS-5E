export interface VoiceEnvironment {
  STARS_LIVEKIT_URL?: string
  STARS_LIVEKIT_API_KEY?: string
  STARS_LIVEKIT_API_SECRET?: string
}

export interface VoiceAccessInput {
  roomId: string
  memberId: string
  accountId?: string
  displayName?: string
  role?: 'dm' | 'player' | 'spectator'
}

export function liveKitVoiceConfiguration(env?: VoiceEnvironment): {
  enabled: boolean
  provider: 'livekit'
  serverUrl: string
  apiKey: string
  apiSecret: string
}

export function publicVoiceStatus(env?: VoiceEnvironment): {
  schemaVersion: 1
  enabled: boolean
  provider: 'livekit'
}

export function issueLiveKitVoiceAccess(input: VoiceAccessInput, env?: VoiceEnvironment): Promise<
  | { schemaVersion: 1; enabled: false; provider: 'livekit' }
  | {
      schemaVersion: 1
      enabled: true
      provider: 'livekit'
      serverUrl: string
      token: string
      expiresAt: number
      role: 'dm' | 'player' | 'spectator'
      canPublish: boolean
    }
>
