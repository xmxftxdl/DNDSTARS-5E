import { expect, it } from 'vitest'
import { dnd5eLocalContentSourceConstraintIssues } from './localContentSourceConstraints'

const source = '3rd 护幕（3d8）\n7th 另一能力，护幕（4d8）\n11th 护幕（5d8）\n另一能力造成 1d6 伤害。'
const content = () => ({ subclasses: [{ abilities: [{ id: 'veil', name: '护幕', level: 3,
  mechanic: { kind: 'damage-mitigation-interrupt', reductionDice: { count: 3, sides: 8, classId: 'wizard', upgrades: [{ level: 7, count: 4 }, { level: 11, count: 5 }] } } }] }] })
const check = (value: unknown, text = source) => dnd5eLocalContentSourceConstraintIssues(text, JSON.stringify(value), 'subclass')

it('checks named base and upgraded dice against the original table without using unrelated dice', () => {
  const good = content(), original = JSON.stringify(good)
  expect(check(good)).toEqual([])
  for (const key of ['base', 'sides', 'upgrade', 'level', 'missing'] as const) {
    const bad = content(), dice = bad.subclasses[0].abilities[0].mechanic.reductionDice
    if (key === 'base') dice.count = 2
    if (key === 'sides') dice.sides = 6
    if (key === 'upgrade') dice.upgrades[0].count = 3
    if (key === 'level') dice.upgrades[0].level = 6
    if (key === 'missing') dice.upgrades = []
    const before = JSON.stringify(bad)
    expect(check(bad).length, key).toBeGreaterThan(0)
    expect(JSON.stringify(bad)).toBe(before)
  }
  expect(JSON.stringify(good)).toBe(original)
})

it('does not guess from a missing, ambiguous, differently named or prose-only table', () => {
  const bad = content()
  bad.subclasses[0].abilities[0].mechanic.reductionDice.count = 1
  for (const text of ['护幕减少3d8伤害。7级后4d8。', '3rd 护幕（3d8）', source.replaceAll('护幕', '别的能力'), `${source}\n3rd 护幕（2d8）`]) expect(check(bad, text)).toEqual([])
  expect(check(bad, source.replace('3rd', '3级').replace('7th', '7级').replace('11th', '11级'))).not.toEqual([])
  expect(dnd5eLocalContentSourceConstraintIssues(source, 'bad json', 'subclass')).toEqual([])
  const malformed = JSON.parse(JSON.stringify(bad))
  malformed.subclasses[0].abilities[0].mechanic.reductionDice.upgrades = [null, 2, {}]
  expect(() => check(malformed)).not.toThrow()
})
