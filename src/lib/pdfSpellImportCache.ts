import { AI_MODEL_POLICY } from '../../shared/ai-model-policy.mjs'
import { DND5E_LOCAL_CONTENT_AI_SDK_GUIDE } from '../rulesets/dnd5e/localContentAiSdkGuide'
import { DND5E_LOCAL_CONTENT_AI_FORMAT_GUIDE, DND5E_LOCAL_CONTENT_AI_SYSTEM_PROMPT, validateDnd5eLocalContentAiDraft, type Dnd5eLocalContentAiDraftV1 } from '../rulesets/dnd5e/localContentAiImport'
import { finalizePdfExtractionOutput, type PdfSpellSource, type PdfSpellWindow } from '../rulesets/dnd5e/pdfSpellImport'
import type { PdfNonTextPageReview } from '../rulesets/dnd5e/pdfNonTextPageReview'

export interface PdfSpellWindowJob { window: PdfSpellWindow; done?: boolean; error?: string; warnings?: string[] }
export interface PdfSpellJob {
  source: PdfSpellSource
  draft?: Dnd5eLocalContentAiDraftV1
  /** Retained only as repair input; excluded from export and successful draft counts. */
  rejectedDraft?: Dnd5eLocalContentAiDraftV1
  error?: string
  coverage?: string
}
export interface PdfSpellCacheIdentity { pdfSha256: string; recipeSha256: string; sourceRecipeSha256?: string }
export interface PdfSpellBatch {
  schemaVersion: 1
  windows: PdfSpellWindowJob[]
  spells: PdfSpellJob[]
  classReference?: string
  identity?: PdfSpellCacheIdentity
  excludedPages?: number[]
  pageReviews?: PdfNonTextPageReview[]
  /** Ephemeral restore notice; never a coverage or certification claim. */
  restoredSourceOnly?: boolean
  /** Source boundaries changed on read; these drafts must be regenerated. */
  revisedSourceIds?: string[]
}
export interface PdfSpellCacheStore {
  get(key: string): Promise<unknown>
  put(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}

export async function pdfSpellSha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Bump the pipeline revision when PDF parsing/extraction or target-guide semantics change.
const recipe = JSON.stringify({ pipeline: 'pdf-content-12-verified-parent-boundaries', model: AI_MODEL_POLICY.generalModelId, system: DND5E_LOCAL_CONTENT_AI_SYSTEM_PROMPT, format: DND5E_LOCAL_CONTENT_AI_FORMAT_GUIDE, sdk: DND5E_LOCAL_CONTENT_AI_SDK_GUIDE })
let recipeHash: Promise<string> | undefined
function currentRecipe() { return recipeHash ??= pdfSpellSha256(recipe) }
async function scopedRecipe(excludedPages: readonly number[] = []) {
  return pdfSpellSha256(JSON.stringify({ recipeSha256: await currentRecipe(), pipeline: 5, reasoningEffort: 'medium', excludedPages: [...new Set(excludedPages)].sort((a, b) => a - b) }))
}
async function scopedSourceRecipe(excludedPages: readonly number[] = []) {
  // Independent of authoring SDK changes. Bump when source extraction, OCR,
  // source-boundary validation, or non-text page review semantics change.
  return pdfSpellSha256(JSON.stringify({ extraction: 'pdf-source-9-verified-parent-boundaries', excludedPages: [...new Set(excludedPages)].sort((a, b) => a - b) }))
}

export async function pdfSpellCacheIdentity(file: Pick<Blob, 'arrayBuffer'>, excludedPages: readonly number[] = []): Promise<PdfSpellCacheIdentity> {
  const [pdfSha256, recipeSha256, sourceRecipeSha256] = await Promise.all([file.arrayBuffer().then(pdfSpellSha256), scopedRecipe(excludedPages), scopedSourceRecipe(excludedPages)])
  return { pdfSha256, recipeSha256, sourceRecipeSha256 }
}

function validBatch(value: unknown): value is PdfSpellBatch {
  if (!value || typeof value !== 'object') return false
  const batch = value as PdfSpellBatch
  const strings = (v: unknown) => Array.isArray(v) && v.every((entry) => typeof entry === 'string')
  return batch.schemaVersion === 1 && Array.isArray(batch.windows) && Array.isArray(batch.spells) &&
    (batch.classReference === undefined || typeof batch.classReference === 'string') &&
    (batch.excludedPages === undefined || (Array.isArray(batch.excludedPages) && batch.excludedPages.every(page => Number.isInteger(page) && page > 0))) &&
    (batch.pageReviews === undefined || (Array.isArray(batch.pageReviews) && batch.pageReviews.every(review => Number.isInteger(review.page) && review.page > 0 &&
      ['illustration-only', 'blank', 'contains-text-or-rules', 'uncertain'].includes(review.classification) && typeof review.reason === 'string' && review.reason.length <= 1000))) &&
    batch.windows.every((job) => job?.window && typeof job.window.id === 'string' && typeof job.window.documentName === 'string' &&
      Number.isInteger(job.window.startPage) && Number.isInteger(job.window.ownedEndPage) && Array.isArray(job.window.pages) &&
      job.window.pages.every((page) => Number.isInteger(page.page) && typeof page.text === 'string') &&
      (job.done === undefined || typeof job.done === 'boolean') && (job.warnings === undefined || strings(job.warnings))) &&
    batch.spells.every((job) => job?.source && typeof job.source.id === 'string' && typeof job.source.name === 'string' &&
      (job.source.kind === undefined || ['spell', 'feature', 'feat', 'subclass'].includes(job.source.kind)) &&
      typeof job.source.documentName === 'string' && typeof job.source.text === 'string' && Number.isInteger(job.source.startPage) &&
      Number.isInteger(job.source.endPage) && (job.draft === undefined || validateDnd5eLocalContentAiDraft(job.draft)) &&
      (job.rejectedDraft === undefined || validateDnd5eLocalContentAiDraft(job.rejectedDraft)))
}

const cacheKey = (identity: PdfSpellCacheIdentity) => `pdf:${identity.pdfSha256}:${identity.recipeSha256}`
const sourceKey = (identity: PdfSpellCacheIdentity) => `pdf-source:${identity.pdfSha256}:${identity.sourceRecipeSha256}`
const sessionKey = (scope: string) => `session:${scope}`

/** Cached source text is evidence to recheck, not a previous completeness certificate. */
function revalidateCachedSources(batch: PdfSpellBatch): PdfSpellBatch | null {
  const jobs = new Map<string, PdfSpellJob>()
  const revisedSourceIds: string[] = []
  try {
    const windows = batch.windows.map(job => {
      const owned = batch.spells.filter(({ source }) => source.documentName === job.window.documentName &&
        source.startPage >= job.window.startPage && source.startPage <= job.window.ownedEndPage)
      if (!job.done) {
        if (owned.length) throw new Error('pdf-cache-unfinished-source-window')
        return job
      }
      const result = finalizePdfExtractionOutput(job.window, { spells: owned.map(({ source }) => source), warnings: job.warnings ?? [] },
        owned.every(({ source }) => source.kind !== undefined))
      // A changed inventory needs fresh extraction; never silently drop an old entry.
      if (result.spells.length !== owned.length) throw new Error('pdf-cache-inventory-changed')
      for (const source of result.spells) {
        const matches = owned.filter(old => old.source.name === source.name && old.source.startPage === source.startPage)
        if (matches.length !== 1) throw new Error('pdf-cache-source-ambiguous')
        const previous = matches[0]
        if (jobs.has(previous.source.id)) throw new Error('pdf-cache-source-duplicate')
        const changed = previous.source.text !== source.text || previous.source.endPage !== source.endPage || previous.source.kind !== source.kind
        if (changed) revisedSourceIds.push(previous.source.id)
        jobs.set(previous.source.id, changed
          ? { source: { ...source, id: previous.source.id }, error: '原文边界已修正，旧配置已移除；请继续转换。' }
          : previous)
      }
      return { ...job, warnings: result.warnings }
    })
    if (jobs.size !== batch.spells.length) return null
    return { ...batch, windows, spells: batch.spells.map(job => jobs.get(job.source.id)!),
      ...(revisedSourceIds.length ? { revisedSourceIds } : {}) }
  } catch { return null }
}

/** Cache artifacts, never certificates. All restored drafts must pass the current Host again. */
export class PdfSpellImportCache {
  private readonly store: PdfSpellCacheStore

