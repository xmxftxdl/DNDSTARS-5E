import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'

export interface DmWallOfFireRemoval {
  map: BattleMap
  character?: Character
  token?: Token
  label: string
}

function withoutWallConcentration<T extends { concentrating?: boolean; dnd5eCombatState?: Character['dnd5eCombatState'] }>(source: T): T {
  if (source.dnd5eCombatState?.concentrationSpellId !== 'wall-of-fire') return source
  const state = { ...source.dnd5eCombatState }
  delete state.concentrationSpellId
  delete state.concentrationSpellLevel
  delete state.concentrationTargetIds
  delete state.concentrationRoundsRemaining
  return { ...source, concentrating: false, dnd5eCombatState: state }
}

/** DM-only caller supplies the authoritative snapshot; stale or non-wall IDs are rejected. */
export function removeWallOfFireByDm(input: {
  map: BattleMap
  characters: readonly Character[]
  areaId: string
}): DmWallOfFireRemoval | undefined {
  const area = input.map.dnd5ePluginAreas?.find((candidate) =>
    candidate.id === input.areaId && candidate.sourceKind === 'core-spell' && candidate.coreSpellId === 'wall-of-fire',
  )
  if (!area) return undefined
  const sourceCharacter = input.characters.find((candidate) => candidate.id === area.sourceCharacterId)
  const sourceToken = input.map.tokens.find((candidate) => candidate.id === area.sourceTokenId)
  return {
    map: { ...input.map, dnd5ePluginAreas: input.map.dnd5ePluginAreas?.filter((candidate) => candidate.id !== area.id) ?? [] },
    character: sourceCharacter ? withoutWallConcentration(sourceCharacter) : undefined,
    token: sourceToken ? withoutWallConcentration(sourceToken) : undefined,
    label: area.label,
  }
}

export function toggleDmPluginAreaVisibility(map: BattleMap, areaId: string): BattleMap | undefined {
  const area = map.dnd5ePluginAreas?.find((candidate) => candidate.id === areaId)
  return area ? { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.map((candidate) =>
    candidate.id === areaId ? { ...candidate, hiddenFromPlayers: !candidate.hiddenFromPlayers } : candidate) } : undefined
}
