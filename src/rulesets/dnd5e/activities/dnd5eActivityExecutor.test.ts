import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'

const abilities = { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 16 } as const
const actor: Dnd5eActivityActorSnapshot = {
  id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3, abilities,
  armorClass: 15, conditions: [], currentHp: 30, maxHp: 30,
}
const target: Dnd5eActivityActorSnapshot = {
  id: 'target', controller: 'dm', level: 3, proficiencyBonus: 2, abilities,
  armorClass: 14, conditions: [], currentHp: 20, maxHp: 20, savingThrowModifiers: { dex: 1 },
}

function saveActivity(): Dnd5eActivityDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'thunder-wave',
    name: '雷鸣波',
    activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
    checks: [{
      id: 'save', kind: 'saving-throw', rollId: 'save', ability: 'dex',
      dc: { kind: 'constant', value: 14 }, rollMode: 'normal', scope: 'per-target',
    }],
    outcomes: [
      {
        id: 'failure', when: { kind: 'check', checkId: 'save', result: 'failure' },
        operations: [{
          id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 2, sides: 6 },
          damageType: 'thunder', magical: true,
        }],
      },
      {
        id: 'success', when: { kind: 'check', checkId: 'save', result: 'success' },
        operations: [{
          id: 'half-damage', kind: 'damage', target: 'target',
          amount: { kind: 'floor', value: { kind: 'multiply', values: [
            { kind: 'dice', rollId: 'damage', count: 2, sides: 6 },
            { kind: 'constant', value: 0.5 },
          ] } },
          damageType: 'thunder', magical: true,
        }],
      },
    ],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

describe('generic D&D 5e Activity executor', () => {
  it('resolves a failed save into capability proposals without mutating snapshots', () => {
    const result = resolveDnd5eActivity({
      activity: saveActivity(), actor, targets: [target], distanceFeetByTargetId: { target: 20 },
      rolls: { 'save:target': { values: [10] }, damage: { values: [4, 5] } },
    })
    expect(result, JSON.stringify(result)).toMatchObject({
      ok: true,
      status: 'resolved',
      proposals: [{ kind: 'deal-damage', targetId: 'target', amount: 9, damageType: 'thunder' }],
    })
    expect(target.currentHp).toBe(20)
  })

  it('uses the success outcome and a shared authoritative damage roll', () => {
    const result = resolveDnd5eActivity({
      activity: saveActivity(), actor, targets: [target], distanceFeetByTargetId: { target: 20 },
      rolls: { 'save:target': { values: [15] }, damage: { values: [4, 5] } },
    })
    expect(result).toMatchObject({ ok: true, proposals: [{ amount: 4 }] })
  })

  it('rejects invalid targets before reading any dice', () => {
    expect(resolveDnd5eActivity({
      activity: saveActivity(), actor, targets: [{ ...target, controller: 'players' }],
      distanceFeetByTargetId: { target: 20 }, rolls: {},
    })).toEqual({ ok: false, reason: 'invalid-target', details: ['target relation is invalid'] })
  })

  it('applies custom-table cantrip scaling to authoritative dice declarations', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      id: 'scaled-bolt',
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 120 },
      checks: undefined,
      outcomes: [{
        id: 'damage', when: { kind: 'always' }, operations: [{
          id: 'bolt-damage', kind: 'damage', target: 'target',
          amount: { kind: 'dice', rollId: 'bolt-damage', count: 1, sides: 10 },
          damageType: 'fire', magical: true,
        }],
      }],
      scaling: [{
        basis: 'custom-table',
        table: [{ level: 1, value: 0 }, { level: 5, value: 1 }, { level: 11, value: 2 }, { level: 17, value: 3 }],
        adjustments: [{ operationId: 'bolt-damage', diceCountPerStep: 1 }],
      }],
    }
    const result = resolveDnd5eActivity({
      activity, actor: { ...actor, level: 5 }, targets: [target],
      distanceFeetByTargetId: { target: 30 }, rolls: { 'bolt-damage': { values: [6, 7] } },
    })
    expect(result).toMatchObject({ ok: true, proposals: [{ kind: 'deal-damage', amount: 13 }] })
  })

  it('applies slot scaling, extra projectiles, and rebuilds the authoritative area instance', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'scaled-zone', name: 'Scaled Zone', activation: { kind: 'action' },
      target: { kind: 'area', relation: 'enemy', origin: 'point', shape: 'rect', lengthFeet: 20, widthFeet: 10, heightFeet: 5, placeRangeFeet: 60, maximumTargets: 1, rotatable: true },
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [
        { id: 'zone-damage', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'zone-damage', count: 1, sides: 6 }, damageType: 'cold' },
        { id: 'zone-area', kind: 'create-persistent-area', label: 'Zone', durationRounds: 2, concentration: true },
      ] }],
      scaling: [{ basis: 'slot-level', baseLevel: 2, adjustments: [
        { operationId: 'zone-damage', diceCountPerStep: 1, additionalTargetsPerStep: 1, additionalProjectilesPerStep: 1 },
        { operationId: 'zone-area', durationRoundsPerStep: 2 },
      ] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const second = { ...target, id: 'target-2' }
    const result = resolveDnd5eActivity({
      activity, actor, targets: [target, second], castLevel: 3,
      areaPlacement: { x: 12, y: 18, angleDegrees: 725 }, areaPlacementDistanceFeet: 40,
      rolls: { 'zone-damage': { values: [3, 4] } },
    })
    expect(result, JSON.stringify(result)).toMatchObject({
      ok: true,
      areaInstance: { shape: 'rect', x: 12, y: 18, angleDegrees: 5, lengthFeet: 20, widthFeet: 10 },
      proposals: expect.arrayContaining([
        expect.objectContaining({ kind: 'deal-damage', targetId: 'target', amount: 7 }),
        expect.objectContaining({ kind: 'deal-damage', targetId: 'target', amount: 7 }),
        expect.objectContaining({ kind: 'deal-damage', targetId: 'target-2', amount: 7 }),
        expect.objectContaining({ kind: 'deal-damage', targetId: 'target-2', amount: 7 }),
        expect.objectContaining({ kind: 'create-persistent-area', durationRounds: 4 }),
      ]),
    })
  })
})
