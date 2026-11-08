import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat} from './headlessCombatEngine'
import {createDnd5eMechanicalEffect,createDnd5eConditionEffect} from './activeEffects'
import {transferSourceConcentrationEffect} from './curseTransfer'
function setup(){
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('Transfer-Ab',[make('caster',20),make('old',10),make('next',5)])
 state.round=2
 Object.assign(state.combatants.caster,{concentrating:true})
 Object.assign(state.combatants.caster.classState,{concentrationSpellId:'test:hex',concentrationRoundsRemaining:41,concentrationTargetIds:['old']})
 const effect={...createDnd5eMechanicalEffect({id:'original-instance',definitionId:'original-hex-dex',label:'Original curse',targetId:'old',source:{kind:'spell',actorId:'caster',rulesId:'test:hex',spellLevel:3,magical:true},duration:{type:'concentration',sourceActorId:'caster',concentrationId:'test:hex',remainingRounds:4800},tags:['curse','hex'],modifiers:{abilityCheckDisadvantages:['dex']}}),bearerZeroHitPointsTurnKey:'Transfer-Ab:1:caster'}
 state.combatants.old.classState.activeEffects=[effect]
 state.combatants.old.classState.concentrationEffectsBySource={caster:'test:hex'}
 return{state,effect,input:{actorId:'caster',targetId:'next',spellId:'test:hex',tags:['curse','hex']}}
}
it.each(['valid','unconscious-live-target','same-turn','foreign-owner','wrong-source-spell','source-incapacitated','source-ended','not-own-turn','dead-target','same-target','id-collision','ambiguous-old-bearers'])('preserves the authoritative original instance and source clock, or rejects without mutation: %s',mode=>{
 const {state,effect,input}=setup()
 if(mode==='unconscious-live-target'){state.combatants.next.currentHp=0;state.combatants.next.deathSaves.dead=false;state.combatants.next.classState.activeEffects=[createDnd5eConditionEffect({condition:'unconscious',targetId:'next',source:{kind:'feature'}})]}
 if(mode==='same-turn')effect.bearerZeroHitPointsTurnKey='Transfer-Ab:2:caster'
 if(mode==='foreign-owner')effect.source.actorId='next'
 if(mode==='wrong-source-spell')effect.source.rulesId='another:hex'
 if(mode==='source-incapacitated')state.combatants.caster.conditions=['incapacitated']
 if(mode==='source-ended')state.combatants.caster.concentrating=false
 if(mode==='not-own-turn')state.initiativeIndex=1
 if(mode==='dead-target')state.combatants.next.deathSaves.dead=true
 if(mode==='same-target')input.targetId='old'
 if(mode==='id-collision')state.combatants.next.classState.activeEffects=[structuredClone(effect)]
 if(mode==='ambiguous-old-bearers')state.combatants.next.classState.activeEffects=[{...structuredClone(effect),id:'second-original-instance'}]
 const before=structuredClone(state),success=mode==='valid'||mode==='unconscious-live-target'
 expect(transferSourceConcentrationEffect(state,input)).toBe(success)
 if(!success){expect(state).toEqual(before);return}
 expect(state.combatants.old.classState.activeEffects?.some(e=>e.id===effect.id)??false).toBe(false)
 const moved=state.combatants.next.classState.activeEffects?.find(e=>e.id===effect.id)
 const {bearerZeroHitPointsTurnKey:ignored,...original}=effect
 expect(moved).toEqual(original)
 expect(state.combatants.caster.classState.concentrationRoundsRemaining).toBe(41)
 expect(state.combatants.caster.classState.concentrationTargetIds).toEqual(['next'])
 expect(state.combatants.next.classState.concentrationEffectsBySource).toEqual({caster:'test:hex'})
 expect(state.combatants.old.classState.concentrationEffectsBySource).toEqual({})
 if(mode==='unconscious-live-target')expect(state.combatants.next.conditions).toContain('unconscious')
})
