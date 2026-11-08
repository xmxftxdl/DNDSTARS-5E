import {resolveDnd5eActionWithAirborneFallPreview} from './airborneFallActionResolution'
import {createDnd5eDamageCommitSession} from './damageCommitSession'
import {createDnd5eConditionEffect} from './activeEffects'
import { expect, it, beforeAll, afterAll } from 'vitest'
import { FALSE_HYDRA } from './testFixtures/falseHydraDefinition'
import { registerDnd5ePluginMonsterCatalogEntry } from './roomMonsterCatalog'
import { validateDnd5eMonsterSchema } from './monsterSchema'
let unregister:()=>void
beforeAll(()=>{unregister=registerDnd5ePluginMonsterCatalogEntry(FALSE_HYDRA)})
afterAll(()=>unregister())
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { createMultipartCreature, livingMultipartHeads } from './multipartCreature'
import { dnd5eSavingThrowMode } from './passiveDefenses'

function fixture() {
  const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: id === 'hero' ? 20 : 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 184, maxHp: 184, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const hero = make('hero'), hydra = make('hydra')
  hydra.classState.monsterMultipart = createMultipartCreature({x:0,y:0,z:0})
  return startDnd5eHeadlessCombat('false-hydra', [hero, hydra])
}
it('records committed damage once against the shared creature, across multiple attacks', () => {
  let state = fixture()
  for (const amount of [30,30]) {
    const result = resolveDnd5eHeadlessAction(state, { type:'attack',actorId:'hero',targetId:'hydra',attackModifier:20,d20:10,
      spendAction:false,damage:{count:1,sides:100,bonus:0,rolls:[amount],type:'slashing'} })
    expect(result.ok).toBe(true)
    state = result.state
  }
  expect(state.combatants.hydra.currentHp).toBe(124)
  expect(state.combatants.hydra.classState.monsterMultipart?.pendingHeadDeaths).toBe(1)
  expect(state.combatants.hydra.classState.monsterMultipart?.damageRemainder).toBe(10)
})
it('kills every head and stops every song when the shared body dies', () => {
  const state = fixture()
  state.combatants.hydra.currentHp = 1
  state.combatants.hydra.classState.monsterMultipart!.heads[0].singingThroughTurn = 10
  const result = resolveDnd5eHeadlessAction(state, {type:'attack',actorId:'hero',targetId:'hydra',attackModifier:20,d20:10,
    spendAction:false,damage:{count:1,sides:10,bonus:0,rolls:[10],type:'slashing'}})
  expect(result.ok).toBe(true)
  expect(livingMultipartHeads(result.state.combatants.hydra.classState.monsterMultipart!)).toHaveLength(0)
  expect(result.state.combatants.hydra.classState.monsterMultipart!.heads[0].singingThroughTurn).toBeUndefined()
})
it('grants mental save advantage only while two or more heads survive', () => {
  const hydra = fixture().combatants.hydra
  expect(dnd5eSavingThrowMode(hydra,'wis')).toBe('advantage')
  expect(dnd5eSavingThrowMode(hydra,'con')).toBe('normal')
  hydra.classState.monsterMultipart!.heads.slice(1).forEach(head => {head.alive=false})
  expect(dnd5eSavingThrowMode(hydra,'wis')).toBe('normal')
})

it('pays one action for distinct-head songs and rejects reuse of a head', () => {
  let state = fixture()
  state.initiativeIndex = state.initiativeOrder.indexOf('hydra')
  for (const headId of ['head-1','head-2']) {
    const result = resolveDnd5eHeadlessAction(state, {type:'multipart-control',actorId:'hydra',headId,command:'sing'})
    expect(result.ok, JSON.stringify(result.ok ? null : result.reason)).toBe(true)
    state = result.state
  }
  expect(state.combatants.hydra.turn.actionAvailable).toBe(false)
  const repeat = resolveDnd5eHeadlessAction(state, {type:'multipart-control',actorId:'hydra',headId:'head-1',command:'sing'})
  expect(repeat.ok).toBe(false)
})

it('lets the DM choose a pending head death off-turn, without spending the creature action', () => {
  const state = fixture()
  state.combatants.hydra.classState.monsterMultipart!.pendingHeadDeaths = 1
  const result = resolveDnd5eHeadlessAction(state, {type:'multipart-control',actorId:'hydra',headId:'head-3',command:'sever'})
  expect(result.ok).toBe(true)
  expect(result.state.combatants.hydra.classState.monsterMultipart!.heads[2].alive).toBe(false)
  expect(result.state.combatants.hydra.turn.actionAvailable).toBe(true)
  expect(state.combatants.hydra.classState.monsterMultipart!.heads[2].alive).toBe(true)
})

