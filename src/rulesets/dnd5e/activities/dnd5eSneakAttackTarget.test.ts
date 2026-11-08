import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eWeaponClassDamageDefinitions } from '../headlessCombatEngine'
import { createDnd5eConditionEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from '../activeEffects'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'

it.each(['compiled', 'direct'] as const)('persists a successful opposed mark and eligible Sneak Attack dice after archive import (%s)', async route => {
  const namespace = 'test.sneak-target'
  const automation = automationCapabilityFromLegacyStatus('full')
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'mark', name: 'Synthetic opposed mark', automation,
    activation: { kind: 'bonus-action' }, target: { kind: 'creature', relation: 'any', count: 1, requiresLineOfSight: true },
    requirements: [
      { kind: 'class-level', classId: 'rogue', minimum: 3 },
      { kind: 'condition', subject: 'target', condition: 'incapacitated', present: false },
    ],
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
    legacySource: { kind: 'feature', id: 'mark' },
    checks: [{ id: 'contest', kind: 'opposed-ability-check', rollId: 'source', opposedRollId: 'defense',
      scope: 'per-target', sourceAbility: 'wis', sourceSkill: 'insight', tiesFavor: 'target',
      sourceModifier: { kind: 'reference', reference: { kind: 'actor-skill-check-modifier', skill: 'insight' } },
      targetOptions: [{ ability: 'cha', skill: 'deception' }], sourceRollMode: 'host-derived', targetRollMode: 'host-derived' }],
    effects: [{ schemaVersion: 1, id: 'mark', name: 'Mark', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-start' },
      modifiers: [{ kind: 'sneak-attack-target', bonusDice: { minimumRogueLevel: 17, count: 3 } }] }],
    outcomes: [{ id: 'mark', when: { kind: 'check', checkId: 'contest', result: 'success' },
      operations: [{ id: 'mark', kind: 'apply-effect', effectId: 'mark', target: 'actor' }] }],
  }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const patch of [{ targetId: 'forged' }, { bonusDice: { minimumRogueLevel: 0, count: 3 } },
    { bonusDice: { minimumRogueLevel: 17, count: -1 } }, { bonusDice: 'invalid' }]) {
    const invalid = structuredClone(activity)
    Object.assign(invalid.effects![0].modifiers![0], patch)
    expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('sneak attack target'))).toBe(true)
  }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic mark', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'mark', name: 'Mark', automation,
      activities: [activity], payload: { id: 'mark', name: 'Mark', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  expect(decoded.bundle.definitions[0].activities).toEqual([activity])
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'dm',
      classId: 'rogue', level: 17, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30,
      position: { x: 0, y: 0 }, concentrating: false })
    const actor = make('actor', 20)
    actor.pluginFeatureIds = [`${namespace}:mark`]
    let state = startDnd5eHeadlessCombat('sneak-target', [actor, make('target', 10), make('other', 0)])
    const roll = (n: number) => ({ values: [n], total: n, modifier: 0 })
    const mark = (targetId: string, source: number, defense: number) => route === 'compiled' ? resolveDnd5eHeadlessAction(state, {
      type: 'plugin', pluginId: namespace, actionId: 'mark', featureId: `${namespace}:mark`, actorId: 'actor', targetId,
      rolls: { [`source:${targetId}`]: roll(source), [`defense:${targetId}`]: roll(defense) },
    }) : resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor',
      command: { schemaVersion: 1, commandId: `mark-${targetId}-${source}`, actorId: 'actor', packageId: namespace,
        packageVersion: '1.0.0', activityId: 'mark', targetIds: [targetId], expectedRevision: 1 },
      authoritativeRolls: { [`source:${targetId}`]: roll(source), [`defense:${targetId}`]: roll(defense) },
    }).result
    const initial = JSON.stringify(state)
    state.combatants.target.classState.activeEffects = [createDnd5eConditionEffect({
      condition: 'incapacitated', targetId: 'target', source: { kind: 'feature', actorId: 'actor' },
    })]
    state.combatants.target.conditions = ['incapacitated']
    const blocked = JSON.stringify(state)
    const blockedResult = mark('target', 18, 2)
    expect(blockedResult.ok, JSON.stringify(blockedResult)).toBe(false)
    expect(JSON.stringify(state)).toBe(blocked)
    state = JSON.parse(initial)
    state.combatants.actor.classLevels = { rogue: 2 }
    state.combatants.actor.level = 2
    const belowLevel = JSON.stringify(state)
    expect(mark('target', 18, 2).ok).toBe(false)
    expect(JSON.stringify(state)).toBe(belowLevel)
    state = JSON.parse(initial)
    const success = mark('target', 18, 2)
    expect(success.ok, JSON.stringify(success)).toBe(true)
    if (!success.ok || !('state' in success)) throw new Error(JSON.stringify(success))
    state = JSON.parse(JSON.stringify(success.state))
    expect(state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    expect(validateDnd5eActiveEffectsStrict(state.combatants.actor.classState.activeEffects)).toMatchObject({ ok: true })
    state.combatants.actor.classState.activeEffects = normalizeDnd5eActiveEffects(state.combatants.actor.classState.activeEffects)
    const effects = () => state.combatants.actor.classState.activeEffects ?? []
    expect(effects().find(effect => effect.modifiers?.sneakAttackTarget)?.modifiers?.sneakAttackTarget?.targetId).toBe('target')
    const context = { mode: 'melee' as const, finesse: true, strengthBased: false, weaponDamageSides: 6,
      damageType: 'piercing' as const, adjacentEnemyOfTarget: false }
    const dice = (targetId = 'target', effectiveMode: 'normal' | 'disadvantage' = 'normal', finesse = true) =>
      dnd5eWeaponClassDamageDefinitions({ state, actorId: 'actor', targetId, effectiveMode, critical: false,
        context: { ...context, finesse } }).find(definition => definition.source === 'sneak-attack')
    expect(dice()?.count, JSON.stringify({effects: effects(), actorClass: state.combatants.actor.classId, level: state.combatants.actor.level})).toBe(12)
    expect(dice('other')).toBeUndefined()
    expect(dice('target', 'disadvantage')).toBeUndefined()
    expect(dice('target', 'normal', false)).toBeUndefined()
    const storedLevels = state.combatants.actor.classLevels
    state.combatants.actor.classLevels = { rogue: 16 }
    state.combatants.actor.level = 16
    expect(dice()?.count).toBe(8)
    state.combatants.actor.classLevels = storedLevels
    state.combatants.actor.level = 17
    for (const source of [1, 10]) {
      state.combatants.actor.turn.bonusActionAvailable = true
      const failure = mark('other', source, 10)
      expect(failure.ok, JSON.stringify(failure)).toBe(true)
      if (!failure.ok || !('state' in failure)) throw new Error(JSON.stringify(failure))
      state = failure.state
      expect(dice()?.count).toBe(12)
      expect(dice('other')).toBeUndefined()
      expect(state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    }
    state.combatants.actor.turn.bonusActionAvailable = true
    const replacement = mark('other', 20, 1)
    expect(replacement.ok, JSON.stringify(replacement)).toBe(true)
    if (!replacement.ok || !('state' in replacement)) throw new Error(JSON.stringify(replacement))
    state = replacement.state
    expect(dice()).toBeUndefined()
    expect(dice('other')?.count).toBe(12)
    const critical = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'other',
      attackModifier: 5, d20: 20, spendAction: false, classDamageContext: context,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [2, 2], type: 'piercing' },
      classDamageRolls: [{ source: 'sneak-attack', rolls: Array(24).fill(1) }] })
    expect(critical.ok, JSON.stringify(critical)).toBe(true)
    expect(critical.state.combatants.other.currentHp).toBe(72)
    const hit = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'other',
      attackModifier: 5, d20: 15, spendAction: false, classDamageContext: context,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [2], type: 'piercing' },
      classDamageRolls: [{ source: 'sneak-attack', rolls: Array(12).fill(1) }] })
    expect(hit.ok, JSON.stringify(hit)).toBe(true)
    expect(hit.state.combatants.other.currentHp).toBe(86)
    state = hit.state
    expect(dice('other')).toBeUndefined()
    for (let round = 0; round < 10; round++) for (const actorId of ['actor', 'target', 'other']) {
      const end = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
      expect(end.ok, JSON.stringify(end)).toBe(true)
      state = end.state
    }
    expect(effects().some(effect => effect.modifiers?.sneakAttackTarget)).toBe(false)
    expect(dice('other')).toBeUndefined()
  } finally { dispose() }
}, 30_000)
