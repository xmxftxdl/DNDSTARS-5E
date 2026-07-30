import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eSourceLinkedRelations,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import { validateDnd5eMonsterSchema } from './monsterSchema'
import { createDnd5eConditionEffect } from './activeEffects'
import type { Dnd5eStandardConditionId } from './conditions'

type VampireSlug = 'vampire-spawn' | 'vampire-vampire'

const ABILITIES = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

const VAMPIRE_CASES = [
  {
    slug: 'vampire-spawn',
    grappleActionId: 'claws-grapple',
    grappleEffectId: 'claws-grapple',
    grappleAndBiteId: 'multiattack-grapple-and-bite',
    ordinaryBiteSiblingId: 'multiattack-claws-and-bite',
  },
  {
    slug: 'vampire-vampire',
    grappleActionId: 'unarmed-strike-grapple',
    grappleEffectId: 'unarmed-strike-grapple',
    grappleAndBiteId: 'multiattack-unarmed-grapple-and-bite',
    ordinaryBiteSiblingId: 'multiattack-unarmed-strike-and-bite',
  },
] as const

function vampire(slug: VampireSlug): Dnd5eMonsterStatBlock {
  const monster = getDnd5eSrdMonsterBySlug(slug)
  expect(monster, slug).toBeDefined()
  return monster!
}

function combatant(input: {
  id: string
  controller: 'dm' | 'player'
  initiative: number
  statBlock?: Dnd5eMonsterStatBlock
  conditions?: readonly Dnd5eStandardConditionId[]
}): Dnd5eCombatant {
  const result = createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    statBlockId: input.statBlock?.id,
    abilities: input.statBlock?.abilities ?? ABILITIES,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 200,
    maxHp: 200,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.controller === 'dm' ? 0 : 5, y: 0 },
    concentrating: false,
    classState: input.conditions?.length
      ? {
          activeEffects: input.conditions.map((condition) =>
            createDnd5eConditionEffect({
              condition,
              targetId: input.id,
              source: { kind: 'feature', rulesId: `test:${condition}` },
            })),
        }
      : undefined,
  })
  return result
}

function encounter(
  slug: VampireSlug,
  conditions: readonly Dnd5eStandardConditionId[] = [],
): Dnd5eHeadlessCombatState {
  const state = startDnd5eHeadlessCombat(`vampire-bite:${slug}`, [
    combatant({
      id: 'vampire',
      controller: 'dm',
      initiative: 20,
      statBlock: vampire(slug),
    }),
    combatant({
      id: 'hero',
      controller: 'player',
      initiative: 10,
      conditions,
    }),
  ])
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey('vampire', 'hero')]: 5,
  }
  return state
}

function miss(targetId = 'hero') {
  return {
    targetId,
    d20: 1,
    damageRolls: [],
  } as const
}

