export const DND5E_PLUGIN_KIND_SCHEMA_VERSION = 1 as const

export type Dnd5ePluginKind = 'content-package' | 'automation-plugin'
export type Dnd5ePluginArtifactSource = 'content-v2' | 'unified-v1' | 'declarative-v1' | 'worker-module'

export interface Dnd5ePluginTrustProfile {
  schemaVersion: typeof DND5E_PLUGIN_KIND_SCHEMA_VERSION
  kind: Dnd5ePluginKind
  executesImportedCode: boolean
  requiresWorkerSandbox: boolean
  hostCompilesDeclarativeData: boolean
}

function inferredKind(source: Dnd5ePluginArtifactSource): Dnd5ePluginKind {
  return source === 'worker-module' ? 'automation-plugin' : 'content-package'
}

/**
 * Resolves legacy packages without weakening the trust boundary. The artifact
 * parser is authoritative: JSON declarations are content packages and module
 * bundles are automation plugins. A contradictory explicit declaration fails
 * closed instead of silently changing how the bytes are executed.
 */
export function resolveDnd5ePluginKind(
  declaredKind: Dnd5ePluginKind | undefined,
  source: Dnd5ePluginArtifactSource,
): Dnd5ePluginKind {
  const inferred = inferredKind(source)
  if (declaredKind != null && declaredKind !== inferred) {
    throw new Error(`Plugin kind ${declaredKind} does not match artifact source ${source}`)
  }
  return declaredKind ?? inferred
}

export function dnd5ePluginTrustProfile(
  declaredKind: Dnd5ePluginKind | undefined,
  source: Dnd5ePluginArtifactSource,
): Dnd5ePluginTrustProfile {
  const kind = resolveDnd5ePluginKind(declaredKind, source)
  const automation = kind === 'automation-plugin'
  return {
    schemaVersion: DND5E_PLUGIN_KIND_SCHEMA_VERSION,
    kind,
    executesImportedCode: automation,
    requiresWorkerSandbox: automation,
    hostCompilesDeclarativeData: !automation,
  }
}
