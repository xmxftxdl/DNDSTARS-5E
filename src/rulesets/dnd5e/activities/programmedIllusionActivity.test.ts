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
import {
  dnd5eSrdAuditedSpellActivityV1,
  dnd5eSrdAuditedSpellDefinitionV1,
} from './dnd5eSrdAuditedSpellActivities'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { normalizeDnd5eProgrammedIllusionAreaState } from '../persistentAreaTypes'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { dnd5ePluginSpellActivity } from '../pluginSpellTransaction'

const actor: Dnd5eActivityActorSnapshot = {
  id: 'wizard', controller: 'player', level: 20, proficiencyBonus: 6,
  abilities: { str: 8, dex: 14, con: 16, int: 20, wis: 12, cha: 10 },
  armorClass: 16, conditions: [], currentHp: 120, maxHp: 120, spellSaveDc: 19,
  resources: { 'dnd5e-spell-slot-6': { current: 2, maximum: 2 } },
}

function map(): BattleMap {
  const battleMap: BattleMap = {
    id: 'programmed-illusion-map', name: 'Illusion map',
    width: 2_000, height: 2_000, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [],
  }
  const token: Token = {
    id: 'wizard-token', characterId: 'wizard', label: 'Wizard',
    color: '#fff', emoji: 'W', size: 1, type: 'player',
    ...cellToPixel({ col: 10, row: 10 }, battleMap),
  }
  battleMap.tokens = [token]
  return battleMap
}

describe('Programmed Illusion audited Activity', () => {
  it('normalizes only closed Programmed Illusion declarations', () => {
    expect(normalizeDnd5eProgrammedIllusionAreaState({
      form: 'object', triggerSense: 'visual-or-auditory',
    })).toEqual({ form: 'object', triggerSense: 'visual-or-auditory' })
    expect(normalizeDnd5eProgrammedIllusionAreaState({
      form: 'anything', triggerSense: 'visual',
    })).toBeUndefined()
  })

  it('targets a map volume instead of a creature and creates no DM approval step', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('programmed-illusion')!
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.target).toMatchObject({
      kind: 'area', origin: 'point', shape: 'cube', placeRangeFeet: 120,
      lengthFeet: 30, minimumLengthFeet: 5,
      widthFeet: 30, minimumWidthFeet: 5, heightFeet: 30,
    })
    expect(activity.choices).toBeUndefined()
    expect(activity.outcomes.flatMap((outcome) => outcome.operations))
      .not.toContainEqual(expect.objectContaining({ kind: 'manual-adjudication' }))
    expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('full')
    expect(dnd5ePluginSpellActivity(
      dnd5eSrdAuditedSpellDefinitionV1('programmed-illusion'),
    )?.target).toMatchObject({ kind: 'area', shape: 'cube', placeRangeFeet: 120 })
    expect(activity.outcomes.flatMap((outcome) => outcome.operations)).toContainEqual(
      expect.objectContaining({
        kind: 'create-persistent-area', id: 'programmed-illusion-area',
        durationRounds: 5_256_000, permanent: true, concentration: false,
        visual: { preset: 'major-image', intensity: 'strong' },
      }),
    )
  })

  it('persists the selected illusion volume without asking form or trigger questions', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('programmed-illusion')!
    if (activity.target.kind !== 'area') throw new Error('expected area target')
    const selectedSizeActivity = {
      ...activity,
      target: { ...activity.target, lengthFeet: 20, widthFeet: 20 },
    }
    const current = map()
    const selection = resolveDnd5eActivityAreaMapSelectionV1({
      activity: selectedSizeActivity, map: current, actorToken: current.tokens[0]!,
      anchorCell: { col: 18, row: 10 },
    })!
    expect(selection.cells).toHaveLength(16)
    const resolved = resolveDnd5eActivity({
      activity, actor, targets: [], rolls: {}, castLevel: 6,
      areaPlacement: selection.areaPlacement,
      areaPlacementDistanceFeet: selection.areaPlacementDistanceFeet,
    })
    expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
    if (!resolved.ok) return
    const areaProposal = resolved.proposals.find((proposal): proposal is Extract<
      Dnd5eActivityCapabilityProposal, { kind: 'create-persistent-area' }
    > => proposal.kind === 'create-persistent-area')!
    expect(areaProposal).toMatchObject({
      permanent: true, concentration: false,
      programmedIllusion: undefined,
      areaInstance: { lengthFeet: 20, widthFeet: 20, heightFeet: 30 },
    })

    const committed = applyDnd5eActivityMapHandoffsV1({
      map: current, activity, packageId: 'srd-5.1', actionId: 'illusion-cast',
      actorId: 'wizard-token', sourceSaveDc: 19, castLevel: 6, round: 7,
      worldMinute: 600, areaSelection: selection, selection: {},
      handoffs: {
        persistentAreas: [areaProposal], summons: [], movements: [], invocations: [],
      },
    })
    expect(committed.ok, JSON.stringify(committed)).toBe(true)
    if (!committed.ok) return
    expect(committed.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'programmed-illusion', slotLevel: 6,
      permanent: true, concentrationId: undefined,
      programmedIllusion: undefined,
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 30 },
    })
    expect(committed.map.dnd5ePluginAreas?.[0]?.cells).toHaveLength(16)
  })
})
