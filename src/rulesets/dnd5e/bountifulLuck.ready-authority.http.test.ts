
import {bountifulReadyHttpFixture} from './bountifulLuck.ready-authority.testSupport'
import {captureBountifulSpellOriginalReadyFrame,persistBountifulSpellOriginalReadyFrame} from './bountifulOriginalReadyFrame'
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
it.each(['player','host'] as const)('authenticates first Ready mint, freezes raw and preserves omitted private fields for %s',async owner=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 const disposeLatest=registerDnd5eRulesPlugin({manifest:{id:'test.pre-ready',name:'Actual must-use-latest fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0-1.0'},setup(api){api.registerFeat({id:'latest',name:'Latest result',summary:'Latest result',description:'Declared data-only saving throw reroll',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'long-rest'}],declarativeAbility:{schemaVersion:1,id:'latest',name:'Latest result',description:'Use the new result',level:1,trigger:{kind:'after-d20-roll'},targeting:{kind:'self'},effects:[],automation:'full',cost:{economy:'none',resources:[{resourceId:'uses',amount:1}]},mechanic:{kind:'d20-choice-reroll',rollKinds:['saving-throw'],scopes:['self-roll'],additionalDice:1,selection:'must-use-latest'}}})}})
 try{
  const make=(id:string,feat=false)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:feat?'半身人':'人类',dnd5eRaceId:feat?'halfling':'human',charClass:'战士',level:4,currentHp:30,maxHp:30,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster'),charClass:'术士',equipment:{},dnd5eClassLevels:{sorcerer:4},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:18},dnd5eClassChoices:{classes:{sorcerer:{selections:{'spell-cantrips':['acid-splash']}}}}}),first=make('first');first.dnd5eFeatIds=['test.pre-ready:latest'];first.classResources={...first.classResources,'test.pre-ready:uses':{current:1,max:1}}
  first.roomMemberId=owner==='host'?'host':'first-member'
  const characters=[caster,first,make('second'),make('helper',true)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((character,index)=>({id:character.id+'-token',characterId:character.id,type:index===0?'enemy':'player',label:character.name,x:index===2?125:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'caster-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'first-token',targetTokenIds:['first-token','second-token'],dnd5eSpellCast:{spellId:'acid-splash',castingClassId:'sorcerer',slotLevel:0,targetTokenId:'first-token',targetTokenIds:['first-token','second-token']},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const firstRaw=captureBountifulSpellTargetRaw({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:2}),cursor:3,raw:[20],actorId:'first-token'})

  const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))});if(!prepared.ok)throw Error(prepared.reason)
  type Resource={_sync:{revision:number};[key:string]:unknown}
  const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},maps:[map]},combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0},'player-action-requests':{_sync:{revision:1},requests:[action]}}
  for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]?._sync.revision??0);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);for(const write of batch)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:(data[write.name]?._sync.revision??0)+1}};writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const secondRaw=captureBountifulSpellTargetRaw({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:6}),cursor:7,raw:[20],actorId:'second-token'})
  const source={prepared:prepared.prepared,targetSavingThrows:[{targetId:'first-token',d20:20},{targetId:'second-token',d20:20}],effectRolls:[4],hostOriginalRollActorId:'first-token',hostOriginalRollKind:'saving-throw' as const,...captureBountifulOriginalRawIssuer({mapId:'map',parentId:action.id,mode:'dm',rollId:firstRaw.hostOriginalRollId,cursor:3,raw:[20]}),hostOriginalSpellSavingThrows:[firstRaw,secondRaw]}
  const before=structuredClone(data)
  const frame=await captureBountifulSpellOriginalReadyFrame({action,source,actorId:'first-token',kind:'saving-throw'},gateway)
  if(!frame)throw Error('Actual native ready issuer required')
  await persistBountifulSpellOriginalReadyFrame(frame,gateway)
  const row=(data.combat.bountifulReadyParents as Record<string,import('./bountifulOriginalReadyFrame').BountifulReadyParentData>)[frame.id]
  const baseline=structuredClone(before)
  const candidate={...baseline.combat,bountifulReadyParents:{[frame.id]:row}}
  const http=await bountifulReadyHttpFixture()
  try{
   expect((await http.state('PUT','combat',candidate,baseline,'host')).status).toBe(409)
   expect((await http.state('POST','transaction',{transactionId:'forged-first-mint',writes:[{name:'combat',expectedRevision:baseline.combat._sync.revision,data:candidate}]},baseline,'host')).status).toBe(409)
   expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:row},baseline,'first-member')).status).toBe(403)
   expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:row},baseline,'spectator')).status).toBe(403)
   expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:{...row,controller:{characterId:'first',memberId:owner==='host'?'first-member':'host'}}},baseline,'host')).status).toBe(403)
   if(owner==='player'){
    expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:row},baseline,'host')).status).toBe(403)
    const request={mapId:'map',combatId:'combat',requestId:row.rawIssuer.rollId,rollerTokenId:'first-token',targetCharacterId:'first',kind:'d20',count:1,sides:20,values:[],rollKind:'saving-throw',delivery:'player-roll-request',sourceMode:'dm',eventId:'request',updatedAt:1}
    expect((await http.event('dice-roll-request-dm-to-player',request,baseline,'host')).status).toBe(200)
    const raw={...request,delivery:'player-roll-result',values:[20],sourceMode:'player',eventId:'result'}
    expect((await http.event('dice-roll-request-player-to-dm',{...raw,roomMemberId:'first-member'},baseline,'second-member')).status).toBe(403)
    expect((await http.event('dice-roll-request-player-to-dm',raw,baseline,'host')).status).toBe(403)
    expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:row},baseline,'host')).status).toBe(403)
    expect((await http.event('dice-roll-request-player-to-dm',raw,baseline,'first-member')).status).toBe(200)
    expect((await http.event('dice-roll-request-player-to-dm',{...raw,values:[19]},baseline,'first-member')).status).toBe(403)
   }
   expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:row},baseline,'host')).status).toBe(200)
   expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:row},baseline,'host')).status).toBe(200)
   const minted=await http.state('PUT','combat',candidate,baseline,'host')
   expect(minted.status).toBe(200)
   baseline.combat=minted.saved
   const omitted={...baseline.combat};delete omitted.bountifulReadyParents
   const retained=await http.state('PUT','combat',{...omitted,updatedAt:8},baseline,'host')
   expect(retained.status).toBe(200);expect(retained.saved.bountifulReadyParents).toEqual(candidate.bountifulReadyParents)
   baseline.combat=retained.saved
   const atomicOmitted={...baseline.combat};delete atomicOmitted.bountifulReadyParents
   const retainedAtomic=await http.state('POST','transaction',{transactionId:'ordinary-publication',writes:[{name:'combat',expectedRevision:baseline.combat._sync.revision,data:{...atomicOmitted,updatedAt:9}}]},baseline,'host')
   expect(retainedAtomic.status).toBe(200);expect(retainedAtomic.saved.bountifulReadyParents).toEqual(candidate.bountifulReadyParents)
   baseline.combat=retainedAtomic.saved
   const changed=structuredClone(row);changed.request.originalRolls=[19];changed.request.values=[19]
   const mutated={...baseline.combat,bountifulReadyParents:{[frame.id]:changed}}
   expect((await http.state('PUT','combat',mutated,baseline,'host')).status).toBe(409)
   expect((await http.state('PUT','combat',{...baseline.combat,bountifulReadyParents:{}},baseline,'host')).status).toBe(409)
   expect((await http.state('POST','transaction',{transactionId:'forged-raw',writes:[{name:'combat',expectedRevision:baseline.combat._sync.revision,data:mutated}]},baseline,'host')).status).toBe(409)
   expect((await http.event('bountiful-ready-mint-dm-to-host',{frame:changed},baseline,'host')).status).toBe(403)
   const current=await http.state('GET','combat',null,baseline,'host')
   expect(current.saved.bountifulReadyParents).toEqual(candidate.bountifulReadyParents)
  }finally{await http.close()}
 }finally{disposeLatest();dispose()}
})
