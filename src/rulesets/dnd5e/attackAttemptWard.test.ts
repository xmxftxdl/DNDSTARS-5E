import { expect, it } from 'vitest'
import { normalizeDnd5eAttackAttemptWard } from './attackAttemptWard'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { resolveDnd5eAppliedEffectDefinitionV1 } from './activities/dnd5eActivityExecutor'
import type { Dnd5eEffectDefinitionV1 } from './activities/dnd5eEffectContracts'
import {createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eAttackAttemptWardRequirements, dnd5eDeflectedMissileReturnTargets, dnd5eHeadlessTurnKey, commitDnd5eActivityExecution} from './headlessCombatEngine'
import {dnd5eSavingThrowMode} from './passiveDefenses'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {getDnd5eSrdMonster} from './monsters'

const ward={ability:'cha' as const,dc:17,frequency:'once-per-turn' as const,onFailure:'cannot-target-this-turn' as const,
  onSuccess:'source-next-turn-spell-save-disadvantage' as const}

it('uses a live caught missile to authorize ward saves after reaction consumption and preserves catch on rejection',()=>{
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='monk'?'player':'dm',initiative,
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
  currentHp:100,maxHp:100,temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0}})
 const bard=make('bard',20),monk=make('monk',10),other=make('other',5)
 Object.assign(monk,{classId:'monk',level:3,classResources:{'dnd5e-ki':{current:2,max:2}}})
 const effect=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',source:{kind:'plugin',actorId:'bard'},targetId:'bard',attackAttemptWard:ward})
 bard.classState.activeEffects=[effect]
 const state=startDnd5eHeadlessCombat('missile-ward',[bard,monk,other])
 state.distanceFeetByCombatantPair={'bard\u0000monk':5,'monk\u0000other':5}
 const turnKey=dnd5eHeadlessTurnKey(state,'monk')
 Object.assign(state.combatants.monk.classState,{deflectMissilesCatchSourceId:'bard',deflectMissilesCatchTurnKey:turnKey,deflectMissilesCatchDamageType:'piercing'})
 state.combatants.monk.turn.reactionAvailable=false
 const beforeCandidates=JSON.stringify(state)
 expect(dnd5eDeflectedMissileReturnTargets(state,'monk').map(t=>t.id)).toEqual(['bard','other'])
 expect(JSON.stringify(state)).toBe(beforeCandidates)
 const ineligible=structuredClone(state)
 ineligible.combatants.other.currentHp=0
 ineligible.distanceFeetByCombatantPair={'bard\u0000monk':61}
 expect(dnd5eDeflectedMissileReturnTargets(ineligible,'monk')).toEqual([])
 const attempt={type:'attack-ward-attempt' as const,actorId:'monk',targetId:'bard',turnKey,deflectMissilesReturn:true as const,
  saves:[{effectId:effect.id,targetId:'monk',d20:1}]}
 const attack={type:'monk-deflect-missiles-return' as const,actorId:'monk',targetId:'bard',distanceFeet:5,d20:15,damageRolls:[3]}
 expect(resolveDnd5eHeadlessAction(state,attack)).toMatchObject({ok:false,reason:'invalid-dice'})
 expect(resolveDnd5eHeadlessAction(state,{...attempt,deflectMissilesReturn:undefined})).toMatchObject({ok:false,reason:'reaction-unavailable'})
 const distant=structuredClone(state);distant.distanceFeetByCombatantPair={'bard\u0000monk':61}
 expect(resolveDnd5eHeadlessAction(distant,attempt)).toMatchObject({ok:false,reason:'invalid-target'})
 expect(resolveDnd5eHeadlessAction(state,{...attempt,legendaryActionId:'tail-swipe'}).ok).toBe(false)
 for(const invalid of ['expired','absent','no-ki']){
  const bad=structuredClone(state)
  if(invalid==='expired')bad.combatants.monk.classState.deflectMissilesCatchTurnKey='expired'
  if(invalid==='absent')bad.combatants.monk.classState.deflectMissilesCatchSourceId=undefined
  if(invalid==='no-ki')bad.combatants.monk.classResources['dnd5e-ki'].current=0
  expect(resolveDnd5eHeadlessAction(bad,attempt).ok).toBe(false)
  expect(dnd5eDeflectedMissileReturnTargets(bad,'monk')).toEqual([])
 }
 for(const d20 of [1,20]){
  const checked=resolveDnd5eHeadlessAction(state,{...attempt,saves:[{...attempt.saves[0],d20}]})
  expect(checked.ok,JSON.stringify(checked)).toBe(true)
  const result=resolveDnd5eHeadlessAction(checked.state,attack)
  expect(result.ok,JSON.stringify(result)).toBe(d20===20)
  expect(result.state.combatants.monk.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.monk.classResources['dnd5e-ki'].current).toBe(d20===20?1:2)
  if(d20===1){
   expect(dnd5eDeflectedMissileReturnTargets(result.state,'monk').map(t=>t.id)).toEqual(['other'])
   expect(result.state.combatants.monk.classState.deflectMissilesCatchSourceId).toBe('bard')
   expect(resolveDnd5eHeadlessAction(result.state,{...attack,targetId:'other'}).ok).toBe(true)
   const declined=resolveDnd5eHeadlessAction(result.state,{...attack,decline:true,damageRolls:[]})
   expect(declined.ok).toBe(true)
   expect(declined.state.combatants.monk.classResources['dnd5e-ki'].current).toBe(2)
   expect(declined.state.combatants.monk.classState.deflectMissilesCatchSourceId).toBeUndefined()
  } else expect(result.state.combatants.bard.currentHp).toBe(97)
 }
})

