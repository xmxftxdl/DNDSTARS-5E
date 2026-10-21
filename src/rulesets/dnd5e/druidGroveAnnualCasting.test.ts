import { expect, it } from 'vitest'
import { normalizeDnd5eGroveAnnualCasting, prepareDnd5eGroveAnnualCast } from './druidGroveAnnualCasting'
const volume = { minX: 0, minY: 0, widthPixels: 300, baseElevationFeet: 0, heightFeet: 30, excludedStructures: [] }
const source = { pluginId: 'grove', spellId: 'grove', characterId: 'owner', castId: 'first' }
it('counts distinct consecutive days, survives serialization, and resets missed days', () => {
  let history: ReturnType<typeof normalizeDnd5eGroveAnnualCasting> = []
  for (let day = 0; day < 365; day++) {
    const result = prepareDnd5eGroveAnnualCast({ history, source: { ...source, castId: String(day) }, volume, worldMinute: day * 1440 + 100 })
    if (!result.ok) throw Error(result.reason)
    expect(result.permanent).toBe(day === 364)
    history = normalizeDnd5eGroveAnnualCasting(JSON.parse(JSON.stringify(result.history)))
    const repeat = prepareDnd5eGroveAnnualCast({ history, source: { ...source, castId: `repeat-${day}` }, volume, worldMinute: day * 1440 + 101 })
    expect(repeat.ok && repeat.permanent).toBe(day === 364)
    expect(prepareDnd5eGroveAnnualCast({ history, source: { ...source, castId: String(day) }, volume, worldMinute: day * 1440 + 101 }).ok).toBe(false)
  }
  const missed = prepareDnd5eGroveAnnualCast({ history, source, volume, worldMinute: 366 * 1440 })
  expect(missed.ok && missed.permanent).toBe(false)
  expect(missed.ok && missed.history[0].firstDay).toBe(366)
  expect(prepareDnd5eGroveAnnualCast({ history, source, volume, worldMinute: 1 }).ok).toBe(false)
  for (const changed of [{ source: { ...source, characterId: 'other' }, volume }, { source, volume: { ...volume, minX: 50 } }]) {
    const result = prepareDnd5eGroveAnnualCast({ history, ...changed, worldMinute: 365 * 1440 })
    expect(result.ok && result.permanent).toBe(false)
  }
  expect(normalizeDnd5eGroveAnnualCasting([{ ...history[0], firstDay: 500 }, { ...history[0], lastWorldMinute: -1 }])).toEqual([])
})


it('retains the same-area streak when structure order and polygon start/winding change', () => {
  const points = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }]
  const structures = [{ points, baseElevationFeet: 0, heightFeet: 10 }, { points: points.map(p => ({ x: p.x + 50, y: p.y })), baseElevationFeet: 0, heightFeet: 20 }]
  const first = prepareDnd5eGroveAnnualCast({ history: [], source, volume: { ...volume, excludedStructures: structures }, worldMinute: 100 })
  if (!first.ok) throw Error(first.reason)
  const reordered = structures.map(s => ({ ...s, points: [s.points[2], s.points[1], s.points[0], s.points[3], s.points[2]] })).reverse()
  const next = prepareDnd5eGroveAnnualCast({ history: first.history, source: { ...source, castId: 'next' },
    volume: { ...volume, excludedStructures: reordered }, worldMinute: 1540 })
  expect(next.ok && next.history).toHaveLength(1)
  expect(next.ok && next.history[0]).toMatchObject({ firstDay: 0, lastDay: 1 })
  const changed = prepareDnd5eGroveAnnualCast({ history: first.history, source: { ...source, castId: 'changed' },
    volume: { ...volume, excludedStructures: [{ ...structures[0], heightFeet: 11 }, structures[1]] }, worldMinute: 1540 })
  expect(changed.ok && changed.history.at(-1)).toMatchObject({ firstDay: 1, lastDay: 1 })
})
