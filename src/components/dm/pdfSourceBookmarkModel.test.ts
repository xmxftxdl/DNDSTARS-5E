import { describe, expect, it } from 'vitest'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import { buildPdfSourceBookmarkSuggestions, pdfSourceDocuments } from './pdfSourceBookmarkModel'

function fixture(): PdfCampaignAnalysisV2 {
  const documentId = `pdf_${'a'.repeat(24)}`
  const evidenceId = `ev_${'b'.repeat(24)}`
  const citation = { documentId, documentName: '冒险.pdf', page: 3, evidenceId, quote: '艾莉站在暮钟旅馆的门前。', verification: 'exact' as const }
  return {
    schemaVersion: 2,
    documents: [{ id: documentId, name: '冒险.pdf', mimeType: 'application/pdf', sha256: 'a'.repeat(64), sizeBytes: 100, pageCount: 10, extractedCharacters: 1000, scannedPages: [] }],
    evidence: [{ id: evidenceId, documentId, documentName: '冒险.pdf', page: 3, chunkId: 'chunk-1', quote: citation.quote, normalizedQuoteSha256: 'b'.repeat(64), verification: 'exact' }],
    overview: '', relationships: [], locations: [], factions: [], clues: [], timelineEvents: [], scenes: [], encounters: [], importCandidates: [], prepTips: [], warnings: [], analyzedChunks: 1,
    people: [{ id: `ent_${'c'.repeat(24)}`, aliases: [], evidenceIds: [evidenceId], confidence: 1, reviewStatus: 'auto-verified', name: '艾莉', description: '旅店主人', role: 'NPC', personality: '', motivation: '', secret: '', voice: '', citations: [citation] }],
  }
}

describe('PDF 原文书签模型', () => {
  it('把 V2 AI 实体证据转换为可确认的人物书签', () => {
    const analysis = fixture()
    expect(pdfSourceDocuments(analysis)).toHaveLength(1)
    expect(buildPdfSourceBookmarkSuggestions(analysis)).toEqual([
      expect.objectContaining({ kind: 'person', label: '艾莉', page: 3, quote: '艾莉站在暮钟旅馆的门前。', origin: 'ai' }),
    ])
  })

  it('不把缺少本机证据定位的 V1 引用伪装为可打开书签', () => {
    const analysis = fixture()
    analysis.people[0]!.citations = [{ documentName: '冒险.pdf', page: 3 } as never]
    expect(buildPdfSourceBookmarkSuggestions(analysis)).toEqual([])
  })
})
