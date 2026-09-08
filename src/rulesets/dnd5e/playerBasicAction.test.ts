import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import {
  prepareDnd5ePlayerBasicAction,
  resolvePreparedDnd5ePlayerBasicAction,
  triggerDnd5eReadiedAction,
} from './playerBasicAction'

const hero: Character = {
  id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '人类', charClass: '战士', level: 3,
  background: '', experience: 0, reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: ['athletics'],
  maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '3d10', ac: 16, speed: 30, initiativeBonus: 1,
  saveDC: 0, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
}

const map: BattleMap = {
  id: 'map', name: '地图', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
  showGrid: true, feetPerCell: 5,
  tokens: [
    { id: 'hero-token', label: '英雄', characterId: 'hero', x: 5, y: 5, color: '', emoji: '', size: 1, type: 'player', hp: 30, maxHp: 30 },
    { id: 'enemy', label: '敌人', x: 15, y: 5, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10 },
  ],
}

function request(payload: SharedPlayerActionState['dnd5eBasicAction']): SharedPlayerActionState {
  return {
    id: 'basic', mapId: 'map', combatId: 'combat', sourceMode: 'player', status: 'pending',
    type: 'dnd5e-basic-action', actorTokenId: 'hero-token', characterId: 'hero', dnd5eBasicAction: payload,
    round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
}

describe('D&D 5e player basic action bridge', () => {
  it.each([
    {
      payload: { kind: 'other-action', description: '尝试翻过桌子压住机关。' } as const,
      economy: 'action' as const,
      spendsAction: true,
      spendsBonusAction: false,
    },
    {
      payload: { kind: 'other-bonus-action', description: '向同伴喊出约定的暗号。' } as const,
      economy: 'bonusAction' as const,
      spendsAction: false,
      spendsBonusAction: true,
    },
  ])('authoritatively spends $economy before routing a custom action to DM adjudication', ({
    payload,
    economy,
    spendsAction,
    spendsBonusAction,
  }) => {
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request(payload),
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ spendsAction, spendsBonusAction })

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent',
      actorId: 'hero-token',
      resource: economy,
    })
    expect(resolved.result.events).toContainEqual({
      type: 'basic-action-adjudication-requested',
      actorId: 'hero-token',
      economy,
      description: payload.description,
    })
  })

  it('rejects a custom bonus action when the Host snapshot has no bonus action remaining', () => {
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.bonusAction.current = 0
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'other-bonus-action', description: '尝试快速完成额外动作。' }),
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: economy,
    })
    expect(prepared).toEqual({ ok: false, reason: 'action-unavailable' })
  })

  it('accepts Haste Dash after the ordinary action is spent and consumes the restricted credential', () => {
    const haste = createDnd5eMechanicalEffect({
      id: 'haste-effect',
      definitionId: 'activity:haste:effect',
      label: '加速术',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'haste', magical: true },
      targetId: 'hero-token',
      modifiers: {
        speedMultiplier: 2,
        restrictedExtraAction: {
          allowedActions: ['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'],
          maximumWeaponAttacks: 1,
        },
      },
    })
    const economy = createDnd5eTurnEconomyCounts('turn', 60)
    economy.action.current = 0
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'dash' }),
      map,
      characters: [{ ...hero, dnd5eCombatState: { activeEffects: [haste] } }],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: economy,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants['hero-token'].turn).toMatchObject({
      actionAvailable: false,
      movementRemaining: 120,
    })
    expect(resolved.result.state.combatants['hero-token'].classState.restrictedExtraActionUsesByEffect)
      .toEqual({ 'haste-effect': 'combat:1:hero-token' })
  })

  it('authoritatively commands multiple controlled Animate Dead undead within 60 feet with one bonus action', () => {
    const commandedMap: BattleMap = {
      ...map,
      tokens: [
        ...map.tokens,
        ...[
          { id: 'skeleton', label: '受控骷髅', x: 25, y: 5, poolId: 'srd-5.1:skeleton', hp: 13, maxHp: 13 },
          { id: 'zombie', label: '受控僵尸', x: 35, y: 5, poolId: 'srd-5.1:zombie', hp: 22, maxHp: 22 },
        ].map((token) => ({
          ...token,
          color: '', emoji: '', size: 1, type: 'enemy' as const,
          dnd5eSummon: {
            schemaVersion: 1 as const,
            pluginId: 'core-srd-spell',
            featureId: 'spell:animate-dead',
            sourceCharacterId: 'hero',
            sourceTokenId: 'hero-token',
            createdRound: 1,
            expiresAfterRound: 14_400,
            side: 'player' as const,
            persistent: true as const,
            createdWorldMinute: 1,
            controlExpiresAtWorldMinute: 1_441,
          },
        })),
      ],
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({
        kind: 'command-animate-dead',
        targetTokenIds: ['skeleton', 'zombie'],
        command: '守卫法师，并攻击接近的敌人。',
      }),
      map: commandedMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'skeleton', label: '受控骷髅', emoji: '', color: '', roll: 15 },
        { tokenId: 'zombie', label: '受控僵尸', emoji: '', color: '', roll: 14 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ spendsAction: false, spendsBonusAction: true })

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'bonusAction',
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'basic-action-adjudication-requested',
      actorId: 'hero-token',
      economy: 'bonusAction',
      description: expect.stringContaining('受控骷髅、受控僵尸'),
    }))
  })

  it.each([
    {
      label: 'duplicate targets',
      payload: { kind: 'command-animate-dead', targetTokenIds: ['skeleton', 'skeleton'], command: '守卫。' } as const,
      targetPatch: {},
      reason: 'invalid-action' as const,
    },
    {
      label: 'ended control',
      payload: { kind: 'command-animate-dead', targetTokenIds: ['skeleton'], command: '守卫。' } as const,
      targetPatch: { dnd5eSummon: { controlEnded: true as const } },
      reason: 'invalid-target' as const,
    },
    {
      label: 'more than 60 feet',
      payload: { kind: 'command-animate-dead', targetTokenIds: ['skeleton'], command: '守卫。' } as const,
      targetPatch: { x: 135 },
      reason: 'invalid-target' as const,
    },
  ])('rejects an Animate Dead command with $label', ({ payload, targetPatch, reason }) => {
    const summon = {
      schemaVersion: 1 as const,
      pluginId: 'core-srd-spell', featureId: 'spell:animate-dead',
      sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
      expiresAfterRound: 14_400, side: 'player' as const, persistent: true as const,
      createdWorldMinute: 1, controlExpiresAtWorldMinute: 1_441,
    }
    const skeleton = {
      id: 'skeleton', label: '受控骷髅', x: 25, y: 5, color: '', emoji: '', size: 1,
      type: 'enemy' as const, poolId: 'srd-5.1:skeleton', hp: 13, maxHp: 13,
      dnd5eSummon: {
        ...summon,
        ...('dnd5eSummon' in targetPatch ? targetPatch.dnd5eSummon : {}),
      },
      ...(!('dnd5eSummon' in targetPatch) ? targetPatch : {}),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ ...payload, targetTokenIds: [...payload.targetTokenIds] }),
      map: { ...map, tokens: [...map.tokens, skeleton] },
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'skeleton', label: '受控骷髅', emoji: '', color: '', roll: 15 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared).toEqual({ ok: false, reason })
  })

  it('uses the Create Undead 120-foot command range without widening Animate Dead', () => {
    const createUndeadSummon = {
      schemaVersion: 1 as const,
      pluginId: 'core-srd-spell', featureId: 'spell:create-undead',
      sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
      expiresAfterRound: 14_400, side: 'player' as const, persistent: true as const,
      createdWorldMinute: 1, controlExpiresAtWorldMinute: 1_441,
    } as const
    const prepareAtX = (x: number) => prepareDnd5ePlayerBasicAction({
      action: request({
        kind: 'command-animate-dead', targetTokenIds: ['ghoul'], command: '守卫。',
      }),
      map: {
        ...map,
        width: 300,
        tokens: [...map.tokens, {
          id: 'ghoul', label: '受控食尸鬼', x, y: 5, color: '', emoji: '', size: 1,
          type: 'enemy' as const, poolId: 'srd-5.1:ghoul', hp: 22, maxHp: 22,
          dnd5eSummon: createUndeadSummon,
        }],
      },
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'ghoul', label: '受控食尸鬼', emoji: '', color: '', roll: 15 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepareAtX(245).ok).toBe(true)
    expect(prepareAtX(255)).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('accepts an omitted custom-action description and supplies a safe default for the DM', () => {
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'other-action' }),
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'basic-action-adjudication-requested',
      actorId: 'hero-token',
      economy: 'action',
      description: '玩家声明一个其他动作。',
    })
  })

  it('prepares and resolves a grapple without trusting the player result', () => {
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'grapple', targetTokenId: 'enemy', targetDefense: 'athletics' }),
      map, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared, actorD20: 18, targetD20: 2 })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy')?.dnd5eCombatState?.activeEffects)
      .toContainEqual(expect.objectContaining({ standardCondition: 'grappled' }))
  })

  it('releases the actor own basic grapple without spending an action', () => {
    const grapple = createDnd5eConditionEffect({
      id: 'basic-grapple',
      condition: 'grappled',
      source: { kind: 'feature', actorId: 'hero-token', rulesId: 'basic-action:grapple' },
      targetId: 'enemy',
      duration: { type: 'permanent' },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'hero-token',
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const grappleMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === 'enemy'
        ? {
            ...entry,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: ['grappled'],
              activeEffects: [grapple],
            },
          }
        : entry),
    }
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.action.current = 0
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'release-grapple', targetTokenId: 'enemy' }),
      map: grappleMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: economy,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.spendsAction).toBe(false)
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: 'enemy',
      reason: 'released',
    }))
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy')
      ?.dnd5eCombatState?.activeEffects ?? []).not.toContainEqual(
        expect.objectContaining({ id: 'basic-grapple' }),
      )
  })

  it('lets grapple or shove replace one Extra Attack instead of consuming another action', () => {
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.attacksUsed = 1
    economy.action.current = 0
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'shove', targetTokenId: 'enemy', targetDefense: 'acrobatics', outcome: 'prone' }),
      map,
      characters: [{ ...hero, level: 5 }],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: economy,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ spendsAction: false, attackNumber: 2 })
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared, actorD20: 18, targetD20: 2 })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'turn-resource-spent', resource: 'action' }))
  })

  it('moves a successfully shoved target exactly one legal grid square', () => {
    const elevatedMap = {
      ...map,
      tokens: map.tokens.map((token) => ({ ...token, elevationFeet: 20 })),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'shove', targetTokenId: 'enemy', targetDefense: 'athletics', outcome: 'push' }),
      map: elevatedMap, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.pushTo).toEqual({ x: 25, y: 5 })
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared, actorD20: 18, targetD20: 2,
      pushToElevationFeet: 0, fallingDamageRolls: [2, 4],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy')).toMatchObject({
      x: 25, y: 5, elevationFeet: 0, hp: 4,
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'moved', actorId: 'enemy', distance: 5,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'falling-damage-resolved', actorId: 'enemy', distanceFeet: 20, damage: 6,
    }))
  })

  it('keeps a shoved Feather Fall target aloft after the first 60 feet instead of resolving instant fall damage', () => {
    const featherFall = createDnd5eMechanicalEffect({
      definitionId: 'activity:srd-5.1:spell:feather-fall:modifiers:0',
      label: '羽落术',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'feather-fall', magical: true },
      targetId: 'enemy',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: {
        safeFallFeet: 600,
        controlledDescent: { maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true },
      },
    })
    const cliffMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((token) => token.id === 'enemy'
        ? {
            ...token,
            elevationFeet: 100,
            groundElevationFeet: 0,
            airborne: true,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: [],
              activeEffects: [featherFall],
            },
          }
        : { ...token, elevationFeet: 100, groundElevationFeet: 100 }),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'shove', targetTokenId: 'enemy', targetDefense: 'athletics', outcome: 'push' }),
      map: cliffMap, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared,
      actorD20: 18,
      targetD20: 2,
      pushToElevationFeet: 0,
      pushToGroundElevationFeet: 0,
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy')).toMatchObject({
      x: 25,
      y: 5,
      elevationFeet: 40,
      groundElevationFeet: 0,
      airborne: true,
      hp: 10,
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'controlled-descent-resolved', actorId: 'enemy', distanceFeet: 60, landed: false,
    }))
    expect(resolved.result.events.some((event) => event.type === 'falling-damage-resolved')).toBe(false)
  })

  it('asks the Host for the second d20 required by contest disadvantage', () => {
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'grapple', targetTokenId: 'enemy', targetDefense: 'athletics' }),
      map,
      characters: [{ ...hero, exhaustionLevel: 1 }],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.actorRollMode).toBe('disadvantage')
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared,
      actorD20: 18,
      actorD20Second: 1,
      targetD20: 10,
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy')?.dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ standardCondition: 'grappled' }))
  })

  it('gives the DM a production path to trigger a readied action off-turn', () => {
    const readiedHero: Character = {
      ...hero,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [],
        readiedAction: {
          trigger: '敌人进入门口时', actionKind: 'attack', targetId: 'enemy',
          preparedTurnKey: 'combat:1:hero-token',
        },
      },
    }
    const result = triggerDnd5eReadiedAction({
      combatId: 'combat',
      round: 1,
      map,
      characters: [readiedHero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'readied-action-triggered', actorId: 'hero-token', actionKind: 'attack', targetId: 'enemy',
    }))
    expect(result.application.characters[0].dnd5eCombatState?.readiedAction).toBeUndefined()
  })

  it('routes waking a Sleep target through the authoritative basic-action bridge', () => {
    const sleepingMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === 'enemy'
        ? {
            ...entry,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: ['unconscious', 'prone'],
              activeEffects: [
                createDnd5eConditionEffect({
                  condition: 'unconscious',
                  source: { kind: 'spell', actorId: 'wizard', rulesId: 'sleep' },
                  targetId: 'enemy',
                  duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
                  breakOn: ['takes-damage'],
                }),
                createDnd5eConditionEffect({
                  condition: 'prone',
                  source: { kind: 'spell', actorId: 'wizard', rulesId: 'sleep-fall-prone' },
                  targetId: 'enemy',
                  duration: { type: 'permanent' },
                }),
              ],
            },
          }
        : entry),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'wake', targetTokenId: 'enemy' }),
      map: sleepingMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy')?.dnd5eCombatState?.conditions)
      .not.toContain('unconscious')
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy')?.dnd5eCombatState?.conditions)
      .toContain('prone')
    expect(resolved.result.events).toContainEqual({
      type: 'sleeping-creature-awakened', actorId: 'hero-token', targetId: 'enemy', spellId: 'sleep',
    })
  })

  it('routes shaking a Hypnotic Pattern target through the same authoritative wake action', () => {
    const hypnotizedMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === 'enemy'
        ? {
            ...entry,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: ['charmed', 'incapacitated'],
              activeEffects: [
                createDnd5eConditionEffect({
                  id: 'hypnotic-pattern-charmed',
                  condition: 'charmed',
                  source: { kind: 'spell', actorId: 'wizard', rulesId: 'hypnotic-pattern' },
                  targetId: 'enemy',
                  duration: {
                    type: 'concentration',
                    sourceActorId: 'wizard',
                    concentrationId: 'hypnotic-pattern',
                    remainingRounds: 10,
                  },
                  breakOn: ['takes-damage', 'awakened'],
                  removal: {
                    action: { label: '摇醒受术者', economy: 'action', maxDistanceFeet: 5 },
                  },
                }),
                createDnd5eConditionEffect({
                  id: 'hypnotic-pattern-incapacitated',
                  condition: 'incapacitated',
                  source: { kind: 'spell', actorId: 'wizard', rulesId: 'hypnotic-pattern' },
                  targetId: 'enemy',
                  duration: {
                    type: 'concentration',
                    sourceActorId: 'wizard',
                    concentrationId: 'hypnotic-pattern',
                    remainingRounds: 10,
                  },
                  dependsOnEffectId: 'hypnotic-pattern-charmed',
                  modifiers: { speedPenaltyFeet: 1_000 },
                }),
              ],
            },
          }
        : entry),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'wake', targetTokenId: 'enemy' }),
      map: hypnotizedMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy')?.dnd5eCombatState?.conditions)
      .not.toEqual(expect.arrayContaining(['charmed', 'incapacitated']))
    expect(resolved.result.events).toContainEqual({
      type: 'sleeping-creature-awakened',
      actorId: 'hero-token',
      targetId: 'enemy',
      sourceRulesIds: ['hypnotic-pattern'],
    })
  })

  it('routes an Entangle escape check through the authoritative basic-action bridge', () => {
    const restrainedHero: Character = {
      ...hero,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [
          createDnd5eConditionEffect({
            id: 'entangle-restraint',
            condition: 'restrained',
            source: { kind: 'spell', actorId: 'enemy', rulesId: 'entangle' },
            targetId: 'hero-token',
            duration: {
              type: 'concentration',
              sourceActorId: 'enemy',
              concentrationId: 'entangle',
              remainingRounds: 10,
            },
            escapeCheck: { ability: 'str', dc: 14, economy: 'action' },
          }),
        ],
        concentrationEffectsBySource: { enemy: 'entangle' },
      },
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'escape-effect' }),
      map,
      characters: [restrainedHero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      actorCheckAbility: 'str',
      escapeEffectId: 'entangle-restraint',
    })
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared,
      actorD20: 20,
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ id: 'entangle-restraint' }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      ability: 'str',
      dc: 14,
      success: true,
    }))
  })

  it('spends an action and authoritatively dismisses a rules-authored self effect', () => {
    const mirrorEffect = createDnd5eConditionEffect({
      id: 'mirror-image:hero',
      condition: 'invisible',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'mirror-image' },
      targetId: 'hero-token',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      removal: {
        action: { label: '解除镜影术', economy: 'action', maxDistanceFeet: 0 },
      },
    })
    const mirrorHero: Character = {
      ...hero,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [mirrorEffect] },
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'dismiss-effect', effectId: mirrorEffect.id }),
      map,
      characters: [mirrorHero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      spendsAction: true,
      dismissEffectId: mirrorEffect.id,
    })

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ id: mirrorEffect.id }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'action', amount: 1,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-manually-removed',
      actorId: 'hero-token',
      targetId: 'hero-token',
      effectId: mirrorEffect.id,
      label: '解除镜影术',
      success: true,
    }))
  })

  it('lets the source spend an action to dismiss Warding Bond from its linked target', () => {
    const bond = createDnd5eMechanicalEffect({
      id: 'warding-bond:hero-token:ally-token',
      definitionId: 'srd-5.1:spell:warding-bond',
      label: '守护之链：AC与豁免+1，获得所有伤害抗性',
      kind: 'buff',
      source: { kind: 'spell', actorId: 'hero-token', characterId: 'hero', rulesId: 'warding-bond' },
      targetId: 'ally-token',
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      modifiers: { armorClassBonus: 1, savingThrowBonus: 1, resistanceToAllDamage: true },
    })
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
    const source = equipRing({
      ...hero,
    })
    const equippedAlly = equipRing({
      ...hero,
      id: 'ally',
      name: '盟友',
    })
    const ally: Character = {
      ...equippedAlly,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [bond],
      },
    }
    const linkedMap: BattleMap = {
      ...map,
      tokens: [
        ...map.tokens,
        { id: 'ally-token', label: '盟友', characterId: 'ally', x: 25, y: 5, color: '', emoji: '', size: 1, type: 'player', hp: 30, maxHp: 30 },
      ],
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'dismiss-warding-bond' }),
      map: linkedMap,
      characters: [source, ally],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'ally-token', label: '盟友', emoji: '', color: '', roll: 15 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(
      resolved.result.ok,
      resolved.result.ok ? undefined : `${resolved.result.reason}: ${JSON.stringify(resolved.result.events)}`,
    ).toBe(true)
    expect(resolved.application?.characters.find((character) => character.id === 'ally')
      ?.dnd5eCombatState?.activeEffects ?? []).not.toContainEqual(
        expect.objectContaining({ definitionId: 'srd-5.1:spell:warding-bond' }),
      )
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'action', amount: 1,
    }))
  })

  it('routes a source-linked fixed-DC grapple through the ordinary escape-grapple UI path', () => {
    const sourceLinkedGrapple = createDnd5eConditionEffect({
      id: 'relation:grapple:enemy:bite:hero-token',
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: 'enemy',
        rulesId: 'monster:srd-5.1:ankheg:bite:bite-grapple',
      },
      targetId: 'hero-token',
      duration: { type: 'permanent' },
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
        sourceActorId: 'enemy',
        sourceActionId: 'bite',
        slotGroup: 'bite',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
      stackingKey: 'relation:grapple:enemy:bite:hero-token',
    })
    const acrobat: Character = {
      ...hero,
      abilities: { ...hero.abilities, str: 10, dex: 18 },
      skills: ['athletics', 'acrobatics'],
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [sourceLinkedGrapple],
      },
    }
    const grappleMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === 'enemy'
        ? { ...entry, poolId: 'srd-5.1:ankheg', hp: 39, maxHp: 39 }
        : entry),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'escape-grapple', targetTokenId: 'enemy' }),
      map: grappleMap,
      characters: [acrobat],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: 'Ankheg', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      actorContestSkill: 'acrobatics',
      actorCheckAbility: 'dex',
      escapeEffectId: 'relation:grapple:enemy:bite:hero-token',
      targetDefense: undefined,
    })

    // A roll of 8 succeeds only with the selected Acrobatics modifier (+6).
    // No opposing d20 is supplied because this path resolves against fixed DC 13.
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared,
      actorD20: 8,
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      actorId: 'hero-token',
      ability: 'dex',
      skill: 'acrobatics',
      dc: 13,
      total: 14,
      success: true,
    }))
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'contest-resolved',
      contest: 'escape-grapple',
    }))
    expect(resolved.application?.characters[0].dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({
        id: 'relation:grapple:enemy:bite:hero-token',
      }))
  })
})
