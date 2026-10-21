import {expect,it} from 'vitest'
import {requestDnd5eFortressSelection} from './mightyFortressSelection'
import {createEmptyMapGeometry,mapGeometryMovementBlocked,mapGeometryPlacementBlocked} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {prepareDnd5eMightyFortressStructure} from '../../rulesets/dnd5e/mightyFortressStructure'
import {findMapGeometryPath} from '../../lib/mapPathfinding'
import {prepareDnd5eFortressServantMove} from '../../rulesets/dnd5e/fortressServantMove'
import {dnd5eFortressRoomDestinations} from '../../rulesets/dnd5e/fortressRoomDestinations'

function fixture(){
 const map:BattleMap={id:'keep',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const area={anchorCell:{col:2,row:2},cells:Array.from({length:576},(_,i)=>({col:2+i%24,row:2+Math.floor(i/24)})),targetIds:[],
  areaPlacementDistanceFeet:10,areaPlacement:{x:125,y:125,elevationFeet:0,widthFeet:120,lengthFeet:120,heightFeet:1}}
 return {map,geometry:createEmptyMapGeometry(map.id,1),area,isCurrent:()=>true,choose:async(options:{title?:string})=>options.title?.endsWith('层房间')?'0':'6',chooseMany:async(options:{title?:string})=>options.title?.endsWith('石门')?['outer-north.0.3','keep-north.0.2']:[],promptThickness:async()=>null}
}
it('passes custom room editing into actual keep creation and preserves cancellation',async()=>{
 const input=fixture()
 const custom=[{id:'west-room',level:1 as const,x:36,y:72,widthFeet:12,depthFeet:12,entrance:{side:'east' as const,offsetFeet:3,kind:'door' as const}}]
 const choose=async(options:Parameters<typeof input.choose>[0])=>options.title?.endsWith('层房间')?'custom':input.choose(options)
 const selected=await requestDnd5eFortressSelection({...input,choose,chooseRoomLayout:async()=>custom})
 expect(selected?.fortressSelection.roomBlueprint).toEqual(custom)
 expect(selected?.fortressSelection.eastRoomsPerLevel).toBeUndefined()
 const prepared=prepareDnd5eMightyFortressStructure({...selected!.fortressSelection,map:input.map,geometry:input.geometry,
  origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'keep',qualifications:selected!.fortressQualifications})
 expect(prepared.ok).toBe(true)
 if(prepared.ok)expect(prepared.geometry.doors.some(door=>door.id.includes('custom-room-west-room'))).toBe(true)
 expect(await requestDnd5eFortressSelection({...input,choose,chooseRoomLayout:async()=>null})).toBeUndefined()
})
it('collects validated module furniture after emergence and rejects invalid selections',async()=>{
 const input=fixture(),furnishingCatalog=[{templateId:'srd-5.1:item:bedroll',size:0.5}]
 const placements=[{id:'bed',templateId:furnishingCatalog[0].templateId,level:1 as const,x:75,y:75}]
 const selected=await requestDnd5eFortressSelection({...input,furnishingCatalog,chooseFurnishings:async preview=>{
  expect(preview.geometry.structureLifetimes?.[0].id).toBe('fortress-preview')
  return placements
 }})
 expect(selected?.fortressSelection.furnishings).toEqual(placements)
 expect(await requestDnd5eFortressSelection({...input,furnishingCatalog,chooseFurnishings:async()=>null})).toBeUndefined()
 expect(await requestDnd5eFortressSelection({...input,furnishingCatalog,chooseFurnishings:async()=>[{...placements[0],x:10}]})).toBeUndefined()
})
it('creates independently selected floor rooms and includes their doors in the expiry ownership',async()=>{
 const input=fixture()
 const selected=await requestDnd5eFortressSelection({...input,choose:async options=>options.title?.endsWith('层房间')?
  options.title.includes('1')?'1':options.title.includes('2')?'4':'8':input.choose(options)})
 expect(selected?.fortressSelection.eastRoomsPerLevel).toEqual([1,4,8])
 const prepared=prepareDnd5eMightyFortressStructure({...selected!.fortressSelection,map:input.map,geometry:input.geometry,
  origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'keep',qualifications:selected!.fortressQualifications,lifetime:{casterId:'caster',worldMinute:100}})
 if(!prepared.ok)throw Error('invalid layout')
 const doors=prepared.geometry.doors.filter(door=>door.id.includes(':room-'))
 expect(doors).toHaveLength(13)
 expect(new Set(doors.map(door=>door.baseHeightFeet))).toEqual(new Set([0,10.5,21]))
 expect(doors.every(door=>prepared.geometry.structureLifetimes![0].entityIds.includes(door.id))).toBe(true)
 const archways=['room-1-1-door.0.0','room-3-2-door.0.0']
 const archSelection=await requestDnd5eFortressSelection({...input,choose:async options=>options.title?.endsWith('层房间')?
  options.title.includes('1')?'1':options.title.includes('2')?'4':'8':input.choose(options),
  chooseMany:async options=>options.title?.endsWith('房间拱门')?archways:input.chooseMany(options)})
 expect(archSelection?.fortressSelection.roomArchways).toEqual(archways)
 const arches=prepareDnd5eMightyFortressStructure({...archSelection!.fortressSelection,map:input.map,geometry:input.geometry,
  origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'keep',qualifications:selected!.fortressQualifications})
 if(!arches.ok)throw Error('invalid arches')
 expect(arches.geometry.doors.filter(door=>door.id.includes(':room-'))).toHaveLength(11)
 const actor={id:'walker',type:'enemy' as const,label:'Walker',color:'',emoji:'',size:1,x:750,y:700,elevationFeet:0}
 expect(mapGeometryMovementBlocked({map:input.map,geometry:prepared.geometry,token:actor,to:{x:850,y:700}}).blocked).toBe(true)
 expect(mapGeometryMovementBlocked({map:input.map,geometry:arches.geometry,token:actor,to:{x:850,y:700}}).blocked).toBe(false)
 expect(()=>prepareDnd5eMightyFortressStructure({...selected!.fortressSelection,roomArchways:['outer-north.0.3'],map:input.map,geometry:input.geometry,
  origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'keep',qualifications:selected!.fortressQualifications})).toThrow('fortress-room-archway-invalid')
 expect(()=>prepareDnd5eMightyFortressStructure({...selected!.fortressSelection,eastRoomsPerLevel:[0,9,0],map:input.map,geometry:input.geometry,
  origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'keep',qualifications:selected!.fortressQualifications})).toThrow('fortress-room-count-invalid')
 expect(input.geometry.obstacles).toHaveLength(0)
})
it('collects explicit thicknesses and doors and generates connected stairs to the third floor',async()=>{
 const input=fixture(),choices=await requestDnd5eFortressSelection(input)
 expect(choices).toBeDefined()
 expect(choices!.fortressSelection.openings).toHaveLength(2)
 const prepared=prepareDnd5eMightyFortressStructure({...choices!.fortressSelection,map:input.map,geometry:input.geometry,
  origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'keep',qualifications:choices!.fortressQualifications})
 expect(prepared.ok).toBe(true)
 if(!prepared.ok)throw Error('invalid layout')
 const token={id:'walker',type:'enemy' as const,label:'Walker',color:'',emoji:'',size:1,x:525,y:575,elevationFeet:0}
 const steps=[[525,0],[575,0],[625,3.5],[675,7],[725,10.5],[775,10.5]]
 for(let index=1;index<steps.length;index++){
  const [x,z]=steps[index],[beforeX,beforeZ]=steps[index-1]
  expect(mapGeometryMovementBlocked({map:input.map,geometry:prepared.geometry,token:{...token,x:beforeX},to:{x,y:575},fromElevationFeet:beforeZ,toElevationFeet:z}),`step ${index}`).toMatchObject({blocked:false})
  expect(mapGeometryPlacementBlocked({map:input.map,geometry:prepared.geometry,token,at:{x,y:575},elevationFeet:z}),`placement ${index}`).toMatchObject({blocked:false})
 }
 expect(findMapGeometryPath({map:input.map,geometry:prepared.geometry,token,to:{x:775,y:575},targetElevationFeet:10.5}), 'first flight').toBeDefined()
 expect(findMapGeometryPath({map:input.map,geometry:prepared.geometry,token:{...token,x:525,y:775,elevationFeet:10.5},to:{x:775,y:775},targetElevationFeet:21}), 'second flight').toBeDefined()
 const path=findMapGeometryPath({map:{...input.map,tokens:[token]},geometry:prepared.geometry,token,to:{x:775,y:775},targetElevationFeet:21})
 expect(path?.elevationsFeet?.at(-1)).toBe(21)
 expect(input.geometry.obstacles).toEqual([])
})
it('keeps the maximum-room layout connected through both stairs and gives stone doors combat durability',async()=>{
 const input=fixture(),choices=await requestDnd5eFortressSelection({...input,choose:async options=>options.title?.endsWith('层房间')?'8':input.choose(options)})
 const prepared=prepareDnd5eMightyFortressStructure({...choices!.fortressSelection,map:input.map,geometry:input.geometry,
  origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'keep',qualifications:choices!.fortressQualifications})
 if(!prepared.ok)throw Error('invalid layout')
 const token={id:'walker',type:'enemy' as const,label:'Walker',color:'',emoji:'',size:1,x:525,y:575,elevationFeet:0}
 const path=findMapGeometryPath({map:{...input.map,tokens:[token]},geometry:prepared.geometry,token,to:{x:725,y:725},targetElevationFeet:21})
 expect(path?.elevationsFeet.at(-1)).toBe(21)
 expect(prepared.geometry.doors.filter(door=>door.id.includes(':room-'))).toHaveLength(24)
 for(const door of prepared.geometry.doors.filter(door=>door.id.includes(':room-'))){
  expect(door.dnd5eDurability).toMatchObject({armorClass:15,hitPoints:180,maxHitPoints:180,damageImmunities:['poison','psychic']})
 }
})
it('moves a servant through every open narrow room door to the exact off-grid destination, rejecting closed doors',async()=>{
 const input=fixture(),choices=await requestDnd5eFortressSelection({...input,choose:async options=>options.title?.endsWith('层房间')?'8':input.choose(options)})
 const prepared=prepareDnd5eMightyFortressStructure({...choices!.fortressSelection,map:input.map,geometry:input.geometry,
  origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'keep',qualifications:choices!.fortressQualifications,lifetime:{casterId:'caster',worldMinute:100}})
 if(!prepared.ok)throw Error('invalid layout')
 prepared.geometry.structureLifetimes![0].fortressServices!.servants![0].tokenId='servant'
 const destinations=dnd5eFortressRoomDestinations(prepared.geometry,'keep')
 expect(destinations).toHaveLength(24)
 expect(dnd5eFortressRoomDestinations({...prepared.geometry,doors:[]},'keep')).toEqual(destinations)
 expect(dnd5eFortressRoomDestinations(prepared.geometry,'foreign')).toEqual([])
 for(let level=0;level<3;level++)for(let room=0;room<8;room++){
  const y=100+(35.5+(room+0.5)*49/8)*10,elevationFeet=level*10.5
  const destination=destinations.find(entry=>entry.id===`room-${level+1}-${room+1}`)!
  expect(destination.inside.x).toBeCloseTo(875)
  expect(destination.inside.y).toBeCloseTo(y)
  expect(destination.outside.x).toBeCloseTo(775)
  const servant={id:'servant',type:'obstacle' as const,label:'Servant',color:'',emoji:'',size:1,x:775,y,elevationFeet,hp:1,
   dnd5eObjectState:{schemaVersion:1 as const,structureBinding:{schemaVersion:1 as const,mapId:input.map.id,structureId:'keep'}}}
  const map={...input.map,tokens:[servant,{...servant,id:'caster',type:'enemy' as const,x:375,y:375,elevationFeet:0,dnd5eObjectState:undefined}]}
  const move={map,geometry:prepared.geometry,commanderTokenId:'caster',servantTokenId:'servant',worldMinute:100,
   expectedPosition:{x:775,y,elevationFeet},destination:destination.inside}
  expect(prepareDnd5eFortressServantMove(move).ok,`closed ${level}/${room}`).toBe(false)
  const opened={...prepared.geometry,doors:prepared.geometry.doors.map(door=>({...door,state:'open' as const,openState:'open' as const}))}
  const result=prepareDnd5eFortressServantMove({...move,geometry:opened})
  expect(result.ok,`open ${level}/${room}`).toBe(true)
  if(result.ok){expect(result.map.tokens[0]).toMatchObject(destination.inside);expect(result.path.movementCostFeet).toBeCloseTo(10)}
 }
})
it('rejects cancellation, an outdated selection and more than four exterior doors',async()=>{
 const input=fixture()
 expect(await requestDnd5eFortressSelection({...input,choose:async()=>null})).toBeUndefined()
 let current=true,count=0
 expect(await requestDnd5eFortressSelection({...input,isCurrent:()=>current,choose:async()=>{count++;current=false;return '6'}})).toBeUndefined()
 expect(count).toBe(1)
 expect(await requestDnd5eFortressSelection({...input,chooseMany:async()=>Array.from({length:5},(_,i)=>`outer-north.0.${i}`)})).toBeUndefined()
 expect(await requestDnd5eFortressSelection({...input,choose:async()=> 'custom',promptThickness:async()=> 'NaN'})).toBeUndefined()
})

it('persists explicitly selected creature identities for fortress service authorization',async()=>{
 const input=fixture()
 input.map.tokens=[{id:'guest-token',characterId:'guest',type:'player',label:'Guest',color:'',emoji:'',size:1,x:400,y:400,hp:12}]
 const choices=await requestDnd5eFortressSelection({...input,chooseMany:async options=>options.title?.endsWith('仆役授权')?['guest-token']:input.chooseMany(options)})
 expect(choices?.fortressSelection.authorizedCreatureIds).toEqual(['guest'])
 const prepared=prepareDnd5eMightyFortressStructure({...choices!.fortressSelection,map:input.map,geometry:input.geometry,
  origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'keep',qualifications:choices!.fortressQualifications,lifetime:{casterId:'caster',worldMinute:100}})
 if(!prepared.ok)throw Error('invalid layout')
 expect(prepared.geometry.structureLifetimes![0].fortressServices?.authorizedCreatureIds).toEqual(['guest'])
 expect(await requestDnd5eFortressSelection({...input,chooseMany:async options=>options.title?.endsWith('仆役授权')?['unknown']:input.chooseMany(options)})).toBeUndefined()
})

it('requests a highlighted map landing only when emergence needs one, and rejects stale selection',async()=>{
 const input=fixture()
 input.map.tokens=[{id:'edge',type:'enemy',label:'Edge',color:'',emoji:'',size:1,x:100,y:600,elevationFeet:0,hp:12,maxHp:20}]
 let calls=0
 const result=await requestDnd5eFortressSelection({...input,chooseLanding:async(_label,cells)=>{calls++;return cells[0]}})
 expect(result?.fortressEmergencePlacements.edge).toBeDefined()
 expect(calls).toBe(1)
 let current=true
 expect(await requestDnd5eFortressSelection({...input,isCurrent:()=>current,chooseLanding:async(_label,cells)=>{current=false;return cells[0]}})).toBeUndefined()
})
