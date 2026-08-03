import type { AiProviderSelectionV1 } from '../../shared/ai-provider.mjs'
import {
  validatePdfCampaignChunkAnalysis,
  type ExtractedPdfDocumentV1,
  type PdfAnalysisDepthV1,
  type PdfCampaignChunkAnalysisV1,
} from './pdfCampaignAnalysis'

const DATABASE_NAME = 'astral-trace-ai-cache'
const DATABASE_VERSION = 1
const STORE_NAME = 'pdf-analysis-v1'
const CACHE_SCHEMA_VERSION = 1
const MAX_CACHE_RECORDS = 8
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1_000
const MAX_EXTRACTED_CHARACTERS = 80 * 1024 * 1024

export interface PdfAnalysisCacheRecordV1 {
  schemaVersion: 1
  cacheKey: string
  providerId: string
  modelId: string
  promptVersion: string
  depth: PdfAnalysisDepthV1
  sourceFiles: Array<{ name: string; type: string; size: number; lastModified: number }>
  documents: ExtractedPdfDocumentV1[] | null
  passes: Record<string, PdfCampaignChunkAnalysisV1>
  synthesis: PdfCampaignChunkAnalysisV1 | null
  createdAt: number
  updatedAt: number
}

function indexedDbAvailable(): boolean {
  return typeof globalThis.indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!indexedDbAvailable()) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizedSourceFiles(files: readonly File[]) {
  return files.map((file) => ({
    name: file.name,
    type: file.type || 'application/pdf',
    size: file.size,
    lastModified: file.lastModified,
  })).sort((left, right) => (
    left.name.localeCompare(right.name) || left.size - right.size || left.lastModified - right.lastModified
  ))
}

export async function createPdfAnalysisCacheKey(input: {
  files: readonly File[]
  selection: AiProviderSelectionV1
  depth: PdfAnalysisDepthV1
  promptVersion: string
  routeModelIds?: { extraction: string; synthesis: string }
}): Promise<string> {
  const identity = JSON.stringify({
    schemaVersion: CACHE_SCHEMA_VERSION,
    sourceFiles: normalizedSourceFiles(input.files),
    providerId: input.selection.providerId,
    modelId: input.selection.modelId ?? '',
    routeModelIds: input.routeModelIds ?? null,
    depth: input.depth,
    promptVersion: input.promptVersion,
  })
  return `pdf-v1-${await sha256(identity)}`
}

function validDocuments(value: unknown): value is ExtractedPdfDocumentV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return false
  let extractedCharacters = 0
  const chunkIds = new Set<string>()
  for (const document of value) {
    if (!document || typeof document !== 'object') return false
    if (typeof document.id !== 'string' || !document.id || document.id.length > 500) return false
    if (typeof document.name !== 'string' || !document.name || document.name.length > 500) return false
    if (!Number.isSafeInteger(document.pageCount) || document.pageCount < 1 || document.pageCount > 20_000) return false
    if (!Number.isSafeInteger(document.extractedCharacters) || document.extractedCharacters < 1) return false
    if (!Array.isArray(document.scannedPages) || document.scannedPages.some((page: unknown) => (
      !Number.isSafeInteger(page) || Number(page) < 1 || Number(page) > document.pageCount
    ))) return false
    if (!Array.isArray(document.chunks) || document.chunks.length < 1 || document.chunks.length > 20_000) return false
    extractedCharacters += document.extractedCharacters
    for (const chunk of document.chunks) {
      if (!chunk || typeof chunk !== 'object' || typeof chunk.id !== 'string' || !chunk.id || chunkIds.has(chunk.id)) return false
      if (chunk.documentName !== document.name || chunk.mimeType !== 'application/pdf-text' || typeof chunk.text !== 'string' || chunk.text.length > 7_000) return false
      if (!Number.isSafeInteger(chunk.pageStart) || !Number.isSafeInteger(chunk.pageEnd) ||
        Number(chunk.pageStart) < 1 || Number(chunk.pageEnd) < Number(chunk.pageStart) || Number(chunk.pageEnd) > document.pageCount) return false
      chunkIds.add(chunk.id)
    }
  }
  return extractedCharacters <= MAX_EXTRACTED_CHARACTERS
}

