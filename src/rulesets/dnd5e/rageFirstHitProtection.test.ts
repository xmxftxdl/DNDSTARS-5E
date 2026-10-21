import {it,expect} from 'vitest'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {validateDeclarativeSubclassAbilityV1} from './declarativeSubclassAbility'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eSourceMarkedAttackDisadvantage,dnd5eCombatantPairKey} from './headlessCombatEngine'

const ability={schemaVersion:1 as const,id:'ancestral-protectors',name:'Protection fixture',description:'Synthetic first-hit protection fixture.',level:3,trigger:{kind:'passive' as const},targeting:{kind:'self' as const},effects:[],mechanic:{kind:'rage-first-hit-protection' as const},automation:'full' as const}
it('rejects active-use, paid and targeted declarations for the automatic first-hit mechanic',()=>{
 expect(()=>validateDeclarativeSubclassAbilityV1(ability)).not.toThrow()
 for(const patch of [{trigger:{kind:'active-use'}},{cost:{economy:'action'}},{targeting:{kind:'single-creature',relation:'enemy'}},{mechanic:{kind:'rage-first-hit-protection',arbitrary:true}}]) expect(()=>validateDeclarativeSubclassAbilityV1({...ability,...patch})).toThrow()
})
it('settles first-hit protection, exclusions, lifecycle and attack-wide resistance through real actions',()=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.rage-mark',name:'Synthetic fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0'},setup(api){api.registerDeclarativeSubclass({schemaVersion:1,id:'protector',classId:'barbarian',name:'Fixture',summary:'Synthetic fixture',abilities:[ability]})}})
 const subclassId='test.rage-mark:protector',featureId=subclassId+'.ancestral-protectors'
 const make=(id:string,initiative:number,patch:any={})=>createDnd5eCombatant({id,name:id,controller:id==='guard'?'player':'dm',initiative,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,...patch})
 const fresh=(patch:any={})=>startDnd5eHeadlessCombat('mark',[make('guard',30,{classId:'barbarian',classLevels:{barbarian:3},subclassId,subclassIds:{barbarian:subclassId},pluginFeatureIds:[featureId],classState:{raging:true,rageTurnsRemaining:10},...patch}),make('marked',20),make('other',10)])
 const hit=(s:any,actorId:string,targetId:string,d20=18)=>resolveDnd5eHeadlessAction(s,{type:'attack',actorId,targetId,attackModifier:10,d20,d20Second:17,spendAction:false,damage:{count:1,sides:10,bonus:0,rolls:[9],type:'fire'}} as any)
 try{
  let s=fresh();let r=hit(s,'guard','marked');expect(r.ok,JSON.stringify(r)).toBe(true);s=r.state
  expect(s.combatants.guard.classState.rageAttackMark?.targetId).toBe('marked')
  r=hit(s,'guard','other');expect(r.ok).toBe(true);s=r.state
  expect(s.combatants.guard.classState.rageAttackMark?.targetId).toBe('marked')
  expect(dnd5eSourceMarkedAttackDisadvantage(s.combatants.marked,s.combatants.other,s)).toBe(true)
  expect(dnd5eSourceMarkedAttackDisadvantage(s.combatants.marked,s.combatants.guard,s)).toBe(false)
  const end=resolveDnd5eHeadlessAction(s,{type:'end-turn',actorId:'guard'});expect(end.ok,JSON.stringify(end)).toBe(true);s=end.state
  const before=s.combatants.other.currentHp;r=hit(s,'marked','other');expect(r.ok,JSON.stringify(r)).toBe(true)
  expect(r.events.find(e=>e.type==='attack-resolved')).toMatchObject({rollMode:'disadvantage'})
  expect(before-r.state.combatants.other.currentHp).toBe(4)
  const direct=hit(s,'marked','guard');expect(direct.ok).toBe(true);expect(s.combatants.guard.currentHp-direct.state.combatants.guard.currentHp).toBe(9)
  const ownStart=resolveDnd5eHeadlessAction(s,{type:'end-turn',actorId:'marked'});expect(ownStart.ok).toBe(true)
  const next=resolveDnd5eHeadlessAction(ownStart.state,{type:'end-turn',actorId:'other'});expect(next.ok).toBe(true);expect(next.state.combatants.guard.classState.rageAttackMark).toBeUndefined()

  // Ending rage is only legal on the actor's own turn; use that actual path from the earlier snapshot.
  const ownEnded=resolveDnd5eHeadlessAction(hit(fresh(),'guard','marked').state,{type:'barbarian-rage',actorId:'guard',end:true});expect(ownEnded.ok,JSON.stringify(ownEnded)).toBe(true);expect(ownEnded.state.combatants.guard.classState.rageAttackMark).toBeUndefined()
  for(const patch of [{classState:{}},{pluginFeatureIds:[]},{classLevels:{barbarian:2}}])expect(hit(fresh(patch),'guard','marked').state.combatants.guard.classState.rageAttackMark).toBeUndefined()

  // A miss does not consume the turn's first successful creature hit.
  const missed=hit(fresh(),'guard','marked',1);expect(missed.ok).toBe(true)
  expect(missed.state.combatants.guard.classState.rageAttackMark).toBeUndefined()
  expect(hit(missed.state,'guard','other').state.combatants.guard.classState.rageAttackMark?.targetId).toBe('other')
  const off=resolveDnd5eHeadlessAction(fresh(),{type:'end-turn',actorId:'guard'});expect(off.ok).toBe(true)
  off.state.combatants.guard.classState.raging=true
  const reaction=resolveDnd5eHeadlessAction(off.state,{type:'opportunity-attack',actorId:'guard',targetId:'marked',attackModifier:10,d20:18,damage:{count:1,sides:10,bonus:0,rolls:[9],type:'fire'}})
  expect(reaction.ok,JSON.stringify(reaction)).toBe(true);expect(reaction.state.combatants.guard.classState.rageAttackMark).toBeUndefined()
  const stack=structuredClone(s);stack.combatants.other.damageResistances=['fire']
  expect(stack.combatants.other.currentHp-hit(stack,'marked','other').state.combatants.other.currentHp).toBe(4)
  const magic=structuredClone(s);Object.assign(magic.combatants.marked,{classId:'wizard',level:1,classLevels:{wizard:1},classSelections:{'spell-cantrips':['fire-bolt','poison-spray']},abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10}})
  magic.combatants.other.controller='player';magic.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('marked','other')]:10}
  const bolt=resolveDnd5eHeadlessAction(magic,{type:'cast-spell',actorId:'marked',targetId:'other',spellId:'fire-bolt',slotLevel:0,d20:18,d20Second:17,effectRolls:[9]})
  expect(bolt.ok,JSON.stringify(bolt)).toBe(true);expect(magic.combatants.other.currentHp-bolt.state.combatants.other.currentHp).toBe(4)
  const spray=resolveDnd5eHeadlessAction(magic,{type:'cast-spell',actorId:'marked',targetId:'other',spellId:'poison-spray',slotLevel:0,savingThrowD20:1,effectRolls:[9]})
  expect(spray.ok,JSON.stringify(spray)).toBe(true);expect(magic.combatants.other.currentHp-spray.state.combatants.other.currentHp).toBe(9)
  const reload=JSON.parse(JSON.stringify(s));expect(dnd5eSourceMarkedAttackDisadvantage(reload.combatants.marked,reload.combatants.other,reload)).toBe(true)
  delete reload.combatants.guard;expect(dnd5eSourceMarkedAttackDisadvantage(reload.combatants.marked,reload.combatants.other,reload)).toBe(false)
 }finally{dispose()}
})
