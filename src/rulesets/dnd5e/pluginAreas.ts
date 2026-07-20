import {
  cellKey,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eMovementPathCells } from './itemAreas'
import type {
  Dnd5ePersistentAreaTriggerSnapshot,
  Dnd5ePersistentAreaTriggerTiming,
} from './persistentAreaTypes'

export interface Dnd5ePersistentAreaTriggerCandidate {
  area: Dnd5ePluginArea
  trigger: Dnd5ePersistentAreaTriggerSnapshot
  targetToken: Token
  transactionId: string
  enteredAt?: GridCell
  pathIndex?: number
}

function tokenIntersectsAreaAt(
  token: Token,
  map: BattleMap,
  area: Dnd5ePluginArea,
  position: { x: number; y: number },
): boolean {
  const areaCells = new Set(area.cells.map(cellKey))
  return tokenOccupiedCellsAt(token, map, position).some((cell) => areaCells.has(cellKey(cell)))
}

function areaAllowsTarget(area: Dnd5ePluginArea, target: Token, map: BattleMap): boolean {
  if (target.type === 'obstacle') return false
  if (target.id === area.sourceTokenId && area.includeSelf !== true) return false
  const source = map.tokens.find((token) => token.id === area.sourceTokenId)
  if (!source || area.relation === 'any' || !area.relation) return true
  const opposed = areOpposedCombatTokens(source, target)
  return area.relation === 'enemy' ? opposed : !opposed
}

function alreadyTriggeredThisRound(
  area: Dnd5ePluginArea,
  trigger: Dnd5ePersistentAreaTriggerSnapshot,
  targetTokenId: string,
  round: number,
): boolean {
  if (trigger.oncePerRound === false) return false
  return (area.triggerReceipts ?? []).some((receipt) =>
    receipt.triggerId === trigger.id && receipt.targetTokenId === targetTokenId && receipt.round === round,
  )
}

function candidate(
  area: Dnd5ePluginArea,
  trigger: Dnd5ePersistentAreaTriggerSnapshot,
  targetToken: Token,
  round: number,
  occurrence: string,
  enteredAt?: GridCell,
  pathIndex?: number,
): Dnd5ePersistentAreaTriggerCandidate {
  return {
    area,
    trigger,
    targetToken,
    transactionId: `area-trigger:${area.id}:${trigger.id}:${targetToken.id}:${round}:${occurrence}`,
    enteredAt,
    pathIndex,
  }
}

export function collectDnd5ePersistentAreaTriggers(input: {
  map: BattleMap
  timing: Dnd5ePersistentAreaTriggerTiming
  round: number
  targetTokenId?: string
  areaId?: string
  movement?: { token: Token; to: { x: number; y: number } }
}): Dnd5ePersistentAreaTriggerCandidate[] {
  const areas = (input.map.dnd5ePluginAreas ?? []).filter((area) => !input.areaId || area.id === input.areaId)
  if (areas.length === 0) return []
  const out: Dnd5ePersistentAreaTriggerCandidate[] = []

  if (input.timing === 'on-enter') {
    const movement = input.movement
    if (!movement) return []
    const target = movement.token
    const from = tokenAnchorCellFromPixel(target.x, target.y, target, input.map)
    const to = tokenAnchorCellFromPixel(movement.to.x, movement.to.y, target, input.map)
    const path = dnd5eMovementPathCells(from, to)
    for (const area of areas) {
      if (!areaAllowsTarget(area, target, input.map)) continue
      let inside = tokenIntersectsAreaAt(target, input.map, area, target)
      let occurrence = 0
      for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
        const position = tokenCenterForAnchorCell(path[pathIndex], target, input.map)
        const nextInside = tokenIntersectsAreaAt(target, input.map, area, position)
        if (!inside && nextInside) {
          for (const trigger of area.triggers ?? []) {
            if (trigger.timing !== 'on-enter' || alreadyTriggeredThisRound(area, trigger, target.id, input.round)) continue
            out.push(candidate(area, trigger, target, input.round, `enter-${pathIndex}-${occurrence}`, path[pathIndex], pathIndex))
          }
          occurrence += 1
        }
        inside = nextInside
      }
    }
    return out.sort((left, right) => (left.pathIndex ?? 0) - (right.pathIndex ?? 0))
  }

  const targets = input.targetTokenId
    ? input.map.tokens.filter((token) => token.id === input.targetTokenId)
    : input.map.tokens
  for (const area of areas) {
    for (const target of targets) {
      if (!areaAllowsTarget(area, target, input.map) || !tokenIntersectsAreaAt(target, input.map, area, target)) continue
      for (const trigger of area.triggers ?? []) {
        if (trigger.timing !== input.timing || alreadyTriggeredThisRound(area, trigger, target.id, input.round)) continue
        out.push(candidate(area, trigger, target, input.round, input.timing))
      }
    }
  }
  return out
}

export function recordDnd5ePersistentAreaTrigger(
  areas: readonly Dnd5ePluginArea[] | undefined,
  resolved: Pick<Dnd5ePersistentAreaTriggerCandidate, 'area' | 'trigger' | 'targetToken' | 'transactionId'>,
  round: number,
): Dnd5ePluginArea[] {
  return (areas ?? []).map((area) => {
    if (area.id !== resolved.area.id) return area
    const receipts = (area.triggerReceipts ?? []).filter((receipt) => receipt.transactionId !== resolved.transactionId)
    receipts.push({
      triggerId: resolved.trigger.id,
      targetTokenId: resolved.targetToken.id,
      round,
      transactionId: resolved.transactionId,
    })
    return { ...area, triggerReceipts: receipts.slice(-2_048) }
  })
}

export function reconcileDnd5ePluginAreas(
  areas: readonly Dnd5ePluginArea[] | undefined,
  characters: readonly Character[],
  round: number,
): Dnd5ePluginArea[] {
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  return (areas ?? []).filter((area) => {
    if (round > area.expiresAfterRound) return false
    if (!area.concentrationId) return true
    const source = charactersById.get(area.sourceCharacterId)
    return !!source?.concentrating && source.dnd5eCombatState?.concentrationSpellId === area.concentrationId
  }).map((area) => {
    if (!area.triggerReceipts) return area
    const triggerReceipts = area.triggerReceipts.filter((receipt) => receipt.round >= round - 2)
    return triggerReceipts.length === area.triggerReceipts.length
      ? area
      : { ...area, triggerReceipts: triggerReceipts.length > 0 ? triggerReceipts : undefined }
  })
}

export function reconcileDnd5ePluginAreasOnMap(
  map: BattleMap,
  characters: readonly Character[],
  round: number,
): BattleMap {
  const next = reconcileDnd5ePluginAreas(map.dnd5ePluginAreas, characters, round)
  const previous = map.dnd5ePluginAreas ?? []
  if (next.length === previous.length && next.every((area, index) => area === previous[index])) return map
  return { ...map, dnd5ePluginAreas: next }
}
