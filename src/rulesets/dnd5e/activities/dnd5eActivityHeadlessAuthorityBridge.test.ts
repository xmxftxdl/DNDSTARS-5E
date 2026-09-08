import { afterEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { validateAndMigrateSharedResource } from '../../../lib/sharedResourceValidation'
import { normalizeCharacter } from '../../../store/characters'
import { createDnd5eCombatant, commitDnd5eActivityExecution, dnd5eActiveEffectRepeatSaveEligibleAtBoundary, dnd5eCombatantPairKey, dnd5eEffectiveFlySpeed, dnd5eEffectiveSpeed, dnd5ePersistentDetectionReports, endDnd5eConcentration, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from '../items'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import type { DeclarativeSubclassDefinitionV1 } from '../declarativeSubclassAbility'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot, type Dnd5eActivityExecutionResult } from './dnd5eActivityExecutor'
import { dnd5eSrdAuditedFullContentDefinitionsV1, dnd5eSrdAuditedPartialContentDefinitionsV1, dnd5eSrdAuditedSpellActivityV1 } from './dnd5eSrdAuditedSpellActivities'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveAndCommitDnd5eActivityCommand } from './dnd5eActivityHeadlessAuthorityBridge'
import { dnd5eActivityManualAdjudicationOperationsV1 } from './dnd5eActivityHeadlessCompiler'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { dnd5eActivityFromDeclarativeSubclassAbility } from './legacyContentActivityAdapters'

const abilities = { str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 } as const

afterEach(clearDnd5eActivityRegistryForTests)

function combatant(id: string, controller: 'player' | 'dm', initiative: number) {
  return createDnd5eCombatant({
    id, name: id, controller, initiative, abilities, proficiencyBonus: 3,
    armorClass: 14, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false,
    classResources: controller === 'player'
      ? { 'dnd5e-spell-slot-3': { current: 1, max: 1 }, focus: { current: 2, max: 2 } }
      : undefined,
  })
}

