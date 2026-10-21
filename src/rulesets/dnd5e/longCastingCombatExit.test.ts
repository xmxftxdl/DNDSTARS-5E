import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat} from './headlessCombatEngine'
import {captureDnd5eLongCasting,beginDnd5eLongCasting,armDnd5eLongCasting,
 continueDnd5eLongCastingOutsideCombat,continueDnd5eLongCastingInsideCombat,dnd5eLongCastingCanComplete,observeDnd5eLongCasting,
 prepareDnd5eLongCastingCombatTurn,armDnd5eLongCastingCombatTurn} from './longCastingContinuity'
function fixture(requiredRounds=600){
 const binding={requestId:'ceremony',spellId:'test:ceremony',mapId:'map',actorTokenId:'caster',actorCharacterId:'cleric'}
 const caster=createDnd5eCombatant({id:'caster',name:'Cleric',controller:'player',initiative:20,
  abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},proficiencyBonus:2,armorClass:12,currentHp:20,maxHp:20,
  temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const initial=startDnd5eHeadlessCombat('combat',[caster,{...structuredClone(caster),id:'enemy',controller:'dm',initiative:10}])
 const receipt=captureDnd5eLongCasting(binding,initial.combatants.caster,{combatId:'combat',requiredRounds,startRound:1})!
 const state=beginDnd5eLongCasting(receipt,binding,initial)!
 expect(armDnd5eLongCasting(receipt,binding,state.combatants.caster)).toBe(true)
 return{binding,receipt,state}
}
it.each([600,700])('retains committed progress across combat end and waits for remaining time: %s',rounds=>{
 const {binding,receipt,state}=fixture(rounds)
 const second=structuredClone(state);second.round=2;second.combatants.caster.turn.actionAvailable=true
 const paid=prepareDnd5eLongCastingCombatTurn(receipt,binding,second)!
 expect(armDnd5eLongCastingCombatTurn(paid,binding,paid.state)).toBe(true)
 const ended=structuredClone(paid.state);ended.active=false
 const transition=continueDnd5eLongCastingOutsideCombat(receipt,binding,ended,480)!
 expect(transition).toEqual({remainingSeconds:(rounds-2)*6,readyAtWorldMinute:480+Math.ceil((rounds-2)/10)})
 expect(continueDnd5eLongCastingOutsideCombat(receipt,binding,ended,500)).toEqual(transition)
 ended.combatants.caster.campaignWorldMinute=transition.readyAtWorldMinute-1
 expect(dnd5eLongCastingCanComplete(receipt,binding,ended)).toBe(false)
 ended.combatants.caster.campaignWorldMinute++
 expect(dnd5eLongCastingCanComplete(receipt,binding,ended)).toBe(true)
 expect(ended.combatants.caster.concentrating).toBe(true)
 ended.active=true
 expect(dnd5eLongCastingCanComplete(receipt,binding,ended)).toBe(false)
 expect(prepareDnd5eLongCastingCombatTurn(receipt,binding,ended)).toBeUndefined()
})
it.each(['active','wrong-combat','wrong-binding','forged','skipped-rounds','invalid-clock'] as const)('rejects unproven combat exit: %s',kind=>{
 const {binding,receipt,state}=fixture();state.active=kind==='active'
 if(kind==='wrong-combat')state.combatId='different'
 if(kind==='skipped-rounds')state.round=4
 expect(continueDnd5eLongCastingOutsideCombat(kind==='forged'?JSON.parse(JSON.stringify(receipt)):receipt,
  kind==='wrong-binding'?{...binding,requestId:'different'}:binding,state,kind==='invalid-clock'?480.5:480)).toBeUndefined()
 expect(dnd5eLongCastingCanComplete(receipt,binding,state)).toBe(false)
})
it('loss of concentration during the remaining time cannot be repaired by restoring the marker',()=>{
 const {binding,receipt,state}=fixture();state.active=false
 expect(continueDnd5eLongCastingOutsideCombat(receipt,binding,state,480)).toBeTruthy()
 state.combatants.caster.concentrating=false
 expect(observeDnd5eLongCasting(receipt,binding,state.combatants.caster)).toBe(false)
 state.combatants.caster.concentrating=true;state.combatants.caster.campaignWorldMinute=1000
 expect(dnd5eLongCastingCanComplete(receipt,binding,state)).toBe(false)
})
it('cannot commit an outstanding turn proposal after transferring out of combat',()=>{
 const {binding,receipt,state}=fixture()
 const next=structuredClone(state);next.round=2;next.combatants.caster.turn.actionAvailable=true
 const proposal=prepareDnd5eLongCastingCombatTurn(receipt,binding,next)!
 state.active=false
 expect(continueDnd5eLongCastingOutsideCombat(receipt,binding,state,480)).toBeTruthy()
 expect(armDnd5eLongCastingCombatTurn(proposal,binding,proposal.state)).toBe(false)
})

it('retains earlier actions and exploration time across a second combat, without granting a free action',()=>{
 const {binding,receipt,state}=fixture(22)
 state.active=false
 expect(continueDnd5eLongCastingOutsideCombat(receipt,binding,state,480)?.remainingSeconds).toBe(126)
 const resumed=structuredClone(state);resumed.active=true;resumed.combatId='second';resumed.round=1
 resumed.combatants.caster.turn.actionAvailable=true
 expect(continueDnd5eLongCastingInsideCombat(receipt,binding,resumed,482)).toEqual({combatId:'second',requiredRounds:1,lastPaidRound:0})
 expect(resumed.combatants.caster.turn.actionAvailable).toBe(true)
 expect(dnd5eLongCastingCanComplete(receipt,binding,resumed)).toBe(false)
 const turn=prepareDnd5eLongCastingCombatTurn(receipt,binding,resumed)!
 expect(turn.state.combatants.caster.turn.actionAvailable).toBe(false)
 expect(dnd5eLongCastingCanComplete(receipt,binding,turn.state)).toBe(false)
 expect(armDnd5eLongCastingCombatTurn(turn,binding,turn.state)).toBe(true)
 expect(dnd5eLongCastingCanComplete(receipt,binding,turn.state)).toBe(true)
 expect(armDnd5eLongCastingCombatTurn(turn,binding,turn.state)).toBe(false)
})

it('starts on the next round when the caster initiative has already passed',()=>{
 const {binding,receipt,state}=fixture(12);state.active=false
 continueDnd5eLongCastingOutsideCombat(receipt,binding,state,480)
 state.active=true;state.combatId='second';state.initiativeIndex=1;state.round=7
 expect(continueDnd5eLongCastingInsideCombat(receipt,binding,state,481)).toEqual({combatId:'second',requiredRounds:1,lastPaidRound:7})
 state.initiativeIndex=0;state.combatants.caster.turn.actionAvailable=true
 expect(prepareDnd5eLongCastingCombatTurn(receipt,binding,state)).toBeUndefined()
 state.round=8
 const proposal=prepareDnd5eLongCastingCombatTurn(receipt,binding,state)!
 expect(armDnd5eLongCastingCombatTurn(proposal,binding,proposal.state)).toBe(true)
 expect(dnd5eLongCastingCanComplete(receipt,binding,proposal.state)).toBe(true)
})

it('does not charge another action when exploration already completed the duration',()=>{
 const {binding,receipt,state}=fixture(11);state.active=false
 continueDnd5eLongCastingOutsideCombat(receipt,binding,state,480)
 state.active=true;state.combatId='second';state.initiativeIndex=1
 state.combatants.caster.turn.actionAvailable=true
 expect(continueDnd5eLongCastingInsideCombat(receipt,binding,state,481)?.requiredRounds).toBe(0)
 expect(dnd5eLongCastingCanComplete(receipt,binding,state)).toBe(true)
 expect(prepareDnd5eLongCastingCombatTurn(receipt,binding,state)).toBeUndefined()
 expect(state.combatants.caster.turn.actionAvailable).toBe(true)
})

it('rejects an old turn proposal even after reentry reuses its round number',()=>{
 const {binding,receipt,state}=fixture()
 const next=structuredClone(state);next.round=2;next.combatants.caster.turn.actionAvailable=true
 const old=prepareDnd5eLongCastingCombatTurn(receipt,binding,next)!
 state.active=false;continueDnd5eLongCastingOutsideCombat(receipt,binding,state,480)
 const resumed=structuredClone(next);resumed.combatId='second'
 expect(continueDnd5eLongCastingInsideCombat(receipt,binding,resumed,480)).toBeTruthy()
 // Supplying a newer committed snapshot must not legitimize an old proposal.
 resumed.combatants.caster.turn.actionAvailable=false
 expect(armDnd5eLongCastingCombatTurn(old,binding,resumed)).toBe(false)
 expect(dnd5eLongCastingCanComplete(receipt,binding,resumed)).toBe(false)
})

it.each(['forged','binding','inactive','same-combat','clock-backwards','fractional-clock','missing-actor','duplicate-actor','lost-concentration'] as const)(
 'rejects invalid reentry: %s',kind=>{
 const {binding,receipt,state}=fixture();state.active=false
 continueDnd5eLongCastingOutsideCombat(receipt,binding,state,480)
 state.active=kind!=='inactive';state.combatId=kind==='same-combat'?'combat':'second'
 if(kind==='missing-actor')state.initiativeOrder=['enemy']
 if(kind==='duplicate-actor')state.initiativeOrder=['caster','caster']
 if(kind==='lost-concentration')state.combatants.caster.concentrating=false
 expect(continueDnd5eLongCastingInsideCombat(kind==='forged'?JSON.parse(JSON.stringify(receipt)):receipt,
  kind==='binding'?{...binding,requestId:'other'}:binding,state,
  kind==='clock-backwards'?479:kind==='fractional-clock'?480.5:480)).toBeUndefined()
})
