import {
  DND5E_CONTENT_PACKAGE_FORMAT,
  DND5E_CONTENT_PACKAGE_SCHEMA_VERSION,
  encodeDnd5eContentPackageV2,
  parseDnd5eContentPackageV2,
  type Dnd5eContentPackageContributionsV2,
  type Dnd5eContentPackageV2,
} from './contentPackageV2'
import {
  validateDnd5ePluginImageAsset,
  type Dnd5ePluginImageAssetDefinition,
  type Dnd5ePluginImageMediaType,
} from './pluginAssets'
import type { Dnd5eRulesPluginManifest } from './pluginApi'

export const DND5E_LOCAL_CONTENT_COLLECTION_FORMAT = 'dndstars5e-local-collection' as const
export const DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION = 1 as const
export const DND5E_LOCAL_COLLECTION_TEXT_FILE_MAX_BYTES = 8 * 1024 * 1024
export const DND5E_LOCAL_COLLECTION_MAX_FILES = 2048

type CollectionKey = keyof Dnd5eContentPackageContributionsV2
type ImageTargetCategory = 'race' | 'feature' | 'feat' | 'spell' | 'item' | 'monster'
type ImageTargetSlot = 'icon' | 'portrait' | 'tokenPortrait' | 'initiativePortrait'

interface LocalCollectionImageTarget {
  category: ImageTargetCategory
  id: string
  slot?: ImageTargetSlot
}

interface LocalCollectionImage {
  id: string
  file: string
  /**
   * This declaration stays in collection.json and is never copied to the room package.
   * It is an operator assertion, not automatic proof of image rights.
   */
  origin: 'ai-generated' | 'user-owned' | 'licensed-for-use'
  targets: readonly LocalCollectionImageTarget[]
  prompt?: string
  model?: string
}

interface LocalContentCollection {
  format: typeof DND5E_LOCAL_CONTENT_COLLECTION_FORMAT
  schemaVersion: typeof DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION
  manifest: Omit<Dnd5eRulesPluginManifest, 'distributionPolicy'> & {
    distributionPolicy?: 'room-ephemeral'
  }
  provenance?: {
    sourceTitle?: string
    sourceFingerprint?: string
  }
  content?: Partial<Dnd5eContentPackageContributionsV2>
  /** Each referenced JSON file is an array of entries for its collection key. */
  json?: Partial<Record<CollectionKey, string>>
  csv?: Partial<Record<CollectionKey, string>>
  expected?: Partial<Record<CollectionKey, {
    count?: number
    ids?: readonly string[]
    imageRequired?: boolean
  }>>
  images?: readonly LocalCollectionImage[]
}

export interface Dnd5eLocalContentCollectionCategoryAudit {
  actual: number
  expected?: number
  countShortfall: number
  missingIds: readonly string[]
  imageRequired: boolean
  missingImageIds: readonly string[]
}

export interface Dnd5eLocalContentCollectionAudit {
  schemaVersion: 1
  package: { id: string; version: string }
  privacy: {
    includesSourceText: false
    includesImageData: false
    includesImagePrompts: false
    includesHumanReadableContentNames: false
  }
  complete: boolean
  totals: {
    entries: number
    expectedEntries: number
    countShortfall: number
    missingIds: number
    missingImages: number
  }
  categories: Record<CollectionKey, Dnd5eLocalContentCollectionCategoryAudit>
  visuals: {
    declaredImages: number
    aiGeneratedImages: number
    boundTargets: number
  }
}

export interface CompiledDnd5eLocalContentCollection {
  package: Dnd5eContentPackageV2
  bytes: ArrayBuffer
  fileName: string
  sourceFileName: string
  audit: Dnd5eLocalContentCollectionAudit
}

