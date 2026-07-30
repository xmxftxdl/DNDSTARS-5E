import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterActionRoll,
} from './headlessCombatEngine'
import { dnd5eMonsterMultiattackConstraint } from './monsterMultiattackConstraints'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterOnHitEffect,
} from './monsters'

const TARGET_ABILITIES = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

function combatant(input: {
  id: string
  initiative: number
  controller: 'dm' | 'player'
  statBlockId?: string
  x?: number
  sizeRank?: number
  abilities?: Dnd5eCombatant['abilities']
  armorClass?: number
  currentHp?: number
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    statBlockId: input.statBlockId,
    abilities: input.abilities ?? TARGET_ABILITIES,
    proficiencyBonus: 2,
    armorClass: input.armorClass ?? 10,
    currentHp: input.currentHp ?? 500,
    maxHp: input.currentHp ?? 500,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x ?? 0, y: 0 },
    sizeRank: input.sizeRank ?? 2,
    concentrating: false,
  })
}

function encounter(
  slug: string,
  options: {
    sourceId?: string
    targetId?: string
    targetSizeRank?: number
    targetArmorClass?: number
  } = {},
): Dnd5eHeadlessCombatState {
  const monster = getDnd5eSrdMonsterBySlug(slug)
  expect(monster, slug).toBeDefined()
  const sourceId = options.sourceId ?? 'monster'
  const targetId = options.targetId ?? 'hero'
  const source = combatant({
    id: sourceId,
    initiative: 20,
    controller: 'dm',
    statBlockId: monster!.id,
    abilities: monster!.abilities,
    armorClass: monster!.armorClass.value,
    currentHp: Math.max(500, monster!.hitPoints.average),
    sizeRank: 5,
  })
  const target = combatant({
    id: targetId,
    initiative: 10,
    controller: 'player',
    x: 5,
    sizeRank: options.targetSizeRank ?? 2,
    armorClass: options.targetArmorClass ?? 10,
  })
  const state = startDnd5eHeadlessCombat(
    `complex-relation:${slug}`,
    [source, target],
  )
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey(sourceId, targetId)]: 5,
  }
  return state
}

function catalogAction(slug: string, actionId: string): Dnd5eMonsterAction {
  const action = getDnd5eSrdMonsterBySlug(slug)?.actions.find(
    (candidate) => candidate.id === actionId,
  )
  expect(action, `${slug}/${actionId}`).toBeDefined()
  return action!
}

function catalogOnHitEffect(
  slug: string,
  actionId: string,
  effectId: string,
): Dnd5eMonsterOnHitEffect | undefined {
  return catalogAction(slug, actionId).attack?.onHitEffects?.find(
    (effect) => effect.id === effectId,
  )
}

function minimumDamageRolls(
  slug: string,
  actionId: string,
): readonly (readonly number[])[] {
  const attack = catalogAction(slug, actionId).attack
  expect(attack, `${slug}/${actionId} attack`).toBeDefined()
  return attack!.damage.map((component) =>
    Array.from({ length: component.count }, () => 1))
}

function sourceRelationEntries(
  state: Dnd5eHeadlessCombatState,
  sourceId: string,
  targetId: string,
) {
  return Object.values(state.combatants).flatMap((owner) =>
    (owner.classState.activeEffects ?? []).flatMap((effect) => {
      const relation = effect.relation
      if (!relation) return []
      const extendedRelation = relation as typeof relation & {
        targetActorId?: string
      }
      const connectsPair =
        (
          relation.sourceActorId === sourceId &&
          (owner.id === targetId || extendedRelation.targetActorId === targetId)
        ) ||
        (
          relation.sourceActorId === targetId &&
          (owner.id === sourceId || extendedRelation.targetActorId === sourceId)
        )
      return connectsPair ? [{ ownerId: owner.id, effect }] : []
    }),
  )
}

function monsterAttackRoll(input: {
  slug: string
  actionId: string
  targetId?: string
  effectId: string
  effectD20?: number
}): Dnd5eMonsterActionRoll {
  return {
    targetId: input.targetId ?? 'hero',
    d20: 10,
    damageRolls: minimumDamageRolls(input.slug, input.actionId),
    onHitEffectRolls: [{
      effectId: input.effectId,
      d20: input.effectD20,
    }],
  }
}

