import{createDnd5ePluginSpellCompoundPrimaryAnsweredCollector}from'./pluginSpellCompoundPrimaryAnswered'
import{captureDnd5ePluginSpellCompoundPrimaryPendingQualification,readDnd5ePluginSpellCompoundPrimaryPendingQualification}from'./pluginSpellCompoundPrimaryPendingQualification'
import{persistBountifulOriginalParent}from'./bountifulLuckPersistentHost'





import{createBountifulPluginSpellCompoundPrimaryRaw,readBountifulPluginSpellSavingOriginalDiceRoute}from'../../pages/maps/bountifulPluginSpellSavingOriginalRaw'




import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{it,expect,vi}from'vitest'
import{actualFiniteSavingSource}from'./testFixtures/bountifulFiniteSaving.scene.fixture'
import{damageZeroNormalAckHttpFixture}from'./pluginSpellSavingOriginal.http.support'
import{createDnd5ePluginSpellCompoundPrimaryObserver,readDnd5ePluginSpellCompoundPrimaryOperation}from'./pluginSpellCompoundPrimaryOperation'
import{encodeSecondChanceParentWire,decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'./turnEconomy'

it('genuine primary original one mints only its own authenticated attack B parent',async()=>{const adoptedFace:number=1;
 const f=await actualFiniteSavingSource('ice-knife'),http=await damageZeroNormalAckHttpFixture(),source={...f.source,now:1000,rolls:{}},p=source.prepared,initial=createDnd5ePluginSpellCompoundPrimaryObserver(source)
 try{
  const state=p.state,economies=Object.fromEntries(Object.entries(state.combatants).map(([id,actor])=>[id,projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':'+(state.initiativeOrder[state.initiativeIndex]===id?(state.initiativeSlotIds?.[state.initiativeIndex]??id):id),actor.speed),actor.turn,actor.speed)])),data:Record<string,any>={characters:{characters:p.characters},maps:{maps:[p.map]},combat:{active:true,mapId:p.map.id,combatId:state.combatId,round:state.round,initiativeIndex:state.initiativeIndex,initiativeOrder:state.initiativeOrder.map(tokenId=>({tokenId})),dnd5eTurnEconomyByToken:economies},'map-geometry':{maps:[]},'campaign-time':{clock:0},'player-action-requests':{requests:[p.action]},'player-action-processed':{actionIds:[]}}
  for(const value of Object.values(data))value._sync={revision:1,schemaVersion:1,writerId:'host',writtenAt:1};const before=structuredClone(data),id={parentId:p.action.id,mapId:p.map.id,combatId:state.combatId},load=async(member='host')=>http.state('POST','bountiful-plugin-spell-saving-original/source',{...id,poolKind:'primary'},data,member),stage=initial.run();expect(stage.status).toBe('missing-activity-attack-original');const op=initial.operation(stage),facts=readDnd5ePluginSpellCompoundPrimaryOperation(op);if(facts.kind!=='missing')throw Error('Actual missing primary required');expect(()=>readDnd5ePluginSpellCompoundPrimaryOperation(structuredClone(op))).toThrow();const registration={sourceKind:'plugin-spell-saving-original-v1',phase:'primary-register',...id,source:encodeSecondChanceParentWire(facts.source),request:facts.request,effectTimestamp:facts.effectTimestamp,label:'真实冰刀主攻击'}
  expect((await http.event('bountiful-native-raw-source-dm-to-host',registration,data,'spectator')).status).toBe(403);expect((await http.event('bountiful-native-raw-source-dm-to-host',{...registration,request:{...facts.request,actorId:'caster-token'}},data,'host')).status).toBe(403);expect((await http.event('bountiful-native-raw-source-dm-to-host',registration,data,'host')).status).toBe(200);const registered=await load();expect(registered.status,JSON.stringify(registered.payload)).toBe(200);const book=registered.payload,row=book.rows[0];expect(book.rows).toHaveLength(1);expect(row).toMatchObject({kind:'attack',actorId:'support-token',targetId:'caster-token',count:1,sides:20});expect((await load(row.memberId)).status).toBe(403);const raw=await createBountifulPluginSpellCompoundPrimaryRaw(op,{publishEvent:async(channel,payload)=>{const response=await http.event(channel,payload,data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200)}},async()=>{const response=await load();if(response.status!==200)throw Error('Current primary required');return response.payload},row.label);expect(await readBountifulPluginSpellSavingOriginalDiceRoute(raw.route)).toMatchObject({rollKind:'attack',rollerTokenId:row.actorId,count:1,sides:20});await expect(readBountifulPluginSpellSavingOriginalDiceRoute(structuredClone(raw.route))).rejects.toThrow()
  const request={...id,requestId:row.requestId,rollerTokenId:row.actorId,targetCharacterId:row.characterId,kind:'dice',count:row.count,sides:20,label:row.label,targetName:p.actor.name,values:[],rollKind:'attack',sourceMode:'dm',delivery:'player-roll-request',eventId:'actual-ice-knife-primary-request',updatedAt:1};expect((await http.event('dice-roll-request-dm-to-player',request,data,'host')).status).toBe(200);expect((await http.event('dice-roll-request-player-to-dm',{...request,sourceMode:'player',delivery:'player-roll-result',values:[16]},data,row.memberId)).status).toBe(403);expect((await http.event('dice-roll-request-player-to-dm',{...request,sourceMode:'player',delivery:'player-roll-start',values:[16]},data,'spectator')).status).toBe(403);expect((await http.event('bountiful-native-raw-source-dm-to-host',{...id,sourceKind:'plugin-spell-saving-original-v1',phase:'confirm',requestId:row.requestId,rawValues:[16],values:[adoptedFace]},data,'host')).status).toBe(403)
  for(const delivery of['player-roll-start','player-roll-result'])expect((await http.event('dice-roll-request-player-to-dm',{...request,sourceMode:'player',delivery,values:[16]},data,row.memberId)).status).toBe(200);expect((await load()).payload.rows[0].confirmed).toBeUndefined();expect((await http.event('bountiful-native-raw-source-dm-to-host',{...id,sourceKind:'plugin-spell-saving-original-v1',phase:'confirm',requestId:row.requestId,rawValues:[16],values:[adoptedFace]},data,'host')).status).toBe(200);const adopted=(await load()).payload;expect(adopted.rows[0].raw.values).toEqual([16]);expect(adopted.rows[0].confirmed.values).toEqual([adoptedFace]);expect((await http.event('bountiful-native-raw-source-dm-to-host',{...registration,request:{...facts.request,mode:'advantage',count:2}},data,'host')).status).toBe(403)
  const restored=decodeSecondChanceParentWire(adopted.source)as typeof source;let complete:Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]={...restored,rolls:{activityRolls:{[row.rollId]:{values:[...adopted.rows[0].confirmed.values],modifier:0,total:adoptedFace}}}};

  const worker=createDnd5ePluginSpellCompoundPrimaryAnsweredCollector(complete)
  try{
   const pending=worker.run();expect(pending.status).toBe('pending-ally-natural-one');if(pending.status!=='pending-ally-natural-one')throw Error('Actual primary B required')
   const cap=worker.pending(pending),qualification=captureDnd5ePluginSpellCompoundPrimaryPendingQualification(cap,adopted),current=readDnd5ePluginSpellCompoundPrimaryPendingQualification(qualification)
   expect(current.request).toMatchObject({kind:'attack',actorId:row.actorId,originalRolls:[1]});expect(current.rawIssuer).toEqual({mode:'dm',rollId:row.requestId,cursor:1})
   expect(()=>captureDnd5ePluginSpellCompoundPrimaryPendingQualification(structuredClone(cap),adopted)).toThrow()
   expect(()=>captureDnd5ePluginSpellCompoundPrimaryPendingQualification(cap,{...adopted,rows:[...adopted.rows,...adopted.rows]})).toThrow()
   const gateway={loadResource:async<T>(name:string)=>{try{return await http.readActualResource(name) as T}catch(error){if((error as {code?:string}).code==='ENOENT')return null as T;throw error}},publishEvent:async(channel:string,payload:unknown)=>{const response=await http.event(channel,payload,data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200)},saveResourcesAtomically:async(writes:readonly {name:string;expectedRevision:number;data:unknown}[],tx?:{transactionId?:string;readRevisions?:Record<string,number>})=>{const response=await http.state('POST','transaction',{transactionId:tx?.transactionId,writes,readRevisions:tx?.readRevisions},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200);for(const write of writes)data[write.name]=await http.readActualResource(write.name);return{status:'committed' as const,transactionId:tx?.transactionId??'',revisions:Object.fromEntries(writes.map(write=>[write.name,data[write.name]._sync.revision]))}}}
   await persistBountifulOriginalParent({parentId:p.action.id,source:current.source,resolve:resolvePreparedDnd5ePluginSpellCast,actorId:row.actorId,kind:'attack',pluginSpellCompoundPrimaryOriginalQualification:qualification},gateway)
   const receiptId=JSON.stringify(['bountiful-original-parent',p.action.id,0]),receipt=data.combat.bountifulOriginalParents[receiptId]
   expect(receipt.request).toMatchObject({kind:'attack',actorId:row.actorId,originalRolls:[1]});expect(receipt.rawIssuer).toEqual(current.rawIssuer)
   const after=await load();expect(after.status,JSON.stringify(after.payload)).toBe(200);expect(after.payload.rows[0].confirmed.values).toEqual([1])
   for(const name of Object.keys(before).filter(name=>name!=='combat'))expect(await http.readActualResource(name)).toEqual(before[name])
   for(const token of Object.keys(p.state.combatants))expect(data.combat.dnd5eTurnEconomyByToken[token]).toEqual(before.combat.dnd5eTurnEconomyByToken[token])
   worker.close();expect(()=>readDnd5ePluginSpellCompoundPrimaryPendingQualification(qualification)).toThrow()
  }finally{worker.close()}
  raw.close();await expect(readBountifulPluginSpellSavingOriginalDiceRoute(raw.route)).rejects.toThrow();
 }finally{initial.close();f.dispose();await http.close()}
},60000)

vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
