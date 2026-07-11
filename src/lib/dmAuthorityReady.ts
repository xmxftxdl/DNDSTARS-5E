export const DM_AUTHORITY_READY_RESOURCE = 'dm-authority-ready'

export interface DmAuthorityReadyState {
  mapId: string
  combatId: string
  ready: boolean
  updatedAt: number
}

export function matchesDmAuthorityReady(
  state: DmAuthorityReadyState | null | undefined,
  expected: { mapId?: string; combatId?: string; combatActive: boolean },
): boolean {
  if (!expected.combatActive || !expected.mapId || !expected.combatId) return false
  return !!state?.ready && state.mapId === expected.mapId && state.combatId === expected.combatId
}
