import { useMemo } from 'react'
import { migrateCharacterToDnd5e } from '../../application/combat/dnd5eCombatRules'
import type { Token } from '../../store/maps'
import { useCharacterStore } from '../../store/characters'
import type { Character } from '../../types/character'

export type MapViewportCharacter = Character & {
  darkvisionRangeFeet?: number
}

interface MapViewportCharacterCacheEntry {
  source: Character
  projection: MapViewportCharacter
}

function collectSourceActorId(
  value: string | undefined,
  tokenCharacterIdById: ReadonlyMap<string, string>,
  characterIds: ReadonlySet<string>,
  result: Set<string>,
): void {
  if (!value) return
  const characterId = tokenCharacterIdById.get(value) ?? value
  if (characterIds.has(characterId)) result.add(characterId)
}

function collectConcentrationSourceActorIds(
  combatState: { concentrationEffectsBySource?: Readonly<Record<string, string>> } | undefined,
  tokenCharacterIdById: ReadonlyMap<string, string>,
  characterIds: ReadonlySet<string>,
  result: Set<string>,
): void {
  for (const actorId of Object.keys(combatState?.concentrationEffectsBySource ?? {})) {
    collectSourceActorId(actorId, tokenCharacterIdById, characterIds, result)
  }
}

/**
 * Includes characters linked to the current map and off-map casters whose
 * palettes are still required by an authoritative status marker.
 */
export function mapViewportRelevantCharacterIds(
  characters: readonly Character[],
  tokens: readonly Token[],
): string[] {
  const characterIds = new Set(characters.map((character) => character.id))
  const tokenCharacterIdById = new Map(tokens.flatMap((token) =>
    token.characterId ? [[token.id, token.characterId] as const] : [],
  ))
  const result = new Set(tokenCharacterIdById.values())

  for (const token of tokens) {
    for (const effect of token.dnd5eCombatState?.activeEffects ?? []) {
      collectSourceActorId(effect.source.actorId, tokenCharacterIdById, characterIds, result)
    }
    collectSourceActorId(
      token.dnd5eCombatState?.monsterDamageAversionSourceActorId,
      tokenCharacterIdById,
      characterIds,
      result,
    )
    collectConcentrationSourceActorIds(
      token.dnd5eCombatState,
      tokenCharacterIdById,
      characterIds,
      result,
    )
  }

  for (const character of characters) {
    if (!result.has(character.id)) continue
    for (const effect of character.dnd5eCombatState?.activeEffects ?? []) {
      collectSourceActorId(effect.source.actorId, tokenCharacterIdById, characterIds, result)
    }
    collectSourceActorId(
      character.dnd5eCombatState?.monsterDamageAversionSourceActorId,
      tokenCharacterIdById,
      characterIds,
      result,
    )
    collectConcentrationSourceActorIds(
      character.dnd5eCombatState,
      tokenCharacterIdById,
      characterIds,
      result,
    )
  }

  return [...result]
}

function sameViewportSourceFields(previous: Character, next: Character): boolean {
  return previous.name === next.name &&
    previous.avatar === next.avatar &&
    previous.portrait === next.portrait &&
    previous.tokenPortrait === next.tokenPortrait &&
    previous.rulesetId === next.rulesetId &&
    previous.race === next.race &&
    previous.dnd5eRaceId === next.dnd5eRaceId &&
    previous.dnd5eRacialChoices === next.dnd5eRacialChoices &&
    previous.charClass === next.charClass &&
    previous.dnd5eClassLevels === next.dnd5eClassLevels &&
    previous.dnd5eClassChoices === next.dnd5eClassChoices &&
    previous.dnd5ePluginFeatureIds === next.dnd5ePluginFeatureIds &&
    previous.currentHp === next.currentHp &&
    previous.maxHp === next.maxHp &&
    previous.tempHp === next.tempHp &&
    previous.conditions === next.conditions &&
    previous.concentrating === next.concentrating &&
    previous.dnd5eCombatState === next.dnd5eCombatState
}

function sameViewportFields(
  previous: MapViewportCharacter,
  next: MapViewportCharacter,
): boolean {
  return previous.id === next.id &&
    previous.name === next.name &&
    previous.avatar === next.avatar &&
    previous.portrait === next.portrait &&
    previous.tokenPortrait === next.tokenPortrait &&
    previous.race === next.race &&
    previous.dnd5eRaceId === next.dnd5eRaceId &&
    previous.dnd5eClassChoices === next.dnd5eClassChoices &&
    previous.charClass === next.charClass &&
    previous.dnd5eClassLevels === next.dnd5eClassLevels &&
    previous.currentHp === next.currentHp &&
    previous.maxHp === next.maxHp &&
    previous.tempHp === next.tempHp &&
    previous.conditions === next.conditions &&
    previous.concentrating === next.concentrating &&
    previous.dnd5eCombatState === next.dnd5eCombatState &&
    previous.darkvisionRangeFeet === next.darkvisionRangeFeet
}

/**
 * Field-level Zustand selector for the Konva viewport. A change to inventory,
 * spellbook, biography, or an off-map character keeps the exact prior array
 * identity and therefore cannot invalidate the canvas presentation boundary.
 */
export function createMapViewportCharacterSelector(
  tokens: readonly Token[],
  rulesRevision?: unknown,
) {
  // A new selector owns a fresh projection cache. Passing the rules snapshot
  // here intentionally invalidates derived vision fields when house rules or
  // plugin registrations change, even if Character object identities do not.
  void rulesRevision
  let cache = new Map<string, MapViewportCharacterCacheEntry>()
  let previousResult: MapViewportCharacter[] = []

  return (state: { characters: Character[] }): MapViewportCharacter[] => {
    const relevantIds = mapViewportRelevantCharacterIds(state.characters, tokens)
    const charactersById = new Map(state.characters.map((character) => [character.id, character]))
    const nextCache = new Map<string, MapViewportCharacterCacheEntry>()
    const result = relevantIds.flatMap((id) => {
      const character = charactersById.get(id)
      if (!character) return []
      const cached = cache.get(id)
      if (cached?.source === character) {
        nextCache.set(id, cached)
        return [cached.projection]
      }
      if (cached && sameViewportSourceFields(cached.source, character)) {
        const stableEntry = { source: character, projection: cached.projection }
        nextCache.set(id, stableEntry)
        return [cached.projection]
      }
      const projection: MapViewportCharacter = {
        ...character,
        darkvisionRangeFeet: migrateCharacterToDnd5e(character).darkvisionRangeFeet,
      }
      const stableProjection = cached && sameViewportFields(cached.projection, projection)
        ? cached.projection
        : projection
      nextCache.set(id, { source: character, projection: stableProjection })
      return [stableProjection]
    })
    cache = nextCache

    if (
      result.length === previousResult.length &&
      result.every((character, index) => character === previousResult[index])
    ) return previousResult
    previousResult = result
    return result
  }
}

export function useMapViewportCharacters(
  tokens: readonly Token[],
  rulesRevision?: unknown,
): readonly MapViewportCharacter[] {
  const selector = useMemo(
    () => createMapViewportCharacterSelector(tokens, rulesRevision),
    [rulesRevision, tokens],
  )
  return useCharacterStore(selector)
}
