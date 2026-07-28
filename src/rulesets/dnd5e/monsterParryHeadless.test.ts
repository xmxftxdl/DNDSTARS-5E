import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eAction,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { createDnd5eConditionEffect } from './activeEffects'
import { getDnd5eSrdMonster } from './monsters'
import {
  DND5E_SRD_COMBAT_SPELLS,
  dnd5eSpellAttackDelivery,
} from './spells'

const ABILITIES = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

const PARRY_MONSTERS = [
  { slug: 'bandit-captain', armorClassBonus: 2 },
  { slug: 'erinyes', armorClassBonus: 4 },
  { slug: 'gladiator', armorClassBonus: 3 },
  { slug: 'knight', armorClassBonus: 2 },
  { slug: 'marilith', armorClassBonus: 5 },
  { slug: 'noble', armorClassBonus: 2 },
] as const

type ParryMonsterSlug = typeof PARRY_MONSTERS[number]['slug']

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Parameters<typeof createDnd5eCombatant>[0]> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities: ABILITIES,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 30,
    maxHp: 30,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function parryMonster(
  slug: ParryMonsterSlug,
  initiative = 10,
  id: string = slug,
): Dnd5eCombatant {
  const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
  if (!monster) throw new Error(`Missing SRD monster ${slug}`)
  return combatant(id, initiative, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    abilities: monster.abilities,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    position: { x: 5, y: 0 },
  })
}

function weaponAttack(input: {
  actorId: string
  targetId: string
  total: number
  mode?: 'melee' | 'ranged'
  critical?: boolean
  spendAction?: boolean
}): Extract<Dnd5eAction, { type: 'attack' }> {
  const d20 = input.critical ? 20 : 10
  const mode = input.mode ?? 'melee'
  return {
    type: 'attack',
    actorId: input.actorId,
    targetId: input.targetId,
    attackModifier: input.total - d20,
    d20,
    d20Second: d20,
    spendAction: input.spendAction,
    damage: {
      count: 1,
      sides: 8,
      bonus: 0,
      rolls: input.critical ? [1, 1] : [1],
      type: 'slashing',
    },
    classDamageContext: {
      weaponId: 'test-longsword',
      mode,
      reachFeet: mode === 'melee' ? 5 : undefined,
      distanceFeet: mode === 'melee' ? 5 : 30,
      normalRangeFeet: mode === 'ranged' ? 80 : undefined,
      longRangeFeet: mode === 'ranged' ? 320 : undefined,
      finesse: false,
      strengthBased: true,
      weaponDamageSides: 8,
      damageType: 'slashing',
      adjacentEnemyOfTarget: false,
    },
  }
}

function parryFixture(
  slug: ParryMonsterSlug,
  input: {
    total?: number
    mode?: 'melee' | 'ranged'
    critical?: boolean
    targetHasReaction?: boolean
    invisibleAttacker?: boolean
  } = {},
) {
  const attacker = combatant('attacker', 20)
  const target = parryMonster(slug)
  const state = startDnd5eHeadlessCombat(`monster-parry:${slug}`, [attacker, target])
  if (input.invisibleAttacker) {
    state.combatants[attacker.id].classState.activeEffects = [
      createDnd5eConditionEffect({
        id: 'test-invisible-attacker',
        targetId: attacker.id,
        condition: 'invisible',
        source: { kind: 'feature', actorId: attacker.id },
        duration: { type: 'permanent' },
      }),
    ]
    state.combatants[attacker.id].conditions = ['invisible']
  }
  if (input.targetHasReaction === false) {
    state.combatants[target.id].turn.reactionAvailable = false
  }
  const result = resolveDnd5eHeadlessAction(
    state,
    weaponAttack({
      actorId: attacker.id,
      targetId: target.id,
      total: input.total ?? target.armorClass,
      mode: input.mode,
      critical: input.critical,
    }),
  )
  return { attacker, target, result }
}

