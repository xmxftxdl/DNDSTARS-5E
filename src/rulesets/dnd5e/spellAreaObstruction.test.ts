import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { resolveDnd5eActivityAreaMapSelectionV1 } from './activities/dnd5eActivityMapInteraction'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { BattleMap, Token } from '../../store/maps'
import { resolveSpellAreaObstruction, dnd5eAreaPlacementMatchesSurface } from './spellAreaObstruction'

const map = { id: 'obstruction', gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, width: 500, height: 500, tokens: [] } as unknown as BattleMap
const target = { id: 'target', x: 175, y: 125, elevationFeet: 0, size: 1, type: 'enemy' } as Token
it('accepts only explicitly outdoor uncovered sky above the authored ground',()=>{
 const geometry=createEmptyMapGeometry(map.id)
 const sky={kind:'area' as const,origin:'point' as const,shape:'rect' as const,relation:'any' as const,
  placementSurface:'sky' as const,requiresLineOfSight:true}
 const matches=(elevationFeet?:number)=>dnd5eAreaPlacementMatchesSurface({target:sky,geometry,point:{x:50,y:50},elevationFeet})
 expect(matches(50)).toBe(false)
 geometry.environment='outdoors'
 expect(matches()).toBe(false);expect(matches(0)).toBe(false);expect(matches(-5)).toBe(false)
 expect(matches(50)).toBe(true)
 geometry.overheadSpace='confined';expect(matches(50)).toBe(false);geometry.overheadSpace='open'
 geometry.obstacles.push({id:'roof',kind:'obstacle',label:'Roof',points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
  baseHeightFeet:60,heightFeet:5,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total',createdAt:1})
 expect(matches(50)).toBe(false);expect(matches(62)).toBe(false);expect(matches(70)).toBe(true)
 geometry.environment='indoors';expect(matches(70)).toBe(false)
 geometry.obstacles.push({id:'courtyard',kind:'obstacle',label:'Courtyard',terrainRegion:true,skyExposure:'open',
  points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],baseHeightFeet:0,heightFeet:0,
  blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,cover:'none',createdAt:2})
 expect(matches(70)).toBe(true)
 expect(matches(50)).toBe(false) // An explicit region cannot erase the actual roof.
 expect(dnd5eAreaPlacementMatchesSurface({target:sky,geometry,point:{x:150,y:50},elevationFeet:70})).toBe(false)
 geometry.obstacles.push({...geometry.obstacles[1],id:'covered',skyExposure:'covered'})
 expect(matches(70)).toBe(false)
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'sky',name:'Sky',activation:{kind:'action'},
  automation:automationCapabilityFromLegacyStatus('full'),target:{...sky,widthFeet:10,lengthFeet:5,heightFeet:5,placeRangeFeet:10000},
  outcomes:[{id:'write',when:{kind:'always'},operations:[{id:'cloud',kind:'create-persistent-area',label:'Cloud',durationRounds:600,concentration:true,visual:{preset:'cloud-text'}}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(validateDnd5eActivityDefinitionV1({...activity,target:{...activity.target,requiresLineOfSight:false} as typeof sky}))
  .toContain('activity.target.placementSurface sky requires line of sight')
})
function setup(spellId = 'shatter', height = 20) {
  const geometry = createEmptyMapGeometry(map.id)
  geometry.walls.push({ id: 'wall', kind: 'wall', label: 'wall', points: [{ x: 100, y: 0 }, { x: 100, y: 500 }],
    baseHeightFeet: 0, heightFeet: height, blocksVision: false, blocksMovement: true, blocksLineOfEffect: true, createdAt: 0 })
  const cells = Array.from({ length: 36 }, (_, i) => ({ col: i % 6, row: Math.floor(i / 6) }))
  const input = { spellId, map, geometry, cells, area: { shape: 'circle' as const, origin: 'point' as const, radiusFeet: 25 }, origin: { x: 75, y: 125 }, elevationFeet: 0 }
  return { geometry, input }
}
describe('shared spell obstruction', () => {
  it('distinguishes opaque physical cover from glass and vision-only barriers',()=>{
    for(const vision of [false,true])for(const physical of [false,true]){
      const {input,geometry}=setup()
      Object.assign(geometry.walls[0],{blocksVision:vision,blocksLineOfEffect:physical})
      const result=resolveSpellAreaObstruction({...input,propagationCover:'opaque-only'})
      expect(result.affectsToken(target)).toBe(!(vision&&physical))
      expect(result.cells.some(cell=>cell.col===3&&cell.row===2)).toBe(!(vision&&physical))
    }
    const {input,geometry}=setup()
    geometry.walls.push({...geometry.walls[0],id:'fog',blocksVision:true,blocksLineOfEffect:false,
      points:[{x:150,y:0},{x:150,y:500}]})
    expect(resolveSpellAreaObstruction({...input,propagationCover:'opaque-only'}).affectsToken(target)).toBe(true)
  })
  it('updates opaque cover for open doors and rays passing above a low barrier',()=>{
    const {input,geometry}=setup()
    const wall=geometry.walls.pop()!
    geometry.doors.push({...wall,kind:'door',points:[wall.points[0],wall.points[1]],blocksVision:true,state:'closed',openState:'closed',secret:false})
    const resolve=()=>resolveSpellAreaObstruction({...input,propagationCover:'opaque-only'})
    expect(resolve().affectsToken(target)).toBe(false)
    geometry.doors[0].state='open';geometry.doors[0].openState='open'
    expect(resolve().affectsToken(target)).toBe(true)
    geometry.doors[0].state='closed';geometry.doors[0].openState='closed';geometry.doors[0].heightFeet=5
    expect(resolveSpellAreaObstruction({...input,propagationCover:'opaque-only',elevationFeet:15})
      .affectsToken({...target,elevationFeet:15})).toBe(true)
  })
  it('applies the same opaque-cover policy to persistent magical barriers',()=>{
    for(const vision of [false,true])for(const lineOfEffect of [false,true]){
      const {input,geometry}=setup()
      geometry.walls=[]
      const area={id:'barrier',pluginId:'test',featureId:'barrier',sourceTokenId:'caster',sourceCharacterId:'caster',
        label:'Barrier',color:'#fff',createdRound:1,expiresAfterRound:10,anchorCell:{col:2,row:2},
        cells:[{col:2,row:2}],blocking:{vision,lineOfEffect,movement:true},
        vertical:{mode:'volume' as const,baseElevationFeet:0,heightFeet:20}}
      const board={...map,dnd5ePluginAreas:[area]}
      expect(resolveSpellAreaObstruction({...input,map:board,propagationCover:'opaque-only'}).affectsToken(target)).toBe(!(vision&&lineOfEffect))
    }
  })
  it('uses opaque propagation from the selected origin while retaining physical placement restrictions',()=>{
    const {geometry}=setup()
    const caster={...target,id:'caster',x:25,y:125,type:'player' as const}
    const board={...map,tokens:[caster,target]}
    const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'light-pulse',name:'Light pulse',activation:{kind:'action'},
      automation:automationCapabilityFromLegacyStatus('full'),
      target:{kind:'area',origin:'point',shape:'sphere',radiusFeet:20,placeRangeFeet:150,relation:'any',includeSelf:true,propagationCover:'opaque-only'},
      outcomes:[{id:'damage',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',damageType:'radiant',amount:{kind:'constant',value:1}}]}]}
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const select=(col=1)=>resolveDnd5eActivityAreaMapSelectionV1({activity:JSON.parse(JSON.stringify(activity)),map:board,actorToken:caster,anchorCell:{col,row:2}})
    try{
      setMapGeometryRuntime([geometry])
      expect(select()!.targetIds).toContain('target')
      expect(select(3)).toBeUndefined()
      geometry.walls[0].blocksVision=true;setMapGeometryRuntime([geometry])
      expect(select()!.targetIds).not.toContain('target')
    }finally{setMapGeometryRuntime([])}
  })
  it('carries a JSON-imported corner declaration into actual Activity map targeting',()=>{
    const {geometry}=setup('local.smoke:smoke')
    const caster={...target,id:'caster',x:25,y:125,type:'player' as const}
    const board={...map,tokens:[caster,target]}
    const activity:Dnd5eActivityDefinitionV1=JSON.parse(JSON.stringify({schemaVersion:1,id:'smoke',name:'Smoke',activation:{kind:'action'},
      automation:automationCapabilityFromLegacyStatus('full'),
      target:{kind:'area',origin:'point',shape:'circle',radiusFeet:25,placeRangeFeet:60,relation:'any',includeSelf:true,spreadsAroundCorners:true},
      outcomes:[{id:'smoke',when:{kind:'always'},operations:[{id:'area',kind:'create-persistent-area',label:'Smoke',durationRounds:10,concentration:false,obscuration:{kind:'heavy'}}]}]}))
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const select=()=>resolveDnd5eActivityAreaMapSelectionV1({activity,map:board,actorToken:caster,anchorCell:{col:1,row:2}})!
    try{
      setMapGeometryRuntime([geometry])
      expect(select().cells.some(c=>c.col===3&&c.row===2)).toBe(false)
      geometry.walls[0].points[1].y=160
      setMapGeometryRuntime([geometry])
      expect(select().cells.some(c=>c.col===3&&c.row===2)).toBe(true)
      if(activity.target.kind!=='area')throw Error('area expected')
      activity.target.spreadsAroundCorners=false
      expect(select().cells.some(c=>c.col===3&&c.row===2)).toBe(false)
      Object.assign(activity.target,{spreadsAroundCorners:'yes'})
      expect(validateDnd5eActivityDefinitionV1(activity).some(e=>e.includes('spreadsAroundCorners'))).toBe(true)
    }finally{setMapGeometryRuntime([])}
  })
  it('blocks effects through a transparent physical wall', () => {
    const { input } = setup()
    const result = resolveSpellAreaObstruction(input)
    expect(result.affectsToken(target)).toBe(false)
    expect(result.cells.some(cell => cell.col > 1)).toBe(false)
  })
  it('does not confuse fog-like vision blocking with physical effect blocking', () => {
    const { input, geometry } = setup()
    geometry.walls[0].blocksVision = true
    geometry.walls[0].blocksLineOfEffect = false
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(true)
  })
  it('allows elevated effects over a low wall', () => {
    const { input } = setup('shatter', 5)
    expect(resolveSpellAreaObstruction({ ...input, elevationFeet: 15 }).affectsToken({ ...target, elevationFeet: 15 })).toBe(true)
  })
  it('recomputes obstruction when a door opens', () => {
    const { input, geometry } = setup()
    const wall = geometry.walls.pop()!
    geometry.doors.push({ ...wall, points: [wall.points[0], wall.points[1]], kind: 'door', state: 'closed', openState: 'closed', secret: false })
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(false)
    geometry.doors[0].state = 'open'
    geometry.doors[0].openState = 'open'
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(true)
  })
  it('spreads only explicitly permitted spells around a reachable corner', () => {
    const { input, geometry } = setup('fireball')
    geometry.walls[0].points[1].y = 160
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(true)
    expect(resolveSpellAreaObstruction({ ...input, spellId: 'shatter' }).affectsToken(target)).toBe(false)
    expect(resolveSpellAreaObstruction({ ...input, area: { ...input.area, radiusFeet: 5 } }).affectsToken(target)).toBe(false)
  })
  it('does not spread through a sealed wall, and honors explicit wall exceptions', () => {
    const { input } = setup('fireball')
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(false)
    expect(resolveSpellAreaObstruction({ ...input, ignoresWalls: true }).affectsToken(target)).toBe(true)
  })
  it('lets an imported area declare corner spread without pretending to be a core spell', () => {
    const {input,geometry}=setup('local.smoke:smoke')
    expect(resolveSpellAreaObstruction({...input,spreadsAroundCorners:true}).affectsToken(target)).toBe(false)
    geometry.walls[0].points[1].y=160
    expect(resolveSpellAreaObstruction({...input,spreadsAroundCorners:true}).affectsToken(target)).toBe(true)
    expect(resolveSpellAreaObstruction(input).affectsToken(target)).toBe(false)
    expect(resolveSpellAreaObstruction({...input,spreadsAroundCorners:true,area:{...input.area,radiusFeet:5}}).affectsToken(target)).toBe(false)
  })
})

it.each([false, true])('filters a declared vertical extent even when ignoring walls=%s', ignoresWalls => {
  const { input } = setup()
  const result = resolveSpellAreaObstruction({ ...input, geometry: undefined, elevationFeet: 10, heightFeet: 5, ignoresWalls })
  expect(result.affectsToken({ ...target, elevationFeet: 0 })).toBe(false)
  expect(result.affectsToken({ ...target, elevationFeet: 12 })).toBe(true)
  expect(result.affectsToken({ ...target, elevationFeet: 30 })).toBe(false)
  expect(result.affectsToken({ ...target, elevationFeet: 8 })).toBe(true)
})

it('checks ground placement against elevated terrain rather than absolute zero', async () => {
  const { dnd5eAreaPlacementMatchesSurface } = await import('./spellAreaObstruction')
  const geometry = createEmptyMapGeometry(map.id)
  geometry.obstacles.push({ id: 'plateau', kind: 'obstacle', label: 'Plateau', points: [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none', baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20, createdAt: 1 })
  const target = { kind: 'area' as const, relation: 'any' as const, origin: 'point' as const, shape: 'rect' as const, maximumTargets: 1, placementSurface: 'ground' as const }
  const matches = (elevationFeet?: number) => dnd5eAreaPlacementMatchesSurface({ target, geometry, point: { x: 50, y: 50 }, elevationFeet })
  expect(matches()).toBe(true)
  expect(matches(20)).toBe(true)
  expect(matches(0)).toBe(false)
  expect(matches(25)).toBe(false)
  expect(matches(Number.NaN)).toBe(false)
})


it.each(['ground', 'swim'] as const)('places a shallow volume on authored %s surface and excludes creatures above it', async traversal => {
  const { dnd5eAreaPlacementMatchesSurface } = await import('./spellAreaObstruction')
  const geometry = createEmptyMapGeometry(map.id)
  geometry.obstacles.push({id:'surface',kind:'obstacle',label:'Surface',points:[{x:0,y:0},{x:400,y:0},{x:400,y:400},{x:0,y:400}],
    blocksVision:false,blocksMovement:false,blocksLineOfEffect:false,cover:'none',baseHeightFeet:0,heightFeet:0,
    terrainRegion:true,traversal,terrainElevationFeet:20,createdAt:1})
  const declared = {kind:'area' as const,relation:'any' as const,origin:'point' as const,shape:'cylinder' as const,
    placementSurface:'ground' as const,radiusFeet:30,heightFeet:5,includeSelf:true}
  const matches = (elevationFeet?:number) => dnd5eAreaPlacementMatchesSurface({target:declared,geometry,point:{x:175,y:125},elevationFeet})
  expect(matches()).toBe(true)
  expect(matches(20)).toBe(true)
  expect(matches(0)).toBe(false)
  expect(matches(25)).toBe(false)
  const volume = resolveSpellAreaObstruction({map,geometry,cells:[{col:3,row:2}],area:{shape:'circle',origin:'point',radiusFeet:30},
    origin:{x:175,y:125},elevationFeet:20,heightFeet:5})
  expect(volume.affectsToken({...target,elevationFeet:20})).toBe(true)
  expect(volume.affectsToken({...target,elevationFeet:24})).toBe(true)
  expect(volume.affectsToken({...target,elevationFeet:30})).toBe(false)
})
it('does not cast tilted-area obstruction rays from the empty bounding-box bottom',()=>{
 const geometry=createEmptyMapGeometry(map.id)
 geometry.walls=[{id:'low',kind:'wall',label:'Low wall',points:[{x:130,y:0},{x:130,y:500}],baseHeightFeet:0,heightFeet:15,blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:0}]
 const caster={...target,id:'caster',x:125,y:25,elevationFeet:30,type:'player' as const}
 const victim={...target,x:175,y:125,elevationFeet:35}
 const board={...map,tokens:[caster,victim]}
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'tilted-light',name:'Tilted light',activation:{kind:'action'},automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'area',origin:'point',shape:'rect',relation:'any',widthFeet:5,lengthFeet:60,heightFeet:10,placeRangeFeet:120,rotatable:true,tiltable:true},outcomes:[]}
 try{
  setMapGeometryRuntime([geometry])
  const selection=resolveDnd5eActivityAreaMapSelectionV1({activity,map:board,actorToken:caster,anchorCell:{col:2,row:2},rectAngleDegrees:90,rectPitchDegrees:90,targetElevationFeet:30})
  expect(selection?.targetIds,JSON.stringify(selection)).toContain('target')
  expect(selection?.cells.some(c=>c.col===3&&c.row===2)).toBe(true)
  geometry.walls[0].heightFeet=100;setMapGeometryRuntime([geometry])
  const blocked=resolveDnd5eActivityAreaMapSelectionV1({activity,map:board,actorToken:caster,anchorCell:{col:2,row:2},rectAngleDegrees:90,rectPitchDegrees:90,targetElevationFeet:30})
  expect(blocked?.targetIds).not.toContain('target')
 }finally{setMapGeometryRuntime([])}
})
