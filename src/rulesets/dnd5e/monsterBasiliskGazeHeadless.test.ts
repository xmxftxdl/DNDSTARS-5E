import { describe, expect, it } from 'vitest'
import {
  DND5E_AVERTED_GAZE_DEFINITION_ID,
  createDnd5eCombatant,
  dnd5eCombatantCanSee,
  dnd5eCombatantPairKey,
  dnd5eDirectedCombatantPairKey,
  dnd5eTurnStartGazeRequirements,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eTurnStartGazeResolution,
} from './headlessCombatEngine'
import { getDnd5eSrdMonster } from './monsters'

const COMBAT_ID = 'basilisk-gaze'
const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

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

function basilisk(id: string, initiative: number, patch: Partial<Dnd5eCombatant> = {}) {
  return combatant(id, 'dm', initiative, {
    statBlockId: 'srd-5.1:basilisk',
    creatureType: 'monstrosity',
    currentHp: 52,
    maxHp: 52,
    ...patch,
  })
}

function gazeFixture(input: {
  distanceFeet?: number
  sourceIds?: readonly string[]
  targetPatch?: Partial<Dnd5eCombatant>
} = {}) {
  const clock = combatant('clock', 'player', 30)
  const target = combatant('target', 'player', 20, input.targetPatch)
  const sources = (input.sourceIds ?? ['basilisk']).map((id, index) =>
    basilisk(id, 10 - index))
  const state = startDnd5eHeadlessCombat(COMBAT_ID, [clock, target, ...sources])
  state.distanceFeetByCombatantPair = Object.fromEntries(
    sources.map((source) => [
      dnd5eCombatantPairKey(source.id, target.id),
      input.distanceFeet ?? 30,
    ]),
  )
  return { state, clock, target, sources }
}

function faceGaze(
  sourceId: string,
  targetId: string,
  d20: number,
  d20Second?: number,
): Dnd5eTurnStartGazeResolution {
  return {
    sourceId,
    targetId,
    ruleId: 'petrifying-gaze',
    sourceUsesGaze: true,
    choice: 'face-gaze',
    save: { d20, d20Second },
  }
}

