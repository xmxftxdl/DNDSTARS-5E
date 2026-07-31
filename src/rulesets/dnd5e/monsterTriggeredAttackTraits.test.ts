import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  prepareDnd5eMonsterAttack,
  resolvePreparedDnd5eMonsterAttack,
} from './monsterAttackAction'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterWeaponAttack,
} from './monsters'

const ABILITIES = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

function srdMonster(slug: string): Dnd5eMonsterStatBlock {
  const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
  if (!monster) throw new Error(`missing SRD monster: ${slug}`)
  return monster
}

function meleeWeaponAction(slug: string, requestedActionId?: string) {
  const monster = srdMonster(slug)
  const action = requestedActionId
    ? monster.actions.find((candidate) => candidate.id === requestedActionId)
    : monster.actions.find((candidate) =>
        candidate.kind === 'weapon-attack' &&
        candidate.automation === 'headless' &&
        candidate.attack?.mode === 'melee')
  if (!action || action.kind !== 'weapon-attack' || !action.attack) {
    throw new Error(`missing Headless melee weapon action: ${slug}:${requestedActionId ?? 'first'}`)
  }
  return { monster, action, attack: action.attack }
}

function damageRolls(
  attack: Dnd5eMonsterWeaponAttack,
  options: { critical?: boolean; value?: number } = {},
): number[][] {
  const multiplier = options.critical ? 2 : 1
  return attack.damage.map((component) =>
    Array(component.count * multiplier).fill(options.value ?? 1))
}

function expectSuccess(result: Dnd5eActionResult) {
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result
}

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
    abilities: ABILITIES,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function catalogCombatant(
  slug: string,
  initiative = 20,
  id = slug,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  const monster = srdMonster(slug)
  return combatant(id, initiative, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    armorClass: monster.armorClass.value,
    abilities: monster.abilities,
    ...patch,
  })
}

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    player: 'P1',
    avatar: '',
    accent: '',
    race: '',
    charClass: '',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { ...ABILITIES },
    savingThrows: [],
    skills: [],
    maxHp: 100,
    currentHp: 100,
    tempHp: 0,
    hitDice: '1d8',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(patch: Partial<Token> = {}): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 100,
    maxHp: 100,
    ...patch,
  }
}

function prepareHostAttack(input: {
  slug: string
  actionId: string
  combatId?: string
  round?: number
  targetState?: Character['dnd5eCombatState']
  targetHp?: number
  actorState?: Token['dnd5eCombatState']
  actorSlotId?: string
}) {
  const combatId = input.combatId ?? 'triggered-trait-combat'
  const monster = srdMonster(input.slug)
  const actionIndex = monster.actions.findIndex((action) => action.id === input.actionId)
  if (actionIndex < 0) throw new Error(`missing action: ${input.slug}:${input.actionId}`)
  const targetHp = input.targetHp ?? 100
  const hero = character({
    currentHp: targetHp,
    dnd5eCombatState: input.targetState,
  })
  const actor = token({
    id: 'monster',
    label: monster.name,
    poolId: monster.id,
    hp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    dnd5eCombatState: input.actorState,
  })
  const target = token({
    id: 'hero-token',
    label: hero.name,
    x: 10,
    type: 'player',
    characterId: hero.id,
    hp: targetHp,
    maxHp: hero.maxHp,
  })
  const map: BattleMap = {
    id: `${input.slug}-map`,
    name: `${input.slug} map`,
    width: 100,
    height: 100,
    gridSize: 10,
    feetPerCell: 5,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [actor, target],
  }
  const prepared = prepareDnd5eMonsterAttack({
    combatId,
    round: input.round ?? 1,
    map,
    characters: [hero],
    initiativeOrder: [
      {
        tokenId: actor.id,
        slotId: input.actorSlotId,
        label: actor.label,
        emoji: '',
        color: '',
        roll: 20,
      },
      {
        tokenId: target.id,
        slotId: 'hero-slot',
        label: target.label,
        emoji: '',
        color: '',
        roll: 10,
      },
    ],
    actorTokenId: actor.id,
    targetTokenId: target.id,
    actionIndex,
  })
  expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
  if (!prepared.ok) throw new Error(prepared.reason)
  return { hero, prepared: prepared.prepared }
}

