import { expect, it } from 'vitest'
import { applyDnd5eStandardConditionEffect, createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, type Dnd5eAction } from './headlessCombatEngine'
import { createDnd5eActivityDamageCommitSession, createDnd5eDamageCommitSession } from './damageCommitSession'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { listDnd5ePersonalDamageCheckpointActivitiesV1 } from './activities/dnd5eActivityTriggerWindows'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { resolveDnd5eDamageCheckpointReaction, type Dnd5eDamageReactionSelection } from './damageCommitReaction'
import type { Dnd5eRegisteredActivityCombatAuthorityInputV1 } from './activities/dnd5eActivityCombatAuthority'
import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'

function fixture() {
  const combatant = (id: string, initiative: number) => createDnd5eCombatant({
    id, name: id, initiative, controller: 'player', abilities: {str:14,dex:14,con:12,int:10,wis:10,cha:10},
    proficiencyBonus:2,armorClass:12,currentHp:20,maxHp:20,temporaryHp:0,speed:30,
    position:{x:0,y:0},concentrating:false,
  })
  const state=startDnd5eHeadlessCombat('checkpoint-test',[combatant('actor',20),combatant('target',10)])
  const action:Dnd5eAction={type:'attack',actorId:'actor',targetId:'target',attackModifier:4,d20:18,damage:{count:1,sides:6,bonus:2,rolls:[4],type:'fire'}}
  return {state,action}
}

