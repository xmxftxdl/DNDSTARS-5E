import { assertPackageManifest } from './packageManifest'
import { validateCompendiumEntries } from './compendium'
import { readStarModArchive, type StarModPackage } from './starmodArchive'

export interface CompendiumImporter {
  id: string
  supportedExtensions: readonly string[]
  import(input: { fileName: string; bytes: ArrayBuffer; signal?: AbortSignal }): Promise<StarModPackage>
}
/** Trusted application adapters only. Untrusted package code is never evaluated here. */
export class ImporterRegistry {
  private readonly importers = new Map<string, CompendiumImporter>()
  register(importer: CompendiumImporter): () => void {
    if (this.importers.has(importer.id)) throw new Error('importer-duplicate')
    this.importers.set(importer.id, importer)
    return () => { if (this.importers.get(importer.id) === importer) this.importers.delete(importer.id) }
  }
  async preview(id: string, input: Parameters<CompendiumImporter['import']>[0]): Promise<StarModPackage> {
    const importer = this.importers.get(id)
    if (!importer) throw new Error('importer-not-found')
    input.signal?.throwIfAborted()
    if (input.bytes.byteLength > 32 * 1024 * 1024 || !importer.supportedExtensions.some(e => input.fileName.toLowerCase().endsWith(e))) throw new Error('importer-input-invalid')
    const result = await importer.import(input)
    input.signal?.throwIfAborted()
    assertPackageManifest(result.manifest)
    validateCompendiumEntries(result.entries, result.manifest.packageId)
    return structuredClone(result)
  }
}
export const compendiumImporters = new ImporterRegistry()
compendiumImporters.register({ id: 'starmod', supportedExtensions: ['.starmod'], import: input => readStarModArchive(input.bytes) })
