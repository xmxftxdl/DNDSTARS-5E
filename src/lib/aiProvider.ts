import {
  AI_PROVIDER_SCHEMA_VERSION,
  normalizeAiModelDescriptor,
  normalizeAiProviderDescriptor,
  normalizeAiStructuredGenerationRequest,
  selectAiProvider,
  type AiDocumentChunkV1,
  type AiModelDescriptorV1,
  type AiProviderDescriptorV1,
  type AiProviderSelectionV1,
  type AiStructuredGenerationRequestV1,
  type JsonSchemaV1,
} from '../../shared/ai-provider.mjs'

export type { AiDocumentChunkV1, AiStructuredGenerationRequestV1, JsonSchemaV1 }

export interface AiProviderUsageV1 {
  inputTokens: number
  outputTokens: number
}

export interface AiStructuredGenerationResultV1 {
  schemaVersion: 1
  jobId: string
  providerId: string
  modelId?: string
  output: unknown
  usage?: AiProviderUsageV1
}

export interface AiProviderRuntimeV1 {
  readonly descriptor: AiProviderDescriptorV1
  listModels(): Promise<readonly AiModelDescriptorV1[]>
  generateStructured(
    request: AiStructuredGenerationRequestV1,
    context: { model?: AiModelDescriptorV1 },
  ): Promise<AiStructuredGenerationResultV1>
}

export type AiProviderExecutionError =
  | 'provider-not-found'
  | 'provider-unavailable'
  | 'provider-cannot-run-task'
  | 'paid-fallback-unavailable'
  | 'unsupported-ai-task'
  | 'invalid-provider-selection-schema'
  | 'invalid-provider-selection'
  | 'provider-runtime-missing'
  | 'provider-request-invalid'
  | 'provider-response-mismatch'
  | 'provider-output-invalid'
  | 'provider-execution-failed'

export type AiProviderExecutionResult<T> =
  | {
      ok: true
      output: T
      provider: AiProviderDescriptorV1
      model?: AiModelDescriptorV1
      estimatedCredits: number
      usage?: AiProviderUsageV1
      fallback: boolean
    }
  | { ok: false; error: AiProviderExecutionError; detail?: string }

export function validateAiStructuredGenerationRequest(
  value: unknown,
): value is AiStructuredGenerationRequestV1 {
  return normalizeAiStructuredGenerationRequest(value).ok
}

export class AiProviderRegistryV1 {
  readonly #providers = new Map<string, {
    descriptor: AiProviderDescriptorV1
    runtime: AiProviderRuntimeV1
  }>()

  register(provider: AiProviderRuntimeV1): void {
    const normalized = normalizeAiProviderDescriptor(provider.descriptor)
    if (!normalized.ok) throw new Error(normalized.error)
    if (this.#providers.has(normalized.value.id)) throw new Error('duplicate-ai-provider')
    this.#providers.set(normalized.value.id, {
      descriptor: normalized.value,
      runtime: provider,
    })
  }

  unregister(providerId: string): boolean {
    return this.#providers.delete(providerId)
  }

  get(providerId: string): AiProviderRuntimeV1 | undefined {
    return this.#providers.get(providerId)?.runtime
  }

  descriptors(): AiProviderDescriptorV1[] {
    return [...this.#providers.values()].map((provider) => provider.descriptor)
  }

  async models(): Promise<AiModelDescriptorV1[]> {
    const entries = await Promise.all([...this.#providers.values()].map(async ({ descriptor, runtime }) => {
      try {
        return (await runtime.listModels()).flatMap((model) => {
          const normalized = normalizeAiModelDescriptor(model)
          return normalized.ok && normalized.value.providerId === descriptor.id ? [normalized.value] : []
        })
      } catch {
        return []
      }
    }))
    return entries.flat()
  }
}

