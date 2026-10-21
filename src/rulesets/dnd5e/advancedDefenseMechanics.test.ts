import { afterEach, expect, it } from 'vitest'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey } from './headlessCombatEngine'
import type { DeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'
import { validateDeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'
import { dnd5eActivityFromDeclarativeSubclassAbility } from './activities/legacyContentActivityAdapters'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'

it('validates Host-generated bindings for redirection and attack tradeoffs', () => {
 for (const mechanic of [
  {kind:'missed-melee-redirection',rangeFeet:5},
  {kind:'attack-tradeoff',attackRollModifier:-3,damageBonus:6,attackModes:['melee']},
 ] as const) {
  const ability: DeclarativeSubclassAbilityV1 = {schemaVersion:1,id:'probe',name:'Probe',description:'Synthetic',level:1,
   trigger:{kind:mechanic.kind==='missed-melee-redirection'?'after-attack-miss':'before-attack-roll'},
   cost:{economy:mechanic.kind==='missed-melee-redirection'?'reaction':'none'},targeting:{kind:'self'},effects:[],mechanic,automation:'full'}
  expect(()=>validateDeclarativeSubclassAbilityV1(ability)).not.toThrow()
  const projected=dnd5eActivityFromDeclarativeSubclassAbility(ability,{subclassId:'probe-subclass'})
  expect(projected.authorityBinding?.kind).toBe('declarative-subclass-mechanic')
  expect(validateDnd5eActivityDefinitionV1(projected)).toEqual([])
 }
})
let dispose: (()=>void)|undefined
afterEach(()=>dispose?.())
function setup(mechanic: NonNullable<DeclarativeSubclassAbilityV1['mechanic']>) {
 const mitigation=mechanic.kind==='damage-mitigation-interrupt'
 dispose=registerDnd5eRulesPlugin({manifest:{id:'local.defense',name:'Synthetic defense',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){api.registerDeclarativeSubclass({schemaVersion:1,id:'defender',classId:'fighter',name:'Defender',summary:'Synthetic.',abilities:[{schemaVersion:1,id:'guard',name:'Guard',description:'Synthetic.',level:1,trigger:{kind:mechanic.kind==='missed-melee-redirection'?'after-attack-miss':mitigation?'before-damage-taken':'after-d20-roll'},targeting:mechanic.kind==='missed-melee-redirection'?{kind:'self'}:{kind:'single-creature',relation:mitigation?'ally':'any',rangeFeet:10,includeSelf:true},cost:{economy:'reaction',...(mechanic.kind==='missed-melee-redirection'?{resources:[{resourceId:'dnd5e-ki',scope:'core',amount:1}]}:{})},mechanic,effects:[],automation:'full'}]})}})
 const make=(id:string,controller:'dm'|'player',initiative:number)=>createDnd5eCombatant({id,name:id,controller,initiative,level:18,classId:'fighter',classLevels:{fighter:18},subclassId:'local.defense:defender',subclassIds:{fighter:'local.defense:defender'},pluginFeatureIds:id==='guard'?['local.defense:defender.guard']:[],abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:6,armorClass:12,currentHp:40,maxHp:40,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('test',[make('enemy','dm',20),make('guard','player',10),make('ally','player',5)])
 state.distanceFeetByCombatantPair=Object.fromEntries(['enemy','guard','ally'].flatMap(a=>['enemy','guard','ally'].map(b=>[dnd5eCombatantPairKey(a,b),a===b?0:5])))
 return state
}
it('reduces AC failure damage once, preserves existing resistance, and cleans up the transaction defense',()=>{
 const state=setup({kind:'post-d20-adjustment',rollKinds:['attack'],directions:['subtract'],dieSides:8,scope:'attack-against-nearby',resistanceWhenStillHit:true})
 const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'enemy',targetId:'ally',d20:18,attackModifier:5,spendAction:false,postD20Adjustment:{sourceId:'guard',featureId:'local.defense:defender.guard',direction:'subtract',roll:2},damage:{count:1,sides:10,bonus:0,rolls:[9],type:'fire'}})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 expect(result.state.combatants.ally.currentHp).toBe(36)
 expect(result.state.combatants.guard.turn.reactionAvailable).toBe(false)
 expect(result.state.combatants.ally.classState.activeEffects?.some(e=>e.tags?.includes('transaction-attack-resistance'))).toBe(false)
 const next=resolveDnd5eHeadlessAction(result.state,{type:'attack',actorId:'enemy',targetId:'ally',d20:18,attackModifier:5,spendAction:false,damage:{count:1,sides:10,bonus:0,rolls:[9],type:'fire'}})
 expect(next.state.combatants.ally.currentHp).toBe(27)
})
it('transfers the full resolved packet at the upgraded class-level range',()=>{
 const state=setup({kind:'damage-mitigation-interrupt',mode:'transfer',protects:'ally-or-self',expandedRange:{level:18,feet:30}})
 state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('guard','ally')]=25
 const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'enemy',targetId:'ally',d20:18,attackModifier:5,spendAction:false,damageMitigationInterrupts:[{sourceId:'guard',targetId:'ally',featureId:'local.defense:defender.guard'}],damage:{count:1,sides:10,bonus:0,rolls:[9],type:'fire'}})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 expect(result.state.combatants.ally.currentHp).toBe(40)
 expect(result.state.combatants.guard.currentHp).toBe(31)
})
it('persists a post-use casting limit and rejects leveled casting atomically',()=>{
 const state=setup({kind:'post-d20-adjustment',rollKinds:['attack'],directions:['subtract'],fixedAmount:2,scope:'attack-against-self',maximumSpellLevelAfterUse:0})
 const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'enemy',targetId:'guard',d20:8,attackModifier:5,spendAction:false,postD20Adjustment:{sourceId:'guard',featureId:'local.defense:defender.guard',direction:'subtract',roll:2},damage:{count:1,sides:10,bonus:0,rolls:[9],type:'fire'}})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 expect(result.state.combatants.guard.currentHp).toBe(40)
 const state2=JSON.parse(JSON.stringify(result.state));state2.initiativeIndex=1
 const cast=resolveDnd5eHeadlessAction(state2,{type:'adjudicated-spell',actorId:'guard',spellId:'synthetic',spellName:'Synthetic',spellLevel:1,slotLevel:1,castingTime:'action',effects:[]})
 expect(cast).toMatchObject({ok:false,reason:'spellcasting-prohibited'})
})

