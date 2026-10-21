import type { BattleMap } from '../store/maps'

/** Uses server-projected ownership; never grants vision or moves a token. */
export function resolvePlayerMapObservation(maps: readonly BattleMap[]) {
  const candidates = maps.flatMap(map => map.tokens.flatMap(token => {
    const effect = token.dnd5eSpellEffect
    if (!token.viewerControlled || !effect?.visionFromSource || !effect.hiddenBody ||
      !effect.concentrationId || !map.dnd5ePluginAreas?.some(area => area.anchorTokenId === token.id &&
        area.sourceCharacterId === effect.sourceCharacterId && area.concentrationId === effect.concentrationId)) return []
    const bodies = maps.flatMap(source => source.tokens.filter(body => body.type === 'player' &&
      body.viewerControlled && body.characterId === effect.sourceCharacterId).map(body => ({ map: source, body })))
    if (bodies.length !== 1 || bodies[0].map.id === map.id) return []
    return [{ id: token.id, label: token.label, remoteMapId: map.id, bodyMapId: bodies[0].map.id }]
  }))
  return candidates.length === 1 ? candidates[0] : undefined
}

export function playerObservationSelectedMap(maps: readonly BattleMap[], selectedId: string | null,
  preference?: { sensorId: string; view: 'body' | 'sensor' }) {
  const observation = resolvePlayerMapObservation(maps)
  return observation && observation.id === preference?.sensorId
    ? preference.view === 'body' ? observation.bodyMapId : observation.remoteMapId
    : selectedId
}
