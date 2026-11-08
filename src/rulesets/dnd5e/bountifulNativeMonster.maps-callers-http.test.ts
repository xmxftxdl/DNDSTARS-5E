import { readMapsWorkspaceSource } from '../../__tests__/mapsWorkspaceSource'
import{readMastermindNativeDirectOwnerResume}from'../../pages/maps/mastermindNativeDirectOwnerResume'
import{collectMastermindNativeDirectOwnerOriginal}from'../../pages/maps/mastermindMisdirectionNativeParent'
import{readMastermindNativeWardResume}from'../../pages/maps/mastermindNativeWardResume'
import{readBountifulMonsterZeroMapResume}from'./bountifulMonsterZeroMapResume'
import{collectMastermindNativeMonsterOriginal}from'../../pages/maps/mastermindMisdirectionNativeParent'
import{isDiceCharacterControlledByRemotePlayer}from'../../pages/maps/diceOwnership'
import{readArcaneMovementPlayerDiceOwner}from'../../pages/maps/arcaneMovementDiceTransport'
import{readBountifulOpportunitySettlementDiceRoute}from'./bountifulOpportunitySettlementDice'
import{readBountifulOpportunitySequencePlayerDiceOwner}from'./bountifulOpportunitySequenceSource'
import{readArcaneBasePrefixPlayerDiceOwner}from'../../pages/maps/arcaneBasePrefixDiceTransport'
declare const __XGE_MAPS_SOURCE_PATH__:string|undefined
import {MAP_GEOMETRY_SCHEMA_VERSION} from '../../lib/mapGeometry'
import {readBountifulNativeDiceRoute} from './bountifulHostOperation'
import ts from 'typescript'
import {createBountifulPersistentRoomUI} from './bountifulLuckPersistentRoomUI'
import {dnd5ePreparedMonsterAttackAutomaticallyHits} from './monsterAttackAction'
import {bountifulDeferredD20RequestId,prepareBountifulDeferredExtraD20} from './bountifulLuckDeferredD20'
import {createBountifulHostMonsterMapBoundary} from './bountifulHostMonsterMapBoundary'
import type {BountifulNativeMapPublication} from './bountifulHostMonsterMapPublication'
import {commitD20ChoiceReroll} from '../../pages/maps/commitD20ChoiceReroll'
import {createD20RollConfirmationInterrupt,createD20ChoiceRerollContribution} from '../../lib/rollConfirmation'
import {dnd5eCoreInspirationChoiceRerollOption} from '../../lib/d20InterruptPolicy'
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

