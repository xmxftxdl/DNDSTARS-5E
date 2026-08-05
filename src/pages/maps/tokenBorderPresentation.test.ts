import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  DND5E_MONSTER_TOKEN_BORDER_COLOR,
  buildDnd5eTokenBorderPresentations,
  buildDnd5eTokenPresentationColors,
  dnd5eTokenBorderPresentation,
  dnd5eTokenPresentationColor,
} from './tokenBorderPresentation'

function token(id: string, patch: Partial<Token> = {}): Token {
  return {
    id,
    label: id,
    x: 25,
    y: 25,
    color: '#ffffff',
    emoji: '',
    size: 1,
    type: 'player',
    ...patch,
  }
}

function wizard(): Character {
  return {
    id: 'wizard',
    charClass: 'wizard',
    dnd5eClassLevels: { wizard: 5 },
  } as Character
}

describe('map Token class presentation colors', () => {
  it('uses the exact class primary instead of the light palette border', () => {
    expect(dnd5eTokenPresentationColor(
      token('wizard-token', { characterId: 'wizard' }),
      wizard(),
    )).toBe('#3B82F6')
  })

  it('uses the shared monster red regardless of a monster token custom color', () => {
    expect(dnd5eTokenPresentationColor(
      token('monster', { type: 'enemy', color: '#00ff00' }),
    )).toBe('#EF4444')
    expect(DND5E_MONSTER_TOKEN_BORDER_COLOR).toBe('#EF4444')
  })

  it('carries the complete spell-portrait palette into the map frame', () => {
    expect(dnd5eTokenBorderPresentation(
      token('wizard-token', { characterId: 'wizard' }),
      wizard(),
    )).toEqual({
      background: '#3B82F6',
      backgroundDeep: '#071A38',
      accent: '#DBEAFE',
      glow: '#60A5FA',
      classId: 'wizard',
    })
    expect(dnd5eTokenBorderPresentation(
      token('monster', { type: 'enemy', color: '#00ff00' }),
    )).toEqual({
      background: '#7F1D1D',
      backgroundDeep: '#170506',
      accent: '#FECACA',
      glow: '#EF4444',
      classId: 'monster',
    })
  })

  it('builds rings for creatures while excluding obstacles and spell-effect anchors', () => {
    expect(buildDnd5eTokenPresentationColors([
      token('wizard-token', { characterId: 'wizard' }),
      token('monster', { type: 'enemy', color: '#00ff00' }),
      token('npc', { type: 'npc', color: '#14b8a6' }),
      token('wall', { type: 'obstacle' }),
      token('sphere', {
        type: 'npc',
        dnd5eSpellEffect: {
          schemaVersion: 1,
          spellId: 'flaming-sphere',
          sourceCharacterId: 'wizard',
          sourceTokenId: 'wizard-token',
          createdRound: 1,
          expiresAfterRound: 10,
        },
      }),
    ], [wizard()])).toEqual({
      'wizard-token': '#3B82F6',
      monster: '#EF4444',
      npc: '#14b8a6',
    })
  })

  it('builds full portrait frames while excluding obstacles and spell effects', () => {
    expect(buildDnd5eTokenBorderPresentations([
      token('wizard-token', { characterId: 'wizard' }),
      token('monster', { type: 'enemy' }),
      token('wall', { type: 'obstacle' }),
      token('sphere', {
        type: 'npc',
        dnd5eSpellEffect: {
          schemaVersion: 1,
          spellId: 'flaming-sphere',
          sourceCharacterId: 'wizard',
          sourceTokenId: 'wizard-token',
          createdRound: 1,
          expiresAfterRound: 10,
        },
      }),
    ], [wizard()])).toEqual({
      'wizard-token': {
        background: '#3B82F6',
        backgroundDeep: '#071A38',
        accent: '#DBEAFE',
        glow: '#60A5FA',
        classId: 'wizard',
      },
      monster: {
        background: '#7F1D1D',
        backgroundDeep: '#170506',
        accent: '#FECACA',
        glow: '#EF4444',
        classId: 'monster',
      },
    })
  })
})
