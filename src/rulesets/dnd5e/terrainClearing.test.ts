import { afterEach, expect, it } from 'vitest'
import { validateSharedStateShape } from '../../../scripts/shared-server-core.mjs'
import { normalizeCharacter } from '../../store/characters'
import { migrateMapsState, type BattleMap } from '../../store/maps'
import { normalizeSharedCampaignTime } from '../../lib/campaignTime'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { prepareDnd5eTerrainClearing } from './terrainClearing'
import { dnd5ePersistentAreaMovementCostMultiplierAt } from './persistentAreaGeometry'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'

afterEach(() => setMapGeometryRuntime([]))

it('requires ten distinct rounds of work, persists progress, and spends actions without advancing the clock twice', () => {
  const input = { ...fixture(), combatActive: true }
  for (let round = 1; round <= 10; round++) {
    const combat = { id: 'fight', round, currentTokenId: 'hero', turnEconomy: createDnd5eTurnEconomyCounts(`hero:${round}`) }
    const result = prepareDnd5eTerrainClearing({ ...input, combat, transactionId: `work-${round}` })
    expect(result.ok).toBe(true)
    if (!result.ok) throw Error(result.reason)
    expect(result.turnEconomy?.action.current).toBe(0)
    expect(result.campaignTime).toEqual(input.campaignTime)
    expect(result.progress).toEqual({ workedRounds: round, requiredRounds: 10, completed: round === 10 })
    expect(validateSharedStateShape('maps', { maps: [result.map] })).toEqual({ ok: true })
    input.map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.map] }))).maps[0]
    expect(input.map.dnd5ePluginAreas![0].cells.length).toBe(round < 10 ? 2 : 1)
    if (round < 10) {
      expect(input.map.dnd5ePluginAreas![0].terrainClearingProgress![0].workedRounds).toBe(round)
      expect(prepareDnd5eTerrainClearing({ ...input, combat, transactionId: `repeat-${round}` })).toMatchObject({ ok: false, reason: 'terrain-clearing-round-already-worked' })
    }
  }
  expect(input.map.dnd5ePluginAreas![0].cells).toEqual([{ col: 2, row: 1 }])
})

it('rejects a spent action and credits previous combat work during exploration', () => {
  const input = fixture(10)
  const economy = createDnd5eTurnEconomyCounts('turn')
  economy.action.current = 0
  expect(prepareDnd5eTerrainClearing({ ...input, combatActive: true,
    combat: { id: 'fight', round: 1, currentTokenId: 'hero', turnEconomy: economy } })).toMatchObject({ ok: false, reason: 'terrain-clearing-action-unavailable' })
  input.map.dnd5ePluginAreas![0].terrainClearingProgress = [{ col: 1, row: 1, workedRounds: 20, lastCombatId: 'fight', lastRound: 20 }]
  const result = prepareDnd5eTerrainClearing(input)
  expect(result.ok && result.minutes).toBe(2)
})
function fixture(feet = 5) {
  const character = normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20 })
  const map: BattleMap = { id: 'rubble-map', name: 'Rubble', width: 1000, height: 1000,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: feet, showGrid: true,
    tokens: [{ id: 'hero', characterId: 'hero', type: 'player', label: 'Hero', size: 1, x: 75, y: 75, color: '#fff', emoji: '' }],
    dnd5ePluginAreas: [{ id: 'rubble', pluginId: 'test', featureId: 'test:rubble', label: 'Rubble', color: '#997744',
      sourceCharacterId: 'former-caster', sourceTokenId: 'former-caster', createdRound: 1, expiresAfterRound: 2,
      permanent: true, anchorMode: 'fixed', cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }],
      vertical: { mode: 'ground' }, includeSelf: true, relation: 'any', movementCostMultiplier: 2,
      terrainClearing: { squareFeetPerMinute: 25 } }],
  }
  return { map, characters: [character], actorTokenId: 'hero', areaId: 'rubble', cells: [{ col: 1, row: 1 }],
    campaignTime: normalizeSharedCampaignTime(null), combatActive: false, transactionId: 'clear-1', now: 100 }
}

