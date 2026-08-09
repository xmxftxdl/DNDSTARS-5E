import type {
  PdfCampaignAnalysisV1,
  PdfNamedRecordV1,
  PdfPersonRecordV1,
  PdfPrepTipV1,
  PdfRelationshipRecordV1,
  PdfSourceCitationV1,
} from './pdfCampaignAnalysis'
import type {
  PdfCampaignAnalysisArtifactV2,
  PdfCampaignAnalysisV2,
  PdfDocumentRecordV2,
  PdfEntityKindV2,
  PdfNamedRecordV2,
  PdfPersonRecordV2,
  PdfPrepTipV2,
  PdfRelationshipRecordV2,
  PdfSourceCitationV2,
  PdfSourceEvidenceV2,
} from './pdfCampaignAnalysisV2'
import {
  createStablePdfEntityId,
  createStablePdfRelationshipId,
  disambiguatePdfEntityIds,
  disambiguatePdfRelationshipIds,
  resolvePdfRelationshipEndpoints,
  stablePdfIdentityHash,
} from './pdfKnowledgeIdentity'

export interface TypedPdfCampaignAnalysisArtifactV1 {
  schemaVersion: 1
  kind: 'pdf-campaign-analysis'
  payload: PdfCampaignAnalysisV1
  sourceHash?: string
}

export type PdfCampaignAnalysisArtifact = TypedPdfCampaignAnalysisArtifactV1 | PdfCampaignAnalysisArtifactV2

function legacyHash(seed: string): string {
  const first = stablePdfIdentityHash(seed)
  const second = stablePdfIdentityHash(`legacy|${seed}`)
  const third = stablePdfIdentityHash(`document|${seed}`)
  return `${first}${second}${third}`.slice(0, 64)
}

function legacyDocumentId(name: string, pageCount: number): string {
  return `pdf_legacy_${stablePdfIdentityHash(`${name}|${pageCount}`).slice(0, 24)}`
}

function legacyDocuments(analysis: PdfCampaignAnalysisV1): PdfDocumentRecordV2[] {
  return analysis.documents.map((document) => ({
    id: legacyDocumentId(document.name, document.pageCount),
    name: document.name,
    mimeType: 'application/pdf',
    sha256: legacyHash(`${document.name}|${document.pageCount}|${document.extractedCharacters}`),
    sizeBytes: 0,
    pageCount: document.pageCount,
    extractedCharacters: document.extractedCharacters,
    scannedPages: [...document.scannedPages],
  }))
}

function legacyEvidenceForAnalysis(analysis: PdfCampaignAnalysisV1, documents: PdfDocumentRecordV2[]): {
  evidence: PdfSourceEvidenceV2[]
  citation: (value: PdfSourceCitationV1) => PdfSourceCitationV2
} {
  const documentByName = new Map(documents.map((document) => [document.name, document]))
  const evidenceByKey = new Map<string, PdfSourceEvidenceV2>()
  const citation = (value: PdfSourceCitationV1): PdfSourceCitationV2 => {
    const document = documentByName.get(value.documentName)
    const documentId = document?.id ?? legacyDocumentId(value.documentName, value.page)
    const key = `${documentId}|${value.page}`
    let found = evidenceByKey.get(key)
    if (!found) {
      found = {
        id: `ev_legacy_${stablePdfIdentityHash(key).slice(0, 24)}`,
        documentId,
        documentName: value.documentName,
        page: value.page,
        chunkId: 'legacy',
        quote: '',
        normalizedQuoteSha256: legacyHash(`legacy-evidence|${key}`),
        verification: 'legacy',
      }
      evidenceByKey.set(key, found)
    }
    return {
      documentId,
      documentName: value.documentName,
      page: value.page,
      evidenceId: found.id,
      quote: '',
      verification: 'legacy',
    }
  }
  // Prime the map deterministically, independent of category traversal order.
  const allCitations = [
    ...analysis.people.flatMap((entry) => entry.citations),
    ...analysis.relationships.flatMap((entry) => entry.citations),
    ...analysis.locations.flatMap((entry) => entry.citations),
    ...analysis.factions.flatMap((entry) => entry.citations),
    ...analysis.clues.flatMap((entry) => entry.citations),
    ...analysis.scenes.flatMap((entry) => entry.citations),
    ...analysis.encounters.flatMap((entry) => entry.citations),
    ...analysis.importCandidates.flatMap((entry) => entry.citations),
    ...analysis.prepTips.flatMap((entry) => entry.citations),
  ].sort((left, right) => left.documentName.localeCompare(right.documentName) || left.page - right.page)
  allCitations.forEach(citation)
  return { evidence: [...evidenceByKey.values()], citation }
}

