import { describe, expect, it } from 'vitest'
import { dnd5eMovementAuthorityStamp as stamp } from './movementAuthorityStamp'

describe('movement authority identity across durable reloads', () => {
  const state = { round: 1, tokens: [{ id: 'hero', x: 275, y: 275 }],
    characters: [{ id: 'hero', hp: 20, effects: [{ id: 'save', dc: 10 }] }] }

  it('accepts equivalent nested objects reconstructed in a different field order', () => {
    expect(stamp(state)).toBe(stamp({ characters: [{ effects: [{ dc: 10, id: 'save' }],
      hp: 20, id: 'hero' }], tokens: [{ y: 275, x: 275, id: 'hero' }], round: 1 }))
  })

  it('still invalidates changes to settlement inputs', () => {
    for (const mutate of [
      (copy: typeof state) => { copy.round++ },
      (copy: typeof state) => { copy.tokens[0].x++ },
      (copy: typeof state) => { copy.characters[0].hp-- },
      (copy: typeof state) => { copy.characters[0].effects[0].dc++ },
      (copy: typeof state) => { copy.characters[0].effects = [] },
    ]) {
      const copy = structuredClone(state)
      mutate(copy)
      expect(stamp(copy)).not.toBe(stamp(state))
    }
  })

  it('preserves array order and distinctions between absent, null and zero', () => {
    expect(stamp({ order: ['a', 'b'] })).not.toBe(stamp({ order: ['b', 'a'] }))
    expect(stamp({ value: null })).not.toBe(stamp({}))
    expect(stamp({ value: 0 })).not.toBe(stamp({ value: null }))
  })
})
