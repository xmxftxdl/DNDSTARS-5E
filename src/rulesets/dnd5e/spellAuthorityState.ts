import type { AbilityKey } from '../../lib/dnd'

export const DND5E_SPELL_AUTHORITY_RECORD_SCHEMA_VERSION = 1 as const

/**
 * Instant Summons can maintain multiple links at once, provided each casting
 * uses a different sapphire. Bind its durable authority key to the concrete
 * inventory instance instead of collapsing every casting by the same actor.
 * Secret Chest intentionally keeps its legacy one-record-per-actor key.
 */
export function dnd5eLinkedPlanarObjectAuthorityRecordId(
  profile: 'instant-summons' | 'secret-chest',
  sourceActorId: string,
  inventoryInstanceId: string,
): string {
  return profile === 'instant-summons'
    ? `linked-planar-object:${profile}:${sourceActorId}:${inventoryInstanceId}`
    : `linked-planar-object:${profile}:${sourceActorId}`
}

export type Dnd5eSpellAuthorityRecordKindV1 =
  | 'clone-receptacle'
  | 'linked-planar-object'
  | 'soul-vessel'
  | 'terrain-merge'
  | 'simulacrum-companion'
  | 'recall-sanctuary'
  | 'benefit-history'

export interface Dnd5eSpellBodySnapshotV1 {
  name: string
  abilities: Readonly<Record<AbilityKey, number>>
  maximumHitPoints: number
  sizeRank: number
  creatureType?: string
}

export interface Dnd5eCloneReceptacleAuthorityRecordV1 {
  schemaVersion: typeof DND5E_SPELL_AUTHORITY_RECORD_SCHEMA_VERSION
  id: string
  kind: 'clone-receptacle'
  sourceActorId: string
  subjectActorId: string
  sourceActivityId: string
  createdWorldMinute: number
  maturesAtWorldMinute: number
  bodySnapshot: Dnd5eSpellBodySnapshotV1
}

export interface Dnd5eLinkedPlanarObjectAuthorityRecordV1 {
  schemaVersion: typeof DND5E_SPELL_AUTHORITY_RECORD_SCHEMA_VERSION
  id: string
  kind: 'linked-planar-object'
  profile: 'instant-summons' | 'secret-chest'
  sourceActorId: string
  subjectActorId: string
  sourceActivityId: string
  createdWorldMinute: number
  /** Host-validated inventory instance bound at cast time. */
  inventoryInstanceId: string
  /** Actual slot level used by this casting; needed when its sapphire is dispelled. */
  spellLevel?: number
  planarState: 'material' | 'ethereal'
  lossRiskStartsAtWorldMinute?: number
  lastLossCheckWorldMinute?: number
}

export interface Dnd5eSoulVesselAuthorityRecordV1 {
  schemaVersion: typeof DND5E_SPELL_AUTHORITY_RECORD_SCHEMA_VERSION
  id: string
  kind: 'soul-vessel'
  sourceActorId: string
  subjectActorId: string
  sourceActivityId: string
  createdWorldMinute: number
  state: 'in-vessel' | 'possessing'
  controlledActorId?: string
  bodySnapshot: Dnd5eSpellBodySnapshotV1
}

export interface Dnd5eTerrainMergeAuthorityRecordV1 {
  schemaVersion: typeof DND5E_SPELL_AUTHORITY_RECORD_SCHEMA_VERSION
  id: string
  kind: 'terrain-merge'
  sourceActorId: string
  subjectActorId: string
  sourceActivityId: string
  createdWorldMinute: number
  state: 'merged'
  bodySnapshot: Dnd5eSpellBodySnapshotV1
}

export interface Dnd5eSimulacrumAuthorityRecordV1 {
  schemaVersion: typeof DND5E_SPELL_AUTHORITY_RECORD_SCHEMA_VERSION
  id: string
  kind: 'simulacrum-companion'
  sourceActorId: string
  subjectActorId: string
  sourceActivityId: string
  createdWorldMinute: number
  bodySnapshot: Dnd5eSpellBodySnapshotV1
  maximumHitPoints: number
  cannotIncreaseLevel: true
  cannotRegainSpellSlots: true
}

export interface Dnd5eRecallSanctuaryAuthorityRecordV1 {
  schemaVersion: typeof DND5E_SPELL_AUTHORITY_RECORD_SCHEMA_VERSION
  id: string
  kind: 'recall-sanctuary'
  sourceActorId: string
  subjectActorId: string
  sourceActivityId: string
  createdWorldMinute: number
  slotLevel: number
  sanctuaryName: string
  deityConnection: string
  destinationMapId: string
  destinationMapName: string
  destinationX: number
  destinationY: number
  destinationElevationFeet: number
}

