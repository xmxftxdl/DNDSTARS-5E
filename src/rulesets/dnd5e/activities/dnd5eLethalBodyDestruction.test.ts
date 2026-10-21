import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { normalizeDnd5eActiveEffects, createDnd5eMechanicalEffect } from '../activeEffects'
import { dnd5eActivityActorSnapshotFromCombatantV1 as snapshot } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const definition: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'lethal-test', name: 'Lethal test', activation: { kind: 'action' },
  target: { kind: 'creature', relation: 'any', count: 1 }, automation: automationCapabilityFromLegacyStatus('full'),
  outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{
    id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 12 },
    damageType: 'fire', magical: true, destroysBodyOnDeath: true,
  }] }],
}
const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
  armorClass: 10, currentHp: 5, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })

it.each(['dead', 'dying', 'immune', 'temporary-hp', 'already-dead'] as const)('destroys remains only for actual damage-caused death: %s', mode => {
  const actor = make('actor', 20), target = make('target', 10)
  if (mode === 'dying') target.usesDeathSaves = true
  if (mode === 'immune') target.damageImmunities = ['fire']
  if (mode === 'temporary-hp') target.temporaryHp = 20
  if (mode === 'already-dead') { target.currentHp = 0; target.deathSaves.dead = true }
  const state = startDnd5eHeadlessCombat('lethal', [actor, target])
  const resolution = resolveDnd5eActivity({ activity: definition, actor: snapshot(actor), targets: [snapshot(target)], rolls: {} })
  const result = commitDnd5eActivityExecution(state, { actorId: 'actor', activityId: definition.id, targetIds: ['target'], resolution })
  expect(result.ok).toBe(true)
  const after = result.state.combatants.target
  expect(after.classState.bodyPresent === false).toBe(mode === 'dead')
  if (mode === 'dying') { expect(after.currentHp).toBe(0); expect(after.deathSaves.dead).toBe(false) }
  if (mode === 'dead') expect(after.classState.vitalBodyPartsMissing).toBe(true)
  expect(state.combatants.target.classState.bodyPresent).not.toBe(false)
})

it('retains the consequence through saved repeat damage, but successful saves do not damage or destroy', () => {
  const actor = make('actor', 10), target = make('target', 20)
  const effect = createDnd5eMechanicalEffect({ id: 'burn', definitionId: 'burn', label: 'Burn', targetId: target.id,
    source: { kind: 'spell', actorId: actor.id }, repeatSave: { timing: 'target-turn-end', ability: 'dex', dc: 10,
      onSuccess: 'remove', damageOnFailure: { count: 1, sides: 8, type: 'fire', destroysBodyOnDeath: true } } })
  target.classState.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
  expect(target.classState.activeEffects[0].repeatSave?.damageOnFailure?.destroysBodyOnDeath).toBe(true)
  const state = startDnd5eHeadlessCombat('repeat-lethal', [target, actor])
  for (const d20 of [1, 20]) {
    const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: target.id,
      activeEffectSavingThrows: [{ effectId: effect.id, d20, damageRolls: [8] }] })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.target.classState.bodyPresent === false).toBe(d20 === 1)
    expect(result.state.combatants.target.currentHp).toBe(d20 === 1 ? 0 : 5)
  }
})

it('rejects non-boolean authoring flags', () => {
  const invalid = structuredClone(definition)
  Object.assign(invalid.outcomes[0].operations[0], { destroysBodyOnDeath: 'yes' })
  expect(validateDnd5eActivityDefinitionV1(invalid).join(' ')).toContain('destroysBodyOnDeath')
})
