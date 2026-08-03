import { describe, expect, it, vi } from 'vitest'
import {
  estimateAiProviderCredits,
  normalizeAiProviderDescriptor,
  selectAiProvider,
  type AiModelDescriptorV1,
  type AiProviderDescriptorV1,
  type AiProviderSelectionV1,
} from '../../shared/ai-provider.mjs'
import {
  AiProviderRegistryV1,
  executeStructuredAiTask,
  validateAiStructuredGenerationRequest,
  type AiProviderRuntimeV1,
  type AiStructuredGenerationRequestV1,
} from './aiProvider'

function provider(overrides: Partial<AiProviderDescriptorV1> = {}): AiProviderDescriptorV1 {
  return {
    schemaVersion: 1,
    id: 'local',
    displayName: '本地模型',
    description: '测试 Provider',
    transport: 'local-bridge',
    status: 'ready',
    dataBoundary: 'local-only',
    capabilities: ['text-generation', 'structured-output', 'chinese'],
    supportedTasks: ['campaign-analysis', 'resource-structuring'],
    pricing: {
      mode: 'free-local',
      creditsPerMillionInput: 0,
      creditsPerMillionOutput: 0,
      minimumCredits: 0,
    },
    ...overrides,
  }
}

function cloudProvider(overrides: Partial<AiProviderDescriptorV1> = {}): AiProviderDescriptorV1 {
  return provider({
    id: 'cloud',
    displayName: '付费模型',
    transport: 'platform-server',
    dataBoundary: 'cloud-processing',
    pricing: {
      mode: 'platform-credit',
      creditsPerMillionInput: 1_000,
      creditsPerMillionOutput: 4_000,
      minimumCredits: 2,
    },
    ...overrides,
  })
}

function selection(overrides: Partial<AiProviderSelectionV1> = {}): AiProviderSelectionV1 {
  return {
    schemaVersion: 1,
    providerId: 'local',
    allowPaidFallback: false,
    maxCreditsPerTask: 0,
    ...overrides,
  }
}

function model(providerId = 'local'): AiModelDescriptorV1 {
  return {
    schemaVersion: 1,
    providerId,
    id: `${providerId}-model`,
    displayName: '测试模型',
    contextWindowTokens: 32_768,
    capabilities: ['text-generation', 'structured-output', 'chinese'],
    supportedTasks: ['campaign-analysis', 'resource-structuring'],
  }
}

function request(): AiStructuredGenerationRequestV1 {
  return {
    schemaVersion: 1,
    jobId: 'job-1',
    task: 'resource-structuring',
    systemPrompt: '只输出符合 schema 的内容。',
    userPrompt: '提取怪物。',
    outputSchema: { type: 'object' },
  }
}

function runtime(
  descriptor = provider(),
  output: unknown = { name: '哥布林' },
): AiProviderRuntimeV1 {
  return {
    descriptor,
    listModels: vi.fn(async () => [model(descriptor.id)]),
    generateStructured: vi.fn(async (input) => ({
      schemaVersion: 1 as const,
      jobId: input.jobId,
      providerId: descriptor.id,
      modelId: `${descriptor.id}-model`,
      output,
      usage: { inputTokens: 100, outputTokens: 20 },
    })),
  }
}

describe('AiProviderV1', () => {
  it('拒绝伪装成本地处理的云端 Provider', () => {
    const result = normalizeAiProviderDescriptor(provider({
      transport: 'platform-server',
    }))
    expect(result).toEqual({ ok: false, error: 'invalid-provider-trust-boundary' })
  })

  it('本地 Provider 不消耗平台 AI Credit', () => {
    expect(estimateAiProviderCredits(provider(), 500_000, 100_000)).toBe(0)
    expect(estimateAiProviderCredits(cloudProvider(), 500_000, 100_000)).toBe(900)
  })

  it('本地离线时默认停止，不会静默切到付费模型', () => {
    const result = selectAiProvider({
      providers: [provider({ status: 'offline' }), cloudProvider()],
      models: [model('local'), model('cloud')],
      selection: selection(),
      task: 'campaign-analysis',
    })
    expect(result).toEqual({ ok: false, error: 'provider-unavailable' })
  })

  it('只有明确允许且未超过额度时才使用付费回退', () => {
    const providers = [provider({ status: 'offline' }), cloudProvider()]
    const models = [model('local'), model('cloud')]
    const denied = selectAiProvider({
      providers,
      models,
      selection: selection({ allowPaidFallback: true, maxCreditsPerTask: 10 }),
      task: 'campaign-analysis',
      estimatedInputTokens: 100_000,
      estimatedOutputTokens: 20_000,
    })
    expect(denied).toEqual({ ok: false, error: 'paid-fallback-unavailable' })

    const allowed = selectAiProvider({
      providers,
      models,
      selection: selection({ allowPaidFallback: true, maxCreditsPerTask: 200 }),
      task: 'campaign-analysis',
      estimatedInputTokens: 100_000,
      estimatedOutputTokens: 20_000,
    })
    expect(allowed.ok).toBe(true)
    if (allowed.ok) {
      expect(allowed.provider.id).toBe('cloud')
      expect(allowed.estimatedCredits).toBe(180)
      expect(allowed.fallback).toBe(true)
    }
  })

  it('注册表拒绝重复 Provider', () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime())
    expect(() => registry.register(runtime())).toThrow('duplicate-ai-provider')
  })

  it('Provider 输出必须经过 Host 类型校验后才能返回', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime())
    const result = await executeStructuredAiTask({
      registry,
      selection: selection({ modelId: 'local-model' }),
      request: request(),
      validateOutput: (value): value is { name: string } => (
        !!value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string'
      ),
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.name).toBe('哥布林')
      expect(result.estimatedCredits).toBe(0)
    }
  })

  it('拒绝未通过 Host Schema 的模型输出', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime(provider(), { arbitrary: 'javascript' }))
    const result = await executeStructuredAiTask({
      registry,
      selection: selection({ modelId: 'local-model' }),
      request: request(),
      validateOutput: (value): value is { name: string } => (
        !!value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string'
      ),
    })
    expect(result).toEqual({ ok: false, error: 'provider-output-invalid' })
  })

  it('限制文档、图片与提示词输入，避免把任意载荷交给 Provider', () => {
    expect(validateAiStructuredGenerationRequest(request())).toBe(true)
    expect(validateAiStructuredGenerationRequest({ ...request(), maxOutputTokens: 1_600 })).toBe(true)
    expect(validateAiStructuredGenerationRequest({ ...request(), maxOutputTokens: 16_384 })).toBe(true)
    expect(validateAiStructuredGenerationRequest({ ...request(), maxOutputTokens: 16_385 })).toBe(false)
    expect(validateAiStructuredGenerationRequest({ ...request(), maxOutputTokens: -1 })).toBe(false)
    expect(validateAiStructuredGenerationRequest({
      ...request(),
      task: 'transcription',
    })).toBe(false)
    expect(validateAiStructuredGenerationRequest({
      ...request(),
      images: [{ id: 'x', mimeType: 'image/svg+xml', dataUrl: 'data:image/svg+xml;base64,AA==' }],
    })).toBe(false)
  })
})
