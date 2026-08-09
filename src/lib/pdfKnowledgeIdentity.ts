import type {
  PdfEntityKindV2,
  PdfNamedRecordV2,
  PdfRelationshipRecordV2,
  PdfSourceEvidenceV2,
} from './pdfCampaignAnalysisV2'

export function normalizePdfEntityName(value: string): string {
  return value.normalize('NFKC').trim().replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function stablePdfIdentityHash(value: string): string {
  const seeds = [0x811c9dc5, 0x9e3779b1, 0x85ebca6b]
  return seeds.map((seed) => {
    let hash = seed >>> 0
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193) >>> 0
      hash ^= hash >>> 13
    }
    return hash.toString(16).padStart(8, '0')
  }).join('')
}

export function createStablePdfEntityId(input: {
  kind: PdfEntityKindV2
  name: string
  firstEvidence?: PdfSourceEvidenceV2
  collisionIndex?: number
}): string {
  const evidence = input.firstEvidence
    ? `${input.firstEvidence.documentId}|${input.firstEvidence.page}`
    : 'no-evidence'
  const collision = input.collisionIndex && input.collisionIndex > 0 ? `|${input.collisionIndex}` : ''
  return `ent_${stablePdfIdentityHash(`${input.kind}|${normalizePdfEntityName(input.name)}|${evidence}${collision}`)}`
}

export function createStablePdfRelationshipId(relationship: Pick<PdfRelationshipRecordV2, 'from' | 'to' | 'type' | 'evidenceIds'>): string {
  return `rel_${stablePdfIdentityHash([
    normalizePdfEntityName(relationship.from),
    normalizePdfEntityName(relationship.to),
    normalizePdfEntityName(relationship.type),
    relationship.evidenceIds[0] ?? 'no-evidence',
  ].join('|'))}`
}

type IdentifiedPdfRecord = {
  id: string
  aliases?: readonly string[]
  evidenceIds: readonly string[]
  name?: string
  title?: string
  description?: string
}

function collisionSignature(record: IdentifiedPdfRecord): string {
  return [
    normalizePdfEntityName(record.name ?? record.title ?? ''),
    [...(record.aliases ?? [])].map(normalizePdfEntityName).sort().join(','),
    [...record.evidenceIds].sort().join(','),
    record.description ?? '',
  ].join('|')
}

/**
 * Hash collisions and duplicate model records must not make an otherwise valid artifact fail server validation.
 * Sorting by stable content keeps the resulting ID set independent from model output order.
 */
export function disambiguatePdfEntityIds<T extends IdentifiedPdfRecord>(records: readonly T[]): T[] {
  const groups = new Map<string, Array<{ record: T; signature: string }>>()
  for (const record of records) {
    groups.set(record.id, [...(groups.get(record.id) ?? []), { record, signature: collisionSignature(record) }])
  }
  return records.map((record) => {
    const group = groups.get(record.id)
    if (!group || group.length === 1) return record
    const ordered = [...group].sort((left, right) => (
      left.signature.localeCompare(right.signature) || JSON.stringify(left.record).localeCompare(JSON.stringify(right.record))
    ))
    const collisionIndex = ordered.findIndex((entry) => entry.record === record)
    if (collisionIndex <= 0) return record
    return {
      ...record,
      id: `ent_${stablePdfIdentityHash(`${record.id}|collision|${ordered[collisionIndex].signature}|${collisionIndex}`)}`,
    }
  })
}

export function disambiguatePdfRelationshipIds<T extends PdfRelationshipRecordV2>(relationships: readonly T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const relationship of relationships) {
    groups.set(relationship.id, [...(groups.get(relationship.id) ?? []), relationship])
  }
  return relationships.map((relationship) => {
    const group = groups.get(relationship.id)
    if (!group || group.length === 1) return relationship
    const signature = (entry: T) => [
      normalizePdfEntityName(entry.from),
      normalizePdfEntityName(entry.to),
      normalizePdfEntityName(entry.type),
      [...entry.evidenceIds].sort().join(','),
      entry.description,
    ].join('|')
    const ordered = [...group].sort((left, right) => (
      signature(left).localeCompare(signature(right)) || JSON.stringify(left).localeCompare(JSON.stringify(right))
    ))
    const collisionIndex = ordered.findIndex((entry) => entry === relationship)
    if (collisionIndex <= 0) return relationship
    return {
      ...relationship,
      id: `rel_${stablePdfIdentityHash(`${relationship.id}|collision|${signature(ordered[collisionIndex])}|${collisionIndex}`)}`,
    }
  })
}

type RelationshipEntity = Pick<PdfNamedRecordV2, 'id' | 'name' | 'aliases' | 'reviewStatus'>

export function resolvePdfRelationshipEndpoints(input: {
  people: readonly RelationshipEntity[]
  locations: readonly RelationshipEntity[]
  factions: readonly RelationshipEntity[]
  relationships: readonly PdfRelationshipRecordV2[]
}): PdfRelationshipRecordV2[] {
  const entities = [...input.people, ...input.locations, ...input.factions]
  const canonical = new Map<string, RelationshipEntity[]>()
  const aliases = new Map<string, RelationshipEntity[]>()
  for (const entity of entities) {
    const key = normalizePdfEntityName(entity.name)
    canonical.set(key, [...(canonical.get(key) ?? []), entity])
    for (const alias of entity.aliases) {
      const aliasKey = normalizePdfEntityName(alias)
      aliases.set(aliasKey, [...(aliases.get(aliasKey) ?? []), entity])
    }
  }
  const resolve = (name: string) => {
    const exact = canonical.get(normalizePdfEntityName(name)) ?? []
    if (exact.length === 1) return { entity: exact[0], alias: false }
    if (exact.length > 1) return null
    const alias = aliases.get(normalizePdfEntityName(name)) ?? []
    return alias.length === 1 ? { entity: alias[0], alias: true } : null
  }

  return input.relationships.map((relationship) => {
    const from = resolve(relationship.from)
    const to = resolve(relationship.to)
    const needsReview = !from || !to || from.alias || to.alias
    return {
      ...relationship,
      ...(from ? { fromEntityId: from.entity.id } : {}),
      ...(to ? { toEntityId: to.entity.id } : {}),
      reviewStatus: needsReview ? 'needs-review' : relationship.reviewStatus,
    }
  })
}
