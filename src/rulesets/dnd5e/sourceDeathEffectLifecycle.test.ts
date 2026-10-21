import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { validateDnd5eEffectDefinitionV1 } from './activities/dnd5eActivityValidation'
function combatant(id:string,initiative:number){return createDnd5eCombatant({id,name:id,controller:id==='killer'?'dm':'player',initiative,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})}
function setup(sourceId='caster'){
 const caster=combatant('caster',10),bearer=combatant('bearer',5),killer=combatant('killer',20)
 bearer.classState.activeEffects=[createDnd5eMechanicalEffect({id:'source-bound',definitionId:'bound',label:'Bound',source:{kind:'feature',actorId:sourceId,characterId:'caster-character'},targetId:'bearer',breakOn:['source-dies'],duration:{type:'permanent'},modifiers:{armorClassBonus:1}}),createDnd5eMechanicalEffect({id:'unrelated',definitionId:'unrelated',label:'Unrelated',source:{kind:'feature',actorId:'other'},targetId:'bearer',modifiers:{armorClassBonus:1}})]
 caster.classState.wardingBondParticipantCharacterId='caster-character'
 return startDnd5eHeadlessCombat('source-death',[killer,caster,bearer])
}
const attack=(targetId:string,amount:number)=>({type:'attack' as const,actorId:'killer',targetId,attackModifier:20,d20:15,damage:{count:1,sides:100,rolls:[amount],bonus:0,type:'bludgeoning' as const}})
describe('source death effect lifecycle',()=>{
 it('accepts, persists and validates the source death declaration',()=>{
  expect(validateDnd5eEffectDefinitionV1({schemaVersion:1,id:'bound',name:'Bound',duration:{kind:'rounds',rounds:10,expiresAt:'target-turn-end'},stacking:'replace',breakOn:['source-dies'],modifiers:[{kind:'armor-class',mode:'add',value:{kind:'constant',value:1}}]})).toEqual([])
  const saved=JSON.parse(JSON.stringify(setup().combatants.bearer.classState.activeEffects))
  expect(validateDnd5eActiveEffectsStrict(saved).ok).toBe(true)
  expect(normalizeDnd5eActiveEffects(saved)[0].breakOn).toEqual(['source-dies'])
 })
 it('removes effects on another bearer in the same committed fatal attack, without mutating the input',()=>{
  const state=setup();state.combatants.caster.usesDeathSaves=false
  const before=structuredClone(state)
  const result=resolveDnd5eHeadlessAction(state,attack('caster',30))
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.caster.deathSaves.dead).toBe(true)
  expect(result.state.combatants.bearer.classState.activeEffects?.map(e=>e.id)).toEqual(['unrelated'])
  expect(result.events).toContainEqual(expect.objectContaining({type:'active-effect-removed',targetId:'bearer',effectId:'source-bound'}))
  expect(state).toEqual(before)
 })
 it('keeps the binding when the source is only unconscious or the bearer dies',()=>{
  for(const [targetId,damage] of [['caster',10],['bearer',30]] as const){
   const result=resolveDnd5eHeadlessAction(setup(),attack(targetId,damage))
   expect(result.ok).toBe(true)
   expect(result.state.combatants.caster.deathSaves.dead).toBe(false)
   expect(result.state.combatants.bearer.classState.activeEffects?.some(e=>e.id==='source-bound')).toBe(true)
  }
 })
 it('follows a stable character source after token replacement and preserves missing sources',()=>{
  const remapped=setup('old-token');remapped.combatants.caster.usesDeathSaves=false
  const migrated=resolveDnd5eHeadlessAction(remapped,attack('caster',30))
  expect(migrated.ok).toBe(true)
  expect(migrated.state.combatants.bearer.classState.activeEffects?.some(e=>e.id==='source-bound')).toBe(false)
  const absent=setup('missing');absent.combatants.bearer.classState.activeEffects![0].source.characterId='missing-character'
  const unresolved=resolveDnd5eHeadlessAction(absent,attack('caster',30))
  expect(unresolved.ok).toBe(true)
  expect(unresolved.state.combatants.bearer.classState.activeEffects?.some(e=>e.id==='source-bound')).toBe(true)
 })
})

it('also clears source-bound effects when a player source fails the third death save',()=>{
 const state=setup()
 state.initiativeIndex=state.initiativeOrder.indexOf('caster')
 state.combatants.caster.currentHp=0
 state.combatants.caster.deathSaves={successes:0,failures:2,stable:false,dead:false}
 state.combatants.caster.usesDeathSaves=true
 const before=structuredClone(state)
 const result=resolveDnd5eHeadlessAction(state,{type:'death-save',actorId:'caster',d20:5})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 expect(result.state.combatants.caster.deathSaves.dead).toBe(true)
 expect(result.state.combatants.bearer.classState.activeEffects?.map(effect=>effect.id)).toEqual(['unrelated'])
 expect(state).toEqual(before)
})
