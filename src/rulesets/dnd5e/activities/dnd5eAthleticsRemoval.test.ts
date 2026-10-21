import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from '../activeEffects'
import { commitDnd5eActivityExecution, createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { dnd5eActivityActorSnapshotFromCombatantV1 as snapshot } from './dnd5eActivityCombatAuthority'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'synthetic-binding', name: 'Binding', activation: { kind: 'free' },
  target: { kind: 'creature', relation: 'any', count: 1 }, automation: automationCapabilityFromLegacyStatus('full'),
  effects: [{ schemaVersion: 1, id: 'binding', name: 'Binding', stacking: 'replace', duration: { kind: 'permanent' },
    removalAction: { label: 'Remove binding', economy: 'action', maxDistanceFeet: 5,
      abilityCheck: { ability: 'str', skill: 'athletics', dc: { kind: 'constant', value: 15 } } } }],
  outcomes: [{ id: 'bind', when: { kind: 'always' }, operations: [{ id: 'bind', kind: 'apply-effect', target: 'target', effectId: 'binding' }] }],
}

it.each(['self', 'helper'])('supports %s Athletics removal after persistence, with proficiency and action cost', role => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const d20 of [9, 10]) {
    const actorId = role === 'self' ? 'target' : 'helper'
    const state = startDnd5eHeadlessCombat('binding', ['caster', 'target', 'helper'].map(id => createDnd5eCombatant({
      id, name: id, controller: 'player', initiative: id === actorId ? 20 : 10,
      abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, skillProficiencies: ['athletics'],
      proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
      position: { x: 0, y: 0 }, concentrating: false,
    })))
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('helper', 'target')]: 5 }
    const resolution = resolveDnd5eActivity({ activity, actor: snapshot(state.combatants.caster), targets: [snapshot(state.combatants.target)], rolls: {} })
    const applied = commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: activity.id, targetIds: ['target'], resolution })
    expect(applied.ok).toBe(true)
    const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(applied.state.combatants.target.classState.activeEffects)))
    expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
    expect(effects[0].removal?.action?.abilityCheck).toEqual({ ability: 'str', skill: 'athletics', dc: 15 })
    applied.state.combatants.target.classState.activeEffects = effects
    const action = { type: 'remove-active-effect' as const, actorId, targetId: 'target', effectId: effects[0].id, d20 }
    const distant = structuredClone(applied.state)
    if (role === 'helper') {
      distant.distanceFeetByCombatantPair![dnd5eCombatantPairKey('helper', 'target')] = 10
      expect(resolveDnd5eHeadlessAction(distant, action)).toMatchObject({ ok: false, reason: 'invalid-target' })
    }
    const result = resolveDnd5eHeadlessAction(applied.state, action)
    expect(result.ok).toBe(true)
    expect(result.state.combatants[actorId].turn.actionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', ability: 'str', skill: 'athletics', dc: 15, success: d20 === 10 }))
    expect((result.state.combatants.target.classState.activeEffects ?? []).some(effect => effect.id === effects[0].id)).toBe(d20 !== 10)
    expect(resolveDnd5eHeadlessAction(result.state, action).ok).toBe(false)
  }
})
