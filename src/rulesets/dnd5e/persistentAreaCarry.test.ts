import { afterEach, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { migrateMapsState, type BattleMap, type Dnd5ePluginArea, type Token } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eConditionEffect } from './activeEffects'
import { planDnd5ePersistentAreaCarry } from './persistentAreaCarry'
import { stageDnd5eSphereAreaContact } from './persistentAreaContactStage'
import { prepareDnd5eCoreSpellAreaMove, resolvePreparedDnd5eCoreSpellAreaMove } from './coreSpellAreaAction'
import { applyDnd5eActivityMapHandoffsV1 } from './activities/dnd5eActivityMapInteraction'
import { dnd5eActivityMapMovementEvents } from './activities/dnd5eActivityMapMovementEvents'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

afterEach(() => setMapGeometryRuntime([]))
it('previews object intake with carried creatures and applies the object displacement only once', () => {
  const input = fixture()
  input.map.tokens = input.map.tokens.filter(t => ['source', 'npc'].includes(t.id))
  input.area.vertical = { mode: 'volume', baseElevationFeet: 0, heightFeet: 30 }
  input.area.circularGeometry = { radiusFeet: 10 }
  input.area.movement!.collectObjectsMaximumSizeRank = 2
  const object: Token = { id: 'loose', label: 'Loose object', type: 'obstacle', x: 175, y: 75,
    size: 1, color: '', emoji: '', dnd5eObjectState: { schemaVersion: 1, attached: false,
      wornOrCarried: false, animateObjects: { size: 'medium', mobility: 'walk', damageType: 'bludgeoning' } } }
  input.map.tokens.push(object)
  const before = structuredClone(input.map)
  const path = [{ x: 75, y: 75, elevationFeet: 0 }, { x: 175, y: 75, elevationFeet: 0 }]
  const moved = stageDnd5eSphereAreaContact({ ...input, areaId: input.area.id, path })
  expect(moved?.tokens.find(t => t.id === 'npc')).toMatchObject({ x: 175, y: 75 })
  expect(moved?.tokens.find(t => t.id === 'loose')).toMatchObject({ x: 275, y: 75,
    dnd5eObjectState: { areaCapture: { mapId: input.map.id, areaId: input.area.id, sourceTokenId: 'source' } } })
  expect(input.map).toEqual(before)
  object.dnd5eObjectState!.attached = true
  expect(stageDnd5eSphereAreaContact({ ...input, areaId: input.area.id, path })).toBeUndefined()
})
function fixture() {
  const effect = (id: string, areaId = 'carry') => createDnd5eConditionEffect({ id: `bind-${id}`, condition: 'restrained',
    targetId: id, source: { kind: 'plugin', actorId: 'source' }, duration: { type: 'permanent' }, tags: [`persistent-area:${areaId}`] })
  const source = normalizeCharacter({ id: 'source-char', name: 'Source', maxHp: 20, currentHp: 20 })
  const passenger = normalizeCharacter({ id: 'passenger-char', name: 'Passenger', maxHp: 20, currentHp: 20,
    dnd5eCombatState: { activeEffects: [effect('passenger-char')] } })
  const token = (id: string, x: number, y: number): Token => ({ id, label: id, type: 'npc', x, y, size: 1,
    color: '#fff', emoji: '', hp: 20, maxHp: 20 })
  const area: Dnd5ePluginArea = { id: 'carry', pluginId: 'test.carry', featureId: 'carry', label: 'Carry', color: '#fff',
    sourceTokenId: 'source', sourceCharacterId: source.id, anchorCell: { col: 1, row: 1 }, anchorMode: 'fixed',
    cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }, { col: 1, row: 2 }, { col: 2, row: 2 }],
    createdRound: 1, expiresAfterRound: 10, movement: { economy: 'action', maximumFeet: 30, carryRestrainedTargets: true },
    grantedActivities: [{ activityId: 'move-carry' }] }
  const map: BattleMap = { id: 'carry-map', name: 'Carry', width: 350, height: 250, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, dnd5ePluginAreas: [area], tokens: [
      { ...token('source', 25, 25), type: 'player', characterId: source.id },
      { ...token('npc', 75, 75), dnd5eCombatState: { activeEffects: [effect('npc')] } },
      { ...token('passenger', 125, 75), type: 'player', characterId: passenger.id },
      { ...token('unrelated', 75, 125), dnd5eCombatState: { activeEffects: [effect('unrelated', 'other-area')] } },
    ] }
  const action: SharedPlayerActionState = { id: 'move-carry', type: 'dnd5e-persistent-area-move', mapId: map.id,
    combatId: 'carry-combat', round: 1, initiativeIndex: 0, characterId: source.id, actorTokenId: 'source',
    sourceMode: 'player', status: 'pending', seq: 1, updatedAt: 1,
    dnd5ePersistentAreaMove: { areaId: area.id, targetCell: { col: 3, row: 1 } } }
  const characters = [source, passenger]
  const initiativeOrder = [{ tokenId: 'source', label: 'Source', emoji: '', color: '#fff', roll: 20 }]
  return { map, area, characters, action, initiativeOrder }
}

