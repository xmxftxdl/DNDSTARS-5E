import { describe, expect, it } from 'vitest'
import {
  STATE_OWNERSHIP_CONTRACTS,
  validateStateOwnershipContracts,
  type StateOwnershipContract,
} from './stateOwnership'

describe('state ownership contracts', () => {
  it('keeps the checked-in ownership matrix internally consistent', () => {
    expect(validateStateOwnershipContracts()).toEqual([])
    expect(STATE_OWNERSHIP_CONTRACTS.find((entry) => entry.id === 'characters')).toMatchObject({
      authority: 'server-persistent',
      clientRole: 'projection',
      mutationPath: 'room-command',
    })
    expect(STATE_OWNERSHIP_CONTRACTS.find((entry) => entry.id === 'combat-presentation')).toMatchObject({
      authority: 'server-ephemeral',
      clientRole: 'transport-cache',
    })
  })

  it('rejects duplicate authorities and dangling projections', () => {
    const invalid: StateOwnershipContract[] = [
      {
        id: 'characters', authority: 'server-persistent', clientRole: 'projection',
        mutationPath: 'room-command', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
      },
      {
        id: 'characters', authority: 'server-persistent', clientRole: 'projection',
        mutationPath: 'room-command', transport: 'rest-cas+sse', recovery: 'campaign-snapshot',
        projectionOf: 'missing',
      },
    ]
    expect(validateStateOwnershipContracts(invalid)).toEqual([
      'duplicate state ownership id: characters',
      'characters: missing authority aggregate missing',
    ])
  })
})