function traitRule(slug: string, kind: string) {
  return srdMonster(slug).traits.find((trait) => trait.rule?.kind === kind)
}

describe('SRD triggered attack trait catalog mappings', () => {
  it.each([
    'giant-shark',
    'hunter-shark',
    'quipper',
    'sahuagin',
    'swarm-of-quippers',
  ])('maps %s Blood Frenzy to an authoritative melee rule', (slug) => {
    expect(traitRule(slug, 'blood-frenzy')).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'blood-frenzy',
        attackMode: 'melee',
        targetHitPoints: 'below-maximum',
      },
    })
  })

  it.each([
    ['bugbear', 2, 6, 7],
    ['doppelganger', 3, 6, 10],
  ] as const)('maps %s Surprise Attack without hard-coding its damage type', (
    slug,
    count,
    sides,
    average,
  ) => {
    expect(traitRule(slug, 'surprise-attack')).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'surprise-attack',
        requiredRound: 1,
        targetState: 'currently-surprised',
        applyOn: 'each-qualifying-hit',
        extraDamage: {
          average,
          count,
          sides,
          bonus: 0,
          type: 'inherit-primary',
        },
      },
    })
  })

  it('maps Doppelganger Ambusher and both SRD Reckless monsters', () => {
    expect(traitRule('doppelganger', 'ambusher-attack-advantage')).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'ambusher-attack-advantage',
        requiredRound: 1,
        targetState: 'currently-surprised',
      },
    })
    for (const slug of ['berserker', 'minotaur']) {
      expect(traitRule(slug, 'reckless')).toMatchObject({
        automation: 'headless',
        rule: {
          kind: 'reckless',
          activation: 'turn-start-tactical-default',
          outgoing: {
            delivery: 'weapon-attack',
            mode: 'melee',
            rollMode: 'advantage',
            duration: 'current-turn',
          },
          incoming: {
            rollMode: 'advantage',
            duration: 'until-source-turn-start',
          },
        },
      })
    }
  })
})

describe('Blood Frenzy and Ambusher Host preparation', () => {
  it('grants Blood Frenzy advantage only while the target is wounded', () => {
    const full = prepareHostAttack({
      slug: 'giant-shark',
      actionId: 'bite',
      targetHp: 100,
    })
    expect(full.prepared.attackModes).toEqual(['normal'])

    const wounded = prepareHostAttack({
      slug: 'giant-shark',
      actionId: 'bite',
      targetHp: 99,
    })
    expect(wounded.prepared.attackModes).toEqual(['advantage'])
  })

  it('grants Doppelganger Ambusher only in round one against a still-surprised target', () => {
    const combatId = 'doppelganger-ambusher'
    const surprised = prepareHostAttack({
      slug: 'doppelganger',
      actionId: 'multiattack',
      combatId,
      targetState: { surprisedCombatId: combatId },
    })
    expect(surprised.prepared.attackModes).toEqual(['advantage', 'advantage'])

    const laterRound = prepareHostAttack({
      slug: 'doppelganger',
      actionId: 'multiattack',
      combatId,
      round: 2,
      targetState: { surprisedCombatId: combatId },
    })
    expect(laterRound.prepared.attackModes).toEqual(['normal', 'normal'])

    const resolved = prepareHostAttack({
      slug: 'doppelganger',
      actionId: 'multiattack',
      combatId,
      targetState: {
        surprisedCombatId: combatId,
        surpriseResolvedCombatId: combatId,
      },
    })
    expect(resolved.prepared.attackModes).toEqual(['normal', 'normal'])
  })
})

