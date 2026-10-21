import { expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { createEmptyMapGeometry, mapGeometryPhysicalProjectileImpact, normalizeMapGeometry } from '../../lib/mapGeometry'
import { buildDnd5eMightyFortressShell, placeDnd5eMightyFortressShell, placeDnd5eMightyFortressKeep } from './mightyFortressStructure'
import { placeDnd5eStructureSections } from './structureGeometry'
import { dnd5eEntitySupportElevation } from './entitySupport'
import {findMapGeometryPath} from '../../lib/mapPathfinding'
import {prepareDnd5eStructureExpiry} from './structureExpiry'
import {validateGeometryStructure} from '../../../shared/map-geometry-kernel.mjs'
import {normalizeFortressServices,createFortressServants} from '../../../shared/fortress-services.mjs'
import {dnd5eFortressMovementLevels} from './fortressMovementLevels'
import {prepareDnd5eFortressServantMove} from './fortressServantMove'

it('offers surviving floor and stair heights and walks a servant up a flight in bounded commands',()=>{
 const worker={id:'worker',type:'obstacle' as const,obstacleKind:'marker',label:'Worker',color:'',emoji:'',size:1,x:525,y:575,elevationFeet:0,hp:1,
  dnd5eObjectState:{schemaVersion:1 as const,structureBinding:{schemaVersion:1 as const,mapId:'stairs',structureId:'keep'}}}
 const commander={id:'caster',type:'enemy' as const,label:'Caster',color:'',emoji:'',size:1,x:25,y:25,hp:10}
 const map:BattleMap={id:'stairs',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[worker,commander]}
 const {geometry}=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,
  towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:0},
  stairs:[{id:'first',from:{x:42.5,y:47.5,elevationFeet:0},to:{x:62.5,y:47.5,elevationFeet:10.5},widthFeet:5,thicknessInches:6}],
  stairOpenings:[0,1,2].map(column=>({level:2 as const,column,row:1}))})
 geometry.structureLifetimes![0].fortressServices!.servants![0].tokenId='worker'
 expect(dnd5eFortressMovementLevels(geometry,'keep',0).map(level=>level.elevationFeet)).toEqual([0,5.25,10.5,21,30,31.5])
 const input={map,geometry,commanderTokenId:'caster',servantTokenId:'worker',worldMinute:1}
 const first=prepareDnd5eFortressServantMove({...input,expectedPosition:{x:525,y:575,elevationFeet:0},destination:{x:625,y:575,elevationFeet:5.25}})
 if(!first.ok)throw Error(first.reason)
 expect(first.path.movementCostFeet).toBeLessThanOrEqual(15)
 const second=prepareDnd5eFortressServantMove({...input,map:first.map,expectedPosition:{x:625,y:575,elevationFeet:5.25},destination:{x:725,y:575,elevationFeet:10.5}})
 if(!second.ok)throw Error(second.reason)
 expect(second.map.tokens[0]).toMatchObject({x:725,y:575,elevationFeet:10.5})
 const broken={...geometry,obstacles:geometry.obstacles.map(entity=>entity.label==='keep-level-2'?{...entity,dnd5eDurability:{...entity.dnd5eDurability!,hitPoints:0}}:entity)}
 expect(dnd5eFortressMovementLevels(broken,'keep',0).find(level=>level.elevationFeet===10.5)?.label).toBe('楼梯')
 expect(map.tokens[0].elevationFeet).toBe(0)
})

