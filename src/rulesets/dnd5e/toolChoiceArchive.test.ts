import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { applyDnd5eLevelAdvancement, buildDnd5eLevelAdvancementPlan } from './levelAdvancement'
import { migrateCharacterToDnd5e, createCombatantFromDnd5eCharacter } from './character'
import { resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

it('reinstalls closed tool choices, rejects forged selections and settles the selected tool proficiency', async () => {
  const namespace = 'test.archived-tool-choice'
  const subclassId = `${namespace}:artisan`
  const tools = ['calligraphers-supplies', 'painters-supplies']
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: namespace, name: 'Synthetic tool training', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only' },
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'subclass', id: 'artisan', name: 'Artisan',
      automation: automationCapabilityFromLegacyStatus('full'), payload: {
        schemaVersion: 1, id: 'artisan', name: 'Artisan', classId: 'monk', summary: 'Synthetic choice fixture',
        abilities: [{ schemaVersion: 1, id: 'guard', name: 'Guard', description: 'Separate synthetic passive', level: 3,
          trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'passive-defense', savingThrowAdvantageAgainstConditions: ['poisoned'] } }],
        advancements: [{ schemaVersion: 1, id: 'tool-training', level: 3, kind: 'proficiency',
          category: 'tool', count: 1, choices: tools }],
      } }],
  }
  let archive = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(archive)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const hero = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '武僧', level: 2,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, dnd5eClassLevels: { monk: 2 },
        dnd5eClassChoices: { classes: { monk: { selections: {} } } }, maxHp: 20, currentHp: 20, hitDice: '2d8' })
      const before = structuredClone(hero)
      const plan = buildDnd5eLevelAdvancementPlan(hero, 'monk', 1, subclassId)!
      const content = plan.contentAdvancements.find(entry => entry.contentId === `${subclassId}:level-3`)!
      expect(content.requirements[0].options.map(option => option.label)).toEqual(['书法工具', '画家工具'])
      for (const selected of [[], [tools[0]], [tools[1]], tools, ['thieves-tools']]) {
        const result = applyDnd5eLevelAdvancement(hero, { schemaVersion: 1, classId: 'monk', subclassId,
          levelsGained: 1, hitPointMethod: 'fixed', hitPointRolls: [], asiChoices: [],
          contentChoiceSelections: { [content.contentId]: { 'tool-training': selected } } })
        const valid = selected.length === 1 && tools.includes(selected[0])
        expect(result.ok, JSON.stringify(result)).toBe(valid)
        if (!result.ok) {
          expect(result.reason).toBe(selected.length === 0 ? 'missing-content-choice' : 'invalid-content-choice')
          continue
        }
        const saved = JSON.parse(JSON.stringify(result.character))
        const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved),
          controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
        expect(actor.toolProficiencies).toEqual(selected)
        const state = startDnd5eHeadlessCombat('tools', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: 1 }])
        for (const toolId of tools) {
          const check = resolveDnd5eHeadlessAction(state, { type: 'ability-check', actorId: 'hero', ability: 'int',
            toolId, d20: 10, spendAction: false })
          expect(check.ok, check.ok ? undefined : check.reason).toBe(true)
          expect(check.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', toolId,
            total: 10 + (selected.includes(toolId) ? actor.proficiencyBonus : 0) }))
        }
      }
      expect(hero).toEqual(before)
    } finally { dispose() }
    archive = await exportDnd5eStarMod(decoded.bundle)
  }
})
