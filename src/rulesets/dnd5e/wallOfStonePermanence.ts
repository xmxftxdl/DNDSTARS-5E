import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'

export interface Dnd5eWallOfStonePermanenceResult {
  maps: BattleMap[]
  completedAreaIds: string[]
}

/**
 * Converts a Wall of Stone area into ordinary permanent masonry when campaign
 * time completes the caster's still-active ten-minute concentration. This is
 * intentionally evaluated before character time reconciliation clears the
 * concentration summary, so an early concentration break cannot accidentally
 * make the wall permanent.
 */
export function completeDnd5eWallOfStoneForCampaignTime(input: {
  maps: readonly BattleMap[]
  characters: readonly Character[]
  worldMinute: number
}): Dnd5eWallOfStonePermanenceResult {
  const completingSourceCharacterIds = new Set(input.characters.flatMap((character) => {
    const appliedMinute = character.dnd5eWorldTimeAppliedMinute
    const concentration = character.dnd5eCombatState
    const remainingRounds = concentration?.concentrationRoundsRemaining
    if (
      character.concentrating !== true ||
      concentration?.concentrationSpellId !== 'wall-of-stone' ||
      !Number.isSafeInteger(appliedMinute) ||
      !Number.isInteger(remainingRounds) ||
      remainingRounds! < 1
    ) return []
    const elapsedRounds = Math.max(0, Math.floor(input.worldMinute - appliedMinute!)) * 10
    return elapsedRounds >= remainingRounds! ? [character.id] : []
  }))
  if (completingSourceCharacterIds.size === 0) {
    return { maps: [...input.maps], completedAreaIds: [] }
  }

  const completedAreaIds: string[] = []
  const maps = input.maps.map((map) => {
    let changed = false
    const areas = map.dnd5ePluginAreas?.map((area) => {
      if (
        area.permanent === true ||
        area.sourceKind !== 'core-spell' ||
        area.coreSpellId !== 'wall-of-stone' ||
        area.concentrationId !== 'wall-of-stone' ||
        !completingSourceCharacterIds.has(area.sourceCharacterId)
      ) return area
      changed = true
      completedAreaIds.push(area.id)
      return {
        ...area,
        permanent: true as const,
        concentrationId: undefined,
      }
    })
    return changed ? { ...map, dnd5ePluginAreas: areas } : map
  })
  return { maps, completedAreaIds }
}
