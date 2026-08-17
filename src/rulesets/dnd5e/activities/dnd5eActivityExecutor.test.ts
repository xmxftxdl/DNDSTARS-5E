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
  it('evaluates equipment, free-hand, and spellcasting predicates from the Host actor snapshot', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'qualified-feature', name: 'Qualified feature', activation: { kind: 'free' },
      target: { kind: 'self' },
      requirements: [
        { kind: 'armor-equipped', subject: 'actor', categories: ['medium'], proficient: true },
        { kind: 'armor-proficiency', subject: 'actor', categories: ['medium'], match: 'all' },
        { kind: 'held-item', subject: 'actor', slot: 'main-hand', roles: ['weapon'], weaponModes: ['melee'], proficient: true },
        { kind: 'free-hands', subject: 'actor', minimum: 1 },
        { kind: 'spellcasting-capability', subject: 'actor', capable: true, classIds: ['wizard'] },
      ],
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
        id: 'temp', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 1 },
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const qualified: Dnd5eActivityActorSnapshot = {
      ...actor,
      equipment: {
        armorCategory: 'medium', armorProficient: true, armorProficiencies: ['light', 'medium'], freeHands: 1,
        mainHand: { itemId: 'longsword', roles: ['weapon'], weaponMode: 'melee', proficient: true },
      },
      spellcasting: { capable: true, classIds: ['wizard'] },
    }
    expect(resolveDnd5eActivity({ activity, actor: qualified, targets: [qualified], rolls: {} }))
      .toMatchObject({ ok: true })
    expect(resolveDnd5eActivity({
      activity, actor: { ...qualified, equipment: { ...qualified.equipment!, freeHands: 0 } },
      targets: [qualified], rolls: {},
    })).toMatchObject({ ok: false, reason: 'requirement-failed' })
  })

  it('projects an owned-companion command as a closed Host capability', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'command-companion', name: 'Command Companion',
      activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'ally', count: 1, rangeFeet: 60 },
      choices: [{
        id: 'command', label: 'Command', defaultOptionId: 'attack',
        options: [{ id: 'attack', label: 'Attack' }, { id: 'dodge', label: 'Dodge' }],
      }],
      outcomes: [{
        id: 'attack', when: { kind: 'choice', choiceId: 'command', optionId: 'attack' },
        operations: [{ id: 'issue', kind: 'command-owned-companion', target: 'target', command: 'attack' }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const result = resolveDnd5eActivity({
      activity, actor, targets: [{ ...target, controller: actor.controller }],
      rolls: {}, choices: { command: 'attack' }, distanceFeetByTargetId: { target: 20 },
    })
    expect(result).toMatchObject({
      ok: true,
      proposals: [{ kind: 'command-owned-companion', targetId: 'target', command: 'attack' }],
    })
  })

  it('derives a reusable summon combat profile from the Host actor snapshot', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'companion', name: 'Companion', activation: { kind: 'action' },
      target: { kind: 'area', relation: 'ally', origin: 'point', shape: 'circle', radiusFeet: 5, maximumTargets: 1 },
      outcomes: [{ id: 'summon', when: { kind: 'always' }, operations: [{
        id: 'wolf', kind: 'summon', monsterId: 'srd-5.1:wolf', count: { kind: 'constant', value: 1 },
        timing: 'immediate', durationRounds: 100, concentration: false, side: 'ally', persistent: true,
        minimumMaximumHitPoints: { kind: 'multiply', values: [
          { kind: 'reference', reference: { kind: 'actor-class-level', classId: 'ranger' } },
          { kind: 'constant', value: 4 },
        ] },
        armorClassBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        weaponAttackBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        weaponDamageBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        savingThrowBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        proficientSkillCheckBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        weaponAttacksMagical: true,
        attacksPerAction: { kind: 'constant', value: 2 },
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const result = resolveDnd5eActivity({
      activity,
      actor: { ...actor, classLevels: { ranger: 11 } },
      targets: [], rolls: {},
      areaPlacement: { x: 5, y: 5, angleDegrees: 0 },
      areaPlacementDistanceFeet: 10,
    })
    expect(result).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'summon', minimumMaximumHitPoints: 44,
        armorClassBonus: 3, weaponAttackBonus: 3, weaponDamageBonus: 3,
        savingThrowBonus: 3, proficientSkillCheckBonus: 3,
        weaponAttacksMagical: true, attacksPerAction: 2,
      }],
    })
  })

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

  it('commits host-validated adjustable area dimensions', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'adjustable-wall', name: 'Adjustable Wall', activation: { kind: 'action' },
      target: { kind: 'area', relation: 'enemy', origin: 'point', shape: 'rect', lengthFeet: 100, minimumLengthFeet: 5, widthFeet: 5, heightFeet: 5, placeRangeFeet: 90, maximumTargets: 1, rotatable: true },
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 1 }, damageType: 'force' }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const validResult = resolveDnd5eActivity({
      activity, actor, targets: [target], areaPlacement: { x: 2, y: 3, lengthFeet: 35, widthFeet: 5, heightFeet: 5 }, areaPlacementDistanceFeet: 30, dmApproved: true, rolls: {},
    })
    expect(validResult, JSON.stringify(validResult)).toMatchObject({ ok: true, areaInstance: { lengthFeet: 35, widthFeet: 5, heightFeet: 5 } })
    expect(resolveDnd5eActivity({
      activity, actor, targets: [target], areaPlacement: { x: 2, y: 3, lengthFeet: 105 }, areaPlacementDistanceFeet: 30, dmApproved: true, rolls: {},
    })).toEqual({ ok: false, reason: 'invalid-target', details: ['area dimensions are invalid'] })
  })

  it('evaluates illumination requirements from the authoritative actor snapshot', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      id: 'shadow-only-activity',
      requirements: [{
        kind: 'illumination', subject: 'actor', values: ['dim', 'darkness', 'magical-darkness'],
      }],
    }
    const input = {
      activity,
      targets: [target],
      distanceFeetByTargetId: { target: 20 },
      rolls: { 'save:target': { values: [10] }, damage: { values: [4, 5] } },
    }
    expect(resolveDnd5eActivity({ ...input, actor: { ...actor, illumination: 'dim' } }).ok).toBe(true)
    expect(resolveDnd5eActivity({ ...input, actor: { ...actor, illumination: 'bright' } }))
      .toMatchObject({ ok: false, reason: 'requirement-failed' })
  })

  it('evaluates target ability-score requirements without trusting client metadata', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      id: 'low-intelligence-target',
      requirements: [{
        kind: 'ability-score', subject: 'target', ability: 'int', comparison: 'at-most', value: 7,
      }],
    }
    const input = {
      activity, actor, distanceFeetByTargetId: { target: 20 },
      rolls: { 'save:target': { values: [10] }, damage: { values: [4, 5] } },
    }
    expect(resolveDnd5eActivity({ ...input, targets: [{ ...target, abilities: { ...abilities, int: 6 } }] }).ok).toBe(true)
    expect(resolveDnd5eActivity({ ...input, targets: [{ ...target, abilities: { ...abilities, int: 8 } }] }))
      .toMatchObject({ ok: false, reason: 'requirement-failed' })
  })

  it('compiles an exact skill-check advantage into the shared active-effect proposal', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'stealth-blessing', name: 'Stealth Blessing', activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'ally', count: 1, rangeFeet: 5 },
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
        { id: 'apply-stealth', kind: 'apply-effect', target: 'target', effectId: 'stealth-advantage' },
      ] }],
      effects: [{
        schemaVersion: 1, id: 'stealth-advantage', name: 'Stealth Advantage',
        duration: { kind: 'rounds', rounds: 600, expiresAt: 'source-turn-end' },
        modifiers: [{ kind: 'ability-check', ability: 'dex', skill: 'stealth', mode: 'advantage' }],
        stacking: 'unique-by-source',
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const ally = { ...target, controller: actor.controller }
    expect(resolveDnd5eActivity({
      activity, actor, targets: [ally], distanceFeetByTargetId: { target: 5 }, rolls: {},
    })).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'apply-effect', targetId: 'target', exclusiveBySource: true,
        modifierGroups: [{ abilityCheckAdvantages: ['dex'], skillCheckAdvantages: ['stealth'] }],
      }],
    })
  })

  it('preserves concentration on an effect that also repeats a saving throw', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'concentrated-save-ends', name: 'Concentrated Save Ends',
      activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 60 },
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{
        id: 'apply-charm', kind: 'apply-effect', target: 'target', effectId: 'charm',
      }] }],
      effects: [{
        schemaVersion: 1, id: 'charm', name: 'Charm',
        duration: {
          kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end', ability: 'wis',
          dc: { kind: 'constant', value: 14 },
        },
        conditions: ['charmed'], stacking: 'unique-by-source', concentration: true,
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    expect(resolveDnd5eActivity({
      activity, actor, targets: [target], distanceFeetByTargetId: { target: 30 }, rolls: {},
    })).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'apply-effect', targetId: 'target', concentration: true,
        duration: { kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end', ability: 'wis', dc: 14 },
      }],
    })
  })

  it('compiles temporary senses into the shared active-effect proposal', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'temporary-senses', name: 'Temporary Senses', activation: { kind: 'action' },
      target: { kind: 'self' },
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
        { id: 'apply-senses', kind: 'apply-effect', target: 'actor', effectId: 'senses-effect' },
      ] }],
      effects: [{
        schemaVersion: 1, id: 'senses-effect', name: 'Temporary Senses',
        duration: { kind: 'rounds', rounds: 100, expiresAt: 'source-turn-end' },
        modifiers: [{ kind: 'darkvision', rangeFeet: 60 }, { kind: 'see-invisible' }],
        stacking: 'refresh-duration',
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    expect(resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} })).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'apply-effect', targetId: 'actor',
        modifierGroups: [{ darkvisionRangeFeet: 60, seeInvisible: true }],
      }],
    })
  })

  it('compiles flight and class-scoped spell pressure/economy into one reusable effect', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'transformation-mode', name: 'Transformation Mode', activation: { kind: 'action' },
      target: { kind: 'self' },
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
        { id: 'apply-mode', kind: 'apply-effect', target: 'actor', effectId: 'mode' },
      ] }],
      effects: [{
        schemaVersion: 1, id: 'mode', name: 'Mode',
        duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-end' },
        modifiers: [
          { kind: 'flight-speed', speedFeet: 60 },
          { kind: 'spell-action-as-bonus-action', spellcastingClassIds: ['paladin'] },
          { kind: 'spell-save-disadvantage-aura', radiusFeet: 10, spellcastingClassIds: ['paladin'] },
        ],
        stacking: 'refresh-duration',
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    expect(resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} })).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'apply-effect', targetId: 'actor',
        modifierGroups: [{
          flySpeedFeet: 60,
          spellActionAsBonusActionClassIds: ['paladin'],
          spellSaveDisadvantageAura: { radiusFeet: 10, damageTypes: [], spellcastingClassIds: ['paladin'] },
        }],
      }],
    })
  })

  it('rejects a triggered choice whose Host spell metadata does not satisfy its requirements', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'recover-slot', name: 'Recover Slot', activation: { kind: 'passive' },
      invocation: { kind: 'triggered', event: 'spell-resolved', confirmation: 'actor-choice' },
      target: { kind: 'self' },
      choices: [{
        id: 'slot', label: 'Slot', options: [
          { id: 'one', label: 'Level 1', requirements: [{ kind: 'spell-used', schools: ['divination'], minimumLevel: 2 }] },
          { id: 'two', label: 'Level 2', requirements: [{ kind: 'spell-used', schools: ['divination'], minimumLevel: 3 }] },
        ],
      }],
      outcomes: [{ id: 'restore', when: { kind: 'choice', choiceId: 'slot', optionId: 'two' }, operations: [
        { id: 'restore-two', kind: 'resource', subject: 'actor', resourceId: 'dnd5e-spell-slot-2', mode: 'restore', amount: { kind: 'constant', value: 1 } },
      ] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const triggerContext = {
      eventId: 'event:spell', event: 'spell-resolved' as const,
      source: { kind: 'spell' as const, id: 'augury', level: 2, school: 'divination' as const },
      eligibleActorIds: ['actor'], eligibleTargetIds: ['actor'],
    }
    expect(resolveDnd5eActivity({
      activity, actor: { ...actor, resources: { 'dnd5e-spell-slot-2': { current: 0, maximum: 1 } } },
      targets: [actor], rolls: {}, choices: { slot: 'two' }, triggerContext, confirmedBy: 'actor',
    })).toMatchObject({ ok: false, reason: 'requirement-failed' })
    expect(resolveDnd5eActivity({
      activity, actor: { ...actor, resources: { 'dnd5e-spell-slot-2': { current: 0, maximum: 1 } } },
      targets: [actor], rolls: {}, choices: { slot: 'one' }, triggerContext, confirmedBy: 'actor',
    })).toMatchObject({ ok: true })
  })
})
