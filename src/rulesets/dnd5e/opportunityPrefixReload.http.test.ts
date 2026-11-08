import{loadBountifulActivityOriginalSource,loadBountifulPluginSpellAbilityOriginalSource}from'../../composition/browserSharedRoomResources';
import{hasMastermindOpportunityAck,publishMastermindOpportunityAck}from'../../pages/maps/mastermindOpportunityMisdirectionPublication'
import{hasBountifulOpportunitySequenceAck,publishBountifulOpportunitySequenceAck}from'./bountifulOpportunitySequenceAck'
import {createTokenMovementAnimation} from '../../lib/tokenMovementAnimation'
import {withTokenMovementPresentations} from '../../pages/maps/tokenMovementPresentation'
import {projectDnd5eCombatApplicationStoreState} from '../../pages/maps/combatApplicationStoreProjection'
import {captureBountifulOpportunityMovePrefixContext,readBountifulOpportunityMovePrefixContext} from './opportunityMovePrefixContext'
import {prepareBountifulOpportunityPlayerMoveFromPrefix,recoverBountifulOpportunityPlayerMove,readIssuedBountifulOpportunityPrefixProjection} from './opportunityMoveAction'
import {replayDnd5ePlayerMovePrefix} from './playerMovePrefix'
import {projectDnd5eHeadlessTurnEconomy} from './turnEconomy'
import {settleDnd5eActivityTriggerWindowsV1} from './activities/dnd5eActivityTriggerSettlement'
import {settleBountifulOpportunityPostNativePrefix} from './bountifulOpportunityMoveAck'
import {resolveDnd5eActionWithMaterialDamageReactions} from './damageReactionFlow'
import {createDnd5eMovementHazardsProducer} from '../../pages/maps/movementHazardsProducer'
import {dnd5ePersistentAreaTurnKey} from '../../pages/maps/persistentAreaTurnBoundary'
import {resolveBountifulOriginalForNormalAck,publishBountifulOrOrdinaryPlayerActionAck} from './bountifulLuckNormalAck'
import fs from 'node:fs'
import ts from 'typescript'
import {createBountifulOpportunityMoveRawBoundary} from './bountifulOpportunityMoveOriginalFlow'
import {readBountifulNativeDiceRoute} from './bountifulHostOperation'
import {resolveBountifulOpportunityMoveForNormalAck,publishBountifulOpportunityMoveAck,hasBountifulOpportunityMoveAck,previewBountifulOpportunityMovePrefix,settleBountifulOpportunityMoveHazards,readBountifulOpportunityMovePrefix,createBountifulOpportunityMoveLocalAuthority} from './bountifulOpportunityMoveAck'
import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {prepareDnd5eOpportunityPlayerMove,resolvePreparedDnd5eOpportunityPlayerMove,issueBountifulOpportunityMoveRawSource} from './opportunityMoveAction'
import {createDnd5eTurnEconomyCounts,spendDnd5eMovement} from './turnEconomy'
import {driveBountifulOriginalParent,readBountifulOriginalSource,readBountifulOriginalOpportunityMoveInput} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId} from './bountifulLuckReceipt'
import {routeBountifulOriginalResponse} from './bountifulOriginalResponseRouter'
import {submitBountifulOwnedDiceResult,submitBountifulHostConfirmation} from './bountifulLuckClientCommands'
import {bountifulReadyHttpFixture} from './opportunityMove.httpSupport'
import {durableD20RollId} from '../../lib/rollConfirmation'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {BattleMap} from '../../store/maps'
const roomSession=vi.hoisted(()=>({value:{roomId:'room',memberId:'host',role:'dm'}}));vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>roomSession.value}))
it.each(['deferred' as const])('keeps original500 world through actual prefix525, authenticated OA/BL raw and original625 ACK (%s)',async(choice:boolean|'deferred'|'caltrops'|'ko')=>{
 const useLuck=choice!==false,deferMovement=choice==='deferred',withHazard=choice==='caltrops',withKO=choice==='ko'
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)),http=await bountifulReadyHttpFixture()
 try{
 const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30})
 const attacker=normalizeCharacter({id:'first',name:'First',charClass:'战士',level:4,race:'人类',roomMemberId:'first-member',currentHp:30,maxHp:30})
 const mover=normalizeCharacter({id:'second',name:'Mover',charClass:'法师',level:4,race:'人类',roomMemberId:'second-member',currentHp:30,maxHp:30}),characters=[helper,attacker,mover]
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'first-token',characterId:'first',label:'First',x:450,y:375,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'mover-token',characterId:'second',label:'Mover',x:500,y:375,size:1,type:'player',dnd5eSide:'enemy',hp:30,maxHp:30,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:450,y:475,size:1,type:'player',dnd5eSide:'player',color:'',emoji:''}]}
 if(withKO){mover.currentHp=1;map.tokens.find(token=>token.id==='mover-token')!.hp=1}
 if(withHazard)map.dnd5eItemAreas=[{id:'actual-caltrops',kind:'caltrops',sourceCharacterId:'first',sourceTokenId:'first-token',sourceItemTemplateId:'caltrops',sourceItemName:'Caltrops',cells:[{col:2,row:0}],createdAt:1,armed:true}]
 const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),economy=createDnd5eTurnEconomyCounts('combat:1:first-token'),moverEconomy=createDnd5eTurnEconomyCounts('combat:1:mover-token')
 const command:SharedPlayerActionState={id:'real-move-original',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'move-token',actorTokenId:'mover-token',characterId:'second',roomMemberId:'second-member',targetPosition:{x:500,y:475},round:1,initiativeIndex:1,seq:1,updatedAt:1}


 type Resource={_sync:{revision:number};[key:string]:unknown};const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},selectedId:'map',maps:[map]},combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:1,initiativeOrder},'player-action-requests':{_sync:{revision:1},requests:[]}}
 for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
 const commits:string[][]=[],gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,publishEvent:async(channel,payload)=>{const response=await http.event(channel,payload,data,'host');if(response.status!==200)throw Error('HTTP '+response.status+':'+JSON.stringify(response.payload))},saveResourcesAtomically:async(writes,options)=>{
 const response=await http.state('POST','transaction',{...options,writes},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200)
 for(const write of writes)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:response.payload.revisions?.[write.name]??((data[write.name]?._sync.revision??0)+1)}};data.combat=response.saved;if(response.queue)data['player-action-requests']=response.queue;if(response.commandReceipts)data['combat-command-receipts']=response.commandReceipts;commits.push(writes.map(write=>write.name));return {status:'committed',transactionId:options?.transactionId??'',revisions:response.payload.revisions??{}}
 }}
 const appended=await http.command(command.id,{schemaVersion:1,command:{schemaVersion:1,commandId:command.id,type:'move-token',mapId:'map',combatId:'combat',actorTokenId:'mover-token',characterId:'second',round:1,initiativeIndex:1,seq:1,expectedRevisions:{combat:1,maps:1},issuedAt:1,expectedPosition:{x:500,y:375},expectedElevationFeet:0,targetPosition:{x:500,y:475}}},data,'second-member');expect(appended.status,JSON.stringify(appended.payload)).toBe(202);data['player-action-requests']=appended.queue;data['combat-command-receipts']=appended.receipts
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
 const prefixContext=captureBountifulOpportunityMovePrefixContext({action,map,characters,initiativeOrder,moverEconomy,turnEconomyByToken:localProjection.turnEconomyByToken,originalEconomies:localProjection.turnEconomyByToken},()=>({geometryEpoch,clock:1}))
 const prefixNative=replayDnd5ePlayerMovePrefix({originalInput:{action,map,characters,initiativeOrder,turnEconomy:moverEconomy},prepared:prepared.prepared.movement,position:{x:525,y:425},elevationFeet:0,firstHostNow:readBountifulOpportunityMovePrefixContext(prefixContext).firstHostNow,transactionId:'player-move:'+action.id+':segment:1'})
 if(!prefixNative.resolution.result.ok||!prefixNative.resolution.application)throw Error('Real actual prefix material required')
 const firstPrefixAnimation=createTokenMovementAnimation({id:'player-move:'+action.id+':segment:1:mover-token',path:prefixNative.prepared.path,finalPosition:{x:525,y:425},issuedAt:readBountifulOpportunityMovePrefixContext(prefixContext).firstHostNow+100})
 prefixNative.resolution.application=withTokenMovementPresentations({application:prefixNative.resolution.application,byTokenId:firstPrefixAnimation?{'mover-token':firstPrefixAnimation}:{}})
 const prefixActor=prefixNative.resolution.result.state.combatants['mover-token']
 localProjection={...projectDnd5eCombatApplicationStoreState({map,characters,application:prefixNative.resolution.application}),turnEconomyByToken:{...localProjection.turnEconomyByToken,'mover-token':projectDnd5eHeadlessTurnEconomy(moverEconomy,prefixActor.turn,prefixActor.speed)}}
 expect(localProjection.map.tokens.find(row=>row.id==='mover-token')?.x).toBe(525)
 expect((data.maps.maps as BattleMap[])[0].tokens.find(row=>row.id==='mover-token')?.x).toBe(500)
 const pageSource=fs.readFileSync(process.env.XGE_ARCANE_PAGE_SOURCE??'src/pages/MapsWorkspacePage.tsx','utf8'),factoryStart=pageSource.indexOf('          create:facts=>{',pageSource.indexOf('opportunityAttackers.length===1?{originalMove:')),factoryEnd=pageSource.indexOf('        }}:undefined',factoryStart)
 if(factoryStart<0||factoryEnd<0)throw Error('Actual queued move factory required')
 const sequence={current:new Map<string,number>()},turns={get current(){return localProjection.turnEconomyByToken}}
 const factoryDeps={prefixContext,prepareBountifulOpportunityPlayerMoveFromPrefix,mode:'dm',restoredOpportunityPrepared:undefined,storedOpportunityInput:undefined,prepareDnd5eOpportunityPlayerMove,createBountifulOpportunityMoveLocalAuthority,createBountifulOpportunityMoveRawBoundary,action,authorityMap:localProjection.map,
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
 let realFactory=new Function(...Object.keys(factoryDeps),factoryCode)(...Object.values(factoryDeps))
 const actualFactoryResult=realFactory.create({mode:'normal',choices:{tranquilitySave:undefined,areaAttackAdvantageReaction:undefined,disadvantageNegationChoice:undefined}})
 let boundary:ReturnType<typeof createBountifulOpportunityMoveRawBoundary>=actualFactoryResult.boundary
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
 const mapText=fs.readFileSync(process.env.XGE_ARCANE_PAGE_SOURCE??'src/pages/MapsWorkspacePage.tsx','utf8'),rawStart=mapText.indexOf("    const original = tranquility.passed && typeof originalInput === 'function'"),rawEnd=mapText.indexOf('    const blessRoll =',rawStart)
 if(rawStart<0||rawEnd<0)throw Error('Actual Maps original OA raw block required')
 const dependencies={originalInput:(facts:{mode:string;choices:unknown})=>{expect(facts.mode).toBe('normal');expect(facts.choices).toEqual({tranquilitySave:undefined,areaAttackAdvantageReaction:undefined,disadvantageNegationChoice:undefined});return {requestId:rawRollId,boundary}},disadvantageNegationChoice:undefined,tranquility:{passed:true},effectiveAttackMode:'normal',attackRollContext:{rollKind:'attack',rollerTokenId:'first-token',rollerCharacterId:'first'},attack:prepared.prepared.opportunity,
  rollDiceBoxD20Pair:async(_label:string,_target:string,mode:string,context:{durableRollRequestId:string;bountifulNativeDiceRoute:ReturnType<typeof boundary.getDiceRoute>},after:(values:readonly number[],id:string)=>Promise<readonly [number,number|undefined]>)=>{
   expect(mode).toBe('normal');expect(context.durableRollRequestId).toBe(rawRollId)
   expect(readBountifulNativeDiceRoute(context.bountifulNativeDiceRoute,rawRollId,'first-token')).toMatchObject({characterId:'first',memberId:'first-member'})
   await emitOriginalRaw();return after([1],rawRollId)
  }}
 const rawCode=ts.transpileModule(mapText.slice(rawStart,rawEnd)+';return [d20,d20Second];',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 expect(await new Function(...Object.keys(dependencies),'return (async()=>{'+rawCode+'})()')(...Object.values(dependencies))).toEqual([useLuck?15:1,undefined])
 const recoveredBeforeAfterDice=await recoverBountifulOpportunityPlayerMove(action,gateway)
 const repeatedNative=replayDnd5ePlayerMovePrefix({originalInput:{action,map,characters,initiativeOrder,turnEconomy:moverEconomy},prepared:prepared.prepared.movement,position:{x:525,y:425},elevationFeet:0,firstHostNow:recoveredBeforeAfterDice.transactionNow+1000,transactionId:'player-move:'+action.id+':segment:1'})
 if(!repeatedNative.resolution.result.ok||!repeatedNative.resolution.application)throw Error('Genuine repeated initial segment required')
 const repeatedAnimation=createTokenMovementAnimation({id:'player-move:'+action.id+':segment:1:mover-token',path:repeatedNative.prepared.path,finalPosition:{x:525,y:425},issuedAt:recoveredBeforeAfterDice.transactionNow+1100})
 if(!repeatedAnimation)throw Error('Genuine multi-point segment presentation required')
 const repeatedApplication=withTokenMovementPresentations({application:repeatedNative.resolution.application,byTokenId:{'mover-token':repeatedAnimation}})
 const repeatedActor=repeatedNative.resolution.result.state.combatants['mover-token'],repeatedProjection={...projectDnd5eCombatApplicationStoreState({map,characters,application:repeatedApplication}),turnEconomyByToken:{...recoveredBeforeAfterDice.turnEconomyByToken,'mover-token':projectDnd5eHeadlessTurnEconomy(moverEconomy,repeatedActor.turn,repeatedActor.speed)}}
 expect(repeatedProjection.turnEconomyByToken['mover-token'].movement.current).toBe(25)
 expect(repeatedProjection.map.tokens.find(row=>row.id==='mover-token')).toMatchObject({x:525,y:425})
 const replayedPrefixContext=captureBountifulOpportunityMovePrefixContext(readBountifulOpportunityMovePrefixContext(prefixContext).input,()=>({geometryEpoch,clock:1}))
 const resumedLocal=createBountifulOpportunityMoveLocalAuthority({prepared:recoveredBeforeAfterDice,replayedPrefixContext,readProjection:()=>repeatedProjection,readAnchors:()=>({geometryEpoch,clock:1})})
 expect(resumedLocal.authorityUnchanged()).toBe(true)
 const wrongWorld=structuredClone(repeatedProjection);wrongWorld.characters.find(row=>row.id==='second')!.currentHp--
 expect(()=>createBountifulOpportunityMoveLocalAuthority({prepared:recoveredBeforeAfterDice,replayedPrefixContext,readProjection:()=>wrongWorld,readAnchors:()=>({geometryEpoch,clock:1})})).toThrow('actual-native-prefix-projection-required')
 expect(()=>createBountifulOpportunityMoveLocalAuthority({prepared:recoveredBeforeAfterDice,replayedPrefixContext:{...replayedPrefixContext},readProjection:()=>repeatedProjection,readAnchors:()=>({geometryEpoch,clock:1})})).toThrow('exact-original-context-required')
 localProjection=repeatedProjection
 const reloadedDeps={...factoryDeps,prefixContext:replayedPrefixContext,restoredOpportunityPrepared:recoveredBeforeAfterDice,storedOpportunityInput:await readBountifulOriginalOpportunityMoveInput({mapId:'map',parentId:action.id},gateway)}
 realFactory=new Function(...Object.keys(reloadedDeps),factoryCode)(...Object.values(reloadedDeps))
 boundary=realFactory.create({mode:recoveredBeforeAfterDice.rawMode,choices:recoveredBeforeAfterDice.originalChoices??{}}).boundary
 local=realFactory.parent().local
 const persistedOriginal=await boundary.resumeOriginal();expect(persistedOriginal.d20).toBe(1)
 await boundary.beforeOriginalRequest(rawRollId,1)
 const resumedDice=await boundary.afterOriginalConfirmed([persistedOriginal.d20!],rawRollId);expect(resumedDice).toEqual([15,undefined])
 await realFactory.captured({rolls:{d20:15,damageRolls:Array(realFactory.parent().prepared.opportunity.damage.count).fill(1)}})
 expect(realFactory.parent().completed.result.ok).toBe(true)
 expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)
 const source=boundary.readOriginal(),first=(await http.state('GET','combat',null,data,'host')).saved.bountifulOriginalParents[JSON.stringify(['bountiful-original-parent',action.id,0])]
 expect(first.originalAdapterId).toBe('opportunity-move');expect(first.originalRoomAction).toEqual(action);expect(first.identity.roller).toMatchObject({tokenId:'first-token',characterId:'first',memberId:'first-member'})
 const recoveredPrefix=await recoverBountifulOpportunityPlayerMove(action,gateway)
 expect(recoveredPrefix.map.tokens.find(row=>row.id==='mover-token')?.x).toBe(500)
 expect(readIssuedBountifulOpportunityPrefixProjection(recoveredPrefix)?.map.tokens.find(row=>row.id==='mover-token')?.x).toBe(525)
 expect(recoveredPrefix.transactionNow).toBe(source.prepared.transactionNow)
 expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)
expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='mover-token')?.x).toBe(500)
 const restored=await readBountifulOriginalSource(first,{includeContinuation:true});expect(restored.source).toEqual(source)
 let finalSource=await boundary.recordFinalRolls({d20:useLuck?15:1,damageRolls:useLuck?Array(source.prepared.opportunity.damage.count).fill(1):[]},1)
 if(deferMovement){
  expect(finalSource.stage).toBe('opportunity')
  const prefix=await readBountifulOriginalOpportunityMoveInput({mapId:'map',parentId:action.id},gateway)
  expect(prefix.hasAfterDice).toBe(true);expect(prefix.source.stage).toBe('opportunity')
  await expect(resolveBountifulOpportunityMoveForNormalAck({action,source:prefix.source,options:{combatRevision:data.combat._sync.revision,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('Incomplete prefix must not ask dice')}}},gateway)).rejects.toThrow('movement-not-settled')
  expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)
  const prefixOptions={combatRevision:data.combat._sync.revision,authorityUnchanged:local.authorityUnchanged,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('All original prefix dice are persisted')}}
  await expect(resolveBountifulOriginalForNormalAck({action,source:prefix.source,resolve:resolvePreparedDnd5eOpportunityPlayerMove,options:prefixOptions},gateway)).rejects.toThrow('opportunity-prefix-not-final')
  const prefixPreview=await previewBountifulOpportunityMovePrefix({action,options:prefixOptions},gateway)
  expect(readBountifulOpportunityMovePrefix(action,prefixPreview)).toBe(true)
  expect(()=>readBountifulOpportunityMovePrefix(action,structuredClone(prefixPreview))).toThrow('exact-original-witness-required')
  expect(prefixPreview.application?.map.tokens.find(token=>token.id==='mover-token')?.x).toBe(525)
  expect(prefixPreview.application?.characters.find(row=>row.id==='second')?.currentHp).toBeLessThan(30)
  expect(prefixPreview.result.state.combatants['first-token'].turn.reactionAvailable).toBe(false)
  expect(prefixPreview.result.state.combatants['helper-token'].turn.reactionAvailable).toBe(false)
  local.applyPrefix(prefixPreview,projection=>{localProjection=projection})
  expect(local.authorityUnchanged()).toBe(true)
  expect(localProjection.turnEconomyByToken['first-token'].reaction.current).toBe(0)
  expect(localProjection.turnEconomyByToken['helper-token'].reaction.current).toBe(0)
  expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)
  finalSource=await boundary.recordMovement({},1)
  expect(finalSource.stage).toBeUndefined()
 }
 const replay=await readBountifulOriginalOpportunityMoveInput({mapId:'map',parentId:action.id},gateway);expect(replay.hasAfterDice).toBe(true);expect(replay.source.opportunity.d20).toBe(1);expect(replay.source.opportunity.damageRolls).toEqual(finalSource.opportunity.damageRolls)
 await driveBountifulOriginalParent({mapId:'map',parentId:action.id},gateway,{showChoice:async()=>{throw Error('No repeated owner after reload')},requestRoll:async()=>{throw Error('No repeated original roller after reload')}})
 const resolved=await resolveBountifulOpportunityMoveForNormalAck({action,source:replay.source,options:{combatRevision:data.combat._sync.revision,authorityUnchanged:local.authorityUnchanged,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('All source dice already accepted')}}},gateway)
 if(!resolved.result.ok||!resolved.application)throw Error('Actual original OA/move material result required')

 const unexpected=(..._input:unknown[]):never=>{throw Error('No unrelated movement callback expected')}
 const producer=createDnd5eMovementHazardsProducer({rollDiceBoxValues:unexpected,
requestDnd5ePersistentAreaWillingFailure:unexpected,
combatActiveRef:{current:true},
initiativeOrderRef:{current:initiativeOrder},
combatIdRef:{current:'combat'},
rollDnd5eMapSavingThrowInterrupts:unexpected,
requestSharedChoiceWindow:unexpected,
collectDnd5ePersistentAreaRolls:unexpected,
requestSharedPersistentAreaAdjudication:unexpected,
roundRef:{current:1},
initiativeIndexRef:{current:1},
rollTempleEntryEffectDice:unexpected,
rollOpeningAttackSavingThrow:unexpected,
publishDnd5ePersistentAreaSaveResult:unexpected,
settleDnd5eConcentrationChecks:unexpected,
rollDnd5eUnsupportedAirborneFalls:unexpected,
settleDnd5eMapMountedBalance:unexpected,
rollDiceBoxD20:unexpected,
requestSharedHellishRebukeChoice:unexpected,
collectSharedSpellDamageDieChoices:unexpected,
requestDnd5eSavingThrowRerollDice:unexpected,
requestDnd5eBardicInspirationRoll:unexpected,
requestDnd5eOptionalBonusDieUse:unexpected,
requestDnd5eDarkOnesOwnLuckRoll:unexpected,
requestSharedPostSpellRandomTableChoice:unexpected,
requestSharedPostSpellRandomTableAdjudication:unexpected,
updateDnd5eTurnEconomy:unexpected,
rollDiceBoxD20Pair:async(label)=>{expect(withHazard).toBe(true);expect(label).toContain('敏捷豁免');return [2,undefined]},
deferNativeLuckyForBountifulOnMap:unexpected,
resolveDnd5eHeadlessActionWithAirborneFalls:async(state,action,_map,options,material)=>{
 expect(action.type).toBe('item-area-trigger')
 const result=await resolveDnd5eActionWithMaterialDamageReactions({state,action,options,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:unexpected},material)
 return result
},
currentPersistentAreaTurnKey:(round:number,tokenId:string)=>dnd5ePersistentAreaTurnKey({round,slotId:'',tokenId}),
resolveDnd5eForcedFallInterrupts:unexpected,
damageReactionOptionsForMap:unexpected,
initiativeOrderForHeadlessState:unexpected,
requestOptionalDamageSave:unexpected})

 await expect(settleBountifulOpportunityMoveHazards({action:structuredClone(action),producer})).rejects.toThrow('exact-issued-move-required')
 if(withKO){
 expect(resolved.movementInterrupted).toBe('mover-defeated')
 expect(resolved.result.state.combatants['mover-token'].currentHp).toBe(0)
 local.applyMovement(resolved,projection=>{localProjection=projection})
 }else{
 const hazardResult=await settleBountifulOpportunityMoveHazards({action,producer})
 expect(()=>local.applyMovement(structuredClone(hazardResult),()=>{throw Error('A copied witness must not apply')})).toThrow('actual-movement-witness-required')
 local.applyMovement(hazardResult,projection=>{localProjection=projection})
 expect(local.authorityUnchanged()).toBe(true)
 expect(hazardResult.result.ok).toBe(true)
 expect(hazardResult.result.state.combatants['first-token'].turn.reactionAvailable).toBe(false)
 if(withHazard)expect(hazardResult.logs.some(row=>row.includes('铁蒺藜')&&row.includes('失败'))).toBe(true)
 }
 const movementSpend=spendDnd5eMovement(moverEconomy,moverEconomy.movement.current-resolved.result.state.combatants['mover-token'].turn.movementRemaining)
 if(!movementSpend.ok)throw Error('Actual movement budget required')
 const economies={'first-token':{...economy,reaction:{...economy.reaction,current:0}},'mover-token':movementSpend.economy,'helper-token':createDnd5eTurnEconomyCounts('combat:1:helper-token')}
 const ackInput:PublishPlayerActionAckInput={ack:{id:'ack:'+action.id,actionId:action.id,mapId:'map',combatId:'combat',recipientMemberId:'second-member',status:'accepted',round:1,initiativeIndex:1,updatedAt:2},snapshots:{mapSelectedId:'map',characters:[...localProjection.characters],maps:[localProjection.map],updatedAt:2,combat:{mapId:'map',combatId:'combat',active:true,round:1,initiativeIndex:1,initiativeOrder,updatedAt:2,dnd5eTurnEconomyByToken:economies}},processed:{mapId:'map',combatId:'combat',actionIds:[action.id],updatedAt:2},expectedRevisions:{'player-action-ack':0,'player-action-processed':0},saveSharedResource:async()=>{throw Error('No independent move/attack write')},commitSharedResources:async(writes,options)=>{const result=await gateway.saveResourcesAtomically(writes,options);return {revisions:result.revisions}},loadSharedResource:gateway.loadResource,publishAck:async()=>{}}
 expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)

 if(!ackInput.snapshots?.combat?.dnd5eTurnEconomyByToken)throw Error('Actual final movement costs required')
 await expect(publishBountifulOpportunityMoveAck(structuredClone(action),ackInput,gateway)).rejects.toThrow('exact-original-witness-required')
 const refund=structuredClone(ackInput.snapshots);refund.combat!.dnd5eTurnEconomyByToken!['first-token'].reaction.current=1
 await expect(publishBountifulOpportunityMoveAck(action,{...ackInput,snapshots:refund},gateway)).rejects.toThrow('changed-original-cost')
 const unspent=structuredClone(ackInput.snapshots);unspent.combat!.dnd5eTurnEconomyByToken!['mover-token'].movement.current=30
 await expect(publishBountifulOpportunityMoveAck(action,{...ackInput,snapshots:unspent},gateway)).rejects.toThrow('changed-original-cost')
 const missingSpent=structuredClone(ackInput.snapshots);missingSpent.combat!.dnd5eTurnEconomyByToken!['mover-token'].movement.spent=0
 await expect(publishBountifulOpportunityMoveAck(action,{...ackInput,snapshots:missingSpent},gateway)).rejects.toThrow('changed-original-cost')
 const extraHp=structuredClone(ackInput.snapshots);extraHp.characters.find(row=>row.id==='second')!.currentHp--
 await expect(publishBountifulOpportunityMoveAck(action,{...ackInput,snapshots:extraHp},gateway)).rejects.toThrow('changed-original-materials')
 expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)
 const dispatchStart=pageSource.indexOf('    const publishOriginal='),dispatchEnd=pageSource.indexOf('\n    const commit = publishOriginal(action, {',dispatchStart)
 if(dispatchStart<0||dispatchEnd<0)throw Error('Actual current Page private ACK dispatcher required')
 const declaration=ts.transpileModule(pageSource.slice(dispatchStart,dispatchEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 const actualFactory=new Function('hasBountifulOpportunityMoveAck','publishBountifulOpportunityMoveAck','publishBountifulOrOrdinaryPlayerActionAck','loadSharedResource','transactionSideEffects','hasMastermindOpportunityAck','publishMastermindOpportunityAck','hasBountifulOpportunitySequenceAck','publishBountifulOpportunitySequenceAck','saveSharedResourcesAtomically','loadBountifulActivityOriginalSource','loadBountifulPluginSpellAbilityOriginalSource',declaration+';return publishOriginal')
 const choosePublisher=actualFactory(hasBountifulOpportunityMoveAck,()=>publishBountifulOpportunityMoveAck,()=>publishBountifulOrOrdinaryPlayerActionAck,gateway.loadResource,undefined,hasMastermindOpportunityAck,publishMastermindOpportunityAck,hasBountifulOpportunitySequenceAck,publishBountifulOpportunitySequenceAck,gateway.saveResourcesAtomically,loadBountifulActivityOriginalSource,loadBountifulPluginSpellAbilityOriginalSource)
 expect(choosePublisher(structuredClone(action),{})).toBe(publishBountifulOrOrdinaryPlayerActionAck)
 expect(choosePublisher(action,{})).toBe(publishBountifulOpportunityMoveAck)
 const actualPublisher=actualFactory(hasBountifulOpportunityMoveAck,publishBountifulOpportunityMoveAck,publishBountifulOrOrdinaryPlayerActionAck,gateway.loadResource,undefined,hasMastermindOpportunityAck,publishMastermindOpportunityAck,hasBountifulOpportunitySequenceAck,publishBountifulOpportunitySequenceAck,gateway.saveResourcesAtomically,loadBountifulActivityOriginalSource,loadBountifulPluginSpellAbilityOriginalSource)
 await actualPublisher(action,ackInput)
 expect(commits.filter(writes=>writes.includes('characters'))).toHaveLength(1)
 expect(data['player-action-ack'].actionId).toBe(action.id);expect(data['player-action-ack'].recipientMemberId).toBe('second-member')
 expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='mover-token')?.x).toBe(withKO?525:withHazard?575:525)
 if(useLuck)expect((data.characters.characters as typeof characters).find(character=>character.id==='second')?.currentHp).toBeLessThan(30);else expect((data.characters.characters as typeof characters).find(character=>character.id==='second')?.currentHp).toBe(30)
 const commandStatus=await http.state('GET','combat-command-receipts',null,data,'host');expect(commandStatus.saved.receipts.find((row:{commandId:string})=>row.commandId===action.id)).toMatchObject({status:'committed',authoritative:{acceptedPosition:{x:withKO?525:withHazard?575:525,y:475}}});
 const done=await http.state('GET','combat',null,data,'host');expect(done.saved.dnd5eTurnEconomyByToken['first-token'].reaction.current).toBe(0);expect(done.saved.dnd5eTurnEconomyByToken['helper-token'].reaction.current).toBe(useLuck?0:1)
 const count=commits.length;await publishBountifulOpportunityMoveAck(structuredClone(action),ackInput,gateway);expect(commits).toHaveLength(count)
 }finally{roomSession.value={roomId:'room',memberId:'host',role:'dm'};await http.close();dispose()}
})
