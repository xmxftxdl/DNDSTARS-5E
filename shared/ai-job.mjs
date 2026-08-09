export const AI_JOB_SCHEMA_VERSION = 2
export const AI_JOB_ARTIFACT_SCHEMA_VERSION = 2
export const AI_JOB_MAX_PER_CAMPAIGN = 40
export const AI_JOB_LOCAL_LEASE_MS = 30 * 60 * 1_000
export const AI_JOB_ARTIFACT_MAX_BYTES = 3 * 1024 * 1024

export const AI_JOB_STATUSES = Object.freeze([
  'queued',
  'awaiting-local-runner',
  'running',
  'validating',
  'review-required',
  'completed',
  'failed',
  'cancelled',
])

const TASK_KINDS = new Set([
  'pdf-extraction',
  'campaign-analysis',
  'resource-structuring',
  'map-analysis',
  'transcription',
  'session-summary',
  'prep-recommendations',
])
const EXECUTION_MODES = new Set(['local-runner', 'platform-server', 'external-server'])
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(value, maximum, minimum = 1) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length >= minimum && normalized.length <= maximum ? normalized : null
}

function safeJsonSize(value) {
  try {
    const json = JSON.stringify(value)
    return typeof TextEncoder === 'function'
      ? new TextEncoder().encode(json).byteLength
      : unescape(encodeURIComponent(json)).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function normalizedSourceAsset(value) {
  if (!plainObject(value)) return null
  const assetId = boundedString(value.assetId, 120)
  const name = boundedString(value.name, 500)
  const mimeType = boundedString(value.mimeType, 120)
  const sizeBytes = Number(value.sizeBytes)
  const pageCount = value.pageCount == null ? undefined : Number(value.pageCount)
  const sha256 = value.sha256 == null ? undefined : String(value.sha256).toLowerCase()
  if (!assetId || !name || !mimeType || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 200 * 1024 * 1024) return null
  if (pageCount != null && (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 20_000)) return null
  if (sha256 != null && !/^[a-f0-9]{64}$/.test(sha256)) return null
  return {
    assetId,
    name,
    mimeType,
    sizeBytes,
    ...(pageCount == null ? {} : { pageCount }),
    ...(sha256 == null ? {} : { sha256 }),
  }
}

export function normalizeAiJobCreateRequestV2(value) {
  if (!plainObject(value) || value.schemaVersion !== AI_JOB_SCHEMA_VERSION) return null
  const taskKind = String(value.taskKind ?? '')
  const executionMode = String(value.executionMode ?? '')
  const providerId = boundedString(value.providerId, 120)
  const modelId = boundedString(value.modelId, 200)
  const promptVersion = boundedString(value.promptVersion, 80)
  const idempotencyKey = boundedString(value.idempotencyKey, 160, 8)
  if (!TASK_KINDS.has(taskKind) || !EXECUTION_MODES.has(executionMode)) return null
  if (!providerId || !modelId || !promptVersion || !idempotencyKey) return null
  if (!Array.isArray(value.sourceAssets) || value.sourceAssets.length < 1 || value.sourceAssets.length > 20) return null
  const sourceAssets = value.sourceAssets.map(normalizedSourceAsset)
  if (sourceAssets.some((entry) => !entry)) return null
  const input = plainObject(value.input) ? value.input : {}
  if (safeJsonSize(input) > 32 * 1024) return null
  return {
    schemaVersion: AI_JOB_SCHEMA_VERSION,
    taskKind,
    executionMode,
    providerId,
    modelId,
    promptVersion,
    idempotencyKey,
    sourceAssets,
    input,
  }
}

function normalizedProgress(value) {
  const source = plainObject(value) ? value : {}
  const current = Number(source.current)
  const total = Number(source.total)
  return {
    stage: boundedString(source.stage, 80) ?? 'queued',
    current: Number.isSafeInteger(current) && current >= 0 ? current : 0,
    total: Number.isSafeInteger(total) && total >= 0 ? total : 0,
    message: boundedString(source.message, 500, 0) ?? '',
  }
}

export function normalizeAiJobRecordV2(value) {
  if (!plainObject(value) || value.schemaVersion !== AI_JOB_SCHEMA_VERSION) return null
  const create = normalizeAiJobCreateRequestV2(value)
  const jobId = boundedString(value.jobId, 80)
  const accountId = boundedString(value.accountId, 20)
  const campaignId = boundedString(value.campaignId, 20)
  const status = String(value.status ?? '')
  const revision = Number(value.revision)
  const createdAt = Number(value.createdAt)
  const updatedAt = Number(value.updatedAt)
  if (!create || !jobId || !accountId || !campaignId || !AI_JOB_STATUSES.includes(status)) return null
  if (!Number.isSafeInteger(revision) || revision < 1 || !Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null
  const lease = plainObject(value.lease) && typeof value.lease.tokenHash === 'string'
    ? {
        tokenHash: value.lease.tokenHash,
        runnerId: boundedString(value.lease.runnerId, 160) ?? '',
        acquiredAt: Number(value.lease.acquiredAt) || 0,
        expiresAt: Number(value.lease.expiresAt) || 0,
      }
    : null
  const artifact = value.artifact == null ? null : normalizePdfCampaignAnalysisArtifact(value.artifact)
  if (value.artifact != null && !artifact) return null
  return {
    ...create,
    jobId,
    accountId,
    campaignId,
    status,
    revision,
    progress: normalizedProgress(value.progress),
    lease,
    artifact,
    failure: plainObject(value.failure)
      ? {
          code: boundedString(value.failure.code, 120) ?? 'ai-job-failed',
          message: boundedString(value.failure.message, 1_000, 0) ?? '',
        }
      : null,
    createdAt,
    updatedAt,
    ...(Number.isFinite(value.resultAt) ? { resultAt: Number(value.resultAt) } : {}),
    ...(Number.isFinite(value.completedAt) ? { completedAt: Number(value.completedAt) } : {}),
  }
}

function validCitation(citation, documentPages) {
  if (!plainObject(citation)) return false
  const name = boundedString(citation.documentName, 500)
  const page = Number(citation.page)
  return !!name && Number.isSafeInteger(page) && page >= 1 && page <= (documentPages.get(name) ?? 0)
}

function validateCitationsOnEntries(entries, documentPages) {
  return Array.isArray(entries) && entries.length <= 240 && entries.every((entry) => (
    plainObject(entry) && Array.isArray(entry.citations) && entry.citations.length <= 32 &&
    entry.citations.every((citation) => validCitation(citation, documentPages))
  ))
}

function stringsWithin(value, maximum = 32, stringMaximum = 2_000) {
  return Array.isArray(value) && value.length <= maximum && value.every((entry) => (
    typeof entry === 'string' && entry.length <= stringMaximum
  ))
}

function namedEntryValid(entry, documentPages) {
  return plainObject(entry) && !!boundedString(entry.name, 300) &&
    typeof entry.description === 'string' && entry.description.length <= 8_000 &&
    validateCitationsOnEntries([entry], documentPages)
}

export function normalizePdfCampaignAnalysisArtifactV1(value) {
  if (!plainObject(value) || value.schemaVersion !== 1 || value.kind !== 'pdf-campaign-analysis') return null
  if (!plainObject(value.payload) || value.payload.schemaVersion !== 1 || safeJsonSize(value) > AI_JOB_ARTIFACT_MAX_BYTES) return null
  const payload = value.payload
  if (!Array.isArray(payload.documents) || payload.documents.length < 1 || payload.documents.length > 20) return null
  const documentPages = new Map()
  for (const document of payload.documents) {
    if (!plainObject(document)) return null
    const name = boundedString(document.name, 500)
    const pageCount = Number(document.pageCount)
    if (!name || !Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 20_000 || documentPages.has(name)) return null
    documentPages.set(name, pageCount)
  }
  if (!Array.isArray(payload.people) || payload.people.length > 240 || !payload.people.every((entry) => (
    namedEntryValid(entry, documentPages) &&
    ['role', 'personality', 'motivation', 'secret', 'voice'].every((key) => typeof entry[key] === 'string' && entry[key].length <= 4_000) &&
    (entry.appearance == null || (typeof entry.appearance === 'string' && entry.appearance.length <= 4_000)) &&
    (entry.portraitDataUrl == null || (typeof entry.portraitDataUrl === 'string' && entry.portraitDataUrl.length <= 400_000 && /^data:image\/(?:png|jpeg|webp);base64,/i.test(entry.portraitDataUrl)))
  ))) return null
  if (!Array.isArray(payload.relationships) || payload.relationships.length > 240 || !payload.relationships.every((entry) => (
    plainObject(entry) && !!boundedString(entry.from, 300) && !!boundedString(entry.to, 300) &&
    !!boundedString(entry.type, 300) && typeof entry.description === 'string' && entry.description.length <= 8_000 &&
    validateCitationsOnEntries([entry], documentPages)
  ))) return null
  if (!['locations', 'factions'].every((key) => (
    Array.isArray(payload[key]) && payload[key].length <= 240 && payload[key].every((entry) => namedEntryValid(entry, documentPages))
  ))) return null
  if (!Array.isArray(payload.clues) || payload.clues.length > 240 || !payload.clues.every((entry) => (
    namedEntryValid(entry, documentPages) && ['source', 'discovery', 'failForward'].every((key) => typeof entry[key] === 'string' && entry[key].length <= 4_000)
  ))) return null
  if (!Array.isArray(payload.scenes) || payload.scenes.length > 240 || !payload.scenes.every((entry) => (
    namedEntryValid(entry, documentPages) && typeof entry.location === 'string' && entry.location.length <= 2_000 &&
    stringsWithin(entry.npcs) && stringsWithin(entry.monsters)
  ))) return null
  if (!Array.isArray(payload.encounters) || payload.encounters.length > 240 || !payload.encounters.every((entry) => (
    namedEntryValid(entry, documentPages) && stringsWithin(entry.creatures) &&
    typeof entry.notes === 'string' && entry.notes.length <= 4_000
  ))) return null
  if (!Array.isArray(payload.importCandidates) || payload.importCandidates.length > 240 || !payload.importCandidates.every((entry) => (
    namedEntryValid(entry, documentPages) && ['monster', 'npc', 'item', 'spell', 'map', 'handout', 'rule'].includes(entry.kind) &&
    ['full', 'partial', 'manual'].includes(entry.automation)
  ))) return null
  if (!Array.isArray(payload.prepTips) || payload.prepTips.length > 240 || !payload.prepTips.every((entry) => (
    plainObject(entry) && !!boundedString(entry.title, 300) && typeof entry.description === 'string' && entry.description.length <= 8_000 &&
    ['high', 'medium', 'low'].includes(entry.priority) && validateCitationsOnEntries([entry], documentPages)
  ))) return null
  if (!Array.isArray(payload.warnings) || payload.warnings.length > 100 || payload.warnings.some((entry) => typeof entry !== 'string' || entry.length > 2_000)) return null
  if (typeof payload.overview !== 'string' || payload.overview.length > 12_000) return null
  return {
    schemaVersion: 1,
    kind: 'pdf-campaign-analysis',
    payload,
    ...(typeof value.sourceHash === 'string' && /^[a-f0-9]{64}$/i.test(value.sourceHash)
      ? { sourceHash: value.sourceHash.toLowerCase() }
      : {}),
  }
}

const PDF_V2_VERIFICATIONS = new Set(['exact', 'normalized', 'legacy', 'unverified'])
const PDF_V2_REVIEW_STATUSES = new Set(['auto-verified', 'needs-review', 'approved', 'rejected'])

function validV2Citation(citation, documents, evidence) {
  if (!plainObject(citation)) return false
  const documentId = boundedString(citation.documentId, 120)
  const documentName = boundedString(citation.documentName, 500)
  const evidenceId = boundedString(citation.evidenceId, 120)
  const page = Number(citation.page)
  const quote = typeof citation.quote === 'string' ? citation.quote : null
  const verification = String(citation.verification ?? '')
  const document = documentId ? documents.get(documentId) : null
  const source = evidenceId ? evidence.get(evidenceId) : null
  return !!document && !!source && !!documentName && document.name === documentName &&
    Number.isSafeInteger(page) && page >= 1 && page <= document.pageCount &&
    quote != null && quote.length <= 320 && PDF_V2_VERIFICATIONS.has(verification) &&
    source.documentId === documentId && source.page === page && source.quote === quote && source.verification === verification
}

function validV2Identity(entry, evidence, entityIds) {
  const id = boundedString(entry.id, 120)
  const confidence = Number(entry.confidence)
  const reviewStatus = String(entry.reviewStatus ?? '')
  if (!id || entityIds.has(id) || !Array.isArray(entry.aliases) || entry.aliases.length > 32 ||
    entry.aliases.some((alias) => !boundedString(alias, 300)) || !Array.isArray(entry.evidenceIds) || entry.evidenceIds.length > 32 ||
    entry.evidenceIds.some((evidenceId) => !evidence.has(evidenceId)) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 ||
    !PDF_V2_REVIEW_STATUSES.has(reviewStatus)) return false
  if (reviewStatus === 'auto-verified' && !entry.evidenceIds.some((evidenceId) => ['exact', 'normalized'].includes(evidence.get(evidenceId)?.verification))) return false
  entityIds.add(id)
  return true
}

function validV2NamedEntry(entry, documents, evidence, entityIds) {
  return plainObject(entry) && !!boundedString(entry.name, 300) &&
    typeof entry.description === 'string' && entry.description.length <= 8_000 &&
    validV2Identity(entry, evidence, entityIds) && Array.isArray(entry.citations) && entry.citations.length <= 32 &&
    entry.citations.every((citation) => validV2Citation(citation, documents, evidence))
}

export function normalizePdfCampaignAnalysisArtifactV2(value) {
  if (!plainObject(value) || value.schemaVersion !== 2 || value.kind !== 'pdf-campaign-analysis') return null
  if (!plainObject(value.payload) || value.payload.schemaVersion !== 2 || safeJsonSize(value) > AI_JOB_ARTIFACT_MAX_BYTES) return null
  const payload = value.payload
  if ('pages' in payload || 'sourcePages' in payload || 'normalizedText' in payload) return null
  if (!Array.isArray(payload.documents) || payload.documents.length < 1 || payload.documents.length > 20) return null
  const documents = new Map()
  for (const document of payload.documents) {
    if (!plainObject(document) || 'pages' in document || 'text' in document || 'normalizedText' in document) return null
    const id = boundedString(document.id, 120)
    const name = boundedString(document.name, 500)
    const sha256 = typeof document.sha256 === 'string' ? document.sha256.toLowerCase() : ''
    const pageCount = Number(document.pageCount)
    const sizeBytes = Number(document.sizeBytes)
    const extractedCharacters = Number(document.extractedCharacters)
    if (!id || !/^pdf_(?:[a-f0-9]{24}|legacy_[a-f0-9]{24})$/.test(id) || documents.has(id) || !name ||
      !/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > 200 * 1024 * 1024 ||
      !Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 20_000 ||
      !Number.isSafeInteger(extractedCharacters) || extractedCharacters < 0 || extractedCharacters > 200 * 1024 * 1024 ||
      !Array.isArray(document.scannedPages) || document.scannedPages.length > pageCount ||
      document.scannedPages.some((page) => !Number.isSafeInteger(page) || page < 1 || page > pageCount)) return null
    documents.set(id, { id, name, pageCount })
  }
  if (!Array.isArray(payload.evidence) || payload.evidence.length > 2_000) return null
  const evidence = new Map()
  for (const source of payload.evidence) {
    if (!plainObject(source)) return null
    const id = boundedString(source.id, 120)
    const documentId = boundedString(source.documentId, 120)
    const documentName = boundedString(source.documentName, 500)
    const chunkId = boundedString(source.chunkId, 300)
    const quote = typeof source.quote === 'string' ? source.quote : null
    const verification = String(source.verification ?? '')
    const hash = typeof source.normalizedQuoteSha256 === 'string' ? source.normalizedQuoteSha256.toLowerCase() : ''
    const page = Number(source.page)
    const document = documentId ? documents.get(documentId) : null
    if (!id || evidence.has(id) || !document || !documentName || document.name !== documentName || !chunkId ||
      !Number.isSafeInteger(page) || page < 1 || page > document.pageCount || quote == null || quote.length > 320 ||
      (!['legacy', 'unverified'].includes(verification) && quote.trim().length < 8) ||
      !PDF_V2_VERIFICATIONS.has(verification) || !/^[a-f0-9]{64}$/.test(hash)) return null
    evidence.set(id, { id, documentId, documentName, page, quote, verification })
  }
  const entityIds = new Set()
  if (!Array.isArray(payload.people) || payload.people.length > 240 || !payload.people.every((entry) => (
    validV2NamedEntry(entry, documents, evidence, entityIds) &&
    ['role', 'personality', 'motivation', 'secret', 'voice'].every((key) => typeof entry[key] === 'string' && entry[key].length <= 4_000) &&
    (entry.appearance == null || (typeof entry.appearance === 'string' && entry.appearance.length <= 4_000)) &&
    (entry.portraitDataUrl == null || (typeof entry.portraitDataUrl === 'string' && entry.portraitDataUrl.length <= 400_000 && /^data:image\/(?:png|jpeg|webp);base64,/i.test(entry.portraitDataUrl)))
  ))) return null
  if (!['locations', 'factions'].every((key) => Array.isArray(payload[key]) && payload[key].length <= 240 && payload[key].every((entry) => validV2NamedEntry(entry, documents, evidence, entityIds)))) return null
  if (!Array.isArray(payload.clues) || payload.clues.length > 240 || !payload.clues.every((entry) => (
    validV2NamedEntry(entry, documents, evidence, entityIds) && ['source', 'discovery', 'failForward'].every((key) => typeof entry[key] === 'string' && entry[key].length <= 4_000)
  ))) return null
  if (!Array.isArray(payload.scenes) || payload.scenes.length > 240 || !payload.scenes.every((entry) => (
    validV2NamedEntry(entry, documents, evidence, entityIds) && typeof entry.location === 'string' && entry.location.length <= 2_000 && stringsWithin(entry.npcs) && stringsWithin(entry.monsters)
  ))) return null
  if (!Array.isArray(payload.encounters) || payload.encounters.length > 240 || !payload.encounters.every((entry) => (
    validV2NamedEntry(entry, documents, evidence, entityIds) && stringsWithin(entry.creatures) && typeof entry.notes === 'string' && entry.notes.length <= 4_000
  ))) return null
  if (!Array.isArray(payload.importCandidates) || payload.importCandidates.length > 240 || !payload.importCandidates.every((entry) => (
    validV2NamedEntry(entry, documents, evidence, entityIds) && ['monster', 'npc', 'item', 'spell', 'map', 'handout', 'rule'].includes(entry.kind) && ['full', 'partial', 'manual'].includes(entry.automation)
  ))) return null
  if (!Array.isArray(payload.prepTips) || payload.prepTips.length > 240 || !payload.prepTips.every((entry) => (
    plainObject(entry) && !!boundedString(entry.title, 300) && typeof entry.description === 'string' && entry.description.length <= 8_000 &&
    ['high', 'medium', 'low'].includes(entry.priority) && validV2Identity(entry, evidence, entityIds) &&
    Array.isArray(entry.citations) && entry.citations.length <= 32 && entry.citations.every((citation) => validV2Citation(citation, documents, evidence))
  ))) return null
  if (!Array.isArray(payload.relationships) || payload.relationships.length > 240) return null
  const relationshipIds = new Set()
  for (const relationship of payload.relationships) {
    if (!plainObject(relationship)) return null
    const id = boundedString(relationship.id, 120)
    if (!id || relationshipIds.has(id) || !boundedString(relationship.from, 300) || !boundedString(relationship.to, 300) ||
      !boundedString(relationship.type, 300) || typeof relationship.description !== 'string' || relationship.description.length > 8_000 ||
      !Array.isArray(relationship.evidenceIds) || relationship.evidenceIds.length > 32 || relationship.evidenceIds.some((entry) => !evidence.has(entry)) ||
      !Array.isArray(relationship.citations) || relationship.citations.length > 32 || relationship.citations.some((entry) => !validV2Citation(entry, documents, evidence)) ||
      !Number.isFinite(Number(relationship.confidence)) || Number(relationship.confidence) < 0 || Number(relationship.confidence) > 1 ||
      !PDF_V2_REVIEW_STATUSES.has(String(relationship.reviewStatus ?? '')) ||
      (relationship.fromEntityId != null && !entityIds.has(relationship.fromEntityId)) ||
      (relationship.toEntityId != null && !entityIds.has(relationship.toEntityId))) return null
    if (relationship.reviewStatus === 'auto-verified' && !relationship.evidenceIds.some((entry) => ['exact', 'normalized'].includes(evidence.get(entry)?.verification))) return null
    relationshipIds.add(id)
  }
  if (!Array.isArray(payload.warnings) || payload.warnings.length > 100 || payload.warnings.some((entry) => typeof entry !== 'string' || entry.length > 2_000)) return null
  if (typeof payload.overview !== 'string' || payload.overview.length > 24_000 || !Number.isSafeInteger(payload.analyzedChunks) || payload.analyzedChunks < 0) return null
  return {
    schemaVersion: 2,
    kind: 'pdf-campaign-analysis',
    payload,
    ...(typeof value.sourceHash === 'string' && /^[a-f0-9]{64}$/i.test(value.sourceHash) ? { sourceHash: value.sourceHash.toLowerCase() } : {}),
  }
}

export function normalizePdfCampaignAnalysisArtifact(value) {
  return normalizePdfCampaignAnalysisArtifactV2(value) ?? normalizePdfCampaignAnalysisArtifactV1(value)
}

export function aiJobTransitionAllowed(from, to) {
  if (from === to) return true
  if (TERMINAL_STATUSES.has(from)) return false
  if (to === 'cancelled' || to === 'failed') return true
  const allowed = {
    queued: ['awaiting-local-runner', 'running'],
    'awaiting-local-runner': ['running'],
    running: ['validating'],
    validating: ['review-required'],
    'review-required': ['completed'],
  }
  return allowed[from]?.includes(to) === true
}

export function publicAiJobV2(value, includeArtifact = false) {
  const job = normalizeAiJobRecordV2(value)
  if (!job) return null
  return {
    ...job,
    lease: job.lease
      ? { runnerId: job.lease.runnerId, acquiredAt: job.lease.acquiredAt, expiresAt: job.lease.expiresAt }
      : null,
    artifact: includeArtifact ? job.artifact : null,
  }
}
