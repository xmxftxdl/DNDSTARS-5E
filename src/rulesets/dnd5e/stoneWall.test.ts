import { describe, expect, it } from 'vitest'
import { stoneWallPanels, stoneWallCells, stoneWallEnclosedCells, normalizeStoneWallState } from './stoneWall'
import { stoneWallEscapeDestinations, stoneWallEnclosure, resolveStoneWallEscape } from './stoneWallEscape'
import { resolvePersistentAreaEntityAttackByDm, removePersistentAreaByDm } from './persistentAreaRemoval'
import { mapGeometryMovementBlocked, mapGeometryLineOfEffectBlocked, createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Dnd5ePluginArea } from '../../store/maps'
import { mutatePlayerExplorationMoveState } from '../../../scripts/player-exploration-move.mjs'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'

function fixture(angles = [0, 90, 180, 270]) {
  const map: BattleMap = { id: 'stone-test', name: 'Stone', width: 1000, height: 1000, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [{ id: 'target', label: 'Target', type: 'enemy', x: 175, y: 175, size: 1, color: '', emoji: '', hp: 10 }] }
  const panels = stoneWallPanels({ mode: 'thick', start: { col: 2, row: 2 }, angles }, map)
  const area: Dnd5ePluginArea = { id: 'wall', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:wall-of-stone',
    sourceKind: 'core-spell', coreSpellId: 'wall-of-stone', label: '石墙术', color: '#78716c',
    sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', cells: stoneWallCells(panels),
    anchorMode: 'fixed', anchorCell: { col: 2, row: 2 }, createdRound: 1, expiresAfterRound: 101,
    concentrationId: 'wall-of-stone', blocking: { movement: true, vision: true, lineOfEffect: true },
    vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
    stoneWall: { mode: 'thick', panels, saveDc: 15 } }
  map.dnd5ePluginAreas = [area]
  return { map, area }
}

