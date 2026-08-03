import { describe, expect, it } from 'vitest'
import {
  aiJobTransitionAllowed,
  normalizeAiJobCreateRequestV2,
  normalizePdfCampaignAnalysisArtifactV1,
  publicAiJobV2,
} from '../../shared/ai-job.mjs'

function analysisArtifact(citationPage = 2) {
  return {
    schemaVersion: 1,
    kind: 'pdf-campaign-analysis',
    payload: {
      schemaVersion: 1,
      overview: '一份可供 DM 审阅的战役草稿。',
      documents: [{ name: '冒险.pdf', pageCount: 12, extractedCharacters: 1000, scannedPages: [] }],
      analyzedChunks: 2,
      people: [{
        name: '艾莉', description: '旅店主人', role: 'NPC', personality: '谨慎', motivation: '保护旅店',
        secret: '', voice: '平静', citations: [{ documentName: '冒险.pdf', page: citationPage }],
      }],
      relationships: [],
      locations: [],
      factions: [],
      clues: [],
      scenes: [],
      encounters: [],
      importCandidates: [],
      prepTips: [],
      warnings: [],
    },
  }
}

describe('AI Job V2 协议', () => {
  it('接受本地 PDF 战役分析任务并拒绝越界字段', () => {
    const request = normalizeAiJobCreateRequestV2({
      schemaVersion: 2,
      taskKind: 'campaign-analysis',
      executionMode: 'local-runner',
      providerId: 'local-bridge',
      modelId: 'qwen3.5:35b',
      promptVersion: 'pdf-campaign-analysis-v2',
      idempotencyKey: 'pdf-test-request-0001',
      sourceAssets: [{ assetId: 'pdf-1', name: '冒险.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }],
      input: { depth: 'deep' },
    })
    expect(request).toMatchObject({ executionMode: 'local-runner', modelId: 'qwen3.5:35b' })
    expect(normalizeAiJobCreateRequestV2({ ...request, sourceAssets: [] })).toBeNull()
    expect(normalizeAiJobCreateRequestV2({ ...request, executionMode: 'arbitrary-js' })).toBeNull()
  })

  it('校验引用页码，并阻止 AI 伪造不存在的 PDF 页面', () => {
    expect(normalizePdfCampaignAnalysisArtifactV1(analysisArtifact(12))).not.toBeNull()
    expect(normalizePdfCampaignAnalysisArtifactV1(analysisArtifact(13))).toBeNull()
  })

  it('只允许单向状态迁移并从公开结果移除租约密钥', () => {
    expect(aiJobTransitionAllowed('awaiting-local-runner', 'running')).toBe(true)
    expect(aiJobTransitionAllowed('review-required', 'completed')).toBe(true)
    expect(aiJobTransitionAllowed('completed', 'running')).toBe(false)

    const now = Date.now()
    const job = {
      ...normalizeAiJobCreateRequestV2({
        schemaVersion: 2,
        taskKind: 'campaign-analysis',
        executionMode: 'local-runner',
        providerId: 'local-bridge',
        modelId: 'qwen3.5:35b',
        promptVersion: 'pdf-campaign-analysis-v2',
        idempotencyKey: 'pdf-test-request-0002',
        sourceAssets: [{ assetId: 'pdf-1', name: '冒险.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }],
        input: { depth: 'deep' },
      }),
      jobId: '8f9cdb55-a9c8-438c-b7ae-f683602934ad',
      accountId: 'ABCDEFGHJKLM',
      campaignId: 'MNPQRSTUV234',
      status: 'running',
      revision: 2,
      progress: { stage: 'running', current: 1, total: 2, message: '分析中' },
      lease: { tokenHash: 'secret-hash', runnerId: 'browser-runner-1', acquiredAt: now, expiresAt: now + 1000 },
      artifact: null,
      failure: null,
      createdAt: now,
      updatedAt: now,
    }
    expect(publicAiJobV2(job)?.lease).toEqual({
      runnerId: 'browser-runner-1', acquiredAt: now, expiresAt: now + 1000,
    })
    expect(publicAiJobV2(job)?.lease).not.toHaveProperty('tokenHash')
  })
})
