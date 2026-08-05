import type {
  Dnd5eRulesPlugin,
  Dnd5ePluginFeatureDefinition,
  Dnd5ePluginFeatDefinition,
  Dnd5ePluginResourceDefinition,
  Dnd5ePluginRaceDefinition,
  Dnd5ePluginBackgroundDefinition,
  Dnd5ePluginAbilityGenerationDefinition,
} from '../pluginApi'
import type {
  RegisteredDnd5ePluginAbilityGeneration,
  RegisteredDnd5ePluginBackground,
  RegisteredDnd5ePluginFeat,
  RegisteredDnd5ePluginFeature,
  RegisteredDnd5ePluginItem,
  RegisteredDnd5ePluginMonster,
  RegisteredDnd5ePluginRace,
  RegisteredDnd5ePluginResource,
  RegisteredDnd5ePluginSpell,
} from './pluginRegistryContracts'
import type { Dnd5ePluginHeadlessActionDefinition } from './pluginHeadlessContracts'

export interface RegisteredDnd5ePluginRuntime {
  plugin: Dnd5eRulesPlugin
  integrity?: string
  dispose(): void
}

export interface OwnedDnd5eHeadlessAction {
  pluginId: string
  definition: Dnd5ePluginHeadlessActionDefinition
}

/** Mutable Host registry. UI receives cloned projections, never these maps. */
export const dnd5ePluginRegistryStore = {
  plugins: new Map<string, RegisteredDnd5ePluginRuntime>(),
  headlessActions: new Map<string, OwnedDnd5eHeadlessAction>(),
  features: new Map<string, RegisteredDnd5ePluginFeature>(),
  feats: new Map<string, RegisteredDnd5ePluginFeat>(),
  resources: new Map<string, RegisteredDnd5ePluginResource>(),
  races: new Map<string, RegisteredDnd5ePluginRace>(),
  backgrounds: new Map<string, RegisteredDnd5ePluginBackground>(),
  abilityGenerationMethods: new Map<string, RegisteredDnd5ePluginAbilityGeneration>(),
  spells: new Map<string, RegisteredDnd5ePluginSpell>(),
  items: new Map<string, RegisteredDnd5ePluginItem>(),
  monsters: new Map<string, RegisteredDnd5ePluginMonster>(),
  listeners: new Set<() => void>(),
  revision: 0,
}

// Keep these declarations referenced during incremental protocol migration.
export type Dnd5ePluginRegistryContribution =
  | Dnd5ePluginFeatureDefinition
  | Dnd5ePluginFeatDefinition
  | Dnd5ePluginResourceDefinition
  | Dnd5ePluginRaceDefinition
  | Dnd5ePluginBackgroundDefinition
  | Dnd5ePluginAbilityGenerationDefinition
