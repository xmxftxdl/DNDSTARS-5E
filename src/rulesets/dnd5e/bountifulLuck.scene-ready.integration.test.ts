import {bountifulReadyHttpFixture} from './bountifulLuck.ready-authority.testSupport'
import {validateBountifulReadyParents} from '../../../shared/bountiful-ready-parents.mjs'
import type {BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {dnd5eSpellAuthorityResolutionContext} from '../../pages/maps/spellSettlementCoordinator'
import {continueBountifulSpellOriginalSave} from './bountifulSpellOriginalD20Flow'
import {prepareBountifulReadyExtraD20} from './bountifulReadyGenericReplay'
import {commitD20ChoiceReroll} from '../../pages/maps/commitD20ChoiceReroll'
import {resolveBountifulReadyForNormalAck,publishBountifulReadyThroughNormalAck} from './bountifulReadyNormalAck'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
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
it('keeps a real exploration ready original20 and resource-cost latest1 separate through reload and native normal ACK',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 const disposeLatest=registerDnd5eRulesPlugin({manifest:{id:'test.pre-ready',name:'Actual must-use-latest fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0-1.0'},setup(api){api.registerFeat({id:'latest',name:'Latest result',summary:'Latest result',description:'Declared data-only saving throw reroll',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'long-rest'}],declarativeAbility:{schemaVersion:1,id:'latest',name:'Latest result',description:'Use the new result',level:1,trigger:{kind:'after-d20-roll'},targeting:{kind:'self'},effects:[],automation:'full',cost:{economy:'none',resources:[{resourceId:'uses',amount:1}]},mechanic:{kind:'d20-choice-reroll',rollKinds:['saving-throw'],scopes:['self-roll'],additionalDice:1,selection:'must-use-latest'}}})}})
 try{
  const make=(id:string,feat=false)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:feat?'半身人':'人类',dnd5eRaceId:feat?'halfling':'human',charClass:'战士',level:4,currentHp:30,maxHp:30,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster'),charClass:'术士',equipment:{},dnd5eClassLevels:{sorcerer:4},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:18},dnd5eClassChoices:{classes:{sorcerer:{selections:{'spell-cantrips':['acid-splash']}}}}}),first=make('first');first.dnd5eFeatIds=['test.pre-ready:latest'];first.classResources={...first.classResources,'test.pre-ready:uses':{current:1,max:1}}
  const characters=[caster,first,make('second'),make('helper',true)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((character,index)=>({id:character.id+'-token',characterId:character.id,type:index===0?'enemy':'player',label:character.name,x:index===2?125:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',sourceMode:'player',status:'pending',roomMemberId:'caster-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'first-token',targetTokenIds:['first-token','second-token'],dnd5eSpellCast:{spellId:'acid-splash',castingClassId:'sorcerer',slotLevel:0,targetTokenId:'first-token',targetTokenIds:['first-token','second-token']},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const firstRaw=captureBountifulSpellTargetRaw({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:2}),cursor:3,raw:[20],actorId:'first-token'})

  const authority=dnd5eSpellAuthorityResolutionContext({combatActive:false,map,actorTokenId:action.actorTokenId,initiativeOrder:[]})
  const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:authority.initiativeOrder});if(!prepared.ok)throw Error(prepared.reason)
  type Resource={_sync:{revision:number};[key:string]:unknown}
  const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},maps:[map]},combat:{_sync:{revision:1},active:false,mapId:'old-map',combatId:'old-combat',round:9,initiativeIndex:0},'player-action-requests':{_sync:{revision:1},requests:[action]}}
  for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
  const mintedFrames:BountifulReadyParentData[]=[]
  function assertFrameEvent(value:unknown):asserts value is {frame:BountifulReadyParentData}{if(!value||typeof value!=='object'||!('frame'in value)||!value.frame||typeof value.frame!=='object'||!('id'in value.frame)||typeof value.frame.id!=='string'||!validateBountifulReadyParents({[value.frame.id]:value.frame}))throw Error('Expected actual emitted ready frame')}
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>={publishEvent:async(channel,payload)=>{if(channel==='bountiful-ready-mint-dm-to-host'){assertFrameEvent(payload);mintedFrames.push(structuredClone(payload.frame))}},loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]?._sync.revision??0);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);for(const write of batch)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:(data[write.name]?._sync.revision??0)+1}};writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const secondRaw=captureBountifulSpellTargetRaw({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:6}),cursor:7,raw:[20],actorId:'second-token'})
  const source={prepared:prepared.prepared,targetSavingThrows:[{targetId:'first-token',d20:20},{targetId:'second-token',d20:20}],effectRolls:[4],hostOriginalRollActorId:'first-token',hostOriginalRollKind:'saving-throw' as const,...captureBountifulOriginalRawIssuer({mapId:'map',parentId:action.id,mode:'dm',rollId:firstRaw.hostOriginalRollId,cursor:3,raw:[20]}),hostOriginalSpellSavingThrows:[firstRaw,secondRaw]}
  const before=structuredClone(data)
  const stage=await continueBountifulSpellOriginalSave({action,source,actorId:'first-token',rollCursor:3,authorityUnchanged:()=>true},gateway,{
   original:{showChoice:async()=>{throw Error('Original20 cannot ask for a natural-one decision')},requestRoll:async()=>{throw Error('Original20 cannot request a BL replacement')}},
   confirmSelfReroll:async request=>{
    const scope=request.bountifulReadyParent;if(!scope)throw Error('Native ready20 requires its own ready-frame identity')
    const prompt=await issueBountifulReadyGenericPrompt({mapId:'map',frameId:scope.frameId,dieIndex:request.dieIndex},gateway)
    expect(prompt.payload.rollId).toBe(request.rollId)
    const option=prompt.payload.eligibleModifiers?.find(row=>row.featureId==='test.pre-ready:feat-latest');if(!option)throw Error('Actual current declared source required')
    const contribution=createD20ChoiceRerollContribution({interruptId:prompt.id,characterId:'first',characterName:first.name,featureId:option.featureId,featureLabel:option.featureLabel,decision:'use',selectedIndex:1})
    if(contribution.kind!=='choice-reroll')throw Error('Actual generic choice contribution required')
    prompt.contributions=[contribution];prompt.status='rolling'
    data['combat-interrupts'].interrupts=[prompt];data['combat-interrupts']._sync.revision++
    const beforeDice=await prepareBountifulReadyExtraD20({mapId:'map',interruptId:prompt.id,acceptedContributionId:contribution.id,expectedContribution:contribution},gateway)
    expect(beforeDice).toMatchObject({count:1,rollerCharacterId:'first'});expect(beforeDice.rollRequestId).toMatch(/^bountiful-ready-extra-d20:[a-f0-9]{64}$/)
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
  const issued=mintedFrames[0];if(!issued)throw Error('Actual Host ready issuer emission required')
  const http=await bountifulReadyHttpFixture()
  try{
   const candidate={...before.combat,bountifulReadyParents:{[issued.id]:issued}}
   expect((await http.state('PUT','combat',candidate,before,'host')).status).toBe(409)
   expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:issued},before,'host')).status).toBe(403)
   const request={mapId:'map',combatId:'old-combat',requestId:issued.rawIssuer.rollId,rollerTokenId:'first-token',targetCharacterId:'first',kind:'d20',count:1,sides:20,values:[],rollKind:'saving-throw',delivery:'player-roll-request',sourceMode:'dm',eventId:'ready-scene-request',updatedAt:1}
   expect((await http.event('dice-roll-request-dm-to-player',request,before,'host')).status).toBe(200)
   const raw={...request,delivery:'player-roll-result',sourceMode:'player',values:[20],eventId:'ready-scene-result'}
   expect((await http.event('dice-roll-request-player-to-dm',raw,before,'second-member')).status).toBe(403)
   expect((await http.event('dice-roll-request-player-to-dm',raw,before,'host')).status).toBe(403)
   expect((await http.event('dice-roll-request-player-to-dm',raw,before,'first-member')).status).toBe(200)
   const stale=structuredClone(before);stale.combat={...stale.combat,round:10}
   expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:issued},stale,'host')).status).toBe(403)
   expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:issued},before,'host')).status).toBe(200)
   expect((await http.state('PUT','combat',candidate,stale,'host')).status).toBe(409)
   expect((await http.state('PUT','combat',candidate,before,'host')).status).toBe(200)
  }finally{await http.close()}

  expect(stage.retainedDice).toEqual([1]);expect(stage.originalReady.originalRolls).toEqual([20]);expect(stage.receipts).toEqual([])
  expect(stage.previewState.combatants['first-token'].classResources['test.pre-ready:uses'].current).toBe(0)
  expect(data.characters).toEqual(before.characters);expect(data.maps).toEqual(before.maps)
  const resolved=await resolveBountifulReadyForNormalAck({action,frameId:id,options:{combatRevision:data.combat._sync.revision,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[]}},gateway)
  expect(resolved.result.ok).toBe(true)
  if(!resolved.application)throw Error('Actual native spell application required')
  expect(resolved.application.characters.find(row=>row.id==='first')?.currentHp).toBe(26)
  expect(resolved.application.characters.find(row=>row.id==='first')?.classResources?.['test.pre-ready:uses'].current).toBe(0)
  expect(data.characters).toEqual(before.characters);expect(data.maps).toEqual(before.maps)
  const notifications:string[]=[]
  const ackInput:PublishPlayerActionAckInput={
   ack:{id:'ack:parent',actionId:'parent',mapId:'map',recipientMemberId:'caster-member',status:'accepted',round:1,initiativeIndex:0,updatedAt:2},
   snapshots:{characters:resolved.application.characters,maps:[resolved.application.map],updatedAt:2,combat:{mapId:'old-map',combatId:'old-combat',active:false,round:9,initiativeIndex:0,initiativeOrder:[],updatedAt:2}},
   processed:{mapId:'map',combatId:'combat',actionIds:['parent'],updatedAt:2},expectedRevisions:{'player-action-ack':0,'player-action-processed':0},
   saveSharedResource:async()=>{throw Error('No independent resource write permitted')},
   commitSharedResources:async(batch,options)=>{await gateway.saveResourcesAtomically(batch,options);return{}},
   loadSharedResource:gateway.loadResource,publishAck:async ack=>{notifications.push(ack.id)},
  }
  await expect(publishBountifulReadyThroughNormalAck(structuredClone(action),ackInput,gateway)).rejects.toThrow('issued-native-result-required')
  expect(writes.filter(row=>row.includes('characters'))).toHaveLength(0)
  await publishBountifulReadyThroughNormalAck(action,ackInput,gateway)
  expect(writes.filter(row=>row.includes('characters'))).toEqual([['characters','maps','combat','player-action-processed','player-action-ack']])
  const current=data.characters.characters as typeof characters
  expect(current.find(row=>row.id==='first')?.currentHp).toBe(26)
  expect(current.find(row=>row.id==='first')?.classResources?.['test.pre-ready:uses'].current).toBe(0)
  expect(data.combat.dnd5eTurnEconomyByToken).toBeUndefined()
  expect(data.combat).toMatchObject({mapId:'old-map',combatId:'old-combat',active:false,round:9})
  expect(current.find(row=>row.id==='first')?.dnd5eCombatState?.sceneReactionSpent).toBeUndefined()
  const newMap={...map,id:'new-map'};const moved=createDnd5eMapCombatSnapshot({map:newMap,characters:current,combatId:'map-new-map',round:1,initiativeOrder:authority.initiativeOrder});expect(moved.state.combatants['first-token'].turn.reactionAvailable).toBe(true)
  expect(data.combat.bountifulOriginalParents).toBeUndefined()
  expect((data.combat.bountifulReadyParents as Record<string,{consumed?:{transactionId:string}}>)[id].consumed?.transactionId).toBe('parent')
  const finalCount=writes.length
  await publishBountifulReadyThroughNormalAck(structuredClone(action),ackInput,gateway)
  expect(writes.length).toBe(finalCount)
 }finally{disposeLatest();dispose()}
})
