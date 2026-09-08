import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eConditionalDamageDefense } from './damageDefenses'
import type { Dnd5eDamageType } from './damageTypes'
import { DND5E_DAGGER, DND5E_LEATHER_ARMOR } from './equipment'
import { DND5E_SRD_MONSTERS } from './monsters'
import { dnd5ePluginHeadlessActionDefinition, registerDnd5eRulesPlugin } from './pluginApi'
import {
  dnd5ePluginDiceRollDeclarationsForTargets,
  validateDnd5ePluginDiceRolls,
} from './pluginDice'
import {
  dnd5ePluginSpellDamageByTargetId,
  dnd5ePluginSpellElapsedCastingMinutes,
  dnd5ePluginSpellActivityResolutionRequiresDmAdjudication,
  prepareDnd5ePluginSpellCast,
  resolvePreparedDnd5ePluginSpellCast,
} from './pluginSpellTransaction'
import {
  prepareDnd5ePluginFeatureAction,
  resolvePreparedDnd5ePluginFeatureAction,
} from './pluginFeatureAction'
import { createDnd5eEffectiveRulesContextV1 } from './effectiveRulesContext'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import {
  createDnd5eMechanicalEffect,
  dnd5eActiveHitPointMaximumBonus,
  dnd5eActiveRuleStateIds,
} from './activeEffects'
import {
  dnd5eTargetArmorClassForAttack,
  dnd5eWeaponClassDamageDefinitions,
  endDnd5eConcentration,
  replaceDnd5eCombatantActiveEffects,
  resolveDnd5eHeadlessAction,
} from './headlessCombatEngine'
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import { applyDnd5eActivityMapHandoffsV1 } from './activities/dnd5eActivityMapInteraction'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { dnd5eSrdAuditedSpellActivityV1 } from './activities/dnd5eSrdAuditedSpellActivities'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import {
  dnd5eActivityHostSavingThrowModeV1,
  dnd5eActivityPerTargetRollDeclarationsV1,
} from './activities/dnd5eActivityPerTargetRolls'
import { createDnd5eTurnEconomyCounts, spendDnd5eTurnResource } from './turnEconomy'
import { createEmptyMapGeometry, mapGeometryMovementBlocked } from '../../lib/mapGeometry'
import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation'
import { compensateDnd5eCompletedLongCastApplication } from '../../pages/maps/commitDnd5eCombatResult'
import { settleDnd5eConcentrationChecks } from '../../pages/maps/settleDnd5eCombatResult'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'

function wizard(spellId: string): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'wizard', name: '法师', player: '', avatar: '', accent: '',
    race: '人类', charClass: '法师', level: 5, background: '', experience: 0, reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '5d6', ac: 14, speed: 30, initiativeBonus: 2,
    saveDC: 15, passivePerception: 11, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
    classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } },
  }
}

function token(id: string, type: 'player' | 'enemy', x: number, characterId?: string): Token {
  return { id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 }
}

