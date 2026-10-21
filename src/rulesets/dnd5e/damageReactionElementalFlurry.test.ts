import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, dnd5eCombatantPairKey, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveDnd5eActionWithDamageReactions } from './damageReactionFlow'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'

it('real absorb reacts to elemental flurry', async () => {
 const use='after-hit'
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
    state.combatants.bearer.pluginFeatureIds=[packageId+':ward']
    Object.assign(state.combatants.attacker,{controller:'dm',classId:'monk',classLevels:{monk:3},level:3,classResources:{'dnd5e-ki':{current:2,max:2}}})
    state.combatants.attacker.classState.monkAttackActionTurnKey='stored:1:attacker'
    state.combatants.attacker.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'elemental-fists',label:'Elemental fists',targetId:'attacker',source:{kind:'feature',actorId:'attacker'},modifiers:{attackProfiles:[{attackModes:['unarmed'],damageTypeOverride:'fire'}]}})]
    state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('attacker','bearer')]:5}
    state.combatants.bearer.concentrating=true
    const original=structuredClone(state)
    let confirmations=0
    const options={charactersByCombatantId:{},combatRevision:1,authorityUnchanged:()=>true,
      confirm:async()=>{confirmations++;return {accepted:true}},roll:async()=>{throw Error('No initial dice')}}
    const incoming=await resolveDnd5eActionWithDamageReactions({...options,state,action:{type:'monk-unarmed-bonus',actorId:'attacker',mode:'flurry',attackModifier:5,reachFeet:5,damageType:'fire',damage:{count:1,sides:4,bonus:0},attacks:[{targetId:'bearer',d20:15,damageRolls:[4]},{targetId:'bearer',d20:15,damageRolls:[4]}]}})
    expect(incoming.ok,JSON.stringify(incoming)).toBe(true)
    expect(confirmations).toBe(1)
    expect(incoming.state.combatants.bearer.currentHp).toBe(26)
    expect(incoming.state.combatants.bearer.turn.reactionAvailable).toBe(false)
    expect(incoming.state.combatants.bearer.classState.activeEffects?.filter(effect=>effect.grantedActivities?.length)).toHaveLength(1)
    expect(incoming.state.combatants.attacker.classResources['dnd5e-ki'].current).toBe(1)
    expect(incoming.state.combatants.attacker.turn.bonusActionAvailable).toBe(false)
    expect(incoming.events.filter(event=>event.type==='concentration-check-required')).toHaveLength(2)
    expect(state).toEqual(original)
  } finally { registration.dispose() }
})