it('validates the homebrew stat block and settles a bite at a remote head while preserving body position',()=>{
  expect(validateDnd5eMonsterSchema(FALSE_HYDRA)).toEqual([])
  const state=fixture()
  const hydra=state.combatants.hydra
  hydra.statBlockId=FALSE_HYDRA.id
  hydra.classState.monsterMultipart!.heads[0].position={x:30,y:0,z:0}
  state.combatants.hero.position={x:35,y:0}
  state.initiativeIndex=state.initiativeOrder.indexOf('hydra')
  const result=resolveDnd5eHeadlessAction(state,{type:'monster-action',actorId:'hydra',actionId:'bite-head-1',
    rolls:[{targetId:'hero',d20:10,damageRolls:[[5]],onHitEffectRolls:[{effectId:'grapple-head-1'}]}]})
  expect(result.ok,JSON.stringify(result.ok?null:{reason:result.reason,events:result.events})).toBe(true)
  expect(result.state.combatants.hydra.position).toEqual({x:0,y:0})
  expect(result.state.combatants.hero.currentHp).toBe(174)
  expect(result.state.combatants.hero.conditions).toContain('grappled')
  expect(result.state.combatants.hydra.classState.monsterMultipart!.heads[0].actionSpent).toBe(true)
})

function swallowedFixture() {
  let state=fixture()
  state.combatants.hydra.statBlockId=FALSE_HYDRA.id
  state.initiativeIndex=state.initiativeOrder.indexOf('hydra')
  state.combatants.hydra.classState.monsterMultipart!.heads[0].position={x:30,y:0,z:0}
  state.combatants.hero.position={x:35,y:0}
  const bite=resolveDnd5eHeadlessAction(state,{type:'monster-action',actorId:'hydra',actionId:'bite-head-1',
    rolls:[{targetId:'hero',d20:10,damageRolls:[[5]],onHitEffectRolls:[{effectId:'grapple-head-1'}]}]})
  expect(bite.ok).toBe(true)
  state=bite.state
  expect(state.combatants.hydra.classState.monsterMultipart!.heads[0].grappledTargetId).toBe('hero')
  // A later own turn: one head cannot bite and swallow in the same multiattack.
  state.combatants.hydra.classState.monsterMultipart!.heads[0].actionSpent=false
  state.combatants.hydra.turn.actionAvailable=true
  state.combatants.hydra.classState.monsterMultipart!.multiattackStarted=false
  const swallowed=resolveDnd5eHeadlessAction(state,{type:'monster-special-action',actorId:'hydra',actionId:'swallow-head-1',targetId:'hero'})
  expect(swallowed.ok,JSON.stringify(swallowed.ok?null:swallowed.reason)).toBe(true)
  expect(swallowed.state.combatants.hero.conditions).toContain('restrained')
  expect(swallowed.state.combatants.hero.conditions).toContain('blinded')
  expect(swallowed.state.combatants.hero.conditions).not.toContain('grappled')
  expect(swallowed.state.combatants.hydra.classState.monsterMultipart!.heads[0].swallowedTargetIds).toEqual(['hero'])
  return swallowed.state
}
it('swallows only its own grapple and releases all conditions next to the severed head',()=>{
  const state=swallowedFixture()
  state.combatants.hydra.classState.monsterMultipart!.pendingHeadDeaths=1
  const result=resolveDnd5eHeadlessAction(state,{type:'multipart-control',actorId:'hydra',headId:'head-1',command:'sever'})
  expect(result.ok).toBe(true)
  expect(result.state.combatants.hero.conditions).not.toContain('restrained')
  expect(result.state.combatants.hero.conditions).not.toContain('blinded')
  expect(Math.hypot(result.state.combatants.hero.position.x-30,result.state.combatants.hero.position.y)).toBe(5)
})
it('permits a Dexterity save to escape swallowing and uses a full action',()=>{
  const state=swallowedFixture()
  state.initiativeIndex=state.initiativeOrder.indexOf('hero')
  const effect=state.combatants.hero.classState.activeEffects!.find(e=>e.escapeSavingThrow)!
  expect(effect.escapeSavingThrow?.alternativeAbility).toBe('dex')
  const result=resolveDnd5eHeadlessAction(state,{type:'escape-active-effect',actorId:'hero',effectId:effect.id,ability:'dex',d20:20})
  expect(result.ok,JSON.stringify(result.ok?null:result.reason)).toBe(true)
  expect(result.state.combatants.hero.conditions).not.toContain('restrained')
  expect(result.state.combatants.hero.turn.actionAvailable).toBe(false)
})

