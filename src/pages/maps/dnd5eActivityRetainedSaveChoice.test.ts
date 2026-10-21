import { expect, it, vi } from 'vitest'
import { collectDnd5eActivityRetainedSaveChoice } from './dnd5eActivityRetainedSaveChoice'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../../rulesets/dnd5e/headlessCombatEngine'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityCombatAuthority'
import { dnd5eActivityRetainedSaveDiceHooks, type Dnd5eActivityRetainedSaveDice } from '../../rulesets/dnd5e/activities/dnd5eActivityRetainedSaveDice'
import { previewDnd5eActivitySavingThrowV1, type Dnd5eActivityExecutionInput } from '../../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

it.each((['choose', 'cancel', 'low', 'other-source', 'consumable', 'invalid-choice'] as const)
  .flatMap(mode => (['normal', 'host-derived'] as const).map(rollMode => ({ mode, rollMode }))))(
  'collects owner choice for the exact Activity check: $mode / $rollMode', async ({ mode, rollMode }) => {
    const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const actor = make('actor'), target = make('target')
    target.classLevels = { ranger: mode === 'low' ? 6 : 7 }
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'prey', definitionId: 'test:prey', label: 'Prey', targetId: 'target', source: { kind: 'feature', actorId: 'target' },
      modifiers: { optionalBonusDie: { sides: 6, appliesTo: ['saving-throw'], consumeOnUse: mode === 'consumable',
        boundTargetSource: { classId: 'ranger', minimumLevel: 7 } },
      onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks',
        consumeEffectOnHit: false, oncePerTurn: true, doubleDiceOnCritical: true, boundTargetId: mode === 'other-source' ? 'other' : 'actor' } },
    })]
    const state = startDnd5eHeadlessCombat('ui-choice', [actor, target]), before = structuredClone(state)
    const execution: Dnd5eActivityExecutionInput = {
      actor: dnd5eActivityActorSnapshotFromCombatantV1(actor, actor, state),
      targets: [dnd5eActivityActorSnapshotFromCombatantV1(target, actor, state)], rolls: {},
      activity: { schemaVersion: 1, id: 'blast', name: 'Blast', activation: { kind: 'action' },
        automation: automationCapabilityFromLegacyStatus('full'), target: { kind: 'creature', count: 1, relation: 'any' },
        checks: [{ id: 'save', kind: 'saving-throw', rollId: 'save-d20', ability: 'dex',
          dc: { kind: 'constant', value: 15 }, scope: 'per-target', rollMode }], outcomes: [] },
    }
    const request = vi.fn(async () => mode === 'cancel' ? undefined : {
      effectId: 'prey', targetId: 'target', rollKind: 'saving-throw' as const, roll: mode === 'invalid-choice' ? 7 : 6,
    })
    const selections: Record<string, Dnd5eActivityRetainedSaveDice[string]> = {}, prompted = new Set<string>()
    const input = { state, execution, declaration: { id: 'save-d20:target', label: 'Save', count: 1, sides: 20,
      rollerTokenId: 'target', d20RollKind: 'saving-throw' as const, d20RollMode: 'normal' as const }, values: [10], selections, prompted,
      characterForToken: () => undefined, request }
    if (mode === 'invalid-choice') {
      await expect(collectDnd5eActivityRetainedSaveChoice(input)).rejects.toThrow('invalid-activity-optional-save-choice')
      expect(selections).toEqual({})
      return
    }
    await collectDnd5eActivityRetainedSaveChoice(input)
    await collectDnd5eActivityRetainedSaveChoice(input)
    expect(request).toHaveBeenCalledTimes(mode === 'choose' || mode === 'cancel' ? 1 : 0)
    expect(selections).toEqual(mode === 'choose' ? { 'save:target': { effectId: 'prey', targetId: 'target', roll: 6 } } : {})
    const result = previewDnd5eActivitySavingThrowV1({ ...execution, ...dnd5eActivityRetainedSaveDiceHooks(state, 'actor', selections),
      checkRollModes: { 'save:target': 'normal' },
      rolls: { 'save-d20:target': { values: [10] } } }, 'save-d20:target', 'target')
    expect(result?.success).toBe(mode === 'choose')
    expect(state).toEqual(before)
    if (mode === 'choose') {
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ checkKey: 'save:target' }))
      const secondExecution = { ...execution, activity: { ...execution.activity,
        checks: execution.activity.checks!.map(check => ({ ...check, id: 'second-save', rollId: 'second-d20' })) } }
      await collectDnd5eActivityRetainedSaveChoice({ ...input, execution: secondExecution,
        declaration: { ...input.declaration, id: 'second-d20:target' } })
      expect(request).toHaveBeenCalledTimes(2)
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ checkKey: 'second-save:target' }))
      expect(Object.keys(selections)).toEqual(['save:target', 'second-save:target'])
    }
  })