it.each(['volley','whirlwind-attack'] as const)('checks %s ward targets before the shared action cost',feature=>{
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='hunter'?'player':'dm',initiative,
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:4,armorClass:10,
  currentHp:100,maxHp:100,temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0}})
 const hunter=make('hunter',20),bard=make('bard',10),other=make('other',5)
 Object.assign(hunter,{classId:'ranger',subclassId:'hunter',level:11,classSelections:{multiattack:[feature]}})
 const effect=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',source:{kind:'plugin',actorId:'bard'},targetId:'bard',attackAttemptWard:ward})
 bard.classState.activeEffects=[effect]
 const state=startDnd5eHeadlessCombat('hunter-ward',[hunter,bard,other])
 const weaponMode=feature==='volley'?'ranged' as const:'melee' as const
 const attack={type:'ranger-hunter-multiattack' as const,actorId:'hunter',feature,weaponMode,attackModifier:5,
  damage:{count:1,sides:6,bonus:0,type:'slashing' as const},
  attacks:['other','bard'].map(targetId=>({targetId,d20:15,damageRolls:[3],classDamageContext:{mode:weaponMode,
   finesse:false,strengthBased:false,weaponDamageSides:6,damageType:'slashing' as const,adjacentEnemyOfTarget:false}}))}
 expect(resolveDnd5eHeadlessAction(state,attack)).toMatchObject({ok:false,reason:'invalid-dice'})
 for(const d20 of [1,20]){
  const checked=resolveDnd5eHeadlessAction(state,{type:'attack-ward-attempt',actorId:'hunter',targetId:'bard',
   turnKey:dnd5eHeadlessTurnKey(state,'hunter'),saves:[{effectId:effect.id,targetId:'hunter',d20}]})
  expect(checked.ok).toBe(true)
  const result=resolveDnd5eHeadlessAction(checked.state,attack)
  expect(result.ok,JSON.stringify(result)).toBe(d20===20)
  expect(result.state.combatants.hunter.turn.actionAvailable).toBe(d20!==20)
  expect(result.state.combatants.other.currentHp).toBe(d20===20?97:100)
  expect(result.state.combatants.bard.currentHp).toBe(d20===20?97:100)
  if(d20===1){
   const retarget=resolveDnd5eHeadlessAction(result.state,{...attack,attacks:[attack.attacks[0]]})
   expect(retarget.ok,JSON.stringify(retarget)).toBe(true)
   expect(retarget.state.combatants.other.currentHp).toBe(97)
   expect(retarget.state.combatants.hunter.turn.actionAvailable).toBe(false)
  }
 }
})

