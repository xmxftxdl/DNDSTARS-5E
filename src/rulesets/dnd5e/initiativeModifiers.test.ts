import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { cloneStaticCombatModifiers, registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eStoredCharacterInitiativeModifier, resolveDnd5eInitiative } from './checks'
import { createCombatantFromDnd5eCharacter, dnd5eInitiativeModifier, migrateCharacterToDnd5e } from './character'
import { validateDnd5eUnifiedContentBundleV1 } from './unifiedContent'

it.each(['int', 'wis', 'cha'] as const)('imports dynamic %s initiative and updates sheet, map roll and combat snapshot', async ability => {
  const namespace = 'test.initiative-ability'
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Initiative', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'ready', name: 'Ready',
      automation: automationCapabilityFromLegacyStatus('full'),
      payload: { id: 'ready', name: 'Ready', summary: 'Synthetic', description: 'Synthetic', automation: 'full', classRequirements: [{ classId: 'wizard', minimumLevel: 2 }] },
      effects: [{ schemaVersion: 1, id: 'ready-passive', name: 'Ready', duration: { kind: 'permanent' }, stacking: 'unique-by-source',
        modifiers: [{ kind: 'character-capability', capability: 'initiativeBonusFromAbility', value: ability },
          { kind: 'character-capability', capability: 'initiativeBonus', value: 5 }] }],
    }] }
  const invalid = structuredClone(bundle)
  Object.assign(invalid.definitions[0]!.effects![0]!.modifiers![0]!, { value: 'intelligence' })
  expect(validateDnd5eUnifiedContentBundleV1(invalid).length).toBeGreaterThan(0)
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const roundtrip = await readDnd5eStarMod(await exportDnd5eStarMod(decoded.bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(roundtrip.bundle))
  try {
    for (const score of [8, 14, 20]) {
      const hero = normalizeCharacter({ id: 'hero', charClass: '法师', level: 2, rulesetId: 'dnd5e-2014-srd-5.1',
        dnd5eClassLevels: { wizard: 2 }, initiativeBonus: 3, dnd5ePluginFeatureIds: [`${namespace}:ready`],
        abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10, [ability]: score } })
      const restored = JSON.parse(JSON.stringify(hero))
      const before = structuredClone(restored)
      const expected = 2 + 3 + 5 + Math.floor((score - 10) / 2)
      expect(dnd5eStoredCharacterInitiativeModifier(restored)).toBe(expected)
      expect(resolveDnd5eInitiative({ character: restored, rolls: [10] }).roll.total).toBe(10 + expected)
      const snapshot = migrateCharacterToDnd5e(restored)
      expect(dnd5eInitiativeModifier(snapshot)).toBe(expected)
      expect(createCombatantFromDnd5eCharacter({ character: snapshot, controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 } }).initiative).toBe(10 + expected)
      expect(dnd5eStoredCharacterInitiativeModifier({ ...restored, dnd5ePluginFeatureIds: [] })).toBe(5)
      expect(dnd5eStoredCharacterInitiativeModifier({ ...restored, level: 1, dnd5eClassLevels: { wizard: 1 } })).toBe(5)
      const reduced = { ...restored, dnd5eCombatState: { schemaVersion: 2, abilityScoreReductionLedger: [{ id: 'reduction', ability, amount: 2, recovery: 'restoration-magic' }] } }
      expect(dnd5eStoredCharacterInitiativeModifier(reduced)).toBe(expected - 1)
      expect(dnd5eInitiativeModifier(migrateCharacterToDnd5e(reduced))).toBe(expected - 1)
      expect(restored).toEqual(before)
    }
  } finally { dispose() }
})

it.each(['intelligence', 'INT', 3, true, {}, []])('rejects invalid dynamic initiative ability %j', value => {
  expect(() => cloneStaticCombatModifiers({ initiativeBonusFromAbility: value } as never, 'test')).toThrow('initiativeBonusFromAbility')
})
