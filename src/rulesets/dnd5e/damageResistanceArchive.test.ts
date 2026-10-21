import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin, dnd5eDamageMitigationInterruptFeaturesForCharacter } from './pluginApi'
import { applyDnd5eLevelAdvancement } from './levelAdvancement'
import { migrateCharacterToDnd5e, createCombatantFromDnd5eCharacter } from './character'
import { type Dnd5eAction, dnd5eDamageMitigationInterruptHasResources, createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, dnd5eCombatantPairKey } from './headlessCombatEngine'
import { DND5E_DAMAGE_TYPES } from './damageTypes'

const baseCases = [
  { route: 'attack', classId: 'monk', resourceId: 'dnd5e-ki' },
  { route: 'plugin', classId: 'monk', resourceId: 'dnd5e-ki' },
  { route: 'attack', classId: 'fighter', resourceId: 'fighterSecondWind' },
  { route: 'plugin', classId: 'fighter', resourceId: 'fighterSecondWind' },
] as const
it.each([
  ...baseCases.flatMap(entry => [false, true].map(attackOnly => ({ ...entry, attackOnly, attackBranch: true }))),
  { ...baseCases[1], attackOnly: true, attackBranch: false },
])('reinstalls $classId reactions through $route, attackOnly=$attackOnly, attackBranch=$attackBranch', async ({ route, classId, resourceId, attackOnly, attackBranch }) => {
  const namespace = 'test.archived-resistance'
  const featureId = `${namespace}:defender.guard`
  const usesResourceId = `${namespace}:decl-defender-guard-uses`
  const full = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic resistance', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'subclass', id: 'defender', name: 'Defender',
      automation: full, payload: { schemaVersion: 1, id: 'defender', name: 'Defender', classId, summary: 'Synthetic reaction fixture',
        abilities: [{ schemaVersion: 1, id: 'guard', name: 'Guard', description: 'Synthetic typed resistance', level: 3,
          trigger: { kind: 'before-damage-taken' }, targeting: { kind: 'single-creature', relation: 'ally', includeSelf: true, rangeFeet: 30 },
          limits: { uses: { kind: 'fixed', value: 3 }, reset: 'short-rest' },
          cost: { economy: 'reaction', uses: 2, resources: [{ scope: 'core', resourceId, amount: 1 }] }, effects: [],
          mechanic: { kind: 'damage-mitigation-interrupt', mode: 'resistance', protects: 'ally-or-self', attackOnly, damageTypes: [...DND5E_DAMAGE_TYPES] },
          automation: 'full' }],
      } }, ...DND5E_DAMAGE_TYPES.map(type => ({ schemaVersion: 1 as const, namespace, version: '1.0.0', kind: 'feature' as const,
        id: `probe-${type}`, name: `Probe ${type}`, automation: full,
        payload: { id: `probe-${type}`, name: 'Probe', summary: 'Synthetic', description: 'Synthetic', automation: 'full' as const },
        activities: [{ schemaVersion: 1 as const, id: `probe-${type}`, name: 'Probe', activation: { kind: 'free' as const }, automation: full,
          legacySource: { kind: 'feature' as const, id: `probe-${type}` }, target: { kind: 'creature' as const, count: 1, relation: 'any' as const, rangeFeet: 30 },
          checks: attackOnly ? [{ id: 'attack', kind: 'attack-roll' as const, rollId: 'attack', attackBonus: { kind: 'constant' as const, value: 10 }, rollMode: 'normal' as const, scope: 'per-target' as const, delivery: 'ranged' as const }] : undefined,
          outcomes: [{ id: 'hit', when: attackOnly && attackBranch ? { kind: 'check' as const, checkId: 'attack', result: 'success' as const } : { kind: 'always' as const }, operations: [{ id: 'damage', kind: 'damage' as const, target: 'target' as const,
            damageType: type, amount: { kind: 'constant' as const, value: 9 } }] }],
        }],
      }))],
  }
  const original = structuredClone(bundle)
  let archive = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(archive)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const hero = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: classId === 'monk' ? '武僧' : '战士', level: 2,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, dnd5eClassLevels: { [classId]: 2 }, dnd5eClassChoices: classId === 'monk' ? { classes: { monk: { selections: {} } } } : { fighter: { fightingStyles: ['defense'] } },
        maxHp: 40, currentHp: 40, hitDice: '2d10', hitPointDice: [{ sides: 10, current: 2, max: 2 }],
        classResources: { [resourceId]: { current: 2, max: 2 } } })
      expect(dnd5eDamageMitigationInterruptFeaturesForCharacter(hero)).toEqual([])
      const advanced = applyDnd5eLevelAdvancement(hero, { schemaVersion: 1, classId, subclassId: `${namespace}:defender`,
        levelsGained: 1, hitPointMethod: 'fixed', hitPointRolls: [], asiChoices: [] })
      expect(advanced.ok, JSON.stringify(advanced)).toBe(true)
      if (!advanced.ok) throw Error(advanced.reason)
      const saved = JSON.parse(JSON.stringify(advanced.character))
      expect(dnd5eDamageMitigationInterruptFeaturesForCharacter(saved).map(feature => feature.id)).toContain(featureId)
      const defender = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved), controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 } })
      expect(defender.pluginFeatureIds).toContain(featureId)
      expect(defender.classResources[usesResourceId]).toEqual({ current: 3, max: 3 })
      const attacker = createDnd5eCombatant({ id: 'attacker', name: 'Attacker', controller: 'dm', initiative: 20,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
        armorClass: 10, currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
        pluginFeatureIds: DND5E_DAMAGE_TYPES.map(type => `${namespace}:probe-${type}`) })
      const initial = startDnd5eHeadlessCombat('archive', [attacker, defender])
      initial.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(attacker.id, defender.id)]: 5 }
      for (const type of DND5E_DAMAGE_TYPES) {
        const state = JSON.parse(JSON.stringify(initial)) as typeof initial
        const before = structuredClone(state)
        const interrupts = [{ sourceId: defender.id, targetId: defender.id, featureId }]
        const action: Dnd5eAction = route === 'attack'
          ? { type: 'attack' as const, actorId: attacker.id, targetId: defender.id, d20: 18, attackModifier: 10, spendAction: false,
              damage: { count: 1, sides: 10, rolls: [9], bonus: 0, type }, damageMitigationInterrupts: interrupts }
          : { type: 'plugin' as const, actorId: attacker.id, targetId: defender.id, targetIds: [defender.id],
              pluginId: namespace, featureId: `${namespace}:probe-${type}`, actionId: `probe-${type}`, rolls: attackOnly ? { 'attack:hero': { values: [15], total: 15, modifier: 0 } } : {}, distanceFeet: 5,
              damageMitigationInterrupts: interrupts }
        expect(dnd5eDamageMitigationInterruptHasResources(state.combatants.hero, featureId)).toBe(true)
        const result = resolveDnd5eHeadlessAction(state, action)
        if (route === 'plugin' && attackOnly && !attackBranch) {
          const baseline = resolveDnd5eHeadlessAction(state, { ...action, damageMitigationInterrupts: undefined })
          expect(baseline.ok, baseline.ok ? '' : baseline.reason).toBe(true)
          expect(baseline.state.combatants.hero.currentHp).toBe(before.combatants.hero.currentHp - 9)
          expect(result).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
          expect(result.state.combatants.hero.currentHp).toBe(before.combatants.hero.currentHp)
          expect(result.state.combatants.hero.classResources).toEqual(before.combatants.hero.classResources)
          expect(result.state.combatants.hero.turn.reactionAvailable).toBe(true)
          continue
        }
        expect(result.ok, `${type}: ${result.ok ? '' : result.reason}`).toBe(true)
        expect(result.state.combatants.hero.currentHp).toBe(before.combatants.hero.currentHp - 4)
        expect(result.state.combatants.hero.classResources[resourceId].current).toBe(before.combatants.hero.classResources[resourceId].current - 1)
        expect(result.state.combatants.hero.turn.reactionAvailable).toBe(false)
        expect(result.state.combatants.hero.classResources[usesResourceId].current).toBe(1)
        expect(result.events.filter(event => event.type === 'damage-mitigation-interrupt-applied')).toHaveLength(1)
        expect(state).toEqual(before)
        const retry = resolveDnd5eHeadlessAction(result.state, action)
        expect(retry.ok).toBe(false)
        const exhausted = structuredClone(result.state)
        exhausted.combatants.hero.turn.reactionAvailable = true
        exhausted.combatants.hero.classResources[resourceId] = structuredClone(before.combatants.hero.classResources[resourceId])
        expect(dnd5eDamageMitigationInterruptHasResources(exhausted.combatants.hero, featureId)).toBe(false)
        const insufficientUses = resolveDnd5eHeadlessAction(exhausted, action)
        expect(insufficientUses.ok).toBe(false)
        expect(insufficientUses.state.combatants.hero.turn.reactionAvailable).toBe(true)
        expect(insufficientUses.state.combatants.hero.classResources).toEqual(exhausted.combatants.hero.classResources)
        expect(insufficientUses.state.combatants.hero.currentHp).toBe(exhausted.combatants.hero.currentHp)
        expect(retry.state.combatants.hero.currentHp).toBe(result.state.combatants.hero.currentHp)
        expect(retry.state.combatants.hero.classResources[resourceId].current).toBe(before.combatants.hero.classResources[resourceId].current - 1)
      }
      archive = await exportDnd5eStarMod(decoded.bundle)
    } finally { dispose() }
  }
  expect(bundle).toEqual(original)
}, 20000)
