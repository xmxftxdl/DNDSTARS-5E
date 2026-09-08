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

export interface SpellAreaModifierSelectionState {
  area?: unknown
  areaTargetSelected?: boolean
  areaTargetCell?: unknown
  areaTargetCells?: readonly unknown[]
  areaTargetCount?: number
  sculpting?: boolean
  carefulSelecting?: boolean
  heightenedSelecting?: boolean
  excludingAreaTargets?: boolean
}

export interface SculptSpellCandidateToken {
  id: string
  type: 'player' | 'enemy' | 'npc' | 'obstacle'
  characterId?: string
  perceptionVisibility?: string
}

/**
 * Returns every visible creature in the committed spell area except the
 * caster. This list drives both map hit affordances and the accessible button
 * picker, so a character remains selectable even when a status badge overlaps
 * the Token portrait.
 */
export function sculptSpellSelectableTokenIds(input: {
  affectedTargetIds: readonly string[]
  /**
   * Token ids recalculated from the committed map template. Once an area has
   * been placed this is preferred over the transient targeting draft, which
   * can lag behind the locked cone while React hands the click to the Token.
   */
  committedAreaTargetIds?: readonly string[]
  casterCharacterId: string
  tokens: readonly SculptSpellCandidateToken[]
}): string[] {
  const affected = new Set(input.committedAreaTargetIds ?? input.affectedTargetIds)
  return input.tokens
    .filter((token) =>
      affected.has(token.id) &&
      token.type !== 'obstacle' &&
      token.characterId !== input.casterCharacterId &&
      token.perceptionVisibility !== 'detected-unseen',
    )
    .map((token) => token.id)
}

/**
 * A one-template spell is committed as soon as its placement click succeeds.
 * From then on mouse hover and Token clicks must not silently re-aim it. For a
 * multi-template spell we keep placement enabled until all templates are set,
 * unless the player has explicitly entered a modifier picker for the already
 * committed templates.
 */
export function spellAreaSelectionLocked(
  targeting: SpellAreaModifierSelectionState | null | undefined,
): boolean {
  if (
    targeting?.areaTargetSelected !== true ||
    targeting.area == null ||
    targeting.areaTargetCell == null
  ) return false

  if (spellAreaModifierSelectionActive(targeting)) return true

  const requestedAreaCount = Math.max(1, targeting.areaTargetCount ?? 1)
  if (requestedAreaCount === 1) return true
  return (targeting.areaTargetCells?.length ?? 0) >= requestedAreaCount
}

/**
 * After an area has been committed, modifier pickers operate on creatures
 * inside that exact template. The map must stop treating pointer movement and
 * Token clicks as requests to aim the area again.
 */
export function spellAreaModifierSelectionActive(
  targeting: SpellAreaModifierSelectionState | null | undefined,
): boolean {
  return targeting?.areaTargetSelected === true &&
    targeting.area != null &&
    targeting.areaTargetCell != null &&
    (
      targeting.sculpting === true ||
      targeting.carefulSelecting === true ||
      targeting.heightenedSelecting === true ||
      targeting.excludingAreaTargets === true
    )
}

export function playerGrantedActivityAoeSelectActive(input: {
  isDM: boolean
  pluginArea?: {
    persistentAreaId?: string
    activeEffectId?: string
  } | null
}): boolean {
  if (input.isDM || !input.pluginArea) return false
  return !!(input.pluginArea.persistentAreaId || input.pluginArea.activeEffectId)
}

export function pluginAreaTargetingAllowsEmptyArea(input: {
  persistentArea?: unknown
  persistentAreaId?: string
  activeEffectId?: string
}): boolean {
  return !!(
    input.persistentArea ||
    input.persistentAreaId ||
    input.activeEffectId
  )
}

export function mapAoeSelectMode(input: {
  playerSpellAoeSelectActive: boolean
  playerActivityAoeSelectActive: boolean
  coreAreaMoveTargetingActive: boolean
  playerCombatLocked: boolean
  activeAoeTargeting: boolean
  itemAreaTargetingActive: boolean
  guessedSpellTargetingActive: boolean
  spellAreaSelectionLocked?: boolean
}): boolean {
  if (input.spellAreaSelectionLocked) return false
  return input.playerSpellAoeSelectActive ||
    input.playerActivityAoeSelectActive ||
    // A player-owned persistent spell entity remains controllable in
    // exploration after combat settlement. Its Host request intentionally
    // omits combatId, so a stale post-combat presentation lock must not make
    // the visible targeting prompt non-interactive.
    input.coreAreaMoveTargetingActive ||
    (!input.playerCombatLocked && (
      input.activeAoeTargeting ||
      input.itemAreaTargetingActive ||
      input.guessedSpellTargetingActive
    ))
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

/**
 * Combines every active map-targeting draft into the Token outline layer.
 * Spell target ids are presentation state only; the Host still validates the
 * submitted targets independently when the cast is confirmed.
 */
export function mapTargetSelectionTokenIds(
  ...groups: (readonly string[] | null | undefined)[]
): string[] {
  return [...new Set(groups.flatMap((group) => group ?? []))]
}
