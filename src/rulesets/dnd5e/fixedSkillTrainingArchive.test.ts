import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { applyDnd5eLevelAdvancement } from './levelAdvancement'
import { migrateCharacterToDnd5e, createCombatantFromDnd5eCharacter } from './character'
import { resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

it.each([false, true])('imports fixed subclass skill training and advances an existing expert=%s', async existingExpert => {
  const namespace = 'test.fixed-skill-training'
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic training', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'subclass', id: 'trained', name: 'Trained',
      automation: automationCapabilityFromLegacyStatus('full'), payload: {
        schemaVersion: 1, id: 'trained', name: 'Trained', classId: 'rogue', summary: 'Synthetic training fixture',
        abilities: [{ schemaVersion: 1, id: 'defense', name: 'Defense', description: 'Separate synthetic passive', level: 3,
          trigger: { kind: 'passive' }, targeting: { kind: 'self' }, rolls: [], effects: [],
          mechanic: { kind: 'passive-defense', savingThrowAdvantageAgainstConditions: ['poisoned'] }, automation: 'full' }],
        advancements: [{ schemaVersion: 1, id: 'training', level: 3, kind: 'build-grant',
          grants: ['nature', 'survival'].flatMap(skill => [
            { kind: 'proficiency' as const, category: 'skill' as const, id: skill },
            { kind: 'tag' as const, key: 'skill-expertise', value: skill },
          ]) }],
      } }],
  }
  const original = structuredClone(bundle)
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const reimported = await readDnd5eStarMod(await exportDnd5eStarMod(decoded.bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(reimported.bundle))
  try {
    const hero = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '游荡者', level: 2,
      abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
      dnd5eClassLevels: { rogue: 2 }, skills: existingExpert ? ['nature', 'survival'] : [],
      dnd5eClassChoices: { classes: { rogue: { selections: { expertise: existingExpert ? ['nature', 'survival'] : ['stealth', 'perception'] } } } },
      maxHp: 15, currentHp: 15, hitDice: '2d8', hitPointDice: [{ sides: 8, current: 2, max: 2 }] })
    const before = structuredClone(hero)
    const result = applyDnd5eLevelAdvancement(hero, { schemaVersion: 1, classId: 'rogue', subclassId: `${namespace}:trained`,
      levelsGained: 1, hitPointMethod: 'fixed', hitPointRolls: [], asiChoices: [] })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error(result.reason)
    expect(hero).toEqual(before)
    const saved = JSON.parse(JSON.stringify(result.character))
    expect(saved.skills).toEqual(expect.arrayContaining(['nature', 'survival']))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved),
      controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const enemy = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: 1 }
    const state = startDnd5eHeadlessCombat('training', [actor, enemy])
    for (const [skill, ability] of [['nature', 'int'], ['survival', 'wis']] as const) {
      const checked = resolveDnd5eHeadlessAction(state, { type: 'ability-check', actorId: actor.id, skill, ability,
        d20: 10, spendAction: false })
      expect(checked.ok).toBe(true)
      expect(checked.events.find(event => event.type === 'ability-check-resolved')).toMatchObject({ total: 14 })
    }
  } finally { dispose() }
  expect(bundle).toEqual(original)
})
