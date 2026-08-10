import type {
  PdfAnalysisDepthV1,
  PdfAnalysisModelRoutingV1,
  PdfCampaignAnalysisV1,
  PdfImportCandidateKindV1,
  PdfTimelineKindV1,
} from './pdfCampaignAnalysis'

export const PDF_CAMPAIGN_ANALYSIS_SCHEMA_VERSION = 2 as const
export const PDF_EVIDENCE_SCHEMA_VERSION = 1 as const

export type PdfEvidenceVerificationV2 = 'exact' | 'normalized' | 'legacy' | 'unverified'
export type PdfReviewStatusV2 = 'auto-verified' | 'needs-review' | 'approved' | 'rejected'
export type PdfEntityKindV2 =
  | 'person'
  | 'location'
  | 'faction'
  | 'clue'
  | 'scene'
  | 'encounter'
  | 'import-candidate'
  | 'prep-tip'

export interface PdfDocumentRecordV2 {
  id: string
  name: string
  mimeType: 'application/pdf'
  sha256: string
  sizeBytes: number
  pageCount: number
  extractedCharacters: number
  /** Pages detected as image/scanned content before OCR fallback. */
  scannedPages: number[]
  /** Scanned pages successfully recovered by OCR. */
  ocrPages?: number[]
  /** Scanned pages excluded from model input because OCR was unavailable or failed. */
  unresolvedPages?: number[]
}

export interface PdfSourcePageV2 {
  documentId: string
  documentSha256: string
  documentName: string
  page: number
  text: string
  normalizedText: string
  textSha256: string
  extractionMethod: 'pdf-text' | 'ocr' | 'vision'
  /** 0-1 confidence reported by OCR/vision. Native PDF text is treated as authoritative. */
  extractionConfidence?: number
  /** OCR page geometry, normalized to the page bounds so it survives render-scale changes. */
  textBlocks?: PdfSourceTextBlockV1[]
}

export interface PdfSourceTextBlockV1 {
  text: string
  /** [left, top, right, bottom], each value normalized to 0-1 page coordinates. */
  bbox: [number, number, number, number]
  confidence?: number
}

export interface PdfEvidenceCandidateV2 {
  documentId: string
  documentName: string
  page: number
  quote: string
  chunkId?: string
}

export interface PdfSourceEvidenceV2 {
  id: string
  documentId: string
  documentName: string
  page: number
  chunkId: string
  quote: string
  normalizedQuoteSha256: string
  verification: PdfEvidenceVerificationV2
  sourceExtractionMethod?: PdfSourcePageV2['extractionMethod']
  sourceConfidence?: number
  /** OCR evidence bounds on the page, normalized to 0-1 coordinates. */
  pageRegion?: [number, number, number, number]
}

export interface PdfSourceCitationV2 {
  documentId: string
  documentName: string
  page: number
  evidenceId: string
  quote: string
  verification: PdfEvidenceVerificationV2
  sourceExtractionMethod?: PdfSourcePageV2['extractionMethod']
  sourceConfidence?: number
  pageRegion?: [number, number, number, number]
}

export interface PdfEntityIdentityV2 {
  id: string
  aliases: string[]
  evidenceIds: string[]
  confidence: number
  reviewStatus: PdfReviewStatusV2
}

export interface PdfNamedRecordV2 extends PdfEntityIdentityV2 {
  name: string
  description: string
  citations: PdfSourceCitationV2[]
}

export interface PdfPersonRecordV2 extends PdfNamedRecordV2 {
  role: string
  appearance?: string
  personality: string
  motivation: string
  secret: string
  voice: string
  portraitDataUrl?: string
}

export interface PdfRelationshipRecordV2 {
  id: string
  from: string
  to: string
  fromEntityId?: string
  toEntityId?: string
  type: string
  description: string
  citations: PdfSourceCitationV2[]
  evidenceIds: string[]
  confidence: number
  reviewStatus: PdfReviewStatusV2
}

export interface PdfClueRecordV2 extends PdfNamedRecordV2 {
  source: string
  discovery: string
  failForward: string
}

export interface PdfSceneRecordV2 extends PdfNamedRecordV2 {
  location: string
  npcs: string[]
  monsters: string[]
  time?: string
  timelineOrder?: number
  /** DM-authored authoritative campaign minute used to place this event against the room clock. */
  gameTimeWorldMinute?: number
  timelineKind?: PdfTimelineKindV1
  tags?: string[]
}

export interface PdfEncounterRecordV2 extends PdfNamedRecordV2 {
  creatures: string[]
  notes: string
}

export interface PdfImportCandidateV2 extends PdfNamedRecordV2 {
  kind: PdfImportCandidateKindV1
  automation: 'full' | 'partial' | 'manual'
}

export interface PdfPrepTipV2 extends PdfEntityIdentityV2 {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  citations: PdfSourceCitationV2[]
}

export interface PdfCampaignAnalysisV2 {
  schemaVersion: 2
  documents: PdfDocumentRecordV2[]
  evidence: PdfSourceEvidenceV2[]
  overview: string
  people: PdfPersonRecordV2[]
  relationships: PdfRelationshipRecordV2[]
  locations: PdfNamedRecordV2[]
  factions: PdfNamedRecordV2[]
  clues: PdfClueRecordV2[]
  timelineEvents?: PdfSceneRecordV2[]
  scenes: PdfSceneRecordV2[]
  encounters: PdfEncounterRecordV2[]
  importCandidates: PdfImportCandidateV2[]
  prepTips: PdfPrepTipV2[]
  warnings: string[]
  analyzedChunks: number
  analysisDepth?: PdfAnalysisDepthV1
  analysisPasses?: number
  modelRouting?: PdfAnalysisModelRoutingV1
}

export interface PdfCampaignAnalysisArtifactV2 {
  schemaVersion: 2
  kind: 'pdf-campaign-analysis'
  sourceHash?: string
  payload: PdfCampaignAnalysisV2
}

/** Read-only UI projection shared by migrated V1 artifacts and native V2 artifacts. */
export type PdfCampaignAnalysisView = Omit<PdfCampaignAnalysisV1, 'schemaVersion'> & {
  schemaVersion: 1 | 2
}

export interface PdfOcrPageInputV1 {
  documentId: string
  page: number
  image: Blob
  imageWidth: number
  imageHeight: number
  languageHints: string[]
}

export interface PdfOcrPageResultV1 {
  text: string
  confidence?: number
  /** Pixel-space boxes in the rendered input image. */
  blocks?: Array<{ text: string; bbox: [number, number, number, number]; confidence?: number }>
}

export interface PdfOcrProviderV1 {
  id: string
  recognizePage(input: PdfOcrPageInputV1, signal?: AbortSignal): Promise<PdfOcrPageResultV1>
}
