import { recordDnd5eAcceptedMovementSightings } from './mapMovementSightings'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, refreshDnd5eMapSpatialRelations } from './mapBridge'
import { dnd5eCreatureSeenRecently, recordDnd5eCreatureSightings, dnd5eSightingWorldMinute } from './recentCreatureSightings'

function fixture(worldMinute?: number) {
  const tokens: Token[] = ['archer', 'target'].map((id, i) => ({ id, type: 'enemy', label: id, x: 25 + 50 * i, y: 25, size: 1, hp: 10, maxHp: 10, emoji: '', color: '' }))
  const map: BattleMap = { id: 'sightings', name: 'Map', width: 250, height: 250, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens }
  const initiativeOrder = tokens.map(t => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 10 }))
  return { map, characters: [], initiativeOrder, combatId: 'sightings', worldMinute, worldSecondRemainder: 0 }
}
it('persists Host sightings through map application and JSON reload without storing target positions', () => {
  const input = fixture(10)
  const before = JSON.stringify(input)
  const snapshot = createDnd5eMapCombatSnapshot(input)
  expect(snapshot.state.combatants.archer.classState.recentCreatureSightings).toEqual({ target: { mapId: 'sightings', worldMinute: 10, label: 'target' } })
  const plan = planDnd5eMapResultApplication({ ...snapshot, map: input.map, characters: [] })
  const rebuilt = createDnd5eMapCombatSnapshot({ ...input, worldMinute: undefined, map: JSON.parse(JSON.stringify(plan.map)) })
  const history = rebuilt.state.combatants.archer.classState.recentCreatureSightings
  expect(dnd5eCreatureSeenRecently({ history, targetId: 'target', mapId: input.map.id, worldMinute: 11, maximumAgeSeconds: 60 })).toBe(true)
  expect(dnd5eCreatureSeenRecently({ history, targetId: 'target', mapId: input.map.id, worldMinute: 11.001, maximumAgeSeconds: 60 })).toBe(false)
  expect(JSON.stringify(input)).toBe(before)
})
it('does not fabricate historical sight when game time is missing or invalid', () => {
  for (const worldMinute of [undefined, NaN, Infinity, -1]) {
    const { state } = createDnd5eMapCombatSnapshot(fixture(worldMinute))
    expect(state.combatants.archer.classState.recentCreatureSightings).toBeUndefined()
  }
  const input = { targetId: 'target', mapId: 'sightings', maximumAgeSeconds: 60 }
  expect(dnd5eCreatureSeenRecently(input)).toBe(false)
  expect(dnd5eCreatureSeenRecently({ ...input, currentlyVisible: true })).toBe(true)
})
it('expires unseen history, rejects time reversal and another map, and excludes objects', () => {
  const { state } = createDnd5eMapCombatSnapshot(fixture(10))
  const history = state.combatants.archer.classState.recentCreatureSightings
  for (const [worldMinute, mapId] of [[9, 'sightings'], [10, 'another']] as const) {
    expect(dnd5eCreatureSeenRecently({ history, targetId: 'target', mapId, worldMinute, maximumAgeSeconds: 60 })).toBe(false)
  }
  recordDnd5eCreatureSightings(state, 11.1, () => false)
  expect(state.combatants.archer.classState.recentCreatureSightings).toBeUndefined()
  state.combatants.target.objectDamageThreshold = 0
  recordDnd5eCreatureSightings(state, 12, () => true)
  expect(state.combatants.archer.classState.recentCreatureSightings).toBeUndefined()
})

it('keeps a previously seen target behind a real wall until expiry without refreshing its timestamp', () => {
  const input = fixture(20)
  const first = createDnd5eMapCombatSnapshot({ ...input, geometry: null })
  const saved = planDnd5eMapResultApplication({ ...first, map: input.map, characters: [] })
  const geometry = createEmptyMapGeometry(input.map.id, 1)
  geometry.walls = [{ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 50, y: 0 }, { x: 50, y: 250 }], edgeIds: ['edge'], baseHeightFeet: 0, heightFeet: 20, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 1 }]
  const obscured = createDnd5eMapCombatSnapshot({ ...input, map: saved.map, geometry, worldMinute: 20.5 })
  expect(dnd5eCombatantCanSee(obscured.state, 'archer', 'target')).toBe(false)
  expect(obscured.state.combatants.archer.classState.recentCreatureSightings?.target.worldMinute).toBe(20)
  const updated = planDnd5eMapResultApplication({ ...obscured, map: saved.map, geometry, characters: [] })
  const expired = createDnd5eMapCombatSnapshot({ ...input, map: JSON.parse(JSON.stringify(updated.map)), geometry, worldMinute: 21.01 })
  expect(expired.state.combatants.archer.classState.recentCreatureSightings).toBeUndefined()
  const neverSeen = createDnd5eMapCombatSnapshot({ ...input, geometry })
  expect(neverSeen.state.combatants.archer.classState.recentCreatureSightings).toBeUndefined()
})

it('does not record vision while the observer is blinded', () => {
  const input = fixture(30)
  input.map.tokens[0].dnd5eCombatState = { schemaVersion: 2, activeEffects: migrateLegacyDnd5eConditions({ targetId: 'archer', conditions: ['blinded'] }), conditions: ['blinded'] }
  const snapshot = createDnd5eMapCombatSnapshot({ ...input, geometry: null })
  expect(dnd5eCombatantCanSee(snapshot.state, 'archer', 'target')).toBe(false)
  expect(snapshot.state.combatants.archer.classState.recentCreatureSightings).toBeUndefined()
  expect(snapshot.state.combatants.target.classState.recentCreatureSightings?.archer.worldMinute).toBe(30)
})




