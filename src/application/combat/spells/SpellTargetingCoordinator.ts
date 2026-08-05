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
    castingClassId: targeting.castingClassId,
    racialInnate: targeting.racialInnate,
    slotLevel: targeting.slotLevel,
    targetTokenId: targetTokenIds[0] ?? input.currentTokenId ?? '',
    targetTokenIds,
    areaTargetCell: input.areaTargetCell,
    areaTargetCells: input.areaTargetCells?.map((cell) => ({ ...cell })),
    areaTargetOrientation: input.areaTargetOrientation,
    areaTargetAngleDegrees: input.areaTargetAngleDegrees,
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
