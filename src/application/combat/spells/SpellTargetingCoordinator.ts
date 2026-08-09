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
  alliedTargetIds: readonly string[]
  currentTargetIds: readonly string[]
  maximumTargets: number
}

/**
 * Keeps still-valid manual choices and, when Sculpt Spells was armed, fills the
 * remaining allowance with affected allies. The player can still remove an
 * automatic choice or replace it with any other affected creature before the
 * cast is submitted.
 */
export function defaultSculptedSpellTargetIds(
  input: DefaultSculptedSpellTargetsInput,
): string[] {
  const maximumTargets = Math.max(0, Math.floor(input.maximumTargets))
  if (maximumTargets === 0) return []
  const affected = new Set(input.affectedTargetIds)
  const selected = [...new Set(input.currentTargetIds)]
    .filter((targetId) => affected.has(targetId))
    .slice(0, maximumTargets)
  if (!input.enabled || selected.length >= maximumTargets) return selected
  for (const targetId of input.alliedTargetIds) {
    if (!affected.has(targetId) || selected.includes(targetId)) continue
    selected.push(targetId)
    if (selected.length >= maximumTargets) break
  }
  return selected
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
  return {
    spellId: targeting.spellId,
    itemInstanceId: targeting.itemInstanceId,
    itemUseActionId: targeting.itemUseActionId,
    castingClassId: targeting.castingClassId,
    racialInnate: targeting.racialInnate,
    slotLevel: targeting.slotLevel,
    targetTokenId: targetTokenIds[0] ?? input.currentTokenId ?? '',
    targetTokenIds,
    areaTargetCell: input.areaTargetCell,
    areaTargetCells: input.areaTargetCells?.map((cell) => ({ ...cell })),
    areaTargetOrientation: input.areaTargetOrientation,
    areaTargetAngleDegrees: input.areaTargetAngleDegrees,
    areaTargetRadiusFeet: targeting.areaTargetRadiusFeet,
    areaTargetWidthFeet: targeting.areaTargetWidthFeet,
    areaTargetHeightFeet: targeting.areaTargetHeightFeet,
    areaTargetLengthFeet: targeting.areaTargetLengthFeet,
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
  if (mode === 'sculpt' && !targeting.canSculpt) return targeting
  if (mode === 'careful' && targeting.metamagic?.kind !== 'careful') return targeting
  if (mode === 'heightened' && targeting.metamagic?.kind !== 'heightened') return targeting
  return {
    ...targeting,
    sculpting: mode === 'sculpt' ? !targeting.sculpting : false,
    carefulSelecting: mode === 'careful' ? !targeting.carefulSelecting : false,
    heightenedSelecting: mode === 'heightened' ? !targeting.heightenedSelecting : false,
  }
}
