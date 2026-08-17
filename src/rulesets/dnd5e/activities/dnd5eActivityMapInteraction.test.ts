import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { cellToPixel } from '../../../lib/gridCombat'
import type { BattleMap, Token } from '../../../store/maps'
import type { Dnd5eActivityAuthorityHandoffs } from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import {
  applyDnd5eActivityMapHandoffsV1,
  dnd5eActivityAutomaticDirectionalMovementCellV1,
  dnd5eActivityMapTemplateV1,
  resolveDnd5eActivityAreaMapSelectionV1,
} from './dnd5eActivityMapInteraction'

const automation = automationCapabilityFromLegacyStatus('full')

function token(map: BattleMap, id: string, col: number, row: number, type: Token['type']): Token {
  return {
    id, label: id, color: '#fff', emoji: id, size: 1, type,
    ...cellToPixel({ col, row }, map),
    ...(type === 'player' ? { characterId: id } : {}),
  }
}

function map(): BattleMap {
  const base: BattleMap = {
    id: 'activity-map', name: 'Activity map', width: 1000, height: 1000,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [],
  }
  base.tokens = [token(base, 'actor', 1, 1, 'player'), token(base, 'target', 2, 1, 'enemy')]
  return base
}

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1,
  id: 'storm-zone',
  name: 'Storm zone',
  activation: { kind: 'reaction', cost: 1 },
  invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'actor-choice' },
  target: {
    kind: 'area', relation: 'enemy', origin: 'point', shape: 'rect',
    placeRangeFeet: 30, widthFeet: 10, lengthFeet: 20, heightFeet: 5,
    maximumTargets: 8, rotatable: true,
  },
  outcomes: [],
  automation,
}

