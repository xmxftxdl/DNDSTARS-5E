/** Host snapshots only. Called under the shared room write lock. */
export function recordSceneTransitionSightings({ beforeMaps, afterMaps, beforeCharacters, afterCharacters, beforeGeometry, afterGeometry, clock, observe }) {
  if (!Number.isFinite(clock?.worldMinute) || clock.worldMinute < 0 || !Number.isInteger(clock.worldSecondRemainder) || clock.worldSecondRemainder < 0 || clock.worldSecondRemainder >= 60) {
    return { maps: afterMaps, characters: afterCharacters }
  }
  const sample = (mapsState, charactersState, geometryState) => {
    let characters = charactersState?.characters ?? []
    const maps = mapsState?.maps ?? []
    const ownerMap = new Map(characters.map(character => {
      const scenes = maps.filter(map => map.tokens?.some(token => token.characterId === character.id))
      const scene = scenes.find(map => map.tokens.some(token => token.characterId === character.id && token.teleportationArrivalMapId === map.id)) ??
        scenes.find(map => map.id === mapsState.selectedId) ?? scenes[0]
      return [character.id, scene?.id]
    }))
    const observedMaps = maps.map(map => {
      if (!Array.isArray(map.tokens)) return map
      const result = observe({ map, characters, clock, path: [{}], actorId: null,
        geometry: geometryState?.maps?.find(geometry => geometry.mapId === map.id),
        observerIds: map.tokens.filter(token => !token.characterId || ownerMap.get(token.characterId) === map.id).map(token => token.id),
      })
      characters = result.characters
      return result.map
    })
    return { maps: { ...mapsState, maps: observedMaps }, characters: { ...charactersState, characters } }
  }
  const previous = sample(beforeMaps, beforeCharacters, beforeGeometry)
  const carry = (next, old) => {
    const incoming = next.dnd5eCombatState?.recentCreatureSightings ?? {}
    const recorded = old?.dnd5eCombatState?.recentCreatureSightings ?? {}
    const history = { ...incoming }
    for (const [id, sight] of Object.entries(recorded)) {
      if (!history[id] || history[id].worldMinute <= sight.worldMinute) history[id] = sight
    }
    if (JSON.stringify(history) === JSON.stringify(incoming)) return next
    return { ...next, dnd5eCombatState: { ...next.dnd5eCombatState, recentCreatureSightings: history } }
  }
  const carriedMaps = { ...afterMaps, maps: (afterMaps?.maps ?? []).map(map => ({ ...map,
    tokens: (map.tokens ?? []).map(token => carry(token, previous.maps.maps.find(old => old.id === map.id)?.tokens?.find(old => old.id === token.id))),
  })) }
  const carriedCharacters = { ...afterCharacters, characters: (afterCharacters?.characters ?? []).map(character =>
    carry(character, previous.characters.characters.find(old => old.id === character.id))) }
  const current = sample(carriedMaps, carriedCharacters, afterGeometry)
  // Keep referential stability when a visibility-neutral write changes no history.
  return {
    maps: JSON.stringify(current.maps) === JSON.stringify(afterMaps) ? afterMaps : current.maps,
    characters: JSON.stringify(current.characters) === JSON.stringify(afterCharacters) ? afterCharacters : current.characters,
  }
}
