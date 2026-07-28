import { describe, expect, it } from 'vitest'
import { DND5E_SRD_MONSTERS } from './monsters'
import { dnd5eMonsterActionAutomation, validateDnd5eMonsterCatalog, validateDnd5eMonsterSchema } from './monsterSchema'

describe('D&D 5e monster action schema', () => {
  it('keeps every current SRD monster action structurally valid', () => {
    expect(validateDnd5eMonsterCatalog(DND5E_SRD_MONSTERS)).toEqual([])
  })

  it('strictly validates triggered attack traits and confines Parry to reactions', () => {
    const invalidTrait = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'berserker')!,
    )
    const reckless = invalidTrait.traits.find((trait) =>
      trait.rule?.kind === 'reckless')!
    ;(reckless.rule as unknown as Record<string, unknown>).activation = 'on-hit'
    expect(validateDnd5eMonsterSchema(invalidTrait)).toContainEqual(
      expect.objectContaining({ code: 'invalid-stat-block' }),
    )

    const invalidParry = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'bandit-captain')!,
    )
    const parry = invalidParry.reactions!.find((reaction) =>
      reaction.rule?.kind === 'parry')!
    ;(parry.rule as unknown as Record<string, unknown>).armorClassBonus = 0
    expect(validateDnd5eMonsterSchema(invalidParry)).toContainEqual(
      expect.objectContaining({ actionId: 'parry', code: 'invalid-stat-block' }),
    )

    const wrongSection = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'bandit-captain')!,
    )
    const misplacedParry = wrongSection.reactions!.find((reaction) =>
      reaction.rule?.kind === 'parry')!
    wrongSection.reactions = wrongSection.reactions!.filter((reaction) =>
      reaction.id !== misplacedParry.id)
    wrongSection.actions = [...wrongSection.actions, misplacedParry]
    expect(validateDnd5eMonsterSchema(wrongSection)).toContainEqual({
      monsterId: wrongSection.id,
      actionId: 'parry',
      code: 'invalid-stat-block',
      message: 'Parry 只能声明在反应动作分区中',
    })
  })

  it('rejects duplicate action IDs across every pair of action sections', () => {
    const sections = [
      'actions',
      'bonusActions',
      'reactions',
      'legendaryActions',
      'lairActions',
    ] as const
    const labels = {
      actions: '动作',
      bonusActions: '附赠动作',
      reactions: '反应',
      legendaryActions: '传奇动作',
      lairActions: '巢穴动作',
    } as const

    for (let leftIndex = 0; leftIndex < sections.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < sections.length; rightIndex += 1) {
        const left = sections[leftIndex]
        const right = sections[rightIndex]
        const monster = structuredClone(
          DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'goblin')!,
        )
        const template = monster.actions.find((action) =>
          action.kind === 'weapon-attack')!
        monster.bonusActions = []
        monster.reactions = []
        monster.legendaryActions = []
        monster.lairActions = []

        const duplicateId = left === 'actions' ? template.id : 'cross-section-duplicate'
        const leftDuplicate = { ...structuredClone(template), id: duplicateId }
        const rightDuplicate = { ...structuredClone(template), id: duplicateId }
        if (left !== 'actions') monster[left] = [leftDuplicate]
        if (right !== 'actions') monster[right] = [rightDuplicate]

        expect(
          validateDnd5eMonsterSchema(monster).filter((issue) =>
            issue.code === 'duplicate-action-id'),
        ).toEqual([
          expect.objectContaining({
            monsterId: monster.id,
            actionId: duplicateId,
            code: 'duplicate-action-id',
            message:
              `怪物动作 ID 必须在所有动作分区中唯一：${duplicateId}` +
              `（首次出现在${labels[left]}，又出现在${labels[right]}）`,
          }),
        ])
      }
    }
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

  it('strictly validates indexed saving-throw condition effects', () => {
    const valid = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'bone-devil')!,
    )
    const validSting = valid.actions.find((action) => action.id === 'sting')!
    expect(validSting.attack?.onHitEffects).toEqual([{
      id: 'sting-poisoned',
      kind: 'saving-throw-condition',
      ability: 'con',
      dc: 14,
      conditionOnFailedSave: {
        condition: 'poisoned',
        durationRounds: 10,
        repeatSaveAtEndOfTargetTurn: true,
      },
    }])
    expect(dnd5eMonsterActionAutomation(validSting)).toBe('headless')
    expect(validateDnd5eMonsterSchema(valid)).toEqual([])

    const invalidMutations: Array<(effect: Record<string, unknown>) => void> = [
      (effect) => {
        effect.id = 'Not Stable'
      },
      (effect) => {
        effect.ability = 'luck'
      },
      (effect) => {
        effect.dc = 0
      },
      (effect) => {
        ;(effect.conditionOnFailedSave as Record<string, unknown>).condition = 'burning'
      },
      (effect) => {
        ;(effect.conditionOnFailedSave as Record<string, unknown>).durationRounds = 0
      },
      (effect) => {
        ;(effect.conditionOnFailedSave as Record<string, unknown>)
          .repeatSaveAtEndOfTargetTurn = 'yes'
      },
      (effect) => {
        effect.unexpected = true
      },
    ]

    for (const mutate of invalidMutations) {
      const monster = structuredClone(valid)
      const effect = (
        monster.actions.find((action) => action.id === 'sting')!
          .attack!.onHitEffects as unknown as Array<Record<string, unknown>>
      )[0]!
      mutate(effect)
      expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
        actionId: 'sting',
        code: 'invalid-stat-block',
      }))
    }
  })

  it('strictly validates monster-area forced movement, target scope, and mechanical effects', () => {
    const expectInvalid = (
      slug: 'adult-bronze-dragon' | 'adult-copper-dragon' | 'adult-gold-dragon',
      variantId: string,
      mutate: (variant: Record<string, unknown>) => void,
    ) => {
      const monster = structuredClone(
        DND5E_SRD_MONSTERS.find((entry) => entry.slug === slug)!,
      )
      const action = monster.actions.find((entry) => entry.id === 'breath-weapons')!
      const rule = action.rule as unknown as { variants: Array<Record<string, unknown>> }
      const variant = rule.variants.find((entry) => entry.id === variantId)!
      mutate(variant)
      expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
        actionId: 'breath-weapons',
        code: 'invalid-stat-block',
      }))
    }

    expectInvalid('adult-bronze-dragon', 'repulsion-breath', (variant) => {
      variant.target = 'everyone'
    })
    expectInvalid('adult-bronze-dragon', 'repulsion-breath', (variant) => {
      ;(variant.forcedMovementOnFailedSave as Record<string, unknown>).maximumDistanceFeet = 0
    })
    expectInvalid('adult-bronze-dragon', 'repulsion-breath', (variant) => {
      ;(variant.forcedMovementOnFailedSave as Record<string, unknown>).direction = 'toward-source'
    })
    expectInvalid('adult-bronze-dragon', 'repulsion-breath', (variant) => {
      ;(variant.forcedMovementOnFailedSave as Record<string, unknown>).unexpected = true
    })
    expectInvalid('adult-copper-dragon', 'slowing-breath', (variant) => {
      const effect = variant.activeEffectOnFailedSave as Record<string, unknown>
      ;(effect.modifiers as Record<string, unknown>).speedMultiplier = 0
    })
    expectInvalid('adult-copper-dragon', 'slowing-breath', (variant) => {
      const effect = variant.activeEffectOnFailedSave as Record<string, unknown>
      ;(effect.modifiers as Record<string, unknown>).maximumAttacksPerTurn = 0
    })
    expectInvalid('adult-copper-dragon', 'slowing-breath', (variant) => {
      const effect = variant.activeEffectOnFailedSave as Record<string, unknown>
      ;(effect.modifiers as Record<string, unknown>).unexpected = true
    })
    expectInvalid('adult-gold-dragon', 'weakening-breath', (variant) => {
      const effect = variant.activeEffectOnFailedSave as Record<string, unknown>
      effect.id = 'Not Stable'
    })
    expectInvalid('adult-gold-dragon', 'weakening-breath', (variant) => {
      const effect = variant.activeEffectOnFailedSave as Record<string, unknown>
      effect.modifiers = {}
    })
    expectInvalid('adult-gold-dragon', 'weakening-breath', (variant) => {
      variant.activeEffectOnFailedSave = undefined
    })
  })

  it('rejects unsupported explicit monster weapon attack abilities', () => {
    const monster = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'spy')!,
    )
    const attack = monster.actions.find((entry) => entry.id === 'shortsword')!
      .attack as unknown as Record<string, unknown>
    attack.attackAbility = 'wis'
    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      actionId: 'shortsword',
      code: 'invalid-stat-block',
    }))
  })

  it('strictly validates source-linked grapple effects and action requirements', () => {
    const valid = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'ankheg')!,
    )
    expect(validateDnd5eMonsterSchema(valid)).toEqual([])

    const invalidEffectMutations: Array<(effect: Record<string, unknown>) => void> = [
      (effect) => {
        ;(effect.relation as Record<string, unknown>).capacity = 0
      },
      (effect) => {
        ;(effect.relation as Record<string, unknown>).maxDistanceFeet = 0
      },
      (effect) => {
        ;(effect.relation as Record<string, unknown>).maxDistanceFeet = 1_001
      },
      (effect) => {
        ;(effect.relation as Record<string, unknown>).targetMaxSizeRank = 6
      },
      (effect) => {
        ;(effect.relation as Record<string, unknown>).whenCapacityFull = 'replace-oldest'
      },
      (effect) => {
        ;(effect.relation as Record<string, unknown>).attackAdvantageAgainstLinkedTarget = 'yes'
      },
      (effect) => {
        ;(effect.relation as Record<string, unknown>).unexpected = true
      },
      (effect) => {
        effect.escapeDc = 0
      },
      (effect) => {
        effect.conditions = [{ condition: 'restrained' }]
      },
      (effect) => {
        effect.conditions = [
          { condition: 'grappled' },
          { condition: 'restrained' },
        ]
      },
      (effect) => {
        effect.conditions = [
          { condition: 'grappled', dependsOnCondition: 'restrained' },
          { condition: 'restrained', dependsOnCondition: 'grappled' },
        ]
      },
      (effect) => {
        effect.unexpected = true
      },
    ]

    for (const mutate of invalidEffectMutations) {
      const monster = structuredClone(valid)
      const effect = (
        monster.actions.find((action) => action.id === 'bite')!
          .attack!.onHitEffects as unknown as Array<Record<string, unknown>>
      )[0]!
      mutate(effect)
      expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
        actionId: 'bite',
        code: 'invalid-stat-block',
      }))
    }

    for (const invalidRequirement of [
      { kind: 'any-from-source', slotGroup: 'bite' },
      { kind: 'none-from-source', slotGroup: 'Not Stable' },
      { kind: 'none-from-source', slotGroup: 'bite', unexpected: true },
    ]) {
      const monster = structuredClone(valid)
      ;(monster.actions.find((action) => action.id === 'acid-spray') as unknown as {
        relationRequirement: unknown
      }).relationRequirement = invalidRequirement
      expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
        actionId: 'acid-spray',
        code: 'invalid-stat-block',
      }))
    }

    const unknownSlot = structuredClone(valid)
    unknownSlot.actions.find((action) => action.id === 'acid-spray')!
      .relationRequirement = {
        kind: 'none-from-source',
        slotGroup: 'bites',
      }
    expect(validateDnd5eMonsterSchema(unknownSlot)).toContainEqual(
      expect.objectContaining({
        actionId: 'acid-spray',
        code: 'invalid-stat-block',
      }),
    )

    const inconsistentSharedSlot = structuredClone(valid)
    const secondBite = structuredClone(
      inconsistentSharedSlot.actions.find((action) => action.id === 'bite')!,
    )
    secondBite.id = 'second-bite'
    const secondRelation = secondBite.attack!.onHitEffects!
      .find((effect) => effect.kind === 'source-linked-condition')!
      .relation
    secondRelation.capacity = 2
    inconsistentSharedSlot.actions = [
      ...inconsistentSharedSlot.actions,
      secondBite,
    ]
    expect(validateDnd5eMonsterSchema(inconsistentSharedSlot)).toContainEqual(
      expect.objectContaining({
        actionId: 'second-bite',
        code: 'invalid-stat-block',
      }),
    )
  })

  it('rejects multiple source-linked condition effects on one attack', () => {
    const monster = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'ankheg')!,
    )
    const bite = monster.actions.find((action) => action.id === 'bite')!
    const sourceLinked = structuredClone(bite.attack!.onHitEffects![0]!)
    bite.attack!.onHitEffects = [
      sourceLinked,
      {
        ...structuredClone(sourceLinked),
        id: 'bite-second-grapple',
      },
    ]

    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      actionId: 'bite',
      code: 'invalid-stat-block',
    }))
  })

  it('strictly validates an attack-level target size restriction', () => {
    const valid = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'behir')!,
    )
    expect(valid.actions.find((action) =>
      action.id === 'constrict')?.attack?.targetMaxSizeRank).toBe(3)
    const constrict = valid.actions.find((action) => action.id === 'constrict')!
    constrict.attack!.targetMaxSizeRank = 6
    expect(validateDnd5eMonsterSchema(valid)).toContainEqual(
      expect.objectContaining({
        actionId: 'constrict',
        code: 'invalid-stat-block',
      }),
    )
  })

  it('strictly validates compound poison conditions and effect-specific zero-HP outcomes', () => {
    const validZeroHp = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'giant-spider')!,
    )
    const validQuasit = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'quasit')!,
    )
    expect(dnd5eMonsterActionAutomation(
      validZeroHp.actions.find((action) => action.id === 'bite')!,
    )).toBe('headless')
    expect(dnd5eMonsterActionAutomation(
      validQuasit.actions.find((action) => action.id === 'claw-bite-in-beast-form')!,
    )).toBe('headless')
    expect(validateDnd5eMonsterSchema(validZeroHp)).toEqual([])
    expect(validateDnd5eMonsterSchema(validQuasit)).toEqual([])

    const invalidConditionMutations: Array<(effect: Record<string, unknown>) => void> = [
      (effect) => {
        ;(effect.conditionOnFailedSave as Record<string, unknown>).condition = 'not-a-condition'
      },
      (effect) => {
        ;(effect.conditionOnFailedSave as Record<string, unknown>).durationRounds = 0
      },
      (effect) => {
        ;(effect.conditionOnFailedSave as Record<string, unknown>).repeatSaveAtEndOfTargetTurn = 'yes'
      },
      (effect) => {
        ;(effect.conditionOnFailedSave as Record<string, unknown>).unexpected = true
      },
    ]
    const invalidZeroHpMutations: Array<(effect: Record<string, unknown>) => void> = [
      (effect) => {
        ;(effect.onEffectDamageReducesTargetToZero as Record<string, unknown>).stabilize = false
      },
      (effect) => {
        ;(effect.onEffectDamageReducesTargetToZero as Record<string, unknown>).conditions = []
      },
      (effect) => {
        const outcome = effect.onEffectDamageReducesTargetToZero as {
          conditions: Array<Record<string, unknown>>
        }
        outcome.conditions[0]!.durationRounds = 0
      },
      (effect) => {
        const outcome = effect.onEffectDamageReducesTargetToZero as {
          conditions: Array<Record<string, unknown>>
        }
        outcome.conditions[1]!.dependsOnCondition = 'stunned'
      },
      (effect) => {
        const outcome = effect.onEffectDamageReducesTargetToZero as {
          conditions: Array<Record<string, unknown>>
        }
        outcome.conditions[1]!.dependsOnCondition = 'paralyzed'
      },
      (effect) => {
        const outcome = effect.onEffectDamageReducesTargetToZero as {
          conditions: Array<Record<string, unknown>>
        }
        outcome.conditions[1]!.condition = 'poisoned'
      },
      (effect) => {
        const outcome = effect.onEffectDamageReducesTargetToZero as {
          conditions: Array<Record<string, unknown>>
        }
        outcome.conditions[1]!.unexpected = true
      },
      (effect) => {
        ;(effect.onEffectDamageReducesTargetToZero as Record<string, unknown>).unexpected = true
      },
    ]

    for (const mutate of invalidConditionMutations) {
      const monster = structuredClone(validQuasit)
      const effect = (
        monster.actions.find((action) => action.id === 'claw-bite-in-beast-form')!
          .attack!.onHitEffects as unknown as Array<Record<string, unknown>>
      )[0]!
      mutate(effect)
      expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
        actionId: 'claw-bite-in-beast-form',
        code: 'invalid-stat-block',
      }))
    }

    for (const mutate of invalidZeroHpMutations) {
      const monster = structuredClone(validZeroHp)
      const effect = (
        monster.actions.find((action) => action.id === 'bite')!
          .attack!.onHitEffects as unknown as Array<Record<string, unknown>>
      )[0]!
      mutate(effect)
      expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
        actionId: 'bite',
        code: 'invalid-stat-block',
      }))
    }
  })

  it('rejects a two-condition zero-HP dependency cycle', () => {
    const monster = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'giant-spider')!,
    )
    const effect = (
      monster.actions.find((action) => action.id === 'bite')!
        .attack!.onHitEffects as unknown as Array<Record<string, unknown>>
    )[0]!
    const outcome = effect.onEffectDamageReducesTargetToZero as {
      conditions: Array<Record<string, unknown>>
    }
    outcome.conditions[0]!.dependsOnCondition = 'paralyzed'
    outcome.conditions[1]!.dependsOnCondition = 'poisoned'

    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      actionId: 'bite',
      code: 'invalid-stat-block',
    }))
  })

  it('rejects a longer zero-HP dependency cycle', () => {
    const monster = structuredClone(
      DND5E_SRD_MONSTERS.find((entry) => entry.slug === 'giant-spider')!,
    )
    const effect = (
      monster.actions.find((action) => action.id === 'bite')!
        .attack!.onHitEffects as unknown as Array<Record<string, unknown>>
    )[0]!
    const outcome = effect.onEffectDamageReducesTargetToZero as {
      conditions: Array<Record<string, unknown>>
    }
    outcome.conditions = [
      { condition: 'poisoned', durationRounds: 600, dependsOnCondition: 'paralyzed' },
      { condition: 'paralyzed', durationRounds: 600, dependsOnCondition: 'stunned' },
      { condition: 'stunned', durationRounds: 600, dependsOnCondition: 'poisoned' },
    ]

    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      actionId: 'bite',
      code: 'invalid-stat-block',
    }))
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
