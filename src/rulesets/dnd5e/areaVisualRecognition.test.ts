import { afterEach, expect, it } from 'vitest'
import { illusionRecognizedByViewer } from '../../components/map/illusionObserverPresentation'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import { normalizeCharacter } from '../../store/characters'
import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'
import { prepareDnd5eDruidGroveSpikeGrowth } from './druidGroveSpikeGrowth'
import { canSeeRecognizableArea, recognizeAreasByVisualSearch, visualSearchAuthorityStamp } from './areaVisualRecognition'
import { prepareDnd5eAbilityCheck, resolvePreparedDnd5eAbilityCheck } from './abilityCheckAction'

afterEach(() => setMapGeometryRuntime([]))
it.each([
  { skill: 'investigation' as const, total: 17, discovered: true },
  { skill: 'investigation' as const, total: 16, discovered: false },
  { skill: 'perception' as const, total: 20, discovered: false },
])('discovers hidden physical areas by the declared skill without exposing an area ID (%j)', ({ skill, total, discovered }) => {
  const input = fixture(), area = input.map.dnd5ePluginAreas![0]
  area.visualRecognition = { dc: 17, skill: 'investigation', knownTokenIds: ['owner'] }
  const prepared = prepareDnd5eAbilityCheck({ ...input, worldMinute: 100,
    initiativeOrder: input.map.tokens.map(token => ({ tokenId: token.id, label: token.label, roll: 10, color: '', emoji: '' })),
    action: { id: 'physical-search', mapId: input.map.id, combatId: 'combat', actorTokenId: 'visitor', characterId: 'visitor',
      type: 'dnd5e-ability-check', sourceMode: 'player', status: 'pending', round: 1, initiativeIndex: 1, seq: 1, updatedAt: 1,
      dnd5eAbilityCheck: { ability: skill === 'investigation' ? 'int' : 'wis', skill,
        ...(skill === 'perception' ? { context: 'sight' as const } : {}), dc: 1, spendAction: true } } })
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) return
  const resolved = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: total })
  expect(resolved.result.ok).toBe(true)
  expect(resolved.result.state.combatants.visitor.turn.actionAvailable).toBe(false)
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [resolved.application!.map], selectedId: input.map.id }))).maps[0]
  expect(saved.dnd5ePluginAreas![0].visualRecognition?.skill).toBe('investigation')
  expect(saved.dnd5ePluginAreas![0].visualRecognition?.knownTokenIds.includes('visitor')).toBe(discovered)
  expect(validateAndMigrateSharedResource('maps', { maps: [saved], selectedId: saved.id, updatedAt: 1 }).status).not.toBe('invalid')
  const project = (characterId: string) => projectMapsForPlayer({ maps: [saved] }, { maps: [input.geometry] }, characterId, { characters: input.characters })
  expect(project('visitor').maps[0].dnd5ePluginAreas).toHaveLength(discovered ? 1 : 0)
  expect(project('other').maps[0].dnd5ePluginAreas).toHaveLength(0)
  expect(JSON.stringify(project('visitor'))).not.toContain('visualRecognition')
})
it('invalidates a pending visual search after movement, removal, blindness, geometry or time changes', () => {
  const { map, characters, geometry } = fixture()
  const stamp = visualSearchAuthorityStamp(map, characters, 100, geometry)
  expect(visualSearchAuthorityStamp(structuredClone(map), structuredClone(characters), 100, structuredClone(geometry))).toBe(stamp)
  const moved = structuredClone(map)
  moved.tokens[1].x += 50
  expect(visualSearchAuthorityStamp(moved, characters, 100, geometry)).not.toBe(stamp)
  expect(visualSearchAuthorityStamp({ ...map, dnd5ePluginAreas: [] }, characters, 100, geometry)).not.toBe(stamp)
  expect(visualSearchAuthorityStamp(undefined, characters, 100, geometry)).not.toBe(stamp)
  expect(visualSearchAuthorityStamp(map, characters, 101, geometry)).not.toBe(stamp)
  expect(visualSearchAuthorityStamp(map, characters, 100, { ...geometry, environment: 'indoors' })).not.toBe(stamp)
  characters[1].conditions = ['blinded']
  expect(visualSearchAuthorityStamp(map, characters, 100, geometry)).not.toBe(stamp)
})
function fixture() {
  const characters = ['owner', 'visitor', 'other'].map(id => normalizeCharacter({ id, name: id,
    charClass: '法师', level: 3, maxHp: 20, currentHp: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }))
  const tokens: Token[] = characters.map((c, index) => ({ id: c.id, characterId: c.id, label: c.name,
    type: 'player', x: 25 + index * 50, y: 25, size: 1, color: '', emoji: '' }))
  const map: BattleMap = { id: 'recognition', name: 'Map', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.environment = 'outdoors'
  setMapGeometryRuntime([geometry])
  const source = { castId: 'recognition-cast', pluginId: 'test.grove', spellId: 'grove', characterId: 'owner', tokenId: 'owner', slotLevel: 6, saveDc: 17 }
  const prepare = () => prepareDnd5eDruidGroveSpikeGrowth({ map, geometry, characters,
    placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [], undergrowthCells: [], guardianTreeIds: [] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: [], treeTokenIds: [] }, source,
    round: 1, worldMinute: 100, center: { col: 2, row: 2 } })
  const created = prepare()
  if (!created.ok) throw Error(created.reason)
  map.dnd5ePluginAreas = created.areas
  return { map, characters, geometry, prepare }
}

