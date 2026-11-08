import {bountifulReadyHttpFixture} from './bountifulLuck.ready-authority.testSupport'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {dnd5eHalflingLuckySuppressed,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {dnd5eSpellAuthorityResolutionContext} from '../../pages/maps/spellSettlementCoordinator'
import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {durableD20RollId} from '../../lib/rollConfirmation'
import {resolveDnd5eAbilityCheckInterrupts} from '../../pages/maps/dnd5eRollInterruptPipeline'
import {buildPlayerActionAck} from '../../lib/playerActionAck'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {it,expect,vi} from 'vitest'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eAbilityCheck,resolvePreparedDnd5eAbilityCheck,previewPreparedDnd5eAbilityCheck} from './abilityCheckAction'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {persistBountifulOriginalParent} from './bountifulLuckPersistentHost'
import {driveBountifulOriginalParent,BountifulOriginalParentPending,readBountifulOriginalAbilityInput} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId,nextBountifulOriginalDieOwner,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {recordBountifulOriginalAfterDice,resolveBountifulOriginalForNormalAck,publishBountifulOriginalThroughNormalAck} from './bountifulLuckNormalAck'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

it('uses real exploration authority for a natural-one ordinary skill, preserves reaction cost and Lucky suppression through the next real own turn',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent)
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const make=(id:string,feat:boolean)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:'半身人',dnd5eRaceId:'halfling',charClass:'战士',level:4,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},currentHp:30,maxHp:30,dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const ally=make('ally',false);ally.equipment={};ally.dnd5eCombatState={bardicInspirationDie:6,bardicInspirationSourceId:'first-token',bardicInspirationRoundsRemaining:10};
  const characters=[ally,make('first',true),make('second',true)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,index)=>({id:c.id+'-token',characterId:c.id,type:'player',label:c.name,x:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',sourceMode:'player',status:'pending',roomMemberId:'ally-member',type:'dnd5e-ability-check',actorTokenId:'ally-token',characterId:'ally',dnd5eAbilityCheck:{ability:'dex',skill:'stealth',dc:12,spendAction:true},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const authority=dnd5eSpellAuthorityResolutionContext({combatActive:false,map,actorTokenId:action.actorTokenId,initiativeOrder:[]})
  expect(authority.exploration).toBe(true)
  const prepared=prepareDnd5eAbilityCheck({action,map,characters,initiativeOrder:authority.initiativeOrder,turnEconomy:authority.turnEconomy})
  if(!prepared.ok)throw Error(prepared.reason)
  type Resource={_sync:{revision:number};[key:string]:unknown}
  let data:Record<string,Resource>={combat:{_sync:{revision:1},active:false,mapId:'old-map',combatId:'old-combat',round:9,initiativeIndex:0},characters:{_sync:{revision:2},characters},maps:{_sync:{revision:3},maps:[map]},'player-action-requests':{_sync:{revision:4},requests:[action]}}
  data['player-action-ack']={_sync:{revision:0},id:''}
  data['player-action-processed']={_sync:{revision:0},actionIds:[]}
  for(const resource of Object.values(data))Object.assign(resource._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]._sync.revision);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);const next=structuredClone(data);for(const write of batch)next[write.name]={...write.data as object,_sync:{...data[write.name]._sync,revision:data[write.name]._sync.revision+1}};data=next;writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const source={prepared:prepared.prepared,d20:1,...captureBountifulOriginalRawIssuer({mapId:map.id,parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:map.id,sourceMode:'dm',transactionId:action.id,occurrenceIndex:2}),cursor:3,raw:[1]})}
  const beforeMint=structuredClone(data)
  const actualReceipt=await persistBountifulOriginalParent({parentId:'parent',source,resolve:resolvePreparedDnd5eAbilityCheck,actorId:'ally-token',kind:'ability-check'},gateway)
  const http=await bountifulReadyHttpFixture()
  try{
   const receiptId=JSON.stringify(['bountiful-original-parent',action.id,0])
   expect(actualReceipt.identity.sceneScope).toBeDefined()
   const denied=await http.state('PUT','combat',data.combat,beforeMint,'host');expect(denied.status,JSON.stringify(denied.payload)).toBe(409)
   const request={mapId:map.id,combatId:'old-combat',requestId:source.hostOriginalRollId,rollerTokenId:action.actorTokenId,targetCharacterId:action.characterId,kind:'d20',count:1,sides:20,values:[],rollKind:'ability-check',delivery:'player-roll-request',sourceMode:'dm',eventId:'scene-original',updatedAt:1}
   expect((await http.event('bountiful-original-mint-dm-to-host',{id:receiptId,receipt:actualReceipt},beforeMint,'host')).status).toBe(403)
   expect((await http.event('dice-roll-request-dm-to-player',request,beforeMint,'host')).status).toBe(200)
   const raw={...request,delivery:'player-roll-result',sourceMode:'player',values:[1],eventId:'scene-result'}
   expect((await http.event('dice-roll-request-player-to-dm',raw,beforeMint,'first-member')).status).toBe(403)
   expect((await http.event('dice-roll-request-player-to-dm',raw,beforeMint,'host')).status).toBe(403)
   expect((await http.event('dice-roll-request-player-to-dm',raw,beforeMint,'ally-member')).status).toBe(200)
   const laterClock=structuredClone(beforeMint);laterClock['campaign-time']={_sync:{revision:1},worldMinute:481}
   expect((await http.event('bountiful-original-mint-dm-to-host',{id:receiptId,receipt:actualReceipt},laterClock,'host')).status).toBe(403)
   await http.state('GET','combat',null,{...beforeMint,'campaign-time':null},'host')
   expect((await http.event('bountiful-original-mint-dm-to-host',{id:receiptId,receipt:actualReceipt},beforeMint,'host')).status).toBe(200)
   expect((await http.state('PUT','combat',data.combat,laterClock,'host')).status).toBe(409)
   await http.state('GET','combat',null,{...beforeMint,'campaign-time':null},'host')
   const changedBoundary=structuredClone(beforeMint);changedBoundary.combat={...changedBoundary.combat,round:10}
   expect((await http.state('PUT','combat',data.combat,changedBoundary,'host')).status).toBe(409)
   expect((await http.event('bountiful-original-mint-dm-to-host',{id:receiptId,receipt:actualReceipt},changedBoundary,'host')).status).toBe(403)
   expect((await http.state('PUT','combat',data.combat,beforeMint,'host')).status).toBe(200)
  }finally{await http.close()}

  const untouched=structuredClone(data.characters),sequence:string[]=[],rolls:string[]=[]
  const append=(receipt:BountifulOriginalDieReceipt,actorTokenId:string,characterId:string,memberId:string,command:object)=>{
   const rows=data['player-action-requests'].requests as object[]
   data['player-action-requests'].requests=[...rows,{id:'response-'+rows.length,roomMemberId:memberId,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:'map',combatId:receipt.identity.combatId,actorTokenId,characterId,bountifulLuck:{parentId:'parent',occurrence:receipt.identity.occurrence,command}}]
  }
  // A closed or unanswered UI does not manufacture a decline or any cost.
  await expect(driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  expect(data.characters).toEqual(untouched)
  const stage=await driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{
   showChoice:async receipt=>{const next=nextBountifulOriginalDieOwner(receipt);if(!next)throw Error('No real owner');sequence.push(next.ownerId+':'+receipt.request.dieIndex);const control=receipt.controllers[next.ownerId];append(receipt,next.ownerId,control.characterId,control.memberId,{phase:'reaction',...next,decision:next.ownerId==='second-token'?'use':'decline'})},
   requestRoll:async(receipt,refresh)=>{rolls.push(receipt.identity.roller.tokenId+':'+receipt.request.dieIndex);const roller=receipt.identity.roller,id=bountifulOriginalDieRollId(receipt),value=5;if(!roller.characterId)throw Error('Expected the actual ally Character');append(receipt,roller.tokenId,roller.characterId,roller.memberId,{phase:'roll',rollRequestId:id,value});const fresh=await refresh();expect(fresh.rawReroll?.memberId).toBe('ally-member');append(fresh,roller.tokenId,roller.characterId,'host',{phase:'confirm',rollRequestId:id,rawValue:value,value})}
  })
  expect(sequence).toEqual(['first-token:0','second-token:0'])
  expect(rolls).toEqual(['ally-token:0'])
  expect(stage.request).toMatchObject({originalRolls:[1],values:[5]})
  expect(stage.receipts).toHaveLength(1)
  expect(data.characters).toEqual(untouched)
  expect(writes.every(names=>names.length<3)).toBe(true)

  const finalSource={...source,bardicInspirationRoll:6}
  const late={action,source:finalSource,resolve:resolvePreparedDnd5eAbilityCheck,authorityUnchanged:()=>true,rollCursor:9}
  const beforeOptional=writes.length
  await expect(recordBountifulOriginalAfterDice({...late,source:{...source,strokeOfLuck:true}},gateway)).rejects.toThrow('real-continuation-rejected')
  expect(writes).toHaveLength(beforeOptional)
  await recordBountifulOriginalAfterDice(late,gateway)
  const restored=await readBountifulOriginalAbilityInput({mapId:'map',parentId:'parent'},gateway)
  if(!restored)throw Error('Private saved ability missing')
  expect(restored.hostOriginalDiceCursor).toBe(3);expect(restored.hostBountifulRollCursor).toBe(9)
  expect(restored.hostBountifulPostDiceComplete).toBe(true)
  expect(restored.bardicInspirationRoll).toBe(6);expect(restored.d20).toBe(1)
  let repeatedPrompts=0
  const noPrompt=async()=>{repeatedPrompts++;throw Error('A completed private choice must not be requested again')}
  const interrupted=await resolveDnd5eAbilityCheckInterrupts({
   combatant:restored.prepared.state.combatants['ally-token'],target:ally,targetName:ally.name,dc:12,mode:'normal',label:'Stealth',
   confirmedChoices:{bardicInspirationRoll:restored.bardicInspirationRoll,optionalBonusDieUse:restored.optionalBonusDice?.[0],additionalBonusDieRoll:restored.peerlessSkillRoll,darkOnesOwnLuckRoll:restored.darkOnesOwnLuckRoll},
   resolveOriginalDice:async()=>{const saved=await driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{showChoice:noPrompt,requestRoll:noPrompt});return saved.request.values},
   previewTotal:(a,b)=>previewPreparedDnd5eAbilityCheck(restored.prepared,a,b)?.total,
   rollD20Pair:async()=>[restored.d20,restored.d20Second],rollD20:noPrompt,
   requestBardicInspiration:noPrompt,requestOptionalBonusDie:noPrompt,requestAdditionalBonusDie:noPrompt,requestDarkOnesOwnLuck:noPrompt,
  })
  expect(interrupted).toMatchObject({d20:1,effectiveD20:5,bardicInspirationRoll:6,baseTotal:7,total:13})
  expect(repeatedPrompts).toBe(0)
  await expect(recordBountifulOriginalAfterDice({...late,source:{...finalSource,bardicInspirationRoll:5}},gateway)).rejects.toThrow('already-confirmed')
  const resolved=await resolveBountifulOriginalForNormalAck({action,source:finalSource,resolve:resolvePreparedDnd5eAbilityCheck,options:{combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[]}},gateway)
  expect(resolved.result.ok).toBe(true)
  if(!resolved.application)throw Error('Real application missing')
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  const notifications:string[]=[]
  const ackInput:PublishPlayerActionAckInput={
   ack:{id:'ack:parent',actionId:'parent',mapId:'map',recipientMemberId:'ally-member',status:'accepted',round:1,initiativeIndex:0,updatedAt:2},
   snapshots:{characters:resolved.application.characters,maps:[resolved.application.map],updatedAt:2,combat:{mapId:'old-map',combatId:'old-combat',active:false,round:9,initiativeIndex:0,initiativeOrder:[],updatedAt:2}},
   processed:{mapId:'map',combatId:'combat',actionIds:['parent'],updatedAt:2},expectedRevisions:{'player-action-ack':0,'player-action-processed':0},
   saveSharedResource:async()=>{throw Error('No independent resource write permitted')},
   commitSharedResources:async(batch,options)=>{await gateway.saveResourcesAtomically(batch,options);return{}},
   loadSharedResource:gateway.loadResource,publishAck:async ack=>{notifications.push(ack.id)},
  }
  // Equal IDs and generic success cannot manufacture the live private brand.
  await expect(publishBountifulOriginalThroughNormalAck(structuredClone(action),ackInput,gateway)).rejects.toThrow('issued-result-required')
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  data['map-geometry']={_sync:{revision:1}}
  await expect(publishBountifulOriginalThroughNormalAck(action,ackInput,gateway)).rejects.toThrow('stale-original-resources')
  delete data['map-geometry']
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  await publishBountifulOriginalThroughNormalAck(action,ackInput,gateway)
  const finalWrites=writes.filter(names=>names.includes('characters'))
  expect(finalWrites).toEqual([['characters','maps','combat','player-action-processed','player-action-ack']])
  expect(data.combat.dnd5eTurnEconomyByToken).toEqual({})
  expect(data.combat).toMatchObject({active:false,mapId:'old-map',combatId:'old-combat',round:9,initiativeIndex:0})
  const savedOwner=(data.characters.characters as typeof characters).find(character=>character.id==='second')
  expect(savedOwner?.dnd5eCombatState?.sceneReactionSpent).toMatchObject({roomId:'room',parentTransactionId:'parent'})
  const sceneCharacters=data.characters.characters as typeof characters
  const snapshot=(mapId:string,combatId:string)=>createDnd5eMapCombatSnapshot({map:{...map,id:mapId},characters:sceneCharacters,combatId,round:1,initiativeOrder:authority.initiativeOrder}).state
  for(const mapId of ['map','new-map']){
   const state=snapshot(mapId,'map-'+mapId),owner=state.combatants['second-token']
   expect(owner.turn.reactionAvailable).toBe(false);expect(dnd5eHalflingLuckySuppressed(owner)).toBe(true)
  }
  const real=snapshot('map','real-next-combat')
  const afterAlly=resolveDnd5eHeadlessAction(real,{type:'end-turn',actorId:'ally-token'});expect(afterAlly.ok).toBe(true)
  expect(afterAlly.state.combatants['second-token'].turn.reactionAvailable).toBe(false)
  const afterFirst=resolveDnd5eHeadlessAction(afterAlly.state,{type:'end-turn',actorId:'first-token'});expect(afterFirst.ok).toBe(true)
  expect(afterFirst.state.combatants['second-token'].turn.reactionAvailable).toBe(true)
  expect(dnd5eHalflingLuckySuppressed(afterFirst.state.combatants['second-token'])).toBe(true)
  const afterOwn=resolveDnd5eHeadlessAction(afterFirst.state,{type:'end-turn',actorId:'second-token'});expect(afterOwn.ok).toBe(true)
  expect(dnd5eHalflingLuckySuppressed(afterOwn.state.combatants['second-token'])).toBe(false)

  const parents=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)
  expect(parents).toHaveLength(1);expect(parents.every(row=>row.consumed?.transactionId==='parent')).toBe(true)
  expect((data['player-action-processed'].actionIds as string[])).toEqual(['parent'])
  expect(data['player-action-ack'].actionId).toBe('parent')
  expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',actorId:'ally-token',d20:5,total:13,success:true}))
  expect((data.characters.characters as typeof characters).find(c=>c.id==='ally')?.dnd5eCombatState?.bardicInspirationDie).toBeUndefined()
  // A repeated/reloaded ACK observes the durable consumed parent; no extra CAS.
  const rebuilt=buildPlayerActionAck({action,status:'accepted',mapId:action.mapId,combatId:action.combatId,round:1,initiativeIndex:0,appliedAt:3})
  expect(rebuilt.id).not.toBe(ackInput.ack.id)
  await publishBountifulOriginalThroughNormalAck(structuredClone(action),{...ackInput,ack:rebuilt},gateway)
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(1)
  expect(notifications).toEqual(['ack:parent','ack:parent'])
 }finally{dispose()}
})
