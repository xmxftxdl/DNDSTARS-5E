import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import {
  applyDnd5eCombatStatisticsObservation,
  applyCombatExperienceSettlement,
  archiveCombatStatisticsLog,
  COMBAT_STATISTICS_MAX_SESSIONS,
  COMBAT_STATISTICS_RESOURCE,
  COMBAT_STATISTICS_SCHEMA_VERSION,
  createCombatStatisticsSession,
  deleteCombatStatisticsLog,
  dnd5eCombatStatisticsReceipt,
  normalizeSharedCombatStatistics,
  type CombatStatisticsSession,
  type CombatLogArchiveInput,
  type CombatStatisticsSide,
  type Dnd5eCombatStatisticsObservation,
  type SharedCombatStatisticsState,
} from '../lib/combatStatistics'
import { loadSharedResource, saveSharedResourceWithResult } from '../composition/browserSharedRoomResources'
import { createSharedWriteWatermark } from '../lib/sharedWriteWatermark'
import type { Dnd5eHeadlessResolutionObservation } from '../application/combat/dnd5eCombatRules'
import type { CombatExperienceSettlement } from '../lib/combatExperience'

interface CombatStatisticsStoreState {
  sessions: CombatStatisticsSession[]
  hydrated: boolean
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
  archiveCombatLog: (input: CombatLogArchiveInput) => Promise<boolean>
  deleteCombatLog: (combatId: string) => Promise<boolean>
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

async function publish(sessions: CombatStatisticsSession[]): Promise<boolean> {
  if (!canWriteSharedState()) return false
  const ticket = sharedWriteWatermark.begin()
  const updatedAt = ticket.updatedAt
  const payload: SharedCombatStatisticsState = {
    schemaVersion: COMBAT_STATISTICS_SCHEMA_VERSION,
    sessions: sessions.slice(-COMBAT_STATISTICS_MAX_SESSIONS),
    updatedAt,
  }
  const result = await saveSharedResourceWithResult(COMBAT_STATISTICS_RESOURCE, payload)
  sharedWriteWatermark.settle(ticket, result.status === 'saved')
  return result.status === 'saved'
}

export const useCombatStatisticsStore = create<CombatStatisticsStoreState>()(
  persist((set, get) => ({
    sessions: [],
    hydrated: false,
    loadShared: async () => {
      const shared = normalizeSharedCombatStatistics(await loadSharedResource(COMBAT_STATISTICS_RESOURCE))
      if (shared && sharedWriteWatermark.shouldApplyRemote(shared.updatedAt)) {
        sharedWriteWatermark.acceptRemote(shared.updatedAt)
        set({ sessions: shared.sessions, hydrated: true })
        return
      }
      set({ hydrated: true })
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
      queueMicrotask(() => { void publish(get().sessions) })
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
      queueMicrotask(() => { void publish(get().sessions) })
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
      if (accepted) queueMicrotask(() => { void publish(get().sessions) })
      return accepted
    },
    archiveCombatLog: async (input) => {
      let archived = false
      set((state) => {
        const current = state.sessions.find((session) => session.combatId === input.combatId)
        const next = archiveCombatStatisticsLog(current, input)
        if (current === next ||
          (current?.logEntries && current.endedAt != null &&
            current.logEntries.length === next.logEntries?.length &&
            current.updatedAt >= next.updatedAt)) return state
        archived = true
        return {
          sessions: [
            ...state.sessions.filter((session) => session.combatId !== input.combatId),
            next,
          ].slice(-COMBAT_STATISTICS_MAX_SESSIONS),
        }
      })
      return archived ? publish(get().sessions) : true
    },
    deleteCombatLog: async (combatId) => {
      const previous = get().sessions.find((session) => session.combatId === combatId)
      if (!previous?.logEntries?.length) return true
      const next = deleteCombatStatisticsLog(previous, Date.now())
      set((state) => ({
        sessions: [
          ...state.sessions.filter((session) => session.combatId !== combatId),
          next,
        ].slice(-COMBAT_STATISTICS_MAX_SESSIONS),
      }))
      let saved = false
      try {
        saved = await publish(get().sessions)
      } catch (error) {
        console.error('[combat-statistics] failed to delete archived combat log', error)
      }
      if (!saved) {
        set((state) => {
          const current = state.sessions.find((session) => session.combatId === combatId)
          if (current?.logDeletedAt !== next.logDeletedAt) return state
          return {
            sessions: [
              ...state.sessions.filter((session) => session.combatId !== combatId),
              previous,
            ].slice(-COMBAT_STATISTICS_MAX_SESSIONS),
          }
        })
      }
      return saved
    },
    clearCombat: (combatId) => {
      set((state) => ({ sessions: state.sessions.filter((session) => session.combatId !== combatId) }))
      queueMicrotask(() => { void publish(get().sessions) })
    },
  }), {
    name: 'dndstars-combat-statistics',
    version: COMBAT_STATISTICS_SCHEMA_VERSION,
    migrate: (persistedState) => migratePersistedStatisticsState(persistedState),
    partialize: (state) => ({ sessions: state.sessions }),
  }),
)