function avertGaze(sourceId: string, targetId: string): Dnd5eTurnStartGazeResolution {
  return {
    sourceId,
    targetId,
    ruleId: 'petrifying-gaze',
    sourceUsesGaze: true,
    choice: 'avert-eyes',
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

function failedInitialGaze() {
  const fixture = gazeFixture()
  const source = fixture.sources[0]
  const result = startTargetTurn(
    fixture.state,
    fixture.clock.id,
    [faceGaze(source.id, fixture.target.id, 11)],
  )
  if (!result.ok) throw new Error(`failed to create turning-to-stone fixture: ${result.reason}`)
  const turningEffect = result.state.combatants[fixture.target.id].classState.activeEffects
    ?.find((effect) => effect.definitionId.endsWith(':turning-to-stone'))
  if (!turningEffect) throw new Error('turning-to-stone effect was not created')
  return { ...fixture, result, turningEffect }
}

describe('Basilisk Petrifying Gaze Headless', () => {
  it('exposes the canonical staged gaze as a structured Headless trait', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:basilisk')
    const trait = monster?.traits.find((candidate) =>
      candidate.rule?.kind === 'turn-start-gaze' &&
      candidate.rule.ruleId === 'petrifying-gaze')

    expect(trait).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'turn-start-gaze',
        ruleId: 'petrifying-gaze',
        rangeFeet: 30,
        ability: 'con',
        dc: 12,
        magical: true,
        allowAvertEyes: true,
        requiresMutualVisualSight: true,
        initialCondition: 'restrained',
        failureCondition: 'petrified',
      },
    })
  })

  it.each([
    { distanceFeet: 30, expected: 1 },
    { distanceFeet: 31, expected: 0 },
  ])(
    'uses an inclusive 30-foot range boundary at $distanceFeet feet',
    ({ distanceFeet, expected }) => {
      const { state, target } = gazeFixture({ distanceFeet })
      expect(dnd5eTurnStartGazeRequirements(state, target.id)).toHaveLength(expected)
    },
  )

  it('allows an empty authoritative turn-start payload when the source is 31 feet away', () => {
    const { state, clock } = gazeFixture({ distanceFeet: 31 })
    const result = startTargetTurn(state, clock.id, [])

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.transaction).toMatchObject({ status: 'committed' })
  })

  it.each([
    {
      label: 'neither direction is blocked',
      blocked: [] as readonly (readonly [string, string])[],
      expected: 1,
    },
    {
      label: 'the basilisk cannot see the target',
      blocked: [['basilisk', 'target']] as const,
      expected: 0,
    },
    {
      label: 'the target cannot see the basilisk',
      blocked: [['target', 'basilisk']] as const,
      expected: 0,
    },
    {
      label: 'both directions are blocked',
      blocked: [['basilisk', 'target'], ['target', 'basilisk']] as const,
      expected: 0,
    },
  ])('requires mutual physical line of sight when $label', ({ blocked, expected }) => {
    const { state, target } = gazeFixture()
    state.physicalLineOfSightBlockedByCombatantPair = Object.fromEntries(
      blocked.map(([viewerId, targetId]) => [
        dnd5eDirectedCombatantPairKey(viewerId, targetId),
        true as const,
      ]),
    )

    expect(dnd5eTurnStartGazeRequirements(state, target.id)).toHaveLength(expected)
  })

  it('resolves a successful face-gaze save without applying a condition', () => {
    const { state, clock, target, sources } = gazeFixture()
    const result = startTargetTurn(
      state,
      clock.id,
      [faceGaze(sources[0].id, target.id, 12)],
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].conditions).toEqual([])
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-turn-start-gaze-save-resolved',
      sourceId: sources[0].id,
      targetId: target.id,
      ruleId: 'petrifying-gaze',
      total: 12,
      success: true,
      immediatelyPetrified: false,
    }))
  })

  it('applies source-linked restrained and turning-to-stone effects after the first failed save', () => {
    const { target, sources, result, turningEffect } = failedInitialGaze()
    const resolvedTarget = result.state.combatants[target.id]

    expect(resolvedTarget.conditions).toContain('restrained')
    expect(turningEffect).toMatchObject({
      source: {
        kind: 'monster',
        actorId: sources[0].id,
        magical: true,
      },
      duration: { type: 'permanent' },
      repeatSave: {
        ability: 'con',
        dc: 12,
        timing: 'target-turn-end',
        onFailureTransition: {
          replaceWithCondition: 'petrified',
          duration: 'permanent',
        },
        onSuccess: 'remove',
      },
    })
    expect(resolvedTarget.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'restrained',
      dependsOnEffectId: turningEffect.id,
      source: expect.objectContaining({ actorId: sources[0].id }),
    }))
  })

  it('ends the staged restraint after a successful end-of-turn save', () => {
    const { target, result, turningEffect } = failedInitialGaze()
    const saved = resolveDnd5eHeadlessAction(result.state, {
      type: 'end-turn',
      actorId: target.id,
      activeEffectSavingThrows: [{ effectId: turningEffect.id, d20: 12 }],
      turnStartGazeResolutions: [],
    }, {
      transactionId: `${COMBAT_ID}:repeat-save-success`,
      now: 2,
    })

    expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
    if (!saved.ok) return
    expect(saved.state.combatants[target.id].conditions).not.toContain('restrained')
    expect(saved.state.combatants[target.id].conditions).not.toContain('petrified')
    expect(saved.state.combatants[target.id].classState.activeEffects
      ?.some((effect) => effect.id === turningEffect.id)).not.toBe(true)
  })

  it('replaces the staged restraint with permanent petrification after a failed end-of-turn save', () => {
    const { target, sources, result, turningEffect } = failedInitialGaze()
    const petrified = resolveDnd5eHeadlessAction(result.state, {
      type: 'end-turn',
      actorId: target.id,
      activeEffectSavingThrows: [{ effectId: turningEffect.id, d20: 11 }],
      turnStartGazeResolutions: [],
    }, {
      transactionId: `${COMBAT_ID}:repeat-save-failure`,
      now: 2,
    })

    expect(petrified.ok, petrified.ok ? undefined : petrified.reason).toBe(true)
    if (!petrified.ok) return
    const resolvedTarget = petrified.state.combatants[target.id]
    expect(resolvedTarget.conditions).toContain('petrified')
    expect(resolvedTarget.conditions).not.toContain('restrained')
    expect(resolvedTarget.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'petrified',
      duration: { type: 'permanent' },
      source: expect.objectContaining({
        kind: 'monster',
        actorId: sources[0].id,
      }),
    }))
  })

  it('records source-specific averted eyes and blocks only the target-to-source view', () => {
    const { state, clock, target, sources } = gazeFixture()
    const source = sources[0]
    const result = startTargetTurn(
      state,
      clock.id,
      [avertGaze(source.id, target.id)],
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].conditions).not.toContain('restrained')
    expect(result.state.combatants[target.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        definitionId: DND5E_AVERTED_GAZE_DEFINITION_ID,
        source: expect.objectContaining({ actorId: source.id }),
        duration: expect.objectContaining({
          type: 'until-turn-boundary',
          boundary: 'target-turn-start',
        }),
      }))
    expect(dnd5eCombatantCanSee(result.state, target.id, source.id)).toBe(false)
    expect(dnd5eCombatantCanSee(result.state, source.id, target.id)).toBe(true)
    expect(result.events).toContainEqual({
      type: 'monster-turn-start-gaze-averted',
      sourceId: source.id,
      targetId: target.id,
      ruleId: 'petrifying-gaze',
    })
  })

  it('does not allow a surprised target to avert its eyes', () => {
    const { state, clock, target, sources } = gazeFixture({
      targetPatch: {
        classState: { surprisedCombatId: COMBAT_ID },
      },
    })
    expect(dnd5eTurnStartGazeRequirements(state, target.id)).toEqual([
      expect.objectContaining({
        sourceId: sources[0].id,
        targetId: target.id,
        canAvertEyes: false,
      }),
    ])

    const result = startTargetTurn(
      state,
      clock.id,
      [avertGaze(sources[0].id, target.id)],
    )
    expect(result).toMatchObject({
      ok: false,
      reason: 'invalid-dice',
      transaction: {
        status: 'rolled-back',
        rollbackReason: 'invalid-dice',
      },
    })
    expect(state.initiativeIndex).toBe(0)
    expect(state.combatants[target.id].classState.activeEffects).toBeUndefined()
  })

  it('sorts multiple gaze sources and rolls back every staged result when a later payload is forged', () => {
    const { state, clock, target } = gazeFixture({
      sourceIds: ['basilisk-b', 'basilisk-a'],
    })
    expect(dnd5eTurnStartGazeRequirements(state, target.id)
      .map((requirement) => requirement.sourceId)).toEqual([
      'basilisk-a',
      'basilisk-b',
    ])

    const result = startTargetTurn(state, clock.id, [
      faceGaze('basilisk-a', target.id, 11),
      faceGaze('basilisk-b', target.id, 21),
    ])

    expect(result).toMatchObject({
      ok: false,
      reason: 'invalid-dice',
      transaction: {
        status: 'rolled-back',
        rollbackReason: 'invalid-dice',
      },
    })
    expect(state.initiativeIndex).toBe(0)
    expect(state.combatants[target.id].conditions).toEqual([])
    expect(state.combatants[target.id].classState.activeEffects).toBeUndefined()
  })

  it('uses both d20s for magical resistance and keeps the higher face-gaze result', () => {
    const { state, clock, target, sources } = gazeFixture({
      targetPatch: { magicResistance: true },
    })
    expect(dnd5eTurnStartGazeRequirements(state, target.id)).toEqual([
      expect.objectContaining({
        sourceId: sources[0].id,
        mode: 'advantage',
      }),
    ])

    const result = startTargetTurn(
      state,
      clock.id,
      [faceGaze(sources[0].id, target.id, 1, 20)],
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].conditions).toEqual([])
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-turn-start-gaze-save-resolved',
      targetId: target.id,
      total: 20,
      success: true,
    }))
    expect(result.transaction?.rollLedger.entries).toContainEqual(expect.objectContaining({
      kind: 'saving-throw',
      dice: { sides: 20, values: [1, 20] },
    }))
  })
})