it.each(['martial-arts','flurry'] as const)('requires ward receipts before %s bonus action and ki costs',mode=>{
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='monk'?'player':'dm',initiative,
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
  currentHp:100,maxHp:100,temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0}})
 const monk=make('monk',20),bard=make('bard',10),other=make('other',5)
 Object.assign(monk,{classId:'monk',level:2,classResources:{'dnd5e-ki':{current:2,max:2}}})
 const effect=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',source:{kind:'plugin',actorId:'bard'},targetId:'bard',attackAttemptWard:ward})
 bard.classState.activeEffects=[effect]
 const state=startDnd5eHeadlessCombat('unarmed-ward',[monk,bard,other])
 const turnKey=dnd5eHeadlessTurnKey(state,'monk')
 state.combatants.monk.classState.monkAttackActionTurnKey=turnKey
 state.combatants.monk.classState.monkMartialArtsTurnKey=turnKey
 const attack={type:'monk-unarmed-bonus' as const,actorId:'monk',mode,attackModifier:5,reachFeet:5,
  damageType:'bludgeoning' as const,damage:{count:1,sides:4,bonus:0},
  attacks:[...(mode==='flurry'?[{targetId:'other',d20:15,damageRolls:[3]}]:[]),{targetId:'bard',d20:15,damageRolls:[3]}]}
 const missing=resolveDnd5eHeadlessAction(state,attack)
 expect(missing).toMatchObject({ok:false,reason:'invalid-dice'})
 expect(missing.state.combatants.monk.turn.bonusActionAvailable).toBe(true)
 expect(missing.state.combatants.other.currentHp).toBe(100)
 for(const d20 of [1,20]){
  const checked=resolveDnd5eHeadlessAction(state,{type:'attack-ward-attempt',actorId:'monk',targetId:'bard',turnKey,
   saves:[{effectId:effect.id,targetId:'monk',d20}]})
  expect(checked.ok).toBe(true)
  const result=resolveDnd5eHeadlessAction(checked.state,attack)
  expect(result.ok,JSON.stringify(result)).toBe(d20===20)
  expect(result.state.combatants.monk.turn.bonusActionAvailable).toBe(d20!==20)
  expect(result.state.combatants.monk.classResources['dnd5e-ki'].current).toBe(d20===20&&mode==='flurry'?1:2)
  expect(result.state.combatants.bard.currentHp).toBe(d20===20?97:100)
  if(d20===1){
   const retarget=resolveDnd5eHeadlessAction(result.state,{...attack,attacks:attack.attacks.map(a=>({...a,targetId:'other'}))})
   expect(retarget.ok,JSON.stringify(retarget)).toBe(true)
   expect(retarget.state.combatants.other.currentHp).toBe(mode==='flurry'?94:97)
   expect(retarget.events.some(event=>event.type==='saving-throw-resolved')).toBe(false)
  }
 }
})

