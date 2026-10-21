import {expect,it} from 'vitest'
import {withStructureExpiry} from './withStructureExpiry'
import type {SharedRoomGatewayPort} from '../ports/sharedRoomGateway'
import {createEmptyMapGeometry,normalizeMapGeometry} from '../lib/mapGeometry'
import {placeDnd5eMightyFortressKeep} from '../rulesets/dnd5e/mightyFortressStructure'
import type {BattleMap} from '../store/maps'
import {withCombatRoundClock} from './withCombatRoundClock'
import {normalizeSharedCampaignTime} from '../lib/campaignTime'
import {recordStructureCasting,recordDailyStructureCasting} from '../../shared/structure-casting-history.mjs'
import {normalizeCharacter} from '../store/characters'
import {createDnd5eMechanicalEffect} from '../rulesets/dnd5e/activeEffects'
import {applyDnd5eInventoryGrantBundle,normalizeDnd5eInventory} from '../rulesets/dnd5e/items'
import {prepareDnd5eTempleStructure} from '../rulesets/dnd5e/templeStructure'
import {createDnd5eMapCombatSnapshot} from '../rulesets/dnd5e/mapBridge'
import {resolveDnd5eTempleExpiry} from '../rulesets/dnd5e/templeExpirySettlement'

it.each(['success','mutation','missing-dice','conflict','stale-map','incomplete'] as const)('commits temple expiry and roof damage with its clock, or commits nothing: %s',async mode=>{
 const f=fixture(),map=f.state.maps.maps[0] as BattleMap
 const built=prepareDnd5eTempleStructure({map:{...map,tokens:[]},geometry:createEmptyMapGeometry(map.id),origin:{x:100,y:100},widthFeet:60,depthFeet:60,heightFeet:15,
  elevationFeet:0,rotationDegrees:0,structureId:'temple:expiry',casterId:'builder',authorizedCreatureIds:[],worldMinute:100,createdAt:1,
  hostileCreatureTypes:['fiend'],lighting:'bright',sourceSaveDc:18,sourceWisdomModifier:5})
 if(!built.ok)throw Error(built.reason)
 f.state['map-geometry'].maps=[built.geometry]
 f.state['campaign-time'].worldMinute=1539
 map.tokens[0].elevationFeet=15
 const original=structuredClone(f.state)
 let mutationRequests=0
 f.transport.mutateResource=async<T>(_name:string,endpoint:string):Promise<T>=>{
  mutationRequests++
  if(endpoint==='/state/campaign-time/mutation')throw Error('temple-expiry-settlement-required')
  expect(endpoint).toBe('/state/campaign-time/mutation?prepare=1')
  return {ok:true,prepared:true,plan:{writes:[{name:'campaign-time',expectedRevision:1,data:{worldMinute:1540}}],
   readRevisions:{maps:1,'map-geometry':1,characters:0}}} as T
 }
 let entered=false
 const gateway=withStructureExpiry(f.transport,async input=>{
  entered=true
  // Even while waiting for the Host, no geometry or clock is published.
  expect(f.state).toEqual(original)
  if(mode==='incomplete')return {...input,combat:undefined,expiredIds:[]}
  const snapshot=createDnd5eMapCombatSnapshot({...input,combatId:'expiry-test',initiativeOrder:input.map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  const result=resolveDnd5eTempleExpiry({...input,state:snapshot.state,characterIdByCombatantId:snapshot.characterIdByCombatantId,
   airborneFallDamageRollsByCombatantId:mode==='missing-dice'?undefined:{resident:[4]}})
  if(!result.ok)throw Error(result.reason)
  if(mode==='conflict')f.fail(true)
  if(mode==='stale-map')f.state.maps._sync.revision++
  return {map:result.application.map,geometry:result.geometry,characters:result.application.characters,expiredIds:result.expiredIds}
 })
 if(mode==='success'||mode==='mutation'){
  if(mode==='mutation'){
   expect(await gateway.mutateResource('campaign-time','/state/campaign-time/mutation',{operation:'advance',minutes:1})).toMatchObject({worldMinute:1540})
   expect(mutationRequests).toBe(2)
  }else await gateway.saveResource('campaign-time',{worldMinute:1540})
  expect(f.commits()).toBe(1)
  expect(f.state['campaign-time'].worldMinute).toBe(1540)
  expect(f.state['map-geometry'].maps[0].structureLifetimes).toEqual([])
  expect(f.state.maps.maps[0].tokens[0]).toMatchObject({elevationFeet:0,hp:8})
 }else{
  await expect(gateway.saveResource('campaign-time',{worldMinute:1540})).rejects.toThrow(mode==='incomplete'?'temple-expiry-incomplete-settlement':mode==='missing-dice'?'invalid-dice':'revision-conflict')
  if(mode==='stale-map')original.maps._sync.revision++
  expect(f.state).toEqual(original)
  expect(f.commits()).toBe(0)
 }
 expect(entered).toBe(true)
})

it('atomically removes source-bound ground, carried and inventory objects across maps without touching other sources',async()=>{
 const f=fixture(),binding={schemaVersion:1 as const,mapId:'keep',structureId:'keep'}
 const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',equipment:{},maxHp:20,currentHp:20,dnd5eInventory:{schemaVersion:3,entries:[]}})
 const grant=applyDnd5eInventoryGrantBundle([hero],{characterId:'hero',receiptId:'test-fortress-items',grants:[
  {templateId:'srd-5.1:item:potion-of-healing',quantity:1,structureBinding:binding},
  {templateId:'srd-5.1:item:potion-of-healing',quantity:2},
  {templateId:'srd-5.1:item:potion-of-healing',quantity:1,structureBinding:{...binding,mapId:'other'}}]})
 expect(grant.ok).toBe(true)
 f.state.characters={characters:grant.characters,selectedId:'hero',updatedAt:1,_sync:{revision:1}}
 const object={schemaVersion:1 as const,structureBinding:binding,inventoryItem:{templateId:'srd-5.1:item:potion-of-healing',quantity:1,receiptId:'object'}}
 f.state.maps.maps[0].tokens.push({id:'furniture',type:'obstacle',label:'Furniture',x:600,y:600,size:1,color:'',emoji:'',dnd5eObjectState:object})
 f.state.maps.maps.push({...f.state.maps.maps[0],id:'other-map',tokens:[
  {id:'holder',type:'enemy',label:'Holder',x:10,y:10,size:1,color:'',emoji:'',dnd5eCarriedObjects:[{id:'held',pickupReceipt:'held',label:'Item',objectState:object}]},
  {id:'unrelated',type:'obstacle',label:'Other',x:20,y:20,size:1,color:'',emoji:'',dnd5eObjectState:{...object,structureBinding:{...binding,mapId:'other'}}}]})
 const before=structuredClone(f.state)
 f.fail(true)
 await expect(f.gateway.saveResource('campaign-time',{worldMinute:10180})).rejects.toThrow('revision-conflict')
 expect(f.state).toEqual(before)
 f.fail(false)
 await f.gateway.saveResource('campaign-time',{worldMinute:10180})
 expect(f.state.maps.maps[0].tokens.map((token:any)=>token.id)).toEqual(['resident'])
 expect(f.state.maps.maps[1].tokens[0].dnd5eCarriedObjects).toBeUndefined()
 expect(f.state.maps.maps[1].tokens[1].id).toBe('unrelated')
 const entries=normalizeDnd5eInventory(f.state.characters.characters[0]).entries
 expect(entries).toHaveLength(2)
 expect(entries.find(entry=>!entry.structureBinding)?.quantity).toBe(2)
 expect(entries.find(entry=>entry.structureBinding)?.structureBinding?.mapId).toBe('other')
 expect(f.state.characters._sync.revision).toBe(2)
 await f.gateway.saveResource('campaign-time',{worldMinute:10181})
 expect(f.state.characters._sync.revision).toBe(2)
})

function fixture(){
 const map:BattleMap={id:'keep',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
 tokens:[{id:'resident',type:'enemy',label:'Resident',color:'',emoji:'',size:1,x:600,y:600,elevationFeet:10.5,hp:12,maxHp:20}]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},
 rotationDegrees:0,elevationFeet:0,createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:100}}).geometry
 const state:Record<string,any>={maps:{maps:[map],updatedAt:1,_sync:{revision:1}},'map-geometry':{schemaVersion:3,maps:[geometry],updatedAt:1,_sync:{revision:1}},
 'campaign-time':{worldMinute:10179,_sync:{revision:1}}}
 let fail=false,commits=0
 const transport={getRevisionWatermark:(name:string)=>state[name]?._sync.revision??0,
 loadResource:async(name:string)=>structuredClone(state[name]??null),
 saveResourcesAtomically:async(writes:any[],options:any)=>{
  if(Object.keys(options?.readRevisions??{}).some(name=>writes.some(w=>w.name===name)))throw Error('duplicate-read-write')
  if(fail||writes.some(w=>w.expectedRevision!==state[w.name]?._sync.revision)||
    Object.entries(options?.readRevisions??{}).some(([name,revision])=>revision!==(state[name]?._sync.revision??0)))throw Error('revision-conflict')
  const revisions:Record<string,number>={}
  for(const w of writes){revisions[w.name]=state[w.name]._sync.revision+1;state[w.name]={...structuredClone(w.data),_sync:{revision:revisions[w.name]}}}
  commits++
  return {status:'committed',transactionId:'test',revisions}
 }} as unknown as SharedRoomGatewayPort
 return {state,gateway:withStructureExpiry(transport),transport,fail:(value:boolean)=>{fail=value},commits:()=>commits}
}

