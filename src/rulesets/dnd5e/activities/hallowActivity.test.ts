import { describe, expect, it } from 'vitest'
import { cellToPixel } from '../../../lib/gridCombat'
import { dnd5ePersistentAreaTeleportationBoundary } from '../../../lib/mapGeometry'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../../store/maps'
import { dnd5ePersistentAreaOccupantModifiersAt } from '../persistentAreaGeometry'
import { reconcileDnd5ePluginAreasOnMap } from '../pluginAreas'
import type { Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import { dnd5eSrdAuditedSpellActivityV1 } from './dnd5eSrdAuditedSpellActivities'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 20, cha: 10 } as const
const actor: Dnd5eActivityActorSnapshot = {
  id: 'cleric', controller: 'player', level: 20, proficiencyBonus: 6, abilities,
  armorClass: 18, conditions: [], currentHp: 100, maxHp: 100, spellSaveDc: 19,
  resources: { 'dnd5e-spell-slot-5': { current: 3, maximum: 3 } },
}

function token(map: BattleMap, id: string, col: number, row: number, type: Token['type']): Token {
  return {
    id, label: id, color: '#fff', emoji: id, size: 1, type,
    ...cellToPixel({ col, row }, map),
    ...(type === 'player' ? { characterId: id } : {}),
  }
}

function battleMap(): BattleMap {
  const map: BattleMap = {
    id: 'hallow-map', name: 'Hallow map', width: 1_000, height: 1_000,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [],
  }
  map.tokens = [token(map, 'cleric', 10, 10, 'player'), token(map, 'fiend', 18, 10, 'enemy')]
  map.tokens[1]!.creatureTypes = ['fiend']
  return map
}

function hallowArea(effect: Dnd5ePluginArea['hallow']): Dnd5ePluginArea {
  return {
    id: 'hallow-area', pluginId: 'srd-5.1', featureId: 'spell:hallow',
    sourceKind: 'core-spell', coreSpellId: 'hallow', label: '圣居', color: '#f5d76e',
    sourceCharacterId: 'cleric', sourceTokenId: 'cleric',
    cells: [{ col: 10, row: 10 }], createdRound: 1, expiresAfterRound: 5_256_001,
    permanent: true, relation: 'any', includeSelf: true, hallow: effect,
  }
}

