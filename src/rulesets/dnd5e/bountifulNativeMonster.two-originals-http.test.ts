import {recordBountifulHostMonsterAfterDice} from './bountifulHostMonsterAfterDice'
import {createBountifulHostMonsterMapBoundary} from './bountifulHostMonsterMapBoundary'
import {publishBountifulHostMonsterMapResult,type BountifulNativeMapPublication} from './bountifulHostMonsterMapPublication'
import {createBountifulHostMonsterRawBoundary} from './bountifulHostMonsterRawBoundary'
import {migrateLegacyDnd5eConditions} from './legacyActiveEffectMigration'
import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {restoreClassResources} from '../../lib/classResources'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from './mapBridge'
import {resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {prepareDnd5eMonsterAttack,resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {getDnd5eSrdMonster} from './monsters'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {captureBountifulMonsterOriginalOperation} from './bountifulHostOperation'
import {durableD20RollId} from '../../lib/rollConfirmation'
import {persistBountifulHostOperation,recoverBountifulHostOperation} from './bountifulHostOperationPersistent'
import {driveBountifulHostMonsterOriginal} from './bountifulHostOperationDriver'
import {bountifulOriginalDieRollId} from './bountifulLuckReceipt'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {submitBountifulOwnedDiceResult,submitBountifulHostConfirmation} from './bountifulLuckClientCommands'
import {routeBountifulOriginalResponse} from './bountifulOriginalResponseRouter'
import {bountifulReadyHttpFixture} from './bountifulLuck.ready-authority.testSupport'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {BattleMap} from '../../store/maps'
const roomSession=vi.hoisted(()=>({value:{roomId:'room',memberId:'host',role:'dm'}}));vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>roomSession.value}))
it('keeps two real advantage original ones independent through authenticated native Lucky and Bountiful replacement',async()=>{
 const{package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30}),first=restoreClassResources(normalizeCharacter({id:'first',name:'First',charClass:'德鲁伊',dnd5eClassLevels:{druid:4},dnd5eClassChoices:{classes:{druid:{selections:{'wild-shape-known-forms':['srd-5.1:giant-badger']}}}},level:4,race:true?'半身人':'人类',dnd5eRaceId:true?'halfling':'human',roomMemberId:'first-member',currentHp:30,maxHp:30}),'long-rest');let characters=[helper,first]
  let map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'skeleton',characterId:'first',label:'Actual Wild Shape',x:25,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'goblin',poolId:'srd-5.1:goblin',label:'Goblin',x:75,y:25,size:1,type:'enemy',dnd5eCombatState:{conditions:['prone']},hp:20,maxHp:20,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:75,size:1,type:'player',color:'',emoji:''}]}
  
  const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),monster=getDnd5eSrdMonster('srd-5.1:giant-badger')
  if(!monster)throw Error('Actual SRD skeleton required')
  const beforeShape=createDnd5eMapCombatSnapshot({combatId:'actual-precombat-shape',map,characters,initiativeOrder}),shape=resolveDnd5eHeadlessAction(beforeShape.state,{type:'druid-wild-shape',actorId:'skeleton',formId:'srd-5.1:giant-badger'})
  expect(shape.ok).toBe(true);if(!shape.ok)throw Error(shape.reason)
  const shaped=planDnd5eMapResultApplication({state:shape.state,events:[...shape.events],map,characters,characterIdByCombatantId:beforeShape.characterIdByCombatantId});characters=shaped.characters;map=shaped.map
  expect(characters.find(character=>character.id==='first')?.classResources?.['dnd5e-wild-shape'].current).toBe(1)
  expect(characters.find(character=>character.id==='first')?.dnd5eCombatState?.wildShapeFormId).toBe('srd-5.1:giant-badger')
  const proneTarget=map.tokens.find(token=>token.id==='goblin');if(!proneTarget)throw Error('Actual target required');proneTarget.dnd5eCombatState={...proneTarget.dnd5eCombatState,conditions:['prone'],activeEffects:migrateLegacyDnd5eConditions({targetId:'goblin',conditions:['prone']})}
  const prepared=prepareDnd5eMonsterAttack({combatId:'combat',round:1,map,characters,initiativeOrder,actorTokenId:'skeleton',targetTokenId:'goblin',actionIndex:monster.actions.findIndex(action=>action.attack?.mode==='melee')})
  if(!prepared.ok)throw Error(prepared.reason)

  expect(prepared.prepared.attackModes[0],JSON.stringify({conditions:prepared.prepared.state.combatants.goblin.conditions,resolution:prepared.prepared.attackModeResolutions})).toBe('advantage')
  const source={prepared:prepared.prepared,transactionId:'native-two-originals',rolls:[{d20:1,d20Second:1,mode:'advantage' as const,damageRolls:[]}]}
  const session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eMonsterAttack,'skeleton','attack')
  try{const pending=session.run(prepared.prepared.state);expect(pending.status).toBe('pending-ally-natural-one');if(pending.status!=='pending-ally-natural-one')throw Error('Actual first original required');expect(pending.request).toMatchObject({originalRolls:[1,1],dieIndex:0})}finally{session.cancel()}
  const rawRollId=durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:source.transactionId,occurrenceIndex:0})
  const capability=captureBountifulMonsterOriginalOperation({parentId:source.transactionId,source,rawRollId,rawCursor:1})
  if(!capability)throw Error('Actual native Host original required')
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
   const boundary=createBountifulHostMonsterRawBoundary({parentId:source.transactionId,prepared:prepared.prepared,mode:'advantage',rawCursor:1},gateway,{showChoice:async()=>{},requestRoll:async()=>{}});await boundary.beforeOriginalRequest(rawRollId,2)
   const request={mapId:'map',combatId:'combat',requestId:rawRollId,rollerTokenId:'skeleton',targetCharacterId:'first',kind:'dice',count:2,sides:20,values:[],rollKind:'attack',delivery:'player-roll-request',sourceMode:'dm',eventId:'two-original-request',updatedAt:1}
   expect((await http.event('dice-roll-request-dm-to-player',request,data,'host')).status).toBe(200)
   const report={...request,delivery:'player-roll-result',values:[1,1],sourceMode:'player',eventId:'two-original-result'}
   expect((await http.event('dice-roll-request-player-to-dm',report,data,'second-member')).status).toBe(403)
   expect((await http.event('dice-roll-request-player-to-dm',report,data,'first-member')).status).toBe(200)
   await persistBountifulHostOperation(capability,gateway)
   const getRow=async(occurrence:number)=>{const response=await http.state('GET','combat',null,data,'host');return response.saved.bountifulOriginalParents[JSON.stringify(['bountiful-original-parent',source.transactionId,occurrence])] as BountifulOriginalDieReceipt}
   const client:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>={loadResource:async<T>(name:string)=>{const response=await http.state('GET',name,null,data,roomSession.value.memberId);expect(response.status).toBe(200);return response.payload as T},appendPlayerActionRequest:async action=>{const response=await http.append(action,data,roomSession.value.memberId);expect(response.status,JSON.stringify(response.payload)).toBe(200);data['player-action-requests']=response.queue;if(!action||typeof action!=='object'||!('id' in action)||typeof action.id!=='string')throw Error('Actual appended command required');appendedId=action.id}}
   let appendedId='',ownerChoices=0,rerolls=0
   const stage=await driveBountifulHostMonsterOriginal(source.transactionId,gateway,{
    showChoice:async receipt=>{
     expect(receipt.request.originalRolls).toEqual([1,1]);const die=receipt.request.dieIndex;expect(die).toBe(ownerChoices===0?0:1);const option=receipt.request.options[0];if(!option)throw Error('Actual helper required')
     const choice={id:'two-original-owner-'+ownerChoices,mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'dnd5e-bountiful-luck',actorTokenId:'helper-token',characterId:'helper',roomMemberId:'helper-member',round:1,initiativeIndex:0,seq:1,updatedAt:1,bountifulLuck:{parentId:source.transactionId,occurrence:receipt.identity.occurrence,command:{phase:'reaction',...option,decision:ownerChoices++===0?'decline':'use'}}}
     const appended=await http.append(choice,data,'helper-member');expect(appended.status,JSON.stringify(appended.payload)).toBe(200);data['player-action-requests']=appended.queue
    },
    requestRoll:async(receipt)=>{
     const native=receipt.request.nativeLucky===true,value=native?1:15;expect(receipt.request.dieIndex).toBe(native?0:1);expect(receipt.request.originalRolls).toEqual([1,1]);const rollRequestId=bountifulOriginalDieRollId(receipt)
     roomSession.value={roomId:'room',memberId:'first-member',role:'player'}
     await submitBountifulOwnedDiceResult({mapId:'map',combatId:'combat',requestId:rollRequestId,characterId:'first',values:[value],round:1,initiativeIndex:0},client)
     roomSession.value={roomId:'room',memberId:'host',role:'dm'}
     await routeBountifulOriginalResponse({mapId:'map',requestId:appendedId},gateway)
     await submitBountifulHostConfirmation({mapId:'map',context:{parentId:source.transactionId,occurrence:receipt.identity.occurrence,combatId:'combat',actorTokenId:'skeleton',characterId:'first',rollRequestId},rawValue:value,value,round:1,initiativeIndex:0},client)
     await routeBountifulOriginalResponse({mapId:'map',requestId:appendedId},gateway);rerolls++
    }
   })
   expect(stage.request.values).toEqual([1,15]);expect(stage.request.finalizedDice).toEqual([0,1]);expect(ownerChoices).toBe(2);expect(rerolls).toBe(2)
   expect((await getRow(0)).ownerDecisions[0]?.decision).toBe('decline');expect((await getRow(1)).request.nativeLucky).not.toBe(true);expect((await getRow(1)).request.dieIndex).toBe(1);expect((await getRow(1)).hostReroll?.value).toBe(15);expect((await getRow(2)).request.nativeLucky).toBe(true);expect((await getRow(2)).request.dieIndex).toBe(0);expect((await getRow(2)).hostReroll?.value).toBe(1)
   expect(stage.events.filter(event=>event.type==='halfling-lucky-rerolled')).toHaveLength(1);expect(stage.events.filter(event=>event.type==='ally-natural-one-rerolled')).toHaveLength(1)
   await recoverBountifulHostOperation(source.transactionId,gateway)
   const again=await driveBountifulHostMonsterOriginal(source.transactionId,gateway,{showChoice:async()=>{throw Error('No recursive owner choice')},requestRoll:async()=>{throw Error('Accepted replacement one must not recursively reroll')}});expect(again.request.values).toEqual([1,15])
   expect((data.characters.characters as typeof characters).find(row=>row.id==='first')?.classResources?.['dnd5e-wild-shape'].current).toBe(1)
   expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='goblin')?.hp).toBe(20)
   const finalInput={...source,rolls:[{...source.rolls[0],d20:1,d20Second:15,damageRolls:[[1]]}]}
   await recordBountifulHostMonsterAfterDice(source.transactionId,finalInput,gateway)
   let publication:BountifulNativeMapPublication|undefined
   const finalBoundary=createBountifulHostMonsterMapBoundary({parentId:source.transactionId,gateway,authorityUnchanged:()=>true,damageOptions:{combatRevision:data.combat._sync.revision,authorityUnchanged:()=>true,confirm:async()=>{throw Error('Unexpected further reaction')},roll:async()=>{throw Error('Original and damage dice are already final')}},onResolved:value=>{publication=value}})
   const resolved=await finalBoundary.resolve(finalInput)
   if(!publication||!resolved.result.ok||!resolved.application)throw Error('Actual same native parent materialization required')
   const snapshots={characters:{characters:resolved.application.characters},maps:{maps:[resolved.application.map]},combat:{active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder,updatedAt:1}}
   expect(resolved.application.map.tokens.find(token=>token.id==='goblin')?.hp).toBe(18)
   expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='goblin')?.hp).toBe(20)
   await expect(publishBountifulHostMonsterMapResult(JSON.parse(JSON.stringify(publication)),snapshots,gateway)).rejects.toThrow('issued-execution-required')
   await publishBountifulHostMonsterMapResult(publication,snapshots,gateway)
   expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='goblin')?.hp).toBe(18)
   const done=await http.state('GET','combat',null,data,'host')
   for(const row of Object.values(done.saved.bountifulOriginalParents) as BountifulOriginalDieReceipt[])expect(row.consumed?.transactionId).toBe(source.transactionId)
   expect(done.saved.dnd5eTurnEconomyByToken['helper-token'].reaction.current).toBe(0)
   const count=transactions.length;expect((await publishBountifulHostMonsterMapResult(publication,snapshots,gateway)).status).toBe('already-committed');expect(transactions).toHaveLength(count)

  }finally{roomSession.value={roomId:'room',memberId:'host',role:'dm'};await http.close()}
 }finally{dispose()}
})
