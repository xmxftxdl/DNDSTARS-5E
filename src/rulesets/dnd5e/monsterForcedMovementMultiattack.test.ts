import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterForcedMovementOnHitEffect,
} from './monsters'

const SOURCE_POSITION = { x: 25, y: 25 } as const
const ADJACENT_POSITION = { x: 25, y: 75 } as const
const DISTANT_POSITION = { x: 275, y: 25 } as const

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 5,
    currentHp: 300,
    maxHp: 300,
    temporaryHp: 0,
    speed: 30,
    position: SOURCE_POSITION,
    concentrating: false,
    ...patch,
  })
}

function catalogMonster(slug: string): Dnd5eCombatant {
  const monster = getDnd5eSrdMonsterBySlug(slug)
  if (!monster) throw new Error(`Missing SRD monster ${slug}`)
  return combatant('monster', 30, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    abilities: monster.abilities,
    position: SOURCE_POSITION,
  })
}

function monsterAction(slug: string, actionId: string): Dnd5eMonsterAction {
  const action = getDnd5eSrdMonsterBySlug(slug)?.actions.find(
    (candidate) => candidate.id === actionId,
  )
  if (!action) throw new Error(`Missing ${slug}/${actionId}`)
  return action
}

function minimumDamageRolls(action: Dnd5eMonsterAction): number[][] {
  if (!action.attack) throw new Error(`${action.id} has no weapon attack`)
  return action.attack.damage.map((damage) => Array(damage.count).fill(1))
}

function forcedMovementEffect(
  slug: string,
  actionId: string,
): Dnd5eMonsterForcedMovementOnHitEffect {
  const effect = monsterAction(slug, actionId).attack?.onHitEffects?.find(
    (candidate) => candidate.kind === 'forced-movement',
  )
  if (!effect || effect.kind !== 'forced-movement') {
    throw new Error(`Missing forced movement on ${slug}/${actionId}`)
  }
  return effect
}

function encounter(input: {
  slug: string
  forcedTargetPosition: { x: number; y: number }
  forcedTargetDistanceFeet: number
}): {
  state: Dnd5eHeadlessCombatState
  closeTarget: Dnd5eCombatant
  forcedTarget: Dnd5eCombatant
} {
  const monster = catalogMonster(input.slug)
  const closeTarget = combatant('close-target', 20, {
    position: ADJACENT_POSITION,
    savingThrowBonuses: { str: 0 },
  })
  const forcedTarget = combatant('forced-target', 10, {
    position: input.forcedTargetPosition,
    savingThrowBonuses: { str: 0 },
    sizeRank: 2,
  })
  const state = startDnd5eHeadlessCombat(
    `forced-movement:${input.slug}`,
    [monster, closeTarget, forcedTarget],
  )
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey(monster.id, closeTarget.id)]: 5,
    [dnd5eCombatantPairKey(monster.id, forcedTarget.id)]:
      input.forcedTargetDistanceFeet,
  }
  state.gridDistance = {
    cellUnits: 50,
    feetPerCell: 5,
    offsetX: 0,
    offsetY: 0,
    footprintCellsByCombatantId: {
      [monster.id]: 1,
      [closeTarget.id]: 1,
      [forcedTarget.id]: 1,
    },
  }
  return { state, closeTarget, forcedTarget }
}

type HeadlessAction = Parameters<typeof resolveDnd5eHeadlessAction>[1]

function resolveDraft(
  state: Dnd5eHeadlessCombatState,
  action: unknown,
) {
  return resolveDnd5eHeadlessAction(state, action as HeadlessAction)
}