it.each([false, true])('shares one replay across attacker hit choice and defender damage choice (cancel=%s)', cancel => {
  const { state, action } = fixture()
  state.combatants.actor.classResources.focus = { current: 1, max: 1 }
  if (action.type !== 'attack') throw Error('expected attack')
  action.classDamageContext = { mode: 'melee', weaponId: 'test-sword', weaponDamageSides: 6,
    finesse: false, strengthBased: true, damageType: 'fire', adjacentEnemyOfTarget: false }
  const original = structuredClone(state)
  let hitPrompts = 0, damagePrompts = 0
  const session = createDnd5eDamageCommitSession(state, action, () => { damagePrompts++; return true },
    undefined, undefined, () => { hitPrompts++; return true })
  const hit = session.run(state)
  expect(hit.status).toBe('pending-weapon-hit')
  if (hit.status !== 'pending-weapon-hit') throw Error('expected weapon pause')
  expect(hit.snapshot.combatants.target.currentHp).toBe(20)
  const damage = session.resumeWeaponHit(state, hit.occurrence, hit.event, {
    extraDice: { count: 1, rolls: [3], doubleOnCritical: true }, resourceCosts: [{ resourceId: 'focus', amount: 1 }],
  })
  expect(damage.status).toBe('pending')
  if (damage.status !== 'pending') throw Error('expected defender pause')
  expect(damage.checkpoint.amount).toBe(9)
  expect(session.resumeWeaponHit(state, hit.occurrence, hit.event)).toMatchObject({ status: 'rejected', reason: 'stale-checkpoint' })
  if (cancel) {
    session.cancel()
    expect(session.decline(state, damage.checkpoint)).toMatchObject({ status: 'rejected', reason: 'session-ended' })
  } else {
    const result = session.decline(state, damage.checkpoint)
    if (result.status !== 'resolved') throw Error('expected final commit')
    expect(result.result.ok).toBe(true)
    expect(result.result.state.combatants.target.currentHp).toBe(11)
    expect(result.result.state.combatants.actor.classResources.focus.current).toBe(0)
    expect(result.result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
  }
  expect(hitPrompts).toBe(1)
  expect(damagePrompts).toBe(1)
  expect(state).toEqual(original)
  const ordinary = resolveDnd5eHeadlessAction(state, action)
  expect(ordinary.state.combatants.target.currentHp).toBe(14)
  expect(ordinary.state.combatants.actor.classResources.focus.current).toBe(1)
})

it('pauses real damage without committing HP or economy and replays a declined reaction once',()=>{
  const {state,action}=fixture(),before=structuredClone(state)
  const session=createDnd5eDamageCommitSession(state,action,()=>true)
  const pending=session.run(state)
  expect(pending.status,JSON.stringify(pending)).toBe('pending');if(pending.status!=='pending')return
  expect(pending.checkpoint).toMatchObject({targetId:'target',sourceId:'actor',amount:6,occurrence:0,phase:'raw-typed-damage-before-defenses'})
  expect(state).toEqual(before)
  if(action.type==='attack')action.damage={...action.damage,rolls:[1]}
  const resolved=session.decline(state,pending.checkpoint)
  expect(resolved.status).toBe('resolved');if(resolved.status!=='resolved')return
  expect(resolved.result.ok).toBe(true)
  expect(resolved.result.state.combatants.target.currentHp).toBe(14)
  expect(resolved.result.events.filter(event=>event.type==='damage-applied')).toHaveLength(1)
  expect(state).toEqual(before)
  expect(session.decline(state,pending.checkpoint)).toEqual({status:'rejected',reason:'session-ended'})
  // A paused session cannot leak its listener into unrelated ordinary resolution.
  expect(resolveDnd5eHeadlessAction(state,action).ok).toBe(true)
})

it('rejects altered checkpoint replies and changed authoritative state',()=>{
  const {state,action}=fixture(),session=createDnd5eDamageCommitSession(state,action,()=>true)
  const pending=session.run(state);if(pending.status!=='pending')throw Error('no pending checkpoint')
  expect(session.decline(state,{...pending.checkpoint,amount:1})).toEqual({status:'rejected',reason:'stale-checkpoint'})
  state.combatants.target.temporaryHp=8
  expect(session.decline(state,pending.checkpoint)).toEqual({status:'rejected',reason:'stale-state'})
  expect(state.combatants.target.currentHp).toBe(20)
  expect(state.combatants.target.temporaryHp).toBe(8)
})

it('cancels without consuming resources or permitting later resume',()=>{
  const {state,action}=fixture(),session=createDnd5eDamageCommitSession(state,action,()=>true)
  expect(session.run(state).status).toBe('pending')
  session.cancel()
  expect(session.run(state)).toEqual({status:'rejected',reason:'session-ended'})
  expect(state.combatants.target.currentHp).toBe(20)
})


it('does not offer a damage checkpoint for a missed attack',()=>{
 const {state,action}=fixture()
 if(action.type==='attack')action.d20=2
 let offered=false
 const result=createDnd5eDamageCommitSession(state,action,()=>{offered=true;return true}).run(state)
 expect(result.status).toBe('resolved')
 expect(offered).toBe(false)
 if(result.status==='resolved')expect(result.result.state.combatants.target.currentHp).toBe(20)
})

it('does not prompt when existing immunity already cancels the incoming damage', () => {
  const {state,action}=fixture()
  state.combatants.target.damageImmunities=['fire']
  let offered=0
  const result=createDnd5eDamageCommitSession(state,action,()=>{offered++;return true}).run(state)
  expect(offered).toBe(0)
  expect(result.status).toBe('resolved')
  if(result.status==='resolved')expect(result.result.state.combatants.target.currentHp).toBe(20)
})

it.each([
  {kind:'damage-resistance' as const,expected:12},
  {kind:'damage-immunity' as const,expected:15},
  {kind:'damage-vulnerability' as const,expected:1},
])('applies a personal $kind only to the matching component in a registered damage Activity', ({kind,expected}) => {
  const registration=registerDnd5eActivityPackage({packageId:'test.raw-component',packageVersion:'1.0.0',activities:[{
    schemaVersion:1,id:'pulse',name:'Pulse',activation:{kind:'free'},target:{kind:'creature',relation:'any',count:1,rangeFeet:30},
    legacySource:{kind:'feature',id:'pulse'},automation:automationCapabilityFromLegacyStatus('full'),
    consumption:[{kind:'resource',resourceId:'pulse-uses',amount:{kind:'constant',value:1},consumeOn:'confirm'}],
    outcomes:[{id:'damage',when:{kind:'always'},operations:[
      {id:'fire',kind:'damage',target:'target',amount:{kind:'constant',value:7},damageType:'fire'},
      {id:'cold',kind:'damage',target:'target',amount:{kind:'constant',value:5},damageType:'cold'},
    ]}],
  },{
    schemaVersion:1,id:'guard',name:'Guard',activation:{kind:'reaction'},target:{kind:'self'},
    legacySource:{kind:'feature',id:'guard'},automation:automationCapabilityFromLegacyStatus('full'),
    invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice',retention:'single-event'},
    effects:[{schemaVersion:1,id:'defense',name:'Defense',duration:{kind:'rounds',rounds:1,expiresAt:'target-turn-end'},stacking:'replace',modifiers:[{kind,damageType:'fire'}]}],
    outcomes:[{id:'protect',when:{kind:'always'},operations:[{id:'protect',kind:'apply-effect',target:'actor',effectId:'defense'}]}],
  }]})
  try {
    const {state}=fixture()
    state.combatants.actor.pluginFeatureIds=['pulse']
    state.combatants.actor.classResources['pulse-uses']={current:1,max:1}
    state.combatants.target.pluginFeatureIds=['guard']
    state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:0}
    let offers=0
    const authority:Dnd5eRegisteredActivityCombatAuthorityInputV1={state,combatRevision:1,authoritativeRolls:{},confirmedBy:'actor',command:{
      schemaVersion:1,commandId:'pulse-once',actorId:'actor',packageId:'test.raw-component',packageVersion:'1.0.0',activityId:'pulse',targetIds:['target'],expectedRevision:1,
    }}
    const before=structuredClone(state)
    const session=createDnd5eActivityDamageCommitSession(authority,(checkpoint,snapshot)=>{
      expect(checkpoint.phase).toBe('raw-typed-damage-before-defenses')
      offers++
      if(!snapshot)throw Error('missing Host snapshot')
      return true
    })
    const first=session.run(state)
    expect(first.status).toBe('pending');if(first.status!=='pending')return
    expect(first.checkpoint).toMatchObject({occurrence:0,amount:7})
    expect(state).toEqual(before)
    // Editing the submitted object after suspension cannot change the replay.
    authority.command.actorId='missing'
    const second=session.accept(state,first.checkpoint,{
        command:{schemaVersion:1,commandId:'guard-once',actorId:'target',packageId:'test.raw-component',packageVersion:'1.0.0',activityId:'guard',targetIds:['target'],expectedRevision:1,
          triggerEventId:first.triggerEventId},
        combatRevision:1,authoritativeRolls:{},confirmedBy:'actor',
    })
    expect(second.status,JSON.stringify(second)).toBe('pending');if(second.status!=='pending')return
    expect(second.checkpoint).toMatchObject({occurrence:1,amount:5})
    expect(second.triggerEventId).not.toBe(first.triggerEventId)
    expect(state).toEqual(before)
    const final=session.decline(state,second.checkpoint)
    expect(final.status,JSON.stringify(final)).toBe('resolved');if(final.status!=='resolved')return
    const result=final.result
    expect(result.result.ok,JSON.stringify(result)).toBe(true)
    if(result.phase==='commit'&&result.result.ok){
      expect(result.result.state.combatants.target.currentHp).toBe(expected)
      expect(result.result.state.combatants.target.turn.reactionAvailable).toBe(false)
      expect(result.result.state.combatants.actor.classResources['pulse-uses'].current).toBe(0)
      expect(result.result.events.filter(event=>event.type==='activity-resolved'&&event.activityId==='guard')).toHaveLength(1)
      expect(result.result.events.filter(event=>event.type==='activity-resolved'&&event.activityId==='pulse')).toHaveLength(1)
    }
    expect(offers).toBe(2)
    expect(state.combatants.target.currentHp).toBe(20)
    expect(session.decline(state,second.checkpoint)).toEqual({status:'rejected',reason:'session-ended'})
    if(kind==='damage-resistance') {
      authority.command.actorId='actor'
      const changedCatalog=createDnd5eActivityDamageCommitSession(authority,()=>true)
      const awaiting=changedCatalog.run(state)
      expect(awaiting.status).toBe('pending');if(awaiting.status!=='pending')return
      registration.dispose()
      expect(changedCatalog.decline(state,awaiting.checkpoint)).toEqual({status:'rejected',reason:'changed-activity'})
      expect(state).toEqual(before)
    }
  } finally {registration.dispose()}
})

