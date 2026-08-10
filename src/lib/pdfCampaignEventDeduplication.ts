import type {
  PdfEncounterRecordV1,
  PdfSceneRecordV1,
  PdfSourceCitationV1,
} from './pdfCampaignAnalysis'

const NON_IDENTITY_CHARACTER = /[^\p{L}\p{N}]+/gu
const GENERIC_BRACKET_LABEL = /[（(【[]\s*(?:场景|事件|遭遇战?|战斗|阶段|流程|节点)\s*[）)】\]]/gu
const GENERIC_PREFIX = /^(?:场景|事件|遭遇战?|战斗)[:：·-]*/u
const GENERIC_SUFFIX = /(?:场景|事件|遭遇战|遭遇|战斗|战役|阶段|流程|节点)$/u

function cleanedName(value: string): string {
  return value.normalize('NFKC').trim().replace(GENERIC_BRACKET_LABEL, '').replace(GENERIC_PREFIX, '')
}

/**
 * Produces a conservative identity key for runnable scenes and encounters.
 * Only punctuation, the Chinese linking particle “的”, and explicit generic
 * labels are ignored; semantic words such as “伏击” or “仪式” remain intact.
 */
export function normalizePdfEventIdentityName(value: string): string {
  const fallback = cleanedName(value).toLocaleLowerCase('zh-CN').replace(NON_IDENTITY_CHARACTER, '')
  let key = fallback.replace(/的/gu, '').replace(/(伏击|遭遇|攻防|追逐)战$/u, '$1')
  let previous = ''
  while (key && key !== previous) {
    previous = key
    key = key.replace(GENERIC_SUFFIX, '')
  }
  return key || fallback
}

function citationKey(citation: PdfSourceCitationV1): string {
  return [
    citation.documentId ?? '',
    citation.documentName.toLocaleLowerCase('zh-CN'),
    citation.page,
    citation.quote ?? '',
  ].join(':')
}

function uniqueCitations(citations: readonly PdfSourceCitationV1[]): PdfSourceCitationV1[] {
  const seen = new Set<string>()
  return citations.filter((citation) => {
    const key = citationKey(citation)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 64)
}

function citationPageKey(citation: PdfSourceCitationV1): string {
  return `${citation.documentId ?? citation.documentName.toLocaleLowerCase('zh-CN')}:${citation.page}`
}

export function pdfEventRecordsLikelySame(
  left: Pick<PdfSceneRecordV1, 'name' | 'citations'>,
  right: Pick<PdfSceneRecordV1, 'name' | 'citations'>,
): boolean {
  const leftName = normalizePdfEventIdentityName(left.name)
  const rightName = normalizePdfEventIdentityName(right.name)
  if (!leftName || !rightName) return false
  if (leftName === rightName) return true
  const [shorter, longer] = leftName.length <= rightName.length ? [leftName, rightName] : [rightName, leftName]
  if (shorter.length < 4 || !longer.includes(shorter)) return false
  const pages = new Set(left.citations.map(citationPageKey))
  return right.citations.some((citation) => pages.has(citationPageKey(citation)))
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const display = value.trim()
    const key = display.toLocaleLowerCase('zh-CN')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 64)
}

function longer(left: string | undefined, right: string | undefined): string {
  const first = left?.trim() ?? ''
  const second = right?.trim() ?? ''
  return second.length > first.length ? second : first
}

function preferredName(left: string, right: string): string {
  const first = cleanedName(left)
  const second = cleanedName(right)
  if (!first) return second
  if (!second) return first
  // Matching identity keys differ only by generic labels. Prefer the concise title.
  return second.length < first.length ? second : first
}

function mergeScenePair<T extends PdfSceneRecordV1>(left: T, right: T): T {
  const leftIdentity = left as T & { evidenceIds?: string[]; confidence?: number }
  const rightIdentity = right as T & { evidenceIds?: string[]; confidence?: number }
  return {
    ...left,
    name: preferredName(left.name, right.name),
    description: longer(left.description, right.description),
    location: longer(left.location, right.location),
    npcs: uniqueStrings([...left.npcs, ...right.npcs]),
    monsters: uniqueStrings([...left.monsters, ...right.monsters]),
    citations: uniqueCitations([...left.citations, ...right.citations]),
    ...(left.tags || right.tags ? { tags: uniqueStrings([...(left.tags ?? []), ...(right.tags ?? [])]) } : {}),
    ...(left.aliases || right.aliases ? { aliases: uniqueStrings([...(left.aliases ?? []), ...(right.aliases ?? []), right.name]) } : {}),
    ...(leftIdentity.evidenceIds || rightIdentity.evidenceIds ? { evidenceIds: uniqueStrings([...(leftIdentity.evidenceIds ?? []), ...(rightIdentity.evidenceIds ?? [])]) } : {}),
    ...(typeof leftIdentity.confidence === 'number' || typeof rightIdentity.confidence === 'number'
      ? { confidence: Math.max(leftIdentity.confidence ?? 0, rightIdentity.confidence ?? 0) }
      : {}),
  } as T
}

function mergeEncounterPair<T extends PdfEncounterRecordV1>(left: T, right: T): T {
  const leftIdentity = left as T & { evidenceIds?: string[]; confidence?: number }
  const rightIdentity = right as T & { evidenceIds?: string[]; confidence?: number }
  return {
    ...left,
    name: preferredName(left.name, right.name),
    description: longer(left.description, right.description),
    notes: longer(left.notes, right.notes),
    creatures: uniqueStrings([...left.creatures, ...right.creatures]),
    citations: uniqueCitations([...left.citations, ...right.citations]),
    ...(left.aliases || right.aliases ? { aliases: uniqueStrings([...(left.aliases ?? []), ...(right.aliases ?? []), right.name]) } : {}),
    ...(leftIdentity.evidenceIds || rightIdentity.evidenceIds ? { evidenceIds: uniqueStrings([...(leftIdentity.evidenceIds ?? []), ...(rightIdentity.evidenceIds ?? [])]) } : {}),
    ...(typeof leftIdentity.confidence === 'number' || typeof rightIdentity.confidence === 'number'
      ? { confidence: Math.max(leftIdentity.confidence ?? 0, rightIdentity.confidence ?? 0) }
      : {}),
  } as T
}

function mergeByIdentity<T extends { name: string; citations: PdfSourceCitationV1[] }>(
  records: readonly T[],
  merge: (left: T, right: T) => T,
): T[] {
  const values = new Map<string, T>()
  for (const record of records) {
    const key = normalizePdfEventIdentityName(record.name)
    if (!key) continue
    const exact = values.get(key)
    if (exact) {
      values.set(key, merge(exact, record))
      continue
    }
    const similar = [...values.entries()].find(([, current]) => pdfEventRecordsLikelySame(current, record))
    if (similar) {
      values.set(similar[0], merge(similar[1], record))
      continue
    }
    values.set(key, structuredClone(record))
  }
  return [...values.values()]
}

export function mergePdfSceneRecords<T extends PdfSceneRecordV1>(records: readonly T[]): T[] {
  return mergeByIdentity(records, mergeScenePair)
}

export function mergePdfEncounterRecords<T extends PdfEncounterRecordV1>(records: readonly T[]): T[] {
  return mergeByIdentity(records, mergeEncounterPair)
}
