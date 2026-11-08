import {recordBountifulOriginalFall} from './bountifulLuckFallJournal'
import {createDnd5ePreparedDamageCommitSession,createDnd5eOriginalD20Session} from './damageCommitSession'
import {bountifulPreparedReplayFacts} from './bountifulLuckReceipt'
import {originalD20ReplaySourceKey} from './allyNaturalOneCheckpoint'
import {validateBountifulOriginalParents} from '../../../shared/bountiful-luck-state.mjs'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {applyDnd5eInventoryMutation} from './items'
import {it,expect,vi} from 'vitest'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from './spellAction'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {persistBountifulOriginalParent} from './bountifulLuckPersistentHost'
import {driveBountifulOriginalParent,BountifulOriginalParentPending} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId,nextBountifulOriginalDieOwner,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {resolveBountifulOriginalForNormalAck,publishBountifulOriginalThroughNormalAck} from './bountifulLuckNormalAck'
import {createDnd5eTurnEconomyCounts,spendDnd5eTurnResource} from './turnEconomy'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

it('persists a real post-save airborne fall choice without publishing HP or costs, then restores that exact native parent',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent)
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const make=(id:string,feat:boolean)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:'半身人',dnd5eRaceId:'halfling',charClass:'战士',level:4,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},currentHp:30,maxHp:30,classResources:{'dnd5e-spell-slot-1':{current:2,max:2},'dnd5e-spell-slot-2':{current:3,max:3}},dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster',false),race:'人类',dnd5eRaceId:'human',charClass:'牧师',equipment:{},dnd5eClassLevels:{cleric:4},abilities:{str:10,dex:14,con:14,int:10,wis:18,cha:10},dnd5eClassChoices:{classes:{cleric:{selections:{'spell-prepared':['hold-person']}}}}});
  const protector=normalizeCharacter({...make('first',true),charClass:'法师',dnd5eClassLevels:{wizard:4},dnd5eClassChoices:{classes:{wizard:{selections:{'spell-known':['feather-fall'],'spell-prepared':['feather-fall']}}}}});const characters=[applyDnd5eInventoryMutation([caster],{type:'grant',characterId:caster.id,templateId:'srd-5.1:item:component-pouch',quantity:1}).characters[0],make('ally',false),protector,make('second',true)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,index)=>({id:c.id+'-token',characterId:c.id,type:index===0?'enemy':'player',label:c.name,x:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'caster-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'ally-token',dnd5eSpellCast:{spellId:'hold-person',castingClassId:'cleric',slotLevel:2,targetTokenId:'ally-token'},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  if(!prepared.ok)throw Error(prepared.reason)
  const flyer=prepared.prepared.state.combatants['ally-token'];flyer.elevationFeet=30;flyer.groundElevationFeet=0;flyer.airborne=true;flyer.movementSpeeds={walk:30,fly:60};
  type Resource={_sync:{revision:number};[key:string]:unknown}
  let data:Record<string,Resource>={combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0},characters:{_sync:{revision:2},characters},maps:{_sync:{revision:3},maps:[map]},'player-action-requests':{_sync:{revision:4},requests:[action]}}
  data['player-action-ack']={_sync:{revision:0},id:''}
  data['player-action-processed']={_sync:{revision:0},actionIds:[]}
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]._sync.revision);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);const next=structuredClone(data);for(const write of batch)next[write.name]={...write.data as object,_sync:{revision:data[write.name]._sync.revision+1}};data=next;writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const source={prepared:prepared.prepared,savingThrowD20:1,effectRolls:[]}
  const probe=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eSpellCast,'ally-token','saving-throw');const probeResult=probe.run(source.prepared.state);expect(probeResult).toMatchObject({status:'pending-ally-natural-one',occurrence:0});probe.cancel()
  await persistBountifulOriginalParent({parentId:'parent',source,resolve:resolvePreparedDnd5eSpellCast,actorId:'ally-token',kind:'saving-throw'},gateway)
  const untouched=structuredClone(data.characters),sequence:string[]=[],rolls:string[]=[]
  const append=(receipt:BountifulOriginalDieReceipt,actorTokenId:string,characterId:string,memberId:string,command:object)=>{
   const rows=data['player-action-requests'].requests as object[]
   data['player-action-requests'].requests=[...rows,{id:'response-'+rows.length,roomMemberId:memberId,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:'map',combatId:'combat',actorTokenId,characterId,bountifulLuck:{parentId:'parent',occurrence:receipt.identity.occurrence,command}}]
  }
  // A closed or unanswered UI does not manufacture a decline or any cost.
  await expect(driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  expect(data.characters).toEqual(untouched)
  await driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{
   showChoice:async receipt=>{const next=nextBountifulOriginalDieOwner(receipt);if(!next)throw Error('No real owner');sequence.push(next.ownerId+':'+receipt.request.dieIndex);const control=receipt.controllers[next.ownerId];append(receipt,next.ownerId,control.characterId,control.memberId,{phase:'reaction',...next,decision:next.ownerId==='second-token'?'use':'decline'})},
   requestRoll:async(receipt,refresh)=>{rolls.push(receipt.identity.roller.tokenId+':'+receipt.request.dieIndex);const roller=receipt.identity.roller,id=bountifulOriginalDieRollId(receipt),value=2;append(receipt,roller.tokenId,requireCharacterRoller(roller),roller.memberId,{phase:'roll',rollRequestId:id,value});const fresh=await refresh();expect(fresh.rawReroll?.memberId).toBe('ally-member');append(fresh,roller.tokenId,requireCharacterRoller(roller),'host',{phase:'confirm',rollRequestId:id,rawValue:value,value})}
  })

  const receipts=()=>Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
  const replaySource=()=>({...source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:'parent',source,receipts:receipts()})})
  const forgedClock=replaySource();forgedClock.hostOriginalD20Replay.effectTimestamp=(forgedClock.hostOriginalD20Replay.effectTimestamp??0)+1
  forgedClock.hostOriginalD20Replay.sourceKey=originalD20ReplaySourceKey('parent',source.prepared.state,source.prepared.action,forgedClock.hostOriginalD20Replay.effectTimestamp)
  await expect(resolveBountifulOriginalForNormalAck({action,source:forgedClock,resolve:resolvePreparedDnd5eSpellCast,options:{combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[]}},gateway)).rejects.toThrow('changed-original-input')
  const attempt=createDnd5ePreparedDamageCommitSession(replaySource(),resolvePreparedDnd5eSpellCast,()=>false)
  const pending=attempt.run(source.prepared.state)
  expect(pending.status).toBe('pending-after-original-fall');if(pending.status!=='pending-after-original-fall')throw Error('Native spell did not produce an actual fall')
  const count=writes.length
  const input={action,source,resolve:resolvePreparedDnd5eSpellCast,occurrence:pending.occurrence,request:pending.request,choice:{featherFalls:[{casterId:'first-token',targetIds:['ally-token']}],rollsByCombatantId:{}},authorityUnchanged:()=>true}
  await expect(recordBountifulOriginalFall({...input,request:{...pending.request,actorId:'foreign'}},gateway)).rejects.toThrow('actual-checkpoint-required')
  await expect(recordBountifulOriginalFall({...input,choice:{featherFalls:[{casterId:'second-token',targetIds:['ally-token']}],rollsByCombatantId:{}}},gateway)).rejects.toThrow('actual-choice-rejected')
  expect(writes).toHaveLength(count)
  await recordBountifulOriginalFall(input,gateway)
  expect(writes).toHaveLength(count+1);expect(writes.at(-1)).toEqual(['combat'])
  expect(validateBountifulOriginalParents(data.combat.bountifulOriginalParents)).toBe(true)
  expect(data.characters).toEqual(untouched)
  await recordBountifulOriginalFall(input,gateway);expect(writes).toHaveLength(count+1)
  await expect(recordBountifulOriginalFall({...input,choice:{featherFalls:[],rollsByCombatantId:{'ally-token':[1,1,1]}}},gateway)).rejects.toThrow('already-confirmed')
  const restored=createDnd5ePreparedDamageCommitSession(replaySource(),resolvePreparedDnd5eSpellCast,()=>false)
  const final=restored.run(source.prepared.state)
  expect(final.status).toBe('resolved');if(final.status!=='resolved')throw Error('Durable real parent did not resume')
  expect(final.result.result.ok).toBe(true)
  expect(final.result.result.state.combatants['ally-token'].currentHp).toBe(30)
  expect(final.result.result.state.combatants['first-token'].turn.reactionAvailable).toBe(false)
  expect(final.result.result.state.combatants['second-token'].turn.reactionAvailable).toBe(false)
  expect(final.result.result.events.filter(event=>event.type==='spell-cast'&&event.spellId==='feather-fall')).toHaveLength(1)
  expect(data.characters).toEqual(untouched)
  const resolved=await resolveBountifulOriginalForNormalAck({action,source,resolve:resolvePreparedDnd5eSpellCast,options:{combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[],chooseAfterOriginalFall:async()=>{throw Error('Saved actual fall must not prompt again')}}},gateway)
  expect(resolved.result.ok).toBe(true);if(!resolved.application)throw Error('Missing actual final application')
  const normalActorEconomy=spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('combat:1:caster-token',30),'action').economy
  const actualFeatherReaction=spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('combat:1:first-token',30),'reaction').economy
  const ackInput:PublishPlayerActionAckInput={
   ack:{id:'ack:parent',actionId:'parent',mapId:'map',combatId:'combat',recipientMemberId:'caster-member',status:'accepted',round:1,initiativeIndex:0,updatedAt:2},
   snapshots:{characters:resolved.application.characters,maps:[resolved.application.map],updatedAt:2,combat:{mapId:'map',combatId:'combat',active:true,round:1,initiativeIndex:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),updatedAt:2,dnd5eTurnEconomyByToken:{'caster-token':normalActorEconomy,'first-token':actualFeatherReaction}}},
   processed:{mapId:'map',combatId:'combat',actionIds:['parent'],updatedAt:2},expectedRevisions:{'player-action-ack':0,'player-action-processed':0},
   saveSharedResource:async()=>{throw Error('No independent resource write permitted')},
   commitSharedResources:async(batch,options)=>{await gateway.saveResourcesAtomically(batch,options);return{}},
   loadSharedResource:gateway.loadResource,publishAck:async()=>{},
  }
  await publishBountifulOriginalThroughNormalAck(action,ackInput,gateway)
  expect(writes.filter(names=>names.includes('characters'))).toEqual([['characters','maps','combat','player-action-processed','player-action-ack']])
  const economies=data.combat.dnd5eTurnEconomyByToken as Record<string,{reaction:{current:number}}>
  expect(economies['first-token'].reaction.current).toBe(0)
  expect(economies['second-token'].reaction.current).toBe(0)
  expect((data.characters.characters as typeof characters).find(c=>c.id==='first')?.classResources?.['dnd5e-spell-slot-1'].current).toBe(1)
  expect((data.characters.characters as typeof characters).find(c=>c.id==='caster')?.classResources?.['dnd5e-spell-slot-2'].current).toBe(2)
  await publishBountifulOriginalThroughNormalAck(structuredClone(action),ackInput,gateway)
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(1)
 }finally{dispose()}
})

function requireCharacterRoller(roller:{characterId?:string}){if(!roller.characterId)throw Error("This Character-only fixture requires its actual Character roller");return roller.characterId}
