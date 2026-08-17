export const AI_MODEL_POLICY_VERSION: 1
export const AI_MODEL_POLICY: Readonly<{
  providerId: 'external-account'
  generalModelId: 'gpt-5.6-luna'
  pdfExtractionModelId: 'gpt-5.6-luna'
  pdfSynthesisModelId: 'gpt-5.6-sol'
  imageModelId: 'gpt-image-2'
  imageQuality: 'low'
}>

export interface AiCreditPolicyV1 {
  creditsPerCny: number
  estimateSafetyMultiplier: number
  reservationBlockCredits: number
  textRates: Record<string, { inputPerMillion: number; outputPerMillion: number }>
  imageRates: Record<string, number>
}

export interface AiBillingRecordV1 {
  schemaVersion: 1
  auditId: string
  jobId?: string
  task: string
  providerId: string
  modelId: string
  startedAt: number
  completedAt: number
  durationMs: number
  status: 'completed' | 'failed' | 'cancelled'
  inputTokens: number
  outputTokens: number
  estimatedCredits: number
  reservedCredits: number
  actualCredits: number
  refundedCredits: number
  overageCredits: number
  estimatedCny: number
  actualCny: number
  quality?: 'low'
  errorCode?: string
}

export const AI_CREDIT_POLICY: Readonly<AiCreditPolicyV1>
export function upstreamModelId(modelId: unknown): string
export function bridgeModelId(role: 'general' | 'extraction' | 'synthesis', modelId: unknown): string
export function fixedBridgeModelIdForTask(task: string, phase?: 'general' | 'pdf-extraction' | 'pdf-synthesis'): string
export function modelCreditRate(modelId: unknown, policy?: AiCreditPolicyV1): { inputPerMillion: number; outputPerMillion: number }
export function textCredits(input: { modelId: string; inputTokens: number; outputTokens: number; conservative?: boolean }, policy?: AiCreditPolicyV1): number
export function imageCredits(input: { modelId: string; quality?: string }, policy?: AiCreditPolicyV1): number
export function reserveCredits(estimatedCredits: number, policy?: AiCreditPolicyV1): number
export function creditCny(credits: number, policy?: AiCreditPolicyV1): number
