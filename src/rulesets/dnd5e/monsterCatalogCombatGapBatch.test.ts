import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eSourceLinkedRelations,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eMonsterActionRoll,
} from './headlessCombatEngine'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterAction,
} from './monsters'

const abilities = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

function combatant(id: string, initiative: number, patch = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 1,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: id === 'target' ? 5 : 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function catalogAction(slug: string, actionId: string): Dnd5eMonsterAction {
  const action = getDnd5eSrdMonsterBySlug(slug)?.actions.find((candidate) =>
    candidate.id === actionId)
  if (!action) throw new Error(`Missing ${slug}/${actionId}`)
  return action
}

function catalogActor(slug: string) {
  const monster = getDnd5eSrdMonsterBySlug(slug)
  if (!monster) throw new Error(`Missing ${slug}`)
  return combatant(slug, 20, {
    controller: 'dm',
    statBlockId: monster.id,
    abilities: monster.abilities,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    sizeRank: 2,
  })
}

function resolveCatalogWeaponAttack(input: {
  slug: string
  actionId: string
  roll: Dnd5eMonsterActionRoll
  targetPatch?: object
}) {
  const actor = catalogActor(input.slug)
  const target = combatant('target', 10, {
    savingThrowBonuses: { con: 0 },
    sizeRank: 2,
    ...input.targetPatch,
  })
  return resolveDnd5eHeadlessAction(
    startDnd5eHeadlessCombat(`${input.slug}:${input.actionId}`, [actor, target]),
    {
      type: 'monster-action',
      actorId: actor.id,
      actionId: input.actionId,
      rolls: [input.roll],
    },
  )
}

const poisonDamageCases = [
  {
    slug: 'poisonous-snake',
    actionId: 'bite',
    damageRolls: [[]],
    baseDamage: 1,
    effectRolls: [4, 4],
    failedSaveDamage: 8,
    successfulSaveDamage: 4,
  },
  {
    slug: 'scorpion',
    actionId: 'sting',
    damageRolls: [[]],
    baseDamage: 1,
    effectRolls: [8],
    failedSaveDamage: 8,
    successfulSaveDamage: 4,
  },
  {
    slug: 'spider',
    actionId: 'bite',
    damageRolls: [[]],
    baseDamage: 1,
    effectRolls: [4],
    failedSaveDamage: 4,
    successfulSaveDamage: 0,
  },
  {
    slug: 'guardian-naga',
    actionId: 'spit-poison',
    damageRolls: [],
    baseDamage: 0,
    effectRolls: Array(10).fill(1),
    failedSaveDamage: 10,
    successfulSaveDamage: 5,
  },
] as const

describe('catalog combat-gap action batch', () => {
  it.each(poisonDamageCases)(
    'resolves $slug/$actionId failed-save poison through a Headless on-hit transaction',
    (testCase) => {
      const result = resolveCatalogWeaponAttack({
        ...testCase,
        roll: {
          targetId: 'target',
          d20: 10,
          damageRolls: testCase.damageRolls,
          onHitEffectRolls: [{
            effectId: 'poison-save-damage',
            d20: 1,
            damageRolls: [testCase.effectRolls],
          }],
        },
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants.target.currentHp).toBe(
        100 - testCase.baseDamage - testCase.failedSaveDamage,
      )
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved',
        targetId: 'target',
        ability: 'con',
        success: false,
      }))
    },
  )

  it.each(poisonDamageCases)(
    'uses the declared successful-save poison damage for $slug/$actionId',
    (testCase) => {
      const result = resolveCatalogWeaponAttack({
        ...testCase,
        roll: {
          targetId: 'target',
          d20: 10,
          damageRolls: testCase.damageRolls,
          onHitEffectRolls: [{
            effectId: 'poison-save-damage',
            d20: 20,
            damageRolls: [testCase.effectRolls],
          }],
        },
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants.target.currentHp).toBe(
        100 - testCase.baseDamage - testCase.successfulSaveDamage,
      )
    },
  )

  it('applies the Sprite Shortbow poison and margin-gated unconscious rider', () => {
    const deeplyFailed = resolveCatalogWeaponAttack({
      slug: 'sprite',
      actionId: 'shortbow',
      roll: {
        targetId: 'target',
        d20: 10,
        damageRolls: [[]],
        onHitEffectRolls: [{ effectId: 'shortbow-poisoned-unconscious', d20: 1 }],
      },
    })
    expect(deeplyFailed.ok, deeplyFailed.ok ? undefined : deeplyFailed.reason).toBe(true)
    if (!deeplyFailed.ok) return
    expect(deeplyFailed.state.combatants.target.currentHp).toBe(99)
    expect(deeplyFailed.state.combatants.target.conditions).toEqual(
      expect.arrayContaining(['poisoned', 'unconscious']),
    )

    const ordinaryFailure = resolveCatalogWeaponAttack({
      slug: 'sprite',
      actionId: 'shortbow',
      roll: {
        targetId: 'target',
        d20: 10,
        damageRolls: [[]],
        onHitEffectRolls: [{ effectId: 'shortbow-poisoned-unconscious', d20: 6 }],
      },
    })
    expect(ordinaryFailure.ok, ordinaryFailure.ok ? undefined : ordinaryFailure.reason).toBe(true)
    if (!ordinaryFailure.ok) return
    expect(ordinaryFailure.state.combatants.target.conditions).toContain('poisoned')
    expect(ordinaryFailure.state.combatants.target.conditions).not.toContain('unconscious')
  })

  it('resolves the Octopus Tentacles hit and source-owned grapple relation', () => {
    const result = resolveCatalogWeaponAttack({
      slug: 'octopus',
      actionId: 'tentacles',
      roll: {
        targetId: 'target',
        d20: 10,
        damageRolls: [[]],
        onHitEffectRolls: [{ effectId: 'tentacles-grapple' }],
      },
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(99)
    expect(result.state.combatants.target.conditions).toContain('grappled')
    expect(dnd5eSourceLinkedRelations(result.state, 'octopus', 'tentacles'))
      .toHaveLength(1)
  })

  it('keeps the Gnoll Spear usable as one stable melee-or-thrown attack', () => {
    const action = catalogAction('gnoll', 'spear')
    expect(action).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        mode: 'melee-or-ranged',
        reachFeet: 5,
        rangeFeet: { normal: 20, long: 60 },
        damage: [{ count: 1, sides: 6, bonus: 2, type: 'piercing' }],
        rangedDamage: [{ count: 1, sides: 6, bonus: 2, type: 'piercing' }],
      },
    })
  })

  it('resolves Steam Mephit Steam Breath with recharge spending and half damage', () => {
    const actor = catalogActor('steam-mephit')
    actor.classState.monsterRechargeReadyByActionId = { 'steam-breath': true }
    const target = combatant('target', 10, { savingThrowBonuses: { dex: 0 } })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('steam-mephit:steam-breath', [actor, target]),
      {
        type: 'monster-area-action',
        actorId: actor.id,
        actionId: 'steam-breath',
        resolution: {
          schemaVersion: 1,
          targetIds: [target.id],
          targetSavingThrows: [{ targetId: target.id, d20: 20 }],
          damageRolls: [8],
        },
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(96)
    expect(result.state.combatants[actor.id].classState.monsterRechargeReadyByActionId)
      .toEqual({ 'steam-breath': false })
  })

  it('declares all nine migrated source actions as structured Headless actions', () => {
    const migrated = [
      ['gnoll', 'spear'],
      ['guardian-naga', 'spit-poison'],
      ['octopus', 'tentacles'],
      ['poisonous-snake', 'bite'],
      ['scorpion', 'sting'],
      ['spider', 'bite'],
      ['sprite', 'longsword'],
      ['sprite', 'shortbow'],
      ['steam-mephit', 'steam-breath'],
    ] as const

    for (const [slug, actionId] of migrated) {
      const action = catalogAction(slug, actionId)
      expect(action.automation, `${slug}/${actionId}`).toBe('headless')
      expect(
        action.kind === 'weapon-attack' ? action.attack : action.rule,
        `${slug}/${actionId}`,
      ).toBeDefined()
    }
  })
})
