import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import {
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import { isTokenMovementLocked } from '../../lib/combatStatus'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import {
  mapGeometryCoverBetween,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryLineOfSightBlocked,
  mapGeometryMovementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometrySegments,
  mapGeometrySegmentsIntersect,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import {
  dnd5eMonsterMapSpeed,
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import {
  dnd5eMonsterEffectiveBehaviorStyle,
  selectDnd5eMonsterPreferredTarget,
} from './monsterAutomation'
import {
  DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  rankMonsterDecisionCandidates,
  type MonsterDecisionCandidate,
  type MonsterDecisionContext,
  type MonsterDecisionProvider,
} from './monsterDecisionProvider'
import {
  dnd5ePersistentAreaDifficultTerrainMultiplierAt,
  dnd5ePersistentAreaSpeedCostMultiplierAt,
} from './pluginAreas'

function monsterTraversalGeometry(mapId: string) {
  const geometry = mapGeometryRuntimeForMap(mapId)
  return geometry ? {
    ...geometry,
    doors: geometry.doors.map((door) =>
      mapGeometryDoorOpenState(door) === 'closed' && mapGeometryDoorLockState(door) === 'unlocked'
        ? { ...door, state: 'open' as const, openState: 'open' as const }
        : door,
    ),
  } : undefined
}

export interface Dnd5eMonsterTurnPlan {
  moved: boolean
  /** 被驱散的亡灵及战术规划器可以用动作疾走。 */
  dashed?: boolean
  /** Tactical Planner V2 可在没有有效攻击时使用闪避。 */
  dodged?: boolean
  /** 已由 Host 验证并在移动事务内消耗附赠动作的灵巧脱逃。 */
  nimbleEscape?: 'disengage'
  moveApSpent?: number
  newPosition?: { x: number; y: number }
  newElevationFeet?: number
  movementMode?: 'walk' | 'fly'
  attacked: boolean
  attackerTokenId?: string
  targetTokenId?: string
  actionIndex?: number
  attack?: {
    values: number[]
    sides: number
    bonus: number
    total: number
    label: string
    targetName: string
  }
  damageType?: 'physical'
  targetCharacterId?: string
  damage?: number
  message: string
  decision?: {
    providerId: string
    candidateId: string
    candidateCount: number
    score: number
    reasons: readonly string[]
  }
}

export interface Dnd5eMonsterTurnPlannerOptions {
  decisionProvider?: MonsterDecisionProvider
  turnEconomy?: Dnd5eTurnEconomyCounts
}

interface ReachableMonsterPosition {
  cell: GridCell
  steps: number
  position: { x: number; y: number }
}

interface MonsterMovementProfile {
  fromElevationFeet: number
  toElevationFeet: number
  canFly: boolean
  mode: 'walk' | 'fly'
}

const GRID_DIRECTIONS = [-1, 0, 1].flatMap((dc) => [-1, 0, 1].flatMap((dr) =>
  dc === 0 && dr === 0 ? [] : [{ dc, dr }],
))

function reachableMonsterPositions(
  start: GridCell,
  map: BattleMap,
  tokens: readonly Token[],
  enemy: Token,
  maxSteps: number,
  movement: MonsterMovementProfile,
): ReachableMonsterPosition[] {
  const geometry = monsterTraversalGeometry(map.id)
  const movementBase = movement.canFly ? movement.toElevationFeet : undefined
  const enemyHeight = Math.max(5, Math.max(1, enemy.size) * 5)
  const collisionTokens = movementBase == null
    ? [...tokens]
    : tokens.filter((candidate) => {
        if (candidate.id === enemy.id) return true
        const candidateBase = mapGeometryTokenElevation(geometry, candidate)
        const candidateHeight = Math.max(5, Math.max(1, candidate.size) * 5)
        return movementBase < candidateBase + candidateHeight &&
          movementBase + enemyHeight > candidateBase
      })
  const blocked = occupiedCells(collisionTokens, map, enemy.id)
  const columns = Math.max(1, Math.floor(map.width / map.gridSize))
  const rows = Math.max(1, Math.floor(map.height / map.gridSize))
  const footprintCells = Math.max(1, Math.round(Math.sqrt(tokenOccupiedCellsAt(enemy, map, enemy).length)))
  const queue: Array<{ cell: GridCell; steps: number }> = [{ cell: start, steps: 0 }]
  const visited = new Set([`${start.col},${start.row}`])
  const result: ReachableMonsterPosition[] = [{
    cell: start,
    steps: 0,
    position: { x: enemy.x, y: enemy.y },
  }]

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex]
    if (current.steps >= maxSteps) continue
    for (const { dc, dr } of GRID_DIRECTIONS) {
      const next = { col: current.cell.col + dc, row: current.cell.row + dr }
      const key = `${next.col},${next.row}`
      if (visited.has(key)) continue
      visited.add(key)
      if (
        next.col < 0 || next.row < 0 ||
        next.col + footprintCells > columns || next.row + footprintCells > rows
      ) continue
      const position = tokenCenterForAnchorCell(next, enemy, map)
      const nextElevationFeet = movement.canFly ? movement.toElevationFeet : undefined
      const candidate = { ...enemy, ...position, ...(nextElevationFeet == null ? {} : { elevationFeet: nextElevationFeet }) }
      if (tokenOccupiedCellsAt(candidate, map, candidate).some((cell) => blocked.has(`${cell.col},${cell.row}`))) continue
      const currentPosition = tokenCenterForAnchorCell(current.cell, enemy, map)
      const currentElevationFeet = movement.canFly
        ? current.steps === 0 ? movement.fromElevationFeet : movement.toElevationFeet
        : undefined
      if (mapGeometryMovementBlocked({
        geometry,
        map,
        token: {
          ...enemy,
          ...currentPosition,
          ...(currentElevationFeet == null ? {} : { elevationFeet: currentElevationFeet }),
        },
        to: position,
        fromElevationFeet: currentElevationFeet,
        toElevationFeet: nextElevationFeet,
      }).blocked) continue
      const steps = current.steps + 1
      queue.push({ cell: next, steps })
      result.push({ cell: next, steps, position })
    }
  }
  return result
}

function moveAway(
  start: GridCell,
  source: GridCell,
  map: BattleMap,
  tokens: readonly Token[],
  enemy: Token,
  maxSteps: number,
): GridCell {
  let current = start
  const blocked = occupiedCells([...tokens], map, enemy.id)
  const columns = Math.max(1, Math.floor(map.width / map.gridSize))
  const rows = Math.max(1, Math.floor(map.height / map.gridSize))
  for (let index = 0; index < maxSteps; index += 1) {
    const currentDistance = (current.col - source.col) ** 2 + (current.row - source.row) ** 2
    const next = GRID_DIRECTIONS
      .map(({ dc, dr }) => ({ col: current.col + dc, row: current.row + dr }))
      .filter((candidate) => {
        if (candidate.col < 0 || candidate.row < 0 || candidate.col >= columns || candidate.row >= rows) return false
        const position = tokenCenterForAnchorCell(candidate, enemy, map)
        const placed = { ...enemy, ...position }
        if (tokenOccupiedCellsAt(placed, map, placed).some((cell) => blocked.has(`${cell.col},${cell.row}`))) return false
        const currentPosition = tokenCenterForAnchorCell(current, enemy, map)
        return !mapGeometryMovementBlocked({
          geometry: monsterTraversalGeometry(map.id), map, token: { ...enemy, ...currentPosition }, to: position,
        }).blocked
      })
      .sort((left, right) =>
        ((right.col - source.col) ** 2 + (right.row - source.row) ** 2) -
        ((left.col - source.col) ** 2 + (left.row - source.row) ** 2) ||
        left.col - right.col || left.row - right.row,
      )[0]
    if (!next) break
    const nextDistance = (next.col - source.col) ** 2 + (next.row - source.row) ** 2
    if (nextDistance <= currentDistance) break
    current = next
  }
  return current
}

function actionSequence(monster: Dnd5eMonsterStatBlock, action: Dnd5eMonsterAction): readonly Dnd5eMonsterAction[] {
  if (action.kind !== 'multiattack') return [action]
  return (action.sequence ?? []).flatMap((actionId) => {
    const child = monster.actions.find((candidate) => candidate.id === actionId)
    return child ? [child] : []
  })
}

function attackModeAtDistance(
  action: Dnd5eMonsterAction,
  distanceFeet: number,
): { legal: boolean; ranged: boolean; longRange: boolean } {
  const attack = action.attack
  if (!attack) return { legal: false, ranged: false, longRange: false }
  const melee = attack.mode !== 'ranged' && distanceFeet <= (attack.reachFeet ?? 5)
  const ranged = attack.mode !== 'melee' && !!attack.rangeFeet && distanceFeet <= attack.rangeFeet.long
  if (melee) return { legal: true, ranged: false, longRange: false }
  if (ranged && attack.rangeFeet) {
    return { legal: true, ranged: true, longRange: distanceFeet > attack.rangeFeet.normal }
  }
  return { legal: false, ranged: false, longRange: false }
}

function tokenThreeDimensionalDistanceFeet(
  map: BattleMap,
  geometry: ReturnType<typeof mapGeometryRuntimeForMap>,
  left: Token,
  right: Token,
): number {
  const horizontal = tokenFootprintDistanceCells(left, right, map) * Math.max(1, map.feetPerCell ?? 5)
  const vertical = Math.abs(mapGeometryTokenElevation(geometry, left) - mapGeometryTokenElevation(geometry, right))
  return Math.max(horizontal, vertical)
}

function targetHitPoints(target: Token, characters: readonly Character[]): { current: number; maximum: number } {
  const character = target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
  const maximum = Math.max(1, Math.floor(character?.maxHp ?? target.maxHp ?? 1))
  return {
    current: Math.max(0, Math.min(maximum, Math.floor(character?.currentHp ?? target.hp ?? maximum))),
    maximum,
  }
}

function targetArmorClass(target: Token, characters: readonly Character[]): number {
  const character = target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
  if (character) return Math.max(0, character.ac)
  return target.poolId ? getDnd5eSrdMonster(target.poolId)?.armorClass.value ?? 10 : 10
}

function attackPreview(
  action: Dnd5eMonsterAction,
  monster: Dnd5eMonsterStatBlock,
  target: Token,
  index: number,
  moved: boolean,
  position?: { x: number; y: number },
  elevationFeet?: number,
  movementMode?: 'walk' | 'fly',
): Dnd5eMonsterTurnPlan {
  const firstAction = action.kind === 'multiattack'
    ? monster.actions.find((candidate) => candidate.id === action.sequence?.[0])
    : action
  const damage = firstAction?.attack?.damage[0]
  if (!damage) return {
    moved,
    newPosition: position,
    newElevationFeet: elevationFeet,
    movementMode,
    attacked: false,
    message: `${monster.name} 没有可结算的攻击。`,
  }
  return {
    moved,
    newPosition: position,
    newElevationFeet: elevationFeet,
    movementMode,
    attacked: true,
    attackerTokenId: '',
    targetTokenId: target.id,
    actionIndex: index,
    attack: {
      values: [],
      sides: damage.sides,
      bonus: damage.bonus,
      total: damage.average,
      label: `${action.name} ${damage.count}d${damage.sides}${damage.bonus >= 0 ? '+' : ''}${damage.bonus}`,
      targetName: target.label,
    },
    damageType: 'physical',
    targetCharacterId: target.characterId,
    damage: damage.average,
    message: `${monster.name}${moved ? '移动后' : ''}使用${action.name}攻击 ${target.label}。`,
  }
}

function monsterFlightElevation(
  map: BattleMap,
  enemy: Token,
  target: Token,
  flySpeedFeet: number,
): number {
  const geometry = mapGeometryRuntimeForMap(map.id)
  const current = mapGeometryTokenElevation(geometry, enemy)
  const targetElevation = mapGeometryTokenElevation(geometry, target)
  let required = targetElevation + 5
  for (const segment of mapGeometrySegments(geometry)) {
    if (!segment.blocksMovement) continue
    if (!mapGeometrySegmentsIntersect(enemy, target, segment.a, segment.b, true)) continue
    required = Math.max(required, segment.baseHeightFeet + segment.heightFeet + 1)
  }
  const maximumReachable = current + Math.max(0, flySpeedFeet)
  return Math.max(mapGeometryTerrainElevationAtPoint(geometry, target), Math.min(required, maximumReachable))
}

function monsterTacticalRole(monster: Dnd5eMonsterStatBlock): MonsterDecisionContext['tacticalRole'] {
  const attacks = monster.actions
    .filter((action) => dnd5eMonsterActionAutomation(action) === 'headless')
    .flatMap((action) => actionSequence(monster, action))
  const hasRanged = attacks.some((action) => (action.attack?.rangeFeet?.normal ?? 0) >= 20)
  const hasMelee = attacks.some((action) => (action.attack?.reachFeet ?? 0) > 0 && action.attack?.mode !== 'ranged')
  if (hasRanged && hasMelee) return 'skirmisher'
  return hasRanged ? 'ranged' : 'melee'
}

function preferredDistanceFeet(
  monster: Dnd5eMonsterStatBlock,
  role: MonsterDecisionContext['tacticalRole'],
  style: MonsterDecisionContext['behaviorStyle'],
): number {
  if (role === 'melee') return 5
  const shortestNormalRange = monster.actions
    .flatMap((action) => actionSequence(monster, action))
    .flatMap((action) => action.attack?.rangeFeet?.normal ? [action.attack.rangeFeet.normal] : [])
    .sort((left, right) => left - right)[0] ?? 30
  const base = Math.max(15, Math.min(30, shortestNormalRange / 2))
  if (style === 'aggressive') return Math.max(10, base - 10)
  if (style === 'defensive' || style === 'skirmisher') return Math.min(40, base + 5)
  if (style === 'cowardly') return Math.min(60, base + 15)
  return base
}

function tacticalDistanceImprovement(
  role: MonsterDecisionContext['tacticalRole'],
  startDistanceFeet: number,
  distanceFeet: number,
  preferredDistance: number,
): number {
  if (role === 'melee') return Math.max(0, startDistanceFeet - distanceFeet)
  const startError = Math.max(0, Math.abs(startDistanceFeet - preferredDistance) - 5)
  const nextError = Math.max(0, Math.abs(distanceFeet - preferredDistance) - 5)
  return Math.max(0, startError - nextError)
}

function opportunityAttackRisk(
  map: BattleMap,
  enemy: Token,
  at: Token,
): number {
  const geometry = mapGeometryRuntimeForMap(map.id)
  return map.tokens.filter((candidate) =>
    candidate.id !== enemy.id &&
    candidate.type !== 'obstacle' &&
    areOpposedCombatTokens(enemy, candidate) &&
    tokenThreeDimensionalDistanceFeet(map, geometry, enemy, candidate) <= 5 &&
    tokenThreeDimensionalDistanceFeet(map, geometry, at, candidate) > 5,
  ).length
}

function defensiveCoverBonusAgainstTarget(map: BattleMap, enemy: Token, target: Token): number {
  const geometry = mapGeometryRuntimeForMap(map.id)
  return mapGeometryCoverBetween(geometry, target, enemy, map).armorClassBonus
}

function targetConcentrating(target: Token, characters: readonly Character[]): boolean {
  const character = target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
  return character?.concentrating === true ||
    !!character?.dnd5eCombatState?.concentrationSpellId ||
    !!target.dnd5eCombatState?.concentrationSpellId
}

function targetSupportCount(map: BattleMap, enemyAt: Token, target: Token): number {
  const geometry = mapGeometryRuntimeForMap(map.id)
  return map.tokens.filter((candidate) =>
    candidate.id !== target.id &&
    candidate.id !== enemyAt.id &&
    candidate.type !== 'obstacle' &&
    !areOpposedCombatTokens(candidate, target) &&
    areOpposedCombatTokens(candidate, enemyAt) &&
    tokenThreeDimensionalDistanceFeet(map, geometry, candidate, enemyAt) <= 5,
  ).length
}

function monsterHasNimbleEscape(monster: Dnd5eMonsterStatBlock): boolean {
  return monster.traits.some((trait) =>
    trait.automation === 'headless' && trait.rule?.kind === 'nimble-escape' &&
    trait.rule.bonusActionOptions.includes('disengage'),
  )
}

function actionExpectedValue(input: {
  map: BattleMap
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  attacker: Token
  target: Token
  characters: readonly Character[]
  distanceFeet: number
}): { expectedDamage: number; hitProbability: number } | undefined {
  const { map, monster, action, attacker, target, characters, distanceFeet } = input
  const sequence = actionSequence(monster, action)
  if (sequence.length === 0) return undefined
  const geometry = mapGeometryRuntimeForMap(map.id)
  const cover = mapGeometryCoverBetween(geometry, attacker, target, map)
  if (cover.blocksLineOfEffect || cover.cover === 'total') return undefined
  const lineOfSightBlocked = mapGeometryLineOfSightBlocked({
    geometry,
    from: attacker,
    to: target,
    fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
    toElevationFeet: mapGeometryTokenElevation(geometry, target),
  })
  if (lineOfSightBlocked) return undefined
  const targetAc = targetArmorClass(target, characters) + cover.armorClassBonus
  let expectedDamage = 0
  let probabilityTotal = 0
  for (const child of sequence) {
    const mode = attackModeAtDistance(child, distanceFeet)
    if (!mode.legal || !child.attack) return undefined
    const nearbyHostile = mode.ranged && map.tokens.some((candidate) =>
      candidate.id !== attacker.id && candidate.type !== 'obstacle' && areOpposedCombatTokens(attacker, candidate) &&
      tokenThreeDimensionalDistanceFeet(map, geometry, attacker, candidate) <= 5,
    )
    const baseProbability = Math.max(0.05, Math.min(0.95, (21 + child.attack.toHit - targetAc) / 20))
    const disadvantaged = mode.longRange || nearbyHostile
    const hitProbability = disadvantaged ? baseProbability ** 2 : baseProbability
    const damage = child.attack.damage.reduce((sum, entry) => sum + entry.average, 0)
    expectedDamage += damage * hitProbability
    probabilityTotal += hitProbability
  }
  return {
    expectedDamage,
    hitProbability: probabilityTotal / sequence.length,
  }
}

interface ExactMonsterRoute {
  movementCostFeet: number
  points: Array<{ x: number; y: number }>
}

function exactMonsterRouteForPlan(
  map: BattleMap,
  enemy: Token,
  monster: Dnd5eMonsterStatBlock,
  plan: Dnd5eMonsterTurnPlan,
): ExactMonsterRoute | undefined {
  const destination = plan.newPosition
  if (!destination) return { movementCostFeet: 0, points: [{ x: enemy.x, y: enemy.y }] }
  const geometry = mapGeometryRuntimeForMap(map.id)
  const actorElevationFeet = mapGeometryTokenElevation(geometry, enemy)
  const actorGroundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, enemy)
  const targetGroundElevationFeet = mapGeometryTerrainElevationAtPoint(geometry, destination)
  const targetElevationFeet = plan.newElevationFeet ?? (
    actorElevationFeet > actorGroundElevationFeet
      ? Math.max(targetGroundElevationFeet, actorElevationFeet)
      : targetGroundElevationFeet
  )
  const canFly = (monster.speed.fly ?? 0) > 0 && (
    actorElevationFeet > actorGroundElevationFeet || targetElevationFeet > targetGroundElevationFeet
  )
  const path = findMapGeometryPath({
    geometry,
    map,
    token: enemy,
    to: destination,
    allowOpenUnlockedDoors: true,
    canClimb: (monster.speed.climb ?? 0) > 0,
    canSwim: (monster.speed.swim ?? 0) > 0,
    canFly,
    targetElevationFeet,
    additionalDifficultTerrainMultiplier: (token, position) =>
      dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map, token, position }),
    additionalSpeedCostMultiplier: (token, position) =>
      dnd5ePersistentAreaSpeedCostMultiplierAt({ map, token, position }),
  })
  if (!path || path.doorsToOpen.length > 1) return undefined
  const verticalDistanceFeet = Math.abs((path.elevationsFeet.at(-1) ?? actorElevationFeet) - actorElevationFeet)
  const available = (plan.movementMode === 'fly'
    ? monster.speed.fly ?? dnd5eMonsterMapSpeed(monster)
    : dnd5eMonsterMapSpeed(monster)) * (plan.dashed ? 2 : 1)
  const movementCostFeet = path.movementCostFeet + verticalDistanceFeet
  if (movementCostFeet > available + 1e-4) return undefined
  return { movementCostFeet, points: path.points }
}

