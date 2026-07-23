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
  ) => void
  /** 同一 combatId 仅接受一次；返回 false 表示已经结算。 */
  settleExperience: (settlement: CombatExperienceSettlement) => boolean
  clearCombat: (combatId: string) => void
}

const sharedWriteWatermark = createSharedWriteWatermark()

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
    partialize: (state) => ({ sessions: state.sessions }),
  }),
)
