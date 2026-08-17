import {
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  type GridCell,
} from '../../lib/gridCombat'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eMovementPathCells } from './itemAreas'
import type {
  Dnd5ePersistentAreaTriggerSnapshot,
  Dnd5ePersistentAreaTriggerTiming,
} from './persistentAreaTypes'
import {
  getDnd5eCoreSpellAreaDeclaration,
  reconcileDnd5ePersistentAreaAnchors,
} from './coreSpellAreas'
import { normalizeDnd5eActiveEffects } from './activeEffects'
import {
  dnd5ePersistentAreaAllowsTarget,
  dnd5eTokenIntersectsPersistentAreaAt,
} from './persistentAreaGeometry'

export {
  dnd5ePersistentAreaAffectsTokenVerticallyAt,
  dnd5ePersistentAreaDifficultTerrainMultiplierAt,
  dnd5ePersistentAreaMovementCostMultiplierAt,
  dnd5ePersistentAreaSpeedCostMultiplierAt,
} from './persistentAreaGeometry'

export interface Dnd5ePersistentAreaTriggerCandidate {
  area: Dnd5ePluginArea
  trigger: Dnd5ePersistentAreaTriggerSnapshot
  targetToken: Token
  transactionId: string
  enteredAt?: GridCell
  pathIndex?: number
  turnKey?: string
}

const tokenIntersectsAreaAt = dnd5eTokenIntersectsPersistentAreaAt
const areaAllowsTarget = dnd5ePersistentAreaAllowsTarget

function alreadyTriggered(
  area: Dnd5ePluginArea,
  trigger: Dnd5ePersistentAreaTriggerSnapshot,
  targetTokenId: string,
  round: number,
  turnKey?: string,
): boolean {
  const frequencyId = trigger.frequencyGroupId ?? trigger.id
  if (
    trigger.maximumTotalUses != null &&
    (area.triggerReceipts ?? []).filter((receipt) => receipt.triggerId === frequencyId).length >=
      trigger.maximumTotalUses
  ) return true
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
  const runtimeTrigger = normalizeDnd5ePersistentAreaTriggerForRuntime(area, trigger)
  return {
    area,
    trigger: runtimeTrigger,
    targetToken,
    transactionId: `area-trigger:${area.id}:${runtimeTrigger.id}:${targetToken.id}:${round}:${turnKey ?? 'round'}:${occurrence}`,
    enteredAt,
    pathIndex,
    turnKey,
  }
}

/**
 * Core spell areas persist an immutable trigger snapshot on the map. Older
 * Flaming Sphere snapshots required a separate DM adjudication and stored its
 * turn-end frequency as once per round. Narrowly reconcile those two built-in
 * triggers at execution time; custom/plugin areas remain untouched.
 */
export function normalizeDnd5ePersistentAreaTriggerForRuntime(
  area: Dnd5ePluginArea,
  trigger: Dnd5ePersistentAreaTriggerSnapshot,
): Dnd5ePersistentAreaTriggerSnapshot {
  if (
    area.sourceKind !== 'core-spell' ||
    area.coreSpellId !== 'flaming-sphere' ||
    (trigger.id !== 'flaming-sphere-impact' && trigger.id !== 'flaming-sphere-turn-end')
  ) return trigger
  const declaration = getDnd5eCoreSpellAreaDeclaration('flaming-sphere')
  const declaredTrigger = declaration?.triggers.find((candidate) => candidate.id === trigger.id)
  if (!declaredTrigger) return trigger
  const dmAdjustable = declaredTrigger.dmAdjustable === true
    ? trigger.dmAdjustable
    : undefined
  const oncePerTurn = declaredTrigger.oncePerTurn === true
    ? true
    : trigger.oncePerTurn
  const oncePerRound = declaredTrigger.oncePerTurn === true
    ? false
    : trigger.oncePerRound
  if (
    dmAdjustable === trigger.dmAdjustable &&
    oncePerTurn === trigger.oncePerTurn &&
    oncePerRound === trigger.oncePerRound
  ) return trigger
  return { ...trigger, dmAdjustable, oncePerTurn, oncePerRound }
}

