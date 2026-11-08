import {cloneDnd5eHostTransactionInput,registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot} from './hostTransactionClone'
import * as sharedApi from '../../lib/sharedApi'
import {decodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {readBountifulNativePreparedReplay} from './bountifulNativePreparedRecovery'
import {captureSecondChancePreparedHostFacts,restoreSecondChancePreparedHostFacts,restoreSecondChancePreparedHostFactsAsync} from '../../pages/maps/secondChancePreparedHostFacts'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {recordBountifulHostMonsterAfterDice} from './bountifulHostMonsterAfterDice'
import {driveBountifulHostMonsterOriginal} from './bountifulHostOperationDriver'
import {routeBountifulOriginalResponse} from './bountifulOriginalResponseRouter'
import {createBountifulHostMonsterRawBoundary} from './bountifulHostMonsterRawBoundary'
import {submitBountifulOwnedDiceResult,submitBountifulHostConfirmation} from './bountifulLuckClientCommands'
import {restoreClassResources} from '../../lib/classResources'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from './mapBridge'
import {resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {persistBountifulHostOperation,recoverBountifulHostOperation,recordBountifulHostMonsterDamage} from './bountifulHostOperationPersistent'
import {resolveBountifulHostMonsterForMap,publishBountifulHostMonsterMapResult} from './bountifulHostMonsterMapPublication'
import {resolveDnd5ePreparedWithMaterialDamageReactions} from './damageReactionFlow'
import {bountifulOriginalDieRollId} from './bountifulLuckReceipt'
import {bountifulReadyHttpFixture} from './bountifulLuck.ready-authority.testSupport'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import{it,expect,vi}from'vitest'
import{normalizeCharacter}from'../../store/characters'
import{prepareDnd5eLocalContentJson}from'./localContentCollection'
import{registerDnd5eRulesPlugin}from'./pluginApi'
import{dnd5eRulesPluginFromContentPackageV2}from'./contentPackageV2'
import{bountifulLuckTestContent}from'./bountifulLuckTestContent'
import{prepareDnd5eMonsterAttack,resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{getDnd5eSrdMonster}from'./monsters'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{captureBountifulMonsterOriginalOperation,bountifulIssuedHostOperation,bountifulNativePreparedRecoveryFacts}from'./bountifulHostOperation'
import{durableD20RollId}from'../../lib/rollConfirmation'
import type{BattleMap}from'../../store/maps'
const roomSession=vi.hoisted(()=>({value:{roomId:'room',memberId:'host',role:'dm'}}));vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>roomSession.value}))