const COLLECTION_KEYS: readonly CollectionKey[] = [
  'races',
  'backgrounds',
  'features',
  'feats',
  'spells',
  'items',
  'abilityGenerationMethods',
  'headlessActions',
  'subclasses',
  'monsters',
]
const COLLECTION_KEY_SET = new Set<string>(COLLECTION_KEYS)
const IMAGE_ID = /^[a-z0-9][a-z0-9._-]{0,99}$/
const ENTRY_ID = /^[a-z0-9][a-z0-9._-]{0,99}$/
const IMAGE_TARGET_COLLECTION: Readonly<Partial<Record<CollectionKey, ImageTargetCategory>>> = {
  races: 'race',
  features: 'feature',
  feats: 'feat',
  spells: 'spell',
  items: 'item',
  monsters: 'monster',
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
}

function normalizedPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/')
}

function filePath(file: File): string {
  const relative = 'webkitRelativePath' in file && typeof file.webkitRelativePath === 'string'
    ? file.webkitRelativePath
    : ''
  return normalizedPath(relative || file.name)
}

function directoryName(value: string): string {
  const index = value.lastIndexOf('/')
  return index < 0 ? '' : value.slice(0, index)
}

function resolveCollectionPath(baseDirectory: string, reference: string): string {
  const normalized = normalizedPath(reference)
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`合集包含不安全的文件路径：${reference}`)
  }
  return baseDirectory ? `${baseDirectory}/${normalized}` : normalized
}

function csvRows(source: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
      continue
    }
    if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (quoted) throw new Error('CSV 存在未闭合的双引号')
  if (cell || row.length > 0) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows.filter((candidate) => candidate.some((entry) => entry.trim()))
}

function csvValue(source: string): unknown {
  const value = source.trim()
  if (!value) return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value)
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value)
    } catch {
      throw new Error(`CSV 单元格不是有效 JSON：${value.slice(0, 80)}`)
    }
  }
  return value
}

function parseCollectionCsv(source: string, label: string): Record<string, unknown>[] {
  const rows = csvRows(source.replace(/^\uFEFF/, ''))
  if (rows.length < 2) return []
  const headers = rows[0].map((header) => header.trim())
  if (headers.some((header) => !header || ['__proto__', 'prototype', 'constructor'].includes(header))) {
    throw new Error(`${label} 的 CSV 表头无效`)
  }
  if (new Set(headers).size !== headers.length) throw new Error(`${label} 的 CSV 表头重复`)
  return rows.slice(1).map((row, rowIndex) => {
    if (row.length > headers.length) throw new Error(`${label} 第 ${rowIndex + 2} 行列数过多`)
    const entry: Record<string, unknown> = {}
    for (let index = 0; index < headers.length; index += 1) {
      const value = csvValue(row[index] ?? '')
      if (value !== undefined) entry[headers[index]] = value
    }
    return entry
  })
}

