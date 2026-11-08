import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {dnd5eOriginalD20ParentProbeActive} from './allyNaturalOneCheckpoint'
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
import {persistBountifulOriginalParent} from './bountifulLuckPersistentHost'
import {driveBountifulOriginalParent,BountifulOriginalParentPending} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId,nextBountifulOriginalDieOwner,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

it('reaches the real first ally save before a second ally raw die exists in the Acid Splash parent',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent)
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const make=(id:string,feat:boolean)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:'半身人',dnd5eRaceId:'halfling',charClass:'战士',level:4,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},currentHp:30,maxHp:30,dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster',false),race:'人类',dnd5eRaceId:'human',charClass:'术士',equipment:{},dnd5eClassLevels:{sorcerer:4},abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:18},dnd5eClassChoices:{classes:{sorcerer:{selections:{'spell-cantrips':['acid-splash']}}}}});
  const characters=[caster,make('ally',false),make('first',true),make('second',true),make('other',false)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,index)=>({id:c.id+'-token',characterId:c.id,type:index===0?'enemy':'player',label:c.name,x:index===4?125:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'caster-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'ally-token',targetTokenIds:['ally-token','other-token'],dnd5eSpellCast:{spellId:'acid-splash',castingClassId:'sorcerer',slotLevel:0,targetTokenId:'ally-token',targetTokenIds:['ally-token','other-token']},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  if(!prepared.ok)throw Error(prepared.reason)
  expect(prepared.prepared.targetTokens.map(row=>row.id)).toEqual(['ally-token','other-token'])
  type Resource={_sync:{revision:number};[key:string]:unknown}
  let data:Record<string,Resource>={combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0},characters:{_sync:{revision:2},characters},maps:{_sync:{revision:3},maps:[map]},'player-action-requests':{_sync:{revision:4},requests:[action]}}
  data['player-action-ack']={_sync:{revision:0},id:''}
  data['player-action-processed']={_sync:{revision:0},actionIds:[]}
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]._sync.revision);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);const next=structuredClone(data);for(const write of batch)next[write.name]={...write.data as object,_sync:{revision:data[write.name]._sync.revision+1}};data=next;writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const source={prepared:prepared.prepared,targetSavingThrows:[{targetId:'ally-token',d20:1}],effectRolls:[4]}
  const normal=resolvePreparedDnd5eSpellCast(source)
  expect(normal.result.ok).toBe(false);if(normal.result.ok)throw Error('Incomplete final parent unexpectedly succeeded')
  expect(normal.result.reason).toBe('invalid-dice');expect(normal.application).toBeUndefined()
  for(const invalid of[
    [{targetId:'ally-token',d20:1},{targetId:'ally-token',d20:1}],
    [{targetId:'ally-token',d20:1},{targetId:'first-token',d20:1}],
  ]){
   const probe=createDnd5eOriginalD20Session({...source,targetSavingThrows:invalid},resolvePreparedDnd5eSpellCast,'ally-token','saving-throw')
   try{const rejected=probe.run(source.prepared.state);expect(rejected.status).toBe('resolved');if(rejected.status!=='resolved')throw Error('Forged raw list reached a checkpoint');expect(rejected.result.result.ok).toBe(false)}finally{probe.cancel()}
  }
  expect(dnd5eOriginalD20ParentProbeActive()).toBe(false)

  await persistBountifulOriginalParent({parentId:'parent',source,resolve:resolvePreparedDnd5eSpellCast,actorId:'ally-token',kind:'saving-throw'},gateway)
  const untouched=structuredClone(data.characters),sequence:string[]=[],rolls:string[]=[]
  const append=(receipt:BountifulOriginalDieReceipt,actorTokenId:string,characterId:string,memberId:string,command:object)=>{
   const rows=data['player-action-requests'].requests as object[]
   data['player-action-requests'].requests=[...rows,{id:'response-'+rows.length,roomMemberId:memberId,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:'map',combatId:'combat',actorTokenId,characterId,bountifulLuck:{parentId:'parent',occurrence:receipt.identity.occurrence,command}}]
  }
  // A closed or unanswered UI does not manufacture a decline or any cost.
  await expect(driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  expect(data.characters).toEqual(untouched)
  const stage=await driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{
   showChoice:async receipt=>{const next=nextBountifulOriginalDieOwner(receipt);if(!next)throw Error('No real owner');sequence.push(next.ownerId+':'+receipt.request.dieIndex);const control=receipt.controllers[next.ownerId];append(receipt,next.ownerId,control.characterId,control.memberId,{phase:'reaction',...next,decision:next.ownerId===(receipt.request.actorId==='ally-token'?'first-token':'second-token')?'use':'decline'})},
   requestRoll:async(receipt,refresh)=>{rolls.push(receipt.identity.roller.tokenId+':'+receipt.request.dieIndex);const roller=receipt.identity.roller,id=bountifulOriginalDieRollId(receipt),value=15;append(receipt,roller.tokenId,requireCharacterRoller(roller),roller.memberId,{phase:'roll',rollRequestId:id,value});const fresh=await refresh();expect(fresh.rawReroll?.memberId).toBe(roller.memberId);append(fresh,roller.tokenId,requireCharacterRoller(roller),'host',{phase:'confirm',rollRequestId:id,rawValue:value,value})}
  })
  expect(stage.request.actorId).toBe('ally-token')
  expect(stage.request.values).toEqual([15])
  expect(stage.receipts.map(row=>row.identity.roller.tokenId)).toEqual(['ally-token'])
  expect(sequence).toEqual(['first-token:0'])
  expect(rolls).toEqual(['ally-token:0'])
  expect(data.characters).toEqual(untouched)
  expect(dnd5eOriginalD20ParentProbeActive()).toBe(false)
  const strictAgain=resolvePreparedDnd5eSpellCast(source);expect(strictAgain.result.ok).toBe(false);expect(strictAgain.application).toBeUndefined()
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(0)
 }finally{dispose()}
})

function requireCharacterRoller(roller:{characterId?:string}){if(!roller.characterId)throw Error("This Character-only fixture requires its actual Character roller");return roller.characterId}
