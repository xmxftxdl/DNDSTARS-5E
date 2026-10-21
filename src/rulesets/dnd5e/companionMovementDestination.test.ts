import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5eCompanionDestinationFitsMap, dnd5eOwnedCompanionMovementDestination, isDnd5eCompanionMovementSelections } from './companionMovementDestination'

it('rejects malformed movement selections and bounds both recipient and operation collections', () => {
  const destination = { mapId: 'scene', x: 125, y: 125 }
  expect(isDnd5eCompanionMovementSelections({ order: { first: destination, second: null } })).toBe(true)
  for (const value of [[], null, { order: [] }, { order: null }, { order: { first: [] } },
    { order: { first: { ...destination, x: Infinity } } }, { order: { first: { ...destination, y: -1 } } },
    { order: { first: { ...destination, mapId: ' ' } } }, { '': {} },
    Object.fromEntries(Array.from({ length: 65 }, (_, i) => ['order' + i, {}])),
    { order: Object.fromEntries(Array.from({ length: 1001 }, (_, i) => ['recipient' + i, null])) }]) {
    expect(isDnd5eCompanionMovementSelections(value)).toBe(false)
  }
})

it('checks the whole creature footprint against usable cells including map grid offsets', () => {
  const token = { id: 'first', size: 2, creatureSize: '大型', x: 60, y: 60 } as Token
  const map = { id: 'scene', width: 260, height: 260, gridSize: 50, gridOffsetX: 10, gridOffsetY: 10, tokens: [token] } as BattleMap
  expect(dnd5eCompanionDestinationFitsMap(map, token.id, { mapId: map.id, x: 60, y: 60 })).toBe(true)
  expect(dnd5eCompanionDestinationFitsMap(map, token.id, { mapId: map.id, x: 260, y: 60 })).toBe(false)
  expect(dnd5eCompanionDestinationFitsMap(map, token.id, { mapId: map.id, x: 235, y: 60 })).toBe(false)
  expect(dnd5eCompanionDestinationFitsMap(map, 'missing', { mapId: map.id, x: 60, y: 60 })).toBe(false)
})

it('ignores movement orders from a different owner or source and after control ends', () => {
  const token = { dnd5eSummon: { sourceTokenId: 'owner', featureId: 'summon', commandPolicy: 'persistent-order' },
    dnd5eCombatState: { companionCommand: { sourceOwnerId: 'owner', sourceFeatureId: 'summon',
      movementDestination: { mapId: 'scene', x: 125, y: 125 } } } } as Token
  expect(dnd5eOwnedCompanionMovementDestination(token)).toEqual({ mapId: 'scene', x: 125, y: 125 })
  token.dnd5eCombatState!.companionCommand!.sourceOwnerId = 'other'
  expect(dnd5eOwnedCompanionMovementDestination(token)).toBeUndefined()
  token.dnd5eCombatState!.companionCommand!.sourceOwnerId = 'owner'
  token.dnd5eCombatState!.companionCommand!.sourceFeatureId = 'other'
  expect(dnd5eOwnedCompanionMovementDestination(token)).toBeUndefined()
  token.dnd5eCombatState!.companionCommand!.sourceFeatureId = 'summon'
  token.dnd5eSummon!.controlEnded = true
  expect(dnd5eOwnedCompanionMovementDestination(token)).toBeUndefined()
})
