import { describe, expect, it } from 'vitest'
import { exportDnd5eStarMod, readDnd5eStarMod, assertStarModDependencies, legacyManifestToStarMod } from './starModAdapter'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { exportLegacyDnd5eStarMod, readLegacyDnd5eStarMod, projectDnd5eStarModRuntime } from './starModAdapter'
import { readStarModArchive, writeStarModArchive } from '../../domain/packages/starmodArchive'
import type { Dnd5eContentPackageV2 } from './contentPackageV2'

function fixture(): Dnd5eUnifiedContentBundleV1 {
  return { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [], manifest: {
    id: 'community.test', name: 'Test', publisher: 'Test', license: 'CC0-1.0', version: '1.0.0',
    apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', pluginKind: 'content-package', distributionPolicy: 'local-only',
  }, definitions: [{ schemaVersion: 1, id: 'sample', namespace: 'community.test', version: '1.0.0', kind: 'feature',
    name: '示例', description: '测试内容', payload: { id: 'sample', name: '示例', summary: '测试内容', description: '测试内容', automation: 'manual' },
    automation: automationCapabilityFromLegacyStatus('manual'),
  }] }
}
describe('starmod D&D runtime adapter', () => {
  it('preserves V2 bindings, assets and provenance exactly, and rejects mismatched previews', async () => {
    const original: Dnd5eContentPackageV2 = {format:'dndstars5e-content',schemaVersion:2,manifest:fixture().manifest,
      provenance:{edition:'2014',contentMode:'incremental',sourceTitle:'Test'},assets:[],content:{
        races:[],backgrounds:[],features:[{id:'sample',name:'示例',summary:'测试内容',description:'测试内容',automation:'manual'}],
        feats:[],spells:[],items:[],abilityGenerationMethods:[],headlessActions:[],subclasses:[],classes:[],monsters:[],activities:[],
      }}
    const bytes = await exportLegacyDnd5eStarMod(original)
    expect((await readLegacyDnd5eStarMod(bytes))?.package).toEqual(original)
    expect(JSON.parse(new TextDecoder().decode(await projectDnd5eStarModRuntime(bytes)))).toEqual(original)
    const altered = await readStarModArchive(bytes)
    altered.entries = altered.entries.map(e => ({...e,rulesData:{id:'hidden-change'}}))
    await expect(readLegacyDnd5eStarMod(await writeStarModArchive(altered))).rejects.toThrow('projection-mismatch')
  })
  it('imports a real exported archive through the existing runtime compiler without changing IDs', async () => {
    const original = fixture()
    const { bundle } = await readDnd5eStarMod(await exportDnd5eStarMod(original))
    expect(bundle.definitions[0].payload).toEqual(original.definitions[0].payload)
    expect(bundle.definitions[0].id).toBe('sample')
    expect(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle).manifest.id).toBe(original.manifest.id)
  })
  it('does not weaken legacy exact or upper-bounded dependency ranges during export', () => {
    const m = fixture().manifest
    const manifest = legacyManifestToStarMod({ ...m, dependencies: [{ id: 'base', versionRange: '^1.0.0' }] })
    expect(manifest.dependencies[0].versionRange).toBe('^1.0.0')
    expect(() => assertStarModDependencies(manifest,[{...m,id:'base',version:'2.0.0'}])).toThrow('dependency-unavailable')
  })
  it('checks runtime dependencies before enabling the package', () => {
    const manifest = legacyManifestToStarMod(fixture().manifest)
    manifest.dependencies = [{ packageId: 'base', minimumVersion: '1.0.0' }]
    expect(() => assertStarModDependencies(manifest, [])).toThrow('dependency-unavailable')
    expect(() => assertStarModDependencies(manifest, [{ ...fixture().manifest, id: 'base' }])).not.toThrow()
  })
})
