import { expect, it } from 'vitest'
import { readCustomItemMaterial, writeCustomItemMaterial } from './customItemMaterial'

it('preserves other ingredient identities while editing metal qualification and exact copper value', () => {
  const source = { cost: { amount: 3, currency: 'gp' as const }, spellcastingMaterial: { tags: ['silver', 'material:contains-metal'], unitValueGp: 5 } }
  expect(readCustomItemMaterial(source)).toEqual({ materialContainsMetal: true, materialValueCp: 500 })
  const encoded = writeCustomItemMaterial({ materialContainsMetal: false, materialValueCp: 125 }, source)
  expect(encoded).toEqual({ cost: { amount: 125, currency: 'cp' }, spellcastingMaterial: { tags: ['silver'], unitValueGp: 1.25 } })
  expect(readCustomItemMaterial(JSON.parse(JSON.stringify(encoded)))).toEqual({ materialContainsMetal: false, materialValueCp: 125 })
  const metal = writeCustomItemMaterial({ materialContainsMetal: true, materialValueCp: 300 })
  expect(readCustomItemMaterial(metal)).toEqual({ materialContainsMetal: true, materialValueCp: 300 })
  for (const value of [29, 57, 101, 9999]) {
    expect(readCustomItemMaterial(writeCustomItemMaterial({ materialContainsMetal: true, materialValueCp: value })).materialValueCp).toBe(value)
  }
  for (const value of [0, -1, NaN, Infinity, 1.5]) {
    expect(writeCustomItemMaterial({ materialContainsMetal: true, materialValueCp: value }).cost).toBeUndefined()
  }
})