export async function executeStructuredAiTask<T>(input: {
  registry: AiProviderRegistryV1
  selection: AiProviderSelectionV1
  request: AiStructuredGenerationRequestV1
  validateOutput: (value: unknown) => value is T
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
}): Promise<AiProviderExecutionResult<T>> {
  if (!validateAiStructuredGenerationRequest(input.request)) {
    return { ok: false, error: 'provider-request-invalid', detail: 'invalid-ai-request' }
  }
  const models = await input.registry.models()
  const route = selectAiProvider({
    providers: input.registry.descriptors(),
    models,
    selection: input.selection,
    task: input.request.task,
    estimatedInputTokens: input.estimatedInputTokens,
    estimatedOutputTokens: input.estimatedOutputTokens,
  })
  if (!route.ok) return { ok: false, error: route.error as AiProviderExecutionError }
  const runtime = input.registry.get(route.provider.id)
  if (!runtime) return { ok: false, error: 'provider-runtime-missing' }
  try {
    const result = await runtime.generateStructured(input.request, { model: route.model })
    if (
      result.schemaVersion !== AI_PROVIDER_SCHEMA_VERSION ||
      result.jobId !== input.request.jobId ||
      result.providerId !== route.provider.id ||
      (route.model && result.modelId !== route.model.id)
    ) return { ok: false, error: 'provider-response-mismatch' }
    if (!input.validateOutput(result.output)) return { ok: false, error: 'provider-output-invalid' }
    return {
      ok: true,
      output: result.output,
      provider: route.provider,
      ...(route.model ? { model: route.model } : {}),
      estimatedCredits: route.estimatedCredits,
      ...(result.usage ? { usage: result.usage } : {}),
      fallback: route.fallback,
    }
  } catch (error) {
    return {
      ok: false,
      error: 'provider-execution-failed',
      detail: error instanceof Error ? error.message : 'unknown-provider-error',
    }
  }
}

export const BUILTIN_AI_PROVIDER_CATALOG: readonly AiProviderDescriptorV1[] = [
  {
    schemaVersion: 1,
    id: 'local-bridge',
    displayName: '本地免费模型',
    description: '通过 Astral Trace Local AI Bridge 使用 DM 电脑上的 Ollama、llama.cpp 或 whisper.cpp。',
    transport: 'local-bridge',
    status: 'unconfigured',
    dataBoundary: 'local-only',
    capabilities: ['text-generation', 'structured-output', 'vision', 'transcription', 'embedding', 'long-context', 'chinese'],
    supportedTasks: ['pdf-extraction', 'campaign-analysis', 'resource-structuring', 'map-analysis', 'transcription', 'session-summary', 'prep-recommendations'],
    pricing: {
      mode: 'free-local',
      creditsPerMillionInput: 0,
      creditsPerMillionOutput: 0,
      minimumCredits: 0,
    },
  },
  {
    schemaVersion: 1,
    id: 'astraltrace-cloud',
    displayName: 'Astral Trace 付费模型',
    description: '由平台托管的云端模型；执行前显示预计 AI Credit，并受单次额度限制。',
    transport: 'platform-server',
    status: 'unconfigured',
    dataBoundary: 'cloud-processing',
    capabilities: ['text-generation', 'structured-output', 'vision', 'transcription', 'embedding', 'long-context', 'chinese'],
    supportedTasks: ['pdf-extraction', 'campaign-analysis', 'resource-structuring', 'map-analysis', 'transcription', 'session-summary', 'prep-recommendations'],
    pricing: {
      mode: 'platform-credit',
      creditsPerMillionInput: 1_000,
      creditsPerMillionOutput: 4_000,
      minimumCredits: 1,
    },
  },
  {
    schemaVersion: 1,
    id: 'external-account',
    displayName: '使用自己的 API Key',
    description: '费用由 DM 的模型供应商账户承担；密钥只允许保存在服务端加密存储中。',
    transport: 'external-server',
    status: 'unconfigured',
    dataBoundary: 'cloud-processing',
    capabilities: ['text-generation', 'structured-output', 'vision', 'transcription', 'embedding', 'long-context', 'chinese'],
    supportedTasks: ['pdf-extraction', 'campaign-analysis', 'resource-structuring', 'map-analysis', 'transcription', 'session-summary', 'prep-recommendations'],
    pricing: {
      mode: 'external-account',
      creditsPerMillionInput: 0,
      creditsPerMillionOutput: 0,
      minimumCredits: 0,
    },
  },
]

export const DEFAULT_AI_PROVIDER_SELECTION: AiProviderSelectionV1 = {
  schemaVersion: 1,
  providerId: 'local-bridge',
  allowPaidFallback: false,
  maxCreditsPerTask: 0,
}
