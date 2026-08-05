import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { startLocalAiBridge } from '../../scripts/local-ai-bridge-core.mjs'

const servers: Array<{ close: () => Promise<unknown> } | Server> = []

async function closeServer(server: { close: () => Promise<unknown> } | Server) {
  if ('listening' in server) {
    if (!server.listening) return
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    return
  }
  await server.close()
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer))
})

async function fakeOllama() {
  const server = createServer(async (req, res) => {
    if (req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ models: [{ name: 'qwen-test:latest' }] }))
      return
    }
    if (req.url === '/api/chat' && req.method === 'POST') {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      expect(body.model).toBe('qwen-test:latest')
      expect(body.stream).toBe(true)
      expect(body.think).toBe(false)
      expect(body.format).toMatchObject({ type: 'object' })
      expect(body.options).toMatchObject({ temperature: 0, num_ctx: 8192, num_predict: 6144 })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        message: { content: JSON.stringify({ name: '测试怪物' }) },
        prompt_eval_count: 123,
        eval_count: 17,
      }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing-test-address')
  return `http://127.0.0.1:${address.port}`
}

async function fakeExternalModelApi() {
  const server = createServer(async (req, res) => {
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      expect(req.headers.authorization).toBe('Bearer test-secret')
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      expect(body.model).toBe('cloud-test')
      expect(body.max_completion_tokens).toBe(16_384)
      expect(body).not.toHaveProperty('max_tokens')
      expect(body).not.toHaveProperty('temperature')
      expect(body.response_format).toMatchObject({
        type: 'json_schema',
        json_schema: { strict: true },
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ name: '外部模型草稿' }) } }],
        usage: { prompt_tokens: 91, completion_tokens: 23 },
      }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing-test-address')
  return `http://127.0.0.1:${address.port}/v1`
}

async function fakeRejectingExternalModelApi() {
  const server = createServer(async (req, res) => {
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      for await (const _chunk of req) void _chunk
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: {
          message: "Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead.\n",
          type: 'invalid_request_error',
          param: 'max_tokens',
          code: 'unsupported_parameter',
        },
      }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing-test-address')
  return `http://127.0.0.1:${address.port}/v1`
}

async function fakeRoutedExternalModelApi(expectedKey: string) {
  const requestedModels: string[] = []
  const requestedBodies: Array<Record<string, unknown>> = []
  const server = createServer(async (req, res) => {
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      expect(req.headers.authorization).toBe(`Bearer ${expectedKey}`)
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> & { model?: string }
      requestedModels.push(body.model ?? '')
      requestedBodies.push(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ name: body.model }) } }],
        usage: { prompt_tokens: 31, completion_tokens: 7 },
      }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing-test-address')
  return {
    apiUrl: `http://127.0.0.1:${address.port}/v1`,
    requestedModels,
    requestedBodies,
  }
}

