import{it,expect,vi}from'vitest'
import{normalizeCharacter}from'../../store/characters'
import{prepareDnd5eClassFeature,resolvePreparedDnd5eClassFeature}from'./classFeatureAction'
import{prepareDnd5eLocalContentJson}from'./localContentCollection'
import{registerDnd5eRulesPlugin}from'./pluginApi'
import{dnd5eRulesPluginFromContentPackageV2}from'./contentPackageV2'
import{bountifulLuckTestContent}from'./bountifulLuckTestContent'
import{persistBountifulOriginalParent}from'./bountifulLuckPersistentHost'
import{captureBountifulOriginalRawIssuer}from'./bountifulOriginalRawIssuer'
import{durableD20RollId}from'../../lib/rollConfirmation'
import{bountifulReadyHttpFixture}from'./bountifulLuck.ready-authority.testSupport'
import type{BattleMap}from'../../store/maps'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it('issues a true Berserker class feature target original1 from its actual prepared native facade',async()=>{
 const{package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)),http=await bountifulReadyHttpFixture()
 try{
 const caster=normalizeCharacter({id:'caster',name:'Berserker',charClass:'野蛮人',level:10,dnd5eClassLevels:{barbarian:10},dnd5eClassChoices:{classes:{barbarian:{subclass:'berserker'}}},race:'人类',roomMemberId:'caster-member',abilities:{str:16,dex:14,con:14,int:10,wis:14,cha:16},currentHp:80,maxHp:80}),helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30}),characters=[caster,helper]
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'caster-token',characterId:'caster',label:'Berserker',x:25,y:25,size:1,type:'enemy',color:'',emoji:''},{id:'pool',poolId:'srd-5.1:skeleton',label:'Ally skeleton',x:75,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:125,y:25,size:1,type:'player',color:'',emoji:''}]}
 const action:SharedPlayerActionState={id:'true-class-parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'dnd5e-class-feature',actorTokenId:'caster-token',characterId:'caster',roomMemberId:'caster-member',dnd5eClassFeature:{feature:'barbarian-intimidating-presence',targetTokenId:'pool'},round:1,initiativeIndex:0,seq:1,updatedAt:1},initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))
 const prepared=prepareDnd5eClassFeature({action,map,characters,initiativeOrder});if(!prepared.ok)throw Error(prepared.reason)
 expect(prepared.prepared.intimidatingPresence).toMatchObject({extending:false})
 type Resource={_sync:{schemaVersion?:1;revision:number;writerId?:string;writtenAt?:number};[key:string]:unknown};const data:Record<string,Resource>={characters:{_sync:{schemaVersion:1,revision:1,writerId:'host',writtenAt:1},characters},maps:{_sync:{schemaVersion:1,revision:1,writerId:'host',writtenAt:1},maps:[map]},combat:{_sync:{schemaVersion:1,revision:1,writerId:'host',writtenAt:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder},'player-action-requests':{_sync:{schemaVersion:1,revision:1,writerId:'host',writtenAt:1},requests:[action]}}
 const append=await http.append(action,data,'caster-member');expect(append.status).toBe(200);data['player-action-requests']=append.queue as Resource
 let minted=0;const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,publishEvent:async(channel,payload)=>{const response=await http.event(channel,payload,data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200);minted++},saveResourcesAtomically:async(batch,options)=>{const response=await http.state('POST','transaction',{...options,writes:batch},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200);for(const write of batch)data[write.name]={...write.data as object,_sync:{schemaVersion:1,revision:(data[write.name]?._sync.revision??0)+1,writerId:'host',writtenAt:1}};return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
 const source={prepared:prepared.prepared,savingThrowD20:1,hostOriginalRollActorId:'pool',hostOriginalRollKind:'saving-throw' as const,...captureBountifulOriginalRawIssuer({mapId:'map',parentId:action.id,mode:'dm',rollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:action.id,occurrenceIndex:0}),cursor:1,raw:[1]})}
 const receipt=await persistBountifulOriginalParent({parentId:action.id,source,resolve:resolvePreparedDnd5eClassFeature,actorId:'pool',kind:'saving-throw'},gateway)
 expect(receipt.request).toMatchObject({actorId:'pool',kind:'saving-throw',originalRolls:[1]});expect(receipt.identity.roller).toEqual({kind:'host-token',tokenId:'pool',memberId:'host'});expect(minted).toBe(1)
 }finally{await http.close();dispose()}
})
