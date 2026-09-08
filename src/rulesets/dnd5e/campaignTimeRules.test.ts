import { describe, expect, it } from 'vitest'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import type { Character } from '../../types/character'
import {
  applyDnd5eLongRestBenefits,
  applyDnd5eShortRestBenefits,
  compensateDnd5eCompletedLongCastEffects,
  dnd5eCampaignTimeControlledDescentDistanceFeet,
  dnd5eCampaignRepeatSaveD20,
  dnd5eCampaignRepeatSaveReductionRoll,
  reconcileDnd5eCharacterCampaignTime,
} from './campaignTimeRules'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { applyDnd5eInventoryGrantBundle, normalizeDnd5eInventory } from './items'
import { consumeDnd5eStoredD20Replacement, registerDnd5eRulesPlugin } from './pluginApi'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero', name: '测试角色', player: '玩家', avatar: '🛡️', accent: 'from-violet-500',
    race: '人类', charClass: '战士', level: 1, background: '士兵', experience: 0, reputation: 0,
    rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    savingThrows: ['str', 'con'], skills: [], maxHp: 12, currentHp: 1, tempHp: 0, hitDice: 'd10',
    ac: 16, speed: 30, initiativeBonus: 1, saveDC: 13, passivePerception: 10,
    inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

function clock(worldMinute: number, advances: SharedCampaignTimeState['advances']): SharedCampaignTimeState {
  return { schemaVersion: 2, worldMinute, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], advances, updatedAt: 1 }
}