it.each(['plain','combat-credit','provided-writes','not-expired','move-out','move-in','cross-map'] as const)('settles temple healing atomically with %s',async mode=>{
 const f=fixture(),scene=f.state['map-geometry'].maps[0]
 const record=scene.structureLifetimes[0]
 delete record.fortressServices
 Object.assign(record,{replacementGroup:'temple-of-the-gods',createdWorldMinute:10179,expiresWorldMinute:10180,
  objectBoundary:{points:[{x:100,y:100},{x:1500,y:100},{x:1500,y:1500},{x:100,y:1500}],bottomFeet:0,topFeet:100},
  templeWard:{hostileCreatureTypes:['fiend'],healingBonus:5,saveDc:18,lighting:'none'}})
 if(mode==='not-expired')record.expiresWorldMinute=10182
 const effect=(id:string)=>createDnd5eMechanicalEffect({definitionId:'regenerate',label:'Regenerate',targetId:id,source:{kind:'spell',actorId:'healer',spellLevel:7,magical:true},
  duration:{type:'rounds',remainingRounds:100,tickOn:'target-turn-end'},periodicHealing:{timing:'target-turn-start',amount:1}})
 const hero=normalizeCharacter({id:'hero',name:'Hero',currentHp:1,maxHp:500,dnd5eWorldTimeAppliedMinute:10178,dnd5eCombatState:{schemaVersion:2,activeEffects:[effect('hero')]}})
 f.state.characters={characters:[hero],_sync:{revision:1}}
 const resident=f.state.maps.maps[0].tokens[0]
 Object.assign(resident,{hp:1,maxHp:500,dnd5eWorldTimeAppliedMinute:10178,dnd5eCombatState:{schemaVersion:2,activeEffects:[effect('resident')]}})
 f.state.maps.maps[0].tokens.push({...resident,id:'hero-token',characterId:'hero',dnd5eCombatState:undefined})
 if(mode==='move-in')for(const token of f.state.maps.maps[0].tokens)token.x=1900
 const clock=normalizeSharedCampaignTime({worldMinute:10181,advances:mode==='combat-credit'?[{id:'combat',kind:'advance',fromWorldMinute:10179,toWorldMinute:10180,minutes:1,reason:'combat',dawnsCrossed:0,expiredTimerIds:[],createdAt:1,
 combatRoundCredits:{'["character","hero"]':10,'["token","keep","resident"]':10}}]:[]})
 const moving=['move-in','move-out','cross-map'].includes(mode)
 const commit=()=>{
 const maps=structuredClone(f.state.maps)
 if(moving){
  for(const token of maps.maps[0].tokens)token.x=mode==='move-in'?600:1900
  if(mode==='cross-map'){
   maps.maps.push({...maps.maps[0],id:'destination',tokens:maps.maps[0].tokens})
   maps.maps[0].tokens=[]
  }
 }
 return mode==='provided-writes'||moving?f.gateway.saveResourcesAtomically([
  {name:'campaign-time',data:clock,expectedRevision:f.state['campaign-time']._sync.revision},
  {name:'characters',data:structuredClone(f.state.characters),expectedRevision:f.state.characters._sync.revision},
  {name:'maps',data:maps,expectedRevision:f.state.maps._sync.revision},
 ]):f.gateway.saveResource('campaign-time',clock)
 }
 const before=structuredClone(f.state)
 if(mode==='provided-writes'){
  await expect(f.gateway.saveResourcesAtomically([
   {name:'campaign-time',data:clock,expectedRevision:1},
   {name:'characters',data:structuredClone(f.state.characters),expectedRevision:1},
  ],{readRevisions:{characters:0}})).rejects.toThrow('structure-expiry-revision-conflict')
  expect(f.state).toEqual(before)
 }
 f.fail(true)
 await expect(commit()).rejects.toThrow('revision-conflict')
 expect(f.state).toEqual(before)
 f.fail(false)
 await commit()
 const expected=mode==='combat-credit'?21:mode==='not-expired'?131:mode==='move-in'?31:81
 expect(f.state.characters.characters[0].currentHp).toBe(expected)
 expect(f.state.maps.maps.flatMap((map:any)=>map.tokens).find((token:any)=>token.id==='resident').hp).toBe(expected)
 if(moving)expect(f.state.maps.maps.flatMap((map:any)=>map.tokens).find((token:any)=>token.id==='resident').x).toBe(mode==='move-in'?600:1900)
 expect(f.state['map-geometry'].maps[0].structureLifetimes).toHaveLength(mode==='not-expired'?1:0)
 expect(f.state.characters.characters[0].dnd5eWorldTimeAppliedMinute).toBe(10181)
 const committed=structuredClone(f.state)
 await f.gateway.saveResource('campaign-time',normalizeSharedCampaignTime({worldMinute:10181}))
 expect(f.state.characters).toEqual(committed.characters)
 expect(f.state.maps).toEqual(committed.maps)
})