describe('catalog forced-movement Multiattacks', () => {
  it('pulls a failed-save target with the Balor Whip inside Multiattack', () => {
    const { state, closeTarget, forcedTarget } = encounter({
      slug: 'balor',
      forcedTargetPosition: DISTANT_POSITION,
      forcedTargetDistanceFeet: 25,
    })
    const longsword = monsterAction('balor', 'longsword')
    const whip = monsterAction('balor', 'whip')
    const effect = forcedMovementEffect('balor', 'whip')
    expect(effect).toMatchObject({
      resistance: { kind: 'saving-throw', ability: 'str', dc: 20 },
      direction: 'toward-source',
      maximumDistanceFeet: 25,
    })

    const result = resolveDraft(state, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'multiattack',
      rolls: [
        {
          targetId: closeTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(longsword),
        },
        {
          targetId: forcedTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(whip),
          onHitEffectRolls: [{
            effectId: effect.id,
            d20: 1,
            forcedMovement: {
              targetId: forcedTarget.id,
              to: { x: 75, y: 25 },
              distanceFeet: 20,
            },
          }],
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[forcedTarget.id].position).toEqual({
      x: 75,
      y: 25,
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'moved',
      actorId: forcedTarget.id,
      from: DISTANT_POSITION,
      to: { x: 75, y: 25 },
      distance: 20,
    }))
  })

  it('pulls when Merrow wins the opposed Strength check for its Harpoon', () => {
    const { state, closeTarget, forcedTarget } = encounter({
      slug: 'merrow',
      forcedTargetPosition: DISTANT_POSITION,
      forcedTargetDistanceFeet: 25,
    })
    const bite = monsterAction('merrow', 'bite')
    const harpoon = monsterAction('merrow', 'harpoon')
    const effect = forcedMovementEffect('merrow', 'harpoon')
    expect(effect).toMatchObject({
      resistance: {
        kind: 'opposed-ability-check',
        sourceAbility: 'str',
        targetAbility: 'str',
      },
      direction: 'toward-source',
      maximumDistanceFeet: 20,
      targetMaxSizeRank: 4,
    })

    const result = resolveDraft(state, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'multiattack-bite-and-harpoon',
      rolls: [
        {
          targetId: closeTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(bite),
        },
        {
          targetId: forcedTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(harpoon),
          onHitEffectRolls: [{
            effectId: effect.id,
            sourceD20: 10,
            d20: 5,
            forcedMovement: {
              targetId: forcedTarget.id,
              to: { x: 75, y: 25 },
              distanceFeet: 20,
            },
          }],
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[forcedTarget.id].position).toEqual({
      x: 75,
      y: 25,
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-on-hit-contest-resolved',
      actorId: 'monster',
      targetId: forcedTarget.id,
      sourceTotal: 14,
      targetTotal: 5,
      sourceWins: true,
    }))
  })

  it('treats a tied Merrow Harpoon contest as resistance and does not pull', () => {
    const { state, closeTarget, forcedTarget } = encounter({
      slug: 'merrow',
      forcedTargetPosition: DISTANT_POSITION,
      forcedTargetDistanceFeet: 25,
    })
    const bite = monsterAction('merrow', 'bite')
    const harpoon = monsterAction('merrow', 'harpoon')
    const effect = forcedMovementEffect('merrow', 'harpoon')

    const result = resolveDraft(state, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'multiattack-bite-and-harpoon',
      rolls: [
        {
          targetId: closeTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(bite),
        },
        {
          targetId: forcedTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(harpoon),
          onHitEffectRolls: [{
            effectId: effect.id,
            sourceD20: 1,
            d20: 5,
            forcedMovement: {
              targetId: forcedTarget.id,
              to: DISTANT_POSITION,
              distanceFeet: 0,
            },
          }],
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[forcedTarget.id].position).toEqual(
      DISTANT_POSITION,
    )
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-on-hit-contest-resolved',
      actorId: 'monster',
      targetId: forcedTarget.id,
      sourceTotal: 5,
      targetTotal: 5,
      sourceWins: false,
    }))
    expect(result.events.some((event) =>
      event.type === 'moved' &&
      event.actorId === forcedTarget.id)).toBe(false)
  })

  it('pushes and knocks prone with Dragon Turtle Tail inside its legal alternative', () => {
    const tailStart = { x: 75, y: 25 } as const
    const { state, closeTarget, forcedTarget } = encounter({
      slug: 'dragon-turtle',
      forcedTargetPosition: tailStart,
      forcedTargetDistanceFeet: 5,
    })
    const bite = monsterAction('dragon-turtle', 'bite')
    const tail = monsterAction('dragon-turtle', 'tail')
    const effect = forcedMovementEffect('dragon-turtle', 'tail')
    expect(effect).toMatchObject({
      resistance: { kind: 'saving-throw', ability: 'str', dc: 20 },
      direction: 'away-from-source',
      maximumDistanceFeet: 10,
      conditionOnFailedResistance: 'prone',
    })

    const result = resolveDraft(state, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'multiattack-bite-and-tail',
      rolls: [
        {
          targetId: closeTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(bite),
        },
        {
          targetId: forcedTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(tail),
          onHitEffectRolls: [{
            effectId: effect.id,
            d20: 1,
            forcedMovement: {
              targetId: forcedTarget.id,
              to: { x: 175, y: 25 },
              distanceFeet: 10,
            },
          }],
        },
      ],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[forcedTarget.id].position).toEqual({
      x: 175,
      y: 25,
    })
    expect(result.state.combatants[forcedTarget.id].conditions).toContain('prone')
  })

  it.each([
    {
      label: 'opposite direction',
      movement: { to: { x: 325, y: 25 }, distanceFeet: 5 },
    },
    {
      label: 'forged distance',
      movement: { to: { x: 75, y: 25 }, distanceFeet: 25 },
    },
  ])('rolls back the whole Multiattack for a forged $label', ({ movement }) => {
    const { state, closeTarget, forcedTarget } = encounter({
      slug: 'balor',
      forcedTargetPosition: DISTANT_POSITION,
      forcedTargetDistanceFeet: 25,
    })
    const longsword = monsterAction('balor', 'longsword')
    const whip = monsterAction('balor', 'whip')
    const effect = forcedMovementEffect('balor', 'whip')
    const closeHpBefore = state.combatants[closeTarget.id].currentHp
    const forcedHpBefore = state.combatants[forcedTarget.id].currentHp

    const result = resolveDraft(state, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'multiattack',
      rolls: [
        {
          targetId: closeTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(longsword),
        },
        {
          targetId: forcedTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(whip),
          onHitEffectRolls: [{
            effectId: effect.id,
            d20: 1,
            forcedMovement: {
              targetId: forcedTarget.id,
              ...movement,
            },
          }],
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.state.combatants[closeTarget.id].currentHp).toBe(closeHpBefore)
    expect(result.state.combatants[forcedTarget.id].currentHp).toBe(forcedHpBefore)
    expect(result.state.combatants[forcedTarget.id].position).toEqual(
      DISTANT_POSITION,
    )
    expect(result.state.combatants.monster.turn.actionAvailable).toBe(true)
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved' ||
      event.type === 'turn-resource-spent' ||
      event.type === 'moved')).toHaveLength(0)
  })
})
