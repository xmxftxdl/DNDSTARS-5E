import { describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { SharedPlayerActionAckState } from './sharedCombatTypes'
import { publishPlayerActionAckWithSnapshots } from './playerActionAckPublish'

function makeAck(status: SharedPlayerActionAckState['status']): SharedPlayerActionAckState {
  return {
    id: `ack-${status}`,
    mapId: 'map-1',
    actionId: 'action-1',
    status,
    round: 1,
    initiativeIndex: 0,
    updatedAt: 100,
  }
}

describe('publishPlayerActionAckWithSnapshots', () => {
  it('saves accepted authoritative snapshots before publishing the ack', async () => {
    const calls: string[] = []
    const character = { id: 'char-1' } as Character
    const map = { id: 'map-1' } as BattleMap
    const saveSharedResource = vi.fn(async (name: string) => {
      calls.push(`save:${name}`)
    })
    const publishAck = vi.fn(async () => {
      calls.push('publish:ack')
    })

    await publishPlayerActionAckWithSnapshots({
      ack: makeAck('accepted'),
      snapshots: {
        characters: [character],
        characterSelectedId: character.id,
        maps: [map],
        mapSelectedId: map.id,
        updatedAt: 123,
        combat: {
          mapId: 'map-1',
          active: true,
          round: 1,
          initiativeIndex: 0,
          initiativeOrder: [],
          updatedAt: 123,
        },
      },
      saveSharedResource,
      publishAck,
    })

    expect(saveSharedResource).toHaveBeenCalledWith('characters', {
      characters: [character],
      selectedId: 'char-1',
      updatedAt: 123,
    })
    expect(saveSharedResource).toHaveBeenCalledWith('maps', {
      maps: [map],
      selectedId: 'map-1',
      updatedAt: 123,
    })
    expect(saveSharedResource).toHaveBeenCalledWith('combat', {
      mapId: 'map-1',
      active: true,
      round: 1,
      initiativeIndex: 0,
      initiativeOrder: [],
      updatedAt: 123,
    })
    expect(saveSharedResource).toHaveBeenCalledWith('player-action-ack', makeAck('accepted'))
    expect(publishAck).toHaveBeenCalledWith(makeAck('accepted'))
    expect(calls.slice(-2)).toEqual(['save:player-action-ack', 'publish:ack'])
  })

  it('publishes rejected acknowledgements without saving snapshots', async () => {
    const saveSharedResource = vi.fn(async () => undefined)
    const publishAck = vi.fn(async () => undefined)
    const ack = makeAck('rejected')

    await publishPlayerActionAckWithSnapshots({
      ack,
      snapshots: {
        characters: [{ id: 'char-1' } as Character],
        maps: [{ id: 'map-1' } as BattleMap],
        updatedAt: 123,
      },
      saveSharedResource,
      publishAck,
    })

    expect(saveSharedResource).toHaveBeenCalledTimes(1)
    expect(saveSharedResource).toHaveBeenCalledWith('player-action-ack', ack)
    expect(publishAck).toHaveBeenCalledWith(ack)
  })
})
