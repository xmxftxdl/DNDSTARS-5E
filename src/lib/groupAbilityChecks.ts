import { ABILITIES, SKILLS, type AbilityKey } from './dnd'

export const GROUP_ABILITY_CHECK_RESOURCE = 'group-ability-checks'
export const GROUP_ABILITY_CHECK_SCHEMA_VERSION = 1
export const GROUP_ABILITY_CHECK_LIMIT = 40

export type GroupAbilityCheckMode = 'normal' | 'advantage' | 'disadvantage'
export type GroupAbilityCheckStatus = 'open' | 'completed' | 'cancelled'
export type GroupAbilityCheckResultSource = 'roll' | 'roll-passive-fallback' | 'passive-only'

export interface GroupAbilityCheckParticipant {
  memberId: string
  memberName: string
  characterId: string
  characterName: string
  avatar: string
}

export interface GroupAbilityCheckResult {
  memberId: string
  characterId: string
  rolls: number[]
  effectiveRolls: number[]
  d20: number
  modifier: number
  rolledTotal: number
  passiveTotal: number
  finalTotal: number
  success: boolean
  mode: GroupAbilityCheckMode
  proficiencyRank: 0 | 1 | 2
  reliableTalentApplied: boolean
  indomitableMightApplied: boolean
  source: GroupAbilityCheckResultSource
  rolledAt: number
}

export interface GroupAbilityCheckAggregate {
  participantCount: number
  resolvedCount: number
  successCount: number
  failureCount: number
  requiredSuccesses: number
  groupSuccess: boolean
}

export interface GroupAbilityCheckTransaction {
  id: string
  status: GroupAbilityCheckStatus
  label: string
  ability: AbilityKey
  skill?: string
  rollKind: 'ability-check' | 'saving-throw'
  dc: number
  requestedMode: GroupAbilityCheckMode
  allowPassiveFallback: boolean
  mapId?: string
  participants: GroupAbilityCheckParticipant[]
  results: GroupAbilityCheckResult[]
  aggregate?: GroupAbilityCheckAggregate
  createdByMemberId: string
  createdByName: string
  createdAt: number
  expiresAt: number
  completedAt?: number
  cancelledAt?: number
  updatedAt: number
}

export interface SharedGroupAbilityChecksState {
  schemaVersion: typeof GROUP_ABILITY_CHECK_SCHEMA_VERSION
  checks: GroupAbilityCheckTransaction[]
  updatedAt: number
}

export type GroupAbilityCheckMutation =
  | {
      operation: 'create'
      label: string
      selection: `ability:${AbilityKey}` | `skill:${string}` | `save:${AbilityKey}`
      dc: number
      mode: GroupAbilityCheckMode
      allowPassiveFallback: boolean
      participantCharacterIds: string[]
      mapId?: string
    }
  | { operation: 'roll'; checkId: string }
  | { operation: 'finalize'; checkId: string; usePassiveForPending?: boolean }
  | { operation: 'cancel'; checkId: string }

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function bounded(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function finiteTimestamp(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function validAbility(value: unknown): value is AbilityKey {
  return ABILITIES.some((ability) => ability.key === value)
}

function validMode(value: unknown): value is GroupAbilityCheckMode {
  return value === 'normal' || value === 'advantage' || value === 'disadvantage'
}

function normalizeParticipant(value: unknown): GroupAbilityCheckParticipant | null {
  if (!object(value)) return null
  const memberId = bounded(value.memberId, 160)
  const memberName = bounded(value.memberName, 80)
  const characterId = bounded(value.characterId, 160)
  const characterName = bounded(value.characterName, 80)
  if (!memberId || !memberName || !characterId || !characterName) return null
  return { memberId, memberName, characterId, characterName, avatar: bounded(value.avatar, 12) || '🎲' }
}

function normalizeResult(value: unknown): GroupAbilityCheckResult | null {
  if (!object(value) || !validMode(value.mode)) return null
  const memberId = bounded(value.memberId, 160)
  const characterId = bounded(value.characterId, 160)
  const rolls = Array.isArray(value.rolls) ? value.rolls.map(Number) : []
  const effectiveRolls = Array.isArray(value.effectiveRolls) ? value.effectiveRolls.map(Number) : []
  const source = value.source
  if (
    !memberId || !characterId ||
    !rolls.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= 20) ||
    !effectiveRolls.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= 20) ||
    (source !== 'roll' && source !== 'roll-passive-fallback' && source !== 'passive-only')
  ) return null
  const rank = Number(value.proficiencyRank)
  if (rank !== 0 && rank !== 1 && rank !== 2) return null
  return {
    memberId,
    characterId,
    rolls,
    effectiveRolls,
    d20: Number(value.d20) || 0,
    modifier: Number(value.modifier) || 0,
    rolledTotal: Number(value.rolledTotal) || 0,
    passiveTotal: Number(value.passiveTotal) || 0,
    finalTotal: Number(value.finalTotal) || 0,
    success: value.success === true,
    mode: value.mode,
    proficiencyRank: rank,
    reliableTalentApplied: value.reliableTalentApplied === true,
    indomitableMightApplied: value.indomitableMightApplied === true,
    source,
    rolledAt: finiteTimestamp(value.rolledAt),
  }
}

