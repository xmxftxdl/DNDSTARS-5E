import { listDnd5eWeaponHitActivities } from './activities/dnd5eWeaponHitDiscovery'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, type Dnd5eAction } from './headlessCombatEngine'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { resolveDnd5eActionWithDamageReactions, resolveDnd5ePreparedWithMaterialDamageReactions, type Dnd5eDamageReactionFlowOptions } from './damageReactionFlow'
import { listDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerWindows'

const scenarios = (['accept', 'decline', 'replace-base', 'shared-turn', 'stale-confirm', 'stale-roll', 'unload-confirm', 'unload-roll', 'unload-defender', 'invalid-dice'] as const)
  .flatMap(mode => [false, true].flatMap(prepared => [1, 2].map(uses => ({ mode, prepared, uses }))))

it.each(scenarios)('keeps the full hit transaction atomic: %j', async ({ mode, prepared, uses }) => {
  const bonus = (id: string): Dnd5eActivityDefinitionV1 => ({ schemaVersion: 1, id, name: id,
    activation: { kind: 'free' }, invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice' },
    target: { kind: 'creature', count: 1, relation: 'enemy' }, legacySource: { kind: 'feature', id },
    automation: automationCapabilityFromLegacyStatus('full'),
    requirements: [{ kind: 'once-per-turn', key: mode === 'shared-turn' ? 'shared-hit' : id }],
    consumption: [{ kind: 'resource', resourceId: 'focus', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
    outcomes: [{ id, when: { kind: 'always' }, operations: [{ id, kind: 'damage', target: 'target',
      amount: { kind: 'constant', value: 0 }, damageType: 'inherit-primary', critical: 'double-dice',
      weaponDiceFromTrigger: { rollId: 'extra', count: 1 } }] }],
  })
  const registration = registerDnd5eActivityPackage({ packageId: 'test.hit-flow', packageVersion: '1.0.0', activities: [bonus('first'), bonus('second'), {
    schemaVersion: 1, id: 'ward', name: 'ward', activation: { kind: 'reaction' },
    invocation: { kind: 'triggered', event: 'before-damage', confirmation: 'actor-choice' }, target: { kind: 'self' },
    legacySource: { kind: 'feature', id: 'ward' }, automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'resource', resourceId: 'ward', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
    outcomes: [{ id: 'ward', when: { kind: 'always' }, operations: [{ id: 'ward', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 2 } }] }],
  }] })
  try {
    const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: id === 'actor' ? 'player' : 'dm',
      initiative: id === 'actor' ? 20 : 10, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
      concentrating: false, position: { x: 0, y: 0 }, classResources: { focus: { current: uses, max: 2 }, ward: { current: 1, max: 1 } } })
    const actor = make('actor'), target = make('target')
    actor.pluginFeatureIds = ['first', 'second']; target.pluginFeatureIds = ['ward']
    if (mode === 'replace-base') actor.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'test:replacement', label: 'Synthetic replacement', targetId: actor.id,
      source: { kind: 'feature', actorId: actor.id }, modifiers: { weaponDamageReplacementAttackModes: ['melee'] },
    })]
    const state = startDnd5eHeadlessCombat('hit-flow', [actor, target]), before = structuredClone(state)
    const action: Dnd5eAction = { type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 5, d20: 18,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' },
      classDamageContext: { mode: 'melee', weaponId: 'sword', weaponDamageSides: 6, finesse: false,
        strengthBased: true, damageType: 'slashing', adjacentEnemyOfTarget: false } }
    const prompts: string[] = [], rolls: string[] = []
    let current = true
    const options: Dnd5eDamageReactionFlowOptions = { combatRevision: 1,
      authorityUnchanged: () => current,
      confirm: async request => {
        prompts.push(request.activity.id)
        expect(state).toEqual(before)
        expect(request.actorId).toBe(request.activity.id === 'ward' ? 'target' : 'actor')
        if (mode === 'stale-confirm') current = false
        if (mode === 'unload-confirm' || (mode === 'unload-defender' && request.activity.id === 'ward')) registration.dispose()
        return { accepted: mode !== 'decline' || request.activity.id === 'ward' }
      },
      roll: async request => {
        rolls.push(request.id)
        expect(request).toMatchObject({ count: 1, sides: 6, rollerTokenId: 'actor' })
        if (mode === 'stale-roll') current = false
        if (mode === 'unload-roll') registration.dispose()
        return [mode === 'invalid-dice' ? 7 : 3]
      },
    }
    let applicationBuilds = 0
    const pending = prepared
      ? resolveDnd5ePreparedWithMaterialDamageReactions(options, { prepared: { state }, action }, input => {
        const result = resolveDnd5eHeadlessAction(input.prepared.state, input.action)
        // A facade must only construct its application after both windows finish.
        applicationBuilds++
        return { result }
      }).then(value => value.result)
      : resolveDnd5eActionWithDamageReactions({ ...options, state, action })
    if (mode !== 'accept' && mode !== 'decline' && mode !== 'replace-base' && mode !== 'shared-turn') {
      await expect(pending).rejects.toThrow(mode.startsWith('stale') ? 'damage-reaction-stale-authority'
        : mode.startsWith('unload') ? 'weapon-hit-activity-changed' : 'invalid-rolls')
      expect(state).toEqual(before)
      expect(applicationBuilds).toBe(0)
      // Cancellation must release scoped listeners: a new ordinary attack cannot pause.
      const ordinary = resolveDnd5eHeadlessAction(state, action)
      expect(ordinary.ok).toBe(true)
      expect(ordinary.state.combatants.target.currentHp).toBe(17)
      expect(ordinary.state.combatants.actor.classResources.focus.current).toBe(uses)
      return
    }
    const result = await pending
    expect(applicationBuilds).toBe(prepared ? 1 : 0)
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    const acceptedUses = mode === 'decline' ? 0 : mode === 'shared-turn' ? 1 : uses
    expect(prompts).toEqual(mode === 'decline' ? ['first', 'second', 'ward'] : acceptedUses === 2 ? ['first', 'second', 'ward'] : ['first', 'ward'])
    expect(rolls).toHaveLength(acceptedUses)
    expect(result.state.combatants.target.currentHp).toBe(20 - ((mode === 'replace-base' ? 0 : 3) + 3 * acceptedUses - 2))
    expect(result.state.combatants.actor.classResources.focus.current).toBe(uses - acceptedUses)
    expect(result.state.combatants.target.classResources.ward.current).toBe(0)
    expect(result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
    const restored = JSON.parse(JSON.stringify(result))
    expect(listDnd5eActivityTriggerWindowsV1({ state: restored.state, events: restored.events, eventBatchId: 'post' })
      .flatMap(window => window.available).filter(entry => ['first', 'second'].includes(entry.activity.id))).toEqual([])
    const usage = result.state.combatants.actor.classState.declarativeUsedTurnKeys ?? {}
    expect(Object.keys(usage)).toHaveLength(acceptedUses)
    const event = result.events.find(event => event.type === 'attack-resolved')!
    if (event.type !== 'attack-resolved') throw Error('missing hit')
    // A new hit has no receipt; the persistent turn record must prevent reuse.
    const nextHit = { ...event, handledHitActivities: undefined }
    const fresh = structuredClone(result.state)
    fresh.combatants.actor.classResources.focus.current = 2
    if (mode === 'shared-turn' || mode === 'decline') {
      expect(listDnd5eWeaponHitActivities({ state: fresh, event: nextHit, eventBatchId: 'new-hit', combatRevision: 2 }))
        .toHaveLength(mode === 'decline' ? 2 : 0)
      fresh.initiativeIndex = 1
      expect(listDnd5eWeaponHitActivities({ state: fresh, event: nextHit, eventBatchId: 'other-turn', combatRevision: 3 })).toHaveLength(2)
    }
    expect(state).toEqual(before)
  } finally { registration.dispose() }
})
