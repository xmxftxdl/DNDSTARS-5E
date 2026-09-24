import { assertPackageManifest } from './packageManifest'
import { validateCompendiumEntries, type CompendiumEntry, type EntryProvenance } from './compendium'
import type { StarModPackage } from './starmodArchive'

/** Runtime index only. Durable bytes and rollback remain owned by the package host. */
export class PackageRegistry {
  private readonly packages = new Map<string, { value: StarModPackage; importedAt: string }>()
  register(value: StarModPackage): () => void {
    assertPackageManifest(value.manifest)
    validateCompendiumEntries(value.entries, value.manifest.packageId)
    const id = value.manifest.packageId
    if (this.packages.has(id)) throw new Error(`package-duplicate: ${id}`)
    const record = { value: structuredClone(value), importedAt: new Date().toISOString() }
    this.packages.set(id, record)
    return () => { if (this.packages.get(id) === record) this.packages.delete(id) }
  }
  list() { return [...this.packages.values()].map(p => structuredClone(p.value.manifest)) }
  entries(packageId: string): readonly CompendiumEntry[] { return structuredClone(this.packages.get(packageId)?.value.entries ?? []) }
  provenance(packageId: string, entryId: string): EntryProvenance | undefined {
    const record = this.packages.get(packageId)
    const entry = record?.value.entries.find(e => e.id === entryId)
    if (!record || !entry) return undefined
    return { sourcePackageId: entry.sourcePackageId, sourceEntryId: entry.sourceEntryId,
      sourceCategory: record.value.manifest.contentSource, license: record.value.manifest.license,
      packageVersion: record.value.manifest.version, importedAt: record.importedAt }
  }
}
export const communityPackageRegistry = new PackageRegistry()
