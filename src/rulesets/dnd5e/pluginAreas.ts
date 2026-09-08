import {
  mapCellExtent,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
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
import { normalizeDnd5eActiveEffects, projectDnd5eActiveEffectState } from './activeEffects'
import {
  dnd5eHallowAdditionalEffectAllowsTarget,
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

export interface Dnd5eGreaseMovementCheckpoint {
  candidate: Dnd5ePersistentAreaTriggerCandidate
  position: { x: number; y: number }
  pathIndex: number
}

/**
 * Grease interrupts movement at the first occupied anchor cell that enters
 * the area.  Keep this projection beside the trigger collector so player
 * previews, Host animation and authoritative settlement all use the exact
 * same large-token-aware grid geometry.
 */
export function dnd5eFirstGreaseMovementCheckpoint(input: {
  map: BattleMap
  token: Token
  candidates: readonly Dnd5ePersistentAreaTriggerCandidate[]
}): Dnd5eGreaseMovementCheckpoint | undefined {
  const candidate = input.candidates
    .filter((entry) =>
      entry.area.coreSpellId === 'grease' &&
      entry.trigger.timing === 'on-enter' &&
      entry.targetToken.id === input.token.id &&
      entry.enteredAt != null)
    .sort((left, right) => (left.pathIndex ?? 0) - (right.pathIndex ?? 0))[0]
  if (!candidate?.enteredAt) return undefined
  return {
    candidate,
    position: tokenCenterForAnchorCell(candidate.enteredAt, input.token, input.map),
    pathIndex: candidate.pathIndex ?? 0,
  }
}

/** Returns the earliest Grease entry whose Dexterity save actually failed. */
export function dnd5eFailedGreaseMovementCheckpoint(input: {
  map: BattleMap
  token: Token
  candidates: readonly Dnd5ePersistentAreaTriggerCandidate[]
  events: readonly {
    type: string
    areaId?: string
    triggerId?: string
    targetId?: string
    saveSuccess?: boolean
  }[]
}): Dnd5eGreaseMovementCheckpoint | undefined {
  const failedCandidates = input.candidates.filter((candidate) =>
    candidate.area.coreSpellId === 'grease' &&
    candidate.trigger.timing === 'on-enter' &&
    input.events.some((event) =>
      event.type === 'persistent-area-triggered' &&
      event.areaId === candidate.area.id &&
      event.triggerId === candidate.trigger.id &&
      event.targetId === input.token.id &&
      event.saveSuccess === false))
  return dnd5eFirstGreaseMovementCheckpoint({
    map: input.map,
    token: input.token,
    candidates: failedCandidates,
  })
}

/**
 * These trigger timings describe one already-started effect wave over every
 * eligible occupant. Losing concentration while one target is being settled
 * ends future waves, but cannot retroactively cancel the remaining targets in
 * the same acid rain, detonation, creation pulse, or moving-area impact.
 */
export function dnd5ePersistentAreaTriggerTimingIsSimultaneousWave(
  timing: Dnd5ePersistentAreaTriggerTiming,
): boolean {
  return timing === 'on-create' || timing === 'source-turn-start' ||
    timing === 'on-detonate' || timing === 'on-area-move-impact'
}

const tokenIntersectsAreaAt = dnd5eTokenIntersectsPersistentAreaAt
const areaAllowsTarget = dnd5ePersistentAreaAllowsTarget

function persistentAreaTriggerAllowsTarget(
  area: Dnd5ePluginArea,
  trigger: Dnd5ePersistentAreaTriggerSnapshot,
  token: Token,
  map: BattleMap,
): boolean {
  // Spell-created areas never mutate durable map objects. Object-facing rules
  // are resolved conversationally by the table; only creature occupants enter
  // the authoritative trigger pipeline.
  if (token.type === 'obstacle' || token.dnd5eSpellEffect) return false
  if (!(trigger.targetKinds ?? ['creature']).includes('creature')) return false
  if (area.hallow &&
    !dnd5eHallowAdditionalEffectAllowsTarget(area, token, map)) return false
  return areaAllowsTarget(area, token, map)
}

function gridCellKey(cell: GridCell): string {
  return `${cell.col},${cell.row}`
}

function retainDnd5eSpellEffectToken(
  token: Token,
  liveAreaAnchorTokenIds: ReadonlySet<string>,
): boolean {
  if (!token.dnd5eSpellEffect) return true
  // Mirror Image projections are owned by the ActiveEffect decoy pool, not a
  // persistent area. Area expiry/reconciliation must therefore leave them for
  // the dedicated projection reconciler to add or remove.
  if (
    token.dnd5eSpellEffect.spellId === 'mirror-image' &&
    token.dnd5eSpellEffect.projectionKind === 'attack-decoy'
  ) return true
  return liveAreaAnchorTokenIds.has(token.id)
}

function isPasswallPassage(area: Dnd5ePluginArea): boolean {
  return area.sourceKind === 'core-spell' && area.coreSpellId === 'passwall' &&
    area.blocking?.suppressesMappedBarriers === true
}

/**
 * Passwall is exceptional among persistent areas: when its opening closes,
 * every creature still in the passage must be placed in the nearest
 * unoccupied space. The placement is persisted in the same authoritative map
 * update as the removal so clients never observe a token stranded in the
 * restored wall.
 */
export function ejectDnd5ePasswallOccupants(
  map: BattleMap,
  removedAreas: readonly Dnd5ePluginArea[],
): BattleMap {
  const passages = removedAreas.filter(isPasswallPassage)
  if (passages.length === 0 || map.tokens.length === 0) return map

  const occupants = map.tokens.filter((token) =>
    token.type !== 'obstacle' && passages.some((passage) =>
      tokenIntersectsAreaAt(token, map, passage, token),
    ))
  if (occupants.length === 0) return map

  const { cols, rows } = mapCellExtent(map)
  const maximumRing = Math.max(cols, rows)
  let tokens = map.tokens
  let changed = false

  for (const occupant of occupants) {
    const current = tokens.find((token) => token.id === occupant.id)
    if (!current) continue
    const start = tokenAnchorCellFromPixel(current.x, current.y, current, map)
    const blocked = new Set(tokens
      .filter((token) => token.id !== current.id)
      .flatMap((token) => tokenOccupiedCellsAt(token, map, token))
      .map(gridCellKey))
    let destination: { x: number; y: number } | undefined

    for (let ring = 0; ring <= maximumRing && !destination; ring += 1) {
      for (let dc = -ring; dc <= ring && !destination; dc += 1) {
        for (let dr = -ring; dr <= ring; dr += 1) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue
          const anchor = { col: start.col + dc, row: start.row + dr }
          const at = tokenCenterForAnchorCell(anchor, current, map)
          const footprint = tokenOccupiedCellsAt(current, map, at)
          if (footprint.some((cell) =>
            cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows || blocked.has(gridCellKey(cell)))) {
            continue
          }
          if (passages.some((passage) => tokenIntersectsAreaAt(current, map, passage, at))) continue
          destination = at
          break
        }
      }
    }

    if (!destination || (destination.x === current.x && destination.y === current.y)) continue
    tokens = tokens.map((token) => token.id === current.id
      ? { ...token, x: destination.x, y: destination.y }
      : token)
    changed = true
  }

  return changed ? { ...map, tokens } : map
}

function isDefeatedPersistentAreaTarget(token: Token): boolean {
  return typeof token.hp === 'number' && token.hp <= 0
}

function canonicalBlockingCreatureType(value: string): string {
  const type = value.trim().toLowerCase()
  if (type === 'construct' || type.includes('构装')) return 'construct'
  if (type === 'undead' || type.includes('亡灵') || type.includes('不死')) return 'undead'
  if (type === 'aberration' || type.includes('异怪')) return 'aberration'
  if (type === 'celestial' || type.includes('天界')) return 'celestial'
  if (type === 'elemental' || type.includes('元素')) return 'elemental'
  if (type === 'fey' || type.includes('精类') || type.includes('妖精')) return 'fey'
  if (type === 'fiend' || type.includes('邪魔')) return 'fiend'
  if (type === 'humanoid' || type.includes('类人生物')) return 'humanoid'
  return type
}

function persistentAreaBlockingAffectsToken(area: Dnd5ePluginArea, token: Token): boolean {
  const blocking = area.blocking
  if (!blocking || (blocking.excludeSourceToken && token.id === area.sourceTokenId)) return false
  if (
    blocking.entryPermission === 'occupants-at-creation' &&
    blocking.authorizedTokenIds?.includes(token.id)
  ) return false
  const tokenTypes = new Set([
    ...(token.creatureTypes ?? []).map(canonicalBlockingCreatureType),
    ...(token.type === 'player' ? ['humanoid'] : []),
  ])
  const included = blocking.includedCreatureTypes?.map(canonicalBlockingCreatureType)
  if (included?.length && !included.some((type) => tokenTypes.has(type))) return false
  const excluded = blocking.excludedCreatureTypes?.map(canonicalBlockingCreatureType)
  return !excluded?.some((type) => tokenTypes.has(type))
}

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
  if (
    trigger.maximumTotalDamage != null &&
    (area.triggerReceipts ?? [])
      .filter((receipt) => receipt.triggerId === frequencyId)
      .reduce((total, receipt) => total + Math.max(0, receipt.damage ?? 0), 0) >= trigger.maximumTotalDamage
  ) return true
  if (trigger.oncePerTarget === true) {
    return (area.triggerReceipts ?? []).some((receipt) =>
      receipt.triggerId === frequencyId && receipt.targetTokenId === targetTokenId,
    )
  }
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
        area.magicMouth == null &&
        area.anchorMode === 'source-token' &&
        (area.anchorTokenId ?? area.sourceTokenId) === input.sourceTokenId)
      .map((area) => [area.id, area]),
  )
  if (beforeAreas.size === 0) return []
  const out: Dnd5ePersistentAreaTriggerCandidate[] = []
  const queuedLimited = new Set<string>()
  const queuedTotalUses = new Map<string, number>()
  const mayQueue = (
    area: Dnd5ePluginArea,
    trigger: Dnd5ePersistentAreaTriggerSnapshot,
    targetTokenId: string,
  ) => {
    const runtimeTrigger = normalizeDnd5ePersistentAreaTriggerForRuntime(area, trigger)
    if (runtimeTrigger.excludedTokenIds?.includes(targetTokenId)) return false
    const lifecycleAdvances = area.lifecycleAdvances ?? 0
    if (
      (runtimeTrigger.minimumLifecycleAdvances != null && lifecycleAdvances < runtimeTrigger.minimumLifecycleAdvances) ||
      (runtimeTrigger.maximumLifecycleAdvances != null && lifecycleAdvances > runtimeTrigger.maximumLifecycleAdvances)
    ) return false
    if (alreadyTriggered(area, runtimeTrigger, targetTokenId, input.round, input.turnKey)) return false
    if (!(
      runtimeTrigger.oncePerRound === false &&
      runtimeTrigger.oncePerTurn !== true &&
      runtimeTrigger.oncePerTarget !== true
    )) {
      const frequencyKey = runtimeTrigger.oncePerTarget === true
        ? 'lifetime'
        : runtimeTrigger.oncePerTurn === true ? input.turnKey : input.round
      const key = `${area.id}\u0000${runtimeTrigger.frequencyGroupId ?? runtimeTrigger.id}\u0000${targetTokenId}\u0000${frequencyKey}`
      if (queuedLimited.has(key)) return false
      queuedLimited.add(key)
    }
    if (runtimeTrigger.maximumTotalUses != null && !runtimeTrigger.sourceChoosesTargets) {
      const totalKey = `${area.id}\u0000${runtimeTrigger.frequencyGroupId ?? runtimeTrigger.id}`
      const committed = (area.triggerReceipts ?? []).filter((receipt) =>
        receipt.triggerId === (runtimeTrigger.frequencyGroupId ?? runtimeTrigger.id)).length
      const queued = queuedTotalUses.get(totalKey) ?? 0
      if (committed + queued >= runtimeTrigger.maximumTotalUses) return false
      queuedTotalUses.set(totalKey, queued + 1)
    }
    return true
  }
  for (const afterArea of input.afterMap.dnd5ePluginAreas ?? []) {
    if (afterArea.magicMouth) continue
    if (afterArea.anchorMode !== 'source-token') continue
    if ((afterArea.anchorTokenId ?? afterArea.sourceTokenId) !== input.sourceTokenId) continue
    const beforeArea = beforeAreas.get(afterArea.id)
    if (!beforeArea) continue
    for (const trigger of afterArea.triggers ?? []) {
      if (trigger.timing !== 'on-enter') continue
      for (const target of input.afterMap.tokens) {
        if (target.id === input.sourceTokenId) continue
        if (isDefeatedPersistentAreaTarget(target)) continue
        if (!persistentAreaTriggerAllowsTarget(afterArea, trigger, target, input.afterMap)) continue
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
  const areas = (input.map.dnd5ePluginAreas ?? []).filter((area) =>
    area.magicMouth == null && (!input.areaId || area.id === input.areaId))
  if (areas.length === 0) return []
  const out: Dnd5ePersistentAreaTriggerCandidate[] = []
  const queuedLimited = new Set<string>()
  const queuedTotalUses = new Map<string, number>()
  const mayQueue = (
    area: Dnd5ePluginArea,
    trigger: Dnd5ePersistentAreaTriggerSnapshot,
    targetTokenId: string,
  ) => {
    const runtimeTrigger = normalizeDnd5ePersistentAreaTriggerForRuntime(area, trigger)
    if (runtimeTrigger.excludedTokenIds?.includes(targetTokenId)) return false
    const lifecycleAdvances = area.lifecycleAdvances ?? 0
    if (
      (runtimeTrigger.minimumLifecycleAdvances != null && lifecycleAdvances < runtimeTrigger.minimumLifecycleAdvances) ||
      (runtimeTrigger.maximumLifecycleAdvances != null && lifecycleAdvances > runtimeTrigger.maximumLifecycleAdvances)
    ) return false
    if (alreadyTriggered(area, runtimeTrigger, targetTokenId, input.round, input.turnKey)) return false
    if (!(
      runtimeTrigger.oncePerRound === false &&
      runtimeTrigger.oncePerTurn !== true &&
      runtimeTrigger.oncePerTarget !== true
    )) {
      const frequencyKey = runtimeTrigger.oncePerTarget === true
        ? 'lifetime'
        : runtimeTrigger.oncePerTurn === true ? input.turnKey : input.round
      const key = `${area.id}\u0000${runtimeTrigger.frequencyGroupId ?? runtimeTrigger.id}\u0000${targetTokenId}\u0000${frequencyKey}`
      if (queuedLimited.has(key)) return false
      queuedLimited.add(key)
    }
    if (runtimeTrigger.maximumTotalUses != null && !runtimeTrigger.sourceChoosesTargets) {
      const totalKey = `${area.id}\u0000${runtimeTrigger.frequencyGroupId ?? runtimeTrigger.id}`
      const committed = (area.triggerReceipts ?? []).filter((receipt) =>
        receipt.triggerId === (runtimeTrigger.frequencyGroupId ?? runtimeTrigger.id)).length
      const queued = queuedTotalUses.get(totalKey) ?? 0
      if (committed + queued >= runtimeTrigger.maximumTotalUses) return false
      queuedTotalUses.set(totalKey, queued + 1)
    }
    return true
  }

  if (input.timing === 'on-enter' || input.timing === 'on-move-distance') {
    const movement = input.movement
    if (!movement) return []
    const target = movement.token
    if (isDefeatedPersistentAreaTarget(target)) return []
    const from = tokenAnchorCellFromPixel(target.x, target.y, target, input.map)
    const to = tokenAnchorCellFromPixel(movement.to.x, movement.to.y, target, input.map)
    const declaredWaypoints = movement.path?.map((point, index) => ({
      cell: tokenAnchorCellFromPixel(point.x, point.y, target, input.map),
      elevationFeet: movement.pathElevationsFeet?.[index],
    })) ?? []
    const rawPath = declaredWaypoints.length > 0
      ? [
          { cell: from, elevationFeet: target.elevationFeet },
          ...declaredWaypoints,
          { cell: to, elevationFeet: movement.pathElevationsFeet?.at(-1) },
        ].flatMap((waypoint, index, waypoints) => {
          if (index === 0) return [waypoint]
          const previous = waypoints[index - 1]
          const segment = dnd5eMovementPathCells(previous.cell, waypoint.cell)
          if (segment.length === 1) return [waypoint]
          return segment.slice(1).map((cell, segmentIndex) => {
            const ratio = segment.length <= 1 ? 1 : (segmentIndex + 1) / (segment.length - 1)
            const elevationFeet = previous.elevationFeet != null && waypoint.elevationFeet != null
              ? previous.elevationFeet + (waypoint.elevationFeet - previous.elevationFeet) * ratio
              : segmentIndex === segment.length - 2
                ? waypoint.elevationFeet
                : undefined
            return { cell, elevationFeet }
          })
        })
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
      if (input.timing === 'on-enter') {
        for (const trigger of area.triggers ?? []) {
          if (trigger.timing !== 'on-enter') continue
          if (!persistentAreaTriggerAllowsTarget(area, trigger, target, input.map)) continue
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
            if (!persistentAreaTriggerAllowsTarget(area, trigger, target, input.map)) continue
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
    const lifecycleAdvances = area.lifecycleAdvances ?? 0
    for (const target of targets) {
      if (isDefeatedPersistentAreaTarget(target)) continue
      for (const trigger of area.triggers ?? []) {
        if (
          trigger.timing !== input.timing ||
          !persistentAreaTriggerAllowsTarget(area, trigger, target, input.map) ||
          (trigger.minimumLifecycleAdvances != null && lifecycleAdvances < trigger.minimumLifecycleAdvances) ||
          (trigger.maximumLifecycleAdvances != null && lifecycleAdvances > trigger.maximumLifecycleAdvances) ||
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
  damage = 0,
  savingThrowSucceeded?: boolean,
): Dnd5ePluginArea[] {
  return (areas ?? []).flatMap((area) => {
    if (area.id !== resolved.area.id) return [area]
    // Magic Mouth no longer owns a map object or an automatic map trigger.
    // Leave any legacy area untouched here; reconciliation removes it without
    // touching the DM-managed underlying map object.
    if (area.magicMouth) return [area]
    const receipts = (area.triggerReceipts ?? []).filter((receipt) => receipt.transactionId !== resolved.transactionId)
    receipts.push({
      triggerId: resolved.trigger.frequencyGroupId ?? resolved.trigger.id,
      targetTokenId: resolved.targetToken.id,
      round,
      turnKey: resolved.turnKey,
      transactionId: resolved.transactionId,
      damage: Math.max(0, Math.floor(damage)) || undefined,
      savingThrowSucceeded,
    })
    const frequencyId = resolved.trigger.frequencyGroupId ?? resolved.trigger.id
    const exhausted = resolved.trigger.maximumTotalDamage != null && receipts
      .filter((receipt) => receipt.triggerId === frequencyId)
      .reduce((total, receipt) => total + Math.max(0, receipt.damage ?? 0), 0) >=
        resolved.trigger.maximumTotalDamage
    return exhausted ? [] : [{ ...area, triggerReceipts: receipts.slice(-2_048) }]
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
    // Legacy map-save data may still contain Magic Mouth projections from an
    // older build. Remove the projection only; its associated object remains
    // a normal DM-managed map object.
    if (area.magicMouth) return false
    if (area.permanent !== true && round > area.expiresAfterRound) return false
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
      .filter((trigger) =>
        trigger.maximumTotalUses != null || trigger.maximumTotalDamage != null || trigger.oncePerTarget === true)
      .map((trigger) => trigger.frequencyGroupId ?? trigger.id))
    const triggerReceipts = area.triggerReceipts.filter((receipt) =>
      receipt.round >= round - 2 || persistentReceiptIds.has(receipt.triggerId) ||
      receipt.savingThrowSucceeded === true)
    return triggerReceipts.length === area.triggerReceipts.length
      ? area
      : { ...area, triggerReceipts: triggerReceipts.length > 0 ? triggerReceipts : undefined }
  })
}

/**
 * Removes finite persistent areas at the authoritative exploration-time
 * boundary. Combat rounds remain the finer-grained clock while combat is
 * active; this projection prevents hour-long areas from surviving arbitrary
 * campaign-time advances outside combat.
 */
export function expireDnd5ePluginAreasAtWorldMinute(
  map: BattleMap,
  worldMinute: number,
): BattleMap {
  if (!Number.isSafeInteger(worldMinute) || worldMinute < 0) return map
  const previous = map.dnd5ePluginAreas ?? []
  const next = previous.filter((area) =>
    area.permanent === true || area.expiresAtWorldMinute == null || worldMinute < area.expiresAtWorldMinute)
  if (next.length === previous.length) return map
  const liveEffectTokenIds = new Set(next.flatMap((area) =>
    area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : [],
  ))
  const tokens = map.tokens.filter((token) =>
    retainDnd5eSpellEffectToken(token, liveEffectTokenIds),
  )
  return {
    ...map,
    dnd5ePluginAreas: next,
    tokens,
  }
}

/**
 * Combat rounds restart at 1 for every encounter, while map areas may survive
 * between encounters. Rebase finite round boundaries before publishing the
 * inactive combat snapshot so the next encounter retains the true remainder.
 */
export function rebaseDnd5ePluginAreasAfterCombat(
  map: BattleMap,
  endingRound: number,
): BattleMap {
  const previousRound = Math.max(1, Math.trunc(endingRound))
  const areas = map.dnd5ePluginAreas ?? []
  let changed = false
  const rebasedAreas = areas.flatMap((area) => {
    const inclusiveOffset = area.sourceKind === 'core-spell' ? 0 : 1
    const remainingRounds = area.permanent === true
      ? undefined
      : Math.max(0, area.expiresAfterRound - previousRound + inclusiveOffset)
    if (remainingRounds === 0) {
      changed = true
      return []
    }
    const persistentReceiptIds = new Set((area.triggers ?? [])
      .filter((trigger) =>
        trigger.maximumTotalUses != null || trigger.maximumTotalDamage != null || trigger.oncePerTarget === true)
      .map((trigger) => trigger.frequencyGroupId ?? trigger.id))
    const triggerReceipts = area.triggerReceipts?.filter((receipt) =>
      persistentReceiptIds.has(receipt.triggerId),
    )
    const rebaseBoundary = (value: number | undefined) => value == null
      ? undefined
      : Math.max(1, value - previousRound + 1)
    const burningCells = area.webState?.burningCells
      ?.filter((cell) => cell.expiresAtRound >= previousRound)
      .map((cell) => ({
        ...cell,
        ignitedRound: Math.max(0, cell.ignitedRound - previousRound + 1),
        expiresAtRound: Math.max(1, cell.expiresAtRound - previousRound + 1),
      }))
    const next: Dnd5ePluginArea = {
      ...area,
      createdRound: 1,
      expiresAfterRound: area.permanent === true
        ? area.expiresAfterRound
        : 1 + remainingRounds! - inclusiveOffset,
      expiresAtSourceTurnEndAfterRound: rebaseBoundary(area.expiresAtSourceTurnEndAfterRound),
      lifecycleLastTurnKey: undefined,
      triggerReceipts: triggerReceipts?.length ? triggerReceipts : undefined,
      webState: area.webState
        ? {
            unsupportedCollapseAtRound: rebaseBoundary(area.webState.unsupportedCollapseAtRound),
            burningCells: burningCells?.length ? burningCells : undefined,
          }
        : undefined,
    }
    if (JSON.stringify(next) !== JSON.stringify(area)) changed = true
    return [next]
  })
  return changed ? { ...map, dnd5ePluginAreas: rebasedAreas } : map
}

export function reconcileDnd5ePluginAreasOnMap(
  map: BattleMap,
  characters: readonly Character[],
  round: number,
  movedSourceAreaIdsOverride?: ReadonlySet<string>,
): BattleMap {
  const movedSourceAreaIds = movedSourceAreaIdsOverride ?? new Set((map.dnd5ePluginAreas ?? []).flatMap((area) => {
    if (area.sourceOverlapBehavior !== 'remove-area' || area.anchorMode !== 'source-token') return []
    const sourceToken = map.tokens.find((token) => token.id === (area.anchorTokenId ?? area.sourceTokenId))
    if (!sourceToken || !area.anchorCell) return []
    const currentAnchor = tokenAnchorCellFromPixel(sourceToken.x, sourceToken.y, sourceToken, map)
    return currentAnchor.col !== area.anchorCell.col || currentAnchor.row !== area.anchorCell.row
      ? [area.id]
      : []
  }))
  const anchoredMap = reconcileDnd5ePersistentAreaAnchors(map)
  const sourceOverlapAreas = (anchoredMap.dnd5ePluginAreas ?? []).filter((area) => {
    if (area.sourceOverlapBehavior !== 'remove-area' || !movedSourceAreaIds.has(area.id)) return true
    return !anchoredMap.tokens.some((token) =>
      areaAllowsTarget(area, token, anchoredMap) &&
      persistentAreaBlockingAffectsToken(area, token) &&
      tokenIntersectsAreaAt(token, anchoredMap, area, token),
    )
  })
  const sourceBoundAreas = sourceOverlapAreas.filter((area) => {
    if (area.sourceExitBehavior !== 'remove-area') return true
    const sourceToken = anchoredMap.tokens.find((token) => token.id === area.sourceTokenId)
    return !!sourceToken && tokenIntersectsAreaAt(sourceToken, anchoredMap, area, sourceToken)
  })
  const next = disperseDnd5eFogAndMistAreas(reconcileDnd5ePluginAreas(
    sourceBoundAreas,
    characters,
    round,
    anchoredMap.tokens,
  )).map((area) => {
    if (!area.hallow || !area.triggerReceipts?.some((receipt) =>
      receipt.savingThrowSucceeded === true)) return area
    const triggerReceipts = area.triggerReceipts.filter((receipt) => {
      if (receipt.savingThrowSucceeded !== true) return true
      const token = anchoredMap.tokens.find((candidate) => candidate.id === receipt.targetTokenId)
      return !!token && tokenIntersectsAreaAt(token, anchoredMap, area, token)
    })
    return triggerReceipts.length === area.triggerReceipts.length
      ? area
      : { ...area, triggerReceipts: triggerReceipts.length ? triggerReceipts : undefined }
  })
  const previous = anchoredMap.dnd5ePluginAreas ?? []
  const nextAreaIds = new Set(next.map((area) => area.id))
  const removedAreas = previous.filter((area) => !nextAreaIds.has(area.id))
  const liveEffectTokenIds = new Set(next.flatMap((area) =>
    area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : [],
  ))
  const retainedTokens = anchoredMap.tokens.filter((token) =>
    retainDnd5eSpellEffectToken(token, liveEffectTokenIds),
  )
  const tokens = extinguishDnd5eUnprotectedFlamesInStrongWind({
    ...anchoredMap,
    dnd5ePluginAreas: next,
    tokens: retainedTokens,
  })
  const reconciledMap = ejectDnd5ePasswallOccupants({
    ...anchoredMap,
    dnd5ePluginAreas: next,
    tokens,
  }, removedAreas)
  if (
    next.length === previous.length && next.every((area, index) => area === previous[index]) &&
    tokens.length === anchoredMap.tokens.length &&
    tokens.every((token, index) => token === anchoredMap.tokens[index]) &&
    reconciledMap.tokens === tokens
  ) return anchoredMap
  return reconciledMap
}

export interface Dnd5ePluginAreaConcentrationReconciliation {
  map: BattleMap
  characters: readonly Character[]
  endedConcentrationCharacterIds: readonly string[]
  endedConcentrationTokenIds: readonly string[]
}

/**
 * Persistent-area reconciliation can end a concentration spell without going
 * through a damage save (strong wind dispersing Fog Cloud, a source leaving a
 * source-bound ward, or an area reaching its authoritative expiry). Keep the
 * caster summary and every source-linked ActiveEffect in the same state as the
 * surviving map areas.
 */
export function reconcileDnd5ePluginAreasAndConcentrationOnMap(
  map: BattleMap,
  characters: readonly Character[],
  round: number,
  reconciledMapOverride?: BattleMap,
): Dnd5ePluginAreaConcentrationReconciliation {
  const reconciledMap = reconciledMapOverride ?? reconcileDnd5ePluginAreasOnMap(map, characters, round)
  const liveAreas = reconciledMap.dnd5ePluginAreas ?? []
  const liveAreaIds = new Set(liveAreas.map((area) => area.id))
  const endedSources = (map.dnd5ePluginAreas ?? []).flatMap((area) => {
    if (!area.concentrationId || liveAreaIds.has(area.id)) return []
    const replacementSurvives = liveAreas.some((candidate) =>
      candidate.concentrationId === area.concentrationId &&
      candidate.sourceTokenId === area.sourceTokenId &&
      candidate.sourceCharacterId === area.sourceCharacterId,
    )
    return replacementSurvives ? [] : [{
      concentrationId: area.concentrationId,
      sourceCharacterId: area.sourceCharacterId,
      sourceTokenId: area.sourceTokenId,
    }]
  })
  if (endedSources.length === 0) {
    return {
      map: reconciledMap,
      characters,
      endedConcentrationCharacterIds: [],
      endedConcentrationTokenIds: [],
    }
  }

  const endedActorIds = new Set(endedSources.flatMap((source) => [
    source.sourceTokenId,
    ...(source.sourceCharacterId ? [source.sourceCharacterId] : []),
  ]))
  const effectIsEnded = (effect: ReturnType<typeof normalizeDnd5eActiveEffects>[number]) =>
    effect.duration.type === 'concentration' &&
    endedActorIds.has(effect.duration.sourceActorId)
  const clearLinkedState = <T extends {
    activeEffects?: Character['dnd5eCombatState'] extends infer S
      ? S extends { activeEffects?: infer E } ? E : never
      : never
    concentrationEffectsBySource?: Record<string, string>
    concentrationSpellId?: string
    concentrationSpellLevel?: number
    concentrationTargetIds?: string[]
    concentrationRoundsRemaining?: number
    huntersMarkTargetId?: string
  }>(state: T | undefined, endOwnConcentration: boolean): {
    state: T | undefined
    effectsChanged: boolean
    linkedStateChanged: boolean
  } => {
    if (!state) return { state, effectsChanged: false, linkedStateChanged: false }
    const currentEffects = normalizeDnd5eActiveEffects(state.activeEffects)
    const activeEffects = currentEffects.filter((effect) => !effectIsEnded(effect))
    const effectsChanged = activeEffects.length !== currentEffects.length
    const concentrationEffectsBySource = Object.fromEntries(
      Object.entries(state.concentrationEffectsBySource ?? {}).filter(([sourceId]) =>
        !endedActorIds.has(sourceId)),
    )
    const linkedStateChanged = Object.keys(concentrationEffectsBySource).length !==
      Object.keys(state.concentrationEffectsBySource ?? {}).length
    if (!effectsChanged && !linkedStateChanged && !endOwnConcentration) {
      return { state, effectsChanged: false, linkedStateChanged: false }
    }
    return {
      state: {
        ...state,
        ...(effectsChanged
          ? { activeEffects: activeEffects.length > 0 ? activeEffects : undefined }
          : {}),
        ...(linkedStateChanged
          ? {
              concentrationEffectsBySource: Object.keys(concentrationEffectsBySource).length > 0
                ? concentrationEffectsBySource
                : undefined,
            }
          : {}),
        ...(endOwnConcentration
          ? {
              concentrationSpellId: undefined,
              concentrationSpellLevel: undefined,
              concentrationTargetIds: undefined,
              concentrationRoundsRemaining: undefined,
              huntersMarkTargetId: undefined,
            }
          : {}),
      },
      effectsChanged,
      linkedStateChanged,
    }
  }

  const endedConcentrationCharacterIds: string[] = []
  let charactersChanged = false
  const nextCharacters = characters.map((character) => {
    const ownSource = endedSources.some((source) =>
      source.sourceCharacterId === character.id &&
      character.dnd5eCombatState?.concentrationSpellId === source.concentrationId,
    )
    const cleared = clearLinkedState(character.dnd5eCombatState, ownSource)
    if (!ownSource && !cleared.effectsChanged && !cleared.linkedStateChanged) return character
    charactersChanged = true
    if (ownSource) endedConcentrationCharacterIds.push(character.id)
    const projection = cleared.effectsChanged
      ? projectDnd5eActiveEffectState(cleared.state?.activeEffects)
      : undefined
    return {
      ...character,
      ...(ownSource ? { concentrating: false } : {}),
      ...(projection ? { conditions: projection.conditions } : {}),
      dnd5eCombatState: cleared.state,
    }
  })

  const endedConcentrationTokenIds: string[] = []
  let tokensChanged = false
  const tokens = reconciledMap.tokens.map((token) => {
    const ownSource = endedSources.some((source) =>
      source.sourceTokenId === token.id &&
      token.dnd5eCombatState?.concentrationSpellId === source.concentrationId,
    )
    const cleared = clearLinkedState(token.dnd5eCombatState, ownSource)
    if (!ownSource && !cleared.effectsChanged && !cleared.linkedStateChanged) return token
    tokensChanged = true
    if (ownSource) endedConcentrationTokenIds.push(token.id)
    const projection = cleared.effectsChanged
      ? projectDnd5eActiveEffectState(cleared.state?.activeEffects)
      : undefined
    return {
      ...token,
      ...(projection ? { conditions: projection.conditions } : {}),
      dnd5eCombatState: cleared.state,
    }
  })

  return {
    map: tokensChanged ? { ...reconciledMap, tokens } : reconciledMap,
    characters: charactersChanged ? nextCharacters : characters,
    endedConcentrationCharacterIds,
    endedConcentrationTokenIds,
  }
}

/**
 * Reconcile a completed source-token movement against the actual pre-move map.
 * The Headless movement projection and the reactive map reconciler can both
 * update an area's anchor before movement hazards settle, so the post-move map
 * alone is not reliable evidence that its source crossed a cell boundary.
 */
export function reconcileDnd5ePluginAreasAfterSourceMove(input: {
  beforeMap: BattleMap
  afterMap: BattleMap
  characters: readonly Character[]
  round: number
  sourceTokenId: string
}): Dnd5ePluginAreaConcentrationReconciliation {
  const beforeSource = input.beforeMap.tokens.find((token) => token.id === input.sourceTokenId)
  const afterSource = input.afterMap.tokens.find((token) => token.id === input.sourceTokenId)
  const sourceMoved = !!beforeSource && !!afterSource && (() => {
    const beforeAnchor = tokenAnchorCellFromPixel(
      beforeSource.x,
      beforeSource.y,
      beforeSource,
      input.beforeMap,
    )
    const afterAnchor = tokenAnchorCellFromPixel(
      afterSource.x,
      afterSource.y,
      afterSource,
      input.afterMap,
    )
    return beforeAnchor.col !== afterAnchor.col || beforeAnchor.row !== afterAnchor.row
  })()
  const movedSourceAreaIds = new Set(sourceMoved
    ? (input.beforeMap.dnd5ePluginAreas ?? []).flatMap((area) =>
        area.sourceOverlapBehavior === 'remove-area' &&
        area.anchorMode === 'source-token' &&
        (area.anchorTokenId ?? area.sourceTokenId) === input.sourceTokenId
          ? [area.id]
          : [],
      )
    : [])
  const reconciledMap = reconcileDnd5ePluginAreasOnMap(
    input.afterMap,
    input.characters,
    input.round,
    movedSourceAreaIds,
  )
  return reconcileDnd5ePluginAreasAndConcentrationOnMap(
    input.afterMap,
    input.characters,
    input.round,
    reconciledMap,
  )
}

export interface Dnd5ePersistentAreaLifecycleAdvanceResult {
  map: BattleMap
  movedAreaIds: readonly string[]
}

const DND5E_WIND_DISPERSIBLE_CORE_SPELL_IDS = new Set([
  'fog-cloud',
  'stinking-cloud',
  'cloudkill',
])

function persistentAreasOverlap(left: Dnd5ePluginArea, right: Dnd5ePluginArea): boolean {
  const leftCells = new Set(left.cells.map(gridCellKey))
  return right.cells.some((cell) => leftCells.has(gridCellKey(cell)))
}

function persistentAreaActivelyDispersesFogAndMist(area: Dnd5ePluginArea): boolean {
  const lifecycleAdvances = area.lifecycleAdvances ?? 0
  // Gust of Wind and Wind Wall are strong wind for their complete lifetime,
  // so overlapping fog, smoke, and gas spell areas are removed as soon as
  // either area is created. Keep this intrinsic to the spell ids so persisted
  // areas created by older clients gain the rule after reconnecting.
  if (
    area.sourceKind === 'core-spell' &&
    (area.coreSpellId === 'gust-of-wind' || area.coreSpellId === 'wind-wall')
  ) return true
  // Migration for Storm of Vengeance areas created before the strong-wind
  // stage carried an explicit dispersal flag in its immutable snapshot.
  if (
    area.sourceKind === 'core-spell' && area.coreSpellId === 'storm-of-vengeance' &&
    lifecycleAdvances >= 4 && lifecycleAdvances <= 9
  ) return true
  const latestDeclaration = [...(area.lifecycle?.stages ?? [])]
    .filter((stage) => stage.atAdvance <= lifecycleAdvances && stage.dispersesFogAndMist != null)
    .sort((left, right) => right.atAdvance - left.atAdvance)[0]
  return latestDeclaration?.dispersesFogAndMist === true
}

function disperseDnd5eFogAndMistAreas(areas: readonly Dnd5ePluginArea[]): Dnd5ePluginArea[] {
  const sources = areas.filter(persistentAreaActivelyDispersesFogAndMist)
  if (sources.length === 0) return [...areas]
  return areas.filter((area) => !(
    area.sourceKind === 'core-spell' && area.coreSpellId &&
    DND5E_WIND_DISPERSIBLE_CORE_SPELL_IDS.has(area.coreSpellId) &&
    sources.some((sourceArea) => sourceArea.id !== area.id && persistentAreasOverlap(sourceArea, area))
  ))
}

const DND5E_UNPROTECTED_FLAME_SOURCE_KINDS = new Set(['torch', 'candle'])

/**
 * Gust of Wind extinguishes ordinary exposed flames without a roll. Token
 * light presets are authoritative map state, so clear the carried light as
 * soon as an exposed torch or candle overlaps a live strong-wind area. Lamps
 * and lanterns are protected flames and intentionally remain for the separate
 * 50% adjudication instead of being silently resolved by a non-auditable RNG.
 */
function extinguishDnd5eUnprotectedFlamesInStrongWind(map: BattleMap): Token[] {
  const strongWindAreas = (map.dnd5ePluginAreas ?? []).filter((area) =>
    area.sourceKind === 'core-spell' && area.coreSpellId === 'gust-of-wind')
  if (strongWindAreas.length === 0) return map.tokens

  let changed = false
  const tokens = map.tokens.map((token) => {
    const lightSourceKind = token.lightSource?.sourceKind
    if (
      token.lightSource?.enabled !== true ||
      !lightSourceKind ||
      !DND5E_UNPROTECTED_FLAME_SOURCE_KINDS.has(lightSourceKind) ||
      !strongWindAreas.some((area) => tokenIntersectsAreaAt(token, map, area, token))
    ) return token
    changed = true
    return { ...token, lightSource: undefined }
  })
  return changed ? tokens : map.tokens
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
  const lifecycleTiming = input.timing === 'turn-start' ? 'source-turn-start' : 'source-turn-end'
  const source = input.map.tokens.find((token) => token.id === input.tokenId)
  if (!source) return { map: input.map, movedAreaIds: [] }
  const sourceCell = tokenAnchorCellFromPixel(source.x, source.y, source, input.map)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const maximumCol = Math.max(0, Math.ceil(input.map.width / Math.max(1, input.map.gridSize)) - 1)
  const maximumRow = Math.max(0, Math.ceil(input.map.height / Math.max(1, input.map.gridSize)) - 1)
  const movedAreaIds: string[] = []
  let changed = false
  const advancedAreas = (input.map.dnd5ePluginAreas ?? []).flatMap((area) => {
    const lifecycle = area.lifecycle
    if (
      !lifecycle || lifecycle.timing !== lifecycleTiming ||
      area.sourceTokenId !== input.tokenId ||
      (area.createdRound >= input.round && lifecycle.advanceOnCreationRound !== true) ||
      (lifecycle.maximumAdvances != null && (area.lifecycleAdvances ?? 0) >= lifecycle.maximumAdvances) ||
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
    const nextLifecycleAdvances = (area.lifecycleAdvances ?? 0) + 1
    const lifecycleStage = lifecycle.stages?.find((stage) => stage.atAdvance === nextLifecycleAdvances)
    return [{
      ...area,
      cells,
      anchorCell: area.anchorCell ? translate(area.anchorCell) : { ...cells[0] },
      vertical,
      triggers,
      ...(lifecycleStage?.movementCostMultiplier != null
        ? { movementCostMultiplier: lifecycleStage.movementCostMultiplier }
        : {}),
      ...(lifecycleStage?.obscuration ? { obscuration: lifecycleStage.obscuration } : {}),
      ...(lifecycleStage?.occupantModifiers ? { occupantModifiers: lifecycleStage.occupantModifiers } : {}),
      lifecycleAdvances: nextLifecycleAdvances,
      lifecycleLastTurnKey: input.turnKey,
    }]
  })
  const next = disperseDnd5eFogAndMistAreas(advancedAreas)
  const nextAreaIds = new Set(next.map((area) => area.id))
  const dispersedAreaIds = new Set(advancedAreas
    .filter((area) => !nextAreaIds.has(area.id))
    .map((area) => area.id))
  if (dispersedAreaIds.size > 0) changed = true
  const liveEffectTokenIds = new Set(next.flatMap((area) =>
    area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : [],
  ))
  const tokens = dispersedAreaIds.size > 0
    ? input.map.tokens.filter((token) =>
        retainDnd5eSpellEffectToken(token, liveEffectTokenIds),
      )
    : input.map.tokens
  return changed
    ? { map: { ...input.map, dnd5ePluginAreas: next, tokens }, movedAreaIds }
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
  const next = previous.filter((area) => {
    // Core spell areas created before exact initiative-boundary expiry was
    // persisted still carry the correct round boundary in expiresAfterRound.
    const expiresAtSourceTurnEndAfterRound = area.expiresAtSourceTurnEndAfterRound ?? (
      area.sourceKind === 'core-spell' && area.permanent !== true
        ? area.expiresAfterRound
        : undefined
    )
    return expiresAtSourceTurnEndAfterRound == null ||
    area.sourceTokenId !== input.tokenId ||
    input.round < expiresAtSourceTurnEndAfterRound
  })
  if (next.length === previous.length) return input.map
  const liveEffectTokenIds = new Set(next.flatMap((area) =>
    area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : [],
  ))
  return {
    ...input.map,
    dnd5ePluginAreas: next,
    tokens: input.map.tokens.filter((token) =>
      retainDnd5eSpellEffectToken(token, liveEffectTokenIds),
    ),
  }
}

/**
 * Collects the final detonation wave before an expiring area is removed at its
 * source turn boundary. Keeping collection separate from removal lets the Host
 * settle saves and damage against the immutable area snapshot first.
 */
export function collectDnd5eExpiringPersistentAreaDetonationTriggers(input: {
  map: BattleMap
  timing: 'turn-start' | 'turn-end'
  round: number
  tokenId: string
  turnKey: string
}): Dnd5ePersistentAreaTriggerCandidate[] {
  if (input.timing !== 'turn-end') return []
  return (input.map.dnd5ePluginAreas ?? [])
    .filter((area) => {
      const expiresAtSourceTurnEndAfterRound = area.expiresAtSourceTurnEndAfterRound ?? (
        area.sourceKind === 'core-spell' && area.permanent !== true
          ? area.expiresAfterRound
          : undefined
      )
      return area.sourceTokenId === input.tokenId &&
        expiresAtSourceTurnEndAfterRound != null &&
        input.round >= expiresAtSourceTurnEndAfterRound &&
        area.triggers?.some((trigger) => trigger.timing === 'on-detonate')
    })
    .flatMap((area) => collectDnd5ePersistentAreaTriggers({
      map: input.map,
      timing: 'on-detonate',
      round: input.round,
      areaId: area.id,
      turnKey: input.turnKey,
    }))
}
