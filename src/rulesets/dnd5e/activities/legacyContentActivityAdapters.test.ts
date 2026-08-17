import { describe, expect, it } from 'vitest'
import type { DeclarativeSubclassAbilityV1 } from '../declarativeSubclassAbility'
import type { Dnd5eMonsterAction } from '../monsters'
import type { Dnd5ePluginSpellDefinition } from '../pluginApi'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { dnd5eActivityFromCustomHeadlessAction } from './legacyCustomHeadlessActivityAdapter'
import {
  dnd5eActivityFromDeclarativeSubclassAbility,
  dnd5eActivityFromMonsterAction,
  dnd5eActivityFromSpellDefinition,
} from './legacyContentActivityAdapters'

function damageSpell(): Dnd5ePluginSpellDefinition {
  return {
    id: 'ember-wave',
    name: 'Ember Wave',
    level: 3,
    school: 'evocation',
    ritual: false,
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'distance', feet: 150, shape: 'sphere', sizeFeet: 20 },
    targeting: { relation: 'enemy', maximumTargets: 64 },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    classes: ['wizard'],
    description: 'Synthetic spell.',
    mechanics: {
      kind: 'damage',
      resolution: 'saving-throw',
      savingThrow: { ability: 'dex', onSuccess: 'half' },
      damage: { dice: { count: 8, sides: 6, bonus: 0 }, type: 'fire' },
    },
    automation: { mode: 'headless-action', actionId: 'ember-wave-action' },
  }
}

