import { expect, it } from 'vitest'
import ts from 'typescript'
import pageSource from '../../pages/CharactersPage?raw'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInitialSubclassBuildGrantsV1 } from './initialSubclassBuildGrants'
import { buildDnd5eCustomRulesContentPackageV2, parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { dnd5eContentDefinitionsFromPackageV2 } from './activities/dnd5eContentDefinitionProjection'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, parseDnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { exportLegacyDnd5eStarMod, projectDnd5eStarModRuntime } from './starModAdapter'
import { dnd5ePluginSubclassDefinition, registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eArmorProficiencies, dnd5eWeaponProficient, DND5E_LONGSWORD } from './equipment'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'

const ns = 'test.initial-subclass-grants', sourceId = ns + ':blade'
function source() {
  const subclass: DeclarativeSubclassDefinitionV1 = { schemaVersion: 1, id: 'blade', classId: 'warlock', name: 'Blade training', summary: 'Original first-level training',
    advancements: [{ schemaVersion: 1, id: 'training', level: 1, kind: 'build-grant', grants: [{ kind: 'proficiency', category: 'armor', id: 'medium' }, { kind: 'proficiency', category: 'armor', id: 'shield' }, { kind: 'proficiency', category: 'weapon', id: 'martial' }] }],
    abilities: [{ schemaVersion: 1, id: 'training', name: 'Training', description: 'Medium armor, shields and martial weapons', level: 1, trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'manual', passiveImplementationReferences: [{ kind: 'advancement', id: 'training' }] }] }
  const manifest = { id: ns, name: 'Initial training source', version: '1.0.0', apiVersion: 2 as const, rulesetId: 'dnd5e-2014-srd-5.1' as const, publisher: 'Tests', license: 'Private', distributionPolicy: 'local-only' as const, contentCategory: 'mixed' as const }
  const bytes = buildDnd5eCustomRulesContentPackageV2({ manifest, races: [], backgrounds: [], features: [], feats: [], spells: [], items: [], abilityGenerationMethods: [], headlessActions: [], activities: [], subclasses: [subclass], classes: [], monsters: [] })
  const pkg = parseDnd5eContentPackageV2(new TextEncoder().encode(bytes).buffer)
  if (!pkg) throw Error('Actual source required')
  return pkg
}
const hero = () => normalizeCharacter({ id: 'hero', name: 'Hero', level: 1, charClass: '邪术师', dnd5eClassLevels: { warlock: 1 }, abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 16 }, dnd5eClassChoices: { classes: { warlock: { subclass: sourceId, selections: {} } } } })
it.each(['legacy', 'unified'] as const)('initial native acquisition applies the actual %s source training without copied feature IDs', async mode => {
  const pkg = source()
  const projected = mode === 'legacy' ? parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(await exportLegacyDnd5eStarMod(pkg))) : pkg
  if (!projected) throw Error('Real standard archive roundtrip missing')
  const dispose = registerDnd5eRulesPlugin(mode === 'legacy' ? dnd5eRulesPluginFromContentPackageV2(projected) : dnd5eRulesPluginFromUnifiedContentBundleV1(parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1, manifest: pkg.manifest, definitions: dnd5eContentDefinitionsFromPackageV2(pkg).filter(definition => definition.kind === 'subclass').map(definition => ({ ...definition, id: (definition.payload as DeclarativeSubclassDefinitionV1).id })), assets: [] }))!))
  try {
    expect(dnd5ePluginSubclassDefinition(sourceId)?.advancements).toHaveLength(1)
    const before = hero()
    expect([...dnd5eArmorProficiencies(before)]).toEqual(['light'])
    const result = applyDnd5eInitialSubclassBuildGrantsV1(before)
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.reason)
    expect(dnd5eArmorProficiencies(result.character)).toEqual(new Set(['light', 'medium', 'shield']))
    expect(dnd5eWeaponProficient(result.character, DND5E_LONGSWORD)).toBe(true)
    expect(result.character.dnd5eContentChoices?.[sourceId + ':level-1'].resolvedGrants).toHaveLength(3)
    expect(result.character.dnd5ePluginFeatureIds ?? []).toEqual([])
    expect(applyDnd5eInitialSubclassBuildGrantsV1(result.character)).toEqual({ ok: true, character: result.character })
  } finally { dispose() }
})
it('initial grants require the actual selected subclass and its class at level1', () => {
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(source()))
  try {
    const first = hero()
    for (const c of [{ ...first, level: 2, dnd5eClassLevels: { warlock: 2 } }, { ...first, dnd5eClassChoices: {} }, { ...first, charClass: '法师', dnd5eClassLevels: { wizard: 1 } }]) expect(applyDnd5eInitialSubclassBuildGrantsV1(c)).toEqual({ ok: true, character: c })
  } finally { dispose() }
  const unregistered = hero(); expect(applyDnd5eInitialSubclassBuildGrantsV1(unregistered)).toEqual({ ok: true, character: unregistered })
})
it('revising initial source removes only its former subclass receipt and keeps unrelated training', () => {
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(source()))
  try {
    const built = applyDnd5eInitialSubclassBuildGrantsV1(hero()); if (!built.ok) throw Error(built.reason)
    const other = { schemaVersion: 1 as const, contentId: 'test:other-feat', selections: {}, resolvedGrants: [{ kind: 'proficiency' as const, category: 'tool' as const, id: 'thieves-tools' }] }
    const changed = { ...built.character, dnd5eClassChoices: {}, dnd5eContentChoices: { ...built.character.dnd5eContentChoices, 'test:other-feat': other } }
    const result = applyDnd5eInitialSubclassBuildGrantsV1(changed); if (!result.ok) throw Error(result.reason)
    expect(result.character.dnd5eContentChoices?.[sourceId + ':level-1']).toBeUndefined()
    expect(result.character.dnd5eContentChoices?.['test:other-feat']).toEqual(other)
    expect([...dnd5eArmorProficiencies(result.character)]).toEqual(['light'])
  } finally { dispose() }
})
it('the actual creation callback publishes the validated initial source grant result', () => {
  const tree = ts.createSourceFile('CharactersPage.tsx', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let callback: ts.Node | undefined
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'confirmCreate') callback = node.initializer; ts.forEachChild(node, visit) }; visit(tree)
  expect(callback).toBeDefined()
  const body = callback!.getText(tree)
  expect(body).toContain('applyDnd5eInitialSubclassBuildGrantsV1(normalizeCharacter({ ...initialCharacter, ...initialPatch }))')
  expect(body).toContain('update(id, initialBuild.character)')
  expect(body.indexOf('if (!initialBuild.ok)')).toBeLessThan(body.indexOf('update(id, initialBuild.character)'))
})