  constructor(store: PdfSpellCacheStore) { this.store = store }

  async save(scope: string, batch: PdfSpellBatch): Promise<void> {
    if (!validBatch(batch)) throw new Error('pdf-spell-cache-invalid-batch')
    // Explicit field projection prevents UI/serialized "certified" flags becoming trusted state.
    const payload: PdfSpellBatch = {
      schemaVersion: 1, identity: batch.identity, classReference: batch.classReference,
      excludedPages: batch.excludedPages,
      pageReviews: batch.pageReviews,
      windows: batch.windows.map(({ window, done, error, warnings }) => ({ window, done, error, warnings })),
      spells: batch.spells.map(({ source, draft, rejectedDraft, error }) => ({ source, draft, rejectedDraft, error })),
    }
    const json = JSON.stringify(payload)
    const record = { schemaVersion: 1, digest: await pdfSpellSha256(json), json, updatedAt: Date.now() }
    if (batch.identity) {
      await this.store.put(cacheKey(batch.identity), record)
      if (batch.identity.sourceRecipeSha256 === await scopedSourceRecipe(batch.excludedPages)) {
        const sourceJson = JSON.stringify({ ...payload, spells: payload.spells.map(({ source }) => ({ source })) })
        await this.store.put(sourceKey(batch.identity), { schemaVersion: 1, digest: await pdfSpellSha256(sourceJson), json: sourceJson, updatedAt: Date.now() })
      }
      await this.store.put(sessionKey(scope), { schemaVersion: 1, identity: batch.identity })
    } else await this.store.put(sessionKey(scope), record)
  }

