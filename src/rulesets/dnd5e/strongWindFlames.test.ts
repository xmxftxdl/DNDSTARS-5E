import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation'
import { migrateMapsState } from '../../store/maps'
import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { collectStrongWindProtectedFlames, reconcileStrongWindFlameReceipts, settleStrongWindProtectedFlame } from './strongWindFlames'
import { rebaseDnd5ePluginAreasAfterCombat, reconcileDnd5ePluginAreasOnMap } from './pluginAreas'

function fixture(): BattleMap {
  return { id: 'map', name: 'map', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'lamp', label: 'Lamp', x: 75, y: 75, size: 1, type: 'obstacle', color: '#fff', emoji: '',
      lightSource: { enabled: true, color: '#fff', sourceKind: 'hooded-lantern', brightRadiusFeet: 30, dimRadiusFeet: 30,
        startedAtWorldMinute: 1, durationMinutes: 360, expiresAtWorldMinute: 361 } }],
    dnd5ePluginAreas: [{ id: 'gust', pluginId: 'test.grove', featureId: 'test.grove:grove', label: 'Gust',
      color: '#fff', sourceTokenId: 'caster', sourceCharacterId: 'caster', strongWind: true,
      cells: [{ col: 1, row: 1 }], createdRound: 1, expiresAfterRound: 14400 }],
  }
}
function settle(map: BattleMap, d100: number) {
  const candidate = collectStrongWindProtectedFlames(map)[0]
  return settleStrongWindProtectedFlame(map, { ...candidate, d100, round: 1, transactionId: 'test' })!
}
describe('protected flame strong wind settlement', () => {
  it.each([1, 50, 51, 100])('uses exact 50 percent threshold at %i', roll => {
    const map = fixture(), result = settle(map, roll)
    expect(!!result.tokens[0].lightSource).toBe(roll > 50)
    expect(map.tokens[0].lightSource).toBeDefined()
    expect(collectStrongWindProtectedFlames(result)).toHaveLength(0)
    expect(result.dnd5ePluginAreas![0].triggerReceipts![0].transactionId).toContain(`d100=${roll}:`)
  })
  it('does not reroll after reload, round cleanup or combat rebase', () => {
    let map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [settle(fixture(), 51)], selectedId: 'map' }))).maps[0]
    expect(validateAndMigrateSharedResource('maps', { maps: [map], selectedId: 'map' }).status).not.toBe('invalid')
    expect(map.dnd5ePluginAreas).toHaveLength(1)
    expect(map.dnd5ePluginAreas![0].triggerReceipts).toHaveLength(1)
    map = reconcileDnd5ePluginAreasOnMap(map, [], 100)
    expect(collectStrongWindProtectedFlames(map)).toHaveLength(0)
    map = rebaseDnd5ePluginAreasAfterCombat(map, 100)
    expect(collectStrongWindProtectedFlames(map)).toHaveLength(0)
  })
  it('starts a new exposure after leaving or relighting', () => {
    const map = settle(fixture(), 51)
    const outside = reconcileStrongWindFlameReceipts({ ...map, tokens: map.tokens.map(t => ({ ...t, x: 350 })) })
    const returned = { ...outside, tokens: map.tokens }
    expect(collectStrongWindProtectedFlames(returned)).toHaveLength(1)
    const relit = { ...map, tokens: map.tokens.map(t => ({ ...t, lightSource: { ...t.lightSource!, startedAtWorldMinute: 2 } })) }
    expect(collectStrongWindProtectedFlames(relit)).toHaveLength(1)
  })
  it('respects exemptions, non-flame overrides and removed areas', () => {
    const map = fixture()
    map.dnd5ePluginAreas![0].excludedTargetIds = ['lamp']
    expect(collectStrongWindProtectedFlames(map)).toHaveLength(0)
    map.dnd5ePluginAreas![0].excludedTargetIds = []
    map.tokens[0].lightSource!.flame = false
    expect(collectStrongWindProtectedFlames(map)).toHaveLength(0)
    map.tokens[0].lightSource!.flame = true
    const candidate = collectStrongWindProtectedFlames(map)[0]
    map.dnd5ePluginAreas = []
    expect(settleStrongWindProtectedFlame(map, { ...candidate, d100: 1, round: 1, transactionId: 'stale' })).toBeUndefined()
  })
  it.each([0, 101, 50.5, NaN])('rejects invalid d100 %s', roll => {
    expect(settle(fixture(), roll)).toBeUndefined()
  })
})

it('rejects a completed roll after the wind or carried light expires', () => {
 const map=fixture(),candidate=collectStrongWindProtectedFlames(map)[0]
 map.dnd5ePluginAreas![0].expiresAtWorldMinute=10
 expect(settleStrongWindProtectedFlame(map,{...candidate,d100:1,round:1,worldMinute:10,transactionId:'expired-area'})).toBeUndefined()
 delete map.dnd5ePluginAreas![0].expiresAtWorldMinute
 expect(settleStrongWindProtectedFlame(map,{...candidate,d100:1,round:1,worldMinute:361,transactionId:'expired-light'})).toBeUndefined()
 expect(map.tokens[0].lightSource).toBeDefined()
})
