import {
  normalizeAiModelDescriptor,
  type AiModelDescriptorV1,
  type AiProviderDescriptorV1,
} from '../../shared/ai-provider.mjs'
import type {
  AiProviderRuntimeV1,
  AiStructuredGenerationResultV1,
} from './aiProvider'

export const LOCAL_AI_BRIDGE_API_VERSION = 1
export const LOCAL_AI_BRIDGE_DEFAULT_URL = 'http://127.0.0.1:47431'
const TOKEN_STORAGE_KEY = 'astral-trace:local-ai-bridge-token:v1'

export type LocalAiBridgeConnectionStatus = 'unknown' | 'offline' | 'pairing-required' | 'ready' | 'error'

export interface LocalAiBridgeSnapshot {
  status: LocalAiBridgeConnectionStatus
  models: AiModelDescriptorV1[]
  engines: Record<string, 'ready' | 'offline'>
  error?: string
}

export class LocalAiBridgeError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status = 0) {
    super(code)
    this.name = 'LocalAiBridgeError'
    this.code = code
    this.status = status
  }
}

export interface LocalAiPortraitGenerationInput {
  prompt: string
  aspect?: 'portrait-3:4' | 'square'
  quality?: 'low' | 'medium' | 'high'
}

export interface LocalAiPortraitGenerationResult {
  dataUrl: string
  modelId: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
}

function configuredBridgeUrl(): string {
  const configured = String(import.meta.env.VITE_STARS_LOCAL_AI_BRIDGE_URL ?? LOCAL_AI_BRIDGE_DEFAULT_URL)
  const url = new URL(configured)
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname) || url.protocol !== 'http:') {
    return LOCAL_AI_BRIDGE_DEFAULT_URL
  }
  return url.origin
}

function loadToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveToken(token: string): void {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
    else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Session storage may be unavailable in strict privacy modes; the in-memory token still works.
  }
}

let accessToken = typeof window === 'undefined' ? '' : loadToken()
let snapshot: LocalAiBridgeSnapshot = { status: 'unknown', models: [], engines: {} }
const listeners = new Set<() => void>()

function publish(next: LocalAiBridgeSnapshot): LocalAiBridgeSnapshot {
  snapshot = next
  for (const listener of listeners) listener()
  return snapshot
}

async function bridgeRequest<T>(
  path: string,
  init?: RequestInit,
  authorization = true,
  timeoutMs = 10_000,
): Promise<T> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${configuredBridgeUrl()}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(authorization && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
    const body = await response.json().catch(() => ({})) as T & { error?: string }
    if (!response.ok || body.error) {
      throw new LocalAiBridgeError(body.error ?? 'local-ai-bridge-request-failed', response.status)
    }
    return body
  } catch (error) {
    if (error instanceof LocalAiBridgeError) throw error
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')
    throw new LocalAiBridgeError(aborted
      ? 'local-ai-bridge-timeout'
      : 'local-ai-bridge-offline')
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

async function bridgeGenerationRequest<T>(body: unknown, timeoutMs = 910_000): Promise<T> {
  const started = await bridgeRequest<{
    schemaVersion: number
    bridgeJobId: string
    status: 'queued' | 'running' | 'completed' | 'failed'
  }>('/api/generate-structured', {
    method: 'POST',
    body: JSON.stringify({ ...(body as Record<string, unknown>), async: true }),
  }, true, 30_000)
  if (started.schemaVersion !== 1 || typeof started.bridgeJobId !== 'string') {
    throw new LocalAiBridgeError('invalid-bridge-generation-job')
  }
  const queueDeadline = Date.now() + 30 * 60_000
  let generationDeadline = started.status === 'running' ? Date.now() + timeoutMs : null
  let settled = false
  try {
    while (Date.now() < (generationDeadline ?? queueDeadline)) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 1_500))
      const job = await bridgeRequest<{
        schemaVersion: number
        status: 'queued' | 'running' | 'completed' | 'failed'
        result?: T
        generationError?: string
      }>(`/api/generate-structured/${encodeURIComponent(started.bridgeJobId)}`, undefined, true, 10_000)
      if (job.status === 'running' && generationDeadline === null) {
        generationDeadline = Date.now() + timeoutMs
      }
      if (job.status === 'completed' && job.result) {
        settled = true
        return job.result
      }
      if (job.status === 'failed') {
        settled = true
        throw new LocalAiBridgeError(job.generationError || 'bridge-generation-failed')
      }
    }
    throw new LocalAiBridgeError(generationDeadline === null
      ? 'local-ai-bridge-queue-timeout'
      : 'local-ai-bridge-timeout')
  } finally {
    if (!settled) {
      await bridgeRequest(
        `/api/generate-structured/${encodeURIComponent(started.bridgeJobId)}/cancel`,
        { method: 'POST' },
        true,
        10_000,
      ).catch(() => undefined)
    }
  }
}

