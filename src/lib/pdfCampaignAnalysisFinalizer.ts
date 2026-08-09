import type {
  ExtractedPdfDocumentV1,
  PdfCampaignAnalysisV1,
  PdfNamedRecordV1,
  PdfPrepTipV1,
  PdfRelationshipRecordV1,
  PdfSourceCitationV1,
} from './pdfCampaignAnalysis'
import type {
  PdfCampaignAnalysisV2,
  PdfDocumentRecordV2,
  PdfEntityKindV2,
  PdfNamedRecordV2,
  PdfPrepTipV2,
  PdfRelationshipRecordV2,
  PdfSourceCitationV2,
  PdfSourceEvidenceV2,
  PdfSourcePageV2,
} from './pdfCampaignAnalysisV2'
import {
  createStablePdfEntityId,
  createStablePdfRelationshipId,
  disambiguatePdfEntityIds,
  disambiguatePdfRelationshipIds,
  resolvePdfRelationshipEndpoints,
  stablePdfIdentityHash,
} from './pdfKnowledgeIdentity'
import { verifyPdfEvidenceCandidate } from './pdfSourceEvidence'

function legacySha(document: ExtractedPdfDocumentV1): string {
  const part = stablePdfIdentityHash(`${document.id}|${document.name}|${document.pageCount}`)
  return `${part}${part}${part}`.slice(0, 64)
}

function documentRecord(document: ExtractedPdfDocumentV1): PdfDocumentRecordV2 {
  return {
    id: document.id,
    name: document.name,
    mimeType: 'application/pdf',
    sha256: document.sha256 ?? legacySha(document),
    sizeBytes: document.sizeBytes ?? 0,
    pageCount: document.pageCount,
    extractedCharacters: document.extractedCharacters,
    scannedPages: [...document.scannedPages],
    ...(document.ocrPages ? { ocrPages: [...document.ocrPages] } : {}),
    ...(document.unresolvedPages ? { unresolvedPages: [...document.unresolvedPages] } : {}),
  }
}

type EvidenceCollector = {
  evidence: Map<string, PdfSourceEvidenceV2>
  invalid: number
  citation(value: PdfSourceCitationV1): Promise<PdfSourceCitationV2 | null>
}

function createEvidenceCollector(documents: readonly ExtractedPdfDocumentV1[]): EvidenceCollector {
  const pages = new Map<string, PdfSourcePageV2>()
  const chunksByDocument = new Map<string, ExtractedPdfDocumentV1['chunks']>()
  for (const document of documents) {
    for (const page of document.pages ?? []) pages.set(`${page.documentId}|${page.page}`, page)
    chunksByDocument.set(document.id, document.chunks)
  }
  const collector: EvidenceCollector = {
    evidence: new Map(),
    invalid: 0,
    async citation(value) {
      if (!value.documentId || !value.quote) {
        collector.invalid += 1
        return null
      }
      const page = pages.get(`${value.documentId}|${value.page}`)
      if (!page) {
        collector.invalid += 1
        return null
      }
      const chunk = (chunksByDocument.get(value.documentId) ?? []).find((entry) => (
        entry.id === value.chunkId && value.page >= (entry.pageStart ?? 1) && value.page <= (entry.pageEnd ?? entry.pageStart ?? 1)
      )) ?? (chunksByDocument.get(value.documentId) ?? []).find((entry) => (
        value.page >= (entry.pageStart ?? 1) && value.page <= (entry.pageEnd ?? entry.pageStart ?? 1)
      ))
      if (!chunk) {
        collector.invalid += 1
        return null
      }
      const verified = await verifyPdfEvidenceCandidate({
        candidate: {
          documentId: value.documentId,
          documentName: value.documentName,
          page: value.page,
          quote: value.quote,
          chunkId: chunk.id,
        },
        page,
        chunkId: chunk.id,
      })
      if (!verified) {
        collector.invalid += 1
        return null
      }
      collector.evidence.set(verified.id, verified)
      return {
        documentId: verified.documentId,
        documentName: verified.documentName,
        page: verified.page,
        evidenceId: verified.id,
        quote: verified.quote,
        verification: verified.verification,
        ...(verified.sourceExtractionMethod ? { sourceExtractionMethod: verified.sourceExtractionMethod } : {}),
        ...(verified.sourceConfidence != null ? { sourceConfidence: verified.sourceConfidence } : {}),
        ...(verified.pageRegion ? { pageRegion: verified.pageRegion } : {}),
      }
    },
  }
  return collector
}

async function verifiedCitations(
  citations: readonly PdfSourceCitationV1[],
  collector: EvidenceCollector,
): Promise<PdfSourceCitationV2[]> {
  const values = await Promise.all(citations.map((citation) => collector.citation(citation)))
  const unique = new Map(values.flatMap((citation) => citation ? [[citation.evidenceId, citation] as const] : []))
  return [...unique.values()].slice(0, 8)
}