it.each([
  {explicitCost:false,resistance:false,alreadyResistant:false},
  {explicitCost:true,resistance:false,alreadyResistant:false},
  {explicitCost:true,resistance:true,alreadyResistant:false},
  {explicitCost:true,resistance:true,alreadyResistant:true},
])('settles defenses from raw damage once (%j)', ({explicitCost,resistance,alreadyResistant}) => {
  const registration = registerDnd5eActivityPackage({packageId:'test.accept-ward',packageVersion:'1.0.0',activities:[{
    schemaVersion:1,id:'ward',name:'Ward',activation:{kind:'reaction'},
    invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice',retention:'single-event'},
    target:{kind:'self'},legacySource:{kind:'feature',id:'ward'},automation:automationCapabilityFromLegacyStatus('full'),
    consumption:[{kind:'resource',resourceId:'test.accept-ward:uses',amount:{kind:'constant',value:1},consumeOn:'confirm'},
      ...(explicitCost ? [{kind:'action-economy' as const,economy:'reaction' as const,amount:1 as const,consumeOn:'confirm' as const}] : [])],
    effects:[{schemaVersion:1,id:'ward-life',name:'Ward',duration:{kind:'rounds',rounds:1,expiresAt:'target-turn-end'},stacking:'replace',modifiers:resistance ? [{kind:'damage-resistance',damageType:'fire'}] : []}],
    outcomes:[{id:'grant',when:{kind:'always'},operations:[
      {id:'lifetime',kind:'apply-effect',target:'actor',effectId:'ward-life'},
      {id:'hp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:4},sourceEffectId:'ward-life'},
    ]}],
  }]})
  try {
    const {state,action} = fixture()
    if(alreadyResistant)state.combatants.target.damageResistances = ['fire']
    state.combatants.target.pluginFeatureIds = ['ward']
    state.combatants.target.classResources['test.accept-ward:uses'] = {current:1,max:1}
    const before = structuredClone(state)
    const selection:Dnd5eDamageReactionSelection = {
      command:{schemaVersion:1,commandId:'reaction-1',actorId:'target',packageId:'test.accept-ward',packageVersion:'1.0.0',activityId:'ward',targetIds:['target'],expectedRevision:7},
      combatRevision:7,authoritativeRolls:{},confirmedBy:'actor',
    }
    const session = createDnd5eDamageCommitSession(state,action,()=>true)
    const pending = session.run(state)
    expect(pending.status).toBe('pending'); if(pending.status!=='pending')return
    selection.command.triggerEventId = pending.triggerEventId
    const forged = {...selection, command:{...selection.command,actorId:'actor'}}
    expect(session.accept(state,pending.checkpoint,forged)).toEqual({status:'rejected',reason:'ineligible-reaction'})
    if (resistance) {
      // Unconverted legacy damage paths still fail closed; adjusted damage
      // cannot be reinterpreted as the original roll.
      expect(resolveDnd5eDamageCheckpointReaction({state,checkpoint:{...pending.checkpoint,phase:'adjusted-damage-before-hit-points'},selection,eventBatchId:'legacy'}))
        .toMatchObject({ok:false,reason:'unsupported-reaction'})
    }
    const stale = {...selection,command:{...selection.command,expectedRevision:6}}
    expect(session.accept(state,pending.checkpoint,stale)).toMatchObject({status:'rejected',reason:'reaction-rejected'})
    const wrongEvent = {...selection,command:{...selection.command,triggerEventId:'another-event'}}
    expect(session.accept(state,pending.checkpoint,wrongEvent)).toMatchObject({status:'rejected',reason:'reaction-rejected'})
    expect(state).toEqual(before)
    const result = session.accept(state,pending.checkpoint,selection)
    expect(result.status,JSON.stringify(result)).toBe('resolved');if(result.status!=='resolved')return
    expect(result.result.ok,JSON.stringify(result)).toBe(true)
    const target = result.result.state.combatants.target
    expect(target.currentHp).toBe(resistance ? 20 : 18)
    expect(target.temporaryHp).toBe(resistance ? 1 : 0)
    if(resistance)expect(result.result.events.filter(event=>event.type==='damage-defense-resolved')).toMatchObject([
      {damageBefore:6,damageAfter:3,damageType:'fire'},
    ])
    expect(target.classResources['test.accept-ward:uses'].current).toBe(0)
    expect(target.turn.reactionAvailable).toBe(false)
    expect(result.result.events.filter(event=>event.type==='damage-applied')).toHaveLength(1)
    expect(result.result.events.filter(event=>event.type==='activity-resolved' && event.activityId==='ward')).toHaveLength(1)
    expect(result.result.events.filter(event=>event.type==='turn-resource-spent' && event.actorId==='target' && event.resource==='reaction')).toHaveLength(1)
    expect(state).toEqual(before)
    expect(session.accept(state,pending.checkpoint,selection)).toEqual({status:'rejected',reason:'session-ended'})
  } finally { registration.dispose() }
})

it('discovers only owned, funded personal reactions from the live pre-HP snapshot', () => {
  const registration = registerDnd5eActivityPackage({ packageId: 'test.checkpoint.discovery', packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'ward', name: 'Ward', activation: { kind: 'reaction' },
    invocation: { kind: 'triggered', event: 'before-damage', confirmation: 'actor-choice', retention: 'single-event' },
    target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'ward' },
    automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{kind: 'resource', resourceId: 'test.checkpoint.discovery:ward', amount: {kind:'constant',value:1}, consumeOn:'confirm'}],
    outcomes: [{id:'protect',when:{kind:'always'},operations:[{id:'protect',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:10}}]}],
  }] })
  try {
    for (const mode of ['eligible', 'unowned', 'spent', 'no-reaction', 'incapacitated'] as const) {
      const {state, action} = fixture()
      const defender = state.combatants.target
      defender.pluginFeatureIds = mode === 'unowned' ? [] : ['ward']
      defender.classResources['test.checkpoint.discovery:ward'] = {current: mode === 'spent' ? 0 : 1, max:1}
      defender.classResources['other:ward'] = {current:99,max:99}
      if (mode === 'no-reaction') defender.turn.reactionAvailable = false
      if (mode === 'incapacitated') applyDnd5eStandardConditionEffect(defender, state.combatants.actor, {
        rulesId:'test-incapacitated',condition:'incapacitated',sourceKind:'spell',magical:true,
        duration:{type:'rounds',remainingRounds:2,tickOn:'target-turn-end'},
      }, [])
      const before = structuredClone(state)
      const session = createDnd5eDamageCommitSession(state, action, (checkpoint, snapshot) => {
        expect(snapshot).toBeDefined()
        if (!snapshot) return false
        expect(snapshot.combatants.target.currentHp).toBe(20)
        const windows = listDnd5ePersonalDamageCheckpointActivitiesV1({state:snapshot,checkpoint,eventBatchId:mode})
        const found = windows.some(window => window.available.some(entry => entry.packageId === 'test.checkpoint.discovery'))
        expect(found, mode).toBe(mode === 'eligible')
        // Discovery callbacks cannot mutate the engine's in-flight transaction.
        snapshot.combatants.target.currentHp = 1
        return found
      })
      const result = session.run(state)
      expect(result.status, mode).toBe(mode === 'eligible' ? 'pending' : 'resolved')
      if (result.status === 'resolved') expect(result.result.state.combatants.target.currentHp).toBe(14)
      expect(state).toEqual(before)
    }
  } finally { registration.dispose() }
})


