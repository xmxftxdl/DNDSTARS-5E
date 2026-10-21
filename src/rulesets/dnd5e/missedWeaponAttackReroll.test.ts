import {previewDnd5eMonsterParryReaction} from './headlessCombatEngine'
import {dnd5e2014Adapter as rules} from './dnd5e2014Adapter'
import {expect,it} from 'vitest'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eMissedWeaponAttackRerollFeatures,type Dnd5eAction} from './headlessCombatEngine'
const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,initiative,controller:'player',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
function fixture(){
 let featureId=''
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.miss-reroll',name:'Reroll',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){featureId=api.registerFeature({id:'accuracy',name:'Accuracy',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'accuracy',name:'Accuracy',description:'Synthetic',level:17,trigger:{kind:'after-attack-miss'},cost:{economy:'none'},targeting:{kind:'self'},effects:[],automation:'full',mechanic:{kind:'missed-weapon-attack-reroll',weaponQualification:'monk-weapon',ownTurnOnly:true,usesPerTurn:1}}})}})
 const source=make('source',20);source.pluginFeatureIds=[featureId]
 const state=startDnd5eHeadlessCombat('reroll',[source,make('target',10)])
 const action:Extract<Dnd5eAction,{type:'attack'}>={type:'attack',actorId:'source',targetId:'target',attackModifier:0,d20:2,damage:{count:1,sides:4,bonus:0,rolls:[3],type:'slashing'},classDamageContext:{weaponId:'held-instance',weaponBaseId:'dnd5e-shortsword',monkWeapon:true,mode:'melee',finesse:true,strengthBased:false,weaponDamageSides:4,damageType:'slashing',adjacentEnemyOfTarget:false}}
 return {state,action,featureId,dispose}
}
it.each(['normal','advantage','disadvantage'] as const)('rerolls a missed attack with its original %s mode and spends the turn usage once',mode=>{
 const {state,action,featureId,dispose}=fixture()
 try{
  action.mode=mode;action.d20Second=mode==='normal'?undefined:mode==='disadvantage'?18:3
  action.missedWeaponAttackReroll={featureId,d20:mode==='disadvantage'?17:18,dieIndex:0}
  const result=resolveDnd5eHeadlessAction(state,action)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.events.filter(e=>e.type==='attack-resolved')).toHaveLength(1)
  expect(result.events.find(e=>e.type==='attack-resolved')).toMatchObject({hit:true,d20:mode==='disadvantage'?17:18})
  expect(result.events.find(e=>e.type==='attack-resolved')).toMatchObject({d20Rolls:mode==='normal'?[18]:mode==='advantage'?[18,3]:[17,18]})
  expect(result.state.combatants.target.currentHp).toBe(27)
  expect(dnd5eMissedWeaponAttackRerollFeatures(JSON.parse(JSON.stringify(result.state)),'source',action.classDamageContext)).toHaveLength(0)
  const again=structuredClone(result.state);again.combatants.source.turn.actionAvailable=true
  expect(resolveDnd5eHeadlessAction(again,action).ok).toBe(false)
  const end=resolveDnd5eHeadlessAction(result.state,{type:'end-turn',actorId:'source'})
  const next=resolveDnd5eHeadlessAction(end.state,{type:'end-turn',actorId:'target'})
  expect(next.ok).toBe(true)
  expect(dnd5eMissedWeaponAttackRerollFeatures(next.state,'source',action.classDamageContext)).toHaveLength(1)
  expect(state.combatants.target.currentHp).toBe(30)
 }finally{dispose()}
})
it('uses the new result even when worse, while declining consumes no usage',()=>{
 const {state,action,featureId,dispose}=fixture()
 try{
  const declined=resolveDnd5eHeadlessAction(state,action)
  expect(declined.ok).toBe(true)
  expect(dnd5eMissedWeaponAttackRerollFeatures(declined.state,'source',action.classDamageContext)).toHaveLength(1)
  const result=resolveDnd5eHeadlessAction(state,{...action,missedWeaponAttackReroll:{featureId,d20:1,dieIndex:0}})
  expect(result.ok).toBe(true)
  expect(result.events.find(e=>e.type==='attack-resolved')).toMatchObject({hit:false,d20:1})
  expect(result.state.combatants.target.currentHp).toBe(30)
  expect(dnd5eMissedWeaponAttackRerollFeatures(result.state,'source',action.classDamageContext)).toHaveLength(0)
 }finally{dispose()}
})
it.each(['hit','unowned','unarmed','spell','non-monk','invalid-die','invalid-index','off-turn'] as const)('rejects %s without changing the input',kind=>{
 const {state,action,featureId,dispose}=fixture()
 try{
  action.missedWeaponAttackReroll={featureId,d20:18,dieIndex:0}
  if(kind==='hit')action.d20=18
  if(kind==='unowned')state.combatants.source.pluginFeatureIds=[]
  if(kind==='unarmed')action.classDamageContext!.unarmedStrike=true
  if(kind==='spell')action.classDamageContext!.spellAttack=true
  if(kind==='non-monk')action.classDamageContext!.monkWeapon=false
  if(kind==='invalid-die')action.missedWeaponAttackReroll.d20=21
  if(kind==='invalid-index'){action.missedWeaponAttackReroll.dieIndex=1}
  if(kind==='off-turn')state.initiativeIndex=1
  const before=JSON.stringify(state)
  expect(resolveDnd5eHeadlessAction(state,action).ok).toBe(false)
  expect(JSON.stringify(state)).toBe(before)
 }finally{dispose()}
})