it('pauses a failed save for the DM, then pays psychic damage exactly once on acceptance',()=>{
  const state=fixture(),hydra=state.combatants.hydra
  state.initiativeIndex=state.initiativeOrder.indexOf('hydra')
  hydra.classState.monsterMultipart!.damageRemainder=30
  const effect=createDnd5eConditionEffect({condition:'restrained',targetId:'hydra',source:{kind:'feature',actorId:'hero',rulesId:'test'},
    escapeSavingThrow:{ability:'str',dc:16,economy:'action'}})
  hydra.classState.activeEffects=[effect];hydra.conditions=['restrained']
  const command={type:'escape-active-effect' as const,actorId:'hydra',effectId:effect.id,d20:1}
  const session=createDnd5eDamageCommitSession(state,command,()=>false)
  const paused=session.run(state)
  expect(paused.status).toBe('pending-multipart-save')
  expect(hydra.currentHp).toBe(184)
  if(paused.status!=='pending-multipart-save')return
  const resolved=session.resumeMultipartSave(state,paused.occurrence,true)
  expect(resolved.status).toBe('resolved')
  if(resolved.status!=='resolved')return
  expect(resolved.result.ok).toBe(true)
  expect(resolved.result.state.combatants.hydra.currentHp).toBe(159)
  expect(resolved.result.state.combatants.hydra.conditions).not.toContain('restrained')
  expect(resolved.result.state.combatants.hydra.classState.monsterMultipart!.pendingHeadDeaths).toBe(1)
  expect(session.resumeMultipartSave(state,paused.occurrence,true).status).toBe('rejected')
})
it('resolves the all-head scream once per creature and consumes its recharge',()=>{
  const state=fixture();state.combatants.hydra.statBlockId=FALSE_HYDRA.id
  state.initiativeIndex=state.initiativeOrder.indexOf('hydra')
  const result=resolveDnd5eHeadlessAction(state,{type:'monster-area-action',actorId:'hydra',actionId:'many-headed-scream',
    resolution:{schemaVersion:1,targetIds:['hero'],targetSavingThrows:[{targetId:'hero',d20:1}],damageRolls:[5,5,5,5,5]}})
  expect(result.ok,JSON.stringify(result.ok?null:result.reason)).toBe(true)
  expect(result.state.combatants.hero.currentHp).toBe(159)
  expect(result.state.combatants.hero.conditions).toContain('stunned')
  expect(result.state.combatants.hydra.classState.monsterRechargeReadyByActionId?.['many-headed-scream']).toBe(false)
  expect(result.state.combatants.hydra.classState.monsterMultipart!.heads.every(h=>h.actionSpent)).toBe(true)
})

