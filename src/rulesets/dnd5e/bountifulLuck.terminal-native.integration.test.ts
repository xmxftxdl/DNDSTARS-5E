import {bountifulReadyHttpFixture} from './bountifulLuck.ready-authority.testSupport'
import {resolveBountifulReadyForNormalAck,publishBountifulReadyThroughNormalAck} from './bountifulReadyNormalAck'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
import type {BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {dnd5eSpellAuthorityResolutionContext} from '../../pages/maps/spellSettlementCoordinator'
import {continueBountifulSpellOriginalSave} from './bountifulSpellOriginalD20Flow'
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
it('retires only genuinely completed native parents and still resolves the 100th same-scene original action once',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 const disposeLatest=registerDnd5eRulesPlugin({manifest:{id:'test.pre-ready',name:'Actual must-use-latest fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0-1.0'},setup(api){api.registerFeat({id:'latest',name:'Latest result',summary:'Latest result',description:'Declared data-only saving throw reroll',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'long-rest'}],declarativeAbility:{schemaVersion:1,id:'latest',name:'Latest result',description:'Use the new result',level:1,trigger:{kind:'after-d20-roll'},targeting:{kind:'self'},effects:[],automation:'full',cost:{economy:'none',resources:[{resourceId:'uses',amount:1}]},mechanic:{kind:'d20-choice-reroll',rollKinds:['saving-throw'],scopes:['self-roll'],additionalDice:1,selection:'must-use-latest'}}})}})
 try{
  const make=(id:string,feat=false)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:feat?'半身人':'人类',dnd5eRaceId:feat?'halfling':'human',charClass:'战士',level:4,currentHp:30,maxHp:30,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster'),charClass:'术士',equipment:{},dnd5eClassLevels:{sorcerer:4},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:18},dnd5eClassChoices:{classes:{sorcerer:{selections:{'spell-cantrips':['acid-splash']}}}}}),first=make('first');first.dnd5eFeatIds=['test.pre-ready:latest'];first.classResources={...first.classResources,'test.pre-ready:uses':{current:1,max:1}}
  const characters=[caster,first,make('second'),make('helper',true)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((character,index)=>({id:character.id+'-token',characterId:character.id,type:index===0?'enemy':'player',label:character.name,x:index===2?125:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const pool=map.tokens.find(row=>row.id==='first-token')!;delete pool.characterId;pool.poolId='srd-5.1:skeleton';pool.hp=30;pool.maxHp=30;pool.dnd5eSide='player';characters.splice(characters.findIndex(row=>row.id==='first'),1);

  type Resource={_sync:{schemaVersion?:1;revision:number;writerId?:string;writtenAt?:number};[key:string]:unknown}
  const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},maps:[map]},combat:{_sync:{revision:1},active:false,mapId:'old-map',combatId:'old-combat',round:9,initiativeIndex:0},'player-action-requests':{_sync:{revision:1},requests:[]}}
  for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
  const http=await bountifulReadyHttpFixture();let finalCommits=0,failedOnce=false;let firstFrame:BountifulReadyParentData|undefined
  try{
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,publishEvent:async(channel,payload)=>{const actual=await http.event(channel,payload,data,'host');expect(actual.status,JSON.stringify(actual.payload)).toBe(200)},saveResourcesAtomically:async(batch,options)=>{
   const firstFinal=batch.some(row=>row.name==='player-action-ack')&&!failedOnce
   const submitted=firstFinal?batch.map(row=>row.name==='player-action-ack'?{...row,expectedRevision:999}:row):batch
   const response=await http.state('POST','transaction',{...options,writes:submitted},data,'host')
   if(firstFinal){failedOnce=true;expect(response.status).toBe(409);throw Error('intentional-state-transaction-conflict')}
   if(response.status!==200)console.info('TERMINAL HTTP',response.status,response.payload,options,batch.map(row=>row.name));expect(response.status).toBe(200)
   for(const write of batch)data[write.name]={...write.data as object,_sync:{schemaVersion:1,writerId:'host',writtenAt:1,revision:(data[write.name]?._sync.revision??0)+1}}
   if(batch.some(row=>row.name==='player-action-ack'))finalCommits++
   return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}
  }}
  for(let index=0;index<100;index++){
   const action:SharedPlayerActionState={id:'native-parent-'+index,mapId:'map',sourceMode:'player',status:'pending',roomMemberId:'caster-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'first-token',targetTokenIds:['first-token'],dnd5eSpellCast:{spellId:'acid-splash',castingClassId:'sorcerer',slotLevel:0,targetTokenId:'first-token',targetTokenIds:['first-token']},round:1,initiativeIndex:0,seq:index+1,updatedAt:index+1}
   const appended=await http.append(action,data,'caster-member');expect(appended.status).toBe(200);data['player-action-requests']=appended.queue as Resource
   const currentMap=(data.maps.maps as BattleMap[]).find(row=>row.id==='map')!,currentCharacters=data.characters.characters as typeof characters,authority=dnd5eSpellAuthorityResolutionContext({combatActive:false,map:currentMap,actorTokenId:action.actorTokenId,initiativeOrder:[]}),prepared=prepareDnd5eSpellCast({action,map:currentMap,characters:currentCharacters,initiativeOrder:authority.initiativeOrder});if(!prepared.ok)throw Error(prepared.reason)
   const raw=captureBountifulSpellTargetRaw({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:2}),cursor:3,raw:[20],actorId:'first-token'})
   const original={prepared:prepared.prepared,savingThrowD20:20,effectRolls:[],hostOriginalRollActorId:'first-token',hostOriginalRollKind:'saving-throw' as const,...captureBountifulOriginalRawIssuer({mapId:'map',parentId:action.id,mode:'dm',rollId:raw.hostOriginalRollId,cursor:3,raw:[20]}),hostOriginalSpellSavingThrows:[raw]}
   const stage=await continueBountifulSpellOriginalSave({action,source:original,actorId:'first-token',rollCursor:3,authorityUnchanged:()=>true},gateway,{original:{showChoice:async()=>{throw Error('No original1')},requestRoll:async()=>{throw Error('No original1')}},confirmSelfReroll:async request=>request.originalValue})
   if(!stage||!('hostOriginalReadyFrameId'in stage))throw Error('Actual ready frame required')
   expect(Object.keys(data.combat.bountifulReadyParents as object)).toHaveLength(1)
   const currentFrame=(data.combat.bountifulReadyParents as Record<string,BountifulReadyParentData>)[stage.hostOriginalReadyFrameId];if(index===0)firstFrame=structuredClone(currentFrame)
   if(index===0){const deleted={...data.combat,bountifulReadyParents:{}};expect((await http.state('PUT','combat',deleted,data,'host')).status).toBe(409)}
   const resolved=await resolveBountifulReadyForNormalAck({action,frameId:stage.hostOriginalReadyFrameId,options:{combatRevision:data.combat._sync.revision,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[]}},gateway);if(!resolved.result.ok||!resolved.application)throw Error('Actual native facade required')
   const ackInput:PublishPlayerActionAckInput={ack:{id:'ack:'+action.id,actionId:action.id,mapId:'map',recipientMemberId:'caster-member',status:'accepted',round:1,initiativeIndex:0,updatedAt:index+2},snapshots:{characters:resolved.application.characters,maps:[resolved.application.map],updatedAt:index+2,combat:{mapId:'old-map',combatId:'old-combat',active:false,round:9,initiativeIndex:0,initiativeOrder:[],updatedAt:index+2}},processed:{mapId:'map',actionIds:Array.from({length:index+1},(_,i)=>'native-parent-'+i),updatedAt:index+2},expectedRevisions:{'player-action-ack':data['player-action-ack']?._sync.revision??0,'player-action-processed':data['player-action-processed']?._sync.revision??0},saveSharedResource:async()=>{throw Error('No independent resource write')},commitSharedResources:async(batch,options)=>{await gateway.saveResourcesAtomically(batch,options);return{}},loadSharedResource:gateway.loadResource,publishAck:async()=>{}}
   if(index===0){await expect(publishBountifulReadyThroughNormalAck(action,ackInput,gateway)).rejects.toThrow('intentional-state-transaction-conflict');expect((await http.state('PUT','combat',{...data.combat,bountifulReadyParents:{}},data,'host')).status).toBe(409);const forged={...data.combat,bountifulReadyParents:{[currentFrame.id]:{...currentFrame,consumed:{transactionId:action.id}}}};expect((await http.state('PUT','combat',forged,data,'host')).status).toBe(409)}
   await publishBountifulReadyThroughNormalAck(action,ackInput,gateway)
   const count=finalCommits;await publishBountifulReadyThroughNormalAck(structuredClone(action),ackInput,gateway);expect(finalCommits).toBe(count)
  }
  expect(finalCommits).toBe(100);expect(data.combat).toMatchObject({active:false,mapId:'old-map',combatId:'old-combat',round:9});expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='first-token')?.hp).toBe(30)
  if(!firstFrame)throw Error('Actual first source required');expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:firstFrame},data,'host')).status).toBe(403)
  }finally{await http.close()}
 }finally{disposeLatest();dispose()}
})