describe('complex relation Multiattacks', () => {
  it('publishes every reviewed parent and child action as a Headless rule', () => {
    const expected = [
      ['cloaker', 'multiattack'],
      ['cloaker', 'bite'],
      ['purple-worm', 'multiattack'],
      ['purple-worm', 'bite'],
      ['shambling-mound', 'multiattack'],
      ['shambling-mound', 'engulf'],
      ['tarrasque', 'multiattack'],
      ['tarrasque', 'multiattack-swallow'],
      ['tarrasque', 'swallow'],
      ['roper', 'multiattack'],
      ['roper', 'tendril'],
      ['roper', 'reel'],
      ['kraken', 'multiattack'],
      ['kraken', 'multiattack-two-tentacles-and-fling'],
      ['kraken', 'multiattack-tentacle-and-two-flings'],
      ['kraken', 'multiattack-flings'],
      ['kraken', 'fling'],
    ] as const

    for (const [slug, actionId] of expected) {
      expect(catalogAction(slug, actionId).automation, `${slug}/${actionId}`)
        .toBe('headless')
    }
  })

  it('declares stable relation prerequisites without depending on a special-action payload shape', () => {
    expect(catalogOnHitEffect('cloaker', 'bite', 'bite-attachment'))
      .toBeDefined()
    expect(catalogOnHitEffect('purple-worm', 'bite', 'bite-swallow'))
      .toBeDefined()
    expect(catalogOnHitEffect('roper', 'tendril', 'tendril-grapple'))
      .toMatchObject({
        relation: {
          slotGroup: 'tendril',
          capacity: 6,
        },
      })
    expect(catalogOnHitEffect('kraken', 'tentacle', 'tentacle-grapple'))
      .toMatchObject({
        relation: {
          slotGroup: 'tentacle',
          capacity: 10,
        },
      })
    expect(catalogOnHitEffect('tarrasque', 'bite', 'bite-grapple'))
      .toMatchObject({
        relation: {
          slotGroup: 'bite',
          capacity: 1,
        },
      })

    expect(catalogAction('tarrasque', 'swallow')).toMatchObject({
      referencedActionId: 'bite',
      relationRequirement: {
        kind: 'target-linked-to-source',
        slotGroup: 'bite',
      },
    })
    expect(catalogAction('kraken', 'fling')).toMatchObject({
      relationRequirement: {
        kind: 'target-linked-to-source',
        slotGroup: 'tentacle',
      },
    })
    expect(catalogAction('roper', 'reel').rule).toBeDefined()
    expect(catalogAction('shambling-mound', 'engulf').rule).toBeDefined()
  })

  it('keeps a stable Cloaker Bite attachment while the attached target moves', () => {
    const state = encounter('cloaker', { sourceId: 'cloaker' })
    const attached = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'cloaker',
      actionId: 'bite',
      rolls: [monsterAttackRoll({
        slug: 'cloaker',
        actionId: 'bite',
        effectId: 'bite-attachment',
      })],
    })
    expect(attached.ok, attached.ok ? undefined : attached.reason).toBe(true)
    if (!attached.ok) return

    const beforeRelations = sourceRelationEntries(
      attached.state,
      'cloaker',
      'hero',
    )
    expect(beforeRelations).toHaveLength(1)
    expect(beforeRelations[0].effect.relation).toMatchObject({
      slotGroup: 'bite',
    })
    const stableRelationId = beforeRelations[0].effect.id
    const sourceBeforeMove = { ...attached.state.combatants.cloaker.position }

    const ended = resolveDnd5eHeadlessAction(attached.state, {
      type: 'end-turn',
      actorId: 'cloaker',
    })
    expect(ended.ok, ended.ok ? undefined : ended.reason).toBe(true)
    if (!ended.ok) return
    const moved = resolveDnd5eHeadlessAction(ended.state, {
      type: 'move',
      actorId: 'hero',
      to: { x: 10, y: 0 },
      distance: 5,
    })
    expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
    if (!moved.ok) return

    expect(moved.state.combatants.cloaker.position).toEqual({
      x: sourceBeforeMove.x + 5,
      y: sourceBeforeMove.y,
    })
    expect(sourceRelationEntries(moved.state, 'cloaker', 'hero')
      .map((entry) => entry.effect.id)).toEqual([stableRelationId])
  })

  it('swallows a Large-or-smaller target on a failed Purple Worm Bite save', () => {
    const state = encounter('purple-worm', {
      sourceId: 'worm',
      targetSizeRank: 3,
    })
    const swallowed = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'worm',
      actionId: 'bite',
      rolls: [monsterAttackRoll({
        slug: 'purple-worm',
        actionId: 'bite',
        effectId: 'bite-swallow',
        effectD20: 1,
      })],
    })
    expect(swallowed.ok, swallowed.ok ? undefined : swallowed.reason).toBe(true)
    if (!swallowed.ok) return

    expect(swallowed.state.combatants.hero.conditions).toEqual(
      expect.arrayContaining(['blinded', 'restrained']),
    )
    const relations = sourceRelationEntries(swallowed.state, 'worm', 'hero')
    expect(relations).toHaveLength(1)
    expect(relations[0].effect.relation).toMatchObject({
      slotGroup: 'swallow',
    })
    const swallowedEffects =
      swallowed.state.combatants.hero.classState.activeEffects ?? []
    expect(swallowedEffects.find((effect) => effect.periodicDamage)?.periodicDamage)
      .toMatchObject({
        timing: 'source-turn-start',
        count: 6,
        sides: 6,
        type: 'acid',
      })

    const relationId = relations[0].effect.id
    const targetBeforeMove = { ...swallowed.state.combatants.hero.position }
    const moved = resolveDnd5eHeadlessAction(swallowed.state, {
      type: 'move',
      actorId: 'worm',
      to: { x: 5, y: 0 },
      distance: 5,
    })
    expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.hero.position).toEqual({
      x: targetBeforeMove.x + 5,
      y: targetBeforeMove.y,
    })
    expect(sourceRelationEntries(moved.state, 'worm', 'hero')
      .map((entry) => entry.effect.id)).toEqual([relationId])
  })

  it('does not swallow a target that succeeds on the Purple Worm Bite save', () => {
    const state = encounter('purple-worm', { sourceId: 'worm' })
    const saved = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'worm',
      actionId: 'bite',
      rolls: [monsterAttackRoll({
        slug: 'purple-worm',
        actionId: 'bite',
        effectId: 'bite-swallow',
        effectD20: 20,
      })],
    })
    expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
    if (!saved.ok) return
    expect(sourceRelationEntries(saved.state, 'worm', 'hero')).toEqual([])
    expect(saved.state.combatants.hero.conditions).not.toContain('blinded')
    expect(saved.state.combatants.hero.conditions).not.toContain('restrained')
  })

  it('rolls back the whole Purple Worm Bite when the mandatory swallow save is omitted', () => {
    const state = encounter('purple-worm', { sourceId: 'worm' })
    const before = structuredClone(state)
    const rejected = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'worm',
      actionId: 'bite',
      rolls: [monsterAttackRoll({
        slug: 'purple-worm',
        actionId: 'bite',
        effectId: 'bite-swallow',
      })],
    })
    expect(rejected).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(rejected.state.combatants.hero.currentHp)
      .toBe(before.combatants.hero.currentHp)
    expect(rejected.state.combatants.hero.classState.activeEffects)
      .toEqual(before.combatants.hero.classState.activeEffects)
    expect(rejected.state.combatants.worm.turn)
      .toEqual(before.combatants.worm.turn)
  })

  it('declares the unresolved composite semantics without fixing their transaction payload', () => {
    expect(dnd5eMonsterMultiattackConstraint(
      'srd-5.1:shambling-mound',
      'multiattack',
    ) as unknown).toMatchObject({
      occurrences: [
        {
          occurrenceIndex: 1,
          sameTargetAs: 0,
        },
        {
          occurrenceIndex: 2,
          sameTargetAs: 0,
          requiresPreviousHitsAt: [0, 1],
          targetMaxSizeRank: 2,
        },
      ],
    })

    expect(catalogAction('roper', 'multiattack').sequence)
      .toEqual(['tendril', 'tendril', 'tendril', 'tendril', 'reel', 'bite'])
    expect(catalogAction('shambling-mound', 'multiattack').sequence)
      .toEqual(['slam', 'slam', 'engulf'])
    expect(catalogAction('tarrasque', 'multiattack-swallow').sequence)
      .toEqual(['swallow', 'claw', 'claw', 'horns', 'tail'])
    expect(catalogAction('kraken', 'multiattack-flings').sequence)
      .toEqual(['fling', 'fling', 'fling'])
  })
})
