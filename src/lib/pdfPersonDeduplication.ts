import type { PdfPersonRecordV1, PdfRelationshipRecordV1, PdfSourceCitationV1 } from './pdfCampaignAnalysis'

const PERSON_NAME_SEPARATOR = /[\s\u00b7\u2022\u2027\u30fb\-\u2013\u2014_/\uff0f]+/u
const NON_NAME_CHARACTER = /[^\p{L}\p{N}]+/gu

function cleanPersonName(value: string): string {
  return value.normalize('NFKC').trim().replace(/^[\s'"\u201c\u201d\u2018\u2019]+|[\s'"\u201c\u201d\u2018\u2019]+$/g, '')
}

/** A punctuation-insensitive identity key. It intentionally does not remove titles or infer nicknames. */
export function normalizePdfPersonIdentityName(value: string): string {
  return cleanPersonName(value).toLocaleLowerCase().replace(NON_NAME_CHARACTER, '')
}

function personNameParts(value: string): string[] {
  return cleanPersonName(value)
    .split(PERSON_NAME_SEPARATOR)
    .map(normalizePdfPersonIdentityName)
    .filter((part) => part.length >= 2)
}

function citationKey(citation: PdfSourceCitationV1): string {
  return [
    citation.documentId ?? '',
    citation.documentName.toLocaleLowerCase(),
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

function uniqueNames(values: readonly string[], canonicalName: string): string[] {
  const canonicalKey = normalizePdfPersonIdentityName(canonicalName)
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const display = cleanPersonName(value)
    const key = normalizePdfPersonIdentityName(display)
    if (!key || key === canonicalKey || seen.has(key)) continue
    seen.add(key)
    result.push(display)
  }
  return result.slice(0, 8)
}

function recordVariants(record: PdfPersonRecordV1): string[] {
  return [record.name, ...(record.aliases ?? [])]
    .map(cleanPersonName)
    .filter(Boolean)
}

function canonicalNameScore(record: PdfPersonRecordV1): number {
  const name = cleanPersonName(record.name)
  const parts = personNameParts(name)
  const contentLength = [record.role, record.description, record.appearance, record.personality, record.motivation, record.secret, record.voice]
    .reduce((sum, value) => sum + (value?.trim().length ?? 0), 0)
  return (parts.length * 10_000) + (normalizePdfPersonIdentityName(name).length * 100) + Math.min(contentLength, 99)
}

class DisjointSet {
  private readonly parents: number[]

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index)
  }

  find(index: number): number {
    const parent = this.parents[index]
    if (parent !== index) this.parents[index] = this.find(parent)
    return this.parents[index]
  }

  union(left: number, right: number): void {
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)
    if (leftRoot !== rightRoot) this.parents[rightRoot] = leftRoot
  }
}

function groupIndexes(records: readonly PdfPersonRecordV1[], set: DisjointSet): Map<number, number[]> {
  const groups = new Map<number, number[]>()
  records.forEach((_, index) => {
    const root = set.find(index)
    groups.set(root, [...(groups.get(root) ?? []), index])
  })
  return groups
}

function mergePersonGroup<T extends PdfPersonRecordV1>(records: readonly T[]): T {
  const ordered = [...records].sort((left, right) => canonicalNameScore(right) - canonicalNameScore(left))
  const canonical = ordered[0]
  const next = { ...canonical } as T
  for (const record of ordered.slice(1)) {
    for (const [field, value] of Object.entries(record)) {
      if (field === 'name' || field === 'aliases' || field === 'citations') continue
      const previous = (next as Record<string, unknown>)[field]
      if (typeof value === 'string' && value.trim().length > (typeof previous === 'string' ? previous.trim().length : 0)) {
        ;(next as Record<string, unknown>)[field] = value
      } else if (Array.isArray(value) && Array.isArray(previous)) {
        ;(next as Record<string, unknown>)[field] = [...new Set([...previous, ...value])].slice(0, 64)
      }
    }
  }
  next.name = cleanPersonName(canonical.name)
  next.aliases = uniqueNames(ordered.flatMap((record) => [record.name, ...(record.aliases ?? [])]), next.name)
  // Keep source order stable so cached/replayed analyses produce identical evidence timelines.
  next.citations = uniqueCitations(records.flatMap((record) => record.citations))
  return next
}

/**
 * Merges model records without guessing through semantic similarity.
 * Exact name/alias matches are authoritative. A short name is only merged with a
 * separated full name when that short form has one unambiguous full-name target.
 */
export function mergePdfPersonRecords<T extends PdfPersonRecordV1>(records: readonly T[]): T[] {
  if (records.length < 2) return records.map((record) => mergePersonGroup([record]))
  const set = new DisjointSet(records.length)
  const exactOwners = new Map<string, number>()

  records.forEach((record, index) => {
    for (const variant of recordVariants(record)) {
      const key = normalizePdfPersonIdentityName(variant)
      if (!key) continue
      const owner = exactOwners.get(key)
      if (owner == null) exactOwners.set(key, index)
      else set.union(owner, index)
    }
  })

  const exactGroups = groupIndexes(records, set)
  for (const [shortRoot, shortIndexes] of exactGroups) {
    const shortKeys = new Set(shortIndexes.flatMap((index) => recordVariants(records[index]).map(normalizePdfPersonIdentityName)))
    const candidates = new Set<number>()
    for (const [longRoot, longIndexes] of exactGroups) {
      if (longRoot === shortRoot) continue
      const matches = longIndexes.some((index) => recordVariants(records[index]).some((variant) => {
        const parts = personNameParts(variant)
        return parts.length >= 2 && parts.some((part) => shortKeys.has(part))
      }))
      if (matches) candidates.add(longRoot)
    }
    if (candidates.size === 1) set.union(shortRoot, [...candidates][0])
  }

  return [...groupIndexes(records, set).values()]
    .map((indexes) => mergePersonGroup(indexes.map((index) => records[index])))
}

/** Rewrites unique person aliases in relationship endpoints to their canonical full name. */
export function canonicalizePdfPersonRelationships<T extends Pick<PdfRelationshipRecordV1, 'from' | 'to'>>(
  relationships: readonly T[],
  people: readonly PdfPersonRecordV1[],
): T[] {
  const candidates = new Map<string, Set<string>>()
  for (const person of people) {
    for (const variant of [person.name, ...(person.aliases ?? [])]) {
      const key = normalizePdfPersonIdentityName(variant)
      if (!key) continue
      candidates.set(key, new Set([...(candidates.get(key) ?? []), person.name]))
    }
  }
  const canonical = (value: string) => {
    const names = candidates.get(normalizePdfPersonIdentityName(value))
    return names?.size === 1 ? [...names][0] : value
  }
  return relationships.map((relationship) => ({
    ...relationship,
    from: canonical(relationship.from),
    to: canonical(relationship.to),
  }))
}
