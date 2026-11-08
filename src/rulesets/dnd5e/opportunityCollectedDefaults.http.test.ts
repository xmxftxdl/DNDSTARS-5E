import {assertBountifulAfterDiceSource}from'./bountifulLuckAfterDice'
import {recordBountifulOpportunitySettlementHostConfirmation}from'./bountifulOpportunitySettlementDice'
import {createBountifulOpportunityAttackLateDice,readBountifulOpportunitySettlementDiceRoute,readBountifulOpportunitySettlementLockedRaw} from './bountifulOpportunitySettlementDice'
import {settleDnd5eActivityTriggerWindowsV1} from './activities/dnd5eActivityTriggerSettlement'
import {settleBountifulOpportunityPostNativePrefix} from './bountifulOpportunityMoveAck'
import fs from 'node:fs'
import ts from 'typescript'
import {createBountifulOpportunityMoveRawBoundary} from './bountifulOpportunityMoveOriginalFlow'
import {readBountifulNativeDiceRoute} from './bountifulHostOperation'
import {previewBountifulOpportunityMovePrefix,createBountifulOpportunityMoveLocalAuthority} from './bountifulOpportunityMoveAck'
import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {prepareDnd5eOpportunityPlayerMove,issueBountifulOpportunityMoveRawSource} from './opportunityMoveAction'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import {driveBountifulOriginalParent} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId} from './bountifulLuckReceipt'
import {routeBountifulOriginalResponse} from './bountifulOriginalResponseRouter'
import {submitBountifulOwnedDiceResult,submitBountifulHostConfirmation} from './bountifulLuckClientCommands'
import {bountifulReadyHttpFixture} from './opportunityMove.httpSupport'
import {durableD20RollId} from '../../lib/rollConfirmation'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {BattleMap} from '../../store/maps'
const roomSession=vi.hoisted(()=>({value:{roomId:'room',memberId:'host',role:'dm'}}));vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>roomSession.value}))
it.each(['deferred' as const])('records the actual complete Page collector defaults against its real original parent without changing any pinned fact (%s)',async(choice:boolean|'deferred'|'caltrops'|'ko')=>{
 const useLuck=choice!==false,withHazard=choice==='caltrops',withKO=choice==='ko'
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)),http=await bountifulReadyHttpFixture()
 try{
 const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30})
 const attacker=normalizeCharacter({id:'first',name:'First',charClass:'战士',level:4,race:'人类',roomMemberId:'first-member',currentHp:30,maxHp:30})
 const mover=normalizeCharacter({id:'second',name:'Mover',charClass:'法师',level:4,race:'人类',roomMemberId:'second-member',currentHp:30,maxHp:30}),characters=[helper,attacker,mover]
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'first-token',characterId:'first',label:'First',x:25,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'mover-token',characterId:'second',label:'Mover',x:75,y:25,size:1,type:'player',dnd5eSide:'enemy',hp:30,maxHp:30,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:125,size:1,type:'player',dnd5eSide:'player',color:'',emoji:''}]}
 if(withKO){mover.currentHp=1;map.tokens.find(token=>token.id==='mover-token')!.hp=1}
 if(withHazard)map.dnd5eItemAreas=[{id:'actual-caltrops',kind:'caltrops',sourceCharacterId:'first',sourceTokenId:'first-token',sourceItemTemplateId:'caltrops',sourceItemName:'Caltrops',cells:[{col:2,row:0}],createdAt:1,armed:true}]
 const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),economy=createDnd5eTurnEconomyCounts('combat:1:first-token'),moverEconomy=createDnd5eTurnEconomyCounts('combat:1:mover-token')
 const command:SharedPlayerActionState={id:'real-move-original',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'move-token',actorTokenId:'mover-token',characterId:'second',roomMemberId:'second-member',targetPosition:{x:175,y:25},round:1,initiativeIndex:1,seq:1,updatedAt:1}


 type Resource={_sync:{revision:number};[key:string]:unknown};const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},selectedId:'map',maps:[map]},combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:1,initiativeOrder},'player-action-requests':{_sync:{revision:1},requests:[]}}
 for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
 const commits:string[][]=[],gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,publishEvent:async(channel,payload)=>{const response=await http.event(channel,payload,data,'host');if(response.status!==200)throw Error('HTTP '+response.status+':'+JSON.stringify(response.payload));data.combat=await http.readActualResource('combat')},saveResourcesAtomically:async(writes,options)=>{
 const response=await http.state('POST','transaction',{...options,writes},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200)
 for(const write of writes)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:response.payload.revisions?.[write.name]??((data[write.name]?._sync.revision??0)+1)}};data.combat=response.saved;if(response.queue)data['player-action-requests']=response.queue;if(response.commandReceipts)data['combat-command-receipts']=response.commandReceipts;commits.push(writes.map(write=>write.name));return {status:'committed',transactionId:options?.transactionId??'',revisions:response.payload.revisions??{}}
 }}
 const appended=await http.command(command.id,{schemaVersion:1,command:{schemaVersion:1,commandId:command.id,type:'move-token',mapId:'map',combatId:'combat',actorTokenId:'mover-token',characterId:'second',round:1,initiativeIndex:1,seq:1,expectedRevisions:{combat:1,maps:1},issuedAt:1,expectedPosition:{x:75,y:25},expectedElevationFeet:0,targetPosition:{x:175,y:25}}},data,'second-member');expect(appended.status,JSON.stringify(appended.payload)).toBe(202);data['player-action-requests']=appended.queue;data['combat-command-receipts']=appended.receipts
 const action=(appended.queue.requests as SharedPlayerActionState[]).find(row=>row.id===command.id);if(!action)throw Error('Actual appended moving PC required')
 const prepared=prepareDnd5eOpportunityPlayerMove({action,map,characters,initiativeOrder,moverEconomy,attackerEconomy:economy,attackerTokenId:'first-token'});if(!prepared.ok)throw Error(prepared.reason)
 let localProjection:ReturnType<Parameters<typeof createBountifulOpportunityMoveLocalAuthority>[0]['readProjection']>={map,characters,turnEconomyByToken:{'first-token':economy,'mover-token':moverEconomy,'helper-token':createDnd5eTurnEconomyCounts('combat:1:helper-token')}},geometryEpoch=1
 let local=createBountifulOpportunityMoveLocalAuthority({prepared:prepared.prepared,readProjection:()=>localProjection,readAnchors:()=>({geometryEpoch,charactersRevision:data.characters._sync.revision,mapsRevision:data.maps._sync.revision,round:data.combat.round,index:data.combat.initiativeIndex,combatId:data.combat.combatId})})
 expect(local.authorityUnchanged()).toBe(true);geometryEpoch++;expect(local.authorityUnchanged()).toBe(false);geometryEpoch--
 const rawRollId=durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:0})
 await expect(issueBountifulOpportunityMoveRawSource(JSON.parse(JSON.stringify(prepared.prepared)),{rawRollId,rawCursor:1,issuerMode:'dm'},gateway)).rejects.toThrow('actual-host-preparer-required')
 const clock=prepared.prepared.transactionNow;prepared.prepared.transactionNow++
 await expect(issueBountifulOpportunityMoveRawSource(prepared.prepared,{rawRollId,rawCursor:1,issuerMode:'dm'},gateway)).rejects.toThrow('actual-host-preparer-required')
 prepared.prepared.transactionNow=clock
 const exhaustedHelper=createDnd5eTurnEconomyCounts('combat:1:helper-token');exhaustedHelper.reaction.current=0
 data.combat.dnd5eTurnEconomyByToken={'helper-token':exhaustedHelper}
 await expect(issueBountifulOpportunityMoveRawSource(prepared.prepared,{rawRollId,rawCursor:1,issuerMode:'dm'},gateway)).rejects.toThrow('stale-original-turn-economy')
 delete data.combat.dnd5eTurnEconomyByToken
 const pageSource=fs.readFileSync(process.env.XGE_ARCANE_PAGE_SOURCE??'src/pages/MapsWorkspacePage.tsx','utf8').replaceAll('\r\n','\n'),factoryStart=pageSource.indexOf('          create:facts=>{',pageSource.indexOf('opportunityAttackers.length===1?{originalMove:')),factoryEnd=pageSource.indexOf('        }}:undefined',factoryStart)
 if(factoryStart<0||factoryEnd<0)throw Error('Actual queued move factory required')
 const sequence={current:new Map<string,number>()},turns={get current(){return localProjection.turnEconomyByToken}}
 const factoryDeps={mode:'dm',prefixContext:undefined,restoredOpportunityPrepared:undefined,storedOpportunityInput:undefined,prepareDnd5eOpportunityPlayerMove,createBountifulOpportunityMoveLocalAuthority,createBountifulOpportunityMoveRawBoundary,action,authorityMap:map,
  useMapStore:{getState:()=>({maps:[localProjection.map]})},useCharacterStore:{getState:()=>({characters:localProjection.characters})},initiativeOrderRef:{current:initiativeOrder},turnEconomy:moverEconomy,
  currentDnd5eTurnEconomy:(id:string)=>localProjection.turnEconomyByToken[id],attacker:map.tokens[0],dnd5eTurnEconomyByTokenRef:turns,combatIdRef:{current:'combat'},combatActiveRef:{current:true},roundRef:{current:1},initiativeIndexRef:{current:1},
  mapGeometryRuntimeForMap:()=>({epoch:geometryEpoch}),useCampaignTimeStore:{getState:()=>({state:{}})},d20RollSequenceByTransactionRef:sequence,durableD20RollId,opportunityGateway:gateway,
  requestSharedChoiceWindow:()=>{throw Error('Low-level real HTTP owner UI is supplied')},rollDiceBoxD20:()=>{throw Error('Original roller must submit actual raw')},confirmDmDice:()=>{throw Error('Actual independent DM submission is supplied')},
  createBountifulPersistentRoomUI:()=>({showChoice:(...args:Parameters<typeof ui.showChoice>)=>ui.showChoice(...args),requestRoll:(...args:Parameters<typeof ui.requestRoll>)=>ui.requestRoll(...args)}),
  previewBountifulOpportunityMovePrefix,settleBountifulOpportunityPostNativePrefix,
  applyOpportunityProjection:(projection:typeof localProjection)=>{localProjection=projection},
  requestOptionalDamageSave:()=>{throw Error('No optional save on this actual ordinary attack')},rollDnd5eUnsupportedAirborneFalls:()=>{throw Error('No airborne fall')},settleDnd5eMapMountedBalance:()=>{throw Error('No mounted target')},
  rollDiceBoxValues:()=>{throw Error('No additional damage dice')},requestSharedHellishRebukeChoice:()=>{throw Error('No Hellish source')},collectSharedSpellDamageDieChoices:()=>{throw Error('No fire-die source')},requestDnd5eSavingThrowRerollDice:()=>{throw Error('No saving throw')},requestDnd5eBardicInspirationRoll:()=>{throw Error('No inspiration source')},requestDnd5eOptionalBonusDieUse:()=>{throw Error('No bonus source')},requestDnd5eDarkOnesOwnLuckRoll:()=>{throw Error('No source')},requestSharedPostSpellRandomTableChoice:()=>{throw Error('No random source')},requestSharedPostSpellRandomTableAdjudication:()=>{throw Error('No random source')},requestDisadvantageNegation:()=>{throw Error('No disadvantage source')},
  settleRegisteredDnd5eActivityTriggers:async(request:Parameters<NonNullable<Parameters<typeof settleBountifulOpportunityPostNativePrefix>[0]['services']['settleActivityTriggers']>>[0])=>{
    const actual=await settleDnd5eActivityTriggerWindowsV1({state:request.state,events:request.events,eventBatchId:action.id,combatRevision:data.combat._sync.revision,confirm:async()=>{throw Error('No unrelated Activity choice')},roll:async()=>{throw Error('No unrelated Activity dice')}})
    return {state:actual.state,events:actual.events,map:request.map}
  },
  bountifulDeferredD20RequestId:()=>{throw Error('No self-reroll source')},confirmPlayerD20ChoiceReroll:()=>{throw Error('No self-reroll source')},damageReactionOptionsForMap:()=>({confirm:async()=>({accepted:false}),roll:async()=>{throw Error('No additional reaction dice')}}),
 }
 const factoryCode=ts.transpileModule('let opportunityParent; const object={'+pageSource.slice(factoryStart,factoryEnd)+'}; return {create:object.create,captured:object.captured,parent:()=>opportunityParent};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 const realFactory=new Function(...Object.keys(factoryDeps),factoryCode)(...Object.values(factoryDeps))
 const actualFactoryResult=realFactory.create({mode:'normal',choices:{tranquilitySave:undefined,areaAttackAdvantageReaction:undefined,disadvantageNegationChoice:undefined}})
 const boundary:ReturnType<typeof createBountifulOpportunityMoveRawBoundary>=actualFactoryResult.boundary
 expect(actualFactoryResult.requestId).toBe(rawRollId);expect(sequence.current.get(action.id)).toBe(1)
 expect(realFactory.parent().prepared.action).toBe(action)
 local=realFactory.parent().local
 await boundary.beforeOriginalRequest(rawRollId,1)
 expect(readBountifulNativeDiceRoute(boundary.getDiceRoute(),rawRollId,'first-token')).toMatchObject({characterId:'first',memberId:'first-member'})
 geometryEpoch++
 await expect(boundary.beforeOriginalRequest(rawRollId,1)).rejects.toThrow('stale-authority')
 geometryEpoch--
 await expect(boundary.afterOriginalConfirmed([1],'foreign-raw')).rejects.toThrow('changed-original')
 const emitOriginalRaw=async()=>{
 const request={mapId:'map',combatId:'combat',requestId:rawRollId,rollerTokenId:'first-token',targetCharacterId:'first',kind:'d20',count:1,sides:20,values:[],rollKind:'attack',delivery:'player-roll-request',sourceMode:'dm',eventId:'oa-request',updatedAt:1}
 const originalRequest=await http.event('dice-roll-request-dm-to-player',request,data,'host');expect(originalRequest.status,JSON.stringify(originalRequest.payload)).toBe(200)
 const report={...request,delivery:'player-roll-result',values:[1],sourceMode:'player',eventId:'oa-original-result'}
 expect((await http.event('dice-roll-request-player-to-dm',report,data,'second-member')).status).toBe(403)
 expect((await http.event('dice-roll-request-player-to-dm',report,data,'host')).status).toBe(403)
 expect((await http.event('dice-roll-request-player-to-dm',report,data,'first-member')).status).toBe(200)
 }
 let appendedId=''
 const client:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>={loadResource:async<T>(name:string)=>{const response=await http.state('GET',name,null,data,roomSession.value.memberId);expect(response.status).toBe(200);return response.payload as T},appendPlayerActionRequest:async row=>{const response=await http.append(row,data,roomSession.value.memberId);expect(response.status,JSON.stringify(response.payload)).toBe(200);data['player-action-requests']=response.queue;if(!row||typeof row!=='object'||!('id' in row)||typeof row.id!=='string')throw Error('Actual response request required');appendedId=row.id}}
 const ui:Parameters<typeof driveBountifulOriginalParent>[2]={
 showChoice:async receipt=>{const option=receipt.request.options[0];const choice={id:'oa-bl-owner',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'dnd5e-bountiful-luck',actorTokenId:'helper-token',characterId:'helper',roomMemberId:'helper-member',round:1,initiativeIndex:1,seq:1,updatedAt:1,bountifulLuck:{parentId:action.id,occurrence:receipt.identity.occurrence,command:{phase:'reaction',...option,decision:useLuck?'use':'decline'}}};const response=await http.append(choice,data,'helper-member');expect(response.status,JSON.stringify(response.payload)).toBe(200);data['player-action-requests']=response.queue},
 requestRoll:async receipt=>{const rollRequestId=bountifulOriginalDieRollId(receipt);roomSession.value={roomId:'room',memberId:'first-member',role:'player'};await submitBountifulOwnedDiceResult({mapId:'map',combatId:'combat',requestId:rollRequestId,characterId:'first',values:[15],round:1,initiativeIndex:1},client);roomSession.value={roomId:'room',memberId:'host',role:'dm'};await routeBountifulOriginalResponse({mapId:'map',requestId:appendedId},gateway);await submitBountifulHostConfirmation({mapId:'map',context:{parentId:action.id,occurrence:receipt.identity.occurrence,combatId:'combat',actorTokenId:'first-token',characterId:'first',rollRequestId},rawValue:15,value:15,round:1,initiativeIndex:1},client);await routeBountifulOriginalResponse({mapId:'map',requestId:appendedId},gateway)}
 }
 const mapText=fs.readFileSync(process.env.XGE_ARCANE_PAGE_SOURCE??'src/pages/MapsWorkspacePage.tsx','utf8').replaceAll('\r\n','\n'),rawStart=mapText.indexOf("    const original = tranquility.passed && typeof originalInput === 'function'"),rawEnd=mapText.indexOf('    const blessRoll =',rawStart)
 if(rawStart<0||rawEnd<0)throw Error('Actual Maps original OA raw block required')
 const dependencies={originalInput:(facts:{mode:string;choices:unknown})=>{expect(facts.mode).toBe('normal');expect(facts.choices).toEqual({tranquilitySave:undefined,areaAttackAdvantageReaction:undefined,disadvantageNegationChoice:undefined});return {requestId:rawRollId,boundary}},disadvantageNegationChoice:undefined,tranquility:{passed:true},effectiveAttackMode:'normal',attackRollContext:{rollKind:'attack',rollerTokenId:'first-token',rollerCharacterId:'first'},attack:prepared.prepared.opportunity,
  rollDiceBoxD20Pair:async(_label:string,_target:string,mode:string,context:{durableRollRequestId:string;bountifulNativeDiceRoute:ReturnType<typeof boundary.getDiceRoute>},after:(values:readonly number[],id:string)=>Promise<readonly [number,number|undefined]>)=>{
   expect(mode).toBe('normal');expect(context.durableRollRequestId).toBe(rawRollId)
   expect(readBountifulNativeDiceRoute(context.bountifulNativeDiceRoute,rawRollId,'first-token')).toMatchObject({characterId:'first',memberId:'first-member'})
   await emitOriginalRaw();return after([1],rawRollId)
  }}
 const rawCode=ts.transpileModule(mapText.slice(rawStart,rawEnd)+';return [d20,d20Second];',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 expect(await new Function(...Object.keys(dependencies),'return (async()=>{'+rawCode+'})()')(...Object.values(dependencies))).toEqual([useLuck?15:1,undefined])

 const damage=realFactory.parent().prepared.opportunity.damage
 let physical=0,requestId='',interrupt=true
 const lateStart=pageSource.indexOf('    let lateJournal:ReturnType<typeof createBountifulOpportunityAttackLateDice>'),lateEnd=pageSource.indexOf('    const blessRoll =',lateStart)
 expect(lateStart).toBeGreaterThan(0);expect(lateEnd).toBeGreaterThan(lateStart)
 const runLate=(actualBoundary:typeof boundary)=>{
  const ports={original:{boundary:actualBoundary},createBountifulOpportunityAttackLateDice,loadSharedResource:gateway.loadResource,saveSharedResourcesAtomically:gateway.saveResourcesAtomically,publishSharedEvent:gateway.publishEvent,
   rollDiceBoxD20:async()=>{throw Error('No unissued d20')},
   rollDiceBoxValues:async(count:number,sides:number,_label:string,_target:string,context:{rollerTokenId:string;durableRollRequestId:string;bountifulOpportunitySettlementRoute:object})=>{
    expect(readBountifulOpportunitySettlementDiceRoute(context.bountifulOpportunitySettlementRoute,context.durableRollRequestId,context.rollerTokenId)).toMatchObject({characterId:'first',memberId:'first-member'})
    if(requestId)expect(context.durableRollRequestId).toBe(requestId);requestId=context.durableRollRequestId
    const locked=readBountifulOpportunitySettlementLockedRaw(context.bountifulOpportunitySettlementRoute,requestId,context.rollerTokenId,count,sides)
    if(locked){expect(interrupt).toBe(false);return locked}
    physical++
    const request={mapId:'map',combatId:'combat',requestId,rollerTokenId:'first-token',targetCharacterId:'first',kind:'dice',count,sides,values:[],label:_label,targetName:_target,rollKind:'other',delivery:'player-roll-request',sourceMode:'dm',eventId:'late-request',updatedAt:1}
    const issued=await http.event('dice-roll-request-dm-to-player',request,data,'host');expect(issued.status,JSON.stringify(issued.payload)).toBe(200)
    const report={...request,delivery:'player-roll-result',sourceMode:'player',values:Array(count).fill(2),eventId:'late-original-result'}
    const untouched=await http.readActualResource('combat')
    const start={...report,delivery:'player-roll-start',eventId:'actual-physical-start'}
    expect((await http.event('dice-roll-request-player-to-dm',start,data,'helper-member')).status).toBe(403)
    expect((await http.event('dice-roll-request-player-to-dm',start,data,'host')).status).toBe(403)
    for(const patch of[{rollerTokenId:'mover-token'},{targetCharacterId:'second'},{mapId:'foreign-map'},{combatId:'foreign-combat'},{count:count+1},{sides:sides+1},{requestId:requestId+':foreign'}])expect((await http.event('dice-roll-request-player-to-dm',{...start,...patch},data,'first-member')).status).toBe(403)
    expect((await http.event('dice-roll-request-player-to-dm',start,data,'first-member')).status).toBe(200)
    expect(await http.readActualResource('combat')).toEqual(untouched)
    expect((await http.event('dice-roll-request-player-to-dm',report,data,'helper-member')).status).toBe(403)
    expect((await http.event('dice-roll-request-player-to-dm',report,data,'host')).status).toBe(403)
    const result=await http.event('dice-roll-request-player-to-dm',report,data,'first-member');expect(result.status,JSON.stringify(result.payload)).toBe(200)
    data.combat=await http.readActualResource('combat')
    const confirmed=Array(count).fill(1),presentation={...request,requestId:requestId+':dm-confirmed',delivery:'broadcast-result',values:confirmed}
    expect((await http.event('dice-roll-request-dm-to-player',presentation,data,'host')).status).toBe(403)
    const source=fs.readFileSync(process.env.XGE_ARCANE_PAGE_SOURCE??'src/pages/MapsWorkspacePage.tsx','utf8').replaceAll('\r\n','\n'),confirmStart=source.indexOf('  const confirmDmDice = async ('),producerStart=source.indexOf('    await recordBountifulOpportunitySettlementHostConfirmation(',confirmStart),producerEnd=source.indexOf(String.fromCharCode(10),producerStart),broadcastStart=source.indexOf('    if (isPublic) {'+String.fromCharCode(10)+'      await publishRollRequest({',producerEnd),broadcastEnd=source.indexOf('    return confirmed',broadcastStart)
    if(producerStart<confirmStart||broadcastStart<producerEnd||broadcastEnd<broadcastStart)throw Error('Exact actual Page confirmation-before-broadcast required')
    const body=ts.transpileModule(source.slice(producerStart,producerEnd)+String.fromCharCode(10)+source.slice(broadcastStart,broadcastEnd)+'return confirmed;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
    let loseConfirmation=true,losePresentation=true,broadcasts=0
    const ports={id:requestId,label:request.label,targetName:request.targetName,sides,values:report.values,confirmed,isPublic:true,selectedMode:'normal',originalMode:'normal',submittedFaces:confirmed,check:undefined,diceOwnersRef:{current:new Map([[requestId,{rollerTokenId:'first-token'}]])},recordBountifulOpportunitySettlementHostConfirmation,
      publishSharedEvent:async(channel:string,payload:unknown)=>{await gateway.publishEvent!(channel,payload);if(loseConfirmation){loseConfirmation=false;throw Error('simulated-confirmation-response-lost')}},
      publishRollRequest:async(payload:object)=>{broadcasts++;const response=await http.event('dice-roll-request-dm-to-player',{...request,...payload},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200);if(losePresentation){losePresentation=false;throw Error('simulated-presentation-response-lost')}}}
    const actualConfirm=new Function(...Object.keys(ports),'return(async()=>{'+body+'})()')
    const originalSession=roomSession.value
    roomSession.value={...originalSession,roomId:'foreign-room'};await expect(actualConfirm(...Object.values(ports))).rejects.toThrow();expect(broadcasts).toBe(0)
    roomSession.value={...originalSession,memberId:'helper-member'};await expect(actualConfirm(...Object.values(ports))).rejects.toThrow();expect(broadcasts).toBe(0)
    roomSession.value=originalSession
    await expect(actualConfirm(...Object.values(ports))).rejects.toThrow('simulated-confirmation-response-lost')
    expect(broadcasts).toBe(0)
    await expect(actualConfirm(...Object.values(ports))).rejects.toThrow('simulated-presentation-response-lost')
    const settledWorld=await http.readActualResource('combat')
    expect(await actualConfirm(...Object.values(ports))).toEqual(confirmed)
    expect(await http.readActualResource('combat')).toEqual(settledWorld)
    for(const member of['first-member','helper-member'])expect((await http.event('dice-roll-request-dm-to-player',presentation,data,member)).status).toBe(403)
    for(const patch of[{values:Array(count).fill(2)},{rollerTokenId:'mover-token'},{targetCharacterId:'second'},{mapId:'foreign-map'},{combatId:'foreign-combat'},{count:count+1},{sides:sides+1},{requestId:requestId+':dm-confirmed:foreign'}])expect((await http.event('dice-roll-request-dm-to-player',{...presentation,...patch},data,'host')).status).toBe(403)
    expect(await http.readActualResource('combat')).toEqual(settledWorld)
    expect(physical).toBe(1)
    return confirmed

   }}
  const code=ts.transpileModule(pageSource.slice(lateStart,lateEnd)+';return {values:rollOpportunityLateValues,finish:()=>lateJournal?.finish()};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
  return new Function(...Object.keys(ports),'collectorJournal',code)(...Object.values(ports)) as {values:(count:number,sides:number,_label:string,_target:string,context:{rollerTokenId:string})=>Promise<number[]>;finish:()=>Promise<unknown>}
 }
 const originalLate=runLate(boundary),accepted=await originalLate.values(damage.count,damage.sides,'Actual OA damage','First',{rollerTokenId:'first-token'})
 expect(accepted).toEqual(Array(damage.count).fill(1));await originalLate.finish();expect(physical).toBe(1)
 const collectorStart=pageSource.indexOf('  const collectDnd5ePreparedOpportunityRolls = async ('),collectorEnd=pageSource.indexOf('  const resolveDnd5eOpportunityAttackForMove = async (',collectorStart),rollsStart=pageSource.indexOf('      rolls: {',collectorStart),rollsEnd=pageSource.indexOf(String.fromCharCode(10)+'      },',rollsStart)
 if(collectorStart<0||rollsStart<collectorStart||rollsEnd<rollsStart||rollsEnd>collectorEnd)throw Error('Actual complete Page collector expression required')
 const expression=pageSource.slice(rollsStart+'      rolls: '.length,rollsEnd+(String.fromCharCode(10)+'      }').length)
 const collector={disadvantageNegationChoice:undefined,attack:realFactory.parent().prepared.opportunity,d20:15,d20Second:undefined,halflingLuckyD20:undefined,halflingLuckyD20Second:undefined,blessRoll:undefined,baneRoll:undefined,bardicInspirationRoll:undefined,cuttingWords:undefined,cuttingWordsDamage:undefined,strokeOfLuck:false,postD20Adjustment:undefined,shieldSpellReaction:false,shieldSpellcastingSavingThrows:{},uncannyDodge:false,tranquility:{roll:undefined},damageRolls:accepted,savageAttacksRoll:undefined,wholeWeaponDamageReroll:undefined,classDamageRolls:[],inventorySettlement:{inventoryEffectRolls:[]},hurlThroughHellDamageRolls:undefined,standAgainstTide:undefined}
 const actualRolls:Parameters<typeof boundary.recordFinalRolls>[0]=new Function(...Object.keys(collector),'return('+expression+')')(...Object.values(collector))
 expect(actualRolls).toMatchObject({d20:15,strokeOfLuck:false,shieldSpellReaction:false,uncannyDodge:false,shieldSpellcastingSavingThrows:{},classDamageRolls:[],inventoryEffectRolls:[],damageRolls:accepted})
 for(const patch of[{strokeOfLuck:true},{shieldSpellReaction:true},{uncannyDodge:true},{shieldSpellcastingSavingThrows:{'mover-token':[]}},{classDamageRolls:[{source:'sneak-attack',rolls:[1]}]},{inventoryEffectRolls:[{rolls:[1]}]},{unknownChoice:undefined},{prepared:{}},{map:{}},{state:{}},{targetTokenId:'foreign-target'}])await expect(Reflect.apply(boundary.recordFinalRolls,boundary,[Object.assign({},actualRolls,patch),1])).rejects.toThrow('changed-opportunity-original')
 await expect(boundary.recordFinalRolls({...actualRolls,d20:16},1)).rejects.toThrow('actual-retained-original-required')
 await realFactory.captured({rolls:actualRolls})
 expect(boundary.readOriginal().opportunity.damageRolls).toEqual(accepted)
 expect(boundary.readOriginal().opportunity.d20).toBe(1)
 // The actual producer keeps own-key distinctions and does not weaken the
 // shared strict guard, even for an explicit undefined original field.
 const flow=fs.readFileSync(process.env.XGE_BL_ORIGINAL_FLOW_SOURCE??'src/rulesets/dnd5e/bountifulOpportunityMoveOriginalFlow.ts','utf8'),canonicalStart=flow.indexOf('function collectedOpportunitySource('),canonicalEnd=flow.indexOf('type Gateway=',canonicalStart)
 if(canonicalStart<0||canonicalEnd<canonicalStart)throw Error('Actual concrete representation normalizer required')
 const canonicalCode=ts.transpileModule(flow.slice(canonicalStart,canonicalEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,canonical=new Function(canonicalCode+';return collectedOpportunitySource')()
 const original={d20:1,damageRolls:[],strokeOfLuck:undefined},explicit=canonical(original,{d20:1,damageRolls:accepted,strokeOfLuck:false})
 expect(Object.hasOwn(explicit,'strokeOfLuck')).toBe(true)
 expect(()=>assertBountifulAfterDiceSource('opportunity-move',{opportunity:original},{opportunity:explicit})).toThrow('changed-opportunity-original')


 expect(realFactory.parent().completed.result.ok).toBe(true)
 expect(realFactory.parent().completed.result.state.combatants['first-token'].turn.reactionAvailable).toBe(false)
 expect(realFactory.parent().completed.result.state.combatants['helper-token'].turn.reactionAvailable).toBe(false)
 expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)
 const originalRow=(data.combat.bountifulOriginalParents as Record<string,{opportunitySettlementRolls:{rawValues:number[];values:number[]}[]}>)[JSON.stringify(['bountiful-original-parent',action.id,0])]
 expect(originalRow.opportunitySettlementRolls).toHaveLength(1)
 expect(originalRow.opportunitySettlementRolls[0]).toMatchObject({rawValues:Array(damage.count).fill(2),values:Array(damage.count).fill(1)})
 }finally{roomSession.value={roomId:'room',memberId:'host',role:'dm'};await http.close();dispose()}
})
