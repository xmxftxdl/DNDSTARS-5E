import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction, resolveDnd5ePersistentAreaTrigger } from './headlessCombatEngine'
import { dnd5eActiveOptionalBonusDice, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'
import { normalizeCharacter } from '../../store/characters'

const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
  abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 10 }, proficiencyBonus: 2, armorClass: 12,
  currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })

it.each(['ability-check', 'saving-throw'] as const)('retains an imported optional d4 after valid %s uses and expires after24hours', rollKind => {
  const actor = make('cleric', 10), target = make('target', 20)
  const state = startDnd5eHeadlessCombat('retained-bonus', [actor, target])
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'rite', name: 'Rite', activation: { kind: 'free' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 10 }, automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'rite-bonus', name: 'Rite bonus', duration: { kind: 'rounds', rounds: 14400, expiresAt: 'source-turn-end' }, stacking: 'replace',
      modifiers: [{ kind: 'optional-bonus-die', sides: 4, appliesTo: [rollKind], consumeOnUse: false }] }],
    outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'grant', kind: 'apply-effect', target: 'target', effectId: 'rite-bonus' }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const resolution = resolveDnd5eActivity({ activity, actor: dnd5eActivityActorSnapshotFromCombatantV1(actor, actor, state),
    targets: [dnd5eActivityActorSnapshotFromCombatantV1(target, actor, state)], rolls: {}, distanceFeetByTargetId: { target: 0 } })
  expect(resolution.ok, JSON.stringify(resolution)).toBe(true)
  if (!resolution.ok) throw Error('compile failed')
  const committed = commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: activity.id, targetIds: [target.id], resolution,
    source: { kind: 'spell', id: 'ceremony', packageId: 'test.rites' } })
  expect(committed.ok).toBe(true)
  if (!committed.ok) throw Error('commit failed')
  let current = committed.state
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(current.combatants.target.classState.activeEffects)))
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
  current.combatants.target.classState.activeEffects = effects
  const effect = dnd5eActiveOptionalBonusDice(effects, rollKind)[0]
  expect(effect.modifiers?.optionalBonusDie?.consumeOnUse).toBe(false)
  for (const die of [3, 4]) {
    const optionalBonusDice = [{ effectId: effect.id, targetId: target.id, rollKind, roll: die }]
    const checked = rollKind === 'ability-check' ? resolveDnd5eHeadlessAction(current,
      { type: 'ability-check', actorId: target.id, ability: 'dex', d20: 10, dc: 15, optionalBonusDice }) : resolveDnd5ePersistentAreaTrigger(current, {
      areaId: 'test-area', sourceId: actor.id, targetId: target.id, d20: 10, damageRolls: [6], optionalBonusDice,
      trigger: { id: 'test-save', label: 'Test save', timing: 'turn-end', savingThrow: { ability: 'dex', dc: 15, onSuccess: 'half' }, damage: { count: 1, sides: 6, type: 'fire' } },
    })
    expect(checked.ok, JSON.stringify(checked)).toBe(true)
    if (!checked.ok) throw Error('roll failed')
    expect(checked.events).toContainEqual(expect.objectContaining({ type: 'optional-bonus-die-used', effectId: effect.id, roll: die }))
    expect(checked.events).not.toContainEqual(expect.objectContaining({ type: 'active-effect-removed', effectId: effect.id }))
    expect(dnd5eActiveOptionalBonusDice(checked.state.combatants.target.classState.activeEffects, rollKind)).toHaveLength(1)
    current = checked.state
  }
  const original = structuredClone(current)
  const invalid = resolveDnd5eHeadlessAction(current, { type: 'ability-check', actorId: target.id, ability: 'dex', d20: 10, dc: 15,
    optionalBonusDice: [{ effectId: effect.id, targetId: target.id, rollKind: 'ability-check', roll: 5 }] })
  expect(invalid.ok).toBe(false); expect(current).toEqual(original)
  const character = normalizeCharacter({ id: target.id, name: 'Target', maxHp: 20, currentHp: 20, dnd5eCombatState: { schemaVersion: 2, activeEffects: current.combatants.target.classState.activeEffects } } as any)
  const beforeExpiry = advanceDnd5eCampaignTimedActiveEffects(character, 1439)
  expect(dnd5eActiveOptionalBonusDice(beforeExpiry.dnd5eCombatState?.activeEffects, rollKind)).toHaveLength(1)
  const expired = advanceDnd5eCampaignTimedActiveEffects(beforeExpiry, 1)
  expect(dnd5eActiveOptionalBonusDice(expired.dnd5eCombatState?.activeEffects, rollKind)).toHaveLength(0)
})
