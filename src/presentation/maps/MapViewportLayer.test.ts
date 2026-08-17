import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { buildMapViewportPresentation } from './MapViewportLayer'

function character(id: string, charClass: string, sourceActorId?: string): Character {
  return {
    id,
    name: id,
    player: 'player',
    avatar: 'hero',
    accent: 'blue',
    race: 'human',
    charClass,
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d8',
    ac: 10,
    initiativeBonus: 0,
    speed: 30,
    passivePerception: 10,
    inspiration: 0,
    saveDC: 12,
    conditions: [],
    equipment: {},
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...(sourceActorId ? {
      dnd5eCombatState: {
        activeEffects: [{
          schemaVersion: 1 as const,
          id: `${id}:prone`,
          definitionId: 'condition:prone',
          label: '倒地',
          kind: 'condition' as const,
          standardCondition: 'prone' as const,
          source: { kind: 'feature' as const, actorId: sourceActorId, rulesId: 'trip' },
          duration: { type: 'permanent' as const },
          appliedAt: 1,
          stackingKey: 'condition:prone',
          stackingPolicy: 'replace' as const,
        }],
      },
    } : {}),
  }
}

function token(id: string, characterId: string, x: number): Token {
  return {
    id,
    characterId,
    type: 'player',
    label: id,
    emoji: 'hero',
    color: '#fff',
    x,
    y: 50,
    size: 1,
  }
}

describe('map viewport standard condition presentation', () => {
  it('colors the same prone icon from the effect source class', () => {
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [
        token('wizard-token', 'wizard', 50),
        token('fighter-token', 'fighter', 100),
        token('wizard-target-token', 'wizard-target', 150),
        token('fighter-target-token', 'fighter-target', 200),
      ],
    }
    const presentation = buildMapViewportPresentation(map, [
      character('wizard', 'wizard'),
      character('fighter', 'fighter'),
      character('wizard-target', 'fighter', 'wizard-token'),
      character('fighter-target', 'wizard', 'fighter'),
    ])

    expect(presentation.standardConditionTokenMarks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tokenId: 'wizard-target-token', condition: 'prone',
        backgroundColor: '#071A38', borderColor: '#DBEAFE', glowColor: '#60A5FA',
      }),
      expect.objectContaining({
        tokenId: 'fighter-target-token', condition: 'prone',
        backgroundColor: '#111827', borderColor: '#F1F5F9', glowColor: '#CBD5E1',
      }),
    ]))
  })

  it('keeps two same-condition ActiveEffects as two clickable Token instances', () => {
    const target = character('target', 'fighter')
    target.dnd5eCombatState = {
      activeEffects: ['wizard-token', 'fighter-token'].map((sourceActorId, index) => ({
        schemaVersion: 1 as const,
        id: `effect:prone:${index + 1}`,
        definitionId: 'condition:prone',
        label: '倒地',
        kind: 'condition' as const,
        standardCondition: 'prone' as const,
        source: { kind: 'feature' as const, actorId: sourceActorId, rulesId: 'trip' },
        duration: { type: 'permanent' as const },
        appliedAt: index + 1,
        stackingKey: `condition:prone:${index + 1}`,
        stackingPolicy: 'stack' as const,
      })),
    }
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [
        token('wizard-token', 'wizard', 50),
        token('fighter-token', 'fighter', 100),
        token('target-token', 'target', 150),
      ],
    }

    const marks = buildMapViewportPresentation(map, [
      character('wizard', 'wizard'),
      character('fighter', 'fighter'),
      target,
    ]).standardConditionTokenMarks.filter((mark) => mark.tokenId === 'target-token')

    expect(marks.map((mark) => mark.instance.id)).toEqual([
      'effect:prone:1',
      'effect:prone:2',
    ])
    expect(marks.map((mark) => mark.borderColor)).toEqual(['#DBEAFE', '#F1F5F9'])
  })
})
