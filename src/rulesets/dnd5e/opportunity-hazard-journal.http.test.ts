import{isDiceCharacterControlledByRemotePlayer}from'../../pages/maps/diceOwnership'
import{readBountifulOpportunitySequencePlayerDiceOwner,readBountifulOpportunitySequenceLockedRaw}from'./bountifulOpportunitySequenceSource'
import{readArcaneMovementPlayerDiceOwner}from'../../pages/maps/arcaneMovementDiceTransport'
import {readArcaneBasePrefixPlayerDiceOwner} from '../../pages/maps/arcaneBasePrefixDiceTransport'
import {dnd5eCombatTokenSide} from '../../lib/opportunityAttacks'
import {readBountifulOpportunitySettlementDiceRoute,readBountifulOpportunitySettlementLockedRaw,recordBountifulOpportunitySettlementHostRaw} from './bountifulOpportunitySettlementDice'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from './spellAction'
import {syncCharacterClassResources} from '../../lib/classResources'
import {settleDnd5eActivityTriggerWindowsV1} from './activities/dnd5eActivityTriggerSettlement'
import {resolveDnd5eActionWithMaterialDamageReactions} from './damageReactionFlow'
import {createDnd5eMovementHazardsProducer,type Dnd5eMovementHazardsProducerContext} from '../../pages/maps/movementHazardsProducer'
import {dnd5ePersistentAreaTurnKey} from '../../pages/maps/persistentAreaTurnBoundary'
import {resolveBountifulOriginalForNormalAck,refreshBountifulOpportunityMovementJournal} from './bountifulLuckNormalAck'
import fs from 'node:fs'
import ts from 'typescript'
import {createBountifulOpportunityMoveRawBoundary} from './bountifulOpportunityMoveOriginalFlow'
import {readBountifulNativeDiceRoute} from './bountifulHostOperation'
import {resolveBountifulOpportunityMoveForNormalAck,publishBountifulOpportunityMoveAck,previewBountifulOpportunityMovePrefix,settleBountifulOpportunityMoveHazards,settleBountifulOpportunityMoveHazardsWithJournal,readBountifulOpportunityMovePrefix,createBountifulOpportunityMoveLocalAuthority,settleBountifulOpportunityPostNativePrefix,readBountifulOpportunityPostNativePrefix} from './bountifulOpportunityMoveAck'
import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {prepareDnd5eOpportunityPlayerMove,recoverBountifulOpportunityPlayerMove,resolvePreparedDnd5eOpportunityPlayerMove,issueBountifulOpportunityMoveRawSource} from './opportunityMoveAction'
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
it.each([{hostOwned:false,lostConfirmationReply:false,crashBeforeConfirm:false}])('preserves canonical original CON controller and source journal (%j)',async({hostOwned,lostConfirmationReply,crashBeforeConfirm=false})=>{
 let shouldLoseReply=lostConfirmationReply,shouldInterruptRaw=crashBeforeConfirm
 const useLuck=true,deferMovement=true,withHazard=true,withKO=false
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)),http=await bountifulReadyHttpFixture()
 try{
 const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30})
 const attacker=normalizeCharacter({id:'first',name:'First',charClass:'战士',level:4,race:'人类',roomMemberId:'first-member',currentHp:30,maxHp:30})
 const mover=normalizeCharacter({id:'second',name:'Mover',charClass:'法师',level:4,race:'人类',roomMemberId:'second-member',currentHp:30,maxHp:30}),characters=[helper,attacker,mover]
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'first-token',characterId:'first',label:'First',x:25,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'mover-token',characterId:'second',label:'Mover',x:75,y:25,size:1,type:'player',dnd5eSide:'enemy',hp:30,maxHp:30,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:125,size:1,type:'player',dnd5eSide:'player',color:'',emoji:''}]}
 if(withKO){mover.currentHp=1;map.tokens.find(token=>token.id==='mover-token')!.hp=1}
 if(withHazard)map.dnd5eItemAreas=[{id:'actual-caltrops',kind:'caltrops',sourceCharacterId:'first',sourceTokenId:'first-token',sourceItemTemplateId:'caltrops',sourceItemName:'Caltrops',cells:[{col:2,row:0}],createdAt:1,armed:true}]
 const caster=syncCharacterClassResources(normalizeCharacter({id:'second',name:'Mover',roomMemberId:hostOwned?'host':'second-member',charClass:'吟游诗人',level:4,currentHp:30,maxHp:30,race:'人类',dnd5eClassChoices:{classes:{bard:{selections:{'spell-known':['heroism']}}}}}));characters[2]=caster
 const order=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))
 const spellAction:SharedPlayerActionState={id:'actual-concentration-source',mapId:'map',combatId:'combat',sourceMode:hostOwned?'dm':'player',status:'pending',type:'dnd5e-spell-cast',actorTokenId:'mover-token',characterId:'second',roomMemberId:hostOwned?'host':'second-member',targetTokenId:'mover-token',dnd5eSpellCast:{spellId:'heroism',castingClassId:'bard',slotLevel:1,targetTokenId:'mover-token'},round:1,initiativeIndex:1,seq:0,updatedAt:1}
 const spell=prepareDnd5eSpellCast({action:spellAction,map,characters,initiativeOrder:order});if(!spell.ok)throw Error('Real concentration preparation: '+spell.reason)
 const cast=resolvePreparedDnd5eSpellCast({prepared:spell.prepared,effectRolls:[]});if(!cast.result.ok||!cast.application)throw Error('Real concentration resolution required')
 Object.assign(map,cast.application.map);characters.splice(0,characters.length,...cast.application.characters)
 expect(characters.find(row=>row.id==='second')?.dnd5eCombatState?.concentrationSpellId).toBe('heroism')
 const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),economy=createDnd5eTurnEconomyCounts('combat:1:first-token'),moverEconomy=createDnd5eTurnEconomyCounts('combat:1:mover-token')
 const command:SharedPlayerActionState={id:'real-move-original',mapId:'map',combatId:'combat',sourceMode:hostOwned?'dm':'player',status:'pending',type:'move-token',actorTokenId:'mover-token',characterId:'second',roomMemberId:hostOwned?'host':'second-member',targetPosition:{x:175,y:25},round:1,initiativeIndex:1,seq:1,updatedAt:1}


 type Resource={_sync:{revision:number};[key:string]:unknown};const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},selectedId:'map',maps:[map]},combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:1,initiativeOrder},'player-action-requests':{_sync:{revision:1},requests:[]}}
 for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
 let journalSource:Record<string,unknown>|undefined,conConfirmations=0
 const commits:string[][]=[],gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,publishEvent:async(channel,payload)=>{if(channel==='bountiful-opportunity-settlement-confirm-dm-to-host')conConfirmations++;if(channel==='bountiful-opportunity-settlement-source-dm-to-host'&&payload&&typeof payload==='object'&&!Array.isArray(payload))journalSource=Object.fromEntries(Object.entries(payload));const response=await http.event(channel,payload,data,'host');if(response.status!==200)throw Error('HTTP '+response.status+':'+JSON.stringify(response.payload));data.combat=await http.readActualResource<Resource>('combat');if(channel==='bountiful-opportunity-settlement-confirm-dm-to-host'&&shouldLoseReply){shouldLoseReply=false;throw Error('simulated-confirmation-reply-lost')}},saveResourcesAtomically:async(writes,options)=>{
 const response=await http.state('POST','transaction',{...options,writes},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200)
 for(const write of writes)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:response.payload.revisions?.[write.name]??((data[write.name]?._sync.revision??0)+1)}};data.combat=response.saved;if(response.queue)data['player-action-requests']=response.queue;if(response.commandReceipts)data['combat-command-receipts']=response.commandReceipts;commits.push(writes.map(write=>write.name));return {status:'committed',transactionId:options?.transactionId??'',revisions:response.payload.revisions??{}}
 }}
 const appended=await http.command(command.id,{schemaVersion:1,command:{schemaVersion:1,commandId:command.id,type:'move-token',mapId:'map',combatId:'combat',actorTokenId:'mover-token',characterId:'second',round:1,initiativeIndex:1,seq:1,expectedRevisions:{combat:1,maps:1},issuedAt:1,expectedPosition:{x:75,y:25},expectedElevationFeet:0,targetPosition:{x:175,y:25}}},data,hostOwned?'host':'second-member');expect(appended.status,JSON.stringify(appended.payload)).toBe(202);data['player-action-requests']=appended.queue;data['combat-command-receipts']=appended.receipts
 const firstAction=(appended.queue.requests as SharedPlayerActionState[]).find(row=>row.id===command.id);if(!firstAction)throw Error('Actual appended moving PC required')
 let action:SharedPlayerActionState=firstAction
 const prepared=prepareDnd5eOpportunityPlayerMove({action,map,characters,initiativeOrder,moverEconomy,attackerEconomy:economy,attackerTokenId:'first-token'});if(!prepared.ok)throw Error(prepared.reason)
 let localProjection:ReturnType<Parameters<typeof createBountifulOpportunityMoveLocalAuthority>[0]['readProjection']>={map,characters,turnEconomyByToken:{'first-token':economy,'mover-token':moverEconomy,'helper-token':createDnd5eTurnEconomyCounts('combat:1:helper-token')}},geometryEpoch=1
 let local=createBountifulOpportunityMoveLocalAuthority({prepared:prepared.prepared,readProjection:()=>localProjection,readAnchors:()=>({geometryEpoch,charactersRevision:data.characters._sync.revision,mapsRevision:data.maps._sync.revision,round:data.combat.round,index:data.combat.initiativeIndex,combatId:data.combat.combatId})})
 expect(local.authorityUnchanged()).toBe(true);geometryEpoch++;expect(local.authorityUnchanged()).toBe(false);geometryEpoch--
 const rawRollId=durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:0})
 await expect(issueBountifulOpportunityMoveRawSource(JSON.parse(JSON.stringify(prepared.prepared)),{rawRollId,rawCursor:1,issuerMode:'dm'},gateway)).rejects.toThrow('actual-host-preparer-required')
 const exhaustedHelper=createDnd5eTurnEconomyCounts('combat:1:helper-token');exhaustedHelper.reaction.current=0
 data.combat.dnd5eTurnEconomyByToken={'helper-token':exhaustedHelper}
 await expect(issueBountifulOpportunityMoveRawSource(prepared.prepared,{rawRollId,rawCursor:1,issuerMode:'dm'},gateway)).rejects.toThrow('stale-original-turn-economy')
 delete data.combat.dnd5eTurnEconomyByToken
 let currentAuthority=true
 const boundary=createBountifulOpportunityMoveRawBoundary({prepared:prepared.prepared,rawCursor:1,issuerMode:'dm',deferMovement,authorityUnchanged:()=>currentAuthority&&local.authorityUnchanged()&&data.characters._sync.revision===1&&data.maps._sync.revision===1&&data.combat.active===true&&data.combat.initiativeIndex===1},gateway,{showChoice:receipt=>ui.showChoice(receipt),requestRoll:(receipt,refresh)=>ui.requestRoll(receipt,refresh)})
 await boundary.beforeOriginalRequest(rawRollId,1)
 expect(readBountifulNativeDiceRoute(boundary.getDiceRoute(),rawRollId,'first-token')).toMatchObject({characterId:'first',memberId:'first-member'})
 currentAuthority=false
 await expect(boundary.beforeOriginalRequest(rawRollId,1)).rejects.toThrow('stale-authority')
 currentAuthority=true
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
 const source=boundary.readOriginal(),first=(await http.state('GET','combat',null,data,'host')).saved.bountifulOriginalParents[JSON.stringify(['bountiful-original-parent',action.id,0])]
 expect(first.originalAdapterId).toBe('opportunity-move');expect(first.originalRoomAction).toEqual(action);expect(first.identity.roller).toMatchObject({tokenId:'first-token',characterId:'first',memberId:'first-member'})
 expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)
expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='mover-token')?.x).toBe(75)
 const restored=await readBountifulOriginalSource(first);expect(restored.source).toEqual(source)
 let finalSource=await boundary.recordFinalRolls({d20:useLuck?15:1,damageRolls:useLuck?Array(source.prepared.opportunity.damage.count).fill(1):[]},1)
 let conRolls=0
 let postNativeServices:Parameters<typeof settleBountifulOpportunityPostNativePrefix>[0]['services']|undefined
 let postNativeCompletion:Awaited<ReturnType<typeof settleBountifulOpportunityPostNativePrefix>>|undefined
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
  expect(prefixPreview.application?.map.tokens.find(token=>token.id==='mover-token')?.x).toBe(75)
  expect(prefixPreview.application?.characters.find(row=>row.id==='second')?.currentHp).toBeLessThan(30)
  expect(prefixPreview.result.state.combatants['first-token'].turn.reactionAvailable).toBe(false)
  expect(prefixPreview.result.state.combatants['helper-token'].turn.reactionAvailable).toBe(false)
  local.applyPrefix(prefixPreview,projection=>{localProjection=projection})
  expect(local.authorityUnchanged()).toBe(true)
  expect(localProjection.turnEconomyByToken['first-token'].reaction.current).toBe(0)
  expect(localProjection.turnEconomyByToken['helper-token'].reaction.current).toBe(0)
  expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)

  const services:Parameters<typeof settleBountifulOpportunityPostNativePrefix>[0]['services']={rollD20:async(label,_targetName,owner)=>{
   expect(label).toContain('专注');expect(owner?.rollerTokenId).toBe('mover-token')
   const route=owner&&'bountifulOpportunitySettlementRoute' in owner?owner.bountifulOpportunitySettlementRoute:undefined
   const requestId=owner&&'durableRollRequestId' in owner?owner.durableRollRequestId:undefined
   if(typeof requestId!=='string')throw Error('Expected actual journal request')
   const page=fs.readFileSync(process.env.XGE_ARCANE_PAGE_SOURCE??'src/pages/MapsWorkspacePage.tsx','utf8'),start=page.indexOf('    const nativeDiceOwner=readBountifulOpportunitySequencePlayerDiceOwner(context.'),end=page.indexOf('    const effectiveRollerSide',start)
   if(start<0||end<0)throw Error('Actual Maps source-specific D20 owner block required')
   const deps={isDiceCharacterControlledByRemotePlayer,characters,getRoomSession:()=>roomSession.value,ownedPlayerCharacter:undefined,readBountifulOpportunitySequencePlayerDiceOwner,readArcaneMovementPlayerDiceOwner,readArcaneBasePrefixPlayerDiceOwner,activeMap:map,combatIdRef:{current:data.combat.combatId},readBountifulNativeDiceRoute,readBountifulOpportunitySettlementDiceRoute,context:{bountifulOpportunitySettlementRoute:route},rollRequestId:requestId,explicitRollerToken:{id:'mover-token'}}
   const source=ts.transpileModule(page.slice(start,end)+';return nativeDiceOwner;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
   const actualOwner=await new Function(...Object.keys(deps),'return (async()=>{'+source+'})()')(...Object.values(deps))
   if(hostOwned)expect(actualOwner).toBeUndefined();else expect(actualOwner).toMatchObject({characterId:'second',memberId:'second-member',hostMemberId:'host'})
   expect(()=>readBountifulOpportunitySettlementDiceRoute(structuredClone(route),requestId,'mover-token')).toThrow('exact-issued-dice-route-required')

   const locked=readBountifulOpportunitySettlementLockedRaw(route,requestId,'mover-token',1,20)
   if(locked){
    expect(locked).toEqual([2]);expect(conRolls).toBe(1)
    const tokenStart=page.indexOf('  const findExplicitDiceToken ='),tokenEnd=page.indexOf('  const combatDiceGenerationRef',tokenStart)
    const tokenSource=ts.transpileModule(page.slice(tokenStart,tokenEnd)+';return findExplicitDiceToken;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
    const findToken=new Function('activeMap','isDM','objectFlightDiceMapsRef','creatureSensorDiceTokensRef',tokenSource)(map,true,{current:[]},{current:[]})
    const choiceStart=page.indexOf('  const confirmPlayerD20ChoiceReroll ='),choiceEnd=page.indexOf('  const [diceSavingThrowMarkers',choiceStart)
    const choiceSource=ts.transpileModule(page.slice(choiceStart,choiceEnd)+';return confirmPlayerD20ChoiceReroll;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
    const actualChoice=new Function('combatActiveRef','activeMap','findExplicitDiceToken','dnd5eCombatTokenSide',choiceSource)({current:true},map,findToken,dnd5eCombatTokenSide)
    const restoreStart=page.indexOf('    const lockedOpportunityRaw='),restoreEnd=page.indexOf("    if (mode === 'dm' && effectiveRollerSide",restoreStart)
    if(restoreStart<0||restoreEnd<0)throw Error('Actual Page locked raw branch required')
    const restoreDeps={readBountifulOpportunitySequenceLockedRaw,readBountifulOpportunitySettlementLockedRaw,context:owner,rollRequestId:requestId,explicitRollerToken:findToken('mover-token'),isDM:true,readDicePoolCheckpoint:()=>{throw Error('Browser cache must not supply the original die')},confirmDmDice:async(id:string,_label:string,_target:string,sides:number,values:number[])=>{
     expect(id).toBe(requestId);expect(sides).toBe(20);expect(values).toEqual([2])
     await recordBountifulOpportunitySettlementHostRaw({requestId:id,rollerTokenId:'mover-token',sides,values},gateway)
     return [...values]
    },label,targetName:'Mover',secretMonsterRoll:hostOwned,inferredRollKind:'saving-throw',combatActiveRef:{current:true},activeMap:map,confirmPlayerD20ChoiceReroll:actualChoice,namedRollerToken:findToken('mover-token'),rollOwnerCharacterId:'second'}
    const restore=ts.transpileModule(page.slice(restoreStart,restoreEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
    return await new Function(...Object.keys(restoreDeps),'return (async()=>{'+restore+'})()')(...Object.values(restoreDeps))
   }
   conRolls++
   const id=owner&&'durableRollRequestId' in owner&&typeof owner.durableRollRequestId==='string'?owner.durableRollRequestId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:1}),request={mapId:'map',combatId:'combat',requestId:id,rollerTokenId:'mover-token',targetCharacterId:'second',kind:'d20',count:1,sides:20,values:[],rollKind:'saving-throw',delivery:'player-roll-request',sourceMode:'dm',eventId:'actual-con-request',updatedAt:2}
   if(!hostOwned){const issued=await http.event('dice-roll-request-dm-to-player',request,data,'host');expect(issued.status,JSON.stringify(issued.payload)).toBe(200)}
   if(!journalSource)throw Error('Expected actual issued journal source')
   const beforeRaw=await gateway.loadResource<{bountifulOriginalParents:Record<string,BountifulOriginalDieReceipt>}>('combat')
   if(!beforeRaw)throw Error('Expected actual protected combat')
   const entry=Object.entries(beforeRaw.bountifulOriginalParents).find(([,row])=>row.identity.parentId===action.id&&row.identity.occurrence===0)
   if(!entry)throw Error('Expected original protected move parent')
   if(conRolls===1){
   const wrongRoller=await http.event('dice-roll-request-player-to-dm',{...request,delivery:'player-roll-result',values:[19],sourceMode:'player',eventId:'foreign-con-raw'},data,'helper-member');expect(wrongRoller.status).toBe(403)
   const forgedConfirm=await http.event('bountiful-opportunity-settlement-confirm-dm-to-host',{...journalSource,values:[19]},data,'host');expect(forgedConfirm.status).toBe(403)
   const forgedPublic=await http.state('PUT','combat',{...data.combat,bountifulOriginalParents:{...beforeRaw.bountifulOriginalParents,[entry[0]]:{...entry[1],opportunitySettlementRolls:[{...journalSource,rawValues:[19],values:[19]}]}}},data,'host');expect(forgedPublic.status,JSON.stringify(forgedPublic.payload)).toBe(409)
   }
   if(hostOwned){
    const hookStart=page.indexOf('    await recordBountifulOpportunitySettlementHostRaw('),hookEnd=page.indexOf('\n',hookStart)
    if(hookStart<0||hookEnd<0)throw Error('Actual Maps Host raw producer hook required')
    const dependencies={recordBountifulOpportunitySettlementHostRaw,id:requestId,diceOwnersRef:{current:new Map([[requestId,{rollerTokenId:'mover-token'}]])},sides:20,values:[2],publishSharedEvent:gateway.publishEvent}
    const hook=ts.transpileModule(page.slice(hookStart,hookEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
    await new Function(...Object.keys(dependencies),'return (async()=>{'+hook+'})()')(...Object.values(dependencies))
   }else{
   const raw=await http.event('dice-roll-request-player-to-dm',{...request,delivery:'player-roll-result',values:[2],sourceMode:'player',eventId:'actual-con-raw'},data,'second-member');expect(raw.status,JSON.stringify(raw.payload)).toBe(200)
   data.combat=await http.readActualResource<Resource>('combat')
   const changedRaw=await http.event('dice-roll-request-player-to-dm',{...request,delivery:'player-roll-result',values:[19],sourceMode:'player',eventId:'changed-con-raw'},data,'second-member');expect(changedRaw.status).toBe(403)

   }
   data.combat=await http.readActualResource<Resource>('combat')
   if(shouldInterruptRaw){shouldInterruptRaw=false;throw Error('simulated-before-confirm-reload')}
   return 2
  },rollD4:async()=>{throw Error('No bonus die expected')},rollDice:async()=>{throw Error('No other dice expected')},settleActivityTriggers:async request=>{
   const actual=await settleDnd5eActivityTriggerWindowsV1({state:request.state,events:request.events,eventBatchId:'actual-oa-native-prefix',combatRevision:data.combat._sync.revision,confirm:async()=>{throw Error('No unexpected Activity confirmation')},roll:async()=>{throw Error('No unexpected Activity dice')}})
   return {state:actual.state,events:actual.events,map:request.map}
  }}
  postNativeServices=services
  if(crashBeforeConfirm)await expect(settleBountifulOpportunityPostNativePrefix({action,prefix:prefixPreview,options:prefixOptions,services},gateway)).rejects.toThrow('simulated-before-confirm-reload')
  if(lostConfirmationReply)await expect(settleBountifulOpportunityPostNativePrefix({action,prefix:prefixPreview,options:prefixOptions,services},gateway)).rejects.toThrow('simulated-confirmation-reply-lost')
  const completionPrefix=lostConfirmationReply||crashBeforeConfirm?await previewBountifulOpportunityMovePrefix({action,options:prefixOptions},gateway):prefixPreview
  const completed=await settleBountifulOpportunityPostNativePrefix({action,prefix:completionPrefix,options:prefixOptions,services},gateway)
  const resumedPrefix=await previewBountifulOpportunityMovePrefix({action,options:prefixOptions},gateway)
  await settleBountifulOpportunityPostNativePrefix({action,prefix:resumedPrefix,options:prefixOptions,services},gateway)
  expect(conRolls).toBe(1);expect(conConfirmations).toBe(1)
  expect(completed.result.state.combatants['mover-token'].classState.concentrationSpellId).toBeUndefined()
  console.log('OA_POST_NATIVE_CON_EVENTS',JSON.stringify({before:prefixPreview.result.events.filter(event=>event.type==='concentration-resolved'||event.type==='concentration-check-required'),after:completed.result.events.filter(event=>event.type==='concentration-resolved'||event.type==='concentration-check-required')}))
  expect(completed.result.events.filter(event=>event.type==='concentration-resolved')).toHaveLength(1)
  expect(readBountifulOpportunityPostNativePrefix(action,completed).settlement).toEqual(completed)
  expect(()=>readBountifulOpportunityPostNativePrefix(action,structuredClone(completed))).toThrow('exact-base-completion-required')
  expect(()=>readBountifulOpportunityPostNativePrefix(structuredClone(action),completed)).toThrow('exact-base-completion-required')
  expect((data.characters.characters as typeof characters).find(row=>row.id==='second')?.dnd5eCombatState?.concentrationSpellId).toBe('heroism')
  expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)
  local.applyPostNative(completed,projection=>{localProjection=projection})
  expect(local.authorityUnchanged()).toBe(true)
  postNativeCompletion=completed
  finalSource=await boundary.recordMovement({},2)
 }
 const replay=await readBountifulOriginalOpportunityMoveInput({mapId:'map',parentId:action.id},gateway);expect(replay.hasAfterDice).toBe(true);expect(replay.source.opportunity.d20).toBe(1);expect(replay.source.opportunity.damageRolls).toEqual(finalSource.opportunity.damageRolls)
 await driveBountifulOriginalParent({mapId:'map',parentId:action.id},gateway,{showChoice:async()=>{throw Error('No repeated owner after reload')},requestRoll:async()=>{throw Error('No repeated original roller after reload')}})
 let resolved=await resolveBountifulOpportunityMoveForNormalAck({action,source:replay.source,postNative:postNativeCompletion,options:{combatRevision:data.combat._sync.revision,authorityUnchanged:local.authorityUnchanged,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('All source dice already accepted')}}},gateway)
 if(!resolved.result.ok||!resolved.application)throw Error('Actual original OA/move material result required')

 const unexpected=(..._input:unknown[]):never=>{throw Error('No unrelated movement callback expected')}
 let shouldInterruptHazard=true,hazardPhysicalRolls=0
 const restoreHazardD20=async(label:string,owner:Parameters<Dnd5eMovementHazardsProducerContext['rollDiceBoxD20Pair']>[3])=>{
  const route=owner&&'bountifulOpportunitySettlementRoute' in owner?owner.bountifulOpportunitySettlementRoute:undefined,requestId=owner?.durableRollRequestId,page=fs.readFileSync(process.env.XGE_ARCANE_PAGE_SOURCE??'src/pages/MapsWorkspacePage.tsx','utf8')
  if(typeof requestId!=='string')throw Error('actual-hazard-parent-roll-required')
   const locked=readBountifulOpportunitySettlementLockedRaw(route,requestId,'mover-token',1,20)
   if(locked){
    expect(locked).toEqual([2]);expect(hazardPhysicalRolls).toBe(1)
    const tokenStart=page.indexOf('  const findExplicitDiceToken ='),tokenEnd=page.indexOf('  const combatDiceGenerationRef',tokenStart)
    const tokenSource=ts.transpileModule(page.slice(tokenStart,tokenEnd)+';return findExplicitDiceToken;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
    const findToken=new Function('activeMap','isDM','objectFlightDiceMapsRef','creatureSensorDiceTokensRef',tokenSource)(map,true,{current:[]},{current:[]})
    const choiceStart=page.indexOf('  const confirmPlayerD20ChoiceReroll ='),choiceEnd=page.indexOf('  const [diceSavingThrowMarkers',choiceStart)
    const choiceSource=ts.transpileModule(page.slice(choiceStart,choiceEnd)+';return confirmPlayerD20ChoiceReroll;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
    const actualChoice=new Function('combatActiveRef','activeMap','findExplicitDiceToken','dnd5eCombatTokenSide',choiceSource)({current:true},map,findToken,dnd5eCombatTokenSide)
    const restoreStart=page.indexOf('    const lockedOpportunityRaw='),restoreEnd=page.indexOf("    if (mode === 'dm' && effectiveRollerSide",restoreStart)
    if(restoreStart<0||restoreEnd<0)throw Error('Actual Page locked raw branch required')
    const restoreDeps={readBountifulOpportunitySequenceLockedRaw,readBountifulOpportunitySettlementLockedRaw,context:owner,rollRequestId:requestId,explicitRollerToken:findToken('mover-token'),isDM:true,readDicePoolCheckpoint:()=>{throw Error('Browser cache must not supply the original die')},confirmDmDice:async(id:string,_label:string,_target:string,sides:number,values:number[])=>{
     expect(id).toBe(requestId);expect(sides).toBe(20);expect(values).toEqual([2])
     await recordBountifulOpportunitySettlementHostRaw({requestId:id,rollerTokenId:'mover-token',sides,values},gateway)
     return [...values]
    },label,targetName:'Mover',secretMonsterRoll:hostOwned,inferredRollKind:'saving-throw',combatActiveRef:{current:true},activeMap:map,confirmPlayerD20ChoiceReroll:actualChoice,namedRollerToken:findToken('mover-token'),rollOwnerCharacterId:'second'}
    const restore=ts.transpileModule(page.slice(restoreStart,restoreEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
    return await new Function(...Object.keys(restoreDeps),'return (async()=>{'+restore+'})()')(...Object.values(restoreDeps))
   }

  return undefined
 }
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
rollDiceBoxD20Pair:async(label,target,mode,context)=>{
 expect(label).toContain('敏捷豁免');expect(mode).toBe('normal')
 const locked=await restoreHazardD20(label,context);if(locked!==undefined)return[locked,undefined]
 hazardPhysicalRolls++
 const requestId=context?.durableRollRequestId;if(!requestId)throw Error('actual-hazard-parent-roll-required')
 const request={mapId:'map',combatId:'combat',requestId,rollerTokenId:'mover-token',targetCharacterId:'second',kind:'d20',count:1,sides:20,values:[],label,targetName:target,rollKind:'saving-throw',delivery:'player-roll-request',sourceMode:'dm',eventId:'actual-caltrops-request',updatedAt:3}
 expect((await http.event('dice-roll-request-dm-to-player',request,data,'host')).status).toBe(200)
 expect((await http.event('dice-roll-request-player-to-dm',{...request,delivery:'player-roll-result',values:[2],sourceMode:'player',eventId:'actual-caltrops-raw'},data,'second-member')).status).toBe(200)
 data.combat=await http.readActualResource<Resource>('combat')
 if(shouldInterruptHazard){shouldInterruptHazard=false;throw Error('simulated-hazard-raw-reload')}
 return [2,undefined]
},
deferNativeLuckyForBountifulOnMap:unexpected,
resolveDnd5eHeadlessActionWithAirborneFalls:async(state,action,_map,options,material)=>{
 expect(action.type).toBe('item-area-trigger')
 const result=await resolveDnd5eActionWithMaterialDamageReactions({state,action,options,combatRevision:data.combat._sync.revision,authorityUnchanged:local.authorityUnchanged,confirm:async()=>({accepted:false}),roll:unexpected},material)
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
 await expect(settleBountifulOpportunityMoveHazardsWithJournal({action,producer},gateway)).rejects.toThrow('simulated-hazard-raw-reload')
 const originalInput=await readBountifulOriginalOpportunityMoveInput({mapId:'map',parentId:action.id},gateway)
 const queued=await http.state('GET','player-action-requests',null,data,'host'),resumedAction=(queued.saved.requests as SharedPlayerActionState[]).find(row=>row.id===action.id)
 if(!resumedAction||!postNativeServices)throw Error('Actual pending original move and Base services required')
 await expect(recoverBountifulOpportunityPlayerMove({...resumedAction,actorTokenId:'helper-token'},gateway)).rejects.toThrow('actual-protected-original-required')
 action=resumedAction
 const liveMaps=await gateway.loadResource<{maps:BattleMap[]}>('maps'),liveCharacters=await gateway.loadResource<{characters:typeof characters}>('characters')
 const liveMap=liveMaps?.maps.find(map=>map.id==='map');if(!liveMap||!liveCharacters)throw Error('Actual backend baseline required')
 localProjection={map:liveMap,characters:liveCharacters.characters,turnEconomyByToken:{'first-token':economy,'mover-token':moverEconomy,'helper-token':createDnd5eTurnEconomyCounts('combat:1:helper-token')}}
 local=createBountifulOpportunityMoveLocalAuthority({prepared:await recoverBountifulOpportunityPlayerMove(action,gateway),readProjection:()=>localProjection,readAnchors:()=>({geometryEpoch,charactersRevision:data.characters._sync.revision,mapsRevision:data.maps._sync.revision,round:data.combat.round,index:data.combat.initiativeIndex,combatId:data.combat.combatId})})
 const options={combatRevision:data.combat._sync.revision,authorityUnchanged:local.authorityUnchanged,confirm:async()=>({accepted:false}),roll:unexpected}
 const freshPrefix=await previewBountifulOpportunityMovePrefix({action,options},gateway)
 local.applyPrefix(freshPrefix,projection=>{localProjection=projection})
 const freshBase=await settleBountifulOpportunityPostNativePrefix({action,prefix:freshPrefix,services:postNativeServices,options},gateway)
 local.applyPostNative(freshBase,projection=>{localProjection=projection})
 resolved=await resolveBountifulOpportunityMoveForNormalAck({action,source:originalInput.source,postNative:freshBase,options},gateway)
 const hazardResult=await settleBountifulOpportunityMoveHazardsWithJournal({action,producer},gateway)
 expect(hazardPhysicalRolls).toBe(1);expect(conRolls).toBe(1)
 await expect(refreshBountifulOpportunityMovementJournal(action,structuredClone(hazardResult),gateway)).rejects.toThrow('exact-movement-completion-required')
 await expect(refreshBountifulOpportunityMovementJournal(structuredClone(action),hazardResult,gateway)).rejects.toThrow('actual-parent-binding-required')

 expect(()=>local.applyMovement(structuredClone(hazardResult),()=>{throw Error('A copied witness must not apply')})).toThrow('actual-movement-witness-required')
 local.applyMovement(hazardResult,projection=>{localProjection=projection})
 expect(local.authorityUnchanged()).toBe(true)
 expect(hazardResult.result.ok).toBe(true)
 expect(hazardResult.result.state.combatants['first-token'].turn.reactionAvailable).toBe(false)
 if(withHazard)expect(hazardResult.logs.some(row=>row.includes('铁蒺藜')&&row.includes('失败'))).toBe(true)
 }
 if(!resolved.result.ok||!resolved.application)throw Error('Actual complete movement application required')
 const movementSpend=spendDnd5eMovement(moverEconomy,moverEconomy.movement.current-resolved.result.state.combatants['mover-token'].turn.movementRemaining)
 if(!movementSpend.ok)throw Error('Actual movement budget required')
 const economies={'first-token':{...economy,reaction:{...economy.reaction,current:0}},'mover-token':movementSpend.economy,'helper-token':createDnd5eTurnEconomyCounts('combat:1:helper-token')}
 const ackInput:PublishPlayerActionAckInput={ack:{id:'ack:'+action.id,actionId:action.id,mapId:'map',combatId:'combat',recipientMemberId:action.roomMemberId,status:'accepted',round:1,initiativeIndex:1,updatedAt:2},snapshots:{mapSelectedId:'map',characters:[...localProjection.characters],maps:[localProjection.map],updatedAt:2,combat:{mapId:'map',combatId:'combat',active:true,round:1,initiativeIndex:1,initiativeOrder,updatedAt:2,dnd5eTurnEconomyByToken:economies}},processed:{mapId:'map',combatId:'combat',actionIds:[action.id],updatedAt:2},expectedRevisions:{'player-action-ack':0,'player-action-processed':0},saveSharedResource:async()=>{throw Error('No independent move/attack write')},commitSharedResources:async(writes,options)=>{const result=await gateway.saveResourcesAtomically(writes,options);return {revisions:result.revisions}},loadSharedResource:gateway.loadResource,publishAck:async()=>{}}
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
 await publishBountifulOpportunityMoveAck(action,ackInput,gateway)
 expect(commits.filter(writes=>writes.includes('characters'))).toHaveLength(1)
 expect(data['player-action-ack'].actionId).toBe(action.id);expect(data['player-action-ack'].recipientMemberId).toBe(action.roomMemberId)
 expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='mover-token')?.x).toBe(withKO?75:withHazard?125:175)
 if(useLuck)expect((data.characters.characters as typeof characters).find(character=>character.id==='second')?.currentHp).toBeLessThan(30);else expect((data.characters.characters as typeof characters).find(character=>character.id==='second')?.currentHp).toBe(30)
 const commandStatus=await http.state('GET','combat-command-receipts',null,data,'host');expect(commandStatus.saved.receipts.find((row:{commandId:string})=>row.commandId===action.id)).toMatchObject({status:'committed',authoritative:{acceptedPosition:{x:withKO?75:withHazard?125:175,y:25}}});
 const done=await http.state('GET','combat',null,data,'host');expect(done.saved.dnd5eTurnEconomyByToken['first-token'].reaction.current).toBe(0);expect(done.saved.dnd5eTurnEconomyByToken['helper-token'].reaction.current).toBe(useLuck?0:1)
 expect((data.characters.characters as typeof characters).find(row=>row.id==='second')?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
 const count=commits.length;await publishBountifulOpportunityMoveAck(structuredClone(action),ackInput,gateway);expect(commits).toHaveLength(count)
 }finally{roomSession.value={roomId:'room',memberId:'host',role:'dm'};await http.close();dispose()}
})
