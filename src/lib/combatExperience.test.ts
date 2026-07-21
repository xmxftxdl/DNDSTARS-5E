import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import {
  createCombatExperienceDraft,
  createCombatExperienceSettlement,
  evenCombatExperienceAwards,
  validateCombatExperienceAwards,
} from './combatExperience'

function character(id: string): Character {
  return {
    id, name: id, player: id, avatar: '🧙', accent: 'blue', race: '人类', charClass: '战士', level: 1,
    background: '', experience: 10, reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [], skills: [], maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '1d10',
    ac: 10, speed: 30, initiativeBonus: 0, saveDC: 10, passivePerception: 10,
    inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

function token(input: Partial<Token> & Pick<Token, 'id' | 'type'>): Token {
  return {
    label: input.id, x: 0, y: 0, color: '#fff', emoji: 'x', size: 1,
    ...input,
  }
}

function map(tokens: Token[]): BattleMap {
  return {
    id: 'map', name: 'map', width: 100, height: 100, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, tokens,
  }
}

describe('combat experience settlement', () => {
  it('totals defeated SRD monsters and excludes living enemies and summons', () => {
    const first = character('first')
    const second = character('second')
    const battlefield = map([
      token({ id: 'p1', type: 'player', characterId: first.id }),
      token({ id: 'p2', type: 'player', characterId: second.id }),
      token({ id: 'goblin', type: 'enemy', poolId: 'srd-5.1:goblin', hp: 0, maxHp: 7 }),
      token({ id: 'ogre', type: 'enemy', poolId: 'srd-5.1:ogre', hp: 1, maxHp: 59 }),
      token({
        id: 'summon', type: 'enemy', poolId: 'srd-5.1:wolf', hp: 0, maxHp: 11,
        dnd5eSummon: { schemaVersion: 1, pluginId: 'p', featureId: 'f', sourceCharacterId: first.id, sourceTokenId: 'p1', createdRound: 1, expiresAfterRound: 10, side: 'enemy' },
      }),
    ])
    const draft = createCombatExperienceDraft({
      combatId: 'combat', map: battlefield, characters: [first, second],
      initiativeTokenIds: ['p2', 'goblin', 'p1', 'ogre', 'summon'],
    })
    expect(draft.totalXp).toBe(50)
    expect(draft.defeatedMonsters).toEqual([
      expect.objectContaining({ tokenId: 'goblin', challengeRating: '1/4', xp: 50 }),
    ])
    expect(draft.participants.map((entry) => entry.characterId)).toEqual(['second', 'first'])
  })

  it('keeps the full integer total when an even split has a remainder', () => {
    const draft = {
      combatId: 'c', mapId: 'm', defeatedMonsters: [], totalXp: 100,
      participants: [character('a'), character('b'), character('c')].map((entry) => ({
        characterId: entry.id, name: entry.name, experienceBefore: entry.experience,
      })),
    }
    const awards = evenCombatExperienceAwards(draft)
    expect(awards.map((award) => award.xp)).toEqual([34, 33, 33])
    expect(validateCombatExperienceAwards(draft, awards)).toBe(true)
  })

  it('rejects duplicate, fractional, negative or incomplete manual awards', () => {
    const draft = {
      combatId: 'c', mapId: 'm', defeatedMonsters: [], totalXp: 50,
      participants: [
        { characterId: 'a', name: 'A', experienceBefore: 0 },
        { characterId: 'b', name: 'B', experienceBefore: 0 },
      ],
    }
    expect(validateCombatExperienceAwards(draft, [
      { characterId: 'a', characterName: 'A', xp: 25 },
      { characterId: 'a', characterName: 'A', xp: 25 },
    ])).toBe(false)
    expect(createCombatExperienceSettlement({
      draft, mode: 'manual', awards: [
        { characterId: 'a', characterName: 'A', xp: 20 },
        { characterId: 'b', characterName: 'B', xp: 20 },
      ],
    })).toBeUndefined()
  })
})
