export type AiProviderTransportV1 = 'local-bridge' | 'platform-server' | 'external-server'
export type AiProviderStatusV1 = 'ready' | 'offline' | 'unconfigured' | 'disabled'
export type AiProviderDataBoundaryV1 = 'local-only' | 'cloud-processing'
export type AiProviderBillingModeV1 = 'free-local' | 'platform-credit' | 'external-account'
export type AiTaskKindV1 =
  | 'pdf-extraction'
  | 'campaign-analysis'
  | 'resource-structuring'
  | 'map-analysis'
  | 'transcription'
  | 'session-summary'
  | 'prep-recommendations'
export type AiCapabilityV1 =
  | 'text-generation'
  | 'structured-output'
  | 'vision'
  | 'transcription'
  | 'embedding'
  | 'long-context'
  | 'chinese'

export interface AiProviderPricingV1 {
  mode: AiProviderBillingModeV1
  creditsPerMillionInput: number
  creditsPerMillionOutput: number
  minimumCredits: number
}

export interface AiProviderDescriptorV1 {
  schemaVersion: 1
  id: string
  displayName: string
  description: string
  transport: AiProviderTransportV1
  status: AiProviderStatusV1
  dataBoundary: AiProviderDataBoundaryV1
  capabilities: AiCapabilityV1[]
  supportedTasks: AiTaskKindV1[]
  pricing: AiProviderPricingV1
}

export interface AiModelDescriptorV1 {
  schemaVersion: 1
  providerId: string
  id: string
  displayName: string
  contextWindowTokens: number
  capabilities: AiCapabilityV1[]
  supportedTasks: AiTaskKindV1[]
}

export interface AiProviderSelectionV1 {
  schemaVersion: 1
  providerId: string
  modelId?: string
  allowPaidFallback: boolean
  maxCreditsPerTask: number
}

export type JsonSchemaV1 = Record<string, unknown>
export interface AiDocumentChunkV1 {
  id: string
  documentName: string
  mimeType: string
  text: string
  pageStart?: number
  pageEnd?: number
}
export interface AiImageInputV1 {
  id: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  dataUrl: string
}
export interface AiStructuredGenerationRequestV1 {
  schemaVersion: 1
  jobId: string
  task: Exclude<AiTaskKindV1, 'transcription'>
  systemPrompt: string
  userPrompt: string
  outputSchema: JsonSchemaV1
  /** Host-controlled upper bound. Providers must clamp this to their own task cap. */
  maxOutputTokens?: number
  documents?: AiDocumentChunkV1[]
  images?: AiImageInputV1[]
}

export const AI_PROVIDER_SCHEMA_VERSION: 1
export const AI_PROVIDER_SELECTION_SCHEMA_VERSION: 1

export function normalizeAiProviderDescriptor(value: unknown):
  | { ok: true; value: AiProviderDescriptorV1 }
  | { ok: false; error: string }
export function normalizeAiModelDescriptor(value: unknown):
  | { ok: true; value: AiModelDescriptorV1 }
  | { ok: false; error: string }
export function normalizeAiProviderSelection(value: unknown):
  | { ok: true; value: AiProviderSelectionV1 }
  | { ok: false; error: string }
export function normalizeAiStructuredGenerationRequest(value: unknown):
  | { ok: true; value: AiStructuredGenerationRequestV1 }
  | { ok: false; error: string }
export function aiTaskRequiredCapabilities(task: AiTaskKindV1): AiCapabilityV1[]
export function estimateAiProviderCredits(
  provider: AiProviderDescriptorV1,
  inputTokens: number,
  outputTokens: number,
): number
export function selectAiProvider(input: {
  providers: readonly AiProviderDescriptorV1[]
  models?: readonly AiModelDescriptorV1[]
  selection: AiProviderSelectionV1
  task: AiTaskKindV1
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
}):
  | {
      ok: true
      provider: AiProviderDescriptorV1
      model?: AiModelDescriptorV1
      estimatedCredits: number
      fallback: boolean
    }
  | { ok: false; error: string }
