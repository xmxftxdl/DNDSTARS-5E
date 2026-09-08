import type { GridCell } from '../../../lib/gridCombat'
import type { Dnd5eSpellCastPayload } from '../../../lib/sharedCombatTypes'
import type { Dnd5eSpellTargetingSession } from './SpellTargetingContracts'

export interface SpellTargetingSubmissionInput {
  targeting: Dnd5eSpellTargetingSession
  selectedTargetIds: readonly string[]
  currentTokenId?: string
  areaTargetCell?: GridCell
  areaTargetCells?: readonly GridCell[]
  areaTargetOrientation?: 0 | 1 | 2 | 3
  areaTargetAngleDegrees?: number
  healingAllocations?: Dnd5eSpellCastPayload['healingAllocations']
  spellSpecificPayload?: Partial<Dnd5eSpellCastPayload>
}

export interface DefaultSculptedSpellTargetsInput {
  enabled: boolean
  affectedTargetIds: readonly string[]
  currentTargetIds: readonly string[]
  maximumTargets: number
}

/**
 * Parses the numbered creature picker used by persistent-area spells. An empty
 * value or `0` explicitly clears the selection; malformed/out-of-range input is
 * rejected so the player never submits a different creature by accident.
 */
export function parseAreaExemptionSelection(
  value: string,
  candidateIds: readonly string[],
): string[] | undefined {
  const normalized = value.trim()
  if (normalized === '' || normalized === '0') return []
  const parts = normalized.split(/[\s,，]+/).filter(Boolean)
  const selected: string[] = []
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return undefined
    const index = Number(part) - 1
    const candidateId = candidateIds[index]
    if (!candidateId) return undefined
    if (!selected.includes(candidateId)) selected.push(candidateId)
  }
  return selected
}

/**
 * Multi-origin spells must remain in targeting mode after their first legal
 * point. Their minimum count only enables the explicit confirm button; it must
 * never be interpreted as permission to submit immediately.
 */
export function shouldAutoSubmitSpellAreaSelection(
  targeting: Pick<
    Dnd5eSpellTargetingSession,
    'autoSubmitOnAreaSelection' | 'areaTargetCount' | 'minimumAreaTargetCount' | 'areaExemptionMode'
  >,
  selectedAreaCount: number,
): boolean {
  const maximum = Math.max(1, Math.floor(targeting.areaTargetCount ?? 1))
  const minimum = Math.max(
    1,
    Math.min(maximum, Math.floor(targeting.minimumAreaTargetCount ?? maximum)),
  )
  return targeting.autoSubmitOnAreaSelection === true &&
    targeting.areaExemptionMode == null &&
    maximum === 1 &&
    selectedAreaCount >= minimum
}

/**
 * Keeps only still-valid manual Sculpt Spells choices. Arming the feature must
 * never choose creatures on the player's behalf: after placing the area, the
 * player explicitly chooses up to the allowance from creatures they can see.
 */
export function defaultSculptedSpellTargetIds(
  input: DefaultSculptedSpellTargetsInput,
): string[] {
  const maximumTargets = Math.max(0, Math.floor(input.maximumTargets))
  if (!input.enabled || maximumTargets === 0) return []
  const affected = new Set(input.affectedTargetIds)
  return [...new Set(input.currentTargetIds)]
    .filter((targetId) => affected.has(targetId))
    .slice(0, maximumTargets)
}

/**
 * Converts an ephemeral targeting draft into a room command payload. This does
 * not declare the targets legal: the authority Host revalidates visibility,
 * line of effect, range, resources and the current rules context.
 */
