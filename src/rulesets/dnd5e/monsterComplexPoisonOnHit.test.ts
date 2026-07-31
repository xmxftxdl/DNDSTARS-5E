import { describe, expect, it } from 'vitest'
import {
  createDnd5eMechanicalEffect,
  removeDnd5eActiveEffectById,
} from './activeEffects'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { getDnd5eSrdMonster } from './monsters'

const abilities = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 } as const

function combatant(id: string, initiative: number, patch = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 1,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function catalogMonster(slug: string, initiative = 20, id = slug) {
  const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
  if (!monster) throw new Error(`missing SRD monster ${slug}`)
  return combatant(id, initiative, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    armorClass: monster.armorClass.value,
    abilities: monster.abilities,
  })
}

const zeroHpPoisonCases = [
  {
    slug: 'giant-centipede',
    actionId: 'bite',
    baseRolls: [1],
    baseDamage: 3,
    effectRolls: [2, 2, 2],
    effectDamage: 6,
    successfulSaveDamage: 0,
  },
  {
    slug: 'giant-spider',
    actionId: 'bite',
    baseRolls: [1],
    baseDamage: 4,
    effectRolls: [2, 2],
    effectDamage: 4,
    successfulSaveDamage: 2,
  },
  {
    slug: 'giant-wasp',
    actionId: 'sting',
    baseRolls: [1],
    baseDamage: 3,
    effectRolls: [2, 2, 2],
    effectDamage: 6,
    successfulSaveDamage: 3,
  },
  {
    slug: 'giant-wolf-spider',
    actionId: 'bite',
    baseRolls: [1],
    baseDamage: 2,
    effectRolls: [2, 2],
    effectDamage: 4,
    successfulSaveDamage: 2,
  },
  {
    slug: 'phase-spider',
    actionId: 'bite',
    baseRolls: [1],
    baseDamage: 3,
    effectRolls: [2, 2, 2, 2],
    effectDamage: 8,
    successfulSaveDamage: 4,
  },
] as const

function monsterPoisonAttack(input: {
  slug: string
  actionId: string
  baseRolls: readonly number[]
  effectRolls: readonly number[]
  saveD20: number
  targetHp?: number
  targetPatch?: object
  additionalCombatants?: ReturnType<typeof combatant>[]
}) {
  const attacker = catalogMonster(input.slug)
  const targetHp = input.targetHp ?? 100
  const target = combatant('target', 10, {
    currentHp: targetHp,
    maxHp: Math.max(20, targetHp),
    savingThrowBonuses: { con: 0 },
    ...input.targetPatch,
  })
  const result = resolveDnd5eHeadlessAction(
    startDnd5eHeadlessCombat(
      `complex-poison:${input.slug}`,
      [attacker, target, ...(input.additionalCombatants ?? [])],
    ),
    {
      type: 'monster-action',
      actorId: attacker.id,
      actionId: input.actionId,
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: [input.baseRolls],
        onHitEffectRolls: [{
          effectId: 'poison-save-damage',
          d20: input.saveD20,
          damageRolls: [input.effectRolls],
        }],
      }],
    },
  )
  return { attacker, target, result }
}

