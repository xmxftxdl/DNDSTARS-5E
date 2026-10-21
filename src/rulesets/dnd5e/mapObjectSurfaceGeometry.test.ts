import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {migrateMapsState} from '../../store/maps'
import {mapGeometryWithObjectSurfaces} from './mapObjectSurfaceGeometry'
import {selectHorizontalMaterialSurface} from './horizontalMaterialSurface'
import {selectVerticalMaterialSurface} from './verticalMaterialSurface'
import {projectAttachedSurfaceArea} from './attachedSurfaceArea'
import {normalizeCharacter} from '../../store/characters'
function fixture(){
 const map=migrateMapsState({maps:[{id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,tokens:[{id:'stone',type:'obstacle',label:'Rock',x:75,y:75,size:1,elevationFeet:2,dnd5eObjectState:{schemaVersion:1,surfaceProfile:{material:'stone',widthFeet:5,lengthFeet:5,heightFeet:5,rotationDegrees:0}}}]}]}).maps[0]
 return {map,geometry:createEmptyMapGeometry('map',1)}
}
it('uses explicit dimensions and material without changing authoritative geometry or icon size',()=>{
 const {map,geometry}=fixture(),before=JSON.stringify({map,geometry})
 const derived=mapGeometryWithObjectSurfaces(map,geometry)
 expect(derived.obstacles).toHaveLength(1)
 expect(derived.obstacles[0]).toMatchObject({id:'surface-object:stone',surfaceMaterial:'stone',baseHeightFeet:2,heightFeet:5,points:[{x:50,y:50},{x:100,y:50},{x:100,y:100},{x:50,y:100}]})
 expect(JSON.stringify({map,geometry})).toBe(before)
 const top=selectHorizontalMaterialSurface({geometry:derived,corners:derived.obstacles[0].points,elevationFeet:7,pixelsPerFoot:10,materials:['stone']})!
 const side=selectVerticalMaterialSurface({geometry:derived,entityId:'surface-object:stone',edgeIndex:0,centerFraction:0.5,widthFeet:5,heightFeet:5,baseElevationFeet:2,pixelsPerFoot:10,maximumSideFeet:5,materials:['stone']})!
 expect(top).toBeDefined();expect(side).toBeDefined()
 const area:any={id:'art',cells:[{col:1,row:1}],visual:{preset:'surface-color',horizontalSurface:top},expiresAtWorldMinute:160}
 map.tokens[0].x+=100;map.tokens[0].y+=100
 map.tokens[0].dnd5eObjectState!.surfaceProfile!.rotationDegrees=90
 const projected=projectAttachedSurfaceArea(area,map,geometry)!
 expect(projected.visual?.horizontalSurface?.corners).toEqual([{x:200,y:150},{x:200,y:200},{x:150,y:200},{x:150,y:150}])
 expect(projected.expiresAtWorldMinute).toBe(160)
 expect(area.visual.horizontalSurface.corners[0]).toEqual({x:50,y:50})
})
it.each(['missing','creature','destroyed'] as const)('does not infer an eligible physical object: %s',kind=>{
 const {map,geometry}=fixture()
 if(kind==='missing')map.tokens[0].dnd5eObjectState!.surfaceProfile=undefined
 if(kind==='creature')map.tokens[0].type='enemy'
 if(kind==='destroyed')map.tokens[0].hp=0
 expect(mapGeometryWithObjectSurfaces(map,geometry)).toBe(geometry)
})

it('retains explicitly mapped carried stone as a selectable surface',()=>{
 const {map,geometry}=fixture()
 map.tokens[0].dnd5eObjectState!.wornOrCarried=true
 const result=mapGeometryWithObjectSurfaces(map,geometry)
 expect(result.obstacles).toHaveLength(1)
 expect(selectHorizontalMaterialSurface({geometry:result,corners:result.obstacles[0].points,elevationFeet:7,pixelsPerFoot:10,materials:['stone']})).toBeDefined()
})

it('follows the carrier only for explicitly exposed inventory surfaces and stops selecting a hidden item',()=>{
 const {map,geometry}=fixture()
 const profile={...map.tokens[0].dnd5eObjectState!.surfaceProfile!,surfaceId:'held-stone',widthFeet:1,lengthFeet:1,heightFeet:1}
 map.tokens[0]={...map.tokens[0],id:'carrier',type:'player',characterId:'owner',dnd5eObjectState:undefined}
 const owner=normalizeCharacter({id:'owner',name:'Owner',equipment:{}} as any)
 owner.dnd5eInventory={schemaVersion:3,revision:0,entries:[{instanceId:'held',quantity:1,surfaceExposed:true,surfaceProfile:profile} as any]}
 const before=JSON.stringify({map,geometry,owner})
 const derived=mapGeometryWithObjectSurfaces(map,geometry,[owner])
 expect(derived.obstacles).toHaveLength(1)
 const surface=derived.obstacles[0]
 expect(surface.id).toBe('surface-object:held-stone')
 const top=selectHorizontalMaterialSurface({geometry:derived,corners:surface.points,elevationFeet:surface.baseHeightFeet!+1,pixelsPerFoot:10,materials:['stone']})!
 expect(top).toBeDefined()
 expect(JSON.stringify({map,geometry,owner})).toBe(before)
 const area:any={id:'art',cells:[],visual:{preset:'surface-color',horizontalSurface:top},expiresAtWorldMinute:160}
 map.tokens[0].x+=100
 const projected=projectAttachedSurfaceArea(area,map,geometry,[owner])!
 expect(projected.visual?.horizontalSurface?.corners).toEqual(top.corners.map(p=>({...p,x:p.x+100})))
 expect(projected.expiresAtWorldMinute).toBe(160)
 owner.dnd5eInventory.entries[0].surfaceExposed=undefined
 expect(mapGeometryWithObjectSurfaces(map,geometry,[owner])).toBe(geometry)
})
