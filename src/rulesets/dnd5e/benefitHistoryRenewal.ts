import type { Dnd5eCohortMember } from './cohortArmorClass'
import { normalizeDnd5eCohortArmorClass } from './cohortArmorClass'
import type { Dnd5eBenefitHistoryAuthorityRecordV1 } from './spellAuthorityState'
import type { Dnd5eActivityCapabilityProposal } from './activities/dnd5eActivityExecutor'

export interface Dnd5eBenefitRenewalPolicy { kind: 'recipient-death'; match: 'any' | 'all' }
export interface Dnd5eBenefitRenewalRecord extends Dnd5eBenefitRenewalPolicy {
  recipients: readonly Dnd5eCohortMember[]
  /** Host observed a certified death; retained if its already-dead token is removed. */
  deathWitnesses?: readonly (Dnd5eCohortMember & { worldMinute: number })[]
}
export interface Dnd5eBenefitDeathPeer extends Dnd5eCohortMember { dead: boolean }
export function validDnd5eBenefitRenewalPolicy(value: unknown): value is Dnd5eBenefitRenewalPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return Object.keys(v).every(key => ['kind', 'match'].includes(key)) && v.kind === 'recipient-death' && (v.match === 'any' || v.match === 'all')
}
export function normalizeDnd5eBenefitRenewalRecord(value: unknown): Dnd5eBenefitRenewalRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as Record<string, unknown>
  if (Object.keys(v).some(key => !['kind', 'match', 'recipients', 'deathWitnesses'].includes(key)) ||
    !validDnd5eBenefitRenewalPolicy({ kind: v.kind, match: v.match })) return undefined
  const cohort = normalizeDnd5eCohortArmorClass({ bonus: 0, maximumFeet: 0, match: v.match, recipients: v.recipients })
  if (!cohort) return undefined
  const witnesses = v.deathWitnesses
  if (witnesses != null && (!Array.isArray(witnesses) || witnesses.length > cohort.recipients.length ||
    witnesses.some(witness => !witness || typeof witness !== 'object' || Array.isArray(witness) ||
      Object.keys(witness).some(key => !['actorId', 'characterId', 'worldMinute'].includes(key)) ||
      !Number.isSafeInteger(witness.worldMinute) || witness.worldMinute < 0 ||
      !cohort.recipients.some(member => member.actorId === witness.actorId && member.characterId === witness.characterId)) ||
    new Set(witnesses.map(witness => witness.actorId)).size !== witnesses.length)) return undefined
  return { kind: 'recipient-death', match: cohort.match, recipients: cohort.recipients,
    ...(Array.isArray(witnesses) && witnesses.length ? { deathWitnesses: witnesses.map(witness => ({ ...witness })) } : {}) }
}

/** Reads current certified death, not zero HP, deletion, absence, or client claims. */
export function dnd5eBenefitHistoryCanRenew(record: Dnd5eBenefitHistoryAuthorityRecordV1,
  policy: Dnd5eBenefitRenewalPolicy | undefined, isDead: (recipient: Dnd5eCohortMember) => boolean | undefined,
  allowRecordedWitness: (recipient: Dnd5eCohortMember) => boolean = () => false): boolean {
  const renewal = normalizeDnd5eBenefitRenewalRecord(record.renewal)
  if (!renewal || !validDnd5eBenefitRenewalPolicy(policy) || renewal.match !== policy.match ||
    !renewal.recipients.some(member => member.actorId === record.subjectActorId)) return false
  const partners = renewal.recipients.filter(member => member.actorId !== record.subjectActorId)
  const confirmed = (member: Dnd5eCohortMember) => {
    const dead = isDead(member)
    if (dead != null) return dead
    return allowRecordedWitness(member) && renewal.deathWitnesses?.some(witness => witness.actorId === member.actorId &&
      witness.characterId === member.characterId && witness.worldMinute >= record.createdWorldMinute) === true
  }
  return renewal.match === 'any' ? partners.some(confirmed) : partners.every(confirmed)
}

export function dnd5eBenefitDeathPeerMatches(member: Dnd5eCohortMember, peer: Dnd5eBenefitDeathPeer): boolean {
  return member.characterId ? member.characterId === peer.characterId : member.actorId === peer.actorId && peer.characterId == null
}

/** Room reconciliation removes stale evidence on known revival; unknown is never death. */
export function reconcileDnd5eBenefitDeathWitnesses(record: Dnd5eBenefitHistoryAuthorityRecordV1,
  peers: readonly Dnd5eBenefitDeathPeer[], worldMinute: number | undefined): Dnd5eBenefitHistoryAuthorityRecordV1 {
  const renewal = normalizeDnd5eBenefitRenewalRecord(record.renewal)
  if (!renewal) return record
  const witnesses = new Map((renewal.deathWitnesses ?? []).map(witness => [witness.actorId, witness]))
  for (const member of renewal.recipients) {
    if (member.actorId === record.subjectActorId) continue
    const matches = peers.filter(peer => dnd5eBenefitDeathPeerMatches(member, peer))
    if (matches.length !== 1) continue
    if (!matches[0].dead) witnesses.delete(member.actorId)
    else if (!witnesses.has(member.actorId) && Number.isSafeInteger(worldMinute) && Number(worldMinute) >= record.createdWorldMinute) {
      witnesses.set(member.actorId, { ...member, worldMinute: Number(worldMinute) })
    }
  }
  const next = [...witnesses.values()]
  if (JSON.stringify(next) === JSON.stringify(renewal.deathWitnesses ?? [])) return record
  return { ...record, renewal: { kind: renewal.kind, match: renewal.match, recipients: renewal.recipients,
    ...(next.length ? { deathWitnesses: next } : {}) } }
}

/** Host-only captured cohort; the author supplies policy but never participant IDs. */
export function bindDnd5eBenefitHistoryRecipients(proposals: readonly Dnd5eActivityCapabilityProposal[],
  recipient: (id: string) => Dnd5eCohortMember): readonly Dnd5eActivityCapabilityProposal[] | undefined {
  const result = proposals.map(proposal => {
    if (proposal.kind !== 'establish-spell-authority' || !proposal.benefitRenewal) return proposal
    const recipients = [...new Set(proposals.flatMap(peer => peer.kind === 'establish-spell-authority' &&
      peer.recordKind === 'benefit-history' && peer.benefitKey === proposal.benefitKey ? [peer.targetId] : []))].map(recipient)
    return { ...proposal, benefitRecipients: recipients }
  })
  return result.some(proposal => proposal.kind === 'establish-spell-authority' && proposal.benefitRenewal &&
    (proposal.recordKind !== 'benefit-history' || !normalizeDnd5eBenefitRenewalRecord({ ...proposal.benefitRenewal,
      recipients: proposal.benefitRecipients }))) ? undefined : result
}
