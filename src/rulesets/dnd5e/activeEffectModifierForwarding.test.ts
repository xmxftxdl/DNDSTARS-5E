import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeDnd5eActiveEffects } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, dnd5eAbilityCheckRollMode } from './headlessCombatEngine'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

it.each(['climbingCheckAdvantage', 'poisonSavingThrowAdvantage'] as const)('preserves resolved %s through Host creation and persistence', key => {
  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
    abilities, proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false })
  const definition: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'effect', name: 'Effect', activation: { kind: 'free' },
    target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'effect', name: 'Effect', duration: { kind: 'permanent' }, stacking: 'replace' }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', effectId: 'effect', target: 'actor' }] }] }
  const snapshot = { id: actor.id, controller: 'players' as const, level: 1, proficiencyBonus: 2, abilities,
    armorClass: 10, currentHp: 20, maxHp: 20, conditions: [] }
  const resolution = resolveDnd5eActivity({ activity: definition, actor: snapshot, targets: [snapshot], rolls: {} })
  if (!resolution.ok) throw Error('Invalid fixture')
  const proposal = resolution.proposals.find(proposal => proposal.kind === 'apply-effect')
  if (!proposal || proposal.kind !== 'apply-effect') throw Error('Missing effect')
  // Trusted resolved-modifier fixture, not a claim that the public Effect DSL emits these legacy fields.
  proposal.modifierGroups = [{ [key]: true }]
  const other = createDnd5eCombatant({ ...actor, id: 'other', name: 'Other', initiative: 10, controller: 'dm' })
  const result = commitDnd5eActivityExecution(startDnd5eHeadlessCombat('forwarding', [actor, other]), {
    actorId: actor.id, activityId: 'effect', targetIds: [actor.id], resolution, source: { kind: 'item', id: 'test:item' } })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  const restored = result.state.combatants.actor
  restored.classState.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(restored.classState.activeEffects)))
  expect(restored.classState.activeEffects?.some(effect => effect.modifiers?.[key] === true)).toBe(true)
  expect(dnd5eAbilityCheckRollMode(restored, { ability: 'str', skill: 'athletics', context: 'climbing' }))
    .toBe(key === 'climbingCheckAdvantage' ? 'advantage' : 'normal')
  expect(dnd5eAbilityCheckRollMode(restored, { ability: 'str', skill: 'athletics' })).toBe('normal')
  expect(dnd5eSavingThrowMode(restored, 'con', { damageType: 'poison' }))
    .toBe(key === 'poisonSavingThrowAdvantage' ? 'advantage' : 'normal')
  expect(dnd5eSavingThrowMode(restored, 'con', { damageType: 'fire' })).toBe('normal')
})