it('carries exact-instance NPC and character targets atomically without consuming their movement', () => {
  const input = fixture(), before = structuredClone(input)
  const prepared = prepareDnd5eCoreSpellAreaMove(input)
  expect(prepared.ok).toBe(true)
  if (!prepared.ok) throw Error(prepared.reason)
  expect(prepared.prepared.state.combatants.npc).toBeDefined()
  prepared.prepared.state.combatants.npc.classState.straightMovementStreak = {
    turnKey: 'carry-combat:1:source', end: { x: 75, y: 75 }, direction: { x: 1, y: 0 }, distanceFeet: 10 }
  const moved = resolvePreparedDnd5eCoreSpellAreaMove({ prepared: prepared.prepared })
  expect(moved.result.ok).toBe(true)
  for (const [id, x] of [['npc', 175], ['passenger', 225]] as const) {
    expect(moved.application!.map.tokens.find(token => token.id === id)).toMatchObject({ x, y: 75 })
    expect(moved.result.state.combatants[id].position).toEqual({ x, y: 75 })
    expect(moved.result.state.combatants[id].turn.movementRemaining).toBe(prepared.prepared.state.combatants[id].turn.movementRemaining)
  }
  expect(moved.result.events.filter(event => event.type === 'moved')).toHaveLength(2)
  expect(moved.result.state.combatants.npc.classState.straightMovementStreak).toBeUndefined()
  expect(moved.result.events).toContainEqual(expect.objectContaining({ type: 'moved', actorId: 'npc', movementKind: 'forced', distance: 10 }))
  expect(moved.result.state.combatants.source.turn.actionAvailable).toBe(false)
  expect(moved.application!.map.tokens.find(token => token.id === 'unrelated')!.x).toBe(75)
  expect(input).toEqual(before)
  const reloaded = migrateMapsState({ maps: JSON.parse(JSON.stringify([moved.application!.map])), selectedId: input.map.id })
  expect(reloaded.maps[0].dnd5ePluginAreas![0].movement?.carryRestrainedTargets).toBe(true)
})

it('carries bound creatures vertically through the authority command',()=>{
 const input=fixture()
 input.area.movement!.allowVertical=true
 input.area.vertical={mode:'volume',baseElevationFeet:0,heightFeet:10}
 input.action.dnd5ePersistentAreaMove!.targetCell={col:3,row:1}
 input.action.dnd5ePersistentAreaMove!.targetElevationFeet=5
 const prepared=prepareDnd5eCoreSpellAreaMove(input)
 expect(prepared.ok,prepared.ok?undefined:prepared.reason).toBe(true)
 if(!prepared.ok)throw Error(prepared.reason)
 const moved=resolvePreparedDnd5eCoreSpellAreaMove({prepared:prepared.prepared})
 expect(moved.result.ok).toBe(true)
 for(const id of ['npc','passenger'])expect(moved.application!.map.tokens.find(t=>t.id===id)?.elevationFeet).toBe(5)
 expect(moved.result.events).toContainEqual(expect.objectContaining({type:'moved',actorId:'npc',fromElevationFeet:0,toElevationFeet:5}))
})