function mediaTypeForFile(file: File): Dnd5ePluginImageMediaType {
  const declared = file.type.toLowerCase()
  if (declared === 'image/png' || declared === 'image/jpeg' || declared === 'image/webp') return declared
  const extension = file.name.toLowerCase().split('.').pop()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  throw new Error(`不支持的图片格式：${file.name}；只允许 PNG、JPEG 或 WebP`)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return globalThis.btoa(binary)
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} 必须是非空字符串`)
  return value.trim()
}

function collectionFromJson(value: unknown): LocalContentCollection {
  if (!plainObject(value) ||
    value.format !== DND5E_LOCAL_CONTENT_COLLECTION_FORMAT ||
    value.schemaVersion !== DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION ||
    !plainObject(value.manifest)
  ) throw new Error('collection.json 不是受支持的 DNDSTARS 本地合集')
  if (value.content != null && !plainObject(value.content)) throw new Error('collection.json 的 content 必须是对象')
  if (value.json != null && !plainObject(value.json)) throw new Error('collection.json 的 json 必须是对象')
  if (value.csv != null && !plainObject(value.csv)) throw new Error('collection.json 的 csv 必须是对象')
  if (value.expected != null && !plainObject(value.expected)) throw new Error('collection.json 的 expected 必须是对象')
  if (value.images != null && !Array.isArray(value.images)) throw new Error('collection.json 的 images 必须是数组')
  return value as unknown as LocalContentCollection
}

function mutableContent(
  collection: LocalContentCollection,
): Record<CollectionKey, Record<string, unknown>[]> {
  return Object.fromEntries(COLLECTION_KEYS.map((key) => {
    const entries = collection.content?.[key] ?? []
    if (!Array.isArray(entries) || entries.some((entry) => !plainObject(entry))) {
      throw new Error(`collection.json 的 content.${key} 必须是对象数组`)
    }
    return [key, structuredClone(entries)]
  })) as Record<CollectionKey, Record<string, unknown>[]>
}

function bindImageTarget(
  content: Record<CollectionKey, Record<string, unknown>[]>,
  target: LocalCollectionImageTarget,
  assetId: string,
  dataUrl: string,
): void {
  const key = target.category === 'race'
    ? 'races'
    : target.category === 'feature'
      ? 'features'
      : target.category === 'feat'
        ? 'feats'
        : target.category === 'spell'
          ? 'spells'
          : target.category === 'item'
            ? 'items'
            : 'monsters'
  const entry = content[key].find((candidate) => candidate.id === target.id)
  if (!entry) throw new Error(`图片 ${assetId} 指向不存在的 ${target.category}:${target.id}`)
  if (target.category !== 'monster') {
    if (target.slot != null && target.slot !== 'icon') {
      throw new Error(`${target.category}:${target.id} 只支持 icon 图片槽`)
    }
    entry.iconAssetId = assetId
    return
  }
  const slot = target.slot ?? 'portrait'
  if (slot === 'icon') throw new Error(`monster:${target.id} 不支持 icon 图片槽`)
  if (slot === 'portrait' || slot === 'tokenPortrait') entry.tokenPortrait = dataUrl
  if (slot === 'portrait' || slot === 'initiativePortrait') entry.initiativePortrait = dataUrl
}

async function readCollectionTextFile(file: File, label: string): Promise<string> {
  if (file.size > DND5E_LOCAL_COLLECTION_TEXT_FILE_MAX_BYTES) {
    throw new Error(`${label} 超过 8 MiB 本地文本文件上限`)
  }
  return file.text()
}

function parseCollectionJsonEntries(source: string, key: CollectionKey, label: string): Record<string, unknown>[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(source.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error(`${label} 不是有效 JSON`)
  }
  if (!Array.isArray(parsed) || parsed.some((entry) => !plainObject(entry))) {
    throw new Error(`${label} 必须是 ${key} 条目的 JSON 数组`)
  }
  return parsed
}

function expectedCollection(
  collection: LocalContentCollection,
): Partial<Record<CollectionKey, { count?: number; ids: string[]; imageRequired: boolean }>> {
  const result: Partial<Record<CollectionKey, { count?: number; ids: string[]; imageRequired: boolean }>> = {}
  for (const [key, raw] of Object.entries(collection.expected ?? {})) {
    if (!COLLECTION_KEY_SET.has(key) || !plainObject(raw)) {
      throw new Error(`collection.json 包含不支持的 expected 分类：${key}`)
    }
    const ids = raw.ids ?? []
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !ENTRY_ID.test(id))) {
      throw new Error(`expected.${key}.ids 必须是稳定 ID 数组`)
    }
    if (new Set(ids).size !== ids.length) throw new Error(`expected.${key}.ids 包含重复 ID`)
    const count = raw.count
    if (count != null && (!Number.isInteger(count) || count < 0 || count < ids.length)) {
      throw new Error(`expected.${key}.count 必须是不小于 ID 数量的非负整数`)
    }
    const imageRequired = raw.imageRequired === true
    if (imageRequired && !IMAGE_TARGET_COLLECTION[key as CollectionKey]) {
      throw new Error(`expected.${key} 不支持 imageRequired`)
    }
    result[key as CollectionKey] = {
      ...(count != null ? { count } : {}),
      ids: [...ids],
      imageRequired,
    }
  }
  return result
}

function buildCollectionAudit(
  collection: LocalContentCollection,
  value: Dnd5eContentPackageV2,
): Dnd5eLocalContentCollectionAudit {
  const expected = expectedCollection(collection)
  const imageTargets = new Set((collection.images ?? []).flatMap((image) =>
    image.targets.map((target) => `${target.category}:${target.id}`)))
  const categories = {} as Record<CollectionKey, Dnd5eLocalContentCollectionCategoryAudit>
  for (const key of COLLECTION_KEYS) {
    const entries = value.content[key]
    const actualIds = new Set(entries.map((entry) => entry.id))
    const expectation = expected[key]
    const expectedCount = expectation?.count ?? expectation?.ids.length ?? 0
    const missingIds = (expectation?.ids ?? []).filter((id) => !actualIds.has(id))
    const targetCategory = IMAGE_TARGET_COLLECTION[key]
    const missingImageIds = expectation?.imageRequired && targetCategory
      ? [...actualIds].filter((id) => !imageTargets.has(`${targetCategory}:${id}`))
      : []
    categories[key] = {
      actual: entries.length,
      ...(expectation ? { expected: expectedCount } : {}),
      countShortfall: expectation ? Math.max(0, expectedCount - entries.length) : 0,
      missingIds,
      imageRequired: expectation?.imageRequired ?? false,
      missingImageIds,
    }
  }
  const totals = Object.values(categories).reduce((result, category) => ({
    entries: result.entries + category.actual,
    expectedEntries: result.expectedEntries + (category.expected ?? 0),
    countShortfall: result.countShortfall + category.countShortfall,
    missingIds: result.missingIds + category.missingIds.length,
    missingImages: result.missingImages + category.missingImageIds.length,
  }), { entries: 0, expectedEntries: 0, countShortfall: 0, missingIds: 0, missingImages: 0 })
  return {
    schemaVersion: 1,
    package: { id: value.manifest.id, version: value.manifest.version },
    privacy: {
      includesSourceText: false,
      includesImageData: false,
      includesImagePrompts: false,
      includesHumanReadableContentNames: false,
    },
    complete: totals.countShortfall === 0 && totals.missingIds === 0 && totals.missingImages === 0,
    totals,
    categories,
    visuals: {
      declaredImages: collection.images?.length ?? 0,
      aiGeneratedImages: (collection.images ?? []).filter((image) => image.origin === 'ai-generated').length,
      boundTargets: (collection.images ?? []).reduce((total, image) => total + image.targets.length, 0),
    },
  }
}

/**
 * Compiles a user-selected local directory entirely in the browser.
 * collection.json, CSV files, prompts, and generation metadata never enter the result.
 */
export async function compileDnd5eLocalContentCollection(
  selectedFiles: readonly File[],
): Promise<CompiledDnd5eLocalContentCollection> {
  if (selectedFiles.length === 0) throw new Error('请选择包含 collection.json 的本地合集目录')
  if (selectedFiles.length > DND5E_LOCAL_COLLECTION_MAX_FILES) {
    throw new Error(`本地合集文件数量不能超过 ${DND5E_LOCAL_COLLECTION_MAX_FILES}`)
  }
  const files = new Map<string, File>()
  for (const file of selectedFiles) {
    const key = filePath(file)
    if (files.has(key)) throw new Error(`合集内存在重复路径：${key}`)
    files.set(key, file)
  }
  const collectionCandidates = [...files.entries()].filter(([path]) =>
    path.toLowerCase().endsWith('/collection.json') || path.toLowerCase() === 'collection.json')
  if (collectionCandidates.length !== 1) throw new Error('合集目录必须且只能包含一个 collection.json')
  const [collectionPath, collectionFile] = collectionCandidates[0]
  let parsed: unknown
  try {
    parsed = JSON.parse((await readCollectionTextFile(collectionFile, 'collection.json')).replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('collection.json 不是有效 JSON')
  }
  const collection = collectionFromJson(parsed)
  const content = mutableContent(collection)
  const baseDirectory = directoryName(collectionPath)

  for (const [key, reference] of Object.entries(collection.json ?? {})) {
    if (!COLLECTION_KEY_SET.has(key) || typeof reference !== 'string') {
      throw new Error(`collection.json 包含不支持的 JSON 分类：${key}`)
    }
    const path = resolveCollectionPath(baseDirectory, reference)
    const file = files.get(path)
    if (!file) throw new Error(`找不到 JSON 文件：${reference}`)
    content[key as CollectionKey].push(
      ...parseCollectionJsonEntries(
        await readCollectionTextFile(file, reference),
        key as CollectionKey,
        reference,
      ),
    )
  }

  for (const [key, reference] of Object.entries(collection.csv ?? {})) {
    if (!COLLECTION_KEY_SET.has(key) || typeof reference !== 'string') {
      throw new Error(`collection.json 包含不支持的 CSV 分类：${key}`)
    }
    const path = resolveCollectionPath(baseDirectory, reference)
    const file = files.get(path)
    if (!file) throw new Error(`找不到 CSV 文件：${reference}`)
    content[key as CollectionKey].push(
      ...parseCollectionCsv(await readCollectionTextFile(file, reference), reference),
    )
  }

  const assets: Dnd5ePluginImageAssetDefinition[] = []
  const imageIds = new Set<string>()
  for (const image of collection.images ?? []) {
    if (!plainObject(image) ||
      !IMAGE_ID.test(requiredString(image.id, '图片 id')) ||
      !['ai-generated', 'user-owned', 'licensed-for-use'].includes(String(image.origin)) ||
      !Array.isArray(image.targets) ||
      image.targets.length < 1
    ) throw new Error('collection.json 包含无效的图片声明')
    if (imageIds.has(image.id)) throw new Error(`图片 id 重复：${image.id}`)
    imageIds.add(image.id)
    const path = resolveCollectionPath(baseDirectory, requiredString(image.file, `图片 ${image.id} 的 file`))
    const file = files.get(path)
    if (!file) throw new Error(`找不到图片文件：${image.file}`)
    const mediaType = mediaTypeForFile(file)
    const dataBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()))
    const asset = { id: image.id, mediaType, dataBase64 } satisfies Dnd5ePluginImageAssetDefinition
    validateDnd5ePluginImageAsset(asset)
    const dataUrl = `data:${mediaType};base64,${dataBase64}`
    let needsRegisteredAsset = false
    for (const target of image.targets) {
      if (!plainObject(target) ||
        !['race', 'feature', 'feat', 'spell', 'item', 'monster'].includes(String(target.category)) ||
        typeof target.id !== 'string' ||
        (target.slot != null &&
          !['icon', 'portrait', 'tokenPortrait', 'initiativePortrait'].includes(String(target.slot)))
      ) throw new Error(`图片 ${image.id} 包含无效的 target`)
      if (target.category !== 'monster') needsRegisteredAsset = true
      bindImageTarget(content, target as unknown as LocalCollectionImageTarget, image.id, dataUrl)
    }
    if (needsRegisteredAsset) assets.push(asset)
  }

  const manifest = structuredClone(collection.manifest) as Dnd5eRulesPluginManifest
  manifest.distributionPolicy = 'room-ephemeral'
  const candidate = {
    format: DND5E_CONTENT_PACKAGE_FORMAT,
    schemaVersion: DND5E_CONTENT_PACKAGE_SCHEMA_VERSION,
    manifest,
    provenance: {
      edition: '2014',
      contentMode: 'incremental',
      sourceTitle: collection.provenance?.sourceTitle?.trim() || `本地合集 ${manifest.name}`,
      ...(collection.provenance?.sourceFingerprint?.trim()
        ? { sourceFingerprint: collection.provenance.sourceFingerprint.trim() }
        : {}),
    },
    assets,
    content,
  } as unknown as Dnd5eContentPackageV2
  const bytes = encodeDnd5eContentPackageV2(candidate)
  const validated = parseDnd5eContentPackageV2(bytes)
  if (!validated) throw new Error('本地合集无法编译为 V2 内容包')
  const audit = buildCollectionAudit(collection, validated)
  return {
    package: validated,
    bytes,
    fileName: `${validated.manifest.id}-${validated.manifest.version}-room.dndstars5e`,
    sourceFileName: collectionFile.name,
    audit,
  }
}
