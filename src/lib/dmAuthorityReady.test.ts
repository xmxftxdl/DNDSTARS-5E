import { describe, expect, it } from 'vitest'
import { matchesDmAuthorityReady, type DmAuthorityReadyState } from './dmAuthorityReady'

const ready: DmAuthorityReadyState = {
  mapId: 'map-1',
  combatId: 'combat-1',
  ready: true,
  updatedAt: 1,
}

describe('matchesDmAuthorityReady', () => {
  it('accepts only the current active combat', () => {
    expect(matchesDmAuthorityReady(ready, { mapId: 'map-1', combatId: 'combat-1', combatActive: true })).toBe(true)
    expect(matchesDmAuthorityReady(ready, { mapId: 'map-2', combatId: 'combat-1', combatActive: true })).toBe(false)
    expect(matchesDmAuthorityReady(ready, { mapId: 'map-1', combatId: 'combat-2', combatActive: true })).toBe(false)
    expect(matchesDmAuthorityReady(ready, { mapId: 'map-1', combatId: 'combat-1', combatActive: false })).toBe(false)
  })
})
