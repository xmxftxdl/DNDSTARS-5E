import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'

export interface DmPersistentAreaRemoval {
  map: BattleMap
  character?: Character
  sourceToken?: Token
  label: string
  concentrationEnded: boolean
}

function withoutMatchingConcentration<T extends { concentrating?: boolean; dnd5eCombatState?: Character['dnd5eCombatState'] }>(
  source: T,
  concentrationId: string | undefined,
  sourceTokenId: string,
): T {
  if (!concentrationId || source.dnd5eCombatState?.concentrationSpellId !== concentrationId) return source
  const state = { ...source.dnd5eCombatState }
  const activeEffects = state.activeEffects?.filter((effect) =>
    !(effect.duration.type === 'concentration' &&
      effect.duration.sourceActorId === sourceTokenId &&
      (!effect.duration.concentrationId || effect.duration.concentrationId === concentrationId)),
  )
  delete state.concentrationSpellId
  delete state.concentrationSpellLevel
  delete state.concentrationTargetIds
  delete state.concentrationRoundsRemaining
  state.activeEffects = activeEffects?.length ? activeEffects : undefined
  return { ...source, concentrating: false, dnd5eCombatState: state }
}

/** DM-only caller supplies the latest authoritative snapshot; stale area IDs are rejected. */
export function removePersistentAreaByDm(input: {
  map: BattleMap
  characters: readonly Character[]
  areaId: string
}): DmPersistentAreaRemoval | undefined {
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.areaId)
  if (!area) return undefined
  const sourceCharacter = input.characters.find((candidate) => candidate.id === area.sourceCharacterId)
  const sourceToken = input.map.tokens.find((candidate) => candidate.id === area.sourceTokenId)
  const effectToken = area.anchorMode === 'effect-token' && area.anchorTokenId
    ? input.map.tokens.find((candidate) =>
        candidate.id === area.anchorTokenId && !!candidate.dnd5eSpellEffect,
      )
    : undefined
  const removedAreaIds = new Set(
    (input.map.dnd5ePluginAreas ?? [])
      .filter((candidate) => candidate.id === area.id || (!!effectToken &&
        candidate.anchorMode === 'effect-token' && candidate.anchorTokenId === effectToken.id))
      .map((candidate) => candidate.id),
  )
  // Old shared maps may predate concentrationId. Only fall back to the core
  // spell id when it is also the caster's current concentration identity.
  const recordedConcentrationId = area.concentrationId ?? area.coreSpellId
  const character = sourceCharacter
    ? withoutMatchingConcentration(sourceCharacter, recordedConcentrationId, area.sourceTokenId)
    : undefined
  const nextSourceToken = sourceToken
    ? withoutMatchingConcentration(sourceToken, recordedConcentrationId, area.sourceTokenId)
    : undefined
  const concentrationEnded = character !== sourceCharacter || nextSourceToken !== sourceToken
  return {
    map: {
      ...input.map,
      dnd5ePluginAreas: (input.map.dnd5ePluginAreas ?? []).filter((candidate) =>
        !removedAreaIds.has(candidate.id)),
      tokens: input.map.tokens
        .filter((candidate) => candidate.id !== effectToken?.id)
        .map((candidate) => candidate.id === nextSourceToken?.id ? nextSourceToken : candidate),
    },
    character,
    sourceToken: nextSourceToken,
    label: area.label,
    concentrationEnded,
  }
}

/** Kept for callers/tests that still use the former spell-specific API. */
export function removeWallOfFireByDm(input: {
  map: BattleMap
  characters: readonly Character[]
  areaId: string
}): DmPersistentAreaRemoval | undefined {
  const area = input.map.dnd5ePluginAreas?.find((candidate) =>
    candidate.id === input.areaId && candidate.coreSpellId === 'wall-of-fire',
  )
  return area ? removePersistentAreaByDm(input) : undefined
}

export function toggleDmPluginAreaVisibility(map: BattleMap, areaId: string): BattleMap | undefined {
  const area = map.dnd5ePluginAreas?.find((candidate) => candidate.id === areaId)
  return area ? { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.map((candidate) =>
    candidate.id === areaId ? { ...candidate, hiddenFromPlayers: !candidate.hiddenFromPlayers } : candidate) } : undefined
}
