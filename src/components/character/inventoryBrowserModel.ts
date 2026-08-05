import type { Dnd5eInventoryCategory, Dnd5eInventoryEntry } from '../../types/inventory'

export type Dnd5eInventoryCategoryFilter = 'all' | Dnd5eInventoryCategory
export type Dnd5eInventorySort = 'name' | 'category' | 'weight' | 'newest'

export interface Dnd5eInventoryBrowserQuery {
  query: string
  category: Dnd5eInventoryCategoryFilter
  sort: Dnd5eInventorySort
}

function searchableText(entry: Dnd5eInventoryEntry): string {
  return [
    entry.item.name,
    entry.item.englishName,
    entry.item.description,
    entry.item.rulesText,
  ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN')
}

export function dnd5eInventoryBrowserEntries(
  entries: readonly Dnd5eInventoryEntry[],
  input: Dnd5eInventoryBrowserQuery,
): Dnd5eInventoryEntry[] {
  const query = input.query.trim().toLocaleLowerCase('zh-CN')
  const filtered = entries.filter((entry) => (
    (input.category === 'all' || entry.item.category === input.category) &&
    (!query || searchableText(entry).includes(query))
  ))
  return [...filtered].sort((left, right) => {
    if (input.sort === 'newest') return right.acquiredAt - left.acquiredAt
    if (input.sort === 'weight') {
      return ((right.item.weightLb ?? 0) * right.quantity) - ((left.item.weightLb ?? 0) * left.quantity) ||
        left.item.name.localeCompare(right.item.name, 'zh-CN')
    }
    if (input.sort === 'category') {
      return left.item.category.localeCompare(right.item.category) ||
        left.item.name.localeCompare(right.item.name, 'zh-CN')
    }
    return left.item.name.localeCompare(right.item.name, 'zh-CN')
  })
}