/**
 * When a source-token aura (e.g. Spirit Guardians) moves with its caster onto
 * stationary creatures, those creatures newly enter the area and should receive
 * on-enter triggers. Fixed/movable beams such as Moonbeam are intentionally
 * excluded (2014 errata: relocating the area onto a creature is not "entering").
 */
export function collectDnd5ePersistentAreaTriggersForSourceMove(input: {
  beforeMap: BattleMap
  afterMap: BattleMap
  sourceTokenId: string
  round: number
  turnKey?: string
}): Dnd5ePersistentAreaTriggerCandidate[] {
  const beforeAreas = new Map(
    (input.beforeMap.dnd5ePluginAreas ?? [])
      .filter((area) =>
        area.anchorMode === 'source-token' &&
        (area.anchorTokenId ?? area.sourceTokenId) === input.sourceTokenId)
      .map((area) => [area.id, area]),
  )
  if (beforeAreas.size === 0) return []
  const out: Dnd5ePersistentAreaTriggerCandidate[] = []
  const queuedLimited = new Set<string>()
  const mayQueue = (
    area: Dnd5ePluginArea,
    trigger: Dnd5ePersistentAreaTriggerSnapshot,
    targetTokenId: string,
  ) => {
    const runtimeTrigger = normalizeDnd5ePersistentAreaTriggerForRuntime(area, trigger)
    if (alreadyTriggered(area, runtimeTrigger, targetTokenId, input.round, input.turnKey)) return false
    if (runtimeTrigger.oncePerRound === false && runtimeTrigger.oncePerTurn !== true) return true
    const frequencyKey = runtimeTrigger.oncePerTurn === true ? input.turnKey : input.round
    const key = `${area.id}\u0000${runtimeTrigger.frequencyGroupId ?? runtimeTrigger.id}\u0000${targetTokenId}\u0000${frequencyKey}`
    if (queuedLimited.has(key)) return false
    queuedLimited.add(key)
    return true
  }
  for (const afterArea of input.afterMap.dnd5ePluginAreas ?? []) {
    if (afterArea.anchorMode !== 'source-token') continue
    if ((afterArea.anchorTokenId ?? afterArea.sourceTokenId) !== input.sourceTokenId) continue
    const beforeArea = beforeAreas.get(afterArea.id)
    if (!beforeArea) continue
    for (const trigger of afterArea.triggers ?? []) {
      if (trigger.timing !== 'on-enter') continue
      for (const target of input.afterMap.tokens) {
        if (target.id === input.sourceTokenId) continue
        if (!areaAllowsTarget(afterArea, target, input.afterMap)) continue
        const wasInside = tokenIntersectsAreaAt(
          target,
          input.beforeMap,
          beforeArea,
          target,
          trigger.cells ?? beforeArea.cells,
        )
        const nowInside = tokenIntersectsAreaAt(
          target,
          input.afterMap,
          afterArea,
          target,
          trigger.cells ?? afterArea.cells,
        )
        if (wasInside || !nowInside || !mayQueue(afterArea, trigger, target.id)) continue
        out.push(candidate(
          afterArea,
          trigger,
          target,
          input.round,
          `source-move-enter`,
          undefined,
          undefined,
          input.turnKey,
        ))
      }
    }
  }
  return out
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
    /** 与 path 一一对应的绝对高度；用于飞越地面效果和进入三维体积。 */
    pathElevationsFeet?: readonly number[]
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
    const runtimeTrigger = normalizeDnd5ePersistentAreaTriggerForRuntime(area, trigger)
    if (alreadyTriggered(area, runtimeTrigger, targetTokenId, input.round, input.turnKey)) return false
    if (runtimeTrigger.oncePerRound === false && runtimeTrigger.oncePerTurn !== true) return true
    const frequencyKey = runtimeTrigger.oncePerTurn === true ? input.turnKey : input.round
    const key = `${area.id}\u0000${runtimeTrigger.frequencyGroupId ?? runtimeTrigger.id}\u0000${targetTokenId}\u0000${frequencyKey}`
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
    const declaredPath = movement.path?.map((point, index) => ({
      cell: tokenAnchorCellFromPixel(point.x, point.y, target, input.map),
      elevationFeet: movement.pathElevationsFeet?.[index],
    })) ?? []
    const rawPath = declaredPath.length > 0
      ? [
          { cell: from, elevationFeet: target.elevationFeet },
          ...declaredPath,
          { cell: to, elevationFeet: movement.pathElevationsFeet?.at(-1) },
        ]
      : dnd5eMovementPathCells(from, to).map((cell) => ({
          cell,
          elevationFeet: cell.col === from.col && cell.row === from.row
            ? target.elevationFeet
            : undefined,
        }))
    const path: Array<{ cell: GridCell; elevationFeet?: number }> = []
    for (const step of rawPath) {
      const previous = path.at(-1)
      if (
        previous &&
        previous.cell.col === step.cell.col &&
        previous.cell.row === step.cell.row &&
        (
          step.elevationFeet == null ||
          previous.elevationFeet === step.elevationFeet
        )
      ) {
        if (step.elevationFeet != null) previous.elevationFeet = step.elevationFeet
        continue
      }
      path.push({ cell: step.cell, elevationFeet: step.elevationFeet })
    }
    for (const area of areas) {
      if (!areaAllowsTarget(area, target, input.map)) continue
      if (input.timing === 'on-enter') {
        for (const trigger of area.triggers ?? []) {
          if (trigger.timing !== 'on-enter') continue
          const triggerCells = trigger.cells ?? area.cells
          let inside = tokenIntersectsAreaAt(
            target,
            input.map,
            area,
            target,
            triggerCells,
            path[0]?.elevationFeet,
          )
          let occurrence = 0
          for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
            const position = tokenCenterForAnchorCell(path[pathIndex].cell, target, input.map)
            const nextInside = tokenIntersectsAreaAt(
              target,
              input.map,
              area,
              position,
              triggerCells,
              path[pathIndex].elevationFeet,
            )
            if (!inside && nextInside && mayQueue(area, trigger, target.id)) {
              out.push(candidate(
                area,
                trigger,
                target,
                input.round,
                `enter-${pathIndex}-${occurrence}`,
                path[pathIndex].cell,
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
        const position = tokenCenterForAnchorCell(path[pathIndex].cell, target, input.map)
        const nextInside = tokenIntersectsAreaAt(
          target,
          input.map,
          area,
          position,
          area.cells,
          path[pathIndex].elevationFeet,
        )
        if (input.timing === 'on-move-distance' && nextInside) {
          const previousCell = path[pathIndex - 1].cell
          const stepCells = Math.max(
            Math.abs(path[pathIndex].cell.col - previousCell.col),
            Math.abs(path[pathIndex].cell.row - previousCell.row),
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
                  path[pathIndex].cell,
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
  tokens: readonly Token[] = [],
): Dnd5ePluginArea[] {
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  const tokensById = new Map(tokens.map((token) => [token.id, token]))
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
    if (source) {
      return !!source.concentrating &&
        source.dnd5eCombatState?.concentrationSpellId === area.concentrationId
    }
    const sourceToken = tokensById.get(area.sourceTokenId)
    return sourceToken?.dnd5eCombatState?.concentrationSpellId === area.concentrationId
  }).map((area) => {
    if (!area.triggerReceipts) return area
    const persistentReceiptIds = new Set((area.triggers ?? [])
      .filter((trigger) => trigger.maximumTotalUses != null)
      .map((trigger) => trigger.frequencyGroupId ?? trigger.id))
    const triggerReceipts = area.triggerReceipts.filter((receipt) =>
      receipt.round >= round - 2 || persistentReceiptIds.has(receipt.triggerId))
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
  const next = reconcileDnd5ePluginAreas(
    anchoredMap.dnd5ePluginAreas,
    characters,
    round,
    anchoredMap.tokens,
  )
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

export interface Dnd5ePersistentAreaLifecycleAdvanceResult {
  map: BattleMap
  movedAreaIds: readonly string[]
}

/**
 * Advances data-only moving areas at the source turn boundary. Translation,
 * vertical shrink and trigger-die scaling are committed to the map snapshot so
 * retries and reconnects cannot apply a step twice.
 */
export function advanceDnd5ePluginAreasAtTurnBoundary(input: {
  map: BattleMap
  timing: 'turn-start' | 'turn-end'
  round: number
  tokenId: string
  turnKey: string
}): Dnd5ePersistentAreaLifecycleAdvanceResult {
  if (input.timing !== 'turn-start') return { map: input.map, movedAreaIds: [] }
  const source = input.map.tokens.find((token) => token.id === input.tokenId)
  if (!source) return { map: input.map, movedAreaIds: [] }
  const sourceCell = tokenAnchorCellFromPixel(source.x, source.y, source, input.map)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const maximumCol = Math.max(0, Math.ceil(input.map.width / Math.max(1, input.map.gridSize)) - 1)
  const maximumRow = Math.max(0, Math.ceil(input.map.height / Math.max(1, input.map.gridSize)) - 1)
  const movedAreaIds: string[] = []
  let changed = false
  const next = (input.map.dnd5ePluginAreas ?? []).flatMap((area) => {
    const lifecycle = area.lifecycle
    if (
      !lifecycle || lifecycle.timing !== 'source-turn-start' ||
      area.sourceTokenId !== input.tokenId || area.createdRound >= input.round ||
      area.lifecycleLastTurnKey === input.turnKey
    ) return [area]

    let colOffset = 0
    let rowOffset = 0
    if (lifecycle.translateAwayFromSourceFeet) {
      const anchor = area.anchorCell ?? area.cells[0]
      const deltaCol = anchor.col - sourceCell.col
      const deltaRow = anchor.row - sourceCell.row
      const length = Math.hypot(deltaCol, deltaRow)
      if (length > 0) {
        const distanceCells = lifecycle.translateAwayFromSourceFeet / feetPerCell
        colOffset = Math.round(deltaCol / length * distanceCells)
        rowOffset = Math.round(deltaRow / length * distanceCells)
        if (colOffset === 0 && rowOffset === 0) {
          if (Math.abs(deltaCol) >= Math.abs(deltaRow)) colOffset = Math.sign(deltaCol)
          else rowOffset = Math.sign(deltaRow)
        }
      }
    }
    const translate = (cell: { col: number; row: number }) => ({
      col: cell.col + colOffset,
      row: cell.row + rowOffset,
    })
    const cells = area.cells.map(translate).filter((cell) =>
      cell.col >= 0 && cell.row >= 0 && cell.col <= maximumCol && cell.row <= maximumRow)
    if (cells.length === 0) {
      changed = true
      return []
    }
    const damageIds = new Set(lifecycle.damageTriggerIds ?? [])
    const triggers = area.triggers?.map((trigger) => {
      const damage = trigger.damage && damageIds.has(trigger.id) && lifecycle.damageDiceCountDelta != null
        ? {
            ...trigger.damage,
            count: Math.max(
              lifecycle.minimumDamageDiceCount ?? 0,
              trigger.damage.count + lifecycle.damageDiceCountDelta,
            ),
          }
        : trigger.damage
      return {
        ...trigger,
        damage: damage && damage.count > 0 ? damage : undefined,
        cells: trigger.cells?.map(translate).filter((cell) =>
          cell.col >= 0 && cell.row >= 0 && cell.col <= maximumCol && cell.row <= maximumRow),
      }
    })
    const vertical = area.vertical?.mode === 'volume' && lifecycle.heightReductionFeet
      ? {
          ...area.vertical,
          heightFeet: Math.max(0, area.vertical.heightFeet - lifecycle.heightReductionFeet),
        }
      : area.vertical
    changed = true
    // A shrinking volume that reaches the ground no longer has a legal area
    // snapshot. Removing it here keeps the persisted map schema valid and
    // prevents a zero-height hazard from continuing to trigger.
    if (vertical?.mode === 'volume' && vertical.heightFeet <= 0) return []
    if (colOffset !== 0 || rowOffset !== 0) movedAreaIds.push(area.id)
    return [{
      ...area,
      cells,
      anchorCell: area.anchorCell ? translate(area.anchorCell) : { ...cells[0] },
      vertical,
      triggers,
      lifecycleAdvances: (area.lifecycleAdvances ?? 0) + 1,
      lifecycleLastTurnKey: input.turnKey,
    }]
  })
  return changed
    ? { map: { ...input.map, dnd5ePluginAreas: next }, movedAreaIds }
    : { map: input.map, movedAreaIds: [] }
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
