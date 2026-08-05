import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityRequiredPhases, validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

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

  it('rejects dangling checks, arbitrary ids and false full-automation claims', () => {
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
      'full automation cannot contain manual adjudication operations',
    ]))
  })
})
