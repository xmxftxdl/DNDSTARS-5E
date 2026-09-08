import { describe, expect, it } from 'vitest'
import {
  applyDnd5eActiveEffect,
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  dnd5eActiveAbilityCheckAdvantages,
  dnd5eActiveAbilityCheckDisadvantages,
  dnd5eActiveActionOrBonusActionOnly,
  dnd5eActiveActionSpellDelay,
  dnd5eActiveActionRestriction,
  dnd5eActiveArmorClassBonus,
  dnd5eActiveCarryingCapacityMultiplier,
  dnd5eActiveConditionImmunities,
  dnd5eActiveDarkvisionRangeFeet,
  dnd5eActiveEffectsPreventReactions,
  dnd5eActiveEffectsSeeInvisible,
  dnd5eActiveEmittedLight,
  dnd5eActiveEnvironmentalCapabilities,
  dnd5eActiveFlySpeed,
  dnd5eActiveHoverWhileFlying,
  dnd5eIncomingConditionImmunityBlocks,
  dnd5eActiveJumpDistanceMultiplier,
  dnd5eActiveLanguageCapabilities,
  dnd5eActiveMaximumAttacksPerTurn,
  dnd5eActiveMovementBoundarySaves,
  dnd5eActiveOptionalBonusDice,
  dnd5eActiveResistanceToAllDamage,
  dnd5eActiveSavingThrowBonus,
  dnd5eActiveSavingThrowDisadvantages,
  dnd5eActiveSizeRankDelta,
  dnd5eActiveSafeFallFeet,
  dnd5eActiveRequiresFlightMovement,
  dnd5eActiveSpeedOverride,
  dnd5eActiveSpeedPenalty,
  dnd5eActiveSpeedMultiplier,
  dnd5eActiveStrengthRollFlags,
  dnd5eActiveTargetLinkedAttackRollFlags,
  dnd5eActiveTrackingCapability,
  dnd5eActiveWeaponDamageD4Mode,
  dnd5eActiveWeaponDamageReplacementApplies,
  dnd5eAvailableRestrictedExtraActionKinds,
  dnd5eConditionsFromActiveEffects,
  dnd5eEscapableGrapples,
  normalizeDnd5eActiveEffects,
  reconcileDnd5eCompoundRepeatSaveEffects,
  removeDnd5eActiveEffectsByStandardCondition,
  removeDnd5eActiveEffectsForEvent,
  removeDnd5eTurnBoundAfterEffectsAtCombatEnd,
  validateDnd5eActiveEffectsStrict,
  validateDnd5eSourceBoundConditions,
} from './activeEffects'
import {
  activeEffectFromDnd5eTimedEffect,
  migrateDnd5eCombatStateEffects,
  migrateDnd5eTimedEffects,
  migrateLegacyDnd5eConditions,
} from './legacyActiveEffectMigration'