it('authorizes legendary ward preflight by catalog attack and points without consuming a reaction or legendary point',()=>{
 const data=getDnd5eSrdMonster('srd-5.1:aboleth')!
 const monster=createDnd5eCombatant({id:'monster',name:'Monster',controller:'dm',initiative:10,statBlockId:data.id,
  abilities:data.abilities,proficiencyBonus:4,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,concentrating:false,
  position:{x:0,y:0},classState:{monsterLegendaryActionPoints:2}})
 const bard=createDnd5eCombatant({...monster,id:'bard',name:'Bard',controller:'player',initiative:20,statBlockId:undefined,classState:{}})
 const effect=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',source:{kind:'plugin',actorId:'bard'},targetId:'bard',attackAttemptWard:ward})
 bard.classState.activeEffects=[effect]
 const state=startDnd5eHeadlessCombat('legendary-ward',[monster,bard])
 state.combatants.monster.turn.reactionAvailable=false
 const attempt={type:'attack-ward-attempt' as const,actorId:'monster',targetId:'bard',legendaryActionId:'tail-swipe',
  turnKey:dnd5eHeadlessTurnKey(state,'monster'),saves:[{effectId:effect.id,targetId:'monster',d20:1}]}
 expect(resolveDnd5eHeadlessAction(state,{...attempt,legendaryActionId:undefined})).toMatchObject({ok:false,reason:'reaction-unavailable'})
 expect(resolveDnd5eHeadlessAction(state,{...attempt,legendaryActionId:'forged'})).toMatchObject({ok:false,reason:'invalid-monster-action'})
 expect(resolveDnd5eHeadlessAction(state,{...attempt,legendaryActionId:'detect'}).ok).toBe(false)
 const exhausted=structuredClone(state);exhausted.combatants.monster.classState.monsterLegendaryActionPoints=0
 expect(resolveDnd5eHeadlessAction(exhausted,attempt)).toMatchObject({ok:false,reason:'class-resource-unavailable'})
 const ownTurn=structuredClone(state);ownTurn.initiativeIndex=1
 expect(resolveDnd5eHeadlessAction(ownTurn,{...attempt,turnKey:dnd5eHeadlessTurnKey(ownTurn,'monster')})).toMatchObject({ok:false,reason:'invalid-monster-action'})
 const tail=data.actions.find(action=>action.id==='tail')!.attack!
 for(const d20 of [1,20]){
  const checked=resolveDnd5eHeadlessAction(state,{...attempt,saves:[{...attempt.saves[0],d20}]})
  expect(checked.ok,JSON.stringify(checked)).toBe(true)
  expect(checked.state.combatants.monster.classState.monsterLegendaryActionPoints).toBe(2)
  expect(checked.state.combatants.monster.turn.reactionAvailable).toBe(false)
  const attacked=resolveDnd5eHeadlessAction(checked.state,{type:'monster-legendary-action',actorId:'monster',actionId:'tail-swipe',
   rolls:[{targetId:'bard',d20:15,damageRolls:tail.damage.map(part=>Array(part.count).fill(1))}]})
  expect(attacked.ok,JSON.stringify(attacked)).toBe(d20===20)
  expect(attacked.state.combatants.monster.classState.monsterLegendaryActionPoints).toBe(d20===20?1:2)
  expect(attacked.state.combatants.monster.turn.reactionAvailable).toBe(false)
 }
})

it('guards monster attacks and preserves a committed multiattack prefix when its next target is warded',()=>{
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='monster'?'dm':'player',initiative,
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
  currentHp:100,maxHp:100,temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0},
  ...(id==='monster'?{statBlockId:'srd-5.1:owlbear'}:{})})
 const monster=make('monster',20),bard=make('bard',10),other=make('other',5)
 const protection=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',source:{kind:'plugin',actorId:'bard'},targetId:'bard',attackAttemptWard:ward})
 bard.classState.activeEffects=[protection]
 const state=startDnd5eHeadlessCombat('monster-ward',[monster,bard,other])
 const firstAction={type:'monster-action' as const,actorId:'monster',actionId:'multiattack',settleAttackCount:1,
  rolls:[{targetId:'bard',d20:15,damageRolls:[[4]]}]}
 const missing=resolveDnd5eHeadlessAction(state,firstAction)
 expect(missing).toMatchObject({ok:false,reason:'invalid-dice'})
 expect(missing.state.combatants.monster.turn.actionAvailable).toBe(true)
 expect(missing.state.combatants.bard.currentHp).toBe(100)
 const first=resolveDnd5eHeadlessAction(state,{...firstAction,rolls:[{targetId:'other',d20:15,damageRolls:[[4]]}]})
 expect(first.ok,JSON.stringify(first)).toBe(true)
 const continuation=first.state.combatants.monster.classState.monsterMultiattackContinuation!
 expect(continuation.nextOccurrenceIndex).toBe(1)
 const hpAfterFirst=first.state.combatants.other.currentHp
 expect(hpAfterFirst).toBeLessThan(100)
 const secondAction={type:'monster-action' as const,actorId:'monster',actionId:continuation.sequenceActionIds[1],
  multiattackContinuation:{schemaVersion:1 as const,parentActionId:'multiattack',occurrenceIndex:1},
  rolls:[{targetId:'bard',d20:15,damageRolls:[[4,4]]}]}
 expect(resolveDnd5eHeadlessAction(first.state,secondAction)).toMatchObject({ok:false,reason:'invalid-dice'})
 for(const d20 of [1,20]){
  const saved=resolveDnd5eHeadlessAction(first.state,{type:'attack-ward-attempt',actorId:'monster',targetId:'bard',
   turnKey:dnd5eHeadlessTurnKey(first.state,'monster'),saves:[{effectId:protection.id,targetId:'monster',d20}]})
  expect(saved.ok).toBe(true)
  const second=resolveDnd5eHeadlessAction(saved.state,secondAction)
  expect(second.ok,JSON.stringify(second)).toBe(d20===20)
  expect(second.state.combatants.other.currentHp).toBe(hpAfterFirst)
  expect(second.events.some(e=>e.type==='turn-resource-spent'&&e.resource==='action')).toBe(false)
  if(d20===1){
   expect(second.state.combatants.monster.classState.monsterMultiattackContinuation).toEqual(continuation)
   expect(second.state.combatants.bard.currentHp).toBe(100)
   const retarget=resolveDnd5eHeadlessAction(second.state,{...secondAction,rolls:[{targetId:'other',d20:15,damageRolls:[[4,4]]}]})
   expect(retarget.ok,JSON.stringify(retarget)).toBe(true)
   expect(retarget.state.combatants.other.currentHp).toBeLessThan(hpAfterFirst)
   expect(retarget.state.combatants.monster.classState.monsterMultiattackContinuation).toBeUndefined()
  } else expect(second.state.combatants.bard.currentHp).toBeLessThan(100)
 }
})

