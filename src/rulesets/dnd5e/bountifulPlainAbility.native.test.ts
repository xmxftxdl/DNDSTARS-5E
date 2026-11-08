import{withAllyNaturalOneCheckpoints}from'./allyNaturalOneCheckpoint'
import{it,expect,vi}from'vitest'
import{buildMonsterZeroScene}from'./damageZeroMonsterOriginal.scene.fixture'
import{prepareDnd5eAbilityCheck,resolvePreparedDnd5eAbilityCheck}from'./abilityCheckAction'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{dnd5eHasBountifulOriginalReadySource,dnd5eBountifulOriginalReadyOwners}from'./headlessCombatEngine'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it.each([true,false])('true acquired Bounty helper is offered on actual %s skill flag original strength ability check1',async skill=>{
 const scene=await buildMonsterZeroScene()
 try{
  const original=scene.input.prepared,action:SharedPlayerActionState={id:'actual-native-strength-'+skill,mapId:original.map.id,combatId:original.state.combatId,sourceMode:'player',status:'pending',type:'dnd5e-ability-check',actorTokenId:'soul-token',characterId:'soul',roomMemberId:'first-member',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eAbilityCheck:{ability:'str',...(skill?{skill:'athletics'}:{}),dc:12,mode:'normal',spendAction:false}},prepared=prepareDnd5eAbilityCheck({action,map:original.map,characters:original.characters,initiativeOrder:scene.initiativeOrder})
  expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
  expect(dnd5eHasBountifulOriginalReadySource(prepared.prepared.state)).toBe(true)
  const owners=dnd5eBountifulOriginalReadyOwners(prepared.prepared.state,{actorId:'soul-token',kind:'ability-check',...(skill?{skill:'athletics'}:{})}),session=createDnd5eOriginalD20Session({prepared:prepared.prepared,d20:1},resolvePreparedDnd5eAbilityCheck,'soul-token','ability-check')
  try{const stage=session.run(prepared.prepared.state);console.info(JSON.stringify({skill,owners,status:stage.status,...(stage.status==='pending-ally-natural-one'?{request:stage.request}:{})}));expect(stage.status).toBe('pending-ally-natural-one');if(stage.status!=='pending-ally-natural-one')throw Error(stage.status);expect(stage.request.nativeLucky).not.toBe(true);expect(stage.request.options.some(option=>option.ownerId==='helper-token')).toBe(true);expect(stage.request.kind).toBe('ability-check');expect(stage.request.skill).toBe(skill?'athletics':undefined)}finally{session.cancel()}
 }finally{scene.dispose()}
},120000)

it('actual plain ability1 remains eligible even when already successful, and replacement1 is final before own Lucky',async()=>{
 const scene=await buildMonsterZeroScene()
 try{
  const old=scene.input.prepared,action:SharedPlayerActionState={id:'actual-no-skill-success-one',mapId:old.map.id,combatId:old.state.combatId,sourceMode:'player',status:'pending',type:'dnd5e-ability-check',actorTokenId:'soul-token',characterId:'soul',roomMemberId:'first-member',round:1,initiativeIndex:0,seq:2,updatedAt:1,dnd5eAbilityCheck:{ability:'str',dc:0,mode:'normal',spendAction:false}},prepared=prepareDnd5eAbilityCheck({action,map:old.map,characters:old.characters,initiativeOrder:scene.initiativeOrder})
  if(!prepared.ok)throw Error(prepared.reason)
  let offers=0
  const resolved=withAllyNaturalOneCheckpoints(request=>{offers++;expect(request.kind).toBe('ability-check');expect(request.skill).toBeUndefined();expect(request.nativeLucky).not.toBe(true);const option=request.options.find(option=>option.ownerId==='helper-token');if(!option)throw Error('Actual acquired nearby helper required');return{...option,replacement:1}},()=>resolvePreparedDnd5eAbilityCheck({prepared:prepared.prepared,d20:1}))
  expect(offers).toBe(1);expect(resolved.result.ok).toBe(true);expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',d20:1,success:true}));expect(resolved.result.events.some(event=>event.type==='halfling-lucky-rerolled')).toBe(false);expect(resolved.result.state.combatants['helper-token'].turn.reactionAvailable).toBe(false);expect(resolved.result.state.combatants['helper-token'].classState.activeEffects?.some(effect=>effect.tags?.includes('bountiful-luck:racial-lucky-suppressed'))).toBe(true)
 }finally{scene.dispose()}
},120000)