it('records sighted witnesses, but does not grant recognition to a blinded witness', () => {
  const input = fixture()
  expect(input.map.dnd5ePluginAreas![0].visualRecognition).toEqual({ dc: 17, knownTokenIds: ['owner', 'visitor', 'other'] })
  input.characters[1].conditions = ['blinded']
  const recreated = input.prepare()
  if (!recreated.ok) throw Error(recreated.reason)
  expect(recreated.areas[0].visualRecognition?.knownTokenIds).toEqual(['owner', 'other'])
})

it.each([16, 17])('uses the Host hazard DC on a real perception transaction, total %i', total => {
  const input = fixture()
  input.map.dnd5ePluginAreas![0].visualRecognition!.knownTokenIds = ['owner']
  const original = structuredClone(input.map)
  const prepared = prepareDnd5eAbilityCheck({ ...input, worldMinute: 100,
    initiativeOrder: input.map.tokens.map(token => ({ tokenId: token.id, label: token.label, roll: 10, color: '', emoji: '' })),
    action: { id: 'search', mapId: input.map.id, actorTokenId: 'visitor', characterId: 'visitor', type: 'dnd5e-ability-check',
      sourceMode: 'player', status: 'pending', round: 1, initiativeIndex: 1, seq: 1, updatedAt: 1,
      dnd5eAbilityCheck: { ability: 'wis', skill: 'perception', context: 'sight', dc: 1 } } })
  if (!prepared.ok) throw Error(prepared.reason)
  const result = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: total })
  expect(result.result.ok).toBe(true)
  const loaded = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.application!.map] }))).maps[0]
  expect(loaded.dnd5ePluginAreas![0].visualRecognition!.knownTokenIds).toEqual(total === 17 ? ['owner', 'visitor'] : ['owner'])
  expect(validateAndMigrateSharedResource('maps', { maps: [loaded], selectedId: loaded.id, updatedAt: 1 }).status).not.toBe('invalid')
  for (const characterId of ['visitor', 'other']) {
    const projected = projectMapsForPlayer({ maps: [loaded] }, { maps: [input.geometry] }, characterId, { characters: input.characters })
    expect(projected.maps[0].dnd5ePluginAreas).toHaveLength(total === 17 && characterId === 'visitor' ? 1 : 0)
    expect(JSON.stringify(projected)).not.toContain('knownTokenIds')
    expect(JSON.stringify(projected)).not.toContain('visualRecognition')
  }
  expect(input.map).toEqual(original)
  expect(loaded.dnd5ePluginAreas![0].hiddenFromPlayers).toBe(true)
  expect(loaded.dnd5ePluginAreas![0].movementCostMultiplier).toBe(2)
  expect(loaded.dnd5ePluginAreas![0].triggers![0].damage).toMatchObject({ count: 2, sides: 4 })
})

it('does not grant recognition while blinded, unconscious or after expiry and rejects malformed imported knowledge', () => {
  const input = fixture(), area = input.map.dnd5ePluginAreas![0]
  area.visualRecognition!.knownTokenIds = []
  input.characters[1].conditions = ['blinded']
  const search = () => recognizeAreasByVisualSearch({ ...input, actorTokenId: 'visitor', total: 30, worldMinute: 100, round: 1 })
  expect(search()).toBe(input.map)
  input.characters[1].conditions = ['unconscious']
  expect(search()).toBe(input.map)
  input.characters[1].conditions = []
  area.expiresAtWorldMinute = 100
  expect(search()).toBe(input.map)
  area.expiresAtWorldMinute = 200
  area.visualRecognition = { dc: 17, knownTokenIds: ['visitor', 'visitor'] }
  expect(validateAndMigrateSharedResource('maps', { maps: [input.map] }).status).toBe('invalid')
  expect(migrateMapsState({ maps: [input.map] }).maps[0].dnd5ePluginAreas).toEqual([])
})

