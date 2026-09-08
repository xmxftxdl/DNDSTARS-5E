export type Dnd5ePluginContentCategory =
  | 'adventure'
  | 'monsters'
  | 'items'
  | 'classes'
  | 'subclasses'
  | 'spells'
  | 'feats'
  | 'races'
  | 'backgrounds'
  | 'rules'
  | 'assets'
  | 'mixed'

export interface Dnd5ePluginContentCategoryDefinition {
  id: Dnd5ePluginContentCategory
  label: string
  shortLabel: string
  description: string
}

export const DND5E_PLUGIN_CONTENT_CATEGORIES: readonly Dnd5ePluginContentCategoryDefinition[]
export const DND5E_PLUGIN_CONTENT_CATEGORY_IDS: readonly Dnd5ePluginContentCategory[]

export function isDnd5ePluginContentCategory(value: unknown): value is Dnd5ePluginContentCategory
export function dnd5ePluginContentCategoryDefinition(
  value: unknown,
): Dnd5ePluginContentCategoryDefinition
export function dnd5ePluginContentCategoryLabel(value: unknown): string