function normalizeAggregate(value: unknown): GroupAbilityCheckAggregate | undefined {
  if (!object(value)) return undefined
  const fields = ['participantCount', 'resolvedCount', 'successCount', 'failureCount', 'requiredSuccesses'] as const
  if (fields.some((field) => !Number.isInteger(value[field]) || Number(value[field]) < 0)) return undefined
  return {
    participantCount: Number(value.participantCount),
    resolvedCount: Number(value.resolvedCount),
    successCount: Number(value.successCount),
    failureCount: Number(value.failureCount),
    requiredSuccesses: Number(value.requiredSuccesses),
    groupSuccess: value.groupSuccess === true,
  }
}

function normalizeCheck(value: unknown): GroupAbilityCheckTransaction | null {
  if (!object(value)) return null
  const status = value.status
  if (status !== 'open' && status !== 'completed' && status !== 'cancelled') return null
  if (!validAbility(value.ability) || !validMode(value.requestedMode)) return null
  const id = bounded(value.id, 160)
  const label = bounded(value.label, 160)
  const createdByMemberId = bounded(value.createdByMemberId, 160)
  const createdByName = bounded(value.createdByName, 80)
  const participants = (Array.isArray(value.participants) ? value.participants : [])
    .map(normalizeParticipant).filter((entry): entry is GroupAbilityCheckParticipant => entry !== null)
  if (!id || !label || !createdByMemberId || !createdByName || participants.length < 1) return null
  const participantIds = new Set(participants.map((entry) => entry.memberId))
  if (participantIds.size !== participants.length) return null
  const results = (Array.isArray(value.results) ? value.results : [])
    .map(normalizeResult).filter((entry): entry is GroupAbilityCheckResult => entry !== null)
    .filter((entry, index, all) => participantIds.has(entry.memberId) && all.findIndex((candidate) => candidate.memberId === entry.memberId) === index)
  const skill = bounded(value.skill, 80) || undefined
  if (skill && !SKILLS.some((entry) => entry.key === skill && entry.ability === value.ability)) return null
  const rollKind = value.rollKind === 'saving-throw' ? 'saving-throw' : 'ability-check'
  if (rollKind === 'saving-throw' && skill) return null
  return {
    id,
    status,
    label,
    ability: value.ability,
    skill,
    rollKind,
    dc: Math.min(100, Math.max(0, Math.floor(Number(value.dc) || 0))),
    requestedMode: value.requestedMode,
    allowPassiveFallback: value.allowPassiveFallback === true,
    mapId: bounded(value.mapId, 160) || undefined,
    participants,
    results,
    aggregate: normalizeAggregate(value.aggregate),
    createdByMemberId,
    createdByName,
    createdAt: finiteTimestamp(value.createdAt),
    expiresAt: finiteTimestamp(value.expiresAt),
    completedAt: value.completedAt == null ? undefined : finiteTimestamp(value.completedAt),
    cancelledAt: value.cancelledAt == null ? undefined : finiteTimestamp(value.cancelledAt),
    updatedAt: finiteTimestamp(value.updatedAt),
  }
}