it('publishes clock, geometry removal and harmless descent together; a conflict changes none',async()=>{
 const f=fixture(),before=structuredClone(f.state)
 f.fail(true)
 await expect(f.gateway.saveResource('campaign-time',{worldMinute:10180})).rejects.toThrow('revision-conflict')
 expect(f.state).toEqual(before)
 f.fail(false)
 const result=await f.gateway.saveResourceWithResult('campaign-time',{worldMinute:10180})
 expect(result).toEqual({status:'saved',revision:2})
 expect(f.state.maps.maps[0].tokens[0]).toMatchObject({elevationFeet:0,hp:12})
 expect(f.state['map-geometry'].maps[0].obstacles).toEqual([])
 expect(f.state['map-geometry'].maps[0].structureLifetimes).toEqual([])
 expect(f.state.maps._sync.revision).toBe(2)
 await f.gateway.saveResource('campaign-time',{worldMinute:10181})
 expect(f.state.maps._sync.revision).toBe(2)
})

it('uses a map update already in the transaction and rejects its stale revision',async()=>{
 const f=fixture(),maps=structuredClone(f.state.maps)
 maps.maps[0].tokens[0].hp=9
 const writes=[{name:'maps',data:maps,expectedRevision:0},{name:'campaign-time',data:{worldMinute:10180},expectedRevision:1}]
 await expect(f.gateway.saveResourcesAtomically(writes)).rejects.toThrow('revision-conflict')
 expect(f.state.maps.maps[0].tokens[0].hp).toBe(12)
 writes[0].expectedRevision=1
 await f.gateway.saveResourcesAtomically(writes)
 expect(f.state.maps.maps[0].tokens[0]).toMatchObject({hp:9,elevationFeet:0})
 expect(maps.maps[0].tokens[0].elevationFeet).toBe(10.5)
})