  private async read(key: string, expected?: PdfSpellCacheIdentity): Promise<PdfSpellBatch | null> {
    const record = await this.store.get(key) as { schemaVersion?: number; json?: string; digest?: string } | undefined
    if (!record || record.schemaVersion !== 1 || typeof record.json !== 'string' || await pdfSpellSha256(record.json) !== record.digest) return null
    let value: unknown
    try { value = JSON.parse(record.json) } catch { return null }
    if (!validBatch(value)) return null
    if (value.identity && value.identity.recipeSha256 !== await scopedRecipe(value.excludedPages)) return null
    if (expected && (value.identity?.pdfSha256 !== expected.pdfSha256 || value.identity.recipeSha256 !== expected.recipeSha256)) return null
    return revalidateCachedSources(value)
  }

  private async readSource(identity: PdfSpellCacheIdentity, requireCurrentRecipe: boolean): Promise<PdfSpellBatch | null> {
    if (!identity.sourceRecipeSha256) return null
    const record = await this.store.get(sourceKey(identity)) as { schemaVersion?: number; json?: string; digest?: string } | undefined
    if (!record || record.schemaVersion !== 1 || typeof record.json !== 'string' || await pdfSpellSha256(record.json) !== record.digest) return null
    let value: unknown
    try { value = JSON.parse(record.json) } catch { return null }
    if (!validBatch(value) || value.identity?.pdfSha256 !== identity.pdfSha256 ||
      value.identity.sourceRecipeSha256 !== identity.sourceRecipeSha256 ||
      identity.sourceRecipeSha256 !== await scopedSourceRecipe(value.excludedPages)) return null
    const recipeSha256 = await scopedRecipe(value.excludedPages)
    if (requireCurrentRecipe && identity.recipeSha256 !== recipeSha256) return null
    return revalidateCachedSources({ ...value, identity: { ...identity, recipeSha256 }, restoredSourceOnly: true,
      spells: value.spells.map(({ source }) => ({ source })) })
  }

  async load(identity: PdfSpellCacheIdentity) {
    const value = await this.read(cacheKey(identity), identity)
    if (value) return value
    // Corrupt current drafts must remain an explicit cache miss, not be hidden
    // by falling back to another artifact with the same PDF bytes.
    if (await this.store.get(cacheKey(identity)) != null) return null
    return this.readSource(identity, true)
  }
  async restore(scope: string) {
    const pointer = await this.store.get(sessionKey(scope)) as { schemaVersion?: number; identity?: PdfSpellCacheIdentity } | undefined
    if (pointer?.schemaVersion === 1 && typeof pointer.identity?.pdfSha256 === 'string' && typeof pointer.identity.recipeSha256 === 'string') {
      const restored = await this.load(pointer.identity)
      if (restored) return restored
      // An old authoring recipe may still have current, source-only evidence.
      const sourceOnly = await this.readSource(pointer.identity, false)
      return sourceOnly?.identity?.recipeSha256 !== pointer.identity.recipeSha256 ? sourceOnly : null
    }
    return this.read(sessionKey(scope))
  }
  async clear(scope: string, identity?: PdfSpellCacheIdentity): Promise<void> {
    if (identity) {
      await this.store.remove(cacheKey(identity))
      if (identity.sourceRecipeSha256) await this.store.remove(sourceKey(identity))
    }
    await this.store.remove(sessionKey(scope))
  }
}

export function browserPdfSpellCacheStore(): PdfSpellCacheStore {
  async function operation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    if (typeof indexedDB === 'undefined') throw new Error('此浏览器不支持 PDF 本地缓存。')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('astral-trace-pdf-spell-cache', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('artifacts')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('PDF 缓存数据库被其他窗口占用，请关闭旧窗口后重试。'))
    })
    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = db.transaction('artifacts', mode)
        const request = run(transaction.objectStore('artifacts'))
        transaction.oncomplete = () => resolve(request.result)
        transaction.onerror = () => reject(transaction.error ?? request.error)
        transaction.onabort = () => reject(transaction.error ?? new Error('PDF 缓存写入中断。'))
      })
    } finally { db.close() }
  }
  return {
    get: (key) => operation('readonly', (store) => store.get(key)),
    put: async (key, value) => { await operation('readwrite', (store) => store.put(value, key)) },
    remove: async (key) => { await operation('readwrite', (store) => store.delete(key)) },
  }
}


