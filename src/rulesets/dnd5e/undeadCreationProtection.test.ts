import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eActivityProtectsRemains, dnd5eUndeadCreationIsProtected } from './undeadCreationProtection'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'
import { normalizeCharacter } from '../../store/characters'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution } from './headlessCombatEngine'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

export function funeralWard(targetId = 'corpse') {
  return createDnd5eMechanicalEffect({ definitionId: 'funeral-ward', label: 'Funeral',
    source: { kind: 'spell', actorId: 'cleric', rulesId: 'ceremony', spellLevel: 1, magical: true }, targetId,
    duration: { type: 'rounds', remainingRounds: 100800, tickOn: 'source-turn-end' },
    undeadCreationProtection: { minimumPower: 'wish' } })
}

it('persists a ward and expires it exactly after seven campaign days', () => {
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([funeralWard()])))
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
  expect(dnd5eUndeadCreationIsProtected(effects)).toBe(true)
  const character = normalizeCharacter({ id: 'corpse', name: 'Corpse', currentHp: 0, maxHp: 20,
    dnd5eCombatState: { schemaVersion: 2, activeEffects: effects } })
  const before = advanceDnd5eCampaignTimedActiveEffects(character, 10079)
  expect(dnd5eUndeadCreationIsProtected(before.dnd5eCombatState?.activeEffects)).toBe(true)
  const after = advanceDnd5eCampaignTimedActiveEffects(before, 1)
  expect(dnd5eUndeadCreationIsProtected(after.dnd5eCombatState?.activeEffects)).toBe(false)
  expect(dnd5eUndeadCreationIsProtected(character.dnd5eCombatState?.activeEffects)).toBe(true)
})

it('suspension and expired rounds cease protection without deleting the record', () => {
  expect(dnd5eUndeadCreationIsProtected([{ ...funeralWard(), suspendedBy: ['antimagic'] }])).toBe(false)
  expect(dnd5eUndeadCreationIsProtected([{ ...funeralWard(), duration: { type: 'rounds', remainingRounds: 0, tickOn: 'source-turn-end' } }])).toBe(false)
})

it.each([{}, { minimumPower: '9th-level' }, { minimumPower: 'wish', spellName: 'Wish' }, [], 'wish'])('rejects invalid authored protection %j', invalid => {
  const raw = { ...funeralWard(), undeadCreationProtection: invalid }
  expect(validateDnd5eActiveEffectsStrict([raw]).ok).toBe(false)
  expect(normalizeDnd5eActiveEffects([raw])).toHaveLength(0)
})

it('compiles and commits a configured seven-day mechanical effect without dropping the ward', () => {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 }, proficiencyBonus: 2,
    armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const actor = make('cleric', 20), target = make('corpse', 10)
  target.currentHp = 0; target.deathSaves.dead = true
  const state = startDnd5eHeadlessCombat('funeral', [actor, target])
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'funeral', name: 'Funeral',
    activation: { kind: 'free' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 5 },
    automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'ward', name: 'Funeral protection', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 100800, expiresAt: 'source-turn-end' },
      undeadCreationProtection: { minimumPower: 'wish' } }],
    outcomes: [{ id: 'protect', when: { kind: 'always' }, operations: [{ id: 'protect', kind: 'apply-effect', effectId: 'ward', target: 'target' }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const selectedActivity = { ...activity, outcomes: [{ ...activity.outcomes[0],
    when: { kind: 'choice' as const, choiceId: 'rite', optionId: 'funeral' } }] }
  expect(dnd5eActivityProtectsRemains(selectedActivity, { rite: 'funeral' })).toBe(true)
  expect(dnd5eActivityProtectsRemains(selectedActivity, { rite: 'atonement' })).toBe(false)
  const actorSnapshot = dnd5eActivityActorSnapshotFromCombatantV1(actor, actor, state)
  const targetSnapshot = dnd5eActivityActorSnapshotFromCombatantV1(target, actor, state)
  const compile = (corpse?: { bodyPresent: boolean }) => resolveDnd5eActivity({ activity, actor: actorSnapshot,
    targets: [{ ...targetSnapshot, corpse }], rolls: {}, distanceFeetByTargetId: { corpse: 0 } })
  expect(compile().ok).toBe(false)
  expect(compile({ bodyPresent: false }).ok).toBe(false)
  const resolution = compile({ bodyPresent: true })
  expect(resolution.ok, JSON.stringify(resolution)).toBe(true)
  if (!resolution.ok) throw Error('Funeral effect compilation failed')
  const committed = commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: activity.id, targetIds: [target.id],
    resolution, source: { kind: 'spell', id: 'ceremony', packageId: 'test.funeral' } })
  expect(committed.ok, JSON.stringify(committed)).toBe(true)
  if (!committed.ok) throw Error('Funeral effect commit failed')
  expect(dnd5eUndeadCreationIsProtected(committed.state.combatants.corpse.classState.activeEffects)).toBe(true)
})
