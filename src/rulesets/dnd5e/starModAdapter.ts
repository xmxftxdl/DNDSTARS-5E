import { dnd5eActivitiesWithConditionReferences } from './activities/dnd5eConditionReferences'
import builtInManifest from '../../content/srd-5.1/manifest.json'
import { dnd5eContentDefinitionsFromPackageV2 } from './activities/dnd5eContentDefinitionProjection'
import { parseDnd5eContentPackageV2, type Dnd5eContentPackageV2 } from './contentPackageV2'
import appPackage from '../../../package.json'
import { assertPackageManifest, type StarScarPackageManifest } from '../../domain/packages/packageManifest'
import { localizeEntry, type CompendiumEntryType } from '../../domain/packages/compendium'
import { readStarModArchive, writeStarModArchive, isStarModArchive, type StarModPackage } from '../../domain/packages/starmodArchive'
import type { Dnd5eRulesPluginManifest } from './plugins/pluginManifestContracts'
import { parseDnd5eUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import type { ContentDefinitionKind } from '../../domain/content/contentDefinition'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { comparePackageVersions, packageVersionSatisfies, validPackageVersionRange } from '../../domain/packages/packageManifest'

const KIND_MAP: Partial<Record<CompendiumEntryType, ContentDefinitionKind>> = {
  Condition: 'condition', Class: 'class', Subclass: 'subclass', Species: 'race', Background: 'background', Feat: 'feat',
  Spell: 'spell', Item: 'item', Monster: 'monster', Feature: 'feature', MonsterAction: 'monster-action', AbilityGeneration: 'ability-generation',
}
export function legacyManifestToStarMod(manifest: Dnd5eRulesPluginManifest): StarScarPackageManifest {
  return {
    schemaVersion: 1, packageId: manifest.id, name: manifest.name, author: manifest.publisher,
    version: manifest.version, minimumStarScarVersion: appPackage.version,
    systemId: 'dnd5e', systemVersion: '2014', contentSource: 'UserPrivate', license: manifest.license,
    homepage: manifest.homepage, description: manifest.description,
    dependencies: (manifest.dependencies ?? []).map(d => {
      if (!validPackageVersionRange(d.versionRange)) throw new Error(`依赖范围 ${d.versionRange} 无法无损转换；需要完整语义版本。`)
      return { packageId:d.id, minimumVersion:'0.0.0-0', versionRange:d.versionRange, optional:d.optional }
    }),
    permissions: ['compendium.write', 'automation.register'], localizations: ['zh-CN'],
    distributionPolicy: manifest.distributionPolicy ?? 'local-only',
  }
}
export async function readDnd5eStarMod(bytes: ArrayBuffer): Promise<{ bundle: Dnd5eUnifiedContentBundleV1; manifest: StarScarPackageManifest }> {
  const pkg = await readStarModArchive(bytes)
  const { manifest } = pkg
  if(manifest.packageId === builtInManifest.packageId) throw new Error('package-id-reserved')
  assertPackageManifest(manifest, { appVersion: appPackage.version, systemId: 'dnd5e', systemVersion: '2014',
    // Dependency availability is checked immediately before activation, not while inspecting a file.
    checkDependencies: false,
  })
  if (manifest.contentSource === 'RestrictedLicensed' || manifest.distributionPolicy === 'account-entitled') throw new Error('此内容包需要授权提供方；当前适配器不能验证授权。')
  if (manifest.permissions.some(p => !['compendium.read', 'compendium.write', 'automation.register', ...(manifest.script ? ['automation.script'] : [])].includes(p))) throw new Error('声明式内容包不能申请网络、脚本、角色写入或文件系统权限。')
  if (pkg.entries.length && !manifest.permissions.includes('compendium.write')) throw new Error('permission-missing: compendium.write')
  if (pkg.entries.some(e => e.automationData?.activities?.length || e.automationData?.effects?.length || e.automationData?.advancements?.length) && !manifest.permissions.includes('automation.register')) throw new Error('permission-missing: automation.register')
  if (pkg.compatibility != null) throw new Error('starmod-legacy-adapter-required')
  const assets = Object.entries(pkg.assets).map(([path, bytes]) => {
    const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '')
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return { id, mediaType: path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg', dataBase64: btoa(binary) }
  })
  const candidate = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: {
      id: manifest.packageId, name: manifest.name, version: manifest.version, publisher: manifest.author,
      license: manifest.license, description: manifest.description, homepage: manifest.homepage,
      apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', pluginKind: 'content-package',
      ...(manifest.script?.stateSchemaVersion ? {stateSchemaVersion:manifest.script.stateSchemaVersion} : {}),
      dependencies: manifest.dependencies.map(d => ({ id: d.packageId, versionRange: d.versionRange ?? `>=${d.minimumVersion}`, optional: d.optional })),
      distributionPolicy: manifest.distributionPolicy ?? 'local-only',
    }, assets,
    definitions: pkg.entries.map(entry => {
      const kind = KIND_MAP[entry.type]
      if (!kind) throw new Error(`当前 D&D 适配器尚不支持独立条目类型：${entry.type}`)
      if (entry.systemId !== 'dnd5e') throw new Error('entry-system-incompatible')
      const text = localizeEntry(entry, pkg.localizations, 'zh-CN')
      const payload = structuredClone(entry.rulesData) as Record<string, unknown>
      return { schemaVersion: 1, id: entry.id, namespace: manifest.packageId, version: manifest.version,
        kind, ...text, tags: entry.tags, source: { packageId: manifest.packageId, packageVersion: manifest.version, contentVersion: entry.version },
        payload: { ...payload, ...(kind !== 'monster-action' ? {name:text.name} : {}), ...('description' in payload || ['spell','feature','feat'].includes(kind) ? {description:text.description} : {}) },
        activities: dnd5eActivitiesWithConditionReferences(pkg,entry.id,entry.type), effects: entry.automationData?.effects,
        advancements: entry.automationData?.advancements,
        automation: entry.automationData?.capability ?? automationCapabilityFromLegacyStatus('manual', ['未声明结构化自动化']),
      }
    }),
  }
  const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify(candidate))
  if (!bundle) throw new Error('starmod-dnd5e-conversion-failed')
  return { bundle, manifest }
}
export function assertStarModDependencies(manifest: StarScarPackageManifest, active: readonly Dnd5eRulesPluginManifest[]): void {
  const builtIn: Dnd5eRulesPluginManifest = {id:builtInManifest.packageId,name:builtInManifest.name,version:builtInManifest.version,publisher:builtInManifest.author,license:builtInManifest.license,apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1'}
  const installed = new Map([builtIn,...active].map(m => [m.id, m]))
  for (const d of manifest.dependencies) {
    const value = installed.get(d.packageId)
    if (!value && d.optional) continue
    if (!value || comparePackageVersions(value.version, d.minimumVersion) < 0 || (d.versionRange && !packageVersionSatisfies(value.version,d.versionRange))) throw new Error(`dependency-unavailable: ${d.packageId}`)
  }
  for (const installed of active) {
    if (installed.id === manifest.packageId) continue
    for (const dependency of installed.dependencies ?? []) {
      if (dependency.id === manifest.packageId && !packageVersionSatisfies(manifest.version,dependency.versionRange)) throw new Error(`dependency-in-use: ${installed.id}`)
    }
  }
  const graph = new Map(active.map(m => [m.id, (m.dependencies ?? []).map(d => d.id)]))
  graph.set(manifest.packageId, manifest.dependencies.map(d => d.packageId))
  const visiting = new Set<string>(), visited = new Set<string>()
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error('dependency-cycle')
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of graph.get(id) ?? []) if (graph.has(dependency)) visit(dependency)
    visiting.delete(id); visited.add(id)
  }
  visit(manifest.packageId)
}
export async function exportDnd5eStarMod(bundle: Dnd5eUnifiedContentBundleV1): Promise<ArrayBuffer> {
  const manifest = legacyManifestToStarMod(bundle.manifest)
  const dictionary: Record<string, string> = {}
  const assets: Record<string, Uint8Array> = {}
  for (const asset of bundle.assets) {
    const extension = asset.mediaType === 'image/png' ? 'png' : asset.mediaType === 'image/webp' ? 'webp' : 'jpg'
    assets[`assets/icons/${asset.id}.${extension}`] = Uint8Array.from(atob(asset.dataBase64), c => c.charCodeAt(0))
  }
  const pkg: StarModPackage = { manifest, localizations: { 'zh-CN': dictionary }, assets,
    entries: bundle.definitions.map(definition => {
      const type = Object.entries(KIND_MAP).find(([, kind]) => kind === definition.kind)?.[0] as CompendiumEntryType | undefined
      if (!type) throw new Error('unsupported-export-kind')
      const key = `${definition.kind}.${definition.id}`
      dictionary[`${key}.name`] = definition.name
      dictionary[`${key}.description`] = definition.description ?? ''
      return { id: definition.id, type, systemId: 'dnd5e', sourcePackageId: manifest.packageId, sourceEntryId: definition.id,
        version: definition.version, localizationKey: key, tags: definition.tags ?? [], rulesData: definition.payload,
        automationData: { activities: definition.activities, effects: definition.effects, advancements: definition.advancements, capability: definition.automation },
        assetReferences: [],
      }
    }),
  }
  const bytes = await writeStarModArchive(pkg)
  await readDnd5eStarMod(bytes)
  return bytes
}

