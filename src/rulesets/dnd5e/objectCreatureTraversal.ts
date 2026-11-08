/** Closed shared Hound/Umbral rule. It grants neither sight nor a different plane. */
export interface Dnd5eObjectCreatureTraversal {
  difficultTerrain: true
  endOwnTurnInsideObjectDamage: { amount: 5; type: 'force' }
}

export function normalizeDnd5eObjectCreatureTraversal(value: unknown): Dnd5eObjectCreatureTraversal | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>, damage = raw.endOwnTurnInsideObjectDamage
  if (Object.keys(raw).some(key => !['difficultTerrain', 'endOwnTurnInsideObjectDamage'].includes(key)) ||
    raw.difficultTerrain !== true || !damage || typeof damage !== 'object' || Array.isArray(damage)) return undefined
  const hit = damage as Record<string, unknown>
  return Object.keys(hit).every(key => ['amount', 'type'].includes(key)) && hit.amount === 5 && hit.type === 'force'
    ? { difficultTerrain: true, endOwnTurnInsideObjectDamage: { amount: 5, type: 'force' } } : undefined
}
