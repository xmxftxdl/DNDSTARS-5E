import { expect, it } from 'vitest'
import { nativeUmbralFixture } from './shadowMagic.umbral.native.fixture'
import { umbralFeatureId, namespace } from './shadowMagic.umbralSource.native.fixture'
import { dnd5eCharacterHasPluginFeature } from './pluginApi'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'
import { resolveDnd5eHeadlessAction, applyDnd5eStandardConditionEffect, type Dnd5eHeadlessCombatState, type Dnd5eActionResult } from './headlessCombatEngine'
import { dnd5eActiveObjectCreatureTraversal } from './activeEffects'
import { normalizeDnd5eObjectCreatureTraversal } from './objectCreatureTraversal'

const active=(state:Dnd5eHeadlessCombatState)=>dnd5eActiveObjectCreatureTraversal(state.combatants['soul-token'].classState.activeEffects)
function accepted(result:Dnd5eActionResult) { expect(result.ok,result.ok?'accepted':result.reason).toBe(true);return result.state }
function nextOwn(state:Dnd5eHeadlessCombatState) {
  return accepted(resolveDnd5eHeadlessAction(accepted(resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:'soul-token'})),{type:'end-turn',actorId:'foe-token'}))
}
async function fixture() {
  const f=await nativeUmbralFixture('human','legacy',18)
  try {
    const map={...f.map(),tokens:[...f.map().tokens].reverse().map((token:any)=>({...token,x:token.id==='soul-token'?25:75,y:25}))}
    const order=map.tokens.map((token:any,i:number)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
    const prepared=prepareDnd5ePluginFeatureAction({map,characters:f.characters(),initiativeOrder:order,
      action:{id:'native-umbral-lifecycle',mapId:map.id,combatId:'umbral-lifecycle',sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',
        actorTokenId:'soul-token',characterId:f.soul().id,targetTokenId:'soul-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,
        dnd5ePluginAction:{featureId:umbralFeatureId,payload:{selectedActivityId:'umbral-form'}}}})
    expect(prepared.ok,prepared.ok?'prepared':prepared.reason).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
    const used=await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared,combatRevision:1,rolls:{}})
    const state=accepted(used.result)
    return {dispose:f.dispose,state,original:prepared.prepared.headlessAction}
  }catch(error){f.dispose();throw error}
}

it('actual saved1minute form expires at10 full rounds on the same initiative boundary; source action is not spent again',async()=>{
  const f=await fixture();try {
    let state=JSON.parse(JSON.stringify(f.state)) as Dnd5eHeadlessCombatState
    for(let turn=1;turn<=10;turn++) {
      expect(active(state)).toBe(true)
      const ended=accepted(resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:'soul-token'}))
      expect(active(ended)).toBe(true)
      expect(ended.combatants['soul-token'].classResources['dnd5e-sorcery-points'].current).toBe(12)
      state=accepted(resolveDnd5eHeadlessAction(ended,{type:'end-turn',actorId:'foe-token'}))
      expect(state.round).toBe(turn+1)
      expect(active(state)).toBe(turn<10)
    }
  }finally{f.dispose()}
})

it('actual effect-granted dismissal needs fresh own BA and removes all resistance groups without refunding6SP',async()=>{
  const f=await fixture();try {
    const effect=f.state.combatants['soul-token'].classState.activeEffects!.find(entry=>entry.modifiers?.objectCreatureTraversal)!
    const dismiss={type:'plugin' as const,pluginId:namespace,actionId:'dismiss-umbral-form',featureId:namespace+':effect-control.dismiss-umbral-form',
      actorId:'soul-token',targetId:'soul-token',targetIds:['soul-token'],rolls:{},hostEntitlement:{kind:'active-effect' as const,effectId:effect.id}}
    expect(resolveDnd5eHeadlessAction(f.state,dismiss).ok).toBe(false)
    const result=resolveDnd5eHeadlessAction(nextOwn(f.state),dismiss),state=accepted(result)
    expect(active(state)).toBe(false);expect(state.combatants['soul-token'].turn.bonusActionAvailable).toBe(false)
    expect((state.combatants['soul-token'].classState.activeEffects??[]).some(entry=>entry.modifiers?.damageResistance)).toBe(false)
    expect(state.combatants['soul-token'].classResources['dnd5e-sorcery-points'].current).toBe(12)
  }finally{f.dispose()}
})

