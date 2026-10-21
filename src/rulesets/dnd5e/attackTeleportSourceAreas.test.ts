import { expect, it } from 'vitest'
import { prepareAttackTeleportSourceAreas } from './attackTeleportSourceAreas'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import type { BattleMap } from '../../store/maps'

function fixture() {
  const map: BattleMap = { id: 'aura', name: '', width: 500, height: 500,
    gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [25, 75, 175].map((x, index) => ({
      id: ['source', 'old', 'new'][index], type: 'enemy', poolId: 'srd-5.1:goblin',
      label: 'Creature', x, y: 25, size: 1, hp: 10, maxHp: 10, color: '', emoji: '',
    })),
    dnd5ePluginAreas: [{
      id: 'aura', pluginId: 'audit', featureId: 'audit:aura', sourceTokenId: 'source',
      sourceCharacterId: '', label: 'Aura', color: '#ffffff', createdRound: 1, expiresAfterRound: 100,
      relation: 'any', cells: [{ col: 1, row: 0 }], anchorMode: 'source-token',
      anchorTokenId: 'source', anchorCell: { col: 0, row: 0 },
      triggers: [{ id: 'enter', label: 'Enter', timing: 'on-enter', damage: { count: 1, sides: 4, type: 'fire' } }],
    }],
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    map, characters: [], combatId: 'combat', round: 1,
    initiativeOrder: map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - index })),
  })
  return { map, snapshot }
}

it('moves the aura to the destination and targets newly exposed creatures without mutating the origin', () => {
  const { map, snapshot } = fixture()
  snapshot.state.combatants.source.position.x = 125
  const before = structuredClone({ map, state: snapshot.state })
  const result = prepareAttackTeleportSourceAreas({
    state: snapshot.state, beforeMap: map, characters: [], characterIdByCombatantId: {},
    actorId: 'source', round: 1, turnKey: '1:source',
  })
  expect(result.map.dnd5ePluginAreas?.[0].cells).toEqual([{ col: 3, row: 0 }])
  expect(result.candidates.map(candidate => candidate.targetToken.id)).toEqual(['new'])
  expect({ map, state: snapshot.state }).toEqual(before)
})

it('ends source concentration in both Host state and the map when teleport leaves a source-bound ward', () => {
  const { map, snapshot } = fixture()
  map.dnd5ePluginAreas = [{
    ...map.dnd5ePluginAreas![0], anchorMode: 'fixed', cells: [{ col: 0, row: 0 }],
    concentrationId: 'audit-ward', sourceExitBehavior: 'remove-area',
  }]
  snapshot.state.combatants.source.classState.concentrationSpellId = 'audit-ward'
  snapshot.state.combatants.source.classState.concentrationRoundsRemaining = 10
  snapshot.state.combatants.source.position.x = 125
  const before = structuredClone({ map, state: snapshot.state })
  const result = prepareAttackTeleportSourceAreas({
    state: snapshot.state, beforeMap: map, characters: [], characterIdByCombatantId: {},
    actorId: 'source', round: 1, turnKey: '1:source',
  })
  expect(result.map.dnd5ePluginAreas).toEqual([])
  expect(result.state.combatants.source.classState.concentrationSpellId).toBeUndefined()
  expect(result.map.tokens.find(token => token.id === 'source')?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
  expect(result.candidates).toEqual([])
  expect({ map, state: snapshot.state }).toEqual(before)
})