it.each([{decision:'decline',replacement:17,nativeLucky:false,enemyController:false},{decision:'decline',replacement:17,nativeLucky:false,enemyController:true}] as {decision:'decline'|'use';replacement:number;nativeLucky:boolean;enemyController:boolean}[])('persists and reloads a real PC-controlled native monster original, actual authenticated raw and owner %s and final native CAS',async({decision,replacement,nativeLucky,enemyController})=>{
 const{package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30}),first=restoreClassResources(normalizeCharacter({id:'first',name:'First',charClass:'德鲁伊',dnd5eClassLevels:{druid:4},dnd5eClassChoices:{classes:{druid:{selections:{'wild-shape-known-forms':['srd-5.1:cat']}}}},level:4,race:nativeLucky?'半身人':'人类',dnd5eRaceId:nativeLucky?'halfling':'human',roomMemberId:'first-member',currentHp:30,maxHp:30}),'long-rest');first.inspiration=1;let characters=[helper,first]
  let map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'skeleton',characterId:'first',label:'Actual Wild Shape',x:25,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'goblin',poolId:'srd-5.1:goblin',label:'Goblin',x:75,y:25,size:1,type:'enemy',hp:20,maxHp:20,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:75,size:1,type:'player',color:'',emoji:''}]}
  if(enemyController){map.tokens[0].dnd5eSide='enemy';map.tokens[2].dnd5eSide='enemy';map.tokens[1].dnd5eSide='player'}
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
   const actualMapSource=readMapsWorkspaceSource(),start=actualMapSource.indexOf('        const nativeRawId=durableD20RollId('),end=actualMapSource.indexOf('        const monsterAttackRollContext = {',start)
   if(start<0||end<0)throw Error('Actual Maps raw construction block missing')
   const pageResult={moved:false,attacked:true,message:'Actual ordinary Native caller'}
    const context={readMastermindNativeWardResume,readMastermindNativeDirectOwnerResume,collectMastermindNativeDirectOwnerOriginal,wardResume:await readMastermindNativeWardResume(pageResult),directResume:undefined,monsterZeroResume:readBountifulMonsterZeroMapResume(pageResult),collectMastermindNativeMonsterOriginal:(input:Parameters<typeof collectMastermindNativeMonsterOriginal>[0])=>collectMastermindNativeMonsterOriginal(input,{session:()=>roomSession.value,loadResource:gateway.loadResource,request:async()=>{throw Error('This actual original target has no native Misdirection source; no owner prompt may be issued')}}),nativeResume:undefined,createBountifulHostMonsterRawBoundary,createBountifulPersistentRoomUI,dnd5ePreparedMonsterAttackAutomaticallyHits,durableD20RollId,bountifulDeferredD20RequestId,bountifulIssuedHostOperation,
     latestMap:map,monsterEffectTransactionId:source.transactionId,attackMode:'normal',mode:'dm',combatActiveRef:{current:true},index:0,tranquility:{passed:true},monsterAttack:prepared.prepared,result:pageResult,useProtection:false,protectionCandidate:undefined,areaAttackAdvantageReaction:undefined,nativeGateway:gateway,
     useCharacterStore:{getState:()=>({characters:data.characters.characters as typeof characters})},roundRef:{current:1},initiativeIndexRef:{current:0},requestSharedChoiceWindow:async()=> 'pending',rollDiceBoxD20:async()=>{throw Error('No extra original request')},confirmDmDice:async()=>{throw Error('No redundant owner confirmation')},
     nativeMonsterOriginalRef:{current:null},activeInterruptTransactionIdRef:{current:'actual-native-outer'},d20RollSequenceByTransactionRef:{current:new Map<string,number>()},
     attackEntry:prepared.prepared.attacks[0],confirmPlayerD20ChoiceReroll:async(entry:{rollId:string;bountifulParent?:{parentId:string;sourceOccurrence:number;dieIndex:number;rawRollId:string}})=>{expect(entry.bountifulParent).toEqual({parentId:source.transactionId,sourceOccurrence:0,dieIndex:0,rawRollId});expect(entry.rollId).toBe(bountifulDeferredD20RequestId(source.transactionId,rawRollId,0,0));return confirmGeneric()},
   }
   const producerStart=actualMapSource.indexOf('      const collectMonsterMisdirectionBeforeOriginal=async()=>{'),producerEnd=actualMapSource.indexOf('      const monsterEffectRollDice:',producerStart);if(producerStart<0||producerEnd<0)throw Error('Actual Maps owner producer missing');const code='let issuedNativeOriginal,nativeParentId;'+actualMapSource.slice(producerStart,producerEnd)+actualMapSource.slice(start,end)+';return {boundary:nativeRawBoundary,getIssued:()=>issuedNativeOriginal,getParent:()=>nativeParentId};',compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
   const construct=new Function(...Object.keys(context),'return (async()=>{'+compiled+'})()'),actual=await construct(...Object.values(context)) as {boundary:ReturnType<typeof createBountifulHostMonsterRawBoundary>;getIssued:()=>unknown;getParent:()=>string}
   const boundary=actual.boundary
   if(!boundary)throw Error('Actual Maps did not construct native boundary')
   const diceRoute=boundary.getDiceRoute()
   expect(readBountifulNativeDiceRoute(diceRoute,rawRollId,'skeleton')).toMatchObject({characterId:'first',memberId:'first-member'})
   expect(()=>readBountifulNativeDiceRoute(JSON.parse(JSON.stringify(diceRoute)),rawRollId,'skeleton')).toThrow('issued-current-request-required')
   expect(()=>readBountifulNativeDiceRoute(diceRoute,'foreign-request','skeleton')).toThrow('issued-current-request-required')
   const sideStart=actualMapSource.indexOf('    const nativeDiceOwner=readBountifulOpportunitySequencePlayerDiceOwner(context.'),sideEnd=actualMapSource.indexOf('    // A player',sideStart)
   const sideCode=ts.transpileModule(actualMapSource.slice(sideStart,sideEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
   const actualRollerSide=new Function('isDiceCharacterControlledByRemotePlayer','characters','getRoomSession','readBountifulOpportunitySequencePlayerDiceOwner','readBountifulOpportunitySettlementDiceRoute','readArcaneMovementPlayerDiceOwner','readBountifulNativeDiceRoute','readArcaneBasePrefixPlayerDiceOwner','activeMap','combatIdRef','context','rollRequestId','explicitRollerToken','ownedPlayerCharacter','inferredRollKind','namedRollerToken','resolveCombatD20RollerSide','dnd5eCombatTokenSide','return (async()=>{'+sideCode+';return {effectiveRollerSide,rollOwnerCharacterId};})()')
   expect(await actualRollerSide(isDiceCharacterControlledByRemotePlayer,characters,()=>roomSession.value,readBountifulOpportunitySequencePlayerDiceOwner,readBountifulOpportunitySettlementDiceRoute,readArcaneMovementPlayerDiceOwner,readBountifulNativeDiceRoute,readArcaneBasePrefixPlayerDiceOwner,map,{current:'combat'},{bountifulNativeDiceRoute:diceRoute},rawRollId,map.tokens[0],undefined,'attack',map.tokens[0],()=>{throw Error('Real private native route must determine controller')},()=>{throw Error('Team side is not native dice ownership')})).toEqual({effectiveRollerSide:'player',rollOwnerCharacterId:'first'})
   const executeMapBlock=async(startMarker:string,endMarker:string,dependencies:Record<string,unknown>)=>{const start=actualMapSource.indexOf(startMarker),end=actualMapSource.indexOf(endMarker,start);if(start<0||end<0)throw Error('Actual Maps delegation block missing');const code=ts.transpileModule(actualMapSource.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return new Function(...Object.keys(dependencies),'return (async()=>{'+code+'})()')(...Object.values(dependencies)) as Promise<unknown>}
   let requestedOriginal=0
   const originalOwner=readBountifulNativeDiceRoute(diceRoute,rawRollId,'skeleton')
   expect(await executeMapBlock("    if (mode === 'dm' && effectiveRollerSide === 'player'",'    // Local rolls decide',{
     mode:'dm',effectiveRollerSide:'player',rollOwnerCharacterId:'first',nativeDiceOwner:originalOwner,isDiceCharacterOwnedByCurrentDm:()=>true,characters,context:{skipChoiceReroll:true,existingRollMode:'normal'},getRoomSession:()=>roomSession.value,
     requestPlayerDiceRoll:async(request:{targetCharacterId:string;requestId:string})=>{expect(request.targetCharacterId).toBe('first');expect(request.requestId).toBe(rawRollId);requestedOriginal++;return [1]},rollRequestId:rawRollId,label:'Actual native attack',targetName:'Goblin',inferredRollKind:'attack',confirmDmDice:async()=>[1],combatActiveRef:{current:true},activeMap:map,
   })).toBe(1);expect(requestedOriginal).toBe(1)
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
   let preDamage=await driveBountifulHostMonsterOriginal(source.transactionId,gateway,{showChoice:async()=>{throw Error('Owner already settled')},requestRoll:async()=>{throw Error('Real raw already confirmed')}});expect(preDamage.request.values).toEqual([decision==='use'||nativeLucky?replacement:1]);expect(preDamage.snapshot.combatants.goblin.currentHp).toBe(20)

   const confirmGeneric=async()=>{const option=dnd5eCoreInspirationChoiceRerollOption(first,'skeleton','normal');if(!option)throw Error('Actual core Inspiration required')
   const prompt=createD20RollConfirmationInterrupt({mapId:'map',combatId:'combat',rollId:bountifulDeferredD20RequestId(source.transactionId,rawRollId,0,0),bountifulParent:{parentId:source.transactionId,sourceOccurrence:0,dieIndex:0,rawRollId},label:'Actual native post-original Inspiration',originalValue:1,rollerCharacterId:'first',eligibleModifiers:[option]})
   const mutate=async(operation:object,memberId:string)=>{const response=await http.state('PATCH','combat-interrupts/interrupt',{mapId:'map',...operation},data,memberId);expect(response.status,JSON.stringify(response.payload)).toBe(200);data['combat-interrupts']=response.saved;return response}
   await mutate({operation:'upsert',interrupt:prompt},'host')
   const contribution=createD20ChoiceRerollContribution({interruptId:prompt.id,characterId:'first',characterName:first.name,featureId:option.featureId,featureLabel:option.featureLabel,decision:'use'})
   if(contribution.kind!=='choice-reroll')throw Error('Actual reroll contribution required')
   await mutate({operation:'contribute',id:prompt.id,contribution},'first-member')
   await mutate({operation:'rolling',id:prompt.id},'host')
   const extra=await prepareBountifulDeferredExtraD20({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:contribution},gateway)
   expect(extra.rollerCharacterId).toBe('first')
   const extraOwner=readBountifulNativeDiceRoute(extra.nativeDiceRoute,extra.rollRequestId,'skeleton');expect(extraOwner?.memberId).toBe('first-member')
   let requestedExtra=0
   expect(await executeMapBlock('    if (isDM && !options.freeRoll && playerOwnerId &&','    const values = Array.from',{
     isDM:true,options:{},playerOwnerId:'first',nativeDiceOwner:extraOwner,isDiceCharacterOwnedByCurrentDm:()=>true,characters,getRoomSession:()=>roomSession.value,rollRequestId:extra.rollRequestId,safeCount:1,safeSides:20,label:'Actual native extra',targetName:first.name,check:undefined,
     requestPlayerDiceRoll:async(request:{targetCharacterId:string;requestId:string})=>{expect(request.targetCharacterId).toBe('first');expect(request.requestId).toBe(extra.rollRequestId);requestedExtra++;return [17]},confirmDmDice:async()=>[17],finalizeDicePool:async(values:number[])=>values,
   })).toEqual([17]);expect(requestedExtra).toBe(1)
   const extraRequest={...request,requestId:extra.rollRequestId,eventId:'generic-extra-request'}
   expect((await http.event('dice-roll-request-dm-to-player',extraRequest,data,'host')).status).toBe(200)
   expect((await http.event('dice-roll-request-player-to-dm',{...extraRequest,delivery:'player-roll-result',values:[17],sourceMode:'player',eventId:'generic-extra-foreign'},data,'second-member')).status).toBe(403)
   expect((await http.event('dice-roll-request-player-to-dm',{...extraRequest,delivery:'player-roll-result',values:[17],sourceMode:'player',eventId:'generic-extra-host-for-PC'},data,'host')).status).toBe(403)
   expect((await http.event('dice-roll-request-player-to-dm',{...extraRequest,delivery:'player-roll-result',values:[17],sourceMode:'player',eventId:'generic-extra-result'},data,'first-member')).status).toBe(200)
   expect((await http.event('dice-roll-request-player-to-dm',{...extraRequest,delivery:'player-roll-result',values:[1],sourceMode:'player',eventId:'generic-extra-changed'},data,'first-member')).status).toBe(403)
   await mutate({operation:'roll-options',id:prompt.id,rollOptions:{contributionId:contribution.id,values:[1,17]}},'host')
   const beforeDeferred=transactions.length,choice=await commitD20ChoiceReroll({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,deferToParent:{parentId:source.transactionId,sourceOccurrence:0,dieIndex:0}},gateway)
   expect(choice.finalValue).toBe(17);expect((data.characters.characters as typeof characters).find(row=>row.id==='first')?.inspiration).toBe(1)
   expect(transactions.length).toBe(beforeDeferred+1)
   expect(await commitD20ChoiceReroll({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,deferToParent:{parentId:source.transactionId,sourceOccurrence:0,dieIndex:0}},gateway)).toEqual(choice)
   expect(transactions.length).toBe(beforeDeferred+1)
   preDamage=await driveBountifulHostMonsterOriginal(source.transactionId,gateway,{showChoice:async()=>{throw Error('Original already declined')},requestRoll:async()=>{throw Error('Raw already confirmed')}})
   expect(preDamage.request.values).toEqual([17]);expect(preDamage.snapshot.combatants.skeleton.inspiration).toBe(0);return 17}
   const rawEntry=boundary
   await rawEntry.beforeOriginalRequest(rawRollId,1)
   expect(await rawEntry.afterOriginalConfirmed([1],rawRollId)).toEqual([17,undefined]);expect(actual.getParent()).toBe(source.transactionId);expect(actual.getIssued()).toBeTruthy()
   expect(await rawEntry.afterOriginalConfirmed([1],rawRollId)).toEqual([17,undefined])
   if(replacement!==1){const dice=[prepared.prepared.attacks[0].attack.damage.map(group=>Array(group.count).fill(1))];const finalSource={...source,optionalBonusDice:[],savingThrowCounterattacks:[],rolls:[{...source.rolls[0],d20:preDamage.request.values[0]!,damageRolls:dice[0]}]};const beforeLate=transactions.length;
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
   let nativePublication:BountifulNativeMapPublication|undefined
   const mapBoundary=createBountifulHostMonsterMapBoundary({parentId:source.transactionId,gateway,authorityUnchanged:()=>true,damageOptions:options,onResolved:publication=>{nativePublication=publication}})
   const finalFromUI={...source,optionalBonusDice:[],savingThrowCounterattacks:[],rolls:[{...source.rolls[0],d20:17,damageRolls:prepared.prepared.attacks[0].attack.damage.map(group=>Array(group.count).fill(1))}]}
   expect(bountifulNativePreparedRecoveryFacts(await mapBoundary.attachReplay(finalFromUI))).toEqual({parentId:source.transactionId})
   const fromMap=await mapBoundary.resolve(finalFromUI)
   if(!nativePublication)throw Error('Actual Map boundary publication required')
   const mounted={resolved:fromMap,publication:nativePublication}
   if(!mounted.resolved.result.ok||!mounted.resolved.application)throw Error('Real materialized native result required')
   const snapshots={characters:{characters:mounted.resolved.application.characters},maps:{maps:[mounted.resolved.application.map]},combat:{active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder,updatedAt:1}}
   await expect(publishBountifulHostMonsterMapResult(JSON.parse(JSON.stringify(mounted.publication)),snapshots,gateway)).rejects.toThrow('issued-execution-required')
   const refunded=structuredClone(snapshots);refunded.characters.characters.find(row=>row.id==='first')!.inspiration=1
   await expect(publishBountifulHostMonsterMapResult(mounted.publication,refunded,gateway)).rejects.toThrow('deferred-cost-not-in-final-materials')
   const publicationFile=ts.createSourceFile('MapsWorkspacePage.tsx',actualMapSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),publicationNodes:ts.IfStatement[]=[]
   const findPublication=(node:ts.Node)=>{if(ts.isIfStatement(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='nativeParentId'&&ts.isBlock(node.thenStatement)){let calls=0;const count=(child:ts.Node)=>{if(ts.isCallExpression(child)&&ts.isIdentifier(child.expression)&&child.expression.text==='publishBountifulHostMonsterMapResult')calls++;ts.forEachChild(child,count)};count(node.thenStatement);if(calls===1)publicationNodes.push(node)}ts.forEachChild(node,findPublication)};findPublication(publicationFile)
   expect(publicationNodes).toHaveLength(1)
   const publicationNode=publicationNodes[0];if(!publicationNode?.elseStatement)throw Error('Actual Maps final publication block missing')
   expect(publicationNode.elseStatement.getText(publicationFile)).toBe('await persistDnd5eAuthorityState()')
   const publishStart=publicationNode.getStart(publicationFile),publishEnd=publicationNode.end
   const publicationContext={nativeParentId:source.transactionId,nativePublication:mounted.publication,publishBountifulHostMonsterMapResult,nativeGateway:gateway,runtimeNow:()=>2,MAP_GEOMETRY_SCHEMA_VERSION,
     useCharacterStore:{getState:()=>snapshots.characters},useMapStore:{getState:()=>snapshots.maps},useMapGeometryStore:{getState:()=>({maps:[]})},currentDnd5eAuthorityCombatState:()=>snapshots.combat,
     nativeMonsterOriginalRef:context.nativeMonsterOriginalRef,issuedNativeOriginal:actual.getIssued(),previousNativeOriginal:null,activeInterruptTransactionIdRef:context.activeInterruptTransactionIdRef,previousNativeTransaction:'actual-native-outer',persistDnd5eAuthorityState:async()=>{throw Error('Native final must use its actual parent CAS')},
   }
   const publishCode=ts.transpileModule(actualMapSource.slice(publishStart,publishEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
   await new Function(...Object.keys(publicationContext),'return (async()=>{'+publishCode+'})()')(...Object.values(publicationContext))
   expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='goblin')?.hp).toBe(19)
   const done=await http.state('GET','combat',null,data,'host')
   expect(done.saved.bountifulOriginalParents[id].consumed.transactionId).toBe(source.transactionId)
   if(nativeLucky){expect(done.saved.bountifulOriginalParents[JSON.stringify(['bountiful-original-parent',source.transactionId,1])].consumed.transactionId).toBe(source.transactionId);expect(Object.keys(done.saved.bountifulOriginalParents)).toHaveLength(2)}
   expect(done.saved.dnd5eTurnEconomyByToken['helper-token'].reaction.current).toBe(1);expect((data.characters.characters as typeof characters).find(row=>row.id==='first')?.inspiration).toBe(0)
   expect(done.saved.dnd5eTurnEconomyByToken.skeleton.action.current).toBe(0)
   const transactionCount=transactions.length
   const finalFact=done.saved.bountifulOriginalParents[id].postOriginalD20[0]
   expect((await commitD20ChoiceReroll({mapId:'map',interruptId:finalFact.interruptId,acceptedContributionId:finalFact.contributionId,deferToParent:{parentId:source.transactionId,sourceOccurrence:0,dieIndex:0}},gateway)).finalValue).toBe(17)
   expect((await publishBountifulHostMonsterMapResult(mounted.publication,snapshots,gateway)).status).toBe('already-committed')
   expect(transactions).toHaveLength(transactionCount)
  }finally{await http.close()}
 }finally{roomSession.value={roomId:'room',memberId:'host',role:'dm'};dispose()}
})
