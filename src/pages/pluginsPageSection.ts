export type PluginsSection = 'library' | 'catalog' | 'orders' | 'creator' | 'moderation'

const PLUGINS_SECTIONS = new Set<PluginsSection>([
  'library', 'catalog', 'orders', 'creator', 'moderation',
])

export function pluginsSectionFromSearch(search: string): PluginsSection | undefined {
  const value = new URLSearchParams(search).get('section')
  return value && PLUGINS_SECTIONS.has(value as PluginsSection)
    ? value as PluginsSection
    : undefined
}
