import { expect, it } from 'vitest'
import { planDnd5ePersistentAreaCapacity as plan, type Dnd5ePersistentAreaCapacityPolicy } from './persistentAreaCapacity'

const policy: Dnd5ePersistentAreaCapacityPolicy = { maximumUnits: 4, unitsBySizeRank: [1, 1, 1, 4, null, null] }
const occupant = (targetId: string, sizeRank = 2) => ({ targetId, sizeRank })

it('admits four small occupants or one large occupant without inventing a random roll', () => {
  expect(plan({ policy, existing: ['a', 'b', 'c'].map(id => occupant(id)), entrant: occupant('d') }))
    .toEqual({ kind: 'ready', retainedIds: ['a', 'b', 'c', 'd'], expelledIds: [], usedUnits: 4, drawsConsumed: 0 })
  expect(plan({ policy, existing: [], entrant: occupant('large', 3) }))
    .toMatchObject({ kind: 'ready', retainedIds: ['large'], usedUnits: 4 })
})

it('requires an explicit uniform Host draw and is independent of token iteration order', () => {
  const existing = ['d', 'b', 'a', 'c'].map(id => occupant(id))
  const input = { policy, existing, entrant: occupant('e') }
  const before = structuredClone(input)
  expect(plan(input)).toEqual({ kind: 'random-selection-required', sides: 4, candidateIds: ['a', 'b', 'c', 'd'], drawIndex: 0 })
  for (let roll = 1; roll <= 4; roll++) {
    const result = plan({ ...input, randomResults: [roll] })
    expect(result).toMatchObject({ kind: 'ready', expelledIds: [['a', 'b', 'c', 'd'][roll - 1]], usedUnits: 4, drawsConsumed: 1 })
    expect(plan({ ...input, existing: [...existing].reverse(), randomResults: [roll] })).toEqual(result)
  }
  expect(input).toEqual(before)
})

it('accounts for mixed sizes and selects without replacement until the declared unit limit holds', () => {
  const input = { policy, existing: ['a', 'b', 'c', 'd'].map(id => occupant(id)), entrant: occupant('large', 3) }
  expect(plan({ ...input, randomResults: [2] })).toEqual({ kind: 'random-selection-required', sides: 3,
    candidateIds: ['a', 'c', 'd'], drawIndex: 1 })
  expect(plan({ ...input, randomResults: [2, 3, 1] })).toEqual({ kind: 'ready', retainedIds: ['large'],
    expelledIds: ['b', 'd', 'a', 'c'], usedUnits: 4, drawsConsumed: 3 })
  expect(plan({ policy, existing: [occupant('large', 3)], entrant: occupant('small') }))
    .toEqual({ kind: 'ready', retainedIds: ['small'], expelledIds: ['large'], usedUnits: 1, drawsConsumed: 0 })
})

it('does not count a repeated occupant twice or randomly expel a new admission', () => {
  expect(plan({ policy, existing: [occupant('a'), occupant('b')], entrant: occupant('a') }))
    .toMatchObject({ kind: 'ready', retainedIds: ['a', 'b'], usedUnits: 2, expelledIds: [] })
  expect(plan({ policy, existing: [occupant('a')], entrant: occupant('a', 3) }))
    .toMatchObject({ kind: 'invalid', reason: 'invalid-occupants' })
})

it.each([0, -1, 5, 1.5, NaN, Infinity])('rejects invalid random result %s before returning any settlement', roll => {
  expect(plan({ policy, existing: ['a', 'b', 'c', 'd'].map(id => occupant(id)), entrant: occupant('e'), randomResults: [roll] }))
    .toEqual({ kind: 'invalid', reason: 'invalid-random-result' })
})

it('rejects extra unused random results and unknown or unsupported size information', () => {
  expect(plan({ policy, existing: [], entrant: occupant('a'), randomResults: [1] }))
    .toMatchObject({ kind: 'invalid', reason: 'invalid-random-result' })
  expect(plan({ policy, existing: [], entrant: occupant('huge', 4) }))
    .toMatchObject({ kind: 'invalid', reason: 'unretainable-entrant' })
  for (const existing of [[occupant('a'), occupant('a')], [occupant('a', -1)], [occupant('a', NaN)], [occupant('a', 4)]]) {
    expect(plan({ policy, existing, entrant: occupant('b') })).toMatchObject({ kind: 'invalid', reason: 'invalid-occupants' })
  }
})

it.each([
  { maximumUnits: 0, unitsBySizeRank: [1, 1, 1, 1, 1, 1] },
  { maximumUnits: 4, unitsBySizeRank: [1, 1, 1] },
  { maximumUnits: 4, unitsBySizeRank: [1, 1, 1, 5, null, null] },
  { maximumUnits: 4, unitsBySizeRank: [1, 1, 1, 0, null, null] },
])('refuses invalid capacity policy %j', policy => {
  expect(plan({ policy, existing: [], entrant: occupant('a') })).toEqual({ kind: 'invalid', reason: 'invalid-policy' })
})
