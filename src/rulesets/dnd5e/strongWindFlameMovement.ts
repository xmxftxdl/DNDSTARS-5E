import { reconcileDnd5ePersistentAreaAnchors } from './coreSpellAreas'
import { prepareStrongWindGeometryFlames } from './strongWindGeometryFlames'
import type { MapGeometryLight } from '../../lib/mapGeometry'
import { areaExtinguishesExposedFlame } from './areaFlamePolicy'
import { isFlameLight, isFlameProtected } from '../../../shared/flame-light-concealment.mjs'
import type { BattleMap } from '../../store/maps'
import { tokenAnchorCellFromPixel, tokenCenterForAnchorCell } from '../../lib/gridCombat'
import { dnd5eMovementPathCells } from './itemAreas'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'
import { STRONG_WIND_FLAME_RECEIPT_PREFIX, collectStrongWindProtectedFlames,
  reconcileStrongWindFlameReceipts, settleStrongWindProtectedFlame } from './strongWindFlames'

/** Runs inside the owning movement transaction; waypoint projections are never published. */
export async function settleStrongWindFlamesAlongMovement(input: {
  beforeMap: BattleMap; map: BattleMap; tokenId: string; round: number; transactionId: string
  path: readonly { x: number; y: number }[]; pathElevationsFeet?: readonly number[]
  lights?: readonly MapGeometryLight[]; worldMinute?: number
  roll: (candidate: ReturnType<typeof collectStrongWindProtectedFlames>[number]) => Promise<number>
}): Promise<{ map: BattleMap; logs: string[]; lights?: readonly MapGeometryLight[] }> {
  const finalToken = input.map.tokens.find(t => t.id === input.tokenId)
  const movingWards = (input.map.dnd5ePluginAreas ?? []).filter(area =>
    area.extinguishesUnprotectedFlames === 'torch-or-smaller' && area.anchorMode === 'source-token' &&
    (area.anchorTokenId ?? area.sourceTokenId) === input.tokenId && !area.modeState?.paused &&
    (area.permanent || (input.round <= area.expiresAfterRound &&
      (input.worldMinute == null || area.expiresAtWorldMinute == null || input.worldMinute < area.expiresAtWorldMinute))))
  if (!finalToken || !input.path.length || (!movingWards.length &&
    (!finalToken.lightSource?.enabled || finalToken.lightSource.flame === false || !isFlameLight(finalToken.lightSource))) ||
    !input.map.dnd5ePluginAreas?.some(area => area.extinguishesUnprotectedFlames || area.strongWind || (area.sourceKind === 'core-spell' && area.coreSpellId === 'gust-of-wind'))) {
    return { map: input.map, logs: [], lights: input.lights }
  }
  let map: BattleMap = { ...input.map, dnd5ePluginAreas: input.map.dnd5ePluginAreas?.map(area => {
    if (!area.strongWind && !(area.sourceKind === 'core-spell' && area.coreSpellId === 'gust-of-wind')) return area
    // Final-position reconciliation may have removed the starting exposure receipt.
    // Restore only this mover's wind receipts, preserving all settled spell receipts.
    const prior = input.beforeMap.dnd5ePluginAreas?.find(a => a.id === area.id)?.triggerReceipts ?? []
    return { ...area, triggerReceipts: [
      ...(area.triggerReceipts ?? []).filter(r => r.targetTokenId !== input.tokenId || !r.triggerId.startsWith(STRONG_WIND_FLAME_RECEIPT_PREFIX)),
      ...prior.filter(r => r.targetTokenId === input.tokenId && r.triggerId.startsWith(STRONG_WIND_FLAME_RECEIPT_PREFIX)),
    ] }
  }) }
  const points: { x: number; y: number; elevationFeet?: number }[] = []
  for (let index = 0; index < input.path.length; index++) {
    const to = input.path[index], from = input.path[Math.max(0, index - 1)]
    const cells = dnd5eMovementPathCells(tokenAnchorCellFromPixel(from.x, from.y, finalToken, map),
      tokenAnchorCellFromPixel(to.x, to.y, finalToken, map))
    const startHeight = input.pathElevationsFeet?.[Math.max(0, index - 1)]
    const endHeight = input.pathElevationsFeet?.[index]
    const hasHeights = Number.isFinite(startHeight) && Number.isFinite(endHeight)
    const steps = Math.max(cells.length - 1, hasHeights
      ? Math.ceil(Math.abs(endHeight! - startHeight!) / Math.max(1, map.feetPerCell ?? 5)) : 0)
    for (let step = index ? 1 : 0; step <= steps; step++) {
      const ratio = steps ? step / steps : 0
      const cell = cells[Math.min(cells.length - 1, Math.round(ratio * (cells.length - 1)))]
      points.push({ ...tokenCenterForAnchorCell(cell, finalToken, map),
        elevationFeet: hasHeights ? startHeight! + (endHeight! - startHeight!) * ratio : undefined })
    }

  }
  let lights = input.lights
  const logs: string[] = []
  let rollIndex = 0
  for (const point of points) {
    map = { ...map, tokens: map.tokens.map(t => t.id === input.tokenId ? {
      ...t, x: point.x, y: point.y, elevationFeet: point.elevationFeet ?? finalToken.elevationFeet,
    } : t) }
    if (movingWards.length) {
      // Project only the moving flame wards; never publish waypoints or re-run unrelated hazards.
      const swept = reconcileDnd5ePersistentAreaAnchors({ ...map, dnd5ePluginAreas: movingWards })
      const tokens = map.tokens.map(token => {
        const light = token.lightSource
        if (!light?.enabled || !isFlameLight(light) || isFlameProtected(light) ||
          !swept.dnd5ePluginAreas?.some(area => areaExtinguishesExposedFlame(area, light) &&
            !area.excludedTargetIds?.includes(token.id) && dnd5eTokenIntersectsPersistentAreaAt(token, swept, area, token))) return token
        logs.push(`${token.label} 的明火被移动中的风区熄灭。`)
        return { ...token, lightSource: undefined }
      })
      if (tokens.some((token, index) => token !== map.tokens[index])) map = { ...map, tokens }
      if (lights && input.worldMinute != null) lights = prepareStrongWindGeometryFlames({
        map: swept, lights, round: input.round, worldMinute: input.worldMinute,
      }).lights
    }
    map = reconcileStrongWindFlameReceipts(map)
    const mover = map.tokens.find(t => t.id === input.tokenId)!
    if (mover.lightSource?.enabled && mover.lightSource.flame !== false &&
      isFlameLight(mover.lightSource) && !isFlameProtected(mover.lightSource) &&
      map.dnd5ePluginAreas?.some(area => areaExtinguishesExposedFlame(area, mover.lightSource!) &&
        !area.excludedTargetIds?.includes(mover.id) && dnd5eTokenIntersectsPersistentAreaAt(mover, map, area, mover))) {
      map = { ...map, tokens: map.tokens.map(t => t.id === mover.id ? { ...t, lightSource: undefined } : t) }
      logs.push(`${mover.label} 经过强风区域，明火熄灭。`)
    }
    for (const candidate of collectStrongWindProtectedFlames(map).filter(c => c.tokenId === input.tokenId)) {
      // Another overlapping wind may already have extinguished this light.
      if (!collectStrongWindProtectedFlames(map).some(c => c.areaId === candidate.areaId && c.tokenId === candidate.tokenId)) continue
      const d100 = await input.roll(candidate)
      const next = settleStrongWindProtectedFlame(map, { ...candidate, d100, round: input.round,
        transactionId: `${input.transactionId}:${rollIndex++}` })
      if (!next) throw new Error('strong-wind-flame-movement-roll-invalid')
      map = next
      logs.push(`${candidate.targetName} 经过强风区域，受保护火焰 d100=${d100}：${d100 <= 50 ? '熄灭' : '继续燃烧'}。`)
    }
  }
  map = { ...map, tokens: map.tokens.map(t => t.id === input.tokenId ? {
    ...t, x: finalToken.x, y: finalToken.y, elevationFeet: finalToken.elevationFeet,
  } : t) }
  return { map: reconcileStrongWindFlameReceipts(map), logs, lights }
}
