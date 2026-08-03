export const AI_JOB_SCHEMA_VERSION: 2
export const AI_JOB_ARTIFACT_SCHEMA_VERSION: 1
export const AI_JOB_MAX_PER_CAMPAIGN: 40
export const AI_JOB_LOCAL_LEASE_MS: number
export const AI_JOB_ARTIFACT_MAX_BYTES: number

export type AiJobStatusV2 =
  | 'queued'
  | 'awaiting-local-runner'
  | 'running'
  | 'validating'
  | 'review-required'
  | 'completed'
  | 'failed'
  | 'cancelled'
export type AiJobExecutionModeV2 = 'local-runner' | 'platform-server' | 'external-server'
export type AiJobTaskKindV2 =
  | 'pdf-extraction'
  | 'campaign-analysis'
  | 'resource-structuring'
  | 'map-analysis'
  | 'transcription'
  | 'session-summary'
  | 'prep-recommendations'

export interface AiJobSourceAssetV2 {
  assetId: string
  name: string
  mimeType: string
  sizeBytes: number
  pageCount?: number
  sha256?: string
}

export interface AiJobCreateRequestV2 {
  schemaVersion: 2
  taskKind: AiJobTaskKindV2
  executionMode: AiJobExecutionModeV2
  providerId: string
  modelId: string
  promptVersion: string
  idempotencyKey: string
  sourceAssets: AiJobSourceAssetV2[]
  input: Record<string, unknown>
}

export interface PdfCampaignAnalysisArtifactV1 {
  schemaVersion: 1
  kind: 'pdf-campaign-analysis'
  payload: Record<string, unknown>
  sourceHash?: string
}

export interface AiJobRecordV2 extends AiJobCreateRequestV2 {
  jobId: string
  accountId: string
  campaignId: string
  status: AiJobStatusV2
  revision: number
  progress: { stage: string; current: number; total: number; message: string }
  lease: null | { tokenHash: string; runnerId: string; acquiredAt: number; expiresAt: number }
  artifact: PdfCampaignAnalysisArtifactV1 | null
  failure: null | { code: string; message: string }
  createdAt: number
  updatedAt: number
  resultAt?: number
  completedAt?: number
}

export const AI_JOB_STATUSES: readonly AiJobStatusV2[]
export function normalizeAiJobCreateRequestV2(value: unknown): AiJobCreateRequestV2 | null
export function normalizeAiJobRecordV2(value: unknown): AiJobRecordV2 | null
export function normalizePdfCampaignAnalysisArtifactV1(value: unknown): PdfCampaignAnalysisArtifactV1 | null
export function aiJobTransitionAllowed(from: AiJobStatusV2, to: AiJobStatusV2): boolean
export function publicAiJobV2(value: unknown, includeArtifact?: boolean): Omit<AiJobRecordV2, 'lease'> & {
  lease: null | { runnerId: string; acquiredAt: number; expiresAt: number }
}
