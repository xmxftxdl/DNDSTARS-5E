import { characterCombatClockKey } from '../../../shared/combat-round-credits.mjs'
import { describe, expect, it } from 'vitest'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import type { Character } from '../../types/character'
import {
  advanceDnd5eCampaignTimedActiveEffects,
  applyDnd5eLongRestBenefits,
  applyDnd5eShortRestBenefits,
  applyDnd5eGrantedShortRestBenefits,
  compensateDnd5eCompletedLongCastEffects,
  dnd5eCampaignTimeControlledDescentDistanceFeet,
  dnd5eCampaignRepeatSaveD20,
  dnd5eCampaignRepeatSaveReductionRoll,
  reconcileDnd5eCharacterCampaignTime,
} from './campaignTimeRules'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { applyDnd5eInventoryGrantBundle, applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import { consumeDnd5eStoredD20Replacement, registerDnd5eRulesPlugin } from './pluginApi'
import { planDnd5eExpiredRestCompletions } from './restCompletion'
import { normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { spendClassResource, syncCharacterClassResources } from '../../lib/classResources'
import { normalizeCharacter } from '../../store/characters'
import { beginDnd5eNaturalSleep } from './naturalSleep'

describe('plugin-owned resource recovery through campaign rest events', () => {
  it.each(['feature', 'feat'] as const)('%s resources recover on either rest, only for beneficiaries, without replay grants', kind => {
    const pluginId = `test.rest-resource-${kind}`
    const optionId = `${pluginId}:rest-options`
    const shortId = `${pluginId}:short-use`
    const longId = `${pluginId}:daily-use`
    const conditionalIds = ['empty', 'populated'].map(id => `${pluginId}:${id}`)
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: pluginId, name: 'Synthetic rest resources', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' },
      setup(api) {
        const definition = {
          id: 'rest-options', name: 'Synthetic rest options', summary: 'Test', description: 'Test',
          automation: 'full' as const,
          resources: [
            { id: 'short-use', label: 'Short use', maximum: 1, resetOn: 'short-rest' as const },
            { id: 'daily-use', label: 'Daily use', maximum: 1, resetOn: 'long-rest' as const },
            ...['empty', 'populated'].map(id => ({ id, label: id, maximum: 5, resetOn: 'long-rest' as const,
              restRecovery: {
                'short-rest': { mode: 'restore' as const, amount: 1, onlyWhenEmpty: true },
                'long-rest': { mode: 'set' as const, amount: 1 },
              },
            })),
          ],
        }
        if (kind === 'feature') api.registerFeature(definition)
        else api.registerFeat(definition)
      },
    })
    try {
      const owned = syncCharacterClassResources(character({
        dnd5eWorldTimeAppliedMinute: 480,
        ...(kind === 'feature' ? { dnd5ePluginFeatureIds: [optionId] } : { dnd5eFeatIds: [optionId] }),
      }))
      expect(owned.classResources?.[shortId]).toEqual({ current: 1, max: 1 })
      expect(syncCharacterClassResources(character()).classResources?.[shortId]).toBeUndefined()
      let spent = spendClassResource(spendClassResource(owned, shortId, 1)!, longId, 1)!
      spent = spendClassResource(spendClassResource(spent, conditionalIds[0], 5)!, conditionalIds[1], 2)!
      for (const restKind of ['short-rest', 'long-rest'] as const) {
        const end = restKind === 'short-rest' ? 540 : 960
        const time = clock(end, [{
          id: `synthetic-${restKind}`, kind: restKind, fromWorldMinute: 480, toWorldMinute: end,
          minutes: end - 480, reason: 'Synthetic rest', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1,
          beneficiaryCharacterIds: ['hero'],
        }])
        const recovered = reconcileDnd5eCharacterCampaignTime(spent, time).character
        expect(recovered.classResources?.[shortId].current).toBe(1)
        expect(recovered.classResources?.[longId].current).toBe(restKind === 'long-rest' ? 1 : 0)
        expect(recovered.classResources?.[conditionalIds[0]].current).toBe(1)
        expect(recovered.classResources?.[conditionalIds[1]].current).toBe(restKind === 'long-rest' ? 1 : 3)
        expect(spent.classResources?.[shortId].current).toBe(0)
        const skipped = reconcileDnd5eCharacterCampaignTime({ ...spent, id: 'other' }, time).character
        expect(skipped.classResources?.[shortId].current).toBe(0)
        expect(skipped.classResources?.[conditionalIds[0]].current).toBe(0)
        expect(skipped.classResources?.[conditionalIds[1]].current).toBe(3)
        const spentAgain = spendClassResource(spendClassResource(recovered, shortId, 1)!, conditionalIds[0], 1)!
        const reloaded = JSON.parse(JSON.stringify(spentAgain)) as Character
        expect(reconcileDnd5eCharacterCampaignTime(reloaded, time).character.classResources?.[shortId].current).toBe(0)
        expect(reconcileDnd5eCharacterCampaignTime(reloaded, time).character.classResources?.[conditionalIds[0]].current).toBe(0)
      }
    } finally {
      dispose()
    }
  })
})

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
  it('starts only Host-confirmed natural sleep and expires it without granting rest benefits', () => {
    const original = character({ dnd5eWorldTimeAppliedMinute: 480,
      classResources: { fighterSecondWind: { current: 0, max: 1 } } })
    const input = { eventId: 'sleep-1', worldMinute: 480, durationMinutes: 60, canSleep: true }
    expect(beginDnd5eNaturalSleep(original, { ...input, canSleep: false }).ok).toBe(false)
    expect(beginDnd5eNaturalSleep(original, { ...input, worldMinute: 479 }).ok).toBe(false)
    expect(beginDnd5eNaturalSleep({ ...original, currentHp: 0 }, input).ok).toBe(false)
    const started = beginDnd5eNaturalSleep(original, input)
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(beginDnd5eNaturalSleep(started.character, input).ok).toBe(false)
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(started.character)))
    expect(restored.dnd5eCombatState?.activeEffects?.[0].source.magical).toBe(false)
    expect(advanceDnd5eCampaignTimedActiveEffects(restored, 59).dnd5eAwakeningEvents).toBeUndefined()
    const awake = advanceDnd5eCampaignTimedActiveEffects(restored, 60)
    expect(awake.dnd5eAwakeningEvents?.[0]).toMatchObject({ worldMinute: 540, sourceRulesIds: ['natural-sleep'] })
    expect(awake.classResources?.fighterSecondWind.current).toBe(0)
    expect(awake.currentHp).toBe(original.currentHp)
    expect(original.dnd5eCombatState?.activeEffects).toBeUndefined()
  })
  it('persists natural timed waking at the expiry minute and does not duplicate it after reload', () => {
    const sleep = createDnd5eConditionEffect({ id: 'natural-timed-sleep', condition: 'unconscious', targetId: 'hero',
      source: { kind: 'spell', rulesId: 'test-sleep' }, breakOn: ['awakened'],
      duration: { type: 'rounds', remainingRounds: 20, tickOn: 'target-turn-end' } })
    const source = character({ dnd5eWorldTimeAppliedMinute: 480, conditions: ['unconscious'],
      dnd5eCombatState: { activeEffects: [sleep] } })
    const early = advanceDnd5eCampaignTimedActiveEffects(source, 1)
    expect(early.dnd5eAwakeningEvents).toBeUndefined()
    const ended = advanceDnd5eCampaignTimedActiveEffects(source, 10)
    expect(ended.dnd5eAwakeningEvents).toHaveLength(1)
    expect(ended.dnd5eAwakeningEvents?.[0]).toMatchObject({ characterId: 'hero', worldMinute: 482,
      sleepEffectIds: [sleep.id], sourceRulesIds: ['test-sleep'] })
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(ended)))
    expect(restored.dnd5eAwakeningEvents).toEqual(ended.dnd5eAwakeningEvents)
    expect(advanceDnd5eCampaignTimedActiveEffects(restored, 10).dnd5eAwakeningEvents).toEqual(ended.dnd5eAwakeningEvents)
    expect(advanceDnd5eCampaignTimedActiveEffects({ ...source, currentHp: 0 }, 10).dnd5eAwakeningEvents).toBeUndefined()
    const ordinary = { ...sleep, breakOn: undefined }
    expect(advanceDnd5eCampaignTimedActiveEffects({ ...source, dnd5eCombatState: { activeEffects: [ordinary] } }, 10)
      .dnd5eAwakeningEvents).toBeUndefined()
  })
  it('preserves a serialized rest denial before recovery, cleanup and forced rest accounting', () => {
    const effect = createDnd5eMechanicalEffect({ definitionId: 'test-nightmare', label: 'Nightmare',
      targetId: 'hero', source: { kind: 'spell', rulesId: 'test-dream', actorId: 'caster' },
      duration: { type: 'permanent' }, modifiers: { preventRestBenefits: true },
      breakOn: ['long-rest-complete'] })
    const saved = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
    expect(saved[0]?.modifiers?.preventRestBenefits).toBe(true)
    const reward = createDnd5eConditionEffect({ id: 'denied-reward', condition: 'unconscious',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'test-rest' }, targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
      completionRequirement: { condition: 'unconscious', interrupted: false }, completionReward: { kind: 'short-rest' } })
    expect(planDnd5eExpiredRestCompletions({ targetId: 'hero', effects: [...saved, reward],
      expiredEffectIds: [reward.id] })).toEqual({ completed: [], lockouts: [] })
    const source = character({ dnd5eWorldTimeAppliedMinute: 480,
      classResources: { fighterSecondWind: { current: 0, max: 1 } },
      dnd5eCombatState: { activeEffects: saved } })
    expect(applyDnd5eShortRestBenefits(source, 540)).toBe(source)
    expect(applyDnd5eGrantedShortRestBenefits(source, 540)).toBe(source)
    expect(applyDnd5eLongRestBenefits(source, 960)).toBe(source)
    const result = reconcileDnd5eCharacterCampaignTime(source, clock(960, [{
      id: 'denied-rest', kind: 'long-rest', fromWorldMinute: 480, toWorldMinute: 960,
      minutes: 480, reason: 'test', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1,
      ignoreLongRestCooldown: true,
    }]))
    expect(result.longRestsApplied).toBe(0)
    expect(result.longRestsBlocked).toBe(1)
    expect(result.character.currentHp).toBe(1)
    expect(result.character.classResources?.fighterSecondWind.current).toBe(0)
    expect(result.character.dnd5eLastLongRestWorldMinute).toBeUndefined()
    expect(result.character.dnd5eCombatState?.activeEffects?.[0].id).toBe(effect.id)
    expect(applyDnd5eLongRestBenefits({ ...source, dnd5eCombatState: { activeEffects: [] } }, 960).currentHp).toBe(12)
  })
  it('grants uninterrupted expiry recovery once and retains a caster-independent receipt until long rest',()=>{
    const effect=createDnd5eConditionEffect({id:'rest-reward',condition:'unconscious',source:{kind:'spell',actorId:'caster',rulesId:'test-rest'},targetId:'hero',
      duration:{type:'rounds',remainingRounds:100,tickOn:'target-turn-end'},completionRequirement:{condition:'unconscious',interrupted:false},completionReward:{kind:'short-rest'}})
    const source=character({classResources:{fighterSecondWind:{current:0,max:1}},dnd5eWorldTimeAppliedMinute:480,dnd5eCombatState:{schemaVersion:2,activeEffects:[effect]}})
    const planned=planDnd5eExpiredRestCompletions({targetId:'hero',effects:[effect],expiredEffectIds:[effect.id]})
    expect(normalizeDnd5eActiveEffects(planned.lockouts),JSON.stringify({planned,validation:validateDnd5eActiveEffectsStrict(planned.lockouts)})).toHaveLength(1)
    const partial=advanceDnd5eCampaignTimedActiveEffects(source,9)
    expect(partial.classResources?.fighterSecondWind.current).toBe(0)
    expect(partial.dnd5eCombatState?.activeEffects?.[0].duration).toMatchObject({remainingRounds:10})
    const completed=advanceDnd5eCampaignTimedActiveEffects({...partial,dnd5eWorldTimeAppliedMinute:489},1)
    expect(completed.classResources?.fighterSecondWind.current).toBe(1)
    expect(completed.currentHp).toBe(source.currentHp)
    expect(completed.conditions).not.toContain('unconscious')
    expect(completed.dnd5eRestActivityWindow).toMatchObject({completedWorldMinute:490})
    const lockouts=completed.dnd5eCombatState!.activeEffects!
    expect(lockouts,JSON.stringify(completed)).toHaveLength(1)
    expect(lockouts[0].breakOn).toContain('long-rest-complete')
    expect(lockouts[0].source).toMatchObject({kind:'system',magical:false})
    const replay={...completed,classResources:{fighterSecondWind:{current:0,max:1}},dnd5eCombatState:{...completed.dnd5eCombatState!,activeEffects:[...lockouts,{...effect,id:'other-caster',source:{...effect.source,actorId:'other'}}]}}
    expect(advanceDnd5eCampaignTimedActiveEffects(replay,10).classResources?.fighterSecondWind.current).toBe(0)
    const rested=applyDnd5eLongRestBenefits(completed,970)
    expect(rested.dnd5eCombatState?.activeEffects?.some(entry=>entry.definitionId===lockouts[0].definitionId)).toBeFalsy()
    const renewed={...rested,dnd5eWorldTimeAppliedMinute:970,classResources:{fighterSecondWind:{current:0,max:1}},dnd5eCombatState:{...rested.dnd5eCombatState!,activeEffects:[effect]}}
    const renewedCompletion=advanceDnd5eCampaignTimedActiveEffects(renewed,10)
    expect(renewedCompletion.classResources?.fighterSecondWind.current).toBe(1)
    expect(renewedCompletion.dnd5eRestActivityWindow).toMatchObject({completedWorldMinute:980})
    expect(source.classResources?.fighterSecondWind.current).toBe(0)
  })

  it.each(['interrupted','removed','suppressed'] as const)('does not grant expiry recovery after %s',reason=>{
    const effect=createDnd5eConditionEffect({id:'rest-reward',condition:'unconscious',source:{kind:'spell',rulesId:'test-rest'},targetId:'hero',
      duration:{type:'rounds',remainingRounds:10,tickOn:'target-turn-end'},completionRequirement:{condition:'unconscious',interrupted:reason==='interrupted'},completionReward:{kind:'short-rest'},suspendedBy:reason==='suppressed'?['blocker']:undefined})
    const blocker=createDnd5eMechanicalEffect({id:'blocker',definitionId:'blocker',label:'Blocker',targetId:'hero',source:{kind:'dm'},duration:{type:'permanent'},modifiers:{}})
    const result=advanceDnd5eCampaignTimedActiveEffects(character({classResources:{fighterSecondWind:{current:0,max:1}},dnd5eCombatState:{schemaVersion:2,activeEffects:reason==='removed'?[]:reason==='suppressed'?[effect,blocker]:[effect]}}),1)
    expect(result.classResources?.fighterSecondWind.current).toBe(0)
    expect(result.dnd5eCombatState?.activeEffects?.some(entry=>entry.definitionId.startsWith('rest-completion:'))).toBeFalsy()
  })
  it('retains interrupted completion history across campaign-time advancement and resumed conditions',()=>{
    const sleep=createDnd5eConditionEffect({id:'rest-sleep',condition:'unconscious',source:{kind:'spell'},targetId:'hero',duration:{type:'rounds',remainingRounds:100,tickOn:'target-turn-end'},completionRequirement:{condition:'unconscious',interrupted:false},suspendedBy:['blocker']})
    const blocker=createDnd5eMechanicalEffect({id:'blocker',definitionId:'blocker',label:'Blocker',source:{kind:'dm'},targetId:'hero',duration:{type:'permanent'},modifiers:{}})
    const advanced=advanceDnd5eCampaignTimedActiveEffects(character({dnd5eCombatState:{schemaVersion:2,activeEffects:[sleep,blocker]}}),1)
    const recorded=advanced.dnd5eCombatState!.activeEffects!.find(effect=>effect.id==='rest-sleep')!
    expect(recorded.completionRequirement?.interrupted).toBe(true)
    const resumed=advanceDnd5eCampaignTimedActiveEffects({...advanced,dnd5eCombatState:{...advanced.dnd5eCombatState!,activeEffects:[{...recorded,suspendedBy:undefined}]}},1)
    expect(resumed.dnd5eCombatState!.activeEffects![0].completionRequirement?.interrupted).toBe(true)
    expect(sleep.completionRequirement?.interrupted).toBe(false)
  })
  it('grants short-rest recovery without completing attunement, advancing time or inventing healing',()=>{
    const hero=character({classResources:{fighterSecondWind:{current:0,max:1}},dnd5eWorldTimeAppliedMinute:480})
    const granted=applyDnd5eInventoryMutation([hero],{type:'grant',characterId:hero.id,templateId:'srd-5.1:magic-item:ring-of-protection',quantity:1,identified:true})
    expect(granted.ok).toBe(true)
    const ring=normalizeDnd5eInventory(granted.characters[0]).entries[0]
    const pending=applyDnd5eInventoryMutation(granted.characters,{type:'prepare-attunement',characterId:hero.id,instanceId:ring.instanceId})
    expect(pending.ok).toBe(true)
    const source=pending.characters[0]
    const recovered=applyDnd5eGrantedShortRestBenefits(source,490)
    expect(recovered.classResources?.fighterSecondWind.current).toBe(1)
    expect(recovered.currentHp).toBe(source.currentHp)
    expect(recovered.hitDice).toBe(source.hitDice)
    expect(recovered.dnd5eWorldTimeAppliedMinute).toBe(480)
    expect(recovered.dnd5eRestActivityWindow).toMatchObject({event:'short-rest-complete',completedWorldMinute:490})
    const stillPending=normalizeDnd5eInventory(recovered).entries.find(entry=>entry.instanceId===ring.instanceId)!
    expect(stillPending.attuned).not.toBe(true)
    expect(stillPending.attunementPending).toBe(true)
    const actualRest=applyDnd5eShortRestBenefits(source,540)
    expect(normalizeDnd5eInventory(actualRest).entries.find(entry=>entry.instanceId===ring.instanceId)?.attuned).toBe(true)
    expect(source.classResources?.fighterSecondWind.current).toBe(0)
    expect(normalizeDnd5eInventory(source).entries.find(entry=>entry.instanceId===ring.instanceId)?.attuned).not.toBe(true)
  })
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


