import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  planDnd5eSummonedCreature,
  rebaseDnd5eSummonedCreatureTokens,
  reconcileDnd5eSummonedCreatures,
} from './summonedCreatures'

function map(tokens: Token[]): BattleMap {
  return {
    id: 'map-1', name: '召唤测试', width: 500, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens,
  }
}

const actor: Token = {
  id: 'actor-token', label: '施法者', x: 25, y: 25, color: '#fff', emoji: 'A',
  size: 1, type: 'player', characterId: 'actor',
}

function source(concentrationSpellId?: string): Character {
  return {
    id: 'actor', name: '施法者', player: '玩家', avatar: '', accent: '', race: '人类', charClass: '法师',
    level: 5, background: '学者', experience: 0, reputation: 0,
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
    savingThrows: [], skills: [], maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '5d6',
    ac: 13, speed: 30, initiativeBonus: 0, saveDC: 14, passivePerception: 10, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eCombatState: concentrationSpellId ? { concentrationSpellId } : undefined,
  }
}

describe('D&D 5e summoned creature lifecycle', () => {
  it('creates an allied SRD creature at an unoccupied cell with authoritative initiative', () => {
    const result = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'com.example:wolf', pluginId: 'com.example', actionId: 'action-1', round: 2,
      targetCell: { col: 2, row: 1 }, initiativeD20: 12,
      summon: { monsterId: 'srd-5.1:wolf', durationRounds: 10, concentration: true, side: 'ally' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.token).toMatchObject({
      id: 'plugin-summon:action-1', poolId: 'srd-5.1:wolf', type: 'enemy', hp: 11, maxHp: 11,
      dnd5eSummon: {
        sourceCharacterId: 'actor', createdRound: 2, expiresAfterRound: 11,
        concentrationId: 'plugin-summon:action-1', side: 'player',
      },
    })
    expect(result.plan.initiativeEntry).toMatchObject({ tokenId: 'plugin-summon:action-1', roll: 14 })
  })

  it('rejects occupied placement before the action can spend resources', () => {
    const result = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'com.example:wolf', pluginId: 'com.example', actionId: 'action-1', round: 1,
      targetCell: { col: 0, row: 0 }, initiativeD20: 10,
      summon: { monsterId: 'srd-5.1:wolf', durationRounds: 1 },
    })
    expect(result).toEqual({ ok: false, reason: 'summon-position-blocked' })
  })

  it('rebases summon commits without rolling back unrelated token changes', () => {
    const summon = { ...actor, id: 'plugin-summon:action-1', x: 125, label: '狼', characterId: undefined }
    const latestActor = { ...actor, x: 75, hp: 17 }
    const target = { ...actor, id: 'target', characterId: 'target-character', x: 175, hp: 8 }
    const resolvedTarget = { ...target, hp: 3 }
    const tokens = rebaseDnd5eSummonedCreatureTokens({
      latestMap: map([latestActor, target]),
      resolvedTokens: [actor, resolvedTarget, summon],
      changedTokenIds: ['target', summon.id],
      summonedToken: summon,
    })
    expect(tokens.find((token) => token.id === actor.id)).toMatchObject({ x: 75, hp: 17 })
    expect(tokens.find((token) => token.id === target.id)?.hp).toBe(3)
    expect(tokens.filter((token) => token.id === summon.id)).toHaveLength(1)
  })

  it('removes a summon when concentration ends, duration expires, or it reaches 0 HP', () => {
    const planned = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'com.example:wolf', pluginId: 'com.example', actionId: 'action-1', round: 1,
      targetCell: { col: 2, row: 0 }, initiativeD20: 10,
      summon: { monsterId: 'srd-5.1:wolf', durationRounds: 2, concentration: true },
    })
    if (!planned.ok) throw new Error(planned.reason)
    const activeMap = map([actor, planned.plan.token])
    expect(reconcileDnd5eSummonedCreatures({
      map: activeMap, characters: [source('plugin-summon:action-1')], round: 2,
    }).removedTokenIds).toEqual([])
    expect(reconcileDnd5eSummonedCreatures({
      map: activeMap, characters: [source()], round: 2,
    }).removedTokenIds).toEqual(['plugin-summon:action-1'])
    expect(reconcileDnd5eSummonedCreatures({
      map: activeMap, characters: [source('plugin-summon:action-1')], round: 3,
    }).removedTokenIds).toEqual(['plugin-summon:action-1'])
    expect(reconcileDnd5eSummonedCreatures({
      map: { ...activeMap, tokens: [actor, { ...planned.plan.token, hp: 0 }] },
      characters: [source('plugin-summon:action-1')], round: 2,
    }).removedTokenIds).toEqual(['plugin-summon:action-1'])
  })
})
