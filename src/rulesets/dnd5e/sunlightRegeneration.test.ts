import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eAbilityCheckRollMode, dnd5eMonsterSpellAttackMode } from './headlessCombatEngine'
import { getDnd5eSrdMonsterBySlug } from './monsters'
import { buildDnd5eCustomMonster, dnd5eCustomMonsterDraftFromStatBlock } from './customMonsterWorkshop'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'

const vampire=getDnd5eSrdMonsterBySlug('vampire-spawn')!
function state(sunlight:boolean){
 const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'dm',initiative:20,statBlockId:vampire.id,
  abilities:vampire.abilities,proficiencyBonus:3,armorClass:15,maxHp:100,currentHp:50,temporaryHp:0,speed:30,
  position:{x:0,y:0},concentrating:false,inSunlight:sunlight})
 const target=createDnd5eCombatant({...actor,id:'target',controller:'player',initiative:10,statBlockId:undefined,inSunlight:false})
 const result=startDnd5eHeadlessCombat('sunlight-regen',[actor,target])
 result.combatants.actor.currentHp=50
 result.combatants.actor.classState.turnStartResolvedTurnKey=undefined
 return result
}
describe('sunlight prevents regeneration in actual turn settlement',()=>{
 it.each([true,false])('sunlight=%s controls start-turn healing',sunlight=>{
  const before=state(sunlight)
  const result=resolveDnd5eHeadlessAction(before,{type:'begin-turn',actorId:'actor'})
  expect(result.ok,JSON.stringify({reason:result.ok?undefined:result.reason,events:result.events})).toBe(true)
  expect(result.state.combatants.actor.currentHp).toBe(sunlight?30:60)
  if(sunlight) expect(result.events).toContainEqual(expect.objectContaining({type:'monster-regeneration-suppressed',sunlight:true,damageTypes:[]}))
  expect(resolveDnd5eHeadlessAction(result.state,{type:'begin-turn',actorId:'actor'}).state.combatants.actor.currentHp).toBe(sunlight?30:60)
 })
 it('retains radiant suppression for the next turn after leaving sunlight',()=>{
  const first=resolveDnd5eHeadlessAction(state(true),{type:'begin-turn',actorId:'actor'})
  first.state.combatants.actor.inSunlight=false
  const targetTurn=resolveDnd5eHeadlessAction(first.state,{type:'end-turn',actorId:'actor'})
  expect(targetTurn.ok).toBe(true)
  const next=resolveDnd5eHeadlessAction(targetTurn.state,{type:'end-turn',actorId:'target'})
  expect(next.ok).toBe(true)
  expect(next.state.combatants.actor.currentHp).toBe(30)
  const intervening=resolveDnd5eHeadlessAction(next.state,{type:'end-turn',actorId:'actor'})
  const restored=resolveDnd5eHeadlessAction(intervening.state,{type:'end-turn',actorId:'target'})
  expect(restored.state.combatants.actor.currentHp).toBe(40)
 })
 it('retains radiant damage suppression outside sunlight and clears it after that turn',()=>{
  const before=state(false)
  before.combatants.actor.classState.monsterRegenerationSuppressedDamageTypes=['radiant']
  const first=resolveDnd5eHeadlessAction(before,{type:'begin-turn',actorId:'actor'})
  expect(first.ok).toBe(true)
  expect(first.state.combatants.actor.currentHp).toBe(50)
  expect(first.state.combatants.actor.classState.monsterRegenerationSuppressedDamageTypes).toBeUndefined()
  const targetTurn=resolveDnd5eHeadlessAction(first.state,{type:'end-turn',actorId:'actor'})
  expect(targetTurn.ok).toBe(true)
  const next=resolveDnd5eHeadlessAction(targetTurn.state,{type:'end-turn',actorId:'target'})
  expect(next.ok).toBe(true)
  expect(next.state.combatants.actor.currentHp).toBe(60)
 })
 it('keeps the rule through JSON import and workshop edit/build',()=>{
  const source=JSON.parse(JSON.stringify(vampire))
  expect(parseDnd5eMonsterStatBlock(source).ok).toBe(true)
  const rebuilt=buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(source))
  expect(rebuilt.traits.find(trait=>trait.rule?.kind==='sunlight-hypersensitivity')?.rule).toMatchObject({radiantDamageAtTurnStart:20})
  expect(rebuilt.traits.find(trait=>trait.rule?.kind==='regeneration')?.rule).toMatchObject({suppressedInSunlight:true,suppressedByDamageTypes:['radiant']})
  source.traits.find((trait:{rule?:{kind:string}})=>trait.rule?.kind==='regeneration').rule.suppressedInSunlight='true'
  expect(parseDnd5eMonsterStatBlock(source).ok).toBe(false)
 })
})


