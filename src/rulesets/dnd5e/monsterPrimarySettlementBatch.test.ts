import { describe, expect, it } from 'vitest'
import { createDnd5eConditionEffect } from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eMonsterSavingThrowConditionTargetExcluded,
  dnd5eMonsterTargetEligibilityAllows,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eMonsterActionRoll,
} from './headlessCombatEngine'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterOnHitEffect,
} from './monsters'

const abilities = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

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

function catalogActor(slug: string): Dnd5eCombatant {
  const monster = getDnd5eSrdMonsterBySlug(slug)
  if (!monster) throw new Error(`Missing ${slug}`)
  return combatant(slug, 20, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    abilities: monster.abilities,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
  })
}

function effectOfKind<Kind extends Dnd5eMonsterOnHitEffect['kind']>(
  action: Dnd5eMonsterAction,
  kind: Kind,
): Extract<Dnd5eMonsterOnHitEffect, { kind: Kind }> {
  const effect = action.attack?.onHitEffects?.find((candidate) => candidate.kind === kind)
  if (!effect || effect.kind !== kind) throw new Error(`Missing ${kind} on ${action.id}`)
  return effect as Extract<Dnd5eMonsterOnHitEffect, { kind: Kind }>
}

function minimumDamageRolls(action: Dnd5eMonsterAction): number[][] {
  return (action.attack?.damage ?? []).map((damage) => Array(damage.count).fill(1))
}

function resolveCatalogAttack(input: {
  slug: string
  actionId: string
  onHitEffectRolls?: Dnd5eMonsterActionRoll['onHitEffectRolls']
  targetPatch?: Partial<Dnd5eCombatant>
}) {
  const action = catalogAction(input.slug, input.actionId)
  const actor = catalogActor(input.slug)
  const target = combatant('target', 10, {
    creatureType: 'humanoid',
    savingThrowBonuses: { con: 0 },
    ...input.targetPatch,
  })
  const state = startDnd5eHeadlessCombat(
    `primary-settlement:${input.slug}`,
    [actor, target],
  )
  const result = resolveDnd5eHeadlessAction(state, {
    type: 'monster-action',
    actorId: actor.id,
    actionId: input.actionId,
    rolls: [{
      targetId: target.id,
      d20: 10,
      damageRolls: minimumDamageRolls(action),
      onHitEffectRolls: input.onHitEffectRolls,
    }],
  })
  return { action, actor, target, result }
}

