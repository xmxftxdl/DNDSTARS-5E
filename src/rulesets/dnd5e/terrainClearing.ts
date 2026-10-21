import { validTerrainClearing, validTerrainClearingProgress } from '../../../shared/terrain-clearing.mjs'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { cellToPixel, tokenOccupiedCellsAt, type GridCell } from '../../lib/gridCombat'
import { mapGeometryLineOfEffectBlocked, mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation } from '../../lib/mapGeometry'
import { advanceCampaignTimeSnapshot, type SharedCampaignTimeState } from '../../lib/campaignTime'
import { dnd5eConditionIncapacitated } from './conditions'
import { dnd5eConditionsFromActiveEffects, normalizeDnd5eActiveEffects } from './activeEffects'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { spendDnd5eTurnResource } from './turnEconomy'

export type TerrainClearingResult = { ok: true; map: BattleMap; campaignTime: SharedCampaignTimeState; minutes: number;
  turnEconomy?: Dnd5eTurnEconomyCounts; progress?: { workedRounds: number; requiredRounds: number; completed: boolean } }
  | { ok: false; reason: string }

/** Prepare both changes from one Host snapshot. Caller must atomically commit map and clock with revision guards. */
export function prepareDnd5eTerrainClearing(input: {
  map: BattleMap; characters: readonly Character[]; actorTokenId: string; areaId: string;
  cells: readonly GridCell[]; campaignTime: SharedCampaignTimeState; combatActive: boolean;
  transactionId: string; now: number
  /** Host snapshot only; never read combat facts from the player's cell request. */
  combat?: { id: string; round: number; currentTokenId: string; turnEconomy: Dnd5eTurnEconomyCounts }
}): TerrainClearingResult {
  const fail = (reason: string): TerrainClearingResult => ({ ok: false, reason })
  if (input.combatActive && (!input.combat || !input.combat.id.trim() || input.combat.id.length > 160 ||
    !Number.isSafeInteger(input.combat.round) || input.combat.round < 1 || input.combat.currentTokenId !== input.actorTokenId)) return fail('terrain-clearing-invalid-turn')
  if (!input.transactionId || input.transactionId.length > 160 || !Number.isSafeInteger(input.now) || input.now < 0) return fail('invalid-terrain-clearing')
  const advanceId = `terrain-clearing:${input.transactionId}`
  if (input.campaignTime.advances.some(a => a.id === advanceId)) return fail('terrain-clearing-already-completed')
  const area = input.map.dnd5ePluginAreas?.find(a => a.id === input.areaId)
  if (!area || !validTerrainClearing(area.terrainClearing) || area.vertical?.mode !== 'ground' ||
    area.permanent !== true || area.concentrationId || (area.anchorMode && area.anchorMode !== 'fixed')) return fail('terrain-clearing-unavailable')
  if (!validTerrainClearingProgress(area.terrainClearingProgress, area.cells)) return fail('invalid-terrain-clearing-progress')
  if (!Array.isArray(input.cells) || !input.cells.length || input.cells.length > 256 ||
    input.cells.some(c => !c || !Number.isSafeInteger(c.col) || !Number.isSafeInteger(c.row))) return fail('invalid-terrain-clearing-cells')
  const key = (c: GridCell) => `${c.col}:${c.row}`
  const keys = new Set(input.cells.map(key)), areaKeys = new Set(area.cells.map(key))
  if (keys.size !== input.cells.length || [...keys].some(k => !areaKeys.has(k))) return fail('invalid-terrain-clearing-cells')
  const actor = input.map.tokens.find(t => t.id === input.actorTokenId && t.type !== 'obstacle')
  if (!actor) return fail('terrain-clearing-actor-unavailable')
  const character = input.characters.find(c => c.id === actor.characterId)
  if (actor.characterId && !character) return fail('terrain-clearing-actor-unavailable')
  const hp = character?.currentHp ?? actor.hp
  const state = character?.dnd5eCombatState ?? actor.dnd5eCombatState
  const conditions = [...(character ? character.conditions : actor.dnd5eCombatState?.conditions ?? []),
    ...dnd5eConditionsFromActiveEffects(normalizeDnd5eActiveEffects(state?.activeEffects))]
  if (hp == null || hp <= 0 || state?.stunnedByActorId || dnd5eConditionIncapacitated({ conditions })) return fail('terrain-clearing-actor-unavailable')
  const feet = input.map.feetPerCell ?? 5
  if (!Number.isFinite(feet) || feet <= 0 || feet > 1000) return fail('invalid-terrain-clearing-scale')
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const elevation = mapGeometryTokenElevation(geometry, actor)
  if (Math.abs(elevation - mapGeometryTerrainElevationAtPoint(geometry, actor)) > 1e-4) return fail('terrain-clearing-out-of-reach')
  const occupied = tokenOccupiedCellsAt(actor, input.map, actor)
  for (const cell of input.cells) {
    const point = cellToPixel(cell, input.map), ground = mapGeometryTerrainElevationAtPoint(geometry, point)
    const distance = Math.min(...occupied.map(c => Math.max(Math.abs(c.col-cell.col), Math.abs(c.row-cell.row)))) * feet
    if (distance > 5 || Math.abs(ground-elevation) > 5 || mapGeometryLineOfEffectBlocked({
      geometry, map: input.map, from: actor, to: point, fromElevationFeet: elevation, toElevationFeet: ground,
    })) return fail('terrain-clearing-out-of-reach')
  }
  const requiredRounds = Math.max(1, Math.ceil(feet * feet * 10 / area.terrainClearing.squareFeetPerMinute))
  const previousProgress = area.terrainClearingProgress ?? []
  if (input.combatActive && input.combat) {
    if (input.cells.length !== 1) return fail('terrain-clearing-one-cell-per-action')
    const cell = input.cells[0], previous = previousProgress.find(p => key(p) === key(cell))
    if (previous?.lastCombatId === input.combat.id && previous.lastRound >= input.combat.round) return fail('terrain-clearing-round-already-worked')
    const spent = spendDnd5eTurnResource(input.combat.turnEconomy, 'action')
    if (!spent.ok) return fail('terrain-clearing-action-unavailable')
    const workedRounds = (previous?.workedRounds ?? 0) + 1
    const completed = workedRounds >= requiredRounds
    const progress = previousProgress.filter(p => key(p) !== key(cell))
    if (!completed) progress.push({ ...cell, workedRounds, lastCombatId: input.combat.id, lastRound: input.combat.round })
    const cells = completed ? area.cells.filter(c => key(c) !== key(cell)) : area.cells
    return { ok: true, minutes: 0, campaignTime: input.campaignTime, turnEconomy: spent.economy,
      progress: { workedRounds, requiredRounds, completed }, map: { ...input.map,
        dnd5ePluginAreas: input.map.dnd5ePluginAreas!.flatMap(a => a.id !== area.id ? [a] : cells.length ? [{ ...a,
          cells, terrainClearingProgress: progress.length ? progress : undefined,
          rectGeometry: completed ? undefined : a.rectGeometry,
        }] : []),
      } }
  }
  const remainingRounds = input.cells.reduce((total, cell) => total + Math.max(0,
    requiredRounds - (previousProgress.find(p => key(p) === key(cell))?.workedRounds ?? 0)), 0)
  const minutes = Math.max(1, Math.ceil(remainingRounds / 10))
  const campaignTime = advanceCampaignTimeSnapshot({ state: input.campaignTime, minutes, now: input.now,
    advanceId, reason: `清理${area.label}` })
  if (!campaignTime) return fail('terrain-clearing-clock-unavailable')
  const cells = area.cells.filter(c => !keys.has(key(c)))
  return { ok: true, minutes, campaignTime, map: { ...input.map,
    dnd5ePluginAreas: input.map.dnd5ePluginAreas!.flatMap(a => a.id !== area.id ? [a] :
      cells.length ? [{ ...a, cells, rectGeometry: undefined,
        terrainClearingProgress: previousProgress.filter(p => !keys.has(key(p))),
      }] : []),
  } }
}
