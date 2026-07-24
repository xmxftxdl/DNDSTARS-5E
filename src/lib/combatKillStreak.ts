import type {
  Dnd5eCombatEvent,
  Dnd5eHeadlessResolutionObservation,
} from '../rulesets/dnd5e/headlessCombatEngine'

export type CombatKillStreakStyle = 'arcane' | 'martial'

export interface CombatKillCredit {
  killerId: string
  targetId: string
}

export interface CombatKillStreakEntry {
  turnKey: string
  targetIds: readonly string[]
  triggered: boolean
}

export type CombatKillStreakTracker = Readonly<Record<string, CombatKillStreakEntry>>

const ARCANE_CLASS_IDS = new Set([
  'bard',
  'cleric',
  'druid',
  'sorcerer',
  'warlock',
  'wizard',
])

function actionActorId(action: Dnd5eHeadlessResolutionObservation['action']): string | undefined {
  return 'actorId' in action && typeof action.actorId === 'string' ? action.actorId : undefined
}

function eventKillCredit(
  event: Dnd5eCombatEvent,
  fallbackActorId: string | undefined,
  observation: Dnd5eHeadlessResolutionObservation,
): CombatKillCredit | null {
  if (event.type === 'damage-applied') {
    if (event.hpBefore <= 0 || event.hpAfter !== 0) return null
    const target = observation.result.state.combatants[event.targetId]
    if (
      !target ||
      target.currentHp !== 0 ||
      !target.deathSaves.dead ||
      target.usesDeathSaves ||
      target.classState.undeadFortitudePending ||
      target.classState.monsterRegenerationPendingAtZero
    ) return null
    const killerId = event.sourceId ?? fallbackActorId
    return killerId ? { killerId, targetId: event.targetId } : null
  }
  if (event.type === 'hit-points-reduced-to-zero') {
    const target = observation.result.state.combatants[event.targetId]
    return target?.currentHp === 0 && target.deathSaves.dead
      ? { killerId: event.sourceId, targetId: event.targetId }
      : null
  }
  if (event.type === 'instant-death') {
    return { killerId: event.sourceId, targetId: event.targetId }
  }
  if (event.type === 'undead-destroyed') {
    return { killerId: event.actorId, targetId: event.targetId }
  }
  return null
}

export function dnd5eCombatKillCredits(input: {
  observation: Dnd5eHeadlessResolutionObservation
  sideByCombatantId: Readonly<Record<string, 'player' | 'enemy' | 'npc'>>
}): CombatKillCredit[] {
  if (!input.observation.result.ok) return []
  const fallbackActorId = actionActorId(input.observation.action)
  const unique = new Map<string, CombatKillCredit>()
  for (const event of input.observation.result.events) {
    const credit = eventKillCredit(event, fallbackActorId, input.observation)
    if (
      !credit ||
      input.sideByCombatantId[credit.killerId] !== 'player' ||
      input.sideByCombatantId[credit.targetId] !== 'enemy'
    ) continue
    unique.set(`${credit.killerId}\u0000${credit.targetId}`, credit)
  }
  return [...unique.values()]
}

export function advanceCombatKillStreak(input: {
  current: CombatKillStreakTracker
  turnKey: string
  credits: readonly CombatKillCredit[]
  threshold?: number
}): {
  next: CombatKillStreakTracker
  triggeredKillerIds: readonly string[]
} {
  const threshold = Math.max(1, Math.floor(input.threshold ?? 3))
  const next: Record<string, CombatKillStreakEntry> = { ...input.current }
  const triggeredKillerIds: string[] = []
  for (const credit of input.credits) {
    const previous = next[credit.killerId]
    const targetIds = new Set(
      previous?.turnKey === input.turnKey ? previous.targetIds : [],
    )
    const alreadyTriggered = previous?.turnKey === input.turnKey && previous.triggered
    targetIds.add(credit.targetId)
    const triggered = alreadyTriggered || targetIds.size >= threshold
    next[credit.killerId] = {
      turnKey: input.turnKey,
      targetIds: [...targetIds],
      triggered,
    }
    if (!alreadyTriggered && triggered) triggeredKillerIds.push(credit.killerId)
  }
  return { next, triggeredKillerIds }
}

export function combatKillStreakStyleForClass(classId: string | undefined): CombatKillStreakStyle {
  return classId && ARCANE_CLASS_IDS.has(classId) ? 'arcane' : 'martial'
}

export function combatKillStreakClassId(
  observation: Dnd5eHeadlessResolutionObservation,
  killerId: string,
): string {
  const action = observation.action
  if (
    action.type === 'cast-spell' &&
    action.actorId === killerId &&
    typeof action.castingClassId === 'string' &&
    action.castingClassId
  ) {
    return action.castingClassId
  }
  const killer = observation.result.ok
    ? observation.result.state.combatants[killerId]
    : undefined
  if (killer?.classId) return killer.classId
  return Object.entries(killer?.classLevels ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'fighter'
}
