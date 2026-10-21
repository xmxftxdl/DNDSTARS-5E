// A restored corpse/object can keep its token ID, but no longer owns the
// initiative slots of the creature it temporarily represented.
export function concentrationInitiativeCleanup(combat, before, after) {
  if (!combat?.active || !Array.isArray(combat.initiativeOrder)) return combat
  const oldMap = before?.maps?.find(map => map.id === combat.mapId)
  const newMap = after?.maps?.find(map => map.id === combat.mapId)
  if (!oldMap || !newMap) return combat
  const nextTokens = new Map(newMap.tokens.map(token => [token.id, token]))
  const removed = new Set(oldMap.tokens.filter(token => {
    const next = nextTokens.get(token.id)
    return !next || (token.dnd5eSummon && !next.dnd5eSummon)
  }).map(token => token.id))
  const order = combat.initiativeOrder
  const kept = order.map((entry, index) => ({ entry, index })).filter(value => !removed.has(value.entry.tokenId))
  if (kept.length === order.length) return combat
  const current = Math.max(0, Math.min(order.length - 1, combat.initiativeIndex ?? 0))
  const successor = kept.findIndex(value => value.index >= current)
  const wrapped = kept.length > 0 && successor < 0
  const economy = { ...combat.dnd5eTurnEconomyByToken }
  for (const id of removed) delete economy[id]
  return { ...combat, initiativeOrder: kept.map(value => value.entry),
    initiativeIndex: successor < 0 ? 0 : successor,
    round: wrapped ? (combat.round ?? 1) + 1 : combat.round,
    dnd5eTurnEconomyByToken: economy }
}
