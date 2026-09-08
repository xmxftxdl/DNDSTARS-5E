import type { PdfDocumentRecordV2, PdfSourcePageV2 } from './pdfCampaignAnalysisV2'

const DATABASE_NAME = 'astral-trace-pdf-sources'
const DATABASE_VERSION = 2
const DOCUMENT_STORE = 'pdf-source-documents-v1'
const PAGE_STORE = 'pdf-source-pages-v1'
const JOB_SOURCE_STORE = 'pdf-job-sources-v1'
const DOCUMENT_INDEX = 'documentId'
const MAX_DOCUMENTS = 12
const MAX_TOTAL_CHARACTERS = 80 * 1024 * 1024
const MAX_TOTAL_SOURCE_BYTES = 512 * 1024 * 1024
const MAX_JOB_SOURCES = 4
const MAX_JOB_SOURCE_BYTES = 256 * 1024 * 1024
const JOB_SOURCE_TTL_MS = 14 * 24 * 60 * 60 * 1_000

interface StoredPdfDocumentV2 extends PdfDocumentRecordV2 {
  lastAccessedAt: number
  characterCount: number
  sourceFile?: {
    name: string
    type: string
    size: number
    lastModified: number
    blob: Blob
  }
}

interface StoredPdfSourcePageV2 extends PdfSourcePageV2 {
  key: string
}

interface StoredPdfJobSourceV1 {
  jobId: string
  campaignId: string
  files: Array<{
    name: string
    type: string
    size: number
    lastModified: number
    blob: Blob
  }>
  savedAt: number
  lastAccessedAt: number
  totalBytes: number
}

export interface PdfSourceRepository {
  saveDocument(document: PdfDocumentRecordV2, pages: PdfSourcePageV2[], sourceFile?: File): Promise<void>
  listDocuments(): Promise<PdfDocumentRecordV2[]>
  loadDocument(documentId: string): Promise<PdfDocumentRecordV2 | null>
  loadPage(documentId: string, page: number): Promise<PdfSourcePageV2 | null>
  loadOriginalFile(documentId: string): Promise<File | null>
  saveOriginalFile(documentId: string, file: File): Promise<void>
  deleteDocument(documentId: string): Promise<void>
  saveJobFiles(campaignId: string, jobId: string, files: readonly File[]): Promise<void>
  loadJobFiles(campaignId: string, jobId: string): Promise<File[] | null>
  deleteJobFiles(jobId: string): Promise<void>
  clearJobFiles(): Promise<void>
  prune(): Promise<void>
}

function pageKey(documentId: string, page: number): string {
  return `${documentId}:${page}`
}

function publicDocument(value: StoredPdfDocumentV2): PdfDocumentRecordV2 {
  return {
    id: value.id,
    name: value.name,
    mimeType: value.mimeType,
    sha256: value.sha256,
    sizeBytes: value.sizeBytes,
    pageCount: value.pageCount,
    extractedCharacters: value.extractedCharacters,
    scannedPages: [...value.scannedPages],
    ...(value.ocrPages ? { ocrPages: [...value.ocrPages] } : {}),
    ...(value.unresolvedPages ? { unresolvedPages: [...value.unresolvedPages] } : {}),
  }
}

function publicPage(value: StoredPdfSourcePageV2): PdfSourcePageV2 {
  return {
    documentId: value.documentId,
    documentSha256: value.documentSha256,
    documentName: value.documentName,
    page: value.page,
    text: value.text,
    normalizedText: value.normalizedText,
    textSha256: value.textSha256,
    extractionMethod: value.extractionMethod,
    ...(value.extractionConfidence != null ? { extractionConfidence: value.extractionConfidence } : {}),
    ...(value.textBlocks ? { textBlocks: value.textBlocks.map((block) => ({ ...block, bbox: [...block.bbox] })) } : {}),
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof globalThis.indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
        database.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(PAGE_STORE)) {
        const pages = database.createObjectStore(PAGE_STORE, { keyPath: 'key' })
        pages.createIndex(DOCUMENT_INDEX, 'documentId', { unique: false })
      }
      if (!database.objectStoreNames.contains(JOB_SOURCE_STORE)) {
        database.createObjectStore(JOB_SOURCE_STORE, { keyPath: 'jobId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('pdf-source-database-open-failed'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('pdf-source-transaction-failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('pdf-source-transaction-aborted'))
  })
}