it.each([0,10])('checks destination occupancy at the carried height, blocker at %i',elevationFeet=>{
 const input=fixture()
 input.area.movement!.allowVertical=true
 input.area.vertical={mode:'volume',baseElevationFeet:0,heightFeet:10}
 input.action.dnd5ePersistentAreaMove!.targetElevationFeet=10
 input.map.tokens.push({...input.map.tokens[1],id:'height-blocker',x:175,y:75,elevationFeet,dnd5eCombatState:undefined})
 const prepared=prepareDnd5eCoreSpellAreaMove(input)
 expect(prepared.ok).toBe(elevationFeet===0)
 if(prepared.ok){
  const moved=resolvePreparedDnd5eCoreSpellAreaMove({prepared:prepared.prepared})
  expect(moved.result.ok).toBe(true)
  const events=dnd5eActivityMapMovementEvents({before:input.map,after:moved.application!.map,actorId:'source',activityId:'carry',movements:[],carriedTargetIds:['npc','passenger']})
  expect(events).toContainEqual(expect.objectContaining({type:'moved',actorId:'npc',fromElevationFeet:0,toElevationFeet:10}))
 }
})

it('uses the supplied stepped path for carried body collision rather than its diagonal chord',()=>{
 const input=fixture()
 input.map.tokens=input.map.tokens.filter(t=>t.id!=='passenger')
 input.map.tokens.find(t=>t.id==='npc')!.elevationFeet=20
 input.area.movement!.allowVertical=true
 input.area.vertical={mode:'volume',baseElevationFeet:20,heightFeet:10}
 const nextArea={...input.area,anchorCell:{col:3,row:1},vertical:{mode:'volume' as const,baseElevationFeet:0,heightFeet:10}}
 const geometry=createEmptyMapGeometry(input.map.id,1)
 geometry.walls.push({id:'under-path',kind:'wall',label:'Wall',points:[{x:100,y:0},{x:100,y:250}],blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:10,heightFeet:10,createdAt:1})
 expect(planDnd5ePersistentAreaCarry({...input,nextArea,geometry})).toBeUndefined()
 const areaPath=[{x:75,y:75,elevationFeet:20},{x:150,y:75,elevationFeet:20},{x:150,y:75,elevationFeet:0},{x:175,y:75,elevationFeet:0}]
 expect(planDnd5ePersistentAreaCarry({...input,nextArea,geometry,areaPath})).toContainEqual(expect.objectContaining({targetId:'npc',toElevationFeet:0}))
 const wrong=areaPath.map((p,i)=>i===areaPath.length-1?{...p,elevationFeet:1}:p)
 expect(planDnd5ePersistentAreaCarry({...input,nextArea,geometry,areaPath:wrong})).toBeUndefined()
})

it('settles mandatory pit descent and both carried targets in one action',()=>{
 const input=fixture()
 input.area.movement={...input.area.movement!,allowVertical:true,maximumBottomHeightAboveGroundFeet:10,descendOverLowerGround:true}
 input.area.vertical={mode:'volume',baseElevationFeet:0,heightFeet:10}
 const geometry=createEmptyMapGeometry(input.map.id,1)
 geometry.obstacles.push({id:'pit',kind:'obstacle',label:'Pit',points:[{x:150,y:0},{x:350,y:0},{x:350,y:250},{x:150,y:250}],
  terrainRegion:true,terrainElevationFeet:-50,baseHeightFeet:-50,heightFeet:0,cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
 const before=structuredClone(input)
 const ready=prepareDnd5eCoreSpellAreaMove({...input,geometry})
 expect(ready.ok,ready.ok?undefined:ready.reason).toBe(true)
 if(!ready.ok)throw Error(ready.reason)
 const moved=resolvePreparedDnd5eCoreSpellAreaMove({prepared:ready.prepared})
 expect(moved.result.ok,moved.result.ok?undefined:moved.result.reason).toBe(true)
 expect(moved.application!.map.dnd5ePluginAreas![0].vertical).toMatchObject({baseElevationFeet:-40})
 for(const id of ['npc','passenger'])expect(moved.application!.map.tokens.find(t=>t.id===id)?.elevationFeet).toBe(-40)
 expect(moved.result.state.combatants.source.turn.actionAvailable).toBe(false)
 expect(input).toEqual(before)
})

it.each(['occupied', 'wall'] as const)('rejects the complete command when a passenger is blocked: %s', blocked => {
  const input = fixture()
  if (blocked === 'occupied') input.map.tokens.push({ ...input.map.tokens[1], id: 'blocker', x: 225, y: 75, dnd5eCombatState: undefined })
  const geometry = createEmptyMapGeometry(input.map.id, 1)
  if (blocked === 'wall') geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 150, y: 0 }, { x: 150, y: 250 }],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 20, createdAt: 1 })
  const before = structuredClone(input)
  expect(prepareDnd5eCoreSpellAreaMove({ ...input, geometry })).toMatchObject({ ok: false, reason: 'movement-blocked' })
  expect(input).toEqual(before)
})

