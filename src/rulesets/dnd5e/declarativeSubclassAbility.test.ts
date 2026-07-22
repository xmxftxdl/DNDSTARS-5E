import { describe, expect, it } from 'vitest'
import { restoreClassResources, syncCharacterClassResources } from '../../lib/classResources'
import type { Character } from '../../types/character'
import {
  clearDnd5eEffectiveRulesContextsForTest,
  createDnd5eEffectiveRulesContextV1,
  dnd5eEffectiveRulesContextForCombat,
} from './effectiveRulesContext'
import {
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
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginFeatureDefinition,
  registerDnd5eRulesPlugin,
} from './pluginApi'

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
} = {}) {
  const featureId = input.featureId ?? `${pluginId}:arc-guard.arc-strike`
  const hero = combatant('hero', 'player', 20, {
    level: 3, classId: 'fighter', subclassId: `${pluginId}:arc-guard`,
    classLevels: { fighter: 3 }, subclassIds: { fighter: `${pluginId}:arc-guard` },
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
