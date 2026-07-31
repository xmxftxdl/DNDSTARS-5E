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
import { reconcileDnd5ePersistentAreaAnchors } from './coreSpellAreas'
import { normalizeDnd5eActiveEffects } from './activeEffects'

export interface Dnd5ePersistentAreaTriggerCandidate {
  area: Dnd5ePluginArea
  trigger: Dnd5ePersistentAreaTriggerSnapshot
  targetToken: Token
  transactionId: string
  enteredAt?: GridCell
  pathIndex?: number
  turnKey?: string
}

function tokenIntersectsAreaAt(
  token: Token,
  map: BattleMap,
  area: Dnd5ePluginArea,
  position: { x: number; y: number },
  cells: readonly GridCell[] = area.cells,
): boolean {
  const areaCells = new Set(cells.map(cellKey))
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

export function dnd5ePersistentAreaMovementCostMultiplierAt(input: {
  map: BattleMap
  token: Token
  position: { x: number; y: number }
}): number {
  let multiplier = 1
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (
      (area.movementCostMultiplier ?? 1) <= 1 ||
      !areaAllowsTarget(area, input.token, input.map) ||
      !tokenIntersectsAreaAt(input.token, input.map, area, input.position)
    ) continue
    multiplier = Math.max(multiplier, area.movementCostMultiplier ?? 1)
  }
  return multiplier
}

export function dnd5ePersistentAreaDifficultTerrainMultiplierAt(input: {
  map: BattleMap
  token: Token
  position: { x: number; y: number }
}): number {
  let multiplier = 1
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (
      area.coreSpellId === 'spirit-guardians' ||
      (area.movementCostMultiplier ?? 1) <= 1 ||
      !areaAllowsTarget(area, input.token, input.map) ||
      !tokenIntersectsAreaAt(input.token, input.map, area, input.position)
    ) continue
    multiplier = Math.max(multiplier, area.movementCostMultiplier ?? 1)
  }
  return multiplier
}

export function dnd5ePersistentAreaSpeedCostMultiplierAt(input: {
  map: BattleMap
  token: Token
  position: { x: number; y: number }
}): number {
  let multiplier = 1
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (
      area.coreSpellId !== 'spirit-guardians' ||
      (area.movementCostMultiplier ?? 1) <= 1 ||
      !areaAllowsTarget(area, input.token, input.map) ||
      !tokenIntersectsAreaAt(input.token, input.map, area, input.position)
    ) continue
    multiplier = Math.max(multiplier, area.movementCostMultiplier ?? 1)
  }
  return multiplier
}