describe('Activity Headless authority commit bridge', () => {
  it('resolves a compound condition and extension with one repeat save', () => {
    const caster = combatant('prismatic-caster', 'player', 20)
    const target = combatant('prismatic-target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('prismatic-violet-repeat-save', [caster, target])
    const resolution: Dnd5eActivityExecutionResult = {
      ok: true,
      status: 'resolved',
      checks: [],
      consumptions: [],
      proposals: [{
        kind: 'apply-effect',
        operationId: 'prismatic-spray-violet',
        targetId: target.id,
        effectId: 'prismatic-spray-violet',
        name: '虹光喷射·紫色目盲',
        disposition: 'debuff',
        tags: ['spell', 'prismatic-spray', 'violet', 'planar-transport'],
        duration: {
          kind: 'save-ends', maximumRounds: 1, timing: 'target-turn-start',
          ability: 'wis', dc: 19, successesRequired: 1, failuresRequired: 1,
          onFailureThreshold: { outcome: 'retain-effect' },
        },
        conditions: ['blinded'],
        extensionCondition: 'prismatic-spray-violet-dm-planar-destination',
        modifierGroups: [],
        magical: true,
        concentration: false,
        stacking: 'replace',
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: caster.id,
      activityId: 'spell:prismatic-spray',
      castLevel: 7,
      targetIds: [target.id],
      resolution,
      source: { kind: 'spell', id: 'prismatic-spray' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    const effects = committed.state.combatants[target.id].classState.activeEffects ?? []
    const extension = effects.find((effect) =>
      effect.legacyCondition === 'prismatic-spray-violet-dm-planar-destination')
    const blindness = effects.find((effect) => effect.standardCondition === 'blinded')
    expect(effects.filter((effect) => effect.repeatSave)).toHaveLength(1)
    expect(extension?.repeatSave).toMatchObject({ ability: 'wis', dc: 19, timing: 'target-turn-start' })
    expect(blindness).toMatchObject({ repeatSave: undefined, dependsOnEffectId: extension?.id })
    if (!extension) return

    // Simulate the two-row payload persisted by the affected build. The next
    // authoritative boundary must migrate it before validating supplied dice.
    committed.state.combatants[target.id].classState.activeEffects = effects.map((effect) =>
      effect.standardCondition === 'blinded'
        ? { ...effect, repeatSave: { ...extension.repeatSave! }, dependsOnEffectId: undefined }
        : effect)

    const failedSave = resolveDnd5eHeadlessAction(committed.state, {
      type: 'end-turn', actorId: caster.id,
      turnStartActiveEffectSavingThrows: [{ effectId: extension.id, d20: 1 }],
    })
    expect(failedSave.ok, failedSave.ok ? undefined : failedSave.reason).toBe(true)
    if (!failedSave.ok) return
    expect(failedSave.events.filter((event) => event.type === 'active-effect-save-resolved')).toHaveLength(1)
    expect(failedSave.state.combatants[target.id].conditions).not.toContain('blinded')
    expect(failedSave.state.combatants[target.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        id: extension.id,
        legacyCondition: 'prismatic-spray-violet-dm-planar-destination',
        repeatSave: undefined,
      }),
    )
  })

  it('publishes authoritative opposed-check totals for the combat receipt', () => {
    const caster = combatant('caster', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('opposed-check-receipt', [caster, target])
    const resolution: Dnd5eActivityExecutionResult = {
      ok: true,
      status: 'resolved',
      checks: [{
        key: 'arcane-hand-contest:target',
        checkId: 'arcane-hand-contest',
        targetId: target.id,
        ability: 'str',
        d20: 17,
        modifier: 8,
        total: 25,
        success: false,
        criticalSuccess: false,
        criticalFailure: false,
        opposedD20: 18,
        opposedModifier: 7,
        opposedTotal: 25,
        opposedAbility: 'str',
        opposedSkill: 'athletics',
      }],
      consumptions: [],
      proposals: [],
    }

    const committed = commitDnd5eActivityExecution(state, {
      actorId: caster.id,
      activityId: 'spell:arcane-hand:forceful-hand',
      targetIds: [target.id],
      resolution,
      source: { kind: 'spell', id: 'arcane-hand' },
    })

    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(committed.events).toContainEqual({
      type: 'opposed-ability-check-resolved',
      actorId: caster.id,
      targetId: target.id,
      activityId: 'spell:arcane-hand:forceful-hand',
      checkId: 'arcane-hand-contest',
      sourceAbility: 'str',
      sourceD20: 17,
      sourceModifier: 8,
      sourceTotal: 25,
      targetAbility: 'str',
      targetSkill: 'athletics',
      targetD20: 18,
      targetModifier: 7,
      targetTotal: 25,
      success: false,
    })
  })

  it('distinguishes foreign-planar dismissal from a local native banishment', () => {
    const definition = dnd5eSrdAuditedFullContentDefinitionsV1().find((entry) =>
      entry.id === 'dispel-evil-and-good')!
    const activity = (definition.activities as readonly Dnd5eActivityDefinitionV1[] | undefined)?.find((candidate) =>
      candidate.id === 'spell:dispel-evil-and-good:dismissal')!
    const settle = (targetId: string, creatureType: string) => {
      const caster = combatant(`caster-${targetId}`, 'player', 20)
      const target = combatant(targetId, 'dm', 10)
      target.creatureType = creatureType
      const state = startDnd5eHeadlessCombat(`dismissal-${targetId}`, [caster, target])
      const resolution = resolveDnd5eActivity({
        activity,
        actor: {
          id: caster.id, controller: caster.controller, level: 8,
          proficiencyBonus: caster.proficiencyBonus, abilities: caster.abilities,
          armorClass: caster.armorClass, conditions: [], currentHp: caster.currentHp,
          maxHp: caster.maxHp, spellSaveDc: 16, spellAttackBonus: 8,
          activeEffectDefinitionIds: [{
            definitionId: 'activity:spell:dispel-evil-and-good', sourceActorId: caster.id,
          }],
        },
        targets: [{
          id: target.id, controller: target.controller, level: 8,
          proficiencyBonus: target.proficiencyBonus, abilities: target.abilities,
          armorClass: target.armorClass, conditions: [], currentHp: target.currentHp,
          maxHp: target.maxHp, creatureType,
          savingThrowModifiers: { cha: 0 },
        }],
        rolls: {
          [`dismissal-attack-d20:${target.id}`]: { values: [18] },
          [`dismissal-save-d20:${target.id}`]: { values: [2] },
        },
        checkRollModes: {
          [`dismissal-attack:${target.id}`]: 'normal',
          [`dismissal-save:${target.id}`]: 'normal',
        },
        distanceFeetByTargetId: { [target.id]: 5 },
      })
      expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
      if (!resolution.ok) return undefined
      const committed = commitDnd5eActivityExecution(state, {
        actorId: caster.id, activityId: activity.id, targetIds: [target.id], resolution,
        source: { kind: 'spell', id: 'dispel-evil-and-good' },
      })
      expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
      return committed.ok
        ? committed.state.combatants[target.id].classState.activeEffects?.find((effect) =>
            effect.legacyCondition === 'banished')
        : undefined
    }

    expect(settle('foreign-fiend', 'fiend')).toMatchObject({
      duration: { type: 'permanent' },
      source: { kind: 'spell', magical: true },
    })
    expect(settle('foreign-fiend-zh', '邪魔')).toMatchObject({
      duration: { type: 'permanent' },
      source: { kind: 'spell', magical: true },
    })
    expect(settle('local-undead', 'undead')?.duration).toMatchObject({
      type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end',
    })
    expect(settle('local-undead-zh', '亡灵')?.duration).toMatchObject({
      type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end',
    })
  })

  it('resolves Polymorph through the generic creature-form lifecycle', () => {
    const caster = combatant('caster', 'player', 20)
    caster.level = 8
    caster.classResources['dnd5e-spell-slot-4'] = { current: 1, max: 1 }
    const target = combatant('target', 'player', 15)
    target.level = 4
    target.abilities = { str: 8, dex: 12, con: 12, int: 18, wis: 16, cha: 14 }
    target.baseSavingThrowBonuses = { str: -1, dex: 1, con: 1, int: 7, wis: 6, cha: 2 }
    target.savingThrowBonuses = { ...target.baseSavingThrowBonuses }
    target.savingThrowProficiencies = ['int', 'wis']
    target.skillProficiencies = ['arcana', 'perception']
    target.passivePerception = 16
    const enemy = combatant('enemy', 'dm', 10)
    let state = startDnd5eHeadlessCombat('activity-polymorph', [caster, target, enemy])
    const activity = dnd5eSrdAuditedSpellActivityV1('polymorph')!
    const resolution = resolveDnd5eActivity({
      activity,
      actor: {
        id: caster.id, controller: caster.controller, level: caster.level,
        proficiencyBonus: caster.proficiencyBonus, abilities: caster.abilities,
        armorClass: caster.armorClass, conditions: [], currentHp: caster.currentHp,
        maxHp: caster.maxHp, spellSaveDc: 16,
      },
      targets: [{
        id: target.id, controller: target.controller, level: target.level,
        proficiencyBonus: target.proficiencyBonus, abilities: target.abilities,
        armorClass: target.armorClass, conditions: [], currentHp: target.currentHp,
        maxHp: target.maxHp, savingThrowModifiers: target.savingThrowBonuses,
      }],
      castLevel: 4,
      choices: { mode: 'srd-5.1:wolf' },
      rolls: { [`spell-save-d20:${target.id}`]: { values: [20] } },
      checkRollModes: { [`spell-save:${target.id}`]: 'normal' },
      distanceFeetByTargetId: { [target.id]: 30 },
    })
    expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
    if (!resolution.ok) return
    expect(resolution.checks).toContainEqual(expect.objectContaining({
      targetId: target.id,
      success: false,
    }))
    expect(resolution.proposals).toContainEqual(expect.objectContaining({
      kind: 'transform-creature',
      formId: 'srd-5.1:wolf',
      profile: 'polymorph',
    }))

    const committed = commitDnd5eActivityExecution(state, {
      actorId: caster.id,
      activityId: activity.id,
      castLevel: 4,
      targetIds: [target.id],
      resolution,
      source: { kind: 'spell', id: 'polymorph' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    state = committed.state
    expect(state.combatants.caster).toMatchObject({
      concentrating: true,
      classResources: { 'dnd5e-spell-slot-4': { current: 0, max: 1 } },
    })
    expect(state.combatants.target).toMatchObject({
      currentHp: 11,
      maxHp: 11,
      armorClass: 13,
      speed: 40,
      statBlockId: 'srd-5.1:wolf',
      creatureType: '野兽',
      abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
      classState: {
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeMode: 'polymorph',
        wildShapeSourceActorId: caster.id,
        wildShapeOriginalCurrentHp: 30,
      },
    })
    state.initiativeIndex = state.initiativeOrder.indexOf(target.id)
    const prohibitedSpell = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: target.id, targetId: enemy.id,
      spellId: 'fire-bolt', slotLevel: 0, effectRolls: [1],
    })
    expect(prohibitedSpell).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const damaged = resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', actorId: enemy.id, targetId: target.id,
      attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 20, bonus: 0, rolls: [15], type: 'slashing' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.target).toMatchObject({
      currentHp: 26,
      maxHp: 30,
      statBlockId: undefined,
      abilities: { str: 8, dex: 12, con: 12, int: 18, wis: 16, cha: 14 },
      classState: { wildShapeFormId: undefined },
    })

    const secondCommit = commitDnd5eActivityExecution(committed.state, {
      actorId: caster.id,
      activityId: activity.id,
      castLevel: 4,
      targetIds: [target.id],
      resolution: { ...resolution, consumptions: [] },
      source: { kind: 'spell', id: 'polymorph' },
    })
    expect(secondCommit.ok).toBe(true)
    if (!secondCommit.ok) return
    const concentrationEvents: Parameters<typeof endDnd5eConcentration>[2] = []
    endDnd5eConcentration(
      secondCommit.state,
      secondCommit.state.combatants[caster.id],
      concentrationEvents,
    )
    expect(secondCommit.state.combatants[target.id]).toMatchObject({
      currentHp: 30,
      maxHp: 30,
      statBlockId: undefined,
      classState: { wildShapeFormId: undefined },
    })
    expect(concentrationEvents).toContainEqual(expect.objectContaining({
      type: 'class-state-changed',
      actorId: target.id,
      stateKey: 'creature-form:polymorph',
      active: false,
    }))
  })

  it.each([
    { label: 'shapechanger', reason: 'shapechanger' as const },
    { label: 'zero hit points', reason: 'zero-hit-points' as const },
  ])('casts Polymorph but leaves a $label target unaffected', ({ reason }) => {
    const caster = combatant('caster', 'player', 20)
    caster.level = 8
    caster.classResources['dnd5e-spell-slot-4'] = { current: 1, max: 1 }
    const target = combatant('target', 'player', 10)
    target.level = 4
    if (reason === 'shapechanger') target.shapechanger = true
    else target.currentHp = 0
    const state = startDnd5eHeadlessCombat(`activity-polymorph-${reason}`, [caster, target])
    const activity = dnd5eSrdAuditedSpellActivityV1('polymorph')!
    const resolution = resolveDnd5eActivity({
      activity,
      actor: {
        id: caster.id, controller: caster.controller, level: caster.level,
        proficiencyBonus: caster.proficiencyBonus, abilities: caster.abilities,
        armorClass: caster.armorClass, conditions: [], currentHp: caster.currentHp,
        maxHp: caster.maxHp, spellSaveDc: 16,
      },
      targets: [{
        id: target.id, controller: target.controller, level: target.level,
        proficiencyBonus: target.proficiencyBonus, abilities: target.abilities,
        armorClass: target.armorClass, conditions: [], currentHp: target.currentHp,
        maxHp: target.maxHp, savingThrowModifiers: target.savingThrowBonuses,
      }],
      castLevel: 4,
      choices: { mode: 'srd-5.1:wolf' },
      rolls: { [`spell-save-d20:${target.id}`]: { values: [2] } },
      checkRollModes: { [`spell-save:${target.id}`]: 'normal' },
      distanceFeetByTargetId: { [target.id]: 30 },
    })
    expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
    if (!resolution.ok) return

    const committed = commitDnd5eActivityExecution(state, {
      actorId: caster.id,
      activityId: activity.id,
      castLevel: 4,
      targetIds: [target.id],
      resolution,
      source: { kind: 'spell', id: 'polymorph' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants.caster).toMatchObject({
      concentrating: false,
      turn: { actionAvailable: false },
      classResources: { 'dnd5e-spell-slot-4': { current: 0, max: 1 } },
    })
    expect(committed.state.combatants.target).toMatchObject({
      currentHp: target.currentHp,
      maxHp: 30,
    })
    expect(committed.state.combatants.target.statBlockId).toBeUndefined()
    expect(committed.state.combatants.target.classState.wildShapeFormId).toBeUndefined()
    expect(committed.events).toContainEqual({
      type: 'creature-transformation-unaffected',
      actorId: caster.id,
      targetId: target.id,
      sourceActivityId: activity.id,
      reason,
    })
  })

  it('rejects True Resurrection after the 200-year boundary', () => {
    const actor = combatant('true-resurrection-old-caster', 'player', 20)
    const target = combatant('true-resurrection-old-target', 'dm', 10)
    target.currentHp = 0
    target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    target.classState.deathRound = 1
    target.classState.deathCause = 'other'
    target.classState.soulReturnStatus = 'free-willing'
    target.classState.bodyPresent = true
    const state = startDnd5eHeadlessCombat('activity-true-resurrection-too-old', [actor, target])
    state.round = 1_051_200_002
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
        kind: 'revive', operationId: 'true-resurrection', targetId: target.id, hitPoints: 30,
        maximumDeathAgeRounds: 1_051_200_000,
        excludesDeathFromOldAge: true, requiresFreeWillingSoul: true,
        restoreBody: 'complete', createsNewBodyIfMissing: true,
      }],
    }
    expect(commitDnd5eActivityExecution(state, {
      actorId: actor.id, activityId: 'spell:true-resurrection', targetIds: [target.id], resolution,
      source: { kind: 'spell', id: 'true-resurrection' },
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('lets Animal Shapes reuse the same Host transformation primitive on later turns', () => {
    const caster = combatant('caster', 'player', 20)
    caster.level = 16
    caster.saveDc = 18
    caster.classResources['dnd5e-spell-slot-8'] = { current: 1, max: 1 }
    const ally = combatant('ally', 'player', 10)
    const state = startDnd5eHeadlessCombat('activity-animal-shapes-control', [caster, ally])
    const castActivity = dnd5eSrdAuditedSpellActivityV1('animal-shapes')!
    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: caster.id, controller: caster.controller, level: caster.level,
      proficiencyBonus: caster.proficiencyBonus, abilities: caster.abilities,
      armorClass: caster.armorClass, conditions: [], currentHp: caster.currentHp,
      maxHp: caster.maxHp, spellSaveDc: 18,
    }
    const allySnapshot: Dnd5eActivityActorSnapshot = {
      id: ally.id, controller: ally.controller, level: ally.level,
      proficiencyBonus: ally.proficiencyBonus, abilities: ally.abilities,
      armorClass: ally.armorClass, conditions: [], currentHp: ally.currentHp,
      maxHp: ally.maxHp,
    }
    const castResolution = resolveDnd5eActivity({
      activity: castActivity, actor: actorSnapshot, targets: [allySnapshot], castLevel: 8,
      choices: { mode: 'srd-5.1:wolf' }, rolls: {}, distanceFeetByTargetId: { ally: 15 },
    })
    expect(castResolution.ok, castResolution.ok ? undefined : castResolution.details.join('; ')).toBe(true)
    if (!castResolution.ok) return
    const cast = commitDnd5eActivityExecution(state, {
      actorId: caster.id, activityId: castActivity.id, castLevel: 8, targetIds: [ally.id],
      resolution: castResolution, source: { kind: 'spell', id: 'animal-shapes' },
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.ally.classState.wildShapeSourceActivityId).toBe('spell:animal-shapes')

    const casterEnded = resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: caster.id })
    expect(casterEnded.ok).toBe(true)
    if (!casterEnded.ok) return
    const allyEnded = resolveDnd5eHeadlessAction(casterEnded.state, { type: 'end-turn', actorId: ally.id })
    expect(allyEnded.ok).toBe(true)
    if (!allyEnded.ok) return
    const controlActivity = (dnd5eSrdAuditedFullContentDefinitionsV1()
      .find((definition) => definition.id === 'animal-shapes')?.activities as readonly Dnd5eActivityDefinitionV1[] | undefined)
      ?.find((activity) => activity.id === 'spell:animal-shapes:change-form')!
    const controlResolution = resolveDnd5eActivity({
      activity: controlActivity, actor: actorSnapshot, targets: [allySnapshot],
      choices: { mode: 'srd-5.1:brown-bear' }, rolls: {}, distanceFeetByTargetId: { ally: 15 },
    })
    expect(controlResolution.ok, controlResolution.ok ? undefined : controlResolution.details.join('; ')).toBe(true)
    if (!controlResolution.ok) return
    const changed = commitDnd5eActivityExecution(allyEnded.state, {
      actorId: caster.id, activityId: controlActivity.id, targetIds: [ally.id],
      resolution: controlResolution, source: { kind: 'feature', id: controlActivity.id },
    })
    expect(changed.ok, changed.ok ? undefined : changed.reason).toBe(true)
    if (!changed.ok) return
    expect(changed.state.combatants.ally.statBlockId).toBe('srd-5.1:brown-bear')
    expect(changed.state.combatants.ally.classState.wildShapeSourceActivityId).toBe('spell:animal-shapes')
    expect(changed.state.combatants.caster.concentrating).toBe(true)
  })

  it('runs Shapechange through a legal seen form, retains mental scores, and never heals on a later change', () => {
    const caster = combatant('caster', 'player', 20)
    caster.level = 20
    caster.abilities = { str: 8, dex: 12, con: 14, int: 18, wis: 16, cha: 14 }
    caster.baseSavingThrowBonuses = { str: -1, dex: 1, con: 2, int: 10, wis: 8, cha: 2 }
    caster.savingThrowBonuses = { ...caster.baseSavingThrowBonuses }
    caster.savingThrowProficiencies = ['int', 'wis']
    caster.skillProficiencies = ['arcana', 'history']
    caster.classResources['dnd5e-spell-slot-9'] = { current: 1, max: 1 }
    const enemy = combatant('enemy', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-shapechange-control', [caster, enemy])
    const castActivity = dnd5eSrdAuditedSpellActivityV1('shapechange')!
    const formOptions = castActivity.choices?.find((choice) => choice.id === 'mode')?.options ?? []
    expect(formOptions.some((option) => option.id === 'srd-5.1:adult-black-dragon')).toBe(true)
    expect(formOptions.some((option) => option.id === 'srd-5.1:planetar')).toBe(true)
    expect(formOptions.some((option) => option.id === 'srd-5.1:stone-golem')).toBe(false)
    expect(formOptions.some((option) => option.id === 'srd-5.1:zombie')).toBe(false)

    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: caster.id, controller: caster.controller, level: caster.level,
      proficiencyBonus: caster.proficiencyBonus, abilities: caster.abilities,
      armorClass: caster.armorClass, conditions: [], currentHp: caster.currentHp,
      maxHp: caster.maxHp, spellSaveDc: 18,
    }
    const castResolution = resolveDnd5eActivity({
      activity: castActivity, actor: actorSnapshot, targets: [actorSnapshot], castLevel: 9,
      choices: {
        mode: 'srd-5.1:adult-black-dragon', equipment: 'merge', seen: 'confirmed',
      },
      rolls: {},
    })
    expect(castResolution.ok, castResolution.ok ? undefined : castResolution.details.join('; ')).toBe(true)
    if (!castResolution.ok) return
    const cast = commitDnd5eActivityExecution(state, {
      actorId: caster.id, activityId: castActivity.id, castLevel: 9, targetIds: [caster.id],
      resolution: castResolution, source: { kind: 'spell', id: 'shapechange' },
    })
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.caster).toMatchObject({
      currentHp: 195,
      maxHp: 195,
      armorClass: 19,
      statBlockId: 'srd-5.1:adult-black-dragon',
      abilities: { str: 23, dex: 14, con: 21, int: 18, wis: 16, cha: 14 },
      concentrating: true,
      classState: {
        wildShapeFormId: 'srd-5.1:adult-black-dragon',
        wildShapeMode: 'shapechange',
        wildShapeOriginalCurrentHp: 30,
        shapechangeEquipmentDisposition: 'merge',
      },
    })
    expect(cast.state.combatants.caster.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        definitionId: expect.stringContaining(':shapechange-controller'),
        grantedActivities: ['spell:shapechange:change-form'],
      }),
    ]))
    // Owning spell transactions persist the package-qualified Activity id. The
    // granted control uses the package-local id and must still match it.
    cast.state.combatants.caster.classState.wildShapeSourceActivityId = 'srd-5.1:spell:shapechange'

    const casterEnded = resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: caster.id })
    expect(casterEnded.ok).toBe(true)
    if (!casterEnded.ok) return
    const enemyEnded = resolveDnd5eHeadlessAction(casterEnded.state, { type: 'end-turn', actorId: enemy.id })
    expect(enemyEnded.ok).toBe(true)
    if (!enemyEnded.ok) return
    enemyEnded.state.combatants.caster.currentHp = 120
    enemyEnded.state.combatants.caster.classState.wildShapeCurrentHp = 120
    const controlActivity = (dnd5eSrdAuditedPartialContentDefinitionsV1()
      .find((definition) => definition.id === 'shapechange')?.activities as readonly Dnd5eActivityDefinitionV1[] | undefined)
      ?.find((activity) => activity.id === 'spell:shapechange:change-form')!
    expect(dnd5eActivityManualAdjudicationOperationsV1(controlActivity, {
      mode: 'srd-5.1:planetar', equipment: 'merge', seen: 'confirmed',
    })).toHaveLength(0)
    expect(dnd5eActivityManualAdjudicationOperationsV1(controlActivity, {
      mode: 'srd-5.1:planetar', equipment: 'wear', seen: 'confirmed',
    })).toHaveLength(1)
    const controlResolution = resolveDnd5eActivity({
      activity: controlActivity, actor: actorSnapshot, targets: [actorSnapshot],
      choices: { mode: 'srd-5.1:planetar', equipment: 'wear', seen: 'confirmed' }, rolls: {},
    })
    expect(controlResolution.ok, controlResolution.ok ? undefined : controlResolution.details.join('; ')).toBe(true)
    if (!controlResolution.ok) return
    const changed = commitDnd5eActivityExecution(enemyEnded.state, {
      actorId: caster.id, activityId: controlActivity.id, targetIds: [caster.id],
      resolution: controlResolution, dmApproved: true,
      source: { kind: 'feature', id: controlActivity.id },
    })
    expect(changed.ok, changed.ok ? undefined : changed.reason).toBe(true)
    if (!changed.ok) return
    expect(changed.state.combatants.caster).toMatchObject({
      currentHp: 120,
      maxHp: 200,
      statBlockId: 'srd-5.1:planetar',
      abilities: { str: 24, dex: 20, con: 24, int: 18, wis: 16, cha: 14 },
      concentrating: true,
      classState: {
        wildShapeOriginalCurrentHp: 30,
        wildShapeSourceActivityId: 'srd-5.1:spell:shapechange',
        shapechangeEquipmentDisposition: 'wear',
      },
    })

    const concentrationEvents: Parameters<typeof endDnd5eConcentration>[2] = []
    endDnd5eConcentration(
      changed.state,
      changed.state.combatants[caster.id],
      concentrationEvents,
    )
    expect(changed.state.combatants.caster).toMatchObject({
      currentHp: 30,
      maxHp: 30,
      statBlockId: undefined,
      abilities: caster.abilities,
      classState: {
        wildShapeFormId: undefined,
        shapechangeEquipmentDisposition: undefined,
      },
    })
    expect(concentrationEvents).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: caster.id,
      stateKey: 'creature-form:shapechange', active: false,
    }))
  })

  it('runs Eyebite modes, target memory, later gaze actions, and LOS-gated repeat saves', () => {
    const caster = combatant('caster', 'player', 20)
    caster.classResources['dnd5e-spell-slot-6'] = { current: 1, max: 1 }
    const first = combatant('first', 'dm', 15)
    const second = combatant('second', 'dm', 10)
    let state = startDnd5eHeadlessCombat('activity-eyebite', [caster, first, second])
    const activity = dnd5eSrdAuditedSpellActivityV1('eyebite')!
    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: caster.id, controller: caster.controller, level: 11,
      proficiencyBonus: caster.proficiencyBonus, abilities: caster.abilities,
      armorClass: caster.armorClass, conditions: [], currentHp: caster.currentHp,
      maxHp: caster.maxHp, spellSaveDc: 16,
    }
    const firstSnapshot: Dnd5eActivityActorSnapshot = {
      id: first.id, controller: first.controller, level: 5,
      proficiencyBonus: first.proficiencyBonus, abilities: first.abilities,
      armorClass: first.armorClass, conditions: [], currentHp: first.currentHp,
      maxHp: first.maxHp, savingThrowModifiers: { wis: 0 },
    }
    const castResolution = resolveDnd5eActivity({
      activity, actor: actorSnapshot, targets: [firstSnapshot], castLevel: 6,
      choices: { mode: 'panicked' },
      rolls: { [`spell-save-d20:${first.id}`]: { values: [1] } },
      checkRollModes: { [`spell-save:${first.id}`]: 'normal' },
      distanceFeetByTargetId: { first: 30 },
    })
    expect(castResolution.ok, castResolution.ok ? undefined : castResolution.details.join('; ')).toBe(true)
    if (!castResolution.ok) return
    expect(castResolution.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'apply-effect', effectId: 'eyebite-caster' }),
      expect.objectContaining({ kind: 'apply-effect', effectId: 'eyebite-immunity' }),
      expect.objectContaining({ kind: 'apply-effect', effectId: 'eyebite-panicked' }),
    ]))
    const cast = commitDnd5eActivityExecution(state, {
      actorId: caster.id, activityId: activity.id, castLevel: 6, targetIds: [first.id],
      resolution: castResolution, source: { kind: 'spell', id: 'eyebite' },
    })
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    state = cast.state
    expect(state.combatants.caster.classState.activeEffects?.map((effect) => effect.definitionId)).toEqual(expect.arrayContaining([
      expect.stringContaining(':eyebite-caster'),
    ]))
    const firstEffects = state.combatants.first.classState.activeEffects ?? []
    const panicked = firstEffects.find((effect) =>
      effect.standardCondition === 'frightened' && effect.source.rulesId === 'spell:eyebite')
    expect(panicked, JSON.stringify(cast.events)).toBeDefined()
    expect(firstEffects.some((effect) => effect.definitionId.includes(':eyebite-immunity'))).toBe(true)
    expect(dnd5eActiveEffectRepeatSaveEligibleAtBoundary(state, first.id, panicked!)).toBe(false)
    state.lineOfSightBlockedByCombatantPair = { 'first\u0000caster': true }
    expect(dnd5eActiveEffectRepeatSaveEligibleAtBoundary(state, first.id, panicked!)).toBe(true)
    state.lineOfSightBlockedByCombatantPair = undefined

    const casterEnded = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: caster.id })
    expect(casterEnded.ok).toBe(true)
    if (!casterEnded.ok) return
    const firstEnded = resolveDnd5eHeadlessAction(casterEnded.state, { type: 'end-turn', actorId: first.id })
    expect(firstEnded.ok).toBe(true)
    if (!firstEnded.ok) return
    const secondEnded = resolveDnd5eHeadlessAction(firstEnded.state, { type: 'end-turn', actorId: second.id })
    expect(secondEnded.ok).toBe(true)
    if (!secondEnded.ok) return
    state = secondEnded.state

    const controlActivity = (dnd5eSrdAuditedFullContentDefinitionsV1()
      .find((definition) => definition.id === 'eyebite')?.activities as readonly Dnd5eActivityDefinitionV1[] | undefined)
      ?.find((candidate) => candidate.id === 'spell:eyebite:use-gaze')!
    const liveCasterSnapshot: Dnd5eActivityActorSnapshot = {
      ...actorSnapshot,
      activeEffectDefinitionIds: (state.combatants.caster.classState.activeEffects ?? []).map((effect) => ({
        definitionId: effect.definitionId,
        sourceActorId: effect.source.actorId,
      })),
    }
    const secondSnapshot: Dnd5eActivityActorSnapshot = {
      id: second.id, controller: second.controller, level: 5,
      proficiencyBonus: second.proficiencyBonus, abilities: second.abilities,
      armorClass: second.armorClass, conditions: [], currentHp: second.currentHp,
      maxHp: second.maxHp, savingThrowModifiers: { wis: 0 },
      activeEffectDefinitionIds: [],
    }
    const controlResolution = resolveDnd5eActivity({
      activity: controlActivity, actor: liveCasterSnapshot, targets: [secondSnapshot],
      choices: { mode: 'sickened' },
      rolls: { [`spell-save-d20:${second.id}`]: { values: [1] } },
      checkRollModes: { [`spell-save:${second.id}`]: 'normal' },
      distanceFeetByTargetId: { second: 30 },
    })
    expect(controlResolution.ok, controlResolution.ok ? undefined : controlResolution.details.join('; ')).toBe(true)
    if (!controlResolution.ok) return
    const controlled = commitDnd5eActivityExecution(state, {
      actorId: caster.id, activityId: controlActivity.id, targetIds: [second.id],
      resolution: controlResolution, source: { kind: 'spell', id: 'eyebite' },
    })
    expect(controlled.ok, controlled.ok ? undefined : controlled.reason).toBe(true)
    if (!controlled.ok) return
    expect(controlled.state.combatants.second.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ definitionId: expect.stringContaining(':eyebite-sickened') }),
      expect.objectContaining({ definitionId: expect.stringContaining(':eyebite-immunity') }),
    ]))
    expect(controlled.state.combatants.caster.classResources['dnd5e-spell-slot-6']).toEqual({ current: 0, max: 1 })
  })

  it('commits Feeblemind damage and both recoverable ability reductions from one failed save', () => {
    const caster = combatant('caster', 'player', 20)
    caster.classResources['dnd5e-spell-slot-8'] = { current: 1, max: 1 }
    const target = combatant('target', 'dm', 10)
    target.abilities = { ...target.abilities, int: 16, cha: 14 }
    target.baseSavingThrowBonuses = { ...target.baseSavingThrowBonuses, int: 3, cha: 2 }
    target.savingThrowBonuses = { ...target.savingThrowBonuses, int: 3, cha: 2 }
    const state = startDnd5eHeadlessCombat('activity-feeblemind', [caster, target])
    const activity = dnd5eSrdAuditedSpellActivityV1('feeblemind')!
    const resolution = resolveDnd5eActivity({
      activity,
      actor: {
        id: caster.id, controller: 'player', level: 15, proficiencyBonus: 5, abilities,
        armorClass: caster.armorClass, conditions: [], currentHp: caster.currentHp,
        maxHp: caster.maxHp, spellSaveDc: 18,
      },
      targets: [{
        id: target.id, controller: 'dm', level: 8, proficiencyBonus: 3,
        abilities: { ...abilities, int: 16, cha: 14 }, armorClass: target.armorClass,
        conditions: [], currentHp: target.currentHp, maxHp: target.maxHp,
        savingThrowModifiers: { int: 3, cha: 2 },
      }],
      castLevel: 8,
      rolls: {
        [`spell-save-d20:${target.id}`]: { values: [2] },
        'feeblemind-damage': { values: [1, 2, 3, 4] },
      },
      checkRollModes: { [`spell-save:${target.id}`]: 'normal' },
      distanceFeetByTargetId: { [target.id]: 30 },
    })
    expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
    if (!resolution.ok) return
    expect(resolution.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'deal-damage', amount: 10, damageType: 'psychic' }),
      expect.objectContaining({ kind: 'lower-ability-score', ability: 'int', maximumScore: 1 }),
      expect.objectContaining({ kind: 'lower-ability-score', ability: 'cha', maximumScore: 1 }),
      expect.objectContaining({ kind: 'apply-effect', effectId: 'feeblemind' }),
    ]))

    const committed = commitDnd5eActivityExecution(state, {
      actorId: caster.id, activityId: activity.id, castLevel: 8,
      targetIds: [target.id], resolution,
      source: { kind: 'spell', id: 'feeblemind' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    const affected = committed.state.combatants[target.id]
    expect(affected.currentHp).toBe(20)
    expect(affected.abilities).toMatchObject({ int: 1, cha: 1 })
    expect(affected.savingThrowBonuses).toMatchObject({ int: -5, cha: -5 })
    expect(affected.classState.abilityScoreReductionLedger).toEqual([
      expect.objectContaining({ ability: 'int', amount: 15, recovery: 'restoration-magic', recoveryGroupId: 'spell.feeblemind' }),
      expect.objectContaining({ ability: 'cha', amount: 13, recovery: 'restoration-magic', recoveryGroupId: 'spell.feeblemind' }),
    ])
    expect(affected.classState.activeEffects).toContainEqual(expect.objectContaining({
      tags: expect.arrayContaining(['feeblemind']),
      calendarRepeatSave: expect.objectContaining({
        intervalMinutes: 43_200, ability: 'int', dc: 18, onSuccess: 'remove',
      }),
      modifiers: expect.objectContaining({
        actionRestriction: expect.objectContaining({
          prohibited: expect.arrayContaining(['spellcasting', 'object-interaction', 'speech']),
        }),
        languageRestriction: {
          understandLanguages: false,
          intelligibleCommunication: false,
        },
      }),
    }))

    const restored = commitDnd5eActivityExecution(committed.state, {
      actorId: caster.id, activityId: 'spell:greater-restoration', castLevel: 5,
      targetIds: [target.id], source: { kind: 'spell', id: 'greater-restoration' },
      resolution: {
        ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
          kind: 'recover-ability-score', operationId: 'restore-intelligence',
          targetId: target.id, ability: 'int', maximumCount: 1,
        }],
      },
    })
    expect(restored.ok, restored.ok ? undefined : restored.reason).toBe(true)
    if (!restored.ok) return
    const recovered = restored.state.combatants[target.id]
    expect(recovered.abilities).toMatchObject({ int: 16, cha: 14 })
    expect(recovered.savingThrowBonuses).toMatchObject({ int: 3, cha: 2 })
    expect(recovered.classState.abilityScoreReductionLedger).toBeUndefined()
    expect(recovered.classState.activeEffects?.some((effect) =>
      effect.tags?.includes('feeblemind')) ?? false).toBe(false)
    expect(restored.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'ability-score-restored', ability: 'int', amount: 15 }),
      expect.objectContaining({ type: 'ability-score-restored', ability: 'cha', amount: 13 }),
      expect.objectContaining({ type: 'active-effect-removed', reason: 'healed' }),
    ]))
  })

  it('keeps Mislead invisibility after the spell creates its concentration-linked projection', () => {
    const caster = combatant('caster', 'player', 20)
    caster.level = 20
    caster.classResources['dnd5e-spell-slot-5'] = { current: 1, max: 1 }
    const enemy = combatant('enemy', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-mislead', [caster, enemy])
    const activity = dnd5eSrdAuditedSpellActivityV1('mislead')!
    const actorSnapshot = dnd5eActivityActorSnapshotFromCombatantV1(caster, caster)
    const resolution = resolveDnd5eActivity({
      activity, actor: actorSnapshot, targets: [actorSnapshot], castLevel: 5,
      rolls: {}, distanceFeetByTargetId: { caster: 0 },
      areaPlacement: { x: 0, y: 0, radiusFeet: 5 }, areaPlacementDistanceFeet: 0,
    })
    expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
    if (!resolution.ok) return
    expect(resolution.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'apply-effect', effectId: 'mislead-controller' }),
      expect.objectContaining({ kind: 'apply-effect', effectId: 'mislead-invisible' }),
      expect.objectContaining({ kind: 'create-persistent-area', concentration: true }),
    ]))
    const committed = commitDnd5eActivityExecution(state, {
      actorId: caster.id, activityId: activity.id, castLevel: 5,
      targetIds: [caster.id], resolution, source: { kind: 'spell', id: 'mislead' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants.caster.conditions).toContain('invisible')
    expect(committed.state.combatants.caster.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        definitionId: 'activity:spell:mislead:mislead-invisible',
        standardCondition: 'invisible',
        breakOn: expect.arrayContaining(['makes-attack', 'casts-spell']),
      }),
    ]))
  })

  it('commits an audited domination effect, queues its damage retry, and removes it after a successful save', () => {
    const caster = combatant('caster', 'player', 20)
    caster.classResources['dnd5e-spell-slot-5'] = { current: 1, max: 1 }
    const ally = combatant('ally', 'player', 15)
    const outsider = combatant('outsider', 'dm', 12)
    const target = combatant('target', 'dm', 10)
    target.creatureType = 'humanoid'
    const state = startDnd5eHeadlessCombat('activity-dominate-person', [caster, ally, outsider, target])
    const activity = dnd5eSrdAuditedSpellActivityV1('dominate-person')!
    const resolution = resolveDnd5eActivity({
      activity,
      actor: {
        id: caster.id, controller: 'player', level: 9, proficiencyBonus: 4, abilities,
        armorClass: caster.armorClass, conditions: [], currentHp: caster.currentHp,
        maxHp: caster.maxHp, spellSaveDc: 15,
      },
      targets: [{
        id: target.id, controller: 'dm', level: 5, proficiencyBonus: 3, abilities,
        armorClass: target.armorClass, conditions: [], currentHp: target.currentHp,
        maxHp: target.maxHp, creatureType: target.creatureType, savingThrowModifiers: { wis: 0 },
      }],
      castLevel: 5,
      rolls: { [`spell-save-d20:${target.id}`]: { values: [2] } },
      checkRollModes: { [`spell-save:${target.id}`]: 'normal' },
      distanceFeetByTargetId: { [target.id]: 30 },
    })
    expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
    if (!resolution.ok) return
    expect(resolution.status).toBe('dm-adjudication-required')
    expect(resolution.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'apply-effect', targetId: target.id,
        repeatSaveOnDamage: expect.objectContaining({ ability: 'wis', dc: 15 }),
      }),
    ]))
    const committed = commitDnd5eActivityExecution(state, {
      actorId: caster.id, activityId: activity.id, castLevel: 5,
      targetIds: [target.id], resolution, dmApproved: true,
      source: { kind: 'spell', id: 'dominate-person' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    const effect = committed.state.combatants[target.id].classState.activeEffects?.find((candidate) =>
      candidate.source.rulesId === activity.id && candidate.repeatSave?.timing === 'on-damage')
    expect(effect).toMatchObject({
      standardCondition: 'charmed',
      repeatSave: {
        ability: 'wis', dc: 15, timing: 'on-damage',
        onDamage: {
          mode: 'normal', sourceFilter: 'any', advantageIfSourceOrAllies: true,
        },
        onSuccess: 'remove',
      },
    })

    committed.state.initiativeIndex = committed.state.initiativeOrder.indexOf(ally.id)
    const damaged = resolveDnd5eHeadlessAction(committed.state, {
      type: 'attack', actorId: ally.id, targetId: target.id, attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' },
    })
    expect(damaged.ok, damaged.ok ? undefined : damaged.reason).toBe(true)
    if (!damaged.ok || !effect) return
    expect(damaged.state.combatants[target.id].classState.activeEffectDamageSavePendingIds).toContain(effect.id)
    expect(damaged.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-required', targetId: target.id, effectId: effect.id,
      ability: 'wis', dc: 15, timing: 'takes-damage', mode: 'advantage',
    }))

    const retained = resolveDnd5eHeadlessAction(damaged.state, {
      type: 'active-effect-damage-save', actorId: target.id, effectId: effect.id,
      d20: 1, d20Second: 2,
    })
    expect(retained.ok, retained.ok ? undefined : retained.reason).toBe(true)
    if (!retained.ok) return
    expect(retained.state.combatants[target.id].conditions).toContain('charmed')

    retained.state.initiativeIndex = retained.state.initiativeOrder.indexOf(outsider.id)
    const outsiderDamage = resolveDnd5eHeadlessAction(retained.state, {
      type: 'attack', actorId: outsider.id, targetId: target.id, attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' },
    })
    expect(outsiderDamage.ok, outsiderDamage.ok ? undefined : outsiderDamage.reason).toBe(true)
    if (!outsiderDamage.ok) return
    expect(outsiderDamage.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-required', targetId: target.id, effectId: effect.id,
      ability: 'wis', dc: 15, timing: 'takes-damage', mode: 'normal',
    }))

    const escaped = resolveDnd5eHeadlessAction(outsiderDamage.state, {
      type: 'active-effect-damage-save', actorId: target.id, effectId: effect.id, d20: 20,
    })
    expect(escaped.ok, escaped.ok ? undefined : escaped.reason).toBe(true)
    if (!escaped.ok) return
    expect(escaped.state.combatants[target.id].conditions).not.toContain('charmed')
    expect(escaped.state.combatants[target.id].classState.activeEffects?.some((candidate) => candidate.id === effect.id) ?? false).toBe(false)
    expect(escaped.state.combatants[caster.id].concentrating).toBe(false)
  })

  it('enforces Gaseous Form combat restrictions, nonmagical resistance, hover, and zero-HP break', () => {
    const caster = combatant('caster', 'player', 20)
    caster.classResources['dnd5e-spell-slot-3'] = { current: 1, max: 1 }
    const mist = combatant('mist', 'player', 15)
    const enemy = combatant('enemy', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-gaseous-form', [caster, mist, enemy])
    const activity = dnd5eSrdAuditedSpellActivityV1('gaseous-form')!
    const resolution = resolveDnd5eActivity({
      activity,
      actor: {
        id: caster.id, controller: 'player', level: 5, proficiencyBonus: 3, abilities,
        armorClass: caster.armorClass, conditions: [], currentHp: caster.currentHp,
        maxHp: caster.maxHp, spellSaveDc: 15,
      },
      targets: [{
        id: mist.id, controller: 'player', level: 5, proficiencyBonus: 3, abilities,
        armorClass: mist.armorClass, conditions: [], currentHp: mist.currentHp, maxHp: mist.maxHp,
      }],
      castLevel: 3,
      rolls: {},
      distanceFeetByTargetId: { [mist.id]: 5 },
    })
    expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
    if (!resolution.ok) return
    const committed = commitDnd5eActivityExecution(state, {
      actorId: caster.id, activityId: activity.id, castLevel: 3,
      targetIds: [mist.id], resolution, source: { kind: 'spell', id: 'gaseous-form' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    const transformed = committed.state.combatants[mist.id]
    expect(transformed.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        definitionId: expect.stringContaining('gaseous-form'), breakOn: ['reduced-to-zero'],
        modifiers: expect.objectContaining({
          speedOverrideFeet: 10, flySpeedFeet: 10, hoverWhileFlying: true,
          actionRestriction: expect.objectContaining({ prohibited: expect.arrayContaining(['attack', 'spellcasting', 'object-interaction', 'speech']) }),
          environmentalCapabilities: expect.objectContaining({ occupyCreatureSpaces: true, treatLiquidSurfacesAsSolidGround: true }),
        }),
      }),
    ]))
    expect(dnd5eEffectiveSpeed(transformed)).toBe(10)
    expect(dnd5eEffectiveFlySpeed(transformed)).toBe(10)
    const persistedEffectState = validateAndMigrateSharedResource('characters', {
      characters: [{
        id: mist.id,
        name: mist.name,
        conditions: transformed.conditions,
        dnd5eCombatState: {
          schemaVersion: 2,
          activeEffects: transformed.classState.activeEffects,
        },
      }],
    })
    expect(
      persistedEffectState.status,
      persistedEffectState.status === 'invalid' ? persistedEffectState.reasons.join('; ') : undefined,
    ).toBe('valid')

    committed.state.initiativeIndex = committed.state.initiativeOrder.indexOf(mist.id)
    transformed.turn.actionAvailable = true
    const forbiddenAttack = resolveDnd5eHeadlessAction(committed.state, {
      type: 'attack', actorId: mist.id, targetId: enemy.id, attackModifier: 5,
      d20: 15, damage: { count: 1, sides: 6, bonus: 3, rolls: [4], type: 'bludgeoning' },
    })
    expect(forbiddenAttack).toMatchObject({ ok: false, reason: 'action-prohibited' })
    const forbiddenSpell = resolveDnd5eHeadlessAction(committed.state, {
      type: 'cast-spell', actorId: mist.id, targetId: enemy.id,
      spellId: 'fire-bolt', slotLevel: 0, d20: 15, effectRolls: [4],
    })
    expect(forbiddenSpell).toMatchObject({
      ok: false,
      reason: 'spellcasting-prohibited',
    })
    expect(transformed.turn.actionAvailable).toBe(true)
    const allowedDash = resolveDnd5eHeadlessAction(committed.state, { type: 'dash', actorId: mist.id })
    expect(allowedDash.ok, allowedDash.ok ? undefined : allowedDash.reason).toBe(true)

    committed.state.initiativeIndex = committed.state.initiativeOrder.indexOf(enemy.id)
    const resisted = resolveDnd5eHeadlessAction(committed.state, {
      type: 'attack', actorId: enemy.id, targetId: mist.id, attackModifier: 20,
      d20: 10, damage: { count: 1, sides: 20, bonus: 0, rolls: [10], type: 'bludgeoning' },
    })
    expect(resisted.ok, resisted.ok ? undefined : resisted.reason).toBe(true)
    if (!resisted.ok) return
    expect(resisted.state.combatants[mist.id].currentHp).toBe(25)

    resisted.state.combatants[enemy.id].turn.actionAvailable = true
    const dropped = resolveDnd5eHeadlessAction(resisted.state, {
      type: 'attack', actorId: enemy.id, targetId: mist.id, attackModifier: 20,
      d20: 10, damage: { count: 1, sides: 100, bonus: 0, rolls: [60], type: 'bludgeoning' },
    })
    expect(dropped.ok, dropped.ok ? undefined : dropped.reason).toBe(true)
    if (!dropped.ok) return
    expect(dropped.state.combatants[mist.id].currentHp).toBe(0)
    expect(dropped.state.combatants[mist.id].classState.activeEffects?.some(
      (effect) => effect.definitionId === 'gaseous-form',
    )).toBe(false)
  })

  it('settles Divine Word HP bands, instant death, and planar return through one Activity transaction', () => {
    const actor = combatant('actor', 'player', 20)
    actor.classResources['dnd5e-spell-slot-7'] = { current: 1, max: 1 }
    const targets = [
      { id: 'hp45', hp: 45 },
      { id: 'hp35', hp: 35 },
      { id: 'hp25', hp: 25 },
      { id: 'hp15', hp: 15 },
      { id: 'fiend', hp: 80, creatureType: 'fiend' },
    ].map(({ id, hp, creatureType }) => {
      const target = combatant(id, 'dm', 10)
      target.currentHp = hp
      target.maxHp = Math.max(hp, 80)
      target.creatureType = creatureType
      return target
    })
    const state = startDnd5eHeadlessCombat('activity-divine-word', [actor, ...targets])
    const activity = dnd5eSrdAuditedSpellActivityV1('divine-word')!
    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: actor.id, controller: 'player', level: 13, proficiencyBonus: 5, abilities,
      armorClass: actor.armorClass, conditions: [], currentHp: actor.currentHp, maxHp: actor.maxHp,
      spellSaveDc: 17,
    }
    const targetSnapshots: Dnd5eActivityActorSnapshot[] = targets.map((target) => ({
      id: target.id, controller: 'dm', level: 5, proficiencyBonus: 3, abilities,
      armorClass: target.armorClass, conditions: [], currentHp: target.currentHp, maxHp: target.maxHp,
      creatureType: target.creatureType, savingThrowModifiers: { cha: 0 },
    }))
    const rolls = Object.fromEntries(targets.map((target) => [`spell-save-d20:${target.id}`, { values: [1] }]))
    const checkRollModes = Object.fromEntries(targets.map((target) => [`spell-save:${target.id}`, 'normal' as const]))
    const resolution = resolveDnd5eActivity({
      activity, actor: actorSnapshot, targets: targetSnapshots, castLevel: 7, rolls, checkRollModes,
      distanceFeetByTargetId: Object.fromEntries(targets.map((target) => [target.id, 15])),
    })
    expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
    if (!resolution.ok) return
    const committed = commitDnd5eActivityExecution(state, {
      actorId: actor.id, activityId: activity.id, castLevel: 7,
      targetIds: targets.map((target) => target.id), resolution,
      source: { kind: 'spell', id: 'divine-word' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants.hp45.conditions).toEqual(expect.arrayContaining(['deafened']))
    expect(committed.state.combatants.hp45.conditions).not.toContain('blinded')
    expect(committed.state.combatants.hp35.conditions).toEqual(expect.arrayContaining(['deafened', 'blinded']))
    expect(committed.state.combatants.hp35.conditions).not.toContain('stunned')
    expect(committed.state.combatants.hp25.conditions).toEqual(expect.arrayContaining(['deafened', 'blinded', 'stunned']))
    expect(committed.state.combatants.hp15.deathSaves.dead).toBe(true)
    expect(committed.state.combatants.hp15.currentHp).toBe(0)
    expect(committed.state.combatants.fiend.conditions).toContain('banished')
    expect(committed.state.combatants.fiend.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ legacyCondition: 'banished', duration: expect.objectContaining({ remainingRounds: 14_400 }) }),
    ]))
    expect(committed.state.combatants.actor.classResources['dnd5e-spell-slot-7']?.current).toBe(0)
    expect(committed.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    expect(committed.events).toContainEqual({
      type: 'instant-death', sourceId: actor.id, targetId: 'hp15', hpBefore: 15,
    })
  })

  it('revives only an eligible authoritative corpse and records body/penalty state', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    target.currentHp = 0
    target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    target.classState.deathRound = 1
    target.classState.bodyPresent = true
    target.classState.missingBodyParts = ['left-arm']
    target.classState.vitalBodyPartsMissing = true
    target.classState.activeEffects = [
      createDnd5eMechanicalEffect({
        id: 'ordinary-disease', definitionId: 'test:disease:ordinary', label: '普通疾病',
        tags: ['disease'], targetId: target.id, source: { kind: 'dm', magical: false },
        duration: { type: 'permanent' },
      }),
      createDnd5eMechanicalEffect({
        id: 'magical-disease', definitionId: 'test:disease:magical', label: '魔法疾病',
        tags: ['disease'], targetId: target.id, source: { kind: 'dm', magical: true },
        duration: { type: 'permanent' },
      }),
      createDnd5eMechanicalEffect({
        id: 'curse', definitionId: 'test:curse', label: '诅咒', tags: ['curse'],
        targetId: target.id, source: { kind: 'spell', magical: true }, duration: { type: 'permanent' },
      }),
    ]
    const state = startDnd5eHeadlessCombat('activity-revive', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [{
        kind: 'revive', operationId: 'revive', targetId: target.id, hitPoints: 12,
        maximumDeathAgeRounds: 10, excludedCreatureTypes: ['undead'], requiresBody: true,
        restoreBody: 'missing-parts', removeConditions: ['poisoned'], removeDiseases: 'nonmagical',
        longRestPenalty: { initial: 4, recoveryPerLongRest: 1 },
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: actor.id, activityId: 'spell:test-revive', targetIds: [target.id], resolution,
      source: { kind: 'spell', id: 'test-revive' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants[target.id]).toMatchObject({
      currentHp: 12,
      deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
      classState: {
        bodyPresent: true,
        resurrectionPenalty: { value: -4, recoveryPerLongRest: 1 },
      },
    })
    expect(committed.state.combatants[target.id].classState.missingBodyParts).toBeUndefined()
    expect(committed.state.combatants[target.id].classState.vitalBodyPartsMissing).toBeUndefined()
    expect(committed.state.combatants[target.id].classState.activeEffects?.map((effect) => effect.id))
      .toEqual(['magical-disease', 'curse'])
    expect(committed.events).toContainEqual(expect.objectContaining({
      type: 'creature-revived', actorId: actor.id, targetId: target.id,
      hitPoints: 12, deathAgeRounds: 0, bodyRestored: 'missing-parts', penalty: -4,
    }))
  })

  it('rejects a corpse missing a vital part when the revival cannot restore body parts', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    target.currentHp = 0
    target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    target.classState.deathRound = 1
    target.classState.bodyPresent = true
    target.classState.vitalBodyPartsMissing = true
    const state = startDnd5eHeadlessCombat('activity-revive-vital-part', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
        kind: 'revive', operationId: 'raise-dead', targetId: target.id, hitPoints: 1,
        maximumDeathAgeRounds: 144_000, requiresBody: true,
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: actor.id, activityId: 'spell:raise-dead', targetIds: [target.id], resolution,
      source: { kind: 'spell', id: 'raise-dead' },
    })
    expect(committed).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(state.combatants[target.id].deathSaves.dead).toBe(true)
  })

  it('fully restores an eligible True Resurrection target, creates a missing body, and removes poison, every disease, and every curse', () => {
    const actor = combatant('true-resurrection-actor', 'player', 20)
    const target = combatant('true-resurrection-target', 'dm', 10)
    target.currentHp = 0
    target.maxHp = 47
    target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    target.classState.deathRound = 1
    target.classState.deathCause = 'other'
    target.classState.soulReturnStatus = 'free-willing'
    target.classState.bodyPresent = false
    target.classState.missingBodyParts = ['head', 'left-arm']
    target.classState.vitalBodyPartsMissing = true
    target.classState.activeEffects = [
      createDnd5eMechanicalEffect({
        id: 'true-res-disintegrated',
        definitionId: 'srd-5.1:spell:disintegrate:body-destroyed',
        label: '解离术：化为细灰', tags: ['disintegrate', 'disintegrated', 'body-destroyed'],
        targetId: target.id,
        source: { kind: 'spell', magical: true, rulesId: 'disintegrate' },
        duration: { type: 'permanent' },
      }),

      createDnd5eMechanicalEffect({
        id: 'true-res-poison', definitionId: 'test:true-res:poison', label: '中毒',
        legacyCondition: 'poisoned', targetId: target.id,
        source: { kind: 'dm', magical: false }, duration: { type: 'permanent' },
      }),
      createDnd5eMechanicalEffect({
        id: 'true-res-ordinary-disease', definitionId: 'test:true-res:disease:ordinary', label: '普通疾病',
        tags: ['disease'], targetId: target.id,
        source: { kind: 'dm', magical: false }, duration: { type: 'permanent' },
      }),
      createDnd5eMechanicalEffect({
        id: 'true-res-magical-disease', definitionId: 'test:true-res:disease:magical', label: '魔法疾病',
        tags: ['disease'], targetId: target.id,
        source: { kind: 'spell', magical: true }, duration: { type: 'permanent' },
      }),
      createDnd5eMechanicalEffect({
        id: 'true-res-curse', definitionId: 'test:true-res:curse', label: '死亡诅咒',
        tags: ['curse'], targetId: target.id,
        source: { kind: 'spell', magical: true }, duration: { type: 'permanent' },
      }),
    ]
    const state = startDnd5eHeadlessCombat('activity-true-resurrection', [actor, target])
    state.round = 1_051_200_001
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
        kind: 'revive', operationId: 'true-resurrection', targetId: target.id, hitPoints: 47,
        maximumDeathAgeRounds: 1_051_200_000, excludedCreatureTypes: ['undead'],
        excludesDeathFromOldAge: true, requiresFreeWillingSoul: true,
        restoreBody: 'complete', removeConditions: ['poisoned'], removeDiseases: 'all',
        removeCurses: 'all', createsNewBodyIfMissing: true,
        requiresSpokenNameIfBodyMissing: true, newBodyPlacementRangeFeet: 10,
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: actor.id, activityId: 'spell:true-resurrection', targetIds: [target.id], resolution,
      source: { kind: 'spell', id: 'true-resurrection' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants[target.id]).toMatchObject({
      currentHp: 47,
      deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
      classState: { bodyPresent: true },
    })
    expect(committed.state.combatants[target.id].classState).toMatchObject({
      deathRound: undefined, deathCause: undefined, soulReturnStatus: undefined,
      missingBodyParts: undefined, vitalBodyPartsMissing: undefined, activeEffects: undefined,
    })
    expect(committed.events).toContainEqual(expect.objectContaining({
      type: 'creature-revived', actorId: actor.id, targetId: target.id,
      hitPoints: 47, deathAgeRounds: 1_051_200_000, bodyRestored: 'complete',
      newBodyCreated: true, removedConditionCount: 1, removedDiseaseCount: 2,
      removedCurseCount: 1,
    }))
  })

  it.each([
    ['old age', 'old-age', 'free-willing'],
    ['an unwilling soul', 'other', 'unwilling'],
    ['an imprisoned soul', 'other', 'not-free'],
    ['an unconfirmed corpse ledger', undefined, undefined],
  ] as const)('rejects True Resurrection for %s', (_label, deathCause, soulReturnStatus) => {
    const actor = combatant(`true-resurrection-actor-${_label}`, 'player', 20)
    const target = combatant(`true-resurrection-target-${_label}`, 'dm', 10)
    target.currentHp = 0
    target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    target.classState.deathRound = 1
    target.classState.deathCause = deathCause
    target.classState.soulReturnStatus = soulReturnStatus
    target.classState.bodyPresent = true
    const state = startDnd5eHeadlessCombat(`activity-true-resurrection-${_label}`, [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
        kind: 'revive', operationId: 'true-resurrection', targetId: target.id, hitPoints: 30,
        maximumDeathAgeRounds: 1_051_200_000,
        excludesDeathFromOldAge: true, requiresFreeWillingSoul: true,
        restoreBody: 'complete', createsNewBodyIfMissing: true,
      }],
    }
    expect(commitDnd5eActivityExecution(state, {
      actorId: actor.id, activityId: 'spell:true-resurrection', targetIds: [target.id], resolution,
      source: { kind: 'spell', id: 'true-resurrection' },
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('strains the Resurrection caster at the one-year boundary until a long rest', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    target.currentHp = 0
    target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    target.classState.deathRound = 1
    target.classState.bodyPresent = true
    const state = startDnd5eHeadlessCombat('activity-resurrection-strain', [actor, target])
    state.round = 5_256_001
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
        kind: 'revive', operationId: 'resurrection', targetId: target.id, hitPoints: 30,
        maximumDeathAgeRounds: 525_600_000, requiresBody: true,
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: actor.id, activityId: 'spell:resurrection', targetIds: [target.id], resolution,
      source: { kind: 'spell', id: 'srd-5.1:spell:resurrection' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants[actor.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:resurrection:caster-strain',
        breakOn: ['long-rest-complete'],
        modifiers: expect.objectContaining({
          actionRestriction: { prohibited: ['spellcasting'] },
          attackRollDisadvantage: true,
          abilityCheckDisadvantages: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
          savingThrowDisadvantages: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
        }),
      }),
    )
    expect(committed.events).toContainEqual(expect.objectContaining({
      type: 'creature-revived', actorId: actor.id, targetId: target.id,
      deathAgeRounds: 5_256_000, casterStrained: true,
    }))
  })

  it('projects the resurrection ordeal exactly once into Activity d20 rolls', () => {
    const target = combatant('target', 'player', 10)
    target.classState.resurrectionPenalty = { value: -4, recoveryPerLongRest: 1 }
    target.savingThrowBonuses.wis = -3
    const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(target)
    expect(snapshot.d20RollModifier).toBe(-4)
    expect(snapshot.savingThrowModifiers?.wis).toBe(1)
    expect((snapshot.savingThrowModifiers?.wis ?? 0) + (snapshot.d20RollModifier ?? 0)).toBe(-3)
  })

  it('commits effects and costs atomically while returning map-owned handoffs', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-bridge', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true,
      status: 'resolved',
      checks: [],
      consumptions: [
        { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
        { kind: 'spell-slot', minimumLevel: 3, level: 'selected', amount: 1, consumeOn: 'resolve' },
        { kind: 'resource', resourceId: 'focus', amount: 1, consumeOn: 'resolve' },
      ],
      proposals: [
        { kind: 'deal-damage', operationId: 'damage', targetId: 'target', amount: 9, damageType: 'fire', magical: true },
        { kind: 'create-persistent-area', operationId: 'area', label: 'Fire zone', durationRounds: 10, concentration: true },
      ],
      areaInstance: { origin: 'point', shape: 'circle', x: 10, y: 20, radiusFeet: 10 },
    }
    const result = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:test-fire-zone', castLevel: 3,
      targetIds: ['target'], resolution,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(21)
    expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.actor.classResources['dnd5e-spell-slot-3']?.current).toBe(0)
    expect(result.state.combatants.actor.classResources.focus?.current).toBe(1)
    expect(result.activityHandoffs?.persistentAreas).toHaveLength(1)
    expect(result.areaInstance).toMatchObject({ shape: 'circle', x: 10, y: 20, radiusFeet: 10 })
    expect(result.state.combatants.actor.classState.concentrationSpellId).toBe('activity:spell:test-fire-zone')
  })

  it('links repeat-save effects to the same authoritative concentration', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-repeat-save-concentration', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [{
        kind: 'apply-effect', operationId: 'apply', targetId: 'target',
        effectId: 'charm', name: 'Charm', concentration: true,
        duration: { kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end', ability: 'wis', dc: 14 },
        conditions: ['charmed'], modifierGroups: [], stacking: 'replace',
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:concentrated-charm', castLevel: 2,
      targetIds: ['target'], resolution, source: { kind: 'spell', id: 'concentrated-charm' },
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants.actor.classState.concentrationSpellId)
      .toBe('concentrated-charm')
    expect(committed.state.combatants.target.conditions).toContain('charmed')
    expect(committed.state.combatants.target.classState.activeEffects?.[0]).toMatchObject({
      duration: { type: 'concentration', remainingRounds: 10 },
      repeatSave: { ability: 'wis', dc: 14, timing: 'target-turn-end' },
    })

    const ended = resolveDnd5eHeadlessAction(committed.state, {
      type: 'concentration-save', actorId: 'actor', d20: 1, dc: 10,
    })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.target.conditions).not.toContain('charmed')
  })

  it('ends the owning concentration when an Activity removes its concentration effect', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-remove-concentration-effect', [actor, target])
    const applied = commitDnd5eActivityExecution(state, {
      actorId: actor.id,
      activityId: 'spell:test-controller',
      castLevel: 2,
      targetIds: [actor.id],
      source: { kind: 'spell', id: 'test-controller' },
      resolution: {
        ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
          kind: 'apply-effect', operationId: 'apply-controller', targetId: actor.id,
          effectId: 'test-controller', name: 'Test Controller', concentration: true,
          duration: { kind: 'concentration', maximumRounds: 10 }, conditions: [],
          modifierGroups: [], stacking: 'replace',
        }],
      },
    })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.state.combatants.actor.concentrating).toBe(true)

    const removed = commitDnd5eActivityExecution(applied.state, {
      actorId: target.id,
      activityId: 'spell:test-contest',
      targetIds: [actor.id],
      source: { kind: 'spell', id: 'test-contest' },
      resolution: {
        ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
          kind: 'remove-effect', operationId: 'remove-controller', targetId: actor.id,
          effectId: 'test-controller', source: 'any',
        }],
      },
    })
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.state.combatants.actor.concentrating).toBe(false)
    expect(removed.state.combatants.actor.classState.concentrationSpellId).toBeUndefined()
    expect(removed.events).toContainEqual({
      type: 'class-state-changed', actorId: actor.id,
      stateKey: 'concentration', active: false,
    })
  })

  it('stores extension behaviour and modifiers as one save-ends effect', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-extension-save-group', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [{
        kind: 'apply-effect', operationId: 'apply', targetId: 'target',
        effectId: 'confusion', name: 'Confusion', concentration: true,
        duration: { kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end', ability: 'wis', dc: 19 },
        conditions: [], modifierGroups: [{ preventReactions: true }],
        extensionCondition: 'confused-behavior', stacking: 'replace',
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:confusion', castLevel: 4,
      targetIds: ['target'], resolution, source: { kind: 'spell', id: 'confusion' },
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    const effects = committed.state.combatants.target.classState.activeEffects?.filter((effect) =>
      effect.definitionId.includes(':confusion')) ?? []
    expect(effects).toHaveLength(1)
    expect(effects[0]).toMatchObject({
      legacyCondition: 'confused-behavior',
      modifiers: { preventReactions: true },
      repeatSave: { ability: 'wis', dc: 19, timing: 'target-turn-end' },
    })
  })

  it('preserves contextual Activity modifiers on the committed active effect', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'player', 20)
    const state = startDnd5eHeadlessCombat('activity-contextual-modifiers', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [{
        kind: 'apply-effect', operationId: 'apply', targetId: 'target',
        effectId: 'typed-protection', name: 'Typed Protection', disposition: 'buff', concentration: true,
        duration: { kind: 'concentration', maximumRounds: 10 }, conditions: [],
        modifierGroups: [{
          attacksAgainstTargetDisadvantageCreatureTypes: ['fiend', 'undead'],
          conditionImmunitiesBySourceCreatureType: [{
            conditions: ['charmed', 'frightened'], sourceCreatureTypes: ['fiend', 'undead'],
          }],
          savingThrowAdvantagesBySourceCreatureType: [{
            conditions: ['charmed', 'frightened'], sourceCreatureTypes: ['fiend', 'undead'],
          }],
        }],
        stacking: 'replace',
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:typed-protection', castLevel: 1,
      targetIds: ['target'], resolution, source: { kind: 'spell', id: 'typed-protection' },
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(committed.state.combatants.target.classState.activeEffects?.[0]?.kind).toBe('buff')
    expect(committed.state.combatants.target.classState.activeEffects?.[0]?.modifiers).toMatchObject({
      attacksAgainstTargetDisadvantageCreatureTypes: ['fiend', 'undead'],
      conditionImmunitiesBySourceCreatureType: [{
        conditions: ['charmed', 'frightened'], sourceCreatureTypes: ['fiend', 'undead'],
      }],
      savingThrowAdvantagesBySourceCreatureType: [{
        conditions: ['charmed', 'frightened'], sourceCreatureTypes: ['fiend', 'undead'],
      }],
    })
  })

  it('ends a source-linked concentration effect when its turn maintenance receipt is missing', () => {
    const state = startDnd5eHeadlessCombat('activity-source-maintenance', [
      combatant('actor', 'player', 20), combatant('target', 'dm', 10),
    ])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [
        {
          kind: 'apply-effect', operationId: 'apply-link', targetId: 'target',
          effectId: 'linked-charm', name: 'Linked Charm', concentration: true,
          duration: { kind: 'concentration', maximumRounds: 10 }, conditions: ['charmed'],
          modifierGroups: [], stacking: 'replace',
          sourceLink: { sourceRequiresEffectAtSourceTurnEnd: 'maintained-this-turn' },
        },
        {
          kind: 'apply-effect', operationId: 'initial-maintenance', targetId: 'actor',
          effectId: 'maintained-this-turn', name: 'Maintained', concentration: false,
          duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
          conditions: [], modifierGroups: [], stacking: 'refresh-duration',
        },
      ],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:maintained-link', castLevel: 2,
      targetIds: ['target'], resolution, source: { kind: 'spell', id: 'maintained-link' },
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return

    const firstEnd = resolveDnd5eHeadlessAction(committed.state, { type: 'end-turn', actorId: 'actor' })
    expect(firstEnd.ok).toBe(true)
    if (!firstEnd.ok) return
    expect(firstEnd.state.combatants.target.conditions).toContain('charmed')
    const targetEnd = resolveDnd5eHeadlessAction(firstEnd.state, { type: 'end-turn', actorId: 'target' })
    expect(targetEnd.ok).toBe(true)
    if (!targetEnd.ok) return
    expect(targetEnd.state.combatants.actor.classState.activeEffects?.some((effect) =>
      effect.definitionId.includes(':maintained-this-turn')) ?? false).toBe(false)
    const missingMaintenance = resolveDnd5eHeadlessAction(targetEnd.state, { type: 'end-turn', actorId: 'actor' })
    expect(missingMaintenance.ok).toBe(true)
    if (!missingMaintenance.ok) return
    expect(missingMaintenance.state.combatants.target.conditions).not.toContain('charmed')
    expect(missingMaintenance.state.combatants.actor.concentrating).toBe(false)
  })

  it('supports bounded semantic Effect removal and authoritative exhaustion recovery', () => {
    const exhaustedTarget = combatant('target', 'dm', 10)
    exhaustedTarget.exhaustionLevel = 2
    exhaustedTarget.abilities.str = 6
    exhaustedTarget.baseSavingThrowBonuses.str = -2
    exhaustedTarget.savingThrowBonuses.str = -2
    exhaustedTarget.classState.abilityScoreReductionLedger = [{
      id: 'shadow-strength-drain', ability: 'str', amount: 4, recovery: 'short-or-long-rest',
    }]
    exhaustedTarget.maxHp = 20
    exhaustedTarget.currentHp = 20
    exhaustedTarget.classState.hitPointMaximumReductionLedger = {
      schemaVersion: 1, baseMaximum: 30,
      entries: [{
        id: 'wraith-life-drain', amount: 10,
        recovery: 'greater-restoration-or-other-magic',
      }],
    }
    const state = startDnd5eHeadlessCombat('activity-effect-tags', [
      combatant('actor', 'player', 20), exhaustedTarget,
    ])
    const afflicted: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
        kind: 'apply-effect', operationId: 'disease', targetId: 'target',
        effectId: 'filth-fever', name: 'Filth Fever', tags: ['disease'], concentration: false,
        duration: { kind: 'rounds', rounds: 100, expiresAt: 'target-turn-end' },
        conditions: [], modifierGroups: [{ savingThrowDisadvantages: ['str'] }], stacking: 'replace',
      }, {
        kind: 'apply-effect', operationId: 'second-disease', targetId: 'target',
        effectId: 'mindfire', name: 'Mindfire', tags: ['disease'], concentration: false,
        duration: { kind: 'rounds', rounds: 100, expiresAt: 'target-turn-end' },
        conditions: [], modifierGroups: [{ savingThrowDisadvantages: ['int'] }], stacking: 'replace',
      }, {
        kind: 'apply-effect', operationId: 'blessing', targetId: 'target',
        effectId: 'unrelated-blessing', name: 'Blessing', tags: ['blessing'], concentration: false,
        duration: { kind: 'rounds', rounds: 100, expiresAt: 'target-turn-end' },
        conditions: [], modifierGroups: [{ savingThrowAdvantages: ['wis'] }], stacking: 'replace',
      }],
    }
    const applied = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:test-afflictions', targetIds: ['target'],
      resolution: afflicted, source: { kind: 'spell', id: 'test-afflictions' },
    })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const cured = commitDnd5eActivityExecution(applied.state, {
      actorId: 'actor', activityId: 'spell:test-cure', targetIds: ['target'],
      source: { kind: 'spell', id: 'test-cure' },
      resolution: {
        ok: true, status: 'resolved', checks: [], consumptions: [], proposals: [{
          kind: 'remove-effects-by-tag', operationId: 'cure-disease', targetId: 'target',
          tags: ['disease'], match: 'any', source: 'any', maximumCount: 1,
        }, {
          kind: 'adjust-exhaustion', operationId: 'recover-exhaustion', targetId: 'target', amount: -1,
        }, {
          kind: 'recover-ability-score', operationId: 'recover-strength', targetId: 'target',
          ability: 'str', maximumCount: 1,
        }, {
          kind: 'recover-hit-point-maximum', operationId: 'recover-maximum-hp', targetId: 'target',
          maximumCount: 1,
        }],
      },
    })
    expect(cured.ok).toBe(true)
    if (!cured.ok) return
    expect(cured.state.combatants.target.classState.activeEffects?.map((effect) => effect.tags))
      .toEqual([['disease'], ['blessing']])
    expect(cured.state.combatants.target.exhaustionLevel).toBe(1)
    expect(cured.state.combatants.target.abilities.str).toBe(10)
    expect(cured.state.combatants.target.maxHp).toBe(30)
    expect(cured.state.combatants.target.currentHp).toBe(20)
    expect(cured.state.combatants.target.classState.abilityScoreReductionLedger).toBeUndefined()
    expect(cured.state.combatants.target.classState.hitPointMaximumReductionLedger).toBeUndefined()
    expect(cured.events).toContainEqual({
      type: 'exhaustion-adjusted', actorId: 'target', before: 2, after: 1, amount: -1,
    })
  })

  it('does not partially mutate the source when a cost is unavailable', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-bridge-failure', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [],
      consumptions: [{ kind: 'resource', resourceId: 'focus', amount: 3, consumeOn: 'resolve' }],
      proposals: [{ kind: 'deal-damage', operationId: 'damage', targetId: 'target', amount: 9, damageType: 'fire', magical: true }],
    }
    const result = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'feature:test', targetIds: ['target'], resolution,
    })
    expect(result.ok).toBe(false)
    expect(state.combatants.target.currentHp).toBe(30)
    expect(state.combatants.actor.classResources.focus?.current).toBe(2)
  })

  it('refuses to interpret an item charge as a spoofed class resource', () => {
    const actor = combatant('actor', 'player', 20)
    actor.classResources['item:test:quantity'] = { current: 99, max: 99 }
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-item-core-guard', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true,
      status: 'resolved',
      checks: [],
      consumptions: [{
        kind: 'item-charge', resourceId: 'item:test:quantity', amount: 1, consumeOn: 'resolve',
      }],
      proposals: [{
        kind: 'deal-damage', operationId: 'damage', targetId: 'target', amount: 5, damageType: 'force', magical: true,
      }],
    }
    const result = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'item:test', targetIds: ['target'], resolution,
    })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
    expect(result.state.combatants.target.currentHp).toBe(30)
    expect(result.state.combatants.actor.classResources['item:test:quantity']?.current).toBe(99)
  })

  it('atomically spends a real item instance and durably deduplicates the command', () => {
    registerDnd5eActivityPackage({
      packageId: 'test.item-package',
      packageVersion: '1.0.0',
      activities: [{
        schemaVersion: 1,
        id: 'item:srd-5.1:item:potion-of-healing:use',
        name: 'Charged strike',
        activation: { kind: 'action' },
        target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
        consumption: [
          { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
          {
            kind: 'item-charge',
            resourceId: 'item:srd-5.1:item:potion-of-healing:quantity',
            amount: { kind: 'constant', value: 1 },
            consumeOn: 'resolve',
          },
        ],
        outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
          id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 5 }, damageType: 'force',
        }] }],
        automation: automationCapabilityFromLegacyStatus('full'),
        legacySource: { kind: 'item', id: 'srd-5.1:item:potion-of-healing' },
      }],
    })
    const inventoryOwner = normalizeCharacter({
      id: 'actor', name: 'actor', player: 'actor', charClass: '法师', maxHp: 30, currentHp: 30,
      equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] },
    })
    const granted = applyDnd5eInventoryMutation([inventoryOwner], {
      type: 'grant', characterId: 'actor', templateId: 'srd-5.1:item:potion-of-healing', quantity: 2,
    })
    const owner = granted.characters[0]
    const entry = normalizeDnd5eInventory(owner).entries[0]
    const actorCombatant = combatant('actor', 'player', 20)
    const targetCombatant = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-item-bridge', [actorCombatant, targetCombatant])
    const command = {
      schemaVersion: 1 as const,
      commandId: 'item-command-1',
      actorId: 'actor',
      packageId: 'test.item-package',
      packageVersion: '1.0.0',
      activityId: 'item:srd-5.1:item:potion-of-healing:use',
      targetIds: ['target'],
      expectedRevision: 0,
      inventoryInstanceId: entry.instanceId,
      expectedInventoryRevision: normalizeDnd5eInventory(owner).revision ?? 0,
    }
    const actorSnapshot = {
      id: 'actor', controller: 'players' as const, level: 5, proficiencyBonus: 3, abilities,
      armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
    }
    const targetSnapshot = {
      id: 'target', controller: 'dm' as const, level: 5, proficiencyBonus: 3, abilities,
      armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
    }
    const first = resolveAndCommitDnd5eActivityCommand(state, {
      command,
      currentRevision: 0,
      actor: actorSnapshot,
      targets: [targetSnapshot],
      authoritativeRolls: {},
      distanceFeetByTargetId: { target: 15 },
      inventoryOwner: owner,
    })
    expect(first.phase).toBe('commit')
    if (first.phase !== 'commit' || !first.result.ok) return
    expect(first.result.state.combatants.target.currentHp).toBe(25)
    expect(first.result.state.combatants.actor.classResources['item:srd-5.1:item:potion-of-healing:quantity']).toBeUndefined()
    expect(normalizeDnd5eInventory(first.result.inventoryOwner!).entries[0].quantity).toBe(1)

    const replay = resolveAndCommitDnd5eActivityCommand(first.result.state, {
      command,
      currentRevision: 0,
      actor: actorSnapshot,
      targets: [targetSnapshot],
      authoritativeRolls: {},
      distanceFeetByTargetId: { target: 15 },
      inventoryOwner: first.result.inventoryOwner,
    })
    expect(replay).toMatchObject({
      phase: 'commit',
      result: { ok: true, inventoryDeduplicated: true, events: [] },
    })
    if (replay.phase === 'commit' && replay.result.ok) {
      expect(replay.result.state.combatants.target.currentHp).toBe(25)
      expect(normalizeDnd5eInventory(replay.result.inventoryOwner!).entries[0].quantity).toBe(1)
    }
  })

  it('casts Goodberry into expiring inventory exactly once while spending the spell action and slot', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('goodberry')!
    registerDnd5eActivityPackage({
      packageId: 'srd-5.1', packageVersion: '1.0.0', activities: [activity],
    })
    const actorCombatant = combatant('actor', 'player', 20)
    actorCombatant.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
    const state = startDnd5eHeadlessCombat('activity-goodberry-bridge', [actorCombatant])
    const inventoryOwner = normalizeCharacter({
      id: 'actor', name: 'actor', player: 'actor', charClass: '德鲁伊', maxHp: 30, currentHp: 20,
      equipment: {}, dnd5eWorldTimeAppliedMinute: 1_000,
      dnd5eInventory: { schemaVersion: 1, entries: [] },
    })
    const actorSnapshot = {
      id: 'actor', controller: 'players' as const, level: 5, proficiencyBonus: 3, abilities,
      armorClass: 14, conditions: [], currentHp: 20, maxHp: 30,
      resources: { 'dnd5e-spell-slot-1': { current: 1, maximum: 1 } },
    }
    const command = {
      schemaVersion: 1 as const,
      commandId: 'goodberry-command-1',
      actorId: 'actor',
      packageId: 'srd-5.1',
      packageVersion: '1.0.0',
      activityId: activity.id,
      targetIds: ['actor'],
      castLevel: 1,
      expectedRevision: 0,
    }
    const first = resolveAndCommitDnd5eActivityCommand(state, {
      command, currentRevision: 0, actor: actorSnapshot, targets: [actorSnapshot],
      authoritativeRolls: {}, distanceFeetByTargetId: { actor: 0 }, inventoryOwner,
    })
    expect(first.phase).toBe('commit')
    if (first.phase !== 'commit' || !first.result.ok) return
    expect(first.result.state.combatants.actor).toMatchObject({
      classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 1 } },
      turn: { action: { current: 0, max: 1 } },
    })
    const berries = normalizeDnd5eInventory(first.result.inventoryOwner!).entries
      .find((entry) => entry.templateId === 'srd-5.1:item:goodberry')
    expect(berries).toMatchObject({ quantity: 10, expiresAtWorldMinute: 2_440 })

    const replay = resolveAndCommitDnd5eActivityCommand(first.result.state, {
      command, currentRevision: 0, actor: actorSnapshot, targets: [actorSnapshot],
      authoritativeRolls: {}, distanceFeetByTargetId: { actor: 0 },
      inventoryOwner: first.result.inventoryOwner,
    })
    expect(replay).toMatchObject({
      phase: 'commit', result: { ok: true, inventoryDeduplicated: true, events: [] },
    })
    if (replay.phase === 'commit' && replay.result.ok) {
      expect(normalizeDnd5eInventory(replay.result.inventoryOwner!).entries
        .find((entry) => entry.templateId === 'srd-5.1:item:goodberry')?.quantity).toBe(10)
      expect(replay.result.state.combatants.actor.classResources['dnd5e-spell-slot-1']?.current).toBe(0)
    }
  })

  it('casts Create Food and Water into independently expiring food and durable water stacks', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('create-food-and-water')!
    registerDnd5eActivityPackage({
      packageId: 'srd-5.1', packageVersion: '1.0.0', activities: [activity],
    })
    const actorCombatant = combatant('actor', 'player', 20)
    const state = startDnd5eHeadlessCombat('activity-create-food-bridge', [actorCombatant])
    const inventoryOwner = normalizeCharacter({
      id: 'actor', name: 'actor', player: 'actor', charClass: '牧师', maxHp: 30, currentHp: 30,
      equipment: {}, dnd5eWorldTimeAppliedMinute: 800,
      dnd5eInventory: { schemaVersion: 1, entries: [] },
    })
    const actorSnapshot = {
      id: 'actor', controller: 'players' as const, level: 5, proficiencyBonus: 3, abilities,
      armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
      resources: { 'dnd5e-spell-slot-3': { current: 1, maximum: 1 } },
    }
    const result = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'create-food-command-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: activity.id,
        targetIds: ['actor'], castLevel: 3, expectedRevision: 0,
      },
      currentRevision: 0, actor: actorSnapshot, targets: [actorSnapshot],
      authoritativeRolls: {}, distanceFeetByTargetId: { actor: 0 }, inventoryOwner,
    })
    expect(result.phase, JSON.stringify(result)).toBe('commit')
    if (result.phase !== 'commit' || !result.result.ok) return
    const entries = normalizeDnd5eInventory(result.result.inventoryOwner!).entries
    expect(entries.find((entry) => entry.templateId === 'srd-5.1:item:conjured-food-portion'))
      .toMatchObject({ quantity: 15, expiresAtWorldMinute: 2_240 })
    expect(entries.find((entry) => entry.templateId === 'srd-5.1:item:conjured-water-gallon'))
      .toMatchObject({ quantity: 30, expiresAtWorldMinute: undefined })
  })

  it('casts Identify through the selected inventory instance and rejects replay duplication', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('identify')!
    registerDnd5eActivityPackage({
      packageId: 'srd-5.1', packageVersion: '1.0.0', activities: [activity],
    })
    const actorCombatant = combatant('actor', 'player', 20)
    actorCombatant.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
    const state = startDnd5eHeadlessCombat('activity-identify-bridge', [actorCombatant])
    const emptyOwner = normalizeCharacter({
      id: 'actor', name: 'actor', player: 'actor', charClass: '法师', maxHp: 30, currentHp: 30,
      equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] },
    })
    const granted = applyDnd5eInventoryMutation([emptyOwner], {
      type: 'grant', characterId: 'actor', templateId: 'srd-5.1:magic-item:ring-of-protection',
      quantity: 1, identified: false,
    })
    const inventoryOwner = granted.characters[0]
    const entry = normalizeDnd5eInventory(inventoryOwner).entries[0]
    const actorSnapshot = {
      id: 'actor', controller: 'players' as const, level: 5, proficiencyBonus: 3, abilities,
      armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
      resources: { 'dnd5e-spell-slot-1': { current: 1, maximum: 1 } },
    }
    const command = {
      schemaVersion: 1 as const, commandId: 'identify-command-1', actorId: 'actor',
      packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: activity.id,
      targetIds: ['actor'], castLevel: 1, expectedRevision: 0,
      inventoryInstanceId: entry.instanceId,
      expectedInventoryRevision: normalizeDnd5eInventory(inventoryOwner).revision ?? 0,
    }
    const first = resolveAndCommitDnd5eActivityCommand(state, {
      command, currentRevision: 0, actor: actorSnapshot, targets: [actorSnapshot],
      authoritativeRolls: {}, distanceFeetByTargetId: { actor: 0 }, inventoryOwner,
    })
    expect(first.phase).toBe('commit')
    if (first.phase !== 'commit' || !first.result.ok) return
    expect(normalizeDnd5eInventory(first.result.inventoryOwner!).entries[0].identified).toBe(true)
    expect(first.result.state.combatants.actor.classResources['dnd5e-spell-slot-1']?.current).toBe(0)

    const replay = resolveAndCommitDnd5eActivityCommand(first.result.state, {
      command, currentRevision: 0, actor: actorSnapshot, targets: [actorSnapshot],
      authoritativeRolls: {}, distanceFeetByTargetId: { actor: 0 },
      inventoryOwner: first.result.inventoryOwner,
    })
    expect(replay).toMatchObject({
      phase: 'commit', result: { ok: true, inventoryDeduplicated: true, events: [] },
    })
  })

  it('breaks cursed-item attunement through the selected target inventory without deleting the curse', () => {
    const definition = dnd5eSrdAuditedFullContentDefinitionsV1()
      .find((entry) => entry.id === 'remove-curse')!
    const activity = (definition.activities as readonly Dnd5eActivityDefinitionV1[]).find((entry) =>
      entry.id === 'spell:remove-curse:cursed-item')!
    registerDnd5eActivityPackage({
      packageId: 'srd-5.1', packageVersion: '1.0.0', activities: [activity],
    })
    const caster = combatant('actor', 'player', 20)
    const target = combatant('target', 'player', 10)
    const state = startDnd5eHeadlessCombat('activity-remove-curse-item', [caster, target])
    const emptyTarget = normalizeCharacter({
      id: 'target', name: 'target', player: 'target', charClass: '战士',
      maxHp: 30, currentHp: 30, equipment: {},
      dnd5eInventory: { schemaVersion: 1, entries: [] },
    })
    const granted = applyDnd5eInventoryMutation([emptyTarget], {
      type: 'grant', characterId: 'target',
      templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1,
    })
    const grantedInventory = normalizeDnd5eInventory(granted.characters[0])
    const inventoryOwner = {
      ...granted.characters[0],
      dnd5eInventory: {
        ...grantedInventory,
        entries: grantedInventory.entries.map((entry) => ({
          ...entry,
          templateId: 'local:test-cursed-ring',
          attuned: true,
          item: {
            ...entry.item,
            id: 'local:test-cursed-ring',
            magicItem: { ...entry.item.magicItem!, cursed: true },
          },
        })),
      },
    }
    const entry = normalizeDnd5eInventory(inventoryOwner).entries[0]
    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3, abilities,
      armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
      resources: { 'dnd5e-spell-slot-3': { current: 1, maximum: 1 } },
    }
    const targetSnapshot: Dnd5eActivityActorSnapshot = {
      id: 'target', controller: 'players', level: 5, proficiencyBonus: 3, abilities,
      armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
    }
    const result = resolveAndCommitDnd5eActivityCommand(state, {
      command: {
        schemaVersion: 1, commandId: 'remove-curse-item-command-1', actorId: 'actor',
        packageId: 'srd-5.1', packageVersion: '1.0.0', activityId: activity.id,
        targetIds: ['target'], castLevel: 3, expectedRevision: 0,
        inventoryInstanceId: entry.instanceId,
        expectedInventoryRevision: normalizeDnd5eInventory(inventoryOwner).revision ?? 0,
      },
      currentRevision: 0, actor: actorSnapshot, targets: [targetSnapshot],
      authoritativeRolls: {}, distanceFeetByTargetId: { target: 5 }, inventoryOwner,
    })
    expect(result.phase, JSON.stringify(result)).toBe('commit')
    if (result.phase !== 'commit' || !result.result.ok) return
    const changed = normalizeDnd5eInventory(result.result.inventoryOwner!).entries[0]
    expect(changed.attuned).toBeUndefined()
    expect(changed.item.magicItem?.cursed).toBe(true)
    expect(result.result.state.combatants.actor.classResources['dnd5e-spell-slot-3']?.current).toBe(0)
  })

  it('casts Blink through the generic Host turn-end random-condition primitive', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('blink')!
    const actor = combatant('actor', 'player', 20)
    actor.classResources['dnd5e-spell-slot-3'] = { current: 1, max: 1 }
    const enemy = combatant('enemy', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-blink', [actor, enemy])
    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: actor.id, controller: actor.controller, level: 5,
      proficiencyBonus: actor.proficiencyBonus, abilities: actor.abilities,
      armorClass: actor.armorClass, conditions: [], currentHp: actor.currentHp,
      maxHp: actor.maxHp, spellSaveDc: 15,
      resources: { 'dnd5e-spell-slot-3': { current: 1, maximum: 1 } },
    }
    const resolution = resolveDnd5eActivity({
      activity, actor: actorSnapshot, targets: [actorSnapshot], castLevel: 3,
      rolls: {}, distanceFeetByTargetId: { actor: 0 },
    })
    expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
    if (!resolution.ok) return
    const committed = commitDnd5eActivityExecution(state, {
      actorId: actor.id, activityId: activity.id, castLevel: 3,
      targetIds: [actor.id], resolution, source: { kind: 'spell', id: 'blink' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    const randomEffect = committed.state.combatants.actor.classState.activeEffects?.find(
      (effect) => effect.legacyCondition?.startsWith('turn-end-random-condition:'),
    )
    expect(randomEffect).toMatchObject({
      legacyCondition: 'turn-end-random-condition:20:11:banished',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      removal: { action: { label: '用动作解除闪现术', economy: 'action', maxDistanceFeet: 0 } },
    })
    expect(resolveDnd5eHeadlessAction(committed.state, {
      type: 'end-turn', actorId: actor.id,
    })).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const missed = resolveDnd5eHeadlessAction(committed.state, {
      type: 'end-turn', actorId: actor.id,
      activeEffectRandomConditionRolls: [{ effectId: randomEffect!.id, roll: 10 }],
    })
    expect(missed.ok).toBe(true)
    if (!missed.ok) return
    expect(missed.state.combatants.actor.conditions).not.toContain('banished')
    expect(missed.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-random-condition-resolved', roll: 10, triggered: false,
    }))

    const triggered = resolveDnd5eHeadlessAction(committed.state, {
      type: 'end-turn', actorId: actor.id,
      activeEffectRandomConditionRolls: [{ effectId: randomEffect!.id, roll: 11 }],
    })
    expect(triggered.ok).toBe(true)
    if (!triggered.ok) return
    expect(triggered.state.combatants.actor.conditions).toContain('banished')
    expect(triggered.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-random-condition-resolved', roll: 11, triggered: true,
    }))

    const returned = resolveDnd5eHeadlessAction(triggered.state, {
      type: 'end-turn', actorId: enemy.id,
    })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.actor.conditions).not.toContain('banished')
    expect(returned.state.combatants.actor.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'blink-return-pending',
        grantedActivities: ['spell:blink:return'],
        source: expect.objectContaining({ pluginId: 'srd-5.1' }),
        modifiers: expect.objectContaining({
          speedOverrideFeet: 0,
          actionRestriction: expect.objectContaining({
            allowedBasicActions: ['dismiss-effect'],
            allowedActivityIds: ['spell:blink:return'],
          }),
        }),
      }),
    )
  })

  it('resolves Find Familiar to one closed SRD form and a persistent non-attacking summon', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('find-familiar')!
    const actor = combatant('actor', 'player', 20)
    actor.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
    const actorSnapshot: Dnd5eActivityActorSnapshot = {
      id: actor.id, controller: actor.controller, level: 5,
      proficiencyBonus: actor.proficiencyBonus, abilities: actor.abilities,
      armorClass: actor.armorClass, conditions: [], currentHp: actor.currentHp,
      maxHp: actor.maxHp, spellSaveDc: 15,
      resources: { 'dnd5e-spell-slot-1': { current: 1, maximum: 1 } },
    }
    const resolution = resolveDnd5eActivity({
      activity, actor: actorSnapshot, targets: [actorSnapshot], castLevel: 1,
      choices: { mode: 'srd-5.1:owl' }, rolls: {},
      distanceFeetByTargetId: { actor: 0 },
    })
    expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
    if (!resolution.ok) return
    expect(resolution.proposals).toContainEqual(expect.objectContaining({
      kind: 'summon', monsterId: 'srd-5.1:owl', count: 1,
      persistent: true, cannotAttack: true, concentration: false,
    }))
    expect(activity.choices?.[0]?.options).toHaveLength(15)
    expect(activity.choices?.[0]?.options.every((option) => option.id.startsWith('srd-5.1:'))).toBe(true)
  })

  it('casts all three SRD detection modes and derives presences from Host state', () => {
    const castDetection = (spellId: 'detect-magic' | 'detect-evil-and-good' | 'detect-poison-and-disease') => {
      const activity = dnd5eSrdAuditedSpellActivityV1(spellId)!
      const actor = combatant('actor', 'player', 20)
      actor.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
      const magicTarget = combatant('magic-target', 'dm', 15)
      magicTarget.classState.activeEffects = [createDnd5eMechanicalEffect({
        id: 'magic-target-effect', definitionId: 'srd-5.1:spell:haste', label: '加速术',
        source: { kind: 'spell', actorId: 'actor', rulesId: 'haste', spellLevel: 3, magical: true },
        targetId: magicTarget.id, duration: { type: 'concentration', sourceActorId: 'actor', concentrationId: 'haste' },
      })]
      const planarTarget = combatant('planar-target', 'dm', 10)
      planarTarget.creatureType = '天界生物'
      const poisonedTarget = combatant('poisoned-target', 'dm', 5)
      poisonedTarget.conditions = ['poisoned']
      poisonedTarget.statBlockId = 'srd-5.1:giant-spider'
      poisonedTarget.classState.activeEffects = [
        createDnd5eMechanicalEffect({
          id: 'mummy-rot-effect', definitionId: 'disease:mummy-rot', label: '木乃伊腐疫',
          source: { kind: 'feature', actorId: 'poisoned-target', rulesId: 'mummy-rot', magical: false },
          targetId: poisonedTarget.id, duration: { type: 'permanent' }, tags: ['disease'],
        }),
        createDnd5eMechanicalEffect({
          id: 'unrelated-effect', definitionId: 'srd-5.1:spell:haste', label: '加速术',
          source: { kind: 'spell', actorId: 'actor', rulesId: 'haste', spellLevel: 3, magical: true },
          targetId: poisonedTarget.id, duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
        }),
      ]
      const state = startDnd5eHeadlessCombat(`activity-${spellId}`, [
        actor, magicTarget, planarTarget, poisonedTarget,
      ])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(actor.id, magicTarget.id)]: 20,
        [dnd5eCombatantPairKey(actor.id, planarTarget.id)]: 25,
        [dnd5eCombatantPairKey(actor.id, poisonedTarget.id)]: 30,
      }
      const actorSnapshot: Dnd5eActivityActorSnapshot = {
        id: actor.id, controller: actor.controller, level: 5,
        proficiencyBonus: actor.proficiencyBonus, abilities: actor.abilities,
        armorClass: actor.armorClass, conditions: [], currentHp: actor.currentHp,
        maxHp: actor.maxHp, spellSaveDc: 15,
        resources: { 'dnd5e-spell-slot-1': { current: 1, maximum: 1 } },
      }
      const resolution = resolveDnd5eActivity({
        activity, actor: actorSnapshot, targets: [actorSnapshot], castLevel: 1,
        rolls: {}, distanceFeetByTargetId: { actor: 0 },
      })
      expect(resolution.ok, resolution.ok ? undefined : resolution.details.join('; ')).toBe(true)
      if (!resolution.ok) return undefined
      const committed = commitDnd5eActivityExecution(state, {
        actorId: actor.id, activityId: activity.id, castLevel: 1,
        targetIds: [actor.id], resolution, source: { kind: 'spell', id: spellId },
      })
      expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
      return committed.ok ? committed : undefined
    }

    const magic = castDetection('detect-magic')
    const magicReport = magic ? dnd5ePersistentDetectionReports(magic.state, 'actor')[0] : undefined
    expect(magicReport).toMatchObject({ mode: 'magic' })
    expect(magicReport?.presences).toEqual(expect.arrayContaining([expect.objectContaining({
      targetId: 'magic-target', categories: ['magic'], spellSchools: ['transmutation'],
    })]))
    expect(magic?.events).toContainEqual(expect.objectContaining({
      type: 'spell-detection-updated', mode: 'magic',
    }))
    expect(magic?.events).not.toContainEqual(expect.objectContaining({
      type: 'spell-detection-updated', revealAuras: true,
    }))

    const detectMagicEffect = magic?.state.combatants.actor.classState.activeEffects?.find((effect) =>
      effect.definitionId.includes(':persistent-detection:detect-magic-persistent-detection'),
    )
    expect(detectMagicEffect?.grantedActivities).toContain('spell:detect-magic:reveal-auras')

    const auraActivity = (dnd5eSrdAuditedPartialContentDefinitionsV1()
      .find((definition) => definition.id === 'detect-magic')
      ?.activities as readonly Dnd5eActivityDefinitionV1[] | undefined)
      ?.find((activity) => activity.id === 'spell:detect-magic:reveal-auras')
    expect(auraActivity).toBeDefined()
    if (magic && auraActivity) {
      magic.state.combatants.actor.turn.actionAvailable = true
      const auraActor = dnd5eActivityActorSnapshotFromCombatantV1(magic.state.combatants.actor)
      const auraResolution = resolveDnd5eActivity({
        activity: auraActivity,
        actor: auraActor,
        targets: [auraActor],
        rolls: {},
        distanceFeetByTargetId: { actor: 0 },
      })
      expect(auraResolution.ok, auraResolution.ok ? undefined : auraResolution.details.join('; ')).toBe(true)
      if (auraResolution.ok) {
        const auraCommitted = commitDnd5eActivityExecution(magic.state, {
          actorId: 'actor', activityId: auraActivity.id, targetIds: ['actor'],
          resolution: auraResolution, source: { kind: 'feature', id: auraActivity.id },
        })
        expect(auraCommitted.ok, auraCommitted.ok ? undefined : auraCommitted.reason).toBe(true)
        expect(auraCommitted.events).toContainEqual(expect.objectContaining({
          type: 'spell-detection-updated', mode: 'magic', revealAuras: true,
          presences: expect.arrayContaining([expect.objectContaining({
            targetId: 'magic-target', spellSchools: ['transmutation'],
          })]),
        }))
        expect(auraCommitted.ok && auraCommitted.state.combatants.actor.turn.actionAvailable).toBe(false)
      }
    }

    const planar = castDetection('detect-evil-and-good')
    const planarReport = planar ? dnd5ePersistentDetectionReports(planar.state, 'actor')[0] : undefined
    expect(planarReport).toMatchObject({ mode: 'planar-creatures' })
    expect(planarReport?.presences).toEqual(expect.arrayContaining([expect.objectContaining({
      targetId: 'planar-target', categories: ['celestial'],
    })]))

    const poison = castDetection('detect-poison-and-disease')
    const poisonReport = poison ? dnd5ePersistentDetectionReports(poison.state, 'actor')[0] : undefined
    expect(poisonReport).toMatchObject({ mode: 'poison-disease' })
    expect(poisonReport?.presences).toEqual(expect.arrayContaining([expect.objectContaining({
      targetId: 'poisoned-target', categories: ['disease', 'poison', 'poisonous-creature'],
      sourceRulesIds: ['mummy-rot'],
    })]))
    expect(poisonReport?.presences).not.toContainEqual(expect.objectContaining({ targetId: 'actor' }))
  })

  it('consumes Time Stop one-shot turns and restores suspended creatures naturally', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-time-stop-natural', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [{
        kind: 'grant-extra-turns', operationId: 'time-stop-extra-turns', actorId: 'actor',
        turns: 3, freezeOtherCreatures: true, endOnAffectOther: true,
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:srd-5.1:time-stop:cast', targetIds: ['actor'], resolution,
      source: { kind: 'spell', id: 'time-stop' },
    })
    expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true)
    if (!committed.ok) return
    expect(committed.state.initiativeOrder).toEqual(['actor', 'actor', 'actor', 'actor', 'target'])
    expect(committed.state.oneShotInitiativeSlotIds).toHaveLength(3)
    expect(committed.state.combatants.target.turn.reactionAvailable).toBe(false)
    expect(committed.state.combatants.target.classState.activityExtraTurnSuspension).toBeDefined()

    let advanced = resolveDnd5eHeadlessAction(committed.state, { type: 'end-turn', actorId: 'actor' })
    expect(advanced.ok).toBe(true)
    for (let index = 0; index < 3; index += 1) {
      expect(advanced.ok && advanced.state.initiativeOrder[advanced.state.initiativeIndex]).toBe('actor')
      advanced = resolveDnd5eHeadlessAction(advanced.state, { type: 'end-turn', actorId: 'actor' })
      expect(advanced.ok).toBe(true)
    }
    expect(advanced.ok && advanced.state.initiativeOrder[advanced.state.initiativeIndex]).toBe('target')
    expect(advanced.ok && advanced.state.oneShotInitiativeSlotIds).toBeUndefined()
    expect(advanced.ok && advanced.state.combatants.actor.classState.activityExtraTurnGroup).toBeUndefined()
    expect(advanced.ok && advanced.state.combatants.target.classState.activityExtraTurnSuspension).toBeUndefined()
    expect(advanced.ok && advanced.state.combatants.target.turn.reactionAvailable).toBe(true)
  })

  it('ends remaining Time Stop turns when the caster affects another creature', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'player', 10)
    const state = startDnd5eHeadlessCombat('activity-time-stop-break', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [{
        kind: 'grant-extra-turns', operationId: 'time-stop-extra-turns', actorId: 'actor',
        turns: 3, freezeOtherCreatures: true, endOnAffectOther: true,
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:srd-5.1:time-stop:cast', targetIds: ['actor'], resolution,
      source: { kind: 'spell', id: 'time-stop' },
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    const extraTurn = resolveDnd5eHeadlessAction(committed.state, { type: 'end-turn', actorId: 'actor' })
    expect(extraTurn.ok).toBe(true)
    if (!extraTurn.ok) return
    const helped = resolveDnd5eHeadlessAction(extraTurn.state, {
      type: 'help', actorId: 'actor', targetId: 'target', helpKind: 'ability-check',
    })
    expect(helped.ok, helped.ok ? undefined : helped.reason).toBe(true)
    if (!helped.ok) return
    expect(helped.state.combatants.actor.classState.activityExtraTurnGroup).toBeUndefined()
    expect(helped.state.combatants.target.classState.activityExtraTurnSuspension).toBeUndefined()
    expect(helped.state.oneShotInitiativeSlotIds).toHaveLength(1)
    expect(helped.state.initiativeOrder).toEqual(['actor', 'actor', 'target'])
    const ended = resolveDnd5eHeadlessAction(helped.state, { type: 'end-turn', actorId: 'actor' })
    expect(ended.ok).toBe(true)
    expect(ended.ok && ended.state.initiativeOrder[ended.state.initiativeIndex]).toBe('target')
  })

  it('ends remaining Time Stop turns beyond 1,000 feet from the casting origin', () => {
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat('activity-time-stop-distance', [actor, target])
    const resolution: Extract<Dnd5eActivityExecutionResult, { ok: true }> = {
      ok: true, status: 'resolved', checks: [], consumptions: [],
      proposals: [{
        kind: 'grant-extra-turns', operationId: 'time-stop-extra-turns', actorId: 'actor',
        turns: 3, freezeOtherCreatures: true, endOnAffectOther: true,
        maximumDistanceFromOriginFeet: 1_000,
      }],
    }
    const committed = commitDnd5eActivityExecution(state, {
      actorId: 'actor', activityId: 'spell:srd-5.1:time-stop:cast', targetIds: ['actor'], resolution,
      source: { kind: 'spell', id: 'time-stop' },
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    const extraTurn = resolveDnd5eHeadlessAction(committed.state, {
      type: 'end-turn', actorId: 'actor',
    })
    expect(extraTurn.ok).toBe(true)
    if (!extraTurn.ok) return
    extraTurn.state.combatants.actor.turn.movementRemaining = 1_001
    const moved = resolveDnd5eHeadlessAction(extraTurn.state, {
      type: 'move', actorId: 'actor', to: { x: 1_001, y: 0 }, distance: 1_001,
    })
    expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.actor.classState.activityExtraTurnGroup).toBeUndefined()
    expect(moved.state.combatants.target.classState.activityExtraTurnSuspension).toBeUndefined()
    expect(moved.state.oneShotInitiativeSlotIds).toHaveLength(1)
    expect(moved.state.initiativeOrder).toEqual(['actor', 'actor', 'target'])
  })

  it('routes an active native-mechanic Activity through its trusted Headless action', () => {
    const packageId = 'test.activity-native'
    const subclassId = 'fortune-bearer'
    const abilityId = 'prepared-fortune'
    const featureId = `${packageId}:${subclassId}.${abilityId}`
    const resourceId = `${packageId}:decl-${subclassId}-${abilityId}-uses`
    const definition: DeclarativeSubclassDefinitionV1 = {
      schemaVersion: 1,
      id: subclassId,
      classId: 'sorcerer',
      name: 'Fortune Bearer',
      summary: 'Synthetic native Activity route.',
      abilities: [{
        schemaVersion: 1,
        id: abilityId,
        name: 'Prepared Fortune',
        description: 'Arms advantage for one later d20 roll.',
        level: 1,
        trigger: { kind: 'active-use' },
        targeting: { kind: 'self' },
        mechanic: { kind: 'next-d20-advantage', rollKinds: ['attack', 'ability-check', 'saving-throw'] },
        effects: [],
        limits: { reset: 'long-rest', uses: { kind: 'fixed', value: 1 } },
        automation: 'full',
      }],
    }
    const disposePlugin = registerDnd5eRulesPlugin({
      manifest: {
        id: packageId, name: 'Native Activity Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
      },
      setup(api) { api.registerDeclarativeSubclass(definition) },
    })
    try {
      const activity = dnd5eActivityFromDeclarativeSubclassAbility(definition.abilities[0]!, {
        subclassId,
        compatibility: { effective: 'full', reasons: [] },
      })
      registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
      const actorCombatant = combatant('actor', 'player', 20)
      Object.assign(actorCombatant, {
        level: 6,
        classId: 'sorcerer',
        subclassId: `${packageId}:${subclassId}`,
        classLevels: { sorcerer: 6 },
        subclassIds: { sorcerer: `${packageId}:${subclassId}` },
        pluginFeatureIds: [featureId],
        classResources: { [resourceId]: { current: 1, max: 1 } },
      })
      const state = startDnd5eHeadlessCombat('activity-native-route', [
        actorCombatant,
        combatant('target', 'dm', 10),
      ])
      const actorSnapshot = {
        id: 'actor', controller: 'players' as const, level: 6, proficiencyBonus: 3, abilities,
        armorClass: 14, conditions: [], currentHp: 30, maxHp: 30,
        classLevels: { sorcerer: 6 }, resources: { [resourceId]: { current: 1, maximum: 1 } },
      }
      const result = resolveAndCommitDnd5eActivityCommand(state, {
        command: {
          schemaVersion: 1,
          commandId: 'native-activity-command-1',
          actorId: 'actor',
          packageId,
          packageVersion: '1.0.0',
          activityId: activity.id,
          targetIds: ['actor'],
          expectedRevision: 0,
        },
        currentRevision: 0,
        actor: actorSnapshot,
        targets: [actorSnapshot],
        authoritativeRolls: {},
        distanceFeetByTargetId: { actor: 0 },
        confirmedBy: 'actor',
      })
      expect(result.phase).toBe('commit')
      if (result.phase !== 'commit' || !result.result.ok) return
      expect(result.result.state.combatants.actor.classResources[resourceId]?.current).toBe(0)
      expect(result.result.state.combatants.actor.classState.nextD20Advantage).toMatchObject({
        featureId,
        rollKinds: ['attack', 'ability-check', 'saving-throw'],
      })
    } finally {
      disposePlugin()
    }
  })
})