function identityFor(input: {
  kind: PdfEntityKindV2
  name: string
  citations: PdfSourceCitationV2[]
  evidence: readonly PdfSourceEvidenceV2[]
}) {
  const evidenceById = new Map(input.evidence.map((entry) => [entry.id, entry]))
  const evidenceIds = [...new Set(input.citations.map((citation) => citation.evidenceId))]
  return {
    id: createStablePdfEntityId({ kind: input.kind, name: input.name, firstEvidence: evidenceById.get(evidenceIds[0] ?? '') }),
    aliases: [],
    evidenceIds,
    confidence: 0.5,
    reviewStatus: 'needs-review' as const,
  }
}

function migrateNamed<T extends PdfNamedRecordV1>(
  record: T,
  kind: PdfEntityKindV2,
  convertCitation: (value: PdfSourceCitationV1) => PdfSourceCitationV2,
  evidence: readonly PdfSourceEvidenceV2[],
): T & PdfNamedRecordV2 {
  const citations = record.citations.map(convertCitation)
  return { ...record, ...identityFor({ kind, name: record.name, citations, evidence }), citations }
}

function migratePerson(
  person: PdfPersonRecordV1,
  convertCitation: (value: PdfSourceCitationV1) => PdfSourceCitationV2,
  evidence: readonly PdfSourceEvidenceV2[],
): PdfPersonRecordV2 {
  return migrateNamed(person, 'person', convertCitation, evidence)
}

function migratePrepTip(
  tip: PdfPrepTipV1,
  convertCitation: (value: PdfSourceCitationV1) => PdfSourceCitationV2,
  evidence: readonly PdfSourceEvidenceV2[],
): PdfPrepTipV2 {
  const citations = tip.citations.map(convertCitation)
  return { ...tip, ...identityFor({ kind: 'prep-tip', name: tip.title, citations, evidence }), citations }
}

export function migratePdfCampaignAnalysisV1ToV2(analysis: PdfCampaignAnalysisV1): PdfCampaignAnalysisV2 {
  const documents = legacyDocuments(analysis)
  const legacy = legacyEvidenceForAnalysis(analysis, documents)
  const people = disambiguatePdfEntityIds(analysis.people.map((entry) => migratePerson(entry, legacy.citation, legacy.evidence)))
  const locations = disambiguatePdfEntityIds(analysis.locations.map((entry) => migrateNamed(entry, 'location', legacy.citation, legacy.evidence)))
  const factions = disambiguatePdfEntityIds(analysis.factions.map((entry) => migrateNamed(entry, 'faction', legacy.citation, legacy.evidence)))
  const relationships: PdfRelationshipRecordV2[] = analysis.relationships.map((entry: PdfRelationshipRecordV1) => {
    const citations = entry.citations.map(legacy.citation)
    const value: PdfRelationshipRecordV2 = {
      ...entry,
      id: '',
      citations,
      evidenceIds: [...new Set(citations.map((citation) => citation.evidenceId))],
      confidence: 0.5,
      reviewStatus: 'needs-review',
    }
    return { ...value, id: createStablePdfRelationshipId(value) }
  })
  const resolvedRelationships = resolvePdfRelationshipEndpoints({
    people,
    locations,
    factions,
    relationships: disambiguatePdfRelationshipIds(relationships),
  })
  return {
    schemaVersion: 2,
    documents,
    evidence: legacy.evidence,
    overview: analysis.overview,
    people,
    relationships: resolvedRelationships,
    locations,
    factions,
    clues: disambiguatePdfEntityIds(analysis.clues.map((entry) => migrateNamed(entry, 'clue', legacy.citation, legacy.evidence))),
    scenes: disambiguatePdfEntityIds(analysis.scenes.map((entry) => migrateNamed(entry, 'scene', legacy.citation, legacy.evidence))),
    encounters: disambiguatePdfEntityIds(analysis.encounters.map((entry) => migrateNamed(entry, 'encounter', legacy.citation, legacy.evidence))),
    importCandidates: disambiguatePdfEntityIds(analysis.importCandidates.map((entry) => migrateNamed(entry, 'import-candidate', legacy.citation, legacy.evidence))),
    prepTips: disambiguatePdfEntityIds(analysis.prepTips.map((entry) => migratePrepTip(entry, legacy.citation, legacy.evidence))),
    warnings: [...analysis.warnings],
    analyzedChunks: analysis.analyzedChunks,
    ...(analysis.analysisDepth ? { analysisDepth: analysis.analysisDepth } : {}),
    ...(analysis.analysisPasses != null ? { analysisPasses: analysis.analysisPasses } : {}),
    ...(analysis.modelRouting ? { modelRouting: analysis.modelRouting } : {}),
  }
}

