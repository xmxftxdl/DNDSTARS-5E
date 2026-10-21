import {it,expect} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap,Token} from '../../store/maps'
import {prepareDnd5eTempleStructure} from './templeStructure'
import {prepareDnd5eMapInteraction} from './mapInteraction'
import {prepareDnd5eTempleDisintegration,prepareDnd5eTempleDisintegrationTarget} from './templeDisintegration'

it.each([false,true])('removes an entire selected temple (permanent=%s), preserving neighbours and ordinary occupants',permanent=>{
 const map:BattleMap={id:'temple',name:'Temple',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const input={map,geometry:createEmptyMapGeometry(map.id),origin:{x:500,y:500},widthFeet:30,depthFeet:20,heightFeet:15,elevationFeet:0,rotationDegrees:0,
  structureId:'temple:test',casterId:'caster',authorizedCreatureIds:[],worldMinute:60,createdAt:1,
  hostileCreatureTypes:['fiend' as const],lighting:'bright' as const,sourceSaveDc:18,sourceWisdomModifier:5}
 const built=prepareDnd5eTempleStructure(input)
 if(!built.ok)throw Error(built.reason)
 const second=prepareDnd5eTempleStructure({...input,geometry:built.geometry,origin:{x:1200,y:500},structureId:'temple:other'})
 if(!second.ok)throw Error(second.reason)
 const geometry=second.geometry
 if(permanent)geometry.structureLifetimes![0].expiresWorldMinute=null
 // Even an unrelated structure awaiting clock cleanup must not be deleted by this projection.
 geometry.structureLifetimes![1].expiresWorldMinute=90
 const base={label:'Occupant',size:1,x:600,y:600,emoji:'',color:'',hp:20,maxHp:20}
 map.tokens=[{...base,id:'resident',type:'enemy',elevationFeet:0},
  {...base,id:'roof',type:'enemy',elevationFeet:15},
  {...base,id:'flying',type:'enemy',elevationFeet:20},
  {...base,id:'ordinary-object',type:'obstacle',elevationFeet:0}]
 const before=JSON.stringify({map,geometry})
 for(const targetEntityId of geometry.structureLifetimes![0].entityIds){
  const removed=prepareDnd5eTempleDisintegration({map,geometry,targetEntityId,worldMinute:100})
  expect(removed.ok,JSON.stringify(removed)).toBe(true)
  if(!removed.ok)throw Error(removed.reason)
  expect(removed.expiredIds).toEqual(['temple:test'])
  expect(removed.geometry.structureLifetimes?.map(record=>record.id)).toEqual(['temple:other'])
  expect([...removed.geometry.obstacles,...removed.geometry.doors].every(entity=>entity.id.startsWith('temple:other:'))).toBe(true)
  expect(removed.map.tokens).toHaveLength(4)
  expect(removed.map.tokens.map(token=>token.elevationFeet)).toEqual([0,15,20,0])
  expect(removed.unsupportedTokenIds).toEqual(['roof'])
  expect(removed.map.tokens.map(token=>token.hp)).toEqual([20,20,20,20])
 }
 expect(JSON.stringify({map,geometry})).toBe(before)
 const caster={...base,id:'caster',type:'player' as const,x:550,y:400,elevationFeet:0}
 const targeted={map:{...map,tokens:[...map.tokens,caster]},geometry,targetEntityId:'temple:test:north-left',worldMinute:100,
  actorTokenId:caster.id,targetPosition:{x:550,y:500},targetElevationFeet:5,rangeFeet:60}
 expect(prepareDnd5eTempleDisintegrationTarget(targeted).ok).toBe(true)
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,targetPosition:{x:550,y:550}})).toMatchObject({ok:false,reason:'temple-disintegration-invalid-target'})
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,targetElevationFeet:50})).toMatchObject({ok:false,reason:'temple-disintegration-invalid-target'})
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,map:{...targeted.map,tokens:[{...caster,x:0,y:0}]}})).toMatchObject({ok:false,reason:'temple-disintegration-out-of-range'})
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,targetEntityId:'temple:test:south',targetPosition:{x:550,y:700}})).toMatchObject({ok:false,reason:'temple-disintegration-obstructed'})
 const blocked={...geometry,walls:[...geometry.walls,{id:'other-wall',kind:'wall' as const,label:'Other wall',points:[{x:0,y:450},{x:1000,y:450}],
  baseHeightFeet:0,heightFeet:20,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]}
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,geometry:blocked})).toMatchObject({ok:false,reason:'temple-disintegration-obstructed'})
 const blindCaster={...caster,dnd5eCombatState:{conditions:['blinded']}}
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,map:{...targeted.map,tokens:[blindCaster]}})).toMatchObject({ok:false,reason:'temple-disintegration-not-visible'})
 const unlit={...geometry,vision:{...geometry.vision,ambientLight:'darkness' as const},
  structureLifetimes:geometry.structureLifetimes!.map(record=>({...record,templeWard:{...record.templeWard!,lighting:'none' as const}}))}
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,geometry:unlit})).toMatchObject({ok:false,reason:'temple-disintegration-not-visible'})
 const litCaster={...caster,lightSource:{enabled:true,brightRadiusFeet:20,dimRadiusFeet:0,color:'#fff',expiresAtWorldMinute:101}}
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,geometry:unlit,map:{...targeted.map,tokens:[litCaster]}}).ok).toBe(true)
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,geometry:unlit,map:{...targeted.map,tokens:[litCaster]},worldMinute:101})).toMatchObject({ok:false,reason:'temple-disintegration-not-visible'})
 const darkseeing={...caster,darkvisionRangeFeet:30}
 expect(prepareDnd5eTempleDisintegrationTarget({...targeted,geometry:unlit,map:{...targeted.map,tokens:[darkseeing]}}).ok).toBe(true)
 for(const targetEntityId of ['missing','temple:test','temple:other:door'])
  expect(prepareDnd5eTempleDisintegration({map,geometry,targetEntityId,worldMinute:100}).ok).toBe(false)
 expect(prepareDnd5eTempleDisintegration({map,geometry,targetEntityId:built.doorId,worldMinute:59}).ok).toBe(false)
 if(!permanent)expect(prepareDnd5eTempleDisintegration({map,geometry,targetEntityId:built.doorId,worldMinute:1500}).ok).toBe(false)
})
it('generates a rotated enclosed temple with one authorized entrance and a persisted daily lifetime',()=>{
 const actor:Token={id:'caster-token',characterId:'caster',type:'player',label:'Caster',size:1,x:25,y:25,emoji:'',color:''}
 const map:BattleMap={id:'temple',name:'Temple',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[actor]}
 const input={map,geometry:createEmptyMapGeometry(map.id),origin:{x:500,y:500},widthFeet:30,depthFeet:20,heightFeet:15,elevationFeet:0,rotationDegrees:30,
  structureId:'temple:test',casterId:'caster',authorizedCreatureIds:[],worldMinute:60,createdAt:1,
  hostileCreatureTypes:['fiend' as const],lighting:'bright' as const,sourceSaveDc:18,sourceWisdomModifier:5}
 const before=JSON.stringify(input)
 const built=prepareDnd5eTempleStructure(input)
 expect(built.ok).toBe(true);if(!built.ok)throw Error(built.reason)
 expect(JSON.stringify(input)).toBe(before)
 const saved=normalizeMapGeometry(JSON.parse(JSON.stringify(built.geometry)))!
 expect(saved.doors).toHaveLength(1)
 expect(saved.obstacles).toHaveLength(8)
 expect(saved.structureLifetimes![0]).toMatchObject({createdWorldMinute:60,expiresWorldMinute:1500,doorAccess:{authorizedCreatureIds:[]}})
 expect(saved.structureLifetimes![0].entityIds).toHaveLength(9)
 expect(saved.structureLifetimes![0].templeWard).toEqual({hostileCreatureTypes:['fiend'],lighting:'bright',saveDc:18,healingBonus:5})
 const minimum=prepareDnd5eTempleStructure({...input,sourceWisdomModifier:-3})
 expect(minimum.ok&&minimum.geometry.structureLifetimes![0].templeWard?.healingBonus).toBe(1)
 const door=saved.doors[0],near={...actor,x:(door.points[0].x+door.points[1].x)/2,y:(door.points[0].y+door.points[1].y)/2}
 const request={map,geometry:saved,actor:near,payload:{doorId:door.id,operation:'open' as const,method:'interact' as const}}
 expect(prepareDnd5eMapInteraction(request).ok).toBe(true)
 for(const characterId of ['caster','outsider'])expect(prepareDnd5eMapInteraction({...request,actor:{...near,characterId},
  payload:{doorId:door.id,operation:'break',method:'force'}})).toMatchObject({ok:false,reason:'temple-force-door-indestructible'})
 expect(prepareDnd5eMapInteraction({...request,actor:{...near,characterId:'outsider'}})).toMatchObject({ok:false,reason:'structure-door-not-authorized'})
 expect(prepareDnd5eTempleStructure({...input,authorizedCreatureIds:['missing']})).toMatchObject({ok:false,reason:'temple-delegate-invalid'})
 const delegated=prepareDnd5eTempleStructure({...input,characters:[{id:'absent-guest'}],authorizedCreatureIds:['absent-guest']})
 expect(delegated.ok).toBe(true);if(!delegated.ok)throw Error(delegated.reason)
 const restored=normalizeMapGeometry(JSON.parse(JSON.stringify(delegated.geometry)))!
 expect(restored.structureLifetimes![0].doorAccess?.authorizedCreatureIds).toEqual(['absent-guest'])
 const arriving={...near,id:'new-token-id',characterId:'absent-guest'}
 expect(prepareDnd5eMapInteraction({...request,geometry:restored,actor:arriving}).ok).toBe(true)
 expect(prepareDnd5eMapInteraction({...request,geometry:restored,actor:{...arriving,characterId:'uninvited'}}))
  .toMatchObject({ok:false,reason:'structure-door-not-authorized'})
 expect(prepareDnd5eTempleStructure({...input,characters:[{id:'absent-guest'}],authorizedCreatureIds:['unknown']}))
  .toMatchObject({ok:false,reason:'temple-delegate-invalid'})
 expect(prepareDnd5eTempleStructure({...input,characters:[{id:'absent-guest'}],authorizedCreatureIds:['absent-guest','absent-guest']}))
  .toMatchObject({ok:false,reason:'temple-delegate-invalid'})
 expect(prepareDnd5eTempleStructure({...input,geometry:saved}).ok).toBe(false)
})