it('rechecks actual Activity attack results at commit before spending costs, including direct bridge callers',()=>{
 const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
  proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0}})
 const target=createDnd5eCombatant({...actor,id:'target',name:'Target',controller:'dm',initiative:10})
 const protection=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',source:{kind:'plugin',actorId:'target'},targetId:'target',attackAttemptWard:ward})
 target.classState.activeEffects=[protection]
 const state=startDnd5eHeadlessCombat('activity-ward',[actor,target])
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'ward-test-attack',name:'Attack',activation:{kind:'action',cost:1},
  target:{kind:'creature',relation:'enemy',count:1,rangeFeet:30},automation:automationCapabilityFromLegacyStatus('full'),
  consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}],
  checks:[{id:'attack',kind:'attack-roll',attackBonus:{kind:'constant',value:5},rollId:'attack',scope:'per-target',rollMode:'normal'}],
  outcomes:[{id:'hit',when:{kind:'check',checkId:'attack',result:'success'},operations:[{id:'damage',kind:'damage',target:'target',damageType:'force',amount:{kind:'constant',value:3}}]}]}
 const snapshot=(combatant:typeof actor)=>({id:combatant.id,controller:combatant.controller,
  armorClass:combatant.armorClass,abilities:combatant.abilities,proficiencyBonus:combatant.proficiencyBonus,
  level:combatant.level,conditions:[]})
 const resolution=resolveDnd5eActivity({activity,actor:snapshot(actor),targets:[snapshot(target)],distanceFeetByTargetId:{target:5},rolls:{'attack:target':{values:[15]}}})
 expect(resolution.ok,JSON.stringify(resolution)).toBe(true)
 const commit=(source:typeof state)=>commitDnd5eActivityExecution(source,{actorId:'actor',activityId:activity.id,targetIds:['target'],resolution})
 const missing=commit(state)
 expect(missing.ok).toBe(false)
 expect(missing.state.combatants.actor.turn.actionAvailable).toBe(true)
 expect(missing.state.combatants.target.currentHp).toBe(30)
 for(const d20 of [1,20]){
  const preflight=resolveDnd5eHeadlessAction(state,{type:'attack-ward-attempt',actorId:'actor',targetId:'target',
   turnKey:dnd5eHeadlessTurnKey(state,'actor'),saves:[{effectId:protection.id,targetId:'actor',d20}]})
  expect(preflight.ok).toBe(true)
  const committed=commit(preflight.state)
  expect(committed.ok).toBe(d20===20)
  expect(committed.state.combatants.actor.turn.actionAvailable).toBe(d20!==20)
  expect(committed.state.combatants.target.currentHp).toBe(d20===20?27:30)
 }
})