it('actual canonical involuntary stunned condition ends the entire source-linked form before normal continuation',async()=>{
  const f=await fixture();try {
    const state=structuredClone(f.state),events:any[]=[]
    expect(applyDnd5eStandardConditionEffect(state.combatants['soul-token'],state.combatants['foe-token'],
      {rulesId:'native-host-stun',condition:'stunned',duration:{type:'permanent'},involuntary:true,sourceKind:'system'},events)).toBe(true)
    expect(events).toContainEqual(expect.objectContaining({type:'condition-applied',condition:'stunned',becameIncapacitatedInvoluntarily:true}))
    const ended=accepted(resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:'soul-token'}))
    expect(active(ended)).toBe(false)
  }finally{f.dispose()}
})

it('native fatal critical attack ends the form on source death and cannot invoke Strength on a critical',async()=>{
  const f=await fixture();try {
    const foeTurn=accepted(resolveDnd5eHeadlessAction(f.state,{type:'end-turn',actorId:'soul-token'}))
    const fatal=resolveDnd5eHeadlessAction(foeTurn,{type:'attack',actorId:'foe-token',targetId:'soul-token',attackModifier:20,d20:20,
      damage:{count:0,sides:6,bonus:1000,rolls:[],type:'slashing'}})
    const state=accepted(fatal)
    expect(state.combatants['soul-token'].currentHp).toBe(0);expect(state.combatants['soul-token'].deathSaves.dead).toBe(true)
    expect(active(state)).toBe(false)
  }finally{f.dispose()}
})

it('native repeated lawful6SP activations reach0 then reject, without restoring spent source or bonus action',async()=>{
  const f=await fixture();try {
    let state=f.state
    expect(resolveDnd5eHeadlessAction(state,f.original).ok).toBe(false)
    for(const points of [6,0]) {
      state=accepted(resolveDnd5eHeadlessAction(nextOwn(state),f.original))
      expect(state.combatants['soul-token'].classResources['dnd5e-sorcery-points'].current).toBe(points)
    }
    state=nextOwn(state);const before=structuredClone(state),rejected=resolveDnd5eHeadlessAction(state,f.original)
    expect(rejected.ok).toBe(false);expect(state).toEqual(before)
    expect(state.combatants['soul-token'].classResources['dnd5e-sorcery-points'].current).toBe(0)
  }finally{f.dispose()}
})

it('actual Sorcerer1→17 cannot own or activate the18 source',async()=>{
  const f=await nativeUmbralFixture('human','legacy',17)
  try{
    expect(dnd5eCharacterHasPluginFeature(f.soul(),umbralFeatureId)).toBe(false)
    const map=f.map(),order=map.tokens.map((token:any,i:number)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
    const prepared=prepareDnd5ePluginFeatureAction({map,characters:f.characters(),initiativeOrder:order,
      action:{id:'native-17-rejected',mapId:map.id,combatId:'native-17',sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',
        actorTokenId:'soul-token',characterId:f.soul().id,targetTokenId:'soul-token',round:1,initiativeIndex:1,seq:1,updatedAt:1,
        dnd5ePluginAction:{featureId:umbralFeatureId,payload:{selectedActivityId:'umbral-form'}}}})
    expect(prepared.ok).toBe(false)
  }finally{f.dispose()}
})

it('a forged Wizard source retaining all original Sorcerer feature/resource pointers cannot spend the core SP bridge',async()=>{
  const f=await fixture();try{
    const state=nextOwn(f.state),actor=state.combatants['soul-token']
    actor.classId='wizard';actor.classLevels={wizard:18};actor.subclassId=undefined;actor.subclassIds={}
    const before=structuredClone(state),result=resolveDnd5eHeadlessAction(state,f.original)
    expect(result.ok).toBe(false);expect(state).toEqual(before)
    expect(actor.classResources['dnd5e-sorcery-points'].current).toBe(12)
  }finally{f.dispose()}
})

it('the saved traversal contract cannot substitute force amount/type, ignore terrain or add unrelated movement permissions',()=>{
  const original={difficultTerrain:true,endOwnTurnInsideObjectDamage:{amount:5,type:'force'}}
  expect(normalizeDnd5eObjectCreatureTraversal(original)).toEqual(original)
  for(const raw of [{...original,difficultTerrain:false},{...original,canFly:true},
    {...original,endOwnTurnInsideObjectDamage:{amount:0,type:'force'}},
    {...original,endOwnTurnInsideObjectDamage:{amount:5,type:'radiant'}},
    {...original,endOwnTurnInsideObjectDamage:{amount:5,type:'force',eject:true}}]) {
    expect(normalizeDnd5eObjectCreatureTraversal(raw)).toBeUndefined()
  }
})
