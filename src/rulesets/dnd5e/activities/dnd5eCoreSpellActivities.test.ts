import { afterEach, describe, expect, it } from 'vitest'
import {
  clearContentDefinitionRegistryForTests,
  getRegisteredContentDefinition,
  listRegisteredContentDefinitionPackages,
} from '../../../domain/content/contentDefinitionRegistry'
import { DND5E_SRD_COMBAT_SPELLS } from '../spells'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import {
  compileDnd5eActivityHeadlessAction,
  dnd5eActivityManualAdjudicationOperationsV1,
} from './dnd5eActivityHeadlessCompiler'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { dnd5ePluginFeatureDefinition, dnd5ePluginSpellDefinition } from '../plugins/pluginContentCatalog'
import {
  dnd5ePluginSpellAutomationSupported,
  dnd5ePluginSpellHasFullHeadlessAutomation,
  dnd5ePluginSpellActivity,
} from '../pluginSpellTransaction'
import {
  DND5E_SRD_AUDITED_FULL_SPELL_IDS,
  DND5E_SRD_AUDITED_MANUAL_SPELL_IDS,
  DND5E_SRD_AUDITED_PARTIAL_SPELL_IDS,
  dnd5eConjureCelestialChoicesAtSlotV1,
  dnd5eConjureElementalChoicesAtSlotV1,
  dnd5eConjureFeyChoicesAtSlotV1,
  dnd5eConjureMinorElementalChoicesForFormationV1,
  dnd5eConjureWoodlandBeingChoicesForFormationV1,
  dnd5eSrdAuditedSpellActivityV1,
} from './dnd5eSrdAuditedSpellActivities'
import { scaleDnd5eActivityDefinitionV1 } from './dnd5eActivityScaling'
import {
  DND5E_CORE_SPELL_PACKAGE_ID,
  DND5E_CORE_SPELL_PACKAGE_VERSION,
  dnd5eCoreSpellActivityV1,
  ensureDnd5eCoreSpellActivitiesRegisteredV1,
  getDnd5eCoreSpellRuntimeDefinitionV1,
} from './dnd5eCoreSpellActivities'
import {
  commitDnd5eActivityExecution,
  createDnd5eCombatant,
  endDnd5eConcentration,
  resolveDnd5eHeadlessAction,
  resolveDnd5ePersistentAreaTrigger,
  startDnd5eHeadlessCombat,
} from '../headlessCombatEngine'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { dnd5ePluginSpellTargetCapacity } from '../pluginSpellTargeting'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'

afterEach(clearContentDefinitionRegistryForTests)

