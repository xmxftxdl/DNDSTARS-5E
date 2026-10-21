import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { migrateMapsState, type BattleMap } from '../../../store/maps'
import { normalizeDnd5ePersistentAreaSourceLimit } from '../persistentAreaSourceLimit'
import { applyDnd5eActivityMapHandoffsV1, resolveDnd5eActivityAreaMapSelectionV1 } from './dnd5eActivityMapInteraction'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'color', name: 'Color', activation: { kind: 'action' },
  legacySource: { kind: 'feature', id: 'color' },
  automation: automationCapabilityFromLegacyStatus('full'),
  target: { kind: 'area', relation: 'any', shape: 'cube', origin: 'point', widthFeet: 5, lengthFeet: 5, heightFeet: 5, placeRangeFeet: 30 },
  outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'area', kind: 'create-persistent-area',
    label: 'Color', durationRounds: 600, concentration: false, sourceLimit: { groupId: 'water', maximum: 2 } }] }],
}
function map(id = 'one'): BattleMap {
  return { id, name: id, width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'actor', characterId: 'hero', type: 'player', label: 'Hero', size: 1, x: 25, y: 25, color: '', emoji: '' }] }
}
function apply(current: BattleMap, id: string, peers: BattleMap[] | undefined = [], worldMinute = 0, groupId = 'water', maximum = 2) {
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity, map: current, actorToken: current.tokens[0], anchorCell: { col: 2, row: 2 } })!
  return applyDnd5eActivityMapHandoffsV1({ map: current, sourceLimitMaps: peers, activity, packageId: 'test.water',
    actionId: id, actorId: 'actor', round: 1, worldMinute, areaSelection, selection: {},
    handoffs: { movements: [], summons: [], invocations: [], persistentAreas: [{ kind: 'create-persistent-area',
      operationId: 'area', label: 'Color', durationRounds: 600, concentration: false,
      grantedActivities: [{ activityId: 'dismiss' }],
      sourceLimit: { groupId, maximum }, areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'cube' } }] } })
}
function created(result: ReturnType<typeof apply>): BattleMap {
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error(result.reason)
  return result.map
}

it('round-trips the shared limit and forwards it into Host proposals without modifying the definition', async () => {
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod({
    format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: 'test.water', name: 'Synthetic source cap', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only' },
    definitions: [{ schemaVersion: 1, namespace: 'test.water', version: '1.0.0', id: 'color', name: 'Color', kind: 'feature',
      automation: automationCapabilityFromLegacyStatus('full'), payload: { id: 'color', name: 'Color', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [activity] }],
  }))
  const restored = decoded.bundle.definitions[0].activities![0]
  const before = structuredClone(restored)
  const result = resolveDnd5eActivity({ activity: restored,
    actor: { id: 'actor', level: 3, proficiencyBonus: 2, controller: 'players', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, conditions: [], armorClass: 10, currentHp: 20, maxHp: 20 },
    targets: [], rolls: {}, areaPlacement: { x: 125, y: 125 }, areaPlacementDistanceFeet: 10 })
  expect(result).toMatchObject({ ok: true, proposals: expect.arrayContaining([expect.objectContaining({
    kind: 'create-persistent-area', sourceLimit: { groupId: 'water', maximum: 2 },
  })]) })
  expect(restored).toEqual(before)
  if (!result.ok) throw Error('Fixture execution failed')
  const proposals = result.proposals.filter(proposal => proposal.kind === 'create-persistent-area')
  const current = map()
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity, map: current, actorToken: current.tokens[0], anchorCell: { col: 2, row: 2 } })!
  const originalMap = structuredClone(current)
  const batch = applyDnd5eActivityMapHandoffsV1({ map: current, sourceLimitMaps: [], activity, packageId: 'test.water',
    actionId: 'batch', actorId: 'actor', round: 1, worldMinute: 0, selection: {}, areaSelection,
    handoffs: { persistentAreas: ['one', 'two', 'three'].map(operationId => ({ ...proposals[0], operationId })),
      movements: [], summons: [], invocations: [] } })
  expect(batch).toEqual({ ok: false, reason: 'invalid-persistent-area' })
  expect(current).toEqual(originalMap)
})

