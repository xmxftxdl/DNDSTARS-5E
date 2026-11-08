import {expect,it} from 'vitest'
import {nativeSummonedHound} from './shadowMagic.summonedHound.native.fixture'
import {resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {reconcileDnd5eSummonedCreatures} from './summonedCreatures'
import {prepareDnd5eMonsterAttack,resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {resolveDnd5eMonsterMapMove} from './monsterMoveAction'
import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'

it('actual Hound native attack/OA only chosen body; no Dash/Dodge/Ready; original bite retains DireWolf DC13',async()=>{
 const f=await nativeSummonedHound();try{
  const state=f.snapshot.state,original=structuredClone(state)
  for(const action of [{type:'dodge'},{type:'dash'},{type:'ready',trigger:'arbitrary',actionKind:'attack',targetId:'foe-token'}] as const){
   const bad=resolveDnd5eHeadlessAction(state,{...action,actorId:f.houndId});expect(bad.ok).toBe(false);expect(bad.state).toEqual(original)
  }
  const oa:any={type:'opportunity-attack',actorId:f.houndId,targetId:'soul-token',attackModifier:5,d20:18,damage:{count:2,sides:6,bonus:3,rolls:[2,2],type:'piercing'}}
  expect(resolveDnd5eHeadlessAction(state,oa).ok).toBe(false)
  const order=state.initiativeOrder.map((id,i)=>({tokenId:id,label:id,roll:20-i,color:'',emoji:''})),input={combatId:state.combatId,round:1,map:f.map,characters:f.characters,initiativeOrder:order,actorTokenId:f.houndId}
  expect(prepareDnd5eMonsterAttack({...input,targetTokenId:'soul-token'}).ok).toBe(false)
  const p=prepareDnd5eMonsterAttack({...input,targetTokenId:'foe-token'});expect(p.ok,JSON.stringify(p)).toBe(true);if(!p.ok)throw Error(p.reason)
  const r=resolvePreparedDnd5eMonsterAttack({prepared:p.prepared,rolls:[{d20:18,damageRolls:[[1,1]],onHitEffectRolls:(p.prepared.attacks[0].attack.onHitEffects??[]).map(effect=>({effectId:effect.id,d20:18}))}]})
  expect(r.result.ok,JSON.stringify(r.result)).toBe(true)
  const save=r.result.events.find(e=>e.type==='monster-on-hit-save-required');expect(save).toMatchObject({targetId:'foe-token',dc:13})
  if(save?.type!=='monster-on-hit-save-required')throw Error('Actual bite saving throw required')
  const defended=resolveDnd5eHeadlessAction(r.result.state,{type:'monster-on-hit-save',actorId:'foe-token',sourceId:f.houndId,actionId:save.actionId,d20:18})
  expect(defended.ok,JSON.stringify(defended)).toBe(true)
  expect(defended.events.find(e=>e.type==='saving-throw-resolved')).toMatchObject({targetId:'foe-token',dc:13,success:true})
 }finally{f.dispose()}
})

it('actual native Hound uses geometric most-direct route through physical wall, difficult cost; cannot retreat or use wall detour',async()=>{
 const f=await nativeSummonedHound(425);try{
  const geometry=createEmptyMapGeometry(f.map.id);geometry.walls.push({id:'wood',kind:'wall',label:'Wood',points:[{x:175,y:0},{x:175,y:500}],baseHeightFeet:0,heightFeet:20,blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1});setMapGeometryRuntime([geometry])
  const order=f.snapshot.state.initiativeOrder.map((id,i)=>({tokenId:id,label:id,roll:20-i,color:'',emoji:''})),input={combatId:'hound-move',round:1,map:f.map,characters:f.characters,initiativeOrder:order,actorTokenId:f.houndId}
  const bad=resolveDnd5eMonsterMapMove({...input,to:{x:75,y:25}});expect(!bad.ok||!bad.result.ok).toBe(true)
  const side=resolveDnd5eMonsterMapMove({...input,to:{x:125,y:125}});expect(!side.ok||!side.result.ok).toBe(true)
  const good=resolveDnd5eMonsterMapMove({...input,to:{x:225,y:25}});expect(good.ok,JSON.stringify(good)).toBe(true);if(!good.ok)throw Error(good.reason)
  expect(good.result.ok,JSON.stringify(good.result)).toBe(true);if(!good.result.ok)throw Error(good.result.reason)
  const hound=good.result.state.combatants[f.houndId];expect(hound.position).toEqual({x:225,y:25});expect(hound.turn.movementSpent).toBe(20)
  expect(hound.currentHp).toBe(37)
  const inside=resolveDnd5eMonsterMapMove({...input,to:{x:175,y:25}});expect(inside.ok,JSON.stringify(inside)).toBe(true);if(!inside.ok||!inside.result.ok)throw Error('Actual inside-object move required')
  expect(inside.result.state.combatants[f.houndId].currentHp).toBe(37)
  const ended=resolveDnd5eHeadlessAction(inside.result.state,{type:'end-turn',actorId:f.houndId});expect(ended.ok,JSON.stringify(ended)).toBe(true)
  expect(ended.state.combatants[f.houndId]).toMatchObject({currentHp:35,temporaryHp:0})
  expect(ended.events.find(e=>e.type==='damage-applied'&&e.targetId===f.houndId)).toMatchObject({type:'damage-applied',amount:5,damageTypes:['force']})
 }finally{setMapGeometryRuntime([]);f.dispose()}
})

it('real summon world cleanup: five minutes, own/target0 remove; creator death/incap/absence do not',async()=>{
 const f=await nativeSummonedHound();try{
  const reconcile=(map=f.map,characters=f.characters,round=1)=>reconcileDnd5eSummonedCreatures({map,characters,round})
  expect(reconcile().removedTokenIds).toEqual([])
  expect(reconcile(f.map,f.characters,50).removedTokenIds).toEqual([])
  expect(reconcile(f.map,f.characters,51).removedTokenIds).toEqual([f.houndId])
  expect(reconcile({...f.map,tokens:f.map.tokens.map(t=>t.id===f.houndId?{...t,hp:0}:t)}).removedTokenIds).toEqual([f.houndId])
  expect(reconcile(f.map,f.characters.map(c=>c.id==='foe'?{...c,currentHp:0}:c)).removedTokenIds).toEqual([f.houndId])
  expect(reconcile(f.map,f.characters.map(c=>c.id==='soul'?{...c,currentHp:0}:c)).removedTokenIds).toEqual([])
  expect(reconcile({...f.map,tokens:f.map.tokens.filter(t=>t.id!=='soul-token')},f.characters.filter(c=>c.id!=='soul')).removedTokenIds).toEqual([])
 }finally{f.dispose()}
})
