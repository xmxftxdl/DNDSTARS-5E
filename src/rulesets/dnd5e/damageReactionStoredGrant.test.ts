import { createDnd5eMechanicalEffect } from './activeEffects'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveDnd5eActionWithDamageReactions } from './damageReactionFlow'
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement'

it.each(['expire', 'weapon', 'spell', 'save', 'monster-save', 'monster-attack', 'periodic'])('persists a dormant personal reaction grant until its defense expires (use=%s)', async use => {
  const packageId = 'test.stored-reaction'
  const automation = automationCapabilityFromLegacyStatus('full')
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
    schemaVersion: 1, id: 'ward', name: 'Synthetic ward', activation: { kind: 'reaction' }, target: { kind: 'self' },
    legacySource: { kind: 'feature', id: 'ward' }, automation,
    invocation: { kind: 'triggered', event: 'before-damage', confirmation: 'actor-choice' },
    requirements: [{ kind: 'damage-type', damageTypes: ['fire'] }],
    consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }],
    effects: [{ schemaVersion: 1, id: 'defense', name: 'Defense', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
      modifiers: [{ kind: 'damage-resistance', damageType: 'fire' }] },
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
    const state = startDnd5eHeadlessCombat('stored', [actor('attacker', 20), actor('bearer', 10)])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'bearer')]: 5 }
    state.combatants.bearer.pluginFeatureIds = [packageId + ':ward']
    if (use === 'save') Object.assign(state.combatants.attacker, { controller: 'dm', classId: 'wizard', classLevels: { wizard: 5 }, level: 5,
      classSelections: { 'spell-prepared': ['fireball'] }, classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } } })
    if (use.startsWith('monster-')) Object.assign(state.combatants.attacker, { controller: 'dm', statBlockId: 'srd-5.1:mage',
      classState: { monsterSpellSlots: { '3': { current: 1, max: 1 } } } })
    if (use === 'periodic') state.combatants.bearer.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'burning', definitionId: 'test:burning', label: 'Burning', targetId: 'bearer',
      source: { kind: 'spell', actorId: 'attacker', spellLevel: 3 },
      periodicDamage: { timing: 'source-turn-start', count: 1, sides: 6, type: 'fire' },
    })]
    const original = structuredClone(state)
    const incoming = await resolveDnd5eActionWithDamageReactions({ state, combatRevision: 1, authorityUnchanged: () => true,
      confirm: async () => ({ accepted: true }), roll: async () => { throw Error('No initial dice') },
      action: use === 'periodic' ? {type:'begin-turn',actorId:'attacker',turnSlotId:'attacker',
        turnStartActiveEffectPeriodicDamageRolls:[{effectId:'burning',targetId:'bearer',rolls:[6]}]}
      : use.startsWith('monster-') ? {type:'monster-core-spell',actorId:'attacker',spellId:use==='monster-save'?'fireball':'fire-bolt',slotLevel:use==='monster-save'?3:0,
        resolution:{schemaVersion:1,targetIds:['bearer'], ...(use==='monster-save'?{targetSavingThrows:[{targetId:'bearer',d20:1}]}:{d20:15,d20Second:15}),effectRolls:[use==='monster-save'?Array(8).fill(1):[3,3]]}}
      : use === 'save' ? { type: 'cast-spell', actorId: 'attacker', targetId: 'bearer', targetIds: ['bearer'], spellId: 'fireball', slotLevel: 3,
        castingClassId: 'wizard', savingThrowD20: 1, effectRolls: Array(8).fill(1) } : { type: 'attack', actorId: 'attacker', targetId: 'bearer', d20: 15, attackModifier: 3,
        damage: { count: 1, sides: 6, rolls: [6], bonus: 0, type: 'fire' } } })
    expect(incoming.ok, incoming.ok ? undefined : incoming.reason).toBe(true)
    expect(incoming.state.combatants.bearer.currentHp).toBe(use === 'save' || use === 'monster-save' ? 26 : 27)
    expect(incoming.state.combatants.bearer.classState.activeEffects?.find(effect => effect.grantedActivities)?.suspendedBy?.length).toBe(1)
    const next = resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(incoming.state)), { type: 'end-turn', actorId: 'attacker' })
    expect(next.ok).toBe(true)
    expect(next.state.combatants.bearer.classState.activeEffects?.find(effect => effect.grantedActivities)?.suspendedBy?.length ?? 0).toBe(0)
    let settled = next.state
    if (use !== 'expire') {
      settled.combatants.attacker.concentrating = true
      settled.combatants.attacker.controller = 'dm'
      Object.assign(settled.combatants.bearer, { classId: 'wizard', classLevels: { wizard: 1 }, level: 1,
        classSelections: { 'spell-cantrips': ['shocking-grasp'] } })
      settled.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('bearer', 'attacker')]: 5 }
      const attack = await resolveDnd5eActionWithDamageReactions({ state: settled, combatRevision: 2, authorityUnchanged: () => true,
        confirm: async () => { throw Error('Automatic') }, roll: async () => { throw Error('Constant') },
        action: use === 'spell' ? { type: 'cast-spell', actorId: 'bearer', targetId: 'attacker', spellId: 'shocking-grasp', slotLevel: 0,
          castingClassId: 'wizard', d20: 15, effectRolls: [2] } : { type: 'attack', actorId: 'bearer', targetId: 'attacker',
          d20: 15, attackModifier: 3, damage: { count: 1, sides: 6, rolls: [2], bonus: 0, type: 'bludgeoning' } } })
      expect(attack.ok).toBe(true)
      expect(attack.state.combatants.attacker.currentHp).toBe(25)
      expect(attack.events.filter(event => event.type === 'concentration-check-required')).toHaveLength(1)
      expect(attack.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
      const hit = await settleDnd5eActivityTriggerWindowsV1({ state: attack.state, events: attack.events, eventBatchId: 'hit', combatRevision: 2,
        confirm: async () => { throw Error('Automatic') }, roll: async () => { throw Error('Constant') } })
      expect(hit.state.combatants.attacker.currentHp).toBe(25)
      expect(hit.events).toEqual([])
      settled = hit.state
    }
    const end = resolveDnd5eHeadlessAction(settled, { type: 'end-turn', actorId: 'bearer', ...(use === 'periodic' ? {turnStartActiveEffectPeriodicDamageRolls:[{effectId:'burning',targetId:'bearer',rolls:[6]}]} : {}) })
    expect(end.ok).toBe(true)
    expect(end.state.combatants.bearer.classState.activeEffects?.some(effect => effect.grantedActivities) ?? false).toBe(false)
    expect(state).toEqual(original)
  } finally { registration.dispose() }
})
