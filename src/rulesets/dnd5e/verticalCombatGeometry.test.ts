import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import {
  dnd5eCreatureHeightFeetForSizeRank,
  dnd5eInstantAoeAffectsTokenVertically,
  dnd5eMapTokenDistanceFeet,
  dnd5eTokenToPointDistanceFeet,
  dnd5eVerticalIntervalDistanceFeet,
} from './verticalCombatGeometry'

function token(id: string, patch: Partial<Token> = {}): Token {
  return {
    id,
    label: id,
    x: 0,
    y: 0,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

const map: BattleMap = {
  id: 'vertical-geometry',
  name: 'Vertical geometry',
  width: 100,
  height: 100,
  gridSize: 10,
  gridOffsetX: 0,
  gridOffsetY: 0,
  showGrid: true,
  feetPerCell: 5,
  tokens: [],
}

describe('D&D 5e vertical combat geometry', () => {
  it('uses occupied creature-height intervals for large bodies', () => {
    expect(dnd5eCreatureHeightFeetForSizeRank(2)).toBe(5)
    expect(dnd5eCreatureHeightFeetForSizeRank(3)).toBe(10)
    expect(dnd5eCreatureHeightFeetForSizeRank(4)).toBe(15)
    expect(dnd5eCreatureHeightFeetForSizeRank(5)).toBe(20)

    expect(dnd5eVerticalIntervalDistanceFeet(0, 10, 15, 5)).toBe(5)
    expect(dnd5eVerticalIntervalDistanceFeet(0, 10, 10, 5)).toBe(0)
    expect(dnd5eMapTokenDistanceFeet({
      map,
      left: token('large', { elevationFeet: 0 }),
      right: token('medium', { elevationFeet: 15 }),
      leftSizeRank: 3,
      rightSizeRank: 2,
    })).toBe(5)
  })

  it.each([
    { label: '大型 2×2', rank: 3, actorX: 50, targetX: 35 },
    { label: '超大型 3×3', rank: 4, actorX: 55, targetX: 35 },
    { label: '巨型 4×4', rank: 5, actorX: 60, targetX: 35 },
  ])('measures $label creatures from their occupied edge', ({ rank, actorX, targetX }) => {
    const actor = token('sized-actor', {
      x: actorX,
      y: 50,
      // Simulate an older persisted token whose visual size metadata was not
      // migrated. The authoritative combatant size rank must still win.
      size: 1,
    })
    const target = token('adjacent-target', {
      x: targetX,
      y: 55,
      type: 'player',
      size: 1,
    })

    expect(dnd5eMapTokenDistanceFeet({
      map,
      left: actor,
      right: target,
      leftSizeRank: rank,
      rightSizeRank: 2,
    })).toBe(5)
  })

  it('does not let a ground-only area affect a creature flying over its cell', () => {
    const sourceToken = token('caster')
    const grounded = token('grounded', { elevationFeet: 0 })
    const flying = token('flying', { elevationFeet: 10 })
    const area = {
      shape: 'circle' as const,
      origin: 'point' as const,
      radiusFeet: 10,
      placeRangeFeet: 60,
    }
    const common = {
      spellId: 'grease',
      area,
      map,
      sourceToken,
      effectOrigin: { x: 0, y: 0 },
      effectOriginElevationFeet: 0,
    }

    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: grounded,
    })).toBe(true)
    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: flying,
    })).toBe(false)
  })

  it('projects a point volume against the token body rather than its feet', () => {
    const medium = token('medium', { elevationFeet: 25, creatureSize: '中型' })
    const large = token('large', { elevationFeet: 25, creatureSize: '大型' })
    expect(dnd5eTokenToPointDistanceFeet({
      token: medium,
      pointElevationFeet: 40,
      horizontalDistanceFeet: 0,
      sizeRank: 2,
    })).toBe(10)
    expect(dnd5eTokenToPointDistanceFeet({
      token: large,
      pointElevationFeet: 40,
      horizontalDistanceFeet: 0,
      sizeRank: 3,
    })).toBe(5)

    const area = {
      shape: 'circle' as const,
      origin: 'point' as const,
      radiusFeet: 5,
      placeRangeFeet: 60,
    }
    const common = {
      spellId: 'fireball',
      area,
      map,
      sourceToken: token('caster'),
      effectOrigin: { x: 0, y: 0 },
      effectOriginElevationFeet: 40,
    }
    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: large,
    })).toBe(true)
    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: medium,
    })).toBe(false)
  })

  it('limits explicit vertical columns to their configured height', () => {
    const common = {
      spellId: 'moonbeam',
      area: {
        shape: 'circle' as const,
        origin: 'point' as const,
        radiusFeet: 5,
        placeRangeFeet: 120,
      },
      map,
      sourceToken: token('caster'),
      effectOrigin: { x: 0, y: 0 },
      effectOriginElevationFeet: 0,
    }
    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: token('inside', { elevationFeet: 39 }),
    })).toBe(true)
    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: token('above', { elevationFeet: 41 }),
    })).toBe(false)
  })

  it('pitches a line through occupied creature height and preserves a flat line', () => {
    const sourceToken = token('caster', { x: 0, y: 0, elevationFeet: 0 })
    const airborne = token('airborne', { x: 30, y: 0, elevationFeet: 15 })
    const grounded = token('grounded', { x: 30, y: 0, elevationFeet: 0 })
    const area = {
      shape: 'line' as const,
      origin: 'self' as const,
      widthFeet: 5,
      lengthFeet: 30,
    }
    const common = {
      spellId: 'lightning-bolt',
      area,
      map,
      sourceToken,
      effectOrigin: sourceToken,
      effectOriginElevationFeet: 0,
      effectAim: { x: 60, y: 0 },
    }

    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: airborne,
      effectAimElevationFeet: 30,
    })).toBe(true)
    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: grounded,
      effectAimElevationFeet: 30,
    })).toBe(false)
    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: grounded,
      effectAimElevationFeet: 0,
    })).toBe(true)
  })

  it('pitches a cone as a finite widening volume instead of a full-height column', () => {
    const sourceToken = token('caster', { x: 0, y: 0, elevationFeet: 0 })
    const airborne = token('airborne', { x: 30, y: 0, elevationFeet: 25 })
    const grounded = token('grounded', { x: 30, y: 0, elevationFeet: 0 })
    const common = {
      spellId: 'burning-hands',
      area: {
        shape: 'cone' as const,
        origin: 'self' as const,
        lengthFeet: 40,
      },
      map,
      sourceToken,
      effectOrigin: sourceToken,
      effectOriginElevationFeet: 0,
      effectAim: { x: 60, y: 0 },
      effectAimElevationFeet: 60,
    }

    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: airborne,
    })).toBe(true)
    expect(dnd5eInstantAoeAffectsTokenVertically({
      ...common,
      targetToken: grounded,
    })).toBe(false)
  })
})
