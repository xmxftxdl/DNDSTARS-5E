import { expect, it } from 'vitest'
import { mapGeometryRangedWeaponAttackDisadvantage, mapGeometryOrdinaryProjectileBlocked, mapGeometryMovementBlocked } from './mapGeometry'
import { normalizeDnd5ePersistentAreaBlocking } from '../rulesets/dnd5e/persistentAreaTypes'
import type { BattleMap, Token, Dnd5ePluginArea } from '../store/maps'
import { migrateMapsState } from '../store/maps'
import { automationCapabilityFromLegacyStatus } from '../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from '../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../rulesets/dnd5e/starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../rulesets/dnd5e/unifiedContent'
import { registerDnd5eRulesPlugin } from '../rulesets/dnd5e/pluginApi'
import { getRegisteredDnd5eActivity } from '../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import { resolveDnd5eActivity } from '../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import { applyDnd5eActivityMapHandoffsV1, resolveDnd5eActivityAreaMapSelectionV1 } from '../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import { dnd5ePersistentAreaDirectionalMovementCostAt, dnd5ePersistentAreaDifficultTerrainMultiplierAt, dnd5ePersistentAreaOccupantModifiersAt } from '../rulesets/dnd5e/persistentAreaGeometry'

const area: Dnd5ePluginArea = { id: 'test-area', pluginId: 'test.area', featureId: 'zone', label: 'Synthetic wind', color: '#ffffff',
  sourceCharacterId: 'caster', sourceTokenId: 'caster-token', slotLevel: 1, sourceSpellSaveDc: 12, createdRound: 1, expiresAfterRound: 11,
  anchorMode: 'fixed', cells: [{ col: 2, row: 0 }, { col: 3, row: 0 }],
  vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 }, blocking: { rangedWeaponAttackDisadvantage: 'occupancy' } }
const token = (id: string, x: number, y = 25, elevationFeet = 0): Token => ({ id, x, y, elevationFeet, label: id, color: '', emoji: '', size: 1, type: 'enemy' })
const makeMap = (areas: Dnd5ePluginArea[]): BattleMap => ({ id: 'test-map', name: 'Test', width: 500, height: 500, gridSize: 50,
  gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [], dnd5ePluginAreas: areas })

it.each(['occupancy', 'boundary'] as const)('normalizes and preserves a standalone attack volume (%s)', mode => {
  const blocking = normalizeDnd5ePersistentAreaBlocking({ rangedWeaponAttackDisadvantage: mode })!
  expect(blocking).toMatchObject({ rangedWeaponAttackDisadvantage: mode, movement: false, vision: false, lineOfEffect: false })
  expect(normalizeDnd5ePersistentAreaBlocking(JSON.parse(JSON.stringify(blocking)))).toEqual(blocking)
  for (const invalid of [true, false, 'all', 1, {}]) expect(normalizeDnd5ePersistentAreaBlocking({ rangedWeaponAttackDisadvantage: invalid })).toBeUndefined()
})

it.each(['occupancy', 'boundary'] as const)('checks crossing, contained, disjoint and raised trajectories (%s)', mode => {
  const map = makeMap([{ ...area, blocking: { rangedWeaponAttackDisadvantage: mode } }])
  const check = (from: Token, to: Token) => mapGeometryRangedWeaponAttackDisadvantage({ map, from, to })
  expect(check(token('a', 25), token('b', 225))).toBe(true)
  expect(check(token('a', 25), token('b', 125))).toBe(true)
  expect(check(token('a', 125), token('b', 225))).toBe(true)
  expect(check(token('a', 125), token('b', 175))).toBe(mode === 'occupancy')
  expect(check(token('a', 25, 75), token('b', 225, 75))).toBe(false)
  expect(check(token('a', 25, 25, 20), token('b', 225, 25, 20))).toBe(false)
  expect(check(token('a', 25, 25, 20), token('b', 225, 25, 0))).toBe(true)
  expect(mapGeometryOrdinaryProjectileBlocked({ map, from: token('a', 25), to: token('b', 225) })).toBe(false)
  expect(mapGeometryMovementBlocked({ map, token: token('a', 25), to: { x: 225, y: 25 } }).blocked).toBe(false)
  expect(mapGeometryRangedWeaponAttackDisadvantage({ map: makeMap([]), from: token('a', 25), to: token('b', 225) })).toBe(false)
})

it('detects short corner intersections and gaps between two contained endpoints', () => {
  const map = makeMap([{ ...area, cells: [{ col: 2, row: 0 }] }])
  expect(mapGeometryRangedWeaponAttackDisadvantage({ map, from: token('a', 99, 2), to: token('b', 200, -98) })).toBe(true)
  const separated = makeMap([{ ...area, cells: [{ col: 0, row: 0 }, { col: 2, row: 0 }], blocking: { rangedWeaponAttackDisadvantage: 'boundary' } }])
  expect(mapGeometryRangedWeaponAttackDisadvantage({ map: separated, from: token('a', 25), to: token('b', 125) })).toBe(true)
})

