import type { Dnd5eRulesPluginHost, InstalledDnd5eRulesPlugin } from '../rulesets/dnd5e/pluginLoader'
import type {
  Dnd5eContentAutomationCoverageReportV2,
  Dnd5eContentPackageSummaryV2,
} from '../rulesets/dnd5e/contentPackageV2'

export interface ActiveExtensionDetails {
  summary?: Dnd5eContentPackageSummaryV2
  coverage?: Dnd5eContentAutomationCoverageReportV2
}

type DetailsHost = Pick<Dnd5eRulesPluginHost, 'readBytes' | 'inspectFile'>
const detailsByHost = new WeakMap<DetailsHost, Map<string, Promise<ActiveExtensionDetails>>>()

/** Exact package pins are immutable. Share reads across remounts and concurrent effects. */
export function loadActiveExtensionDetails(
  host: DetailsHost,
  manifest: { id: string; version: string },
  installed: InstalledDnd5eRulesPlugin,
): Promise<ActiveExtensionDetails> {
  let cache = detailsByHost.get(host)
  if (!cache) {
    cache = new Map()
    detailsByHost.set(host, cache)
  }
  const key = JSON.stringify([manifest.id, manifest.version, installed.integrity])
  const cached = cache.get(key)
  if (cached) return cached
  const pending = (async () => {
    const bytes = await host.readBytes(manifest.id)
    const inspected = await host.inspectFile(new File(
      [new Uint8Array(bytes)],
      installed.source === 'url' ? `${manifest.id}.dndstars5e` : installed.fileName,
      { type: 'application/json' },
    ))
    return { summary: inspected.contentSummary, coverage: inspected.automationCoverage }
  })().catch((error) => {
    // A transient read/inspection failure must remain retryable.
    if (cache.get(key) === pending) cache.delete(key)
    throw error
  })
  cache.set(key, pending)
  if (cache.size > 16) cache.delete(cache.keys().next().value!)
  return pending
}
