import type {
  Dnd5eAction,
  Dnd5eActionResult,
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from '../rulesets/dnd5e/headlessCombatEngine'
import type { CombatExperienceSettlement } from './combatExperience'

export const COMBAT_STATISTICS_RESOURCE = 'combat-statistics'
export const COMBAT_STATISTICS_SCHEMA_VERSION = 3
export const COMBAT_STATISTICS_MAX_SESSIONS = 24
export const COMBAT_STATISTICS_MAX_RECEIPTS = 4_096
export const D20_FACE_COUNT = 20

export type CombatStatisticsSide = 'player' | 'enemy' | 'npc'

export interface CombatantStatistics {
  combatantId: string
  characterId?: string
  name: string
  side: CombatStatisticsSide
  turnsTaken: number
  /** 与 turnsTaken 同一 V3 采样窗口内的有效伤害，避免旧存档累计量污染每回合均值。 */
  turnTrackedDamageDealt: number
  /** 与 turnsTaken 同一 V3 采样窗口内的有效治疗。 */
  turnTrackedHealingDone: number
  /** 仅记录 Headless 最终采用的天然 d20；索引 0 对应骰面 1。 */
  combatD20FaceCounts: number[]
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
  /** DM 权威确认的本场经验结算；存在时同一 combatId 不得再次发奖。 */
  experienceSettlement?: CombatExperienceSettlement
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
  characterIdByCombatantId?: Readonly<Record<string, string>>
}

export function emptyD20FaceCounts(): number[] {
  return Array.from({ length: D20_FACE_COUNT }, () => 0)
}

function emptyCombatant(
  combatantId: string,
  name: string,
  side: CombatStatisticsSide,
  characterId?: string,
): CombatantStatistics {
  return {
    combatantId, characterId, name, side,
    turnsTaken: 0,
    turnTrackedDamageDealt: 0,
    turnTrackedHealingDone: 0,
    combatD20FaceCounts: emptyD20FaceCounts(),
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
    existing.turnsTaken = finiteNonNegative(existing.turnsTaken) ? existing.turnsTaken : 0
    existing.turnTrackedDamageDealt = finiteNonNegative(existing.turnTrackedDamageDealt)
      ? existing.turnTrackedDamageDealt
      : 0
    existing.turnTrackedHealingDone = finiteNonNegative(existing.turnTrackedHealingDone)
      ? existing.turnTrackedHealingDone
      : 0
    existing.combatD20FaceCounts = Array.isArray(existing.combatD20FaceCounts) &&
      existing.combatD20FaceCounts.length === D20_FACE_COUNT
      ? existing.combatD20FaceCounts
      : emptyD20FaceCounts()
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
  const d20Sample = d20SampleForEvent(event)
  if (d20Sample) {
    const roller = ensureCombatant(session, state, d20Sample.combatantId)
    if (roller) roller.combatD20FaceCounts[d20Sample.d20 - 1] += 1
  }
  if (event.type === 'turn-started') {
    const actor = ensureCombatant(session, state, event.actorId)
    if (actor) actor.turnsTaken += 1
    return
  }
  if (event.type === 'damage-applied') {
    const sourceId = eventSourceId(event, fallbackActorId)
    const effective = Math.max(0,
      event.hpBefore - event.hpAfter + event.temporaryHpBefore - event.temporaryHpAfter,
    )
    const source = ensureCombatant(session, state, sourceId)
    const target = ensureCombatant(session, state, event.targetId)
    if (source && sourceId !== event.targetId) {
      source.damageDealt += effective
      source.turnTrackedDamageDealt += effective
    }
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
    if (source) {
      source.healingDone += safeAmount(event.amount)
      source.turnTrackedHealingDone += safeAmount(event.amount)
    }
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

function d20SampleForEvent(
  event: Dnd5eCombatEvent,
): { combatantId: string; d20: number } | undefined {
  let combatantId: string | undefined
  let d20: number | undefined
  if (event.type === 'attack-resolved') {
    combatantId = event.actorId
    d20 = event.d20
  } else if (event.type === 'saving-throw-resolved') {
    combatantId = event.targetId
    d20 = event.d20
  } else if (
    event.type === 'ability-check-resolved' ||
    event.type === 'hide-resolved' ||
    event.type === 'death-save-resolved' ||
    event.type === 'concentration-resolved' ||
    event.type === 'relentless-rage-resolved'
  ) {
    combatantId = event.actorId
    d20 = event.d20
  }
  return combatantId && Number.isInteger(d20) && d20! >= 1 && d20! <= D20_FACE_COUNT
    ? { combatantId, d20: d20! }
    : undefined
}

export function createCombatStatisticsSession(input: {
  combatId: string
  mapId: string
  state?: Dnd5eHeadlessCombatState
  sideByCombatantId?: Readonly<Record<string, CombatStatisticsSide>>
  characterIdByCombatantId?: Readonly<Record<string, string>>
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
      input.characterIdByCombatantId?.[combatant.id],
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
        combatants: Object.fromEntries(Object.entries(current.combatants).map(([id, value]) => [
          id,
          {
            ...value,
            turnsTaken: finiteNonNegative(value.turnsTaken) ? value.turnsTaken : 0,
            turnTrackedDamageDealt: finiteNonNegative(value.turnTrackedDamageDealt)
              ? value.turnTrackedDamageDealt
              : 0,
            turnTrackedHealingDone: finiteNonNegative(value.turnTrackedHealingDone)
              ? value.turnTrackedHealingDone
              : 0,
            combatD20FaceCounts: Array.isArray(value.combatD20FaceCounts)
              ? [...value.combatD20FaceCounts]
              : emptyD20FaceCounts(),
          },
        ])),
        receipts: [...current.receipts],
      }
    : createCombatStatisticsSession({
        combatId: resultState.combatId,
        mapId: observation.mapId,
        state: observation.source,
        sideByCombatantId: observation.sideByCombatantId,
        characterIdByCombatantId: observation.characterIdByCombatantId,
        now: observation.observedAt,
      })
  for (const combatant of Object.values(resultState.combatants)) {
    const stats = ensureCombatant(session, resultState, combatant.id)
    if (stats && observation.sideByCombatantId?.[combatant.id]) {
      stats.side = observation.sideByCombatantId[combatant.id]
    }
    if (stats && observation.characterIdByCombatantId?.[combatant.id]) {
      stats.characterId = observation.characterIdByCombatantId[combatant.id]
    }
  }
  if (session.receipts.includes(observation.receiptId) || !observation.result.ok) return session
  let fallbackActorId = actionActorId(observation.action)
  if (
    Object.values(session.combatants).every((entry) => entry.turnsTaken === 0) &&
    !observation.result.events.some((event) => event.type === 'turn-started')
  ) {
    const initialActor = ensureCombatant(session, resultState, fallbackActorId)
    if (initialActor) initialActor.turnsTaken = 1
  }
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

export function applyCombatExperienceSettlement(
  current: CombatStatisticsSession | undefined,
  settlement: CombatExperienceSettlement,
): CombatStatisticsSession | undefined {
  if (current?.experienceSettlement || (current && current.mapId !== settlement.mapId)) return undefined
  const base = current ?? createCombatStatisticsSession({
    combatId: settlement.combatId,
    mapId: settlement.mapId,
    now: settlement.settledAt,
  })
  if (base.combatId !== settlement.combatId) return undefined
  return {
    ...base,
    updatedAt: Math.max(base.updatedAt, settlement.settledAt),
    experienceSettlement: structuredClone(settlement),
  }
}

export function combatantDamagePerTurn(stats: CombatantStatistics): number {
  return stats.turnsTaken > 0 ? stats.turnTrackedDamageDealt / stats.turnsTaken : 0
}

export function combatantHealingPerTurn(stats: CombatantStatistics): number {
  return stats.turnsTaken > 0 ? stats.turnTrackedHealingDone / stats.turnsTaken : 0
}

type ContributionMetric = (stats: CombatantStatistics) => number

function contributionIndex(
  stats: CombatantStatistics,
  team: readonly CombatantStatistics[],
  metrics: readonly ContributionMetric[],
): number {
  const activeMetrics = metrics
    .map((metric) => ({ metric, total: team.reduce((sum, entry) => sum + metric(entry), 0) }))
    .filter(({ total }) => total > 0)
  if (activeMetrics.length === 0) return 0
  const share = activeMetrics.reduce((sum, { metric, total }) => sum + metric(stats) / total, 0)
  return Math.round((share / activeMetrics.length) * 1_000) / 10
}

/**
 * 同阵营内的相对进攻占比。四个可审计维度等权，队伍成员总和约为 100。
 */
export function combatantOffensiveContributionIndex(
  stats: CombatantStatistics,
  team: readonly CombatantStatistics[],
): number {
  return contributionIndex(stats, team, [
    (entry) => entry.damageDealt,
    (entry) => entry.hits,
    (entry) => entry.hostileConditionsApplied,
    (entry) => entry.knockouts + entry.kills,
  ])
}

/**
 * 同阵营内的相对防御/支援占比。治疗与临时生命、减伤、救援、成功豁免等权。
 */
export function combatantDefensiveContributionIndex(
  stats: CombatantStatistics,
  team: readonly CombatantStatistics[],
): number {
  return contributionIndex(stats, team, [
    (entry) => entry.healingDone + entry.temporaryHpGranted,
    (entry) => entry.damagePrevented,
    (entry) => entry.alliesRescued,
    (entry) => entry.successfulSaves,
  ])
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function normalizedExperienceSettlement(
  value: unknown,
  combatId: string,
  mapId: string,
): CombatExperienceSettlement | undefined | null {
  if (value == null) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (
    raw.combatId !== combatId || raw.mapId !== mapId ||
    !['even', 'manual', 'none'].includes(String(raw.mode)) ||
    !Number.isSafeInteger(raw.totalXp) || Number(raw.totalXp) < 0 ||
    !Number.isSafeInteger(raw.awardedXp) || Number(raw.awardedXp) < 0 ||
    Number(raw.awardedXp) > Number(raw.totalXp) ||
    !finiteNonNegative(raw.settledAt) ||
    !Array.isArray(raw.defeatedMonsters) || raw.defeatedMonsters.length > 512 ||
    !Array.isArray(raw.awards) || raw.awards.length > 128
  ) return null
  const defeatedMonsters = raw.defeatedMonsters.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const monster = value as Record<string, unknown>
    if (
      typeof monster.tokenId !== 'string' || !monster.tokenId || monster.tokenId.length > 200 ||
      typeof monster.name !== 'string' || !monster.name || monster.name.length > 240 ||
      (monster.monsterId != null && (typeof monster.monsterId !== 'string' || monster.monsterId.length > 200)) ||
      (monster.challengeRating != null && (typeof monster.challengeRating !== 'string' || monster.challengeRating.length > 16)) ||
      !Number.isSafeInteger(monster.xp) || Number(monster.xp) < 0
    ) return null
    return {
      tokenId: monster.tokenId,
      name: monster.name,
      ...(monster.monsterId ? { monsterId: monster.monsterId as string } : {}),
      ...(monster.challengeRating ? { challengeRating: monster.challengeRating as string } : {}),
      xp: Number(monster.xp),
    }
  })
  if (defeatedMonsters.some((monster) => monster == null)) return null
  const awards = raw.awards.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const award = value as Record<string, unknown>
    if (
      typeof award.characterId !== 'string' || !award.characterId || award.characterId.length > 200 ||
      typeof award.characterName !== 'string' || !award.characterName || award.characterName.length > 240 ||
      !Number.isSafeInteger(award.xp) || Number(award.xp) < 0
    ) return null
    return { characterId: award.characterId, characterName: award.characterName, xp: Number(award.xp) }
  })
  if (awards.some((award) => award == null)) return null
  if (new Set(awards.map((award) => award!.characterId)).size !== awards.length) return null
  const awardedXp = awards.reduce((total, award) => total + award!.xp, 0)
  if (awardedXp !== Number(raw.awardedXp)) return null
  if (raw.mode === 'none' ? awards.length > 0 || awardedXp !== 0 : awardedXp !== Number(raw.totalXp)) return null
  return {
    combatId,
    mapId,
    mode: raw.mode as CombatExperienceSettlement['mode'],
    totalXp: Number(raw.totalXp),
    awardedXp,
    defeatedMonsters: defeatedMonsters as CombatExperienceSettlement['defeatedMonsters'],
    awards: awards as CombatExperienceSettlement['awards'],
    settledAt: Number(raw.settledAt),
  }
}

const numericCombatantFields: Array<keyof CombatantStatistics> = [
  'turnsTaken', 'turnTrackedDamageDealt', 'turnTrackedHealingDone',
  'damageDealt', 'damageTaken', 'healingDone', 'healingReceived', 'temporaryHpGranted', 'damagePrevented',
  'hostileConditionsApplied', 'attacks', 'hits', 'criticalHits', 'knockouts', 'kills', 'alliesRescued',
  'successfulSaves', 'failedSaves', 'concentrationChecks', 'concentrationMaintained', 'actionsSpent',
  'bonusActionsSpent', 'reactionsSpent', 'movementSpentFeet', 'classResourcesSpent', 'spellSlotsSpent',
]

export function normalizeSharedCombatStatistics(value: unknown): SharedCombatStatisticsState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const schemaVersion = Number(raw.schemaVersion)
  if (![1, 2, COMBAT_STATISTICS_SCHEMA_VERSION].includes(schemaVersion) || !Array.isArray(raw.sessions) ||
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
      const legacyNumericFields = numericCombatantFields.filter((field) =>
        field !== 'turnsTaken' &&
        field !== 'turnTrackedDamageDealt' &&
        field !== 'turnTrackedHealingDone',
      )
      const combatD20FaceCounts = schemaVersion >= 3 ? stats.combatD20FaceCounts : emptyD20FaceCounts()
      if (stats.combatantId !== id ||
        (stats.characterId != null && (typeof stats.characterId !== 'string' || !stats.characterId || stats.characterId.length > 160)) ||
        typeof stats.name !== 'string' || stats.name.length > 240 ||
        !['player', 'enemy', 'npc'].includes(stats.side) ||
        legacyNumericFields.some((field) => !finiteNonNegative(stats[field])) ||
        (schemaVersion >= 3 && !finiteNonNegative(stats.turnsTaken)) ||
        !Array.isArray(combatD20FaceCounts) || combatD20FaceCounts.length !== D20_FACE_COUNT ||
        combatD20FaceCounts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
        return undefined
      }
      combatants[id] = {
        ...stats,
        turnsTaken: schemaVersion >= 3 ? stats.turnsTaken : 0,
        turnTrackedDamageDealt: schemaVersion >= 3 ? stats.turnTrackedDamageDealt : 0,
        turnTrackedHealingDone: schemaVersion >= 3 ? stats.turnTrackedHealingDone : 0,
        combatD20FaceCounts: [...combatD20FaceCounts],
      }
    }
    const experienceSettlement = normalizedExperienceSettlement(
      session.experienceSettlement,
      session.combatId,
      session.mapId,
    )
    if (experienceSettlement === null) return undefined
    sessions.push({
      combatId: session.combatId,
      mapId: session.mapId,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      lastRound: session.lastRound,
      combatants,
      receipts: [...session.receipts],
      ...(experienceSettlement ? { experienceSettlement } : {}),
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
