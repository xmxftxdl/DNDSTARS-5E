export interface MapAoeTargetingSessionInput {
  coreAreaMove?: {
    characterId: string
    areaId: string
  } | null
  pluginArea?: {
    characterId: string
    featureId: string
  } | null
  itemArea?: {
    characterId: string
    instanceId: string
  } | null
  spellArea?: {
    characterId: string
    castingClassId?: string
    spellId: string
    slotLevel: number
    sustainedEffectAreaId?: string
  } | null
}

/**
 * Identifies one area-targeting session without depending on mutable preview or
 * target-selection state. Callers can therefore initialize the preview once
 * without snapping it back when the selected targets or modifier state change.
 */
export function mapAoeTargetingSessionKey(input: MapAoeTargetingSessionInput): string | null {
  if (input.coreAreaMove) {
    return `core:${input.coreAreaMove.characterId}:${input.coreAreaMove.areaId}`
  }
  if (input.pluginArea) {
    return `plugin:${input.pluginArea.characterId}:${input.pluginArea.featureId}`
  }
  if (input.itemArea) {
    return `item:${input.itemArea.characterId}:${input.itemArea.instanceId}`
  }
  if (input.spellArea) {
    const spell = input.spellArea
    return [
      'spell',
      spell.characterId,
      spell.castingClassId ?? 'racial-innate',
      spell.spellId,
      spell.slotLevel,
      spell.sustainedEffectAreaId ?? '',
    ].join(':')
  }
  return null
}

export function mapSpellTargetIdsForAuthoritySubmission(input: {
  hasArea: boolean
  targetKind: string | undefined
  selectedTargetIds: readonly string[]
}): string[] {
  if (input.hasArea && input.targetKind === 'area') return []
  return [...new Set(input.selectedTargetIds)]
}
