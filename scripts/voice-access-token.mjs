import { AccessToken, TrackSource } from 'livekit-server-sdk'

const DEFAULT_VOICE_TOKEN_TTL_SECONDS = 10 * 60

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function liveKitVoiceConfiguration(env = process.env) {
  const serverUrl = clean(env.STARS_LIVEKIT_URL)
  const apiKey = clean(env.STARS_LIVEKIT_API_KEY)
  const apiSecret = clean(env.STARS_LIVEKIT_API_SECRET)
  const configured = !!serverUrl && !!apiKey && !!apiSecret
  const validUrl = /^wss?:\/\//i.test(serverUrl)
  return {
    enabled: configured && validUrl,
    provider: 'livekit',
    serverUrl: configured && validUrl ? serverUrl : '',
    apiKey,
    apiSecret,
  }
}

export function publicVoiceStatus(env = process.env) {
  const config = liveKitVoiceConfiguration(env)
  return {
    schemaVersion: 1,
    enabled: config.enabled,
    provider: 'livekit',
  }
}

export async function issueLiveKitVoiceAccess(input, env = process.env) {
  const config = liveKitVoiceConfiguration(env)
  if (!config.enabled) return publicVoiceStatus(env)

  const role = input?.role === 'dm' || input?.role === 'spectator' ? input.role : 'player'
  const roomId = clean(input?.roomId).toUpperCase()
  const memberId = clean(input?.memberId)
  const displayName = clean(input?.displayName).slice(0, 80) || (role === 'dm' ? 'DM' : '玩家')
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(roomId) || !memberId || memberId.length > 180) {
    throw new TypeError('invalid-voice-participant')
  }

  const canPublish = role !== 'spectator'
  const issuedAt = Date.now()
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: `room-${roomId}:${memberId}`,
    name: displayName,
    ttl: DEFAULT_VOICE_TOKEN_TTL_SECONDS,
    metadata: JSON.stringify({
      schemaVersion: 1,
      roomId,
      memberId,
      role,
      ...(clean(input?.accountId) ? { accountId: clean(input.accountId) } : {}),
    }),
  })
  token.addGrant({
    room: `astraltrace-${roomId}`,
    roomJoin: true,
    canSubscribe: true,
    canPublish,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    ...(canPublish ? { canPublishSources: [TrackSource.MICROPHONE] } : {}),
  })

  return {
    schemaVersion: 1,
    enabled: true,
    provider: 'livekit',
    serverUrl: config.serverUrl,
    token: await token.toJwt(),
    expiresAt: issuedAt + DEFAULT_VOICE_TOKEN_TTL_SECONDS * 1000,
    role,
    canPublish,
  }
}
