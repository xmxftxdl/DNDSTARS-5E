import { afterEach,expect,it } from 'vitest'
import { createEmptyMapGeometry,mapGeometryTerrainElevationAtPoint,setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap,Token } from '../../store/maps'
import { placeDnd5eStructureFloors } from './structureFloors'
import { dnd5eEntitySupportElevation } from './entitySupport'
import { damageGeometryEntity } from '../../../shared/map-geometry-durability.mjs'
import { createDnd5eMapCombatSnapshot,refreshDnd5eMapSpatialRelations } from './mapBridge'
import { previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange } from './headlessCombatEngine'
import { findMapGeometryPath,createMapGeometryPathTree } from '../../lib/mapPathfinding'

afterEach(()=>setMapGeometryRuntime([]))

it('creates independently destructible floor panels without lifting lower-floor occupants, leaving stair openings',()=>{
  const map:BattleMap={id:'floors',name:'Floors',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
  const input={map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,
    floors:[{id:'level2',x:0,y:0,widthFeet:20,depthFeet:20,topFeet:10.5,thicknessInches:6,openings:[{column:1,row:1}]}]}
  const geometry=placeDnd5eStructureFloors(input)
  expect(geometry.obstacles).toHaveLength(3)
  expect(geometry.obstacles[0]).toMatchObject({baseHeightFeet:10,heightFeet:0.5,dnd5eDurability:{hitPoints:180,armorClass:15}})
  const token:Token={id:'actor',type:'enemy',label:'Actor',color:'',emoji:'',size:1,x:150,y:150}
  const support=(elevationFeet:number,x=150,y=150)=>dnd5eEntitySupportElevation({map,geometry,token:{...token,x,y},elevationFeet,terrainElevationFeet:0})
  expect(mapGeometryTerrainElevationAtPoint(geometry,token)).toBe(0)
  expect(support(0)).toBe(0)
  expect(support(10.5)).toBe(10.5)
  expect(support(10.5,200,150)).toBe(10.5)
  expect(support(10.5,250,250)).toBe(0)
  const walker={...token,size:2,elevationFeet:10.5}
  const pathInput={map,geometry,token:walker}
  const path=findMapGeometryPath({...pathInput,to:{x:250,y:150}})
  expect(path).toMatchObject({elevationsFeet:[10.5,10.5,10.5],movementCostFeet:10})
  const preview=createMapGeometryPathTree({...pathInput,maximumMovementCostFeet:10}).pathTo({x:250,y:150})
  expect(preview).toMatchObject({elevationsFeet:path!.elevationsFeet,movementCostFeet:path!.movementCostFeet})
  map.tokens=[{...token,x:200,elevationFeet:10.5,hp:30,maxHp:30}]
  setMapGeometryRuntime([geometry])
  const before=createDnd5eMapCombatSnapshot({map,characters:[],combatId:'floor-fall',
    initiativeOrder:[{tokenId:token.id,label:token.label,emoji:'',color:'',roll:10}]}).state
  expect(before.combatants.actor).toMatchObject({groundElevationFeet:10.5,airborne:false})
  const destroyed=damageGeometryEntity(geometry.obstacles[0],180,'bludgeoning')
  expect(destroyed).toBeDefined()
  geometry.obstacles[0]={...geometry.obstacles[0],...destroyed}
  expect(geometry.obstacles[0]).toMatchObject({id:'keep:floor:level2.0.0',kind:'obstacle',dnd5eDurability:{hitPoints:0}})
  expect(geometry.obstacles[0].points).toHaveLength(4)
  setMapGeometryRuntime([JSON.parse(JSON.stringify(geometry))])
  const after=structuredClone(before)
  refreshDnd5eMapSpatialRelations(after,map,[])
  expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before,after)).toEqual([
    expect.objectContaining({combatantId:'actor',fallDistanceFeet:10.5,fallingDamageDice:1})])
  const landed=resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before,after,{actor:[3]})
  expect(landed.ok).toBe(true)
  expect(landed.state.combatants.actor).toMatchObject({currentHp:27,elevationFeet:0,airborne:false})
  expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(after,landed.state)).toEqual([])
  expect(support(10.5)).toBe(0)
  expect(support(10.5,250,150)).toBe(10.5)
  expect(input.geometry.obstacles).toHaveLength(0)
  expect(()=>placeDnd5eStructureFloors({...input,geometry})).toThrow('structure-entity-id-conflict')
})