it('shares a source cap across modes and maps after reload, and releases expired or dismissed instances', () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const first = created(apply(map(), 'first'))
  const second = created(apply(map('two'), 'freeze', [first]))
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [first, second] }))).maps
  expect(restored[0].dnd5ePluginAreas?.[0].sourceLimit).toEqual({ groupId: 'water', maximum: 2 })
  const before = structuredClone(restored)
  expect(apply(restored[0], 'third', restored).ok).toBe(false)
  expect(apply(restored[0], 'third', restored, 0, 'water', 64).ok).toBe(false)
  // A repeated handoff id does not count its own existing area twice.
  expect(apply(restored[0], 'first', restored).ok).toBe(true)
  expect(apply(restored[0], 'other-group', restored, 0, 'other').ok).toBe(true)
  const otherCaster = structuredClone(restored[0])
  otherCaster.tokens[0].characterId = 'other-hero'
  expect(apply(otherCaster, 'other-caster', restored).ok).toBe(true)
  expect(apply(restored[0], 'after-hour', restored, 60).ok).toBe(true)
  expect(restored).toEqual(before)
  const dismiss: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'dismiss', name: 'Dismiss',
    automation: automationCapabilityFromLegacyStatus('full'),
    activation: { kind: 'action' }, target: { kind: 'self' }, outcomes: [] }
  const ended = applyDnd5eActivityMapHandoffsV1({ map: restored[0], activity: dismiss, packageId: 'test.water',
    actionId: 'dismiss', actorId: 'actor', round: 1, selection: {}, grantingPersistentAreaId: restored[0].dnd5ePluginAreas![0].id,
    handoffs: { persistentAreas: [], movements: [], summons: [], invocations: [],
      areaDismissals: [{ kind: 'dismiss-granting-area', operationId: 'dismiss', actorId: 'actor' }] } })
  expect(ended.ok, JSON.stringify(ended)).toBe(true)
  if (ended.ok) expect(apply(ended.map, 'replacement', [ended.map, restored[1]]).ok).toBe(true)
})

it('rejects missing Host scope and invalid limits without altering the input', () => {
  const current = map(), before = structuredClone(current)
  // Undefined is deliberately passed through rather than the test helper default.
  const selection = resolveDnd5eActivityAreaMapSelectionV1({ activity, map: current, actorToken: current.tokens[0], anchorCell: { col: 2, row: 2 } })!
  const operation = activity.outcomes[0].operations[0]
  if (operation.kind !== 'create-persistent-area') throw Error('fixture')
  expect(applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'test.water', actionId: 'missing', actorId: 'actor',
    round: 1, areaSelection: selection, selection: {}, handoffs: { persistentAreas: [{ kind: 'create-persistent-area', operationId: operation.id,
      label: operation.label, durationRounds: operation.durationRounds, concentration: operation.concentration, sourceLimit: operation.sourceLimit,
      areaInstance: { ...selection.areaPlacement, origin: 'point', shape: 'cube' } }], summons: [], movements: [], invocations: [] } }).ok).toBe(false)
  for (const invalid of [{ groupId: '', maximum: 2 }, { groupId: 'water', maximum: 0 }, { groupId: 'water', maximum: 65 },
    { groupId: 'water', maximum: 1.5 }, { groupId: 'water', maximum: 2, replaceOldest: true }]) {
    expect(normalizeDnd5ePersistentAreaSourceLimit(invalid)).toBeUndefined()
    const bad = structuredClone(activity)
    Object.assign(bad.outcomes[0].operations[0], { sourceLimit: invalid })
    expect(validateDnd5eActivityDefinitionV1(bad).join()).toContain('sourceLimit')
  }
  expect(current).toEqual(before)
})
