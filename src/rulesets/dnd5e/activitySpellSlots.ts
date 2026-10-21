import type { Dnd5eCombatant } from './headlessCombatEngine'
import { dnd5eClassDefinition, dnd5ePactSlotLevel } from './classes'

type SlotBearer = Pick<Dnd5eCombatant, 'classResources' | 'classLevels' | 'classId' | 'level'>

/** Host-owned slot selection. A pact resource cannot stand in for any requested level. */
export function dnd5eActivitySpellSlotResource(actor: SlotBearer, level: number, minimumLevel: number): string | undefined {
  if (!Number.isInteger(level) || level < 1 || level > 9 || !Number.isInteger(minimumLevel) || minimumLevel < 1 || minimumLevel > level) return undefined
  const available = (key: string) => Number.isInteger(actor.classResources[key]?.current) && actor.classResources[key].current >= 1
  const standard = `dnd5e-spell-slot-${level}`
  if (available(standard)) return standard
  if (!available('dnd5e-pact-slot')) return undefined
  const levels = { ...(actor.classId ? { [actor.classId]: actor.level } : {}), ...actor.classLevels }
  const matchingPact = Object.entries(levels).some(([id, classLevel]) =>
    Number.isInteger(classLevel) && classLevel >= 1 && classLevel <= 20 &&
    dnd5eClassDefinition(id)?.spellcasting?.kind === 'pact' && dnd5ePactSlotLevel(classLevel) === level)
  return matchingPact ? 'dnd5e-pact-slot' : undefined
}

export function dnd5eActivitySpellSlotLevels(actor: SlotBearer, minimumLevel: number): number[] {
  return Array.from({ length: 9 }, (_, index) => index + 1)
    .filter(level => dnd5eActivitySpellSlotResource(actor, level, minimumLevel) != null)
}