function parryEvents(
  events: readonly { type: string; actorId?: string }[],
  targetId: string,
) {
  return events.filter((event) =>
    event.type === 'monster-parry-used' && event.actorId === targetId)
}

function expectSuccessfulAttack(
  result: ReturnType<typeof resolveDnd5eHeadlessAction>,
): asserts result is Extract<typeof result, { ok: true }> {
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) throw new Error(result.reason)
}

describe('SRD monster Parry in Headless combat', () => {
  it.each(PARRY_MONSTERS)(
    'applies the exact +$armorClassBonus AC reaction for $slug',
    ({ slug, armorClassBonus }) => {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
      const reaction = monster?.reactions?.find((candidate) => candidate.id === 'parry')
      expect(reaction).toMatchObject({
        automation: 'headless',
        rule: {
          kind: 'parry',
          armorClassBonus,
          requiresSight: true,
          requiresWieldedMeleeWeapon: true,
        },
      })

      const { result, target } = parryFixture(slug)
      expectSuccessfulAttack(result)

      expect(result.events).toContainEqual({
        type: 'monster-parry-used',
        actorId: target.id,
        attackerId: 'attacker',
        armorClassBonus,
        armorClass: target.armorClass + armorClassBonus,
      })
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        targetId: target.id,
        total: target.armorClass,
        armorClass: target.armorClass + armorClassBonus,
        hit: false,
        critical: false,
      }))
      expect(result.events).toContainEqual({
        type: 'turn-resource-spent',
        actorId: target.id,
        resource: 'reaction',
      })
      expect(result.state.combatants[target.id]).toMatchObject({
        currentHp: target.currentHp,
        turn: { reactionAvailable: false },
      })
      expect(result.events.some((event) =>
        event.type === 'damage-applied' && event.targetId === target.id)).toBe(false)
    },
  )

  it('keeps a roll equal to the raised AC as a hit without wasting the reaction', () => {
    const target = parryMonster('bandit-captain')
    const bonus = PARRY_MONSTERS.find(({ slug }) => slug === 'bandit-captain')!.armorClassBonus
    const { result } = parryFixture('bandit-captain', {
      total: target.armorClass + bonus,
    })
    expectSuccessfulAttack(result)

    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      targetId: target.id,
      total: target.armorClass + bonus,
      hit: true,
      critical: false,
    }))
    expect(parryEvents(result.events, target.id)).toHaveLength(0)
    expect(result.state.combatants[target.id]).toMatchObject({
      currentHp: target.currentHp - 1,
      turn: { reactionAvailable: true },
    })
  })

  it.each([
    { label: 'critical hit', critical: true },
    { label: 'ranged attack', mode: 'ranged' as const },
    { label: 'invisible attacker', invisibleAttacker: true },
    { label: 'no available reaction', targetHasReaction: false },
  ])('does not trigger against a $label', (testCase) => {
    const { result, target } = parryFixture('bandit-captain', {
      total: testCase.critical ? 20 : undefined,
      mode: testCase.mode,
      critical: testCase.critical,
      invisibleAttacker: testCase.invisibleAttacker,
      targetHasReaction: testCase.targetHasReaction,
    })
    expectSuccessfulAttack(result)

    expect(parryEvents(result.events, target.id)).toHaveLength(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      targetId: target.id,
      hit: true,
      critical: testCase.critical ?? false,
    }))
    expect(result.state.combatants[target.id].currentHp).toBe(
      target.currentHp - (testCase.critical ? 2 : 1),
    )
    expect(result.state.combatants[target.id].turn.reactionAvailable).toBe(
      testCase.targetHasReaction === false ? false : true,
    )
  })

  it('lets Marilith use Reactive once on each different creature turn', () => {
    const firstAttacker = combatant('first-attacker', 30)
    const secondAttacker = combatant('second-attacker', 20)
    const marilith = parryMonster('marilith', 10)
    const state = startDnd5eHeadlessCombat(
      'monster-parry:marilith-reactive',
      [firstAttacker, secondAttacker, marilith],
    )

    const first = resolveDnd5eHeadlessAction(
      state,
      weaponAttack({
        actorId: firstAttacker.id,
        targetId: marilith.id,
        total: marilith.armorClass,
      }),
    )
    expectSuccessfulAttack(first)
    expect(parryEvents(first.events, marilith.id)).toHaveLength(1)
    expect(first.state.combatants[marilith.id].turn.reactionAvailable).toBe(false)

    const advanced = resolveDnd5eHeadlessAction(first.state, {
      type: 'end-turn',
      actorId: firstAttacker.id,
    })
    expectSuccessfulAttack(advanced)
    expect(advanced.state.combatants[marilith.id].turn.reactionAvailable).toBe(true)
    expect(advanced.events).toContainEqual(expect.objectContaining({
      type: 'monster-reactive-refreshed',
      actorId: marilith.id,
    }))

    const second = resolveDnd5eHeadlessAction(
      advanced.state,
      weaponAttack({
        actorId: secondAttacker.id,
        targetId: marilith.id,
        total: marilith.armorClass,
      }),
    )
    expectSuccessfulAttack(second)
    expect(parryEvents(second.events, marilith.id)).toHaveLength(1)
    expect(second.state.combatants[marilith.id]).toMatchObject({
      currentHp: marilith.currentHp,
      turn: { reactionAvailable: false },
    })
  })

  it('distinguishes melee spell attacks from short-ranged and entity-origin spells', () => {
    for (const spell of DND5E_SRD_COMBAT_SPELLS.filter(
      (candidate) => candidate.effect === 'spell-attack',
    )) {
      expect(dnd5eSpellAttackDelivery(spell), spell.id).toMatch(/^(?:melee|ranged)$/)
    }
    for (const spell of DND5E_SRD_COMBAT_SPELLS.filter(
      (candidate) =>
        candidate.sustainedAttack &&
        candidate.sustainedAttack.resolution !== 'saving-throw' &&
        candidate.sustainedAttack.id !== 'call-lightning',
    )) {
      expect(
        dnd5eSpellAttackDelivery(spell, spell.sustainedAttack),
        spell.id,
      ).toMatch(/^(?:melee|ranged)$/)
    }
    expect(dnd5eSpellAttackDelivery(
      DND5E_SRD_COMBAT_SPELLS.find((spell) => spell.id === 'spiritual-weapon')!,
    )).toBe('melee')
    expect(dnd5eSpellAttackDelivery(
      DND5E_SRD_COMBAT_SPELLS.find((spell) => spell.id === 'guiding-bolt')!,
    )).toBe('ranged')
  })

  it('parries a melee spell attack and ignores damage dice prepared before the reaction', () => {
    const caster = combatant('cleric', 20, {
      classId: 'cleric',
      level: 1,
      abilities: { ...ABILITIES, wis: 18 },
      classSelections: { 'spell-prepared': ['inflict-wounds'] },
      classResources: {
        'dnd5e-spell-slot-1': { current: 1, max: 1 },
      },
    })
    const target = parryMonster('noble')
    const state = startDnd5eHeadlessCombat('monster-parry:melee-spell', [
      caster,
      target,
    ])
    const attackModifier = caster.proficiencyBonus +
      Math.floor((caster.abilities.wis - 10) / 2)
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell',
      actorId: caster.id,
      targetId: target.id,
      spellId: 'inflict-wounds',
      slotLevel: 1,
      d20: target.armorClass - attackModifier,
      effectRolls: [1, 1, 1],
    })
    expectSuccessfulAttack(result)
    expect(parryEvents(result.events, target.id)).toHaveLength(1)
    expect(result.state.combatants[target.id].currentHp).toBe(target.currentHp)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      targetId: target.id,
      armorClass: target.armorClass + 2,
      hit: false,
    }))
  })
})
