import type {
  AiJobCreateRequestV2,
  AiJobRecordV2,
  PdfCampaignAnalysisArtifactV1,
} from '../../shared/ai-job.mjs'
import { sharedLobbyApiCandidates } from './sharedApi'
import { getAccountSession } from './accountSession'
import { AccountApiError } from './accountApi'

export type PublicAiJobV2 = Omit<AiJobRecordV2, 'lease'> & {
  lease: null | { runnerId: string; acquiredAt: number; expiresAt: number }
}

async function aiJobRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getAccountSession()
  let reachedServer = false
  for (const api of sharedLobbyApiCandidates()) {
    try {
      const response = await fetch(`${api}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'X-Stars-Account-Token': session.sessionToken } : {}),
          ...(init?.headers ?? {}),
        },
      })
      reachedServer = true
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (response.ok) return body as T
      throw new AccountApiError(body.error ?? 'ai-job-request-failed', response.status)
    } catch (error) {
      if (error instanceof AccountApiError) throw error
      void error
    }
  }
  throw new AccountApiError(reachedServer ? 'ai-job-request-failed' : 'server-unavailable', 0)
}

function campaignJobsPath(campaignId: string): string {
  return `/accounts/me/campaigns/${encodeURIComponent(campaignId)}/ai-jobs`
}

function campaignJobPath(campaignId: string, jobId: string, action?: string): string {
  return `${campaignJobsPath(campaignId)}/${encodeURIComponent(jobId)}${action ? `/${action}` : ''}`
}

export async function createCampaignAiJob(
  campaignId: string,
  request: AiJobCreateRequestV2,
): Promise<{ job: PublicAiJobV2; reused: boolean }> {
  return aiJobRequest(campaignJobsPath(campaignId), {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function listCampaignAiJobs(
  campaignId: string,
  includeArtifact = false,
): Promise<PublicAiJobV2[]> {
  const response = await aiJobRequest<{ jobs: PublicAiJobV2[] }>(
    `${campaignJobsPath(campaignId)}${includeArtifact ? '?includeArtifact=1' : ''}`,
    { method: 'GET' },
  )
  return Array.isArray(response.jobs) ? response.jobs : []
}

export async function loadCampaignAiJob(campaignId: string, jobId: string): Promise<PublicAiJobV2> {
  const response = await aiJobRequest<{ job: PublicAiJobV2 }>(campaignJobPath(campaignId, jobId), { method: 'GET' })
  return response.job
}

export async function leaseCampaignAiJob(
  campaignId: string,
  jobId: string,
  expectedRevision: number,
  runnerId: string,
  takeoverOwnedLease = false,
): Promise<{ job: PublicAiJobV2; leaseToken: string }> {
  return aiJobRequest(campaignJobPath(campaignId, jobId, 'lease'), {
    method: 'POST',
    body: JSON.stringify({ expectedRevision, runnerId, takeoverOwnedLease }),
  })
}

export async function submitCampaignAiJobResult(
  campaignId: string,
  jobId: string,
  expectedRevision: number,
  leaseToken: string,
  artifact: PdfCampaignAnalysisArtifactV1,
): Promise<PublicAiJobV2> {
  const response = await aiJobRequest<{ job: PublicAiJobV2 }>(campaignJobPath(campaignId, jobId, 'result'), {
    method: 'POST',
    body: JSON.stringify({ expectedRevision, leaseToken, artifact }),
  })
  return response.job
}

export async function updateCampaignAiJobProgress(
  campaignId: string,
  jobId: string,
  expectedRevision: number,
  leaseToken: string,
  progress: { stage: string; current: number; total: number; message: string },
): Promise<PublicAiJobV2> {
  const response = await aiJobRequest<{ job: PublicAiJobV2 }>(campaignJobPath(campaignId, jobId, 'progress'), {
    method: 'POST',
    body: JSON.stringify({ expectedRevision, leaseToken, progress }),
  })
  return response.job
}

export async function failCampaignAiJob(
  campaignId: string,
  jobId: string,
  expectedRevision: number,
  leaseToken: string,
  failure: { code: string; message: string },
): Promise<PublicAiJobV2> {
  const response = await aiJobRequest<{ job: PublicAiJobV2 }>(campaignJobPath(campaignId, jobId, 'failure'), {
    method: 'POST',
    body: JSON.stringify({ expectedRevision, leaseToken, failure }),
  })
  return response.job
}

export async function updateCampaignAiJobArtifact(
  campaignId: string,
  jobId: string,
  expectedRevision: number,
  artifact: PdfCampaignAnalysisArtifactV1,
): Promise<PublicAiJobV2> {
  const response = await aiJobRequest<{ job: PublicAiJobV2 }>(campaignJobPath(campaignId, jobId, 'artifact'), {
    method: 'PUT',
    body: JSON.stringify({ expectedRevision, artifact }),
  })
  return response.job
}

export async function cancelCampaignAiJob(
  campaignId: string,
  jobId: string,
  expectedRevision: number,
): Promise<PublicAiJobV2> {
  const response = await aiJobRequest<{ job: PublicAiJobV2 }>(campaignJobPath(campaignId, jobId, 'cancel'), {
    method: 'POST',
    body: JSON.stringify({ expectedRevision }),
  })
  return response.job
}

export async function deleteCampaignAiJob(
  campaignId: string,
  jobId: string,
  expectedRevision: number,
): Promise<void> {
  await aiJobRequest<{ deleted: true; jobId: string }>(campaignJobPath(campaignId, jobId), {
    method: 'DELETE',
    body: JSON.stringify({ expectedRevision }),
  })
}

const RUNNER_ID_KEY = 'astral-trace-local-ai-runner:v1'

export function localAiRunnerId(): string {
  try {
    const current = localStorage.getItem(RUNNER_ID_KEY)
    if (current && /^[a-zA-Z0-9_-]{12,160}$/.test(current)) return current
    const created = `browser-${crypto.randomUUID()}`
    localStorage.setItem(RUNNER_ID_KEY, created)
    return created
  } catch {
    return `browser-${crypto.randomUUID()}`
  }
}

export function aiJobApiErrorMessage(error: unknown): string {
  const code = error instanceof AccountApiError ? error.code : error instanceof Error ? error.message : String(error)
  const messages: Record<string, string> = {
    'invalid-account-session': '账号登录已失效，请重新登录后继续。',
    'account-campaign-not-found': '当前战役不存在，或不属于这个账号。',
    'invalid-ai-job-request': 'AI 任务参数未通过服务器校验。',
    'ai-provider-not-configured': '所选云端模型尚未配置，请配置自己的模型 API，或等待 Astral Trace 付费模型开放。',
    'ai-job-limit': '当前战役保留的 AI 任务已达到上限。',
    'ai-job-revision-conflict': '任务已在其他页面更新，请刷新后重试。',
    'ai-job-not-found': '这条 AI 任务已经被删除，请刷新任务列表。',
    'ai-job-not-leasable': '任务已被其他本地执行器接管或已经结束。',
    'ai-job-active': '任务仍在执行中，请先取消任务，等待当前请求结束后再删除。',
    'invalid-ai-job-lease': '本地执行租约已失效，请重新开始分析。',
    'invalid-ai-job-artifact': '分析结果未通过服务器结构与引用校验。',
    'ai-job-source-mismatch': '重新接管任务时必须选择与原任务相同的 PDF。',
    'external-model-not-found': '本地 Bridge 尚未配置所选的自有模型 API。',
    'server-unavailable': '无法连接 Astral Trace 服务端。',
  }
  return messages[code] ?? `AI 任务失败：${code}`
}
