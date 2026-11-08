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
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import type{BattleMap}from'../../store/maps'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

it('pauses the real monster original after a confirmed replacement and before later damage dice exist',async()=>{
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
  expect(()=>bountifulIssuedHostOperation({version:1})).toThrow('private-issuer-required')
  const issued=bountifulIssuedHostOperation(capability)
  expect(issued.operation).toMatchObject({kind:'native-host-operation',parentId:'host-monster-attack',adapterId:'monster',actorTokenId:'skeleton'})
  expect(issued.source.prepared.action).toEqual(prepared.prepared.action)
  expect('characterId'in issued.operation).toBe(false)
  const request=issued.pending.request,option=request.options[0]
  const replay={parentId:issued.operation.parentId,sourceKey:originalD20ReplaySourceKey(issued.operation.parentId,issued.source.prepared.state,issued.operation),facts:[{occurrence:0,request,decision:{...option,replacement:15}}]}
  const next={...issued.source,hostOriginalD20Replay:replay}
  const actualSession=createDnd5eOriginalD20Session(next,resolvePreparedDnd5eMonsterAttack,'skeleton','attack')
  try{const ready=actualSession.run(next.prepared.state);expect(ready.status).toBe('original-d20-ready');if(ready.status!=='original-d20-ready')throw Error('Actual pre-damage monster ready required');expect(ready.request).toMatchObject({actorId:'skeleton',kind:'attack',originalRolls:[1],values:[15],finalizedDice:[0]});expect(ready.snapshot.combatants.goblin.currentHp).toBe(20);expect(ready.events.some(event=>event.type==='damage-applied')).toBe(false)}finally{actualSession.cancel()}
 }finally{dispose()}
})
