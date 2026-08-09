import type { PdfDocumentRecordV2, PdfSourcePageV2 } from './pdfCampaignAnalysisV2'

const DATABASE_NAME = 'astral-trace-pdf-sources'
const DATABASE_VERSION = 1
const DOCUMENT_STORE = 'pdf-source-documents-v1'
const PAGE_STORE = 'pdf-source-pages-v1'
const DOCUMENT_INDEX = 'documentId'
const MAX_DOCUMENTS = 12
const MAX_TOTAL_CHARACTERS = 80 * 1024 * 1024

interface StoredPdfDocumentV2 extends PdfDocumentRecordV2 {
  lastAccessedAt: number
  characterCount: number
}

interface StoredPdfSourcePageV2 extends PdfSourcePageV2 {
  key: string
}

export interface PdfSourceRepository {
  saveDocument(document: PdfDocumentRecordV2, pages: PdfSourcePageV2[]): Promise<void>
  loadDocument(documentId: string): Promise<PdfDocumentRecordV2 | null>
  loadPage(documentId: string, page: number): Promise<PdfSourcePageV2 | null>
  deleteDocument(documentId: string): Promise<void>
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

export function createIndexedDbPdfSourceRepository(): PdfSourceRepository {
  return {
    async saveDocument(document, pages) {
      const database = await openDatabase()
      if (!database) throw new Error('pdf-source-repository-unavailable')
      if (pages.some((page) => page.documentId !== document.id || page.documentSha256 !== document.sha256)) {
        throw new Error('invalid-pdf-source-pages')
      }
      const transaction = database.transaction([DOCUMENT_STORE, PAGE_STORE], 'readwrite')
      transaction.objectStore(DOCUMENT_STORE).put({
        ...document,
        lastAccessedAt: Date.now(),
        characterCount: pages.reduce((sum, page) => sum + page.text.length, 0),
      } satisfies StoredPdfDocumentV2)
      const pageStore = transaction.objectStore(PAGE_STORE)
      for (const page of pages) pageStore.put({ ...page, key: pageKey(page.documentId, page.page) } satisfies StoredPdfSourcePageV2)
      await transactionComplete(transaction)
      await this.prune()
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

    async deleteDocument(documentId) {
      const database = await openDatabase()
      if (!database) return
      await deleteDocumentFromDatabase(database, documentId)
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
      const expiredIds: string[] = []
      newestFirst.forEach((document, index) => {
        keptCharacters += document.characterCount
        if (index >= MAX_DOCUMENTS || keptCharacters > MAX_TOTAL_CHARACTERS) expiredIds.push(document.id)
      })
      for (const documentId of expiredIds) await deleteDocumentFromDatabase(database, documentId)
    },
  }
}

export const pdfSourceRepository = createIndexedDbPdfSourceRepository()

export function createMemoryPdfSourceRepositoryForTests(options: { maxDocuments?: number } = {}): PdfSourceRepository {
  const documents = new Map<string, { document: PdfDocumentRecordV2; pages: Map<number, PdfSourcePageV2>; accessed: number }>()
  return {
    async saveDocument(document, pages) {
      documents.set(document.id, { document: structuredClone(document), pages: new Map(pages.map((page) => [page.page, structuredClone(page)])), accessed: Date.now() })
      await this.prune()
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
    async deleteDocument(documentId) { documents.delete(documentId) },
    async prune() {
      const maximum = options.maxDocuments ?? MAX_DOCUMENTS
      const remove = [...documents.entries()].sort((left, right) => right[1].accessed - left[1].accessed).slice(maximum)
      remove.forEach(([id]) => documents.delete(id))
    },
  }
}