it('retains second precision across minute boundaries and rejects malformed sub-minute clocks', () => {
  const snapshot = createDnd5eMapCombatSnapshot({ ...fixture(20), worldSecondRemainder: 54 })
  const history = snapshot.state.combatants.archer.classState.recentCreatureSightings
  expect(history?.target.worldMinute).toBe(20.9)
  const seen = (minute: number, seconds: number) => dnd5eCreatureSeenRecently({
    history, targetId: 'target', mapId: 'sightings', maximumAgeSeconds: 60,
    worldMinute: dnd5eSightingWorldMinute(minute, seconds),
  })
  expect(seen(21, 0)).toBe(true)
  expect(seen(21, 54)).toBe(true)
  expect(seen(21, 55)).toBe(false)
  expect(seen(20, 53)).toBe(false)
  for (const seconds of [-1, 60, 0.5, NaN, Infinity]) {
    expect(dnd5eSightingWorldMinute(20, seconds)).toBeUndefined()
    const invalid = createDnd5eMapCombatSnapshot({ ...fixture(20), worldSecondRemainder: seconds })
    expect(invalid.state.combatants.archer.classState.recentCreatureSightings).toBeUndefined()
  }
})

it('does not erase precise sightings when a legacy snapshot supplies only whole minutes', () => {
  const input = fixture(100)
  const first = createDnd5eMapCombatSnapshot({ ...input, worldSecondRemainder: 30 })
  const saved = planDnd5eMapResultApplication({ ...first, map: input.map, characters: [] })
  const legacy = createDnd5eMapCombatSnapshot({ ...input, map: saved.map, worldSecondRemainder: undefined })
  expect(legacy.state.combatants.archer.classState.recentCreatureSightings?.target.worldMinute).toBe(100.5)
  expect(dnd5eSightingWorldMinute(100)).toBeUndefined()
})


it('refreshes occlusion after movement before renewing recent sightings', () => {
  const input = fixture(50)
  const geometry = createEmptyMapGeometry(input.map.id, 1)
  geometry.walls = [{ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 100, y: 0 }, { x: 100, y: 250 }], edgeIds: ['edge'], baseHeightFeet: 0, heightFeet: 20, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 1 }]
  const { state, characterIdByCombatantId } = createDnd5eMapCombatSnapshot({ ...input, geometry })
  expect(state.combatants.archer.classState.recentCreatureSightings?.target.worldMinute).toBe(50)
  state.companionScene!.worldSecondRemainder = 30
  state.combatants.target.position.x = 125
  refreshDnd5eMapSpatialRelations(state, input.map, [], { geometry })
  expect(dnd5eCombatantCanSee(state, 'archer', 'target')).toBe(false)
  expect(state.combatants.archer.classState.recentCreatureSightings?.target.worldMinute).toBe(50)
  state.companionScene!.worldMinute = 51
  state.companionScene!.worldSecondRemainder = 1
  refreshDnd5eMapSpatialRelations(state, input.map, [], { geometry })
  expect(state.combatants.archer.classState.recentCreatureSightings).toBeUndefined()
  state.combatants.target.position.x = 75
  refreshDnd5eMapSpatialRelations(state, input.map, [], { geometry })
  expect(dnd5eCombatantCanSee(state, 'archer', 'target')).toBe(true)
  expect(state.combatants.archer.classState.recentCreatureSightings?.target.worldMinute).toBe(51 + 1 / 60)
  const saved = planDnd5eMapResultApplication({ state, characterIdByCombatantId, map: input.map, characters: [] })
  expect(JSON.parse(JSON.stringify(saved.map)).tokens[0].dnd5eCombatState.recentCreatureSightings.target.worldMinute).toBe(51 + 1 / 60)
})


it('records an accepted route glimpse even when both endpoints are occluded, without persisting preview positions', () => {
  const input = fixture(60)
  input.map.tokens[0].x = 125
  input.map.tokens[0].y = 125
  const geometry = createEmptyMapGeometry(input.map.id, 1)
  geometry.walls = [{ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 100, y: 50 }, { x: 100, y: 250 }], edgeIds: ['edge'], baseHeightFeet: 0, heightFeet: 20, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 1 }]
  const path = [{x:125,y:125},{x:125,y:25},{x:125,y:125}]
  const placed = recordDnd5eAcceptedMovementSightings({ ...input, geometry, actorTokenId: 'archer', path: [path[2]], worldSecondRemainder: 30 })
  expect(placed.map.tokens[0].dnd5eCombatState?.recentCreatureSightings?.target).toBeUndefined()
  const original = JSON.stringify(input)
  const result = recordDnd5eAcceptedMovementSightings({ ...input, geometry, actorTokenId: 'archer', path, worldSecondRemainder: 30 })
  expect(result.map.tokens[0].dnd5eCombatState?.recentCreatureSightings?.target.worldMinute).toBe(60.5)
  expect(result.map.tokens[1].dnd5eCombatState?.recentCreatureSightings?.archer.worldMinute).toBe(60.5)
  expect(result.map.tokens[0]).toMatchObject({x:125,y:125,hp:10,maxHp:10})
  expect(JSON.stringify(input)).toBe(original)
  const reloaded = JSON.parse(JSON.stringify(result.map))
  const snapshot = createDnd5eMapCombatSnapshot({ ...input, map: reloaded, geometry, worldSecondRemainder: 31 })
  expect(dnd5eCombatantCanSee(snapshot.state, 'archer', 'target')).toBe(false)
  expect(snapshot.state.combatants.archer.classState.recentCreatureSightings?.target.worldMinute).toBe(60.5)
  const absentClock = recordDnd5eAcceptedMovementSightings({ ...input, geometry, actorTokenId: 'archer', path, worldSecondRemainder: undefined })
  expect(absentClock.map).toBe(input.map)
})
