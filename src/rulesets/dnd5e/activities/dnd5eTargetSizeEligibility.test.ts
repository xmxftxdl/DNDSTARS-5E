import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { rollDnd5eActivityTriggerDiceV1 } from './dnd5eActivityTriggerSettlement'

it.each(['eligible', 'large', 'wrong-type', 'mixed', 'missing-target', 'missing-actor'] as const)('checks immutable target facts before any shared or save dice (%s)', async mode => {
  const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
    currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const actor = make('actor'), target = make('target')
  target.sizeRank = mode === 'large' ? 3 : 2
  target.creatureType = mode === 'wrong-type' ? 'undead' : 'humanoid'
  const large = make('large')
  large.sizeRank = 3
  large.creatureType = 'humanoid'
  const state = startDnd5eHeadlessCombat('target-check', [actor, target, large])
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'check', name: 'Check', activation: { kind: 'free' },
    automation: automationCapabilityFromLegacyStatus('full'), target: { kind: 'creature', relation: 'any', count: 2 },
    requirements: [{ kind: 'size-rank', subject: 'target', maximum: 2 }, { kind: 'creature-type', subject: 'target', types: ['humanoid'] }],
    checks: [{ id: 'save', kind: 'saving-throw', ability: 'str', rollId: 'save', scope: 'per-target', dc: { kind: 'constant', value: 12 } }],
    outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target', damageType: 'force',
      amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } }] }] }
  const requested: string[] = []
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const result = await rollDnd5eActivityTriggerDiceV1({ state, actorId: mode === 'missing-actor' ? 'absent' : actor.id,
    targetIds: mode === 'mixed' ? [target.id, large.id] : [mode === 'missing-target' ? 'absent' : target.id],
    available: { packageId: 'test.target-check', packageVersion: '1.0.0', activity, confirmation: 'automatic', retention: 'single-event' },
    triggerContext: { eventId: 'event', event: 'after-damage', source: { kind: 'combat', id: 'damage' }, eligibleActorIds: [actor.id], eligibleTargetIds: [target.id] },
    roll: async request => { requested.push(request.id); return [1] } })
  if (mode === 'eligible') {
    expect(result).not.toHaveProperty('unsupported')
    expect(requested).toEqual(['damage', 'save:target'])
  } else {
    expect(result).toHaveProperty('unsupported')
    expect(requested).toEqual([])
  }
})

it.each([0, 1, 2, 3, 4, 5, undefined])('enforces medium-or-smaller target eligibility using Host size %s', sizeRank => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'size-limited', name: 'Size limited',
    activation: { kind: 'action' }, automation: automationCapabilityFromLegacyStatus('full'),
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
    requirements: [{ kind: 'size-rank', subject: 'target', maximum: 2 }],
    outcomes: [{ id: 'push', when: { kind: 'always' }, operations: [{ id: 'push', kind: 'move', target: 'target', mode: 'push',
      distanceFeet: { kind: 'constant', value: 5 }, placement: 'host-automatic-maximum' }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const actor = { id: 'actor', controller: 'players' as const, level: 1, proficiencyBonus: 2,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, armorClass: 10, currentHp: 20, maxHp: 20, conditions: [] }
  const result = resolveDnd5eActivity({ activity, actor, targets: [{ ...actor, id: 'target', sizeRank }],
    distanceFeetByTargetId: { target: 5 }, rolls: {} })
  if (sizeRank != null && sizeRank <= 2) expect(result).toMatchObject({ ok: true, proposals: [expect.objectContaining({ kind: 'move', distanceFeet: 5 })] })
  else expect(result.ok).toBe(false)
})
