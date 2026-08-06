import { describe, expect, it } from 'vitest'
import { TokenVerifier } from 'livekit-server-sdk'
import {
  issueLiveKitVoiceAccess,
  liveKitVoiceConfiguration,
  publicVoiceStatus,
} from '../../scripts/voice-access-token.mjs'

const configuredEnvironment = {
  STARS_LIVEKIT_URL: 'wss://voice.example.test',
  STARS_LIVEKIT_API_KEY: 'test-api-key',
  STARS_LIVEKIT_API_SECRET: 'test-api-secret-that-is-long-enough',
}

describe('房间语音令牌', () => {
  it('配置缺失时安全禁用且不暴露密钥', async () => {
    expect(publicVoiceStatus({})).toEqual({ schemaVersion: 1, enabled: false, provider: 'livekit' })
    expect(await issueLiveKitVoiceAccess({
      roomId: 'ABC234',
      memberId: 'member-1',
      displayName: '玩家',
      role: 'player',
    }, {})).toEqual({ schemaVersion: 1, enabled: false, provider: 'livekit' })
    expect(liveKitVoiceConfiguration({ STARS_LIVEKIT_URL: 'https://invalid.example' }).enabled).toBe(false)
  })

  it('玩家令牌只允许发布麦克风并订阅房间', async () => {
    const access = await issueLiveKitVoiceAccess({
      roomId: 'ABC234',
      memberId: 'member-1',
      accountId: 'ACCOUNT23456',
      displayName: '玩家甲',
      role: 'player',
    }, configuredEnvironment)
    expect(access.enabled).toBe(true)
    if (!access.enabled) throw new Error('expected configured LiveKit access')
    expect(access.serverUrl).toBe(configuredEnvironment.STARS_LIVEKIT_URL)
    const grants = await new TokenVerifier(
      configuredEnvironment.STARS_LIVEKIT_API_KEY,
      configuredEnvironment.STARS_LIVEKIT_API_SECRET,
    ).verify(access.token)
    expect(grants.video).toMatchObject({
      room: 'astraltrace-ABC234',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: ['microphone'],
    })
    expect(grants.metadata).toContain('"role":"player"')
  })

  it('观战令牌为只收听权限', async () => {
    const access = await issueLiveKitVoiceAccess({
      roomId: 'ABC234',
      memberId: 'spectator-1',
      displayName: '观战者',
      role: 'spectator',
    }, configuredEnvironment)
    if (!access.enabled) throw new Error('expected configured LiveKit access')
    const grants = await new TokenVerifier(
      configuredEnvironment.STARS_LIVEKIT_API_KEY,
      configuredEnvironment.STARS_LIVEKIT_API_SECRET,
    ).verify(access.token)
    expect(grants.video).toMatchObject({ canPublish: false, canSubscribe: true, canPublishData: false })
    expect(access.canPublish).toBe(false)
  })

  it('拒绝非法房间或成员身份', async () => {
    await expect(issueLiveKitVoiceAccess({
      roomId: '../BAD',
      memberId: 'member-1',
      displayName: '玩家',
      role: 'player',
    }, configuredEnvironment)).rejects.toThrow('invalid-voice-participant')
  })
})