async function touchDocument(database: IDBDatabase, documentId: string): Promise<void> {
  const current = await new Promise<StoredPdfDocumentV2 | undefined>((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
    const request = transaction.objectStore(DOCUMENT_STORE).get(documentId)
    request.onsuccess = () => resolve(request.result as StoredPdfDocumentV2 | undefined)
    request.onerror = () => reject(request.error)
  })
  if (!current) return
  const transaction = database.transaction(DOCUMENT_STORE, 'readwrite')
  transaction.objectStore(DOCUMENT_STORE).put({ ...current, lastAccessedAt: Date.now() })
  await transactionComplete(transaction)
}

async function deleteDocumentFromDatabase(database: IDBDatabase, documentId: string): Promise<void> {
  const transaction = database.transaction([DOCUMENT_STORE, PAGE_STORE], 'readwrite')
  transaction.objectStore(DOCUMENT_STORE).delete(documentId)
  const index = transaction.objectStore(PAGE_STORE).index(DOCUMENT_INDEX)
  const cursor = index.openKeyCursor(IDBKeyRange.only(documentId))
  cursor.onsuccess = () => {
    const result = cursor.result
    if (!result) return
    transaction.objectStore(PAGE_STORE).delete(result.primaryKey)
    result.continue()
  }
  await transactionComplete(transaction)
}

function validJobFiles(files: readonly File[]): boolean {
  if (files.length < 1 || files.length > 12) return false
  let totalBytes = 0
  for (const file of files) {
    if (!(file instanceof Blob) || !file.name || file.name.length > 500 || file.size < 1 || file.size > 100 * 1024 * 1024) return false
    totalBytes += file.size
  }
  return totalBytes <= MAX_JOB_SOURCE_BYTES
}

function validOriginalPdf(file: File): boolean {
  return file instanceof Blob && file.name.length > 0 && file.name.length <= 500 &&
    file.size > 0 && file.size <= 100 * 1024 * 1024 &&
    (!file.type || file.type === 'application/pdf')
}

function storedOriginalPdf(file: File): NonNullable<StoredPdfDocumentV2['sourceFile']> {
  return {
    name: file.name,
    type: file.type || 'application/pdf',
    size: file.size,
    lastModified: file.lastModified,
    blob: file.slice(0, file.size, file.type || 'application/pdf'),
  }
}

function restoredOriginalPdf(source: StoredPdfDocumentV2['sourceFile']): File | null {
  if (!source || !(source.blob instanceof Blob) || source.blob.size !== source.size) return null
  const file = new File([source.blob], source.name, { type: source.type || 'application/pdf', lastModified: source.lastModified })
  return validOriginalPdf(file) ? file : null
}

function restoredJobFiles(record: StoredPdfJobSourceV1): File[] | null {
  if (!record || !Array.isArray(record.files) || record.files.length < 1 || record.files.length > 12) return null
  const files: File[] = []
  for (const source of record.files) {
    if (!source || !(source.blob instanceof Blob) || typeof source.name !== 'string' || !source.name || source.name.length > 500) return null
    if (!Number.isSafeInteger(source.size) || source.size !== source.blob.size || source.size < 1 || source.size > 100 * 1024 * 1024) return null
    files.push(new File([source.blob], source.name, {
      type: source.type || 'application/pdf',
      lastModified: Number.isFinite(source.lastModified) ? source.lastModified : 0,
    }))
  }
  return validJobFiles(files) ? files : null
}

