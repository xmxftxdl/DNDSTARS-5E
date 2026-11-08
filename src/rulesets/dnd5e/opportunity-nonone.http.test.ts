
import fs from 'node:fs'
import ts from 'typescript'
import {createBountifulOpportunityMoveRawBoundary} from './bountifulOpportunityMoveOriginalFlow'
import {readBountifulNativeDiceRoute} from './bountifulHostOperation'
import { createBountifulOpportunityMoveLocalAuthority } from './bountifulOpportunityMoveAck';
import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import { prepareDnd5eOpportunityPlayerMove, issueBountifulOpportunityMoveRawSource } from './opportunityMoveAction';
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import { driveBountifulOriginalParent } from './bountifulLuckPersistentRoomDriver';
import {bountifulOriginalDieRollId} from './bountifulLuckReceipt'
import {routeBountifulOriginalResponse} from './bountifulOriginalResponseRouter'
import {submitBountifulOwnedDiceResult,submitBountifulHostConfirmation} from './bountifulLuckClientCommands'
import {bountifulReadyHttpFixture} from './opportunityMove.httpSupport'
import {durableD20RollId} from '../../lib/rollConfirmation'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {BattleMap} from '../../store/maps'
const roomSession=vi.hoisted(()=>({value:{roomId:'room',memberId:'host',role:'dm'}}));vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>roomSession.value}))
it.each([false])('preserves the true moving PC request, distinct original OA roller, reload and original final ACK CAS (BLuse=%s)',async(choice)=>{
 const useLuck=choice!==false,deferMovement=false,withHazard=false
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)),http=await bountifulReadyHttpFixture()
 try{
 const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30})
 const attacker=normalizeCharacter({id:'first',name:'First',charClass:'战士',level:4,race:'人类',roomMemberId:'first-member',currentHp:30,maxHp:30})
 const mover=normalizeCharacter({id:'second',name:'Mover',charClass:'法师',level:4,race:'人类',roomMemberId:'second-member',currentHp:30,maxHp:30}),characters=[helper,attacker,mover]
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'first-token',characterId:'first',label:'First',x:25,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'mover-token',characterId:'second',label:'Mover',x:75,y:25,size:1,type:'player',dnd5eSide:'enemy',hp:30,maxHp:30,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:125,size:1,type:'player',dnd5eSide:'player',color:'',emoji:''}]}
 if(withHazard)map.dnd5eItemAreas=[{id:'actual-caltrops',kind:'caltrops',sourceCharacterId:'first',sourceTokenId:'first-token',sourceItemTemplateId:'caltrops',sourceItemName:'Caltrops',cells:[{col:2,row:0}],createdAt:1,armed:true}]
 const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),economy=createDnd5eTurnEconomyCounts('combat:1:first-token'),moverEconomy=createDnd5eTurnEconomyCounts('combat:1:mover-token')
 const command:SharedPlayerActionState={id:'real-move-original',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'move-token',actorTokenId:'mover-token',characterId:'second',roomMemberId:'second-member',targetPosition:{x:175,y:25},round:1,initiativeIndex:1,seq:1,updatedAt:1}


 type Resource={_sync:{revision:number};[key:string]:unknown};const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},selectedId:'map',maps:[map]},combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:1,initiativeOrder},'player-action-requests':{_sync:{revision:1},requests:[]}}
 for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
 const commits:string[][]=[],gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,publishEvent:async(channel,payload)=>{const response=await http.event(channel,payload,data,'host');if(response.status!==200)throw Error('HTTP '+response.status+':'+JSON.stringify(response.payload))},saveResourcesAtomically:async(writes,options)=>{
 const response=await http.state('POST','transaction',{...options,writes},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200)
 for(const write of writes)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:response.payload.revisions?.[write.name]??((data[write.name]?._sync.revision??0)+1)}};data.combat=response.saved;if(response.queue)data['player-action-requests']=response.queue;if(response.commandReceipts)data['combat-command-receipts']=response.commandReceipts;commits.push(writes.map(write=>write.name));return {status:'committed',transactionId:options?.transactionId??'',revisions:response.payload.revisions??{}}
 }}
 const appended=await http.command(command.id,{schemaVersion:1,command:{schemaVersion:1,commandId:command.id,type:'move-token',mapId:'map',combatId:'combat',actorTokenId:'mover-token',characterId:'second',round:1,initiativeIndex:1,seq:1,expectedRevisions:{combat:1,maps:1},issuedAt:1,expectedPosition:{x:75,y:25},expectedElevationFeet:0,targetPosition:{x:175,y:25}}},data,'second-member');expect(appended.status,JSON.stringify(appended.payload)).toBe(202);data['player-action-requests']=appended.queue;data['combat-command-receipts']=appended.receipts
 const action=(appended.queue.requests as SharedPlayerActionState[]).find(row=>row.id===command.id);if(!action)throw Error('Actual appended moving PC required')
 const prepared=prepareDnd5eOpportunityPlayerMove({action,map,characters,initiativeOrder,moverEconomy,attackerEconomy:economy,attackerTokenId:'first-token'});if(!prepared.ok)throw Error(prepared.reason)
 let localProjection:ReturnType<Parameters<typeof createBountifulOpportunityMoveLocalAuthority>[0]['readProjection']>={map,characters,turnEconomyByToken:{'first-token':economy,'mover-token':moverEconomy,'helper-token':createDnd5eTurnEconomyCounts('combat:1:helper-token')}},geometryEpoch=1
 const local=createBountifulOpportunityMoveLocalAuthority({prepared:prepared.prepared,readProjection:()=>localProjection,readAnchors:()=>({geometryEpoch,charactersRevision:data.characters._sync.revision,mapsRevision:data.maps._sync.revision,round:data.combat.round,index:data.combat.initiativeIndex,combatId:data.combat.combatId})})
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
 const report={...request,delivery:'player-roll-result',values:[20],sourceMode:'player',eventId:'oa-original-result'}
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
 const mapText=fs.readFileSync('src/pages/MapsWorkspacePage.tsx','utf8'),rawStart=mapText.indexOf("    const original = tranquility.passed && typeof originalInput === 'function'"),rawEnd=mapText.indexOf('    const blessRoll =',rawStart)
 if(rawStart<0||rawEnd<0)throw Error('Actual Maps original OA raw block required')
 const dependencies={originalInput:(facts:{mode:string;choices:unknown})=>{expect(facts.mode).toBe('normal');expect(facts.choices).toEqual({tranquilitySave:undefined,areaAttackAdvantageReaction:undefined,disadvantageNegationChoice:undefined});return {requestId:rawRollId,boundary}},disadvantageNegationChoice:undefined,tranquility:{passed:true},effectiveAttackMode:'normal',attackRollContext:{rollKind:'attack',rollerTokenId:'first-token',rollerCharacterId:'first'},attack:prepared.prepared.opportunity,
  rollDiceBoxD20Pair:async(_label:string,_target:string,mode:string,context:{durableRollRequestId:string;bountifulNativeDiceRoute:ReturnType<typeof boundary.getDiceRoute>},after:(values:readonly number[],id:string)=>Promise<readonly [number,number|undefined]>)=>{
   expect(mode).toBe('normal');expect(context.durableRollRequestId).toBe(rawRollId)
   expect(readBountifulNativeDiceRoute(context.bountifulNativeDiceRoute,rawRollId,'first-token')).toMatchObject({characterId:'first',memberId:'first-member'})
   await emitOriginalRaw();return await after([20],rawRollId)??[20,undefined]
  }}
 const rawCode=ts.transpileModule(mapText.slice(rawStart,rawEnd)+';return [d20,d20Second];',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 expect(await new Function(...Object.keys(dependencies),'return (async()=>{'+rawCode+'})()')(...Object.values(dependencies))).toEqual([20,undefined])
 expect(boundary.hasCapturedOriginal()).toBe(false)
 expect(()=>boundary.readOriginal()).toThrow('original-not-confirmed')
 expect(commits.every(writes=>!writes.includes('characters')&&!writes.includes('maps'))).toBe(true)
 expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='mover-token')?.x).toBe(75)
 }finally{roomSession.value={roomId:'room',memberId:'host',role:'dm'};await http.close();dispose()}
})