async function loadModels(): Promise<LocalAiBridgeSnapshot> {
  const response = await bridgeRequest<{
    schemaVersion: number
    models?: unknown[]
    engines?: Record<string, 'ready' | 'offline'>
  }>('/api/models')
  const models = (response.models ?? []).flatMap((value) => {
    const normalized = normalizeAiModelDescriptor(value)
    return normalized.ok ? [normalized.value] : []
  })
  return publish({
    status: 'ready',
    models,
    engines: response.engines ?? {},
  })
}

export async function probeLocalAiBridge(): Promise<LocalAiBridgeSnapshot> {
  try {
    const health = await bridgeRequest<{ schemaVersion: number; paired: boolean }>('/api/healthz', undefined, false)
    if (health.schemaVersion !== LOCAL_AI_BRIDGE_API_VERSION) {
      return publish({ status: 'error', models: [], engines: {}, error: 'bridge-version-mismatch' })
    }
    if (!health.paired || !accessToken) {
      accessToken = ''
      saveToken('')
      return publish({ status: 'pairing-required', models: [], engines: {} })
    }
    return await loadModels()
  } catch (error) {
    return publish({
      status: 'offline',
      models: [],
      engines: {},
      error: error instanceof LocalAiBridgeError ? error.code : 'local-ai-bridge-offline',
    })
  }
}

export async function pairLocalAiBridge(code: string): Promise<LocalAiBridgeSnapshot> {
  const normalizedCode = code.replace(/\D/g, '').slice(0, 6)
  if (normalizedCode.length !== 6) throw new LocalAiBridgeError('invalid-pairing-code')
  const result = await bridgeRequest<{ schemaVersion: number; accessToken: string }>(
    '/api/pair',
    { method: 'POST', body: JSON.stringify({ code: normalizedCode }) },
    false,
  )
  if (result.schemaVersion !== LOCAL_AI_BRIDGE_API_VERSION || typeof result.accessToken !== 'string' || result.accessToken.length < 32) {
    throw new LocalAiBridgeError('invalid-pairing-response')
  }
  accessToken = result.accessToken
  saveToken(accessToken)
  return await loadModels()
}

export function disconnectLocalAiBridge(): LocalAiBridgeSnapshot {
  accessToken = ''
  saveToken('')
  return publish({ status: 'pairing-required', models: [], engines: {} })
}

export function subscribeLocalAiBridge(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function localAiBridgeSnapshot(): LocalAiBridgeSnapshot {
  return snapshot
}

export async function generateLocalAiPortrait(
  input: LocalAiPortraitGenerationInput,
): Promise<LocalAiPortraitGenerationResult> {
  const prompt = input.prompt.trim()
  if (prompt.length < 20 || prompt.length > 4_000) throw new LocalAiBridgeError('invalid-image-prompt')
  const result = await bridgeRequest<{
    schemaVersion: number
    dataUrl: string
    modelId: string
    mimeType: LocalAiPortraitGenerationResult['mimeType']
  }>('/api/generate-image', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      aspect: input.aspect ?? 'portrait-3:4',
      quality: input.quality ?? 'medium',
    }),
  }, true, 310_000)
  if (
    result.schemaVersion !== LOCAL_AI_BRIDGE_API_VERSION ||
    typeof result.modelId !== 'string' ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(result.mimeType) ||
    typeof result.dataUrl !== 'string' ||
    !result.dataUrl.startsWith(`data:${result.mimeType};base64,`) ||
    result.dataUrl.length > 16_000_000
  ) throw new LocalAiBridgeError('invalid-generated-image')
  return result
}