export function validateSharedGroupAbilityChecks(value: unknown): boolean {
  if (!object(value) || value.schemaVersion !== GROUP_ABILITY_CHECK_SCHEMA_VERSION || !Array.isArray(value.checks) || value.checks.length > GROUP_ABILITY_CHECK_LIMIT) return false
  const checkIds = new Set<string>()
  for (const rawCheck of value.checks) {
    if (!object(rawCheck) || !Array.isArray(rawCheck.participants) || !Array.isArray(rawCheck.results)) return false
    const check = normalizeCheck(rawCheck)
    if (!check || checkIds.has(check.id) || rawCheck.participants.length !== check.participants.length || rawCheck.results.length !== check.results.length) return false
    if (!Number.isInteger(rawCheck.dc) || Number(rawCheck.dc) < 0 || Number(rawCheck.dc) > 100 || check.participants.length > 8) return false
    if (!Number.isFinite(rawCheck.createdAt) || !Number.isFinite(rawCheck.expiresAt) || !Number.isFinite(rawCheck.updatedAt)) return false
    if (check.expiresAt < check.createdAt) return false
    const participants = new Map(check.participants.map((participant) => [participant.memberId, participant]))
    for (const rawResult of rawCheck.results) {
      if (!object(rawResult) || !Array.isArray(rawResult.rolls) || !Array.isArray(rawResult.effectiveRolls)) return false
      const participant = participants.get(String(rawResult.memberId))
      if (!participant || participant.characterId !== rawResult.characterId) return false
      const numericFields = ['d20', 'modifier', 'rolledTotal', 'passiveTotal', 'finalTotal', 'rolledAt'] as const
      if (numericFields.some((field) => !Number.isFinite(rawResult[field])) || Number(rawResult.rolledAt) < 0) return false
      if (rawResult.source === 'passive-only') {
        if (rawResult.rolls.length !== 0 || rawResult.effectiveRolls.length !== 0 || rawResult.d20 !== 0) return false
      } else {
        const expectedRolls = rawResult.mode === 'normal' ? 1 : 2
        if (rawResult.rolls.length !== expectedRolls || rawResult.effectiveRolls.length !== expectedRolls) return false
      }
    }
    if (check.status === 'completed' && (!check.aggregate || check.results.length !== check.participants.length)) return false
    checkIds.add(check.id)
  }
  return value.updatedAt == null || (Number.isFinite(value.updatedAt) && Number(value.updatedAt) >= 0)
}

export function normalizeSharedGroupAbilityChecks(value: unknown): SharedGroupAbilityChecksState {
  const source = object(value) ? value : {}
  return {
    schemaVersion: GROUP_ABILITY_CHECK_SCHEMA_VERSION,
    checks: (Array.isArray(source.checks) ? source.checks : [])
      .map(normalizeCheck)
      .filter((entry): entry is GroupAbilityCheckTransaction => entry !== null)
      .slice(-GROUP_ABILITY_CHECK_LIMIT),
    updatedAt: finiteTimestamp(source.updatedAt),
  }
}

export function groupAbilityCheckName(check: Pick<GroupAbilityCheckTransaction, 'ability' | 'skill' | 'rollKind'>): string {
  const ability = ABILITIES.find((entry) => entry.key === check.ability)?.label ?? check.ability
  if (check.rollKind === 'saving-throw') return `${ability}豁免`
  const skill = check.skill ? SKILLS.find((entry) => entry.key === check.skill)?.label : undefined
  return skill ? `${ability}（${skill}）检定` : `${ability}检定`
}

export function groupAbilityCheckAggregate(
  check: Pick<GroupAbilityCheckTransaction, 'participants' | 'results'>,
): GroupAbilityCheckAggregate {
  const participantCount = check.participants.length
  const successCount = check.results.filter((entry) => entry.success).length
  const resolvedCount = check.results.length
  const requiredSuccesses = Math.ceil(participantCount / 2)
  return {
    participantCount,
    resolvedCount,
    successCount,
    failureCount: resolvedCount - successCount,
    requiredSuccesses,
    groupSuccess: resolvedCount === participantCount && successCount >= requiredSuccesses,
  }
}
