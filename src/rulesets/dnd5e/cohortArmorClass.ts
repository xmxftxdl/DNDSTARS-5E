import type { Dnd5eActivityCapabilityProposal } from './activities/dnd5eActivityExecutor'

/** Recipients are captured by the Host from one resolved Effect application. */
export interface Dnd5eCohortMember { actorId: string; characterId?: string }
export interface Dnd5eCohortArmorClass {
  bonus: number
  maximumFeet: number
  match: 'any' | 'all'
  recipients: readonly Dnd5eCohortMember[]
}

export function validDnd5eCohortProximity(value: unknown): value is Pick<Dnd5eCohortArmorClass, 'maximumFeet' | 'match'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return Object.keys(v).every(key => ['maximumFeet', 'match'].includes(key)) &&
    typeof v.maximumFeet === 'number' && Number.isFinite(v.maximumFeet) && v.maximumFeet >= 0 && v.maximumFeet <= 10000 &&
    (v.match === 'any' || v.match === 'all')
}

export function normalizeDnd5eCohortArmorClass(value: unknown): Dnd5eCohortArmorClass | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as Record<string, unknown>
  const validId = (id: unknown) => typeof id === 'string' && id.trim() === id && id.length > 0 && id.length <= 300
  if (Object.keys(v).some(key => !['bonus', 'maximumFeet', 'match', 'recipients'].includes(key)) ||
    !Number.isInteger(v.bonus) || Number(v.bonus) < -20 || Number(v.bonus) > 20 ||
    !validDnd5eCohortProximity({ maximumFeet: v.maximumFeet, match: v.match }) ||
    !Array.isArray(v.recipients) || v.recipients.length < 2 || v.recipients.length > 100 ||
    v.recipients.some(member => !member || typeof member !== 'object' || Array.isArray(member) ||
      Object.keys(member).some(key => !['actorId', 'characterId'].includes(key)) || !validId(member.actorId) ||
      (member.characterId != null && !validId(member.characterId))) ||
    new Set(v.recipients.map(member => member.characterId ? `character:${member.characterId}` : `actor:${member.actorId}`)).size !== v.recipients.length) return undefined
  return { bonus: Number(v.bonus), maximumFeet: Number(v.maximumFeet), match: v.match as 'any' | 'all',
    recipients: v.recipients.map(member => ({ actorId: member.actorId, ...(member.characterId ? { characterId: member.characterId } : {}) })) }
}

export function dnd5eCohortArmorClassBonus(value: unknown, context: {
  bearer: Dnd5eCohortMember
  distanceTo: (member: Dnd5eCohortMember) => number | undefined
} | undefined): number {
  const rule = normalizeDnd5eCohortArmorClass(value)
  if (!rule || !context) return 0
  const isBearer = (member: Dnd5eCohortMember) => member.characterId
    ? member.characterId === context.bearer.characterId : member.actorId === context.bearer.actorId
  if (!rule.recipients.some(isBearer)) return 0
  const peers = rule.recipients.filter(member => !isBearer(member))
  const inRange = (member: Dnd5eCohortMember) => {
    const distance = context.distanceTo(member)
    return distance != null && Number.isFinite(distance) && distance >= 0 && distance <= rule.maximumFeet
  }
  return (rule.match === 'all' ? peers.every(inRange) : peers.some(inRange)) ? rule.bonus : 0
}

/** Both authority routes bind from resolved proposals before any costs. */
export function bindDnd5eCohortEffectProposals(proposals: readonly Dnd5eActivityCapabilityProposal[],
  recipient: (id: string) => Dnd5eCohortMember): readonly Dnd5eActivityCapabilityProposal[] | undefined {
  const bound = proposals.map(proposal => {
    if (proposal.kind !== 'apply-effect' || !proposal.modifierGroups.some(group => group.cohortArmorClass)) return proposal
    const recipients = [...new Set(proposals.flatMap(peer => peer.kind === 'apply-effect' && peer.effectId === proposal.effectId ? [peer.targetId] : []))].map(recipient)
    return { ...proposal, modifierGroups: proposal.modifierGroups.map(group => group.cohortArmorClass
      ? { ...group, cohortArmorClass: { ...group.cohortArmorClass, recipients } } : group) }
  })
  return bound.some(proposal => proposal.kind === 'apply-effect' && proposal.modifierGroups.some(group =>
    group.cohortArmorClass && !normalizeDnd5eCohortArmorClass(group.cohortArmorClass))) ? undefined : bound
}