it('also expires the structure in the combat-round clock transaction',async()=>{
 const f=fixture()
 f.state['campaign-time']={...normalizeSharedCampaignTime({worldMinute:10179}),_sync:{revision:1}}
 f.state.combat={combatId:'battle',active:true,round:1,mapId:'keep',initiativeOrder:[{tokenId:'resident'}],_sync:{revision:1}}
 const gateway=withCombatRoundClock(withStructureExpiry(f.transport))
 for(let round=1;round<=11;round++)await gateway.saveResource('combat',{...f.state.combat,round})
 expect(f.state['campaign-time'].worldMinute).toBe(10180)
 expect(f.state['map-geometry'].maps[0].obstacles).toEqual([])
 expect(f.state.maps.maps[0].tokens[0]).toMatchObject({hp:12,elevationFeet:0})
})

it.each(['caster','other-caster'])('recasting elsewhere replaces only the matching caster fortress (%s)',async(casterId)=>{
 const f=fixture()
 const destination:BattleMap={...f.state.maps.maps[0],id:'elsewhere',tokens:[]}
 const next=placeDnd5eMightyFortressKeep({map:destination,geometry:createEmptyMapGeometry(destination.id,1),structureId:'new-keep',origin:{x:100,y:100},
  rotationDegrees:0,elevationFeet:0,createdAt:2,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId,worldMinute:10179}}).geometry
 const geometry={...f.state['map-geometry'],maps:[...f.state['map-geometry'].maps,next]}
 const maps={...f.state.maps,maps:[...f.state.maps.maps,destination]}
 const writes=[{name:'maps',data:maps,expectedRevision:1},{name:'map-geometry',data:geometry,expectedRevision:1}]
 f.fail(true)
 await expect(f.gateway.saveResourcesAtomically(writes)).rejects.toThrow('revision-conflict')
 expect(f.state.maps.maps[0].tokens[0].elevationFeet).toBe(10.5)
 f.fail(false)
 await f.gateway.saveResourcesAtomically(writes)
 expect(f.state['map-geometry'].maps[0].structureLifetimes).toHaveLength(casterId==='caster'?0:1)
 expect(f.state.maps.maps[0].tokens[0]).toMatchObject({elevationFeet:casterId==='caster'?0:10.5,hp:12})
 expect(f.state['map-geometry'].maps[1].structureLifetimes).toHaveLength(1)
 expect(f.state['campaign-time']._sync.revision).toBe(1)
})

