import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { getDnd5eSrdMonsterBySlug } from './monsters'

const abilities = {
  str: 16,
  dex: 14,
  con: 14,
  int: 10,
  wis: 12,
  cha: 8,
} as const

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Parameters<typeof createDnd5eCombatant>[0]> = {},
) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 16,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('source-linked automatic-hit attacks', () => {
  it.each([
    {
      slug: 'marilith',
      firstDamageRolls: [[4, 4]],
      secondDamageRolls: [[1, 1]],
    },
    {
      slug: 'salamander',
      firstDamageRolls: [[4, 4], [4, 4]],
      secondDamageRolls: [[1, 1], [1, 1]],
    },
  ])('$slug Tail automatically hits only its own linked target', ({
    slug,
    firstDamageRolls,
    secondDamageRolls,
  }) => {
    const monster = getDnd5eSrdMonsterBySlug(slug)!
    const source = combatant('source', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      abilities: monster.abilities,
      proficiencyBonus: 2,
      armorClass: monster.armorClass.value,
      currentHp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
      sizeRank: ({
        微型: 0,
        小型: 1,
        中型: 2,
        大型: 3,
        超大型: 4,
        巨型: 5,
      } as const)[monster.size],
    })
    const target = combatant('target', 10, {
      armorClass: 10,
      sizeRank: 2,
      position: { x: 5, y: 0 },
    })
    const state = startDnd5eHeadlessCombat(
      `source-linked-auto-hit:${slug}`,
      [source, target],
    )
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(source.id, target.id)]: 5,
    }

    const linked = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: source.id,
      actionId: 'tail',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: firstDamageRolls,
        onHitEffectRolls: [{ effectId: 'tail-grapple' }],
      }],
    })
    expect(linked.ok, linked.ok ? undefined : linked.reason).toBe(true)
    if (!linked.ok) return
    expect(linked.state.combatants[target.id].conditions).toEqual(
      expect.arrayContaining(['grappled', 'restrained']),
    )

    linked.state.combatants[source.id].turn.actionAvailable = true
    linked.state.combatants[target.id].armorClass = 30
    const repeated = resolveDnd5eHeadlessAction(linked.state, {
      type: 'monster-action',
      actorId: source.id,
      actionId: 'tail',
      rolls: [{
        targetId: target.id,
        d20: 1,
        damageRolls: secondDamageRolls,
        onHitEffectRolls: [{ effectId: 'tail-grapple' }],
      }],
    })
    expect(repeated.ok, repeated.ok ? undefined : repeated.reason).toBe(true)
    if (!repeated.ok) return
    expect(repeated.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: source.id,
      targetId: target.id,
      d20: 1,
      hit: true,
      critical: false,
    }))
  })
})