describe('Bugbear and Doppelganger Surprise Attack settlement', () => {
  it.each([
    ['bugbear', 2],
    ['doppelganger', 3],
  ] as const)('inherits %s primary damage and doubles all Surprise Attack dice on a critical', (
    slug,
    surpriseDice,
  ) => {
    const combatId = `critical-surprise-${slug}`
    const { action } = meleeWeaponAction(slug)
    const { hero, prepared } = prepareHostAttack({
      slug,
      actionId: action.id,
      combatId,
      targetState: { surprisedCombatId: combatId },
    })
    expect(prepared.attacks.length).toBeGreaterThanOrEqual(1)
    for (const { attack } of prepared.attacks) {
      expect(attack.damage.at(-1)).toMatchObject({
        count: surpriseDice,
        sides: 6,
        bonus: 0,
        type: attack.damage[0].type,
      })
    }

    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared,
      rolls: prepared.attacks.map(({ attack }) => ({
        d20: 20,
        d20Second: 2,
        damageRolls: damageRolls(attack, { critical: true }),
      })),
    })
    expectSuccess(resolved.result)
    const expectedDamage = prepared.attacks.reduce(
      (actionTotal, { attack }) =>
        actionTotal + attack.damage.reduce(
          (attackTotal, component) =>
            attackTotal + component.count * 2 + component.bonus,
          0,
        ),
      0,
    )
    expect(resolved.application?.characters.find((entry) => entry.id === hero.id)?.currentHp)
      .toBe(hero.currentHp - expectedDamage)
    expect(resolved.result.events.filter((event) =>
      event.type === 'attack-resolved' &&
      event.actorId === 'monster' &&
      event.targetId === 'hero-token' &&
      event.critical)).toHaveLength(prepared.attacks.length)
  })

  it('applies Doppelganger Surprise Attack to every hit in its Multiattack', () => {
    const combatId = 'doppelganger-each-hit'
    const { hero, prepared } = prepareHostAttack({
      slug: 'doppelganger',
      actionId: 'multiattack',
      combatId,
      targetState: { surprisedCombatId: combatId },
    })
    expect(prepared.attacks).toHaveLength(2)
    for (const { attack } of prepared.attacks) {
      expect(attack.damage.at(-1)).toMatchObject({
        count: 3,
        sides: 6,
        type: attack.damage[0].type,
      })
    }

    const expectedDamage = prepared.attacks.reduce(
      (actionTotal, { attack }) =>
        actionTotal + attack.damage.reduce(
          (attackTotal, component) =>
            attackTotal + component.count + component.bonus,
          0,
        ),
      0,
    )
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared,
      rolls: prepared.attacks.map(({ attack }) => ({
        d20: 10,
        d20Second: 2,
        damageRolls: damageRolls(attack),
      })),
    })
    expectSuccess(resolved.result)
    expect(resolved.application?.characters.find((entry) => entry.id === hero.id)?.currentHp)
      .toBe(hero.currentHp - expectedDamage)
    expect(resolved.result.events.filter((event) =>
      event.type === 'attack-resolved' && event.hit)).toHaveLength(2)
  })

  it('does not append Surprise Attack after round one or without current surprise', () => {
    const combatId = 'doppelganger-surprise-guards'
    const baseDamageCount = meleeWeaponAction('doppelganger', 'slam').attack.damage.length
    for (const prepared of [
      prepareHostAttack({
        slug: 'doppelganger',
        actionId: 'multiattack',
        combatId,
        round: 2,
        targetState: { surprisedCombatId: combatId },
      }).prepared,
      prepareHostAttack({
        slug: 'doppelganger',
        actionId: 'multiattack',
        combatId,
      }).prepared,
      prepareHostAttack({
        slug: 'doppelganger',
        actionId: 'multiattack',
        combatId,
        targetState: {
          surprisedCombatId: combatId,
          surpriseResolvedCombatId: combatId,
        },
      }).prepared,
    ]) {
      expect(prepared.attacks.map(({ attack }) => attack.damage.length))
        .toEqual([baseDamageCount, baseDamageCount])
      expect(prepared.attackModes).toEqual(['normal', 'normal'])
    }
  })
})

