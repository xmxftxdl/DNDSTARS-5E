import { describe, expect, it } from 'vitest'
import { dnd5eMonsterForcedMovementPayloadIsValid } from './monsterForcedMovement'

const base = {
  source: { x: 25, y: 25 },
  target: { x: 275, y: 25 },
  maximumDistanceFeet: 25,
  gridDistance: { cellUnits: 50, feetPerCell: 5 },
}

describe('monster on-hit forced movement validation', () => {
  it('accepts a straight pull toward the source', () => {
    expect(dnd5eMonsterForcedMovementPayloadIsValid({
      ...base,
      direction: 'toward-source',
      resisted: false,
      movement: {
        to: { x: 75, y: 25 },
        distanceFeet: 20,
      },
    })).toBe(true)
  })

  it('accepts an obstacle-truncated zero-distance result only at the origin', () => {
    expect(dnd5eMonsterForcedMovementPayloadIsValid({
      ...base,
      direction: 'toward-source',
      resisted: false,
      movement: {
        to: { ...base.target },
        distanceFeet: 0,
      },
    })).toBe(true)
    expect(dnd5eMonsterForcedMovementPayloadIsValid({
      ...base,
      direction: 'toward-source',
      resisted: false,
      movement: {
        to: { x: 225, y: 25 },
        distanceFeet: 0,
      },
    })).toBe(false)
  })

  it('rejects movement on a resisted effect', () => {
    expect(dnd5eMonsterForcedMovementPayloadIsValid({
      ...base,
      direction: 'toward-source',
      resisted: true,
      movement: {
        to: { x: 75, y: 25 },
        distanceFeet: 20,
      },
    })).toBe(false)
  })

  it('rejects an inverted direction or forged distance', () => {
    expect(dnd5eMonsterForcedMovementPayloadIsValid({
      ...base,
      direction: 'toward-source',
      resisted: false,
      movement: {
        to: { x: 325, y: 25 },
        distanceFeet: 5,
      },
    })).toBe(false)
    expect(dnd5eMonsterForcedMovementPayloadIsValid({
      ...base,
      direction: 'toward-source',
      resisted: false,
      movement: {
        to: { x: 75, y: 25 },
        distanceFeet: 25,
      },
    })).toBe(false)
  })
})
