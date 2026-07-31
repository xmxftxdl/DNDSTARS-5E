import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { restoreClassResources, syncCharacterClassResources } from '../../lib/classResources'
import type { Character } from '../../types/character'
import {
  clearDnd5eEffectiveRulesContextsForTest,
  createDnd5eEffectiveRulesContextV1,
  dnd5eEffectiveRulesContextForCombat,
} from './effectiveRulesContext'
import {
  declarativeAbilityCompatibilityV1,
  declarativeSubclassCompatibilityReportV1,
  migrateLegacyFeatureActionToDeclarativeV1,
  parseDnd5eDeclarativeRulesPackageV1,
  type DeclarativeSubclassAbilityV1,
  type DeclarativeSubclassDefinitionV1,
} from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { migrateCharacterToDnd5e } from './character'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5eDeclarativeAttackIntentRollPlan,
  dnd5eDeclarativeAttackIntentResolution,
  dnd5eDeclarativePluginFeatureRollPlan,
  dnd5eEnemyD20ModifierFeaturesForCharacter,
  dnd5ePluginFeatureDefinition,
  dnd5ePluginResourceDefinition,
  dnd5ePluginResourceDieSides,
  dnd5ePluginSubclassChoiceLimit,
  dnd5ePluginSubclassDefinition,
  registerDnd5eRulesPlugin,
} from './pluginApi'

const LOCAL_BATTLE_MASTER_DEFINITION_PATH = new URL(
  '../../../local-content/phb-2014/subclasses/battle-master/subclasses.json',
  import.meta.url,
)

const ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

function ability(patch: Partial<DeclarativeSubclassAbilityV1> = {}): DeclarativeSubclassAbilityV1 {
  return {
    schemaVersion: 1,
    id: 'arc-strike',
    name: '奥能打击',
    description: '以声明式 Host 事务造成伤害。',
    level: 3,
    trigger: { kind: 'active-use' },
    cost: { economy: 'none' },
    targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
    rolls: [{ id: 'damage', kind: 'damage', label: '奥能伤害', dice: { count: 1, sides: 6 }, damageType: 'force' }],
    effects: [{ kind: 'damage', target: 'target', rollId: 'damage' }],
    automation: 'full',
    ...patch,
  }
}

function subclass(abilities: readonly DeclarativeSubclassAbilityV1[] = [ability()]): DeclarativeSubclassDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'arc-guard',
    classId: 'fighter',
    name: '奥能卫士',
    summary: '测试声明式子职。',
    resources: [{
      id: 'focus', label: '奥能专注', minimumLevel: 3,
      maximum: { kind: 'fixed', value: 2 }, resetOn: 'short-rest',
    }],
    abilities,
  }
}

function character(level = 3, selectedSubclass = 'com.example.decl:arc-guard'): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'hero', name: 'Hero', player: '', avatar: '', accent: '',
    race: '人类', charClass: '战士', level, background: '士兵', experience: 0, reputation: 0,
    abilities: ABILITIES, savingThrows: [], skills: [], maxHp: 20, currentHp: 20, tempHp: 0,
    hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 0, saveDC: 10, passivePerception: 10,
    inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: { fighter: { subclass: selectedSubclass, fightingStyles: [] } },
  }
}

function combatant(id: string, controller: 'player' | 'dm', initiative: number, patch: Record<string, unknown> = {}) {
  return createDnd5eCombatant({
    id, name: id, controller, initiative, abilities: ABILITIES, proficiencyBonus: 2,
    armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: controller === 'player' ? 0 : 5, y: 0 }, concentrating: false,
    ...patch,
  })
}

function register(pluginId: string, definition: DeclarativeSubclassDefinitionV1 = subclass()) {
  const dispose = registerDnd5eRulesPlugin({
    manifest: {
      id: pluginId, name: 'Declarative Test', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
    },
    setup(api) { api.registerDeclarativeSubclass(definition) },
  })
  return { dispose, subclassId: `${pluginId}:arc-guard`, featureId: `${pluginId}:arc-guard.arc-strike` }
}

function stateFor(pluginId: string, input: {
  featureId?: string
  allyTarget?: boolean
  resources?: Record<string, { current: number; max: number }>
  effectiveMultiplier?: number
  level?: number
} = {}) {
  const featureId = input.featureId ?? `${pluginId}:arc-guard.arc-strike`
  const level = input.level ?? 3
  const hero = combatant('hero', 'player', 20, {
    level, classId: 'fighter', subclassId: `${pluginId}:arc-guard`,
    classLevels: { fighter: level }, subclassIds: { fighter: `${pluginId}:arc-guard` },
    pluginFeatureIds: [featureId], classResources: input.resources ?? {},
  })
  const target = combatant('target', input.allyTarget ? 'player' : 'dm', 10)
  const state = startDnd5eHeadlessCombat('decl-combat', [hero, target])
  state.distanceFeetByCombatantPair = { ['hero\u0000target']: 5 }
  state.effectiveRules = createDnd5eEffectiveRulesContextV1({
    revision: 1,
    houseRules: { declarativeAbilityDamageMultiplier: input.effectiveMultiplier ?? 1 },
  })
  return state
}