export function projectPdfCampaignAnalysisV2ToLegacyView(analysis: PdfCampaignAnalysisV2): PdfCampaignAnalysisV1 {
  const citation = (value: PdfSourceCitationV2): PdfSourceCitationV1 => ({ documentName: value.documentName, page: value.page })
  const named = <T extends PdfNamedRecordV2>(record: T): Omit<T, keyof Pick<PdfNamedRecordV2, 'id' | 'aliases' | 'evidenceIds' | 'confidence' | 'reviewStatus'>> & PdfNamedRecordV1 => {
    const rest = Object.fromEntries(Object.entries(record).filter(([key]) => (
      key !== 'id' && key !== 'aliases' && key !== 'evidenceIds' && key !== 'confidence' && key !== 'reviewStatus'
    ))) as Omit<T, keyof Pick<PdfNamedRecordV2, 'id' | 'aliases' | 'evidenceIds' | 'confidence' | 'reviewStatus'>>
    return { ...rest, citations: record.citations.map(citation) }
  }
  return {
    schemaVersion: 1,
    overview: analysis.overview,
    documents: analysis.documents.map((document) => ({
      name: document.name,
      pageCount: document.pageCount,
      extractedCharacters: document.extractedCharacters,
      scannedPages: [...document.scannedPages],
    })),
    people: analysis.people.map(named),
    relationships: analysis.relationships.map((relationship) => ({
      from: relationship.from, to: relationship.to, type: relationship.type, description: relationship.description,
      citations: relationship.citations.map(citation),
    })),
    locations: analysis.locations.map(named),
    factions: analysis.factions.map(named),
    clues: analysis.clues.map(named),
    scenes: analysis.scenes.map(named),
    encounters: analysis.encounters.map(named),
    importCandidates: analysis.importCandidates.map(named),
    prepTips: analysis.prepTips.map((tip) => ({
      title: tip.title, description: tip.description, priority: tip.priority, citations: tip.citations.map(citation),
    })),
    warnings: [...analysis.warnings],
    analyzedChunks: analysis.analyzedChunks,
    ...(analysis.analysisDepth ? { analysisDepth: analysis.analysisDepth } : {}),
    ...(analysis.analysisPasses != null ? { analysisPasses: analysis.analysisPasses } : {}),
    ...(analysis.modelRouting ? { modelRouting: analysis.modelRouting } : {}),
  }
}

export function materializePdfCampaignAnalysis(value: PdfCampaignAnalysisArtifact | PdfCampaignAnalysisV1 | PdfCampaignAnalysisV2): PdfCampaignAnalysisV2 {
  const payload = 'kind' in value ? value.payload : value
  return payload.schemaVersion === 2
    ? structuredClone(payload as PdfCampaignAnalysisV2)
    : migratePdfCampaignAnalysisV1ToV2(payload as PdfCampaignAnalysisV1)
}