describe('primary monster settlement gap batch', () => {
  it.each([
    ['specter', 10],
    ['wraith', 14],
  ] as const)(
    'resolves %s Life Drain and reduces maximum HP after a failed DC %i save',
    (slug, dc) => {
      const action = catalogAction(slug, 'life-drain')
      const effect = effectOfKind(action, 'hit-point-maximum-reduction')
      expect(action.automation).toBe('headless')
      expect(effect).toMatchObject({
        damageBasis: { kind: 'damage-type', damageType: 'necrotic' },
        savingThrow: { ability: 'con', dc },
        recovery: 'long-rest',
      })

      const damage = action.attack!.damage[0]!
      const expectedDamage = damage.count + damage.bonus
      const { result } = resolveCatalogAttack({
        slug,
        actionId: 'life-drain',
        onHitEffectRolls: [{ effectId: effect.id, d20: 1 }],
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants.target.currentHp).toBe(100 - expectedDamage)
      expect(result.state.combatants.target.maxHp).toBe(100 - expectedDamage)
      expect(result.state.combatants.target.classState.hitPointMaximumReductionLedger)
        .toMatchObject({ entries: [{ amount: expectedDamage, recovery: 'long-rest' }] })
    },
  )

  it.each([
    ['werebear-bear', 'bite', 14, 'srd-5.1:monster:werebear:lycanthropy'],
    ['werebear-hybrid', 'bite', 14, 'srd-5.1:monster:werebear:lycanthropy'],
    ['wereboar-boar', 'tusks', 12, 'srd-5.1:monster:wereboar:lycanthropy'],
    ['wererat-rat', 'bite', 11, 'srd-5.1:monster:wererat:lycanthropy'],
    ['weretiger-hybrid', 'bite', 13, 'srd-5.1:monster:weretiger:lycanthropy'],
    ['weretiger-tiger', 'bite', 13, 'srd-5.1:monster:weretiger:lycanthropy'],
    ['werewolf-wolf', 'bite', 12, 'srd-5.1:monster:werewolf:lycanthropy'],
  ] as const)(
    'structures %s/%s lycanthropy for humanoid targets',
    (slug, actionId, dc, definitionId) => {
      const action = catalogAction(slug, actionId)
      expect(action.automation).toBe('headless')
      expect(effectOfKind(action, 'persistent-effect')).toMatchObject({
        savingThrow: { ability: 'con', dc },
        targetCreatureTypeRequirements: ['humanoid'],
        definitionId,
        ailment: 'curse',
        stacking: 'refresh',
      })
    },
  )

  it('applies a newly structured werebear curse on a failed humanoid save', () => {
    const effect = effectOfKind(catalogAction('werebear-bear', 'bite'), 'persistent-effect')
    const { result } = resolveCatalogAttack({
      slug: 'werebear-bear',
      actionId: 'bite',
      onHitEffectRolls: [{ effectId: effect.id, d20: 1 }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:monster:werebear:lycanthropy',
        legacyCondition: 'curse',
      }),
    )
  })

  it.each([
    ['elephant', 'stomp'],
    ['elk', 'hooves'],
    ['giant-elk', 'hooves'],
    ['mammoth', 'stomp'],
    ['triceratops', 'stomp'],
  ] as const)(
    'allows %s/%s only against a prone target',
    (slug, actionId) => {
      const action = catalogAction(slug, actionId)
      const actor = catalogActor(slug)
      const standing = combatant('target', 10)
      const state = startDnd5eHeadlessCombat(`prone-only:${slug}`, [actor, standing])
      expect(action).toMatchObject({
        automation: 'headless',
        targetEligibility: {
          kind: 'any-of',
          predicates: [{ kind: 'standard-condition', condition: 'prone' }],
        },
      })
      expect(dnd5eMonsterTargetEligibilityAllows(state, actor.id, standing.id, action))
        .toBe(false)

      const proneEffect = createDnd5eConditionEffect({
        condition: 'prone',
        targetId: standing.id,
        source: { kind: 'feature', rulesId: 'test:prone' },
      })
      state.combatants[standing.id]!.classState.activeEffects = [proneEffect]
      state.combatants[standing.id]!.conditions = ['prone']
      expect(dnd5eMonsterTargetEligibilityAllows(state, actor.id, standing.id, action))
        .toBe(true)
    },
  )

  it('applies Ghoul Claws paralysis to an eligible humanoid', () => {
    const effect = effectOfKind(catalogAction('ghoul', 'claws'), 'saving-throw-condition')
    const { result } = resolveCatalogAttack({
      slug: 'ghoul',
      actionId: 'claws',
      onHitEffectRolls: [{ effectId: effect.id, d20: 1 }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.conditions).toContain('paralyzed')
  })

  it('skips Ghoul paralysis and its saving throw for elves and undead', () => {
    const effect = effectOfKind(catalogAction('ghoul', 'claws'), 'saving-throw-condition')
    expect(effect).toMatchObject({
      targetCreatureTypeExclusions: ['undead'],
      targetRaceExclusions: ['elf'],
    })
    const elf = combatant('elf', 10, {
      creatureType: 'humanoid',
      race: '精灵',
      raceId: 'elf',
    })
    const undead = combatant('undead', 10, { creatureType: 'undead' })
    expect(dnd5eMonsterSavingThrowConditionTargetExcluded(elf, effect)).toBe(true)
    expect(dnd5eMonsterSavingThrowConditionTargetExcluded(undead, effect)).toBe(true)

    for (const targetPatch of [
      { creatureType: 'humanoid', race: '精灵', raceId: 'elf' },
      { creatureType: 'undead' },
    ]) {
      const { result } = resolveCatalogAttack({
        slug: 'ghoul',
        actionId: 'claws',
        onHitEffectRolls: [{ effectId: effect.id }],
        targetPatch,
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) continue
      expect(result.state.combatants.target.conditions).not.toContain('paralyzed')
      expect(result.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)
    }
  })

  it('keeps Ghast Claws effective against elves while excluding undead', () => {
    const effect = effectOfKind(catalogAction('ghast', 'claws'), 'saving-throw-condition')
    const elf = combatant('elf', 10, {
      creatureType: 'humanoid',
      race: '精灵',
      raceId: 'elf',
    })
    const undead = combatant('undead', 10, { creatureType: 'undead' })
    expect(effect.targetRaceExclusions).toBeUndefined()
    expect(dnd5eMonsterSavingThrowConditionTargetExcluded(elf, effect)).toBe(false)
    expect(dnd5eMonsterSavingThrowConditionTargetExcluded(undead, effect)).toBe(true)
  })
})
