import { afterEach, describe, expect, it } from 'vitest'
import { createDnd5eCombatant, dnd5eAbilityCheckRollMode, dnd5eAttackerIsUnseenForAttack, dnd5eCombatantCanSee, dnd5eCombatantCanSpeak, dnd5eCombatantPairKey, dnd5eConfusedTurnBehavior, dnd5eDarkOnesOwnLuckAvailable, dnd5eDirectedCombatantPairKey, dnd5eEffectiveDarkvisionRangeFeet, dnd5eEffectiveFlySpeed, dnd5eEffectiveSizeRank, dnd5eEffectiveSpeed, dnd5eGrappleDragExtraMovementFeet, dnd5eHeadlessEndTurnRestrictionFailure, dnd5eMonsterSpellAttackMode, dnd5eSourceMarkedAttackDisadvantage, dnd5eTargetArmorClassForAttack, dnd5eTrackingCapabilityForCombatant, dnd5eWeaponClassDamageDefinitions, endDnd5eConcentration, previewDnd5eUnsupportedAirborneFalls, previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, resolveDnd5eHeadlessAction, resolveDnd5ePersistentAreaTrigger, resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, setDnd5eHeadlessResolutionObserver, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import {
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  dnd5eActiveSavingThrowBonus,
  dnd5eActiveAttackRollFlags,
  dnd5eActiveSpellTargetingImmunitySchools,
  dnd5eConditionsFromActiveEffects,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'
import { dnd5eAttackerIsUnseen, dnd5eSavingThrowMode, dnd5eTargetGrantsAttackAdvantage, dnd5eUnseenTargetImposesDisadvantage } from './passiveDefenses'
import { getDnd5eSrdMonster, type Dnd5eMonsterStatBlock } from './monsters'
import { setDnd5eRoomMonsterCatalog } from './roomMonsterCatalog'
import { dnd5eCombatantIsSurprised } from './surprise'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import { dnd5ePluginHeadlessActionDefinition } from './pluginApi'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function meleeWeaponContext(weaponId?: string) {
  return {
    weaponId,
    mode: 'melee' as const,
    finesse: false,
    strengthBased: true,
    weaponDamageSides: 8,
    damageType: 'slashing' as const,
    adjacentEnemyOfTarget: false,
  }
}

function fighter(id: string, initiative: number, patch = {}) {
  const combatant = createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 2, armorClass: 16, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false, ...patch })
  const conditionLabels = (patch as { conditions?: string[] }).conditions
  if (conditionLabels?.length) {
    const activeEffects = migrateLegacyDnd5eConditions({ targetId: id, conditions: conditionLabels })
    combatant.classState.activeEffects = activeEffects
    combatant.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
  }
  return combatant
}

function spellRuleStateEffect(input: {
  spellId: string
  family: string
  sourceActorId: string
  targetId: string
}) {
  const stateId = `spell:${input.spellId}:${input.family}`
  return createDnd5eMechanicalEffect({
    definitionId: `rule-state:${stateId}`,
    label: stateId,
    source: { kind: 'spell', actorId: input.sourceActorId, rulesId: input.spellId, magical: true },
    targetId: input.targetId,
    legacyCondition: `rule-state:${stateId}`,
    duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
  })
}

describe('D&D 5e 2014 headless combat engine', () => {
  afterEach(() => {
    setDnd5eRoomMonsterCatalog([])
  })

  it('upcasts Cone of Cold to 12d8+INT and freezes only creatures killed by its cold damage', () => {
    const caster = fighter('cone-wizard', 30, {
      classId: 'wizard', subclassId: 'evocation', level: 20, classLevels: { wizard: 20 },
      proficiencyBonus: 6, abilities: { ...abilities, int: 20 }, saveDc: 19,
      classSelections: { 'spell-prepared': ['cone-of-cold'] },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const killed = fighter('cone-killed', 20, {
      controller: 'dm', currentHp: 10, maxHp: 10, savingThrowBonuses: { con: 0 },
    })
    const survivor = fighter('cone-survivor', 15, {
      controller: 'dm', currentHp: 100, maxHp: 100, savingThrowBonuses: { con: 0 },
    })
    const immune = fighter('cone-immune', 10, {
      controller: 'dm', currentHp: 10, maxHp: 10, savingThrowBonuses: { con: 0 },
      damageImmunities: ['cold'],
    })

    const resolved = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('cone-of-cold-upcast', [caster, killed, survivor, immune]),
      {
        type: 'cast-spell', actorId: caster.id,
        targetId: killed.id, targetIds: [killed.id, survivor.id, immune.id],
        spellId: 'cone-of-cold', slotLevel: 9,
        targetSavingThrows: [killed, survivor, immune].map((target) => ({ targetId: target.id, d20: 1 })),
        effectRolls: Array.from({ length: 12 }, () => 1),
      },
    )

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[caster.id].classResources['dnd5e-spell-slot-9']).toEqual({ current: 0, max: 1 })
    expect(resolved.state.combatants[killed.id].currentHp).toBe(0)
    expect(resolved.state.combatants[survivor.id].currentHp).toBe(83)
    expect(resolved.state.combatants[immune.id].currentHp).toBe(10)
    expect(resolved.state.combatants[killed.id].classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:cone-of-cold:frozen-statue',
      label: '寒冰锥：冰冻塑像（直至解冻）',
      tags: expect.arrayContaining(['frozen-statue', 'manual-thaw']),
      source: expect.objectContaining({ kind: 'spell', actorId: caster.id, rulesId: 'cone-of-cold', spellLevel: 9 }),
      duration: { type: 'permanent' },
    }))
    expect(resolved.state.combatants[survivor.id].classState.activeEffects).toBeUndefined()
    expect(resolved.state.combatants[immune.id].classState.activeEffects).toBeUndefined()
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'spell-damage-feature-bonus-applied', spellId: 'cone-of-cold', amount: 5,
    }))
  })

  it('allows Message recipients that understand a language to reply only when they can speak', () => {
    expect(dnd5eCombatantCanSpeak({ languages: ['Common'] })).toBe(true)
    expect(dnd5eCombatantCanSpeak({ languages: ['理解生前会说的所有语言，但无法说话'] })).toBe(false)
    expect(dnd5eCombatantCanSpeak({ languages: ["understands the languages it knew in life but can't speak"] })).toBe(false)
  })

  it('upcasts Command to one additional nearby target per slot level and resolves Grovel without DM approval', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const caster = fighter('command-cleric', 30, {
      classId: 'cleric', level: 9, classLevels: { cleric: 9 }, saveDc: 19,
      languages: ['Common'],
      classSelections: { 'spell-prepared': ['command'] },
      classSelectionsByClass: { cleric: { 'spell-prepared': ['command'] } },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const targets = Array.from({ length: 5 }, (_, index) => fighter(
      `command-target-${index + 1}`,
      20 - index,
      {
        controller: 'dm', languages: ['任意一种语言（通常为通用语）'], savingThrowBonuses: { wis: 0 },
        position: { x: 10 + index, y: index % 2 === 0 ? 0 : 5 },
      },
    ))
    const state = startDnd5eHeadlessCombat('command-upcast', [caster, ...targets])
    state.distanceFeetByCombatantPair = {}
    for (const target of targets) {
      state.distanceFeetByCombatantPair[dnd5eCombatantPairKey(caster.id, target.id)] = 20
    }
    for (let left = 0; left < targets.length; left += 1) {
      for (let right = left + 1; right < targets.length; right += 1) {
        state.distanceFeetByCombatantPair[
          dnd5eCombatantPairKey(targets[left]!.id, targets[right]!.id)
        ] = 25
      }
    }
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:command',
        transactionId: 'command-upcast-grovel', actorId: caster.id,
        targetId: targets[0]!.id, targetIds: targets.map((target) => target.id),
        castLevel: 5, payload: { activityChoices: { 'command-mode': 'grovel' } },
        rolls: Object.fromEntries(targets.map((target) => [
          `command-save-d20:${target.id}`,
          { values: [1, 2], modifier: 0, total: 3 },
        ])),
      },
      spell: {
        castingClassId: 'cleric', spellId: 'command', spellName: '命令术',
        spellLevel: 1, slotLevel: 5, castingTime: 'action',
        declaredTargetIds: targets.map((target) => target.id),
        spellSchool: 'enchantment',
      },
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[caster.id]?.classResources['dnd5e-spell-slot-5']?.current).toBe(0)
    for (const target of targets) {
      expect(resolved.state.combatants[target.id]?.classState.activeEffects).toContainEqual(
        expect.objectContaining({
          tags: expect.arrayContaining(['command-spell', 'command-mode:grovel']),
          duration: expect.objectContaining({ type: 'until-turn-boundary', boundary: 'target-turn-end' }),
        }),
      )
    }

    const recastState = resolved.state
    recastState.combatants[caster.id]!.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
    recastState.combatants[caster.id]!.turn.actionAvailable = true
    const switchedMode = resolveDnd5eHeadlessAction(recastState, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:command',
        transactionId: 'command-recast-other', actorId: caster.id,
        targetId: targets[0]!.id, targetIds: [targets[0]!.id],
        castLevel: 1, payload: { activityChoices: { 'command-mode': 'other' } },
        rolls: {
          [`command-save-d20:${targets[0]!.id}`]: { values: [1, 2], modifier: 0, total: 3 },
        },
      },
      spell: {
        castingClassId: 'cleric', spellId: 'command', spellName: '命令术',
        spellLevel: 1, slotLevel: 1, castingTime: 'action',
        declaredTargetIds: [targets[0]!.id], spellSchool: 'enchantment',
      },
    })
    expect(switchedMode.ok, switchedMode.ok ? undefined : switchedMode.reason).toBe(true)
    if (!switchedMode.ok) return
    const firstTargetCommandEffects = switchedMode.state.combatants[targets[0]!.id]
      ?.classState.activeEffects?.filter((effect) => effect.tags?.includes('command-spell')) ?? []
    expect(firstTargetCommandEffects).toHaveLength(1)
    expect(firstTargetCommandEffects[0]?.tags).toContain('command-mode:other')
    expect(switchedMode.state.combatants[targets[1]!.id]?.classState.activeEffects).toContainEqual(
      expect.objectContaining({ tags: expect.arrayContaining(['command-spell', 'command-mode:grovel']) }),
    )

    resolved.state.initiativeIndex = resolved.state.initiativeOrder.indexOf(targets[0]!.id)
    const targetTurn = resolveDnd5eHeadlessAction(resolved.state, {
      type: 'begin-turn', actorId: targets[0]!.id,
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok) return
    expect(targetTurn.state.combatants[targets[0]!.id]).toMatchObject({
      conditions: expect.arrayContaining(['prone']),
      turn: { actionAvailable: false, bonusActionAvailable: false, movementRemaining: 0 },
    })
    expect(targetTurn.events).toContainEqual(expect.objectContaining({
      type: 'command-turn-resolved', actorId: targets[0]!.id, mode: 'grovel', endedTurn: true,
    }))
  })

  it('consumes Command against undead or a creature with no understood language but applies no effect', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const caster = fighter('command-immunity-cleric', 30, {
      classId: 'cleric', level: 3, classLevels: { cleric: 3 }, saveDc: 16,
      languages: ['Common'],
      classSelections: { 'spell-prepared': ['command'] },
      classSelectionsByClass: { cleric: { 'spell-prepared': ['command'] } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const undead = fighter('command-undead', 20, {
      controller: 'dm', creatureType: 'undead', languages: ['Common'],
      position: { x: 10, y: 0 }, savingThrowBonuses: { wis: 0 },
    })
    const state = startDnd5eHeadlessCombat('command-undead-immunity', [caster, undead])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(caster.id, undead.id)]: 10,
    }
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:command',
        transactionId: 'command-undead-halt', actorId: caster.id,
        targetId: undead.id, targetIds: [undead.id], castLevel: 1,
        payload: { activityChoices: { 'command-mode': 'halt' } },
        rolls: {
          [`command-save-d20:${undead.id}`]: { values: [1, 2], modifier: 0, total: 3 },
        },
      },
      spell: {
        castingClassId: 'cleric', spellId: 'command', spellName: '命令术',
        spellLevel: 1, slotLevel: 1, castingTime: 'action',
        declaredTargetIds: [undead.id], spellSchool: 'enchantment',
      },
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[caster.id]?.classResources['dnd5e-spell-slot-1']?.current).toBe(0)
    expect(resolved.state.combatants[undead.id]?.classState.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ tags: expect.arrayContaining(['command-spell']) }))
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: caster.id, targetId: undead.id,
      stateKey: 'spell-unaffected:command-language-or-undead', active: false,
    }))
  })

  it('applies Gentle Repose only to an authoritative corpse and keeps its duration when upcast', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const setup = (slotLevel: 2 | 3, targetPatch: Record<string, unknown> = {}) => {
      const caster = fighter('repose-wizard', 30, {
        classId: 'wizard', level: 5, classLevels: { wizard: 5 },
        classSelections: { 'spell-prepared': ['gentle-repose'] },
        classSelectionsByClass: { wizard: { 'spell-prepared': ['gentle-repose'] } },
        classResources: { [`dnd5e-spell-slot-${slotLevel}`]: { current: 1, max: 1 } },
      })
      const corpse = fighter('repose-corpse', 20, {
        controller: 'dm', currentHp: 0, ...targetPatch,
      })
      corpse.deathSaves.dead = true
      corpse.deathSaves.failures = 3
      corpse.classState.deathRound = 0
      corpse.classState.bodyPresent = targetPatch.bodyPresent !== false
      const state = startDnd5eHeadlessCombat(`gentle-repose-${slotLevel}`, [caster, corpse])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(caster.id, corpse.id)]: 5,
      }
      const action = {
        type: 'plugin-spell-activity' as const, actorId: caster.id,
        pluginAction: {
          type: 'plugin' as const, pluginId: 'srd-5.1', actionId: 'spell:gentle-repose',
          transactionId: `gentle-repose-${slotLevel}`, actorId: caster.id,
          targetId: corpse.id, targetIds: [corpse.id], castLevel: slotLevel,
        },
        spell: {
          castingClassId: 'wizard' as const, spellId: 'gentle-repose', spellName: '遗体防腐',
          spellLevel: 2, slotLevel, castingTime: 'action' as const,
          declaredTargetIds: [corpse.id], spellSchool: 'necromancy' as const,
        },
      }
      return { caster, corpse, state, action }
    }

    for (const slotLevel of [2, 3] as const) {
      const scenario = setup(slotLevel)
      const resolved = resolveDnd5eHeadlessAction(scenario.state, scenario.action)
      expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
      if (!resolved.ok) continue
      expect(resolved.state.combatants[scenario.caster.id]
        ?.classResources[`dnd5e-spell-slot-${slotLevel}`]?.current).toBe(0)
      expect(resolved.state.combatants[scenario.corpse.id]?.classState.activeEffects)
        .toContainEqual(expect.objectContaining({
          definitionId: 'activity:gentle-repose:gentle-repose:modifiers:0',
          tags: expect.arrayContaining(['corpse-preservation', 'prevents-undead-animation']),
          duration: expect.objectContaining({ type: 'rounds', remainingRounds: 144_000 }),
          source: expect.objectContaining({ spellLevel: slotLevel }),
        }))
    }

    const living = setup(2)
    living.corpse.deathSaves.dead = false
    living.corpse.deathSaves.failures = 0
    living.corpse.classState.deathRound = undefined
    expect(resolveDnd5eHeadlessAction(living.state, living.action))
      .toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(living.state.combatants[living.caster.id]
      ?.classResources['dnd5e-spell-slot-2']?.current).toBe(1)

    const missingBody = setup(2, { bodyPresent: false })
    expect(resolveDnd5eHeadlessAction(missingBody.state, missingBody.action))
      .toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('settles Plane Shift willing travel directly and gates the hostile Charisma save behind an attack hit', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const setup = () => {
      const caster = fighter('plane-shift-wizard', 30, {
        classId: 'wizard', level: 13, classLevels: { wizard: 13 }, saveDc: 18,
        abilities: { ...abilities, int: 20 },
        classSelections: { 'spell-prepared': ['plane-shift'] },
        classSelectionsByClass: { wizard: { 'spell-prepared': ['plane-shift'] } },
        classResources: { 'dnd5e-spell-slot-7': { current: 1, max: 1 } },
      })
      const target = fighter('plane-shift-target', 20, {
        controller: 'dm', armorClass: 16, savingThrowBonuses: { cha: 0 },
        position: { x: 5, y: 0 },
      })
      const state = startDnd5eHeadlessCombat('plane-shift-sequence', [caster, target])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(caster.id, target.id)]: 5,
      }
      return { caster, target, state }
    }
    const action = (
      casterId: string,
      targetId: string,
      mode: 'willing-travel' | 'hostile-banishment',
      rolls: Record<string, { values: number[]; modifier: number; total: number }>,
    ) => ({
      type: 'plugin-spell-activity' as const,
      actorId: casterId,
      pluginAction: {
        type: 'plugin' as const, pluginId: 'srd-5.1', actionId: 'spell:plane-shift',
        transactionId: `plane-shift-${mode}`, actorId: casterId,
        targetId, targetIds: [targetId], castLevel: 7,
        payload: { activityChoices: { mode } }, rolls,
      },
      spell: {
        castingClassId: 'wizard' as const, spellId: 'plane-shift', spellName: '异界传送',
        spellLevel: 7, slotLevel: 7, castingTime: 'action' as const,
        declaredTargetIds: [targetId], spellSchool: 'conjuration' as const,
      },
    })

    const willing = setup()
    const willingResult = resolveDnd5eHeadlessAction(
      willing.state,
      action(willing.caster.id, willing.caster.id, 'willing-travel', {}),
    )
    expect(willingResult.ok, willingResult.ok ? undefined : willingResult.reason).toBe(true)
    if (willingResult.ok) {
      expect(willingResult.state.combatants[willing.caster.id]
        ?.classResources['dnd5e-spell-slot-7']?.current).toBe(0)
    }

    const miss = setup()
    const missRolls = {
      [`spell-attack-d20:${miss.target.id}`]: { values: [5], modifier: 0, total: 5 },
    }
    const missed = resolveDnd5eHeadlessAction(
      miss.state,
      action(miss.caster.id, miss.target.id, 'hostile-banishment', missRolls),
    )
    expect(missed.ok, missed.ok ? undefined : missed.reason).toBe(true)
    if (missed.ok) {
      expect(missed.state.combatants[miss.target.id]?.classState.activeEffects ?? [])
        .not.toContainEqual(expect.objectContaining({
          definitionId: expect.stringContaining('plane-shift-transferred'),
        }))
    }

    const forgedSaveAfterMiss = setup()
    expect(resolveDnd5eHeadlessAction(
      forgedSaveAfterMiss.state,
      action(forgedSaveAfterMiss.caster.id, forgedSaveAfterMiss.target.id, 'hostile-banishment', {
        [`spell-attack-d20:${forgedSaveAfterMiss.target.id}`]: { values: [5], modifier: 0, total: 5 },
        [`spell-save-d20:${forgedSaveAfterMiss.target.id}`]: { values: [1], modifier: 0, total: 1 },
      }),
    )).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const failedSave = setup()
    const transported = resolveDnd5eHeadlessAction(
      failedSave.state,
      action(failedSave.caster.id, failedSave.target.id, 'hostile-banishment', {
        [`spell-attack-d20:${failedSave.target.id}`]: { values: [10], modifier: 0, total: 10 },
        [`spell-save-d20:${failedSave.target.id}`]: { values: [1], modifier: 0, total: 1 },
      }),
    )
    expect(transported.ok, transported.ok ? undefined : transported.reason).toBe(true)
    if (transported.ok) {
      expect(transported.state.combatants[failedSave.target.id]?.classState.activeEffects)
        .toContainEqual(expect.objectContaining({
          definitionId: expect.stringContaining('plane-shift-transferred'),
          label: '异界传送：已被传送',
        }))
    }
  })

  it('enforces Bestow Curse source attack disadvantage, damage rider, and lose-action save', () => {
    const caster = fighter('caster', 20)
    const target = fighter('target', 10, { controller: 'dm' })
    const sourceAttackCurse = createDnd5eMechanicalEffect({
      id: 'bestow-curse-attack', definitionId: 'activity:spell:bestow-curse:attack',
      label: '降咒·攻击施法者劣势', tags: ['curse', 'bestow-curse.attacks-against-source'],
      source: { kind: 'spell', actorId: caster.id, rulesId: 'bestow-curse', magical: true },
      targetId: target.id,
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
    })
    target.classState.activeEffects = [sourceAttackCurse]
    expect(dnd5eSourceMarkedAttackDisadvantage(target, caster)).toBe(true)
    expect(dnd5eSourceMarkedAttackDisadvantage(target, fighter('other', 1))).toBe(false)

    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'bestow-curse-damage', definitionId: 'activity:spell:bestow-curse:damage',
      label: '降咒·施法者额外伤害', tags: ['curse', 'bestow-curse.source-bonus-damage'],
      source: { kind: 'spell', actorId: caster.id, rulesId: 'bestow-curse', magical: true },
      targetId: target.id,
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
    })]
    const damageDefinitions = dnd5eWeaponClassDamageDefinitions({
      state: startDnd5eHeadlessCombat('bestow-curse-damage', [caster, target]),
      actorId: caster.id,
      targetId: target.id,
      context: meleeWeaponContext(),
      effectiveMode: 'normal',
      critical: false,
    })
    expect(damageDefinitions).toContainEqual(expect.objectContaining({
      source: 'activity-effect-rider', rollId: 'bestow-curse-source-bonus-damage',
      count: 1, sides: 8, type: 'necrotic', magical: true,
    }))

    const cleric = fighter('curse-cleric', 20, {
      classId: 'cleric', level: 20, classLevels: { cleric: 20 }, saveDc: 19,
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
      classSelectionsByClass: { cleric: { 'spell-cantrips': ['sacred-flame'] } },
    })
    const spellTarget = fighter('curse-spell-target', 10, {
      controller: 'dm', currentHp: 30, maxHp: 30, savingThrowBonuses: { dex: -2 },
    })
    spellTarget.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'bestow-curse-spell-damage', definitionId: 'activity:spell:bestow-curse:damage',
      label: '降咒·施法者法术额外伤害', tags: ['curse', 'bestow-curse.source-bonus-damage'],
      source: { kind: 'spell', actorId: cleric.id, rulesId: 'bestow-curse', magical: true },
      targetId: spellTarget.id,
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
    })]
    const sacredFlame = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('bestow-curse-sacred-flame', [cleric, spellTarget]),
      {
        type: 'cast-spell', actorId: cleric.id, targetId: spellTarget.id,
        spellId: 'sacred-flame', slotLevel: 0, savingThrowD20: 1,
        effectRolls: [3, 1, 3, 2],
        bestowCurseDamageRolls: [{ targetId: spellTarget.id, rolls: [6] }],
      },
    )
    expect(sacredFlame.ok, sacredFlame.ok ? undefined : sacredFlame.reason).toBe(true)
    if (sacredFlame.ok) {
      expect(sacredFlame.state.combatants[spellTarget.id].currentHp).toBe(15)
      expect(sacredFlame.events).toContainEqual(expect.objectContaining({
        type: 'class-damage-applied', actorId: cleric.id, targetId: spellTarget.id,
        source: 'activity-effect-rider', amount: 6,
      }))
    }

    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'bestow-curse-lose-action', definitionId: 'activity:spell:bestow-curse:lose-action',
      label: '降咒·可能失去动作', tags: ['curse', 'bestow-curse.lose-action'],
      source: { kind: 'spell', actorId: caster.id, rulesId: 'bestow-curse', magical: true },
      targetId: target.id,
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'wis', dc: 15, timing: 'target-turn-start', onSuccess: 'remove' },
    })]
    const loseActionState = startDnd5eHeadlessCombat('bestow-curse-lose-action', [caster, target])
    loseActionState.initiativeIndex = loseActionState.initiativeOrder.indexOf(target.id)
    const failed = resolveDnd5eHeadlessAction(
      loseActionState,
      {
        type: 'begin-turn', actorId: target.id,
        turnStartActiveEffectSavingThrows: [{ effectId: 'bestow-curse-lose-action', d20: 1 }],
      },
    )
    expect(failed.ok, failed.ok ? undefined : failed.reason).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants[target.id]?.turn.actionAvailable).toBe(false)
    expect(failed.state.combatants[target.id]?.classState.activeEffects)
      .toContainEqual(expect.objectContaining({ id: 'bestow-curse-lose-action' }))
    expect(failed.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-resolved', effectId: 'bestow-curse-lose-action', success: false,
    }))
    expect(failed.events).toContainEqual({
      type: 'turn-resource-spent', actorId: target.id, resource: 'action',
    })
  })

  it('ends an empty Bestow Curse after a successful save and honors its 3rd/5th-level concentration boundary', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const castAt = (slotLevel: 3 | 5, savingThrowD20: number) => {
      const caster = fighter(`bestow-caster-${slotLevel}-${savingThrowD20}`, 20, {
        classId: 'cleric', level: 20, classLevels: { cleric: 20 }, saveDc: 19,
        classSelections: { 'spell-prepared': ['bestow-curse'] },
        classSelectionsByClass: { cleric: { 'spell-prepared': ['bestow-curse'] } },
        classResources: {
          [`dnd5e-spell-slot-${slotLevel}`]: { current: 1, max: 1 },
        },
      })
      const target = fighter(`bestow-target-${slotLevel}-${savingThrowD20}`, 10, {
        controller: 'dm', position: { x: 5, y: 0 }, savingThrowBonuses: { wis: 0 },
      })
      const state = startDnd5eHeadlessCombat(
        `bestow-curse-${slotLevel}-${savingThrowD20}`,
        [caster, target],
      )
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(caster.id, target.id)]: 5,
      }
      return {
        caster,
        target,
        resolved: resolveDnd5eHeadlessAction(state, {
          type: 'plugin-spell-activity', actorId: caster.id,
          pluginAction: {
            type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:bestow-curse',
            transactionId: `bestow-cast-${slotLevel}-${savingThrowD20}`,
            actorId: caster.id, targetId: target.id, targetIds: [target.id],
            distanceFeet: 5, castLevel: slotLevel,
            payload: {
              activityChoices: { mode: 'source-bonus-damage', ability: 'wis' },
            },
            rolls: {
              [`bestow-curse-save:${target.id}`]: {
                values: [savingThrowD20, savingThrowD20 === 20 ? 3 : 2],
                modifier: 0,
                total: savingThrowD20 + (savingThrowD20 === 20 ? 3 : 2),
              },
            },
          },
          spell: {
            castingClassId: 'cleric', spellId: 'bestow-curse', spellName: '降咒',
            spellLevel: 3, slotLevel, castingTime: 'action',
            declaredTargetIds: [target.id],
            concentrationRounds: slotLevel === 3 ? 10 : undefined,
            concentrationTargetIds: slotLevel === 3 ? [target.id] : undefined,
            spellSchool: 'necromancy',
          },
        }),
      }
    }

    const saved = castAt(3, 20)
    expect(saved.resolved.ok, saved.resolved.ok ? undefined : saved.resolved.reason).toBe(true)
    if (!saved.resolved.ok) return
    expect(saved.resolved.state.combatants[saved.caster.id]?.concentrating).toBe(false)
    expect(saved.resolved.state.combatants[saved.target.id]?.classState.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({
        tags: expect.arrayContaining(['bestow-curse.source-bonus-damage']),
      }))

    const third = castAt(3, 1)
    expect(third.resolved.ok, third.resolved.ok ? undefined : third.resolved.reason).toBe(true)
    if (!third.resolved.ok) return
    expect(third.resolved.state.combatants[third.caster.id]?.concentrating).toBe(true)
    expect(third.resolved.state.combatants[third.target.id]?.classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        tags: expect.arrayContaining(['bestow-curse.source-bonus-damage']),
        duration: expect.objectContaining({ type: 'concentration', remainingRounds: 10 }),
      }))

    const fifth = castAt(5, 1)
    expect(fifth.resolved.ok, fifth.resolved.ok ? undefined : fifth.resolved.reason).toBe(true)
    if (!fifth.resolved.ok) return
    expect(fifth.resolved.state.combatants[fifth.caster.id]?.concentrating).toBe(false)
    expect(fifth.resolved.state.combatants[fifth.target.id]?.classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        tags: expect.arrayContaining(['bestow-curse.source-bonus-damage']),
        duration: expect.objectContaining({ type: 'rounds', remainingRounds: 4_800 }),
      }))
  })

  it('releases replaced low-level Bestow Curse concentration without removing high-level curses on other targets', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const caster = fighter('bestow-replacement-caster', 20, {
      classId: 'cleric', level: 20, classLevels: { cleric: 20 }, saveDc: 19,
      classSelections: { 'spell-prepared': ['bestow-curse'] },
      classSelectionsByClass: { cleric: { 'spell-prepared': ['bestow-curse'] } },
      classResources: {
        'dnd5e-spell-slot-3': { current: 1, max: 1 },
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
        'dnd5e-spell-slot-7': { current: 1, max: 1 },
      },
    })
    const purple = fighter('bestow-replacement-purple', 10, {
      controller: 'dm', position: { x: 5, y: 0 }, savingThrowBonuses: { wis: 0 },
    })
    const wolf = fighter('bestow-replacement-wolf', 9, {
      controller: 'dm', position: { x: 0, y: 5 }, savingThrowBonuses: { wis: 0 },
    })
    const state = startDnd5eHeadlessCombat('bestow-replacement', [caster, purple, wolf])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(caster.id, purple.id)]: 5,
      [dnd5eCombatantPairKey(caster.id, wolf.id)]: 5,
    }
    const cast = (
      current: typeof state,
      slotLevel: 3 | 4 | 7,
      targetId: string,
      mode: 'ability' | 'attacks-against-source',
    ) => resolveDnd5eHeadlessAction(current, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:bestow-curse',
        transactionId: `bestow-replacement-${slotLevel}-${targetId}`,
        actorId: caster.id, targetId, targetIds: [targetId], distanceFeet: 5, castLevel: slotLevel,
        payload: { activityChoices: { mode, ability: 'wis' } },
        rolls: {
          [`bestow-curse-save:${targetId}`]: { values: [1, 2], modifier: 0, total: 3 },
        },
      },
      spell: {
        castingClassId: 'cleric', spellId: 'bestow-curse', spellName: '降咒',
        spellLevel: 3, slotLevel, castingTime: 'action', declaredTargetIds: [targetId],
        concentrationRounds: slotLevel <= 4 ? (slotLevel === 3 ? 10 : 100) : undefined,
        concentrationTargetIds: slotLevel <= 4 ? [targetId] : undefined,
        spellSchool: 'necromancy',
      },
    })

    const fourth = cast(state, 4, purple.id, 'ability')
    expect(fourth.ok, fourth.ok ? undefined : fourth.reason).toBe(true)
    if (!fourth.ok) return
    expect(fourth.state.combatants[caster.id]?.concentrating).toBe(true)
    fourth.state.combatants[caster.id]!.turn.actionAvailable = true

    const seventh = cast(fourth.state, 7, purple.id, 'attacks-against-source')
    expect(seventh.ok, seventh.ok ? undefined : seventh.reason).toBe(true)
    if (!seventh.ok) return
    expect(seventh.state.combatants[caster.id]).toMatchObject({ concentrating: false })
    expect(seventh.state.combatants[caster.id]?.classState.concentrationSpellId).toBeUndefined()
    expect(seventh.state.combatants[purple.id]?.classState.concentrationEffectsBySource?.[caster.id])
      .toBeUndefined()
    expect(seventh.state.combatants[purple.id]?.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        tags: expect.arrayContaining(['bestow-curse.attacks-against-source']),
        duration: expect.objectContaining({ type: 'rounds', remainingRounds: 14_400 }),
      }),
    )
    seventh.state.combatants[caster.id]!.turn.actionAvailable = true

    const third = cast(seventh.state, 3, wolf.id, 'ability')
    expect(third.ok, third.ok ? undefined : third.reason).toBe(true)
    if (!third.ok) return
    expect(third.state.combatants[caster.id]?.concentrating).toBe(true)
    expect(third.state.combatants[purple.id]?.classState.activeEffects).toContainEqual(
      expect.objectContaining({ tags: expect.arrayContaining(['bestow-curse.attacks-against-source']) }),
    )
    expect(third.events).not.toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: purple.id,
    }))
  })

  it('derives and enforces the shared Confusion/Mindfire turn table from an active effect', () => {
    const confused = fighter('confused', 20)
    const nearby = fighter('nearby', 10, { controller: 'dm', position: { x: 5, y: 0 } })
    confused.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'confused-behavior-effect',
      definitionId: 'activity:spell:confusion:confusion',
      label: 'Confusion',
      source: { kind: 'spell', actorId: nearby.id, rulesId: 'confusion', magical: true },
      targetId: confused.id,
      legacyCondition: 'confused-behavior',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: { preventReactions: true },
    })]
    const states = Array.from({ length: 256 }, (_, index) =>
      startDnd5eHeadlessCombat(`confusion-table-${index}`, [confused, nearby]))
    const startedStates = states.flatMap((state) => {
      const started = resolveDnd5eHeadlessAction(state, {
        type: 'begin-turn', actorId: confused.id,
      })
      return started.ok ? [{ state: started.state, events: started.events }] : []
    })
    const stateWithMode = (mode: 'random-movement-no-action' | 'no-movement-or-action' | 'random-melee-attack' | 'normal') => startedStates.find(({ events }) =>
      events.some((event) => event.type === 'confused-turn-behavior-resolved' && event.mode === mode))
    const noActionState = stateWithMode('no-movement-or-action')?.state
    expect(noActionState).toBeDefined()
    if (!noActionState) return
    expect(noActionState.combatants[confused.id]?.turn).toMatchObject({
      actionAvailable: false, bonusActionAvailable: false,
      reactionAvailable: false, movementRemaining: 0,
    })
    expect(resolveDnd5eHeadlessAction(noActionState, {
      type: 'attack', actorId: confused.id, targetId: nearby.id,
      attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [4], type: 'slashing' },
    })).toMatchObject({ ok: false, reason: 'action-unavailable' })

    const randomMovementEntry = stateWithMode('random-movement-no-action')
    const randomMovement = randomMovementEntry?.events.find((event) =>
      event.type === 'confused-turn-behavior-resolved' && event.mode === 'random-movement-no-action')
    expect(randomMovement).toMatchObject({
      roll: 1, mode: 'random-movement-no-action', directionRoll: expect.any(Number),
    })
    if (!randomMovementEntry || !randomMovement || randomMovement.type !== 'confused-turn-behavior-resolved') return
    const movementState = randomMovementEntry.state
    const movementActor = movementState.combatants[confused.id]!
    expect(movementActor.turn).toMatchObject({
      actionAvailable: false, bonusActionAvailable: false, reactionAvailable: false,
      movementRemaining: 30,
    })
    expect(dnd5eHeadlessEndTurnRestrictionFailure(movementState, confused.id))
      .toBe('insufficient-movement')
    expect(resolveDnd5eHeadlessAction(movementState, {
      type: 'end-turn', actorId: confused.id,
    })).toMatchObject({ ok: false, reason: 'insufficient-movement' })
    const direction = [
      { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
      { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
    ][randomMovement.directionRoll! - 1]!
    const directionLength = Math.hypot(direction.x, direction.y)
    const destination = {
      x: movementActor.position.x + direction.x / directionLength * 30,
      y: movementActor.position.y + direction.y / directionLength * 30,
    }
    expect(resolveDnd5eHeadlessAction(movementState, {
      type: 'move', actorId: confused.id,
      to: {
        x: movementActor.position.x - direction.x / directionLength * 30,
        y: movementActor.position.y - direction.y / directionLength * 30,
      },
      distance: 30, movementCost: 30,
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    expect(resolveDnd5eHeadlessAction(movementState, {
      type: 'move', actorId: confused.id,
      to: {
        x: movementActor.position.x + direction.x / directionLength * 15,
        y: movementActor.position.y + direction.y / directionLength * 15,
      },
      distance: 15, movementCost: 15,
    })).toMatchObject({ ok: false, reason: 'insufficient-movement' })
    expect(resolveDnd5eHeadlessAction(movementState, {
      type: 'move', actorId: confused.id, to: destination,
      distance: 30, movementCost: 30,
    })).toMatchObject({ ok: true })

    const forcedAttackState = stateWithMode('random-melee-attack')?.state
    const forcedAttack = forcedAttackState && dnd5eConfusedTurnBehavior(forcedAttackState, confused.id)
    expect(forcedAttack).toMatchObject({
      mode: 'random-melee-attack', forcedTargetId: nearby.id,
    })
    if (!forcedAttackState) return
    expect(forcedAttackState.combatants[confused.id]?.turn).toMatchObject({
      actionAvailable: true, bonusActionAvailable: false,
      reactionAvailable: false, movementRemaining: 0,
    })
    expect(resolveDnd5eHeadlessAction(forcedAttackState, {
      type: 'move', actorId: confused.id, to: { x: 0, y: 5 }, distance: 5,
    })).toMatchObject({ ok: false, reason: 'insufficient-movement' })
    expect(resolveDnd5eHeadlessAction(forcedAttackState, {
      type: 'end-turn', actorId: confused.id,
    })).toMatchObject({ ok: false, reason: 'action-unavailable' })
    expect(resolveDnd5eHeadlessAction(forcedAttackState, {
      type: 'attack', actorId: confused.id, targetId: nearby.id,
      attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [4], type: 'slashing' },
    })).toMatchObject({ ok: true })

    const normalState = stateWithMode('normal')?.state
    expect(normalState?.combatants[confused.id]?.turn).toMatchObject({
      actionAvailable: true, bonusActionAvailable: true,
      reactionAvailable: false, movementRemaining: 30,
    })
  })

  it('requires an independent Mirror Image roll and consumes only a hit duplicate', () => {
    const attacker = fighter('mirror-attacker', 20)
    const target = fighter('mirror-target', 10, { position: { x: 5, y: 0 } })
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'mirror-image-effect',
      definitionId: 'activity:spell:mirror-image:mirror-image',
      label: 'Mirror Image',
      source: { kind: 'spell', actorId: target.id, rulesId: 'mirror-image', magical: true },
      targetId: target.id,
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: {
        attackDecoys: {
          remaining: 3,
          redirectMinimumD20: [11, 8, 6],
          armorClassBase: 10,
          armorClassAbility: 'dex',
          requiresOrdinarySight: true,
        },
      },
    })]
    const state = startDnd5eHeadlessCombat('mirror-image', [attacker, target])
    const baseAction = {
      type: 'attack' as const,
      actorId: attacker.id,
      targetId: target.id,
      attackModifier: 5,
      d20: 12,
      // Host clients may already have rolled damage before the independent
      // redirection d20 is requested; redirected attacks must ignore this pool.
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' as const },
    }
    const requested = resolveDnd5eHeadlessAction(state, baseAction)
    expect(requested).toMatchObject({
      ok: false, reason: 'invalid-dice',
      attackDecoyRollRequirement: {
        occurrenceId: `attack:${attacker.id}:${target.id}`,
        attackerId: attacker.id,
        targetId: target.id,
        effectId: 'mirror-image-effect',
        remaining: 3,
        minimumD20: 6,
        armorClass: 12,
      },
    })
    if (requested.ok || !requested.attackDecoyRollRequirement) return

    const redirected = resolveDnd5eHeadlessAction(state, {
      ...baseAction,
      attackDecoyRolls: [{
        occurrenceId: requested.attackDecoyRollRequirement.occurrenceId,
        effectId: 'mirror-image-effect',
        redirectD20: 6,
      }],
    })
    expect(redirected).toMatchObject({
      ok: true,
      events: expect.arrayContaining([
        expect.objectContaining({
          type: 'attack-decoy-resolved', redirected: true, decoyHit: true,
          redirectD20: 6, minimumD20: 6, remaining: 2,
        }),
        expect.objectContaining({ type: 'attack-resolved', hit: false }),
      ]),
    })
    if (!redirected.ok) return
    expect(redirected.state.combatants[target.id].currentHp).toBe(20)
    expect(redirected.state.combatants[target.id].classState.activeEffects?.[0]
      .modifiers?.attackDecoys?.remaining).toBe(2)

    const bypassAttacker = fighter('truth-seer', 20, {
      specialSenses: [{ kind: 'truesight', rangeFeet: 60 }],
    })
    const bypassTarget = fighter('truth-target', 10, { position: { x: 5, y: 0 } })
    bypassTarget.classState.activeEffects = target.classState.activeEffects
    const bypassState = startDnd5eHeadlessCombat('mirror-image-truesight', [bypassAttacker, bypassTarget])
    bypassState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(bypassAttacker.id, bypassTarget.id)]: 5,
    }
    const bypassed = resolveDnd5eHeadlessAction(bypassState, {
      ...baseAction,
      actorId: bypassAttacker.id,
      targetId: bypassTarget.id,
      damage: { ...baseAction.damage, rolls: [4] },
    })
    expect(bypassed.ok, bypassed.ok ? undefined : bypassed.reason).toBe(true)
    expect(bypassed).toMatchObject({
      ok: true,
      state: { combatants: { [bypassTarget.id]: { currentHp: 16 } } },
    })
    if (!bypassed.ok) return
    expect(bypassed.events.some((event) => event.type === 'attack-decoy-resolved')).toBe(false)

    const antimagicTarget = fighter('antimagic-target', 10, {
      position: { x: 5, y: 0 }, magicSuppressed: true,
    })
    antimagicTarget.classState.activeEffects = target.classState.activeEffects
    const antimagicState = startDnd5eHeadlessCombat('mirror-image-antimagic', [attacker, antimagicTarget])
    const antimagicAttack = resolveDnd5eHeadlessAction(antimagicState, {
      ...baseAction,
      targetId: antimagicTarget.id,
    })
    expect(antimagicAttack).toMatchObject({
      ok: true,
      state: { combatants: { [antimagicTarget.id]: { currentHp: 16 } } },
    })
    if (antimagicAttack.ok) {
      expect(antimagicAttack.events.some((event) => event.type === 'attack-decoy-resolved')).toBe(false)
    }
  })

  it('prevents cross-plane sight and attacks while Etherealness is active', () => {
    const attacker = fighter('material-attacker', 20)
    const target = fighter('ethereal-target', 10)
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:spell:etherealness:etherealness',
      label: 'Etherealness',
      source: { kind: 'spell', actorId: target.id, rulesId: 'etherealness', magical: true },
      targetId: target.id,
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      modifiers: {
        planarPhase: {
          plane: 'ethereal',
          ignoresMaterialCollision: true,
          suppressCrossPlaneEffects: true,
          unrestrictedVerticalMovement: true,
        },
      },
    })]
    const state = startDnd5eHeadlessCombat('etherealness', [attacker, target])
    expect(dnd5eCombatantCanSee(state, attacker.id, target.id)).toBe(false)
    state.combatants[attacker.id].classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:spell:true-seeing:true-seeing',
      label: 'True Seeing',
      source: { kind: 'spell', actorId: attacker.id, rulesId: 'true-seeing', magical: true },
      targetId: attacker.id,
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      modifiers: { truesightRangeFeet: 120, seeInvisible: true },
    })]
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(attacker.id, target.id)]: 5,
    }
    expect(dnd5eCombatantCanSee(state, attacker.id, target.id)).toBe(true)
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: target.id,
      attackModifier: 20, d20: 20,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'slashing' },
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('rejects attack-like actions from a non-attacking summon but preserves ordinary actions', () => {
    const familiar = fighter('familiar', 20, {
      summonedCannotAttack: true,
      summonedSourceCombatantId: 'wizard',
      summonedPersistent: true,
    })
    const target = fighter('target', 10)
    const state = startDnd5eHeadlessCombat('non-attacking-summon', [familiar, target])
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: familiar.id, targetId: target.id,
      attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [4], type: 'slashing' },
    })).toMatchObject({ ok: false, reason: 'action-unavailable' })
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'shove', actorId: familiar.id, targetId: target.id,
      actorD20: 20, targetD20: 1, targetDefense: 'athletics', outcome: 'prone',
    })).toMatchObject({ ok: false, reason: 'action-unavailable' })
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'dodge', actorId: familiar.id,
    })).toMatchObject({ ok: true })
  })

  it('applies source-relative Perception disadvantage and requires an explicit observed creature', () => {
    const source = fighter('enthraller', 20)
    const observer = fighter('observer', 15)
    const other = fighter('other', 10)
    observer.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:enthrall', label: 'Enthrall',
      source: { kind: 'spell', actorId: source.id, magical: true }, targetId: observer.id,
      modifiers: { perceptionDisadvantageAgainstOthersThanSource: true },
      removal: { sourceLink: { sourceMustBeConsciousAndAbleToSpeak: true } },
    })]
    let state = startDnd5eHeadlessCombat('enthrall-perception', [source, observer, other])
    state.initiativeIndex = state.initiativeOrder.indexOf(observer.id)

    expect(resolveDnd5eHeadlessAction(state, {
      type: 'ability-check', actorId: observer.id, ability: 'wis', skill: 'perception',
      d20: 18, d20Second: 3, dc: 10,
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const againstOther = resolveDnd5eHeadlessAction(state, {
      type: 'ability-check', actorId: observer.id, ability: 'wis', skill: 'perception',
      perceivedTargetId: other.id, d20: 18, d20Second: 3, dc: 10,
    })
    expect(againstOther).toMatchObject({
      ok: true,
      events: expect.arrayContaining([expect.objectContaining({
        type: 'ability-check-resolved', perceivedTargetId: other.id,
        mode: 'disadvantage', d20: 3,
      })]),
    })
    if (!againstOther.ok) return
    state = againstOther.state
    state.initiativeIndex = state.initiativeOrder.indexOf(observer.id)
    const againstSource = resolveDnd5eHeadlessAction(state, {
      type: 'ability-check', actorId: observer.id, ability: 'wis', skill: 'perception',
      perceivedTargetId: source.id, d20: 18, dc: 10,
    })
    expect(againstSource).toMatchObject({
      ok: true,
      events: expect.arrayContaining([expect.objectContaining({
        type: 'ability-check-resolved', perceivedTargetId: source.id,
        mode: 'normal', d20: 18,
      })]),
    })
    if (!againstSource.ok) return
    state = againstSource.state
    state.combatants[source.id].classState.activeEffects = [createDnd5eConditionEffect({
      condition: 'unconscious', source: { kind: 'system', actorId: source.id }, targetId: source.id,
    })]
    state.combatants[source.id].conditions = ['unconscious']
    state.initiativeIndex = state.initiativeOrder.indexOf(observer.id)
    const reconciled = resolveDnd5eHeadlessAction(state, {
      type: 'ability-check', actorId: observer.id, ability: 'int', d20: 10, dc: 5,
    })
    expect(reconciled).toMatchObject({
      ok: true,
      events: expect.arrayContaining([expect.objectContaining({
        type: 'active-effect-removed', targetId: observer.id, reason: 'source-incapacitated',
      })]),
    })
    if (!reconciled.ok) return
    expect(reconciled.state.combatants[observer.id].classState.activeEffects ?? []).toEqual([])
  })

  it('applies underwater weapon penalties and lets a generic environmental capability suppress them', () => {
    const attacker = fighter('underwater-attacker', 20)
    const target = fighter('underwater-target', 10, { position: { x: 5, y: 0 } })
    const attack = (state: ReturnType<typeof startDnd5eHeadlessCombat>) =>
      resolveDnd5eHeadlessAction(state, {
        type: 'attack', actorId: attacker.id, targetId: target.id,
        attackModifier: 5, d20: 18, d20Second: 2,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
        classDamageContext: {
          ...meleeWeaponContext('greatsword'), weaponBaseId: 'greatsword',
        },
      })
    const underwater = startDnd5eHeadlessCombat('underwater-penalty', [attacker, target])
    underwater.environment = 'underwater'
    const penalized = attack(underwater)
    expect(penalized.ok).toBe(true)
    if (!penalized.ok) return
    expect(penalized.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: attacker.id, d20: 2, hit: false,
    }))

    const protectedAttacker = fighter('underwater-attacker', 20)
    protectedAttacker.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:freedom-of-movement', label: 'Freedom of Movement',
      source: { kind: 'spell', actorId: 'cleric', magical: true }, targetId: protectedAttacker.id,
      modifiers: { environmentalCapabilities: { ignoreUnderwaterAttackPenalty: true } },
    })]
    const protectedState = startDnd5eHeadlessCombat('underwater-protected', [protectedAttacker, target])
    protectedState.environment = 'underwater'
    const unpenalized = attack(protectedState)
    expect(unpenalized.ok).toBe(true)
    if (!unpenalized.ok) return
    expect(unpenalized.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: protectedAttacker.id, d20: 18, hit: true,
    }))
  })

  it('resolves deterministic periodic healing once at each target turn start', () => {
    const healer = fighter('healer', 20)
    const target = fighter('target', 10, { currentHp: 10 })
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:regenerate', label: '再生术', targetId: target.id,
      source: { kind: 'spell', actorId: healer.id, rulesId: 'regenerate', magical: true },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      periodicHealing: { timing: 'target-turn-start', amount: 1 },
      stackingKey: 'spell:regenerate',
    })]
    const initial = startDnd5eHeadlessCombat('periodic-healing', [healer, target])

    const first = resolveDnd5eHeadlessAction(initial, { type: 'end-turn', actorId: healer.id })
    expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
    if (!first.ok) return
    expect(first.state.combatants[target.id].currentHp).toBe(11)
    expect(first.events).toContainEqual(expect.objectContaining({
      type: 'healing-applied', targetId: target.id, amount: 1, hpBefore: 10, hpAfter: 11,
    }))

    // A stale/replayed boundary cannot apply the same effect twice because the
    // authoritative effect carries its last resolved turn key.
    const duplicateBoundary = resolveDnd5eHeadlessAction(first.state, {
      type: 'move', actorId: target.id, to: { x: 0, y: 0 }, distance: 0,
    })
    expect(duplicateBoundary.ok, duplicateBoundary.ok ? undefined : duplicateBoundary.reason).toBe(true)
    if (!duplicateBoundary.ok) return
    expect(duplicateBoundary.state.combatants[target.id].currentHp).toBe(11)
  })

  it('restores missing body parts after the configured authoritative turn count', () => {
    const healer = fighter('healer', 20)
    const target = fighter('target', 10)
    target.classState.bodyPresent = true
    target.classState.missingBodyParts = ['left-arm']
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:regenerate', label: '再生术', targetId: target.id,
      source: { kind: 'spell', actorId: healer.id, rulesId: 'regenerate', magical: true },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      bodyRestoration: { roundsRemaining: 2 },
      stackingKey: 'spell:regenerate',
    })]
    const initial = startDnd5eHeadlessCombat('body-restoration', [healer, target])
    const firstTargetTurn = resolveDnd5eHeadlessAction(initial, {
      type: 'end-turn', actorId: healer.id,
    })
    expect(firstTargetTurn.ok, firstTargetTurn.ok ? undefined : firstTargetTurn.reason).toBe(true)
    if (!firstTargetTurn.ok) return
    expect(firstTargetTurn.state.combatants[target.id].classState.missingBodyParts).toEqual(['left-arm'])
    expect(firstTargetTurn.state.combatants[target.id].classState.activeEffects?.[0]
      ?.bodyRestoration?.roundsRemaining).toBe(1)

    const healerTurn = resolveDnd5eHeadlessAction(firstTargetTurn.state, {
      type: 'end-turn', actorId: target.id,
    })
    expect(healerTurn.ok, healerTurn.ok ? undefined : healerTurn.reason).toBe(true)
    if (!healerTurn.ok) return
    const restored = resolveDnd5eHeadlessAction(healerTurn.state, {
      type: 'end-turn', actorId: healer.id,
    })
    expect(restored.ok, restored.ok ? undefined : restored.reason).toBe(true)
    if (!restored.ok) return
    expect(restored.state.combatants[target.id].classState.missingBodyParts).toBeUndefined()
    expect(restored.state.combatants[target.id].classState.activeEffects?.[0]
      ?.bodyRestoration).toBeUndefined()
    expect(restored.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: target.id, stateKey: 'body-restored', active: true,
    }))
  })

  it('enforces Irresistible Dance through generic effect primitives and an action save', () => {
    const dancer = fighter('dancer', 20, { savingThrowBonuses: { wis: 1 } })
    const caster = fighter('caster', 10)
    dancer.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:irresistible-dance:effect', label: '迷舞术', targetId: dancer.id,
      source: { kind: 'spell', actorId: caster.id, rulesId: 'irresistible-dance', magical: true },
      duration: { type: 'concentration', sourceActorId: caster.id },
      escapeSavingThrow: { ability: 'wis', dc: 14, economy: 'action' },
      modifiers: {
        speedOverrideFeet: 0,
        speedBonusFeet: 30,
        attackRollDisadvantage: true,
        savingThrowDisadvantages: ['dex'],
        attacksAgainstTargetAdvantage: true,
      },
    })]
    const initial = startDnd5eHeadlessCombat('irresistible-dance', [dancer, caster])
    const affected = initial.combatants[dancer.id]

    expect(dnd5eEffectiveSpeed(affected)).toBe(0)
    expect(dnd5eActiveAttackRollFlags(affected.classState.activeEffects)).toMatchObject({
      disadvantage: true,
    })
    expect(dnd5eSavingThrowMode(affected, 'dex')).toBe('disadvantage')
    expect(dnd5eTargetGrantsAttackAdvantage(affected)).toBe(true)

    const failed = resolveDnd5eHeadlessAction(structuredClone(initial), {
      type: 'escape-active-effect', actorId: dancer.id,
      effectId: affected.classState.activeEffects![0]!.id, d20: 1,
    })
    expect(failed.ok, failed.ok ? undefined : failed.reason).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants[dancer.id].turn.actionAvailable).toBe(false)
    expect(failed.state.combatants[dancer.id].classState.activeEffects).toHaveLength(1)
    expect(failed.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', ability: 'wis', dc: 14, success: false,
    }))

    const escaped = resolveDnd5eHeadlessAction(structuredClone(initial), {
      type: 'escape-active-effect', actorId: dancer.id,
      effectId: affected.classState.activeEffects![0]!.id, d20: 20,
    })
    expect(escaped.ok, escaped.ok ? undefined : escaped.reason).toBe(true)
    if (!escaped.ok) return
    expect(escaped.state.combatants[dancer.id].turn.actionAvailable).toBe(false)
    expect(escaped.state.combatants[dancer.id].classState.activeEffects).toBeUndefined()
    expect(dnd5eEffectiveSpeed(escaped.state.combatants[dancer.id])).toBe(30)
  })

  it('lets configured creature profiles automatically pass a generic action escape check', () => {
    const minotaur = fighter('minotaur', 20, { statBlockId: 'srd-5.1:minotaur' })
    minotaur.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:maze:effect', label: '迷宫术', targetId: minotaur.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'maze', magical: true },
      duration: { type: 'concentration', sourceActorId: 'caster' },
      legacyCondition: 'banished',
      escapeCheck: {
        ability: 'int', dc: 20, economy: 'action',
        automaticSuccessStatBlockIds: ['srd-5.1:minotaur', 'srd-5.1:goristro'],
      },
    })]
    const state = startDnd5eHeadlessCombat('maze-auto-escape', [
      minotaur,
      fighter('caster', 20),
    ])
    const escaped = resolveDnd5eHeadlessAction(state, {
      type: 'escape-active-effect', actorId: minotaur.id,
      effectId: minotaur.classState.activeEffects[0]!.id, d20: 1,
    })
    expect(escaped.ok, escaped.ok ? undefined : escaped.reason).toBe(true)
    if (!escaped.ok) return
    expect(escaped.state.combatants[minotaur.id].classState.activeEffects).toBeUndefined()
    expect(escaped.state.combatants[minotaur.id].turn.actionAvailable).toBe(false)
    expect(escaped.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', automatic: true, success: true, dc: 20,
    }))
  })

  it('projects Mind Blank divination targeting immunity through the shared effect consumer', () => {
    const target = fighter('target', 20)
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:mind-blank:effect', label: '心灵屏障', targetId: target.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'mind-blank', magical: true },
      duration: { type: 'rounds', remainingRounds: 14_400, tickOn: 'target-turn-end' },
      modifiers: {
        damageImmunity: 'psychic',
        conditionImmunities: ['charmed'],
        spellTargetingImmunitySchools: ['divination'],
      },
    })]
    expect(dnd5eActiveSpellTargetingImmunitySchools(target.classState.activeEffects))
      .toEqual(['divination'])
  })

  it('normalizes a legacy core spell school before enforcing plugin Activity targeting immunity', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const caster = fighter('guidance-caster', 20)
    const target = fighter('nondetection-target', 10, { position: { x: 5, y: 0 } })
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:nondetection:effect', label: '回避侦测', targetId: target.id,
      source: { kind: 'spell', actorId: target.id, rulesId: 'nondetection', magical: true },
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      modifiers: { spellTargetingImmunitySchools: ['divination'] },
    })]
    const state = startDnd5eHeadlessCombat('nondetection-guidance', [caster, target])
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:guidance',
        transactionId: 'guidance-cast', actorId: caster.id,
        targetId: target.id, targetIds: [target.id], distanceFeet: 5, rolls: {},
      },
      spell: {
        castingClassId: 'druid', spellId: 'guidance', spellName: '神导术',
        spellLevel: 0, slotLevel: 0, castingTime: 'action',
        declaredTargetIds: [target.id], concentrationRounds: 10,
        concentrationTargetIds: [target.id],
        // Legacy core payloads still carry the localized school label at this
        // boundary even though the public action type is normalized.
        spellSchool: '预言' as never,
      },
    })

    expect(resolved).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(resolved.state.combatants[caster.id].turn.actionAvailable).toBe(true)
  })

  it.each([
    { label: 'shapechanger', reason: 'shapechanger' as const },
    { label: 'zero-hit-point creature', reason: 'zero-hit-points' as const },
  ])('spends an Activity Polymorph cast without starting empty concentration on a $label', ({ reason }) => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const caster = fighter('polymorph-caster', 20, {
      classId: 'druid', level: 8, classLevels: { druid: 8 }, saveDc: 16,
      classSelections: { 'spell-prepared': ['polymorph'] },
      classSelectionsByClass: { druid: { 'spell-prepared': ['polymorph'] } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const target = fighter('shapechanger-target', 10, {
      controller: 'dm', position: { x: 5, y: 0 },
      ...(reason === 'shapechanger'
        ? { shapechanger: true }
        : { currentHp: 0, usesDeathSaves: true }),
    })
    const state = startDnd5eHeadlessCombat(`activity-polymorph-${reason}`, [caster, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(caster.id, target.id)]: 5,
    }
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:polymorph',
        transactionId: 'polymorph-shapechanger-cast', actorId: caster.id,
        targetId: target.id, targetIds: [target.id], distanceFeet: 5, castLevel: 4,
        payload: { activityChoices: { mode: 'srd-5.1:bat' } },
        rolls: { [`spell-save-d20:${target.id}`]: { values: [1, 2], modifier: 0, total: 3 } },
      },
      spell: {
        castingClassId: 'druid', spellId: 'polymorph', spellName: '变形术',
        spellLevel: 4, slotLevel: 4, castingTime: 'action',
        declaredTargetIds: [target.id], concentrationRounds: 600,
        concentrationTargetIds: [target.id], spellSchool: 'transmutation',
      },
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[caster.id]).toMatchObject({
      concentrating: false,
      turn: { actionAvailable: false },
      classResources: { 'dnd5e-spell-slot-4': { current: 0, max: 1 } },
    })
    expect(resolved.state.combatants[target.id].classState.wildShapeFormId).toBeUndefined()
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'creature-transformation-unaffected', targetId: target.id, reason,
    }))
    expect(resolved.events).not.toContainEqual(expect.objectContaining({
      type: 'class-state-changed', stateKey: 'concentration', active: true,
    }))
  })

  it('allows a persistent-area Activity spell to include an unconscious but living creature', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const caster = fighter('storm-caster', 20, {
      classId: 'druid', level: 20, classLevels: { druid: 20 }, saveDc: 19,
      classSelections: { 'spell-prepared': ['storm-of-vengeance'] },
      classSelectionsByClass: { druid: { 'spell-prepared': ['storm-of-vengeance'] } },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const dying = fighter('dying-target', 10, {
      controller: 'player', currentHp: 0, conditions: ['unconscious', 'prone'],
      position: { x: 5, y: 0 },
    })
    expect(dying.deathSaves.dead).toBe(false)
    const state = startDnd5eHeadlessCombat('storm-with-unconscious-target', [caster, dying])
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:storm-of-vengeance',
        transactionId: 'storm-with-unconscious-target-cast', actorId: caster.id,
        targetId: caster.id, targetIds: [caster.id, dying.id],
        targetCell: { col: 1, row: 1 }, distanceFeet: 5, castLevel: 9,
        activityAreaPlacement: {
          x: 50, y: 50, elevationFeet: 0, radiusFeet: 360,
          instances: [{ x: 50, y: 50, elevationFeet: 0 }],
        },
        activityAreaPlacementDistanceFeet: 5,
        rolls: {},
      },
      spell: {
        castingClassId: 'druid', spellId: 'storm-of-vengeance', spellName: '复仇风暴',
        spellLevel: 9, slotLevel: 9, castingTime: 'action',
        declaredTargetIds: [caster.id, dying.id], concentrationRounds: 10,
        concentrationTargetIds: [caster.id, dying.id], spellSchool: 'conjuration',
      },
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.activityHandoffs?.persistentAreas).toContainEqual(expect.objectContaining({
      label: '复仇风暴', durationRounds: 10, concentration: true,
    }))
    expect(resolved.state.combatants[caster.id]).toMatchObject({
      concentrating: true,
      turn: { actionAvailable: false },
      classResources: { 'dnd5e-spell-slot-9': { current: 0, max: 1 } },
      classState: {
        concentrationSpellId: 'storm-of-vengeance',
        concentrationTargetIds: [caster.id, dying.id],
      },
    })
  })

  it('settles the owning Shapechange spell after its self-transform Activity', () => {
    dnd5ePluginHeadlessActionDefinition('srd-5.1', 'spell:shapechange')
    const caster = fighter('shapechange-caster', 20, {
      classId: 'wizard', level: 20, classLevels: { wizard: 20 }, saveDc: 19,
      classSelections: { 'spell-prepared': ['shapechange'] },
      classSelectionsByClass: { wizard: { 'spell-prepared': ['shapechange'] } },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const witness = fighter('shapechange-witness', 10, {
      controller: 'dm', position: { x: 30, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('activity-shapechange-owning-spell', [caster, witness])
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:shapechange',
        transactionId: 'shapechange-owning-spell-cast', actorId: caster.id,
        targetId: caster.id, targetIds: [caster.id], distanceFeet: 0, castLevel: 9,
        payload: {
          activityChoices: {
            mode: 'srd-5.1:adult-black-dragon', equipment: 'merge', seen: 'confirmed',
          },
        },
        rolls: {}, interruptChoiceId: 'dm-apply',
      },
      spell: {
        castingClassId: 'wizard', spellId: 'shapechange', spellName: '形体变化',
        spellLevel: 9, slotLevel: 9, castingTime: 'action',
        declaredTargetIds: [caster.id], concentrationRounds: 600,
        concentrationTargetIds: [caster.id], spellSchool: 'transmutation',
      },
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[caster.id]).toMatchObject({
      currentHp: 195,
      maxHp: 195,
      armorClass: 19,
      concentrating: true,
      classResources: { 'dnd5e-spell-slot-9': { current: 0, max: 1 } },
      classState: {
        wildShapeFormId: 'srd-5.1:adult-black-dragon',
        wildShapeMode: 'shapechange',
        shapechangeEquipmentDisposition: 'merge',
        concentrationSpellId: 'shapechange',
      },
    })
  })

  it('clears residual concentration links before a new Activity spell starts concentrating', () => {
    dnd5ePluginHeadlessActionDefinition('srd-5.1', 'spell:spider-climb')
    const caster = fighter('spider-climb-caster', 20, {
      classId: 'wizard', level: 3, classLevels: { wizard: 3 }, saveDc: 14,
      classSelections: { 'spell-prepared': ['spider-climb'] },
      classSelectionsByClass: { wizard: { 'spell-prepared': ['spider-climb'] } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
      concentrating: false,
    })
    const staleTarget = fighter('stale-slow-target', 10, {
      controller: 'dm', position: { x: 10, y: 0 },
    })
    staleTarget.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'stale-slow-effect',
      definitionId: 'activity:slow:effect',
      label: '缓慢术',
      targetId: staleTarget.id,
      source: { kind: 'spell', actorId: caster.id, rulesId: 'slow', magical: true },
      duration: {
        type: 'concentration', sourceActorId: caster.id,
        concentrationId: 'slow', remainingRounds: 10,
      },
      modifiers: { speedMultiplier: 0.5 },
    })]
    staleTarget.classState.concentrationEffectsBySource = { [caster.id]: 'slow' }
    const state = startDnd5eHeadlessCombat('residual-concentration-links', [caster, staleTarget])

    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:spider-climb',
        transactionId: 'spider-climb-after-stale-slow', actorId: caster.id,
        targetId: caster.id, targetIds: [caster.id], distanceFeet: 0, castLevel: 2,
        rolls: {},
      },
      spell: {
        castingClassId: 'wizard', spellId: 'spider-climb', spellName: '蛛行术',
        spellLevel: 2, slotLevel: 2, castingTime: 'action',
        declaredTargetIds: [caster.id], concentrationRounds: 600,
        concentrationTargetIds: [caster.id], spellSchool: 'transmutation',
      },
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[staleTarget.id].classState.activeEffects).toBeUndefined()
    expect(resolved.state.combatants[staleTarget.id].classState.concentrationEffectsBySource).toBeUndefined()
    expect(resolved.state.combatants[caster.id]).toMatchObject({
      concentrating: true,
      classState: {
        concentrationSpellId: 'spider-climb',
        concentrationSpellLevel: 2,
        concentrationRoundsRemaining: 600,
        concentrationStartedTurnKey: 'residual-concentration-links:1:spider-climb-caster',
      },
    })
    const casterTurnEnded = resolveDnd5eHeadlessAction(resolved.state, {
      type: 'end-turn', actorId: caster.id,
    })
    expect(casterTurnEnded.ok, casterTurnEnded.ok ? undefined : casterTurnEnded.reason).toBe(true)
    if (!casterTurnEnded.ok) return
    expect(casterTurnEnded.state.combatants[caster.id].classState).toMatchObject({
      concentrationRoundsRemaining: 600,
      concentrationStartedTurnKey: undefined,
    })
    const targetTurnEnded = resolveDnd5eHeadlessAction(casterTurnEnded.state, {
      type: 'end-turn', actorId: staleTarget.id,
    })
    expect(targetTurnEnded.ok, targetTurnEnded.ok ? undefined : targetTurnEnded.reason).toBe(true)
    if (!targetTurnEnded.ok) return
    const nextCasterTurnEnded = resolveDnd5eHeadlessAction(targetTurnEnded.state, {
      type: 'end-turn', actorId: caster.id,
    })
    expect(nextCasterTurnEnded.ok, nextCasterTurnEnded.ok ? undefined : nextCasterTurnEnded.reason).toBe(true)
    if (!nextCasterTurnEnded.ok) return
    expect(nextCasterTurnEnded.state.combatants[caster.id].classState.concentrationRoundsRemaining)
      .toBe(599)
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: staleTarget.id,
      effectId: 'stale-slow-effect', reason: 'concentration-ended',
    }))
  })

  it('rejects a core divination spell targeting a creature protected by Nondetection', () => {
    const caster = fighter('core-guidance-caster', 20, {
      classId: 'druid', level: 1, classSelections: { 'spell-cantrips': ['guidance'] },
    })
    const target = fighter('core-nondetection-target', 10, { position: { x: 5, y: 0 } })
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:nondetection:effect', label: '回避侦测', targetId: target.id,
      source: { kind: 'spell', actorId: target.id, rulesId: 'nondetection', magical: true },
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      modifiers: { spellTargetingImmunitySchools: ['divination'] },
    })]
    const state = startDnd5eHeadlessCombat('core-nondetection-guidance', [caster, target])
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: caster.id, targetId: target.id,
      spellId: 'guidance', slotLevel: 0, effectRolls: [],
    })

    expect(resolved).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(resolved.state.combatants[caster.id].turn.actionAvailable).toBe(true)
  })

  it('persists cumulative repeat-save progress and transitions only at the declared failure threshold', () => {
    const target = fighter('target', 20, { savingThrowBonuses: { con: 0 } })
    const caster = fighter('caster', 10, { concentrating: true })
    caster.classState.concentrationSpellId = 'progressive-save'
    caster.classState.concentrationRoundsRemaining = 10
    caster.classState.concentrationTargetIds = [target.id]
    target.classState.activeEffects = [createDnd5eConditionEffect({
      targetId: target.id,
      condition: 'restrained',
      source: {
        kind: 'spell', actorId: caster.id, rulesId: 'progressive-save', pluginId: 'srd-5.1',
        spellLevel: 6, spellSaveDc: 19, magical: true,
      },
      duration: { type: 'concentration', sourceActorId: caster.id, concentrationId: 'progressive-save' },
      repeatSave: {
        ability: 'con', dc: 14, timing: 'target-turn-end', onSuccess: 'remove',
        successesRequired: 3, failuresRequired: 3, successes: 0, failures: 1,
        onFailureTransition: {
          replaceWithCondition: 'petrified', duration: 'source-concentration-then-permanent',
        },
      },
    })]
    let state = startDnd5eHeadlessCombat('progressive-save', [target, caster])
    const effectId = state.combatants.target.classState.activeEffects![0]!.id

    const secondFailure = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn', actorId: target.id,
      activeEffectSavingThrows: [{ effectId, d20: 1 }],
    })
    expect(secondFailure.ok, secondFailure.ok ? undefined : secondFailure.reason).toBe(true)
    if (!secondFailure.ok) return
    expect(secondFailure.state.combatants.target.conditions).toContain('restrained')
    expect(secondFailure.state.combatants.target.classState.activeEffects?.[0]?.repeatSave)
      .toMatchObject({ successes: 0, failures: 2 })

    const casterTurn = resolveDnd5eHeadlessAction(secondFailure.state, {
      type: 'end-turn', actorId: caster.id,
    })
    expect(casterTurn.ok, casterTurn.ok ? undefined : casterTurn.reason).toBe(true)
    if (!casterTurn.ok) return
    state = casterTurn.state
    const thirdFailure = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn', actorId: target.id,
      activeEffectSavingThrows: [{ effectId, d20: 1 }],
    })
    expect(thirdFailure.ok, thirdFailure.ok ? undefined : thirdFailure.reason).toBe(true)
    if (!thirdFailure.ok) return
    expect(thirdFailure.state.combatants.target.conditions).not.toContain('restrained')
    expect(thirdFailure.state.combatants.target.conditions).toContain('petrified')
    expect(thirdFailure.state.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'petrified',
        duration: expect.objectContaining({ type: 'concentration', sourceActorId: caster.id }),
        persistAfterConcentrationCompletes: true,
        source: expect.objectContaining({
          pluginId: 'srd-5.1', spellLevel: 6, spellSaveDc: 19, magical: true,
        }),
      }),
    )

    const interrupted = structuredClone(thirdFailure.state)
    endDnd5eConcentration(interrupted, interrupted.combatants.caster, [])
    expect(interrupted.combatants.target.conditions).not.toContain('petrified')

    const completed = structuredClone(thirdFailure.state)
    endDnd5eConcentration(completed, completed.combatants.caster, [], 'completed')
    expect(completed.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'petrified', duration: { type: 'permanent' },
        persistAfterConcentrationCompletes: undefined,
        source: expect.objectContaining({
          pluginId: 'srd-5.1', spellLevel: 6, spellSaveDc: 19, magical: true,
        }),
      }),
    )
  })

  it('consumes ability-scoped attack disadvantage and vulnerability-to-all from shared effects', () => {
    const attacker = fighter('attacker', 20)
    attacker.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:ability-attack-disadvantage', label: '力量攻击劣势', targetId: attacker.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'test-disease', magical: true },
      modifiers: { attackRollDisadvantageAbilities: ['str'] },
    })]
    const target = fighter('target', 10, { controller: 'dm', armorClass: 10 })
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:all-damage-vulnerability', label: '全伤害易伤', targetId: target.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'test-disease', magical: true },
      modifiers: { vulnerabilityToAllDamage: true },
    })]
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('disease-modifiers', [attacker, target]),
      {
        type: 'attack', actorId: attacker.id, targetId: target.id,
        d20: 20, d20Second: 1, attackModifier: 5,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
        classDamageContext: meleeWeaponContext('longsword'), classDamageRolls: [],
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: attacker.id, hit: false,
    }))

    const cleanAttacker = fighter('clean-attacker', 20)
    const vulnerable = fighter('vulnerable', 10, { controller: 'dm', armorClass: 10 })
    vulnerable.classState.activeEffects = target.classState.activeEffects
    const doubled = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('all-vulnerability', [cleanAttacker, vulnerable]),
      {
        type: 'attack', actorId: cleanAttacker.id, targetId: vulnerable.id,
        d20: 15, attackModifier: 5,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
        classDamageContext: meleeWeaponContext('longsword'), classDamageRolls: [],
      },
    )
    expect(doubled.ok, doubled.ok ? undefined : doubled.reason).toBe(true)
    if (!doubled.ok) return
    expect(doubled.state.combatants.vulnerable.currentHp).toBe(10)
  })

  it('applies an effect-authored on-damage condition until the damaged creature next ends its turn', () => {
    const attacker = fighter('attacker', 20)
    const target = fighter('target', 10, { controller: 'dm', armorClass: 10 })
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:on-damage-stun', label: '受伤后震慑', targetId: target.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'test-disease', magical: true },
      onDamageCondition: { condition: 'stunned', duration: 'until-target-next-turn-end' },
    })]
    const hit = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('on-damage-condition', [attacker, target]), {
      type: 'attack', actorId: attacker.id, targetId: target.id, d20: 15, attackModifier: 5,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [3], type: 'slashing' },
      classDamageContext: meleeWeaponContext('longsword'), classDamageRolls: [],
    })
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.target.conditions).toContain('stunned')
    const attackerEnded = resolveDnd5eHeadlessAction(hit.state, { type: 'end-turn', actorId: attacker.id })
    expect(attackerEnded.ok, attackerEnded.ok ? undefined : attackerEnded.reason).toBe(true)
    if (!attackerEnded.ok) return
    const targetEnded = resolveDnd5eHeadlessAction(attackerEnded.state, { type: 'end-turn', actorId: target.id })
    expect(targetEnded.ok, targetEnded.ok ? undefined : targetEnded.reason).toBe(true)
    if (!targetEnded.ok) return
    expect(targetEnded.state.combatants.target.conditions).not.toContain('stunned')
  })

  it('enforces Haste speed, one restricted extra action, and its end penalty', () => {
    const actor = fighter('actor', 20, { concentrating: true, armorClass: 14 })
    const target = fighter('target', 10, { controller: 'dm', armorClass: 10, currentHp: 100, maxHp: 100 })
    actor.classState.concentrationSpellId = 'haste'
    actor.classState.concentrationRoundsRemaining = 10
    actor.classState.concentrationTargetIds = [actor.id]
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:haste:effect', label: '加速术', targetId: actor.id,
      source: { kind: 'spell', actorId: actor.id, rulesId: 'haste', magical: true },
      duration: { type: 'concentration', sourceActorId: actor.id, concentrationId: 'haste' },
      modifiers: {
        speedMultiplier: 2, armorClassBonus: 2, savingThrowAdvantages: ['dex'],
        restrictedExtraAction: {
          allowedActions: ['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'],
          maximumWeaponAttacks: 1,
        },
      },
      afterEffectEnds: {
        duration: 'until-target-next-turn-end', preventActions: true, preventMovement: true,
      },
    })]
    let state = startDnd5eHeadlessCombat('haste-exact', [actor, target])
    expect(dnd5eEffectiveSpeed(state.combatants.actor)).toBe(60)

    const attack = (current: typeof state) => resolveDnd5eHeadlessAction(current, {
      type: 'attack', actorId: actor.id, targetId: target.id, d20: 15, attackModifier: 5,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [1], type: 'slashing' },
      classDamageContext: meleeWeaponContext('longsword'), classDamageRolls: [],
    })
    const ordinary = attack(state)
    expect(ordinary.ok, ordinary.ok ? undefined : ordinary.reason).toBe(true)
    if (!ordinary.ok) return
    const hasted = attack(ordinary.state)
    expect(hasted.ok, hasted.ok ? undefined : hasted.reason).toBe(true)
    if (!hasted.ok) return
    const forbiddenThird = attack(hasted.state)
    expect(forbiddenThird).toMatchObject({ ok: false, reason: 'action-unavailable' })

    state = hasted.state
    const endEvents: Parameters<typeof endDnd5eConcentration>[2] = []
    endDnd5eConcentration(state, state.combatants.actor, endEvents)
    expect(dnd5eEffectiveSpeed(state.combatants.actor)).toBe(0)
    expect(state.combatants.actor.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'activity:haste:effect:after-effect-ends',
      modifiers: expect.objectContaining({ preventActions: true, speedOverrideFeet: 0 }),
    }))
    const blocked = resolveDnd5eHeadlessAction(state, { type: 'dash', actorId: actor.id })
    expect(blocked).toMatchObject({ ok: false, reason: 'action-unavailable' })

    const actorEnd = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: actor.id })
    expect(actorEnd.ok, actorEnd.ok ? undefined : actorEnd.reason).toBe(true)
    if (!actorEnd.ok) return
    const targetEnd = resolveDnd5eHeadlessAction(actorEnd.state, { type: 'end-turn', actorId: target.id })
    expect(targetEnd.ok, targetEnd.ok ? undefined : targetEnd.reason).toBe(true)
    if (!targetEnd.ok) return
    expect(dnd5eEffectiveSpeed(targetEnd.state.combatants.actor)).toBe(0)
    const nextActorEnd = resolveDnd5eHeadlessAction(targetEnd.state, { type: 'end-turn', actorId: actor.id })
    expect(nextActorEnd.ok, nextActorEnd.ok ? undefined : nextActorEnd.reason).toBe(true)
    if (!nextActorEnd.ok) return
    expect(dnd5eEffectiveSpeed(nextActorEnd.state.combatants.actor)).toBe(30)
  })

  it('does not leave Haste end penalty permanently active outside turn-tracked combat', () => {
    const actor = fighter('actor', 20, { concentrating: true, armorClass: 14 })
    actor.classState.concentrationSpellId = 'haste'
    actor.classState.concentrationRoundsRemaining = 10
    actor.classState.concentrationTargetIds = [actor.id]
    actor.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:haste:effect', label: '加速术', targetId: actor.id,
      source: { kind: 'spell', actorId: actor.id, rulesId: 'haste', magical: true },
      duration: { type: 'concentration', sourceActorId: actor.id, concentrationId: 'haste' },
      modifiers: { speedMultiplier: 2, armorClassBonus: 2 },
      afterEffectEnds: {
        duration: 'until-target-next-turn-end', preventActions: true, preventMovement: true,
      },
    })]
    const state = startDnd5eHeadlessCombat('haste-exploration-end', [actor])
    expect(state.active).toBe(false)

    const events: Parameters<typeof endDnd5eConcentration>[2] = []
    endDnd5eConcentration(state, state.combatants.actor, events)

    expect(dnd5eEffectiveSpeed(state.combatants.actor)).toBe(30)
    expect(state.combatants.actor.classState.activeEffects ?? []).not.toContainEqual(expect.objectContaining({
      definitionId: 'activity:haste:effect:after-effect-ends',
    }))
    expect(events).not.toContainEqual(expect.objectContaining({
      type: 'active-effect-applied',
      definitionId: 'activity:haste:effect:after-effect-ends',
    }))
  })

  it('omits only base weapon damage while an Activity replacement is armed', () => {
    const ranger = fighter('ranger', 20)
    ranger.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:lightning-arrow:replacement', label: '闪电箭', targetId: ranger.id,
      source: { kind: 'spell', actorId: ranger.id, rulesId: 'lightning-arrow' },
      modifiers: { weaponDamageReplacementAttackModes: ['ranged'] },
    })]
    const target = fighter('target', 10, { controller: 'dm', armorClass: 10 })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('weapon-damage-replacement', [ranger, target]),
      {
        type: 'attack', actorId: ranger.id, targetId: target.id,
        attackModifier: 5, d20: 15,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [6], type: 'piercing' },
        classDamageContext: {
          weaponId: 'longbow', mode: 'ranged', finesse: false, strengthBased: false,
          weaponDamageSides: 8, damageType: 'piercing', adjacentEnemyOfTarget: false,
        },
        classDamageRolls: [],
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: ranger.id, targetId: target.id, hit: true,
    }))
    expect(result.state.combatants[target.id].currentHp).toBe(20)
  })

  it('requires and settles a source-relative saving throw before crossing a movement boundary', () => {
    const mover = fighter('mover', 20, { position: { x: 5, y: 0 } })
    const source = fighter('source', 10, { position: { x: 0, y: 0 } })
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'activity:compelled-duel:boundary', label: '强令对决', targetId: mover.id,
      source: { kind: 'spell', actorId: source.id, rulesId: 'compelled-duel' },
      modifiers: { movementBoundarySave: { maximumDistanceFeet: 30, ability: 'wis', dc: 14 } },
    })
    mover.classState.activeEffects = [effect]
    const initial = startDnd5eHeadlessCombat('movement-boundary', [mover, source])

    const inside = resolveDnd5eHeadlessAction(initial, {
      type: 'move', actorId: mover.id, to: { x: 25, y: 0 }, distance: 20,
    })
    expect(inside.ok).toBe(true)

    const failed = resolveDnd5eHeadlessAction(initial, {
      type: 'move', actorId: mover.id, to: { x: 31, y: 0 }, distance: 26,
      boundarySavingThrows: [{ effectId: effect.id, d20: 5 }],
    })
    expect(failed).toMatchObject({ ok: false, reason: 'movement-boundary-save-failed' })

    const passed = resolveDnd5eHeadlessAction(initial, {
      type: 'move', actorId: mover.id, to: { x: 31, y: 0 }, distance: 26,
      boundarySavingThrows: [{ effectId: effect.id, d20: 18 }],
    })
    expect(passed.ok, passed.ok ? undefined : passed.reason).toBe(true)
    if (!passed.ok) return
    expect(passed.state.combatants[mover.id].position).toEqual({ x: 31, y: 0 })
  })

  it.each([
    {
      label: 'one Tail and two Claws',
      actionId: 'multiattack',
      targetPosition: { x: 5, y: 0 },
      rolls: [
        { targetId: 'target', d20: 10, damageRolls: [[4, 4]] },
        { targetId: 'target', d20: 10, damageRolls: [[4]] },
        { targetId: 'target', d20: 10, damageRolls: [[4]] },
      ],
      expectedDamage: 25,
      expectedAttackCount: 3,
    },
    {
      label: 'two Hurl Flame attacks',
      actionId: 'multiattack-hurl-flame',
      targetPosition: { x: 30, y: 0 },
      rolls: [
        { targetId: 'target', d20: 10, damageRolls: [[4, 4, 4]] },
        { targetId: 'target', d20: 10, damageRolls: [[4, 4, 4]] },
      ],
      expectedDamage: 24,
      expectedAttackCount: 2,
    },
  ])('resolves the Barbed Devil Multiattack alternative: $label', ({
    actionId,
    targetPosition,
    rolls,
    expectedDamage,
    expectedAttackCount,
  }) => {
    const devil = fighter('barbed-devil', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:barbed-devil',
      armorClass: 15,
      currentHp: 110,
      maxHp: 110,
      position: { x: 0, y: 0 },
    })
    const target = fighter('target', 10, {
      armorClass: 10,
      currentHp: 100,
      maxHp: 100,
      position: targetPosition,
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat(`barbed-devil-${actionId}`, [devil, target]),
      {
        type: 'monster-action',
        actorId: devil.id,
        actionId,
        rolls,
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(100 - expectedDamage)
    expect(result.state.combatants[devil.id].turn.actionAvailable).toBe(false)
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(
      expectedAttackCount,
    )
  })

  it('resolves Warding Bond benefits, damage transfer, saves, and range termination', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric',
      level: 3,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-prepared': ['warding-bond'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 10)
    cleric.classState.wardingBondMaterialEquipped = true
    ally.classState.wardingBondMaterialEquipped = true
    const enemy = fighter('enemy', 5, { controller: 'dm' })
    const initial = startDnd5eHeadlessCombat('warding-bond', [cleric, ally, enemy])
    initial.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(cleric.id, ally.id)]: 5,
    }
    const cast = resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: cleric.id,
      targetId: ally.id,
      spellId: 'warding-bond',
      slotLevel: 2,
      effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[cleric.id].concentrating).toBe(false)
    expect(cast.state.combatants[ally.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:warding-bond',
        modifiers: expect.objectContaining({
          armorClassBonus: 1,
          savingThrowBonus: 1,
          resistanceToAllDamage: true,
        }),
      }),
    )
    expect(dnd5eTargetArmorClassForAttack(cast.state, enemy.id, ally.id)).toBe(17)

    for (const participantId of [cleric.id, ally.id]) {
      const materialState = structuredClone(cast.state)
      materialState.initiativeIndex = materialState.initiativeOrder.indexOf(enemy.id)
      materialState.combatants[participantId].classState.wardingBondMaterialEquipped = false
      const removed = resolveDnd5eHeadlessAction(materialState, {
        type: 'end-turn', actorId: enemy.id,
      })
      expect(removed.ok).toBe(true)
      if (!removed.ok) continue
      expect(removed.state.combatants[ally.id].classState.activeEffects ?? []).not.toContainEqual(
        expect.objectContaining({ definitionId: 'srd-5.1:spell:warding-bond' }),
      )
      expect(removed.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        definitionId: 'srd-5.1:spell:warding-bond',
        reason: 'material-removed',
      }))
    }

    const areaSave = resolveDnd5ePersistentAreaTrigger(
      structuredClone(cast.state),
      {
        areaId: 'warding-bond-save-reporting', sourceId: enemy.id, targetId: ally.id,
        trigger: {
          id: 'warding-bond-save-reporting', label: '守护之链豁免日志', timing: 'on-create',
          oncePerTurn: false,
          savingThrow: { ability: 'dex', dc: 20, onSuccess: 'none' },
        },
        d20: 10,
      },
    )
    expect(areaSave.ok).toBe(true)
    if (!areaSave.ok) return
    expect(areaSave.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: ally.id, ability: 'dex',
      d20: 10, modifier: 3, total: 13,
    }))

    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(enemy.id)
    cast.state.combatants[ally.id].concentrating = true
    const attack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack',
      actorId: enemy.id,
      targetId: ally.id,
      attackModifier: 5,
      d20: 19,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [9], type: 'slashing' },
    })
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants[ally.id].currentHp).toBe(16)
    expect(attack.state.combatants[cleric.id].currentHp).toBe(16)
    expect(attack.events).toContainEqual({
      type: 'warding-bond-damage-transferred',
      targetId: ally.id,
      sourceActorId: cleric.id,
      amount: 4,
    })

    const concentration = resolveDnd5eHeadlessAction(attack.state, {
      type: 'concentration-save',
      actorId: ally.id,
      d20: 7,
      dc: 10,
    })
    expect(concentration.ok).toBe(true)
    if (!concentration.ok) return
    expect(concentration.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved',
      total: 10,
      success: true,
    }))

    const dismissalState = structuredClone(concentration.state)
    dismissalState.initiativeIndex = dismissalState.initiativeOrder.indexOf(cleric.id)
    dismissalState.combatants[cleric.id].turn.actionAvailable = true
    const dismissed = resolveDnd5eHeadlessAction(dismissalState, {
      type: 'dismiss-warding-bond',
      actorId: cleric.id,
    })
    expect(dismissed.ok).toBe(true)
    if (!dismissed.ok) return
    expect(dismissed.state.combatants[cleric.id].turn.actionAvailable).toBe(false)
    expect(dismissed.state.combatants[ally.id].classState.activeEffects ?? []).not.toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:warding-bond' }),
    )

    concentration.state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(cleric.id, ally.id)]: 65,
    }
    const outOfRange = resolveDnd5eHeadlessAction(concentration.state, {
      type: 'end-turn',
      actorId: enemy.id,
    })
    expect(outOfRange.ok).toBe(true)
    if (!outOfRange.ok) return
    expect(outOfRange.state.combatants[ally.id].classState.activeEffects ?? []).not.toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:warding-bond' }),
    )
    expect(outOfRange.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      definitionId: 'srd-5.1:spell:warding-bond',
      reason: 'out-of-range',
    }))

    expect(resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: cleric.id,
      targetId: cleric.id,
      spellId: 'warding-bond',
      slotLevel: 2,
      effectRolls: [],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

  })

  it('resolves See Invisibility through authoritative sight and attack modes', () => {
    const wizard = fighter('seer', 20, {
      classId: 'wizard',
      level: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['see-invisibility'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const invisible = fighter('invisible', 10, {
      controller: 'dm',
      armorClass: 12,
      conditions: ['invisible'],
    })
    const state = startDnd5eHeadlessCombat('see-invisibility', [wizard, invisible])
    expect(dnd5eCombatantCanSee(state, wizard.id, invisible.id)).toBe(false)
    expect(dnd5eAttackerIsUnseenForAttack(state, invisible.id, wizard.id)).toBe(true)

    const cast = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell',
      actorId: wizard.id,
      targetId: wizard.id,
      spellId: 'see-invisibility',
      slotLevel: 2,
      effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[wizard.id]).toMatchObject({
      concentrating: false,
      classState: {
        activeEffects: [expect.objectContaining({
          definitionId: 'srd-5.1:spell:see-invisibility',
          duration: expect.objectContaining({ type: 'rounds', remainingRounds: 600 }),
          modifiers: expect.objectContaining({ seeInvisible: true }),
        })],
      },
    })
    expect(dnd5eCombatantCanSee(cast.state, wizard.id, invisible.id)).toBe(true)
    expect(dnd5eAttackerIsUnseenForAttack(cast.state, invisible.id, wizard.id)).toBe(false)

    cast.state.combatants[wizard.id].turn.actionAvailable = true
    const attack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack',
      actorId: wizard.id,
      targetId: invisible.id,
      attackModifier: 5,
      d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 10,
      total: 15,
    }))
    expect(attack.state.combatants[wizard.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:see-invisibility' }),
    )

    const blocked = structuredClone(attack.state)
    blocked.physicalLineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey(wizard.id, invisible.id)]: true,
    }
    expect(dnd5eCombatantCanSee(blocked, wizard.id, invisible.id)).toBe(false)

    const hidden = structuredClone(attack.state)
    hidden.combatants[invisible.id].classState.hiddenCheckTotal = 20
    expect(dnd5eCombatantCanSee(hidden, wizard.id, invisible.id)).toBe(false)

    const darkness = structuredClone(attack.state)
    darkness.magicalDarknessByCombatantPair = {
      [dnd5eDirectedCombatantPairKey(wizard.id, invisible.id)]: true,
    }
    expect(dnd5eCombatantCanSee(darkness, wizard.id, invisible.id)).toBe(false)
  })

  it('authoritatively resolves all six Enhance Ability options', () => {
    const cases = [
      ['bear-endurance', 'con'],
      ['bull-strength', 'str'],
      ['cat-grace', 'dex'],
      ['eagle-splendor', 'cha'],
      ['fox-cunning', 'int'],
      ['owl-wisdom', 'wis'],
    ] as const
    for (const [choice, ability] of cases) {
      const cleric = fighter(`cleric-${choice}`, 20, {
        classId: 'cleric',
        level: 5,
        abilities: { ...abilities, wis: 16 },
        classSelections: { 'spell-prepared': ['enhance-ability'] },
        classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
      })
      const ally = fighter(`ally-${choice}`, 10)
      const cast = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat(`enhance-${choice}`, [cleric, ally]),
        {
          type: 'cast-spell',
          actorId: cleric.id,
          targetId: ally.id,
          spellId: 'enhance-ability',
          slotLevel: 2,
          enhanceAbilityChoice: choice,
          effectRolls: choice === 'bear-endurance' ? [4, 5] : [],
        },
      )
      expect(cast.ok, choice).toBe(true)
      if (!cast.ok) continue
      const enhanced = cast.state.combatants[ally.id]
      expect(enhanced.classState.activeEffects, choice).toContainEqual(expect.objectContaining({
        definitionId: 'srd-5.1:spell:enhance-ability',
        modifiers: expect.objectContaining({
          abilityCheckAdvantages: [ability],
          carryingCapacityMultiplier: choice === 'bull-strength' ? 2 : undefined,
          safeFallFeet: choice === 'cat-grace' ? 20 : undefined,
        }),
      }))
      expect(enhanced.temporaryHp, choice).toBe(choice === 'bear-endurance' ? 9 : 0)

      cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(ally.id)
      const check = resolveDnd5eHeadlessAction(cast.state, {
        type: 'ability-check',
        actorId: ally.id,
        ability,
        d20: 2,
        d20Second: 18,
      })
      expect(check.ok, choice).toBe(true)
      if (!check.ok) continue
      expect(check.events, choice).toContainEqual(expect.objectContaining({
        type: 'ability-check-resolved',
        d20: 18,
        mode: 'advantage',
      }))

      if (choice === 'cat-grace') {
        check.state.combatants[ally.id].elevationFeet = 20
        const fall = resolveDnd5eHeadlessAction(check.state, {
          type: 'move',
          actorId: ally.id,
          to: { x: 1, y: 0 },
          distance: 5,
          traversalMode: 'fall',
          toElevationFeet: 0,
          fallingDamageRolls: [],
        })
        expect(fall.ok).toBe(true)
        if (fall.ok) {
          expect(fall.state.combatants[ally.id].currentHp).toBe(20)
          expect(fall.state.combatants[ally.id].conditions).not.toContain('prone')
          expect(fall.events).toContainEqual(expect.objectContaining({
            type: 'falling-damage-resolved',
            distanceFeet: 20,
            damage: 0,
            landedProne: false,
          }))
        }
      }

      if (choice === 'bear-endurance') {
        const concentrationEnded = resolveDnd5eHeadlessAction(check.state, {
          type: 'concentration-save',
          actorId: cleric.id,
          d20: 1,
          dc: 10,
        })
        expect(concentrationEnded.ok).toBe(true)
        if (concentrationEnded.ok) {
          expect(concentrationEnded.state.combatants[ally.id].temporaryHp).toBe(0)
          expect(concentrationEnded.state.combatants[ally.id].classState.temporaryHitPointsSource).toBeUndefined()
        }
      }
    }
  })

  it('locks Magic Weapon to the touched weapon and applies its upcast bonus authoritatively', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard',
      level: 11,
      mainWeaponId: 'test-longsword',
      classSelections: { 'spell-prepared': ['magic-weapon'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      armorClass: 18,
      currentHp: 20,
      maxHp: 20,
      damageDefenseRules: [{
        outcome: 'immune',
        damageTypes: ['bludgeoning', 'piercing', 'slashing'],
        delivery: 'weapon-attack',
        magical: false,
        weaponMaterialNot: 'silvered',
      }],
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('magic-weapon', [wizard, target]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'wizard',
        spellId: 'magic-weapon',
        slotLevel: 6,
        effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.wizard.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:magic-weapon',
        modifiers: { magicWeapon: { weaponId: 'test-longsword', bonus: 3 } },
        duration: expect.objectContaining({ type: 'concentration', remainingRounds: 600 }),
      }),
    )

    cast.state.combatants.wizard.turn.actionAvailable = true
    const enchantedAttack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack',
      actorId: 'wizard',
      targetId: 'target',
      attackModifier: 5,
      d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      classDamageContext: {
        weaponId: 'test-longsword',
        mode: 'melee',
        finesse: false,
        strengthBased: true,
        weaponDamageSides: 8,
        damageType: 'slashing',
        adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [],
    })
    expect(enchantedAttack.ok).toBe(true)
    if (!enchantedAttack.ok) return
    expect(enchantedAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      total: 18,
      hit: true,
    }))
    expect(enchantedAttack.state.combatants.target.currentHp).toBe(13)

    enchantedAttack.state.combatants.wizard.turn.actionAvailable = true
    const otherWeaponAttack = resolveDnd5eHeadlessAction(enchantedAttack.state, {
      type: 'attack',
      actorId: 'wizard',
      targetId: 'target',
      attackModifier: 5,
      d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [], type: 'slashing' },
      classDamageContext: {
        weaponId: 'different-weapon',
        mode: 'melee',
        finesse: false,
        strengthBased: true,
        weaponDamageSides: 8,
        damageType: 'slashing',
        adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [],
    })
    expect(otherWeaponAttack.ok).toBe(true)
    if (!otherWeaponAttack.ok) return
    expect(otherWeaponAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      total: 15,
      hit: false,
    }))
  })

  it('resolves map interaction damage and conditions through the normal rules pipeline', () => {
    const actor = fighter('actor', 20, {
      damageResistances: ['fire'],
      currentHp: 20,
      maxHp: 20,
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('interaction', [actor]),
      {
        type: 'scene-interaction-outcome',
        actorId: 'actor',
        interactionId: 'burning-altar',
        steps: [
          { id: 'flame', kind: 'damage', amount: 7, damageType: 'fire' },
          {
            id: 'blinded',
            kind: 'condition',
            condition: 'blinded',
            duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
          },
        ],
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.actor.currentHp).toBe(17)
    expect(result.state.combatants.actor.conditions).toContain('blinded')
    expect(result.events).toContainEqual({
      type: 'scene-interaction-outcome-resolved',
      actorId: 'actor',
      interactionId: 'burning-altar',
      stepCount: 2,
    })
  })

  it('applies persistent-area damage to dying creatures and Moonbeam disadvantage to shapechangers', () => {
    const caster = fighter('caster', 20)
    const dying = fighter('dying', 10, {
      currentHp: 0, usesDeathSaves: true,
      deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
    })
    const dyingResult = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('area-dying', [caster, dying]),
      {
        areaId: 'spirit-guardians', sourceId: 'caster', targetId: 'dying',
        trigger: {
          id: 'damage', label: '区域伤害', timing: 'turn-start',
          oncePerRound: true, damage: { count: 1, sides: 6, modifier: 0, type: 'radiant' },
        },
        damageRolls: [4],
      },
    )
    expect(dyingResult.ok).toBe(true)
    if (!dyingResult.ok) return
    expect(dyingResult.state.combatants.dying.deathSaves.failures).toBe(1)

    const shapechanger = fighter('shapechanger', 10, {
      controller: 'dm', shapechanger: true, currentHp: 10, maxHp: 10,
      classState: {
        wildShapeFormId: 'wolf', wildShapeCurrentHp: 10,
        wildShapeOriginalCurrentHp: 20, wildShapeOriginalMaxHp: 20,
      },
    })
    const moonbeam = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('area-shapechanger', [caster, shapechanger]),
      {
        areaId: 'moonbeam', sourceId: 'caster', targetId: 'shapechanger',
        trigger: {
          id: 'moonbeam', label: '月华之光', timing: 'turn-start', oncePerTurn: true,
          savingThrow: {
            ability: 'con', dc: 12, onSuccess: 'half',
            shapechangerDisadvantage: true, revertShapechangerOnFailure: true,
          },
          damage: { count: 1, sides: 10, modifier: 0, type: 'radiant' },
        },
        d20: 20, d20Second: 1, damageRolls: [5],
      },
    )
    expect(moonbeam.ok).toBe(true)
    expect(moonbeam.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'shapechanger', d20: 1, success: false,
    }))
    expect(moonbeam.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'shapechanger', stateKey: 'shapechanger-reverted',
      active: true, targetId: 'moonbeam',
    }))
    expect(moonbeam.state.combatants.shapechanger).toMatchObject({
      currentHp: 20,
      maxHp: 20,
      classState: { shapechangerReversionAreaIds: ['moonbeam'] },
    })

    const placedHybrid = fighter('placed-hybrid', 30, {
      controller: 'dm', shapechanger: true, currentHp: 58, maxHp: 58,
      armorClass: 12, statBlockId: 'srd-5.1:werewolf-hybrid',
    })
    const forcedTrueForm = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('area-placed-shapechanger', [caster, placedHybrid]),
      {
        areaId: 'moonbeam-map-area', sourceId: caster.id, targetId: placedHybrid.id,
        trigger: {
          id: 'moonbeam', label: '月华之光', timing: 'turn-start', oncePerTurn: true,
          savingThrow: {
            ability: 'con', dc: 19, onSuccess: 'half',
            shapechangerDisadvantage: true, revertShapechangerOnFailure: true,
          },
          damage: { count: 2, sides: 10, modifier: 0, type: 'radiant' },
        },
        d20: 20, d20Second: 1, damageRolls: [3, 4],
      },
    )
    expect(forcedTrueForm.ok).toBe(true)
    if (!forcedTrueForm.ok) return
    expect(forcedTrueForm.events).toContainEqual({
      type: 'monster-shapechanged', actorId: placedHybrid.id,
      fromStatBlockId: 'srd-5.1:werewolf-hybrid',
      toStatBlockId: 'srd-5.1:werewolf-human', forced: true,
    })
    expect(forcedTrueForm.state.combatants[placedHybrid.id]).toMatchObject({
      statBlockId: 'srd-5.1:werewolf-human', armorClass: 11, currentHp: 51,
      classState: {
        monsterShapechangeOriginalStatBlockId: undefined,
        monsterShapechangeFormId: undefined,
        shapechangerReversionAreaIds: ['moonbeam-map-area'],
      },
    })
    expect(resolveDnd5eHeadlessAction(forcedTrueForm.state, {
      type: 'monster-shapechange', actorId: placedHybrid.id,
      formId: 'srd-5.1:werewolf-hybrid',
    })).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
  })

  it('emits authoritative persistent-area notifications without requiring dice or changing HP', () => {
    const caster = fighter('alarm-caster', 20)
    const intruder = fighter('alarm-intruder', 10, { controller: 'dm' })
    const result = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('area-alarm', [caster, intruder]),
      {
        areaId: 'alarm-zone', sourceId: caster.id, targetId: intruder.id,
        trigger: {
          id: 'alarm-enter-audible', label: '警报术·声音警报', timing: 'on-enter',
          oncePerRound: false,
          notification: { delivery: 'audible', audibleRadiusFeet: 60 },
        },
      },
    )
    expect(result).toMatchObject({
      ok: true,
      state: { combatants: { [intruder.id]: { currentHp: intruder.currentHp } } },
      events: expect.arrayContaining([expect.objectContaining({
        type: 'persistent-area-triggered', actorId: caster.id, targetId: intruder.id,
        notification: { delivery: 'audible', audibleRadiusFeet: 60 },
      })]),
    })
  })

  it('records a visible Zone of Truth speech restriction after a failed save and preserves it after later saves', () => {
    const caster = fighter('truth-caster', 20, { saveDc: 19 })
    const target = fighter('truth-target', 10, { controller: 'dm' })
    const trigger = {
      id: 'zone-of-truth-turn-start',
      frequencyGroupId: 'zone-of-truth-save',
      label: '诚实之域·区域内开始回合',
      timing: 'turn-start' as const,
      oncePerTurn: true,
      savingThrow: { ability: 'cha' as const, dc: 19, onSuccess: 'none' as const, magical: true },
    }
    const failed = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('zone-of-truth-failed-save', [caster, target]),
      {
        areaId: 'truth-area', areaSourceKind: 'core-spell', coreSpellId: 'zone-of-truth',
        sourceId: caster.id, targetId: target.id, trigger, d20: 1,
      },
    )
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', targetId: target.id, saveSuccess: false,
      semanticEffectApplied: {
        definitionId: 'srd-5.1:spell:zone-of-truth:failed-save',
        label: '诚实之域：区域内无法故意说谎',
      },
    }))
    expect(failed.state.combatants[target.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:zone-of-truth:failed-save',
        legacyCondition: 'truth-bound',
        tags: expect.arrayContaining(['semantic-compliance', 'speech-restriction', 'persistent-area:truth-area']),
        duration: { type: 'rounds', remainingRounds: 100, tickOn: 'target-turn-end' },
        source: expect.objectContaining({ rulesId: 'zone-of-truth', spellSaveDc: 19, magical: true }),
      }),
    )

    const laterSuccess = resolveDnd5ePersistentAreaTrigger(failed.state, {
      areaId: 'truth-area', areaSourceKind: 'core-spell', coreSpellId: 'zone-of-truth',
      sourceId: caster.id, targetId: target.id, trigger, d20: 20,
    })
    expect(laterSuccess.ok).toBe(true)
    if (!laterSuccess.ok) return
    expect(laterSuccess.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', targetId: target.id, saveSuccess: true,
      semanticEffectApplied: undefined,
    }))
    expect(laterSuccess.state.combatants[target.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:zone-of-truth:failed-save',
        legacyCondition: 'truth-bound',
      }),
    )
  })

  it('consumes the action on a failed Stinking Cloud save and grants poison immunity an automatic success', () => {
    const caster = fighter('caster', 20)
    const target = fighter('target', 10)
    const trigger = {
      id: 'stinking-cloud-turn-start',
      label: '臭云术·回合开始',
      timing: 'turn-start' as const,
      oncePerTurn: true,
      savingThrow: {
        ability: 'con' as const,
        dc: 18,
        onSuccess: 'none' as const,
        automaticSuccessForDamageImmunity: 'poison' as const,
      },
      consumeActionOnFailedSave: true,
    }
    const failed = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('stinking-cloud-fail', [caster, target]),
      { areaId: 'stinking-cloud', sourceId: 'caster', targetId: 'target', trigger, d20: 1 },
    )
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.target.turn.actionAvailable).toBe(false)
    expect(failed.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', targetId: 'target', actionConsumed: true,
    }))

    const immune = fighter('immune', 10, { damageImmunities: ['poison'] })
    const automaticallySucceeded = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('stinking-cloud-immune', [caster, immune]),
      { areaId: 'stinking-cloud', sourceId: 'caster', targetId: 'immune', trigger, d20: 1 },
    )
    expect(automaticallySucceeded.ok).toBe(true)
    if (!automaticallySucceeded.ok) return
    expect(automaticallySucceeded.state.combatants.immune.turn.actionAvailable).toBe(true)
    expect(automaticallySucceeded.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', targetId: 'immune', saveSuccess: true, actionConsumed: false,
    }))
  })

  it('records a core persistent spell condition with the trigger DC and magical provenance', () => {
    const caster = fighter('web-caster', 20, {
      classId: 'wizard',
      saveDc: 12,
      concentrating: true,
      classState: {
        concentrationSpellId: 'web',
        concentrationSpellLevel: 2,
        concentrationRoundsRemaining: 600,
      },
    })
    const target = fighter('web-target', 10, {
      controller: 'dm',
    })
    const result = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('web-provenance', [caster, target]),
      {
        areaId: 'core-spell-area:web',
        areaSourceKind: 'core-spell',
        coreSpellId: 'web',
        sourceId: caster.id,
        targetId: target.id,
        trigger: {
          id: 'web-enter',
          label: '蛛网术·进入蛛网',
          timing: 'on-enter',
          oncePerTurn: true,
          savingThrow: { ability: 'dex', dc: 19, onSuccess: 'none' },
          condition: {
            condition: 'restrained',
            duration: { expiresAt: 'permanent' },
            escapeCheck: { ability: 'str', dc: 19, economy: 'action' },
          },
        },
        d20: 1,
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: target.id, d20: 1, success: false,
    }))
    expect(result.state.combatants[target.id].classState.activeEffects).toEqual(
      expect.arrayContaining([expect.objectContaining({
        standardCondition: 'restrained',
        escapeCheck: { ability: 'str', dc: 19, economy: 'action' },
        source: expect.objectContaining({ spellSaveDc: 19, magical: true }),
      })]),
    )
  })

  it('ends an active concentration spell when the Sleet Storm Constitution save fails', () => {
    const caster = fighter('storm-caster', 20)
    const concentratingTarget = fighter('concentrating-target', 10, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bless',
        concentrationSpellLevel: 1,
        concentrationRoundsRemaining: 10,
      },
    })
    const trigger = {
      id: 'sleet-storm-concentration-turn-start',
      label: '雪雨暴·专注干扰',
      timing: 'turn-start' as const,
      oncePerTurn: true,
      savingThrow: { ability: 'con' as const, dc: 18, onSuccess: 'none' as const },
      endTargetConcentrationOnFailedSave: true,
    }
    const failed = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('sleet-storm-fail', [caster, concentratingTarget]),
      { areaId: 'sleet-storm', sourceId: caster.id, targetId: concentratingTarget.id, trigger, d20: 1 },
    )
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants[concentratingTarget.id]).toMatchObject({
      concentrating: false,
      classState: { concentrationSpellId: undefined },
    })
    expect(failed.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved', actorId: concentratingTarget.id, dc: 18, success: false,
    }))

    const succeeded = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('sleet-storm-success', [caster, concentratingTarget]),
      { areaId: 'sleet-storm', sourceId: caster.id, targetId: concentratingTarget.id, trigger, d20: 20 },
    )
    expect(succeeded.ok).toBe(true)
    if (!succeeded.ok) return
    expect(succeeded.state.combatants[concentratingTarget.id].concentrating).toBe(true)
    expect(succeeded.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved', actorId: concentratingTarget.id, dc: 18, success: true,
    }))
  })

  it('resolves the first-batch non-damage spells through authoritative Headless state', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 9, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-cantrips': ['spare-the-dying'], 'spell-prepared': ['mass-healing-word'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 10, {
      currentHp: 0, maxHp: 40, usesDeathSaves: true,
      deathSaves: { successes: 1, failures: 2, stable: false, dead: false },
    })
    const stabilized = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('stabilize', [cleric, ally]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'ally', spellId: 'spare-the-dying', slotLevel: 0,
      effectRolls: [],
    })
    expect(stabilized.ok).toBe(true)
    if (!stabilized.ok) return
    expect(stabilized.state.combatants.ally.deathSaves).toEqual({ successes: 0, failures: 0, stable: true, dead: false })
    expect(stabilized.events).toContainEqual({ type: 'creature-stabilized', actorId: 'cleric', targetId: 'ally' })

    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 5, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['false-life'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const temporary = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('false-life', [wizard, fighter('enemy', 10, { controller: 'dm' })]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'wizard', spellId: 'false-life', slotLevel: 2,
      effectRolls: [4],
    })
    expect(temporary.ok).toBe(true)
    if (!temporary.ok) return
    expect(temporary.state.combatants.wizard.temporaryHp).toBe(13)
  })

  it('consumes the action and slot but suppresses a spell cast from inside antimagic', () => {
    const wizard = fighter('antimagic-wizard', 20, {
      classId: 'wizard', level: 5, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['false-life'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
      magicSuppressed: true,
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('antimagic-casting', [wizard, fighter('antimagic-enemy', 20, { controller: 'dm' })]),
      {
        type: 'cast-spell', actorId: wizard.id, targetId: wizard.id,
        spellId: 'false-life', slotLevel: 1, effectRolls: [4],
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[wizard.id]).toMatchObject({
      temporaryHp: 0,
      turn: { actionAvailable: false },
      classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 1 } },
    })
    expect(result.events).toContainEqual({
      type: 'spell-effect-suppressed-by-area',
      actorId: wizard.id,
      targetId: wizard.id,
      spellId: 'false-life',
      spellLevel: 1,
      reason: 'antimagic',
    })
  })

  it('consumes a unified Activity spell inside antimagic without replacing the existing concentration', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const wizard = fighter('antimagic-activity-wizard', 20, {
      classId: 'wizard', level: 5, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['protection-from-evil-and-good'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
      magicSuppressed: true,
    })
    wizard.concentrating = true
    wizard.classState.concentrationSpellId = 'antimagic-field'
    wizard.classState.concentrationTargetIds = [wizard.id]
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('antimagic-activity-casting', [
        wizard,
        fighter('antimagic-activity-enemy', 10, { controller: 'dm' }),
      ]),
      {
        type: 'plugin-spell-activity', actorId: wizard.id,
        pluginAction: {
          type: 'plugin', pluginId: 'srd-5.1',
          actionId: 'spell:protection-from-evil-and-good',
          transactionId: 'antimagic-protection-cast', actorId: wizard.id,
          targetId: wizard.id, targetIds: [wizard.id], distanceFeet: 0,
          castLevel: 1, rolls: {},
        },
        spell: {
          castingClassId: 'wizard',
          spellId: 'protection-from-evil-and-good', spellName: '防护善恶',
          spellLevel: 1, slotLevel: 1, castingTime: 'action',
          declaredTargetIds: [wizard.id], concentrationRounds: 100,
          concentrationTargetIds: [wizard.id], spellSchool: 'abjuration',
        },
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[wizard.id]).toMatchObject({
      concentrating: true,
      turn: { actionAvailable: false },
      classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 1 } },
      classState: {
        concentrationSpellId: 'antimagic-field',
        concentrationTargetIds: [wizard.id],
      },
    })
    expect(result.state.combatants[wizard.id].classState.activeEffects ?? []).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: expect.objectContaining({ rulesId: 'protection-from-evil-and-good' }) }),
      ]),
    )
    expect(result).not.toHaveProperty('activityHandoffs')
    expect(result).not.toHaveProperty('activityAreaInstance')
    expect(result.events).toContainEqual({
      type: 'spell-effect-suppressed-by-area',
      actorId: wizard.id,
      targetId: wizard.id,
      spellId: 'protection-from-evil-and-good',
      spellLevel: 1,
      reason: 'antimagic',
    })
  })

  it('consumes a spell cast but suppresses its effect on a target inside antimagic', () => {
    const wizard = fighter('antimagic-caster', 20, {
      classId: 'wizard', level: 5, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const target = fighter('antimagic-target', 20, {
      controller: 'dm', currentHp: 40, maxHp: 40, magicSuppressed: true,
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('antimagic-target', [wizard, target]),
      {
        type: 'cast-spell', actorId: wizard.id, targetId: target.id,
        spellId: 'fire-bolt', slotLevel: 0, effectRolls: [],
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(40)
    expect(result.events).toContainEqual({
      type: 'spell-effect-suppressed-by-area',
      actorId: wizard.id,
      targetId: target.id,
      spellId: 'fire-bolt',
      spellLevel: 0,
      reason: 'antimagic',
    })
  })

  it('suppresses low-level spells crossing a Globe boundary but not spells cast within the same Globe', () => {
    const caster = fighter('globe-caster', 20, {
      classId: 'wizard', level: 5, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const target = fighter('globe-target', 20, {
      controller: 'dm', currentHp: 40, maxHp: 40,
      spellSuppressionAreas: [{ areaId: 'globe-1', maximumSpellLevel: 5 }],
    })
    const crossed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('globe-crossing', [caster, target]),
      {
        type: 'cast-spell', actorId: caster.id, targetId: target.id,
        spellId: 'fire-bolt', slotLevel: 0, effectRolls: [],
      },
    )
    expect(crossed.ok, crossed.ok ? undefined : crossed.reason).toBe(true)
    if (!crossed.ok) return
    expect(crossed.state.combatants[target.id].currentHp).toBe(40)
    expect(crossed.events).toContainEqual({
      type: 'spell-effect-suppressed-by-area', actorId: caster.id,
      targetId: target.id, spellId: 'fire-bolt', spellLevel: 0,
      reason: 'spell-level-barrier', areaId: 'globe-1',
    })

    const insideCaster = fighter('inside-caster', 20, {
      classId: 'wizard', level: 5, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
      spellSuppressionAreas: [{ areaId: 'globe-1', maximumSpellLevel: 5 }],
    })
    const insideTarget = fighter('inside-target', 20, {
      controller: 'dm', currentHp: 40, maxHp: 40,
      spellSuppressionAreas: [{ areaId: 'globe-1', maximumSpellLevel: 5 }],
    })
    const internal = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('globe-internal', [insideCaster, insideTarget]),
      {
        type: 'cast-spell', actorId: insideCaster.id, targetId: insideTarget.id,
        spellId: 'fire-bolt', slotLevel: 0, d20: 10, effectRolls: [4, 4],
      },
    )
    expect(internal.ok, internal.ok ? undefined : internal.reason).toBe(true)
    if (!internal.ok) return
    expect(internal.state.combatants[insideTarget.id].currentHp).toBeLessThan(40)
  })

  it('shares a self-target spell with an owned persistent companion inside the Host-derived range', () => {
    const ranger = fighter('ranger', 20, {
      classId: 'wizard', level: 5, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['false-life'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const companion = fighter('companion', 15, {
      summonedSourceCombatantId: 'ranger',
      summonedShareSelfSpellsRangeFeet: 30,
    })
    const state = startDnd5eHeadlessCombat('share-self-spell', [
      ranger, companion, fighter('enemy', 10, { controller: 'dm' }),
    ])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('ranger', 'companion')]: 20,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'ranger', targetId: 'ranger',
      spellId: 'false-life', slotLevel: 1, effectRolls: [4],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.ranger.temporaryHp).toBe(8)
    expect(result.state.combatants.companion.temporaryHp).toBe(8)
  })

  it('applies choice, repeat-save, concentration, and restoration effects for the first spell batch', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 9, proficiencyBonus: 4, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['blindness-deafness', 'hold-person', 'banishment'] },
      classResources: {
        'dnd5e-spell-slot-2': { current: 2, max: 2 },
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
      },
    })
    const humanoid = fighter('humanoid', 10, { controller: 'dm', creatureType: 'humanoid' })
    const blinded = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blindness', [wizard, humanoid]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'humanoid', spellId: 'blindness-deafness', slotLevel: 2,
      conditionChoice: 'blinded', savingThrowD20: 1, effectRolls: [],
    })
    expect(blinded.ok).toBe(true)
    if (!blinded.ok) return
    expect(blinded.state.combatants.humanoid.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'blinded', repeatSave: expect.objectContaining({
        ability: 'con', dc: 16, timing: 'target-turn-end', onSuccess: 'remove',
      }),
    }))

    const held = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hold', [wizard, humanoid]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'humanoid', spellId: 'hold-person', slotLevel: 2,
      savingThrowD20: 1, effectRolls: [],
    })
    expect(held.ok).toBe(true)
    if (!held.ok) return
    expect(held.state.combatants.wizard.classState.concentrationSpellId).toBe('hold-person')
    expect(held.state.combatants.humanoid.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'paralyzed', duration: expect.objectContaining({ type: 'concentration', sourceActorId: 'wizard' }),
    }))

    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 5, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['lesser-restoration'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const restoredTarget = fighter('restored', 10, { conditions: ['blinded'] })
    const restored = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('restoration', [cleric, restoredTarget]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'restored', spellId: 'lesser-restoration', slotLevel: 2,
      conditionChoice: 'blinded', effectRolls: [],
    })
    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.state.combatants.restored.conditions).not.toContain('blinded')

    const harmReducedTarget = fighter('harm-reduced', 10, {
      currentHp: 20,
      maxHp: 20,
      classState: {
        hitPointMaximumReductionLedger: {
          schemaVersion: 1,
          baseMaximum: 30,
          entries: [{
            id: 'harm:lesser-restoration',
            amount: 10,
            recovery: 'greater-restoration-or-other-magic',
            remainingRounds: 600,
            sourceActionId: 'harm',
            damageType: 'necrotic',
          }],
        },
      },
    })
    const diseaseCureCleric = fighter('disease-cure-cleric', 20, {
      classId: 'cleric', level: 5, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['lesser-restoration'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const diseaseCure = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('harm-lesser-restoration', [diseaseCureCleric, harmReducedTarget]),
      {
        type: 'cast-spell', actorId: diseaseCureCleric.id, targetId: harmReducedTarget.id,
        spellId: 'lesser-restoration', slotLevel: 2, conditionChoice: 'disease', effectRolls: [],
      },
    )
    expect(diseaseCure.ok, diseaseCure.ok ? undefined : diseaseCure.reason).toBe(true)
    if (!diseaseCure.ok) return
    expect(diseaseCure.state.combatants[harmReducedTarget.id]).toMatchObject({
      currentHp: 20,
      maxHp: 30,
      classState: { hitPointMaximumReductionLedger: undefined },
    })
    expect(diseaseCure.events).toContainEqual(expect.objectContaining({
      type: 'hit-point-maximum-restored',
      targetId: harmReducedTarget.id,
      amount: 10,
      maximumBefore: 20,
      maximumAfter: 30,
    }))
  })

  it('resolves Charm Person targeting, combat advantage, immunity, duration, and harmful-action cleanup', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard',
      level: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['charm-person'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 20)
    const humanoid = fighter('humanoid', 10, {
      controller: 'dm',
      creatureType: 'humanoid',
      abilities: { ...abilities, wis: 8 },
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('charm-person', [wizard, ally, humanoid]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'humanoid',
        spellId: 'charm-person',
        slotLevel: 1,
        savingThrowD20: 1,
        savingThrowD20Second: 2,
        effectRolls: [],
      },
    )
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: 'humanoid',
      d20: 2,
      success: false,
    }))
    expect(cast.state.combatants.humanoid.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'charmed',
      source: expect.objectContaining({ actorId: 'wizard', rulesId: 'charm-person', spellSaveDc: 13 }),
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
    }))
    expect(cast.state.combatants.wizard.classResources['dnd5e-spell-slot-1'].current).toBe(0)

    const allyTurn = {
      ...cast.state,
      initiativeIndex: cast.state.initiativeOrder.indexOf('ally'),
    }
    const harmfulMiss = resolveDnd5eHeadlessAction(allyTurn, {
      type: 'attack',
      actorId: 'ally',
      targetId: 'humanoid',
      attackModifier: 0,
      d20: 1,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'bludgeoning' },
    })
    expect(harmfulMiss.ok).toBe(true)
    if (!harmfulMiss.ok) return
    expect(harmfulMiss.state.combatants.humanoid.conditions).not.toContain('charmed')
    expect(harmfulMiss.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: 'humanoid',
      reason: 'harmful-action',
    }))

    const successfulSave = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('charm-person-save', [wizard, humanoid]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'humanoid',
        spellId: 'charm-person',
        slotLevel: 1,
        savingThrowD20: 1,
        savingThrowD20Second: 20,
        effectRolls: [],
      },
    )
    expect(successfulSave.ok).toBe(true)
    if (!successfulSave.ok) return
    expect(successfulSave.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      d20: 20,
      success: true,
    }))
    expect(successfulSave.state.combatants.humanoid.conditions).not.toContain('charmed')

    const immuneTarget = fighter('immune', 10, {
      controller: 'dm',
      creatureType: 'humanoid',
      conditionImmunities: ['charmed'],
    })
    const immune = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('charm-person-immune', [wizard, immuneTarget]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'immune',
        spellId: 'charm-person',
        slotLevel: 1,
        savingThrowD20: 1,
        savingThrowD20Second: 2,
        effectRolls: [],
      },
    )
    expect(immune.ok).toBe(true)
    expect(immune.state.combatants.immune.conditions).not.toContain('charmed')

    const beast = fighter('beast', 10, { controller: 'dm', creatureType: 'beast' })
    const invalidTarget = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('charm-person-beast', [wizard, beast]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'beast',
        spellId: 'charm-person',
        slotLevel: 1,
        savingThrowD20: 1,
        savingThrowD20Second: 2,
        effectRolls: [],
      },
    )
    expect(invalidTarget).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('allows Charm Person to target a friendly humanoid without combat advantage', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard',
      level: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['charm-person'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const friendlyHumanoid = fighter('friendly-humanoid', 10, {
      creatureType: 'humanoid',
      abilities: { ...abilities, wis: 8 },
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('charm-person-friendly-humanoid', [wizard, friendlyHumanoid]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'friendly-humanoid',
        spellId: 'charm-person',
        slotLevel: 1,
        savingThrowD20: 1,
        effectRolls: [],
      },
    )

    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: 'friendly-humanoid',
      d20: 1,
      success: false,
    }))
    expect(cast.state.combatants['friendly-humanoid'].conditions).toContain('charmed')
  })

  it('grants 60-foot Darkvision for ordinary darkness without penetrating heavy obscuration or magical darkness', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard',
      level: 3,
      classSelections: { 'spell-prepared': ['darkvision'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 20)
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const initial = startDnd5eHeadlessCombat('darkvision', [wizard, ally, enemy])
    initial.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('wizard', 'ally')]: 5,
      [dnd5eCombatantPairKey('ally', 'enemy')]: 50,
    }
    const cast = resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: 'wizard',
      targetId: 'ally',
      spellId: 'darkvision',
      slotLevel: 2,
      effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(dnd5eEffectiveDarkvisionRangeFeet(cast.state.combatants.ally)).toBe(60)
    expect(cast.state.combatants.ally.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:darkvision',
        modifiers: expect.objectContaining({ darkvisionRangeFeet: 60 }),
        duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      }),
    )
    expect(cast.state.combatants.wizard.concentrating).toBe(false)
    expect(cast.state.combatants.wizard.classResources['dnd5e-spell-slot-2'].current).toBe(0)

    const directedKey = dnd5eDirectedCombatantPairKey('ally', 'enemy')
    cast.state.lineOfSightBlockedByCombatantPair = { [directedKey]: true }
    cast.state.ordinaryDarknessByCombatantPair = { [directedKey]: true }
    expect(dnd5eCombatantCanSee(cast.state, 'ally', 'enemy')).toBe(true)
    cast.state.ordinaryDarknessByCombatantPair = {}
    expect(dnd5eCombatantCanSee(cast.state, 'ally', 'enemy')).toBe(false)
    cast.state.magicalDarknessByCombatantPair = { [directedKey]: true }
    expect(dnd5eCombatantCanSee(cast.state, 'ally', 'enemy')).toBe(false)
  })

  it('uses the compiled Devil’s Sight profile in magical darkness', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock',
      classSelections: { 'eldritch-invocations': ['devils-sight'] },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const state = startDnd5eHeadlessCombat('devils-sight', [warlock, enemy])
    const key = dnd5eDirectedCombatantPairKey('warlock', 'enemy')
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('warlock', 'enemy')]: 100,
    }
    state.lineOfSightBlockedByCombatantPair = { [key]: true }
    state.magicalDarknessByCombatantPair = { [key]: true }
    expect(dnd5eCombatantCanSee(state, 'warlock', 'enemy')).toBe(true)
    state.distanceFeetByCombatantPair[dnd5eCombatantPairKey('warlock', 'enemy')] = 125
    expect(dnd5eCombatantCanSee(state, 'warlock', 'enemy')).toBe(false)
  })

  it('resolves Misty Step as a 30-foot bonus-action teleport without spending movement', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard',
      level: 3,
      classSelections: { 'spell-prepared': ['misty-step'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
      position: { x: 5, y: 5 },
    })
    const initial = startDnd5eHeadlessCombat('misty-step', [
      wizard,
      fighter('enemy', 10, { controller: 'dm' }),
    ])
    const cast = resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: 'wizard',
      targetId: 'wizard',
      targetIds: [],
      spellId: 'misty-step',
      slotLevel: 2,
      teleportDestination: {
        to: { x: 35, y: 5 },
        distanceFeet: 30,
        toElevationFeet: 10,
      },
      effectRolls: [],
    })
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.wizard.position).toEqual({ x: 35, y: 5 })
    expect(cast.state.combatants.wizard.elevationFeet).toBe(10)
    expect(cast.state.combatants.wizard.turn).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: false,
      movementRemaining: 30,
    })
    expect(cast.state.combatants.wizard.classResources['dnd5e-spell-slot-2'].current).toBe(0)
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'teleported',
      actorId: 'wizard',
      spellId: 'misty-step',
      distanceFeet: 30,
    }))
    expect(cast.events.some((event) => event.type === 'moved')).toBe(false)

    const warded = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('warded-misty-step', [
      wizard, fighter('ward-enemy', 10, { controller: 'dm' }),
    ]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'wizard', targetIds: [],
      spellId: 'misty-step', slotLevel: 2,
      teleportDestination: {
        to: { x: 35, y: 5 }, distanceFeet: 30, blockedByAreaId: 'private-sanctum',
      },
      effectRolls: [],
    })
    expect(warded.ok, warded.ok ? undefined : warded.reason).toBe(true)
    if (!warded.ok) return
    expect(warded.state.combatants.wizard.position).toEqual({ x: 5, y: 5 })
    expect(warded.state.combatants.wizard.classResources['dnd5e-spell-slot-2'].current).toBe(0)
    expect(warded.events).toContainEqual({
      type: 'teleportation-blocked-by-area', actorId: 'wizard',
      spellId: 'misty-step', areaId: 'private-sanctum',
    })

    expect(resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: 'wizard',
      targetId: 'wizard',
      targetIds: [],
      spellId: 'misty-step',
      slotLevel: 2,
      teleportDestination: { to: { x: 40, y: 5 }, distanceFeet: 35 },
      effectRolls: [],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('fully resolves Hideous Laughter, including damage saves, crawling, and concentration cleanup', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['hideous-laughter'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const attacker = fighter('attacker', 20)
    const target = fighter('target', 10, { controller: 'dm' })
    const cast = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hideous-laughter', [wizard, attacker, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'hideous-laughter', slotLevel: 1,
      savingThrowD20: 1, effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.target.conditions).toEqual(expect.arrayContaining(['prone', 'incapacitated']))
    expect(cast.state.combatants.target.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:hideous-laughter:repeat-save',
      repeatSave: expect.objectContaining({
        ability: 'wis', timing: 'target-turn-end', onDamage: { mode: 'advantage' },
      }),
    }))

    const targetTurn = {
      ...cast.state,
      initiativeIndex: cast.state.initiativeOrder.indexOf('target'),
    }
    const cannotStand = resolveDnd5eHeadlessAction(targetTurn, {
      type: 'move', actorId: 'target', to: { x: 5, y: 0 }, distance: 5,
      standFromProne: true,
    })
    expect(cannotStand).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const crawled = resolveDnd5eHeadlessAction(targetTurn, {
      type: 'move', actorId: 'target', to: { x: 5, y: 0 }, distance: 5,
      standFromProne: false,
    })
    expect(crawled.ok).toBe(true)

    const attackerTurn = {
      ...cast.state,
      initiativeIndex: cast.state.initiativeOrder.indexOf('attacker'),
    }
    const damaged = resolveDnd5eHeadlessAction(attackerTurn, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    const repeatEffect = damaged.state.combatants.target.classState.activeEffects?.find((effect) =>
      effect.source.rulesId === 'hideous-laughter' && effect.repeatSave?.onDamage,
    )
    expect(repeatEffect).toBeDefined()
    expect(damaged.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-required', targetId: 'target', effectId: repeatEffect!.id,
      timing: 'takes-damage', mode: 'advantage',
    }))

    const failedDamageSave = resolveDnd5eHeadlessAction(damaged.state, {
      type: 'active-effect-damage-save', actorId: 'target', effectId: repeatEffect!.id,
      d20: 1, d20Second: 2,
    })
    expect(failedDamageSave.ok).toBe(true)
    if (!failedDamageSave.ok) return
    expect(failedDamageSave.state.combatants.target.conditions).toEqual(expect.arrayContaining(['prone', 'incapacitated']))
    expect(failedDamageSave.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-resolved', effectId: repeatEffect!.id, success: false,
    }))

    const secondDamage = resolveDnd5eHeadlessAction(attackerTurn, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [2], type: 'slashing' },
    })
    expect(secondDamage.ok).toBe(true)
    if (!secondDamage.ok) return
    const escaped = resolveDnd5eHeadlessAction(secondDamage.state, {
      type: 'active-effect-damage-save', actorId: 'target', effectId: repeatEffect!.id,
      d20: 20, d20Second: 1,
    })
    expect(escaped.ok).toBe(true)
    if (!escaped.ok) return
    expect(escaped.state.combatants.target.conditions).not.toEqual(expect.arrayContaining(['prone', 'incapacitated']))
    expect(escaped.state.combatants.wizard.concentrating).toBe(false)

    const lowIntTarget = fighter('low-int', 10, {
      controller: 'dm', abilities: { ...abilities, int: 4 },
    })
    const immune = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hideous-laughter-immune', [wizard, lowIntTarget]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'low-int', spellId: 'hideous-laughter', slotLevel: 1,
      savingThrowD20: 1, effectRolls: [],
    })
    expect(immune.ok).toBe(true)
    if (!immune.ok) return
    expect(immune.state.combatants.wizard.turn.actionAvailable).toBe(false)
    expect(immune.state.combatants.wizard.classResources['dnd5e-spell-slot-1']?.current).toBe(0)
    expect(immune.state.combatants.wizard.concentrating).toBe(false)
    expect(immune.state.combatants['low-int'].conditions).toEqual([])
    expect(immune.events).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'saving-throw-resolved', targetId: 'low-int' }),
    ]))
    expect(immune.events).toContainEqual(expect.objectContaining({
      type: 'condition-attempted', targetId: 'low-int', condition: 'incapacitated', prevented: true,
    }))
  })

  it('resolves Sleep by current HP, excludes immune creatures, and supports both wake conditions', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['sleep'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const helper = fighter('helper', 25)
    const low = fighter('low', 20, { controller: 'dm', currentHp: 4, maxHp: 20 })
    const middle = fighter('middle', 15, { controller: 'dm', currentHp: 7, maxHp: 20 })
    const high = fighter('high', 10, { controller: 'dm', currentHp: 12, maxHp: 20 })
    const undead = fighter('undead', 8, { controller: 'dm', currentHp: 1, creatureType: '亡灵' })
    const charmImmune = fighter('charm-immune', 7, {
      controller: 'dm', currentHp: 2, conditionImmunities: ['魅惑'],
    })
    const magicalSleepImmune = fighter('magical-sleep-immune', 6, {
      controller: 'dm', currentHp: 2, conditionImmunities: ['magical-sleep'],
    })
    const alreadyUnconscious = fighter('already-unconscious', 6, {
      controller: 'dm', currentHp: 3, conditions: ['unconscious', 'prone'],
    })
    const state = startDnd5eHeadlessCombat('sleep', [
      wizard, helper, low, middle, high, undead, charmImmune, magicalSleepImmune, alreadyUnconscious,
    ])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('helper', 'low')]: 5,
      [dnd5eCombatantPairKey('helper', 'middle')]: 5,
    }
    const cast = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'low',
      targetIds: ['low', 'middle', 'high', 'undead', 'charm-immune', 'magical-sleep-immune', 'already-unconscious'],
      spellId: 'sleep', slotLevel: 1, effectRolls: [4, 4, 4, 4, 4],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.low.conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(cast.state.combatants.middle.conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(cast.state.combatants.high.conditions).not.toContain('unconscious')
    expect(cast.state.combatants.undead.conditions).not.toContain('unconscious')
    expect(cast.state.combatants['charm-immune'].conditions).not.toContain('unconscious')
    expect(cast.state.combatants['magical-sleep-immune'].conditions).not.toContain('unconscious')
    expect(cast.state.combatants['already-unconscious'].classState.activeEffects)
      .not.toContainEqual(expect.objectContaining({ source: expect.objectContaining({ rulesId: 'sleep' }) }))
    expect(cast.state.combatants.low.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'unconscious', source: expect.objectContaining({ rulesId: 'sleep' }),
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      breakOn: ['takes-damage'],
    }))
    expect(cast.events).toContainEqual({
      type: 'sleep-resolved', actorId: 'wizard', spellId: 'sleep',
      hitPointPool: 20, remainingHitPoints: 9, affectedTargetIds: ['low', 'middle'],
    })
    expect(cast.state.combatants.wizard.classResources['dnd5e-spell-slot-1'].current).toBe(0)

    const helperTurn = { ...cast.state, initiativeIndex: cast.state.initiativeOrder.indexOf('helper') }
    const awakened = resolveDnd5eHeadlessAction(helperTurn, {
      type: 'wake-sleeping-creature', actorId: 'helper', targetId: 'middle',
    })
    expect(awakened.ok).toBe(true)
    if (!awakened.ok) return
    expect(awakened.state.combatants.middle.conditions).not.toContain('unconscious')
    expect(awakened.state.combatants.middle.conditions).toContain('prone')
    expect(awakened.state.combatants.helper.turn.actionAvailable).toBe(false)
    expect(awakened.events).toContainEqual({
      type: 'sleeping-creature-awakened', actorId: 'helper', targetId: 'middle', spellId: 'sleep',
    })

    const helperAttackTurn = { ...cast.state, initiativeIndex: cast.state.initiativeOrder.indexOf('helper') }
    const damaged = resolveDnd5eHeadlessAction(helperAttackTurn, {
      type: 'attack', actorId: 'helper', targetId: 'low', attackModifier: 20,
      d20: 10, d20Second: 15,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1, 1], type: 'bludgeoning' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.low.conditions).not.toContain('unconscious')
    expect(damaged.state.combatants.low.conditions).toContain('prone')
    expect(damaged.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: 'low', reason: 'takes-damage',
    }))
  })

  it('adds two Sleep pool dice per higher slot and rejects forged dice', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 3,
      classSelections: { 'spell-prepared': ['sleep'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, { controller: 'dm', currentHp: 21, maxHp: 21 })
    const state = startDnd5eHeadlessCombat('sleep-upcast', [wizard, target])
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'sleep', slotLevel: 2,
      effectRolls: [3, 3, 3, 3, 3, 3],
    })).toMatchObject({ ok: false, reason: 'invalid-dice' })
    const cast = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'sleep', slotLevel: 2,
      effectRolls: [3, 3, 3, 3, 3, 3, 3],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.target.conditions).toContain('unconscious')
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'sleep-resolved', hitPointPool: 21, remainingHitPoints: 0,
    }))
  })

  it('resolves Color Spray by current HP and expires blindness at the caster next turn end', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 3,
      classSelections: { 'spell-prepared': ['color-spray'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const lowCharm = createDnd5eConditionEffect({
      id: 'color-spray:charm-person',
      condition: 'charmed',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'charm-person' },
      targetId: 'low',
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
    })
    const low = fighter('low', 15, {
      controller: 'dm', currentHp: 4, maxHp: 20,
      classState: { activeEffects: [lowCharm] },
    })
    const middle = fighter('middle', 14, { controller: 'dm', currentHp: 7, maxHp: 20 })
    const high = fighter('high', 13, { controller: 'dm', currentHp: 8, maxHp: 20 })
    const alreadyBlind = fighter('already-blind', 12, {
      controller: 'dm', currentHp: 1, maxHp: 20, conditions: ['blinded'],
    })
    const blindImmune = fighter('blind-immune', 11, {
      controller: 'dm', currentHp: 2, maxHp: 20, conditionImmunities: ['blinded'],
    })
    const state = startDnd5eHeadlessCombat('color-spray', [
      wizard, low, middle, high, alreadyBlind, blindImmune,
    ])
    const cast = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'low',
      targetIds: ['low', 'middle', 'high', 'already-blind', 'blind-immune'],
      spellId: 'color-spray', slotLevel: 1, effectRolls: [2, 2, 2, 2, 2, 2],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.low.conditions).toContain('blinded')
    expect(cast.state.combatants.low.conditions).not.toContain('charmed')
    expect(cast.state.combatants.middle.conditions).toContain('blinded')
    expect(cast.state.combatants.high.conditions).not.toContain('blinded')
    expect(cast.state.combatants['blind-immune'].conditions).not.toContain('blinded')
    expect(cast.events).toContainEqual({
      type: 'color-spray-resolved', actorId: 'wizard', spellId: 'color-spray',
      hitPointPool: 12, remainingHitPoints: 1, affectedTargetIds: ['low', 'middle'],
    })
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: 'low', reason: 'harmful-action',
    }))
    expect(cast.state.combatants.low.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:color-spray:blinded',
      stackingKey: 'srd-5.1:spell:color-spray:blinded',
      source: expect.objectContaining({ rulesId: 'color-spray' }),
      duration: expect.objectContaining({ type: 'until-turn-boundary', boundary: 'source-turn-end' }),
    }))

    let advanced = resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: 'wizard' })
    expect(advanced.ok).toBe(true)
    for (const actorId of ['low', 'middle', 'high', 'already-blind', 'blind-immune']) {
      if (!advanced.ok) return
      advanced = resolveDnd5eHeadlessAction(advanced.state, { type: 'end-turn', actorId })
      expect(advanced.ok).toBe(true)
    }
    if (!advanced.ok) return
    expect(advanced.state.combatants.low.conditions).toContain('blinded')
    const expired = resolveDnd5eHeadlessAction(advanced.state, { type: 'end-turn', actorId: 'wizard' })
    expect(expired.ok).toBe(true)
    if (!expired.ok) return
    expect(expired.state.combatants.low.conditions).not.toContain('blinded')
    expect(expired.state.combatants.middle.conditions).not.toContain('blinded')
  })

  it('adds Divine Favor radiant damage to authoritative weapon hits', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', level: 2, abilities: { ...abilities, cha: 16 },
      classSelections: { 'spell-prepared': ['divine-favor'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, { controller: 'dm', armorClass: 12 })
    const secondTarget = fighter('second-target', 5, { controller: 'dm', armorClass: 12 })
    const cast = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('divine-favor', [paladin, target, secondTarget]), {
      type: 'cast-spell', actorId: 'paladin', targetId: 'paladin',
      spellId: 'divine-favor', slotLevel: 1, effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.paladin.turn.bonusActionAvailable).toBe(false)
    expect(cast.state.combatants.paladin).toMatchObject({
      concentrating: true,
      classState: { concentrationSpellId: 'divine-favor' },
    })
    expect(dnd5eWeaponClassDamageDefinitions({
      state: cast.state,
      actorId: 'paladin',
      targetId: 'target',
      context: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      critical: false,
    })).toContainEqual({
      source: 'divine-favor', count: 1, sides: 4, type: 'radiant', doubleOnCritical: true,
    })

    const attack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack', actorId: 'paladin', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'divine-favor', rolls: [4] }],
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.target.currentHp).toBe(8)
    expect(attack.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'paladin', targetId: 'target',
      source: 'divine-favor', amount: 4,
    })

    const forgedOpportunitySmite = resolveDnd5eHeadlessAction(attack.state, {
      type: 'opportunity-attack', actorId: 'paladin', targetId: 'second-target',
      attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false, divineSmiteSlotLevel: 1,
      },
      classDamageRolls: [],
    })
    expect(forgedOpportunitySmite).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const forgedOpportunityCritical = resolveDnd5eHeadlessAction(attack.state, {
      type: 'opportunity-attack', actorId: 'paladin', targetId: 'second-target',
      attackModifier: 5, criticalThreshold: 18, d20: 18,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [],
    })
    expect(forgedOpportunityCritical).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const opportunityAttack = resolveDnd5eHeadlessAction(attack.state, {
      type: 'opportunity-attack', actorId: 'paladin', targetId: 'second-target',
      attackModifier: 5, criticalThreshold: 20, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'divine-favor', rolls: [4] }],
    })
    expect(opportunityAttack.ok).toBe(true)
    if (!opportunityAttack.ok) return
    expect(opportunityAttack.state.combatants['second-target'].currentHp).toBe(8)
    expect(opportunityAttack.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'paladin', targetId: 'second-target',
      source: 'divine-favor', amount: 4,
    })
  })

  it('fully resolves Enlarge/Reduce saves, size, Strength rolls, and weapon damage', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['enlarge-reduce'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 20, { sizeRank: 2 })
    const enemy = fighter('enemy', 10, { controller: 'dm', armorClass: 10 })
    const enlarged = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('enlarge', [wizard, ally, enemy]),
      {
        type: 'cast-spell', actorId: 'wizard', targetId: 'ally',
        spellId: 'enlarge-reduce', slotLevel: 2, enlargeReduceChoice: 'enlarge',
        effectRolls: [],
      },
    )
    expect(enlarged.ok).toBe(true)
    if (!enlarged.ok) return
    expect(enlarged.state.combatants.ally.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:enlarge-reduce',
      modifiers: expect.objectContaining({
        sizeRankDelta: 1,
        strengthRollMode: 'advantage',
        weaponDamageD4: 'add',
      }),
    }))
    expect(dnd5eEffectiveSizeRank(enlarged.state.combatants.ally)).toBe(3)
    expect(dnd5eSavingThrowMode(enlarged.state.combatants.ally, 'str')).toBe('advantage')
    expect(dnd5eWeaponClassDamageDefinitions({
      state: enlarged.state,
      actorId: 'ally',
      targetId: 'enemy',
      context: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      critical: false,
    })).toContainEqual({
      source: 'enlarge', count: 1, sides: 4, type: 'slashing',
      doubleOnCritical: true, operation: 'add',
    })
    enlarged.state.initiativeIndex = enlarged.state.initiativeOrder.indexOf('ally')
    enlarged.state.combatants.ally.turn.actionAvailable = true
    const enlargedAttack = resolveDnd5eHeadlessAction(enlarged.state, {
      type: 'attack', actorId: 'ally', targetId: 'enemy', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'enlarge', rolls: [4] }],
    })
    expect(enlargedAttack.ok).toBe(true)
    if (!enlargedAttack.ok) return
    expect(enlargedAttack.state.combatants.enemy.currentHp).toBe(8)

    const reducer = fighter('reducer', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['enlarge-reduce'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const reduced = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('reduce', [reducer, enemy]),
      {
        type: 'cast-spell', actorId: 'reducer', targetId: 'reducer',
        spellId: 'enlarge-reduce', slotLevel: 2, enlargeReduceChoice: 'reduce',
        effectRolls: [],
      },
    )
    expect(reduced.ok).toBe(true)
    if (!reduced.ok) return
    reduced.state.combatants.reducer.turn.actionAvailable = true
    const reducedAttack = resolveDnd5eHeadlessAction(reduced.state, {
      type: 'attack', actorId: 'reducer', targetId: 'enemy', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'bludgeoning' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 4,
        damageType: 'bludgeoning', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'reduce', rolls: [4] }],
    })
    expect(reducedAttack.ok).toBe(true)
    if (!reducedAttack.ok) return
    expect(reducedAttack.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', targetId: 'enemy', amount: 1,
    }))

    const hostileCaster = fighter('hostile-caster', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['enlarge-reduce'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const unwilling = fighter('unwilling', 10, { controller: 'dm' })
    const saved = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('enlarge-save', [hostileCaster, unwilling]),
      {
        type: 'cast-spell', actorId: 'hostile-caster', targetId: 'unwilling',
        spellId: 'enlarge-reduce', slotLevel: 2, enlargeReduceChoice: 'enlarge',
        savingThrowD20: 20, effectRolls: [],
      },
    )
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'unwilling', ability: 'con', success: true,
    }))
    expect(saved.state.combatants.unwilling.classState.activeEffects).toBeUndefined()
  })

  it('casts Flame Blade once, then resolves its action attack without spending another slot', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid',
      level: 7,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['flame-blade'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm',
      armorClass: 10,
      currentHp: 30,
      maxHp: 30,
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('flame-blade', [druid, enemy]),
      {
        type: 'cast-spell',
        actorId: 'druid',
        targetId: 'druid',
        spellId: 'flame-blade',
        slotLevel: 4,
        effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.druid.turn).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: false,
    })
    expect(cast.state.combatants.druid.classResources['dnd5e-spell-slot-4']).toEqual({
      current: 0,
      max: 1,
    })
    expect(cast.state.combatants.druid.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:flame-blade',
        potency: 4,
        duration: expect.objectContaining({
          type: 'concentration',
          sourceActorId: 'druid',
          concentrationId: 'flame-blade',
        }),
      }),
    )

    const attack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell',
      actorId: 'druid',
      targetId: 'enemy',
      targetIds: ['enemy'],
      spellId: 'flame-blade',
      slotLevel: 4,
      sustainedEffectAttack: 'flame-blade',
      d20: 15,
      effectRolls: [1, 2, 3, 4],
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.enemy.currentHp).toBe(20)
    expect(attack.state.combatants.druid.turn.actionAvailable).toBe(false)
    expect(attack.state.combatants.druid.classResources['dnd5e-spell-slot-4']).toEqual({
      current: 0,
      max: 1,
    })
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'druid',
      targetId: 'enemy',
      hit: true,
    }))

    const forgedCaster = fighter('forged-druid', 20, {
      classId: 'druid',
      level: 3,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['flame-blade'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const forged = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('forged-flame-blade', [forgedCaster, enemy]),
      {
        type: 'cast-spell',
        actorId: 'forged-druid',
        targetId: 'enemy',
        targetIds: ['enemy'],
        spellId: 'flame-blade',
        slotLevel: 2,
        sustainedEffectAttack: 'flame-blade',
        d20: 15,
        effectRolls: [6, 6, 6],
      },
    )
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('binds Spiritual Weapon follow-up attacks to the authoritative effect instance', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric',
      level: 7,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['spiritual-weapon'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm',
      armorClass: 10,
      currentHp: 30,
      maxHp: 30,
    })
    const effectAreaId = 'core-spell-area:spiritual-weapon-cast'
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('spiritual-weapon', [cleric, enemy]),
      {
        type: 'cast-spell',
        actorId: 'cleric',
        targetId: 'enemy',
        targetIds: ['enemy'],
        spellId: 'spiritual-weapon',
        slotLevel: 4,
        sustainedEffectAreaId: effectAreaId,
        d20: 15,
        effectRolls: [3, 4],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.enemy.currentHp).toBe(19)
    expect(cast.state.combatants.cleric.turn.bonusActionAvailable).toBe(false)
    expect(cast.state.combatants.cleric.classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })
    expect(cast.state.combatants.cleric.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:spiritual-weapon',
        potency: 4,
        stackingKey: effectAreaId,
        duration: expect.objectContaining({ type: 'rounds' }),
      }),
    )
    expect(cast.state.combatants.cleric.classState.concentrationSpellId).toBeUndefined()

    cast.state.combatants.cleric.turn.bonusActionAvailable = true
    const repeated = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell',
      actorId: 'cleric',
      targetId: 'enemy',
      targetIds: ['enemy'],
      spellId: 'spiritual-weapon',
      slotLevel: 4,
      sustainedEffectAttack: 'spiritual-weapon',
      sustainedEffectAreaId: effectAreaId,
      d20: 15,
      effectRolls: [5, 5],
    })
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.state.combatants.enemy.currentHp).toBe(5)
    expect(repeated.state.combatants.cleric.turn.bonusActionAvailable).toBe(false)
    expect(repeated.state.combatants.cleric.classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })

    expect(resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell',
      actorId: 'cleric',
      targetId: 'enemy',
      targetIds: ['enemy'],
      spellId: 'spiritual-weapon',
      slotLevel: 4,
      sustainedEffectAttack: 'spiritual-weapon',
      sustainedEffectAreaId: 'core-spell-area:forged',
      d20: 15,
      effectRolls: [8, 8],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('creates Call Lightning concentration and reuses its original slot for later saving-throw strikes', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid',
      level: 7,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['call-lightning'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemyA = fighter('enemy-a', 10, {
      controller: 'dm', currentHp: 40, maxHp: 40,
    })
    const enemyB = fighter('enemy-b', 5, {
      controller: 'dm', currentHp: 40, maxHp: 40,
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('call-lightning', [druid, enemyA, enemyB]),
      {
        type: 'cast-spell',
        actorId: 'druid',
        targetId: 'enemy-a',
        targetIds: ['enemy-a', 'enemy-b'],
        spellId: 'call-lightning',
        slotLevel: 4,
        targetSavingThrows: [
          { targetId: 'enemy-a', d20: 1 },
          { targetId: 'enemy-b', d20: 20 },
        ],
        effectRolls: [1, 2, 3, 4],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants['enemy-a'].currentHp).toBe(30)
    expect(cast.state.combatants['enemy-b'].currentHp).toBe(35)
    expect(cast.state.combatants.druid.classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })
    expect(cast.state.combatants.druid.classState).toMatchObject({
      concentrationSpellId: 'call-lightning',
      activeEffects: [expect.objectContaining({
        definitionId: 'srd-5.1:spell:call-lightning',
        potency: 4,
        duration: expect.objectContaining({
          type: 'concentration',
          concentrationId: 'call-lightning',
        }),
      })],
    })

    cast.state.combatants.druid.turn.actionAvailable = true
    const repeated = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell',
      actorId: 'druid',
      targetId: 'enemy-a',
      targetIds: ['enemy-a'],
      spellId: 'call-lightning',
      slotLevel: 4,
      sustainedEffectAttack: 'call-lightning',
      sustainedEffectAreaId: 'core-spell-area:call-lightning',
      savingThrowD20: 1,
      effectRolls: [5, 5, 5, 5],
    })
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.state.combatants['enemy-a'].currentHp).toBe(10)
    expect(repeated.state.combatants.druid.turn.actionAvailable).toBe(false)
    expect(repeated.state.combatants.druid.classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })
    expect(repeated.state.combatants.druid.classState.concentrationSpellId).toBe('call-lightning')
  })

  it('enforces Call Lightning overhead space and adds the existing-storm die to initial and sustained strikes', () => {
    const druid = fighter('storm-druid', 20, {
      classId: 'druid',
      level: 7,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['call-lightning'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = fighter('storm-enemy', 10, {
      controller: 'dm', currentHp: 100, maxHp: 100,
    })
    const confined = startDnd5eHeadlessCombat('call-lightning-confined', [druid, enemy])
    confined.overheadSpace = 'confined'
    expect(resolveDnd5eHeadlessAction(confined, {
      type: 'cast-spell', actorId: druid.id, targetId: enemy.id, targetIds: [enemy.id],
      spellId: 'call-lightning', slotLevel: 4, savingThrowD20: 1,
      effectRolls: [10, 10, 10, 10],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    expect(confined.combatants[druid.id].turn.actionAvailable).toBe(true)
    expect(confined.combatants[druid.id].classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 1, max: 1 })

    const storm = startDnd5eHeadlessCombat('call-lightning-storm', [druid, enemy])
    storm.weather = 'storm'
    storm.overheadSpace = 'open'
    const cast = resolveDnd5eHeadlessAction(storm, {
      type: 'cast-spell', actorId: druid.id, targetId: enemy.id, targetIds: [enemy.id],
      spellId: 'call-lightning', slotLevel: 4, savingThrowD20: 1,
      effectRolls: [1, 2, 3, 4, 5],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[enemy.id].currentHp).toBe(85)
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', targetId: enemy.id, amount: 15,
    }))

    cast.state.combatants[druid.id].turn.actionAvailable = true
    const repeated = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell', actorId: druid.id, targetId: enemy.id, targetIds: [enemy.id],
      spellId: 'call-lightning', slotLevel: 4,
      sustainedEffectAttack: 'call-lightning',
      sustainedEffectAreaId: 'core-spell-area:call-lightning',
      savingThrowD20: 1,
      effectRolls: [5, 5, 5, 5, 5],
    })
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.state.combatants[enemy.id].currentHp).toBe(60)
    expect(repeated.state.combatants[druid.id].classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })
  })

  it('resolves Calm Emotions saves, suppresses and restores charm/fear, and keeps upcasts non-scaling', () => {
    const cleric = fighter('calm-cleric', 20, {
      classId: 'cleric', level: 9, creatureType: 'humanoid',
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['calm-emotions'] },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const charmed = createDnd5eConditionEffect({
      definitionId: 'test:charmed', condition: 'charmed',
      source: { kind: 'spell', actorId: 'enemy-source', rulesId: 'test-charm', magical: true },
      targetId: 'calm-ally', duration: { type: 'rounds', remainingRounds: 5, tickOn: 'target-turn-end' },
    })
    const frightened = createDnd5eConditionEffect({
      definitionId: 'test:frightened', condition: 'frightened',
      source: { kind: 'feature', actorId: 'enemy-source', rulesId: 'test-fear', magical: false },
      targetId: 'calm-ally', duration: { type: 'rounds', remainingRounds: 5, tickOn: 'target-turn-end' },
    })
    const ally = fighter('calm-ally', 10, {
      creatureType: 'humanoid',
      classState: { activeEffects: [charmed, frightened] },
    })
    const enemy = fighter('calm-enemy', 5, { controller: 'dm', creatureType: 'humanoid' })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('calm-suppress', [cleric, ally, enemy]),
      {
        type: 'cast-spell', actorId: cleric.id, targetId: ally.id,
        targetIds: [ally.id, enemy.id], spellId: 'calm-emotions', slotLevel: 5,
        calmEmotionsMode: 'suppress',
        targetSavingThrows: [{ targetId: enemy.id, d20: 20 }],
        effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[cleric.id].classResources['dnd5e-spell-slot-5'])
      .toEqual({ current: 0, max: 1 })
    expect(cast.state.combatants[cleric.id].classState.concentrationSpellId).toBe('calm-emotions')
    expect(cast.state.combatants[ally.id].conditions).toEqual([])
    expect(cast.state.combatants[ally.id].classState.activeEffects).toHaveLength(3)
    expect(cast.state.combatants[ally.id].classState.activeEffects?.filter((effect) =>
      effect.standardCondition === 'charmed' || effect.standardCondition === 'frightened',
    ).every((effect) => effect.suspendedBy?.length === 1)).toBe(true)
    expect(cast.state.combatants[enemy.id].classState.activeEffects).toBeUndefined()

    endDnd5eConcentration(cast.state, cast.state.combatants[cleric.id], [])
    expect(cast.state.combatants[ally.id].conditions).toEqual(expect.arrayContaining(['charmed', 'frightened']))
    expect(cast.state.combatants[ally.id].classState.activeEffects).toHaveLength(2)
    expect(cast.state.combatants[ally.id].classState.activeEffects?.every((effect) =>
      effect.suspendedBy == null,
    )).toBe(true)
  })

  it('enforces Calm Emotions indifference and ends it when the target or a friend is harmed', () => {
    const cleric = fighter('calm-indifference-cleric', 20, {
      classId: 'cleric', level: 3, creatureType: 'humanoid',
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['calm-emotions'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const enemyA = fighter('calm-enemy-a', 10, { controller: 'dm', creatureType: 'humanoid' })
    const enemyB = fighter('calm-enemy-b', 5, { controller: 'dm', creatureType: 'humanoid' })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('calm-indifference', [cleric, enemyA, enemyB]),
      {
        type: 'cast-spell', actorId: cleric.id, targetId: enemyA.id,
        targetIds: [enemyA.id, enemyB.id], spellId: 'calm-emotions', slotLevel: 2,
        calmEmotionsMode: 'indifferent', calmEmotionsIndifferenceScope: 'caster-allies',
        targetSavingThrows: [{ targetId: enemyA.id, d20: 1 }, { targetId: enemyB.id, d20: 1 }],
        effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(enemyA.id)
    const blocked = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack', actorId: enemyA.id, targetId: cleric.id,
      attackModifier: 10, d20: 20, damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(blocked).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(cast.state.combatants[enemyA.id].turn.actionAvailable).toBe(true)

    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(cleric.id)
    cast.state.combatants[cleric.id].turn.actionAvailable = true
    const harmedFriend = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack', actorId: cleric.id, targetId: enemyB.id,
      attackModifier: 10, d20: 15, damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(harmedFriend).toMatchObject({ ok: true })
    if (!harmedFriend.ok) return
    expect(harmedFriend.state.combatants[enemyA.id].classState.activeEffects).toBeUndefined()
    expect(harmedFriend.state.combatants[enemyB.id].classState.activeEffects).toBeUndefined()
  })

  it('resolves Guiding Bolt, fixed healing, healing pools, and Power Word Stun', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 17, proficiencyBonus: 6, abilities: { ...abilities, wis: 20 },
      classSelections: { 'spell-prepared': ['guiding-bolt', 'heal', 'mass-heal'] },
      classResources: {
        'dnd5e-spell-slot-1': { current: 1, max: 1 },
        'dnd5e-spell-slot-6': { current: 1, max: 1 },
        'dnd5e-spell-slot-9': { current: 1, max: 1 },
      },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm', currentHp: 100, maxHp: 100 })
    const bolt = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('guiding-bolt', [cleric, enemy]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'enemy', spellId: 'guiding-bolt', slotLevel: 1,
      d20: 15, effectRolls: [1, 2, 3, 4],
    })
    expect(bolt.ok).toBe(true)
    if (!bolt.ok) return
    expect(bolt.state.combatants.enemy.currentHp).toBe(90)
    expect(bolt.state.combatants.enemy.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:guiding-bolt:attack-advantage', breakOn: ['targeted-by-attack'],
    }))

    const feeblemindEffect = createDnd5eMechanicalEffect({
      definitionId: 'activity:spell:feeblemind:feeblemind', label: 'Feeblemind',
      tags: ['feeblemind', 'ability-recovery-group:spell.feeblemind'],
      source: { kind: 'spell', actorId: 'enemy-caster', rulesId: 'feeblemind', magical: true },
      targetId: 'patient',
      modifiers: {
        actionRestriction: { prohibited: ['spellcasting', 'object-interaction', 'speech'] },
      },
    })
    const patient = fighter('patient', 10, {
      currentHp: 1, maxHp: 200, conditions: ['blinded', 'deafened'],
      abilities: { ...abilities, int: 16, cha: 14 },
      baseSavingThrowBonuses: { int: 3, cha: 2 },
      savingThrowBonuses: { int: 3, cha: 2 },
      classState: {
        activeEffects: [feeblemindEffect],
        abilityScoreReductionLedger: [
          { id: 'feeblemind-int', ability: 'int', amount: 15, recovery: 'restoration-magic', recoveryGroupId: 'spell.feeblemind' },
          { id: 'feeblemind-cha', ability: 'cha', amount: 13, recovery: 'restoration-magic', recoveryGroupId: 'spell.feeblemind' },
        ],
      },
    })
    expect(patient.abilities).toMatchObject({ int: 1, cha: 1 })
    const healed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('heal', [cleric, patient]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'patient', spellId: 'heal', slotLevel: 6,
      effectRolls: [],
    })
    expect(healed.ok).toBe(true)
    if (!healed.ok) return
    expect(healed.state.combatants.patient).toMatchObject({
      currentHp: 71, conditions: [], abilities: { int: 16, cha: 14 },
      savingThrowBonuses: { int: 3, cha: 2 },
    })
    expect(healed.state.combatants.patient.classState.abilityScoreReductionLedger).toBeUndefined()
    expect(healed.state.combatants.patient.classState.activeEffects?.some((effect) =>
      effect.tags?.includes('feeblemind')) ?? false).toBe(false)

    const first = fighter('first', 10, { currentHp: 1, maxHp: 500 })
    const second = fighter('second', 5, { currentHp: 1, maxHp: 500 })
    const pooled = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('mass-heal', [cleric, first, second]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'first', targetIds: ['first', 'second'],
      spellId: 'mass-heal', slotLevel: 9,
      healingAllocations: [{ targetId: 'first', amount: 300 }, { targetId: 'second', amount: 400 }],
      effectRolls: [],
    })
    expect(pooled.ok).toBe(true)
    if (!pooled.ok) return
    expect(pooled.state.combatants.first.currentHp).toBe(301)
    expect(pooled.state.combatants.second.currentHp).toBe(401)

    const wizard = fighter('stunner', 20, {
      classId: 'wizard', level: 15, proficiencyBonus: 5, abilities: { ...abilities, int: 20 },
      classSelections: { 'spell-prepared': ['power-word-stun'] },
      classResources: { 'dnd5e-spell-slot-8': { current: 1, max: 1 } },
    })
    const stunned = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('stun', [wizard, enemy]), {
      type: 'cast-spell', actorId: 'stunner', targetId: 'enemy', spellId: 'power-word-stun', slotLevel: 8,
      effectRolls: [],
    })
    expect(stunned.ok).toBe(true)
    if (!stunned.ok) return
    expect(stunned.state.combatants.enemy.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'stunned', repeatSave: expect.objectContaining({ ability: 'con', dc: 18 }),
    }))
  })

  it('uses the inclusive 150 HP Power Word Stun threshold and resolves its turn-end save', () => {
    const wizard = fighter('stunner', 20, {
      classId: 'wizard', level: 20, proficiencyBonus: 6, abilities: { ...abilities, int: 20 },
      classSelections: { 'spell-prepared': ['power-word-stun'] },
      classResources: { 'dnd5e-spell-slot-8': { current: 1, max: 1 } },
    })
    const aboveThreshold = fighter('above', 10, {
      controller: 'dm', currentHp: 151, maxHp: 200,
    })
    const unaffected = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('power-word-stun-above-threshold', [wizard, aboveThreshold]),
      {
        type: 'cast-spell', actorId: wizard.id, targetId: aboveThreshold.id,
        spellId: 'power-word-stun', slotLevel: 8, effectRolls: [],
      },
    )
    expect(unaffected.ok).toBe(true)
    if (!unaffected.ok) return
    expect(unaffected.state.combatants[aboveThreshold.id].conditions).not.toContain('stunned')
    expect(unaffected.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)
    expect(unaffected.state.combatants[wizard.id].classResources['dnd5e-spell-slot-8'].current).toBe(0)

    const boundaryTarget = fighter('boundary', 10, {
      controller: 'dm', currentHp: 150, maxHp: 200,
    })
    const stunned = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('power-word-stun-boundary', [wizard, boundaryTarget]),
      {
        type: 'cast-spell', actorId: wizard.id, targetId: boundaryTarget.id,
        spellId: 'power-word-stun', slotLevel: 8, effectRolls: [],
      },
    )
    expect(stunned.ok).toBe(true)
    if (!stunned.ok) return
    expect(stunned.state.combatants[boundaryTarget.id].conditions).toContain('stunned')
    expect(stunned.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)
    const effect = stunned.state.combatants[boundaryTarget.id].classState.activeEffects?.find(
      (candidate) => candidate.standardCondition === 'stunned',
    )
    expect(effect?.repeatSave).toMatchObject({ ability: 'con', dc: 19, timing: 'target-turn-end' })
    if (!effect) return

    stunned.state.initiativeIndex = stunned.state.initiativeOrder.indexOf(boundaryTarget.id)
    const recovered = resolveDnd5eHeadlessAction(stunned.state, {
      type: 'end-turn', actorId: boundaryTarget.id,
      activeEffectSavingThrows: [{ effectId: effect.id, d20: 20 }],
    })
    expect(recovered.ok).toBe(true)
    if (!recovered.ok) return
    expect(recovered.state.combatants[boundaryTarget.id].conditions).not.toContain('stunned')
    expect(recovered.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-resolved', targetId: boundaryTarget.id,
      effectId: effect.id, success: true,
    }))
  })

  it('resolves Hellish Rebuke only as an off-turn damage reaction', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm', currentHp: 50, maxHp: 50, abilities: { ...abilities, dex: 8 } })
    const warlock = fighter('warlock', 10, {
      classId: 'warlock', level: 5, controller: 'player', proficiencyBonus: 3,
      abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-known': ['hellish-rebuke'] },
      classResources: { 'dnd5e-pact-slot': { current: 1, max: 2 } },
    })
    const state = startDnd5eHeadlessCombat('hellish-rebuke', [attacker, warlock])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'warlock')]: 30 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'hellish-rebuke', actorId: 'warlock', targetId: 'attacker', slotLevel: 3,
      triggerDamageAmount: 8, savingThrowD20: 1, effectRolls: [10, 10, 10, 10],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.attacker.currentHp).toBe(10)
    expect(result.state.combatants.warlock).toMatchObject({
      turn: { reactionAvailable: false },
      classResources: { 'dnd5e-pact-slot': { current: 0, max: 2 } },
      classState: { leveledSpellTurnKey: 'hellish-rebuke:1:warlock' },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'hellish-rebuke-resolved', actorId: 'warlock', targetId: 'attacker', damage: 40,
    }))
  })

  it('uses and consumes a Shield scroll through the authoritative hit reaction', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm', armorClass: 14 })
    const wizard = fighter('wizard', 10, {
      classId: 'wizard', level: 5, armorClass: 16, inventoryRevision: 3,
      inventoryReactionSpells: [{
        instanceId: 'shield-scroll', templateId: 'srd-5.1:spell-scroll:shield',
        itemName: '护盾术卷轴', spellId: 'shield', castAtLevel: 1,
        spellSaveDc: 13, spellAttackBonus: 5, spellcastingAbility: 'int', quantity: 1,
      }],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('shield-scroll-reaction', [attacker, wizard]),
      {
        type: 'attack', actorId: attacker.id, targetId: wizard.id,
        attackModifier: 5, d20: 12, shieldSpellReaction: true,
        damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' },
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.wizard).toMatchObject({
      currentHp: 20,
      inventoryRevision: 4,
      turn: { reactionAvailable: false },
      inventoryReactionSpells: [{ instanceId: 'shield-scroll', quantity: 0 }],
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast', actorId: 'wizard', spellId: 'shield',
      itemInstanceId: 'shield-scroll', itemName: '护盾术卷轴',
    }))
  })

  it('uses and consumes a Counterspell scroll through the authoritative cast interrupt', () => {
    const caster = fighter('caster', 20, {
      classId: 'wizard', level: 5, controller: 'player',
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const reactor = fighter('reactor', 10, {
      classId: 'wizard', level: 5, controller: 'dm', inventoryRevision: 8,
      inventoryReactionSpells: [{
        instanceId: 'counterspell-scroll', templateId: 'srd-5.1:spell-scroll:counterspell',
        itemName: '法术反制卷轴', spellId: 'counterspell', castAtLevel: 3,
        spellSaveDc: 15, spellAttackBonus: 7, spellcastingAbility: 'int', quantity: 1,
      }],
    })
    const state = startDnd5eHeadlessCombat('counterspell-scroll-reaction', [caster, reactor])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(caster.id, reactor.id)]: 30 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: caster.id, targetId: reactor.id,
      spellId: 'fire-bolt', slotLevel: 0, d20: 20, effectRolls: [6, 6],
      counterspellReaction: { actorId: reactor.id, slotLevel: 3 },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.reactor).toMatchObject({
      currentHp: 20,
      inventoryRevision: 9,
      turn: { reactionAvailable: false },
      inventoryReactionSpells: [{ instanceId: 'counterspell-scroll', quantity: 0 }],
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast', actorId: reactor.id, spellId: 'counterspell',
      itemInstanceId: 'counterspell-scroll', itemName: '法术反制卷轴',
    }))
  })

  it('uses a Hellish Rebuke scroll with its fixed save DC and consumes the scroll', () => {
    const attacker = fighter('attacker', 20, {
      controller: 'dm', currentHp: 50, maxHp: 50, abilities: { ...abilities, dex: 8 },
    })
    const warlock = fighter('warlock', 10, {
      classId: 'warlock', level: 5, controller: 'player', inventoryRevision: 11,
      abilities: { ...abilities, cha: 8 },
      inventoryReactionSpells: [{
        instanceId: 'rebuke-scroll', templateId: 'srd-5.1:spell-scroll:hellish-rebuke',
        itemName: '炼狱叱喝卷轴', spellId: 'hellish-rebuke', castAtLevel: 1,
        spellSaveDc: 13, spellAttackBonus: 5, spellcastingAbility: 'cha', quantity: 1,
      }],
    })
    const state = startDnd5eHeadlessCombat('rebuke-scroll-reaction', [attacker, warlock])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(attacker.id, warlock.id)]: 30 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'hellish-rebuke', actorId: warlock.id, targetId: attacker.id,
      slotLevel: 1, triggerDamageAmount: 8, savingThrowD20: 13, effectRolls: [10, 10],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.attacker.currentHp).toBe(30)
    expect(result.state.combatants.warlock).toMatchObject({
      inventoryRevision: 12,
      turn: { reactionAvailable: false },
      inventoryReactionSpells: [{ instanceId: 'rebuke-scroll', quantity: 0 }],
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: attacker.id, dc: 13, success: false,
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast', actorId: warlock.id, spellId: 'hellish-rebuke',
      itemInstanceId: 'rebuke-scroll', itemName: '炼狱叱喝卷轴',
    }))
  })

  it('handles Banishment, Hold Monster restrictions, and Mass Healing Word targets', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 9, proficiencyBonus: 4, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['banishment', 'hold-monster'] },
      classResources: {
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
        'dnd5e-spell-slot-5': { current: 1, max: 1 },
      },
    })
    const fiend = fighter('fiend', 10, { controller: 'dm', creatureType: 'fiend' })
    const banished = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('banishment', [wizard, fiend]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'fiend', spellId: 'banishment', slotLevel: 4,
      savingThrowD20: 1, effectRolls: [],
    })
    expect(banished.ok).toBe(true)
    if (!banished.ok) return
    expect(banished.state.combatants.fiend.conditions).toContain('banished')
    expect(banished.state.combatants.wizard.classState.concentrationSpellId).toBe('banishment')

    const undead = fighter('undead', 10, { controller: 'dm', creatureType: 'undead' })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hold-undead', [wizard, undead]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'undead', spellId: 'hold-monster', slotLevel: 5,
      savingThrowD20: 1, effectRolls: [],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 5, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['mass-healing-word'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const first = fighter('first', 10, { currentHp: 1, maxHp: 30 })
    const second = fighter('second', 5, { controller: 'dm', currentHp: 2, maxHp: 30 })
    const undeadTarget = fighter('undead-target', 5, {
      controller: 'dm', creatureType: 'undead', currentHp: 3, maxHp: 30,
    })
    const massWord = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('mass-word', [cleric, first, second, undeadTarget]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'first', targetIds: ['first', 'second', 'undead-target'],
      spellId: 'mass-healing-word', slotLevel: 3, effectRolls: [4],
    })
    expect(massWord.ok).toBe(true)
    if (!massWord.ok) return
    expect(massWord.state.combatants.first.currentHp).toBe(9)
    expect(massWord.state.combatants.second.currentHp).toBe(10)
    expect(massWord.state.combatants['undead-target'].currentHp).toBe(3)
  })

  it('resolves Counterspell inside the Headless spell transaction and spends only declared resources', () => {
    const caster = fighter('caster', 20, {
      classId: 'wizard', level: 5, controller: 'player',
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const reactor = fighter('reactor', 10, {
      classId: 'wizard', level: 5, controller: 'dm',
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['counterspell'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('counterspell', [caster, reactor])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'reactor')]: 30 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'caster', targetId: 'reactor', spellId: 'fire-bolt', slotLevel: 0,
      d20: 20, effectRolls: [6, 6], counterspellReaction: { actorId: 'reactor', slotLevel: 3 },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.reactor.currentHp).toBe(20)
    expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.reactor.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.reactor.classResources['dnd5e-spell-slot-3'].current).toBe(0)
    expect(result.state.combatants.reactor.classState.leveledSpellTurnKey).toBe('counterspell:1:reactor')
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'counterspell-resolved', actorId: 'reactor', casterId: 'caster', success: true,
    }))
  })

  it('forbids reaction spells and bonus-action spells in either order during the same turn', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', level: 5, abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'], 'spell-known': ['shield'], metamagic: ['quickened'] },
      classResources: {
        'dnd5e-spell-slot-1': { current: 1, max: 1 },
        'dnd5e-sorcery-points': { current: 4, max: 5 },
      },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm', armorClass: 10 })
    const quickenedAction = {
      type: 'cast-spell' as const, actorId: 'sorcerer', targetId: 'enemy', spellId: 'fire-bolt', slotLevel: 0,
      metamagic: { kind: 'quickened' as const }, d20: 15, d20Second: 15, effectRolls: [4, 4],
    }
    const opportunityAttack = {
      type: 'opportunity-attack' as const, actorId: 'enemy', targetId: 'sorcerer', attackModifier: 5,
      d20: 15, shieldSpellReaction: true,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2] },
    }

    const afterQuickened = startDnd5eHeadlessCombat('bonus-then-reaction', [sorcerer, enemy])
    afterQuickened.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('sorcerer', 'enemy')]: 5 }
    const quickened = resolveDnd5eHeadlessAction(afterQuickened, quickenedAction)
    expect(quickened.ok).toBe(true)
    if (!quickened.ok) return
    expect(resolveDnd5eHeadlessAction(quickened.state, opportunityAttack)).toMatchObject({
      ok: false, reason: 'invalid-class-feature',
    })

    const beforeQuickened = startDnd5eHeadlessCombat('reaction-then-bonus', [sorcerer, enemy])
    beforeQuickened.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('sorcerer', 'enemy')]: 5 }
    const shielded = resolveDnd5eHeadlessAction(beforeQuickened, opportunityAttack)
    expect(shielded.ok).toBe(true)
    if (!shielded.ok) return
    expect(shielded.state.combatants.sorcerer.classState.leveledSpellTurnKey).toBe('reaction-then-bonus:1:sorcerer')
    expect(resolveDnd5eHeadlessAction(shielded.state, quickenedAction)).toMatchObject({
      ok: false, reason: 'invalid-class-feature',
    })
  })

  it('applies Faerie Fire to failed targets and suppresses every invisibility benefit', () => {
    const bard = fighter('bard', 20, {
      classId: 'bard', level: 5, proficiencyBonus: 3, abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-known': ['faerie-fire'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const failed = fighter('failed', 10, { controller: 'dm', conditions: ['invisible'], abilities: { ...abilities, dex: 8 } })
    const passed = fighter('passed', 5, { controller: 'dm', abilities: { ...abilities, dex: 18 } })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('faerie-fire', [bard, failed, passed]), {
      type: 'cast-spell', actorId: 'bard', targetId: 'failed', targetIds: ['failed', 'passed'],
      spellId: 'faerie-fire', slotLevel: 1, effectRolls: [],
      targetSavingThrows: [{ targetId: 'failed', d20: 1 }, { targetId: 'passed', d20: 20 }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const outlined = result.state.combatants.failed
    expect(outlined.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:faerie-fire',
      duration: expect.objectContaining({ type: 'concentration', sourceActorId: 'bard' }),
    }))
    expect(result.state.combatants.passed.classState.activeEffects).toBeUndefined()
    expect(dnd5eTargetGrantsAttackAdvantage(outlined)).toBe(true)
    expect(dnd5eAttackerIsUnseen(outlined)).toBe(false)
    expect(dnd5eUnseenTargetImposesDisadvantage(bard, outlined)).toBe(false)
  })

  it('applies Hypnotic Pattern as a linked charm, incapacitation, and zero-speed effect', () => {
    const bard = fighter('bard', 20, {
      classId: 'bard', level: 5, proficiencyBonus: 3, abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-known': ['hypnotic-pattern'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const failed = fighter('failed', 10, {
      controller: 'dm', abilities: { ...abilities, wis: 8 },
    })
    const immune = fighter('immune', 5, {
      controller: 'dm', abilities: { ...abilities, wis: 8 },
      conditionImmunities: ['charmed'],
    })
    const helper = fighter('helper', 15)
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('hypnotic-pattern', [bard, helper, failed, immune]),
      {
        type: 'cast-spell', actorId: bard.id, targetId: failed.id,
        targetIds: [failed.id, immune.id], spellId: 'hypnotic-pattern', slotLevel: 3,
        targetSavingThrows: [
          { targetId: failed.id, d20: 1 },
          { targetId: immune.id, d20: 1 },
        ],
        effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.failed.conditions).toEqual(
      expect.arrayContaining(['charmed', 'incapacitated']),
    )
    expect(dnd5eEffectiveSpeed(cast.state.combatants.failed)).toBe(0)
    expect(cast.state.combatants.immune.conditions).not.toEqual(
      expect.arrayContaining(['charmed', 'incapacitated']),
    )

    const root = cast.state.combatants.failed.classState.activeEffects?.find(
      (effect) => effect.standardCondition === 'charmed' && effect.source.rulesId === 'hypnotic-pattern',
    )
    expect(root?.removal?.action).toMatchObject({
      label: '摇醒受术者',
      economy: 'action',
      maxDistanceFeet: 5,
    })
    expect(cast.state.combatants.failed.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'incapacitated',
        dependsOnEffectId: root?.id,
        modifiers: expect.objectContaining({ speedPenaltyFeet: 1_000 }),
      }),
    )

    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(helper.id)
    cast.state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(helper.id, failed.id)]: 5,
    }
    const awakened = resolveDnd5eHeadlessAction(cast.state, {
      type: 'wake-sleeping-creature',
      actorId: helper.id,
      targetId: failed.id,
    })
    expect(awakened.ok).toBe(true)
    if (!awakened.ok) return
    expect(awakened.state.combatants.failed.conditions).not.toEqual(
      expect.arrayContaining(['charmed', 'incapacitated']),
    )
    expect(dnd5eEffectiveSpeed(awakened.state.combatants.failed)).toBe(30)
    expect(awakened.events).toContainEqual({
      type: 'sleeping-creature-awakened',
      actorId: helper.id,
      targetId: failed.id,
      sourceRulesIds: ['hypnotic-pattern'],
    })
  })

  it('automates Slow penalties, concentration duration, and the end-of-turn repeat save', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 5, proficiencyBonus: 3, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['slow'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const failed = fighter('failed', 10, {
      controller: 'dm', abilities: { ...abilities, wis: 8, dex: 16 },
    })
    const passed = fighter('passed', 5, {
      controller: 'dm', abilities: { ...abilities, wis: 18, dex: 16 },
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('slow', [wizard, failed, passed]),
      {
        type: 'cast-spell', actorId: wizard.id, targetId: failed.id,
        targetIds: [failed.id, passed.id], spellId: 'slow', slotLevel: 3,
        spellSaveDc: 19,
        targetSavingThrows: [
          { targetId: failed.id, d20: 1 },
          { targetId: passed.id, d20: 20 },
        ],
        effectRolls: [],
      },
    )
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return

    const slowed = cast.state.combatants.failed
    const effect = slowed.classState.activeEffects?.find(
      (candidate) => candidate.definitionId === 'srd-5.1:spell:slow',
    )
    expect(effect).toMatchObject({
      source: { spellSaveDc: 19 },
      duration: {
        type: 'concentration',
        sourceActorId: wizard.id,
        concentrationId: 'slow',
        remainingRounds: 10,
      },
      repeatSave: {
        ability: 'wis',
        timing: 'target-turn-end',
        onSuccess: 'remove',
      },
      modifiers: {
        speedMultiplier: 0.5,
        maximumAttacksPerTurn: 1,
        actionOrBonusActionOnly: true,
        actionSpellDelay: { dieSides: 20, delayMinimum: 11 },
        armorClassBonus: -2,
        savingThrowBonusByAbility: { dex: -2 },
        preventReactions: true,
      },
    })
    expect(dnd5eEffectiveSpeed(slowed)).toBe(15)
    expect(dnd5eTargetArmorClassForAttack(cast.state, wizard.id, failed.id)).toBe(14)
    expect(dnd5eActiveSavingThrowBonus(slowed.classState.activeEffects, 'dex')).toBe(-2)
    expect(dnd5eActiveSavingThrowBonus(slowed.classState.activeEffects, 'wis')).toBe(0)
    expect(slowed.turn.reactionAvailable).toBe(false)
    expect(cast.state.combatants.passed.classState.activeEffects).toBeUndefined()

    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(failed.id)
    const recovered = resolveDnd5eHeadlessAction(cast.state, {
      type: 'end-turn',
      actorId: failed.id,
      activeEffectSavingThrows: [{ effectId: effect!.id, d20: 20 }],
    })
    expect(recovered.ok, recovered.ok ? undefined : recovered.reason).toBe(true)
    if (!recovered.ok) return
    expect(recovered.state.combatants.failed.classState.activeEffects?.some(
      (candidate) => candidate.definitionId === 'srd-5.1:spell:slow',
    )).not.toBe(true)
  })

  it('pays and postpones a Slow-delayed action spell, then completes it with the next-turn action', () => {
    const source = fighter('source', 30, {
      classId: 'wizard', level: 5, proficiencyBonus: 3,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['slow'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const delayedCaster = fighter('delayed-caster', 20, {
      controller: 'dm', classId: 'wizard', level: 5, proficiencyBonus: 3,
      abilities: { ...abilities, int: 18, wis: 8 },
      classSelections: { 'spell-prepared': ['magic-missile'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'player', currentHp: 50, maxHp: 50,
    })
    const slowed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('slow-delay', [source, delayedCaster, target]),
      {
        type: 'cast-spell', actorId: source.id, targetId: delayedCaster.id,
        targetIds: [delayedCaster.id, target.id],
        spellId: 'slow', slotLevel: 3,
        targetSavingThrows: [
          { targetId: delayedCaster.id, d20: 1 },
          { targetId: target.id, d20: 20 },
        ],
        effectRolls: [],
      },
    )
    expect(slowed.ok, slowed.ok ? undefined : slowed.reason).toBe(true)
    if (!slowed.ok) return
    const casterTurn = resolveDnd5eHeadlessAction(slowed.state, {
      type: 'end-turn', actorId: source.id,
    })
    expect(casterTurn.ok, casterTurn.ok ? undefined : casterTurn.reason).toBe(true)
    if (!casterTurn.ok) return

    const immediate = resolveDnd5eHeadlessAction(casterTurn.state, {
      type: 'cast-spell', actorId: delayedCaster.id, targetId: target.id,
      targetIds: [target.id], projectileTargetIds: [target.id, target.id, target.id],
      spellId: 'magic-missile', slotLevel: 1, slowSpellDelayD20: 5,
      effectRolls: [4, 3, 2],
    })
    expect(immediate.ok, immediate.ok ? undefined : immediate.reason).toBe(true)
    if (immediate.ok) {
      expect(immediate.state.combatants.target.currentHp).toBe(38)
      expect(immediate.state.combatants[delayedCaster.id].classState.slowDelayedSpell).toBeUndefined()
      expect(immediate.events).toContainEqual({
        type: 'slow-spell-delay-resolved', actorId: delayedCaster.id,
        spellId: 'magic-missile', slotLevel: 1, d20: 5, delayed: false,
      })
    }

    const delayed = resolveDnd5eHeadlessAction(casterTurn.state, {
      type: 'cast-spell', actorId: delayedCaster.id, targetId: target.id,
      targetIds: [target.id], projectileTargetIds: [target.id, target.id, target.id],
      spellId: 'magic-missile', slotLevel: 1, slowSpellDelayD20: 15,
      effectRolls: [4, 3, 2],
    })
    expect(delayed.ok, delayed.ok ? undefined : delayed.reason).toBe(true)
    if (!delayed.ok) return
    expect(delayed.state.combatants.target.currentHp).toBe(50)
    expect(delayed.state.combatants[delayedCaster.id].classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(delayed.state.combatants[delayedCaster.id].classState.slowDelayedSpell).toMatchObject({
      schemaVersion: 1,
      action: { spellId: 'magic-missile', slotLevel: 1 },
    })
    expect(delayed.events).toContainEqual({
      type: 'slow-spell-delay-resolved', actorId: delayedCaster.id,
      spellId: 'magic-missile', slotLevel: 1, d20: 15, delayed: true,
    })

    const slowEffect = delayed.state.combatants[delayedCaster.id].classState.activeEffects!
      .find((effect) => effect.definitionId === 'srd-5.1:spell:slow')!
    const targetTurn = resolveDnd5eHeadlessAction(delayed.state, {
      type: 'end-turn', actorId: delayedCaster.id,
      activeEffectSavingThrows: [{ effectId: slowEffect.id, d20: 1 }],
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok) return
    const sourceTurn = resolveDnd5eHeadlessAction(targetTurn.state, {
      type: 'end-turn', actorId: target.id,
    })
    expect(sourceTurn.ok, sourceTurn.ok ? undefined : sourceTurn.reason).toBe(true)
    if (!sourceTurn.ok) return
    const completed = resolveDnd5eHeadlessAction(sourceTurn.state, {
      type: 'end-turn', actorId: source.id,
    })
    expect(completed.ok, completed.ok ? undefined : completed.reason).toBe(true)
    if (!completed.ok) return
    expect(completed.state.combatants.target.currentHp).toBe(38)
    expect(completed.state.combatants[delayedCaster.id].turn.actionAvailable).toBe(false)
    expect(completed.state.combatants[delayedCaster.id].classState.slowDelayedSpell).toBeUndefined()
    expect(completed.events).toContainEqual({
      type: 'slow-delayed-spell-completed', actorId: delayedCaster.id,
      spellId: 'magic-missile', slotLevel: 1,
    })
  })

  it('resolves both Ice Storm damage components and halves each on a successful save', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, proficiencyBonus: 3, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['ice-storm'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const failed = fighter('failed', 10, {
      controller: 'dm', currentHp: 100, maxHp: 100, abilities: { ...abilities, dex: 8 },
    })
    const passed = fighter('passed', 5, {
      controller: 'dm', currentHp: 100, maxHp: 100, abilities: { ...abilities, dex: 18 },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('ice-storm', [wizard, failed, passed]),
      {
        type: 'cast-spell', actorId: wizard.id, targetId: failed.id,
        targetIds: [failed.id, passed.id], spellId: 'ice-storm', slotLevel: 4,
        targetSavingThrows: [
          { targetId: failed.id, d20: 1 },
          { targetId: passed.id, d20: 20 },
        ],
        effectRolls: [8, 8],
        additionalEffectRolls: [[6, 6, 6, 6]],
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.failed.currentHp).toBe(60)
    expect(result.state.combatants.passed.currentHp).toBe(80)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      targetId: failed.id,
      damageTypes: ['bludgeoning', 'cold'],
      amount: 40,
    }))
  })

  it('expires Chill Touch healing prevention at the caster next turn start and its undead rider at turn end', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', level: 1, controller: 'player', abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-cantrips': ['chill-touch'] },
    })
    const target = fighter('target', 15, { controller: 'dm', armorClass: 10, currentHp: 12, maxHp: 30 })
    const cleric = fighter('cleric', 10, {
      classId: 'cleric', level: 1, controller: 'dm', abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['cure-wounds'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('chill-healing', [warlock, target, cleric])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('warlock', 'target')]: 30,
      [dnd5eCombatantPairKey('target', 'cleric')]: 5,
    }
    const chilled = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'warlock', targetId: 'target', spellId: 'chill-touch', slotLevel: 0,
      d20: 15, effectRolls: [4],
    })
    expect(chilled.ok).toBe(true)
    if (!chilled.ok) return
    expect(chilled.state.combatants.target.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:chill-touch:no-healing',
      duration: expect.objectContaining({ type: 'until-turn-boundary', boundary: 'source-turn-start' }),
    }))
    const targetTurn = resolveDnd5eHeadlessAction(chilled.state, { type: 'end-turn', actorId: 'warlock' })
    expect(targetTurn.ok).toBe(true)
    if (!targetTurn.ok) return
    const clericTurn = resolveDnd5eHeadlessAction(targetTurn.state, { type: 'end-turn', actorId: 'target' })
    expect(clericTurn.ok).toBe(true)
    if (!clericTurn.ok) return
    const hpBeforeHealing = clericTurn.state.combatants.target.currentHp
    const healing = resolveDnd5eHeadlessAction(clericTurn.state, {
      type: 'cast-spell', actorId: 'cleric', targetId: 'target', spellId: 'cure-wounds', slotLevel: 1,
      effectRolls: [8],
    })
    expect(healing.ok).toBe(true)
    if (!healing.ok) return
    expect(healing.state.combatants.target.currentHp).toBe(hpBeforeHealing)
    expect(healing.events).toContainEqual(expect.objectContaining({
      type: 'healing-applied', targetId: 'target', amount: 0,
    }))
    const nextWarlockTurn = resolveDnd5eHeadlessAction(healing.state, { type: 'end-turn', actorId: 'cleric' })
    expect(nextWarlockTurn.ok).toBe(true)
    if (!nextWarlockTurn.ok) return
    expect(nextWarlockTurn.state.combatants.target.classState.activeEffects ?? []).not.toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:chill-touch:no-healing',
    }))

    const undead = fighter('undead', 10, { controller: 'dm', creatureType: 'undead', armorClass: 10 })
    const undeadState = startDnd5eHeadlessCombat('chill-undead', [warlock, undead])
    undeadState.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('warlock', 'undead')]: 30 }
    const chilledUndead = resolveDnd5eHeadlessAction(undeadState, {
      type: 'cast-spell', actorId: 'warlock', targetId: 'undead', spellId: 'chill-touch', slotLevel: 0,
      d20: 15, effectRolls: [4],
    })
    expect(chilledUndead.ok).toBe(true)
    if (!chilledUndead.ok) return
    const undeadTurn = resolveDnd5eHeadlessAction(chilledUndead.state, { type: 'end-turn', actorId: 'warlock' })
    expect(undeadTurn.ok).toBe(true)
    if (!undeadTurn.ok) return
    const attack = resolveDnd5eHeadlessAction(undeadTurn.state, {
      type: 'attack', actorId: 'undead', targetId: 'warlock', attackModifier: 5,
      d20: 20, d20Second: 1,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [4] },
    })
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'undead', targetId: 'warlock', d20: 1, hit: false,
    }))
    const nextWarlockTurnAgainstUndead = resolveDnd5eHeadlessAction(attack.state, { type: 'end-turn', actorId: 'undead' })
    expect(nextWarlockTurnAgainstUndead.ok).toBe(true)
    if (!nextWarlockTurnAgainstUndead.ok) return
    expect(nextWarlockTurnAgainstUndead.state.combatants.undead.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:chill-touch:undead-disadvantage',
      duration: expect.objectContaining({ type: 'until-turn-boundary', boundary: 'source-turn-end' }),
    }))
    const undeadTurnAfterExpiry = resolveDnd5eHeadlessAction(nextWarlockTurnAgainstUndead.state, { type: 'end-turn', actorId: 'warlock' })
    expect(undeadTurnAfterExpiry.ok).toBe(true)
    if (!undeadTurnAfterExpiry.ok) return
    expect(undeadTurnAfterExpiry.state.combatants.undead.classState.activeEffects ?? []).not.toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:chill-touch:undead-disadvantage',
    }))
  })

  it('ends normal Invisibility on a hostile spell but preserves Greater Invisibility', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, proficiencyBonus: 3, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'], 'spell-prepared': ['invisibility', 'greater-invisibility'] },
      classResources: {
        'dnd5e-spell-slot-2': { current: 1, max: 1 },
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
      },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm', currentHp: 50, maxHp: 50 })
    const invisible = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('invisibility', [wizard, enemy]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'wizard', spellId: 'invisibility', slotLevel: 2,
      effectRolls: [],
    })
    expect(invisible.ok).toBe(true)
    if (!invisible.ok) return
    invisible.state.combatants.wizard.turn.actionAvailable = true
    const revealed = resolveDnd5eHeadlessAction(invisible.state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'enemy', spellId: 'fire-bolt', slotLevel: 0,
      d20: 15, d20Second: 14, effectRolls: [5, 5],
    })
    expect(revealed.ok ? 'ok' : revealed.reason).toBe('ok')
    if (!revealed.ok) return
    expect(revealed.state.combatants.wizard.conditions).not.toContain('invisible')
    expect(revealed.state.combatants.wizard.concentrating).toBe(false)

    const greater = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('greater-invisibility', [wizard, enemy]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'wizard', spellId: 'greater-invisibility', slotLevel: 4,
      effectRolls: [],
    })
    expect(greater.ok).toBe(true)
    if (!greater.ok) return
    greater.state.combatants.wizard.turn.actionAvailable = true
    const stillHidden = resolveDnd5eHeadlessAction(greater.state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'enemy', spellId: 'fire-bolt', slotLevel: 0,
      d20: 15, d20Second: 14, effectRolls: [5, 5],
    })
    expect(stillHidden.ok).toBe(true)
    if (!stillHidden.ok) return
    expect(stillHidden.state.combatants.wizard.conditions).toContain('invisible')
    expect(stillHidden.state.combatants.wizard.concentrating).toBe(true)
  })

  it('enforces Barkskin AC and Protection from Poison through ActiveEffect state', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid', level: 5, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['barkskin', 'protection-from-poison'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 2, max: 2 } },
    })
    const ally = fighter('ally', 10, { armorClass: 11, conditions: ['poisoned'] })
    const poisoner = fighter('poisoner', 5, {
      controller: 'dm', classId: 'druid', level: 1, abilities: { ...abilities, wis: 20 },
      classSelections: { 'spell-cantrips': ['poison-spray'] },
    })
    const barkskin = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('barkskin', [druid, ally]), {
      type: 'cast-spell', actorId: 'druid', targetId: 'ally', spellId: 'barkskin', slotLevel: 2,
      effectRolls: [],
    })
    expect(barkskin.ok).toBe(true)
    if (!barkskin.ok) return
    expect(dnd5eTargetArmorClassForAttack(barkskin.state, 'druid', 'ally')).toBe(16)

    const poisonProtection = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('poison-protection', [druid, ally, poisoner]), {
      type: 'cast-spell', actorId: 'druid', targetId: 'ally', spellId: 'protection-from-poison', slotLevel: 2,
      effectRolls: [],
    })
    expect(poisonProtection.ok).toBe(true)
    if (!poisonProtection.ok) return
    const protectedAlly = poisonProtection.state.combatants.ally
    expect(protectedAlly.conditions).not.toContain('poisoned')
    expect(protectedAlly.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:protection-from-poison',
    }))
    expect(dnd5eSavingThrowMode(protectedAlly, 'con', { condition: 'poisoned' })).toBe('advantage')
    poisonProtection.state.initiativeIndex = poisonProtection.state.initiativeOrder.indexOf('poisoner')
    const poisoned = resolveDnd5eHeadlessAction(poisonProtection.state, {
      type: 'cast-spell', actorId: 'poisoner', targetId: 'ally', spellId: 'poison-spray', slotLevel: 0,
      savingThrowD20: 1, effectRolls: [12],
    })
    expect(poisoned.ok ? 'ok' : poisoned.reason).toBe('ok')
    if (!poisoned.ok) return
    expect(poisoned.state.combatants.ally.currentHp).toBe(14)
  })

  it('neutralizes only one poison when Protection from Poison targets a creature with multiple poisons', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid', level: 5, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['protection-from-poison'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const firstPoison = createDnd5eConditionEffect({
      id: 'poison:first', condition: 'poisoned', targetId: 'ally',
      source: { kind: 'monster', actorId: 'poisoner-a', rulesId: 'monster:poisoner-a:poison' },
      stackingPolicy: 'stack', stackingKey: 'poison:first',
    })
    const secondPoison = createDnd5eConditionEffect({
      id: 'poison:second', condition: 'poisoned', targetId: 'ally',
      source: { kind: 'monster', actorId: 'poisoner-b', rulesId: 'monster:poisoner-b:poison' },
      stackingPolicy: 'stack', stackingKey: 'poison:second',
    })
    const ally = fighter('ally', 10, {
      classState: { activeEffects: [firstPoison, secondPoison] },
    })
    const state = startDnd5eHeadlessCombat('protection-from-multiple-poisons', [druid, ally])
    expect(state.combatants.ally.classState.activeEffects
      ?.filter((effect) => effect.standardCondition === 'poisoned')).toHaveLength(2)
    const resolved = resolveDnd5eHeadlessAction(
      state,
      {
        type: 'cast-spell', actorId: 'druid', targetId: 'ally',
        spellId: 'protection-from-poison', slotLevel: 2, effectRolls: [],
      },
    )

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    const remainingPoisonEffects = resolved.state.combatants.ally.classState.activeEffects
      ?.filter((effect) => effect.standardCondition === 'poisoned') ?? []
    expect(remainingPoisonEffects).toHaveLength(1)
    expect(resolved.state.combatants.ally.conditions).toContain('poisoned')
    expect(resolved.state.combatants.ally.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:protection-from-poison',
    }))
    expect(resolved.events.filter((event) => event.type === 'active-effect-removed')).toHaveLength(1)
  })

  it('lets Death Ward prevent both lethal damage and a damage-free instant death', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 17, proficiencyBonus: 6, abilities: { ...abilities, wis: 20 },
      classSelections: { 'spell-prepared': ['death-ward'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 2, max: 2 } },
    })
    const warded = fighter('warded', 10, { currentHp: 5, maxHp: 30 })
    const attacker = fighter('attacker', 5, {
      controller: 'dm', classId: 'wizard', level: 17, proficiencyBonus: 6,
      abilities: { ...abilities, int: 20 },
      classSelections: { 'spell-cantrips': ['fire-bolt'], 'spell-prepared': ['power-word-kill'] },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const applied = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('death-ward-damage', [cleric, warded, attacker]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'warded', spellId: 'death-ward', slotLevel: 4,
      effectRolls: [],
    })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    applied.state.initiativeIndex = applied.state.initiativeOrder.indexOf('attacker')
    const damaged = resolveDnd5eHeadlessAction(applied.state, {
      type: 'cast-spell', actorId: 'attacker', targetId: 'warded', spellId: 'fire-bolt', slotLevel: 0,
      d20: 15, effectRolls: [10, 10, 10, 10],
    })
    expect(damaged.ok ? 'ok' : damaged.reason).toBe('ok')
    if (!damaged.ok) return
    expect(damaged.state.combatants.warded.currentHp).toBe(1)
    expect(damaged.events).toContainEqual({ type: 'death-ward-triggered', targetId: 'warded', trigger: 'damage' })

    const appliedAgain = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('death-ward-kill', [cleric, warded, attacker]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'warded', spellId: 'death-ward', slotLevel: 4,
      effectRolls: [],
    })
    expect(appliedAgain.ok).toBe(true)
    if (!appliedAgain.ok) return
    appliedAgain.state.initiativeIndex = appliedAgain.state.initiativeOrder.indexOf('attacker')
    const killed = resolveDnd5eHeadlessAction(appliedAgain.state, {
      type: 'cast-spell', actorId: 'attacker', targetId: 'warded', spellId: 'power-word-kill', slotLevel: 9,
      effectRolls: [],
    })
    expect(killed.ok).toBe(true)
    if (!killed.ok) return
    expect(killed.state.combatants.warded.currentHp).toBe(5)
    expect(killed.state.combatants.warded.deathSaves.dead).toBe(false)
    expect(killed.events).toContainEqual({ type: 'death-ward-triggered', targetId: 'warded', trigger: 'instant-death' })
  })

  it('lets a failed spell save consume Legendary Resistance before damage and conditions', () => {
    const caster = fighter('cleric', 20, {
      classId: 'cleric', level: 5, controller: 'player',
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
    })
    const legendary = fighter('legendary', 10, {
      controller: 'dm', abilities: { ...abilities, dex: 8 },
      classState: { legendaryResistanceUses: 1 },
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('legendary-resistance', [caster, legendary]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'legendary', spellId: 'sacred-flame', slotLevel: 0,
      savingThrowD20: 1, effectRolls: [], legendaryResistanceTargetIds: ['legendary'],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.legendary.currentHp).toBe(20)
    expect(result.state.combatants.legendary.classState.legendaryResistanceUses).toBe(0)
    expect(result.events).toContainEqual({ type: 'legendary-resistance-used', targetId: 'legendary', remainingUses: 0 })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', success: true }))
  })

  it('spends movement independently from the action and supports Dash', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), fighter('b', 10)])
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'a', to: { x: 20, y: 0 }, distance: 20 })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.a.turn).toMatchObject({ actionAvailable: true, movementRemaining: 10 })
    const dashed = resolveDnd5eHeadlessAction(moved.state, { type: 'dash', actorId: 'a' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.state.combatants.a.turn).toMatchObject({ actionAvailable: false, movementRemaining: 40 })
    expect(dashed.events).toContainEqual({ type: 'movement-granted', actorId: 'a', amount: 30 })
  })

  it('settles the free object interaction and action fallback in Headless economy', () => {
    const state = startDnd5eHeadlessCombat('object-interaction', [fighter('a', 20), fighter('b', 10)])
    const opened = resolveDnd5eHeadlessAction(state, {
      type: 'interact-object', actorId: 'a', interactionId: 'open:door-1',
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.state.combatants.a.turn).toMatchObject({
      actionAvailable: true, objectInteractionAvailable: false,
    })
    expect(resolveDnd5eHeadlessAction(opened.state, {
      type: 'interact-object', actorId: 'a', interactionId: 'close:door-1',
    })).toMatchObject({ ok: false, reason: 'object-interaction-unavailable' })
    const fallback = resolveDnd5eHeadlessAction(opened.state, {
      type: 'interact-object', actorId: 'a', interactionId: 'close:door-1', useAction: true,
    })
    expect(fallback.ok).toBe(true)
    if (!fallback.ok) return
    expect(fallback.state.combatants.a.turn.actionAvailable).toBe(false)
  })

  it('emits one observational result for each root Headless transaction', () => {
    const observations: unknown[] = []
    const stop = setDnd5eHeadlessResolutionObserver((observation) => observations.push(observation))
    try {
      const state = startDnd5eHeadlessCombat('observed', [fighter('a', 20), fighter('b', 10)])
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'move', actorId: 'a', to: { x: 5, y: 0 }, distance: 5,
      })
      expect(result.ok).toBe(true)
    } finally {
      stop()
    }
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({
      action: { type: 'move', actorId: 'a' },
      result: { ok: true, events: expect.arrayContaining([expect.objectContaining({ type: 'moved' })]) },
    })
  })

  it('resolves Lore Bard Peerless Skill as an authoritative ability-check resource spend', () => {
    const bard = fighter('bard', 20, {
      classId: 'bard', subclassId: 'lore', level: 14, proficiencyBonus: 5,
      abilities: { ...abilities, cha: 18 },
      skillProficiencies: ['performance'],
      classSelections: { expertise: ['performance'] },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('peerless-skill', [bard, fighter('enemy', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'ability-check', actorId: 'bard', ability: 'cha', skill: 'performance',
      d20: 2, dc: 20, peerlessSkillRoll: 6,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 4 })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 22, success: true, peerlessSkillApplied: 6,
    }))
  })

  it('allows an opposing Lore Bard to reduce an ability check with Cutting Words', () => {
    const checker = fighter('checker', 20, { controller: 'dm', abilities: { ...abilities, int: 14 } })
    const bard = fighter('bard', 10, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('cutting-check', [checker, bard]),
      {
        type: 'ability-check', actorId: 'checker', ability: 'int', d20: 13, dc: 15,
        cuttingWords: { bardId: 'bard', roll: 4, distanceFeet: 30 },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 11, success: false, cuttingWordsApplied: 4,
    }))
    expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration'].current).toBe(1)
  })

  it("supports Dark One's Own Luck and Stroke of Luck on generic ability checks", () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6,
      classResources: { 'dnd5e-dark-ones-own-luck': { current: 1, max: 1 } },
    })
    let result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('check-luck', [warlock, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'warlock', ability: 'int', d20: 5, dc: 12, darkOnesOwnLuckRoll: 7 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 12, success: true, darkOnesOwnLuckApplied: 7,
    }))
    expect(result.state.combatants.warlock.classResources['dnd5e-dark-ones-own-luck'].current).toBe(0)

    const rogue = fighter('rogue', 20, {
      classId: 'rogue', subclassId: 'thief', level: 20, proficiencyBonus: 6,
      classResources: { 'dnd5e-stroke-of-luck': { current: 1, max: 1 } },
    })
    result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('stroke-check', [rogue, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'rogue', ability: 'wis', d20: 1, dc: 15, strokeOfLuck: true },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', d20: 20, total: 21, success: true, strokeOfLuckApplied: true,
    }))
    expect(result.state.combatants.rogue.classResources['dnd5e-stroke-of-luck'].current).toBe(0)
  })

  it('applies Jack of All Trades, Reliable Talent, and Indomitable Might to generic checks', () => {
    const bard = fighter('bard', 20, { classId: 'bard', level: 5, proficiencyBonus: 3 })
    let result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('jack-check', [bard, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'bard', ability: 'wis', d20: 10 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', total: 12 }))

    const rogue = fighter('rogue', 20, {
      classId: 'rogue', level: 11, proficiencyBonus: 4,
      skillProficiencies: ['stealth'], classSelections: { expertise: ['stealth'] },
    })
    result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('reliable-check', [rogue, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'rogue', ability: 'dex', skill: 'stealth', d20: 2 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', d20: 10, total: 20, reliableTalentApplied: true,
    }))

    const barbarian = fighter('barbarian', 20, {
      classId: 'barbarian', level: 18, abilities: { ...abilities, str: 20 },
    })
    result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('might-check', [barbarian, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'barbarian', ability: 'str', d20: 1 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 20, indomitableMightApplied: true,
    }))
  })

  it('grants a raging Barbarian advantage on Strength ability checks', () => {
    const barbarian = fighter('barbarian', 20, {
      classId: 'barbarian', level: 5, classState: { raging: true },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('rage-strength-check', [barbarian, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'barbarian', ability: 'str', d20: 4, d20Second: 17 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', d20: 17, mode: 'advantage', total: 20,
    }))
  })

  it('uses an action for an attack and SRD critical damage dice', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5, d20: 20, damage: { count: 1, sides: 8, bonus: 3, rolls: [6, 4] } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.b.currentHp).toBe(7)
  })

  it('records effective hostile damage as monster threat for later target selection', () => {
    const hero = fighter('hero', 20)
    const monster = fighter('monster', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:goblin', armorClass: 10,
      currentHp: 20, maxHp: 20, temporaryHp: 2,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('threat', [hero, monster]), {
      type: 'attack', actorId: hero.id, targetId: monster.id,
      attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[monster.id].classState.monsterThreatByTargetId).toEqual({ hero: 8 })
  })

  it('authoritatively reduces a ranged weapon hit with Deflect Missiles and spends the Monk reaction', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const monk = fighter('monk', 10, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
    })
    const state = startDnd5eHeadlessCombat('deflect-missiles', [attacker, monk])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'monk', attackModifier: 10, d20: 10,
      deflectMissilesD10: 6,
      classDamageContext: {
        mode: 'ranged', finesse: false, strengthBased: false, weaponDamageSides: 8,
        damageType: 'piercing', adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8], type: 'piercing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monk.currentHp).toBe(20)
    expect(result.state.combatants.monk.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.monk.classState).toMatchObject({
      deflectMissilesCatchSourceId: 'enemy',
      deflectMissilesCatchTurnKey: 'deflect-missiles:1:enemy',
      deflectMissilesCatchDamageType: 'piercing',
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-reduced', source: 'deflect-missiles', damageBefore: 11, damageAfter: 0, caught: true,
    }))

    const returned = resolveDnd5eHeadlessAction(result.state, {
      type: 'monk-deflect-missiles-return', actorId: 'monk', targetId: 'enemy', distanceFeet: 20,
      d20: 20, damageRolls: [4, 3],
    })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.monk.classResources['dnd5e-ki']).toEqual({ current: 1, max: 5 })
    expect(returned.state.combatants.monk.classState.deflectMissilesCatchSourceId).toBeUndefined()
    expect(returned.state.combatants.enemy.currentHp).toBe(11)
    expect(returned.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'monk', targetId: 'enemy', hit: true, critical: true,
    }))
  })

  it('rejects Deflect Missiles for melee attacks and long-range return throws', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const monk = fighter('monk', 10, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
    })
    const state = startDnd5eHeadlessCombat('invalid-deflect', [attacker, monk])
    const melee = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'monk', attackModifier: 10, d20: 10,
      deflectMissilesD10: 6,
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8], type: 'slashing' },
    })
    expect(melee).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const caughtState = startDnd5eHeadlessCombat('invalid-return', [attacker, monk])
    caughtState.combatants.monk.classState.deflectMissilesCatchSourceId = 'enemy'
    caughtState.combatants.monk.classState.deflectMissilesCatchTurnKey = 'invalid-return:1:enemy'
    caughtState.combatants.monk.classState.deflectMissilesCatchDamageType = 'piercing'
    expect(resolveDnd5eHeadlessAction(caughtState, {
      type: 'monk-deflect-missiles-return', actorId: 'monk', targetId: 'enemy', distanceFeet: 65,
      d20: 20, damageRolls: [4, 3],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('uses turn-slot identity for once-per-turn features on a Thief Reflexes turn', () => {
    const rogue = fighter('rogue', 20, { classId: 'rogue', subclassId: 'thief', level: 17 })
    const state = startDnd5eHeadlessCombat('reflexes', [rogue, fighter('enemy', 10)])
    state.turnSlotId = 'rogue:normal'
    state.combatants.rogue.classState.sneakAttackTurnKey = 'reflexes:1:rogue:normal'
    const context = {
      mode: 'ranged' as const, finesse: false, strengthBased: false, monkMartialArtsEligible: false,
      weaponDamageSides: 8, damageType: 'piercing' as const, adjacentEnemyOfTarget: true,
    }
    expect(dnd5eWeaponClassDamageDefinitions({
      state, actorId: 'rogue', targetId: 'enemy', context, effectiveMode: 'normal', critical: false,
    }).some((definition) => definition.source === 'sneak-attack')).toBe(false)
    state.turnSlotId = 'rogue:thief-reflexes'
    expect(dnd5eWeaponClassDamageDefinitions({
      state, actorId: 'rogue', targetId: 'enemy', context, effectiveMode: 'normal', critical: false,
    }).some((definition) => definition.source === 'sneak-attack')).toBe(true)
  })

  it('removes first-round-only turn slots when the first round wraps', () => {
    const state = startDnd5eHeadlessCombat('first-round-slots', [
      fighter('rogue', 20, { classId: 'rogue', subclassId: 'thief', level: 17 }),
      fighter('enemy', 10, { controller: 'dm' }),
    ])
    state.initiativeOrder = ['rogue', 'enemy', 'rogue']
    state.initiativeSlotIds = ['rogue:normal', 'enemy:normal', 'rogue:extra']
    state.firstRoundOnlyInitiativeSlotIds = ['rogue:extra']
    state.turnSlotId = 'rogue:normal'

    const normalEnded = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn',
      actorId: 'rogue',
    })
    expect(normalEnded.ok).toBe(true)
    if (!normalEnded.ok) return
    const enemyEnded = resolveDnd5eHeadlessAction(normalEnded.state, {
      type: 'end-turn',
      actorId: 'enemy',
    })
    expect(enemyEnded.ok).toBe(true)
    if (!enemyEnded.ok) return
    const extraEnded = resolveDnd5eHeadlessAction(enemyEnded.state, {
      type: 'end-turn',
      actorId: 'rogue',
    })
    expect(extraEnded.ok).toBe(true)
    if (!extraEnded.ok) return

    expect(extraEnded.state).toMatchObject({
      round: 2,
      initiativeIndex: 0,
      initiativeOrder: ['rogue', 'enemy'],
      initiativeSlotIds: ['rogue:normal', 'enemy:normal'],
      turnSlotId: 'rogue:normal',
    })
    expect(extraEnded.state.firstRoundOnlyInitiativeSlotIds).toBeUndefined()
  })

  it('only turns a Champion natural 19 into a critical when the attack also hits', () => {
    const missed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('champion-miss', [fighter('a', 20), fighter('b', 10, { armorClass: 30 })]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, criticalThreshold: 19, d20: 19, damage: { count: 1, sides: 8, bonus: 0, rolls: [] } },
    )
    expect(missed.ok).toBe(true)
    if (!missed.ok) return
    expect(missed.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: false, critical: false }))
    expect(missed.state.combatants.b.currentHp).toBe(20)

    const hit = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('champion-hit', [fighter('a', 20), fighter('b', 10, { armorClass: 19 })]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, criticalThreshold: 19, d20: 19, damage: { count: 1, sides: 8, bonus: 0, rolls: [4, 5] } },
    )
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: true, critical: true }))
    expect(hit.state.combatants.b.currentHp).toBe(11)
  })

  it('applies invisibility to both sides of attack visibility', () => {
    const invisibleAttacker = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('invisible-attacker', [
        fighter('a', 20, { conditions: ['invisible'] }), fighter('b', 10),
      ]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, d20: 2, d20Second: 18, damage: { count: 1, sides: 4, bonus: 0, rolls: [2] } },
    )
    expect(invisibleAttacker.ok).toBe(true)
    if (!invisibleAttacker.ok) return
    expect(invisibleAttacker.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))

    const invisibleTarget = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('invisible-target', [
        fighter('a', 20), fighter('b', 10, { conditions: ['invisible'] }),
      ]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, d20: 18, d20Second: 2, damage: { count: 1, sides: 4, bonus: 0, rolls: [] } },
    )
    expect(invisibleTarget.ok).toBe(true)
    if (!invisibleTarget.ok) return
    expect(invisibleTarget.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('applies True Strike advantage only to the caster attacking its linked target', () => {
    const caster = fighter('caster', 20)
    caster.concentrating = true
    caster.classState.concentrationSpellId = 'true-strike'
    caster.classState.concentrationTargetIds = ['marked']
    caster.classState.concentrationRoundsRemaining = 1
    const other = fighter('other', 15)
    const marked = fighter('marked', 10, { armorClass: 16 })
    marked.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'rule-state:spell:true-strike:target-linked-effect',
      label: 'True Strike target link',
      source: { kind: 'spell', actorId: caster.id, rulesId: 'true-strike', magical: true },
      targetId: marked.id,
      legacyCondition: 'rule-state:spell:true-strike:target-linked-effect',
      duration: { type: 'concentration', sourceActorId: caster.id, remainingRounds: 1 },
    })]
    const state = startDnd5eHeadlessCombat('true-strike-linked-target', [caster, other, marked])

    const casterAttack = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: caster.id, targetId: marked.id, attackModifier: 0,
      d20: 2, d20Second: 18,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2] },
    })
    expect(casterAttack.ok).toBe(true)
    if (!casterAttack.ok) return
    expect(casterAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', d20: 18, hit: true,
    }))
    expect(casterAttack.state.combatants.caster.concentrating).toBe(false)
    expect(casterAttack.state.combatants.caster.classState.concentrationSpellId).toBeUndefined()
    expect(casterAttack.state.combatants.marked.classState.activeEffects).toBeUndefined()
    expect(casterAttack.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: 'marked', reason: 'concentration-ended',
    }))

    const otherTarget = fighter('other-target', 10, { armorClass: 16 })
    otherTarget.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'rule-state:spell:true-strike:target-linked-effect',
      label: 'True Strike target link',
      source: { kind: 'spell', actorId: caster.id, rulesId: 'true-strike', magical: true },
      targetId: otherTarget.id,
      legacyCondition: 'rule-state:spell:true-strike:target-linked-effect',
      duration: { type: 'concentration', sourceActorId: caster.id, remainingRounds: 1 },
    })]
    const otherTurn = startDnd5eHeadlessCombat('true-strike-other-source', [other, otherTarget])
    const otherAttack = resolveDnd5eHeadlessAction(otherTurn, {
      type: 'attack', actorId: other.id, targetId: otherTarget.id, attackModifier: 0,
      d20: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [] },
    })
    expect(otherAttack.ok, otherAttack.ok ? undefined : otherAttack.reason).toBe(true)
    if (!otherAttack.ok) return
    expect(otherAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', d20: 2, hit: false,
    }))
  })

  it('consumes audited roll and damage rule states in real checks and attacks', () => {
    const glib = fighter('glib', 30)
    glib.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:glibness', label: 'Glibness',
      source: { kind: 'spell', actorId: glib.id, rulesId: 'glibness', magical: true },
      targetId: glib.id,
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      modifiers: { minimumAbilityCheckD20ByAbility: { cha: 15 } },
    })]
    const glibnessCheck = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('glibness-minimum', [glib, fighter('glib-observer', 10)]),
      { type: 'ability-check', actorId: glib.id, ability: 'cha', skill: 'persuasion', d20: 2 },
    )
    expect(glibnessCheck.ok, glibnessCheck.ok ? undefined : glibnessCheck.reason).toBe(true)
    if (!glibnessCheck.ok) return
    expect(glibnessCheck.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', actorId: glib.id, d20: 15, total: 14,
    }))

    const stealthActor = fighter('stealth-actor', 30, { position: { x: 25, y: 0 } })
    const traceSource = fighter('trace-source', 20, { position: { x: 0, y: 0 } })
    traceSource.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:pass-without-trace', label: 'Pass without Trace',
      source: { kind: 'spell', actorId: traceSource.id, rulesId: 'pass-without-trace', magical: true },
      targetId: traceSource.id,
      duration: { type: 'concentration', sourceActorId: traceSource.id, concentrationId: 'pass-without-trace', remainingRounds: 60 },
      modifiers: {
        skillCheckBonusAuras: [{
          skill: 'stealth', bonus: 10, radiusFeet: 30, relation: 'ally-and-self',
          mundaneTracking: 'impossible', leavesTracks: false,
        }],
      },
    })]
    const traceState = startDnd5eHeadlessCombat('pass-without-trace', [stealthActor, traceSource])
    traceState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(stealthActor.id, traceSource.id)]: 25,
    }
    const stealth = resolveDnd5eHeadlessAction(
      traceState,
      { type: 'ability-check', actorId: stealthActor.id, ability: 'dex', skill: 'stealth', d20: 2 },
    )
    expect(stealth.ok).toBe(true)
    if (!stealth.ok) return
    expect(stealth.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', actorId: stealthActor.id, modifier: 12, total: 14,
    }))
    const hideInsideAura = resolveDnd5eHeadlessAction(
      traceState,
      { type: 'hide', actorId: stealthActor.id, d20: 10 },
    )
    expect(hideInsideAura.ok).toBe(true)
    if (!hideInsideAura.ok) return
    expect(hideInsideAura.events).toContainEqual(expect.objectContaining({
      type: 'hide-resolved', actorId: stealthActor.id, d20: 10, total: 22,
    }))
    expect(dnd5eTrackingCapabilityForCombatant(traceState, stealthActor.id)).toEqual({
      mundaneTrackingPossible: false,
      leavesTracks: false,
    })
    traceState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(stealthActor.id, traceSource.id)]: 35,
    }
    expect(dnd5eTrackingCapabilityForCombatant(traceState, stealthActor.id)).toEqual({
      mundaneTrackingPossible: true,
      leavesTracks: true,
    })
    const hideOutsideAura = resolveDnd5eHeadlessAction(
      traceState,
      { type: 'hide', actorId: stealthActor.id, d20: 10 },
    )
    expect(hideOutsideAura.ok).toBe(true)
    if (!hideOutsideAura.ok) return
    expect(hideOutsideAura.events).toContainEqual(expect.objectContaining({
      type: 'hide-resolved', actorId: stealthActor.id, d20: 10, total: 12,
    }))

    const enfeebled = fighter('enfeebled', 30)
    enfeebled.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:ray-of-enfeeblement', label: 'Ray of Enfeeblement',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'ray-of-enfeeblement', magical: true },
      targetId: enfeebled.id,
      duration: { type: 'concentration', sourceActorId: 'caster', concentrationId: 'ray-of-enfeeblement', remainingRounds: 10 },
      modifiers: { weaponDamageMultipliers: [{ multiplier: 0.5, ability: 'str' }] },
    })]
    const victim = fighter('ray-victim', 20)
    const enfeebledAttack = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('ray-of-enfeeblement', [enfeebled, victim]),
      {
        type: 'attack', actorId: enfeebled.id, targetId: victim.id, attackModifier: 5, d20: 18,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
        classDamageContext: meleeWeaponContext(),
      },
    )
    expect(enfeebledAttack.ok).toBe(true)
    if (!enfeebledAttack.ok) return
    expect(enfeebledAttack.state.combatants[victim.id].currentHp).toBe(16)

    const enfeebledCloudGiant = fighter('enfeebled-cloud-giant', 30, {
      controller: 'dm', statBlockId: 'srd-5.1:cloud-giant',
      currentHp: 200, maxHp: 200, usesDeathSaves: false,
    })
    enfeebledCloudGiant.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:ray-of-enfeeblement', label: 'Ray of Enfeeblement',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'ray-of-enfeeblement', magical: true },
      targetId: enfeebledCloudGiant.id,
      duration: { type: 'concentration', sourceActorId: 'caster', concentrationId: 'ray-of-enfeeblement', remainingRounds: 10 },
      modifiers: { weaponDamageMultipliers: [{ multiplier: 0.5, ability: 'str' }] },
    })]
    const giantVictim = fighter('giant-ray-victim', 10, {
      armorClass: 15, currentHp: 100, maxHp: 100,
    })
    const enfeebledMonsterAttack = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('ray-of-enfeeblement-monster', [enfeebledCloudGiant, giantVictim]),
      {
        type: 'monster-action', actorId: enfeebledCloudGiant.id, actionId: 'rock',
        rolls: [{ targetId: giantVictim.id, d20: 17, damageRolls: [[2, 9, 8, 1]] }],
      },
    )
    expect(
      enfeebledMonsterAttack.ok,
      enfeebledMonsterAttack.ok ? undefined : enfeebledMonsterAttack.reason,
    ).toBe(true)
    if (!enfeebledMonsterAttack.ok) return
    expect(enfeebledMonsterAttack.state.combatants[giantVictim.id].currentHp).toBe(86)
    expect(enfeebledMonsterAttack.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: enfeebledCloudGiant.id,
      targetId: giantVictim.id,
      stateKey: 'active-effect:weapon-damage-multiplier', active: true, value: 14,
    }))
  })

  it('applies conditional Active Effect resistance only to matching nonmagical damage', () => {
    const stoneEffect = (targetId: string) => createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:stoneskin', label: 'Stoneskin',
      source: { kind: 'spell', actorId: targetId, rulesId: 'stoneskin', magical: true },
      targetId,
      duration: { type: 'concentration', sourceActorId: targetId, concentrationId: 'stoneskin', remainingRounds: 600 },
      modifiers: {
        conditionalDamageResistances: [{
          damageTypes: ['bludgeoning', 'piercing', 'slashing'],
          sourceMagical: false,
        }],
      },
    })
    const mundaneAttacker = fighter('mundane-attacker', 30)
    const mundaneTarget = fighter('mundane-target', 20)
    mundaneTarget.classState.activeEffects = [stoneEffect(mundaneTarget.id)]
    const mundane = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('stoneskin-mundane', [mundaneAttacker, mundaneTarget]),
      {
        type: 'attack', actorId: mundaneAttacker.id, targetId: mundaneTarget.id,
        attackModifier: 10, d20: 15,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'slashing' },
      },
    )
    expect(mundane.ok, mundane.ok ? undefined : mundane.reason).toBe(true)
    if (!mundane.ok) return
    expect(mundane.state.combatants[mundaneTarget.id].currentHp).toBe(16)
    expect(mundane.events).toContainEqual(expect.objectContaining({
      type: 'damage-defense-resolved', damageBefore: 8, damageAfter: 4,
    }))

    const magicAttacker = fighter('magic-attacker', 30)
    magicAttacker.weaponDamageSources = { magic: { magical: true } }
    const magicTarget = fighter('magic-target', 20)
    magicTarget.classState.activeEffects = [stoneEffect(magicTarget.id)]
    const magical = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('stoneskin-magical', [magicAttacker, magicTarget]),
      {
        type: 'attack', actorId: magicAttacker.id, targetId: magicTarget.id,
        attackModifier: 10, d20: 15,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'slashing' },
        classDamageContext: { ...meleeWeaponContext('magic') },
        classDamageRolls: [],
      },
    )
    expect(magical.ok, magical.ok ? undefined : magical.reason).toBe(true)
    if (!magical.ok) return
    expect(magical.state.combatants[magicTarget.id].currentHp).toBe(12)
  })

  it('uses native Active Effect advantage for death saving throws', () => {
    const dying = fighter('beacon-target', 30, { currentHp: 0 })
    dying.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:beacon-of-hope', label: 'Beacon of Hope',
      source: { kind: 'spell', actorId: 'cleric', rulesId: 'beacon-of-hope', magical: true },
      targetId: dying.id,
      duration: { type: 'concentration', sourceActorId: 'cleric', concentrationId: 'beacon-of-hope', remainingRounds: 10 },
      modifiers: { deathSavingThrowAdvantage: true, maximizeHealingDice: true },
    })]
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('beacon-death-save', [dying, fighter('observer', 20)]),
      { type: 'death-save', actorId: dying.id, d20: 2, d20Second: 15 },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[dying.id].deathSaves.successes).toBe(1)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'death-save-resolved', actorId: dying.id, d20: 15,
    }))
  })

  it('uses native Foresight defenses for incoming attacks and surprise', () => {
    const attacker = fighter('foresight-attacker', 30)
    const target = fighter('foresight-target', 20)
    target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:foresight', label: 'Foresight',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'foresight', magical: true },
      targetId: target.id,
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      modifiers: {
        attacksAgainstTargetDisadvantage: true,
        cannotBeSurprisedWhileConscious: true,
      },
    })]
    target.classState.surprisedCombatId = 'foresight-combat'
    expect(dnd5eCombatantIsSurprised(target, 'foresight-combat')).toBe(false)
    expect(dnd5eMonsterSpellAttackMode(
      startDnd5eHeadlessCombat('foresight-spell-defense', [attacker, target]),
      attacker.id,
      target.id,
      'ranged',
    )).toBe('disadvantage')

    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('foresight-attack', [attacker, target]),
      {
        type: 'attack', actorId: attacker.id, targetId: target.id,
        attackModifier: 0, d20: 18, d20Second: 2,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [], type: 'slashing' },
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', d20: 2, hit: false,
    }))
  })

  it('uses native Foresight advantage for Activity spell attacks', () => {
    const attacker = fighter('foresight-spell-attacker', 30)
    const target = fighter('foresight-spell-target', 20)
    attacker.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:foresight', label: 'Foresight',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'foresight', magical: true },
      targetId: attacker.id,
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      modifiers: { attackRollAdvantage: true },
    })]

    expect(dnd5eMonsterSpellAttackMode(
      startDnd5eHeadlessCombat('foresight-spell-attack', [attacker, target]),
      attacker.id,
      target.id,
      'ranged',
    )).toBe('advantage')
  })

  it('uses Holy Aura as target-side save advantage and attack disadvantage', () => {
    const attacker = fighter('holy-aura-attacker', 30)
    const protectedTarget = fighter('holy-aura-target', 20)
    protectedTarget.classState.activeEffects = [spellRuleStateEffect({
      spellId: 'holy-aura', family: 'roll-mode-modifier',
      sourceActorId: 'cleric', targetId: protectedTarget.id,
    })]
    protectedTarget.classState.activeEffects[0]!.modifiers = {
      attacksAgainstTargetDisadvantage: true,
    }
    const attack = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('holy-aura-target-defense', [attacker, protectedTarget]),
      {
        type: 'attack', actorId: attacker.id, targetId: protectedTarget.id,
        attackModifier: 0, d20: 18, d20Second: 2,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [] },
      },
    )
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', d20: 2, hit: false,
    }))
  })

  it('uses directional map visibility for unseen attacker advantage', () => {
    const state = startDnd5eHeadlessCombat('directional-visibility', [fighter('a', 20), fighter('b', 10)])
    state.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0,
      d20: 2, d20Second: 18,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
  })

  it('cancels unseen attacker advantage when neither side can see the other', () => {
    const state = startDnd5eHeadlessCombat('mutual-darkness', [fighter('a', 20), fighter('b', 10)])
    state.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('a', 'b')]: true,
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0,
      d20: 2, d20Second: 18,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('removes attack advantage against a conscious level-18 Rogue with Elusive', () => {
    const rogue = fighter('b', 10, { classId: 'rogue', level: 18 })
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), rogue])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5,
      mode: 'advantage', d20: 2, d20Second: 18,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.b.currentHp).toBe(20)
  })

  it('Dodge imposes disadvantage and opportunity attacks spend reactions', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('b', 20), fighter('a', 10)])
    const dodged = resolveDnd5eHeadlessAction(state, { type: 'dodge', actorId: 'b' })
    expect(dodged.ok).toBe(true)
    if (!dodged.ok) return
    const ended = resolveDnd5eHeadlessAction(dodged.state, { type: 'end-turn', actorId: 'b' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const attack = resolveDnd5eHeadlessAction(ended.state, { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5, d20: 18, d20Second: 2, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.b.currentHp).toBe(20)
    const reaction = resolveDnd5eHeadlessAction(attack.state, { type: 'opportunity-attack', actorId: 'b', targetId: 'a', attackModifier: 5, d20: 15, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(reaction.ok).toBe(true)
    if (!reaction.ok) return
    expect(reaction.state.combatants.b.turn.reactionAvailable).toBe(false)
  })

  it('expires the persisted Dodge marker when the dodging creature starts its next turn', () => {
    const state = startDnd5eHeadlessCombat('dodge-expiry', [
      fighter('b', 20), fighter('a', 10, { controller: 'dm' }),
    ])
    const dodged = resolveDnd5eHeadlessAction(state, { type: 'dodge', actorId: 'b' })
    expect(dodged.ok).toBe(true)
    if (!dodged.ok) return
    expect(dodged.state.combatants.b.classState.dodgingTurnKey).toBe('dodge-expiry:1:b')

    const firstEnd = resolveDnd5eHeadlessAction(dodged.state, { type: 'end-turn', actorId: 'b' })
    expect(firstEnd.ok).toBe(true)
    if (!firstEnd.ok) return
    expect(firstEnd.state.combatants.b.classState.dodgingTurnKey).toBe('dodge-expiry:1:b')

    const secondEnd = resolveDnd5eHeadlessAction(firstEnd.state, { type: 'end-turn', actorId: 'a' })
    expect(secondEnd.ok).toBe(true)
    if (!secondEnd.ok) return
    expect(secondEnd.state.initiativeOrder[secondEnd.state.initiativeIndex]).toBe('b')
    expect(secondEnd.state.combatants.b.classState.dodgingTurnKey).toBeUndefined()
    expect(secondEnd.state.combatants.b.dodging).toBe(false)
  })

  it('resolves Dash, Hide, Ready, and Use an Object as authoritative basic actions', () => {
    const hiddenState = startDnd5eHeadlessCombat('basic-hide', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    hiddenState.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    const hidden = resolveDnd5eHeadlessAction(hiddenState, { type: 'hide', actorId: 'a', d20: 15 })
    expect(hidden.ok).toBe(true)
    if (!hidden.ok) return
    expect(hidden.state.combatants.a.classState.hiddenCheckTotal).toBe(17)

    const noticedState = startDnd5eHeadlessCombat('basic-hide-failed', [
      fighter('a', 20),
      fighter('b', 10, { controller: 'dm', passivePerception: 15 }),
    ])
    noticedState.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    const noticed = resolveDnd5eHeadlessAction(noticedState, { type: 'hide', actorId: 'a', d20: 1 })
    expect(noticed.ok).toBe(true)
    if (!noticed.ok) return
    expect(noticed.state.combatants.a.classState.hiddenCheckTotal).toBeUndefined()
    expect(noticed.state.combatants.a.turn.actionAvailable).toBe(false)

    const readyState = startDnd5eHeadlessCombat('basic-ready', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    const readied = resolveDnd5eHeadlessAction(readyState, {
      type: 'ready', actorId: 'a', trigger: '敌人进入门口时', actionKind: 'attack', targetId: 'b',
    })
    expect(readied.ok).toBe(true)
    if (!readied.ok) return
    const ended = resolveDnd5eHeadlessAction(readied.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const triggered = resolveDnd5eHeadlessAction(ended.state, { type: 'trigger-readied-action', actorId: 'a' })
    expect(triggered.ok).toBe(true)
    if (!triggered.ok) return
    expect(triggered.state.combatants.a.turn.reactionAvailable).toBe(false)
    expect(triggered.events).toContainEqual(expect.objectContaining({ type: 'readied-action-triggered', actionKind: 'attack' }))

    const objectState = startDnd5eHeadlessCombat('basic-object', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    const used = resolveDnd5eHeadlessAction(objectState, { type: 'use-object', actorId: 'a', interactionId: 'drink:potion' })
    expect(used.ok).toBe(true)
    if (!used.ok) return
    expect(used.events).toContainEqual({ type: 'object-action-taken', actorId: 'a', action: 'use-object', interactionId: 'drink:potion' })
  })

  it('grants and consumes Help advantage for an ally ability check and attack', () => {
    const helper = fighter('helper', 20)
    const ally = fighter('ally', 15)
    const enemy = fighter('enemy', 10, { controller: 'dm', armorClass: 16 })
    const abilityHelp = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('help-check', [helper, ally, enemy]),
      { type: 'help', actorId: 'helper', targetId: 'ally', helpKind: 'ability-check' },
    )
    expect(abilityHelp.ok).toBe(true)
    if (!abilityHelp.ok) return
    const helperEnded = resolveDnd5eHeadlessAction(abilityHelp.state, { type: 'end-turn', actorId: 'helper' })
    expect(helperEnded.ok).toBe(true)
    if (!helperEnded.ok) return
    const check = resolveDnd5eHeadlessAction(helperEnded.state, {
      type: 'ability-check', actorId: 'ally', ability: 'str', d20: 2, d20Second: 18,
    })
    expect(check.ok).toBe(true)
    if (!check.ok) return
    expect(check.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', d20: 18, mode: 'advantage' }))
    expect(check.state.combatants.ally.classState.helpedAbilityCheckSourceId).toBeUndefined()

    const attackHelpState = startDnd5eHeadlessCombat('help-attack', [helper, ally, enemy])
    attackHelpState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('helper', 'enemy')]: 5,
    }
    const attackHelp = resolveDnd5eHeadlessAction(attackHelpState, {
      type: 'help', actorId: 'helper', targetId: 'enemy', helpKind: 'attack',
    })
    expect(attackHelp.ok).toBe(true)
    if (!attackHelp.ok) return
    const afterHelp = resolveDnd5eHeadlessAction(attackHelp.state, { type: 'end-turn', actorId: 'helper' })
    expect(afterHelp.ok).toBe(true)
    if (!afterHelp.ok) return
    const attack = resolveDnd5eHeadlessAction(afterHelp.state, {
      type: 'attack', actorId: 'ally', targetId: 'enemy', attackModifier: 0,
      d20: 2, d20Second: 18, damage: { count: 1, sides: 4, bonus: 0, rolls: [2] },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
    expect(attack.state.combatants.enemy.classState.helpedAttackSourceId).toBeUndefined()
  })

  it('resolves grapple and shove through opposed Athletics checks', () => {
    const state = startDnd5eHeadlessCombat('contests', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const grappled = resolveDnd5eHeadlessAction(state, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 18, targetD20: 2, targetDefense: 'athletics',
    })
    expect(grappled.ok).toBe(true)
    if (!grappled.ok) return
    expect(grappled.state.combatants.b.conditions).toContain('grappled')
    expect(grappled.events).toContainEqual(expect.objectContaining({ type: 'contest-resolved', contest: 'grapple', success: true }))

    grappled.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 10 }
    const separated = resolveDnd5eHeadlessAction(grappled.state, { type: 'end-turn', actorId: 'a' })
    expect(separated.ok).toBe(true)
    if (!separated.ok) return
    expect(separated.state.combatants.b.conditions).not.toContain('grappled')
    expect(separated.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', reason: 'out-of-range', targetId: 'b',
    }))

    const incapacitatedState = startDnd5eHeadlessCombat('grapple-incapacitated', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    incapacitatedState.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const held = resolveDnd5eHeadlessAction(incapacitatedState, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 18, targetD20: 2, targetDefense: 'athletics',
    })
    expect(held.ok).toBe(true)
    if (!held.ok) return
    held.state.combatants.a.currentHp = 0
    const incapacitated = resolveDnd5eHeadlessAction(held.state, { type: 'end-turn', actorId: 'a' })
    expect(incapacitated.ok).toBe(true)
    if (!incapacitated.ok) return
    expect(incapacitated.state.combatants.b.conditions).not.toContain('grappled')
    expect(incapacitated.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', reason: 'source-incapacitated', targetId: 'b',
    }))

    const shoveState = startDnd5eHeadlessCombat('shove', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    shoveState.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const shoved = resolveDnd5eHeadlessAction(shoveState, {
      type: 'shove', actorId: 'a', targetId: 'b', actorD20: 18, targetD20: 2,
      targetDefense: 'acrobatics', outcome: 'prone',
    })
    expect(shoved.ok).toBe(true)
    if (!shoved.ok) return
    expect(shoved.state.combatants.b.conditions).toContain('prone')
  })

  it('uses the defender stronger Athletics or Acrobatics modifier for grapple and shove', () => {
    const defender = fighter('b', 10, {
      controller: 'dm',
      abilities: { ...abilities, str: 8, dex: 18 },
      skillProficiencies: ['acrobatics'],
    })
    const state = startDnd5eHeadlessCombat('stronger-defense', [fighter('a', 20), defender])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const grappled = resolveDnd5eHeadlessAction(state, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 10, targetD20: 10,
      targetDefense: 'athletics',
    })
    expect(grappled.ok).toBe(true)
    if (!grappled.ok) return
    expect(grappled.events).toContainEqual(expect.objectContaining({
      type: 'contest-resolved', targetDefense: 'acrobatics', actorTotal: 13, targetTotal: 16, success: false,
    }))
    expect(grappled.state.combatants.b.conditions).not.toContain('grappled')
  })

  it('rejects grapple and shove targets more than one size larger than the actor', () => {
    const oversized = startDnd5eHeadlessCombat('size-limit', [
      fighter('a', 20, { sizeRank: 2 }),
      fighter('b', 10, { controller: 'dm', sizeRank: 4 }),
    ])
    oversized.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    expect(resolveDnd5eHeadlessAction(oversized, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics',
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const legal = startDnd5eHeadlessCombat('size-limit-legal', [
      fighter('a', 20, { sizeRank: 2 }),
      fighter('b', 10, { controller: 'dm', sizeRank: 3 }),
    ])
    legal.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    expect(resolveDnd5eHeadlessAction(legal, {
      type: 'shove', actorId: 'a', targetId: 'b', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics', outcome: 'prone',
    })).toMatchObject({ ok: true })
  })

  it('rejects grapple and shove through total cover even at five-foot grid distance', () => {
    const state = startDnd5eHeadlessCombat('blocked-contest', [
      fighter('a', 20),
      fighter('b', 10, { controller: 'dm' }),
    ])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    state.lineOfEffectBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('a', 'b')]: true,
    }
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'grapple',
      actorId: 'a',
      targetId: 'b',
      actorD20: 20,
      targetD20: 1,
      targetDefense: 'athletics',
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'shove',
      actorId: 'a',
      targetId: 'b',
      actorD20: 20,
      targetD20: 1,
      targetDefense: 'athletics',
      outcome: 'prone',
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('lets a grappled creature spend its action to escape the grappler contest', () => {
    const state = startDnd5eHeadlessCombat('escape-grapple', [
      fighter('a', 20), fighter('b', 10, { controller: 'dm' }),
    ])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const grappled = resolveDnd5eHeadlessAction(state, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics',
    })
    expect(grappled.ok).toBe(true)
    if (!grappled.ok) return
    const nextTurn = resolveDnd5eHeadlessAction(grappled.state, { type: 'end-turn', actorId: 'a' })
    expect(nextTurn.ok).toBe(true)
    if (!nextTurn.ok) return
    const escaped = resolveDnd5eHeadlessAction(nextTurn.state, {
      type: 'escape-grapple', actorId: 'b', grapplerId: 'a', actorD20: 20, targetD20: 1,
    })
    expect(escaped.ok).toBe(true)
    if (!escaped.ok) return
    expect(escaped.events).toContainEqual(expect.objectContaining({
      type: 'contest-resolved', contest: 'escape-grapple', success: true,
    }))
    expect(escaped.state.combatants.b.conditions).not.toContain('grappled')
    expect(escaped.state.combatants.b.turn.actionAvailable).toBe(false)
  })

  it('limits basic grapples by free hands and lets the grappler release one without an action', () => {
    const actor = fighter('a', 20, { grappleFreeHandCapacity: 1 })
    const state = startDnd5eHeadlessCombat('grapple-capacity', [
      actor,
      fighter('b', 10, { controller: 'dm' }),
      fighter('c', 5, { controller: 'dm' }),
    ])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('a', 'b')]: 5,
      [dnd5eCombatantPairKey('a', 'c')]: 5,
    }
    const first = resolveDnd5eHeadlessAction(state, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics', spendAction: false,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(resolveDnd5eHeadlessAction(first.state, {
      type: 'grapple', actorId: 'a', targetId: 'c', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics', spendAction: false,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const released = resolveDnd5eHeadlessAction(first.state, {
      type: 'release-grapple', actorId: 'a', targetId: 'b',
    })
    expect(released.ok).toBe(true)
    if (!released.ok) return
    expect(released.state.combatants.b.conditions).not.toContain('grappled')
    expect(released.state.combatants.a.turn.actionAvailable).toBe(true)
    expect(released.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: 'b',
      reason: 'released',
    }))
    expect(resolveDnd5eHeadlessAction(released.state, {
      type: 'grapple', actorId: 'a', targetId: 'c', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics', spendAction: false,
    })).toMatchObject({ ok: true })
  })

  it('reconciles persisted basic grapples against the grappler current free hands', () => {
    const state = startDnd5eHeadlessCombat('persisted-basic-grapple-capacity', [
      fighter('a', 20, { grappleFreeHandCapacity: 1 }),
      fighter('b', 10, { controller: 'dm' }),
      fighter('c', 5, { controller: 'dm' }),
    ])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('a', 'b')]: 5,
      [dnd5eCombatantPairKey('a', 'c')]: 5,
    }
    const first = resolveDnd5eHeadlessAction(state, {
      type: 'grapple',
      actorId: 'a',
      targetId: 'b',
      actorD20: 20,
      targetD20: 1,
      targetDefense: 'athletics',
      spendAction: false,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const persistedGrapple = first.state.combatants.b.classState.activeEffects?.find(
      (effect) => effect.source.rulesId === 'basic-action:grapple',
    )
    expect(persistedGrapple).toBeDefined()
    if (!persistedGrapple) return
    const persistedDuplicate = structuredClone(persistedGrapple)
    persistedDuplicate.id = 'zz-persisted-extra-grapple'
    first.state.combatants.c.classState.activeEffects = [persistedDuplicate]
    first.state.combatants.c.conditions =
      dnd5eConditionsFromActiveEffects([persistedDuplicate])

    const capacityCleaned = resolveDnd5eHeadlessAction(first.state, {
      type: 'end-turn',
      actorId: 'a',
    })
    expect(capacityCleaned.ok).toBe(true)
    if (!capacityCleaned.ok) return
    expect(capacityCleaned.state.combatants.b.conditions).toContain('grappled')
    expect(capacityCleaned.state.combatants.c.conditions).not.toContain('grappled')
    expect(capacityCleaned.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: 'c',
      effectId: 'zz-persisted-extra-grapple',
      reason: 'invalid-relation',
    }))

    capacityCleaned.state.combatants.a.grappleFreeHandCapacity = 0
    const noFreeHands = resolveDnd5eHeadlessAction(capacityCleaned.state, {
      type: 'end-turn',
      actorId: 'b',
    })
    expect(noFreeHands.ok).toBe(true)
    if (!noFreeHands.ok) return
    expect(noFreeHands.state.combatants.b.conditions).not.toContain('grappled')
  })

  it('rejects an opportunity attack when the reactor cannot see the moving target', () => {
    const state = startDnd5eHeadlessCombat('blocked-opportunity', [fighter('a', 20), fighter('b', 10)])
    state.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', actorId: 'b', targetId: 'a', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('restores a persisted Dodge marker and keeps the target defended until its next turn', () => {
    const defender = fighter('b', 10, { classState: { dodgingTurnKey: 'combat:1:b' } })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('combat', [fighter('a', 20), defender]),
      {
        type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5,
        d20: 18, d20Second: 2,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.b.currentHp).toBe(20)
  })

  it('authoritatively validates Protection and spends the shield bearer reaction', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const protector = fighter('protector', 10, {
      hasShield: true,
      classSelections: { 'fighting-style': ['protection'] },
    })
    const target = fighter('ally', 5)
    const state = startDnd5eHeadlessCombat('protection', [attacker, protector, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'ally', attackModifier: 5,
      protectionReactionActorId: 'protector', mode: 'normal', d20: 18, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'protector', resource: 'reaction' })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)

    const invalidState = startDnd5eHeadlessCombat('invalid-protection', [attacker, fighter('no-shield', 10, {
      classSelections: { 'fighting-style': ['protection'] },
    }), target])
    expect(resolveDnd5eHeadlessAction(invalidState, {
      type: 'attack', actorId: 'enemy', targetId: 'ally', attackModifier: 5,
      protectionReactionActorId: 'no-shield', mode: 'normal', d20: 18, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('lets Protection cancel an existing advantage instead of turning it into disadvantage twice', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const protector = fighter('protector', 10, {
      hasShield: true,
      classSelections: { 'fighting-style': ['protection'] },
    })
    const target = fighter('ally', 5)
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('protection-cancels-advantage', [attacker, protector, target]),
      {
        type: 'attack', actorId: 'enemy', targetId: 'ally', attackModifier: 5,
        protectionReactionActorId: 'protector', mode: 'advantage', d20: 2, d20Second: 18,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('applies Protection to spell attack rolls as well as weapon attacks', () => {
    const caster = fighter('wizard', 20, {
      controller: 'dm', classId: 'wizard', level: 5,
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
      abilities: { ...abilities, int: 16 },
    })
    const protector = fighter('protector', 10, {
      hasShield: true, classSelections: { 'fighting-style': ['protection'] },
    })
    const target = fighter('ally', 5)
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('spell-protection', [caster, protector, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'ally', spellId: 'fire-bolt', slotLevel: 0,
      protectionReactionActorId: 'protector', mode: 'normal', d20: 18, d20Second: 2, effectRolls: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'protector', resource: 'reaction' })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('authoritatively applies Hunter Escape the Horde to opportunity attacks', () => {
    const hunter = fighter('hunter', 10, {
      classId: 'ranger', subclassId: 'hunter', level: 7,
      classSelections: { 'defensive-tactics': ['escape-the-horde'] },
    })
    const state = startDnd5eHeadlessCombat('escape-the-horde', [fighter('enemy', 20), hunter])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', actorId: 'enemy', targetId: 'hunter', attackModifier: 5,
      d20: 20, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.hunter.currentHp).toBe(20)
  })

  it('authoritatively validates the Berserker Retaliation reaction feature', () => {
    const berserker = fighter('berserker', 10, {
      classId: 'barbarian', subclassId: 'berserker', level: 14,
      position: { x: 5, y: 0 },
    })
    const enemy = fighter('enemy', 20, {
      controller: 'dm',
      position: { x: 0, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('retaliation', [enemy, berserker])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('enemy', 'berserker')]: 5,
    }
    const damaged = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'berserker', attackModifier: 5, d20: 15,
      classDamageContext: meleeWeaponContext(),
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.berserker.classState.berserkerRetaliationTrigger).toEqual({
      sourceId: 'enemy',
      round: 1,
    })

    const result = resolveDnd5eHeadlessAction(damaged.state, {
      type: 'opportunity-attack', reactionFeature: 'berserker-retaliation',
      actorId: 'berserker', targetId: 'enemy', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.berserker.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.berserker.classState.berserkerRetaliationTrigger).toBeUndefined()
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'berserker', targetId: 'enemy', amount: 8,
    }))

    const forged = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('forged-retaliation', [enemy, berserker]),
      {
        type: 'opportunity-attack', reactionFeature: 'berserker-retaliation',
        actorId: 'berserker', targetId: 'enemy', attackModifier: 5, d20: 15,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
      },
    )
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('authoritatively validates the Hunter Giant Killer reaction feature', () => {
    const hunter = fighter('hunter', 20, {
      classId: 'ranger', subclassId: 'hunter', level: 3,
      classSelections: { 'hunters-prey': ['giant-killer'] },
    })
    const state = startDnd5eHeadlessCombat('giant-killer', [hunter, fighter('giant', 10, { controller: 'dm' })])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', reactionFeature: 'hunter-giant-killer',
      actorId: 'hunter', targetId: 'giant', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.giant.currentHp).toBe(12)

    const invalid = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('invalid-giant-killer', [
      fighter('hunter', 20, { classId: 'ranger', subclassId: 'hunter', level: 3 }),
      fighter('giant', 10, { controller: 'dm' }),
    ]), {
      type: 'opportunity-attack', reactionFeature: 'hunter-giant-killer',
      actorId: 'hunter', targetId: 'giant', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('resolves Hunter Stand Against the Tide as an atomic repeated melee attack', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm' })
    const hunter = fighter('hunter', 10, {
      classId: 'ranger', subclassId: 'hunter', level: 15,
      classSelections: { 'superior-hunters-defense': ['stand-against-tide'] },
      classState: { hideInPlainSightPrepared: true },
    })
    const redirectedTarget = fighter('redirected', 5, { controller: 'dm', armorClass: 12 })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('stand-against-tide', [attacker, hunter, redirectedTarget]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'hunter', attackModifier: 5, d20: 2,
        classDamageContext: {
          mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
          damageType: 'slashing', adjacentEnemyOfTarget: false,
        },
        damage: { count: 1, sides: 8, bonus: 3, rolls: [], type: 'slashing' },
        standAgainstTide: {
          targetId: 'redirected', distanceFeet: 5, d20: 10,
          damageRolls: [[6]],
        },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hunter.currentHp).toBe(20)
    expect(result.state.combatants.redirected.currentHp).toBe(11)
    expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.hunter.classState.hideInPlainSightPrepared).toBeUndefined()
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toEqual([
      expect.objectContaining({ actorId: 'attacker', targetId: 'hunter', hit: false }),
      expect.objectContaining({ actorId: 'attacker', targetId: 'redirected', hit: true }),
    ])
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'hunter', targetId: 'redirected',
      stateKey: 'stand-against-tide', active: true,
    }))
  })

  it('resolves Berserker Intimidating Presence, frightened penalties, and 24-hour immunity', () => {
    const berserker = fighter('berserker', 20, {
      classId: 'barbarian', subclassId: 'berserker', level: 10,
      abilities: { ...abilities, cha: 14 }, position: { x: 0, y: 0 },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm', position: { x: 10, y: 0 }, savingThrowBonuses: { wis: 0 },
    })
    const state = startDnd5eHeadlessCombat('intimidating-presence', [berserker, enemy, fighter('victim', 5)])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('berserker', 'enemy')]: 10,
      [dnd5eCombatantPairKey('enemy', 'victim')]: 10,
    }
    const frightened = resolveDnd5eHeadlessAction(state, {
      type: 'barbarian-intimidating-presence', actorId: 'berserker', targetId: 'enemy', savingThrowD20: 2,
    })
    expect(frightened.ok).toBe(true)
    if (!frightened.ok) return
    expect(frightened.state.combatants.enemy.conditions).toContain('frightened')
    expect(frightened.state.combatants.enemy.classState).toMatchObject({
      intimidatingPresenceSourceId: 'berserker', intimidatingPresenceRoundsRemaining: 2,
    })

    const barbarianEnded = resolveDnd5eHeadlessAction(frightened.state, { type: 'end-turn', actorId: 'berserker' })
    expect(barbarianEnded.ok).toBe(true)
    if (!barbarianEnded.ok) return
    expect(barbarianEnded.state.combatants.enemy.classState.intimidatingPresenceRoundsRemaining).toBe(1)
    const cannotApproach = resolveDnd5eHeadlessAction(barbarianEnded.state, {
      type: 'move', actorId: 'enemy', to: { x: 5, y: 0 }, distance: 5,
    })
    expect(cannotApproach).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const disadvantagedAttack = resolveDnd5eHeadlessAction(barbarianEnded.state, {
      type: 'attack', actorId: 'enemy', targetId: 'berserker', attackModifier: 5,
      d20: 18, d20Second: 2, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(disadvantagedAttack.ok).toBe(true)
    if (!disadvantagedAttack.ok) return
    expect(disadvantagedAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'enemy', d20: 2, hit: false,
    }))

    const sourceHidden = structuredClone(barbarianEnded.state)
    sourceHidden.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('enemy', 'berserker')]: true,
    }
    const unobstructedAttack = resolveDnd5eHeadlessAction(sourceHidden, {
      type: 'attack', actorId: 'enemy', targetId: 'victim', attackModifier: 5,
      d20: 18, d20Second: 2, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(unobstructedAttack.ok).toBe(true)
    if (!unobstructedAttack.ok) return
    expect(unobstructedAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'enemy', d20: 18, hit: true,
    }))

    const immunityState = startDnd5eHeadlessCombat('intimidating-immunity', [berserker, enemy])
    immunityState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('berserker', 'enemy')]: 10,
    }
    const immune = resolveDnd5eHeadlessAction(
      immunityState,
      { type: 'barbarian-intimidating-presence', actorId: 'berserker', targetId: 'enemy', savingThrowD20: 20 },
    )
    expect(immune.ok).toBe(true)
    if (!immune.ok) return
    expect(immune.state.combatants.enemy.classState.intimidatingPresenceImmunityRoundsBySource?.berserker).toBe(14_400)
    expect(immune.state.combatants.enemy.conditions).not.toContain('frightened')
  })

  it('enforces Intimidating Presence range and line of sight, then ends only its own fear effect', () => {
    const berserker = fighter('berserker', 20, {
      classId: 'barbarian', subclassId: 'berserker', level: 10,
      abilities: { ...abilities, cha: 14 },
    })
    const otherFear = createDnd5eConditionEffect({
      id: 'other-fear',
      condition: 'frightened',
      source: { kind: 'feature', actorId: 'dragon', rulesId: 'frightful-presence' },
      targetId: 'enemy',
      duration: { type: 'permanent' },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm',
      savingThrowBonuses: { wis: 0 },
      classState: { activeEffects: [otherFear] },
    })

    const tooFar = startDnd5eHeadlessCombat('intimidating-too-far', [berserker, enemy])
    tooFar.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('berserker', 'enemy')]: 35,
    }
    expect(resolveDnd5eHeadlessAction(tooFar, {
      type: 'barbarian-intimidating-presence',
      actorId: 'berserker',
      targetId: 'enemy',
      savingThrowD20: 2,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const blocked = startDnd5eHeadlessCombat('intimidating-blocked', [berserker, enemy])
    blocked.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('berserker', 'enemy')]: 10,
    }
    blocked.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('berserker', 'enemy')]: true,
    }
    expect(resolveDnd5eHeadlessAction(blocked, {
      type: 'barbarian-intimidating-presence',
      actorId: 'berserker',
      targetId: 'enemy',
      savingThrowD20: 2,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const state = startDnd5eHeadlessCombat('intimidating-precise-cleanup', [berserker, enemy])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('berserker', 'enemy')]: 10,
    }
    const frightened = resolveDnd5eHeadlessAction(state, {
      type: 'barbarian-intimidating-presence',
      actorId: 'berserker',
      targetId: 'enemy',
      savingThrowD20: 2,
    })
    expect(frightened.ok).toBe(true)
    if (!frightened.ok) return
    expect(frightened.state.combatants.enemy.classState.activeEffects).toHaveLength(2)

    frightened.state.initiativeIndex = frightened.state.initiativeOrder.indexOf('enemy')
    frightened.state.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('enemy', 'berserker')]: true,
    }
    const ended = resolveDnd5eHeadlessAction(frightened.state, {
      type: 'end-turn',
      actorId: 'enemy',
    })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.enemy.classState.intimidatingPresenceSourceId).toBeUndefined()
    expect(ended.state.combatants.enemy.conditions).toContain('frightened')
    expect(ended.state.combatants.enemy.classState.activeEffects).toEqual([
      expect.objectContaining({ id: 'other-fear' }),
    ])
    expect(ended.events).not.toContainEqual({
      type: 'condition-ended',
      targetId: 'enemy',
      condition: 'frightened',
    })
  })

  it('spends the target reaction and halves one visible attack with Uncanny Dodge', () => {
    const rogue = fighter('rogue', 10, { classId: 'rogue', level: 5 })
    const state = startDnd5eHeadlessCombat('uncanny-dodge', [fighter('enemy', 20), rogue])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'rogue', attackModifier: 20, d20: 10,
      uncannyDodge: true,
      damage: { count: 1, sides: 8, bonus: 1, rolls: [8], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.rogue.currentHp).toBe(16)
    expect(result.state.combatants.rogue.turn.reactionAvailable).toBe(false)
    expect(result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'rogue', resource: 'reaction' })
  })

  it('applies attack-wide reductions before vulnerability and resistance', () => {
    const rogue = fighter('rogue', 10, {
      classId: 'rogue', level: 5, damageVulnerabilities: ['slashing'],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('damage-order', [fighter('enemy', 20), rogue]),
      {
        type: 'attack', actorId: 'enemy', targetId: 'rogue', attackModifier: 20, d20: 10,
        uncannyDodge: true,
        damage: { count: 1, sides: 8, bonus: 1, rolls: [8], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 9 damage -> Uncanny Dodge 4 -> vulnerability 8 (not vulnerability 18 -> Dodge 9).
    expect(result.state.combatants.rogue.currentHp).toBe(12)
  })

  it('applies resistance before vulnerability, including odd damage totals', () => {
    const target = fighter('target', 10, {
      damageResistances: ['slashing'], damageVulnerabilities: ['slashing'],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('resistance-before-vulnerability', [fighter('enemy', 20), target]),
      {
        type: 'attack', actorId: 'enemy', targetId: 'target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 3 点先因抗性减半向下取整为 1，再因易伤翻倍为 2。
    expect(result.state.combatants.target.currentHp).toBe(18)
  })

  it('uses only trusted player weapon metadata for nonsilvered weapon immunity', () => {
    const immunity = [{
      outcome: 'immune' as const,
      damageTypes: ['bludgeoning', 'piercing', 'slashing'] as const,
      delivery: 'weapon-attack' as const,
      magical: false,
      weaponMaterialNot: 'silvered' as const,
      reason: 'lycanthrope-nonsilvered-immunity',
    }]
    const cases: readonly {
      label: string
      weaponId?: string
      source?: { magical: boolean; specialMaterial?: 'silvered' | 'adamantine' }
      expectedHp: number
    }[] = [
      { label: 'missing context', expectedHp: 20 },
      {
        label: 'ordinary weapon',
        weaponId: 'ordinary-sword',
        source: { magical: false },
        expectedHp: 20,
      },
      {
        label: 'silvered weapon',
        weaponId: 'silver-sword',
        source: { magical: false, specialMaterial: 'silvered' as const },
        expectedHp: 13,
      },
      {
        label: 'magic weapon',
        weaponId: 'magic-sword',
        source: { magical: true },
        expectedHp: 13,
      },
    ]
    for (const testCase of cases) {
      const externalSources = testCase.weaponId && testCase.source
        ? { [testCase.weaponId]: { ...testCase.source } }
        : undefined
      const attacker = fighter(`attacker-${testCase.label}`, 20, {
        weaponDamageSources: externalSources,
      })
      if (externalSources && testCase.weaponId) {
        const stored = attacker.weaponDamageSources?.[testCase.weaponId]
        expect(stored).not.toBe(externalSources[testCase.weaponId])
      }
      const target = fighter(`target-${testCase.label}`, 10, {
        controller: 'dm',
        damageDefenseRules: immunity,
      })
      const state = startDnd5eHeadlessCombat(`trusted-weapon-${testCase.label}`, [attacker, target])
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'attack',
        actorId: attacker.id,
        targetId: target.id,
        attackModifier: 20,
        d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [7], type: 'slashing' },
        ...(testCase.weaponId
          ? {
              classDamageContext: meleeWeaponContext(testCase.weaponId),
              classDamageRolls: [],
            }
          : {}),
      })
      expect(result.ok, testCase.label).toBe(true)
      if (!result.ok) continue
      expect(result.state.combatants[target.id].currentHp, testCase.label).toBe(testCase.expectedHp)
      expect(result.state.combatants[target.id].damageDefenseRules[0]).not.toBe(
        state.combatants[target.id].damageDefenseRules[0],
      )
    }
  })

  it('uses the monster magic-weapons snapshot for every monster weapon component', () => {
    const immunity = [{
      outcome: 'immune' as const,
      damageTypes: ['bludgeoning', 'piercing', 'slashing'] as const,
      delivery: 'weapon-attack' as const,
      magical: false,
      weaponMaterialNot: 'silvered' as const,
    }]
    for (const weaponAttacksMagical of [false, true]) {
      const wolf = fighter(`wolf-${weaponAttacksMagical}`, 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:wolf',
        usesDeathSaves: false,
        abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
        currentHp: 11,
        maxHp: 11,
        weaponAttacksMagical,
      })
      const target = fighter(`target-${weaponAttacksMagical}`, 10, {
        damageDefenseRules: immunity,
      })
      const result = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat(`monster-magic-weapon-${weaponAttacksMagical}`, [wolf, target]),
        {
          type: 'monster-action',
          actorId: wolf.id,
          actionId: 'bite',
          rolls: [{ targetId: target.id, d20: 12, damageRolls: [[2, 3]] }],
        },
      )
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.state.combatants[target.id].currentHp).toBe(
        weaponAttacksMagical ? 13 : 20,
      )
    }
  })

  it('applies good-aligned magic piercing vulnerability in real attacks', () => {
    const vulnerability = [{
      outcome: 'vulnerable' as const,
      damageTypes: ['piercing'] as const,
      delivery: 'weapon-attack' as const,
      magical: true,
      sourceMoralAlignment: 'good' as const,
      reason: 'rakshasa-good-magic-piercing',
    }]
    for (const [moralAlignment, expectedHp] of [['good', 12], ['neutral', 16]] as const) {
      const attacker = fighter(`attacker-${moralAlignment}`, 20, {
        moralAlignment,
        weaponDamageSources: { rapier: { magical: true } },
      })
      const target = fighter(`target-${moralAlignment}`, 10, {
        controller: 'dm',
        damageDefenseRules: vulnerability,
      })
      const result = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat(`rakshasa-${moralAlignment}`, [attacker, target]),
        {
          type: 'attack',
          actorId: attacker.id,
          targetId: target.id,
          attackModifier: 20,
          d20: 10,
          damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'piercing' },
          classDamageContext: {
            ...meleeWeaponContext('rapier'),
            finesse: true,
            damageType: 'piercing',
          },
          classDamageRolls: [],
        },
      )
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.state.combatants[target.id].currentHp).toBe(expectedHp)
    }
  })

  it('negates low-level player spell damage and control from the combatant snapshot after spending slots', () => {
    const limitedMagicImmunity = {
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    } as const
    const disintegrator = fighter('disintegrator', 20, {
      classId: 'wizard', level: 11, proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['disintegrate'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const rakshasaSnapshot = fighter('rakshasa-snapshot', 10, {
      controller: 'dm',
      currentHp: 200,
      maxHp: 200,
      limitedMagicImmunity,
    })
    const damageState = startDnd5eHeadlessCombat(
      'limited-magic-immunity-damage',
      [disintegrator, rakshasaSnapshot],
    )
    const damage = resolveDnd5eHeadlessAction(damageState, {
      type: 'cast-spell',
      actorId: disintegrator.id,
      targetId: rakshasaSnapshot.id,
      spellId: 'disintegrate',
      slotLevel: 6,
      savingThrowD20: 1,
      savingThrowD20Second: 20,
      effectRolls: Array(10).fill(6),
    })
    expect(damage.ok).toBe(true)
    if (!damage.ok) return
    expect(damage.state.combatants[rakshasaSnapshot.id].currentHp).toBe(200)
    expect(damage.state.combatants[disintegrator.id].classResources['dnd5e-spell-slot-6'].current)
      .toBe(0)
    expect(damage.state.combatants[rakshasaSnapshot.id].magicResistance).toBe(true)
    expect(damage.state.combatants[rakshasaSnapshot.id].limitedMagicImmunity)
      .not.toBe(damageState.combatants[rakshasaSnapshot.id].limitedMagicImmunity)
    expect(damage.events).toContainEqual({
      type: 'spell-negated-by-limited-magic-immunity',
      actorId: disintegrator.id,
      targetId: rakshasaSnapshot.id,
      spellId: 'disintegrate',
      spellLevel: 6,
    })
    expect(damage.events.some((event) =>
      event.type === 'saving-throw-resolved' && event.targetId === rakshasaSnapshot.id))
      .toBe(false)

    const controller = fighter('controller', 20, {
      classId: 'wizard', level: 9, proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['hold-monster'] },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const controlTarget = fighter('control-target', 10, {
      controller: 'dm',
      limitedMagicImmunity,
    })
    const control = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-control', [controller, controlTarget]),
      {
        type: 'cast-spell',
        actorId: controller.id,
        targetId: controlTarget.id,
        spellId: 'hold-monster',
        slotLevel: 5,
        savingThrowD20: 1,
        savingThrowD20Second: 2,
        effectRolls: [],
      },
    )
    expect(control.ok).toBe(true)
    if (!control.ok) return
    expect(control.state.combatants[controlTarget.id].conditions).not.toContain('paralyzed')
    expect(control.state.combatants[controller.id].classResources['dnd5e-spell-slot-5'].current)
      .toBe(0)
    expect(control.events).toContainEqual(expect.objectContaining({
      type: 'spell-negated-by-limited-magic-immunity',
      targetId: controlTarget.id,
      spellId: 'hold-monster',
    }))
  })

  it('filters a low-level area per target and suppresses its later persistent-area trigger', () => {
    const limitedMagicImmunity = {
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    } as const
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 5, proficiencyBonus: 3,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['fireball'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const immune = fighter('immune', 10, {
      controller: 'dm',
      currentHp: 100,
      maxHp: 100,
      limitedMagicImmunity,
    })
    const exposed = fighter('exposed', 5, {
      controller: 'dm',
      currentHp: 100,
      maxHp: 100,
    })
    const area = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-area', [wizard, immune, exposed]),
      {
        type: 'cast-spell',
        actorId: wizard.id,
        targetId: immune.id,
        targetIds: [immune.id, exposed.id],
        spellId: 'fireball',
        slotLevel: 3,
        targetSavingThrows: [
          { targetId: immune.id, d20: 1, d20Second: 20 },
          { targetId: exposed.id, d20: 1 },
        ],
        effectRolls: Array(8).fill(1),
      },
    )
    expect(area.ok).toBe(true)
    if (!area.ok) return
    expect(area.state.combatants[immune.id].currentHp).toBe(100)
    expect(area.state.combatants[exposed.id].currentHp).toBe(92)
    expect(area.state.combatants[wizard.id].classResources['dnd5e-spell-slot-3'].current).toBe(0)
    expect(area.events).toContainEqual(expect.objectContaining({
      type: 'spell-negated-by-limited-magic-immunity',
      targetId: immune.id,
      spellId: 'fireball',
    }))
    expect(area.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: exposed.id,
      success: false,
    }))
    expect(area.events.some((event) =>
      event.type === 'saving-throw-resolved' && event.targetId === immune.id))
      .toBe(false)

    const moonbeamCaster = fighter('moonbeam-caster', 20, {
      classState: {
        concentrationSpellId: 'moonbeam',
        concentrationSpellLevel: 2,
      },
      concentrating: true,
    })
    const persistentTarget = fighter('persistent-target', 10, {
      controller: 'dm',
      currentHp: 100,
      maxHp: 100,
      limitedMagicImmunity,
    })
    const persistent = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat(
        'limited-magic-immunity-persistent-area',
        [moonbeamCaster, persistentTarget],
      ),
      {
        areaId: 'core-spell-area:moonbeam',
        areaSourceKind: 'core-spell',
        coreSpellId: 'moonbeam',
        sourceId: moonbeamCaster.id,
        targetId: persistentTarget.id,
        trigger: {
          id: 'moonbeam',
          label: 'Moonbeam',
          timing: 'turn-start',
          oncePerTurn: true,
          savingThrow: { ability: 'con', dc: 13, onSuccess: 'half' },
          damage: { count: 2, sides: 10, modifier: 0, type: 'radiant' },
        },
      },
    )
    expect(persistent.ok).toBe(true)
    expect(persistent.state.combatants[persistentTarget.id].currentHp).toBe(100)
    expect(persistent.events).toEqual([{
      type: 'spell-negated-by-limited-magic-immunity',
      actorId: moonbeamCaster.id,
      targetId: persistentTarget.id,
      spellId: 'moonbeam',
      spellLevel: 2,
    }])
  })

  it('applies Elemental Adept die floors and resistance bypass in the shared spell pipeline', () => {
    const wizard = fighter('elemental-adept-wizard', 20, {
      classId: 'wizard', level: 5, proficiencyBonus: 3,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['fireball'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
      elementalAdeptDamageTypes: ['fire'],
    })
    const resistant = fighter('fire-resistant-target', 10, {
      controller: 'dm', currentHp: 100, maxHp: 100,
      damageResistances: ['fire'],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('elemental-adept', [wizard, resistant]),
      {
        type: 'cast-spell', actorId: wizard.id, targetId: resistant.id,
        targetIds: [resistant.id], spellId: 'fireball', slotLevel: 3,
        savingThrowD20: 1,
        effectRolls: Array(8).fill(1),
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[resistant.id].currentHp).toBe(84)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', targetId: resistant.id, amount: 16,
    }))
  })

  it('allows an authoritative willing ally spell and applies advantage to level-seven spells', () => {
    const limitedMagicImmunity = {
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    } as const
    const allyCaster = fighter('ally-caster', 20, {
      classId: 'wizard', level: 3,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['invisibility'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const willingRakshasa = fighter('willing-rakshasa', 10, {
      limitedMagicImmunity,
    })
    const willing = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-willing', [allyCaster, willingRakshasa]),
      {
        type: 'cast-spell',
        actorId: allyCaster.id,
        targetId: willingRakshasa.id,
        spellId: 'invisibility',
        slotLevel: 2,
        effectRolls: [],
      },
    )
    expect(willing.ok).toBe(true)
    if (!willing.ok) return
    expect(willing.state.combatants[willingRakshasa.id].conditions).toContain('invisible')
    expect(willing.events.some((event) =>
      event.type === 'spell-negated-by-limited-magic-immunity'))
      .toBe(false)

    const highCaster = fighter('high-caster', 20, {
      classId: 'wizard', level: 13, proficiencyBonus: 5,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['finger-of-death'] },
      classResources: { 'dnd5e-spell-slot-7': { current: 1, max: 1 } },
    })
    const highTarget = fighter('high-target', 10, {
      controller: 'dm',
      currentHp: 200,
      maxHp: 200,
      limitedMagicImmunity,
      savingThrowBonuses: { con: 2 },
    })
    const high = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-high-level', [highCaster, highTarget]),
      {
        type: 'cast-spell',
        actorId: highCaster.id,
        targetId: highTarget.id,
        spellId: 'finger-of-death',
        slotLevel: 7,
        savingThrowD20: 1,
        savingThrowD20Second: 20,
        effectRolls: Array(7).fill(1),
      },
    )
    expect(high.ok).toBe(true)
    if (!high.ok) return
    expect(high.state.combatants[highTarget.id].currentHp).toBe(182)
    expect(high.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: highTarget.id,
      d20: 20,
      success: true,
    }))
    expect(high.events.some((event) =>
      event.type === 'spell-negated-by-limited-magic-immunity'))
      .toBe(false)
  })

  it('negates monster core and adjudicated detection spells from the same target snapshot', () => {
    const limitedMagicImmunity = {
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    } as const
    const mage = fighter('mage', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:mage',
      classState: { monsterSpellSlots: { 3: { current: 1, max: 1 } } },
    })
    const coreTarget = fighter('core-target', 10, {
      controller: 'player',
      currentHp: 100,
      maxHp: 100,
      limitedMagicImmunity,
    })
    const core = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-monster-core', [mage, coreTarget]),
      {
        type: 'monster-core-spell',
        actorId: mage.id,
        spellId: 'fireball',
        slotLevel: 3,
        resolution: {
          schemaVersion: 1,
          targetIds: [coreTarget.id],
          targetSavingThrows: [{ targetId: coreTarget.id, d20: 1, d20Second: 20 }],
          effectRolls: [Array(8).fill(6)],
        },
      },
    )
    expect(core.ok).toBe(true)
    if (!core.ok) return
    expect(core.state.combatants[coreTarget.id].currentHp).toBe(100)
    expect(core.state.combatants[mage.id].classState.monsterSpellSlots?.['3'].current).toBe(0)
    expect(core.events).toContainEqual(expect.objectContaining({
      type: 'spell-negated-by-limited-magic-immunity',
      targetId: coreTarget.id,
      spellId: 'fireball',
    }))

    const detector = fighter('detector', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:rakshasa',
    })
    const hiddenMind = fighter('hidden-mind', 10, {
      controller: 'player',
      limitedMagicImmunity,
    })
    const detection = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-detection', [detector, hiddenMind]),
      {
        type: 'monster-spell',
        actorId: detector.id,
        spellId: 'detect-thoughts',
        slotLevel: 2,
        effects: [{
          targetId: hiddenMind.id,
          addCondition: 'detected',
          conditionDuration: {
            type: 'rounds',
            remainingRounds: 1,
            tickOn: 'target-turn-end',
          },
        }],
      },
    )
    expect(detection.ok).toBe(true)
    if (!detection.ok) return
    expect(detection.state.combatants[hiddenMind.id].conditions).not.toContain('detected')
    expect(detection.events).toContainEqual(expect.objectContaining({
      type: 'spell-negated-by-limited-magic-immunity',
      targetId: hiddenMind.id,
      spellId: 'detect-thoughts',
    }))
  })

  it('marks core spell damage as magical spell delivery', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard',
      level: 1,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      damageDefenseRules: [{
        outcome: 'immune',
        damageTypes: ['fire'],
        delivery: 'spell',
        magical: true,
      }],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('spell-delivery-defense', [wizard, target]),
      {
        type: 'cast-spell',
        actorId: wizard.id,
        targetId: target.id,
        spellId: 'fire-bolt',
        slotLevel: 0,
        d20: 12,
        effectRolls: [8],
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(20)
  })

  it('does not stack conditional and dynamic resistance before vulnerability', () => {
    const target = fighter('target', 10, {
      classState: { raging: true },
      damageVulnerabilities: ['slashing'],
      damageDefenseRules: [{
        outcome: 'resistant',
        damageTypes: ['slashing'],
        delivery: 'weapon-attack',
        magical: false,
      }],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('dynamic-resistance-order', [fighter('enemy', 20), target]),
      {
        type: 'attack',
        actorId: 'enemy',
        targetId: 'target',
        attackModifier: 20,
        d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [7], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(14)
  })

  it('charges double movement while crawling and leaves the actor prone', () => {
    const state = startDnd5eHeadlessCombat('crawl', [
      fighter('crawler', 20, { conditions: ['prone'] }), fighter('enemy', 10, { controller: 'dm' }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: 'crawler', to: { x: 5, y: 0 }, distance: 5,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.crawler.turn.movementRemaining).toBe(20)
    expect(result.state.combatants.crawler.conditions).toContain('prone')
    expect(result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'crawler', resource: 'movement', amount: 10,
    })
  })

  it('does not turn a hit within 5 feet against a petrified target into an automatic critical hit', () => {
    const state = startDnd5eHeadlessCombat('petrified-critical', [
      fighter('enemy', 20), fighter('target', 10, { conditions: ['petrified'] }),
    ])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('enemy', 'target')]: 5 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'target', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'force' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', critical: false }))
    expect(result.state.combatants.target.currentHp).toBe(19)
  })

  it('uses Fighter Indomitable or Monk Diamond Soul only after a failed saving throw', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 5, abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
    })
    const target = fighter('target', 10, {
      controller: 'dm', classId: 'fighter', level: 9,
      classResources: { fighterIndomitable: { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('indomitable', [cleric, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'cleric', targetId: 'target', spellId: 'sacred-flame', slotLevel: 0,
      savingThrowD20: 1, savingThrowRerollD20: 20, effectRolls: [],
    })
    expect(result.ok ? 'ok' : result.reason).toBe('ok')
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(20)
    expect(result.state.combatants.target.classResources.fighterIndomitable.current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'target', stateKey: 'indomitable-reroll', active: true,
    }))
  })

  it('settles death saves and concentration in the authoritative engine', () => {
    const dying = fighter('a', 20, { currentHp: 0, concentrating: true })
    const state = startDnd5eHeadlessCombat('combat', [dying, fighter('b', 10)])
    const deathSave = resolveDnd5eHeadlessAction(state, { type: 'death-save', actorId: 'a', d20: 20 })
    expect(deathSave.ok).toBe(true)
    if (!deathSave.ok) return
    expect(deathSave.state.combatants.a).toMatchObject({ currentHp: 1, deathSaves: { successes: 0, failures: 0 } })
    const concentrating = { ...deathSave.state, combatants: { ...deathSave.state.combatants, a: { ...deathSave.state.combatants.a, concentrating: true } } }
    const concentration = resolveDnd5eHeadlessAction(concentrating, { type: 'concentration-save', actorId: 'a', d20: 4, dc: 10 })
    expect(concentration.ok).toBe(true)
    if (!concentration.ok) return
    expect(concentration.state.combatants.a.concentrating).toBe(false)
  })

  it('settles an unconscious turn as one death-save transaction and advances only when still at 0 HP', () => {
    const state = startDnd5eHeadlessCombat('death-save-turn', [
      fighter('a', 20, { currentHp: 0 }),
      fighter('b', 10),
    ])
    const failed = resolveDnd5eHeadlessAction(state, { type: 'death-save-turn', actorId: 'a', d20: 5 })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.a.deathSaves.failures).toBe(1)
    expect(failed.state.initiativeIndex).toBe(1)
    expect(failed.transaction?.status).toBe('committed')
    expect(failed.transaction?.rollLedger.entries).toContainEqual(expect.objectContaining({
      kind: 'saving-throw', dice: { sides: 20, values: [5] },
    }))

    const recovered = resolveDnd5eHeadlessAction(state, { type: 'death-save-turn', actorId: 'a', d20: 20 })
    expect(recovered.ok).toBe(true)
    if (!recovered.ok) return
    expect(recovered.state.combatants.a.currentHp).toBe(1)
    expect(recovered.state.initiativeIndex).toBe(0)
  })

  it('applies unconscious and prone at 0 HP and enforces massive-damage instant death', () => {
    const dropped = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('drop-to-zero', [
        fighter('attacker', 20, { controller: 'dm' }),
        fighter('target', 10, { currentHp: 5 }),
      ]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [5], type: 'slashing' },
      },
    )
    expect(dropped.ok).toBe(true)
    if (!dropped.ok) return
    expect(dropped.state.combatants.target).toMatchObject({
      currentHp: 0,
      deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
    })
    expect(dropped.state.combatants.target.conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(dropped.state.combatants.target.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ standardCondition: 'unconscious', source: expect.objectContaining({ rulesId: 'zero-hit-points' }) }),
      expect.objectContaining({ standardCondition: 'prone', source: expect.objectContaining({ rulesId: 'zero-hit-points' }) }),
    ]))

    const killed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('massive-damage', [
        fighter('attacker', 20, { controller: 'dm' }),
        fighter('target', 10, { currentHp: 5, maxHp: 20 }),
      ]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 20, bonus: 15, rolls: [10], type: 'slashing' },
      },
    )
    expect(killed.ok).toBe(true)
    if (!killed.ok) return
    expect(killed.state.combatants.target.deathSaves).toMatchObject({ failures: 3, dead: true })
    expect(killed.events).toContainEqual(expect.objectContaining({
      type: 'instant-death', sourceId: 'attacker', targetId: 'target',
    }))
  })

  it('makes a hit against an unconscious creature within 5 feet critical and applies two death failures', () => {
    const nearby = startDnd5eHeadlessCombat('nearby-unconscious', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('target', 10, { currentHp: 0, conditions: ['unconscious', 'prone'] }),
    ])
    nearby.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'target')]: 5 }
    const critical = resolveDnd5eHeadlessAction(nearby, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20,
      d20: 2, d20Second: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2, 3], type: 'slashing' },
    })
    expect(critical.ok).toBe(true)
    if (!critical.ok) return
    expect(critical.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', hit: true, critical: true,
    }))
    expect(critical.state.combatants.target.deathSaves.failures).toBe(2)

    const distant = startDnd5eHeadlessCombat('distant-unconscious', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('target', 10, { currentHp: 0, conditions: ['unconscious', 'prone'] }),
    ])
    distant.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'target')]: 10 }
    const ordinary = resolveDnd5eHeadlessAction(distant, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20,
      d20: 2, d20Second: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2], type: 'slashing' },
    })
    expect(ordinary.ok).toBe(true)
    if (!ordinary.ok) return
    expect(ordinary.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', hit: true, critical: false,
    }))
    expect(ordinary.state.combatants.target.deathSaves.failures).toBe(1)

    const heavyHit = startDnd5eHeadlessCombat('heavy-hit-at-zero', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('target', 10, { currentHp: 0, maxHp: 20, conditions: ['unconscious', 'prone'] }),
    ])
    heavyHit.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'target')]: 10 }
    const heavyDamageAtZero = resolveDnd5eHeadlessAction(heavyHit, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20,
      d20: 2, d20Second: 2,
      damage: { count: 1, sides: 20, bonus: 15, rolls: [10], type: 'slashing' },
    })
    expect(heavyDamageAtZero.ok).toBe(true)
    if (!heavyDamageAtZero.ok) return
    expect(heavyDamageAtZero.state.combatants.target.deathSaves).toMatchObject({
      failures: 1, dead: false,
    })
    expect(heavyDamageAtZero.events).toContainEqual(expect.objectContaining({
      type: 'death-save-failure', targetId: 'target', failures: 1,
    }))
    expect(heavyDamageAtZero.events.some((event) => event.type === 'instant-death')).toBe(false)
  })

  it('ends concentration immediately when an incapacitating condition is present', () => {
    const state = startDnd5eHeadlessCombat('incapacitated-concentration', [
      fighter('caster', 20, {
        concentrating: true,
        conditions: ['paralyzed'],
        classState: { concentrationSpellId: 'hold-person', concentrationTargetIds: ['target'] },
      }),
      fighter('target', 10),
    ])
    const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'caster' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.caster.concentrating).toBe(false)
    expect(result.state.combatants.caster.classState.concentrationSpellId).toBeUndefined()
  })

  it('resolves Zombie Undead Fortitude and bypasses it for radiant or critical damage', () => {
    const zombie = () => fighter('zombie', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:zombie', usesDeathSaves: false,
      abilities: { ...abilities, con: 16 }, currentHp: 3, maxHp: 22,
    })
    const pending = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('undead-fortitude', [fighter('attacker', 20), zombie()]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'zombie', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'slashing' },
      },
    )
    expect(pending.ok).toBe(true)
    if (!pending.ok) return
    expect(pending.state.combatants.zombie).toMatchObject({
      currentHp: 0, deathSaves: { dead: false },
      classState: { undeadFortitudePending: { dc: 8, damage: 3, sourceId: 'attacker' } },
    })
    expect(pending.events).toContainEqual({
      type: 'undead-fortitude-save-required', targetId: 'zombie', dc: 8, damage: 3,
    })
    const survived = resolveDnd5eHeadlessAction(pending.state, {
      type: 'monster-undead-fortitude-save', actorId: 'zombie', d20: 10,
    })
    expect(survived.ok).toBe(true)
    if (!survived.ok) return
    expect(survived.state.combatants.zombie).toMatchObject({ currentHp: 1, deathSaves: { dead: false } })
    expect(survived.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()

    const failed = resolveDnd5eHeadlessAction(pending.state, {
      type: 'monster-undead-fortitude-save', actorId: 'zombie', d20: 1,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.zombie).toMatchObject({ currentHp: 0, deathSaves: { dead: true } })
    expect(failed.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()

    const radiant = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('radiant-zombie', [fighter('attacker', 20), zombie()]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'zombie', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'radiant' },
      },
    )
    expect(radiant.ok).toBe(true)
    if (!radiant.ok) return
    expect(radiant.state.combatants.zombie.deathSaves.dead).toBe(true)
    expect(radiant.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()

    const critical = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('critical-zombie', [fighter('attacker', 20), zombie()]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'zombie', attackModifier: 20, d20: 20,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1, 2], type: 'slashing' },
      },
    )
    expect(critical.ok).toBe(true)
    if (!critical.ok) return
    expect(critical.state.combatants.zombie.deathSaves.dead).toBe(true)
    expect(critical.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()
  })

  it('resolves the Wolf bite Strength save and applies prone on failure', () => {
    const wolf = fighter('wolf', 20, {
      controller: 'dm', statBlockId: 'srd-5.1:wolf', usesDeathSaves: false,
      abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
      currentHp: 11, maxHp: 11,
    })
    const hit = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('wolf-bite', [wolf, fighter('target', 10)]),
      {
        type: 'monster-action', actorId: 'wolf', actionId: 'bite',
        rolls: [{ targetId: 'target', d20: 12, damageRolls: [[2, 3]] }],
      },
    )
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual({
      type: 'monster-on-hit-save-required', targetId: 'target', sourceId: 'wolf',
      actionId: 'bite', ability: 'str', dc: 11, condition: 'prone',
    })
    const failed = resolveDnd5eHeadlessAction(hit.state, {
      type: 'monster-on-hit-save', actorId: 'target', sourceId: 'wolf', actionId: 'bite', d20: 1,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.target.conditions).toContain('prone')
    expect(failed.state.combatants.target.classState.monsterOnHitSavePending).toBeUndefined()
  })

  it('applies active Bless and Bane effects to death saves and rejects forged d4 rolls', () => {
    const blessedDying = fighter('dying', 20, {
      currentHp: 0,
      classState: { concentrationEffectsBySource: { cleric: 'bless' } },
    })
    const cleric = fighter('cleric', 10, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bless', concentrationTargetIds: ['dying'], concentrationRoundsRemaining: 10,
      },
    })
    const blessed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('blessed-death-save', [blessedDying, cleric]),
      { type: 'death-save', actorId: 'dying', d20: 8, blessRoll: 2 },
    )
    expect(blessed.ok).toBe(true)
    if (!blessed.ok) return
    expect(blessed.state.combatants.dying.deathSaves).toMatchObject({ successes: 1, failures: 0 })

    const banedDying = fighter('dying', 20, {
      currentHp: 0,
      classState: { concentrationEffectsBySource: { bard: 'bane' } },
    })
    const bard = fighter('bard', 10, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bane', concentrationTargetIds: ['dying'], concentrationRoundsRemaining: 10,
      },
    })
    const baned = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('baned-death-save', [banedDying, bard]),
      { type: 'death-save', actorId: 'dying', d20: 10, baneRoll: 1 },
    )
    expect(baned.ok).toBe(true)
    if (!baned.ok) return
    expect(baned.state.combatants.dying.deathSaves).toMatchObject({ successes: 0, failures: 1 })

    const forged = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('forged-death-save', [fighter('dying', 20, { currentHp: 0 }), fighter('ally', 10)]),
      { type: 'death-save', actorId: 'dying', d20: 8, blessRoll: 4 },
    )
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('resolves concentration saves off-turn from authoritative Constitution bonuses', () => {
    const state = startDnd5eHeadlessCombat('concentration', [
      fighter('attacker', 20),
      fighter('caster', 10, { concentrating: true, savingThrowBonuses: { con: 6 }, exhaustionLevel: 3 }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'caster', d20: 18, d20Second: 2, dc: 10,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({
      type: 'concentration-resolved', actorId: 'caster', d20: 2, total: 8, dc: 10, success: false,
    })
    expect(result.state.combatants.caster.concentrating).toBe(false)
  })

  it('applies and consumes damage-source concentration-save disadvantage', () => {
    const state = startDnd5eHeadlessCombat('concentration-damage-pressure', [
      fighter('mage-hunter', 20, { imposeConcentrationCheckDisadvantageOnDamage: true }),
      fighter('caster', 10, {
        concentrating: true,
        savingThrowBonuses: { con: 0 },
        classState: {
          concentrationSpellId: 'web',
          concentrationRoundsRemaining: 10,
        },
      }),
    ])
    const damaged = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'mage-hunter', targetId: 'caster',
      attackModifier: 10, d20: 10,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.caster.classState
      .concentrationCheckDisadvantagePendingSourceId).toBe('mage-hunter')

    const resolved = resolveDnd5eHeadlessAction(damaged.state, {
      type: 'concentration-save', actorId: 'caster', d20: 18, d20Second: 2, dc: 10,
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.events).toContainEqual({
      type: 'concentration-resolved', actorId: 'caster', d20: 2, total: 2, dc: 10, success: false,
    })
    expect(resolved.state.combatants.caster.classState
      .concentrationCheckDisadvantagePendingSourceId).toBeUndefined()
  })

  it('lets Diamond Soul reroll a failed concentration save and consumes one Ki', () => {
    const monk = fighter('monk', 10, {
      classId: 'monk', level: 14, concentrating: true,
      classResources: { 'dnd5e-ki': { current: 1, max: 14 } },
      savingThrowBonuses: { con: 7 },
    })
    const state = startDnd5eHeadlessCombat('diamond-soul-concentration', [fighter('attacker', 20), monk])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'monk', d20: 1, rerollD20: 20, dc: 15,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monk.concentrating).toBe(true)
    expect(result.state.combatants.monk.classResources['dnd5e-ki']).toEqual({ current: 0, max: 14 })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'monk', stateKey: 'diamond-soul-reroll', active: true,
    }))
  })

  it('lets Indomitable replace a failed Stunning Strike save before the condition is applied', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 1, max: 5 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm', classId: 'fighter', level: 9,
      classResources: { fighterIndomitable: { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('indomitable-stunning-strike', [monk, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'monk', targetId: 'target', attackModifier: 20, d20: 10,
      stunningStrikeSaveD20: 1,
      stunningStrikeSaveRerollD20: 20,
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 6,
        damageType: 'bludgeoning', adjacentEnemyOfTarget: false, stunningStrike: true,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'bludgeoning' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.stunnedByActorId).toBeUndefined()
    expect(result.state.combatants.target.classResources.fighterIndomitable.current).toBe(0)
    expect(result.state.combatants.monk.classResources['dnd5e-ki'].current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'target', d20: 20, success: true,
    }))
  })

  it('applies Bane to a Stunning Strike Constitution save in Headless', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 1, max: 5 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      classState: { concentrationEffectsBySource: { bard: 'bane' } },
    })
    const bard = fighter('bard', 1, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bane', concentrationTargetIds: ['target'], concentrationRoundsRemaining: 10,
      },
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('baned-stunning-strike', [monk, target, bard]), {
      type: 'attack', actorId: 'monk', targetId: 'target', attackModifier: 20, d20: 10,
      stunningStrikeSaveD20: 10, stunningStrikeSaveBaneRoll: 2,
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 6,
        damageType: 'bludgeoning', adjacentEnemyOfTarget: false, stunningStrike: true,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'bludgeoning' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.stunnedByActorId).toBe('monk')
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'target', modifier: 0, total: 10, success: false,
    }))
  })

  it('spends SRD class resources and turn economy atomically without AP', () => {
    const barbarian = fighter('a', 20, { classResources: { 'dnd5e-rage': { current: 2, max: 2 } } })
    const state = startDnd5eHeadlessCombat('combat', [barbarian, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'class-resource-use', actorId: 'a', resourceKey: 'dnd5e-rage', turnResource: 'bonusAction',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.classResources['dnd5e-rage']).toEqual({ current: 1, max: 2 })
    expect(result.state.combatants.a.turn.bonusActionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'class-resource-spent', resourceKey: 'dnd5e-rage', current: 1 }))
    expect(JSON.stringify(result)).not.toMatch(/actionPoints|currentAP|ap-spent/)

    const legacy = resolveDnd5eHeadlessAction(state, {
      type: 'class-resource-use', actorId: 'a', resourceKey: 'legacy-ki', turnResource: 'bonusAction',
    })
    expect(legacy).toMatchObject({ ok: false, reason: 'class-resource-unavailable' })
  })

  it('resolves barbarian Rage, physical resistance, and its end condition in Headless', () => {
    const barbarian = fighter('a', 20, { classId: 'barbarian', classResources: { 'dnd5e-rage': { current: 2, max: 2 } } })
    const state = startDnd5eHeadlessCombat('combat', [barbarian, fighter('b', 10)])
    const raged = resolveDnd5eHeadlessAction(state, { type: 'barbarian-rage', actorId: 'a' })
    expect(raged.ok).toBe(true)
    if (!raged.ok) return
    expect(raged.state.combatants.a).toMatchObject({ classState: { raging: true, rageTurnsRemaining: 10 }, turn: { bonusActionAvailable: false } })
    const hit = resolveDnd5eHeadlessAction(raged.state, {
      type: 'opportunity-attack', actorId: 'b', targetId: 'a', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'bludgeoning' },
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.a.currentHp).toBe(16)
    const ended = resolveDnd5eHeadlessAction(hit.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.a.classState).toMatchObject({ raging: true, rageTurnsRemaining: 9, rageSustainedThisTurn: false })

    const fresh = startDnd5eHeadlessCombat('fresh', [barbarian, fighter('b', 10)])
    const unsustained = resolveDnd5eHeadlessAction(fresh, { type: 'barbarian-rage', actorId: 'a' })
    expect(unsustained.ok).toBe(true)
    if (!unsustained.ok) return
    const expired = resolveDnd5eHeadlessAction(unsustained.state, { type: 'end-turn', actorId: 'a' })
    expect(expired.ok).toBe(true)
    if (!expired.ok) return
    expect(expired.state.combatants.a.classState.raging).toBeUndefined()
  })

  it('suspends and resumes charm effects through Berserker Mindless Rage', () => {
    const charmed = createDnd5eConditionEffect({
      id: 'mindless-rage:charmed',
      condition: 'charmed',
      source: { kind: 'spell', actorId: 'original-caster', rulesId: 'charm-person' },
      targetId: 'berserker',
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'wis', dc: 13, timing: 'target-turn-end', onSuccess: 'remove' },
    })
    const charmPenalty = createDnd5eMechanicalEffect({
      id: 'mindless-rage:charm-penalty',
      definitionId: 'test:charm-dependent-penalty',
      label: '魅惑依赖减值',
      source: { kind: 'spell', actorId: 'original-caster', rulesId: 'charm-person' },
      targetId: 'berserker',
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' },
      dependsOnEffectId: charmed.id,
      modifiers: { armorClassBonus: -2 },
    })
    const berserker = fighter('berserker', 20, {
      classId: 'barbarian',
      subclassId: 'berserker',
      level: 6,
      creatureType: 'humanoid',
      classResources: { 'dnd5e-rage': { current: 2, max: 2 } },
      classState: { activeEffects: [charmed, charmPenalty] },
    })
    const wizard = fighter('wizard', 10, {
      controller: 'dm',
      classId: 'wizard',
      level: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['charm-person'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('mindless-rage', [berserker, wizard])
    expect(state.combatants.berserker.conditions).toContain('charmed')
    expect(dnd5eTargetArmorClassForAttack(state, 'wizard', 'berserker')).toBe(14)

    const raged = resolveDnd5eHeadlessAction(state, {
      type: 'barbarian-rage',
      actorId: 'berserker',
    })
    expect(raged.ok).toBe(true)
    if (!raged.ok) return
    expect(raged.state.combatants.berserker.conditions).not.toContain('charmed')
    expect(raged.state.combatants.berserker.classState.activeEffects).toHaveLength(2)
    expect(raged.state.combatants.berserker.classState.activeEffects?.every((effect) =>
      effect.suspendedBy?.includes('class:berserker:mindless-rage'),
    )).toBe(true)
    expect(dnd5eTargetArmorClassForAttack(raged.state, 'wizard', 'berserker')).toBe(16)
    expect(raged.events).toContainEqual({
      type: 'class-state-changed',
      actorId: 'berserker',
      stateKey: 'berserker-mindless-rage',
      active: true,
      value: 2,
    })

    const wizardTurn = structuredClone(raged.state)
    wizardTurn.initiativeIndex = wizardTurn.initiativeOrder.indexOf('wizard')
    const blockedCharm = resolveDnd5eHeadlessAction(wizardTurn, {
      type: 'cast-spell',
      actorId: 'wizard',
      targetId: 'berserker',
      spellId: 'charm-person',
      slotLevel: 1,
      savingThrowD20: 1,
      savingThrowD20Second: 1,
      effectRolls: [],
    })
    expect(blockedCharm.ok).toBe(true)
    if (!blockedCharm.ok) return
    expect(blockedCharm.state.combatants.berserker.conditions).not.toContain('charmed')
    expect(blockedCharm.state.combatants.berserker.classState.activeEffects).toHaveLength(2)

    const ended = resolveDnd5eHeadlessAction(raged.state, {
      type: 'end-turn',
      actorId: 'berserker',
    })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.berserker.classState.raging).toBeUndefined()
    expect(ended.state.combatants.berserker.conditions).toContain('charmed')
    expect(ended.state.combatants.berserker.classState.activeEffects?.every(
      (effect) => effect.suspendedBy == null,
    )).toBe(true)
    expect(ended.state.combatants.berserker.classState.activeEffects?.every(
      (effect) => effect.duration.type === 'rounds' && effect.duration.remainingRounds === 2,
    )).toBe(true)
    expect(dnd5eTargetArmorClassForAttack(ended.state, 'wizard', 'berserker')).toBe(14)
    expect(ended.events).toContainEqual({
      type: 'class-state-changed',
      actorId: 'berserker',
      stateKey: 'berserker-mindless-rage',
      active: false,
      value: 2,
    })
  })

  it('grants the Frenzy melee bonus attack only from the turn after entering Rage', () => {
    const berserker = fighter('berserker', 20, {
      classId: 'barbarian',
      subclassId: 'berserker',
      level: 6,
      classResources: { 'dnd5e-rage': { current: 2, max: 2 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm',
      armorClass: 12,
    })
    const state = startDnd5eHeadlessCombat('berserker-frenzy', [berserker, enemy])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('berserker', 'enemy')]: 5,
    }
    const raged = resolveDnd5eHeadlessAction(state, {
      type: 'barbarian-rage',
      actorId: 'berserker',
      frenzy: true,
    })
    expect(raged.ok).toBe(true)
    if (!raged.ok) return
    expect(raged.state.combatants.berserker.classState).toMatchObject({
      raging: true,
      frenzying: true,
    })

    const tooEarly = resolveDnd5eHeadlessAction(raged.state, {
      type: 'attack',
      actorId: 'berserker',
      targetId: 'enemy',
      attackModifier: 5,
      d20: 15,
      spendAction: false,
      spendBonusAction: true,
      classDamageContext: { ...meleeWeaponContext(), frenzyAttack: true },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
    })
    expect(tooEarly).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const sustainingAttack = resolveDnd5eHeadlessAction(raged.state, {
      type: 'attack',
      actorId: 'berserker',
      targetId: 'enemy',
      attackModifier: 5,
      d20: 15,
      classDamageContext: meleeWeaponContext(),
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
    })
    expect(sustainingAttack.ok).toBe(true)
    if (!sustainingAttack.ok) return
    const berserkerEnded = resolveDnd5eHeadlessAction(sustainingAttack.state, {
      type: 'end-turn',
      actorId: 'berserker',
    })
    expect(berserkerEnded.ok).toBe(true)
    if (!berserkerEnded.ok) return
    const enemyEnded = resolveDnd5eHeadlessAction(berserkerEnded.state, {
      type: 'end-turn',
      actorId: 'enemy',
    })
    expect(enemyEnded.ok).toBe(true)
    if (!enemyEnded.ok) return

    const frenzyAttack = resolveDnd5eHeadlessAction(enemyEnded.state, {
      type: 'attack',
      actorId: 'berserker',
      targetId: 'enemy',
      attackModifier: 5,
      d20: 15,
      spendAction: false,
      spendBonusAction: true,
      classDamageContext: { ...meleeWeaponContext(), frenzyAttack: true },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
    })
    expect(frenzyAttack.ok).toBe(true)
    if (!frenzyAttack.ok) return
    expect(frenzyAttack.state.combatants.berserker.turn).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: false,
    })
    expect(frenzyAttack.events).toContainEqual({
      type: 'turn-resource-spent',
      actorId: 'berserker',
      resource: 'bonusAction',
    })
  })

  it('keeps a level-15 Barbarian raging without attacking or taking damage', () => {
    const barbarian = fighter('a', 20, {
      classId: 'barbarian', level: 15,
      classResources: { 'dnd5e-rage': { current: 5, max: 5 } },
    })
    const state = startDnd5eHeadlessCombat('persistent-rage', [barbarian, fighter('b', 10)])
    const raged = resolveDnd5eHeadlessAction(state, { type: 'barbarian-rage', actorId: 'a' })
    expect(raged.ok).toBe(true)
    if (!raged.ok) return
    const ended = resolveDnd5eHeadlessAction(raged.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.a.classState).toMatchObject({ raging: true, rageTurnsRemaining: 9 })
  })

  it('ends Rage immediately at 0 HP and applies Frenzy exhaustion once', () => {
    const barbarian = fighter('barbarian', 10, {
      classId: 'barbarian', subclassId: 'berserker', level: 10, currentHp: 5,
      classState: { raging: true, rageTurnsRemaining: 10, frenzying: true },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('rage-unconscious', [fighter('enemy', 20, { controller: 'dm' }), barbarian]),
      {
        type: 'attack', actorId: 'enemy', targetId: 'barbarian', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 12, bonus: 0, rolls: [12], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.barbarian).toMatchObject({
      currentHp: 0, exhaustionLevel: 1,
      classState: { raging: undefined, frenzying: undefined, rageTurnsRemaining: undefined },
    })
    expect(result.events.filter((event) => event.type === 'exhaustion-gained')).toEqual([
      { type: 'exhaustion-gained', actorId: 'barbarian', level: 1 },
    ])
  })

  it('lets a Barbarian end an active Rage with a bonus action', () => {
    const barbarian = fighter('barbarian', 20, {
      classId: 'barbarian', subclassId: 'berserker', level: 3,
      classState: { raging: true, rageTurnsRemaining: 8, frenzying: true },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('end-rage', [barbarian, fighter('enemy', 10)]),
      { type: 'barbarian-rage', actorId: 'barbarian', end: true },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.barbarian).toMatchObject({
      exhaustionLevel: 1,
      turn: { bonusActionAvailable: false },
      classState: { raging: undefined, frenzying: undefined, rageTurnsRemaining: undefined },
    })
    expect(result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'barbarian', resource: 'bonusAction',
    })
  })

  it('grants bardic inspiration to another combatant using a bonus action', () => {
    const bard = fighter('a', 20, { level: 10, classId: 'bard', classResources: { 'dnd5e-bardic-inspiration': { current: 4, max: 4 } } })
    const state = startDnd5eHeadlessCombat('combat', [bard, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'bardic-inspiration', actorId: 'a', targetId: 'b' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.b.classState).toMatchObject({
      bardicInspirationDie: 10,
      bardicInspirationSourceId: 'a',
      bardicInspirationRoundsRemaining: 100,
    })
    expect(result.state.combatants.a.classResources['dnd5e-bardic-inspiration'].current).toBe(3)
  })

  it('lets a Lore Bard spend a reaction and inspiration die to reduce an attack roll', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm' })
    const bard = fighter('bard', 15, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 3, max: 4 } },
    })
    const target = fighter('target', 10)
    const state = startDnd5eHeadlessCombat('cutting-words', [attacker, bard, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'attacker', targetId: 'target', total: 13, hit: false,
    }))
    expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration']).toEqual({ current: 2, max: 4 })
    expect(result.state.combatants.target.currentHp).toBe(20)
  })

  it('applies Cutting Words to a damage roll before damage resistance', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm' })
    const bard = fighter('bard', 15, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    })
    const target = fighter('target', 10, { damageResistances: ['slashing'] })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('cutting-damage', [attacker, bard, target]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 15,
        cuttingWordsDamage: { bardId: 'bard', roll: 3, distanceFeet: 30 },
        damage: { count: 1, sides: 8, bonus: 3, rolls: [8], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(16)
    expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration'].current).toBe(1)
  })

  it('does not let Cutting Words cancel a natural 20 or affect a creature that cannot hear it', () => {
    const bard = fighter('bard', 15, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
    })
    const criticalState = startDnd5eHeadlessCombat('cutting-words-critical', [fighter('attacker', 20, { controller: 'dm' }), bard, fighter('target', 10)])
    const critical = resolveDnd5eHeadlessAction(criticalState, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 20,
      cuttingWords: { bardId: 'bard', roll: 8, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4, 4] },
    })
    expect(critical.ok).toBe(true)
    if (critical.ok) expect(critical.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: true, critical: true, total: 17 }))

    const deafState = startDnd5eHeadlessCombat('cutting-words-deaf', [
      fighter('attacker', 20, { controller: 'dm', conditions: ['耳聋'] }), bard, fighter('target', 10),
    ])
    expect(resolveDnd5eHeadlessAction(deafState, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const silencedState = startDnd5eHeadlessCombat('cutting-words-silenced', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('bard', 15, {
        classId: 'bard', subclassId: 'lore', level: 5, conditions: ['沉默'],
        classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
      }),
      fighter('target', 10),
    ])
    expect(resolveDnd5eHeadlessAction(silencedState, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('applies Cutting Words before Stroke of Luck turns the resulting miss into a hit', () => {
    const attacker = fighter('attacker', 20, {
      classId: 'rogue', level: 20,
      classResources: { 'dnd5e-stroke-of-luck': { current: 1, max: 1 } },
    })
    const bard = fighter('bard', 15, {
      controller: 'dm', classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('cutting-words-before-stroke', [attacker, bard, fighter('target', 10, { controller: 'dm' })])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      strokeOfLuck: true,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'attacker', targetId: 'target', total: 13, hit: true,
    }))
    expect(result.state.combatants.attacker.classResources['dnd5e-stroke-of-luck'].current).toBe(0)
  })

  it('starts Countercharm with an action and keeps it through the end of the activation turn', () => {
    const bard = fighter('a', 20, { level: 6, classId: 'bard' })
    const state = startDnd5eHeadlessCombat('countercharm', [bard, fighter('b', 10)])
    const started = resolveDnd5eHeadlessAction(state, { type: 'bard-countercharm', actorId: 'a' })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(started.state.combatants.a).toMatchObject({
      turn: { actionAvailable: false }, classState: { countercharmRoundsRemaining: 2 },
    })
    const ended = resolveDnd5eHeadlessAction(started.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.a.classState.countercharmRoundsRemaining).toBe(1)

    const locked = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('countercharm-locked', [fighter('a', 20, { level: 5, classId: 'bard' }), fighter('b', 10)]),
      { type: 'bard-countercharm', actorId: 'a' },
    )
    expect(locked).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('adds and consumes a held Bardic Inspiration die on an attack roll', () => {
    const inspired = fighter('a', 20, {
      classState: { bardicInspirationDie: 6, bardicInspirationSourceId: 'bard', bardicInspirationRoundsRemaining: 100 },
    })
    const state = startDnd5eHeadlessCombat('bardic-attack', [inspired, fighter('b', 12)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 2,
      d20: 9, bardicInspirationRoll: 5,
      damage: { count: 1, sides: 8, bonus: 2, rolls: [5], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'a', total: 16, hit: true,
    }))
    expect(result.state.combatants.a.classState.bardicInspirationDie).toBeUndefined()
    expect(result.state.combatants.a.classState.bardicInspirationSourceId).toBeUndefined()
    expect(result.state.combatants.b.currentHp).toBe(13)
  })

  it('adds and consumes Bardic Inspiration on saving throws before a class reroll', () => {
    const inspired = fighter('a', 20, {
      concentrating: true,
      classState: { bardicInspirationDie: 8, bardicInspirationSourceId: 'bard', bardicInspirationRoundsRemaining: 100 },
    })
    const state = startDnd5eHeadlessCombat('bardic-save', [inspired, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'a', d20: 5, bardicInspirationRoll: 3, dc: 10,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved', actorId: 'a', total: 10, success: true,
    }))
    expect(result.state.combatants.a.concentrating).toBe(true)
    expect(result.state.combatants.a.classState.bardicInspirationDie).toBeUndefined()
  })

  it("adds the Fiend warlock's Dark One's Own Luck d10 to a saving throw and consumes its short-rest use", () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6, concentrating: true,
      classResources: { 'dnd5e-dark-ones-own-luck': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('dark-ones-own-luck', [warlock, fighter('enemy', 10)])
    expect(dnd5eDarkOnesOwnLuckAvailable(state.combatants.warlock)).toBe(true)
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'warlock', d20: 5, darkOnesOwnLuckRoll: 3, dc: 10,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved', actorId: 'warlock', total: 10, success: true,
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'warlock', stateKey: 'dark-ones-own-luck', active: true, value: 3,
    }))
    expect(result.state.combatants.warlock.classResources['dnd5e-dark-ones-own-luck'].current).toBe(0)
    expect(dnd5eDarkOnesOwnLuckAvailable(result.state.combatants.warlock)).toBe(false)
  })

  it("rejects Dark One's Own Luck when the subclass, resource, or d10 result is invalid", () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6, concentrating: true,
      classResources: { 'dnd5e-dark-ones-own-luck': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('dark-ones-own-luck-invalid', [warlock, fighter('enemy', 10)])
    const invalidDie = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'warlock', d20: 5, darkOnesOwnLuckRoll: 11, dc: 10,
    })
    expect(invalidDie).toMatchObject({ ok: false, reason: 'invalid-dice' })

    state.combatants.warlock.subclassId = 'other'
    state.combatants.warlock.subclassIds = { warlock: 'other' }
    const invalidSubclass = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'warlock', d20: 5, darkOnesOwnLuckRoll: 3, dc: 10,
    })
    expect(invalidSubclass).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('keeps Hurl Through Hell readied across a miss, then returns the hit target at the end of the warlock next turn', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 14,
      classResources: { 'dnd5e-hurl-through-hell': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, { controller: 'dm', currentHp: 100, maxHp: 100 })
    const state = startDnd5eHeadlessCombat('hurl-through-hell', [warlock, target])
    const readied = resolveDnd5eHeadlessAction(state, {
      type: 'warlock-hurl-through-hell-ready', actorId: 'warlock', active: true,
    })
    expect(readied.ok).toBe(true)
    if (!readied.ok) return

    const missed = resolveDnd5eHeadlessAction(readied.state, {
      type: 'attack', actorId: 'warlock', targetId: 'target', attackModifier: 0, d20: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [] },
    })
    expect(missed.ok).toBe(true)
    if (!missed.ok) return
    expect(missed.state.combatants.warlock.classState.hurlThroughHellReady).toBe(true)
    expect(missed.state.combatants.warlock.classResources['dnd5e-hurl-through-hell'].current).toBe(1)

    missed.state.combatants.warlock.turn.actionAvailable = true
    const hit = resolveDnd5eHeadlessAction(missed.state, {
      type: 'attack', actorId: 'warlock', targetId: 'target', attackModifier: 20, d20: 10,
      hurlThroughHellDamageRolls: Array(10).fill(5),
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.warlock.classResources['dnd5e-hurl-through-hell'].current).toBe(0)
    expect(hit.state.combatants.target).toMatchObject({
      currentHp: 99,
      classState: { hurlThroughHellSourceId: 'warlock', hurlThroughHellDamage: 50 },
    })
    expect(hit.state.combatants.target.conditions).toContain('banished')

    const currentTurnEnded = resolveDnd5eHeadlessAction(hit.state, { type: 'end-turn', actorId: 'warlock' })
    expect(currentTurnEnded.ok).toBe(true)
    if (!currentTurnEnded.ok) return
    expect(currentTurnEnded.state.combatants.target.conditions).toContain('banished')

    const targetTurnEnded = resolveDnd5eHeadlessAction(currentTurnEnded.state, { type: 'end-turn', actorId: 'target' })
    expect(targetTurnEnded.ok).toBe(true)
    if (!targetTurnEnded.ok) return
    const returned = resolveDnd5eHeadlessAction(targetTurnEnded.state, { type: 'end-turn', actorId: 'warlock' })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.target.currentHp).toBe(49)
    expect(returned.state.combatants.target.conditions).not.toContain('banished')
    expect(returned.state.combatants.target.classState.hurlThroughHellSourceId).toBeUndefined()
    expect(returned.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'warlock', targetId: 'target', amount: 50,
    }))
  })

  it('triggers Hurl Through Hell on a spell attack but deals no return damage to a fiend', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 14,
      classSelections: { 'spell-cantrips': ['chill-touch'] },
      classResources: { 'dnd5e-hurl-through-hell': { current: 1, max: 1 } },
    })
    const fiend = fighter('fiend', 10, {
      controller: 'dm', currentHp: 100, maxHp: 100, creatureType: 'fiend', armorClass: 10,
    })
    const state = startDnd5eHeadlessCombat('hurl-through-hell-spell', [warlock, fiend])
    const readied = resolveDnd5eHeadlessAction(state, {
      type: 'warlock-hurl-through-hell-ready', actorId: 'warlock', active: true,
    })
    expect(readied.ok).toBe(true)
    if (!readied.ok) return
    const cast = resolveDnd5eHeadlessAction(readied.state, {
      type: 'cast-spell', actorId: 'warlock', targetId: 'fiend', spellId: 'chill-touch', slotLevel: 0,
      d20: 20, effectRolls: [1, 1, 1, 1, 1, 1], hurlThroughHellDamageRolls: Array(10).fill(10),
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    const hpAfterSpell = cast.state.combatants.fiend.currentHp
    const currentTurnEnded = resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: 'warlock' })
    expect(currentTurnEnded.ok).toBe(true)
    if (!currentTurnEnded.ok) return
    const fiendTurnEnded = resolveDnd5eHeadlessAction(currentTurnEnded.state, { type: 'end-turn', actorId: 'fiend' })
    expect(fiendTurnEnded.ok).toBe(true)
    if (!fiendTurnEnded.ok) return
    const returned = resolveDnd5eHeadlessAction(fiendTurnEnded.state, { type: 'end-turn', actorId: 'warlock' })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.fiend.currentHp).toBe(hpAfterSpell)
    expect(returned.state.combatants.fiend.conditions).not.toContain('banished')
  })

  it('expires an unused Bardic Inspiration die after its remaining duration', () => {
    const inspired = fighter('a', 20, {
      classState: { bardicInspirationDie: 6, bardicInspirationSourceId: 'bard', bardicInspirationRoundsRemaining: 1 },
    })
    const state = startDnd5eHeadlessCombat('bardic-expiry', [inspired, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'a' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.classState.bardicInspirationDie).toBeUndefined()
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'a', stateKey: 'bardic-inspiration', active: false,
    }))
  })

  it('lets a level-20 Rogue turn a missed attack into a hit with Stroke of Luck', () => {
    const rogue = fighter('a', 20, {
      classId: 'rogue', level: 20,
      classResources: { 'dnd5e-stroke-of-luck': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('stroke-of-luck', [rogue, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0,
      d20: 1, strokeOfLuck: true,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'piercing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'a', hit: true, critical: false,
    }))
    expect(result.state.combatants.b.currentHp).toBe(16)
    expect(result.state.combatants.a.classResources['dnd5e-stroke-of-luck'].current).toBe(0)
  })

  it('applies Foe Slayer once per turn against a selected favored enemy', () => {
    const ranger = fighter('a', 20, {
      classId: 'ranger', level: 20,
      classSelections: { 'favored-enemy': ['favored-亡灵'] },
    })
    const undead = fighter('b', 10, { armorClass: 11, creatureType: '亡灵' })
    const state = startDnd5eHeadlessCombat('foe-slayer', [ranger, undead])
    const context = {
      mode: 'melee' as const,
      finesse: false,
      strengthBased: true,
      weaponDamageSides: 8,
      damageType: 'slashing' as const,
      adjacentEnemyOfTarget: false,
      foeSlayer: 'attack' as const,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, d20: 10,
      classDamageContext: context,
      classDamageRolls: [],
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'a', total: 11, hit: true,
    }))
    expect(result.state.combatants.a.classState.foeSlayerTurnKey).toBe('foe-slayer:1:a')
  })

  it('resolves Lay on Hands, Wholeness of Body, and Preserve Life with rule caps', () => {
    const paladin = fighter('p', 20, { classId: 'paladin', classResources: { 'dnd5e-lay-on-hands': { current: 25, max: 25 } } })
    const wounded = fighter('w', 10, { currentHp: 5 })
    const paladinState = startDnd5eHeadlessCombat('paladin', [paladin, wounded])
    const lay = resolveDnd5eHeadlessAction(paladinState, { type: 'paladin-lay-on-hands', actorId: 'p', targetId: 'w', amount: 7 })
    expect(lay.ok).toBe(true)
    if (!lay.ok) return
    expect(lay.state.combatants.w.currentHp).toBe(12)
    expect(lay.state.combatants.p.classResources['dnd5e-lay-on-hands'].current).toBe(18)

    const monk = fighter('m', 20, { level: 6, classId: 'monk', subclassId: 'open-hand', currentHp: 1, maxHp: 30, classResources: { 'dnd5e-wholeness-of-body': { current: 1, max: 1 } } })
    const monkState = startDnd5eHeadlessCombat('monk', [monk, fighter('x', 10)])
    const whole = resolveDnd5eHeadlessAction(monkState, { type: 'monk-wholeness-of-body', actorId: 'm' })
    expect(whole.ok).toBe(true)
    if (!whole.ok) return
    expect(whole.state.combatants.m.currentHp).toBe(19)

    const cleric = fighter('c', 20, { level: 5, classId: 'cleric', subclassId: 'life', classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } } })
    const ally = fighter('y', 10, { currentHp: 2, maxHp: 20 })
    const clericState = startDnd5eHeadlessCombat('cleric', [cleric, ally])
    const preserve = resolveDnd5eHeadlessAction(clericState, { type: 'cleric-preserve-life', actorId: 'c', allocations: [{ targetId: 'y', amount: 8 }] })
    expect(preserve.ok).toBe(true)
    if (!preserve.ok) return
    expect(preserve.state.combatants.y.currentHp).toBe(10)
    const overHalf = resolveDnd5eHeadlessAction(clericState, { type: 'cleric-preserve-life', actorId: 'c', allocations: [{ targetId: 'y', amount: 9 }] })
    expect(overHalf).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const undead = fighter('u', 10, { currentHp: 2, maxHp: 20, creatureType: '亡灵' })
    const undeadState = startDnd5eHeadlessCombat('cleric-undead', [cleric, undead])
    expect(resolveDnd5eHeadlessAction(undeadState, {
      type: 'cleric-preserve-life', actorId: 'c', allocations: [{ targetId: 'u', amount: 8 }],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('enforces Turn Undead movement, action, reaction, and damage-ending rules in Headless', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 2, abilities: { ...abilities, wis: 16 }, position: { x: 0, y: 0 },
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const skeleton = fighter('skeleton', 10, {
      controller: 'dm', creatureType: '亡灵', challengeRating: 0.25,
      position: { x: 30, y: 0 }, savingThrowBonuses: { wis: -1 },
    })
    const state = startDnd5eHeadlessCombat('turn-undead', [cleric, skeleton])
    const turned = resolveDnd5eHeadlessAction(state, {
      type: 'cleric-turn-undead', actorId: 'cleric', targets: [{ targetId: 'skeleton', d20: 1 }],
    })
    expect(turned.ok).toBe(true)
    if (!turned.ok) return
    expect(turned.state.combatants.skeleton.classState).toMatchObject({
      turnedByClericId: 'cleric', turnedRoundsRemaining: 10,
    })
    expect(turned.state.combatants.skeleton.conditions).toContain('turned')
    expect(turned.state.combatants.cleric.classResources['dnd5e-channel-divinity'].current).toBe(0)

    const clericEnded = resolveDnd5eHeadlessAction(turned.state, { type: 'end-turn', actorId: 'cleric' })
    expect(clericEnded.ok).toBe(true)
    if (!clericEnded.ok) return
    expect(resolveDnd5eHeadlessAction(clericEnded.state, {
      type: 'attack', actorId: 'skeleton', targetId: 'cleric', attackModifier: 4, d20: 20,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [6, 6] },
    })).toMatchObject({ ok: false, reason: 'invalid-actor' })
    expect(resolveDnd5eHeadlessAction(clericEnded.state, {
      type: 'move', actorId: 'skeleton', to: { x: 20, y: 0 }, distance: 10,
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const fled = resolveDnd5eHeadlessAction(clericEnded.state, {
      type: 'move', actorId: 'skeleton', to: { x: 50, y: 0 }, distance: 20,
    })
    expect(fled.ok).toBe(true)

    const damageState = startDnd5eHeadlessCombat('turn-undead-damage', [
      fighter('attacker', 20),
      fighter('undead', 10, {
        controller: 'dm', creatureType: '亡灵',
        classState: { turnedByClericId: 'cleric', turnedRoundsRemaining: 10 }, conditions: ['turned'],
      }),
    ])
    const damaged = resolveDnd5eHeadlessAction(damageState, {
      type: 'attack', actorId: 'attacker', targetId: 'undead', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.undead.classState.turnedByClericId).toBeUndefined()
    expect(damaged.state.combatants.undead.conditions).not.toContain('turned')
  })

  it('rejects a forged Turn Undead target that is not undead', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 2,
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('forged-turn-undead', [cleric, fighter('humanoid', 10, { controller: 'dm' })])
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'cleric-turn-undead', actorId: 'cleric', targets: [{ targetId: 'humanoid', d20: 1 }],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('ends the caster concentration when Cleansing Touch removes its final affected target', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', level: 14,
      classResources: { 'dnd5e-cleansing-touch': { current: 1, max: 1 } },
      classState: { concentrationEffectsBySource: { caster: 'shield-of-faith' } },
    })
    const caster = fighter('caster', 15, {
      classId: 'cleric', concentrating: true,
      classState: {
        concentrationSpellId: 'shield-of-faith',
        concentrationTargetIds: ['paladin'],
        concentrationRoundsRemaining: 100,
      },
    })
    const state = startDnd5eHeadlessCombat('cleansing-touch', [paladin, caster])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'paladin-cleansing-touch', actorId: 'paladin', targetId: 'paladin',
      sourceId: 'caster', spellId: 'shield-of-faith',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.paladin).toMatchObject({
      classResources: { 'dnd5e-cleansing-touch': { current: 0, max: 1 } },
      turn: { actionAvailable: false },
      classState: { concentrationEffectsBySource: undefined },
    })
    expect(result.state.combatants.caster).toMatchObject({
      concentrating: false,
      classState: { concentrationSpellId: undefined, concentrationTargetIds: undefined },
    })
  })

  it('spends five Lay on Hands points to cure disease or neutralize poison', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', level: 5,
      classResources: { 'dnd5e-lay-on-hands': { current: 10, max: 25 } },
    })
    const ally = fighter('ally', 10, { conditions: ['疾病', '中毒'] })
    const disease = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('lay-cure', [paladin, ally]), {
      type: 'paladin-lay-on-hands', actorId: 'paladin', targetId: 'ally', cure: 'disease',
    })
    expect(disease.ok).toBe(true)
    if (!disease.ok) return
    expect(disease.state.combatants.ally.conditions).toEqual(['中毒'])
    expect(disease.state.combatants.paladin.classResources['dnd5e-lay-on-hands'].current).toBe(5)
    expect(disease.events).toContainEqual({ type: 'condition-ended', targetId: 'ally', condition: '疾病' })

    const harmReducedAlly = fighter('harm-reduced-ally', 10, {
      currentHp: 20,
      maxHp: 20,
      classState: {
        hitPointMaximumReductionLedger: {
          schemaVersion: 1,
          baseMaximum: 30,
          entries: [{
            id: 'harm:lay-on-hands',
            amount: 10,
            recovery: 'greater-restoration-or-other-magic',
            remainingRounds: 600,
            sourceActionId: 'harm',
            damageType: 'necrotic',
          }],
        },
      },
    })
    const secondPaladin = fighter('second-paladin', 20, {
      classId: 'paladin', level: 5,
      classResources: { 'dnd5e-lay-on-hands': { current: 5, max: 25 } },
    })
    const recoveredMaximum = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('lay-cure-harm', [secondPaladin, harmReducedAlly]),
      {
        type: 'paladin-lay-on-hands', actorId: secondPaladin.id,
        targetId: harmReducedAlly.id, cure: 'disease',
      },
    )
    expect(recoveredMaximum.ok, recoveredMaximum.ok ? undefined : recoveredMaximum.reason).toBe(true)
    if (!recoveredMaximum.ok) return
    expect(recoveredMaximum.state.combatants[harmReducedAlly.id]).toMatchObject({
      currentHp: 20,
      maxHp: 30,
      classState: { hitPointMaximumReductionLedger: undefined },
    })
    expect(recoveredMaximum.state.combatants[secondPaladin.id]
      .classResources['dnd5e-lay-on-hands'].current).toBe(0)
    expect(recoveredMaximum.events).toContainEqual(expect.objectContaining({
      type: 'hit-point-maximum-restored',
      targetId: harmReducedAlly.id,
      amount: 10,
    }))

    const undead = fighter('undead', 10, { creatureType: '亡灵', conditions: ['中毒'] })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('lay-undead', [paladin, undead]), {
      type: 'paladin-lay-on-hands', actorId: 'paladin', targetId: 'undead', cure: 'poisoned',
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('turns fiends and undead with the Devotion Channel Divinity without Destroy Undead', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', subclassId: 'devotion', level: 5, abilities: { ...abilities, cha: 16 },
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const fiend = fighter('fiend', 10, { controller: 'dm', creatureType: '邪魔', challengeRating: 0.25 })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('turn-unholy', [paladin, fiend]), {
      type: 'paladin-turn-the-unholy', actorId: 'paladin', targets: [{ targetId: 'fiend', d20: 1 }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.fiend).toMatchObject({
      currentHp: 20,
      classState: { turnedByClericId: 'paladin', turnedRoundsRemaining: 10 },
    })
    expect(result.events).toContainEqual({ type: 'unholy-turned', actorId: 'paladin', targetId: 'fiend', rounds: 10 })
  })

  it('resolves Divine Intervention chance, automatic success, and seven-day lockout', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 10,
      classResources: { 'dnd5e-divine-intervention': { current: 1, max: 1 } },
    })
    const success = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('intervention', [cleric, fighter('enemy', 10)]), {
      type: 'cleric-divine-intervention', actorId: 'cleric', d100: 10,
    })
    expect(success.ok).toBe(true)
    if (!success.ok) return
    expect(success.state.combatants.cleric.classState.divineInterventionCooldownDays).toBe(7)
    expect(success.events).toContainEqual({
      type: 'divine-intervention-resolved', actorId: 'cleric', d100: 10,
      success: true, automatic: false, cooldownDays: 7,
    })

    const highCleric = fighter('high-cleric', 20, {
      classId: 'cleric', level: 20,
      classResources: { 'dnd5e-divine-intervention': { current: 1, max: 1 } },
    })
    const automatic = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('intervention-20', [highCleric, fighter('enemy', 10)]), {
      type: 'cleric-divine-intervention', actorId: 'high-cleric',
    })
    expect(automatic.ok).toBe(true)
    if (!automatic.ok) return
    expect(automatic.events).toContainEqual({
      type: 'divine-intervention-resolved', actorId: 'high-cleric', d100: undefined,
      success: true, automatic: true, cooldownDays: 7,
    })
  })

  it('applies Holy Nimbus radiant damage at an enemy turn start and tracks duration', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', subclassId: 'devotion', level: 20,
      classResources: { 'dnd5e-holy-nimbus': { current: 1, max: 1 } },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm', holyNimbusSourceIds: ['paladin'] })
    const activated = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('holy-nimbus', [paladin, enemy]), {
      type: 'paladin-holy-nimbus', actorId: 'paladin',
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    const ended = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'paladin' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.paladin.classState.holyNimbusRoundsRemaining).toBe(9)
    expect(ended.state.combatants.enemy.currentHp).toBe(10)
    expect(ended.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'paladin', targetId: 'enemy', amount: 10,
    }))
  })

  it('toggles Draconic Wings as a bonus action and rejects unmodified armor', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 14,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('wings', [sorcerer, fighter('enemy', 10)]), {
      type: 'sorcerer-draconic-wings', actorId: 'sorcerer', active: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.sorcerer).toMatchObject({
      classState: { draconicWingsActive: true }, turn: { bonusActionAvailable: false },
    })

    const armored = fighter('armored', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 14, wearingArmor: true,
    })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('armored-wings', [armored, fighter('enemy', 10)]), {
      type: 'sorcerer-draconic-wings', actorId: 'armored', active: true,
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('runs Draconic Presence saves at turn start and ends its conditions with concentration', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 18, proficiencyBonus: 6,
      abilities: { ...abilities, cha: 18 },
      classResources: { 'dnd5e-sorcery-points': { current: 18, max: 18 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm', draconicPresenceSourceIds: ['sorcerer'], savingThrowBonuses: { wis: 0 },
    })
    const activated = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('presence', [sorcerer, enemy]), {
      type: 'sorcerer-draconic-presence', actorId: 'sorcerer', mode: 'fear',
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    expect(activated.state.combatants.sorcerer).toMatchObject({
      concentrating: true,
      classResources: { 'dnd5e-sorcery-points': { current: 13, max: 18 } },
      classState: { concentrationSpellId: 'class:draconic-presence:fear', concentrationRoundsRemaining: 10 },
    })
    const turnStarted = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'sorcerer' })
    expect(turnStarted.ok).toBe(true)
    if (!turnStarted.ok) return
    expect(turnStarted.events).toContainEqual({
      type: 'draconic-presence-save-required', targetId: 'enemy', sourceId: 'sorcerer', mode: 'fear', dc: 18,
    })
    const failed = resolveDnd5eHeadlessAction(turnStarted.state, {
      type: 'sorcerer-draconic-presence-save', actorId: 'enemy', sourceId: 'sorcerer', d20: 1,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.enemy.conditions).toContain('frightened')
    expect(failed.state.combatants.enemy.classState.concentrationEffectsBySource).toEqual({
      sorcerer: 'class:draconic-presence:fear',
    })

    const concentrationEnded = resolveDnd5eHeadlessAction(failed.state, {
      type: 'concentration-save', actorId: 'sorcerer', d20: 1, dc: 10,
    })
    expect(concentrationEnded.ok).toBe(true)
    if (!concentrationEnded.ok) return
    expect(concentrationEnded.state.combatants.sorcerer.concentrating).toBe(false)
    expect(concentrationEnded.state.combatants.enemy.conditions).not.toContain('frightened')
  })

  it('does not register Draconic Presence against an immune creature', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 18, proficiencyBonus: 6,
      abilities: { ...abilities, cha: 18 },
      classResources: { 'dnd5e-sorcery-points': { current: 18, max: 18 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm', draconicPresenceSourceIds: ['sorcerer'], savingThrowBonuses: { wis: 0 },
      conditionImmunities: ['frightened'],
    })
    const activated = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('presence-immunity', [sorcerer, enemy]), {
      type: 'sorcerer-draconic-presence', actorId: 'sorcerer', mode: 'fear',
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    const turnStarted = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'sorcerer' })
    expect(turnStarted.ok).toBe(true)
    if (!turnStarted.ok) return
    expect(turnStarted.events).not.toContainEqual(expect.objectContaining({
      type: 'draconic-presence-save-required', targetId: 'enemy',
    }))
    expect(turnStarted.state.combatants.enemy.conditions).not.toContain('frightened')
    expect(turnStarted.state.combatants.enemy.classState.concentrationEffectsBySource).toBeUndefined()
    expect(turnStarted.state.combatants.sorcerer.classState.concentrationTargetIds).toEqual([])
  })

  it('converts sorcery points and spell slots in both directions as bonus actions', () => {
    const sorcerer = fighter('s', 20, { classId: 'sorcerer', level: 5, classResources: {
      'dnd5e-sorcery-points': { current: 5, max: 5 },
      'dnd5e-spell-slot-2': { current: 1, max: 3 },
    } })
    const state = startDnd5eHeadlessCombat('create', [sorcerer, fighter('x', 10)])
    const created = resolveDnd5eHeadlessAction(state, { type: 'sorcerer-create-spell-slot', actorId: 's', slotLevel: 2 })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.state.combatants.s.classResources).toMatchObject({
      'dnd5e-sorcery-points': { current: 2, max: 5 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    })

    const convertSorcerer = fighter('s', 20, { classId: 'sorcerer', level: 5, classResources: {
      'dnd5e-sorcery-points': { current: 1, max: 5 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    } })
    const convertState = startDnd5eHeadlessCombat('convert', [convertSorcerer, fighter('x', 10)])
    const converted = resolveDnd5eHeadlessAction(convertState, { type: 'sorcerer-convert-spell-slot', actorId: 's', slotLevel: 2 })
    expect(converted.ok).toBe(true)
    if (!converted.ok) return
    expect(converted.state.combatants.s.classResources).toMatchObject({
      'dnd5e-sorcery-points': { current: 3, max: 5 },
      'dnd5e-spell-slot-2': { current: 1, max: 3 },
    })
  })

  it('keeps Hunter\'s Mark in concentration state and adds 1d6 to weapon hits', () => {
    const ranger = fighter('r', 20, {
      classId: 'ranger', level: 5,
      classSelections: { 'spell-known': ['hunters-mark'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 4, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('hunters-mark', [ranger, fighter('target', 10, { controller: 'dm' })])
    const marked = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'r', targetId: 'target', spellId: 'hunters-mark', slotLevel: 1,
      effectRolls: [],
    })
    expect(marked.ok).toBe(true)
    if (!marked.ok) return
    expect(marked.state.combatants.r).toMatchObject({
      concentrating: true,
      classState: { huntersMarkTargetId: 'target' },
      classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } },
      turn: { actionAvailable: true, bonusActionAvailable: false },
    })

    const hit = resolveDnd5eHeadlessAction(marked.state, {
      type: 'attack', actorId: 'r', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'hunters-mark', rolls: [4] }],
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.target.currentHp).toBe(11)
    expect(hit.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'r', targetId: 'target', source: 'hunters-mark', amount: 4,
    })
  })

  it('moves Hunter\'s Mark from a defeated target without spending another spell slot', () => {
    const ranger = fighter('r', 20, {
      classId: 'ranger', level: 5, concentrating: true,
      classState: { huntersMarkTargetId: 'old' },
      classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('move-hunters-mark', [
      ranger,
      fighter('old', 10, { controller: 'dm', currentHp: 0 }),
      fighter('next', 5, { controller: 'dm' }),
    ])
    const moved = resolveDnd5eHeadlessAction(state, {
      type: 'ranger-move-hunters-mark', actorId: 'r', targetId: 'next',
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.r).toMatchObject({
      concentrating: true,
      classState: { huntersMarkTargetId: 'next' },
      classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } },
      turn: { bonusActionAvailable: false },
    })
  })

  it('resolves Wild Shape as an authoritative dual-HP transformation', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid', level: 2, concentrating: true,
      abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 16, cha: 10 },
      baseSavingThrowBonuses: { str: -1, dex: 2, con: 2, int: 3, wis: 5, cha: 0 },
      savingThrowBonuses: { str: -1, dex: 2, con: 2, int: 3, wis: 5, cha: 0 },
      savingThrowProficiencies: ['int', 'wis'],
      classResources: { 'dnd5e-wild-shape': { current: 2, max: 2 } },
      classSelections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] },
      magicResistance: true,
      limitedMagicImmunity: {
        kind: 'limited-magic-immunity',
        maximumSpellLevel: 6,
        advantageAboveMaximum: true,
        allowsWilling: true,
      },
    })
    const state = startDnd5eHeadlessCombat('wild-shape', [druid, fighter('enemy', 10)])
    const transformed = resolveDnd5eHeadlessAction(state, {
      type: 'druid-wild-shape', actorId: 'druid', formId: 'srd-5.1:wolf',
    })
    expect(transformed.ok).toBe(true)
    if (!transformed.ok) return
    expect(transformed.state.combatants.druid).toMatchObject({
      currentHp: 11,
      maxHp: 11,
      armorClass: 13,
      speed: 40,
      concentrating: true,
      statBlockId: 'srd-5.1:wolf',
      abilities: { str: 12, dex: 15, con: 12, int: 12, wis: 16, cha: 10 },
      savingThrowBonuses: { str: 1, dex: 2, con: 1, int: 3, wis: 5, cha: 0 },
      classState: {
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeCurrentHp: 11,
        wildShapeOriginalCurrentHp: 20,
        wildShapeOriginalMaxHp: 20,
        wildShapeRoundsRemaining: 600,
      },
      turn: { actionAvailable: false },
    })
    expect(transformed.state.combatants.druid.magicResistance).toBe(false)
    expect(transformed.state.combatants.druid.limitedMagicImmunity).toBeUndefined()
    expect(transformed.state.combatants.druid.classResources['dnd5e-wild-shape'].current).toBe(1)

    const damaged = resolveDnd5eHeadlessAction(transformed.state, {
      type: 'opportunity-attack', actorId: 'enemy', targetId: 'druid', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 20, bonus: 0, rolls: [15], type: 'slashing' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.druid).toMatchObject({
      currentHp: 16,
      maxHp: 20,
      armorClass: 16,
      speed: 30,
      statBlockId: undefined,
      abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 16, cha: 10 },
      classState: { wildShapeFormId: undefined },
    })
    expect(damaged.state.combatants.druid.magicResistance).toBe(true)
    expect(damaged.state.combatants.druid.limitedMagicImmunity).toEqual({
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    })
    expect(damaged.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'druid', stateKey: 'wild-shape', active: false,
    }))
    const overflowDamageIndex = damaged.events.findIndex((event) =>
      event.type === 'damage-applied' && event.targetId === 'druid' &&
      event.creatureFormHpBefore === 11 && event.creatureFormOverflowDamage === 4)
    const formEndIndex = damaged.events.findIndex((event) =>
      event.type === 'class-state-changed' && event.actorId === 'druid' &&
      event.stateKey === 'wild-shape' && event.active === false)
    expect(overflowDamageIndex).toBeGreaterThanOrEqual(0)
    expect(formEndIndex).toBeGreaterThan(overflowDamageIndex)
  })

  it('resolves form-breaking damage before the unsupported-airborne fall', () => {
    const druid = fighter('flyer', 20, {
      classId: 'druid', level: 8, currentHp: 65, maxHp: 65,
      classResources: { 'dnd5e-wild-shape': { current: 2, max: 2 } },
      classSelections: { 'wild-shape-known-forms': ['srd-5.1:giant-eagle'] },
      position: { x: 5, y: 0 },
    })
    const minotaur = fighter('minotaur', 10, {
      controller: 'dm', position: { x: 0, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('form-break-fall-order', [druid, minotaur])
    const transformed = resolveDnd5eHeadlessAction(state, {
      type: 'druid-wild-shape', actorId: druid.id, formId: 'srd-5.1:giant-eagle',
    })
    expect(transformed.ok, transformed.ok ? undefined : transformed.reason).toBe(true)
    if (!transformed.ok) return
    const airborne = structuredClone(transformed.state)
    const flyer = airborne.combatants[druid.id]!
    flyer.currentHp = 15
    flyer.classState.wildShapeCurrentHp = 15
    flyer.elevationFeet = 40
    flyer.groundElevationFeet = 0
    flyer.airborne = true
    airborne.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(minotaur.id, druid.id)]: 5,
    }

    const resolved = resolveDnd5eHeadlessAction(airborne, {
      type: 'opportunity-attack', actorId: minotaur.id, targetId: druid.id,
      attackModifier: 6, d20: 15,
      damage: { count: 1, sides: 20, bonus: 2, rolls: [20], type: 'slashing' },
      airborneFallDamageRollsByCombatantId: { [druid.id]: [5, 1, 2, 2] },
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[druid.id]).toMatchObject({
      currentHp: 48,
      maxHp: 65,
      elevationFeet: 0,
      groundElevationFeet: 0,
      airborne: false,
      classState: { wildShapeFormId: undefined },
    })

    const attackDamageIndex = resolved.events.findIndex((event) =>
      event.type === 'damage-applied' && event.targetId === druid.id &&
      event.amount === 22 && event.creatureFormOverflowDamage === 7)
    const formEndIndexes = resolved.events.flatMap((event, index) =>
      event.type === 'class-state-changed' && event.actorId === druid.id &&
      event.stateKey === 'wild-shape' && event.active === false ? [index] : [])
    const fallDamageIndex = resolved.events.findIndex((event) =>
      event.type === 'damage-applied' && event.targetId === druid.id &&
      event.amount === 10 && event.hpBefore === 58 && event.hpAfter === 48)
    const fallingResolvedIndex = resolved.events.findIndex((event) =>
      event.type === 'falling-damage-resolved' && event.actorId === druid.id)

    expect(attackDamageIndex).toBeGreaterThanOrEqual(0)
    expect(formEndIndexes).toHaveLength(1)
    expect(formEndIndexes[0]).toBeGreaterThan(attackDamageIndex)
    expect(fallDamageIndex).toBeGreaterThan(formEndIndexes[0]!)
    expect(fallingResolvedIndex).toBeGreaterThan(fallDamageIndex)
  })

  it('uses a bonus action to end Wild Shape and grants Archdruid unlimited uses', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid', level: 20,
      classSelections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] },
    })
    const state = startDnd5eHeadlessCombat('archdruid', [druid, fighter('enemy', 10)])
    const transformed = resolveDnd5eHeadlessAction(state, {
      type: 'druid-wild-shape', actorId: 'druid', formId: 'srd-5.1:wolf',
    })
    expect(transformed.ok).toBe(true)
    if (!transformed.ok) return
    expect(transformed.state.combatants.druid.classResources['dnd5e-wild-shape']).toBeUndefined()
    const reverted = resolveDnd5eHeadlessAction(transformed.state, { type: 'druid-end-wild-shape', actorId: 'druid' })
    expect(reverted.ok).toBe(true)
    if (!reverted.ok) return
    expect(reverted.state.combatants.druid).toMatchObject({
      currentHp: 20,
      maxHp: 20,
      classState: { wildShapeFormId: undefined },
      turn: { bonusActionAvailable: false },
    })
  })

  it('lets a spellcaster end their own Polymorph concentration without spending a bonus action', () => {
    const caster = fighter('wizard', 20, {
      classId: 'wizard',
      currentHp: 11,
      maxHp: 11,
      armorClass: 13,
      speed: 40,
      concentrating: true,
      statBlockId: 'srd-5.1:wolf',
      classState: {
        concentrationSpellId: 'polymorph',
        concentrationRoundsRemaining: 600,
        concentrationTargetIds: ['wizard'],
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeMode: 'polymorph',
        wildShapeSourceActorId: 'wizard',
        wildShapeSourceActivityId: 'polymorph',
        wildShapeCurrentHp: 11,
        wildShapeRoundsRemaining: 600,
        wildShapeOriginalCurrentHp: 20,
        wildShapeOriginalMaxHp: 20,
        wildShapeOriginalArmorClass: 16,
        wildShapeOriginalSpeed: 30,
        wildShapeOriginalMovementSpeeds: { walk: 30 },
        wildShapeOriginalAbilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      },
    })
    const state = startDnd5eHeadlessCombat('polymorph-voluntary-end', [caster, fighter('enemy', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'druid-end-wild-shape', actorId: 'wizard' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.wizard).toMatchObject({
      currentHp: 20,
      maxHp: 20,
      armorClass: 16,
      speed: 30,
      concentrating: false,
      classState: {
        concentrationSpellId: undefined,
        wildShapeFormId: undefined,
      },
      turn: { bonusActionAvailable: true },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'wizard', stateKey: 'creature-form:polymorph', active: false,
    }))
    expect(result.events).toContainEqual({
      type: 'class-state-changed', actorId: 'wizard', stateKey: 'concentration', active: false,
    })
    expect(result.events).not.toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', resource: 'bonusAction',
    }))
  })

  it('does not let a Polymorph target end another caster\'s concentration', () => {
    const target = fighter('target', 20, {
      currentHp: 11,
      maxHp: 11,
      statBlockId: 'srd-5.1:wolf',
      classState: {
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeMode: 'polymorph',
        wildShapeSourceActorId: 'caster',
        wildShapeSourceActivityId: 'polymorph',
        wildShapeCurrentHp: 11,
        wildShapeOriginalCurrentHp: 20,
        wildShapeOriginalMaxHp: 20,
      },
    })
    const state = startDnd5eHeadlessCombat('polymorph-target-end', [target, fighter('caster', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'druid-end-wild-shape', actorId: 'target' })

    expect(result).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('repairs an orphaned Polymorph form after its source concentration already ended', () => {
    const target = fighter('target', 20, {
      currentHp: 11,
      maxHp: 11,
      statBlockId: 'srd-5.1:wolf',
      classState: {
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeMode: 'polymorph',
        wildShapeSourceActorId: 'caster',
        wildShapeSourceActivityId: 'polymorph',
        wildShapeCurrentHp: 11,
        wildShapeOriginalCurrentHp: 20,
        wildShapeOriginalMaxHp: 20,
        wildShapeOriginalArmorClass: 16,
        wildShapeOriginalSpeed: 30,
        wildShapeOriginalMovementSpeeds: { walk: 30 },
        wildShapeOriginalAbilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      },
    })
    const state = startDnd5eHeadlessCombat('orphaned-polymorph', [target, fighter('caster', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'dodge', actorId: 'target' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target).toMatchObject({
      currentHp: 20,
      maxHp: 20,
      armorClass: 16,
      speed: 30,
      statBlockId: undefined,
      classState: { wildShapeFormId: undefined },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'target', stateKey: 'creature-form:polymorph', active: false,
    }))
  })

  it('lets an untransformed caster end Polymorph on another target', () => {
    const caster = fighter('caster', 20, {
      classId: 'wizard',
      concentrating: true,
      classState: {
        concentrationSpellId: 'activity:spell:srd-5.1:polymorph',
        concentrationRoundsRemaining: 600,
        concentrationTargetIds: ['target'],
      },
    })
    const target = fighter('target', 10, {
      currentHp: 11,
      maxHp: 11,
      statBlockId: 'srd-5.1:wolf',
      classState: {
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeMode: 'polymorph',
        wildShapeSourceActorId: 'caster',
        wildShapeSourceActivityId: 'activity:spell:srd-5.1:polymorph',
        wildShapeCurrentHp: 11,
        wildShapeOriginalCurrentHp: 20,
        wildShapeOriginalMaxHp: 20,
      },
    })
    const state = startDnd5eHeadlessCombat('polymorph-other-target-end', [caster, target])
    const result = resolveDnd5eHeadlessAction(state, { type: 'druid-end-wild-shape', actorId: 'caster' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.caster.concentrating).toBe(false)
    expect(result.state.combatants.caster.turn.bonusActionAvailable).toBe(true)
    expect(result.state.combatants.target).toMatchObject({
      currentHp: 20,
      maxHp: 20,
      classState: { wildShapeFormId: undefined },
    })
  })

  it('applies deterministic SRD subclass passives in Headless', () => {
    const champion = fighter('champion', 10, {
      classId: 'fighter', subclassId: 'champion', level: 18, currentHp: 8, maxHp: 20,
    })
    const turnState = startDnd5eHeadlessCombat('survivor', [fighter('active', 20), champion])
    const nextTurn = resolveDnd5eHeadlessAction(turnState, { type: 'end-turn', actorId: 'active' })
    expect(nextTurn.ok).toBe(true)
    if (!nextTurn.ok) return
    expect(nextTurn.state.combatants.champion.currentHp).toBe(15)
    expect(nextTurn.events).toContainEqual({
      type: 'healing-applied', targetId: 'champion', amount: 7, hpBefore: 8, hpAfter: 15,
    })

    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6,
      abilities: { ...abilities, cha: 18 },
    })
    const fiendState = startDnd5eHeadlessCombat('fiend', [warlock, fighter('target', 10, { controller: 'dm', currentHp: 5 })])
    const killed = resolveDnd5eHeadlessAction(fiendState, {
      type: 'attack', actorId: 'warlock', targetId: 'target', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
    })
    expect(killed.ok).toBe(true)
    if (!killed.ok) return
    expect(killed.state.combatants.warlock.temporaryHp).toBe(10)
    expect(killed.events).toContainEqual({
      type: 'temporary-hit-points-gained', actorId: 'warlock', amount: 10, offered: 10, current: 10,
    })
  })

  it('applies Life Domain healing and Divine Strike', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', subclassId: 'life', level: 17, currentHp: 10,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-prepared': ['cure-wounds'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('life-healing', [cleric, fighter('ally', 10, { currentHp: 1 })])
    const healed = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'cleric', targetId: 'ally', spellId: 'cure-wounds', slotLevel: 1, effectRolls: [1],
    })
    expect(healed.ok).toBe(true)
    if (!healed.ok) return
    expect(healed.state.combatants.ally.currentHp).toBe(15)
    expect(healed.state.combatants.cleric.currentHp).toBe(13)

    const upcastCleric = fighter('upcast-cleric', 20, {
      classId: 'cleric', subclassId: 'life', level: 6, currentHp: 10,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-prepared': ['cure-wounds'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const upcastState = startDnd5eHeadlessCombat('life-upcast', [
      upcastCleric,
      fighter('upcast-ally', 10, { currentHp: 1, maxHp: 40 }),
    ])
    const upcast = resolveDnd5eHeadlessAction(upcastState, {
      type: 'cast-spell', actorId: 'upcast-cleric', targetId: 'upcast-ally',
      spellId: 'cure-wounds', slotLevel: 3, effectRolls: [1, 2, 3],
    })
    expect(upcast.ok).toBe(true)
    if (!upcast.ok) return
    // 1+2+3 + Wis 3 + Disciple of Life (2+slot 3) = 14; Blessed Healer returns 5.
    expect(upcast.state.combatants['upcast-ally'].currentHp).toBe(15)
    expect(upcast.state.combatants['upcast-cleric'].currentHp).toBe(15)

    const poolCleric = fighter('pool-cleric', 20, {
      classId: 'cleric', subclassId: 'life', level: 17, currentHp: 1,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-prepared': ['mass-heal'] },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const first = fighter('first', 10, { currentHp: 1, maxHp: 100 })
    const second = fighter('second', 5, { currentHp: 1, maxHp: 100 })
    const zeroAllocation = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('zero-allocation', [poolCleric, first, second]), {
      type: 'cast-spell', actorId: 'pool-cleric', targetId: 'first', targetIds: ['first', 'second'],
      spellId: 'mass-heal', slotLevel: 9, effectRolls: [],
      healingAllocations: [{ targetId: 'first', amount: 10 }, { targetId: 'second', amount: 0 }],
    })
    expect(zeroAllocation).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const pooled = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blessed-healer-once', [poolCleric, first, second]), {
      type: 'cast-spell', actorId: 'pool-cleric', targetId: 'first', targetIds: ['first', 'second'],
      spellId: 'mass-heal', slotLevel: 9, effectRolls: [],
      healingAllocations: [{ targetId: 'first', amount: 10 }, { targetId: 'second', amount: 10 }],
    })
    expect(pooled.ok).toBe(true)
    if (!pooled.ok) return
    expect(pooled.state.combatants['pool-cleric'].currentHp).toBe(12)
    expect(pooled.state.combatants.first.currentHp).toBe(22)
    expect(pooled.state.combatants.second.currentHp).toBe(22)

    const striker = fighter('cleric', 20, { classId: 'cleric', subclassId: 'life', level: 14 })
    const strikeState = startDnd5eHeadlessCombat('divine-strike', [striker, fighter('enemy', 10, { controller: 'dm' })])
    const struck = resolveDnd5eHeadlessAction(strikeState, {
      type: 'attack', actorId: 'cleric', targetId: 'enemy', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'divine-strike', rolls: [3, 3] }],
    })
    expect(struck.ok).toBe(true)
    if (!struck.ok) return
    expect(struck.state.combatants.enemy.currentHp).toBe(10)
    expect(struck.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'cleric', targetId: 'enemy', source: 'divine-strike', amount: 6,
    })
  })

  it('adds Draconic Affinity and Empowered Evocation once per spell damage roll', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 6,
      abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'], 'dragon-ancestor': ['red-fire'] },
    })
    const sorcererState = startDnd5eHeadlessCombat('affinity', [sorcerer, fighter('target', 10, { controller: 'dm' })])
    const affinity = resolveDnd5eHeadlessAction(sorcererState, {
      type: 'cast-spell', actorId: 'sorcerer', targetId: 'target', spellId: 'fire-bolt', slotLevel: 0,
      d20: 10, effectRolls: [5, 5],
    })
    expect(affinity.ok).toBe(true)
    if (!affinity.ok) return
    expect(affinity.state.combatants.target.currentHp).toBe(6)

    const wizard = fighter('wizard', 20, {
      classId: 'wizard', subclassId: 'evocation', level: 10,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const wizardState = startDnd5eHeadlessCombat('empowered', [wizard, fighter('target', 10, { controller: 'dm' })])
    const empowered = resolveDnd5eHeadlessAction(wizardState, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'fire-bolt', slotLevel: 0,
      d20: 10, effectRolls: [5, 5],
    })
    expect(empowered.ok).toBe(true)
    if (!empowered.ok) return
    expect(empowered.state.combatants.target.currentHp).toBe(6)
  })

  it('emits Magic Missile dice, per-projectile damage, total damage, and Empowered Evocation source', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', subclassId: 'evocation', level: 10,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['magic-missile'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      currentHp: 50,
      maxHp: 50,
    })
    const resolved = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('magic-missile-log', [wizard, target]),
      {
        type: 'cast-spell',
        actorId: wizard.id,
        targetId: target.id,
        targetIds: [target.id],
        projectileTargetIds: [target.id, target.id, target.id, target.id, target.id],
        spellId: 'magic-missile',
        slotLevel: 3,
        effectRolls: [4, 3, 2, 1, 4],
      },
    )

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.target.currentHp).toBe(27)
    expect(resolved.events).toContainEqual({
      type: 'spell-damage-feature-bonus-applied',
      actorId: wizard.id,
      spellId: 'magic-missile',
      featureId: 'evocation-empowered',
      ability: 'int',
      amount: 4,
      application: 'first-projectile',
    })
    expect(resolved.events).toContainEqual({
      type: 'magic-missile-damage-resolved',
      actorId: wizard.id,
      spellId: 'magic-missile',
      slotLevel: 3,
      dieSides: 4,
      baseBonusPerProjectile: 1,
      projectiles: [
        {
          targetId: target.id,
          dieRoll: 4,
          featureBonus: 4,
          cuttingWordsReduction: 0,
          damageBeforeDefenses: 9,
          finalDamage: 9,
          outcome: 'damage',
        },
        {
          targetId: target.id,
          dieRoll: 3,
          featureBonus: 0,
          cuttingWordsReduction: 0,
          damageBeforeDefenses: 4,
          finalDamage: 4,
          outcome: 'damage',
        },
        {
          targetId: target.id,
          dieRoll: 2,
          featureBonus: 0,
          cuttingWordsReduction: 0,
          damageBeforeDefenses: 3,
          finalDamage: 3,
          outcome: 'damage',
        },
        {
          targetId: target.id,
          dieRoll: 1,
          featureBonus: 0,
          cuttingWordsReduction: 0,
          damageBeforeDefenses: 2,
          finalDamage: 2,
          outcome: 'damage',
        },
        {
          targetId: target.id,
          dieRoll: 4,
          featureBonus: 0,
          cuttingWordsReduction: 0,
          damageBeforeDefenses: 5,
          finalDamage: 5,
          outcome: 'damage',
        },
      ],
      totalDamage: 23,
    })
  })

  it('expires Draconic Elemental Affinity resistance after its last remaining turn', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 6,
      classState: { draconicResistanceType: 'fire', draconicResistanceRoundsRemaining: 1 },
    })
    const state = startDnd5eHeadlessCombat('draconic-resistance-expiry', [sorcerer, fighter('enemy', 10)])
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'sorcerer' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.sorcerer.classState.draconicResistanceType).toBeUndefined()
    expect(ended.state.combatants.sorcerer.classState.draconicResistanceRoundsRemaining).toBeUndefined()
    expect(ended.events).toContainEqual({
      type: 'class-state-changed', actorId: 'sorcerer', stateKey: 'draconic-resistance', active: false,
    })
  })

  it('expires Sacred Weapon after ten of the Paladin\'s turns', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', subclassId: 'devotion', level: 3,
      classState: { sacredWeaponTurnsRemaining: 1 },
    })
    const state = startDnd5eHeadlessCombat('sacred-weapon', [paladin, fighter('enemy', 10)])
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'paladin' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.paladin.classState.sacredWeaponTurnsRemaining).toBeUndefined()
    expect(ended.events).toContainEqual({
      type: 'class-state-changed', actorId: 'paladin', stateKey: 'sacred-weapon', active: false,
    })
  })

  it('applies Hunter Multiattack Defense after the first hit from a creature', () => {
    const owlbear = fighter('owlbear', 20, {
      controller: 'dm', statBlockId: 'srd-5.1:owlbear', currentHp: 59, maxHp: 59,
    })
    const hunter = fighter('hunter', 10, {
      classId: 'ranger', subclassId: 'hunter', level: 7,
      classSelections: { 'defensive-tactics': ['multiattack-defense'] },
    })
    const state = startDnd5eHeadlessCombat('multiattack-defense', [owlbear, hunter])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action', actorId: 'owlbear', actionId: 'multiattack',
      rolls: [
        { targetId: 'hunter', d20: 10, damageRolls: [[5]] },
        { targetId: 'hunter', d20: 10, damageRolls: [] },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toEqual([
      expect.objectContaining({ targetId: 'hunter', armorClass: 16, hit: true }),
      expect.objectContaining({ targetId: 'hunter', armorClass: 20, hit: false }),
    ])
    expect(result.state.combatants.hunter.currentHp).toBe(10)
  })

  it('resolves Empty Body invisibility and non-force resistance for a level-18 Monk', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', level: 18,
      classResources: { 'dnd5e-ki': { current: 18, max: 18 } },
    })
    const owlbear = fighter('owlbear', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:owlbear', currentHp: 59, maxHp: 59,
    })
    const state = startDnd5eHeadlessCombat('empty-body', [monk, owlbear])
    const activated = resolveDnd5eHeadlessAction(state, { type: 'monk-empty-body', actorId: 'monk' })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    expect(activated.state.combatants.monk).toMatchObject({
      classResources: { 'dnd5e-ki': { current: 14, max: 18 } },
      classState: { emptyBodyRoundsRemaining: 10 },
      turn: { actionAvailable: false },
    })
    const ended = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'monk' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const hit = resolveDnd5eHeadlessAction(ended.state, {
      type: 'monster-action', actorId: 'owlbear', actionId: 'beak',
      rolls: [{ targetId: 'monk', d20: 20, d20Second: 20, mode: 'normal', damageRolls: [[5, 5]] }],
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', targetId: 'monk', d20: 20, hit: true,
    }))
    expect(hit.state.combatants.monk.currentHp).toBe(13)
  })

  it('resolves Relentless Rage saves and raises the DC until a rest', () => {
    const barbarian = fighter('barbarian', 10, {
      controller: 'player', classId: 'barbarian', level: 11, currentHp: 5,
      classState: { raging: true, rageTurnsRemaining: 10 },
      savingThrowBonuses: { con: 2 },
    })
    const state = startDnd5eHeadlessCombat('relentless-rage', [
      fighter('enemy-1', 20, { controller: 'dm' }), barbarian,
      fighter('enemy-2', 5, { controller: 'dm' }), fighter('enemy-3', 1, { controller: 'dm' }),
    ])
    const firstDrop = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy-1', targetId: 'barbarian', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'slashing' },
    })
    expect(firstDrop.ok).toBe(true)
    if (!firstDrop.ok) return
    expect(firstDrop.events).toContainEqual({ type: 'relentless-rage-save-required', targetId: 'barbarian', dc: 10 })
    const firstSave = resolveDnd5eHeadlessAction(firstDrop.state, {
      type: 'barbarian-relentless-rage-save', actorId: 'barbarian', d20: 8, dc: 10,
    })
    expect(firstSave.ok).toBe(true)
    if (!firstSave.ok) return
    expect(firstSave.state.combatants.barbarian).toMatchObject({
      currentHp: 1, classState: { raging: true, relentlessRageDc: 15 },
    })

    const secondDrop = resolveDnd5eHeadlessAction(firstSave.state, {
      type: 'opportunity-attack', actorId: 'enemy-2', targetId: 'barbarian', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [2], type: 'slashing' },
    })
    expect(secondDrop.ok).toBe(true)
    if (!secondDrop.ok) return
    expect(secondDrop.events).toContainEqual({ type: 'relentless-rage-save-required', targetId: 'barbarian', dc: 15 })
    const failed = resolveDnd5eHeadlessAction(secondDrop.state, {
      type: 'barbarian-relentless-rage-save', actorId: 'barbarian', d20: 1, dc: 15,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.barbarian).toMatchObject({
      currentHp: 0, concentrating: false, classState: { raging: undefined },
    })
  })

  it('applies Fiendish Resilience and Lifedrinker for the selected Warlock build', () => {
    const enemy = fighter('enemy', 20, { controller: 'dm' })
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 12,
      abilities: { ...abilities, cha: 18 },
      classSelections: {
        'fiendish-resilience': ['fire'],
        'pact-boon': ['blade'],
        'eldritch-invocations': ['lifedrinker'],
      },
    })
    const state = startDnd5eHeadlessCombat('fiendish-resilience', [enemy, warlock])
    const resisted = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'warlock', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'fire' },
    })
    expect(resisted.ok).toBe(true)
    if (!resisted.ok) return
    expect(resisted.state.combatants.warlock.currentHp).toBe(15)

    const warlockTurn = startDnd5eHeadlessCombat('lifedrinker', [warlock, enemy])
    const struck = resolveDnd5eHeadlessAction(warlockTurn, {
      type: 'attack', actorId: 'warlock', targetId: 'enemy', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'lifedrinker', rolls: [] }],
    })
    expect(struck.ok).toBe(true)
    if (!struck.ok) return
    expect(struck.state.combatants.enemy.currentHp).toBe(12)
    expect(struck.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'warlock', targetId: 'enemy', source: 'lifedrinker', amount: 4,
    })
  })

  it('uses Open Hand Tranquility as a Sanctuary save before a targeted attack', () => {
    const attacker = fighter('attacker', 20, { savingThrowBonuses: { wis: 1 } })
    const monk = fighter('monk', 10, {
      classId: 'monk', subclassId: 'open-hand', level: 11,
      abilities: { ...abilities, wis: 16 },
      proficiencyBonus: 4,
      classState: { tranquilityActive: true },
    })
    const blocked = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('tranquility-blocked', [attacker, monk]), {
      type: 'attack', actorId: 'attacker', targetId: 'monk', attackModifier: 20, d20: 20,
      tranquilitySave: { d20: 5 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.combatants.attacker.turn.actionAvailable).toBe(false)
    expect(blocked.state.combatants.monk.currentHp).toBe(20)
    expect(blocked.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'attacker', ability: 'wis', dc: 15, success: false,
    }))
    expect(blocked.events).toContainEqual({
      type: 'hostile-targeting-prevented', actorId: 'attacker', targetId: 'monk', source: 'tranquility',
    })
    expect(blocked.events.some((event) => event.type === 'attack-resolved')).toBe(false)

    const passed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('tranquility-passed', [attacker, monk]), {
      type: 'attack', actorId: 'attacker', targetId: 'monk', attackModifier: 20, d20: 10,
      tranquilitySave: { d20: 20 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(passed.ok).toBe(true)
    if (!passed.ok) return
    expect(passed.state.combatants.monk.currentHp).toBe(12)
    expect(passed.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'attacker', ability: 'wis', success: true,
    }))
  })

  it('uses a Sanctuary spell effect for targeting saves and ends it when the warded creature attacks', () => {
    const attacker = fighter('attacker', 20, { savingThrowBonuses: { wis: 1 } })
    const warded = fighter('warded', 10, {
      classState: {
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:sanctuary',
          label: '庇护术',
          targetId: 'warded',
          source: { kind: 'spell', actorId: 'cleric', rulesId: 'sanctuary' },
          duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
          potency: 15,
        })],
      },
    })
    const blocked = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('sanctuary-blocked', [attacker, warded]), {
      type: 'attack', actorId: 'attacker', targetId: 'warded', attackModifier: 20, d20: 20,
      tranquilitySave: { d20: 5 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.combatants.warded.currentHp).toBe(20)
    expect(blocked.events).toContainEqual({
      type: 'hostile-targeting-prevented',
      actorId: 'attacker',
      targetId: 'warded',
      source: 'sanctuary',
    })

    const wardedTurn = startDnd5eHeadlessCombat('sanctuary-break', [
      { ...warded, initiative: 30 },
      attacker,
    ])
    const struck = resolveDnd5eHeadlessAction(wardedTurn, {
      type: 'attack', actorId: 'warded', targetId: 'attacker', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(struck.ok).toBe(true)
    if (!struck.ok) return
    expect(struck.state.combatants.warded.classState.activeEffects).toBeUndefined()
    expect(struck.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      definitionId: 'srd-5.1:spell:sanctuary',
      reason: 'makes-attack',
    }))
  })

  it("uses the Land druid's Nature's Sanctuary only against beast or plant attacks", () => {
    const beast = fighter('beast', 20, {
      controller: 'dm', creatureType: '野兽', savingThrowBonuses: { wis: 1 },
    })
    const druid = fighter('druid', 10, {
      classId: 'druid', subclassId: 'land', level: 14,
      abilities: { ...abilities, wis: 16 }, proficiencyBonus: 4,
    })
    const blocked = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('nature-sanctuary-blocked', [beast, druid]), {
      type: 'attack', actorId: 'beast', targetId: 'druid', attackModifier: 20, d20: 20,
      tranquilitySave: { d20: 5 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.combatants.druid.currentHp).toBe(20)
    expect(blocked.events).toContainEqual({
      type: 'hostile-targeting-prevented', actorId: 'beast', targetId: 'druid', source: 'nature-sanctuary',
    })

    const passed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('nature-sanctuary-passed', [beast, druid]), {
      type: 'attack', actorId: 'beast', targetId: 'druid', attackModifier: 20, d20: 10,
      spendAction: false, tranquilitySave: { d20: 20 },
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(passed.ok).toBe(true)
    if (!passed.ok) return
    expect(passed.state.combatants.beast.classState.natureSanctuaryImmunityRoundsByTarget?.druid).toBe(14_400)
    expect(passed.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', stateKey: 'nature-sanctuary-immunity', active: true, value: 14_400,
    }))
    const immuneAttack = resolveDnd5eHeadlessAction(passed.state, {
      type: 'attack', actorId: 'beast', targetId: 'druid', attackModifier: 20, d20: 10,
      spendAction: false,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(immuneAttack.ok).toBe(true)
    if (!immuneAttack.ok) return
    expect(immuneAttack.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)

    const humanoid = fighter('humanoid', 20, { controller: 'dm', creatureType: '类人生物' })
    const ordinaryAttack = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('nature-sanctuary-ineligible', [humanoid, druid]), {
      type: 'attack', actorId: 'humanoid', targetId: 'druid', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(ordinaryAttack.ok).toBe(true)
    if (!ordinaryAttack.ok) return
    expect(ordinaryAttack.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)
  })

  it('ends the Open Hand Tranquility ward when the monk makes an attack', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', subclassId: 'open-hand', level: 11,
      classState: { tranquilityActive: true },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('tranquility-ends', [monk, enemy]), {
      type: 'attack', actorId: 'monk', targetId: 'enemy', attackModifier: 5, d20: 1,
      damage: { count: 1, sides: 6, bonus: 3, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monk.classState.tranquilityActive).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'class-state-changed', actorId: 'monk', stateKey: 'tranquility', active: false,
    })
  })

  it('grants advantage for an attack from hiding and then reveals the attacker', () => {
    const rogue = fighter('rogue', 20, {
      classId: 'rogue', subclassId: 'thief', level: 9,
      classState: { hiddenCheckTotal: 22 },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hidden-attack', [rogue, enemy]), {
      type: 'attack', actorId: 'rogue', targetId: 'enemy', attackModifier: 5,
      d20: 2, d20Second: 18,
      damage: { count: 1, sides: 6, bonus: 3, rolls: [4] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'rogue', d20: 18, hit: true,
    }))
    expect(result.state.combatants.rogue.classState.hiddenCheckTotal).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'class-state-changed', actorId: 'rogue', stateKey: 'hidden', active: false,
    })
  })

  it('applies Blight immunity and the plant disadvantage/maximum-damage rule', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, proficiencyBonus: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['blight'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const plant = fighter('plant', 10, { controller: 'dm', creatureType: '植物', currentHp: 100, maxHp: 100 })
    const plantResult = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blight-plant', [wizard, plant]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'plant', spellId: 'blight', slotLevel: 4,
      savingThrowD20: 20, savingThrowD20Second: 1, effectRolls: Array(8).fill(1),
    })
    expect(plantResult.ok).toBe(true)
    if (!plantResult.ok) return
    expect(plantResult.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'plant', d20: 1, success: false,
    }))
    expect(plantResult.state.combatants.plant.currentHp).toBe(36)

    const secondWizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, proficiencyBonus: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['blight'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const undead = fighter('undead', 10, { controller: 'dm', creatureType: '亡灵', currentHp: 80, maxHp: 80 })
    const immuneResult = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blight-undead', [secondWizard, undead]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'undead', spellId: 'blight', slotLevel: 4,
      savingThrowD20: 1, effectRolls: Array(8).fill(8),
    })
    expect(immuneResult.ok).toBe(true)
    if (!immuneResult.ok) return
    expect(immuneResult.state.combatants.undead.currentHp).toBe(80)
  })

  it('resolves Harm damage, the 1 HP floor, and its timed maximum-HP reduction', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 11, proficiencyBonus: 4,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['harm'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm', currentHp: 20, maxHp: 80,
    })
    const failed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('harm-failed-save', [cleric, target]),
      {
        type: 'cast-spell', actorId: cleric.id, targetId: target.id,
        spellId: 'harm', slotLevel: 6, savingThrowD20: 1,
        effectRolls: Array(14).fill(4),
      },
    )
    expect(failed.ok, failed.ok ? undefined : failed.reason).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.target.currentHp).toBe(1)
    expect(failed.state.combatants.target.maxHp).toBe(24)
    expect(failed.state.combatants.target.classState.hitPointMaximumReductionLedger)
      .toMatchObject({
        baseMaximum: 80,
        entries: [{
          amount: 56,
          remainingRounds: 600,
          recovery: 'greater-restoration-or-other-magic',
        }],
      })
    expect(failed.events).toContainEqual(expect.objectContaining({
      type: 'hit-point-maximum-reduced',
      sourceId: cleric.id,
      targetId: target.id,
      amount: 56,
      maximumBefore: 80,
      maximumAfter: 24,
      durationRounds: 600,
    }))

    const secondCleric = fighter('cleric', 20, {
      classId: 'cleric', level: 11, proficiencyBonus: 4,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['harm'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const savedTarget = fighter('target', 10, {
      controller: 'dm', currentHp: 20, maxHp: 80,
      savingThrowBonuses: { con: 20 },
    })
    const saved = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('harm-successful-save', [secondCleric, savedTarget]),
      {
        type: 'cast-spell', actorId: secondCleric.id, targetId: savedTarget.id,
        spellId: 'harm', slotLevel: 6, savingThrowD20: 1,
        effectRolls: Array(14).fill(4),
      },
    )
    expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
    if (!saved.ok) return
    expect(saved.state.combatants.target.currentHp).toBe(1)
    expect(saved.state.combatants.target.maxHp).toBe(80)
    expect(saved.state.combatants.target.classState.hitPointMaximumReductionLedger).toBeUndefined()

    const upcastCleric = fighter('upcast-cleric', 20, {
      classId: 'cleric', level: 13, proficiencyBonus: 5,
      abilities: { ...abilities, wis: 20 },
      classSelections: { 'spell-prepared': ['harm'] },
      classResources: { 'dnd5e-spell-slot-7': { current: 1, max: 1 } },
    })
    const upcastTarget = fighter('upcast-target', 10, {
      controller: 'dm', currentHp: 80, maxHp: 80,
    })
    const upcast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('harm-seventh-level', [upcastCleric, upcastTarget]),
      {
        type: 'cast-spell', actorId: upcastCleric.id, targetId: upcastTarget.id,
        spellId: 'harm', slotLevel: 7, savingThrowD20: 1,
        effectRolls: Array(14).fill(2),
      },
    )
    expect(upcast.ok, upcast.ok ? undefined : upcast.reason).toBe(true)
    if (!upcast.ok) return
    expect(upcast.state.combatants[upcastCleric.id]
      .classResources['dnd5e-spell-slot-7'].current).toBe(0)
    expect(upcast.state.combatants[upcastTarget.id]).toMatchObject({
      currentHp: 52,
      maxHp: 52,
    })
    expect(upcast.state.combatants[upcastTarget.id].classState.hitPointMaximumReductionLedger)
      .toMatchObject({ entries: [{ amount: 28, remainingRounds: 600 }] })
  })

  it('marks a creature reduced to zero by Disintegrate as dead', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 11, proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['disintegrate'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:zombie', usesDeathSaves: false,
      currentHp: 30, maxHp: 30,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('disintegrate', [wizard, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'disintegrate', slotLevel: 6,
      savingThrowD20: 1, effectRolls: Array(10).fill(1),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target).toMatchObject({
      currentHp: 0,
      deathSaves: { successes: 0, failures: 3, stable: false, dead: true },
      classState: {
        bodyPresent: false,
        vitalBodyPartsMissing: true,
        activeEffects: [expect.objectContaining({
          definitionId: 'srd-5.1:spell:disintegrate:body-destroyed',
          tags: expect.arrayContaining(['disintegrated', 'body-destroyed']),
          duration: { type: 'permanent' },
        })],
      },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'instant-death', sourceId: 'wizard', targetId: 'target',
    }))
    expect(result.events.some((event) => event.type === 'undead-fortitude-save-required')).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-applied',
      targetId: 'target',
      definitionId: 'srd-5.1:spell:disintegrate:body-destroyed',
    }))
    expect(result.state.combatants.target.classState.undeadFortitudePending).toBeUndefined()
  })

  it('uses the pre-damage hit points and removes zero-HP effects for Disintegrate', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 11, proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['disintegrate'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, { controller: 'dm', usesDeathSaves: true, currentHp: 30, maxHp: 30 })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('disintegrate-player', [wizard, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'disintegrate', slotLevel: 6,
      savingThrowD20: 1, effectRolls: Array(10).fill(1),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.deathSaves).toMatchObject({ failures: 3, dead: true })
    expect(result.state.combatants.target.classState).toMatchObject({
      bodyPresent: false,
      vitalBodyPartsMissing: true,
    })
    expect(result.state.combatants.target.conditions).not.toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(result.events).toContainEqual({
      type: 'instant-death', sourceId: 'wizard', targetId: 'target', hpBefore: 30,
    })
  })

  it('scales class features from their class level after multiclassing', () => {
    const bardFighter = fighter('bard-fighter', 20, {
      classId: 'fighter', level: 15, classLevels: { fighter: 10, bard: 5 },
      classResources: { 'dnd5e-bardic-inspiration': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 10)
    const inspired = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('multiclass-bard', [bardFighter, ally]), {
      type: 'bardic-inspiration', actorId: 'bard-fighter', targetId: 'ally',
    })
    expect(inspired.ok).toBe(true)
    if (!inspired.ok) return
    expect(inspired.state.combatants.ally.classState.bardicInspirationDie).toBe(8)

    const fighterWizard = fighter('fighter-wizard', 20, {
      classId: 'fighter', level: 11, classLevels: { fighter: 1, wizard: 10 }, currentHp: 10, maxHp: 30,
      classResources: { fighterSecondWind: { current: 1, max: 1 } },
    })
    const healed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('multiclass-second-wind', [fighterWizard, fighter('enemy', 10)]), {
      type: 'fighter-second-wind', actorId: 'fighter-wizard', resourceKey: 'fighterSecondWind', d10: 5,
    })
    expect(healed.ok).toBe(true)
    if (!healed.ok) return
    expect(healed.state.combatants['fighter-wizard'].currentHp).toBe(16)
  })

  it('applies Phantasmal Killer damage on failed end-of-turn saves and ends it on success', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard',
      level: 9,
      proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['phantasmal-killer'] },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      currentHp: 100,
      maxHp: 100,
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('phantasmal-killer', [wizard, target]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'target',
        spellId: 'phantasmal-killer',
        slotLevel: 5,
        savingThrowD20: 1,
        effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    const effect = cast.state.combatants.target.classState.activeEffects?.find((entry) =>
      entry.source.rulesId === 'phantasmal-killer',
    )
    expect(effect).toMatchObject({
      standardCondition: 'frightened',
      repeatSave: {
        ability: 'wis',
        dc: 16,
        timing: 'target-turn-end',
        damageOnFailure: {
          count: 5,
          sides: 10,
          modifier: 0,
          type: 'psychic',
        },
        onSuccess: 'remove',
      },
    })
    if (!effect) return

    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf('target')
    const failed = resolveDnd5eHeadlessAction(cast.state, {
      type: 'end-turn',
      actorId: 'target',
      activeEffectSavingThrows: [{
        effectId: effect.id,
        d20: 1,
        damageRolls: [10, 10, 10, 10, 10],
      }],
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.target.currentHp).toBe(50)
    expect(failed.state.combatants.target.conditions).toContain('frightened')
    expect(failed.events).toContainEqual(expect.objectContaining({
      type: 'delayed-spell-damage-triggered',
      spellId: 'phantasmal-killer',
      targetId: 'target',
      amount: 50,
    }))

    failed.state.initiativeIndex = failed.state.initiativeOrder.indexOf('target')
    const succeeded = resolveDnd5eHeadlessAction(failed.state, {
      type: 'end-turn',
      actorId: 'target',
      activeEffectSavingThrows: [{
        effectId: effect.id,
        d20: 20,
        damageRolls: [1, 1, 1, 1, 1],
      }],
    })
    expect(succeeded.ok).toBe(true)
    if (!succeeded.ok) return
    expect(succeeded.state.combatants.target.currentHp).toBe(50)
    expect(succeeded.state.combatants.target.conditions).not.toContain('frightened')
    expect(succeeded.state.combatants.wizard.concentrating).toBe(false)
  })

  it('applies Mage Armor to the real AC calculation and rejects armored targets', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['mage-armor'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } },
    })
    const ally = fighter('ally', 10, { armorClass: 10, abilities: { ...abilities, dex: 14 } })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('mage-armor', [wizard, ally]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'ally', spellId: 'mage-armor', slotLevel: 1,
      effectRolls: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(dnd5eTargetArmorClassForAttack(result.state, 'wizard', 'ally')).toBe(15)

    const shieldedAlly = fighter('shielded-ally', 10, {
      armorClass: 14,
      abilities: { ...abilities, dex: 14 },
      hasShield: true,
    })
    const shieldedResult = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('mage-armor-shield', [wizard, shieldedAlly]),
      {
        type: 'cast-spell', actorId: 'wizard', targetId: 'shielded-ally',
        spellId: 'mage-armor', slotLevel: 1, effectRolls: [],
      },
    )
    expect(shieldedResult.ok).toBe(true)
    if (!shieldedResult.ok) return
    expect(dnd5eTargetArmorClassForAttack(shieldedResult.state, 'wizard', 'shielded-ally')).toBe(17)

    const armored = fighter('armored', 10, { wearingArmor: true })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('mage-armor-armored', [wizard, armored]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'armored', spellId: 'mage-armor', slotLevel: 1,
      effectRolls: [],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('resolves Dispel Magic per spell and preserves failed higher-level effects', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, abilities: { ...abilities, int: 18 }, proficiencyBonus: 3,
      classSelections: { 'spell-prepared': ['dispel-magic'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 2, max: 2 } },
    })
    const target = fighter('target', 10)
    target.classState.activeEffects = [
      createDnd5eMechanicalEffect({
        id: 'shield-of-faith-effect', definitionId: 'srd-5.1:spell:shield-of-faith', label: '虔诚护盾',
        kind: 'buff', source: { kind: 'spell', actorId: 'cleric', rulesId: 'shield-of-faith' },
        targetId: 'target', duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      }),
      createDnd5eMechanicalEffect({
        id: 'greater-invisibility-effect', definitionId: 'srd-5.1:spell:greater-invisibility', label: '高等隐形术',
        kind: 'buff',
        source: { kind: 'spell', actorId: 'sorcerer', rulesId: 'greater-invisibility', spellLevel: 6 },
        targetId: 'target', duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      }),
    ]
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('dispel', [wizard, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'dispel-magic', slotLevel: 3,
      dispelMagicChecks: [{ effectId: 'greater-invisibility-effect', d20: 1 }], effectRolls: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.activeEffects?.map((effect) => effect.id))
      .toEqual(['greater-invisibility-effect'])
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-dispelled', spellId: 'shield-of-faith', success: true,
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-dispelled', spellId: 'greater-invisibility', spellLevel: 6, dc: 16, total: 5, success: false,
    }))
  })

  describe('Assassin indexed on-hit poison effects', () => {
    const poisonEffect = (
      d20: number,
      damageRolls: readonly number[] = [4, 4, 4, 4, 4, 4, 4],
      effectId = 'poison-save-damage',
    ) => ({
      effectId,
      d20,
      damageRolls: [damageRolls],
    })

    function assassinCombat(targetPatch = {}) {
      const assassin = fighter('assassin', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:assassin',
        abilities: { str: 11, dex: 16, con: 14, int: 13, wis: 11, cha: 10 },
        armorClass: 15,
        currentHp: 78,
        maxHp: 78,
      })
      const target = fighter('target', 10, {
        armorClass: 16,
        currentHp: 100,
        maxHp: 100,
        savingThrowBonuses: { con: 2 },
        ...targetPatch,
      })
      const state = startDnd5eHeadlessCombat('assassin-on-hit-effects', [assassin, target])
      // These cases isolate the indexed poison payload. Mark the target as
      // having already acted so Assassinate does not also make Sneak Attack
      // mandatory in the same submitted roll bundle.
      state.combatants[target.id].classState.turnStartResolvedTurnKey =
        `${state.combatId}:prior-target-turn`
      return {
        assassin,
        target,
        state,
      }
    }

    it('resolves two Shortsword poison saves independently in one Multiattack transaction', () => {
      const { state, target } = assassinCombat()
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        rolls: [
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [poisonEffect(10)],
          },
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[5]],
            onHitEffectRolls: [poisonEffect(13)],
          },
        ],
      }, {
        transactionId: 'assassin-two-poison-saves',
        now: 1,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id].currentHp).toBe(43)
      expect(result.events.filter((event) => event.type === 'saving-throw-resolved')).toEqual([
        expect.objectContaining({
          targetId: target.id,
          ability: 'con',
          dc: 15,
          total: 12,
          success: false,
        }),
        expect.objectContaining({
          targetId: target.id,
          ability: 'con',
          dc: 15,
          total: 15,
          success: true,
        }),
      ])
      expect(result.events.filter((event) =>
        event.type === 'damage-applied' && event.targetId === target.id,
      )).toEqual([
        expect.objectContaining({
          sourceId: 'assassin',
          amount: 35,
          damageTypes: ['piercing', 'poison'],
        }),
        expect.objectContaining({
          sourceId: 'assassin',
          amount: 22,
          damageTypes: ['piercing', 'poison'],
        }),
      ])
      expect(result.transaction).toMatchObject({
        id: 'assassin-two-poison-saves',
        status: 'committed',
      })
      const ledgerIds = result.transaction?.rollLedger.entries.map((entry) => entry.id) ?? []
      expect(ledgerIds).toContain('assassin:monster-action:monster:0:on-hit:poison-save-damage:save')
      expect(ledgerIds).toContain('assassin:monster-action:monster:0:on-hit:poison-save-damage:damage:0')
      expect(ledgerIds).toContain('assassin:monster-action:monster:1:on-hit:poison-save-damage:save')
      expect(ledgerIds).toContain('assassin:monster-action:monster:1:on-hit:poison-save-damage:damage:0')
    })

    it('settles a stable Multiattack prefix as one committed attack before the next roll', () => {
      const { state, target } = assassinCombat()
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        settleAttackCount: 1,
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: [poisonEffect(10)],
        }],
      }, {
        transactionId: 'assassin-first-multiattack-occurrence',
        now: 1,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.transaction?.status).toBe('committed')
      expect(result.state.combatants[target.id].currentHp).toBe(65)
      expect(result.state.combatants.assassin.turn.actionAvailable).toBe(false)
      expect(result.events.filter((event) =>
        event.type === 'attack-resolved')).toHaveLength(1)
      expect(result.events.filter((event) =>
        event.type === 'damage-applied')).toHaveLength(1)
      expect(result.state.combatants.assassin.classState.monsterMultiattackContinuation)
        .toMatchObject({
          schemaVersion: 1,
          combatId: result.state.combatId,
          parentActionId: 'multiattack',
          nextOccurrenceIndex: 1,
          sequenceActionIds: ['shortsword', 'shortsword'],
          targetIds: [target.id],
          hitByOccurrence: [true],
        })
    })

    it('authorizes the next Multiattack occurrence against a new target without spending a second action', () => {
      const { state, target } = assassinCombat({
        currentHp: 30,
        maxHp: 30,
      })
      const nextTarget = fighter('next-target', 5, {
        armorClass: 16,
        currentHp: 100,
        maxHp: 100,
        savingThrowBonuses: { con: 2 },
      })
      state.combatants[nextTarget.id] = nextTarget
      state.combatants[nextTarget.id].classState.turnStartResolvedTurnKey =
        `${state.combatId}:prior-next-target-turn`

      const first = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        settleAttackCount: 1,
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: [poisonEffect(1)],
        }],
      })
      expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
      if (!first.ok) return
      expect(first.state.combatants[target.id].currentHp).toBe(0)
      expect(first.state.combatants.assassin.turn.actionAvailable).toBe(false)

      const continued = resolveDnd5eHeadlessAction(first.state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'shortsword',
        multiattackContinuation: {
          schemaVersion: 1,
          parentActionId: 'multiattack',
          occurrenceIndex: 1,
        },
        rolls: [{
          targetId: nextTarget.id,
          d20: 10,
          damageRolls: [[5]],
          onHitEffectRolls: [poisonEffect(13)],
        }],
      })
      expect(continued.ok, continued.ok ? undefined : continued.reason).toBe(true)
      if (!continued.ok) return
      expect(continued.state.combatants[nextTarget.id].currentHp).toBe(78)
      expect(continued.state.combatants.assassin.turn.actionAvailable).toBe(false)
      expect(continued.state.combatants.assassin.classState.monsterMultiattackContinuation)
        .toBeUndefined()
      expect(continued.events.filter((event) =>
        event.type === 'turn-resource-spent' && event.resource === 'action',
      )).toHaveLength(0)
    })

    it('rejects forged or out-of-order Multiattack continuation attacks', () => {
      const { state, target } = assassinCombat()
      const first = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        settleAttackCount: 1,
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: [poisonEffect(10)],
        }],
      })
      expect(first.ok).toBe(true)
      if (!first.ok) return

      expect(resolveDnd5eHeadlessAction(first.state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'shortsword',
        multiattackContinuation: {
          schemaVersion: 1,
          parentActionId: 'multiattack',
          occurrenceIndex: 0,
        },
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[5]],
          onHitEffectRolls: [poisonEffect(13)],
        }],
      })).toMatchObject({
        ok: false,
        reason: 'invalid-monster-action',
      })
    })

    it('rejects a forged Multiattack prefix count that does not match its rolls', () => {
      const { state, target } = assassinCombat()
      expect(resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        settleAttackCount: 2,
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: [poisonEffect(10)],
        }],
      })).toMatchObject({
        ok: false,
        reason: 'invalid-monster-action',
      })
    })

    it('commits the first attack and stops prepared follow-up attacks after defeating a monster', () => {
      const { state, target } = assassinCombat({
        controller: 'dm',
        currentHp: 30,
        maxHp: 30,
      })
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        rolls: [
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [poisonEffect(1)],
          },
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[5]],
            onHitEffectRolls: [poisonEffect(1)],
          },
        ],
      }, {
        transactionId: 'assassin-defeats-monster-on-first-hit',
        now: 1,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.transaction).toMatchObject({
        id: 'assassin-defeats-monster-on-first-hit',
        status: 'committed',
      })
      expect(result.state.combatants[target.id]).toMatchObject({
        currentHp: 0,
        deathSaves: { dead: true },
      })
      expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(1)
      expect(result.events.filter((event) => event.type === 'saving-throw-resolved')).toHaveLength(1)
      expect(result.events.filter((event) => event.type === 'damage-applied')).toEqual([
        expect.objectContaining({
          sourceId: 'assassin',
          targetId: target.id,
          amount: 35,
        }),
      ])
    })

    it('stops prepared follow-up attacks after newly reducing a player to zero hit points', () => {
      const { state, target } = assassinCombat({
        currentHp: 30,
        maxHp: 30,
      })
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        rolls: [
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [poisonEffect(1)],
          },
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[5]],
            onHitEffectRolls: [poisonEffect(1)],
          },
        ],
      }, {
        transactionId: 'assassin-downs-player-on-first-hit',
        now: 1,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.transaction?.status).toBe('committed')
      expect(result.state.combatants[target.id]).toMatchObject({
        currentHp: 0,
        deathSaves: {
          successes: 0,
          failures: 0,
          stable: false,
          dead: false,
        },
      })
      expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(1)
      expect(result.events.filter((event) => event.type === 'saving-throw-resolved')).toHaveLength(1)
      expect(result.events.filter((event) => event.type === 'damage-applied')).toHaveLength(1)
    })

    it('applies poison immunity only to the on-hit poison component', () => {
      const { state, target } = assassinCombat({ damageImmunities: ['poison'] })
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'shortsword',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: [poisonEffect(1, [6, 6, 6, 6, 6, 6, 6])],
        }],
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id].currentHp).toBe(93)
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved',
        targetId: target.id,
        ability: 'con',
        dc: 15,
        success: false,
      }))
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'damage-applied',
        sourceId: 'assassin',
        targetId: target.id,
        amount: 7,
        damageTypes: ['piercing', 'poison'],
      }))
    })

    it('does not double saving-throw poison dice on a critical hit', () => {
      const { state, target } = assassinCombat()
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'shortsword',
        rolls: [{
          targetId: target.id,
          d20: 20,
          damageRolls: [[4, 4]],
          onHitEffectRolls: [poisonEffect(1, [1, 1, 1, 1, 1, 1, 1])],
        }],
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        actorId: 'assassin',
        targetId: target.id,
        critical: true,
      }))
      expect(result.state.combatants[target.id].currentHp).toBe(82)
      expect(result.transaction?.rollLedger.entries).toContainEqual(expect.objectContaining({
        id: 'assassin:monster-action:monster:0:on-hit:poison-save-damage:damage:0',
        kind: 'damage',
        dice: { sides: 6, values: [1, 1, 1, 1, 1, 1, 1] },
      }))
    })

    it('does not request or resolve poison on a miss and rejects forged on-hit dice', () => {
      const clean = assassinCombat()
      const missed = resolveDnd5eHeadlessAction(clean.state, {
        type: 'monster-action',
        actorId: clean.assassin.id,
        actionId: 'shortsword',
        rolls: [{
          targetId: clean.target.id,
          d20: 1,
          damageRolls: [],
        }],
      })
      expect(missed.ok, missed.ok ? undefined : missed.reason).toBe(true)
      if (!missed.ok) return
      expect(missed.state.combatants[clean.target.id].currentHp).toBe(100)
      expect(missed.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)

      const forged = assassinCombat()
      const rejected = resolveDnd5eHeadlessAction(forged.state, {
        type: 'monster-action',
        actorId: forged.assassin.id,
        actionId: 'shortsword',
        rolls: [{
          targetId: forged.target.id,
          d20: 1,
          damageRolls: [],
          onHitEffectRolls: [poisonEffect(1)],
        }],
      })
      expect(rejected).toMatchObject({
        ok: false,
        reason: 'invalid-dice',
        transaction: { status: 'rolled-back', rollbackReason: 'invalid-dice' },
      })
      expect(forged.state.combatants[forged.target.id].currentHp).toBe(100)
      expect(forged.state.combatants[forged.assassin.id].turn.actionAvailable).toBe(true)
    })

    it.each([
      {
        name: 'wrong effectId',
        effects: [poisonEffect(1, [1, 1, 1, 1, 1, 1, 1], 'forged-effect')],
      },
      {
        name: 'duplicate effectId',
        effects: [poisonEffect(1), poisonEffect(1)],
      },
      {
        name: 'wrong damage die count',
        effects: [poisonEffect(1, [1, 1, 1, 1, 1, 1])],
      },
    ])('rolls back the complete attack transaction for $name', ({ effects }) => {
      const { state, assassin, target } = assassinCombat()
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: assassin.id,
        actionId: 'shortsword',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: effects,
        }],
      })

      expect(result).toMatchObject({
        ok: false,
        reason: 'invalid-dice',
        transaction: { status: 'rolled-back', rollbackReason: 'invalid-dice' },
      })
      expect(state.combatants[target.id].currentHp).toBe(100)
      expect(state.combatants[assassin.id].turn.actionAvailable).toBe(true)
    })
  })

  describe('Bone Devil indexed Sting condition effect', () => {
    function boneDevilCombat(targetPatch = {}) {
      const devil = fighter('bone-devil', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:bone-devil',
        abilities: { str: 18, dex: 16, con: 18, int: 13, wis: 14, cha: 16 },
        armorClass: 19,
        currentHp: 142,
        maxHp: 142,
        position: { x: 0, y: 0 },
      })
      const target = fighter('target', 10, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        position: { x: 5, y: 0 },
        ...targetPatch,
      })
      return {
        devil,
        target,
        state: startDnd5eHeadlessCombat('bone-devil-sting', [devil, target]),
      }
    }

    const stingHit = (savingThrowD20: number) => ({
      targetId: 'target',
      d20: 10,
      damageRolls: [
        [4, 4],
        [3, 3, 3, 3, 3],
      ],
      onHitEffectRolls: [{
        effectId: 'sting-poisoned',
        d20: savingThrowD20,
      }],
    })

    it('applies a ten-round poisoned effect on a failed Sting save and removes it on a repeat save', () => {
      const { state, devil, target } = boneDevilCombat()
      const failed = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: devil.id,
        actionId: 'sting',
        rolls: [stingHit(1)],
      })

      expect(failed.ok, failed.ok ? undefined : failed.reason).toBe(true)
      if (!failed.ok) return
      expect(failed.state.combatants[target.id].currentHp).toBe(73)
      expect(failed.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved',
        targetId: target.id,
        ability: 'con',
        dc: 14,
        success: false,
      }))
      const poisoned = failed.state.combatants[target.id].classState.activeEffects?.find((effect) =>
        effect.standardCondition === 'poisoned')
      expect(poisoned).toMatchObject({
        standardCondition: 'poisoned',
        source: {
          kind: 'monster',
          actorId: devil.id,
          rulesId: 'monster:srd-5.1:bone-devil:bone-devil:sting:sting-poisoned',
        },
        duration: {
          type: 'rounds',
          remainingRounds: 10,
          tickOn: 'target-turn-end',
        },
        repeatSave: {
          ability: 'con',
          dc: 14,
          timing: 'target-turn-end',
          onSuccess: 'remove',
        },
      })
      expect(failed.state.combatants[target.id].conditions).toContain('poisoned')

      if (!poisoned) return
      failed.state.initiativeIndex = failed.state.initiativeOrder.indexOf(target.id)
      const recovered = resolveDnd5eHeadlessAction(failed.state, {
        type: 'end-turn',
        actorId: target.id,
        activeEffectSavingThrows: [{
          effectId: poisoned.id,
          d20: 20,
        }],
      })
      expect(recovered.ok, recovered.ok ? undefined : recovered.reason).toBe(true)
      if (!recovered.ok) return
      expect(recovered.state.combatants[target.id].conditions).not.toContain('poisoned')
      expect(recovered.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-save-resolved',
        targetId: target.id,
        effectId: poisoned.id,
        success: true,
      }))
    })

    it('does not apply poisoned when the target succeeds on the initial Sting save', () => {
      const { state, devil, target } = boneDevilCombat()
      const saved = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: devil.id,
        actionId: 'sting',
        rolls: [stingHit(20)],
      })

      expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
      if (!saved.ok) return
      expect(saved.state.combatants[target.id].currentHp).toBe(73)
      expect(saved.state.combatants[target.id].conditions).not.toContain('poisoned')
      expect(saved.state.combatants[target.id].classState.activeEffects ?? [])
        .not.toContainEqual(expect.objectContaining({ standardCondition: 'poisoned' }))
      expect(saved.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved',
        targetId: target.id,
        ability: 'con',
        dc: 14,
        success: true,
      }))
    })

    it('resolves Claw, Claw, Sting once each and binds the condition save only to Sting', () => {
      const { state, devil, target } = boneDevilCombat({
        currentHp: 200,
        maxHp: 200,
      })
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: devil.id,
        actionId: 'multiattack',
        rolls: [
          { targetId: target.id, d20: 10, damageRolls: [[4]] },
          { targetId: target.id, d20: 10, damageRolls: [[5]] },
          stingHit(20),
        ],
      }, {
        transactionId: 'bone-devil-three-attacks',
        now: 1,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id].currentHp).toBe(156)
      expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(3)
      expect(result.events.filter((event) => event.type === 'saving-throw-resolved')).toEqual([
        expect.objectContaining({
          targetId: target.id,
          ability: 'con',
          dc: 14,
          success: true,
        }),
      ])
      const stingLedgerIds = result.transaction?.rollLedger.entries
        .map((entry) => entry.id)
        .filter((id) => id.includes('on-hit:sting-poisoned')) ?? []
      expect(stingLedgerIds).toEqual([
        expect.stringContaining(':monster:2:on-hit:sting-poisoned:save'),
      ])

      const forged = boneDevilCombat({ currentHp: 200, maxHp: 200 })
      const rejected = resolveDnd5eHeadlessAction(forged.state, {
        type: 'monster-action',
        actorId: forged.devil.id,
        actionId: 'multiattack',
        rolls: [
          {
            targetId: forged.target.id,
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [{ effectId: 'sting-poisoned', d20: 20 }],
          },
          { targetId: forged.target.id, d20: 10, damageRolls: [[5]] },
          stingHit(20),
        ],
      })
      expect(rejected).toMatchObject({
        ok: false,
        reason: 'invalid-dice',
        transaction: {
          status: 'rolled-back',
          rollbackReason: 'invalid-dice',
        },
      })
      expect(forged.state.combatants[forged.target.id].currentHp).toBe(200)
      expect(forged.state.combatants[forged.devil.id].turn.actionAvailable).toBe(true)
    })
  })

  describe('source-linked monster grapple relations', () => {
    function ankhegGrappleState(includeSecondTarget = false) {
      const ankheg = fighter('ankheg', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:ankheg',
        abilities: { str: 17, dex: 11, con: 13, int: 1, wis: 13, cha: 6 },
        armorClass: 14,
        currentHp: 39,
        maxHp: 39,
        sizeRank: 3,
        position: { x: 0, y: 0 },
      })
      const target = fighter('target', 10, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
        position: { x: 5, y: 0 },
      })
      const secondTarget = fighter('second-target', 5, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 2,
        position: { x: 0, y: 5 },
      })
      const state = startDnd5eHeadlessCombat(
        'ankheg-source-linked-grapple',
        includeSecondTarget ? [ankheg, target, secondTarget] : [ankheg, target],
      )
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(ankheg.id, target.id)]: 5,
        ...(includeSecondTarget
          ? { [dnd5eCombatantPairKey(ankheg.id, secondTarget.id)]: 5 }
          : {}),
      }
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: ankheg.id,
        actionId: 'bite',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[3, 4], [3]],
          onHitEffectRolls: [{ effectId: 'bite-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) throw new Error(hit.reason)
      return { hit, ankheg, target, secondTarget }
    }

    it('links Ankheg Bite to its source and grants advantage only against the linked target', () => {
      const { hit } = ankhegGrappleState()
      const grapple = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.standardCondition === 'grappled')
      expect(grapple).toMatchObject({
        source: {
          kind: 'monster',
          actorId: 'ankheg',
        },
        escapeCheck: {
          ability: 'str',
          skill: 'athletics',
          alternativeAbility: 'dex',
          alternativeSkill: 'acrobatics',
          dc: 13,
          economy: 'action',
        },
        relation: {
          schemaVersion: 1,
          kind: 'grapple',
          sourceActorId: 'ankheg',
          sourceActionId: 'bite',
          slotGroup: 'bite',
          maxDistanceFeet: 5,
          movement: 'drag-target',
          endsOnSourceIncapacitated: true,
        },
      })
      expect(hit.state.combatants.target.conditions).toContain('grappled')

      hit.state.combatants.ankheg.turn.actionAvailable = true
      const advantaged = resolveDnd5eHeadlessAction(hit.state, {
        type: 'monster-action',
        actorId: 'ankheg',
        actionId: 'bite',
        rolls: [{
          targetId: 'target',
          d20: 1,
          d20Second: 15,
          damageRolls: [[1, 1], [1]],
          onHitEffectRolls: [{ effectId: 'bite-grapple' }],
        }],
      })
      expect(advantaged.ok, advantaged.ok ? undefined : advantaged.reason).toBe(true)
      if (!advantaged.ok) return
      expect(advantaged.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        actorId: 'ankheg',
        targetId: 'target',
        d20: 15,
        hit: true,
      }))
      expect(advantaged.state.combatants.target.classState.activeEffects?.filter((effect) =>
        effect.relation?.slotGroup === 'bite')).toHaveLength(1)
    })

    it('lets a monster release its own grapple for free and outside its turn', () => {
      const { hit } = ankhegGrappleState()
      hit.state.initiativeIndex = hit.state.initiativeOrder.indexOf('target')
      const actionAvailable = hit.state.combatants.ankheg.turn.actionAvailable
      const released = resolveDnd5eHeadlessAction(hit.state, {
        type: 'release-grapple',
        actorId: 'ankheg',
        targetId: 'target',
      })
      expect(released.ok, released.ok ? undefined : released.reason).toBe(true)
      if (!released.ok) return
      expect(released.state.combatants.target.conditions).not.toContain('grappled')
      expect(released.state.combatants.ankheg.turn.actionAvailable).toBe(actionAvailable)
      expect(released.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'released',
      }))
    })

    it('requires an exact root id when one source-target pair has two legal grapple slots', () => {
      const base = getDnd5eSrdMonster('srd-5.1:ankheg')!
      const bite = base.actions.find((action) => action.id === 'bite')
      const biteRelation = bite?.attack?.onHitEffects?.find((effect) =>
        effect.kind === 'source-linked-condition')
      if (!bite?.attack || !biteRelation) throw new Error('Ankheg Bite relation is missing')
      const tailRelation = {
        ...biteRelation,
        id: 'tail-grapple',
        relation: {
          ...biteRelation.relation,
          slotGroup: 'tail',
        },
      }
      const monster = {
        ...base,
        id: 'room-monster:dual-slot-grappler',
        slug: 'dual-slot-grappler',
        actions: [
          bite,
          {
            ...bite,
            id: 'tail-grapple-attack',
            name: 'Tail Grapple',
            attack: {
              ...bite.attack,
              onHitEffects: [tailRelation],
            },
          },
        ],
      } as Dnd5eMonsterStatBlock
      setDnd5eRoomMonsterCatalog([monster])
      const source = fighter('dual-source', 20, {
        controller: 'dm',
        statBlockId: monster.id,
        abilities: { ...monster.abilities },
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
      })
      const target = fighter('dual-target', 10, {
        armorClass: 14,
        currentHp: 200,
        maxHp: 200,
        sizeRank: 2,
        position: { x: 5, y: 0 },
      })
      const state = startDnd5eHeadlessCombat('dual-slot-release', [source, target])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(source.id, target.id)]: 5,
      }
      const first = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: source.id,
        actionId: bite.id,
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1]],
          onHitEffectRolls: [{ effectId: biteRelation.id }],
        }],
      })
      expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
      if (!first.ok) return
      first.state.combatants[source.id].turn.actionAvailable = true
      const second = resolveDnd5eHeadlessAction(first.state, {
        type: 'monster-action',
        actorId: source.id,
        actionId: 'tail-grapple-attack',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1]],
          onHitEffectRolls: [{ effectId: tailRelation.id }],
        }],
      })
      expect(second.ok, second.ok ? undefined : second.reason).toBe(true)
      if (!second.ok) return
      const roots = second.state.combatants[target.id].classState.activeEffects
        ?.filter((effect) =>
          effect.standardCondition === 'grappled' &&
          effect.dependsOnEffectId == null) ?? []
      expect(roots).toHaveLength(2)
      const biteRoot = roots.find((effect) => effect.relation?.slotGroup === 'bite')
      const tailRoot = roots.find((effect) => effect.relation?.slotGroup === 'tail')
      if (!biteRoot || !tailRoot) throw new Error('Dual grapple roots were not created')

      const ambiguous = resolveDnd5eHeadlessAction(second.state, {
        type: 'release-grapple',
        actorId: source.id,
        targetId: target.id,
      })
      expect(ambiguous).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(ambiguous.state.combatants[target.id].classState.activeEffects
        ?.filter((effect) => effect.standardCondition === 'grappled')).toHaveLength(2)

      const exact = resolveDnd5eHeadlessAction(ambiguous.state, {
        type: 'release-grapple',
        actorId: source.id,
        targetId: target.id,
        effectId: biteRoot.id,
      })
      expect(exact.ok, exact.ok ? undefined : exact.reason).toBe(true)
      if (!exact.ok) return
      expect(exact.state.combatants[target.id].conditions).toContain('grappled')
      expect(exact.state.combatants[target.id].classState.activeEffects)
        .toContainEqual(expect.objectContaining({ id: tailRoot.id }))
      expect(exact.state.combatants[target.id].classState.activeEffects ?? [])
        .not.toContainEqual(expect.objectContaining({ id: biteRoot.id }))
      expect(exact.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: target.id,
        effectId: biteRoot.id,
        reason: 'released',
      }))
    })

    it.each([
      {
        name: 'forged source kind',
        mutate: (effect: Dnd5eActiveEffectInstance) => {
          effect.source.kind = 'spell'
        },
      },
      {
        name: 'forged source rules id',
        mutate: (effect: Dnd5eActiveEffectInstance) => {
          effect.source.rulesId = 'monster:srd-5.1:ankheg:bite:other-effect'
        },
      },
      {
        name: 'forged stable root id',
        mutate: (effect: Dnd5eActiveEffectInstance) => {
          effect.id = 'forged-root'
          effect.stackingKey = 'forged-root'
        },
      },
    ])('fails closed for a persisted monster relation with $name', ({ mutate }) => {
      const { hit } = ankhegGrappleState()
      const grapple = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.relation?.slotGroup === 'bite')
      if (!grapple) throw new Error('missing grapple')
      mutate(grapple)
      const cleaned = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: 'ankheg',
      })
      expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
      if (!cleaned.ok) return
      expect(cleaned.state.combatants.target.conditions).not.toContain('grappled')
      expect(cleaned.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'invalid-relation',
      }))
    })

    it('ends a physical grapple when total cover separates source and target', () => {
      const { hit } = ankhegGrappleState()
      hit.state.lineOfEffectBlockedByCombatantPair = {
        [dnd5eDirectedCombatantPairKey('ankheg', 'target')]: true,
      }
      const cleaned = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: 'ankheg',
      })
      expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
      if (!cleaned.ok) return
      expect(cleaned.state.combatants.target.conditions).not.toContain('grappled')
      expect(cleaned.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'invalid-relation',
      }))
    })

    it('does not end an established grapple merely because the target later changes size', () => {
      const { hit } = ankhegGrappleState()
      hit.state.combatants.target.sizeRank = 5
      const retained = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: 'ankheg',
      })
      expect(retained.ok, retained.ok ? undefined : retained.reason).toBe(true)
      if (!retained.ok) return
      expect(retained.state.combatants.target.conditions).toContain('grappled')
    })

    it.each([
      {
        name: 'Ankheg Bite',
        statBlockId: 'srd-5.1:ankheg',
        actionId: 'bite',
        effectId: 'bite-grapple',
        slotGroup: 'bite',
        sizeRank: 3,
        abilities: { str: 17, dex: 11, con: 13, int: 1, wis: 13, cha: 6 },
        damageRolls: [[1, 1], [1]],
        expectedConditions: ['grappled'],
      },
      {
        name: 'Behir Constrict',
        statBlockId: 'srd-5.1:behir',
        actionId: 'constrict',
        effectId: 'constrict-grapple',
        slotGroup: 'constrict',
        sizeRank: 4,
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        damageRolls: [[1, 1], [1, 1]],
        expectedConditions: ['grappled', 'restrained'],
      },
    ])(
      'keeps two independent $name relations on one target and removes only the incapacitated source',
      ({
        statBlockId,
        actionId,
        effectId,
        slotGroup,
        sizeRank,
        abilities: monsterAbilities,
        damageRolls,
        expectedConditions,
      }) => {
        const first = fighter('first-source', 30, {
          controller: 'dm',
          statBlockId,
          abilities: monsterAbilities,
          sizeRank,
          currentHp: 200,
          maxHp: 200,
          position: { x: 0, y: 0 },
        })
        const second = fighter('second-source', 20, {
          controller: 'dm',
          statBlockId,
          abilities: monsterAbilities,
          sizeRank,
          currentHp: 200,
          maxHp: 200,
          position: { x: 0, y: 5 },
        })
        const target = fighter('shared-target', 10, {
          armorClass: 10,
          currentHp: 200,
          maxHp: 200,
          sizeRank: 3,
          position: { x: 5, y: 0 },
        })
        const state = startDnd5eHeadlessCombat(
          `parallel-${slotGroup}-relations`,
          [first, second, target],
        )
        state.distanceFeetByCombatantPair = {
          [dnd5eCombatantPairKey(first.id, target.id)]: 5,
          [dnd5eCombatantPairKey(second.id, target.id)]: 5,
        }
        const firstHit = resolveDnd5eHeadlessAction(state, {
          type: 'monster-action',
          actorId: first.id,
          actionId,
          rolls: [{
            targetId: target.id,
            d20: 10,
            damageRolls,
            onHitEffectRolls: [{ effectId }],
          }],
        })
        expect(firstHit.ok, firstHit.ok ? undefined : firstHit.reason).toBe(true)
        if (!firstHit.ok) return

        firstHit.state.initiativeIndex = firstHit.state.initiativeOrder.indexOf(second.id)
        firstHit.state.combatants[second.id].turn.actionAvailable = true
        const secondHit = resolveDnd5eHeadlessAction(firstHit.state, {
          type: 'monster-action',
          actorId: second.id,
          actionId,
          rolls: [{
            targetId: target.id,
            d20: 10,
            damageRolls,
            onHitEffectRolls: [{ effectId }],
          }],
        })
        expect(secondHit.ok, secondHit.ok ? undefined : secondHit.reason).toBe(true)
        if (!secondHit.ok) return
        expect(secondHit.state.combatants[target.id].classState.activeEffects?.filter((effect) =>
          effect.relation?.slotGroup === slotGroup).map((effect) =>
          effect.relation?.sourceActorId).sort()).toEqual([first.id, second.id])

        const incapacitatingEffects = migrateLegacyDnd5eConditions({
          targetId: first.id,
          conditions: ['stunned'],
        })
        secondHit.state.combatants[first.id].classState.activeEffects = incapacitatingEffects
        secondHit.state.combatants[first.id].conditions =
          dnd5eConditionsFromActiveEffects(incapacitatingEffects)
        secondHit.state.initiativeIndex = secondHit.state.initiativeOrder.indexOf(first.id)
        const cleaned = resolveDnd5eHeadlessAction(secondHit.state, {
          type: 'end-turn',
          actorId: first.id,
        })
        expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
        if (!cleaned.ok) return
        const remainingEffects =
          cleaned.state.combatants[target.id].classState.activeEffects ?? []
        expect(remainingEffects.filter((effect) =>
          effect.relation?.slotGroup === slotGroup)).toEqual([
          expect.objectContaining({
            relation: expect.objectContaining({ sourceActorId: second.id }),
          }),
        ])
        expect(remainingEffects.some((effect) => effect.source.actorId === first.id)).toBe(false)
        expect(cleaned.state.combatants[target.id].conditions).toEqual(
          expect.arrayContaining(expectedConditions),
        )
      },
    )

    it('does not let a dependent grapple relation occupy capacity or enable dragging', () => {
      const source = fighter('ankheg', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:ankheg',
        abilities: { str: 17, dex: 11, con: 13, int: 1, wis: 13, cha: 6 },
        sizeRank: 3,
        currentHp: 39,
        maxHp: 39,
        position: { x: 0, y: 0 },
      })
      const malformedTarget = fighter('malformed-target', 10, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        position: { x: 5, y: 0 },
      })
      const validTarget = fighter('valid-target', 5, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        position: { x: 0, y: 5 },
      })
      const anchor = createDnd5eConditionEffect({
        id: 'malformed-anchor',
        condition: 'prone',
        targetId: malformedTarget.id,
        source: { kind: 'monster', actorId: source.id, rulesId: 'bite' },
      })
      const malformedRelation = createDnd5eConditionEffect({
        id: 'malformed-dependent-relation',
        condition: 'grappled',
        targetId: malformedTarget.id,
        source: { kind: 'monster', actorId: source.id, rulesId: 'bite' },
        dependsOnEffectId: anchor.id,
        escapeCheck: {
          ability: 'str',
          skill: 'athletics',
          alternativeAbility: 'dex',
          alternativeSkill: 'acrobatics',
          dc: 13,
          economy: 'action',
        },
        relation: {
          schemaVersion: 1,
          kind: 'grapple',
          sourceActorId: source.id,
          sourceActionId: 'bite',
          slotGroup: 'bite',
          maxDistanceFeet: 5,
          movement: 'drag-target',
          endsOnSourceIncapacitated: true,
        },
      })
      malformedTarget.classState.activeEffects = [anchor, malformedRelation]
      malformedTarget.conditions =
        dnd5eConditionsFromActiveEffects(malformedTarget.classState.activeEffects)
      const state = startDnd5eHeadlessCombat(
        'malformed-relation-fail-closed',
        [source, malformedTarget, validTarget],
      )
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(source.id, malformedTarget.id)]: 5,
        [dnd5eCombatantPairKey(source.id, validTarget.id)]: 5,
      }

      expect(dnd5eGrappleDragExtraMovementFeet(state, source.id, 5)).toBe(0)
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: source.id,
        actionId: 'bite',
        rolls: [{
          targetId: validTarget.id,
          d20: 10,
          damageRolls: [[1, 1], [1]],
          onHitEffectRolls: [{ effectId: 'bite-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    })

    it('removes a source-linked relation in the same shove transaction that breaks reach', () => {
      const { hit } = ankhegGrappleState()
      const shover = fighter('shover', 30, {
        abilities: { ...abilities, str: 20 },
        position: { x: 5, y: 0 },
      })
      hit.state.combatants[shover.id] = shover
      hit.state.initiativeOrder = [shover.id, ...hit.state.initiativeOrder]
      hit.state.initiativeIndex = 0
      hit.state.distanceFeetByCombatantPair = {
        ...hit.state.distanceFeetByCombatantPair,
        [dnd5eCombatantPairKey(shover.id, 'ankheg')]: 5,
      }

      const pushed = resolveDnd5eHeadlessAction(hit.state, {
        type: 'shove',
        actorId: shover.id,
        targetId: 'ankheg',
        actorD20: 20,
        targetD20: 1,
        targetDefense: 'athletics',
        outcome: 'push',
        pushTo: { x: -5, y: 0 },
      })
      expect(pushed.ok, pushed.ok ? undefined : pushed.reason).toBe(true)
      if (!pushed.ok) return
      expect(pushed.state.combatants.target.conditions).not.toContain('grappled')
      expect(pushed.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'out-of-range',
      }))
    })

    it('removes a source-linked relation when Thunderwave pushes its source out of reach', () => {
      const { hit } = ankhegGrappleState()
      const caster = fighter('caster', 30, {
        classId: 'wizard',
        level: 5,
        abilities: { ...abilities, int: 16 },
        classSelections: { 'spell-prepared': ['thunderwave'] },
        classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
        position: { x: 5, y: 0 },
      })
      hit.state.combatants[caster.id] = caster
      hit.state.initiativeOrder = [caster.id, ...hit.state.initiativeOrder]
      hit.state.initiativeIndex = 0
      hit.state.distanceFeetByCombatantPair = {
        ...hit.state.distanceFeetByCombatantPair,
        [dnd5eCombatantPairKey(caster.id, 'ankheg')]: 5,
      }

      const pushed = resolveDnd5eHeadlessAction(hit.state, {
        type: 'cast-spell',
        actorId: caster.id,
        castingClassId: 'wizard',
        targetId: 'ankheg',
        targetIds: ['ankheg'],
        spellId: 'thunderwave',
        slotLevel: 1,
        savingThrowD20: 1,
        forcedMovements: [{
          targetId: 'ankheg',
          to: { x: -10, y: 0 },
          distanceFeet: 10,
        }],
        effectRolls: [1, 1],
      })
      expect(pushed.ok, pushed.ok ? undefined : pushed.reason).toBe(true)
      if (!pushed.ok) return
      expect(pushed.state.combatants.target.conditions).not.toContain('grappled')
      expect(pushed.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'out-of-range',
      }))
    })

    it('rejects another Ankheg Bite target and Acid Spray while its bite slot is occupied', () => {
      const { hit } = ankhegGrappleState(true)
      hit.state.combatants.ankheg.turn.actionAvailable = true
      expect(resolveDnd5eHeadlessAction(hit.state, {
        type: 'monster-action',
        actorId: 'ankheg',
        actionId: 'bite',
        rolls: [{
          targetId: 'second-target',
          d20: 10,
          damageRolls: [[3, 4], [3]],
          onHitEffectRolls: [{ effectId: 'bite-grapple' }],
        }],
      })).toMatchObject({ ok: false, reason: 'invalid-target' })

      expect(resolveDnd5eHeadlessAction(hit.state, {
        type: 'monster-area-action',
        actorId: 'ankheg',
        actionId: 'acid-spray',
        resolution: {
          schemaVersion: 1,
          targetIds: ['second-target'],
          targetSavingThrows: [{ targetId: 'second-target', d20: 1 }],
          damageRolls: [1, 1, 1],
        },
      })).toMatchObject({ ok: false, reason: 'invalid-target' })
    })

    it('applies dependent Behir restraint and escapes with the better proficient skill', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        armorClass: 17,
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const target = fighter('target', 10, {
        armorClass: 16,
        currentHp: 100,
        maxHp: 100,
        abilities: { ...abilities, str: 18, dex: 14 },
        proficiencyBonus: 3,
        skillProficiencies: ['acrobatics'],
        classSelections: { expertise: ['acrobatics'] },
        sizeRank: 3,
      })
      const state = startDnd5eHeadlessCombat('behir-constrict-relation', [behir, target])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, target.id)]: 5,
      }
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) return
      const grapple = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.standardCondition === 'grappled')
      const restrained = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.standardCondition === 'restrained')
      expect(grapple).toMatchObject({
        escapeCheck: {
          dc: 16,
          skill: 'athletics',
          alternativeSkill: 'acrobatics',
        },
        relation: {
          sourceActorId: 'behir',
          sourceActionId: 'constrict',
          slotGroup: 'constrict',
        },
      })
      expect(restrained).toMatchObject({ dependsOnEffectId: grapple?.id })
      expect(hit.state.combatants.target.conditions).toEqual(
        expect.arrayContaining(['grappled', 'restrained']),
      )

      const targetTurn = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: behir.id,
      })
      expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
      if (!targetTurn.ok || !grapple) return
      const escaped = resolveDnd5eHeadlessAction(targetTurn.state, {
        type: 'escape-active-effect',
        actorId: target.id,
        effectId: grapple.id,
        d20: 8,
      })
      expect(escaped.ok, escaped.ok ? undefined : escaped.reason).toBe(true)
      if (!escaped.ok) return
      expect(escaped.events).toContainEqual(expect.objectContaining({
        type: 'ability-check-resolved',
        actorId: target.id,
        ability: 'dex',
        skill: 'acrobatics',
        modifier: 8,
        total: 16,
        dc: 16,
        success: true,
      }))
      expect(escaped.state.combatants.target.conditions).not.toContain('grappled')
      expect(escaped.state.combatants.target.conditions).not.toContain('restrained')
      expect(escaped.state.combatants.target.classState.activeEffects ?? []).not.toContainEqual(
        expect.objectContaining({ id: restrained?.id }),
      )
    })

    it('rejects Behir Constrict and a Multiattack containing it against a Huge target', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const huge = fighter('huge-target', 10, {
        controller: 'player',
        armorClass: 10,
        currentHp: 200,
        maxHp: 200,
        sizeRank: 4,
      })
      const state = startDnd5eHeadlessCombat('behir-size-restriction', [behir, huge])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, huge.id)]: 5,
      }
      expect(resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: huge.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'multiattack',
        rolls: [
          {
            targetId: huge.id,
            d20: 10,
            damageRolls: [[1, 1, 1]],
          },
          {
            targetId: huge.id,
            d20: 10,
            damageRolls: [[1, 1], [1, 1]],
            onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
          },
        ],
      })).toMatchObject({ ok: false, reason: 'invalid-target' })
    })

    it('fails closed when a persisted Behir grapple is missing its dependent restraint', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const target = fighter('target', 10, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
      })
      const state = startDnd5eHeadlessCombat('behir-missing-dependent', [behir, target])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, target.id)]: 5,
      }
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) return
      hit.state.combatants[target.id].classState.activeEffects =
        hit.state.combatants[target.id].classState.activeEffects?.filter((effect) =>
          effect.standardCondition !== 'restrained')
      hit.state.combatants[target.id].conditions = ['grappled']

      const reconciled = resolveDnd5eHeadlessAction(hit.state, {
        type: 'release-grapple',
        actorId: behir.id,
        targetId: target.id,
      })
      expect(reconciled).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(reconciled.state.combatants[target.id].conditions).not.toContain('grappled')
      expect(reconciled.state.combatants[target.id].classState.activeEffects ?? []).toEqual([])
      expect(reconciled.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: target.id,
        reason: 'invalid-relation',
      }))
    })

    it('keeps a valid Behir grapple when the target is immune to its dependent restraint', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const target = fighter('target', 10, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
        conditionImmunities: ['restrained'],
      })
      const state = startDnd5eHeadlessCombat('behir-restraint-immunity', [behir, target])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, target.id)]: 5,
      }
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) return
      expect(hit.state.combatants[target.id].conditions).toContain('grappled')
      expect(hit.state.combatants[target.id].conditions).not.toContain('restrained')

      const next = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: behir.id,
      })
      expect(next.ok, next.ok ? undefined : next.reason).toBe(true)
      if (!next.ok) return
      expect(next.state.combatants[target.id].conditions).toContain('grappled')
      expect(next.events).not.toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: target.id,
        reason: 'invalid-relation',
      }))
    })

    it('lets an occupied Behir Constrict damage another target without creating a second relation', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        armorClass: 17,
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const first = fighter('first', 10, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
      })
      const second = fighter('second', 5, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
      })
      const state = startDnd5eHeadlessCombat('behir-constrict-capacity', [behir, first, second])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, first.id)]: 5,
        [dnd5eCombatantPairKey(behir.id, second.id)]: 5,
      }
      const held = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: first.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(held.ok, held.ok ? undefined : held.reason).toBe(true)
      if (!held.ok) return
      held.state.combatants.behir.turn.actionAvailable = true
      const attacked = resolveDnd5eHeadlessAction(held.state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: second.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(attacked.ok, attacked.ok ? undefined : attacked.reason).toBe(true)
      if (!attacked.ok) return
      expect(attacked.state.combatants.second.currentHp).toBe(84)
      expect(attacked.state.combatants.second.conditions).not.toContain('grappled')
      expect(attacked.state.combatants.first.conditions).toEqual(
        expect.arrayContaining(['grappled', 'restrained']),
      )
    })

    it.each(['incapacitated', 'dead'] as const)(
      'cleans source-linked grapples on the next transaction when the source is %s',
      (sourceState) => {
        const { hit } = ankhegGrappleState()
        const source = hit.state.combatants.ankheg
        if (sourceState === 'dead') {
          source.currentHp = 0
          source.deathSaves.dead = true
        } else {
          const effects = migrateLegacyDnd5eConditions({
            targetId: source.id,
            conditions: ['stunned'],
          })
          source.classState.activeEffects = effects
          source.conditions = dnd5eConditionsFromActiveEffects(effects)
        }
        const cleaned = resolveDnd5eHeadlessAction(hit.state, {
          type: 'end-turn',
          actorId: source.id,
        })
        expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
        if (!cleaned.ok) return
        expect(cleaned.state.combatants.target.conditions).not.toContain('grappled')
        expect(cleaned.events).toContainEqual(expect.objectContaining({
          type: 'active-effect-removed',
          targetId: 'target',
          reason: 'source-incapacitated',
        }))
      },
    )

    it('fails closed when persisted source-linked escape metadata no longer matches its declaration', () => {
      const { hit } = ankhegGrappleState()
      const grapple = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.relation?.slotGroup === 'bite')
      if (!grapple?.escapeCheck) throw new Error('missing bite grapple')
      grapple.escapeCheck.dc = 99

      const cleaned = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: 'ankheg',
      })
      expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
      if (!cleaned.ok) return
      expect(cleaned.state.combatants.target.conditions).not.toContain('grappled')
      expect(cleaned.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        effectId: grapple.id,
        reason: 'invalid-relation',
      }))
    })

    it.each([
      { targetSizeRank: 3, expectedMovementCost: 10 },
      { targetSizeRank: 1, expectedMovementCost: 5 },
    ])(
      'drags a linked target and spends $expectedMovementCost feet for a 5-foot move',
      ({ targetSizeRank, expectedMovementCost }) => {
        const { hit } = ankhegGrappleState()
        hit.state.combatants.target.sizeRank = targetSizeRank
        const moved = resolveDnd5eHeadlessAction(hit.state, {
          type: 'move',
          actorId: 'ankheg',
          to: { x: 5, y: 0 },
          distance: 5,
        })
        expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
        if (!moved.ok) return
        expect(moved.state.combatants.ankheg.position).toEqual({ x: 5, y: 0 })
        expect(moved.state.combatants.target.position).toEqual({ x: 10, y: 0 })
        expect(moved.state.combatants.ankheg.turn.movementRemaining)
          .toBe(30 - expectedMovementCost)
        expect(moved.events.filter((event) => event.type === 'moved')).toEqual([
          expect.objectContaining({
            actorId: 'ankheg',
            from: { x: 0, y: 0 },
            to: { x: 5, y: 0 },
            distance: 5,
          }),
          expect.objectContaining({
            actorId: 'target',
            from: { x: 5, y: 0 },
            to: { x: 10, y: 0 },
            distance: 5,
          }),
        ])
        expect(moved.events).toContainEqual({
          type: 'turn-resource-spent',
          actorId: 'ankheg',
          resource: 'movement',
          amount: expectedMovementCost,
        })
      },
    )

    it('applies independently supplied fall rolls to the grappler and its linked target', () => {
      const { hit } = ankhegGrappleState()
      hit.state.combatants.ankheg.elevationFeet = 20
      hit.state.combatants.target.elevationFeet = 20
      const moved = resolveDnd5eHeadlessAction(hit.state, {
        type: 'move',
        actorId: 'ankheg',
        to: { x: 5, y: 0 },
        distance: 5,
        traversalMode: 'fall',
        toElevationFeet: 0,
        fallingDamageRollsByCombatantId: {
          ankheg: [3, 4],
          target: [2, 5],
        },
      })
      expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
      if (!moved.ok) return
      expect(moved.state.combatants.ankheg.currentHp).toBe(32)
      expect(moved.state.combatants.target.currentHp).toBe(80)
      expect(moved.state.combatants.ankheg.conditions).toContain('prone')
      expect(moved.state.combatants.target.conditions).toContain('prone')
      expect(moved.events.filter((event) =>
        event.type === 'falling-damage-resolved' && event.distanceFeet === 20))
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ actorId: 'ankheg', damage: 7, landedProne: true }),
          expect.objectContaining({ actorId: 'target', damage: 7, landedProne: true }),
        ]))
    })

    it('does not reuse the grappler legacy fall dice for a dragged target', () => {
      const { hit } = ankhegGrappleState()
      hit.state.combatants.ankheg.elevationFeet = 20
      hit.state.combatants.target.elevationFeet = 20
      expect(resolveDnd5eHeadlessAction(hit.state, {
        type: 'move',
        actorId: 'ankheg',
        to: { x: 5, y: 0 },
        distance: 5,
        traversalMode: 'fall',
        toElevationFeet: 0,
        fallingDamageRolls: [3, 4],
      })).toMatchObject({ ok: false, reason: 'invalid-dice' })
    })

    it('fills both Giant Scorpion claw slots and skips a third new grapple', () => {
      const scorpion = fighter('scorpion', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:giant-scorpion',
        abilities: { str: 15, dex: 13, con: 15, int: 1, wis: 9, cha: 3 },
        armorClass: 15,
        currentHp: 52,
        maxHp: 52,
        sizeRank: 3,
      })
      const targets = ['first', 'second', 'third'].map((id, index) => fighter(id, 10 - index, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        position: { x: 5 * (index + 1), y: 0 },
      }))
      const state = startDnd5eHeadlessCombat('giant-scorpion-claw-capacity', [
        scorpion,
        ...targets,
      ])
      state.distanceFeetByCombatantPair = Object.fromEntries(targets.map((target) => [
        dnd5eCombatantPairKey(scorpion.id, target.id),
        5,
      ]))
      const multiattack = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: scorpion.id,
        actionId: 'multiattack',
        rolls: [
          {
            targetId: 'first',
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [{ effectId: 'claw-grapple' }],
          },
          {
            targetId: 'second',
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [{ effectId: 'claw-grapple' }],
          },
          {
            targetId: 'third',
            d20: 1,
            damageRolls: [],
          },
        ],
      })
      expect(multiattack.ok, multiattack.ok ? undefined : multiattack.reason).toBe(true)
      if (!multiattack.ok) return
      expect(multiattack.state.combatants.first.conditions).toContain('grappled')
      expect(multiattack.state.combatants.second.conditions).toContain('grappled')
      expect(multiattack.state.combatants.third.conditions).not.toContain('grappled')

      multiattack.state.combatants.scorpion.turn.actionAvailable = true
      const thirdClaw = resolveDnd5eHeadlessAction(multiattack.state, {
        type: 'monster-action',
        actorId: scorpion.id,
        actionId: 'claw',
        rolls: [{
          targetId: 'third',
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: [{ effectId: 'claw-grapple' }],
        }],
      })
      expect(thirdClaw.ok, thirdClaw.ok ? undefined : thirdClaw.reason).toBe(true)
      if (!thirdClaw.ok) return
      expect(thirdClaw.state.combatants.third.currentHp).toBe(94)
      expect(thirdClaw.state.combatants.third.conditions).not.toContain('grappled')
      expect(['first', 'second', 'third'].flatMap((id) =>
        thirdClaw.state.combatants[id].classState.activeEffects?.filter((effect) =>
          effect.relation?.slotGroup === 'claw') ?? [])).toHaveLength(2)
    })
  })

  it('applies Bronze Dragon Repulsion Breath only to failed saves, including allied and downed targets', () => {
    const dragon = fighter('dragon', 30, {
      controller: 'dm',
      statBlockId: 'srd-5.1:adult-bronze-dragon',
      currentHp: 200,
      maxHp: 200,
      position: { x: 0, y: 0 },
    })
    const ally = fighter('ally', 20, {
      controller: 'dm',
      position: { x: 5, y: 0 },
    })
    const enemy = fighter('enemy', 10, {
      position: { x: 10, y: 0 },
    })
    const downed = fighter('downed', 5, {
      currentHp: 0,
      maxHp: 20,
      usesDeathSaves: true,
      conditions: ['unconscious'],
      position: { x: 15, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('bronze-repulsion', [
      dragon, ally, enemy, downed,
    ])
    const resolution = {
      schemaVersion: 1 as const,
      variantId: 'repulsion-breath',
      targetIds: ['ally', 'enemy', 'downed'],
      targetSavingThrows: [
        { targetId: 'ally', d20: 20 },
        { targetId: 'enemy', d20: 1 },
        { targetId: 'downed', d20: 1 },
      ],
      damageRolls: [],
      forcedMovements: [
        { targetId: 'ally', to: { x: 65, y: 0 }, distanceFeet: 60 },
        { targetId: 'enemy', to: { x: 70, y: 0 }, distanceFeet: 60 },
        { targetId: 'downed', to: { x: 75, y: 0 }, distanceFeet: 60 },
      ],
    }

    const pushed = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: 'dragon',
      actionId: 'breath-weapons',
      resolution,
    })
    expect(pushed.ok, pushed.ok ? undefined : pushed.reason).toBe(true)
    if (!pushed.ok) return
    expect(pushed.state.combatants.ally.position).toEqual({ x: 5, y: 0 })
    expect(pushed.state.combatants.enemy.position).toEqual({ x: 70, y: 0 })
    expect(pushed.state.combatants.downed.position).toEqual({ x: 75, y: 0 })
    expect(pushed.events.filter((event) => event.type === 'moved').map((event) =>
      event.actorId)).toEqual(['enemy', 'downed'])
    expect(pushed.state.combatants.dragon.classState.monsterRechargeReadyByActionId)
      .toMatchObject({ 'breath-weapons': false })

    const missingCandidate = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: 'dragon',
      actionId: 'breath-weapons',
      resolution: {
        ...resolution,
        forcedMovements: resolution.forcedMovements.slice(0, 2),
      },
    })
    expect(missingCandidate).toMatchObject({ ok: false, reason: 'invalid-target' })

    for (const forgedEnemyMovement of [
      { targetId: 'enemy', to: { x: 1_000, y: 0 }, distanceFeet: 60 },
      { targetId: 'enemy', to: { x: 10, y: 60 }, distanceFeet: 60 },
    ]) {
      const forged = resolveDnd5eHeadlessAction(state, {
        type: 'monster-area-action',
        actorId: 'dragon',
        actionId: 'breath-weapons',
        resolution: {
          ...resolution,
          forcedMovements: resolution.forcedMovements.map((movement) =>
            movement.targetId === 'enemy' ? forgedEnemyMovement : movement),
        },
      })
      expect(forged).toMatchObject({ ok: false, reason: 'invalid-target' })
    }
  })

  it('enforces every mechanical restriction from Copper Dragon Slowing Breath and repeats the save', () => {
    const dragon = fighter('dragon', 30, {
      controller: 'dm',
      statBlockId: 'srd-5.1:copper-dragon-wyrmling',
      currentHp: 100,
      maxHp: 100,
    })
    const target = fighter('target', 20, {
      classId: 'fighter',
      level: 1,
      currentHp: 10,
      maxHp: 20,
      classResources: { fighterSecondWind: { current: 1, max: 1 } },
      movementSpeeds: { walk: 30, fly: 60, swim: 40, climb: 20 },
      position: { x: 5, y: 0 },
    })
    const ally = fighter('ally', 10, {
      controller: 'dm',
      position: { x: 10, y: 0 },
    })
    const slowed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('copper-slowing', [dragon, target, ally]),
      {
        type: 'monster-area-action',
        actorId: 'dragon',
        actionId: 'breath-weapons',
        resolution: {
          schemaVersion: 1,
          variantId: 'slowing-breath',
          targetIds: ['target', 'ally'],
          targetSavingThrows: [
            { targetId: 'target', d20: 1 },
            { targetId: 'ally', d20: 20 },
          ],
          damageRolls: [],
        },
      },
    )
    expect(slowed.ok, slowed.ok ? undefined : slowed.reason).toBe(true)
    if (!slowed.ok) return
    const slowedTarget = slowed.state.combatants.target
    const slowEffect = slowedTarget.classState.activeEffects?.find((effect) =>
      effect.definitionId === 'monster-area:slowing-breath-effect')
    expect(slowEffect).toMatchObject({
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'con', dc: 11, timing: 'target-turn-end', onSuccess: 'remove' },
      stackingKey: 'monster-area:slowing-breath-effect',
      stackingPolicy: 'refresh-duration',
      modifiers: {
        speedMultiplier: 0.5,
        preventReactions: true,
        maximumAttacksPerTurn: 1,
        actionOrBonusActionOnly: true,
      },
    })
    expect(slowed.state.combatants.ally.classState.activeEffects?.some((effect) =>
      effect.definitionId === 'monster-area:slowing-breath-effect')).not.toBe(true)
    expect(dnd5eEffectiveSpeed(slowedTarget)).toBe(15)
    expect(dnd5eEffectiveFlySpeed(slowedTarget)).toBe(30)
    expect(slowedTarget.turn.movementRemaining).toBe(15)
    expect(slowedTarget.turn.reactionAvailable).toBe(false)

    const bonusFirstState = structuredClone(slowed.state)
    bonusFirstState.initiativeIndex = bonusFirstState.initiativeOrder.indexOf('target')
    const secondWind = resolveDnd5eHeadlessAction(bonusFirstState, {
      type: 'fighter-second-wind',
      actorId: 'target',
      resourceKey: 'fighterSecondWind',
      d10: 1,
    })
    expect(secondWind.ok, secondWind.ok ? undefined : secondWind.reason).toBe(true)
    if (!secondWind.ok) return
    expect(secondWind.state.combatants.target.turn).toMatchObject({
      actionAvailable: false,
      bonusActionAvailable: false,
    })
    expect(resolveDnd5eHeadlessAction(secondWind.state, {
      type: 'attack',
      actorId: 'target',
      targetId: 'dragon',
      attackModifier: 20,
      d20: 10,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [1], type: 'slashing' },
      classDamageContext: meleeWeaponContext('test-sword'),
    })).toMatchObject({ ok: false, reason: 'action-unavailable' })

    const attackLimitState = structuredClone(slowed.state)
    attackLimitState.initiativeIndex = attackLimitState.initiativeOrder.indexOf('target')
    const firstAttack = resolveDnd5eHeadlessAction(attackLimitState, {
      type: 'attack',
      actorId: 'target',
      targetId: 'dragon',
      attackModifier: 20,
      d20: 10,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [1], type: 'slashing' },
      classDamageContext: meleeWeaponContext('test-sword'),
    })
    expect(firstAttack.ok, firstAttack.ok ? undefined : firstAttack.reason).toBe(true)
    if (!firstAttack.ok) return
    expect(firstAttack.state.combatants.target.turn).toMatchObject({
      actionAvailable: false,
      bonusActionAvailable: false,
    })
    expect(resolveDnd5eHeadlessAction(firstAttack.state, {
      type: 'attack',
      actorId: 'target',
      targetId: 'dragon',
      attackModifier: 20,
      d20: 10,
      spendAction: false,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [1], type: 'slashing' },
      classDamageContext: meleeWeaponContext('test-sword'),
    })).toMatchObject({ ok: false, reason: 'action-unavailable' })

    if (!slowEffect) return
    const repeatSaveState = structuredClone(slowed.state)
    repeatSaveState.initiativeIndex = repeatSaveState.initiativeOrder.indexOf('target')
    const recovered = resolveDnd5eHeadlessAction(repeatSaveState, {
      type: 'end-turn',
      actorId: 'target',
      activeEffectSavingThrows: [{ effectId: slowEffect.id, d20: 20 }],
    })
    expect(recovered.ok, recovered.ok ? undefined : recovered.reason).toBe(true)
    if (!recovered.ok) return
    expect(recovered.state.combatants.target.classState.activeEffects?.some((effect) =>
      effect.definitionId === 'monster-area:slowing-breath-effect')).not.toBe(true)
    expect(dnd5eEffectiveSpeed(recovered.state.combatants.target)).toBe(30)
  })

  it('applies Gold Dragon Weakening Breath to Strength attacks, checks, saves, and failed targets only', () => {
    const dragon = fighter('dragon', 30, {
      controller: 'dm',
      statBlockId: 'srd-5.1:gold-dragon-wyrmling',
      armorClass: 18,
      currentHp: 100,
      maxHp: 100,
    })
    const target = fighter('target', 20, {
      position: { x: 5, y: 0 },
    })
    const ally = fighter('ally', 10, {
      controller: 'dm',
      position: { x: 10, y: 0 },
    })
    const weakened = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('gold-weakening', [dragon, target, ally]),
      {
        type: 'monster-area-action',
        actorId: 'dragon',
        actionId: 'breath-weapons',
        resolution: {
          schemaVersion: 1,
          variantId: 'weakening-breath',
          targetIds: ['target', 'ally'],
          targetSavingThrows: [
            { targetId: 'target', d20: 1 },
            { targetId: 'ally', d20: 20 },
          ],
          damageRolls: [],
        },
      },
    )
    expect(weakened.ok, weakened.ok ? undefined : weakened.reason).toBe(true)
    if (!weakened.ok) return
    expect(weakened.state.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'monster-area:weakening-breath-effect',
        modifiers: expect.objectContaining({ strengthRollMode: 'disadvantage' }),
      }),
    )
    expect(weakened.state.combatants.ally.classState.activeEffects?.some((effect) =>
      effect.definitionId === 'monster-area:weakening-breath-effect')).not.toBe(true)
    expect(dnd5eSavingThrowMode(weakened.state.combatants.target, 'str')).toBe('disadvantage')
    expect(dnd5eAbilityCheckRollMode(weakened.state.combatants.target, {
      ability: 'str',
      skill: 'athletics',
    })).toBe('disadvantage')

    weakened.state.initiativeIndex = weakened.state.initiativeOrder.indexOf('target')
    const attack = resolveDnd5eHeadlessAction(weakened.state, {
      type: 'attack',
      actorId: 'target',
      targetId: 'dragon',
      attackModifier: 5,
      d20: 20,
      d20Second: 1,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [], type: 'slashing' },
      classDamageContext: meleeWeaponContext('test-sword'),
    })
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'target',
      targetId: 'dragon',
      d20: 1,
      hit: false,
    }))
  })

  it('applies Weakening Breath by a monster weapon actual ability, not by melee/ranged mode', () => {
    const dragon = fighter('dragon', 40, {
      controller: 'dm',
      statBlockId: 'srd-5.1:gold-dragon-wyrmling',
      currentHp: 100,
      maxHp: 100,
    })
    const spy = fighter('spy', 30, {
      controller: 'dm',
      statBlockId: 'srd-5.1:spy',
      currentHp: 50,
      maxHp: 50,
      position: { x: 5, y: 0 },
    })
    const ogre = fighter('ogre', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:ogre',
      currentHp: 80,
      maxHp: 80,
      position: { x: 10, y: 0 },
    })
    const hero = fighter('hero', 10, {
      armorClass: 16,
      currentHp: 100,
      maxHp: 100,
      position: { x: 30, y: 0 },
    })
    const weakened = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('monster-weakening-ability', [dragon, spy, ogre, hero]),
      {
        type: 'monster-area-action',
        actorId: 'dragon',
        actionId: 'breath-weapons',
        resolution: {
          schemaVersion: 1,
          variantId: 'weakening-breath',
          targetIds: ['spy', 'ogre'],
          targetSavingThrows: [
            { targetId: 'spy', d20: 1 },
            { targetId: 'ogre', d20: 1 },
          ],
          damageRolls: [],
        },
      },
    )
    expect(weakened.ok, weakened.ok ? undefined : weakened.reason).toBe(true)
    if (!weakened.ok) return

    const dexMeleeState = structuredClone(weakened.state)
    dexMeleeState.initiativeIndex = dexMeleeState.initiativeOrder.indexOf('spy')
    dexMeleeState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('spy', 'hero')]: 5,
    }
    const dexMelee = resolveDnd5eHeadlessAction(dexMeleeState, {
      type: 'monster-action',
      actorId: 'spy',
      actionId: 'shortsword',
      rolls: [{
        targetId: 'hero',
        d20: 19,
        d20Second: 1,
        damageRolls: [[1]],
      }],
    })
    expect(dexMelee.ok, dexMelee.ok ? undefined : dexMelee.reason).toBe(true)
    if (!dexMelee.ok) return
    expect(dexMelee.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'spy',
      d20: 19,
    }))

    const strengthThrownState = structuredClone(weakened.state)
    strengthThrownState.initiativeIndex = strengthThrownState.initiativeOrder.indexOf('ogre')
    strengthThrownState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('ogre', 'hero')]: 30,
    }
    const strengthThrown = resolveDnd5eHeadlessAction(strengthThrownState, {
      type: 'monster-action',
      actorId: 'ogre',
      actionId: 'javelin',
      rolls: [{
        targetId: 'hero',
        d20: 19,
        d20Second: 1,
        damageRolls: [],
      }],
    })
    expect(strengthThrown.ok, strengthThrown.ok ? undefined : strengthThrown.reason).toBe(true)
    if (!strengthThrown.ok) return
    expect(strengthThrown.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'ogre',
      d20: 1,
      hit: false,
    }))

    const dexRangedState = structuredClone(weakened.state)
    dexRangedState.initiativeIndex = dexRangedState.initiativeOrder.indexOf('spy')
    dexRangedState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('spy', 'hero')]: 30,
    }
    const dexRanged = resolveDnd5eHeadlessAction(dexRangedState, {
      type: 'monster-action',
      actorId: 'spy',
      actionId: 'hand-crossbow',
      rolls: [{
        targetId: 'hero',
        d20: 19,
        d20Second: 1,
        damageRolls: [[1]],
      }],
    })
    expect(dexRanged.ok, dexRanged.ok ? undefined : dexRanged.reason).toBe(true)
    if (!dexRanged.ok) return
    expect(dexRanged.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'spy',
      d20: 19,
    }))
  })

  describe('unsupported airborne falls at the action transaction boundary', () => {
    function airborneContestState(input?: {
      hover?: boolean
      magicalFlight?: boolean
    }) {
      const shover = fighter('shover', 20, {
        position: { x: 0, y: 0 },
      })
      const flyer = fighter('flyer', 10, {
        controller: 'dm',
        position: { x: 5, y: 0 },
        elevationFeet: 30,
        groundElevationFeet: 0,
        airborne: true,
        movementSpeeds: input?.magicalFlight
          ? { walk: 30 }
          : { walk: 30, fly: 60, hover: input?.hover === true },
      })
      if (input?.magicalFlight) {
        flyer.classState.activeEffects = [createDnd5eMechanicalEffect({
          id: 'fly-spell-effect',
          definitionId: 'srd-5.1:spell:fly',
          label: 'Fly',
          targetId: flyer.id,
          source: { kind: 'spell', actorId: flyer.id, rulesId: 'fly', magical: true },
          duration: { type: 'concentration', sourceActorId: flyer.id, concentrationId: 'fly' },
          modifiers: { flySpeedFeet: 60 },
        })]
      }
      const state = startDnd5eHeadlessCombat('airborne-shove', [shover, flyer])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(shover.id, flyer.id)]: 5,
      }
      return state
    }

    const shoveProne = {
      type: 'shove' as const,
      actorId: 'shover',
      targetId: 'flyer',
      actorD20: 20,
      targetD20: 1,
      targetDefense: 'acrobatics' as const,
      outcome: 'prone' as const,
    }

    it('previews and resolves a native non-hover flyer falling after becoming prone', () => {
      const state = airborneContestState()
      expect(previewDnd5eUnsupportedAirborneFalls(state, shoveProne)).toEqual({
        ok: true,
        falls: [{
          combatantId: 'flyer',
          fromElevationFeet: 30,
          groundElevationFeet: 0,
          fallDistanceFeet: 30,
          fallingDamageDice: 3,
        }],
      })

      const resolved = resolveDnd5eHeadlessAction(state, {
        ...shoveProne,
        airborneFallDamageRollsByCombatantId: { flyer: [2, 3, 4] },
      })
      expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
      if (!resolved.ok) return
      expect(resolved.state.combatants.flyer).toMatchObject({
        currentHp: 11,
        elevationFeet: 0,
        groundElevationFeet: 0,
        airborne: false,
      })
      expect(resolved.state.combatants.flyer.conditions).toContain('prone')
      expect(resolved.events).toContainEqual(expect.objectContaining({
        type: 'falling-damage-resolved',
        actorId: 'flyer',
        distanceFeet: 30,
        dice: 3,
        damage: 9,
      }))
    })

    it('keeps hover and magical Fly aloft after becoming prone', () => {
      for (const state of [
        airborneContestState({ hover: true }),
        airborneContestState({ magicalFlight: true }),
      ]) {
        expect(previewDnd5eUnsupportedAirborneFalls(state, shoveProne)).toEqual({
          ok: true,
          falls: [],
        })
        const resolved = resolveDnd5eHeadlessAction(state, shoveProne)
        expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
        if (!resolved.ok) continue
        expect(resolved.state.combatants.flyer).toMatchObject({
          elevationFeet: 30,
          groundElevationFeet: 0,
          airborne: true,
        })
        expect(resolved.state.combatants.flyer.conditions).toContain('prone')
        expect(resolved.events.some((event) => event.type === 'falling-damage-resolved')).toBe(false)
      }
    })

    it('keeps a supported flyer at its current height when a push carries it off a ledge', () => {
      const shover = fighter('shover', 20, { position: { x: 0, y: 0 } })
      const flyer = fighter('flyer', 10, {
        controller: 'dm', position: { x: 5, y: 0 },
        elevationFeet: 40, groundElevationFeet: 40, airborne: false,
        movementSpeeds: { walk: 30, fly: 60 },
      })
      const state = startDnd5eHeadlessCombat('forced-flight-support', [shover, flyer])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(shover.id, flyer.id)]: 5,
      }
      const push = {
        type: 'shove' as const, actorId: shover.id, targetId: flyer.id,
        actorD20: 20, targetD20: 1, targetDefense: 'acrobatics' as const,
        outcome: 'push' as const, pushTo: { x: 10, y: 0 },
        pushToGroundElevationFeet: 0,
      }

      const resolved = resolveDnd5eHeadlessAction(state, push)
      expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
      if (!resolved.ok) return
      expect(resolved.state.combatants.flyer).toMatchObject({
        currentHp: 20,
        position: { x: 10, y: 0 },
        elevationFeet: 40,
        groundElevationFeet: 0,
        airborne: true,
      })
      expect(resolved.events.some((event) => event.type === 'falling-damage-resolved')).toBe(false)

      expect(resolveDnd5eHeadlessAction(state, {
        ...push,
        pushToElevationFeet: 0,
        fallingDamageRolls: [2, 3, 4, 5],
      })).toMatchObject({ ok: false, reason: 'invalid-dice' })
    })

    it('falls when incapacitation ends the Fly spell concentration', () => {
      const attacker = fighter('attacker', 20, {
        controller: 'dm',
        position: { x: 0, y: 0 },
      })
      const flyer = fighter('flyer', 10, {
        position: { x: 5, y: 0 },
        currentHp: 5,
        maxHp: 20,
        elevationFeet: 30,
        groundElevationFeet: 0,
        airborne: true,
        movementSpeeds: { walk: 30 },
        concentrating: true,
        classState: {
          concentrationSpellId: 'fly',
          concentrationTargetIds: ['flyer'],
          activeEffects: [createDnd5eMechanicalEffect({
            id: 'fly-spell-effect',
            definitionId: 'srd-5.1:spell:fly',
            label: 'Fly',
            targetId: 'flyer',
            source: { kind: 'spell', actorId: 'flyer', rulesId: 'fly' },
            duration: { type: 'concentration', sourceActorId: 'flyer', concentrationId: 'fly' },
            modifiers: { flySpeedFeet: 60 },
          })],
        },
      })
      const state = startDnd5eHeadlessCombat('fly-concentration-loss', [attacker, flyer])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(attacker.id, flyer.id)]: 5,
      }
      const attack = {
        type: 'attack' as const,
        actorId: attacker.id,
        targetId: flyer.id,
        attackModifier: 20,
        d20: 10,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [6], type: 'slashing' as const },
      }
      expect(previewDnd5eUnsupportedAirborneFalls(state, attack)).toEqual({
        ok: true,
        falls: [expect.objectContaining({ combatantId: 'flyer', fallingDamageDice: 3 })],
      })

      const resolved = resolveDnd5eHeadlessAction(state, {
        ...attack,
        airborneFallDamageRollsByCombatantId: { flyer: [1, 1, 1] },
      })
      expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
      if (!resolved.ok) return
      expect(resolved.state.combatants.flyer).toMatchObject({
        elevationFeet: 0,
        groundElevationFeet: 0,
        airborne: false,
        concentrating: false,
      })
      expect(resolved.state.combatants.flyer.classState.concentrationSpellId).toBeUndefined()
      expect(resolved.state.combatants.flyer.classState.activeEffects?.some((effect) =>
        effect.modifiers?.flySpeedFeet != null)).not.toBe(true)
      expect(resolved.events).toContainEqual(expect.objectContaining({
        type: 'falling-damage-resolved',
        actorId: 'flyer',
        damage: 3,
      }))
    })

    it('falls when a speed penalty reduces native flight to zero', () => {
      const caster = fighter('caster', 20, {
        classId: 'wizard',
        level: 5,
        abilities: { ...abilities, int: 18 },
        classSelections: { 'spell-cantrips': ['ray-of-frost'] },
        position: { x: 0, y: 0 },
      })
      const flyer = fighter('flyer', 10, {
        controller: 'dm',
        armorClass: 10,
        position: { x: 30, y: 0 },
        elevationFeet: 30,
        groundElevationFeet: 0,
        airborne: true,
        movementSpeeds: { walk: 30, fly: 10 },
      })
      const state = startDnd5eHeadlessCombat('native-flight-speed-zero', [caster, flyer])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(caster.id, flyer.id)]: 30,
      }
      const action = {
        type: 'cast-spell' as const,
        actorId: caster.id,
        targetId: flyer.id,
        spellId: 'ray-of-frost',
        slotLevel: 0,
        d20: 15,
        effectRolls: [1, 1],
      }
      expect(previewDnd5eUnsupportedAirborneFalls(state, action)).toEqual({
        ok: true,
        falls: [expect.objectContaining({ combatantId: flyer.id, fallingDamageDice: 3 })],
      })
      const resolved = resolveDnd5eHeadlessAction(state, {
        ...action,
        airborneFallDamageRollsByCombatantId: { [flyer.id]: [1, 2, 3] },
      })
      expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
      if (!resolved.ok) return
      expect(dnd5eEffectiveFlySpeed(resolved.state.combatants.flyer)).toBeUndefined()
      expect(resolved.state.combatants.flyer).toMatchObject({
        elevationFeet: 0,
        airborne: false,
      })
    })

    it('previews and resolves falling when a persistent environmental support area disappears', () => {
      const heldAloft = createDnd5eMechanicalEffect({
        id: 'reverse-gravity-area-support',
        definitionId: 'persistent-area:reverse-gravity',
        label: 'Reverse Gravity support',
        targetId: 'flyer',
        source: { kind: 'system', rulesId: 'persistent-area-occupant:flyer', magical: true },
        duration: { type: 'permanent' },
        modifiers: { magicallyHeldAloft: true },
      })
      const before = startDnd5eHeadlessCombat('reverse-gravity-before', [fighter('flyer', 10, {
        currentHp: 20,
        elevationFeet: 30,
        groundElevationFeet: 0,
        airborne: true,
        classState: { activeEffects: [heldAloft] },
      })])
      const after = startDnd5eHeadlessCombat('reverse-gravity-after', [fighter('flyer', 10, {
        currentHp: 20,
        elevationFeet: 30,
        groundElevationFeet: 0,
        airborne: true,
      })])

      expect(previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after)).toEqual([{
        combatantId: 'flyer',
        fromElevationFeet: 30,
        groundElevationFeet: 0,
        fallDistanceFeet: 30,
        fallingDamageDice: 3,
      }])
      expect(resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(before, after, undefined))
        .toMatchObject({ ok: false, reason: 'invalid-dice' })

      const resolved = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(
        before,
        after,
        { flyer: [2, 3, 4] },
      )
      expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
      if (!resolved.ok) return
      expect(resolved.state.combatants.flyer).toMatchObject({
        currentHp: 11,
        elevationFeet: 0,
        groundElevationFeet: 0,
        airborne: false,
      })
      expect(resolved.state.combatants.flyer.conditions).toContain('prone')
      expect(resolved.events).toContainEqual(expect.objectContaining({
        type: 'falling-damage-resolved', actorId: 'flyer', damage: 9,
      }))
    })
  })
})
