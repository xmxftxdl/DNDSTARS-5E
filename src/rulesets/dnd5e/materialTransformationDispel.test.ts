import {afterEach,expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {normalizeCharacter} from '../../store/characters'
import {prepareMaterialVolumeTransformation} from './materialVolumeTransformation'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {prepareDnd5eSpellCast} from './spellAction'
import {prepareDnd5eMaterialTransformationDispel as prepare,resolvePreparedDnd5eMaterialTransformationDispel as resolve} from './materialTransformationDispel'

let dispose:(()=>void)|undefined
afterEach(()=>{setMapGeometryRuntime([]);dispose?.();dispose=undefined})
function fixture(slotLevel=3,support=false){
 let spellId=''
 dispose=registerDnd5eRulesPlugin({manifest:{id:'local.material.dispel-test',name:'Material test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
  spellId=api.registerSpell(JSON.parse(JSON.stringify({id:'rock',name:'Test material transformation',level:5,school:'transmutation',ritual:false,
   castingTime:{value:1,unit:'action'},range:{type:'distance',feet:120},components:{verbal:true,somatic:true,material:false},
   duration:{type:'timed',value:24,unit:'hour',concentration:false},classes:['wizard'],description:'Test fixture',automation:{mode:'reference-only'}})))
 }})
 const initial=createEmptyMapGeometry('map',1)
 initial.obstacles=[{id:'stone',kind:'obstacle',label:'Stone',points:[{x:100,y:100},{x:150,y:100},{x:150,y:150},{x:100,y:150}],baseHeightFeet:0,heightFeet:10,surfaceMaterial:'stone',materialMagic:'nonmagical',cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 const original=normalizeMapGeometry(initial)!
 if(support)Object.assign(original.obstacles[0],{surfaceMaterial:'mud',terrainElevationFeet:0,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,cover:'none'})
 const converted=prepareMaterialVolumeTransformation({geometry:original,executionId:'cast',entityIds:['stone'],center:{x:125,y:125},angleDegrees:0,widthFeet:5,lengthFeet:5,heightFeet:10,bottomFeet:0,pixelsPerFoot:10,mode:support?'mud-to-rock':'rock-to-mud'})!
 const area:Dnd5ePluginArea={id:'mud',pluginId:'local.material.dispel-test',featureId:spellId,label:'Mud',color:'#888888',sourceCharacterId:'source',sourceTokenId:'source-token',cells:[{col:2,row:2}],createdRound:1,expiresAfterRound:1,permanent:true,slotLevel:5,materialTransformation:converted.receipt}
 const character=normalizeCharacter({id:'wizard',name:'Wizard',charClass:'法师',level:11,currentHp:30,maxHp:30,equipment:{},
  abilities:{str:10,dex:10,con:14,int:20,wis:10,cha:10},classResources:{'dnd5e-spell-slot-3':{current:2,max:2},'dnd5e-spell-slot-5':{current:1,max:1}},
  dnd5eClassChoices:{classes:{wizard:{selections:{'spell-prepared':['dispel-magic'],'wizard-spellbook':['dispel-magic']}}}}} as any)
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'wizard-token',characterId:'wizard',type:'player',label:'Wizard',x:75,y:125,size:1,color:'',emoji:''}],dnd5ePluginAreas:[area]}
 if(support)map.tokens.push({id:'standing',type:'enemy',poolId:'srd-5.1:bandit',label:'Standing',x:125,y:125,elevationFeet:10,size:1,hp:30,maxHp:30,color:'',emoji:''})
 setMapGeometryRuntime([converted.geometry])
 const input:Parameters<typeof prepare>[0]={map,characters:[character],worldMinute:100,geometry:converted.geometry,areaId:'mud',targetCell:{col:2,row:2},targetElevationFeet:support?10:0,
  initiativeOrder:[{tokenId:'wizard-token',label:'Wizard',color:'',emoji:'',roll:20}],
  action:{id:'dispel',mapId:'map',combatId:'combat',type:'dnd5e-spell-cast',actorTokenId:'wizard-token',characterId:'wizard',sourceMode:'player',status:'pending',round:1,initiativeIndex:0,seq:1,updatedAt:1,
   dnd5eSpellCast:{spellId:'dispel-magic',slotLevel,castingClassId:'wizard',targetTokenId:'',dispelMaterialArea:{areaId:'mud',cell:{col:2,row:2}}}}}
 return {input,original}
}
it('waits for exact fall dice before restoring terrain, then lands and damages the unsupported occupant once',()=>{
 const {input,original}=fixture(5,true)
 input.map.tokens[0].elevationFeet=10
 const platform={...structuredClone(original.obstacles[0]),id:'caster-platform',surfaceMaterial:'solid' as const,points:[{x:50,y:100},{x:100,y:100},{x:100,y:150},{x:50,y:150}],terrainElevationFeet:10,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total' as const}
 input.geometry.obstacles.push(platform);original.obstacles.push(structuredClone(platform));setMapGeometryRuntime([input.geometry])
 input.initiativeOrder=[...input.initiativeOrder,{tokenId:'standing',label:'Standing',color:'',emoji:'',roll:10}]
 const before=JSON.stringify(input),prep=prepare(input);expect(prep.ok,JSON.stringify(prep)).toBe(true);if(!prep.ok)throw Error(prep.reason)
 const pending=resolve({preparation:prep,geometry:input.geometry,rolls:{effectRolls:[]}})
 expect(pending.ok).toBe(true);if(!pending.ok)throw Error(pending.reason)
 expect(pending.resolution.result.ok).toBe(false)
 expect(pending.resolution.application).toBeUndefined();expect(pending.geometry).toBeUndefined()
 expect(pending.resolution.airborneFalls).toMatchObject([{combatantId:'standing',fallingDamageDice:1,groundElevationFeet:0}])
 const landed=resolve({preparation:prep,geometry:input.geometry,rolls:{effectRolls:[],airborneFallDamageRollsByCombatantId:{standing:[4]}}})
 expect(landed.ok).toBe(true);if(!landed.ok)throw Error(landed.reason)
 expect(landed.resolution.result.ok,JSON.stringify(landed.resolution.result)).toBe(true)
 expect(landed.geometry).toEqual(original)
 expect(landed.resolution.application!.map.tokens.find(t=>t.id==='standing')).toMatchObject({elevationFeet:0,hp:26})
 expect(landed.resolution.application!.characters[0].classResources!['dnd5e-spell-slot-5'].current).toBe(0)
 expect(landed.resolution.result.events.filter(e=>e.type==='falling-damage-resolved')).toHaveLength(1)
 const invalid=resolve({preparation:prep,geometry:input.geometry,rolls:{effectRolls:[],airborneFallDamageRollsByCombatantId:{standing:[7]}}})
 expect(invalid.ok&&invalid.resolution.result.ok).toBe(false)
 expect(JSON.stringify(input)).toBe(before)
})
it.each([{slot:3,d20:9,success:false},{slot:3,d20:10,success:true},{slot:5,d20:undefined,success:true}])('uses real dispel check, slot and action settlement (%j)',({slot,d20,success})=>{
 const {input,original}=fixture(slot),before=JSON.stringify(input)
 const prep=prepare(input);expect(prep.ok,JSON.stringify(prep)).toBe(true);if(!prep.ok)throw Error(prep.reason)
 const settled=resolve({preparation:prep,geometry:input.geometry,rolls:{effectRolls:[],dispelMagicChecks:d20==null?[]:[{effectId:prep.effectId,d20}]}})
 expect(settled.ok).toBe(true);if(!settled.ok)throw Error(settled.reason)
 expect(settled.resolution.result.ok,JSON.stringify(settled.resolution.result)).toBe(true)
 const application=settled.resolution.application!
 expect(application.map.dnd5ePluginAreas?.some(a=>a.id==='mud')).toBe(!success)
 expect(settled.geometry).toEqual(success?original:undefined)
 expect(application.characters[0].classResources!['dnd5e-spell-slot-'+slot].current).toBe(slot===3?1:0)
 expect(settled.resolution.result.state.combatants['wizard-token'].turn.actionAvailable).toBe(false)
 expect(application.map.tokens.some(t=>t.id===prep.proxyId)).toBe(false)
 expect(settled.resolution.result.state.combatants[prep.proxyId]).toBeUndefined()
 expect(JSON.stringify(input)).toBe(before)
})
it('rejects wrong area, untransformed locations, wrong elevation and spent resources before casting',()=>{
 const {input}=fixture()
 expect(prepareDnd5eSpellCast(input)).toEqual({ok:false,reason:'invalid-target'})
 for(const changed of [{...input,areaId:'missing'},{...input,targetCell:{col:3,row:2}},{...input,targetElevationFeet:11},
  {...input,characters:input.characters.map(c=>({...c,classResources:{...c.classResources,'dnd5e-spell-slot-3':{current:0,max:2}}}))}])expect(prepare(changed).ok).toBe(false)
})
it('does not treat a public targeting hint as authority to restore geometry',()=>{
 const {input}=fixture()
 input.map.dnd5ePluginAreas![0].materialTransformationAvailable=true
 delete input.map.dnd5ePluginAreas![0].materialTransformation
 expect(prepare(input).ok).toBe(false)
})

it('targets the actual sloping mud layer rather than empty space in its bounding box',()=>{
 const {input,original}=fixture(5)
 for(const fragment of input.geometry.obstacles){
  const heights=fragment.points.map(p=>p.x/10-10),min=Math.min(...heights),max=Math.max(...heights)
  fragment.baseHeightFeet=min;fragment.heightFeet=max-min+10
  fragment.materialLayer={basePlane:{xSlope:0.1,ySlope:0,offset:-10},depthFeet:10}
 }
 input.geometry=normalizeMapGeometry(input.geometry)!
 input.map.dnd5ePluginAreas![0].materialTransformation!.replacements[0].fragments=structuredClone(input.geometry.obstacles)
 setMapGeometryRuntime([input.geometry])
 for(const targetElevationFeet of [1,13])expect(prepare({...input,targetElevationFeet}).ok).toBe(false)
 const prepared=prepare({...input,targetElevationFeet:5})
 expect(prepared.ok,JSON.stringify(prepared.ok?{}:prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
 const result=resolve({preparation:prepared,geometry:input.geometry,rolls:{effectRolls:[]}})
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.resolution.result.ok).toBe(true)
 expect(result.geometry).toEqual(original)
 expect(result.resolution.application!.map.dnd5ePluginAreas).toEqual([])
})
it('rejects geometry changed while waiting for dice without spending resources or deleting the area',()=>{
 const {input}=fixture(),prep=prepare(input);if(!prep.ok)throw Error(prep.reason)
 const changed=structuredClone(input.geometry);changed.obstacles[0].label='edited'
 const before=JSON.stringify(input)
 expect(resolve({preparation:prep,geometry:changed,rolls:{effectRolls:[],dispelMagicChecks:[{effectId:prep.effectId,d20:20}]}})).toEqual({ok:false,reason:'material-dispel-geometry-changed'})
 expect(JSON.stringify(input)).toBe(before)
})
it('retains the terrain if Dispel Magic is counterspelled, while spending both spell slots',()=>{
 const {input}=fixture()
 const counter=normalizeCharacter({...structuredClone(input.characters[0]),id:'counter',name:'Counter',
  dnd5eClassChoices:{classes:{wizard:{selections:{'spell-prepared':['counterspell'],'wizard-spellbook':['counterspell']}}}}} as any)
 input.characters=[...input.characters,counter]
 input.map.tokens.push({...input.map.tokens[0],id:'counter-token',characterId:'counter',type:'enemy',x:75,y:175})
 input.initiativeOrder=[...input.initiativeOrder,{tokenId:'counter-token',label:'Counter',color:'',emoji:'',roll:10}]
 const prep=prepare(input);expect(prep.ok).toBe(true);if(!prep.ok)throw Error(prep.reason)
 const settled=resolve({preparation:prep,geometry:input.geometry,rolls:{effectRolls:[],counterspellReaction:{actorId:'counter-token',slotLevel:3}}})
 expect(settled.ok).toBe(true);if(!settled.ok)throw Error(settled.reason)
 expect(settled.resolution.result.ok,JSON.stringify(settled.resolution.result)).toBe(true)
 expect(settled.geometry).toBeUndefined()
 expect(settled.resolution.application!.map.dnd5ePluginAreas).toHaveLength(1)
 for(const c of settled.resolution.application!.characters)expect(c.classResources!['dnd5e-spell-slot-3'].current).toBe(1)
 expect(settled.resolution.application!.map.tokens.some(t=>t.id===prep.proxyId)).toBe(false)
})
