import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, type Dnd5eHeadlessCombatState, type Dnd5eActionResult } from './headlessCombatEngine'
import { createDnd5eDeathSaveSession } from './deathSaveSession'

function fixture(){
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',initiative:20,controller:'player',
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,
    temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const state=startDnd5eHeadlessCombat('death-save',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:10}])
  state.combatants.actor.currentHp=0
  state.combatants.actor.classResources['test-recovery']={current:1,max:1}
  return state
}
// Synthetic trusted resolver exercises the suspension transaction only.
// Registered import entitlement, actual recovery effects and UI are separate work.
function recover(state:Dnd5eHeadlessCombatState):Dnd5eActionResult{
  state.combatants.actor.currentHp=10
  state.combatants.actor.deathSaves={successes:0,failures:0,stable:false,dead:false}
  state.combatants.actor.classResources['test-recovery'].current--
  return {ok:true,state,events:[]}
}

it('pauses before reading dice and resumes a declined death save exactly once',()=>{
  const state=fixture(), before=structuredClone(state)
  const action={type:'death-save' as const,actorId:'actor',d20:1}
  const session=createDnd5eDeathSaveSession(state,action,(_checkpoint,snapshot)=>{
    snapshot.combatants.actor.currentHp=999
    return true
  },recover)
  const pending=session.run(state)
  expect(pending.status).toBe('pending');if(pending.status!=='pending')throw Error('not pending')
  expect(state).toEqual(before)
  action.d20=20
  const result=session.decline(state,pending.checkpoint)
  expect(result.status).toBe('resolved');if(result.status!=='resolved')throw Error('not resolved')
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.actor.deathSaves.failures).toBe(2)
  expect(result.result.state.combatants.actor.currentHp).toBe(0)
  expect(result.result.events.filter(event=>event.type==='death-save-resolved')).toHaveLength(1)
  expect(session.decline(state,pending.checkpoint)).toEqual({status:'rejected',reason:'session-ended'})
  expect(state).toEqual(before)
})

it('replaces the death save without consuming its die or advancing a recovered actor turn',()=>{
  const state=fixture(),before=structuredClone(state)
  const session=createDnd5eDeathSaveSession(state,{type:'death-save-turn',actorId:'actor',d20:0},()=>true,recover)
  const pending=session.run(state);if(pending.status!=='pending')throw Error('not pending')
  const result=session.accept(state,pending.checkpoint,{})
  expect(result.status).toBe('resolved');if(result.status!=='resolved')throw Error('not resolved')
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.actor.currentHp).toBe(10)
  expect(result.result.state.combatants.actor.classResources['test-recovery'].current).toBe(0)
  expect(result.result.state.initiativeIndex).toBe(state.initiativeIndex)
  expect(result.result.events.some(event=>event.type==='death-save-resolved')).toBe(false)
  expect(state).toEqual(before)
  expect(session.accept(state,pending.checkpoint,{})).toEqual({status:'rejected',reason:'session-ended'})
})

it.each(['alive','stable','dead'] as const)('does not offer a replacement when the actor is %s',mode=>{
  const state=fixture();let calls=0
  if(mode==='alive')state.combatants.actor.currentHp=1
  if(mode==='stable')state.combatants.actor.deathSaves.stable=true
  if(mode==='dead')state.combatants.actor.deathSaves.dead=true
  const session=createDnd5eDeathSaveSession(state,{type:'death-save',actorId:'actor',d20:10},()=>{calls++;return true},recover)
  expect(session.run(state)).toMatchObject({status:'resolved',result:{ok:false}})
  expect(calls).toBe(0)
})

it('rejects stale selections and state, and never publishes failed replacement mutations',()=>{
  const state=fixture()
  const create=()=>createDnd5eDeathSaveSession(state,{type:'death-save',actorId:'actor',d20:10},()=>true,(snapshot):Dnd5eActionResult=>{
    snapshot.combatants.actor.classResources['test-recovery'].current=0
    return {ok:false,state:snapshot,events:[],reason:'invalid-target'}
  })
  const session=create(),pending=session.run(state);if(pending.status!=='pending')throw Error('not pending')
  expect(session.accept(state,{...pending.checkpoint,actorId:'enemy'},{})).toEqual({status:'rejected',reason:'stale-checkpoint'})
  const result=session.accept(state,pending.checkpoint,{})
  expect(result).toMatchObject({status:'resolved',result:{ok:false}})
  if(result.status==='resolved')expect(result.result.state).toEqual(state)
  const stale=create(),checkpoint=stale.run(state);if(checkpoint.status!=='pending')throw Error('not pending')
  const changed=structuredClone(state);changed.combatants.actor.currentHp=1
  expect(stale.accept(changed,checkpoint.checkpoint,{})).toEqual({status:'rejected',reason:'stale-state'})
  // The scoped listener is removed; ordinary saves still work afterward.
  expect(resolveDnd5eHeadlessAction(state,{type:'death-save',actorId:'actor',d20:10}).ok).toBe(true)
})
