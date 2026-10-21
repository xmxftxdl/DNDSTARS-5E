import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect, effectiveDnd5eActiveEffects, projectDnd5eActiveEffectState } from './activeEffects'
import { normalizeDnd5eAwakeningEvents } from './awakeningEvents'

export interface Dnd5eDreamContact {
  schemaVersion: 1
  id: string
  sourceCharacterId: string
  targetCharacterId: string
  startedWorldMinute: number
  expiresWorldMinute: number
  phase: 'waiting' | 'connected' | 'ended'
  nightmareAttempted?: true
  endReason?: 'voluntary' | 'expired' | 'target-awake' | 'contact-lost' | 'trance-ended'
}

const identity = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256
export function normalizeDnd5eDreamContact(value: unknown, sourceId: string): Dnd5eDreamContact | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Dnd5eDreamContact
  if (raw.schemaVersion !== 1 || raw.sourceCharacterId !== sourceId || !identity(raw.id) || !identity(raw.targetCharacterId) ||
    !Number.isSafeInteger(raw.startedWorldMinute) || raw.startedWorldMinute < 0 ||
    raw.expiresWorldMinute !== raw.startedWorldMinute + 480 ||
    !['waiting', 'connected', 'ended'].includes(raw.phase) ||
    (raw.nightmareAttempted !== undefined && raw.nightmareAttempted !== true) ||
    (raw.phase === 'ended' ? !['voluntary', 'expired', 'target-awake', 'contact-lost', 'trance-ended'].includes(raw.endReason ?? '') : raw.endReason != null)) return undefined
  return { schemaVersion: 1, id: raw.id, sourceCharacterId: sourceId, targetCharacterId: raw.targetCharacterId,
    startedWorldMinute: raw.startedWorldMinute, expiresWorldMinute: raw.expiresWorldMinute,
    phase: raw.phase, ...(raw.nightmareAttempted ? { nightmareAttempted: true } : {}),
    ...(raw.endReason ? { endReason: raw.endReason } : {}) }
}

export function dnd5eCharacterIsSleeping(character: Character): boolean {
  return character.currentHp > 0 && effectiveDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects).some(effect =>
    effect.standardCondition === 'unconscious' && (effect.breakOn?.includes('awakened') || effect.source.rulesId === 'sleep'))
}

const tranceId = (session: Pick<Dnd5eDreamContact, 'id'>) => `dream-trance:${session.id}`

/** Host calls after the actual one-minute casting transaction succeeds. The
 * Walker is its own messenger; this function does not deduct casting costs. */
export function beginDnd5eDreamContact(input: {
  source: Character; target: Character; id: string; packageId: string; worldMinute: number
  knowsTarget: boolean; targetCanSleep: boolean; samePlane: boolean
}): { ok: true; character: Character } | { ok: false; reason: string } {
  const { source, target, worldMinute } = input
  if (!identity(input.id) || !identity(input.packageId) || !Number.isSafeInteger(worldMinute) || worldMinute < 0 ||
    source.dnd5eWorldTimeAppliedMinute !== worldMinute || target.dnd5eWorldTimeAppliedMinute !== worldMinute ||
    input.knowsTarget !== true || input.targetCanSleep !== true || input.samePlane !== true ||
    source.currentHp <= 0 || target.currentHp <= 0) return { ok: false, reason: 'dream-contact-ineligible' }
  const previous = normalizeDnd5eDreamContact(source.dnd5eDreamContact, source.id)
  if (source.dnd5eDreamContact != null && (!previous || previous.phase !== 'ended' || previous.id === input.id)) {
    return { ok: false, reason: 'dream-contact-already-started' }
  }
  const session: Dnd5eDreamContact = { schemaVersion: 1, id: input.id, sourceCharacterId: source.id,
    targetCharacterId: target.id, startedWorldMinute: worldMinute, expiresWorldMinute: worldMinute + 480,
    phase: dnd5eCharacterIsSleeping(target) ? 'connected' : 'waiting' }
  const effect = createDnd5eMechanicalEffect({ id: tranceId(session), definitionId: 'dream-trance', label: '托梦出神',
    source: { kind: 'spell', rulesId: 'dream', pluginId: input.packageId, actorId: source.id, characterId: source.id },
    targetId: source.id, duration: { type: 'rounds', remainingRounds: 4800, tickOn: 'target-turn-end' },
    modifiers: { preventActions: true, speedOverrideFeet: 0 },
    removal: { action: { label: '结束托梦出神', economy: 'free', selfOnly: true, maxDistanceFeet: 0 } } })
  return { ok: true, character: { ...source, dnd5eDreamContact: session,
    dnd5eCombatState: { ...source.dnd5eCombatState, activeEffects: [
      ...(source.dnd5eCombatState?.activeEffects ?? []).filter(value =>
        !((value.definitionId === 'dream-casting-trance' || /^activity:[^:]+:dream-casting-trance:modifiers:\d+$/.test(value.definitionId)) &&
          value.source.pluginId === input.packageId && value.source.rulesId === 'dream')), effect] } } }
}