it.each([[5, 1], [10, 4], [2.5, 1]])('clears only selected terrain and charges actual area at %s feet', (feet, minutes) => {
  const input = fixture(feet), before = structuredClone(input)
  const result = prepareDnd5eTerrainClearing(input)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('missing result')
  expect(result.minutes).toBe(minutes)
  expect(result.campaignTime.worldMinute).toBe(input.campaignTime.worldMinute + minutes)
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.map] }))).maps[0]
  expect(saved.dnd5ePluginAreas![0].terrainClearing).toEqual({ squareFeetPerMinute: 25 })
  expect(saved.dnd5ePluginAreas![0].cells).toEqual([{ col: 2, row: 1 }])
  expect(dnd5ePersistentAreaMovementCostMultiplierAt({ map: saved, token: saved.tokens[0], position: saved.tokens[0] })).toBe(1)
  expect(dnd5ePersistentAreaMovementCostMultiplierAt({ map: saved, token: saved.tokens[0], position: { ...saved.tokens[0], x: 125 } })).toBe(2)
  expect(validateSharedStateShape('maps', { maps: [saved] })).toEqual({ ok: true })
  expect(validateSharedStateShape('campaign-time', result.campaignTime)).toEqual({ ok: true })
  expect(prepareDnd5eTerrainClearing({ ...input, map: saved, campaignTime: result.campaignTime })).toMatchObject({ ok: false, reason: 'terrain-clearing-already-completed' })
  expect(input).toEqual(before)
})

it('removes exhausted area, preserves overlapping unrelated terrain and does not charge resources', () => {
  const input = fixture()
  input.cells = [{ col: 1, row: 1 }, { col: 2, row: 1 }]
  input.map.dnd5ePluginAreas!.push({ ...input.map.dnd5ePluginAreas![0], id: 'other' })
  const result = prepareDnd5eTerrainClearing(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error('missing result')
  expect(result.minutes).toBe(2)
  expect(result.map.dnd5ePluginAreas?.map(a => a.id)).toEqual(['other'])
  expect(dnd5ePersistentAreaMovementCostMultiplierAt({ map: result.map, token: result.map.tokens[0], position: result.map.tokens[0] })).toBe(2)
  expect(input.characters[0].currentHp).toBe(20)
})

it.each(['combat', 'far', 'airborne', 'incapacitated', 'missing-character', 'dead', 'duplicate', 'outside', 'bad-rate', 'concentration', 'wall'])('rejects %s without changing any state', kind => {
  const input = fixture()
  if (kind === 'combat') input.combatActive = true
  if (kind === 'far') input.map.tokens[0].x = 525
  if (kind === 'airborne') input.map.tokens[0].elevationFeet = 10
  if (kind === 'incapacitated') input.characters[0].conditions = ['unconscious']
  if (kind === 'dead') input.characters[0].currentHp = 0
  if (kind === 'missing-character') input.characters = []
  if (kind === 'duplicate') input.cells.push({ ...input.cells[0] })
  if (kind === 'outside') input.cells = [{ col: 9, row: 9 }]
  if (kind === 'bad-rate') input.map.dnd5ePluginAreas![0].terrainClearing!.squareFeetPerMinute = 0
  if (kind === 'concentration') input.map.dnd5ePluginAreas![0].concentrationId = 'active-spell'
  if (kind === 'wall') {
    input.cells = [{ col: 2, row: 1 }]
    const geometry = createEmptyMapGeometry(input.map.id)
    geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 100, y: 0 }, { x: 100, y: 200 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 30, createdAt: 1 })
    setMapGeometryRuntime([geometry])
  }
  const before = structuredClone(input)
  expect(prepareDnd5eTerrainClearing(input).ok).toBe(false)
  expect(input).toEqual(before)
})

it.each(['negative', 'foreign-cell', 'duplicate', 'unknown-field'])('rejects malformed persisted clearing progress: %s', kind => {
  const input = fixture()
  const progress = { col: 1, row: 1, workedRounds: 1, lastCombatId: 'fight', lastRound: 1 }
  input.map.dnd5ePluginAreas![0].terrainClearingProgress = [progress]
  if (kind === 'negative') progress.workedRounds = -1
  if (kind === 'foreign-cell') progress.col = 99
  if (kind === 'duplicate') input.map.dnd5ePluginAreas![0].terrainClearingProgress!.push({ ...progress })
  if (kind === 'unknown-field') Object.assign(progress, { clearImmediately: true })
  expect(validateSharedStateShape('maps', { maps: [input.map] })).toMatchObject({ ok: false })
  expect(prepareDnd5eTerrainClearing(input)).toMatchObject({ ok: false, reason: 'invalid-terrain-clearing-progress' })
})

it.each([0, -1, 0.5, 10001, NaN])('rejects invalid clearing rates in synchronized maps (%s)', rate => {
  const input = fixture()
  input.map.dnd5ePluginAreas![0].terrainClearing!.squareFeetPerMinute = rate
  expect(validateSharedStateShape('maps', { maps: [input.map] })).toMatchObject({ ok: false })
  expect(migrateMapsState({ maps: [input.map] }).maps[0].dnd5ePluginAreas![0].terrainClearing).toBeUndefined()
})
