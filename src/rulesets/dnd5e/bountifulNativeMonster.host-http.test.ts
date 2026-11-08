import {persistBountifulHostOperation,recoverBountifulHostOperation,processBountifulHostOperationChoice,recordBountifulHostMonsterDamage,readBountifulHostMonsterOriginalReady} from './bountifulHostOperationPersistent'
import {publishBountifulHostMonsterOperation} from './bountifulHostOperationPublish'
import {submitBountifulHostTokenResponse} from './bountifulHostTokenResponse'
import {bountifulOriginalDieRollId} from './bountifulLuckReceipt'
import {bountifulReadyHttpFixture} from './bountifulLuck.ready-authority.testSupport'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import{it,expect,vi}from'vitest'
import{normalizeCharacter}from'../../store/characters'
import{prepareDnd5eLocalContentJson}from'./localContentCollection'
import{registerDnd5eRulesPlugin}from'./pluginApi'
import{dnd5eRulesPluginFromContentPackageV2}from'./contentPackageV2'
import{bountifulLuckTestContent}from'./bountifulLuckTestContent'
import{prepareDnd5eMonsterAttack,resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{getDnd5eSrdMonster}from'./monsters'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{captureBountifulMonsterOriginalOperation,bountifulIssuedHostOperation}from'./bountifulHostOperation'
import{durableD20RollId}from'../../lib/rollConfirmation'
import type{BattleMap}from'../../store/maps'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

it.each([{decision:'use',replacement:15},{decision:'use',replacement:1},{decision:'decline',replacement:15}] as const)('persists and reloads a true Host monster original, authenticated owner %s and final native CAS',async({decision,replacement})=>{
 const{package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30}),characters=[helper]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'skeleton',poolId:'srd-5.1:skeleton',label:'Allied skeleton',x:25,y:25,size:1,type:'enemy',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'goblin',poolId:'srd-5.1:goblin',label:'Goblin',x:75,y:25,size:1,type:'enemy',hp:20,maxHp:20,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:75,size:1,type:'player',color:'',emoji:''}]}
  const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),monster=getDnd5eSrdMonster('srd-5.1:skeleton')
  if(!monster)throw Error('Actual SRD skeleton required')
  const prepared=prepareDnd5eMonsterAttack({combatId:'combat',round:1,map,characters,initiativeOrder,actorTokenId:'skeleton',targetTokenId:'goblin',actionIndex:monster.actions.findIndex(action=>action.attack?.mode==='melee')})
  if(!prepared.ok)throw Error(prepared.reason)
  const source={prepared:prepared.prepared,transactionId:'host-monster-attack',rolls:[{d20:1,damageRolls:[]}]}
  const session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eMonsterAttack,'skeleton','attack')
  try{const pending=session.run(prepared.prepared.state);expect(pending.status).toBe('pending-ally-natural-one');if(pending.status!=='pending-ally-natural-one')throw Error('Actual native original one required');expect(pending.request).toMatchObject({actorId:'skeleton',originalRolls:[1],options:[{ownerId:'helper-token'}]})}finally{session.cancel()}
  const capability=captureBountifulMonsterOriginalOperation({parentId:source.transactionId,source,rawRollId:durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:source.transactionId,occurrenceIndex:0}),rawCursor:1})
  if(!capability)throw Error('Actual native Host original boundary required')
  const http=await bountifulReadyHttpFixture()
  type Resource={_sync:{revision:number};[key:string]:unknown}
  const data:Record<string,Resource>={characters:{_sync:{revision:1},characters},maps:{_sync:{revision:1},maps:[map]},combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder},'player-action-requests':{_sync:{revision:1},requests:[]}}
  for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1})
  const transactions:string[]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,publishEvent:async(channel,payload)=>{const response=await http.event(channel,payload,data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200)},saveResourcesAtomically:async(writes,options)=>{
   const response=await http.state('POST','transaction',{...options,writes},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200)
   for(const write of writes)data[write.name]={...write.data as object,_sync:{...data[write.name]?._sync,revision:response.payload.revisions?.[write.name]??((data[write.name]?._sync.revision??0)+1)}}
   data.combat=response.saved;transactions.push(options?.transactionId??'')
   return{status:'committed',transactionId:options?.transactionId??'',revisions:response.payload.revisions??{}}
  }}
  try{
   const receipt=await persistBountifulHostOperation(capability,gateway),id=JSON.stringify(['bountiful-original-parent',source.transactionId,0])
   expect(receipt.originalRoomAction.kind).toBe('native-host-operation')
   expect(receipt.identity.roller).toEqual({kind:'host-token',tokenId:'skeleton',memberId:'host'})
   expect(transactions).toHaveLength(1)
   await expect(recordBountifulHostMonsterDamage(source.transactionId,[[[1]]],gateway)).rejects.toThrow('decision-still-pending')
   expect(transactions).toHaveLength(1)
   expect(data['player-action-requests'].requests).toEqual([])
   const reloaded=await http.state('GET','combat',null,data,'host')
   expect(reloaded.saved.bountifulOriginalParents[id]).toEqual(receipt)
   expect((await http.event('bountiful-original-mint-dm-to-host',{id,receipt},data,'helper-member')).status).toBe(403)
   const forged=structuredClone(receipt);forged.originalRoomAction={...forged.originalRoomAction,actorTokenId:'helper-token'}
   expect((await http.event('bountiful-original-mint-dm-to-host',{id,receipt:forged},data,'host')).status).toBe(403)
   const changed=structuredClone(receipt);changed.request.originalRolls=[20]
   expect((await http.state('PUT','combat',{...data.combat,bountifulOriginalParents:{[id]:changed}},data,'host')).status).toBe(422)
   expect(map.tokens.find(token=>token.id==='goblin')?.hp).toBe(20)
   const recovered=await recoverBountifulHostOperation(source.transactionId,gateway)
   expect(bountifulIssuedHostOperation(recovered).operation).toEqual(receipt.originalRoomAction)
   const option=receipt.request.options[0]
   const choice={id:'helper-choice',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'dnd5e-bountiful-luck',actorTokenId:'helper-token',characterId:'helper',roomMemberId:'helper-member',round:1,initiativeIndex:0,seq:1,updatedAt:1,bountifulLuck:{parentId:source.transactionId,occurrence:0,command:{phase:'reaction',...option,decision}}}
   const appended=await http.append(choice,data,'helper-member')
   expect(appended.status,JSON.stringify(appended.payload)).toBe(200);data['player-action-requests']=appended.queue
   const chosen=await processBountifulHostOperationChoice(choice.id,gateway)
   expect(chosen.ownerDecisions).toMatchObject([{ownerId:'helper-token',decision,memberId:'helper-member'}])
   if(decision==='use'){
   const rollRequestId=bountifulOriginalDieRollId(chosen)
   const raw=await submitBountifulHostTokenResponse({mapId:'map',parentId:source.transactionId,occurrence:0,command:{phase:'roll',rollRequestId,value:replacement}},gateway)
   expect(raw.rawReroll?.value).toBe(replacement)
   const confirmed=await submitBountifulHostTokenResponse({mapId:'map',parentId:source.transactionId,occurrence:0,command:{phase:'confirm',rollRequestId,rawValue:replacement,value:replacement}},gateway)
   expect(confirmed.hostReroll?.value).toBe(replacement)
   const saved=await http.state('GET','combat',null,data,'host')
   expect(saved.saved.bountifulOriginalParents[id]).toEqual(confirmed)
   }
   await recoverBountifulHostOperation(source.transactionId,gateway)
   expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='goblin')?.hp).toBe(20)
   const preDamage=await readBountifulHostMonsterOriginalReady(source.transactionId,gateway);expect(preDamage.request.values).toEqual([decision==='use'?replacement:1]);expect(preDamage.snapshot.combatants.goblin.currentHp).toBe(20)
   if(decision==='use'&&replacement!==1){const dice=[prepared.prepared.attacks[0].attack.damage.map(group=>Array(group.count).fill(1))];await recordBountifulHostMonsterDamage(source.transactionId,dice,gateway);await recoverBountifulHostOperation(source.transactionId,gateway,{includeDamage:true});const count=transactions.length;await recordBountifulHostMonsterDamage(source.transactionId,dice,gateway);expect(transactions).toHaveLength(count);await expect(recordBountifulHostMonsterDamage(source.transactionId,[[[2]]],gateway)).rejects.toThrow('damage-already-confirmed')}
   const options={combatRevision:data.combat._sync.revision,authorityUnchanged:()=>true,confirm:async()=>{throw Error('Unexpected trigger choice')},roll:async()=>{throw Error('Unexpected trigger roll')}}
   expect((await publishBountifulHostMonsterOperation(source.transactionId,options,gateway)).status).toBe('committed')
   expect((data.maps.maps as BattleMap[])[0].tokens.find(token=>token.id==='goblin')?.hp).toBe(decision==='use'&&replacement===15?17:20)
   const done=await http.state('GET','combat',null,data,'host')
   expect(done.saved.bountifulOriginalParents[id].consumed.transactionId).toBe(source.transactionId)
   expect(done.saved.dnd5eTurnEconomyByToken['helper-token'].reaction.current).toBe(decision==='use'?0:1)
   expect(done.saved.dnd5eTurnEconomyByToken.skeleton.action.current).toBe(0)
   const transactionCount=transactions.length
   expect((await publishBountifulHostMonsterOperation(source.transactionId,options,gateway)).status).toBe('already-committed')
   expect(transactions).toHaveLength(transactionCount)
  }finally{await http.close()}
 }finally{dispose()}
})
