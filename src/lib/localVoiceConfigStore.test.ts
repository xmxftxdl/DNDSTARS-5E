import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyLocalVoiceConfigToEnvironment,
  loadLocalVoiceConfig,
  saveLocalVoiceConfig,
} from '../../scripts/local-voice-config-store.mjs'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-voice-config-'))
  directories.push(directory)
  return directory
}

describe('本地语音持久化配置', () => {
  it('加密保存 LiveKit 凭据并可完整恢复', async () => {
    const directory = await temporaryDirectory()
    const saved = await saveLocalVoiceConfig({
      serverUrl: 'wss://voice.example.test',
      apiKey: 'voice-key-value',
      apiSecret: 'voice-secret-value',
    }, { directory, platform: 'linux' })

    const publicText = await readFile(saved.files.config, 'utf8')
    const protectedText = await readFile(saved.files.secret, 'utf8')
    expect(publicText).not.toContain('voice-key-value')
    expect(publicText).not.toContain('voice-secret-value')
    expect(protectedText).not.toContain('voice-key-value')
    expect(protectedText).not.toContain('voice-secret-value')

    const loaded = await loadLocalVoiceConfig({ directory, platform: 'linux' })
    expect(loaded.config).toMatchObject({
      serverUrl: 'wss://voice.example.test',
      apiKey: 'voice-key-value',
      apiSecret: 'voice-secret-value',
    })
  })

  it('保留显式环境变量，并只补齐空缺值', async () => {
    const environment = {
      STARS_LIVEKIT_URL: 'wss://environment.example.test',
      STARS_LIVEKIT_API_KEY: '',
      STARS_LIVEKIT_API_SECRET: undefined,
    }
    applyLocalVoiceConfigToEnvironment({
      schemaVersion: 1,
      serverUrl: 'wss://saved.example.test',
      apiKey: 'saved-key',
      apiSecret: 'saved-secret',
      secretStorage: 'test',
      savedAt: 1,
    }, environment)
    expect(environment).toEqual({
      STARS_LIVEKIT_URL: 'wss://environment.example.test',
      STARS_LIVEKIT_API_KEY: 'saved-key',
      STARS_LIVEKIT_API_SECRET: 'saved-secret',
    })
  })

  it('远程地址强制使用 wss，但允许本机 ws 开发服务', async () => {
    const remoteDirectory = await temporaryDirectory()
    await expect(saveLocalVoiceConfig({
      serverUrl: 'ws://voice.example.test',
      apiKey: 'key',
      apiSecret: 'secret',
    }, { directory: remoteDirectory, platform: 'linux' })).rejects.toThrow('local-voice-url-must-use-wss')

    const localDirectory = await temporaryDirectory()
    const saved = await saveLocalVoiceConfig({
      serverUrl: 'ws://127.0.0.1:7880',
      apiKey: 'key',
      apiSecret: 'secret',
    }, { directory: localDirectory, platform: 'linux' })
    expect(saved.config.serverUrl).toBe('ws://127.0.0.1:7880')
  })
})
