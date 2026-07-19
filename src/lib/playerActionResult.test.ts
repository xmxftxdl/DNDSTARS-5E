import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import { capturePlayerActionResultBaseline, summarizePlayerActionResult } from './playerActionResult'

function character(patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'hero', name: '英雄', player: '', avatar: '', accent: '',
    race: '人类', charClass: '战士', level: 2, background: '', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 20, currentHp: 20, tempHp: 0, hitDice: '2d10', ac: 16, speed: 30, initiativeBonus: 0,
    saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

function token(patch: Partial<Token> = {}): Token {
  return { id: 'hero-token', label: '英雄', x: 25, y: 25, color: '', emoji: '', size: 1, type: 'player', characterId: 'hero', ...patch }
}

function map(entry: Token): BattleMap {
  return { id: 'map', name: '地图', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [entry] }
}

describe('D&D 5e player action result', () => {
  it('summarizes HP, class resources, conditions and death saves', () => {
    const before = capturePlayerActionResultBaseline({
      characters: [character({ classResources: { fighterSecondWind: { current: 1, max: 1 } } })],
      map: map(token()),
    })
    const after = capturePlayerActionResultBaseline({
      characters: [character({
        currentHp: 0,
        classResources: { fighterSecondWind: { current: 0, max: 1 } },
        conditions: ['unconscious'], concentrating: false, deathSaveFailures: 1,
      })],
      map: map(token()),
    })
    const summary = summarizePlayerActionResult(
      { type: 'dnd5e-weapon-attack', actorTokenId: 'hero-token', characterId: 'hero' }, before, after,
    )
    expect(summary.changedCharacters[0]).toMatchObject({
      hp: { before: 20, after: 0 },
      classResources: { fighterSecondWind: { before: 1, after: 0, max: 1 } },
      conditions: { before: [], after: ['unconscious'] },
      deathSaves: { after: { failures: 1 } },
    })
  })

  it('summarizes token movement and projected conditions without AP fields', () => {
    const before = capturePlayerActionResultBaseline({ characters: [character()], map: map(token()) })
    const after = capturePlayerActionResultBaseline({
      characters: [character()],
      map: map(token({ x: 75, dnd5eCombatState: { schemaVersion: 2, conditions: ['prone'] } })),
    })
    const summary = summarizePlayerActionResult(
      { type: 'move-token', actorTokenId: 'hero-token', characterId: 'hero' }, before, after,
    )
    expect(summary.changedTokens[0]).toMatchObject({
      position: { before: { x: 25, y: 25 }, after: { x: 75, y: 25 } },
      conditions: { before: [], after: ['prone'] },
    })
    expect(JSON.stringify(summary)).not.toMatch(/\bAP\b|currentAP|enemyApByToken/)
  })
})
