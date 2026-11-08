import {expect,it} from 'vitest'
import {nativeSummonedHound} from './shadowMagic.summonedHound.native.fixture'
import {dnd5eSavingThrowModeExplanation} from './passiveDefenses'
import {refreshDnd5eMapSpatialRelations,planDnd5eMapResultApplication} from './mapBridge'
import {prepareDnd5eMonsterAttack} from './monsterAttackAction'
import {resolveDnd5eHeadlessAction,dnd5eCombatantCanSee,dnd5eCombatantKnowsSourceLinkedLocation} from './headlessCombatEngine'
import {dnd5eLinkedLocationRevealsInvisibleForAttack} from './illOmenHoundEffects'
import {createDnd5eConditionEffect,dnd5eConditionsFromActiveEffects} from './activeEffects'

it('real native Hound aura affects only its chosen target against its actual caster spells; range and 0HP remove it, caster death does not',async()=>{
 const f=await nativeSummonedHound();try{
  const state=f.snapshot.state,target=state.combatants['foe-token'],hound=state.combatants[f.houndId],caster=state.combatants['soul-token']
  expect(hound.illOmenHound).toMatchObject({targetTokenId:target.id,sourceTokenId:caster.id})
  const mode=(actorId:string,spell=true)=>dnd5eSavingThrowModeExplanation(target,'wis',{sourceIsSpell:spell,sourceActorId:actorId}).mode
  expect(mode(caster.id)).toBe('disadvantage');expect(mode(hound.id)).toBe('normal');expect(mode(caster.id,false)).toBe('normal')
  expect(dnd5eSavingThrowModeExplanation(caster,'wis',{sourceIsSpell:true,sourceActorId:caster.id}).mode).toBe('normal')
  caster.currentHp=0;caster.deathSaves.dead=true;refreshDnd5eMapSpatialRelations(state,f.map);expect(mode(caster.id)).toBe('disadvantage')
  hound.position={x:225,y:25};refreshDnd5eMapSpatialRelations(state,f.map);expect(mode(caster.id)).toBe('normal')
  hound.position={x:125,y:25};refreshDnd5eMapSpatialRelations(state,f.map);expect(mode(caster.id)).toBe('disadvantage')
  target.currentHp=0;refreshDnd5eMapSpatialRelations(state,f.map);expect(mode(caster.id)).toBe('normal')
 }finally{f.dispose()}
})

it('actual ordinary monster attack against the known invisible target keeps unseen disadvantage; knowledge is not see invisible',async()=>{
 const f=await nativeSummonedHound();try{
  const source=f.snapshot.state;source.combatants['soul-token'].position={x:275,y:25}
  const begun=resolveDnd5eHeadlessAction(source,{type:'begin-turn',actorId:f.houndId});if(!begun.ok)throw Error(begun.reason)
  const target=begun.state.combatants['foe-token']
  target.classState.activeEffects=[...(target.classState.activeEffects??[]),createDnd5eConditionEffect({condition:'invisible',targetId:target.id,source:{kind:'spell',rulesId:'invisibility',actorId:target.id,magical:true},duration:{type:'permanent'}})]
  target.conditions=dnd5eConditionsFromActiveEffects(target.classState.activeEffects)
  const projected=planDnd5eMapResultApplication({state:begun.state,map:f.map,characters:f.characters,events:[...begun.events],characterIdByCombatantId:f.snapshot.characterIdByCombatantId})
  const order=begun.state.initiativeOrder.map((id,i)=>({tokenId:id,label:id,roll:20-i,color:'',emoji:''}))
  const prepared=prepareDnd5eMonsterAttack({combatId:'hound-unseen-real',round:1,map:projected.map,characters:projected.characters,initiativeOrder:order,actorTokenId:f.houndId,targetTokenId:target.id})
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
  expect(prepared.prepared.packTactics).toBe(false)
  expect(prepared.prepared.targetAttackMode).toBe('disadvantage')
 }finally{f.dispose()}
})

it('real own-turn start learns hidden target only for Hound, never grants invisible sight or blindness bypass',async()=>{
 const f=await nativeSummonedHound();try{
  const state=f.snapshot.state,target=state.combatants['foe-token'];target.classState.hiddenCheckTotal=99
  expect(dnd5eCombatantCanSee(state,f.houndId,target.id)).toBe(false)
  const begun=resolveDnd5eHeadlessAction(state,{type:'begin-turn',actorId:f.houndId});expect(begun.ok,JSON.stringify(begun)).toBe(true);if(!begun.ok)throw Error(begun.reason)
  const after=begun.state,actual=after.combatants[target.id],hound=after.combatants[f.houndId]
  expect(dnd5eCombatantKnowsSourceLinkedLocation(after,hound.id,target.id)).toBe(true)
  expect(dnd5eCombatantCanSee(after,hound.id,target.id)).toBe(true)
  expect(dnd5eCombatantKnowsSourceLinkedLocation(after,'soul-token',target.id)).toBe(false)
  expect(dnd5eCombatantCanSee(after,'soul-token',target.id)).toBe(false)
  actual.position={x:75,y:75}
  expect(dnd5eCombatantKnowsSourceLinkedLocation(after,hound.id,target.id)).toBe(false)
  expect(dnd5eCombatantCanSee(after,hound.id,target.id)).toBe(true)
  actual.classState.activeEffects=[...(actual.classState.activeEffects??[]),createDnd5eConditionEffect({id:'real-invisibility',definitionId:'invisible',condition:'invisible',targetId:target.id,source:{kind:'spell',rulesId:'invisibility',actorId:target.id,magical:true},duration:{type:'permanent'}})]
  actual.conditions=dnd5eConditionsFromActiveEffects(actual.classState.activeEffects)
  expect(dnd5eCombatantCanSee(after,hound.id,target.id)).toBe(false)
  expect(dnd5eLinkedLocationRevealsInvisibleForAttack(actual,hound)).toBe(false)
  expect(hound.classState.knownCreatureLocations?.[target.id]).toMatchObject({x:75,y:25})
  hound.classState.activeEffects=[...(hound.classState.activeEffects??[]),createDnd5eConditionEffect({condition:'blinded',targetId:hound.id,source:{kind:'spell',rulesId:'blindness-deafness',actorId:target.id,magical:true},duration:{type:'permanent'}})]
  hound.conditions=dnd5eConditionsFromActiveEffects(hound.classState.activeEffects)
  expect(dnd5eCombatantCanSee(after,hound.id,target.id)).toBe(false)
 }finally{f.dispose()}
})
