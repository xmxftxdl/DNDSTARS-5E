import { createServer, type Server } from 'node:http'
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
    } finally {
      await bridge.close()
    }
  })

  it('allows an explicit quality to override the configured low-cost default', async () => {
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
        }),
      })

      expect(response.status).toBe(200)
      expect(upstreamBody).toMatchObject({ quality: 'medium' })
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
})
