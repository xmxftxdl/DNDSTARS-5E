import {buildDnd5eCustomMonster,createDnd5eCustomMonsterDraft,createDnd5eCustomMonsterMechanicDraft} from './customMonsterWorkshop'
import {setDnd5eRoomMonsterCatalog} from './monsters'
import { expect, it } from 'vitest'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveDnd5eActionWithDamageReactions } from './damageReactionFlow'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'

it.each(['pending-damage','pending-attack','after-hit','after-hit-immune'])('reacts before defenses on secondary damage (use=%s)', async caseId => {
  const immune=caseId==='after-hit-immune'
  const use=immune?'after-hit':caseId
  const packageId = 'test.stored-reaction'
  const automation = automationCapabilityFromLegacyStatus('full')
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'ward', name: 'Synthetic ward', activation: { kind: 'reaction' }, target: { kind: 'self' },
    legacySource: { kind: 'feature', id: 'ward' }, automation,
    invocation: { kind: 'triggered', event: 'before-damage', confirmation: 'actor-choice' },
    requirements: [{ kind: 'damage-type', damageTypes: ['fire','acid'] }],
    consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }],
    effects: [{ schemaVersion: 1, id: 'defense', name: 'Defense', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
      modifiers: [{ kind: 'damage-resistance', damageType: 'fire' }, { kind: 'damage-resistance', damageType: 'acid' }] },
    { schemaVersion: 1, id: 'charge', name: 'Stored follow-up', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-end' },
      suspendWhileEffectId: 'defense', grants: ['follow-up'], grantsSingleUse: true }],
    outcomes: [{ id: 'ward', when: { kind: 'always' }, operations: [
      { id: 'defense', kind: 'apply-effect', target: 'actor', effectId: 'defense' },
      { id: 'charge', kind: 'apply-effect', target: 'actor', effectId: 'charge' },
    ] }],
  }, {
    schemaVersion: 1, id: 'follow-up', name: 'Synthetic follow-up', activation: { kind: 'free' }, automation,
    legacySource: { kind: 'feature', id: 'ward' }, requiresEffectGrant: true,
    invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'automatic' },
    target: { kind: 'creature', relation: 'any', count: 1 },
    requirements: [{ kind: 'attack-delivery', delivery: 'melee' }, { kind: 'turn-owner', owner: 'actor' }],
    outcomes: [{ id: 'hit', when: { kind: 'always' }, operations: [
      { id: 'extra', kind: 'damage', target: 'target', damageType: 'fire', amount: { kind: 'constant', value: 3 } },
    ] }],
  }] })
  try {
    const actor = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    let state=startDnd5eHeadlessCombat('stored',[actor('attacker',use==='after-hit'?20:10),actor('bearer',use==='after-hit'?10:20)])
    state.combatants.bearer.pluginFeatureIds = [packageId + ':ward']
    state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('attacker','bearer')]:30}
    const draft=createDnd5eCustomMonsterDraft()
    draft.actions[0].toHit=8
    draft.headlessMechanics=[{...createDnd5eCustomMonsterMechanicDraft(),id:'elemental',name:'Elemental',
      trigger:use==='after-hit'?'after-hit':'movement',triggerSubject:'hostile-within',triggerRadiusFeet:30,movementComparison:'at-least',movementFeet:5,
      hpPercentageAtOrBelow:use==='after-hit'?100:undefined,effectKind:use==='pending-attack'?'attack':'damage',effectTarget:use==='after-hit'?'trigger-target':'selected-subject',
      healingDice:'1d6',damageType:'fire',attackToHit:8,attackEconomy:'reaction',limit:'once-per-turn'}]
    const monster=buildDnd5eCustomMonster(draft)
    monster.actions[0].attack!.damage=[{count:1,sides:6,bonus:0,average:2,type:'slashing'}]
    setDnd5eRoomMonsterCatalog([monster])
    Object.assign(state.combatants.attacker,{statBlockId:monster.id,controller:'dm'})
    state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('attacker','bearer')]:5}
    let pendingId=''
    if(use!=='after-hit'){
      const moved=resolveDnd5eHeadlessAction(state,{type:'move',actorId:'bearer',to:{x:1,y:0},distance:5})
      expect(moved.ok,JSON.stringify(moved)).toBe(true)
      const pending=moved.events.find(event=>event.type==='monster-mechanic-trigger-pending')
      if(pending?.type!=='monster-mechanic-trigger-pending')throw Error('Missing trigger')
      pendingId=pending.snapshot.id;state=moved.state
    }
    if(immune)state.combatants.bearer.damageImmunities=['fire']
    const original=structuredClone(state)
    let confirmations=0
    const options={charactersByCombatantId:{},combatRevision:1,authorityUnchanged:()=>true,
      confirm:async()=>{confirmations++;return {accepted:true}},roll:async()=>{throw Error('No initial dice')}}
    const incoming=await resolveDnd5eActionWithDamageReactions({...options,state,action:use==='after-hit'
      ? {type:'monster-action',actorId:'attacker',actionId:monster.actions[0].id,rolls:[{targetId:'bearer',d20:15,damageRolls:[[2]]}],mechanicRolls:[{actorId:'attacker',mechanicId:'elemental',targetId:'bearer',effectRolls:[{effectId:'effect-0',rolls:[6]}]}]}
      : {type:'resolve-monster-mechanic-trigger',actorId:'attacker',snapshotId:pendingId,roll:{actorId:'attacker',mechanicId:'elemental',...(use==='pending-damage'?{effectRolls:[{effectId:'effect-0',rolls:[6]}]}:{targetId:'bearer',attackRolls:[{effectId:'effect-0',targetId:'bearer',d20:15,damageRolls:[6]}]})}}})
    expect(incoming.ok,JSON.stringify(incoming)).toBe(true)
    expect(confirmations).toBe(immune?0:1)
    expect(incoming.state.combatants.bearer.currentHp).toBe(immune?28:use==='after-hit'?25:27)
    expect(incoming.state.combatants.bearer.turn.reactionAvailable).toBe(immune)
    expect(incoming.state.combatants.bearer.classState.activeEffects?.filter(effect=>effect.grantedActivities?.length)??[]).toHaveLength(immune?0:1)
    expect(state).toEqual(original)
  } finally { registration.dispose();setDnd5eRoomMonsterCatalog([]) }
})