export function buildSpellTargetingSubmission(
  input: SpellTargetingSubmissionInput,
): Dnd5eSpellCastPayload {
  const targeting = input.targeting
  const targetTokenIds = [...new Set(input.selectedTargetIds)]
  const usesAreaTargeting = targeting.area != null
  return {
    spellId: targeting.spellId,
    spellOriginAreaId: targeting.spellOriginAreaId,
    focusItemInstanceId: targeting.focusItemInstanceId,
    itemInstanceId: targeting.itemInstanceId,
    itemUseActionId: targeting.itemUseActionId,
    castingClassId: targeting.castingClassId,
    ritual: targeting.ritual,
    racialInnate: targeting.racialInnate,
    alternateResourceSpell: targeting.alternateResourceSpell,
    slotLevel: targeting.slotLevel,
    activityChoices: targeting.activityChoices
      ? { ...targeting.activityChoices }
      : undefined,
    secretPhrase: targeting.secretPhrase,
    magicMouth: targeting.magicMouth
      ? { ...targeting.magicMouth }
      : undefined,
    communicationText: targeting.communicationText,
    minorIllusion: targeting.minorIllusion
      ? { ...targeting.minorIllusion }
      : undefined,
    tinyHut: targeting.tinyHut
      ? { ...targeting.tinyHut }
      : undefined,
    antipathySympathy: targeting.antipathySympathy
      ? { ...targeting.antipathySympathy }
      : undefined,
    targetTokenId: targetTokenIds[0] ?? input.currentTokenId ?? '',
    targetTokenIds,
    areaTargetCell: usesAreaTargeting ? input.areaTargetCell : undefined,
    areaTargetCells: usesAreaTargeting && input.areaTargetCells?.length
      ? input.areaTargetCells.map((cell) => ({ ...cell }))
      : undefined,
    dancingLightsForm: targeting.spellId === 'dancing-lights'
      ? targeting.dancingLightsForm ?? 'lights'
      : undefined,
    areaTargetOrientation: usesAreaTargeting ? input.areaTargetOrientation : undefined,
    areaTargetAngleDegrees: usesAreaTargeting ? input.areaTargetAngleDegrees : undefined,
    areaTargetRadiusFeet: usesAreaTargeting ? targeting.areaTargetRadiusFeet : undefined,
    areaTargetWidthFeet: usesAreaTargeting ? targeting.areaTargetWidthFeet : undefined,
    areaTargetHeightFeet: usesAreaTargeting ? targeting.areaTargetHeightFeet : undefined,
    areaTargetLengthFeet: usesAreaTargeting ? targeting.areaTargetLengthFeet : undefined,
    ...input.spellSpecificPayload,
    higherSlotDamageType: targeting.higherSlotDamageType,
    conditionChoice: targeting.conditionChoice,
    effectDamageType: targeting.effectDamageType,
    enlargeReduceChoice: targeting.enlargeReduceChoice,
    enhanceAbilityChoice: targeting.enhanceAbilityChoice,
    sustainedEffectAttack: targeting.sustainedEffectAttack,
    sustainedEffectAreaId: targeting.sustainedEffectAreaId,
    healingAllocations: input.healingAllocations,
    projectileTargetIds: targeting.allowDuplicateTargets
      ? [...targeting.targetTokenIds]
      : undefined,
    overchannel: targeting.overchannel || undefined,
    damageMaximizationFeatureId: targeting.damageMaximizationFeatureId,
    empowered: targeting.empowered || undefined,
    draconicResistance: targeting.draconicResistance || undefined,
    repellingBlast: targeting.repellingBlast || undefined,
    sculptedTargetIds: targeting.sculptedTargetIds.length > 0
      ? [...targeting.sculptedTargetIds]
      : undefined,
    excludedAreaTargetIds: (targeting.excludedAreaTargetIds?.length ?? 0) > 0
      ? [...targeting.excludedAreaTargetIds!]
      : undefined,
    metamagic: targeting.metamagic
      ? {
          ...targeting.metamagic,
          carefulTargetIds: targeting.metamagic.kind === 'careful'
            ? [...targeting.carefulTargetIds]
            : undefined,
          heightenedTargetId: targeting.metamagic.kind === 'heightened'
            ? targeting.heightenedTargetId
            : undefined,
        }
      : undefined,
  }
}

export function undoLastSpellTarget(
  targeting: Dnd5eSpellTargetingSession,
): Dnd5eSpellTargetingSession {
  return { ...targeting, targetTokenIds: targeting.targetTokenIds.slice(0, -1) }
}

export function selectSpellModifierMode(
  targeting: Dnd5eSpellTargetingSession,
  mode: 'sculpt' | 'careful' | 'heightened',
): Dnd5eSpellTargetingSession {
  if (mode === 'sculpt' && (!targeting.canSculpt || targeting.autoSculpt !== true)) return targeting
  if (mode === 'careful' && targeting.metamagic?.kind !== 'careful') return targeting
  if (mode === 'heightened' && targeting.metamagic?.kind !== 'heightened') return targeting
  return {
    ...targeting,
    sculpting: mode === 'sculpt' ? !targeting.sculpting : false,
    carefulSelecting: mode === 'careful' ? !targeting.carefulSelecting : false,
    heightenedSelecting: mode === 'heightened' ? !targeting.heightenedSelecting : false,
  }
}