describe('D&D 5e campaign-time reconciliation', () => {
  it('wakes a creature restored from zero hit points by a long rest without removing unrelated magical unconsciousness', () => {
    const zeroHitPointUnconscious = createDnd5eConditionEffect({
      id: 'zero-hp-unconscious', condition: 'unconscious',
      source: { kind: 'system', rulesId: 'zero-hit-points' }, targetId: 'hero',
    })
    const zeroHitPointProne = createDnd5eConditionEffect({
      id: 'zero-hp-prone', condition: 'prone',
      source: { kind: 'system', rulesId: 'zero-hit-points' }, targetId: 'hero',
    })
    const magicalUnconscious = createDnd5eConditionEffect({
      id: 'magical-unconscious', condition: 'unconscious',
      source: { kind: 'spell', actorId: 'archmage', rulesId: 'imprisonment-slumber' },
      targetId: 'hero',
    })

    const rested = applyDnd5eLongRestBenefits(character({
      currentHp: 0,
      conditions: ['unconscious', 'prone'],
      dnd5eCombatState: {
        activeEffects: [zeroHitPointUnconscious, zeroHitPointProne, magicalUnconscious],
      },
    }), 1_440)

    expect(rested.currentHp).toBe(rested.maxHp)
    expect(rested.conditions).toEqual(['prone'])
    expect(rested.dnd5eCombatState?.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'zero-hp-prone', standardCondition: 'prone' }),
      expect.objectContaining({ id: 'magical-unconscious', standardCondition: 'unconscious' }),
    ]))
    expect(rested.dnd5eCombatState?.activeEffects).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'zero-hp-unconscious' }),
    ]))
  })

  it('does not clear restoration-only ability loss on a short rest', () => {
    const rested = applyDnd5eShortRestBenefits(character({
      dnd5eCombatState: {
        abilityScoreReductionLedger: [{
          id: 'feeblemind:int', ability: 'int', amount: 9,
          recovery: 'restoration-magic', recoveryGroupId: 'spell.feeblemind',
        }, {
          id: 'ordinary-fatigue:str', ability: 'str', amount: 2,
          recovery: 'short-or-long-rest',
        }],
      },
    }))
    expect(rested.dnd5eCombatState?.abilityScoreReductionLedger).toEqual([
      expect.objectContaining({ id: 'feeblemind:int', recovery: 'restoration-magic' }),
    ])
  })

  it('schedules and authoritatively resolves fixed-interval campaign saves', () => {
    const dueWorldMinute = 43_200
    const findEffectId = (succeeds: boolean) => {
      for (let index = 0; index < 1_000; index += 1) {
        const id = `feeblemind-${succeeds ? 'success' : 'failure'}-${index}`
        const succeedsAtDc10 = dnd5eCampaignRepeatSaveD20(id, 'hero', dueWorldMinute) - 5 >= 10
        if (succeedsAtDc10 === succeeds) return id
      }
      throw new Error('Unable to select deterministic campaign-repeat-save fixture')
    }
    const affected = (effectId: string) => character({
      dnd5eWorldTimeAppliedMinute: 0,
      dnd5eCombatState: {
        abilityScoreReductionLedger: [{
          id: `${effectId}:int`, ability: 'int', amount: 9,
          recovery: 'restoration-magic', recoveryGroupId: 'spell.feeblemind',
        }],
        activeEffects: [createDnd5eMechanicalEffect({
          id: effectId,
          definitionId: 'activity:spell:feeblemind:modifiers:0',
          label: '弱智术',
          tags: ['feeblemind', 'ability-recovery-group:spell.feeblemind'],
          source: { kind: 'spell', actorId: 'caster', rulesId: 'feeblemind', spellSaveDc: 10 },
          targetId: 'hero',
          duration: { type: 'permanent' },
          calendarRepeatSave: {
            intervalMinutes: dueWorldMinute, ability: 'int', dc: 10, onSuccess: 'remove',
          },
        })],
      },
    })

    const failureId = findEffectId(false)
    const scheduled = reconcileDnd5eCharacterCampaignTime(affected(failureId), clock(0, []))
    expect(scheduled.changed).toBe(true)
    expect(scheduled.character.dnd5eCombatState?.activeEffects?.[0].calendarRepeatSave)
      .toMatchObject({ nextWorldMinute: dueWorldMinute })
    const failed = reconcileDnd5eCharacterCampaignTime(
      scheduled.character,
      clock(dueWorldMinute, []),
    )
    expect(failed.character.dnd5eCombatState?.activeEffects?.[0].calendarRepeatSave)
      .toMatchObject({
        nextWorldMinute: dueWorldMinute * 2,
        lastResolvedWorldMinute: dueWorldMinute,
      })
    expect(failed.character.dnd5eCombatState?.abilityScoreReductionLedger).toHaveLength(1)

    const successId = findEffectId(true)
    const succeeded = reconcileDnd5eCharacterCampaignTime(
      affected(successId),
      clock(dueWorldMinute, []),
    )
    expect(succeeded.character.dnd5eCombatState?.activeEffects).toBeUndefined()
    expect(succeeded.character.dnd5eCombatState?.abilityScoreReductionLedger).toBeUndefined()
    const replayed = reconcileDnd5eCharacterCampaignTime(succeeded.character, clock(dueWorldMinute, []))
    expect(replayed.changed).toBe(false)
  })

  it('keeps Death Dog disease after a successful daily save but worsens maximum HP on failure', () => {
    const dueWorldMinute = 1_440
    const findEffectId = (succeeds: boolean) => {
      for (let index = 0; index < 1_000; index += 1) {
        const id = `death-dog-${succeeds ? 'success' : 'failure'}-${index}`
        const succeedsAtDc12 = dnd5eCampaignRepeatSaveD20(id, 'hero', dueWorldMinute) + 2 >= 12
        if (succeedsAtDc12 === succeeds) return id
      }
      throw new Error('Unable to select deterministic Death Dog disease fixture')
    }
    const affected = (effectId: string) => character({
      currentHp: 12,
      savingThrows: [],
      dnd5eWorldTimeAppliedMinute: 0,
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          id: effectId,
          definitionId: 'srd-5.1:monster:death-dog:bite-disease',
          label: 'Death Dog Disease',
          tags: ['disease'],
          source: { kind: 'monster', actorId: 'death-dog', rulesId: 'bite' },
          targetId: 'hero',
          calendarRepeatSave: {
            intervalMinutes: dueWorldMinute,
            nextWorldMinute: dueWorldMinute,
            ability: 'con',
            dc: 12,
            onSuccess: 'retain',
            maximumHitPointReductionOnFailure: {
              average: 5, count: 1, sides: 10, bonus: 0,
              recovery: 'when-effect-removed',
            },
          },
        })],
      },
    })

    const successId = findEffectId(true)
    const succeeded = reconcileDnd5eCharacterCampaignTime(
      affected(successId),
      clock(dueWorldMinute, []),
    ).character
    expect(succeeded.maxHp).toBe(12)
    expect(succeeded.dnd5eCombatState?.activeEffects?.[0].calendarRepeatSave)
      .toMatchObject({ nextWorldMinute: dueWorldMinute * 2, onSuccess: 'retain' })

    const failureId = findEffectId(false)
    const expectedReduction = dnd5eCampaignRepeatSaveReductionRoll(
      failureId, 'hero', dueWorldMinute, 1, 10, 0,
    )
    const failed = reconcileDnd5eCharacterCampaignTime(
      affected(failureId),
      clock(dueWorldMinute, []),
    ).character
    expect(failed.maxHp).toBe(12 - expectedReduction)
    expect(failed.currentHp).toBe(12 - expectedReduction)
    expect(failed.dnd5eCombatState?.hitPointMaximumReductionLedger?.entries)
      .toEqual([expect.objectContaining({
        amount: expectedReduction,
        recovery: 'effect-removal',
        sourceEffectId: failureId,
      })])
    expect(failed.dnd5eCombatState?.activeEffects?.[0].calendarRepeatSave)
      .toMatchObject({ nextWorldMinute: dueWorldMinute * 2 })
  })

  it('removes Otyugh disease and restores its accumulated maximum HP reduction on a successful save', () => {
    const dueWorldMinute = 1_440
    let effectId = ''
    for (let index = 0; index < 1_000; index += 1) {
      const candidate = `otyugh-success-${index}`
      if (dnd5eCampaignRepeatSaveD20(candidate, 'hero', dueWorldMinute) + 2 >= 15) {
        effectId = candidate
        break
      }
    }
    expect(effectId).not.toBe('')
    const disease = createDnd5eMechanicalEffect({
      id: effectId,
      definitionId: 'srd-5.1:monster:otyugh:bite-disease',
      label: 'Otyugh Disease',
      tags: ['disease'],
      source: { kind: 'monster', actorId: 'otyugh', rulesId: 'bite' },
      targetId: 'hero',
      calendarRepeatSave: {
        intervalMinutes: dueWorldMinute,
        nextWorldMinute: dueWorldMinute,
        ability: 'con',
        dc: 15,
        onSuccess: 'remove',
        maximumHitPointReductionOnFailure: {
          average: 5, count: 1, sides: 10, bonus: 0,
          recovery: 'when-effect-removed',
        },
      },
    })
    const poisoned = createDnd5eMechanicalEffect({
      id: `${effectId}:poisoned`,
      definitionId: 'dnd5e-condition:poisoned',
      label: '中毒',
      source: { kind: 'monster', actorId: 'otyugh', rulesId: 'bite' },
      targetId: 'hero',
      dependsOnEffectId: effectId,
    })
    const resolved = reconcileDnd5eCharacterCampaignTime(character({
      maxHp: 8,
      currentHp: 8,
      savingThrows: [],
      dnd5eWorldTimeAppliedMinute: 0,
      dnd5eCombatState: {
        activeEffects: [disease, poisoned],
        hitPointMaximumReductionLedger: {
          schemaVersion: 1,
          baseMaximum: 12,
          entries: [{
            id: `campaign:${effectId}:0`,
            amount: 4,
            recovery: 'effect-removal',
            sourceEffectId: effectId,
          }],
        },
      },
    }), clock(dueWorldMinute, [])).character

    expect(resolved.maxHp).toBe(12)
    expect(resolved.currentHp).toBe(8)
    expect(resolved.dnd5eCombatState?.activeEffects).toBeUndefined()
    expect(resolved.dnd5eCombatState?.hitPointMaximumReductionLedger).toBeUndefined()
  })

  it('recovers a resurrection d20 penalty by one per completed long rest', () => {
    const raised = character({
      dnd5eCombatState: {
        resurrectionPenalty: { value: -4, recoveryPerLongRest: 1 },
      },
    })
    const first = applyDnd5eLongRestBenefits(raised, 1_440)
    const second = applyDnd5eLongRestBenefits(first, 2_880)
    const third = applyDnd5eLongRestBenefits(second, 4_320)
    const fourth = applyDnd5eLongRestBenefits(third, 5_760)
    expect(first.dnd5eCombatState?.resurrectionPenalty).toEqual({
      value: -3,
      recoveryPerLongRest: 1,
    })
    expect(second.dnd5eCombatState?.resurrectionPenalty?.value).toBe(-2)
    expect(third.dnd5eCombatState?.resurrectionPenalty?.value).toBe(-1)
    expect(fourth.dnd5eCombatState?.resurrectionPenalty).toBeUndefined()
  })

  it('ends Resurrection caster strain at a long rest while preserving permanent curses', () => {
    const strain = createDnd5eMechanicalEffect({
      id: 'resurrection-strain',
      definitionId: 'srd-5.1:spell:resurrection:caster-strain',
      label: '复生术负担', source: { kind: 'spell', actorId: 'hero', rulesId: 'resurrection' },
      targetId: 'hero', duration: { type: 'permanent' }, breakOn: ['long-rest-complete'],
      modifiers: { actionRestriction: { prohibited: ['spellcasting'] } },
    })
    const curse = createDnd5eMechanicalEffect({
      id: 'permanent-curse', definitionId: 'test:curse', label: '古老诅咒',
      tags: ['curse'], source: { kind: 'dm', magical: true }, targetId: 'hero',
      duration: { type: 'permanent' },
    })
    const rested = applyDnd5eLongRestBenefits(character({
      dnd5eCombatState: { activeEffects: [strain, curse] },
    }), 1_440)
    expect(rested.dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({ id: 'permanent-curse', definitionId: 'test:curse' }),
    ])
  })

  it('persists deterministic Host d20 results for a stored-result feature after a long rest', () => {
    const pluginId = 'com.example.stored-d20'
    const subclassId = `${pluginId}:diviner`
    const featureId = `${subclassId}.portent`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Stored D20 Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerDeclarativeSubclass({
          schemaVersion: 1, id: 'diviner', classId: 'wizard', name: 'Diviner', summary: 'Fixture.',
          abilities: [{
            schemaVersion: 1, id: 'portent', name: 'Portent', description: 'Stores Host d20 results.', level: 2,
            trigger: { kind: 'long-rest-complete' }, targeting: { kind: 'self' }, effects: [],
            mechanic: { kind: 'stored-d20-replacement', count: 2, countByClassLevel: [{ level: 14, count: 3 }] },
            canModifyEnemyD20: true, automation: 'full',
          }],
        })
      },
    })
    try {
      const wizard = character({
        charClass: '法师', level: 14, dnd5eClassLevels: { wizard: 14 },
        dnd5eClassChoices: { classes: { wizard: { subclass: subclassId } } },
        dnd5eCombatState: { declarativeStoredD20ByFeatureId: { [featureId]: [1] } },
      })
      const authoritativeRolls = [{ characterId: wizard.id, featureId, values: [2, 11, 19] }]
      const first = applyDnd5eLongRestBenefits(wizard, 1_440, authoritativeRolls)
      const second = applyDnd5eLongRestBenefits(wizard, 1_440, authoritativeRolls)
      const values = first.dnd5eCombatState?.declarativeStoredD20ByFeatureId?.[featureId]
      expect(values).toEqual([2, 11, 19])
      expect(values?.every((value) => Number.isInteger(value) && value >= 1 && value <= 20)).toBe(true)
      expect(second.dnd5eCombatState?.declarativeStoredD20ByFeatureId?.[featureId]).toEqual(values)
      const duplicate = character({
        dnd5eCombatState: { declarativeStoredD20ByFeatureId: { [featureId]: [7, 7, 12] } },
      })
      expect(consumeDnd5eStoredD20Replacement(duplicate, featureId, 7)
        ?.dnd5eCombatState?.declarativeStoredD20ByFeatureId?.[featureId]).toEqual([7, 12])
    } finally {
      dispose()
    }
  })

  it('uses the first observation as a migration baseline', () => {
    const result = reconcileDnd5eCharacterCampaignTime(character(), clock(2_000, []))
    expect(result.character.dnd5eWorldTimeAppliedMinute).toBe(2_000)
    expect(result.character.currentHp).toBe(1)
  })

  it('ignores a stale clock instead of moving an authoritative character baseline backwards', () => {
    const source = character({
      dnd5eWorldTimeAppliedMinute: 2_001,
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'regenerate', definitionId: 'activity:regenerate', label: '再生术',
          source: { kind: 'spell', actorId: 'hero', rulesId: 'regenerate' }, targetId: 'hero',
          duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
        })],
      },
    })
    const result = reconcileDnd5eCharacterCampaignTime(source, clock(2_000, []))
    expect(result.changed).toBe(false)
    expect(result.character).toBe(source)
    expect(result.character.dnd5eWorldTimeAppliedMinute).toBe(2_001)
    expect(result.character.dnd5eCombatState?.activeEffects?.[0]?.duration)
      .toMatchObject({ remainingRounds: 600 })
  })

  it('projects Regenerate healing and missing-part restoration through exploration minutes', () => {
    const effect = createDnd5eMechanicalEffect({
      id: 'regenerate', definitionId: 'activity:regenerate', label: '再生术',
      source: { kind: 'spell', actorId: 'cleric', rulesId: 'regenerate' }, targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      periodicHealing: { timing: 'target-turn-start', amount: 1 },
      bodyRestoration: { roundsRemaining: 20 },
    })
    const source = character({
      currentHp: 1, maxHp: 203, dnd5eWorldTimeAppliedMinute: 1_000,
      dnd5eCombatState: {
        bodyPresent: true, missingBodyParts: ['左臂'], activeEffects: [effect],
      },
    })

    const afterOneMinute = reconcileDnd5eCharacterCampaignTime(source, clock(1_001, []))
    expect(afterOneMinute.character.currentHp).toBe(11)
    expect(afterOneMinute.character.dnd5eCombatState?.missingBodyParts).toEqual(['左臂'])
    expect(afterOneMinute.character.dnd5eCombatState?.activeEffects?.[0]).toMatchObject({
      duration: { remainingRounds: 590 }, bodyRestoration: { roundsRemaining: 10 },
    })

    const afterTwoMinutes = reconcileDnd5eCharacterCampaignTime(afterOneMinute.character, clock(1_002, []))
    expect(afterTwoMinutes.character.currentHp).toBe(21)
    expect(afterTwoMinutes.character.dnd5eCombatState?.bodyPresent).toBe(true)
    expect(afterTwoMinutes.character.dnd5eCombatState?.missingBodyParts).toBeUndefined()
    expect(afterTwoMinutes.character.dnd5eCombatState?.activeEffects?.[0]).toMatchObject({
      duration: { remainingRounds: 580 }, bodyRestoration: undefined,
    })

    const replay = reconcileDnd5eCharacterCampaignTime(afterTwoMinutes.character, clock(1_002, []))
    expect(replay.changed).toBe(false)
    expect(replay.character.currentHp).toBe(21)
  })

  it('limits exploration periodic healing to rounds in which the effect still exists', () => {
    const source = character({
      currentHp: 1, maxHp: 203, dnd5eWorldTimeAppliedMinute: 1_000,
      dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({
        id: 'regenerate', definitionId: 'activity:regenerate', label: '再生术',
        source: { kind: 'spell', actorId: 'cleric', rulesId: 'regenerate' }, targetId: 'hero',
        duration: { type: 'rounds', remainingRounds: 5, tickOn: 'target-turn-end' },
        periodicHealing: { timing: 'target-turn-start', amount: 1 },
      })] },
    })
    const expired = reconcileDnd5eCharacterCampaignTime(source, clock(1_001, []))
    expect(expired.character.currentHp).toBe(6)
    expect(expired.character.dnd5eCombatState?.activeEffects).toBeUndefined()
  })

  it('resumes an effect when its suspending transition expires on the campaign clock', () => {
    const transition = createDnd5eConditionEffect({
      id: 'wind-walk-transition',
      condition: 'incapacitated',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'wind-walk' },
      targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
    })
    const cloud = createDnd5eMechanicalEffect({
      id: 'wind-walk-cloud',
      definitionId: 'activity:srd-5.1:wind-walk:cloud-form',
      label: '御风而行·云雾形态',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'wind-walk' },
      targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      suspendedBy: [transition.id],
      modifiers: { flySpeedFeet: 300 },
    })
    const source = character({
      dnd5eWorldTimeAppliedMinute: 1_000,
      conditions: ['incapacitated'],
      dnd5eCombatState: { activeEffects: [transition, cloud] },
    })

    const resumed = reconcileDnd5eCharacterCampaignTime(source, clock(1_001, []))

    expect(resumed.character.conditions).toEqual([])
    expect(resumed.character.dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({
        id: cloud.id,
        suspendedBy: undefined,
        duration: expect.objectContaining({ remainingRounds: 4_790 }),
      }),
    ])
  })

  it('creates and ages Wind Walk controlled descent when exploration time expires it in the air', () => {
    const cloud = createDnd5eMechanicalEffect({
      id: 'wind-walk-cloud-expiry',
      definitionId: 'activity:srd-5.1:wind-walk:cloud-form',
      label: '御风而行·云雾形态',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'wind-walk', magical: true },
      targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: { flySpeedFeet: 300 },
      afterEffectEnds: {
        duration: 'rounds', rounds: 10, trigger: 'non-manual-removal',
        requiresAirborne: true, preventActions: false, preventMovement: false,
        controlledDescent: {
          maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true,
        },
      },
    })
    const airborne = character({
      dnd5eWorldTimeAppliedMinute: 1_000,
      dnd5eCombatState: { activeEffects: [cloud] },
    })
    const expiredInAir = reconcileDnd5eCharacterCampaignTime(
      airborne,
      clock(1_001, []),
      { airborne: true },
    ).character
    expect(expiredInAir.dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({
        definitionId: `${cloud.definitionId}:after-effect-ends`,
        duration: expect.objectContaining({ remainingRounds: 10 }),
        modifiers: expect.objectContaining({
          controlledDescent: expect.objectContaining({ maximumFeetPerRound: 60 }),
        }),
      }),
    ])
    expect(dnd5eCampaignTimeControlledDescentDistanceFeet(expiredInAir, 1)).toBe(600)
    expect(reconcileDnd5eCharacterCampaignTime(expiredInAir, clock(1_002, []), { airborne: true })
      .character.dnd5eCombatState?.activeEffects).toBeUndefined()

    const expiredOnGround = reconcileDnd5eCharacterCampaignTime(
      airborne,
      clock(1_001, []),
      { airborne: false },
    ).character
    expect(expiredOnGround.dnd5eCombatState?.activeEffects).toBeUndefined()
  })

  it('clears an orphaned suspension reference left by an interrupted earlier reconciliation', () => {
    const cloud = createDnd5eMechanicalEffect({
      id: 'orphaned-wind-walk-cloud',
      definitionId: 'activity:srd-5.1:spell:wind-walk:begin-cloud-form:wind-walk-cloud-form',
      label: '御风而行·云雾形态',
      source: { kind: 'spell', actorId: 'hero', rulesId: 'srd-5.1:spell:wind-walk:begin-cloud-form' },
      targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      suspendedBy: ['already-removed-transition'],
      modifiers: { flySpeedFeet: 300 },
    })
    const source = character({
      dnd5eWorldTimeAppliedMinute: 1_000,
      dnd5eCombatState: { activeEffects: [cloud] },
    })

    const resumed = reconcileDnd5eCharacterCampaignTime(source, clock(1_001, []))

    expect(resumed.changed).toBe(true)
    expect(resumed.character.dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({ id: cloud.id, suspendedBy: undefined }),
    ])
  })

  it('expires Activity-generated provisions when the campaign clock reaches their boundary', () => {
    const source = character({ dnd5eWorldTimeAppliedMinute: 1_000 })
    const granted = applyDnd5eInventoryGrantBundle([source], {
      characterId: source.id,
      receiptId: 'spell:goodberry:campaign-expiry',
      grants: [{
        templateId: 'srd-5.1:item:goodberry', quantity: 10,
        expiresAtWorldMinute: 2_440, generatedByRulesId: 'activity:srd-5.1:goodberry',
      }],
    })
    const before = reconcileDnd5eCharacterCampaignTime(granted.characters[0], clock(2_439, [{
      id: 'before-expiry', kind: 'advance', fromWorldMinute: 1_000, toWorldMinute: 2_439,
      minutes: 1_439, reason: '推进', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1,
    }]))
    expect(normalizeDnd5eInventory(before.character).entries).toHaveLength(1)
    const expired = reconcileDnd5eCharacterCampaignTime(before.character, clock(2_440, [{
      id: 'at-expiry', kind: 'advance', fromWorldMinute: 2_439, toWorldMinute: 2_440,
      minutes: 1, reason: '推进', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 2,
    }]))
    expect(normalizeDnd5eInventory(expired.character).entries).toHaveLength(0)
  })

  it('applies dawn resources and Divine Intervention by elapsed calendar days', () => {
    const source = character({
      dnd5eWorldTimeAppliedMinute: 480,
      dnd5eCombatState: { divineInterventionCooldownDays: 7 },
      classResources: { 'dnd5e-divine-intervention': { current: 0, max: 1 } },
      dnd5eInventory: {
        schemaVersion: 2,
        entries: [{
          instanceId: 'wand', templateId: 'test-wand', quantity: 1, acquiredAt: 0, item: {
            id: 'wand', name: '测试魔杖', englishName: 'Test Wand', category: 'adventuring-gear',
            description: '测试', rulesText: '测试', stackable: false, icon: 'magic-wand',
            resources: [{ id: 'charge', label: '充能', maximum: 2, resetOn: 'dawn' }],
            source: { book: 'DM 自定义', license: '用户内容' },
          },
          resources: { charge: { id: 'charge', label: '充能', current: 0, maximum: 2, resetOn: 'dawn' } },
        }],
      },
    })
    const result = reconcileDnd5eCharacterCampaignTime(source, clock(1_800, [{
      id: 'advance', kind: 'advance', fromWorldMinute: 480, toWorldMinute: 1_800, minutes: 1_320,
      reason: '推进', dawnsCrossed: 1, expiredTimerIds: [], createdAt: 1,
    }]))
    expect(result.dawnsApplied).toBe(1)
    expect(result.character.dnd5eCombatState?.divineInterventionCooldownDays).toBe(6)
    expect(result.character.dnd5eInventory?.entries[0].resources?.charge.current).toBe(2)
  })

  it('grants only one long-rest benefit inside a 24-hour interval', () => {
    const source = character({ dnd5eWorldTimeAppliedMinute: 480 })
    const result = reconcileDnd5eCharacterCampaignTime(source, clock(1_440, [
      { id: 'rest-1', kind: 'long-rest', fromWorldMinute: 480, toWorldMinute: 960, minutes: 480, reason: '长休', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1 },
      { id: 'rest-2', kind: 'long-rest', fromWorldMinute: 960, toWorldMinute: 1_440, minutes: 480, reason: '长休', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 2 },
    ]))
    expect(result.longRestsApplied).toBe(1)
    expect(result.longRestsBlocked).toBe(1)
    expect(result.character.currentHp).toBe(12)
    expect(result.character.dnd5eLastLongRestWorldMinute).toBe(960)
  })

  it('applies a short rest only to the DM-selected beneficiaries', () => {
    const rest = {
      id: 'short-rest', kind: 'short-rest' as const, fromWorldMinute: 480, toWorldMinute: 540,
      minutes: 60, reason: '短休', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1,
      beneficiaryCharacterIds: ['hero'],
    }
    const selected = reconcileDnd5eCharacterCampaignTime(character({
      dnd5eWorldTimeAppliedMinute: 480,
      classResources: { fighterSecondWind: { current: 0, max: 1 } },
    }), clock(540, [rest]))
    const skipped = reconcileDnd5eCharacterCampaignTime(character({
      id: 'other',
      dnd5eWorldTimeAppliedMinute: 480,
      classResources: { fighterSecondWind: { current: 0, max: 1 } },
    }), clock(540, [rest]))

    expect(selected.character.classResources?.fighterSecondWind.current).toBe(1)
    expect(skipped.character.classResources?.fighterSecondWind.current).toBe(0)
    expect(skipped.character.dnd5eWorldTimeAppliedMinute).toBe(540)
  })

  it('expires a timed maximum-HP reduction after sixty campaign minutes', () => {
    const source = character({
      maxHp: 24,
      currentHp: 1,
      dnd5eWorldTimeAppliedMinute: 480,
      dnd5eCombatState: {
        hitPointMaximumReductionLedger: {
          schemaVersion: 1,
          baseMaximum: 80,
          entries: [{
            id: 'harm:1',
            amount: 56,
            recovery: 'greater-restoration-or-other-magic',
            remainingRounds: 600,
          }],
        },
      },
    })
    const result = reconcileDnd5eCharacterCampaignTime(source, clock(540, [{
      id: 'advance-hour', kind: 'advance', fromWorldMinute: 480, toWorldMinute: 540,
      minutes: 60, reason: '推进一小时', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1,
    }]))

    expect(result.character.maxHp).toBe(80)
    expect(result.character.currentHp).toBe(1)
    expect(result.character.dnd5eCombatState?.hitPointMaximumReductionLedger).toBeUndefined()
  })

  it('lets a DM override the 24-hour long-rest limit for selected characters only', () => {
    const rest = {
      id: 'forced-long-rest', kind: 'long-rest' as const, fromWorldMinute: 960, toWorldMinute: 1_440,
      minutes: 480, reason: 'DM 覆盖长休', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1,
      beneficiaryCharacterIds: ['hero'], ignoreLongRestCooldown: true,
    }
    const selected = reconcileDnd5eCharacterCampaignTime(character({
      currentHp: 1,
      dnd5eWorldTimeAppliedMinute: 960,
      dnd5eLastLongRestWorldMinute: 900,
    }), clock(1_440, [rest]))
    const skipped = reconcileDnd5eCharacterCampaignTime(character({
      id: 'other',
      currentHp: 1,
      dnd5eWorldTimeAppliedMinute: 960,
      dnd5eLastLongRestWorldMinute: 900,
    }), clock(1_440, [rest]))

    expect(selected.longRestsApplied).toBe(1)
    expect(selected.character.currentHp).toBe(12)
    expect(selected.character.dnd5eLastLongRestWorldMinute).toBe(1_440)
    expect(skipped.longRestsApplied).toBe(0)
    expect(skipped.character.currentHp).toBe(1)
  })

  it('permanently loses an ethereal Secret Chest by the twentieth post-risk daily check', () => {
    const granted = applyDnd5eInventoryGrantBundle([character()], {
      characterId: 'hero',
      grants: [{ templateId: 'srd-5.1:magic-item:ring-of-protection', quantity: 1 }],
      receiptId: 'secret-chest-fixture',
    })
    expect(granted.ok).toBe(true)
    const withItem = granted.characters[0]!
    const inventory = normalizeDnd5eInventory(withItem)
    const instanceId = inventory.entries[0]!.instanceId
    const riskStartsAt = 86_400
    const linked = character({
      ...withItem,
      dnd5eWorldTimeAppliedMinute: riskStartsAt,
      dnd5eInventory: {
        ...inventory,
        entries: inventory.entries.map((entry) => ({
          ...entry, planarState: 'ethereal' as const,
          linkedSpellAuthorityRecordId: 'linked-planar-object:secret-chest:hero',
        })),
      },
      dnd5eCombatState: {
        spellAuthorityRecords: {
          'linked-planar-object:secret-chest:hero': {
            schemaVersion: 1, id: 'linked-planar-object:secret-chest:hero',
            kind: 'linked-planar-object', profile: 'secret-chest',
            sourceActorId: 'hero', subjectActorId: 'hero', sourceActivityId: 'spell:secret-chest',
            createdWorldMinute: 0, inventoryInstanceId: instanceId,
            planarState: 'ethereal', lossRiskStartsAtWorldMinute: riskStartsAt,
          },
        },
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'secret-chest-controller',
          definitionId: 'activity:spell:secret-chest:secret-chest-controller:marker',
          label: '秘箱连结', source: { kind: 'spell', actorId: 'hero', rulesId: 'secret-chest' },
          targetId: 'hero', duration: { type: 'permanent' },
        })],
      },
    })
    const result = reconcileDnd5eCharacterCampaignTime(
      linked,
      clock(riskStartsAt + (20 * 1_440), []),
    )
    expect(result.character.dnd5eCombatState?.spellAuthorityRecords).toBeUndefined()
    expect(result.character.dnd5eCombatState?.activeEffects).toBeUndefined()
    expect(normalizeDnd5eInventory(result.character).entries).toHaveLength(0)
  })

  it('keeps the Secret Chest controller after a daily loss check that does not end the spell', () => {
    const recordId = 'linked-planar-object:secret-chest:dhdmauj3'
    const riskStartsAt = 274_717
    const controller = createDnd5eMechanicalEffect({
      id: 'secret-chest-controller',
      definitionId: 'activity:spell:secret-chest:secret-chest-controller:marker',
      label: '秘箱连结', source: { kind: 'spell', actorId: 'hero', rulesId: 'secret-chest' },
      targetId: 'hero', duration: { type: 'permanent' },
    })
    const linked = character({
      dnd5eWorldTimeAppliedMinute: riskStartsAt,
      dnd5eCombatState: {
        spellAuthorityRecords: {
          [recordId]: {
            schemaVersion: 1, id: recordId,
            kind: 'linked-planar-object', profile: 'secret-chest',
            sourceActorId: 'hero', subjectActorId: 'hero', sourceActivityId: 'spell:secret-chest',
            createdWorldMinute: riskStartsAt - 86_400, inventoryInstanceId: 'secret-chest-instance',
            planarState: 'ethereal', lossRiskStartsAtWorldMinute: riskStartsAt,
          },
        },
        activeEffects: [controller],
      },
    })

    const result = reconcileDnd5eCharacterCampaignTime(
      linked,
      clock(riskStartsAt + 1_440, []),
    )
    expect(result.character.dnd5eCombatState?.spellAuthorityRecords?.[recordId])
      .toMatchObject({ lastLossCheckWorldMinute: riskStartsAt + 1_440 })
    expect(result.character.dnd5eCombatState?.activeEffects).toEqual([controller])
  })

  it('removes the linked Secret Chest when a legacy authority record carries a stale instance id', () => {
    const granted = applyDnd5eInventoryGrantBundle([character()], {
      characterId: 'hero',
      grants: [
        { templateId: 'srd-5.1:item:secret-chest-5000gp', quantity: 1 },
        { templateId: 'srd-5.1:item:secret-chest-replica-50gp', quantity: 1 },
      ],
      receiptId: 'secret-chest-stale-instance-fixture',
    })
    expect(granted.ok).toBe(true)
    const withItems = granted.characters[0]!
    const inventory = normalizeDnd5eInventory(withItems)
    const chest = inventory.entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:secret-chest-5000gp')!
    const replica = inventory.entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:secret-chest-replica-50gp')!
    const recordId = 'linked-planar-object:secret-chest:hero'
    const riskStartsAt = 86_400
    const linked = character({
      ...withItems,
      dnd5eWorldTimeAppliedMinute: riskStartsAt,
      dnd5eInventory: {
        ...inventory,
        entries: inventory.entries.map((entry) => entry.instanceId === chest.instanceId
          ? { ...entry, planarState: 'ethereal' as const, linkedSpellAuthorityRecordId: recordId }
          : entry),
      },
      dnd5eCombatState: {
        spellAuthorityRecords: {
          [recordId]: {
            schemaVersion: 1, id: recordId,
            kind: 'linked-planar-object', profile: 'secret-chest',
            sourceActorId: 'hero', subjectActorId: 'hero', sourceActivityId: 'spell:secret-chest',
            createdWorldMinute: 0, inventoryInstanceId: 'legacy-stale-instance',
            planarState: 'ethereal', lossRiskStartsAtWorldMinute: riskStartsAt,
          },
        },
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'secret-chest-controller',
          definitionId: 'activity:spell:secret-chest:secret-chest-controller:marker',
          label: '秘箱连结', source: { kind: 'spell', actorId: 'hero', rulesId: 'secret-chest' },
          targetId: 'hero', duration: { type: 'permanent' },
        })],
      },
    })

    const result = reconcileDnd5eCharacterCampaignTime(
      linked,
      clock(riskStartsAt + (20 * 1_440), []),
    )
    const remaining = normalizeDnd5eInventory(result.character).entries
    expect(remaining.some((entry) => entry.instanceId === chest.instanceId)).toBe(false)
    expect(remaining.some((entry) => entry.instanceId === replica.instanceId)).toBe(true)
    expect(result.character.dnd5eCombatState?.spellAuthorityRecords).toBeUndefined()
    expect(result.character.dnd5eCombatState?.activeEffects).toBeUndefined()
  })

  it('ages bounded ActiveEffects by ten rounds per elapsed campaign minute', () => {
    const bounded = character({
      dnd5eWorldTimeAppliedMinute: 480,
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'detect-magic',
        concentrationSpellLevel: 1,
        concentrationTargetIds: ['hero'],
        concentrationRoundsRemaining: 100,
        concentrationEffectsBySource: { hero: 'detect-magic' },
        activeEffects: [
          createDnd5eMechanicalEffect({
            id: 'script', definitionId: 'activity:srd-5.1:illusory-script:script',
            label: '迷幻手稿', source: { kind: 'spell', actorId: 'hero', rulesId: 'illusory-script' },
            targetId: 'hero', duration: { type: 'rounds', remainingRounds: 144_000, tickOn: 'target-turn-end' },
          }),
          createDnd5eMechanicalEffect({
            id: 'detect', definitionId: 'activity:srd-5.1:detect-magic:detect',
            label: '侦测魔法', source: { kind: 'spell', actorId: 'hero', rulesId: 'detect-magic' },
            targetId: 'hero', duration: {
              type: 'concentration', sourceActorId: 'hero', concentrationId: 'detect-magic', remainingRounds: 100,
            },
          }),
        ],
      },
    })

    const afterNineMinutes = reconcileDnd5eCharacterCampaignTime(bounded, clock(489, []))
    expect(afterNineMinutes.character.dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({ id: 'script', duration: expect.objectContaining({ remainingRounds: 143_910 }) }),
      expect.objectContaining({ id: 'detect', duration: expect.objectContaining({ remainingRounds: 10 }) }),
    ])
    expect(afterNineMinutes.character.dnd5eCombatState?.concentrationRoundsRemaining).toBe(10)

    const afterTenMinutes = reconcileDnd5eCharacterCampaignTime(bounded, clock(490, []))
    expect(afterTenMinutes.character.dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({ id: 'script', duration: expect.objectContaining({ remainingRounds: 143_900 }) }),
    ])
    expect(afterTenMinutes.character.conditions).toEqual([])
    expect(afterTenMinutes.character.concentrating).toBe(false)
    expect(afterTenMinutes.character.dnd5eCombatState).toMatchObject({
      concentrationSpellId: undefined,
      concentrationRoundsRemaining: undefined,
      concentrationEffectsBySource: undefined,
    })
  })

  it('promotes True Polymorph transformations and object forms after a full hour of exploration concentration', () => {
    const transformed = character({
      dnd5eWorldTimeAppliedMinute: 480,
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'true-polymorph',
        concentrationSpellLevel: 9,
        concentrationTargetIds: ['hero'],
        concentrationRoundsRemaining: 600,
        concentrationEffectsBySource: { hero: 'true-polymorph' },
        wildShapeFormId: 'srd-5.1:brown-bear',
        wildShapeMode: 'true-polymorph',
        wildShapeSourceActorId: 'hero',
        wildShapeCurrentHp: 34,
        wildShapeRoundsRemaining: 600,
        wildShapePermanentAfterConcentrationCompletes: true,
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'true-polymorph-object',
          definitionId: 'activity:spell:true-polymorph:true-polymorph-creature-object:marker',
          label: '完全变形术·物体形态',
          source: { kind: 'spell', actorId: 'hero', rulesId: 'true-polymorph' },
          targetId: 'hero',
          duration: {
            type: 'concentration', sourceActorId: 'hero',
            concentrationId: 'true-polymorph', remainingRounds: 600,
          },
          persistAfterConcentrationCompletes: true,
        })],
      },
    })

    const completed = reconcileDnd5eCharacterCampaignTime(transformed, clock(540, []))
    expect(completed.character.concentrating).toBe(false)
    expect(completed.character.dnd5eCombatState).toMatchObject({
      concentrationSpellId: undefined,
      wildShapeFormId: 'srd-5.1:brown-bear',
      wildShapePermanent: true,
      wildShapePermanentAfterConcentrationCompletes: undefined,
      wildShapeRoundsRemaining: undefined,
      lastCompletedConcentration: {
        spellId: 'true-polymorph', completedWorldMinute: 540,
      },
      concentrationEffectsBySource: undefined,
    })
    expect(completed.character.dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({
        id: 'true-polymorph-object', duration: { type: 'permanent' },
        persistAfterConcentrationCompletes: undefined,
      }),
    ])
  })

  it('starts newly completed long-cast effects after casting time while aging pre-existing effects', () => {
    const beforeCommit = character({
      dnd5eWorldTimeAppliedMinute: 480,
      dnd5eCombatState: {
        activeEffects: [
          createDnd5eMechanicalEffect({
            id: 'existing', definitionId: 'activity:existing', label: '既有效果',
            source: { kind: 'spell', actorId: 'hero', rulesId: 'existing' }, targetId: 'hero',
            duration: { type: 'rounds', remainingRounds: 200, tickOn: 'target-turn-end' },
          }),
          createDnd5eMechanicalEffect({
            id: 'mirage', definitionId: 'activity:srd-5.1:mirage-arcane:terrain', label: '海市蜃楼',
            source: { kind: 'spell', actorId: 'hero', rulesId: 'mirage-arcane' }, targetId: 'hero',
            duration: { type: 'rounds', remainingRounds: 144_000, tickOn: 'target-turn-end' },
          }),
        ],
      },
    })
    const compensated = compensateDnd5eCompletedLongCastEffects(beforeCommit, ['mirage'], 10)
    const reconciled = reconcileDnd5eCharacterCampaignTime(compensated, clock(490, []))
    expect(reconciled.character.dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({ id: 'existing', duration: expect.objectContaining({ remainingRounds: 100 }) }),
      expect.objectContaining({ id: 'mirage', duration: expect.objectContaining({ remainingRounds: 144_000 }) }),
    ])
    const selectedByDefinition = compensateDnd5eCompletedLongCastEffects(
      beforeCommit,
      ['activity:srd-5.1:mirage-arcane:terrain'],
      10,
    )
    expect(selectedByDefinition.dnd5eCombatState?.activeEffects?.[1]?.duration)
      .toMatchObject({ remainingRounds: 144_100 })
  })

  it('compensates the concentration summary only when the completed cast created that effect', () => {
    const completed = character({
      concentrating: true,
      dnd5eWorldTimeAppliedMinute: 480,
      dnd5eCombatState: {
        concentrationSpellId: 'long-cast',
        concentrationRoundsRemaining: 600,
        activeEffects: [createDnd5eMechanicalEffect({
          id: 'long-cast-effect', definitionId: 'activity:long-cast', label: '长施法专注',
          source: { kind: 'spell', actorId: 'hero', rulesId: 'long-cast' }, targetId: 'hero',
          duration: {
            type: 'concentration', sourceActorId: 'hero', concentrationId: 'long-cast', remainingRounds: 600,
          },
        })],
      },
    })
    const compensated = compensateDnd5eCompletedLongCastEffects(completed, ['long-cast-effect'], 10)
    expect(compensated.dnd5eCombatState?.concentrationRoundsRemaining).toBe(700)
    expect(compensated.dnd5eCombatState?.activeEffects?.[0]?.duration).toMatchObject({ remainingRounds: 700 })
  })

  it('compensates a completed long-cast concentration summary without an ActiveEffect row', () => {
    const completed = character({
      concentrating: true,
      dnd5eWorldTimeAppliedMinute: 480,
      dnd5eCombatState: {
        concentrationSpellId: 'scrying',
        concentrationSpellLevel: 5,
        concentrationTargetIds: ['hero'],
        concentrationRoundsRemaining: 100,
      },
    })
    const compensated = compensateDnd5eCompletedLongCastEffects(completed, [], 10, 'scrying')
    expect(compensated.dnd5eCombatState?.concentrationRoundsRemaining).toBe(200)
    const reconciled = reconcileDnd5eCharacterCampaignTime(compensated, clock(490, []))
    expect(reconciled.character).toMatchObject({
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'scrying',
        concentrationSpellLevel: 5,
        concentrationTargetIds: ['hero'],
        concentrationRoundsRemaining: 100,
      },
    })
  })
})
