import { classResourceDefinitions } from '../../lib/classResources'
import type { Character } from '../../types/character'

export interface CombatSpellSlotSummary {
  key: string
  label: string
  current: number
  max: number
  level: number
  isPact: boolean
}

export function dnd5eCombatSpellSlotSummary(character: Character): CombatSpellSlotSummary[] {
  return classResourceDefinitions(character)
    .flatMap((definition): CombatSpellSlotSummary[] => {
      const normalMatch = /^dnd5e-spell-slot-([1-9])$/.exec(definition.key)
      const isPact = definition.key === 'dnd5e-pact-slot'
      if (!normalMatch && !isPact) return []
      const rawMaximum = definition.max(character)
      const maximum = Number.isFinite(rawMaximum) ? Math.max(0, rawMaximum) : 0
      if (maximum < 1) return []
      const rawCurrent = character.classResources?.[definition.key]?.current
      const current = typeof rawCurrent === 'number' && Number.isFinite(rawCurrent)
        ? Math.min(maximum, Math.max(0, rawCurrent))
        : maximum
      const pactLevelMatch = /（([1-9])环）/.exec(definition.label)
      const level = normalMatch
        ? Number(normalMatch[1])
        : Number(pactLevelMatch?.[1] ?? 0)
      return [{
        key: definition.key,
        label: isPact ? `契约${level > 0 ? `${level}环` : '位'}` : `${level}环`,
        current,
        max: maximum,
        level,
        isPact,
      }]
    })
    .sort((left, right) => left.level - right.level || Number(left.isPact) - Number(right.isPact))
}
