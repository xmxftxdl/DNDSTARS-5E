import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant } from '../headlessCombatEngine'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'speed-branch', name: 'Synthetic speed branch', activation: { kind: 'free' },
  target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
  outcomes: [
    { id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target',
      amount: { kind: 'constant', value: 3 }, damageType: 'poison' }] },
    { id: 'move', when: { kind: 'predicate', predicate: { kind: 'speed', subject: 'target', comparison: 'above', value: 0 } },
      operations: [{ id: 'move', kind: 'move', target: 'target', mode: 'forced', cardinalDirection: 'east',
        distanceFeet: { kind: 'constant', value: 5 } }] },
  ], automation: automationCapabilityFromLegacyStatus('full'),
}
const combatant = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: 10,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
  armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })

it.each([undefined, NaN, Infinity, -1, 0, 1, 30])('uses known positive speed only, preserving other effects (%s)', speed => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const actor = dnd5eActivityActorSnapshotFromCombatantV1(combatant('actor'))
  const target = { ...dnd5eActivityActorSnapshotFromCombatantV1(combatant('target')), speed }
  const result = resolveDnd5eActivity({ activity: JSON.parse(JSON.stringify(activity)), actor, targets: [target],
    rolls: {}, distanceFeetByTargetId: { target: 5 } })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.proposals.filter(p => p.kind === 'deal-damage')).toHaveLength(1)
  expect(result.proposals.filter(p => p.kind === 'move')).toHaveLength(Number.isFinite(speed) && speed! > 0 ? 1 : 0)
})

it('projects restrained speed as zero without overwriting the base speed', () => {
  const target = combatant('target')
  target.conditions = ['restrained']
  expect(dnd5eActivityActorSnapshotFromCombatantV1(target).speed).toBe(0)
  expect(target.speed).toBe(30)
  target.conditions = []
  expect(dnd5eActivityActorSnapshotFromCombatantV1(target).speed).toBe(30)
})

it.each([{ subject: 'client' }, { comparison: 'equal-ish' }, { value: -1 }, { value: NaN }])('rejects invalid speed selectors %j', override => {
  const invalid = structuredClone(activity)
  const when = invalid.outcomes[1].when
  if (when.kind !== 'predicate') throw Error('Fixture must have a predicate')
  Object.assign(when.predicate, override)
  expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('speed selector'))).toBe(true)
})
