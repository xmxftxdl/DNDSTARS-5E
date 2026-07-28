import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { validateDnd5eMonsterSchema } from './monsterSchema'
import { getDnd5eSrdMonster } from './monsters'

const ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

const RELENTLESS_MONSTERS = [
  { slug: 'boar', maximumDamage: 7 },
  { slug: 'giant-boar', maximumDamage: 10 },
  { slug: 'wereboar-boar', maximumDamage: 14 },
  { slug: 'wereboar-human', maximumDamage: 14 },
  { slug: 'wereboar-hybrid', maximumDamage: 14 },
] as const

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
    abilities: ABILITIES,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function relentlessMonster(
  slug: typeof RELENTLESS_MONSTERS[number]['slug'],
  currentHp: number,
  patch: Partial<Parameters<typeof createDnd5eCombatant>[0]> = {},
) {
  const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
  if (!monster) throw new Error(`Missing SRD monster ${slug}`)
  return combatant(slug, 10, {
    controller: 'dm',
    statBlockId: monster.id,
    armorClass: monster.armorClass.value,
    abilities: monster.abilities,
    currentHp,
    maxHp: monster.hitPoints.average,
    usesDeathSaves: false,
    ...patch,
  })
}

function fireAttack(
  slug: typeof RELENTLESS_MONSTERS[number]['slug'],
  targetHp: number,
  damage: number,
  targetPatch: Partial<Parameters<typeof createDnd5eCombatant>[0]> = {},
) {
  const attacker = combatant('attacker', 20)
  const target = relentlessMonster(slug, targetHp, targetPatch)
  const result = resolveDnd5eHeadlessAction(
    startDnd5eHeadlessCombat(`relentless:${slug}:${targetHp}:${damage}`, [attacker, target]),
    {
      type: 'attack',
      actorId: attacker.id,
      targetId: target.id,
      attackModifier: 20,
      d20: 10,
      damage: {
        count: 1,
        sides: 20,
        bonus: 0,
        rolls: [damage],
        type: 'fire',
      },
    },
  )
  return { result, target }
}

describe('SRD monster Relentless', () => {
  it.each(RELENTLESS_MONSTERS)(
    'structures $slug with its canonical $maximumDamage damage threshold',
    ({ slug, maximumDamage }) => {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
      expect(monster?.traits.find((trait) => trait.rule?.kind === 'relentless')).toMatchObject({
        automation: 'headless',
        rule: {
          kind: 'relentless',
          maximumDamage,
        },
      })
    },
  )

  it('strictly rejects invalid thresholds and unsupported Relentless fields', () => {
    const source = getDnd5eSrdMonster('srd-5.1:boar')!
    for (const mutate of [
      (rule: Record<string, unknown>) => {
        rule.maximumDamage = 0
      },
      (rule: Record<string, unknown>) => {
        rule.maximumDamage = 7.5
      },
      (rule: Record<string, unknown>) => {
        rule.unexpected = true
      },
    ]) {
      const monster = structuredClone(source)
      const trait = monster.traits.find((entry) => entry.rule?.kind === 'relentless')!
      mutate(trait.rule as unknown as Record<string, unknown>)
      expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
        monsterId: monster.id,
        code: 'invalid-stat-block',
      }))
    }
  })

  it.each(RELENTLESS_MONSTERS)(
    'keeps $slug at 1 HP when one damage instance is at the threshold',
    ({ slug, maximumDamage }) => {
      const { result, target } = fireAttack(slug, maximumDamage, maximumDamage)

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id]).toMatchObject({
        currentHp: 1,
        deathSaves: { dead: false },
      })
      expect(result.events).toContainEqual({
        type: 'monster-relentless-triggered',
        actorId: target.id,
        damage: maximumDamage,
        maximumDamage,
      })
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'damage-applied',
        targetId: target.id,
        amount: maximumDamage,
        hpBefore: maximumDamage,
        hpAfter: 1,
      }))
    },
  )

  it.each(RELENTLESS_MONSTERS)(
    'does not protect $slug from one damage instance above the threshold',
    ({ slug, maximumDamage }) => {
      const lethalDamage = maximumDamage + 1
      const { result, target } = fireAttack(slug, lethalDamage, lethalDamage)

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id]).toMatchObject({
        currentHp: 0,
        deathSaves: { dead: true },
      })
      expect(result.events.some((event) =>
        event.type === 'monster-relentless-triggered' && event.actorId === target.id)).toBe(false)
    },
  )

  it('is unlimited and can trigger for both hits of one Multiattack', () => {
    const attacker = combatant('owlbear', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:owlbear',
      armorClass: 13,
      currentHp: 59,
      maxHp: 59,
    })
    const target = relentlessMonster('boar', 6, {
      controller: 'player',
      armorClass: 1,
      position: { x: 5, y: 0 },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('relentless:unlimited', [attacker, target]),
      {
        type: 'monster-action',
        actorId: attacker.id,
        actionId: 'multiattack',
        rolls: [
          { targetId: target.id, d20: 10, damageRolls: [[1]] },
          { targetId: target.id, d20: 10, damageRolls: [[1, 1]] },
        ],
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(1)
    expect(result.events.filter((event) =>
      event.type === 'monster-relentless-triggered' && event.actorId === target.id)).toEqual([
      {
        type: 'monster-relentless-triggered',
        actorId: target.id,
        damage: 6,
        maximumDamage: 7,
      },
      {
        type: 'monster-relentless-triggered',
        actorId: target.id,
        damage: 7,
        maximumDamage: 7,
      },
    ])
  })

  it('compares the full adjusted damage instance, not only damage left after temporary HP', () => {
    const { result, target } = fireAttack('boar', 6, 8, { temporaryHp: 2 })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id]).toMatchObject({
      currentHp: 0,
      temporaryHp: 0,
      deathSaves: { dead: true },
    })
    expect(result.events.some((event) => event.type === 'monster-relentless-triggered')).toBe(false)
  })

  it('never triggers from an already-zero target', () => {
    const { result, target } = fireAttack('boar', 0, 7, { usesDeathSaves: true })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(0)
    expect(result.state.combatants[target.id].deathSaves.failures).toBe(1)
    expect(result.events.some((event) => event.type === 'monster-relentless-triggered')).toBe(false)
  })
})