it('rechecks placement at commit and refuses unimplemented vertical carry', () => {
  const input = fixture(), prepared = prepareDnd5eCoreSpellAreaMove(input)
  if (!prepared.ok) throw Error(prepared.reason)
  prepared.prepared.map.tokens.push({ ...input.map.tokens[1], id: 'new-blocker', x: 225, y: 75, dnd5eCombatState: undefined })
  const before = structuredClone(prepared.prepared)
  const rejected = resolvePreparedDnd5eCoreSpellAreaMove({ prepared: prepared.prepared })
  expect(rejected.result).toMatchObject({ ok: false, state: before.state, events: [] })
  expect(rejected.application).toBeUndefined()
  expect(prepared.prepared).toEqual(before)
  expect(planDnd5ePersistentAreaCarry({ ...fixture(), nextArea: { ...input.area,
    vertical: { mode: 'volume', baseElevationFeet: 10, heightFeet: 10 } } })).toBeUndefined()
})

it('includes carried targets in Activity handoff paths and forced movement events', () => {
  const input = fixture()
  const marker: Token = { id: 'destination', label: 'Destination', type: 'obstacle', obstacleKind: 'marker',
    x: 175, y: 75, size: 1, color: '', emoji: '' }
  input.map.tokens.push(marker)
  const applied = applyDnd5eActivityMapHandoffsV1({ map: input.map, characters: input.characters,
    activity: { schemaVersion: 1, id: 'move-carry', name: 'Move', activation: { kind: 'action' },
      target: { kind: 'self' }, outcomes: [], automation: automationCapabilityFromLegacyStatus('full') },
    packageId: 'test.carry', actionId: 'activity-move', actorId: 'source', round: 1,
    grantingPersistentAreaId: input.area.id, selection: {}, handoffs: { persistentAreas: [], summons: [], movements: [], invocations: [],
      areaRelocations: [{ kind: 'relocate-granting-area', operationId: 'relocate', targetId: marker.id, maximumFeet: 30 }] } })
  expect(applied.ok).toBe(true)
  if (!applied.ok) throw Error(applied.reason)
  expect(applied.carriedTargetIds).toEqual(['npc', 'passenger'])
  expect(applied.movementPaths.every(path => !path.provokesOpportunityAttacks)).toBe(true)
  const events = dnd5eActivityMapMovementEvents({ before: input.map, after: applied.map, actorId: 'source', activityId: 'move-carry',
    movements: [], carriedTargetIds: applied.carriedTargetIds })
  expect(events).toHaveLength(2)
  expect(events.every(event => event.type === 'moved' && event.movementKind === 'forced' && event.distance === 10)).toBe(true)
})

it('does not infer carry ownership from legacy or suspended restraints and refuses incomplete character authority', () => {
  const input = fixture()
  input.map.tokens[1].dnd5eCombatState!.activeEffects![0].suspendedBy = ['antimagic']
  input.characters[1].dnd5eCombatState!.activeEffects![0].tags = undefined
  const nextArea = { ...input.area, anchorCell: { col: 3, row: 1 } }
  expect(planDnd5ePersistentAreaCarry({ ...input, nextArea })).toEqual([])
  expect(planDnd5ePersistentAreaCarry({ ...input, characters: [input.characters[0]], nextArea })).toBeUndefined()
})

it('checks the full large footprint and rejects unsupported automatic carry declarations on reload', () => {
  const input = fixture()
  input.map.tokens[1] = { ...input.map.tokens[1], size: 2, x: 100, y: 100 }
  expect(planDnd5ePersistentAreaCarry({ ...input, nextArea: { ...input.area, anchorCell: { col: 6, row: 1 } } })).toBeUndefined()
  for (const patch of [
    { movement: { ...input.area.movement, carryRestrainedTargets: false } },
    { anchorMode: 'source-token' },
    { lifecycle: { timing: 'source-turn-start', translateAwayFromSourceFeet: 10 } },
  ]) {
    const migrated = migrateMapsState({ maps: [{ ...input.map, dnd5ePluginAreas: [{ ...input.area, ...patch }] }] })
    expect(migrated.maps[0].dnd5ePluginAreas ?? []).toEqual([])
  }
})
