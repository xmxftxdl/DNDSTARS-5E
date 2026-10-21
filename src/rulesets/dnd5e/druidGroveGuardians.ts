import { dnd5eMonsterToEnemyTemplate, enemyTemplateToTokenPatch } from '../../lib/enemyPool'
import { cellKey, tokenOccupiedCellsAt } from '../../lib/gridCombat'
import { mapGeometryPlacementBlocked } from '../../lib/mapGeometry'
import type { Token, Dnd5ePluginArea } from '../../store/maps'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { getDnd5eSrdMonsterBySlug } from './monsters'
import { prepareDnd5eDruidGroveFog } from './druidGroveFog'
import { prepareDnd5eDruidGroveMapPlacement } from './druidGroveMapPlacement'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'

export interface Dnd5eDruidGroveGuardianPlan {
  /** Keep this complete snapshot for later rooting/restoration; do not replace it with monster data. */
  originalTree: Token
  guardian: Token
  castId: string
  sourceTokenId: string
}

/** Prepares replacements only. The owning cast must also install control, boundaries and restoration. */
export function prepareDnd5eDruidGroveGuardians(input: Parameters<typeof prepareDnd5eDruidGroveFog>[0]) {
  const validation = prepareDnd5eDruidGroveFog(input)
  if (!validation.ok) return validation
  const placement = prepareDnd5eDruidGroveMapPlacement(input)
  if (!placement.ok) return placement
  const monster = getDnd5eSrdMonsterBySlug('awakened-tree')
  if (!monster) return { ok: false as const, reason: 'missing-awakened-tree-data' }
  const patch = enemyTemplateToTokenPatch(dnd5eMonsterToEnemyTemplate(monster))
  const protectedCells = new Set(placement.protectedCells.map(cellKey))
  const selected = new Set(placement.guardianTreeIds)
  const occupied = new Set(input.map.tokens.filter(token => !selected.has(token.id) &&
    (token.type !== 'obstacle' || token.obstacleKind !== 'marker')).flatMap(token => tokenOccupiedCellsAt(token, input.map, token)).map(cellKey))
  const plans: Dnd5eDruidGroveGuardianPlan[] = []
  for (const id of placement.guardianTreeIds) {
    const tree = input.map.tokens.find(token => token.id === id)!
    const guardian: Token = { ...structuredClone(tree), ...patch, id: tree.id,
      x: tree.x, y: tree.y, characterId: undefined, type: 'enemy', obstacleKind: undefined,
      dnd5eObjectState: undefined, dnd5eSummon: undefined, dnd5eSpellEffect: undefined,
      dnd5eGroveGuardian: { schemaVersion: 1, castId: input.source.castId,
        boundaryAreaId: `${input.source.castId}:guardian-boundary`, sourceTokenId: input.source.tokenId,
        originalTree: structuredClone(tree) },
      dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({
        id: `${input.source.castId}:guardian-mute:${id}`, definitionId: `${input.source.pluginId}:grove-guardian-mute`,
        label: '林地守卫 · 无法说话', targetId: id,
        source: { kind: 'spell', actorId: input.source.tokenId, pluginId: input.source.pluginId, rulesId: input.source.spellId, magical: true },
        duration: { type: 'permanent' }, modifiers: { actionRestriction: { prohibited: ['speech'] } },
      })] },
    }
    const footprint = tokenOccupiedCellsAt(guardian, input.map, guardian)
    if (footprint.some(cell => !protectedCells.has(cellKey(cell)) || occupied.has(cellKey(cell))) ||
      mapGeometryPlacementBlocked({ map: input.map, geometry: input.geometry, token: guardian, at: guardian }).blocked) {
      return { ok: false as const, reason: 'guardian-position-blocked' }
    }
    footprint.forEach(cell => occupied.add(cellKey(cell)))
    plans.push({ originalTree: structuredClone(tree), guardian, castId: input.source.castId, sourceTokenId: input.source.tokenId })
  }
  const boundary: Dnd5ePluginArea | undefined = plans.length ? {
    id: `${input.source.castId}:guardian-boundary`, pluginId: input.source.pluginId,
    featureId: `${input.source.pluginId}:${input.source.spellId}`, label: '林地守卫 · 活动边界', color: '#4d7c0f',
    sourceCharacterId: input.source.characterId, sourceTokenId: input.source.tokenId,
    slotLevel: input.source.slotLevel,
    effectGroup: { castId: input.source.castId, effectId: 'guardians' },
    cells: placement.protectedCells.map(cell => ({ ...cell })), anchorMode: 'fixed', anchorCell: { ...input.placement.origin },
    vertical: { mode: 'volume', baseElevationFeet: input.baseElevationFeet, heightFeet: input.placement.sideFeet },
    createdRound: input.round, expiresAfterRound: input.round + 14_400 - 1,
    createdWorldMinute: input.worldMinute, expiresAtWorldMinute: input.worldMinute + 1_440,
    blocking: { movement: true, movementMode: 'exit', restrictedTokenIds: plans.map(plan => plan.guardian.id),
      containEntireTokenOnExit: true, blocksTeleportationExit: true },
    hiddenFromPlayers: true,
    excludedTargetIds: [...new Set(input.exemptTokenIds ?? [])],
  } : undefined
  if (boundary) boundary.groveInitialOccupantIds = input.map.tokens.filter(token => token.type !== 'obstacle' &&
    dnd5eTokenIntersectsPersistentAreaAt(token, input.map, boundary, token)).map(token => token.id)
  return { ok: true as const, plans, boundary }
}
