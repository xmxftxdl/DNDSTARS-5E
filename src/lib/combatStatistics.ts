import type {
  Dnd5eAction,
  Dnd5eActionResult,
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from '../rulesets/dnd5e/headlessCombatEngine'

export const COMBAT_STATISTICS_RESOURCE = 'combat-statistics'
export const COMBAT_STATISTICS_SCHEMA_VERSION = 1
export const COMBAT_STATISTICS_MAX_SESSIONS = 24
export const COMBAT_STATISTICS_MAX_RECEIPTS = 4_096

export type CombatStatisticsSide = 'player' | 'enemy' | 'npc'

export interface CombatantStatistics {
  combatantId: string
  name: string
  side: CombatStatisticsSide
  damageDealt: number
  damageTaken: number
  healingDone: number
  healingReceived: number
  temporaryHpGranted: number
  damagePrevented: number
  hostileConditionsApplied: number
  attacks: number
  hits: number
  criticalHits: number
  knockouts: number
  kills: number
  alliesRescued: number
  successfulSaves: number
  failedSaves: number
  concentrationChecks: number
  concentrationMaintained: number
  actionsSpent: number
  bonusActionsSpent: number
  reactionsSpent: number
  movementSpentFeet: number
  classResourcesSpent: number
  spellSlotsSpent: number
}

export interface CombatStatisticsSession {
  combatId: string
  mapId: string
  startedAt: number
  updatedAt: number
  lastRound: number
  combatants: Record<string, CombatantStatistics>
  receipts: string[]
}

export interface SharedCombatStatisticsState {
  schemaVersion: typeof COMBAT_STATISTICS_SCHEMA_VERSION
  sessions: CombatStatisticsSession[]
  updatedAt: number
}

export interface Dnd5eCombatStatisticsObservation {
  mapId: string
  source: Dnd5eHeadlessCombatState
  action: Dnd5eAction
  result: Dnd5eActionResult
  receiptId: string
  observedAt: number
  sideByCombatantId?: Readonly<Record<string, CombatStatisticsSide>>
}

function emptyCombatant(
  combatantId: string,
  name: string,
  side: CombatStatisticsSide,
): CombatantStatistics {
  return {
    combatantId, name, side,
    damageDealt: 0, damageTaken: 0,
    healingDone: 0, healingReceived: 0,
    temporaryHpGranted: 0, damagePrevented: 0,
    hostileConditionsApplied: 0,
    attacks: 0, hits: 0, criticalHits: 0,
    knockouts: 0, kills: 0, alliesRescued: 0,
    successfulSaves: 0, failedSaves: 0,
    concentrationChecks: 0, concentrationMaintained: 0,
    actionsSpent: 0, bonusActionsSpent: 0, reactionsSpent: 0, movementSpentFeet: 0,
    classResourcesSpent: 0, spellSlotsSpent: 0,
  }
}

function sideFor(controller: string | undefined): CombatStatisticsSide {
  return controller === 'player' ? 'player' : controller === 'dm' || controller === 'enemy' ? 'enemy' : 'npc'
}

function safeAmount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0
}

function actionActorId(action: Dnd5eAction): string | undefined {
  return 'actorId' in action && typeof action.actorId === 'string' ? action.actorId : undefined
}

function eventSourceId(event: Dnd5eCombatEvent, fallback: string | undefined): string | undefined {
  if ('sourceId' in event && typeof event.sourceId === 'string') return event.sourceId
  if ('actorId' in event && typeof event.actorId === 'string') return event.actorId
  return fallback
}

function ensureCombatant(
  session: CombatStatisticsSession,
  state: Dnd5eHeadlessCombatState,
  id: string | undefined,
): CombatantStatistics | undefined {
  if (!id) return undefined
  const existing = session.combatants[id]
  const combatant = state.combatants[id]
  if (existing) {
    if (combatant?.name) existing.name = combatant.name
    return existing
  }
  const created = emptyCombatant(id, combatant?.name || id, sideFor(combatant?.controller))
  session.combatants[id] = created
  return created
}

function opposed(state: Dnd5eHeadlessCombatState, sourceId: string | undefined, targetId: string): boolean {
  const source = sourceId ? state.combatants[sourceId] : undefined
  const target = state.combatants[targetId]
  return !!source && !!target && source.controller !== target.controller
}

