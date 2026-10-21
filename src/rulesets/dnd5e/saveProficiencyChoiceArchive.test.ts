import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { applyDnd5eLevelAdvancement, reviseDnd5eLevelAdvancement } from './levelAdvancement'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'

it('preserves conditional save training through archive reinstall, level advancement and revision', async () => {
  const namespace = 'test.save-training'
  const subclassId = `${namespace}:scholar`
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: namespace, name: 'Synthetic training', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only' },
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'subclass', id: 'scholar', name: 'Scholar',
      automation: automationCapabilityFromLegacyStatus('full'), payload: {
        schemaVersion: 1, id: 'scholar', name: 'Scholar', classId: 'fighter', summary: 'Synthetic permanent training',
        abilities: [{ schemaVersion: 1, id: 'guard', name: 'Guard', description: 'Synthetic passive fixture', level: 3,
          trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'passive-defense', savingThrowAdvantageAgainstConditions: ['poisoned'] } }],
        advancements: [{ schemaVersion: 1, id: 'training', level: 3, kind: 'select', label: 'Training', count: 1,
          options: (['wis', 'int', 'cha'] as const).map(ability => ({ id: ability, label: ability,
            requiresSavingThrowProficiency: [{ ability: 'wis', proficient: ability !== 'wis' }],
            grants: [{ kind: 'proficiency', category: 'saving-throw', id: ability }],
          })) }],
      } }],
  }
  let archive = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(archive)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      for (const already of [false, true]) {
        const original = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '战士', level: 2,
          abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          savingThrows: already ? ['str', 'con', 'wis'] : ['str', 'con'],
          dnd5eClassLevels: { fighter: 2 }, dnd5eClassChoices: { fighter: { fightingStyles: ['defense'] } },
          maxHp: 30, currentHp: 30, hitDice: '2d10' })
        const before = structuredClone(original)
        for (const selected of ['wis', 'int', 'cha'] as const) {
          const decision = { schemaVersion: 1 as const, classId: 'fighter' as const, subclassId, levelsGained: 1,
            hitPointMethod: 'fixed' as const, hitPointRolls: [], asiChoices: [],
            contentChoiceSelections: { [`${subclassId}:level-3`]: { training: [selected] } } }
          const result = applyDnd5eLevelAdvancement(original, decision)
          expect(result.ok, JSON.stringify(result)).toBe(already ? selected !== 'wis' : selected === 'wis')
          if (!result.ok) {
            expect(result.reason).toBe('invalid-content-choice')
            continue
          }
          const saved = JSON.parse(JSON.stringify(result.character))
          const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved), controller: 'player',
            initiativeD20: 10, position: { x: 0, y: 0 } })
          expect(actor.savingThrowProficiencies).toContain(selected)
          expect(actor.savingThrowBonuses[selected]).toBe(actor.proficiencyBonus)
          const revised = reviseDnd5eLevelAdvancement(saved, result.record.id, decision)
          expect(revised.ok, JSON.stringify(revised)).toBe(true)
          if (revised.ok) expect(revised.character.savingThrows).toEqual(result.character.savingThrows)
        }
        expect(original).toEqual(before)
      }
    } finally { dispose() }
    archive = await exportDnd5eStarMod(decoded.bundle)
  }
})
