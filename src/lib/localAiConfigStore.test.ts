import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  loadLocalAiBridgeConfig,
  localAiBridgeOptionsFromConfig,
  saveLocalAiBridgeConfig,
} from '../../scripts/local-ai-config-store.mjs'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('Local AI 持久化配置', () => {
  it('不把 API Key 写进公开配置，并能恢复统一模型路由', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-ai-config-'))
    directories.push(directory)
    const saved = await saveLocalAiBridgeConfig({
      apiUrl: 'https://model.example/v1',
      apiKey: 'text-secret-value',
      imageApiUrl: 'https://image.example/v1',
      imageApiKey: 'image-secret-value',
      allowedOrigins: ['http://127.0.0.1:5273'],
    }, { directory, platform: 'linux' })
    const publicText = await readFile(saved.files.config, 'utf8')
    expect(publicText).not.toContain('text-secret-value')
    expect(publicText).not.toContain('image-secret-value')

    const loaded = await loadLocalAiBridgeConfig({ directory, platform: 'linux' })
    expect(loaded.config?.apiKey).toBe('text-secret-value')
    const options = localAiBridgeOptionsFromConfig(loaded.config, {})
    expect(options).toMatchObject({
      externalModelId: 'gpt-5.6-luna',
      externalExtractionModelId: 'gpt-5.6-luna',
      externalSynthesisModelId: 'gpt-5.6-sol',
      externalImageModelId: 'gpt-image-2',
      externalImageDefaultQuality: 'low',
    })
  })
})