describe('Hallow audited Activity', () => {
  it('exposes every printed closed choice without a DM approval operation', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('hallow')!
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.activation).toEqual({ kind: 'hour', value: 24 })
    expect(activity.target).toMatchObject({
      kind: 'area', origin: 'point', shape: 'circle', placeRangeFeet: 5, radiusFeet: 60,
    })
    expect(activity.choices?.find((choice) => choice.id === 'hallow-effect')?.options)
      .toHaveLength(10)
    expect(activity.outcomes.flatMap((outcome) => outcome.operations))
      .not.toContainEqual(expect.objectContaining({ kind: 'manual-adjudication' }))
  })

  it('resolves energy vulnerability, scope and ward exemptions into one permanent area', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('hallow')!
    const resolved = resolveDnd5eActivity({
      activity, actor, targets: [], rolls: {}, castLevel: 5,
      areaPlacement: { x: 525, y: 525, radiusFeet: 60 }, areaPlacementDistanceFeet: 0,
      choices: {
        'hallow-effect': 'energy-vulnerability', 'hallow-damage-type': 'fire',
        'hallow-scope': 'type-fiend', 'hallow-exempt-celestial': 'ward',
        'hallow-exempt-elemental': 'ward', 'hallow-exempt-fey': 'exempt',
        'hallow-exempt-fiend': 'ward', 'hallow-exempt-undead': 'ward',
      },
    })
    expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
    if (!resolved.ok) return
    expect(resolved.proposals).toContainEqual(expect.objectContaining({
      kind: 'create-persistent-area', permanent: true,
      hallow: {
        additionalEffect: 'energy-vulnerability', damageType: 'fire',
        effectScope: 'creature-type', affectedCreatureType: 'fiend',
        wardedCreatureTypes: ['celestial', 'elemental', 'fiend', 'undead'],
      },
      blocking: expect.objectContaining({ movementMode: 'enter', blocksTeleportationEntry: true }),
      creationConstraints: { forbidCoreSpellOverlap: 'hallow' },
    }))
  })

  it('projects courage, energy, silence and tongues only to eligible occupants', () => {
    const map = battleMap()
    const fiend = map.tokens[1]!
    const cases = [
      ['courage', { conditionImmunities: ['frightened'] }],
      ['energy-protection', { damageResistances: ['fire'] }],
      ['energy-vulnerability', { damageVulnerabilities: ['fire'] }],
      ['silence', { preventsVerbalComponents: true }],
      ['tongues', { languageCapabilities: {
        understandSpoken: 'all', speechUnderstoodBy: 'any-creature-knowing-a-language',
      } }],
    ] as const
    for (const [additionalEffect, expected] of cases) {
      const area = hallowArea({
        additionalEffect,
        ...(additionalEffect === 'energy-protection' || additionalEffect === 'energy-vulnerability'
          ? { damageType: 'fire' as const }
          : {}),
        effectScope: 'creature-type', affectedCreatureType: 'fiend',
        wardedCreatureTypes: ['celestial', 'elemental', 'fey', 'fiend', 'undead'],
      })
      area.cells = [{ col: 18, row: 10 }]
      const local = { ...map, dnd5ePluginAreas: [area] }
      expect(dnd5ePersistentAreaOccupantModifiersAt({ map: local, token: fiend, position: fiend }))
        .toMatchObject(expected)
    }
  })

  it('blocks scoped extradimensional travel in both directions', () => {
    const map = battleMap()
    const fiend = map.tokens[1]!
    const area = hallowArea({
      additionalEffect: 'extradimensional-interference', effectScope: 'creature-type',
      affectedCreatureType: 'fiend',
      wardedCreatureTypes: ['celestial', 'elemental', 'fey', 'fiend', 'undead'],
    })
    area.cells = [{ col: 10, row: 10 }, { col: 11, row: 10 }]
    const local = { ...map, dnd5ePluginAreas: [area] }
    expect(dnd5ePersistentAreaTeleportationBoundary({
      map: local, token: fiend, from: fiend, to: { x: 525, y: 525 },
    })).toMatchObject({ areaId: 'hallow-area' })
    expect(dnd5ePersistentAreaTeleportationBoundary({
      map: local, token: fiend, from: { x: 525, y: 525 }, to: fiend,
    })).toMatchObject({ areaId: 'hallow-area' })
  })

  it('retains a successful Charisma save only until the creature leaves', () => {
    const map = battleMap()
    const fiend = map.tokens[1]!
    const area = hallowArea({
      additionalEffect: 'energy-vulnerability', damageType: 'fire',
      effectScope: 'creature-type', affectedCreatureType: 'fiend',
      wardedCreatureTypes: ['celestial', 'elemental', 'fey', 'fiend', 'undead'],
    })
    area.cells = [{ col: 18, row: 10 }]
    area.triggerReceipts = [{
      triggerId: 'hallow-additional-effect-save', targetTokenId: fiend.id,
      round: 1, turnKey: '1:fiend', transactionId: 'hallow-save-success',
      savingThrowSucceeded: true,
    }]
    const inside = { ...map, dnd5ePluginAreas: [area] }
    expect(dnd5ePersistentAreaOccupantModifiersAt({ map: inside, token: fiend, position: fiend })
      .damageVulnerabilities).toEqual([])

    const movedFiend = { ...fiend, ...cellToPixel({ col: 19, row: 10 }, map) }
    const outside = reconcileDnd5ePluginAreasOnMap({
      ...inside, tokens: [inside.tokens[0]!, movedFiend],
    }, [], 1)
    expect(outside.dnd5ePluginAreas?.[0]?.triggerReceipts).toBeUndefined()
  })

  it('rejects overlap with an existing Hallow before committing a second area', () => {
    const map = battleMap()
    const activity = dnd5eSrdAuditedSpellActivityV1('hallow')!
    const first = hallowArea({
      additionalEffect: 'courage', effectScope: 'all',
      wardedCreatureTypes: ['celestial', 'elemental', 'fey', 'fiend', 'undead'],
    })
    first.cells = [{ col: 10, row: 10 }]
    const handoff = {
      kind: 'create-persistent-area' as const, operationId: 'hallow-area', label: '圣居',
      durationRounds: 5_256_000, permanent: true as const, concentration: false,
      creationConstraints: { forbidCoreSpellOverlap: 'hallow' },
      hallow: first.hallow!,
      areaInstance: {
        x: 525, y: 525, radiusFeet: 60, origin: 'point' as const, shape: 'circle' as const,
      },
    }
    const result = applyDnd5eActivityMapHandoffsV1({
      map: { ...map, dnd5ePluginAreas: [first] }, activity,
      packageId: 'srd-5.1', actionId: 'second-hallow', actorId: 'cleric',
      sourceSaveDc: 19, round: 1,
      handoffs: { persistentAreas: [handoff], summons: [], movements: [], invocations: [] },
      areaSelection: {
        anchorCell: { col: 10, row: 10 }, cells: [{ col: 10, row: 10 }], targetIds: [],
        areaPlacement: { x: 525, y: 525, radiusFeet: 60 }, areaPlacementDistanceFeet: 0,
      },
      selection: {},
    })
    expect(result).toEqual({ ok: false, reason: 'invalid-persistent-area' })
  })
})
