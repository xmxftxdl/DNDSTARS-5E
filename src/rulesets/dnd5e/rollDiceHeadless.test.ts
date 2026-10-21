import {expect, it} from 'vitest'
import {createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, type Dnd5eAction} from './headlessCombatEngine'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {dnd5eRollDiceRecipes, type Dnd5eRollDiceKind} from './rollDiceModifiers'
import {dnd5eRollDiceOccurrenceId} from './rollDiceTransaction'
import {prepareDnd5eEffectRollDice} from './prepareEffectRollDice'

function fixture() {
  const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:'player',initiative,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:12,proficiencyBonus:2,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:true})
  const actor=make('actor',20), target=make('target',1)
  actor.classState.activeEffects=[createDnd5eMechanicalEffect({id:'penalty',definitionId:'test.penalty',label:'Penalty',source:{kind:'plugin'},targetId:actor.id,appliedAt:1,
    modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:'subtract',appliesTo:['attack','ability-check','concentration-save']}]}})]
  return startDnd5eHeadlessCombat('dice-test',[actor,target])
}
const options={transactionId:'host:one',now:1}
it('prepares actual missing effect dice through Host retries without committing or reusing stale values',async()=>{
  const state=fixture(), before=structuredClone(state),requested:string[]=[]
  const action:Dnd5eAction={type:'ability-check',actorId:'actor',ability:'int',d20:15,dc:12,spendAction:true}
  const prepared=await prepareDnd5eEffectRollDice({
    resolve:effectRollDice=>resolveDnd5eHeadlessAction(state,{...action,effectRollDice},options),
    roll:async recipe=>{requested.push(recipe.id);return [6]},
  })
  expect(prepared.status).toBe('ready')
  expect(requested).toHaveLength(1)
  expect(prepared.result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',total:9,success:false}))
  expect(state).toEqual(before)
  expect(resolveDnd5eHeadlessAction(state,{...action,effectRollDice:prepared.rolls},{transactionId:'new-host-event'}).ok).toBe(false)
})

it.each(['cancelled','invalid-dice','rejected'] as const)('stops dice preparation on %s without mutating the source',async status=>{
  const state=fixture(),before=structuredClone(state)
  const action:Dnd5eAction={type:'ability-check',actorId:status==='rejected'?'absent':'actor',ability:'int',d20:15,dc:12,spendAction:true}
  let calls=0
  const prepared=await prepareDnd5eEffectRollDice({resolve:effectRollDice=>resolveDnd5eHeadlessAction(state,{...action,effectRollDice},options),
    roll:async()=>{calls+=1;return status==='cancelled'?undefined:[99]}})
  expect(prepared.status).toBe(status)
  expect(calls).toBe(status==='rejected'?0:1)
  expect(state).toEqual(before)
})
function dice(state:ReturnType<typeof fixture>,kind:Dnd5eRollDiceKind,value:number,transactionId=options.transactionId,occurrence=0) {
  const id=dnd5eRollDiceRecipes({actorId:'actor',kind,effects:state.combatants.actor.classState.activeEffects,
    eventId:dnd5eRollDiceOccurrenceId(transactionId,'actor',kind,occurrence)})[0].id
  return {[id]:[value]}
}

it.each(['ability-check','concentration-save'] as const)('applies fresh penalties before %s success and audits the die',kind=>{
  const state=fixture()
  const action:Dnd5eAction=kind==='ability-check'
    ? {type:'ability-check',actorId:'actor',ability:'int',d20:15,dc:12,spendAction:true}
    : {type:'concentration-save',actorId:'actor',d20:15,dc:12}
  const result=resolveDnd5eHeadlessAction(state,{...action,effectRollDice:dice(state,kind,6)},options)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  const outcome=result.events.find(event=>event.type===(kind==='ability-check'?'ability-check-resolved':'concentration-resolved'))
  expect(outcome).toMatchObject({total:9,success:false})
  expect(result.transaction?.rollLedger.entries).toContainEqual(expect.objectContaining({sourceId:'penalty',dice:{sides:6,values:[6]}}))
  expect(state.combatants.actor.turn.actionAvailable).toBe(true)
})

it('changes attack hit adjudication but preserves natural twenty and the persistent effect',()=>{
  const state=fixture()
  const action:Dnd5eAction={type:'attack',actorId:'actor',targetId:'target',attackModifier:0,d20:15,spendAction:true,
    damage:{count:1,sides:4,bonus:0,rolls:[2]}}
  const missed=resolveDnd5eHeadlessAction(state,{...action,effectRollDice:dice(state,'attack',6)},options)
  expect(missed.ok,JSON.stringify(missed)).toBe(true)
  expect(missed.events).toContainEqual(expect.objectContaining({type:'attack-resolved',total:9,hit:false}))
  expect(missed.state.combatants.target.currentHp).toBe(30)
  expect(missed.state.combatants.actor.classState.activeEffects).toHaveLength(1)
  const critical=resolveDnd5eHeadlessAction(state,{...action,d20:20,damage:{count:1,sides:4,bonus:0,rolls:[2,2]},effectRollDice:dice(state,'attack',6)},options)
  expect(critical.ok,JSON.stringify(critical)).toBe(true)
  expect(critical.events).toContainEqual(expect.objectContaining({type:'attack-resolved',total:14,hit:true,critical:true}))
})

it('rejects missing, excess or prior-transaction dice without spending the action',()=>{
  const state=fixture()
  const action:Dnd5eAction={type:'ability-check',actorId:'actor',ability:'int',d20:15,dc:12,spendAction:true}
  for (const effectRollDice of [undefined, {...dice(state,'ability-check',2),extraneous:[1]},dice(state,'ability-check',2,'old-event')]) {
    const result=resolveDnd5eHeadlessAction(state,{...action,effectRollDice},options)
    expect(result.ok).toBe(false)
    expect(state.combatants.actor.turn.actionAvailable).toBe(true)
    expect(result.state.combatants.actor.turn.actionAvailable).toBe(true)
    expect(result.transaction?.status).toBe('rolled-back')
  }
  // A rejected transaction cannot leak its synchronous dice context into the next one.
  expect(resolveDnd5eHeadlessAction(state,{...action,effectRollDice:dice(state,'ability-check',1)},options).ok).toBe(true)
})

it('uses independent dice for consecutive strikes and rolls back all strikes when a later die is missing',async()=>{
  const state=fixture(), actor=state.combatants.actor
  actor.classId='monk';actor.level=2
  actor.classResources['dnd5e-ki']={current:2,max:2}
  actor.classState.monkAttackActionTurnKey=`${state.combatId}:${state.round}:${state.initiativeSlotIds?.[state.initiativeIndex]??state.turnSlotId??actor.id}`
  const action:Dnd5eAction={type:'monk-unarmed-bonus',actorId:'actor',mode:'flurry',attackModifier:0,reachFeet:5,
    damage:{count:1,sides:4,bonus:0},damageType:'bludgeoning',attacks:[
      {targetId:'target',d20:15,damageRolls:[2]}, {targetId:'target',d20:15,damageRolls:[]},
    ]}
  const rolls={...dice(state,'attack',1),...dice(state,'attack',6,options.transactionId,1)}
  const result=resolveDnd5eHeadlessAction(state,{...action,effectRollDice:rolls},options)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.events.filter(event=>event.type==='attack-resolved')).toMatchObject([{total:14,hit:true},{total:9,hit:false}])
  expect(result.state.combatants.target.currentHp).toBe(28)
  expect(result.state.combatants.actor.classResources['dnd5e-ki'].current).toBe(1)
  const missing=resolveDnd5eHeadlessAction(state,{...action,effectRollDice:dice(state,'attack',1)},options)
  expect(missing.ok).toBe(false)
  expect(missing.state.combatants.target.currentHp).toBe(30)
  expect(missing.state.combatants.actor.classResources['dnd5e-ki'].current).toBe(2)
  expect(missing.state.combatants.actor.turn.bonusActionAvailable).toBe(true)
  let requests=0
  const prepared=await prepareDnd5eEffectRollDice({resolve:effectRollDice=>resolveDnd5eHeadlessAction(state,{...action,effectRollDice},options),
    roll:async()=>[++requests===1?1:6]})
  expect(prepared.status).toBe('ready')
  expect(requests).toBe(2)
  expect(prepared.result.state.combatants.target.currentHp).toBe(28)
  const limited=await prepareDnd5eEffectRollDice({maximumRequests:1,
    resolve:effectRollDice=>resolveDnd5eHeadlessAction(state,{...action,effectRollDice},options),roll:async()=>[1]})
  expect(limited.status).toBe('limit-exceeded')
  expect(state.combatants.target.currentHp).toBe(30)
  expect(state.combatants.actor.classResources['dnd5e-ki'].current).toBe(2)
})
