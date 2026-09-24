import { PACKAGE_ID, isPackageVersion, safePackagePath, type ContentSourceCategory } from './packageManifest'

export const COMPENDIUM_ENTRY_TYPES = ['Class', 'Subclass', 'Species', 'Background', 'Feat', 'Spell', 'Item', 'Monster', 'Condition', 'Feature', 'MonsterAction', 'AbilityGeneration'] as const
export type CompendiumEntryType = typeof COMPENDIUM_ENTRY_TYPES[number]
export interface CompendiumEntry {
  id: string
  type: CompendiumEntryType
  systemId: string
  sourcePackageId: string
  sourceEntryId: string
  version: string
  localizationKey: string
  tags: readonly string[]
  rulesData: unknown
  automationFile?: string
  automationData?: { activities?: readonly unknown[]; effects?: readonly unknown[]; advancements?: readonly unknown[]; capability?: unknown }
  assetReferences: readonly string[]
}
export interface EntryProvenance {
  sourcePackageId: string
  sourceEntryId: string
  sourceCategory: ContentSourceCategory
  license: string
  packageVersion: string
  importedAt: string
}
export function validateCompendiumEntries(value: unknown, packageId: string): asserts value is CompendiumEntry[] {
  if (!Array.isArray(value) || value.length > 2048) throw new Error('compendium-invalid: 条目必须为有界列表')
  const identities = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !PACKAGE_ID.test(entry.id) ||
      !(COMPENDIUM_ENTRY_TYPES as readonly unknown[]).includes(entry.type) || entry.sourcePackageId !== packageId ||
      typeof entry.sourceEntryId !== 'string' || !PACKAGE_ID.test(entry.sourceEntryId) || !isPackageVersion(entry.version) ||
      typeof entry.systemId !== 'string' || !PACKAGE_ID.test(entry.systemId) ||
      typeof entry.localizationKey !== 'string' || !PACKAGE_ID.test(entry.localizationKey) ||
      !Array.isArray(entry.tags) || entry.tags.length > 64 || entry.tags.some((tag: unknown) => typeof tag !== 'string' || tag.length > 128) ||
      !Array.isArray(entry.assetReferences) || entry.assetReferences.some((path: unknown) => typeof path !== 'string' || !safePackagePath(path) || !path.startsWith('assets/')) ||
      !entry.rulesData || typeof entry.rulesData !== 'object' || Array.isArray(entry.rulesData)) throw new Error('compendium-entry-invalid')
    const key = `${entry.type}:${entry.id}`
    if (identities.has(key)) throw new Error(`compendium-entry-duplicate: ${key}`)
    identities.add(key)
    if (entry.automationFile != null && (typeof entry.automationFile !== 'string' || !/^automation\/[a-z0-9._-]+\.json$/.test(entry.automationFile) || !safePackagePath(entry.automationFile) || entry.automationData != null)) throw new Error('automation-reference-invalid')
    if (entry.automationData != null) {
      if (typeof entry.automationData !== 'object' || Array.isArray(entry.automationData)) throw new Error('automation-invalid')
      for (const field of ['activities', 'effects', 'advancements']) {
        const list = entry.automationData[field]
        if (list != null && (!Array.isArray(list) || list.length > 256)) throw new Error('automation-invalid')
      }
    }
  }
}
export function localizeEntry(entry: CompendiumEntry, dictionaries: Readonly<Record<string, Readonly<Record<string, string>>>>, locale: string) {
  const read = (suffix: string) => dictionaries[locale]?.[`${entry.localizationKey}.${suffix}`] ??
    dictionaries['zh-CN']?.[`${entry.localizationKey}.${suffix}`] ?? dictionaries['en-US']?.[`${entry.localizationKey}.${suffix}`]
  return { name: read('name') ?? entry.id, description: read('description') ?? '' }
}
/** Overrides are separate immutable snapshots; package updates cannot silently erase edits. */
export interface CompendiumOverride {
  packageId: string
  entryId: string
  entryType: CompendiumEntryType
  baseVersion: string
  value: CompendiumEntry
}
export function resolveCompendiumEntry(base: CompendiumEntry, override?: CompendiumOverride) {
  if (!override) return { entry: structuredClone(base), conflict: false }
  if (override.packageId !== base.sourcePackageId || override.entryId !== base.id || override.entryType !== base.type ||
    override.value.id !== base.id || override.value.sourcePackageId !== base.sourcePackageId || override.value.type !== base.type) throw new Error('override-identity-mismatch')
  validateCompendiumEntries([override.value], base.sourcePackageId)
  return { entry: structuredClone(override.value), conflict: override.baseVersion !== base.version }
}