describe('Vampire Bite target eligibility', () => {
  it.each(VAMPIRE_CASES)(
    'publishes $slug Bite eligibility and keeps willing targets under DM adjudication',
    ({ slug }) => {
      const monster = vampire(slug)
      const bite = monster.actions.find((action) => action.id === 'bite')
      expect(bite).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        targetEligibility: {
          kind: 'any-of',
          predicates: [
            {
              kind: 'source-linked-relation',
              relationKind: 'grapple',
            },
            { kind: 'incapacitated' },
            {
              kind: 'standard-condition',
              condition: 'restrained',
            },
          ],
          dmAdjudicationAlternatives: [{ kind: 'willing-target' }],
        },
      })
      expect(validateDnd5eMonsterSchema(monster)).toEqual([])
    },
  )

  it('rejects willing-target as an automatic eligibility predicate in schema data', () => {
    const malformed = structuredClone(vampire('vampire-spawn')) as
      Dnd5eMonsterStatBlock
    const bite = malformed.actions.find((action) => action.id === 'bite')!
    const mutableEligibility = bite.targetEligibility as unknown as {
      predicates: unknown[]
    }
    mutableEligibility.predicates = [
      ...bite.targetEligibility!.predicates,
      { kind: 'willing-target' },
    ]
    expect(validateDnd5eMonsterSchema(malformed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'bite',
          code: 'invalid-stat-block',
        }),
      ]),
    )
  })

  it.each(VAMPIRE_CASES)(
    'atomically rejects an ordinary target for direct $slug Bite',
    ({ slug }) => {
      const state = encounter(slug)
      const before = structuredClone(state)
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'vampire',
        actionId: 'bite',
        rolls: [miss()],
      })
      expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(result.state).toEqual(before)
      expect(result.events).toEqual([])
    },
  )

  it.each([
    ...VAMPIRE_CASES.map((entry) => ({
      ...entry,
      condition: 'incapacitated' as const,
    })),
    ...VAMPIRE_CASES.map((entry) => ({
      ...entry,
      condition: 'restrained' as const,
    })),
    ...VAMPIRE_CASES.map((entry) => ({
      ...entry,
      // Stunned proves semantic incapacitation rather than a literal string
      // check for only the `incapacitated` condition.
      condition: 'stunned' as const,
    })),
  ])(
    'allows $slug Bite against a $condition target',
    ({ slug, condition }) => {
      const result = resolveDnd5eHeadlessAction(encounter(slug, [condition]), {
        type: 'monster-action',
        actorId: 'vampire',
        actionId: 'bite',
        rolls: [miss()],
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.events.filter((event) =>
        event.type === 'attack-resolved')).toHaveLength(1)
    },
  )

  it.each(VAMPIRE_CASES)(
    'allows direct $slug Bite only after this source creates the grapple',
    ({ slug, grappleActionId, grappleEffectId }) => {
      // A bare condition does not prove who owns the grapple.
      expect(resolveDnd5eHeadlessAction(encounter(slug, ['grappled']), {
        type: 'monster-action',
        actorId: 'vampire',
        actionId: 'bite',
        rolls: [miss()],
      })).toMatchObject({ ok: false, reason: 'invalid-target' })

      const grappled = resolveDnd5eHeadlessAction(encounter(slug), {
        type: 'monster-action',
        actorId: 'vampire',
        actionId: grappleActionId,
        rolls: [{
          targetId: 'hero',
          d20: 10,
          damageRolls: [],
          onHitEffectRolls: [{ effectId: grappleEffectId }],
        }],
      })
      expect(grappled.ok, grappled.ok ? undefined : grappled.reason).toBe(true)
      if (!grappled.ok) return
      expect(dnd5eSourceLinkedRelations(
        grappled.state,
        'vampire',
      ).map((link) => link.target.id)).toContain('hero')
      grappled.state.combatants.vampire.turn.actionAvailable = true

      const bite = resolveDnd5eHeadlessAction(grappled.state, {
        type: 'monster-action',
        actorId: 'vampire',
        actionId: 'bite',
        rolls: [miss()],
      })
      expect(bite.ok, bite.ok ? undefined : bite.reason).toBe(true)
    },
  )

  it.each(VAMPIRE_CASES)(
    'marks $slug Bite unused when its preceding grapple misses',
    ({ slug, grappleAndBiteId }) => {
      const result = resolveDnd5eHeadlessAction(encounter(slug), {
        type: 'monster-action',
        actorId: 'vampire',
        actionId: grappleAndBiteId,
        rolls: [miss(), miss()],
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.events.filter((event) =>
        event.type === 'attack-resolved')).toHaveLength(1)
      expect(result.events).toContainEqual({
        type: 'monster-multiattack-occurrence-skipped',
        actorId: 'vampire',
        actionId: grappleAndBiteId,
        childActionId: 'bite',
        occurrenceIndex: 1,
        reason: 'target-ineligible',
      })
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        actorId: 'vampire',
        targetId: 'hero',
        hit: false,
      }))
    },
  )

  it.each(VAMPIRE_CASES)(
    'still executes $slug Bite after a missed grapple when the target was already restrained',
    ({ slug, grappleAndBiteId }) => {
      const result = resolveDnd5eHeadlessAction(
        encounter(slug, ['restrained']),
        {
          type: 'monster-action',
          actorId: 'vampire',
          actionId: grappleAndBiteId,
          rolls: [miss(), miss()],
        },
      )
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.events.filter((event) =>
        event.type === 'attack-resolved')).toHaveLength(2)
      expect(result.events.some((event) =>
        event.type === 'monster-multiattack-occurrence-skipped')).toBe(false)
    },
  )

  it.each(VAMPIRE_CASES)(
    'still executes $slug Bite after a missed grapple when this vampire already holds the target',
    ({
      slug,
      grappleActionId,
      grappleEffectId,
      grappleAndBiteId,
    }) => {
      const linked = resolveDnd5eHeadlessAction(encounter(slug), {
        type: 'monster-action',
        actorId: 'vampire',
        actionId: grappleActionId,
        rolls: [{
          targetId: 'hero',
          d20: 10,
          damageRolls: [],
          onHitEffectRolls: [{ effectId: grappleEffectId }],
        }],
      })
      expect(linked.ok, linked.ok ? undefined : linked.reason).toBe(true)
      if (!linked.ok) return
      linked.state.combatants.vampire.turn.actionAvailable = true

      const result = resolveDnd5eHeadlessAction(linked.state, {
        type: 'monster-action',
        actorId: 'vampire',
        actionId: grappleAndBiteId,
        rolls: [miss(), miss()],
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.events.filter((event) =>
        event.type === 'attack-resolved')).toHaveLength(2)
      expect(result.events.some((event) =>
        event.type === 'monster-multiattack-occurrence-skipped')).toBe(false)
    },
  )

  it.each(VAMPIRE_CASES)(
    'rejects $slug ordinary Bite sibling at the transaction boundary',
    ({ slug, ordinaryBiteSiblingId }) => {
      const state = encounter(slug)
      const before = structuredClone(state)
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'vampire',
        actionId: ordinaryBiteSiblingId,
        rolls: [miss(), miss()],
      })
      expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(result.state).toEqual(before)
      expect(result.events).toEqual([])
    },
  )
})
