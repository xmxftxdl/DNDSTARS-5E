export const DM_AUTHORITY_READY_RESOURCE = 'dm-authority-ready'

export interface DmAuthorityReadyState {
  mapId: string
  combatId: string
  ready: boolean
  updatedAt: number
}

export interface DmAuthorityReadyPersistence {
  load(): Promise<DmAuthorityReadyState | null>
  save(state: DmAuthorityReadyState): Promise<void>
}

function sameDmAuthorityReadyState(
  left: DmAuthorityReadyState | null | undefined,
  right: DmAuthorityReadyState,
): boolean {
  return left?.mapId === right.mapId &&
    left.combatId === right.combatId &&
    left.ready === right.ready
}

/**
 * Publishes the small authority latch with one authoritative rebase retry.
 * A concurrent heartbeat or a second DM tab may advance its CAS revision
 * between load and save; if another writer already published the same latch,
 * that is success rather than an error.
 */
export async function persistDmAuthorityReady(
  state: DmAuthorityReadyState,
  persistence: DmAuthorityReadyPersistence,
): Promise<DmAuthorityReadyState> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await persistence.save(state)
      return state
    } catch (error) {
      lastError = error
      const current = await persistence.load().catch(() => null)
      if (sameDmAuthorityReadyState(current, state)) return current!
    }
  }
  throw lastError instanceof Error ? lastError : new Error('dm-authority-ready-publish-failed')
}

export function matchesDmAuthorityReady(
  state: DmAuthorityReadyState | null | undefined,
  expected: { mapId?: string; combatId?: string; combatActive: boolean },
): boolean {
  if (!expected.combatActive || !expected.mapId || !expected.combatId) return false
  return !!state?.ready && state.mapId === expected.mapId && state.combatId === expected.combatId
}
