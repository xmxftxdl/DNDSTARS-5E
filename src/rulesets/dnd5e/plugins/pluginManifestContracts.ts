export const DND5E_RULES_PLUGIN_API_VERSION = 2 as const
export const DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS = [1, 2] as const
export const DND5E_RULES_PLUGIN_RULESET_ID = 'dnd5e-2014-srd-5.1' as const
export const DND5E_POST_D20_ADJUSTMENT_ROLL_ID = 'post-d20-adjustment' as const

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type Dnd5eRulesPluginApiVersion = typeof DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS[number]
export type Dnd5ePluginDistributionPolicy =
  | 'room-distributable'
  | 'room-ephemeral'
  | 'account-entitled'
  | 'local-only'
export type Dnd5ePluginKind = 'content-package' | 'automation-plugin'
export type Dnd5ePluginContentCategory =
  | 'rules'
  | 'classes'
  | 'subclasses'
  | 'feats'
  | 'spells'
  | 'items'
  | 'monsters'
  | 'adventure'
  | 'mixed'
export type Dnd5ePluginDeclaredCapability =
  | 'damage'
  | 'healing'
  | 'temporary-hit-points'
  | 'standard-condition'
  | 'movement'
  | 'resource'
  | 'summon'
  | 'persistent-area'
  | 'spell-transaction'
  | 'interrupt'

export interface Dnd5ePluginDependency {
  id: string
  versionRange: string
  optional?: boolean
}

export interface Dnd5eRulesPluginManifest {
  id: string
  name: string
  version: string
  apiVersion: Dnd5eRulesPluginApiVersion
  rulesetId: typeof DND5E_RULES_PLUGIN_RULESET_ID
  publisher: string
  description?: string
  homepage?: string
  license: string
  pluginKind?: Dnd5ePluginKind
  stateSchemaVersion?: number
  manifestSchemaVersion?: 1
  minimumGameProtocolVersion?: number
  dependencies?: readonly Dnd5ePluginDependency[]
  conflicts?: readonly string[]
  declaredCapabilities?: readonly Dnd5ePluginDeclaredCapability[]
  distributionPolicy?: Dnd5ePluginDistributionPolicy
  contentCategory?: Dnd5ePluginContentCategory
}

export interface Dnd5eRulesPluginStateMigration {
  fromVersion: number
  toVersion: number
  migrate(state: JsonValue): JsonValue | Promise<JsonValue>
}

export interface Dnd5eRulesPluginRequirement {
  id: string
  version: string
  stateSchemaVersion?: number
  integrity?: string
}