it('uses sunlight attack and ability disadvantage without penalizing a shaded actor',()=>{
 const before=state(true)
 expect(dnd5eMonsterSpellAttackMode(before,'actor','target','melee')).toBe('disadvantage')
 expect(dnd5eAbilityCheckRollMode(before.combatants.actor,{ability:'str'})).toBe('disadvantage')
 expect(dnd5eAbilityCheckRollMode(before.combatants.actor,{ability:'str',requestedMode:'advantage'})).toBe('normal')
 before.combatants.actor.inSunlight=false
 expect(dnd5eMonsterSpellAttackMode(before,'actor','target','melee')).toBe('normal')
 expect(dnd5eAbilityCheckRollMode(before.combatants.actor,{ability:'str'})).toBe('normal')
})
it('applies sunlight damage defenses and temporary HP through normal damage settlement',()=>{
 const before=state(true)
 before.combatants.actor.temporaryHp=5
 before.combatants.actor.damageResistances=['radiant']
 const result=resolveDnd5eHeadlessAction(before,{type:'begin-turn',actorId:'actor'})
 expect(result.ok).toBe(true)
 expect(result.state.combatants.actor.currentHp).toBe(45)
 expect(result.state.combatants.actor.temporaryHp).toBe(0)
 expect(result.events).toContainEqual(expect.objectContaining({type:'damage-applied',damageTypes:['radiant'],amount:10}))
})


it('settles an actual monster weapon attack with the lower sunlight die',()=>{
 const before=state(true)
 const attack=vampire.actions.find(action=>action.id==='claws' && action.automation==='headless' && action.attack)!
 expect(attack).toBeDefined()
 before.distanceFeetByCombatantPair={'actor\u0000target':5}
 const result=resolveDnd5eHeadlessAction(before,{type:'monster-action',actorId:'actor',actionId:attack.id,
  rolls:[{targetId:'target',d20:18,d20Second:2,damageRolls:attack.attack!.damage.map(damage=>Array(damage.count).fill(1))}]})
 expect(result.ok,JSON.stringify({reason:result.ok?undefined:result.reason,events:result.events})).toBe(true)
 expect(result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',actorId:'actor',d20:2,hit:false}))
})



it('limits ordinary sunlight sensitivity to attacks and explicitly visual perception',()=>{
 const before=state(true)
 before.combatants.actor.statBlockId=getDnd5eSrdMonsterBySlug('drow')!.id
 expect(dnd5eMonsterSpellAttackMode(before,'actor','target','melee')).toBe('disadvantage')
 expect(dnd5eAbilityCheckRollMode(before.combatants.actor,{ability:'wis',skill:'perception',context:'sight'})).toBe('disadvantage')
 expect(dnd5eAbilityCheckRollMode(before.combatants.actor,{ability:'wis',skill:'perception'})).toBe('normal')
 expect(dnd5eAbilityCheckRollMode(before.combatants.actor,{ability:'str'})).toBe('normal')
 const result=resolveDnd5eHeadlessAction(before,{type:'ability-check',actorId:'actor',ability:'wis',skill:'perception',context:'sight',d20:18,d20Second:2,dc:10})
 expect(result.ok,JSON.stringify(result.events)).toBe(true)
 expect(result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',d20:2,success:false}))
 const invalid=resolveDnd5eHeadlessAction(before,{type:'ability-check',actorId:'actor',ability:'str',context:'sight',d20:18,dc:10})
 expect(invalid.ok).toBe(false)
 before.combatants.actor.inSunlight=false
 expect(dnd5eAbilityCheckRollMode(before.combatants.actor,{ability:'wis',skill:'perception',context:'sight'})).toBe('normal')
})
it('preserves ordinary sunlight sensitivity through catalog JSON and workshop rebuild',()=>{
 const monster=getDnd5eSrdMonsterBySlug('drow')!
 const imported=JSON.parse(JSON.stringify(monster))
 expect(parseDnd5eMonsterStatBlock(imported).ok).toBe(true)
 const rebuilt=buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(imported))
 expect(rebuilt.traits.some(trait=>trait.rule?.kind==='sunlight-sensitivity')).toBe(true)
})
