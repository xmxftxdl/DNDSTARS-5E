import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { Dnd5eImportedSpell } from './spellbook'
import { dnd5eSpellUpcastTotals } from './spellMechanics'

export function dnd5ePluginSpellUsesSelfTarget(
  spell: Pick<Dnd5eImportedSpell, 'range'>,
  activity?: { readonly target: { readonly kind: string } },
): boolean {
  // Once an audited Activity exists it owns the target contract. Some SRD
  // catalogue entries describe an emanation/sensor origin as "self" while
  // the Activity correctly asks the player to select another creature.
  return activity ? activity.target.kind === 'self' : spell.range.type === 'self'
}

function placementRangeFeet(spell: Pick<Dnd5eImportedSpell, 'range'>): number {
  if (spell.range.type === 'self') return 0
  if (spell.range.type === 'touch') return 5
  if (spell.range.type === 'distance') return spell.range.feet ?? 0
  if (spell.range.type === 'sight' || spell.range.type === 'unlimited') return 10_000
  return spell.range.feet ?? 0
}

export function dnd5ePluginSpellArea(
  spell: Pick<Dnd5eImportedSpell, 'range'>,
): SkillAoeTargeting | undefined {
  const shape = spell.range.shape
  if (!shape) return undefined
  const size = Math.max(1, spell.range.sizeFeet ?? 5)
  const placement = placementRangeFeet(spell)
  if (shape === 'cone') {
    return { shape: 'cone', origin: 'self', lengthFeet: size, minimumLengthFeet: spell.range.adjustable ? 5 : undefined, aimRangeFeet: placement }
  }
  if (shape === 'line') {
    return {
      shape: 'line', origin: 'self', widthFeet: Math.max(1, spell.range.widthFeet ?? 5),
      lengthFeet: size, minimumLengthFeet: spell.range.adjustable ? 5 : undefined, aimRangeFeet: placement,
    }
  }
  if (shape === 'cube') {
    return {
      shape: 'rect', origin: 'point', widthFeet: size, heightFeet: size,
      minimumWidthFeet: spell.range.adjustable ? 5 : undefined,
      minimumHeightFeet: spell.range.adjustable ? 5 : undefined,
      placeRangeFeet: placement, rotatable: false, gridAligned: true,
    }
  }
  if (shape === 'rect') {
    return {
      shape: 'rect', origin: 'point',
      widthFeet: Math.max(1, spell.range.widthFeet ?? 5),
      heightFeet: Math.max(1, spell.range.heightFeet ?? 5),
      minimumWidthFeet: spell.range.adjustable ? 5 : undefined,
      minimumHeightFeet: spell.range.adjustable ? 5 : undefined,
      placeRangeFeet: placement,
      rotatable: spell.range.type !== 'self' && spell.range.rotatable === true,
    }
  }
  return {
    shape: 'circle',
    origin: spell.range.type === 'self' ? 'self' : 'point',
    radiusFeet: size,
    minimumRadiusFeet: spell.range.adjustable ? 5 : undefined,
    ...(spell.range.type === 'self' ? {} : { placeRangeFeet: placement }),
  }
}

export function dnd5ePluginSpellTargetCapacity(
  spell: Pick<Dnd5eImportedSpell, 'level' | 'mechanics' | 'targeting'>,
  slotLevel: number,
  scaledActivityTargetCount?: number,
): { maximumTargets: number; allowDuplicateTargets: boolean } {
  const upcast = dnd5eSpellUpcastTotals(spell.mechanics, slotLevel, spell.level)
  const base = Math.max(1, Math.min(256, spell.targeting?.maximumTargets ?? 1))
  const allowDuplicateTargets = upcast.additionalProjectiles > 0
  const increment = upcast.additionalTargets + upcast.additionalProjectiles
  const activityMaximum = !allowDuplicateTargets && scaledActivityTargetCount != null
    ? Math.max(1, Math.min(256, Math.floor(scaledActivityTargetCount)))
    : undefined
  return {
    // The audited Activity is the Host contract. Some SRD catalogue entries
    // predate their audited scaling definition and do not repeat it here.
    maximumTargets: activityMaximum ?? Math.max(1, Math.min(256, base + increment)),
    allowDuplicateTargets,
  }
}
