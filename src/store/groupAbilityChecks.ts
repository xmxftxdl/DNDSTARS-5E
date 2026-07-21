import { create } from 'zustand'
import {
  GROUP_ABILITY_CHECK_RESOURCE,
  normalizeSharedGroupAbilityChecks,
  type GroupAbilityCheckMutation,
  type SharedGroupAbilityChecksState,
} from '../lib/groupAbilityChecks'
import { loadSharedResource, mutateSharedRoomResource } from '../lib/sharedApi'

interface GroupAbilityChecksStore {
  state: SharedGroupAbilityChecksState
  loadShared: () => Promise<void>
  mutate: (mutation: GroupAbilityCheckMutation) => Promise<void>
  reset: () => void
}

const emptyState = normalizeSharedGroupAbilityChecks(null)

export const useGroupAbilityChecksStore = create<GroupAbilityChecksStore>((set) => ({
  state: emptyState,
  loadShared: async () => {
    const state = normalizeSharedGroupAbilityChecks(await loadSharedResource(GROUP_ABILITY_CHECK_RESOURCE))
    set({ state })
  },
  mutate: async (mutation) => {
    const result = await mutateSharedRoomResource<SharedGroupAbilityChecksState>(
      GROUP_ABILITY_CHECK_RESOURCE,
      '/state/group-ability-checks/mutation',
      mutation,
    )
    set({ state: normalizeSharedGroupAbilityChecks(result) })
  },
  reset: () => set({ state: emptyState }),
}))
