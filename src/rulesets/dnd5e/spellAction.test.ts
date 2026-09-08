import { afterEach, describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  applyDnd5eStandardConditionEffect,
  createDnd5eCombatant,
  dnd5eEffectiveFlySpeed,
  dnd5eTargetArmorClassForAttack,
  endDnd5eConcentration,
  resolveDnd5eHeadlessAction,
} from './headlessCombatEngine'
import { dnd5eForcedMovementFall, dnd5eForcedPullDestination, dnd5eForcedPushDestination, dnd5eRepellingBlastPushDestination, prepareDnd5eSpellCast, previewDnd5eSpellAttack, previewDnd5eSpellSavingThrow, resolvePreparedDnd5eSpellCast } from './spellAction'
import {
  dnd5eBardMagicalSecretSpellIds,
  dnd5eCombatSpellSelectionLimits,
  dnd5eMetamagicCost,
  dnd5eSelectedSpellIds,
  getDnd5eSrdCombatSpell,
} from './spells'
import { dnd5eClassDefinition } from './classes'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { prepareDnd5eCoreSpellAreaMove, resolvePreparedDnd5eCoreSpellAreaMove } from './coreSpellAreaAction'
import { createDnd5eCoreSpellArea, getDnd5eCoreSpellAreaDeclaration, moveDnd5eCoreSpellArea } from './coreSpellAreas'
import { collectDnd5ePersistentAreaTriggers, dnd5ePersistentAreaDifficultTerrainMultiplierAt } from './pluginAreas'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { DND5E_CLUB, DND5E_LEATHER_ARMOR, DND5E_LONGSWORD } from './equipment'
import { applyDnd5eLongRestBenefits } from './campaignTimeRules'
import { createDnd5eEffectiveRulesContextV1 } from './effectiveRulesContext'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import { resolveDnd5eSpellModifierIntents } from './spellModifierIntents'