export function localAiPortraitErrorMessage(error: unknown): string {
  const code = error instanceof LocalAiBridgeError ? error.code : error instanceof Error ? error.message : ''
  if (code.includes('image-model-unconfigured')) return '尚未配置图片模型。请为 Local AI Bridge 设置 ASTRALTRACE_IMAGE_MODEL_ID，并重启 Bridge。'
  if (code.includes('image-generation-busy')) return '图片模型正在生成另一张立绘，请稍后再试。'
  if (code.includes('invalid-image-prompt')) return '立绘提示词需为 20–4000 个字符。'
  if (code.includes('bridge-authorization-required')) return 'Local AI Bridge 配对已失效，请重新配对。'
  if (code.includes('local-ai-bridge-timeout')) return '立绘生成超时，模型可能仍在处理，请稍后重试。'
  if (code.includes('local-ai-bridge-offline')) return '无法连接 Local AI Bridge，请确认它正在本机运行。'
  if (code.includes('upstream-')) return `图片模型拒绝了生成请求：${code}`
  return '立绘生成失败；没有修改人物档案。'
}

const READY_LOCAL_DESCRIPTOR: AiProviderDescriptorV1 = {
  schemaVersion: 1,
  id: 'local-bridge',
  displayName: '本地免费模型',
  description: '通过 Astral Trace Local AI Bridge 使用本机模型。',
  transport: 'local-bridge',
  status: 'ready',
  dataBoundary: 'local-only',
  capabilities: ['text-generation', 'structured-output', 'vision', 'embedding', 'long-context', 'chinese'],
  supportedTasks: ['pdf-extraction', 'campaign-analysis', 'resource-structuring', 'map-analysis', 'session-summary', 'prep-recommendations'],
  pricing: {
    mode: 'free-local',
    creditsPerMillionInput: 0,
    creditsPerMillionOutput: 0,
    minimumCredits: 0,
  },
}

export function createLocalAiBridgeRuntime(models: readonly AiModelDescriptorV1[]): AiProviderRuntimeV1 {
  const modelIds = new Set(models
    .filter((model) => model.providerId === 'local-bridge')
    .map((model) => model.id))
  return {
    descriptor: READY_LOCAL_DESCRIPTOR,
    listModels: async () => models.filter((model) => model.providerId === 'local-bridge'),
    generateStructured: async (request, context): Promise<AiStructuredGenerationResultV1> => {
      const modelId = context.model?.id ?? ''
      if (!modelIds.has(modelId)) throw new LocalAiBridgeError('local-model-not-found')
      const engine = modelId.startsWith('ollama:')
        ? 'ollama'
        : modelId.startsWith('llama.cpp:') ? 'llama.cpp' : ''
      if (!engine) throw new LocalAiBridgeError('local-model-engine-unknown')
      return await bridgeGenerationRequest({ engine, modelId, request })
    },
  }
}

const READY_EXTERNAL_DESCRIPTOR: AiProviderDescriptorV1 = {
  schemaVersion: 1,
  id: 'external-account',
  displayName: '自己的模型 API',
  description: '通过 DM 本机的 Local AI Bridge 调用 OpenAI-compatible 模型 API；密钥不会进入浏览器。',
  transport: 'external-server',
  status: 'ready',
  dataBoundary: 'cloud-processing',
  capabilities: ['text-generation', 'structured-output', 'long-context', 'chinese'],
  supportedTasks: ['pdf-extraction', 'campaign-analysis', 'resource-structuring', 'session-summary', 'prep-recommendations'],
  pricing: {
    mode: 'external-account',
    creditsPerMillionInput: 0,
    creditsPerMillionOutput: 0,
    minimumCredits: 0,
  },
}

export function createExternalAiBridgeRuntime(
  models: readonly AiModelDescriptorV1[],
): AiProviderRuntimeV1 {
  const modelIds = new Set(models
    .filter((model) => model.providerId === 'external-account')
    .map((model) => model.id))
  return {
    descriptor: READY_EXTERNAL_DESCRIPTOR,
    listModels: async () => models.filter((model) => model.providerId === 'external-account'),
    generateStructured: async (request, context): Promise<AiStructuredGenerationResultV1> => {
      const modelId = context.model?.id ?? ''
      if (!modelIds.has(modelId) || !modelId.startsWith('external:')) {
        throw new LocalAiBridgeError('external-model-not-found')
      }
      return await bridgeGenerationRequest({ engine: 'external', modelId, request })
    },
  }
}
