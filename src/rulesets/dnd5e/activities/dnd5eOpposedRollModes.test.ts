import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { prepareDnd5eLocalContentJson } from '../localContentCollection'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from '../contentPackageV2'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { rollDnd5eActivityTriggerDiceV1 } from './dnd5eActivityTriggerSettlement'
import { dnd5eActivityPerTargetRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityCheckV1 } from './dnd5eActivityContracts'

it.each([
  { declared: 'advantage', exhaustion: 1, skillAdv: false, skillDis: false, expected: 'normal' },
  { declared: 'advantage', exhaustion: 0, skillAdv: true, skillDis: true, expected: 'normal' },
  { declared: 'normal', exhaustion: 0, skillAdv: true, skillDis: false, expected: 'advantage' },
  { declared: 'normal', exhaustion: 0, skillAdv: false, skillDis: true, expected: 'disadvantage' },
  { declared: 'host-derived', size: 'disadvantage', exhaustion: 0, skillAdv: true, skillDis: false, expected: 'normal' },
  { declared: 'advantage', size: 'disadvantage', exhaustion: 1, skillAdv: true, skillDis: false, expected: 'normal' },
] as const)('combines opposed flags once: %j', async scenario => {
  const check: Extract<Dnd5eActivityCheckV1, { kind: 'opposed-ability-check' }> = {
    id: 'contest', kind: 'opposed-ability-check', rollId: 'source', opposedRollId: 'defense', scope: 'per-target',
    sourceAbility: 'cha', sourceModifier: { kind: 'reference', reference: { kind: 'actor-skill-check-modifier', skill: 'persuasion' } },
    sourceRollMode: scenario.declared, targetRollMode: 'normal', targetOptions: [{ ability: 'wis' }],
    ...(scenario.size ? { sourceRollModeByTargetSizeRank: { minimum: 0, mode: scenario.size } } : {}),
  }
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'contest', name: 'Synthetic contest', activation: { kind: 'free' },
    target: { kind: 'creature', relation: 'any', count: 1 }, legacySource: { kind: 'feature', id: 'contest' },
    automation: automationCapabilityFromLegacyStatus('full'), checks: [check],
    outcomes: [{ id: 'result', when: { kind: 'always' }, operations: [{ id: 'hit', kind: 'damage', target: 'target', damageType: 'force', amount: { kind: 'constant', value: 1 } }, { id: 'feedback', kind: 'narrative-prompt', prompt: 'Contest resolved.' }] }],
  }
  const prepared = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Synthetic opposed modes', version: '1.0.0',
    features: [{ id: 'contest', name: 'Synthetic contest', summary: 'Test', description: 'Synthetic', automation: 'full' }], activities: [activity] }))
  const pkg = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(prepared.package)).buffer)!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const actor = make('actor', 20), target = make('target', 10)
    actor.pluginFeatureIds = [`${pkg.manifest.id}:contest`]
    actor.exhaustionLevel = scenario.exhaustion
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'skill-flags', label: 'Skill flags', targetId: 'actor',
      source: { kind: 'feature', actorId: 'actor' }, duration: { type: 'permanent' },
      modifiers: { skillCheckAdvantages: scenario.skillAdv ? ['persuasion'] : [], skillCheckDisadvantages: scenario.skillDis ? ['persuasion'] : [] } })]
    const state = startDnd5eHeadlessCombat('opposed-modes', [actor, target])
    const count = scenario.expected === 'normal' ? 1 : 2
    const values = count === 1 ? [7] : [3, 17]
    const d20 = scenario.expected === 'advantage' ? 17 : scenario.expected === 'disadvantage' ? 3 : 7
    const rolls = { 'source:target': { values, modifier: 0, total: values.reduce((sum, value) => sum + value, 0) }, 'defense:target': { values: [5], modifier: 0, total: 5 } }
    const result = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: pkg.manifest.id, actionId: 'contest',
      featureId: actor.pluginFeatureIds[0], actorId: 'actor', targetId: 'target', rolls })
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'activity-narrative-prompt', actorId: 'actor', activityId: 'contest', prompt: 'Contest resolved.' }))
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'opposed-ability-check-resolved', sourceD20: d20 }))
    const command = { schemaVersion: 1 as const, commandId: 'contest', actorId: 'actor', packageId: pkg.manifest.id,
      packageVersion: pkg.manifest.version, activityId: 'contest', targetIds: ['target'], expectedRevision: 1 }
    const publicResult = resolveRegisteredDnd5eActivityInCombatV1({ state, command, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: rolls })
    expect(publicResult.result.ok).toBe(true)
    if (publicResult.phase !== 'commit' || !publicResult.result.ok) throw Error('Missing commit')
    expect(publicResult.result.events).toContainEqual(expect.objectContaining({ type: 'opposed-ability-check-resolved', sourceD20: d20 }))
    const declarations = dnd5eActivityPerTargetRollDeclarationsV1({ activity, actor, targets: [target], combatants: state.combatants,
      declarations: [{ id: 'source', label: 'Source', count: 2, sides: 20 }], hostSavingThrowMode: () => 'normal', hostAttackRollMode: () => 'normal' })
    expect(declarations[0]).toMatchObject({ count, d20RollMode: scenario.expected })
    const requests: number[] = []
    const triggered = await rollDnd5eActivityTriggerDiceV1({ state, actorId: 'actor', targetIds: ['target'],
      available: { packageId: pkg.manifest.id, packageVersion: pkg.manifest.version, activity, confirmation: 'automatic', retention: 'single-event' },
      triggerContext: { eventId: 'synthetic', event: 'attack-hit', source: { kind: 'attack', id: 'attack', activityId: 'attack', mode: 'melee', result: 'hit' }, eligibleActorIds: ['actor'], eligibleTargetIds: ['target'] },
      roll: async request => { requests.push(request.count); return request.id === 'source:target' ? values : [5] },
    })
    expect(requests).toEqual([count, 1])
    expect(triggered).toMatchObject({ checkRollModes: { 'contest:target:source-final': scenario.expected } })
  } finally { dispose() }
})