/**
 * Durable, Host-authored records for spells whose authority must outlive one
 * combat action. New record kinds remain closed unions so imported JSON cannot
 * smuggle callbacks or arbitrary runtime objects through this boundary.
 */
export interface Dnd5eBenefitHistoryAuthorityRecordV1 {
  schemaVersion: 1
  id: string
  kind: 'benefit-history'
  sourceActorId: string
  subjectActorId: string
  sourceActivityId: string
  createdWorldMinute: number
  sourcePackageId: string
  benefitKey: string
  benefitScope?: 'package' | 'ruleset'
  renewal?: import('./benefitHistoryRenewal').Dnd5eBenefitRenewalRecord
}

/** Package-scoped lifetime benefit identity, independent of caster and temporary effects. */
export function dnd5eBenefitHistoryRecordId(packageId: string, benefitKey: string, scope?: 'package' | 'ruleset'): string {
  return `benefit-history:${JSON.stringify([scope === 'ruleset' ? 'ruleset:dnd5e-2014-srd-5.1' : packageId, benefitKey])}`
}

/** Shared declarations also recognize older package records with the same declared key. */
export function dnd5eMatchingBenefitHistoryRecords(records: Record<string, Dnd5eSpellAuthorityRecordV1> | undefined,
  packageId: string, benefitKey: string, scope?: 'package' | 'ruleset'): Dnd5eBenefitHistoryAuthorityRecordV1[] {
  return Object.values(records ?? {}).filter((record): record is Dnd5eBenefitHistoryAuthorityRecordV1 =>
    record.kind === 'benefit-history' && record.benefitKey === benefitKey &&
    (scope === 'ruleset' || record.benefitScope === 'ruleset' || record.sourcePackageId === packageId))
}

/** Replace superseded history atomically while retaining unrelated benefits. Shared history cannot be downgraded. */
export function dnd5eStoreBenefitHistoryRecord(records: Record<string, Dnd5eSpellAuthorityRecordV1> | undefined,
  record: Dnd5eBenefitHistoryAuthorityRecordV1): Record<string, Dnd5eSpellAuthorityRecordV1> {
  const matches = dnd5eMatchingBenefitHistoryRecords(records, record.sourcePackageId, record.benefitKey, record.benefitScope)
  const scope = record.benefitScope === 'ruleset' || matches.some(previous => previous.benefitScope === 'ruleset') ? 'ruleset' : record.benefitScope
  const id = dnd5eBenefitHistoryRecordId(record.sourcePackageId, record.benefitKey, scope)
  const obsolete = new Set(matches.map(previous => previous.id))
  return {...Object.fromEntries(Object.entries(records ?? {}).filter(([key]) => !obsolete.has(key))), [id]: {...record, id, benefitScope:scope}}
}

export type Dnd5eSpellAuthorityRecordV1 =
  | Dnd5eBenefitHistoryAuthorityRecordV1
  | Dnd5eCloneReceptacleAuthorityRecordV1
  | Dnd5eLinkedPlanarObjectAuthorityRecordV1
  | Dnd5eSoulVesselAuthorityRecordV1
  | Dnd5eTerrainMergeAuthorityRecordV1
  | Dnd5eSimulacrumAuthorityRecordV1
  | Dnd5eRecallSanctuaryAuthorityRecordV1

export type Dnd5eSpellAuthorityRecordLedgerV1 = Readonly<Record<
  string,
  Dnd5eSpellAuthorityRecordV1
>>

export function dnd5eMatureCloneReceptacleV1(input: {
  records: Dnd5eSpellAuthorityRecordLedgerV1 | undefined
  subjectActorId: string
  worldMinute: number | undefined
}): Dnd5eCloneReceptacleAuthorityRecordV1 | undefined {
  if (!Number.isSafeInteger(input.worldMinute) || Number(input.worldMinute) < 0) return undefined
  return Object.values(input.records ?? {})
    .filter((record): record is Dnd5eCloneReceptacleAuthorityRecordV1 =>
      record.kind === 'clone-receptacle' &&
      record.subjectActorId === input.subjectActorId &&
      record.maturesAtWorldMinute <= Number(input.worldMinute))
    .sort((left, right) => left.maturesAtWorldMinute - right.maturesAtWorldMinute ||
      left.id.localeCompare(right.id))[0]
}