export function createIndexedDbPdfSourceRepository(): PdfSourceRepository {
  return {
    async saveDocument(document, pages, sourceFile) {
      const database = await openDatabase()
      if (!database) throw new Error('pdf-source-repository-unavailable')
      if (pages.some((page) => page.documentId !== document.id || page.documentSha256 !== document.sha256)) {
        throw new Error('invalid-pdf-source-pages')
      }
      if (sourceFile && !validOriginalPdf(sourceFile)) throw new Error('invalid-pdf-original-file')
      const transaction = database.transaction([DOCUMENT_STORE, PAGE_STORE], 'readwrite')
      transaction.objectStore(DOCUMENT_STORE).put({
        ...document,
        lastAccessedAt: Date.now(),
        characterCount: pages.reduce((sum, page) => sum + page.text.length, 0),
        ...(sourceFile ? { sourceFile: storedOriginalPdf(sourceFile) } : {}),
      } satisfies StoredPdfDocumentV2)
      const pageStore = transaction.objectStore(PAGE_STORE)
      for (const page of pages) pageStore.put({ ...page, key: pageKey(page.documentId, page.page) } satisfies StoredPdfSourcePageV2)
      await transactionComplete(transaction)
      await this.prune()
    },

    async listDocuments() {
      const database = await openDatabase()
      if (!database) return []
      const documents = await new Promise<StoredPdfDocumentV2[]>((resolve, reject) => {
        const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
        const request = transaction.objectStore(DOCUMENT_STORE).getAll()
        request.onsuccess = () => resolve(request.result as StoredPdfDocumentV2[])
        request.onerror = () => reject(request.error)
      })
      return documents
        .sort((left, right) => right.lastAccessedAt - left.lastAccessedAt)
        .map(publicDocument)
    },

    async loadDocument(documentId) {
      const database = await openDatabase()
      if (!database) return null
      const value = await new Promise<StoredPdfDocumentV2 | undefined>((resolve, reject) => {
        const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
        const request = transaction.objectStore(DOCUMENT_STORE).get(documentId)
        request.onsuccess = () => resolve(request.result as StoredPdfDocumentV2 | undefined)
        request.onerror = () => reject(request.error)
      })
      if (!value) return null
      await touchDocument(database, documentId).catch(() => undefined)
      return publicDocument(value)
    },

    async loadPage(documentId, page) {
      const database = await openDatabase()
      if (!database) return null
      const value = await new Promise<StoredPdfSourcePageV2 | undefined>((resolve, reject) => {
        const transaction = database.transaction(PAGE_STORE, 'readonly')
        const request = transaction.objectStore(PAGE_STORE).get(pageKey(documentId, page))
        request.onsuccess = () => resolve(request.result as StoredPdfSourcePageV2 | undefined)
        request.onerror = () => reject(request.error)
      })
      if (!value) return null
      await touchDocument(database, documentId).catch(() => undefined)
      return publicPage(value)
    },

    async loadOriginalFile(documentId) {
      const database = await openDatabase()
      if (!database) return null
      const value = await new Promise<StoredPdfDocumentV2 | undefined>((resolve, reject) => {
        const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
        const request = transaction.objectStore(DOCUMENT_STORE).get(documentId)
        request.onsuccess = () => resolve(request.result as StoredPdfDocumentV2 | undefined)
        request.onerror = () => reject(request.error)
      })
      if (!value) return null
      await touchDocument(database, documentId).catch(() => undefined)
      return restoredOriginalPdf(value.sourceFile)
    },

    async saveOriginalFile(documentId, file) {
      if (!validOriginalPdf(file)) throw new Error('invalid-pdf-original-file')
      const database = await openDatabase()
      if (!database) throw new Error('pdf-source-repository-unavailable')
      const current = await new Promise<StoredPdfDocumentV2 | undefined>((resolve, reject) => {
        const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
        const request = transaction.objectStore(DOCUMENT_STORE).get(documentId)
        request.onsuccess = () => resolve(request.result as StoredPdfDocumentV2 | undefined)
        request.onerror = () => reject(request.error)
      })
      if (!current) throw new Error('pdf-source-document-missing')
      const transaction = database.transaction(DOCUMENT_STORE, 'readwrite')
      transaction.objectStore(DOCUMENT_STORE).put({ ...current, sourceFile: storedOriginalPdf(file), lastAccessedAt: Date.now() })
      await transactionComplete(transaction)
      await this.prune()
    },

    async deleteDocument(documentId) {
      const database = await openDatabase()
      if (!database) return
      await deleteDocumentFromDatabase(database, documentId)
    },

    async saveJobFiles(campaignId, jobId, files) {
      if (!campaignId || !jobId || !validJobFiles(files)) throw new Error('invalid-pdf-job-source')
      const database = await openDatabase()
      if (!database) throw new Error('pdf-source-repository-unavailable')
      const now = Date.now()
      const record: StoredPdfJobSourceV1 = {
        jobId,
        campaignId,
        files: files.map((file) => ({
          name: file.name,
          type: file.type || 'application/pdf',
          size: file.size,
          lastModified: file.lastModified,
          blob: file.slice(0, file.size, file.type || 'application/pdf'),
        })),
        savedAt: now,
        lastAccessedAt: now,
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      }
      const transaction = database.transaction(JOB_SOURCE_STORE, 'readwrite')
      transaction.objectStore(JOB_SOURCE_STORE).put(record)
      await transactionComplete(transaction)
      await this.prune()
    },

    async loadJobFiles(campaignId, jobId) {
      const database = await openDatabase()
      if (!database) return null
      const record = await new Promise<StoredPdfJobSourceV1 | undefined>((resolve, reject) => {
        const transaction = database.transaction(JOB_SOURCE_STORE, 'readonly')
        const request = transaction.objectStore(JOB_SOURCE_STORE).get(jobId)
        request.onsuccess = () => resolve(request.result as StoredPdfJobSourceV1 | undefined)
        request.onerror = () => reject(request.error)
      })
      if (!record || record.campaignId !== campaignId || record.savedAt < Date.now() - JOB_SOURCE_TTL_MS) {
        if (record) await this.deleteJobFiles(jobId).catch(() => undefined)
        return null
      }
      const files = restoredJobFiles(record)
      if (!files) {
        await this.deleteJobFiles(jobId).catch(() => undefined)
        return null
      }
      const transaction = database.transaction(JOB_SOURCE_STORE, 'readwrite')
      transaction.objectStore(JOB_SOURCE_STORE).put({ ...record, lastAccessedAt: Date.now() })
      await transactionComplete(transaction)
      return files
    },

    async deleteJobFiles(jobId) {
      const database = await openDatabase()
      if (!database) return
      const transaction = database.transaction(JOB_SOURCE_STORE, 'readwrite')
      transaction.objectStore(JOB_SOURCE_STORE).delete(jobId)
      await transactionComplete(transaction)
    },

    async clearJobFiles() {
      const database = await openDatabase()
      if (!database) return
      const transaction = database.transaction(JOB_SOURCE_STORE, 'readwrite')
      transaction.objectStore(JOB_SOURCE_STORE).clear()
      await transactionComplete(transaction)
    },

    async prune() {
      const database = await openDatabase()
      if (!database) return
      const documents = await new Promise<StoredPdfDocumentV2[]>((resolve, reject) => {
        const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
        const request = transaction.objectStore(DOCUMENT_STORE).getAll()
        request.onsuccess = () => resolve(request.result as StoredPdfDocumentV2[])
        request.onerror = () => reject(request.error)
      })
      const newestFirst = [...documents].sort((left, right) => right.lastAccessedAt - left.lastAccessedAt)
      let keptCharacters = 0
      let keptSourceBytes = 0
      const expiredIds: string[] = []
      newestFirst.forEach((document, index) => {
        keptCharacters += document.characterCount
        keptSourceBytes += document.sourceFile?.size ?? 0
        if (index >= MAX_DOCUMENTS || keptCharacters > MAX_TOTAL_CHARACTERS || keptSourceBytes > MAX_TOTAL_SOURCE_BYTES) expiredIds.push(document.id)
      })
      for (const documentId of expiredIds) await deleteDocumentFromDatabase(database, documentId)

      const jobSources = await new Promise<StoredPdfJobSourceV1[]>((resolve, reject) => {
        const transaction = database.transaction(JOB_SOURCE_STORE, 'readonly')
        const request = transaction.objectStore(JOB_SOURCE_STORE).getAll()
        request.onsuccess = () => resolve(request.result as StoredPdfJobSourceV1[])
        request.onerror = () => reject(request.error)
      })
      let keptBytes = 0
      const now = Date.now()
      const expiredJobIds = jobSources
        .sort((left, right) => right.lastAccessedAt - left.lastAccessedAt)
        .filter((record, index) => {
          keptBytes += Number.isFinite(record.totalBytes) ? record.totalBytes : MAX_JOB_SOURCE_BYTES
          return index >= MAX_JOB_SOURCES || keptBytes > MAX_JOB_SOURCE_BYTES || record.savedAt < now - JOB_SOURCE_TTL_MS
        })
        .map((record) => record.jobId)
      if (expiredJobIds.length > 0) {
        const transaction = database.transaction(JOB_SOURCE_STORE, 'readwrite')
        const store = transaction.objectStore(JOB_SOURCE_STORE)
        expiredJobIds.forEach((jobId) => store.delete(jobId))
        await transactionComplete(transaction)
      }
    },
  }
}