it('does not break source-linked effects when a ward prevents the attack, but does when an actual attack misses',()=>{
 const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
  currentHp:30,maxHp:30,temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0}})
 const bard=createDnd5eCombatant({...actor,id:'bard',name:'Bard',controller:'dm',initiative:10})
 const protection=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',targetId:'bard',source:{kind:'plugin',actorId:'bard'},attackAttemptWard:ward})
 const linked=createDnd5eMechanicalEffect({definitionId:'linked',label:'Linked',targetId:'bard',source:{kind:'plugin',actorId:'actor'},breakOn:['attacked-by-source']})
 bard.classState.activeEffects=[protection,linked]
 const state=startDnd5eHeadlessCombat('ward-lifecycle',[actor,bard])
 const attack={type:'attack' as const,actorId:'actor',targetId:'bard',attackModifier:0,d20:1,damage:{count:1,sides:6,bonus:0,rolls:[3]}}
 for(const save of [1,20]){
  const result=resolveDnd5eHeadlessAction(state,{...attack,attackAttemptWardSaves:[{effectId:protection.id,d20:save}]})
  expect(result.ok).toBe(true)
  expect(result.state.combatants.bard.currentHp).toBe(30)
  expect(result.state.combatants.bard.classState.activeEffects?.some(effect=>effect.id===linked.id)).toBe(save===1)
  expect(result.events.some(event=>event.type==='attack-resolved')).toBe(save===20)
  expect(result.state.combatants.actor.turn.actionAvailable).toBe(save===1)
 }
})

