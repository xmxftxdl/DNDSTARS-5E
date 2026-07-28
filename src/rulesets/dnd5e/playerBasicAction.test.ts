import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createDnd5eConditionEffect } from './activeEffects'
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
    expect(resolved.result.ok).toBe(true)
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