it('makes a same-site year-long weekly streak permanent through the publication boundary',async()=>{
 const f=fixture(),record=f.state['map-geometry'].maps[0].structureLifetimes[0]
 let history:import('../../shared/structure-casting-history.mjs').StructureCastingHistory[]=[]
 for(let day=0;day<=364;day+=7){
  const minute=day*1440
  const result=recordStructureCasting(history,{...record,id:`cast-${day}`,createdWorldMinute:minute},minute,10080,365*1440)
  expect(result.permanent).toBe(false)
  history=JSON.parse(JSON.stringify(result.history))
 }
 f.state['map-geometry'].maps[0].structureCastingHistory=history
 f.state['campaign-time'].worldMinute=365*1440
 const geometry=structuredClone(f.state['map-geometry'])
 geometry.maps[0].structureLifetimes=[{...record,id:'cast-final',createdWorldMinute:365*1440,expiresWorldMinute:372*1440}]
 await f.gateway.saveResource('map-geometry',geometry)
 expect(f.state['map-geometry'].maps[0].structureLifetimes[0].expiresWorldMinute).toBeNull()
 const restored=normalizeMapGeometry(JSON.parse(JSON.stringify(f.state['map-geometry'].maps[0])))!
 expect(restored.structureCastingHistory).toEqual(f.state['map-geometry'].maps[0].structureCastingHistory)
 expect(normalizeMapGeometry({...restored,structureCastingHistory:[...restored.structureCastingHistory!,...restored.structureCastingHistory!]})).toBeUndefined()
 await f.gateway.saveResource('campaign-time',{worldMinute:500*1440})
 expect(f.state['map-geometry'].maps[0].obstacles.length).toBeGreaterThan(0)
 expect(f.state.maps.maps[0].tokens[0].elevationFeet).toBe(10.5)
 const gap=recordStructureCasting(history,{...record,id:'gap',createdWorldMinute:372*1440},372*1440,10080,365*1440)
 expect(gap.permanent).toBe(false)
 expect(gap.history[0].firstWorldMinute).toBe(372*1440)
 expect(()=>recordStructureCasting(history,{...record,id:'cast-364',createdWorldMinute:364*1440},364*1440,10080,365*1440)).toThrow('structure-casting-history-replay')
})