it('retains the other disadvantage die and honors choosing the second die',()=>{
 const {state,action,featureId,dispose}=fixture()
 try{
  const result=resolveDnd5eHeadlessAction(state,{...action,mode:'disadvantage',d20:2,d20Second:3,missedWeaponAttackReroll:{featureId,d20:20,dieIndex:1}})
  expect(result.ok).toBe(true)
  expect(result.events.find(e=>e.type==='attack-resolved')).toMatchObject({hit:false,d20:2,d20Rolls:[2,20]})
  expect(result.state.combatants.target.currentHp).toBe(30)
 }finally{dispose()}
})

it.each([false,true])('opens Shield after the reroll and spends its slot/reaction only once (prior Shield %s)',priorShield=>{
 const {state,action,featureId,dispose}=fixture()
 try{
  const target=state.combatants.target
  target.classId='sorcerer';target.level=3;target.classSelections={'spell-known':['shield']}
  target.classResources={'dnd5e-spell-slot-1':{current:2,max:2}}
  const result=resolveDnd5eHeadlessAction(state,{...action,d20:priorShield?14:2,shieldSpellReaction:priorShield,
    missedWeaponAttackReroll:{featureId,d20:priorShield?18:14,dieIndex:0,...(priorShield?{}:{shieldSpellReaction:true})}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.events.filter(e=>e.type==='spell-cast'&&e.spellId==='shield')).toHaveLength(1)
  expect(result.state.combatants.target.classResources['dnd5e-spell-slot-1'].current).toBe(1)
  expect(result.state.combatants.target.turn.reactionAvailable).toBe(false)
  expect(result.events.find(e=>e.type==='attack-resolved')).toMatchObject({hit:priorShield,armorClass:17})
  expect(result.state.combatants.target.currentHp).toBe(priorShield?27:30)
 }finally{dispose()}
})
it.each([false,true])('opens monster parry after the reroll without reusing a spent reaction (prior parry %s)',priorParry=>{
 const {state,action,featureId,dispose}=fixture()
 try{
  state.combatants.target.statBlockId='srd-5.1:bandit-captain'
  const result=resolveDnd5eHeadlessAction(state,{...action,d20:priorParry?13:2,missedWeaponAttackReroll:{featureId,d20:priorParry?15:13,dieIndex:0}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.events.filter(e=>e.type==='monster-parry-used')).toHaveLength(1)
  expect(result.state.combatants.target.turn.reactionAvailable).toBe(false)
  expect(result.events.find(e=>e.type==='attack-resolved')).toMatchObject({hit:priorParry,armorClass:14})
  expect(result.state.combatants.target.currentHp).toBe(priorParry?27:30)
 }finally{dispose()}
})

it.each([false,true])('uses a granted AC die once before or after a reroll (before %s)',before=>{
 const {state,action,featureId,dispose}=fixture()
 let defenseId=''
 const stop=registerDnd5eRulesPlugin({manifest:{id:'test.reroll-defense',name:'Defense',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){defenseId=api.registerFeature({id:'defense',name:'Defense',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'defense',name:'Defense',description:'Synthetic',level:1,trigger:{kind:'after-attack-roll'},targeting:{kind:'single-creature',relation:'ally'},effects:[],automation:'full',mechanic:{kind:'granted-die-combat-options',dieState:'bardic-inspiration',addToArmorClassAgainstAttack:true}}})}})
 try{
  const bard=make('bard',5);bard.pluginFeatureIds=[defenseId];state.combatants.bard=bard
  Object.assign(state.combatants.target.classState,{bardicInspirationDie:6,bardicInspirationSourceId:'bard',bardicInspirationRoundsRemaining:10})
  const result=resolveDnd5eHeadlessAction(state,{...action,d20:before?13:2,...(before?{grantedDieArmorClassRoll:3}:{}),missedWeaponAttackReroll:{featureId,d20:before?18:13,dieIndex:0,...(before?{}:{grantedDieArmorClassRoll:3})}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.events.find(e=>e.type==='attack-resolved')).toMatchObject({hit:before,armorClass:15})
  expect(result.state.combatants.target.currentHp).toBe(before?27:30)
  expect(result.state.combatants.target.classState.bardicInspirationDie).toBeUndefined()
  expect(result.state.combatants.target.turn.reactionAvailable).toBe(false)
  const duplicate=resolveDnd5eHeadlessAction(state,{...action,d20:13,grantedDieArmorClassRoll:3,missedWeaponAttackReroll:{featureId,d20:18,dieIndex:0,grantedDieArmorClassRoll:3}})
  expect(duplicate.ok).toBe(false)
 }finally{stop();dispose()}
})
it('cannot turn an underwater beyond-normal-range automatic miss into a hit by rerolling',()=>{
 const {state,action,featureId,dispose}=fixture()
 try{
  state.environment='underwater'
  state.combatants.target.position={x:200,y:0}
  action.classDamageContext={...action.classDamageContext!,mode:'ranged',weaponBaseId:'dnd5e-longbow',normalRangeFeet:150,longRangeFeet:600,distanceFeet:200}
  const result=resolveDnd5eHeadlessAction(state,{...action,d20:2,d20Second:20,missedWeaponAttackReroll:{featureId,d20:20,dieIndex:0}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.events.find(e=>e.type==='attack-resolved')).toMatchObject({hit:false,critical:false})
  expect(result.state.combatants.target.currentHp).toBe(30)
  expect(dnd5eMissedWeaponAttackRerollFeatures(result.state,'source',action.classDamageContext)).toHaveLength(0)
 }finally{dispose()}
})

it('previews automatic parry without spending the reaction, so a parried hit can offer a reroll',()=>{
 const {state,action,featureId,dispose}=fixture()
 try{
  const target=state.combatants.target;target.statBlockId='srd-5.1:bandit-captain'
  const before=JSON.stringify(state)
  const attack=rules.resolveAttack({rolls:[13],mode:'normal',modifier:0,targetAc:12})
  const input={state,attacker:state.combatants.source,target,attack,targetArmorClass:12,hit:true,critical:false,meleeAttack:true}
  expect(previewDnd5eMonsterParryReaction(input)).toMatchObject({hit:false,armorClass:14,used:true})
  expect(JSON.stringify(state)).toBe(before)
  const done=resolveDnd5eHeadlessAction(state,{...action,d20:13,missedWeaponAttackReroll:{featureId,d20:15,dieIndex:0}})
  expect(done.ok).toBe(true)
  expect(done.events.find(e=>e.type==='attack-resolved')).toMatchObject({hit:true,armorClass:14})
  expect(previewDnd5eMonsterParryReaction({...input,critical:true})).toMatchObject({used:false})
  expect(previewDnd5eMonsterParryReaction({...input,meleeAttack:false})).toMatchObject({used:false})
  target.turn.reactionAvailable=false
  expect(previewDnd5eMonsterParryReaction(input)).toMatchObject({used:false})
 }finally{dispose()}
})