export function normalizeDmEditedPdfCampaignAnalysisV2(analysis: PdfCampaignAnalysisV2): PdfCampaignAnalysisV2 {
  const evidence = new Map(analysis.evidence.map((entry) => [entry.id, entry]))
  const named = <T extends Partial<PdfNamedRecordV2> & PdfNamedRecordV1>(entry: T, kind: PdfEntityKindV2): T & PdfNamedRecordV2 => {
    const citations = entry.citations.filter((citation): citation is PdfSourceCitationV2 => (
      'evidenceId' in citation && typeof citation.evidenceId === 'string' && evidence.has(citation.evidenceId)
    ))
    const evidenceIds = [...new Set(citations.map((citation) => citation.evidenceId))]
    const firstEvidence = evidence.get(evidenceIds[0] ?? '')
    return {
      ...entry,
      id: typeof entry.id === 'string' && entry.id ? entry.id : createStablePdfEntityId({ kind, name: entry.name, firstEvidence }),
      aliases: [...new Set(entry.aliases ?? [])],
      citations,
      evidenceIds,
      confidence: typeof entry.confidence === 'number' ? entry.confidence : evidenceIds.length > 0 ? 1 : 0,
      reviewStatus: entry.reviewStatus ?? (evidenceIds.length > 0 ? 'auto-verified' : 'needs-review'),
    }
  }
  const people = disambiguatePdfEntityIds(analysis.people.map((entry) => named(entry, 'person')))
  const locations = disambiguatePdfEntityIds(analysis.locations.map((entry) => named(entry, 'location')))
  const factions = disambiguatePdfEntityIds(analysis.factions.map((entry) => named(entry, 'faction')))
  const entityIds = new Set([...people, ...locations, ...factions].map((entry) => entry.id))
  const relationships = analysis.relationships.map((entry) => {
    const citations = entry.citations.filter((citation) => evidence.has(citation.evidenceId))
    const evidenceIds = [...new Set(citations.map((citation) => citation.evidenceId))]
    const base: PdfRelationshipRecordV2 = {
      ...entry,
      id: entry.id || '',
      citations,
      evidenceIds,
      confidence: typeof entry.confidence === 'number' ? entry.confidence : evidenceIds.length > 0 ? 1 : 0,
      reviewStatus: entry.reviewStatus ?? (evidenceIds.length > 0 ? 'auto-verified' : 'needs-review'),
      ...(entry.fromEntityId && entityIds.has(entry.fromEntityId) ? { fromEntityId: entry.fromEntityId } : { fromEntityId: undefined }),
      ...(entry.toEntityId && entityIds.has(entry.toEntityId) ? { toEntityId: entry.toEntityId } : { toEntityId: undefined }),
    }
    return { ...base, id: base.id || createStablePdfRelationshipId(base) }
  })
  return {
    ...analysis,
    people,
    locations,
    factions,
    relationships: resolvePdfRelationshipEndpoints({ people, locations, factions, relationships: disambiguatePdfRelationshipIds(relationships) }),
    clues: disambiguatePdfEntityIds(analysis.clues.map((entry) => named(entry, 'clue'))),
    scenes: disambiguatePdfEntityIds(analysis.scenes.map((entry) => named(entry, 'scene'))),
    encounters: disambiguatePdfEntityIds(analysis.encounters.map((entry) => named(entry, 'encounter'))),
    importCandidates: disambiguatePdfEntityIds(analysis.importCandidates.map((entry) => named(entry, 'import-candidate'))),
    prepTips: disambiguatePdfEntityIds(analysis.prepTips.map((entry) => {
      const citations = entry.citations.filter((citation) => evidence.has(citation.evidenceId))
      const evidenceIds = [...new Set(citations.map((citation) => citation.evidenceId))]
      return {
        ...entry,
        id: entry.id || createStablePdfEntityId({ kind: 'prep-tip', name: entry.title, firstEvidence: evidence.get(evidenceIds[0] ?? '') }),
        aliases: [...new Set(entry.aliases ?? [])],
        citations,
        evidenceIds,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : evidenceIds.length > 0 ? 1 : 0,
        reviewStatus: entry.reviewStatus ?? (evidenceIds.length > 0 ? 'auto-verified' : 'needs-review'),
      }
    })),
  }
}
