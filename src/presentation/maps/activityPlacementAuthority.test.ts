import { describe, expect, it } from 'vitest'
import { captureActivityPlacementAuthority } from './activityPlacementAuthority'

function scene() {
  return {
    map: { id: 'map', tokens: [{ id: 'caster', x: 25 }, { id: 'other', x: 225 }], areas: [] as string[] },
    characters: [{ id: 'wizard', conditions: [] as string[], slot: 2 }],
    geometry: { walls: [] as string[], ambientLight: 'bright' },
    worldMinute: 1,
  }
}

describe('pending Activity placement authority', () => {
  it('reports changed paths without exposing old or new field values', () => {
    const baseline=scene()
    const collected: (readonly string[])[]=[]
    const unchanged=captureActivityPlacementAuthority(baseline,paths=>collected.push(paths))
    const changed=structuredClone(baseline)
    changed.characters[0].slot=1
    expect(unchanged(changed)).toBe(false)
    expect(collected).toEqual([['characters.0.slot']])
    expect(unchanged(baseline)).toBe(true)
    expect(collected).toHaveLength(1)
  })
  it.each(['weight', 'height', 'target-position', 'wall-hp'])('rejects a launch after %s changes during dice input', field => {
    const baseline = { map: { tokens: [{ id: 'object', x: 125, elevationFeet: 10, dnd5eObjectState: { weightPounds: 5 } }] },
      characters: [{ id: 'caster', slots: 2 }], geometry: { wall: { hp: 30 } }, worldMinute: 1 }
    const unchanged = captureActivityPlacementAuthority(baseline)
    expect(unchanged(structuredClone(baseline))).toBe(true)
    if (field === 'weight') baseline.map.tokens[0].dnd5eObjectState.weightPounds = 10
    if (field === 'height') baseline.map.tokens[0].elevationFeet = 100
    if (field === 'target-position') baseline.map.tokens[0].x = 225
    if (field === 'wall-hp') baseline.geometry.wall.hp = 0
    const current = structuredClone(baseline)
    expect(unchanged(baseline)).toBe(false)
    expect(baseline).toEqual(current)
  })
  it.each([
    ['caster becomes blind', (s: ReturnType<typeof scene>) => s.characters[0].conditions.push('blinded')],
    ['destination becomes occupied', (s: ReturnType<typeof scene>) => { s.map.tokens[1].x = 625 }],
    ['new obscuring area', (s: ReturnType<typeof scene>) => s.map.areas.push('fog')],
    ['door closes', (s: ReturnType<typeof scene>) => s.geometry.walls.push('closed-door')],
    ['lighting changes', (s: ReturnType<typeof scene>) => { s.geometry.ambientLight = 'darkness' }],
    ['timed vision expires', (s: ReturnType<typeof scene>) => { s.worldMinute += 1 }],
    ['another action spends the slot', (s: ReturnType<typeof scene>) => { s.characters[0].slot -= 1 }],
  ])('rejects an outstanding answer after %s without mutating current state', async (_name, change) => {
    const live = scene()
    const unchanged = captureActivityPlacementAuthority(live)
    let answer!: (cell: number) => void
    const pending = new Promise<number>(resolve => { answer = resolve })
    const settlement = pending.then(cell => {
      if (!unchanged(live)) return 'movement-placement-stale'
      live.map.tokens[0].x = cell
      live.characters[0].slot -= 1
      return 'accepted'
    })
    change(live)
    const before = structuredClone(live)
    answer(625)
    expect(await settlement).toBe('movement-placement-stale')
    expect(live).toEqual(before)
  })

  it('accepts equivalent rehydrated state, but rejects a removed map or unavailable clock', () => {
    const live = scene()
    const unchanged = captureActivityPlacementAuthority(live)
    expect(unchanged(structuredClone(live))).toBe(true)
    expect(unchanged({ ...live, map: undefined })).toBe(false)
    expect(unchanged({ ...live, worldMinute: undefined })).toBe(false)
  })
})
