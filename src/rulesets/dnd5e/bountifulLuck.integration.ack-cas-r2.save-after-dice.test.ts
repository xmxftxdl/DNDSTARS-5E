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
import {recordBountifulOriginalAfterDice,resolveBountifulOriginalForNormalAck,publishBountifulOriginalThroughNormalAck} from './bountifulLuckNormalAck'
import {readBountifulAfterDiceSource,type BountifulContinuationReceipt} from './bountifulLuckAfterDice'
import {createDnd5eTurnEconomyCounts,spendDnd5eTurnResource} from './turnEconomy'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

it('persists damage after a mandatory new low save result, then commits a real target saving throw in its spell parent with the bountiful reaction through one ordinary ACK',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent)
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const make=(id:string,feat:boolean)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:'半身人',dnd5eRaceId:'halfling',charClass:'战士',level:4,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},currentHp:30,maxHp:30,dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const caster=normalizeCharacter({...make('caster',false),race:'人类',dnd5eRaceId:'human',charClass:'牧师',equipment:{},dnd5eClassLevels:{cleric:4},abilities:{str:10,dex:14,con:14,int:10,wis:18,cha:10},dnd5eClassChoices:{classes:{cleric:{selections:{'spell-cantrips':['sacred-flame']}}}}});
  const characters=[caster,make('ally',false),make('first',true),make('second',true)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,index)=>({id:c.id+'-token',characterId:c.id,type:index===0?'enemy':'player',label:c.name,x:25+50*index,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'caster-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'ally-token',dnd5eSpellCast:{spellId:'sacred-flame',castingClassId:'cleric',slotLevel:0,targetTokenId:'ally-token'},round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  if(!prepared.ok)throw Error(prepared.reason)
  type Resource={_sync:{revision:number};[key:string]:unknown}
  let data:Record<string,Resource>={combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0},characters:{_sync:{revision:2},characters},maps:{_sync:{revision:3},maps:[map]},'player-action-requests':{_sync:{revision:4},requests:[action]}}
  data['player-action-ack']={_sync:{revision:0},id:''}
  data['player-action-processed']={_sync:{revision:0},actionIds:[]}
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]._sync.revision);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);const next=structuredClone(data);for(const write of batch)next[write.name]={...write.data as object,_sync:{revision:data[write.name]._sync.revision+1}};data=next;writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const source={prepared:prepared.prepared,savingThrowD20:1,effectRolls:[]}
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
   showChoice:async receipt=>{const next=nextBountifulOriginalDieOwner(receipt);if(!next)throw Error('No real owner');sequence.push(next.ownerId+':'+receipt.request.dieIndex);const control=receipt.controllers[next.ownerId];append(receipt,next.ownerId,control.characterId,control.memberId,{phase:'reaction',...next,decision:next.ownerId==='second-token'?'use':'decline'})},
   requestRoll:async(receipt,refresh)=>{rolls.push(receipt.identity.roller.tokenId+':'+receipt.request.dieIndex);const roller=receipt.identity.roller,id=bountifulOriginalDieRollId(receipt),value=2;append(receipt,roller.tokenId,requireCharacterRoller(roller),roller.memberId,{phase:'roll',rollRequestId:id,value});const fresh=await refresh();expect(fresh.rawReroll?.memberId).toBe('ally-member');append(fresh,roller.tokenId,requireCharacterRoller(roller),'host',{phase:'confirm',rollRequestId:id,rawValue:value,value})}
  })
  expect(sequence).toEqual(['first-token:0','second-token:0'])
  expect(rolls).toEqual(['ally-token:0'])
  expect(stage.request).toMatchObject({originalRolls:[1],values:[2]})
  expect(stage.receipts).toHaveLength(1)
  expect(data.characters).toEqual(untouched)
  expect(writes.every(names=>names.length<3)).toBe(true)

  const finalSource={...source,effectRolls:[4]}
  const late={action,source:finalSource,resolve:resolvePreparedDnd5eSpellCast,authorityUnchanged:()=>true}
  const countBefore=writes.length
  await expect(recordBountifulOriginalAfterDice({...late,source:{...finalSource,savingThrowD20:20}},gateway)).rejects.toThrow('changed-original-input')
  await recordBountifulOriginalAfterDice(late,gateway)
  await recordBountifulOriginalAfterDice(late,gateway)
  expect(writes).toHaveLength(countBefore+1)
  await expect(recordBountifulOriginalAfterDice({...late,source:{...finalSource,effectRolls:[5]}},gateway)).rejects.toThrow('already-confirmed')
  const stored=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulContinuationReceipt>)[0]
  expect(await readBountifulAfterDiceSource(structuredClone(stored))).toEqual(finalSource)
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
  const parents=Object.values(data.combat.bountifulOriginalParents as Record<string,BountifulOriginalDieReceipt>)
  expect(parents).toHaveLength(1);expect(parents.every(row=>row.consumed?.transactionId==='parent')).toBe(true)
  expect((data['player-action-processed'].actionIds as string[])).toEqual(['parent'])
  expect(data['player-action-ack'].actionId).toBe('parent')
  expect((data.characters.characters as typeof characters).find(c=>c.id==='ally')?.currentHp).toBe(26)
  expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'ally-token',success:false}))
  // A repeated/reloaded ACK observes the durable consumed parent; no extra CAS.
  await publishBountifulOriginalThroughNormalAck(structuredClone(action),ackInput,gateway)
  expect(writes.filter(names=>names.includes('characters'))).toHaveLength(1)
  expect(notifications).toEqual(['ack:parent','ack:parent'])
 }finally{dispose()}
})

function requireCharacterRoller(roller:{characterId?:string}){if(!roller.characterId)throw Error("This Character-only fixture requires its actual Character roller");return roller.characterId}