describe('plugin spell CombatTransaction', () => {
  it('rejects visible-placement audited spells when the caster is blinded', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const actor = wizard('major-image')
    actor.conditions = ['blinded']
    actor.classResources = { 'dnd5e-spell-slot-8': { current: 1, max: 1 } }
    const actorToken = token('blinded-major-image-caster', 'player', 25, actor.id)
    const enemyToken = token('blinded-major-image-target', 'enemy', 75)
    const map: BattleMap = {
      id: 'blinded-major-image-map', name: 'Map', width: 1000, height: 600,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'blinded-major-image-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: enemyToken.id, targetTokenIds: [enemyToken.id],
      dnd5eSpellCast: {
        spellId: 'major-image', castingClassId: 'wizard', slotLevel: 8,
        targetTokenId: enemyToken.id, targetTokenIds: [], areaTargetCell: { col: 5, row: 5 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    expect(prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, enemyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })).toEqual({ ok: false, reason: 'spell-target-not-visible' })
  })

  it('requests an Activity DM boundary only when the dry Host resolution reaches it', () => {
    expect(dnd5ePluginSpellActivityResolutionRequiresDmAdjudication({
      result: { ok: false, reason: 'dm-adjudication-pending' } as never,
    })).toBe(true)
    expect(dnd5ePluginSpellActivityResolutionRequiresDmAdjudication({
      result: { ok: true } as never,
    })).toBe(false)
    expect(dnd5ePluginSpellActivityResolutionRequiresDmAdjudication({
      result: { ok: false, reason: 'invalid-dice' } as never,
    })).toBe(false)
  })

  it('gives a Drow advantage against Modify Memory and keeps the failed-save trance effects', async () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const actor = wizard('modify-memory')
    actor.level = 9
    actor.hitDice = '9d6'
    actor.dnd5eClassLevels = { wizard: 9 }
    actor.classResources = { 'dnd5e-spell-slot-5': { current: 1, max: 1 } }
    const actorToken = token('modify-memory-caster', 'player', 25, actor.id)
    const drowToken: Token = {
      ...token('modify-memory-drow', 'enemy', 125),
      label: '卓尔',
      poolId: 'srd-5.1:drow',
      hp: 13,
      maxHp: 13,
    }
    const map: BattleMap = {
      id: 'modify-memory-map', name: 'Modify Memory', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, drowToken],
    }
    const action: SharedPlayerActionState = {
      id: 'modify-memory-cast', mapId: map.id, combatId: 'modify-memory-combat',
      sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
      actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: drowToken.id,
      dnd5eSpellCast: {
        spellId: 'modify-memory', castingClassId: 'wizard', slotLevel: 5,
        targetTokenId: drowToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, drowToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder,
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const saveDeclaration = dnd5eActivityPerTargetRollDeclarationsV1({
      activity: prepared.prepared.activity!,
      declarations: dnd5ePluginHeadlessActionDefinition(
        prepared.prepared.spell.ownerPluginId,
        prepared.prepared.spell.automation.mode === 'headless-action'
          ? prepared.prepared.spell.automation.actionId
          : '',
      )?.perTargetRolls,
      actor: prepared.prepared.state.combatants[actorToken.id],
      targets: [prepared.prepared.state.combatants[drowToken.id]],
      hostSavingThrowMode: (targetId, check) => dnd5eActivityHostSavingThrowModeV1({
        activity: prepared.prepared.activity!,
        actor: prepared.prepared.state.combatants[actorToken.id],
        target: prepared.prepared.state.combatants[targetId],
        check,
        sourceDistanceFeet: 10,
      }),
      hostAttackRollMode: () => 'normal',
    })[0]
    expect(saveDeclaration).toMatchObject({
      id: `spell-save-d20:${drowToken.id}`,
      count: 2,
      rollerTokenId: drowToken.id,
    })

    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: {
        activityInterruptChoiceId: 'dm-apply',
        activityRolls: {
          [`spell-save-d20:${drowToken.id}`]: { values: [2, 3], modifier: 0, total: 5 },
        },
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    const drow = resolved.result.state.combatants[drowToken.id]
    expect(drow.conditions).toEqual(expect.arrayContaining(['charmed', 'incapacitated']))
    expect(drow.classState.activeEffects).toHaveLength(2)
    expect(drow.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        definitionId: 'activity:modify-memory:modify-memory-trance',
        standardCondition: 'charmed',
        breakOn: ['takes-damage', 'targeted-by-spell'],
        duration: expect.objectContaining({ type: 'concentration', remainingRounds: 10 }),
      }),
      expect.objectContaining({
        definitionId: 'activity:modify-memory:modify-memory-trance',
        standardCondition: 'incapacitated',
        breakOn: ['takes-damage', 'targeted-by-spell'],
        duration: expect.objectContaining({ type: 'concentration', remainingRounds: 10 }),
      }),
    ]))
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: drowToken.id,
    }))
    expect(resolved.application?.map.tokens.find((entry) => entry.id === drowToken.id)
      ?.dnd5eCombatState?.activeEffects).toHaveLength(2)
    expect(resolved.application?.tokenPatches?.[drowToken.id]
      ?.dnd5eCombatState?.activeEffects).toHaveLength(2)

    const settled = await settleDnd5eConcentrationChecks({
      result: resolved.result,
      map: resolved.application!.map,
      characters: resolved.application!.characters,
      priorApplication: resolved.application,
      characterIdByCombatantId: prepared.prepared.characterIdByCombatantId,
      rollD20: async () => 1,
      rollD4: async () => 1,
      rollDice: async (count) => Array.from({ length: count }, () => 1),
      settleActivityTriggers: async (request) => {
        const triggers = await settleDnd5eActivityTriggerWindowsV1({
          state: request.state,
          events: request.events,
          eventBatchId: 'modify-memory-live-settlement',
          combatRevision: 1,
          charactersByCombatantId: {},
          confirm: async () => false,
          roll: async (rollRequest) => Array.from({ length: rollRequest.count }, () => 1),
        })
        return { state: triggers.state, events: triggers.events }
      },
    })
    expect(settled.result.state.combatants[drowToken.id].classState.activeEffects).toHaveLength(2)
    expect(settled.application.tokenPatches?.[drowToken.id]
      ?.dnd5eCombatState?.activeEffects).toHaveLength(2)
  })

  it('keeps a creature-target Activity authoritative over a self-origin spell range', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const actor = wizard('detect-thoughts')
    const actorToken = token('detect-thoughts-wizard', 'player', 25, actor.id)
    const target = {
      ...token('detect-thoughts-bandit', 'enemy', 75),
      poolId: 'srd-5.1:bandit',
    }
    const map: BattleMap = {
      id: 'detect-thoughts-map', name: 'Detect Thoughts Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, target],
    }
    const action: SharedPlayerActionState = {
      id: 'detect-thoughts-cast', mapId: map.id,
      sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
      actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: target.id,
      dnd5eSpellCast: {
        spellId: 'detect-thoughts', castingClassId: 'wizard', slotLevel: 2,
        targetTokenId: target.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, target].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([target.id])
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).not.toContain(actorToken.id)
  })

  it('enforces Conjure Celestial CR 4 at 7th level and unlocks CR 5 only at 9th', () => {
    const actor = wizard('conjure-celestial')
    actor.id = 'conjure-celestial-cleric'
    actor.name = '召唤天界生物测试牧师'
    actor.charClass = '牧师'
    actor.level = 20
    actor.dnd5eClassLevels = { cleric: 20 }
    actor.abilities = { ...actor.abilities, wis: 20 }
    actor.dnd5eClassChoices = {
      classes: { cleric: { selections: { 'spell-prepared': ['conjure-celestial'] } } },
    }
    actor.classResources = {
      'dnd5e-spell-slot-7': { current: 1, max: 1 },
      'dnd5e-spell-slot-9': { current: 1, max: 1 },
    }
    const actorToken = token('conjure-celestial-cleric-token', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'conjure-celestial-map', name: 'Conjure Celestial Map', width: 1_000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action = (slotLevel: 7 | 9, monsterId: string): SharedPlayerActionState => ({
      id: `conjure-celestial-${slotLevel}-${monsterId}`, mapId: map.id,
      sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
      actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenIds: [], targetCell: { col: 8, row: 2 },
      dnd5eSpellCast: {
        spellId: 'conjure-celestial', castingClassId: 'cleric', slotLevel,
        targetTokenId: '', targetTokenIds: [], areaTargetCell: { col: 8, row: 2 },
        activityChoices: { mode: monsterId },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    })
    const prepare = (candidate: SharedPlayerActionState) => prepareDnd5ePluginSpellCast({
      action: candidate, map, characters: [actor],
      initiativeOrder: [{
        tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
      }],
      roomRequiredPlugins: [],
    })

    const seventhLevelCouatl = prepare(action(7, 'srd-5.1:couatl'))
    expect(seventhLevelCouatl.ok, seventhLevelCouatl.ok ? undefined : seventhLevelCouatl.reason).toBe(true)
    if (seventhLevelCouatl.ok) {
      expect(seventhLevelCouatl.prepared.activityTargetCell).toEqual({ col: 8, row: 2 })
      expect(seventhLevelCouatl.prepared.damageDice.count).toBe(0)
      expect(seventhLevelCouatl.prepared.concentrationRounds).toBe(600)
    }
    expect(prepare(action(7, 'srd-5.1:unicorn'))).toEqual({ ok: false, reason: 'invalid-action' })
    const ninthLevelUnicorn = prepare(action(9, 'srd-5.1:unicorn'))
    expect(ninthLevelUnicorn.ok, ninthLevelUnicorn.ok ? undefined : ninthLevelUnicorn.reason).toBe(true)
    if (ninthLevelUnicorn.ok) expect(ninthLevelUnicorn.prepared.damageDice.count).toBe(0)
  })

  it('enforces Conjure Elemental slot CR and keeps the spell damage-free', () => {
    const actor = wizard('conjure-elemental')
    actor.level = 20
    actor.dnd5eClassLevels = { wizard: 20 }
    actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['conjure-elemental'] } } },
    }
    actor.classResources = {
      'dnd5e-spell-slot-5': { current: 1, max: 1 },
      'dnd5e-spell-slot-6': { current: 1, max: 1 },
    }
    const actorToken = token('conjure-elemental-wizard-token', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'conjure-elemental-map', name: 'Conjure Elemental Map', width: 1_000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action = (slotLevel: 5 | 6, monsterId: string): SharedPlayerActionState => ({
      id: `conjure-elemental-${slotLevel}-${monsterId}`, mapId: map.id,
      sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
      actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenIds: [], targetCell: { col: 8, row: 2 },
      dnd5eSpellCast: {
        spellId: 'conjure-elemental', castingClassId: 'wizard', slotLevel,
        targetTokenId: '', targetTokenIds: [], areaTargetCell: { col: 8, row: 2 },
        activityChoices: { mode: monsterId },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    })
    const prepare = (candidate: SharedPlayerActionState) => prepareDnd5ePluginSpellCast({
      action: candidate, map, characters: [actor],
      initiativeOrder: [{
        tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
      }],
      roomRequiredPlugins: [],
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })

    const fifthLevelFireElemental = prepare(action(5, 'srd-5.1:fire-elemental'))
    expect(fifthLevelFireElemental.ok, fifthLevelFireElemental.ok ? undefined : fifthLevelFireElemental.reason).toBe(true)
    if (fifthLevelFireElemental.ok) {
      expect(fifthLevelFireElemental.prepared.damageDice.count).toBe(0)
      expect(fifthLevelFireElemental.prepared.concentrationRounds).toBe(600)
      expect(fifthLevelFireElemental.prepared.activityTargetCells).toHaveLength(4)
    }
    expect(prepare(action(5, 'srd-5.1:invisible-stalker')))
      .toEqual({ ok: false, reason: 'invalid-action' })
    const sixthLevelInvisibleStalker = prepare(action(6, 'srd-5.1:invisible-stalker'))
    expect(sixthLevelInvisibleStalker.ok, sixthLevelInvisibleStalker.ok ? undefined : sixthLevelInvisibleStalker.reason).toBe(true)
    if (sixthLevelInvisibleStalker.ok) {
      expect(sixthLevelInvisibleStalker.prepared.damageDice.count).toBe(0)
    }
  })

  it('enforces Conjure Fey upcast CR without adding direct spell damage', () => {
    const actor = wizard('conjure-fey')
    actor.id = 'conjure-fey-druid'
    actor.name = '召唤精类生物测试德鲁伊'
    actor.charClass = '德鲁伊'
    actor.level = 20
    actor.dnd5eClassLevels = { druid: 20 }
    actor.abilities = { ...actor.abilities, wis: 20 }
    actor.dnd5eClassChoices = {
      classes: { druid: { selections: { 'spell-prepared': ['conjure-fey'] } } },
    }
    actor.classResources = {
      'dnd5e-spell-slot-6': { current: 1, max: 1 },
      'dnd5e-spell-slot-7': { current: 1, max: 1 },
    }
    const actorToken = token('conjure-fey-druid-token', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'conjure-fey-map', name: 'Conjure Fey Map', width: 1_000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action = (slotLevel: 6 | 7, monsterId: string): SharedPlayerActionState => ({
      id: `conjure-fey-${slotLevel}-${monsterId}`, mapId: map.id,
      sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
      actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenIds: [], targetCell: { col: 8, row: 2 },
      dnd5eSpellCast: {
        spellId: 'conjure-fey', castingClassId: 'druid', slotLevel,
        targetTokenId: '', targetTokenIds: [], areaTargetCell: { col: 8, row: 2 },
        activityChoices: { mode: monsterId },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    })
    const prepare = (candidate: SharedPlayerActionState) => prepareDnd5ePluginSpellCast({
      action: candidate, map, characters: [actor],
      initiativeOrder: [{
        tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
      }],
      roomRequiredPlugins: [],
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })

    const sixthLevelMammoth = prepare(action(6, 'srd-5.1:mammoth'))
    expect(sixthLevelMammoth.ok, sixthLevelMammoth.ok ? undefined : sixthLevelMammoth.reason).toBe(true)
    if (sixthLevelMammoth.ok) {
      expect(sixthLevelMammoth.prepared.damageDice.count).toBe(0)
      expect(sixthLevelMammoth.prepared.concentrationRounds).toBe(600)
      expect(sixthLevelMammoth.prepared.activityTargetCells).toHaveLength(1)
    }
    expect(prepare(action(6, 'srd-5.1:giant-ape')))
      .toEqual({ ok: false, reason: 'invalid-action' })
    const seventhLevelGiantApe = prepare(action(7, 'srd-5.1:giant-ape'))
    expect(seventhLevelGiantApe.ok, seventhLevelGiantApe.ok ? undefined : seventhLevelGiantApe.reason).toBe(true)
    if (seventhLevelGiantApe.ok) expect(seventhLevelGiantApe.prepared.damageDice.count).toBe(0)
  })

  it('enforces Conjure Minor Elementals formation CR without adding direct spell damage', () => {
    const actor = wizard('conjure-minor-elementals')
    actor.id = 'minor-elementals-wizard'
    actor.name = '召唤次级元素生物测试法师'
    actor.level = 20
    actor.dnd5eClassLevels = { wizard: 20 }
    actor.dnd5eClassChoices = {
      classes: { wizard: { selections: { 'spell-prepared': ['conjure-minor-elementals'] } } },
    }
    actor.classResources = {
      'dnd5e-spell-slot-4': { current: 1, max: 1 },
      'dnd5e-spell-slot-6': { current: 1, max: 1 },
    }
    const actorToken = token('minor-elementals-wizard-token', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'minor-elementals-map', name: 'Minor Elementals Map', width: 1_000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action = (
      slotLevel: 4 | 6,
      formation: string,
      monsterId: string,
    ): SharedPlayerActionState => ({
      id: `minor-elementals-${slotLevel}-${formation}-${monsterId}`, mapId: map.id,
      sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
      actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenIds: [], targetCell: { col: 8, row: 2 },
      dnd5eSpellCast: {
        spellId: 'conjure-minor-elementals', castingClassId: 'wizard', slotLevel,
        targetTokenId: '', targetTokenIds: [], areaTargetCell: { col: 8, row: 2 },
        activityChoices: { formation, mode: monsterId },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    })
    const prepare = (candidate: SharedPlayerActionState) => prepareDnd5ePluginSpellCast({
      action: candidate, map, characters: [actor],
      initiativeOrder: [{
        tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
      }],
      roomRequiredPlugins: [],
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })

    const legalAzer = prepare(action(4, 'one-cr-2', 'srd-5.1:azer'))
    expect(legalAzer.ok, legalAzer.ok ? undefined : legalAzer.reason).toBe(true)
    if (legalAzer.ok) {
      expect(legalAzer.prepared.damageDice.count).toBe(0)
      expect(legalAzer.prepared.concentrationRounds).toBe(600)
    }
    expect(prepare(action(4, 'two-cr-1', 'srd-5.1:azer')))
      .toEqual({ ok: false, reason: 'invalid-action' })
    const sixthLevelAzerPair = prepare(action(6, 'one-cr-2', 'srd-5.1:azer'))
    expect(sixthLevelAzerPair.ok, sixthLevelAzerPair.ok ? undefined : sixthLevelAzerPair.reason).toBe(true)
    if (sixthLevelAzerPair.ok) expect(sixthLevelAzerPair.prepared.damageDice.count).toBe(0)
  })

  it('enforces Conjure Woodland Beings formation CR and count scaling without direct spell damage', () => {
    const actor = wizard('conjure-woodland-beings')
    actor.id = 'woodland-druid'
    actor.name = '召唤林地之精测试德鲁伊'
    actor.charClass = '德鲁伊'
    actor.level = 20
    actor.dnd5eClassLevels = { druid: 20 }
    actor.abilities = { ...actor.abilities, wis: 20 }
    actor.dnd5eClassChoices = {
      classes: { druid: { selections: { 'spell-prepared': ['conjure-woodland-beings'] } } },
    }
    actor.classResources = {
      'dnd5e-spell-slot-4': { current: 1, max: 1 },
      'dnd5e-spell-slot-6': { current: 1, max: 1 },
    }
    const actorToken = token('woodland-druid-token', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'woodland-map', name: 'Woodland Map', width: 1_000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action = (
      slotLevel: 4 | 6,
      formation: string,
      monsterId: string,
    ): SharedPlayerActionState => ({
      id: `woodland-${slotLevel}-${formation}-${monsterId}`, mapId: map.id,
      sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
      actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenIds: [], targetCell: { col: 8, row: 2 },
      dnd5eSpellCast: {
        spellId: 'conjure-woodland-beings', castingClassId: 'druid', slotLevel,
        targetTokenId: '', targetTokenIds: [], areaTargetCell: { col: 8, row: 2 },
        activityChoices: { formation, mode: monsterId },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    })
    const prepare = (candidate: SharedPlayerActionState) => prepareDnd5ePluginSpellCast({
      action: candidate, map, characters: [actor],
      initiativeOrder: [{
        tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
      }],
      roomRequiredPlugins: [],
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })

    const legalSeaHag = prepare(action(4, 'one-cr-2', 'srd-5.1:sea-hag'))
    expect(legalSeaHag.ok, legalSeaHag.ok ? undefined : legalSeaHag.reason).toBe(true)
    if (legalSeaHag.ok) {
      expect(legalSeaHag.prepared.damageDice.count).toBe(0)
      expect(legalSeaHag.prepared.concentrationRounds).toBe(600)
    }
    expect(prepare(action(4, 'two-cr-1', 'srd-5.1:sea-hag')))
      .toEqual({ ok: false, reason: 'invalid-action' })
    const sixthLevelSeaHagPair = prepare(action(6, 'one-cr-2', 'srd-5.1:sea-hag'))
    expect(sixthLevelSeaHagPair.ok, sixthLevelSeaHagPair.ok ? undefined : sixthLevelSeaHagPair.reason)
      .toBe(true)
    if (sixthLevelSeaHagPair.ok) expect(sixthLevelSeaHagPair.prepared.damageDice.count).toBe(0)
  })

  it('casts Illusory Script without material inventory when prerequisite checks are disabled', () => {
    const actor = wizard('illusory-script')
    const actorToken = token('illusory-script-caster', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'illusory-script-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'illusory-script-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
      dnd5eSpellCast: {
        spellId: 'illusory-script', castingClassId: 'wizard', slotLevel: 2,
        targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }

    const prepared = prepareDnd5ePluginSpellCast({
      action,
      map,
      characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
  })

  it('accepts all five Command targets during Host preparation at 5th level', () => {
    const actor = wizard('command')
    actor.id = 'command-cleric'
    actor.name = '命令术牧师'
    actor.charClass = '牧师'
    actor.level = 9
    actor.dnd5eClassLevels = { cleric: 9 }
    actor.abilities = { ...actor.abilities, wis: 20 }
    actor.dnd5eClassChoices = {
      classes: { cleric: { selections: { 'spell-prepared': ['command'] } } },
    }
    actor.classResources = { 'dnd5e-spell-slot-5': { current: 1, max: 1 } }
    const actorToken = token('command-cleric-token', 'player', 25, actor.id)
    const targets = Array.from({ length: 5 }, (_, index) =>
      token(`command-target-${index + 1}`, 'enemy', 75 + index * 50),
    )
    const map: BattleMap = {
      id: 'command-map', name: 'Command Map', width: 1_000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, ...targets],
    }
    const targetTokenIds = targets.map((target) => target.id)
    const action: SharedPlayerActionState = {
      id: 'command-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: targetTokenIds[0], targetTokenIds,
      dnd5eSpellCast: {
        spellId: 'command', castingClassId: 'cleric', slotLevel: 5,
        targetTokenId: targetTokenIds[0], targetTokenIds,
        activityChoices: { 'command-mode': 'halt' },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = map.tokens.map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))

    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((target) => target.id)).toEqual(targetTokenIds)
    expect(prepared.prepared.activityHeadlessAction?.targetIds).toEqual(targetTokenIds)
  })

  it('preserves the player UI area selection when creating Arcane Hand', async () => {
    const actor = wizard('arcane-hand')
    actor.level = 20
    actor.maxHp = 162
    actor.currentHp = 162
    actor.abilities = { ...actor.abilities, int: 20 }
    actor.classResources = {
      'dnd5e-spell-slot-5': { current: 1, max: 3 },
      'dnd5e-spell-slot-6': { current: 1, max: 2 },
    }
    const actorToken = token('arcane-hand-caster', 'player', 375, actor.id)
    actorToken.y = 375
    const map: BattleMap = {
      id: 'arcane-hand-map', name: 'Map', width: 1_000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'arcane-hand-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds: [],
      dnd5eSpellCast: {
        spellId: 'arcane-hand', castingClassId: 'wizard', slotLevel: 6,
        targetTokenId: actorToken.id, targetTokenIds: [], areaTargetCell: { col: 17, row: 2 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.activityTargetCell).toEqual({ col: 17, row: 2 })
    expect(prepared.prepared.activityTargetCells).not.toHaveLength(0)
    expect(prepared.prepared.activityAreaPlacement).toBeDefined()

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.activityHandoffs?.persistentAreas).toHaveLength(1)
    const areaPlacement = resolved.result.activityAreaInstance ?? prepared.prepared.activityAreaPlacement
    expect(areaPlacement).toBeDefined()
    const applied = applyDnd5eActivityMapHandoffsV1({
      map: resolved.application!.map,
      activity: resolved.result.activityDefinition!,
      packageId: prepared.prepared.spell.ownerPluginId,
      actionId: action.id,
      actorId: actorToken.id,
      sourceSaveDc: prepared.prepared.saveDc,
      castLevel: prepared.prepared.slotLevel,
      concentrationId: prepared.prepared.spell.id,
      round: 1,
      handoffs: resolved.result.activityHandoffs!,
      areaSelection: {
        anchorCell: prepared.prepared.activityTargetCell!,
        cells: prepared.prepared.activityTargetCells,
        targetIds: [],
        areaPlacement: areaPlacement!,
        areaPlacementDistanceFeet: prepared.prepared.activityAreaPlacementDistanceFeet ?? 0,
      },
      selection: {},
    })
    expect(applied.ok, applied.ok ? undefined : applied.reason).toBe(true)
    if (!applied.ok) return
    expect(applied.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'arcane-hand',
      slotLevel: 6,
      sourceSpellSaveDc: 19,
      entityProfile: {
        armorClass: 20,
        hitPoints: 162,
        strength: 26,
        dexterity: 10,
        cannotAttack: true,
        invisible: false,
      },
    })
    const area = applied.map.dnd5ePluginAreas![0]!
    const target = token('arcane-hand-target', 'enemy', 825)
    target.y = 125
    const featureMap: BattleMap = {
      ...applied.map,
      tokens: [...applied.map.tokens, target],
    }
    const featureAction: SharedPlayerActionState = {
      id: 'arcane-hand-fist', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-plugin-action', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: target.id, targetTokenIds: [target.id],
      dnd5ePluginAction: {
        featureId: 'srd-5.1:area-control.spell:arcane-hand:clenched-fist',
        payload: { persistentAreaId: area.id },
      },
      round: 1, initiativeIndex: 0, seq: 2, updatedAt: 2,
    }
    const featurePrepared = prepareDnd5ePluginFeatureAction({
      action: featureAction,
      map: featureMap,
      characters: resolved.application!.characters,
      initiativeOrder: [actorToken, target].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
    })
    expect(featurePrepared.ok, featurePrepared.ok ? undefined : featurePrepared.reason).toBe(true)
    if (!featurePrepared.ok) return
    expect(featurePrepared.prepared.headlessAction.castLevel).toBe(6)
    expect(featurePrepared.prepared.state.combatants[actorToken.id]?.saveDc).toBe(19)

    const forcefulAction: SharedPlayerActionState = {
      ...featureAction,
      id: 'arcane-hand-forceful',
      dnd5ePluginAction: {
        featureId: 'srd-5.1:area-control.spell:arcane-hand:forceful-hand',
        payload: { persistentAreaId: area.id },
      },
    }
    const forcefulPrepared = prepareDnd5ePluginFeatureAction({
      action: forcefulAction,
      map: featureMap,
      characters: resolved.application!.characters,
      initiativeOrder: [actorToken, target].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
    })
    expect(forcefulPrepared.ok, forcefulPrepared.ok ? undefined : forcefulPrepared.reason).toBe(true)
    if (!forcefulPrepared.ok) return
    const forcefulRolls = {
      [`arcane-hand-strength-d20:${target.id}`]: { values: [10, 15], modifier: 0, total: 25 },
      [`arcane-hand-target-d20:${target.id}`]: { values: [10, 12], modifier: 0, total: 22 },
    }
    const forcefulDefinition = dnd5ePluginHeadlessActionDefinition(
      'srd-5.1',
      'spell:arcane-hand:forceful-hand',
    )!
    expect(validateDnd5ePluginDiceRolls({
      rolls: dnd5ePluginDiceRollDeclarationsForTargets(
        forcefulDefinition,
        [{ id: target.id, name: target.label }],
      ),
    }, forcefulRolls)).toBe(true)
    const forceful = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: forcefulPrepared.prepared,
      rolls: forcefulRolls,
    })
    expect(forceful.result.ok, forceful.result.ok ? undefined : forceful.result.reason).toBe(true)
    if (!forceful.result.ok) throw new Error(forceful.result.reason)
    expect(forceful.result.activityHandoffs?.movements).toEqual([expect.objectContaining({
      operationId: 'arcane-hand-push',
      targetId: target.id,
      mode: 'push',
      distanceFeet: 30,
    })])
    expect(forceful.result.activityHandoffs?.areaRelocations).toEqual([expect.objectContaining({
      operationId: 'relocate-arcane-hand',
      targetId: target.id,
      maximumFeet: 60,
    })])

    const graspAction: SharedPlayerActionState = {
      ...featureAction,
      id: 'arcane-hand-grasp',
      dnd5ePluginAction: {
        featureId: 'srd-5.1:area-control.spell:arcane-hand:grasping-hand',
        payload: { persistentAreaId: area.id },
      },
    }
    const graspPrepared = prepareDnd5ePluginFeatureAction({
      action: graspAction,
      map: featureMap,
      characters: resolved.application!.characters,
      initiativeOrder: [actorToken, target].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
    })
    expect(graspPrepared.ok, graspPrepared.ok ? undefined : graspPrepared.reason).toBe(true)
    if (!graspPrepared.ok) return
    const grasp = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: graspPrepared.prepared,
      rolls: forcefulRolls,
    })
    expect(grasp.result.ok, grasp.result.ok ? undefined : grasp.result.reason).toBe(true)
    if (!grasp.result.ok) throw new Error(grasp.result.reason)
    expect(grasp.result.state.combatants[target.id]?.conditions).toContain('grappled')
    expect(grasp.result.state.combatants[target.id]?.classState.activeEffects).toEqual(
      expect.arrayContaining([expect.objectContaining({
        definitionId: expect.stringContaining('arcane-hand-grappled'),
        duration: expect.objectContaining({ type: 'concentration' }),
        source: expect.objectContaining({
          actorId: actorToken.id,
          rulesId: 'srd-5.1:spell:arcane-hand:grasping-hand',
        }),
        removal: undefined,
      })]),
    )
    expect(grasp.result.state.combatants[actorToken.id]).toMatchObject({
      concentrating: true,
      classState: { concentrationSpellId: 'arcane-hand' },
    })
    expect(grasp.application).toBeDefined()
    if (!grasp.application) return

    const squeezeAction: SharedPlayerActionState = {
      ...featureAction,
      id: 'arcane-hand-squeeze',
      dnd5ePluginAction: {
        featureId: 'srd-5.1:area-control.spell:arcane-hand:squeeze',
        payload: { persistentAreaId: area.id },
      },
    }
    const squeezePrepared = prepareDnd5ePluginFeatureAction({
      action: squeezeAction,
      map: grasp.application.map,
      characters: grasp.application.characters,
      initiativeOrder: [actorToken, target].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
    })
    expect(squeezePrepared.ok, squeezePrepared.ok ? undefined : squeezePrepared.reason).toBe(true)
    if (!squeezePrepared.ok) return
    expect(squeezePrepared.prepared.headlessAction.castLevel).toBe(6)
    const squeeze = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: squeezePrepared.prepared,
      rolls: {
        'arcane-hand-squeeze-damage': { values: [1, 2, 3, 4], modifier: 0, total: 10 },
      },
    })
    expect(squeeze.result.ok, squeeze.result.ok ? undefined : squeeze.result.reason).toBe(true)
    if (!squeeze.result.ok) throw new Error(squeeze.result.reason)
    expect(squeeze.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      targetId: target.id,
      amount: 15,
    }))
    expect(squeeze.result.state.combatants[target.id]?.currentHp).toBe(15)

    const interposeAction: SharedPlayerActionState = {
      ...featureAction,
      id: 'arcane-hand-interpose',
      dnd5ePluginAction: {
        featureId: 'srd-5.1:area-control.spell:arcane-hand:interposing-hand',
        payload: { persistentAreaId: area.id },
      },
    }
    const interposePrepared = prepareDnd5ePluginFeatureAction({
      action: interposeAction,
      map: grasp.application.map,
      characters: grasp.application.characters,
      initiativeOrder: [actorToken, target].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
    })
    expect(interposePrepared.ok, interposePrepared.ok ? undefined : interposePrepared.reason).toBe(true)
    if (!interposePrepared.ok) return
    const baseArmorClass = interposePrepared.prepared.state.combatants[actorToken.id]!.armorClass
    const interpose = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: interposePrepared.prepared,
      rolls: {},
    })
    expect(interpose.result.ok, interpose.result.ok ? undefined : interpose.result.reason).toBe(true)
    if (!interpose.result.ok) throw new Error(interpose.result.reason)
    expect(interpose.result.state.combatants[target.id]?.conditions).not.toContain('grappled')
    expect(interpose.result.state.combatants[target.id]?.classState.activeEffects).not.toEqual(
      expect.arrayContaining([expect.objectContaining({
        definitionId: expect.stringContaining('arcane-hand-grappled'),
      })]),
    )
    expect(dnd5eTargetArmorClassForAttack(
      interpose.result.state,
      target.id,
      actorToken.id,
    )).toBe(baseArmorClass + 2)
    expect(interpose.result.state.combatants[actorToken.id]?.classState.activeEffects).not.toEqual(
      expect.arrayContaining([expect.objectContaining({
        definitionId: expect.stringContaining('arcane-hand-half-cover'),
      })]),
    )
    expect(interpose.result.state.combatants[target.id]?.classState.activeEffects).toEqual(
      expect.arrayContaining([expect.objectContaining({
        definitionId: expect.stringContaining('arcane-hand-half-cover'),
        source: expect.objectContaining({ actorId: actorToken.id }),
        modifiers: expect.objectContaining({ attacksAgainstSourceArmorClassBonus: 2 }),
      })]),
    )
    const otherAttacker = {
      ...interpose.result.state.combatants[target.id]!,
      id: 'other-attacker',
      classState: {
        ...interpose.result.state.combatants[target.id]!.classState,
        activeEffects: [],
      },
    }
    interpose.result.state.combatants[otherAttacker.id] = otherAttacker
    expect(dnd5eTargetArmorClassForAttack(
      interpose.result.state,
      otherAttacker.id,
      actorToken.id,
    )).toBe(baseArmorClass)
    expect(interpose.result.state.combatants[actorToken.id]).toMatchObject({
      concentrating: true,
      classState: { concentrationSpellId: 'arcane-hand' },
    })
    expect(interpose.result.activityHandoffs?.areaRelocations).toEqual([expect.objectContaining({
      operationId: 'relocate-arcane-hand',
      targetId: target.id,
      maximumFeet: 60,
      interposition: 'blocked',
    })])
    expect(interpose.application).toBeDefined()
    if (!interpose.application) return
    const interposedMap = applyDnd5eActivityMapHandoffsV1({
      map: interpose.application.map,
      activity: interpose.result.activityDefinition!,
      packageId: interposePrepared.prepared.feature.ownerPluginId,
      actionId: interposeAction.id,
      actorId: actorToken.id,
      sourceSaveDc: 19,
      castLevel: 6,
      concentrationId: 'arcane-hand',
      round: 1,
      handoffs: interpose.result.activityHandoffs!,
      selection: {},
      grantingPersistentAreaId: area.id,
    })
    expect(interposedMap.ok, interposedMap.ok ? undefined : interposedMap.reason).toBe(true)
    if (!interposedMap.ok) return
    const interposedArea = interposedMap.map.dnd5ePluginAreas?.find((candidate) => candidate.id === area.id)
    expect(interposedArea?.interposition).toEqual({
      targetTokenId: target.id,
      mode: 'blocked',
    })
    const handToken = interposedMap.map.tokens.find((candidate) => candidate.id === interposedArea?.anchorTokenId)
    expect(handToken).toBeDefined()
    expect(handToken).not.toMatchObject({ x: target.x, y: target.y })
    expect(mapGeometryMovementBlocked({
      geometry: createEmptyMapGeometry(interposedMap.map.id),
      map: interposedMap.map,
      token: target,
      to: handToken!,
    })).toMatchObject({ blocked: true, entityId: area.id })
  })

  it('casts Wind Walk on selected exploration NPCs that are not in permanent initiative', () => {
    const initialActor = wizard('wind-walk')
    initialActor.id = 'wind-walk-druid'
    initialActor.name = '德鲁伊'
    initialActor.charClass = '德鲁伊'
    initialActor.level = 20
    initialActor.dnd5eClassLevels = { druid: 20 }
    initialActor.abilities = { ...initialActor.abilities, wis: 20 }
    initialActor.dnd5eClassChoices = {
      classes: { druid: { selections: { 'spell-prepared': ['wind-walk'] } } },
    }
    initialActor.classResources = {
      'dnd5e-spell-slot-6': { current: 1, max: 2 },
      'dnd5e-spell-slot-7': { current: 2, max: 2 },
    }
    initialActor.dnd5eWorldTimeAppliedMinute = 1_000
    const granted = applyDnd5eInventoryMutation([initialActor], {
      type: 'grant', characterId: initialActor.id,
      templateId: 'srd-5.1:item:druidic-focus', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    const focus = normalizeDnd5eInventory(granted.characters[0]).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:druidic-focus',
    )!
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: initialActor.id, instanceId: focus.instanceId,
    })
    expect(equipped.ok).toBe(true)
    const actor = equipped.characters[0]
    const actorToken = token('wind-walk-caster', 'player', 25, actor.id)
    const firstNpc: Token = {
      id: 'wind-walk-npc-1', label: '自愿 NPC 一', x: 75, y: 25,
      color: '', emoji: '🧑', size: 1, type: 'npc', hp: 12, maxHp: 12,
    }
    const secondNpc: Token = {
      ...firstNpc, id: 'wind-walk-npc-2', label: '自愿 NPC 二', x: 125,
    }
    const map: BattleMap = {
      id: 'wind-walk-exploration-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, firstNpc, secondNpc],
    }
    const targetTokenIds = [actorToken.id, firstNpc.id, secondNpc.id]
    const action: SharedPlayerActionState = {
      id: 'wind-walk-exploration-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds,
      dnd5eSpellCast: {
        spellId: 'wind-walk', castingClassId: 'druid', focusItemInstanceId: focus.instanceId,
        slotLevel: 6, targetTokenId: actorToken.id, targetTokenIds,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens).toHaveLength(3)
    expect(prepared.prepared.state.combatants[firstNpc.id]).toBeDefined()
    expect(prepared.prepared.state.combatants[secondNpc.id]).toBeDefined()

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    for (const token of [actorToken, firstNpc, secondNpc]) {
      const effects = resolved.result.state.combatants[token.id].classState.activeEffects
      expect(effects).toContainEqual(
        expect.objectContaining({
          definitionId: expect.stringContaining('wind-walk-controller'),
          source: expect.objectContaining({ rulesId: 'wind-walk' }),
          grantedActivities: ['spell:wind-walk:begin-cloud-form'],
        }),
      )
      expect(effects).toContainEqual(expect.objectContaining({
        definitionId: expect.stringContaining('wind-walk-cloud-form'),
        source: expect.objectContaining({ rulesId: 'wind-walk' }),
        grantedActivities: ['spell:wind-walk:begin-normal-form'],
        suspendedBy: undefined,
        modifiers: expect.objectContaining({
          flySpeedFeet: 300,
          actionRestriction: expect.objectContaining({
            prohibited: ['attack', 'spellcasting', 'object-interaction'],
          }),
        }),
      }))
    }
    expect(resolved.application?.map.tokens.find((token) => token.id === firstNpc.id)?.type).toBe('npc')
    expect(resolved.application?.characters[0].classResources?.['dnd5e-spell-slot-6'].current).toBe(0)

    const recastAction: SharedPlayerActionState = {
      ...action,
      id: 'wind-walk-exploration-recast',
      dnd5eSpellCast: { ...action.dnd5eSpellCast!, slotLevel: 7 },
    }
    const recastCharacters = resolved.application!.characters.map((character) => {
      if (character.id !== actor.id) return character
      const activeEffects = character.dnd5eCombatState?.activeEffects ?? []
      const baseCloud = activeEffects.find((effect) => effect.definitionId.includes('wind-walk-cloud-form'))
      const legacyControlCloud = baseCloud
        ? {
            ...baseCloud,
            id: 'legacy-wind-walk-control-cloud',
            definitionId: 'activity:srd-5.1:spell:wind-walk:begin-cloud-form:wind-walk-cloud-form:modifiers:0',
            stackingKey: 'activity:srd-5.1:spell:wind-walk:begin-cloud-form:wind-walk-cloud-form:modifiers:0:wind-walk-caster',
            source: { ...baseCloud.source, rulesId: 'srd-5.1:spell:wind-walk:begin-cloud-form' },
            suspendedBy: ['expired-transition'],
          }
        : undefined
      return {
        ...character,
        dnd5eCombatState: {
          ...character.dnd5eCombatState,
          activeEffects: [
            ...activeEffects.map((effect) => effect.definitionId.includes('wind-walk-cloud-form')
              ? { ...effect, suspendedBy: ['expired-transition'] }
              : effect),
            ...(legacyControlCloud ? [legacyControlCloud] : []),
          ],
        },
      }
    })
    const recastPrepared = prepareDnd5ePluginSpellCast({
      action: recastAction,
      map: resolved.application!.map,
      characters: recastCharacters,
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(recastPrepared.ok, recastPrepared.ok ? undefined : recastPrepared.reason).toBe(true)
    if (!recastPrepared.ok) return
    const recast = resolvePreparedDnd5ePluginSpellCast({ prepared: recastPrepared.prepared, rolls: {} })
    expect(recast.result.ok, recast.result.ok ? undefined : recast.result.reason).toBe(true)
    if (!recast.result.ok) throw new Error(recast.result.reason)
    expect(recast.application?.characters[0].classResources?.['dnd5e-spell-slot-7'].current).toBe(1)
    expect(recast.application?.characterPatches?.[actor.id]?.classResources?.['dnd5e-spell-slot-7'].current).toBe(1)
    const recastEffects = recast.application?.characters[0].dnd5eCombatState?.activeEffects ?? []
    expect(recastEffects.filter((effect) => effect.definitionId.includes('wind-walk-controller'))).toHaveLength(1)
    expect(recastEffects.filter((effect) => effect.definitionId.includes('wind-walk-cloud-form'))).toHaveLength(1)
    expect(recastEffects.some((effect) => effect.id === 'legacy-wind-walk-control-cloud')).toBe(false)
    const effectSelectors = new Set(recast.result.events.flatMap((event) =>
      event.type === 'active-effect-applied' || event.type === 'active-effect-refreshed'
        ? [event.effectId, event.definitionId]
        : [],
    ))
    const compensated = compensateDnd5eCompletedLongCastApplication(
      recast.application!,
      new Map([[actor.id, effectSelectors]]),
      1,
      {
        schemaVersion: 2, worldMinute: 1_001, displayMode: 'campaign-day', displayMinuteOffset: 0,
        timers: [], advances: [], updatedAt: 2,
      },
    )
    expect(compensated.characterPatches?.[actor.id]?.classResources?.['dnd5e-spell-slot-7'].current).toBe(1)
    expect(compensated.characterPatches?.[actor.id]?.dnd5eCombatState?.activeEffects).toEqual(
      expect.arrayContaining([expect.objectContaining({
        definitionId: expect.stringContaining('wind-walk-cloud-form'),
        duration: expect.objectContaining({ remainingRounds: 4_800 }),
      })]),
    )
  })

  it('does not let an audited healing spell restore a persisted simulacrum', () => {
    const actor = wizard('regenerate')
    actor.id = 'cleric'
    actor.name = '牧师'
    actor.charClass = '牧师'
    actor.level = 20
    actor.dnd5eClassLevels = { cleric: 20 }
    actor.abilities = { ...actor.abilities, wis: 20 }
    actor.dnd5eClassChoices = { classes: { cleric: { selections: { 'spell-prepared': ['regenerate'] } } } }
    actor.classResources = { 'dnd5e-spell-slot-7': { current: 2, max: 2 } }
    const subject = wizard('magic-missile')
    subject.id = 'subject'
    subject.name = '法师本体'
    subject.level = 20
    subject.dnd5eClassLevels = { wizard: 20 }
    subject.maxHp = 162
    subject.currentHp = 135
    subject.classResources = { 'dnd5e-spell-slot-7': { current: 1, max: 2 } }
    const actorToken = token('cleric-token', 'player', 25, actor.id)
    const duplicate = {
      ...token('activity-simulacrum:subject-token', 'player', 75, subject.id),
      label: '法师本体·拟像', hp: 70, maxHp: 81,
      dnd5eSimulacrum: {
        schemaVersion: 1 as const,
        sourceTokenId: 'subject-token', subjectTokenId: 'subject-token',
        sourceCharacterId: subject.id, sourceActivityId: 'simulacrum', createdRound: 1,
        level: 20, proficiencyBonus: 6, abilities: { ...subject.abilities },
        armorClass: 13, maximumHitPoints: 81, speed: 30, sizeRank: 2,
        creatureType: 'humanoid', saveDc: 19, classLevels: { wizard: 20 },
        classResources: { 'dnd5e-spell-slot-7': { current: 2, maximum: 2 } },
        cannotIncreaseLevel: true as const,
        cannotRegainSpellSlots: true as const,
        cannotRegainHitPoints: true as const,
      },
    }
    const map: BattleMap = {
      id: 'simulacrum-healing-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, duplicate],
    }
    const action: SharedPlayerActionState = {
      id: 'regenerate-simulacrum', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: duplicate.id, targetTokenIds: [duplicate.id],
      dnd5eSpellCast: {
        spellId: 'regenerate', castingClassId: 'cleric', slotLevel: 7,
        targetTokenId: duplicate.id, targetTokenIds: [duplicate.id],
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, duplicate].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))

    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor, subject], initiativeOrder,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[duplicate.id].simulacrumCannotRegainHitPoints).toBe(true)

    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: { activityRolls: {
        'regenerate-initial-healing': { values: [8, 8, 8, 8], modifier: 0, total: 32 },
      } },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.state.combatants[duplicate.id].simulacrumCannotRegainHitPoints).toBe(true)
    expect(resolved.result.events.filter((event) => event.type === 'healing-applied')).toEqual([])
    expect(resolved.result.state.combatants[duplicate.id].currentHp).toBe(70)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === duplicate.id)?.hp).toBe(70)
  })

  it('settles Mirage Arcane without DM approval and emits its long-cast ActiveEffect receipt', () => {
    const actor = wizard('mirage-arcane')
    actor.level = 20
    actor.classResources = { 'dnd5e-spell-slot-9': { current: 1, max: 1 } }
    const actorToken = token('mirage-caster', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'mirage-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'mirage-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
      dnd5eSpellCast: {
        spellId: 'mirage-arcane', castingClassId: 'wizard', slotLevel: 9,
        targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: {},
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-applied', targetId: actorToken.id,
      definitionId: expect.stringContaining('mirage-arcane-terrain-illusion'),
    }))
    expect(resolved.application?.characters[0]?.dnd5eCombatState?.activeEffects)
      .toContainEqual(expect.objectContaining({
        definitionId: expect.stringContaining('mirage-arcane-terrain-illusion'),
        duration: expect.objectContaining({ remainingRounds: 144_000 }),
      }))
    const refreshedActor = {
      ...resolved.application!.characters[0]!,
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    }
    const refreshedAction = {
      ...action,
      id: 'mirage-refresh',
      dnd5eSpellCast: { ...action.dnd5eSpellCast!, slotLevel: 9 },
    }
    const refreshedPrepared = prepareDnd5ePluginSpellCast({
      action: refreshedAction, map, characters: [refreshedActor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(refreshedPrepared.ok, refreshedPrepared.ok ? undefined : refreshedPrepared.reason).toBe(true)
    if (!refreshedPrepared.ok) return
    const refreshed = resolvePreparedDnd5ePluginSpellCast({
      prepared: refreshedPrepared.prepared,
      rolls: {},
    })
    expect(refreshed.result.ok, refreshed.result.ok ? undefined : refreshed.result.reason).toBe(true)
    if (!refreshed.result.ok) throw new Error(refreshed.result.reason)
    const refreshEvents = refreshed.result.events.filter((event) =>
      event.type === 'active-effect-refreshed' || event.type === 'active-effect-applied')
    expect(refreshEvents).toHaveLength(1)
    const refreshEvent = refreshEvents[0]
    if (!refreshEvent || (refreshEvent.type !== 'active-effect-refreshed' && refreshEvent.type !== 'active-effect-applied')) return
    expect(refreshed.application?.characters[0]?.dnd5eCombatState?.activeEffects)
      .toContainEqual(expect.objectContaining({ id: refreshEvent.effectId }))
  })

  it('converts printed long casting times and ritual overhead into campaign minutes', () => {
    expect(dnd5ePluginSpellElapsedCastingMinutes({
      castingTime: { value: 1, unit: 'action' },
      ritual: false,
    })).toBe(0)
    expect(dnd5ePluginSpellElapsedCastingMinutes({
      castingTime: { value: 1, unit: 'action' },
      ritual: true,
    })).toBe(10)
    expect(dnd5ePluginSpellElapsedCastingMinutes({
      castingTime: { value: 1, unit: 'minute' },
      ritual: true,
    })).toBe(11)
    expect(dnd5ePluginSpellElapsedCastingMinutes({
      castingTime: { value: 2, unit: 'hour' },
      ritual: false,
    })).toBe(120)
  })

  it('casts Magic Circle during exploration when a scenery NPC occupies the area', () => {
    let actor = wizard('magic-circle')
    actor.classResources = {
      'dnd5e-spell-slot-3': { current: 1, max: 3 },
      'dnd5e-spell-slot-4': { current: 1, max: 3 },
    }
    const granted = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:holy-water-flask', quantity: 4,
    })
    expect(granted.ok).toBe(true)
    actor = granted.characters[0]
    const actorToken = token('magic-circle-caster', 'player', 75, actor.id)
    const sceneryNpc: Token = {
      id: 'magic-circle-scenery', label: 'NPC', x: 125, y: 25,
      color: '', emoji: '', size: 1, type: 'npc', hp: 12, maxHp: 12,
    }
    const map: BattleMap = {
      id: 'magic-circle-exploration-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, sceneryNpc],
    }
    const action: SharedPlayerActionState = {
      id: 'magic-circle-exploration-cast', mapId: map.id, sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id, targetTokenIds: [],
      dnd5eSpellCast: {
        spellId: 'magic-circle', castingClassId: 'wizard', slotLevel: 4,
        activityChoices: { mode: 'undead-enter' }, targetTokenId: actorToken.id,
        targetTokenIds: [], areaTargetCell: { col: 1, row: 0 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{
        tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
      }],
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([actorToken.id])
    expect(prepared.prepared.targetTokens).not.toContainEqual(expect.objectContaining({ id: sceneryNpc.id }))
    expect(prepared.prepared.state.active).toBe(true)
    expect(prepared.prepared.activityAreaPlacement?.heightFeet).toBe(20)
    expect(prepared.prepared.upcastDurationRounds).toBe(600)

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.activityHandoffs?.persistentAreas).toHaveLength(1)
    expect(resolved.result.activityHandoffs?.persistentAreas?.[0]?.durationRounds).toBe(1_200)
    expect(resolved.result.activityDefinition?.id).toContain('magic-circle')
  })

  it('does not carry synthetic turn resources or leveled-spell gates between exploration plugin casts', () => {
    const actor = wizard('mirror-image')
    actor.classResources = { 'dnd5e-spell-slot-2': { current: 1, max: 3 } }
    actor.dnd5eCombatState = { bonusActionSpellTurnKey: 'map-mirror-exploration-map:1:mirror-caster' }
    const actorToken = token('mirror-caster', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'mirror-exploration-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'mirror-exploration-cast', mapId: map.id, sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'mirror-image', castingClassId: 'wizard', slotLevel: 2,
        targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const spentAction = spendDnd5eTurnResource(
      createDnd5eTurnEconomyCounts('previous-exploration-action'),
      'action',
    ).economy
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      turnEconomy: spentAction,
      roomRequiredPlugins: [],
    })

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[actorToken.id].turn.actionAvailable).toBe(true)
    expect(prepared.prepared.state.combatants[actorToken.id].classState.bonusActionSpellTurnKey).toBeUndefined()
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-spell-slot-2'])
      .toEqual({ current: 0, max: 3 })
  })

  it('ignores the legacy synthetic Magic Mouth map-area payload and creates no area operation', () => {
    let actor = wizard('magic-mouth')
    const granted = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:jade-dust-10gp', quantity: 2,
    })
    expect(granted.ok).toBe(true)
    actor = granted.characters[0]
    const actorToken = token('magic-mouth-caster', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'magic-mouth-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'magic-mouth-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds: [],
      dnd5eSpellCast: {
        spellId: 'magic-mouth', castingClassId: 'wizard', slotLevel: 2,
        targetTokenId: actorToken.id, targetTokenIds: [], areaTargetCell: { col: 1, row: 0 },
        magicMouth: {
          schemaVersion: 1, message: '警告：前方有危险', trigger: '任意生物进入物件周围 30 尺',
          triggerMode: 'proximity', repeat: true,
        },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.activityAreaPlacement).toBeUndefined()
    expect(prepared.prepared.activity).toBeDefined()
    if (!prepared.prepared.activity) throw new Error('Expected a prepared spell activity')
    expect(prepared.prepared.activity.outcomes.flatMap((outcome) => outcome.operations))
      .not.toContainEqual(expect.objectContaining({ kind: 'create-persistent-area' }))
  })

  it('requires and normalizes Antipathy/Sympathy mode, target, and intelligent-creature category', () => {
    const initialActor = wizard('antipathy-sympathy')
    initialActor.level = 20
    initialActor.dnd5eClassLevels = { wizard: 20 }
    initialActor.classResources = {
      'dnd5e-spell-slot-8': { current: 1, max: 1 },
      'dnd5e-spell-slot-9': { current: 1, max: 1 },
    }
    const granted = applyDnd5eInventoryMutation([initialActor], {
      type: 'grant', characterId: initialActor.id,
      templateId: 'srd-5.1:item:arcane-focus', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    const focus = normalizeDnd5eInventory(granted.characters[0]).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:arcane-focus',
    )!
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: initialActor.id, instanceId: focus.instanceId,
    })
    expect(equipped.ok).toBe(true)
    const actor = equipped.characters[0]
    const actorToken = token('antipathy-caster', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'antipathy-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'antipathy-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds: [],
      dnd5eSpellCast: {
        spellId: 'antipathy-sympathy', castingClassId: 'wizard', focusItemInstanceId: focus.instanceId,
        slotLevel: 8, targetTokenId: actorToken.id, targetTokenIds: [],
        areaTargetCell: { col: 1, row: 0 },
        activityChoices: { mode: 'antipathy', 'target-form': 'object' },
        antipathySympathy: {
          schemaVersion: 1, mode: 'antipathy', targetKind: 'object',
          creatureCategory: '  地精  ', targetDescription: '  古代钟楼  ',
        },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const context = {
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    }

    const prepared = prepareDnd5ePluginSpellCast(context)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.antipathySympathy).toEqual({
      schemaVersion: 1, mode: 'antipathy', targetKind: 'object',
      creatureCategory: '地精', targetDescription: '古代钟楼',
    })
    expect(prepared.prepared.castingTime).toBe('long')
    expect(prepared.prepared.activity?.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area', durationRounds: 144_000, concentration: false,
      }),
    )

    expect(prepareDnd5ePluginSpellCast({
      ...context,
      action: {
        ...action,
        dnd5eSpellCast: { ...action.dnd5eSpellCast!, antipathySympathy: undefined },
      },
    })).toEqual({ ok: false, reason: 'invalid-action' })
  })

  it('carries Host-validated Alarm trigger exemptions into the persistent area', () => {
    const initialActor = wizard('alarm')
    initialActor.classResources = { 'dnd5e-spell-slot-1': { current: 2, max: 4 } }
    const granted = applyDnd5eInventoryMutation([initialActor], {
      type: 'grant', characterId: initialActor.id,
      templateId: 'srd-5.1:item:arcane-focus', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    const focus = normalizeDnd5eInventory(granted.characters[0]).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:arcane-focus',
    )!
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: initialActor.id, instanceId: focus.instanceId,
    })
    expect(equipped.ok).toBe(true)
    const actor = equipped.characters[0]
    const actorToken = token('alarm-caster', 'player', 25, actor.id)
    const exemptToken = token('alarm-exempt', 'enemy', 225)
    const map: BattleMap = {
      id: 'alarm-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, exemptToken],
    }
    const action: SharedPlayerActionState = {
      id: 'alarm-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds: [],
      dnd5eSpellCast: {
        spellId: 'alarm', castingClassId: 'wizard', focusItemInstanceId: focus.instanceId,
        slotLevel: 1, targetTokenId: actorToken.id, targetTokenIds: [],
        areaTargetCell: { col: 1, row: 0 }, activityChoices: { mode: 'mental' },
        excludedAreaTargetIds: [actorToken.id, exemptToken.id],
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.activityAreaExemptTargetIds).toEqual([actorToken.id, exemptToken.id])
    expect(prepared.prepared.activityHeadlessAction?.activityAreaExemptTargetIds)
      .toEqual([actorToken.id, exemptToken.id])

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.activityHandoffs?.persistentAreas?.[0]).toMatchObject({
      triggerExemptTargetIds: [actorToken.id, exemptToken.id],
      triggers: [{ notification: { delivery: 'mental-to-source' } }],
    })

    const duplicate = prepareDnd5ePluginSpellCast({
      action: {
        ...action,
        id: 'alarm-duplicate-exemption',
        dnd5eSpellCast: {
          ...action.dnd5eSpellCast!,
          excludedAreaTargetIds: [exemptToken.id, exemptToken.id],
        },
      },
      map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(duplicate).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('normalizes Tiny Hut appearance choices before creating its Host-owned area', () => {
    const initialActor = wizard('tiny-hut')
    initialActor.classResources = { 'dnd5e-spell-slot-3': { current: 1, max: 3 } }
    const granted = applyDnd5eInventoryMutation([initialActor], {
      type: 'grant', characterId: initialActor.id,
      templateId: 'srd-5.1:item:arcane-focus', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    const focus = normalizeDnd5eInventory(granted.characters[0]).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:arcane-focus',
    )!
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: initialActor.id, instanceId: focus.instanceId,
    })
    expect(equipped.ok).toBe(true)
    const actor = equipped.characters[0]
    const actorToken = token('tiny-hut-caster', 'player', 75, actor.id)
    const map: BattleMap = {
      id: 'tiny-hut-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'tiny-hut-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
      dnd5eSpellCast: {
        spellId: 'tiny-hut', castingClassId: 'wizard', focusItemInstanceId: focus.instanceId,
        slotLevel: 3, targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
        areaTargetCell: { col: 1, row: 0 },
        tinyHut: { schemaVersion: 1, color: '#12ABef', interiorIllumination: 'darkness' },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const context = {
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    }

    const prepared = prepareDnd5ePluginSpellCast(context)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.tinyHut).toEqual({
      schemaVersion: 1, color: '#12abef', interiorIllumination: 'darkness',
    })
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.activityHandoffs?.persistentAreas).toHaveLength(1)

    expect(prepareDnd5ePluginSpellCast({
      ...context,
      action: {
        ...action,
        dnd5eSpellCast: {
          ...action.dnd5eSpellCast!,
          tinyHut: { schemaVersion: 1, color: 'purple', interiorIllumination: 'dim' },
        },
      },
    })).toEqual({ ok: false, reason: 'invalid-action' })
  })

  it('settles Message as an action-only cast without private content, a recipient, or reply effects', () => {
    const initialActor = wizard('message')
    const granted = applyDnd5eInventoryMutation([initialActor], {
      type: 'grant', characterId: initialActor.id,
      templateId: 'srd-5.1:item:arcane-focus', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    const focus = normalizeDnd5eInventory(granted.characters[0]).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:arcane-focus',
    )!
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: initialActor.id, instanceId: focus.instanceId,
    })
    expect(equipped.ok).toBe(true)
    const actor = equipped.characters[0]
    const target: Character = {
      ...wizard(''),
      id: 'message-target',
      name: '目标',
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'spell:modify-memory:charmed',
          label: '篡改记忆·魅惑',
          source: {
            kind: 'spell', actorId: 'message-caster', rulesId: 'modify-memory',
            spellLevel: 5, magical: true,
          },
          targetId: 'message-target-token',
          duration: {
            type: 'concentration', sourceActorId: 'message-caster',
            concentrationId: 'modify-memory', remainingRounds: 10,
          },
          breakOn: ['takes-damage', 'targeted-by-spell'],
          legacyCondition: '魅惑',
        })],
      },
    }
    const actorToken = token('message-caster', 'player', 25, actor.id)
    const targetToken = token('message-target-token', 'player', 125, target.id)
    const map: BattleMap = {
      id: 'message-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, targetToken],
    }
    const baseAction: SharedPlayerActionState = {
      id: 'message-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      combatId: 'message-combat', targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'message', castingClassId: 'wizard', focusItemInstanceId: focus.instanceId,
        slotLevel: 0, targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const context = {
      map, characters: [actor, target],
      initiativeOrder: [actorToken, targetToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      turnEconomy: createDnd5eTurnEconomyCounts('message-combat:1:message-caster'),
      roomRequiredPlugins: [] as const,
    }

    const injectedPrivateText = prepareDnd5ePluginSpellCast({
      action: {
        ...baseAction,
        dnd5eSpellCast: { ...baseAction.dnd5eSpellCast!, communicationText: '旧客户端密语' },
      },
      ...context,
    })
    expect(injectedPrivateText).toEqual({ ok: false, reason: 'invalid-action' })

    const prepared = prepareDnd5ePluginSpellCast({ action: baseAction, ...context })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetToken.id).toBe(actorToken.id)
    expect(prepared.prepared.activityHeadlessAction?.targetIds).toEqual([actorToken.id])

    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: {},
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: actorToken.id, resource: 'action',
    }))
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'communication-opened',
    }))
    expect(resolved.result.state.combatants[targetToken.id].classState.activeEffects)
      .toHaveLength(1)
  })

  it('settles Minor Illusion as action-only without imagery choices, an area, or DM approval', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const initialActor = wizard('minor-illusion')
    const granted = applyDnd5eInventoryMutation([initialActor], {
      type: 'grant', characterId: initialActor.id,
      templateId: 'srd-5.1:item:arcane-focus', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    const focus = normalizeDnd5eInventory(granted.characters[0]).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:arcane-focus',
    )!
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: initialActor.id, instanceId: focus.instanceId,
    })
    expect(equipped.ok).toBe(true)
    const actor = equipped.characters[0]
    const actorToken = token('minor-illusion-caster', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'minor-illusion-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'minor-illusion-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      combatId: 'minor-illusion-combat', targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'minor-illusion', castingClassId: 'wizard',
        focusItemInstanceId: focus.instanceId, slotLevel: 0,
        targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const context = {
      action, map, characters: [actor],
      initiativeOrder: [{
        tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
      }],
      turnEconomy: createDnd5eTurnEconomyCounts(
        'minor-illusion-combat:1:minor-illusion-caster',
      ),
      roomRequiredPlugins: [] as const,
    }
    const staleImageryRequest = prepareDnd5ePluginSpellCast({
      ...context,
      action: {
        ...action,
        dnd5eSpellCast: {
          ...action.dnd5eSpellCast!,
          activityChoices: { mode: 'image' },
          minorIllusion: {
            mode: 'image', description: '旧客户端影像声明',
          },
        },
      },
    })
    expect(staleImageryRequest).toEqual({ ok: false, reason: 'invalid-action' })

    const prepared = prepareDnd5ePluginSpellCast(context)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: {},
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: actorToken.id, resource: 'action',
    }))
    expect(resolved.result.state.combatants[actorToken.id].turn.actionAvailable).toBe(false)
    expect(resolved.result.activityHandoffs?.persistentAreas ?? []).toHaveLength(0)
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'activity-dm-adjudication-required',
    }))
  })

  it('rejects a vertically out-of-range spell target during preparation instead of after DM approval', () => {
    let actor = wizard('imprisonment')
    actor.level = 20
    actor.hitDice = '20d6'
    actor.classResources = { 'dnd5e-spell-slot-9': { current: 1, max: 1 } }
    const grant = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:imprisonment-precious-chain-500gp', quantity: 3,
    })
    expect(grant.ok).toBe(true)
    actor = grant.characters[0]
    const actorToken = token('vertical-caster', 'player', 25, actor.id)
    const elevatedTarget = {
      ...token('vertical-target', 'enemy', 75),
      poolId: 'srd-5.1:scout', elevationFeet: 55,
    }
    const map: BattleMap = {
      id: 'vertical-range-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, elevatedTarget],
    }
    const action: SharedPlayerActionState = {
      id: 'vertical-range-cast', mapId: map.id, sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: elevatedTarget.id,
      dnd5eSpellCast: {
        spellId: 'imprisonment', castingClassId: 'wizard', slotLevel: 9,
        activityChoices: { mode: 'chaining' }, targetTokenId: elevatedTarget.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }

    expect(prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, elevatedTarget].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })).toEqual({ ok: false, reason: 'target-out-of-range' })
  })

  it('rejects a source-bound Imprisonment-immune target before Host dice or DM approval', () => {
    let actor = wizard('imprisonment')
    actor.level = 20
    actor.hitDice = '20d6'
    actor.classResources = { 'dnd5e-spell-slot-9': { current: 1, max: 1 } }
    const grant = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:imprisonment-precious-chain-500gp', quantity: 3,
    })
    expect(grant.ok).toBe(true)
    actor = grant.characters[0]
    const actorToken = token('imprisonment-caster', 'player', 25, actor.id)
    const immuneTarget = {
      ...token('imprisonment-immune-target', 'enemy', 75),
      poolId: 'srd-5.1:scout',
      dnd5eCombatState: {
        schemaVersion: 2 as const,
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'activity:imprisonment:imprisonment-immunity:modifiers:0',
          label: '禁锢术·对本施法者免疫', tags: ['imprisonment-immunity'],
          source: {
            kind: 'spell', actorId: actorToken.id, rulesId: 'imprisonment',
            spellLevel: 9, spellSaveDc: 15, magical: true,
          },
          targetId: 'imprisonment-immune-target',
        })],
      },
    }
    const map: BattleMap = {
      id: 'imprisonment-immunity-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, immuneTarget],
    }
    const action: SharedPlayerActionState = {
      id: 'imprisonment-repeat-cast', mapId: map.id, sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: immuneTarget.id,
      dnd5eSpellCast: {
        spellId: 'imprisonment', castingClassId: 'wizard', slotLevel: 9,
        activityChoices: { mode: 'chaining' }, targetTokenId: immuneTarget.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }

    expect(prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, immuneTarget].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })).toEqual({ ok: false, reason: 'target-immune' })
  })

  it('executes Comprehend Languages through the audited ritual path without spending an action or slot', () => {
    const actor = wizard('comprehend-languages')
    actor.classResources = { 'dnd5e-spell-slot-1': { current: 0, max: 4 } }
    const actorToken = token('ritual-caster', 'player', 25, actor.id)
    const enemyToken = token('ritual-witness', 'enemy', 225)
    const map: BattleMap = {
      id: 'ritual-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'comprehend-languages-ritual', mapId: map.id, combatId: 'ritual-combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'comprehend-languages', castingClassId: 'wizard', slotLevel: 1,
        targetTokenId: actorToken.id, ritual: true,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, enemyToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ ritual: true, castingTime: 'long', slotLevel: 1 })

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    const caster = resolved.result.state.combatants[actorToken.id]
    expect(caster.turn.actionAvailable).toBe(true)
    expect(caster.classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(caster.classState.activeEffects).toContainEqual(expect.objectContaining({
      source: expect.objectContaining({
        kind: 'spell', rulesId: 'comprehend-languages', spellLevel: 1,
        spellSaveDc: 15, magical: true,
      }),
      duration: expect.objectContaining({ remainingRounds: 600 }),
      modifiers: expect.objectContaining({
        languageCapabilities: {
          understandSpoken: 'all',
          understandWritten: 'literal-written',
          writtenRequiresTouch: true,
          writtenMinutesPerPage: 1,
        },
      }),
    }))
  })

  it('preserves Detect Magic detection events through the production plugin-spell facade', () => {
    const actor = wizard('detect-magic')
    actor.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 4 } }
    const actorToken = token('detect-magic-caster', 'player', 25, actor.id)
    const enemyToken = token('detect-magic-witness', 'enemy', 125)
    const map: BattleMap = {
      id: 'detect-magic-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'detect-magic-cast', mapId: map.id, combatId: 'detect-magic-combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'detect-magic', castingClassId: 'wizard', slotLevel: 1,
        targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, enemyToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder,
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-detection-updated', actorId: actorToken.id, spellId: 'detect-magic', mode: 'magic',
    }))
  })

  it('preserves Identify as an inventory authority handoff through the plugin-spell facade', () => {
    const baseActor = wizard('identify')
    baseActor.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 4 } }
    const actor = applyDnd5eInventoryMutation([baseActor], {
      type: 'grant', characterId: baseActor.id,
      templateId: 'srd-5.1:item:pearl-100gp', quantity: 1,
    }).characters[0]
    const actorToken = token('identify-caster', 'player', 25, actor.id)
    const enemyToken = token('identify-witness', 'enemy', 225)
    const map: BattleMap = {
      id: 'identify-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'identify-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'identify', castingClassId: 'wizard', slotLevel: 1,
        targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, enemyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.activityHandoffs?.inventoryIdentifications).toEqual([
      expect.objectContaining({ kind: 'identify-inventory-item', actorId: actorToken.id }),
    ])
  })

  it('preserves Purify Food and Drink as an inventory authority handoff through the live spell facade', () => {
    const baseActor = wizard('purify-food-and-drink')
    baseActor.charClass = '德鲁伊'
    baseActor.dnd5eClassChoices = { classes: { druid: { selections: { 'spell-prepared': ['purify-food-and-drink'] } } } }
    baseActor.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 4 } }
    const granted = applyDnd5eInventoryMutation([baseActor], {
      type: 'grant', characterId: baseActor.id,
      templateId: 'srd-5.1:item:rations-one-day', quantity: 1,
    })
    const contaminated = applyDnd5eInventoryMutation(granted.characters, {
      type: 'set-consumable-contaminants', characterId: baseActor.id,
      instanceId: normalizeDnd5eInventory(granted.characters[0]).entries[0]!.instanceId,
      contaminants: ['poison', 'disease'],
    }).characters[0]
    const inventory = normalizeDnd5eInventory(contaminated)
    const rations = inventory.entries[0]!
    const actorToken = token('purify-caster', 'player', 25, contaminated.id)
    const map: BattleMap = {
      id: 'purify-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'purify-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: contaminated.id,
      targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'purify-food-and-drink', castingClassId: 'druid', slotLevel: 1,
        targetTokenId: actorToken.id,
        activityChoices: { mode: 'carried-consumable' },
        activityInventoryInstanceId: rations.instanceId,
        expectedActivityInventoryRevision: inventory.revision ?? 0,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [contaminated],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.activityHandoffs?.inventoryPurifications).toEqual([
      expect.objectContaining({ kind: 'purify-inventory-item', actorId: actorToken.id }),
    ])
    expect(resolved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-1'].current).toBe(0)
  })

  it('forwards the UI-selected inventory instance into Instant Summons and establishes its durable link', () => {
    let actor = wizard('instant-summons')
    actor.level = 20
    actor.hitDice = '20d6'
    actor.dnd5eWorldTimeAppliedMinute = 1_000
    actor.classResources = { 'dnd5e-spell-slot-6': { current: 1, max: 2 } }
    actor = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:small-knife', quantity: 1,
    }).characters[0]
    actor = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:sapphire-1000gp', quantity: 1,
    }).characters[0]
    const inventory = normalizeDnd5eInventory(actor)
    const linkedItem = inventory.entries.find((entry) => entry.templateId === 'srd-5.1:item:small-knife')!
    const actorToken = token('instant-summons-caster', 'player', 25, actor.id)
    const enemyToken = token('instant-summons-witness', 'enemy', 225)
    const map: BattleMap = {
      id: 'instant-summons-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'instant-summons-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'instant-summons', castingClassId: 'wizard', slotLevel: 6,
        targetTokenId: actorToken.id,
        activityInventoryInstanceId: linkedItem.instanceId,
        expectedActivityInventoryRevision: inventory.revision ?? 0,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, enemyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.activityHeadlessAction?.payload).toMatchObject({
      activityInventoryInstanceId: linkedItem.instanceId,
    })

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.state.combatants[actorToken.id].classState.spellAuthorityRecords)
      .toHaveProperty(`linked-planar-object:instant-summons:${actorToken.id}:${linkedItem.instanceId}`, expect.objectContaining({
        kind: 'linked-planar-object', profile: 'instant-summons',
        inventoryInstanceId: linkedItem.instanceId, planarState: 'material', spellLevel: 6,
      }))
    expect(resolved.result.activityHandoffs?.spellAuthorities).toEqual([
      expect.objectContaining({
        kind: 'establish-spell-authority',
        linkedObjectProfile: 'instant-summons',
        inventoryInstanceId: linkedItem.instanceId,
      }),
    ])
    expect(resolved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-6'].current).toBe(0)
  })

  it('rejects ritual mode for a spell that does not carry the ritual tag', () => {
    const actor = wizard('mirror-image')
    actor.classResources = { 'dnd5e-spell-slot-2': { current: 1, max: 3 } }
    const actorToken = token('invalid-ritual-caster', 'player', 25, actor.id)
    const enemyToken = token('invalid-ritual-target', 'enemy', 75)
    const map: BattleMap = {
      id: 'invalid-ritual-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'mirror-image-invalid-ritual', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'mirror-image', castingClassId: 'wizard', slotLevel: 2,
        targetTokenId: actorToken.id, ritual: true,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    expect(prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      // The falling creature owns the live turn; Feather Fall is resolved by
      // the wizard as an out-of-turn reaction.
      initiativeOrder: [enemyToken, actorToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })).toEqual({ ok: false, reason: 'ritual-unavailable' })
  })

  it('prepares an audited empty-ground Activity area for Unseen Servant', () => {
    const actor = wizard('unseen-servant')
    actor.classResources = { 'dnd5e-spell-slot-1': { current: 0, max: 4 } }
    const actorToken = token('unseen-servant-caster', 'player', 25, actor.id)
    const enemyToken = token('unseen-servant-enemy', 'enemy', 425)
    const map: BattleMap = {
      id: 'unseen-servant-map', name: 'Map', width: 800, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'unseen-servant-ritual', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'unseen-servant', castingClassId: 'wizard', slotLevel: 1,
        targetTokenId: actorToken.id, targetTokenIds: [], ritual: true,
        areaTargetCell: { col: 4, row: 2 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, enemyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.activityTargetCell).toEqual({ col: 4, row: 2 })
    expect(prepared.prepared.activityTargetCells).toEqual([{ col: 4, row: 2 }])
    expect(prepared.prepared.activityAreaPlacement).toMatchObject({
      x: 225,
      y: 125,
      widthFeet: 5,
    })
    expect(prepared.prepared.activityAreaPlacementDistanceFeet).toBe(20)
    expect(prepared.prepared.targets).toEqual([])
    const directActivity = resolveDnd5eActivity({
      activity: prepared.prepared.activity!,
      actor: dnd5eActivityActorSnapshotFromCombatantV1(
        prepared.prepared.state.combatants[actorToken.id],
      ),
      targets: [],
      rolls: {},
      areaPlacement: prepared.prepared.activityAreaPlacement,
      areaPlacementDistanceFeet: prepared.prepared.activityAreaPlacementDistanceFeet,
      castLevel: 1,
      dmApproved: true,
    })
    expect(directActivity.ok, directActivity.ok ? undefined : directActivity.details.join('; ')).toBe(true)
    const ritualSettlement = resolveDnd5eHeadlessAction(prepared.prepared.state, {
      type: 'adjudicated-spell',
      actorId: actorToken.id,
      castingClassId: 'wizard',
      spellId: 'unseen-servant',
      spellName: '隐形仆役',
      spellLevel: 1,
      slotLevel: 1,
      castingTime: 'long',
      ritual: true,
      effects: [],
      declaredTargetIds: [],
      spellSchool: 'conjuration',
      settlementMode: 'dm-slot-only',
    })
    expect(ritualSettlement.ok, ritualSettlement.ok ? undefined : ritualSettlement.reason).toBe(true)
    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: {},
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.activityHandoffs?.persistentAreas).toHaveLength(1)
    expect(resolved.result.activityAreaInstance).toMatchObject({ widthFeet: 5, heightFeet: 5 })
  })

  it('prepares Transport via Plants on an empty plant square using its caster receipt', () => {
    const actor = wizard('transport-via-plants')
    actor.charClass = '德鲁伊'
    actor.level = 20
    actor.dnd5eClassLevels = { druid: 20 }
    actor.abilities = { ...actor.abilities, wis: 20 }
    actor.dnd5eClassChoices = {
      classes: { druid: { selections: { 'spell-prepared': ['transport-via-plants'] } } },
    }
    actor.classResources = { 'dnd5e-spell-slot-6': { current: 2, max: 2 } }
    const actorToken = token('transport-caster', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'transport-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'transport-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: '', targetTokenIds: [],
      dnd5eSpellCast: {
        spellId: 'transport-via-plants', castingClassId: 'druid', slotLevel: 6,
        targetTokenId: '', targetTokenIds: [], areaTargetCell: { col: 1, row: 0 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targets).toEqual([])
    expect(prepared.prepared.activityTargetCell).toEqual({ col: 1, row: 0 })
    expect(prepared.prepared.activityAreaPlacementDistanceFeet).toBe(5)
    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: { activityInterruptChoiceId: 'dm-apply' },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-applied', targetId: actorToken.id,
      definitionId: expect.stringContaining('transport-via-plants-connection'),
    }))
  })

  it('accepts the Passwall cast while leaving mapped wall changes to the DM', () => {
    const actor = wizard('passwall')
    actor.level = 20
    actor.classResources = {
      'dnd5e-spell-slot-5': { current: 1, max: 3 },
      'dnd5e-spell-slot-6': { current: 1, max: 2 },
    }
    const ally = { ...wizard('guidance'), id: 'ally', name: '盟友' }
    const actorToken = token('passwall-caster', 'player', 25, actor.id)
    const allyToken = token('passwall-ally', 'player', 225, ally.id)
    const map: BattleMap = {
      id: 'passwall-map', name: 'Map', width: 800, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, allyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'passwall-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'passwall', castingClassId: 'wizard', slotLevel: 5,
        targetTokenId: actorToken.id, targetTokenIds: [],
        areaTargetCell: { col: 1, row: 0 },
        areaTargetOrientation: 0, areaTargetAngleDegrees: 90,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor, ally],
      initiativeOrder: [actorToken, allyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.activityAreaPlacement).toMatchObject({
      x: 75, y: 25, angleDegrees: 90, widthFeet: 5, heightFeet: 8,
    })
    const directActivity = resolveDnd5eActivity({
      activity: prepared.prepared.activity!,
      actor: dnd5eActivityActorSnapshotFromCombatantV1(
        prepared.prepared.state.combatants[actorToken.id],
      ),
      targets: prepared.prepared.targets.map((target) =>
        dnd5eActivityActorSnapshotFromCombatantV1(
          prepared.prepared.state.combatants[target.token.id],
        )),
      rolls: {}, areaPlacement: prepared.prepared.activityAreaPlacement,
      areaPlacementDistanceFeet: prepared.prepared.activityAreaPlacementDistanceFeet,
      castLevel: 5,
    })
    expect(directActivity.ok, directActivity.ok ? undefined : directActivity.details.join('; ')).toBe(true)
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.activityAreaInstance).toMatchObject({
      angleDegrees: 90, lengthFeet: 20, widthFeet: 5, heightFeet: 8,
    })
    expect(resolved.result.activityHandoffs?.persistentAreas).toContainEqual(expect.objectContaining({
      durationRounds: 600, concentration: false,
      blocking: { suppressesMappedBarriers: true },
    }))
    const applied = applyDnd5eActivityMapHandoffsV1({
      map: resolved.application!.map,
      activity: resolved.result.activityDefinition!,
      packageId: prepared.prepared.spell.ownerPluginId,
      actionId: action.id, actorId: actorToken.id,
      sourceSaveDc: prepared.prepared.saveDc, round: 1, combatId: action.combatId,
      handoffs: resolved.result.activityHandoffs!,
      areaSelection: {
        anchorCell: prepared.prepared.activityTargetCell!,
        cells: prepared.prepared.activityTargetCells,
        targetIds: prepared.prepared.targets.map((target) => target.token.id),
        areaPlacement: resolved.result.activityAreaInstance!,
        areaPlacementDistanceFeet: prepared.prepared.activityAreaPlacementDistanceFeet ?? 0,
      },
      selection: {},
    })
    expect(applied.ok, applied.ok ? undefined : applied.reason).toBe(true)
    if (!applied.ok) return
    const geometry = {
      ...createEmptyMapGeometry(map.id, 1),
      walls: [{
        id: 'stone-wall', kind: 'wall' as const, label: '石墙',
        points: [{ x: 75, y: 0 }, { x: 75, y: 150 }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
    }
    expect(mapGeometryMovementBlocked({
      geometry, map: applied.map, token: actorToken, to: { x: 125, y: 25 },
    }).blocked).toBe(true)
    expect(applied.map).toEqual(resolved.application!.map)
    expect(applied.changedTokenIds).toEqual([])
  })

  it('prepares Knock against a mapped door cell without fabricating a creature target', () => {
    const actor = wizard('knock')
    const actorToken = token('knock-caster', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'knock-map', name: 'Map', width: 800, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'knock-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'knock', castingClassId: 'wizard', slotLevel: 2,
        targetTokenId: actorToken.id, targetTokenIds: [],
        areaTargetCell: { col: 5, row: 2 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{
        tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
      }],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.activityTargetCell).toEqual({ col: 5, row: 2 })
    expect(prepared.prepared.targets).toEqual([])
    expect(prepared.prepared.activity?.outcomes.flatMap((outcome) => outcome.operations))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'modify-map-object-lock', mode: 'knock', suppressionMinutes: 10,
        }),
        expect.objectContaining({ kind: 'emit-sound', audibleRadiusFeet: 300 }),
      ]))
  })

  it('carries Arcane Lock designated creatures and a normalized password into the map handoff', () => {
    let actor = wizard('arcane-lock')
    actor.classResources = { 'dnd5e-spell-slot-3': { current: 1, max: 3 } }
    const granted = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    actor = granted.characters[0]
    const actorToken = token('arcane-lock-caster', 'player', 25, actor.id)
    const designatedToken = token('arcane-lock-designated', 'player', 225)
    const map: BattleMap = {
      id: 'arcane-lock-map', name: 'Map', width: 800, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, designatedToken],
    }
    const action: SharedPlayerActionState = {
      id: 'arcane-lock-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds: [],
      dnd5eSpellCast: {
        spellId: 'arcane-lock', castingClassId: 'wizard', slotLevel: 3,
        targetTokenId: actorToken.id, targetTokenIds: [], areaTargetCell: { col: 1, row: 0 },
        excludedAreaTargetIds: [designatedToken.id], secretPhrase: '  星痕开门  ',
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [
        { tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: designatedToken.id, label: designatedToken.label, emoji: '', color: '', roll: 10 },
      ],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.activityAreaExemptTargetIds).toEqual([designatedToken.id])
    expect(prepared.prepared.activityHeadlessAction?.payload).toMatchObject({ secretPhrase: '星痕开门' })
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.activityHandoffs?.mapObjectLocks?.[0]).toMatchObject({
      mode: 'arcane-lock', spellLevel: 3, authorizedTargetIds: [designatedToken.id],
    })
    expect(resolved.result.activityHandoffs?.mapObjectLocks?.[0]?.passwordDigest)
      .toMatch(/^fnv1a32:/)
  })

  it('keeps Mislead invisibility after its own cast event, switches senses both ways, and breaks invisibility on a later spell cast', async () => {
    const actor = wizard('mislead')
    actor.level = 20
    actor.classResources = {
      'dnd5e-spell-slot-2': { current: 1, max: 3 },
      'dnd5e-spell-slot-5': { current: 1, max: 3 },
    }
    const actorToken = token('mislead-caster', 'player', 25, actor.id)
    const enemyToken = token('mislead-enemy', 'enemy', 125)
    const map: BattleMap = {
      id: 'mislead-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const initiativeOrder = [actorToken, enemyToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const action: SharedPlayerActionState = {
      id: 'mislead-cast', mapId: map.id, combatId: 'mislead-combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
      dnd5eSpellCast: {
        spellId: 'mislead', castingClassId: 'wizard', slotLevel: 5,
        targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
        areaTargetCell: { col: 0, row: 0 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    if (!cast.result.ok) throw new Error(cast.result.reason)
    const casterAfterMislead = cast.result.state.combatants[actorToken.id]
    expect(casterAfterMislead.conditions).toContain('invisible')
    expect(casterAfterMislead.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        standardCondition: 'invisible',
        breakOn: expect.arrayContaining(['makes-attack', 'casts-spell']),
      }),
      expect.objectContaining({
        definitionId: expect.stringContaining('mislead-controller'),
        duration: expect.objectContaining({ type: 'concentration', remainingRounds: 600 }),
      }),
    ]))
    expect(cast.result.events).not.toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', reason: 'casts-spell',
      definitionId: 'condition:invisible',
    }))

    const areaPlacement = cast.result.activityAreaInstance ?? prepared.prepared.activityAreaPlacement
    expect(areaPlacement).toBeDefined()
    const areaHandoff = applyDnd5eActivityMapHandoffsV1({
      map: cast.application!.map,
      activity: cast.result.activityDefinition!,
      packageId: prepared.prepared.spell.ownerPluginId,
      actionId: action.id,
      actorId: actorToken.id,
      sourceSaveDc: prepared.prepared.saveDc,
      concentrationId: prepared.prepared.spell.id,
      round: 1,
      combatId: action.combatId,
      handoffs: cast.result.activityHandoffs!,
      areaSelection: {
        anchorCell: prepared.prepared.activityTargetCell!,
        cells: prepared.prepared.activityTargetCells,
        targetIds: [actorToken.id],
        areaPlacement: areaPlacement!,
        areaPlacementDistanceFeet: prepared.prepared.activityAreaPlacementDistanceFeet ?? 0,
      },
      selection: {},
    })
    expect(areaHandoff.ok, areaHandoff.ok ? undefined : areaHandoff.reason).toBe(true)
    if (!areaHandoff.ok) return
    const areaId = areaHandoff.map.dnd5ePluginAreas?.[0]?.id
    if (!areaId) throw new Error('Expected the committed persistent area id')
    expect(areaId).toBeDefined()
    const emptyGroundMove = prepareDnd5ePluginFeatureAction({
      action: {
        id: 'mislead-empty-ground-move',
        mapId: map.id,
        combatId: action.combatId,
        sourceMode: 'player',
        status: 'pending',
        type: 'dnd5e-plugin-action',
        actorTokenId: actorToken.id,
        characterId: actor.id,
        targetTokenIds: [],
        targetCell: { col: 1, row: 0 },
        dnd5ePluginAction: {
          featureId: 'srd-5.1:area-control.spell:mislead:move-projection',
          payload: { persistentAreaId: areaId },
        },
        round: 1,
        initiativeIndex: 0,
        seq: 2,
        updatedAt: 2,
      },
      map: areaHandoff.map,
      characters: cast.application!.characters,
      initiativeOrder,
    })
    expect(emptyGroundMove.ok, emptyGroundMove.ok ? undefined : emptyGroundMove.reason).toBe(true)
    if (!emptyGroundMove.ok) return
    const emptyGroundMoveResolved = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: emptyGroundMove.prepared,
    })
    expect(
      emptyGroundMoveResolved.result.ok,
      emptyGroundMoveResolved.result.ok ? undefined : emptyGroundMoveResolved.result.reason,
    ).toBe(true)
    const switchAction = (choice: 'projection' | 'source', id: string): SharedPlayerActionState => ({
      id,
      mapId: map.id,
      combatId: action.combatId,
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-plugin-action',
      actorTokenId: actorToken.id,
      characterId: actor.id,
      targetTokenId: actorToken.id,
      dnd5ePluginAction: {
        featureId: 'srd-5.1:area-control.spell:mislead:switch-senses',
        payload: {
          persistentAreaId: areaId,
          activityChoices: { 'sense-origin': choice },
        },
      },
      round: 1,
      initiativeIndex: 0,
      seq: choice === 'projection' ? 2 : 3,
      updatedAt: choice === 'projection' ? 2 : 3,
    })
    const projectionPrepared = prepareDnd5ePluginFeatureAction({
      action: switchAction('projection', 'mislead-projection-senses'),
      map: areaHandoff.map,
      characters: cast.application!.characters,
      initiativeOrder,
    })
    expect(projectionPrepared.ok, projectionPrepared.ok ? undefined : projectionPrepared.reason).toBe(true)
    if (!projectionPrepared.ok) return
    const projection = await resolvePreparedDnd5ePluginFeatureAction({
      prepared: projectionPrepared.prepared,
    })
    expect(projection.result.ok, projection.result.ok ? undefined : projection.result.reason).toBe(true)
    if (!projection.result.ok) throw new Error(projection.result.reason)
    if (!projection.result.ok || !projection.application) return
    expect(projection.result.state.combatants[actorToken.id].conditions).toEqual(
      expect.arrayContaining(['blinded', 'deafened']),
    )

    const legacyProjectionState = structuredClone(projection.result.state)
    const legacyCaster = legacyProjectionState.combatants[actorToken.id]
    for (const effect of legacyCaster.classState.activeEffects ?? []) {
      if (
        effect.source.rulesId === 'mislead' &&
        (effect.standardCondition === 'blinded' || effect.standardCondition === 'deafened')
      ) {
        effect.duration = {
          type: 'rounds', remainingRounds: 600, tickOn: 'source-turn-end',
        }
      }
    }
    const concentrationEndEvents: Parameters<typeof endDnd5eConcentration>[2] = []
    endDnd5eConcentration(legacyProjectionState, legacyCaster, concentrationEndEvents)
    expect(legacyCaster.conditions).not.toContain('blinded')
    expect(legacyCaster.conditions).not.toContain('deafened')
    expect(concentrationEndEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'condition-ended', targetId: actorToken.id, condition: 'blinded' }),
      expect.objectContaining({ type: 'condition-ended', targetId: actorToken.id, condition: 'deafened' }),
    ]))

    const sourcePrepared = prepareDnd5ePluginFeatureAction({
      action: switchAction('source', 'mislead-source-senses'),
      map: areaHandoff.map,
      characters: projection.application.characters,
      initiativeOrder,
    })
    expect(sourcePrepared.ok, sourcePrepared.ok ? undefined : sourcePrepared.reason).toBe(true)
    if (!sourcePrepared.ok) return
    const source = await resolvePreparedDnd5ePluginFeatureAction({ prepared: sourcePrepared.prepared })
    expect(source.result.ok, source.result.ok ? undefined : source.result.reason).toBe(true)
    if (!source.result.ok) throw new Error(source.result.reason)
    expect(source.result.state.combatants[actorToken.id].conditions).not.toContain('blinded')
    expect(source.result.state.combatants[actorToken.id].conditions).not.toContain('deafened')

    const followUpActor = {
      ...cast.application!.characters.find((character) => character.id === actor.id)!,
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['mislead', 'mirror-image'] } } },
      },
      classResources: {
        ...cast.application!.characters.find((character) => character.id === actor.id)!.classResources,
        'dnd5e-spell-slot-2': { current: 1, max: 3 },
      },
    }
    const followUpAction: SharedPlayerActionState = {
      ...action,
      id: 'mislead-follow-up-spell', seq: 2,
      dnd5eSpellCast: {
        spellId: 'mirror-image', castingClassId: 'wizard', slotLevel: 2,
        targetTokenId: actorToken.id,
      },
    }
    const followUpPrepared = prepareDnd5ePluginSpellCast({
      action: followUpAction, map, characters: [followUpActor], initiativeOrder,
      roomRequiredPlugins: [],
    })
    expect(followUpPrepared.ok, followUpPrepared.ok ? undefined : followUpPrepared.reason).toBe(true)
    if (!followUpPrepared.ok) return
    const followUp = resolvePreparedDnd5ePluginSpellCast({ prepared: followUpPrepared.prepared, rolls: {} })
    expect(followUp.result.ok, followUp.result.ok ? undefined : followUp.result.reason).toBe(true)
    if (!followUp.result.ok) throw new Error(followUp.result.reason)
    expect(followUp.result.state.combatants[actorToken.id].conditions).not.toContain('invisible')
    expect(followUp.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      reason: 'casts-spell',
      definitionId: expect.stringContaining('mislead-invisible'),
    }))
    expect(followUp.result.state.combatants[actorToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: expect.stringContaining('mislead-controller') }),
    )
  })

  it('keeps Project Image controller state while switching senses and moving its Host-owned projection', async () => {
    let actor = wizard('project-image')
    actor.level = 20
    actor.classResources = { 'dnd5e-spell-slot-7': { current: 2, max: 2 } }
    const materialGrant = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:caster-replica-5gp', quantity: 1,
    })
    expect(materialGrant.ok).toBe(true)
    actor = materialGrant.characters[0]
    const actorToken = token('project-image-caster', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'project-image-map', name: 'Map', width: 2_000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const initiativeOrder = [{
      tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
    }]
    const castAction: SharedPlayerActionState = {
      id: 'project-image-cast', mapId: map.id, sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenIds: [], targetCell: { col: 2, row: 0 },
      dnd5eSpellCast: {
        spellId: 'project-image', castingClassId: 'wizard', slotLevel: 7, targetTokenId: actorToken.id,
        targetTokenIds: [], areaTargetCell: { col: 2, row: 0 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const preparedCast = prepareDnd5ePluginSpellCast({
      action: castAction, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(preparedCast.ok, preparedCast.ok ? undefined : preparedCast.reason).toBe(true)
    if (!preparedCast.ok) return
    const cast = resolvePreparedDnd5ePluginSpellCast({ prepared: preparedCast.prepared, rolls: {} })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    if (!cast.result.ok) throw new Error(cast.result.reason)
    if (!cast.result.ok || !cast.application) return
    expect(cast.result.state.combatants[actorToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: expect.stringContaining('project-image-controller'),
        duration: expect.objectContaining({ type: 'concentration', remainingRounds: 14_400 }),
      }),
    )
    expect(cast.result.events).not.toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', reason: 'concentration-ended',
      definitionId: expect.stringContaining('project-image-controller'),
    }))

    const castAreaPlacement = cast.result.activityAreaInstance ?? preparedCast.prepared.activityAreaPlacement
    const created = applyDnd5eActivityMapHandoffsV1({
      map: cast.application.map,
      activity: cast.result.activityDefinition!,
      packageId: preparedCast.prepared.spell.ownerPluginId,
      actionId: castAction.id,
      actorId: actorToken.id,
      sourceSaveDc: preparedCast.prepared.saveDc,
      concentrationId: preparedCast.prepared.spell.id,
      round: 1,
      combatId: castAction.combatId,
      handoffs: cast.result.activityHandoffs!,
      areaSelection: {
        anchorCell: preparedCast.prepared.activityTargetCell!,
        cells: preparedCast.prepared.activityTargetCells,
        targetIds: [],
        areaPlacement: castAreaPlacement!,
        areaPlacementDistanceFeet: preparedCast.prepared.activityAreaPlacementDistanceFeet ?? 0,
      },
      selection: {},
    })
    expect(created.ok, created.ok ? undefined : created.reason).toBe(true)
    if (!created.ok) return
    const area = created.map.dnd5ePluginAreas?.find((candidate) =>
      candidate.coreSpellId === 'project-image')
    expect(area).toMatchObject({
      anchorCell: { col: 2, row: 0 },
      expiresAfterRound: 14_401,
      grantedActivities: expect.arrayContaining([
        expect.objectContaining({ activityId: 'spell:project-image:move-projection' }),
        expect.objectContaining({ activityId: 'spell:project-image:switch-senses' }),
      ]),
    })
    if (!area?.anchorTokenId) return

    const featureAction = (
      id: string,
      featureId: 'move-projection' | 'switch-senses',
      mapId: string,
      patch: Partial<SharedPlayerActionState> = {},
      activityChoices?: Record<string, string>,
    ): SharedPlayerActionState => ({
      id, mapId, combatId: castAction.combatId, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-plugin-action', actorTokenId: actorToken.id, characterId: actor.id,
      dnd5ePluginAction: {
        featureId: `srd-5.1:area-control.spell:project-image:${featureId}`,
        payload: {
          persistentAreaId: area.id,
          ...(activityChoices ? { activityChoices } : {}),
        },
      },
      round: 1, initiativeIndex: 0, seq: 2, updatedAt: 2,
      ...patch,
    })

    const projectionAction = featureAction(
      'project-image-senses-projection', 'switch-senses', map.id,
      { targetTokenId: actorToken.id },
      { 'sense-origin': 'projection' },
    )
    const projectionPrepared = prepareDnd5ePluginFeatureAction({
      action: projectionAction,
      map: created.map,
      characters: cast.application.characters,
      initiativeOrder,
    })
    expect(projectionPrepared.ok, projectionPrepared.ok ? undefined : projectionPrepared.reason).toBe(true)
    if (!projectionPrepared.ok) return
    const projection = await resolvePreparedDnd5ePluginFeatureAction({ prepared: projectionPrepared.prepared })
    expect(projection.result.ok, projection.result.ok ? undefined : projection.result.reason).toBe(true)
    if (!projection.result.ok) throw new Error(projection.result.reason)
    if (!projection.result.ok || !projection.application) return
    expect(projection.result.state.combatants[actorToken.id].conditions).toEqual(
      expect.arrayContaining(['blinded', 'deafened']),
    )
    const projectionMap = applyDnd5eActivityMapHandoffsV1({
      map: projection.application.map,
      activity: projection.result.activityDefinition!,
      packageId: projectionPrepared.prepared.feature.ownerPluginId,
      actionId: projectionAction.id,
      actorId: actorToken.id,
      round: 1,
      handoffs: projection.result.activityHandoffs!,
      selection: {},
      grantingPersistentAreaId: area.id,
    })
    expect(projectionMap.ok, projectionMap.ok ? undefined : projectionMap.reason).toBe(true)
    if (!projectionMap.ok) return
    expect(projectionMap.map.tokens.find((candidate) => candidate.id === area.anchorTokenId)
      ?.dnd5eSpellEffect?.shareVisionWithSource).toBe(true)

    const sourceAction = featureAction(
      'project-image-senses-source', 'switch-senses', map.id,
      { targetTokenId: actorToken.id, seq: 3, updatedAt: 3 },
      { 'sense-origin': 'source' },
    )
    const sourcePrepared = prepareDnd5ePluginFeatureAction({
      action: sourceAction,
      map: projectionMap.map,
      characters: projection.application.characters,
      initiativeOrder,
    })
    expect(sourcePrepared.ok, sourcePrepared.ok ? undefined : sourcePrepared.reason).toBe(true)
    if (!sourcePrepared.ok) return
    const source = await resolvePreparedDnd5ePluginFeatureAction({ prepared: sourcePrepared.prepared })
    expect(source.result.ok, source.result.ok ? undefined : source.result.reason).toBe(true)
    if (!source.result.ok) throw new Error(source.result.reason)
    if (!source.result.ok || !source.application) return
    expect(source.result.state.combatants[actorToken.id].conditions).not.toContain('blinded')
    expect(source.result.state.combatants[actorToken.id].conditions).not.toContain('deafened')
    const sourceMap = applyDnd5eActivityMapHandoffsV1({
      map: source.application.map,
      activity: source.result.activityDefinition!,
      packageId: sourcePrepared.prepared.feature.ownerPluginId,
      actionId: sourceAction.id,
      actorId: actorToken.id,
      round: 1,
      handoffs: source.result.activityHandoffs!,
      selection: {},
      grantingPersistentAreaId: area.id,
    })
    expect(sourceMap.ok, sourceMap.ok ? undefined : sourceMap.reason).toBe(true)
    if (!sourceMap.ok) return
    expect(sourceMap.map.tokens.find((candidate) => candidate.id === area.anchorTokenId)
      ?.dnd5eSpellEffect?.shareVisionWithSource).toBeUndefined()

    const moveAction = featureAction(
      'project-image-move', 'move-projection', map.id,
      { targetTokenIds: [], targetCell: { col: 5, row: 0 }, seq: 4, updatedAt: 4 },
    )
    const movePrepared = prepareDnd5ePluginFeatureAction({
      action: moveAction,
      map: sourceMap.map,
      characters: source.application.characters,
      initiativeOrder,
    })
    expect(movePrepared.ok, movePrepared.ok ? undefined : movePrepared.reason).toBe(true)
    if (!movePrepared.ok) return
    const moved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: movePrepared.prepared })
    expect(moved.result.ok, moved.result.ok ? undefined : moved.result.reason).toBe(true)
    if (!moved.result.ok) throw new Error(moved.result.reason)
    if (!moved.result.ok || !moved.application) return
    const movedMap = applyDnd5eActivityMapHandoffsV1({
      map: moved.application.map,
      activity: moved.result.activityDefinition!,
      packageId: movePrepared.prepared.feature.ownerPluginId,
      actionId: moveAction.id,
      actorId: actorToken.id,
      round: 1,
      handoffs: moved.result.activityHandoffs!,
      areaSelection: {
        anchorCell: movePrepared.prepared.targetCell!,
        cells: movePrepared.prepared.targetCells,
        targetIds: [],
        areaPlacement: movePrepared.prepared.headlessAction.activityAreaPlacement!,
        areaPlacementDistanceFeet: movePrepared.prepared.distanceFeet,
      },
      selection: {},
      movementOriginCell: movePrepared.prepared.persistentAreaGrant?.anchorCell,
      grantingPersistentAreaId: area.id,
    })
    expect(movedMap.ok, movedMap.ok ? undefined : movedMap.reason).toBe(true)
    if (!movedMap.ok) return
    expect(movedMap.map.dnd5ePluginAreas?.find((candidate) => candidate.id === area.id)?.anchorCell)
      .toEqual({ col: 5, row: 0 })
    expect(movedMap.map.tokens.find((candidate) => candidate.id === area.anchorTokenId))
      .toMatchObject({ x: 275, y: 25 })

    const farAction = featureAction(
      'project-image-move-too-far', 'move-projection', map.id,
      { targetTokenIds: [], targetCell: { col: 20, row: 0 }, seq: 5, updatedAt: 5 },
    )
    const farPrepared = prepareDnd5ePluginFeatureAction({
      action: farAction,
      map: movedMap.map,
      characters: moved.application.characters,
      initiativeOrder,
    })
    expect(farPrepared.ok, farPrepared.ok ? undefined : farPrepared.reason).toBe(true)
    if (!farPrepared.ok) return
    const far = await resolvePreparedDnd5ePluginFeatureAction({ prepared: farPrepared.prepared })
    expect(far.result.ok, far.result.ok ? undefined : far.result.reason).toBe(true)
    if (!far.result.ok) throw new Error(far.result.reason)
    if (!far.result.ok || !far.application) return
    expect(applyDnd5eActivityMapHandoffsV1({
      map: far.application.map,
      activity: far.result.activityDefinition!,
      packageId: farPrepared.prepared.feature.ownerPluginId,
      actionId: farAction.id,
      actorId: actorToken.id,
      round: 1,
      handoffs: far.result.activityHandoffs!,
      areaSelection: {
        anchorCell: farPrepared.prepared.targetCell!,
        cells: farPrepared.prepared.targetCells,
        targetIds: [],
        areaPlacement: farPrepared.prepared.headlessAction.activityAreaPlacement!,
        areaPlacementDistanceFeet: farPrepared.prepared.distanceFeet,
      },
      selection: {},
      movementOriginCell: farPrepared.prepared.persistentAreaGrant?.anchorCell,
      grantingPersistentAreaId: area.id,
    })).toEqual({ ok: false, reason: 'invalid-movement-placement' })
  })

  it('allows a bard who knows Project Image to create its Host-owned projection', () => {
    let actor = wizard('project-image')
    actor.id = 'project-image-bard'
    actor.name = '投影术吟游诗人'
    actor.charClass = '吟游诗人'
    actor.level = 17
    actor.hitDice = '17d8'
    actor.dnd5eClassLevels = { bard: 17 }
    actor.dnd5eClassChoices = {
      classes: { bard: { selections: { 'spell-known': ['project-image'] }, subclass: 'lore' } },
    }
    actor.classResources = { 'dnd5e-spell-slot-7': { current: 1, max: 1 } }
    const materialGrant = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:caster-replica-5gp', quantity: 1,
    })
    expect(materialGrant.ok).toBe(true)
    actor = materialGrant.characters[0]
    const actorToken = token('project-image-bard-token', 'player', 25, actor.id)
    const map: BattleMap = {
      id: 'project-image-bard-map', name: 'Map', width: 2_000, height: 500,
      gridSize: 20, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const initiativeOrder = [{
      tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20,
    }]
    const castAction: SharedPlayerActionState = {
      id: 'project-image-bard-cast', mapId: map.id, combatId: 'project-image-bard-combat',
      sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
      actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenIds: [], targetCell: { col: 29, row: 16 },
      dnd5eSpellCast: {
        spellId: 'project-image', castingClassId: 'bard', slotLevel: 7,
        targetTokenId: actorToken.id, targetTokenIds: [],
        areaTargetCell: { col: 29, row: 16 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const preparedCast = prepareDnd5ePluginSpellCast({
      action: castAction, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(preparedCast.ok, preparedCast.ok ? undefined : preparedCast.reason).toBe(true)
    if (!preparedCast.ok) return
    const cast = resolvePreparedDnd5ePluginSpellCast({ prepared: preparedCast.prepared, rolls: {} })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[actorToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: expect.stringContaining('project-image-controller') }),
    )
    expect(cast.result.activityHandoffs?.persistentAreas).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'create-persistent-area' }),
    ]))
  })

  it('casts Mirror Image as a magical spell effect and reuses the generic attack-decoy assertion', () => {
    const actor = wizard('mirror-image')
    const actorToken = token('mirror-caster', 'player', 25, actor.id)
    const enemyToken = token('mirror-enemy', 'enemy', 75)
    const map: BattleMap = {
      id: 'mirror-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'mirror-cast', mapId: map.id, combatId: 'mirror-combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'mirror-image', castingClassId: 'wizard', slotLevel: 2,
        targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, enemyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const cast = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    if (!cast.result.ok) throw new Error(cast.result.reason)
    const mirror = cast.result.state.combatants[actorToken.id].classState.activeEffects?.find(
      (effect) => effect.source.rulesId === 'mirror-image',
    )
    expect(mirror).toMatchObject({
      source: {
        kind: 'spell', rulesId: 'mirror-image', spellLevel: 2, magical: true,
      },
      modifiers: {
        attackDecoys: {
          remaining: 3,
          redirectMinimumD20: [11, 8, 6],
          armorClassBase: 10,
          armorClassAbility: 'dex',
          requiresOrdinarySight: true,
        },
      },
    })
    expect(cast.application?.characters.find((character) => character.id === actor.id)
      ?.dnd5eCombatState?.activeEffects).toContainEqual(expect.objectContaining({
        id: mirror?.id,
        source: expect.objectContaining({
          kind: 'spell', rulesId: 'mirror-image', spellLevel: 2, magical: true,
        }),
        modifiers: expect.objectContaining({
          attackDecoys: expect.objectContaining({ remaining: 3 }),
        }),
      }))

    const attackState = structuredClone(cast.result.state)
    attackState.initiativeIndex = attackState.initiativeOrder.indexOf(enemyToken.id)
    attackState.combatants[enemyToken.id].turn.actionAvailable = true
    const baseAttack = {
      type: 'attack' as const,
      actorId: enemyToken.id,
      targetId: actorToken.id,
      attackModifier: 5,
      d20: 12,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [] as number[], type: 'slashing' as const },
    }
    const request = resolveDnd5eHeadlessAction(attackState, baseAttack)
    expect(request).toMatchObject({
      ok: false,
      attackDecoyRollRequirement: { remaining: 3, minimumD20: 6, armorClass: 12 },
    })
    if (request.ok || !request.attackDecoyRollRequirement || !mirror) return
    const settled = resolveDnd5eHeadlessAction(attackState, {
      ...baseAttack,
      attackDecoyRolls: [{
        occurrenceId: request.attackDecoyRollRequirement.occurrenceId,
        effectId: mirror.id,
        redirectD20: 6,
      }],
    })
    expect(settled).toMatchObject({
      ok: true,
      state: { combatants: { [actorToken.id]: { currentHp: 30 } } },
      events: expect.arrayContaining([
        expect.objectContaining({ type: 'attack-decoy-resolved', redirected: true, decoyHit: true }),
      ]),
    })

    const pluginId = 'com.example.attack-decoy-activity'
    const attackActivity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'generic-spell-attack',
      name: 'Generic Spell Attack',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 60 },
      checks: [{
        id: 'spell-attack', kind: 'attack-roll', rollId: 'spell-attack-d20',
        attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
        rollMode: 'host-derived', scope: 'per-target',
      }],
      outcomes: [{
        id: 'hit', when: { kind: 'check', checkId: 'spell-attack', result: 'success' },
        operations: [{
          id: 'damage', kind: 'damage', target: 'target',
          amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 },
          damageType: 'force', magical: true,
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell', id: 'generic-spell-attack' },
    }
    const activityRegistration = registerDnd5eActivityPackage({
      packageId: pluginId, packageVersion: '1.0.0', activities: [attackActivity],
    })
    const compiledAttackActivity = compileDnd5eActivityHeadlessAction(attackActivity)
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Attack Decoy Activity', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0',
      },
      setup(api) {
        api.registerHeadlessAction(compiledAttackActivity)
      },
    })
    try {
      attackState.combatants[enemyToken.id].saveDc = 13
      const activityAction = {
        type: 'plugin' as const,
        pluginId,
        actionId: attackActivity.id,
        actorId: enemyToken.id,
        targetId: actorToken.id,
        targetIds: [actorToken.id],
        rolls: {
          [`spell-attack-d20:${actorToken.id}`]: { values: [12], modifier: 0, total: 12 },
          damage: { values: [6], modifier: 0, total: 6 },
        },
      }
      const activityRequest = resolveDnd5eHeadlessAction(attackState, activityAction)
      expect(activityRequest, activityRequest.ok ? undefined : activityRequest.reason).toMatchObject({
        ok: false,
        attackDecoyRollRequirement: {
          occurrenceId: `activity:${pluginId}:${attackActivity.id}:spell-attack:${actorToken.id}`,
          targetId: actorToken.id,
        },
      })
      if (activityRequest.ok || !activityRequest.attackDecoyRollRequirement) return
      const activitySettled = resolveDnd5eHeadlessAction(attackState, {
        ...activityAction,
        attackDecoyRolls: [{
          occurrenceId: activityRequest.attackDecoyRollRequirement.occurrenceId,
          effectId: mirror.id,
          redirectD20: 6,
        }],
      })
      expect(activitySettled).toMatchObject({
        ok: true,
        state: { combatants: { [actorToken.id]: { currentHp: 30 } } },
        events: expect.arrayContaining([
          expect.objectContaining({ type: 'attack-decoy-resolved', redirected: true }),
          expect.objectContaining({
            type: 'attack-resolved', actorId: enemyToken.id, targetId: actorToken.id,
            d20: 12, total: 17, armorClass: 12, hit: false, critical: false,
            attackMode: 'spell', attackOrigin: 'other',
          }),
        ]),
      })
      if (activitySettled.ok) {
        expect(activitySettled.events).not.toContainEqual(expect.objectContaining({
          type: 'damage-applied', targetId: actorToken.id,
        }))
      }
    } finally {
      dispose()
      activityRegistration.dispose()
    }
  })

  it('requires and atomically consumes Stoneskin diamond dust through the audited Activity path', () => {
    let actor = wizard('stoneskin')
    actor.level = 7
    actor.classResources = { 'dnd5e-spell-slot-4': { current: 1, max: 1 } }
    const actorToken = token('stoneskin-caster', 'player', 25, actor.id)
    const enemyToken = token('stoneskin-enemy', 'enemy', 225)
    const map: BattleMap = {
      id: 'stoneskin-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'stoneskin-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'stoneskin', castingClassId: 'wizard', slotLevel: 4,
        targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, enemyToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))

    expect(prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })).toEqual({ ok: false, reason: 'costly-material-unavailable' })

    const grant = applyDnd5eInventoryMutation([actor], {
      type: 'grant',
      characterId: actor.id,
      templateId: 'srd-5.1:item:diamond-dust-100gp',
      quantity: 1,
    })
    expect(grant.ok).toBe(true)
    actor = grant.characters[0]
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.spellMaterialPlan).toBeDefined()
    expect(normalizeDnd5eInventory(actor).entries).toHaveLength(1)

    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: {},
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(normalizeDnd5eInventory(
      resolved.application!.characters.find((character) => character.id === actor.id)!,
    ).entries).toHaveLength(0)
  })

  it('revives a persisted dead character through the full exploration spell transaction', () => {
    let actor = wizard('raise-dead')
    actor.charClass = '牧师'
    actor.level = 20
    actor.abilities.wis = 18
    actor.dnd5eClassChoices = {
      classes: { cleric: { selections: { 'spell-prepared': ['raise-dead'] } } },
    }
    actor.classResources = { 'dnd5e-spell-slot-5': { current: 1, max: 3 } }
    const granted = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:diamond-500gp', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    actor = granted.characters[0]

    const target: Character = {
      ...wizard('guidance'), id: 'raise-dead-target', name: '尸体',
      currentHp: 0, deathSaveFailures: 3, deathSaveSuccesses: 0,
      dnd5eCombatState: {
        schemaVersion: 2, deathRound: 4, bodyPresent: true,
        missingBodyParts: ['左臂'],
      },
    }
    const actorToken = token('raise-dead-caster', 'player', 25, actor.id)
    const targetToken = {
      ...token('raise-dead-corpse', 'player', 75, target.id), hp: 0, maxHp: target.maxHp,
    }
    const map: BattleMap = {
      id: 'raise-dead-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, targetToken],
    }
    const action: SharedPlayerActionState = {
      id: 'raise-dead-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: targetToken.id, targetTokenIds: [targetToken.id],
      dnd5eSpellCast: {
        spellId: 'raise-dead', castingClassId: 'cleric', slotLevel: 5,
        targetTokenId: targetToken.id, targetTokenIds: [targetToken.id],
      },
      round: 4, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, targetToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor, target], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[targetToken.id]).toMatchObject({
      currentHp: 0,
      deathSaves: { failures: 3, dead: true },
      classState: { deathRound: 4, bodyPresent: true, missingBodyParts: ['左臂'] },
    })

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.application?.characters.find((character) => character.id === target.id)).toMatchObject({
      currentHp: 1, deathSaveFailures: 0, deathSaveSuccesses: 0,
      dnd5eCombatState: {
        missingBodyParts: ['左臂'],
        resurrectionPenalty: { value: -4, recoveryPerLongRest: 1 },
      },
    })
    expect(resolved.application?.characters.find((character) => character.id === target.id)
      ?.dnd5eCombatState?.deathRound).toBeUndefined()
  })

  it('persists Resurrection caster strain through the full exploration spell transaction', () => {
    let actor = wizard('resurrection')
    actor.charClass = '牧师'
    actor.level = 20
    actor.abilities.wis = 18
    actor.dnd5eClassChoices = {
      classes: { cleric: { selections: { 'spell-prepared': ['resurrection'] } } },
    }
    actor.classResources = { 'dnd5e-spell-slot-7': { current: 1, max: 2 } }
    const granted = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:diamond-1000gp', quantity: 1,
    })
    expect(granted.ok).toBe(true)
    actor = granted.characters[0]

    const target: Character = {
      ...wizard('guidance'), id: 'resurrection-target', name: '满一年尸体',
      currentHp: 0, deathSaveFailures: 3, deathSaveSuccesses: 0,
      dnd5eCombatState: {
        // The DM corpse editor saves against its authoritative round. The
        // exploration client can still submit an older synthetic action round.
        schemaVersion: 2, deathRound: 20 - 5_256_000, bodyPresent: true,
      },
    }
    const actorToken = token('resurrection-caster', 'player', 25, actor.id)
    const targetToken = {
      ...token('resurrection-corpse', 'player', 75, target.id), hp: 0, maxHp: target.maxHp,
    }
    const map: BattleMap = {
      id: 'resurrection-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, targetToken],
    }
    const action: SharedPlayerActionState = {
      id: 'resurrection-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: targetToken.id, targetTokenIds: [targetToken.id],
      dnd5eSpellCast: {
        spellId: 'resurrection', castingClassId: 'cleric', slotLevel: 7,
        targetTokenId: targetToken.id, targetTokenIds: [targetToken.id],
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, targetToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, authorityRound: 20, map, characters: [actor, target], initiativeOrder,
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.application?.characters.find((character) => character.id === actor.id)
      ?.dnd5eCombatState?.activeEffects).toContainEqual(expect.objectContaining({
        definitionId: 'srd-5.1:spell:resurrection:caster-strain',
        breakOn: ['long-rest-complete'],
      }))
    expect(resolved.application?.characters.find((character) => character.id === target.id)).toMatchObject({
      currentHp: target.maxHp, deathSaveFailures: 0, deathSaveSuccesses: 0,
      dnd5eCombatState: { resurrectionPenalty: { value: -4, recoveryPerLongRest: 1 } },
    })
  })

  it('fully settles True Resurrection at the 200-year boundary and creates a named body in an unoccupied space within 10 feet', () => {
    let actor = wizard('true-resurrection')
    actor.charClass = '牧师'
    actor.level = 20
    actor.abilities.wis = 20
    actor.dnd5eClassChoices = {
      classes: { cleric: { selections: { 'spell-prepared': ['true-resurrection'] } } },
    }
    actor.classResources = { 'dnd5e-spell-slot-9': { current: 1, max: 1 } }
    for (const templateId of [
      'srd-5.1:item:diamond-1000gp',
      'srd-5.1:item:holy-water-flask',
      'srd-5.1:item:diamond-25000gp',
    ]) {
      const granted = applyDnd5eInventoryMutation([actor], {
        type: 'grant', characterId: actor.id, templateId, quantity: 1,
      })
      expect(granted.ok).toBe(true)
      actor = granted.characters[0]
    }

    const target: Character = {
      ...wizard('guidance'), id: 'true-resurrection-target', name: '无遗体的艾拉',
      maxHp: 47, currentHp: 0, deathSaveFailures: 3, deathSaveSuccesses: 0,
      conditions: ['poisoned'],
      dnd5eCombatState: {
        // The one-hour casting time itself advances 600 rounds; beginning 600
        // rounds inside the limit lands exactly on the 200-year boundary.
        schemaVersion: 2, deathRound: 601, deathCause: 'other',
        soulReturnStatus: 'free-willing', bodyPresent: false,
        missingBodyParts: ['头颅', '左臂'], vitalBodyPartsMissing: true,
        activeEffects: [
          createDnd5eMechanicalEffect({
            id: 'true-res-poison', definitionId: 'test:true-res:poison', label: '中毒',
            legacyCondition: 'poisoned', targetId: 'true-resurrection-target-token',
            source: { kind: 'dm', magical: false }, duration: { type: 'permanent' },
          }),
          createDnd5eMechanicalEffect({
            id: 'true-res-disease', definitionId: 'test:true-res:disease', label: '魔法疫病',
            tags: ['disease'], targetId: 'true-resurrection-target-token',
            source: { kind: 'spell', magical: true }, duration: { type: 'permanent' },
          }),
          createDnd5eMechanicalEffect({
            id: 'true-res-curse', definitionId: 'test:true-res:curse', label: '死亡诅咒',
            tags: ['curse'], targetId: 'true-resurrection-target-token',
            source: { kind: 'spell', magical: true }, duration: { type: 'permanent' },
          }),
        ],
      },
    }
    const actorToken = { ...token('true-resurrection-caster', 'player', 25, actor.id), label: actor.name }
    const targetToken = {
      ...token('true-resurrection-target-token', 'player', 125, target.id),
      label: target.name, hp: 0, maxHp: target.maxHp,
    }
    const map: BattleMap = {
      id: 'true-resurrection-map', name: 'Map', width: 600, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, targetToken],
    }
    const action: SharedPlayerActionState = {
      id: 'true-resurrection-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: targetToken.id, targetTokenIds: [targetToken.id],
      dnd5eSpellCast: {
        spellId: 'true-resurrection', castingClassId: 'cleric', slotLevel: 9,
        targetTokenId: targetToken.id, targetTokenIds: [targetToken.id],
        trueResurrectionSpokenName: target.name,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, targetToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, authorityRound: 1_051_200_001, map, characters: [actor, target],
      initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[targetToken.id].classState).toMatchObject({
      deathCause: 'other', soulReturnStatus: 'free-willing', bodyPresent: false,
    })
    expect(prepared.prepared.activityHeadlessAction?.payload).toMatchObject({
      activityCompletionDelayRounds: 600,
    })
    const directActivity = resolveDnd5eActivity({
      activity: dnd5eSrdAuditedSpellActivityV1('true-resurrection')!,
      actor: dnd5eActivityActorSnapshotFromCombatantV1(
        prepared.prepared.state.combatants[actorToken.id],
      ),
      targets: [dnd5eActivityActorSnapshotFromCombatantV1(
        prepared.prepared.state.combatants[targetToken.id],
      )],
      rolls: {}, castLevel: 9, completionDelayRounds: 600,
      distanceFeetByTargetId: { [targetToken.id]: 10 },
    })
    expect(directActivity.ok, directActivity.ok ? undefined : JSON.stringify(directActivity)).toBe(true)
    if (directActivity.ok) expect(directActivity.proposals).toContainEqual(expect.objectContaining({
      kind: 'revive', targetId: targetToken.id, hitPoints: 47,
      maximumDeathAgeRounds: 1_051_200_000,
      excludesDeathFromOldAge: true, requiresFreeWillingSoul: true,
      restoreBody: 'complete', removeDiseases: 'all', removeCurses: 'all',
      createsNewBodyIfMissing: true, requiresSpokenNameIfBodyMissing: true,
      newBodyPlacementRangeFeet: 10, completionDelayRounds: 600,
    }))
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    const revivedCharacter = resolved.application?.characters.find((character) => character.id === target.id)
    expect(revivedCharacter).toMatchObject({
      currentHp: 47, deathSaveFailures: 0, deathSaveSuccesses: 0, conditions: [],
      dnd5eCombatState: { bodyPresent: true },
    })
    for (const key of [
      'deathRound', 'deathCause', 'soulReturnStatus', 'missingBodyParts',
      'vitalBodyPartsMissing', 'activeEffects',
    ]) expect(revivedCharacter?.dnd5eCombatState).not.toHaveProperty(key)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'creature-revived', targetId: targetToken.id, hitPoints: 47,
      deathAgeRounds: 1_051_200_000, newBodyCreated: true,
      removedConditionCount: 1, removedDiseaseCount: 1, removedCurseCount: 1,
    }))
    expect(normalizeDnd5eInventory(
      resolved.application!.characters.find((character) => character.id === actor.id)!,
    ).entries).toEqual([
      expect.objectContaining({ templateId: 'srd-5.1:item:diamond-1000gp', quantity: 1 }),
    ])
    expect(resolved.application?.characters.find((character) => character.id === actor.id)
      ?.classResources?.['dnd5e-spell-slot-9']?.current).toBe(0)

    const oneRoundTooOldTarget: Character = {
      ...target,
      dnd5eCombatState: { ...target.dnd5eCombatState!, deathRound: 600 },
    }
    const expiredPrepared = prepareDnd5ePluginSpellCast({
      action: { ...action, id: 'true-resurrection-expired-at-completion' },
      authorityRound: 1_051_200_001,
      map,
      characters: [actor, oneRoundTooOldTarget],
      initiativeOrder,
      roomRequiredPlugins: [],
    })
    expect(expiredPrepared.ok, expiredPrepared.ok ? undefined : expiredPrepared.reason).toBe(true)
    if (expiredPrepared.ok) {
      const expired = resolvePreparedDnd5ePluginSpellCast({
        prepared: expiredPrepared.prepared,
        rolls: {},
      })
      expect(expired.result).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(expired.application).toBeUndefined()
    }
    expect(actor.classResources?.['dnd5e-spell-slot-9']?.current).toBe(1)
    expect(normalizeDnd5eInventory(actor).entries).toHaveLength(3)
  })

  it.each([
    ['wrong spoken name', { trueResurrectionSpokenName: '另一个名字' }, {}, {}, 'invalid-target'],
    ['old age', {}, { deathCause: 'old-age' }, {}, 'invalid-target'],
    ['unwilling soul', {}, { soulReturnStatus: 'unwilling' }, {}, 'invalid-target'],
    ['unfree soul', {}, { soulReturnStatus: 'not-free' }, {}, 'invalid-target'],
    ['occupied replacement-body space', {}, {}, { blocker: true }, 'invalid-target'],
    ['replacement-body space beyond 10 feet', {}, {}, { targetX: 175 }, 'target-out-of-range'],
  ] as const)('rejects True Resurrection before settlement for %s', (
    _label,
    payloadPatch,
    targetStatePatch,
    mapPatch,
    expectedReason,
  ) => {
    let actor = wizard('true-resurrection')
    actor.charClass = '牧师'
    actor.level = 20
    actor.abilities.wis = 20
    actor.dnd5eClassChoices = {
      classes: { cleric: { selections: { 'spell-prepared': ['true-resurrection'] } } },
    }
    actor.classResources = { 'dnd5e-spell-slot-9': { current: 1, max: 1 } }
    for (const templateId of ['srd-5.1:item:holy-water-flask', 'srd-5.1:item:diamond-25000gp']) {
      const granted = applyDnd5eInventoryMutation([actor], {
        type: 'grant', characterId: actor.id, templateId, quantity: 1,
      })
      expect(granted.ok).toBe(true)
      actor = granted.characters[0]
    }
    const target: Character = {
      ...wizard('guidance'), id: `true-res-invalid-${_label}`, name: '艾拉',
      currentHp: 0, deathSaveFailures: 3,
      dnd5eCombatState: {
        schemaVersion: 2, deathRound: 1, deathCause: 'other',
        soulReturnStatus: 'free-willing', bodyPresent: false,
        ...targetStatePatch,
      },
    }
    const actorToken = token(`true-res-caster-${_label}`, 'player', 25, actor.id)
    const targetX = 'targetX' in mapPatch ? mapPatch.targetX : 125
    const targetToken = {
      ...token(`true-res-target-${_label}`, 'player', targetX, target.id),
      label: target.name, hp: 0, maxHp: target.maxHp,
    }
    const blocker = 'blocker' in mapPatch && mapPatch.blocker
      ? { ...token(`true-res-blocker-${_label}`, 'enemy', targetX), label: '占据者' }
      : undefined
    const map: BattleMap = {
      id: `true-res-map-${_label}`, name: 'Map', width: 600, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, targetToken, ...(blocker ? [blocker] : [])],
    }
    const action: SharedPlayerActionState = {
      id: `true-res-cast-${_label}`, mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: targetToken.id, targetTokenIds: [targetToken.id],
      dnd5eSpellCast: {
        spellId: 'true-resurrection', castingClassId: 'cleric', slotLevel: 9,
        targetTokenId: targetToken.id, targetTokenIds: [targetToken.id],
        trueResurrectionSpokenName: target.name,
        ...payloadPatch,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = map.tokens.map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    expect(prepareDnd5ePluginSpellCast({
      action, authorityRound: 1_051_200_001, map, characters: [actor, target],
      initiativeOrder, roomRequiredPlugins: [],
    })).toEqual({ ok: false, reason: expectedReason })
    expect(actor.classResources?.['dnd5e-spell-slot-9']?.current).toBe(1)
    expect(normalizeDnd5eInventory(actor).entries).toHaveLength(2)
  })

  it('rebuilds Fire Storm targets from 1-10 face-connected cubes and can spare plants', () => {
    const actor = wizard('fire-storm')
    actor.charClass = '牧师'
    actor.level = 13
    actor.abilities.wis = 18
    actor.dnd5eClassChoices = { classes: { cleric: { selections: { 'spell-prepared': ['fire-storm'] } } } }
    actor.classResources = { 'dnd5e-spell-slot-7': { current: 1, max: 1 } }
    const actorToken = token('fire-storm-caster', 'player', 25, actor.id)
    const first = token('fire-storm-first', 'enemy', 175)
    const second = token('fire-storm-second', 'enemy', 275)
    const plant: Token = {
      ...token('fire-storm-plant', 'enemy', 225),
      creatureTypes: ['plant'],
    }
    const map: BattleMap = {
      id: 'fire-storm-map', name: 'Map', width: 800, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, first, plant, second],
    }
    const action: SharedPlayerActionState = {
      id: 'fire-storm-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: first.id,
      dnd5eSpellCast: {
        spellId: 'fire-storm', castingClassId: 'cleric', slotLevel: 7,
        targetTokenId: first.id,
        areaTargetCell: { col: 3, row: 0 },
        areaTargetCells: [{ col: 3, row: 0 }, { col: 5, row: 0 }],
        activityChoices: { mode: 'spare-plants' },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepare = (candidate: SharedPlayerActionState) => prepareDnd5ePluginSpellCast({
      action: candidate, map, characters: [actor],
      initiativeOrder: [actorToken, first, plant, second].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    const prepared = prepare(action)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (prepared.ok) {
      expect(prepared.prepared.activityAreaPlacement?.instances).toHaveLength(2)
      expect(prepared.prepared.targetTokens.map((candidate) => candidate.id))
        .toEqual(expect.arrayContaining([first.id, second.id]))
      expect(prepared.prepared.targetTokens.map((candidate) => candidate.id)).not.toContain(plant.id)
      const resolved = resolvePreparedDnd5ePluginSpellCast({
        prepared: prepared.prepared,
        rolls: { activityRolls: {
          'fire-storm-damage': { values: [4, 4, 4, 4, 4, 4, 4], modifier: 0, total: 28 },
          [`spell-save-d20:${first.id}`]: { values: [1, 2], modifier: 0, total: 3 },
          [`spell-save-d20:${second.id}`]: { values: [20, 19], modifier: 0, total: 39 },
        } },
      })
      expect(resolved.result.ok, resolved.result.ok ? undefined : JSON.stringify(resolved.result)).toBe(true)
      if (!resolved.result.ok) throw new Error(resolved.result.reason)
      if (resolved.result.ok) {
        expect(resolved.result.events).toContainEqual(expect.objectContaining({
          type: 'damage-applied', targetId: first.id, amount: 28,
        }))
        expect(resolved.result.events).toContainEqual(expect.objectContaining({
          type: 'damage-applied', targetId: second.id, amount: 14,
        }))
        expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
          type: 'damage-applied', targetId: plant.id,
        }))
      }
    }

    const disconnected = structuredClone(action)
    disconnected.dnd5eSpellCast!.areaTargetCells = [{ col: 3, row: 0 }, { col: 7, row: 0 }]
    expect(prepare(disconnected)).toMatchObject({ ok: false, reason: 'invalid-target' })

    const upcast = structuredClone(action)
    upcast.id = 'fire-storm-upcast'
    upcast.dnd5eSpellCast!.slotLevel = 8
    actor.classResources!['dnd5e-spell-slot-8'] = { current: 1, max: 1 }
    const preparedUpcast = prepare(upcast)
    expect(preparedUpcast.ok, preparedUpcast.ok ? undefined : preparedUpcast.reason).toBe(true)
    if (preparedUpcast.ok) {
      const damage = preparedUpcast.prepared.activity?.outcomes
        .flatMap((outcome) => outcome.operations)
        .find((operation) => operation.id === 'fire-storm-damage')
      expect(damage).toMatchObject({
        kind: 'damage', amount: { kind: 'dice', count: 7, sides: 10 },
      })
    }
  })

  it('clips Storm of Vengeance persistent cells to the map before shared-state commit', () => {
    const actor = wizard('storm-of-vengeance')
    actor.charClass = '德鲁伊'
    actor.level = 20
    actor.abilities.wis = 20
    actor.dnd5eClassChoices = {
      classes: { druid: { selections: { 'spell-prepared': ['storm-of-vengeance'] } } },
    }
    actor.classResources = { 'dnd5e-spell-slot-9': { current: 1, max: 1 } }
    const actorToken = token('storm-caster', 'player', 775, actor.id)
    const first = token('storm-first', 'enemy', 25)
    const second = token('storm-second', 'enemy', 1_725)
    const map: BattleMap = {
      id: 'storm-map', name: 'Map', width: 1_774, height: 887,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, first, second],
    }
    const action: SharedPlayerActionState = {
      id: 'storm-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenIds: [],
      dnd5eSpellCast: {
        spellId: 'storm-of-vengeance', castingClassId: 'druid', slotLevel: 9,
        targetTokenId: '', targetTokenIds: [], areaTargetCell: { col: 31, row: 6 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], roomRequiredPlugins: [],
      initiativeOrder: [actorToken, first, second].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.activityTargetCells.length).toBeLessThanOrEqual(36 * 18)
    expect(prepared.prepared.activityTargetCells.every((cell) =>
      cell.col >= 0 && cell.col < 36 && cell.row >= 0 && cell.row < 18,
    )).toBe(true)
    expect(prepared.prepared.targetTokens.map((candidate) => candidate.id))
      .toEqual(expect.arrayContaining([actorToken.id, first.id, second.id]))

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    if (!resolved.result.ok || !resolved.application) return
    const applied = applyDnd5eActivityMapHandoffsV1({
      map: resolved.application.map,
      activity: resolved.result.activityDefinition!,
      packageId: prepared.prepared.spell.ownerPluginId,
      actionId: action.id,
      actorId: actorToken.id,
      sourceSaveDc: prepared.prepared.saveDc,
      concentrationId: prepared.prepared.spell.id,
      round: 1,
      combatId: action.combatId,
      handoffs: resolved.result.activityHandoffs!,
      areaSelection: {
        anchorCell: prepared.prepared.activityTargetCell!,
        cells: prepared.prepared.activityTargetCells,
        targetIds: prepared.prepared.targetTokens.map((candidate) => candidate.id),
        areaPlacement: resolved.result.activityAreaInstance!,
        areaPlacementDistanceFeet: prepared.prepared.activityAreaPlacementDistanceFeet ?? 0,
      },
      selection: {},
    })
    expect(applied.ok, applied.ok ? undefined : applied.reason).toBe(true)
    if (!applied.ok) return
    expect(validateAndMigrateSharedResource('maps', { maps: [applied.map] }).status).toBe('valid')
  })

  it('spends a reaction for an audited reaction spell instead of rejecting it as an action cast', () => {
    const actor = wizard('feather-fall')
    actor.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 4 } }
    const actorToken = token('wizard-token-reaction', 'player', 25, actor.id)
    const enemyToken = token('enemy-token-reaction', 'enemy', 225)
    enemyToken.elevationFeet = 50
    const map: BattleMap = {
      id: 'map-reaction', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'reaction-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: enemyToken.id,
      dnd5eSpellCast: {
        spellId: 'feather-fall', castingClassId: 'wizard', slotLevel: 1,
        targetTokenId: enemyToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, enemyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.castingTime).toBe('reaction')
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(
      resolved.result.ok,
      resolved.result.ok ? undefined : `${resolved.result.reason}:${resolved.result.events.map((event) => event.type).join(',')}`,
    ).toBe(true)
    expect(resolved.result.state.combatants[actorToken.id].turn.reactionAvailable).toBe(false)
    expect(resolved.result.state.combatants[actorToken.id].turn.actionAvailable).toBe(true)
    expect(resolved.result.state.combatants[enemyToken.id]).toMatchObject({
      elevationFeet: 50,
      airborne: true,
    })
    expect(resolved.result.state.combatants[enemyToken.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        modifiers: expect.objectContaining({
          controlledDescent: {
            maximumFeetPerRound: 60,
            safeLanding: true,
            endsOnLanding: true,
          },
        }),
      }))
  })

  it('arms Branding Smite without pre-rolling, upcasts the delayed dice, and consumes it on a real hit', () => {
    const actor = wizard('branding-smite')
    actor.charClass = '圣武士'
    actor.level = 9
    actor.abilities.cha = 18
    actor.dnd5eClassChoices = {
      classes: { paladin: { selections: { 'spell-prepared': ['branding-smite'] } } },
    }
    actor.classResources = { 'dnd5e-spell-slot-4': { current: 1, max: 1 } }
    const actorToken = token('branding-caster', 'player', 25, actor.id)
    const enemyToken = token('branding-target', 'enemy', 75)
    const map: BattleMap = {
      id: 'map-branding-smite', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'branding-smite-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'branding-smite', castingClassId: 'paladin', slotLevel: 4,
        targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, enemyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    if (!cast.result.ok) throw new Error(cast.result.reason)
    const caster = cast.result.state.combatants[actorToken.id]
    expect(caster.turn.bonusActionAvailable).toBe(false)
    expect(caster.classState.activeEffects).toContainEqual(expect.objectContaining({
      modifiers: expect.objectContaining({
        onHitBonusDamage: expect.objectContaining({
          count: 4, sides: 6, damageType: 'radiant', consumeEffectOnHit: true,
        }),
      }),
    }))
    const context = {
      mode: 'melee' as const, strengthBased: true, finesse: false,
      weaponDamageSides: 8, damageType: 'slashing' as const,
      adjacentEnemyOfTarget: false,
    }
    const definitions = dnd5eWeaponClassDamageDefinitions({
      state: cast.result.state,
      actorId: actorToken.id,
      targetId: enemyToken.id,
      context,
      critical: false,
    })
    expect(definitions).toContainEqual(expect.objectContaining({
      source: 'activity-effect-rider', count: 4, sides: 6, type: 'radiant',
      doubleOnCritical: true, consumeActiveEffectOnHit: true,
    }))
    const rider = definitions.find((definition) => definition.activeEffectId)
    expect(rider?.rollId).toBeTruthy()
    const criticalHit = resolveDnd5eHeadlessAction(structuredClone(cast.result.state), {
      type: 'attack', actorId: actorToken.id, targetId: enemyToken.id,
      attackModifier: 8, d20: 20,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [5, 4], type: 'slashing' },
      classDamageContext: context,
      classDamageRolls: [{
        source: 'activity-effect-rider', rollId: rider!.rollId,
        rolls: [6, 5, 4, 3, 6, 5, 4, 3],
      }],
    })
    expect(criticalHit.ok, criticalHit.ok ? undefined : criticalHit.reason).toBe(true)
    if (criticalHit.ok) {
      expect(criticalHit.events).toContainEqual(expect.objectContaining({
        type: 'class-damage-applied', source: 'activity-effect-rider', amount: 36,
      }))
    }
    const hit = resolveDnd5eHeadlessAction(cast.result.state, {
      type: 'attack', actorId: actorToken.id, targetId: enemyToken.id,
      attackModifier: 8, d20: 15,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
      classDamageContext: context,
      classDamageRolls: [{
        source: 'activity-effect-rider', rollId: rider!.rollId, rolls: [6, 5, 4, 3],
      }],
    })
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants[enemyToken.id].currentHp).toBe(7)
    expect(hit.state.combatants[actorToken.id].concentrating).toBe(true)
    expect(hit.state.combatants[actorToken.id].classState.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ id: rider!.activeEffectId }))
    expect(hit.state.combatants[enemyToken.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        modifiers: expect.objectContaining({
          conditionImmunities: ['invisible'],
          emittedLight: { brightRadiusFeet: 0, dimRadiusFeet: 5, color: '#fef3c7' },
        }),
      }))
    expect(hit.events).toContainEqual(expect.objectContaining({
      type: 'class-damage-applied', source: 'activity-effect-rider', amount: 18,
    }))
  })

  it('applies Aid slot scaling to current and effective maximum HP and reverses the maximum safely', () => {
    const actor = wizard('aid')
    actor.charClass = '牧师'
    actor.level = 7
    actor.dnd5eClassChoices = { classes: { cleric: { selections: { 'spell-prepared': ['aid'] } } } }
    actor.classResources = { 'dnd5e-spell-slot-4': { current: 1, max: 1 } }
    actor.currentHp = 20
    const actorToken = token('aid-caster', 'player', 25, actor.id)
    actorToken.hp = 20
    const map: BattleMap = {
      id: 'map-aid', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, token('aid-enemy', 'enemy', 225)],
    }
    const action: SharedPlayerActionState = {
      id: 'aid-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'aid', castingClassId: 'cleric', slotLevel: 4, targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = map.tokens.map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    const combatant = resolved.result.state.combatants[actorToken.id]
    expect(dnd5eActiveHitPointMaximumBonus(combatant.classState.activeEffects)).toBe(15)
    expect(combatant.currentHp).toBe(35)
    expect(combatant.maxHp).toBe(30)
    if (!resolved.application) throw new Error('Aid must produce a map application')
    const persistedActor = resolved.application.characters.find((candidate) => candidate.id === actor.id)!
    expect(persistedActor).toMatchObject({ currentHp: 35, maxHp: 30 })
    expect(resolved.application.map.tokens.find((candidate) => candidate.id === actorToken.id))
      .toMatchObject({ hp: 35, maxHp: 30 })
    const reconnected = createDnd5eMapCombatSnapshot({
      combatId: 'combat', round: 2, map: resolved.application.map,
      characters: resolved.application.characters, initiativeOrder,
    })
    expect(reconnected.state.combatants[actorToken.id]).toMatchObject({ currentHp: 35, maxHp: 30 })
    expect(planDnd5eMapResultApplication({
      state: reconnected.state,
      map: resolved.application.map,
      characters: resolved.application.characters,
      characterIdByCombatantId: reconnected.characterIdByCombatantId,
    }).characters.find((candidate) => candidate.id === actor.id))
      .toMatchObject({ currentHp: 35, maxHp: 30 })
    replaceDnd5eCombatantActiveEffects(combatant, [])
    expect(combatant.currentHp).toBe(30)
  })

  it('does not report a creature-form HP replacement as damage', () => {
    const damageByTarget = dnd5ePluginSpellDamageByTargetId([{
      type: 'class-state-changed', actorId: 'polymorph-target',
      stateKey: 'creature-form:polymorph', active: true, value: 136,
    }])
    expect(damageByTarget.get('polymorph-target') ?? 0).toBe(0)
    expect(dnd5ePluginSpellDamageByTargetId([{
      type: 'damage-applied', sourceId: 'caster', targetId: 'polymorph-target', amount: 17,
      hpBefore: 136, hpAfter: 119, temporaryHpBefore: 0, temporaryHpAfter: 0,
    }]).get('polymorph-target')).toBe(17)
  })

  it('completes an audited minute/hour assisted cast outside initiative after DM approval without spending turn economy', () => {
    const actor = wizard('creation')
    actor.level = 9
    actor.classResources = { 'dnd5e-spell-slot-5': { current: 1, max: 1 } }
    const actorToken = token('wizard-token-long-cast', 'player', 25, actor.id)
    const enemyToken = token('enemy-token-long-cast', 'enemy', 225)
    const map: BattleMap = {
      id: 'map-long-cast', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'long-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'creation', castingClassId: 'wizard', slotLevel: 5,
        targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, enemyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.castingTime).toBe('long')
    const unresolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(unresolved.result).toMatchObject({ ok: false, reason: 'dm-adjudication-pending' })
    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: { activityInterruptChoiceId: 'dm-apply' },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.state.combatants[actorToken.id].turn).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: true,
      reactionAvailable: true,
    })
    expect(resolved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-5'].current).toBe(0)
  })

  it('resolves Legend Lore without DM approval while consuming its slot and incense', () => {
    let actor = wizard('legend-lore')
    actor.level = 9
    actor.hitDice = '9d6'
    actor.classResources = { 'dnd5e-spell-slot-5': { current: 1, max: 3 } }
    actor = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:legend-lore-incense-250gp', quantity: 1,
    }).characters[0]
    actor = applyDnd5eInventoryMutation([actor], {
      type: 'grant', characterId: actor.id,
      templateId: 'srd-5.1:item:ivory-strip-50gp', quantity: 4,
    }).characters[0]
    const actorToken = token('legend-lore-caster', 'player', 25, actor.id)
    const witnessToken = token('legend-lore-witness', 'enemy', 225)
    const map: BattleMap = {
      id: 'legend-lore-map', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, witnessToken],
    }
    const action: SharedPlayerActionState = {
      id: 'legend-lore-cast', mapId: map.id, sourceMode: 'player', status: 'pending',
      type: 'dnd5e-spell-cast', actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'legend-lore', castingClassId: 'wizard', slotLevel: 5,
        targetTokenId: actorToken.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [actorToken, witnessToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      castingTime: 'long', slotLevel: 5,
      activity: { id: 'spell:legend-lore', target: { kind: 'self' } },
      spellMaterialPlan: {
        allocations: expect.arrayContaining([
          expect.objectContaining({ tag: 'legend-lore-incense', consumed: true, quantity: 1 }),
          expect.objectContaining({ tag: 'ivory-strip', consumed: false, quantity: 4 }),
        ]),
      },
    })
    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: {},
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    if (!resolved.result.ok || !resolved.application) return
    expect(resolved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-5'].current).toBe(0)
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'damage-applied' }))
    const settledActor = resolved.application.characters.find((character) => character.id === actor.id)!
    const inventory = normalizeDnd5eInventory(settledActor).entries
    expect(inventory.find((entry) => entry.templateId === 'srd-5.1:item:legend-lore-incense-250gp'))
      .toBeUndefined()
    expect(inventory.find((entry) => entry.templateId === 'srd-5.1:item:ivory-strip-50gp')?.quantity)
      .toBe(4)
  })

  it('validates Fire Shield modes, light, dismissal, and alternate-mode replacement', () => {
    const actor = wizard('fire-shield')
    actor.level = 7
    actor.classResources = { 'dnd5e-spell-slot-4': { current: 2, max: 2 } }
    const actorToken = token('wizard-token-choice', 'player', 25, actor.id)
    const enemyToken = token('enemy-token-choice', 'enemy', 225)
    const map: BattleMap = {
      id: 'map-choice', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'choice-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'fire-shield', castingClassId: 'wizard', slotLevel: 4,
        targetTokenId: actorToken.id, activityChoices: { mode: 'warm' },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, enemyToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder,
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    const warmEffects = resolved.result.state.combatants[actorToken.id].classState.activeEffects ?? []
    expect(warmEffects).toContainEqual(expect.objectContaining({
      definitionId: expect.stringContaining(':fire-shield-warm:'),
      modifiers: expect.objectContaining({
        damageResistance: 'cold',
        emittedLight: expect.objectContaining({
          brightRadiusFeet: 10, dimRadiusFeet: 10, color: '#fb923c',
        }),
      }),
      removal: expect.objectContaining({ action: expect.objectContaining({
        label: '解除火焰护盾', economy: 'action', maxDistanceFeet: 0,
      }) }),
    }))
    expect(warmEffects.filter((effect) => effect.definitionId.includes(':fire-shield-warm:'))).toHaveLength(1)
    expect(resolved.application).toBeDefined()
    if (!resolved.application) return

    const chillAction: SharedPlayerActionState = {
      ...action,
      id: 'choice-cast-chill',
      seq: 2,
      updatedAt: 2,
      dnd5eSpellCast: {
        ...action.dnd5eSpellCast!,
        activityChoices: { mode: 'chill' },
      },
    }
    const chillPrepared = prepareDnd5ePluginSpellCast({
      action: chillAction,
      map: resolved.application.map,
      characters: resolved.application.characters,
      initiativeOrder,
      roomRequiredPlugins: [],
    })
    expect(chillPrepared.ok, chillPrepared.ok ? undefined : chillPrepared.reason).toBe(true)
    if (!chillPrepared.ok) return
    const chill = resolvePreparedDnd5ePluginSpellCast({
      prepared: chillPrepared.prepared,
      rolls: {},
    })
    expect(chill.result.ok, chill.result.ok ? undefined : chill.result.reason).toBe(true)
    if (!chill.result.ok) throw new Error(chill.result.reason)
    const effects = chill.result.state.combatants[actorToken.id].classState.activeEffects ?? []
    expect(effects).not.toContainEqual(expect.objectContaining({
      definitionId: expect.stringContaining(':fire-shield-warm:'),
    }))
    expect(effects).toContainEqual(expect.objectContaining({
      definitionId: expect.stringContaining(':fire-shield-chill:'),
      modifiers: expect.objectContaining({
        damageResistance: 'fire',
        emittedLight: expect.objectContaining({
          brightRadiusFeet: 10, dimRadiusFeet: 10, color: '#a5f3fc',
        }),
      }),
      removal: expect.objectContaining({ action: expect.objectContaining({
        label: '解除火焰护盾', economy: 'action', maxDistanceFeet: 0,
      }) }),
    }))
    expect(effects.filter((effect) => effect.definitionId.includes(':fire-shield-chill:'))).toHaveLength(1)
  })

  it('resolves Fire Shield mode resistance and automatic melee retaliation through Activity', async () => {
    const actor = wizard('fire-shield')
    actor.level = 7
    actor.classResources = { 'dnd5e-spell-slot-4': { current: 1, max: 1 } }
    const actorToken = token('wizard-token-fire-shield', 'player', 25, actor.id)
    const enemyToken = token('enemy-token-fire-shield', 'enemy', 75)
    const map: BattleMap = {
      id: 'map-fire-shield', name: 'Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'fire-shield-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: actorToken.id,
      dnd5eSpellCast: {
        spellId: 'fire-shield', castingClassId: 'wizard', slotLevel: 4,
        targetTokenId: actorToken.id, activityChoices: { mode: 'warm' },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, enemyToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    if (!cast.result.ok) throw new Error(cast.result.reason)
    expect(cast.result.state.combatants[actorToken.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        definitionId: expect.stringContaining(':fire-shield-warm:'),
        modifiers: expect.objectContaining({ damageResistance: 'cold' }),
      }))

    const ended = resolveDnd5eHeadlessAction(cast.result.state, {
      type: 'end-turn', actorId: actorToken.id,
    })
    expect(ended.ok, ended.ok ? undefined : ended.reason).toBe(true)
    if (!ended.ok) return
    const attack = resolveDnd5eHeadlessAction(ended.state, {
      type: 'attack', actorId: enemyToken.id, targetId: actorToken.id,
      attackModifier: 4, d20: 18,
      classDamageContext: {
        mode: 'melee', strengthBased: true, finesse: false, weaponDamageSides: 8,
        damageType: 'cold', adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 1, rolls: [8], type: 'cold' },
    })
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants[actorToken.id].currentHp).toBe(26)

    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: attack.state,
      events: attack.events,
      eventBatchId: 'fire-shield-attack',
      combatRevision: 1,
      charactersByCombatantId: { [actorToken.id]: actor },
      confirm: async () => false,
      roll: async (request) => request.sides === 8 && request.count === 2 ? [5, 6] : [],
    })
    expect(settled.state.combatants[enemyToken.id].currentHp).toBe(19)
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({
      activityId: 'fire-shield-warm-retaliation', status: 'resolved',
    }))
  })

  it('commits audited deterministic SRD rule states through the unified Host transaction', () => {
    const actor = wizard('true-strike')
    const actorToken = token('wizard-token-srd-full', 'player', 25, actor.id)
    const enemy = token('enemy-token-srd-full', 'enemy', 125)
    const map: BattleMap = {
      id: 'map-srd-full', name: 'Map', width: 1000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemy],
    }
    const action: SharedPlayerActionState = {
      id: 'srd-full-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: enemy.id,
      dnd5eSpellCast: {
        spellId: 'true-strike', castingClassId: 'wizard', slotLevel: 0,
        targetTokenId: enemy.id,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, enemy].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) throw new Error(resolved.result.reason)
    expect(resolved.result.state.combatants[actorToken.id].turn.actionAvailable).toBe(false)
    expect(dnd5eActiveRuleStateIds(
      resolved.result.state.combatants[enemy.id].classState.activeEffects,
    )).toEqual(['spell:true-strike:target-linked-effect'])
    if (!resolved.result.ok) return
    const castTurnEnded = resolveDnd5eHeadlessAction(resolved.result.state, {
      type: 'end-turn', actorId: actorToken.id,
    })
    expect(castTurnEnded.ok, castTurnEnded.ok ? undefined : castTurnEnded.reason).toBe(true)
    if (!castTurnEnded.ok) return
    expect(castTurnEnded.state.combatants[actorToken.id].concentrating).toBe(true)
    expect(dnd5eActiveRuleStateIds(
      castTurnEnded.state.combatants[enemy.id].classState.activeEffects,
    )).toEqual(['spell:true-strike:target-linked-effect'])
    const targetTurnEnded = resolveDnd5eHeadlessAction(castTurnEnded.state, {
      type: 'end-turn', actorId: enemy.id,
    })
    expect(targetTurnEnded.ok, targetTurnEnded.ok ? undefined : targetTurnEnded.reason).toBe(true)
    if (!targetTurnEnded.ok) return
    const nextCasterTurnEnded = resolveDnd5eHeadlessAction(targetTurnEnded.state, {
      type: 'end-turn', actorId: actorToken.id,
    })
    expect(nextCasterTurnEnded.ok, nextCasterTurnEnded.ok ? undefined : nextCasterTurnEnded.reason).toBe(true)
    if (!nextCasterTurnEnded.ok) return
    expect(nextCasterTurnEnded.state.combatants[actorToken.id].concentrating).toBe(false)
    expect(dnd5eActiveRuleStateIds(
      nextCasterTurnEnded.state.combatants[enemy.id].classState.activeEffects,
    )).toEqual([])
  })

  it('keeps audited SRD assisted spells atomic without requiring a room plugin install', () => {
    const actor = wizard('silent-image')
    actor.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 4 } }
    const actorToken = token('wizard-token-srd-assisted', 'player', 25, actor.id)
    const enemy = token('enemy-token-srd-assisted', 'enemy', 125)
    enemy.x = 275
    enemy.y = 275
    enemy.hp = 0
    enemy.maxHp = 30
    const map: BattleMap = {
      id: 'map-srd-assisted', name: 'Map', width: 1000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemy],
    }
    const action: SharedPlayerActionState = {
      id: 'srd-assisted-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: enemy.id,
      dnd5eSpellCast: {
        spellId: 'silent-image', castingClassId: 'wizard', slotLevel: 1,
        targetTokenId: enemy.id, areaTargetCell: { col: 5, row: 5 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, enemy].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens).toEqual([])
    expect(prepared.prepared.targetToken.id).toBe(actorToken.id)

    const pending = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(pending.result).toMatchObject({ ok: false, reason: 'dm-adjudication-pending' })
    expect(pending.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-1'].current).toBe(1)
    expect(pending.result.state.combatants[actorToken.id].turn.actionAvailable).toBe(true)

    const approved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: { activityInterruptChoiceId: 'dm-apply' },
    })
    expect(approved.result.ok, approved.result.ok ? undefined : approved.result.reason).toBe(true)
    if (!approved.result.ok) throw new Error(approved.result.reason)
    expect(approved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(approved.result.state.combatants[actorToken.id].turn.actionAvailable).toBe(false)
    expect(approved.result.state.combatants[actorToken.id]).toMatchObject({
      concentrating: true,
      classState: {
        concentrationSpellId: 'silent-image',
        concentrationRoundsRemaining: 100,
      },
    })
    expect(approved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'class-state-changed', stateKey: 'concentration', active: false,
    }))
    expect(approved.result.activityHandoffs?.persistentAreas).toHaveLength(1)
    expect(approved.result.activityDefinition).toBeDefined()
    expect(approved.application).toBeDefined()
    const areaPlacement = approved.result.activityAreaInstance ?? prepared.prepared.activityAreaPlacement
    expect(areaPlacement).toBeDefined()
    const mapHandoff = applyDnd5eActivityMapHandoffsV1({
      map: approved.application!.map,
      activity: approved.result.activityDefinition!,
      packageId: prepared.prepared.spell.ownerPluginId,
      actionId: action.id,
      actorId: actorToken.id,
      sourceSaveDc: prepared.prepared.saveDc,
      concentrationId: prepared.prepared.spell.id,
      round: 1,
      combatId: action.combatId,
      handoffs: approved.result.activityHandoffs!,
      areaSelection: {
        anchorCell: prepared.prepared.activityTargetCell!,
        cells: prepared.prepared.activityTargetCells,
        targetIds: [],
        areaPlacement: areaPlacement!,
        areaPlacementDistanceFeet: prepared.prepared.activityAreaPlacementDistanceFeet ?? 0,
      },
      selection: {},
    })
    expect(mapHandoff.ok, mapHandoff.ok ? undefined : mapHandoff.reason).toBe(true)
    if (!mapHandoff.ok) return
    expect(mapHandoff.map.dnd5ePluginAreas).toHaveLength(1)
    expect(mapHandoff.map.dnd5ePluginAreas?.[0]).toMatchObject({
      label: '无声幻影',
      coreSpellId: 'silent-image',
      sourceCharacterId: actor.id,
      sourceTokenId: actorToken.id,
      concentrationId: 'silent-image',
      createdRound: 1,
      expiresAfterRound: 101,
      vertical: {
        mode: 'volume',
        baseElevationFeet: 0,
        heightFeet: 15,
      },
    })
    expect(mapHandoff.map.dnd5ePluginAreas?.[0]?.cells).toHaveLength(9)
  })

  it('places an 8th-level Major Image on the map without starting concentration', () => {
    const actor = wizard('major-image')
    actor.classResources = { 'dnd5e-spell-slot-8': { current: 1, max: 1 } }
    const actorToken = token('major-image-caster', 'player', 25, actor.id)
    const enemy = token('major-image-enemy', 'enemy', 125)
    const map: BattleMap = {
      id: 'major-image-map', name: 'Map', width: 1000, height: 600,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemy],
    }
    const action: SharedPlayerActionState = {
      id: 'major-image-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: enemy.id,
      dnd5eSpellCast: {
        spellId: 'major-image', castingClassId: 'wizard', slotLevel: 8,
        targetTokenId: enemy.id, areaTargetCell: { col: 5, row: 5 },
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, enemy].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor], initiativeOrder, roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens).toEqual([])

    const approved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: { activityInterruptChoiceId: 'dm-apply' },
    })
    expect(approved.result.ok, approved.result.ok ? undefined : approved.result.reason).toBe(true)
    if (!approved.result.ok) throw new Error(approved.result.reason)
    expect(approved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-8'].current).toBe(0)
    expect(approved.result.state.combatants[actorToken.id].concentrating).toBe(false)
    expect(approved.result.state.combatants[actorToken.id].classState.concentrationSpellId).toBeUndefined()
    expect(approved.result.activityHandoffs?.persistentAreas).toEqual([
      expect.objectContaining({
         label: '高等幻影', durationRounds: 5_256_000,
         permanent: true, concentration: false,
         movement: {
           economy: 'action', maximumFeet: 240, maximumDistanceFromSourceFeet: 120,
         },
         visual: { preset: 'major-image', intensity: 'strong' },
      }),
    ])

    const areaPlacement = approved.result.activityAreaInstance ?? prepared.prepared.activityAreaPlacement
    expect(areaPlacement).toBeDefined()
    const mapHandoff = applyDnd5eActivityMapHandoffsV1({
      map: approved.application!.map,
      activity: approved.result.activityDefinition!,
      packageId: prepared.prepared.spell.ownerPluginId,
      actionId: action.id,
      actorId: actorToken.id,
      sourceSaveDc: prepared.prepared.saveDc,
      concentrationId: prepared.prepared.spell.id,
      round: 1,
      combatId: action.combatId,
      handoffs: approved.result.activityHandoffs!,
      areaSelection: {
        anchorCell: prepared.prepared.activityTargetCell!,
        cells: prepared.prepared.activityTargetCells,
        targetIds: [],
        areaPlacement: areaPlacement!,
        areaPlacementDistanceFeet: prepared.prepared.activityAreaPlacementDistanceFeet ?? 0,
      },
      selection: {},
    })
    expect(mapHandoff.ok, mapHandoff.ok ? undefined : mapHandoff.reason).toBe(true)
    if (!mapHandoff.ok) return
    expect(mapHandoff.map.dnd5ePluginAreas?.[0]).toMatchObject({
       label: '高等幻影', coreSpellId: 'major-image',
       permanent: true, concentrationId: undefined,
       movement: {
         economy: 'action', maximumFeet: 240, maximumDistanceFromSourceFeet: 120,
       },
       vertical: { mode: 'volume', heightFeet: 20 },
    })
    expect(mapHandoff.map.dnd5ePluginAreas?.[0]?.cells).toHaveLength(16)
  })

  it('settles a mechanics-free workshop spell through one unified Activity transaction', () => {
    const pluginId = 'com.example.activity-spell'
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'resonant-wave-activity',
      name: 'Resonant Wave',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 60 },
      consumption: [
        { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
        { kind: 'spell-slot', minimumLevel: 2, level: 'selected', amount: 1, consumeOn: 'resolve' },
      ],
      checks: [{
        id: 'save', kind: 'saving-throw', rollId: 'save', ability: 'wis',
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
        rollMode: 'host-derived', scope: 'per-target',
      }],
      outcomes: [{
        id: 'failure', when: { kind: 'check', checkId: 'save', result: 'failure' },
        operations: [{
          id: 'psychic', kind: 'damage', target: 'target',
          amount: { kind: 'dice', rollId: 'psychic', count: 2, sides: 6 },
          damageType: 'psychic', magical: true,
        }, {
          id: 'thunder', kind: 'damage', target: 'target',
          amount: { kind: 'dice', rollId: 'thunder', count: 1, sides: 4 },
          damageType: 'thunder', magical: true,
        }],
      }],
      scaling: [{
        basis: 'slot-level', baseLevel: 2,
        adjustments: [{ operationId: 'psychic', diceCountPerStep: 1 }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell', id: 'resonant-wave' },
    }
    const activityRegistration = registerDnd5eActivityPackage({
      packageId: pluginId,
      packageVersion: '1.0.0',
      activities: [activity],
    })
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: pluginId, name: 'Activity Spell', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity, { outerSpellTransaction: true }))
        spellId = api.registerSpell({
          id: 'resonant-wave', name: '共鸣波', level: 2, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          targeting: { relation: 'enemy', includeSelf: false, maximumTargets: 1 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'],
          description: 'Activity-only spell test.',
          automation: { mode: 'headless-action', actionId: activity.id },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      actor.classResources = { 'dnd5e-spell-slot-3': { current: 1, max: 2 } }
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy = token('enemy-token', 'enemy', 125)
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy] }
      const action: SharedPlayerActionState = {
        id: 'activity-spell-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy.id,
        dnd5eSpellCast: { spellId, castingClassId: 'wizard', slotLevel: 3, targetTokenId: enemy.id },
        round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const initiativeOrder = [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index }))
      const prepared = prepareDnd5ePluginSpellCast({ action, map, characters: [actor], initiativeOrder })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.activity?.id).toBe(activity.id)
      const resolved = resolvePreparedDnd5ePluginSpellCast({
        prepared: prepared.prepared,
        rolls: { activityRolls: {
          psychic: { values: [5, 4, 6], modifier: 0, total: 15 },
          thunder: { values: [3], modifier: 0, total: 3 },
          [`save:${enemy.id}`]: { values: [1], modifier: 0, total: 1 },
        } },
      })
      expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
      if (!resolved.result.ok) throw new Error(resolved.result.reason)
      expect(resolved.result.state.combatants[enemy.id].currentHp).toBe(12)
      expect(resolved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-3']).toMatchObject({ current: 0 })
      expect(resolved.result.state.combatants[actorToken.id].turn.actionAvailable).toBe(false)
      expect(resolved.result.events).toContainEqual(expect.objectContaining({
        type: 'spell-cast', spellId, targetId: enemy.id,
      }))
      expect(resolved.result.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved', targetId: enemy.id, ability: 'wis',
        d20: 1, modifier: 0, total: 1, success: false,
      }))
    } finally {
      dispose()
      activityRegistration.dispose()
    }
  })

  it('keeps an assisted Activity spell atomic until the shared DM boundary is approved', () => {
    const pluginId = 'com.example.assisted-activity-spell'
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'assisted-phantasm-activity',
      name: 'Assisted Phantasm',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 60 },
      consumption: [
        { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
        { kind: 'spell-slot', minimumLevel: 2, level: 'selected', amount: 1, consumeOn: 'resolve' },
      ],
      outcomes: [{
        id: 'safe-subset',
        when: { kind: 'always' },
        operations: [{
          id: 'psychic', kind: 'damage', target: 'target',
          amount: { kind: 'dice', rollId: 'psychic', count: 2, sides: 6 },
          damageType: 'psychic', magical: true,
        }, {
          id: 'illusion-boundary', kind: 'manual-adjudication',
          prompt: 'DM confirms the illusion boundary.',
          reason: 'Scene interpretation is not a white-listed state mutation.',
          requiresDmApproval: true,
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('partial', ['Illusion interpretation requires DM approval.']),
      legacySource: { kind: 'spell', id: 'assisted-phantasm' },
    }
    const activityRegistration = registerDnd5eActivityPackage({
      packageId: pluginId,
      packageVersion: '1.0.0',
      activities: [activity],
    })
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: pluginId, name: 'Assisted Activity Spell', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity, { outerSpellTransaction: true }))
        spellId = api.registerSpell({
          id: 'assisted-phantasm', name: '协助幻象', level: 2, school: 'illusion', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          targeting: { relation: 'enemy', includeSelf: false, maximumTargets: 1 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'],
          description: 'Assisted Activity spell test.',
          automation: { mode: 'headless-action', actionId: activity.id },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      const actorToken = token('wizard-token-assisted', 'player', 25, actor.id)
      const enemy = token('enemy-token-assisted', 'enemy', 125)
      const map: BattleMap = { id: 'map-assisted', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy] }
      const action: SharedPlayerActionState = {
        id: 'assisted-activity-spell-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy.id,
        dnd5eSpellCast: { spellId, castingClassId: 'wizard', slotLevel: 2, targetTokenId: enemy.id },
        round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const initiativeOrder = [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index }))
      const prepared = prepareDnd5ePluginSpellCast({ action, map, characters: [actor], initiativeOrder })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return
      const activityRolls = { psychic: { values: [3, 4], modifier: 0, total: 7 } }

      const pending = resolvePreparedDnd5ePluginSpellCast({
        prepared: prepared.prepared,
        rolls: { activityRolls },
      })
      expect(pending.result).toMatchObject({ ok: false, reason: 'dm-adjudication-pending' })
      expect(pending.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-2']).toMatchObject({ current: 1 })
      expect(pending.result.state.combatants[actorToken.id].turn.actionAvailable).toBe(true)
      expect(pending.result.state.combatants[enemy.id].currentHp).toBe(30)

      const approved = resolvePreparedDnd5ePluginSpellCast({
        prepared: prepared.prepared,
        rolls: { activityRolls, activityInterruptChoiceId: 'dm-apply' },
      })
      expect(
        approved.result.ok,
        approved.result.ok ? undefined : `${approved.result.reason}: ${JSON.stringify(approved.result.events)}`,
      ).toBe(true)
      expect(approved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-2']).toMatchObject({ current: 0 })
      expect(approved.result.state.combatants[actorToken.id].turn.actionAvailable).toBe(false)
      expect(approved.result.state.combatants[enemy.id].currentHp).toBe(23)
    } finally {
      dispose()
      activityRegistration.dispose()
    }
  })

  it('removes a Sculpt Spells ally from every Prismatic Spray save and ray roll', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const actor = wizard('prismatic-spray')
    actor.level = 13
    actor.hitDice = '13d6'
    actor.dnd5eClassLevels = { wizard: 13 }
    actor.dnd5eClassChoices = {
      classes: { wizard: { subclass: 'evocation', selections: { 'spell-prepared': ['prismatic-spray'] } } },
    }
    actor.classResources = { 'dnd5e-spell-slot-7': { current: 1, max: 1 } }
    const ally: Character = { ...wizard(''), id: 'prismatic-ally', name: '友方', classResources: {} }
    const actorToken = token('prismatic-caster', 'player', 25, actor.id)
    const enemyToken = { ...token('prismatic-enemy', 'enemy', 125), hp: 100, maxHp: 100 }
    const allyToken = token('prismatic-ally-token', 'player', 175, ally.id)
    const map: BattleMap = {
      id: 'prismatic-map', name: '虹光喷射', width: 1000, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken, allyToken],
    }
    const action: SharedPlayerActionState = {
      id: 'prismatic-cast', mapId: map.id, combatId: 'prismatic-combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorToken.id,
      characterId: actor.id, targetTokenId: enemyToken.id,
      dnd5eSpellCast: {
        spellId: 'prismatic-spray', castingClassId: 'wizard', slotLevel: 7,
        targetTokenId: enemyToken.id, areaTargetCell: { col: 2, row: 0 },
        sculptedTargetIds: [allyToken.id],
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const initiativeOrder = [actorToken, enemyToken, allyToken].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor, ally], initiativeOrder,
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.sculptedTargetIds).toEqual([allyToken.id])
    expect(prepared.prepared.targets.map((entry) => entry.token.id)).toEqual([enemyToken.id])

    const resolved = resolvePreparedDnd5ePluginSpellCast({
      prepared: prepared.prepared,
      rolls: { activityRolls: {
        [`spell-save-d20:${enemyToken.id}`]: { values: [1], modifier: 0, total: 1 },
        [`prismatic-ray-d8:${enemyToken.id}`]: { values: [2], modifier: 0, total: 2 },
        [`prismatic-primary-damage-d6:${enemyToken.id}`]: {
          values: Array(10).fill(1), modifier: 0, total: 10,
        },
      } },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[enemyToken.id].currentHp).toBe(90)
    expect(resolved.result.state.combatants[allyToken.id].currentHp).toBe(30)
    expect(resolved.result.state.combatants[actorToken.id].currentHp).toBe(30)
    expect(resolved.result.events).toContainEqual({
      type: 'spell-sculpted', actorId: actorToken.id,
      targetId: allyToken.id, spellId: 'prismatic-spray',
    })
  })

  it('keeps Sculpt Spells and Overchannel on a workshop Wizard spell cast through a held arcane focus', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.focus-fireburst', name: 'Focus Fireburst', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'focus-fireburst', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'focus-fireburst', name: '奥术烈焰', level: 3, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' },
          range: { type: 'distance', feet: 150, shape: 'radius', sizeFeet: 10 },
          targeting: { relation: 'any', includeSelf: false, maximumTargets: 64 },
          components: { verbal: true, somatic: true, material: true, materialText: '一件奥术法器' },
          duration: { type: 'instantaneous', concentration: false },
          classes: ['wizard'], description: '验证工坊塑能法术的职业特性与法器来源。',
          mechanics: {
            kind: 'damage', resolution: 'saving-throw', savingThrow: { ability: 'dex', onSuccess: 'half' },
            damage: { dice: { count: 8, sides: 6, bonus: 0 }, type: 'fire' },
          },
          automation: { mode: 'headless-action', actionId: 'focus-fireburst' },
        })
      },
    })
    try {
      const focusInstanceId = 'wizard-held-focus'
      const actor: Character = {
        ...wizard(spellId),
        level: 14,
        maxHp: 60,
        currentHp: 60,
        dnd5eClassLevels: { wizard: 14 },
        dnd5eClassChoices: {
          classes: {
            wizard: {
              subclass: 'evocation',
              selections: { 'spell-prepared': [spellId] },
            },
          },
        },
        classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 3 } },
        dnd5eInventory: {
          schemaVersion: 3,
          entries: [{
            instanceId: focusInstanceId,
            templateId: 'srd-5.1:item:arcane-focus',
            item: {
              id: 'srd-5.1:item:arcane-focus', name: '奥术法器', category: 'adventuring-gear',
              icon: 'magic-wand', description: '', rulesText: '', stackable: false,
              source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
            },
            quantity: 1,
            equippedSlot: 'offHand',
            acquiredAt: 1,
          }],
        },
      }
      const ally: Character = { ...wizard(''), id: 'ally', name: '友方', dnd5eClassChoices: undefined, classResources: {} }
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy = { ...token('enemy-token', 'enemy', 125), hp: 100, maxHp: 100 }
      const allyToken = token('ally-token', 'player', 175, ally.id)
      const map: BattleMap = {
        id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50,
        gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
        tokens: [actorToken, enemy, allyToken],
      }
      const action: SharedPlayerActionState = {
        id: 'focus-fireburst-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy.id,
        dnd5eSpellCast: {
          spellId,
          castingClassId: 'wizard',
          focusItemInstanceId: focusInstanceId,
          slotLevel: 3,
          targetTokenId: enemy.id,
          areaTargetCell: { col: 2, row: 0 },
          sculptedTargetIds: [allyToken.id],
          overchannel: true,
        },
        round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const initiativeOrder = [actorToken, enemy, allyToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      }))
      const prepared = prepareDnd5ePluginSpellCast({ action, map, characters: [actor, ally], initiativeOrder })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared).toMatchObject({
        castingClassId: 'wizard',
        overchannel: true,
        sculptedTargetIds: [allyToken.id],
      })
      expect(prepared.prepared.targets.map((target) => target.token.id)).toEqual([enemy.id])

      const resolved = resolvePreparedDnd5ePluginSpellCast({
        prepared: prepared.prepared,
        rolls: { targetRolls: [{ savingThrowD20: 1, damageRolls: [] }] },
      })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.result.state.combatants[enemy.id].currentHp).toBe(52)
      expect(resolved.result.state.combatants[allyToken.id].currentHp).toBe(30)
      expect(resolved.result.state.combatants[actorToken.id].classState.overchannelUsesSinceLongRest).toBe(1)
      expect(resolved.result.events).toContainEqual({
        type: 'spell-sculpted', actorId: actorToken.id, targetId: allyToken.id, spellId,
      })

      action.dnd5eSpellCast!.focusItemInstanceId = 'forged-or-unheld-focus'
      expect(prepareDnd5ePluginSpellCast({ action, map, characters: [actor, ally], initiativeOrder }))
        .toEqual({ ok: false, reason: 'component-unavailable' })
    } finally {
      dispose()
    }
  })

  it('uses a higher slot to authorize and settle additional creature targets', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.chain-spark', name: 'Chain Spark', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'chain-spark', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'chain-spark', name: '连锁火花', level: 1, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          targeting: { relation: 'enemy', maximumTargets: 1 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false },
          classes: ['wizard'], description: '升环增加目标测试。',
          mechanics: {
            kind: 'damage', resolution: 'automatic',
            damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'lightning' },
            upcast: { fromSlotLevel: 1, effects: [
              { kind: 'additional-targets', countPerSlot: 1 },
              { kind: 'flat-damage', amountPerSlot: 2 },
            ] },
          },
          automation: { mode: 'headless-action', actionId: 'chain-spark' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy1 = token('enemy-1', 'enemy', 125)
      const enemy2 = token('enemy-2', 'enemy', 175)
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy1, enemy2] }
      const action: SharedPlayerActionState = {
        id: 'chain-spark-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy1.id,
        dnd5eSpellCast: { spellId, slotLevel: 2, targetTokenId: enemy1.id, targetTokenIds: [enemy1.id, enemy2.id] },
        round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy1, enemy2].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.targetTokens).toHaveLength(2)
      expect(prepared.prepared.damageDice.bonus).toBe(2)
      const resolved = resolvePreparedDnd5ePluginSpellCast({
        prepared: prepared.prepared,
        rolls: { targetRolls: [{ damageRolls: [4] }, { damageRolls: [5] }] },
      })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.finalDamage).toBe(13)
      expect(resolved.result.state.combatants[enemy1.id].currentHp).toBe(24)
      expect(resolved.result.state.combatants[enemy2.id].currentHp).toBe(23)
    } finally {
      dispose()
    }
  })

  it('rebuilds a freely rotated rectangle on the Host and settles every target with shared upcast damage', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.rotated-wall', name: 'Rotated Wall', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'rotated-wall', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'rotated-wall', name: '旋转冰墙', level: 1, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' },
          range: { type: 'distance', feet: 60, shape: 'rect', widthFeet: 20, heightFeet: 10, rotatable: true },
          targeting: { relation: 'enemy', includeSelf: false, maximumTargets: 64 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'timed', value: 1, unit: 'round', concentration: true },
          classes: ['wizard'], description: '旋转长方形范围测试。',
          mechanics: {
            kind: 'damage', resolution: 'saving-throw', savingThrow: { ability: 'dex', onSuccess: 'half' },
            damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'cold' },
            upcast: { fromSlotLevel: 1, effects: [
              { kind: 'damage-dice', diceCountPerSlot: 1 },
              { kind: 'duration-rounds', roundsPerSlot: 2 },
            ] },
          },
          automation: { mode: 'headless-action', actionId: 'rotated-wall' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy1 = token('enemy-1', 'enemy', 225)
      const enemy2 = { ...token('enemy-2', 'enemy', 225), y: 75 }
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy1, enemy2] }
      const action: SharedPlayerActionState = {
        id: 'rotated-wall-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy1.id,
        dnd5eSpellCast: {
          spellId, slotLevel: 2, targetTokenId: enemy1.id,
          areaTargetCell: { col: 4, row: 0 }, areaTargetAngleDegrees: 45,
        },
        round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy1, enemy2].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.targetTokens.map((entry) => entry.id).sort()).toEqual(['enemy-1', 'enemy-2'])
      expect(prepared.prepared.damageDice).toMatchObject({ count: 2, sides: 6 })
      expect(prepared.prepared.concentrationRounds).toBe(3)

      const resolved = resolvePreparedDnd5ePluginSpellCast({
        prepared: prepared.prepared,
        rolls: {
          damageRolls: [4, 5],
          targetRolls: [{ savingThrowD20: 1 }, { savingThrowD20: 1 }],
        },
      })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.targetResolutions).toHaveLength(2)
      expect(resolved.finalDamage).toBe(18)
      expect(resolved.result.state.combatants[enemy1.id].currentHp).toBe(21)
      expect(resolved.result.state.combatants[enemy2.id].currentHp).toBe(21)
    } finally {
      dispose()
    }
  })

  it('applies the configured cantrip threshold through the Host damage recipe', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.cantrip-scaling', name: 'Cantrip Scaling', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'twin-spark', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'twin-spark', name: '双重火花', level: 0, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false },
          classes: ['wizard'], description: '原创测试戏法。',
          mechanics: {
            kind: 'damage', resolution: 'spell-attack',
            damage: {
              dice: { count: 2, sides: 4, bonus: 0 }, type: 'fire',
              cantripScaling: {
                basis: 'character-level',
                steps: [{ level: 5, diceCount: 1, flatDamage: 2 }, { level: 11, diceCount: 2 }],
              },
            },
          },
          automation: { mode: 'headless-action', actionId: 'twin-spark' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      actor.dnd5eClassChoices = { classes: { wizard: { selections: { 'spell-cantrips': [spellId] } } } }
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy = token('enemy-token', 'enemy', 125)
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy] }
      const action: SharedPlayerActionState = {
        id: 'cantrip-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy.id,
        dnd5eSpellCast: { spellId, slotLevel: 0, targetTokenId: enemy.id }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      expect(prepareDnd5ePluginSpellCast({
        action,
        map,
        characters: [actor],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
        roomRequiredPlugins: null,
      })).toEqual({ ok: false, reason: 'room-rules-unavailable' })
      expect(prepareDnd5ePluginSpellCast({
        action,
        map,
        characters: [{ ...actor, equipment: { armor: DND5E_LEATHER_ARMOR } }],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })).toEqual({ ok: false, reason: 'armor-proficiency-required' })
      expect(prepareDnd5ePluginSpellCast({
        action,
        map,
        characters: [{ ...actor, equipment: { armor: DND5E_LEATHER_ARMOR }, conditions: ['沉默'] }],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
        effectiveRules: createDnd5eEffectiveRulesContextV1({
          houseRules: { spellcastingPrerequisitesEnabled: false },
        }),
      })).toMatchObject({ ok: true })
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.damageDice).toMatchObject({ count: 3, sides: 4, bonus: 2 })
    } finally {
      dispose()
    }
  })

  it('validates the slot and components, applies upcast/save/concentration, and records the RollLedger', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.spell-tx', name: 'Spell Tx', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'frost-bind', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'frost-bind', name: '霜缚', level: 1, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
          classes: ['wizard'], description: '原创测试法术。',
          mechanics: {
            kind: 'damage', resolution: 'saving-throw', savingThrow: { ability: 'dex', onSuccess: 'half' },
            damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'cold' },
            conditions: [{ condition: 'restrained', trigger: 'on-failed-save', duration: { kind: 'concentration' } }],
            upcast: { fromSlotLevel: 1, effects: [{ kind: 'damage-dice', diceCountPerSlot: 1 }] },
          },
          automation: { mode: 'headless-action', actionId: 'frost-bind' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy = token('enemy-token', 'enemy', 125)
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy] }
      const action: SharedPlayerActionState = {
        id: 'plugin-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy.id,
        dnd5eSpellCast: { spellId, slotLevel: 2, targetTokenId: enemy.id }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      actor.equipment = { mainWeapon: DND5E_DAGGER, offHand: DND5E_DAGGER }
      expect(prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })).toEqual({ ok: false, reason: 'somatic-component-unavailable' })
      actor.equipment = undefined
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
        now: 1,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.damageDice).toMatchObject({ count: 2, sides: 6 })
      expect(prepared.prepared.componentCheck).toMatchObject({ verbal: 'available', somatic: 'available', material: 'not-required' })
      expect(actor.classResources?.['dnd5e-spell-slot-2']?.current).toBe(1)

      const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: { savingThrowD20: 20, damageRolls: [5, 5] }, now: 2 })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.saveSucceeded).toBe(true)
      expect(resolved.finalDamage).toBe(5)
      expect(resolved.transaction.status).toBe('committed')
      expect(resolved.transaction.rollLedger.entries.map((entry) => entry.kind)).toEqual(['saving-throw', 'damage'])
      expect(resolved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-2'].current).toBe(0)
      expect(resolved.result.state.combatants[enemy.id].currentHp).toBe(25)
      // A successful save leaves no ongoing restrained effect, so this custom
      // spell has nothing for the caster to maintain concentration on.
      expect(resolved.result.state.combatants[actorToken.id].classState.concentrationSpellId).toBeUndefined()
      expect(resolved.result.state.combatants[actorToken.id].concentrating).toBe(false)
      expect(resolved.result.state.combatants[enemy.id].conditions).not.toContain('restrained')

      const failedSave = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: { savingThrowD20: 1, damageRolls: [5, 5] }, now: 3 })
      expect(failedSave.result.ok).toBe(true)
      expect(failedSave.result.state.combatants[enemy.id].conditions).toContain('restrained')
      expect(failedSave.result.state.combatants[enemy.id].classState.activeEffects?.[0]?.duration).toMatchObject({
        type: 'concentration', sourceActorId: actorToken.id, concentrationId: spellId,
      })
    } finally {
      dispose()
    }
  })

  it('routes plugin spell damage through static and source-aware defenses exactly once', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.spell-defenses', name: 'Spell Defenses', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'ember', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'ember', name: '余烬', level: 2, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false },
          classes: ['wizard'], description: '用于验证插件法术伤害防御入口。',
          mechanics: {
            kind: 'damage', resolution: 'automatic',
            damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'fire' },
          },
          automation: { mode: 'headless-action', actionId: 'ember' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      actor.alignment = 'LG'
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy = token('enemy-token', 'enemy', 125)
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy] }
      const action: SharedPlayerActionState = {
        id: 'plugin-defense-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy.id,
        dnd5eSpellCast: { spellId, slotLevel: 2, targetTokenId: enemy.id }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return

      const target = prepared.prepared.state.combatants[enemy.id]
      const resolveWith = (defenses: {
        immunities?: readonly Dnd5eDamageType[]
        resistances?: readonly Dnd5eDamageType[]
        vulnerabilities?: readonly Dnd5eDamageType[]
        rules?: readonly Dnd5eConditionalDamageDefense[]
      }) => {
        target.damageImmunities = [...(defenses.immunities ?? [])]
        target.damageResistances = [...(defenses.resistances ?? [])]
        target.damageVulnerabilities = [...(defenses.vulnerabilities ?? [])]
        target.damageDefenseRules = (defenses.rules ?? []).map((rule) => ({ ...rule }))
        return resolvePreparedDnd5ePluginSpellCast({
          prepared: prepared.prepared,
          rolls: { damageRolls: [5] },
        })
      }

      const unmodified = resolveWith({})
      expect(unmodified.rawDamage).toBe(5)
      expect(unmodified.finalDamage).toBe(5)
      expect(unmodified.result.state.combatants[enemy.id].currentHp).toBe(25)

      const immune = resolveWith({ immunities: ['fire'] })
      expect(immune.finalDamage).toBe(0)
      expect(immune.result.state.combatants[enemy.id].currentHp).toBe(30)

      const resistant = resolveWith({ resistances: ['fire'] })
      expect(resistant.finalDamage).toBe(2)
      expect(resistant.result.state.combatants[enemy.id].currentHp).toBe(28)

      const vulnerable = resolveWith({ vulnerabilities: ['fire'] })
      expect(vulnerable.finalDamage).toBe(10)
      expect(vulnerable.result.state.combatants[enemy.id].currentHp).toBe(20)

      const resistantAndVulnerable = resolveWith({
        resistances: ['fire'],
        vulnerabilities: ['fire'],
      })
      expect(resistantAndVulnerable.finalDamage).toBe(4)
      expect(resistantAndVulnerable.result.state.combatants[enemy.id].currentHp).toBe(26)

      const archmage = DND5E_SRD_MONSTERS.find((monster) => monster.id === 'srd-5.1:archmage')
      const archmageSpellRules = archmage?.damageDefenseRules?.filter((rule) =>
        rule.outcome === 'resistant' && rule.delivery === 'spell' && rule.magical === true
      )
      expect(archmageSpellRules).toHaveLength(1)
      const archmageSpellResistance = resolveWith({ rules: archmageSpellRules })
      expect(archmageSpellResistance.finalDamage).toBe(2)
      expect(archmageSpellResistance.result.state.combatants[enemy.id].currentHp).toBe(28)

      const weaponOnlyImmunity = resolveWith({
        rules: [{
          outcome: 'immune',
          damageTypes: ['fire'],
          delivery: 'weapon-attack',
          magical: false,
          reason: 'ordinary-fire-weapon-only',
        }],
      })
      expect(weaponOnlyImmunity.finalDamage).toBe(5)
      expect(weaponOnlyImmunity.result.state.combatants[enemy.id].currentHp).toBe(25)

      const vulnerableToGoodSpellcaster = resolveWith({
        rules: [{
          outcome: 'vulnerable',
          damageTypes: ['fire'],
          delivery: 'spell',
          magical: true,
          sourceMoralAlignment: 'good',
          reason: 'good-spellcaster',
        }],
      })
      expect(vulnerableToGoodSpellcaster.finalDamage).toBe(10)
      expect(vulnerableToGoodSpellcaster.result.state.combatants[enemy.id].currentHp).toBe(20)

      target.limitedMagicImmunity = {
        kind: 'limited-magic-immunity',
        maximumSpellLevel: 6,
        advantageAboveMaximum: true,
        allowsWilling: true,
      }
      const limitedMagicImmunity = resolveWith({})
      expect(limitedMagicImmunity.finalDamage).toBe(0)
      expect(limitedMagicImmunity.result.state.combatants[enemy.id].currentHp).toBe(30)
      expect(limitedMagicImmunity.result.events).toContainEqual(expect.objectContaining({
        type: 'spell-negated-by-limited-magic-immunity',
        targetId: enemy.id,
        spellId,
        spellLevel: 2,
      }))
      expect(limitedMagicImmunity.result.events).toContainEqual(expect.objectContaining({
        type: 'class-resource-spent',
        resourceKey: 'dnd5e-spell-slot-2',
      }))
    } finally {
      dispose()
    }
  })
})
