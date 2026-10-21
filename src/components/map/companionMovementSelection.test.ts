import { expect, it, vi } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { requestCompanionMovementSelections } from './companionMovementSelection'

const map: BattleMap = { id: 'map', name: 'Map', width: 600, height: 400, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
  tokens: ['a', 'b'].map((id, i) => ({ id, label: id, x: 25 + i * 50, y: 25, size: 1, type: 'enemy', emoji: '', color: '' } as Token)) }
const base = { map, operationIds: ['order'], recipientIds: ['a', 'b'], isCurrent: () => true }

it('collects separate map destinations and explicit holding positions for the selected group', async () => {
  const chooseDestination = vi.fn(async () => ({ x: 225, y: 125 }))
  const result = await requestCompanionMovementSelections({ ...base, choose: async ({ title }) => title.startsWith('a') ? 'move' : 'hold', chooseDestination })
  expect(result).toEqual({ order: { a: { mapId: 'map', x: 225, y: 125 }, b: { mapId: 'map', x: 75, y: 25 } } })
  expect(chooseDestination).toHaveBeenCalledTimes(1)
})

it.each(['cancel-dialog', 'cancel-map', 'map-changed', 'invalid-destination'] as const)('abandons the whole group after %s', async failure => {
  let current = true, prompted = 0
  const result = await requestCompanionMovementSelections({ ...base, isCurrent: () => current,
    choose: async () => { prompted++; return failure === 'cancel-dialog' ? null : 'move' },
    chooseDestination: async () => {
      if (failure === 'map-changed') current = false
      return failure === 'cancel-map' ? undefined : { x: failure === 'invalid-destination' ? 1000 : 125, y: 125 }
    } })
  expect(result).toBeNull()
  expect(prompted).toBe(1)
})

it('rejects a missing recipient before any prompt', async () => {
  const choose = vi.fn(async () => 'hold')
  expect(await requestCompanionMovementSelections({ ...base, recipientIds: ['missing'], choose, chooseDestination: async () => undefined })).toBeNull()
  expect(choose).not.toHaveBeenCalled()
})
