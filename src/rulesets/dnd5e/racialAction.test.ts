import { afterEach, describe, expect, it } from 'vitest'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  prepareDnd5eDragonbornBreathAction,
  resolvePreparedDnd5eDragonbornBreathAction,
} from './racialAction'

function character(id: string, patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id,
    name: id,
    player: 'P1',
    avatar: '',
    accent: '',
    race: '人类',
    charClass: '战士',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 16, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 40,
    currentHp: 40,
    tempHp: 0,
    hitDice: '5d10',
    ac: 14,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(id: string, characterId: string, x: number): Token {
  return {
    id,
    label: id,
    x,
    y: 25,
    color: '',
    emoji: '',
    size: 1,
    type: 'player',
    characterId,
  }
}

function battleMap(tokens: Token[]): BattleMap {
  return {
    id: 'racial-map',
    name: 'Racial map',
    width: 800,
    height: 300,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens,
  }
}

function action(targetTokenIds: string[]): SharedPlayerActionState {
  return {
    id: 'breath-action',
    seq: 1,
    mapId: 'racial-map',
    combatId: 'racial-combat',
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-racial-action',
    actorTokenId: 'dragonborn-token',
    characterId: 'dragonborn',
    targetTokenIds,
    targetCell: { col: 5, row: 0 },
    dnd5eRacialAction: { feature: 'dragonborn-breath' },
    round: 1,
    initiativeIndex: 0,
    updatedAt: 1,
  }
}

describe('Dragonborn breath map authority', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('rebuilds the area targets and rejects a forged target list', () => {
    const dragonbornToken = token('dragonborn-token', 'dragonborn', 25)
    const targetToken = token('target-token', 'target', 75)
    const outsideToken = token('outside-token', 'outside', 375)
    const map = battleMap([dragonbornToken, targetToken, outsideToken])
    const characters = [
      character('dragonborn', {
        race: '龙裔',
        dnd5eRaceId: 'dragonborn',
        dnd5eRacialChoices: { dragonbornAncestry: 'blue' },
      }),
      character('target'),
      character('outside'),
    ]
    const initiativeOrder = map.tokens.map((entry, index) => ({
      tokenId: entry.id,
      label: entry.label,
      emoji: entry.emoji ?? '',
      color: entry.color ?? '',
      roll: 20 - index,
    }))

    expect(prepareDnd5eDragonbornBreathAction({
      action: action([]),
      combatId: 'racial-combat',
      map,
      characters,
      initiativeOrder,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const prepared = prepareDnd5eDragonbornBreathAction({
      action: action([targetToken.id]),
      combatId: 'racial-combat',
      map,
      characters,
      initiativeOrder,
      turnEconomy: {
        turnKey: 'racial-combat:1:dragonborn-token',
        attacksUsed: 0,
        action: { current: 1, max: 1 },
        bonusAction: { current: 1, max: 1 },
        reaction: { current: 1, max: 1 },
        movement: { current: 30, max: 30 },
      },
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((entry) => entry.id)).toEqual([targetToken.id])

    const resolved = resolvePreparedDnd5eDragonbornBreathAction({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: targetToken.id, d20: 2 }],
        damageRolls: [6, 5],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(
      resolved.application?.characters.find((entry) => entry.id === 'target')?.currentHp,
    ).toBe(29)
    expect(resolved.result.events).toContainEqual({
      type: 'dragonborn-breath-resolved',
      actorId: dragonbornToken.id,
      ancestryId: 'blue',
      targetIds: [targetToken.id],
      damage: 11,
      dc: 14,
    })
  })
})
