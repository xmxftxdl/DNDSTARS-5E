import type { BattleMap } from '../../store/maps'

export interface MapWorkspaceMenuItem {
  id: string
  name: string
}

let lastMenuMaps: readonly BattleMap[] | undefined
let lastMenuItems: readonly MapWorkspaceMenuItem[] = []

/** Reuses map menu metadata while only token/runtime data changes. */
export function selectMapWorkspaceMenuItems(state: {
  maps: readonly BattleMap[]
}): readonly MapWorkspaceMenuItem[] {
  if (state.maps === lastMenuMaps) return lastMenuItems
  const unchanged = state.maps.length === lastMenuItems.length
    && state.maps.every((map, index) => (
      map.id === lastMenuItems[index]?.id && map.name === lastMenuItems[index]?.name
    ))
  lastMenuMaps = state.maps
  if (unchanged) return lastMenuItems
  lastMenuItems = state.maps.map((map) => ({ id: map.id, name: map.name }))
  return lastMenuItems
}