describe('Astral Trace Local AI Bridge', () => {
  it('只允许白名单 Origin，并要求一次性配对后才能发现和调用本地模型', async () => {
    const ollamaUrl = await fakeOllama()
    const bridge = await startLocalAiBridge({
      port: 0,
      pairingCode: '123456',
      ollamaUrl,
      allowedOrigins: ['https://astraltracevtt.com'],
    })
    servers.push(bridge)

    const forbidden = await fetch(`${bridge.url}/api/healthz`, {
      headers: { Origin: 'https://attacker.example' },
    })
    expect(forbidden.status).toBe(403)

    const health = await fetch(`${bridge.url}/api/healthz`, {
      headers: { Origin: 'https://astraltracevtt.com' },
    })
    expect(await health.json()).toMatchObject({ paired: false, schemaVersion: 1 })

    const unauthorized = await fetch(`${bridge.url}/api/models`, {
      headers: { Origin: 'https://astraltracevtt.com' },
    })
    expect(unauthorized.status).toBe(401)

    const wrongPairing = await fetch(`${bridge.url}/api/pair`, {
      method: 'POST',
      headers: { Origin: 'https://astraltracevtt.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '000000' }),
    })
    expect(wrongPairing.status).toBe(401)

    const pairing = await fetch(`${bridge.url}/api/pair`, {
      method: 'POST',
      headers: { Origin: 'https://astraltracevtt.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    })
    expect(pairing.status).toBe(200)
    const paired = await pairing.json() as { accessToken: string }
    expect(paired.accessToken.length).toBeGreaterThan(32)

    const authorizedHeaders = {
      Origin: 'https://astraltracevtt.com',
      Authorization: `Bearer ${paired.accessToken}`,
    }
    const modelsResponse = await fetch(`${bridge.url}/api/models`, { headers: authorizedHeaders })
    const models = await modelsResponse.json() as { models: Array<{ id: string }>; engines: Record<string, string> }
    expect(models.engines.ollama).toBe('ready')
    expect(models.models.map((entry) => entry.id)).toEqual(['ollama:qwen-test:latest'])

    const generation = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: { ...authorizedHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engine: 'ollama',
        modelId: 'ollama:qwen-test:latest',
        request: {
          schemaVersion: 1,
          jobId: 'job-1',
          task: 'resource-structuring',
          systemPrompt: '提取结构化怪物。',
          userPrompt: '读取资料。',
          outputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      }),
    })
    expect(generation.status).toBe(200)
    expect(await generation.json()).toMatchObject({
      schemaVersion: 1,
      jobId: 'job-1',
      providerId: 'local-bridge',
      modelId: 'ollama:qwen-test:latest',
      output: { name: '测试怪物' },
      usage: { inputTokens: 123, outputTokens: 17 },
    })
  })

  it('为 PDF 分析保留足够输出预算，并安全解析 JSON 代码块', async () => {
    const server = createServer(async (req, res) => {
      if (req.url === '/api/tags') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ models: [{ name: 'qwen-pdf:latest' }] }))
        return
      }
      if (req.url === '/api/chat' && req.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        expect(body.options).toMatchObject({ num_ctx: 16_384, num_predict: 1_600 })
        expect(body.stream).toBe(true)
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        res.flushHeaders()
        await new Promise((resolve) => setTimeout(resolve, 120))
        res.write(`${JSON.stringify({ message: { content: '```json\n{"name":' } })}\n`)
        res.end(`${JSON.stringify({
          message: { content: '"鹿灯驿馆"}\n```' },
          done: true,
          prompt_eval_count: 3_876,
          eval_count: 2_100,
        })}\n`)
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    servers.push(server)
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing-test-address')
    const bridge = await startLocalAiBridge({
      port: 0,
      pairingCode: '112233',
      ollamaUrl: `http://127.0.0.1:${address.port}`,
      allowedOrigins: ['https://astraltracevtt.com'],
    })
    servers.push(bridge)
    const pairing = await fetch(`${bridge.url}/api/pair`, {
      method: 'POST',
      headers: { Origin: 'https://astraltracevtt.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '112233' }),
    })
    const { accessToken } = await pairing.json() as { accessToken: string }
    const requestStartedAt = Date.now()
    const generation = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: {
        Origin: 'https://astraltracevtt.com',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        engine: 'ollama',
        modelId: 'ollama:qwen-pdf:latest',
        request: {
          schemaVersion: 1,
          jobId: 'pdf-job-1',
          task: 'pdf-extraction',
          systemPrompt: '提取结构化资料。',
          userPrompt: '分析这个页段。',
          maxOutputTokens: 1_600,
          outputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      }),
    })
    expect(generation.status).toBe(200)
    expect(generation.headers.get('transfer-encoding')).toBe('chunked')
    expect(Date.now() - requestStartedAt).toBeLessThan(100)
    expect(await generation.json()).toMatchObject({
      output: { name: '鹿灯驿馆' },
      usage: { inputTokens: 3_876, outputTokens: 2_100 },
    })

    const asyncStartedAt = Date.now()
    const asyncRequest = {
      async: true,
      engine: 'ollama',
      modelId: 'ollama:qwen-pdf:latest',
      request: {
        schemaVersion: 1,
        jobId: 'pdf-job-async',
        task: 'pdf-extraction',
        systemPrompt: '提取结构化资料。',
        userPrompt: '分析这个页段。',
        maxOutputTokens: 1_600,
        outputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      },
    }
    const asyncStart = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: {
        Origin: 'https://astraltracevtt.com',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(asyncRequest),
    })
    expect(asyncStart.status).toBe(202)
    expect(Date.now() - asyncStartedAt).toBeLessThan(100)
    const asyncJob = await asyncStart.json() as { bridgeJobId: string }
    const duplicateStart = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: {
        Origin: 'https://astraltracevtt.com',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(asyncRequest),
    })
    expect(duplicateStart.status).toBe(202)
    expect(await duplicateStart.json()).toMatchObject({ bridgeJobId: asyncJob.bridgeJobId })

    const queuedStart = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: {
        Origin: 'https://astraltracevtt.com',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...asyncRequest,
        request: { ...asyncRequest.request, jobId: 'pdf-job-queued' },
      }),
    })
    expect(queuedStart.status).toBe(202)
    const queuedJob = await queuedStart.json() as { bridgeJobId: string; status: string }
    expect(queuedJob).toMatchObject({ status: 'queued' })

    const cancelledStart = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: {
        Origin: 'https://astraltracevtt.com',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...asyncRequest,
        request: { ...asyncRequest.request, jobId: 'pdf-job-cancelled' },
      }),
    })
    const cancelledJob = await cancelledStart.json() as { bridgeJobId: string; status: string }
    expect(cancelledJob).toMatchObject({ status: 'queued' })
    const cancelResponse = await fetch(
      `${bridge.url}/api/generate-structured/${cancelledJob.bridgeJobId}/cancel`,
      {
        method: 'POST',
        headers: {
          Origin: 'https://astraltracevtt.com',
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )
    expect(cancelResponse.status).toBe(200)
    expect(await cancelResponse.json()).toMatchObject({
      bridgeJobId: cancelledJob.bridgeJobId,
      status: 'failed',
    })
    const cancelledStatus = await fetch(
      `${bridge.url}/api/generate-structured/${cancelledJob.bridgeJobId}`,
      {
        headers: {
          Origin: 'https://astraltracevtt.com',
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )
    expect(await cancelledStatus.json()).toMatchObject({
      status: 'failed',
      generationError: 'bridge-generation-cancelled',
    })
    let asyncResult: unknown = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 15))
      const status = await fetch(`${bridge.url}/api/generate-structured/${asyncJob.bridgeJobId}`, {
        headers: {
          Origin: 'https://astraltracevtt.com',
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const body = await status.json() as { status: string; result?: unknown }
      if (body.status === 'completed') {
        asyncResult = body.result
        break
      }
    }
    expect(asyncResult).toMatchObject({ output: { name: '鹿灯驿馆' } })
    let queuedResult: unknown = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 15))
      const status = await fetch(`${bridge.url}/api/generate-structured/${queuedJob.bridgeJobId}`, {
        headers: {
          Origin: 'https://astraltracevtt.com',
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const body = await status.json() as { status: string; result?: unknown }
      if (body.status === 'completed') {
        queuedResult = body.result
        break
      }
    }
    expect(queuedResult).toMatchObject({ output: { name: '鹿灯驿馆' } })
  })

  it('拒绝把上游模型地址配置为公网 SSRF 目标', async () => {
    await expect(startLocalAiBridge({ ollamaUrl: 'https://example.com' }))
      .rejects.toThrow('local-ai-upstream-must-be-loopback')
  })

  it('取消运行中的异步任务时会中止上游生成，避免孤儿任务继续占用模型', async () => {
    let markChatStarted!: () => void
    let markUpstreamClosed!: () => void
    const chatStarted = new Promise<void>((resolve) => { markChatStarted = resolve })
    const upstreamClosed = new Promise<void>((resolve) => { markUpstreamClosed = resolve })
    const upstream = createServer(async (req, res) => {
      if (req.url === '/api/tags') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ models: [{ name: 'qwen-cancel:latest' }] }))
        return
      }
      if (req.url === '/api/chat' && req.method === 'POST') {
        for await (const _chunk of req) void _chunk
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        res.flushHeaders()
        res.once('close', markUpstreamClosed)
        markChatStarted()
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve, reject) => {
      upstream.once('error', reject)
      upstream.listen(0, '127.0.0.1', resolve)
    })
    servers.push(upstream)
    const upstreamAddress = upstream.address()
    if (!upstreamAddress || typeof upstreamAddress === 'string') throw new Error('missing-test-address')
    const bridge = await startLocalAiBridge({
      port: 0,
      pairingCode: '445566',
      ollamaUrl: `http://127.0.0.1:${upstreamAddress.port}`,
      allowedOrigins: ['https://astraltracevtt.com'],
    })
    servers.push(bridge)
    const pairing = await fetch(`${bridge.url}/api/pair`, {
      method: 'POST',
      headers: { Origin: 'https://astraltracevtt.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '445566' }),
    })
    const { accessToken } = await pairing.json() as { accessToken: string }
    const headers = {
      Origin: 'https://astraltracevtt.com',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
    const start = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        async: true,
        engine: 'ollama',
        modelId: 'ollama:qwen-cancel:latest',
        request: {
          schemaVersion: 1,
          jobId: 'pdf-job-running-cancel',
          task: 'pdf-extraction',
          systemPrompt: '提取结构化资料。',
          userPrompt: '分析页面。',
          outputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      }),
    })
    const started = await start.json() as { bridgeJobId: string }
    await Promise.race([
      chatStarted,
      new Promise((_, reject) => setTimeout(() => reject(new Error('chat-not-started')), 1_000)),
    ])
    const cancel = await fetch(
      `${bridge.url}/api/generate-structured/${started.bridgeJobId}/cancel`,
      { method: 'POST', headers },
    )
    expect(await cancel.json()).toMatchObject({ status: 'failed' })
    await Promise.race([
      upstreamClosed,
      new Promise((_, reject) => setTimeout(() => reject(new Error('upstream-not-aborted')), 1_000)),
    ])
    const status = await fetch(`${bridge.url}/api/generate-structured/${started.bridgeJobId}`, { headers })
    expect(await status.json()).toMatchObject({
      status: 'failed',
      generationError: 'bridge-generation-cancelled',
    })
  })

  it('通过本机 Bridge 调用 OpenAI-compatible 模型 API，且密钥不会交给浏览器', async () => {
    const externalApiUrl = await fakeExternalModelApi()
    const bridge = await startLocalAiBridge({
      port: 0,
      pairingCode: '654321',
      externalApiUrl,
      externalApiKey: 'test-secret',
      externalModelId: 'cloud-test',
      externalModelDisplayName: 'Cloud Test',
      allowedOrigins: ['https://astraltracevtt.com'],
    })
    servers.push(bridge)

    const pairing = await fetch(`${bridge.url}/api/pair`, {
      method: 'POST',
      headers: { Origin: 'https://astraltracevtt.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '654321' }),
    })
    const { accessToken } = await pairing.json() as { accessToken: string }
    const headers = {
      Origin: 'https://astraltracevtt.com',
      Authorization: `Bearer ${accessToken}`,
    }

    const modelResponse = await fetch(`${bridge.url}/api/models`, { headers })
    const modelBody = await modelResponse.json() as {
      models: Array<{ id: string; providerId: string }>
      engines: Record<string, string>
    }
    expect(modelBody.engines.external).toBe('ready')
    expect(modelBody.models).toContainEqual(expect.objectContaining({
      id: 'external:cloud-test',
      providerId: 'external-account',
    }))
    expect(JSON.stringify(modelBody)).not.toContain('test-secret')

    const unconfiguredModel = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engine: 'external',
        modelId: 'external:unconfigured-model',
        request: {
          schemaVersion: 1,
          jobId: 'external-job-rejected',
          task: 'resource-structuring',
          systemPrompt: '只输出结构化草稿。',
          userPrompt: '转换规则。',
          outputSchema: { type: 'object' },
        },
      }),
    })
    expect(unconfiguredModel.status).toBe(400)

    const generation = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engine: 'external',
        modelId: 'external:cloud-test',
        request: {
          schemaVersion: 1,
          jobId: 'external-job-1',
          task: 'resource-structuring',
          systemPrompt: '只输出结构化草稿。',
          userPrompt: '转换规则。',
          outputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      }),
    })
    expect(generation.status).toBe(200)
    expect(await generation.json()).toMatchObject({
      providerId: 'external-account',
      modelId: 'external:cloud-test',
      output: { name: '外部模型草稿' },
      usage: { inputTokens: 91, outputTokens: 23 },
    })
  })

  it('为 GPT-5.6 低成本结构化调用显式关闭推理预算', async () => {
    const external = await fakeRoutedExternalModelApi('test-secret')
    const bridge = await startLocalAiBridge({
      port: 0,
      pairingCode: '135790',
      externalApiUrl: external.apiUrl,
      externalApiKey: 'test-secret',
      externalModelId: 'gpt-5.6-luna',
      allowedOrigins: ['https://astraltracevtt.com'],
    })
    servers.push(bridge)
    const pairing = await fetch(`${bridge.url}/api/pair`, {
      method: 'POST',
      headers: { Origin: 'https://astraltracevtt.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '135790' }),
    })
    const { accessToken } = await pairing.json() as { accessToken: string }
    const generation = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: {
        Origin: 'https://astraltracevtt.com',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        engine: 'external',
        modelId: 'external:gpt-5.6-luna',
        request: {
          schemaVersion: 1,
          jobId: 'gpt-5-6-luna-structured',
          task: 'resource-structuring',
          systemPrompt: '只输出结构化草稿。',
          userPrompt: '转换规则。',
          outputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      }),
    })

    expect(generation.status).toBe(200)
    expect(await generation.json()).toMatchObject({
      providerId: 'external-account',
      modelId: 'external:gpt-5.6-luna',
    })
    expect(external.requestedBodies).toHaveLength(1)
    expect(external.requestedBodies[0]).toMatchObject({
      model: 'gpt-5.6-luna',
      reasoning_effort: 'none',
      max_completion_tokens: 16_384,
    })
  })

  it('保留 OpenAI 风格的嵌套 400 错误详情且清除控制字符', async () => {
    const externalApiUrl = await fakeRejectingExternalModelApi()
    const bridge = await startLocalAiBridge({
      port: 0,
      pairingCode: '456789',
      externalApiUrl,
      externalApiKey: 'test-secret',
      externalModelId: 'cloud-test',
      allowedOrigins: ['https://astraltracevtt.com'],
    })
    servers.push(bridge)

    const pairing = await fetch(`${bridge.url}/api/pair`, {
      method: 'POST',
      headers: { Origin: 'https://astraltracevtt.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '456789' }),
    })
    const { accessToken } = await pairing.json() as { accessToken: string }
    const response = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers: {
        Origin: 'https://astraltracevtt.com',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        engine: 'external',
        modelId: 'external:cloud-test',
        request: {
          schemaVersion: 1,
          jobId: 'external-upstream-error',
          task: 'resource-structuring',
          systemPrompt: '只输出结构化草稿。',
          userPrompt: '转换规则。',
          outputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      error: "upstream-400:Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead. | invalid_request_error | max_tokens | unsupported_parameter",
    })
  })

  it('为 PDF 分段提取与全书综合暴露独立外部模型并转发到正确的上游模型', async () => {
    const economyExternal = await fakeRoutedExternalModelApi('economy-secret')
    const advancedExternal = await fakeRoutedExternalModelApi('advanced-secret')
    const bridge = await startLocalAiBridge({
      port: 0,
      pairingCode: '112233',
      externalExtractionApiUrl: economyExternal.apiUrl,
      externalExtractionApiKey: 'economy-secret',
      externalExtractionModelId: 'economy-model',
      externalExtractionModelDisplayName: '经济提取模型',
      externalSynthesisApiUrl: advancedExternal.apiUrl,
      externalSynthesisApiKey: 'advanced-secret',
      externalSynthesisModelId: 'advanced-model',
      externalSynthesisModelDisplayName: '高级综合模型',
      allowedOrigins: ['https://astraltracevtt.com'],
    })
    servers.push(bridge)

    const pairing = await fetch(`${bridge.url}/api/pair`, {
      method: 'POST',
      headers: { Origin: 'https://astraltracevtt.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '112233' }),
    })
    const { accessToken } = await pairing.json() as { accessToken: string }
    const headers = {
      Origin: 'https://astraltracevtt.com',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    const modelResponse = await fetch(`${bridge.url}/api/models`, { headers })
    const modelBody = await modelResponse.json() as {
      models: Array<{ id: string; displayName: string; supportedTasks: string[] }>
    }
    expect(modelBody.models).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external:extraction:economy-model',
        displayName: '经济提取模型',
        supportedTasks: ['pdf-extraction'],
      }),
      expect.objectContaining({
        id: 'external:synthesis:advanced-model',
        displayName: '高级综合模型',
        supportedTasks: ['campaign-analysis', 'resource-structuring', 'session-summary', 'prep-recommendations'],
      }),
    ]))
    expect(JSON.stringify(modelBody)).not.toContain('economy-secret')
    expect(JSON.stringify(modelBody)).not.toContain('advanced-secret')

    const generate = async (
      modelId: string,
      jobId: string,
      task: 'pdf-extraction' | 'campaign-analysis' | 'resource-structuring',
    ) => {
      const response = await fetch(`${bridge.url}/api/generate-structured`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          engine: 'external',
          modelId,
          request: {
            schemaVersion: 1,
            jobId,
            task,
            systemPrompt: '只输出结构化数据。',
            userPrompt: '分析资料。',
            outputSchema: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        }),
      })
      expect(response.status).toBe(200)
      return await response.json() as { modelId: string; output: { name: string } }
    }

    expect(await generate('external:extraction:economy-model', 'route-extraction', 'pdf-extraction'))
      .toMatchObject({
        modelId: 'external:extraction:economy-model',
        output: { name: 'economy-model' },
      })
    expect(await generate('external:synthesis:advanced-model', 'route-synthesis', 'campaign-analysis'))
      .toMatchObject({
        modelId: 'external:synthesis:advanced-model',
        output: { name: 'advanced-model' },
      })
    expect(await generate('external:synthesis:advanced-model', 'route-resource', 'resource-structuring'))
      .toMatchObject({
        modelId: 'external:synthesis:advanced-model',
        output: { name: 'advanced-model' },
      })
    expect(economyExternal.requestedModels).toEqual(['economy-model'])
    expect(advancedExternal.requestedModels).toEqual(['advanced-model', 'advanced-model'])

    const roleViolation = await fetch(`${bridge.url}/api/generate-structured`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        engine: 'external',
        modelId: 'external:extraction:economy-model',
        request: {
          schemaVersion: 1,
          jobId: 'route-role-violation',
          task: 'campaign-analysis',
          systemPrompt: '只输出结构化数据。',
          userPrompt: '分析资料。',
          outputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      }),
    })
    expect(roleViolation.status).toBe(400)
    expect(economyExternal.requestedModels).toEqual(['economy-model'])
  })

  it('允许分段提取与全书综合共用外部 API 地址和密钥', async () => {
    const external = await fakeRoutedExternalModelApi('shared-secret')
    const bridge = await startLocalAiBridge({
      port: 0,
      pairingCode: '445566',
      externalApiUrl: external.apiUrl,
      externalApiKey: 'shared-secret',
      externalExtractionModelId: 'economy-model',
      externalSynthesisModelId: 'advanced-model',
      allowedOrigins: ['https://astraltracevtt.com'],
    })
    servers.push(bridge)

    const pairing = await fetch(`${bridge.url}/api/pair`, {
      method: 'POST',
      headers: { Origin: 'https://astraltracevtt.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '445566' }),
    })
    const { accessToken } = await pairing.json() as { accessToken: string }
    const modelResponse = await fetch(`${bridge.url}/api/models`, {
      headers: {
        Origin: 'https://astraltracevtt.com',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const modelBody = await modelResponse.json() as { models: Array<{ id: string }> }

    expect(modelBody.models.map((model) => model.id)).toEqual(expect.arrayContaining([
      'external:extraction:economy-model',
      'external:synthesis:advanced-model',
    ]))
    expect(modelBody.models.map((model) => model.id)).not.toContain('external:economy-model')
    expect(modelBody.models.map((model) => model.id)).not.toContain('external:advanced-model')
  })

  it('拒绝不完整或不安全的外部模型配置', async () => {
    await expect(startLocalAiBridge({ externalApiUrl: 'https://api.example.com/v1' }))
      .rejects.toThrow('external-model-config-incomplete')
    await expect(startLocalAiBridge({
      externalApiUrl: 'http://api.example.com/v1',
      externalApiKey: 'secret',
      externalModelId: 'model',
    })).rejects.toThrow('external-model-api-must-use-https')
    await expect(startLocalAiBridge({
      externalApiUrl: 'https://api.example.com/v1',
      externalApiKey: 'secret',
      externalExtractionModelId: 'x'.repeat(150),
    })).rejects.toThrow('invalid-external-model-id')
  })
})