it('preserves the hundred distinct servants and their assignments without accepting malformed or shared state',()=>{
 const services={authorizedCreatureIds:['guest'],mealDay:0,mealsServed:0,mealReceipts:[],servants:createFortressServants()}
 services.servants[99].assignment={actorId:'guest',instruction:'清理餐桌'}
 const reloaded=normalizeFortressServices(JSON.parse(JSON.stringify(services)))!
 expect(reloaded.servants).toHaveLength(100)
 expect(reloaded.servants![99]).toEqual({number:100,assignment:{actorId:'guest',instruction:'清理餐桌'}})
 reloaded.servants![99].assignment!.instruction='整理床铺'
 expect(services.servants[99].assignment!.instruction).toBe('清理餐桌')
 expect(createFortressServants()[99].assignment).toBeUndefined()
 const duplicateEntities=services.servants.map(servant=>({...servant,tokenId:'same-entity'}))
 expect(normalizeFortressServices({...services,servants:duplicateEntities})).toBeUndefined()
 expect(normalizeFortressServices({...services,servants:services.servants.slice(1)})).toBeUndefined()
 expect(normalizeFortressServices({...services,servants:services.servants.map(()=>({number:1}))})).toBeUndefined()
 expect(normalizeFortressServices({...services,servants:services.servants.map(s=>({...s,attack:true}))})).toBeUndefined()
 expect(normalizeFortressServices({...services,servants:services.servants.map(s=>({...s,assignment:{actorId:'guest',instruction:' '}}))})).toBeUndefined()
})

it('persists exact building ownership and prepares harmless seven-day expiry without removing unrelated structures',()=>{
 const token={id:'resident',type:'enemy' as const,label:'Resident',color:'',emoji:'',size:1,x:600,y:600,elevationFeet:10.5,hp:12,maxHp:20}
 const map:BattleMap={id:'expiry',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[token,{...token,id:'flying',elevationFeet:50},{...token,id:'ground',elevationFeet:0},
   {...token,id:'wall-resident',x:600,y:105,size:0.1,elevationFeet:20}]}
 const generated=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},
  rotationDegrees:0,elevationFeet:0,createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:100}}).geometry
 generated.obstacles.push({...generated.obstacles[0],id:'keep:unrelated',points:generated.obstacles[0].points.map(p=>({x:p.x+1400,y:p.y}))})
 const geometry=normalizeMapGeometry(JSON.parse(JSON.stringify(generated)))!
 expect(geometry.structureLifetimes![0].fortressServices!.servants).toHaveLength(100)
 expect(geometry.obstacles.filter(o=>o.label?.startsWith('outer-')).every(o=>o.surfaceMaterial==='stone')).toBe(true)
 const rotated=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'rotated',origin:{x:1300,y:100},
  rotationDegrees:90,elevationFeet:0,createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:100}}).geometry
 expect(rotated.structureLifetimes![0].siteKey).toBe(geometry.structureLifetimes![0].siteKey)
 expect(geometry.structureLifetimes?.[0]).toMatchObject({expiresWorldMinute:10180,casterId:'caster'})
 expect(validateGeometryStructure(geometry)).toEqual([])
 const before=structuredClone(geometry)
 expect(prepareDnd5eStructureExpiry(map,geometry,10179).changed).toBe(false)
 const expired=prepareDnd5eStructureExpiry(map,geometry,10180)
 expect(expired.geometry.structureLifetimes??[]).toEqual([])
 expect(expired.geometry.obstacles.map(o=>o.id)).toEqual(['keep:unrelated'])
 expect(expired.map.tokens.map(t=>[t.id,t.elevationFeet,t.hp])).toEqual([['resident',0,12],['flying',50,12],['ground',0,12],['wall-resident',0,12]])
 expect(prepareDnd5eStructureExpiry(expired.map,expired.geometry,10180).changed).toBe(false)
 expect(geometry).toEqual(before)
 const duplicate={...geometry,structureLifetimes:[...geometry.structureLifetimes!,{...geometry.structureLifetimes![0],id:'other'}]}
 expect(normalizeMapGeometry(duplicate)).toBeUndefined()
 expect(validateGeometryStructure(duplicate)).toContainEqual({code:'invalid-structure-lifetimes'})
 const permanent={...geometry,structureLifetimes:geometry.structureLifetimes!.map(record=>({...record,expiresWorldMinute:null}))}
 expect(prepareDnd5eStructureExpiry(map,permanent,1000000).changed).toBe(false)
})