it('settles CHA before native attack costs, preserves a failed receipt across reload, and permits retargeting',()=>{
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:'dm',initiative,
  abilities:{str:10,dex:10,con:10,int:10,wis:20,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,
  temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0}})
 const attacker=make('attacker',20),bard=make('bard',10),other=make('other',5)
 const effect=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',targetId:bard.id,source:{kind:'plugin',actorId:bard.id},attackAttemptWard:ward})
 bard.classState.activeEffects=[effect]
 const state=startDnd5eHeadlessCombat('ward-test',[attacker,bard,other])
 const attack={type:'attack' as const,actorId:attacker.id,targetId:bard.id,attackModifier:5,d20:15,damage:{count:1,sides:6,bonus:0,rolls:[3]}}
 const preflight={type:'attack-ward-attempt' as const,actorId:'attacker',targetId:'bard',turnKey:dnd5eHeadlessTurnKey(state,'attacker'),saves:[{effectId:effect.id,targetId:'attacker',d20:12}]}
 const rejected=resolveDnd5eHeadlessAction(state,{...preflight,turnKey:'outdated'})
 expect(rejected.ok).toBe(false)
 const guarded=resolveDnd5eHeadlessAction(state,preflight)
 expect(guarded.ok).toBe(true)
 expect(guarded.state.combatants.attacker.turn).toEqual(state.combatants.attacker.turn)
 expect(guarded.events.some(event=>event.type==='attack-resolved')).toBe(false)
 expect(dnd5eAttackAttemptWardRequirements(guarded.state,'attacker','bard')[0].receipt?.success).toBe(false)
 const approved=resolveDnd5eHeadlessAction(state,{...preflight,saves:[{effectId:effect.id,targetId:'attacker',d20:20}]})
 expect(approved.ok).toBe(true)
 const afterApproval=resolveDnd5eHeadlessAction(approved.state,attack)
 expect(afterApproval.ok).toBe(true)
 expect(afterApproval.state.combatants.bard.currentHp).toBe(27)
 expect(afterApproval.events.some(event=>event.type==='saving-throw-resolved')).toBe(false)
 const casterState=structuredClone(state)
 Object.assign(casterState.combatants.attacker,{controller:'player',classId:'wizard',level:5,abilities:{...attacker.abilities,int:18},
  classSelections:{'spell-cantrips':['fire-bolt','acid-splash']}})
 const fireBolt={type:'cast-spell' as const,actorId:'attacker',targetId:'bard',spellId:'fire-bolt',slotLevel:0,d20:15,effectRolls:[4,4]}
 const unverifiedSpell=resolveDnd5eHeadlessAction(casterState,fireBolt)
 expect(unverifiedSpell.ok).toBe(false)
 if(!unverifiedSpell.ok)expect(unverifiedSpell.reason).toBe('invalid-dice')
 const deniedCaster=resolveDnd5eHeadlessAction(casterState,preflight)
 expect(deniedCaster.ok).toBe(true)
 const deniedSpell=resolveDnd5eHeadlessAction(deniedCaster.state,fireBolt)
 expect(deniedSpell.ok).toBe(true)
 expect(deniedSpell.state.combatants.attacker.turn.actionAvailable).toBe(true)
 expect(deniedSpell.state.combatants.bard.currentHp).toBe(30)
 expect(deniedSpell.events.some(event=>event.type==='spell-cast')).toBe(false)
 const approvedCaster=resolveDnd5eHeadlessAction(casterState,{...preflight,saves:[{effectId:effect.id,targetId:'attacker',d20:20}]})
 expect(approvedCaster.ok).toBe(true)
 const allowedSpell=resolveDnd5eHeadlessAction(approvedCaster.state,fireBolt)
 expect(allowedSpell.ok,allowedSpell.ok?'':allowedSpell.reason).toBe(true)
 expect(allowedSpell.state.combatants.bard.currentHp).toBe(22)
 expect(allowedSpell.state.combatants.attacker.turn.actionAvailable).toBe(false)
 const saveOnly=resolveDnd5eHeadlessAction(casterState,{type:'cast-spell',actorId:'attacker',targetId:'bard',
  spellId:'acid-splash',slotLevel:0,savingThrowD20:1,effectRolls:[3,3]})
 expect(saveOnly.ok,saveOnly.ok?'':saveOnly.reason).toBe(true)
 expect(saveOnly.state.combatants.bard.currentHp).toBe(24)
 const missing=resolveDnd5eHeadlessAction(state,attack)
 expect(missing.ok).toBe(false)
 const failed=resolveDnd5eHeadlessAction(state,{...attack,attackAttemptWardSaves:[{effectId:effect.id,d20:12}]})
 expect(failed.ok).toBe(true)
 expect(failed.state.combatants.attacker.turn.actionAvailable).toBe(true)
 expect(failed.state.combatants.bard.currentHp).toBe(30)
 expect(failed.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',ability:'cha',success:false,total:12}))
 expect(failed.events.some(event=>event.type==='attack-resolved')).toBe(false)
 const reload=JSON.parse(JSON.stringify(failed.state))
 reload.combatants.bard.classState.activeEffects=normalizeDnd5eActiveEffects(reload.combatants.bard.classState.activeEffects)
 expect(validateDnd5eActiveEffectsStrict(reload.combatants.bard.classState.activeEffects).ok).toBe(true)
 expect(dnd5eAttackAttemptWardRequirements(reload,'attacker','bard')[0].receipt?.success).toBe(false)
 const retry=resolveDnd5eHeadlessAction(reload,attack)
 expect(retry.ok).toBe(true)
 expect(retry.events.some(event=>event.type==='saving-throw-resolved')).toBe(false)
 expect(retry.state.combatants.attacker.turn.actionAvailable).toBe(true)
 const retarget=resolveDnd5eHeadlessAction(retry.state,{...attack,targetId:'other'})
 expect(retarget.ok).toBe(true)
 expect(retarget.state.combatants.other.currentHp).toBe(27)
 expect(retarget.state.combatants.attacker.turn.actionAvailable).toBe(false)
 const next=JSON.parse(JSON.stringify(reload)); next.round++
 expect(dnd5eAttackAttemptWardRequirements(next,'attacker','bard')[0].receipt).toBeUndefined()
 const passed=resolveDnd5eHeadlessAction(next,{...attack,attackAttemptWardSaves:[{effectId:effect.id,d20:20}]})
 expect(passed.ok).toBe(true)
 expect(passed.state.combatants.bard.currentHp).toBe(27)
 expect(dnd5eAttackAttemptWardRequirements(passed.state,'attacker','bard')[0].receipt?.success).toBe(true)
 const extra=resolveDnd5eHeadlessAction(passed.state,{...attack,spendAction:false})
 expect(extra.ok).toBe(true)
 expect(extra.events.some(event=>event.type==='saving-throw-resolved')).toBe(false)
 const mode=(current:typeof state,sourceActorId='bard',sourceIsSpell=true)=>dnd5eSavingThrowMode(current.combatants.attacker,'dex',{sourceActorId,sourceIsSpell})
 expect(mode(extra.state)).toBe('normal')
 const sourceTurn=resolveDnd5eHeadlessAction(extra.state,{type:'end-turn',actorId:'attacker'})
 expect(sourceTurn.ok).toBe(true)
 expect(mode(sourceTurn.state)).toBe('disadvantage')
 expect(mode(sourceTurn.state,'other')).toBe('normal')
 expect(mode(sourceTurn.state,'bard',false)).toBe('normal')
 const resistant=structuredClone(sourceTurn.state);resistant.combatants.attacker.magicResistance=true
 expect(mode(resistant)).toBe('normal')
 const duringSourceTurn=resolveDnd5eHeadlessAction(sourceTurn.state,{...attack,type:'opportunity-attack',attackAttemptWardSaves:[{effectId:effect.id,d20:20}]})
 expect(duringSourceTurn.ok).toBe(true)
 expect(duringSourceTurn.state.combatants.attacker.classState.activeEffects?.filter(effect=>effect.sourceTurnSpellSaveDisadvantage)).toHaveLength(2)
 const afterSourceTurn=resolveDnd5eHeadlessAction(duringSourceTurn.state,{type:'end-turn',actorId:'bard'})
 expect(afterSourceTurn.ok).toBe(true)
 expect(mode(afterSourceTurn.state)).toBe('normal')
 expect(afterSourceTurn.state.combatants.attacker.classState.activeEffects?.filter(effect=>effect.sourceTurnSpellSaveDisadvantage)).toHaveLength(1)
 const afterOther=resolveDnd5eHeadlessAction(afterSourceTurn.state,{type:'end-turn',actorId:'other'})
 expect(afterOther.ok).toBe(true)
 const nextSourceTurn=resolveDnd5eHeadlessAction(afterOther.state,{type:'end-turn',actorId:'attacker'})
 expect(nextSourceTurn.ok).toBe(true)
 expect(mode(nextSourceTurn.state)).toBe('disadvantage')
 const saved=JSON.parse(JSON.stringify(sourceTurn.state))
 saved.combatants.attacker.classState.activeEffects=normalizeDnd5eActiveEffects(saved.combatants.attacker.classState.activeEffects)
 expect(mode(saved)).toBe('disadvantage')
 const sourceEnd=resolveDnd5eHeadlessAction(saved,{type:'end-turn',actorId:'bard'})
 expect(sourceEnd.ok).toBe(true)
 expect(mode(sourceEnd.state)).toBe('normal')
 expect(sourceEnd.state.combatants.attacker.classState.activeEffects?.some(effect=>effect.sourceTurnSpellSaveDisadvantage) ?? false).toBe(false)
})

