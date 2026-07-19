import type { Character } from '../../types/character'
import { dnd5eDruidWildShapeLimits } from './classes'
import { DND5E_SRD_MONSTERS, type Dnd5eMonsterStatBlock } from './monsters'

export const DND5E_WILD_SHAPE_KNOWN_FORMS_KEY = 'wild-shape-known-forms'

export function dnd5eChallengeRatingValue(rating: string): number {
  const [numerator, denominator] = rating.split('/')
  const value = denominator == null ? Number(numerator) : Number(numerator) / Number(denominator)
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY
}

export function dnd5eWildShapeDurationHours(level: number): number {
  return Math.max(1, Math.floor(Math.min(20, Math.max(2, level)) / 2))
}

export function dnd5eAvailableWildShapeForms(
  character: Pick<Character, 'charClass' | 'level'>,
  monsters: readonly Dnd5eMonsterStatBlock[] = DND5E_SRD_MONSTERS,
): readonly Dnd5eMonsterStatBlock[] {
  if (character.charClass !== '德鲁伊' || character.level < 2) return []
  return monsters.filter((monster) => dnd5eWildShapeFormAllowedForLevel(character.level, monster))
}

export function dnd5eWildShapeFormAllowedForLevel(level: number, monster: Dnd5eMonsterStatBlock): boolean {
  if (level < 2) return false
  const limits = dnd5eDruidWildShapeLimits(level)
  return (monster.creatureType === '野兽' || monster.creatureType.toLowerCase() === 'beast') &&
    dnd5eChallengeRatingValue(monster.challenge.rating) <= dnd5eChallengeRatingValue(limits.maxChallengeRating) &&
    (limits.swim || monster.speed.swim == null) &&
    (limits.fly || monster.speed.fly == null)
}

export function dnd5eKnownWildShapeForms(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassChoices'>,
): readonly Dnd5eMonsterStatBlock[] {
  const known = new Set(character.dnd5eClassChoices?.classes?.druid?.selections?.[DND5E_WILD_SHAPE_KNOWN_FORMS_KEY] ?? [])
  return dnd5eAvailableWildShapeForms(character).filter((monster) => known.has(monster.id))
}

export function dnd5eCanWildShapeInto(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassChoices'>,
  formId: string,
): boolean {
  return dnd5eKnownWildShapeForms(character).some((monster) => monster.id === formId)
}
