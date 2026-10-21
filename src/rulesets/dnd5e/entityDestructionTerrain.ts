import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'

/** Physical debris remains after an entity is destroyed, independently of its magic. */
export interface Dnd5eEntityDestructionTerrain {
  radiusFeet: number
  squareFeetPerMinute: number
}

export function validDnd5eEntityDestructionTerrain(value: unknown): value is Dnd5eEntityDestructionTerrain {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const raw = value as Record<string, unknown>
  return Object.keys(raw).every(key => key === 'radiusFeet' || key === 'squareFeetPerMinute') &&
    Number.isInteger(raw.radiusFeet) && Number(raw.radiusFeet) >= 1 && Number(raw.radiusFeet) <= 100 &&
    Number.isInteger(raw.squareFeetPerMinute) && Number(raw.squareFeetPerMinute) >= 1 && Number(raw.squareFeetPerMinute) <= 10000
}

export function dnd5eEntityDestructionTerrain(area: Dnd5ePluginArea, map: BattleMap): Dnd5ePluginArea | undefined {
  const declaration = area.entityProfile?.destructionTerrain
  const anchor = area.anchorCell
  const scale = map.feetPerCell ?? 5
  if (!validDnd5eEntityDestructionTerrain(declaration) || !anchor ||
    !Number.isSafeInteger(anchor.col) || !Number.isSafeInteger(anchor.row) || !Number.isFinite(scale) || scale <= 0) return undefined
  const reach = Math.ceil(declaration.radiusFeet / scale)
  if (reach > 100) return undefined
  const cells: Dnd5ePluginArea['cells'] = []
  for (let row = -reach; row <= reach; row++) for (let col = -reach; col <= reach; col++) {
    if (Math.hypot(col, row) * scale <= declaration.radiusFeet) cells.push({ col: anchor.col + col, row: anchor.row + row })
  }
  // Build a fresh physical area: never inherit attacks, grants, concentration,
  // expiry, occupant conditions or a second destruction trigger from the entity.
  return {
    id: `${area.id}:debris`, pluginId: area.pluginId, featureId: area.featureId,
    label: `${area.label} · 碎石`, color: '#9a8872',
    sourceCharacterId: area.sourceCharacterId, sourceTokenId: area.sourceTokenId,
    cells, anchorCell: { ...anchor }, anchorMode: 'fixed',
    createdRound: area.createdRound, expiresAfterRound: area.expiresAfterRound,
    permanent: true, vertical: { mode: 'ground' }, movementCostMultiplier: 2,
    terrainClearing: { squareFeetPerMinute: declaration.squareFeetPerMinute },
    hiddenFromPlayers: area.hiddenFromPlayers,
  }
}
