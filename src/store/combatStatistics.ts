import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import {
  applyDnd5eCombatStatisticsObservation,
  applyCombatExperienceSettlement,
  COMBAT_STATISTICS_MAX_SESSIONS,
  COMBAT_STATISTICS_RESOURCE,
  COMBAT_STATISTICS_SCHEMA_VERSION,
  createCombatStatisticsSession,
  dnd5eCombatStatisticsReceipt,
  normalizeSharedCombatStatistics,
  type CombatStatisticsSession,
  type CombatStatisticsSide,
  type Dnd5eCombatStatisticsObservation,
  type SharedCombatStatisticsState,
} from '../lib/combatStatistics'
import { loadSharedResource, saveSharedResourceWithResult } from '../lib/sharedApi'
import { createSharedWriteWatermark } from '../lib/sharedWriteWatermark'
import type { Dnd5eHeadlessResolutionObservation } from '../rulesets/dnd5e/headlessCombatEngine'
import type { CombatExperienceSettlement } from '../lib/combatExperience'

interface CombatStatisticsStoreState {
  sessions: CombatStatisticsSession[]
  loadShared: () => Promise<void>
  startCombat: (combatId: string, mapId: string) => void
  record: (
    mapId: string,
    observation: Dnd5eHeadlessResolutionObservation,
    sideByCombatantId?: Readonly<Record<string, CombatStatisticsSide>>,
    characterIdByCombatantId?: Readonly<Record<string, string>>,
  ) => void
  /** 同一 combatId 仅接受一次；返回 false 表示已经结算。 */
  settleExperience: (settlement: CombatExperienceSettlement) => boolean
  clearCombat: (combatId: string) => void
}

const sharedWriteWatermark = createSharedWriteWatermark()

function migratePersistedStatisticsState(persistedState: unknown): Pick<CombatStatisticsStoreState, 'sessions'> {
  const raw = persistedState && typeof persistedState === 'object'
    ? persistedState as { sessions?: unknown }
    : {}
  const sessions = Array.isArray(raw.sessions) ? raw.sessions : []
  const isV3 = sessions.every((session) => {
    if (!session || typeof session !== 'object') return false
    const combatants = (session as { combatants?: unknown }).combatants
    if (!combatants || typeof combatants !== 'object' || Array.isArray(combatants)) return false
    return Object.values(combatants).every((entry) => {
      if (!entry || typeof entry !== 'object') return false
      const stats = entry as Record<string, unknown>
      return Number.isFinite(stats.turnsTaken) &&
        Number.isFinite(stats.turnTrackedDamageDealt) &&
        Number.isFinite(stats.turnTrackedHealingDone) &&
        Array.isArray(stats.combatD20FaceCounts)
    })
  })
  const updatedAt = sessions.reduce((latest, session) => {
    const value = session && typeof session === 'object'
      ? Number((session as { updatedAt?: unknown }).updatedAt)
      : 0
    return Number.isFinite(value) ? Math.max(latest, value) : latest
  }, 0)
  const normalized = normalizeSharedCombatStatistics({
    schemaVersion: isV3 ? COMBAT_STATISTICS_SCHEMA_VERSION : 2,
    sessions,
    updatedAt,
  })
  return { sessions: normalized?.sessions ?? [] }
}

function publish(sessions: CombatStatisticsSession[]) {
  if (!canWriteSharedState()) return
  const ticket = sharedWriteWatermark.begin()
  const updatedAt = ticket.updatedAt
  const payload: SharedCombatStatisticsState = {
    schemaVersion: COMBAT_STATISTICS_SCHEMA_VERSION,
    sessions: sessions.slice(-COMBAT_STATISTICS_MAX_SESSIONS),
    updatedAt,
  }
  void saveSharedResourceWithResult(COMBAT_STATISTICS_RESOURCE, payload).then((result) => {
    sharedWriteWatermark.settle(ticket, result.status === 'saved')
  })
}

export const useCombatStatisticsStore = create<CombatStatisticsStoreState>()(
  persist((set, get) => ({
    sessions: [],
    loadShared: async () => {
      const shared = normalizeSharedCombatStatistics(await loadSharedResource(COMBAT_STATISTICS_RESOURCE))
      if (!shared || !sharedWriteWatermark.shouldApplyRemote(shared.updatedAt)) return
      sharedWriteWatermark.acceptRemote(shared.updatedAt)
      set({ sessions: shared.sessions })
    },
    startCombat: (combatId, mapId) => {
      if (!combatId || !mapId) return
      const now = Date.now()
      set((state) => ({
        sessions: [
          ...state.sessions.filter((session) => session.combatId !== combatId),
          createCombatStatisticsSession({ combatId, mapId, now }),
        ].slice(-COMBAT_STATISTICS_MAX_SESSIONS),
      }))
      queueMicrotask(() => publish(get().sessions))
    },
    record: (mapId, observation, sideByCombatantId, characterIdByCombatantId) => {
      if (!observation.result.ok || observation.result.events.length === 0) return
      const combatId = observation.result.state.combatId
      const current = get().sessions.find((session) => session.combatId === combatId)
      const input: Dnd5eCombatStatisticsObservation = {
        mapId,
        ...observation,
        receiptId: dnd5eCombatStatisticsReceipt(observation),
        observedAt: Date.now(),
        sideByCombatantId,
        characterIdByCombatantId,
      }
      const next = applyDnd5eCombatStatisticsObservation(current, input)
      if (next === current || current?.receipts.includes(input.receiptId)) return
      set((state) => ({
        sessions: [...state.sessions.filter((session) => session.combatId !== combatId), next]
          .slice(-COMBAT_STATISTICS_MAX_SESSIONS),
      }))
      queueMicrotask(() => publish(get().sessions))
    },
    settleExperience: (settlement) => {
      let accepted = false
      set((state) => {
        const current = state.sessions.find((session) => session.combatId === settlement.combatId)
        const next = applyCombatExperienceSettlement(current, settlement)
        if (!next) return state
        accepted = true
        return {
          sessions: [
            ...state.sessions.filter((session) => session.combatId !== settlement.combatId),
            next,
          ].slice(-COMBAT_STATISTICS_MAX_SESSIONS),
        }
      })
      if (accepted) queueMicrotask(() => publish(get().sessions))
      return accepted
    },
    clearCombat: (combatId) => {
      set((state) => ({ sessions: state.sessions.filter((session) => session.combatId !== combatId) }))
      queueMicrotask(() => publish(get().sessions))
    },
  }), {
    name: 'dndstars-combat-statistics',
    version: COMBAT_STATISTICS_SCHEMA_VERSION,
    migrate: (persistedState) => migratePersistedStatisticsState(persistedState),
    partialize: (state) => ({ sessions: state.sessions }),
  }),
)
