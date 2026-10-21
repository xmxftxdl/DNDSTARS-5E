import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {validateDnd5eMightyFortressSite,findDnd5eFortressRenewal} from './mightyFortressPlacement'
import {placeDnd5eMightyFortressKeep,prepareDnd5eMightyFortressStructure} from './mightyFortressStructure'

function fixture(){
 const map:BattleMap={id:'site',name:'Site',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 return {map,geometry:createEmptyMapGeometry(map.id,1),origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,
  qualifications:{naturalObstacleIds:[] as string[],naturalObjectTokenIds:[] as string[]}}
}
it('checks complete rotated footprint and detects a structure crossing the site with both endpoints outside',()=>{
 const input=fixture()
 expect(validateDnd5eMightyFortressSite(input).ok).toBe(true)
 expect(validateDnd5eMightyFortressSite({...input,rotationDegrees:45})).toMatchObject({ok:false,reason:'fortress-site-outside-map'})
 input.geometry.walls.push({id:'crossing',kind:'wall',label:'Wall',points:[{x:0,y:700},{x:1800,y:700}],
  baseHeightFeet:0,heightFeet:10,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})
 expect(validateDnd5eMightyFortressSite(input)).toMatchObject({ok:false,reason:'fortress-site-contains-structure'})
 const before=structuredClone(input.geometry)
 expect(prepareDnd5eMightyFortressStructure({...input,structureId:'new',createdAt:1,towerThicknessInches:12,floorThicknessInches:6,
  lifetime:{casterId:'caster',worldMinute:0}})).toMatchObject({ok:false,reason:'fortress-site-contains-structure'})
 expect(input.geometry).toEqual(before)
})
it('permits Host-classified natural objects but never exempts a different caster or different-site building',()=>{
 const input=fixture()
 input.map.tokens.push({id:'tree',type:'obstacle',label:'Tree',color:'',emoji:'',size:1,x:700,y:700})
 expect(validateDnd5eMightyFortressSite(input).ok).toBe(false)
 input.qualifications.naturalObjectTokenIds=['tree']
 expect(validateDnd5eMightyFortressSite(input).ok).toBe(true)
 const geometry=placeDnd5eMightyFortressKeep({...input,structureId:'old',createdAt:1,towerThicknessInches:12,floorThicknessInches:6,
 lifetime:{casterId:'caster',worldMinute:0}}).geometry
 expect(validateDnd5eMightyFortressSite({...input,geometry}).ok).toBe(false)
 expect(validateDnd5eMightyFortressSite({...input,geometry,renewal:{structureId:'old',casterId:'caster'}}).ok).toBe(true)
 expect(validateDnd5eMightyFortressSite({...input,geometry,renewal:{structureId:'old',casterId:'other'}}).ok).toBe(false)
 expect(validateDnd5eMightyFortressSite({...input,geometry,origin:{x:200,y:100},renewal:{structureId:'old',casterId:'caster'}}).ok).toBe(false)
})

it('recognizes only the same owner and footprint and exempts only that fortress bound objects',()=>{
 const input=fixture(),geometry=placeDnd5eMightyFortressKeep({...input,structureId:'old',createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:0}}).geometry
 const renewal=findDnd5eFortressRenewal({...input,geometry,casterId:'caster'})
 expect(renewal).toEqual({structureId:'old',casterId:'caster'})
 expect(findDnd5eFortressRenewal({...input,geometry,casterId:'other'})).toBeUndefined()
 expect(findDnd5eFortressRenewal({...input,geometry,casterId:'caster',elevationFeet:1})).toBeUndefined()
 input.map.tokens.push({id:'furniture',type:'obstacle',label:'Chair',size:1,color:'',emoji:'',x:700,y:700,dnd5eObjectState:{schemaVersion:1,structureBinding:{schemaVersion:1,mapId:'site',structureId:'old'}}})
 expect(validateDnd5eMightyFortressSite({...input,geometry,renewal}).ok).toBe(true)
 input.map.tokens[0].dnd5eObjectState!.structureBinding!.structureId='other'
 expect(validateDnd5eMightyFortressSite({...input,geometry,renewal}).ok).toBe(false)
})

it('prepares same-site replacement without old geometry collisions, preserving old lifetime for atomic publication',()=>{
 const input=fixture(),initial=placeDnd5eMightyFortressKeep({...input,structureId:'old',createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:0},roomBlueprint:[{id:'oldroom',level:1,x:73,y:36,widthFeet:10,depthFeet:10,entrance:{side:'west',offsetFeet:2,kind:'arch'}}]}).geometry
 const bound={schemaVersion:1 as const,mapId:'site',structureId:'old'}
 input.map.tokens.push({id:'old-furniture',type:'obstacle',label:'Chair',size:1,color:'',emoji:'',x:700,y:700,dnd5eObjectState:{schemaVersion:1,structureBinding:bound}})
 const before=JSON.stringify({map:input.map,geometry:initial})
 const prepared=prepareDnd5eMightyFortressStructure({...input,geometry:initial,structureId:'new',createdAt:2,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:200}})
 expect(prepared.ok).toBe(true)
 if(!prepared.ok)throw Error(prepared.reason)
 expect(prepared.map.tokens.some(t=>t.id==='old-furniture')).toBe(false)
 expect(prepared.geometry.obstacles.some(entity=>entity.id.startsWith('old:'))).toBe(false)
 expect(prepared.geometry.structureLifetimes!.map(record=>record.id)).toEqual(['old','new'])
 expect(JSON.stringify({map:input.map,geometry:initial})).toBe(before)
 expect(prepareDnd5eMightyFortressStructure({...input,geometry:initial,structureId:'new',createdAt:2,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'other',worldMinute:200}}).ok).toBe(false)
})