it('resolves the ward DC from the actual source spellcasting snapshot',()=>{
 const effect:Dnd5eEffectDefinitionV1={schemaVersion:1,id:'ward',name:'Ward',stacking:'replace',duration:{kind:'rounds',rounds:10,expiresAt:'source-turn-end'},
  attackAttemptWard:{...ward,dc:{kind:'reference',reference:{kind:'actor-spell-save-dc'}}}}
 const actor={id:'bard',controller:'player' as const,level:14,proficiencyBonus:5,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:18},armorClass:10,currentHp:20,maxHp:20,conditions:[],spellSaveDc:17}
 expect(resolveDnd5eAppliedEffectDefinitionV1(effect,{actor,target:actor}).attackAttemptWard).toEqual(ward)
})

it('preserves the attack ward through effect creation and JSON persistence',()=>{
 const effect=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',targetId:'bard',source:{kind:'plugin',actorId:'bard'},attackAttemptWard:ward})
 const saved=JSON.parse(JSON.stringify(effect))
 expect(normalizeDnd5eActiveEffects([saved])[0].attackAttemptWard).toEqual(ward)
 expect(validateDnd5eActiveEffectsStrict([saved]).ok).toBe(true)
 expect(normalizeDnd5eActiveEffects([saved])[0].source.actorId).toBe('bard')
})

it('rejects malformed and forged ward policies rather than persisting them',()=>{
 for(const invalid of [false,[],{}, {...ward,ability:'luck'}, {...ward,dc:0}, {...ward,dc:41}, {...ward,dc:1.5},
  {...ward,frequency:'once-per-round'}, {...ward,onFailure:'always-hit'}, {...ward,onSuccess:'until-source-turn-start'}, {...ward,sourceActorId:'forged'}]){
  expect(normalizeDnd5eAttackAttemptWard(invalid)).toBeUndefined()
  const effect=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',targetId:'bard',source:{kind:'plugin',actorId:'bard'}})
  expect(validateDnd5eActiveEffectsStrict([{...effect,attackAttemptWard:invalid}]).ok).toBe(false)
 }
})
