export type StateAuthority =
  | 'server-persistent'
  | 'server-ephemeral'
  | 'client-local'

export type ClientStateRole =
  | 'projection'
  | 'transport-cache'
  | 'local-preference'

export type StateMutationPath =
  | 'account-command'
  | 'room-command'
  | 'dm-authority-transaction'
  | 'server-event'
  | 'local-setting'

export interface StateOwnershipContract {
  id: string
  authority: StateAuthority
  clientRole: ClientStateRole
  mutationPath: StateMutationPath
  transport: 'rest-cas+sse' | 'sse' | 'browser-storage'
  recovery: 'postgres+backup' | 'campaign-snapshot' | 'reconnect-replay' | 'browser-storage'
  /**
   * Names the authoritative aggregate when this entry is only a projection.
   * This makes duplicated domain state explicit instead of silently creating a
   * second writable truth in a Zustand store or an SSE backlog.
   */
  projectionOf?: string
}

/**
 * Runtime-readable ownership table used by architecture checks and diagnostics.
 * Zustand stores are projections, SSE is transport, and snapshots are recovery
 * points; none of them become an additional authority merely by holding a copy.
 */
export const STATE_OWNERSHIP_CONTRACTS = Object.freeze([
  {
    id: 'account', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'account-command', transport: 'rest-cas+sse', recovery: 'postgres+backup',
  },
  {
    id: 'campaign-index', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'account-command', transport: 'rest-cas+sse', recovery: 'postgres+backup',
  },
  {
    id: 'room-roster', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'room-command', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
  },
  {
    id: 'room-presence', authority: 'server-ephemeral', clientRole: 'transport-cache',
    mutationPath: 'server-event', transport: 'sse', recovery: 'reconnect-replay',
  },
  {
    id: 'effective-rules', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'dm-authority-transaction', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
  },
  {
    id: 'characters', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'room-command', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
  },
  {
    id: 'character-inventory', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'room-command', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
    projectionOf: 'characters',
  },
  {
    id: 'character-spell-selections', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'room-command', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
    projectionOf: 'characters',
  },
  {
    id: 'maps', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'room-command', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
  },
  {
    id: 'map-geometry', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'dm-authority-transaction', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
  },
  {
    id: 'map-fog', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'dm-authority-transaction', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
  },
  {
    id: 'combat-log', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'dm-authority-transaction', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
  },
  {
    id: 'combat-presentation', authority: 'server-ephemeral', clientRole: 'transport-cache',
    mutationPath: 'server-event', transport: 'sse', recovery: 'reconnect-replay',
  },
  {
    id: 'ai-jobs', authority: 'server-persistent', clientRole: 'projection',
    mutationPath: 'account-command', transport: 'rest-cas+sse', recovery: 'postgres+backup',
  },
  {
    id: 'ui-preferences', authority: 'client-local', clientRole: 'local-preference',
    mutationPath: 'local-setting', transport: 'browser-storage', recovery: 'browser-storage',
  },
] as const satisfies readonly StateOwnershipContract[])

export function validateStateOwnershipContracts(
  contracts: readonly StateOwnershipContract[] = STATE_OWNERSHIP_CONTRACTS,
): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const contract of contracts) {
    if (!contract.id.trim()) errors.push('state ownership id must not be empty')
    if (ids.has(contract.id)) errors.push(`duplicate state ownership id: ${contract.id}`)
    ids.add(contract.id)
    if (contract.authority === 'client-local' && contract.clientRole !== 'local-preference') {
      errors.push(`${contract.id}: client-local state must be a local preference`)
    }
    if (contract.authority !== 'client-local' && contract.clientRole === 'local-preference') {
      errors.push(`${contract.id}: server state cannot be a local preference`)
    }
    if (contract.projectionOf === contract.id) errors.push(`${contract.id}: projection cannot reference itself`)
  }
  for (const contract of contracts) {
    if (contract.projectionOf && !ids.has(contract.projectionOf)) {
      errors.push(`${contract.id}: missing authority aggregate ${contract.projectionOf}`)
    }
  }
  return errors
}
