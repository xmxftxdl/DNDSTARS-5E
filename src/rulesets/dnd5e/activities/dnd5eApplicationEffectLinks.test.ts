import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, type Dnd5eCombatEvent } from '../headlessCombatEngine'
import { bindDnd5eApplicationEffectLinks } from './dnd5eApplicationEffectLinks'

function fixture() {
  const actor = (id: string) => createDnd5eCombatant({ id, name:id, controller:'player', initiative:10,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,
    temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false })
  const state = startDnd5eHeadlessCombat('links',[actor('source'),actor('target')])
  const effect = (id:string, targetId:string) => createDnd5eMechanicalEffect({id,definitionId:id,label:id,targetId,
    source:{kind:'feature',actorId:'source',characterId:'source'},duration:{type:'permanent'}})
  const controller=effect('controller','source')
  const dependents=['first','second'].map(id=>({...effect(id,'target'),removal:{sourceLink:{sourceRequiresEffect:'controller',sourceRequiresEffectSameApplication:true as const}}}))
  state.combatants.source.classState.activeEffects=[controller]
  state.combatants.target.classState.activeEffects=dependents
  const events:Dnd5eCombatEvent[]=[{type:'active-effect-applied',targetId:'source',effectId:controller.id,definitionId:controller.definitionId},
    ...dependents.map(e=>({type:'active-effect-applied' as const,targetId:'target',effectId:e.id,definitionId:e.definitionId}))]
  return {state,events,controller,dependents}
}
it('binds multiple dependents to one fresh persisted controller identity and is idempotent',()=>{
  const {state,events,controller,dependents}=fixture()
  expect(bindDnd5eApplicationEffectLinks(state,events)).toBe(true)
  expect(controller.id).not.toBe('controller')
  for(const dependent of dependents) expect(dependent.removal.sourceLink).toMatchObject({sourceRequiresEffectInstanceId:controller.id})
  expect(controller.linkedTargetSnapshots).toHaveLength(2)
  const saved=JSON.stringify({state,events})
  expect(bindDnd5eApplicationEffectLinks(state,events)).toBe(true)
  expect(JSON.stringify({state,events})).toBe(saved)
})
it('rejects a matching old controller that was not emitted by this application',()=>{
  const {state,events}=fixture()
  expect(bindDnd5eApplicationEffectLinks(state,events.slice(1))).toBe(false)
})
it('separate applications never reuse controller identities',()=>{
  const first=fixture(),second=fixture()
  expect(bindDnd5eApplicationEffectLinks(first.state,first.events)).toBe(true)
  expect(bindDnd5eApplicationEffectLinks(second.state,second.events)).toBe(true)
  expect(first.controller.id).not.toBe(second.controller.id)
})
