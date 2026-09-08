import type { PdfSourceCitationV1 } from '../../lib/pdfCampaignAnalysis'
import type {
  PdfCampaignAnalysisView,
  PdfDocumentRecordV2,
  PdfSourceBookmarkKindV1,
  PdfSourceBookmarkV1,
} from '../../lib/pdfCampaignAnalysisV2'
import { stablePdfIdentityHash } from '../../lib/pdfKnowledgeIdentity'
import { isPdfSourceCitationV2 } from './pdfSourceEvidenceViewModel'

export interface PdfSourceBookmarkSuggestionV1 extends PdfSourceBookmarkV1 {
  origin: 'ai'
}

type SuggestionRecord = {
  kind: PdfSourceBookmarkKindV1
  label: string
  note: string
  entityId?: string
  citations: readonly PdfSourceCitationV1[]
}

export const PDF_SOURCE_BOOKMARK_KIND_LABELS: Record<PdfSourceBookmarkKindV1, string> = {
  person: '人物',
  location: '地点',
  faction: '组织／势力',
  clue: '线索',
  event: '事件',
  monster: '怪物',
  note: '笔记',
}

export function pdfSourceDocuments(analysis: PdfCampaignAnalysisView): PdfDocumentRecordV2[] {
  return analysis.documents.filter((document): document is PdfDocumentRecordV2 => (
    typeof (document as Partial<PdfDocumentRecordV2>).id === 'string' &&
    typeof (document as Partial<PdfDocumentRecordV2>).sha256 === 'string'
  ))
}

export function createPdfSourceBookmark(input: Omit<PdfSourceBookmarkV1, 'schemaVersion' | 'id' | 'createdAt'> & {
  idSeed?: string
  createdAt?: number
}): PdfSourceBookmarkV1 {
  const createdAt = input.createdAt ?? Date.now()
  const idSeed = input.idSeed ?? `${input.documentId}|${input.page}|${input.kind}|${input.label}|${createdAt}`
  return {
    schemaVersion: 1,
    id: `bm_${stablePdfIdentityHash(idSeed)}`,
    documentId: input.documentId,
    documentName: input.documentName,
    page: input.page,
    kind: input.kind,
    label: input.label.trim().slice(0, 160),
    quote: input.quote.trim().slice(0, 500),
    note: input.note.trim().slice(0, 2_000),
    origin: input.origin,
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.entityName ? { entityName: input.entityName } : {}),
    createdAt,
  }
}

export function pdfSourceBookmarkKey(bookmark: Pick<PdfSourceBookmarkV1, 'documentId' | 'page' | 'kind' | 'entityId' | 'entityName' | 'label'>): string {
  return [bookmark.documentId, bookmark.page, bookmark.kind, bookmark.entityId ?? '', bookmark.entityName ?? bookmark.label].join('|')
}

export function buildPdfSourceBookmarkSuggestions(analysis: PdfCampaignAnalysisView): PdfSourceBookmarkSuggestionV1[] {
  const records: SuggestionRecord[] = [
    ...analysis.people.map((entry) => ({ kind: 'person' as const, label: entry.name, note: entry.description || entry.role, entityId: 'id' in entry ? `${entry.id}` : undefined, citations: entry.citations })),
    ...analysis.locations.map((entry) => ({ kind: 'location' as const, label: entry.name, note: entry.description, entityId: 'id' in entry ? `${entry.id}` : undefined, citations: entry.citations })),
    ...analysis.factions.map((entry) => ({ kind: 'faction' as const, label: entry.name, note: entry.description, entityId: 'id' in entry ? `${entry.id}` : undefined, citations: entry.citations })),
    ...analysis.clues.map((entry) => ({ kind: 'clue' as const, label: entry.name, note: entry.description, entityId: 'id' in entry ? `${entry.id}` : undefined, citations: entry.citations })),
    ...(analysis.timelineEvents ?? analysis.scenes).map((entry) => ({ kind: 'event' as const, label: entry.name, note: entry.description, entityId: 'id' in entry ? `${entry.id}` : undefined, citations: entry.citations })),
    ...analysis.importCandidates.filter((entry) => entry.kind === 'monster').map((entry) => ({ kind: 'monster' as const, label: entry.name, note: entry.description, entityId: 'id' in entry ? `${entry.id}` : undefined, citations: entry.citations })),
  ]
  const seen = new Set<string>()
  const suggestions: PdfSourceBookmarkSuggestionV1[] = []
  for (const record of records) {
    for (const citation of record.citations) {
      if (!isPdfSourceCitationV2(citation) || citation.verification === 'legacy') continue
      const bookmark = createPdfSourceBookmark({
        documentId: citation.documentId,
        documentName: citation.documentName,
        page: citation.page,
        kind: record.kind,
        label: record.label,
        quote: citation.quote,
        note: record.note,
        origin: 'ai',
        entityId: record.entityId,
        entityName: record.label,
        idSeed: `ai|${record.kind}|${record.entityId ?? record.label}|${citation.documentId}|${citation.page}`,
        createdAt: 1,
      }) as PdfSourceBookmarkSuggestionV1
      const key = pdfSourceBookmarkKey(bookmark)
      if (seen.has(key)) continue
      seen.add(key)
      suggestions.push(bookmark)
    }
  }
  return suggestions.slice(0, 500)
}
