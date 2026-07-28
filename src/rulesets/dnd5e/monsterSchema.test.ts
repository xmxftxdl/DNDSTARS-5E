import { describe, expect, it } from 'vitest'
import { DND5E_SRD_MONSTERS } from './monsters'
import { dnd5eMonsterActionAutomation, validateDnd5eMonsterCatalog, validateDnd5eMonsterSchema } from './monsterSchema'

describe('D&D 5e monster action schema', () => {
  it('keeps every current SRD monster action structurally valid', () => {
    expect(validateDnd5eMonsterCatalog(DND5E_SRD_MONSTERS)).toEqual([])
  })

  it('rejects an on-hit rule that exists only as prose', () => {
    const monster = structuredClone(DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'goblin')!)
    const weapon = monster.actions.find((action) => action.kind === 'weapon-attack')!
    weapon.attack!.onHit = '目标倒地。'
    weapon.attack!.onHitRule = undefined
    expect(dnd5eMonsterActionAutomation(weapon)).toBe('invalid')
    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      actionId: weapon.id, code: 'unstructured-on-hit-rule',
    }))
  })

  it('strictly validates indexed saving-throw damage effects', () => {
    const valid = structuredClone(DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'assassin')!)
    const validShortsword = valid.actions.find((action) => action.id === 'shortsword')!
    expect(dnd5eMonsterActionAutomation(validShortsword)).toBe('headless')
    expect(validateDnd5eMonsterSchema(valid)).toEqual([])

    const invalidMutations: Array<(attack: Record<string, unknown>) => void> = [
      (attack) => {
        ;(attack.onHitEffects as Array<Record<string, unknown>>)[0]!.dc = 0
      },
      (attack) => {
        ;(attack.onHitEffects as Array<Record<string, unknown>>)[0]!.damageOnSuccessfulSave = 'quarter'
      },
      (attack) => {
        ;(attack.onHitEffects as Array<Record<string, unknown>>)[0]!.damage = []
      },
      (attack) => {
        ;(attack.onHitEffects as Array<Record<string, unknown>>)[0]!.unexpected = true
      },
      (attack) => {
        const effect = structuredClone(
          (attack.onHitEffects as Array<Record<string, unknown>>)[0]!,
        )
        attack.onHitEffects = [effect, structuredClone(effect)]
      },
      (attack) => {
        attack.onHitEffects = []
      },
    ]

    for (const mutate of invalidMutations) {
      const monster = structuredClone(valid)
      const attack = monster.actions.find((action) => action.id === 'shortsword')!
        .attack as unknown as Record<string, unknown>
      mutate(attack)
      expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
        actionId: 'shortsword',
        code: 'invalid-stat-block',
      }))
    }
  })

  it('strictly validates alternate ranged damage only on hybrid attacks', () => {
    const monster = structuredClone(DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'bugbear')!)
    const javelin = monster.actions.find((action) => action.id === 'javelin')!
    javelin.attack!.mode = 'melee'
    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      actionId: javelin.id,
      code: 'invalid-stat-block',
    }))

    javelin.attack!.mode = 'melee-or-ranged'
    ;(javelin.attack! as unknown as { rangedDamage: unknown }).rangedDamage = [{
      average: 5, count: 1, sides: 1, bonus: 2, type: 'piercing',
    }]
    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      actionId: javelin.id,
      code: 'invalid-stat-block',
    }))
  })

  it('strictly validates the structured Pack Tactics condition', () => {
    const monster = structuredClone(DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'giant-rat')!)
    const trait = monster.traits.find((entry) => entry.rule?.kind === 'pack-tactics')!
    expect(validateDnd5eMonsterSchema(monster)).toEqual([])
    ;(trait.rule as unknown as { allyDistanceFeet: number }).allyDistanceFeet = 0
    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      code: 'invalid-stat-block',
    }))
  })

  it('strictly validates Limited Magic Immunity constants', () => {
    const monster = structuredClone(DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'rakshasa')!)
    const trait = monster.traits.find((entry) => entry.rule?.kind === 'limited-magic-immunity')!
    expect(validateDnd5eMonsterSchema(monster)).toEqual([])
    ;(trait.rule as unknown as { maximumSpellLevel: number }).maximumSpellLevel = 7
    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      code: 'invalid-stat-block',
    }))
  })

  it('strictly validates source-aware damage defenses and retained manual clauses', () => {
    const monster = structuredClone(DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'goblin')!)
    monster.damageDefenseRules = [{
      outcome: 'immune',
      damageTypes: ['bludgeoning', 'piercing', 'slashing'],
      delivery: 'weapon-attack',
      magical: false,
      weaponMaterialNot: 'silvered',
      reason: 'test:nonsilvered',
    }]
    monster.unparsedDamageDefenses = [{
      outcome: 'resistant',
      text: 'A condition that still requires DM adjudication.',
    }]
    expect(validateDnd5eMonsterSchema(monster)).toEqual([])

    ;(monster.damageDefenseRules[0] as unknown as Record<string, unknown>).unknownPredicate = true
    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      code: 'invalid-stat-block',
      message: '条件伤害防御数据无效',
    }))
  })

  it('validates parent Multiattack attack-mode restrictions against every child', () => {
    const fanatic = structuredClone(DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'cult-fanatic')!)
    expect(validateDnd5eMonsterSchema(fanatic)).toEqual([])
    expect(fanatic.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      sequence: ['dagger', 'dagger'],
      sequenceAttackMode: 'melee',
    })

    const chimera = structuredClone(DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'chimera')!)
    const multiattack = chimera.actions.find((action) => action.id === 'multiattack')!
    multiattack.sequenceAttackMode = 'ranged'
    expect(validateDnd5eMonsterSchema(chimera)).toContainEqual(expect.objectContaining({
      actionId: 'multiattack',
      code: 'invalid-multiattack-sequence',
    }))

    const bite = chimera.actions.find((action) => action.id === 'bite')!
    ;(bite as unknown as { sequenceAttackMode: string }).sequenceAttackMode = 'melee'
    expect(validateDnd5eMonsterSchema(chimera)).toContainEqual(expect.objectContaining({
      actionId: 'bite',
      code: 'invalid-stat-block',
    }))
  })
})
