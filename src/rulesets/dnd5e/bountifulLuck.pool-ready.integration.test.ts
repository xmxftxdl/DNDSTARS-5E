import {validateBountifulReadyParents} from '../../../shared/bountiful-ready-parents.mjs'
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
it('keeps a real characterless ordinary20 native save source without inventing a Character',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 const disposeLatest=registerDnd5eRulesPlugin({manifest:{id:'test.pre-ready',name:'Actual must-use-latest fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0-1.0'},setup(api){api.registerFeat({id:'latest',name:'Latest result',summary:'Latest result',description:'Declared data-only saving throw reroll',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'long-rest'}],declarativeAbility:{schemaVersion:1,id:'latest',name:'Latest result',description:'Use the new result',level:1,trigger:{kind:'after-d20-roll'},targeting:{kind:'self'},effects:[],automation:'full',cost:{economy:'none',resources:[{resourceId:'uses',amount:1}]},mechanic:{kind:'d20-choice-reroll',rollKinds:['saving-throw'],scopes:['self-roll'],additionalDice:1,selection:'must-use-latest'}}})}})
 try{
  const make=(id:string,feat=false)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:feat?'半身人':'人类',dnd5eRaceId:feat?'halfling':'human',charClass:'战士',level:4,currentHp:30,maxHp:30,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster'),charClass:'术士',equipment:{},dnd5eClassLevels:{sorcerer:4},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:18},dnd5eClassChoices:{classes:{sorcerer:{selections:{'spell-cantrips':['acid-splash']}}}}}),first=make('first');first.dnd5eFeatIds=['test.pre-ready:latest'];first.classResources={...first.classResources,'test.pre-ready:uses':{current:1,max:1}}
  const characters=[caster,first,make('second'),make('helper',true)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((character,index)=>({id:character.id+'-token',characterId:character.id,type:index===0?'enemy':'player',label:character.name,x:index===2?125:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const pool=map.tokens.find(row=>row.id==='first-token')!;delete pool.characterId;pool.poolId='srd-5.1:skeleton';pool.hp=30;pool.maxHp=30;pool.dnd5eSide='player';characters.splice(characters.findIndex(row=>row.id==='first'),1);
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
  const stage=await continueBountifulSpellOriginalSave({action,source,actorId:'first-token',rollCursor:3,authorityUnchanged:()=>true},gateway,{original:{showChoice:async()=>{throw Error('No original1')},requestRoll:async()=>{throw Error('No original1')}},confirmSelfReroll:async request=>{expect(request.originalValue).toBe(20);return 20}})
  expect(stage?.retainedDice).toEqual([20]);expect(mintedFrames).toHaveLength(1);expect(mintedFrames[0].controller).toEqual({kind:'host-token',memberId:'host'});expect(mintedFrames[0].request.actorId).toBe('first-token');expect(data.characters).toMatchObject({characters});expect(data.combat.active).toBe(false)
 }finally{disposeLatest();dispose()}
})