/** Preserve V2-only action bindings while exposing the same content in the neutral compendium. */
export function legacyPackageCompendium(value: Dnd5eContentPackageV2): StarModPackage {
 const manifest = legacyManifestToStarMod(value.manifest)
 const dictionary: Record<string, string> = {}
 const entries = dnd5eContentDefinitionsFromPackageV2(value).map(d => {
  const type = Object.entries(KIND_MAP).find(([, kind]) => kind === d.kind)![0] as CompendiumEntryType
  dictionary[`${d.id}.name`] = d.name
  dictionary[`${d.id}.description`] = d.description ?? ''
  return { id:d.id, type, systemId:'dnd5e', sourcePackageId:manifest.packageId, sourceEntryId:d.id,
   version:d.version, localizationKey:d.id, tags:d.tags ?? [], rulesData:d.payload,
   automationData:{activities:d.activities,effects:d.effects,advancements:d.advancements,capability:d.automation}, assetReferences:[] }
 })
 return {manifest,entries,localizations:{'zh-CN':dictionary},assets:{},compatibility:value}
}
export async function exportLegacyDnd5eStarMod(value: Dnd5eContentPackageV2): Promise<ArrayBuffer> {
 const bytes = await writeStarModArchive(legacyPackageCompendium(value))
 await readLegacyDnd5eStarMod(bytes)
 return bytes
}
export async function readLegacyDnd5eStarMod(bytes: ArrayBuffer): Promise<{package:Dnd5eContentPackageV2;manifest:StarScarPackageManifest} | undefined> {
 const neutral = await readStarModArchive(bytes)
 if (neutral.compatibility == null) return undefined
 if(neutral.manifest.packageId === builtInManifest.packageId) throw new Error('package-id-reserved')
 const value = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(neutral.compatibility)).buffer)
 if (!value) throw new Error('starmod-legacy-invalid')
 const projected = legacyPackageCompendium(value)
 const manifest = {...neutral.manifest}
 delete manifest.files
 // A compatibility payload cannot hide different content or distribution permissions behind its preview.
 if (canonical(projected.manifest) !== canonical(manifest) ||
     canonical(projected.entries) !== canonical(neutral.entries) ||
     canonical(projected.localizations) !== canonical(neutral.localizations) || Object.keys(neutral.assets).length) throw new Error('starmod-legacy-projection-mismatch')
 assertPackageManifest(neutral.manifest,{appVersion:appPackage.version,systemId:'dnd5e',systemVersion:'2014',checkDependencies:false})
 return {package:value,manifest:neutral.manifest}
}

