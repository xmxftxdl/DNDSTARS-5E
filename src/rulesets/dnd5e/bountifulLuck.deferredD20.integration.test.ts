import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {commitD20ChoiceReroll} from '../../pages/maps/commitD20ChoiceReroll'
import {createD20ChoiceRerollContribution,createD20RollConfirmationInterrupt,durableD20RollId} from '../../lib/rollConfirmation'
import {dnd5eCoreInspirationChoiceRerollOption} from '../../lib/d20InterruptPolicy'
import {beginBountifulEquipmentOriginal} from './bountifulLuckEquipmentOriginal'
import {recordBountifulOriginalAfterDice} from './bountifulLuckNormalAck'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {it,expect,vi} from 'vitest'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eEquipmentAttack,resolvePreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import {DND5E_SHORTBOW} from './equipment'
import {applyDnd5eInventoryMutation} from './items'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {driveBountifulOriginalParent,BountifulOriginalParentPending} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId,nextBountifulOriginalDieOwner,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {resolveBountifulOriginalForNormalAck,publishBountifulOriginalThroughNormalAck} from './bountifulLuckNormalAck'
import {createDnd5eTurnEconomyCounts,spendDnd5eTurnResource} from './turnEconomy'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

it.each([17,1])('real BL decline → authenticated Inspiration adopts %i once and consumes its cost and arrow only in the original ACK',async replacement=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent)
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const make=(id:string,feat:boolean)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:'半身人',dnd5eRaceId:'halfling',charClass:'战士',level:4,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},currentHp:30,maxHp:30,dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const actor=make('ally',false);actor.race='人类';actor.dnd5eRaceId='human';actor.inspiration=1;actor.dnd5eCombatState={bardicInspirationDie:6,bardicInspirationSourceId:'first-token',bardicInspirationRoundsRemaining:10};actor.equipment={mainWeapon:DND5E_SHORTBOW};
  const characters=[applyDnd5eInventoryMutation([actor],{type:'grant',characterId:actor.id,templateId:'srd-5.1:item:arrows',quantity:20}).characters[0],make('first',true),make('second',true),make('target',false)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,index)=>({id:c.id+'-token',characterId:c.id,type:index===3?'enemy':'player',label:c.name,x:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'ally-member',type:'dnd5e-weapon-attack',actorTokenId:'ally-token',characterId:'ally',targetTokenId:'target-token',round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eEquipmentAttack({action,map,characters,attacksUsed:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  if(!prepared.ok)throw Error(prepared.reason)
  type Resource={_sync:{revision:number};[key:string]:unknown}
  let data:Record<string,Resource>={combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0},characters:{_sync:{revision:2},characters},maps:{_sync:{revision:3},maps:[map]},'player-action-requests':{_sync:{revision:4},requests:[action]}}
  data['player-action-ack']={_sync:{revision:0},id:''}
  data['player-action-processed']={_sync:{revision:0},actionIds:[]}
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]._sync.revision);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);const next=structuredClone(data);for(const write of batch)next[write.name]={...write.data as object,_sync:{revision:data[write.name]._sync.revision+1}};data=next;writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const rawRollId=durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:'parent',occurrenceIndex:0})+':pool:1d20'
  const source={prepared:prepared.prepared,d20:1,damageRolls:[] as number[],...captureBountifulOriginalRawIssuer({mapId:'map',parentId:'parent',mode:'dm',rollId:rawRollId,cursor:1,raw:[1]})}
  await expect(beginBountifulEquipmentOriginal({action,source},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  const untouched=structuredClone(data.characters),sequence:string[]=[],rolls:string[]=[]
  const append=(receipt:BountifulOriginalDieReceipt,actorTokenId:string,characterId:string,memberId:string,command:object)=>{
   const rows=data['player-action-requests'].requests as object[]
   data['player-action-requests'].requests=[...rows,{id:'response-'+rows.length,roomMemberId:memberId,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:'map',combatId:'combat',actorTokenId,characterId,bountifulLuck:{parentId:'parent',occurrence:receipt.identity.occurrence,command}}]
  }
  // A closed or unanswered UI does not manufacture a decline or any cost.
  await expect(driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  expect(data.characters).toEqual(untouched)
  const stage=await beginBountifulEquipmentOriginal({action,source},gateway,{
   showChoice:async receipt=>{const next=nextBountifulOriginalDieOwner(receipt);if(!next)throw Error('No real owner');sequence.push(next.ownerId+':'+receipt.request.dieIndex);const control=receipt.controllers[next.ownerId];append(receipt,next.ownerId,control.characterId,control.memberId,{phase:'reaction',...next,decision:'decline'})},
   requestRoll:async(receipt,refresh)=>{rolls.push(receipt.identity.roller.tokenId+':'+receipt.request.dieIndex);const roller=receipt.identity.roller,id=bountifulOriginalDieRollId(receipt),value=12;append(receipt,roller.tokenId,requireCharacterRoller(roller),roller.memberId,{phase:'roll',rollRequestId:id,value});const fresh=await refresh();expect(fresh.rawReroll?.memberId).toBe('ally-member');append(fresh,roller.tokenId,requireCharacterRoller(roller),'host',{phase:'confirm',rollRequestId:id,rawValue:value,value})}
  })
  if(!stage)throw Error('Real equipment raw did not issue its private parent')
  expect(stage.rawDice).toEqual([1]);expect(stage.retainedDice).toEqual([1])
  expect(stage.originalSource).not.toBe(source)
  expect(stage.originalSource.prepared).not.toBe(source.prepared)
  expect(stage.originalSource.prepared.state).not.toBe(stage.previewState)
  const originalSnapshot=JSON.stringify(stage.originalSource)
  stage.previewState.combatants['target-token'].currentHp=1
  expect(JSON.stringify(stage.originalSource)).toBe(originalSnapshot)
  expect(source.prepared.state.combatants['target-token'].currentHp).toBe(30)
  expect(sequence).toEqual(['first-token:0','second-token:0'])
  expect(rolls).toEqual([])
  expect(stage.rawDice).toEqual([1]);expect(stage.retainedDice).toEqual([1])
  expect(stage.receipts).toHaveLength(1)
  expect(data.characters).toEqual(untouched)
  expect(writes.every(names=>names.length<3)).toBe(true)


  const option=dnd5eCoreInspirationChoiceRerollOption(characters[0],'ally-token','normal')
  if(!option)throw Error('Real core Inspiration option missing')
  const prompt=createD20RollConfirmationInterrupt({mapId:'map',combatId:'combat',rollId:rawRollId+':0',label:'Normal post-original reroll',originalValue:1,rollerCharacterId:'ally',eligibleModifiers:[option]})
  const contribution=createD20ChoiceRerollContribution({interruptId:prompt.id,characterId:'ally',characterName:characters[0].name,featureId:option.featureId,featureLabel:option.featureLabel,decision:'use'})
  prompt.contributions=[contribution];prompt.payload.rollOptions={contributionId:contribution.id,values:[1,replacement]}
  data['combat-interrupts']={_sync:{revision:1},mapId:'map',interrupts:[prompt],updatedAt:1}
  const input={mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,now:4,deferToParent:{parentId:'parent',sourceOccurrence:0,dieIndex:0}}
  const count=writes.length
  await expect(commitD20ChoiceReroll({...input,deferToParent:{...input.deferToParent,parentId:'foreign'}},gateway)).rejects.toThrow('real-private-parent-required')
  await expect(commitD20ChoiceReroll({...input,deferToParent:{...input.deferToParent,dieIndex:1}},gateway)).rejects.toThrow('original-die-required')
  const actualPrompt=(data['combat-interrupts'].interrupts as typeof prompt[])[0]
  const actualRollId=actualPrompt.payload.rollId
  actualPrompt.payload.rollId='foreign-raw:0'
  await expect(commitD20ChoiceReroll(input,gateway)).rejects.toThrow('authenticated-original-request-required')
  actualPrompt.payload.rollId=actualRollId
  actualPrompt.actorCharId='other'
  await expect(commitD20ChoiceReroll(input,gateway)).rejects.toThrow('authenticated-original-request-required')
  actualPrompt.actorCharId='ally'
  actualPrompt.payload.originalValue=20
  await expect(commitD20ChoiceReroll(input,gateway)).rejects.toThrow('authenticated-original-request-required')
  actualPrompt.payload.originalValue=1
  expect(writes).toHaveLength(count)
  const response=await commitD20ChoiceReroll(input,gateway)
  expect(response.finalValue).toBe(replacement)
  expect((data.characters.characters as typeof characters)[0].inspiration).toBe(1)
  expect(writes.slice(count)).toEqual([['combat','combat-interrupts']])
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  const first=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)[0]
  expect(first.postOriginalD20).toEqual([expect.objectContaining({parentId:'parent',actorId:'ally-token',characterId:'ally',rawRollId,interruptId:prompt.id,contributionId:contribution.id,originalValue:1,selectedValue:replacement,featureId:option.featureId,resourceCosts:option.resourceCosts})])
  expect(await commitD20ChoiceReroll(input,gateway)).toEqual(response)
  expect(writes).toHaveLength(count+1)
  await expect(commitD20ChoiceReroll({...input,acceptedContributionId:'foreign'},gateway)).rejects.toThrow('authenticated-contribution-required')
  expect(writes).toHaveLength(count+1)
  const finalSource={...source,damageRolls:replacement===17?[3]:[]}
  await expect(recordBountifulOriginalAfterDice({action,source:{...finalSource,bardicInspirationRoll:7},resolve:resolvePreparedDnd5eEquipmentAttack,authorityUnchanged:()=>true},gateway)).rejects.toThrow('real-continuation-rejected')
  const liveFirst=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)[0]
  const realFacts=structuredClone(liveFirst.postOriginalD20)
  if(!realFacts?.length)throw Error('Missing authenticated deferred source')
  liveFirst.postOriginalD20=realFacts.map(fact=>({...fact,readyOrdinal:fact.readyOrdinal+1}))
  await expect(recordBountifulOriginalAfterDice({action,source:finalSource,resolve:resolvePreparedDnd5eEquipmentAttack,authorityUnchanged:()=>true},gateway)).rejects.toThrow('real-continuation-rejected')
  liveFirst.postOriginalD20=realFacts.map(fact=>({...fact,resourceCosts:[{...fact.resourceCosts[0],amount:2}]}))
  await expect(recordBountifulOriginalAfterDice({action,source:finalSource,resolve:resolvePreparedDnd5eEquipmentAttack,authorityUnchanged:()=>true},gateway)).rejects.toThrow('real-continuation-rejected')
  liveFirst.postOriginalD20=realFacts
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  await recordBountifulOriginalAfterDice({action,source:finalSource,resolve:resolvePreparedDnd5eEquipmentAttack,authorityUnchanged:()=>true},gateway)
  const resolved=await resolveBountifulOriginalForNormalAck({action,source:finalSource,resolve:resolvePreparedDnd5eEquipmentAttack,options:{combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[]}},gateway)
  expect(resolved.result.ok).toBe(true)
  expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',d20:replacement,total:replacement+4,hit:replacement===17}))
  if(!resolved.application)throw Error('Real application missing')
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  const normalActorEconomy=spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('combat:1:ally-token',30),'action').economy
  const notifications:string[]=[]
  const ackInput:PublishPlayerActionAckInput={
   ack:{id:'ack:parent',actionId:'parent',mapId:'map',combatId:'combat',recipientMemberId:'ally-member',status:'accepted',round:1,initiativeIndex:0,updatedAt:2},
   snapshots:{characters:resolved.application.characters,maps:[resolved.application.map],updatedAt:2,combat:{mapId:'map',combatId:'combat',active:true,round:1,initiativeIndex:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),updatedAt:2,dnd5eTurnEconomyByToken:{'ally-token':normalActorEconomy}}},
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
  const economies=data.combat.dnd5eTurnEconomyByToken as Record<string,{action:{current:number};reaction:{current:number}}>
  expect(economies['ally-token'].action.current).toBe(0) // normal Maps postprocessing retained
  expect(economies['second-token']).toBeUndefined()
  const parents=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)
  expect(parents).toHaveLength(1);expect(parents.every(row=>row.consumed?.transactionId==='parent')).toBe(true)
  expect((data['player-action-processed'].actionIds as string[])).toEqual(['parent'])
  expect(data['player-action-ack'].actionId).toBe('parent')
  const finalCharacters=data.characters.characters as typeof characters
  expect(finalCharacters.find(c=>c.id==='ally')?.dnd5eInventory?.entries.find(e=>e.item.ammunitionKind==='arrow')?.quantity).toBe(19)
  expect(finalCharacters.find(c=>c.id==='target')?.currentHp).toBe(replacement===17?25:30)
  expect((data.characters.characters as typeof characters).find(c=>c.id==='ally')?.dnd5eCombatState?.bardicInspirationDie).toBe(6)
  expect((data.characters.characters as typeof characters).find(c=>c.id==='ally')?.inspiration).toBe(0)
  // A repeated/reloaded ACK observes the durable consumed parent; no extra CAS.
  await publishBountifulOriginalThroughNormalAck(structuredClone(action),ackInput,gateway)
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(1)
  expect(notifications).toEqual(['ack:parent','ack:parent'])
 }finally{dispose()}
})

function requireCharacterRoller(roller:{characterId?:string}){if(!roller.characterId)throw Error("This Character-only fixture requires its actual Character roller");return roller.characterId}
