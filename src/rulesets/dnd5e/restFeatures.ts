import type { Character } from '../../types/character'
import { dnd5ePactSlotLevel } from './classes'

export type Dnd5eSpellSlotRecoveryFeature = 'arcane-recovery' | 'natural-recovery'

export interface Dnd5eSpellSlotRecoveryAllocation {
  level: number
  amount: number
}

export type Dnd5eRestFeatureRejectReason =
  | 'feature-unavailable'
  | 'resource-unavailable'
  | 'invalid-allocation'
  | 'recovery-limit-exceeded'
  | 'slot-already-full'

export type Dnd5eRestFeatureResult =
  | { ok: true; character: Character; recovered: number; levelsRecovered: number }
  | { ok: false; reason: Dnd5eRestFeatureRejectReason }

function featureResourceKey(feature: Dnd5eSpellSlotRecoveryFeature): string {
  return feature === 'arcane-recovery' ? 'dnd5e-arcane-recovery' : 'dnd5e-natural-recovery'
}

export function dnd5eSpellSlotRecoveryFeature(
  character: Pick<Character, 'rulesetId' | 'charClass' | 'level' | 'dnd5eClassChoices'>,
): Dnd5eSpellSlotRecoveryFeature | undefined {
  if (character.rulesetId !== 'dnd5e-2014-srd-5.1') return undefined
  if (character.charClass === '法师' && character.level >= 1) return 'arcane-recovery'
  if (
    character.charClass === '德鲁伊' && character.level >= 2 &&
    character.dnd5eClassChoices?.classes?.druid?.subclass === 'land'
  ) return 'natural-recovery'
  return undefined
}

export function dnd5eSpellSlotRecoveryLimit(
  character: Pick<Character, 'level'>,
): number {
  return Math.max(1, Math.ceil(Math.max(1, character.level) / 2))
}

export function applyDnd5eSpellSlotRecovery(
  character: Character,
  allocations: readonly Dnd5eSpellSlotRecoveryAllocation[],
): Dnd5eRestFeatureResult {
  const feature = dnd5eSpellSlotRecoveryFeature(character)
  if (!feature) return { ok: false, reason: 'feature-unavailable' }
  const resourceKey = featureResourceKey(feature)
  const featureResource = character.classResources?.[resourceKey]
  if (!featureResource || featureResource.current < 1) return { ok: false, reason: 'resource-unavailable' }
  if (
    allocations.length < 1 ||
    new Set(allocations.map((allocation) => allocation.level)).size !== allocations.length ||
    allocations.some((allocation) =>
      !Number.isInteger(allocation.level) || allocation.level < 1 || allocation.level > 5 ||
      !Number.isInteger(allocation.amount) || allocation.amount < 1,
    )
  ) return { ok: false, reason: 'invalid-allocation' }

  const levelsRecovered = allocations.reduce((total, allocation) => total + allocation.level * allocation.amount, 0)
  if (levelsRecovered > dnd5eSpellSlotRecoveryLimit(character)) {
    return { ok: false, reason: 'recovery-limit-exceeded' }
  }

  const nextResources = { ...character.classResources }
  for (const allocation of allocations) {
    const key = `dnd5e-spell-slot-${allocation.level}`
    const slot = character.classResources?.[key]
    if (!slot || slot.current + allocation.amount > slot.max) {
      return { ok: false, reason: 'slot-already-full' }
    }
    nextResources[key] = { ...slot, current: slot.current + allocation.amount }
  }
  nextResources[resourceKey] = { ...featureResource, current: featureResource.current - 1 }
  return {
    ok: true,
    character: { ...character, classResources: nextResources },
    recovered: allocations.reduce((total, allocation) => total + allocation.amount, 0),
    levelsRecovered,
  }
}

export function applyDnd5eEldritchMaster(character: Character): Dnd5eRestFeatureResult {
  if (
    character.rulesetId !== 'dnd5e-2014-srd-5.1' || character.charClass !== '邪术师' || character.level < 20
  ) return { ok: false, reason: 'feature-unavailable' }
  const feature = character.classResources?.['dnd5e-eldritch-master']
  const pactSlots = character.classResources?.['dnd5e-pact-slot']
  if (!feature || feature.current < 1) return { ok: false, reason: 'resource-unavailable' }
  if (!pactSlots || pactSlots.current >= pactSlots.max) return { ok: false, reason: 'slot-already-full' }
  const recovered = pactSlots.max - pactSlots.current
  return {
    ok: true,
    character: {
      ...character,
      classResources: {
        ...character.classResources,
        'dnd5e-pact-slot': { ...pactSlots, current: pactSlots.max },
        'dnd5e-eldritch-master': { ...feature, current: feature.current - 1 },
      },
    },
    recovered,
    levelsRecovered: recovered * dnd5ePactSlotLevel(character.level),
  }
}

/**
 * The map has no calendar subsystem yet, so a completed long rest advances the
 * Divine Intervention lockout by one day. A successful use starts at 7 and the
 * class resource stays unavailable until seven long rests have elapsed.
 */
export function applyDnd5eDivineInterventionLongRest(character: Character): Character {
  const currentCooldown = Math.max(0, Math.floor(character.dnd5eCombatState?.divineInterventionCooldownDays ?? 0))
  const remainingCooldown = Math.max(0, currentCooldown - 1)
  const intervention = character.classResources?.['dnd5e-divine-intervention']
  return {
    ...character,
    dnd5eCombatState: character.dnd5eCombatState
      ? { ...character.dnd5eCombatState, divineInterventionCooldownDays: remainingCooldown || undefined }
      : undefined,
    classResources: intervention
      ? {
          ...character.classResources,
          'dnd5e-divine-intervention': {
            ...intervention,
            current: remainingCooldown > 0 ? 0 : intervention.current,
          },
        }
      : character.classResources,
  }
}
