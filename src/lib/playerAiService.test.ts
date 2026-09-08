/// <reference types="node" />
import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPlayerAiService } from '../../scripts/player-ai-service.mjs'

const servers: Server[] = []
const roots: string[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fakeOpenAi() {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = []
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
    requests.push({ path: request.url ?? '', body })
    response.setHeader('Content-Type', 'application/json')
    if (request.url === '/v1/chat/completions') {
      response.end(JSON.stringify({
        choices: [{
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              schemaVersion: 1,
              name: '测试冒险者',
              skills: [],
              spellNames: [],
              notes: [],
              uncertain: [],
            }),
          },
        }],
        usage: { prompt_tokens: 321, completion_tokens: 45 },
      }))
      return
    }
    if (request.url === '/v1/images/generations') {
      response.end(JSON.stringify({ data: [{ b64_json: Buffer.alloc(256, 1).toString('base64') }] }))
      return
    }
    response.statusCode = 404
    response.end('{}')
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing-test-server-address')
  return { url: `http://127.0.0.1:${address.port}/v1`, requests }
}

describe('player AI service', () => {
  it('only uses Luna for Excel and gpt-image low for portraits, with actor audit records', async () => {
    const upstream = await fakeOpenAi()
    const root = await mkdtemp(path.join(os.tmpdir(), 'stars-player-ai-'))
    roots.push(root)
    const usageAuditPath = path.join(root, 'usage.jsonl')
    const service = createPlayerAiService({
      apiUrl: upstream.url,
      apiKey: 'test-key',
      imageApiUrl: upstream.url,
      imageApiKey: 'test-image-key',
      usageAuditPath,
    })

    const excel = await service.enhanceCharacterExcel({
      workbookText: '## 主要\nR1: A1=测试冒险者',
      fileName: '测试.xlsx',
      actorId: 'player-member-1',
      roomId: 'ABC234',
    }) as { patch: { name?: string }; billing: { inputTokens: number; actualCredits: number } }
    const portrait = await service.generateCharacterPortrait({
      prompt: '一名身穿蓝色长袍、手持法杖的人类法师，全身立绘，正面构图。',
      aspect: 'portrait-3:4',
      actorId: 'player-member-1',
      roomId: 'ABC234',
    }) as { quality: string; billing: { actualCredits: number; reservedCredits: number } }

    expect(excel.patch.name).toBe('测试冒险者')
    expect(excel.billing.inputTokens).toBe(321)
    expect(portrait.quality).toBe('low')
    expect(portrait.billing).toMatchObject({ actualCredits: 250, reservedCredits: 500 })
    expect(upstream.requests[0]).toMatchObject({
      path: '/v1/chat/completions',
      body: { model: 'gpt-5.6-luna' },
    })
    expect(upstream.requests[1]).toMatchObject({
      path: '/v1/images/generations',
      body: { model: 'gpt-image-2', quality: 'low', size: '1024x1536' },
    })
    expect(JSON.stringify(upstream.requests[1].body)).not.toContain('high')

    const records = (await readFile(usageAuditPath, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line))
    const settled = records.filter((record) => record.phase === 'settled')
    expect(settled).toHaveLength(2)
    expect(settled[0]).toMatchObject({
      providerId: 'openai-compatible',
      modelId: 'gpt-5.6-luna',
      actorId: 'player-member-1',
      roomId: 'ABC234',
      inputTokens: 321,
      outputTokens: 45,
    })
    expect(settled[1]).toMatchObject({
      modelId: 'gpt-image-2',
      quality: 'low',
      actorId: 'player-member-1',
      roomId: 'ABC234',
    })
  })

  it('enforces per-member concurrency/rate policy and validates task payloads', async () => {
    const upstream = await fakeOpenAi()
    const service = createPlayerAiService({
      apiUrl: upstream.url,
      apiKey: 'test-key',
      imageApiUrl: upstream.url,
      imageApiKey: 'test-image-key',
      hourlyExcelLimit: 1,
      hourlyPortraitLimit: 1,
    })
    const input = {
      workbookText: '## 主要\nR1: A1=测试冒险者',
      fileName: '测试.xlsx',
      actorId: 'player-member-2',
      roomId: 'ABC234',
    }
    await service.enhanceCharacterExcel(input)
    await expect(service.enhanceCharacterExcel(input)).rejects.toMatchObject({ code: 'player-ai-rate-limit', statusCode: 429 })
    await expect(service.generateCharacterPortrait({
      prompt: '太短',
      actorId: 'player-member-2',
      roomId: 'ABC234',
    })).rejects.toMatchObject({ code: 'invalid-image-prompt', statusCode: 400 })
  })
})
