import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { dnd5eLegendaryActionWindowCandidates } from './legendaryActionWindow'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token', label: 'Token', type: 'enemy', x: 0, y: 0,
    color: '#fff', emoji: '', size: 1, hp: 100, maxHp: 100,
    ...patch,
  }
}

function map(tokens: Token[]): BattleMap {
  return {
    id: 'legendary-map', name: 'Legendary map', width: 500, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5,
    showGrid: true, tokens,
  }
}

describe('legendary action end-turn window', () => {
  it('reports explicit current/maximum points and action costs', () => {
    const ending = token({ id: 'hero', label: 'Hero', type: 'player', characterId: 'hero-char' })
    const aboleth = token({
      id: 'aboleth', label: 'Aboleth', poolId: 'srd-5.1:aboleth',
      dnd5eCombatState: { monsterLegendaryActionPoints: 2 },
    })
    const [candidate] = dnd5eLegendaryActionWindowCandidates({
      map: map([ending, aboleth]),
      endingTokenId: ending.id,
    })
    expect(candidate).toMatchObject({
      token: { id: 'aboleth' },
      currentPoints: 2,
      maximumPoints: 3,
    })
    expect(candidate.actions.find((action) => action.id === 'tail-swipe')).toMatchObject({
      cost: 1,
      affordable: true,
      windowExecution: 'targeted-attack',
    })
  })

  it('does not prompt a creature on its own turn or after all points are spent', () => {
    const aboleth = token({
      id: 'aboleth', poolId: 'srd-5.1:aboleth',
      dnd5eCombatState: { monsterLegendaryActionPoints: 0 },
    })
    const hero = token({ id: 'hero', type: 'player', characterId: 'hero-char' })
    expect(dnd5eLegendaryActionWindowCandidates({
      map: map([hero, aboleth]), endingTokenId: hero.id,
    })).toEqual([])
    expect(dnd5eLegendaryActionWindowCandidates({
      map: map([{ ...aboleth, dnd5eCombatState: { monsterLegendaryActionPoints: 3 } }, hero]),
      endingTokenId: aboleth.id,
    })).toEqual([])
  })

  it('routes the structured Detect check to Headless without demanding a target', () => {
    const [candidate] = dnd5eLegendaryActionWindowCandidates({
      map: map([token({ id: 'dragon', poolId: 'srd-5.1:adult-black-dragon' })]),
      endingTokenId: 'hero',
    })
    expect(candidate.actions.find(action => action.id === 'detect')).toMatchObject({
      automation: 'headless', windowExecution: 'ability-check', cost: 1,
    })
  })

  it('does not offer a legendary action while Time Stop suspends the creature', () => {
    const hero = token({ id: 'hero', type: 'player', characterId: 'hero-char' })
    const dragon = token({
      id: 'dragon', label: 'Ancient Gold Dragon',
      poolId: 'srd-5.1:ancient-gold-dragon',
      dnd5eCombatState: {
        monsterLegendaryActionPoints: 3,
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'activity-extra-turns:suspension:group-1',
          label: '时间停止：暂停行动与反应',
          source: {
            kind: 'spell', rulesId: 'time-stop-extra-turns', actorId: hero.id,
          },
          targetId: 'dragon',
        })],
      },
    })

    expect(dnd5eLegendaryActionWindowCandidates({
      map: map([hero, dragon]), endingTokenId: hero.id,
    })).toEqual([])
  })

  it('routes Sphinx teleport and spellcasting to interactive Headless choices', () => {
    const ending = token({ id: 'hero', type: 'player', characterId: 'hero-char' })
    const sphinx = token({
      id: 'sphinx',
      label: 'Gynosphinx',
      poolId: 'srd-5.1:gynosphinx',
      dnd5eCombatState: { monsterLegendaryActionPoints: 3 },
    })
    const [candidate] = dnd5eLegendaryActionWindowCandidates({
      map: map([ending, sphinx]),
      endingTokenId: ending.id,
    })

    expect(candidate.actions.find((action) =>
      action.id === 'teleport-costs-2-actions')).toMatchObject({
      cost: 2,
      affordable: true,
      windowExecution: 'teleport-placement',
    })
    expect(candidate.actions.find((action) =>
      action.id === 'cast-a-spell-costs-3-actions')).toMatchObject({
      automation: 'headless',
      cost: 3,
      affordable: true,
      windowExecution: 'spell-selection',
    })
  })

  it('routes the Lich Cantrip action to a one-point spell choice', () => {
    const ending = token({ id: 'hero', type: 'player', characterId: 'hero-char' })
    const lich = token({
      id: 'lich',
      label: 'Lich',
      poolId: 'srd-5.1:lich',
      dnd5eCombatState: { monsterLegendaryActionPoints: 2 },
    })
    const [candidate] = dnd5eLegendaryActionWindowCandidates({
      map: map([ending, lich]),
      endingTokenId: ending.id,
    })

    expect(candidate.actions.find((action) => action.id === 'cantrip')).toMatchObject({
      automation: 'headless',
      cost: 1,
      affordable: true,
      windowExecution: 'spell-selection',
    })
  })
})