function alreadyTriggered(
  area: Dnd5ePluginArea,
  trigger: Dnd5ePersistentAreaTriggerSnapshot,
  targetTokenId: string,
  round: number,
  turnKey?: string,
): boolean {
  const frequencyId = trigger.frequencyGroupId ?? trigger.id
  if (trigger.oncePerTurn === true) {
    if (!turnKey) return true
    return (area.triggerReceipts ?? []).some((receipt) =>
      receipt.triggerId === frequencyId && receipt.targetTokenId === targetTokenId && receipt.turnKey === turnKey,
    )
  }
  if (trigger.oncePerRound === false) return false
  return (area.triggerReceipts ?? []).some((receipt) =>
    receipt.triggerId === frequencyId && receipt.targetTokenId === targetTokenId && receipt.round === round,
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
  turnKey?: string,
): Dnd5ePersistentAreaTriggerCandidate {
  return {
    area,
    trigger,
    targetToken,
    transactionId: `area-trigger:${area.id}:${trigger.id}:${targetToken.id}:${round}:${turnKey ?? 'round'}:${occurrence}`,
    enteredAt,
    pathIndex,
    turnKey,
  }
}

export function collectDnd5ePersistentAreaTriggers(input: {
  map: BattleMap
  timing: Dnd5ePersistentAreaTriggerTiming
  round: number
  targetTokenId?: string
  areaId?: string
  /** 当前权威回合标识；oncePerTurn 声明必须提供。 */
  turnKey?: string
  movement?: {
    token: Token
    to: { x: number; y: number }
    /** 权威移动规划器生成的完整折线路径；缺省时才回退为起终点直线。 */
    path?: readonly { x: number; y: number }[]
  }
}): Dnd5ePersistentAreaTriggerCandidate[] {
  const areas = (input.map.dnd5ePluginAreas ?? []).filter((area) => !input.areaId || area.id === input.areaId)
  if (areas.length === 0) return []
  const out: Dnd5ePersistentAreaTriggerCandidate[] = []
  const queuedLimited = new Set<string>()
  const mayQueue = (
    area: Dnd5ePluginArea,
    trigger: Dnd5ePersistentAreaTriggerSnapshot,
    targetTokenId: string,
  ) => {
    if (alreadyTriggered(area, trigger, targetTokenId, input.round, input.turnKey)) return false
    if (trigger.oncePerRound === false && trigger.oncePerTurn !== true) return true
    const frequencyKey = trigger.oncePerTurn === true ? input.turnKey : input.round
    const key = `${area.id}\u0000${trigger.frequencyGroupId ?? trigger.id}\u0000${targetTokenId}\u0000${frequencyKey}`
    if (queuedLimited.has(key)) return false
    queuedLimited.add(key)
    return true
  }

  if (input.timing === 'on-enter' || input.timing === 'on-move-distance') {
    const movement = input.movement
    if (!movement) return []
    const target = movement.token
    const from = tokenAnchorCellFromPixel(target.x, target.y, target, input.map)
    const to = tokenAnchorCellFromPixel(movement.to.x, movement.to.y, target, input.map)
    const declaredPath = movement.path?.map((point) =>
      tokenAnchorCellFromPixel(point.x, point.y, target, input.map),
    ) ?? []
    const path = declaredPath.length > 0
      ? [from, ...declaredPath, to].filter((cell, index, cells) =>
          index === 0 || cell.col !== cells[index - 1].col || cell.row !== cells[index - 1].row,
        )
      : dnd5eMovementPathCells(from, to)
    for (const area of areas) {
      if (!areaAllowsTarget(area, target, input.map)) continue
      if (input.timing === 'on-enter') {
        for (const trigger of area.triggers ?? []) {
          if (trigger.timing !== 'on-enter') continue
          const triggerCells = trigger.cells ?? area.cells
          let inside = tokenIntersectsAreaAt(target, input.map, area, target, triggerCells)
          let occurrence = 0
          for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
            const position = tokenCenterForAnchorCell(path[pathIndex], target, input.map)
            const nextInside = tokenIntersectsAreaAt(target, input.map, area, position, triggerCells)
            if (!inside && nextInside && mayQueue(area, trigger, target.id)) {
              out.push(candidate(
                area,
                trigger,
                target,
                input.round,
                `enter-${pathIndex}-${occurrence}`,
                path[pathIndex],
                pathIndex,
                input.turnKey,
              ))
              occurrence += 1
            }
            inside = nextInside
          }
        }
        continue
      }
      let occurrence = 0
      let distanceInsideFeet = 0
      const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
      for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
        const position = tokenCenterForAnchorCell(path[pathIndex], target, input.map)
        const nextInside = tokenIntersectsAreaAt(target, input.map, area, position)
        if (input.timing === 'on-move-distance' && nextInside) {
          const previousCell = path[pathIndex - 1]
          const stepCells = Math.max(
            Math.abs(path[pathIndex].col - previousCell.col),
            Math.abs(path[pathIndex].row - previousCell.row),
          )
          distanceInsideFeet += stepCells * feetPerCell
          for (const trigger of area.triggers ?? []) {
            if (trigger.timing !== 'on-move-distance') continue
            const interval = Math.max(1, trigger.movementIntervalFeet ?? feetPerCell)
            while (distanceInsideFeet >= interval) {
              distanceInsideFeet -= interval
              if (mayQueue(area, trigger, target.id)) {
                out.push(candidate(
                  area,
                  trigger,
                  target,
                  input.round,
                  `move-${pathIndex}-${occurrence}`,
                  path[pathIndex],
                  pathIndex,
                  input.turnKey,
                ))
              }
              occurrence += 1
            }
          }
        }
      }
    }
    return out.sort((left, right) => (left.pathIndex ?? 0) - (right.pathIndex ?? 0))
  }

  const targets = input.targetTokenId
    ? input.map.tokens.filter((token) => token.id === input.targetTokenId)
    : input.map.tokens
  for (const area of areas) {
    for (const target of targets) {
      if (!areaAllowsTarget(area, target, input.map)) continue
      for (const trigger of area.triggers ?? []) {
        if (
          trigger.timing !== input.timing ||
          !tokenIntersectsAreaAt(target, input.map, area, target, trigger.cells ?? area.cells) ||
          !mayQueue(area, trigger, target.id)
        ) continue
        out.push(candidate(area, trigger, target, input.round, input.timing, undefined, undefined, input.turnKey))
      }
    }
  }
  return out
}

