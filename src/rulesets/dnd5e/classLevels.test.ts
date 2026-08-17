import { describe, expect, it } from 'vitest'
import { normalizeDnd5eClassLevels } from './classLevels'

describe('D&D 5e class level normalization', () => {
  it('repairs a stale single-class level map after the starting class changed', () => {
    expect(normalizeDnd5eClassLevels({
      charClass: '法师',
      level: 5,
      dnd5eClassLevels: { fighter: 5 },
    })).toEqual({ wizard: 5 })
  })

  it('preserves a valid multiclass level map containing the starting class', () => {
    expect(normalizeDnd5eClassLevels({
      charClass: '法师',
      level: 5,
      dnd5eClassLevels: { wizard: 3, fighter: 2 },
    })).toEqual({ wizard: 3, fighter: 2 })
  })
})
