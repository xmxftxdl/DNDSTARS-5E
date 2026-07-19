import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { DND5E_FIGHTER_STARTING_EQUIPMENT } from './equipment'
import {
  findDnd5eOpportunityAttackersForMove,
  prepareDnd5eOpportunityAttack,
  previewDnd5eOpportunityAttack,
  resolvePreparedDnd5eOpportunityAttack,
} from './opportunityAttackAction'

function hero(): Character {
  return {
    id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '人类', charClass: '战士', level: 3,
    background: '', experience: 0, reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '3d10', ac: 16, speed: 30, initiativeBonus: 1,
    saveDC: 0, passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

function fixture() {
  const character = hero()
  const map: BattleMap = {
    id: 'map', name: '地图', width: 200, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, feetPerCell: 5,
    tokens: [
      { id: 'kobold', label: '狗头人', poolId: 'srd-5.1:kobold', x: 5, y: 5, color: '', emoji: '', size: 1, type: 'enemy', hp: 5, maxHp: 5 },
      { id: 'hero-token', label: '英雄', characterId: 'hero', x: 15, y: 5, color: '', emoji: '', size: 1, type: 'player', hp: 30, maxHp: 30 },
    ],
  }
  const initiativeOrder = [
    { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
    { tokenId: 'kobold', label: '狗头人', emoji: '', color: '', roll: 10 },
  ]
  return { character, map, initiativeOrder }
}

describe('D&D 5e opportunity attack bridge', () => {
  it('detects leaving reach from reaction availability rather than AP', () => {
    const { character, map } = fixture()
    expect(findDnd5eOpportunityAttackersForMove({
      map,
      characters: [character],
      movingToken: map.tokens[1],
      to: { x: 45, y: 5 },
      turnEconomyByToken: {},
    }).map((token) => token.id)).toEqual(['kobold'])
  })

  it('spends a reaction in the 5e Headless engine and leaves legacy AP untouched', () => {
    const { character, map, initiativeOrder } = fixture()
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eOpportunityAttack({ prepared: prepared.prepared, d20: 20, damageRolls: [2, 3] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'turn-resource-spent', resource: 'reaction' }))
    expect(resolved.application?.characters[0].currentHp).toBeLessThan(30)
  })

  it('forces disadvantage on opportunity attacks against a Hunter with Escape the Horde', () => {
    const { character, map, initiativeOrder } = fixture()
    const ranger: Character = {
      ...character,
      charClass: '游侠',
      level: 7,
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'defensive-tactics': ['escape-the-horde'] } } },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [ranger], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
    expect(previewDnd5eOpportunityAttack(prepared.prepared, 20, 2).hit).toBe(false)
    const resolved = resolvePreparedDnd5eOpportunityAttack({
      prepared: prepared.prepared, d20: 20, d20Second: 2, damageRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(30)
  })

  it('prepares Berserker Retaliation only for a level-14 Berserker in melee reach', () => {
    const { character, map, initiativeOrder } = fixture()
    const berserker: Character = {
      ...character,
      charClass: '野蛮人',
      level: 14,
      equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
      dnd5eClassChoices: { classes: { barbarian: { subclass: 'berserker', selections: {} } } },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [berserker], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('berserker-turn', 30),
      reactionFeature: 'berserker-retaliation',
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.reactionFeature).toBe('berserker-retaliation')
    const resolved = resolvePreparedDnd5eOpportunityAttack({
      prepared: prepared.prepared, d20: 15, damageRolls: [5],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'reaction',
    }))

    const invalid = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('fighter-turn', 30),
      reactionFeature: 'berserker-retaliation',
    })
    expect(invalid).toEqual({ ok: false, reason: 'invalid-actor' })
  })

  it('prepares Hunter Giant Killer only when the Hunter selected it', () => {
    const { character, map, initiativeOrder } = fixture()
    const hunter: Character = {
      ...character,
      charClass: '游侠',
      level: 3,
      equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'hunters-prey': ['giant-killer'] } } },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [hunter], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('hunter-turn', 30),
      reactionFeature: 'hunter-giant-killer',
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.reactionFeature).toBe('hunter-giant-killer')
    const resolved = resolvePreparedDnd5eOpportunityAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'reaction',
    })

    const invalid = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [{ ...hunter, dnd5eClassChoices: { classes: { ranger: { subclass: 'hunter', selections: {} } } } }], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('hunter-turn', 30),
      reactionFeature: 'hunter-giant-killer',
    })
    expect(invalid).toEqual({ ok: false, reason: 'invalid-actor' })
  })
})
