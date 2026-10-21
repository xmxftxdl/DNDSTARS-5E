import type { Dnd5eCombatant } from './headlessCombatEngine'

/** Anatomical existence is a Host fact; missingBodyParts records subsequent loss. */
export interface Dnd5eLethalBodyPartDestruction {
  part: string
  vital: boolean
}

export function isDnd5eBodyPartPresence(value: unknown): value is Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value)
  return entries.length <= 32 && entries.every(([part, present]) => /^[a-z][a-z0-9-]{0,63}$/.test(part) && typeof present === 'boolean')
}

export function isDnd5eLethalBodyPartDestruction(value: unknown): value is Dnd5eLethalBodyPartDestruction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return Object.keys(v).every(key => key === 'part' || key === 'vital') &&
    typeof v.part === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(v.part) && typeof v.vital === 'boolean'
}

/** Called only after newly lethal damage, including a failed deferred death-prevention save. */
export function destroyDnd5eBodyPartAfterLethalDamage(target: Dnd5eCombatant, consequence: Dnd5eLethalBodyPartDestruction, present = target.classState.bodyPartPresence?.[consequence.part]): void {
  if (present !== true) return
  if (target.deathSaves.dead && target.classState.bodyPresent !== false) {
    target.classState.missingBodyParts = [...new Set([...(target.classState.missingBodyParts ?? []), consequence.part])]
    if (consequence.vital) target.classState.vitalBodyPartsMissing = true
  } else if (target.classState.undeadFortitudePending) {
    target.classState.undeadFortitudePending.destroysBodyPartOnDeath = { ...consequence }
  }
}