it('expires only effect-bound temporary hit points as exploration time advances', () => {
 const effect=createDnd5eMechanicalEffect({id:'bound',definitionId:'activity:ward:shield:marker',label:'Ward',source:{kind:'feature',actorId:'caster',rulesId:'ward'},targetId:'hero',duration:{type:'rounds',remainingRounds:10,tickOn:'target-turn-end'}})
 const hero=character({tempHp:7,dnd5eCombatState:{activeEffects:[effect],temporaryHitPointsSource:{actorId:'caster',rulesId:'ward',effectDefinitionId:'activity:ward:shield'}}})
 expect(advanceDnd5eCampaignTimedActiveEffects(hero,0).tempHp).toBe(7)
 const expired=advanceDnd5eCampaignTimedActiveEffects(hero,1)
 expect(expired.tempHp).toBe(0)
 expect(expired.dnd5eCombatState?.temporaryHitPointsSource).toBeUndefined()
 const replaced={...hero,tempHp:15,dnd5eCombatState:{...hero.dnd5eCombatState,temporaryHitPointsSource:undefined}}
 expect(advanceDnd5eCampaignTimedActiveEffects(replaced,1).tempHp).toBe(15)
 expect(hero.tempHp).toBe(7)
})


it.each([1, 10])('interrupts unverified preparation on a %i minute campaign jump instead of banking partial progress', minutes => {
  const preparation = createDnd5eMechanicalEffect({ id: 'prepare', definitionId: 'prepare', label: 'Prepare', targetId: 'hero',
    source: { kind: 'feature', actorId: 'hero', pluginId: 'test.timed' },
    duration: { type: 'rounds', remainingRounds: 100, tickOn: 'target-turn-end' }, completionGrant: { activityIds: ['finish'], availableRounds: 10 } })
  const buff = createDnd5eMechanicalEffect({ id: 'buff', definitionId: 'buff', label: 'Buff', targetId: 'hero', source: { kind: 'feature', actorId: 'hero' },
    duration: { type: 'rounds', remainingRounds: 200, tickOn: 'target-turn-end' }, modifiers: { speedBonusFeet: 1 } })
  const original = character({ dnd5eCombatState: { schemaVersion: 2, activeEffects: [preparation, buff] } })
  const before = structuredClone(original)
  const result = advanceDnd5eCampaignTimedActiveEffects(original, minutes)
  expect(original).toEqual(before)
  expect(result.dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'prepare')).toBe(false)
  expect(result.dnd5eCombatState?.activeEffects?.some(effect => effect.grantedActivities?.includes('finish'))).toBe(false)
  expect(result.dnd5eCombatState?.activeEffects?.find(effect => effect.id === 'buff')?.duration).toMatchObject({ remainingRounds: 200 - minutes * 10 })
  const resumed = advanceDnd5eCampaignTimedActiveEffects(JSON.parse(JSON.stringify(result)), 1)
  expect(resumed.dnd5eCombatState?.activeEffects?.some(effect => effect.completionGrant || effect.grantedActivities?.includes('finish'))).toBe(false)
})


