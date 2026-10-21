import type { Dnd5ePluginContentName, Dnd5ePluginContentNameCategory } from '../rulesets/dnd5e/plugins/pluginContentCatalog'

const categories: readonly (readonly [Dnd5ePluginContentNameCategory, string])[] = [
  ['class', '职业'], ['subclass', '子职'], ['race', '种族'], ['background', '背景'],
  ['feat', '专长'], ['feature', '特性'], ['spell', '法术'], ['item', '物品'], ['monster', '怪物'],
]

export function activeRulesExtensionNames(entries: readonly Dnd5ePluginContentName[]) {
  const owners = new Map<string, Map<Dnd5ePluginContentNameCategory, Set<string>>>()
  for (const entry of entries) {
    const name = entry.name.trim()
    if (!name) continue
    let groups = owners.get(entry.ownerPluginId)
    if (!groups) { groups = new Map(); owners.set(entry.ownerPluginId, groups) }
    let names = groups.get(entry.category)
    if (!names) { names = new Set(); groups.set(entry.category, names) }
    names.add(name)
  }
  return new Map([...owners].map(([owner, groups]) => [owner, categories.flatMap(([category, label]) => {
    const names = [...groups.get(category) ?? []].sort((left, right) => left.localeCompare(right, 'zh-CN'))
    return names.length ? [{ label, names }] : []
  })]))
}