describe('DeclarativeSubclassAbilityV1', () => {
  it('loads a subclass and grants its feature only at the declared level', () => {
    const { dispose, featureId } = register('com.example.decl')
    try {
      expect(dnd5ePluginFeatureDefinition(featureId)?.declarativeAbility?.schemaVersion).toBe(1)
      expect(dnd5eCharacterHasPluginFeature(character(2), featureId)).toBe(false)
      expect(dnd5eCharacterHasPluginFeature(character(3), featureId)).toBe(true)
    } finally { dispose() }
  })

  it('registers enemy d20 modifier eligibility and reports the manual Interrupt boundary', () => {
    const pluginId = 'com.example.enemy-roll'
    const modifierAbility = ability({
      canModifyEnemyD20: true,
      automation: 'full',
    })
    const { dispose, featureId } = register(pluginId, subclass([modifierAbility]))
    try {
      expect(dnd5ePluginFeatureDefinition(featureId)?.canModifyEnemyD20).toBe(true)
      expect(dnd5eEnemyD20ModifierFeaturesForCharacter(character(3, `${pluginId}:arc-guard`)))
        .toEqual([expect.objectContaining({ id: featureId })])
      expect(declarativeAbilityCompatibilityV1(modifierAbility)).toMatchObject({
        effective: 'partial',
        reasons: [expect.stringContaining('敌方 d20')],
      })
    } finally { dispose() }
  })

  it('rejects a non-boolean enemy d20 modifier declaration', () => {
    const invalid = {
      ...ability(),
      canModifyEnemyD20: 'yes',
    } as unknown as DeclarativeSubclassAbilityV1
    expect(() => parseDnd5eDeclarativeRulesPackageV1(new TextEncoder().encode(JSON.stringify({
      format: 'dndstars5e-declarative',
      schemaVersion: 1,
      manifest: {
        id: 'com.example.invalid',
        name: 'Invalid',
        version: '1.0.0',
        publisher: 'Test',
        license: 'CC0-1.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
      },
      subclasses: [subclass([invalid])],
    })).buffer)).toThrow('敌方 d20 修改声明无效')
  })

  it('allows effect-free manual metadata but keeps executable declarations fail-closed', () => {
    const manual = ability({
      rolls: undefined,
      effects: [],
      automation: 'manual',
    })
    const packageFor = (entry: DeclarativeSubclassAbilityV1) =>
      new TextEncoder().encode(JSON.stringify({
        format: 'dndstars5e-declarative',
        schemaVersion: 1,
        manifest: {
          id: 'com.example.manual-metadata',
          name: 'Manual Metadata',
          version: '1.0.0',
          publisher: 'Test',
          license: 'CC0-1.0',
          apiVersion: 2,
          rulesetId: 'dnd5e-2014-srd-5.1',
        },
        subclasses: [subclass([entry])],
      })).buffer

    expect(() => parseDnd5eDeclarativeRulesPackageV1(packageFor(manual))).not.toThrow()
    expect(() => parseDnd5eDeclarativeRulesPackageV1(packageFor({
      ...manual,
      automation: 'full',
    }))).toThrow('效果无效')
  })

  it('accepts audited opening-attack declarations and rejects unsafe save multipliers', () => {
    const openingAttack = ability({
      rolls: undefined,
      effects: [],
      trigger: { kind: 'before-attack-roll' },
      mechanic: {
        kind: 'opening-attack',
        advantageBeforeTargetFirstTurn: true,
        automaticCriticalAgainstSurprised: true,
        surprisedHitSavingThrow: {
          ability: 'con',
          dcAbility: 'dex',
          failureDamageMultiplier: 2,
        },
      },
      automation: 'full',
    })
    expect(declarativeAbilityCompatibilityV1(openingAttack)).toMatchObject({
      effective: 'full',
      reasons: [],
    })
    expect(declarativeAbilityCompatibilityV1(ability({
      rolls: undefined,
      effects: [],
      mechanic: { kind: 'hidden-spell-save-disadvantage' },
      automation: 'full',
    }))).toMatchObject({
      effective: 'full',
      reasons: [],
    })

    const invalid = {
      ...openingAttack,
      mechanic: {
        ...openingAttack.mechanic,
        surprisedHitSavingThrow: {
          ability: 'con',
          dcAbility: 'dex',
          failureDamageMultiplier: 1,
        },
      },
    } as unknown as DeclarativeSubclassAbilityV1
    const bytes = new TextEncoder().encode(JSON.stringify({
      format: 'dndstars5e-declarative',
      schemaVersion: 1,
      manifest: {
        id: 'com.example.invalid-opening',
        name: 'Invalid Opening',
        version: '1.0.0',
        publisher: 'Test',
        license: 'CC0-1.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
      },
      subclasses: [subclass([invalid])],
    })).buffer
    expect(() => parseDnd5eDeclarativeRulesPackageV1(bytes))
      .toThrow('opening-attack saving throw is invalid')
  })

  it('resolves active damage through the authoritative generic Headless action', () => {
    const pluginId = 'com.example.damage'
    const { dispose, featureId } = register(pluginId)
    try {
      const result = resolveDnd5eHeadlessAction(stateFor(pluginId), {
        type: 'plugin', pluginId, actionId: 'decl.arc-guard.arc-strike', featureId,
        transactionId: 'tx-damage', actorId: 'hero', targetId: 'target', targetIds: ['target'],
        distanceFeet: 5, rolls: { damage: { values: [4], modifier: 0, total: 4 } },
      })
      expect(result.ok).toBe(true)
      expect(result.state.combatants.target.currentHp).toBe(16)
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'declarative-subclass-ability-resolved', abilityId: featureId }))
    } finally { dispose() }
  })

  it('spends declared resources and restores them on short and long rests', () => {
    const pluginId = 'com.example.resource'
    const resourceAbility = ability({ cost: { economy: 'none', resources: [{ resourceId: 'focus', amount: 1 }] } })
    const { dispose, featureId, subclassId } = register(pluginId, subclass([resourceAbility]))
    try {
      const resourceId = `${pluginId}:focus`
      const result = resolveDnd5eHeadlessAction(stateFor(pluginId, { resources: { [resourceId]: { current: 2, max: 2 } } }), {
        type: 'plugin', pluginId, actionId: 'decl.arc-guard.arc-strike', featureId,
        transactionId: 'tx-resource', actorId: 'hero', targetId: 'target', targetIds: ['target'], distanceFeet: 5,
        rolls: { damage: { values: [2], modifier: 0, total: 2 } },
      })
      expect(result.state.combatants.hero.classResources[resourceId].current).toBe(1)
      const depleted = syncCharacterClassResources({ ...character(3, subclassId), classResources: { [resourceId]: { current: 0, max: 2 } } })
      expect(restoreClassResources(depleted, 'short-rest').classResources?.[resourceId].current).toBe(2)
      expect(restoreClassResources(depleted, 'long-rest').classResources?.[resourceId].current).toBe(2)
    } finally { dispose() }
  })

  it('calculates declarative resource maxima from the authoritative character snapshot', () => {
    const pluginId = 'com.example.resource-formula'
    const definition = subclass()
    definition.resources = [{
      id: 'focus', label: '奥能专注', minimumLevel: 3,
      maximum: { kind: 'ability-modifier', ability: 'int', minimum: 1 }, resetOn: 'long-rest',
    }]
    const { dispose, subclassId } = register(pluginId, definition)
    try {
      const synced = syncCharacterClassResources({
        ...character(3, subclassId), abilities: { ...ABILITIES, int: 16 },
      })
      expect(synced.classResources?.[`${pluginId}:focus`]).toEqual({ current: 3, max: 3 })
    } finally { dispose() }
  })

  it('registers cumulative choices, resource dice, subclass spellcasting and prearmed combat hooks', () => {
    const pluginId = 'com.example.subclass-protocol'
    const definition = subclass()
    definition.choiceGroups = [{
      id: 'techniques',
      level: 3,
      name: '战技选项',
      maxSelections: 3,
      maxSelectionsByLevel: [
        { level: 7, maxSelections: 5 },
        { level: 15, maxSelections: 7 },
      ],
      options: Array.from({ length: 8 }, (_, index) => ({
        id: `technique-${index + 1}`,
        name: `战技 ${index + 1}`,
        summary: '合成测试选项，不包含规则书原文。',
      })),
    }]
    definition.resources = [{
      id: 'focus',
      label: '技巧骰',
      minimumLevel: 3,
      maximum: { kind: 'fixed', value: 4 },
      resetOn: 'short-rest',
      die: {
        sides: 6,
        sidesByClassLevel: [
          { level: 10, sides: 8 },
          { level: 18, sides: 10 },
        ],
      },
    }]
    definition.spellcasting = {
      progression: 'one-third',
      learning: 'known',
      ability: 'int',
      spellListClassId: 'wizard',
      cantripChoiceGroupId: 'spell-cantrips',
      spellChoiceGroupId: 'spell-known',
      cantripsKnownByClassLevel: Array.from({ length: 20 }, (_, index) => index < 2 ? 0 : index < 9 ? 2 : 3),
      requiredCantripIds: ['light'],
      spellsKnownByClassLevel: Array.from({ length: 20 }, (_, index) => index < 2 ? 0 : 3 + Math.floor((index - 2) / 2)),
      allowedSchools: ['abjuration', 'evocation'],
      unrestrictedSpellsKnownByClassLevel: Array.from({ length: 20 }, (_, index) => index < 2 ? 0 : 1 + Math.floor((index - 2) / 6)),
      ritualCasting: false,
      focus: '奥术法器',
    }
    definition.abilities = [ability({
      trigger: { kind: 'after-attack-hit' },
      rolls: [{
        id: 'damage',
        kind: 'damage',
        label: '预激活伤害',
        dice: { count: 0, sides: 6, modifier: { kind: 'fixed', value: 3 } },
        damageType: 'force',
      }],
    })]
    definition.combatHooks = [{
      id: 'pre-attack-technique',
      timing: 'after-attack-hit',
      abilityId: 'arc-strike',
      decision: 'actor-choice',
      activation: 'prearm',
      retention: 'until-triggered',
      oncePerTurn: true,
    }]

    const { dispose, subclassId } = register(pluginId, definition)
    try {
      const registered = dnd5ePluginSubclassDefinition(subclassId)
      const group = registered?.choiceGroups?.[0]
      expect(group).toBeDefined()
      expect(dnd5ePluginSubclassChoiceLimit(group!, 3)).toBe(3)
      expect(dnd5ePluginSubclassChoiceLimit(group!, 7)).toBe(5)
      expect(dnd5ePluginSubclassChoiceLimit(group!, 15)).toBe(7)
      expect(registered?.declarativeSpellcasting).toMatchObject({
        progression: 'one-third',
        ability: 'int',
        spellListClassId: 'wizard',
        requiredCantripIds: ['light'],
      })
      expect(registered?.declarativeCombatHooks?.[0]).toMatchObject({
        timing: 'after-attack-hit',
        decision: 'actor-choice',
        activation: 'prearm',
        retention: 'until-triggered',
      })

      const levelTen = {
        ...character(10, subclassId),
        dnd5eClassChoices: {
          fighter: {
            subclass: subclassId,
            fightingStyles: [],
            extensionChoices: {
              [`${subclassId}/techniques`]: ['technique-1', 'technique-2'],
            },
          },
        },
      }
      const resource = dnd5ePluginResourceDefinition(`${pluginId}:focus`)
      expect(dnd5ePluginResourceDieSides(resource!, levelTen)).toBe(8)
      expect(migrateCharacterToDnd5e(levelTen).classSelectionsByClass.fighter).toMatchObject({
        [`${subclassId}/techniques`]: ['technique-1', 'technique-2'],
      })
      expect(declarativeSubclassCompatibilityReportV1([definition]).abilities[0]).toMatchObject({
        effective: 'full',
        reasons: [],
      })
    } finally { dispose() }
  })

  it('rejects invalid choices, hooks and Host resource-die recipes', () => {
    const invalidChoice = subclass()
    invalidChoice.choiceGroups = [{
      id: 'techniques',
      level: 3,
      name: '战技',
      maxSelections: 2,
      maxSelectionsByLevel: [{ level: 7, maxSelections: 1 }],
      options: [
        { id: 'first', name: '一', summary: '测试。' },
        { id: 'second', name: '二', summary: '测试。' },
      ],
    }]
    expect(() => register('com.example.invalid-choice', invalidChoice)).toThrow('累计递增')

    const invalidHook = subclass()
    invalidHook.combatHooks = [{
      id: 'missing-hook',
      timing: 'after-attack-hit',
      abilityId: 'missing-ability',
      decision: 'automatic',
    }]
    expect(() => register('com.example.invalid-hook', invalidHook)).toThrow('引用了未声明能力')

    const invalidPrearmTiming = subclass()
    invalidPrearmTiming.combatHooks = [{
      id: 'too-early',
      timing: 'turn-start',
      abilityId: 'arc-strike',
      decision: 'actor-choice',
      activation: 'prearm',
    }]
    expect(() => register('com.example.invalid-prearm', invalidPrearmTiming))
      .toThrow('预激活战斗钩子必须绑定攻击检定时点')

    const hostRollWithoutResourceDie = subclass([ability({
      trigger: { kind: 'after-attack-hit' },
      cost: { economy: 'none', resources: [{ resourceId: 'focus', amount: 1 }] },
      rolls: [{
        id: 'damage',
        kind: 'damage',
        label: '无资源骰',
        dice: { count: 1, sides: 6 },
        damageType: 'force',
        hostRoll: {
          timing: 'on-trigger',
          die: { kind: 'resource-die', resourceId: 'focus' },
        },
      }],
    })])
    expect(() => register('com.example.invalid-host-die', hostRollWithoutResourceDie))
      .toThrow('没有声明资源骰')

    const hostRollWithoutCost = subclass([ability({
      trigger: { kind: 'after-attack-hit' },
      cost: { economy: 'none' },
      rolls: [{
        id: 'damage',
        kind: 'damage',
        label: '未消耗资源骰',
        dice: { count: 1, sides: 6 },
        damageType: 'force',
        hostRoll: {
          timing: 'on-trigger',
          die: { kind: 'resource-die', resourceId: 'focus' },
        },
      }],
    })])
    hostRollWithoutCost.resources = [{
      id: 'focus',
      label: '资源骰',
      maximum: { kind: 'fixed', value: 2 },
      resetOn: 'short-rest',
      die: { sides: 6 },
    }]
    expect(() => register('com.example.invalid-host-cost', hostRollWithoutCost))
      .toThrow('必须声明消耗')
  })

  it('automatically resolves a deterministic after-hit ability from the authoritative attack event', () => {
    const pluginId = 'com.example.on-hit'
    const onHit = ability({
      trigger: { kind: 'after-attack-hit' },
      rolls: [{ id: 'damage', kind: 'damage', label: '追加伤害', dice: { count: 0, sides: 6, modifier: { kind: 'fixed', value: 3 } }, damageType: 'force' }],
      cost: { economy: 'none' },
    })
    const { dispose } = register(pluginId, subclass([onHit]))
    try {
      const result = resolveDnd5eHeadlessAction(stateFor(pluginId), {
        type: 'attack', actorId: 'hero', targetId: 'target', attackModifier: 5, d20: 15,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(result.ok).toBe(true)
      expect(result.state.combatants.target.currentHp).toBe(16)
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'declarative-subclass-ability-resolved', trigger: 'after-attack-hit' }))
    } finally { dispose() }
  })

  it('executes an actor prearmed after-hit ability only when its Host-validated intent is present', () => {
    const pluginId = 'com.example.prearmed-on-hit'
    const definition = subclass([ability({
      trigger: { kind: 'after-attack-hit' },
      rolls: [{
        id: 'damage',
        kind: 'damage',
        label: '预激活追加伤害',
        dice: { count: 0, sides: 6, modifier: { kind: 'fixed', value: 3 } },
        damageType: 'force',
      }],
      cost: { economy: 'none' },
    })])
    definition.combatHooks = [{
      id: 'armed-strike',
      timing: 'after-attack-hit',
      abilityId: 'arc-strike',
      decision: 'actor-choice',
      activation: 'prearm',
      retention: 'until-triggered',
      oncePerTurn: true,
    }]
    const { dispose, featureId } = register(pluginId, definition)
    try {
      const withoutIntent = resolveDnd5eHeadlessAction(stateFor(pluginId), {
        type: 'attack', actorId: 'hero', targetId: 'target', attackModifier: 5, d20: 15,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(withoutIntent.ok).toBe(true)
      expect(withoutIntent.state.combatants.target.currentHp).toBe(19)
      expect(withoutIntent.events).not.toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved',
        abilityId: featureId,
      }))

      const missed = resolveDnd5eHeadlessAction(stateFor(pluginId), {
        type: 'attack', actorId: 'hero', targetId: 'target', attackModifier: 0, d20: 1,
        declarativeIntentFeatureIds: [featureId],
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(missed.ok).toBe(true)
      expect(missed.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        hit: false,
        declarativeIntentFeatureIds: [featureId],
      }))
      expect(dnd5eDeclarativeAttackIntentResolution([featureId], missed.events)).toEqual({
        triggeredFeatureIds: [],
        consumedFeatureIds: [],
      })

      const hit = resolveDnd5eHeadlessAction(stateFor(pluginId), {
        type: 'attack', actorId: 'hero', targetId: 'target', attackModifier: 5, d20: 15,
        spendAction: false,
        declarativeIntentFeatureIds: [featureId],
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(hit.ok).toBe(true)
      expect(hit.state.combatants.target.currentHp).toBe(16)
      expect(dnd5eDeclarativeAttackIntentResolution([featureId], hit.events)).toEqual({
        triggeredFeatureIds: [featureId],
        consumedFeatureIds: [featureId],
      })

      const repeated = resolveDnd5eHeadlessAction(hit.state, {
        type: 'attack', actorId: 'hero', targetId: 'target', attackModifier: 5, d20: 15,
        spendAction: false,
        declarativeIntentFeatureIds: [featureId],
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(repeated.ok).toBe(true)
      expect(repeated.state.combatants.target.currentHp).toBe(15)
      expect(repeated.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-trigger-rejected',
        abilityId: featureId,
        reason: 'feature-already-used',
      }))

      const forged = resolveDnd5eHeadlessAction(stateFor(pluginId), {
        type: 'attack', actorId: 'hero', targetId: 'target', attackModifier: 5, d20: 15,
        declarativeIntentFeatureIds: [`${pluginId}:arc-guard.forged`],
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(forged).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
    } finally { dispose() }
  })

  it('uses a Host resource-die recipe for prearmed hit damage, scaling and critical dice', () => {
    const pluginId = 'com.example.prearmed-resource-die'
    const resourceId = `${pluginId}:focus`
    const featureDefinition = ability({
      trigger: { kind: 'after-attack-hit' },
      rolls: [{
        id: 'damage',
        kind: 'damage',
        label: '资源骰追加伤害',
        dice: { count: 1, sides: 6 },
        damageType: 'force',
        hostRoll: {
          timing: 'on-trigger',
          die: { kind: 'resource-die', resourceId: 'focus' },
          critical: 'double-dice',
        },
      }],
      cost: { economy: 'none', resources: [{ resourceId: 'focus', amount: 1 }] },
    })
    const definition = subclass([featureDefinition])
    definition.resources = [{
      id: 'focus',
      label: '资源骰',
      minimumLevel: 3,
      maximum: { kind: 'fixed', value: 2 },
      resetOn: 'short-rest',
      die: { sides: 6, sidesByClassLevel: [{ level: 10, sides: 8 }] },
    }]
    definition.combatHooks = [{
      id: 'armed-resource-strike',
      timing: 'after-attack-hit',
      abilityId: 'arc-strike',
      decision: 'actor-choice',
      activation: 'prearm',
      retention: 'until-triggered',
    }]
    const { dispose, featureId } = register(pluginId, definition)
    try {
      const normalState = stateFor(pluginId, {
        resources: { [resourceId]: { current: 2, max: 2 } },
      })
      expect(dnd5eDeclarativeAttackIntentRollPlan(
        normalState.combatants.hero,
        featureId,
        false,
      )).toMatchObject({
        ok: true,
        declarations: [{ id: 'damage', count: 1, sides: 6, modifier: 0 }],
      })

      const hit = resolveDnd5eHeadlessAction(normalState, {
        type: 'attack',
        actorId: 'hero',
        targetId: 'target',
        attackModifier: 5,
        d20: 15,
        spendAction: false,
        declarativeIntentFeatureIds: [featureId],
        declarativeIntentRolls: {
          [featureId]: { damage: { values: [5], modifier: 0, total: 5 } },
        },
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(hit.ok).toBe(true)
      expect(hit.state.combatants.target.currentHp).toBe(14)
      expect(hit.state.combatants.hero.classResources[resourceId].current).toBe(1)
      expect(hit.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        hit: true,
        declarativeIntentRolls: {
          [featureId]: { damage: { values: [5], modifier: 0, total: 5 } },
        },
      }))

      const missed = resolveDnd5eHeadlessAction(stateFor(pluginId, {
        resources: { [resourceId]: { current: 2, max: 2 } },
      }), {
        type: 'attack',
        actorId: 'hero',
        targetId: 'target',
        attackModifier: 0,
        d20: 1,
        spendAction: false,
        declarativeIntentFeatureIds: [featureId],
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(missed.ok).toBe(true)
      expect(missed.state.combatants.target.currentHp).toBe(20)
      expect(missed.state.combatants.hero.classResources[resourceId].current).toBe(2)

      const forgedMissRoll = resolveDnd5eHeadlessAction(stateFor(pluginId, {
        resources: { [resourceId]: { current: 2, max: 2 } },
      }), {
        type: 'attack',
        actorId: 'hero',
        targetId: 'target',
        attackModifier: 0,
        d20: 1,
        spendAction: false,
        declarativeIntentFeatureIds: [featureId],
        declarativeIntentRolls: {
          [featureId]: { damage: { values: [6], modifier: 0, total: 6 } },
        },
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(forgedMissRoll).toMatchObject({ ok: false, reason: 'invalid-dice' })

      const criticalState = stateFor(pluginId, {
        level: 10,
        resources: { [resourceId]: { current: 2, max: 2 } },
      })
      expect(dnd5eDeclarativeAttackIntentRollPlan(
        criticalState.combatants.hero,
        featureId,
        true,
      )).toMatchObject({
        ok: true,
        declarations: [{ id: 'damage', count: 2, sides: 8, modifier: 0 }],
      })
      const critical = resolveDnd5eHeadlessAction(criticalState, {
        type: 'attack',
        actorId: 'hero',
        targetId: 'target',
        attackModifier: 5,
        d20: 20,
        spendAction: false,
        declarativeIntentFeatureIds: [featureId],
        declarativeIntentRolls: {
          [featureId]: { damage: { values: [8, 7], modifier: 0, total: 15 } },
        },
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1, 1], type: 'slashing' },
      })
      expect(critical.ok).toBe(true)
      expect(critical.state.combatants.target.currentHp).toBe(3)
      expect(critical.state.combatants.hero.classResources[resourceId].current).toBe(1)

      const forgedCritical = resolveDnd5eHeadlessAction(criticalState, {
        type: 'attack',
        actorId: 'hero',
        targetId: 'target',
        attackModifier: 5,
        d20: 20,
        spendAction: false,
        declarativeIntentFeatureIds: [featureId],
        declarativeIntentRolls: {
          [featureId]: { damage: { values: [9, 7], modifier: 0, total: 16 } },
        },
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1, 1], type: 'slashing' },
      })
      expect(forgedCritical).toMatchObject({ ok: false, reason: 'invalid-dice' })
    } finally { dispose() }
  })

  it.runIf(existsSync(LOCAL_BATTLE_MASTER_DEFINITION_PATH))(
    'loads the private local subclass JSON with selected maneuvers, exclusivity and active Rally',
    () => {
    const pluginId = 'local.doco.battle-master-test'
    const definition = JSON.parse(
      readFileSync(LOCAL_BATTLE_MASTER_DEFINITION_PATH, 'utf8'),
    )[0] as DeclarativeSubclassDefinitionV1
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId,
        name: 'Local Battle Master Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Test',
        license: 'Private local use',
      },
      setup(api) { api.registerDeclarativeSubclass(definition) },
    })
    const subclassId = `${pluginId}:battle-master-2014`
    const selectionKey = `${subclassId}/maneuvers`
    const tripFeatureId = `${pluginId}:battle-master-2014.maneuver-trip-attack`
    const pushingFeatureId = `${pluginId}:battle-master-2014.maneuver-pushing-attack`
    const rallyFeatureId = `${pluginId}:battle-master-2014.maneuver-rally`
    const resourceId = `${pluginId}:superiority-dice`
    try {
      const unselected = character(10, subclassId)
      expect(dnd5eCharacterHasPluginFeature(unselected, tripFeatureId)).toBe(false)
      const selected = {
        ...unselected,
        dnd5eClassChoices: {
          fighter: {
            subclass: subclassId,
            fightingStyles: [],
            extensionChoices: {
              [selectionKey]: ['trip-attack', 'pushing-attack', 'rally'],
            },
          },
        },
      }
      expect(dnd5eCharacterHasPluginFeature(selected, tripFeatureId)).toBe(true)
      expect(syncCharacterClassResources(selected).classResources?.[resourceId]).toEqual({
        current: 5,
        max: 5,
      })
      expect(syncCharacterClassResources({
        ...selected,
        level: 15,
      }).classResources?.[resourceId]).toEqual({
        current: 6,
        max: 6,
      })

      const hero = combatant('hero', 'player', 20, {
        level: 10,
        classId: 'fighter',
        subclassId,
        classLevels: { fighter: 10 },
        subclassIds: { fighter: subclassId },
        classSelections: { [selectionKey]: ['trip-attack', 'pushing-attack', 'rally'] },
        pluginFeatureIds: [tripFeatureId, pushingFeatureId, rallyFeatureId],
        classResources: { [resourceId]: { current: 5, max: 5 } },
        abilities: { ...ABILITIES, cha: 14 },
      })
      const target = combatant('target', 'dm', 10, {
        damageResistances: ['slashing'],
      })
      const attackState = startDnd5eHeadlessCombat('battle-master-attack', [hero, target])
      attackState.distanceFeetByCombatantPair = { ['hero\u0000target']: 5 }
      expect(dnd5eDeclarativeAttackIntentRollPlan(
        attackState.combatants.hero,
        tripFeatureId,
        false,
      )).toMatchObject({
        ok: true,
        declarations: [{ count: 1, sides: 10 }],
      })
      const attack = resolveDnd5eHeadlessAction(attackState, {
        type: 'attack',
        actorId: 'hero',
        targetId: 'target',
        attackModifier: 5,
        d20: 15,
        spendAction: false,
        declarativeIntentFeatureIds: [tripFeatureId],
        declarativeIntentRolls: {
          [tripFeatureId]: {
            'superiority-damage': { values: [10], modifier: 0, total: 10 },
          },
        },
        declarativeIntentPayloads: {
          [tripFeatureId]: {
            savingThrow: { d20: 1 },
          },
        },
        damage: { count: 1, sides: 8, bonus: 0, rolls: [2], type: 'slashing' },
      })
      expect(attack.ok).toBe(true)
      expect(attack.state.combatants.target.currentHp).toBe(14)
      expect(attack.state.combatants.hero.classResources[resourceId].current).toBe(4)

      const exclusiveForgery = resolveDnd5eHeadlessAction(attackState, {
        type: 'attack',
        actorId: 'hero',
        targetId: 'target',
        attackModifier: 5,
        d20: 15,
        spendAction: false,
        declarativeIntentFeatureIds: [tripFeatureId, pushingFeatureId],
        damage: { count: 1, sides: 8, bonus: 0, rolls: [2], type: 'slashing' },
      })
      expect(exclusiveForgery).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })

      const ally = combatant('ally', 'player', 10)
      const rallyState = startDnd5eHeadlessCombat('battle-master-rally', [
        structuredClone(hero),
        ally,
      ])
      rallyState.distanceFeetByCombatantPair = { ['ally\u0000hero']: 5 }
      expect(dnd5eDeclarativePluginFeatureRollPlan(
        rallyState.combatants.hero,
        rallyFeatureId,
      )).toMatchObject({
        ok: true,
        declarations: [{ id: 'rally-temporary-hit-points', count: 1, sides: 10 }],
      })
      const rally = resolveDnd5eHeadlessAction(rallyState, {
        type: 'plugin',
        pluginId,
        actionId: 'decl.battle-master-2014.maneuver-rally',
        featureId: rallyFeatureId,
        transactionId: 'battle-master-rally-tx',
        actorId: 'hero',
        targetId: 'ally',
        targetIds: ['ally'],
        distanceFeet: 5,
        rolls: {
          'rally-temporary-hit-points': { values: [8], modifier: 0, total: 8 },
        },
      })
      expect(rally.ok).toBe(true)
      expect(rally.state.combatants.ally.temporaryHp).toBe(10)
      expect(rally.state.combatants.hero.classResources[resourceId].current).toBe(4)
      expect(rally.state.combatants.hero.turn.bonusActionAvailable).toBe(false)
    } finally { dispose() }
    },
  )

  it('uses the actor as the authoritative target for self-targeted after-hit abilities', () => {
    const pluginId = 'com.example.on-hit-self'
    const onHit = ability({
      trigger: { kind: 'after-attack-hit' },
      targeting: { kind: 'self' },
      rolls: [{ id: 'healing', kind: 'healing', label: '战斗活力', dice: { count: 0, sides: 6, modifier: { kind: 'fixed', value: 3 } } }],
      effects: [{ kind: 'healing', target: 'target', rollId: 'healing' }],
      cost: { economy: 'none' },
    })
    const { dispose } = register(pluginId, subclass([onHit]))
    try {
      const state = stateFor(pluginId)
      state.combatants.hero.currentHp = 10
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'attack', actorId: 'hero', targetId: 'target', attackModifier: 5, d20: 15,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(result.ok).toBe(true)
      expect(result.state.combatants.hero.currentHp).toBe(13)
      expect(result.state.combatants.target.currentHp).toBe(19)
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved',
        targetIds: ['hero'],
      }))
    } finally { dispose() }
  })

  it('records an explicit rejection event when an automatic trigger cannot pay its cost', () => {
    const pluginId = 'com.example.on-hit-rejected'
    const onHit = ability({
      trigger: { kind: 'after-attack-hit' },
      rolls: [{ id: 'damage', kind: 'damage', label: '追加伤害', dice: { count: 0, sides: 6, modifier: { kind: 'fixed', value: 3 } }, damageType: 'force' }],
      cost: { economy: 'none', resources: [{ resourceId: 'focus', amount: 1 }] },
    })
    const { dispose, featureId } = register(pluginId, subclass([onHit]))
    try {
      const result = resolveDnd5eHeadlessAction(stateFor(pluginId), {
        type: 'attack', actorId: 'hero', targetId: 'target', attackModifier: 5, d20: 15,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
      })
      expect(result.ok).toBe(true)
      expect(result.state.combatants.target.currentHp).toBe(19)
      expect(result.events).toContainEqual({
        type: 'declarative-subclass-trigger-rejected',
        actorId: 'hero',
        abilityId: featureId,
        trigger: 'after-attack-hit',
        targetIds: ['target'],
        reason: 'class-resource-unavailable',
      })
      expect(result.events).not.toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved', abilityId: featureId,
      }))
    } finally { dispose() }
  })

  it('enforces once-per-turn and rejects duplicate transaction ids', () => {
    const pluginId = 'com.example.limit'
    const { dispose, featureId } = register(pluginId, subclass([ability({ limits: { oncePerTurn: true } })]))
    const action = (transactionId: string) => ({
      type: 'plugin' as const, pluginId, actionId: 'decl.arc-guard.arc-strike', featureId, transactionId,
      actorId: 'hero', targetId: 'target', targetIds: ['target'], distanceFeet: 5,
      rolls: { damage: { values: [1], modifier: 0, total: 1 } },
    })
    try {
      const first = resolveDnd5eHeadlessAction(stateFor(pluginId), action('tx-once'))
      expect(first.ok).toBe(true)
      expect(resolveDnd5eHeadlessAction(first.state, action('tx-next'))).toMatchObject({ ok: false, reason: 'feature-already-used' })
      const noTurnLimit = register('com.example.replay', subclass([ability({ limits: undefined })]))
      try {
        const replayAction = { ...action('tx-replay'), pluginId: 'com.example.replay', featureId: noTurnLimit.featureId }
        const replayFirst = resolveDnd5eHeadlessAction(stateFor('com.example.replay'), replayAction)
        expect(resolveDnd5eHeadlessAction(replayFirst.state, replayAction)).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
      } finally { noTurnLimit.dispose() }
    } finally { dispose() }
  })

  it('reads the pinned effective room rules context during settlement', () => {
    const pluginId = 'com.example.house-rule'
    const { dispose, featureId } = register(pluginId)
    const action = {
      type: 'plugin' as const, pluginId, actionId: 'decl.arc-guard.arc-strike', featureId,
      transactionId: 'tx-house', actorId: 'hero', targetId: 'target', targetIds: ['target'], distanceFeet: 5,
      rolls: { damage: { values: [4], modifier: 0, total: 4 } },
    }
    try {
      expect(resolveDnd5eHeadlessAction(stateFor(pluginId), action).state.combatants.target.currentHp).toBe(16)
      expect(resolveDnd5eHeadlessAction(stateFor(pluginId, { effectiveMultiplier: 2 }), { ...action, transactionId: 'tx-house-2' }).state.combatants.target.currentHp).toBe(12)
    } finally { dispose() }
  })

  it('pins a room-rule revision for the current combat and applies edits to the next combat', () => {
    clearDnd5eEffectiveRulesContextsForTest()
    const revisionOne = dnd5eEffectiveRulesContextForCombat('combat-a', {
      revision: 1, hash: 'hash-1', houseRules: { declarativeAbilityDamageMultiplier: 1 },
    })
    const sameCombat = dnd5eEffectiveRulesContextForCombat('combat-a', {
      revision: 2, hash: 'hash-2', houseRules: { declarativeAbilityDamageMultiplier: 2 },
    })
    const nextCombat = dnd5eEffectiveRulesContextForCombat('combat-b', {
      revision: 2, hash: 'hash-2', houseRules: { declarativeAbilityDamageMultiplier: 2 },
    })
    expect(sameCombat).toEqual(revisionOne)
    expect(nextCombat).toMatchObject({ revision: 2, hash: 'hash-2', houseRules: { declarativeAbilityDamageMultiplier: 2 } })
    clearDnd5eEffectiveRulesContextsForTest()
  })

  it('requires DM confirmation for partial automation and never executes unsupported declarations silently', () => {
    const pluginId = 'com.example.partial'
    const partial = ability({ predicates: { equipmentIds: ['arc-focus'] } })
    const { dispose, featureId } = register(pluginId, subclass([partial]))
    const action = {
      type: 'plugin' as const, pluginId, actionId: 'decl.arc-guard.arc-strike', featureId,
      transactionId: 'tx-partial', actorId: 'hero', targetId: 'target', targetIds: ['target'], distanceFeet: 5,
      rolls: { damage: { values: [2], modifier: 0, total: 2 } },
    }
    try {
      expect(dnd5ePluginFeatureDefinition(featureId)).toMatchObject({ automation: 'partial' })
      expect(resolveDnd5eHeadlessAction(stateFor(pluginId), action)).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
      const confirmed = resolveDnd5eHeadlessAction(stateFor(pluginId), {
        ...action, transactionId: 'tx-partial-confirmed', interruptChoiceId: 'dm-apply',
      })
      expect(confirmed.ok).toBe(true)
      expect(confirmed.state.combatants.target.currentHp).toBe(18)
    } finally { dispose() }
  })

  it('uses the Host distance snapshot instead of a client-reported distance', () => {
    const pluginId = 'com.example.distance'
    const { dispose, featureId } = register(pluginId)
    const state = stateFor(pluginId)
    state.distanceFeetByCombatantPair = { ['hero\u0000target']: 60 }
    try {
      expect(resolveDnd5eHeadlessAction(state, {
        type: 'plugin', pluginId, actionId: 'decl.arc-guard.arc-strike', featureId,
        transactionId: 'tx-distance', actorId: 'hero', targetId: 'target', targetIds: ['target'],
        distanceFeet: 5, rolls: { damage: { values: [2], modifier: 0, total: 2 } },
      })).toMatchObject({ ok: false, reason: 'invalid-target' })
    } finally { dispose() }
  })

  it('rejects illegal targets and forged unowned subclass abilities', () => {
    const pluginId = 'com.example.authority'
    const { dispose, featureId } = register(pluginId)
    const action = {
      type: 'plugin' as const, pluginId, actionId: 'decl.arc-guard.arc-strike', featureId,
      transactionId: 'tx-authority', actorId: 'hero', targetId: 'target', targetIds: ['target'], distanceFeet: 5,
      rolls: { damage: { values: [1], modifier: 0, total: 1 } },
    }
    try {
      expect(resolveDnd5eHeadlessAction(stateFor(pluginId, { allyTarget: true }), action)).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(resolveDnd5eHeadlessAction(stateFor(pluginId, { featureId: 'not-owned' }), { ...action, transactionId: 'tx-forged' })).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
    } finally { dispose() }
  })

  it('rejects JavaScript fields in declarative JSON while preserving legacy source detection', () => {
    const packageValue = {
      format: 'dndstars5e-declarative', schemaVersion: 1,
      manifest: { id: 'com.example.json', name: 'JSON', version: '1', publisher: 'Test', license: 'CC0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1' },
      subclasses: [subclass()], setup: 'alert(1)',
    }
    const bytes = (source: string) => new TextEncoder().encode(source).buffer as ArrayBuffer
    expect(() => parseDnd5eDeclarativeRulesPackageV1(bytes(JSON.stringify(packageValue)))).toThrow('不支持的字段')
    expect(parseDnd5eDeclarativeRulesPackageV1(bytes('const plugin = {}; export default plugin;'))).toBeNull()
    expect(() => parseDnd5eDeclarativeRulesPackageV1(bytes(JSON.stringify({
      ...packageValue, setup: undefined,
      subclasses: [subclass([ability({ cost: { economy: 'none', resources: [{ resourceId: 'focus', amount: -1 }] } })])],
    })))).toThrow('资源消耗数量无效')
  })

  it('keeps the legacy feature/action migration compatible and reports safe degradation', () => {
    const migrated = migrateLegacyFeatureActionToDeclarativeV1({
      id: 'legacy-action', name: '旧特性', description: '旧格式。', level: 3,
      action: { economy: 'action', targeting: { kind: 'self' } },
    })
    expect(migrated).toMatchObject({ schemaVersion: 1, trigger: { kind: 'active-use' }, automation: 'partial' })
    const report = declarativeSubclassCompatibilityReportV1([subclass([
      ability(),
      ability({ id: 'partial', effects: [{ kind: 'move', target: 'target', distanceFeet: 10 }], rolls: [], automation: 'full' }),
      ability({ id: 'manual', automation: 'manual' }),
    ])])
    expect(report).toMatchObject({ full: 1, partial: 0, manual: 2 })
    expect(report.abilities.find((entry) => entry.abilityId === 'partial')?.reasons).toContain('强制移动需要地图三维路径与碰撞事务')
  })
})
