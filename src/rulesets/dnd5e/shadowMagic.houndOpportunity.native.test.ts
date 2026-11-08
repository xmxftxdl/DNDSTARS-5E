import {expect,it} from'vitest'
import {nativeSummonedHound} from'./shadowMagic.summonedHound.native.fixture'
import {findDnd5eOpportunityWindowsForMove,prepareDnd5eOpportunityAttack,resolvePreparedDnd5eOpportunityAttack} from'./opportunityAttackAction'
import {normalizeCharacter} from'../../store/characters'
import {restoreClassResources} from'../../lib/classResources'
import {resolveDnd5eHeadlessAction} from'./headlessCombatEngine'

const economy={turnKey:'actual-hound-opportunity:1',attacksUsed:0,action:{current:1,max:1},bonusAction:{current:1,max:1},reaction:{current:1,max:1},movement:{current:50,max:50}}
it('actual Hound OA window and preparation never offer another enemy, only its chosen creature',async()=>{
 const f=await nativeSummonedHound();try{
  const other=restoreClassResources(normalizeCharacter({id:'other',name:'Other enemy',charClass:'战士',level:1,dnd5eClassLevels:{fighter:1},abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10}}),'long-rest'),moving={id:'other-token',characterId:'other',label:'Other enemy',type:'enemy' as const,x:175,y:25,size:1,color:'',emoji:'',hp:other.currentHp,maxHp:other.maxHp},map={...f.map,tokens:[...f.map.tokens,moving]},characters=[...f.characters,other],order=map.tokens.map((token,i)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
  const windows=findDnd5eOpportunityWindowsForMove({map,characters,movingToken:moving,to:{x:225,y:25},turnEconomyByToken:{[f.houndId]:economy}})
  expect(windows.filter(window=>window.attacker.id===f.houndId)).toEqual([])
  expect(prepareDnd5eOpportunityAttack({combatId:'hound-wrong-oa',round:1,map,characters,initiativeOrder:order,actorTokenId:f.houndId,targetTokenId:moving.id,turnEconomy:economy}).ok).toBe(false)
 }finally{f.dispose()}
})

it('actual Hound chosen same-side body can provoke an OA; normal sight/reaction still apply',async()=>{
 const f=await nativeSummonedHound();try{
  const map={...f.map,tokens:f.map.tokens.map(token=>token.id==='foe-token'?{...token,type:'player' as const,dnd5eSide:'player' as const}:token)},target=map.tokens.find(token=>token.id==='foe-token')!,order=f.snapshot.state.initiativeOrder.map((id,i)=>({tokenId:id,label:id,roll:20-i,color:'',emoji:''}))
  const windows=findDnd5eOpportunityWindowsForMove({map,characters:f.characters,movingToken:target,to:{x:25,y:75},turnEconomyByToken:{[f.houndId]:economy}})
  expect(windows.some(window=>window.attacker.id===f.houndId)).toBe(true)
  const p=prepareDnd5eOpportunityAttack({combatId:'hound-chosen-ally-oa',round:1,map,characters:f.characters,initiativeOrder:order,actorTokenId:f.houndId,targetTokenId:target.id,turnEconomy:economy});expect(p.ok,JSON.stringify(p)).toBe(true);if(!p.ok)throw Error(p.reason)
  const used=resolvePreparedDnd5eOpportunityAttack({prepared:p.prepared,d20:18,...(p.prepared.attackMode!=='normal'?{d20Second:18}:{}),damageRolls:[1,1]});expect(used.result.ok,JSON.stringify(used.result)).toBe(true);expect(used.result.state.combatants[f.houndId].turn.reactionAvailable).toBe(false)
 }finally{f.dispose()}
})

it('actual Hound OA inherits DireWolf Pack Tactics from an existing nearby ally',async()=>{
 const f=await nativeSummonedHound();try{
  const order=f.snapshot.state.initiativeOrder.map((id,i)=>({tokenId:id,label:id,roll:20-i,color:'',emoji:''})),p=prepareDnd5eOpportunityAttack({combatId:'hound-pack-oa',round:1,map:f.map,characters:f.characters,initiativeOrder:order,actorTokenId:f.houndId,targetTokenId:'foe-token',turnEconomy:economy});expect(p.ok).toBe(true);if(!p.ok)throw Error(p.reason)
  expect(p.prepared.attackMode).toBe('advantage')
 }finally{f.dispose()}
})

it('actual Hound OA bite retains genuine DireWolf DC13 prone follow-up after its real final hit',async()=>{
 const f=await nativeSummonedHound();try{
  const order=f.snapshot.state.initiativeOrder.map((id,i)=>({tokenId:id,label:id,roll:20-i,color:'',emoji:''})),p=prepareDnd5eOpportunityAttack({combatId:'hound-bite-oa',round:1,map:f.map,characters:f.characters,initiativeOrder:order,actorTokenId:f.houndId,targetTokenId:'foe-token',turnEconomy:economy});expect(p.ok).toBe(true);if(!p.ok)throw Error(p.reason)
  const r=resolvePreparedDnd5eOpportunityAttack({prepared:p.prepared,d20:18,...(p.prepared.attackMode!=='normal'?{d20Second:18}:{}),damageRolls:[1,1]});expect(r.result.ok,JSON.stringify(r.result)).toBe(true);expect(r.result.state.combatants['foe-token'].currentHp).toBe(5)
  expect(r.result.events.find(event=>event.type==='monster-on-hit-save-required')).toMatchObject({sourceId:f.houndId,targetId:'foe-token',dc:13,condition:'prone'})
  for(const d20 of[18,1]){
   const saved=resolveDnd5eHeadlessAction(r.result.state,{type:'monster-on-hit-save',actorId:'foe-token',sourceId:f.houndId,actionId:'bite',d20});expect(saved.ok,JSON.stringify(saved)).toBe(true)
   expect(saved.state.combatants['foe-token'].classState.monsterOnHitSavePending).toBeUndefined()
   expect(saved.state.combatants['foe-token'].classState.activeEffects?.some(effect=>effect.standardCondition==='prone')??false).toBe(d20===1)
   expect(saved.state.combatants[f.houndId].turn.reactionAvailable).toBe(false)
  }
 }finally{f.dispose()}
})

it('real final missed ordinary Hound OA never queues the inherited bite save',async()=>{
 const f=await nativeSummonedHound();try{
  const order=f.snapshot.state.initiativeOrder.map((id,i)=>({tokenId:id,label:id,roll:20-i,color:'',emoji:''})),p=prepareDnd5eOpportunityAttack({combatId:'hound-missed-bite-oa',round:1,map:f.map,characters:f.characters,initiativeOrder:order,actorTokenId:f.houndId,targetTokenId:'foe-token',turnEconomy:economy});if(!p.ok)throw Error(p.reason)
  const r=resolvePreparedDnd5eOpportunityAttack({prepared:p.prepared,d20:1,...(p.prepared.attackMode!=='normal'?{d20Second:1}:{}),damageRolls:[]});expect(r.result.ok,JSON.stringify(r.result)).toBe(true)
  expect(r.result.state.combatants['foe-token'].currentHp).toBe(10);expect(r.result.state.combatants['foe-token'].classState.monsterOnHitSavePending).toBeUndefined();expect(r.result.events.some(event=>event.type==='monster-on-hit-save-required')).toBe(false)
 }finally{f.dispose()}
})
