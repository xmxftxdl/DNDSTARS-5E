import type { BattleMap } from '../../store/maps'
import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e/mapBridge'

/** Apply settlement patches at each token's current location, never reinsert it. */
export function portalResultPlans(application: Dnd5eMapResultPlan, maps: readonly BattleMap[]): Dnd5eMapResultPlan[] {
  const changed = new Set(application.changedTokenIds)
  return maps.flatMap(map => {
    const source = map.id === application.map.id
    const ids = map.tokens.filter(token => changed.has(token.id)).map(token => token.id)
    if (!source && !ids.length) return []
    const patches = Object.fromEntries(ids.map(id => [id, application.tokenPatches?.[id] ?? {}]))
    return [{
      ...application,
      geometry: source ? application.geometry : undefined,
      map: {
        ...map,
        ...(source ? { dnd5ePluginAreas: application.map.dnd5ePluginAreas } : {}),
        tokens: map.tokens.map(token => patches[token.id] ? { ...token, ...patches[token.id] } : token),
      },
      tokenPatches: patches,
      changedTokenIds: ids,
      changedCharacterIds: source ? application.changedCharacterIds : [],
      characterPatches: source ? application.characterPatches : {},
    }]
  })
}