function applyEvent(
  session: CombatStatisticsSession,
  state: Dnd5eHeadlessCombatState,
  event: Dnd5eCombatEvent,
  fallbackActorId: string | undefined,
  zeroedByDamage: ReadonlySet<string>,
): void {
  if (event.type === 'damage-applied') {
    const sourceId = eventSourceId(event, fallbackActorId)
    const effective = Math.max(0,
      event.hpBefore - event.hpAfter + event.temporaryHpBefore - event.temporaryHpAfter,
    )
    const source = ensureCombatant(session, state, sourceId)
    const target = ensureCombatant(session, state, event.targetId)
    if (source && sourceId !== event.targetId) source.damageDealt += effective
    if (target) target.damageTaken += effective
    const targetState = state.combatants[event.targetId]
    if (source && event.hpBefore > 0 && event.hpAfter === 0) {
      source.knockouts += 1
      if (targetState && !targetState.usesDeathSaves && !targetState.classState.undeadFortitudePending) {
        source.kills += 1
      }
    }
    return
  }
  if (event.type === 'healing-applied') {
    const sourceId = fallbackActorId ?? event.targetId
    const source = ensureCombatant(session, state, sourceId)
    const target = ensureCombatant(session, state, event.targetId)
    if (source) source.healingDone += safeAmount(event.amount)
    if (target) target.healingReceived += safeAmount(event.amount)
    if (source && sourceId !== event.targetId && event.hpBefore === 0 && event.hpAfter > 0) source.alliesRescued += 1
    return
  }
  if (event.type === 'temporary-hit-points-gained') {
    const sourceId = fallbackActorId ?? event.actorId
    const source = ensureCombatant(session, state, sourceId)
    if (source) source.temporaryHpGranted += safeAmount(event.amount)
    return
  }
  if (event.type === 'damage-reduced') {
    const target = ensureCombatant(session, state, event.targetId)
    if (target) target.damagePrevented += Math.max(0, event.damageBefore - event.damageAfter)
    return
  }
  if (event.type === 'condition-applied') {
    if (opposed(state, event.actorId, event.targetId)) {
      const source = ensureCombatant(session, state, event.actorId)
      if (source) source.hostileConditionsApplied += 1
    }
    return
  }
  if (event.type === 'undead-turned' || event.type === 'unholy-turned') {
    const source = ensureCombatant(session, state, event.actorId)
    if (source) source.hostileConditionsApplied += 1
    return
  }
  if (event.type === 'attack-resolved') {
    const source = ensureCombatant(session, state, event.actorId)
    if (!source) return
    source.attacks += 1
    if (event.hit) source.hits += 1
    if (event.critical) source.criticalHits += 1
    return
  }
  if (event.type === 'saving-throw-resolved') {
    const target = ensureCombatant(session, state, event.targetId)
    if (target) target[event.success ? 'successfulSaves' : 'failedSaves'] += 1
    return
  }
  if (event.type === 'concentration-resolved') {
    const actor = ensureCombatant(session, state, event.actorId)
    if (!actor) return
    actor.concentrationChecks += 1
    if (event.success) actor.concentrationMaintained += 1
    return
  }
  if (event.type === 'turn-resource-spent') {
    const actor = ensureCombatant(session, state, event.actorId)
    if (!actor) return
    if (event.resource === 'action') actor.actionsSpent += safeAmount(event.amount ?? 1)
    else if (event.resource === 'bonusAction') actor.bonusActionsSpent += safeAmount(event.amount ?? 1)
    else if (event.resource === 'reaction') actor.reactionsSpent += safeAmount(event.amount ?? 1)
    else if (event.resource === 'movement') actor.movementSpentFeet += safeAmount(event.amount)
    return
  }
  if (event.type === 'class-resource-spent') {
    const actor = ensureCombatant(session, state, event.actorId)
    if (actor) actor.classResourcesSpent += 1
    return
  }
  if (event.type === 'spell-cast' && event.slotLevel > 0) {
    const actor = ensureCombatant(session, state, event.actorId)
    if (actor) actor.spellSlotsSpent += 1
    return
  }
  if (event.type === 'undead-destroyed') {
    const actor = ensureCombatant(session, state, event.actorId)
    if (actor) actor.kills += 1
    return
  }
  if (event.type === 'instant-death') {
    const source = ensureCombatant(session, state, event.sourceId)
    if (!source || event.sourceId === event.targetId) return
    const targetUsesDeathSaves = state.combatants[event.targetId]?.usesDeathSaves === true
    if (!zeroedByDamage.has(event.targetId)) source.knockouts += 1
    if (!zeroedByDamage.has(event.targetId) || targetUsesDeathSaves) source.kills += 1
  }
}

export function createCombatStatisticsSession(input: {
  combatId: string
  mapId: string
  state?: Dnd5eHeadlessCombatState
  sideByCombatantId?: Readonly<Record<string, CombatStatisticsSide>>
  now?: number
}): CombatStatisticsSession {
  const now = input.now ?? Date.now()
  const session: CombatStatisticsSession = {
    combatId: input.combatId,
    mapId: input.mapId,
    startedAt: now,
    updatedAt: now,
    lastRound: input.state?.round ?? 1,
    combatants: {},
    receipts: [],
  }
  for (const combatant of Object.values(input.state?.combatants ?? {})) {
    session.combatants[combatant.id] = emptyCombatant(
      combatant.id,
      combatant.name,
      input.sideByCombatantId?.[combatant.id] ?? sideFor(combatant.controller),
    )
  }
  return session
}

