import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  buildFinaleDamageValues,
  buildIllusionDanceTargetPackets,
  illusionDanceTargetLimit,
  preparePlayerFeatureActivationAction,
  shouldSendPlayerReadyFeatureToDm,
} from './playerFeatureActivation'

function makeCharacter(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    currentAP: 2,
    currentHp: 10,
    traits: [],
    combatBuffs: {},
    ...patch,
  } as Character
}

function makeMap(patch: Partial<BattleMap> = {}): BattleMap {
  return {
    id: 'map-1',
    name: 'Map',
    width: 1000,
    height: 1000,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [
      {
        id: 'target-1',
        label: 'Target 1',
        x: 100,
        y: 100,
        color: '#ef4444',
        emoji: '',
        type: 'enemy',
        size: 1,
        hp: 10,
        maxHp: 10,
      },
    ],
    ...patch,
  }
}

function makeAction(patch: Partial<SharedPlayerActionState> = {}): SharedPlayerActionState {
  return {
    id: 'action-1',
    mapId: 'map-1',
    combatId: 'combat-1',
    sourceMode: 'player',
    status: 'pending',
    type: 'activate-feature',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    featureKey: 'doubleArrow',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: 1000,
    ...patch,
  }
}

describe('player feature activation routing', () => {
  it('routes player-triggered active features through the DM authority path', () => {
    expect(shouldSendPlayerReadyFeatureToDm('doubleArrow')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('preciseStrike')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('eagleEye')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('stillWater')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('finale')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('flexibleBody')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('showtime')).toBe(true)
    expect(shouldSendPlayerReadyFeatureToDm('windBlade')).toBe(true)
  })

  it('does not route passive features as player action requests', () => {
    expect(shouldSendPlayerReadyFeatureToDm('calmMind')).toBe(false)
    expect(shouldSendPlayerReadyFeatureToDm('huntingMark')).toBe(false)
  })

  it('prepares illusion dance targets with de-dupe and feature rank limit', () => {
    const actor = makeCharacter({
      traits: [{ id: 'illusionDance', name: '迷幻舞步', featureKey: 'illusionDance', level: 2, uses: 1, maxUses: 1, description: '' }],
    })
    const result = preparePlayerFeatureActivationAction({
      action: makeAction({
        featureKey: 'illusionDance',
        targetTokenIds: ['target-1', 'target-1', 'target-2'],
        targetTokenId: 'target-3',
      }),
      map: makeMap(),
      characters: [actor],
    })

    expect(illusionDanceTargetLimit(actor)).toBe(2)
    expect(result).toMatchObject({
      ok: true,
      kind: 'illusionDance',
      targetIds: ['target-1', 'target-2', 'target-3'],
      rollTargetIds: ['target-1', 'target-2'],
    })
    expect(result.ok && result.kind === 'illusionDance' && result.buildHeadlessAction([{ targetTokenId: 'target-1', saveD20: 12 }])).toMatchObject({
      featureKey: 'illusionDance',
      targetTokenIds: ['target-1', 'target-2', 'target-3'],
      targetPackets: [{ targetTokenId: 'target-1', saveD20: 12 }],
    })
  })

  it('builds illusion dance save packets by rolling once per limited target', async () => {
    const result = preparePlayerFeatureActivationAction({
      action: makeAction({
        featureKey: 'illusionDance',
        targetTokenIds: ['target-1', 'target-2'],
      }),
      map: makeMap({
        tokens: [
          makeMap().tokens[0],
          { ...makeMap().tokens[0], id: 'target-2', label: 'Target 2' },
        ],
      }),
      characters: [
        makeCharacter({
          traits: [{ id: 'illusionDance', name: 'Illusion Dance', featureKey: 'illusionDance', level: 2, uses: 1, maxUses: 1, description: '' }],
        }),
      ],
    })
    expect(result.ok && result.kind === 'illusionDance').toBe(true)
    if (!result.ok || result.kind !== 'illusionDance') return

    const calls: Array<{ count: number; sides: number; targetName: string }> = []
    const values = [13, 7]
    const packets = await buildIllusionDanceTargetPackets({
      prepared: result,
      rollValues: async (count, sides, _label, targetName) => {
        calls.push({ count, sides, targetName })
        return [values.shift() ?? 1]
      },
    })

    expect(calls).toEqual([
      { count: 1, sides: 20, targetName: 'Target 1' },
      { count: 1, sides: 20, targetName: 'Target 2' },
    ])
    expect(packets).toEqual([
      { targetTokenId: 'target-1', saveD20: 13 },
      { targetTokenId: 'target-2', saveD20: 7 },
    ])
  })

  it('prepares standard feature activation and tracks finale pre-roll needs for tracking arrow', () => {
    const result = preparePlayerFeatureActivationAction({
      action: makeAction({ featureKey: 'trackingArrow', targetTokenId: 'target-1' }),
      map: makeMap({ tokens: [{ ...makeMap().tokens[0], huntingMarkStacks: 3 }] }),
      characters: [
        makeCharacter({
          combatBuffs: { finaleReady: true },
          traits: [{ id: 'finale', name: '曲终', featureKey: 'finale', level: 3, uses: 1, maxUses: 1, description: '' }],
        }),
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      kind: 'standard',
      featureKey: 'trackingArrow',
      finaleWillTrigger: true,
      finaleExtraD8Count: 2,
    })
    expect(result.ok && result.kind === 'standard' && result.buildHeadlessAction([10, 10, 10, 10, 10, 10, 8, 7])).toMatchObject({
      featureKey: 'trackingArrow',
      targetTokenId: 'target-1',
      finaleDamageValues: [10, 10, 10, 10, 10, 10, 8, 7],
    })
  })

  it('builds finale damage values only when tracking arrow will trigger finale', async () => {
    const prepared = preparePlayerFeatureActivationAction({
      action: makeAction({ featureKey: 'trackingArrow', targetTokenId: 'target-1' }),
      map: makeMap({ tokens: [{ ...makeMap().tokens[0], huntingMarkStacks: 3 }] }),
      characters: [
        makeCharacter({
          combatBuffs: { finaleReady: true },
          traits: [{ id: 'finale', name: 'Finale', featureKey: 'finale', level: 3, uses: 1, maxUses: 1, description: '' }],
        }),
      ],
    })
    expect(prepared.ok && prepared.kind === 'standard').toBe(true)
    if (!prepared.ok || prepared.kind !== 'standard') return

    const calls: Array<{ count: number; sides: number; targetName: string }> = []
    const rolls = [[10, 9, 8, 7, 6, 5], [4, 3]]
    const values = await buildFinaleDamageValues({
      prepared,
      rollValues: async (count, sides, _label, targetName) => {
        calls.push({ count, sides, targetName })
        return rolls.shift() ?? []
      },
    })

    expect(calls).toEqual([
      { count: 6, sides: 10, targetName: 'Target 1' },
      { count: 2, sides: 8, targetName: 'Target 1' },
    ])
    expect(values).toEqual([10, 9, 8, 7, 6, 5, 4, 3])
  })

  it('rejects unsupported or malformed feature activation requests', () => {
    expect(
      preparePlayerFeatureActivationAction({
        action: makeAction({ type: 'attack-token', featureKey: undefined }),
        map: makeMap(),
        characters: [makeCharacter()],
      }),
    ).toEqual({ ok: false, reason: 'unsupported-feature' })
  })
})
