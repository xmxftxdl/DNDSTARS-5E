import {it,expect} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eHeadlessTurnKey,dnd5eWeaponClassDamageDefinitions} from './headlessCombatEngine'
import {planDnd5eInterruptingTurn} from './interruptedTurn'
import {beginDnd5eAcceptedZeroHitPointTurn} from './zeroHitPointTurn'

it('nests multiple accepted zero-HP turns and unwinds them without restarting the paused turns',()=>{
  const actors=['enemy','first','second','third'].map((id,index)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:20-index,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,
    temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0}}))
  const state=startDnd5eHeadlessCombat('nested',actors)
  state.combatants.enemy.turn.actionAvailable=false
  const originalTurn=structuredClone(state.combatants.enemy.turn)
  for(const id of ['first','second','third']){
    const plan=planDnd5eInterruptingTurn(state,id,id)!
    const actor=state.combatants[id]
    actor.currentHp=0
    actor.classState.zeroHitPointExtraTurn={featureId:'test:zero',slotId:plan.receipt.extraSlotId,phase:'pending'}
    actor.classState.interruptedTurnResume={receipt:plan.receipt,economy:structuredClone(originalTurn)}
  }
  const original=structuredClone(state)
  let current=state
  for(const actorId of ['first','second','third']){
    const begun=beginDnd5eAcceptedZeroHitPointTurn(current,{type:'begin-turn',actorId})!
    expect(begun?.ok).toBe(true)
    current=JSON.parse(JSON.stringify(begun.state))
  }
  expect(current.initiativeOrder.slice(0,4)).toEqual(['third','second','first','enemy'])
  for(const actorId of ['third','second','first']){
    const ended=resolveDnd5eHeadlessAction(current,{type:'end-turn',actorId})
    expect(ended.ok).toBe(true)
    expect(ended.events).not.toContainEqual(expect.objectContaining({type:'turn-started'}))
    current=JSON.parse(JSON.stringify(ended.state))
  }
  expect(current.initiativeOrder).toEqual(original.initiativeOrder)
  expect(current.combatants.enemy.turn).toEqual(originalTurn)
  expect(state).toEqual(original)
})

it('preserves already-used sneak attack when Samurai interrupts its own turn',()=>{
 const actors=['hero','enemy'].map((id,i)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:20-i,
  abilities:{str:14,dex:14,con:14,int:10,wis:10,cha:10},proficiencyBonus:6,armorClass:10,currentHp:100,maxHp:100,
  temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0},classLevels:{fighter:18,rogue:2}}))
 const state=startDnd5eHeadlessCombat('own-interrupt',actors),hero=state.combatants.hero
 const context={mode:'melee' as const,finesse:true,strengthBased:false,weaponDamageSides:6,damageType:'piercing' as const,adjacentEnemyOfTarget:true}
 hero.classState.sneakAttackTurnKey=dnd5eHeadlessTurnKey(state,'hero')
 const plan=planDnd5eInterruptingTurn(state,'hero','damage')!
 hero.currentHp=0
 hero.classState.zeroHitPointExtraTurn={featureId:'test:zero',slotId:plan.receipt.extraSlotId,phase:'pending'}
 hero.classState.interruptedTurnResume={receipt:plan.receipt,economy:structuredClone(hero.turn)}
 const begun=beginDnd5eAcceptedZeroHitPointTurn(state,{type:'begin-turn',actorId:'hero'})!
 expect(begun?.ok).toBe(true)
 const attack=resolveDnd5eHeadlessAction(begun.state,{type:'attack',actorId:'hero',targetId:'enemy',attackModifier:10,d20:18,
  damage:{count:1,sides:6,bonus:2,rolls:[3],type:'piercing'},classDamageContext:context,classDamageRolls:[{source:'sneak-attack',rolls:[4]}]})
 expect(attack.ok).toBe(true)
 expect(attack.state.combatants.hero.classState.sneakAttackTurnKey).toBe(dnd5eHeadlessTurnKey(attack.state,'hero'))
 const restored=resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(attack.state)),{type:'end-turn',actorId:'hero'})
 expect(restored.ok).toBe(true)
 expect(restored.state.combatants.hero.classState.sneakAttackTurnKey).toBe(dnd5eHeadlessTurnKey(restored.state,'hero'))
 expect(dnd5eWeaponClassDamageDefinitions({state:restored.state,actorId:'hero',targetId:'enemy',context,effectiveMode:'normal',critical:false}).some(d=>d.source==='sneak-attack')).toBe(false)
})
