import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  isMirrorImageDecoyToken,
  reconcileMirrorImageDecoyProjections,
} from './mirrorImageDecoyProjection'

function sourceToken(patch: Partial<Token> = {}): Token {
  return {
    id: 'wizard-token', label: '法师', x: 350, y: 350, color: '#60a5fa', emoji: '🧙',
    size: 1, type: 'player', characterId: 'wizard', ...patch,
  }
}

function map(tokens: Token[]): BattleMap {
  return {
    id: 'map', name: 'Map', width: 700, height: 700, gridSize: 70,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens,
  }
}

function wizard(remaining: number): Character {
  const mirrorImage = createDnd5eMechanicalEffect({
    id: 'mirror-image-effect',
    definitionId: 'activity:spell:mirror-image:mirror-image:modifiers:0',
    label: '镜影术',
    targetId: 'wizard-token',
    source: { kind: 'spell', actorId: 'wizard-token', rulesId: 'mirror-image', spellLevel: 2 },
    duration: { type: 'rounds', remainingRounds: 10, tickOn: 'source-turn-end' },
    modifiers: {
      attackDecoys: {
        remaining,
        redirectMinimumD20: [11, 8, 6],
        armorClassBase: 10,
        armorClassAbility: 'dex',
        requiresOrdinarySight: true,
      },
    },
  })
  return {
    id: 'wizard', name: '法师', avatar: '🧙', currentHp: 20, maxHp: 20, tempHp: 0,
    dnd5eCombatState: { activeEffects: [mirrorImage] },
  } as Character
}

describe('Mirror Image map decoy projection', () => {
  it('creates one movable non-creature Token per authoritative remaining image', () => {
    const result = reconcileMirrorImageDecoyProjections({
      map: map([sourceToken()]),
      characters: [wizard(3)],
      round: 2,
    })
    const decoys = result.map.tokens.filter(isMirrorImageDecoyToken)
    expect(decoys).toHaveLength(3)
    expect(decoys.map((token) => token.dnd5eSpellEffect?.projectionIndex)).toEqual([1, 2, 3])
    expect(decoys.every((token) => token.type === 'obstacle' && token.obstacleKind === 'marker')).toBe(true)
    expect(decoys.every((token) => token.dnd5eSpellEffect?.sourceEffectId === 'mirror-image-effect')).toBe(true)
  })

  it('preserves DM placement, ignores source movement, and removes only excess images', () => {
    const initial = reconcileMirrorImageDecoyProjections({
      map: map([sourceToken()]), characters: [wizard(3)], round: 2,
    }).map
    const firstDecoy = initial.tokens.find((token) => token.dnd5eSpellEffect?.projectionIndex === 1)!
    const movedTokens = initial.tokens.map((token) => token.id === firstDecoy.id
      ? { ...token, x: 120, y: 160 }
      : token.id === 'wizard-token'
        ? { ...token, x: 560, y: 560 }
        : token)
    const reconciled = reconcileMirrorImageDecoyProjections({
      map: map(movedTokens), characters: [wizard(2)], round: 4,
    })
    const decoys = reconciled.map.tokens.filter(isMirrorImageDecoyToken)
    expect(decoys).toHaveLength(2)
    expect(decoys.find((token) => token.id === firstDecoy.id)).toMatchObject({ x: 120, y: 160 })
    expect(decoys[0]?.dnd5eSpellEffect?.createdRound).toBe(2)
    expect(reconciled.removedTokenIds).toHaveLength(1)
    expect(reconcileMirrorImageDecoyProjections({
      map: reconciled.map, characters: [wizard(2)], round: 5,
    }).changed).toBe(false)
  })

  it('removes all projection Tokens when the mechanical effect ends', () => {
    const initial = reconcileMirrorImageDecoyProjections({
      map: map([sourceToken()]), characters: [wizard(3)], round: 2,
    }).map
    const result = reconcileMirrorImageDecoyProjections({
      map: initial,
      characters: [{ ...wizard(3), dnd5eCombatState: { activeEffects: [] } }],
      round: 3,
    })
    expect(result.map.tokens.filter(isMirrorImageDecoyToken)).toHaveLength(0)
    expect(result.removedTokenIds).toHaveLength(3)
  })
})
