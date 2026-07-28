import { describe, expect, it } from 'vitest'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterActionDraft,
  createDnd5eCustomMonsterDraft,
  createDnd5eCustomMonsterMechanicDraft,
  createDnd5eCustomMonsterTraitDraft,
  dnd5eCustomMonsterDraftFromStatBlock,
} from './customMonsterWorkshop'
import { dnd5eMonsterActionAutomation, parseDnd5eMonsterStatBlock } from './monsterSchema'

describe('D&D 5e custom monster workshop', () => {
  it('builds a schema-valid room monster with a Headless weapon attack', () => {
    const monster = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    expect(monster.id).toMatch(/^room-monster:/)
    expect(monster.source).toBe('DM 自定义')
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(dnd5eMonsterActionAutomation(monster.actions[0])).toBe('headless')
  })

  it('round-trips target priority and a low-hit-point Headless healing mechanism', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.targetingPriority = 'highest-threat'
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'bloodied-recovery',
      name: '浴血恢复',
      hpPercentageAtOrBelow: 50,
      healingDice: '2d6',
      limit: 'once-per-combat',
    }]

    const monster = buildDnd5eCustomMonster(draft)
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(monster.targetingPreference).toEqual({ schemaVersion: 1, priority: 'highest-threat' })
    expect(monster.headlessMechanics).toEqual([expect.objectContaining({
      schemaVersion: 2,
      id: 'bloodied-recovery',
      trigger: { event: 'turn-start' },
      predicates: { hpPercentageAtOrBelow: 50, requiresPositiveHp: true },
      effects: [{ id: 'effect-0', kind: 'healing', target: 'self', dice: { count: 2, sides: 6, bonus: 0 } }],
      limit: 'once-per-combat',
      automation: 'full',
    })])
    expect(dnd5eCustomMonsterDraftFromStatBlock(monster)).toMatchObject({
      targetingPriority: 'highest-threat',
      headlessMechanics: [{ id: 'bloodied-recovery', healingDice: '2d6' }],
    })
  })

  it('round-trips an edited monster and generates a multiattack declaration', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions[0].attacksPerAction = 2
    const monster = buildDnd5eCustomMonster(draft)
    expect(monster.actions[0]).toMatchObject({ kind: 'multiattack', sequence: [draft.actions[0].id, draft.actions[0].id] })
    expect(buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(monster))).toMatchObject({ id: monster.id, slug: monster.slug })
  })

  it('represents keen smell, ambusher, charge damage, weapon profiles, multiattack, and nimble escape', () => {
    const draft = createDnd5eCustomMonsterDraft()
    const spear = {
      ...createDnd5eCustomMonsterActionDraft(),
      id: 'spear-one-handed',
      name: '矛',
      toHit: 4,
      damageDice: '1d6+2',
      damageType: 'piercing' as const,
    }
    const spearTwoHanded = {
      ...createDnd5eCustomMonsterActionDraft(),
      id: 'spear-two-handed',
      name: '矛（双手）',
      toHit: 4,
      damageDice: '1d8+4',
      damageType: 'piercing' as const,
      additionalDamage: [{ id: 'spear-poison', dice: '1d4', damageType: 'poison' as const }],
    }
    const scimitar = {
      ...createDnd5eCustomMonsterActionDraft(),
      id: 'scimitar',
      name: '弯刀',
      toHit: 6,
      damageDice: '1d6+4',
      damageType: 'piercing' as const,
      additionalDamage: [{ id: 'scimitar-poison', dice: '1d4', damageType: 'poison' as const }],
      attacksPerAction: 2,
    }
    draft.actions = [spear, spearTwoHanded, scimitar]
    draft.traits = [
      {
        ...createDnd5eCustomMonsterTraitDraft(),
        name: '灵敏嗅觉',
        description: '嗅觉相关的察觉检定获得 +4，并拥有 10 尺盲视。',
        ruleKind: 'keen-sense',
        keenSense: 'smell',
        keenSenseCheckBonus: 4,
        keenSenseBlindsightFeet: 10,
      },
      {
        ...createDnd5eCustomMonsterTraitDraft(),
        name: '袭掠',
        description: '直线移动至少 20 尺后立即以矛攻击，命中时额外造成 2d10 伤害。',
        ruleKind: 'charge-damage',
        chargeMinimumFeet: 20,
        chargeActionId: spear.id,
        chargeDamageDice: '2d10',
        chargeDamageType: 'piercing',
      },
      {
        ...createDnd5eCustomMonsterTraitDraft(),
        name: '伏击手',
        description: '发动突袭时，先攻具有优势。',
        ruleKind: 'ambusher',
      },
      {
        ...createDnd5eCustomMonsterTraitDraft(),
        name: '迅捷逃逸',
        description: '以附赠动作执行撤离或躲藏。',
        ruleKind: 'nimble-escape',
      },
    ]

    const monster = buildDnd5eCustomMonster(draft)
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(monster.senses).toContainEqual({ name: '盲视', distanceFeet: 10 })
    expect(monster.traits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: '灵敏嗅觉',
        automation: 'dm-adjudication',
        rule: expect.objectContaining({ kind: 'keen-sense', sense: 'smell', checkBonus: 4 }),
      }),
      expect.objectContaining({
        name: '袭掠',
        automation: 'dm-adjudication',
        rule: expect.objectContaining({
          kind: 'charge-damage',
          minimumStraightMovementFeet: 20,
          actionId: spear.id,
          extraDamage: expect.objectContaining({ count: 2, sides: 10, type: 'piercing' }),
        }),
      }),
      expect.objectContaining({
        name: '伏击手',
        rule: { kind: 'ambusher', initiativeAdvantageWhenSurprising: true },
      }),
      expect.objectContaining({
        name: '迅捷逃逸',
        automation: 'headless',
        rule: { kind: 'nimble-escape', bonusActionOptions: ['disengage', 'hide'] },
      }),
    ]))
    expect(monster.actions.find((action) => action.kind === 'multiattack')?.sequence)
      .toEqual(['scimitar', 'scimitar'])
    expect(monster.actions.find((action) => action.id === 'spear-two-handed')?.attack?.damage)
      .toEqual([
        expect.objectContaining({ count: 1, sides: 8, bonus: 4, type: 'piercing' }),
        expect.objectContaining({ count: 1, sides: 4, type: 'poison' }),
      ])

    const roundTrip = dnd5eCustomMonsterDraftFromStatBlock(monster)
    expect(roundTrip.traits).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleKind: 'keen-sense', keenSenseBlindsightFeet: 10 }),
      expect.objectContaining({ ruleKind: 'charge-damage', chargeActionId: spear.id, chargeDamageDice: '2d10' }),
      expect.objectContaining({ ruleKind: 'ambusher' }),
    ]))
    expect(roundTrip.senses).not.toContainEqual(expect.objectContaining({ name: '盲视', distanceFeet: 10 }))
  })

  it('represents magic resistance, condition bonuses, charge movement, and a triggered recharge reaction', () => {
    const draft = createDnd5eCustomMonsterDraft()
    const charge = {
      ...createDnd5eCustomMonsterActionDraft(),
      id: 'charge',
      name: '冲锋',
      category: 'bonus-action' as const,
      kind: 'movement' as const,
      movementSpeedFraction: 0.5,
      description: '向一名可见敌人直线移动至多等于速度一半的距离。',
    }
    const stunningCharge = {
      ...createDnd5eCustomMonsterActionDraft(),
      id: 'stunning-charge',
      name: '震慑冲锋',
      category: 'reaction' as const,
      toHit: 13,
      damageDice: '5d6+12',
      damageType: 'piercing' as const,
      usageKind: 'recharge' as const,
      rechargeMinimum: 4,
      rechargeDieSides: 6,
      reactionTriggerActionId: charge.id,
      onHitSaveEnabled: true,
      onHitSaveAbility: 'str' as const,
      onHitSaveDc: 18,
      onHitCondition: 'stunned' as const,
    }
    draft.actions = [draft.actions[0], charge, stunningCharge]
    draft.traits = [
      {
        ...createDnd5eCustomMonsterTraitDraft(),
        name: '魔法抗性',
        description: '对抗法术和其他魔法效应的豁免具有优势。',
        ruleKind: 'magic-resistance',
      },
      {
        ...createDnd5eCustomMonsterTraitDraft(),
        name: '恐惧支配',
        description: '攻击恐慌或震慑目标时，攻击与伤害获得 +2。',
        ruleKind: 'conditional-target-bonus',
        targetBonusConditions: ['frightened', 'stunned'],
        targetAttackBonus: 2,
        targetDamageBonus: 2,
      },
    ]

    const monster = buildDnd5eCustomMonster(draft)
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(monster.traits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        automation: 'headless',
        rule: { kind: 'magic-resistance', savingThrowAdvantageAgainstMagic: true },
      }),
      expect.objectContaining({
        automation: 'headless',
        rule: {
          kind: 'conditional-target-bonus',
          targetConditions: ['frightened', 'stunned'],
          attackBonus: 2,
          damageBonus: 2,
        },
      }),
    ]))
    expect(monster.bonusActions).toContainEqual(expect.objectContaining({
      id: charge.id,
      kind: 'other',
      movement: {
        kind: 'straight-toward-visible-hostile',
        maximumSpeedFraction: 0.5,
      },
    }))
    expect(monster.reactions).toContainEqual(expect.objectContaining({
      id: stunningCharge.id,
      usage: { kind: 'recharge', dieSides: 6, minimum: 4 },
      reactionTrigger: { kind: 'after-action', actionId: charge.id },
      attack: expect.objectContaining({
        toHit: 13,
        damage: [expect.objectContaining({ count: 5, sides: 6, bonus: 12, type: 'piercing' })],
        onHitRule: { kind: 'saving-throw-condition', ability: 'str', dc: 18, condition: 'stunned' },
      }),
    }))

    const roundTrip = dnd5eCustomMonsterDraftFromStatBlock(monster)
    expect(roundTrip.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: charge.id, kind: 'movement', movementSpeedFraction: 0.5 }),
      expect.objectContaining({
        id: stunningCharge.id,
        category: 'reaction',
        reactionTriggerActionId: charge.id,
        rechargeMinimum: 4,
      }),
    ]))
  })

  it('preserves additional V2 effects imported through advanced JSON when the form edits the first effect', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'paired-effect',
      preservedEffects: [
        { id: 'effect-0', kind: 'healing', target: 'self', dice: { count: 2, sides: 6, bonus: 0 } },
        { id: 'hidden-condition', kind: 'standard-condition', target: 'self', condition: 'invisible', duration: { kind: 'rounds', rounds: 1 } },
      ],
    }]
    const original = buildDnd5eCustomMonster(draft)
    const form = dnd5eCustomMonsterDraftFromStatBlock(original)
    form.headlessMechanics[0].healingDice = '1d8+2'
    const rebuilt = buildDnd5eCustomMonster(form)
    expect(rebuilt.headlessMechanics?.[0]).toMatchObject({
      schemaVersion: 2,
      effects: [
        { id: 'effect-0', kind: 'healing', dice: { count: 1, sides: 8, bonus: 2 } },
        { id: 'hidden-condition', kind: 'standard-condition', condition: 'invisible' },
      ],
    })
  })

  it('rejects invalid dice instead of saving an unresolvable attack', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions[0].damageDice = 'lots'
    expect(() => buildDnd5eCustomMonster(draft)).toThrow('伤害骰格式无效')
  })

  it('preserves imported advanced fields and mixed attack data across a form save', () => {
    const original = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const imported = {
      ...original,
      savingThrows: { dex: 4 },
      skills: [{ key: 'stealth', name: '隐匿', bonus: 6 }],
      senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
      damageResistances: ['fire' as const],
      reactions: [{ id: 'parry', name: '招架', description: 'AC 暂时提高 2。', kind: 'other' as const, automation: 'dm-adjudication' as const }],
      actions: [
        {
          ...original.actions[0],
          attack: {
            ...original.actions[0].attack!,
            damage: [
              ...original.actions[0].attack!.damage,
              { average: 3, count: 1, sides: 6, bonus: 0, type: 'fire' as const },
            ],
          },
        },
        { id: 'multiattack', name: '多重攻击', description: '先爪击，再爪击。', kind: 'multiattack' as const, sequence: [original.actions[0].id, original.actions[0].id], automation: 'headless' as const },
      ],
    }
    const rebuilt = buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(imported))
    expect(rebuilt).toMatchObject({
      savingThrows: { dex: 4 },
      skills: [{ key: 'stealth', bonus: 6 }],
      senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
      damageResistances: ['fire'],
      reactions: [{ id: 'parry' }],
    })
    expect(rebuilt.actions.find((action) => action.kind === 'weapon-attack')?.attack?.damage).toHaveLength(2)
    expect(rebuilt.actions.find((action) => action.kind === 'multiattack')?.sequence).toEqual([
      original.actions[0].id, original.actions[0].id,
    ])
  })

  it('round-trips conditional defenses, unresolved clauses, and magic weapons without relying on prose', () => {
    const original = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const imported = {
      ...original,
      damageDefenseRules: [{
        outcome: 'immune' as const,
        damageTypes: ['bludgeoning', 'piercing', 'slashing'] as const,
        delivery: 'weapon-attack' as const,
        magical: false,
        weaponMaterialNot: 'silvered' as const,
        reason: 'lycanthrope-nonsilvered-immunity',
      }],
      unparsedDamageDefenses: [{
        outcome: 'resistant' as const,
        text: '来自非善良生物的钝击、穿刺与挥砍伤害',
      }],
      traits: [
        ...original.traits,
        {
          name: '魔法武器',
          description: '该生物的武器攻击视为魔法攻击。',
          automation: 'headless' as const,
          rule: { kind: 'magic-weapons' as const, weaponAttacksMagical: true as const },
        },
      ],
    }

    const draft = dnd5eCustomMonsterDraftFromStatBlock(imported)
    expect(draft.damageDefenseRules).toEqual(imported.damageDefenseRules)
    expect(draft.unparsedDamageDefenses).toEqual(imported.unparsedDamageDefenses)
    expect(draft.traits).toContainEqual(expect.objectContaining({
      name: '魔法武器',
      automation: 'headless',
      ruleKind: 'magic-weapons',
    }))

    const legacyDraft = dnd5eCustomMonsterDraftFromStatBlock(imported)
    delete legacyDraft.damageDefenseRules
    delete legacyDraft.unparsedDamageDefenses
    const legacyRebuilt = buildDnd5eCustomMonster(legacyDraft)
    expect(legacyRebuilt.damageDefenseRules).toEqual(imported.damageDefenseRules)
    expect(legacyRebuilt.unparsedDamageDefenses).toEqual(imported.unparsedDamageDefenses)

    // These fields are first-class draft data, not an accidental side effect of
    // spreading the original stat block back into the result.
    draft.preservedStatBlock = undefined
    const rebuilt = buildDnd5eCustomMonster(draft)
    expect(rebuilt.damageDefenseRules).toEqual(imported.damageDefenseRules)
    expect(rebuilt.unparsedDamageDefenses).toEqual(imported.unparsedDamageDefenses)
    expect(rebuilt.traits).toContainEqual(expect.objectContaining({
      name: '魔法武器',
      automation: 'headless',
      rule: { kind: 'magic-weapons', weaponAttacksMagical: true },
    }))
    expect(parseDnd5eMonsterStatBlock(rebuilt).ok).toBe(true)
  })

  it('round-trips limited magic immunity as structured workshop data', () => {
    const original = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const imported = {
      ...original,
      traits: [{
        name: 'Limited Magic Immunity',
        description: 'Unaffected by spells of 6th level or lower unless willing.',
        automation: 'headless' as const,
        rule: {
          kind: 'limited-magic-immunity' as const,
          maximumSpellLevel: 6,
          advantageAboveMaximum: true,
          allowsWilling: true,
        },
      }],
    }

    const draft = dnd5eCustomMonsterDraftFromStatBlock(imported)
    expect(draft.traits).toContainEqual(expect.objectContaining({
      ruleKind: 'limited-magic-immunity',
      limitedMagicImmunityMaximumSpellLevel: 6,
      limitedMagicImmunityAdvantageAboveMaximum: true,
      limitedMagicImmunityAllowsWilling: true,
    }))

    draft.preservedStatBlock = undefined
    const rebuilt = buildDnd5eCustomMonster(draft)
    expect(rebuilt.traits).toContainEqual(expect.objectContaining({
      automation: 'headless',
      rule: {
        kind: 'limited-magic-immunity',
        maximumSpellLevel: 6,
        advantageAboveMaximum: true,
        allowsWilling: true,
      },
    }))
    expect(parseDnd5eMonsterStatBlock(rebuilt).ok).toBe(true)
  })

  it('accepts legacy drafts without advanced defense fields and never infers them from prose', () => {
    const legacyDraft = createDnd5eCustomMonsterDraft()
    legacyDraft.description = '免疫非魔法且未镀银武器造成的伤害。'

    const monster = buildDnd5eCustomMonster(legacyDraft)
    expect(monster.damageDefenseRules).toBeUndefined()
    expect(monster.unparsedDamageDefenses).toBeUndefined()
  })

  it('preserves legendary, lair and spellcasting capabilities across a form save', () => {
    const original = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const imported = {
      ...original,
      legendaryResistanceUses: 3,
      legendaryActions: [{
        id: 'legendary-step', name: '传奇步伐', description: '移动至多一半速度。',
        kind: 'other' as const, legendaryCost: 1, automation: 'dm-adjudication' as const,
      }],
      lairActions: [{
        id: 'lair-tremor', name: '巢穴震动', description: '巢穴地面发生震动。',
        kind: 'other' as const, automation: 'dm-adjudication' as const,
      }],
      spellcasting: {
        description: '该怪物是一名 5 级施法者。', casterLevel: 5, ability: 'int' as const,
        saveDc: 14, attackBonus: 6, slots: { '3': 1 },
        spells: [{ id: 'fireball', name: '火球术', level: 3 }],
        automation: 'headless' as const,
      },
      capabilities: {
        ...original.capabilities!, legendary: true, spellcaster: true,
      },
    }

    const rebuilt = buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(imported))
    expect(rebuilt).toMatchObject({
      legendaryResistanceUses: 3,
      legendaryActions: [{ id: 'legendary-step', legendaryCost: 1 }],
      lairActions: [{ id: 'lair-tremor' }],
      spellcasting: { casterLevel: 5, ability: 'int', saveDc: 14 },
      capabilities: { legendary: true, spellcaster: true },
    })
  })

  it('rejects malformed capability metadata at the schema boundary', () => {
    const monster = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    expect(parseDnd5eMonsterStatBlock({
      ...monster,
      capabilities: { ...monster.capabilities, legendary: 'yes' },
    }).ok).toBe(false)
    expect(parseDnd5eMonsterStatBlock({ ...monster, legendaryResistanceUses: -1 }).ok).toBe(false)
  })

  it('round-trips portraits, defenses, equipment, action economy and daily uses', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.armorClassNote = '天然护甲与盾牌'
    draft.savingThrows = { con: 6, wis: 4 }
    draft.damageResistances = ['fire']
    draft.conditionImmunities = ['frightened']
    draft.tokenPortrait = 'data:image/png;base64,AA=='
    draft.initiativePortrait = 'data:image/webp;base64,AA=='
    draft.actions[0] = {
      ...draft.actions[0],
      usageKind: 'per-day',
      usageMax: 3,
      additionalDamage: [{ id: 'fire', dice: '1d6', damageType: 'fire' }],
      criticalThreshold: 19,
      criticalExtraDamage: [{ id: 'brutal', dice: '1d8', damageType: 'slashing' }],
      onHitSaveEnabled: true,
      onHitSaveAbility: 'con',
      onHitSaveDc: 14,
      onHitCondition: 'stunned',
    }
    draft.equipment = [{
      id: 'veteran-blade',
      name: '老兵长剑',
      category: 'weapon',
      quantity: 1,
      description: '与长剑攻击关联。',
      linkedActionId: draft.actions[0].id,
    }]
    draft.actions.push({
      ...createDnd5eCustomMonsterDraft().actions[0],
      id: 'legendary-cut',
      name: '传奇斩击',
      category: 'legendary',
      legendaryCost: 2,
      referencedActionId: draft.actions[0].id,
    })

    const monster = buildDnd5eCustomMonster(draft)
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(monster).toMatchObject({
      armorClass: { note: '天然护甲与盾牌' },
      savingThrows: { con: 6, wis: 4 },
      damageResistances: ['fire'],
      conditionImmunities: ['frightened'],
      equipment: [{ id: 'veteran-blade', linkedActionId: draft.actions[0].id }],
      actions: [expect.objectContaining({
        usage: { kind: 'per-day', max: 3 },
        attack: expect.objectContaining({
          damage: [expect.anything(), expect.objectContaining({ type: 'fire' })],
          criticalThreshold: 19,
          criticalExtraDamage: [{ average: 4, count: 1, sides: 8, bonus: 0, type: 'slashing' }],
          onHitRule: { kind: 'saving-throw-condition', ability: 'con', dc: 14, condition: 'stunned' },
        }),
      })],
      legendaryActions: [expect.objectContaining({
        id: 'legendary-cut',
        legendaryCost: 2,
        referencedActionId: draft.actions[0].id,
      })],
    })
    expect(dnd5eCustomMonsterDraftFromStatBlock(monster)).toMatchObject({
      tokenPortrait: draft.tokenPortrait,
      initiativePortrait: draft.initiativePortrait,
      actions: [
        expect.objectContaining({
          usageKind: 'per-day',
          usageMax: 3,
          onHitCondition: 'stunned',
          criticalThreshold: 19,
          criticalExtraDamage: [expect.objectContaining({ dice: '1d8', damageType: 'slashing' })],
        }),
        expect.objectContaining({ category: 'legendary', legendaryCost: 2 }),
      ],
    })
  })

  it('round-trips a Headless standard-condition removal mechanism', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'shake-it-off',
      name: 'Shake It Off',
      trigger: 'turn-start',
      effectKind: 'remove-standard-condition',
      effectTarget: 'self',
      condition: 'frightened',
    }]
    const monster = buildDnd5eCustomMonster(draft)
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(monster.headlessMechanics?.[0]).toMatchObject({
      schemaVersion: 2,
      effects: [{
        id: 'effect-0',
        kind: 'remove-standard-condition',
        target: 'self',
        condition: 'frightened',
      }],
    })
    expect(dnd5eCustomMonsterDraftFromStatBlock(monster).headlessMechanics[0]).toMatchObject({
      effectKind: 'remove-standard-condition',
      condition: 'frightened',
    })
  })

  it('round-trips a subject, movement trigger and roll modifier chain', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'pack-movement-bonus',
      name: '协同突进',
      triggerSubject: 'ally-within',
      triggerRadiusFeet: 30,
      trigger: 'movement',
      movementComparison: 'at-least',
      movementFeet: 20,
      effectKind: 'roll-modifier',
      effectTarget: 'selected-subject',
      modifierRoll: 'attack',
      modifierMode: 'bonus',
      modifierBonus: 2,
    }]

    const monster = buildDnd5eCustomMonster(draft)
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(monster.headlessMechanics?.[0]).toMatchObject({
      trigger: {
        event: 'movement',
        subject: 'ally-within',
        radiusFeet: 30,
        movement: { comparison: 'at-least', feet: 20 },
      },
      effects: [{
        kind: 'roll-modifier',
        target: 'selected-subject',
        roll: 'attack',
        mode: 'bonus',
        bonus: 2,
      }],
    })
    expect(dnd5eCustomMonsterDraftFromStatBlock(monster).headlessMechanics[0]).toMatchObject({
      triggerSubject: 'ally-within',
      triggerRadiusFeet: 30,
      trigger: 'movement',
      movementComparison: 'at-least',
      movementFeet: 20,
      effectKind: 'roll-modifier',
      modifierBonus: 2,
    })
  })

  it('round-trips a triggered attack with typed damage', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'stunning-charge-reaction',
      name: '震慑冲锋',
      trigger: 'movement',
      triggerSubject: 'hostile-within',
      triggerRadiusFeet: 30,
      effectKind: 'attack',
      effectTarget: 'selected-subject',
      attackToHit: 13,
      healingDice: '5d6+12',
      damageType: 'piercing',
    }]

    const monster = buildDnd5eCustomMonster(draft)
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(monster.headlessMechanics?.[0]).toMatchObject({
      effects: [{
        kind: 'attack',
        target: 'selected-subject',
        toHit: 13,
        damage: { average: 29, count: 5, sides: 6, bonus: 12, type: 'piercing' },
      }],
    })
    expect(dnd5eCustomMonsterDraftFromStatBlock(monster).headlessMechanics[0]).toMatchObject({
      effectKind: 'attack',
      attackToHit: 13,
      healingDice: '5d6+12',
      damageType: 'piercing',
    })
  })

  it('stores fixed triggered-attack damage without inventing a random die', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'fixed-reprisal',
      name: '固定反击',
      trigger: 'when-hit',
      effectKind: 'attack',
      effectTarget: 'trigger-target',
      attackDamageMode: 'fixed',
      attackFixedDamage: 9,
      damageType: 'slashing',
    }]

    const monster = buildDnd5eCustomMonster(draft)
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(monster.headlessMechanics?.[0]).toMatchObject({
      effects: [{
        kind: 'attack',
        damage: { average: 9, count: 0, sides: 2, bonus: 9, type: 'slashing' },
      }],
    })
    expect(dnd5eCustomMonsterDraftFromStatBlock(monster).headlessMechanics[0]).toMatchObject({
      attackDamageMode: 'fixed',
      attackFixedDamage: 9,
    })
  })
})
