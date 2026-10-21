/** Called only after the server validates the route, inside the movement write transaction. */
export function recordAcceptedMovementSightings({ map, characters, path, actorId, clock, canSee, observerIds }) {
  const minute = clock?.worldMinute, seconds = clock?.worldSecondRemainder
  if (!Number.isFinite(minute) || minute < 0 || !Number.isInteger(seconds) || seconds < 0 || seconds >= 60 || !path?.length) {
    return { map, characters }
  }
  const time = minute + seconds / 60
  const characterById = new Map(characters.map(character => [character.id, character]))
  const creatures = map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type) &&
    !token.dnd5eSpellEffect && !token.objectInteractionOnly)
  const observers = observerIds ? creatures.filter(token => observerIds.includes(token.id)) : creatures
  const histories = new Map(observers.map(token => {
    const source = characterById.get(token.characterId) ?? token
    const history = Object.fromEntries(Object.entries(source.dnd5eCombatState?.recentCreatureSightings ?? {})
      .filter(([, sight]) => sight?.mapId === map.id && Number.isFinite(sight.worldMinute) &&
        time >= sight.worldMinute && (time - sight.worldMinute) * 60 <= 60 + 1e-7))
    return [token.id, history]
  }))
  for (const point of path) {
    const scene = { ...map, tokens: map.tokens.map(token => token.id === actorId ? { ...token, ...point } : token) }
    const positioned = creatures.map(token => scene.tokens.find(current => current.id === token.id))
    for (const viewer of positioned.filter(token => histories.has(token.id))) for (const target of positioned) {
      if (viewer.id !== target.id && canSee(scene, viewer, target, characterById)) {
        histories.get(viewer.id)[target.id] = { mapId: map.id, worldMinute: time,
          label: characterById.get(target.characterId)?.name ?? target.label }
      }
    }
  }
  const patch = (source, token) => {
    const history = histories.get(token.id)
    const recentCreatureSightings = Object.keys(history).length ? history : undefined
    if (JSON.stringify(source.dnd5eCombatState?.recentCreatureSightings) === JSON.stringify(recentCreatureSightings)) return source
    return { ...source, dnd5eCombatState: { ...(!source.dnd5eCombatState ? { schemaVersion: 2 } : {}), ...source.dnd5eCombatState, recentCreatureSightings } }
  }
  const nextCharacters = characters.map(character => {
    const token = observers.find(token => token.characterId === character.id)
    return token ? patch(character, token) : character
  })
  const tokens = map.tokens.map(token => histories.has(token.id) && !characterById.has(token.characterId) ? patch(token, token) : token)
  return { map: tokens.some((token, index) => token !== map.tokens[index]) ? { ...map, tokens } : map, characters: nextCharacters }
}