it.each([0, 4, 10])('does not double-age %i combat rounds when the world minute advances', combatRounds => {
  const source = character({ dnd5eWorldTimeAppliedMinute: 100,
    dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({ id: 'guard', definitionId: 'guard', label: 'Guard',
      source: { kind: 'spell', actorId: 'hero' }, targetId: 'hero',
      duration: { type: 'rounds', remainingRounds: 30, tickOn: 'target-turn-end' } })] } })
  const nextClock = clock(101, [{ id: 'combat-minute', kind: 'advance', fromWorldMinute: 100, toWorldMinute: 101, minutes: 1,
    reason: 'combat', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1, combatRoundCredits: { [characterCombatClockKey('hero')]: combatRounds } }])
  const next = reconcileDnd5eCharacterCampaignTime(source, nextClock).character
  expect(next.dnd5eCombatState?.activeEffects?.[0].duration).toMatchObject({ remainingRounds: 20 + combatRounds })
  expect(next.dnd5eWorldTimeAppliedMinute).toBe(101)
  expect(reconcileDnd5eCharacterCampaignTime(next, nextClock).character).toEqual(next)
})


it.each(['source-turn-start','source-turn-end','target-turn-start','target-turn-end'] as const)('expires %s gates after exploration time passes, retaining permanent effects', boundary => {
  const gate=createDnd5eMechanicalEffect({id:'one-turn',definitionId:'one-turn',label:'One turn',targetId:'hero',source:{kind:'dm'},duration:{type:'until-turn-boundary',boundary},modifiers:{}})
  const permanent=createDnd5eMechanicalEffect({id:'permanent',definitionId:'permanent',label:'Permanent',targetId:'hero',source:{kind:'dm'},duration:{type:'permanent'},modifiers:{}})
  const source=character({dnd5eCombatState:{schemaVersion:2,activeEffects:[gate,permanent]}})
  const before=structuredClone(source)
  expect(advanceDnd5eCampaignTimedActiveEffects(source,0).dnd5eCombatState?.activeEffects?.map(e=>e.id)).toEqual(['one-turn','permanent'])
  expect(advanceDnd5eCampaignTimedActiveEffects(source,1).dnd5eCombatState?.activeEffects?.map(e=>e.id)).toEqual(['permanent'])
  expect(source).toEqual(before)
})