function normalizeCacheRecord(value: unknown): PdfAnalysisCacheRecordV1 | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Partial<PdfAnalysisCacheRecordV1>
  if (source.schemaVersion !== CACHE_SCHEMA_VERSION || typeof source.cacheKey !== 'string' || !source.cacheKey.startsWith('pdf-v1-')) return null
  if (typeof source.providerId !== 'string' || typeof source.modelId !== 'string' || typeof source.promptVersion !== 'string') return null
  if (source.depth !== 'quick' && source.depth !== 'deep') return null
  if (!Array.isArray(source.sourceFiles) || source.sourceFiles.length < 1 || source.sourceFiles.length > 12 ||
    source.sourceFiles.some((file) => (
      !file || typeof file.name !== 'string' || !file.name || file.name.length > 500 ||
      typeof file.type !== 'string' || file.type.length > 120 ||
      !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 100 * 1024 * 1024 ||
      !Number.isFinite(file.lastModified) || file.lastModified < 0
    ))) return null
  if (source.documents != null && !validDocuments(source.documents)) return null
  if (!source.passes || typeof source.passes !== 'object' || Array.isArray(source.passes)) return null
  const passEntries = Object.entries(source.passes)
  if (passEntries.length > 40_001 || passEntries.some(([key, analysis]) => (
    !key || key.length > 700 || !validatePdfCampaignChunkAnalysis(analysis)
  ))) return null
  if (source.synthesis != null && !validatePdfCampaignChunkAnalysis(source.synthesis)) return null
  if (!Number.isFinite(source.createdAt) || !Number.isFinite(source.updatedAt)) return null
  return source as PdfAnalysisCacheRecordV1
}

export function createEmptyPdfAnalysisCache(input: {
  cacheKey: string
  files: readonly File[]
  selection: AiProviderSelectionV1
  depth: PdfAnalysisDepthV1
  promptVersion: string
}): PdfAnalysisCacheRecordV1 {
  const now = Date.now()
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    cacheKey: input.cacheKey,
    providerId: input.selection.providerId,
    modelId: input.selection.modelId ?? '',
    promptVersion: input.promptVersion,
    depth: input.depth,
    sourceFiles: normalizedSourceFiles(input.files),
    documents: null,
    passes: {},
    synthesis: null,
    createdAt: now,
    updatedAt: now,
  }
}

export async function loadPdfAnalysisCache(cacheKey: string): Promise<PdfAnalysisCacheRecordV1 | null> {
  const database = await openDatabase()
  if (!database) return null
  const value = await new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(cacheKey)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const normalized = normalizeCacheRecord(value)
  if (!normalized || normalized.updatedAt < Date.now() - CACHE_TTL_MS) {
    if (value != null) await deletePdfAnalysisCache(cacheKey).catch(() => undefined)
    return null
  }
  return normalized
}

export async function savePdfAnalysisCache(record: PdfAnalysisCacheRecordV1): Promise<void> {
  const normalized = normalizeCacheRecord({ ...record, updatedAt: Date.now() })
  if (!normalized) throw new Error('invalid-pdf-analysis-cache')
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(normalized)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  await prunePdfAnalysisCaches(database)
}

async function prunePdfAnalysisCaches(database: IDBDatabase): Promise<void> {
  const records = await new Promise<PdfAnalysisCacheRecordV1[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve((request.result as unknown[]).flatMap((value) => {
      const normalized = normalizeCacheRecord(value)
      return normalized ? [normalized] : []
    }))
    request.onerror = () => reject(request.error)
  })
  const now = Date.now()
  const keysToDelete = records
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .filter((record, index) => index >= MAX_CACHE_RECORDS || record.updatedAt < now - CACHE_TTL_MS)
    .map((record) => record.cacheKey)
  if (keysToDelete.length === 0) return
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    keysToDelete.forEach((key) => store.delete(key))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function deletePdfAnalysisCache(cacheKey: string): Promise<void> {
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(cacheKey)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function clearPdfAnalysisCaches(): Promise<void> {
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).clear()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
