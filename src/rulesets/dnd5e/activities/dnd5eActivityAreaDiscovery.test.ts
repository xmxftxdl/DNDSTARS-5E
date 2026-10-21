import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { migrateMapsState, type BattleMap } from '../../../store/maps'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { applyDnd5eActivityMapHandoffsV1, resolveDnd5eActivityAreaMapSelectionV1 } from './dnd5eActivityMapInteraction'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it('carries a discovery contract through execution, Host placement and reload with the captured DC', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'test-discovery', name: 'Synthetic hidden area',
    automation: automationCapabilityFromLegacyStatus('full'), activation: { kind: 'action' },
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'circle', radiusFeet: 5, placeRangeFeet: 30 },
    outcomes: [{ id: 'place', when: { kind: 'always' }, operations: [{ id: 'hidden', kind: 'create-persistent-area',
      label: 'Hidden', durationRounds: 4800, concentration: false, discovery: { skill: 'investigation', dc: 'source-save-dc' } }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const actor = { id: 'caster', controller: 'players' as const, level: 5, proficiencyBonus: 3,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, armorClass: 15, conditions: [], currentHp: 20, maxHp: 20 }
  const map: BattleMap = { id: 'hidden', name: 'Hidden', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: actor.id, characterId: actor.id, label: 'Caster', type: 'player', size: 1, x: 25, y: 25, color: '', emoji: '' }] }
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity, map, actorToken: map.tokens[0], anchorCell: { col: 2, row: 2 } })!
  const resolved = resolveDnd5eActivity({ activity, actor, targets: [], rolls: {},
    areaPlacement: areaSelection.areaPlacement, areaPlacementDistanceFeet: areaSelection.areaPlacementDistanceFeet })
  expect(resolved.ok).toBe(true)
  if (!resolved.ok) return
  const input = { map, activity, packageId: 'test.discovery', actionId: 'cast', actorId: actor.id, sourceSaveDc: 17,
    worldMinute: 100, round: 1, selection: {}, areaSelection,
    handoffs: { persistentAreas: resolved.proposals.filter(p => p.kind === 'create-persistent-area'), movements: [], summons: [], invocations: [] } }
  const placed = applyDnd5eActivityMapHandoffsV1(input)
  expect(placed.ok).toBe(true)
  if (!placed.ok) return
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [placed.map], selectedId: map.id }))).maps[0]
  expect(saved.dnd5ePluginAreas![0]).toMatchObject({ hiddenFromPlayers: true,
    visualRecognition: { skill: 'investigation', dc: 17, knownTokenIds: ['caster'] } })
  expect(applyDnd5eActivityMapHandoffsV1({ ...input, sourceSaveDc: undefined })).toMatchObject({ ok: false })
})
