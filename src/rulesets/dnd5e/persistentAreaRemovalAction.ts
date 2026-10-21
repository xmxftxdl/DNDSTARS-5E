import type { Dnd5eActiveEffectRemoval } from './activeEffects'

export type Dnd5ePersistentAreaRemovalAction = NonNullable<Dnd5eActiveEffectRemoval['action']>
export type Dnd5ePersistentAreaRemovalActionDeclaration = Omit<Dnd5ePersistentAreaRemovalAction, 'abilityCheck'> & {
  abilityCheck?: Omit<NonNullable<Dnd5ePersistentAreaRemovalAction['abilityCheck']>, 'dc'> & { dc: number | 'source-save-dc' }
}

/** Resolved snapshots accept concrete DCs only; declaration binding happens at creation. */
export function normalizePersistentAreaRemovalAction(value: unknown): Dnd5ePersistentAreaRemovalAction | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some(key => !['label', 'economy', 'maxDistanceFeet', 'selfOnly', 'abilityCheck'].includes(key)) ||
    (raw.selfOnly !== undefined && raw.selfOnly !== true) ||
    typeof raw.label !== 'string' || !raw.label.trim() || raw.label.length > 120 || raw.economy !== 'action' ||
    typeof raw.maxDistanceFeet !== 'number' || !Number.isFinite(raw.maxDistanceFeet) || raw.maxDistanceFeet < 0 || raw.maxDistanceFeet > 1000) return undefined
  const check = raw.abilityCheck as Record<string, unknown> | undefined
  if (raw.abilityCheck !== undefined && (!check || typeof check !== 'object' || Array.isArray(check) ||
    Object.keys(check).some(key => !['ability', 'skill', 'dc'].includes(key)) ||
    typeof check.ability !== 'string' || !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(check.ability) ||
    (check.skill !== undefined && (typeof check.skill !== 'string' || !['medicine', 'arcana', 'athletics'].includes(check.skill))) ||
    !Number.isInteger(check.dc) || Number(check.dc) < 1 || Number(check.dc) > 100)) return undefined
  return { label: raw.label.trim(), economy: 'action', maxDistanceFeet: raw.maxDistanceFeet,
    ...(raw.selfOnly === true ? {selfOnly:true as const} : {}),
    ...(check ? { abilityCheck: { ability: check.ability as NonNullable<Dnd5ePersistentAreaRemovalAction['abilityCheck']>['ability'],
      ...(check.skill !== undefined ? { skill: check.skill as 'medicine' | 'arcana' | 'athletics' } : {}), dc: Number(check.dc) } } : {}) }
}
