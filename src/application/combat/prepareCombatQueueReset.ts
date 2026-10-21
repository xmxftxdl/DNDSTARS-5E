interface ResourceSnapshot {
  value: unknown
  revision: number
}

/** Refresh append-only queues after draining actions; retain CAS for later arrivals. */
export async function prepareCombatQueueReset(input: {
  mapId: string
  expectedActiveCombatId?: string
  writes: readonly { name: string; data: unknown }[]
  read: (name: string) => Promise<ResourceSnapshot>
}): Promise<{
  writes: { name: string; data: unknown; expectedRevision: number }[]
  readRevisions?: Record<string, number>
}> {
  const read = async (name: string) => {
    const snapshot = await input.read(name)
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) {
      throw new Error(`combat-queue-reset-invalid-revision:${name}`)
    }
    return snapshot
  }
  let readRevisions: Record<string, number> | undefined
  if (input.expectedActiveCombatId) {
    const snapshot = await read('combat')
    const combat = snapshot.value as { mapId?: string; combatId?: string; active?: boolean } | null
    if (!combat || combat.active !== true || combat.mapId !== input.mapId ||
        combat.combatId !== input.expectedActiveCombatId) throw new Error('combat-queue-reset-combat-changed')
    readRevisions = { combat: snapshot.revision }
  }
  const writes = await Promise.all(input.writes.map(async write => {
    const snapshot = await read(write.name)
    if (input.expectedActiveCombatId && snapshot.value && typeof snapshot.value === 'object') {
      const scope = snapshot.value as { mapId?: string; combatId?: string }
      if ((scope.mapId && scope.mapId !== input.mapId) ||
          (scope.combatId && scope.combatId !== input.expectedActiveCombatId)) {
        throw new Error(`combat-queue-reset-scope-changed:${write.name}`)
      }
    }
    return { ...write, expectedRevision: snapshot.revision }
  }))
  return { writes, readRevisions }
}