it.each([{decision:'use',replacement:15,nativeLucky:false},{decision:'use',replacement:1,nativeLucky:false},{decision:'decline',replacement:15,nativeLucky:false},{decision:'decline',replacement:1,nativeLucky:true}] as const)('persists and reloads a real PC-controlled native monster original, actual authenticated raw and owner %s and final native CAS',async({decision,replacement,nativeLucky})=>{
 const{package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30}),first=restoreClassResources(normalizeCharacter({id:'first',name:'First',charClass:'德鲁伊',dnd5eClassLevels:{druid:4},dnd5eClassChoices:{classes:{druid:{selections:{'wild-shape-known-forms':['srd-5.1:cat']}}}},level:4,race:nativeLucky?'半身人':'人类',dnd5eRaceId:nativeLucky?'halfling':'human',roomMemberId:'first-member',currentHp:30,maxHp:30}),'long-rest');let characters=[helper,first]
  let map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'skeleton',characterId:'first',label:'Actual Wild Shape',x:25,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'goblin',poolId:'srd-5.1:goblin',label:'Goblin',x:75,y:25,size:1,type:'enemy',hp:20,maxHp:20,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:75,size:1,type:'player',color:'',emoji:''}]}
  const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),monster=getDnd5eSrdMonster('srd-5.1:cat')
  if(!monster)throw Error('Actual SRD skeleton required')
  const beforeShape=createDnd5eMapCombatSnapshot({combatId:'actual-precombat-shape',map,characters,initiativeOrder}),shape=resolveDnd5eHeadlessAction(beforeShape.state,{type:'druid-wild-shape',actorId:'skeleton',formId:'srd-5.1:cat'})
  expect(shape.ok).toBe(true);if(!shape.ok)throw Error(shape.reason)
  const shaped=planDnd5eMapResultApplication({state:shape.state,events:[...shape.events],map,characters,characterIdByCombatantId:beforeShape.characterIdByCombatantId});characters=shaped.characters;map=shaped.map
  expect(characters.find(character=>character.id==='first')?.classResources?.['dnd5e-wild-shape'].current).toBe(1)
  expect(characters.find(character=>character.id==='first')?.dnd5eCombatState?.wildShapeFormId).toBe('srd-5.1:cat')
  const prepared=prepareDnd5eMonsterAttack({combatId:'combat',round:1,map,characters,initiativeOrder,actorTokenId:'skeleton',targetTokenId:'goblin',actionIndex:monster.actions.findIndex(action=>action.attack?.mode==='melee')})
  if(!prepared.ok)throw Error(prepared.reason)
  const source={prepared:prepared.prepared,transactionId:'host-monster-attack',rolls:[{d20:1,mode:'normal' as const,damageRolls:[]}]}
  const session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eMonsterAttack,'skeleton','attack')
  try{const pending=session.run(prepared.prepared.state);expect(pending.status).toBe('pending-ally-natural-one');if(pending.status!=='pending-ally-natural-one')throw Error('Actual native original one required');expect(pending.request).toMatchObject({actorId:'skeleton',originalRolls:[1],options:[{ownerId:'helper-token'}]})}finally{session.cancel()}
  const capability=captureBountifulMonsterOriginalOperation({parentId:source.transactionId,source,rawRollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:source.transactionId,occurrenceIndex:0}),rawCursor:1})
  if(!capability)throw Error('Actual native Host original boundary required')
  const http=await bountifulReadyHttpFixture()
  type Resource={_sync:{revision:number};[key:string]:unknown}
  const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},maps:[map]},combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder},'player-action-requests':{_sync:{revision:1},requests:[]}}
  for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
  const transactions:string[]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,publishEvent:async(channel,payload)=>{const response=await http.event(channel,payload,data,'host');if(response.status!==200)throw Error('HTTP '+response.status+':'+JSON.stringify(response.payload))},saveResourcesAtomically:async(writes,options)=>{
   const response=await http.state('POST','transaction',{...options,writes},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200)
   for(const write of writes)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:response.payload.revisions?.[write.name]??((data[write.name]?._sync.revision??0)+1)}}
   data.combat=response.saved;transactions.push(options?.transactionId??'')
   return{status:'committed',transactionId:options?.transactionId??'',revisions:response.payload.revisions??{}}
  }}
  try{
   await expect(persistBountifulHostOperation(capability,gateway)).rejects.toThrow('HTTP 403')
   expect(transactions).toHaveLength(0)
   const rawRollId=durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:source.transactionId,occurrenceIndex:0})
   const boundary=createBountifulHostMonsterRawBoundary({parentId:source.transactionId,prepared:prepared.prepared,mode:'normal',rawCursor:1},gateway,{showChoice:async()=>{},requestRoll:async()=>{throw Error('Owner choice still pending')}})
   await boundary.beforeOriginalRequest(rawRollId,1)
   const request={mapId:'map',combatId:'combat',requestId:rawRollId,rollerTokenId:'skeleton',targetCharacterId:'first',kind:'d20',count:1,sides:20,values:[],rollKind:'attack',delivery:'player-roll-request',sourceMode:'dm',eventId:'native-request',updatedAt:1}
   expect((await http.event('dice-roll-request-dm-to-player',request,data,'host')).status).toBe(200)
   const report={...request,delivery:'player-roll-result',values:[1],sourceMode:'player',eventId:'native-result'}
   expect((await http.event('dice-roll-request-player-to-dm',report,data,'second-member')).status).toBe(403)
   expect((await http.event('dice-roll-request-player-to-dm',report,data,'host')).status).toBe(403)
   await expect(persistBountifulHostOperation(capability,gateway)).rejects.toThrow('HTTP 403')
   expect((await http.event('dice-roll-request-player-to-dm',report,data,'first-member')).status).toBe(200)
   expect((await http.event('dice-roll-request-player-to-dm',{...report,values:[20]},data,'first-member')).status).toBe(403)
   await expect(boundary.afterOriginalConfirmed([1],rawRollId)).rejects.toThrow('bountiful-original-parent-pending')
   await expect(boundary.afterOriginalConfirmed([20],rawRollId)).rejects.toThrow('changed-confirmed-original')
   const id=JSON.stringify(['bountiful-original-parent',source.transactionId,0]),receipt=(await http.state('GET','combat',null,data,'host')).saved.bountifulOriginalParents[id]
   expect(receipt.originalRoomAction.kind).toBe('native-host-operation')
   await expect(driveBountifulHostMonsterOriginal(source.transactionId,gateway,{showChoice:async()=>{},requestRoll:async()=>{throw Error('Unexpected reroll before owner choice')}})).rejects.toThrow('bountiful-original-parent-pending')
   expect(receipt.identity.roller).toEqual({tokenId:'skeleton',characterId:'first',memberId:'first-member'})
   expect(transactions).toHaveLength(1)
   await expect(recordBountifulHostMonsterDamage(source.transactionId,[[[1]]],gateway)).rejects.toThrow('decision-still-pending')
   expect(transactions).toHaveLength(1)
   expect(data['player-action-requests'].requests).toEqual([])
   const reloaded=await http.state('GET','combat',null,data,'host')
   expect(reloaded.saved.bountifulOriginalParents[id]).toEqual(receipt)
   expect((await http.event('bountiful-original-mint-dm-to-host',{id,receipt},data,'helper-member')).status).toBe(403)
   const forged=structuredClone(receipt);forged.originalRoomAction={...forged.originalRoomAction,actorTokenId:'helper-token'}
   expect((await http.event('bountiful-original-mint-dm-to-host',{id,receipt:forged},data,'host')).status).toBe(403)
   const changed=structuredClone(receipt);changed.request.originalRolls=[20]
   expect((await http.state('PUT','combat',{...data.combat,bountifulOriginalParents:{[id]:changed}},data,'host')).status).toBe(422)
   expect(map.tokens.find(token=>token.id==='goblin')?.hp).toBe(20)
   const recovered=await recoverBountifulHostOperation(source.transactionId,gateway)
   expect(bountifulIssuedHostOperation(recovered).operation).toEqual(receipt.originalRoomAction)
   const option=receipt.request.options[0]
   const choice={id:'helper-choice',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'dnd5e-bountiful-luck',actorTokenId:'helper-token',characterId:'helper',roomMemberId:'helper-member',round:1,initiativeIndex:0,seq:1,updatedAt:1,bountifulLuck:{parentId:source.transactionId,occurrence:0,command:{phase:'reaction',...option,decision}}}
   const appended=await http.append(choice,data,'helper-member')
   expect(appended.status,JSON.stringify(appended.payload)).toBe(200);data['player-action-requests']=appended.queue
   const chosen=await routeBountifulOriginalResponse({mapId:'map',requestId:choice.id},gateway)
   expect(chosen.ownerDecisions).toMatchObject([{ownerId:'helper-token',decision,memberId:'helper-member'}])
   if(nativeLucky)await expect(driveBountifulHostMonsterOriginal(source.transactionId,gateway,{showChoice:async()=>{throw Error('Helper explicitly declined')},requestRoll:async()=>{}})).rejects.toThrow('bountiful-original-parent-pending')
   const occurrence=nativeLucky?1:0,current=nativeLucky?(await http.state('GET','combat',null,data,'host')).saved.bountifulOriginalParents[JSON.stringify(['bountiful-original-parent',source.transactionId,1])]:chosen
   if(nativeLucky)expect(current.request).toMatchObject({nativeLucky:true,actorId:'skeleton',originalRolls:[1]})
   if(decision==='use'||nativeLucky){
   const rollRequestId=bountifulOriginalDieRollId(current)
   let appendedId=''
   const client:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>={loadResource:async<T>(name:string)=>{const response=await http.state('GET',name,null,data,roomSession.value.memberId);expect(response.status).toBe(200);return response.payload as T},appendPlayerActionRequest:async action=>{const response=await http.append(action,data,roomSession.value.memberId);expect(response.status,JSON.stringify(response.payload)).toBe(200);data['player-action-requests']=response.queue;if(!action||typeof action!=='object'||!('id' in action)||typeof action.id!=='string')throw Error('Actual appended command ID required');appendedId=action.id}}
   roomSession.value={roomId:'room',memberId:'first-member',role:'player'}
   await submitBountifulOwnedDiceResult({mapId:'map',combatId:'combat',requestId:rollRequestId,characterId:'first',values:[replacement],round:1,initiativeIndex:0},client)
   expect(appendedId).not.toBe('')
   roomSession.value={roomId:'room',memberId:'host',role:'dm'}
   const raw=await routeBountifulOriginalResponse({mapId:'map',requestId:appendedId},gateway);expect(raw.rawReroll?.value).toBe(replacement)
   await submitBountifulHostConfirmation({mapId:'map',context:{parentId:source.transactionId,occurrence,combatId:'combat',actorTokenId:'skeleton',characterId:'first',rollRequestId},rawValue:replacement,value:replacement,round:1,initiativeIndex:0},client)
   const confirmed=await routeBountifulOriginalResponse({mapId:'map',requestId:appendedId},gateway);expect(confirmed.hostReroll?.value).toBe(replacement)
   const saved=await http.state('GET','combat',null,data,'host')
   expect(saved.saved.bountifulOriginalParents[JSON.stringify(['bountiful-original-parent',source.transactionId,occurrence])]).toEqual(confirmed)
   }
   await recoverBountifulHostOperation(source.transactionId,gateway)
   expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='goblin')?.hp).toBe(20)
   const preDamage=await driveBountifulHostMonsterOriginal(source.transactionId,gateway,{showChoice:async()=>{throw Error('Owner already settled')},requestRoll:async()=>{throw Error('Real raw already confirmed')}});expect(preDamage.request.values).toEqual([decision==='use'||nativeLucky?replacement:1]);expect(preDamage.snapshot.combatants.goblin.currentHp).toBe(20)
   if(decision==='use'&&replacement!==1){const dice=[prepared.prepared.attacks[0].attack.damage.map(group=>Array(group.count).fill(1))];const finalSource={...source,optionalBonusDice:[],savingThrowCounterattacks:[],rolls:[{...source.rolls[0],d20:preDamage.request.values[0]!,damageRolls:dice[0]}]};const beforeLate=transactions.length;
   const unknownSource={...finalSource,forgedOpaqueState:true};await expect(recordBountifulHostMonsterAfterDice(source.transactionId,unknownSource,gateway)).rejects.toThrow('unbound-late-source');
   const foreignPrepared=structuredClone(finalSource.prepared);foreignPrepared.map.tokens[0].x+=50;await expect(recordBountifulHostMonsterAfterDice(source.transactionId,{...finalSource,prepared:foreignPrepared},gateway)).rejects.toThrow('changed-original-source');
   await expect(recordBountifulHostMonsterAfterDice(source.transactionId,{...finalSource,rolls:[{...finalSource.rolls[0],d20:20}]},gateway)).rejects.toThrow('changed-retained-original');
   const storedNative=(await http.state('GET','combat',null,data,'host')).saved.bountifulOriginalParents[id],forgedNative={...storedNative,continuation:{hostMemberId:'host',source:encodeSecondChanceParentWire({...source,forgedOpaqueState:true})}};
   const rejected=await http.state('POST','transaction',{transactionId:'bountiful-native-invalid-late:'+source.transactionId,writes:[{name:'combat',expectedRevision:data.combat._sync.revision,data:{...data.combat,bountifulOriginalParents:{[id]:forgedNative}}}]},data,'host');expect(rejected.status,JSON.stringify(rejected.payload)).toBe(409);expect(JSON.stringify(rejected.payload)).toContain('bountiful-original-native-damage-source-required');expect(transactions).toHaveLength(beforeLate);
   await recordBountifulHostMonsterAfterDice(source.transactionId,finalSource,gateway);await recoverBountifulHostOperation(source.transactionId,gateway,{includeDamage:true});const count=transactions.length;await recordBountifulHostMonsterAfterDice(source.transactionId,finalSource,gateway);expect(transactions).toHaveLength(count);await expect(recordBountifulHostMonsterDamage(source.transactionId,[[[2]]],gateway)).rejects.toThrow('damage-already-confirmed')}
   const nativeReplay=await readBountifulNativePreparedReplay(source.transactionId,gateway),envelope=decodeSecondChanceParentWire(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(nativeReplay)));
   const mixed=cloneDnd5eHostTransactionInput(nativeReplay),foreignSlot=Symbol('unrelated-host-capability');registerDnd5eHostReceiptSlot(foreignSlot);Object.defineProperty(mixed.prepared,foreignSlot,{value:registerDnd5eHostReceipt({unrelated:true}),enumerable:false});expect(()=>captureSecondChancePreparedHostFacts(mixed)).toThrow('mixed-native-capability-unsupported');
   expect(envelope).toMatchObject({recovery:{bountifulNative:{parentId:source.transactionId}}});expect(()=>restoreSecondChancePreparedHostFacts(envelope)).toThrow('async-host-recovery-required');
   const hostRead=vi.spyOn(sharedApi,'loadSharedResource').mockImplementation(async<T>(name:string)=>{const result=await http.state('GET',name,null,data,'host');if(result.status===404)return null;expect(result.status).toBe(200);return result.payload as T});
   try{
    const recoveredNative=await restoreSecondChancePreparedHostFactsAsync(envelope);expect(bountifulNativePreparedRecoveryFacts(recoveredNative)).toEqual({parentId:source.transactionId});
    const changed=encodeSecondChanceParentWire(envelope);for(const node of changed.nodes)if(node.kind==='object')for(const pair of node.entries)if(pair[0]==='transactionId'&&pair[1]===source.transactionId)pair[1]='foreign-native-source';
    await expect(restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(changed))).rejects.toThrow('changed-protected-original');
   }finally{hostRead.mockRestore()}
   const options={combatRevision:data.combat._sync.revision,authorityUnchanged:()=>true,confirm:async()=>{throw Error('Unexpected trigger choice')},roll:async()=>{throw Error('Unexpected trigger roll')}}
   await expect(resolveBountifulHostMonsterForMap(source.transactionId,{authorityUnchanged:()=>true,resolveActual:async(_resolve,input)=>({result:{ok:true,state:input.prepared.state,events:[]},application:planDnd5eMapResultApplication({state:input.prepared.state,map:input.prepared.map,characters:input.prepared.characters,characterIdByCombatantId:input.prepared.characterIdByCombatantId})})},gateway)).rejects.toThrow('actual-facade-execution-required')
   const mounted=await resolveBountifulHostMonsterForMap(source.transactionId,{authorityUnchanged:()=>true,resolveActual:(resolve,input)=>resolveDnd5ePreparedWithMaterialDamageReactions(options,input,resolve)},gateway)
   if(!mounted.resolved.result.ok||!mounted.resolved.application)throw Error('Real materialized native result required')
   const snapshots={characters:{characters:mounted.resolved.application.characters},maps:{maps:[mounted.resolved.application.map]},combat:{active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder,updatedAt:1}}
   await expect(publishBountifulHostMonsterMapResult(JSON.parse(JSON.stringify(mounted.publication)),snapshots,gateway)).rejects.toThrow('issued-execution-required')
   expect((await publishBountifulHostMonsterMapResult(mounted.publication,snapshots,gateway)).status).toBe('committed')
   expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='goblin')?.hp).toBe(decision==='use'&&replacement===15?19:20)
   const done=await http.state('GET','combat',null,data,'host')
   expect(done.saved.bountifulOriginalParents[id].consumed.transactionId).toBe(source.transactionId)
   if(nativeLucky){expect(done.saved.bountifulOriginalParents[JSON.stringify(['bountiful-original-parent',source.transactionId,1])].consumed.transactionId).toBe(source.transactionId);expect(Object.keys(done.saved.bountifulOriginalParents)).toHaveLength(2)}
   expect(done.saved.dnd5eTurnEconomyByToken['helper-token'].reaction.current).toBe(decision==='use'?0:1)
   expect(done.saved.dnd5eTurnEconomyByToken.skeleton.action.current).toBe(0)
   const transactionCount=transactions.length
   expect((await publishBountifulHostMonsterMapResult(mounted.publication,snapshots,gateway)).status).toBe('already-committed')
   expect(transactions).toHaveLength(transactionCount)
  }finally{await http.close()}
 }finally{roomSession.value={roomId:'room',memberId:'host',role:'dm'};dispose()}
})
