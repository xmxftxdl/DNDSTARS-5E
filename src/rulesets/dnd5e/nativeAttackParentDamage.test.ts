import { afterEach, expect, it } from 'vitest'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft, createDnd5eCustomMonsterMechanicDraft } from './customMonsterWorkshop'
import { setDnd5eRoomMonsterCatalog } from './monsters'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eAction } from './headlessCombatEngine'

const pluginId='test.parent-native',featureId=`${pluginId}:lineage.rider`
afterEach(()=>setDnd5eRoomMonsterCatalog([]))
function registerRider(mode?: 'active' | 'rolled' | 'scaling') {
  return registerDnd5eRulesPlugin({manifest:{id:pluginId,name:'Parent damage',version:'1.0.0',apiVersion:2,
    rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    api.registerDeclarativeSubclass({schemaVersion:1,id:'lineage',classId:'fighter',name:'Lineage',summary:'Test',abilities:[{
      schemaVersion:1,id:'rider',name:'Rider',description:'Rider',level:1,automation:'full',trigger:{kind:mode === 'active' ? 'active-use' : 'after-attack-hit'},
      cost:{economy:'none'},targeting:{kind:'single-creature',relation:'any'},
      rolls:[{id:'fixed',label:'Fixed rider',kind:'damage',dice:{count:mode === 'rolled' ? 1 : 0,sides:6,modifier:{kind:'fixed',value:3},...(mode === 'scaling' ? {scaling:{basis:'class-level' as const,classId:'fighter' as const,steps:[{level:2,addDice:1}]}} : {})},damageType:'parent-weapon'}],
      effects:[{kind:'damage',target:'target',rollId:'fixed'}],
    }]})
  }})
}
function fixture() {
  const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,initiative,
    controller:id === 'actor' ? 'player' : 'dm',abilities:{str:10,dex:10,con:10,int:16,wis:10,cha:10},
    proficiencyBonus:2,armorClass:10,currentHp:60,maxHp:60,temporaryHp:0,speed:30,
    position:{x:0,y:0},concentrating:false,classLevels:id === 'actor' ? {fighter:1} : undefined,subclassIds:id === 'actor' ? {fighter:`${pluginId}:lineage`} : undefined,pluginFeatureIds:id === 'actor' ? [featureId] : []})
  const state=startDnd5eHeadlessCombat('parent-native',[make('actor',20),make('target',10),make('hunter',5)])
  state.distanceFeetByCombatantPair=Object.fromEntries([['actor','target'],['actor','hunter'],['hunter','target']].map(([a,b])=>[dnd5eCombatantPairKey(a,b),5]))
  state.combatants.target.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'mark',label:'Mark',targetId:'target',
    source:{kind:'feature',actorId:'actor'},modifiers:{damageRollsBySourceBonus:2}})]
  return state
}
it.each(['rolled','fixed','resistant','miss','invalid'] as const)('monster attacks preserve parent damage semantics: %s',mode=>{
  const dispose=registerRider()
  try {
    const monster=buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    monster.actions[0].attack!.toHit=8
    monster.actions[0].attack!.damage=[{count:mode === 'fixed' ? 0 : 1,sides:6,bonus:mode === 'fixed' ? 4 : 0,average:4,type:'slashing'}]
    setDnd5eRoomMonsterCatalog([monster])
    const state=fixture();state.combatants.actor.statBlockId=monster.id
    if(mode === 'resistant')state.combatants.target.damageResistances=['slashing']
    const result=resolveDnd5eHeadlessAction(state,{type:'monster-action',actorId:'actor',actionId:monster.actions[0].id,
      rolls:[{targetId:'target',d20:mode === 'miss' ? 1 : 15,damageRolls:mode === 'miss' ? [] : [mode === 'fixed' ? [] : [mode === 'invalid' ? 7 : 4]]}]})
    expect(result.ok,result.ok ? undefined : result.reason).toBe(mode !== 'invalid')
    expect(result.state.combatants.target.currentHp).toBe(({rolled:51,fixed:53,resistant:56,miss:60,invalid:60})[mode])
    expect(result.events.filter(e=>e.type === 'declarative-subclass-trigger-rejected')).toHaveLength(0)
    expect(result.events.filter(e=>e.type === 'declarative-subclass-ability-resolved')).toHaveLength(['miss','invalid'].includes(mode) ? 0 : 1)
    expect(state.combatants.target.currentHp).toBe(60)
  } finally {dispose()}
})
it.each(['fire-bolt','scorching-ray'] as const)('native %s carries the damage type through each hit',spellId=>{
  const dispose=registerRider()
  try {
    const state=fixture()
    state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','target')]=30
    state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','hunter')]=30
    Object.assign(state.combatants.actor,{classId:'wizard',level:3,classSelections:{'spell-cantrips':['fire-bolt'],'spell-prepared':['scorching-ray']},classResources:{'dnd5e-spell-slot-2':{current:1,max:1}}})
    const action:Dnd5eAction=spellId === 'fire-bolt'
      ? {type:'cast-spell',actorId:'actor',targetId:'target',spellId,slotLevel:0,d20:15,effectRolls:[4]}
      : {type:'cast-spell',actorId:'actor',targetId:'target',targetIds:['target'],spellId,slotLevel:2,effectRolls:[],projectileTargetIds:['target','target','target'],
          targetAttacks:[0,1,2].map(()=>({targetId:'target',d20:15,effectRolls:[2,2]}))}
    const result=resolveDnd5eHeadlessAction(state,action)
    expect(result.ok,result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(spellId === 'fire-bolt' ? 51 : 33)
    expect(result.events.filter(e=>e.type === 'declarative-subclass-trigger-rejected')).toHaveLength(0)
    expect(result.events.filter(e=>e.type === 'damage-roll-bonus-applied')).toHaveLength(spellId === 'fire-bolt' ? 1 : 3)
  } finally {dispose()}
})
it('redirected attacks use the original attacker and original weapon type for the rider',()=>{
  const dispose=registerRider()
  try {
    const state=fixture()
    Object.assign(state.combatants.hunter,{armorClass:15,classId:'ranger',subclassId:'hunter',level:15,
      classSelections:{'superior-hunters-defense':['stand-against-tide']}})
    const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'actor',targetId:'hunter',d20:2,attackModifier:5,
      classDamageContext:{mode:'melee',finesse:false,strengthBased:true,weaponDamageSides:8,damageType:'slashing',adjacentEnemyOfTarget:false},
      damage:{count:1,sides:8,bonus:0,rolls:[],type:'slashing'},
      standAgainstTide:{targetId:'target',distanceFeet:5,d20:15,damageRolls:[[4]]}})
    expect(result.ok,result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(51)
    expect(result.state.combatants.hunter.currentHp).toBe(60)
    expect(result.events.filter(e=>e.type === 'declarative-subclass-trigger-rejected')).toHaveLength(0)
  } finally {dispose()}
})
it('returned missiles preserve the caught damage type for subsequent effects',()=>{
  const dispose=registerRider()
  try {
    const state=fixture();state.initiativeIndex=1
    Object.assign(state.combatants.actor,{classId:'monk',level:3,classResources:{'dnd5e-ki':{current:2,max:2}}})
    Object.assign(state.combatants.actor.classState,{deflectMissilesCatchTurnKey:'parent-native:1:target',deflectMissilesCatchSourceId:'target',deflectMissilesCatchDamageType:'piercing'})
    const result=resolveDnd5eHeadlessAction(state,{type:'monk-deflect-missiles-return',actorId:'actor',targetId:'target',distanceFeet:5,d20:15,damageRolls:[3]})
    expect(result.ok,result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(52)
    expect(result.events.filter(e=>e.type === 'declarative-subclass-trigger-rejected')).toHaveLength(0)
  } finally {dispose()}
})

it.each(['active','rolled','scaling'] as const)('does not loosen parent-type eligibility for %s declarations',mode=>{
  expect(()=>registerRider(mode)).toThrow('只有命中后 Host')
})
it('monster core spells expose their actual damage type to imported riders',()=>{
  const dispose=registerRider()
  try {
    const state=fixture();state.combatants.actor.statBlockId='srd-5.1:mage'
    state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','target')]=30
    state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','hunter')]=30
    const result=resolveDnd5eHeadlessAction(state,{type:'monster-core-spell',actorId:'actor',spellId:'fire-bolt',slotLevel:0,
      resolution:{schemaVersion:1,targetIds:['target'],d20:15,effectRolls:[[3,4]]}})
    expect(result.ok,result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(48)
    expect(result.events.filter(e=>e.type === 'declarative-subclass-trigger-rejected')).toHaveLength(0)
  } finally {dispose()}
})
it('each flurry hit gives its own fixed rider without granting another roll bonus',()=>{
  const dispose=registerRider()
  try {
    const state=fixture()
    Object.assign(state.combatants.actor,{classId:'monk',level:3,classResources:{'dnd5e-ki':{current:2,max:2}}})
    state.combatants.actor.classState.monkAttackActionTurnKey='parent-native:1:actor'
    const result=resolveDnd5eHeadlessAction(state,{type:'monk-unarmed-bonus',actorId:'actor',mode:'flurry',attackModifier:5,reachFeet:5,
      damageType:'bludgeoning',damage:{count:1,sides:4,bonus:0},attacks:[{targetId:'target',d20:15,damageRolls:[3]},{targetId:'target',d20:15,damageRolls:[3]}]})
    expect(result.ok,result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(44)
    expect(result.events.filter(e=>e.type === 'declarative-subclass-trigger-rejected')).toHaveLength(0)
  } finally {dispose()}
})
it('a pending monster attack retains parent damage after reloading its trigger',()=>{
  const dispose=registerRider()
  try {
    const draft=createDnd5eCustomMonsterDraft()
    draft.headlessMechanics=[{...createDnd5eCustomMonsterMechanicDraft(),id:'intercept',name:'Intercept',trigger:'movement',
      triggerSubject:'hostile-within',triggerRadiusFeet:30,movementComparison:'at-least',movementFeet:5,hpPercentageAtOrBelow:undefined,
      effectKind:'attack',effectTarget:'selected-subject',healingDice:'1d6+2',damageType:'piercing',attackToHit:6,attackEconomy:'reaction',limit:'once-per-turn'}]
    const monster=buildDnd5eCustomMonster(draft);setDnd5eRoomMonsterCatalog([monster])
    const state=fixture();state.combatants.actor.statBlockId=monster.id;state.initiativeIndex=1
    const moved=resolveDnd5eHeadlessAction(state,{type:'move',actorId:'target',to:{x:1,y:0},distance:5})
    expect(moved.ok).toBe(true)
    const pending=moved.events.find(e=>e.type === 'monster-mechanic-trigger-pending')
    if(pending?.type !== 'monster-mechanic-trigger-pending')throw Error('Missing trigger')
    const result=resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(moved.state)),{type:'resolve-monster-mechanic-trigger',actorId:'actor',snapshotId:pending.snapshot.id,
      roll:{actorId:'actor',mechanicId:'intercept',targetId:'target',attackRolls:[{effectId:'effect-0',targetId:'target',d20:15,damageRolls:[4]}]}})
    expect(result.ok,result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(49)
    expect(result.events.filter(e=>e.type === 'declarative-subclass-trigger-rejected')).toHaveLength(0)
  } finally {dispose()}
})
