import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

// Synthetic composition of public contracts, not a regenerated source package.
it.each(['hit', 'split', 'save', 'miss', 'short', 'curved', 'low-level', 'expired'] as const)(
  'connects committed movement to a later attack and recipient save: %s', async mode => {
  const packageId = 'test.movement-attack'
  const base = { schemaVersion: 1 as const, name: 'Synthetic movement chain', activation: { kind: 'free' as const },
    legacySource: { kind: 'feature' as const, id: 'charge' }, automation: automationCapabilityFromLegacyStatus('full') }
  const prepare: Dnd5eActivityDefinitionV1 = { ...base, id: 'prepare', target: { kind: 'self' },
    invocation: { kind: 'triggered', event: 'movement-completed', confirmation: 'automatic' },
    requirements: [{ kind: 'turn-owner', owner: 'actor' }, { kind: 'class-level', classId: 'fighter', minimum: 15 },
      { kind: 'movement-distance', basis: 'straight-streak', minimumFeet: 10 }, { kind: 'movement-property', straightLine: true, movementKind: 'voluntary' },
      { kind: 'active-effect', subject: 'actor', effectId: 'used', source: 'self', present: false }],
    effects: [{ schemaVersion: 1, id: 'ready', name: 'Ready', stacking: 'replace', grants: ['impact'], grantsSingleUse: true,
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' }, modifiers: [] }],
    outcomes: [{ id: 'ready', when: { kind: 'always' }, operations: [{ id: 'ready', kind: 'apply-effect', target: 'actor', effectId: 'ready' }] }] }
  const impact: Dnd5eActivityDefinitionV1 = { ...base, id: 'impact', requiresEffectGrant: true,
    target: { kind: 'creature', count: 1, relation: 'any' },
    invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'automatic' },
    requirements: [{ kind: 'turn-owner', owner: 'actor' }, { kind: 'class-level', classId: 'fighter', minimum: 15 },
      { kind: 'active-effect', subject: 'actor', effectId: 'used', source: 'self', present: false }],
    checks: [{ id: 'save', kind: 'saving-throw', rollId: 'save', ability: 'str', scope: 'per-target', rollMode: 'host-derived',
      dc: { kind: 'add', values: [{ kind: 'constant', value: 8 },
        { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: 'str' } }] } }],
    effects: [{ schemaVersion: 1, id: 'used', name: 'Used this turn', stacking: 'replace', modifiers: [],
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' } }],
    outcomes: [{ id: 'spent', when: { kind: 'always' }, operations: [{ id: 'used', kind: 'apply-effect', target: 'actor', effectId: 'used' }] },
      { id: 'fall', when: { kind: 'check', checkId: 'save', result: 'failure' }, operations: [
        { id: 'fall', kind: 'apply-standard-condition', target: 'target', condition: 'prone', duration: { kind: 'permanent' } }] }] }
  const cleanup: Dnd5eActivityDefinitionV1 = { ...base, id: 'cleanup', target: { kind: 'self' },
    invocation: { kind: 'triggered', event: 'turn-end', confirmation: 'automatic' },
    outcomes: [{ id: 'clear', when: { kind: 'always' }, operations: ['ready', 'used'].map(effectId => ({
      id: effectId, kind: 'remove-effect' as const, target: 'actor' as const, effectId, source: 'self' as const })) }] }
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [prepare, impact, cleanup] })
  try {
    const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
      abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 5,
      armorClass: 12, currentHp: 50, maxHp: 50, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      pluginFeatureIds: [`${packageId}:charge`], classLevels: { fighter: mode === 'low-level' ? 14 : 15 } })
    const target = createDnd5eCombatant({ ...actor, id: 'target', name: 'Target', controller: 'dm', initiative: 10,
      abilities: { ...actor.abilities, str: 10 }, pluginFeatureIds: [], position: { x: 100, y: 0 } })
    target.savingThrowBonuses.str = 0
    let state = startDnd5eHeadlessCombat('movement-chain', [actor, target])
    let saves = 0
    const settle = async (events: Parameters<typeof settleDnd5eActivityTriggerWindowsV1>[0]['events'], batch: string) => {
      const result = await settleDnd5eActivityTriggerWindowsV1({ state, events, eventBatchId: batch, combatRevision: 1,
        confirm: async () => true, roll: async request => {
          saves++
          expect(request.rollerTokenId).toBe('target')
          return [mode === 'save' ? 17 : 16]
        } })
      state = result.state
      return result
    }
    if (mode === 'split') {
      const first = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: actor.id,
        to: { x: 25, y: 0 }, distance: 5, straightLine: true })
      expect(first.ok).toBe(true)
      state = first.state
      await settle(first.events, 'first-five')
      state = JSON.parse(JSON.stringify(state))
      expect((state.combatants.actor.classState.activeEffects ?? []).some(effect => effect.grantedActivities?.includes('impact'))).toBe(false)
    }
    const distance = mode === 'short' || mode === 'split' ? 5 : 10
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: actor.id,
      to: { x: 50, y: 0 }, distance, straightLine: mode !== 'curved' })
    expect(moved.ok).toBe(true)
    state = moved.state
    await settle(moved.events, 'move')
    state = JSON.parse(JSON.stringify(state))
    if (mode === 'expired') {
      for (const id of ['actor', 'target']) {
        const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: id })
        expect(ended.ok).toBe(true)
        state = ended.state
        await settle(ended.events, `end-${id}`)
      }
    }
    const attacked = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: actor.id, targetId: target.id,
      attackModifier: 9, d20: mode === 'miss' ? 1 : 15,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] } })
    expect(attacked.ok).toBe(true)
    state = attacked.state
    const settled = await settle(attacked.events, 'hit')
    const eligible = mode === 'hit' || mode === 'split' || mode === 'save'
    expect(saves, JSON.stringify(settled.diagnostics)).toBe(eligible ? 1 : 0)
    expect(state.combatants.target.conditions.includes('prone')).toBe(mode === 'hit' || mode === 'split')
    const beforeReplay = JSON.parse(JSON.stringify(state))
    await settle(attacked.events, 'hit')
    expect(state.combatants).toEqual(beforeReplay.combatants)
    expect(saves).toBe(eligible ? 1 : 0)
    if (eligible) {
      const again = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: actor.id,
        to: { x: 100, y: 0 }, distance: 10, straightLine: true })
      expect(again.ok).toBe(true)
      state = again.state
      await settle(again.events, 'another-move')
      expect((state.combatants.actor.classState.activeEffects ?? []).some(effect => effect.grantedActivities?.includes('impact'))).toBe(false)
    }
  } finally { registration.dispose() }
})
