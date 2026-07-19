import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { canWriteSharedState } from '../lib/appMode'
import {
  applyDnd5eCombatStatisticsObservation,
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
import { loadSharedResource, saveSharedResource } from '../lib/sharedApi'
import type { Dnd5eHeadlessResolutionObservation } from '../rulesets/dnd5e/headlessCombatEngine'

interface CombatStatisticsStoreState {
  sessions: CombatStatisticsSession[]
  loadShared: () => Promise<void>
  startCombat: (combatId: string, mapId: string) => void
  record: (
    mapId: string,
    observation: Dnd5eHeadlessResolutionObservation,
    sideByCombatantId?: Readonly<Record<string, CombatStatisticsSide>>,
  ) => void
  clearCombat: (combatId: string) => void
}

let lastSharedUpdatedAt = 0

function publish(sessions: CombatStatisticsSession[]) {
  if (!canWriteSharedState()) return
  const updatedAt = Math.max(Date.now(), lastSharedUpdatedAt + 1)
  const payload: SharedCombatStatisticsState = {
    schemaVersion: COMBAT_STATISTICS_SCHEMA_VERSION,
    sessions: sessions.slice(-COMBAT_STATISTICS_MAX_SESSIONS),
    updatedAt,
  }
  lastSharedUpdatedAt = updatedAt
  void saveSharedResource(COMBAT_STATISTICS_RESOURCE, payload)
}

export const useCombatStatisticsStore = create<CombatStatisticsStoreState>()(
  persist((set, get) => ({
    sessions: [],
    loadShared: async () => {
      const shared = normalizeSharedCombatStatistics(await loadSharedResource(COMBAT_STATISTICS_RESOURCE))
      if (!shared || shared.updatedAt < lastSharedUpdatedAt) return
      lastSharedUpdatedAt = shared.updatedAt
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
    record: (mapId, observation, sideByCombatantId) => {
      if (!observation.result.ok || observation.result.events.length === 0) return
      const combatId = observation.result.state.combatId
      const current = get().sessions.find((session) => session.combatId === combatId)
      const input: Dnd5eCombatStatisticsObservation = {
        mapId,
        ...observation,
        receiptId: dnd5eCombatStatisticsReceipt(observation),
        observedAt: Date.now(),
        sideByCombatantId,
      }
      const next = applyDnd5eCombatStatisticsObservation(current, input)
      if (next === current || current?.receipts.includes(input.receiptId)) return
      set((state) => ({
        sessions: [...state.sessions.filter((session) => session.combatId !== combatId), next]
          .slice(-COMBAT_STATISTICS_MAX_SESSIONS),
      }))
      queueMicrotask(() => publish(get().sessions))
    },
    clearCombat: (combatId) => {
      set((state) => ({ sessions: state.sessions.filter((session) => session.combatId !== combatId) }))
      queueMicrotask(() => publish(get().sessions))
    },
  }), {
    name: 'dndstars-combat-statistics',
    partialize: (state) => ({ sessions: state.sessions }),
  }),
)