describe('unified Activity production map interaction', () => {
  it('rebuilds a rotatable area and its affected targets from the Host map', () => {
    const current = map()
    const actor = current.tokens[0]!
    expect(dnd5eActivityMapTemplateV1(activity)).toMatchObject({
      shape: 'rect', widthFeet: 10, heightFeet: 20, rotatable: true,
    })
    const selected = resolveDnd5eActivityAreaMapSelectionV1({
      activity,
      map: current,
      actorToken: actor,
      anchorCell: { col: 2, row: 1 },
      rectRotation: 1,
    })
    expect(selected).toMatchObject({
      targetIds: ['target'],
      areaPlacementDistanceFeet: 5,
      areaPlacement: { angleDegrees: 90, widthFeet: 10, lengthFeet: 20, heightFeet: 5 },
    })
  })

  it('atomically places persistent areas, multiple summons, and a validated push', () => {
    const current = map()
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 2, row: 1 },
      rectRotation: 0,
    })!
    const handoffs: Dnd5eActivityAuthorityHandoffs = {
      persistentAreas: [{
        kind: 'create-persistent-area', operationId: 'zone', label: 'Storm zone',
        durationRounds: 3, concentration: true, areaInstance: {
          ...areaSelection.areaPlacement, origin: 'point', shape: 'rect',
        },
        utilityProjectionId: 'storm-projection',
        movementCostMultiplier: 2,
        obscuration: { kind: 'heavy' },
        occupantModifiers: { preventsVerbalComponents: true, damageImmunities: ['thunder'] },
        blocking: { vision: true },
        grantedActivities: [{ activityId: 'storm-control', activateOnCreate: true }],
        triggers: [{
          id: 'zone-turn-start', label: 'Zone damage', timing: 'turn-start', oncePerTurn: true,
          savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'half', magical: true },
          damage: { count: 1, sides: 6, type: 'lightning' },
        }],
      }],
      summons: [{
        kind: 'summon', operationId: 'wolves', monsterId: 'srd-5.1:wolf', count: 2,
        timing: 'immediate', durationRounds: 3, concentration: false, side: 'ally',
      }],
      movements: [{ kind: 'move', operationId: 'push', targetId: 'target', mode: 'push', distanceFeet: 5 }],
      invocations: [],
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-1',
      actorId: 'actor',
      sourceSaveDc: 15,
      round: 2,
      handoffs,
      areaSelection,
      selection: {
        summonCells: [{ col: 4, row: 3 }, { col: 5, row: 3 }],
        summonInitiativeD20s: [12, 8],
        movementCellsByOperationId: { push: { col: 3, row: 1 } },
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas).toHaveLength(1)
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      pluginId: 'local.activity-test', featureId: 'storm-zone', concentrationId: 'activity:storm-zone',
      sourceKind: 'plugin-feature', utilityProjectionId: 'storm-projection',
      movementCostMultiplier: 2,
      obscuration: { kind: 'heavy' },
      occupantModifiers: {
        preventsVerbalComponents: true, damageImmunities: ['thunder'],
      },
      blocking: { vision: true },
      grantedActivities: [{ activityId: 'storm-control', activateOnCreate: true }],
      triggers: [{
        id: 'zone-turn-start',
        savingThrow: { ability: 'dex', dc: 15, onSuccess: 'half' },
        damage: { count: 1, sides: 6, type: 'lightning' },
      }],
    })
    expect(result.map.tokens.filter((candidate) => candidate.dnd5eSummon)).toHaveLength(2)
    expect(result.initiativeEntries).toHaveLength(2)
    expect(result.map.tokens.find((candidate) => candidate.id === 'target')).toMatchObject(
      cellToPixel({ col: 3, row: 1 }, current),
    )
    expect(current.tokens).toHaveLength(2)
  })

  it('chooses the farthest legal pull destination toward a persistent-area origin', () => {
    const current = map()
    current.tokens[1] = token(current, 'target', 7, 1, 'enemy')
    expect(dnd5eActivityAutomaticDirectionalMovementCellV1({
      map: current,
      actorToken: current.tokens[0]!,
      targetToken: current.tokens[1]!,
      mode: 'pull',
      distanceFeet: 20,
      directionOriginCell: { col: 2, row: 1 },
    })).toEqual({ col: 3, row: 1 })
  })

  it('atomically swaps the actor with a nearby allied token without a placement prompt', () => {
    const current = map()
    current.tokens[1] = token(current, 'ally', 4, 2, 'player')
    const actorBefore = { x: current.tokens[0]!.x, y: current.tokens[0]!.y }
    const allyBefore = { x: current.tokens[1]!.x, y: current.tokens[1]!.y }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-swap',
      actorId: 'actor',
      round: 2,
      handoffs: {
        persistentAreas: [], summons: [], invocations: [],
        movements: [{
          kind: 'move', operationId: 'swap', targetId: 'ally', mode: 'swap', distanceFeet: 30,
        }],
      },
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.tokens.find((candidate) => candidate.id === 'actor')).toMatchObject(allyBefore)
    expect(result.map.tokens.find((candidate) => candidate.id === 'ally')).toMatchObject(actorBefore)
    expect(result.changedTokenIds).toEqual(expect.arrayContaining(['actor', 'ally']))
  })

  it('creates independently addressable projection instances in the nearest legal cells', () => {
    const current = map()
    const projectionActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'mirror-images',
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'rect',
        placeRangeFeet: 30, widthFeet: 5, lengthFeet: 5, heightFeet: 5,
        maximumTargets: 8, rotatable: false,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: projectionActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 4, row: 4 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: projectionActivity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-projections',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'images', label: 'Mirror',
          instanceCount: 4, durationRounds: 10, concentration: true,
          utilityProjectionId: 'mirror',
          areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'rect' },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas).toHaveLength(4)
    expect(new Set(result.map.dnd5ePluginAreas?.map((area) => area.id)).size).toBe(4)
    const placedCells = result.map.dnd5ePluginAreas?.flatMap((area) =>
      area.cells.map((cell) => `${cell.col}:${cell.row}`)) ?? []
    expect(new Set(placedCells).size).toBe(placedCells.length)
    expect(new Set(result.map.dnd5ePluginAreas?.map((area) => `${area.anchorCell?.col}:${area.anchorCell?.row}`)).size).toBe(4)
    expect(result.map.dnd5ePluginAreas?.every((area) => area.utilityProjectionId === 'mirror')).toBe(true)
  })

  it('anchors self-origin persistent areas to the source token', () => {
    const current = map()
    const selfAreaActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'guardian-aura',
      target: {
        kind: 'area', relation: 'enemy', origin: 'self', shape: 'circle',
        radiusFeet: 10, maximumTargets: 8, includeSelf: false,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: selfAreaActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 1, row: 1 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: selfAreaActivity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-source-area',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'aura', label: 'Guardian aura',
          durationRounds: 3, concentration: false,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'self', shape: 'circle' },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorMode: 'source-token',
      anchorTokenId: 'actor',
      sourceTokenId: 'actor',
    })
  })

  it('removes only eligible magical-darkness areas within the actor radius', () => {
    const current = map()
    current.dnd5ePluginAreas = [
      {
        id: 'near-darkness', pluginId: 'local.activity-test', featureId: 'darkness',
        label: 'Near darkness', color: '#000', sourceCharacterId: 'caster', sourceTokenId: 'caster',
        cells: [{ col: 3, row: 1 }], createdRound: 1, expiresAfterRound: 20,
        lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2 },
      },
      {
        id: 'high-level-darkness', pluginId: 'local.activity-test', featureId: 'darkness',
        label: 'High level darkness', color: '#000', sourceCharacterId: 'caster', sourceTokenId: 'caster',
        cells: [{ col: 2, row: 1 }], createdRound: 1, expiresAfterRound: 20,
        lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 5 },
      },
      {
        id: 'far-darkness', pluginId: 'local.activity-test', featureId: 'darkness',
        label: 'Far darkness', color: '#000', sourceCharacterId: 'caster', sourceTokenId: 'caster',
        cells: [{ col: 9, row: 1 }], createdRound: 1, expiresAfterRound: 20,
        lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2 },
      },
      {
        id: 'near-light', pluginId: 'local.activity-test', featureId: 'light',
        label: 'Near light', color: '#fff', sourceCharacterId: 'caster', sourceTokenId: 'caster',
        cells: [{ col: 2, row: 1 }], createdRound: 1, expiresAfterRound: 20,
        lighting: { kind: 'light', brightRadiusFeet: 10, dimRadiusFeet: 20, color: '#fff', spellLevel: 2 },
      },
    ]
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-dispel-darkness',
      actorId: 'actor',
      round: 2,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        areaDispels: [{
          kind: 'dispel-area', operationId: 'dispel-darkness', actorId: 'actor',
          areaKind: 'magical-darkness', radiusFeet: 30, maximumSpellLevel: 3,
        }],
      },
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas?.map((area) => area.id)).toEqual([
      'high-level-darkness', 'far-darkness', 'near-light',
    ])
    expect(current.dnd5ePluginAreas).toHaveLength(4)
  })

  it('rejects the complete handoff without mutating the map when one placement is invalid', () => {
    const current = map()
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'activity-action-2',
      actorId: 'actor',
      round: 2,
      handoffs: {
        persistentAreas: [], invocations: [],
        summons: [{
          kind: 'summon', operationId: 'wolf', monsterId: 'srd-5.1:wolf', count: 1,
          timing: 'immediate', durationRounds: 3, concentration: false, side: 'ally',
        }],
        movements: [],
      },
      selection: { summonCells: [{ col: 2, row: 1 }], summonInitiativeD20s: [10] },
    })
    expect(result).toEqual({ ok: false, reason: 'invalid-summon-placement' })
    expect(current.tokens).toHaveLength(2)
  })
})
