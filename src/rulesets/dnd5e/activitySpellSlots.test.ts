import { expect, it } from 'vitest'
import { dnd5eActivitySpellSlotLevels, dnd5eActivitySpellSlotResource } from './activitySpellSlots'
import { commitDnd5eActivityExecution, createDnd5eCombatant, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

const caster = () => createDnd5eCombatant({ id: 'caster', name: 'Caster', controller: 'player', initiative: 20,
  classId: 'warlock', level: 3, classLevels: { warlock: 3 }, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
  proficiencyBonus: 2, armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 },
  concentrating: false, classResources: { 'dnd5e-pact-slot': { current: 2, max: 2 } } })

it('offers only real standard or matching pact levels and respects multiclass levels', () => {
  const actor = caster()
  actor.level = 15 // Total level must not upgrade the level-three pact class.
  expect(dnd5eActivitySpellSlotLevels(actor, 1)).toEqual([2])
  expect(dnd5eActivitySpellSlotLevels(actor, 3)).toEqual([])
  actor.classResources['dnd5e-spell-slot-2'] = { current: 1, max: 1 }
  actor.classResources['dnd5e-spell-slot-4'] = { current: 1, max: 1 }
  expect(dnd5eActivitySpellSlotLevels(actor, 1)).toEqual([2, 4])
  expect(dnd5eActivitySpellSlotResource(actor, 2, 1)).toBe('dnd5e-spell-slot-2')
  actor.classResources['dnd5e-spell-slot-2'].current = 0
  expect(dnd5eActivitySpellSlotResource(actor, 2, 1)).toBe('dnd5e-pact-slot')
  for (const level of [0, 1, 3, 9, 10, 2.5, NaN]) expect(dnd5eActivitySpellSlotResource(actor, level, 1)).toBeUndefined()
  actor.classLevels = { warlock: 0 }
  expect(dnd5eActivitySpellSlotResource(actor, 2, 1)).toBeUndefined()
})

it.each([1, 2, 3, 9])('validates selected level %s again at the authoritative Activity commit', level => {
  const actor = caster()
  const other = createDnd5eCombatant({ ...actor, id: 'other', initiative: 0 })
  const state = startDnd5eHeadlessCombat('slot-authority', [actor, other])
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'ward', name: 'Ward', activation: { kind: 'action' },
    target: { kind: 'self' }, consumption: [{ kind: 'spell-slot', minimumLevel: 1, level: 'selected', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'ward', when: { kind: 'always' }, operations: [{ id: 'ward', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 3 } }] }],
    automation: automationCapabilityFromLegacyStatus('full') }
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(actor)
  const resolution = resolveDnd5eActivity({ activity, actor: snapshot, targets: [snapshot], castLevel: level, rolls: {} })
  const before = structuredClone(state)
  const result = commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: activity.id, targetIds: [actor.id], castLevel: level,
    resolution, source: { kind: 'spell', id: 'ward', packageId: 'test.slots' } })
  expect(result.ok).toBe(level === 2)
  expect(state).toEqual(before)
  if (result.ok) {
    expect(result.state.combatants.caster.classResources['dnd5e-pact-slot'].current).toBe(1)
    expect(result.state.combatants.caster.temporaryHp).toBe(3)
  }
})
