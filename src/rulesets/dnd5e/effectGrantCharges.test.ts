import { expect, it } from 'vitest'
import { createDnd5eEffectGrantCharges, normalizeDnd5eEffectGrantCharges, spendDnd5eEffectGrantCharge,
  dnd5eEffectGrantChargeLight, type Dnd5eEffectGrantChargeDeclaration } from './effectGrantCharges'

const stars: Dnd5eEffectGrantChargeDeclaration = { initial: 7, baseCastLevel: 7, additionalPerSlotLevel: 2, endWhenEmpty: true,
  lightTiers: [{ minimumRemaining: 1, brightRadiusFeet: 0, dimRadiusFeet: 30, color: '#ffffff' },
    { minimumRemaining: 4, brightRadiusFeet: 30, dimRadiusFeet: 30, color: '#ffffff' }] }

it('creates 7/9/11 independent charges for the three legal casting levels', () => {
  for (const [level, count] of [[7,7],[8,9],[9,11]]) expect(createDnd5eEffectGrantCharges(stars, level)).toMatchObject({ current: count, maximum: count })
  for (const level of [undefined, 6, 10, NaN, 7.5]) expect(createDnd5eEffectGrantCharges(stars, level)).toBeUndefined()
})

it('preserves spent counts across reload and changes illumination at 4/3 and 1/0 without replenishing', () => {
  let state = createDnd5eEffectGrantCharges(stars, 7)!
  for (let left = 7; left > 0; left--) {
    expect(dnd5eEffectGrantChargeLight(state)).toEqual({ brightRadiusFeet: left >= 4 ? 30 : 0, dimRadiusFeet: 30, color: '#ffffff' })
    const before = structuredClone(state), result = spendDnd5eEffectGrantCharge(state)
    expect(state).toEqual(before)
    expect(result.ok).toBe(true)
    if (!result.ok) throw Error('Unexpected rejection')
    expect(result.endEffect).toBe(left === 1)
    state = normalizeDnd5eEffectGrantCharges(JSON.parse(JSON.stringify(result.charges)))!
    expect(state.current).toBe(left-1)
  }
  expect(dnd5eEffectGrantChargeLight(state)).toBeUndefined()
  expect(spendDnd5eEffectGrantCharge(state)).toEqual({ ok: false })
})

it('rejects malformed counts and ambiguous lighting thresholds', () => {
  const state = createDnd5eEffectGrantCharges(stars, 7)!
  for (const current of [-1,8,0.5,NaN,'7']) expect(normalizeDnd5eEffectGrantCharges({ ...state, current })).toBeUndefined()
  expect(normalizeDnd5eEffectGrantCharges({ ...state, lightTiers: [state.lightTiers![0],state.lightTiers![0]] })).toBeUndefined()
  expect(createDnd5eEffectGrantCharges({ ...stars, additionalPerSlotLevel: undefined }, 7)).toBeUndefined()
  expect(createDnd5eEffectGrantCharges({ initial: 1, endWhenEmpty: true })).toMatchObject({ current: 1, maximum: 1 })
})

it('atomically spends an explicit cost and rejects insufficient or malformed costs', () => {
  const pool = { current: 2, maximum: 6, endWhenEmpty: true as const }
  expect(spendDnd5eEffectGrantCharge(pool, 2)).toEqual({ ok: true, charges: { ...pool, current: 0 }, endEffect: true })
  for (const cost of [0, -1, 1.5, NaN, Infinity, 3, 1001]) expect(spendDnd5eEffectGrantCharge(pool, cost)).toEqual({ ok: false })
  expect(pool.current).toBe(2)
})