function character(id: string, charClass: string, patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id, name: id, player: '', avatar: '', accent: '', race: '人类', charClass,
    level: 5, background: '', experience: 0, reputation: 0,
    abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 16, cha: 16 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '5d8', ac: 14, speed: 30, initiativeBonus: 0,
    saveDC: 14, passivePerception: 13, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

function token(id: string, type: Token['type'], x: number, characterId?: string): Token {
  return { id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 }
}

function fixture(actor: Character, spellId: string, slotLevel: number, target: Token, allies: Character[] = []) {
  const actorToken = token(`${actor.id}-token`, 'player', 25, actor.id)
  const map: BattleMap = {
    id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, feetPerCell: 5, tokens: [actorToken, target],
  }
  const action: SharedPlayerActionState = {
    id: 'cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
    actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: target.id,
    dnd5eSpellCast: { spellId, slotLevel, targetTokenId: target.id }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
  const spell = getDnd5eSrdCombatSpell(spellId)
  if (spell?.area) {
    action.dnd5eSpellCast!.areaTargetCell = {
      col: Math.floor((target.x - map.gridOffsetX) / map.gridSize),
      row: Math.floor((target.y - map.gridOffsetY) / map.gridSize),
    }
  }
  return {
    action, map, characters: [actor, ...allies],
    initiativeOrder: [actorToken, target].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
  }
}

describe('SRD 5.1 Headless spell authority bridge', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('rejects a directly selected defeated creature before spell resources are spent', () => {
    const cleric = character('guiding-bolt-cleric', '牧师', {
      dnd5eClassLevels: { cleric: 5 },
      dnd5eClassChoices: {
        classes: { cleric: { selections: { 'spell-prepared': ['guiding-bolt'] } } },
      },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const defeatedTarget = { ...token('defeated-target', 'enemy', 125), hp: 0 }
    const input = fixture(cleric, 'guiding-bolt', 1, defeatedTarget)
    input.action.dnd5eSpellCast!.castingClassId = 'cleric'

    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'invalid-target' })
    expect(cleric.classResources?.['dnd5e-spell-slot-1']).toEqual({ current: 2, max: 4 })
  })

  it('projects a directly selected map NPC for a targeted core spell transaction', () => {
    const cleric = character('npc-ward-cleric', '牧师', {
      level: 7,
      dnd5eClassLevels: { cleric: 7 },
      dnd5eClassChoices: {
        classes: { cleric: { selections: { 'spell-prepared': ['death-ward'] } } },
      },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const npc = {
      ...token('npc-ward-target', 'player', 75),
      type: 'npc' as const,
      label: 'NPC',
      hp: 12,
      maxHp: 12,
    }
    const input = fixture(cleric, 'death-ward', 4, npc)
    input.action.combatId = undefined
    input.initiativeOrder = input.initiativeOrder.filter((entry) => entry.tokenId !== npc.id)

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[npc.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:death-ward',
        duration: expect.objectContaining({ type: 'rounds', remainingRounds: 4_800 }),
      }),
    )
    expect(cast.application?.tokenPatches?.[npc.id]?.dnd5eCombatState?.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:death-ward' }),
    )
  })

  it('requires both Warding Bond participants to wear their own 50 gp platinum ring', () => {
    const baseCleric = character('warding-cleric', '牧师', {
      dnd5eClassLevels: { cleric: 5 },
      dnd5eClassChoices: {
        classes: { cleric: { selections: { 'spell-prepared': ['warding-bond'] } } },
      },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } },
    })
    const baseAlly = character('warding-ally', '德鲁伊')
    const equipRing = (owner: Character): Character => {
      const granted = applyDnd5eInventoryMutation([owner], {
        type: 'grant', characterId: owner.id,
        templateId: 'srd-5.1:item:platinum-ring-50gp', quantity: 1,
      })
      expect(granted.ok).toBe(true)
      const ring = normalizeDnd5eInventory(granted.characters[0]).entries.find((entry) =>
        entry.templateId === 'srd-5.1:item:platinum-ring-50gp')!
      const equipped = applyDnd5eInventoryMutation(granted.characters, {
        type: 'equip', characterId: owner.id, instanceId: ring.instanceId, slot: 'ring',
      })
      expect(equipped.ok).toBe(true)
      return equipped.characters[0]
    }
    const cleric = equipRing(baseCleric)
    const allyToken = token('warding-ally-token', 'player', 75, baseAlly.id)
    const missingTargetRing = fixture(cleric, 'warding-bond', 2, allyToken, [baseAlly])
    missingTargetRing.action.dnd5eSpellCast!.castingClassId = 'cleric'
    expect(prepareDnd5eSpellCast(missingTargetRing)).toEqual({
      ok: false,
      reason: 'costly-material-unavailable',
    })

    const ally = equipRing(baseAlly)
    const valid = fixture(cleric, 'warding-bond', 2, allyToken, [ally])
    valid.action.dnd5eSpellCast!.castingClassId = 'cleric'
    const prepared = prepareDnd5eSpellCast(valid)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.spellMaterialPlan?.allocations).toEqual([
      expect.objectContaining({ tag: 'platinum-ring', quantity: 1, mustBeEquipped: true }),
    ])
  })

  it('applies and consumes a persisted True Strike link on a core Fire Bolt attack', () => {
    const wizard = character('true-strike-wizard', '法师', {
      level: 1,
      conditions: ['prone'],
      concentrating: true,
      dnd5eClassLevels: { wizard: 1 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [createDnd5eConditionEffect({
          condition: 'prone', targetId: 'true-strike-wizard', source: { kind: 'dm' },
          duration: { type: 'permanent' },
        })],
        concentrationSpellId: 'true-strike',
        concentrationTargetIds: ['true-strike-target'],
        concentrationRoundsRemaining: 1,
      },
    })
    const target = token('true-strike-target', 'enemy', 125)
    const input = fixture(wizard, 'fire-bolt', 0, target)
    const actorTokenId = input.action.actorTokenId
    target.dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'rule-state:spell:true-strike:target-linked-effect',
        label: 'True Strike target link',
        source: { kind: 'spell', actorId: actorTokenId, rulesId: 'true-strike', magical: true },
        targetId: target.id,
        legacyCondition: 'rule-state:spell:true-strike:target-linked-effect',
        duration: {
          type: 'concentration', sourceActorId: actorTokenId,
          concentrationId: 'true-strike', remainingRounds: 1,
        },
      })],
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('normal')

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 2,
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: actorTokenId, targetId: target.id, d20: 2,
    }))
    expect(resolved.result.state.combatants[actorTokenId].concentrating).toBe(false)
    expect(resolved.result.state.combatants[actorTokenId].classState.concentrationSpellId).toBeUndefined()
    expect(resolved.result.state.combatants[target.id].classState.activeEffects).toBeUndefined()
  })

  it('applies a persisted Foresight advantage to a core Fire Bolt attack', () => {
    const wizard = character('foresight-wizard', '法师', {
      level: 20,
      dnd5eClassLevels: { wizard: 20 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } },
      },
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'activity:foresight:foresight:modifiers:0',
          label: '预警术',
          source: { kind: 'spell', actorId: 'foresight-wizard', rulesId: 'foresight' },
          targetId: 'foresight-wizard',
          duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
          modifiers: { attackRollAdvantage: true },
        })],
      },
    })
    const target = token('foresight-target', 'enemy', 125)

    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'fire-bolt', 0, target))

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('advantage')
    expect(prepared.prepared.attackModeResolution?.advantageReasons)
      .toContain('预警术令攻击具有优势')
  })

  it('settles Shatter creature damage and upcasting without mutating nearby objects', () => {
    const wizard = character('shatter-wizard', '法师', {
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['shatter'] } } } },
      classResources: {
        'dnd5e-spell-slot-2': { current: 1, max: 3 },
        'dnd5e-spell-slot-3': { current: 1, max: 2 },
      },
    })
    const flyingSword = token('flying-sword', 'enemy', 125)
    flyingSword.label = '飞剑'
    flyingSword.poolId = 'srd-5.1:flying-sword'
    flyingSword.hp = 100
    flyingSword.maxHp = 100
    const ordinaryCreature = token('ordinary-creature', 'enemy', 175)
    ordinaryCreature.label = '普通生物'
    const object = {
      id: 'glass-object', label: '无人持有玻璃器皿', x: 125, y: 75, color: '', emoji: '🏺',
      size: 1, type: 'obstacle' as const, hp: 30, maxHp: 30,
      dnd5eObjectState: { schemaVersion: 1 as const, magical: false, wornOrCarried: false },
    }
    const magicalObject = {
      ...object, id: 'magic-object', label: '魔法器皿', x: 175,
      dnd5eObjectState: { schemaVersion: 1 as const, magical: true, wornOrCarried: false },
    }
    const carriedObject = {
      ...object, id: 'carried-object', label: '被携带器皿', x: 75,
      dnd5eObjectState: { schemaVersion: 1 as const, magical: false, wornOrCarried: true },
    }
    const input = fixture(wizard, 'shatter', 2, flyingSword)
    input.map.tokens.push(ordinaryCreature, object, magicalObject, carriedObject)
    input.initiativeOrder.push({
      tokenId: ordinaryCreature.id, label: ordinaryCreature.label, emoji: '', color: '', roll: 10,
    })
    input.action.targetTokenIds = [flyingSword.id, ordinaryCreature.id]
    input.action.dnd5eSpellCast = {
      spellId: 'shatter', castingClassId: 'wizard', slotLevel: 2,
      targetTokenId: flyingSword.id, targetTokenIds: [flyingSword.id, ordinaryCreature.id],
      areaTargetCell: { col: 2, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.diceCount).toBe(3)
    expect(prepared.prepared.targetSavingThrows).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetToken: expect.objectContaining({ id: flyingSword.id }), mode: 'disadvantage' }),
      expect.objectContaining({ targetToken: expect.objectContaining({ id: ordinaryCreature.id }), mode: 'normal' }),
    ]))
    expect(prepared.prepared).not.toHaveProperty('shatterObjectTargetIds')

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [
        { targetId: flyingSword.id, d20: 20, d20Second: 1 },
        { targetId: ordinaryCreature.id, d20: 20 },
      ],
      effectRolls: [8, 8, 8],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === flyingSword.id)?.hp).toBe(76)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === ordinaryCreature.id)?.hp).toBe(18)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === object.id)?.hp).toBe(30)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === magicalObject.id)?.hp).toBe(30)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === carriedObject.id)?.hp).toBe(30)
    expect(resolved).not.toHaveProperty('shatterObjectDamage')
    expect(resolved.result.state.combatants[input.action.actorTokenId].classResources['dnd5e-spell-slot-2'])
      .toEqual({ current: 0, max: 3 })

    const upcastWizard = character('upcast-shatter-wizard', '法师', {
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['shatter'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 2 } },
    })
    const upcastTarget = token('upcast-target', 'enemy', 125)
    const upcastInput = fixture(upcastWizard, 'shatter', 3, upcastTarget)
    const upcastObject = { ...object, id: 'upcast-object', label: '升环测试物件' }
    upcastInput.map.tokens.push(upcastObject)
    upcastInput.action.dnd5eSpellCast = {
      spellId: 'shatter', castingClassId: 'wizard', slotLevel: 3,
      targetTokenId: upcastTarget.id, targetTokenIds: [upcastTarget.id],
      areaTargetCell: { col: 2, row: 0 },
    }
    const upcastPrepared = prepareDnd5eSpellCast(upcastInput)
    expect(upcastPrepared.ok, upcastPrepared.ok ? undefined : upcastPrepared.reason).toBe(true)
    if (!upcastPrepared.ok) return
    expect(upcastPrepared.prepared.diceCount).toBe(4)
    const upcastResolved = resolvePreparedDnd5eSpellCast({
      prepared: upcastPrepared.prepared,
      savingThrowD20: 1,
      effectRolls: [1, 2, 3, 4],
    })
    expect(upcastResolved.result.ok).toBe(true)
    expect(upcastResolved.application?.map.tokens.find((entry) => entry.id === upcastObject.id)?.hp).toBe(30)
    expect(upcastResolved.result.state.combatants[upcastInput.action.actorTokenId].classResources['dnd5e-spell-slot-3'])
      .toEqual({ current: 0, max: 2 })
  })

  it('creates one Mage Hand projection and replaces the same caster\'s previous hand on recast', () => {
    const wizard = character('mage-hand-wizard', '法师', {
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['mage-hand'] } } } },
    })
    const enemy = token('mage-hand-enemy', 'enemy', 125)
    const input = fixture(wizard, 'mage-hand', 0, enemy)
    const declaration = getDnd5eCoreSpellAreaDeclaration('mage-hand')!
    const previous = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'previous-mage-hand',
      sourceCharacterId: wizard.id,
      sourceTokenId: input.action.actorTokenId,
      slotLevel: 0,
      sourceSaveDc: 14,
      round: 1,
      cells: [{ col: 1, row: 0 }],
      anchorCell: { col: 1, row: 0 },
    })
    input.map.dnd5ePluginAreas = [previous]
    input.action.targetTokenId = input.action.actorTokenId
    input.action.targetTokenIds = []
    input.action.dnd5eSpellCast = {
      spellId: 'mage-hand', castingClassId: 'wizard', slotLevel: 0,
      targetTokenId: input.action.actorTokenId, targetTokenIds: [],
      areaTargetCell: { col: 3, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.dnd5ePluginAreas).toHaveLength(1)
    expect(resolved.application?.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'mage-hand',
      anchorCell: { col: 3, row: 0 },
      movement: {
        economy: 'action', maximumFeet: 30,
        maximumDistanceFromSourceFeet: 30,
        endWhenExceedingSourceDistance: true,
      },
    })
    expect(resolved.application?.map.dnd5ePluginAreas?.[0]?.id).not.toBe(previous.id)
  })

  it('does not create a core spell area before a Slow-delayed spell completes', () => {
    const wizard = character('slow-area-wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fog-cloud'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const enemy = token('slow-area-enemy', 'enemy', 225)
    const input = fixture(wizard, 'fog-cloud', 1, enemy)
    input.action.targetTokenId = input.action.actorTokenId
    input.action.targetTokenIds = []
    input.action.dnd5eSpellCast = {
      spellId: 'fog-cloud', castingClassId: 'wizard', slotLevel: 1,
      targetTokenId: input.action.actorTokenId, targetTokenIds: [],
      areaTargetCell: { col: 3, row: 0 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const caster = prepared.prepared.state.combatants[input.action.actorTokenId]
    caster.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:slow', label: '缓慢术', targetId: caster.id,
      source: { kind: 'spell', actorId: 'other-caster', rulesId: 'slow', spellSaveDc: 19 },
      duration: { type: 'concentration', sourceActorId: 'other-caster', concentrationId: 'slow', remainingRounds: 10 },
      modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 } },
    })]

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      slowSpellDelayD20: 15,
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'slow-spell-delay-resolved', spellId: 'fog-cloud', delayed: true,
    }))
    expect(resolved.application?.map.dnd5ePluginAreas ?? []).toHaveLength(0)
    expect(resolved.application?.characters.find((entry) => entry.id === wizard.id)
      ?.dnd5eCombatState?.slowDelayedSpell).toMatchObject({
        schemaVersion: 1,
        action: { type: 'cast-spell', spellId: 'fog-cloud', slotLevel: 1 },
      })
  })

  it('shows and reports the effective saving-throw modifier from active effects', () => {
    const cleric = character('slow-save-cleric', '牧师', {
      dnd5eClassLevels: { cleric: 5 },
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-cantrips': ['sacred-flame'] } } } },
    })
    const cube = token('slow-save-cube', 'enemy', 125)
    cube.poolId = 'srd-5.1:gelatinous-cube'
    cube.dnd5eCombatState = {
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'srd-5.1:spell:slow', label: '缓慢术', targetId: cube.id,
        source: { kind: 'spell', actorId: 'other-caster', rulesId: 'slow', spellSaveDc: 19 },
        duration: { type: 'permanent' },
        modifiers: { savingThrowBonusByAbility: { dex: -2 } },
      })],
    }
    const prepared = prepareDnd5eSpellCast(fixture(cleric, 'sacred-flame', 0, cube))
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    expect(prepared.prepared.savingThrow).toMatchObject({ modifier: -6 })
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 12,
      effectRolls: [1, 1],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: cube.id, ability: 'dex',
      d20: 12, modifier: -6, total: 6,
    }))
  })

  it('uses an owned declarative projection as a Host-validated spell origin', () => {
    const pluginId = 'local.test.spell-origin'
    const subclassId = `${pluginId}:mirror-mage`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Spell origin fixture', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerDeclarativeSubclass({
          schemaVersion: 1,
          id: 'mirror-mage', classId: 'wizard', name: 'Mirror Mage', summary: 'Fixture.',
          abilities: [{
            schemaVersion: 1,
            id: 'mirror-origin', name: 'Mirror Origin', description: 'Fixture.', level: 2,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' },
            mechanic: {
              kind: 'persistent-projection', projectionId: 'mirror-origin', label: 'Mirror',
              placementRangeFeet: 30, durationRounds: 10, concentration: true, spellOrigin: true,
            },
            effects: [], automation: 'full',
          }],
        })
      },
    })
    try {
      const wizard = character('projection-wizard', '法师', {
        dnd5eClassLevels: { wizard: 5 },
        dnd5eClassChoices: {
          classes: {
            wizard: {
              subclass: subclassId,
              selections: { 'spell-cantrips': ['fire-bolt'] },
            },
          },
        },
        classResources: { 'dnd5e-spell-slot-1': { current: 4, max: 4 } },
      })
      const enemy = token('projection-enemy', 'enemy', 1_525)
      const input = fixture(wizard, 'fire-bolt', 0, enemy)
      input.map.width = 2_000
      input.map.dnd5ePluginAreas = [{
        id: 'mirror-area', pluginId, featureId: `${subclassId}.mirror-origin`,
        utilityProjectionId: 'mirror-origin', label: 'Mirror', color: '#a78bfa',
        sourceCharacterId: wizard.id, sourceTokenId: input.action.actorTokenId,
        cells: [{ col: 24, row: 0 }], anchorCell: { col: 24, row: 0 },
        createdRound: 1, expiresAfterRound: 10,
      }]
      input.action.dnd5eSpellCast = {
        spellId: 'fire-bolt', castingClassId: 'wizard', slotLevel: 0,
        targetTokenId: enemy.id,
      }
      expect(prepareDnd5eSpellCast(input)).toMatchObject({ ok: false, reason: 'target-out-of-range' })
      input.action.dnd5eSpellCast.spellOriginAreaId = 'mirror-area'
      expect(prepareDnd5eSpellCast(input)).toMatchObject({ ok: true })
      input.action.dnd5eSpellCast.spellOriginAreaId = 'forged-area'
      expect(prepareDnd5eSpellCast(input)).toMatchObject({ ok: false, reason: 'invalid-action' })
    } finally {
      dispose()
    }
  })

  it('rejects actively submitted reaction spells so only their trigger window can cast them', () => {
    const wizard = character('reaction-wizard', '法师', {
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['shield'] } } },
      },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const input = fixture(wizard, 'shield', 1, token('enemy', 'enemy', 125))
    input.action.dnd5eSpellCast = {
      spellId: 'shield',
      castingClassId: 'wizard',
      slotLevel: 1,
      targetTokenId: input.action.actorTokenId,
    }

    expect(prepareDnd5eSpellCast(input)).toEqual({
      ok: false,
      reason: 'spell-reaction-only',
    })
  })

  it('prepares and spends a racial innate spell without a casting class or class slot', () => {
    const pluginId = 'local.test.innate-spell-race'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId,
        name: 'Innate spell race fixture',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerRace({
          id: 'shadow-elf',
          name: 'Shadow Elf',
          speedFeet: 30,
          coreRaceMechanicsId: 'elf',
          innateSpells: [{
            spellId: 'faerie-fire',
            minimumLevel: 3,
            ability: 'cha',
            castAtLevel: 1,
            resetOn: 'long-rest',
          }],
        })
      },
    })
    try {
      const localRace = character('local-race', '战士', {
      race: 'Shadow Elf',
      dnd5eRaceId: `${pluginId}:shadow-elf`,
      level: 3,
      classResources: {
        'dnd5e-racial-spell-faerie-fire': { current: 1, max: 1 },
      },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(localRace, 'faerie-fire', 1, enemy)
    input.action.targetTokenIds = [enemy.id]
    input.action.dnd5eSpellCast = {
      spellId: 'faerie-fire',
      slotLevel: 1,
      racialInnate: true,
      targetTokenId: enemy.id,
      targetTokenIds: [enemy.id],
      areaTargetCell: { col: 2, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      castingClassId: undefined,
      racialInnate: true,
      spellcastingAbility: 'cha',
    })
    expect(prepared.prepared.savingThrow?.mode).toBe('normal')
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 2,
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(
      resolved.result.state.combatants['local-race-token']
        .classResources['dnd5e-racial-spell-faerie-fire'].current,
    ).toBe(0)
    expect(
      resolved.result.state.combatants['local-race-token'].classResources['dnd5e-spell-slot-1'],
    ).toBeUndefined()
    } finally {
      dispose()
    }
  })

  it('casts a build-granted cantrip without a class while still enforcing ordinary components', () => {
    const initiate = character('initiate', '战士', {
      classResources: {},
      dnd5eContentChoices: {
        'local.test:magic-initiate': {
          schemaVersion: 1,
          contentId: 'local.test:magic-initiate',
          selections: {},
          resolvedGrants: [{ kind: 'spell', spellId: 'fire-bolt', mode: 'cantrip', ability: 'int' }],
        },
      },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(initiate, 'fire-bolt', 0, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt', slotLevel: 0, racialInnate: true,
      targetTokenId: enemy.id, targetTokenIds: [enemy.id],
    }
    input.characters[0] = { ...initiate, conditions: ['silenced'] }
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'verbal-component-unavailable' })

    input.characters[0] = initiate
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      castingClassId: undefined,
      racialInnate: true,
      spellcastingAbility: 'int',
    })
  })

  it('casts Scorching Ray from the authoritative Circlet of Blasting without preparing or spending a class spell slot', () => {
    const fighter = character('fighter', '战士', {
      classResources: {},
      dnd5eClassChoices: { classes: { fighter: { selections: {} } } },
    })
    const granted = applyDnd5eInventoryMutation([fighter], {
      type: 'grant',
      characterId: fighter.id,
      templateId: 'srd-5.1:magic-item:circlet-of-blasting',
      quantity: 1,
    })
    expect(granted.ok).toBe(true)
    let owner = granted.characters[0]
    const circlet = normalizeDnd5eInventory(owner).entries.find(
      (entry) => entry.templateId === 'srd-5.1:magic-item:circlet-of-blasting',
    )
    expect(circlet).toBeDefined()
    if (!circlet) return
    const equipped = applyDnd5eInventoryMutation([owner], {
      type: 'equip',
      characterId: owner.id,
      instanceId: circlet.instanceId,
      slot: 'helmet',
    })
    expect(equipped.ok).toBe(true)
    owner = equipped.characters[0]

    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(owner, 'scorching-ray', 2, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'scorching-ray',
      slotLevel: 2,
      itemInstanceId: circlet.instanceId,
      targetTokenId: enemy.id,
      targetTokenIds: [enemy.id],
      projectileTargetIds: [enemy.id, enemy.id, enemy.id],
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      castingClassId: undefined,
      racialInnate: false,
      spellAttackModifier: 5,
      itemSpellSource: {
        instanceId: circlet.instanceId,
        itemName: circlet.item.name,
        economy: 'action',
      },
    })
    expect(previewDnd5eSpellAttack(prepared.prepared, 10).roll).toMatchObject({
      d20: 10,
      modifier: 5,
      total: 15,
    })

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetAttacks: Array.from({ length: 3 }, () => ({
        targetId: enemy.id,
        d20: 15,
        effectRolls: [3, 4],
      })),
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application).toBeDefined()
    const settledOwner = resolved.application?.characters.find((candidate) => candidate.id === owner.id)
    const settledCirclet = settledOwner
      ? normalizeDnd5eInventory(settledOwner).entries.find((entry) => entry.instanceId === circlet.instanceId)
      : undefined
    expect(settledCirclet?.resources?.['daily-use']?.current).toBe(0)
    expect(settledOwner?.classResources?.['dnd5e-spell-slot-2']).toBeUndefined()
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast',
      itemInstanceId: circlet.instanceId,
      itemName: circlet.item.name,
    }))

    if (!settledOwner) return
    const second = fixture(settledOwner, 'scorching-ray', 2, enemy)
    second.action.dnd5eSpellCast = {
      ...input.action.dnd5eSpellCast,
      itemInstanceId: circlet.instanceId,
    }
    expect(prepareDnd5eSpellCast(second)).toEqual({ ok: false, reason: 'item-resource-unavailable' })
  })

  it('rejects a forged item spell source that is absent from the authoritative inventory', () => {
    const fighter = character('fighter', '战士')
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(fighter, 'scorching-ray', 2, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'scorching-ray',
      slotLevel: 2,
      itemInstanceId: 'forged-circlet',
      targetTokenId: enemy.id,
      targetTokenIds: [enemy.id],
      projectileTargetIds: [enemy.id, enemy.id, enemy.id],
    }
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'item-spell-unavailable' })
  })

  it('enforces a concrete spell scroll class-list gate from authoritative item data', () => {
    const grantScroll = (owner: Character) => applyDnd5eInventoryMutation([owner], {
      type: 'grant', characterId: owner.id,
      templateId: 'srd-5.1:spell-scroll:fireball', quantity: 1,
    }).characters[0]
    const fighter = grantScroll(character('scroll-fighter', '战士'))
    const wizard = grantScroll(character('scroll-wizard', '法师', {
      dnd5eClassLevels: { wizard: 5 },
    }))
    const scrollInstanceId = (owner: Character) => normalizeDnd5eInventory(owner).entries.find(
      (entry) => entry.templateId === 'srd-5.1:spell-scroll:fireball',
    )!.instanceId
    const enemy = token('scroll-target', 'enemy', 125)
    const attempt = (owner: Character) => {
      const input = fixture(owner, 'fireball', 3, enemy)
      input.action.dnd5eSpellCast = {
        spellId: 'fireball', slotLevel: 3,
        itemInstanceId: scrollInstanceId(owner),
        targetTokenId: enemy.id, targetTokenIds: [enemy.id],
        areaTargetCell: { col: 2, row: 0 },
      }
      return prepareDnd5eSpellCast(input)
    }

    expect(attempt(fighter)).toEqual({ ok: false, reason: 'item-spell-unavailable' })
    expect(attempt(wizard).ok).toBe(true)
  })

  it('casts an explicitly selected upcast Magic Missile action and spends the shared wand charges', () => {
    const fighter = character('wand-fighter', '战士', { classResources: {} })
    const granted = applyDnd5eInventoryMutation([fighter], {
      type: 'grant', characterId: fighter.id,
      templateId: 'srd-5.1:magic-item:wand-of-magic-missiles', quantity: 1,
    })
    const wand = normalizeDnd5eInventory(granted.characters[0]).entries.find(
      (entry) => entry.templateId === 'srd-5.1:magic-item:wand-of-magic-missiles',
    )
    expect(wand).toBeDefined()
    if (!wand) return
    const owner = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip', characterId: fighter.id, instanceId: wand.instanceId, slot: 'mainWeapon',
    }).characters[0]
    const enemy = token('wand-target', 'enemy', 125)
    const input = fixture(owner, 'magic-missile', 3, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'magic-missile', slotLevel: 3,
      itemInstanceId: wand.instanceId,
      itemUseActionId: 'magic-missile-level-3',
      targetTokenId: enemy.id,
      targetTokenIds: [enemy.id],
      projectileTargetIds: [enemy.id, enemy.id, enemy.id, enemy.id, enemy.id],
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      slotLevel: 3,
      diceCount: 5,
      itemSpellSource: {
        instanceId: wand.instanceId,
        useActionId: 'magic-missile-level-3',
        costs: [{ kind: 'resource', resourceId: 'charges', amount: 3 }],
      },
    })
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      effectRolls: [1, 2, 3, 4, 1],
    })
    expect(resolved.result.ok).toBe(true)
    const settledOwner = resolved.application?.characters.find((candidate) => candidate.id === owner.id)
    expect(settledOwner && normalizeDnd5eInventory(settledOwner).entries.find(
      (entry) => entry.instanceId === wand.instanceId,
    )?.resources?.charges.current).toBe(4)
    expect(settledOwner?.classResources?.['dnd5e-spell-slot-3']).toBeUndefined()
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast', itemInstanceId: wand.instanceId,
      itemUseActionId: 'magic-missile-level-3',
    }))

    const forged = fixture(owner, 'magic-missile', 3, enemy)
    forged.action.dnd5eSpellCast = {
      ...input.action.dnd5eSpellCast,
      itemUseActionId: 'magic-missile-level-7',
      slotLevel: 3,
    }
    expect(prepareDnd5eSpellCast(forged)).toEqual({ ok: false, reason: 'item-spell-unavailable' })
  })

  it('enforces the Ring of Jumping self-only target restriction from authoritative item data', () => {
    const wizard = character('ring-wizard', '法师')
    const granted = applyDnd5eInventoryMutation([wizard], {
      type: 'grant',
      characterId: wizard.id,
      templateId: 'srd-5.1:magic-item:ring-of-jumping',
      quantity: 1,
    })
    let owner = granted.characters[0]
    const ring = normalizeDnd5eInventory(owner).entries.find(
      (entry) => entry.templateId === 'srd-5.1:magic-item:ring-of-jumping',
    )
    expect(ring).toBeDefined()
    if (!ring) return
    owner = applyDnd5eInventoryMutation([owner], {
      type: 'equip', characterId: owner.id, instanceId: ring.instanceId, slot: 'ring',
    }).characters[0]
    const inventory = normalizeDnd5eInventory(owner)
    owner = {
      ...owner,
      dnd5eInventory: {
        ...inventory,
        entries: inventory.entries.map((entry) => entry.instanceId === ring.instanceId
          ? { ...entry, attuned: true, attunedAt: 1 }
          : entry),
      },
    }

    const enemy = token('enemy', 'enemy', 125)
    const hostile = fixture(owner, 'jump', 1, enemy)
    hostile.action.dnd5eSpellCast = {
      spellId: 'jump', slotLevel: 1, itemInstanceId: ring.instanceId,
      targetTokenId: enemy.id, targetTokenIds: [enemy.id],
    }
    expect(prepareDnd5eSpellCast(hostile)).toEqual({ ok: false, reason: 'invalid-target' })

    const self = fixture(owner, 'jump', 1, enemy)
    self.action.targetTokenId = `${owner.id}-token`
    self.action.dnd5eSpellCast = {
      spellId: 'jump', slotLevel: 1, itemInstanceId: ring.instanceId,
      targetTokenId: `${owner.id}-token`, targetTokenIds: [`${owner.id}-token`],
    }
    expect(prepareDnd5eSpellCast(self).ok).toBe(true)
  })

  it('binds a guessed spell-attack cell to the Host authoritative token snapshot', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(wizard, 'fire-bolt', 0, enemy)
    input.action.targetTokenId = undefined
    input.action.targetTokenIds = []
    input.action.targetCell = { col: 2, row: 0 }
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetTokenId: '',
      targetTokenIds: [],
      guessedTargetCell: { col: 2, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((candidate) => candidate.id)).toEqual(['enemy'])
    expect(prepared.prepared.guessedTargetCell).toEqual({ col: 2, row: 0 })
    expect(prepared.prepared.blindTargetMiss).toBe(false)
  })

  it('settles an empty guessed spell-attack cell as a resource-consuming miss without target effects', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(wizard, 'fire-bolt', 0, enemy)
    input.action.targetTokenId = undefined
    input.action.targetTokenIds = []
    input.action.targetCell = { col: 3, row: 0 }
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetTokenId: '',
      targetTokenIds: [],
      guessedTargetCell: { col: 3, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens).toEqual([])
    expect(prepared.prepared.blindTargetMiss).toBe(true)
    const beforeHp = prepared.prepared.state.combatants.enemy.currentHp
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 20,
      d20Second: 20,
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants.enemy.currentHp).toBe(beforeHp)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent',
      actorId: 'wizard-token',
      resource: 'action',
    })
  })

  it('allows an unseen guessed spell target through a sight-only blocker but rejects total cover', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    const enemy = token('enemy', 'enemy', 225)
    const createInput = () => {
      const input = fixture(wizard, 'fire-bolt', 0, enemy)
      input.action.targetTokenId = undefined
      input.action.targetTokenIds = []
      input.action.targetCell = { col: 4, row: 0 }
      input.action.dnd5eSpellCast = {
        spellId: 'fire-bolt',
        slotLevel: 0,
        targetTokenId: '',
        targetTokenIds: [],
        guessedTargetCell: { col: 4, row: 0 },
      }
      return input
    }
    const geometryBase = {
      mapId: 'map',
      doors: [],
      obstacles: [],
      vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' as const },
      updatedAt: 1,
    }
    setMapGeometryRuntime([{
      ...geometryBase,
      walls: [{
        id: 'curtain', kind: 'wall' as const, label: '仅遮挡视线',
        points: [{ x: 150, y: 0 }, { x: 150, y: 100 }],
        blocksVision: true, blocksMovement: false, blocksLineOfEffect: false,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
    }])
    const throughSightBlocker = prepareDnd5eSpellCast(createInput())
    expect(throughSightBlocker.ok, throughSightBlocker.ok ? undefined : throughSightBlocker.reason).toBe(true)

    setMapGeometryRuntime([{
      ...geometryBase,
      walls: [{
        id: 'solid-wall', kind: 'wall' as const, label: '全身掩护',
        points: [{ x: 150, y: 0 }, { x: 150, y: 100 }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
    }])
    expect(prepareDnd5eSpellCast(createInput())).toEqual({ ok: false, reason: 'effect-line-blocked' })
  })

  it('lets Dispel Magic bind an unseen guessed creature and consumes the spell on an empty guess', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['dispel-magic'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 2, max: 2 } },
    })
    const enemy = token('enemy', 'enemy', 225)
    const input = fixture(wizard, 'dispel-magic', 3, enemy)
    input.action.targetTokenId = undefined
    input.action.targetTokenIds = []
    input.action.targetCell = { col: 4, row: 0 }
    input.action.dnd5eSpellCast = {
      spellId: 'dispel-magic',
      slotLevel: 3,
      targetTokenId: '',
      targetTokenIds: [],
      guessedTargetCell: { col: 4, row: 0 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetToken.id).toBe(enemy.id)

    input.action.targetCell = { col: 5, row: 0 }
    input.action.dnd5eSpellCast.guessedTargetCell = { col: 5, row: 0 }
    const missed = prepareDnd5eSpellCast(input)
    expect(missed.ok, missed.ok ? undefined : missed.reason).toBe(true)
    if (!missed.ok) return
    expect(missed.prepared.blindTargetMiss).toBe(true)
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: missed.prepared, effectRolls: [] })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants['wizard-token'].classResources['dnd5e-spell-slot-3'].current).toBe(1)
  })

  it('does not bind Dispel Magic guessed targeting to an Arcane Locked mapped door', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['dispel-magic'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 2, max: 2 } },
    })
    const enemy = token('enemy', 'enemy', 425)
    const input = fixture(wizard, 'dispel-magic', 3, enemy)
    input.action.targetTokenId = undefined
    input.action.targetTokenIds = []
    input.action.targetCell = { col: 5, row: 0 }
    input.action.dnd5eSpellCast = {
      spellId: 'dispel-magic', slotLevel: 3,
      targetTokenId: '', targetTokenIds: [], guessedTargetCell: { col: 5, row: 0 },
    }
    const geometry = createEmptyMapGeometry(input.map.id, 1)
    geometry.doors.push({
      id: 'arcane-door', kind: 'door', label: '秘法锁测试门',
      points: [{ x: 275, y: 0 }, { x: 275, y: 50 }],
      state: 'locked', openState: 'closed', lockState: 'locked',
      secret: false,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: false,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      dnd5eArcaneLock: {
        schemaVersion: 1, sourceTokenId: 'wizard-token',
        sourceActivityId: 'spell:arcane-lock', spellLevel: 2, previousLocked: false,
      },
    })
    setMapGeometryRuntime([geometry])

    const prepared = prepareDnd5eSpellCast(input)

    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.blindTargetMiss).toBe(true)
    expect(prepared.prepared.targetTokens).toEqual([])
    expect(prepared.prepared).not.toHaveProperty('dispelMapObjectTarget')
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants['wizard-token'].classResources['dnd5e-spell-slot-3'].current).toBe(1)
  })

  it('rejects spell-driven inventory object targeting from old clients', () => {
    const objectTargetWizard = character('object-target-wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['dispel-magic'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 2, max: 2 } },
    })
    const objectTargetEnemy = token('object-target-enemy', 'enemy', 125)
    const objectTargetInput = fixture(objectTargetWizard, 'dispel-magic', 3, objectTargetEnemy)
    objectTargetInput.action.dnd5eSpellCast = {
      spellId: 'dispel-magic', castingClassId: 'wizard', slotLevel: 3,
      targetTokenId: objectTargetEnemy.id, targetInventoryInstanceId: 'forged-object-instance',
    }
    expect(prepareDnd5eSpellCast(objectTargetInput)).toEqual({ ok: false, reason: 'invalid-target' })

    /* Removed legacy fixture: spell-driven sapphire/object mutation is no
       longer part of the VTT protocol. Object outcomes are handled by voice.
    const actorId = 'sapphire-wizard-token'
    let wizard = character('sapphire-wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['dispel-magic'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 2, max: 2 } },
    })
    let characters = applyDnd5eInventoryMutation([wizard], {
      type: 'grant', characterId: wizard.id, templateId: 'srd-5.1:item:small-knife', quantity: 1,
    }).characters
    characters = applyDnd5eInventoryMutation(characters, {
      type: 'grant', characterId: wizard.id, templateId: 'srd-5.1:item:sapphire-1000gp', quantity: 1,
    }).characters
    const knife = normalizeDnd5eInventory(characters[0]).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:small-knife')!
    const recordId = `linked-planar-object:instant-summons:${actorId}:${knife.instanceId}`
    const established = applyDnd5eLinkedSpellAuthorityInventoryHandoff(characters, {
      sourceCharacterId: wizard.id, sourceActorAuthorityId: actorId,
      receiptId: 'spell-action:instant-summons-establish',
      expectedInventoryRevision: normalizeDnd5eInventory(characters[0]).revision,
      establishments: [{
        kind: 'establish-spell-authority', operationId: 'bind-object',
        sourceActivityId: 'spell:instant-summons', sourceActorId: actorId,
        targetId: actorId, recordKind: 'linked-planar-object',
        linkedObjectProfile: 'instant-summons', inventoryInstanceId: knife.instanceId,
      }],
    })
    expect(established.ok).toBe(true)
    if (!established.ok) return
    const controller = createDnd5eMechanicalEffect({
      definitionId: 'activity:instant-summons:instant-summons-controller:modifiers:0',
      label: '瞬间召唤·物品连结',
      source: {
        kind: 'spell', actorId, pluginId: 'srd-5.1', rulesId: 'instant-summons',
        spellLevel: 6, magical: true,
      },
      targetId: actorId,
      grantedActivities: ['spell:instant-summons:recall'],
      duration: { type: 'permanent' },
    })
    const unrelated = createDnd5eMechanicalEffect({
      definitionId: 'test:unrelated-effect', label: 'Unrelated',
      source: { kind: 'spell', actorId, rulesId: 'mage-armor', spellLevel: 1, magical: true },
      targetId: actorId, duration: { type: 'permanent' }, armorClassBonus: 1,
    })
    wizard = {
      ...established.characters[0],
      dnd5eCombatState: {
        ...(established.characters[0].dnd5eCombatState ?? { schemaVersion: 2 as const }),
        activeEffects: [controller, unrelated],
        spellAuthorityRecords: {
          [recordId]: {
            schemaVersion: 1, id: recordId, kind: 'linked-planar-object',
            sourceActorId: actorId, subjectActorId: actorId,
            sourceActivityId: 'spell:instant-summons', createdWorldMinute: 1,
            profile: 'instant-summons', inventoryInstanceId: knife.instanceId,
            planarState: 'material',
          },
        },
      },
    }
    const sapphire = normalizeDnd5eInventory(wizard).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:sapphire-1000gp')!
    const actorToken = token(actorId, 'player', 25, wizard.id)
    const witness = token('dispel-witness', 'enemy', 225)
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, witness],
    }
    const action: SharedPlayerActionState = {
      id: 'dispel-sapphire', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: actorId,
      characterId: wizard.id, targetTokenId: actorId,
      dnd5eSpellCast: {
        spellId: 'dispel-magic', castingClassId: 'wizard', slotLevel: 3,
        targetTokenId: actorId, targetTokenIds: [actorId],
        targetInventoryInstanceId: sapphire.instanceId,
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5eSpellCast({
      action, map, characters: [wizard],
      initiativeOrder: [
        { tokenId: actorId, label: actorToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: witness.id, label: witness.label, emoji: '', color: '', roll: 10 },
      ],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      effectRolls: [],
      dispelMagicChecks: [{ effectId: controller.id, d20: 20 }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-dispelled', spellId: 'instant-summons', success: true,
    }))
    expect(resolved.result.state.combatants[actorId].classState.activeEffects?.map((effect) => effect.id))
      .toEqual([unrelated.id])
    expect(resolved.result.state.combatants[actorId].classState.spellAuthorityRecords?.[recordId])
      .toBeUndefined()
    const settledWizard = resolved.application?.characters.find((candidate) => candidate.id === wizard.id)
    expect(settledWizard).toBeDefined()
    expect(normalizeDnd5eInventory(settledWizard!).entries.find((entry) => entry.instanceId === sapphire.instanceId))
      .toMatchObject({ quantity: 1, linkedSpellFocusAuthorityRecordId: undefined })
    expect(normalizeDnd5eInventory(settledWizard!).entries.find((entry) => entry.instanceId === knife.instanceId))
      .toMatchObject({ linkedSpellAuthorityRecordId: undefined })
    expect(resolved.result.state.combatants[actorId].classResources['dnd5e-spell-slot-3'].current).toBe(1)

    const failedCheckPrepared = prepareDnd5eSpellCast({
      action: { ...action, id: 'dispel-sapphire-failed-check' },
      map,
      characters: [wizard],
      initiativeOrder: [
        { tokenId: actorId, label: actorToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: witness.id, label: witness.label, emoji: '', color: '', roll: 10 },
      ],
    })
    expect(failedCheckPrepared.ok, failedCheckPrepared.ok ? undefined : failedCheckPrepared.reason).toBe(true)
    if (!failedCheckPrepared.ok) return
    const failedCheck = resolvePreparedDnd5eSpellCast({
      prepared: failedCheckPrepared.prepared,
      effectRolls: [],
      dispelMagicChecks: [{ effectId: controller.id, d20: 1 }],
    })
    expect(failedCheck.result.ok, failedCheck.result.ok ? undefined : failedCheck.result.reason).toBe(true)
    expect(failedCheck.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-dispelled', spellId: 'instant-summons', success: false,
    }))
    expect(failedCheck.result.state.combatants[actorId].classState.activeEffects?.map((effect) => effect.id))
      .toEqual([controller.id, unrelated.id])
    expect(failedCheck.result.state.combatants[actorId].classState.spellAuthorityRecords?.[recordId])
      .toBeDefined()
    const failedCheckWizard = failedCheck.application?.characters.find((candidate) => candidate.id === wizard.id)
    expect(normalizeDnd5eInventory(failedCheckWizard!).entries.find((entry) => entry.instanceId === sapphire.instanceId))
      .toMatchObject({ quantity: 1, linkedSpellFocusAuthorityRecordId: recordId })
    expect(failedCheck.result.state.combatants[actorId].classResources['dnd5e-spell-slot-3'].current).toBe(1)
    */
  })

  it('allows Sanctuary to ward a creature in a guessed cell and consumes the slot on an empty guess', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['sanctuary'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } },
    })
    const ally = character('ally', '战士')
    const allyToken = token('ally-token', 'player', 125, ally.id)
    const createInput = (cell: { col: number; row: number }) => {
      const input = fixture(cleric, 'sanctuary', 1, allyToken, [ally])
      input.action.targetTokenId = undefined
      input.action.targetTokenIds = []
      input.action.targetCell = cell
      input.action.dnd5eSpellCast = {
        spellId: 'sanctuary',
        slotLevel: 1,
        targetTokenId: '',
        targetTokenIds: [],
        guessedTargetCell: cell,
      }
      return input
    }
    const prepared = prepareDnd5eSpellCast(createInput({ col: 2, row: 0 }))
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetToken.id).toBe(allyToken.id)
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    expect(cast.result.state.combatants[allyToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:sanctuary' }),
    )

    const missed = prepareDnd5eSpellCast(createInput({ col: 3, row: 0 }))
    expect(missed.ok, missed.ok ? undefined : missed.reason).toBe(true)
    if (!missed.ok) return
    const missedCast = resolvePreparedDnd5eSpellCast({ prepared: missed.prepared, effectRolls: [] })
    expect(missedCast.result.ok, missedCast.result.ok ? undefined : missedCast.result.reason).toBe(true)
    expect(missedCast.result.state.combatants['cleric-token'].classResources['dnd5e-spell-slot-1'].current).toBe(1)
    expect(missedCast.result.state.combatants[allyToken.id].classState.activeEffects ?? []).toHaveLength(0)
  })

  it('uses the Spiritual Weapon effect point as the origin for an unseen guessed attack', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['spiritual-weapon'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 175)
    const input = fixture(cleric, 'spiritual-weapon', 2, enemy)
    input.action.targetTokenId = undefined
    input.action.targetTokenIds = []
    input.action.targetCell = { col: 3, row: 0 }
    input.action.dnd5eSpellCast = {
      spellId: 'spiritual-weapon',
      slotLevel: 2,
      targetTokenId: '',
      targetTokenIds: [],
      areaTargetCell: { col: 2, row: 0 },
      guessedTargetCell: { col: 3, row: 0 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetToken.id).toBe(enemy.id)
    expect(prepared.prepared.areaAnchorCell).toEqual({ col: 2, row: 0 })
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 15,
      d20Second: 15,
      effectRolls: [4],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)

    input.action.targetCell = input.action.dnd5eSpellCast.areaTargetCell
    input.action.dnd5eSpellCast.guessedTargetCell = undefined
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'spell-target-count-invalid' })
  })

  it('rejects client target IDs and spells that require an actual visible target in guessed-cell mode', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: {
        classes: {
          wizard: {
            selections: {
              'spell-cantrips': ['fire-bolt'],
              'spell-prepared': ['magic-missile'],
            },
          },
        },
      },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const smuggled = fixture(wizard, 'fire-bolt', 0, enemy)
    smuggled.action.dnd5eSpellCast = {
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetTokenId: enemy.id,
      targetTokenIds: [enemy.id],
      guessedTargetCell: { col: 2, row: 0 },
    }
    expect(prepareDnd5eSpellCast(smuggled)).toEqual({ ok: false, reason: 'invalid-target' })

    const sightRequired = fixture(wizard, 'magic-missile', 1, enemy)
    sightRequired.action.dnd5eSpellCast = {
      spellId: 'magic-missile',
      slotLevel: 1,
      targetTokenId: '',
      targetTokenIds: [],
      guessedTargetCell: { col: 2, row: 0 },
    }
    expect(prepareDnd5eSpellCast(sightRequired)).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('requires cell targeting instead of a forged direct target inside magical darkness', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const direct = fixture(wizard, 'fire-bolt', 0, enemy)
    setMapGeometryRuntime([{
      mapId: direct.map.id,
      walls: [],
      doors: [],
      obstacles: [{
        id: 'darkness', kind: 'obstacle', label: '黑暗术',
        points: [{ x: 100, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 50 }, { x: 100, y: 50 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: false,
        magicalDarkness: true, darknessSpellLevel: 2,
        cover: 'none', baseHeightFeet: 0, heightFeet: 20, createdAt: 1,
      }],
      vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])
    expect(prepareDnd5eSpellCast(direct)).toEqual({ ok: false, reason: 'spell-target-not-visible' })

    direct.action.targetTokenId = undefined
    direct.action.targetTokenIds = []
    direct.action.targetCell = { col: 2, row: 0 }
    direct.action.dnd5eSpellCast = {
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetTokenId: '',
      targetTokenIds: [],
      guessedTargetCell: { col: 2, row: 0 },
    }
    const guessed = prepareDnd5eSpellCast(direct)
    expect(guessed.ok, guessed.ok ? undefined : guessed.reason).toBe(true)
    if (!guessed.ok) return
    expect(guessed.prepared.targetToken.id).toBe(enemy.id)
  })

  it('requires Acid Splash to select visible creatures instead of a guessed cell', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['acid-splash'] } } } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const guessed = fixture(wizard, 'acid-splash', 0, enemy)
    guessed.action.targetTokenId = undefined
    guessed.action.targetTokenIds = []
    guessed.action.targetCell = { col: 2, row: 0 }
    guessed.action.dnd5eSpellCast = {
      spellId: 'acid-splash',
      slotLevel: 0,
      targetTokenId: '',
      targetTokenIds: [],
      guessedTargetCell: { col: 2, row: 0 },
    }
    expect(prepareDnd5eSpellCast(guessed)).toEqual({ ok: false, reason: 'invalid-target' })

    const correct = fixture(wizard, 'acid-splash', 0, enemy)
    const preparedCorrect = prepareDnd5eSpellCast(correct)
    expect(preparedCorrect.ok, preparedCorrect.ok ? undefined : preparedCorrect.reason).toBe(true)
    if (!preparedCorrect.ok) return
    expect(preparedCorrect.prepared.savingThrow).toBeDefined()
    expect(preparedCorrect.prepared.targetToken.id).toBe('enemy')
  })

  it('authoritatively assigns every Eldritch Blast and Scorching Ray projectile to the guessed occupant', () => {
    const warlock = character('warlock', '邪术师', {
      level: 5,
      dnd5eClassChoices: { classes: { warlock: { selections: { 'spell-cantrips': ['eldritch-blast'] } } } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const blast = fixture(warlock, 'eldritch-blast', 0, enemy)
    blast.action.targetTokenId = undefined
    blast.action.targetTokenIds = []
    blast.action.targetCell = { col: 2, row: 0 }
    blast.action.dnd5eSpellCast = {
      spellId: 'eldritch-blast',
      slotLevel: 0,
      targetTokenId: '',
      targetTokenIds: [],
      guessedTargetCell: { col: 2, row: 0 },
    }
    const preparedBlast = prepareDnd5eSpellCast(blast)
    expect(preparedBlast.ok, preparedBlast.ok ? undefined : preparedBlast.reason).toBe(true)
    if (!preparedBlast.ok) return
    expect(preparedBlast.prepared.projectileTargetIds).toEqual(['enemy', 'enemy'])
    const resolvedBlast = resolvePreparedDnd5eSpellCast({
      prepared: preparedBlast.prepared,
      targetAttacks: [
        { targetId: enemy.id, d20: 15, d20Second: 4, effectRolls: [5] },
        { targetId: enemy.id, d20: 15, d20Second: 4, effectRolls: [5] },
      ],
      effectRolls: [],
    })
    expect(resolvedBlast.result.ok, resolvedBlast.result.ok ? undefined : resolvedBlast.result.reason).toBe(true)
    expect(resolvedBlast.result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(2)

    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['scorching-ray'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const rays = fixture(wizard, 'scorching-ray', 2, enemy)
    rays.action.targetTokenId = undefined
    rays.action.targetTokenIds = []
    rays.action.targetCell = { col: 2, row: 0 }
    rays.action.dnd5eSpellCast = {
      spellId: 'scorching-ray',
      slotLevel: 2,
      targetTokenId: '',
      targetTokenIds: [],
      guessedTargetCell: { col: 2, row: 0 },
    }
    const preparedRays = prepareDnd5eSpellCast(rays)
    expect(preparedRays.ok, preparedRays.ok ? undefined : preparedRays.reason).toBe(true)
    if (!preparedRays.ok) return
    expect(preparedRays.prepared.projectileTargetIds).toEqual(['enemy', 'enemy', 'enemy'])
  })

  it('rejects a forged hidden target for spells whose SRD text requires sight', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['magic-missile'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const direct = fixture(wizard, 'magic-missile', 1, enemy)
    direct.action.targetTokenIds = [enemy.id]
    direct.action.dnd5eSpellCast = {
      spellId: 'magic-missile',
      slotLevel: 1,
      targetTokenId: enemy.id,
      targetTokenIds: [enemy.id],
      projectileTargetIds: [enemy.id, enemy.id, enemy.id],
    }
    setMapGeometryRuntime([{
      mapId: direct.map.id,
      walls: [],
      doors: [],
      obstacles: [{
        id: 'darkness', kind: 'obstacle', label: '黑暗术',
        points: [{ x: 100, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 50 }, { x: 100, y: 50 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: false,
        magicalDarkness: true, darknessSpellLevel: 2,
        cover: 'none', baseHeightFeet: 0, heightFeet: 20, createdAt: 1,
      }],
      vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])

    expect(prepareDnd5eSpellCast(direct)).toEqual({ ok: false, reason: 'spell-target-not-visible' })
  })

  it('rejects an invisible creature as Sacred Flame\'s sight-required target', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassLevels: { cleric: 5 },
      dnd5eClassChoices: {
        classes: { cleric: { selections: { 'spell-cantrips': ['sacred-flame'] } } },
      },
    })
    const invisibleEnemy = token('invisible-enemy', 'enemy', 125)
    invisibleEnemy.dnd5eCombatState = {
      activeEffects: [createDnd5eConditionEffect({
        condition: 'invisible',
        targetId: invisibleEnemy.id,
        source: { kind: 'feature', actorId: invisibleEnemy.id },
        duration: { type: 'permanent' },
      })],
    }

    expect(prepareDnd5eSpellCast(
      fixture(cleric, 'sacred-flame', 0, invisibleEnemy),
    )).toEqual({ ok: false, reason: 'spell-target-not-visible' })
  })

  it('rejects a wizard spell while the wizard wears unproficient armor', () => {
    const wizard = character('wizard', '法师', {
      equipment: { armor: DND5E_LEATHER_ARMOR },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    expect(prepareDnd5eSpellCast(fixture(wizard, 'fire-bolt', 0, token('enemy', 'enemy', 125)))).toEqual({
      ok: false,
      reason: 'armor-proficiency-required',
    })
  })

  it('prepares Charm Person with combat advantage and resolves its authoritative condition', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: {
        classes: {
          wizard: {
            selections: { 'spell-prepared': ['charm-person'] },
          },
        },
      },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const targetCharacter = character('target', '战士', {
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 8, cha: 10 },
    })
    const targetToken = token('target-token', 'enemy', 125, targetCharacter.id)
    const prepared = prepareDnd5eSpellCast(
      fixture(wizard, 'charm-person', 1, targetToken, [targetCharacter]),
    )
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.savingThrow?.mode).toBe('advantage')

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      savingThrowD20Second: 2,
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants[targetToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'charmed',
        source: expect.objectContaining({ actorId: 'wizard-token', rulesId: 'charm-person' }),
      }),
    )
  })

  it('lets Freedom of Movement prevent player Hold Person without starting concentration', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassLevels: { wizard: 3 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['hold-person'] } } },
      },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const targetToken = token('target-token', 'enemy', 125, 'target')
    const freedom = createDnd5eMechanicalEffect({
      definitionId: 'activity:freedom-of-movement',
      label: 'Freedom of Movement',
      source: { kind: 'spell', actorId: 'cleric', rulesId: 'freedom-of-movement', magical: true },
      targetId: targetToken.id,
      modifiers: {
        conditionImmunitiesBySourceMagic: [{
          conditions: ['paralyzed', 'restrained'], sourceMagical: true, suppressExisting: true,
        }],
      },
    })
    const targetCharacter = character('target', '战士', {
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 8, cha: 10 },
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [freedom] },
    })
    const prepared = prepareDnd5eSpellCast(
      fixture(wizard, 'hold-person', 2, targetToken, [targetCharacter]),
    )
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants['wizard-token'].classState.concentrationSpellId).toBeUndefined()
    expect(resolved.result.state.combatants[targetToken.id].conditions).not.toContain('paralyzed')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'condition-attempted', targetId: targetToken.id, condition: 'paralyzed', prevented: true,
    }))
  })

  it('persists Darkvision as an 8-hour non-concentration map effect', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: {
        classes: {
          wizard: {
            selections: { 'spell-prepared': ['darkvision'] },
          },
        },
      },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const ally = character('ally', '战士')
    const allyToken = token('ally-token', 'player', 75, ally.id)
    const prepared = prepareDnd5eSpellCast(
      fixture(wizard, 'darkvision', 2, allyToken, [ally]),
    )
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants[allyToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:darkvision',
        modifiers: expect.objectContaining({ darkvisionRangeFeet: 60 }),
        duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      }),
    )
    expect(resolved.application?.characters.find((candidate) => candidate.id === ally.id)
      ?.dnd5eCombatState?.activeEffects).toContainEqual(
        expect.objectContaining({ definitionId: 'srd-5.1:spell:darkvision' }),
      )
  })

  it('revalidates Misty Step visibility and occupancy before applying its map position', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: {
        classes: {
          wizard: { selections: { 'spell-prepared': ['misty-step'] } },
        },
      },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const input = fixture(wizard, 'misty-step', 2, token('enemy', 'enemy', 425))
    input.action.dnd5eSpellCast!.targetTokenIds = []
    input.action.dnd5eSpellCast!.areaTargetCell = { col: 4, row: 0 }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.teleportDestination).toMatchObject({
      to: { x: 225, y: 25 },
      distanceFeet: 20,
    })
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'wizard-token'))
      .toMatchObject({ x: 225, y: 25 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'teleported',
      actorId: 'wizard-token',
      spellId: 'misty-step',
    }))

    const occupiedInput = fixture(wizard, 'misty-step', 2, token('enemy', 'enemy', 225))
    occupiedInput.action.dnd5eSpellCast!.targetTokenIds = []
    expect(prepareDnd5eSpellCast(occupiedInput)).toEqual({ ok: false, reason: 'invalid-target' })

    const blindedWizard = { ...wizard, conditions: ['blinded'] }
    const blindedInput = fixture(blindedWizard, 'misty-step', 2, token('enemy', 'enemy', 425))
    blindedInput.action.dnd5eSpellCast!.targetTokenIds = []
    blindedInput.action.dnd5eSpellCast!.areaTargetCell = { col: 4, row: 0 }
    expect(prepareDnd5eSpellCast(blindedInput)).toEqual({
      ok: false,
      reason: 'spell-target-not-visible',
    })
  })

  it('revalidates unproficient armor inside Headless against a forged cast action', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    const input = fixture(wizard, 'fire-bolt', 0, token('enemy', 'enemy', 125))
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const state = structuredClone(prepared.prepared.state)
    state.combatants[prepared.prepared.actorToken.id].wearingUnproficientArmor = true
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell',
      actorId: prepared.prepared.actorToken.id,
      targetId: prepared.prepared.targetToken.id,
      spellId: 'fire-bolt',
      slotLevel: 0,
      d20: 20,
      effectRolls: [8, 8],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('prepares Enlarge/Reduce choice and only requires a Constitution save from unwilling targets', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['enlarge-reduce'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const hostileInput = fixture(wizard, 'enlarge-reduce', 2, enemy)
    hostileInput.action.dnd5eSpellCast!.enlargeReduceChoice = 'reduce'
    const hostile = prepareDnd5eSpellCast(hostileInput)
    expect(hostile.ok).toBe(true)
    if (!hostile.ok) return
    expect(hostile.prepared).toMatchObject({
      enlargeReduceChoice: 'reduce',
      savingThrow: { dc: 14, mode: 'normal' },
    })
    expect(previewDnd5eSpellSavingThrow(hostile.prepared, 20).success).toBe(true)

    const ally = character('ally', '战士')
    const allyToken = token('ally-token', 'player', 125, ally.id)
    const willingInput = fixture(wizard, 'enlarge-reduce', 2, allyToken, [ally])
    willingInput.action.dnd5eSpellCast!.enlargeReduceChoice = 'enlarge'
    const willing = prepareDnd5eSpellCast(willingInput)
    expect(willing.ok).toBe(true)
    if (!willing.ok) return
    expect(willing.prepared.savingThrow).toBeUndefined()
    expect(willing.prepared.targetSavingThrows).toBeUndefined()

    const missingChoice = fixture(wizard, 'enlarge-reduce', 2, enemy)
    expect(prepareDnd5eSpellCast(missingChoice)).toMatchObject({ ok: false, reason: 'invalid-action' })
  })

  it('prepares Flame Blade attacks from the authoritative concentration effect and preserves its original slot', () => {
    const activeFlameBlade = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:flame-blade',
      label: '火焰刀',
      targetId: 'druid-token',
      source: { kind: 'spell', actorId: 'druid-token', rulesId: 'flame-blade' },
      duration: {
        type: 'concentration',
        sourceActorId: 'druid-token',
        concentrationId: 'flame-blade',
        remainingRounds: 100,
      },
      potency: 4,
    })
    const druid = character('druid', '德鲁伊', {
      level: 7,
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['flame-blade'] } } } },
      classResources: { 'dnd5e-spell-slot-4': { current: 0, max: 1 } },
      dnd5eCombatState: {
        concentrationSpellId: 'flame-blade',
        activeEffects: [activeFlameBlade],
      },
    })
    const enemy = token('enemy', 'enemy', 75)
    const input = fixture(druid, 'flame-blade', 4, enemy)
    input.action.dnd5eSpellCast!.sustainedEffectAttack = 'flame-blade'

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      slotLevel: 4,
      diceCount: 4,
      attackMode: 'normal',
      sustainedEffectAttack: 'flame-blade',
    })
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 15,
      effectRolls: [1, 2, 3, 4],
    })
    expect(resolved.result).toMatchObject({ ok: true })
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants.enemy.currentHp).toBe(20)
    expect(resolved.result.state.combatants['druid-token'].turn.actionAvailable).toBe(false)
    expect(resolved.result.state.combatants['druid-token'].classResources['dnd5e-spell-slot-4']).toEqual({
      current: 0,
      max: 1,
    })

    const distantEnemy = token('distant-enemy', 'enemy', 125)
    const distantInput = fixture(druid, 'flame-blade', 4, distantEnemy)
    distantInput.action.dnd5eSpellCast!.sustainedEffectAttack = 'flame-blade'
    expect(prepareDnd5eSpellCast(distantInput)).toMatchObject({
      ok: false,
      reason: 'target-out-of-range',
    })
  })

  it('rejects a forged Flame Blade attack when the actor has no matching active effect', () => {
    const druid = character('druid', '德鲁伊', {
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['flame-blade'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const input = fixture(druid, 'flame-blade', 2, token('enemy', 'enemy', 75))
    input.action.dnd5eSpellCast!.sustainedEffectAttack = 'flame-blade'
    expect(prepareDnd5eSpellCast(input)).toMatchObject({
      ok: false,
      reason: 'sustained-spell-unavailable',
    })
  })

  it('replaces the same caster\'s prior Spiritual Weapon area, token, and active effect on recast', () => {
    const cleric = character('recast-cleric', dnd5eClassDefinition('cleric')!.name, {
      level: 5,
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['spiritual-weapon'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 2, max: 3 } },
    })
    const enemy = token('recast-enemy', 'enemy', 75)
    enemy.y = 125
    enemy.hp = 100
    enemy.maxHp = 100
    const input = fixture(cleric, 'spiritual-weapon', 2, enemy)
    const firstPrepared = prepareDnd5eSpellCast(input)
    expect(firstPrepared.ok).toBe(true)
    if (!firstPrepared.ok) return
    const first = resolvePreparedDnd5eSpellCast({
      prepared: firstPrepared.prepared,
      d20: 15,
      effectRolls: [1],
    })
    expect(first.result.ok).toBe(true)
    expect(first.application).toBeDefined()
    if (!first.result.ok || !first.application) return

    const secondAction: SharedPlayerActionState = {
      ...input.action,
      id: 'recast-spiritual-weapon',
      round: 2,
      seq: 2,
      updatedAt: 2,
      dnd5eSpellCast: {
        spellId: 'spiritual-weapon', castingClassId: 'cleric', slotLevel: 2,
        targetTokenId: enemy.id, targetTokenIds: [enemy.id],
        areaTargetCell: { col: 2, row: 2 },
      },
    }
    const secondPrepared = prepareDnd5eSpellCast({
      action: secondAction,
      map: first.application.map,
      characters: first.application.characters,
      initiativeOrder: input.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('spiritual-weapon-recast-turn'),
    })
    expect(secondPrepared.ok).toBe(true)
    if (!secondPrepared.ok) return
    const second = resolvePreparedDnd5eSpellCast({
      prepared: secondPrepared.prepared,
      d20: 15,
      effectRolls: [2],
    })
    expect(second.result.ok, second.result.ok ? undefined : second.result.reason).toBe(true)
    expect(second.application).toBeDefined()
    if (!second.result.ok || !second.application) return

    expect(second.application.map.dnd5ePluginAreas?.filter((area) =>
      area.coreSpellId === 'spiritual-weapon' && area.sourceCharacterId === cleric.id,
    )).toEqual([
      expect.objectContaining({
        id: 'core-spell-area:recast-spiritual-weapon',
        anchorTokenId: 'core-spell-effect:recast-spiritual-weapon',
      }),
    ])
    expect(second.application.map.tokens.some((candidate) => candidate.id === 'core-spell-effect:cast'))
      .toBe(false)
    expect(second.application.map.tokens).toContainEqual(expect.objectContaining({
      id: 'core-spell-effect:recast-spiritual-weapon',
    }))
    expect(second.application.characters.find((candidate) => candidate.id === cleric.id)
      ?.dnd5eCombatState?.activeEffects?.filter((effect) =>
        effect.definitionId === 'srd-5.1:spell:spiritual-weapon',
      )).toEqual([
        expect.objectContaining({ stackingKey: 'core-spell-area:recast-spiritual-weapon' }),
      ])
  })

  it('creates an independent Spiritual Weapon and later moves and attacks without spending another slot', () => {
    const cleric = character('cleric', dnd5eClassDefinition('cleric')!.name, {
      level: 7,
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['spiritual-weapon'] } } } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 75)
    enemy.y = 125
    const input = fixture(cleric, 'spiritual-weapon', 4, enemy)
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      slotLevel: 4,
      diceCount: 2,
      effectBonus: 3,
      sustainedEffectAreaId: 'core-spell-area:cast',
    })

    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 15,
      effectRolls: [3, 4],
    })
    expect(cast.result.ok).toBe(true)
    expect(cast.application).toBeDefined()
    if (!cast.result.ok || !cast.application) return
    expect(cast.result.state.combatants.enemy.currentHp).toBe(20)
    expect(cast.application.characters.find((candidate) => candidate.id === cleric.id)).toMatchObject({
      concentrating: false,
      classResources: { 'dnd5e-spell-slot-4': { current: 0, max: 1 } },
      dnd5eCombatState: {
        activeEffects: [expect.objectContaining({
          definitionId: 'srd-5.1:spell:spiritual-weapon',
          potency: 4,
          stackingKey: 'core-spell-area:cast',
          duration: expect.objectContaining({ type: 'rounds' }),
        })],
      },
    })
    expect(cast.application.map.dnd5ePluginAreas).toContainEqual(expect.objectContaining({
      id: 'core-spell-area:cast',
      coreSpellId: 'spiritual-weapon',
      anchorMode: 'effect-token',
      anchorCell: { col: 1, row: 2 },
      concentrationId: undefined,
      movement: { economy: 'bonus-action', maximumFeet: 20 },
    }))
    expect(cast.application.map.tokens).toContainEqual(expect.objectContaining({
      id: 'core-spell-effect:cast',
      emoji: '⚔',
      dnd5eSpellEffect: expect.objectContaining({
        spellId: 'spiritual-weapon',
        sourceCharacterId: cleric.id,
      }),
    }))

    const movedMap: BattleMap = {
      ...cast.application.map,
      tokens: cast.application.map.tokens.map((candidate) =>
        candidate.id === enemy.id ? { ...candidate, x: 175 } : candidate,
      ),
    }
    expect(moveDnd5eCoreSpellArea({
      map: movedMap,
      areaId: 'core-spell-area:cast',
      sourceTokenId: 'cleric-token',
      targetCell: { col: 3, row: 2 },
    })).toEqual(expect.objectContaining({ ok: true }))
    const repeatAction: SharedPlayerActionState = {
      ...input.action,
      id: 'repeat-spiritual-weapon',
      targetTokenId: enemy.id,
      dnd5eSpellCast: {
        spellId: 'spiritual-weapon',
        slotLevel: 4,
        targetTokenId: enemy.id,
        targetTokenIds: [enemy.id],
        areaTargetCell: { col: 3, row: 2 },
        sustainedEffectAttack: 'spiritual-weapon',
        sustainedEffectAreaId: 'core-spell-area:cast',
      },
    }
    const repeat = prepareDnd5eSpellCast({
      action: repeatAction,
      map: movedMap,
      characters: cast.application.characters,
      initiativeOrder: input.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('spiritual-weapon-next-turn'),
    })
    expect(repeat).toEqual(expect.objectContaining({ ok: true }))
    if (!repeat.ok) return
    expect(repeat.prepared.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 3, row: 2 },
    })
    const repeated = resolvePreparedDnd5eSpellCast({
      prepared: repeat.prepared,
      d20: 15,
      effectRolls: [5, 5],
    })
    expect(repeated.result.ok).toBe(true)
    if (!repeated.result.ok) return
    expect(repeated.result.state.combatants.enemy.currentHp).toBe(7)
    expect(repeated.result.state.combatants['cleric-token'].turn.bonusActionAvailable).toBe(false)
    expect(repeated.result.state.combatants['cleric-token'].classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })
    expect(repeated.application?.map.tokens.find((candidate) => candidate.id === 'core-spell-effect:cast'))
      .toMatchObject({ x: 175, y: 125 })

    expect(prepareDnd5eSpellCast({
      action: {
        ...repeatAction,
        dnd5eSpellCast: {
          ...repeatAction.dnd5eSpellCast!,
          sustainedEffectAreaId: 'core-spell-area:forged',
        },
      },
      map: movedMap,
      characters: cast.application.characters,
      initiativeOrder: input.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('spiritual-weapon-forged'),
    })).toMatchObject({ ok: false, reason: 'sustained-spell-unavailable' })

    expect(prepareDnd5eSpellCast({
      action: {
        ...repeatAction,
        dnd5eSpellCast: {
          ...repeatAction.dnd5eSpellCast!,
          areaTargetCell: { col: 6, row: 2 },
        },
      },
      map: {
        ...movedMap,
        tokens: movedMap.tokens.map((candidate) =>
          candidate.id === enemy.id ? { ...candidate, x: 325 } : candidate,
        ),
      },
      characters: cast.application.characters,
      initiativeOrder: input.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('spiritual-weapon-too-far'),
    })).toMatchObject({ ok: false, reason: 'target-out-of-range' })
  })

  it('creates a fixed Call Lightning cloud and authorizes later strikes within the cloud radius', () => {
    const druid = character('druid', dnd5eClassDefinition('druid')!.name, {
      level: 7,
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['call-lightning'] } } } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 425)
    const input = fixture(druid, 'call-lightning', 4, enemy)
    input.map.tokens.find((candidate) => candidate.characterId === druid.id)!.x = 325
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      diceCount: 4,
      areaAnchorCell: { col: 8, row: 0 },
      savingThrow: { dc: 14 },
    })

    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [1, 2, 3, 4],
    })
    expect(cast.result.ok).toBe(true)
    expect(cast.application).toBeDefined()
    if (!cast.result.ok || !cast.application) return
    const cloud = cast.application.map.dnd5ePluginAreas?.find((area) => area.coreSpellId === 'call-lightning')
    expect(cloud).toMatchObject({
      id: 'core-spell-area:cast',
      anchorMode: 'fixed',
      anchorCell: { col: 6, row: 0 },
      slotLevel: 4,
      concentrationId: 'call-lightning',
      visual: { preset: 'call-lightning', intensity: 'strong' },
    })
    expect(cloud!.cells.length).toBeGreaterThan(prepared.prepared.areaCells!.length)

    const repeatedMap: BattleMap = {
      ...cast.application.map,
      tokens: cast.application.map.tokens.map((candidate) =>
        candidate.id === enemy.id ? { ...candidate, x: 625 } : candidate,
      ),
    }
    const repeatAction: SharedPlayerActionState = {
      ...input.action,
      id: 'repeat-call-lightning',
      targetTokenId: enemy.id,
      dnd5eSpellCast: {
        spellId: 'call-lightning',
        slotLevel: 4,
        targetTokenId: enemy.id,
        targetTokenIds: [enemy.id],
        areaTargetCell: { col: 12, row: 0 },
        sustainedEffectAttack: 'call-lightning',
        sustainedEffectAreaId: cloud!.id,
      },
    }
    const repeated = prepareDnd5eSpellCast({
      action: repeatAction,
      map: repeatedMap,
      characters: cast.application.characters,
      initiativeOrder: input.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('call-lightning-next-turn'),
    })
    expect(repeated).toEqual(expect.objectContaining({ ok: true }))
    if (!repeated.ok) return
    expect(repeated.prepared.map.dnd5ePluginAreas?.find((area) => area.id === cloud!.id)?.anchorCell)
      .toEqual({ col: 6, row: 0 })

    expect(prepareDnd5eSpellCast({
      action: {
        ...repeatAction,
        id: 'repeat-call-lightning-out-of-range',
        dnd5eSpellCast: {
          ...repeatAction.dnd5eSpellCast!,
          areaTargetCell: { col: 19, row: 0 },
        },
      },
      map: repeatedMap,
      characters: cast.application.characters,
      initiativeOrder: input.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('call-lightning-out-of-range'),
    })).toMatchObject({ ok: false, reason: 'spell-area-target-out-of-range' })
  })

  it('reads Call Lightning overhead space and storm damage from authoritative map geometry', () => {
    const druid = character('weather-druid', dnd5eClassDefinition('druid')!.name, {
      level: 7,
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['call-lightning'] } } } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const input = fixture(druid, 'call-lightning', 4, token('weather-enemy', 'enemy', 425))

    setMapGeometryRuntime([{
      ...createEmptyMapGeometry(input.map.id, 1),
      overheadSpace: 'confined',
      weather: 'storm',
    }])
    expect(prepareDnd5eSpellCast(input)).toEqual({
      ok: false,
      reason: 'spell-environment-unavailable',
    })

    setMapGeometryRuntime([{
      ...createEmptyMapGeometry(input.map.id, 2),
      overheadSpace: 'open',
      weather: 'storm',
    }])
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      diceCount: 5,
      damageDiceCounts: [5],
    })
  })

  it('prepares Calm Emotions as a 20-foot humanoid area with closed effect choices', () => {
    const cleric = character('calm-map-cleric', dnd5eClassDefinition('cleric')!.name, {
      level: 9,
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['calm-emotions'] } } } },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const humanoid: Token = {
      ...token('calm-humanoid', 'enemy', 425),
      creatureTypes: ['类人生物'],
    }
    const input = fixture(cleric, 'calm-emotions', 5, humanoid)
    input.action.dnd5eSpellCast = {
      ...input.action.dnd5eSpellCast!,
      calmEmotionsMode: 'indifferent',
      calmEmotionsIndifferenceScope: 'caster-allies',
    }
    input.map.tokens.push({
      ...token('calm-dragon', 'enemy', 475),
      creatureTypes: ['龙'] as const,
    })
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      slotLevel: 5,
      calmEmotionsMode: 'indifferent',
      calmEmotionsIndifferenceScope: 'caster-allies',
      savingThrow: { dc: 15 },
    })
    expect(prepared.prepared.targetTokens.map((candidate) => candidate.id)).toEqual([humanoid.id])
    expect(prepared.prepared.areaCells?.length).toBeGreaterThan(1)

    expect(prepareDnd5eSpellCast({
      ...input,
      action: {
        ...input.action,
        dnd5eSpellCast: {
          ...input.action.dnd5eSpellCast!,
          calmEmotionsMode: 'suppress',
          calmEmotionsIndifferenceScope: 'everyone',
        },
      },
    })).toMatchObject({ ok: false, reason: 'invalid-action' })
  })

  it('does not create a Spiritual Weapon map entity when the spell is countered', () => {
    const cleric = character('cleric', dnd5eClassDefinition('cleric')!.name, {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['spiritual-weapon'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const counterWizard = character('counter-wizard', dnd5eClassDefinition('wizard')!.name, {
      level: 7,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['counterspell'] } } } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const target = token('counter-token', 'enemy', 75, counterWizard.id)
    target.y = 125
    const input = fixture(cleric, 'spiritual-weapon', 2, target, [counterWizard])
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const countered = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 20,
      effectRolls: [8],
      counterspellReaction: { actorId: target.id, slotLevel: 4 },
    })
    expect(countered.result.ok).toBe(true)
    expect(countered.result.events).toContainEqual(expect.objectContaining({
      type: 'counterspell-resolved',
      casterId: input.action.actorTokenId,
      spellId: 'spiritual-weapon',
      success: true,
    }))
    expect(countered.application?.map.dnd5ePluginAreas ?? []).toEqual([])
    expect(countered.application?.map.tokens.some((candidate) => candidate.dnd5eSpellEffect)).toBe(false)
    expect(countered.application?.characters.find((candidate) => candidate.id === cleric.id)
      ?.dnd5eCombatState?.activeEffects ?? []).toEqual([])
  })

  it('spends the cast but leaves Hideous Laughter targets with Intelligence 4 or lower unaffected', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['hideous-laughter'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const wolf = token('wolf', 'enemy', 125)
    wolf.poolId = 'srd-5.1:wolf'
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'hideous-laughter', 1, wolf))
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.savingThrow).toBeUndefined()
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, d20: 1, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[wolf.id].conditions).toEqual([])
    expect(resolved.result.events).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'saving-throw-resolved', targetId: wolf.id }),
    ]))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'condition-attempted', targetId: wolf.id, condition: 'incapacitated', prevented: true,
    }))
  })

  it('rebuilds the authoritative complete 20-foot Sleep area target set', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['sleep'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(wizard, 'sleep', 1, enemy)
    input.action.dnd5eSpellCast!.targetTokenIds = [input.action.actorTokenId, enemy.id]
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([input.action.actorTokenId, enemy.id])
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [8, 8, 8, 8, 8] })
    expect(resolved.result.ok).toBe(true)

    const omittedCaster = fixture(wizard, 'sleep', 1, enemy)
    omittedCaster.action.dnd5eSpellCast!.targetTokenIds = [enemy.id]
    const rebuilt = prepareDnd5eSpellCast(omittedCaster)
    expect(rebuilt.ok).toBe(true)
    if (!rebuilt.ok) return
    expect(rebuilt.prepared.targetTokens.map((entry) => entry.id)).toEqual([input.action.actorTokenId, enemy.id])

    const emptyArea = fixture(wizard, 'sleep', 1, enemy)
    emptyArea.action.targetTokenId = emptyArea.action.actorTokenId
    emptyArea.action.targetTokenIds = []
    emptyArea.action.dnd5eSpellCast = {
      spellId: 'sleep', castingClassId: 'wizard', slotLevel: 1,
      targetTokenId: emptyArea.action.actorTokenId, targetTokenIds: [],
      areaTargetCell: { col: 10, row: 0 },
    }
    const emptyPrepared = prepareDnd5eSpellCast(emptyArea)
    expect(emptyPrepared.ok, emptyPrepared.ok ? undefined : emptyPrepared.reason).toBe(true)
    if (!emptyPrepared.ok) return
    expect(emptyPrepared.prepared.targetTokens).toEqual([])
    const emptyResolved = resolvePreparedDnd5eSpellCast({
      prepared: emptyPrepared.prepared,
      effectRolls: [8, 8, 8, 8, 8],
    })
    expect(emptyResolved.result.ok, emptyResolved.result.ok ? undefined : emptyResolved.result.reason).toBe(true)
    expect(emptyResolved.result.events).toContainEqual(expect.objectContaining({
      type: 'sleep-resolved', hitPointPool: 40, remainingHitPoints: 40, affectedTargetIds: [],
    }))
  })

  it('prepares the complete Color Spray cone and rolls its Headless HP pool', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['color-spray'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(wizard, 'color-spray', 1, enemy)
    input.action.dnd5eSpellCast!.targetTokenIds = [enemy.id]
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      diceCount: 6,
      spell: { id: 'color-spray', effect: 'color-spray-hit-point-pool' },
    })
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      effectRolls: [10, 10, 10, 10, 10, 10],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'color-spray-resolved', hitPointPool: 60, affectedTargetIds: [enemy.id],
    }))
  })

  it('creates Grease as difficult terrain and resolves its initial Dexterity save through Headless', () => {
    const wizard = character('wizard', dnd5eClassDefinition('wizard')!.name, {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['grease'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(wizard, 'grease', 1, enemy)
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    expect(cast.application).toBeDefined()
    if (!cast.application) return
    const area = cast.application.map.dnd5ePluginAreas?.[0]
    expect(area).toMatchObject({
      coreSpellId: 'grease', concentrationId: undefined, expiresAfterRound: 11,
      movementCostMultiplier: 2,
      triggers: [
        { id: 'grease-create', timing: 'on-create', savingThrow: { ability: 'dex', dc: 14 } },
        { id: 'grease-enter', timing: 'on-enter', oncePerRound: false },
        { id: 'grease-turn-end', timing: 'turn-end', oncePerTurn: true },
      ],
    })
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map: cast.application.map, token: enemy, position: enemy,
    })).toBe(2)
    if (!area) return
    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map, timing: 'on-create', round: 1, areaId: area.id, turnKey: '1:wizard-token',
    }).find((entry) => entry.targetToken.id === enemy.id)
    expect(candidate).toBeDefined()
    if (!candidate) return
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat', round: 1, map: cast.application.map,
      characters: cast.application.characters, initiativeOrder: input.initiativeOrder, candidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return
    const failedSave = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: trigger.prepared, d20: 1 })
    expect(failedSave.result.ok).toBe(true)
    expect(failedSave.result.state.combatants[enemy.id].conditions).toContain('prone')
    expect(failedSave.result.state.combatants[enemy.id].classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'prone', duration: { type: 'permanent' },
      source: expect.objectContaining({ kind: 'spell', rulesId: 'grease' }),
    }))
    expect(failedSave.result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', triggerId: 'grease-create', saveSuccess: false,
      conditionApplied: 'prone',
    }))
  })

  it('hands Wall of Fire creation to the persistent-area save and damage transaction with Empowered Evocation', () => {
    const wizard = character('wall-wizard', dnd5eClassDefinition('wizard')!.name, {
      level: 10,
      abilities: { str: 10, dex: 14, con: 14, int: 18, wis: 16, cha: 16 },
      dnd5eClassLevels: { wizard: 10 },
      dnd5eClassChoices: {
        classes: { wizard: {
          subclass: 'evocation',
          selections: { 'spell-prepared': ['wall-of-fire'] },
        } },
      },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = token('wall-target', 'enemy', 125)
    const input = fixture(wizard, 'wall-of-fire', 4, enemy)
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    expect(cast.application).toBeDefined()
    if (!cast.application) return
    const area = cast.application.map.dnd5ePluginAreas?.find((candidate) =>
      candidate.coreSpellId === 'wall-of-fire')
    expect(area).toBeDefined()
    if (!area) return

    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map,
      timing: 'on-create',
      round: 1,
      areaId: area.id,
      turnKey: '1:wall-wizard-token',
    }).find((entry) => entry.targetToken.id === enemy.id)
    expect(candidate).toBeDefined()
    if (!candidate) return
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat',
      round: 1,
      map: cast.application.map,
      characters: cast.application.characters,
      initiativeOrder: input.initiativeOrder,
      candidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return

    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: trigger.prepared,
      d20: 1,
      damageRolls: [8, 7, 6, 5, 4],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: enemy.id, ability: 'dex', success: false,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-damage-feature-bonus-applied', spellId: 'wall-of-fire',
      featureId: 'evocation-empowered', amount: 4,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', targetId: enemy.id, amount: 34,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', triggerId: 'wall-of-fire-create', damage: 34,
      damageResolution: expect.objectContaining({
        damageType: 'fire',
        roll: {
          sides: 8,
          rolls: [8, 7, 6, 5, 4],
          modifier: 4,
          total: 34,
        },
        damageBeforeSavingThrow: 34,
        damageAfterSavingThrow: 34,
        damageAfterDefenses: 34,
        damageAfterDmAdjustment: 34,
        finalDamage: 34,
      }),
    }))
  })

  it('authoritatively rasterizes a 100-foot Wall of Force as one grid lane', () => {
    const wizard = character('force-wall-wizard', dnd5eClassDefinition('wizard')!.name, {
      level: 9,
      dnd5eClassLevels: { wizard: 9 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['wall-of-force'] } } },
      },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const enemy = token('force-wall-target', 'enemy', 525)
    const input = fixture(wizard, 'wall-of-force', 5, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'wall-of-force',
      castingClassId: 'wizard',
      slotLevel: 5,
      targetTokenId: enemy.id,
      areaTargetCell: { col: 10, row: 4 },
      areaTargetAngleDegrees: 0,
      areaTargetWidthFeet: 100,
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.areaCells).toHaveLength(20)
    expect(new Set(prepared.prepared.areaCells?.map((cell) => cell.row))).toEqual(new Set([4]))

    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    expect(cast.application?.map.dnd5ePluginAreas?.find((candidate) =>
      candidate.coreSpellId === 'wall-of-force')).toMatchObject({
      cells: expect.arrayContaining([{ col: 0, row: 4 }, { col: 19, row: 4 }]),
    })
    expect(cast.application?.map.dnd5ePluginAreas?.find((candidate) =>
      candidate.coreSpellId === 'wall-of-force')?.cells).toHaveLength(20)
  })

  it('creates Entangle as a concentration area and lets a restrained creature use an action to escape', () => {
    const druid = character('druid', dnd5eClassDefinition('druid')!.name, {
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['entangle'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(druid, 'entangle', 1, enemy)
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    expect(cast.application).toBeDefined()
    if (!cast.application) return
    const area = cast.application.map.dnd5ePluginAreas?.[0]
    expect(area).toMatchObject({
      coreSpellId: 'entangle',
      concentrationId: 'entangle',
      expiresAfterRound: 11,
      movementCostMultiplier: 2,
      visual: { preset: 'entangle', intensity: 'normal' },
      triggers: [{
        id: 'entangle-create',
        timing: 'on-create',
        savingThrow: { ability: 'str', dc: 14 },
        condition: {
          condition: 'restrained',
          escapeCheck: { ability: 'str', dc: 14, economy: 'action' },
        },
      }],
    })
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map: cast.application.map, token: enemy, position: enemy,
    })).toBe(2)
    if (!area) return

    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map,
      timing: 'on-create',
      round: 1,
      areaId: area.id,
      turnKey: '1:druid-token',
    }).find((entry) => entry.targetToken.id === enemy.id)
    expect(candidate).toBeDefined()
    if (!candidate) return
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat',
      round: 1,
      map: cast.application.map,
      characters: cast.application.characters,
      initiativeOrder: input.initiativeOrder,
      candidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return

    const failedSave = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: trigger.prepared, d20: 1 })
    expect(failedSave.result.ok).toBe(true)
    if (!failedSave.result.ok) return
    const effect = failedSave.result.state.combatants[enemy.id].classState.activeEffects?.find((entry) =>
      entry.standardCondition === 'restrained' && entry.source.rulesId === 'entangle',
    )
    expect(effect).toMatchObject({
      duration: {
        type: 'concentration',
        sourceActorId: 'druid-token',
        concentrationId: 'entangle',
        remainingRounds: 10,
      },
      escapeCheck: { ability: 'str', dc: 14, economy: 'action' },
    })
    expect(failedSave.result.state.combatants['druid-token'].classState.concentrationTargetIds).toContain(enemy.id)
    if (!effect) return

    failedSave.result.state.initiativeIndex = failedSave.result.state.initiativeOrder.indexOf(enemy.id)
    failedSave.result.state.combatants[enemy.id].turn.actionAvailable = true
    const escaped = resolveDnd5eHeadlessAction(failedSave.result.state, {
      type: 'escape-active-effect',
      actorId: enemy.id,
      effectId: effect.id,
      d20: 20,
    })
    expect(escaped.ok).toBe(true)
    if (!escaped.ok) return
    expect(escaped.state.combatants[enemy.id].conditions).not.toContain('restrained')
    expect(escaped.state.combatants['druid-token'].concentrating).toBe(true)
    expect(escaped.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      actorId: enemy.id,
      ability: 'str',
      dc: 14,
      success: true,
    }))
    expect(escaped.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      effectId: effect.id,
      reason: 'escaped',
    }))
  })

  it('resolves Black Tentacles entry damage, same-source restraint, and Strength-or-Dexterity escape', () => {
    const wizard = character('wizard', dnd5eClassDefinition('wizard')!.name, {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['black-tentacles'] } } } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const victim = character('victim', 'Fighter', {
      abilities: { str: 8, dex: 18, con: 12, int: 10, wis: 10, cha: 10 },
      currentHp: 30,
      maxHp: 30,
    })
    const enemy = token('enemy', 'enemy', 125, victim.id)
    const input = fixture(wizard, 'black-tentacles', 4, enemy, [victim])
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    expect(cast.application).toBeDefined()
    if (!cast.application) return

    const area = cast.application.map.dnd5ePluginAreas?.find((entry) => entry.coreSpellId === 'black-tentacles')
    expect(area).toMatchObject({
      movementCostMultiplier: 2,
      concentrationId: 'black-tentacles',
      triggers: expect.arrayContaining([
        expect.objectContaining({
          id: 'black-tentacles-turn-start',
          skipSaveWhenSourceConditionActive: 'restrained',
          damage: { count: 3, sides: 6, modifier: 0, type: 'bludgeoning' },
        }),
      ]),
    })
    if (!area) return

    const firstCandidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map,
      timing: 'turn-start',
      round: 1,
      areaId: area.id,
      targetTokenId: enemy.id,
      turnKey: '1:enemy',
    })[0]
    expect(firstCandidate).toBeDefined()
    if (!firstCandidate) return
    const firstTrigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat',
      round: 1,
      map: cast.application.map,
      characters: cast.application.characters,
      initiativeOrder: input.initiativeOrder,
      candidate: firstCandidate,
    })
    expect(firstTrigger.ok).toBe(true)
    if (!firstTrigger.ok) return
    expect(firstTrigger.prepared.save).toMatchObject({ ability: 'dex', dc: 14 })
    const failed = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: firstTrigger.prepared,
      d20: 1,
      damageRolls: [3, 3, 3],
    })
    expect(failed.result.ok).toBe(true)
    expect(failed.application).toBeDefined()
    if (!failed.result.ok || !failed.application) return
    expect(failed.application.characters.find((entry) => entry.id === victim.id)).toMatchObject({
      currentHp: 21,
      conditions: expect.arrayContaining(['restrained']),
    })
    const restrained = failed.result.state.combatants[enemy.id].classState.activeEffects?.find((effect) =>
      effect.standardCondition === 'restrained' && effect.source.rulesId === 'black-tentacles',
    )
    expect(restrained).toMatchObject({
      escapeCheck: { ability: 'str', alternativeAbility: 'dex', dc: 14, economy: 'action' },
    })
    if (!restrained) return

    const nextCandidate = collectDnd5ePersistentAreaTriggers({
      map: failed.application.map,
      timing: 'turn-start',
      round: 2,
      areaId: area.id,
      targetTokenId: enemy.id,
      turnKey: '2:enemy',
    })[0]
    expect(nextCandidate).toBeDefined()
    if (!nextCandidate) return
    const nextTrigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat',
      round: 2,
      map: failed.application.map,
      characters: failed.application.characters,
      initiativeOrder: input.initiativeOrder,
      candidate: nextCandidate,
    })
    expect(nextTrigger.ok).toBe(true)
    if (!nextTrigger.ok) return
    expect(nextTrigger.prepared.save).toBeUndefined()
    const automaticDamage = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: nextTrigger.prepared,
      damageRolls: [2, 2, 2],
    })
    expect(automaticDamage.result.ok).toBe(true)
    if (!automaticDamage.result.ok) return

    automaticDamage.result.state.initiativeIndex =
      automaticDamage.result.state.initiativeOrder.indexOf(enemy.id)
    automaticDamage.result.state.combatants[enemy.id].turn.actionAvailable = true
    const escaped = resolveDnd5eHeadlessAction(automaticDamage.result.state, {
      type: 'escape-active-effect',
      actorId: enemy.id,
      effectId: restrained.id,
      d20: 10,
    })
    expect(escaped.ok).toBe(true)
    if (!escaped.ok) return
    expect(escaped.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      actorId: enemy.id,
      ability: 'dex',
      total: 14,
      dc: 14,
      success: true,
    }))
    expect(escaped.state.combatants[enemy.id].conditions).not.toContain('restrained')
  })

  it('applies Jump to the authoritative traversal limit while preserving movement cost', () => {
    const wizard = character('wizard', '法师', {
      abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 16, cha: 10 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['jump'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const ally = character('ally', '战士', {
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    })
    const allyToken = token('ally-token', 'player', 75, ally.id)
    const input = fixture(wizard, 'jump', 1, allyToken, [ally])
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[allyToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:jump',
        modifiers: expect.objectContaining({ jumpDistanceMultiplier: 3 }),
        duration: expect.objectContaining({ type: 'rounds', remainingRounds: 10 }),
      }),
    )
    const casterEnded = resolveDnd5eHeadlessAction(cast.result.state, {
      type: 'end-turn', actorId: 'wizard-token',
    })
    expect(casterEnded.ok).toBe(true)
    if (!casterEnded.ok) return
    const approached = resolveDnd5eHeadlessAction(casterEnded.state, {
      type: 'move',
      actorId: allyToken.id,
      to: { x: 10, y: 0 },
      distance: 10,
    })
    expect(approached.ok).toBe(true)
    if (!approached.ok) return
    const jumped = resolveDnd5eHeadlessAction(approached.state, {
      type: 'move',
      actorId: allyToken.id,
      to: { x: 30, y: 0 },
      distance: 20,
      traversalMode: 'long-jump-running',
    })
    expect(jumped.ok).toBe(true)
    if (!jumped.ok) return
    expect(jumped.state.combatants[allyToken.id].turn.movementRemaining).toBe(0)
  })

  it('casts Shillelagh only on the caster holding a club and stores its authoritative attack choice', () => {
    const druid = character('druid', '德鲁伊', {
      abilities: { str: 10, dex: 14, con: 14, int: 12, wis: 18, cha: 10 },
      equipment: { mainWeapon: DND5E_CLUB },
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-cantrips': ['shillelagh'] } } } },
    })
    const input = fixture(druid, 'shillelagh', 0, token('enemy', 'enemy', 75))
    input.action.targetTokenId = input.action.actorTokenId
    input.action.dnd5eSpellCast = {
      spellId: 'shillelagh',
      slotLevel: 0,
      targetTokenId: input.action.actorTokenId,
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[input.action.actorTokenId].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:shillelagh',
        duration: expect.objectContaining({ type: 'rounds', remainingRounds: 10 }),
        modifiers: expect.objectContaining({
          shillelagh: {
            weaponId: DND5E_CLUB.id,
            spellcastingAbility: 'wis',
            spellcastingModifier: 4,
          },
        }),
      }),
    )
    expect(cast.result.state.combatants[input.action.actorTokenId].turn.bonusActionAvailable).toBe(false)

    const unarmed = character('unarmed-druid', '德鲁伊', {
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-cantrips': ['shillelagh'] } } } },
    })
    const invalid = fixture(unarmed, 'shillelagh', 0, token('enemy-2', 'enemy', 75))
    invalid.action.targetTokenId = invalid.action.actorTokenId
    invalid.action.dnd5eSpellCast = {
      spellId: 'shillelagh',
      slotLevel: 0,
      targetTokenId: invalid.action.actorTokenId,
    }
    expect(prepareDnd5eSpellCast(invalid)).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('casts Magic Weapon on an ally main weapon and rejects an already magical weapon', () => {
    const wizard = character('wizard', '法师', {
      level: 7,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['magic-weapon'] } } } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const ally = character('ally', '战士', {
      equipment: { mainWeapon: DND5E_LONGSWORD },
    })
    const allyToken = token('ally-token', 'player', 75, ally.id)
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'magic-weapon', 4, allyToken, [ally]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[allyToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:magic-weapon',
        modifiers: { magicWeapon: { weaponId: DND5E_LONGSWORD.id, bonus: 2 } },
      }),
    )

    const magicalAlly = character('magic-ally', '战士', {
      equipment: {
        mainWeapon: {
          ...DND5E_LONGSWORD,
          id: 'magic-longsword',
          baseEquipmentId: DND5E_LONGSWORD.id,
          effects: { weaponAttackBonus: 1, weaponDamageBonus: 1 },
        },
      },
    })
    const magicalToken = token('magic-ally-token', 'player', 75, magicalAlly.id)
    expect(prepareDnd5eSpellCast(fixture(wizard, 'magic-weapon', 4, magicalToken, [magicalAlly])))
      .toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('casts Sanctuary as a bonus-action ward using the original caster spell save DC', () => {
    const cleric = character('cleric', '牧师', {
      abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 18, cha: 10 },
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['sanctuary'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const ally = character('ally', '战士')
    const allyToken = token('ally-token', 'player', 125, ally.id)
    const prepared = prepareDnd5eSpellCast(fixture(cleric, 'sanctuary', 1, allyToken, [ally]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[allyToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:sanctuary',
        potency: 15,
        duration: expect.objectContaining({ type: 'rounds', remainingRounds: 10 }),
      }),
    )
    expect(cast.result.state.combatants[prepared.prepared.actorToken.id].turn.bonusActionAvailable).toBe(false)
  })

  it('grants Fly as a concentration-backed 60-foot flying speed used by authoritative movement', () => {
    const wizard = character('wizard', '法师', {
      abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fly'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const ally = character('ally', '战士')
    const allyToken = token('ally-token', 'player', 75, ally.id)
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'fly', 3, allyToken, [ally]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    const targetAfterCast = cast.result.state.combatants[allyToken.id]
    expect(targetAfterCast.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:fly',
      modifiers: expect.objectContaining({ flySpeedFeet: 60 }),
      duration: expect.objectContaining({
        type: 'concentration',
        sourceActorId: 'wizard-token',
        remainingRounds: 100,
      }),
    }))
    expect(dnd5eEffectiveFlySpeed(targetAfterCast)).toBe(60)

    const casterEnded = resolveDnd5eHeadlessAction(cast.result.state, {
      type: 'end-turn', actorId: 'wizard-token',
    })
    expect(casterEnded.ok).toBe(true)
    if (!casterEnded.ok) return
    const flown = resolveDnd5eHeadlessAction(casterEnded.state, {
      type: 'move',
      actorId: allyToken.id,
      to: { x: 30, y: 0 },
      distance: 30,
      traversalMode: 'fly',
      toElevationFeet: 20,
    })
    expect(flown.ok).toBe(true)
    if (!flown.ok) return
    expect(flown.state.combatants[allyToken.id]).toMatchObject({
      elevationFeet: 20,
      airborne: true,
    })

    const events: Parameters<typeof endDnd5eConcentration>[2] = []
    endDnd5eConcentration(
      flown.state,
      flown.state.combatants['wizard-token'],
      events,
    )
    expect(dnd5eEffectiveFlySpeed(flown.state.combatants[allyToken.id])).toBeUndefined()
    expect(events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: allyToken.id,
      definitionId: 'srd-5.1:spell:fly',
      reason: 'concentration-ended',
    }))
  })

  it('applies Heroism fear immunity, grants turn-start temporary hit points, and removes only its own pool when concentration ends', () => {
    const bard = character('bard', '吟游诗人', {
      abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
      dnd5eClassChoices: { classes: { bard: { selections: { 'spell-known': ['heroism'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const ally = character('ally', '战士')
    const allyToken = token('ally-token', 'player', 75, ally.id)
    const prepared = prepareDnd5eSpellCast(fixture(bard, 'heroism', 1, allyToken, [ally]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    const casterEnded = resolveDnd5eHeadlessAction(cast.result.state, {
      type: 'end-turn', actorId: 'bard-token',
    })
    expect(casterEnded.ok).toBe(true)
    if (!casterEnded.ok) return
    const target = casterEnded.state.combatants[allyToken.id]
    expect(target.temporaryHp).toBe(3)
    expect(target.classState.temporaryHitPointsSource).toEqual({
      actorId: 'bard-token', rulesId: 'heroism',
    })
    expect(applyDnd5eStandardConditionEffect(target, casterEnded.state.combatants['bard-token'], {
      rulesId: 'test-fear',
      condition: 'frightened',
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
    }, [])).toBe(false)
    const events: Parameters<typeof endDnd5eConcentration>[2] = []
    endDnd5eConcentration(casterEnded.state, casterEnded.state.combatants['bard-token'], events)
    expect(target.temporaryHp).toBe(0)
    expect(target.classState.temporaryHitPointsSource).toBeUndefined()
    expect(target.classState.activeEffects).toBeUndefined()
    expect(events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: allyToken.id,
      definitionId: 'srd-5.1:spell:heroism',
      reason: 'concentration-ended',
    }))
  })

  it('casts a secondary class spell with that class ability and class level', () => {
    const multiclass = character('multiclass', dnd5eClassDefinition('fighter')!.name, {
      level: 6,
      dnd5eClassLevels: { fighter: 1, wizard: 5 },
      dnd5eClassChoices: {
        classes: {
          fighter: {},
          wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } },
        },
      },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(multiclass, 'fire-bolt', 0, enemy)
    input.action.dnd5eSpellCast!.castingClassId = 'wizard'

    expect(dnd5eSelectedSpellIds(multiclass)).toContain('fire-bolt')
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ castingClassId: 'wizard', castingClassLevel: 5 })
    expect(previewDnd5eSpellAttack(prepared.prepared, 10).roll.modifier).toBe(6)
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, d20: 15, effectRolls: [5, 5] })
    expect(resolved.result.ok).toBe(true)
  })

  it('casts Moonbeam into an empty area and creates a concentration-linked authority area', () => {
    const druid = character('druid', '德鲁伊', {
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['moonbeam'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(druid, 'moonbeam', 2, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'moonbeam', slotLevel: 2, targetTokenId: input.action.actorTokenId,
      targetTokenIds: [], areaTargetCell: { col: 4, row: 2 },
    }
    input.action.targetElevationFeet = 35
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((candidate) => candidate.id === druid.id)).toMatchObject({
      concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'moonbeam' },
      classResources: { 'dnd5e-spell-slot-2': { current: 0, max: 1 } },
    })
    expect(resolved.application?.map.dnd5ePluginAreas).toEqual([
      expect.objectContaining({
        sourceKind: 'core-spell', coreSpellId: 'moonbeam', anchorCell: { col: 4, row: 2 },
        concentrationId: 'moonbeam', visual: { preset: 'moonbeam', intensity: 'strong' },
        vertical: { mode: 'volume', baseElevationFeet: 35, heightFeet: 40 },
      }),
    ])
    if (!resolved.application) return
    const areaId = resolved.application.map.dnd5ePluginAreas![0].id
    const moveAction: SharedPlayerActionState = {
      ...input.action,
      id: 'move-moonbeam',
      type: 'dnd5e-persistent-area-move',
      dnd5eSpellCast: undefined,
      dnd5ePersistentAreaMove: { areaId, targetCell: { col: 8, row: 2 } },
    }
    const movePrepared = prepareDnd5eCoreSpellAreaMove({
      action: moveAction,
      map: resolved.application.map,
      characters: resolved.application.characters,
      initiativeOrder: input.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('moonbeam-turn'),
    })
    expect(movePrepared).toEqual(expect.objectContaining({ ok: true }))
    if (!movePrepared.ok) return
    const moved = resolvePreparedDnd5eCoreSpellAreaMove({ prepared: movePrepared.prepared })
    expect(moved.result.ok).toBe(true)
    expect(moved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: input.action.actorTokenId, resource: 'action',
    }))
    expect(moved.application?.map.dnd5ePluginAreas?.[0].anchorCell).toEqual({ col: 8, row: 2 })
  })

  it('casts Dancing Lights as one Host-owned vague Medium humanoid form', () => {
    const wizard = character('dancing-wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['dancing-lights'] } } } },
    })
    const input = fixture(wizard, 'dancing-lights', 0, token('distant-enemy', 'enemy', 825))
    input.action.dnd5eSpellCast = {
      spellId: 'dancing-lights',
      slotLevel: 0,
      castingClassId: 'wizard',
      targetTokenId: input.action.actorTokenId,
      targetTokenIds: [],
      areaTargetCell: { col: 8, row: 2 },
      dancingLightsForm: 'humanoid',
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      dancingLightsForm: 'humanoid',
      areaAnchorCell: { col: 8, row: 2 },
    })
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'dancing-lights',
      dancingLightsForm: 'humanoid',
      cells: [{ col: 8, row: 2 }],
      lightingAnchorCells: [{ col: 8, row: 2 }],
      lighting: { kind: 'light', brightRadiusFeet: 0, dimRadiusFeet: 10 },
      concentrationId: 'dancing-lights',
    })
  })

  it('allows Fireball to target a legal empty point without substituting the caster as a forged target', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const distantEnemy = token('enemy', 'enemy', 825)
    const input = fixture(wizard, 'fireball', 3, distantEnemy)
    input.action.dnd5eSpellCast = {
      spellId: 'fireball',
      slotLevel: 3,
      targetTokenId: input.action.actorTokenId,
      targetTokenIds: [],
      areaTargetCell: { col: 4, row: 2 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens).toEqual([])
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      effectRolls: [],
    })
    expect(resolved.result).toMatchObject({ ok: true })
    expect(resolved.application?.characters.find((candidate) => candidate.id === wizard.id))
      .toMatchObject({ classResources: { 'dnd5e-spell-slot-3': { current: 0, max: 1 } } })
  })

  it('rebuilds Fireball targets from the Host map when the player projection omits a hidden creature', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const hiddenEnemy = token('hidden-enemy', 'enemy', 225)
    const input = fixture(wizard, 'fireball', 3, hiddenEnemy)
    input.action.dnd5eSpellCast = {
      spellId: 'fireball',
      slotLevel: 3,
      targetTokenId: input.action.actorTokenId,
      targetTokenIds: [],
      areaTargetCell: { col: 4, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((target) => target.id)).toEqual(['hidden-enemy'])
    expect(prepared.prepared.targetToken.id).toBe('hidden-enemy')
    expect(prepared.prepared.savingThrow).toMatchObject({ dc: 14 })
  })

  it('resolves Meteor Swarm from four distinct Host-validated origins and deduplicates overlapping targets', () => {
    const wizard = character('meteor-wizard', '法师', {
      level: 17,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['meteor-swarm'] } } } },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const first = token('meteor-first', 'enemy', 125)
    const second = token('meteor-second', 'enemy', 875)
    const input = fixture(wizard, 'meteor-swarm', 9, first)
    input.map.tokens.push(second)
    input.initiativeOrder.push({ tokenId: second.id, label: second.label, emoji: '', color: '', roll: 5 })
    input.action.dnd5eSpellCast = {
      spellId: 'meteor-swarm',
      slotLevel: 9,
      targetTokenId: input.action.actorTokenId,
      targetTokenIds: [],
      areaTargetCells: [
        { col: 2, row: 0 },
        { col: 3, row: 0 },
        { col: 16, row: 0 },
        { col: 17, row: 0 },
      ],
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.areaAnchorCells).toEqual(input.action.dnd5eSpellCast.areaTargetCells)
    expect(prepared.prepared.damageDiceCounts).toEqual([20, 20])
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([
      input.action.actorTokenId,
      first.id,
      second.id,
    ])

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: prepared.prepared.targetTokens.map((entry) => ({ targetId: entry.id, d20: 1 })),
      effectRolls: Array.from({ length: 20 }, () => 1),
      additionalEffectRolls: [Array.from({ length: 20 }, () => 1)],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === first.id)?.hp).toBe(0)
    expect(resolved.result.events.filter((event) =>
      event.type === 'damage-applied' && event.targetId === first.id,
    )).toHaveLength(1)
    expect(resolved.application?.characters.find((entry) => entry.id === wizard.id)?.classResources)
      .toMatchObject({ 'dnd5e-spell-slot-9': { current: 0, max: 1 } })
  })

  it('rejects Meteor Swarm unless four different origins are submitted', () => {
    const wizard = character('meteor-wizard', '法师', {
      level: 17,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['meteor-swarm'] } } } },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const input = fixture(wizard, 'meteor-swarm', 9, token('meteor-target', 'enemy', 125))
    input.action.dnd5eSpellCast = {
      spellId: 'meteor-swarm', slotLevel: 9, targetTokenId: input.action.actorTokenId,
      targetTokenIds: [],
      areaTargetCells: [
        { col: 2, row: 0 },
        { col: 2, row: 0 },
        { col: 8, row: 0 },
        { col: 12, row: 0 },
      ],
    }
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'spell-area-target-required' })

    input.action.dnd5eSpellCast.areaTargetCells = input.action.dnd5eSpellCast.areaTargetCells!.slice(0, 3)
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'spell-area-target-required' })
  })

  it('casts Darkness as a concentration-linked magical-darkness map effect', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['darkness'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const input = fixture(wizard, 'darkness', 2, token('enemy', 'enemy', 575))
    input.action.dnd5eSpellCast = {
      spellId: 'darkness', slotLevel: 2, targetTokenId: input.action.actorTokenId,
      targetTokenIds: [], areaTargetCell: { col: 4, row: 2 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((candidate) => candidate.id === wizard.id)).toMatchObject({
      concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'darkness' },
      classResources: { 'dnd5e-spell-slot-2': { current: 0, max: 1 } },
    })
    expect(resolved.application?.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'darkness', concentrationId: 'darkness',
      lighting: {
        kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2,
        suppressesMagicalLightThroughLevel: 2,
      },
    })
  })

  it('casts Daylight for one hour without incorrectly starting concentration', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['daylight'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const input = fixture(cleric, 'daylight', 3, token('enemy', 'enemy', 575))
    input.action.dnd5eSpellCast = {
      spellId: 'daylight', slotLevel: 3, targetTokenId: input.action.actorTokenId,
      targetTokenIds: [], areaTargetCell: { col: 4, row: 2 },
    }
    const darknessSource = input.map.tokens.find((candidate) => candidate.id === 'enemy')!
    darknessSource.dnd5eCombatState = { schemaVersion: 2, concentrationSpellId: 'darkness' }
    input.map.dnd5ePluginAreas = [{
      id: 'old-darkness', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:darkness',
      sourceKind: 'core-spell', coreSpellId: 'darkness', slotLevel: 2, label: '黑暗术', color: '#312e81',
      sourceCharacterId: '', sourceTokenId: darknessSource.id, cells: [{ col: 4, row: 2 }],
      anchorCell: { col: 4, row: 2 }, createdRound: 1, expiresAfterRound: 101,
      concentrationId: 'darkness',
      lighting: {
        kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2,
        suppressesMagicalLightThroughLevel: 2,
      },
    }]
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.areaDurationRounds).toBe(600)
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((candidate) => candidate.id === cleric.id)).toMatchObject({
      concentrating: false,
      classResources: { 'dnd5e-spell-slot-3': { current: 0, max: 1 } },
    })
    expect(resolved.application?.map.dnd5ePluginAreas).toHaveLength(1)
    expect(resolved.application?.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'daylight', concentrationId: undefined, expiresAfterRound: 601,
      lighting: {
        kind: 'light', brightRadiusFeet: 60, dimRadiusFeet: 60, spellLevel: 3,
        suppressesMagicalDarknessThroughLevel: 3,
      },
    })
    expect(resolved.application?.map.tokens.find((candidate) => candidate.id === darknessSource.id)
      ?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
  })

  it('rejects a persistent-area anchor behind a line-of-effect wall', () => {
    const druid = character('druid', '德鲁伊', {
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['moonbeam'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const input = fixture(druid, 'moonbeam', 2, token('enemy', 'enemy', 575))
    input.action.dnd5eSpellCast = {
      spellId: 'moonbeam', slotLevel: 2, targetTokenId: input.action.actorTokenId,
      targetTokenIds: [], areaTargetCell: { col: 4, row: 0 },
    }
    setMapGeometryRuntime([{
      mapId: input.map.id,
      walls: [{
        id: 'wall', kind: 'wall', label: '阻挡墙', points: [{ x: 150, y: 0 }, { x: 150, y: 100 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
      doors: [], obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' }, updatedAt: 1,
    }])
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'effect-line-blocked' })
  })

  it('enforces visible placement only for spells whose SRD placement clause requires sight', () => {
    setMapGeometryRuntime([{
      mapId: 'map',
      walls: [{
        id: 'opaque-curtain', kind: 'wall', label: '只阻挡视线',
        points: [{ x: 150, y: 0 }, { x: 150, y: 100 }],
        blocksVision: true, blocksMovement: false, blocksLineOfEffect: false,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
      doors: [], obstacles: [],
      vision: { enabled: true, defaultRangeFeet: 120, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }])
    const druid = character('druid', '德鲁伊', {
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['call-lightning'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const callLightning = fixture(druid, 'call-lightning', 3, token('enemy', 'enemy', 225))
    callLightning.action.dnd5eSpellCast = {
      spellId: 'call-lightning',
      slotLevel: 3,
      targetTokenId: callLightning.action.actorTokenId,
      targetTokenIds: [],
      areaTargetCell: { col: 4, row: 0 },
    }
    expect(prepareDnd5eSpellCast(callLightning)).toEqual({ ok: false, reason: 'spell-target-not-visible' })

    const tentacleWizard = character('tentacle-wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['black-tentacles'] } } } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const blackTentacles = fixture(tentacleWizard, 'black-tentacles', 4, token('enemy', 'enemy', 225))
    blackTentacles.action.dnd5eSpellCast = {
      spellId: 'black-tentacles',
      slotLevel: 4,
      targetTokenId: blackTentacles.action.actorTokenId,
      targetTokenIds: [],
      areaTargetCell: { col: 4, row: 0 },
    }
    expect(prepareDnd5eSpellCast(blackTentacles)).toEqual({ ok: false, reason: 'spell-target-not-visible' })

    const fireballWizard = character('fireball-wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const fireball = fixture(fireballWizard, 'fireball', 3, token('enemy', 'enemy', 225))
    fireball.action.dnd5eSpellCast = {
      spellId: 'fireball',
      slotLevel: 3,
      targetTokenId: fireball.action.actorTokenId,
      targetTokenIds: [],
      areaTargetCell: { col: 4, row: 0 },
    }
    expect(prepareDnd5eSpellCast(fireball).ok).toBe(true)
  })

  it('requires Flaming Sphere to be created in an unoccupied space', () => {
    const druid = character('druid', '德鲁伊', {
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['flaming-sphere'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const occupied = token('enemy', 'enemy', 225)
    const input = fixture(druid, 'flaming-sphere', 2, occupied)
    input.action.dnd5eSpellCast = {
      spellId: 'flaming-sphere', slotLevel: 2, targetTokenId: input.action.actorTokenId,
      targetTokenIds: [], areaTargetCell: { col: 4, row: 0 },
    }
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('casts Spirit Guardians as a selectable-exclusion aura attached to an evil caster', () => {
    const cleric = character('cleric', '牧师', {
      alignment: '守序邪恶',
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['spirit-guardians'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(cleric, 'spirit-guardians', 3, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'spirit-guardians', slotLevel: 3,
      targetTokenId: input.action.actorTokenId, targetTokenIds: [],
      excludedAreaTargetIds: [enemy.id],
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    const area = resolved.application?.map.dnd5ePluginAreas?.[0]
    expect(area).toMatchObject({
      coreSpellId: 'spirit-guardians', anchorMode: 'source-token',
      anchorTokenId: input.action.actorTokenId, relation: 'any', movementCostMultiplier: 2,
      excludedTargetIds: [enemy.id],
      visual: { preset: 'spirit-guardians', intensity: 'normal' },
    })
    expect(area?.triggers?.[0]).toMatchObject({
      savingThrow: { ability: 'wis', dc: 14, onSuccess: 'half' },
      damage: { count: 3, sides: 8, type: 'necrotic' },
    })
  })

  it('casts Spike Growth with difficult terrain and one damage trigger per five feet', () => {
    const druid = character('druid', '德鲁伊', {
      dnd5eClassChoices: { classes: { druid: { selections: { 'spell-prepared': ['spike-growth'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(druid, 'spike-growth', 2, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'spike-growth', slotLevel: 2,
      targetTokenId: input.action.actorTokenId, targetTokenIds: [],
      areaTargetCell: { col: 5, row: 2 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.application?.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'spike-growth', anchorMode: 'fixed', movementCostMultiplier: 2,
      visual: { preset: 'spike-growth', intensity: 'strong' },
      triggers: [{
        timing: 'on-move-distance', oncePerRound: false, movementIntervalFeet: 5,
        damage: { count: 2, sides: 4, type: 'piercing' },
      }],
    })
  })

  it('casts Flaming Sphere as an independent effect token and moves it with a bonus action into an impact', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['flaming-sphere'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    enemy.y = 125
    const input = fixture(wizard, 'flaming-sphere', 3, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'flaming-sphere', slotLevel: 3,
      targetTokenId: input.action.actorTokenId, targetTokenIds: [],
      areaTargetCell: { col: 5, row: 2 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.application) return
    const area = cast.application.map.dnd5ePluginAreas?.[0]
    const effectToken = cast.application.map.tokens.find((candidate) => candidate.dnd5eSpellEffect)
    expect(area).toMatchObject({
      coreSpellId: 'flaming-sphere', anchorMode: 'effect-token', movement: { economy: 'bonus-action', maximumFeet: 30 },
      anchorTokenId: effectToken?.id,
      triggers: [
        { timing: 'on-area-move-impact', damage: { count: 3, sides: 6, type: 'fire' } },
        { timing: 'turn-end', damage: { count: 3, sides: 6, type: 'fire' } },
      ],
    })
    expect(effectToken).toMatchObject({
      x: 275, y: 125, type: 'obstacle', emoji: '🔥',
      dnd5eSpellEffect: { spellId: 'flaming-sphere', sourceTokenId: input.action.actorTokenId },
    })
    if (!area) return
    const moveAction: SharedPlayerActionState = {
      ...input.action,
      id: 'move-flaming-sphere',
      type: 'dnd5e-persistent-area-move',
      dnd5eSpellCast: undefined,
      dnd5ePersistentAreaMove: { areaId: area.id, targetCell: { col: 11, row: 2 } },
    }
    const movePrepared = prepareDnd5eCoreSpellAreaMove({
      action: moveAction,
      map: cast.application.map,
      characters: cast.application.characters,
      initiativeOrder: input.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('flaming-sphere-turn'),
    })
    expect(movePrepared).toEqual(expect.objectContaining({ ok: true }))
    if (!movePrepared.ok) return
    const moved = resolvePreparedDnd5eCoreSpellAreaMove({ prepared: movePrepared.prepared })
    expect(moved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: input.action.actorTokenId, resource: 'bonusAction',
    }))
    expect(moved.application?.map.tokens.find((candidate) => candidate.id === effectToken?.id))
      .toMatchObject({ x: 575, y: 125 })
    expect(collectDnd5ePersistentAreaTriggers({
      map: moved.application!.map,
      timing: 'on-area-move-impact',
      round: 1,
      targetTokenId: enemy.id,
      areaId: area.id,
    })).toMatchObject([{ trigger: { id: 'flaming-sphere-impact' }, targetToken: { id: enemy.id } }])
  })

  it('recasts Flaming Sphere at a higher level by uniquely replacing its area, effect token, and concentration level', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['flaming-sphere'] } } } },
      classResources: {
        'dnd5e-spell-slot-3': { current: 1, max: 1 },
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
      },
    })
    const enemy = token('enemy', 'enemy', 575)
    enemy.y = 125
    const input = fixture(wizard, 'flaming-sphere', 3, enemy)
    input.action.targetTokenId = input.action.actorTokenId
    input.action.targetTokenIds = []
    input.action.targetCell = { col: 5, row: 2 }
    input.action.dnd5eSpellCast = {
      spellId: 'flaming-sphere', slotLevel: 3,
      targetTokenId: input.action.actorTokenId, targetTokenIds: [],
      areaTargetCell: { col: 5, row: 2 },
    }
    const firstPrepared = prepareDnd5eSpellCast(input)
    expect(firstPrepared.ok, firstPrepared.ok ? undefined : firstPrepared.reason).toBe(true)
    if (!firstPrepared.ok) return
    const first = resolvePreparedDnd5eSpellCast({ prepared: firstPrepared.prepared, effectRolls: [] })
    expect(first.result.ok, first.result.ok ? undefined : first.result.reason).toBe(true)
    expect(first.application).toBeDefined()
    if (!first.result.ok || !first.application) return
    const oldArea = first.application.map.dnd5ePluginAreas?.find((area) =>
      area.coreSpellId === 'flaming-sphere')
    const oldEffectToken = first.application.map.tokens.find((candidate) =>
      candidate.dnd5eSpellEffect?.spellId === 'flaming-sphere')
    expect(oldArea).toBeDefined()
    expect(oldEffectToken).toBeDefined()

    const recastAction: SharedPlayerActionState = {
      ...input.action,
      id: 'recast-flaming-sphere',
      round: 2,
      seq: 2,
      targetCell: { col: 8, row: 2 },
      dnd5eSpellCast: {
        spellId: 'flaming-sphere', slotLevel: 4,
        targetTokenId: input.action.actorTokenId, targetTokenIds: [],
        areaTargetCell: { col: 8, row: 2 },
      },
    }
    const recastPrepared = prepareDnd5eSpellCast({
      action: recastAction,
      map: first.application.map,
      characters: first.application.characters,
      initiativeOrder: input.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('flaming-sphere-recast-turn'),
    })
    expect(recastPrepared.ok, recastPrepared.ok ? undefined : recastPrepared.reason).toBe(true)
    if (!recastPrepared.ok) return
    const recast = resolvePreparedDnd5eSpellCast({ prepared: recastPrepared.prepared, effectRolls: [] })
    expect(recast.result.ok, recast.result.ok ? undefined : recast.result.reason).toBe(true)
    expect(recast.application).toBeDefined()
    if (!recast.result.ok || !recast.application) return

    const areas = recast.application.map.dnd5ePluginAreas?.filter((area) =>
      area.coreSpellId === 'flaming-sphere') ?? []
    const effectTokens = recast.application.map.tokens.filter((candidate) =>
      candidate.dnd5eSpellEffect?.spellId === 'flaming-sphere')
    expect(areas).toHaveLength(1)
    expect(effectTokens).toHaveLength(1)
    expect(areas[0]).toMatchObject({
      slotLevel: 4,
      anchorCell: { col: 8, row: 2 },
      anchorTokenId: effectTokens[0].id,
      triggers: [
        { damage: { count: 4, sides: 6, type: 'fire' } },
        { damage: { count: 4, sides: 6, type: 'fire' } },
      ],
    })
    expect(areas[0].id).not.toBe(oldArea?.id)
    expect(effectTokens[0].id).not.toBe(oldEffectToken?.id)
    expect(recast.result.state.combatants[input.action.actorTokenId]).toMatchObject({
      concentrating: true,
      classState: {
        concentrationSpellId: 'flaming-sphere',
        concentrationSpellLevel: 4,
      },
      classResources: {
        'dnd5e-spell-slot-3': { current: 0, max: 1 },
        'dnd5e-spell-slot-4': { current: 0, max: 1 },
      },
    })
  })

  it('rejects a zero-point Mass Heal allocation before settlement', () => {
    const cleric = character('cleric', '牧师', {
      level: 17,
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['mass-heal'] } } } },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const ally = character('ally', '战士', { currentHp: 1, maxHp: 30 })
    const allyToken = token('ally-token', 'player', 75, ally.id)
    const input = fixture(cleric, 'mass-heal', 9, allyToken, [ally])
    input.action.dnd5eSpellCast = {
      spellId: 'mass-heal', slotLevel: 9, targetTokenId: allyToken.id,
      targetTokenIds: [allyToken.id],
      healingAllocations: [{ targetTokenId: allyToken.id, amount: 0 }],
    }
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'invalid-action' })
  })

  it('allows Mass Heal to allocate healing to a hostile living creature', () => {
    const cleric = character('cleric', '牧师', {
      level: 17,
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['mass-heal'] } } } },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const enemy = character('enemy', '敌对战士', { currentHp: 10, maxHp: 30 })
    const enemyToken = token('enemy-token', 'enemy', 75, enemy.id)
    enemyToken.hp = 10
    enemyToken.maxHp = 30
    const input = fixture(cleric, 'mass-heal', 9, enemyToken, [enemy])
    input.action.dnd5eSpellCast = {
      spellId: 'mass-heal', slotLevel: 9, targetTokenId: enemyToken.id,
      targetTokenIds: [enemyToken.id],
      healingAllocations: [{ targetTokenId: enemyToken.id, amount: 20 }],
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === enemy.id)?.currentHp).toBe(30)
    expect(resolved.application?.characters.find((entry) => entry.id === cleric.id)?.classResources?.['dnd5e-spell-slot-9'])
      .toEqual({ current: 0, max: 1 })
  })

  it('does not carry the leveled-spell turn gate between independent exploration casts', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['mass-healing-word'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
      dnd5eCombatState: { leveledSpellTurnKey: 'map-map:1:cleric-token' },
    })
    const ally = character('ally', '战士', { currentHp: 1, maxHp: 30 })
    const allyToken = token('ally-token', 'player', 75, ally.id)
    const input = fixture(cleric, 'mass-healing-word', 3, allyToken, [ally])
    input.action.combatId = undefined
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [4] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)?.currentHp).toBe(8)
  })

  it('does not demand ended-combat periodic-damage dice from an exploration spell cast', () => {
    const ignite = createDnd5eMechanicalEffect({
      id: 'ignite-on-cleric',
      definitionId: 'test:fire-elemental:ignite',
      label: '点燃',
      source: { kind: 'monster', actorId: 'fire-elemental-token', rulesId: 'fire-elemental' },
      targetId: 'cleric-token',
      periodicDamage: {
        timing: 'target-turn-start', count: 1, sides: 10, modifier: 0, type: 'fire',
      },
    })
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['mass-healing-word'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
      dnd5eCombatState: {
        turnStartResolvedTurnKey: 'ended-combat:1:cleric-token',
        activeEffects: [ignite],
      },
    })
    const ally = character('ally', '战士', { currentHp: 1, maxHp: 30 })
    const allyToken = token('ally-token', 'player', 75, ally.id)
    const input = fixture(cleric, 'mass-healing-word', 3, allyToken, [ally])
    input.action.combatId = undefined

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants['cleric-token'].classState.turnStartResolvedTurnKey)
      .toBe('map-map:1:cleric-token')
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [4] })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === cleric.id)?.currentHp).toBe(30)
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)?.currentHp).toBe(8)
  })

  it('rejects a targeted spell when DM geometry blocks its effect line', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(wizard, 'fire-bolt', 0, enemy)
    setMapGeometryRuntime([{
      mapId: input.map.id,
      walls: [{
        id: 'wall', kind: 'wall', label: '法术阻挡墙',
        points: [{ x: 300, y: 0 }, { x: 300, y: 100 }],
        blocksVision: false, blocksMovement: false, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
      doors: [], obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' }, updatedAt: 1,
    }])
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'effect-line-blocked' })
  })

  it('adds half and three-quarters cover to Dexterity saves from the area point of origin', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(wizard, 'fireball', 3, enemy)
    input.action.dnd5eSpellCast!.areaTargetCell = { col: 7, row: 0 }
    setMapGeometryRuntime([{
      mapId: input.map.id, walls: [], doors: [],
      obstacles: [{
        id: 'crate', kind: 'obstacle', label: '木箱', cover: 'half',
        points: [{ x: 400, y: 10 }, { x: 450, y: 10 }, { x: 450, y: 40 }, { x: 400, y: 40 }],
        blocksVision: false, blocksMovement: true, blocksLineOfEffect: false,
        baseHeightFeet: 0, heightFeet: 5, createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' }, updatedAt: 1,
    }])
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.savingThrow?.modifier).toBe(2)
  })

  it('rebuilds area targets on the Host without trusting a stale player target projection', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 2, max: 2 } },
    })
    const inside = token('inside', 'enemy', 125)
    const alsoInside = token('also-inside', 'enemy', 175)
    const outside = token('outside', 'enemy', 575)
    const input = fixture(wizard, 'fireball', 3, inside)
    input.map.tokens.push(alsoInside, outside)
    input.initiativeOrder.push(
      { tokenId: alsoInside.id, label: alsoInside.label, emoji: '', color: '', roll: 6 },
      { tokenId: outside.id, label: outside.label, emoji: '', color: '', roll: 5 },
    )

    input.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: outside.id,
      targetTokenIds: [outside.id], areaTargetCell: { col: 2, row: 0 },
    }
    const rebuilt = prepareDnd5eSpellCast(input)
    expect(rebuilt.ok).toBe(true)
    if (!rebuilt.ok) return
    expect(rebuilt.prepared.targetTokens.map((entry) => entry.id)).toEqual([inside.id, alsoInside.id])
  })

  it('ignores noncombat NPC markers while discovering an area spell target set', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const enemy = token('inside', 'enemy', 125)
    const npcMarker = token('npc-marker', 'npc', 125)
    const input = fixture(wizard, 'fireball', 3, enemy)
    input.map.tokens.push(npcMarker)
    input.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: npcMarker.id,
      targetTokenIds: [npcMarker.id], areaTargetCell: { col: 2, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([enemy.id])
  })

  it('ignores cover bonuses for Sacred Flame Dexterity saves', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-cantrips': ['sacred-flame'] } } } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(cleric, 'sacred-flame', 0, enemy)
    setMapGeometryRuntime([{
      mapId: input.map.id, walls: [], doors: [],
      obstacles: [{
        id: 'crate', kind: 'obstacle', label: '木箱', cover: 'three-quarters',
        points: [{ x: 400, y: 10 }, { x: 450, y: 10 }, { x: 450, y: 40 }, { x: 400, y: 40 }],
        blocksVision: false, blocksMovement: true, blocksLineOfEffect: false,
        baseHeightFeet: 0, heightFeet: 5, createdAt: 1,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' }, updatedAt: 1,
    }])

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.savingThrow?.modifier).toBe(0)
  })

  it('stops forced spell movement at a movement-blocking wall', () => {
    const actor = token('actor', 'player', 25, 'wizard')
    const target = token('target', 'enemy', 75)
    const map: BattleMap = {
      id: 'push-map', name: 'Push', width: 500, height: 200, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actor, target],
    }
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'wall', kind: 'wall', label: '墙', points: [{ x: 100, y: 0 }, { x: 100, y: 100 }],
        blocksVision: false, blocksMovement: true, blocksLineOfEffect: false,
        baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
      }],
      doors: [], obstacles: [],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' }, updatedAt: 1,
    }])
    expect(dnd5eRepellingBlastPushDestination(map, actor, target))
      .toEqual({ to: { x: target.x, y: target.y }, distanceFeet: 0 })
  })

  it('supports long forced pushes while stopping at the first occupied cell', () => {
    const actor = token('actor', 'enemy', 25)
    const target = token('target', 'player', 75, 'hero')
    const blocker = token('blocker', 'player', 275, 'ally')
    const map: BattleMap = {
      id: 'long-push-map', name: 'Long Push', width: 800, height: 200, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actor, target, blocker],
    }

    expect(dnd5eForcedPushDestination(map, actor, target, 60)).toEqual({
      to: { x: 225, y: 25 },
      distanceFeet: 15,
    })
  })

  it('pulls toward the source without overlapping its occupied cell', () => {
    const actor = token('actor', 'enemy', 25)
    const target = token('target', 'player', 325, 'hero')
    const map: BattleMap = {
      id: 'long-pull-map',
      name: 'Long Pull',
      width: 800,
      height: 200,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [actor, target],
    }

    expect(dnd5eForcedPullDestination(map, actor, target, 25)).toEqual({
      to: { x: 75, y: 25 },
      distanceFeet: 25,
    })
  })

  it('truncates a pull at the first wall crossing', () => {
    const actor = token('actor', 'enemy', 25)
    const target = token('target', 'player', 325, 'hero')
    const map: BattleMap = {
      id: 'wall-pull-map',
      name: 'Wall Pull',
      width: 800,
      height: 200,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [actor, target],
    }
    setMapGeometryRuntime([{
      mapId: map.id,
      walls: [{
        id: 'wall',
        kind: 'wall',
        label: 'Wall',
        points: [{ x: 200, y: 0 }, { x: 200, y: 100 }],
        blocksVision: false,
        blocksMovement: true,
        blocksLineOfEffect: false,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
      doors: [],
      obstacles: [],
      vision: {
        enabled: false,
        defaultRangeFeet: 60,
        sharePartyVision: true,
        ambientLight: 'bright',
      },
      updatedAt: 1,
    }])

    expect(dnd5eForcedPullDestination(map, actor, target, 25)).toEqual({
      to: { x: 225, y: 25 },
      distanceFeet: 10,
    })
  })

  it('only resolves forced-movement falling after a grounded token actually leaves a higher terrain region', () => {
    const geometry = {
      ...createEmptyMapGeometry('forced-movement-cliff'),
      obstacles: [{
        id: 'plateau', kind: 'obstacle' as const, label: 'Plateau', cover: 'none' as const,
        points: [{ x: 100, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 100 }, { x: 100, y: 100 }],
        baseHeightFeet: 0, heightFeet: 0, terrainElevationFeet: 40, terrainRegion: true,
        blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, createdAt: 1,
      }],
    }
    const groundedTarget = { ...token('target', 'enemy', 125), elevationFeet: 40 }

    expect(dnd5eForcedMovementFall({
      geometry,
      target: groundedTarget,
      to: { x: 175, y: 25 },
    })).toMatchObject({
      groundedAtSource: true,
      fallDistanceFeet: 0,
      toElevationFeet: undefined,
    })
    expect(dnd5eForcedMovementFall({
      geometry,
      target: groundedTarget,
      to: { x: 75, y: 25 },
    })).toMatchObject({
      groundedAtSource: true,
      fallDistanceFeet: 40,
      toElevationFeet: 0,
    })
    expect(dnd5eForcedMovementFall({
      geometry,
      target: { ...groundedTarget, elevationFeet: 60 },
      to: { x: 75, y: 25 },
    })).toMatchObject({
      groundedAtSource: false,
      fallDistanceFeet: 0,
      toElevationFeet: undefined,
    })
    const flyer = createDnd5eCombatant({
      id: 'grounded-flyer', name: 'Grounded flyer', controller: 'dm', initiative: 10,
      abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 12, currentHp: 10, maxHp: 10, temporaryHp: 0,
      speed: 30, position: { x: 125, y: 25 }, concentrating: false,
      elevationFeet: 40, groundElevationFeet: 40, airborne: false,
      movementSpeeds: { walk: 30, fly: 60 },
    })
    expect(dnd5eForcedMovementFall({
      geometry, target: groundedTarget, targetCombatant: flyer, to: { x: 75, y: 25 },
    })).toMatchObject({
      groundedAtSource: true,
      canRemainAirborne: true,
      landingGroundElevationFeet: 0,
      fallDistanceFeet: 0,
      toElevationFeet: undefined,
    })
  })

  it('casts Sleet Storm through the structured area route without damage or upcast scaling', () => {
    const castAt = (slotLevel: 3 | 4) => {
      const wizard = character(`sleet-wizard-${slotLevel}`, '法师', {
        dnd5eClassChoices: {
          classes: { wizard: { selections: { 'spell-prepared': ['sleet-storm'] } } },
        },
        classResources: {
          [`dnd5e-spell-slot-${slotLevel}`]: { current: 1, max: 1 },
        },
      })
      const enemy = token(`sleet-enemy-${slotLevel}`, 'enemy', 275)
      const input = fixture(wizard, 'sleet-storm', slotLevel, enemy)
      input.action.dnd5eSpellCast = {
        spellId: 'sleet-storm', castingClassId: 'wizard', slotLevel,
        targetTokenId: input.action.actorTokenId, targetTokenIds: [],
        areaTargetCell: { col: 5, row: 0 },
      }
      const prepared = prepareDnd5eSpellCast(input)
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) throw new Error(prepared.reason)
      expect(prepared.prepared.diceCount).toBe(0)
      const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.application?.characters[0]?.classResources?.[`dnd5e-spell-slot-${slotLevel}`]?.current).toBe(0)
      return resolved.application?.map.dnd5ePluginAreas?.find((area) => area.coreSpellId === 'sleet-storm')
    }

    const base = castAt(3)
    const upcast = castAt(4)
    for (const storm of [base, upcast]) {
      expect(storm).toMatchObject({
        coreSpellId: 'sleet-storm', createdRound: 1, expiresAfterRound: 11,
        concentrationId: 'sleet-storm', movementCostMultiplier: 2,
        vertical: { mode: 'volume', heightFeet: 20 },
        obscuration: { kind: 'heavy' },
        triggers: expect.arrayContaining([
          expect.objectContaining({ id: 'sleet-storm-enter', condition: expect.objectContaining({ condition: 'prone' }) }),
          expect.objectContaining({ id: 'sleet-storm-turn-start', condition: expect.objectContaining({ condition: 'prone' }) }),
          expect.objectContaining({
            id: 'sleet-storm-concentration-turn-start',
            endTargetConcentrationOnFailedSave: true,
          }),
        ]),
      })
      expect(storm?.triggers?.some((trigger) => trigger.damage != null)).toBe(false)
    }
    expect(upcast?.cells).toEqual(base?.cells)
  })

  it('charges Twinned Spell by the current spell level and one point for a cantrip', () => {
    expect(dnd5eMetamagicCost('twinned', 0)).toBe(1)
    expect(dnd5eMetamagicCost('twinned', 3)).toBe(3)
    expect(dnd5eMetamagicCost('twinned', 7)).toBe(7)
  })

  it('resolves every Eldritch Blast beam separately with Agonizing and Repelling Blast', () => {
    const warlock = character('warlock', '邪术师', {
      level: 5,
      abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
      dnd5eClassChoices: { classes: { warlock: { subclass: 'fiend', selections: {
        'spell-cantrips': ['eldritch-blast'],
        'eldritch-invocations': ['agonizing-blast', 'repelling-blast'],
      } } } },
    })
    const enemy = token('enemy', 'enemy', 275)
    enemy.elevationFeet = 30
    const input = fixture(warlock, 'eldritch-blast', 0, enemy)
    input.action.dnd5eSpellCast!.projectileTargetIds = [enemy.id, enemy.id]
    input.action.dnd5eSpellCast!.targetTokenIds = [enemy.id]
    input.action.dnd5eSpellCast!.repellingBlast = true
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetSpellAttacks).toHaveLength(2)
    expect(prepared.prepared.effectBonus).toBe(3)
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetAttacks: [
        {
          targetId: enemy.id, d20: 10, effectRolls: [4],
          repellingBlastPushTo: { x: 375, y: 25 }, repellingBlastPushDistanceFeet: 10,
          repellingBlastPushToElevationFeet: 0, repellingBlastFallingDamageRolls: [2, 3, 4],
        },
        {
          targetId: enemy.id, d20: 10, effectRolls: [4],
          repellingBlastPushTo: { x: 475, y: 25 }, repellingBlastPushDistanceFeet: 10,
        },
      ],
      effectRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[enemy.id]).toMatchObject({
      currentHp: 7,
      position: { x: 475, y: 25 },
      elevationFeet: 0,
    })
    expect(resolved.result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(2)
    expect(resolved.result.events.filter((event) => event.type === 'moved')).toHaveLength(2)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'falling-damage-resolved', actorId: enemy.id, distanceFeet: 30, damage: 9,
    }))
  })

  it('resolves every Scorching Ray separately and adds one ray per higher slot', () => {
    const wizard = character('wizard', '法师', {
      level: 5,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['scorching-ray'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 2 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(wizard, 'scorching-ray', 3, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'scorching-ray', slotLevel: 3, targetTokenId: enemy.id,
      targetTokenIds: [enemy.id], projectileTargetIds: [enemy.id, enemy.id, enemy.id, enemy.id],
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ diceCount: 2 })
    expect(prepared.prepared.targetSpellAttacks).toHaveLength(4)

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetAttacks: Array.from({ length: 4 }, () => ({ targetId: enemy.id, d20: 15, effectRolls: [3, 4] })),
      shieldSpellReaction: false,
      uncannyDodge: false,
      effectRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[enemy.id].currentHp).toBe(2)
    expect(resolved.result.state.combatants['wizard-token'].classResources['dnd5e-spell-slot-3'].current).toBe(0)
    expect(resolved.result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(4)
  })

  it('allows Chain Lightning secondary targets outside caster range when they remain within 30 feet of the first target', () => {
    const wizard = character('wizard', '法师', {
      level: 11,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['chain-lightning'] } } } },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const first = token('first', 'enemy', 1475)
    const secondary = token('secondary', 'enemy', 1775)
    const input = fixture(wizard, 'chain-lightning', 6, first)
    input.map.width = 2000
    input.map.tokens.push(secondary)
    input.initiativeOrder.push({ tokenId: secondary.id, label: secondary.label, emoji: '', color: '', roll: 5 })
    input.action.dnd5eSpellCast = {
      spellId: 'chain-lightning', slotLevel: 6, targetTokenId: first.id,
      targetTokenIds: [first.id, secondary.id],
    }

    expect(prepareDnd5eSpellCast(input).ok).toBe(true)
  })

  it('blocks spellcasting in Wild Shape before Beast Spells and unlocks it at Druid level 18', () => {
    const enemy = token('enemy', 'enemy', 275)
    const shaped = character('druid', '德鲁伊', {
      level: 17,
      dnd5eClassChoices: { classes: { druid: { subclass: 'land', selections: { 'spell-cantrips': ['produce-flame'] } } } },
      dnd5eCombatState: { wildShapeFormId: 'srd-5.1:wolf' },
    })
    expect(prepareDnd5eSpellCast(fixture(shaped, 'produce-flame', 0, enemy))).toEqual({
      ok: false, reason: 'wild-shape-spellcasting-unavailable',
    })
    const beastSpellsInput = fixture({ ...shaped, level: 18 }, 'produce-flame', 0, enemy)
    beastSpellsInput.action.targetTokenId = 'druid-token'
    beastSpellsInput.action.dnd5eSpellCast!.targetTokenId = 'druid-token'
    expect(prepareDnd5eSpellCast(beastSpellsInput).ok).toBe(true)
  })

  it('separates Bard Magical Secrets from ordinary spells known and casts an off-list secret through Headless', () => {
    const bard = character('bard', '吟游诗人', {
      level: 10,
      dnd5eClassChoices: { classes: { bard: { selections: {
        'spell-known': ['healing-word'],
        'magical-secrets': ['fireball', 'eldritch-blast'],
      } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 3 } },
    })
    expect(dnd5eCombatSpellSelectionLimits(bard).spells).toBe(12)
    expect(dnd5eBardMagicalSecretSpellIds(bard)).toEqual(['fireball', 'eldritch-blast'])
    const enemy = token('enemy', 'enemy', 575)
    expect(prepareDnd5eSpellCast(fixture(bard, 'fireball', 3, enemy)).ok).toBe(true)
  })

  it('only accepts Lore Additional Magical Secrets and spell levels actually unlocked by the Bard', () => {
    const base = character('bard', '吟游诗人', {
      level: 6,
      dnd5eClassChoices: { classes: { bard: { selections: {
        'lore-additional-magical-secrets': ['fireball'],
        'magical-secrets': ['power-word-kill'],
      } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 3 } },
    })
    expect(dnd5eBardMagicalSecretSpellIds(base)).toEqual([])
    const lore = {
      ...base,
      dnd5eClassChoices: { classes: { bard: {
        subclass: 'lore',
        selections: base.dnd5eClassChoices?.classes?.bard?.selections,
      } } },
    } satisfies Character
    expect(dnd5eBardMagicalSecretSpellIds(lore)).toEqual(['fireball'])
    const enemy = token('enemy', 'enemy', 575)
    expect(prepareDnd5eSpellCast(fixture(lore, 'fireball', 3, enemy)).ok).toBe(true)
    expect(prepareDnd5eSpellCast(fixture(lore, 'power-word-kill', 9, enemy))).toEqual({ ok: false, reason: 'spell-not-known-or-prepared' })
  })

  it('casts a level-five Fire Bolt as a two-die spell attack without spending a slot', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'fire-bolt', 0, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ diceCount: 2, effectBonus: 0, attackMode: 'normal' })
    expect(previewDnd5eSpellAttack(prepared.prepared, 15).hit).toBe(true)
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, d20: 15, effectRolls: [6, 7] })
    expect(resolved.result.ok ? 'ok' : resolved.result.reason).toBe('ok')
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(17)
    expect(resolved.result.events).toContainEqual({ type: 'spell-cast', actorId: 'wizard-token', targetId: enemy.id, spellId: 'fire-bolt', slotLevel: 0 })
  })

  it('applies one Cutting Words roll to shared area-spell damage before each target defense', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 2 } },
    })
    const bard = character('bard', '吟游诗人', {
      level: 5,
      dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: {} } } },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    })
    const first = token('first', 'enemy', 575)
    const second = token('second', 'enemy', 625)
    const bardToken = token('bard-token', 'enemy', 275, bard.id)
    const input = fixture(wizard, 'fireball', 3, first, [bard])
    input.map.tokens.push(second, bardToken)
    input.initiativeOrder.push(
      { tokenId: second.id, label: second.label, emoji: '', color: '', roll: 5 },
      { tokenId: bardToken.id, label: bardToken.label, emoji: '', color: '', roll: 4 },
    )
    input.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: first.id,
      targetTokenIds: [first.id, second.id], areaTargetCell: { col: 11, row: 0 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [
        { targetId: first.id, d20: 1 },
        { targetId: second.id, d20: 1 },
      ],
      cuttingWordsDamage: { bardId: bardToken.id, roll: 3, distanceFeet: 50 },
      effectRolls: Array.from({ length: 8 }, () => 4),
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === first.id)?.hp).toBe(1)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === second.id)?.hp).toBe(1)
    expect(resolved.application?.characters.find((entry) => entry.id === bard.id)?.classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 3 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-saving-throw-damage-resolved',
      spellId: 'fireball',
      damageBeforeSavingThrow: 29,
      components: [expect.objectContaining({
        damageType: 'fire',
        roll: {
          sides: 6,
          rolls: [4, 4, 4, 4, 4, 4, 4, 4],
          bonus: 0,
          total: 32,
        },
      })],
    }))
  })

  it('applies one shared Burning Hands damage roll at full or half damage for each area save', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['burning-hands'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 2 } },
    })
    const failedSaveTarget = token('failed-save-target', 'enemy', 75)
    const successfulSaveTarget = token('successful-save-target', 'enemy', 125)
    const input = fixture(wizard, 'burning-hands', 1, failedSaveTarget)
    input.map.tokens.push(successfulSaveTarget)
    input.initiativeOrder.push({
      tokenId: successfulSaveTarget.id,
      label: successfulSaveTarget.label,
      emoji: '',
      color: '',
      roll: 5,
    })
    input.action.dnd5eSpellCast = {
      spellId: 'burning-hands',
      slotLevel: 1,
      targetTokenId: failedSaveTarget.id,
      targetTokenIds: [failedSaveTarget.id, successfulSaveTarget.id],
      areaTargetCell: { col: 2, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.spell.damageOnSuccessfulSave).toBe('half')
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([
      failedSaveTarget.id,
      successfulSaveTarget.id,
    ])

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [
        { targetId: failedSaveTarget.id, d20: 1 },
        { targetId: successfulSaveTarget.id, d20: 20 },
      ],
      effectRolls: [6, 5, 4],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === failedSaveTarget.id)?.hp).toBe(15)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === successfulSaveTarget.id)?.hp).toBe(23)
    expect(resolved.result.events.filter((event) => event.type === 'damage-applied')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetId: failedSaveTarget.id, amount: 15 }),
        expect.objectContaining({ targetId: successfulSaveTarget.id, amount: 7 }),
      ]),
    )
  })

  it('ignores defeated enemies and character corpses when the Host discovers Burning Hands area targets', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['burning-hands'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 2 } },
    })
    const defeatedTarget = { ...token('defeated-target', 'enemy', 75), hp: 0 }
    const deadAlly = character('dead-ally', '法师', {
      currentHp: 0,
      dnd5eCombatState: { schemaVersion: 2, deathRound: 1, bodyPresent: true },
    })
    const deadAllyToken = { ...token('dead-ally-token', 'player', 75, deadAlly.id), hp: 0 }
    const livingTarget = token('living-target', 'enemy', 125)
    const input = fixture(wizard, 'burning-hands', 1, defeatedTarget, [deadAlly])
    input.map.tokens.push(deadAllyToken, livingTarget)
    input.initiativeOrder.push({
      tokenId: livingTarget.id,
      label: livingTarget.label,
      emoji: '',
      color: '',
      roll: 5,
    })
    input.action.dnd5eSpellCast = {
      spellId: 'burning-hands',
      slotLevel: 1,
      targetTokenId: input.action.actorTokenId,
      targetTokenIds: [],
      areaTargetCell: { col: 2, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([livingTarget.id])

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [6, 5, 4],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === defeatedTarget.id)?.hp).toBe(0)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === deadAllyToken.id)?.hp).toBe(0)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === livingTarget.id)?.hp).toBe(15)
  })

  it('uses a declared elevation to pitch Burning Hands above a ground creature', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['burning-hands'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 2 } },
    })
    const airborneTarget = {
      ...token('airborne-target', 'enemy', 75),
      elevationFeet: 10,
    }
    const groundedTarget = token('grounded-target', 'enemy', 75)
    const input = fixture(wizard, 'burning-hands', 1, airborneTarget)
    input.map.tokens.push(groundedTarget)
    input.initiativeOrder.push({
      tokenId: groundedTarget.id,
      label: groundedTarget.label,
      emoji: '',
      color: '',
      roll: 5,
    })
    input.action.targetTokenId = airborneTarget.id
    input.action.targetTokenIds = [airborneTarget.id]
    input.action.targetElevationFeet = 60
    input.action.dnd5eSpellCast = {
      spellId: 'burning-hands',
      slotLevel: 1,
      targetTokenId: airborneTarget.id,
      targetTokenIds: [airborneTarget.id],
      areaTargetCell: { col: 3, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([
      airborneTarget.id,
    ])
  })

  it('records Burning Hands save reduction before a Barbed Devil fire immunity negates it', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['burning-hands'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 2 } },
    })
    const barbedDevil: Token = {
      ...token('barbed-devil', 'enemy', 125),
      poolId: 'srd-5.1:barbed-devil',
      hp: 110,
      maxHp: 110,
    }
    const input = fixture(wizard, 'burning-hands', 1, barbedDevil)
    input.action.dnd5eSpellCast = {
      spellId: 'burning-hands',
      slotLevel: 1,
      targetTokenId: barbedDevil.id,
      targetTokenIds: [barbedDevil.id],
      areaTargetCell: { col: 2, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[barbedDevil.id].damageImmunities).toContain('fire')

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 20,
      savingThrowD20Second: 20,
      effectRolls: [6, 5, 4],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === barbedDevil.id)?.hp).toBe(110)
    expect(resolved.result.events).toContainEqual({
      type: 'spell-saving-throw-damage-resolved',
      actorId: 'wizard-token',
      targetId: barbedDevil.id,
      spellId: 'burning-hands',
      ability: 'dex',
      saveSucceeded: true,
      successfulSave: 'half',
      damageBeforeSavingThrow: 15,
      damageAfterSavingThrow: 7,
      finalDamage: 0,
      components: [{
        damageType: 'fire',
        roll: {
          sides: 6,
          rolls: [6, 5, 4],
          bonus: 0,
          total: 15,
        },
        damageBeforeSavingThrow: 15,
        damageAfterSavingThrow: 7,
        finalDamage: 0,
        defenses: [{
          kind: 'immune',
          multiplier: 0,
          damageBefore: 7,
          damageAfter: 0,
          reasons: ['static:immune:fire'],
        }],
      }],
    })
    expect(resolved.result.events.some((event) =>
      event.type === 'damage-applied' && event.targetId === barbedDevil.id)).toBe(false)
  })

  it('applies Burning Hands save reduction before fire vulnerability', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['burning-hands'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 2 } },
    })
    const mummy: Token = {
      ...token('mummy', 'enemy', 125),
      poolId: 'srd-5.1:mummy',
      hp: 58,
      maxHp: 58,
    }
    const input = fixture(wizard, 'burning-hands', 1, mummy)
    input.action.dnd5eSpellCast = {
      spellId: 'burning-hands',
      slotLevel: 1,
      targetTokenId: mummy.id,
      targetTokenIds: [mummy.id],
      areaTargetCell: { col: 2, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[mummy.id].damageVulnerabilities).toContain('fire')

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 20,
      effectRolls: [6, 5, 4],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === mummy.id)?.hp).toBe(44)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-saving-throw-damage-resolved',
      targetId: mummy.id,
      damageBeforeSavingThrow: 15,
      damageAfterSavingThrow: 7,
      finalDamage: 14,
      components: [expect.objectContaining({
        damageType: 'fire',
        damageAfterSavingThrow: 7,
        finalDamage: 14,
        defenses: [expect.objectContaining({
          kind: 'vulnerable',
          damageBefore: 7,
          damageAfter: 14,
        })],
      })],
    }))
  })

  it('resolves Flame Strike as one mixed fire-and-radiant damage event', () => {
    const cleric = character('cleric', '牧师', {
      level: 9,
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['flame-strike'] } } } },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(cleric, 'flame-strike', 5, enemy)
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.damageDiceCounts).toEqual([4, 4])
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [1, 2, 3, 4],
      additionalEffectRolls: [[4, 3, 2, 1]],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(10)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', targetId: enemy.id, amount: 20,
    }))
  })

  it('prepares Ice Storm from the selected map area and resolves both damage pools', () => {
    const wizard = character('wizard', '法师', {
      level: 7,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['ice-storm'] } } } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const first = token('first', 'enemy', 125)
    const second = token('second', 'enemy', 175)
    const input = fixture(wizard, 'ice-storm', 4, first)
    input.map.tokens.push(second)
    input.initiativeOrder.push({
      tokenId: second.id,
      label: second.label,
      emoji: '',
      color: '',
      roll: 5,
    })
    input.action.dnd5eSpellCast = {
      spellId: 'ice-storm',
      slotLevel: 4,
      targetTokenId: first.id,
      targetTokenIds: [first.id],
      areaTargetCell: { col: 2, row: 0 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([
      input.action.actorTokenId,
      first.id,
      second.id,
    ])
    expect(prepared.prepared.damageDiceCounts).toEqual([2, 4])

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [
        { targetId: input.action.actorTokenId, d20: 20 },
        { targetId: first.id, d20: 1 },
        { targetId: second.id, d20: 20 },
      ],
      effectRolls: [8, 8],
      additionalEffectRolls: [[1, 1, 1, 1]],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === first.id)?.hp).toBe(10)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === second.id)?.hp).toBe(20)
    const iceStormArea = resolved.application?.map.dnd5ePluginAreas?.find(
      (area) => area.coreSpellId === 'ice-storm',
    )
    expect(iceStormArea).toMatchObject({
      sourceKind: 'core-spell',
      movementCostMultiplier: 2,
      createdRound: 1,
      expiresAfterRound: 2,
      expiresAtSourceTurnEndAfterRound: 2,
      concentrationId: undefined,
    })
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map: resolved.application!.map,
      token: resolved.application!.map.tokens.find((entry) => entry.id === first.id)!,
      position: first,
    })).toBe(2)
  })

  it('keeps only the explicitly chosen Slow targets and rejects choices outside the Host area', () => {
    const wizard = character('wizard', '法师', {
      level: 5,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['slow'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 2, max: 2 } },
    })
    const first = token('first', 'enemy', 125)
    const second = token('second', 'enemy', 175)
    const outside = token('outside', 'enemy', 875)
    const input = fixture(wizard, 'slow', 3, first)
    input.map.tokens.push(second, outside)
    input.initiativeOrder.push(
      { tokenId: second.id, label: second.label, emoji: '', color: '', roll: 5 },
      { tokenId: outside.id, label: outside.label, emoji: '', color: '', roll: 4 },
    )
    input.action.dnd5eSpellCast = {
      spellId: 'slow',
      slotLevel: 3,
      targetTokenId: second.id,
      targetTokenIds: [second.id],
      areaTargetCell: { col: 3, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([second.id])

    input.action.dnd5eSpellCast = {
      ...input.action.dnd5eSpellCast,
      targetTokenId: outside.id,
      targetTokenIds: [outside.id],
    }
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('requires and validates Flame Strike higher-slot damage-type allocation', () => {
    const cleric = character('cleric', '牧师', {
      level: 11,
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['flame-strike'] } } } },
      classResources: { 'dnd5e-spell-slot-6': { current: 2, max: 2 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const missingChoice = fixture(cleric, 'flame-strike', 6, enemy)
    expect(prepareDnd5eSpellCast(missingChoice)).toEqual({ ok: false, reason: 'spell-option-required' })

    const input = fixture(cleric, 'flame-strike', 6, enemy)
    input.action.dnd5eSpellCast!.higherSlotDamageType = 'radiant'
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.damageDiceCounts).toEqual([4, 5])
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 20,
      effectRolls: [1, 1, 1, 1],
      additionalEffectRolls: [[1, 1, 1, 1, 1]],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(26)
  })

  it('queues Acid Arrow follow-up damage and resolves it at the target next turn end', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['acid-arrow'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'acid-arrow', 2, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ diceCount: 4, delayedDamageDiceCount: 2 })
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 15,
      effectRolls: [4, 4, 4, 4],
      delayedEffectRolls: [3, 3],
    })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[enemy.id].currentHp).toBe(14)
    expect(cast.result.state.combatants[enemy.id].classState.activeEffects).toEqual([
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:acid-arrow:delayed-damage',
        potency: 6,
      }),
    ])
    const casterEnded = resolveDnd5eHeadlessAction(cast.result.state, { type: 'end-turn', actorId: 'wizard-token' })
    expect(casterEnded.ok).toBe(true)
    const targetEnded = resolveDnd5eHeadlessAction(casterEnded.state, { type: 'end-turn', actorId: enemy.id })
    expect(targetEnded.ok).toBe(true)
    expect(targetEnded.state.combatants[enemy.id].currentHp).toBe(8)
    expect(targetEnded.state.combatants[enemy.id].classState.activeEffects).toBeUndefined()
    expect(targetEnded.events).toContainEqual({
      type: 'delayed-spell-damage-triggered',
      sourceId: 'wizard-token',
      targetId: enemy.id,
      spellId: 'acid-arrow',
      amount: 6,
    })
  })

  it('deals half initial Acid Arrow damage on a miss without queuing follow-up damage', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['acid-arrow'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'acid-arrow', 2, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 1,
      effectRolls: [4, 4, 4, 4],
      delayedEffectRolls: [],
    })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    expect(cast.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(22)
    expect(cast.result.state.combatants[enemy.id].classState.activeEffects).toBeUndefined()
  })

  it('maximizes both Acid Arrow damage timings with Overchannel', () => {
    const wizard = character('wizard', '法师', {
      level: 14,
      dnd5eClassChoices: { classes: { wizard: { subclass: 'evocation', selections: { 'spell-prepared': ['acid-arrow'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(wizard, 'acid-arrow', 2, enemy)
    input.action.dnd5eSpellCast!.overchannel = true
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 15,
      effectRolls: [],
      delayedEffectRolls: [],
    })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[enemy.id].currentHp).toBe(11)
    expect(cast.result.state.combatants[enemy.id].classState.activeEffects).toEqual([
      expect.objectContaining({ potency: 8 }),
    ])
    const casterEnded = resolveDnd5eHeadlessAction(cast.result.state, { type: 'end-turn', actorId: 'wizard-token' })
    expect(casterEnded.ok).toBe(true)
    const targetEnded = resolveDnd5eHeadlessAction(casterEnded.state, { type: 'end-turn', actorId: enemy.id })
    expect(targetEnded.ok).toBe(true)
    expect(targetEnded.state.combatants[enemy.id].currentHp).toBe(3)
  })

  it('upcasts Magic Missile, consumes the selected slot, and applies all darts to the chosen target', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['magic-missile'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 2, max: 3 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(wizard, 'magic-missile', 2, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'magic-missile', slotLevel: 2, targetTokenId: enemy.id,
      targetTokenIds: [enemy.id], projectileTargetIds: [enemy.id, enemy.id, enemy.id, enemy.id],
      areaTargetCells: [],
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ diceCount: 4, effectBonus: 4 })
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [1, 2, 3, 4] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(16)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-spell-slot-2']).toEqual({ current: 1, max: 3 })
  })

  it('casts the selected second-level Spell Mastery spell without a spell slot', () => {
    const wizard = character('wizard', '法师', {
      level: 18,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-mastery-2': ['shatter'] } } } },
      classResources: {},
    })
    const enemy = token('enemy', 'enemy', 575)
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'shatter', 2, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [8, 7, 6],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(9)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-spell-slot-2']).toBeUndefined()
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'wizard-token', stateKey: 'spell-mastery', active: true,
    }))
  })

  it('spends the matching Signature Spell use before requiring a third-level spell slot', () => {
    const wizard = character('wizard', '法师', {
      level: 20,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'signature-spells': ['fireball', 'lightning-bolt'] } } } },
      classResources: {
        'dnd5e-signature-spell-1': { current: 1, max: 1 },
        'dnd5e-signature-spell-2': { current: 1, max: 1 },
      },
    })
    const enemy = token('enemy', 'enemy', 575)
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'fireball', 3, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [6, 6, 6, 6, 6, 6, 6, 6],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources).toMatchObject({
      'dnd5e-signature-spell-1': { current: 0, max: 1 },
      'dnd5e-signature-spell-2': { current: 1, max: 1 },
    })
    expect(resolved.application?.characters[0].classResources?.['dnd5e-spell-slot-3']).toBeUndefined()
  })

  it('lets an Evocation Wizard sculpt selected creatures out of an area spell', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { subclass: 'evocation', selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 2 } },
    })
    const ally = character('ally', '战士')
    const enemy = token('enemy', 'enemy', 125)
    const allyToken = token('ally-token', 'player', 175, ally.id)
    const input = fixture(wizard, 'fireball', 3, enemy, [ally])
    input.map.tokens.push(allyToken)
    input.initiativeOrder.push({ tokenId: allyToken.id, label: allyToken.label, emoji: '', color: '', roll: 5 })
    input.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: enemy.id,
      targetTokenIds: [enemy.id, allyToken.id], sculptedTargetIds: [allyToken.id], areaTargetCell: { col: 2, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.sculptedTargetIds).toEqual([allyToken.id])
    expect(prepared.prepared.targetSavingThrows?.map((save) => save.targetToken.id)).toEqual([enemy.id])

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [{ targetId: enemy.id, d20: 1 }],
      effectRolls: [1, 1, 1, 1, 1, 1, 1, 1],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(22)
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)?.currentHp).toBe(30)
    expect(resolved.result.events).toContainEqual({
      type: 'spell-sculpted', actorId: 'wizard-token', targetId: allyToken.id, spellId: 'fireball',
    })
    expect(resolved.result.events.some((event) =>
      event.type === 'saving-throw-resolved' && event.targetId === allyToken.id,
    )).toBe(false)
  })

  it('retains Sculpt Spells and Overchannel when a Wizard class cast uses a held arcane focus', () => {
    const baseWizard = character('focus-wizard', '法师', {
      level: 14,
      maxHp: 60,
      currentHp: 60,
      dnd5eClassLevels: { wizard: 14 },
      dnd5eClassChoices: {
        classes: {
          wizard: {
            subclass: 'evocation',
            selections: { 'spell-prepared': ['fireball'] },
          },
        },
      },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 3 } },
    })
    const granted = applyDnd5eInventoryMutation([baseWizard], {
      type: 'grant',
      characterId: baseWizard.id,
      templateId: 'srd-5.1:item:arcane-focus',
      quantity: 1,
    })
    expect(granted.ok).toBe(true)
    const focus = normalizeDnd5eInventory(granted.characters[0]).entries.find(
      (entry) => entry.templateId === 'srd-5.1:item:arcane-focus',
    )
    expect(focus).toBeDefined()
    if (!focus) return
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip',
      characterId: baseWizard.id,
      instanceId: focus.instanceId,
      slot: 'offHand',
    })
    expect(equipped.ok).toBe(true)
    const wizard = equipped.characters[0]
    const options = resolveDnd5eSpellModifierIntents({
      character: wizard,
      castingClassId: 'wizard',
      spellId: 'fireball',
      slotLevel: 3,
      modifierIds: ['evocation-sculpt-spells', 'evocation-overchannel'],
    })
    expect(options).toMatchObject({
      ok: true,
      options: { sculptSpell: true, overchannel: true },
    })
    if (!options.ok) return

    const ally = character('focus-ally', '战士')
    const enemy = { ...token('focus-enemy', 'enemy', 125), hp: 100, maxHp: 100 }
    const allyToken = token('focus-ally-token', 'player', 175, ally.id)
    const input = fixture(wizard, 'fireball', 3, enemy, [ally])
    input.map.tokens.push(allyToken)
    input.initiativeOrder.push({ tokenId: allyToken.id, label: allyToken.label, emoji: '', color: '', roll: 5 })
    input.action.dnd5eSpellCast = {
      spellId: 'fireball',
      focusItemInstanceId: focus.instanceId,
      castingClassId: 'wizard',
      slotLevel: 3,
      targetTokenId: enemy.id,
      targetTokenIds: [enemy.id, allyToken.id],
      areaTargetCell: { col: 2, row: 0 },
      overchannel: options.options.overchannel,
      sculptedTargetIds: [allyToken.id],
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      castingClassId: 'wizard',
      focusItemInstanceId: focus.instanceId,
      itemSpellSource: undefined,
      overchannel: true,
      sculptedTargetIds: [allyToken.id],
    })
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [{ targetId: enemy.id, d20: 1 }],
      effectRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(49)
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)?.currentHp).toBe(30)
    expect(resolved.application?.characters.find((entry) => entry.id === wizard.id)?.classResources?.['dnd5e-spell-slot-3'].current).toBe(0)

    input.action.dnd5eSpellCast.focusItemInstanceId = 'forged-or-unheld-focus'
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'component-unavailable' })
  })

  it('rejects forged Sculpt Spells choices in both the map bridge and Headless authority', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 2 } },
    })
    const ally = character('ally', '战士')
    const enemy = token('enemy', 'enemy', 125)
    const allyToken = token('ally-token', 'player', 175, ally.id)
    const forgedInput = fixture(wizard, 'fireball', 3, enemy, [ally])
    forgedInput.map.tokens.push(allyToken)
    forgedInput.initiativeOrder.push({ tokenId: allyToken.id, label: allyToken.label, emoji: '', color: '', roll: 5 })
    forgedInput.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: enemy.id,
      targetTokenIds: [enemy.id, allyToken.id], sculptedTargetIds: [allyToken.id], areaTargetCell: { col: 2, row: 0 },
    }
    expect(prepareDnd5eSpellCast(forgedInput)).toEqual({ ok: false, reason: 'invalid-target' })

    forgedInput.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: enemy.id,
      targetTokenIds: [enemy.id, allyToken.id], areaTargetCell: { col: 2, row: 0 },
    }
    const prepared = prepareDnd5eSpellCast(forgedInput)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const forgedHeadless = resolveDnd5eHeadlessAction(prepared.prepared.state, {
      type: 'cast-spell', actorId: 'wizard-token', targetId: enemy.id,
      targetIds: [enemy.id, allyToken.id], sculptedTargetIds: [allyToken.id],
      spellId: 'fireball', slotLevel: 3,
      targetSavingThrows: [{ targetId: enemy.id, d20: 1 }],
      effectRolls: [1, 1, 1, 1, 1, 1, 1, 1],
    })
    expect(forgedHeadless).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('applies Careful Spell as an automatic success, not Sculpt Spells immunity', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-known': ['fireball'], metamagic: ['careful'],
      } } } },
      classResources: {
        'dnd5e-spell-slot-3': { current: 1, max: 2 },
        'dnd5e-sorcery-points': { current: 5, max: 5 },
      },
    })
    const ally = character('ally', '战士')
    const enemy = token('enemy', 'enemy', 125)
    const allyToken = token('ally-token', 'player', 175, ally.id)
    const input = fixture(sorcerer, 'fireball', 3, enemy, [ally])
    input.map.tokens.push(allyToken)
    input.initiativeOrder.push({ tokenId: allyToken.id, label: allyToken.label, emoji: '', color: '', roll: 5 })
    input.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: enemy.id,
      targetTokenIds: [enemy.id, allyToken.id],
      areaTargetCell: { col: 2, row: 0 },
      metamagic: { kind: 'careful', carefulTargetIds: [allyToken.id] },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetSavingThrows?.map((save) => save.targetToken.id)).toEqual([enemy.id])
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [{ targetId: enemy.id, d20: 1 }],
      effectRolls: [1, 1, 1, 1, 1, 1, 1, 1],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(22)
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)?.currentHp).toBe(26)
    expect(resolved.application?.characters.find((entry) => entry.id === sorcerer.id)?.classResources?.['dnd5e-sorcery-points']).toEqual({ current: 4, max: 5 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'metamagic-applied', actorId: 'sorcerer-token', targetId: allyToken.id, kind: 'careful',
    }))
  })

  it('uses Quickened Spell to spend a bonus action while preserving the action', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-cantrips': ['fire-bolt'], metamagic: ['quickened'],
      } } } },
      classResources: { 'dnd5e-sorcery-points': { current: 2, max: 5 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(sorcerer, 'fire-bolt', 0, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt', slotLevel: 0, targetTokenId: enemy.id,
      metamagic: { kind: 'quickened' },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared, d20: 15, effectRolls: [6, 7],
    })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants['sorcerer-token'].turn).toMatchObject({
      actionAvailable: true, bonusActionAvailable: false,
    })
    expect(resolved.application?.characters[0].classResources?.['dnd5e-sorcery-points']).toEqual({ current: 0, max: 5 })
  })

  it('doubles spell range with Distant Spell and rejects the same cast without it', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-cantrips': ['fire-bolt'], metamagic: ['distant'],
      } } } },
      classResources: { 'dnd5e-sorcery-points': { current: 1, max: 5 } },
    })
    const enemy = token('enemy', 'enemy', 1525)
    const input = fixture(sorcerer, 'fire-bolt', 0, enemy)
    input.map.width = 2000
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'target-out-of-range' })
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt', slotLevel: 0, targetTokenId: enemy.id,
      metamagic: { kind: 'distant' },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared, d20: 15, effectRolls: [5, 5],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-sorcery-points']).toEqual({ current: 0, max: 5 })
  })

  it('records Subtle Spell and spends one sorcery point through Headless', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-cantrips': ['fire-bolt'], metamagic: ['subtle'],
      } } } },
      classResources: { 'dnd5e-sorcery-points': { current: 1, max: 5 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(sorcerer, 'fire-bolt', 0, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt', slotLevel: 0, targetTokenId: enemy.id,
      metamagic: { kind: 'subtle' },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared, d20: 15, effectRolls: [5, 5],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-sorcery-points']).toEqual({ current: 0, max: 5 })
    expect(resolved.result.events).toContainEqual({
      type: 'metamagic-applied', actorId: 'sorcerer-token', spellId: 'fire-bolt', kind: 'subtle',
    })
  })

  it('resolves Twinned Spell attacks with independent attack and damage rolls', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-cantrips': ['fire-bolt'], metamagic: ['twinned'],
      } } } },
      classResources: { 'dnd5e-sorcery-points': { current: 1, max: 5 } },
    })
    const bard = character('bard', '吟游诗人', {
      level: 5,
      dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: {} } } },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    })
    const first = token('first', 'enemy', 575)
    const second = token('second', 'enemy', 625)
    const bardToken = token('bard-token', 'enemy', 525, bard.id)
    const input = fixture(sorcerer, 'fire-bolt', 0, first, [bard])
    input.map.tokens.push(second, bardToken)
    input.initiativeOrder.push(
      { tokenId: second.id, label: second.label, emoji: '', color: '', roll: 5 },
      { tokenId: bardToken.id, label: bardToken.label, emoji: '', color: '', roll: 4 },
    )
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt', slotLevel: 0, targetTokenId: first.id,
      targetTokenIds: [first.id, second.id], metamagic: { kind: 'twinned' },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetSpellAttacks?.map((attack) => attack.targetToken.id)).toEqual([first.id, second.id])
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetAttacks: [
        {
          targetId: first.id, d20: 15, effectRolls: [6, 7],
          cuttingWordsDamage: { bardId: bardToken.id, roll: 3, distanceFeet: 50 },
        },
        { targetId: second.id, d20: 1, effectRolls: [] },
      ],
      effectRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === first.id)?.hp).toBe(20)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === second.id)?.hp).toBe(30)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-sorcery-points']).toEqual({ current: 0, max: 5 })
    expect(resolved.application?.characters.find((entry) => entry.id === bard.id)?.classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 3 })
    expect(resolved.result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(2)

    expect(resolveDnd5eHeadlessAction(prepared.prepared.state, {
      type: 'cast-spell', actorId: 'sorcerer-token', targetId: first.id, targetIds: [first.id],
      spellId: 'fire-bolt', slotLevel: 0, metamagic: { kind: 'twinned' },
      targetAttacks: [{ targetId: first.id, d20: 15, effectRolls: [6, 7] }], effectRolls: [],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('resolves Twinned Spell saving throws independently and rejects non-single-target spells', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-cantrips': ['poison-spray'], 'spell-known': ['fireball'], metamagic: ['twinned'],
      } } } },
      classResources: {
        'dnd5e-sorcery-points': { current: 4, max: 5 },
        'dnd5e-spell-slot-3': { current: 1, max: 2 },
      },
    })
    const first = token('first', 'enemy', 75)
    const second = token('second', 'enemy', 125)
    const input = fixture(sorcerer, 'poison-spray', 0, first)
    input.map.tokens.push(second)
    input.initiativeOrder.push({ tokenId: second.id, label: second.label, emoji: '', color: '', roll: 5 })
    input.action.dnd5eSpellCast = {
      spellId: 'poison-spray', slotLevel: 0, targetTokenId: first.id,
      targetTokenIds: [first.id, second.id], metamagic: { kind: 'twinned' },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [
        { targetId: first.id, d20: 1 },
        { targetId: second.id, d20: 20 },
      ],
      effectRolls: [12, 8],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === first.id)?.hp).toBe(10)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === second.id)?.hp).toBe(30)

    const fireball = fixture(sorcerer, 'fireball', 3, first)
    fireball.map.tokens.push(second)
    fireball.initiativeOrder.push({ tokenId: second.id, label: second.label, emoji: '', color: '', roll: 5 })
    fireball.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: first.id,
      targetTokenIds: [first.id, second.id], metamagic: { kind: 'twinned' },
    }
    expect(prepareDnd5eSpellCast(fireball)).toEqual({ ok: false, reason: 'invalid-action' })
  })

  it('uses Empowered Spell after the damage roll and can combine it with another Metamagic option', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-known': ['fireball'], metamagic: ['empowered', 'quickened'],
      } } } },
      classResources: {
        'dnd5e-spell-slot-3': { current: 1, max: 2 },
        'dnd5e-sorcery-points': { current: 3, max: 5 },
      },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(sorcerer, 'fireball', 3, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: enemy.id,
      metamagic: { kind: 'quickened' }, empowered: true, areaTargetCell: { col: 11, row: 0 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [1, 1, 1, 1, 1, 1, 1, 1],
      empoweredRerolls: [
        { group: 'effect', dieIndex: 0, reroll: 4 },
        { group: 'effect', dieIndex: 1, reroll: 5 },
        { group: 'effect', dieIndex: 2, reroll: 6 },
      ],
    })
    expect(resolved.result.ok ? 'ok' : resolved.result.reason).toBe('ok')
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(10)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-sorcery-points']).toEqual({ current: 0, max: 5 })
    expect(resolved.result.events).toContainEqual({
      type: 'metamagic-applied', actorId: 'sorcerer-token', spellId: 'fireball', kind: 'quickened',
    })
    expect(resolved.result.events).toContainEqual({
      type: 'metamagic-applied', actorId: 'sorcerer-token', spellId: 'fireball', kind: 'empowered',
    })
  })

  it('rejects forged Empowered Spell rerolls beyond the Charisma limit or without the feature request', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-known': ['fireball'], metamagic: ['empowered'],
      } } } },
      classResources: {
        'dnd5e-spell-slot-3': { current: 1, max: 2 },
        'dnd5e-sorcery-points': { current: 1, max: 5 },
      },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(sorcerer, 'fireball', 3, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'fireball', slotLevel: 3, targetTokenId: enemy.id, empowered: true, areaTargetCell: { col: 11, row: 0 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const baseAction = {
      type: 'cast-spell' as const,
      actorId: 'sorcerer-token',
      targetId: enemy.id,
      spellId: 'fireball',
      slotLevel: 3,
      savingThrowD20: 1,
      effectRolls: [1, 1, 1, 1, 1, 1, 1, 1],
    }
    expect(resolveDnd5eHeadlessAction(prepared.prepared.state, {
      ...baseAction,
      empowered: true,
      empoweredRerolls: [0, 1, 2, 3].map((dieIndex) => ({ group: 'effect' as const, dieIndex, reroll: 8 })),
    })).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(resolveDnd5eHeadlessAction(prepared.prepared.state, {
      ...baseAction,
      empoweredRerolls: [{ group: 'effect', dieIndex: 0, reroll: 8 }],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('shares the Empowered Spell Charisma limit across both Twinned Spell damage rolls', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-cantrips': ['fire-bolt'], metamagic: ['empowered', 'twinned'],
      } } } },
      classResources: { 'dnd5e-sorcery-points': { current: 2, max: 5 } },
    })
    const first = token('first', 'enemy', 575)
    const second = token('second', 'enemy', 625)
    const input = fixture(sorcerer, 'fire-bolt', 0, first)
    input.map.tokens.push(second)
    input.initiativeOrder.push({ tokenId: second.id, label: second.label, emoji: '', color: '', roll: 5 })
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt', slotLevel: 0, targetTokenId: first.id,
      targetTokenIds: [first.id, second.id], metamagic: { kind: 'twinned' }, empowered: true,
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetAttacks: [
        { targetId: first.id, d20: 15, effectRolls: [1, 1] },
        { targetId: second.id, d20: 15, effectRolls: [1, 1] },
      ],
      empoweredRerolls: [
        { group: 'target-attack', targetId: first.id, dieIndex: 0, reroll: 10 },
        { group: 'target-attack', targetId: second.id, dieIndex: 1, reroll: 9 },
      ],
      effectRolls: [],
    })
    expect(resolved.result.ok ? 'ok' : resolved.result.reason).toBe('ok')
    expect(resolved.application?.map.tokens.find((entry) => entry.id === first.id)?.hp).toBe(19)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === second.id)?.hp).toBe(20)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-sorcery-points']).toEqual({ current: 0, max: 5 })
  })

  it('imposes disadvantage on the chosen target with Heightened Spell', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-cantrips': ['poison-spray'], metamagic: ['heightened'],
      } } } },
      classResources: { 'dnd5e-sorcery-points': { current: 3, max: 5 } },
    })
    const enemy = token('enemy', 'enemy', 75)
    const input = fixture(sorcerer, 'poison-spray', 0, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'poison-spray', slotLevel: 0, targetTokenId: enemy.id,
      metamagic: { kind: 'heightened', heightenedTargetId: enemy.id },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.savingThrow?.mode).toBe('disadvantage')
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 20,
      savingThrowD20Second: 1,
      effectRolls: [5, 5],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(20)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-sorcery-points']).toEqual({ current: 0, max: 5 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: enemy.id, d20: 1, success: false,
    }))
  })

  it('rejects unknown or unlearned Metamagic before any spell resource is spent', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: {
        'spell-cantrips': ['fire-bolt'], metamagic: ['careful'],
      } } } },
      classResources: { 'dnd5e-sorcery-points': { current: 5, max: 5 } },
    })
    const input = fixture(sorcerer, 'fire-bolt', 0, token('enemy', 'enemy', 575))
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt', slotLevel: 0, targetTokenId: 'enemy',
      metamagic: { kind: 'quickened' },
    }
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'invalid-action' })
  })

  it('activates Draconic Elemental Affinity resistance, persists it, and halves matching damage', () => {
    const sorcerer = character('sorcerer', '术士', {
      level: 6,
      dnd5eClassChoices: { classes: { sorcerer: { subclass: 'draconic', selections: {
        'spell-cantrips': ['fire-bolt'], 'dragon-ancestor': ['red-fire'],
      } } } },
      classResources: { 'dnd5e-sorcery-points': { current: 2, max: 6 } },
    })
    const enemyCharacter = character('enemy-character', '战士', { maxHp: 50, currentHp: 50 })
    const enemy = token('enemy-token', 'enemy', 575, enemyCharacter.id)
    enemy.hp = 50
    enemy.maxHp = 50
    const input = fixture(sorcerer, 'fire-bolt', 0, enemy, [enemyCharacter])
    input.action.dnd5eSpellCast = {
      spellId: 'fire-bolt', slotLevel: 0, targetTokenId: enemy.id, draconicResistance: true,
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared, d20: 15, effectRolls: [5, 5],
    })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.application?.characters.find((entry) => entry.id === sorcerer.id)).toMatchObject({
      classResources: { 'dnd5e-sorcery-points': { current: 1, max: 6 } },
      dnd5eCombatState: { draconicResistanceType: 'fire', draconicResistanceRoundsRemaining: 600 },
    })
    expect(cast.result.events).toContainEqual({
      type: 'damage-resistance-gained', actorId: 'sorcerer-token', damageType: 'fire',
      source: 'draconic-elemental-affinity', rounds: 600,
    })

    const enemyIndex = cast.result.state.initiativeOrder.indexOf(enemy.id)
    const retaliation = resolveDnd5eHeadlessAction({ ...cast.result.state, initiativeIndex: enemyIndex }, {
      type: 'attack', actorId: enemy.id, targetId: 'sorcerer-token', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'fire' },
    })
    expect(retaliation.ok).toBe(true)
    if (retaliation.ok) expect(retaliation.state.combatants['sorcerer-token'].currentHp).toBe(25)
  })

  it('rejects forged or unaffordable Draconic Elemental Affinity resistance requests', () => {
    const sorcerer = character('sorcerer', '术士', {
      level: 6,
      dnd5eClassChoices: { classes: { sorcerer: { subclass: 'draconic', selections: {
        'spell-cantrips': ['fire-bolt', 'poison-spray'], 'dragon-ancestor': ['red-fire'], metamagic: ['quickened'],
      } } } },
      classResources: { 'dnd5e-sorcery-points': { current: 2, max: 6 } },
    })
    const enemy = token('enemy', 'enemy', 75)
    const wrongElement = fixture(sorcerer, 'poison-spray', 0, enemy)
    wrongElement.action.dnd5eSpellCast = {
      spellId: 'poison-spray', slotLevel: 0, targetTokenId: enemy.id, draconicResistance: true,
    }
    expect(prepareDnd5eSpellCast(wrongElement)).toEqual({ ok: false, reason: 'invalid-action' })

    const overspent = fixture(sorcerer, 'fire-bolt', 0, enemy)
    overspent.action.dnd5eSpellCast = {
      spellId: 'fire-bolt', slotLevel: 0, targetTokenId: enemy.id,
      metamagic: { kind: 'quickened' }, draconicResistance: true,
    }
    expect(prepareDnd5eSpellCast(overspent)).toEqual({ ok: false, reason: 'invalid-action' })

    const forgedHeadless = prepareDnd5eSpellCast(fixture(sorcerer, 'fire-bolt', 0, enemy))
    expect(forgedHeadless.ok).toBe(true)
    if (!forgedHeadless.ok) return
    const result = resolveDnd5eHeadlessAction(forgedHeadless.prepared.state, {
      type: 'cast-spell', actorId: 'sorcerer-token', targetId: enemy.id,
      spellId: 'fire-bolt', slotLevel: 0, metamagic: { kind: 'quickened' },
      draconicResistance: true, d20: 15, effectRolls: [5, 5],
    })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('maximizes a first Overchannel evocation spell without backlash and records the use', () => {
    const wizard = character('wizard', '法师', {
      level: 14,
      maxHp: 60,
      currentHp: 60,
      dnd5eClassChoices: { classes: { wizard: { subclass: 'evocation', selections: { 'spell-prepared': ['fireball'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 3 } },
    })
    const enemy = { ...token('enemy', 'enemy', 575), hp: 100, maxHp: 100 }
    const input = fixture(wizard, 'fireball', 3, enemy)
    input.action.dnd5eSpellCast = { spellId: 'fireball', slotLevel: 3, targetTokenId: enemy.id, overchannel: true, areaTargetCell: { col: 11, row: 0 } }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ overchannel: true, overchannelSelfDamageDiceCount: 0 })
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(49)
    expect(resolved.application?.characters[0]).toMatchObject({
      currentHp: 60,
      dnd5eCombatState: { overchannelUsesSinceLongRest: 1 },
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'wizard-token', stateKey: 'overchannel', active: true, value: 1,
    }))
  })

  it('applies escalating unresisted d12 backlash after a repeated Overchannel use', () => {
    const wizard = character('wizard', '法师', {
      level: 14,
      maxHp: 60,
      currentHp: 60,
      dnd5eClassChoices: { classes: { wizard: { subclass: 'evocation', selections: { 'spell-prepared': ['fireball'] } } } },
      dnd5eCombatState: { overchannelUsesSinceLongRest: 1 },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 3 } },
    })
    const enemy = { ...token('enemy', 'enemy', 575), hp: 100, maxHp: 100 }
    const input = fixture(wizard, 'fireball', 3, enemy)
    input.action.dnd5eSpellCast = { spellId: 'fireball', slotLevel: 3, targetTokenId: enemy.id, overchannel: true, areaTargetCell: { col: 11, row: 0 } }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.overchannelSelfDamageDiceCount).toBe(6)
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [],
      overchannelSelfDamageRolls: [2, 2, 2, 2, 2, 2],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0]).toMatchObject({
      currentHp: 48,
      dnd5eCombatState: { overchannelUsesSinceLongRest: 2 },
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'wizard-token', targetId: 'wizard-token', amount: 12,
    }))
  })

  it('rejects forged Overchannel eligibility and invalid backlash dice before settlement', () => {
    const wizard = character('wizard', '法师', {
      level: 14,
      dnd5eClassChoices: { classes: { wizard: { subclass: 'evocation', selections: { 'spell-prepared': ['fireball'] } } } },
      dnd5eCombatState: { overchannelUsesSinceLongRest: 1 },
      classResources: {
        'dnd5e-spell-slot-3': { current: 1, max: 3 },
        'dnd5e-spell-slot-6': { current: 1, max: 1 },
      },
    })
    const enemy = token('enemy', 'enemy', 575)
    const ineligible = fixture(wizard, 'fireball', 6, enemy)
    ineligible.action.dnd5eSpellCast = { spellId: 'fireball', slotLevel: 6, targetTokenId: enemy.id, overchannel: true }
    expect(prepareDnd5eSpellCast(ineligible)).toEqual({ ok: false, reason: 'invalid-action' })

    const eligible = fixture(wizard, 'fireball', 3, enemy)
    eligible.action.dnd5eSpellCast = { spellId: 'fireball', slotLevel: 3, targetTokenId: enemy.id, overchannel: true, areaTargetCell: { col: 11, row: 0 } }
    const prepared = prepareDnd5eSpellCast(eligible)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const invalid = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [],
      overchannelSelfDamageRolls: [12],
    })
    expect(invalid.result).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('maximizes every Magic Missile dart with Overchannel and applies Empowered Evocation once', () => {
    const wizard = character('wizard', '法师', {
      level: 14,
      dnd5eClassChoices: { classes: { wizard: { subclass: 'evocation', selections: { 'spell-prepared': ['magic-missile'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const input = fixture(wizard, 'magic-missile', 1, enemy)
    input.action.dnd5eSpellCast = {
      spellId: 'magic-missile', slotLevel: 1, targetTokenId: enemy.id,
      targetTokenIds: [enemy.id], projectileTargetIds: [enemy.id, enemy.id, enemy.id], overchannel: true,
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(12)
  })

  it('casts a selected sixth-level Mystic Arcanum once without consuming a Pact Magic slot', () => {
    const warlock = character('warlock', '邪术师', {
      level: 11,
      dnd5eClassChoices: { classes: { warlock: { selections: { 'mystic-arcanum-6': ['circle-of-death'] } } } },
      classResources: {
        'dnd5e-mystic-arcanum-6': { current: 1, max: 1 },
        'dnd5e-pact-slot': { current: 0, max: 3 },
      },
    })
    const materialGrant = applyDnd5eInventoryMutation([warlock], {
      type: 'grant', characterId: warlock.id,
      templateId: 'srd-5.1:item:black-pearl-powder-500gp', quantity: 1,
    })
    const enemy = token('enemy', 'enemy', 575)
    const prepared = prepareDnd5eSpellCast(fixture(materialGrant.characters[0], 'circle-of-death', 6, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.slotLevel).toBe(6)
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      effectRolls: [1, 1, 1, 1, 1, 1, 1, 1],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources).toMatchObject({
      'dnd5e-mystic-arcanum-6': { current: 0, max: 1 },
      'dnd5e-pact-slot': { current: 0, max: 3 },
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'warlock-token', stateKey: 'mystic-arcanum', active: true,
    }))
  })

  it('rejects a depleted Mystic Arcanum instead of falling back to a fifth-level Pact Magic slot', () => {
    const warlock = character('warlock', '邪术师', {
      level: 11,
      dnd5eClassChoices: { classes: { warlock: { selections: { 'mystic-arcanum-6': ['circle-of-death'] } } } },
      classResources: {
        'dnd5e-mystic-arcanum-6': { current: 0, max: 1 },
        'dnd5e-pact-slot': { current: 3, max: 3 },
      },
    })
    const materialGrant = applyDnd5eInventoryMutation([warlock], {
      type: 'grant', characterId: warlock.id,
      templateId: 'srd-5.1:item:black-pearl-powder-500gp', quantity: 1,
    })
    expect(prepareDnd5eSpellCast(fixture(materialGrant.characters[0], 'circle-of-death', 6, token('enemy', 'enemy', 575)))).toEqual({
      ok: false,
      reason: 'slot-unavailable',
    })
  })

  it('resolves Power Word Kill from Mystic Arcanum by current hit points without treating it as damage', () => {
    const warlock = character('warlock', '邪术师', {
      level: 17,
      dnd5eClassChoices: { classes: { warlock: { selections: { 'mystic-arcanum-9': ['power-word-kill'] } } } },
      classResources: { 'dnd5e-mystic-arcanum-9': { current: 1, max: 1 } },
    })
    const enemy = { ...token('enemy', 'enemy', 575), hp: 100, maxHp: 150 }
    const prepared = prepareDnd5eSpellCast(fixture(warlock, 'power-word-kill', 9, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(0)
    expect(resolved.result.events).toContainEqual({
      type: 'instant-death', sourceId: 'warlock-token', targetId: enemy.id, hpBefore: 100,
    })
    expect(resolved.result.events.some((event) => event.type === 'damage-applied')).toBe(false)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-mystic-arcanum-9']).toEqual({ current: 0, max: 1 })
  })

  it('spends Power Word Kill but leaves a target above 100 current hit points alive', () => {
    const warlock = character('warlock', '邪术师', {
      level: 17,
      dnd5eClassChoices: { classes: { warlock: { selections: { 'mystic-arcanum-9': ['power-word-kill'] } } } },
      classResources: { 'dnd5e-mystic-arcanum-9': { current: 1, max: 1 } },
    })
    const enemy = { ...token('enemy', 'enemy', 575), hp: 101, maxHp: 150 }
    const prepared = prepareDnd5eSpellCast(fixture(warlock, 'power-word-kill', 9, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(101)
    expect(resolved.result.events.some((event) => event.type === 'instant-death')).toBe(false)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-mystic-arcanum-9']).toEqual({ current: 0, max: 1 })
  })

  it('casts a mastered Shield as a reaction without consuming a first-level slot', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    const wizard = character('wizard', '法师', {
      level: 18,
      ac: 14,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-mastery-1': ['shield'] } } } },
      classResources: {},
    })
    const wizardToken = token('wizard-token', 'enemy', 575, wizard.id)
    const prepared = prepareDnd5eSpellCast(fixture(sorcerer, 'fire-bolt', 0, wizardToken, [wizard]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 10,
      shieldSpellReaction: true,
      effectRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === wizard.id)).toMatchObject({
      currentHp: 30,
      dnd5eCombatState: { shieldSpellActive: true },
    })
    expect(resolved.application?.characters.find((entry) => entry.id === wizard.id)?.classResources?.['dnd5e-spell-slot-1']).toBeUndefined()
  })

  it('allocates every Magic Missile dart independently and rejects an incomplete allocation', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['magic-missile'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const enemies = [
      character('enemy-1', '战士'),
      character('enemy-2', '战士'),
    ]
    const enemyTokens = [
      token('enemy-token-1', 'enemy', 475, enemies[0].id),
      token('enemy-token-2', 'enemy', 525, enemies[1].id),
    ]
    const input = fixture(wizard, 'magic-missile', 1, enemyTokens[0], enemies)
    input.map.tokens.push(enemyTokens[1])
    input.initiativeOrder.push({ tokenId: enemyTokens[1].id, label: enemyTokens[1].label, emoji: '', color: '', roll: 17 })
    input.action.targetTokenIds = enemyTokens.map((entry) => entry.id)
    input.action.dnd5eSpellCast = {
      spellId: 'magic-missile', slotLevel: 1, targetTokenId: enemyTokens[0].id,
      targetTokenIds: enemyTokens.map((entry) => entry.id),
      projectileTargetIds: [enemyTokens[0].id, enemyTokens[0].id, enemyTokens[1].id],
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.projectileTargetIds).toEqual([
      enemyTokens[0].id, enemyTokens[0].id, enemyTokens[1].id,
    ])
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [1, 2, 3] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemyTokens[0].id)?.hp).toBe(25)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemyTokens[1].id)?.hp).toBe(26)

    input.action.dnd5eSpellCast.projectileTargetIds = [enemyTokens[0].id, enemyTokens[1].id]
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('casts Healing Word as a bonus action and adds the spellcasting ability modifier', () => {
    const bard = character('bard', '吟游诗人', {
      dnd5eClassChoices: { classes: { bard: { selections: { 'spell-known': ['healing-word'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const ally = character('ally', '战士', { currentHp: 0, deathSaveFailures: 2, deathSaveSuccesses: 1, deathSaveStable: true })
    const allyToken = token('ally-token', 'player', 325, ally.id)
    allyToken.hp = 0
    const prepared = prepareDnd5eSpellCast(fixture(bard, 'healing-word', 1, allyToken, [ally]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.effectBonus).toBe(3)
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [4] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)).toMatchObject({
      currentHp: 7, deathSaveFailures: 0, deathSaveSuccesses: 0, deathSaveStable: false,
    })
    expect(resolved.result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'bard-token', resource: 'bonusAction' })
  })

  it('stabilizes only a living zero-HP creature without healing, damage, a slot, or retained death-save marks', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassLevels: { cleric: 5 },
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-cantrips': ['spare-the-dying'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 4, max: 4 } },
    })
    const downed = character('downed', '法师', {
      currentHp: 0,
      maxHp: 8,
      deathSaveSuccesses: 1,
      deathSaveFailures: 1,
      deathSaveStable: false,
    })
    const downedToken = token('downed-token', 'player', 75, downed.id)
    downedToken.hp = 0
    downedToken.maxHp = 8
    const input = fixture(cleric, 'spare-the-dying', 0, downedToken, [downed])

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.diceCount).toBe(0)
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === downed.id)).toMatchObject({
      currentHp: 0,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      deathSaveStable: true,
    })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === downedToken.id)?.hp).toBe(0)
    expect(resolved.application?.characters.find((entry) => entry.id === cleric.id)?.classResources?.['dnd5e-spell-slot-1'])
      .toEqual({ current: 4, max: 4 })
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent',
      actorId: 'cleric-token',
      resource: 'action',
    })

    const positiveHp = character('positive', '法师', { currentHp: 1 })
    const positiveHpToken = token('positive-token', 'player', 75, positiveHp.id)
    positiveHpToken.hp = 1
    expect(prepareDnd5eSpellCast(
      fixture(cleric, 'spare-the-dying', 0, positiveHpToken, [positiveHp]),
    )).toEqual({ ok: false, reason: 'invalid-target' })

    const constructToken = token('construct-token', 'player', 75)
    constructToken.hp = 0
    constructToken.creatureTypes = ['构装体']
    expect(prepareDnd5eSpellCast(
      fixture(cleric, 'spare-the-dying', 0, constructToken),
    )).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('casts Mass Cure Wounds on up to six chosen creatures inside the authoritative sphere', () => {
    const cleric = character('cleric', '牧师', {
      level: 9, currentHp: 10,
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['mass-cure-wounds'] } } } },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const ally = character('ally', '战士', { currentHp: 10 })
    const allyToken = token('ally-token', 'player', 125, ally.id)
    const enemy = character('enemy', '战士', { currentHp: 10 })
    const enemyToken = token('enemy-token', 'enemy', 175, enemy.id)
    enemyToken.hp = 10
    const undeadToken = token('undead-token', 'enemy', 225)
    undeadToken.poolId = 'srd-5.1:zombie'
    undeadToken.hp = 5
    undeadToken.maxHp = 22
    const input = fixture(cleric, 'mass-cure-wounds', 5, allyToken, [ally, enemy])
    input.map.tokens.push(enemyToken, undeadToken)
    input.initiativeOrder.push({ tokenId: enemyToken.id, label: enemyToken.label, emoji: '', color: '', roll: 18 })
    input.initiativeOrder.push({ tokenId: undeadToken.id, label: undeadToken.label, emoji: '', color: '', roll: 17 })
    const actorToken = input.map.tokens[0]
    input.action.dnd5eSpellCast = {
      spellId: 'mass-cure-wounds', slotLevel: 5, targetTokenId: allyToken.id,
      targetTokenIds: [actorToken.id, allyToken.id, enemyToken.id, undeadToken.id], areaTargetCell: { col: 1, row: 0 },
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [2, 2, 2] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === cleric.id)?.currentHp).toBe(19)
    expect(resolved.application?.characters.find((entry) => entry.id === ally.id)?.currentHp).toBe(19)
    expect(resolved.application?.characters.find((entry) => entry.id === enemy.id)?.currentHp).toBe(19)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === undeadToken.id)?.hp).toBe(5)
    expect(resolved.application?.characters.find((entry) => entry.id === cleric.id)?.classResources?.['dnd5e-spell-slot-5'])
      .toEqual({ current: 0, max: 1 })
  })

  it('maintains Shield of Faith as a Headless concentration effect and removes its +2 AC after a failed save', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['shield-of-faith'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const ally = character('ally', '战士', { ac: 16 })
    const allyToken = token('ally-token', 'player', 325, ally.id)
    const prepared = prepareDnd5eSpellCast(fixture(cleric, 'shield-of-faith', 1, allyToken, [ally]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants['cleric-token']).toMatchObject({
      concentrating: true,
      classState: {
        concentrationSpellId: 'shield-of-faith',
        concentrationTargetIds: ['ally-token'],
        concentrationRoundsRemaining: 100,
      },
    })
    expect(dnd5eTargetArmorClassForAttack(cast.result.state, 'cleric-token', 'ally-token')).toBe(14)

    const failed = resolveDnd5eHeadlessAction(cast.result.state, {
      type: 'concentration-save', actorId: 'cleric-token', d20: 1, dc: 10,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants['cleric-token'].concentrating).toBe(false)
    expect(failed.state.combatants['ally-token'].classState.concentrationEffectsBySource).toBeUndefined()
    expect(dnd5eTargetArmorClassForAttack(failed.state, 'cleric-token', 'ally-token')).toBe(12)
  })

  it('applies Bless to multiple targets and requires a Headless-validated d4 on their attacks', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-prepared': ['bless'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const allies = [1, 2, 3].map((index) => character(`ally-${index}`, '战士'))
    const allyTokens = allies.map((ally, index) => token(`${ally.id}-token`, 'player', 75 + index * 50, ally.id))
    const enemy = token('enemy-token', 'enemy', 275)
    enemy.maxHp = 20
    enemy.hp = 20
    const input = fixture(cleric, 'bless', 1, allyTokens[0], allies)
    input.map.tokens = [input.map.tokens[0], ...allyTokens, enemy]
    input.initiativeOrder = input.map.tokens.map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    input.action.targetTokenIds = allyTokens.map((entry) => entry.id)
    input.action.dnd5eSpellCast = {
      spellId: 'bless', slotLevel: 1, targetTokenId: allyTokens[0].id,
      targetTokenIds: allyTokens.map((entry) => entry.id),
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens).toHaveLength(3)
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    for (const allyToken of allyTokens) {
      expect(cast.result.state.combatants[allyToken.id].classState.concentrationEffectsBySource)
        .toEqual({ 'cleric-token': 'bless' })
    }

    const allyIndex = cast.result.state.initiativeOrder.indexOf(allyTokens[0].id)
    const attackState = { ...cast.result.state, initiativeIndex: allyIndex }
    const missingD4 = resolveDnd5eHeadlessAction(attackState, {
      type: 'attack', actorId: allyTokens[0].id, targetId: enemy.id,
      attackModifier: 5, d20: 5, damage: { count: 1, sides: 8, bonus: 3, rolls: [], type: 'slashing' },
    })
    expect(missingD4).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const attack = resolveDnd5eHeadlessAction(attackState, {
      type: 'attack', actorId: allyTokens[0].id, targetId: enemy.id,
      attackModifier: 5, d20: 5, blessRoll: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4], type: 'slashing' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: allyTokens[0].id, total: 12, armorClass: 12, hit: true,
    }))
  })

  it('applies Bane only to failed Charisma saves and subtracts a validated d4 from later attacks', () => {
    const bard = character('bard', '吟游诗人', {
      dnd5eClassChoices: { classes: { bard: { selections: { 'spell-known': ['bane'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const enemies = [1, 2, 3].map((index) => character(`enemy-${index}`, '战士', { ac: 14 }))
    const enemyTokens = enemies.map((enemy, index) => token(`${enemy.id}-token`, 'enemy', 75 + index * 50, enemy.id))
    const input = fixture(bard, 'bane', 1, enemyTokens[0], enemies)
    input.map.tokens = [input.map.tokens[0], ...enemyTokens]
    input.initiativeOrder = input.map.tokens.map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    input.action.targetTokenIds = enemyTokens.map((entry) => entry.id)
    input.action.dnd5eSpellCast = {
      spellId: 'bane', slotLevel: 1, targetTokenId: enemyTokens[0].id,
      targetTokenIds: enemyTokens.map((entry) => entry.id),
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetSavingThrows).toHaveLength(3)
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [
        { targetId: enemyTokens[0].id, d20: 5 },
        { targetId: enemyTokens[1].id, d20: 20 },
        { targetId: enemyTokens[2].id, d20: 10 },
      ],
      effectRolls: [],
    })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[enemyTokens[0].id].classState.concentrationEffectsBySource)
      .toEqual({ 'bard-token': 'bane' })
    expect(cast.result.state.combatants[enemyTokens[1].id].classState.concentrationEffectsBySource).toBeUndefined()
    expect(cast.result.state.combatants[enemyTokens[2].id].classState.concentrationEffectsBySource)
      .toEqual({ 'bard-token': 'bane' })

    const affectedIndex = cast.result.state.initiativeOrder.indexOf(enemyTokens[0].id)
    const attackState = { ...cast.result.state, initiativeIndex: affectedIndex }
    const missingD4 = resolveDnd5eHeadlessAction(attackState, {
      type: 'attack', actorId: enemyTokens[0].id, targetId: 'bard-token',
      attackModifier: 5, d20: 12, damage: { count: 1, sides: 8, bonus: 3, rolls: [], type: 'slashing' },
    })
    expect(missingD4).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const attack = resolveDnd5eHeadlessAction(attackState, {
      type: 'attack', actorId: enemyTokens[0].id, targetId: 'bard-token',
      attackModifier: 5, d20: 10, baneRoll: 4,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [], type: 'slashing' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: enemyTokens[0].id, total: 11, hit: false,
    }))

    const unaffectedIndex = cast.result.state.initiativeOrder.indexOf(enemyTokens[1].id)
    const forged = resolveDnd5eHeadlessAction({ ...cast.result.state, initiativeIndex: unaffectedIndex }, {
      type: 'attack', actorId: enemyTokens[1].id, targetId: 'bard-token',
      attackModifier: 5, d20: 12, baneRoll: 1,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4], type: 'slashing' },
    })
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('checks Tranquility separately for every Bane target and excludes a warded target after a failed save', () => {
    const bard = character('bard', '吟游诗人', {
      dnd5eClassChoices: { classes: { bard: { selections: { 'spell-known': ['bane'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const tranquilMonk = character('tranquil-monk', '武僧', {
      level: 11,
      dnd5eClassChoices: { classes: { monk: { subclass: 'open-hand', selections: {} } } },
      dnd5eCombatState: { tranquilityActive: true },
    })
    const enemy = character('enemy', '战士')
    const monkToken = token('tranquil-monk-token', 'enemy', 75, tranquilMonk.id)
    const enemyToken = token('enemy-token', 'enemy', 125, enemy.id)
    const input = fixture(bard, 'bane', 1, monkToken, [tranquilMonk, enemy])
    input.map.tokens = [input.map.tokens[0], monkToken, enemyToken]
    input.initiativeOrder = input.map.tokens.map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    input.action.targetTokenIds = [monkToken.id, enemyToken.id]
    input.action.dnd5eSpellCast = {
      spellId: 'bane', slotLevel: 1, targetTokenId: monkToken.id,
      targetTokenIds: [monkToken.id, enemyToken.id],
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTranquilityWards?.map((entry) => entry.targetToken.id)).toEqual([monkToken.id])
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetTranquilitySaves: [{ targetId: monkToken.id, save: { d20: 1 } }],
      targetSavingThrows: [
        { targetId: monkToken.id, d20: 1 },
        { targetId: enemyToken.id, d20: 1 },
      ],
      effectRolls: [],
    })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.events).toContainEqual({
      type: 'hostile-targeting-prevented', actorId: 'bard-token', targetId: monkToken.id, source: 'tranquility',
    })
    expect(cast.result.state.combatants[monkToken.id].classState.concentrationEffectsBySource).toBeUndefined()
    expect(cast.result.state.combatants[enemyToken.id].classState.concentrationEffectsBySource)
      .toEqual({ 'bard-token': 'bane' })
  })

  it('resolves Sacred Flame through the target Dexterity save', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-cantrips': ['sacred-flame'] } } } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const prepared = prepareDnd5eSpellCast(fixture(cleric, 'sacred-flame', 0, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(previewDnd5eSpellSavingThrow(prepared.prepared, 18).success).toBe(true)
    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, savingThrowD20: 18, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(30)
  })

  it('lets Acid Splash choose any two creatures from three mutually adjacent candidates', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: { 'spell-cantrips': ['acid-splash'] } } } },
    })
    const enemies = [
      character('enemy-1', '战士'),
      character('enemy-2', '战士'),
      character('enemy-3', '战士'),
    ]
    const enemyTokens = [
      token('enemy-token-1', 'enemy', 475, enemies[0].id),
      token('enemy-token-2', 'enemy', 525, enemies[1].id),
      { ...token('enemy-token-3', 'enemy', 475, enemies[2].id), y: 75 },
    ]
    const input = fixture(sorcerer, 'acid-splash', 0, enemyTokens[0], enemies)
    input.map.tokens.push(...enemyTokens.slice(1))
    input.initiativeOrder.push(...enemyTokens.slice(1).map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 17 - index,
    })))
    const selectedTargets = [enemyTokens[0], enemyTokens[2]]
    input.action.targetTokenIds = selectedTargets.map((entry) => entry.id)
    input.action.dnd5eSpellCast = {
      spellId: 'acid-splash', slotLevel: 0, targetTokenId: enemyTokens[0].id,
      targetTokenIds: selectedTargets.map((entry) => entry.id),
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ diceCount: 2, savingThrow: undefined })
    expect(prepared.prepared.targetSavingThrows).toHaveLength(2)
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [
        { targetId: enemyTokens[0].id, d20: 1 },
        { targetId: enemyTokens[2].id, d20: 20 },
      ],
      effectRolls: [2, 3],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemyTokens[0].id)?.hp).toBe(25)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemyTokens[1].id)?.hp).toBe(30)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemyTokens[2].id)?.hp).toBe(30)

    enemyTokens[2].x = 625
    expect(prepareDnd5eSpellCast(input)).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('scales Poison Spray and applies poison damage after a failed Constitution save', () => {
    const warlock = character('warlock', '邪术师', {
      dnd5eClassChoices: { classes: { warlock: { selections: { 'spell-cantrips': ['poison-spray'] } } } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const prepared = prepareDnd5eSpellCast(fixture(warlock, 'poison-spray', 0, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.diceCount).toBe(2)
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared, savingThrowD20: 1, effectRolls: [8, 9],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(13)
  })

  it('persists Vicious Mockery and consumes its disadvantage on the target\'s next attack roll', () => {
    const bard = character('bard', '吟游诗人', {
      dnd5eClassChoices: { classes: { bard: { selections: { 'spell-cantrips': ['vicious-mockery'] } } } },
    })
    const enemyCharacter = character('enemy-character', '战士')
    const enemyToken = token('enemy-token', 'enemy', 525, enemyCharacter.id)
    const input = fixture(bard, 'vicious-mockery', 0, enemyToken, [enemyCharacter])
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared, savingThrowD20: 1, effectRolls: [3, 4],
    })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[enemyToken.id].classState.viciousMockeryAttackDisadvantage).toBe(true)
    expect(cast.application?.characters.find((entry) => entry.id === enemyCharacter.id)?.dnd5eCombatState)
      .toMatchObject({ viciousMockeryAttackDisadvantage: true })

    const enemyTurn = {
      ...cast.result.state,
      initiativeIndex: cast.result.state.initiativeOrder.indexOf(enemyToken.id),
    }
    const attack = resolveDnd5eHeadlessAction(enemyTurn, {
      type: 'attack', actorId: enemyToken.id, targetId: 'bard-token', attackModifier: 5,
      d20: 15, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [], type: 'slashing' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: enemyToken.id, d20: 2, total: 7, hit: false,
    }))
    expect(attack.state.combatants[enemyToken.id].classState.viciousMockeryAttackDisadvantage).toBeUndefined()

    const expired = resolveDnd5eHeadlessAction(enemyTurn, { type: 'end-turn', actorId: enemyToken.id })
    expect(expired.ok).toBe(true)
    if (expired.ok) expect(expired.state.combatants[enemyToken.id].classState.viciousMockeryAttackDisadvantage).toBeUndefined()
  })

  it('rejects Vicious Mockery when the selected target cannot hear the caster', () => {
    const bard = character('bard', '吟游诗人', {
      dnd5eClassChoices: { classes: { bard: { selections: { 'spell-cantrips': ['vicious-mockery'] } } } },
    })
    const target = token('deafened-target', 'enemy', 125)
    target.dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eConditionEffect({
        condition: 'deafened', targetId: target.id, source: { kind: 'dm' },
        duration: { type: 'permanent' },
      })],
    }

    expect(prepareDnd5eSpellCast(fixture(bard, 'vicious-mockery', 0, target)))
      .toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('casts Shield as a validated reaction, turns the triggering spell attack into a miss, and expires at next turn start', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
    })
    const wizard = character('wizard-target', '法师', {
      ac: 14,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['shield'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const wizardToken = token('wizard-target-token', 'enemy', 525, wizard.id)
    const prepared = prepareDnd5eSpellCast(fixture(sorcerer, 'fire-bolt', 0, wizardToken, [wizard]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      d20: 10,
      shieldSpellReaction: true,
      effectRolls: [],
    })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', targetId: wizardToken.id, armorClass: 17, hit: false,
    }))
    expect(cast.result.state.combatants[wizardToken.id]).toMatchObject({
      classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 4 } },
      turn: { reactionAvailable: false },
      classState: { shieldSpellActive: true },
    })

    const nextTurn = resolveDnd5eHeadlessAction(cast.result.state, {
      type: 'end-turn', actorId: 'sorcerer-token',
    })
    expect(nextTurn.ok).toBe(true)
    if (!nextTurn.ok) return
    expect(nextTurn.state.combatants[wizardToken.id].classState.shieldSpellActive).toBeUndefined()
    expect(nextTurn.events).toContainEqual({
      type: 'class-state-changed', actorId: wizardToken.id, stateKey: 'shield-spell', active: false,
    })
  })

  it('lets Shield negate every Magic Missile dart assigned to its caster', () => {
    const sorcerer = character('sorcerer', '术士', {
      dnd5eClassChoices: { classes: { sorcerer: { selections: { 'spell-known': ['magic-missile'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const wizard = character('wizard-target', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['shield'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const wizardToken = token('wizard-target-token', 'enemy', 525, wizard.id)
    const input = fixture(sorcerer, 'magic-missile', 1, wizardToken, [wizard])
    input.action.dnd5eSpellCast = {
      spellId: 'magic-missile', slotLevel: 1, targetTokenId: wizardToken.id,
      targetTokenIds: [wizardToken.id],
      projectileTargetIds: [wizardToken.id, wizardToken.id, wizardToken.id],
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      shieldSpellReactionTargetIds: [wizardToken.id],
      effectRolls: [4, 4, 4],
    })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[wizardToken.id]).toMatchObject({
      currentHp: 30,
      classState: { shieldSpellActive: true },
      classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 4 } },
    })
    expect(cast.result.events.filter((event) => event.type === 'damage-applied')).toHaveLength(0)
  })

  it('uses a Barbarian target\'s Danger Sense for a visible Dexterity save', () => {
    const cleric = character('cleric', '牧师', {
      dnd5eClassChoices: { classes: { cleric: { selections: { 'spell-cantrips': ['sacred-flame'] } } } },
    })
    const barbarian = character('barbarian', '野蛮人', { level: 2 })
    const target = token('barbarian-token', 'enemy', 575, barbarian.id)
    const prepared = prepareDnd5eSpellCast(fixture(cleric, 'sacred-flame', 0, target, [barbarian]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.savingThrow?.mode).toBe('advantage')
    expect(previewDnd5eSpellSavingThrow(prepared.prepared, 2, 18)).toMatchObject({ success: true, roll: { d20: 18 } })
    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 2,
      savingThrowD20Second: 18,
      effectRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === target.id)?.hp).toBe(30)
  })

  it('rejects a spell that was not selected on the character sheet', () => {
    const wizard = character('wizard', '法师')
    const enemy = token('enemy', 'enemy', 575)
    expect(prepareDnd5eSpellCast(fixture(wizard, 'fire-bolt', 0, enemy))).toEqual({ ok: false, reason: 'spell-not-known-or-prepared' })
  })

  it('rejects a prepared verbal spell while the caster is silenced', () => {
    const wizard = character('wizard', '法师', {
      conditions: ['沉默'],
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['magic-missile'] } } },
      },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    expect(prepareDnd5eSpellCast(fixture(wizard, 'magic-missile', 1, enemy))).toEqual({
      ok: false,
      reason: 'verbal-component-unavailable',
    })
  })

  it('uses an imported spell-attack range multiplier without extending non-attack spells', () => {
    const pluginId = 'local.test.spell-sniper-feat'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Spell Sniper Feat Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'spell-sniper', name: 'Spell Sniper', summary: 'Synthetic feat.', description: 'Synthetic feat.',
          automation: 'partial', automationReasons: ['Cantrip choice remains manual.'],
          staticModifiers: { spellAttackRangeMultiplier: 2, ignoreSpellAttackCoverBonus: true },
        })
      },
    })
    try {
      const wizard = character('wizard', '法师', {
        dnd5eFeatIds: [`${pluginId}:spell-sniper`],
        dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } },
      })
      const enemy = token('enemy', 'enemy', 1_525)
      const input = fixture(wizard, 'fire-bolt', 0, enemy)
      input.map.width = 2_000
      expect(prepareDnd5eSpellCast(input).ok).toBe(true)
    } finally {
      dispose()
    }
  })

  it('projects Silence from the map into the authoritative verbal-component check', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['magic-missile'] } } },
      },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const enemy = token('enemy', 'enemy', 125)
    const input = fixture(wizard, 'magic-missile', 1, enemy)
    input.map.dnd5ePluginAreas = [{
      id: 'silence-area', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:silence',
      sourceKind: 'core-spell', coreSpellId: 'silence', label: '沉默术', color: '#818cf8',
      sourceCharacterId: 'other-caster', sourceTokenId: 'other-token',
      cells: [{ col: 0, row: 0 }], anchorCell: { col: 0, row: 0 }, anchorMode: 'fixed',
      createdRound: 1, expiresAfterRound: 100,
      occupantModifiers: {
        containment: 'fully-contained', preventsVerbalComponents: true, damageImmunities: ['thunder'],
      },
    }]
    expect(prepareDnd5eSpellCast(input)).toEqual({
      ok: false,
      reason: 'verbal-component-unavailable',
    })
  })

  it('settles structured Silence as a base-level ritual without spending an action or spell slot', () => {
    const cleric = character('ritual-cleric', '牧师', {
      dnd5eClassLevels: { cleric: 5 },
      dnd5eClassChoices: {
        classes: { cleric: { selections: { 'spell-prepared': ['silence'] } } },
      },
      // A ritual must remain available even when no ordinary 2nd-level slot remains.
      classResources: { 'dnd5e-spell-slot-2': { current: 0, max: 3 } },
    })
    const input = fixture(cleric, 'silence', 2, token('ritual-area-marker', 'enemy', 125))
    input.action.combatId = undefined
    input.action.dnd5eSpellCast = {
      ...input.action.dnd5eSpellCast!,
      castingClassId: 'cleric',
      ritual: true,
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.ritual).toBe(true)
    expect(prepared.prepared.slotLevel).toBe(2)

    const resolved = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants[input.action.actorTokenId].turn.actionAvailable).toBe(true)
    expect(resolved.result.state.combatants[input.action.actorTokenId].classResources['dnd5e-spell-slot-2'])
      .toEqual({ current: 0, max: 3 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-cast', spellId: 'silence', slotLevel: 2, slotConsumed: false,
    }))
    expect(resolved.result.events.some((event) => event.type === 'turn-resource-spent')).toBe(false)
    expect(resolved.application?.map.dnd5ePluginAreas).toEqual([
      expect.objectContaining({ coreSpellId: 'silence', slotLevel: 2 }),
    ])
  })

  it('rejects forged structured ritual requests for a non-ritual spell or non-ritual-casting class', () => {
    const wizard = character('forged-ritual-wizard', '法师', {
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['shatter'] } } },
      },
    })
    const forgedShatter = fixture(wizard, 'shatter', 2, token('shatter-marker', 'enemy', 125))
    forgedShatter.action.dnd5eSpellCast = {
      ...forgedShatter.action.dnd5eSpellCast!, castingClassId: 'wizard', ritual: true,
    }
    expect(prepareDnd5eSpellCast(forgedShatter)).toEqual({ ok: false, reason: 'ritual-unavailable' })

    const ranger = character('forged-ritual-ranger', '游侠', {
      dnd5eClassLevels: { ranger: 5 },
      dnd5eClassChoices: {
        classes: { ranger: { selections: { 'spell-known': ['silence'] } } },
      },
    })
    const forgedSilence = fixture(ranger, 'silence', 2, token('silence-marker', 'enemy', 125))
    forgedSilence.action.dnd5eSpellCast = {
      ...forgedSilence.action.dnd5eSpellCast!, castingClassId: 'ranger', ritual: true,
    }
    expect(prepareDnd5eSpellCast(forgedSilence)).toEqual({ ok: false, reason: 'ritual-unavailable' })
  })

  it('can disable spellcasting prerequisites without disabling spell ownership validation', () => {
    const wizard = character('wizard', '法师', {
      conditions: ['沉默'],
      equipment: { armor: DND5E_LEATHER_ARMOR },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } },
      },
    })
    const input = fixture(wizard, 'fire-bolt', 0, token('enemy', 'enemy', 125))
    expect(prepareDnd5eSpellCast({
      ...input,
      effectiveRules: createDnd5eEffectiveRulesContextV1({
        houseRules: { spellcastingPrerequisitesEnabled: false },
      }),
    })).toMatchObject({ ok: true })
  })

  it('applies Ray of Frost speed reduction until the caster next turn starts', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['ray-of-frost'] } } } },
    })
    const enemy = token('enemy', 'enemy', 575)
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'ray-of-frost', 0, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, d20: 15, effectRolls: [3, 4] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[enemy.id].classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:ray-of-frost:speed-penalty',
      modifiers: { speedPenaltyFeet: 10 },
    }))
    expect(cast.result.events).toContainEqual({
      type: 'spell-attack-damage-resolved',
      actorId: 'wizard-token',
      targetId: enemy.id,
      spellId: 'ray-of-frost',
      slotLevel: 0,
      critical: false,
      damageType: 'cold',
      roll: { sides: 8, rolls: [3, 4], bonus: 0, total: 7 },
      damageAfterAttackAdjustments: 7,
      finalDamage: 7,
    })

    const enemyTurn = resolveDnd5eHeadlessAction(cast.result.state, { type: 'end-turn', actorId: 'wizard-token' })
    expect(enemyTurn.ok).toBe(true)
    if (!enemyTurn.ok) return
    expect(enemyTurn.state.combatants[enemy.id].turn.movementRemaining).toBe(20)
    const casterTurn = resolveDnd5eHeadlessAction(enemyTurn.state, { type: 'end-turn', actorId: enemy.id })
    expect(casterTurn.ok).toBe(true)
    if (!casterTurn.ok) return
    expect(casterTurn.state.combatants[enemy.id].classState.activeEffects).toBeUndefined()
  })

  it('gives Shocking Grasp advantage against metal armor and blocks reactions until the target turn starts', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['shocking-grasp'] } } } },
    })
    const fighterTarget = character('fighter-target', '战士', {
      equipment: {
        armor: {
          id: 'chain-mail', name: '链甲', slot: 'armor',
          dnd5e: { kind: 'armor', category: 'heavy', baseArmorClass: 16, dexterityBonus: 'none', material: 'metal' },
        },
      },
    })
    const enemy = token('enemy', 'enemy', 75, fighterTarget.id)
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'shocking-grasp', 0, enemy, [fighterTarget]))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('advantage')
    expect(prepared.prepared.attackModeResolution?.advantageReasons).toContain('电爪攻击穿着金属护甲的目标')
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, d20: 2, d20Second: 15, effectRolls: [4, 4] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[enemy.id].turn.reactionAvailable).toBe(false)
    expect(cast.result.state.combatants[enemy.id].classState.activeEffects).toEqual([
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:shocking-grasp:reaction-lock',
        modifiers: expect.objectContaining({ preventReactions: true }),
      }),
    ])
    const targetTurn = resolveDnd5eHeadlessAction(cast.result.state, { type: 'end-turn', actorId: 'wizard-token' })
    expect(targetTurn.ok).toBe(true)
    if (!targetTurn.ok) return
    expect(targetTurn.state.combatants[enemy.id].classState.activeEffects).toBeUndefined()
    expect(targetTurn.state.combatants[enemy.id].turn.reactionAvailable).toBe(true)
  })

  it('applies Blur to the caster and lets blindsight or truesight ignore its attack disadvantage', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['blur'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } },
    })
    const enemy = token('enemy', 'enemy', 75)
    const input = fixture(wizard, 'blur', 2, enemy)
    input.action.targetTokenId = input.action.actorTokenId
    input.action.dnd5eSpellCast = {
      spellId: 'blur', slotLevel: 2, targetTokenId: input.action.actorTokenId,
    }
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, effectRolls: [] })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[input.action.actorTokenId].classState.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:blur' }),
    )

    const enemyTurn = {
      ...cast.result.state,
      initiativeIndex: cast.result.state.initiativeOrder.indexOf(enemy.id),
    }
    const attack = (state: typeof enemyTurn) => resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: enemy.id, targetId: input.action.actorTokenId,
      attackModifier: 5, d20: 18, d20Second: 2, mode: 'normal',
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    const blurred = attack(enemyTurn)
    expect(blurred.ok).toBe(true)
    if (!blurred.ok) return
    expect(blurred.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: false, d20: 2 }))

    const truesightState = structuredClone(enemyTurn)
    truesightState.combatants[enemy.id].specialSenses = [{ kind: 'truesight', rangeFeet: 30 }]
    const seen = attack(truesightState)
    expect(seen.ok).toBe(true)
    if (!seen.ok) return
    expect(seen.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: true, d20: 18 }))

    const trueSeeingState = structuredClone(enemyTurn)
    trueSeeingState.combatants[enemy.id].classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'activity:spell:true-seeing:true-seeing',
      label: '真知术',
      source: { kind: 'spell', actorId: enemy.id, rulesId: 'true-seeing', magical: true },
      targetId: enemy.id,
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      modifiers: { truesightRangeFeet: 120, seeInvisible: true },
    })]
    const spellSeen = attack(trueSeeingState)
    expect(spellSeen.ok).toBe(true)
    if (!spellSeen.ok) return
    expect(spellSeen.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: true, d20: 18 }))
  })

  it('rejects casting Blur on another creature', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['blur'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } },
    })
    expect(prepareDnd5eSpellCast(fixture(wizard, 'blur', 2, token('enemy', 'enemy', 75))))
      .toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('pushes only Thunderwave targets that fail their Constitution save', () => {
    const wizard = character('wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['thunderwave'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const enemy = token('enemy', 'enemy', 75)
    enemy.elevationFeet = 20
    const input = fixture(wizard, 'thunderwave', 1, enemy)
    const casterToken = input.map.tokens.find((candidate) =>
      candidate.id === input.action.actorTokenId)
    if (!casterToken) throw new Error('missing caster token')
    casterToken.elevationFeet = 20
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 1,
      forcedMovements: [{
        targetId: enemy.id, to: { x: 175, y: 25 }, distanceFeet: 10,
        toElevationFeet: 0, fallingDamageRolls: [2, 4],
      }],
      effectRolls: [5, 6],
    })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[enemy.id]).toMatchObject({
      currentHp: 13, position: { x: 175, y: 25 }, elevationFeet: 0,
    })
    expect(cast.result.events).toContainEqual(expect.objectContaining({ type: 'moved', actorId: enemy.id, distance: 10 }))
  })

  it('settles Thunderwave creature damage and upcasting without moving nearby objects', () => {
    const wizard = character('thunderwave-object-wizard', '法师', {
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['thunderwave'] } } } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 2 } },
    })
    const enemy = token('thunderwave-saving-enemy', 'enemy', 275)
    enemy.y = 225
    const input = fixture(wizard, 'thunderwave', 3, enemy)
    const caster = input.map.tokens.find((candidate) => candidate.id === input.action.actorTokenId)
    if (!caster) throw new Error('missing caster token')
    caster.x = 225
    caster.y = 225
    input.action.dnd5eSpellCast!.areaTargetCell = { col: 5, row: 4 }

    const probe = prepareDnd5eSpellCast(input)
    expect(probe.ok, probe.ok ? undefined : probe.reason).toBe(true)
    if (!probe.ok) return
    const areaCells = probe.prepared.areaCells ?? []
    const areaCellKeys = new Set(areaCells.map((cell) => `${cell.col}:${cell.row}`))
    const actorCell = { col: 4, row: 4 }
    const looseCell = areaCells.find((cell) => {
      const dc = Math.sign(cell.col - actorCell.col)
      const dr = Math.sign(cell.row - actorCell.row)
      const destination = { col: cell.col + dc * 2, row: cell.row + dr * 2 }
      return (dc !== 0 || dr !== 0) &&
        destination.col >= 0 && destination.col < 20 && destination.row >= 0 && destination.row < 10 &&
        !(cell.col === 5 && cell.row === 4)
    })
    if (!looseCell) throw new Error(`missing open Thunderwave object cell: ${JSON.stringify(areaCells)}`)
    const otherAreaCell = areaCells.find((cell) =>
      `${cell.col}:${cell.row}` !== `${looseCell.col}:${looseCell.row}` &&
      !(cell.col === actorCell.col && cell.row === actorCell.row) &&
      !(cell.col === 5 && cell.row === 4),
    )
    if (!otherAreaCell) throw new Error(`missing secondary Thunderwave object cell: ${JSON.stringify(areaCells)}`)
    const partialAnchor = areaCells.find((cell) =>
      ![
        `${cell.col}:${cell.row}`,
        `${cell.col + 1}:${cell.row}`,
        `${cell.col}:${cell.row + 1}`,
        `${cell.col + 1}:${cell.row + 1}`,
      ].every((key) => areaCellKeys.has(key)),
    )
    if (!partialAnchor) throw new Error(`missing Thunderwave boundary cell: ${JSON.stringify(areaCells)}`)
    const objectAt = (id: string, label: string, cell: { col: number; row: number }, wornOrCarried: boolean): Token => ({
      id,
      label,
      x: (cell.col + 0.5) * input.map.gridSize,
      y: (cell.row + 0.5) * input.map.gridSize,
      color: '',
      emoji: '📦',
      size: 1,
      type: 'obstacle',
      hp: 10,
      maxHp: 10,
      dnd5eObjectState: { schemaVersion: 1, magical: false, wornOrCarried },
    })
    const looseObject = objectAt('loose-object', '未固定木箱', looseCell, false)
    const carriedObject = objectAt('carried-object', '被携带木箱', otherAreaCell, true)
    const partialObject: Token = {
      ...objectAt('partial-object', '仅部分进入区域的大箱', partialAnchor, false),
      x: (partialAnchor.col + 1) * input.map.gridSize,
      y: (partialAnchor.row + 1) * input.map.gridSize,
      size: 2,
    }
    input.map.tokens.push(looseObject, carriedObject, partialObject)

    const discovered = prepareDnd5eSpellCast(input)
    expect(discovered.ok, discovered.ok ? undefined : discovered.reason).toBe(true)
    if (!discovered.ok) return
    expect(discovered.prepared).not.toHaveProperty('thunderwaveObjectTargetIds')

    input.map.tokens = input.map.tokens.filter((candidate) =>
      candidate.id !== carriedObject.id && candidate.id !== partialObject.id,
    )
    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.diceCount).toBe(4)
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 20,
      forcedMovements: [],
      effectRolls: [8, 8, 8, 8],
    })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    expect(cast.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: enemy.id, success: true,
    }))
    expect(cast.result.events).not.toContainEqual(expect.objectContaining({ type: 'moved', actorId: enemy.id }))
    expect(cast.result.state.combatants[enemy.id].currentHp).toBe(14)
    expect(cast.result.state.combatants[input.action.actorTokenId].classResources['dnd5e-spell-slot-3'])
      .toEqual({ current: 0, max: 2 })
    expect(cast).not.toHaveProperty('thunderwaveObjectMovements')
    expect(cast.application?.map.tokens.find((candidate) => candidate.id === looseObject.id))
      .toMatchObject({ x: looseObject.x, y: looseObject.y })
  })

  it('casts first-level Thunderwave immediately after a long rest restores spell slots', () => {
    const restedWizard = applyDnd5eLongRestBenefits(character('wizard', '法师', {
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['thunderwave'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 4 } },
      dnd5eWorldTimeAppliedMinute: 480,
    }), 960)
    expect(restedWizard.classResources?.['dnd5e-spell-slot-1']).toEqual({ current: 4, max: 4 })

    const enemy = token('enemy', 'enemy', 75)
    const prepared = prepareDnd5eSpellCast(fixture(restedWizard, 'thunderwave', 1, enemy))
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 20,
      effectRolls: [4, 4],
    })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    expect(cast.result.state.combatants[`${restedWizard.id}-token`].classResources['dnd5e-spell-slot-1'])
      .toEqual({ current: 3, max: 4 })
  })

  it('applies Sunburst blindness, persists it on an unlinked monster, and ends it on a successful repeat save', () => {
    const wizard = character('wizard', '法师', {
      level: 15,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['sunburst'] } } } },
      classResources: { 'dnd5e-spell-slot-8': { current: 1, max: 1 } },
    })
    const enemy = token('skeleton', 'enemy', 575)
    enemy.poolId = 'srd-5.1:skeleton'
    const prepared = prepareDnd5eSpellCast(fixture(wizard, 'sunburst', 8, enemy))
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.savingThrow?.mode).toBe('disadvantage')
    const cast = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      savingThrowD20: 18,
      savingThrowD20Second: 1,
      effectRolls: Array.from({ length: 12 }, () => 1),
    })
    expect(cast.result.ok).toBe(true)
    if (!cast.result.ok) return
    const effect = cast.result.state.combatants[enemy.id].classState.activeEffects?.[0]
    expect(effect).toMatchObject({
      source: { rulesId: 'sunburst' }, standardCondition: 'blinded',
      duration: { remainingRounds: 10 },
    })
    expect(cast.application?.map.tokens.find((entry) => entry.id === enemy.id)?.dnd5eCombatState)
      .toMatchObject({
        schemaVersion: 2,
        activeEffects: [expect.objectContaining({ source: expect.objectContaining({ rulesId: 'sunburst' }) })],
        conditions: ['blinded'],
      })

    const repeated = resolveDnd5eHeadlessAction(
      { ...cast.result.state, initiativeIndex: cast.result.state.initiativeOrder.indexOf(enemy.id) },
      {
        type: 'end-turn', actorId: enemy.id,
        activeEffectSavingThrows: [{ effectId: effect!.id, d20: 20, d20Second: 20 }],
      },
    )
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.state.combatants[enemy.id].conditions).not.toContain('blinded')
    expect(repeated.state.combatants[enemy.id].classState.activeEffects).toBeUndefined()
  })

  it('prepares Sunbeam disadvantage dice for undead and oozes in the same line', () => {
    const wizard = character('sunbeam-wizard', '法师', {
      level: 20,
      dnd5eClassLevels: { wizard: 20 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['sunbeam'] } } } },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 2 } },
    })
    const ordinary = token('ordinary', 'enemy', 125)
    ordinary.label = '普通目标'
    ordinary.hp = ordinary.maxHp = 100
    const zombie = token('zombie', 'enemy', 175)
    zombie.label = '僵尸'
    zombie.poolId = 'srd-5.1:zombie'
    zombie.hp = zombie.maxHp = 100
    const cube = token('cube', 'enemy', 225)
    cube.label = '胶质立方怪'
    cube.poolId = 'srd-5.1:gelatinous-cube'
    cube.hp = cube.maxHp = 100
    const input = fixture(wizard, 'sunbeam', 6, ordinary)
    input.map.tokens.push(zombie, cube)
    input.initiativeOrder.push(
      { tokenId: zombie.id, label: zombie.label, emoji: '', color: '', roll: 10 },
      { tokenId: cube.id, label: cube.label, emoji: '', color: '', roll: 9 },
    )
    input.action.targetTokenIds = [ordinary.id, zombie.id, cube.id]
    input.action.dnd5eSpellCast = {
      spellId: 'sunbeam', castingClassId: 'wizard', slotLevel: 6,
      targetTokenId: ordinary.id, targetTokenIds: [ordinary.id, zombie.id, cube.id],
      areaTargetCell: { col: 4, row: 0 },
    }

    const prepared = prepareDnd5eSpellCast(input)
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetSavingThrows).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetToken: expect.objectContaining({ id: ordinary.id }), mode: 'normal' }),
      expect.objectContaining({ targetToken: expect.objectContaining({ id: zombie.id }), mode: 'disadvantage' }),
      expect.objectContaining({ targetToken: expect.objectContaining({ id: cube.id }), mode: 'disadvantage' }),
    ]))

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      targetSavingThrows: [
        { targetId: ordinary.id, d20: 20 },
        { targetId: zombie.id, d20: 20, d20Second: 1 },
        { targetId: cube.id, d20: 20, d20Second: 1 },
      ],
      effectRolls: Array.from({ length: 6 }, () => 8),
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[ordinary.id].currentHp).toBe(76)
    expect(resolved.result.state.combatants[zombie.id].currentHp).toBe(52)
    expect(resolved.result.state.combatants[cube.id].currentHp).toBe(52)
  })

  it('enforces the 2014 bonus-action spell restriction in Headless state', () => {
    const bard = character('bard', '吟游诗人', {
      dnd5eClassChoices: { classes: { bard: { selections: { 'spell-known': ['cure-wounds', 'healing-word'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const ally = character('ally', '战士', { currentHp: 10 })
    const allyToken = token('ally-token', 'player', 75, ally.id)
    allyToken.hp = 10
    const firstInput = fixture(bard, 'cure-wounds', 1, allyToken, [ally])
    const first = prepareDnd5eSpellCast(firstInput)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const firstResolved = resolvePreparedDnd5eSpellCast({ prepared: first.prepared, effectRolls: [2] })
    expect(firstResolved.result.ok).toBe(true)
    if (!firstResolved.application) return

    const secondAction: SharedPlayerActionState = {
      ...firstInput.action,
      id: 'second-cast',
      dnd5eSpellCast: { spellId: 'healing-word', slotLevel: 1, targetTokenId: allyToken.id },
    }
    const second = prepareDnd5eSpellCast({
      ...firstInput,
      action: secondAction,
      map: firstResolved.application.map,
      characters: firstResolved.application.characters,
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(resolvePreparedDnd5eSpellCast({ prepared: second.prepared, effectRolls: [2] }).result)
      .toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })
})