it('keeps residents on the replacement floor when renewing at the same site',async()=>{
 const f=fixture(),map=f.state.maps.maps[0]
 f.state['campaign-time'].worldMinute=10180
 const next=placeDnd5eMightyFortressKeep({map,geometry:f.state['map-geometry'].maps[0],structureId:'renewed',origin:{x:100,y:100},
  rotationDegrees:0,elevationFeet:0,createdAt:2,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:10180}}).geometry
 await f.gateway.saveResource('map-geometry',{...f.state['map-geometry'],maps:[next]})
 expect(f.state['map-geometry'].maps[0].structureLifetimes.map((r:any)=>r.id)).toEqual(['renewed'])
 expect(f.state.maps.maps[0].tokens[0]).toMatchObject({hp:12,elevationFeet:10.5})
})

it('publishes a permanent temple after the final daily cast and retains another existing temple',async()=>{
 const f=fixture(),stored=f.state['map-geometry'].maps[0],record=stored.structureLifetimes[0]
 delete record.fortressServices
 record.replacementGroup='temple-of-the-gods'
 record.expiresWorldMinute=null
 let history:import('../../shared/structure-casting-history.mjs').StructureCastingHistory[]=[]
 for(let day=0;day<364;day++){
  const entry={...record,id:`day:${day}`,createdWorldMinute:day*1440}
  history=recordDailyStructureCasting(history,entry,entry.createdWorldMinute).history
 }
 stored.structureCastingHistory=history
 const targetSite=record.siteKey
 record.siteKey='another-existing-temple-site'
 f.state['campaign-time'].worldMinute=364*1440
 const geometry=structuredClone(f.state['map-geometry'])
 const wall={...geometry.maps[0].obstacles[0],id:'temple-final-wall'}
 geometry.maps[0].obstacles.push(wall)
 geometry.maps[0].structureLifetimes.push({...record,id:'final-temple',siteKey:targetSite,createdWorldMinute:364*1440,expiresWorldMinute:365*1440,entityIds:[wall.id]})
 await f.gateway.saveResource('map-geometry',geometry)
 expect(f.state['map-geometry'].maps[0].structureLifetimes).toHaveLength(2)
 expect(f.state['map-geometry'].maps[0].structureLifetimes.find((r:any)=>r.id==='final-temple').expiresWorldMinute).toBeNull()
 await f.gateway.saveResource('campaign-time',{worldMinute:800*1440})
 expect(f.state['map-geometry'].maps[0].structureLifetimes).toHaveLength(2)
})

it('replaces an early same-site recast before the previous expiry',async()=>{
 const f=fixture(),map=f.state.maps.maps[0]
 f.state['campaign-time'].worldMinute=200
 const next=placeDnd5eMightyFortressKeep({map,geometry:f.state['map-geometry'].maps[0],structureId:'renewed',origin:{x:100,y:100},
  rotationDegrees:0,elevationFeet:0,createdAt:2,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:200}}).geometry
 await f.gateway.saveResource('map-geometry',{...f.state['map-geometry'],maps:[next]})
 expect(f.state['map-geometry'].maps[0].structureLifetimes.map((r:any)=>r.id)).toEqual(['renewed'])
 expect(f.state.maps.maps[0].tokens[0]).toMatchObject({hp:12,elevationFeet:10.5})
})
