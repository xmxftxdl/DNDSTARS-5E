import {dnd5eNormalGroundTerrainAt} from './normalGroundTerrain'
import {expect,it} from 'vitest'
import {terrainMultiplierAtPoint} from '../../lib/mapPathfinding'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'

it('temporarily normalizes mapped ground without deleting it or changing climbing costs',()=>{
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{id:'soil',kind:'obstacle',label:'soil',cover:'none',points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,baseHeightFeet:0,heightFeet:0,terrainElevationFeet:0,surfaceMaterial:'earth',traversal:'ground',terrainCostMultiplier:2,createdAt:1}]
 const map={id:'map',gridSize:50,gridOffsetX:0,gridOffsetY:0,dnd5ePluginAreas:[{id:'smooth',normalGroundTerrain:true,vertical:{mode:'ground'},cells:[{col:0,row:0}]}]} as unknown as BattleMap
 const before=structuredClone(geometry),point={x:25,y:25},options={map,elevationFeet:0,tokenHeightFeet:5}
 expect(terrainMultiplierAtPoint(geometry,point,options)).toBe(1)
 expect(terrainMultiplierAtPoint(geometry,{x:75,y:25},options)).toBe(2)
 geometry.obstacles[0].traversal='climb'
 expect(terrainMultiplierAtPoint(geometry,point,options)).toBe(4)
 geometry.obstacles[0].traversal='ground'
 map.dnd5ePluginAreas=[]
 expect(terrainMultiplierAtPoint(geometry,point,options)).toBe(2)
 expect(geometry).toEqual(before)
})

it('requires ground contact and coverage of the entire creature footprint',()=>{
 const map={id:'map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,dnd5ePluginAreas:[{id:'smooth',normalGroundTerrain:true,vertical:{mode:'ground'},cells:[{col:0,row:0}]}]} as unknown as BattleMap
 const token={id:'walker',type:'enemy',size:1,x:25,y:25} as any
 expect(dnd5eNormalGroundTerrainAt(map,token,0,token)).toBe(true)
 expect(dnd5eNormalGroundTerrainAt(map,token,10,token)).toBe(false)
 const large={...token,size:2,x:50,y:50}
 expect(dnd5eNormalGroundTerrainAt(map,large,0,large)).toBe(false)
 map.dnd5ePluginAreas![0].cells=[{col:0,row:0},{col:1,row:0},{col:0,row:1},{col:1,row:1}]
 expect(dnd5eNormalGroundTerrainAt(map,large,0,large)).toBe(true)
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{id:'platform',kind:'obstacle',label:'platform',cover:'none',points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,baseHeightFeet:0,heightFeet:10,terrainElevationFeet:10,surfaceMaterial:'earth',createdAt:1}]
 expect(dnd5eNormalGroundTerrainAt(map,token,0,token,geometry)).toBe(false)
 expect(dnd5eNormalGroundTerrainAt(map,token,10,token,geometry)).toBe(true)
})

it('lets a later ground change take effect and restores the previous layer on removal',()=>{
 const cell={col:0,row:0}
 const normal={id:'normal',normalGroundTerrain:true,vertical:{mode:'ground'},cells:[cell]}
 const rough={id:'rough',movementCostMultiplier:2,vertical:{mode:'ground'},cells:[cell]}
 const map={id:'order-map',gridSize:50,gridOffsetX:0,gridOffsetY:0,dnd5ePluginAreas:[normal,rough]} as unknown as BattleMap
 const point={x:25,y:25}
 expect(dnd5eNormalGroundTerrainAt(map,point,0)).toBe(false)
 map.dnd5ePluginAreas!.pop()
 expect(dnd5eNormalGroundTerrainAt(map,point,0)).toBe(true)
 map.dnd5ePluginAreas=[rough,normal] as any
 expect(dnd5eNormalGroundTerrainAt(JSON.parse(JSON.stringify(map)),point,0)).toBe(true)
 map.dnd5ePluginAreas!.pop()
 expect(dnd5eNormalGroundTerrainAt(map,point,0)).toBe(false)
})
