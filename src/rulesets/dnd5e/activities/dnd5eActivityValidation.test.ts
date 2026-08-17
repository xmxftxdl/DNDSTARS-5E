import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityRequiredPhases, validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'

function damageActivity(): Dnd5eActivityDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'ember-burst',
    name: '余烬爆发',
    activation: { kind: 'action' },
    target: {
      kind: 'area', relation: 'enemy', origin: 'point', shape: 'rect', placeRangeFeet: 60,
      widthFeet: 30, heightFeet: 5, maximumTargets: 32, rotatable: true,
    },
    checks: [{
      id: 'save', kind: 'saving-throw', rollId: 'save', ability: 'dex',
      dc: { kind: 'constant', value: 14 }, scope: 'per-target',
    }],
    outcomes: [{
      id: 'failed-save',
      when: { kind: 'check', checkId: 'save', result: 'failure' },
      operations: [{
        id: 'damage', kind: 'damage', target: 'target', damageType: 'fire',
        amount: { kind: 'dice', rollId: 'damage', count: 3, sides: 6 }, magical: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

describe('D&D 5e Activity validation', () => {
  it('validates a freely rotatable wall-like damage Activity', () => {
    const activity = damageActivity()
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(dnd5eActivityRequiredPhases(activity)).toEqual(expect.arrayContaining([
      'eligibility', 'targeting', 'saving-throw', 'damage', 'persistence',
    ]))
  })

  it('rejects dangling checks and arbitrary ids while deriving automation independently of legacy claims', () => {
    const activity = damageActivity()
    const invalid: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'Bad Activity',
      outcomes: [{
        id: 'manual',
        when: { kind: 'check', checkId: 'missing', result: 'failure' },
        operations: [{
          id: 'manual', kind: 'manual-adjudication', prompt: '请裁定', reason: '地图改变',
          requiresDmApproval: true,
        }],
      }],
    }
    expect(validateDnd5eActivityDefinitionV1(invalid)).toEqual(expect.arrayContaining([
      'activity.id is invalid',
      'activity.outcomes[0].when references an unknown check',
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(invalid).capability).toMatchObject({
      level: 'assisted',
      limitations: expect.arrayContaining(['Activity 包含显式 DM 裁定 operation。']),
    })
  })

  it('rejects runtime-only unknown activation, trigger, target and operation values', () => {
    const invalid = {
      ...damageActivity(),
      activation: { kind: 'script' },
      invocation: { kind: 'triggered', event: 'after-anything', confirmation: 'automatic' },
      target: { kind: 'zone', relation: 'enemy' },
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{ id: 'execute', kind: 'javascript' }] }],
    } as unknown as Dnd5eActivityDefinitionV1
    expect(validateDnd5eActivityDefinitionV1(invalid)).toEqual(expect.arrayContaining([
      'activity.invocation.event is invalid',
      'activity.activation.kind is invalid',
      'activity.target.kind is invalid',
      'activity.outcomes[0].operations[0].kind is invalid',
    ]))
  })

  it('validates source-turn maintenance links and rejects arbitrary effect ids', () => {
    const valid: Dnd5eActivityDefinitionV1 = {
      ...damageActivity(),
      effects: [{
        schemaVersion: 1,
        id: 'maintained-charm',
        name: '维持中的魅惑',
        duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' },
        sourceLink: { sourceRequiresEffectAtSourceTurnEnd: 'maintained-this-turn' },
        stacking: 'refresh-duration',
      }],
    }
    expect(validateDnd5eActivityDefinitionV1(valid)).toEqual([])
    expect(validateDnd5eActivityDefinitionV1({
      ...valid,
      effects: [{
        ...valid.effects![0]!,
        sourceLink: { sourceRequiresEffectAtSourceTurnEnd: 'Bad Effect ID' },
      }],
    })).toContain('activity.effects[0].sourceLink.sourceRequiresEffectAtSourceTurnEnd is invalid')
  })
})
