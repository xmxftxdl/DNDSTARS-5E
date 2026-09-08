import { describe, expect, it } from 'vitest'
import {
  aiJobTransitionAllowed,
  normalizeAiJobCreateRequestV2,
  normalizePdfCampaignAnalysisArtifact,
  normalizePdfCampaignAnalysisArtifactV1,
  normalizePdfCampaignAnalysisArtifactV2,
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

function analysisArtifactV2() {
  const documentId = `pdf_${'a'.repeat(24)}`
  const evidenceId = `ev_${'b'.repeat(24)}`
  const entityId = `entity_${'c'.repeat(24)}`
  const citation = {
    documentId, documentName: '冒险.pdf', page: 2, evidenceId,
    quote: '艾莉在暮钟旅馆秘密接待来客。', verification: 'exact',
  }
  return {
    schemaVersion: 2,
    kind: 'pdf-campaign-analysis',
    payload: {
      schemaVersion: 2,
      overview: '一份带可核验证据的战役草稿。',
      documents: [{
        id: documentId, name: '冒险.pdf', mimeType: 'application/pdf', sha256: 'a'.repeat(64),
        sizeBytes: 1_024, pageCount: 12, extractedCharacters: 1_000, scannedPages: [],
      }],
      evidence: [{
        id: evidenceId, documentId, documentName: '冒险.pdf', page: 2, chunkId: 'chunk-1',
        quote: citation.quote, normalizedQuoteSha256: 'b'.repeat(64), verification: 'exact',
      }],
      analyzedChunks: 2,
      people: [{
        id: entityId, aliases: [], evidenceIds: [evidenceId], confidence: 1, reviewStatus: 'auto-verified',
        name: '艾莉', description: '旅店主人', role: 'NPC', personality: '谨慎', motivation: '保护旅店',
        secret: '', voice: '平静', citations: [citation],
      }],
      relationships: [], locations: [], factions: [], clues: [], scenes: [], encounters: [], importCandidates: [], prepTips: [], warnings: [],
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

  it('接受 V2 证据链并继续兼容读取 V1', () => {
    expect(normalizePdfCampaignAnalysisArtifactV2(analysisArtifactV2())).not.toBeNull()
    expect(normalizePdfCampaignAnalysisArtifact(analysisArtifactV2())?.schemaVersion).toBe(2)
    expect(normalizePdfCampaignAnalysisArtifact(analysisArtifact())?.schemaVersion).toBe(1)
  })

  it('接受安全的短引书签，并拒绝整页原文或越界页码', () => {
    const base = structuredClone(analysisArtifactV2())
    const artifact = {
      ...base,
      payload: {
        ...base.payload,
        bookmarks: [{
          schemaVersion: 1,
          id: `bm_${'d'.repeat(24)}`,
          documentId: base.payload.documents[0]!.id,
          documentName: base.payload.documents[0]!.name,
          page: 2,
          kind: 'person',
          label: '艾莉首次登场',
          quote: '艾莉在暮钟旅馆秘密接待来客。',
          note: '准备旅店主人的声线。',
          origin: 'ai',
          entityId: base.payload.people[0]!.id,
          entityName: '艾莉',
          createdAt: 1,
        }],
      },
    }
    expect(normalizePdfCampaignAnalysisArtifactV2(artifact)).not.toBeNull()

    const oversized = structuredClone(artifact)
    oversized.payload.bookmarks[0]!.quote = '原'.repeat(501)
    expect(normalizePdfCampaignAnalysisArtifactV2(oversized)).toBeNull()

    const pageOverflow = structuredClone(artifact)
    pageOverflow.payload.bookmarks[0]!.page = 99
    expect(normalizePdfCampaignAnalysisArtifactV2(pageOverflow)).toBeNull()
  })

  it('拒绝悬空证据、越界页码和被夹带的 PDF 页全文', () => {
    const danglingEvidence = structuredClone(analysisArtifactV2())
    danglingEvidence.payload.people[0]!.evidenceIds = ['ev_missing']
    expect(normalizePdfCampaignAnalysisArtifactV2(danglingEvidence)).toBeNull()

    const pageOverflow = structuredClone(analysisArtifactV2())
    pageOverflow.payload.evidence[0]!.page = 13
    expect(normalizePdfCampaignAnalysisArtifactV2(pageOverflow)).toBeNull()

    const leakedSourceText = structuredClone(analysisArtifactV2()) as ReturnType<typeof analysisArtifactV2> & { payload: { sourcePages?: unknown } }
    leakedSourceText.payload.sourcePages = [{ text: '不应进入服务器 Artifact 的页全文' }]
    expect(normalizePdfCampaignAnalysisArtifactV2(leakedSourceText)).toBeNull()
  })

  it('拒绝悬空关系实体、非法 SHA-256 与重复 ID', () => {
    const danglingEntity = structuredClone(analysisArtifactV2())
    danglingEntity.payload.relationships.push({
      id: `rel_${'d'.repeat(24)}`,
      from: '艾莉',
      to: '不存在的实体',
      fromEntityId: danglingEntity.payload.people[0]!.id,
      toEntityId: `ent_${'e'.repeat(24)}`,
      type: '调查',
      description: '',
      citations: [danglingEntity.payload.people[0]!.citations[0]!],
      evidenceIds: [danglingEntity.payload.evidence[0]!.id],
      confidence: 1,
      reviewStatus: 'auto-verified',
    } as never)
    expect(normalizePdfCampaignAnalysisArtifactV2(danglingEntity)).toBeNull()

    const invalidSha = structuredClone(analysisArtifactV2())
    invalidSha.payload.documents[0]!.sha256 = 'not-a-sha256'
    expect(normalizePdfCampaignAnalysisArtifactV2(invalidSha)).toBeNull()

    const duplicateEvidence = structuredClone(analysisArtifactV2())
    duplicateEvidence.payload.evidence.push(structuredClone(duplicateEvidence.payload.evidence[0]!))
    expect(normalizePdfCampaignAnalysisArtifactV2(duplicateEvidence)).toBeNull()

    const duplicateEntity = structuredClone(analysisArtifactV2())
    duplicateEntity.payload.people.push(structuredClone(duplicateEntity.payload.people[0]!))
    expect(normalizePdfCampaignAnalysisArtifactV2(duplicateEntity)).toBeNull()
  })

  it('拒绝超过 Artifact 总字节上限的合法字段组合', () => {
    const oversized = structuredClone(analysisArtifactV2())
    const base = oversized.payload.people[0]!
    oversized.payload.people = Array.from({ length: 8 }, (_, index) => ({
      ...structuredClone(base),
      id: `entity_${String(index).padStart(24, '0')}`,
      portraitDataUrl: `data:image/png;base64,${'A'.repeat(399_000)}`,
    }))
    expect(normalizePdfCampaignAnalysisArtifactV2(oversized)).toBeNull()
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
