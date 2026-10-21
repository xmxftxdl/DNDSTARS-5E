import { expect, it } from 'vitest'
import { additionalCombatLogDetails } from '../../../lib/combatLogAdditionalEvents'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution } from '../headlessCombatEngine'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'question', name: 'Question', activation: { kind: 'free' },
  target: { kind: 'creature', relation: 'any', count: 2 }, automation: automationCapabilityFromLegacyStatus('full'),
  outcomes: [{ id: 'question', when: { kind: 'always' }, operations: [{ id: 'question', kind: 'narrative-prompt', prompt: 'DM：按已知信息回答问题。' }] }],
}

it('records one literal prompt for a multi-target activity without DM approval or action expenditure', () => {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const state = startDnd5eHeadlessCombat('narrative', [make('other', 20), make('actor', 10), make('target', 5)])
  const before = structuredClone(state)
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const resolution = resolveDnd5eActivity({ activity, actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor),
    targets: ['other', 'target'].map(id => dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[id])), rolls: {} })
  expect(resolution.ok, JSON.stringify(resolution)).toBe(true)
  if (!resolution.ok) throw Error('resolution failed')
  expect(resolution.status).toBe('resolved')
  const committed = commitDnd5eActivityExecution(state, { actorId: 'actor', activityId: activity.id,
    targetIds: ['other', 'target'], resolution, source: { kind: 'feature', id: 'question' } })
  expect(committed.ok, JSON.stringify(committed)).toBe(true)
  const prompts = committed.events.filter(event => event.type === 'activity-narrative-prompt')
  expect(prompts).toHaveLength(1)
  expect(additionalCombatLogDetails(prompts[0], id => id)).toEqual(['actor｜DM：按已知信息回答问题。'])
  expect(committed.state.combatants.actor.turn).toEqual(before.combatants.actor.turn)
  expect(state).toEqual(before)
})

it.each(['', ' ', 'a'.repeat(2001), null])('rejects an invalid narrative prompt (%j)', prompt => {
  const bad = structuredClone(activity)
  bad.outcomes[0].operations = [{ id: 'question', kind: 'narrative-prompt', prompt: prompt as string }]
  expect(validateDnd5eActivityDefinitionV1(bad).some(issue => issue.includes('prompt'))).toBe(true)
})
