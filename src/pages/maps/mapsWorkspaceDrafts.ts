import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
export interface CombatInitiativeConfirmationDraft {
  combatId: string
  mapId: string
  surprisedTokenIds: string[]
  clearStatuses: boolean
  order: InitiativeEntry[]
}

export interface LiveCombatInitiativeConfirmationDraft {
  combatId: string
  mapId: string
  tokenIds: string[]
  order: InitiativeEntry[]
}