export function endDnd5eDreamContact(source: Character, reason: NonNullable<Dnd5eDreamContact['endReason']> = 'voluntary'): Character {
  const session = normalizeDnd5eDreamContact(source.dnd5eDreamContact, source.id)
  if (!session || session.phase === 'ended') return source
  const projection = projectDnd5eActiveEffectState((source.dnd5eCombatState?.activeEffects ?? []).filter(effect => effect.id !== tranceId(session)))
  return { ...source, dnd5eDreamContact: { ...session, phase: 'ended', endReason: reason }, conditions: projection.conditions,
    dnd5eCombatState: { ...source.dnd5eCombatState, activeEffects: projection.activeEffects } }
}

export function reconcileDnd5eDreamContact(source: Character, target: Character | undefined, worldMinute: number, samePlane: boolean): Character {
  const session = normalizeDnd5eDreamContact(source.dnd5eDreamContact, source.id)
  if (!session || session.phase === 'ended') return source
  if (!Number.isSafeInteger(worldMinute) || worldMinute < session.startedWorldMinute) return source
  if (worldMinute >= session.expiresWorldMinute) return endDnd5eDreamContact(source, 'expired')
  if (!target || target.id !== session.targetCharacterId || !samePlane || target.currentHp <= 0) return endDnd5eDreamContact(source, 'contact-lost')
  if (source.currentHp <= 0 || !effectiveDnd5eActiveEffects(source.dnd5eCombatState?.activeEffects).some(effect => effect.id === tranceId(session))) {
    return endDnd5eDreamContact(source, 'trance-ended')
  }
  if (session.phase === 'waiting' && dnd5eCharacterIsSleeping(target)) return { ...source, dnd5eDreamContact: { ...session, phase: 'connected' } }
  if (session.phase === 'connected' && !dnd5eCharacterIsSleeping(target)) return endDnd5eDreamContact(source, 'target-awake')
  return source
}

/** Run after every character's clock has settled. Plane eligibility belongs to
 * the casting authorization; this pass handles sleep and the fixed deadline.
 * Do not pair a source with an ambiguous or partially advanced target. */
export function reconcileDnd5eDreamContactRoster(characters: readonly Character[]): Character[] {
  return characters.map(source => {
    const session = normalizeDnd5eDreamContact(source.dnd5eDreamContact, source.id)
    const minute = source.dnd5eWorldTimeAppliedMinute
    if (!session || session.phase === 'ended' || minute == null) return source
    const targets = characters.filter(character => character.id === session.targetCharacterId)
    if (targets.length !== 1) return endDnd5eDreamContact(source, 'contact-lost')
    const target = targets[0]
    // Expiry is source-owned and must not wait for a stale target clock.
    if (minute >= session.expiresWorldMinute) return endDnd5eDreamContact(source, 'expired')
    if (target.dnd5eWorldTimeAppliedMinute !== minute) return source
    // A single clock advance can cross both sleep and awakening. The durable
    // Host event proves the missed transition even if the final snapshot is
    // already awake (or the target has since fallen asleep again).
    const awakened = normalizeDnd5eAwakeningEvents(target.dnd5eAwakeningEvents, target.id)?.some(event =>
      event.worldMinute > session.startedWorldMinute && event.worldMinute <= minute)
    if (awakened) return endDnd5eDreamContact(source, 'target-awake')
    return reconcileDnd5eDreamContact(source, target, minute, true)
  })
}

/** Only lifecycle-relevant changes reopen the campaign reconciliation gate. */
export function dnd5eDreamContactRosterKey(characters: readonly Character[]): string {
  return JSON.stringify(characters.flatMap(source => {
    const session = normalizeDnd5eDreamContact(source.dnd5eDreamContact, source.id)
    if (!session || session.phase === 'ended') return []
    const targets = characters.filter(character => character.id === session.targetCharacterId)
    return [[source.id, session, source.currentHp, source.dnd5eWorldTimeAppliedMinute,
      effectiveDnd5eActiveEffects(source.dnd5eCombatState?.activeEffects).some(effect => effect.id === tranceId(session)),
      targets.map(target => [target.id, target.currentHp, target.dnd5eWorldTimeAppliedMinute,
        dnd5eCharacterIsSleeping(target), target.dnd5eAwakeningEvents])]]
  }))
}