export function recordDnd5ePersistentAreaTrigger(
  areas: readonly Dnd5ePluginArea[] | undefined,
  resolved: Pick<Dnd5ePersistentAreaTriggerCandidate, 'area' | 'trigger' | 'targetToken' | 'transactionId' | 'turnKey'>,
  round: number,
): Dnd5ePluginArea[] {
  return (areas ?? []).map((area) => {
    if (area.id !== resolved.area.id) return area
    const receipts = (area.triggerReceipts ?? []).filter((receipt) => receipt.transactionId !== resolved.transactionId)
    receipts.push({
      triggerId: resolved.trigger.frequencyGroupId ?? resolved.trigger.id,
      targetTokenId: resolved.targetToken.id,
      round,
      turnKey: resolved.turnKey,
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
    const source = charactersById.get(area.sourceCharacterId)
    if (area.sourceKind === 'core-spell' && area.coreSpellId === 'spiritual-weapon') {
      return normalizeDnd5eActiveEffects(source?.dnd5eCombatState?.activeEffects).some((effect) =>
        effect.definitionId === 'srd-5.1:spell:spiritual-weapon' &&
        effect.source.kind === 'spell' &&
        effect.source.actorId === area.sourceTokenId &&
        effect.stackingKey === area.id,
      )
    }
    if (!area.concentrationId) return true
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
  const anchoredMap = reconcileDnd5ePersistentAreaAnchors(map)
  const next = reconcileDnd5ePluginAreas(anchoredMap.dnd5ePluginAreas, characters, round)
  const previous = anchoredMap.dnd5ePluginAreas ?? []
  const liveEffectTokenIds = new Set(next.flatMap((area) =>
    area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : [],
  ))
  const tokens = anchoredMap.tokens.filter((token) =>
    !token.dnd5eSpellEffect || liveEffectTokenIds.has(token.id),
  )
  if (
    next.length === previous.length && next.every((area, index) => area === previous[index]) &&
    tokens.length === anchoredMap.tokens.length
  ) return anchoredMap
  return { ...anchoredMap, dnd5ePluginAreas: next, tokens }
}

/**
 * 处理不能只用整轮编号表达的区域寿命。
 * 例如冰风暴在施法者下一回合结束时才解除，因此同一轮中先于施法者行动的
 * 生物仍会受到困难地形影响。
 */
export function expireDnd5ePluginAreasAtTurnBoundary(input: {
  map: BattleMap
  timing: 'turn-start' | 'turn-end'
  round: number
  tokenId: string
}): BattleMap {
  if (input.timing !== 'turn-end') return input.map
  const previous = input.map.dnd5ePluginAreas ?? []
  const next = previous.filter((area) =>
    area.expiresAtSourceTurnEndAfterRound == null ||
    area.sourceTokenId !== input.tokenId ||
    input.round < area.expiresAtSourceTurnEndAfterRound,
  )
  if (next.length === previous.length) return input.map
  const liveEffectTokenIds = new Set(next.flatMap((area) =>
    area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : [],
  ))
  return {
    ...input.map,
    dnd5ePluginAreas: next,
    tokens: input.map.tokens.filter((token) =>
      !token.dnd5eSpellEffect || liveEffectTokenIds.has(token.id),
    ),
  }
}
