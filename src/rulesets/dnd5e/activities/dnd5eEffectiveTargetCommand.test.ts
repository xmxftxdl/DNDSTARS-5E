import { afterEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityTargetV1 } from './dnd5eActivityContracts'
import type { Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { resolveDnd5eActivityCommand } from './dnd5eActivityCommand'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eCombatantPairKey } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'

afterEach(clearDnd5eActivityRegistryForTests)
const actor: Dnd5eActivityActorSnapshot = { id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3,
  abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, armorClass: 12, conditions: [], currentHp: 20, maxHp: 20 }
const creature: Dnd5eActivityTargetV1 = { kind: 'creature', count: 1, relation: 'any' }
const area: Dnd5eActivityTargetV1 = { kind: 'area', origin: 'point', shape: 'sphere', radiusFeet: 10, placeRangeFeet: 60, relation: 'any' }

function setup(projection: 'choice' | 'default-choice' | 'slot', destination: Dnd5eActivityTargetV1) {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'mode', name: 'Synthetic mode', activation: { kind: 'action' },
    target: destination.kind === 'area' ? creature : area, automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'feature', id: 'mode' },
    ...(projection === 'slot' ? { castLevelTargetProfiles: [{ minimumCastLevel: 3, target: destination }] } : {
      choices: [{ id: 'shape', label: 'Shape', ...(projection === 'default-choice' ? { defaultOptionId: 'chosen' } : {}),
        options: [{ id: 'chosen', label: 'Chosen', targetOverride: destination }] }],
    }),
    outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [{ id: 'hp', kind: 'temporary-hit-points',
      target: 'all-targets', amount: { kind: 'constant', value: 3 } }] }],
  }
  registerDnd5eActivityPackage({ packageId: 'test.effective-target', packageVersion: '1.0.0', activities: [activity] })
  return (count: number, hostIds?: string[], placement = destination.kind === 'area') => {
    const targets = Array.from({ length: count }, (_, i) => ({ ...actor, id: `target-${i}` }))
    return resolveDnd5eActivityCommand({ actor, targets, authoritativeRolls: {}, currentRevision: 1,
      areaTargetIds: hostIds ?? targets.map(target => target.id), areaPlacementDistanceFeet: 10,
      command: { schemaVersion: 1, commandId: 'test', actorId: actor.id, packageId: 'test.effective-target', packageVersion: '1.0.0',
        activityId: 'mode', targetIds: targets.map(target => target.id), expectedRevision: 1, castLevel: 3,
        ...(projection === 'choice' ? { choices: { shape: 'chosen' } } : {}),
        ...(placement ? { areaPlacement: { x: 100, y: 100, radiusFeet: 10 } } : {}),
      } })
  }
}

it.each(['choice', 'default-choice', 'slot'] as const)('uses effective area geometry and refuses stale or forged members: %s', projection => {
  const run = setup(projection, area)
  expect(run(2).ok).toBe(true)
  expect(run(2, ['target-0'])).toMatchObject({ ok: false, reason: 'target-snapshot-mismatch' })
  expect(run(1, ['other'])).toMatchObject({ ok: false, reason: 'target-snapshot-mismatch' })
  expect(run(1, undefined, false)).toMatchObject({ ok: false, reason: 'invalid-command' })
})

it.each(['choice', 'default-choice', 'slot'] as const)('allows a creature variant without stale area placement: %s', projection => {
  const run = setup(projection, creature)
  expect(run(1).ok).toBe(true)
  expect(run(1, undefined, true)).toMatchObject({ ok: false, reason: 'invalid-command' })
  expect(run(2).ok).toBe(false)
})

it('allows an uncapped area variant above 256 only with a matching Host membership snapshot', () => {
  const run = setup('choice', area)
  expect(run(300).ok).toBe(true)
  expect(run(300, ['target-0']).ok).toBe(false)
})

it('does not relax declared caps when the transport has many Host targets', () => {
  const run = setup('slot', { ...area, kind: 'area', maximumTargets: 2 })
  expect(run(2).ok).toBe(true)
  expect(run(3).ok).toBe(false)
  expect(run(300).ok).toBe(false)
})

it.each(['choice', 'default-choice', 'slot'] as const)('permits only declared subsets of current Host area members: %s', projection => {
  const run = setup(projection, { ...area, kind: 'area', selection: 'choose-any', maximumTargets: 1 })
  expect(run(1, ['target-0', 'target-1']).ok).toBe(true)
  expect(run(0, ['target-0', 'target-1']).ok).toBe(true)
  expect(run(1, ['target-1'])).toMatchObject({ ok: false, reason: 'target-snapshot-mismatch' })
  expect(run(2, ['target-0', 'target-1']).ok).toBe(false)
})

it.each(['choice', 'slot'] as const)('derives pairwise distances for an effective creature target: %s', projection => {
  setup(projection, { kind: 'creature', relation: 'any', count: 2, maximumTargetSeparationFeet: 10 })
  const combatants = ['actor', 'first', 'second'].map((id, i) => createDnd5eCombatant({
    id, name: id, controller: 'player', initiative: 20 - i, abilities: actor.abilities, proficiencyBonus: 3,
    armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: i * 50, y: 0 },
    concentrating: false, pluginFeatureIds: i ? [] : ['mode'],
  }))
  const state = startDnd5eHeadlessCombat('pairwise', combatants)
  const run = () => resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
    command: { schemaVersion: 1, commandId: 'pairwise', actorId: 'actor', packageId: 'test.effective-target',
      packageVersion: '1.0.0', activityId: 'mode', targetIds: ['first', 'second'], expectedRevision: 1, castLevel: 3,
      ...(projection === 'choice' ? { choices: { shape: 'chosen' } } : {}) },
    authoritativeRolls: {}, confirmedBy: 'actor',
  })
  expect(run().result.ok).toBe(false)
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('first', 'second')]: 15 }
  expect(run().result.ok).toBe(false)
  state.distanceFeetByCombatantPair[dnd5eCombatantPairKey('first', 'second')] = 10
  const resolved = run()
  expect(resolved.result.ok, JSON.stringify(resolved)).toBe(true)
  if (resolved.phase === 'commit' && resolved.result.ok) {
    expect(resolved.result.state.combatants.first.temporaryHp).toBe(3)
    expect(resolved.result.state.combatants.second.temporaryHp).toBe(3)
  }
  expect(state.combatants.first.temporaryHp).toBe(0)
})
