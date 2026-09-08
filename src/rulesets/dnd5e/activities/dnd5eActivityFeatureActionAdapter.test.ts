import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'

describe('dnd5ePluginFeatureActionFromActivityV1', () => {
  it('projects movement-activated controls without fabricating an action cost', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'spell:levitate:move-self',
      name: '浮空术·移动自己',
      activation: { kind: 'movement', cost: 0 },
      consumption: [{
        kind: 'movement', amount: { kind: 'constant', value: 10 }, consumeOn: 'resolve',
      }],
      target: {
        kind: 'creature', relation: 'any', rangeFeet: 60, count: 1, includeSelf: true,
      },
      outcomes: [{
        id: 'move',
        when: { kind: 'always' },
        operations: [{
          id: 'ascend', kind: 'move', target: 'target', mode: 'ascend',
          distanceFeet: { kind: 'constant', value: 5 }, usesActorMovement: true,
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
      requirements: [{ kind: 'once-per-turn', key: 'levitate-move' }],
    }

    expect(dnd5ePluginFeatureActionFromActivityV1(activity)).toMatchObject({
      id: 'spell:levitate:move-self',
      economy: 'none',
      oncePerTurnKeys: ['levitate-move'],
      targeting: { kind: 'single-creature', includeSelf: true },
    })
  })
})
