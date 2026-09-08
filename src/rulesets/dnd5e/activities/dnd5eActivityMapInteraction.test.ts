import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { cellToPixel } from '../../../lib/gridCombat'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../../lib/mapGeometry'
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

  it('rejects an occupied creature-sized area anchor at selection and commit time', () => {
    const current = map()
    const actor = current.tokens[0]!
    const anchoredActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      target: {
        kind: 'area', relation: 'enemy', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 10, maximumTargets: 8,
        unoccupiedAnchorSizeFeet: 10,
      },
    }
    expect(resolveDnd5eActivityAreaMapSelectionV1({
      activity: anchoredActivity, map: current, actorToken: actor,
      anchorCell: { col: 2, row: 1 },
    })).toBeUndefined()

    const emptySelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: anchoredActivity, map: current, actorToken: actor,
      anchorCell: { col: 4, row: 1 },
    })!
    const occupiedAtCommit = structuredClone(current)
    occupiedAtCommit.tokens.push(token(occupiedAtCommit, 'late-occupant', 4, 1, 'enemy'))
    const result = applyDnd5eActivityMapHandoffsV1({
      map: occupiedAtCommit, activity: anchoredActivity,
      packageId: 'local.activity-test', actionId: 'occupied-anchor', actorId: actor.id,
      round: 1, areaSelection: emptySelection, selection: {},
      handoffs: {
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'guardian', label: 'Guardian',
          durationRounds: 10, concentration: false,
          areaInstance: { ...emptySelection.areaPlacement, origin: 'point', shape: 'circle' },
        }],
        summons: [], movements: [], invocations: [],
      },
    })
    expect(result).toEqual({ ok: false, reason: 'invalid-persistent-area' })
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
        teleportationExitSavingThrow: { ability: 'cha', dc: 'source-save-dc' },
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
        walkingSpeedFeet: 100, dismissAfterDamageRounds: 10,
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
      blocking: {
        vision: true,
        blocksTeleportationExit: true,
        teleportationExitSavingThrow: { ability: 'cha', dc: 15 },
      },
      grantedActivities: [{ activityId: 'storm-control', activateOnCreate: true }],
      triggers: [{
        id: 'zone-turn-start',
        savingThrow: { ability: 'dex', dc: 15, onSuccess: 'half' },
        damage: { count: 1, sides: 6, type: 'lightning' },
      }],
    })
    expect(result.map.tokens.filter((candidate) => candidate.dnd5eSummon)).toHaveLength(2)
    expect(result.map.tokens.find((candidate) => candidate.dnd5eSummon)?.dnd5eSummon).toMatchObject({
      walkingSpeedFeet: 100, dismissAfterDamageRounds: 10,
    })
    expect(result.initiativeEntries).toHaveLength(2)
    expect(result.initiativeEntries).toEqual([
      expect.objectContaining({
        roll: 14,
        initiativeCalculation: { rolls: [12], d20: 12, modifier: 2, mode: 'normal' },
      }),
      expect.objectContaining({
        roll: 10,
        initiativeCalculation: { rolls: [8], d20: 8, modifier: 2, mode: 'normal' },
      }),
    ])
    expect(result.map.tokens.find((candidate) => candidate.id === 'target')).toMatchObject(
      cellToPixel({ col: 3, row: 1 }, current),
    )
    expect(current.tokens).toHaveLength(2)
  })

  it('replaces a same-source concentration summon when the spell is recast', () => {
    const current = map()
    current.tokens.push({
      ...token(current, 'old-celestial', 4, 4, 'enemy'),
      hp: 59,
      maxHp: 59,
      dnd5eSummon: {
        schemaVersion: 1,
        pluginId: 'srd-5.1',
        featureId: 'spell:conjure-celestial',
        sourceCharacterId: 'actor',
        sourceTokenId: 'actor',
        createdRound: 1,
        expiresAfterRound: 600,
        concentrationId: 'conjure-celestial',
        side: 'player',
      },
    })
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-celestial',
      name: 'Conjure Celestial',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'new-celestial-cast',
      actorId: 'actor',
      concentrationId: 'conjure-celestial',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon',
          operationId: 'celestial',
          monsterId: 'srd-5.1:unicorn',
          count: 1,
          timing: 'immediate',
          durationRounds: 600,
          concentration: true,
          side: 'ally',
        }],
        movements: [],
        invocations: [],
      },
      selection: {
        summonCells: [{ col: 6, row: 6 }],
        summonInitiativeD20s: [12],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.removedTokenIds).toEqual(['old-celestial'])
    expect(result.map.tokens.some((candidate) => candidate.id === 'old-celestial')).toBe(false)
    expect(result.map.tokens.filter((candidate) => candidate.dnd5eSummon)).toHaveLength(1)
    expect(result.map.tokens.find((candidate) => candidate.dnd5eSummon)?.poolId)
      .toBe('srd-5.1:unicorn')
  })

  it('turns a prior Conjure Elemental summon hostile instead of removing it on recast', () => {
    const current = map()
    current.tokens.push({
      ...token(current, 'old-elemental', 4, 4, 'enemy'),
      hp: 102,
      maxHp: 102,
      dnd5eSummon: {
        schemaVersion: 1,
        pluginId: 'srd-5.1',
        featureId: 'spell:conjure-elemental',
        sourceCharacterId: 'actor',
        sourceTokenId: 'actor',
        createdRound: 1,
        expiresAfterRound: 600,
        concentrationId: 'conjure-elemental',
        side: 'player',
        becomesHostileAfterConcentrationEnds: true,
      },
    })
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-elemental',
      name: 'Conjure Elemental',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'new-elemental-cast',
      actorId: 'actor',
      concentrationId: 'conjure-elemental',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon', operationId: 'elemental',
          monsterId: 'srd-5.1:invisible-stalker', count: 1,
          timing: 'immediate', durationRounds: 600,
          concentration: true, side: 'ally',
          becomesHostileAfterConcentrationEnds: true,
        }],
        movements: [], invocations: [],
      },
      selection: {
        summonCells: [{ col: 7, row: 6 }],
        summonInitiativeD20s: [12],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.removedTokenIds).toEqual([])
    expect(result.map.tokens.find((candidate) => candidate.id === 'old-elemental')?.dnd5eSummon)
      .toMatchObject({ side: 'enemy', controlEnded: true, concentrationId: undefined })
    expect(result.map.tokens.find((candidate) => candidate.poolId === 'srd-5.1:invisible-stalker')?.dnd5eSummon)
      .toMatchObject({ side: 'player', concentrationId: 'conjure-elemental' })
  })

  it('turns a prior Conjure Fey summon hostile and keeps its independent token on recast', () => {
    const current = map()
    current.tokens.push({
      ...token(current, 'old-fey', 4, 4, 'enemy'),
      hp: 126,
      maxHp: 126,
      dnd5eSummon: {
        schemaVersion: 1,
        pluginId: 'srd-5.1',
        featureId: 'spell:conjure-fey',
        sourceCharacterId: 'actor',
        sourceTokenId: 'actor',
        createdRound: 1,
        expiresAfterRound: 600,
        concentrationId: 'conjure-fey',
        side: 'player',
        becomesHostileAfterConcentrationEnds: true,
      },
    })
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-fey',
      name: 'Conjure Fey',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'new-fey-cast',
      actorId: 'actor',
      concentrationId: 'conjure-fey',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon', operationId: 'fey',
          monsterId: 'srd-5.1:giant-ape', count: 1,
          timing: 'immediate', durationRounds: 600,
          concentration: true, side: 'ally',
          becomesHostileAfterConcentrationEnds: true,
        }],
        movements: [], invocations: [],
      },
      selection: {
        summonCells: [{ col: 7, row: 6 }],
        summonInitiativeD20s: [12],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.removedTokenIds).toEqual([])
    expect(result.map.tokens.find((candidate) => candidate.id === 'old-fey')?.dnd5eSummon)
      .toMatchObject({ side: 'enemy', controlEnded: true, concentrationId: undefined })
    expect(result.map.tokens.find((candidate) => candidate.poolId === 'srd-5.1:giant-ape')?.dnd5eSummon)
      .toMatchObject({ side: 'player', concentrationId: 'conjure-fey' })
  })

  it('places an upcast Conjure Minor Elementals group with one shared initiative roll', () => {
    const current = map()
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-minor-elementals',
      name: 'Conjure Minor Elementals',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'minor-elementals-sixth-level',
      actorId: 'actor',
      concentrationId: 'conjure-minor-elementals',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon', operationId: 'azer-pair',
          monsterId: 'srd-5.1:azer', count: 2,
          timing: 'immediate', durationRounds: 600,
          concentration: true, side: 'ally',
        }],
        movements: [], invocations: [],
      },
      selection: {
        summonCells: [{ col: 6, row: 5 }, { col: 7, row: 5 }],
        summonInitiativeD20s: [13, 13],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const azers = result.map.tokens.filter((candidate) => candidate.poolId === 'srd-5.1:azer')
    expect(azers).toHaveLength(2)
    expect(azers.every((candidate) => candidate.dnd5eSummon?.concentrationId === 'conjure-minor-elementals'))
      .toBe(true)
    expect(result.initiativeEntries).toHaveLength(2)
    expect(new Set(result.initiativeEntries.map((entry) => entry.roll))).toEqual(new Set([14]))
  })

  it('places an upcast Conjure Woodland Beings group with one shared initiative roll', () => {
    const current = map()
    const conjureActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:conjure-woodland-beings',
      name: 'Conjure Woodland Beings',
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: conjureActivity,
      packageId: 'srd-5.1',
      actionId: 'woodland-eighth-level',
      actorId: 'actor',
      concentrationId: 'conjure-woodland-beings',
      round: 2,
      handoffs: {
        persistentAreas: [],
        summons: [{
          kind: 'summon', operationId: 'sea-hag-trio',
          monsterId: 'srd-5.1:sea-hag', count: 3,
          timing: 'immediate', durationRounds: 600,
          concentration: true, side: 'ally',
        }],
        movements: [], invocations: [],
      },
      selection: {
        summonCells: [{ col: 5, row: 4 }, { col: 6, row: 4 }, { col: 7, row: 4 }],
        summonInitiativeD20s: [11, 11, 11],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const seaHags = result.map.tokens.filter((candidate) => candidate.poolId === 'srd-5.1:sea-hag')
    expect(seaHags).toHaveLength(3)
    expect(seaHags.every((candidate) => candidate.dnd5eSummon?.concentrationId === 'conjure-woodland-beings'))
      .toBe(true)
    expect(result.initiativeEntries).toHaveLength(3)
    expect(new Set(result.initiativeEntries.map((entry) => entry.roll))).toEqual(new Set([12]))
  })

  it('does not replace a selected object for True Polymorph', () => {
    const current = map()
    current.tokens = [
      {
        ...token(current, 'actor', 1, 1, 'player'),
        dnd5eCombatState: { concentrationSpellId: 'true-polymorph' },
      },
      {
        ...token(current, 'granite-statue', 5, 1, 'obstacle'),
        label: '花岗岩雕像', size: 2, hp: 27, maxHp: 27,
        obstacleKind: 'statue', visibilityMode: 'always',
      },
    ]
    const truePolymorphActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:true-polymorph', name: '完全变形术',
      activation: { kind: 'action', cost: 1 }, invocation: { kind: 'active' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 5, maximumTargets: 256,
        includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: truePolymorphActivity, map: current, actorToken: current.tokens[0]!,
      anchorCell: { col: 5, row: 1 },
    })!
    const handoffs: Dnd5eActivityAuthorityHandoffs = {
      persistentAreas: [], movements: [], invocations: [],
      summons: [{
        kind: 'summon', operationId: 'true-polymorph-bear',
        monsterId: 'srd-5.1:brown-bear', count: 1, timing: 'immediate',
        durationRounds: 600, concentration: true, side: 'ally',
        persistAfterConcentrationCompletes: true,
      }],
    }
    const applied = applyDnd5eActivityMapHandoffsV1({
      map: current, activity: truePolymorphActivity, packageId: 'srd-5.1',
      actionId: 'true-polymorph-object-cast', actorId: 'actor', concentrationId: 'true-polymorph',
      round: 1, handoffs, areaSelection, selection: { summonInitiativeD20s: [12] },
    })
    expect(applied.ok, JSON.stringify(applied)).toBe(true)
    if (!applied.ok) return
    expect(applied.map.tokens).toEqual(current.tokens)
    expect(applied.map.tokens.some((candidate) => candidate.dnd5eSummon)).toBe(false)
    expect(applied.changedTokenIds).toEqual([])
    expect(applied.initiativeEntries).toEqual([])
  })

  it('creates a profiled spell entity only in an unoccupied cell', () => {
    const current = map()
    const entityActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:unseen-servant',
      legacySource: { kind: 'spell', id: 'unseen-servant' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 60, radiusFeet: 1, maximumTargets: 1,
      },
    }
    const handoffs: Dnd5eActivityAuthorityHandoffs = {
      persistentAreas: [{
        kind: 'create-persistent-area', operationId: 'servant', label: '隐形仆役',
        durationRounds: 600, concentration: false,
        movement: {
          economy: 'bonus-action', maximumFeet: 15, maximumDistanceFromSourceFeet: 60,
          endWhenExceedingSourceDistance: true,
        },
        creationConstraints: { maximumCreatureCount: 0 },
        entityProfile: {
          armorClass: 10, hitPoints: 1, strength: 2, cannotAttack: true, invisible: true,
        },
        effectToken: { label: '隐形仆役', hiddenBody: true },
      }],
      summons: [], movements: [], invocations: [],
    }
    const selectionAt = (anchorCell: { col: number; row: number }) =>
      resolveDnd5eActivityAreaMapSelectionV1({
        activity: entityActivity, map: current, actorToken: current.tokens[0]!, anchorCell,
      })!
    const occupied = selectionAt({ col: 2, row: 1 })
    expect(applyDnd5eActivityMapHandoffsV1({
      map: current, activity: entityActivity, packageId: 'srd-5.1', actionId: 'occupied',
      actorId: 'actor', round: 1, handoffs: {
        ...handoffs,
        persistentAreas: handoffs.persistentAreas.map((proposal) => ({
          ...proposal, areaInstance: { ...occupied.areaPlacement, origin: 'point', shape: 'circle' },
        })),
      }, areaSelection: occupied, selection: {},
    })).toMatchObject({ ok: false, reason: 'invalid-persistent-area' })

    const empty = selectionAt({ col: 4, row: 4 })
    const created = applyDnd5eActivityMapHandoffsV1({
      map: current, activity: entityActivity, packageId: 'srd-5.1', actionId: 'empty',
      actorId: 'actor', round: 1, worldMinute: 100, handoffs: {
        ...handoffs,
        persistentAreas: handoffs.persistentAreas.map((proposal) => ({
          ...proposal, areaInstance: { ...empty.areaPlacement, origin: 'point', shape: 'circle' },
        })),
      }, areaSelection: empty, selection: {},
    })
    expect(created.ok, JSON.stringify(created)).toBe(true)
    if (!created.ok) return
    expect(created.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'unseen-servant', cells: [{ col: 4, row: 4 }],
      createdRound: 1, expiresAfterRound: 601,
      createdWorldMinute: 100, expiresAtWorldMinute: 160,
      movement: {
        economy: 'bonus-action', maximumFeet: 15, maximumDistanceFromSourceFeet: 60,
        endWhenExceedingSourceDistance: true,
      },
      entityProfile: {
        armorClass: 10, hitPoints: 1, strength: 2, cannotAttack: true, invisible: true,
      },
      entityCurrentHitPoints: 1,
      anchorMode: 'effect-token',
    })
    expect(created.map.tokens.find((candidate) => candidate.dnd5eSpellEffect)?.dnd5eSpellEffect)
      .toMatchObject({ createdRound: 1, expiresAfterRound: 601 })
    expect(created.map.tokens.find((candidate) => candidate.dnd5eSpellEffect)?.visibilityMode)
      .toBe('line-of-sight')
  })

  it('replaces same-source concentration areas and their effect tokens on a same-spell recast', () => {
    const current = map()
    const projectActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:project-image',
      legacySource: { kind: 'spell', id: 'project-image' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 100_000, radiusFeet: 5, maximumTargets: 1,
      },
    }
    current.dnd5ePluginAreas = [{
      id: 'activity-area:old-cast:project-image-projection',
      pluginId: 'srd-5.1', featureId: 'spell:project-image', sourceKind: 'core-spell',
      coreSpellId: 'project-image', label: '投影术', color: '#60a5fa',
      sourceCharacterId: 'actor', sourceTokenId: 'actor',
      cells: [{ col: 3, row: 3 }], createdRound: 1, expiresAfterRound: 14_401,
      concentrationId: 'project-image', anchorMode: 'effect-token',
      anchorTokenId: 'activity-effect:old-cast:project-image-projection',
      anchorCell: { col: 3, row: 3 },
    }]
    current.tokens.push({
      ...token(current, 'activity-effect:old-cast:project-image-projection', 3, 3, 'obstacle'),
      dnd5eSpellEffect: {
        schemaVersion: 1, spellId: 'project-image', sourceCharacterId: 'actor',
        sourceTokenId: 'actor', createdRound: 1, expiresAfterRound: 14_401,
        concentrationId: 'project-image',
      },
    })
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: projectActivity, map: current, actorToken: current.tokens[0]!,
      anchorCell: { col: 6, row: 3 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current, activity: projectActivity, packageId: 'srd-5.1',
      actionId: 'new-cast', actorId: 'actor', concentrationId: 'project-image',
      round: 1, areaSelection, selection: {},
      handoffs: {
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'project-image-projection',
          label: '投影术', durationRounds: 14_400, concentration: true,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'circle' },
          effectToken: { label: '投影术' },
        }],
        summons: [], movements: [], invocations: [],
      },
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas?.filter((area) => area.coreSpellId === 'project-image'))
      .toHaveLength(1)
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      id: 'activity-area:new-cast:project-image-projection',
      anchorCell: { col: 6, row: 3 },
    })
    expect(result.map.tokens.filter((candidate) =>
      candidate.dnd5eSpellEffect?.spellId === 'project-image')).toHaveLength(1)
    expect(result.map.tokens.some((candidate) =>
      candidate.id === 'activity-effect:old-cast:project-image-projection')).toBe(false)
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

  it('relocates the persistent entity that granted an Activity as one Host map transaction', () => {
    const current = map()
    current.tokens[1] = token(current, 'target', 5, 3, 'enemy')
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 2, row: 3 },
      rectRotation: 0,
    })!
    const created = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity,
      packageId: 'local.activity-test',
      actionId: 'create-sword-entity',
      actorId: 'actor',
      sourceSaveDc: 15,
      round: 1,
      handoffs: {
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'sword-entity', label: 'Sword entity',
          durationRounds: 10, concentration: true,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'rect' },
          grantedActivities: [{ activityId: 'sword-attack' }],
          effectToken: { label: 'Sword entity', emoji: '⚔', size: 0.5 },
        }],
        summons: [], movements: [], invocations: [],
      },
      areaSelection,
      selection: {},
    })
    expect(created.ok, JSON.stringify(created)).toBe(true)
    if (!created.ok) return
    const area = created.map.dnd5ePluginAreas?.[0]
    expect(area).toBeDefined()
    const relocationActivity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'sword-attack', name: 'Sword attack',
      activation: { kind: 'bonus-action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: { kind: 'creature', relation: 'enemy', rangeFeet: 60, count: 1 },
      outcomes: [], automation,
    }
    const relocated = applyDnd5eActivityMapHandoffsV1({
      map: created.map,
      activity: relocationActivity,
      packageId: 'local.activity-test',
      actionId: 'sword-attack',
      actorId: 'actor',
      sourceSaveDc: 15,
      round: 1,
      grantingPersistentAreaId: area!.id,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        areaRelocations: [{
          kind: 'relocate-granting-area', operationId: 'move-sword', targetId: 'target', maximumFeet: 20,
        }],
      },
      selection: {},
    })
    expect(relocated.ok, JSON.stringify({ relocated, area, target: created.map.tokens.find((entry) => entry.id === 'target') })).toBe(true)
    if (!relocated.ok) return
    expect(relocated.map.dnd5ePluginAreas?.[0]?.anchorCell).toEqual({ col: 5, row: 3 })
    const effectTokenId = relocated.map.dnd5ePluginAreas?.[0]?.anchorTokenId
    expect(relocated.map.tokens.find((entry) => entry.id === effectTokenId)).toMatchObject(
      cellToPixel({ col: 5, row: 3 }, relocated.map),
    )
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
          sourceOverlapBehavior: 'remove-area',
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
      sourceOverlapBehavior: 'remove-area',
    })
  })

  it('reshapes a source-anchored line without teleporting its source token', () => {
    const current = map()
    const actor = current.tokens[0]!
    const originalPosition = { x: actor.x, y: actor.y }
    const redirectActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'gust-redirect',
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'line',
        lengthFeet: 60, widthFeet: 10, placeRangeFeet: 60,
        maximumTargets: 256, includeSelf: false, rotatable: true,
      },
    }
    current.dnd5ePluginAreas = [{
      id: 'gust-area', pluginId: 'local.activity-test', featureId: 'spell:gust-of-wind',
      label: 'Gust of Wind', color: '#fff', sourceCharacterId: 'actor', sourceTokenId: 'actor',
      cells: [{ col: 2, row: 1 }], createdRound: 1, expiresAfterRound: 11,
      anchorMode: 'source-token', anchorTokenId: 'actor', anchorCell: { col: 1, row: 1 },
      grantedActivities: [{ activityId: 'gust-redirect', label: 'Redirect' }],
    }]
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: redirectActivity,
      map: current,
      actorToken: actor,
      anchorCell: { col: 1, row: 3 },
    })!

    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: redirectActivity,
      packageId: 'local.activity-test',
      actionId: 'gust-redirect-action',
      actorId: 'actor',
      round: 1,
      handoffs: {
        summons: [], movements: [], invocations: [], persistentAreas: [],
        areaReshapes: [{ kind: 'reshape-granting-area', operationId: 'reshape', targetId: 'actor' }],
      },
      areaSelection,
      selection: {},
      grantingPersistentAreaId: 'gust-area',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.map.tokens.find((candidate) => candidate.id === actor.id)).toMatchObject(originalPosition)
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 1, row: 1 },
      cells: areaSelection.cells,
    })
  })

  it('creates a source-owned shared-vision effect Token and anchors the area to it', () => {
    const current = map()
    const sensorActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'arcane-eye',
      legacySource: { kind: 'spell', id: 'arcane-eye', magical: true },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 5, maximumTargets: 1,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: sensorActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 4, row: 4 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: sensorActivity,
      packageId: 'srd-5.1',
      actionId: 'arcane-eye-cast',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'sensor', label: 'Arcane Eye',
          durationRounds: 600, concentration: true,
          movement: { economy: 'action', maximumFeet: 30 },
          effectToken: {
            label: 'Arcane Eye', hiddenBody: true,
            shareVisionWithSource: true, darkvisionRangeFeet: 30,
          },
          areaInstance: { ...areaSelection.areaPlacement, origin: 'point', shape: 'circle' },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const effectToken = result.map.tokens.find((candidate) => candidate.dnd5eSpellEffect?.spellId === 'arcane-eye')
    expect(effectToken).toMatchObject({
      type: 'obstacle', visibilityMode: 'line-of-sight', darkvisionRangeFeet: 30,
      dnd5eSpellEffect: {
        sourceCharacterId: 'actor', sourceTokenId: 'actor',
        shareVisionWithSource: true, hiddenBody: true,
      },
    })
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorMode: 'effect-token', anchorTokenId: effectToken?.id,
      movement: { economy: 'action', maximumFeet: 30 },
    })
    expect(result.changedTokenIds).toContain(effectToken?.id)
  })

  it('captures Tiny Hut occupants on the Host and persists a fixed permission boundary', () => {
    const current = map()
    current.tokens[1] = token(current, 'ally', 2, 1, 'player')
    current.tokens.push(token(current, 'outsider', 8, 8, 'enemy'))
    const hutActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'tiny-hut',
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'sphere',
        radiusFeet: 10, maximumTargets: 16, includeSelf: true,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: hutActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 1, row: 1 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: hutActivity,
      packageId: 'srd-5.1',
      actionId: 'tiny-hut-cast',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'tiny-hut-area', label: 'Tiny Hut',
          durationRounds: 4_800, concentration: false,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'self', shape: 'sphere' },
          creationConstraints: { maximumCreatureCount: 10, maximumCreatureSizeRank: 2 },
          anchorMode: 'fixed',
          sourceExitBehavior: 'remove-area',
          blocking: {
            movement: true,
            movementMode: 'enter',
            entryPermission: 'occupants-at-creation',
            authorizedTokenIds: ['spoofed-client-id'],
            blocksTeleportationEntry: true,
            vision: true,
            visionMode: 'outside-in',
            lineOfEffect: true,
            lineOfEffectMode: 'boundary',
          },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.map.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorMode: 'fixed',
      anchorTokenId: undefined,
      sourceExitBehavior: 'remove-area',
      blocking: {
        entryPermission: 'occupants-at-creation',
        authorizedTokenIds: expect.arrayContaining(['actor', 'ally']),
        visionMode: 'outside-in',
        lineOfEffectMode: 'boundary',
      },
    })
    expect(result.map.dnd5ePluginAreas?.[0]?.blocking?.authorizedTokenIds).not.toContain('outsider')
    expect(result.map.dnd5ePluginAreas?.[0]?.blocking?.authorizedTokenIds).not.toContain('spoofed-client-id')
  })

  it('canonicalizes a self-origin Tiny Hut sphere to the caster cell', () => {
    const current = map()
    const hutActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'tiny-hut-self-origin',
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'sphere',
        radiusFeet: 10, maximumTargets: 16, includeSelf: true,
      },
    }

    const selection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: hutActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 8, row: 8 },
    })

    expect(selection).toMatchObject({
      anchorCell: { col: 1, row: 1 },
      areaPlacementDistanceFeet: 0,
    })
    expect(selection?.targetIds).toEqual(expect.arrayContaining(['actor', 'target']))
  })

  it('allows Tiny Hut to hold the caster plus nine other creatures but rejects an eleventh occupant', () => {
    const current = map()
    current.tokens = [
      current.tokens[0]!,
      ...Array.from({ length: 9 }, (_, index) =>
        token(current, `ally-${index + 1}`, 1, 1, 'player')),
    ]
    const hutActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'tiny-hut-capacity',
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'sphere',
        radiusFeet: 10, maximumTargets: 16, includeSelf: true,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: hutActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 1, row: 1 },
    })!
    const cast = (map: BattleMap) => applyDnd5eActivityMapHandoffsV1({
      map,
      activity: hutActivity,
      packageId: 'srd-5.1',
      actionId: 'tiny-hut-capacity-cast',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'tiny-hut-area', label: 'Tiny Hut',
          durationRounds: 4_800, concentration: false,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'self', shape: 'sphere' },
          creationConstraints: { maximumCreatureCount: 10, maximumCreatureSizeRank: 2 },
        }],
      },
      areaSelection,
      selection: {},
    })

    expect(cast(current).ok).toBe(true)
    const overflow = {
      ...current,
      tokens: [...current.tokens, token(current, 'ally-10', 1, 1, 'player')],
    }
    expect(cast(overflow)).toEqual({ ok: false, reason: 'invalid-persistent-area' })
  })

  it('rejects persistent-area creation when a bounded occupant constraint is exceeded', () => {
    const current = map()
    current.tokens[1] = { ...current.tokens[1]!, size: 3 }
    const boundedActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'bounded-area',
      target: {
        kind: 'area', relation: 'any', origin: 'self', shape: 'sphere',
        radiusFeet: 10, maximumTargets: 16, includeSelf: true,
      },
    }
    const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: boundedActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 1, row: 1 },
    })!
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: boundedActivity,
      packageId: 'local.activity-test',
      actionId: 'bounded-area-cast',
      actorId: 'actor',
      round: 2,
      handoffs: {
        summons: [], movements: [], invocations: [],
        persistentAreas: [{
          kind: 'create-persistent-area', operationId: 'bounded', label: 'Bounded area',
          durationRounds: 10, concentration: false,
          areaInstance: { ...areaSelection.areaPlacement, origin: 'self', shape: 'sphere' },
          creationConstraints: { maximumCreatureSizeRank: 2 },
        }],
      },
      areaSelection,
      selection: {},
    })
    expect(result).toEqual({ ok: false, reason: 'invalid-persistent-area' })
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

  it('leaves Arcane Lock and Knock object state to the DM', () => {
    const current = map()
    const lockActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'arcane-lock',
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 60, radiusFeet: 5, maximumTargets: 1,
      },
    }
    const anchor = { col: 3, row: 1 }
    const selected = resolveDnd5eActivityAreaMapSelectionV1({
      activity: lockActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: anchor,
    })!
    const midpoint = cellToPixel(anchor, current)
    const geometry = createEmptyMapGeometry(current.id, 1)
    geometry.doors.push({
      id: 'vault-door', kind: 'door', label: 'Vault door',
      points: [{ x: midpoint.x, y: midpoint.y - 20 }, { x: midpoint.x, y: midpoint.y + 20 }],
      state: 'closed', openState: 'closed', lockState: 'unlocked', physicalState: 'intact',
      secret: false, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    setMapGeometryRuntime([geometry])
    const locked = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: lockActivity,
      packageId: 'srd-5.1',
      actionId: 'arcane-lock-cast',
      actorId: 'actor',
      round: 4,
      worldMinute: 50,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        mapObjectLocks: [{
          kind: 'modify-map-object-lock', operationId: 'arcane-lock-map-object',
          mode: 'arcane-lock', targetKinds: ['door', 'obstacle'], spellLevel: 2,
          authorizedTargetIds: ['ally'], passwordDigest: 'fnv1a32:01020304',
        }],
      },
      areaSelection: selected,
      selection: {},
    })
    expect(locked.ok, JSON.stringify(locked)).toBe(true)
    if (!locked.ok) return
    expect(locked.map).toEqual(current)
    expect(locked.geometryDoorPatches).toEqual([])
    const knocked = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: { ...lockActivity, id: 'knock' },
      packageId: 'srd-5.1',
      actionId: 'knock-cast',
      actorId: 'actor',
      round: 7,
      combatId: 'combat-1',
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        mapObjectLocks: [{
          kind: 'modify-map-object-lock', operationId: 'knock-map-object',
          mode: 'knock', targetKinds: ['door', 'obstacle'], spellLevel: 2,
          suppressionMinutes: 10,
        }],
      },
      areaSelection: selected,
      selection: {},
    })
    expect(knocked.ok, JSON.stringify(knocked)).toBe(true)
    if (!knocked.ok) return
    expect(knocked.map).toEqual(current)
    expect(knocked.geometryDoorPatches).toEqual([])
  })

  it('does not attach Magic Mouth to a map object', () => {
    const current = map()
    current.tokens.push({
      ...token(current, 'magic-mouth-statue', 3, 1, 'obstacle'),
      label: '魔嘴石像',
    })
    const magicMouthActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'spell:magic-mouth',
      legacySource: { kind: 'spell', id: 'magic-mouth' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 30, maximumTargets: 256,
        includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
    }
    const selection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: magicMouthActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 3, row: 1 },
    })!
    const proposal = {
      kind: 'create-persistent-area' as const,
      operationId: 'magic-mouth-object-enchantment',
      label: '魔嘴术',
      durationRounds: 14_400,
      permanent: true as const,
      concentration: false,
      mappedObjectEnchantment: 'magic-mouth' as const,
      magicMouth: {
        schemaVersion: 1 as const,
        message: '警告：前方有危险',
        trigger: '任意生物进入物件周围 30 尺',
        triggerMode: 'proximity' as const,
        repeat: false,
      },
      triggers: [{
        id: 'magic-mouth-proximity', label: '魔嘴术·触发讯息', timing: 'on-enter' as const,
        oncePerRound: false, maximumTotalUses: 1,
        notification: { delivery: 'audible' as const, audibleRadiusFeet: 30, message: '警告：前方有危险' },
      }],
      areaInstance: { ...selection.areaPlacement, origin: 'point' as const, shape: 'circle' as const },
    }
    const created = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: magicMouthActivity,
      packageId: 'srd-5.1',
      actionId: 'magic-mouth-cast',
      actorId: 'actor',
      round: 1,
      handoffs: { persistentAreas: [proposal], summons: [], movements: [], invocations: [] },
      areaSelection: selection,
      selection: {},
    })
    expect(created.ok, JSON.stringify(created)).toBe(true)
    if (!created.ok) return
    expect(created.map).toEqual(current)
    expect(created.map.dnd5ePluginAreas).toBeUndefined()

    const emptySelection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: magicMouthActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 4, row: 4 },
    })!
    const rejected = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: magicMouthActivity,
      packageId: 'srd-5.1',
      actionId: 'magic-mouth-invalid-cast',
      actorId: 'actor',
      round: 1,
      handoffs: {
        persistentAreas: [{
          ...proposal,
          areaInstance: { ...emptySelection.areaPlacement, origin: 'point', shape: 'circle' },
        }],
        summons: [], movements: [], invocations: [],
      },
      areaSelection: emptySelection,
      selection: {},
    })
    expect(rejected).toMatchObject({ ok: true, map: current, changedTokenIds: [] })
  })

  it('does not attach Light to a mapped object', () => {
    const current = map()
    current.tokens.push(token(current, 'lantern', 2, 2, 'obstacle'))
    const lightActivity: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'light',
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 5, radiusFeet: 5, maximumTargets: 1,
      },
    }
    const selectedObject = resolveDnd5eActivityAreaMapSelectionV1({
      activity: lightActivity,
      map: current,
      actorToken: current.tokens[0]!,
      anchorCell: { col: 2, row: 2 },
    })!
    const carried = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: lightActivity,
      packageId: 'srd-5.1',
      actionId: 'light-object-cast',
      actorId: 'actor',
      round: 1,
      worldMinute: 25,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        mapObjectLights: [{
          kind: 'enchant-map-object-light', operationId: 'light-map-object',
          brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fef3c7', durationMinutes: 60,
        }],
      },
      areaSelection: selectedObject,
      selection: {},
    })
    expect(carried.ok, JSON.stringify(carried)).toBe(true)
    if (!carried.ok) return
    expect(carried.map).toEqual(current)
    expect(carried.changedTokenIds).toEqual([])
    expect(carried.map.tokens.find((candidate) => candidate.id === 'lantern')?.lightSource).toBeUndefined()
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

  it('creates a persistent half-hit-point simulacrum beside the selected creature', () => {
    const current = map()
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: { ...activity, id: 'simulacrum' },
      packageId: 'srd-5.1',
      actionId: 'simulacrum-cast-1',
      actorId: 'actor',
      sourceSaveDc: 15,
      sourceInitiative: 14,
      combatId: 'combat-simulacrum',
      round: 3,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        duplications: [{
          kind: 'duplicate-creature', operationId: 'duplicate-simulacrum',
          sourceActorId: 'actor', targetId: 'target', profile: 'simulacrum', persistent: true,
          level: 8, proficiencyBonus: 3, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
          armorClass: 15, maximumHitPoints: 18, speed: 30, sizeRank: 2,
          creatureType: 'humanoid', saveDc: 13,
          classLevels: { fighter: 8 }, resources: { 'dnd5e-spell-slot-1': { current: 2, maximum: 4 } },
          cannotIncreaseLevel: true, cannotRegainSpellSlots: true,
        }],
      },
      selection: {},
    })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const duplicate = result.map.tokens.find((candidate) => candidate.id === 'activity-simulacrum:actor')
    expect(duplicate).toMatchObject({
      label: 'target·拟像', hp: 18, maxHp: 18, type: 'player', dnd5eSide: 'player',
      dnd5eSummon: { persistent: true, sourceTokenId: 'actor' },
      dnd5eSimulacrum: {
        subjectTokenId: 'target', maximumHitPoints: 18,
        classResources: { 'dnd5e-spell-slot-1': { current: 2, maximum: 4 } },
        cannotIncreaseLevel: true, cannotRegainSpellSlots: true, cannotRegainHitPoints: true,
      },
    })
    expect(result.initiativeEntries).toContainEqual(expect.objectContaining({
      tokenId: 'activity-simulacrum:actor', roll: 14,
      turnKind: 'source-companion',
    }))
    expect(result.initiativeEntries[0]?.initiativeCalculation).toBeUndefined()
  })

  it('rejects an in-combat duplicate when the Host did not provide the source initiative', () => {
    const current = map()
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: { ...activity, id: 'simulacrum' },
      packageId: 'srd-5.1',
      actionId: 'simulacrum-cast-missing-initiative',
      actorId: 'actor',
      combatId: 'combat-simulacrum',
      round: 3,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        duplications: [{
          kind: 'duplicate-creature', operationId: 'duplicate-simulacrum',
          sourceActorId: 'actor', targetId: 'target', profile: 'simulacrum', persistent: true,
          level: 8, proficiencyBonus: 3, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
          armorClass: 15, maximumHitPoints: 18, speed: 30, sizeRank: 2,
          creatureType: 'humanoid', saveDc: 13, resources: {},
          cannotIncreaseLevel: true, cannotRegainSpellSlots: true,
        }],
      },
      selection: {},
    })
    expect(result).toEqual({ ok: false, reason: 'invalid-summon-placement' })
    expect(current.tokens).toHaveLength(2)
  })

  it('creates an exploration simulacrum without inventing an initiative entry', () => {
    const current = map()
    const result = applyDnd5eActivityMapHandoffsV1({
      map: current,
      activity: { ...activity, id: 'simulacrum' },
      packageId: 'srd-5.1',
      actionId: 'simulacrum-exploration-cast',
      actorId: 'actor',
      round: 1,
      handoffs: {
        persistentAreas: [], summons: [], movements: [], invocations: [],
        duplications: [{
          kind: 'duplicate-creature', operationId: 'duplicate-simulacrum',
          sourceActorId: 'actor', targetId: 'target', profile: 'simulacrum', persistent: true,
          level: 8, proficiencyBonus: 3, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
          armorClass: 15, maximumHitPoints: 18, speed: 30, sizeRank: 2,
          creatureType: 'humanoid', saveDc: 13, resources: {},
          cannotIncreaseLevel: true, cannotRegainSpellSlots: true,
        }],
      },
      selection: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.initiativeEntries).toEqual([])
  })
})