describe('D&D 5e ActiveEffectInstance', () => {
  it('clears only turn-bound post-effect restrictions when combat ends', () => {
    const hasteLethargy = createDnd5eMechanicalEffect({
      definitionId: 'activity:haste:effect:after-effect-ends',
      label: '加速术（结束后）',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'haste:after-effect-ends', magical: true },
      targetId: 'wizard',
      duration: { type: 'until-turn-boundary', boundary: 'target-turn-end' },
      modifiers: { preventActions: true, speedOverrideFeet: 0 },
    })
    const windWalkTransition = createDnd5eMechanicalEffect({
      definitionId: 'activity:wind-walk:effect:after-effect-ends',
      label: '御风而行（结束后）',
      source: { kind: 'spell', actorId: 'druid', rulesId: 'wind-walk:after-effect-ends', magical: true },
      targetId: 'druid',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: { controlledDescent: { maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true } },
    })
    const ordinaryTurnEffect = createDnd5eMechanicalEffect({
      definitionId: 'activity:ordinary-turn-effect',
      label: '普通回合效果',
      source: { kind: 'spell', actorId: 'fighter', rulesId: 'ordinary-turn-effect', magical: true },
      targetId: 'fighter',
      duration: { type: 'until-turn-boundary', boundary: 'source-turn-end' },
      modifiers: { speedBonusFeet: 10 },
    })

    const result = removeDnd5eTurnBoundAfterEffectsAtCombatEnd([
      hasteLethargy,
      windWalkTransition,
      ordinaryTurnEffect,
    ])

    expect(result.removed.map((effect) => effect.id)).toEqual([hasteLethargy.id])
    expect(result.effects.map((effect) => effect.id)).toEqual([
      windWalkTransition.id,
      ordinaryTurnEffect.id,
    ])
  })

  it('exposes an unused Haste action only for the current turn', () => {
    const haste = createDnd5eMechanicalEffect({
      id: 'haste-effect',
      definitionId: 'activity:haste:effect',
      label: '加速术',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'haste', magical: true },
      targetId: 'wizard',
      modifiers: {
        restrictedExtraAction: {
          allowedActions: ['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'],
          maximumWeaponAttacks: 1,
        },
      },
    })

    expect(dnd5eAvailableRestrictedExtraActionKinds({
      effects: [haste], usesByEffect: undefined, turnKey: 'combat:1:wizard',
    })).toEqual(['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'])
    expect(dnd5eAvailableRestrictedExtraActionKinds({
      effects: [haste], usesByEffect: { 'haste-effect': 'combat:1:wizard' }, turnKey: 'combat:1:wizard',
    })).toEqual([])
    expect(dnd5eAvailableRestrictedExtraActionKinds({
      effects: [haste], usesByEffect: { 'haste-effect': 'combat:1:wizard' }, turnKey: 'combat:2:wizard',
    })).toEqual(['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'])
  })

  it('blocks a DM-added charm from a celestial while Protection from Evil and Good is active', () => {
    const protection = createDnd5eMechanicalEffect({
      definitionId: 'activity:protection-from-evil-and-good',
      label: '防护善恶',
      source: { kind: 'spell', actorId: 'cleric', rulesId: 'protection-from-evil-and-good', magical: true },
      targetId: 'target',
      modifiers: {
        conditionImmunitiesBySourceCreatureType: [{
          conditions: ['charmed', 'frightened', 'possessed'],
          sourceCreatureTypes: ['aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead'],
        }],
      },
    })
    const charm = createDnd5eConditionEffect({
      id: 'dm:target:charmed',
      condition: 'charmed',
      targetId: 'target',
      source: { kind: 'dm', actorId: 'deva', actorName: '天界生物' },
    })

    expect(dnd5eIncomingConditionImmunityBlocks({
      currentEffects: [protection],
      nextEffects: [protection, charm],
      sourceCreatureTypesByActorId: { deva: ['天界生物'] },
    })).toEqual([expect.objectContaining({
      condition: 'charmed',
      reason: 'source-creature-type',
      sourceCreatureTypes: ['天界生物'],
    })])
    expect(dnd5eIncomingConditionImmunityBlocks({
      currentEffects: [protection],
      nextEffects: [protection, charm],
      sourceCreatureTypesByActorId: { deva: ['类人生物'] },
    })).toEqual([])
    expect(dnd5eIncomingConditionImmunityBlocks({
      currentEffects: [protection, charm],
      nextEffects: [protection],
      sourceCreatureTypesByActorId: { deva: ['天界生物'] },
    })).toEqual([])
  })

  it('preserves Calm Emotions indifference targets beyond the tag limit', () => {
    const targetIds = Array.from({ length: 40 }, (_, index) => `combatant-${index + 1}`)
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:calm-emotions:indifferent',
      label: '安定心神：漠然',
      source: { kind: 'spell', actorId: 'cleric', pluginId: 'srd-5.1' },
      targetId: 'bandit',
      tags: ['calm-emotions:indifferent'],
      modifiers: { calmEmotionsIndifferentTargetIds: targetIds },
    })

    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(normalizeDnd5eActiveEffects([structuredClone(effect)])[0]?.modifiers
      ?.calmEmotionsIndifferentTargetIds).toEqual(targetIds)
  })

  it('preserves only validated temporary Activity grants on authoritative effects', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'activity:levitate-control', label: 'Levitate control',
      source: { kind: 'spell', actorId: 'wizard', pluginId: 'srd-5.1' },
      targetId: 'wizard', grantedActivities: ['spell:levitate:move'],
    })
    expect(normalizeDnd5eActiveEffects([effect])[0]?.grantedActivities)
      .toEqual(['spell:levitate:move'])
    expect(normalizeDnd5eActiveEffects([{
      ...effect,
      grantedActivities: ['../../forged'],
    }])).toEqual([])
  })

  it('upgrades persisted Magic Jar controllers with the return-to-body lifecycle action', () => {
    const legacyController = createDnd5eMechanicalEffect({
      definitionId: 'activity:magic-jar:magic-jar-controller:modifiers:0',
      label: '魔魂壶·灵魂容器',
      source: {
        kind: 'spell', actorId: 'wizard', pluginId: 'srd-5.1', rulesId: 'magic-jar',
      },
      targetId: 'wizard',
      grantedActivities: ['spell:magic-jar:possess', 'spell:magic-jar:return'],
    })
    expect(normalizeDnd5eActiveEffects([legacyController])[0]?.grantedActivities).toEqual([
      'spell:magic-jar:possess',
      'spell:magic-jar:return',
      'spell:magic-jar:return-body',
    ])
  })

  it('projects mundane tracking suppression without hiding ordinary movement state', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'activity:pass-without-trace', label: 'Pass Without Trace',
      source: { kind: 'spell', actorId: 'druid', magical: true }, targetId: 'target',
      modifiers: {
        trackingCapability: { mundaneTracking: 'impossible', leavesTracks: false },
      },
    })
    expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(true)
    expect(dnd5eActiveTrackingCapability([effect])).toEqual({
      mundaneTrackingPossible: false,
      leavesTracks: false,
    })
    expect(dnd5eActiveTrackingCapability([])).toEqual({
      mundaneTrackingPossible: true,
      leavesTracks: true,
    })
  })

  it('matches conditional incoming attack disadvantage by canonical creature type', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'activity:typed-protection', label: 'Typed protection',
      source: { kind: 'spell', actorId: 'caster', magical: true }, targetId: 'target',
      modifiers: { attacksAgainstTargetDisadvantageCreatureTypes: ['fiend', 'undead'] },
    })
    expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(true)
    expect(dnd5eActiveTargetLinkedAttackRollFlags([effect], 'attacker', '邪魔').disadvantage).toBe(true)
    expect(dnd5eActiveTargetLinkedAttackRollFlags([effect], 'attacker', '亡灵').disadvantage).toBe(true)
    expect(dnd5eActiveTargetLinkedAttackRollFlags([effect], 'attacker', 'humanoid').disadvantage).toBe(false)
  })

  it('ignores only magical speed reductions while preserving mundane ones', () => {
    const freedom = createDnd5eMechanicalEffect({
      definitionId: 'activity:freedom-of-movement', label: 'Freedom of Movement',
      source: { kind: 'spell', actorId: 'cleric', magical: true }, targetId: 'target',
      modifiers: { ignoreMagicalSpeedReductions: true },
    })
    const magicalSlow = createDnd5eMechanicalEffect({
      definitionId: 'activity:slow', label: 'Slow',
      source: { kind: 'spell', actorId: 'wizard', magical: true }, targetId: 'target',
      modifiers: { speedPenaltyFeet: 10, speedMultiplier: 0.5 },
    })
    const mud = createDnd5eMechanicalEffect({
      definitionId: 'hazard:mud', label: 'Mud',
      source: { kind: 'system', magical: false }, targetId: 'target',
      modifiers: { speedPenaltyFeet: 5 },
    })
    expect(dnd5eActiveSpeedPenalty([freedom, magicalSlow, mud])).toBe(5)
    expect(dnd5eActiveSpeedMultiplier([freedom, magicalSlow, mud])).toBe(1)
  })

  it('temporarily suppresses existing magical restraint without deleting its source effect', () => {
    const restrained = createDnd5eConditionEffect({
      id: 'magical-restraint', condition: 'restrained', targetId: 'target',
      source: { kind: 'spell', actorId: 'enemy', rulesId: 'web', magical: true },
    })
    const freedom = createDnd5eMechanicalEffect({
      definitionId: 'activity:freedom-of-movement', label: 'Freedom of Movement',
      source: { kind: 'spell', actorId: 'cleric', magical: true }, targetId: 'target',
      modifiers: {
        conditionImmunitiesBySourceMagic: [{
          conditions: ['paralyzed', 'restrained'], sourceMagical: true, suppressExisting: true,
        }],
      },
    })
    expect(normalizeDnd5eActiveEffects([restrained, freedom])).toHaveLength(2)
    expect(dnd5eConditionsFromActiveEffects([restrained, freedom])).not.toContain('restrained')
    expect(dnd5eConditionsFromActiveEffects([restrained])).toContain('restrained')
  })

  it('normalizes delayed on-hit riders and projects their emitted light fail-closed', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:branding-smite',
      label: 'Branding Smite',
      source: { kind: 'spell', actorId: 'paladin', rulesId: 'branding-smite', magical: true },
      targetId: 'target',
      modifiers: {
        onHitBonusDamage: {
          count: 2, sides: 6, bonus: 0, damageType: 'radiant',
          appliesTo: 'all-weapon-attacks', doubleDiceOnCritical: true,
          oncePerTurn: false, consumeEffectOnHit: true,
          onHitTargetEffect: {
            revealInvisible: true, preventInvisibility: true,
            emittedLight: { brightRadiusFeet: 0, dimRadiusFeet: 5, color: '#fef3c7' },
          },
        },
        emittedLight: {
          brightRadiusFeet: 0, dimRadiusFeet: 5, color: '#fef3c7', sunlight: true,
        },
      },
    })

    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    const normalized = normalizeDnd5eActiveEffects([structuredClone(effect)])
    expect(normalized).toHaveLength(1)
    expect(dnd5eActiveEmittedLight(normalized)).toEqual({
      brightRadiusFeet: 0, dimRadiusFeet: 5, color: '#fef3c7', sunlight: true,
    })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: {
        ...effect.modifiers,
        emittedLight: { brightRadiusFeet: -1, dimRadiusFeet: 5, color: 'yellow' },
      },
    }])).toMatchObject({ ok: false })
  })

  it('projects language permissions while preserving touch and reading-time limits', () => {
    const comprehend = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:comprehend-languages',
      label: '通晓语言',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'comprehend-languages' },
      targetId: 'wizard',
      modifiers: {
        languageCapabilities: {
          understandSpoken: 'all',
          understandWritten: 'literal-written',
          writtenRequiresTouch: true,
          writtenMinutesPerPage: 1,
        },
      },
    })
    const tongues = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:tongues',
      label: '巧言术',
      source: { kind: 'spell', actorId: 'cleric', rulesId: 'tongues' },
      targetId: 'wizard',
      modifiers: {
        languageCapabilities: {
          understandSpoken: 'all',
          speechUnderstoodBy: 'any-creature-knowing-a-language',
        },
      },
    })

    expect(validateDnd5eActiveEffectsStrict([comprehend, tongues])).toMatchObject({ ok: true })
    expect(dnd5eActiveLanguageCapabilities([comprehend, tongues])).toEqual({
      understandSpoken: true,
      understandLiteralWritten: true,
      writtenRequiresTouch: true,
      writtenMinutesPerPage: 1,
      speechUnderstoodByAnyLanguageKnower: true,
      understandLanguagesRestricted: false,
      intelligibleCommunicationRestricted: false,
    })
    expect(dnd5eActiveLanguageCapabilities([{ ...comprehend, suspendedBy: ['antimagic-field'] }]))
      .toMatchObject({ understandSpoken: false, understandLiteralWritten: false })

    const feeblemind = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:feeblemind',
      label: '弱智术',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'feeblemind' },
      targetId: 'wizard',
      modifiers: {
        languageRestriction: {
          understandLanguages: false,
          intelligibleCommunication: false,
        },
      },
    })
    expect(validateDnd5eActiveEffectsStrict([feeblemind])).toMatchObject({ ok: true })
    expect(dnd5eActiveLanguageCapabilities([comprehend, tongues, feeblemind])).toEqual({
      understandSpoken: false,
      understandLiteralWritten: false,
      writtenRequiresTouch: false,
      writtenMinutesPerPage: undefined,
      speechUnderstoodByAnyLanguageKnower: false,
      understandLanguagesRestricted: true,
      intelligibleCommunicationRestricted: true,
    })
  })

  it('projects environmental survival permissions and excludes suspended magic', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:water-breathing', label: '水下呼吸',
      source: { kind: 'spell', actorId: 'druid', rulesId: 'water-breathing' }, targetId: 'ally',
      modifiers: { environmentalCapabilities: { breatheIn: ['water'] } },
    })
    expect(dnd5eActiveEnvironmentalCapabilities([effect])).toEqual({
      canBreatheWater: true,
      treatsLiquidSurfacesAsSolidGround: false,
      ignoresDifficultTerrain: false,
      ignoresUnderwaterMovementPenalty: false,
      ignoresUnderwaterAttackPenalty: false,
      canOccupyCreatureSpaces: false,
      minimumPassageGapInches: undefined,
    })
    expect(dnd5eActiveEnvironmentalCapabilities([{ ...effect, suspendedBy: ['antimagic-field'] }]))
      .toEqual({
        canBreatheWater: false, treatsLiquidSurfacesAsSolidGround: false,
        ignoresDifficultTerrain: false, ignoresUnderwaterMovementPenalty: false,
        ignoresUnderwaterAttackPenalty: false,
        canOccupyCreatureSpaces: false,
        minimumPassageGapInches: undefined,
      })
  })

  it('combines action restrictions and hover capabilities fail-closed', () => {
    const gaseous = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:gaseous-form', label: '气化形体',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'gaseous-form', magical: true },
      targetId: 'ally',
      modifiers: {
        flySpeedFeet: 10,
        hoverWhileFlying: true,
        actionRestriction: {
          prohibited: ['attack', 'spellcasting', 'object-interaction', 'speech'],
        },
        environmentalCapabilities: { occupyCreatureSpaces: true, minimumPassageGapInches: 1 },
      },
    })
    expect(validateDnd5eActiveEffectsStrict([gaseous])).toMatchObject({ ok: true })
    expect(dnd5eActiveActionRestriction([gaseous])).toEqual({
      prohibited: ['attack', 'spellcasting', 'object-interaction', 'speech'],
    })
    expect(dnd5eActiveEnvironmentalCapabilities([gaseous]).canOccupyCreatureSpaces).toBe(true)
    expect(dnd5eActiveEnvironmentalCapabilities([gaseous]).minimumPassageGapInches).toBe(1)
    expect(dnd5eActiveRequiresFlightMovement([gaseous])).toBe(true)
    expect(dnd5eActiveFlySpeed([gaseous])).toBe(10)
    expect(dnd5eActiveHoverWhileFlying([gaseous])).toBe(true)
    expect(dnd5eActiveSpeedOverride([gaseous])).toBe(10)
  })
  it('fails closed when a source-bound condition has no resolvable source creature', () => {
    const charmed = createDnd5eConditionEffect({
      condition: 'charmed', targetId: 'target', source: { kind: 'dm' },
    })
    const frightened = createDnd5eConditionEffect({
      condition: 'frightened', targetId: 'target', source: { kind: 'dm', actorId: 'source' },
    })
    const blinded = createDnd5eConditionEffect({
      condition: 'blinded', targetId: 'target', source: { kind: 'dm' },
    })

    expect(validateDnd5eSourceBoundConditions({
      effects: [charmed], targetActorId: 'target', availableActorIds: new Set(['source']),
    })).toMatchObject({ ok: false, reason: 'missing-source' })
    expect(validateDnd5eSourceBoundConditions({
      effects: [{ ...frightened, source: { ...frightened.source, actorId: 'target' } }],
      targetActorId: 'target',
      availableActorIds: new Set(['target']),
    })).toMatchObject({ ok: false, reason: 'self-source' })
    expect(validateDnd5eSourceBoundConditions({
      effects: [frightened], targetActorId: 'target', availableActorIds: new Set(['source']),
    })).toEqual({ ok: true })
    expect(validateDnd5eSourceBoundConditions({
      effects: [blinded], targetActorId: 'target', availableActorIds: new Set(),
    })).toEqual({ ok: true })
  })

  it('keeps suspended effects authoritative while excluding their conditions and modifiers', () => {
    const charmed = {
      ...createDnd5eConditionEffect({
        id: 'mindless-rage:charmed',
        condition: 'charmed',
        source: { kind: 'spell', actorId: 'caster', rulesId: 'charm-person' },
        targetId: 'berserker',
        duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      }),
      suspendedBy: ['class:berserker:mindless-rage'],
    }
    const dependent = {
      ...createDnd5eMechanicalEffect({
        id: 'mindless-rage:dependent',
        definitionId: 'test:charm-dependent',
        label: '魅惑依赖效果',
        source: { kind: 'spell', actorId: 'caster', rulesId: 'charm-person' },
        targetId: 'berserker',
        dependsOnEffectId: charmed.id,
        modifiers: { armorClassBonus: -2 },
      }),
      suspendedBy: ['class:berserker:mindless-rage'],
    }

    expect(normalizeDnd5eActiveEffects([charmed, dependent])).toHaveLength(2)
    expect(dnd5eConditionsFromActiveEffects([charmed, dependent])).toEqual([])
    expect(dnd5eActiveArmorClassBonus([charmed, dependent])).toBe(0)
    expect(validateDnd5eActiveEffectsStrict([charmed, dependent])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...charmed,
      suspendedBy: ['duplicate', 'duplicate'],
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('suspendedBy')]),
    })
  })

  it('normalizes and validates player-controlled optional bonus dice', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:guidance',
      label: '神导术',
      source: { kind: 'spell', actorId: 'cleric', rulesId: 'guidance' },
      targetId: 'ally',
      modifiers: {
        optionalBonusDie: {
          sides: 4,
          appliesTo: ['ability-check'],
          consumeOnUse: true,
        },
      },
    })
    expect(dnd5eActiveOptionalBonusDice([effect], 'ability-check')).toHaveLength(1)
    expect(dnd5eActiveOptionalBonusDice([effect], 'saving-throw')).toHaveLength(0)
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: {
        optionalBonusDie: {
          sides: 20,
          appliesTo: ['attack'],
          consumeOnUse: false,
        },
      },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('optionalBonusDie')]),
    })
  })

  it('normalizes reusable AC, saving throw, and all-damage resistance modifiers', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:warding-bond',
      label: '守护之链',
      source: { kind: 'spell', actorId: 'cleric' },
      targetId: 'ally',
      modifiers: {
        armorClassBonus: 1,
        savingThrowBonus: 1,
        savingThrowBonusByAbility: { dex: -2 },
        resistanceToAllDamage: true,
      },
    })
    expect(dnd5eActiveArmorClassBonus([effect])).toBe(1)
    expect(dnd5eActiveSavingThrowBonus([effect])).toBe(1)
    expect(dnd5eActiveSavingThrowBonus([effect], 'dex')).toBe(-1)
    expect(dnd5eActiveSavingThrowBonus([effect], 'wis')).toBe(1)
    expect(dnd5eActiveResistanceToAllDamage([effect])).toBe(true)
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: {
        armorClassBonus: 21,
        savingThrowBonus: Number.NaN,
        savingThrowBonusByAbility: { dex: -21 },
        resistanceToAllDamage: 'yes',
      },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.stringContaining('armorClassBonus'),
        expect.stringContaining('savingThrowBonus'),
        expect.stringContaining('savingThrowBonusByAbility'),
        expect.stringContaining('resistanceToAllDamage'),
      ]),
    })
  })

  it('normalizes the reusable see-invisible sight modifier', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:see-invisibility',
      label: '识破隐形',
      source: { kind: 'spell', actorId: 'wizard' },
      targetId: 'wizard',
      modifiers: { seeInvisible: true },
    })
    expect(dnd5eActiveEffectsSeeInvisible([effect])).toBe(true)
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: { seeInvisible: 'yes' },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('seeInvisible')]),
    })
  })

  it('normalizes reusable Enhance Ability modifiers and rejects malformed values', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'test:enhance-ability',
      label: '强化属性',
      source: { kind: 'spell', actorId: 'caster' },
      targetId: 'target',
      modifiers: {
        abilityCheckAdvantages: ['dex', 'dex'],
        carryingCapacityMultiplier: 2,
        safeFallFeet: 20,
      },
    })
    expect(dnd5eActiveAbilityCheckAdvantages([effect])).toEqual(['dex'])
    expect(dnd5eActiveCarryingCapacityMultiplier([effect])).toBe(2)
    expect(dnd5eActiveSafeFallFeet([effect])).toBe(20)
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: { ...effect.modifiers, abilityCheckAdvantages: ['luck'] },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('abilityCheckAdvantages')]),
    })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: { ...effect.modifiers, safeFallFeet: 2_000 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('safeFallFeet')]),
    })
  })

  it('normalizes and queries ability-check and saving-throw disadvantages', () => {
    const first = createDnd5eMechanicalEffect({
      definitionId: 'test:disadvantage:first',
      label: '能力检定与豁免劣势',
      source: { kind: 'monster', actorId: 'monster' },
      targetId: 'target',
      modifiers: {
        abilityCheckDisadvantages: ['str', 'str', 'dex'],
        savingThrowDisadvantages: ['wis', 'wis'],
      },
    })
    const second = createDnd5eMechanicalEffect({
      definitionId: 'test:disadvantage:second',
      label: '额外劣势',
      source: { kind: 'monster', actorId: 'monster' },
      targetId: 'target',
      modifiers: {
        abilityCheckDisadvantages: ['dex', 'con'],
        savingThrowDisadvantages: ['cha', 'wis'],
      },
    })

    expect(first.modifiers?.abilityCheckDisadvantages).toEqual(['str', 'dex'])
    expect(first.modifiers?.savingThrowDisadvantages).toEqual(['wis'])
    expect(dnd5eActiveAbilityCheckDisadvantages([first, second])).toEqual(['str', 'dex', 'con'])
    expect(dnd5eActiveSavingThrowDisadvantages([first, second])).toEqual(['wis', 'cha'])
    expect(validateDnd5eActiveEffectsStrict([first, second])).toMatchObject({ ok: true })

    const malformed = {
      ...first,
      modifiers: {
        ...first.modifiers,
        abilityCheckDisadvantages: ['luck'],
        savingThrowDisadvantages: 'wis',
      },
    }
    expect(normalizeDnd5eActiveEffects([malformed])[0].modifiers).toBeUndefined()
    expect(validateDnd5eActiveEffectsStrict([malformed])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.stringContaining('abilityCheckDisadvantages'),
        expect.stringContaining('savingThrowDisadvantages'),
      ]),
    })
  })

  it('deterministically migrates legacy standard and plugin condition strings', () => {
    const first = migrateLegacyDnd5eConditions({ targetId: 'hero', conditions: ['目盲', 'plugin:marked', 'blinded'] })
    const second = migrateLegacyDnd5eConditions({ targetId: 'hero', conditions: ['目盲', 'plugin:marked', 'blinded'] })
    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
    expect(first[0]).toMatchObject({ standardCondition: 'blinded', appliedAt: 0 })
    expect(dnd5eConditionsFromActiveEffects(first)).toEqual(['目盲', 'plugin:marked'])
  })

  it('collapses legacy compound effects to one repeat-save lifecycle', () => {
    const repeatSave = {
      ability: 'wis' as const, dc: 19, timing: 'target-turn-start' as const,
      successesRequired: 1, failuresRequired: 1,
      onFailureTransition: { outcome: 'retain-effect' as const },
      onSuccess: 'remove' as const,
    }
    const condition = createDnd5eConditionEffect({
      id: 'violet-blinded',
      definitionId: 'activity:prismatic-spray:prismatic-spray-violet',
      condition: 'blinded',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'prismatic-spray' },
      targetId: 'target',
      repeatSave,
    })
    const extension = createDnd5eMechanicalEffect({
      id: 'violet-extension',
      definitionId: 'activity:prismatic-spray:prismatic-spray-violet:extension',
      label: '虹光喷射·紫色目盲',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'prismatic-spray' },
      targetId: 'target',
      legacyCondition: 'prismatic-spray-violet-dm-planar-destination',
      repeatSave,
    })

    const reconciled = reconcileDnd5eCompoundRepeatSaveEffects([condition, extension])
    expect(reconciled.filter((effect) => effect.repeatSave)).toEqual([
      expect.objectContaining({ id: extension.id }),
    ])
    expect(reconciled.find((effect) => effect.id === condition.id)).toMatchObject({
      repeatSave: undefined,
      dependsOnEffectId: extension.id,
    })
  })

  it('rejects immunities and refreshes duplicate duration', () => {
    const existing = createDnd5eConditionEffect({
      condition: 'blinded', targetId: 'target', source: { kind: 'spell', actorId: 'caster' },
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' }, appliedAt: 1,
    })
    const incoming = { ...existing, id: 'new-id', duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' } as const }
    expect(applyDnd5eActiveEffect({ effects: [], incoming, conditionImmunities: ['blinded'] }).status)
      .toBe('rejected-immune')
    const refreshed = applyDnd5eActiveEffect({ effects: [existing], incoming })
    expect(refreshed.status).toBe('refreshed')
    expect(refreshed.effects).toEqual([expect.objectContaining({ id: existing.id, duration: incoming.duration })])
  })

  it('keeps every stack application even when the activity emits a deterministic instance id', () => {
    const incoming = createDnd5eMechanicalEffect({
      id: 'activity:illusory-script:marker',
      definitionId: 'activity:illusory-script:marker',
      label: '迷幻手稿',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'illusory-script' },
      targetId: 'caster',
      duration: { type: 'rounds', remainingRounds: 144_000, tickOn: 'target-turn-end' },
      stackingKey: 'activity:illusory-script:marker:caster',
      stackingPolicy: 'stack',
    })

    const first = applyDnd5eActiveEffect({ effects: [], incoming })
    const second = applyDnd5eActiveEffect({ effects: first.effects, incoming })
    const third = applyDnd5eActiveEffect({ effects: second.effects, incoming })

    expect(third.effects).toHaveLength(3)
    expect(third.effects.map((effect) => effect.id)).toEqual([
      'activity:illusory-script:marker',
      'activity:illusory-script:marker:stack-2',
      'activity:illusory-script:marker:stack-3',
    ])
  })

  it('removes matching break triggers without touching other effects', () => {
    const damage = createDnd5eConditionEffect({
      condition: 'charmed', targetId: 'target', source: { kind: 'feature' }, breakOn: ['takes-damage'],
    })
    const move = createDnd5eConditionEffect({
      condition: 'grappled', targetId: 'target', source: { kind: 'feature' }, breakOn: ['moves'],
    })
    const resolved = removeDnd5eActiveEffectsForEvent({ effects: [damage, move], trigger: 'takes-damage' })
    expect(resolved.removed.map((effect) => effect.standardCondition)).toEqual(['charmed'])
    expect(resolved.effects.map((effect) => effect.standardCondition)).toEqual(['grappled'])
  })

  it('mirrors and removes stale legacy timed effects', () => {
    const timed = {
      id: 'ray:caster:target', sourceActorId: 'caster', sourceSpellId: 'ray-of-frost',
      kind: 'speed-penalty' as const, amount: 10, expiresAt: 'source-next-turn-start' as const,
    }
    const mirrored = activeEffectFromDnd5eTimedEffect(timed, 'target')
    expect(mirrored).toMatchObject({ legacyTimedEffectId: timed.id, source: { actorId: 'caster' } })
    expect(migrateDnd5eTimedEffects({ targetId: 'target', timedEffects: [], activeEffects: [mirrored] })).toEqual([])
  })

  it('drops malformed shared/plugin lifecycle values at the runtime boundary', () => {
    expect(normalizeDnd5eActiveEffects([{
      schemaVersion: 1, id: 'bad', definitionId: 'condition:blinded', label: '坏状态', kind: 'condition',
      source: { kind: 'network' }, duration: { type: 'forever-and-ever' },
      stackingKey: 'bad', stackingPolicy: 'overwrite-everything',
    }])).toEqual([])
  })

  it('normalizes the whitelisted Jump and Heroism mechanical modifiers', () => {
    const jump = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:jump', label: '跳跃术', targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'jump' },
      modifiers: { jumpDistanceMultiplier: 3 },
    })
    const heroism = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:heroism', label: '英雄气概', targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'heroism' },
      modifiers: { conditionImmunities: ['frightened'] },
    })
    expect(dnd5eActiveJumpDistanceMultiplier([jump, heroism])).toBe(3)
    expect(dnd5eActiveConditionImmunities([jump, heroism])).toEqual(['frightened'])
    expect(validateDnd5eActiveEffectsStrict([jump, heroism])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...jump, modifiers: { jumpDistanceMultiplier: 0 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('jumpDistanceMultiplier')]),
    })
  })

  it('normalizes Darkvision as a maximum-range mechanical modifier', () => {
    const darkvision = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:darkvision',
      label: '黑暗视觉',
      targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'darkvision' },
      modifiers: { darkvisionRangeFeet: 60 },
    })
    expect(dnd5eActiveDarkvisionRangeFeet([darkvision])).toBe(60)
    expect(validateDnd5eActiveEffectsStrict([darkvision])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...darkvision,
      modifiers: { darkvisionRangeFeet: -1 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('darkvisionRangeFeet')]),
    })
  })

  it('normalizes Shillelagh weapon and spellcasting metadata but rejects forged values', () => {
    const shillelagh = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:shillelagh',
      label: '橡棍术',
      targetId: 'druid',
      source: { kind: 'spell', actorId: 'druid', rulesId: 'shillelagh' },
      modifiers: {
        shillelagh: {
          weaponId: 'dnd5e-club',
          spellcastingAbility: 'wis',
          spellcastingModifier: 4,
        },
      },
    })
    expect(validateDnd5eActiveEffectsStrict([shillelagh])).toMatchObject({ ok: true })
    expect(normalizeDnd5eActiveEffects([shillelagh])[0].modifiers?.shillelagh).toEqual({
      weaponId: 'dnd5e-club',
      spellcastingAbility: 'wis',
      spellcastingModifier: 4,
    })
    expect(validateDnd5eActiveEffectsStrict([{
      ...shillelagh,
      modifiers: {
        shillelagh: {
          weaponId: '',
          spellcastingAbility: 'luck',
          spellcastingModifier: 99,
        },
      },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('shillelagh')]),
    })
  })

  it('normalizes a granted flying speed and rejects unsafe values', () => {
    const flight = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:fly', label: '飞行术', targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'fly' },
      modifiers: { flySpeedFeet: 60 },
    })
    expect(dnd5eActiveFlySpeed([flight])).toBe(60)
    expect(validateDnd5eActiveEffectsStrict([flight])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...flight,
      modifiers: { flySpeedFeet: -1 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('flySpeedFeet')]),
    })
  })

  it('normalizes the whitelisted Enlarge/Reduce mechanical modifiers', () => {
    const enlarge = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:enlarge-reduce', label: '变巨', targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'enlarge-reduce' },
      modifiers: {
        sizeRankDelta: 1,
        strengthRollMode: 'advantage',
        weaponDamageD4: 'add',
      },
    })
    expect(dnd5eActiveSizeRankDelta([enlarge])).toBe(1)
    expect(dnd5eActiveStrengthRollFlags([enlarge])).toEqual({ advantage: true, disadvantage: false })
    expect(dnd5eActiveWeaponDamageD4Mode([enlarge])).toBe('add')
    expect(validateDnd5eActiveEffectsStrict([enlarge])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...enlarge,
      modifiers: { ...enlarge.modifiers, sizeRankDelta: 2 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('sizeRankDelta')]),
    })
  })

  it('normalizes a scoped Activity weapon damage replacement', () => {
    const replacement = createDnd5eMechanicalEffect({
      definitionId: 'activity:lightning-arrow:replacement', label: '闪电箭', targetId: 'ranger',
      source: { kind: 'spell', actorId: 'ranger', rulesId: 'lightning-arrow' },
      modifiers: { weaponDamageReplacementAttackModes: ['ranged'] },
    })
    expect(dnd5eActiveWeaponDamageReplacementApplies([replacement], 'ranged')).toBe(true)
    expect(dnd5eActiveWeaponDamageReplacementApplies([replacement], 'melee')).toBe(false)
    expect(dnd5eActiveWeaponDamageReplacementApplies([replacement], 'unarmed')).toBe(false)
    expect(normalizeDnd5eActiveEffects([replacement])[0].modifiers).toMatchObject({
      weaponDamageReplacementAttackModes: ['ranged'],
    })
    expect(validateDnd5eActiveEffectsStrict([replacement])).toMatchObject({ ok: true })
  })

  it('normalizes source-relative movement boundary saves', () => {
    const boundary = createDnd5eMechanicalEffect({
      definitionId: 'activity:compelled-duel:boundary', label: '强令对决', targetId: 'target',
      source: { kind: 'spell', actorId: 'paladin', rulesId: 'compelled-duel' },
      modifiers: { movementBoundarySave: { maximumDistanceFeet: 30, ability: 'wis', dc: 14 } },
    })
    expect(dnd5eActiveMovementBoundarySaves([boundary])).toEqual([{
      effectId: boundary.id,
      sourceActorId: 'paladin',
      maximumDistanceFeet: 30,
      ability: 'wis',
      dc: 14,
    }])
    expect(validateDnd5eActiveEffectsStrict([boundary])).toMatchObject({ ok: true })
  })

  it('normalizes and combines conservative slow-breath action modifiers', () => {
    const slowingBreath = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:slowing-breath', label: '迟缓吐息', targetId: 'target',
      source: { kind: 'monster', actorId: 'copper-dragon' },
      modifiers: {
        speedMultiplier: 0.5,
        maximumAttacksPerTurn: 1,
        actionOrBonusActionOnly: true,
      },
    })
    const stricterCap = createDnd5eMechanicalEffect({
      definitionId: 'test:attack-cap', label: '更严格上限', targetId: 'target',
      source: { kind: 'system' }, modifiers: { maximumAttacksPerTurn: 1 },
    })
    const slowSpell = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:slow', label: '缓慢术', targetId: 'target',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'slow' },
      modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 } },
    })
    expect(dnd5eActiveSpeedMultiplier([slowingBreath])).toBe(0.5)
    expect(dnd5eActiveMaximumAttacksPerTurn([slowingBreath, stricterCap])).toBe(1)
    expect(dnd5eActiveActionOrBonusActionOnly([slowingBreath])).toBe(true)
    expect(dnd5eActiveActionSpellDelay([slowSpell])).toEqual({ dieSides: 20, delayMinimum: 11 })
    expect(validateDnd5eActiveEffectsStrict([slowSpell])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([slowingBreath])).toMatchObject({ ok: true })
    expect(normalizeDnd5eActiveEffects([{
      ...slowingBreath,
      modifiers: { speedMultiplier: -0.1, maximumAttacksPerTurn: 1.5, actionOrBonusActionOnly: 'yes' },
    }])[0].modifiers).toBeUndefined()
    expect(validateDnd5eActiveEffectsStrict([{
      ...slowingBreath,
      modifiers: { speedMultiplier: -0.1, maximumAttacksPerTurn: 1.5, actionOrBonusActionOnly: 'yes' },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.stringContaining('speedMultiplier'),
        expect.stringContaining('maximumAttacksPerTurn'),
        expect.stringContaining('actionOrBonusActionOnly'),
      ]),
    })
  })

  it('strictly rejects malformed remote values instead of silently repairing them', () => {
    const effect = createDnd5eConditionEffect({
      id: 'blind', condition: 'blinded', targetId: 'target', source: { kind: 'dm' },
    })
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      duration: { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' },
    }])).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.stringContaining('remainingRounds')]) })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end', lastTickTurnKey: '' },
    }])).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.stringContaining('lastTickTurnKey')]) })
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, potency: 'lots' }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('potency')]),
    })
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, potency: Number.POSITIVE_INFINITY }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('potency')]),
    })
  })

  it('preserves bounded failed-save damage and alternative escape ability declarations', () => {
    const effect = createDnd5eConditionEffect({
      id: 'phantasm',
      condition: 'frightened',
      targetId: 'target',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'phantasmal-killer' },
      duration: {
        type: 'concentration',
        sourceActorId: 'wizard',
        concentrationId: 'phantasmal-killer',
        remainingRounds: 10,
      },
      repeatSave: {
        ability: 'wis',
        dc: 16,
        timing: 'target-turn-end',
        damageOnFailure: { count: 5, sides: 10, modifier: 0, type: 'psychic' },
        onSuccess: 'remove',
      },
      escapeCheck: {
        ability: 'str',
        alternativeAbility: 'dex',
        dc: 16,
        economy: 'action',
      },
    })
    expect(normalizeDnd5eActiveEffects([effect])).toEqual([effect])
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      repeatSave: {
        ...effect.repeatSave!,
        damageOnFailure: { count: 5, sides: 10, modifier: 0, type: 'not-damage' },
      },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('repeatSave')]),
    })
  })

  it('round-trips source-aware on-damage repeat saves', () => {
    const effect = createDnd5eConditionEffect({
      id: 'vampire-charm',
      condition: 'charmed',
      targetId: 'target',
      source: { kind: 'monster', actorId: 'vampire', rulesId: 'vampire:charm' },
      repeatSave: {
        ability: 'wis',
        dc: 17,
        timing: 'on-damage',
        onDamage: {
          mode: 'normal', sourceFilter: 'source-or-allies',
          advantageIfSourceOrAllies: true,
        },
        onSuccess: 'remove',
      },
    })
    expect(normalizeDnd5eActiveEffects([effect])).toEqual([effect])
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(normalizeDnd5eActiveEffects([{
      ...effect,
      repeatSave: {
        ...effect.repeatSave!,
        onDamage: { mode: 'normal', sourceFilter: 'not-a-source-filter' },
      },
    }])[0]?.repeatSave).toBeUndefined()
  })

  it('round-trips source-linked grapple relations and skill-based escape checks', () => {
    const relation = {
      schemaVersion: 1,
      kind: 'grapple',
      sourceActorId: 'ankheg',
      sourceActionId: 'bite',
      slotGroup: 'mandibles',
      maxDistanceFeet: 5,
      movement: 'drag-target',
      endsOnSourceIncapacitated: true,
    } as const
    const effect = createDnd5eConditionEffect({
      id: 'ankheg:bite:hero',
      condition: 'grappled',
      targetId: 'hero',
      source: { kind: 'monster', actorId: 'ankheg', rulesId: 'bite' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: 13,
        economy: 'action',
      },
      relation,
    })

    expect(effect.relation).toEqual(relation)
    expect(effect.relation).not.toBe(relation)
    expect(normalizeDnd5eActiveEffects([effect])).toEqual([effect])
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
  })

  it('exposes only authoritative grapple roots to player escape controls', () => {
    const monsterGrapple = createDnd5eConditionEffect({
      id: 'ankheg:bite:hero',
      condition: 'grappled',
      targetId: 'hero',
      source: { kind: 'monster', actorId: 'ankheg', rulesId: 'monster:srd-5.1:ankheg:bite:bite-grapple' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: 13,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'ankheg',
        sourceActionId: 'bite',
        slotGroup: 'bite',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const dependentCondition = createDnd5eConditionEffect({
      id: 'ankheg:bite:restrained:hero',
      condition: 'grappled',
      targetId: 'hero',
      source: monsterGrapple.source,
      duration: { type: 'permanent' },
      dependsOnEffectId: monsterGrapple.id,
    })
    const ordinaryCondition = createDnd5eConditionEffect({
      id: 'dm:grappled:hero',
      condition: 'grappled',
      targetId: 'hero',
      source: { kind: 'dm', actorId: 'dm' },
      duration: { type: 'permanent' },
    })

    expect(dnd5eEscapableGrapples([
      monsterGrapple,
      dependentCondition,
      ordinaryCondition,
      monsterGrapple,
    ])).toEqual([{
      effectId: monsterGrapple.id,
      grapplerId: 'ankheg',
      resolution: 'fixed-dc',
      dc: 13,
    }])
  })

  it('rejects malformed source-linked relations and mismatched escape skills', () => {
    const effect = createDnd5eConditionEffect({
      id: 'ankheg:bite:hero',
      condition: 'grappled',
      targetId: 'hero',
      source: { kind: 'monster', actorId: 'ankheg', rulesId: 'bite' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: 13,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'ankheg',
        sourceActionId: 'bite',
        slotGroup: 'mandibles',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })

    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      relation: { ...effect.relation!, sourceActorId: 'other-monster' },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('relation')]),
    })
    expect(normalizeDnd5eActiveEffects([{
      ...effect,
      relation: { ...effect.relation!, sourceActorId: 'other-monster' },
    }])).toEqual([])
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      relation: { ...effect.relation!, unexpected: true },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('relation')]),
    })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      escapeCheck: { ...effect.escapeCheck!, skill: 'acrobatics' },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('escapeCheck')]),
    })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      escapeCheck: { ...effect.escapeCheck!, alternativeSkill: 'athletics' },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('escapeCheck')]),
    })
  })

  it('fails closed when a grapple relation is not an independent grappled root', () => {
    const anchor = createDnd5eConditionEffect({
      id: 'anchor:prone',
      condition: 'prone',
      targetId: 'hero',
      source: { kind: 'monster', actorId: 'ankheg', rulesId: 'bite' },
    })
    const grapple = createDnd5eConditionEffect({
      id: 'ankheg:bite:hero',
      condition: 'grappled',
      targetId: 'hero',
      source: { kind: 'monster', actorId: 'ankheg', rulesId: 'bite' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: 13,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'ankheg',
        sourceActionId: 'bite',
        slotGroup: 'bite',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const relationOnRestrained = {
      ...grapple,
      standardCondition: 'restrained' as const,
    }
    const dependentRelation = {
      ...grapple,
      dependsOnEffectId: anchor.id,
    }

    expect(validateDnd5eActiveEffectsStrict([relationOnRestrained])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('relation')]),
    })
    expect(normalizeDnd5eActiveEffects([relationOnRestrained])).toEqual([])
    expect(validateDnd5eActiveEffectsStrict([anchor, dependentRelation])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('relation')]),
    })
    expect(normalizeDnd5eActiveEffects([anchor, dependentRelation])).toEqual([anchor])
  })

  it('cascades removal through source-specific effect dependencies', () => {
    const poisoned = createDnd5eConditionEffect({
      id: 'venom:poisoned',
      condition: 'poisoned',
      targetId: 'target',
      source: { kind: 'monster', actorId: 'spider', rulesId: 'venom' },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
    })
    const paralyzed = createDnd5eConditionEffect({
      id: 'venom:paralyzed',
      condition: 'paralyzed',
      targetId: 'target',
      source: { kind: 'monster', actorId: 'spider', rulesId: 'venom' },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      dependsOnEffectId: poisoned.id,
    })
    const removed = removeDnd5eActiveEffectsByStandardCondition({
      effects: [poisoned, paralyzed],
      condition: 'poisoned',
    })
    expect(removed.effects).toEqual([])
    expect(removed.removed.map((effect) => effect.id)).toEqual([
      poisoned.id,
      paralyzed.id,
    ])
  })

  it('rejects dangling, self-referencing, and cyclic effect dependencies at strict boundaries', () => {
    const parent = createDnd5eConditionEffect({
      id: 'parent',
      condition: 'poisoned',
      targetId: 'target',
      source: { kind: 'monster', actorId: 'spider', rulesId: 'venom' },
    })
    const child = createDnd5eConditionEffect({
      id: 'child',
      condition: 'paralyzed',
      targetId: 'target',
      source: { kind: 'monster', actorId: 'spider', rulesId: 'venom' },
      dependsOnEffectId: parent.id,
    })
    expect(validateDnd5eActiveEffectsStrict([parent, child])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([child])).toMatchObject({ ok: false })
    expect(validateDnd5eActiveEffectsStrict([{
      ...parent,
      dependsOnEffectId: parent.id,
    }])).toMatchObject({ ok: false })
    expect(validateDnd5eActiveEffectsStrict([
      { ...parent, dependsOnEffectId: child.id },
      { ...child, dependsOnEffectId: parent.id },
    ])).toMatchObject({ ok: false })
  })

  it('migrates old timed mechanics once and then treats them as native active effects', () => {
    const migrated = migrateDnd5eCombatStateEffects({
      targetId: 'target',
      conditions: ['blinded'],
      state: {
        timedEffects: [
          { id: 'slow', sourceActorId: 'caster', sourceSpellId: 'ray-of-frost', kind: 'speed-penalty', amount: 10, expiresAt: 'source-next-turn-start' },
          { id: 'shock', sourceActorId: 'caster', sourceSpellId: 'shocking-grasp', kind: 'reaction-lock', expiresAt: 'target-next-turn-start' },
        ],
      },
    })
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.conditions).toEqual(['blinded'])
    expect(dnd5eActiveSpeedPenalty(migrated.activeEffects)).toBe(10)
    expect(dnd5eActiveEffectsPreventReactions(migrated.activeEffects)).toBe(true)
    const second = migrateDnd5eCombatStateEffects({
      targetId: 'target', state: { schemaVersion: 2, activeEffects: migrated.activeEffects },
      conditions: migrated.conditions,
    })
    expect(second).toEqual(migrated)
  })
})
