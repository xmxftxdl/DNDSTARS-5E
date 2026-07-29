import { afterEach, describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  getDnd5eSrdMonster,
  setDnd5eRoomMonsterCatalog,
  type Dnd5eMonsterStatBlock,
} from './monsters'

const ABILITIES = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

function combatant(
  id: string,
  controller: Dnd5eCombatant['controller'],
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities: ABILITIES,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 200,
    maxHp: 200,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function monsterCombatant(
  monster: Dnd5eMonsterStatBlock,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return combatant('actor', 'dm', 20, {
    statBlockId: monster.id,
    abilities: monster.abilities,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    ...patch,
  })
}

function weaponDamageRolls(
  monster: Dnd5eMonsterStatBlock,
  actionId: string,
  critical = false,
): number[][] {
  const attack = monster.actions.find((action) => action.id === actionId)?.attack
  if (!attack) throw new Error(`missing weapon attack: ${monster.id}:${actionId}`)
  return attack.damage.map((damage) =>
    Array(damage.count * (critical ? 2 : 1)).fill(2),
  )
}

function twoStrikeHobgoblin(): Dnd5eMonsterStatBlock {
  const hobgoblin = getDnd5eSrdMonster('srd-5.1:hobgoblin')
  if (!hobgoblin) throw new Error('missing SRD Hobgoblin')
  const longsword = hobgoblin.actions.find((action) => action.id === 'longsword')
  if (!longsword?.attack || longsword.automation !== 'headless') {
    throw new Error('Hobgoblin longsword is not Headless')
  }
  return {
    ...hobgoblin,
    id: 'test:two-strike-hobgoblin',
    slug: 'test-two-strike-hobgoblin',
    actions: [{
      id: 'test-multiattack',
      name: 'Test Multiattack',
      description: 'The hobgoblin makes two longsword attacks.',
      kind: 'multiattack',
      sequence: ['longsword', 'longsword'],
      automation: 'headless',
    }, ...hobgoblin.actions],
  }
}

function assassinPoisonResolution() {
  return [{
    effectId: 'poison-save-damage',
    d20: 20,
    damageRolls: [Array(7).fill(1)],
  }]
}

function setDistance(
  state: Dnd5eHeadlessCombatState,
  leftId: string,
  rightId: string,
  distanceFeet: number,
): void {
  state.distanceFeetByCombatantPair = {
    ...state.distanceFeetByCombatantPair,
    [dnd5eCombatantPairKey(leftId, rightId)]: distanceFeet,
  }
}

describe('SRD precision attack traits in the Headless runtime', () => {
  afterEach(() => setDnd5eRoomMonsterCatalog([]))

  it.each([
    {
      label: 'Hobgoblin Martial Advantage',
      slug: 'hobgoblin',
      traitId: 'martial-advantage',
      childActionId: 'longsword',
      multiattackActionId: 'test-multiattack',
    },
    {
      label: 'Spy Sneak Attack',
      slug: 'spy',
      traitId: 'sneak-attack',
      childActionId: 'shortsword',
      multiattackActionId: 'multiattack',
    },
  ] as const)(
    '$label waits for the first actual hit and cannot be reused in the same turn',
    ({ slug, traitId, childActionId, multiattackActionId }) => {
      const monster = slug === 'hobgoblin'
        ? twoStrikeHobgoblin()
        : getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      if (slug === 'hobgoblin') setDnd5eRoomMonsterCatalog([monster])
      const combatId = `${slug}-trait-runtime`
      const actor = monsterCombatant(monster)
      const target = combatant('target', 'player', 10, {
        position: { x: 5, y: 0 },
      })
      const ally = combatant('ally', 'dm', 5, {
        position: { x: 10, y: 0 },
      })
      const state = startDnd5eHeadlessCombat(combatId, [actor, target, ally])
      setDistance(state, actor.id, target.id, 5)
      setDistance(state, ally.id, target.id, 5)

      const first = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: actor.id,
        actionId: multiattackActionId,
        rolls: [
          {
            targetId: target.id,
            d20: 1,
            damageRolls: [],
          },
          {
            targetId: target.id,
            d20: 10,
            damageRolls: weaponDamageRolls(monster, childActionId),
            traitDamageRolls: [{
              traitId,
              rolls: [3, 3],
            }],
          },
        ],
      })

      expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
      if (!first.ok) return
      expect(first.events.filter((event) => event.type === 'attack-resolved'))
        .toEqual([
          expect.objectContaining({ actorId: actor.id, targetId: target.id, hit: false }),
          expect.objectContaining({ actorId: actor.id, targetId: target.id, hit: true }),
        ])
      expect(first.events.filter((event) =>
        event.type === 'monster-attack-trait-damage-applied')).toEqual([{
        type: 'monster-attack-trait-damage-applied',
        actorId: actor.id,
        targetId: target.id,
        traitId,
        traitName: expect.any(String),
        amount: 6,
      }])
      const turnKey = `${combatId}:1:${actor.id}`
      expect(first.state.combatants[actor.id].classState.declarativeUsedTurnKeys)
        .toMatchObject({ [`monster-trait:${traitId}`]: turnKey })

      first.state.combatants[actor.id].turn.actionAvailable = true
      const repeated = resolveDnd5eHeadlessAction(first.state, {
        type: 'monster-action',
        actorId: actor.id,
        actionId: childActionId,
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: weaponDamageRolls(monster, childActionId),
        }],
      })

      expect(repeated.ok, repeated.ok ? undefined : repeated.reason).toBe(true)
      if (!repeated.ok) return
      expect(repeated.events).not.toContainEqual(expect.objectContaining({
        type: 'monster-attack-trait-damage-applied',
        traitId,
      }))
      expect(repeated.state.combatants[actor.id].classState.declarativeUsedTurnKeys)
        .toMatchObject({ [`monster-trait:${traitId}`]: turnKey })
    },
  )

  it('gives Assassin advantage against a target that has not taken a turn', () => {
    const assassin = getDnd5eSrdMonster('srd-5.1:assassin')!
    const combatId = 'assassin-unacted-target'
    const turnKey = `${combatId}:1:actor`
    const actor = monsterCombatant(assassin, {
      classState: {
        declarativeUsedTurnKeys: {
          'monster-trait:sneak-attack': turnKey,
        },
      },
    })
    const target = combatant('target', 'player', 10, {
      position: { x: 5, y: 0 },
    })
    const state = startDnd5eHeadlessCombat(combatId, [actor, target])
    setDistance(state, actor.id, target.id, 5)

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'shortsword',
      rolls: [{
        targetId: target.id,
        d20: 1,
        d20Second: 5,
        damageRolls: weaponDamageRolls(assassin, 'shortsword'),
        onHitEffectRolls: assassinPoisonResolution(),
      }],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: actor.id,
      targetId: target.id,
      d20: 5,
      hit: true,
      critical: false,
    }))
  })

  it('turns an Assassin hit against a currently surprised target into a critical hit', () => {
    const assassin = getDnd5eSrdMonster('srd-5.1:assassin')!
    const combatId = 'assassin-surprise-critical'
    const turnKey = `${combatId}:1:actor`
    const actor = monsterCombatant(assassin, {
      classState: {
        declarativeUsedTurnKeys: {
          'monster-trait:sneak-attack': turnKey,
        },
      },
    })
    const target = combatant('target', 'player', 10, {
      position: { x: 5, y: 0 },
      classState: {
        surprisedCombatId: combatId,
      },
    })
    const state = startDnd5eHeadlessCombat(combatId, [actor, target])
    setDistance(state, actor.id, target.id, 5)

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'shortsword',
      rolls: [{
        targetId: target.id,
        d20: 2,
        d20Second: 5,
        damageRolls: weaponDamageRolls(assassin, 'shortsword', true),
        onHitEffectRolls: assassinPoisonResolution(),
      }],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: actor.id,
      targetId: target.id,
      d20: 5,
      hit: true,
      critical: true,
    }))
  })
})
