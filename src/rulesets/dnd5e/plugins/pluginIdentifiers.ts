const DND5E_PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

export function validDnd5ePluginId(value: string): boolean {
  return DND5E_PLUGIN_ID_PATTERN.test(value)
}

export function namespacedDnd5ePluginId(pluginId: string, localId: string): string {
  if (!validDnd5ePluginId(localId)) {
    throw new Error(`Invalid plugin contribution id: ${localId}`)
  }
  return `${pluginId}:${localId}`
}
