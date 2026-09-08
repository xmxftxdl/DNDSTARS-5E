import { describe, expect, it, vi } from 'vitest'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import {
  dnd5eActivityPerTargetRollDeclarationsV1,
  filterDnd5eConditionalActivityRollDeclarationsV1,
} from './dnd5eActivityPerTargetRolls'
import { validateDnd5ePluginDiceRollResult } from '../pluginDice'

const imprisonment = {
  schemaVersion: 1,
  id: 'imprisonment',
  name: '禁锢术',
  activation: { kind: 'action', cost: 1 },
  legacySource: { kind: 'spell', id: 'imprisonment' },
  target: { kind: 'creature', relation: 'enemy', rangeFeet: 30, count: 1 },
  checks: [{
    id: 'spell-save', kind: 'saving-throw', rollId: 'spell-save-d20',
    ability: 'wis', dc: { kind: 'constant', value: 18 },
    rollMode: 'host-derived', scope: 'per-target',
  }],
  outcomes: [],
  automation: { schemaVersion: 1, level: 'full', supportedPhases: [], manualPhases: [], limitations: [] },
} as Dnd5eActivityDefinitionV1

describe('Activity per-target authoritative roll recipes', () => {
  it('rolls one d20 for a Minotaur ordinary Imprisonment save', () => {
    const hostSavingThrowMode = vi.fn(() => 'normal' as const)
    const declarations = dnd5eActivityPerTargetRollDeclarationsV1({
      activity: imprisonment,
      declarations: [{ id: 'spell-save-d20', label: '禁锢术 · WIS 豁免', count: 2, sides: 20 }],
      actor: { id: 'wizard', controller: 'players' },
      targets: [{
        id: 'minotaur', name: '牛头人', controller: 'dm',
        creatureType: '怪兽', sizeRank: 3,
      }],
      hostSavingThrowMode,
      hostAttackRollMode: () => 'normal',
    })

    expect(hostSavingThrowMode).toHaveBeenCalledOnce()
    expect(declarations).toEqual([expect.objectContaining({
      id: 'spell-save-d20:minotaur',
      label: '牛头人 · 禁锢术 · WIS 豁免',
      count: 1,
      acceptedCounts: [1, 2],
      sides: 20,
      rollerTokenId: 'minotaur',
      d20RollKind: 'saving-throw',
      d20RollMode: 'normal',
    })])
    expect(validateDnd5ePluginDiceRollResult(declarations[0]!, {
      values: [3, 17], modifier: 0, total: 20,
    })).toBe(true)
  })

  it('retains two d20s only when an actual save rule grants advantage', () => {
    const declarations = dnd5eActivityPerTargetRollDeclarationsV1({
      activity: imprisonment,
      declarations: [{ id: 'spell-save-d20', label: '禁锢术 · WIS 豁免', count: 2, sides: 20 }],
      actor: { id: 'wizard', controller: 'players' },
      targets: [{ id: 'magic-resistant-target', controller: 'dm' }],
      hostSavingThrowMode: () => 'advantage',
      hostAttackRollMode: () => 'normal',
    })

    expect(declarations[0]?.count).toBe(2)
    expect(declarations[0]).toMatchObject({
      rollerTokenId: 'magic-resistant-target',
      d20RollKind: 'saving-throw',
      d20RollMode: 'advantage',
    })
  })

  it('does not request a Divine Word save from a target that cannot hear the source', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...imprisonment,
      id: 'divine-word',
      name: '圣言术',
      legacySource: { kind: 'spell', id: 'divine-word' },
      target: { kind: 'creature', relation: 'any', rangeFeet: 30, count: 256, includeSelf: true },
    }
    const declarations = dnd5eActivityPerTargetRollDeclarationsV1({
      activity,
      declarations: [{ id: 'spell-save-d20', label: '圣言术 · CHA 豁免', count: 2, sides: 20 }],
      actor: { id: 'cleric', controller: 'players' },
      targets: [
        { id: 'audible', name: '可听见目标', controller: 'dm', canHearActivitySource: true },
        { id: 'deafened', name: '耳聋目标', controller: 'dm', canHearActivitySource: false },
      ],
      hostSavingThrowMode: () => 'normal',
      hostAttackRollMode: () => 'normal',
    })

    expect(declarations.map((declaration) => declaration.id)).toEqual(['spell-save-d20:audible'])
  })

  it('requests a Flesh to Stone save only from targets whose bodies are made of flesh', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...imprisonment,
      id: 'flesh-to-stone',
      name: '石化术',
      legacySource: { kind: 'spell', id: 'flesh-to-stone' },
    }
    const hostSavingThrowMode = vi.fn(() => 'normal' as const)
    const declarations = dnd5eActivityPerTargetRollDeclarationsV1({
      activity,
      declarations: [{ id: 'spell-save-d20', label: '石化术 · CON 豁免', count: 1, sides: 20 }],
      actor: { id: 'wizard', controller: 'players' },
      targets: [
        { id: 'skeleton', statBlockId: 'srd-5.1:skeleton', creatureType: '亡灵', controller: 'dm' },
        { id: 'flesh-golem', statBlockId: 'srd-5.1:flesh-golem', creatureType: '构装', controller: 'dm' },
      ],
      hostSavingThrowMode,
      hostAttackRollMode: () => 'normal',
    })

    expect(declarations.map((declaration) => declaration.id)).toEqual(['spell-save-d20:flesh-golem'])
    expect(hostSavingThrowMode).toHaveBeenCalledOnce()
  })

  it('gates Plane Shift dice by mode and requests its save only after a successful attack', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...imprisonment,
      id: 'plane-shift',
      choices: [{
        id: 'mode', label: '传送方式', options: [
          { id: 'willing-travel', label: '友方传送' },
          { id: 'hostile-banishment', label: '敌方传送' },
        ],
      }],
      checks: [{
        id: 'spell-attack', kind: 'attack-roll', rollId: 'spell-attack-d20',
        attackBonus: { kind: 'constant', value: 10 }, rollMode: 'host-derived', scope: 'per-target',
        appliesWhenChoice: { choiceId: 'mode', optionIds: ['hostile-banishment'] },
      }, {
        id: 'spell-save', kind: 'saving-throw', rollId: 'spell-save-d20',
        ability: 'cha', dc: { kind: 'constant', value: 18 }, scope: 'per-target',
        appliesWhenChoice: { choiceId: 'mode', optionIds: ['hostile-banishment'] },
        appliesWhenCheck: { checkId: 'spell-attack', result: 'success' },
      }],
    }
    const baseDeclarations = [
      { id: 'spell-attack-d20', label: '近战法术攻击', count: 1, sides: 20 },
      { id: 'spell-save-d20', label: '魅力豁免', count: 1, sides: 20 },
    ]
    const friendly = dnd5eActivityPerTargetRollDeclarationsV1({
      activity, declarations: baseDeclarations,
      actor: { id: 'wizard', controller: 'players' },
      targets: [{ id: 'target', controller: 'dm' }],
      choices: { mode: 'willing-travel' },
      hostSavingThrowMode: () => 'normal', hostAttackRollMode: () => 'normal',
    })
    expect(friendly).toEqual([])

    const hostile = dnd5eActivityPerTargetRollDeclarationsV1({
      activity, declarations: baseDeclarations,
      actor: { id: 'wizard', controller: 'players' },
      targets: [{ id: 'target', controller: 'dm' }],
      choices: { mode: 'hostile-banishment' },
      hostSavingThrowMode: () => 'normal', hostAttackRollMode: () => 'normal',
    })
    expect(hostile.map((declaration) => declaration.id)).toEqual([
      'spell-attack-d20:target', 'spell-save-d20:target',
    ])
    expect(hostile[0]).toMatchObject({
      rollerTokenId: 'wizard',
      d20RollKind: 'attack',
      d20RollMode: 'normal',
    })
    expect(hostile[1]).toMatchObject({
      rollerTokenId: 'target',
      d20RollKind: 'saving-throw',
      d20RollMode: 'normal',
    })
    expect(filterDnd5eConditionalActivityRollDeclarationsV1({
      activity, declarations: hostile, successfulCheckKeys: new Set(),
    }).map((declaration) => declaration.id)).toEqual(['spell-attack-d20:target'])
    expect(filterDnd5eConditionalActivityRollDeclarationsV1({
      activity, declarations: hostile,
      successfulCheckKeys: new Set(['spell-attack:target']),
    }).map((declaration) => declaration.id)).toEqual([
      'spell-attack-d20:target', 'spell-save-d20:target',
    ])
  })
})