describe('complex catalog poison weapon riders', () => {
  it.each(zeroHpPoisonCases)(
    'stabilizes and paralyzes a target only when $slug effect damage is necessary to cross zero',
    (testCase) => {
      const targetHp = testCase.baseDamage + testCase.effectDamage
      const { result, target } = monsterPoisonAttack({
        ...testCase,
        saveD20: 1,
        targetHp,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id]).toMatchObject({
        currentHp: 0,
        deathSaves: {
          successes: 0,
          failures: 0,
          stable: true,
          dead: false,
        },
      })
      expect(result.state.combatants[target.id].conditions).toEqual(
        expect.arrayContaining(['poisoned', 'paralyzed']),
      )
      expect(result.state.combatants[target.id].classState.activeEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            standardCondition: 'poisoned',
            duration: expect.objectContaining({
              type: 'rounds',
              remainingRounds: 600,
            }),
          }),
          expect.objectContaining({
            standardCondition: 'paralyzed',
            duration: expect.objectContaining({
              type: 'rounds',
              remainingRounds: 600,
            }),
            dependsOnEffectId: expect.any(String),
          }),
        ]),
      )
    },
  )

  it.each(zeroHpPoisonCases)(
    'uses the catalog success outcome for $slug without applying its zero-HP conditions',
    (testCase) => {
      const { result, target } = monsterPoisonAttack({
        ...testCase,
        saveD20: 20,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id].currentHp).toBe(
        100 - testCase.baseDamage - testCase.successfulSaveDamage,
      )
      expect(result.state.combatants[target.id].conditions).not.toEqual(
        expect.arrayContaining(['poisoned', 'paralyzed']),
      )
    },
  )

  it('does not apply the Giant Spider zero-HP conditions after nonlethal failed-save poison', () => {
    const testCase = zeroHpPoisonCases.find((entry) => entry.slug === 'giant-spider')!
    const { result, target } = monsterPoisonAttack({
      ...testCase,
      saveD20: 1,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(
      100 - testCase.baseDamage - testCase.effectDamage,
    )
    expect(result.state.combatants[target.id].conditions).not.toEqual(
      expect.arrayContaining(['poisoned', 'paralyzed']),
    )
  })

  it('stabilizes instead of applying instant death when lethal poison exceeds maximum HP', () => {
    const testCase = zeroHpPoisonCases.find((entry) => entry.slug === 'giant-centipede')!
    const { result, target } = monsterPoisonAttack({
      ...testCase,
      effectRolls: [6, 6, 6],
      saveD20: 1,
      targetHp: 4,
      targetPatch: { maxHp: 4 },
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id]).toMatchObject({
      currentHp: 0,
      deathSaves: {
        successes: 0,
        failures: 0,
        stable: true,
        dead: false,
      },
    })
    expect(result.events.some((event) => event.type === 'instant-death')).toBe(false)
  })

  it('does not use the special outcome when piercing damage alone was sufficient to reach zero', () => {
    const testCase = zeroHpPoisonCases.find((entry) => entry.slug === 'giant-spider')!
    const { result, target } = monsterPoisonAttack({
      ...testCase,
      baseRolls: [8],
      saveD20: 1,
      targetHp: 11,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id]).toMatchObject({
      currentHp: 0,
      deathSaves: {
        stable: false,
        dead: false,
      },
    })
    expect(result.state.combatants[target.id].conditions).not.toEqual(
      expect.arrayContaining(['poisoned', 'paralyzed']),
    )
  })

  it('does not use the special outcome when poison immunity removes the crossing damage', () => {
    const testCase = zeroHpPoisonCases.find((entry) => entry.slug === 'giant-spider')!
    const { result, target } = monsterPoisonAttack({
      ...testCase,
      saveD20: 1,
      targetHp: testCase.baseDamage + testCase.effectDamage,
      targetPatch: {
        damageImmunities: ['poison'],
      },
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(testCase.effectDamage)
    expect(result.state.combatants[target.id].conditions).not.toEqual(
      expect.arrayContaining(['poisoned', 'paralyzed']),
    )
  })

  it('keeps the target stable but rejects both linked conditions when poisoned is immune', () => {
    const testCase = zeroHpPoisonCases.find((entry) => entry.slug === 'giant-spider')!
    const { result, target } = monsterPoisonAttack({
      ...testCase,
      saveD20: 1,
      targetHp: testCase.baseDamage + testCase.effectDamage,
      targetPatch: {
        conditionImmunities: ['poisoned'],
      },
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id]).toMatchObject({
      currentHp: 0,
      deathSaves: { stable: true, dead: false },
    })
    expect(result.state.combatants[target.id].conditions).not.toEqual(
      expect.arrayContaining(['poisoned', 'paralyzed']),
    )
  })

  it('removes linked paralysis when the source-specific poisoned effect is cured', () => {
    const paladin = combatant('paladin', 5, {
      classId: 'paladin',
      level: 5,
      classResources: {
        'dnd5e-lay-on-hands': { current: 5, max: 25 },
      },
    })
    const testCase = zeroHpPoisonCases.find((entry) => entry.slug === 'giant-spider')!
    const { result, target } = monsterPoisonAttack({
      ...testCase,
      saveD20: 1,
      targetHp: testCase.baseDamage + testCase.effectDamage,
      additionalCombatants: [paladin],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    const poisonedEffect = result.state.combatants[target.id].classState.activeEffects?.find(
      (effect) => effect.standardCondition === 'poisoned',
    )
    const paralyzedEffect = result.state.combatants[target.id].classState.activeEffects?.find(
      (effect) => effect.standardCondition === 'paralyzed',
    )
    expect(poisonedEffect).toBeDefined()
    expect(paralyzedEffect?.dependsOnEffectId).toBe(poisonedEffect?.id)

    result.state.combatants[target.id].currentHp = 1
    result.state.initiativeIndex = result.state.initiativeOrder.indexOf(paladin.id)
    result.state.combatants[paladin.id].turn.actionAvailable = true
    const cured = resolveDnd5eHeadlessAction(result.state, {
      type: 'paladin-lay-on-hands',
      actorId: paladin.id,
      targetId: target.id,
      cure: 'poisoned',
    })

    expect(cured.ok, cured.ok ? undefined : cured.reason).toBe(true)
    if (!cured.ok) return
    expect(cured.state.combatants[target.id].conditions).not.toEqual(
      expect.arrayContaining(['poisoned', 'paralyzed']),
    )
  })

  it('does not apply the zero-HP rider when Death Ward keeps the target at one hit point', () => {
    const testCase = zeroHpPoisonCases.find((entry) => entry.slug === 'giant-spider')!
    const deathWard = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:death-ward',
      label: 'Death Ward',
      kind: 'buff',
      source: {
        kind: 'spell',
        actorId: 'cleric',
        rulesId: 'death-ward',
        spellLevel: 4,
      },
      targetId: 'target',
      duration: {
        type: 'rounds',
        remainingRounds: 4800,
        tickOn: 'target-turn-end',
      },
    })
    const { result, target } = monsterPoisonAttack({
      ...testCase,
      saveD20: 1,
      targetHp: testCase.baseDamage + testCase.effectDamage,
      targetPatch: {
        classState: {
          activeEffects: [deathWard],
        },
      },
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(1)
    expect(result.events).toContainEqual({
      type: 'death-ward-triggered',
      targetId: target.id,
      trigger: 'damage',
    })
    expect(result.state.combatants[target.id].conditions).not.toEqual(
      expect.arrayContaining(['poisoned', 'paralyzed']),
    )
  })

  it.each([
    { d20: 20, succeeds: true },
    { d20: 1, succeeds: false },
  ])(
    'lets Relentless Rage resolve before the stable poison outcome (success=$succeeds)',
    ({ d20, succeeds }) => {
      const testCase = zeroHpPoisonCases.find((entry) => entry.slug === 'giant-centipede')!
      const { result, target } = monsterPoisonAttack({
        ...testCase,
        saveD20: 1,
        targetHp: Math.floor(testCase.baseDamage / 2) + testCase.effectDamage,
        targetPatch: {
          classId: 'barbarian',
          level: 11,
          classState: {
            raging: true,
            rageTurnsRemaining: 10,
          },
          savingThrowBonuses: { con: 2 },
        },
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.events).toContainEqual({
        type: 'relentless-rage-save-required',
        targetId: target.id,
        dc: 10,
      })
      expect(result.state.combatants[target.id]).toMatchObject({
        currentHp: 0,
        deathSaves: { stable: true, dead: false },
      })
      expect(result.state.combatants[target.id].conditions).toEqual(
        expect.arrayContaining(['poisoned', 'paralyzed']),
      )

      const resolved = resolveDnd5eHeadlessAction(result.state, {
        type: 'barbarian-relentless-rage-save',
        actorId: target.id,
        d20,
        dc: 10,
      })

      expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
      if (!resolved.ok) return
      expect(resolved.state.combatants[target.id]).toMatchObject({
        currentHp: succeeds ? 1 : 0,
        deathSaves: {
          stable: !succeeds,
          dead: false,
        },
      })
      expect(resolved.state.combatants[target.id].conditions).toEqual(
        expect.arrayContaining(['poisoned', 'paralyzed']),
      )
      if (succeeds) {
        expect(resolved.state.combatants[target.id].conditions).not.toContain('unconscious')
        expect(resolved.state.combatants[target.id].classState.raging).toBe(true)
      } else {
        expect(resolved.state.combatants[target.id].conditions).toContain('unconscious')
        expect(resolved.state.combatants[target.id].classState.raging).toBeUndefined()
      }
    },
  )

  it('keeps zero-HP poison dependencies isolated between two spiders of the same stat block', () => {
    const firstSpider = catalogMonster('giant-spider', 30, 'spider-a')
    const secondSpider = catalogMonster('giant-spider', 20, 'spider-b')
    const target = combatant('target', 10, {
      currentHp: 8,
      maxHp: 20,
      savingThrowBonuses: { con: 0 },
    })
    const first = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('complex-poison:source-links', [
        firstSpider,
        secondSpider,
        target,
      ]),
      {
        type: 'monster-action',
        actorId: firstSpider.id,
        actionId: 'bite',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1]],
          onHitEffectRolls: [{
            effectId: 'poison-save-damage',
            d20: 1,
            damageRolls: [[2, 2]],
          }],
        }],
      },
    )
    expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
    if (!first.ok) return

    const recoveredTarget = first.state.combatants[target.id]
    recoveredTarget.currentHp = 8
    recoveredTarget.deathSaves = { successes: 0, failures: 0, stable: false, dead: false }
    recoveredTarget.classState.activeEffects = recoveredTarget.classState.activeEffects?.filter(
      (effect) => effect.source.rulesId !== 'zero-hit-points',
    )
    recoveredTarget.conditions = recoveredTarget.conditions.filter(
      (condition) => condition !== 'unconscious' && condition !== 'prone',
    )
    first.state.initiativeIndex = first.state.initiativeOrder.indexOf(secondSpider.id)
    first.state.combatants[secondSpider.id].turn.actionAvailable = true

    const second = resolveDnd5eHeadlessAction(first.state, {
      type: 'monster-action',
      actorId: secondSpider.id,
      actionId: 'bite',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: [[1]],
        onHitEffectRolls: [{
          effectId: 'poison-save-damage',
          d20: 1,
          damageRolls: [[2, 2]],
        }],
      }],
    })
    expect(second.ok, second.ok ? undefined : second.reason).toBe(true)
    if (!second.ok) return

    const sourceEffects = second.state.combatants[target.id].classState.activeEffects?.filter(
      (effect) => effect.source.rulesId?.includes(':bite:poison-save-damage:zero') === true,
    ) ?? []
    const poisonedBySource = new Map(sourceEffects
      .filter((effect) => effect.standardCondition === 'poisoned')
      .map((effect) => [effect.source.actorId, effect]))
    const paralyzedBySource = new Map(sourceEffects
      .filter((effect) => effect.standardCondition === 'paralyzed')
      .map((effect) => [effect.source.actorId, effect]))
    expect([...poisonedBySource.keys()].sort()).toEqual(['spider-a', 'spider-b'])
    expect([...paralyzedBySource.keys()].sort()).toEqual(['spider-a', 'spider-b'])
    for (const sourceId of poisonedBySource.keys()) {
      expect(paralyzedBySource.get(sourceId)?.dependsOnEffectId)
        .toBe(poisonedBySource.get(sourceId)?.id)
    }

    const firstPoison = poisonedBySource.get(firstSpider.id)
    expect(firstPoison).toBeDefined()
    if (!firstPoison) return
    const removed = removeDnd5eActiveEffectById({
      effects: sourceEffects,
      id: firstPoison.id,
    })
    expect(removed.effects.filter((effect) => effect.source.actorId === firstSpider.id)).toHaveLength(0)
    expect(removed.effects.filter((effect) => effect.source.actorId === secondSpider.id)).toHaveLength(2)
  })

  it('does not apply the zero-HP rider when poison only exhausts a Wild Shape pool', () => {
    const druid = combatant('target', 30, {
      classId: 'druid',
      level: 2,
      currentHp: 20,
      maxHp: 20,
      classResources: {
        'dnd5e-wild-shape': { current: 2, max: 2 },
      },
      classSelections: {
        'wild-shape-known-forms': ['srd-5.1:wolf'],
      },
    })
    const phaseSpider = catalogMonster('phase-spider', 20)
    const started = startDnd5eHeadlessCombat('complex-poison:wild-shape', [druid, phaseSpider])
    const transformed = resolveDnd5eHeadlessAction(started, {
      type: 'druid-wild-shape',
      actorId: druid.id,
      formId: 'srd-5.1:wolf',
    })
    expect(transformed.ok, transformed.ok ? undefined : transformed.reason).toBe(true)
    if (!transformed.ok) return
    const spiderTurn = resolveDnd5eHeadlessAction(transformed.state, {
      type: 'end-turn',
      actorId: druid.id,
    })
    expect(spiderTurn.ok, spiderTurn.ok ? undefined : spiderTurn.reason).toBe(true)
    if (!spiderTurn.ok) return

    const result = resolveDnd5eHeadlessAction(spiderTurn.state, {
      type: 'monster-action',
      actorId: phaseSpider.id,
      actionId: 'bite',
      rolls: [{
        targetId: druid.id,
        d20: 10,
        damageRolls: [[1]],
        onHitEffectRolls: [{
          effectId: 'poison-save-damage',
          d20: 1,
          damageRolls: [[2, 2, 2, 2]],
        }],
      }],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[druid.id]).toMatchObject({
      currentHp: 20,
      maxHp: 20,
      statBlockId: undefined,
      classState: { wildShapeFormId: undefined },
    })
    expect(result.state.combatants[druid.id].conditions).not.toEqual(
      expect.arrayContaining(['poisoned', 'paralyzed']),
    )
  })

  it('uses one Quasit save for poison damage and poisoned, then removes it on a successful end-turn save', () => {
    const { result, attacker, target } = monsterPoisonAttack({
      slug: 'quasit',
      actionId: 'claw-bite-in-beast-form',
      baseRolls: [1],
      effectRolls: [1, 1],
      saveD20: 1,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(94)
    expect(result.state.combatants[target.id].conditions).toContain('poisoned')
    const poison = result.state.combatants[target.id].classState.activeEffects?.find(
      (effect) => effect.standardCondition === 'poisoned' && effect.source.actorId === attacker.id,
    )
    expect(poison).toMatchObject({
      duration: {
        type: 'rounds',
        remainingRounds: 10,
        tickOn: 'target-turn-end',
      },
      repeatSave: {
        ability: 'con',
        dc: 10,
        timing: 'target-turn-end',
        onSuccess: 'remove',
      },
    })
    if (!poison) return

    const targetTurn = resolveDnd5eHeadlessAction(result.state, {
      type: 'end-turn',
      actorId: attacker.id,
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok) return
    const saved = resolveDnd5eHeadlessAction(targetTurn.state, {
      type: 'end-turn',
      actorId: target.id,
      activeEffectSavingThrows: [{
        effectId: poison.id,
        d20: 20,
      }],
    })

    expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
    if (!saved.ok) return
    expect(saved.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-resolved',
      targetId: target.id,
      effectId: poison.id,
      success: true,
    }))
    expect(saved.state.combatants[target.id].conditions).not.toContain('poisoned')
  })

  it('applies neither Quasit poison damage nor poisoned on a successful initial save', () => {
    const { result, target } = monsterPoisonAttack({
      slug: 'quasit',
      actionId: 'claw-bite-in-beast-form',
      baseRolls: [1],
      effectRolls: [4, 4],
      saveD20: 20,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(96)
    expect(result.state.combatants[target.id].conditions).not.toContain('poisoned')
  })

  it('honors both poison damage immunity and poisoned condition immunity for the Quasit rider', () => {
    const { result, target } = monsterPoisonAttack({
      slug: 'quasit',
      actionId: 'claw-bite-in-beast-form',
      baseRolls: [1],
      effectRolls: [4, 4],
      saveD20: 1,
      targetPatch: {
        damageImmunities: ['poison'],
        conditionImmunities: ['poisoned'],
      },
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(96)
    expect(result.state.combatants[target.id].conditions).not.toContain('poisoned')
  })
})
