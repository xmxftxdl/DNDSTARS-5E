import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {migrateMapsState} from '../../store/maps'
import {normalizeDnd5ePersistentAreaVisual} from './persistentAreaTypes'
import {selectHorizontalMaterialSurface,resolveAttachedHorizontalSurface,horizontalSurfaceCells} from './horizontalMaterialSurface'
import {projectAttachedSurfaceArea} from './attachedSurfaceArea'
const fixture=()=>{
 const geometry=createEmptyMapGeometry('map',1)
 const corners=[{x:50,y:50},{x:100,y:50},{x:100,y:100},{x:50,y:100}]
 geometry.obstacles=[{id:'stone',kind:'obstacle',label:'Stone',points:corners,baseHeightFeet:0,heightFeet:10,surfaceMaterial:'stone',cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 const surface=selectHorizontalMaterialSurface({geometry,corners,elevationFeet:10,pixelsPerFoot:10,materials:['stone']})!
 return {geometry,corners,surface}
}
it('binds and reloads a top pattern, then follows translation, rotation and height without renewing it',()=>{
 const {geometry,surface}=fixture()
 expect(surface.localCornersFeet).toEqual([{x:0,y:0},{x:5,y:0},{x:5,y:5},{x:0,y:5}])
 const map=migrateMapsState({maps:[{id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,tokens:[],dnd5ePluginAreas:[{id:'art',pluginId:'test',featureId:'paint',label:'Paint',color:'#aa3300',sourceTokenId:'caster',anchorMode:'fixed',cells:[{col:1,row:1}],createdRound:1,expiresAfterRound:601,createdWorldMinute:100,expiresAtWorldMinute:160,visual:{preset:'surface-color',horizontalSurface:surface}}]}]}).maps[0]
 const saved=map.dnd5ePluginAreas![0],before=JSON.stringify(saved)
 geometry.obstacles[0].points=geometry.obstacles[0].points.map(p=>({x:300-p.y,y:p.x+100}))
 geometry.obstacles[0].baseHeightFeet=5
 const projected=projectAttachedSurfaceArea(saved,map,geometry)!
 expect(projected.visual?.horizontalSurface?.corners).toEqual([{x:250,y:150},{x:250,y:200},{x:200,y:200},{x:200,y:150}])
 expect(projected.cells).toEqual([{col:4,row:3}])
 expect(projected).toMatchObject({expiresAtWorldMinute:160,vertical:{baseElevationFeet:15}})
 expect(JSON.stringify(saved)).toBe(before)
})
it.each(['missing','material','duplicate','covered','buried','shrunk'] as const)('hides unavailable attached top: %s',kind=>{
 const {geometry,surface}=fixture()
 if(kind==='missing')geometry.obstacles=[]
 if(kind==='material')geometry.obstacles[0].surfaceMaterial='solid'
 if(kind==='duplicate')geometry.obstacles.push({...geometry.obstacles[0]})
 if(kind==='covered')geometry.obstacles.push({...geometry.obstacles[0],id:'cover',baseHeightFeet:10,heightFeet:5})
 if(kind==='buried')geometry.obstacles.push({...geometry.obstacles[0],id:'earth',terrainRegion:true,terrainElevationFeet:15,heightFeet:0})
 if(kind==='shrunk')geometry.obstacles[0].points=geometry.obstacles[0].points.map(p=>({x:50+(p.x-50)/2,y:p.y}))
 expect(resolveAttachedHorizontalSurface(surface,geometry,10)).toBeUndefined()
})
it('rejects malformed persistent top frames and mixed vertical projections',()=>{
 const {surface}=fixture()
 expect(normalizeDnd5ePersistentAreaVisual({preset:'surface-color',horizontalSurface:surface})?.horizontalSurface).toEqual(surface)
 for(const patch of [{elevationFeet:NaN},{entityId:''},{localCornersFeet:[{x:0,y:0}]},{corners:[surface.corners[0],surface.corners[2],surface.corners[1],surface.corners[3]]},{script:'run'}])
  expect(normalizeDnd5ePersistentAreaVisual({preset:'surface-color',horizontalSurface:{...surface,...patch}})).toBeUndefined()
 expect(normalizeDnd5ePersistentAreaVisual({preset:'arcane',horizontalSurface:surface})).toBeUndefined()
 expect(horizontalSurfaceCells(surface,{id:'map',width:500,height:500,gridSize:25,gridOffsetX:0,gridOffsetY:0} as any)).toHaveLength(4)
})
