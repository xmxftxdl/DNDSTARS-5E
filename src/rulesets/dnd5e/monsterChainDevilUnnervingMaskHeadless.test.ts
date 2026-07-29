import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eDirectedCombatantPairKey,
  dnd5eTurnStartGazeRequirements,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eTurnStartGazeResolution,
} from './headlessCombatEngine'

const COMBAT_ID = 'chain-devil-unnerving-mask'
const abilities = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

function combatant(
  id: string,
  controller: 'dm' | 'player',
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function chainDevil(patch: Partial<Dnd5eCombatant> = {}): Dnd5eCombatant {
  return combatant('chain-devil', 'dm', 10, {
    statBlockId: 'srd-5.1:chain-devil',
    creatureType: 'fiend',
    currentHp: 85,
    maxHp: 85,
    ...patch,
  })
}

function maskFixture(input: {
  distanceFeet?: number
  targetPatch?: Partial<Dnd5eCombatant>
} = {}) {
  const clock = combatant('clock', 'player', 30)
  const target = combatant('target', 'player', 20, input.targetPatch)
  const source = chainDevil()
  const state = startDnd5eHeadlessCombat(COMBAT_ID, [
    clock,
    target,
    source,
  ])
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey(source.id, target.id)]:
      input.distanceFeet ?? 30,
  }
  return { state, clock, target, source }
}

function useMask(
  sourceId: string,
  targetId: string,
  d20: number,
  d20Second?: number,
): Dnd5eTurnStartGazeResolution {
  return {
    sourceId,
    targetId,
    ruleId: 'unnerving-mask',
    sourceUsesGaze: true,
    choice: 'face-gaze',
    save: { d20, d20Second },
  }
}

function startTargetTurn(
  state: Dnd5eHeadlessCombatState,
  clockId: string,
  resolutions: readonly Dnd5eTurnStartGazeResolution[],
) {
  return resolveDnd5eHeadlessAction(state, {
    type: 'end-turn',
    actorId: clockId,
    turnStartGazeResolutions: resolutions,
  }, {
    transactionId: `${COMBAT_ID}:start-target`,
    now: 1,
  })
}

describe('Chain Devil Unnerving Mask Headless', () => {
  it.each([
    { distanceFeet: 30, expected: 1 },
    { distanceFeet: 31, expected: 0 },
  ])(
    'uses an inclusive 30-foot trigger boundary at $distanceFeet feet',
    ({ distanceFeet, expected }) => {
      const { state, target } = maskFixture({ distanceFeet })

      expect(dnd5eTurnStartGazeRequirements(state, target.id))
        .toHaveLength(expected)
    },
  )

  it.each([
    {
      label: 'neither direction is blocked',
      blocked: [] as readonly (readonly [string, string])[],
      expected: 1,
    },
    {
      label: 'the Chain Devil cannot see the target',
      blocked: [['chain-devil', 'target']] as const,
      expected: 0,
    },
    {
      label: 'the target cannot see the Chain Devil',
      blocked: [['target', 'chain-devil']] as const,
      expected: 0,
    },
    {
      label: 'both directions are blocked',
      blocked: [
        ['chain-devil', 'target'],
        ['target', 'chain-devil'],
      ] as const,
      expected: 0,
    },
  ])('requires mutual line of sight when $label', ({ blocked, expected }) => {
    const { state, target } = maskFixture()
    state.physicalLineOfSightBlockedByCombatantPair = Object.fromEntries(
      blocked.map(([viewerId, targetId]) => [
        dnd5eDirectedCombatantPairKey(viewerId, targetId),
        true as const,
      ]),
    )

    expect(dnd5eTurnStartGazeRequirements(state, target.id))
      .toHaveLength(expected)
  })

  it('spends the Chain Devil reaction even when the target saves', () => {
    const { state, clock, target, source } = maskFixture()
    const result = startTargetTurn(
      state,
      clock.id,
      [useMask(source.id, target.id, 14)],
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[source.id].turn.reactionAvailable)
      .toBe(false)
    expect(result.state.combatants[target.id].conditions)
      .not.toContain('frightened')
    expect(result.events).toContainEqual({
      type: 'turn-resource-spent',
      actorId: source.id,
      resource: 'reaction',
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-turn-start-gaze-save-resolved',
      sourceId: source.id,
      targetId: target.id,
      ruleId: 'unnerving-mask',
      ability: 'wis',
      dc: 14,
      total: 14,
      success: true,
    }))
  })

  it('frightens on a failed save only until the target turn ends', () => {
    const { state, clock, target, source } = maskFixture()
    const frightened = startTargetTurn(
      state,
      clock.id,
      [useMask(source.id, target.id, 13)],
    )

    expect(
      frightened.ok,
      frightened.ok ? undefined : frightened.reason,
    ).toBe(true)
    if (!frightened.ok) return
    expect(frightened.state.combatants[target.id].conditions)
      .toContain('frightened')
    expect(frightened.state.combatants[target.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        standardCondition: 'frightened',
        source: expect.objectContaining({
          kind: 'monster',
          actorId: source.id,
        }),
        duration: expect.objectContaining({
          type: 'until-turn-boundary',
          boundary: 'target-turn-end',
        }),
      }))

    const ended = resolveDnd5eHeadlessAction(frightened.state, {
      type: 'end-turn',
      actorId: target.id,
      turnStartGazeResolutions: [],
    }, {
      transactionId: `${COMBAT_ID}:end-target`,
      now: 2,
    })

    expect(ended.ok, ended.ok ? undefined : ended.reason).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants[target.id].conditions)
      .not.toContain('frightened')
  })

  it('does not offer the reaction against a frightened-immune target', () => {
    const { state, clock, target, source } = maskFixture({
      targetPatch: { conditionImmunities: ['frightened'] },
    })

    expect(dnd5eTurnStartGazeRequirements(state, target.id)).toEqual([])
    const result = startTargetTurn(state, clock.id, [])

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[source.id].turn.reactionAvailable)
      .toBe(true)
    expect(result.state.combatants[target.id].conditions)
      .not.toContain('frightened')
  })
})