describe('legacy content Activity adapters', () => {
  it('projects a normal save spell without a spell-specific resolver', () => {
    const activity = dnd5eActivityFromSpellDefinition(damageSpell(), 'headless-action')
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity).toMatchObject({
      id: 'spell:ember-wave',
      target: { kind: 'area', shape: 'sphere', radiusFeet: 20, placeRangeFeet: 150 },
      automation: { level: 'full' },
    })
    expect(activity.outcomes.map((outcome) => outcome.when)).toEqual([
      { kind: 'check', checkId: 'spell-save', result: 'failure' },
      { kind: 'check', checkId: 'spell-save', result: 'success' },
    ])
  })

  it('keeps the owning save gate when a linked Headless action supplies the effects', () => {
    const linked = dnd5eActivityFromCustomHeadlessAction({
      id: 'ember-wave-action', label: 'Ember Wave effects',
      effects: [{ kind: 'damage', dice: { count: 8, sides: 6 }, damageType: 'fire' }],
    })
    const activity = dnd5eActivityFromSpellDefinition(damageSpell(), 'headless-action', linked)
    expect(activity.checks).toContainEqual(expect.objectContaining({ id: 'spell-save', kind: 'saving-throw' }))
    expect(activity.outcomes.map((outcome) => outcome.when)).toEqual([
      { kind: 'check', checkId: 'spell-save', result: 'failure' },
      { kind: 'check', checkId: 'spell-save', result: 'success' },
    ])
    expect(activity.outcomes[0]?.operations[0]).toMatchObject({ kind: 'damage', target: 'target' })

    const actor: Dnd5eActivityActorSnapshot = {
      id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3,
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      armorClass: 12, currentHp: 30, maxHp: 30, conditions: [], spellSaveDc: 15,
    }
    const targets: Dnd5eActivityActorSnapshot[] = [
      { ...actor, id: 'failed', controller: 'dm', currentHp: 20, maxHp: 20, savingThrowModifiers: { dex: 0 } },
      { ...actor, id: 'passed', controller: 'dm', currentHp: 20, maxHp: 20, savingThrowModifiers: { dex: 0 } },
    ]
    const result = resolveDnd5eActivity({
      activity, actor, targets,
      areaPlacement: { x: 100, y: 100 }, areaPlacementDistanceFeet: 120,
      checkRollModes: { 'spell-save:failed': 'normal', 'spell-save:passed': 'normal' },
      rolls: {
        'spell-save-d20:failed': { values: [5] },
        'spell-save-d20:passed': { values: [18] },
        'effect-0': { values: [1, 2, 3, 4, 5, 6, 1, 2] },
      },
    })
    expect(result).toMatchObject({
      ok: true,
      proposals: [
        { kind: 'deal-damage', targetId: 'failed', amount: 24 },
        { kind: 'deal-damage', targetId: 'passed', amount: 12 },
      ],
    })
  })

  it('projects explicit cantrip thresholds into the shared Activity scaling recipe', () => {
    const spell: Dnd5ePluginSpellDefinition = {
      ...damageSpell(),
      id: 'resonant-pulse',
      name: 'Resonant Pulse',
      level: 0,
      range: { type: 'distance', feet: 60 },
      targeting: { relation: 'enemy', maximumTargets: 1 },
      mechanics: {
        kind: 'damage',
        resolution: 'automatic',
        damage: {
          dice: { count: 1, sides: 6, bonus: 0 },
          type: 'thunder',
          cantripScaling: {
            basis: 'character-level',
            steps: [
              { level: 5, diceCount: 1 },
              { level: 11, diceCount: 1, flatDamage: 2 },
              { level: 17, diceCount: 1 },
            ],
          },
        },
      },
      automation: { mode: 'headless-action', actionId: 'resonant-pulse' },
    }
    const activity = dnd5eActivityFromSpellDefinition(spell, 'headless-action')
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.automation.level).toBe('full')
    expect(activity.scaling).toEqual([
      {
        basis: 'custom-table',
        table: [{ level: 1, value: 0 }, { level: 5, value: 1 }],
        adjustments: [{ operationId: 'spell-damage', diceCountPerStep: 1 }],
      },
      {
        basis: 'custom-table',
        table: [{ level: 1, value: 0 }, { level: 11, value: 1 }],
        adjustments: [{ operationId: 'spell-damage', diceCountPerStep: 1, flatAmountPerStep: 2 }],
      },
      {
        basis: 'custom-table',
        table: [{ level: 1, value: 0 }, { level: 17, value: 1 }],
        adjustments: [{ operationId: 'spell-damage', diceCountPerStep: 1 }],
      },
    ])

    const actor: Dnd5eActivityActorSnapshot = {
      id: 'actor', controller: 'players', level: 11, proficiencyBonus: 4,
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      armorClass: 12, currentHp: 30, maxHp: 30, conditions: [],
    }
    const target: Dnd5eActivityActorSnapshot = {
      ...actor, id: 'target', controller: 'dm', currentHp: 30, maxHp: 30,
    }
    const result = resolveDnd5eActivity({
      activity, actor, targets: [target],
      distanceFeetByTargetId: { target: 30 },
      rolls: { 'spell-damage': { values: [1, 2, 3] } },
    })
    expect(result).toMatchObject({
      ok: true,
      proposals: [{ kind: 'deal-damage', targetId: 'target', amount: 8 }],
    })
  })

  it('projects higher-slot damage onto both failed-save and successful-save outcomes', () => {
    const base = damageSpell()
    const activity = dnd5eActivityFromSpellDefinition({
      ...base,
      mechanics: {
        ...base.mechanics!,
        kind: 'damage',
        upcast: {
          fromSlotLevel: 3,
          effects: [
            { kind: 'damage-dice', diceCountPerSlot: 1 },
            { kind: 'flat-damage', amountPerSlot: 2 },
          ],
        },
      },
    }, 'headless-action')
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.automation.level).toBe('full')
    expect(activity.scaling).toEqual([{
      basis: 'slot-level',
      baseLevel: 3,
      adjustments: [
        { operationId: 'spell-damage', diceCountPerStep: 1 },
        { operationId: 'spell-damage-save-success', diceCountPerStep: 1 },
        { operationId: 'spell-damage', flatAmountPerStep: 2 },
        { operationId: 'spell-damage-save-success', flatAmountPerStep: 2 },
      ],
    }])
  })

  it('preserves explicit damage types for after-damage subclass Activities', () => {
    const ability: DeclarativeSubclassAbilityV1 = {
      schemaVersion: 1,
      id: 'storm-rebuke',
      name: 'Storm Rebuke',
      description: 'Synthetic after-damage reaction.',
      level: 1,
      trigger: { kind: 'after-damage-taken' },
      cost: { economy: 'reaction' },
      targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 5 },
      rolls: [
        { id: 'storm-damage', kind: 'damage', label: 'Storm damage', dice: { count: 2, sides: 8 }, damageType: 'lightning' },
        { id: 'storm-save', kind: 'saving-throw', label: 'Dexterity save', ability: 'dex', dc: { kind: 'ability-modifier', ability: 'wis' }, onSuccess: 'half' },
      ],
      effects: [{ kind: 'damage', target: 'target', rollId: 'storm-damage' }],
      automation: 'partial',
    }
    const activity = dnd5eActivityFromDeclarativeSubclassAbility(ability, {
      subclassId: 'storm-domain',
      compatibility: { effective: 'partial', reasons: [] },
    })
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.invocation).toMatchObject({ kind: 'triggered', event: 'after-damage', confirmation: 'dm-approval' })
    expect(activity.outcomes.flatMap((outcome) => outcome.operations)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'damage', damageType: 'lightning' }),
    ]))
  })

  it('projects conditional saving-throw modes and distinct success/failure effects', () => {
    const ability: DeclarativeSubclassAbilityV1 = {
      schemaVersion: 1,
      id: 'abjure-fiend',
      name: 'Abjure Fiend',
      description: 'Synthetic branched save fixture.',
      level: 3,
      trigger: { kind: 'active-use' },
      targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 60 },
      rolls: [{
        id: 'save', kind: 'saving-throw', label: 'Wisdom save', ability: 'wis',
        dc: { kind: 'ability-modifier', ability: 'cha' },
        rollModeByCreatureType: { creatureTypes: ['fiend', 'undead'], mode: 'disadvantage' },
      }],
      effects: [
        { kind: 'activity-effect', target: 'target', effectId: 'failed', when: 'save-failure' },
        { kind: 'activity-effect', target: 'target', effectId: 'succeeded', when: 'save-success' },
      ],
      activityEffects: [{
        schemaVersion: 1, id: 'failed', name: 'Failed save',
        duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' },
        conditions: ['frightened'],
        modifiers: [{ kind: 'speed', mode: 'multiply', value: { kind: 'constant', value: 0 } }],
        breakOn: ['takes-damage'], stacking: 'refresh-duration',
      }, {
        schemaVersion: 1, id: 'succeeded', name: 'Successful save',
        duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' },
        modifiers: [{ kind: 'speed', mode: 'multiply', value: { kind: 'constant', value: 0.5 } }],
        breakOn: ['takes-damage'], stacking: 'refresh-duration',
      }],
      automation: 'full',
    }
    const activity = dnd5eActivityFromDeclarativeSubclassAbility(ability, { subclassId: 'test-oath' })
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.checks?.[0]).toMatchObject({
      kind: 'saving-throw',
      rollModeByCreatureType: { creatureTypes: ['fiend', 'undead'], mode: 'disadvantage' },
    })
    const actor: Dnd5eActivityActorSnapshot = {
      id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
      armorClass: 16, currentHp: 30, maxHp: 30, conditions: [],
    }
    const undead: Dnd5eActivityActorSnapshot = {
      ...actor, id: 'undead', controller: 'dm', creatureType: 'undead', savingThrowModifiers: { wis: 0 },
    }
    const undeadResult = resolveDnd5eActivity({
      activity, actor, targets: [undead], distanceFeetByTargetId: { undead: 30 },
      rolls: { 'save-d20:undead': { values: [18, 2] } },
    })
    expect(undeadResult.ok, JSON.stringify(undeadResult)).toBe(true)
    expect(undeadResult).toMatchObject({ ok: true, proposals: [{ kind: 'apply-effect', targetId: 'undead', effectId: 'failed' }] })

    const humanoid: Dnd5eActivityActorSnapshot = {
      ...undead, id: 'humanoid', creatureType: 'humanoid',
    }
    expect(resolveDnd5eActivity({
      activity, actor, targets: [humanoid], distanceFeetByTargetId: { humanoid: 30 },
      rolls: { 'save-d20:humanoid': { values: [18] } },
    })).toMatchObject({ ok: true, proposals: [{ kind: 'apply-effect', targetId: 'humanoid', effectId: 'succeeded' }] })
  })

  it('combines a Host-validated runtime choice with a failed-save outcome', () => {
    const ability: DeclarativeSubclassAbilityV1 = {
      schemaVersion: 1, id: 'fey-choice', name: 'Fey Choice', description: 'Synthetic choice fixture.', level: 1,
      trigger: { kind: 'active-use' },
      targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
      choices: [{
        id: 'condition', label: 'Condition',
        options: [{ id: 'charm', label: 'Charm' }, { id: 'fear', label: 'Fear' }],
      }],
      rolls: [{ id: 'save', kind: 'saving-throw', label: 'Wisdom save', ability: 'wis', dc: { kind: 'fixed', value: 15 } }],
      effects: [{
        kind: 'standard-condition', target: 'target', condition: 'charmed',
        duration: { kind: 'fixed-rounds', rounds: 1 },
        whenChoice: { choiceId: 'condition', optionId: 'charm' },
      }, {
        kind: 'standard-condition', target: 'target', condition: 'frightened',
        duration: { kind: 'fixed-rounds', rounds: 1 },
        whenChoice: { choiceId: 'condition', optionId: 'fear' },
      }],
      automation: 'full',
    }
    const activity = dnd5eActivityFromDeclarativeSubclassAbility(ability, { subclassId: 'test-fey' })
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const actor: Dnd5eActivityActorSnapshot = {
      id: 'actor', controller: 'players', level: 3, proficiencyBonus: 2,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
      armorClass: 14, currentHp: 20, maxHp: 20, conditions: [],
    }
    const target: Dnd5eActivityActorSnapshot = {
      ...actor, id: 'target', controller: 'dm', savingThrowModifiers: { wis: 0 },
    }
    expect(resolveDnd5eActivity({
      activity, actor, targets: [target], distanceFeetByTargetId: { target: 10 },
      choices: { condition: 'fear' }, rolls: { 'save-d20:target': { values: [4] } },
    })).toMatchObject({
      ok: true,
      proposals: [{ kind: 'apply-standard-condition', targetId: 'target', condition: 'frightened' }],
    })
    expect(resolveDnd5eActivity({
      activity, actor, targets: [target], distanceFeetByTargetId: { target: 10 },
      rolls: { 'save-d20:target': { values: [4] } },
    })).toMatchObject({ ok: false, reason: 'requirement-failed' })
  })

  it('uses the target-favorable ability for both an initial and repeating save', () => {
    const ability: DeclarativeSubclassAbilityV1 = {
      schemaVersion: 1, id: 'flexible-save', name: 'Flexible Save', description: 'Synthetic fixture.', level: 1,
      trigger: { kind: 'active-use' }, targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 10 },
      rolls: [{
        id: 'save', kind: 'saving-throw', label: 'Strength or Dexterity', ability: 'str',
        abilityOptions: ['str', 'dex'], dc: { kind: 'fixed', value: 15 },
      }],
      effects: [{
        kind: 'standard-condition', target: 'target', condition: 'restrained',
        duration: {
          kind: 'fixed-rounds', rounds: 10,
          repeatSave: { ability: 'str', abilityOptions: ['str', 'dex'], dc: { kind: 'fixed', value: 15 } },
        },
      }],
      automation: 'full',
    }
    const activity = dnd5eActivityFromDeclarativeSubclassAbility(ability, { subclassId: 'flexible-save-test' })
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const actor: Dnd5eActivityActorSnapshot = {
      id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
      armorClass: 16, currentHp: 30, maxHp: 30, conditions: [],
    }
    const target: Dnd5eActivityActorSnapshot = {
      ...actor, id: 'target', controller: 'dm', savingThrowModifiers: { str: -1, dex: 5 },
    }
    expect(resolveDnd5eActivity({
      activity, actor, targets: [target], distanceFeetByTargetId: { target: 5 },
      rolls: { 'save-d20:target': { values: [9] } },
    })).toMatchObject({
      ok: true,
      checks: [{ ability: 'dex', modifier: 5, total: 14, success: false }],
      proposals: [{
        kind: 'apply-standard-condition', condition: 'restrained',
        duration: { kind: 'save-ends', ability: 'dex', dc: 15 },
      }],
    })
  })

  it('binds audited subclass mechanics to their native authority without a fake DM operation', () => {
    const ability: DeclarativeSubclassAbilityV1 = {
      schemaVersion: 1,
      id: 'measured-strike',
      name: 'Measured Strike',
      description: 'Synthetic feature.',
      level: 3,
      trigger: { kind: 'after-attack-hit' },
      predicates: { classId: 'fighter', minimumLevel: 3, oncePerTurn: true },
      cost: { resources: [{ resourceId: 'focus', amount: 1 }] },
      targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 5 },
      rolls: [{ id: 'extra', kind: 'damage', label: 'Extra', dice: { count: 1, sides: 6 }, damageType: 'parent-weapon' }],
      effects: [{ kind: 'damage', target: 'target', rollId: 'extra' }],
      mechanic: { kind: 'combat-maneuver', operation: 'push-on-hit', resourceId: 'focus', superiorityRollId: 'extra' },
      automation: 'full',
    }
    const activity = dnd5eActivityFromDeclarativeSubclassAbility(ability, {
      subclassId: 'measured-warrior',
      compatibility: { effective: 'full', reasons: [] },
    })
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.automation.level).toBe('full')
    expect(activity.invocation).toMatchObject({ kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice' })
    expect(activity.triggers?.[0]).toMatchObject({ event: 'attack-hit', decision: 'actor-choice' })
    expect(activity.authorityBinding).toEqual({
      kind: 'declarative-subclass-mechanic',
      subclassId: 'measured-warrior',
      abilityId: 'measured-strike',
      mechanicKind: 'combat-maneuver',
      execution: 'headless-event-engine',
    })
    expect(activity.outcomes[0]?.operations).toEqual([])
  })

  it('projects multiattack as calls to ordinary monster Activities', () => {
    const action: Dnd5eMonsterAction = {
      id: 'double-claw',
      name: 'Double Claw',
      description: 'Synthetic multiattack.',
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['claw', 'claw'],
    }
    const activity = dnd5eActivityFromMonsterAction({ id: 'room-monster:test', name: 'Test' }, action)
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.outcomes[0]?.operations).toEqual([
      expect.objectContaining({ kind: 'invoke-activity', activityId: 'monster:room-monster:test:claw' }),
      expect.objectContaining({ kind: 'invoke-activity', activityId: 'monster:room-monster:test:claw' }),
    ])
  })
})
