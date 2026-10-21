import { describe, expect, it } from 'vitest'
import {
  dnd5eActivityChoiceLogDetails,
  dnd5eActivityChoicesFromPayload,
  dnd5eActivityExtraTurnRollResult,
  dnd5eActivityHandoffLogDetails,
  dnd5eActivityRollLogDetails,
  dnd5eActivityRollLogEvidence,
} from './dnd5eActivityHandoffLogDetails'
import {
  dnd5eSrdAuditedFullContentDefinitionsV1,
  dnd5eSrdAuditedSpellActivityV1,
} from '../../rulesets/dnd5e/activities/dnd5eSrdAuditedSpellActivities'
import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import type { Dnd5eCombatEvent } from '../../rulesets/dnd5e/headlessCombatEngine'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

describe('dnd5eActivityHandoffLogDetails', () => {
  it('shows only the settled entity defenses without inventing a roll or physical-entity immunity', () => {
    expect(dnd5eActivityHandoffLogDetails({ persistentEntityResults: [{
      operationId: 'impact', areaId: 'projection', label: '幻影巨龙', damageImmune: true,
      savingThrow: { ability: 'dex', dc: 19, succeeded: true, automatic: true },
      immuneConditions: ['restrained', 'custom:mark'],
    }] })).toEqual(['幻影巨龙：DEX 豁免自动成功（无需掷骰）；免疫伤害；免疫状态：束缚、custom:mark'])
    expect(dnd5eActivityHandoffLogDetails({ persistentEntityResults: [{
      operationId: 'impact', areaId: 'physical', label: '实体', damageImmune: false,
    }] })).toEqual([])
    expect(dnd5eActivityHandoffLogDetails({})).toEqual([])
  })
  it('matches each concentration check to its own saving-throw result', () => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'sequence', name: 'Sequence',
      activation: { kind: 'free' }, target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
      checks: ['first', 'second'].map(id => ({ id, rollId: id, kind: 'concentration-check', ability: 'con', scope: 'shared', dc: { kind: 'constant', value: 12 } })),
      outcomes: [] }
    const rolls = { first: { values: [2, 18], modifier: 0, total: 20 }, second: { values: [2, 18], modifier: 0, total: 20 } }
    const events: Dnd5eCombatEvent[] = [
      { type: 'concentration-resolved', actorId: 'actor', activityId: 'sequence', checkId: 'first', d20: 18, total: 25, dc: 12, success: true },
      { type: 'concentration-resolved', actorId: 'actor', activityId: 'sequence', checkId: 'second', d20: 2, total: 9, dc: 12, success: false },
    ]
    expect(dnd5eActivityRollLogDetails(activity, rolls, events)).toEqual([
      'Activity 检定骰据：first｜候选 2 / 18｜采用 18 + 7 = 25；对抗 DC 12｜成功',
      'Activity 检定骰据：second｜候选 2 / 18｜采用 2 + 7 = 9；对抗 DC 12｜失败',
    ])
    expect(dnd5eActivityRollLogEvidence(activity, rolls, events, 'actor')).toMatchObject([
      { rollId: 'first', adoptedValue: 18, modifier: 7, total: 25 },
      { rollId: 'second', adoptedValue: 2, modifier: 7, total: 9 },
    ])
  })
  it('exposes Knock ordinary-lock and Arcane Lock suppression semantics', () => {
    expect(dnd5eActivityHandoffLogDetails({
      mapObjectLocks: [{ mode: 'knock', suppressionMinutes: 10 }],
    })).toEqual([
      '地图物件锁：解除一个普通锁；若为秘法锁则压制 10 分钟',
    ])
  })

  it('exposes Arcane Lock map mutation', () => {
    expect(dnd5eActivityHandoffLogDetails({
      mapObjectLocks: [{ mode: 'arcane-lock' }],
    })).toEqual(['地图物件锁：施加秘法锁'])
  })

  it('exposes vertical movement and its committed map elevation', () => {
    expect(dnd5eActivityHandoffLogDetails({
      movements: [
        { targetId: 'cube', mode: 'ascend', distanceFeet: 20 },
        { targetId: 'spectator', mode: 'push', distanceFeet: 5 },
      ],
      targetLabelsById: { cube: '胶质立方怪', spectator: '旁观者' },
      targetElevationsFeetById: { cube: 20, spectator: 0 },
    })).toEqual(['地图垂直位移：胶质立方怪｜上升 20 尺｜当前高度 20 尺'])
  })

  it('exposes the selected Activity option instead of hiding a default', () => {
    expect(dnd5eActivityChoiceLogDetails({ choices: [{
      id: 'mode', label: '调整高度', defaultOptionId: 'up-20',
      options: [
        { id: 'up-20', label: '上升20尺' },
        { id: 'down-10', label: '下降10尺' },
      ],
    }] }, { mode: 'down-10' })).toEqual([
      'Activity 选项：调整高度｜下降10尺（down-10）',
    ])
    expect(dnd5eActivityChoicesFromPayload({
      activeEffectId: 'levitate-controller',
      activityChoices: { mode: 'down-10', ignored: 5 },
    })).toEqual({ mode: 'down-10' })
  })

  it('exposes the Time Stop d4 and final extra-turn count', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('time-stop')
    const rolls = {
      'time-stop-extra-turns-d4': { values: [3], modifier: 0, total: 3 },
    }
    expect(dnd5eActivityExtraTurnRollResult(activity, rolls)).toEqual({
      formula: '1d4 + 1', turns: 4,
    })
    expect(dnd5eActivityRollLogDetails(activity, rolls)).toEqual([
      'Activity 骰据：time-stop-extra-turns-d4｜3 = 3',
      '额外回合：1d4 + 1 = 4 回合',
    ])
  })

  it('does not sum host-derived d20 candidates and exposes the authoritative Arcane Sword total', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('arcane-sword')
    const rolls = {
      'arcane-sword-initial-damage': { values: [8, 1, 2], modifier: 0, total: 11 },
      'spell-attack-d20:target': { values: [14, 13], modifier: 0, total: 27 },
    }
    expect(dnd5eActivityRollLogDetails(activity, rolls, [{
      type: 'attack-resolved', actorId: 'caster', targetId: 'target', d20: 14,
      total: 25, armorClass: 15, hit: true, critical: false,
      attackMode: 'spell', attackOrigin: 'other',
    }])).toEqual([
      'Activity 骰据：arcane-sword-initial-damage｜8 + 1 + 2 = 11',
      'Activity d20 骰据：spell-attack-d20:target｜候选 14 / 13｜采用 14 + 11 = 25',
    ])
  })

  it('does not sum opposed d20 candidates and exposes authoritative Arcane Hand totals', () => {
    const definition = dnd5eSrdAuditedFullContentDefinitionsV1()
      .find((candidate) => candidate.id === 'arcane-hand')
    const activity = (definition?.activities as readonly Dnd5eActivityDefinitionV1[] | undefined)
      ?.find((candidate) => candidate.id === 'spell:arcane-hand:forceful-hand')
    const rolls = {
      'arcane-hand-strength-d20:target': { values: [17, 3], modifier: 0, total: 20 },
      'arcane-hand-target-d20:target': { values: [18, 7], modifier: 0, total: 25 },
    }
    expect(dnd5eActivityRollLogDetails(activity, rolls, [{
      type: 'opposed-ability-check-resolved',
      actorId: 'caster', targetId: 'target',
      activityId: 'spell:arcane-hand:forceful-hand', checkId: 'arcane-hand-contest',
      sourceAbility: 'str', sourceD20: 17, sourceModifier: 8, sourceTotal: 25,
      targetAbility: 'str', targetSkill: 'athletics',
      targetD20: 18, targetModifier: 7, targetTotal: 25,
      success: false,
    }])).toEqual([
      'Activity 对抗骰据：arcane-hand-strength-d20:target｜候选 17 / 3｜主动方采用 17 + 8 = 25；对抗 25 vs 25｜失败',
      'Activity 对抗骰据：arcane-hand-target-d20:target｜候选 18 / 7｜目标方采用 18 + 7 = 25',
    ])
  })
})
