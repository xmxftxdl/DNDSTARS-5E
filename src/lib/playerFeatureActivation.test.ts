import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
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
