import {prepareBountifulDeferredExtraD20} from './bountifulLuckDeferredD20'
import {commitD20ChoiceReroll} from '../../pages/maps/commitD20ChoiceReroll'
import {createD20ChoiceRerollContribution,createD20RollConfirmationInterrupt} from '../../lib/rollConfirmation'
import {dnd5eCoreInspirationChoiceRerollOption} from '../../lib/d20InterruptPolicy'
import {continueBountifulSpellOriginalSave} from './bountifulSpellOriginalD20Flow'
import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {captureBountifulSpellTargetRaw,bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import {durableD20RollId} from '../../lib/rollConfirmation'

import {appendBountifulSpellOriginalSave} from './bountifulLuckSpellOriginalStream'
import {recordBountifulOriginalAfterDice} from './bountifulLuckNormalAck'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {it,expect,vi} from 'vitest'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from './spellAction'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {driveBountifulOriginalParent,BountifulOriginalParentPending,readBountifulOriginalSpellInput} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId,nextBountifulOriginalDieOwner,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {resolveBountifulOriginalForNormalAck,publishBountifulOriginalThroughNormalAck} from './bountifulLuckNormalAck'
import {createDnd5eTurnEconomyCounts,spendDnd5eTurnResource} from './turnEconomy'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

it.each([12,1])('first target generic replacement %i is replayed before the second target original checkpoint',async replacement=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent)
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const make=(id:string,feat:boolean)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:'半身人',dnd5eRaceId:'halfling',charClass:'战士',level:4,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},currentHp:30,maxHp:30,dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster',false),race:'人类',dnd5eRaceId:'human',charClass:'术士',equipment:{},dnd5eClassLevels:{sorcerer:4},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:18},dnd5eClassChoices:{classes:{sorcerer:{selections:{'spell-cantrips':['acid-splash']}}}}});
  const other=make('other',false),ally=normalizeCharacter({...make('ally',false),race:'人类',dnd5eRaceId:'human',inspiration:1});
  const characters=[caster,ally,make('first',true),make('second',true),other]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,index)=>({id:c.id+'-token',characterId:c.id,type:index===0?'enemy':'player',label:c.name,x:index===4?125:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'caster-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'ally-token',targetTokenIds:['ally-token','other-token'],dnd5eSpellCast:{spellId:'acid-splash',castingClassId:'sorcerer',slotLevel:0,targetTokenId:'ally-token',targetTokenIds:['ally-token','other-token']},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  if(!prepared.ok)throw Error(prepared.reason)
  type Resource={_sync:{revision:number};[key:string]:unknown}
  let data:Record<string,Resource>={combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0},characters:{_sync:{revision:2},characters},maps:{_sync:{revision:3},maps:[map]},'player-action-requests':{_sync:{revision:4},requests:[action]}}
  data['player-action-ack']={_sync:{revision:0},id:''}
  data['player-action-processed']={_sync:{revision:0},actionIds:[]}
  data['combat-interrupts']={_sync:{revision:1},mapId:'map',interrupts:[],updatedAt:1}
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]._sync.revision);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);const next=structuredClone(data);for(const write of batch)next[write.name]={...write.data as object,_sync:{revision:data[write.name]._sync.revision+1}};data=next;writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const beginBountifulSpellOriginalSave=(input:Parameters<typeof continueBountifulSpellOriginalSave>[0],actualGateway:Parameters<typeof continueBountifulSpellOriginalSave>[1],original:Parameters<typeof continueBountifulSpellOriginalSave>[2]['original'])=>continueBountifulSpellOriginalSave(input,actualGateway,{original,confirmSelfReroll:async request=>{
    if(!request.bountifulParent)throw Error('Actual original natural-one parent required');
    if(input.actorId!=='ally-token')throw Error('first target finalized die must never get generic');
    const option=dnd5eCoreInspirationChoiceRerollOption(ally,'ally-token',request.ready.rollMode??'normal');if(!option)throw Error('actual Inspiration option missing');
    const prompt=createD20RollConfirmationInterrupt({mapId:'map',combatId:'combat',rollId:request.rollId,bountifulParent:request.bountifulParent,label:'Second target generic self reroll',originalValue:request.originalValue,rollerCharacterId:'ally',eligibleModifiers:[option]});
    const contribution=createD20ChoiceRerollContribution({interruptId:prompt.id,characterId:'ally',characterName:'ally',featureId:option.featureId,featureLabel:option.featureLabel,decision:'use'});
    if(contribution.kind!=='choice-reroll')throw Error('real choice required');
    prompt.status='rolling';prompt.contributions=[contribution];data['combat-interrupts']={...data['combat-interrupts'],interrupts:[prompt]};
    const scope=await prepareBountifulDeferredExtraD20({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:contribution},actualGateway);
    expect(scope.rollerCharacterId).toBe('ally');expect(request.bountifulParent.rawRollId).toBe(firstRaw.hostOriginalRollId);
    prompt.payload.rollOptions={contributionId:contribution.id,values:[1,replacement]};data['combat-interrupts']={...data['combat-interrupts'],interrupts:[prompt]};
    const response=await commitD20ChoiceReroll({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id},actualGateway);
    if(typeof response.finalValue!=='number')throw Error('Actual settled generic value required');
    return response.finalValue;
  }});

  const firstRaw=captureBountifulSpellTargetRaw({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:2}),cursor:3,raw:[1],actorId:'ally-token'})
  const source={prepared:prepared.prepared,targetSavingThrows:[{targetId:'ally-token',d20:1}],effectRolls:[] as number[],hostOriginalRollActorId:'ally-token',hostOriginalRollKind:'saving-throw' as const,...captureBountifulOriginalRawIssuer({mapId:'map',parentId:action.id,mode:'dm',rollId:firstRaw.hostOriginalRollId,cursor:3,raw:[1]}),hostOriginalSpellSavingThrows:[firstRaw]}

  const unavailable={...createDnd5eTurnEconomyCounts('combat:0:any',30),reaction:{current:0,max:1}}
  data.combat.dnd5eTurnEconomyByToken={'first-token':unavailable,'second-token':unavailable}
  expect(await beginBountifulSpellOriginalSave({action,source,actorId:'ally-token',rollCursor:3,authorityUnchanged:()=>true},gateway,{showChoice:async()=>{throw Error('Unavailable owner must not be prompted')},requestRoll:async()=>{}})).toBeUndefined()
  expect(writes).toHaveLength(0)
  delete data.combat.dnd5eTurnEconomyByToken
  const untouched=structuredClone(data.characters),sequence:string[]=[],rolls:string[]=[]
  const append=(receipt:BountifulOriginalDieReceipt,actorTokenId:string,characterId:string,memberId:string,command:object)=>{
   const rows=data['player-action-requests'].requests as object[]
   data['player-action-requests'].requests=[...rows,{id:'response-'+rows.length,roomMemberId:memberId,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:'map',combatId:'combat',actorTokenId,characterId,bountifulLuck:{parentId:'parent',occurrence:receipt.identity.occurrence,command}}]
  }
  // A closed or unanswered UI does not manufacture a decline or any cost.
  await expect(beginBountifulSpellOriginalSave({action,source,actorId:'ally-token',rollCursor:3,authorityUnchanged:()=>true},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  expect(data.characters).toEqual(untouched)
  const ui:Parameters<typeof driveBountifulOriginalParent>[2]={
   showChoice:async receipt=>{const next=nextBountifulOriginalDieOwner(receipt);if(!next)throw Error('No real owner');sequence.push(next.ownerId+':'+receipt.request.dieIndex);const control=receipt.controllers[next.ownerId];append(receipt,next.ownerId,control.characterId,control.memberId,{phase:'reaction',...next,decision:receipt.request.actorId==='other-token'&&next.ownerId==='second-token'?'use':'decline'})},
   requestRoll:async(receipt,refresh)=>{rolls.push(receipt.identity.roller.tokenId+':'+receipt.request.dieIndex);const roller=receipt.identity.roller,id=bountifulOriginalDieRollId(receipt),value=roller.tokenId==='ally-token'?2:15;append(receipt,roller.tokenId,requireCharacterRoller(roller),roller.memberId,{phase:'roll',rollRequestId:id,value});const fresh=await refresh();expect(fresh.rawReroll?.memberId).toBe(roller.memberId);append(fresh,roller.tokenId,requireCharacterRoller(roller),'host',{phase:'confirm',rollRequestId:id,rawValue:value,value})}
  }
  const firstStage=await beginBountifulSpellOriginalSave({action,source,actorId:'ally-token',rollCursor:3,authorityUnchanged:()=>true},gateway,ui)
  if(!firstStage)throw Error('Qualified original source was not issued')
  expect(firstStage.receipts[0].request.actorId).toBe('ally-token');expect(firstStage.retainedDice).toEqual([replacement])
  expect(firstStage.receipts).toHaveLength(1)
  expect(source.targetSavingThrows).toEqual([{targetId:'ally-token',d20:1}]) // no fabricated second raw die
  expect(data.characters).toEqual(untouched)
  const secondRaw=captureBountifulSpellTargetRaw({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:6}),cursor:7,raw:[1],actorId:'other-token'})
  const nextSource={...source,targetSavingThrows:[...source.targetSavingThrows,{targetId:'other-token',d20:1}],hostOriginalSpellSavingThrows:[firstRaw,secondRaw]}
  expect(bountifulOriginalRawForActor(nextSource,'ally-token','saving-throw',[1]).hostOriginalRollId).toBe(firstRaw.hostOriginalRollId)
  expect(bountifulOriginalRawForActor(nextSource,'other-token','saving-throw',[1]).hostOriginalRollId).toBe(secondRaw.hostOriginalRollId)
  expect(()=>bountifulOriginalRawForActor({...nextSource,hostOriginalSpellSavingThrows:[firstRaw]},'other-token','saving-throw',[1])).toThrow('exact-target-capture-required')
  expect(()=>bountifulOriginalRawForActor(nextSource,'other-token','saving-throw',[20])).toThrow('changed-target-raw')
  expect(()=>bountifulOriginalRawForActor({...nextSource,hostOriginalSpellSavingThrows:[firstRaw,{...secondRaw,hostOriginalRollId:firstRaw.hostOriginalRollId}]},'other-token','saving-throw',[1])).toThrow('raw-capture-namespace-mismatch')
  expect(()=>bountifulOriginalRawForActor({...nextSource,hostOriginalSpellSavingThrows:[firstRaw,secondRaw,secondRaw]},'other-token','saving-throw',[1])).toThrow('exact-target-capture-required')
  const appendInput={action,source:nextSource,actorId:'other-token',rollCursor:7,authorityUnchanged:()=>true}
  const beforeAppend=writes.length
  await expect(appendBountifulSpellOriginalSave({...appendInput,source:{...nextSource,targetSavingThrows:[{targetId:'ally-token',d20:20},{targetId:'other-token',d20:1}]}},gateway)).rejects.toThrow('append-only-original-saves-required')
  expect(writes).toHaveLength(beforeAppend)
  await expect(beginBountifulSpellOriginalSave(appendInput,gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  const afterFirstAppend=writes.length
  await expect(beginBountifulSpellOriginalSave(appendInput,gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  expect(writes).toHaveLength(afterFirstAppend)
  expect(writes).toHaveLength(beforeAppend+2)
  const resumed=await driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{showChoice:async()=>{},requestRoll:async()=>{}}).then(()=>{throw Error('Missing second choice must remain pending')},error=>error)
  expect(resumed).toBeInstanceOf(BountifulOriginalParentPending)
  const restored=await readBountifulOriginalSpellInput({mapId:'map',parentId:'parent'},gateway)
  expect(restored?.actorId).toBe('other-token');expect(restored?.rollCursor).toBe(7)
  expect(restored?.source.targetSavingThrows).toEqual([{targetId:'ally-token',d20:1},{targetId:'other-token',d20:1}])
  const completed=await beginBountifulSpellOriginalSave(appendInput,gateway,ui);if(!completed)throw Error('actual second target flow missing');const stage={request:completed.originalReady,receipts:completed.receipts}
  expect(stage.request.actorId).toBe('other-token')
  expect(stage.request.values).toEqual([15]);expect(completed.previewState.combatants['ally-token'].inspiration).toBe(0)
  expect(stage.receipts.map(row=>row.identity.roller.tokenId)).toEqual(['ally-token','other-token'])
  expect(sequence).toEqual(['first-token:0','second-token:0','first-token:0','second-token:0'])
  expect(rolls).toEqual(['other-token:0'])
  expect(data.characters).toEqual(untouched)
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  expect((data.characters.characters as typeof characters).find(row=>row.id==='ally')?.inspiration).toBe(1);
  const finalSource={...nextSource,effectRolls:replacement===12?[]:[4]}
  await recordBountifulOriginalAfterDice({action,source:finalSource,resolve:resolvePreparedDnd5eSpellCast,rollCursor:8,authorityUnchanged:()=>true},gateway)
  const privateFirst=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)[0]
  expect(privateFirst.continuation?.rollCursor).toBe(8)
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  const resolved=await resolveBountifulOriginalForNormalAck({action,source:finalSource,resolve:resolvePreparedDnd5eSpellCast,options:{combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[]}},gateway)
  expect(resolved.result.ok).toBe(true)
  if(!resolved.application)throw Error('Real application missing')
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
  const normalActorEconomy=spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('combat:1:caster-token',30),'action').economy
  const notifications:string[]=[]
  const ackInput:PublishPlayerActionAckInput={
   ack:{id:'ack:parent',actionId:'parent',mapId:'map',combatId:'combat',recipientMemberId:'caster-member',status:'accepted',round:1,initiativeIndex:0,updatedAt:2},
   snapshots:{characters:resolved.application.characters,maps:[resolved.application.map],updatedAt:2,combat:{mapId:'map',combatId:'combat',active:true,round:1,initiativeIndex:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),updatedAt:2,dnd5eTurnEconomyByToken:{'caster-token':normalActorEconomy}}},
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
  expect(economies['caster-token'].action.current).toBe(0) // normal Maps postprocessing retained
  expect(economies['second-token'].reaction.current).toBe(0)
  expect(resolved.result.state.combatants['first-token'].turn.reactionAvailable).toBe(true);expect(economies['first-token']?.reaction.current??1).toBe(1)
  const parents=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)
  expect(parents).toHaveLength(2);expect(parents.every(row=>row.consumed?.transactionId==='parent')).toBe(true)
  expect((data['player-action-processed'].actionIds as string[])).toEqual(['parent'])
  expect(data['player-action-ack'].actionId).toBe('parent')
  expect((data.characters.characters as typeof characters).find(c=>c.id==='ally')?.currentHp).toBe(replacement===12?30:26)
  expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'ally-token',success:replacement===12}));
  expect((data.characters.characters as typeof characters).find(row=>row.id==='ally')?.inspiration).toBe(0);
  expect((data.characters.characters as typeof characters).find(row=>row.id==='other')?.currentHp).toBe(30);
  expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'other-token',success:true}));
  // A repeated/reloaded ACK observes the durable consumed parent; no extra CAS.
  await publishBountifulOriginalThroughNormalAck(structuredClone(action),ackInput,gateway)
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(1)
  expect(notifications).toEqual(['ack:parent','ack:parent'])
 }finally{dispose()}
})

function requireCharacterRoller(roller:{characterId?:string}){if(!roller.characterId)throw Error("This Character-only fixture requires its actual Character roller");return roller.characterId}
