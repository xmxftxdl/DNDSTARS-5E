import type { Dnd5eClassId } from './classes'

export interface Dnd5eCombatantClassIdentity {
  classId?: Dnd5eClassId
  level: number
  classLevels?: Partial<Record<Dnd5eClassId, number>>
  subclassId?: string
  subclassIds?: Partial<Record<Dnd5eClassId, string>>
}

/** Reads one class level without requiring the complete Headless combat model. */
export function dnd5eCombatantClassLevel(
  combatant: Pick<Dnd5eCombatantClassIdentity, 'classId' | 'level' | 'classLevels'>,
  classId: Dnd5eClassId,
): number {
  const stored = combatant.classLevels?.[classId]
  if (stored != null) return Math.max(0, Math.min(20, Math.floor(stored)))
  return combatant.classId === classId ? Math.max(1, Math.min(20, Math.floor(combatant.level))) : 0
}

/** Resolves the selected subclass for primary and multiclass combatants. */
export function dnd5eCombatantHasSubclass(
  combatant: Pick<Dnd5eCombatantClassIdentity, 'classId' | 'subclassId' | 'subclassIds'>,
  classId: Dnd5eClassId,
  subclassId: string,
): boolean {
  return (combatant.subclassIds?.[classId] ?? (combatant.classId === classId ? combatant.subclassId : undefined)) === subclassId
}

/** Stable unordered key for distance and symmetric combat relationships. */
export function dnd5eCombatantPairKey(leftId: string, rightId: string): string {
  return leftId < rightId ? `${leftId}\u0000${rightId}` : `${rightId}\u0000${leftId}`
}

/** Stable ordered key for sight, cover and other directional relationships. */
export function dnd5eDirectedCombatantPairKey(actorId: string, targetId: string): string {
  return `${actorId}\u0000${targetId}`
}
