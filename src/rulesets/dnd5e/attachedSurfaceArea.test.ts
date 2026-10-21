import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {migrateMapsState} from '../../store/maps'
import {selectVerticalMaterialSurface} from './verticalMaterialSurface'
import {projectAttachedSurfaceArea} from './attachedSurfaceArea'

it('moves projected cells and height without moving the saved attachment or renewing its lifetime',()=>{
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{id:'stone',kind:'obstacle',label:'Stone',points:[{x:50,y:50},{x:150,y:50},{x:150,y:150},{x:50,y:150}],baseHeightFeet:0,heightFeet:10,surfaceMaterial:'stone',cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 const surface=selectVerticalMaterialSurface({geometry,entityId:'stone',edgeIndex:0,centerFraction:0.5,widthFeet:5,heightFeet:5,baseElevationFeet:2,pixelsPerFoot:10,maximumSideFeet:5,materials:['stone']})!
 const map=migrateMapsState({maps:[{id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,tokens:[],dnd5ePluginAreas:[{
  id:'art',pluginId:'test',featureId:'paint',label:'Paint',color:'#aa3300',sourceTokenId:'caster',sourceCharacterId:'owner',anchorMode:'fixed',cells:[{col:1,row:0},{col:2,row:0}],createdRound:1,expiresAfterRound:601,createdWorldMinute:100,expiresAtWorldMinute:160,sourceLimit:{groupId:'lasting',maximum:2},visual:{preset:'surface-color',verticalSurface:surface}}]}]}).maps[0]
 const saved=map.dnd5ePluginAreas![0],before=JSON.stringify(map)
 geometry.obstacles[0].points.forEach(point=>{point.x+=100;point.y+=100})
 geometry.obstacles[0].baseHeightFeet=5
 const projected=projectAttachedSurfaceArea(saved,map,geometry)!
 expect(projected.cells).toEqual([{col:3,row:2},{col:4,row:2}])
 expect(projected.visual?.verticalSurface).toMatchObject({a:{x:175,y:150},b:{x:225,y:150},baseElevationFeet:7})
 expect(projected).toMatchObject({expiresAtWorldMinute:160,sourceLimit:saved.sourceLimit,sourceCharacterId:'owner',vertical:{mode:'volume',baseElevationFeet:7,heightFeet:5}})
 expect(JSON.stringify(map)).toBe(before)
 expect(projectAttachedSurfaceArea(saved,map,undefined)).toBeUndefined()
 geometry.obstacles=[]
 expect(projectAttachedSurfaceArea(saved,map,geometry)).toBeUndefined()
 expect(JSON.stringify(map)).toBe(before)
})