it.each([16,17])('investigates only the selected illusion at its Host DC (%s)', total => {
  const input=fixture(), area=input.map.dnd5ePluginAreas![0]
  area.illusionRecognition={dc:17,knownTokenIds:[]}
  input.map.dnd5ePluginAreas!.push({...area,id:'other-illusion',illusionRecognition:{dc:17,knownTokenIds:[]}})
  const action = { id:'investigate',mapId:input.map.id,combatId:'combat',actorTokenId:'visitor',characterId:'visitor',type:'dnd5e-ability-check' as const,
    sourceMode:'player' as const,status:'pending' as const,round:1,initiativeIndex:1,seq:1,updatedAt:1,
    dnd5eAbilityCheck:{ability:'int' as const,skill:'investigation' as const,dc:1,spendAction:true,investigatedAreaId:area.id} }
  const args={...input,worldMinute:100,action,initiativeOrder:input.map.tokens.map(token=>({tokenId:token.id,label:token.label,roll:10,color:'',emoji:''}))}
  const prepared=prepareDnd5eAbilityCheck(args)
  expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
  expect(prepared.prepared.payload.dc).toBe(17)
  const result=resolvePreparedDnd5eAbilityCheck({prepared:prepared.prepared,d20:total})
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.visitor.turn.actionAvailable).toBe(false)
  const loaded=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.application!.map]}))).maps[0]
  expect(loaded.dnd5ePluginAreas![0].illusionRecognition?.knownTokenIds).toEqual(total===17?['visitor']:[])
  // Apply the persisted investigation result to an independent illusion token.
  loaded.dnd5ePluginAreas![0].anchorMode = 'effect-token'
  loaded.dnd5ePluginAreas![0].anchorTokenId = 'dragon'
  expect(illusionRecognizedByViewer(loaded, 'dragon', 'visitor', false)).toBe(total === 17)
  expect(illusionRecognizedByViewer(loaded, 'dragon', 'other', false)).toBe(false)
  expect(illusionRecognizedByViewer(loaded, 'dragon', undefined, false)).toBe(false)
  expect(illusionRecognizedByViewer(loaded, 'dragon', 'visitor', true)).toBe(false)
  expect(illusionRecognizedByViewer(loaded, 'another-dragon', 'visitor', false)).toBe(false)
  expect(loaded.dnd5ePluginAreas!.find(area=>area.id==='other-illusion')?.illusionRecognition?.knownTokenIds).toEqual([])
  expect(prepareDnd5eAbilityCheck({...args,action:{...action,dnd5eAbilityCheck:{...action.dnd5eAbilityCheck,spendAction:false}}})).toMatchObject({ok:false})
  input.characters[1].conditions=['blinded']
  expect(prepareDnd5eAbilityCheck(args)).toMatchObject({ok:false})
})

it('rejects malformed illusion knowledge at the shared resource boundary', () => {
  const { map } = fixture()
  map.dnd5ePluginAreas![0].illusionRecognition = { dc: 17, knownTokenIds: ['visitor'] }
  expect(validateAndMigrateSharedResource('maps', { maps: [map] }).status).not.toBe('invalid')
  map.dnd5ePluginAreas![0].illusionRecognition = { dc: 17, knownTokenIds: ['visitor', 'visitor'] }
  expect(validateAndMigrateSharedResource('maps', { maps: [map] }).status).toBe('invalid')
})

it('investigates the elevated illusion instead of the ground beneath it', () => {
  const { map, characters, geometry } = fixture()
  const area = map.dnd5ePluginAreas![0]
  area.cells = [{ col: 4, row: 0 }]
  area.illusionRecognition = { dc: 17, knownTokenIds: [] }
  geometry.walls = [{ id: 'low-wall', kind: 'wall', label: '', points: [{ x: 150, y: 0 }, { x: 150, y: 500 }],
    blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 }]
  expect(canSeeRecognizableArea(map, area, map.tokens[1], characters, 100, structuredClone(geometry))).toBe(false)
  area.vertical = { mode: 'volume', baseElevationFeet: 50, heightFeet: 15 }
  expect(canSeeRecognizableArea(map, area, map.tokens[1], characters, 100, structuredClone(geometry))).toBe(true)
  geometry.walls[0].heightFeet = 100
  expect(canSeeRecognizableArea(map, area, map.tokens[1], characters, 100, structuredClone(geometry))).toBe(false)
})