it.each([10, 30])('activates deferred vulnerability and expires its separate temporary HP pool (%s)',pool=>{
 const registration=registerDnd5eActivityPackage({packageId:'test.deferred-guard',packageVersion:'1.0.0',activities:[{
  schemaVersion:1,id:'pulse',name:'Pulse',activation:{kind:'free'},target:{kind:'creature',relation:'any',count:1,rangeFeet:30},
  legacySource:{kind:'feature',id:'pulse'},automation:automationCapabilityFromLegacyStatus('full'),
  outcomes:[{id:'damage',when:{kind:'always'},operations:[
   {id:'first',kind:'damage',target:'target',amount:{kind:'constant',value:7},damageType:'fire'},
   {id:'second',kind:'damage',target:'target',amount:{kind:'constant',value:7},damageType:'fire'},
  ]}],
 },{
  schemaVersion:1,id:'guard',name:'Guard',activation:{kind:'reaction'},target:{kind:'self'},legacySource:{kind:'feature',id:'guard'},automation:automationCapabilityFromLegacyStatus('full'),
  invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice',retention:'single-event'},
  consumption:[{kind:'resource',resourceId:'guard-uses',amount:{kind:'constant',value:1},consumeOn:'confirm'}],
  effects:[{schemaVersion:1,id:'pool-life',name:'Temporary HP lifetime',duration:{kind:'rounds',rounds:1,expiresAt:'target-turn-end'},stacking:'replace',modifiers:[]},
   {schemaVersion:1,id:'penalty',name:'After damage',disposition:'debuff',duration:{kind:'rounds',rounds:1,expiresAt:'target-turn-end'},stacking:'replace',
   conditions:['incapacitated'],modifiers:[{kind:'damage-vulnerability',damageType:'fire'},{kind:'speed',mode:'override',value:{kind:'constant',value:0}}]}],
  outcomes:[{id:'protect',when:{kind:'always'},operations:[
   {id:'pool-life',kind:'apply-effect',target:'actor',effectId:'pool-life'},
   {id:'hp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:pool},sourceEffectId:'pool-life'},
   {id:'penalty',kind:'apply-effect',target:'actor',effectId:'penalty',timing:'after-triggering-damage'},
  ]}],
 }]})
 try {
  const {state}=fixture();state.combatants.actor.pluginFeatureIds=['pulse'];state.combatants.target.pluginFeatureIds=['guard']
  state.combatants.target.classResources['guard-uses']={current:1,max:1}
  state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:0}
  const before=structuredClone(state)
  const session=createDnd5eActivityDamageCommitSession({state,combatRevision:1,authoritativeRolls:{},confirmedBy:'actor',command:{
   schemaVersion:1,commandId:'pulse',actorId:'actor',packageId:'test.deferred-guard',packageVersion:'1.0.0',activityId:'pulse',targetIds:['target'],expectedRevision:1,
  }},(checkpoint,snapshot)=>{
   if(checkpoint.occurrence===1){
    expect(snapshot?.combatants.target.currentHp).toBe(20)
    expect(snapshot?.combatants.target.temporaryHp).toBe(pool-7)
    expect(snapshot?.combatants.target.conditions).toContain('incapacitated')
   }
   return true
  })
  const first=session.run(state);expect(first.status).toBe('pending');if(first.status!=='pending')return
  const second=session.accept(state,first.checkpoint,{command:{schemaVersion:1,commandId:'guard',actorId:'target',packageId:'test.deferred-guard',packageVersion:'1.0.0',activityId:'guard',targetIds:['target'],expectedRevision:1,triggerEventId:first.triggerEventId},combatRevision:1,authoritativeRolls:{},confirmedBy:'actor'})
  expect(second.status,JSON.stringify(second)).toBe('pending');if(second.status!=='pending')return
  expect(second.checkpoint.amount).toBe(14)
  const done=session.decline(state,second.checkpoint)
  expect(done.status).toBe('resolved');if(done.status!=='resolved')return
  expect(done.result.result.ok,JSON.stringify(done.result)).toBe(true)
  if(done.result.phase!=='commit' || !done.result.result.ok)throw Error('damage commit failed')
  expect(done.result.result.state.combatants.target.currentHp).toBe(pool===10?9:20)
  expect(done.result.result.state.combatants.target.temporaryHp).toBe(Math.max(0,pool-21))
  expect(done.result.result.state.combatants.target.classResources['guard-uses'].current).toBe(0)
  const events=done.result.result.events
  const damage=events.filter(e=>e.type==='damage-applied')
  expect(damage.map(e=>e.amount)).toEqual([7,14])
  expect(events.filter(e=>e.type==='activity-resolved'&&e.activityId==='guard')).toHaveLength(1)
  expect(state).toEqual(before)
  const targetTurn=resolveDnd5eHeadlessAction(done.result.result.state,{type:'end-turn',actorId:'actor'})
  expect(targetTurn.ok).toBe(true)
  const expired=resolveDnd5eHeadlessAction(targetTurn.state,{type:'end-turn',actorId:'target'})
  expect(expired.ok).toBe(true)
  expect(expired.state.combatants.target.conditions).not.toContain('incapacitated')
  expect(expired.state.combatants.target.temporaryHp).toBe(0)
  expect(expired.state.combatants.target.classState.temporaryHitPointsSource).toBeUndefined()
 } finally {registration.dispose()}
})