it('walks from the keep ground floor through its stair opening onto the second floor',()=>{
 const token={id:'walker',type:'enemy' as const,label:'Walker',color:'',emoji:'',size:1,x:525,y:575,elevationFeet:0}
 const map:BattleMap={id:'stairs-keep',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token]}
 const input={map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,
  towerThicknessInches:12,floorThicknessInches:6,
  stairs:[{id:'first',from:{x:42.5,y:47.5,elevationFeet:0},to:{x:62.5,y:47.5,elevationFeet:10.5},widthFeet:5,thicknessInches:6}]}
 const {geometry}=placeDnd5eMightyFortressKeep({...input,stairOpenings:[0,1,2].map(column=>({level:2 as const,column,row:1}))})
 const path=findMapGeometryPath({map,geometry,token,to:{x:775,y:575},targetElevationFeet:10.5})
 expect(path).toBeDefined()
 expect(path!.elevationsFeet?.at(-1)).toBe(10.5)
 const sealed=placeDnd5eMightyFortressKeep(input).geometry
 const blocked=findMapGeometryPath({map,geometry:sealed,token,to:{x:775,y:575},targetElevationFeet:10.5})
 expect(blocked).toBeUndefined()
})

it('composes walls and floors with ten feet of clear space on every story',()=>{
  const map:BattleMap={id:'keep',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
  const input={map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:5,createdAt:1,
    towerThicknessInches:12,floorThicknessInches:6,stairOpenings:[{level:2 as const,column:1,row:1},{level:3 as const,column:1,row:1}]}
  const {geometry,levelElevationsFeet}=placeDnd5eMightyFortressKeep(input)
  expect(levelElevationsFeet).toEqual([5,15.5,26])
  const floors=geometry.obstacles.filter(o=>o.id.includes(':floor:'))
  expect(floors).toHaveLength(89)
  for(let index=0;index<3;index++){
    const label=index===2?'keep-roof':`keep-level-${index+2}`
    expect(floors.find(o=>o.label===label)!.baseHeightFeet-levelElevationsFeet[index]).toBe(10)
  }
  expect(Math.max(...geometry.obstacles.filter(o=>o.label.startsWith('keep-')&&!o.id.includes(':floor:')).map(o=>o.baseHeightFeet+o.heightFeet))).toBe(36.5)
  const token={id:'actor',label:'Actor',type:'enemy' as const,color:'',emoji:'',size:1,x:600,y:700}
  expect(dnd5eEntitySupportElevation({map,geometry,token,terrainElevationFeet:5,elevationFeet:26})).toBe(26)
  expect(input.geometry.obstacles).toHaveLength(0)
  expect(()=>placeDnd5eMightyFortressKeep({...input,floorThicknessInches:0})).toThrow('fortress-floor-thickness-required')
  expect(()=>placeDnd5eMightyFortressKeep({...input,stairOpenings:[{level:2,column:8,row:0}]})).toThrow('structure-floor-opening-invalid')
})

it('places the complete structural shell within 120 feet with independent defenses and vertical sections', () => {
  const sections = buildDnd5eMightyFortressShell({ towerThicknessInches: 12 })
  expect(new Set(sections.map(section => section.wallId)).size).toBe(24)
  expect(sections.filter(section => section.wallId.startsWith('outer-'))).toHaveLength(64)
  expect(sections.filter(section => section.wallId.startsWith('keep-')).every(section => section.maxHp === 180)).toBe(true)
  expect(new Set(sections.filter(section => section.wallId === 'keep-north').map(section => section.bottomFeet))).toEqual(new Set([0, 10, 20]))
  const map: BattleMap = { id: 'fortress', name: 'Fortress', width: 2000, height: 2000, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [] }
  const geometry = normalizeMapGeometry(JSON.parse(JSON.stringify(placeDnd5eStructureSections({ map,
    geometry: createEmptyMapGeometry(map.id, 1), structureId: 'fortress-cast', sections,
    origin: { x: 100, y: 100 }, rotationDegrees: 0, elevationFeet: 0, createdAt: 1 }))))!
  const points = geometry.obstacles.flatMap(obstacle => obstacle.points)
  expect(Math.min(...points.map(point => point.x))).toBe(100)
  expect(Math.max(...points.map(point => point.x))).toBe(1300)
  expect(Math.min(...points.map(point => point.y))).toBe(100)
  expect(Math.max(...points.map(point => point.y))).toBe(1300)
  const ray = (x: number, y1: number, y2: number, elevationFeet: number) => mapGeometryPhysicalProjectileImpact({ map, geometry,
    from: { x, y: y1 }, to: { x, y: y2 }, elevationFeet })
  expect(ray(700, 50, 200, 5)?.entityId).toContain('outer-north')
  expect(ray(700, 50, 200, 25)).toBeUndefined()
  expect(ray(200, 50, 200, 25)?.entityId).toContain('tower-nw')
  expect(ray(700, 400, 500, 25)?.entityId).toContain('keep-north')
  expect(ray(700, 400, 500, 35)).toBeUndefined()
})

it('requires an explicit viable tower thickness, keeping tower HP independent of the other walls', () => {
  for (const towerThicknessInches of [undefined, NaN, 0, -1, 120]) {
    expect(() => buildDnd5eMightyFortressShell({ towerThicknessInches: towerThicknessInches as number })).toThrow('fortress-tower-thickness-required')
  }
  const sections = buildDnd5eMightyFortressShell({ towerThicknessInches: 18 })
  expect(sections.filter(section => section.wallId.startsWith('tower-')).every(section => section.maxHp === 540)).toBe(true)
  expect(sections.filter(section => section.wallId.startsWith('outer-')).every(section => section.maxHp === 360)).toBe(true)
})

it('limits exterior doors to four, supports keep arches, and rotates doors with the structure', () => {
  const map: BattleMap = { id:'fortress',name:'Fortress',width:2000,height:2000,gridSize:50,feetPerCell:5,
    gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[] }
  const input = { map,geometry:createEmptyMapGeometry(map.id,1),structureId:'fortress',towerThicknessInches:12,
    origin:{x:1500,y:100},rotationDegrees:90,elevationFeet:0,createdAt:1 }
  const openings = ['north','south','west','east'].map(side=>({ sectionId:`outer-${side}.0.3`,kind:'door' as const,open:true }))
  const geometry = placeDnd5eMightyFortressShell({...input,openings:[...openings,{sectionId:'keep-north.0.2',kind:'arch'}]})
  expect(geometry.doors).toHaveLength(4)
  expect(geometry.doors[0].points[0].x).toBeCloseTo(1495)
  expect(geometry.doors[0].points[0].y).toBeCloseTo(600)
  expect(mapGeometryPhysicalProjectileImpact({map,geometry,from:{x:1550,y:650},to:{x:1400,y:650},elevationFeet:5})).toBeUndefined()
  expect(mapGeometryPhysicalProjectileImpact({map,geometry,from:{x:1550,y:650},to:{x:1400,y:650},elevationFeet:15})?.entityId).toContain('outer-north.1.3')
  for (const extra of [{sectionId:'outer-north.0.4',kind:'door' as const},
    {sectionId:'outer-north.1.4',kind:'door' as const},{sectionId:'outer-north.0.4',kind:'arch' as const}]) {
    expect(()=>placeDnd5eMightyFortressShell({...input,openings:[...openings,extra]})).toThrow('fortress-outer-door-invalid')
  }
  expect(input.geometry.obstacles).toHaveLength(0)
  expect(input.geometry.doors).toHaveLength(0)
  expect(placeDnd5eMightyFortressShell({...input,openings:[{sectionId:'outer-north.1.4',kind:'door'}]}).doors[0].baseHeightFeet).toBe(10)
  expect(()=>placeDnd5eMightyFortressShell({...input,openings:[{sectionId:'outer-north.0.4',kind:'arch'}]})).toThrow('fortress-outer-door-invalid')
})
