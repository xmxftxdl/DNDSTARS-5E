import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

import { monsterMechanicFixture } from './test-utils/monsterMechanicFixture'
import { setDnd5eRoomMonsterCatalog } from './monsters'

const mechanicFixtures = new Map([['kraken', monsterMechanicFixture('kraken', ["bite","tentacle","fling","multiattack","multiattack-two-tentacles-and-fling","multiattack-tentacle-and-two-flings","multiattack-flings","legendary-fling","legendary-tentacle-attack"])],['purple-worm', monsterMechanicFixture('purple-worm', ["bite","tail-stinger","multiattack"])]])
beforeEach(() => setDnd5eRoomMonsterCatalog([...mechanicFixtures.values()]))
afterEach(() => setDnd5eRoomMonsterCatalog([]))
const getMechanicMonster = (slug: string) => mechanicFixtures.get(slug) ?? getDnd5eSrdMonsterBySlug(slug)

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
  const monster = getMechanicMonster(slug)
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
  const action = getMechanicMonster(slug)?.actions.find(
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

describe('complex relation sub-rules in isolated fixtures', () => {
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
      ['kraken', 'bite'],
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
      relationRequirement: {
        kind: 'target-linked-to-source',
        slotGroup: 'bite',
      },
      attack: {
        onHitEffects: [expect.objectContaining({
          id: 'swallow',
          kind: 'source-linked-condition',
        })],
      },
    })
    expect(catalogAction('kraken', 'fling')).toMatchObject({
      relationRequirement: {
        kind: 'target-linked-to-source',
        slotGroup: 'tentacle',
      },
    })
    expect(catalogAction('kraken', 'bite')).toMatchObject({
      description: expect.stringContaining('命中 +17'),
      relationRequirement: {
        kind: 'target-linked-to-source',
        slotGroup: 'tentacle',
      },
      attack: {
        targetMaxSizeRank: 3,
        onHitEffects: [expect.objectContaining({
          id: 'bite-swallow',
          sourceDeathEscape: { movementCostFeet: 15, applyProne: true },
        })],
      },
    })
    expect(catalogAction('kraken', 'tentacle').description)
      .toContain('命中 +17')
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

  it('settles Kraken Bite only against a tentacle-grappled Large-or-smaller target', () => {
    const state = encounter('kraken', {
      sourceId: 'kraken',
      targetSizeRank: 3,
    })
    const grappled = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: 'kraken',
      actionId: 'tentacle',
      rolls: [monsterAttackRoll({
        slug: 'kraken',
        actionId: 'tentacle',
        effectId: 'tentacle-grapple',
      })],
    })
    expect(grappled.ok, grappled.ok ? undefined : grappled.reason).toBe(true)
    if (!grappled.ok) return
    grappled.state.combatants.kraken.turn.actionAvailable = true
    const swallowed = resolveDnd5eHeadlessAction(grappled.state, {
      type: 'monster-action',
      actorId: 'kraken',
      actionId: 'bite',
      rolls: [monsterAttackRoll({
        slug: 'kraken',
        actionId: 'bite',
        effectId: 'bite-swallow',
      })],
    })
    expect(swallowed.ok, swallowed.ok ? undefined : swallowed.reason).toBe(true)
    if (!swallowed.ok) return
    expect(sourceRelationEntries(swallowed.state, 'kraken', 'hero'))
      .toHaveLength(1)
    expect(sourceRelationEntries(swallowed.state, 'kraken', 'hero')[0]?.effect)
      .toMatchObject({
        relation: { kind: 'swallowed', slotGroup: 'swallow' },
        periodicDamage: {
          timing: 'source-turn-start',
          count: 12,
          sides: 6,
          type: 'acid',
        },
      })
    expect(swallowed.state.combatants.hero.conditions)
      .toEqual(expect.arrayContaining(['blinded', 'restrained']))
  })

  it('enforces swallowed total cover, preserves corpse containment, and spends movement to exit prone', () => {
    const state = encounter('purple-worm', { sourceId: 'worm' })
    const outsider = combatant({
      id: 'outsider',
      initiative: 5,
      controller: 'player',
      x: 10,
    })
    state.combatants.outsider = outsider
    state.initiativeOrder = ['worm', 'hero', 'outsider']
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

    const outsiderState = structuredClone(swallowed.state)
    outsiderState.initiativeIndex = 2
    const outsideAttack = resolveDnd5eHeadlessAction(outsiderState, {
      type: 'attack',
      actorId: 'outsider',
      targetId: 'hero',
      attackModifier: 100,
      d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'piercing' },
    })
    expect(outsideAttack).toMatchObject({ ok: false, reason: 'invalid-target' })

    const insideState = structuredClone(swallowed.state)
    insideState.initiativeIndex = 1
    const insideToOutside = resolveDnd5eHeadlessAction(insideState, {
      type: 'attack',
      actorId: 'hero',
      targetId: 'outsider',
      attackModifier: 100,
      d20: 10,
      d20Second: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'piercing' },
    })
    expect(insideToOutside).toMatchObject({ ok: false, reason: 'invalid-target' })

    const dyingState = structuredClone(swallowed.state)
    dyingState.initiativeIndex = 1
    dyingState.combatants.worm.currentHp = 10
    const killedFromInside = resolveDnd5eHeadlessAction(dyingState, {
      type: 'attack',
      actorId: 'hero',
      targetId: 'worm',
      attackModifier: 100,
      d20: 10,
      d20Second: 10,
      damage: { count: 1, sides: 20, bonus: 0, rolls: [20], type: 'slashing' },
    })
    expect(killedFromInside.ok, killedFromInside.ok ? undefined : killedFromInside.reason).toBe(true)
    if (!killedFromInside.ok) return
    expect(killedFromInside.state.combatants.hero.conditions).not.toContain('blinded')
    expect(killedFromInside.state.combatants.hero.conditions).not.toContain('restrained')
    const corpseRelation = sourceRelationEntries(
      killedFromInside.state,
      'worm',
      'hero',
    )[0]?.effect
    expect(corpseRelation).toMatchObject({
      relation: {
        kind: 'swallowed',
        corpseEscape: { movementCostFeet: 20, applyProne: true },
      },
      suspendedBy: expect.arrayContaining(['monster-swallow-source-dead']),
    })
    expect(killedFromInside.events).toContainEqual(expect.objectContaining({
      type: 'monster-swallow-corpse-containment-started',
      sourceId: 'worm',
      targetId: 'hero',
      movementCostFeet: 20,
    }))

    const tooFar = resolveDnd5eHeadlessAction(killedFromInside.state, {
      type: 'move',
      actorId: 'hero',
      to: { x: 20, y: 0 },
      distance: 15,
    })
    expect(tooFar).toMatchObject({ ok: false, reason: 'insufficient-movement' })

    const escaped = resolveDnd5eHeadlessAction(killedFromInside.state, {
      type: 'move',
      actorId: 'hero',
      to: { x: 10, y: 0 },
      distance: 5,
    })
    expect(escaped.ok, escaped.ok ? undefined : escaped.reason).toBe(true)
    if (!escaped.ok) return
    expect(sourceRelationEntries(escaped.state, 'worm', 'hero')).toEqual([])
    expect(escaped.state.combatants.hero.conditions).toContain('prone')
    expect(escaped.state.combatants.hero.turn.movementRemaining).toBe(5)
    expect(escaped.events).toContainEqual(expect.objectContaining({
      type: 'monster-swallow-corpse-escaped',
      sourceId: 'worm',
      targetId: 'hero',
      movementCostFeet: 20,
      prone: true,
    }))
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

vi.mock('./monsterMultiattackConstraints', async importOriginal => {
  const original = await importOriginal<typeof import('./monsterMultiattackConstraints')>()
  const { monsterMechanicConstraints } = await import('./test-utils/monsterMechanicConstraints')
  return monsterMechanicConstraints(original)
})
