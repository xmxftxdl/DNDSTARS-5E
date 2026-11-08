import {resolveBountifulOrOrdinarySpell} from './bountifulLuckSpellSettlement'
import {publishBountifulOrOrdinaryPlayerActionAck} from './bountifulLuckNormalAck'
import {beginBountifulSpellOriginalSave} from './bountifulLuckSpellOriginal'
import {nextBountifulOriginalDieOwner,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {continueBountifulSpellOriginalSave} from './bountifulSpellOriginalD20Flow'
import {prepareBountifulReadyExtraD20} from './bountifulReadyGenericReplay'
import {commitD20ChoiceReroll} from '../../pages/maps/commitD20ChoiceReroll'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
import {createDnd5eTurnEconomyCounts,spendDnd5eTurnResource} from './turnEconomy'
import {issueBountifulReadyGenericPrompt} from './bountifulReadyGenericReplay'
import {createD20ChoiceRerollContribution} from '../../lib/rollConfirmation'
import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {durableD20RollId} from '../../lib/rollConfirmation'
import {prepareDnd5eSpellCast} from './spellAction'
import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {captureBountifulSpellTargetRaw} from './bountifulSpellTargetRaw'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it('restores a later generic-ready save after an earlier authenticated natural-one decline',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 const disposeLatest=registerDnd5eRulesPlugin({manifest:{id:'test.pre-ready',name:'Actual must-use-latest fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0-1.0'},setup(api){api.registerFeat({id:'latest',name:'Latest result',summary:'Latest result',description:'Declared data-only saving throw reroll',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'long-rest'}],declarativeAbility:{schemaVersion:1,id:'latest',name:'Latest result',description:'Use the new result',level:1,trigger:{kind:'after-d20-roll'},targeting:{kind:'self'},effects:[],automation:'full',cost:{economy:'none',resources:[{resourceId:'uses',amount:1}]},mechanic:{kind:'d20-choice-reroll',rollKinds:['saving-throw'],scopes:['self-roll'],additionalDice:1,selection:'must-use-latest'}}})}})
 try{
  const make=(id:string,feat=false)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:feat?'半身人':'人类',dnd5eRaceId:feat?'halfling':'human',charClass:'战士',level:4,currentHp:30,maxHp:30,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster'),charClass:'术士',equipment:{},dnd5eClassLevels:{sorcerer:4},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:18},dnd5eClassChoices:{classes:{sorcerer:{selections:{'spell-cantrips':['acid-splash']}}}}}),first=make('first'),second=make('second');second.dnd5eFeatIds=['test.pre-ready:latest'];second.classResources={...second.classResources,'test.pre-ready:uses':{current:1,max:1}}
  const characters=[caster,first,second,make('helper',true)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((character,index)=>({id:character.id+'-token',characterId:character.id,type:index===0?'enemy':'player',label:character.name,x:index===2?125:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'caster-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'first-token',targetTokenIds:['first-token','second-token'],dnd5eSpellCast:{spellId:'acid-splash',castingClassId:'sorcerer',slotLevel:0,targetTokenId:'first-token',targetTokenIds:['first-token','second-token']},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const firstRaw=captureBountifulSpellTargetRaw({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:2}),cursor:3,raw:[1],actorId:'first-token'})

  const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))});if(!prepared.ok)throw Error(prepared.reason)
  type Resource={_sync:{revision:number};[key:string]:unknown}
  const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},maps:[map]},combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0},'player-action-requests':{_sync:{revision:1},requests:[action]}}
  for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]?._sync.revision??0);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);for(const write of batch)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:(data[write.name]?._sync.revision??0)+1}};writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const secondRaw=captureBountifulSpellTargetRaw({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:6}),cursor:7,raw:[20],actorId:'second-token'})
  const source={prepared:prepared.prepared,targetSavingThrows:[{targetId:'first-token',d20:1},{targetId:'second-token',d20:20}],effectRolls:[],hostOriginalRollActorId:'first-token',hostOriginalRollKind:'saving-throw' as const,...captureBountifulOriginalRawIssuer({mapId:'map',parentId:action.id,mode:'dm',rollId:firstRaw.hostOriginalRollId,cursor:3,raw:[1]}),hostOriginalSpellSavingThrows:[firstRaw,secondRaw]}

  const decline={showChoice:async(receipt:BountifulOriginalDieReceipt)=>{
   const next=nextBountifulOriginalDieOwner(receipt);if(!next)throw Error('Actual owner required')
   const control=receipt.controllers[next.ownerId],rows=data['player-action-requests'].requests as object[]
   data['player-action-requests'].requests=[...rows,{id:'response-'+rows.length,roomMemberId:control.memberId,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:'map',combatId:'combat',actorTokenId:next.ownerId,characterId:control.characterId,bountifulLuck:{parentId:action.id,occurrence:receipt.identity.occurrence,command:{phase:'reaction',...next,decision:'decline'}}}]
  },requestRoll:async()=>{throw Error('Decline must not reroll')}}
  const initial={...source,targetSavingThrows:[{targetId:'first-token',d20:1}],hostOriginalSpellSavingThrows:[firstRaw]}
  const firstStage=await beginBountifulSpellOriginalSave({action,source:initial,actorId:'first-token',rollCursor:3,authorityUnchanged:()=>true},gateway,decline)
  expect(firstStage?.retainedDice).toEqual([1])

  const before=structuredClone(data)
  const stage=await continueBountifulSpellOriginalSave({action,source,actorId:'second-token',rollCursor:7,authorityUnchanged:()=>true},gateway,{
   original:{showChoice:async()=>{throw Error('Original20 cannot ask for a natural-one decision')},requestRoll:async()=>{throw Error('Original20 cannot request a BL replacement')}},
   confirmSelfReroll:async request=>{
    const scope=request.bountifulReadyParent;if(!scope)throw Error('Native ready20 requires its own ready-frame identity')
    const prompt=await issueBountifulReadyGenericPrompt({mapId:'map',frameId:scope.frameId,dieIndex:request.dieIndex},gateway)
    expect(prompt.payload.rollId).toBe(request.rollId)
    const option=prompt.payload.eligibleModifiers?.find(row=>row.featureId==='test.pre-ready:feat-latest');if(!option)throw Error('Actual current declared source required')
    const contribution=createD20ChoiceRerollContribution({interruptId:prompt.id,characterId:'second',characterName:second.name,featureId:option.featureId,featureLabel:option.featureLabel,decision:'use',selectedIndex:1})
    if(contribution.kind!=='choice-reroll')throw Error('Actual generic choice contribution required')
    prompt.contributions=[contribution];prompt.status='rolling'
    data['combat-interrupts'].interrupts=[prompt];data['combat-interrupts']._sync.revision++
    const beforeDice=await prepareBountifulReadyExtraD20({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:contribution},gateway)
    expect(beforeDice).toMatchObject({count:1,rollerCharacterId:'second'});expect(beforeDice.rollRequestId).toMatch(/^bountiful-ready-extra-d20:[a-f0-9]{64}$/)
    expect(await prepareBountifulReadyExtraD20({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:contribution},gateway)).toEqual(beforeDice)
    await expect(prepareBountifulReadyExtraD20({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:{...contribution,characterId:'helper'}},gateway)).rejects.toThrow('locked-original-contribution-required')
    prompt.payload.rollOptions={contributionId:contribution.id,values:[20,1]}
    data['combat-interrupts'].interrupts=[prompt];data['combat-interrupts']._sync.revision++
    const settled=await commitD20ChoiceReroll({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id},gateway)
    if(settled.finalValue===undefined)throw Error('Actual generic committer must return retained result')
    return settled.finalValue
   },
  })
  if(!stage||!('hostOriginalReadyFrameId'in stage))throw Error('Actual ready-stage continuation required')
  const id=stage.hostOriginalReadyFrameId
  expect(stage.retainedDice).toEqual([1]);expect(stage.originalReady.originalRolls).toEqual([20]);expect(stage.receipts).toHaveLength(0)
  expect(stage.previewState.combatants['second-token'].classResources['test.pre-ready:uses'].current).toBe(0)
  expect(data.characters).toEqual(before.characters);expect(data.maps).toEqual(before.maps)
  const restored=await continueBountifulSpellOriginalSave({action,source,actorId:'second-token',rollCursor:7,authorityUnchanged:()=>true},gateway,{original:{showChoice:async()=>{throw Error('No repeated earlier owner choice')},requestRoll:async()=>{throw Error('No repeated earlier original')}},confirmSelfReroll:async()=>{throw Error('No repeated confirmed generic choice')}})
  expect(restored?.retainedDice).toEqual([1])
  const resolved=await resolveBountifulOrOrdinarySpell({action,source:{...source,effectRolls:[4],hostOriginalD20Replay:restored?.hostOriginalD20Replay},rollCursor:8,specializedSource:false,options:{combatRevision:data.combat._sync.revision,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[]},ordinary:()=>{throw Error('Private native parent required')}},gateway)
  expect(resolved.result.ok).toBe(true)
  if(!resolved.application)throw Error('Actual native spell application required')
  expect(resolved.application.characters.find(row=>row.id==='first')?.currentHp).toBe(26)
  expect(resolved.application.characters.find(row=>row.id==='second')?.currentHp).toBe(26)
  expect(resolved.application.characters.find(row=>row.id==='second')?.classResources?.['test.pre-ready:uses'].current).toBe(0)
  const economy=spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('combat:1:caster-token',30),'action').economy
  const notifications:string[]=[]
  const ackInput:PublishPlayerActionAckInput={
   ack:{id:'ack:parent',actionId:'parent',mapId:'map',combatId:'combat',recipientMemberId:'caster-member',status:'accepted',round:1,initiativeIndex:0,updatedAt:2},
   snapshots:{characters:resolved.application.characters,maps:[resolved.application.map],updatedAt:2,combat:{mapId:'map',combatId:'combat',active:true,round:1,initiativeIndex:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),updatedAt:2,dnd5eTurnEconomyByToken:{'caster-token':economy}}},
   processed:{mapId:'map',combatId:'combat',actionIds:['parent'],updatedAt:2},expectedRevisions:{'player-action-ack':0,'player-action-processed':0},
   saveSharedResource:async()=>{throw Error('No independent resource write permitted')},
   commitSharedResources:async(batch,options)=>{await gateway.saveResourcesAtomically(batch,options);return{}},
   loadSharedResource:gateway.loadResource,publishAck:async ack=>{notifications.push(ack.id)},
  }
  await expect(publishBountifulOrOrdinaryPlayerActionAck(structuredClone(action),ackInput,gateway)).rejects.toThrow('issued-result-required')
  expect(writes.filter(row=>row.includes('characters'))).toHaveLength(0)
  if(!ackInput.snapshots)throw Error('Actual snapshots required')
  const unpaid=structuredClone(ackInput.snapshots)
  const unpaidActor=unpaid.characters.find(row=>row.id==='second');if(!unpaidActor?.classResources?.['test.pre-ready:uses'])throw Error('Actual generic resource required')
  unpaidActor.classResources['test.pre-ready:uses'].current=1
  await expect(publishBountifulOrOrdinaryPlayerActionAck(action,{...ackInput,snapshots:unpaid},gateway)).rejects.toThrow('deferred-cost-not-in-final-snapshot')
  expect(writes.filter(row=>row.includes('characters'))).toHaveLength(0)
  await publishBountifulOrOrdinaryPlayerActionAck(action,ackInput,gateway)
  expect(writes.filter(row=>row.includes('characters'))).toEqual([['characters','maps','combat','player-action-processed','player-action-ack']])
  const current=data.characters.characters as typeof characters
  expect(current.find(row=>row.id==='first')?.currentHp).toBe(26)
  expect(current.find(row=>row.id==='second')?.classResources?.['test.pre-ready:uses'].current).toBe(0)
  expect((data.combat.dnd5eTurnEconomyByToken as Record<string,{action:{current:number}}>)['caster-token'].action.current).toBe(0)
  expect(Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>).every(row=>row.consumed?.transactionId==='parent')).toBe(true)
  expect((data.combat.bountifulReadyParents as Record<string,{consumed?:{transactionId:string}}>)[id].consumed?.transactionId).toBe('parent')
  const finalCount=writes.length
  await publishBountifulOrOrdinaryPlayerActionAck(structuredClone(action),ackInput,gateway)
  expect(writes.length).toBe(finalCount)

 }finally{disposeLatest();dispose()}
})