it.each([false, true])('exports, installs, creates and reloads an attack-modifying area through the normal map handoff (thin=%s)', async thin => {
  const namespace = 'test.ranged-area', automation = automationCapabilityFromLegacyStatus('full')
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'wind-zone', name: 'Synthetic area', automation,
    legacySource: { kind: 'feature', id: 'zone' },
    activation: { kind: 'action' }, target: { kind: 'area', relation: 'any', includeSelf: true, origin: 'point', shape: thin ? 'rect' : 'cube', lengthFeet: thin ? 20 : 5, widthFeet: thin ? 1 : 5, heightFeet: 10, placeRangeFeet: 30 },
    outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'area', kind: 'create-persistent-area', label: 'Wind', durationRounds: 10,
      concentration: true, directionalMovementCost: { direction: 'area-orientation', additionalFeetPerFoot: 1 }, movementCostMultiplier: 2, movementExcludesSource: true, occupantModifiers: { conditions: ['deafened'] },
      blocking: { rangedWeaponAttackDisadvantage: 'occupancy' } }] }] }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Area test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'zone', name: 'Zone', automation, activities: [activity],
      payload: { id: 'zone', name: 'Zone', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }] }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const installed = getRegisteredDnd5eActivity(namespace, 'wind-zone')!
    expect(installed).toBeDefined()
    const map = makeMap([]), caster = { ...token('caster-token', 25), type: 'player' as const, characterId: 'caster' }
    map.tokens = [caster]
    const original = structuredClone(map)
    const selected = resolveDnd5eActivityAreaMapSelectionV1({ activity: installed, map, actorToken: caster, anchorCell: { col: 2, row: 0 }, dimensions: thin ? { widthFeet: 1, heightFeet: 20 } : undefined })!
    expect(selected).toBeDefined()
    const result = resolveDnd5eActivity({ activity: installed, actor: { id: caster.id, controller: 'player', level: 5, proficiencyBonus: 3,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, armorClass: 10, conditions: [], currentHp: 20, maxHp: 20 },
      targets: [], areaPlacement: selected.areaPlacement, areaPlacementDistanceFeet: 10, rolls: {} })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const applied = applyDnd5eActivityMapHandoffsV1({ map, activity: installed, actorId: caster.id, packageId: namespace, actionId: 'create', round: 1,
      selection: {}, areaSelection: selected, handoffs: { persistentAreas: result.proposals.filter(p => p.kind === 'create-persistent-area'), summons: [], movements: [], invocations: [] } })
    expect(applied.ok, JSON.stringify(applied)).toBe(true)
    if (!applied.ok) return
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [applied.map] }))).maps[0]
    expect(restored.dnd5ePluginAreas![0].blocking?.rangedWeaponAttackDisadvantage).toBe('occupancy')
    expect(restored.dnd5ePluginAreas![0].movementExcludesSource).toBe(true)
    expect(restored.dnd5ePluginAreas![0].directionalMovementCost).toEqual({ direction: { dc: 1, dr: 0 }, additionalFeetPerFoot: 1 })
    const mover = { ...caster, id: 'other', x: 175 }
    expect(dnd5ePersistentAreaDirectionalMovementCostAt({ map: restored, token: mover, from: mover, to: { x: 125, y: 25 } })).toBe(1)
    const insideSource = { ...caster, x: 125 }, insideAlly = { ...insideSource, id: 'ally' }
    for (const [occupant, expectedCost] of [[insideSource, 1], [insideAlly, 2]] as const) {
      expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: restored, token: occupant, position: occupant })).toBe(expectedCost)
      expect(dnd5ePersistentAreaOccupantModifiersAt({ map: restored, token: occupant, position: occupant }).conditionSources.flatMap(source => source.conditions)).toContain('deafened')
    }
    expect(mapGeometryRangedWeaponAttackDisadvantage({ map: restored, from: caster, to: token('target', 225) })).toBe(true)
    if (thin) {
      expect(restored.dnd5ePluginAreas![0].rectGeometry).toMatchObject({ widthFeet: 1, lengthFeet: 20, gridAligned: false })
      // Same selected squares, but fifteen pixels away from the one-foot-thick wall.
      expect(mapGeometryRangedWeaponAttackDisadvantage({ map: restored, from: token('a', 25, 40), to: token('b', 225, 40) })).toBe(false)
    }
    expect(map).toEqual(original)
  } finally { dispose() }
})

it.each([0, 45, 90, 135, 180, 270].flatMap(angle => ['occupancy', 'boundary'].map(mode => ({ angle, mode: mode as 'occupancy' | 'boundary' }))))
('uses actual thin rectangle dimensions and saved orientation (%j)', ({ angle, mode }) => {
  const radians = angle * Math.PI / 180, dc = Math.cos(radians), dr = Math.sin(radians)
  const cells = Array.from({ length: 49 }, (_, i) => ({ col: 1 + i % 7, row: 1 + Math.floor(i / 7) }))
  const rectangle = { ...area, cells, anchorCell: { col: 4, row: 4 },
    rectGeometry: { widthFeet: 1, lengthFeet: 20, direction: { dc, dr }, gridAligned: false }, blocking: { rangedWeaponAttackDisadvantage: mode } }
  const map = makeMap([rectangle])
  const localToken = (id: string, along: number, across: number, height = 0) => token(id, 225 + along * dc - across * dr, 225 + along * dr + across * dc, height)
  const check = (from: Token, to: Token, current = map) => mapGeometryRangedWeaponAttackDisadvantage({ map: current, from, to })
  expect(check(localToken('a', 0, -80), localToken('b', 0, 80))).toBe(true)
  expect(check(localToken('a', -80, 15), localToken('b', 80, 15))).toBe(false)
  expect(check(localToken('a', 110, -80), localToken('b', 110, 80))).toBe(false)
  expect(check(localToken('a', -40, 0), localToken('b', 40, 0))).toBe(mode === 'occupancy')
  expect(check(localToken('a', 0, -80, 20), localToken('b', 0, 80, 20))).toBe(false)
  const cleared = makeMap([{ ...rectangle, cells: [] }])
  expect(check(localToken('a', 0, -80), localToken('b', 0, 80), cleared)).toBe(false)
  // The rectangular constraint must not bring back a cell removed by clipping or cleanup.
  const clipped = makeMap([{ ...rectangle, cells: cells.filter(cell => cell.col !== 4 || cell.row !== 4) }])
  expect(check(localToken('a', 0, -8), localToken('b', 0, 8), clipped)).toBe(false)
})