/** Rooms pin the validated runtime projection, so every client executes identical bytes. */
export async function projectDnd5eStarModRuntime(bytes: ArrayBuffer): Promise<ArrayBuffer> {
 const legacy = await readLegacyDnd5eStarMod(bytes)
 if (legacy) return new TextEncoder().encode(JSON.stringify(legacy.package)).buffer
 const neutral = await readStarModArchive(bytes)
 const {bundle} = await readDnd5eStarMod(bytes)
 if (!neutral.script) return new TextEncoder().encode(JSON.stringify(bundle)).buffer
 return new TextEncoder().encode(compileDnd5eStarModScript(neutral.script, bundle)).buffer
}

function canonical(value: unknown): string {
 return JSON.stringify(value,(_key,v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v)
}

export async function prepareDnd5eModuleUploadFile(file: File): Promise<File> {
 const bytes = await file.arrayBuffer()
 if (!isStarModArchive(bytes)) return file
 const runtime = await projectDnd5eStarModRuntime(bytes)
 const script = !!(await readStarModArchive(bytes)).script
 return new File([runtime],file.name.replace(/\.starmod$/i,script ? '.runtime.mjs' : '.runtime.json'),{type:script ? 'text/javascript' : 'application/json'})
}

/** Compose text only; execution remains exclusively inside the hardened Worker. */
export function compileDnd5eStarModScript(source: string, bundle: Dnd5eUnifiedContentBundleV1): string {
 const ending = /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/
 const match = source.match(ending)
 if (!match || /\bimport\b/.test(source)) throw new Error('script-must-be-self-contained-default-export')
 const body = source.replace(ending, `return ${match[1]}`)
 const manifest = {...bundle.manifest, pluginKind:'automation-plugin'}
 return `const extension = (() => {\n${body}\n})();
const content = ${JSON.stringify(bundle)};
const modulePlugin = {
 manifest: ${JSON.stringify(manifest)},
 migrations: extension.migrations,
 setup(api) {
  if (!extension || typeof extension.setup !== 'function') throw new Error('Script setup is required');
  if (extension.manifest && (extension.manifest.id !== content.manifest.id || extension.manifest.version !== content.manifest.version)) throw new Error('Script manifest mismatch');
  for (const definition of content.definitions) api.registerContent(definition);
  for (const asset of content.assets) api.registerImageAsset(asset);
  return extension.setup(api);
 }
};
export default modulePlugin;`
}
