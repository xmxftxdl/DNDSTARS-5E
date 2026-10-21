import { expect, it } from 'vitest'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eCombatEvent } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { recordDnd5eStraightMovement } from './straightMovementStreak'

it.each(['straight', 'corner', 'reverse', 'teleport', 'forced', 'unknown', 'gap', 'turn', 'ended', 'vertical', 'malformed'] as const)(
  'tracks committed straight segments without joining invalid movement: %s', mode => {
  const actor = createDnd5eCombatant({ id: 'a', name: 'A', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const other = createDnd5eCombatant({ ...actor, id: 'other', name: 'Other', controller: 'dm', initiative: 10 })
  let state = startDnd5eHeadlessCombat('streak', [actor, other])
  const first: Dnd5eCombatEvent = { type: 'moved', actorId: 'a', from: { x: 0, y: 0 }, to: { x: 50, y: 0 },
    distance: 5, straightLine: true, movementKind: 'voluntary' }
  recordDnd5eStraightMovement(state, [first])
  expect(first.straightDistanceFeet).toBe(5)
  state = JSON.parse(JSON.stringify(state))
  if (mode === 'turn') state.round++
  if (mode === 'ended') recordDnd5eStraightMovement(state, [{ type: 'turn-ended', actorId: 'a', round: 1 }])
  if (mode === 'malformed') state.combatants.a.classState.straightMovementStreak = { turnKey: state.combatants.a.classState.straightMovementStreak!.turnKey } as any
  const second: Dnd5eCombatEvent = { ...first, from: { x: mode === 'gap' ? 60 : 50, y: 0 },
    to: mode === 'corner' ? { x: 50, y: 50 } : mode === 'reverse' ? { x: 0, y: 0 } : { x: 100, y: 0 },
    movementKind: mode === 'teleport' ? 'teleport' : mode === 'forced' ? 'forced' : 'voluntary',
    straightLine: mode === 'unknown' ? undefined : true }
  recordDnd5eStraightMovement(state, [second, ...(mode === 'vertical' ? [{ type: 'elevation-changed' as const, actorId: 'a', fromElevationFeet: 0, toElevationFeet: 5, mode: 'fly' as const }] : [])])
  expect(second.straightDistanceFeet).toBe(mode === 'straight' ? 10 : ['teleport', 'forced', 'unknown', 'vertical'].includes(mode) ? 0 : 5)
})

it.each(['vertical', 'slope'] as const)('accumulates Host-confirmed 3D flight and resets on a new direction: %s', mode => {
  const actor = createDnd5eCombatant({ id: 'a', name: 'A', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  actor.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'flight', label: 'Flight',
    source: { kind: 'feature', actorId: 'a' }, targetId: 'a', modifiers: { flySpeedFeet: 30 } })]
  const other = createDnd5eCombatant({ ...actor, id: 'other', name: 'Other', controller: 'dm', initiative: 10, classState: {} })
  let state = startDnd5eHeadlessCombat('flight-streak', [actor, other])
  for (const step of [1, 2, 3]) {
    const result = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'a',
      to: { x: mode === 'slope' ? step * 50 : 0, y: step === 3 ? 50 : 0 }, distance: 5,
      toElevationFeet: step * 5, toGroundElevationFeet: 0, traversalMode: 'fly', straightLine: true })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.events.find(event => event.type === 'moved' && event.actorId === 'a')).toMatchObject({
      fromElevationFeet: (step - 1) * 5, toElevationFeet: step * 5, straightDistanceFeet: step === 3 ? 5 : step * 5,
    })
    state = JSON.parse(JSON.stringify(result.state))
  }
})


it('snapshots the attack before a later movement in the same committed event batch',()=>{
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
    proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const target=createDnd5eCombatant({...actor,id:'target',name:'Target',controller:'dm',initiative:10})
  const initial=startDnd5eHeadlessCombat('ordered',[actor,target])
  const moved=resolveDnd5eHeadlessAction(initial,{type:'move',actorId:'actor',to:{x:10,y:0},distance:10,straightLine:true})
  expect(moved.ok).toBe(true)
  const state=moved.state
  state.combatants.actor.position={x:15,y:0}
  const attack:Dnd5eCombatEvent={type:'attack-resolved',actorId:'actor',targetId:'target',d20:15,total:15,armorClass:10,hit:true,critical:false}
  const later:Dnd5eCombatEvent={type:'moved',actorId:'actor',from:{x:10,y:0},to:{x:15,y:0},distance:5,straightLine:true,movementKind:'voluntary'}
  recordDnd5eStraightMovement(state,[attack,later])
  expect(attack.precedingStraightMovementFeet).toBe(10)
  expect(later.straightDistanceFeet).toBe(5)
})
