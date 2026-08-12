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
    ['boar', 20, 'tusk'],
    ['centaur', 30, 'pike'],
    ['elk', 20, 'ram'],
    ['giant-boar', 20, 'tusk'],
    ['giant-elk', 20, 'ram'],
    ['giant-goat', 20, 'ram'],
    ['giant-sea-horse', 20, 'ram'],
    ['goat', 20, 'ram'],
    ['rhinoceros', 20, 'gore'],
    ['unicorn', 20, 'horn'],
    ['minotaur', 10, 'gore'],
    ['minotaur-skeleton', 10, 'gore'],
  ] as const)(
    'projects %s Charge as a Headless move-then-hit trait',
    (slug, minimumStraightMovementFeet, actionId) => {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      expect(monster.traits).toContainEqual(expect.objectContaining({
        automation: 'headless',
        rule: expect.objectContaining({
          kind: 'charge-damage',
          minimumStraightMovementFeet,
          actionId,
        }),
      }))
    },
  )

  it.each(['minotaur', 'minotaur-skeleton'])(
    'resolves %s Charge damage, push and prone through one authoritative hit',
    (slug) => {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      const actor = monsterCombatant(monster, {
        speed: 40,
        position: { x: 0, y: 0 },
      })
      const target = combatant('target', 'player', 10, {
        position: { x: 15, y: 0 },
      })
      const state = startDnd5eHeadlessCombat(`${slug}-charge-runtime`, [actor, target])
      const moved = resolveDnd5eHeadlessAction(state, {
        type: 'move', actorId: actor.id, to: { x: 10, y: 0 }, distance: 10,
      })
      expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
      if (!moved.ok) return
      setDistance(moved.state, actor.id, target.id, 5)

      const hit = resolveDnd5eHeadlessAction(moved.state, {
        type: 'monster-action',
        actorId: actor.id,
        actionId: 'gore',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: weaponDamageRolls(monster, 'gore'),
          traitDamageRolls: [{ traitId: 'charge-damage', rolls: [4, 5] }],
          onHitEffectRolls: [{
            effectId: 'charge:gore:forced-movement',
            d20: 1,
            forcedMovement: {
              targetId: target.id,
              to: { x: 25, y: 0 },
              distanceFeet: 10,
            },
          }],
        }],
      })

      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) return
      expect(hit.events).toContainEqual(expect.objectContaining({
        type: 'monster-attack-trait-damage-applied',
        actorId: actor.id,
        targetId: target.id,
        traitId: 'charge-damage',
        amount: 9,
      }))
      expect(hit.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved', targetId: target.id, ability: 'str',
        dc: 14, success: false,
      }))
      expect(hit.state.combatants[target.id].position).toEqual({ x: 25, y: 0 })
      expect(hit.state.combatants[target.id].conditions).toContain('prone')
    },
  )

  it.each([
    ['lion', 20, 'claw', 13, 'pounce-bite-bonus-action', 'bite'],
    ['panther', 20, 'claw', 12, 'pounce-bite-bonus-action', 'bite'],
    ['saber-toothed-tiger', 20, 'claw', 14, 'pounce-bite-bonus-action', 'bite'],
    ['tiger', 20, 'claw', 13, 'pounce-bite-bonus-action', 'bite'],
    ['weretiger-hybrid', 15, 'claw', 14, 'pounce-bite-bonus-action', 'bite'],
    ['weretiger-tiger', 15, 'claw', 14, 'pounce-bite-bonus-action', 'bite'],
    ['elephant', 20, 'gore', 12, 'trampling-stomp-bonus-action', 'stomp'],
    ['gorgon', 20, 'gore', 16, 'trampling-hooves-bonus-action', 'hooves'],
    ['mammoth', 20, 'gore', 18, 'trampling-stomp-bonus-action', 'stomp'],
    ['triceratops', 20, 'gore', 13, 'trampling-stomp-bonus-action', 'stomp'],
    ['warhorse', 20, 'hooves', 14, 'trampling-hooves-bonus-action', 'hooves'],
  ] as const)(
    'projects %s move-hit-prone and its bound bonus attack',
    (slug, minimum, attackId, dc, bonusActionId, referencedActionId) => {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      expect(monster.traits).toContainEqual(expect.objectContaining({
        automation: 'headless',
        rule: expect.objectContaining({
          kind: 'charge-damage',
          minimumStraightMovementFeet: minimum,
          actionId: attackId,
          savingThrowOnHit: expect.objectContaining({ dc }),
          bonusActionFollowUp: {
            actionId: bonusActionId,
            referencedActionId,
            requiredTargetCondition: 'prone',
          },
        }),
      }))
      expect(monster.bonusActions).toContainEqual(expect.objectContaining({
        id: bonusActionId,
        referencedActionId,
        economy: 'bonus-action',
        automation: 'headless',
      }))
    },
  )

  it('binds Lion Pounce bonus Bite to the same prone target and consumes the credential once', () => {
    const lion = getDnd5eSrdMonster('srd-5.1:lion')!
    const actor = monsterCombatant(lion, {
      speed: 50,
      position: { x: 0, y: 0 },
    })
    const target = combatant('target', 'player', 10, {
      position: { x: 25, y: 0 },
    })
    const other = combatant('other', 'player', 5, {
      position: { x: 25, y: 5 },
      conditions: ['prone'],
    })
    const state = startDnd5eHeadlessCombat('lion-pounce-runtime', [actor, target, other])
    const moved = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: actor.id, to: { x: 20, y: 0 }, distance: 20,
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    setDistance(moved.state, actor.id, target.id, 5)
    setDistance(moved.state, actor.id, other.id, 5)

    const claw = resolveDnd5eHeadlessAction(moved.state, {
      type: 'monster-action', actorId: actor.id, actionId: 'claw',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: weaponDamageRolls(lion, 'claw'),
      }],
    })
    expect(claw.ok, claw.ok ? undefined : claw.reason).toBe(true)
    if (!claw.ok) return
    expect(claw.state.combatants[target.id].classState.monsterOnHitSavePending)
      .toMatchObject({
        sourceId: actor.id,
        actionId: 'claw',
        chargeFollowUp: {
          actionId: 'pounce-bite-bonus-action',
          referencedActionId: 'bite',
          requiredTargetCondition: 'prone',
        },
      })

    const saved = resolveDnd5eHeadlessAction(claw.state, {
      type: 'monster-on-hit-save', actorId: target.id,
      sourceId: actor.id, actionId: 'claw', d20: 1,
    })
    expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
    if (!saved.ok) return
    expect(saved.state.combatants[actor.id].classState.monsterTriggeredBonusAction)
      .toMatchObject({
        actionId: 'pounce-bite-bonus-action',
        referencedActionId: 'bite',
        targetId: target.id,
      })

    const wrongTarget = resolveDnd5eHeadlessAction(saved.state, {
      type: 'monster-bonus-action', actorId: actor.id,
      actionId: 'pounce-bite-bonus-action',
      rolls: [{
        targetId: other.id,
        d20: 10,
        damageRolls: weaponDamageRolls(lion, 'bite'),
      }],
    })
    expect(wrongTarget).toMatchObject({ ok: false, reason: 'invalid-monster-action' })

    const bite = resolveDnd5eHeadlessAction(saved.state, {
      type: 'monster-bonus-action', actorId: actor.id,
      actionId: 'pounce-bite-bonus-action',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: weaponDamageRolls(lion, 'bite'),
      }],
    })
    expect(bite.ok, bite.ok ? undefined : bite.reason).toBe(true)
    if (!bite.ok) return
    expect(bite.state.combatants[actor.id].turn.bonusActionAvailable).toBe(false)
    expect(bite.state.combatants[actor.id].classState.monsterTriggeredBonusAction)
      .toBeUndefined()
  })

  it('derives Boar Charge from committed straight movement and resolves its failed-save rider', () => {
    const boar = getDnd5eSrdMonster('srd-5.1:boar')!
    const actor = monsterCombatant(boar, {
      speed: 40,
      position: { x: 0, y: 0 },
    })
    const target = combatant('target', 'player', 10, {
      position: { x: 25, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('boar-charge-runtime', [actor, target])

    const moved = resolveDnd5eHeadlessAction(state, {
      type: 'move',
      actorId: actor.id,
      to: { x: 20, y: 0 },
      distance: 20,
    })
    expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants[actor.id].classState).toMatchObject({
      monsterMechanicMovementFeet: 20,
      monsterMechanicMovementOrigin: { x: 0, y: 0 },
      monsterMechanicMovementLast: { x: 20, y: 0 },
      monsterMechanicMovementStraight: true,
    })
    setDistance(moved.state, actor.id, target.id, 5)

    const hit = resolveDnd5eHeadlessAction(moved.state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'tusk',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: weaponDamageRolls(boar, 'tusk'),
        traitDamageRolls: [{ traitId: 'charge-damage', rolls: [3] }],
      }],
    })
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual({
      type: 'monster-attack-trait-damage-applied',
      actorId: actor.id,
      targetId: target.id,
      traitId: 'charge-damage',
      traitName: '冲锋',
      amount: 3,
    })
    expect(hit.events).toContainEqual({
      type: 'monster-on-hit-save-required',
      targetId: target.id,
      sourceId: actor.id,
      actionId: 'tusk',
      ability: 'str',
      dc: 11,
      condition: 'prone',
    })

    const failedSave = resolveDnd5eHeadlessAction(hit.state, {
      type: 'monster-on-hit-save',
      actorId: target.id,
      sourceId: actor.id,
      actionId: 'tusk',
      d20: 1,
    })
    expect(failedSave.ok, failedSave.ok ? undefined : failedSave.reason).toBe(true)
    if (!failedSave.ok) return
    expect(failedSave.state.combatants[target.id].conditions).toContain('prone')
  })

  it('does not activate Charge after the actor changes movement direction', () => {
    const boar = getDnd5eSrdMonster('srd-5.1:boar')!
    const actor = monsterCombatant(boar, {
      speed: 40,
      position: { x: 0, y: 0 },
    })
    const target = combatant('target', 'player', 10, {
      position: { x: 15, y: 10 },
    })
    const state = startDnd5eHeadlessCombat('boar-turned-charge', [actor, target])
    const firstMove = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: actor.id, to: { x: 0, y: 10 }, distance: 10,
    })
    expect(firstMove.ok).toBe(true)
    if (!firstMove.ok) return
    const secondMove = resolveDnd5eHeadlessAction(firstMove.state, {
      type: 'move', actorId: actor.id, to: { x: 10, y: 10 }, distance: 10,
    })
    expect(secondMove.ok).toBe(true)
    if (!secondMove.ok) return
    expect(secondMove.state.combatants[actor.id].classState).toMatchObject({
      monsterMechanicMovementFeet: 20,
      monsterMechanicMovementStraight: false,
    })
    setDistance(secondMove.state, actor.id, target.id, 5)

    const hit = resolveDnd5eHeadlessAction(secondMove.state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'tusk',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: weaponDamageRolls(boar, 'tusk'),
      }],
    })
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    if (!hit.ok) return
    expect(hit.events).not.toContainEqual(expect.objectContaining({
      type: 'monster-attack-trait-damage-applied',
      traitId: 'charge-damage',
    }))
    expect(hit.events).not.toContainEqual(expect.objectContaining({
      type: 'monster-on-hit-save-required',
      actionId: 'tusk',
    }))
  })

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
