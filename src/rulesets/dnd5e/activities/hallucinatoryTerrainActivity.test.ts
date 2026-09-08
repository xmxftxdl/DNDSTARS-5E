import { describe, expect, it } from 'vitest'
import { cellToPixel } from '../../../lib/gridCombat'
import type { BattleMap, Token } from '../../../store/maps'
import type {
  Dnd5eActivityActorSnapshot,
  Dnd5eActivityCapabilityProposal,
} from './dnd5eActivityExecutor'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import {
  applyDnd5eActivityMapHandoffsV1,
  resolveDnd5eActivityAreaMapSelectionV1,
} from './dnd5eActivityMapInteraction'
import { dnd5eSrdAuditedSpellActivityV1 } from './dnd5eSrdAuditedSpellActivities'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const actor: Dnd5eActivityActorSnapshot = {
  id: 'wizard', controller: 'player', level: 20, proficiencyBonus: 6,
  abilities: { str: 8, dex: 14, con: 16, int: 20, wis: 12, cha: 10 },
  armorClass: 16, conditions: [], currentHp: 120, maxHp: 120, spellSaveDc: 19,
  resources: { 'dnd5e-spell-slot-4': { current: 3, maximum: 3 } },
}

function map(): BattleMap {
  const map: BattleMap = {
    id: 'hallucinatory-terrain-map', name: 'Terrain map',
    width: 4_000, height: 4_000, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [],
  }
  const token: Token = {
    id: 'wizard-token', characterId: 'wizard', label: 'Wizard',
    color: '#fff', emoji: 'W', size: 1, type: 'player',
    ...cellToPixel({ col: 40, row: 40 }, map),
  }
  map.tokens = [token]
  return map
}

describe('Hallucinatory Terrain audited Activity', () => {
  it('declares the printed cube, duration and appearance choices without DM approval', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('hallucinatory-terrain')!
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.activation).toEqual({ kind: 'minute', value: 10 })
    expect(activity.target).toMatchObject({
      kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 300,
      lengthFeet: 150, widthFeet: 150, heightFeet: 150,
    })
    expect(activity.choices?.find((choice) =>
      choice.id === 'hallucinatory-terrain-appearance')?.options.map((option) => option.id))
      .toEqual([
        'swamp', 'hill', 'crevasse', 'meadow', 'gentle-slope', 'road',
        'other-natural-terrain',
      ])
    expect(activity.outcomes.flatMap((outcome) => outcome.operations))
      .not.toContainEqual(expect.objectContaining({ kind: 'manual-adjudication' }))
    expect(activity.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area', durationRounds: 14_400,
        concentration: false,
      }),
    )
  })

  it('resolves and persists the selected appearance, save DC and 150-foot volume', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('hallucinatory-terrain')!
    const current = map()
    const selection = resolveDnd5eActivityAreaMapSelectionV1({
      activity, map: current, actorToken: current.tokens[0]!,
      anchorCell: { col: 40, row: 40 },
    })!
    expect(selection.cells).toHaveLength(900)
    const resolved = resolveDnd5eActivity({
      activity, actor, targets: [], rolls: {}, castLevel: 4,
      areaPlacement: selection.areaPlacement,
      areaPlacementDistanceFeet: selection.areaPlacementDistanceFeet,
      choices: { 'hallucinatory-terrain-appearance': 'road' },
    })
    expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
    if (!resolved.ok) return
    const areaProposal = resolved.proposals.find((proposal): proposal is Extract<
      Dnd5eActivityCapabilityProposal, { kind: 'create-persistent-area' }
    > => proposal.kind === 'create-persistent-area')!
    expect(areaProposal).toMatchObject({
      durationRounds: 14_400, concentration: false,
      hallucinatoryTerrain: { appearance: 'road' },
      areaInstance: { lengthFeet: 150, widthFeet: 150, heightFeet: 150 },
    })

    const committed = applyDnd5eActivityMapHandoffsV1({
      map: current, activity, packageId: 'srd-5.1', actionId: 'terrain-cast',
      actorId: 'wizard-token', sourceSaveDc: 19, castLevel: 4, round: 7,
      worldMinute: 600, areaSelection: selection, selection: {},
      handoffs: {
        persistentAreas: [areaProposal], summons: [], movements: [], invocations: [],
      },
    })
    expect(committed.ok, JSON.stringify(committed)).toBe(true)
    if (!committed.ok) return
    expect(committed.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'hallucinatory-terrain', slotLevel: 4, sourceSpellSaveDc: 19,
      createdWorldMinute: 600, expiresAtWorldMinute: 2_040,
      hallucinatoryTerrain: { appearance: 'road' },
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 150 },
    })
    expect(committed.map.dnd5ePluginAreas?.[0]?.cells).toHaveLength(900)
    expect(committed.map.dnd5ePluginAreas?.[0]?.concentrationId).toBeUndefined()
  })
})