describe('built-in spell Unified Activity migration', () => {
  it('bootstraps built-in trigger activities in a fresh map authority tab', () => {
    const caster = createDnd5eCombatant({ concentrating: false,
      id: 'cold-map-caster', name: 'Wizard', controller: 'player', initiative: 20,
      abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
      proficiencyBonus: 6, armorClass: 12, currentHp: 40, maxHp: 40,
      temporaryHp: 0, speed: 30, position: { x: 0, y: 0 },
    })
    listDnd5eActivityTriggerWindowsV1({
      state: startDnd5eHeadlessCombat('cold-map-trigger-registry', [caster]),
      events: [], eventBatchId: 'cold-map-load',
    })
    expect(getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'contingency',
    )).toBeDefined()
  })

  it('registers Blink return as a free 10-foot teleport that clears the pending return lock', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const definition = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'blink',
    )
    const blink = definition?.activities?.find((entry) =>
      (entry as Dnd5eActivityDefinitionV1).id === 'spell:blink') as Dnd5eActivityDefinitionV1
    const returnActivity = definition?.activities?.find((entry) =>
      (entry as Dnd5eActivityDefinitionV1).id === 'spell:blink:return') as Dnd5eActivityDefinitionV1

    expect(blink.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'mechanic', handlerId: 'core.turn-end-random-condition',
        parameters: expect.objectContaining({ 'dismiss-action-label': '用动作解除闪现术' }),
      }),
    )
    expect(returnActivity).toMatchObject({
      activation: { kind: 'free', cost: 0 },
      target: {
        kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 10,
        lengthFeet: 5, widthFeet: 5, heightFeet: 5,
        requiresLineOfSight: true, requiresLineOfEffect: false,
      },
      requirements: [expect.objectContaining({
        kind: 'active-effect', effectId: 'blink-return-pending', present: true, source: 'self',
      })],
    })
    expect(returnActivity.outcomes.flatMap((outcome) => outcome.operations)).toEqual([
      expect.objectContaining({
        kind: 'move', target: 'actor', mode: 'teleport',
        distanceFeet: { kind: 'constant', value: 10 }, ignoresOpportunityAttacks: true,
      }),
      expect.objectContaining({
        kind: 'remove-effect', target: 'actor', effectId: 'blink-return-pending', source: 'self',
      }),
    ])
  })

  it('projects every combat spell into a valid fully handled Activity', () => {
    expect(DND5E_SRD_COMBAT_SPELLS).toHaveLength(123)
    for (const spell of DND5E_SRD_COMBAT_SPELLS) {
      const activity = dnd5eCoreSpellActivityV1(spell)
      expect(validateDnd5eActivityDefinitionV1(activity), spell.id).toEqual([])
      expect(activity.authorityBinding).toEqual({
        kind: 'core-spell-transaction', spellId: spell.id, execution: 'headless-event-engine',
      })
      expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level, spell.id).toBe('full')
    }
  })

  it('registers all core spells through the sole Unified Content boundary', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const registered = listRegisteredContentDefinitionPackages()
      .find((entry) => entry.packageId === DND5E_CORE_SPELL_PACKAGE_ID)
    expect(DND5E_SRD_AUDITED_PARTIAL_SPELL_IDS).toHaveLength(93)
    expect(DND5E_SRD_AUDITED_FULL_SPELL_IDS).toHaveLength(97)
    expect(DND5E_SRD_AUDITED_MANUAL_SPELL_IDS).toHaveLength(6)
    expect(registered?.definitions).toHaveLength(319)
    expect(registered?.definitions.every((definition) =>
      definition.namespace === DND5E_CORE_SPELL_PACKAGE_ID &&
      definition.version === DND5E_CORE_SPELL_PACKAGE_VERSION &&
      definition.source?.packageId === DND5E_CORE_SPELL_PACKAGE_ID &&
      definition.source.packageVersion === DND5E_CORE_SPELL_PACKAGE_VERSION,
    )).toBe(true)
    expect(registered?.definitions.find((definition) => definition.id === 'aid')).toMatchObject({
      namespace: DND5E_CORE_SPELL_PACKAGE_ID,
      version: DND5E_CORE_SPELL_PACKAGE_VERSION,
      source: {
        packageId: DND5E_CORE_SPELL_PACKAGE_ID,
        packageVersion: DND5E_CORE_SPELL_PACKAGE_VERSION,
      },
    })
    expect(registered?.definitions.find((definition) => definition.id === 'detect-magic')?.activities)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'spell:detect-magic' }),
        expect.objectContaining({ id: 'spell:detect-magic:reveal-auras' }),
      ]))
    const command = registered?.definitions.find((definition) => definition.id === 'command')
    expect(command?.automation.level).toBe('full')
    expect(command?.activities?.[0]).toMatchObject({
      id: 'spell:command',
      legacySource: { kind: 'spell', id: 'command' },
      automation: { level: 'full' },
    })
    const full = registered?.definitions.find((definition) => definition.id === 'fire-shield')
    expect(full?.automation.level).toBe('full')
    expect(full?.activities?.[0]).toMatchObject({
      id: 'spell:fire-shield',
      legacySource: { kind: 'spell', id: 'fire-shield' },
      automation: { level: 'full' },
    })
    const fireball = getDnd5eCoreSpellRuntimeDefinitionV1('fireball')
    expect(fireball?.spell.id).toBe('fireball')
    expect(fireball?.activity.id).toBe('spell:fireball')
    const legendLore = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'legend-lore',
    )
    expect(legendLore?.activities?.[0]).toMatchObject({
      id: 'spell:legend-lore',
      activation: { kind: 'minute', value: 10 },
      target: { kind: 'self' },
      outcomes: [{
        id: 'legend-lore-resource-only',
        operations: [{ handlerId: 'core.resolve-only' }],
      }],
      automation: { level: 'full' },
    })
  })

  it('scales Invisibility and Longstrider to multiple selectable upcast targets', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const actor = {
      level: 20,
      proficiencyBonus: 6,
    }
    const invisibility = getDnd5eCoreSpellRuntimeDefinitionV1('invisibility')!.activity
    const longstrider = getDnd5eCoreSpellRuntimeDefinitionV1('longstrider')!.activity

    expect(scaleDnd5eActivityDefinitionV1(invisibility, { actor, castLevel: 3 }).activity.target)
      .toMatchObject({ kind: 'creature', count: 2 })
    expect(scaleDnd5eActivityDefinitionV1(longstrider, { actor, castLevel: 4 }).activity.target)
      .toMatchObject({ kind: 'creature', count: 4 })
  })

  it('lets Giant Insect declare a complete rules-legal insect group before DM confirmation', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('giant-insect')
    expect(activity).toBeDefined()
    expect(activity?.target).toMatchObject({
      kind: 'creature', relation: 'any', count: 10,
      rangeFeet: 30, includeSelf: true,
    })
    expect(activity?.automation.level).toBe('assisted')
  })

  it('keeps Glibness minimum Charisma-check roll in the partial Activity safe subset', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('glibness')
    expect(activity).toBeDefined()
    expect(activity?.target).toEqual({ kind: 'self' })
    expect(activity?.effects).toEqual([
      expect.objectContaining({
        id: 'glibness',
        duration: { kind: 'rounds', rounds: 600, expiresAt: 'target-turn-end' },
        modifiers: [{ kind: 'minimum-ability-check-d20', ability: 'cha', minimum: 15 }],
        stacking: 'replace',
      }),
    ])
    expect(activity?.outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'deterministic-effect',
        operations: [expect.objectContaining({
          kind: 'apply-effect', target: 'actor', effectId: 'glibness',
        })],
      }),
      expect.objectContaining({ id: 'dm-boundary' }),
    ]))
    expect(activity?.automation.level).toBe('assisted')
  })

  it('models Floating Disk as a 3-foot non-concentration follower entity', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('floating-disk')
    expect(activity).toBeDefined()
    if (!activity) return
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.target).toMatchObject({
      kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
      placeRangeFeet: 30, radiusFeet: 0, maximumTargets: 1,
      requiresLineOfSight: true, requiresLineOfEffect: true,
    })
    expect(activity.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        id: 'floating-disk-entity',
        kind: 'create-persistent-area',
        durationRounds: 600,
        concentration: false,
        effectToken: expect.objectContaining({ size: 0.6 }),
        sourceFollower: {
          stationaryWithinFeet: 20,
          maximumSeparationFeet: 100,
          maximumStepHeightFeet: 10,
          carryingCapacityPounds: 500,
        },
      }),
    )
    const actor: Dnd5eActivityActorSnapshot = {
      id: 'floating-disk-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
      armorClass: 12, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
    }
    expect(resolveDnd5eActivity({
      activity, actor, targets: [], castLevel: 1, rolls: {},
      areaPlacement: { x: 25, y: 25, radiusFeet: 0 },
      areaPlacementDistanceFeet: 5,
    })).toMatchObject({ ok: true })
  })

  it('models Confusion as an all-creature save area with reaction denial and 5-foot upcast radius scaling', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('confusion')
    expect(activity).toBeDefined()
    if (!activity) return
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.automation.level).toBe('full')
    expect(activity.target).toMatchObject({
      kind: 'area', relation: 'any', origin: 'point', shape: 'sphere',
      placeRangeFeet: 90, radiusFeet: 10, includeSelf: true,
    })
    expect(activity.checks).toEqual([expect.objectContaining({
      kind: 'saving-throw', ability: 'wis', scope: 'per-target',
    })])
    expect(activity.effects).toContainEqual(expect.objectContaining({
      id: 'confusion', extensionCondition: 'confused-behavior', concentration: true,
      duration: expect.objectContaining({ kind: 'save-ends', timing: 'target-turn-end', ability: 'wis' }),
      modifiers: [{ kind: 'prohibit-reaction' }],
    }))

    const scaled = scaleDnd5eActivityDefinitionV1(activity, {
      actor: { level: 20, proficiencyBonus: 6 }, castLevel: 9,
    }).activity
    expect(scaled.target).toMatchObject({ kind: 'area', radiusFeet: 35 })
    expect(scaled.outcomes.flatMap((outcome) => outcome.operations))
      .not.toContainEqual(expect.objectContaining({ kind: 'damage' }))

    const caster: Dnd5eActivityActorSnapshot = {
      id: 'confusion-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
      armorClass: 12, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
    }
    const successfulTarget: Dnd5eActivityActorSnapshot = {
      id: 'confusion-save-success', controller: 'dm', level: 1, proficiencyBonus: 2,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      armorClass: 10, conditions: [], currentHp: 10, maxHp: 10,
      savingThrowModifiers: { wis: 0 },
    }
    const failedTarget: Dnd5eActivityActorSnapshot = {
      ...successfulTarget, id: 'confusion-save-failure',
    }
    const resolved = resolveDnd5eActivity({
      activity, actor: caster, targets: [successfulTarget, failedTarget], castLevel: 4,
      areaPlacement: { x: 0, y: 0, radiusFeet: 10 }, areaPlacementDistanceFeet: 30,
      rolls: {
        'spell-save-d20:confusion-save-success': { values: [19] },
        'spell-save-d20:confusion-save-failure': { values: [4] },
      },
      checkRollModes: {
        'spell-save:confusion-save-success': 'normal',
        'spell-save:confusion-save-failure': 'normal',
      },
    })
    expect(resolved).toMatchObject({ ok: true })
    expect(resolved.ok && resolved.proposals.filter((proposal) => proposal.kind === 'apply-effect'))
      .toEqual([expect.objectContaining({ targetId: 'confusion-save-failure', effectId: 'confusion' })])
  })

  it('models True Polymorph creature-to-creature replacement and earned permanence without object automation', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const activity = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'true-polymorph',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(activity.target).toMatchObject({ kind: 'creature', rangeFeet: 30, count: 1 })
    expect(activity.choices?.map((choice) => choice.id)).toEqual(['creature-form'])
    expect(activity.checks).toEqual([expect.objectContaining({
      id: 'spell-save', ability: 'wis',
    })])
    expect(activity.effects).toBeUndefined()

    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: 'true-poly-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
      armorClass: 12, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
    }
    const targetSnapshot: Dnd5eActivityActorSnapshot = {
      id: 'true-poly-target', controller: 'dm', level: 3, statBlockId: 'srd-5.1:knight',
      proficiencyBonus: 2,
      abilities: { str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15 },
      armorClass: 18, conditions: [], currentHp: 52, maxHp: 52,
      savingThrowModifiers: { wis: 0 },
    }
    const choices = { 'creature-form': 'srd-5.1:brown-bear' }
    const resolved = resolveDnd5eActivity({
      activity, actor: actorSnapshot, targets: [targetSnapshot], castLevel: 9,
      distanceFeetByTargetId: { 'true-poly-target': 20 },
      rolls: { 'spell-save-d20:true-poly-target': { values: [1] } },
      checkRollModes: { 'spell-save:true-poly-target': 'normal' },
      choices, dmApproved: true,
    })
    expect(resolved, JSON.stringify(resolved)).toMatchObject({ ok: true })
    expect(resolved.ok && resolved.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'transform-creature', targetId: 'true-poly-target',
        profile: 'true-polymorph', formId: 'srd-5.1:brown-bear',
        permanentAfterConcentrationCompletes: true,
      }),
    ]))

    expect(resolveDnd5eActivity({
      activity, actor: actorSnapshot, targets: [targetSnapshot], castLevel: 9,
      distanceFeetByTargetId: { 'true-poly-target': 20 },
      rolls: { 'spell-save-d20:true-poly-target': { values: [1] } },
      choices: { ...choices, mode: 'object-to-creature' }, dmApproved: true,
    })).toMatchObject({
      ok: false, reason: 'requirement-failed', details: ['unknown Activity choice'],
    })

    if (!resolved.ok) return
    const abilities = { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 } as const
    const caster = createDnd5eCombatant({ concentrating: false,
      id: actorSnapshot.id, name: 'Caster', controller: 'player', initiative: 20,
      abilities, proficiencyBonus: 6, armorClass: 12, currentHp: 100, maxHp: 100,
      temporaryHp: 0, speed: 30, position: { x: 0, y: 0 },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const target = createDnd5eCombatant({ concentrating: false,
      id: targetSnapshot.id, name: 'Knight', controller: 'dm', initiative: 10,
      abilities: targetSnapshot.abilities, proficiencyBonus: 2, armorClass: 18,
      currentHp: 52, maxHp: 52, temporaryHp: 0, speed: 30, position: { x: 20, y: 0 },
      challengeRating: 3,
    })
    const committed = commitDnd5eActivityExecution(
      startDnd5eHeadlessCombat('true-polymorph', [caster, target]),
      {
        actorId: caster.id, activityId: activity.id, castLevel: 9,
        targetIds: [target.id], resolution: resolved,
        dmApproved: true,
        source: { kind: 'spell', id: 'true-polymorph' },
      },
    )
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants[target.id]).toMatchObject({
      currentHp: 34, maxHp: 34, armorClass: 11, speed: 40,
      abilities: { str: 19, dex: 10, con: 16, int: 2, wis: 13, cha: 7 },
      statBlockId: 'srd-5.1:brown-bear',
    })
    expect(committed.state.combatants[target.id].classState).toMatchObject({
      wildShapeMode: 'true-polymorph',
      wildShapePermanentAfterConcentrationCompletes: true,
    })

    const interrupted = structuredClone(committed.state)
    endDnd5eConcentration(interrupted, interrupted.combatants[caster.id], [])
    expect(interrupted.combatants[target.id]).toMatchObject({
      currentHp: 52, maxHp: 52, armorClass: 18,
      abilities: targetSnapshot.abilities,
    })
    expect(interrupted.combatants[target.id].classState.wildShapeFormId).toBeUndefined()

    const completed = structuredClone(committed.state)
    endDnd5eConcentration(completed, completed.combatants[caster.id], [], 'completed')
    expect(completed.combatants[target.id].classState).toMatchObject({
      wildShapeFormId: 'srd-5.1:brown-bear',
      wildShapePermanent: true,
      wildShapePermanentAfterConcentrationCompletes: undefined,
    })
    expect(completed.combatants[caster.id].classState.lastCompletedConcentration).toMatchObject({
      spellId: 'true-polymorph', completedRound: 1,
    })

  })

  it('restores built-in effect-granted controls before the lazy SRD package is registered', () => {
    expect(listRegisteredContentDefinitionPackages()).toEqual([])

    expect(dnd5ePluginFeatureDefinition(
      `${DND5E_CORE_SPELL_PACKAGE_ID}:effect-control.spell:detect-magic:reveal-auras`,
    )).toMatchObject({
      name: '侦测魔法·显化灵光',
      ownerPluginId: DND5E_CORE_SPELL_PACKAGE_ID,
      sourceLabel: '持续效果授予',
      action: {
        id: 'spell:detect-magic:reveal-auras',
        economy: 'action',
        targeting: { kind: 'self' },
      },
    })
    expect(listRegisteredContentDefinitionPackages()).toEqual([])
  })

  it('registers every audited full and assisted spell while deriving truthful current coverage', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    for (const spellId of DND5E_SRD_AUDITED_FULL_SPELL_IDS) {
      const definition = getRegisteredContentDefinition(DND5E_CORE_SPELL_PACKAGE_ID, 'spell', spellId)
      const activity = definition?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined
      expect(activity, spellId).toBeDefined()
      if (!activity) continue
      const analysis = dnd5eActivityAutomationAnalysisV1(activity)
      expect(analysis.capability.level, spellId).toBe('full')
      expect(definition?.automation.level, spellId).toBe(analysis.capability.level)
      expect(activity.outcomes.flatMap((outcome) => outcome.operations).length, spellId).toBeGreaterThan(0)
      expect(dnd5eActivityManualAdjudicationOperationsV1(activity), spellId).toEqual([])
      if (analysis.capability.level === 'full') {
        expect(dnd5ePluginSpellAutomationSupported(dnd5ePluginSpellDefinition(spellId)), spellId).toBe(true)
        expect(dnd5ePluginSpellHasFullHeadlessAutomation(dnd5ePluginSpellDefinition(spellId)), spellId).toBe(true)
        expect(() => compileDnd5eActivityHeadlessAction(activity, { outerSpellTransaction: true }), spellId)
          .not.toThrow()
      } else {
        expect(analysis.capability.limitations?.every((entry) => entry.includes('未注册 Host handler')), spellId).toBe(true)
      }
    }
    for (const spellId of DND5E_SRD_AUDITED_PARTIAL_SPELL_IDS) {
      expect(dnd5ePluginSpellAutomationSupported(dnd5ePluginSpellDefinition(spellId)), spellId).toBe(true)
      expect(dnd5ePluginSpellHasFullHeadlessAutomation(dnd5ePluginSpellDefinition(spellId)), spellId).toBe(false)
      const definition = getRegisteredContentDefinition(DND5E_CORE_SPELL_PACKAGE_ID, 'spell', spellId)
      const activity = definition?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined
      expect(activity, spellId).toBeDefined()
      if (!activity) continue
      const activityLevel = dnd5eActivityAutomationAnalysisV1(activity).capability.level
      expect(['full', 'assisted'], spellId).toContain(activityLevel)
      expect(dnd5eActivityManualAdjudicationOperationsV1(activity), spellId)
        .toHaveLength(activityLevel === 'full' ? 0 : 1)
      expect(() => compileDnd5eActivityHeadlessAction(activity, { outerSpellTransaction: true }), spellId)
        .not.toThrow()
    }
    for (const spellId of DND5E_SRD_AUDITED_MANUAL_SPELL_IDS) {
      expect(dnd5ePluginSpellAutomationSupported(dnd5ePluginSpellDefinition(spellId)), spellId).toBe(true)
      expect(dnd5ePluginSpellHasFullHeadlessAutomation(dnd5ePluginSpellDefinition(spellId)), spellId).toBe(false)
      const definition = getRegisteredContentDefinition(DND5E_CORE_SPELL_PACKAGE_ID, 'spell', spellId)
      const activity = definition?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined
      expect(activity, spellId).toBeDefined()
      if (!activity) continue
      expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level, spellId).toBe('assisted')
      expect(dnd5eActivityManualAdjudicationOperationsV1(activity), spellId).toHaveLength(1)
      expect(() => compileDnd5eActivityHeadlessAction(activity, { outerSpellTransaction: true }), spellId)
        .not.toThrow()
    }
  })

  it('keeps Guards and Wards building selection out of the creature target picker', () => {
    const guardsAndWards = dnd5eSrdAuditedSpellActivityV1('guards-and-wards')!
    expect(guardsAndWards.target).toEqual({ kind: 'self' })
    expect(dnd5eActivityManualAdjudicationOperationsV1(guardsAndWards)).toEqual([
      expect.objectContaining({
        kind: 'manual-adjudication',
        requiresDmApproval: true,
        prompt: expect.stringContaining('2,500 平方尺'),
      }),
    ])
    expect(guardsAndWards.scaling ?? []).toEqual([])
  })

  it('separates Detect Thoughts surface reading, deep probe, search and Intelligence contest', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const activities = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'detect-thoughts',
    )?.activities as readonly Dnd5eActivityDefinitionV1[] | undefined
    const cast = activities?.find((activity) => activity.id === 'spell:detect-thoughts')
    const surface = activities?.find((activity) => activity.id === 'spell:detect-thoughts:surface')
    const probe = activities?.find((activity) => activity.id === 'spell:detect-thoughts:probe')
    const search = activities?.find((activity) => activity.id === 'spell:detect-thoughts:search')
    const contest = activities?.find((activity) => activity.id === 'spell:detect-thoughts:contest')

    expect(activities?.map((activity) => activity.id)).toEqual(expect.arrayContaining([
      'spell:detect-thoughts', 'spell:detect-thoughts:surface',
      'spell:detect-thoughts:probe', 'spell:detect-thoughts:search',
      'spell:detect-thoughts:contest',
    ]))
    for (const activity of activities ?? []) {
      expect(validateDnd5eActivityDefinitionV1(activity), activity.id).toEqual([])
    }
    expect(cast).toMatchObject({
      target: {
        kind: 'creature', rangeFeet: 30, count: 1, includeSelf: false,
        requiresLineOfSight: true,
      },
      checks: undefined,
      effects: [expect.objectContaining({
        id: 'detect-thoughts-controller', concentration: true,
        grants: expect.arrayContaining([
          'spell:detect-thoughts:surface', 'spell:detect-thoughts:probe',
          'spell:detect-thoughts:search',
        ]),
      }), expect.objectContaining({ id: 'detect-thoughts-focus' })],
    })
    expect(cast?.requirements).toContainEqual({
      kind: 'ability-score', subject: 'target', ability: 'int', comparison: 'above', value: 3,
    })
    expect(dnd5eActivityManualAdjudicationOperationsV1(cast!)).toContainEqual(
      expect.objectContaining({ id: 'adjudicate-surface-thoughts' }),
    )
    expect(surface?.checks).toBeUndefined()
    expect(probe?.checks).toContainEqual(expect.objectContaining({
      id: 'detect-thoughts-probe-save', kind: 'saving-throw', ability: 'wis',
    }))
    expect(probe?.outcomes.find((outcome) => outcome.id === 'probe-resisted')?.operations)
      .toContainEqual(expect.objectContaining({
        kind: 'remove-effect', effectId: 'detect-thoughts-controller', target: 'actor',
      }))
    expect(probe?.effects).toContainEqual(expect.objectContaining({
      id: 'detect-thoughts-probed', grants: ['spell:detect-thoughts:contest'],
    }))
    expect(search?.target).toEqual({ kind: 'self' })
    expect(contest?.checks).toContainEqual(expect.objectContaining({
      id: 'detect-thoughts-intelligence-contest', kind: 'opposed-ability-check',
      sourceAbility: 'int', targetOptions: [{ ability: 'int' }],
    }))
    expect(contest?.outcomes[0]?.operations).toContainEqual(expect.objectContaining({
      kind: 'remove-effect', effectId: 'detect-thoughts-controller', target: 'target',
    }))

    const caster: Dnd5eActivityActorSnapshot = {
      id: 'caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 },
      armorClass: 12, conditions: [], currentHp: 100, maxHp: 100,
      spellSaveDc: 19, resources: { 'dnd5e-spell-slot-2': { current: 1, maximum: 1 } },
    }
    const target: Dnd5eActivityActorSnapshot = {
      id: 'target', controller: 'dm', level: 1, proficiencyBonus: 2,
      abilities: { str: 10, dex: 10, con: 10, int: 4, wis: 10, cha: 10 },
      armorClass: 10, conditions: [], currentHp: 10, maxHp: 10,
    }
    expect(resolveDnd5eActivity({
      activity: cast!, actor: caster, targets: [target], castLevel: 2,
      rolls: {}, distanceFeetByTargetId: { target: 30 },
    }).ok).toBe(true)
    expect(resolveDnd5eActivity({
      activity: cast!, actor: caster,
      targets: [{ ...target, abilities: { ...target.abilities, int: 3 } }],
      castLevel: 2, rolls: {}, distanceFeetByTargetId: { target: 30 },
    })).toMatchObject({ ok: false, reason: 'requirement-failed' })
  })

  it('完整建模怪影杀手的 120 尺落点、30 尺球形和回合结束伤害', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const spell = dnd5ePluginSpellDefinition('weird')
    const activity = dnd5ePluginSpellActivity(spell)

    expect(dnd5ePluginSpellHasFullHeadlessAutomation(spell)).toBe(true)
    expect(activity).toMatchObject({
      target: {
        kind: 'area',
        origin: 'point',
        shape: 'sphere',
        placeRangeFeet: 120,
        radiusFeet: 30,
        relation: 'enemy',
        maximumTargets: 256,
      },
      checks: [{
        kind: 'saving-throw',
        ability: 'wis',
        scope: 'per-target',
      }],
      automation: { level: 'full' },
    })
    expect(activity?.effects?.find((effect) => effect.id === 'weird')).toMatchObject({
      duration: {
        kind: 'save-ends',
        maximumRounds: 10,
        timing: 'target-turn-end',
        ability: 'wis',
        damageOnFailure: { count: 4, sides: 10, type: 'psychic' },
      },
      conditions: ['frightened'],
      concentration: true,
    })
    expect(dnd5eActivityManualAdjudicationOperationsV1(activity!)).toEqual([])
  })

  it('models language spells as concrete Host effects instead of prose markers', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const comprehend = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'comprehend-languages',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined
    const tongues = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'tongues',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined

    expect(dnd5eActivityAutomationAnalysisV1(comprehend!).capability.level).toBe('full')
    expect(dnd5eActivityAutomationAnalysisV1(tongues!).capability.level).toBe('full')
    expect(comprehend?.effects?.[0]?.modifiers).toContainEqual({
      kind: 'language-capability', understandSpoken: 'all',
      understandWritten: 'literal-written', writtenRequiresTouch: true, writtenMinutesPerPage: 1,
    })
    expect(tongues?.effects?.[0]?.modifiers).toContainEqual({
      kind: 'language-capability', understandSpoken: 'all',
      speechUnderstoodBy: 'any-creature-knowing-a-language',
    })
    expect(tongues?.effects?.[0]?.disposition).toBe('buff')
  })

  it('targets Transport via Plants at a mapped entrance plant instead of a creature', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const transport = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'transport-via-plants',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined

    expect(transport?.target).toEqual({
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 10, lengthFeet: 5, widthFeet: 5, heightFeet: 5,
      rotatable: false, maximumTargets: 1,
      requiresLineOfSight: false, requiresLineOfEffect: true,
    })
    expect(transport?.effects).toContainEqual(expect.objectContaining({
      id: 'transport-via-plants-connection',
      name: '木遁术·植物连接',
      disposition: 'buff',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
    }))
    expect(transport?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'apply-effect', target: 'actor', effectId: 'transport-via-plants-connection',
      }),
    )
    const boundary = transport?.outcomes.flatMap((outcome) => outcome.operations)
      .find((operation) => operation.kind === 'manual-adjudication')
    expect(boundary).toMatchObject({
      kind: 'manual-adjudication', requiresDmApproval: true,
    })
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('大型或更大')
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('同一位面')
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('5 尺移动力')
    expect(dnd5eActivityAutomationAnalysisV1(transport!).capability.level).toBe('assisted')
  })

  it('targets Gate at an unoccupied portal point and tracks its bounded concentration lifetime', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const gate = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'gate',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined

    expect(gate?.target).toEqual({
      kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
      placeRangeFeet: 60, radiusFeet: 10, minimumRadiusFeet: 2.5,
      maximumTargets: 256, includeSelf: true,
      requiresLineOfSight: true, requiresLineOfEffect: true,
    })
    expect(gate?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        id: 'partial-persistent-area',
        kind: 'create-persistent-area',
        label: '异界之门',
        durationRounds: 10,
        concentration: true,
        anchorMode: 'fixed',
        creationConstraints: { maximumCreatureCount: 0 },
        effectToken: expect.objectContaining({
          label: '异界之门', emoji: '◉', color: '#7c3aed', hiddenBody: false,
        }),
      }),
    )
    const boundary = gate?.outcomes.flatMap((outcome) => outcome.operations)
      .find((operation) => operation.kind === 'manual-adjudication')
    expect(boundary).toMatchObject({
      kind: 'manual-adjudication', requiresDmApproval: true,
    })
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('正面')
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('真名')
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('不赋予控制')
    expect(dnd5eActivityAutomationAnalysisV1(gate!).capability.level).toBe('assisted')
  })

  it('tracks Tree Stride as a one-minute caster concentration ability with explicit movement boundaries', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const treeStride = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'tree-stride',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined

    expect(treeStride?.target).toEqual({ kind: 'self' })
    expect(treeStride?.effects).toContainEqual(expect.objectContaining({
      id: 'tree-stride-teleport',
      name: '树跃术·树跃能力',
      disposition: 'buff',
      tags: ['teleport', 'plant', 'movement'],
      duration: { kind: 'concentration', maximumRounds: 10 },
      concentration: true,
      grants: ['spell:tree-stride:teleport'],
      stacking: 'replace',
    }))
    expect(treeStride?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({ kind: 'apply-effect', effectId: 'tree-stride-teleport' }),
    )
    const boundary = treeStride?.outcomes.flatMap((outcome) => outcome.operations)
      .find((operation) => operation.kind === 'manual-adjudication')
    expect(boundary).toMatchObject({ kind: 'manual-adjudication', requiresDmApproval: true })
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('500 尺')
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('各花费 5 尺移动力')
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('每轮只能树跃一次')
    expect(boundary?.kind === 'manual-adjudication' && boundary.prompt).toContain('树外结束')
    expect(dnd5eActivityAutomationAnalysisV1(treeStride!).capability.level).toBe('assisted')

    const granted = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'tree-stride',
    )?.activities?.find((activity) => activity && typeof activity === 'object' && 'id' in activity && activity.id === 'spell:tree-stride:teleport') as
      Dnd5eActivityDefinitionV1 | undefined
    expect(granted).toMatchObject({
      activation: { kind: 'movement', cost: 0 },
      target: { kind: 'self' },
      consumption: [{
        kind: 'movement', amount: { kind: 'constant', value: 10 }, consumeOn: 'resolve',
      }],
      requirements: [
        expect.objectContaining({
          kind: 'active-effect', effectId: 'tree-stride-teleport', present: true, source: 'self',
        }),
        { kind: 'once-per-turn', key: 'tree-stride-teleport' },
      ],
    })
    expect(granted?.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'manual-adjudication', requiresDmApproval: true,
      }),
      expect.objectContaining({
        kind: 'move', target: 'actor', mode: 'teleport',
        distanceFeet: { kind: 'constant', value: 500 }, ignoresOpportunityAttacks: true,
      }),
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(granted!).capability.level).toBe('assisted')
    expect(dnd5ePluginFeatureDefinition(
      `${DND5E_CORE_SPELL_PACKAGE_ID}:effect-control.spell:tree-stride:teleport`,
    )).toMatchObject({
      name: '树跃术·树跃',
      ownerPluginId: DND5E_CORE_SPELL_PACKAGE_ID,
      sourceLabel: '持续效果授予',
      automation: 'partial',
      action: {
        id: 'spell:tree-stride:teleport', economy: 'none', targeting: { kind: 'self' },
      },
    })
  })

  it('keeps Illusory Script on the caster authority carrier instead of targeting a map creature', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const activity = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'illusory-script',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined

    expect(activity?.target).toEqual({ kind: 'self' })
    expect(dnd5eActivityManualAdjudicationOperationsV1(activity!)).toHaveLength(0)
    expect(activity?.effects?.[0]).toMatchObject({
      id: 'illusory-script-document',
      tags: ['illusion', 'written-object'],
      duration: { kind: 'rounds', rounds: 144_000 },
      stacking: 'stack',
    })
    expect(activity?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({ kind: 'apply-effect', effectId: 'illusory-script-document' }),
    )
    expect(dnd5eActivityAutomationAnalysisV1(activity!).capability.level).toBe('full')
  })

  it('applies Disguise Self as a one-hour self status without opening a DM boundary', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const activities = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'disguise-self',
    )?.activities as readonly Dnd5eActivityDefinitionV1[] | undefined
    const activity = activities?.[0]

    expect(activity?.target).toEqual({ kind: 'self' })
    expect(activity?.effects).toContainEqual(expect.objectContaining({
      id: 'disguise-self-appearance',
      tags: expect.arrayContaining(['illusion', 'disguise', 'appearance']),
      grants: ['spell:disguise-self:dismiss', 'spell:disguise-self:inspect'],
      duration: expect.objectContaining({ kind: 'rounds', rounds: 600 }),
    }))
    expect(activity?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({ kind: 'apply-effect', target: 'actor', effectId: 'disguise-self-appearance' }),
    )
    expect(dnd5eActivityManualAdjudicationOperationsV1(activity!)).toHaveLength(0)
    expect(activities?.find((candidate) => candidate.id === 'spell:disguise-self:dismiss'))
      .toMatchObject({ target: { kind: 'self' }, activation: { kind: 'action' } })
    const inspect = activities?.find((candidate) => candidate.id === 'spell:disguise-self:inspect')
    expect(inspect?.target).toMatchObject({ kind: 'creature', requiresLineOfSight: true })
    expect(inspect?.checks?.[0]).toMatchObject({
      kind: 'skill-check', ability: 'int', skill: 'investigation',
      dc: { reference: { kind: 'target-active-effect-source-spell-save-dc' } },
    })
  })

  it('gates Modify Memory trance and its DM memory edit behind the target Wisdom save', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const activity = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'modify-memory',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined

    expect(activity?.target).toMatchObject({ kind: 'creature', relation: 'any' })
    expect(activity?.checks).toContainEqual(expect.objectContaining({
      kind: 'saving-throw', ability: 'wis', scope: 'per-target',
      automaticSuccessIfConditionImmune: 'charmed',
    }))
    expect(activity?.effects).toContainEqual(expect.objectContaining({
      id: 'modify-memory-trance',
      conditions: ['charmed', 'incapacitated'],
      breakOn: ['takes-damage', 'targeted-by-spell'],
      duration: { kind: 'concentration', maximumRounds: 10 },
    }))
    expect(activity?.outcomes.find((outcome) => outcome.id === 'dm-boundary')?.when)
      .toMatchObject({ kind: 'check', checkId: 'spell-save', result: 'failure' })
  })

  it('models Imprisonment mode, Wisdom save, permanent binding, and repeat-cast immunity', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const activity = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'imprisonment',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined

    expect(activity?.checks).toContainEqual(expect.objectContaining({
      id: 'spell-save', kind: 'saving-throw', ability: 'wis',
    }))
    expect(activity?.choices?.[0]).toMatchObject({
      id: 'mode',
      options: [
        { id: 'burial' }, { id: 'chaining' }, { id: 'hedged-prison' },
        { id: 'minimus-containment' }, { id: 'slumber' },
      ],
    })
    expect(activity?.requirements).toContainEqual(expect.objectContaining({
      kind: 'active-effect', subject: 'target', effectId: 'imprisonment-immunity', present: false,
    }))
    expect(activity?.effects).toContainEqual(expect.objectContaining({
      id: 'imprisonment-chaining', name: '禁锢术：锁链', duration: { kind: 'permanent' },
      conditions: ['restrained'],
      modifiers: [{ kind: 'spell-targeting-immunity', schools: ['divination'] }],
    }))
    expect(activity?.effects).toContainEqual(expect.objectContaining({
      id: 'imprisonment-slumber', name: '禁锢术：沉眠', conditions: ['unconscious'],
    }))
    expect(activity?.outcomes).toContainEqual(expect.objectContaining({
      id: 'imprisonment-chaining-on-failed-save',
      operations: [expect.objectContaining({ effectId: 'imprisonment-chaining' })],
    }))
  })

  it('models Message as an action-only self Activity without a private channel or reply', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const message = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'message',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(message.target).toEqual({ kind: 'self' })
    expect(message.outcomes.flatMap((outcome) => outcome.operations)).toEqual([{
      id: 'message-resolved', kind: 'mechanic', target: 'actor',
      handlerId: 'core.resolve-only',
    }])
    expect(message.outcomes.flatMap((outcome) => outcome.operations))
      .not.toContainEqual(expect.objectContaining({ kind: 'open-communication' }))
    expect(message.outcomes.flatMap((outcome) => outcome.operations))
      .not.toContainEqual(expect.objectContaining({ kind: 'manual-adjudication' }))
    expect(dnd5eActivityAutomationAnalysisV1(message)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Minor Illusion as an action-only self Activity without map imagery or DM approval', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const activity = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'minor-illusion',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined

    expect(activity?.target).toEqual({ kind: 'self' })
    expect(activity?.choices).toBeUndefined()
    expect(activity?.outcomes.flatMap((outcome) => outcome.operations)).toEqual([{
      id: 'minor-illusion-resolved', kind: 'mechanic', target: 'actor',
      handlerId: 'core.resolve-only',
    }])
    expect(dnd5eActivityManualAdjudicationOperationsV1(activity!)).toHaveLength(0)
    expect(dnd5eActivityAutomationAnalysisV1(activity!)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('tracks Mirage Arcane as a ten-day world state without a DM approval boundary', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const activity = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'mirage-arcane',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1 | undefined

    expect(activity?.target).toEqual({ kind: 'self' })
    expect(activity?.effects).toContainEqual(expect.objectContaining({
      id: 'mirage-arcane-terrain-illusion',
      tags: ['illusion', 'terrain', 'world-state', 'multisensory'],
      duration: { kind: 'rounds', rounds: 144_000, expiresAt: 'target-turn-end' },
      stacking: 'replace',
    }))
    expect(activity?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({ kind: 'apply-effect', effectId: 'mirage-arcane-terrain-illusion' }),
    )
    expect(dnd5eActivityManualAdjudicationOperationsV1(activity!)).toHaveLength(0)
    expect(dnd5eActivityAutomationAnalysisV1(activity!)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
    expect(dnd5ePluginSpellHasFullHeadlessAutomation(dnd5ePluginSpellDefinition('mirage-arcane'))).toBe(true)
  })

  it('models water travel and submerged rising with generic environmental capabilities', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const breathing = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'water-breathing',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const walking = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'water-walk',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(breathing.activation).toEqual({ kind: 'action', cost: 1 })
    expect(breathing.target).toEqual({
      kind: 'creature', relation: 'ally', count: 10, rangeFeet: 30, includeSelf: true,
    })
    expect(breathing.consumption).toContainEqual({
      kind: 'spell-slot', minimumLevel: 3, level: 'selected', amount: 1, consumeOn: 'resolve',
    })
    expect(breathing.effects?.[0]).toMatchObject({
      duration: { kind: 'rounds', rounds: 14_400, expiresAt: 'target-turn-end' },
      modifiers: [{ kind: 'environmental-capability', breatheIn: ['water'] }],
      stacking: 'replace',
    })
    expect(breathing.scaling).toBeUndefined()
    expect(dnd5eActivityAutomationAnalysisV1(breathing).capability.level).toBe('full')
    expect(walking.effects?.[0]?.modifiers).toContainEqual({
      kind: 'environmental-capability', treatLiquidSurfacesAsSolidGround: true,
      riseTowardLiquidSurfaceFeetPerRound: 60,
    })
    expect(dnd5eActivityAutomationAnalysisV1(walking)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Gentle Repose as a timed corpse-preservation ledger effect', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const repose = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'gentle-repose',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(repose.effects?.[0]).toMatchObject({
      id: 'gentle-repose',
      tags: ['corpse-preservation', 'prevents-undead-animation'],
      duration: { kind: 'rounds', rounds: 144_000 },
    })
    expect(repose.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({ kind: 'apply-effect', effectId: 'gentle-repose' }),
    )
    expect(dnd5eActivityAutomationAnalysisV1(repose)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('grants Eyebite repeat gaze only through its live caster effect', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const eyebite = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'eyebite',
    )
    const eyebiteActivities = eyebite?.activities as readonly Dnd5eActivityDefinitionV1[]
    const casterEffect = eyebiteActivities[0]?.effects?.find((effect) =>
      effect.id === 'eyebite-caster')
    expect(casterEffect?.grants).toEqual(['spell:eyebite:use-gaze'])
    expect(dnd5eActivityAutomationAnalysisV1(
      eyebiteActivities[0],
    ).capability.level).toBe('full')
  })

  it('projects Dispel Evil and Good protection plus both effect-granted actions', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const definition = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'dispel-evil-and-good',
    )
    const activities = definition?.activities as readonly Dnd5eActivityDefinitionV1[]
    const root = activities.find((activity) =>
      activity.id === 'spell:dispel-evil-and-good') as Dnd5eActivityDefinitionV1
    const protection = root.effects?.find((effect) => effect.id === 'dispel-evil-and-good')
    expect(protection?.grants).toEqual([
      'spell:dispel-evil-and-good:break-enchantment',
      'spell:dispel-evil-and-good:dismissal',
    ])
    const breakEnchantment = activities.find((activity) =>
      activity.id === 'spell:dispel-evil-and-good:break-enchantment') as Dnd5eActivityDefinitionV1
    expect(breakEnchantment.outcomes.flatMap((outcome) => outcome.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'remove-standard-condition', condition: 'charmed',
          sourceCreatureTypes: expect.arrayContaining(['fiend', 'undead']),
        }),
        expect.objectContaining({ kind: 'remove-effects-by-tag', tags: ['possessed', 'possession'] }),
      ]),
    )
    expect(dnd5eActivityAutomationAnalysisV1(breakEnchantment).capability.level).toBe('full')
    const dismissal = activities.find((activity) =>
      activity.id === 'spell:dispel-evil-and-good:dismissal') as Dnd5eActivityDefinitionV1
    expect(dismissal.effects?.[0].planarBanishment).toMatchObject({
      foreignDuration: 'permanent', localDurationRounds: 10,
      foreignCreatureTypes: expect.arrayContaining(['celestial', 'elemental', 'fey', 'fiend']),
    })
    expect(dnd5eActivityAutomationAnalysisV1(dismissal).capability.level).toBe('full')
  })

  it('compiles Alarm notification modes and cast-time creature exemptions as Host-owned entry triggers', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const alarm = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'alarm',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(alarm.choices?.[0]).toMatchObject({
      id: 'mode',
      options: [{ id: 'mental' }, { id: 'audible' }],
    })
    const operations = alarm.outcomes.flatMap((outcome) => outcome.operations)
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'create-persistent-area', id: 'alarm-area-mental',
        triggerExemptions: 'selected-creatures',
        triggers: [expect.objectContaining({ notification: { delivery: 'mental-to-source' } })],
      }),
      expect.objectContaining({
        kind: 'create-persistent-area', id: 'alarm-area-audible',
        triggerExemptions: 'selected-creatures',
        triggers: [expect.objectContaining({ notification: { delivery: 'audible', audibleRadiusFeet: 60 } })],
      }),
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(alarm)).toMatchObject({
      capability: { level: 'full' },
      missingComponents: [],
    })
  })

  it('fully models Command modes and keeps other assisted spells deterministic before DM semantics', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const command = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'command',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const zone = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'zone-of-truth',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const silentImage = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'silent-image',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const majorImage = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'major-image',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const antimagicField = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'antimagic-field',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const globe = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'globe-of-invulnerability',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(command).toMatchObject({
      target: { kind: 'creature', rangeFeet: 60, count: 1 },
      automation: { level: 'full' },
    })
    expect(command.checks).toEqual([expect.objectContaining({
      id: 'command-save', kind: 'saving-throw', ability: 'wis', rollMode: 'host-derived',
      scope: 'per-target',
    })])
    expect(command.choices).toEqual([expect.objectContaining({
      id: 'command-mode', defaultOptionId: 'halt',
      options: expect.arrayContaining([
        expect.objectContaining({ id: 'approach' }),
        expect.objectContaining({ id: 'drop' }),
        expect.objectContaining({ id: 'flee' }),
        expect.objectContaining({ id: 'grovel' }),
        expect.objectContaining({ id: 'halt' }),
        expect.objectContaining({ id: 'other' }),
      ]),
    })])
    expect(command.effects).toHaveLength(6)
    expect(command.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'command-grovel', extensionCondition: 'command-grovel',
        tags: ['command-spell', 'command-mode:grovel'],
        duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' },
      }),
    ]))
    expect(command.scaling).toEqual([expect.objectContaining({
      basis: 'slot-level', baseLevel: 1,
      adjustments: expect.arrayContaining([
        expect.objectContaining({ operationId: 'apply-command-halt', additionalTargetsPerStep: 1 }),
      ]),
    })])
    expect(command.outcomes.flatMap((outcome) => outcome.operations)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'manual-adjudication' })]),
    )
    expect(zone).toMatchObject({
      target: { kind: 'area', shape: 'sphere', radiusFeet: 15 },
    })
    expect(zone.checks).toBeUndefined()
    expect(silentImage).toMatchObject({
      target: {
        kind: 'area', shape: 'cube', lengthFeet: 15, widthFeet: 15, heightFeet: 15,
        origin: 'point', placeRangeFeet: 60,
      },
    })
    expect(silentImage.outcomes.flatMap((outcome) => outcome.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'create-persistent-area', id: 'partial-persistent-area',
          label: '无声幻影', durationRounds: 100, concentration: true,
          visual: { preset: 'silent-image', intensity: 'strong' },
        }),
        expect.objectContaining({ kind: 'manual-adjudication', id: 'dm-adjudication' }),
      ]),
    )
    expect(majorImage).toMatchObject({
      target: {
        kind: 'area', shape: 'cube', lengthFeet: 20, widthFeet: 20, heightFeet: 20,
        origin: 'point', placeRangeFeet: 120,
      },
    })
    expect(majorImage.outcomes.flatMap((outcome) => outcome.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'create-persistent-area', id: 'partial-persistent-area',
           label: '高等幻影', durationRounds: 100, concentration: true,
           visual: { preset: 'major-image', intensity: 'strong' },
           movement: {
             economy: 'action', maximumFeet: 240, maximumDistanceFromSourceFeet: 120,
           },
           castLevelProfiles: [{
            minimumCastLevel: 6,
            durationRounds: 5_256_000,
            permanent: true,
            concentration: false,
          }],
        }),
        expect.objectContaining({ kind: 'manual-adjudication', id: 'dm-adjudication' }),
      ]),
    )
    expect(zone.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'create-persistent-area', id: 'partial-persistent-area',
        triggers: [
          expect.objectContaining({
            timing: 'on-enter', oncePerTurn: true,
            savingThrow: expect.objectContaining({ ability: 'cha' }),
          }),
          expect.objectContaining({
            timing: 'turn-start', oncePerTurn: true,
            savingThrow: expect.objectContaining({ ability: 'cha' }),
          }),
        ],
      }),
      expect.objectContaining({ kind: 'manual-adjudication', id: 'dm-adjudication' }),
    ]))
    expect(antimagicField.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'create-persistent-area', id: 'partial-persistent-area',
        occupantModifiers: { suppressesMagic: true },
      }),
      expect.objectContaining({ kind: 'manual-adjudication', id: 'dm-adjudication' }),
    ]))
    expect(globe.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'create-persistent-area', id: 'partial-persistent-area',
        anchorMode: 'fixed',
        occupantModifiers: { suppressesSpellsThroughLevel: 5 },
        castLevelProfiles: [
          expect.objectContaining({ minimumCastLevel: 7, occupantModifiers: { suppressesSpellsThroughLevel: 6 } }),
          expect.objectContaining({ minimumCastLevel: 8, occupantModifiers: { suppressesSpellsThroughLevel: 7 } }),
          expect.objectContaining({ minimumCastLevel: 9, occupantModifiers: { suppressesSpellsThroughLevel: 8 } }),
        ],
      }),
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(command).capability.level).toBe('full')
    expect(dnd5eActivityAutomationAnalysisV1(zone).capability.level).toBe('assisted')
    expect(dnd5eActivityAutomationAnalysisV1(silentImage).capability.level).toBe('assisted')
    expect(dnd5eActivityAutomationAnalysisV1(antimagicField).capability.level).toBe('assisted')
  })

  it('removes creature-bound curses and breaks cursed-item attunement through inventory authority', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const removeCurse = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'remove-curse',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(removeCurse.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual({
      id: 'remove-curse-effect', kind: 'remove-effects-by-tag', target: 'all-targets',
      tags: ['curse'], match: 'any', source: 'any', maximumCount: 1,
    })
    expect(dnd5eActivityAutomationAnalysisV1(removeCurse)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
    const definition = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'remove-curse',
    )!
    expect(definition.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'spell:remove-curse:cursed-item',
        outcomes: [expect.objectContaining({ operations: [expect.objectContaining({
          kind: 'break-inventory-item-attunement', requireCursedMagicItem: true,
        })] })],
      }),
    ]))
  })

  it('models domination saves, charm immunity, and damage retries before the semantic command handoff', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    for (const spellId of ['dominate-beast', 'dominate-person', 'dominate-monster']) {
      const activity = getRegisteredContentDefinition(
        DND5E_CORE_SPELL_PACKAGE_ID, 'spell', spellId,
      )?.activities?.[0] as Dnd5eActivityDefinitionV1
      expect(activity.checks?.[0]).toMatchObject({
        kind: 'saving-throw', ability: 'wis', automaticSuccessIfConditionImmune: 'charmed',
      })
      expect(activity.effects?.[0]).toMatchObject({
        conditions: ['charmed'],
        repeatSaveOnDamage: { ability: 'wis', mode: 'normal', sourceFilter: 'any' },
      })
      expect(activity.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'apply-effect', target: 'target' }),
        expect.objectContaining({ kind: 'manual-adjudication', requiresDmApproval: true }),
      ]))
      expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('assisted')
    }
  })

  it('uses the generic Host hearing predicate for Enthrall instead of an inert rule marker', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const enthrall = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'enthrall',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(enthrall.requirements).toContainEqual({ kind: 'can-hear-source' })
    expect(enthrall.outcomes.flatMap((outcome) => outcome.operations)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'mechanic' })]),
    )
    expect(dnd5eActivityAutomationAnalysisV1(enthrall)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('keeps Animal Friendship hearing, Intelligence and higher-slot target scaling authoritative', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const spell = dnd5ePluginSpellDefinition('animal-friendship')!
    const activity = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'animal-friendship',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(spell.higherLevels).toContain('每比 1 环高一环')
    expect(dnd5ePluginSpellTargetCapacity(spell, 1)).toEqual({
      maximumTargets: 1, allowDuplicateTargets: false,
    })
    expect(dnd5ePluginSpellTargetCapacity(spell, 3)).toEqual({
      maximumTargets: 3, allowDuplicateTargets: false,
    })
    expect(activity.requirements).toEqual(expect.arrayContaining([
      { kind: 'creature-type', subject: 'target', types: ['beast', '野兽'] },
      { kind: 'ability-score', subject: 'target', ability: 'int', comparison: 'below', value: 4 },
      { kind: 'can-hear-source' },
    ]))
    expect(activity.scaling).toEqual(expect.arrayContaining([
      expect.objectContaining({
        basis: 'slot-level',
        baseLevel: 1,
        adjustments: [expect.objectContaining({
          operationId: 'apply-concrete-effect',
          additionalTargetsPerStep: 1,
        })],
      }),
    ]))
    expect(activity.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'apply-concrete-effect',
        kind: 'apply-effect',
        target: 'target',
        effectId: 'animal-friendship',
      }),
    ]))
  })

  it('allows Beacon of Hope to select any number of allied creatures in range', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const spell = dnd5ePluginSpellDefinition('beacon-of-hope')
    const activity = dnd5ePluginSpellActivity(spell)

    expect(activity?.target).toEqual(expect.objectContaining({
      kind: 'creature', relation: 'ally', includeSelf: true, count: 256,
    }))
  })

  it('models Bestow Curse standard modes and its 3rd/5th-level duration boundary', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const spell = dnd5ePluginSpellDefinition('bestow-curse')
    const activity = dnd5ePluginSpellActivity(spell)
    expect(activity).toBeDefined()
    if (!activity) return
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.target).toMatchObject({
      kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5,
    })
    expect(activity.choices?.find((choice) => choice.id === 'mode')?.options.map((option) => option.id))
      .toEqual(['ability', 'attacks-against-source', 'lose-action', 'source-bonus-damage', 'other'])
    const damageEffect = activity.effects?.find(
      (effect) => effect.id === 'bestow-curse-source-bonus-damage',
    )
    expect(damageEffect?.tags).toEqual(
      expect.arrayContaining(['curse', 'bestow-curse', 'bestow-curse.source-bonus-damage']),
    )
    expect(damageEffect?.exclusiveGroup).toBeUndefined()
    const damageOutcome = activity.outcomes.find(
      (outcome) => outcome.id === 'bestow-curse-source-bonus-damage',
    )
    expect(damageOutcome?.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'remove-effects-by-tag', target: 'target', tags: ['bestow-curse'],
        match: 'any', source: 'self',
      }),
      expect.objectContaining({
        kind: 'apply-effect', target: 'target', effectId: 'bestow-curse-source-bonus-damage',
      }),
    ]))
    expect(damageEffect?.castLevelProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ minimumCastLevel: 3, concentration: true }),
        expect.objectContaining({
          minimumCastLevel: 5,
          concentration: false,
          duration: expect.objectContaining({ kind: 'rounds', rounds: 4_800 }),
        }),
      ]),
    )

    const actor: Dnd5eActivityActorSnapshot = {
      id: 'caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 20, cha: 10 },
      armorClass: 18, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
    }
    const target: Dnd5eActivityActorSnapshot = {
      id: 'target', controller: 'dm', level: 5, proficiencyBonus: 3,
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8 },
      armorClass: 13, conditions: [], currentHp: 50, maxHp: 50,
      savingThrowModifiers: { wis: 0 },
    }
    const resolveAt = (castLevel: number) => resolveDnd5eActivity({
      activity, actor, targets: [target], castLevel,
      distanceFeetByTargetId: { target: 5 },
      rolls: { 'bestow-curse-save:target': { values: [1] } },
      checkRollModes: { 'spell-save:target': 'normal' },
      choices: { mode: 'source-bonus-damage', ability: 'wis' },
    })
    const third = resolveAt(3)
    const fifth = resolveAt(5)
    expect(third).toMatchObject({ ok: true })
    expect(fifth).toMatchObject({ ok: true })
    expect(third.ok && third.proposals).toContainEqual(expect.objectContaining({
      kind: 'apply-effect', concentration: true,
      duration: { kind: 'concentration', maximumRounds: 10 },
    }))
    expect(fifth.ok && fifth.proposals).toContainEqual(expect.objectContaining({
      kind: 'apply-effect', concentration: false,
      duration: expect.objectContaining({ kind: 'rounds', rounds: 4_800 }),
    }))
  })

  it('models Geas comprehension, nonlinear upcast durations, daily damage and caster dismissal', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const definition = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'geas',
    )
    const activity = definition?.activities?.find((entry) =>
      (entry as Dnd5eActivityDefinitionV1).id === 'spell:geas') as Dnd5eActivityDefinitionV1
    const violation = definition?.activities?.find((entry) =>
      (entry as Dnd5eActivityDefinitionV1).id === 'spell:geas:violate-command') as Dnd5eActivityDefinitionV1
    const dismiss = definition?.activities?.find((entry) =>
      (entry as Dnd5eActivityDefinitionV1).id === 'spell:geas:dismiss') as Dnd5eActivityDefinitionV1

    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(validateDnd5eActivityDefinitionV1(violation)).toEqual([])
    expect(validateDnd5eActivityDefinitionV1(dismiss)).toEqual([])
    expect(activity).toMatchObject({
      activation: { kind: 'minute', value: 1 },
      target: {
        kind: 'creature', relation: 'any', rangeFeet: 60, count: 1,
        requiresLineOfSight: true, requiresLineOfEffect: true,
      },
      checks: [expect.objectContaining({
        id: 'geas-save', ability: 'wis', automaticSuccessIfConditionImmune: 'charmed',
        appliesWhenChoice: { choiceId: 'target-response', optionIds: ['understands'] },
      })],
    })
    expect(activity.choices?.find((choice) => choice.id === 'target-response')?.options.map((option) => option.id))
      .toEqual(['understands', 'cannot-understand', 'certain-death'])
    const geasEffect = activity.effects?.find((effect) => effect.id === 'geas-charmed')
    expect(geasEffect).toMatchObject({
      tags: expect.arrayContaining(['charm', 'curse', 'command', 'geas']),
      conditions: ['charmed'],
      grants: ['spell:geas:violate-command'],
      castLevelProfiles: [{
        minimumCastLevel: 5,
        duration: { kind: 'rounds', rounds: 432_000, expiresAt: 'target-turn-end' },
        concentration: false,
      }, {
        minimumCastLevel: 7,
        duration: { kind: 'rounds', rounds: 5_256_000, expiresAt: 'target-turn-end' },
        concentration: false,
      }, {
        minimumCastLevel: 9,
        duration: { kind: 'permanent' },
        concentration: false,
      }],
    })
    expect(activity.effects?.find((effect) => effect.id === 'geas-caster-controller')).toMatchObject({
      grants: ['spell:geas:dismiss'], stacking: 'stack',
    })
    expect(violation).toMatchObject({
      activation: { kind: 'free', cost: 0 }, target: { kind: 'self' },
      requirements: expect.arrayContaining([
        expect.objectContaining({ effectId: 'geas-charmed', present: true }),
        expect.objectContaining({ effectId: 'geas-daily-damage-lock', present: false }),
      ]),
      effects: [expect.objectContaining({
        id: 'geas-daily-damage-lock',
        duration: { kind: 'rounds', rounds: 14_400, expiresAt: 'target-turn-end' },
      })],
    })
    expect(violation.outcomes.flatMap((outcome) => outcome.operations)).toEqual([
      expect.objectContaining({ kind: 'manual-adjudication', requiresDmApproval: true }),
      expect.objectContaining({
        kind: 'damage', target: 'actor',
        amount: { kind: 'dice', rollId: 'geas-violation-damage', count: 5, sides: 10 },
        damageType: 'psychic', magical: true,
      }),
      expect.objectContaining({
        kind: 'apply-effect', target: 'actor', effectId: 'geas-daily-damage-lock',
      }),
    ])
    expect(dismiss).toMatchObject({
      activation: { kind: 'action', cost: 1 },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
      requirements: [expect.objectContaining({
        subject: 'target', effectId: 'geas-charmed', present: true, source: 'self',
      })],
      outcomes: [expect.objectContaining({ operations: [expect.objectContaining({
        kind: 'remove-effect', target: 'target', effectId: 'geas-charmed', source: 'self',
      })] })],
    })

    const actor: Dnd5eActivityActorSnapshot = {
      id: 'caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
      armorClass: 15, conditions: [], currentHp: 80, maxHp: 80, spellSaveDc: 19,
    }
    const target: Dnd5eActivityActorSnapshot = {
      id: 'target', controller: 'dm', level: 8, proficiencyBonus: 3,
      abilities: { str: 12, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      armorClass: 14, conditions: [], currentHp: 70, maxHp: 70,
      savingThrowModifiers: { wis: 0 },
    }
    const resolveAt = (castLevel: number) => resolveDnd5eActivity({
      activity, actor, targets: [target], castLevel,
      distanceFeetByTargetId: { target: 30 },
      rolls: { 'geas-save-d20:target': { values: [1] } },
      checkRollModes: { 'geas-save:target': 'normal' },
      choices: { 'target-response': 'understands' },
    })
    for (const [castLevel, duration] of [
      [5, { kind: 'rounds', rounds: 432_000 }],
      [7, { kind: 'rounds', rounds: 5_256_000 }],
      [9, { kind: 'permanent' }],
    ] as const) {
      const result = resolveAt(castLevel)
      expect(result).toMatchObject({ ok: true })
      expect(result.ok && result.proposals).toContainEqual(expect.objectContaining({
        kind: 'apply-effect', effectId: 'geas-charmed', concentration: false,
        duration: expect.objectContaining(duration),
      }))
    }

    const unaffected = resolveDnd5eActivity({
      activity, actor, targets: [target], castLevel: 5,
      distanceFeetByTargetId: { target: 30 },
      rolls: {}, checkRollModes: {}, choices: { 'target-response': 'cannot-understand' },
    })
    expect(unaffected).toMatchObject({ ok: true })
    expect(unaffected.ok && unaffected.proposals).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'apply-effect', effectId: 'geas-charmed' }),
    ]))
  })

  it('models Feeblemind damage, durable restrictions and the 30-day repeat save', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const feeblemind = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'feeblemind',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const operations = feeblemind.outcomes.flatMap((outcome) => outcome.operations)
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'damage', id: 'feeblemind-damage' }),
      expect.objectContaining({ kind: 'lower-ability-score', ability: 'int', recoveryGroupId: 'spell.feeblemind' }),
      expect.objectContaining({ kind: 'lower-ability-score', ability: 'cha', recoveryGroupId: 'spell.feeblemind' }),
      expect.objectContaining({ kind: 'apply-effect', effectId: 'feeblemind' }),
    ]))
    expect(feeblemind.effects?.[0]).toMatchObject({
      calendarRepeatSave: {
        intervalMinutes: 43_200,
        ability: 'int',
        onSuccess: 'remove',
      },
      modifiers: expect.arrayContaining([
        expect.objectContaining({ kind: 'language-restriction' }),
      ]),
    })
    expect(dnd5eActivityAutomationAnalysisV1(feeblemind)).toMatchObject({
      capability: { level: 'full' },
      missingComponents: [],
    })
  })

  it('models Mirror Image as a Host-owned attack-decoy pool', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const mirrorImage = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'mirror-image',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(mirrorImage.effects?.[0]).toMatchObject({
      id: 'mirror-image',
      modifiers: [{
        kind: 'attack-decoys',
        count: 3,
        redirectMinimumD20: [11, 8, 6],
        armorClassBase: 10,
        armorClassAbility: 'dex',
        requiresOrdinarySight: true,
      }],
      removalAction: {
        label: '解除镜影术',
        economy: 'action',
        maxDistanceFeet: 0,
      },
    })
    expect(dnd5eActivityAutomationAnalysisV1(mirrorImage)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('applies Etherealness and uses exact self / 3 / 6 slot-level target profiles', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const etherealness = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'etherealness',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(validateDnd5eActivityDefinitionV1(etherealness)).toEqual([])
    expect(dnd5eActivityAutomationAnalysisV1(etherealness)).toMatchObject({
      capability: { level: 'assisted' },
    })
    expect(dnd5eActivityAutomationAnalysisV1(etherealness).missingComponents.length).toBeGreaterThan(0)
    expect(etherealness.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'manual-adjudication',
        reason: '返回重叠位移与非相邻位面状态仍需 DM 场景裁定。',
      }),
    )
    expect(etherealness.target).toEqual({ kind: 'self' })
    const actor = { level: 20, proficiencyBonus: 6 }
    expect(scaleDnd5eActivityDefinitionV1(etherealness, { actor, castLevel: 7 }).activity.target)
      .toEqual({ kind: 'self' })
    expect(scaleDnd5eActivityDefinitionV1(etherealness, { actor, castLevel: 8 }).activity.target)
      .toMatchObject({ kind: 'creature', relation: 'ally', rangeFeet: 10, count: 3, includeSelf: true })
    expect(scaleDnd5eActivityDefinitionV1(etherealness, { actor, castLevel: 9 }).activity.target)
      .toMatchObject({ kind: 'creature', relation: 'ally', rangeFeet: 10, count: 6, includeSelf: true })
    expect(etherealness.effects).toContainEqual(expect.objectContaining({
      id: 'etherealness',
      duration: { kind: 'rounds', rounds: 4_800, expiresAt: 'target-turn-end' },
      modifiers: [expect.objectContaining({
        kind: 'planar-phase', plane: 'ethereal', ignoresMaterialCollision: true,
        suppressCrossPlaneEffects: true, unrestrictedVerticalMovement: true,
      })],
      removalAction: { label: '解除以太化', economy: 'action', maxDistanceFeet: 0 },
    }))

    const caster: Dnd5eActivityActorSnapshot = {
      id: 'ethereal-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
      armorClass: 12, conditions: [], currentHp: 100, maxHp: 100,
    }
    const ally = (id: string): Dnd5eActivityActorSnapshot => ({
      ...caster, id, controller: 'players', activeEffectDefinitionIds: [],
    })
    const base = resolveDnd5eActivity({
      activity: etherealness, actor: caster, targets: [caster], castLevel: 7,
      rolls: {}, dmApproved: true,
    })
    expect(base).toMatchObject({ ok: true, status: 'dm-adjudication-required' })
    expect(base.ok && base.proposals).toContainEqual(expect.objectContaining({
      kind: 'apply-effect', effectId: 'etherealness', targetId: caster.id,
      duration: { kind: 'rounds', rounds: 4_800, expiresAt: 'target-turn-end' },
      removalAction: { label: '解除以太化', economy: 'action', maxDistanceFeet: 0 },
    }))

    const upcastTargets = [ally('ally-1'), ally('ally-2'), ally('ally-3')]
    const upcast = resolveDnd5eActivity({
      activity: etherealness, actor: caster, targets: upcastTargets, castLevel: 8,
      rolls: {}, dmApproved: true,
      distanceFeetByTargetId: Object.fromEntries(upcastTargets.map((target) => [target.id, 10])),
    })
    expect(upcast.ok && upcast.proposals.filter((proposal) => proposal.kind === 'apply-effect'))
      .toHaveLength(3)
    expect(resolveDnd5eActivity({
      activity: etherealness, actor: caster,
      targets: [...upcastTargets, ally('ally-4')], castLevel: 8,
      rolls: {}, dmApproved: true,
      distanceFeetByTargetId: {
        'ally-1': 10, 'ally-2': 10, 'ally-3': 10, 'ally-4': 10,
      },
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(resolveDnd5eActivity({
      activity: etherealness, actor: caster, targets: [ally('far-ally')], castLevel: 8,
      rolls: {}, dmApproved: true, distanceFeetByTargetId: { 'far-ally': 15 },
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const alreadyEtherealCaster: Dnd5eActivityActorSnapshot = {
      ...caster,
      activeEffectDefinitionIds: [{ definitionId: 'activity:spell:etherealness:etherealness' }],
    }
    const noEffect = resolveDnd5eActivity({
      activity: etherealness, actor: alreadyEtherealCaster,
      targets: [alreadyEtherealCaster], castLevel: 7, rolls: {}, dmApproved: true,
    })
    expect(noEffect.ok && noEffect.proposals.some((proposal) => proposal.kind === 'apply-effect')).toBe(false)
  })

  it('models Tiny Hut as a fixed Host-authorized boundary instead of a manual rule marker', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const tinyHut = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'tiny-hut',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(tinyHut.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area',
        anchorMode: 'fixed',
        sourceExitBehavior: 'remove-area',
        creationConstraints: { maximumCreatureCount: 10, maximumCreatureSizeRank: 2 },
        blocking: expect.objectContaining({
          movementMode: 'enter',
          entryPermission: 'occupants-at-creation',
          blocksTeleportationEntry: true,
          visionMode: 'outside-in',
          lineOfEffectMode: 'boundary',
        }),
      }),
    )
    expect(dnd5eActivityAutomationAnalysisV1(tinyHut)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Arcane Eye as a movable Host sensor with source-only shared vision', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const arcaneEye = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'arcane-eye',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(arcaneEye.target).toEqual(expect.objectContaining({
      kind: 'area', origin: 'point', placeRangeFeet: 30,
    }))
    expect(arcaneEye.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area',
        movement: { economy: 'action', maximumFeet: 30 },
        effectToken: expect.objectContaining({
          hiddenBody: true,
          shareVisionWithSource: true,
          darkvisionRangeFeet: 30,
        }),
      }),
    )
    expect(dnd5eActivityAutomationAnalysisV1(arcaneEye)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Unseen Servant as an unoccupied, bounded movable spell entity', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const unseenServant = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'unseen-servant',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(unseenServant.target).toEqual(expect.objectContaining({
      kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 60,
      lengthFeet: 5, widthFeet: 5, heightFeet: 5, maximumTargets: 1,
    }))
    expect(unseenServant.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area', durationRounds: 600, concentration: false,
        visual: { preset: 'unseen-servant', intensity: 'strong' },
        creationConstraints: { maximumCreatureCount: 0 },
        movement: {
          economy: 'bonus-action', maximumFeet: 15, maximumDistanceFromSourceFeet: 60,
          endWhenExceedingSourceDistance: true,
        },
        entityProfile: {
          armorClass: 10, hitPoints: 1, strength: 2,
          cannotAttack: true, invisible: true,
        },
        effectToken: expect.objectContaining({ hiddenBody: true }),
      }),
    )
    expect(dnd5eActivityManualAdjudicationOperationsV1(unseenServant)).toEqual([])
    expect(dnd5eActivityAutomationAnalysisV1(unseenServant).capability.level).toBe('full')
    expect(dnd5ePluginSpellHasFullHeadlessAutomation(dnd5ePluginSpellDefinition('unseen-servant'))).toBe(true)
  })

  it('lazily exposes audited Activity targets to the live player map', () => {
    clearContentDefinitionRegistryForTests()
    const spell = dnd5ePluginSpellDefinition('unseen-servant')
    expect(dnd5ePluginSpellActivity(spell)?.target).toMatchObject({
      kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 60,
      lengthFeet: 5, widthFeet: 5, heightFeet: 5,
    })
  })

  it('keeps Magic Mouth as an explicit DM-adjudicated spell without a synthetic map area', () => {
    clearContentDefinitionRegistryForTests()
    const spell = dnd5ePluginSpellDefinition('magic-mouth')
    const magicMouth = dnd5ePluginSpellActivity(spell)
    expect(magicMouth).toMatchObject({
      target: { kind: 'self' },
      automation: { level: 'assisted' },
    })
    expect(magicMouth?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'manual-adjudication',
        requiresDmApproval: true,
      }),
    )
  })

  it('keeps Control Water off the creature picker while exposing its four environment modes to the table', () => {
    clearContentDefinitionRegistryForTests()
    const spell = dnd5ePluginSpellDefinition('control-water')
    const controlWater = dnd5ePluginSpellActivity(spell)

    expect(controlWater).toMatchObject({
      target: { kind: 'self' },
      automation: { level: 'assisted' },
    })
    expect(controlWater?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        id: 'control-water-dm-adjudication',
        kind: 'manual-adjudication',
        requiresDmApproval: true,
      }),
    )
  })

  it('keeps Control Weather off map targeting while retaining its table-owned weather declaration', () => {
    clearContentDefinitionRegistryForTests()
    const spell = dnd5ePluginSpellDefinition('control-weather')
    const controlWeather = dnd5ePluginSpellActivity(spell)

    expect(controlWeather).toMatchObject({
      target: { kind: 'self' },
      automation: { level: 'full' },
    })
    expect(controlWeather?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        id: 'control-weather-voice-declaration',
        kind: 'mechanic',
        target: 'actor',
      }),
    )
  })

  it('models Antipathy/Sympathy for creature or area targets without object automation', () => {
    clearContentDefinitionRegistryForTests()
    const spell = dnd5ePluginSpellDefinition('antipathy-sympathy')
    const activity = dnd5ePluginSpellActivity(spell)

    expect(activity?.choices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'mode',
        options: expect.arrayContaining([
          expect.objectContaining({ id: 'antipathy' }),
          expect.objectContaining({ id: 'sympathy' }),
        ]),
      }),
      expect.objectContaining({
        id: 'target-form',
        options: expect.arrayContaining([
          expect.objectContaining({ id: 'creature' }),
          expect.objectContaining({
            id: 'area',
            targetOverride: expect.objectContaining({
              kind: 'area', shape: 'cube', placeRangeFeet: 60,
              lengthFeet: 200, widthFeet: 200, heightFeet: 200,
              minimumLengthFeet: 5, minimumWidthFeet: 5, minimumHeightFeet: 5,
            }),
          }),
        ]),
      }),
    ]))
    expect(activity?.choices?.find((choice) => choice.id === 'target-form')?.options
      .map((option) => option.id)).toEqual(['creature', 'area'])
    expect(activity?.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'create-persistent-area', durationRounds: 144_000, concentration: false,
      }),
      expect.objectContaining({ kind: 'manual-adjudication', requiresDmApproval: true }),
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(activity!)).toMatchObject({
      capability: { level: 'assisted' },
    })
  })

  it('models Arcane Sword as a persistent entity with a granted move-and-attack Activity', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const definition = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'arcane-sword',
    )
    const arcaneSword = definition?.activities?.find((entry) =>
      (entry as Dnd5eActivityDefinitionV1).id === 'spell:arcane-sword') as Dnd5eActivityDefinitionV1
    const repeatAttack = definition?.activities?.find((entry) =>
      (entry as Dnd5eActivityDefinitionV1).id === 'spell:arcane-sword:attack') as Dnd5eActivityDefinitionV1

    expect(arcaneSword.target).toEqual(expect.objectContaining({
      kind: 'area', origin: 'point', placeRangeFeet: 60, radiusFeet: 5, maximumTargets: 1,
    }))
    expect(arcaneSword.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'create-persistent-area', anchorMode: 'fixed',
        grantedActivities: [{
          activityId: 'spell:arcane-sword:attack', label: '奥术之剑·移动并攻击',
        }],
      }),
      expect.objectContaining({
        kind: 'damage', amount: expect.objectContaining({ count: 3, sides: 10 }),
        damageType: 'force', critical: 'double-dice',
      }),
    ]))
    expect(repeatAttack).toMatchObject({
      activation: { kind: 'bonus-action', cost: 1 },
      checks: [expect.objectContaining({ kind: 'attack-roll' })],
    })
    expect(repeatAttack.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'relocate-granting-area', target: 'target', maximumFeet: { kind: 'constant', value: 20 },
      }),
      expect.objectContaining({ kind: 'damage', damageType: 'force' }),
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(arcaneSword)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
    expect(dnd5eActivityAutomationAnalysisV1(repeatAttack)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
    expect(dnd5ePluginFeatureDefinition(
      `${DND5E_CORE_SPELL_PACKAGE_ID}:area-control.spell:arcane-sword:attack`,
    )?.action).toMatchObject({
      id: 'spell:arcane-sword:attack', economy: 'bonusAction',
      targeting: { kind: 'single-creature', rangeFeet: 60 },
    })
  })

  it('models Faithful Hound as a source-only entity with a once-per-turn bite Activity', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const definition = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'faithful-hound',
    )
    const activities = definition?.activities as readonly Dnd5eActivityDefinitionV1[]
    const root = activities.find((activity) => activity.id === 'spell:faithful-hound')!
    const entity = root.outcomes.flatMap((outcome) => outcome.operations).find((operation) =>
      operation.kind === 'create-persistent-area')
    expect(entity).toMatchObject({
      effectToken: { visibleToSourceOnly: true },
      grantedActivities: [{ activityId: 'spell:faithful-hound:bite' }],
    })
    const bite = activities.find((activity) => activity.id === 'spell:faithful-hound:bite')!
    expect(bite.requirements).toContainEqual({ kind: 'once-per-turn', key: 'faithful-hound-bite' })
    expect(bite.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({ kind: 'damage', damageType: 'piercing' }),
    )
    expect(dnd5eActivityAutomationAnalysisV1(root).capability.level).toBe('full')
    expect(dnd5eActivityAutomationAnalysisV1(bite).capability.level).toBe('full')
  })

  it('models Passwall as a bounded fixed map passage instead of a rule marker', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const passwall = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'passwall',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(passwall.target).toEqual(expect.objectContaining({
      kind: 'area', origin: 'point', shape: 'rect', placeRangeFeet: 30,
      lengthFeet: 20, widthFeet: 5, heightFeet: 8, rotatable: true,
      maximumTargets: 256, includeSelf: true,
    }))
    expect(passwall.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area', anchorMode: 'fixed', durationRounds: 600,
        blocking: { suppressesMappedBarriers: true },
      }),
    )
    expect(dnd5eActivityAutomationAnalysisV1(passwall)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Antilife Shell as a moving typed ward that ends on forced overlap', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const shell = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'antilife-shell',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(shell.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area',
        anchorMode: 'source-token',
        sourceOverlapBehavior: 'remove-area',
        blocking: expect.objectContaining({
          movement: true,
          movementMode: 'enter',
          excludedCreatureTypes: ['construct', 'undead'],
          excludeSourceToken: true,
        }),
      }),
    )
    expect(dnd5eActivityAutomationAnalysisV1(shell)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models both Forcecage templates with a Host-owned teleport exit save', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const forcecage = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'forcecage',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const mode = forcecage.choices?.find((choice) => choice.id === 'mode')
    expect(mode?.options).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'cage',
        targetOverride: expect.objectContaining({
          kind: 'area', shape: 'cube', lengthFeet: 20, widthFeet: 20, heightFeet: 20,
        }),
      }),
      expect.objectContaining({
        id: 'box',
        targetOverride: expect.objectContaining({
          kind: 'area', shape: 'cube', lengthFeet: 10, widthFeet: 10, heightFeet: 10,
        }),
      }),
    ]))
    const cage = forcecage.outcomes.find((outcome) => outcome.id === 'mode-cage')
      ?.operations.find((operation) => operation.kind === 'create-persistent-area')
    const box = forcecage.outcomes.find((outcome) => outcome.id === 'mode-box')
      ?.operations.find((operation) => operation.kind === 'create-persistent-area')
    expect(cage).toEqual(expect.objectContaining({
      blocking: { movement: true, movementMode: 'boundary' },
      teleportationExitSavingThrow: { ability: 'cha', dc: 'source-save-dc' },
    }))
    expect(box).toEqual(expect.objectContaining({
      blocking: expect.objectContaining({
        movementMode: 'boundary', lineOfEffectMode: 'boundary',
      }),
      teleportationExitSavingThrow: { ability: 'cha', dc: 'source-save-dc' },
    }))
    expect(dnd5eActivityAutomationAnalysisV1(forcecage)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('summons Phantom Steed with its real speed and delayed damage dismissal', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const phantomSteed = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'phantom-steed',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(phantomSteed.target).toEqual({ kind: 'self' })
    expect(phantomSteed.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'summon', monsterId: 'srd-5.1:riding-horse',
        durationRounds: 600,
        walkingSpeedFeet: { kind: 'constant', value: 100 },
        dismissAfterDamageRounds: 10,
      }),
    )
    expect(dnd5eActivityAutomationAnalysisV1(phantomSteed)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Conjure Celestial as a DM-owned catalogue choice on an empty 90-foot placement', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const conjureCelestial = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'conjure-celestial',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(conjureCelestial.target).toMatchObject({
      kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 90,
      lengthFeet: 5, widthFeet: 5, heightFeet: 5,
    })
    const options = conjureCelestial.choices?.find((choice) => choice.id === 'mode')?.options ?? []
    expect(options.map((option) => option.id)).toEqual(expect.arrayContaining([
      'srd-5.1:pegasus', 'srd-5.1:couatl', 'srd-5.1:unicorn',
    ]))
    expect(dnd5eConjureCelestialChoicesAtSlotV1(7).map((option) => option.id))
      .not.toContain('srd-5.1:unicorn')
    expect(dnd5eConjureCelestialChoicesAtSlotV1(9).map((option) => option.id))
      .toContain('srd-5.1:unicorn')
    expect(conjureCelestial.outcomes.flatMap((outcome) => outcome.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'summon', monsterId: 'srd-5.1:couatl', count: { kind: 'constant', value: 1 },
          durationRounds: 600, concentration: true, side: 'ally',
        }),
        expect.objectContaining({ kind: 'summon', monsterId: 'srd-5.1:unicorn' }),
      ]),
    )
    expect(dnd5eActivityAutomationAnalysisV1(conjureCelestial)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Conjure Elemental as a slot-bounded summon whose control ends with concentration', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const conjureElemental = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'conjure-elemental',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(conjureElemental.target).toMatchObject({
      kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 90,
      lengthFeet: 10, widthFeet: 10, heightFeet: 10,
    })
    expect(dnd5eConjureElementalChoicesAtSlotV1(5).map((option) => option.id))
      .not.toContain('srd-5.1:invisible-stalker')
    expect(dnd5eConjureElementalChoicesAtSlotV1(6).map((option) => option.id))
      .toContain('srd-5.1:invisible-stalker')
    expect(conjureElemental.outcomes.flatMap((outcome) => outcome.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'summon', monsterId: 'srd-5.1:fire-elemental',
          durationRounds: 600, concentration: true, side: 'ally',
          becomesHostileAfterConcentrationEnds: true,
        }),
        expect.objectContaining({ kind: 'summon', monsterId: 'srd-5.1:invisible-stalker' }),
      ]),
    )
    expect(dnd5eActivityAutomationAnalysisV1(conjureElemental)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Conjure Fey as a slot-bounded Fey or Beast-form spirit that turns hostile', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const conjureFey = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'conjure-fey',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(conjureFey.target).toMatchObject({
      kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 90,
      lengthFeet: 5, widthFeet: 5, heightFeet: 5,
    })
    const modeIds = conjureFey.choices?.find((choice) => choice.id === 'mode')?.options
      .map((option) => option.id) ?? []
    expect(modeIds).toEqual(expect.arrayContaining([
      'srd-5.1:green-hag', 'srd-5.1:mammoth', 'srd-5.1:giant-ape',
    ]))
    expect(dnd5eConjureFeyChoicesAtSlotV1(6).map((option) => option.id))
      .not.toContain('srd-5.1:giant-ape')
    expect(dnd5eConjureFeyChoicesAtSlotV1(7).map((option) => option.id))
      .toContain('srd-5.1:giant-ape')
    expect(conjureFey.outcomes.flatMap((outcome) => outcome.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'summon', monsterId: 'srd-5.1:mammoth',
          durationRounds: 600, concentration: true, side: 'ally',
          becomesHostileAfterConcentrationEnds: true,
        }),
        expect.objectContaining({ kind: 'summon', monsterId: 'srd-5.1:giant-ape' }),
      ]),
    )
    expect(dnd5eActivityAutomationAnalysisV1(conjureFey)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Conjure Minor Elementals count/CR formations and discrete upcast multipliers', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const conjureMinorElementals = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'conjure-minor-elementals',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(conjureMinorElementals.target).toMatchObject({
      kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 90,
      lengthFeet: 5, widthFeet: 5, heightFeet: 5,
    })
    expect(conjureMinorElementals.choices?.find((choice) => choice.id === 'formation')?.options
      .map((option) => option.id)).toEqual([
        'one-cr-2', 'two-cr-1', 'four-cr-half', 'eight-cr-quarter',
      ])
    expect(dnd5eConjureMinorElementalChoicesForFormationV1('one-cr-2')
      .map((option) => option.id)).toContain('srd-5.1:azer')
    expect(dnd5eConjureMinorElementalChoicesForFormationV1('two-cr-1')
      .map((option) => option.id)).not.toContain('srd-5.1:azer')

    const actor: Dnd5eActivityActorSnapshot = {
      id: 'minor-elementals-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 10, dex: 10, con: 14, int: 20, wis: 20, cha: 10 },
      armorClass: 14, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
    }
    const resolveAt = (castLevel: number) => resolveDnd5eActivity({
      activity: conjureMinorElementals, actor, targets: [], castLevel,
      areaPlacement: { x: 0, y: 0 }, areaPlacementDistanceFeet: 30, rolls: {},
      choices: { formation: 'one-cr-2', mode: 'srd-5.1:azer' },
    })
    const fourth = resolveAt(4)
    const sixth = resolveAt(6)
    const eighth = resolveAt(8)
    expect(fourth).toMatchObject({ ok: true, proposals: [expect.objectContaining({
      kind: 'summon', monsterId: 'srd-5.1:azer', count: 1,
      durationRounds: 600, concentration: true, side: 'ally',
    })] })
    expect(sixth).toMatchObject({ ok: true, proposals: [expect.objectContaining({ count: 2 })] })
    expect(eighth).toMatchObject({ ok: true, proposals: [expect.objectContaining({ count: 3 })] })
    expect(dnd5eActivityAutomationAnalysisV1(conjureMinorElementals)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Conjure Woodland Beings count/CR formations and discrete upcast multipliers', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const conjureWoodlandBeings = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'conjure-woodland-beings',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(conjureWoodlandBeings.target).toMatchObject({
      kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 60,
      lengthFeet: 5, widthFeet: 5, heightFeet: 5,
    })
    expect(conjureWoodlandBeings.choices?.find((choice) => choice.id === 'formation')?.options
      .map((option) => option.id)).toEqual([
        'one-cr-2', 'two-cr-1', 'four-cr-half', 'eight-cr-quarter',
      ])
    expect(dnd5eConjureWoodlandBeingChoicesForFormationV1('one-cr-2')
      .map((option) => option.id)).toContain('srd-5.1:sea-hag')
    expect(dnd5eConjureWoodlandBeingChoicesForFormationV1('two-cr-1')
      .map((option) => option.id)).not.toContain('srd-5.1:sea-hag')

    const actor: Dnd5eActivityActorSnapshot = {
      id: 'woodland-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 10, dex: 10, con: 14, int: 20, wis: 20, cha: 10 },
      armorClass: 14, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
    }
    const resolveAt = (castLevel: number) => resolveDnd5eActivity({
      activity: conjureWoodlandBeings, actor, targets: [], castLevel,
      areaPlacement: { x: 0, y: 0 }, areaPlacementDistanceFeet: 30, rolls: {},
      choices: { formation: 'one-cr-2', mode: 'srd-5.1:sea-hag' },
    })
    expect(resolveAt(4)).toMatchObject({ ok: true, proposals: [expect.objectContaining({
      kind: 'summon', monsterId: 'srd-5.1:sea-hag', count: 1,
      durationRounds: 600, concentration: true, side: 'ally',
    })] })
    expect(resolveAt(6)).toMatchObject({ ok: true, proposals: [expect.objectContaining({ count: 2 })] })
    expect(resolveAt(8)).toMatchObject({ ok: true, proposals: [expect.objectContaining({ count: 3 })] })
    expect(dnd5eActivityAutomationAnalysisV1(conjureWoodlandBeings)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Contact Other Plane with fixed DC 15, invariant 6d6 damage, madness, and a voice question window', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const contactOtherPlane = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'contact-other-plane',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(validateDnd5eActivityDefinitionV1(contactOtherPlane)).toEqual([])
    expect(contactOtherPlane).toMatchObject({
      target: { kind: 'self' },
      checks: [{
        id: 'contact-other-plane-save', kind: 'saving-throw', ability: 'int',
        dc: { kind: 'constant', value: 15 }, scope: 'per-target',
      }],
    })
    expect(contactOtherPlane.effects).toEqual(expect.arrayContaining([expect.objectContaining({
        id: 'contact-other-plane-madness', duration: { kind: 'permanent' },
        breakOn: ['long-rest-complete'],
        modifiers: expect.arrayContaining([
          { kind: 'prevent-actions' },
          { kind: 'language-restriction', understandLanguages: false, intelligibleCommunication: false },
        ]),
      }), expect.objectContaining({
        id: 'contact-other-plane-question-window',
        duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-end' },
      })]))
    const actor: Dnd5eActivityActorSnapshot = {
      id: 'contact-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 10, dex: 10, con: 14, int: 20, wis: 10, cha: 10 },
      armorClass: 14, conditions: [], currentHp: 100, maxHp: 100,
      spellSaveDc: 19, savingThrowModifiers: { int: 5 },
    }
    const resolveFailureAt = (castLevel: number) => resolveDnd5eActivity({
      activity: contactOtherPlane, actor, targets: [actor], castLevel,
      rolls: {
        [`contact-other-plane-save-d20:${actor.id}`]: { values: [1] },
        'contact-other-plane-psychic-damage': { values: [1, 2, 3, 4, 5, 6] },
      },
      checkRollModes: { [`contact-other-plane-save:${actor.id}`]: 'normal' },
    })
    for (const castLevel of [5, 9]) {
      const failed = resolveFailureAt(castLevel)
      expect(failed, JSON.stringify(failed)).toMatchObject({ ok: true, checks: [{ dc: 15, total: 6, success: false }] })
      expect(failed.ok && failed.proposals).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'deal-damage', targetId: actor.id, amount: 21, damageType: 'psychic',
        }),
        expect.objectContaining({
          kind: 'apply-effect', targetId: actor.id, effectId: 'contact-other-plane-madness',
          breakOn: ['long-rest-complete'],
        }),
      ]))
      expect(failed.ok && failed.proposals).not.toContainEqual(
        expect.objectContaining({ kind: 'manual-adjudication' }),
      )
    }
    const succeeded = resolveDnd5eActivity({
      activity: contactOtherPlane, actor, targets: [actor], castLevel: 5,
      rolls: { [`contact-other-plane-save-d20:${actor.id}`]: { values: [20] } },
      checkRollModes: { [`contact-other-plane-save:${actor.id}`]: 'normal' },
    })
    expect(succeeded).toMatchObject({ ok: true, checks: [{ dc: 15, total: 25, success: true }] })
    expect(succeeded.ok && succeeded.proposals).toContainEqual(expect.objectContaining({
      kind: 'apply-effect', targetId: actor.id, effectId: 'contact-other-plane-question-window',
    }))
    expect(succeeded.ok && succeeded.proposals).not.toContainEqual(
      expect.objectContaining({ kind: 'deal-damage' }),
    )
    expect(succeeded.ok && succeeded.proposals).not.toContainEqual(
      expect.objectContaining({ kind: 'request-dm-adjudication' }),
    )
    expect(() => compileDnd5eActivityHeadlessAction(
      contactOtherPlane,
      { outerSpellTransaction: true },
    )).not.toThrow()

    const greaterRestoration = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'greater-restoration',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(greaterRestoration.choices?.[0]?.options).toContainEqual(expect.objectContaining({
      id: 'contact-other-plane-madness',
    }))
    expect(greaterRestoration.outcomes).toContainEqual(expect.objectContaining({
      when: { kind: 'choice', choiceId: 'mode', optionId: 'contact-other-plane-madness' },
      operations: [expect.objectContaining({
        kind: 'remove-effects-by-tag', tags: ['contact-other-plane-madness'], maximumCount: 1,
      })],
    }))
  })

  it('uses mapped lock and audible-event primitives for Arcane Lock and Knock', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const arcaneLock = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'arcane-lock',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const knock = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'knock',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(arcaneLock.target).toMatchObject({
      kind: 'area', origin: 'point', placeRangeFeet: 5,
    })
    expect(arcaneLock.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual({
      id: 'arcane-lock-map-object', kind: 'modify-map-object-lock',
      mode: 'arcane-lock', targetKinds: ['door', 'obstacle'],
      accessPolicy: 'selected-creatures-and-password',
    })
    expect(dnd5eActivityAutomationAnalysisV1(arcaneLock)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
    expect(knock.target).toMatchObject({
      kind: 'area', origin: 'point', placeRangeFeet: 60,
    })
    expect(knock.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'modify-map-object-lock', mode: 'knock', suppressionMinutes: 10 }),
      expect.objectContaining({ kind: 'emit-sound', audibleRadiusFeet: 300 }),
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(knock)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Maze as banishment with a generic action escape check', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const maze = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'maze',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(maze.effects?.[0]).toMatchObject({
      id: 'maze', extensionCondition: 'banished', concentration: true,
      escapeCheck: {
        ability: 'int', dc: { kind: 'constant', value: 20 }, economy: 'action',
        automaticSuccessStatBlockIds: ['srd-5.1:minotaur', 'srd-5.1:goristro'],
      },
    })
    expect(dnd5eActivityAutomationAnalysisV1(maze)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Light with explicit carried and mapped object modes', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const light = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'light',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(light.choices?.find((choice) => choice.id === 'mode')?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'carried-object', targetOverride: expect.objectContaining({ kind: 'creature' }) }),
        expect.objectContaining({ id: 'mapped-object', targetOverride: expect.objectContaining({ kind: 'area' }) }),
      ]),
    )
    expect(light.outcomes.find((outcome) => outcome.id === 'mode-mapped-object')?.operations).toContainEqual({
      id: 'light-mapped-object-light',
      kind: 'enchant-map-object-light',
      brightRadiusFeet: 20,
      dimRadiusFeet: 20,
      color: '#fef3c7',
      durationMinutes: 60,
    })
    expect(dnd5eActivityAutomationAnalysisV1(light)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
    expect(light.checks?.[0]).toMatchObject({
      kind: 'saving-throw', ability: 'dex', automaticFailureIfAllied: true,
    })
    expect(light.effects?.find((effect) => effect.id === 'light')).toMatchObject({
      stacking: 'unique-by-source',
    })
  })

  it('keeps Continual Flame object narration out of target and map-object UI', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const spell = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'continual-flame',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(spell.target).toEqual({ kind: 'self' })
    expect(spell.choices).toBeUndefined()
    expect(spell.effects).toBeUndefined()
    expect(spell.outcomes).toContainEqual(expect.objectContaining({
      id: 'dm-object-narration',
      operations: [expect.objectContaining({
        id: 'continual-flame-dm-adjudication', kind: 'manual-adjudication', requiresDmApproval: true,
      })],
    }))
    expect(dnd5eActivityAutomationAnalysisV1(spell)).toMatchObject({
      capability: { level: 'assisted' },
      missingComponents: ['operation:manual-adjudication'],
    })
  })

  it('models Heroes Feast as a twelve-target durable buff with cures and rolled maximum HP', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const feast = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'heroes-feast',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(feast.target).toMatchObject({ kind: 'creature', count: 12 })
    expect(feast.effects?.find((effect) => effect.id === 'heroes-feast')).toMatchObject({
      modifiers: expect.arrayContaining([
        expect.objectContaining({
          kind: 'hit-point-maximum', mode: 'add', increaseCurrentHitPoints: true,
          value: expect.objectContaining({ kind: 'dice', count: 2, sides: 10 }),
        }),
        { kind: 'saving-throw', ability: 'wis', mode: 'advantage' },
        { kind: 'condition-immunity', condition: 'frightened' },
        { kind: 'condition-immunity', condition: 'poisoned' },
        { kind: 'damage-immunity', damageType: 'poison' },
      ]),
    })
    expect(feast.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'remove-standard-condition', condition: 'poisoned' }),
      expect.objectContaining({ kind: 'remove-effects-by-tag', tags: ['disease'] }),
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(feast)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Incendiary Cloud as a moving persistent area with create, enter and turn-end saves', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const cloud = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'incendiary-cloud',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const area = cloud.outcomes.flatMap((outcome) => outcome.operations)
      .find((operation) => operation.kind === 'create-persistent-area')
    expect(cloud.checks ?? []).toEqual([])
    expect(area).toMatchObject({
      kind: 'create-persistent-area', concentration: true,
      obscuration: { kind: 'heavy' },
      movement: { economy: 'none', maximumFeet: 10 },
      triggers: expect.arrayContaining([
        expect.objectContaining({ timing: 'on-create', damage: { count: 10, sides: 8, type: 'fire' } }),
        expect.objectContaining({ timing: 'on-enter', oncePerTurn: true }),
        expect.objectContaining({ timing: 'turn-end', oncePerTurn: true }),
      ]),
    })
    expect(dnd5eActivityAutomationAnalysisV1(cloud)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Delayed Blast Fireball with same-turn accumulation and 7th-9th-level base damage scaling', () => {
    const delayed = dnd5eSrdAuditedSpellActivityV1('delayed-blast-fireball')!
    expect(dnd5eActivityAutomationAnalysisV1(delayed)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
    expect(delayed.outcomes.flatMap((outcome) => outcome.operations)).not.toContainEqual(
      expect.objectContaining({ kind: 'manual-adjudication' }),
    )
    const actor: Dnd5eActivityActorSnapshot = {
      id: 'caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 },
      armorClass: 15, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
    }
    const detonationDamageCount = (castLevel: number) => {
      const scaled = scaleDnd5eActivityDefinitionV1(delayed, { actor, castLevel }).activity
      const area = scaled.outcomes.flatMap((outcome) => outcome.operations)
        .find((operation) => operation.kind === 'create-persistent-area')
      expect(area).toMatchObject({
        durationRounds: 10,
        concentration: true,
        lifecycle: {
          timing: 'source-turn-end', advanceOnCreationRound: true, maximumAdvances: 10,
          damageDiceCountDelta: 1,
        },
        grantedActivities: [expect.objectContaining({
          activityId: 'spell:delayed-blast-fireball:detonate',
        })],
      })
      return area?.triggers?.find((trigger) => trigger.timing === 'on-detonate')?.damage?.count
    }

    expect(detonationDamageCount(7)).toBe(12)
    expect(detonationDamageCount(8)).toBe(13)
    expect(detonationDamageCount(9)).toBe(14)
  })

  it('settles an audited Activity spell persistent area as spell damage', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const abilities = { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 } as const
    const actor = createDnd5eCombatant({
      id: 'incendiary-caster', name: 'Caster', controller: 'player', initiative: 20,
      abilities, proficiencyBonus: 6, armorClass: 15, currentHp: 100, maxHp: 100,
      temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: true,
    })
    actor.classState.concentrationSpellId = 'incendiary-cloud'
    actor.classState.concentrationSpellLevel = 8
    actor.classState.concentrationRoundsRemaining = 10
    const target = createDnd5eCombatant({
      id: 'incendiary-target', name: 'Target', controller: 'dm', initiative: 10,
      abilities, proficiencyBonus: 2, armorClass: 10, currentHp: 100, maxHp: 100,
      temporaryHp: 0, speed: 30, position: { x: 10, y: 0 }, concentrating: false,
    })
    const result = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('incendiary-area', [actor, target]),
      {
        areaId: 'incendiary-area', areaSourceKind: 'core-spell', coreSpellId: 'incendiary-cloud',
        sourceId: actor.id, targetId: target.id,
        trigger: {
          id: 'incendiary-cloud-create', label: '焚云术·生成', timing: 'on-create',
          savingThrow: { ability: 'dex', dc: 19, onSuccess: 'half', magical: true },
          damage: { count: 10, sides: 8, type: 'fire' },
        },
        d20: 1, damageRolls: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants[target.id].currentHp).toBe(20)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', triggerId: 'incendiary-cloud-create', damage: 80,
    }))
  })

  it('models Mislead as concentration-linked invisibility, projection movement and sense switching', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const mislead = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'mislead',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(mislead.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'mislead-controller', concentration: true }),
      expect.objectContaining({ id: 'mislead-invisible', conditions: ['invisible'] }),
      expect.objectContaining({
        id: 'mislead-projection-senses',
        conditions: ['blinded', 'deafened'],
        duration: expect.objectContaining({ kind: 'concentration' }),
      }),
    ]))
    expect(mislead.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'apply-effect', effectId: 'mislead-controller' }),
      expect.objectContaining({ kind: 'apply-effect', effectId: 'mislead-invisible' }),
      expect.objectContaining({
        kind: 'create-persistent-area',
        visual: { preset: 'mislead', intensity: 'strong' },
        effectToken: expect.objectContaining({ hiddenBody: true }),
        grantedActivities: expect.arrayContaining([
          expect.objectContaining({ activityId: 'spell:mislead:move-projection' }),
          expect.objectContaining({ activityId: 'spell:mislead:switch-senses' }),
        ]),
      }),
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(mislead)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Resilient Sphere as a target-anchored movement and line-of-effect boundary', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const sphere = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'resilient-sphere',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    expect(sphere.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area', anchorMode: 'target-token', concentration: true,
        blocking: {
          movement: true, movementMode: 'boundary',
          lineOfEffect: true, lineOfEffectMode: 'boundary',
        },
      }),
    )
    expect(dnd5eActivityAutomationAnalysisV1(sphere)).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })

  it('models Compulsion and Contagion with their complete bounded choices and repeat-save lifecycles', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const compulsion = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'compulsion',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const contagion = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'contagion',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(compulsion.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'compulsion-controller', concentration: true,
        grants: ['spell:compulsion:set-direction'],
      }),
      expect.objectContaining({
        id: 'compulsion-target', extensionCondition: 'directional-compulsion:compulsion',
        repeatSaveAfterMovement: expect.objectContaining({ ability: 'wis' }),
      }),
    ]))
    expect(compulsion.checks).toContainEqual(expect.objectContaining({
      kind: 'saving-throw', ability: 'wis', automaticSuccessIfConditionImmune: 'charmed',
    }))
    expect(compulsion.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({ kind: 'apply-effect', effectId: 'compulsion-controller' }),
    )
    expect(contagion.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'attack-roll', scope: 'per-target' }),
    ]))
    expect(contagion.effects).toHaveLength(6)
    expect(contagion.effects?.map((effect) => effect.id)).toEqual(expect.arrayContaining([
      'contagion-blinding-sickness', 'contagion-filth-fever', 'contagion-flesh-rot',
      'contagion-mindfire', 'contagion-seizure', 'contagion-slimy-doom',
    ]))
    expect(contagion.effects?.map((effect) => effect.name)).toEqual([
      '疫病术·致盲病', '疫病术·污秽热', '疫病术·腐肉症',
      '疫病术·心火症', '疫病术·痉挛症', '疫病术·黏液厄运',
    ])
    for (const effect of contagion.effects ?? []) {
      expect(effect.duration).toMatchObject({
        kind: 'save-ends', ability: 'con', successesRequired: 3, failuresRequired: 3,
      })
      expect(effect).toMatchObject({
        tags: ['disease'], stacking: 'replace', exclusiveGroup: 'contagion-disease',
      })
    }
    for (const castLevel of [5, 9]) {
      const scaled = scaleDnd5eActivityDefinitionV1(contagion, {
        actor: { level: 20, proficiencyBonus: 6 }, castLevel,
      }).activity
      expect(scaled.outcomes.flatMap((outcome) => outcome.operations))
        .not.toContainEqual(expect.objectContaining({ kind: 'damage' }))
      expect(scaled.effects?.every((effect) =>
        effect.duration.kind === 'save-ends' && effect.duration.maximumRounds === 100_800,
      )).toBe(true)
    }
    expect(dnd5eActivityAutomationAnalysisV1(compulsion).capability.level).toBe('full')
    expect(dnd5eActivityAutomationAnalysisV1(contagion).capability.level).toBe('full')
  })

  it('stores and automatically triggers a prepaid self spell through Contingency', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const definition = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'contingency',
    )
    const contingency = definition?.activities?.[0] as Dnd5eActivityDefinitionV1
    const trigger = definition?.activities?.find((entry) =>
      (entry as Dnd5eActivityDefinitionV1).id ===
        'spell:contingency:trigger:mirror-image:takes-damage') as Dnd5eActivityDefinitionV1
    expect(contingency).toMatchObject({
      activation: { kind: 'minute', value: 10 },
      target: { kind: 'self' },
      automation: { level: 'full' },
    })
    expect(contingency.choices?.find((choice) => choice.id === 'stored-spell')?.options)
      .toContainEqual(expect.objectContaining({ id: 'mirror-image', label: '镜影术（2 环）' }))
    expect(contingency.effects).toContainEqual(expect.objectContaining({
      id: 'contingency-mirror-image-takes-damage',
      duration: { kind: 'rounds', rounds: 144_000, expiresAt: 'target-turn-end' },
      grants: ['spell:contingency:trigger:mirror-image:takes-damage'],
      exclusiveGroup: 'contingency-controller',
    }))
    expect(trigger).toMatchObject({
      activation: { kind: 'free', cost: 0 },
      invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic' },
      target: { kind: 'self' },
      consumption: [],
      requirements: [expect.objectContaining({
        kind: 'active-effect', effectId: 'contingency-mirror-image-takes-damage',
        present: true, source: 'any',
      })],
      legacySource: { kind: 'spell', id: 'mirror-image' },
    })

    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: 'contingency-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 8, dex: 16, con: 14, int: 20, wis: 12, cha: 10 },
      armorClass: 13, conditions: [], currentHp: 80, maxHp: 80,
      resources: {
        'dnd5e-spell-slot-2': { current: 1, maximum: 3 },
        'dnd5e-spell-slot-6': { current: 1, maximum: 2 },
      },
      spellAttackBonus: 11, spellSaveDc: 19,
    }
    const setup = resolveDnd5eActivity({
      activity: contingency,
      actor: actorSnapshot,
      targets: [actorSnapshot],
      castLevel: 6,
      choices: { 'stored-spell': 'mirror-image', 'trigger-mode': 'takes-damage' },
      rolls: {},
    })
    expect(setup, JSON.stringify(setup)).toMatchObject({ ok: true })
    if (!setup.ok) return
    const caster = createDnd5eCombatant({ concentrating: false,
      id: actorSnapshot.id, name: 'Wizard', controller: 'player', initiative: 20,
      classId: 'wizard', level: 20,
      classSelections: {
        'spell-prepared': [
          'contingency', 'mirror-image', 'detect-magic', 'haste', 'remove-curse',
        ],
      },
      abilities: actorSnapshot.abilities, proficiencyBonus: 6, armorClass: 13,
      currentHp: 80, maxHp: 80, temporaryHp: 0, speed: 30,
      position: { x: 0, y: 0 },
      classResources: {
        'dnd5e-spell-slot-2': { current: 1, max: 3 },
        'dnd5e-spell-slot-6': { current: 1, max: 2 },
      },
    })
    const attacker = createDnd5eCombatant({ concentrating: false,
      id: 'contingency-attacker', name: 'Guard', controller: 'dm', initiative: 10,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 16, currentHp: 30, maxHp: 30,
      temporaryHp: 0, speed: 30, position: { x: 5, y: 0 },
    })
    const committed = commitDnd5eActivityExecution(
      startDnd5eHeadlessCombat('contingency-trigger', [caster, attacker]),
      {
        actorId: caster.id, activityId: contingency.id, castLevel: 6,
        targetIds: [caster.id], resolution: setup,
        source: { kind: 'spell', id: 'contingency' },
      },
    )
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants[caster.id].classResources['dnd5e-spell-slot-6'].current).toBe(0)
    expect(committed.state.combatants[caster.id].classResources['dnd5e-spell-slot-2'].current).toBe(0)
    expect(committed.state.combatants[caster.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ tags: expect.arrayContaining(['contingency', 'stored-spell:mirror-image']) }),
    )
    expect(committed.state.combatants[caster.id].classState.activeEffects)
      .not.toContainEqual(expect.objectContaining({
        modifiers: expect.objectContaining({ attackDecoys: expect.anything() }),
      }))

    // A previously resolved copy of the stored spell must not prevent the
    // prepaid copy from firing. This mirrors exploration setup followed by a
    // later combat trigger while the earlier Mirror Image is still active.
    const priorMirrorImage = createDnd5eMechanicalEffect({
      definitionId: 'activity:spell:mirror-image:mirror-image:modifiers:0',
      label: '镜影术', targetId: caster.id, kind: 'buff',
      source: {
        kind: 'spell', actorId: caster.id, rulesId: 'mirror-image',
        spellLevel: 2, magical: true,
      },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      stackingPolicy: 'replace',
      stackingKey: `activity:spell:mirror-image:mirror-image:modifiers:0:${caster.id}`,
      modifiers: {
        attackDecoys: {
          remaining: 3, redirectMinimumD20: [11, 8, 6], armorClassBase: 10,
          armorClassAbility: 'dex', requiresOrdinarySight: true,
        },
      },
    })
    committed.state.combatants[caster.id].classState.activeEffects?.push(priorMirrorImage)

    committed.state.initiativeIndex = 1
    const pendingAttack = resolveDnd5eHeadlessAction(committed.state, {
      type: 'attack', actorId: attacker.id, targetId: caster.id,
      attackModifier: 8, d20: 15,
      damage: { count: 1, sides: 6, bonus: 3, rolls: [4], type: 'slashing' },
    })
    expect(pendingAttack).toMatchObject({
      ok: false,
      attackDecoyRollRequirement: { remaining: 3, minimumD20: 6 },
    })
    if (pendingAttack.ok || !pendingAttack.attackDecoyRollRequirement) return
    const attack = resolveDnd5eHeadlessAction(committed.state, {
      type: 'attack', actorId: attacker.id, targetId: caster.id,
      attackModifier: 8, d20: 15,
      damage: { count: 1, sides: 6, bonus: 3, rolls: [4], type: 'slashing' },
      attackDecoyRolls: [{
        occurrenceId: pendingAttack.attackDecoyRollRequirement.occurrenceId,
        effectId: priorMirrorImage.id,
        redirectD20: 1,
      }],
    })
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    if (!attack.ok) return
    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: attack.state,
      events: attack.events,
      eventBatchId: 'contingency-damage-1',
      combatRevision: 1,
      confirm: async () => false,
      roll: async () => [],
    })
    const effects = settled.state.combatants[caster.id].classState.activeEffects ?? []
    expect(effects.some((effect) => effect.tags?.includes('contingency'))).toBe(false)
    expect(effects).toContainEqual(expect.objectContaining({
      definitionId: expect.stringContaining('mirror-image'),
      modifiers: expect.objectContaining({ attackDecoys: expect.objectContaining({ remaining: 3 }) }),
    }))
    expect(settled.diagnostics).toEqual([expect.objectContaining({
      activityId: 'spell:contingency:trigger:mirror-image:takes-damage', status: 'resolved',
    })])
  })

  it('replaces a previous Contagion disease mode from the same caster and target', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const contagion = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'contagion',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: 'contagion-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
      armorClass: 12, conditions: [], currentHp: 100, maxHp: 100,
      spellAttackBonus: 11, spellSaveDc: 19,
    }
    const targetSnapshot: Dnd5eActivityActorSnapshot = {
      id: 'contagion-target', controller: 'dm', level: 5, proficiencyBonus: 3,
      abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8 },
      armorClass: 12, conditions: [], currentHp: 50, maxHp: 50,
    }
    const resolveMode = (mode: string, castLevel = 5) => resolveDnd5eActivity({
      activity: contagion, actor: actorSnapshot, targets: [targetSnapshot], castLevel,
      distanceFeetByTargetId: { 'contagion-target': 5 },
      rolls: { 'spell-attack-d20:contagion-target': { values: [10] } },
      checkRollModes: { 'spell-attack:contagion-target': 'normal' },
      choices: { mode },
    })
    const blindness = resolveMode('blinding-sickness')
    const fleshRot = resolveMode('flesh-rot')
    const upcast = resolveMode('slimy-doom', 9)
    for (const resolution of [blindness, fleshRot, upcast]) {
      expect(resolution, JSON.stringify(resolution)).toMatchObject({ ok: true })
      expect(resolution.ok && resolution.proposals).not.toContainEqual(
        expect.objectContaining({ kind: 'deal-damage' }),
      )
    }
    if (!blindness.ok || !fleshRot.ok) return

    const caster = createDnd5eCombatant({ concentrating: false,
      id: actorSnapshot.id, name: 'Wizard', controller: 'player', initiative: 20,
      abilities: actorSnapshot.abilities, proficiencyBonus: 6, armorClass: 12,
      currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30,
      position: { x: 0, y: 0 },
      classResources: { 'dnd5e-spell-slot-5': { current: 2, max: 2 } },
    })
    const target = createDnd5eCombatant({ concentrating: false,
      id: targetSnapshot.id, name: 'Archmage', controller: 'dm', initiative: 10,
      abilities: targetSnapshot.abilities, proficiencyBonus: 3, armorClass: 12,
      currentHp: 50, maxHp: 50, temporaryHp: 0, speed: 30,
      position: { x: 5, y: 0 },
    })
    const first = commitDnd5eActivityExecution(
      startDnd5eHeadlessCombat('contagion-mode-replacement', [caster, target]),
      {
        actorId: caster.id, activityId: contagion.id, castLevel: 5,
        targetIds: [target.id], resolution: blindness,
        source: { kind: 'spell', id: 'contagion' },
      },
    )
    expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
    if (!first.ok) return
    expect(first.state.combatants[target.id].conditions).toContain('blinded')

    first.state.combatants[caster.id].turn.actionAvailable = true
    const second = commitDnd5eActivityExecution(first.state, {
      actorId: caster.id, activityId: contagion.id, castLevel: 5,
      targetIds: [target.id], resolution: fleshRot,
      source: { kind: 'spell', id: 'contagion' },
    })
    expect(second.ok, second.ok ? undefined : second.reason).toBe(true)
    if (!second.ok) return
    const diseases = second.state.combatants[target.id].classState.activeEffects
      ?.filter((effect) => effect.tags?.includes('disease')) ?? []
    expect(diseases).toHaveLength(1)
    expect(diseases[0]).toMatchObject({
      label: '疫病术·腐肉症',
      modifiers: expect.objectContaining({ vulnerabilityToAllDamage: true }),
    })
    expect(second.state.combatants[target.id].conditions).not.toContain('blinded')

    const settleThreeTargetTurnSaves = (
      startingState: typeof second.state,
      effectId: string,
      d20: number,
    ) => {
      let state = startingState
      for (let index = 0; index < 3; index += 1) {
        const casterEnded = resolveDnd5eHeadlessAction(state, {
          type: 'end-turn', actorId: caster.id,
        })
        expect(casterEnded.ok, casterEnded.ok ? undefined : casterEnded.reason).toBe(true)
        if (!casterEnded.ok) return state
        const targetEnded = resolveDnd5eHeadlessAction(casterEnded.state, {
          type: 'end-turn', actorId: target.id,
          activeEffectSavingThrows: [{ effectId, d20 }],
        })
        expect(targetEnded.ok, targetEnded.ok ? undefined : targetEnded.reason).toBe(true)
        if (!targetEnded.ok) return state
        state = targetEnded.state
      }
      return state
    }
    const failedEffectId = diseases[0]!.id
    const failedThreshold = settleThreeTargetTurnSaves(second.state, failedEffectId, 1)
    expect(failedThreshold.combatants[target.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ id: failedEffectId, repeatSave: undefined }),
    )

    const successfulDisease = first.state.combatants[target.id].classState.activeEffects
      ?.find((effect) => effect.tags?.includes('disease'))
    expect(successfulDisease).toBeDefined()
    if (!successfulDisease) return
    const successfulThreshold = settleThreeTargetTurnSaves(
      first.state, successfulDisease.id, 20,
    )
    expect(successfulThreshold.combatants[target.id].classState.activeEffects
      ?.some((effect) => effect.tags?.includes('disease')) ?? false).toBe(false)
    expect(successfulThreshold.combatants[target.id].conditions).not.toContain('blinded')
  })

  it('models Guardian of Faith and Storm of Vengeance as exact persistent-area timelines', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const guardian = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'guardian-of-faith',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const storm = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'storm-of-vengeance',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const guardianArea = guardian.outcomes.flatMap((outcome) => outcome.operations)
      .find((operation) => operation.kind === 'create-persistent-area')
    const stormArea = storm.outcomes.flatMap((outcome) => outcome.operations)
      .find((operation) => operation.kind === 'create-persistent-area')

    expect(guardian.target).toMatchObject({
      kind: 'area', relation: 'enemy', includeSelf: false, unoccupiedAnchorSizeFeet: 10,
    })
    expect(guardian.checks).toBeUndefined()
    expect(guardianArea).toMatchObject({
      effectToken: expect.objectContaining({ size: 2, hiddenBody: false }),
      triggers: [expect.objectContaining({
        timing: 'on-enter', oncePerTurn: true,
        savingThrow: expect.objectContaining({ ability: 'dex', onSuccess: 'half' }),
        damage: { count: 0, sides: 6, modifier: 20, type: 'radiant' },
        maximumTotalDamage: 60,
      })],
    })
    expect(stormArea).toMatchObject({
      triggers: [
        expect.objectContaining({ id: 'storm-of-vengeance-round-1', minimumLifecycleAdvances: 0 }),
        expect.objectContaining({
          id: 'storm-of-vengeance-round-2', minimumLifecycleAdvances: 1,
          targetKinds: ['creature'],
        }),
        expect.objectContaining({
          id: 'storm-of-vengeance-round-3', minimumLifecycleAdvances: 2,
          maximumTotalUses: 6, sourceChoosesTargets: true,
          targetKinds: ['creature'],
        }),
        expect.objectContaining({ id: 'storm-of-vengeance-round-4', minimumLifecycleAdvances: 3 }),
        expect.objectContaining({ id: 'storm-of-vengeance-round-5-10', minimumLifecycleAdvances: 4, maximumLifecycleAdvances: 9 }),
      ],
      lifecycle: {
        timing: 'source-turn-start',
        stages: [expect.objectContaining({
          atAdvance: 4, movementCostMultiplier: 2, dispersesFogAndMist: true,
          occupantModifiers: expect.objectContaining({
            preventsRangedWeaponAttacks: true,
            concentrationSavingThrowDisadvantage: true,
          }),
        })],
      },
    })
    expect(dnd5eActivityAutomationAnalysisV1(guardian).capability.level).toBe('full')
    expect(dnd5eActivityAutomationAnalysisV1(storm).capability.level).toBe('full')
  })

  it('models Project Image, Reverse Gravity, True Seeing and Wind Walk as concrete spatial effects', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const projectImage = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'project-image',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const reverseGravity = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'reverse-gravity',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const trueSeeing = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'true-seeing',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const windWalk = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'wind-walk',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(projectImage.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'project-image-controller', concentration: true }),
      expect.objectContaining({ id: 'project-image-projection-senses', conditions: ['blinded', 'deafened'] }),
    ]))
    expect(projectImage.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area',
        visual: { preset: 'project-image', intensity: 'strong' },
        entityProfile: {
          armorClass: 1,
          hitPoints: 1,
          strength: 1,
          cannotAttack: true,
          invisible: false,
        },
        grantedActivities: expect.arrayContaining([
          expect.objectContaining({ activityId: 'spell:project-image:move-projection' }),
          expect.objectContaining({ activityId: 'spell:project-image:switch-senses' }),
        ]),
      }),
    )
    expect(reverseGravity.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'move', mode: 'ascend', distanceFeet: expect.objectContaining({ value: 100 }),
        verticalDestination: 'area-top',
      }),
      expect.objectContaining({
        kind: 'create-persistent-area',
        occupantModifiers: { magicallyHeldAloft: true },
      }),
    ]))
    expect(reverseGravity.checks).toEqual([
      expect.objectContaining({
        id: 'spell-save', kind: 'saving-throw', ability: 'dex', scope: 'per-target',
      }),
    ])
    expect(reverseGravity.outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        when: { kind: 'check', checkId: 'spell-save', result: 'failure' },
        operations: expect.arrayContaining([
          expect.objectContaining({
            id: 'reverse-gravity-rise', kind: 'move', target: 'target', mode: 'ascend',
          }),
        ]),
      }),
    ]))
    expect(reverseGravity.outcomes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        when: { kind: 'always' },
        operations: expect.arrayContaining([
          expect.objectContaining({ id: 'reverse-gravity-rise' }),
        ]),
      }),
    ]))
    const activityActor: Dnd5eActivityActorSnapshot = {
      id: 'caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 },
      armorClass: 12, conditions: [], currentHp: 100, maxHp: 100,
      spellSaveDc: 19,
    }
    const failedTarget: Dnd5eActivityActorSnapshot = {
      id: 'failed-target', controller: 'dm', level: 1, proficiencyBonus: 2,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      armorClass: 10, conditions: [], currentHp: 10, maxHp: 10,
      savingThrowModifiers: { dex: 0 },
    }
    const successfulTarget: Dnd5eActivityActorSnapshot = {
      ...failedTarget, id: 'successful-target', savingThrowModifiers: { dex: 5 },
    }
    const mixedSaveResolution = resolveDnd5eActivity({
      activity: reverseGravity,
      actor: activityActor,
      targets: [failedTarget, successfulTarget],
      castLevel: 9,
      areaPlacement: { x: 0, y: 0 },
      areaPlacementDistanceFeet: 50,
      rolls: {
        'spell-save-d20:failed-target': { values: [1] },
        'spell-save-d20:successful-target': { values: [20] },
      },
      checkRollModes: {
        'spell-save:failed-target': 'normal',
        'spell-save:successful-target': 'normal',
      },
    })
    expect(mixedSaveResolution, JSON.stringify(mixedSaveResolution)).toMatchObject({ ok: true })
    expect(mixedSaveResolution.ok && mixedSaveResolution.proposals.filter((proposal) =>
      proposal.kind === 'move' && proposal.operationId === 'reverse-gravity-rise'))
      .toEqual([expect.objectContaining({ targetId: 'failed-target', mode: 'ascend', distanceFeet: 100 })])
    expect(trueSeeing.effects?.[0]?.modifiers).toContainEqual({ kind: 'truesight', rangeFeet: 120 })
    expect(trueSeeing).toMatchObject({
      activation: { kind: 'action' },
      target: {
        kind: 'creature', relation: 'ally', rangeFeet: 5, count: 1,
        includeSelf: true,
      },
      effects: [{
        duration: { kind: 'rounds', rounds: 600, expiresAt: 'target-turn-end' },
        stacking: 'replace',
      }],
    })
    const trueSeeingSpell = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'true-seeing',
    )?.payload as Record<string, unknown> | undefined
    expect(trueSeeingSpell).toMatchObject({
      level: 6, school: 'divination', ritual: false,
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'touch' },
      targeting: { relation: 'ally', includeSelf: true, maximumTargets: 1 },
      components: { verbal: true, somatic: true, material: true },
      duration: { type: 'timed', value: 1, unit: 'hour', concentration: false },
    })
    expect(trueSeeingSpell?.higherLevels).toBeUndefined()
    expect(windWalk.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'wind-walk-controller',
        grants: ['spell:wind-walk:begin-cloud-form'],
      }),
      expect.objectContaining({
        id: 'wind-walk-transition-to-normal', conditions: ['incapacitated'],
      }),
      expect.objectContaining({
        id: 'wind-walk-transition-to-cloud', conditions: ['incapacitated'],
      }),
    ]))
    expect(windWalk.effects?.find((effect) => effect.id === 'wind-walk-cloud-form')).toMatchObject({
      modifiers: expect.arrayContaining([
        { kind: 'flight-speed', speedFeet: 300 },
        expect.objectContaining({ kind: 'conditional-damage-resistance', sourceMagical: false }),
        expect.objectContaining({
          kind: 'action-restriction',
          allowedBasicActions: ['dash'],
          allowedActivityIds: ['spell:wind-walk:begin-normal-form'],
        }),
      ]),
      afterEffectEnds: {
        duration: 'rounds', rounds: 10, trigger: 'non-manual-removal',
        requiresAirborne: true,
        preventActions: false, preventMovement: false,
        controlledDescent: {
          maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true,
        },
      },
    })
    expect(windWalk.target).toMatchObject({
      kind: 'creature', relation: 'ally', rangeFeet: 30, count: 11, includeSelf: true,
    })
    for (const activity of [projectImage, reverseGravity, trueSeeing, windWalk]) {
      expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('full')
    }
  })

  it('models Nondetection, Telepathic Bond and both high-level resurrection transactions', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const nondetection = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'nondetection',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const passWithoutTrace = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'pass-without-trace',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const bond = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'telepathic-bond',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const resurrection = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'resurrection',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1
    const trueResurrection = getRegisteredContentDefinition(
      DND5E_CORE_SPELL_PACKAGE_ID, 'spell', 'true-resurrection',
    )?.activities?.[0] as Dnd5eActivityDefinitionV1

    expect(nondetection.effects?.[0]?.modifiers).toContainEqual({
      kind: 'spell-targeting-immunity', schools: ['divination'],
    })
    expect(nondetection.target).toEqual({
      kind: 'creature', relation: 'any', rangeFeet: 5, count: 1,
      includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
    })
    expect(nondetection.choices?.find((choice) => choice.id === 'mode')?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'willing-creature',
          targetOverride: expect.objectContaining({ kind: 'creature', includeSelf: true }),
        }),
        expect.objectContaining({
          id: 'place-or-mapped-object',
          label: '物件',
          targetOverride: { kind: 'self' },
        }),
      ]),
    )
    expect(nondetection.outcomes.find((outcome) => outcome.id === 'mode-willing-creature')
      ?.operations).toContainEqual(expect.objectContaining({
        kind: 'apply-effect', effectId: 'nondetection', target: 'all-targets',
      }))
    expect(nondetection.outcomes.find((outcome) => outcome.id === 'mode-place-or-mapped-object')
      ?.operations).toEqual([expect.objectContaining({
        kind: 'mechanic', target: 'actor', handlerId: 'core.resolve-only',
      })])
    expect(nondetection.consumption).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'spell-slot', minimumLevel: 3, amount: 1 }),
      expect.objectContaining({ kind: 'action-economy', economy: 'action', amount: 1 }),
    ]))
    expect(passWithoutTrace.effects?.[0]).toMatchObject({
      disposition: 'buff',
      modifiers: [expect.objectContaining({
        kind: 'skill-check-bonus-aura', skill: 'stealth', bonus: 10, radiusFeet: 30,
        mundaneTracking: 'impossible', leavesTracks: false,
      })],
    })
    expect(bond.requirements).toContainEqual({
      kind: 'ability-score', subject: 'target', ability: 'int', comparison: 'above', value: 2,
    })
    expect(bond.effects?.[0]).toMatchObject({
      extensionCondition: 'telepathic-bond', stacking: 'replace',
    })
    const bondCaster: Dnd5eActivityActorSnapshot = {
      id: 'bond-caster', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 },
      armorClass: 12, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
    }
    const bondTarget: Dnd5eActivityActorSnapshot = {
      id: 'bond-target', controller: 'players', level: 20, proficiencyBonus: 6,
      abilities: { str: 10, dex: 10, con: 10, int: 3, wis: 20, cha: 10 },
      armorClass: 18, conditions: [], currentHp: 100, maxHp: 100,
    }
    const protectedCreature = resolveDnd5eActivity({
      activity: nondetection, actor: bondCaster, targets: [bondTarget], castLevel: 3,
      distanceFeetByTargetId: { 'bond-target': 5 }, rolls: {},
      choices: { mode: 'willing-creature' },
    })
    expect(protectedCreature).toMatchObject({ ok: true })
    expect(protectedCreature.ok && protectedCreature.proposals).toEqual([
      expect.objectContaining({
        kind: 'apply-effect', targetId: 'bond-target', effectId: 'nondetection',
      }),
    ])
    const protectedObject = resolveDnd5eActivity({
      activity: nondetection, actor: bondCaster, targets: [bondCaster], castLevel: 3, rolls: {},
      choices: { mode: 'place-or-mapped-object' },
    })
    expect(protectedObject, JSON.stringify(protectedObject)).toMatchObject({ ok: true, proposals: [] })
    const resolvedBond = resolveDnd5eActivity({
      activity: bond, actor: bondCaster, targets: [bondTarget],
      castLevel: 5, distanceFeetByTargetId: { 'bond-target': 5 }, rolls: {},
    })
    expect(resolvedBond).toMatchObject({ ok: true })
    expect(resolveDnd5eActivity({
      activity: bond, actor: bondCaster,
      targets: [{ ...bondTarget, abilities: { ...bondTarget.abilities, int: 2 } }],
      castLevel: 5, distanceFeetByTargetId: { 'bond-target': 5 }, rolls: {},
    })).toMatchObject({ ok: false, reason: 'requirement-failed' })
    const secondBondTarget = { ...bondTarget, id: 'second-bond-target' }
    const secondBondCaster = { ...bondCaster, id: 'second-bond-caster' }
    const resolvedNetwork = resolveDnd5eActivity({
      activity: bond, actor: bondCaster, targets: [bondTarget, secondBondTarget],
      castLevel: 5,
      distanceFeetByTargetId: { 'bond-target': 5, 'second-bond-target': 10 },
      rolls: {},
    })
    expect(resolvedNetwork).toMatchObject({
      ok: true,
      proposals: [
        expect.objectContaining({ kind: 'apply-effect', targetId: 'bond-target' }),
        expect.objectContaining({ kind: 'apply-effect', targetId: 'second-bond-target' }),
      ],
    })
    if (resolvedNetwork.ok) {
      const networkState = startDnd5eHeadlessCombat('telepathic-bond-network', [
        createDnd5eCombatant({ temporaryHp: 0, concentrating: false,
          id: 'bond-caster', name: 'Caster', controller: 'player', initiative: 20,
          abilities: bondCaster.abilities, proficiencyBonus: 6, armorClass: 12,
          currentHp: 100, maxHp: 100, speed: 30, position: { x: 0, y: 0 },
          classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
        }),
        createDnd5eCombatant({ temporaryHp: 0, concentrating: false,
          id: 'second-bond-caster', name: 'Second Caster', controller: 'player', initiative: 15,
          abilities: secondBondCaster.abilities, proficiencyBonus: 6, armorClass: 12,
          currentHp: 100, maxHp: 100, speed: 30, position: { x: 0, y: 5 },
          classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
        }),
        ...[bondTarget, secondBondTarget].map((target, index) => createDnd5eCombatant({ temporaryHp: 0, concentrating: false,
          id: target.id, name: target.id, controller: 'player', initiative: 10 - index,
          abilities: target.abilities, proficiencyBonus: 6, armorClass: 18,
          currentHp: 100, maxHp: 100, speed: 30, position: { x: 5 + index * 5, y: 0 },
        })),
      ])
      networkState.combatants['bond-target'].classState.activeEffects = [
        createDnd5eMechanicalEffect({
          definitionId: `activity:${bond.id}:telepathic-bond:modifiers:0`,
          label: '心灵联结', targetId: 'bond-target',
          source: {
            kind: 'spell', actorId: 'bond-caster', rulesId: bond.id,
            spellLevel: 5, magical: true,
          },
          duration: { type: 'rounds', remainingRounds: 598, tickOn: 'target-turn-end' },
          stackingPolicy: 'replace',
          stackingKey: `activity:${bond.id}:telepathic-bond:modifiers:0:bond-caster`,
        }),
      ]
      const committedNetwork = commitDnd5eActivityExecution(networkState, {
        actorId: 'bond-caster', activityId: bond.id, castLevel: 5,
        targetIds: ['bond-target', 'second-bond-target'], resolution: resolvedNetwork,
        source: { kind: 'spell', id: 'telepathic-bond' },
      })
      expect(committedNetwork.ok, committedNetwork.ok ? undefined : committedNetwork.reason).toBe(true)
      if (committedNetwork.ok) {
        for (const targetId of ['bond-target', 'second-bond-target']) {
          expect(committedNetwork.state.combatants[targetId].classState.activeEffects
            ?.filter((effect) => effect.legacyCondition === 'telepathic-bond'))
            .toHaveLength(1)
          expect(committedNetwork.state.combatants[targetId].classState.activeEffects
            ?.find((effect) => effect.legacyCondition === 'telepathic-bond'))
             .toMatchObject({ legacyCondition: 'telepathic-bond' })
          expect(committedNetwork.state.combatants[targetId].classState.activeEffects)
            .toHaveLength(1)
        }
        const recastState = structuredClone(committedNetwork.state)
        recastState.combatants['bond-caster'].turn.actionAvailable = true
        recastState.combatants['bond-caster'].classResources['dnd5e-spell-slot-5'].current = 1
        const recastNetwork = commitDnd5eActivityExecution(recastState, {
          actorId: 'bond-caster', activityId: bond.id, castLevel: 5,
          targetIds: ['bond-target', 'second-bond-target'], resolution: resolvedNetwork,
          source: { kind: 'spell', id: 'telepathic-bond' },
        })
        expect(recastNetwork.ok, recastNetwork.ok ? undefined : recastNetwork.reason).toBe(true)
        if (recastNetwork.ok) {
          for (const targetId of ['bond-target', 'second-bond-target']) {
            expect(recastNetwork.state.combatants[targetId].classState.activeEffects
              ?.filter((effect) => effect.legacyCondition === 'telepathic-bond'))
              .toHaveLength(1)
          }
          const secondCasterResolution = resolveDnd5eActivity({
            activity: bond, actor: secondBondCaster, targets: [bondTarget],
            castLevel: 5, distanceFeetByTargetId: { 'bond-target': 5 }, rolls: {},
          })
          expect(secondCasterResolution).toMatchObject({ ok: true })
          if (secondCasterResolution.ok) {
            const overlappingNetwork = commitDnd5eActivityExecution(recastNetwork.state, {
              actorId: 'second-bond-caster', activityId: bond.id, castLevel: 5,
              targetIds: ['bond-target'], resolution: secondCasterResolution,
              source: { kind: 'spell', id: 'telepathic-bond' },
            })
            expect(overlappingNetwork.ok, overlappingNetwork.ok ? undefined : overlappingNetwork.reason).toBe(true)
            if (overlappingNetwork.ok) {
              expect(overlappingNetwork.state.combatants['bond-target'].classState.activeEffects
                ?.filter((effect) => effect.legacyCondition === 'telepathic-bond'))
                .toHaveLength(2)
              expect(overlappingNetwork.state.combatants['second-bond-target'].classState.activeEffects
                ?.filter((effect) => effect.legacyCondition === 'telepathic-bond'))
                .toHaveLength(1)
            }
          }
        }
      }
    }
    expect(resurrection.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'revive', maximumDeathAgeRounds: 525_600_000, requiresBody: true,
        restoreBody: 'missing-parts', removeConditions: ['poisoned'],
        removeDiseases: 'nonmagical',
        longRestPenalty: { initial: 4, recoveryPerLongRest: 1 },
        casterLongRestStrainAfterDeathAgeRounds: 5_256_000,
      }),
    )
    expect(trueResurrection.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'revive', maximumDeathAgeRounds: 1_051_200_000,
        excludesDeathFromOldAge: true, requiresFreeWillingSoul: true,
        restoreBody: 'complete', removeConditions: ['poisoned'], removeDiseases: 'all',
        removeCurses: 'all', createsNewBodyIfMissing: true,
        requiresSpokenNameIfBodyMissing: true, newBodyPlacementRangeFeet: 10,
      }),
    )
    for (const activity of [nondetection, bond, resurrection, trueResurrection]) {
      expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('full')
    }
  })
})