it('uses three additional reactions only for opportunity attacks, then the ordinary reaction',()=>{
 let state=fixture()
 const attack={type:'opportunity-attack' as const,actorId:'hydra',targetId:'hero',attackModifier:8,d20:10,
  damage:{count:1,sides:10,bonus:5,rolls:[5],type:'piercing' as const}}
 for(let i=0;i<4;i++){
  const result=resolveDnd5eHeadlessAction(state,attack)
  expect(result.ok,JSON.stringify(result.ok?null:result.reason)).toBe(true);state=result.state
  expect(state.combatants.hydra.turn.reactionAvailable).toBe(i<3)
 }
 expect(resolveDnd5eHeadlessAction(state,attack).ok).toBe(false)
 expect(state.combatants.hydra.classState.monsterMultipart!.extraOpportunityReactionsSpent).toBe(3)
})
it('applies acid at the swallowed target end turn and triggers requiem on death',()=>{
 const state=swallowedFixture(),hero=state.combatants.hero
 state.initiativeIndex=state.initiativeOrder.indexOf('hero');hero.currentHp=1;hero.usesDeathSaves=false;hero.creatureType='humanoid'
 const effect=hero.classState.activeEffects!.find(e=>e.periodicDamage)!
 const result=resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:'hero',activeEffectPeriodicDamageRolls:[{effectId:effect.id,targetId:'hero',rolls:[5]}],deferNextTurnStart:true})
 expect(result.ok,JSON.stringify(result.ok?null:result.reason)).toBe(true)
 expect(result.state.combatants.hero.deathSaves.dead).toBe(true)
 expect(result.state.combatants.hero.classState.falseHydraConsumedBy).toBe('hydra')
 expect(result.state.combatants.hydra.classState.monsterMultipart!.consumed[0].requiem).toBe(true)
})
it('permits one legendary head action per other creature turn without consuming the head multiattack',()=>{
 const state=fixture();state.combatants.hydra.statBlockId=FALSE_HYDRA.id
 state.combatants.hydra.classState.monsterLegendaryActionPoints=3
 const command={type:'monster-legendary-action' as const,actorId:'hydra',actionId:'legendary-bite-head-1',
  rolls:[{targetId:'hero',d20:10,damageRolls:[[5]],onHitEffectRolls:[{effectId:'grapple-head-1'}]}]}
 const result=resolveDnd5eHeadlessAction(state,command)
 expect(result.ok,JSON.stringify(result.ok?null:result.reason)).toBe(true)
 expect(result.state.combatants.hydra.classState.monsterLegendaryActionPoints).toBe(2)
 expect(result.state.combatants.hydra.classState.monsterMultipart!.heads[0].actionSpent).toBe(false)
 expect(resolveDnd5eHeadlessAction(result.state,command).ok).toBe(false)
})

it('previews and atomically resolves a fall when an elevated swallowing head dies',()=>{
 const state=swallowedFixture()
 const parts=state.combatants.hydra.classState.monsterMultipart!
 parts.heads[0].position.z=30;parts.pendingHeadDeaths=1
 const command={type:'multipart-control' as const,actorId:'hydra',headId:'head-1',command:'sever' as const}
 const preview=resolveDnd5eActionWithAirborneFallPreview(state,command)
 expect(preview.airborneFalls?.some(f=>f.combatantId==='hero'&&f.fallingDamageDice===3)).toBe(true)
 const settled=resolveDnd5eActionWithAirborneFallPreview(state,command,{hero:[2,2,2]})
 expect(settled.result.ok,JSON.stringify(settled.result)).toBe(true)
 expect(settled.result.state.combatants.hero.elevationFeet).toBe(0)
 expect(settled.result.state.combatants.hero.currentHp).toBe(168)
})

it('allows pending head death while stunned, but does not allow a new song',()=>{
 const state=fixture();state.combatants.hydra.conditions=['stunned']
 state.initiativeIndex=state.initiativeOrder.indexOf('hydra')
 state.combatants.hydra.classState.monsterMultipart!.pendingHeadDeaths=1
 expect(resolveDnd5eHeadlessAction(state,{type:'multipart-control',actorId:'hydra',headId:'head-1',command:'sing'}).ok).toBe(false)
 expect(resolveDnd5eHeadlessAction(state,{type:'multipart-control',actorId:'hydra',headId:'head-1',command:'sever'}).ok).toBe(true)
})

it('uses a living remote head for an opportunity bite and grapples without spending its action',()=>{
 const state=fixture(),hydra=state.combatants.hydra
 hydra.statBlockId=FALSE_HYDRA.id
 hydra.classState.monsterMultipart!.heads[0].alive=false
 hydra.classState.monsterMultipart!.heads[1].position={x:30,y:0,z:0}
 hydra.classState.monsterMultipart!.heads[1].actionSpent=true
 state.combatants.hero.position={x:35,y:0}
 const result=resolveDnd5eHeadlessAction(state,{type:'opportunity-attack',actorId:'hydra',targetId:'hero',attackModifier:8,d20:10,
   damage:{count:1,sides:10,bonus:5,rolls:[5],type:'piercing'}})
 expect(result.ok,JSON.stringify(result.ok?null:result.reason)).toBe(true)
 expect(result.state.combatants.hero.conditions).toContain('grappled')
 expect(result.state.combatants.hydra.classState.monsterMultipart!.heads[1].grappledTargetId).toBe('hero')
 expect(result.state.combatants.hydra.turn.actionAvailable).toBe(true)
 expect(result.state.combatants.hydra.turn.reactionAvailable).toBe(true)
 expect(result.state.combatants.hydra.position).toEqual({x:0,y:0})
})