describe('Stone wall panels', () => {
  it('finds enclosed creatures only after a loop closes', () => {
    expect(stoneWallEnclosedCells(fixture().area.stoneWall!.panels).has('3,3')).toBe(true)
    expect(stoneWallEnclosedCells(fixture([0, 90, 180]).area.stoneWall!.panels).size).toBe(0)
  })
  it('shares panel joints and gives thin panels twice the length and half the HP', () => {
    const { map } = fixture()
    const panels = stoneWallPanels({ mode: 'thin', start: { col: 2, row: 2 }, angles: [0, 90] }, map)
    expect(panels[0].end).toEqual(panels[1].start)
    expect(panels[0].end.col - panels[0].start.col).toBe(4)
    expect(panels[0].hitPoints).toBe(90)
  })
  it('checks AC, opens only the broken segment, and retains other panels and concentration', () => {
    const { map, area } = fixture()
    const hit = (attackTotal: number, damage: number) => resolvePersistentAreaEntityAttackByDm({ map, characters: [], areaId: area.id, panelId: 'panel-1', attackTotal, damage })!
    expect(hit(14, 999).outcome).toBe('miss')
    expect(hit(15, 30).hitPointsAfter).toBe(150)
    const broken = hit(15, 180)
    expect(broken.concentrationEnded).toBe(false)
    const remaining = broken.map.dnd5ePluginAreas![0]
    expect(remaining.concentrationId).toBe('wall-of-stone')
    expect(remaining.stoneWall!.panels.filter(p => p.hitPoints > 0)).toHaveLength(3)
    const token = map.tokens[0], to = { x: 175, y: 75 }
    expect(mapGeometryMovementBlocked({ map, token, to }).blocked).toBe(true)
    expect(mapGeometryMovementBlocked({ map: broken.map, token, to }).blocked).toBe(false)
    // A destroyed 10-foot panel leaves a real 10-foot gap, not a single
    // 5-foot cell after the neighbouring panels retain their joint cells.
    expect(mapGeometryMovementBlocked({ map: broken.map, token: { ...token, size: 2 }, to }).blocked).toBe(false)
    expect(mapGeometryLineOfEffectBlocked({ map: broken.map, from: token, to })).toBe(false)
  })
  it('keeps panel HP and gaps through JSON persistence', () => {
    const { map } = fixture()
    const broken = resolvePersistentAreaEntityAttackByDm({ map, characters: [], areaId: 'wall', panelId: 'panel-1', attackTotal: 15, damage: 180 })!
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [broken.map], selectedId: map.id }))).maps[0]
    expect(restored.dnd5ePluginAreas![0].stoneWall).toEqual(broken.map.dnd5ePluginAreas![0].stoneWall)
    expect(restored.dnd5ePluginAreas![0].cells).toEqual(broken.map.dnd5ePluginAreas![0].cells)
  })
  it('rejects malformed persisted HP', () => {
    const state = fixture().area.stoneWall!
    state.panels[0].hitPoints = -1
    expect(normalizeStoneWallState(state)).toBeUndefined()
  })
  it('offers reaction destinations outside the forming wall but within speed', () => {
    const { map, area } = fixture()
    expect(stoneWallEscapeDestinations(map, area, map.tokens[0], 5)).toEqual([])
    const destinations = stoneWallEscapeDestinations(map, area, map.tokens[0], 10)
    expect(destinations).toContainEqual({ col: 3, row: 1 })
    expect(destinations).not.toContainEqual({ col: 3, row: 3 })
    expect(destinations).not.toContainEqual({ col: 3, row: 0 })
  })
  it('rejects unavailable, stale and repeated escape reactions', () => {
    const { map, area } = fixture()
    area.stoneWall!.escapes = [{ tokenId: 'target', origin: { col: 3, row: 3 }, status: 'ready' }]
    const input = { map, areaId: area.id, tokenId: 'target', to: { col: 3, row: 1 }, round: 1, speed: 30, reactionAvailable: true }
    expect(resolveStoneWallEscape({ ...input, reactionAvailable: false })).toBeUndefined()
    expect(resolveStoneWallEscape({ ...input, round: 2 })).toBeUndefined()
    expect(resolveStoneWallEscape({ ...input, activeTokenId: 'another-turn' })).toBeUndefined()
    const escaped = resolveStoneWallEscape(input)!
    expect(escaped.tokens[0].y).toBe(75)
    expect(escaped.dnd5ePluginAreas![0].stoneWall!.escapes![0].status).toBe('done')
    expect(resolveStoneWallEscape({ ...input, map: escaped })).toBeUndefined()
  })
  it('recognizes a straight wall closing a room doorway, but not a wall inside an already closed room', () => {
    const { map } = fixture()
    map.dnd5ePluginAreas = []
    const geometry = createEmptyMapGeometry(map.id, 1)
    const edge = (id: string, points: { x: number; y: number }[]) => ({ id, kind: 'wall' as const, label: id, points,
      blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
    geometry.walls = [edge('room', [{ x: 100, y: 100 }, { x: 100, y: 300 }, { x: 300, y: 300 }, { x: 300, y: 100 }])]
    setMapGeometryRuntime([geometry])
    try {
      const panels = stoneWallPanels({ mode: 'thin', start: { col: 1, row: 1 }, angles: [0] }, map)
      expect(stoneWallEnclosure(map, panels, map.tokens[0]).size).toBeGreaterThan(0)
      geometry.walls.push(edge('lid', [{ x: 100, y: 100 }, { x: 300, y: 100 }]))
      setMapGeometryRuntime([geometry])
      expect(stoneWallEnclosure(map, panels, map.tokens[0]).size).toBe(0)
    } finally { setMapGeometryRuntime([]) }
  })
  it('deleting an older permanent wall never cancels a newer stone-wall concentration', () => {
    const { map, area } = fixture()
    area.permanent = true; area.concentrationId = undefined
    const caster = { id: 'wizard', concentrating: true, dnd5eCombatState: { concentrationSpellId: 'wall-of-stone' } } as import('../../types/character').Character
    const removed = removePersistentAreaByDm({ map, characters: [caster], areaId: area.id })!
    expect(removed.concentrationEnded).toBe(false)
    expect(removed.character?.concentrating).toBe(true)
  })
  it('uses the same broken-wall geometry for server-authorized player movement', () => {
    const { map } = fixture()
    map.tokens[0] = { ...map.tokens[0], type: 'player', characterId: 'hero' }
    const mutation = { operation: 'move-owned-token', mapId: map.id, tokenId: 'target', characterId: 'hero',
      expectedPosition: { x: 175, y: 175 }, targetPosition: { x: 175, y: 75 }, path: [{ x: 175, y: 175 }, { x: 175, y: 75 }] }
    const member = { memberId: 'owner' }, context = { characterState: { characters: [{ id: 'hero', roomMemberId: 'owner',
      rulesetId: 'dnd5e-2014-srd-5.1', currentHp: 10, conditions: [] }] } }
    expect(mutatePlayerExplorationMoveState({ maps: [map] }, mutation, 1, member, context)).toMatchObject({ ok: false, error: 'exploration-move-wall-blocked' })
    const broken = resolvePersistentAreaEntityAttackByDm({ map, characters: [], areaId: 'wall', panelId: 'panel-1', attackTotal: 15, damage: 180 })!
    expect(mutatePlayerExplorationMoveState({ maps: [broken.map] }, mutation, 1, member, context)).toMatchObject({ ok: true })
  })
  it('keeps stone panels visible to players when their caster is absent', () => {
    const { map, area } = fixture()
    map.tokens[0] = { ...map.tokens[0], type: 'player', characterId: 'hero' }
    const projected = projectMapsForPlayer({ maps: [map] }, { maps: [] }, 'hero')
    expect(projected.maps[0].dnd5ePluginAreas?.[0]?.stoneWall).toEqual(area.stoneWall)
  })
})
