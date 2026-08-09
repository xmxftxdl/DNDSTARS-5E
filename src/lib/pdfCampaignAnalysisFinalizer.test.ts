import { describe, expect, it } from 'vitest'
import type { ExtractedPdfDocumentV1, PdfCampaignAnalysisV1 } from './pdfCampaignAnalysis'
import { finalizePdfCampaignAnalysisV2 } from './pdfCampaignAnalysisFinalizer'
import { normalizePdfEvidenceText, pdfSha256 } from './pdfSourceEvidence'

async function fixture() {
  const text = '艾琳在暮钟旅馆为赤烛会收集情报。'
  const documentId = 'pdf_' + 'a'.repeat(24)
  const chunkId = `${documentId}:chunk:00001:test`
  const documents: ExtractedPdfDocumentV1[] = [{
    id: documentId,
    name: '模组.pdf',
    sha256: 'a'.repeat(64),
    sizeBytes: 100,
    pageCount: 1,
    extractedCharacters: text.length,
    scannedPages: [],
    pages: [{
      documentId, documentSha256: 'a'.repeat(64), documentName: '模组.pdf', page: 1, text,
      normalizedText: normalizePdfEvidenceText(text), textSha256: await pdfSha256(text), extractionMethod: 'pdf-text',
    }],
    chunks: [{
      id: chunkId, documentId, documentName: '模组.pdf', mimeType: 'application/pdf-text', text,
      pageStart: 1, pageEnd: 1, sourcePageNumbers: [1], textSha256: await pdfSha256(text), overlapCharacters: 0,
    }],
  }]
  const citation = { documentId, documentName: '模组.pdf', page: 1, quote: text, chunkId }
  const analysis: PdfCampaignAnalysisV1 = {
    schemaVersion: 1, overview: '测试', documents: [{ name: '模组.pdf', pageCount: 1, extractedCharacters: text.length, scannedPages: [] }],
    people: [{ name: '艾琳', aliases: ['灰羽女士'], description: '情报员', role: 'NPC', personality: '', motivation: '', secret: '', voice: '', citations: [citation] }],
    relationships: [{ from: '艾琳', to: '暮钟旅馆', type: '活动于', description: '', citations: [citation] }],
    locations: [{ name: '暮钟旅馆', description: '', citations: [citation] }], factions: [], clues: [], scenes: [], encounters: [], importCandidates: [], prepTips: [], warnings: [], analyzedChunks: 1,
  }
  return { documents, analysis }
}

describe('PDF V2 Host 最终化', () => {
  it('验证短引、生成稳定 ID，并且 Artifact 不包含页全文', async () => {
    const input = await fixture()
    const result = await finalizePdfCampaignAnalysisV2(input)
    expect(result.schemaVersion).toBe(2)
    expect(result.evidence).toHaveLength(1)
    expect(result.evidence[0]?.verification).toBe('exact')
    expect(result.people[0]).toMatchObject({ reviewStatus: 'auto-verified', aliases: ['灰羽女士'] })
    expect(result.relationships[0]).toMatchObject({ fromEntityId: result.people[0]?.id, toEntityId: result.locations[0]?.id })
    expect(JSON.stringify(result)).not.toContain('normalizedText')
  })

  it('删除虚构 quote，但保留条目并要求 DM 复核', async () => {
    const input = await fixture()
    input.analysis.people[0]!.citations[0]!.quote = '这句文字并不存在于原始 PDF 页面。'
    const result = await finalizePdfCampaignAnalysisV2(input)
    expect(result.people[0]).toMatchObject({ citations: [], evidenceIds: [], reviewStatus: 'needs-review' })
    expect(result.warnings.join(' ')).toContain('无法在本地 PDF 页文本中验证')
  })
})
