import type { Dnd5eInventoryItemTemplate } from '../../../types/inventory'
import type {
  DeclarativeSubclassAbilityV1,
  DeclarativeSubclassCombatHookV1,
  DeclarativeSubclassResourceDieV1,
  DeclarativeSubclassSpellcastingV1,
  DeclarativeValueFormulaV1,
} from '../declarativeSubclassAbility'
import type { Dnd5eMonsterStatBlock } from '../monsters'
import type { Dnd5eImportedSpell } from '../spellbook'
import type {
  Dnd5ePluginAbilityGenerationDefinition,
  Dnd5ePluginBackgroundDefinition,
  Dnd5ePluginFeatDefinition,
  Dnd5ePluginFeatureAction,
  Dnd5ePluginFeatureDefinition,
  Dnd5ePluginItemDefinition,
  Dnd5ePluginRaceDefinition,
  Dnd5ePluginResourceDefinition,
  Dnd5ePluginSubclassDefinition,
  Dnd5ePluginSubclassFeature,
} from '../pluginApi'

interface PluginOwnership {
  ownerPluginId: string
  ownerPluginName: string
  ownerPluginLicense: string
}

export interface RegisteredDnd5ePluginFeature
  extends Omit<Dnd5ePluginFeatureDefinition, 'id' | 'action'>, PluginOwnership {
  id: string
  action?: Dnd5ePluginFeatureAction
  declarativeAbility?: DeclarativeSubclassAbilityV1
  automationReasons?: readonly string[]
}

export interface RegisteredDnd5ePluginResource
  extends Omit<Dnd5ePluginResourceDefinition, 'id' | 'subclassId'>, PluginOwnership {
  id: string
  subclassId?: string
  declarativeMaximum?: DeclarativeValueFormulaV1
  declarativeDie?: DeclarativeSubclassResourceDieV1
}

export interface RegisteredDnd5ePluginSubclass
  extends Omit<Dnd5ePluginSubclassDefinition, 'id' | 'features'>, PluginOwnership {
  id: string
  features: readonly (Dnd5ePluginSubclassFeature & { id: string; featureId: string })[]
  declarativeSpellcasting?: DeclarativeSubclassSpellcastingV1
  declarativeCombatHooks?: readonly DeclarativeSubclassCombatHookV1[]
}

export interface RegisteredDnd5ePluginRace
  extends Omit<Dnd5ePluginRaceDefinition, 'id'>, PluginOwnership {
  id: string
}

export interface RegisteredDnd5ePluginFeat
  extends Omit<Dnd5ePluginFeatDefinition, 'id' | 'action'>, PluginOwnership {
  id: string
  featureId: string
  action?: Dnd5ePluginFeatureAction
}

export interface RegisteredDnd5ePluginBackground
  extends Omit<Dnd5ePluginBackgroundDefinition, 'id'>, PluginOwnership {
  id: string
}

type WithPluginOwnership<T extends { id: string }> = T extends unknown
  ? Omit<T, 'id'> & PluginOwnership & { id: string }
  : never

export type RegisteredDnd5ePluginAbilityGeneration =
  WithPluginOwnership<Dnd5ePluginAbilityGenerationDefinition>

export interface RegisteredDnd5ePluginSpell
  extends Omit<Dnd5eImportedSpell, 'automation'>, PluginOwnership {
  iconAssetId?: string
  automation:
    | { mode: 'reference-only' }
    | { mode: 'headless-action'; actionId: string }
}

export interface RegisteredDnd5ePluginItem
  extends Dnd5eInventoryItemTemplate, PluginOwnership {}

export type RegisteredDnd5ePluginMonster = Dnd5eMonsterStatBlock & PluginOwnership

// Keep this import referenced while the item protocol remains hosted by pluginApi.
export type Dnd5eRegisteredPluginItemSource = Dnd5ePluginItemDefinition
