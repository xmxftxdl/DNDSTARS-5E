import {runMapsPlayerActionTransaction} from '../../../src/pages/maps/runMapsPlayerActionTransaction'
import {DmActionTransactionCoordinator} from '../../../src/lib/dmActionTransactionCoordinator'
import {BountifulOriginalParentPending} from './bountifulLuckPersistentRoomDriver'
import {BountifulOriginalParentPublished} from './bountifulLuckMapsSettlement'
import {publishBountifulOriginalParent,readConsumedBountifulParent} from './bountifulLuckParentPublish'
import {driveBountifulOriginalParent} from './bountifulLuckPersistentRoomDriver'
import {resumeBountifulOriginalParent} from './bountifulLuckPersistedReplay'
import {bountifulOriginalDieRollId,decisionFromBountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {resolveDnd5ePreparedWithDamageReactions} from '../../../src/rulesets/dnd5e/damageReactionFlow'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {it,expect,vi} from 'vitest'
import {prepareDnd5eLocalContentJson} from '../../../src/rulesets/dnd5e/localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from '../../../src/rulesets/dnd5e/contentPackageV2'
import {registerDnd5eRulesPlugin} from '../../../src/rulesets/dnd5e/pluginApi'
import {normalizeCharacter} from '../../../src/store/characters'
import {prepareDnd5eAbilityCheck,resolvePreparedDnd5eAbilityCheck} from '../../../src/rulesets/dnd5e/abilityCheckAction'
import type {BattleMap} from '../../../src/store/maps'
import type {SharedPlayerActionState} from '../../../src/lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../../src/ports/sharedRoomGateway'
import {persistBountifulOriginalParent,processBountifulOriginalResponse} from './bountifulLuckPersistentHost'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {bountifulOriginalDiePhase} from './bountifulLuckReceipt'
const session=vi.hoisted(()=>({value:{roomId:'room',memberId:'host',role:'dm'}}))
vi.mock('../../../src/lib/roomSession',()=>({getRoomSession:()=>session.value}))

it('the real prepared skill parent issues durable original dice before any HP, reaction, or Lucky state is published',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent)
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const make=(id:string,feat:boolean)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:feat?'半身人':'人类',dnd5eRaceId:feat?'halfling':'human',charClass:'战士',level:4,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},maxHp:30,currentHp:30,dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const ally=make('ally',false),owner=make('owner',true),characters=[ally,owner]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((char,index)=>({id:char.id+'-token',characterId:char.id,type:'player' as const,label:char.name,x:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'ally-member',type:'dnd5e-ability-check',actorTokenId:'ally-token',characterId:'ally',dnd5eAbilityCheck:{ability:'dex',skill:'stealth',dc:12},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eAbilityCheck({action,map,characters,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error('prepare failed')
  type Resource={_sync:{revision:number};[key:string]:unknown}
  let data:Record<string,Resource>={combat:{_sync:{revision:1},mapId:'map',combatId:'combat',active:true,round:1,initiativeIndex:0},maps:{_sync:{revision:2},maps:[map]},characters:{_sync:{revision:3},characters},'player-action-requests':{_sync:{revision:4},requests:[action]}}
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(writes,options)=>{
   for(const write of writes)expect(write.expectedRevision).toBe(data[write.name]._sync.revision)
   for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value)
   const next=structuredClone(data);for(const write of writes)next[write.name]={...(write.data as object),_sync:{revision:data[write.name]._sync.revision+1}};data=next
   return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}
  }}
  const source={prepared:prepared.prepared,d20:1},before=structuredClone(data.characters)
  data.combat.dnd5eTurnEconomyByToken={'owner-token':{turnKey:'combat:1:owner-token',reaction:{current:0}}}
  await expect(persistBountifulOriginalParent({parentId:'parent',source,resolve:resolvePreparedDnd5eAbilityCheck,actorId:'ally-token',kind:'ability-check'},gateway)).rejects.toThrow('actual-original-checkpoint-required')
  data.combat.dnd5eTurnEconomyByToken={'owner-token':{turnKey:'combat:1:owner-token',reaction:{current:1}}}
  const receipt=await persistBountifulOriginalParent({parentId:'parent',source,resolve:resolvePreparedDnd5eAbilityCheck,actorId:'ally-token',kind:'ability-check'},gateway)
  expect(receipt.request).toMatchObject({actorId:'ally-token',originalRolls:[1,1],kind:'ability-check',skill:'stealth'})
  expect(data.characters).toEqual(before);expect(bountifulOriginalDiePhase(receipt)).toBe('owner-choice')
  expect(await persistBountifulOriginalParent({parentId:'parent',source,resolve:resolvePreparedDnd5eAbilityCheck,actorId:'ally-token',kind:'ability-check'},gateway)).toEqual(receipt)
  const commands=[{id:'forged',roomMemberId:'ally-member'},{id:'owned',roomMemberId:'owner-member'}].map(row=>({...row,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:'map',combatId:'combat',actorTokenId:'owner-token',characterId:'owner',bountifulLuck:{parentId:'parent',occurrence:0,command:{phase:'reaction',ownerId:'owner-token',featureId:receipt.request.options[0].featureId,decision:'use'}}}))
  data['player-action-requests'].requests=[action,...commands]
  await expect(processBountifulOriginalResponse({mapId:'map',requestId:'forged'},gateway)).rejects.toThrow('owner-choice-not-authorized')
  const owned=await processBountifulOriginalResponse({mapId:'map',requestId:'owned'},gateway)
  expect(bountifulOriginalDiePhase(owned)).toBe('roller');expect(data.characters).toEqual(before)
  const persisted=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)[0]
  expect(persisted.request.originalRolls).toEqual([1,1]);expect(persisted.ownerDecisions[0].memberId).toBe('owner-member')
  const resume=(receipts:readonly BountifulOriginalDieReceipt[])=>resumeBountifulOriginalParent({source,resolve:resolvePreparedDnd5eAbilityCheck,parentId:'parent',actorId:'ally-token',kind:'ability-check',receipts})
  expect(resume([JSON.parse(JSON.stringify(persisted))])).toMatchObject({status:'pending-decision'})
  expect(()=>resumeBountifulOriginalParent({source:{...source,d20:2},resolve:resolvePreparedDnd5eAbilityCheck,parentId:'parent',actorId:'ally-token',kind:'ability-check',receipts:[persisted]})).toThrow('changed-original-input')
  const rollRequestId=bountifulOriginalDieRollId(persisted)
  const rollRows=[{id:'raw',roomMemberId:'ally-member',sourceMode:'player',command:{phase:'roll',rollRequestId,value:1}},{id:'host-confirm',roomMemberId:'host',sourceMode:'player',command:{phase:'confirm',rollRequestId,rawValue:1,value:1}}].map(row=>({...row,type:'dnd5e-bountiful-luck',status:'pending',mapId:'map',combatId:'combat',actorTokenId:'ally-token',characterId:'ally',bountifulLuck:{parentId:'parent',occurrence:0,command:row.command}}))
  data['player-action-requests'].requests=[...data['player-action-requests'].requests as object[],...rollRows]
  await processBountifulOriginalResponse({mapId:'map',requestId:'raw'},gateway)
  const confirmed=await processBountifulOriginalResponse({mapId:'map',requestId:'host-confirm'},gateway)
  const ready=resume([JSON.parse(JSON.stringify(confirmed))])
  expect(ready.status).toBe('original-d20-ready')
  if(ready.status!=='original-d20-ready')throw Error('raw stage not ready')
  expect(ready.request).toMatchObject({originalRolls:[1,1],values:[1,1]})
  expect(ready.events.some(event=>event.type==='ability-check-resolved')).toBe(false)
  expect(data.characters).toEqual(before)
  const final=await resolveDnd5ePreparedWithDamageReactions({combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[],chooseAllyNaturalOne:async selection=>decisionFromBountifulOriginalDieReceipt(confirmed,selection.request)},source,resolvePreparedDnd5eAbilityCheck)
  expect(final.result.ok).toBe(true)
  expect(final.result.events.filter(event=>event.type==='turn-resource-spent'&&event.resource==='reaction')).toHaveLength(1)
  expect(final.application?.spentReactions).toEqual({round:1,tokenIds:['owner-token']})
  expect(final.result.state.combatants['owner-token'].turn.reactionAvailable).toBe(false)
  const restoredReady=await driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{showChoice:async()=>{throw Error('already selected')},requestRoll:async()=>{throw Error('already rolled and confirmed')}})
  expect(restoredReady.request).toMatchObject({originalRolls:[1,1],values:[1,1]})
  expect(restoredReady.receipts).toHaveLength(1)
  expect(restoredReady.source.prepared.state.combatants['owner-token'].turn.reactionAvailable).toBe(true)
  data.combat.round=2
  await expect(driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toThrow('stale-original-parent')
  data.combat.round=1


  const oldCommit=vi.fn(async()=>{throw Error('old snapshot must not publish')}),recover=vi.fn(async()=>{}),onPublished=vi.fn(async()=>{})
  await runMapsPlayerActionTransaction({coordinator:new DmActionTransactionCoordinator(),action,run:async()=>{throw new BountifulOriginalParentPending(action.id,0)},waitForAuthorityCommit:oldCommit,readOutcome:()=>undefined,clearOutcome:()=>{},setTransactionActive:()=>{},recover,bountifulSettlement:{gateway,onPublished}})
  expect(oldCommit).not.toHaveBeenCalled();expect(recover).not.toHaveBeenCalled();expect(onPublished).not.toHaveBeenCalled()
  const published=await publishBountifulOriginalParent({mapId:'map',parentId:'parent',source,resolve:resolvePreparedDnd5eAbilityCheck,options:{combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[]}},gateway)
  expect(published.result.ok).toBe(true)
  expect(data.combat.dnd5eTurnEconomyByToken).toMatchObject({'owner-token':{reaction:{current:0}}})
  const afterPublication=structuredClone(data)
  expect(await readConsumedBountifulParent({mapId:'map',parentId:'parent'},gateway)).toEqual(published)
  expect(await publishBountifulOriginalParent({mapId:'map',parentId:'parent',source,resolve:resolvePreparedDnd5eAbilityCheck,options:{combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[]}},gateway)).toEqual(published)
  expect(data).toEqual(afterPublication)
  await runMapsPlayerActionTransaction({coordinator:new DmActionTransactionCoordinator(),action,run:async()=>{throw new BountifulOriginalParentPublished(action.id,action.mapId)},waitForAuthorityCommit:oldCommit,readOutcome:()=>undefined,clearOutcome:()=>{},setTransactionActive:()=>{},recover,bountifulSettlement:{gateway,onPublished}})
  expect(onPublished).toHaveBeenCalledOnce();expect(oldCommit).not.toHaveBeenCalled();expect(recover).not.toHaveBeenCalled();expect(data).toEqual(afterPublication)


  expect(data.characters.characters).toEqual(published.application?.characters)
  expect(published.application?.characters.find(row=>row.id==='owner')?.dnd5eCombatState?.activeEffects?.some(effect=>effect.tags?.includes('bountiful-luck:racial-lucky-suppressed'))).toBe(true)
  expect(published.application?.characters.find(row=>row.id==='owner')?.currentHp).toBe(owner.currentHp)

 }finally{dispose()}
})
