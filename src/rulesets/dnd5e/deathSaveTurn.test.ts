import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {normalizeCharacter} from '../../store/characters'

function fixture(hp=0){
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
    currentHp:hp,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  return startDnd5eHeadlessCombat('death-turn',[actor,{...structuredClone(actor),id:'enemy',currentHp:20,controller:'dm',initiative:10}])
}

it('persists a resolved save and rejects a repeat even with another roll',()=>{
  const state=fixture()
  const first=resolveDnd5eHeadlessAction(state,{type:'death-save',actorId:'actor',d20:10})
  expect(first.ok).toBe(true)
  expect(first.state.combatants.actor.deathSaves.successes).toBe(1)
  const saved=normalizeCharacter({id:'hero',dnd5eCombatState:{schemaVersion:2,...JSON.parse(JSON.stringify(first.state.combatants.actor.classState))}})
  expect(saved.dnd5eCombatState?.deathSaveTurn).toEqual({turnKey:'death-turn:1:actor',eligible:true,resolved:true})
  const restored=structuredClone(first.state)
  restored.combatants.actor.classState.deathSaveTurn=saved.dnd5eCombatState?.deathSaveTurn
  const repeated=resolveDnd5eHeadlessAction(restored,{type:'death-save',actorId:'actor',d20:20})
  expect(repeated.ok).toBe(false)
  expect(repeated.state).toEqual(restored)
  const end=resolveDnd5eHeadlessAction(restored,{type:'end-turn',actorId:'actor'})
  const next=resolveDnd5eHeadlessAction(end.state,{type:'end-turn',actorId:'enemy'})
  expect(next.ok).toBe(true)
  const second=resolveDnd5eHeadlessAction(next.state,{type:'death-save',actorId:'actor',d20:10})
  expect(second.ok).toBe(true)
  expect(second.state.combatants.actor.deathSaves.successes).toBe(2)
})

it('does not consume the opportunity on invalid dice',()=>{
  const state=fixture()
  const invalid=resolveDnd5eHeadlessAction(state,{type:'death-save',actorId:'actor',d20:0})
  expect(invalid.ok).toBe(false)
  expect(resolveDnd5eHeadlessAction(state,{type:'death-save',actorId:'actor',d20:10}).ok).toBe(true)
})

it('separates two initiative slots for the same creature in one round',()=>{
  const state=fixture()
  state.initiativeOrder=['actor','actor','enemy']
  state.initiativeSlotIds=['actor:normal','actor:extra','enemy:normal']
  state.turnSlotId='actor:normal'
  const first=resolveDnd5eHeadlessAction(state,{type:'death-save',actorId:'actor',d20:10})
  expect(first.ok).toBe(true)
  const advanced=resolveDnd5eHeadlessAction(first.state,{type:'end-turn',actorId:'actor',nextTurnSlotId:'actor:extra'})
  expect(advanced.ok).toBe(true)
  expect(advanced.state.round).toBe(1)
  expect(advanced.state.combatants.actor.classState.deathSaveTurn).toEqual({turnKey:'death-turn:1:actor:extra',eligible:true,resolved:false})
  const second=resolveDnd5eHeadlessAction(advanced.state,{type:'death-save',actorId:'actor',d20:10})
  expect(second.ok).toBe(true)
  expect(second.state.combatants.actor.deathSaves.successes).toBe(2)
  expect(resolveDnd5eHeadlessAction(second.state,{type:'death-save',actorId:'actor',d20:20}).ok).toBe(false)
})

it('does not infer start-of-turn eligibility from HP lost later in that turn',()=>{
  const began=resolveDnd5eHeadlessAction(fixture(20),{type:'begin-turn',actorId:'actor'})
  expect(began.ok).toBe(true)
  began.state.combatants.actor.currentHp=0
  const result=resolveDnd5eHeadlessAction(began.state,{type:'death-save',actorId:'actor',d20:10})
  expect(result.ok).toBe(false)
  expect(result.state).toEqual(began.state)
})

it('does not invent missing evidence for a persisted already-started legacy turn',()=>{
  const state=fixture()
  state.combatants.actor.classState.turnStartResolvedTurnKey='death-turn:1:actor'
  const result=resolveDnd5eHeadlessAction(state,{type:'death-save',actorId:'actor',d20:10})
  expect(result.ok).toBe(false)
  expect(result.state).toEqual(state)
})
