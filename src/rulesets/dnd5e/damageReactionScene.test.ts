import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { resolveDnd5eActionWithDamageReactions } from './damageReactionFlow'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'

it.each(['accept', 'decline', 'immune', 'zero', 'invalid'])('scene damage reaction %s', async mode => {
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
    const actor = createDnd5eCombatant({ id: 'bearer', name: 'Bearer', initiative: 20, controller: 'player',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 12, currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30, position: {x:0,y:0}, concentrating: true })
    actor.pluginFeatureIds = [packageId + ':ward']
    if (mode === 'immune') actor.damageImmunities = ['fire']
    const state = startDnd5eHeadlessCombat('scene-reaction', [actor])
    expect(state.active).toBe(false)
    expect(resolveDnd5eHeadlessAction(state, {type:'move',actorId:actor.id,to:{x:1,y:0},distance:5})).toMatchObject({ok:false,reason:'combat-ended'})
    const original = structuredClone(state)
    let prompts = 0
    const result = await resolveDnd5eActionWithDamageReactions({ state, charactersByCombatantId: {}, combatRevision: 1,
      authorityUnchanged: () => true, confirm: async () => { prompts++; return { accepted: mode !== 'decline' } },
      roll: async () => { throw Error('No reaction dice') }, action: { type: 'scene-interaction-outcome', actorId: actor.id,
        interactionId: 'fire-trap', steps: [{id:'burn',kind:'damage',amount:mode==='zero'?0:mode==='invalid'?-1:16,damageType:'fire'}] } })
    expect(result.state.active).toBe(false)
    expect(result.ok).toBe(mode !== 'invalid')
    expect(prompts).toBe(['immune','zero','invalid'].includes(mode) ? 0 : 1)
    expect(result.state.combatants.bearer.currentHp).toBe(mode === 'accept' ? 32 : mode === 'decline' ? 24 : 40)
    expect(result.state.combatants.bearer.turn.reactionAvailable).toBe(mode !== 'accept')
    expect(result.state.combatants.bearer.classState.activeEffects?.filter(effect => effect.grantedActivities?.length) ?? []).toHaveLength(mode === 'accept' ? 1 : 0)
    expect(result.events.filter(event => event.type === 'concentration-check-required')).toHaveLength(['accept','decline'].includes(mode) ? 1 : 0)
    expect(state).toEqual(original)
  } finally { registration.dispose() }
})
