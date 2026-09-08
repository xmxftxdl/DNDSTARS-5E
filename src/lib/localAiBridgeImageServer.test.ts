import { createServer, type Server } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { startLocalAiBridge } from '../../scripts/local-ai-bridge-core.mjs'

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
})

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing-address')
  return `http://127.0.0.1:${address.port}/v1`
}

describe('Local AI Bridge 图片生成边界', () => {
  it('只通过配对后的 Bridge 调用配置的图片模型并返回 base64 图片', async () => {
    let upstreamBody: Record<string, unknown> | null = null
    const upstream = createServer(async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      upstreamBody = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ data: [{ b64_json: Buffer.alloc(128, 7).toString('base64') }] }))
    })
    const apiUrl = await listen(upstream)
    const bridge = await startLocalAiBridge({
      port: 0,
      accessToken: 'test-access-token',
      externalImageApiUrl: apiUrl,
      externalImageApiKey: 'secret-key',
      externalImageModelId: 'gpt-image-test',
      allowedOrigins: [],
    })
    try {
      const response = await fetch(`${bridge.url}/api/generate-image`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '一名站在风暴海岸的精灵向导，竖版人物立绘，无文字无水印。', aspect: 'portrait-3:4' }),
      })
      const body = await response.json() as { dataUrl: string; modelId: string; quality: string }

      expect(response.status).toBe(200)
      expect(body.modelId).toBe('gpt-image-test')
      expect(body.quality).toBe('low')
      expect(body.dataUrl).toMatch(/^data:image\/png;base64,/)
      expect(upstreamBody).toMatchObject({ model: 'gpt-image-test', size: '1024x1536', quality: 'low' })
      expect(upstreamBody).not.toHaveProperty('background')
    } finally {
      await bridge.close()
    }
  })

  it('ignores page overrides and always enforces the low-cost image quality', async () => {
    let upstreamBody: Record<string, unknown> | null = null
    const upstream = createServer(async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      upstreamBody = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ data: [{ b64_json: Buffer.alloc(128, 7).toString('base64') }] }))
    })
    const apiUrl = await listen(upstream)
    const bridge = await startLocalAiBridge({
      port: 0,
      accessToken: 'test-access-token',
      externalImageApiUrl: apiUrl,
      externalImageApiKey: 'secret-key',
      externalImageModelId: 'gpt-image-test',
      externalImageDefaultQuality: 'low',
      allowedOrigins: [],
    })
    try {
      const response = await fetch(`${bridge.url}/api/generate-image`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'A sufficiently detailed fantasy portrait prompt for testing explicit quality.',
          aspect: 'portrait-3:4',
          quality: 'medium',
          background: 'transparent',
        }),
      })

      expect(response.status).toBe(200)
      expect(upstreamBody).toMatchObject({ quality: 'low', background: 'transparent' })
    } finally {
      await bridge.close()
    }
  })

  it('未配置图片模型时 fail closed', async () => {
    const bridge = await startLocalAiBridge({ port: 0, accessToken: 'test-access-token', allowedOrigins: [] })
    try {
      const response = await fetch(`${bridge.url}/api/generate-image`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '足够长的测试人物立绘提示词，不应被发送到任何上游服务。' }),
      })
      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toMatchObject({ error: 'image-model-unconfigured' })
    } finally {
      await bridge.close()
    }
  })

  it('为每次图片任务写入模型、耗时和积分结算记录', async () => {
    const upstream = createServer(async (request, response) => {
      for await (const _chunk of request) void _chunk
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ data: [{ b64_json: Buffer.alloc(128, 7).toString('base64') }] }))
    })
    const apiUrl = await listen(upstream)
    const directory = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-ai-usage-'))
    const bridge = await startLocalAiBridge({
      port: 0,
      accessToken: 'test-access-token',
      externalImageApiUrl: apiUrl,
      externalImageApiKey: 'secret-key',
      externalImageModelId: 'gpt-image-2',
      usageAuditPath: path.join(directory, 'usage.jsonl'),
      allowedOrigins: [],
    })
    try {
      const response = await fetch(`${bridge.url}/api/generate-image`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A detailed fantasy portrait prompt long enough for the image endpoint.', aspect: 'square' }),
      })
      const body = await response.json() as { billing: { actualCredits: number; reservedCredits: number; modelId: string } }
      expect(body.billing).toMatchObject({ modelId: 'gpt-image-2', actualCredits: 250, reservedCredits: 500 })

      const usageResponse = await fetch(`${bridge.url}/api/usage?limit=10`, {
        headers: { Authorization: 'Bearer test-access-token' },
      })
      const usage = await usageResponse.json() as { records: Array<Record<string, unknown>> }
      expect(usage.records).toHaveLength(1)
      expect(usage.records[0]).toMatchObject({
        task: 'image-generation',
        providerId: 'external-account',
        modelId: 'gpt-image-2',
        status: 'completed',
        actualCredits: 250,
        refundedCredits: 250,
      })
      expect(Number(usage.records[0]?.durationMs)).toBeGreaterThanOrEqual(0)
    } finally {
      await bridge.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