function movementCandidateIsExecutable(
  map: BattleMap,
  enemy: Token,
  monster: Dnd5eMonsterStatBlock,
  candidate: MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>,
): boolean {
  return !!exactMonsterRouteForPlan(map, enemy, monster, candidate.payload)
}

function createTacticalCandidates(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  target: Token
  characters: readonly Character[]
  canUseBonusAction: boolean
  preferredTargetId?: string
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  const { map, enemy, monster, target, characters } = input
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const geometry = mapGeometryRuntimeForMap(map.id)
  const startDistanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, enemy, target)
  const start = tokenAnchorCellFromPixel(enemy.x, enemy.y, enemy, map)
  const movementSpeed = dnd5eMonsterMapSpeed(monster)
  const flySpeed = Math.max(0, monster.speed.fly ?? 0)
  const walkSpeed = Math.max(0, monster.speed.walk ?? 0)
  const currentElevationFeet = mapGeometryTokenElevation(geometry, enemy)
  const currentGroundFeet = mapGeometryTerrainElevationAtPoint(geometry, enemy)
  const targetElevationFeet = mapGeometryTokenElevation(geometry, target)
  const targetGroundFeet = mapGeometryTerrainElevationAtPoint(geometry, target)
  const directGroundRouteBlocked = mapGeometryMovementBlocked({
    geometry,
    map,
    token: { ...enemy, elevationFeet: currentGroundFeet },
    to: target,
    fromElevationFeet: currentGroundFeet,
    toElevationFeet: targetGroundFeet,
  }).blocked
  const shouldFly = flySpeed > 0 && (
    currentElevationFeet > currentGroundFeet ||
    targetElevationFeet > targetGroundFeet ||
    directGroundRouteBlocked ||
    flySpeed > walkSpeed
  )
  const desiredElevationFeet = shouldFly
    ? monsterFlightElevation(map, enemy, target, flySpeed)
    : mapGeometryTerrainElevationAtPoint(geometry, target)
  const verticalCostFeet = shouldFly ? Math.abs(desiredElevationFeet - currentElevationFeet) : 0
  const movementProfile: MonsterMovementProfile = {
    fromElevationFeet: currentElevationFeet,
    toElevationFeet: desiredElevationFeet,
    canFly: shouldFly,
    mode: shouldFly ? 'fly' : 'walk',
  }
  const canMove = !isTokenMovementLocked(enemy)
  const normalHorizontalFeet = canMove
    ? Math.max(0, (shouldFly ? flySpeed : movementSpeed) - verticalCostFeet)
    : 0
  const dashHorizontalFeet = canMove
    ? Math.max(0, (shouldFly ? flySpeed : movementSpeed) * 2 - verticalCostFeet)
    : 0
  const normalPositions = reachableMonsterPositions(
    start, map, map.tokens, enemy, Math.floor(normalHorizontalFeet / feetPerCell), movementProfile,
  )
  const dashPositions = reachableMonsterPositions(
    start, map, map.tokens, enemy, Math.floor(dashHorizontalFeet / feetPerCell), movementProfile,
  )
  const role = monsterTacticalRole(monster)
  const behaviorStyle = dnd5eMonsterEffectiveBehaviorStyle(enemy, role)
  const preferred = preferredDistanceFeet(monster, role, behaviorStyle)
  const hasNimbleEscape = input.canUseBonusAction && monsterHasNimbleEscape(monster)
  const targetHp = targetHitPoints(target, characters)
  const targetAc = targetArmorClass(target, characters)
  const targetIsConcentrating = targetConcentrating(target, characters)
  const targetThreat = enemy.dnd5eCombatState?.monsterThreatByTargetId?.[target.id] ?? 0
  const targetPriorityWeight = target.id === input.preferredTargetId ? 1 : 0
  const candidates: MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] = []
  const routeCache = new Map<string, ExactMonsterRoute | null>()
  const exactRoute = (plan: Dnd5eMonsterTurnPlan): ExactMonsterRoute | undefined => {
    const destination = plan.newPosition
    if (!destination) return exactMonsterRouteForPlan(map, enemy, monster, plan)
    const key = [
      destination.x,
      destination.y,
      plan.newElevationFeet ?? '',
      plan.movementMode ?? 'walk',
      plan.dashed ? 'dash' : 'move',
    ].join(':')
    if (routeCache.has(key)) return routeCache.get(key) ?? undefined
    const route = exactMonsterRouteForPlan(map, enemy, monster, plan)
    routeCache.set(key, route ?? null)
    return route
  }
  const legalActions = monster.actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => dnd5eMonsterActionAutomation(action) === 'headless')
    .filter(({ action }) =>
      action.usage?.kind !== 'recharge' ||
      enemy.dnd5eCombatState?.monsterRechargeReadyByActionId?.[action.id] !== false)
    .filter(({ action }) =>
      action.usage?.kind !== 'per-day' ||
      (enemy.dnd5eCombatState?.monsterActionUsesByActionId?.[action.id]?.current ?? action.usage.max) > 0)

  for (const reachable of normalPositions) {
    const moved = reachable.steps > 0 || desiredElevationFeet !== currentElevationFeet
    const at = {
      ...enemy,
      ...(moved ? reachable.position : {}),
      ...(shouldFly ? { elevationFeet: desiredElevationFeet } : {}),
    }
    const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, at, target)
    for (const { action, index } of legalActions) {
      const attackValue = actionExpectedValue({
        map, monster, action, attacker: at, target, characters, distanceFeet,
      })
      if (!attackValue) continue
      const opportunityRisk = moved ? opportunityAttackRisk(map, enemy, at) : 0
      const usesNimbleEscape = hasNimbleEscape && opportunityRisk > 0
      const plan = {
        ...attackPreview(
          action,
          monster,
          target,
          index,
          moved,
          moved ? reachable.position : undefined,
          shouldFly && moved ? desiredElevationFeet : undefined,
          moved ? movementProfile.mode : undefined,
        ),
        attackerTokenId: enemy.id,
        nimbleEscape: usesNimbleEscape ? 'disengage' as const : undefined,
      }
      const route = exactRoute(plan)
      if (!route) continue
      const coverBonus = defensiveCoverBonusAgainstTarget(map, at, target)
      const supportCount = targetSupportCount(map, at, target)
      const kind = !moved ? 'attack'
        : distanceFeet > startDistanceFeet ? 'retreat-attack'
          : 'move-attack'
      candidates.push({
        id: `${kind}:${target.id}:${index}:${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
        kind,
        payload: plan,
        metrics: {
          expectedDamage: attackValue.expectedDamage,
          targetCurrentHp: targetHp.current,
          targetMaximumHp: targetHp.maximum,
          targetArmorClass: targetAc,
          targetPriorityWeight,
          targetThreat,
          targetConcentrating: targetIsConcentrating,
          targetSupportCount: supportCount,
          hitProbability: attackValue.hitProbability,
          targetDistanceFeet: distanceFeet,
          preferredDistanceFeet: preferred,
          movementFeet: route.movementCostFeet,
          distanceImprovementFeet: tacticalDistanceImprovement(
            role, startDistanceFeet, distanceFeet, preferred,
          ),
          defensiveCoverBonus: coverBonus,
          opportunityAttackRisk: usesNimbleEscape ? 0 : opportunityRisk,
          attacksThisTurn: true,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape,
          usesPreciseCoverRoute: moved && coverBonus > 0,
        },
      })
    }
  }

  for (const reachable of normalPositions) {
    const moved = reachable.steps > 0 || desiredElevationFeet !== currentElevationFeet
    const at = {
      ...enemy,
      ...(moved ? reachable.position : {}),
      ...(shouldFly ? { elevationFeet: desiredElevationFeet } : {}),
    }
    const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, at, target)
    const opportunityRisk = moved ? opportunityAttackRisk(map, enemy, at) : 0
    const usesNimbleEscape = hasNimbleEscape && opportunityRisk > 0
    const plan: Dnd5eMonsterTurnPlan = {
      moved,
      dodged: true,
      nimbleEscape: usesNimbleEscape ? 'disengage' : undefined,
      newPosition: moved ? reachable.position : undefined,
      newElevationFeet: shouldFly && moved ? desiredElevationFeet : undefined,
      movementMode: moved ? movementProfile.mode : undefined,
      attacked: false,
      attackerTokenId: enemy.id,
      targetTokenId: target.id,
      message: `${enemy.label}${moved ? '移动后' : ''}采取闪避。`,
    }
    const route = exactRoute(plan)
    if (!route) continue
    const coverBonus = defensiveCoverBonusAgainstTarget(map, at, target)
    const supportCount = targetSupportCount(map, at, target)
    candidates.push({
      id: `${moved ? 'move-dodge' : 'dodge'}:${target.id}:${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
      kind: moved ? 'move-dodge' : 'dodge',
      payload: plan,
      metrics: {
        expectedDamage: 0,
        targetCurrentHp: targetHp.current,
        targetMaximumHp: targetHp.maximum,
        targetArmorClass: targetAc,
        targetPriorityWeight,
        targetThreat,
        targetConcentrating: targetIsConcentrating,
        targetSupportCount: supportCount,
        hitProbability: 0,
        targetDistanceFeet: distanceFeet,
        preferredDistanceFeet: preferred,
        movementFeet: route.movementCostFeet,
        distanceImprovementFeet: tacticalDistanceImprovement(
          role, startDistanceFeet, distanceFeet, preferred,
        ),
        defensiveCoverBonus: coverBonus,
        opportunityAttackRisk: usesNimbleEscape ? 0 : opportunityRisk,
        attacksThisTurn: false,
        consumesAction: true,
        dodges: true,
        dashes: false,
        usesNimbleEscape,
        usesPreciseCoverRoute: moved && coverBonus > 0,
      },
    })
  }

  for (const reachable of dashPositions) {
    if (reachable.steps === 0) continue
    const at = {
      ...enemy,
      ...reachable.position,
      ...(shouldFly ? { elevationFeet: desiredElevationFeet } : {}),
    }
    const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, at, target)
    const improvement = tacticalDistanceImprovement(role, startDistanceFeet, distanceFeet, preferred)
    if (improvement <= 0) continue
    const opportunityRisk = opportunityAttackRisk(map, enemy, at)
    const usesNimbleEscape = hasNimbleEscape && opportunityRisk > 0
    const plan: Dnd5eMonsterTurnPlan = {
      moved: true,
      dashed: true,
      nimbleEscape: usesNimbleEscape ? 'disengage' : undefined,
      newPosition: reachable.position,
      newElevationFeet: shouldFly ? desiredElevationFeet : undefined,
      movementMode: movementProfile.mode,
      attacked: false,
      attackerTokenId: enemy.id,
      targetTokenId: target.id,
      message: `${enemy.label}使用疾走接近 ${target.label}。`,
    }
    const route = exactRoute(plan)
    if (!route) continue
    const coverBonus = defensiveCoverBonusAgainstTarget(map, at, target)
    const supportCount = targetSupportCount(map, at, target)
    candidates.push({
      id: `dash:${target.id}:${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
      kind: 'dash',
      payload: plan,
      metrics: {
        expectedDamage: 0,
        targetCurrentHp: targetHp.current,
        targetMaximumHp: targetHp.maximum,
        targetArmorClass: targetAc,
        targetPriorityWeight,
        targetThreat,
        targetConcentrating: targetIsConcentrating,
        targetSupportCount: supportCount,
        hitProbability: 0,
        targetDistanceFeet: distanceFeet,
        preferredDistanceFeet: preferred,
        movementFeet: route.movementCostFeet,
        distanceImprovementFeet: improvement,
        defensiveCoverBonus: coverBonus,
        opportunityAttackRisk: usesNimbleEscape ? 0 : opportunityRisk,
        attacksThisTurn: false,
        consumesAction: true,
        dodges: false,
        dashes: true,
        usesNimbleEscape,
        usesPreciseCoverRoute: coverBonus > 0,
      },
    })
  }
  return candidates
}

/** 规划 SRD 怪物的 5e 回合；所有候选仍须由地图几何与 Headless 权威复核。 */
export function planDnd5eMonsterTurn(
  map: BattleMap,
  enemy: Token,
  characters: readonly Character[] = [],
  options: Dnd5eMonsterTurnPlannerOptions = {},
): Dnd5eMonsterTurnPlan {
  const monster = enemy.poolId ? getDnd5eSrdMonster(enemy.poolId) : undefined
  if (!monster) return { moved: false, attacked: false, message: `${enemy.label} 缺少 SRD 5.1 stat block。` }
  if (enemy.dnd5eCombatState?.turnedByClericId) {
    const source = map.tokens.find((token) => token.id === enemy.dnd5eCombatState?.turnedByClericId)
    if (!source) {
      return { moved: false, attacked: false, message: `${enemy.label} 处于被驱散状态，本回合不能攻击或进行反应。` }
    }
    const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
    const start = tokenAnchorCellFromPixel(enemy.x, enemy.y, enemy, map)
    const sourceCell = tokenAnchorCellFromPixel(source.x, source.y, source, map)
    const movementCells = Math.max(0, Math.floor(dnd5eMonsterMapSpeed(monster) * 2 / feetPerCell))
    const end = moveAway(start, sourceCell, map, map.tokens, enemy, movementCells)
    const moved = end.col !== start.col || end.row !== start.row
    const position = moved ? tokenCenterForAnchorCell(end, enemy, map) : undefined
    return {
      moved,
      dashed: moved,
      newPosition: position,
      attacked: false,
      attackerTokenId: enemy.id,
      message: moved
        ? `${enemy.label} 受驱散影响，使用疾走尽可能远离 ${source.label}。`
        : `${enemy.label} 无法继续远离 ${source.label}，本回合采取防御且不能进行反应。`,
    }
  }

  const preferredTarget = selectDnd5eMonsterPreferredTarget({ map, enemy, monster, characters })
  if (!preferredTarget) return { moved: false, attacked: false, message: `${enemy.label} 找不到可攻击目标。` }
  const targets = map.tokens.filter((target) =>
    target.id !== enemy.id &&
    target.type !== 'obstacle' &&
    areOpposedCombatTokens(enemy, target) &&
    targetHitPoints(target, characters).current > 0,
  )
  const role = monsterTacticalRole(monster)
  const behaviorStyle = dnd5eMonsterEffectiveBehaviorStyle(enemy, role)
  const hp = targetHitPoints(enemy, characters)
  const candidates = targets.flatMap((target) => createTacticalCandidates({
    map,
    enemy,
    monster,
    target,
    characters,
    canUseBonusAction: (options.turnEconomy?.bonusAction.current ?? 1) > 0,
    preferredTargetId: preferredTarget.id,
  }))
  const provider = options.decisionProvider ?? DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3
  const ranked = rankMonsterDecisionCandidates(provider, {
    monsterId: monster.id,
    actorTokenId: enemy.id,
    currentHp: hp.current,
    maxHp: hp.maximum,
    tacticalRole: role,
    behaviorStyle,
  }, candidates)
  const selected = ranked.find((entry) =>
    Number.isFinite(entry.score) && movementCandidateIsExecutable(map, enemy, monster, entry.candidate),
  )
  if (!selected) {
    return {
      moved: false,
      attacked: false,
      attackerTokenId: enemy.id,
      targetTokenId: preferredTarget.id,
      message: `${enemy.label} 没有可通过权威几何复核的战术方案。`,
    }
  }
  return {
    ...selected.candidate.payload,
    decision: {
      providerId: provider.id,
      candidateId: selected.candidate.id,
      candidateCount: candidates.length,
      score: selected.score,
      reasons: selected.reasons,
    },
  }
}
