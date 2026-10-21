import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin, dnd5eCharacterHasPluginFeature } from './pluginApi'
import { applyDnd5eLevelAdvancement } from './levelAdvancement'
import { migrateCharacterToDnd5e, createCombatantFromDnd5eCharacter } from './character'
import { startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey } from './headlessCombatEngine'

it('roundtrips a level-gated subclass grant into melee protection without explicit feature ownership', async () => {
  const namespace = 'test.subclass-footwork', featureId = `${namespace}:footwork`
  const full = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic subclass', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'subclass', id: 'duelist', name: 'Duelist',
      automation: full, payload: { schemaVersion: 1, id: 'duelist', name: 'Duelist', classId: 'rogue', summary: 'Synthetic entitlement',
        abilities: [{ schemaVersion: 1, id: 'passive', name: 'Passive', description: 'Separate synthetic passive', level: 3,
          trigger: { kind: 'passive' }, targeting: { kind: 'self' }, rolls: [], effects: [],
          mechanic: { kind: 'passive-defense', savingThrowAdvantageAgainstConditions: ['poisoned'] }, automation: 'full' }],
        advancements: [{ schemaVersion: 1, id: 'footwork', level: 3, kind: 'build-grant', grants: [{ kind: 'feature', featureId }] }],
      } }, { schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'footwork', name: 'Footwork', automation: full,
      payload: { id: 'footwork', name: 'Footwork', summary: 'Synthetic', description: 'Synthetic', automation: 'full',
        classRequirements: [{ classId: 'rogue', minimumLevel: 3 }] },
      effects: [{ schemaVersion: 1, id: 'passive', name: 'Footwork', stacking: 'unique-by-source', duration: { kind: 'permanent' },
        modifiers: [{ kind: 'character-capability', capability: 'preventOpportunityAttacksFromMeleeAttackTargets', value: true }] }],
    }] }
  const original = structuredClone(bundle)
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const reimported = await readDnd5eStarMod(await exportDnd5eStarMod(decoded.bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(reimported.bundle))
  try {
    const hero = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '游荡者', level: 2,
      abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 14 }, dnd5eClassLevels: { rogue: 2 },
      skills: ['stealth', 'perception'],
      dnd5eClassChoices: { classes: { rogue: { selections: { expertise: ['stealth', 'perception'] } } } },
      maxHp: 15, currentHp: 15, hitDice: '2d8', hitPointDice: [{ sides: 8, current: 2, max: 2 }] })
    expect(dnd5eCharacterHasPluginFeature(hero, featureId)).toBe(false)
    const result = applyDnd5eLevelAdvancement(hero, { schemaVersion: 1, classId: 'rogue', subclassId: `${namespace}:duelist`,
      levelsGained: 1, hitPointMethod: 'fixed', hitPointRolls: [], asiChoices: [] })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error(result.reason)
    const saved = JSON.parse(JSON.stringify(result.character))
    expect(saved.dnd5ePluginFeatureIds ?? []).not.toContain(featureId)
    expect(dnd5eCharacterHasPluginFeature(saved, featureId)).toBe(true)
    expect(migrateCharacterToDnd5e(saved).preventOpportunityAttacksFromMeleeAttackTargets).toBe(true)
    for (const ineligible of [hero, { ...hero, level: 10, dnd5eClassLevels: { rogue: 2, fighter: 8 } },
      { ...hero, level: 3, dnd5eClassLevels: { rogue: 3 } },
      { ...saved, level: 2, dnd5eClassLevels: { rogue: 2 } }]) {
      expect(dnd5eCharacterHasPluginFeature(ineligible, featureId)).toBe(false)
      expect(migrateCharacterToDnd5e(ineligible).preventOpportunityAttacksFromMeleeAttackTargets ?? false).toBe(false)
    }
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved), controller: 'player',
      initiativeD20: 20, position: { x: 0, y: 0 } })
    const enemy = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: 1 }
    const state = startDnd5eHeadlessCombat('subclass-footwork', [actor, enemy])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(actor.id, enemy.id)]: 5 }
    const attack = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: actor.id, targetId: enemy.id,
      attackModifier: 0, d20: 1, damage: { count: 1, sides: 4, bonus: 0, rolls: [] } })
    expect(attack.ok).toBe(true)
    expect(attack.state.combatants[actor.id].classState.meleeAttackTargetIdsThisTurn).toEqual([enemy.id])
    expect(resolveDnd5eHeadlessAction(attack.state, { type: 'opportunity-attack', actorId: enemy.id, targetId: actor.id,
      attackModifier: 0, d20: 1, damage: { count: 1, sides: 4, bonus: 0, rolls: [] } })).toMatchObject({ ok: false, reason: 'invalid-target' })
  } finally { dispose() }
  expect(bundle).toEqual(original)
})