export function applyDnd5eCombatStatisticsObservation(
  current: CombatStatisticsSession | undefined,
  observation: Dnd5eCombatStatisticsObservation,
): CombatStatisticsSession {
  const resultState = observation.result.state
  const session = current
    ? {
        ...current,
        combatants: Object.fromEntries(Object.entries(current.combatants).map(([id, value]) => [id, { ...value }])),
        receipts: [...current.receipts],
      }
    : createCombatStatisticsSession({
        combatId: resultState.combatId,
        mapId: observation.mapId,
        state: observation.source,
        sideByCombatantId: observation.sideByCombatantId,
        now: observation.observedAt,
      })
  for (const combatant of Object.values(resultState.combatants)) {
    const stats = ensureCombatant(session, resultState, combatant.id)
    if (stats && observation.sideByCombatantId?.[combatant.id]) {
      stats.side = observation.sideByCombatantId[combatant.id]
    }
  }
  if (session.receipts.includes(observation.receiptId) || !observation.result.ok) return session
  let fallbackActorId = actionActorId(observation.action)
  const zeroedByDamage = new Set(observation.result.events.flatMap((event) =>
    event.type === 'damage-applied' && event.hpBefore > 0 && event.hpAfter === 0 ? [event.targetId] : [],
  ))
  for (const event of observation.result.events) {
    if (event.type === 'turn-started') fallbackActorId = event.actorId
    applyEvent(session, resultState, event, fallbackActorId, zeroedByDamage)
  }
  session.receipts = [...session.receipts, observation.receiptId].slice(-COMBAT_STATISTICS_MAX_RECEIPTS)
  session.lastRound = resultState.round
  session.updatedAt = observation.observedAt
  return session
}

export function combatantContributionScore(stats: CombatantStatistics): number {
  return stats.damageDealt + stats.healingDone + stats.temporaryHpGranted + stats.damagePrevented +
    stats.hostileConditionsApplied * 5 + stats.kills * 10 + stats.alliesRescued * 10
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const numericCombatantFields: Array<keyof CombatantStatistics> = [
  'damageDealt', 'damageTaken', 'healingDone', 'healingReceived', 'temporaryHpGranted', 'damagePrevented',
  'hostileConditionsApplied', 'attacks', 'hits', 'criticalHits', 'knockouts', 'kills', 'alliesRescued',
  'successfulSaves', 'failedSaves', 'concentrationChecks', 'concentrationMaintained', 'actionsSpent',
  'bonusActionsSpent', 'reactionsSpent', 'movementSpentFeet', 'classResourcesSpent', 'spellSlotsSpent',
]

export function normalizeSharedCombatStatistics(value: unknown): SharedCombatStatisticsState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (raw.schemaVersion !== COMBAT_STATISTICS_SCHEMA_VERSION || !Array.isArray(raw.sessions) ||
    raw.sessions.length > COMBAT_STATISTICS_MAX_SESSIONS || !finiteNonNegative(raw.updatedAt)) return undefined
  const sessions: CombatStatisticsSession[] = []
  for (const entry of raw.sessions) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined
    const session = entry as Record<string, unknown>
    if (typeof session.combatId !== 'string' || !session.combatId || typeof session.mapId !== 'string' || !session.mapId ||
      !finiteNonNegative(session.startedAt) || !finiteNonNegative(session.updatedAt) || !finiteNonNegative(session.lastRound) ||
      !session.combatants || typeof session.combatants !== 'object' || Array.isArray(session.combatants) ||
      !Array.isArray(session.receipts) || session.receipts.length > COMBAT_STATISTICS_MAX_RECEIPTS ||
      !session.receipts.every((receipt) => typeof receipt === 'string' && receipt.length > 0 && receipt.length <= 160)) return undefined
    const combatants: Record<string, CombatantStatistics> = {}
    const entries = Object.entries(session.combatants as Record<string, unknown>)
    if (entries.length > 512) return undefined
    for (const [id, rawStats] of entries) {
      if (!id || id.length > 160 || !rawStats || typeof rawStats !== 'object' || Array.isArray(rawStats)) return undefined
      const stats = rawStats as unknown as CombatantStatistics
      if (stats.combatantId !== id || typeof stats.name !== 'string' || stats.name.length > 240 ||
        !['player', 'enemy', 'npc'].includes(stats.side) || numericCombatantFields.some((field) => !finiteNonNegative(stats[field]))) {
        return undefined
      }
      combatants[id] = { ...stats }
    }
    sessions.push({
      combatId: session.combatId,
      mapId: session.mapId,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      lastRound: session.lastRound,
      combatants,
      receipts: [...session.receipts],
    })
  }
  if (new Set(sessions.map((session) => session.combatId)).size !== sessions.length) return undefined
  return { schemaVersion: COMBAT_STATISTICS_SCHEMA_VERSION, sessions, updatedAt: raw.updatedAt }
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function dnd5eCombatStatisticsReceipt(input: {
  source: Dnd5eHeadlessCombatState
  action: Dnd5eAction
  result: Dnd5eActionResult
}): string {
  const combatants = Object.values(input.source.combatants).map((combatant) => ({
    id: combatant.id,
    hp: combatant.currentHp,
    temporaryHp: combatant.temporaryHp,
    position: combatant.position,
    turn: combatant.turn,
  }))
  return `headless:${fnv1a(JSON.stringify([
    input.source.combatId, input.source.round, input.source.initiativeIndex,
    combatants, input.action, input.result.events,
  ]))}`
}