it('redirects a missed melee attack automatically, spends one reaction and resource, and rejects a forged critical',()=>{
 const state=setup({kind:'missed-melee-redirection',rangeFeet:5})
 state.combatants.guard.classResources['dnd5e-ki']={current:2,max:2}
 state.combatants.ally.armorClass=99
 const attack={type:'attack' as const,actorId:'enemy',targetId:'guard',d20:2,attackModifier:0,spendAction:false,classDamageContext:{mode:'melee' as const,finesse:false,strengthBased:true,weaponDamageSides:8,damageType:'slashing' as const,adjacentEnemyOfTarget:false},damage:{count:1,sides:8,bonus:3,rolls:[],type:'slashing' as const},standAgainstTide:{featureId:'local.defense:defender.guard',targetId:'ally',distanceFeet:5,d20:10,damageRolls:[[6]]}}
 const result=resolveDnd5eHeadlessAction(state,attack)
 expect(result.ok,JSON.stringify(result)).toBe(true)
 expect(result.state.combatants.ally.currentHp).toBe(31)
 expect(result.state.combatants.guard.classResources['dnd5e-ki'].current).toBe(1)
 expect(result.state.combatants.guard.turn.reactionAvailable).toBe(false)
 expect(result.events.filter(e=>e.type==='attack-resolved')).toMatchObject([{hit:false},{hit:true,critical:false}])
 const forged=resolveDnd5eHeadlessAction(state,{...attack,standAgainstTide:{...attack.standAgainstTide,d20:20}})
 expect(forged.ok).toBe(false)
 expect(state.combatants.guard.classResources['dnd5e-ki'].current).toBe(2)
 state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('guard','ally')]=10
 expect(resolveDnd5eHeadlessAction(state,attack).ok).toBe(false)
})