export const pdfSourceRepository = createIndexedDbPdfSourceRepository()

export function createMemoryPdfSourceRepositoryForTests(options: { maxDocuments?: number } = {}): PdfSourceRepository {
  const documents = new Map<string, { document: PdfDocumentRecordV2; pages: Map<number, PdfSourcePageV2>; sourceFile?: File; accessed: number }>()
  const jobSources = new Map<string, { campaignId: string; files: File[]; accessed: number }>()
  return {
    async saveDocument(document, pages, sourceFile) {
      if (sourceFile && !validOriginalPdf(sourceFile)) throw new Error('invalid-pdf-original-file')
      documents.set(document.id, { document: structuredClone(document), pages: new Map(pages.map((page) => [page.page, structuredClone(page)])), sourceFile: sourceFile ? new File([sourceFile], sourceFile.name, { type: sourceFile.type, lastModified: sourceFile.lastModified }) : undefined, accessed: Date.now() })
      await this.prune()
    },
    async listDocuments() {
      return [...documents.values()]
        .sort((left, right) => right.accessed - left.accessed)
        .map((entry) => structuredClone(entry.document))
    },
    async loadDocument(documentId) {
      const found = documents.get(documentId)
      if (!found) return null
      found.accessed = Date.now()
      return structuredClone(found.document)
    },
    async loadPage(documentId, page) {
      const found = documents.get(documentId)
      if (!found) return null
      found.accessed = Date.now()
      return structuredClone(found.pages.get(page) ?? null)
    },
    async loadOriginalFile(documentId) {
      const found = documents.get(documentId)
      if (!found?.sourceFile) return null
      found.accessed = Date.now()
      return new File([found.sourceFile], found.sourceFile.name, { type: found.sourceFile.type, lastModified: found.sourceFile.lastModified })
    },
    async saveOriginalFile(documentId, file) {
      if (!validOriginalPdf(file)) throw new Error('invalid-pdf-original-file')
      const found = documents.get(documentId)
      if (!found) throw new Error('pdf-source-document-missing')
      found.sourceFile = new File([file], file.name, { type: file.type, lastModified: file.lastModified })
      found.accessed = Date.now()
      await this.prune()
    },
    async deleteDocument(documentId) { documents.delete(documentId) },
    async saveJobFiles(campaignId, jobId, files) {
      if (!validJobFiles(files)) throw new Error('invalid-pdf-job-source')
      jobSources.set(jobId, { campaignId, files: files.map((file) => new File([file], file.name, { type: file.type, lastModified: file.lastModified })), accessed: Date.now() })
    },
    async loadJobFiles(campaignId, jobId) {
      const source = jobSources.get(jobId)
      if (!source || source.campaignId !== campaignId) return null
      source.accessed = Date.now()
      return source.files.map((file) => new File([file], file.name, { type: file.type, lastModified: file.lastModified }))
    },
    async deleteJobFiles(jobId) { jobSources.delete(jobId) },
    async clearJobFiles() { jobSources.clear() },
    async prune() {
      const maximum = options.maxDocuments ?? MAX_DOCUMENTS
      const remove = [...documents.entries()].sort((left, right) => right[1].accessed - left[1].accessed).slice(maximum)
      remove.forEach(([id]) => documents.delete(id))
    },
  }
}