describe('Berserker and Minotaur Reckless lifecycle', () => {
  it.each(['berserker', 'minotaur'])(
    'activates %s at turn start and grants outgoing and incoming advantage',
    (slug) => {
      const combatId = `reckless-${slug}`
      const reckless = catalogCombatant(slug, 20, 'reckless')
      const enemy = catalogCombatant('goblin', 10, 'enemy', {
        currentHp: 100,
        maxHp: 100,
        armorClass: 10,
      })
      const state = startDnd5eHeadlessCombat(combatId, [reckless, enemy])
      state.initiativeSlotIds = ['reckless-slot', 'enemy-slot']
      state.turnSlotId = 'reckless-slot'

      const begun = expectSuccess(resolveDnd5eHeadlessAction(state, {
        type: 'begin-turn',
        actorId: reckless.id,
        turnSlotId: 'reckless-slot',
      }))
      expect(begun.state.combatants.reckless.classState.recklessAttackTurnKey)
        .toBe(`${combatId}:1:reckless-slot`)
      expect(begun.events).toContainEqual({
        type: 'monster-reckless-activated',
        actorId: reckless.id,
      })

      const recklessWeapon = meleeWeaponAction(slug)
      const outgoing = expectSuccess(resolveDnd5eHeadlessAction(begun.state, {
        type: 'monster-action',
        actorId: reckless.id,
        actionId: recklessWeapon.action.id,
        rolls: [{
          targetId: enemy.id,
          d20: 1,
          d20Second: 10,
          damageRolls: damageRolls(recklessWeapon.attack),
        }],
      }))
      expect(outgoing.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        actorId: reckless.id,
        targetId: enemy.id,
        d20: 10,
        hit: true,
      }))

      const enemyTurn = expectSuccess(resolveDnd5eHeadlessAction(outgoing.state, {
        type: 'end-turn',
        actorId: reckless.id,
      }))
      expect(enemyTurn.state.combatants.reckless.classState.recklessAttackTurnKey)
        .toBe(`${combatId}:1:reckless-slot`)

      const goblinWeapon = meleeWeaponAction('goblin', 'scimitar')
      const incoming = expectSuccess(resolveDnd5eHeadlessAction(enemyTurn.state, {
        type: 'monster-action',
        actorId: enemy.id,
        actionId: goblinWeapon.action.id,
        rolls: [{
          targetId: reckless.id,
          d20: 1,
          d20Second: 10,
          damageRolls: damageRolls(goblinWeapon.attack),
        }],
      }))
      expect(incoming.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        actorId: enemy.id,
        targetId: reckless.id,
        d20: 10,
        hit: true,
      }))

      const nextRound = expectSuccess(resolveDnd5eHeadlessAction(incoming.state, {
        type: 'end-turn',
        actorId: enemy.id,
      }))
      expect(nextRound.state.round).toBe(2)
      expect(nextRound.state.combatants.reckless.classState.recklessAttackTurnKey)
        .toBe(`${combatId}:2:reckless-slot`)
      expect(nextRound.events).toContainEqual({
        type: 'monster-reckless-activated',
        actorId: reckless.id,
      })
    },
  )

  it('clears stale Reckless vulnerability and does not reactivate while incapacitated', () => {
    const actor = catalogCombatant('berserker', 20, 'reckless', {
      classState: {
        recklessAttackTurnKey: 'previous-turn',
        stunnedByActorId: 'enemy',
      },
    })
    const state = startDnd5eHeadlessCombat('incapacitated-reckless', [
      actor,
      combatant('enemy', 10),
    ])
    const begun = expectSuccess(resolveDnd5eHeadlessAction(state, {
      type: 'begin-turn',
      actorId: actor.id,
    }))
    expect(begun.state.combatants.reckless.classState.recklessAttackTurnKey)
      .toBeUndefined()
    expect(begun.events).not.toContainEqual(expect.objectContaining({
      type: 'monster-reckless-activated',
    }))
  })

  it('uses a stable initiative slot id when Host preparation validates active Reckless', () => {
    const combatId = 'host-stable-reckless'
    const actorSlotId = 'berserker-normal-slot'
    const { action } = meleeWeaponAction('berserker')
    const { prepared } = prepareHostAttack({
      slug: 'berserker',
      actionId: action.id,
      combatId,
      actorSlotId,
      actorState: {
        recklessAttackTurnKey: `${combatId}:1:${actorSlotId}`,
      },
    })
    expect(prepared.attackModes).toEqual(['advantage'])
  })
})