async function finalizeNamed<T extends PdfNamedRecordV1>(
  record: T,
  kind: PdfEntityKindV2,
  collector: EvidenceCollector,
): Promise<T & PdfNamedRecordV2> {
  const citations = await verifiedCitations(record.citations, collector)
  const evidenceIds = citations.map((citation) => citation.evidenceId)
  const firstEvidence = collector.evidence.get(evidenceIds[0] ?? '')
  return {
    ...record,
    id: createStablePdfEntityId({ kind, name: record.name, firstEvidence }),
    aliases: [...new Set(record.aliases ?? [])].slice(0, 8),
    citations,
    evidenceIds,
    confidence: evidenceIds.length > 0
      ? Math.min(...citations.map((citation) => citation.sourceConfidence ?? 1))
      : 0.25,
    reviewStatus: evidenceIds.length > 0 ? 'auto-verified' : 'needs-review',
  }
}

async function finalizeRelationship(
  record: PdfRelationshipRecordV1,
  collector: EvidenceCollector,
): Promise<PdfRelationshipRecordV2> {
  const citations = await verifiedCitations(record.citations, collector)
  const value: PdfRelationshipRecordV2 = {
    ...record,
    id: '',
    citations,
    evidenceIds: citations.map((citation) => citation.evidenceId),
    confidence: citations.length > 0
      ? Math.min(...citations.map((citation) => citation.sourceConfidence ?? 1))
      : 0.25,
    reviewStatus: citations.length > 0 ? 'auto-verified' : 'needs-review',
  }
  return { ...value, id: createStablePdfRelationshipId(value) }
}

async function finalizePrepTip(tip: PdfPrepTipV1, collector: EvidenceCollector): Promise<PdfPrepTipV2> {
  const citations = await verifiedCitations(tip.citations, collector)
  const evidenceIds = citations.map((citation) => citation.evidenceId)
  return {
    ...tip,
    id: createStablePdfEntityId({
      kind: 'prep-tip',
      name: tip.title,
      firstEvidence: collector.evidence.get(evidenceIds[0] ?? ''),
    }),
    aliases: [],
    citations,
    evidenceIds,
    confidence: evidenceIds.length > 0
      ? Math.min(...citations.map((citation) => citation.sourceConfidence ?? 1))
      : 0.25,
    reviewStatus: evidenceIds.length > 0 ? 'auto-verified' : 'needs-review',
  }
}

export async function finalizePdfCampaignAnalysisV2(input: {
  analysis: PdfCampaignAnalysisV1
  documents: readonly ExtractedPdfDocumentV1[]
}): Promise<PdfCampaignAnalysisV2> {
  const collector = createEvidenceCollector(input.documents)
  const people = disambiguatePdfEntityIds(await Promise.all(input.analysis.people.map((entry) => finalizeNamed(entry, 'person', collector))))
  const locations = disambiguatePdfEntityIds(await Promise.all(input.analysis.locations.map((entry) => finalizeNamed(entry, 'location', collector))))
  const factions = disambiguatePdfEntityIds(await Promise.all(input.analysis.factions.map((entry) => finalizeNamed(entry, 'faction', collector))))
  const relationships = disambiguatePdfRelationshipIds(await Promise.all(input.analysis.relationships.map((entry) => finalizeRelationship(entry, collector))))
  const resolvedRelationships = resolvePdfRelationshipEndpoints({ people, locations, factions, relationships })
  const result: PdfCampaignAnalysisV2 = {
    schemaVersion: 2,
    documents: input.documents.map(documentRecord),
    evidence: [],
    overview: input.analysis.overview,
    people,
    relationships: resolvedRelationships,
    locations,
    factions,
    clues: disambiguatePdfEntityIds(await Promise.all(input.analysis.clues.map((entry) => finalizeNamed(entry, 'clue', collector)))),
    scenes: disambiguatePdfEntityIds(await Promise.all(input.analysis.scenes.map((entry) => finalizeNamed(entry, 'scene', collector)))),
    encounters: disambiguatePdfEntityIds(await Promise.all(input.analysis.encounters.map((entry) => finalizeNamed(entry, 'encounter', collector)))),
    importCandidates: disambiguatePdfEntityIds(await Promise.all(input.analysis.importCandidates.map((entry) => finalizeNamed(entry, 'import-candidate', collector)))),
    prepTips: disambiguatePdfEntityIds(await Promise.all(input.analysis.prepTips.map((entry) => finalizePrepTip(entry, collector)))),
    warnings: [...input.analysis.warnings],
    analyzedChunks: input.analysis.analyzedChunks,
    ...(input.analysis.analysisDepth ? { analysisDepth: input.analysis.analysisDepth } : {}),
    ...(input.analysis.analysisPasses != null ? { analysisPasses: input.analysis.analysisPasses } : {}),
    ...(input.analysis.modelRouting ? { modelRouting: input.analysis.modelRouting } : {}),
  }
  result.evidence = [...collector.evidence.values()]
  if (collector.invalid > 0) {
    result.warnings = [...new Set([
      ...result.warnings,
      `Host 已移除 ${collector.invalid} 条无法在本地 PDF 页文本中验证的候选引用；相关条目已标记为需要 DM 复核。`,
    ])]
  }
  return result
}
