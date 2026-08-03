import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import {
  cellKey,
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintCells,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import { isMovementLocked } from '../../lib/combatStatus'
import { areOpposedCombatTokens, dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, tokensInCells, type SkillAoeTargeting } from '../../lib/skillTargeting'
import {
  mapGeometryCanSeeToken,
  mapGeometryCoverBetween,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryLineOfEffectBlocked,
  mapGeometryLineOfSightBlocked,
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometrySegments,
  mapGeometrySegmentsIntersect,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import {
  createMapGeometryPathTree,
  findMapGeometryPath,
  type MapGeometryPathTree,
  type MapPathResult,
} from '../../lib/mapPathfinding'
import {
  dnd5eMonsterAreaSavingThrowVariants,
  dnd5eMonsterMapSpeed,
  dnd5eMonsterProficiencyBonus,
  dnd5eMonsterWeaponAttackAbility,
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterAreaSavingThrowVariant,
  type Dnd5eMonsterBehaviorStyle,
  type Dnd5eDamageType,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterWeaponAttack,
} from './monsters'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eAttacksPerAttackAction } from './classes'
import { dnd5eMonsterCoreSpellCompatibility } from './monsterAdvancedAbilities'
import { dnd5eAvailableMonsterSpellSlotLevels } from './monsterCoreSpellAction'
import {
  dnd5eCharmPersonEligibleCreatureType,
  dnd5eSpellDiceCount,
  getDnd5eSrdCombatSpell,
  type Dnd5eSrdSpellDefinition,
} from './spells'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import { dnd5eMonsterMultiattackChildResourcesAvailable } from './monsterMultiattackResources'
import {
  dnd5eMonsterCompositeChildResourceAvailable,
  prepareDnd5eMonsterCompositeRuntimePlan,
} from './monsterCompositeRuntime'
import { dnd5eMonsterMultiattackRuntimeActionIds } from './monsterDynamicMultiattack'
import { dnd5eAllocateMonsterMultiattackTargets } from './monsterMultiattackTargets'
import { dnd5eMonsterMultiattackConstraint } from './monsterMultiattackConstraints'
import {
  dnd5eInstantAoeAffectsTokenVertically,
  dnd5eMapTokenDistanceFeet,
  dnd5eTokenToPointDistanceFeet,
} from './verticalCombatGeometry'
import {
  dnd5eConditionIncapacitated,
  dnd5eConditionImposesAttackDisadvantage,
  dnd5eStandardConditionId,
  type Dnd5eStandardConditionId,
} from './conditions'
import {
  dnd5eMonsterAssassinateAutomaticCritical,
  dnd5eMonsterAttackTraitAdvantage,
  dnd5eMonsterBerserkRule,
  dnd5eMonsterEffectiveWeaponAttack,
  dnd5eMonsterLimitedMagicImmunityRule,
  dnd5eMonsterPackTacticsApplies,
  dnd5eMonsterTraitDamageDefinitions,
  dnd5eMonsterWeaponAttacksAreMagical,
  dnd5eMonsterWeaponAttackWithTriggeredTraits,
  dnd5eMonsterWeaponAttackAtDistance,
  dnd5eMonsterWeaponAttackAgainstConditions,
} from './monsterGenericAbilities'
import {
  resolveDnd5eDamageDefenses,
  type Dnd5eDamageSourceContext,
  type Dnd5eMoralAlignment,
} from './damageDefenses'
import {
  dnd5eMonsterEffectiveBehaviorStyle,
  selectDnd5eMonsterPreferredTarget,
} from './monsterAutomation'
import {
  DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  rankMonsterDecisionCandidates,
  type MonsterDecisionCandidate,
  type MonsterDecisionContext,
  type MonsterDecisionMetrics,
  type MonsterDecisionProvider,
} from './monsterDecisionProvider'
import {
  dnd5ePersistentAreaDifficultTerrainMultiplierAt,
  dnd5ePersistentAreaSpeedCostMultiplierAt,
} from './persistentAreaGeometry'
import {
  dnd5eActiveSizeRankDelta,
  dnd5eActiveActionOrBonusActionOnly,
  dnd5eActiveMaximumAttacksPerTurn,
  dnd5eActiveSpeedBonus,
  dnd5eActiveSpeedMultiplier,
  dnd5eActiveSpeedPenalty,
  dnd5eConditionsFromActiveEffects,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eAbilityCheckRollMode,
  dnd5eAbilityCheckSuccessProbability,
  dnd5eBestGrappleDefense,
  dnd5eCombatantPairKey,
  reconcileDnd5eSourceLinkedRelations,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  createCombatantFromDnd5eCharacter,
  migrateCharacterToDnd5e,
} from './character'
import { dnd5eOpposedAbilityCheckSuccessProbability } from './abilityCheckProbability'
import {
  dnd5eForcedMovementFall,
  dnd5eForcedPullDestination,
  dnd5eForcedPushDestination,
} from './spellAction'
import { dnd5eFallingDamageDice } from './traversal'

const monsterTraversalGeometryCache = new WeakMap<
  object,
  NonNullable<ReturnType<typeof mapGeometryRuntimeForMap>>
>()

function plannerTokenEffectiveSpeed(token: Token, baseSpeed: number): number {
  const effects = token.dnd5eCombatState?.activeEffects
  const adjusted = Math.max(
    0,
    Math.floor(baseSpeed) -
      dnd5eActiveSpeedPenalty(effects) -
      Math.max(0, token.dnd5eCombatState?.caltropsSpeedPenaltyFeet ?? 0) +
      dnd5eActiveSpeedBonus(effects),
  )
  return Math.max(0, Math.floor(adjusted * dnd5eActiveSpeedMultiplier(effects)))
}

function plannerTokenEffectiveFlySpeed(token: Token, baseSpeed: number): number {
  return Math.max(0, Math.floor(
    Math.max(0, baseSpeed) *
      dnd5eActiveSpeedMultiplier(token.dnd5eCombatState?.activeEffects),
  ))
}

function monsterTraversalGeometry(mapId: string) {
  const geometry = mapGeometryRuntimeForMap(mapId)
  if (!geometry) return undefined
  const hasOpenableClosedDoor = geometry.doors.some((door) =>
    mapGeometryDoorOpenState(door) === 'closed' &&
    mapGeometryDoorLockState(door) === 'unlocked')
  if (!hasOpenableClosedDoor) return geometry
  const cached = monsterTraversalGeometryCache.get(geometry)
  if (cached) return cached
  const transformed = {
    ...geometry,
    doors: geometry.doors.map((door) =>
      mapGeometryDoorOpenState(door) === 'closed' && mapGeometryDoorLockState(door) === 'unlocked'
        ? { ...door, state: 'open' as const, openState: 'open' as const }
      : door,
    ),
  }
  monsterTraversalGeometryCache.set(geometry, transformed)
  return transformed
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
  spellCast?: {
    spellId: string
    spellName: string
    slotLevel: number
    targetTokenIds: readonly string[]
    /** 自动命中法术逐枚投射物的目标；同一目标可重复。 */
    projectileTargetIds?: readonly string[]
    effect: Dnd5eSrdSpellDefinition['effect']
    diceCount: number
    diceSides: number
    castingTime: Dnd5eSrdSpellDefinition['castingTime']
    saveAbility?: Dnd5eSrdSpellDefinition['saveAbility']
    area?: Dnd5eSrdSpellDefinition['area']
    areaTargetCell?: GridCell
    areaTargetOrientation?: 0 | 1 | 2 | 3
    areaTargetElevationFeet?: number
    conditionChoice?: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease'
  }
  specialAction?:
    | {
        kind: 'healing-touch'
        actionId: string
        actionName: string
        targetTokenId: string
        healing: { diceCount: number; diceSides: number; bonus: number }
      }
    | {
        kind: 'teleport'
        actionId: string
        actionName: string
        destinationCell: GridCell
        destinationElevationFeet: number
      }
    | {
        kind: 'invisibility'
        actionId: string
        actionName: string
      }
  areaAction?: {
    actionId: string
    /** Stable child effect selected from an action-level shared resource pool. */
    variantId?: string
    actionName: string
    targetTokenIds: readonly string[]
    area: SkillAoeTargeting
    areaTargetCell: GridCell
    areaTargetOrientation?: 0 | 1 | 2 | 3
    areaTargetElevationFeet?: number
    saveAbility: AbilityKey
    saveDc: number
    damage?: {
      diceCount: number
      diceSides: number
      damageBonus: number
      damageType: Dnd5eDamageType
    }
    conditionOnFailedSave?: {
      condition: Dnd5eStandardConditionId
      durationRounds: number
    }
  }
  /** Fixed-DC escape generated from an authoritative active-effect relation. */
  escapeActiveEffect?: {
    effectId: string
    dc: number
  }
  /** Opposed Athletics/Acrobatics escape from a player-created basic grapple. */
  escapeGrapple?: {
    grapplerId: string
  }
  /**
   * A source may freely end one of its own grapple relations before resolving
   * the rest of this plan. This does not consume the action selected below.
   */
  releaseGrapple?: {
    targetId: string
    effectId: string
  }
  attackerTokenId?: string
  targetTokenId?: string
  /** One stable target id for each concrete monster action occurrence. */
  attackTargetTokenIds?: readonly string[]
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
    metrics?: Readonly<MonsterDecisionMetrics>
  }
}

export interface Dnd5eMonsterSimulationReachablePosition {
  cell: GridCell
  steps: number
  position: { x: number; y: number }
}

export interface Dnd5eMonsterSimulationRuntimeCache {
  reachablePositions: Map<string, readonly Dnd5eMonsterSimulationReachablePosition[]>
}

export interface Dnd5eMonsterTurnPlannerOptions {
  decisionProvider?: MonsterDecisionProvider
  turnEconomy?: Dnd5eTurnEconomyCounts
  /**
   * Restricts planning to one exact monster action. Used after a committed
   * Multiattack occurrence to plan only the next Headless-authorized strike.
   */
  requiredActionId?: string
  /**
   * Restricts the next strike to one target while continuing a Multiattack.
   * The Host may retry without this restriction when that target is no longer
   * reachable or legal.
   */
  requiredTargetId?: string
  /** Targets forbidden by an earlier Multiattack occurrence constraint. */
  excludedTargetIds?: readonly string[]
  /** Remaining movement in the current turn, after any earlier movement. */
  movementBudgetFeet?: number
  /** Current authoritative combat identity used by surprise-dependent traits. */
  combatId?: string
  round?: number
  simulationOptimization?: {
    /**
     * Simulation-only deterministic search bound. Live turns remain exhaustive,
     * while large Monte Carlo jobs sample representative reachable cells.
     */
    maxReachablePositions?: number
    /**
     * Score candidate routes from the already-authoritative reachability search.
     * The selected candidate is still checked with the full pathfinder.
     */
    approximateCandidateRoutes?: boolean
    /** Avoid a second double-speed flood fill when a normal attack is available. */
    skipDashWhenAttackAvailable?: boolean
    /**
     * Generated simulation candidates already passed the authoritative
     * step-by-step reachability search, so avoid re-running full pathfinding
     * for every ranked option.
     */
    skipFinalRouteValidation?: boolean
    /**
     * Test/rollback switch. The shared tree is exact and is the live default;
     * per-destination preserves the former repeated A* implementation.
     */
    candidateRouteSearch?: 'shared-tree' | 'per-destination'
    /** Test/diagnostic override; a truncated tree falls back to exact A*. */
    candidateRouteTreeMaximumVisited?: number
    /** Per-job cache keyed by dynamic token occupancy and movement profile. */
    reachabilityCache?: Dnd5eMonsterSimulationRuntimeCache
  }
}

type ReachableMonsterPosition = Dnd5eMonsterSimulationReachablePosition

interface MonsterMovementProfile {
  fromElevationFeet: number
  toElevationFeet: number
  canFly: boolean
  mode: 'walk' | 'fly'
}

function boundedReachablePositions(
  positions: readonly ReachableMonsterPosition[],
  targetCell: GridCell,
  preferredDistanceCells: number,
  limit: number | undefined,
): ReachableMonsterPosition[] {
  if (limit == null || limit <= 0 || positions.length <= limit) return [...positions]
  const key = (position: ReachableMonsterPosition) => `${position.cell.col},${position.cell.row}`
  const distanceSquared = (position: ReachableMonsterPosition) =>
    (position.cell.col - targetCell.col) ** 2 + (position.cell.row - targetCell.row) ** 2
  const stableCellOrder = (a: ReachableMonsterPosition, b: ReachableMonsterPosition) =>
    a.cell.row - b.cell.row || a.cell.col - b.cell.col
  const preferredDistanceSquared = preferredDistanceCells ** 2
  const strategies = [
    [...positions].sort((a, b) => a.steps - b.steps || stableCellOrder(a, b)),
    [...positions].sort((a, b) => distanceSquared(a) - distanceSquared(b) || stableCellOrder(a, b)),
    [...positions].sort((a, b) =>
      Math.abs(distanceSquared(a) - preferredDistanceSquared) -
        Math.abs(distanceSquared(b) - preferredDistanceSquared) ||
      stableCellOrder(a, b)),
    [...positions].sort((a, b) => distanceSquared(b) - distanceSquared(a) || stableCellOrder(a, b)),
  ]
  const selected = new Map<string, ReachableMonsterPosition>()
  for (let index = 0; selected.size < limit && index < positions.length; index += 1) {
    for (const strategy of strategies) {
      const position = strategy[index]
      if (position) selected.set(key(position), position)
      if (selected.size >= limit) break
    }
  }
  return [...selected.values()]
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

function monsterReachabilityCacheKey(
  start: GridCell,
  map: BattleMap,
  tokens: readonly Token[],
  enemy: Token,
  maxSteps: number,
  movement: MonsterMovementProfile,
): string {
  const occupancy = tokens
    .filter((token) => token.type !== 'obstacle')
    .map((token) => `${token.id}:${Math.round(token.x)}:${Math.round(token.y)}:${token.size}:${token.elevationFeet ?? 0}`)
    .sort()
    .join('|')
  return [
    enemy.id,
    start.col,
    start.row,
    maxSteps,
    movement.fromElevationFeet,
    movement.toElevationFeet,
    movement.mode,
    enemy.size,
    map.width,
    map.height,
    map.gridSize,
    occupancy,
  ].join(';')
}

function cachedReachableMonsterPositions(input: {
  start: GridCell
  map: BattleMap
  tokens: readonly Token[]
  enemy: Token
  maxSteps: number
  movement: MonsterMovementProfile
  cache?: Dnd5eMonsterSimulationRuntimeCache
}): ReachableMonsterPosition[] {
  const key = monsterReachabilityCacheKey(
    input.start,
    input.map,
    input.tokens,
    input.enemy,
    input.maxSteps,
    input.movement,
  )
  const cached = input.cache?.reachablePositions.get(key)
  if (cached) return [...cached]
  const positions = reachableMonsterPositions(
    input.start,
    input.map,
    input.tokens,
    input.enemy,
    input.maxSteps,
    input.movement,
  )
  if (input.cache) {
    const maximumEntries = 1_024
    if (input.cache.reachablePositions.size >= maximumEntries) {
      const oldest = input.cache.reachablePositions.keys().next().value
      if (oldest) input.cache.reachablePositions.delete(oldest)
    }
    input.cache.reachablePositions.set(key, positions)
  }
  return positions
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

function actionSequence(
  monster: Dnd5eMonsterStatBlock,
  action: Dnd5eMonsterAction,
  actor?: Token,
): readonly Dnd5eMonsterAction[] {
  if (action.kind !== 'multiattack') return [action]
  const actionIds = dnd5eMonsterMultiattackRuntimeActionIds({
    monster,
    action,
    actor: actor
      ? {
          statBlockId: monster.id,
          classState: actor.dnd5eCombatState ?? {},
        }
      : undefined,
    unresolvedRandomRepeat: 'maximum',
  }) ?? []
  return actionIds.flatMap((actionId) => {
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
  return dnd5eMapTokenDistanceFeet({ map, geometry, left, right })
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

function targetConditions(
  target: Token,
  characters: readonly Character[],
  reconciledActiveEffects?: PlannerReconciledActiveEffects,
): readonly string[] {
  if (reconciledActiveEffects?.has(target.id)) {
    return reconciledActiveEffects.get(target.id)?.conditions ?? []
  }
  const character = target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
  return [...new Set([
    ...(character?.conditions ?? []),
    ...(target.dnd5eCombatState?.conditions ?? []),
    ...(character?.dnd5eCombatState?.activeEffects?.flatMap((effect) =>
      effect.standardCondition ? [effect.standardCondition] : []) ?? []),
    ...(target.dnd5eCombatState?.activeEffects?.flatMap((effect) =>
      effect.standardCondition ? [effect.standardCondition] : []) ?? []),
  ])]
}

function tokenActiveEffects(
  target: Token,
  characters: readonly Character[],
) {
  const character = target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
  const byId = new Map([
    ...(character?.dnd5eCombatState?.activeEffects ?? []),
    ...(target.dnd5eCombatState?.activeEffects ?? []),
  ].map((effect) => [effect.id, effect]))
  return [...byId.values()]
}

type PlannerReconciledActiveEffects = ReadonlyMap<string, {
  activeEffects: readonly Dnd5eActiveEffectInstance[]
  conditions: readonly string[]
}>

function plannerReconciledActiveEffects(
  map: BattleMap,
  characters: readonly Character[],
): PlannerReconciledActiveEffects | undefined {
  const hasSourceLinkedRelation = map.tokens.some((target) =>
    tokenActiveEffects(target, characters).some((effect) =>
      effect.standardCondition === 'grappled' &&
      (
        effect.relation?.kind === 'grapple' ||
        effect.source.rulesId === 'basic-action:grapple'
      )))
  if (!hasSourceLinkedRelation) return undefined

  const combatTokens = map.tokens.filter((token) =>
    token.type === 'player' || token.type === 'enemy')
  const state = startDnd5eHeadlessCombat(
    `monster-planner:${map.id}`,
    combatTokens.map((token) => plannerTokenCombatant(token, characters)),
  )
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  state.gridDistance = {
    cellUnits: Math.max(1, map.gridSize),
    feetPerCell,
    offsetX: map.gridOffsetX,
    offsetY: map.gridOffsetY,
    footprintCellsByCombatantId: Object.fromEntries(
      combatTokens.map((token) => [token.id, tokenFootprintCells(token)]),
    ),
  }
  state.distanceFeetByCombatantPair = {}
  const geometry = mapGeometryRuntimeForMap(map.id)
  for (let left = 0; left < combatTokens.length; left += 1) {
    for (let right = left + 1; right < combatTokens.length; right += 1) {
      state.distanceFeetByCombatantPair[
        dnd5eCombatantPairKey(combatTokens[left].id, combatTokens[right].id)
      ] = tokenThreeDimensionalDistanceFeet(
        map,
        geometry,
        combatTokens[left],
        combatTokens[right],
      )
    }
  }
  reconcileDnd5eSourceLinkedRelations(state)
  return new Map(combatTokens.map((token) => {
    const combatant = state.combatants[token.id]
    const activeEffects = combatant?.classState.activeEffects ?? []
    const rawEffects = tokenActiveEffects(token, characters)
    const relationEffectIds = new Set(rawEffects.flatMap((effect) =>
      effect.standardCondition === 'grappled' &&
      effect.dependsOnEffectId == null &&
      (
        effect.relation?.kind === 'grapple' ||
        effect.source.rulesId === 'basic-action:grapple'
      )
        ? [effect.id]
        : []))
    let addedDependent = true
    while (addedDependent) {
      addedDependent = false
      for (const effect of rawEffects) {
        if (
          effect.dependsOnEffectId &&
          relationEffectIds.has(effect.dependsOnEffectId) &&
          !relationEffectIds.has(effect.id)
        ) {
          relationEffectIds.add(effect.id)
          addedDependent = true
        }
      }
    }
    const relationConditions = new Set(rawEffects.flatMap((effect) =>
      relationEffectIds.has(effect.id) && effect.standardCondition
        ? [effect.standardCondition]
        : []))
    const preservedConditions = targetConditions(token, characters).filter((condition) => {
      const standard = dnd5eStandardConditionId(condition)
      return standard == null || !relationConditions.has(standard)
    })
    return [token.id, {
      activeEffects,
      conditions: [...new Set([
        ...preservedConditions,
        ...dnd5eConditionsFromActiveEffects(activeEffects),
      ])],
    }] as const
  }))
}

function sourceLinkedGrappleRootEffects(
  target: Token,
  characters: readonly Character[],
  reconciledActiveEffects?: PlannerReconciledActiveEffects,
): Dnd5eActiveEffectInstance[] {
  const effects = reconciledActiveEffects?.has(target.id)
    ? reconciledActiveEffects.get(target.id)?.activeEffects ?? []
    : tokenActiveEffects(target, characters)
  return effects.filter((effect) =>
    effect.standardCondition === 'grappled' &&
    effect.dependsOnEffectId == null &&
    effect.relation?.kind === 'grapple' &&
    effect.source.actorId === effect.relation.sourceActorId)
}

function sourceLinkedRelationTargets(input: {
  map: BattleMap
  characters: readonly Character[]
  sourceActorId: string
  slotGroup?: string
  reconciledActiveEffects?: PlannerReconciledActiveEffects
}): Token[] {
  return input.map.tokens.filter((target) =>
    sourceLinkedGrappleRootEffects(
      target,
      input.characters,
      input.reconciledActiveEffects,
    ).some((effect) =>
      effect.relation!.sourceActorId === input.sourceActorId &&
      (input.slotGroup == null || effect.relation!.slotGroup === input.slotGroup) &&
      effect.source.actorId === input.sourceActorId))
}

function plannerActiveEffectsAfterRelease(
  reconciledActiveEffects: PlannerReconciledActiveEffects,
  targetId: string,
  rootEffectId: string,
): PlannerReconciledActiveEffects {
  const current = reconciledActiveEffects.get(targetId)
  if (!current?.activeEffects.some((effect) => effect.id === rootEffectId)) {
    return reconciledActiveEffects
  }
  const removedIds = new Set([rootEffectId])
  let discoveredDependent = true
  while (discoveredDependent) {
    discoveredDependent = false
    for (const effect of current.activeEffects) {
      if (
        effect.dependsOnEffectId &&
        removedIds.has(effect.dependsOnEffectId) &&
        !removedIds.has(effect.id)
      ) {
        removedIds.add(effect.id)
        discoveredDependent = true
      }
    }
  }
  const removedStandardConditions = new Set(current.activeEffects.flatMap((effect) =>
    removedIds.has(effect.id) && effect.standardCondition
      ? [effect.standardCondition]
      : []))
  const activeEffects = current.activeEffects.filter((effect) => !removedIds.has(effect.id))
  const remainingStandardConditions = new Set(activeEffects.flatMap((effect) =>
    effect.standardCondition ? [effect.standardCondition] : []))
  const conditions = current.conditions.filter((condition) => {
    const standard = dnd5eStandardConditionId(condition)
    return standard == null ||
      !removedStandardConditions.has(standard) ||
      remainingStandardConditions.has(standard)
  })
  const next = new Map(reconciledActiveEffects)
  next.set(targetId, {
    activeEffects,
    conditions: [...new Set([
      ...conditions,
      ...dnd5eConditionsFromActiveEffects(activeEffects),
    ])],
  })
  return next
}

function plannerTokenSizeRank(
  target: Token,
  characters: readonly Character[],
): number {
  const monster = target.poolId ? getDnd5eSrdMonster(target.poolId) : undefined
  const size = target.creatureSize ?? monster?.size ?? '中型'
  return Math.max(
    0,
    ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[size] +
      dnd5eActiveSizeRankDelta(tokenActiveEffects(target, characters)),
  )
}

function plannerMonsterSkillRanks(
  monster: Dnd5eMonsterStatBlock,
  proficiencyBonus: number,
): Array<{ skill: string; rank: 1 | 2 }> {
  return monster.skills?.flatMap((skill) => {
    const ability = skill.key === 'athletics'
      ? 'str'
      : skill.key === 'acrobatics' ? 'dex' : undefined
    if (!ability) return []
    const proficiencyContribution =
      skill.bonus - rules.abilityModifier(monster.abilities[ability])
    const rank = proficiencyContribution >= proficiencyBonus * 1.5
      ? 2
      : proficiencyContribution >= proficiencyBonus * 0.5 ? 1 : 0
    return rank === 1 || rank === 2
      ? [{ skill: skill.key, rank }]
      : []
  }) ?? []
}

function plannerTokenCombatant(
  target: Token,
  characters: readonly Character[],
  monsterOverride?: Dnd5eMonsterStatBlock,
): Dnd5eCombatant {
  const effects = tokenActiveEffects(target, characters)
  const hp = targetHitPoints(target, characters)
  const character = target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
  const tokenSizeRank = (
    { 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const
  )[target.creatureSize ?? '中型']
  if (character) {
    const combatant = createCombatantFromDnd5eCharacter({
      character: migrateCharacterToDnd5e(character),
      controller: dnd5eCombatTokenSide(target) === 'player' ? 'player' : 'dm',
      initiativeD20: 10,
      position: { x: target.x, y: target.y },
    })
    return {
      ...combatant,
      id: target.id,
      name: target.label,
      sizeRank: tokenSizeRank,
      currentHp: hp.current,
      maxHp: hp.maximum,
      classState: {
        ...combatant.classState,
        activeEffects: effects.length > 0 ? effects : undefined,
      },
      conditions: targetConditions(target, characters),
    }
  }
  const monster = monsterOverride ??
    (target.poolId ? getDnd5eSrdMonster(target.poolId) : undefined)
  const proficiencyBonus = monster
    ? dnd5eMonsterProficiencyBonus(monster.challenge.rating)
    : 2
  const skillRanks = monster
    ? plannerMonsterSkillRanks(monster, proficiencyBonus)
    : []
  const combatant = createDnd5eCombatant({
    id: target.id,
    name: target.label,
    controller: dnd5eCombatTokenSide(target) === 'player' ? 'player' : 'dm',
    initiative: 10,
    abilities: monster
      ? { ...monster.abilities }
      : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus,
    skillProficiencies: skillRanks.map((entry) => entry.skill),
    classSelections: {
      expertise: skillRanks
        .filter((entry) => entry.rank === 2)
        .map((entry) => entry.skill),
    },
    armorClass: monster?.armorClass.value ?? targetArmorClass(target, characters),
    sizeRank: target.creatureSize
      ? tokenSizeRank
      : monster
        ? ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[monster.size]
        : tokenSizeRank,
    currentHp: hp.current,
    maxHp: hp.maximum,
    temporaryHp: 0,
    speed: monster ? dnd5eMonsterMapSpeed(monster) : 30,
    position: { x: target.x, y: target.y },
    concentrating: false,
    statBlockId: monster?.id,
    classState: { activeEffects: effects.length > 0 ? effects : undefined },
    conditions: dnd5eConditionsFromActiveEffects(effects),
  })
  return {
    ...combatant,
    conditions: targetConditions(target, characters),
  }
}

function combatantSkillRank(
  combatant: Dnd5eCombatant,
  skill: string,
): 0 | 1 | 2 {
  if (combatant.classSelections.expertise?.includes(skill)) return 2
  if (
    combatant.skillProficiencies.includes(skill) ||
    combatant.classSelections['lore-bonus-skills']?.includes(skill)
  ) {
    return 1
  }
  return 0
}

function monsterGrappleEscapeSuccessProbability(input: {
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  source: Token
  characters: readonly Character[]
}): number {
  const actor = plannerTokenCombatant(
    input.enemy,
    input.characters,
    input.monster,
  )
  const grappler = plannerTokenCombatant(input.source, input.characters)
  const actorDefense = dnd5eBestGrappleDefense(actor)
  return dnd5eOpposedAbilityCheckSuccessProbability({
    actorModifier: actorDefense.modifier,
    actorMode: dnd5eAbilityCheckRollMode(actor, {
      ability: actorDefense.skill === 'athletics' ? 'str' : 'dex',
      skill: actorDefense.skill,
    }),
    targetModifier: rules.abilityModifier(grappler.abilities.str) +
      grappler.proficiencyBonus * combatantSkillRank(grappler, 'athletics'),
    targetMode: dnd5eAbilityCheckRollMode(grappler, {
      ability: 'str',
      skill: 'athletics',
    }),
  })
}

function monsterEscapeSuccessProbability(input: {
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  effects: readonly Dnd5eActiveEffectInstance[]
  effect: Dnd5eActiveEffectInstance
}): number {
  const check = input.effect.escapeCheck
  if (!check) return 0
  const combatant = createDnd5eCombatant({
    id: input.enemy.id,
    name: input.enemy.label,
    controller: 'dm',
    initiative: 10,
    abilities: { ...input.monster.abilities },
    proficiencyBonus: dnd5eMonsterProficiencyBonus(
      input.monster.challenge.rating,
    ),
    armorClass: input.monster.armorClass.value,
    currentHp: Math.max(0, input.enemy.hp ?? input.monster.hitPoints.average),
    maxHp: Math.max(1, input.enemy.maxHp ?? input.monster.hitPoints.average),
    temporaryHp: 0,
    speed: dnd5eMonsterMapSpeed(input.monster),
    position: { x: input.enemy.x, y: input.enemy.y },
    concentrating: false,
    classState: { activeEffects: [...input.effects] },
    conditions: dnd5eConditionsFromActiveEffects(input.effects),
  })
  const options = [
    { ability: check.ability, skill: check.skill },
    ...(check.alternativeAbility
      ? [{ ability: check.alternativeAbility, skill: check.alternativeSkill }]
      : []),
  ].map((option) => {
    const modifier = option.skill
      ? input.monster.skills?.find((skill) => skill.key === option.skill)?.bonus ??
        rules.abilityModifier(input.monster.abilities[option.ability])
      : rules.abilityModifier(input.monster.abilities[option.ability])
    const mode = dnd5eAbilityCheckRollMode(combatant, option)
    return { ...option, modifier, mode }
  })
  return Math.max(...options.map((option) =>
    dnd5eAbilityCheckSuccessProbability(option.modifier, check.dc, option.mode)))
}

function createMonsterEscapeCandidates(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  characters: readonly Character[]
  canUseAction: boolean
  reconciledActiveEffects?: PlannerReconciledActiveEffects
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  if (!input.canUseAction) return []
  const effects = tokenActiveEffects(input.enemy, input.characters)
  const hp = targetHitPoints(input.enemy, input.characters)
  return sourceLinkedGrappleRootEffects(
    input.enemy,
    input.characters,
    input.reconciledActiveEffects,
  )
    .filter((effect) =>
      (
        effect.escapeCheck?.economy === 'action' ||
        (
          effect.source.rulesId === 'basic-action:grapple' &&
          effect.relation?.sourceActionId === 'basic-action:grapple'
        )
      ) &&
      input.map.tokens.some((candidate) =>
        candidate.id === effect.source.actorId &&
        targetHitPoints(candidate, input.characters).current > 0))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((effect) => {
      const source = input.map.tokens.find((candidate) => candidate.id === effect.source.actorId)!
      const fixedDc = effect.escapeCheck?.economy === 'action'
      const successProbability = fixedDc
        ? monsterEscapeSuccessProbability({
            enemy: input.enemy,
            monster: input.monster,
            effects,
            effect,
          })
        : monsterGrappleEscapeSuccessProbability({
            enemy: input.enemy,
            monster: input.monster,
            source,
            characters: input.characters,
          })
      const restrained = effects.some((candidate) =>
        candidate.standardCondition === 'restrained' &&
        candidate.dependsOnEffectId === effect.id)
      const escapeControlValue = restrained
        ? fixedDc ? 120 : 180
        : 45
      return {
        id: fixedDc
          ? `escape-active-effect:${effect.id}`
          : `escape-grapple:${effect.id}:${source.id}`,
        kind: 'control' as const,
        payload: {
          moved: false,
          attacked: false,
          attackerTokenId: input.enemy.id,
          targetTokenId: source.id,
          ...(fixedDc
            ? {
                escapeActiveEffect: {
                  effectId: effect.id,
                  dc: effect.escapeCheck!.dc,
                },
              }
            : { escapeGrapple: { grapplerId: source.id } }),
          message: `${input.enemy.label} 尝试挣脱 ${source.label} 的擒抱。`,
        },
        metrics: {
          expectedDamage: 0,
          targetCurrentHp: hp.current,
          targetMaximumHp: hp.maximum,
          hitProbability: successProbability,
          controlValue: successProbability * escapeControlValue,
          targetDistanceFeet: 0,
          preferredDistanceFeet: 0,
          movementFeet: 0,
          distanceImprovementFeet: 0,
          defensiveCoverBonus: 0,
          opportunityAttackRisk: 0,
          attacksThisTurn: false,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape: false,
          usesPreciseCoverRoute: false,
        },
      }
    })
}

function targetIsDodging(target: Token, characters: readonly Character[]): boolean {
  const character = target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
  return character?.dnd5eCombatState?.dodgingTurnKey != null
}

function targetSavingThrowModifier(
  target: Token,
  characters: readonly Character[],
  ability: NonNullable<Dnd5eSrdSpellDefinition['saveAbility']>,
): number {
  const character = target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
  if (character) {
    return rules.abilityModifier(character.abilities[ability]) +
      (character.savingThrows.includes(ability) ? rules.proficiencyBonus(character.level) : 0)
  }
  const monster = target.poolId ? getDnd5eSrdMonster(target.poolId) : undefined
  return monster?.savingThrows?.[ability] ?? rules.abilityModifier(monster?.abilities[ability] ?? 10)
}

type PlannerDamageSourceDetails = Omit<Dnd5eDamageSourceContext, 'damageType'>

function plannerMoralAlignment(alignment: unknown): Dnd5eMoralAlignment | undefined {
  if (typeof alignment !== 'string') return undefined
  const normalized = alignment.trim().toLowerCase()
  if (
    !normalized ||
    /(?:任意|无阵营|any alignment|unaligned|non-|非善良|非邪恶|非中立)/.test(normalized)
  ) return undefined
  if (normalized.includes('善良') || /\bgood\b/.test(normalized)) return 'good'
  if (normalized.includes('邪恶') || /\bevil\b/.test(normalized)) return 'evil'
  if (normalized.includes('中立') || /\bneutral\b/.test(normalized)) return 'neutral'
  const abbreviation = normalized.replace(/[\s_-]+/g, '').toUpperCase()
  if (['LG', 'NG', 'CG'].includes(abbreviation)) return 'good'
  if (['LE', 'NE', 'CE'].includes(abbreviation)) return 'evil'
  return ['LN', 'N', 'TN', 'CN'].includes(abbreviation) ? 'neutral' : undefined
}

function plannerTargetMonster(target: Token): Dnd5eMonsterStatBlock | undefined {
  return target.poolId ? getDnd5eSrdMonster(target.poolId) : undefined
}

function plannerSleepTargetIsEligible(
  target: Token,
  characters: readonly Character[],
): boolean {
  if (targetHitPoints(target, characters).current <= 0) return false
  if (targetConditions(target, characters).some((condition) =>
    dnd5eStandardConditionId(condition) === 'unconscious')) return false
  const monster = plannerTargetMonster(target)
  const creatureType = (monster?.creatureType ?? '').trim().toLowerCase()
  if (creatureType === 'undead' || creatureType.includes('亡灵')) return false
  const character = plannerTargetCharacter(target, characters)
  const conditionImmunities = [
    ...(monster?.conditionImmunities ?? []),
    ...(character ? migrateCharacterToDnd5e(character).conditionImmunities : []),
  ]
  if (conditionImmunities.some((condition) =>
    dnd5eStandardConditionId(condition) === 'charmed' ||
    ['magical-sleep', '魔法睡眠'].includes(condition.trim().toLowerCase()))) return false
  return !monster?.traits.some((trait) => {
    const name = trait.name.trim().toLowerCase()
    const description = trait.description.trim().toLowerCase()
    return name === 'fey ancestry' || name === '妖精血统' || name === '精灵血统' ||
      description.includes("magic can't put") || description.includes('magic cannot put') ||
      description.includes('魔法无法使其入睡') || description.includes('魔法不能使其入睡')
  })
}

function resolvePlannerDamage(
  target: Token,
  rawDamage: number,
  type: Dnd5eDamageType,
  source: PlannerDamageSourceDetails,
): number {
  const monster = plannerTargetMonster(target)
  if (!monster) return Math.max(0, rawDamage)
  return resolveDnd5eDamageDefenses({
    damage: Math.max(0, rawDamage),
    source: { damageType: type, ...source },
    defenses: {
      immunities: monster.damageImmunities,
      resistances: monster.damageResistances,
      vulnerabilities: monster.damageVulnerabilities,
      damageDefenseRules: monster.damageDefenseRules,
    },
  }).finalDamage
}

function offensiveMonsterSpellExpectedValue(input: {
  map: BattleMap
  attacker: Token
  target: Token
  monster: Dnd5eMonsterStatBlock
  spell: Dnd5eSrdSpellDefinition
  slotLevel: number
  characters: readonly Character[]
}): { expectedDamage: number; hitProbability: number; controlValue?: number } | undefined {
  const { map, attacker, target, monster, spell, slotLevel, characters } = input
  if (
    ![
      'spell-attack',
      'saving-throw',
      'automatic-damage',
      'dispel-magic',
      'power-word-kill',
      'power-word-stun',
    ].includes(spell.effect) ||
    !['hostile', 'creature'].includes(spell.target)
  ) return undefined
  if (spell.id === 'charm-person' || spell.id === 'hold-person') {
    const targetIsCharacter = target.characterId != null &&
      characters.some((character) => character.id === target.characterId)
    const targetMonster = target.poolId ? getDnd5eSrdMonster(target.poolId) : undefined
    if (!targetIsCharacter && !dnd5eCharmPersonEligibleCreatureType(targetMonster?.creatureType)) {
      return undefined
    }
    const condition = spell.id === 'hold-person' ? 'paralyzed' : 'charmed'
    if (targetMonster?.conditionImmunities?.some((entry) =>
      dnd5eStandardConditionId(entry) === condition
    ) || target.dnd5eCombatState?.activeEffects?.some((effect) =>
      effect.standardCondition === condition
    )) return undefined
  }
  if (
    spell.id === 'banishment' &&
    (target.dnd5eCombatState?.activeEffects?.some((effect) =>
      effect.definitionId.includes('banishment')) ||
      targetConditions(target, characters).some((condition) =>
        ['banished', '放逐'].includes(condition.trim().toLowerCase())))
  ) return undefined
  const geometry = mapGeometryRuntimeForMap(map.id)
  const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, attacker, target)
  if (distanceFeet > spell.rangeFeet) return undefined
  const cover = mapGeometryCoverBetween(geometry, attacker, target, map)
  if (cover.blocksLineOfEffect || cover.cover === 'total') return undefined
  if (mapGeometryLineOfSightBlocked({
    geometry,
    from: attacker,
    to: target,
    fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
    toElevationFeet: mapGeometryTokenElevation(geometry, target),
  })) return undefined
  const targetHp = targetHitPoints(target, characters)
  const limitedMagicImmunity = dnd5eMonsterLimitedMagicImmunityRule(
    plannerTargetMonster(target),
  )
  if (limitedMagicImmunity && slotLevel <= limitedMagicImmunity.maximumSpellLevel) {
    return { expectedDamage: 0, hitProbability: 0 }
  }
  if (spell.effect === 'dispel-magic') {
    const spellEffectCount = (target.dnd5eCombatState?.activeEffects ?? []).filter((effect) =>
      effect.source.kind === 'spell'
    ).length + Object.keys(
      target.dnd5eCombatState?.concentrationEffectsBySource ?? {},
    ).length
    if (spellEffectCount < 1) return undefined
    return {
      expectedDamage: 0,
      hitProbability: 1,
      controlValue: Math.min(42, 14 * spellEffectCount),
    }
  }
  if (spell.effect === 'power-word-kill') {
    if (targetHp.current > 100) return undefined
    return { expectedDamage: targetHp.current, hitProbability: 1, controlValue: 30 }
  }
  if (spell.effect === 'power-word-stun') {
    if (targetHp.current > (spell.hitPointThreshold ?? 150)) return undefined
    return { expectedDamage: 0, hitProbability: 1, controlValue: 28 }
  }
  const diceCount = dnd5eSpellDiceCount(
    spell,
    Math.max(1, monster.spellcasting?.casterLevel ?? 1),
    slotLevel,
  )
  const spellDamageSource: PlannerDamageSourceDetails = {
    delivery: 'spell',
    magical: true,
    sourceMoralAlignment: plannerMoralAlignment(monster.alignment),
    spellLevel: slotLevel,
  }
  const averageDamage = resolvePlannerDamage(
    target,
    diceCount * (spell.dice.sides + 1) / 2 +
      spell.dice.bonus +
      (spell.bonusPerDie ? diceCount : 0),
    spell.damageType ?? 'force',
    spellDamageSource,
  )
  if (spell.effect === 'automatic-damage') {
    return {
      expectedDamage: averageDamage,
      hitProbability: 1,
    }
  }
  if (spell.effect === 'spell-attack') {
    const ac = targetArmorClass(target, characters) + cover.armorClassBonus
    const baseProbability = Math.max(
      0.05,
      Math.min(0.95, (21 + (monster.spellcasting?.attackBonus ?? 0) - ac) / 20),
    )
    const threatened = map.tokens.some((candidate) =>
      candidate.id !== attacker.id &&
      candidate.type !== 'obstacle' &&
      areOpposedCombatTokens(attacker, candidate) &&
      tokenThreeDimensionalDistanceFeet(map, geometry, attacker, candidate) <= 5,
    )
    const probability = threatened ? baseProbability ** 2 : baseProbability
    return { expectedDamage: averageDamage * probability, hitProbability: probability }
  }
  if (!spell.saveAbility || monster.spellcasting?.saveDc == null) return undefined
  const modifier = targetSavingThrowModifier(target, characters, spell.saveAbility)
  const successProbability = Math.max(
    0.05,
    Math.min(0.95, (21 + modifier - monster.spellcasting.saveDc) / 20),
  )
  if (spell.id === 'charm-person') {
    const combatAdvantageSuccessProbability = 1 - (1 - successProbability) ** 2
    const failureProbability = 1 - combatAdvantageSuccessProbability
    return {
      expectedDamage: 0,
      hitProbability: failureProbability,
      controlValue: 24 * failureProbability,
    }
  }
  if (spell.id === 'hold-person' || spell.id === 'banishment') {
    const failureProbability = 1 - successProbability
    return {
      expectedDamage: 0,
      hitProbability: failureProbability,
      controlValue: (spell.id === 'banishment' ? 36 : 32) * failureProbability,
    }
  }
  const damageFactor = 1 - successProbability +
    (spell.damageOnSuccessfulSave === 'half' ? successProbability / 2 : 0)
  return {
    expectedDamage: averageDamage * damageFactor,
    hitProbability: 1 - successProbability,
  }
}

function attackPreview(
  action: Dnd5eMonsterAction,
  monster: Dnd5eMonsterStatBlock,
  resolvedAttack: Dnd5eMonsterWeaponAttack,
  target: Token,
  index: number,
  moved: boolean,
  position?: { x: number; y: number },
  elevationFeet?: number,
  movementMode?: 'walk' | 'fly',
): Dnd5eMonsterTurnPlan {
  const damage = resolvedAttack.damage[0]
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
    || (monster.spellcasting?.spells ?? []).some((listedSpell) => {
      const spell = getDnd5eSrdCombatSpell(listedSpell.id)
      return !!spell &&
        dnd5eMonsterCoreSpellCompatibility(spell).automation === 'full' &&
        ['spell-attack', 'saving-throw', 'automatic-damage', 'power-word-kill', 'power-word-stun'].includes(spell.effect) &&
        spell.rangeFeet >= 20
    })
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
    .concat((monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
      const spell = getDnd5eSrdCombatSpell(listedSpell.id)
      return spell &&
        dnd5eMonsterCoreSpellCompatibility(spell).automation === 'full' &&
        ['spell-attack', 'saving-throw', 'automatic-damage', 'power-word-kill', 'power-word-stun'].includes(spell.effect)
        ? [spell.rangeFeet]
        : []
    }))
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

function monsterPackTacticsAdvantage(input: {
  map: BattleMap
  monster: Dnd5eMonsterStatBlock
  attacker: Token
  target: Token
  characters: readonly Character[]
  reconciledActiveEffects?: PlannerReconciledActiveEffects
}): boolean {
  const { map, monster, attacker, target, characters } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const actorSide = dnd5eCombatTokenSide(attacker)
  return dnd5eMonsterPackTacticsApplies({
    monster,
    actorId: attacker.id,
    targetId: target.id,
    candidates: map.tokens.flatMap((candidate) => {
      if (candidate.type === 'obstacle') return []
      return [{
        id: candidate.id,
        alliedWithActor: actorSide != null && dnd5eCombatTokenSide(candidate) === actorSide,
        currentHp: candidate.hp ?? 1,
        incapacitated: dnd5eConditionIncapacitated({
          conditions: targetConditions(
            candidate,
            characters,
            input.reconciledActiveEffects,
          ),
        }),
        distanceFeetToTarget: tokenThreeDimensionalDistanceFeet(map, geometry, candidate, target),
      }]
    }),
  })
}

function monsterAdjacentActiveAlly(input: {
  map: BattleMap
  attacker: Token
  target: Token
  characters: readonly Character[]
  reconciledActiveEffects?: PlannerReconciledActiveEffects
}): boolean {
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const actorSide = dnd5eCombatTokenSide(input.attacker)
  return input.map.tokens.some((candidate) =>
    candidate.id !== input.attacker.id &&
    candidate.id !== input.target.id &&
    candidate.type !== 'obstacle' &&
    actorSide != null &&
    dnd5eCombatTokenSide(candidate) === actorSide &&
    (candidate.hp ?? 1) > 0 &&
    !dnd5eConditionIncapacitated({
      conditions: targetConditions(
        candidate,
        input.characters,
        input.reconciledActiveEffects,
      ),
    }) &&
    tokenThreeDimensionalDistanceFeet(
      input.map,
      geometry,
      candidate,
      input.target,
    ) <= 5)
}

function allocateMonsterActionTargets(input: {
  map: BattleMap
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  attacker: Token
  preferredTarget: Token
  characters: readonly Character[]
  reconciledActiveEffects?: PlannerReconciledActiveEffects
}): readonly {
  sequenceIndex: number
  actionId: string
  target: Token
  distanceFeet: number
}[] | undefined {
  const sequence = actionSequence(input.monster, input.action, input.attacker)
  if (sequence.length === 0) return undefined
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const constraint = input.action.kind === 'multiattack'
    ? dnd5eMonsterMultiattackConstraint(input.monster.id, input.action.id)
    : undefined
  if (
    constraint?.requiresActorAirborne === true &&
    mapGeometryTokenElevation(geometry, input.attacker) <=
      mapGeometryTerrainElevationAtPoint(geometry, input.attacker)
  ) return undefined
  for (const requirement of constraint?.requiredSourceLinkedRelationsAtStart ?? []) {
    const eligible = sourceLinkedRelationTargets({
      map: input.map,
      characters: input.characters,
      sourceActorId: input.attacker.id,
      slotGroup: requirement.slotGroup,
      reconciledActiveEffects: input.reconciledActiveEffects,
    }).filter((candidate) =>
      targetHitPoints(candidate, input.characters).current > 0 &&
      (
        requirement.targetMaxSizeRank == null ||
        plannerTokenSizeRank(candidate, input.characters) <=
          requirement.targetMaxSizeRank
      ))
    if (new Set(eligible.map((candidate) => candidate.id)).size <
      requirement.count) return undefined
  }
  const berserk = input.attacker.dnd5eCombatState?.monsterBerserk === true &&
    dnd5eMonsterBerserkRule(input.monster)?.target === 'nearest-visible-creature'
  const candidates = (
    input.action.kind === 'multiattack' && !berserk
      ? input.map.tokens.filter((candidate) =>
          candidate.id !== input.attacker.id &&
          candidate.type !== 'obstacle' &&
          areOpposedCombatTokens(input.attacker, candidate) &&
          targetHitPoints(candidate, input.characters).current > 0)
      : [input.preferredTarget]
  )
  const actionIds = sequence.map((child) => child.id)
  const allocation = dnd5eAllocateMonsterMultiattackTargets({
    monsterId: input.monster.id,
    actionId: input.action.id,
    actionIds,
    candidates,
    preferredTargetId: input.preferredTarget.id,
    canTarget: ({ actionId, targetId, assigned }) => {
      const child = input.monster.actions.find((candidate) =>
        candidate.id === actionId)
      const target = candidates.find((candidate) => candidate.id === targetId)
      if (!child || !target) return false
      const distanceFeet = tokenThreeDimensionalDistanceFeet(
        input.map,
        geometry,
        input.attacker,
        target,
      )
      const cover = mapGeometryCoverBetween(
        geometry,
        input.attacker,
        target,
        input.map,
      )
      if (
        cover.blocksLineOfEffect ||
        cover.cover === 'total' ||
        mapGeometryLineOfSightBlocked({
          geometry,
          from: input.attacker,
          to: target,
          fromElevationFeet: mapGeometryTokenElevation(
            geometry,
            input.attacker,
          ),
          toElevationFeet: mapGeometryTokenElevation(geometry, target),
        })
      ) return false
      if (child.targetEligibility) {
        const targetConditionIds = targetConditions(
          target,
          input.characters,
          input.reconciledActiveEffects,
        )
        const targetEligible = child.targetEligibility.predicates.some(
          (predicate) => {
            if (predicate.kind === 'incapacitated') {
              return dnd5eConditionIncapacitated({
                conditions: targetConditionIds,
              })
            }
            if (predicate.kind === 'standard-condition') {
              return targetConditionIds.includes(predicate.condition)
            }
            return sourceLinkedRelationTargets({
              map: input.map,
              characters: input.characters,
              sourceActorId: input.attacker.id,
              slotGroup: predicate.slotGroup,
              reconciledActiveEffects: input.reconciledActiveEffects,
            }).some((candidate) => candidate.id === targetId)
          },
        )
        const occurrence = constraint?.occurrences?.find((candidate) =>
          candidate.occurrenceIndex === assigned.length)
        if (
          !targetEligible &&
          occurrence?.skipWhenTargetEligibilityUnavailable !== true
        ) return false
      }
      if (child.relationRequirement?.kind === 'target-linked-to-source') {
        const slotGroup = child.relationRequirement.slotGroup
        const alreadyLinked = sourceLinkedRelationTargets({
          map: input.map,
          characters: input.characters,
          sourceActorId: input.attacker.id,
          slotGroup,
          reconciledActiveEffects: input.reconciledActiveEffects,
        }).some((candidate) => candidate.id === targetId)
        const prospectivelyLinked = assigned.some((occurrence) => {
          if (occurrence.targetId !== targetId) return false
          const prior = input.monster.actions.find((candidate) =>
            candidate.id === occurrence.actionId)
          return prior?.attack?.onHitEffects?.some((effect) =>
            effect.kind === 'source-linked-condition' &&
            effect.relation.slotGroup === slotGroup) === true
        })
        if (!alreadyLinked && !prospectivelyLinked) return false
      }
      if (child.attack) {
        const attack = dnd5eMonsterWeaponAttackAtDistance(
          dnd5eMonsterEffectiveWeaponAttack(
            child.attack,
            Math.max(
              0,
              input.attacker.hp ?? input.monster.hitPoints.average,
            ),
            Math.max(
              1,
              input.attacker.maxHp ?? input.monster.hitPoints.average,
            ),
          ),
          distanceFeet,
          input.action.kind === 'multiattack'
            ? input.action.sequenceAttackMode
            : undefined,
        )
        if (
          attack.targetMaxSizeRank != null &&
          plannerTokenSizeRank(target, input.characters) >
            attack.targetMaxSizeRank
        ) return false
        return attackModeAtDistance({ ...child, attack }, distanceFeet).legal
      }
      const rule = child.rule
      if (!rule) return false
      if (
        rule.kind === 'saving-throw-condition' &&
        distanceFeet > rule.rangeFeet
      ) return false
      if (
        (
          rule.kind === 'source-linked-engulf' ||
          rule.kind === 'throw-linked-target'
        ) &&
        plannerTokenSizeRank(target, input.characters) >
          rule.targetMaxSizeRank
      ) return false
      if (
        rule.kind === 'throw-linked-target' &&
        dnd5eForcedPushDestination(
          input.map,
          input.attacker,
          target,
          rule.maximumDistanceFeet,
        ).distanceFeet <= 0
      ) return false
      return true
    },
  })
  if (!allocation) return undefined
  return allocation.flatMap((occurrence) => {
    const target = candidates.find((candidate) =>
      candidate.id === occurrence.targetId)
    return target
      ? [{
          ...occurrence,
          target,
          distanceFeet: tokenThreeDimensionalDistanceFeet(
            input.map,
            geometry,
            input.attacker,
            target,
          ),
        }]
      : []
  })
}

function actionExpectedValue(input: {
  map: BattleMap
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  attacker: Token
  target: Token
  targetOccurrences?: readonly {
    target: Token
    distanceFeet: number
  }[]
  characters: readonly Character[]
  distanceFeet: number
  combatId?: string
  round?: number
  reconciledActiveEffects?: PlannerReconciledActiveEffects
}): {
  expectedDamage: number
  hitProbability: number
  firstAttack?: Dnd5eMonsterWeaponAttack
  controlValue: number
} | undefined {
  const { map, monster, action, attacker, characters } = input
  const sequence = actionSequence(monster, action, attacker)
  if (sequence.length === 0) return undefined
  const compositeRuntime = prepareDnd5eMonsterCompositeRuntimePlan(monster, action)
  const geometry = mapGeometryRuntimeForMap(map.id)
  const attackerCharacter = attacker.characterId
    ? characters.find((character) => character.id === attacker.characterId)
    : undefined
  const attackerState = attackerCharacter?.dnd5eCombatState ?? attacker.dnd5eCombatState
  const currentTurnPrefix = `${input.combatId ?? ''}:${input.round ?? 0}:`
  const recordedMonsterTraitTurnKey = Object.entries(
    attackerState?.declarativeUsedTurnKeys ?? {},
  ).find(([key, value]) =>
    key.startsWith('monster-trait:') &&
    value.startsWith(currentTurnPrefix))?.[1]
  const plannerTurnKey = recordedMonsterTraitTurnKey ??
    `${currentTurnPrefix}planner:${attacker.id}`
  let expectedDamage = 0
  let controlValue = 0
  let probabilityTotal = 0
  const traitRemainingMissProbability =
    new Map<'sneak-attack' | 'martial-advantage', number>()
  let firstAttack: Dnd5eMonsterWeaponAttack | undefined
  const prospectiveLinkedTargetsBySlotGroup = new Map<string, Set<string>>()
  const weaponDamageSource: PlannerDamageSourceDetails = {
    delivery: 'weapon-attack',
    magical: dnd5eMonsterWeaponAttacksAreMagical(monster),
    sourceMoralAlignment: plannerMoralAlignment(monster.alignment),
  }
  const onHitDamageSource: PlannerDamageSourceDetails = {
    delivery: 'other',
    magical: false,
    sourceMoralAlignment: plannerMoralAlignment(monster.alignment),
  }
  for (const [sequenceIndex, child] of sequence.entries()) {
    const occurrence = input.targetOccurrences?.[sequenceIndex]
    const target = occurrence?.target ?? input.target
    const distanceFeet = occurrence?.distanceFeet ?? input.distanceFeet
    const cover = mapGeometryCoverBetween(geometry, attacker, target, map)
    if (cover.blocksLineOfEffect || cover.cover === 'total') return undefined
    if (mapGeometryLineOfSightBlocked({
      geometry,
      from: attacker,
      to: target,
      fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
      toElevationFeet: mapGeometryTokenElevation(geometry, target),
    })) return undefined
    const targetAc =
      targetArmorClass(target, characters) + cover.armorClassBonus
    const targetCharacter = target.characterId
      ? characters.find((character) => character.id === target.characterId)
      : undefined
    const targetState =
      targetCharacter?.dnd5eCombatState ?? target.dnd5eCombatState
    const targetHp = targetHitPoints(target, characters)
    const monsterAttackTraitContext = {
      combatId: input.combatId ?? '',
      round: input.round ?? 0,
      targetCurrentHp: targetHp.current,
      targetMaxHp: targetHp.maximum,
      targetSurprisedCombatId: targetState?.surprisedCombatId,
      targetSurpriseResolvedCombatId: targetState?.surpriseResolvedCombatId,
      targetHasTakenTurn:
        targetState?.turnStartResolvedTurnKey?.startsWith(
          `${input.combatId ?? ''}:`,
        ) === true,
      adjacentActiveAllyNearTarget: monsterAdjacentActiveAlly({
        map,
        attacker,
        target,
        characters,
        reconciledActiveEffects: input.reconciledActiveEffects,
      }),
      turnKey: plannerTurnKey,
      usedTurnKeys: attackerState?.declarativeUsedTurnKeys,
      actorRecklessActive: attackerState?.recklessAttackTurnKey != null,
    }
    const packTacticsAdvantage = monsterPackTacticsAdvantage({
      map,
      monster,
      attacker,
      target,
      characters,
      reconciledActiveEffects: input.reconciledActiveEffects,
    })
    const elevationDeltaFeet =
      mapGeometryTokenElevation(geometry, attacker) -
      mapGeometryTokenElevation(geometry, target)
    const highGroundAdvantage = elevationDeltaFeet >= 10
    const lowGroundDisadvantage = elevationDeltaFeet <= -10
    const attackerConditionDisadvantage =
      dnd5eConditionImposesAttackDisadvantage({
        attacker: {
          conditions: targetConditions(
            attacker,
            characters,
            input.reconciledActiveEffects,
          ),
        },
        targetDistanceFeet: distanceFeet,
      })
    const targetDodging = targetIsDodging(target, characters)
    if (!child.attack) {
      if (!compositeRuntime || child.kind !== 'other' || !child.rule) return undefined
      const rule = child.rule
      if (
        child.relationRequirement?.kind === 'target-linked-to-source' &&
        !prospectiveLinkedTargetsBySlotGroup
          .get(child.relationRequirement.slotGroup)
          ?.has(target.id) &&
        !sourceLinkedRelationTargets({
          map,
          characters,
          sourceActorId: attacker.id,
          slotGroup: child.relationRequirement.slotGroup,
          reconciledActiveEffects: input.reconciledActiveEffects,
        }).some((candidate) => candidate.id === target.id)
      ) return undefined
      if (rule.kind === 'area-saving-throw') {
        const areaRule = dnd5eMonsterAreaSavingThrowVariants(child)[0]
        if (!areaRule) return undefined
        const modifier = targetSavingThrowModifier(
          target,
          characters,
          areaRule.ability,
        )
        const successProbability = Math.max(
          0.05,
          Math.min(0.95, (21 + modifier - areaRule.dc) / 20),
        )
        if (areaRule.damage) {
          const damageFactor = 1 - successProbability +
            (
              areaRule.damageOnSuccessfulSave === 'half'
                ? successProbability / 2
                : 0
            )
          expectedDamage += resolvePlannerDamage(
            target,
            areaRule.damage.average * damageFactor,
            areaRule.damage.type,
            onHitDamageSource,
          )
        }
        if (
          areaRule.conditionOnFailedSave ||
          areaRule.activeEffectOnFailedSave
        ) {
          controlValue += 8 * (1 - successProbability)
        }
        probabilityTotal += 1 - successProbability
        continue
      }
      if (rule.kind === 'saving-throw-condition') {
        const modifier = targetSavingThrowModifier(target, characters, rule.ability)
        const failureProbability = 1 - Math.max(
          0.05,
          Math.min(0.95, (21 + modifier - rule.dc) / 20),
        )
        controlValue += (
          rule.condition === 'paralyzed' || rule.condition === 'unconscious'
            ? 12
            : rule.condition === 'restrained' || rule.condition === 'stunned'
              ? 10
              : 6
        ) * failureProbability
        probabilityTotal += failureProbability
        continue
      }
      if (rule.kind === 'source-linked-reel') {
        controlValue += 5
        probabilityTotal += 1
        continue
      }
      if (rule.kind === 'throw-linked-target') {
        controlValue += 10
        probabilityTotal += 1
        continue
      }
      if (rule.kind === 'source-linked-engulf') {
        if (plannerTokenSizeRank(target, characters) > rule.targetMaxSizeRank) {
          return undefined
        }
        controlValue += 14
        probabilityTotal += 1
        continue
      }
      if (rule.kind === 'conditioned-damage-and-healing') {
        expectedDamage += resolvePlannerDamage(
          target,
          rule.damage.average,
          rule.damage.type,
          onHitDamageSource,
        )
        probabilityTotal += 1
        continue
      }
      // Composite support is catalog-gated. Unknown future rule kinds remain
      // unavailable to the tactical planner until their runtime payload is
      // explicitly constructed.
      return undefined
    }
    const targetMaxSizeRank = (
      child.attack as Dnd5eMonsterWeaponAttack & { targetMaxSizeRank?: number }
    ).targetMaxSizeRank ?? (
      child.id === 'constrict' &&
      (monster.id === 'srd-5.1:behir' || /\bbehir\b/i.test(monster.englishName))
        ? 3
        : undefined
    )
    if (
      targetMaxSizeRank != null &&
      plannerTokenSizeRank(target, characters) > targetMaxSizeRank
    ) return undefined
    const hpAdjustedAttack = dnd5eMonsterEffectiveWeaponAttack(
      child.attack,
      Math.max(0, attacker.hp ?? monster.hitPoints.average),
      Math.max(1, attacker.maxHp ?? monster.hitPoints.average),
    )
    const distanceAdjustedAttack = dnd5eMonsterWeaponAttackAtDistance(
      hpAdjustedAttack,
      distanceFeet,
      action.kind === 'multiattack' ? action.sequenceAttackMode : undefined,
    )
    const attack = dnd5eMonsterWeaponAttackWithTriggeredTraits(
      monster,
      dnd5eMonsterWeaponAttackAgainstConditions(
        monster,
        distanceAdjustedAttack,
        targetConditions(target, characters, input.reconciledActiveEffects),
      ),
      monsterAttackTraitContext,
    )
    const sourceLinkedEffect = attack.onHitEffects?.find(
      (effect) => effect.kind === 'source-linked-condition',
    )
    if (sourceLinkedEffect) {
      const prospectiveTargets =
        prospectiveLinkedTargetsBySlotGroup.get(
          sourceLinkedEffect.relation.slotGroup,
        ) ?? new Set<string>()
      prospectiveTargets.add(target.id)
      prospectiveLinkedTargetsBySlotGroup.set(
        sourceLinkedEffect.relation.slotGroup,
        prospectiveTargets,
      )
    }
    const sourceLinkedTargets = sourceLinkedEffect
      ? sourceLinkedRelationTargets({
          map,
          characters,
          sourceActorId: attacker.id,
          slotGroup: sourceLinkedEffect.relation.slotGroup,
          reconciledActiveEffects: input.reconciledActiveEffects,
        })
      : []
    const targetAlreadyLinked = sourceLinkedTargets.some((candidate) => candidate.id === target.id)
    const automaticallyHitsLinkedTarget =
      sourceLinkedEffect?.relation.attackAutomaticallyHitsLinkedTarget === true &&
      targetAlreadyLinked
    if (
      sourceLinkedEffect?.relation.whenCapacityFull === 'linked-target-only' &&
      sourceLinkedTargets.length >= sourceLinkedEffect.relation.capacity &&
      !targetAlreadyLinked
    ) return undefined
    firstAttack ??= attack
    const mode = attackModeAtDistance({ ...child, attack }, distanceFeet)
    if (!mode.legal) return undefined
    const nearbyHostile = mode.ranged && map.tokens.some((candidate) =>
      candidate.id !== attacker.id && candidate.type !== 'obstacle' && areOpposedCombatTokens(attacker, candidate) &&
      tokenThreeDimensionalDistanceFeet(map, geometry, attacker, candidate) <= 5,
    )
    const baseProbability = Math.max(0.05, Math.min(0.95, (21 + attack.toHit - targetAc) / 20))
    const advantaged = packTacticsAdvantage || highGroundAdvantage ||
      targetState?.recklessAttackTurnKey != null ||
      dnd5eMonsterAttackTraitAdvantage(
        monster,
        attack,
        monsterAttackTraitContext,
      ) ||
      (
        sourceLinkedEffect?.relation.attackAdvantageAgainstLinkedTarget === true &&
        targetAlreadyLinked
      )
    const disadvantaged =
      mode.longRange ||
      nearbyHostile ||
      lowGroundDisadvantage ||
      attackerConditionDisadvantage ||
      attacker.dnd5eCombatState?.monsterDamageAversionActive === true ||
      targetDodging
    const hitProbability = automaticallyHitsLinkedTarget
      ? 1
      : advantaged === disadvantaged
        ? baseProbability
        : advantaged
          ? 1 - (1 - baseProbability) ** 2
          : baseProbability ** 2
    const effectiveRollMode = advantaged === disadvantaged
      ? 'normal' as const
      : advantaged ? 'advantage' as const : 'disadvantage' as const
    const automaticCritical = dnd5eMonsterAssassinateAutomaticCritical(
      monster,
      monsterAttackTraitContext,
    )
    const weaponDamage = attack.damage.reduce((sum, entry) =>
      sum + resolvePlannerDamage(
        target,
        automaticCritical
          ? entry.count * (entry.sides + 1) + entry.bonus
          : entry.average,
        entry.type,
        weaponDamageSource,
      ), 0)
    const traitDamageOpportunity = dnd5eMonsterTraitDamageDefinitions(
      monster,
      attack,
      {
        ...monsterAttackTraitContext,
        effectiveRollMode,
      },
    ).reduce((sum, definition) => {
      const remainingMiss =
        traitRemainingMissProbability.get(definition.traitId) ?? 1
      traitRemainingMissProbability.set(
        definition.traitId,
        remainingMiss * (1 - hitProbability),
      )
      const raw = automaticCritical
        ? definition.damage.count * (definition.damage.sides + 1) +
          definition.damage.bonus
        : definition.damage.average
      return sum + remainingMiss * resolvePlannerDamage(
        target,
        raw,
        definition.damage.type,
        weaponDamageSource,
      )
    }, 0)
    const onHitDamage = (attack.onHitEffects ?? []).reduce((effectSum, effect) => {
      if (effect.kind === 'source-linked-condition') return effectSum
      if (effect.kind === 'forced-movement') {
        if (
          effect.targetMaxSizeRank != null &&
          plannerTokenSizeRank(target, characters) > effect.targetMaxSizeRank
        ) return effectSum
        const failureProbability =
          effect.resistance.kind === 'saving-throw'
            ? 1 - Math.max(
                0.05,
                Math.min(
                  0.95,
                  (
                    21 +
                    targetSavingThrowModifier(
                      target,
                      characters,
                      effect.resistance.ability,
                    ) -
                    effect.resistance.dc
                  ) / 20,
                ),
              )
            : (() => {
                const sourceCombatant = plannerTokenCombatant(
                  attacker,
                  characters,
                  monster,
                )
                const targetCombatant = plannerTokenCombatant(target, characters)
                return dnd5eOpposedAbilityCheckSuccessProbability({
                  actorModifier: rules.abilityModifier(
                    sourceCombatant.abilities[effect.resistance.sourceAbility],
                  ),
                  actorMode: dnd5eAbilityCheckRollMode(sourceCombatant, {
                    ability: effect.resistance.sourceAbility,
                  }),
                  targetModifier: rules.abilityModifier(
                    targetCombatant.abilities[effect.resistance.targetAbility],
                  ),
                  targetMode: dnd5eAbilityCheckRollMode(targetCombatant, {
                    ability: effect.resistance.targetAbility,
                  }),
                })
              })()
        const destination = effect.direction === 'toward-source'
          ? dnd5eForcedPullDestination(
              map,
              attacker,
              target,
              effect.maximumDistanceFeet,
            )
          : dnd5eForcedPushDestination(
              map,
              attacker,
              target,
              effect.maximumDistanceFeet,
            )
        const fall = dnd5eForcedMovementFall({
          geometry,
          target,
          to: destination.to,
        })
        const fallingDamage =
          dnd5eFallingDamageDice(fall.fallDistanceFeet) *
          3.5 *
          failureProbability
        const conditionValue =
          effect.conditionOnFailedResistance === 'prone' ? 5 : 0
        controlValue += hitProbability * failureProbability * (
          conditionValue +
          Math.min(5, destination.distanceFeet / 5)
        )
        return effectSum + fallingDamage
      }
      if (effect.kind === 'hit-point-maximum-reduction') {
        const successProbability = effect.savingThrow
          ? Math.max(
              0.05,
              Math.min(
                0.95,
                (
                  21 +
                  targetSavingThrowModifier(
                    target,
                    characters,
                    effect.savingThrow.ability,
                  ) -
                  effect.savingThrow.dc
                ) / 20,
              ),
            )
          : 0
        const selectedDamage = attack.damage.reduce((sum, entry) =>
          sum + (
            effect.damageBasis.kind === 'all-attack-damage' ||
            entry.type === effect.damageBasis.damageType
              ? resolvePlannerDamage(
                  target,
                  entry.average,
                  entry.type,
                  weaponDamageSource,
                )
              : 0
          ), 0)
        const recoveryWeight =
          effect.recovery === 'greater-restoration-or-other-magic' ? 1 : 0.75
        const sourceHealingWeight = effect.healSourceByAmount ? 0.5 : 0
        return effectSum + selectedDamage * (1 - successProbability) *
          (recoveryWeight + sourceHealingWeight)
      }
      if (effect.kind === 'persistent-effect') {
        const successProbability = effect.savingThrow
          ? Math.max(
              0.05,
              Math.min(
                0.95,
                (
                  21 +
                  targetSavingThrowModifier(
                    target,
                    characters,
                    effect.savingThrow.ability,
                  ) -
                  effect.savingThrow.dc
                ) / 20,
              ),
            )
          : 0
        const applyProbability = 1 - successProbability
        const periodicDefinition = effect.periodicDamage
        const periodicRaw = periodicDefinition
          ? periodicDefinition.count * (periodicDefinition.sides + 1) / 2 +
            (periodicDefinition.modifier ?? 0)
          : 0
        const periodicDamage = periodicDefinition?.type
          ? resolvePlannerDamage(
              target,
              periodicRaw,
              periodicDefinition.type,
              onHitDamageSource,
            )
          : periodicRaw
        if (effect.standardCondition) {
          const currentConditions = targetConditions(
            target,
            characters,
            input.reconciledActiveEffects,
          )
          if (!currentConditions.includes(effect.standardCondition)) {
            const conditionValue =
              effect.standardCondition === 'unconscious' ||
              effect.standardCondition === 'paralyzed'
                ? 12
                : effect.standardCondition === 'stunned' ||
                    effect.standardCondition === 'restrained'
                  ? 10
                  : effect.standardCondition === 'poisoned' ||
                      effect.standardCondition === 'frightened'
                    ? 6
                    : 5
            controlValue += hitProbability * applyProbability *
              (conditionValue + (effect.modifiers?.preventHealing ? 4 : 0))
          }
        } else if (effect.modifiers?.preventHealing) {
          controlValue += hitProbability * applyProbability * 4
        }
        // Persistent effects generally survive long enough to tick at least
        // once. The modest 1.5-turn horizon rewards them without letting a
        // theoretical indefinite duration dominate immediate tactics.
        return effectSum + periodicDamage * applyProbability * 1.5
      }
      const modifier = targetSavingThrowModifier(target, characters, effect.ability)
      const successProbability = Math.max(
        0.05,
        Math.min(0.95, (21 + modifier - effect.dc) / 20),
      )
      const currentConditions = targetConditions(
        target,
        characters,
        input.reconciledActiveEffects,
      )
      for (const condition of [
        ...(effect.conditionOnFailedSave ? [effect.conditionOnFailedSave] : []),
        ...(effect.additionalConditionsOnFailedSave ?? []),
      ]) {
        if (currentConditions.includes(condition.condition)) continue
        const applyProbability = condition.minimumFailureMargin == null
          ? 1 - successProbability
          : Math.max(
              0,
              Math.min(
                1,
                (effect.dc - condition.minimumFailureMargin - modifier) / 20,
              ),
            )
        const durationWeight = Math.min(2, Math.max(
          1,
          condition.durationRounds / 10,
        ))
        const conditionValue =
          condition.condition === 'unconscious' || condition.condition === 'paralyzed'
            ? 12
            : condition.condition === 'stunned' || condition.condition === 'restrained'
              ? 10
              : condition.condition === 'poisoned' || condition.condition === 'frightened'
                ? 6
                : 5
        controlValue += hitProbability * applyProbability *
          (conditionValue + (condition.preventHealing ? 4 : 0)) * durationWeight
      }
      if (effect.kind !== 'saving-throw-damage') return effectSum
      const damageOnFailure = effect.damage.reduce((sum, entry) =>
        sum + resolvePlannerDamage(
          target,
          entry.average,
          entry.type,
          onHitDamageSource,
        ), 0)
      const saveFactor = 1 - successProbability +
        (effect.damageOnSuccessfulSave === 'half' ? successProbability / 2 : 0)
      return effectSum + damageOnFailure * saveFactor
    }, 0)
    if (
      sourceLinkedEffect &&
      !targetAlreadyLinked &&
      sourceLinkedTargets.length < sourceLinkedEffect.relation.capacity &&
      plannerTokenSizeRank(target, characters) <= sourceLinkedEffect.relation.targetMaxSizeRank
    ) {
      const missingConditions = sourceLinkedEffect.conditions.filter((condition) =>
        !targetConditions(
          target,
          characters,
          input.reconciledActiveEffects,
        ).includes(condition.condition))
      if (missingConditions.length > 0) {
        controlValue += hitProbability * (
          missingConditions.some((condition) => condition.condition === 'restrained') ? 16 : 8
        )
      }
    }
    expectedDamage +=
      (weaponDamage + onHitDamage + traitDamageOpportunity) *
      hitProbability
    probabilityTotal += hitProbability
  }
  if (!firstAttack && expectedDamage <= 0 && controlValue <= 0) return undefined
  return {
    expectedDamage,
    hitProbability: probabilityTotal / Math.max(1, sequence.length),
    firstAttack,
    controlValue,
  }
}

interface MonsterAreaPlacement {
  targetCell: GridCell
  targetElevationFeet: number
  targetTokenIds: string[]
  hostileCount: number
  friendlyCount: number
  expectedDamage: number
  controlValue: number
}

function plannerTargetCharacter(
  target: Token,
  characters: readonly Character[],
): Character | undefined {
  return target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
}

function plannerAreaTargetIsEligible(
  target: Token,
  characters: readonly Character[],
): boolean {
  const character = plannerTargetCharacter(target, characters)
  if (
    target.dnd5eCombatState?.hurlThroughHellSourceId ||
    character?.dnd5eCombatState?.hurlThroughHellSourceId
  ) return false
  const conditions = [
    ...targetConditions(target, characters),
    ...dnd5eConditionsFromActiveEffects(target.dnd5eCombatState?.activeEffects),
    ...dnd5eConditionsFromActiveEffects(character?.dnd5eCombatState?.activeEffects),
  ]
  if (conditions.some((condition) =>
    ['banished', '放逐'].includes(condition.trim().toLowerCase()))) return false
  const hp = targetHitPoints(target, characters).current
  if (character) return hp > 0 || (character.deathSaveFailures ?? 0) < 3
  if (target.maxHp != null) {
    return hp > 0 ||
      target.dnd5eCombatState?.stableAtZero === true ||
      target.dnd5eCombatState?.monsterRegenerationPendingAtZero === true ||
      target.dnd5eCombatState?.undeadFortitudePending != null
  }
  return true
}

function plannerMonsterAreaRuleAllowsTarget(input: {
  map: BattleMap
  attacker: Token
  target: Token
  characters: readonly Character[]
  rule: Dnd5eMonsterAreaSavingThrowVariant
}): boolean {
  const exclusions = input.rule.targetCreatureTypeExclusions ?? []
  if (exclusions.length > 0) {
    const targetMonster = plannerTargetMonster(input.target)
    const creatureType = [
      targetMonster?.creatureType ?? 'humanoid',
      ...(targetMonster?.subtypes ?? []),
    ].join(' ').trim().toLowerCase()
    const excluded = exclusions.some((entry) => {
      if (entry === 'aberration') {
        return creatureType.includes('aberration') || creatureType.includes('异怪')
      }
      if (entry === 'demon') {
        return creatureType.includes('demon') || creatureType.includes('恶魔')
      }
      return creatureType.includes('undead') || creatureType.includes('亡灵')
    })
    if (excluded) return false
  }
  if (input.rule.requiresTargetCanHearSource) {
    const targetIsDeafened = targetConditions(
      input.target,
      input.characters,
    ).some((condition) => condition.trim().toLowerCase() === 'deafened')
    const sourceIsSilenced = targetConditions(
      input.attacker,
      input.characters,
    ).some((condition) => ['silenced', '沉默'].includes(condition.trim().toLowerCase()))
    if (targetIsDeafened || sourceIsSilenced) return false
  }
  if (
    input.rule.requiresSourceCanSeeTarget &&
    !mapGeometryCanSeeToken({
      geometry: mapGeometryRuntimeForMap(input.map.id),
      map: input.map,
      viewer: input.attacker,
      target: input.target,
      forceEnabled: true,
    })
  ) return false
  if (
    input.rule.requiresTargetCanSeeSource &&
    !mapGeometryCanSeeToken({
      geometry: mapGeometryRuntimeForMap(input.map.id),
      map: input.map,
      viewer: input.target,
      target: input.attacker,
      forceEnabled: true,
    })
  ) return false
  return true
}

function plannerTargetAttackCount(
  target: Token,
  characters: readonly Character[],
): number {
  const character = plannerTargetCharacter(target, characters)
  if (character) return dnd5eAttacksPerAttackAction(character)
  const monster = plannerTargetMonster(target)
  if (!monster) return 1
  return Math.max(1, ...monster.actions.map((action) =>
    actionSequence(monster, action, target)
      .filter((part) => part.attack != null).length))
}

function plannerTargetReactionValue(
  target: Token,
  characters: readonly Character[],
): number {
  const character = plannerTargetCharacter(target, characters)
  const activeEffects = [
    ...(target.dnd5eCombatState?.activeEffects ?? []),
    ...(character?.dnd5eCombatState?.activeEffects ?? []),
  ]
  if (activeEffects.some((effect) => effect.modifiers?.preventReactions)) return 0
  const monster = plannerTargetMonster(target)
  // Every creature can threaten opportunity attacks; declared reactions make
  // losing the resource materially more expensive.
  return 2 + ((monster?.reactions?.length ?? 0) > 0 ? 4 : 0)
}

function plannerTargetMobilityWeight(
  target: Token,
  characters: readonly Character[],
): number {
  const character = plannerTargetCharacter(target, characters)
  const monster = plannerTargetMonster(target)
  const speed = character?.speed ?? (monster ? dnd5eMonsterMapSpeed(monster) : 30)
  return Math.max(0.5, Math.min(2, speed / 30))
}

function plannerTargetStrengthDependency(
  target: Token,
  characters: readonly Character[],
): number {
  const character = plannerTargetCharacter(target, characters)
  if (character) {
    let value = character.abilities.str >= character.abilities.dex
      ? Math.min(2, dnd5eAttacksPerAttackAction(character) * 0.6)
      : 0
    if (character.savingThrows.includes('str')) value += 0.3
    if (character.skills.includes('athletics')) value += 0.3
    return value
  }
  const monster = plannerTargetMonster(target)
  if (!monster) return 0.5
  const strengthBasedMelee = monster.actions.some((action) =>
    actionSequence(monster, action, target).some((part) =>
      part.attack != null &&
      part.attack.mode !== 'ranged' &&
      dnd5eMonsterWeaponAttackAbility(monster, part.attack) === 'str'))
  let value = strengthBasedMelee
    ? Math.min(2, plannerTargetAttackCount(target, characters) * 0.6)
    : 0
  if (monster.savingThrows?.str != null) value += 0.3
  if (monster.skills?.some((skill) => skill.key === 'athletics')) value += 0.3
  return value
}

function monsterAreaFailedSaveOutcomeValue(input: {
  map: BattleMap
  attacker: Token
  target: Token
  characters: readonly Character[]
  rule: Dnd5eMonsterAreaSavingThrowVariant
}): { expectedAdditionalDamage: number; controlValue: number } {
  const failureProbability = 0.75
  let expectedAdditionalDamage = 0
  let controlValue = 0
  if (input.rule.forcedMovementOnFailedSave) {
    const mapAtCandidate = {
      ...input.map,
      tokens: input.map.tokens.map((token) =>
        token.id === input.attacker.id ? input.attacker : token),
    }
    const push = dnd5eForcedPushDestination(
      mapAtCandidate,
      input.attacker,
      input.target,
      input.rule.forcedMovementOnFailedSave.maximumDistanceFeet,
    )
    if (push.distanceFeet > 0) {
      const fall = dnd5eForcedMovementFall({
        geometry: mapGeometryRuntimeForMap(input.map.id),
        target: input.target,
        to: push.to,
      })
      expectedAdditionalDamage +=
        dnd5eFallingDamageDice(fall.fallDistanceFeet) * 3.5 * failureProbability
      controlValue += failureProbability *
        (4 + push.distanceFeet / 2 + fall.fallDistanceFeet / 2)
    }
  }
  const activeEffect = input.rule.activeEffectOnFailedSave
  const alreadyHasActiveEffect = activeEffect
    ? tokenActiveEffects(input.target, input.characters).some((effect) =>
        effect.definitionId === `monster-area:${activeEffect.id}`)
    : false
  if (activeEffect && !alreadyHasActiveEffect) {
    const modifiers = activeEffect.modifiers
    let mechanicalValue = 0
    if ((modifiers.speedMultiplier ?? 1) < 1) {
      mechanicalValue += (1 - (modifiers.speedMultiplier ?? 1)) * 12 *
        plannerTargetMobilityWeight(input.target, input.characters)
    }
    if (modifiers.preventReactions) {
      mechanicalValue += plannerTargetReactionValue(input.target, input.characters)
    }
    if (modifiers.maximumAttacksPerTurn != null) {
      mechanicalValue += Math.max(
        0,
        plannerTargetAttackCount(input.target, input.characters) -
          modifiers.maximumAttacksPerTurn,
      ) * 6
    }
    if (modifiers.actionOrBonusActionOnly) mechanicalValue += 8
    if (modifiers.strengthRollMode === 'disadvantage') {
      mechanicalValue += 8 * plannerTargetStrengthDependency(input.target, input.characters)
    }
    const durationWeight = Math.min(2, Math.max(1, activeEffect.durationRounds / 10))
    controlValue += mechanicalValue * failureProbability * durationWeight
  }
  if (input.rule.conditionOnFailedSave) {
    const durationWeight = Math.min(
      2,
      Math.max(1, input.rule.conditionOnFailedSave.durationRounds / 10),
    )
    controlValue += 15.6 * durationWeight
  }
  return { expectedAdditionalDamage, controlValue }
}

function bestMonsterAreaPlacement(input: {
  map: BattleMap
  attacker: Token
  focusTarget: Token
  area: SkillAoeTargeting
  areaIncludesSelf?: boolean
  averageDamage: number
  savingThrow: boolean
  targetMode?: Dnd5eMonsterAreaSavingThrowVariant['target']
  minimumHostiles?: number
  characters: readonly Character[]
  canAffectTarget?: (target: Token) => boolean
  /** Monster action eligibility is authoritative; excluded creatures must not be submitted. */
  excludeUnaffectableFromTargetIds?: boolean
  expectedDamageForTarget?: (target: Token) => number
  controlValueForTarget?: (target: Token) => number
  aggregateControlForTargets?: (input: {
    hostiles: readonly Token[]
    friendlies: readonly Token[]
  }) => {
    controlValue: number
    affectedHostileIds: readonly string[]
    affectedFriendlyIds: readonly string[]
  }
  /** Spell/action ID used to select the authoritative vertical volume. */
  verticalRuleId: string
}): MonsterAreaPlacement | undefined {
  const { map, attacker, focusTarget, area } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const casterCell = tokenAnchorCellFromPixel(attacker.x, attacker.y, attacker, map)
  const focusCell = tokenAnchorCellFromPixel(focusTarget.x, focusTarget.y, focusTarget, map)
  const columns = Math.max(1, Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize)))
  const rows = Math.max(1, Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize)))
  const livingHostileAnchors = map.tokens
    .filter((token) =>
      token.type !== 'obstacle' &&
      areOpposedCombatTokens(attacker, token) &&
      targetHitPoints(token, input.characters).current > 0)
    .slice(0, 24)
    .map((token) => ({
      cell: tokenAnchorCellFromPixel(token.x, token.y, token, map),
      elevationFeet: mapGeometryTokenElevation(geometry, token),
    }))
  const focusElevationFeet = mapGeometryTokenElevation(geometry, focusTarget)
  const candidateAnchors = [
    { cell: focusCell, elevationFeet: focusElevationFeet },
    ...livingHostileAnchors,
  ]
  if (area.origin === 'point') {
    for (let left = 0; left < livingHostileAnchors.length; left += 1) {
      for (let right = left + 1; right < livingHostileAnchors.length; right += 1) {
        const first = livingHostileAnchors[left]
        const second = livingHostileAnchors[right]
        candidateAnchors.push({
          cell: {
            col: Math.round((first.cell.col + second.cell.col) / 2),
            row: Math.round((first.cell.row + second.cell.row) / 2),
          },
          elevationFeet: Math.round((first.elevationFeet + second.elevationFeet) / 2),
        })
      }
    }
  }
  const seenAnchors = new Set<string>()
  const boundedCandidates = candidateAnchors.filter(({ cell, elevationFeet }) => {
    if (cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows) return false
    const key = `${cell.col},${cell.row},${elevationFeet}`
    if (seenAnchors.has(key)) return false
    seenAnchors.add(key)
    return true
  })
  const anchors: Array<{ cell: GridCell; elevationFeet: number }> = area.origin === 'self'
    ? area.shape === 'circle'
      ? [{ cell: casterCell, elevationFeet: mapGeometryTokenElevation(geometry, attacker) }]
      : boundedCandidates
    : boundedCandidates
  const averageDamage = input.averageDamage
  let best: (MonsterAreaPlacement & { score: number; key: string }) | undefined
  for (const anchor of anchors) {
    const targetCell = anchor.cell
    if (!canPlaceAoe(area, casterCell, targetCell)) continue
    const orientFrom = aoeOrientFromCell(area, casterCell, targetCell)
    const cells = cellsForAoe(area, orientFrom, targetCell)
    const effectOrigin = area.origin === 'point'
      ? {
          x: map.gridOffsetX + (targetCell.col + 0.5) * map.gridSize,
          y: map.gridOffsetY + (targetCell.row + 0.5) * map.gridSize,
        }
      : attacker
    const effectAim = {
      x: map.gridOffsetX + (targetCell.col + 0.5) * map.gridSize,
      y: map.gridOffsetY + (targetCell.row + 0.5) * map.gridSize,
    }
    const effectOriginElevation = area.origin === 'point'
      ? anchor.elevationFeet
      : mapGeometryTokenElevation(geometry, attacker)
    if (
      area.origin === 'point' &&
      dnd5eTokenToPointDistanceFeet({
        geometry,
        token: attacker,
        pointElevationFeet: effectOriginElevation,
        horizontalDistanceFeet: Math.max(
          Math.abs(targetCell.col - casterCell.col),
          Math.abs(targetCell.row - casterCell.row),
        ) * Math.max(1, map.feetPerCell ?? 5),
      }) > (area.placeRangeFeet ?? Number.POSITIVE_INFINITY) + 1e-4
    ) continue
    if (
      area.origin === 'point' &&
      mapGeometryLineOfEffectBlocked({
        geometry,
        from: attacker,
        to: effectOrigin,
        fromElevationFeet: mapGeometryTokenElevation(geometry, attacker),
        toElevationFeet: effectOriginElevation,
      })
    ) continue
    const geometricallyAffected = tokensInCells(map, map.tokens, cells).filter((token) =>
      token.type !== 'obstacle' &&
      (token.id !== attacker.id || input.areaIncludesSelf) &&
      plannerAreaTargetIsEligible(token, input.characters) &&
      dnd5eInstantAoeAffectsTokenVertically({
        spellId: input.verticalRuleId,
        area,
        map,
        geometry,
        sourceToken: attacker,
        targetToken: token,
        effectOrigin,
        effectOriginElevationFeet: effectOriginElevation,
        effectAim,
        effectAimElevationFeet: anchor.elevationFeet,
      }) &&
      !mapGeometryLineOfEffectBlocked({
        geometry,
        from: effectOrigin,
        to: token,
        fromElevationFeet: effectOriginElevation,
        toElevationFeet: mapGeometryTokenElevation(geometry, token),
      }))
    const geometricallyAffectedFriendlies = geometricallyAffected.filter((token) =>
      token.id !== attacker.id && !areOpposedCombatTokens(attacker, token))
    // Existing point/cone spells keep the conservative no-friendly-fire policy.
    // Monster area declarations explicitly opt into either hostile-only or
    // all-creatures-except-self targeting.
    if (input.targetMode == null && geometricallyAffectedFriendlies.length > 0) continue
    const targetModeAffected = input.targetMode === 'all-creatures-except-self'
      ? geometricallyAffected
      : geometricallyAffected.filter((token) => areOpposedCombatTokens(attacker, token))
    const affected = input.excludeUnaffectableFromTargetIds
      ? targetModeAffected.filter((token) => input.canAffectTarget?.(token) ?? true)
      : targetModeAffected
    const hostiles = affected.filter((token) =>
      areOpposedCombatTokens(attacker, token) &&
      (input.canAffectTarget?.(token) ?? true))
    const friendlies = affected.filter((token) =>
      (token.id !== attacker.id || input.areaIncludesSelf === true) &&
      !areOpposedCombatTokens(attacker, token) &&
      (input.canAffectTarget?.(token) ?? true))
    const aggregateControl = input.aggregateControlForTargets?.({ hostiles, friendlies })
    const effectiveHostiles = aggregateControl
      ? hostiles.filter((token) => aggregateControl.affectedHostileIds.includes(token.id))
      : hostiles
    const effectiveFriendlies = aggregateControl
      ? friendlies.filter((token) => aggregateControl.affectedFriendlyIds.includes(token.id))
      : friendlies
    // Spell slots are normally conserved for clusters, but recharge weapons
    // may be worthwhile against a lone priority target.
    if (
      effectiveHostiles.length < (input.minimumHostiles ?? 2) ||
      !effectiveHostiles.some((token) => token.id === focusTarget.id)
    ) continue
    const saveMultiplier = input.savingThrow ? 0.75 : 1
    const expectedHostileDamage = hostiles.reduce((sum, hostile) =>
      sum + (input.expectedDamageForTarget?.(hostile) ?? averageDamage), 0) * saveMultiplier
    const expectedFriendlyDamage = friendlies.reduce((sum, friendly) =>
      sum + (input.expectedDamageForTarget?.(friendly) ?? averageDamage), 0) * saveMultiplier
    const expectedDamage = expectedHostileDamage - expectedFriendlyDamage
    const hostileControlValue = hostiles.reduce((sum, hostile) =>
      sum + (input.controlValueForTarget?.(hostile) ?? 0), 0)
    const friendlyControlValue = friendlies.reduce((sum, friendly) =>
      sum + (input.controlValueForTarget?.(friendly) ?? 0), 0)
    const controlValue = aggregateControl?.controlValue ??
      hostileControlValue - friendlyControlValue
    const focusBonus = effectiveHostiles.some((token) => token.id === focusTarget.id) ? 24 : 0
    const score = expectedDamage + controlValue +
      (effectiveHostiles.length - effectiveFriendlies.length) * 40 + focusBonus
    const targetElevationFeet = area.origin === 'point'
      ? effectOriginElevation
      : anchor.elevationFeet
    const key = `${targetCell.col},${targetCell.row},${targetElevationFeet}`
    if (!best || score > best.score || (score === best.score && key < best.key)) {
      best = {
        targetCell,
        targetElevationFeet,
        targetTokenIds: affected.map((token) => token.id),
        hostileCount: effectiveHostiles.length,
        friendlyCount: effectiveFriendlies.length,
        expectedDamage,
        controlValue,
        score,
        key,
      }
    }
  }
  return best
}

interface ExactMonsterRoute {
  movementCostFeet: number
  points: Array<{ x: number; y: number }>
}

function exactMonsterRouteFromPath(
  enemy: Token,
  monster: Dnd5eMonsterStatBlock,
  plan: Dnd5eMonsterTurnPlan,
  actorElevationFeet: number,
  path: MapPathResult | undefined,
): ExactMonsterRoute | undefined {
  if (!path || path.doorsToOpen.length > 1) return undefined
  const verticalDistanceFeet = Math.abs(
    (path.elevationsFeet.at(-1) ?? actorElevationFeet) - actorElevationFeet,
  )
  const available = (plan.movementMode === 'fly'
    ? plannerTokenEffectiveFlySpeed(
        enemy,
        monster.speed.fly ?? dnd5eMonsterMapSpeed(monster),
      )
    : plannerTokenEffectiveSpeed(
        enemy,
        dnd5eMonsterMapSpeed(monster),
      )) * (plan.dashed ? 2 : 1)
  const movementCostFeet = path.movementCostFeet + verticalDistanceFeet
  if (movementCostFeet > available + 1e-4) return undefined
  return { movementCostFeet, points: path.points }
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
  return exactMonsterRouteFromPath(
    enemy,
    monster,
    plan,
    actorElevationFeet,
    path,
  )
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
  canUseAction: boolean
  combatId?: string
  round?: number
  preferredTargetId?: string
  requiredActionId?: string
  movementBudgetFeet?: number
  simulationOptimization?: Dnd5eMonsterTurnPlannerOptions['simulationOptimization']
  exactRouteTrees?: Map<string, MapGeometryPathTree>
  reconciledActiveEffects?: PlannerReconciledActiveEffects
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  const { map, enemy, monster, target, characters } = input
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const geometry = mapGeometryRuntimeForMap(map.id)
  const startDistanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, enemy, target)
  const start = tokenAnchorCellFromPixel(enemy.x, enemy.y, enemy, map)
  const movementSpeed = plannerTokenEffectiveSpeed(enemy, dnd5eMonsterMapSpeed(monster))
  const flySpeed = plannerTokenEffectiveFlySpeed(enemy, monster.speed.fly ?? 0)
  const walkSpeed = plannerTokenEffectiveSpeed(enemy, monster.speed.walk ?? 0)
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
  const canMove = !isMovementLocked(
    targetConditions(enemy, characters, input.reconciledActiveEffects),
  )
  const desiredElevationFeet = !canMove
    ? currentElevationFeet
    : shouldFly
      ? monsterFlightElevation(map, enemy, target, flySpeed)
      : mapGeometryTerrainElevationAtPoint(geometry, target)
  const verticalCostFeet = shouldFly ? Math.abs(desiredElevationFeet - currentElevationFeet) : 0
  const movementProfile: MonsterMovementProfile = {
    fromElevationFeet: currentElevationFeet,
    toElevationFeet: desiredElevationFeet,
    canFly: shouldFly,
    mode: shouldFly ? 'fly' : 'walk',
  }
  const draggedTargets = sourceLinkedRelationTargets({
    map,
    characters,
    sourceActorId: enemy.id,
    reconciledActiveEffects: input.reconciledActiveEffects,
  })
  const dragMovementDivisor = draggedTargets.some((draggedTarget) =>
    plannerTokenSizeRank(draggedTarget, characters) >
      plannerTokenSizeRank(enemy, characters) - 2)
    ? 2
    : 1
  const standFromProne = enemy.dnd5eCombatState?.conditions?.some((condition) =>
    ['prone', '倒地'].includes(condition.toLowerCase())) === true
  const standCostFeet = standFromProne ? Math.floor(movementSpeed / 2) : 0
  const baseMovementFeet = shouldFly ? flySpeed : movementSpeed
  const normalMovementBudgetFeet = Math.max(
    0,
    input.movementBudgetFeet ?? baseMovementFeet,
  )
  const dashMovementBudgetFeet = Math.max(
    0,
    input.movementBudgetFeet ?? baseMovementFeet * 2,
  )
  const normalHorizontalFeet = canMove
    ? Math.max(0, Math.min(
        baseMovementFeet,
        normalMovementBudgetFeet,
      ) / dragMovementDivisor -
      verticalCostFeet - standCostFeet)
    : 0
  const dashHorizontalFeet = canMove
    ? Math.max(0, Math.min(
        baseMovementFeet * 2,
        dashMovementBudgetFeet,
      ) / dragMovementDivisor -
      verticalCostFeet - standCostFeet)
    : 0
  const role = monsterTacticalRole(monster)
  const behaviorStyle = dnd5eMonsterEffectiveBehaviorStyle(enemy, role)
  const preferred = preferredDistanceFeet(monster, role, behaviorStyle)
  const targetCell = tokenAnchorCellFromPixel(target.x, target.y, target, map)
  const normalPositions = boundedReachablePositions(
    cachedReachableMonsterPositions({
      start,
      map,
      tokens: map.tokens,
      enemy,
      maxSteps: Math.floor(normalHorizontalFeet / feetPerCell),
      movement: movementProfile,
      cache: input.simulationOptimization?.reachabilityCache,
    }),
    targetCell,
    preferred / feetPerCell,
    input.simulationOptimization?.maxReachablePositions,
  ).filter((reachable) => {
    if (draggedTargets.length === 0) return true
    const delta = {
      x: reachable.position.x - enemy.x,
      y: reachable.position.y - enemy.y,
    }
    return draggedTargets.every((draggedTarget) => !mapGeometryMovementBlocked({
      geometry,
      map,
      token: draggedTarget,
      to: {
        x: draggedTarget.x + delta.x,
        y: draggedTarget.y + delta.y,
      },
      fromElevationFeet: mapGeometryTokenElevation(geometry, draggedTarget),
      toElevationFeet: mapGeometryTokenElevation(geometry, draggedTarget) +
        (desiredElevationFeet - currentElevationFeet),
    }).blocked)
  })
  const actorActiveEffects = tokenActiveEffects(enemy, characters)
  const maximumAttacksPerTurn = dnd5eActiveMaximumAttacksPerTurn(actorActiveEffects)
  const actionOrBonusActionOnly = dnd5eActiveActionOrBonusActionOnly(actorActiveEffects)
  const hasNimbleEscape =
    input.canUseBonusAction &&
    !actionOrBonusActionOnly &&
    monsterHasNimbleEscape(monster)
  const targetHp = targetHitPoints(target, characters)
  const targetAc = targetArmorClass(target, characters)
  const targetIsConcentrating = targetConcentrating(target, characters)
  const targetThreat = enemy.dnd5eCombatState?.monsterThreatByTargetId?.[target.id] ?? 0
  const targetPriorityWeight = target.id === input.preferredTargetId ? 1 : 0
  const candidates: MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] = []
  const normalTacticalMetricsByCell = new Map<string, {
    opportunityRisk: number
    defensiveCoverBonus: number
    targetSupportCount: number
  }>()
  const routeCache = new Map<string, ExactMonsterRoute | null>()
  const hasOpenableClosedDoor = geometry?.doors.some((door) =>
    mapGeometryDoorOpenState(door) === 'closed' &&
    mapGeometryDoorLockState(door) === 'unlocked') === true
  const hasPersistentMovementCost = (map.dnd5ePluginAreas ?? []).some((area) =>
    (area.movementCostMultiplier ?? 1) > 1)
  const exactRouteTreeKey = [
    movementProfile.mode,
    movementProfile.fromElevationFeet,
    movementProfile.toElevationFeet,
    input.simulationOptimization?.candidateRouteTreeMaximumVisited ?? '',
  ].join(':')
  let localExactRouteTree: MapGeometryPathTree | undefined
  const sharedExactRouteTree = () => {
    const cached = input.exactRouteTrees?.get(exactRouteTreeKey)
    if (cached) return cached
    if (localExactRouteTree) return localExactRouteTree
    const maximumMovementCostFeet = Math.max(
      plannerTokenEffectiveSpeed(enemy, dnd5eMonsterMapSpeed(monster)),
      plannerTokenEffectiveFlySpeed(
        enemy,
        monster.speed.fly ?? dnd5eMonsterMapSpeed(monster),
      ),
    ) * 2
    const created = createMapGeometryPathTree({
      geometry,
      map,
      token: enemy,
      allowOpenUnlockedDoors: true,
      canClimb: (monster.speed.climb ?? 0) > 0,
      canSwim: (monster.speed.swim ?? 0) > 0,
      canFly: movementProfile.canFly,
      targetElevationFeet: movementProfile.canFly
        ? movementProfile.toElevationFeet
        : undefined,
      maximumVisited:
        input.simulationOptimization?.candidateRouteTreeMaximumVisited,
      maximumMovementCostFeet,
      additionalDifficultTerrainMultiplier: (token, position) =>
        dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map, token, position }),
      additionalSpeedCostMultiplier: (token, position) =>
        dnd5ePersistentAreaSpeedCostMultiplierAt({ map, token, position }),
    })
    localExactRouteTree = created
    input.exactRouteTrees?.set(exactRouteTreeKey, created)
    return created
  }
  const exactRoute = (
    plan: Dnd5eMonsterTurnPlan,
    reachableSteps: number,
  ): ExactMonsterRoute | undefined => {
    if (
      input.simulationOptimization?.approximateCandidateRoutes &&
      !hasPersistentMovementCost
    ) {
      const movementCostFeet = reachableSteps * feetPerCell +
        (plan.newElevationFeet == null ? 0 : Math.abs(plan.newElevationFeet - currentElevationFeet))
      return {
        movementCostFeet,
        points: plan.newPosition
          ? [{ x: enemy.x, y: enemy.y }, plan.newPosition]
          : [{ x: enemy.x, y: enemy.y }],
      }
    }
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
    let route: ExactMonsterRoute | undefined
    const destinationGroundElevationFeet =
      mapGeometryTerrainElevationAtPoint(geometry, destination)
    const exactTargetElevationFeet = plan.newElevationFeet ?? (
      currentElevationFeet > currentGroundFeet
        ? Math.max(destinationGroundElevationFeet, currentElevationFeet)
        : destinationGroundElevationFeet
    )
    const exactCanFly = (monster.speed.fly ?? 0) > 0 && (
      currentElevationFeet > currentGroundFeet ||
      exactTargetElevationFeet > destinationGroundElevationFeet
    )
    const treeUsesExactMovementPlane =
      exactCanFly === movementProfile.canFly &&
      (
        exactCanFly ||
        currentElevationFeet <= currentGroundFeet
      )
    if (
      input.simulationOptimization?.candidateRouteSearch === 'per-destination' ||
      hasOpenableClosedDoor ||
      !treeUsesExactMovementPlane
    ) {
      route = exactMonsterRouteForPlan(map, enemy, monster, plan)
    } else {
      const routeTree = sharedExactRouteTree()
      const treePath = routeTree.pathTo(destination)
      route = routeTree.truncated
        ? exactMonsterRouteForPlan(map, enemy, monster, plan)
        : exactMonsterRouteFromPath(
            enemy,
            monster,
            plan,
            currentElevationFeet,
            treePath,
          )
    }
    routeCache.set(key, route ?? null)
    return route
  }
  const legalActions = (input.canUseAction ? monster.actions : [])
    .map((action, index) => ({ action, index }))
    .filter(({ action }) =>
      input.requiredActionId == null || action.id === input.requiredActionId)
    .filter(({ action }) =>
      maximumAttacksPerTurn == null ||
      actionSequence(monster, action, enemy)
        .filter((part) => part.attack != null).length <=
        maximumAttacksPerTurn)
    .filter(({ action }) => dnd5eMonsterActionAutomation(action) === 'headless')
    .filter(({ action }) =>
      action.usage?.kind !== 'recharge' ||
      enemy.dnd5eCombatState?.monsterRechargeReadyByActionId?.[action.id] !== false)
    .filter(({ action }) =>
      action.usage?.kind !== 'per-day' ||
      (enemy.dnd5eCombatState?.monsterActionUsesByActionId?.[action.id]?.current ?? action.usage.max) > 0)
    .filter(({ action }) => {
      const resources = {
        rechargeReadyByActionId:
          enemy.dnd5eCombatState?.monsterRechargeReadyByActionId,
        usesByActionId:
          enemy.dnd5eCombatState?.monsterActionUsesByActionId,
      }
      const composite = prepareDnd5eMonsterCompositeRuntimePlan(
        monster,
        action,
      )
      if (!composite) {
        return dnd5eMonsterMultiattackChildResourcesAvailable(
          monster,
          action,
          resources,
        )
      }
      return composite.children.every((child) =>
        child.skipPolicy === 'when-resource-unavailable' ||
        dnd5eMonsterCompositeChildResourceAvailable(child, resources))
    })
    .filter(({ action }) =>
      action.relationRequirement?.kind !== 'none-from-source' ||
      sourceLinkedRelationTargets({
        map,
        characters,
        sourceActorId: enemy.id,
        slotGroup: action.relationRequirement.slotGroup,
        reconciledActiveEffects: input.reconciledActiveEffects,
      }).length === 0)
  const legalAreaActions = input.canUseAction
    ? legalActions.flatMap(({ action, index }) => action.rule?.kind === 'area-saving-throw'
      ? dnd5eMonsterAreaSavingThrowVariants(action).map((variant) => ({
          action,
          index,
          rule: variant,
        }))
      : [])
    : []
  const legalSpells = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' ||
      spell.castingTime === 'reaction' ||
      (spell.castingTime === 'action' && !input.canUseAction) ||
      (spell.castingTime === 'bonus-action' && !input.canUseBonusAction)
    ) return []
    return dnd5eAvailableMonsterSpellSlotLevels({ monster, token: enemy, spell: listedSpell })
      .map((slotLevel) => ({ listedSpell, spell, slotLevel }))
  })

  for (const reachable of normalPositions) {
    const moved = reachable.steps > 0 || desiredElevationFeet !== currentElevationFeet
    const at = {
      ...enemy,
      ...(moved ? reachable.position : {}),
      ...(shouldFly ? { elevationFeet: desiredElevationFeet } : {}),
    }
    const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, at, target)
    const opportunityRiskAt = moved ? opportunityAttackRisk(map, enemy, at) : 0
    const defensiveCoverBonusAt = defensiveCoverBonusAgainstTarget(map, at, target)
    const targetSupportCountAt = targetSupportCount(map, at, target)
    normalTacticalMetricsByCell.set(
      `${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
      {
        opportunityRisk: opportunityRiskAt,
        defensiveCoverBonus: defensiveCoverBonusAt,
        targetSupportCount: targetSupportCountAt,
      },
    )
    for (const { action, index } of legalActions) {
      const targetOccurrences = allocateMonsterActionTargets({
        map,
        monster,
        action,
        attacker: at,
        preferredTarget: target,
        characters,
        reconciledActiveEffects: input.reconciledActiveEffects,
      })
      if (!targetOccurrences) continue
      const attackValue = actionExpectedValue({
        map,
        monster,
        action,
        attacker: at,
        target,
        targetOccurrences,
        characters,
        distanceFeet,
        combatId: input.combatId,
        round: input.round,
        reconciledActiveEffects: input.reconciledActiveEffects,
      })
      if (!attackValue) continue
      const usesNimbleEscape = hasNimbleEscape && opportunityRiskAt > 0
      const plan: Dnd5eMonsterTurnPlan = {
        ...(attackValue.firstAttack
          ? attackPreview(
              action,
              monster,
              attackValue.firstAttack,
              target,
              index,
              moved,
              moved ? reachable.position : undefined,
              shouldFly && moved ? desiredElevationFeet : undefined,
              moved ? movementProfile.mode : undefined,
            )
          : {
              moved,
              newPosition: moved ? reachable.position : undefined,
              newElevationFeet:
                shouldFly && moved ? desiredElevationFeet : undefined,
              movementMode: moved ? movementProfile.mode : undefined,
              attacked: true,
              targetTokenId: target.id,
              targetCharacterId: target.characterId,
              actionIndex: index,
              message:
                `${monster.name}${moved ? '移动后' : ''}使用` +
                `${action.name}，目标为 ${target.label}。`,
            }),
        attackerTokenId: enemy.id,
        attackTargetTokenIds: targetOccurrences.map((occurrence) =>
          occurrence.target.id),
        nimbleEscape: usesNimbleEscape ? 'disengage' as const : undefined,
      }
      const route = exactRoute(plan, reachable.steps)
      if (!route) continue
      const kind = !moved ? 'attack'
        : distanceFeet > startDistanceFeet ? 'retreat-attack'
          : 'move-attack'
      candidates.push({
        id:
          `${kind}:${target.id}:${index}:` +
          `${plan.attackTargetTokenIds?.join(',') ?? target.id}:` +
          `${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
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
          targetSupportCount: targetSupportCountAt,
          hitProbability: attackValue.hitProbability,
          controlValue: attackValue.controlValue,
          targetDistanceFeet: distanceFeet,
          preferredDistanceFeet: preferred,
          movementFeet: route.movementCostFeet,
          distanceImprovementFeet: tacticalDistanceImprovement(
            role, startDistanceFeet, distanceFeet, preferred,
          ),
          defensiveCoverBonus: defensiveCoverBonusAt,
          opportunityAttackRisk: usesNimbleEscape ? 0 : opportunityRiskAt,
          attacksThisTurn: true,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape,
          usesPreciseCoverRoute: moved && defensiveCoverBonusAt > 0,
        },
      })
    }
    for (const { action, index, rule } of legalAreaActions) {
      const outcomeValueByTargetId = new Map<string, {
        expectedAdditionalDamage: number
        controlValue: number
      }>()
      const outcomeValueForTarget = (candidate: Token) => {
        const cached = outcomeValueByTargetId.get(candidate.id)
        if (cached) return cached
        const value = monsterAreaFailedSaveOutcomeValue({
          map,
          attacker: at,
          target: candidate,
          characters,
          rule,
        })
        outcomeValueByTargetId.set(candidate.id, value)
        return value
      }
      const areaPlacement = bestMonsterAreaPlacement({
        map,
        attacker: at,
        focusTarget: target,
        area: rule.area,
        averageDamage: rule.damage?.average ?? 0,
        savingThrow: true,
        targetMode: rule.target,
        minimumHostiles: 1,
        characters,
        canAffectTarget: (candidate) => plannerMonsterAreaRuleAllowsTarget({
          map,
          attacker: at,
          target: candidate,
          characters,
          rule,
        }),
        excludeUnaffectableFromTargetIds: true,
        verticalRuleId: `monster:${action.id}`,
        expectedDamageForTarget: (candidate) => {
          const source = {
            delivery: 'other' as const,
            magical: false,
            sourceMoralAlignment: plannerMoralAlignment(monster.alignment),
          }
          const baseDamage = rule.damage
            ? resolvePlannerDamage(
                candidate,
                rule.damage.average,
                rule.damage.type,
                source,
              )
            : 0
          const fallingDamage = resolvePlannerDamage(
            candidate,
            outcomeValueForTarget(candidate).expectedAdditionalDamage,
            'bludgeoning',
            source,
          )
          return baseDamage + fallingDamage
        },
        controlValueForTarget: (candidate) =>
          outcomeValueForTarget(candidate).controlValue,
      })
      if (!areaPlacement) continue
      const usesNimbleEscape = hasNimbleEscape && opportunityRiskAt > 0
      const plan: Dnd5eMonsterTurnPlan = {
        moved,
        newPosition: moved ? reachable.position : undefined,
        newElevationFeet: shouldFly && moved ? desiredElevationFeet : undefined,
        movementMode: moved ? movementProfile.mode : undefined,
        attacked: false,
        attackerTokenId: enemy.id,
        targetTokenId: target.id,
        targetCharacterId: target.characterId,
        nimbleEscape: usesNimbleEscape ? 'disengage' : undefined,
        areaAction: {
          actionId: action.id,
          variantId: rule.id === 'default' ? undefined : rule.id,
          actionName: rule.id === 'default' ? action.name : `${action.name}：${rule.name}`,
          targetTokenIds: areaPlacement.targetTokenIds,
          area: rule.area,
          areaTargetCell: areaPlacement.targetCell,
          areaTargetElevationFeet: areaPlacement.targetElevationFeet,
          saveAbility: rule.ability,
          saveDc: rule.dc,
          damage: rule.damage ? {
            diceCount: rule.damage.count,
            diceSides: rule.damage.sides,
            damageBonus: rule.damage.bonus,
            damageType: rule.damage.type,
          } : undefined,
          conditionOnFailedSave: rule.conditionOnFailedSave ? {
            condition: rule.conditionOnFailedSave.condition,
            durationRounds: rule.conditionOnFailedSave.durationRounds,
          } : undefined,
        },
        message: `${enemy.label}${moved ? '移动后' : ''}使用${action.name}，范围覆盖 ${areaPlacement.hostileCount} 名敌人。`,
      }
      const route = exactRoute(plan, reachable.steps)
      if (!route) continue
      const kind = !moved ? 'area-action'
        : distanceFeet > startDistanceFeet ? 'retreat-area-action'
          : 'move-area-action'
      candidates.push({
        id: `${kind}:${target.id}:${index}:${rule.id}:${areaPlacement.targetCell.col},${areaPlacement.targetCell.row},${areaPlacement.targetElevationFeet}:${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
        kind,
        payload: plan,
        metrics: {
          expectedDamage: areaPlacement.expectedDamage,
          targetCurrentHp: targetHp.current,
          targetMaximumHp: targetHp.maximum,
          targetArmorClass: targetAc,
          targetPriorityWeight,
          targetThreat,
          targetConcentrating: targetIsConcentrating,
          targetSupportCount: targetSupportCountAt,
          hitProbability: 0.75,
          controlValue:
            rule.conditionOnFailedSave ||
            rule.activeEffectOnFailedSave ||
            rule.forcedMovementOnFailedSave
              ? areaPlacement.controlValue
              : areaPlacement.hostileCount - areaPlacement.friendlyCount > 1
                ? (areaPlacement.hostileCount - areaPlacement.friendlyCount) * 2
                : 0,
          affectedEnemyCount: areaPlacement.hostileCount,
          affectedAllyCount: areaPlacement.friendlyCount,
          resourceCost: action.usage?.kind === 'recharge' ? 5 : action.usage?.kind === 'per-day' ? 8 : 0,
          targetDistanceFeet: distanceFeet,
          preferredDistanceFeet: preferred,
          movementFeet: route.movementCostFeet,
          distanceImprovementFeet: tacticalDistanceImprovement(
            role, startDistanceFeet, distanceFeet, preferred,
          ),
          defensiveCoverBonus: defensiveCoverBonusAt,
          opportunityAttackRisk: usesNimbleEscape ? 0 : opportunityRiskAt,
          attacksThisTurn: true,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape,
          usesPreciseCoverRoute: moved && defensiveCoverBonusAt > 0,
        },
      })
    }
    for (const { spell, slotLevel } of legalSpells) {
      const spellDiceCount = dnd5eSpellDiceCount(
        spell,
        Math.max(1, monster.spellcasting?.casterLevel ?? 1),
        slotLevel,
      )
      const spellAverageRoll = spellDiceCount * (spell.dice.sides + 1) / 2 + spell.dice.bonus
      const areaPlacement = spell.area ? bestMonsterAreaPlacement({
        map,
        attacker: at,
        focusTarget: target,
        area: spell.area,
        areaIncludesSelf: spell.areaIncludesSelf,
        averageDamage: spell.effect === 'sleep-hit-point-pool' ? 0 : spellAverageRoll,
        savingThrow: spell.effect === 'saving-throw' || spell.effect === 'persistent-area',
        targetMode: spell.effect === 'persistent-area' || spell.effect === 'sleep-hit-point-pool'
          ? 'all-creatures-except-self'
          : undefined,
        minimumHostiles: spell.effect === 'sleep-hit-point-pool' ? 1 : undefined,
        characters,
        verticalRuleId: spell.id,
        canAffectTarget: (candidate) => {
          const immunity = dnd5eMonsterLimitedMagicImmunityRule(
            plannerTargetMonster(candidate),
          )
          return (!immunity || slotLevel > immunity.maximumSpellLevel) &&
            (spell.effect !== 'sleep-hit-point-pool' ||
              plannerSleepTargetIsEligible(candidate, characters))
        },
        expectedDamageForTarget: (candidate) => spell.effect === 'sleep-hit-point-pool'
          ? 0
          : resolvePlannerDamage(
              candidate,
              spellAverageRoll + (spell.bonusPerDie ? spellDiceCount : 0),
              spell.damageType ?? 'force',
              {
                delivery: 'spell',
                magical: true,
                sourceMoralAlignment: plannerMoralAlignment(monster.alignment),
                spellLevel: slotLevel,
              },
            ),
        controlValueForTarget: () => 0,
        aggregateControlForTargets: spell.effect === 'sleep-hit-point-pool'
          ? ({ hostiles, friendlies }) => {
              let remainingHitPoints = spellAverageRoll
              const hostileIds = new Set(hostiles.map((candidate) => candidate.id))
              const affectedHostileIds: string[] = []
              const affectedFriendlyIds: string[] = []
              const ordered = [...hostiles, ...friendlies].sort((left, right) =>
                targetHitPoints(left, characters).current -
                  targetHitPoints(right, characters).current ||
                left.id.localeCompare(right.id))
              for (const candidate of ordered) {
                const hp = targetHitPoints(candidate, characters).current
                if (hp > remainingHitPoints) break
                remainingHitPoints -= hp
                if (hostileIds.has(candidate.id)) affectedHostileIds.push(candidate.id)
                else affectedFriendlyIds.push(candidate.id)
              }
              return {
                controlValue:
                  affectedHostileIds.length * 32 - affectedFriendlyIds.length * 32,
                affectedHostileIds,
                affectedFriendlyIds,
              }
            }
          : undefined,
      }) : undefined
      if (spell.area && !areaPlacement) continue
      const spellValue = areaPlacement
        ? {
            expectedDamage: areaPlacement.expectedDamage,
            hitProbability: spell.effect === 'saving-throw' ? 0.75 : 1,
            controlValue: spell.effect === 'persistent-area'
              ? areaPlacement.hostileCount * 4
              : spell.effect === 'sleep-hit-point-pool'
                ? areaPlacement.controlValue
              : areaPlacement.hostileCount > 1 ? areaPlacement.hostileCount * 2 : 0,
          }
        : offensiveMonsterSpellExpectedValue({
            map,
            attacker: at,
            target,
            monster,
            spell,
            slotLevel,
            characters,
          })
      if (!spellValue) continue
      const usesNimbleEscape = hasNimbleEscape && opportunityRiskAt > 0 &&
        spell.castingTime !== 'bonus-action'
      const plan: Dnd5eMonsterTurnPlan = {
        moved,
        newPosition: moved ? reachable.position : undefined,
        newElevationFeet: shouldFly && moved ? desiredElevationFeet : undefined,
        movementMode: moved ? movementProfile.mode : undefined,
        attacked: false,
        attackerTokenId: enemy.id,
        targetTokenId: target.id,
        targetCharacterId: target.characterId,
        nimbleEscape: usesNimbleEscape ? 'disengage' : undefined,
        spellCast: {
          spellId: spell.id,
          spellName: spell.name,
          slotLevel,
          targetTokenIds: spell.effect === 'persistent-area'
            ? []
            : areaPlacement?.targetTokenIds ?? [target.id],
          projectileTargetIds: spell.effect === 'automatic-damage'
            ? Array.from({
                length: dnd5eSpellDiceCount(
                  spell,
                  Math.max(1, monster.spellcasting?.casterLevel ?? 1),
                  slotLevel,
                ),
              }, () => target.id)
            : undefined,
          effect: spell.effect,
          diceCount: spellDiceCount,
          diceSides: spell.dice.sides,
          castingTime: spell.castingTime,
          saveAbility: spell.saveAbility,
          area: spell.area,
          areaTargetCell: areaPlacement?.targetCell,
          areaTargetElevationFeet: areaPlacement?.targetElevationFeet,
        },
        message: areaPlacement
          ? `${enemy.label}${moved ? '移动后' : ''}施放${spell.name}，范围覆盖 ${areaPlacement.hostileCount} 名敌人。`
          : `${enemy.label}${moved ? '移动后' : ''}施放${spell.name}，目标为 ${target.label}。`,
      }
      const route = exactRoute(plan, reachable.steps)
      if (!route) continue
      const kind = !moved ? 'spell'
        : distanceFeet > startDistanceFeet ? 'retreat-spell'
          : 'move-spell'
      candidates.push({
        id: `${kind}:${target.id}:${spell.id}:${slotLevel}:${areaPlacement ? `${areaPlacement.targetCell.col},${areaPlacement.targetCell.row},${areaPlacement.targetElevationFeet}` : 'single'}:${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
        kind,
        payload: plan,
        metrics: {
          expectedDamage: spellValue.expectedDamage,
          targetCurrentHp: targetHp.current,
          targetMaximumHp: targetHp.maximum,
          targetArmorClass: targetAc,
          targetPriorityWeight,
          targetThreat,
          targetConcentrating: targetIsConcentrating,
          targetSupportCount: targetSupportCountAt,
          hitProbability: spellValue.hitProbability,
          controlValue: spellValue.controlValue,
          affectedEnemyCount: areaPlacement?.hostileCount,
          affectedAllyCount: areaPlacement?.friendlyCount,
          resourceCost: spell.level === 0 ? 0 : slotLevel * 3,
          targetDistanceFeet: distanceFeet,
          preferredDistanceFeet: preferred,
          movementFeet: route.movementCostFeet,
          distanceImprovementFeet: tacticalDistanceImprovement(
            role, startDistanceFeet, distanceFeet, preferred,
          ),
          defensiveCoverBonus: defensiveCoverBonusAt,
          opportunityAttackRisk: usesNimbleEscape ? 0 : opportunityRiskAt,
          attacksThisTurn: true,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape,
          usesPreciseCoverRoute: moved && defensiveCoverBonusAt > 0,
        },
      })
    }
  }

  for (const reachable of input.canUseAction ? normalPositions : []) {
    const moved = reachable.steps > 0 || desiredElevationFeet !== currentElevationFeet
    const at = {
      ...enemy,
      ...(moved ? reachable.position : {}),
      ...(shouldFly ? { elevationFeet: desiredElevationFeet } : {}),
    }
    const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, at, target)
    const tacticalMetrics = normalTacticalMetricsByCell.get(
      `${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
    )
    const opportunityRisk = tacticalMetrics?.opportunityRisk ??
      (moved ? opportunityAttackRisk(map, enemy, at) : 0)
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
    const route = exactRoute(plan, reachable.steps)
    if (!route) continue
    const coverBonus = tacticalMetrics?.defensiveCoverBonus ??
      defensiveCoverBonusAgainstTarget(map, at, target)
    const supportCount = tacticalMetrics?.targetSupportCount ?? targetSupportCount(map, at, target)
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

  const hasNormalAttack = candidates.some((candidate) => candidate.metrics.attacksThisTurn)
  const dashPositions = !input.canUseAction ||
    (input.simulationOptimization?.skipDashWhenAttackAvailable && hasNormalAttack)
    ? []
    : boundedReachablePositions(
        cachedReachableMonsterPositions({
          start,
          map,
          tokens: map.tokens,
          enemy,
          maxSteps: Math.floor(dashHorizontalFeet / feetPerCell),
          movement: movementProfile,
          cache: input.simulationOptimization?.reachabilityCache,
        }),
        targetCell,
        preferred / feetPerCell,
        input.simulationOptimization?.maxReachablePositions,
      )
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
    const route = exactRoute(plan, reachable.steps)
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

function createMonsterHealingCandidates(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  characters: readonly Character[]
  canUseAction: boolean
  canUseBonusAction: boolean
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  const { map, enemy, monster, characters } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const healingSpells = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' ||
      spell.effect !== 'healing' ||
      spell.castingTime === 'reaction' ||
      (spell.castingTime === 'action' && !input.canUseAction) ||
      (spell.castingTime === 'bonus-action' && !input.canUseBonusAction)
    ) return []
    return dnd5eAvailableMonsterSpellSlotLevels({ monster, token: enemy, spell: listedSpell })
      .map((slotLevel) => ({ spell, slotLevel }))
  })
  if (healingSpells.length === 0) return []
  const allies = map.tokens.filter((target) => {
    if (target.type === 'obstacle' || areOpposedCombatTokens(enemy, target)) return false
    const hp = targetHitPoints(target, characters)
    if (hp.current <= 0 || hp.current >= hp.maximum) return false
    const targetMonster = target.poolId ? getDnd5eSrdMonster(target.poolId) : undefined
    const creatureType = (targetMonster?.creatureType ?? '').toLowerCase()
    return !['undead', 'construct'].includes(creatureType) &&
      !creatureType.includes('亡灵') &&
      !creatureType.includes('构装')
  })
  return allies.flatMap((target) => healingSpells.flatMap(({ spell, slotLevel }) => {
    const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, enemy, target)
    if (distanceFeet > spell.rangeFeet) return []
    const cover = target.id === enemy.id
      ? undefined
      : mapGeometryCoverBetween(geometry, enemy, target, map)
    if (cover?.blocksLineOfEffect) return []
    const hp = targetHitPoints(target, characters)
    const diceCount = dnd5eSpellDiceCount(
      spell,
      Math.max(1, monster.spellcasting?.casterLevel ?? 1),
      slotLevel,
    )
    const modifier = spell.addSpellcastingModifier && monster.spellcasting?.ability
      ? rules.abilityModifier(monster.abilities[monster.spellcasting.ability])
      : 0
    const expectedHealing = Math.min(
      hp.maximum - hp.current,
      diceCount * (spell.dice.sides + 1) / 2 + spell.dice.bonus + modifier,
    )
    const missingRatio = 1 - hp.current / hp.maximum
    const plan: Dnd5eMonsterTurnPlan = {
      moved: false,
      attacked: false,
      attackerTokenId: enemy.id,
      targetTokenId: target.id,
      targetCharacterId: target.characterId,
      spellCast: {
        spellId: spell.id,
        spellName: spell.name,
        slotLevel,
        targetTokenIds: [target.id],
        effect: spell.effect,
        diceCount,
        diceSides: spell.dice.sides,
        castingTime: spell.castingTime,
      },
      message: `${enemy.label}施放${spell.name}治疗 ${target.label}。`,
    }
    return [{
      id: `heal:${target.id}:${spell.id}:${slotLevel}`,
      kind: 'heal' as const,
      payload: plan,
      metrics: {
        expectedDamage: 0,
        targetCurrentHp: hp.current,
        targetMaximumHp: hp.maximum,
        targetArmorClass: targetArmorClass(target, characters),
        targetPriorityWeight: 0,
        hitProbability: 1,
        supportValue: expectedHealing * 4 + missingRatio * 140,
        resourceCost: spell.level === 0 ? 0 : slotLevel * 3,
        targetDistanceFeet: distanceFeet,
        preferredDistanceFeet: 0,
        movementFeet: 0,
        distanceImprovementFeet: 0,
        defensiveCoverBonus: 0,
        opportunityAttackRisk: 0,
        attacksThisTurn: false,
        consumesAction: true,
        dodges: false,
        dashes: false,
        usesNimbleEscape: false,
        usesPreciseCoverRoute: false,
      },
    }]
  }))
}

function createMonsterHealingTouchCandidates(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  characters: readonly Character[]
  canUseAction: boolean
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  if (!input.canUseAction) return []
  const { map, enemy, monster, characters } = input
  const actorSide = dnd5eCombatTokenSide(enemy)
  if (!actorSide) return []
  const geometry = mapGeometryRuntimeForMap(map.id)
  const actions = monster.actions.filter((action) =>
    action.kind === 'other' &&
    action.rule?.kind === 'healing-touch' &&
    dnd5eMonsterActionAutomation(action) === 'headless' &&
    (
      action.usage?.kind !== 'per-day' ||
      (enemy.dnd5eCombatState?.monsterActionUsesByActionId?.[action.id]?.current ??
        action.usage.max) > 0
    ))
  if (actions.length === 0) return []

  return actions.flatMap<MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>>((action) => {
    const rule = action.rule
    if (rule?.kind !== 'healing-touch') return []
    return map.tokens.flatMap((target) => {
      const targetSide = dnd5eCombatTokenSide(target)
      const hp = targetHitPoints(target, characters)
      if (
        target.id === enemy.id ||
        target.type === 'obstacle' ||
        targetSide !== actorSide ||
        hp.current <= 0 ||
        hp.current >= hp.maximum
      ) return []
      const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, enemy, target)
      if (distanceFeet > rule.rangeFeet) return []
      if (mapGeometryCoverBetween(geometry, enemy, target, map)?.blocksLineOfEffect) return []

      const removable = new Set<string>()
      for (const effect of target.dnd5eCombatState?.activeEffects ?? []) {
        const standard = effect.standardCondition ??
          (effect.legacyCondition ? dnd5eStandardConditionId(effect.legacyCondition) : undefined)
        const legacy = effect.legacyCondition?.trim().toLowerCase()
        if (rule.removes.includes('poisoned') && standard === 'poisoned') removable.add('poisoned')
        if (rule.removes.includes('blinded') && standard === 'blinded') removable.add('blinded')
        if (rule.removes.includes('deafened') && standard === 'deafened') removable.add('deafened')
        if (rule.removes.includes('disease') && ['disease', 'diseased', '疾病'].includes(legacy ?? '')) {
          removable.add('disease')
        }
        if (rule.removes.includes('curse') && ['curse', 'cursed', '诅咒'].includes(legacy ?? '')) {
          removable.add('curse')
        }
      }
      const expectedRawHealing =
        rule.healing.count * (rule.healing.sides + 1) / 2 + rule.healing.bonus
      const effectiveHealing = Math.min(hp.maximum - hp.current, expectedRawHealing)
      const missingRatio = 1 - hp.current / hp.maximum
      const plan: Dnd5eMonsterTurnPlan = {
        moved: false,
        attacked: false,
        attackerTokenId: enemy.id,
        targetTokenId: target.id,
        targetCharacterId: target.characterId,
        specialAction: {
          kind: 'healing-touch',
          actionId: action.id,
          actionName: action.name,
          targetTokenId: target.id,
          healing: {
            diceCount: rule.healing.count,
            diceSides: rule.healing.sides,
            bonus: rule.healing.bonus,
          },
        },
        message: `${enemy.label}使用${action.name}治疗${target.label}。`,
      }
      return [{
        id: `heal-touch:${target.id}:${action.id}`,
        kind: 'heal' as const,
        payload: plan,
        metrics: {
          expectedDamage: 0,
          targetCurrentHp: hp.current,
          targetMaximumHp: hp.maximum,
          targetArmorClass: targetArmorClass(target, characters),
          targetPriorityWeight: 0,
          hitProbability: 1,
          supportValue: effectiveHealing * 4 + missingRatio * 140 + removable.size * 50,
          allyEmergency: missingRatio,
          resourceCost: action.usage?.kind === 'per-day' ? 8 : 0,
          targetDistanceFeet: distanceFeet,
          preferredDistanceFeet: 0,
          movementFeet: 0,
          distanceImprovementFeet: 0,
          defensiveCoverBonus: 0,
          opportunityAttackRisk: 0,
          attacksThisTurn: false,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape: false,
          usesPreciseCoverRoute: false,
        },
      }]
    })
  })
}

/** 规划 SRD 怪物的 5e 回合；所有候选仍须由地图几何与 Headless 权威复核。 */
function createMonsterStructuredSpecialActionCandidates(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  target: Token
  characters: readonly Character[]
  canUseAction: boolean
  requiredActionId?: string
  role: MonsterDecisionContext['tacticalRole']
  behaviorStyle: Dnd5eMonsterBehaviorStyle
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  if (!input.canUseAction) return []
  const { map, enemy, monster, target, characters } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const hp = targetHitPoints(target, characters)
  const targetAc = targetArmorClass(target, characters)
  const startDistanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, enemy, target)
  const preferred = preferredDistanceFeet(monster, input.role, input.behaviorStyle)
  const actions = monster.actions.filter((action) =>
    action.kind === 'other' &&
    dnd5eMonsterActionAutomation(action) === 'headless' &&
    (action.rule?.kind === 'teleport' || action.rule?.kind === 'invisibility') &&
    (input.requiredActionId == null || action.id === input.requiredActionId) &&
    (
      action.usage?.kind !== 'recharge' ||
      enemy.dnd5eCombatState?.monsterRechargeReadyByActionId?.[action.id] !== false
    ) &&
    (
      action.usage?.kind !== 'per-day' ||
      (enemy.dnd5eCombatState?.monsterActionUsesByActionId?.[action.id]?.current ??
        action.usage.max) > 0
    ))
  if (actions.length === 0) return []

  return actions.flatMap<MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>>((action) => {
    const rule = action.rule
    if (rule?.kind === 'invisibility') {
      const alreadyInvisible = targetConditions(enemy, characters).some((condition) =>
        dnd5eStandardConditionId(condition) === 'invisible')
      if (alreadyInvisible || enemy.dnd5eCombatState?.concentrationSpellId) return []
      const actorHp = targetHitPoints(enemy, characters)
      return [{
        id: `special:invisibility:${action.id}`,
        kind: 'support' as const,
        payload: {
          moved: false,
          attacked: false,
          attackerTokenId: enemy.id,
          targetTokenId: target.id,
          specialAction: {
            kind: 'invisibility' as const,
            actionId: action.id,
            actionName: action.name,
          },
          message: `${enemy.label}使用${action.name}进入隐形。`,
        },
        metrics: {
          expectedDamage: 0,
          targetCurrentHp: hp.current,
          targetMaximumHp: hp.maximum,
          targetArmorClass: targetAc,
          hitProbability: 1,
          supportValue: 16 + (1 - actorHp.current / actorHp.maximum) * 24,
          resourceCost: action.usage ? 4 : 0,
          targetDistanceFeet: startDistanceFeet,
          preferredDistanceFeet: preferred,
          movementFeet: 0,
          distanceImprovementFeet: 0,
          defensiveCoverBonus: 0,
          opportunityAttackRisk: 0,
          attacksThisTurn: false,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape: false,
          usesPreciseCoverRoute: false,
        },
      }]
    }
    if (rule?.kind !== 'teleport') return []

    const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
    const columns = Math.max(1, Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize)))
    const rows = Math.max(1, Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize)))
    const startCell = tokenAnchorCellFromPixel(enemy.x, enemy.y, enemy, map)
    const occupied = occupiedCells(map.tokens, map, enemy.id)
    const legal: Array<{
      cell: GridCell
      elevationFeet: number
      targetDistanceFeet: number
      improvement: number
      coverBonus: number
    }> = []
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const cell = { col, row }
        const horizontalDistanceFeet = Math.max(
          Math.abs(col - startCell.col),
          Math.abs(row - startCell.row),
        ) * feetPerCell
        if (horizontalDistanceFeet > rule.rangeFeet + 1e-4) continue
        const position = tokenCenterForAnchorCell(cell, enemy, map)
        const elevationFeet = mapGeometryTerrainElevationAtPoint(geometry, position)
        if (Math.max(
          horizontalDistanceFeet,
          Math.abs(elevationFeet - mapGeometryTokenElevation(geometry, enemy)),
        ) > rule.rangeFeet + 1e-4) continue
        const footprint = tokenOccupiedCellsAt(enemy, map, position)
        if (footprint.some((candidate) =>
          candidate.col < 0 || candidate.row < 0 ||
          candidate.col >= columns || candidate.row >= rows ||
          occupied.has(cellKey(candidate)),
        )) continue
        if (mapGeometryPlacementBlocked({
          geometry,
          map,
          token: enemy,
          at: position,
          elevationFeet,
        }).blocked) continue
        const at = { ...enemy, ...position, elevationFeet }
        if (!mapGeometryCanSeeToken({
          geometry,
          map,
          viewer: enemy,
          target: at,
          forceEnabled: true,
          fallbackRangeFeet: rule.rangeFeet,
        })) continue
        const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, at, target)
        const improvement = tacticalDistanceImprovement(
          input.role,
          startDistanceFeet,
          distanceFeet,
          preferred,
        )
        if (improvement <= 0 && input.requiredActionId == null) continue
        legal.push({
          cell,
          elevationFeet,
          targetDistanceFeet: distanceFeet,
          improvement,
          coverBonus: defensiveCoverBonusAgainstTarget(map, at, target),
        })
      }
    }
    legal.sort((left, right) =>
      right.improvement - left.improvement ||
      right.coverBonus - left.coverBonus ||
      left.targetDistanceFeet - right.targetDistanceFeet ||
      left.cell.row - right.cell.row ||
      left.cell.col - right.cell.col)
    return legal.slice(0, 16).map((destination) => ({
      id: `special:teleport:${action.id}:${destination.cell.col},${destination.cell.row}:${destination.elevationFeet}`,
      kind: 'support' as const,
      payload: {
        moved: false,
        attacked: false,
        attackerTokenId: enemy.id,
        targetTokenId: target.id,
        specialAction: {
          kind: 'teleport' as const,
          actionId: action.id,
          actionName: action.name,
          destinationCell: destination.cell,
          destinationElevationFeet: destination.elevationFeet,
        },
        message: `${enemy.label}使用${action.name}传送到合法可见空位。`,
      },
      metrics: {
        expectedDamage: 0,
        targetCurrentHp: hp.current,
        targetMaximumHp: hp.maximum,
        targetArmorClass: targetAc,
        hitProbability: 1,
        controlValue: Math.min(12, destination.improvement / 5),
        resourceCost: action.usage ? 4 : 0,
        targetDistanceFeet: destination.targetDistanceFeet,
        preferredDistanceFeet: preferred,
        movementFeet: 0,
        distanceImprovementFeet: destination.improvement,
        defensiveCoverBonus: destination.coverBonus,
        opportunityAttackRisk: 0,
        attacksThisTurn: false,
        consumesAction: true,
        dodges: false,
        dashes: false,
        usesNimbleEscape: false,
        usesPreciseCoverRoute: destination.coverBonus > 0,
      },
    }))
  })
}

function createMonsterRestorationCandidates(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  characters: readonly Character[]
  canUseAction: boolean
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  if (!input.canUseAction) return []
  const { map, enemy, monster, characters } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const spells = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      spell.id !== 'lesser-restoration' ||
      spell.effect !== 'remove-condition' ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full'
    ) return []
    return dnd5eAvailableMonsterSpellSlotLevels({ monster, token: enemy, spell: listedSpell })
      .map((slotLevel) => ({ listedSpell, spell, slotLevel }))
  })
  if (spells.length === 0) return []
  const actorSide = dnd5eCombatTokenSide(enemy)
  if (!actorSide) return []
  const conditionPriority = [
    'paralyzed',
    'blinded',
    'poisoned',
    'deafened',
    'disease',
  ] as const

  return map.tokens.flatMap((target) => {
    if (
      target.type === 'obstacle' ||
      dnd5eCombatTokenSide(target) !== actorSide ||
      targetHitPoints(target, characters).current <= 0
    ) return []
    const effects = tokenActiveEffects(target, characters)
    const conditionChoice = conditionPriority.find((condition) => effects.some((effect) => {
      const standard = effect.standardCondition ??
        (effect.legacyCondition ? dnd5eStandardConditionId(effect.legacyCondition) : undefined)
      if (condition === 'disease') {
        return ['disease', 'diseased', '疾病'].includes(
          effect.legacyCondition?.trim().toLowerCase() ?? '',
        )
      }
      return standard === condition
    }))
    if (!conditionChoice) return []

    return spells.flatMap(({ listedSpell, spell, slotLevel }) => {
      const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, enemy, target)
      if (distanceFeet > spell.rangeFeet) return []
      const cover = target.id === enemy.id
        ? undefined
        : mapGeometryCoverBetween(geometry, enemy, target, map)
      if (cover?.blocksLineOfEffect || cover?.cover === 'total') return []
      const hp = targetHitPoints(target, characters)
      const plan: Dnd5eMonsterTurnPlan = {
        moved: false,
        attacked: false,
        attackerTokenId: enemy.id,
        targetTokenId: target.id,
        targetCharacterId: target.characterId,
        spellCast: {
          spellId: spell.id,
          spellName: spell.name,
          slotLevel,
          targetTokenIds: [target.id],
          effect: spell.effect,
          diceCount: 0,
          diceSides: spell.dice.sides,
          castingTime: spell.castingTime,
          conditionChoice,
        },
        message: `${enemy.label}施放${spell.name}，结束${target.label}的${conditionChoice}状态。`,
      }
      return [{
        id: `restore:${target.id}:${spell.id}:${conditionChoice}:${slotLevel}`,
        kind: 'support' as const,
        payload: plan,
        metrics: {
          expectedDamage: 0,
          targetCurrentHp: hp.current,
          targetMaximumHp: hp.maximum,
          targetArmorClass: targetArmorClass(target, characters),
          targetPriorityWeight: 0,
          hitProbability: 1,
          supportValue: conditionChoice === 'paralyzed' ? 110
            : conditionChoice === 'blinded' ? 78
              : conditionChoice === 'poisoned' ? 68
                : 52,
          allyEmergency: 1 - Math.max(0, Math.min(1, hp.current / Math.max(1, hp.maximum))),
          resourceCost: listedSpell.usage?.kind === 'per-day' ? 8 : slotLevel * 3,
          targetDistanceFeet: distanceFeet,
          preferredDistanceFeet: 0,
          movementFeet: 0,
          distanceImprovementFeet: 0,
          defensiveCoverBonus: 0,
          opportunityAttackRisk: 0,
          attacksThisTurn: false,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape: false,
          usesPreciseCoverRoute: false,
        },
      }]
    })
  })
}

function createMonsterProtectionCandidates(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  characters: readonly Character[]
  canUseAction: boolean
  canUseBonusAction: boolean
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  const { map, enemy, monster, characters } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const supportedSpellIds = new Set([
    'barkskin',
    'blur',
    'fly',
    'greater-invisibility',
    'invisibility',
    'longstrider',
    'mage-armor',
    'protection-from-poison',
    'sanctuary',
  ])
  const supportSpells = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      !supportedSpellIds.has(spell.id) ||
      spell.effect !== 'active-effect' ||
      !spell.appliedEffect ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' ||
      (spell.id === 'sanctuary' && (
        !Number.isInteger(monster.spellcasting?.saveDc) ||
        (monster.spellcasting?.saveDc ?? 0) <= 0
      )) ||
      (spell.concentration && enemy.dnd5eCombatState?.concentrationSpellId != null) ||
      spell.castingTime === 'reaction' ||
      (spell.castingTime === 'action' && !input.canUseAction) ||
      (spell.castingTime === 'bonus-action' && !input.canUseBonusAction)
    ) return []
    return dnd5eAvailableMonsterSpellSlotLevels({ monster, token: enemy, spell: listedSpell })
      .map((slotLevel) => ({ listedSpell, spell, slotLevel }))
  })
  if (supportSpells.length === 0) return []

  const actorSide = dnd5eCombatTokenSide(enemy)
  const allies = map.tokens.filter((target) => {
    if (
      target.type === 'obstacle' ||
      !actorSide ||
      dnd5eCombatTokenSide(target) !== actorSide ||
      targetHitPoints(target, characters).current <= 0
    ) return false
    return true
  })

  return allies.flatMap((target) => supportSpells.flatMap(({ listedSpell, spell, slotLevel }) => {
    if (
      (spell.rangeFeet === 0 && target.id !== enemy.id) ||
      target.dnd5eCombatState?.activeEffects?.some((effect) =>
        effect.source.rulesId === spell.id)
    ) return []
    const targetMonster = plannerTargetMonster(target)
    const armorNote = targetMonster?.armorClass.note?.trim().toLowerCase() ?? ''
    const wearingArmor = [
      '皮甲', '兽皮甲', '镶钉皮甲', '链甲衫', '链甲', '鳞甲', '胸甲', '半身板甲',
      '环甲', '板条甲', '条板甲', '板甲', 'leather', 'hide', 'chain', 'scale',
      'breastplate', 'half plate', 'ring mail', 'splint', 'plate',
    ].some((name) => armorNote.includes(name))
    const armorClass = targetArmorClass(target, characters)
    if (
      (spell.id === 'mage-armor' && wearingArmor) ||
      (spell.id === 'barkskin' && armorClass >= 16) ||
      (spell.id === 'fly' && (targetMonster?.speed.fly ?? 0) >= 60)
    ) return []
    const distanceFeet = tokenThreeDimensionalDistanceFeet(map, geometry, enemy, target)
    if (distanceFeet > spell.rangeFeet) return []
    const cover = target.id === enemy.id
      ? undefined
      : mapGeometryCoverBetween(geometry, enemy, target, map)
    if (cover?.blocksLineOfEffect || cover?.cover === 'total') return []
    const hp = targetHitPoints(target, characters)
    const missingRatio = 1 - Math.max(0, Math.min(1, hp.current / Math.max(1, hp.maximum)))
    const nearbyHostiles = map.tokens.filter((candidate) =>
      candidate.type !== 'obstacle' &&
      areOpposedCombatTokens(target, candidate) &&
      targetHitPoints(candidate, characters).current > 0 &&
      tokenThreeDimensionalDistanceFeet(map, geometry, target, candidate) <= 30,
    ).length
    const hasPoisonedCondition = target.dnd5eCombatState?.activeEffects?.some((effect) =>
      effect.standardCondition === 'poisoned' ||
      ['poisoned', '中毒'].includes(effect.legacyCondition?.trim().toLowerCase() ?? '')) === true
    const baseSupportValue = spell.id === 'greater-invisibility' ? 68
      : spell.id === 'invisibility' ? 46
        : spell.id === 'blur' ? 48
          : spell.id === 'fly' ? 38
            : spell.id === 'barkskin' ? 24 + Math.max(0, 16 - armorClass) * 16
              : spell.id === 'mage-armor' ? 42
                : spell.id === 'longstrider' ? 22
                  : spell.id === 'protection-from-poison' ? (hasPoisonedCondition ? 72 : 18)
                    : 28
    const plan: Dnd5eMonsterTurnPlan = {
      moved: false,
      attacked: false,
      attackerTokenId: enemy.id,
      targetTokenId: target.id,
      targetCharacterId: target.characterId,
      spellCast: {
        spellId: spell.id,
        spellName: spell.name,
        slotLevel,
        targetTokenIds: [target.id],
        effect: spell.effect,
        diceCount: 0,
        diceSides: spell.dice.sides,
        castingTime: spell.castingTime,
      },
      message: `${enemy.label}施放${spell.name}保护 ${target.label}。`,
    }
    return [{
      id: `support:${target.id}:${spell.id}:${slotLevel}`,
      kind: 'support' as const,
      payload: plan,
      metrics: {
        expectedDamage: 0,
        targetCurrentHp: hp.current,
        targetMaximumHp: hp.maximum,
        targetArmorClass: targetArmorClass(target, characters),
        targetPriorityWeight: 0,
        hitProbability: 1,
        supportValue: baseSupportValue + missingRatio * 38 + Math.min(3, nearbyHostiles) * 6,
        allyEmergency: missingRatio,
        resourceCost: listedSpell.usage?.kind === 'at-will' || listedSpell.level === 0
          ? 0
          : listedSpell.usage?.kind === 'per-day'
            ? 8
            : slotLevel * 3,
        targetDistanceFeet: distanceFeet,
        preferredDistanceFeet: 0,
        movementFeet: 0,
        distanceImprovementFeet: 0,
        defensiveCoverBonus: 0,
        opportunityAttackRisk: 0,
        attacksThisTurn: false,
        consumesAction: spell.castingTime === 'action',
        dodges: false,
        dashes: false,
        usesNimbleEscape: false,
        usesPreciseCoverRoute: false,
      },
    }]
  }))
}

function createMonsterReleaseCandidates(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  targets: readonly Token[]
  characters: readonly Character[]
  canUseBonusAction: boolean
  canUseAction: boolean
  combatId?: string
  round?: number
  preferredTargetId?: string
  simulationOptimization?: Dnd5eMonsterTurnPlannerOptions['simulationOptimization']
  exactRouteTrees?: Map<string, MapGeometryPathTree>
  reconciledActiveEffects?: PlannerReconciledActiveEffects
  currentTacticalCandidates: readonly MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[]
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  const reconciled = input.reconciledActiveEffects
  if (!reconciled) return []
  const currentIds = new Set(input.currentTacticalCandidates.map((candidate) => candidate.id))
  const candidates = new Map<string, MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>>()

  for (const heldTarget of input.map.tokens) {
    const roots = sourceLinkedGrappleRootEffects(
      heldTarget,
      input.characters,
      reconciled,
    ).filter((effect) => effect.relation?.sourceActorId === input.enemy.id)
    for (const root of roots) {
      const releasedEffects = plannerActiveEffectsAfterRelease(
        reconciled,
        heldTarget.id,
        root.id,
      )
      const unlocked = input.targets.flatMap((target) => createTacticalCandidates({
        map: input.map,
        enemy: input.enemy,
        monster: input.monster,
        target,
        characters: input.characters,
        canUseBonusAction: input.canUseBonusAction,
        canUseAction: input.canUseAction,
        combatId: input.combatId,
        round: input.round,
        preferredTargetId: input.preferredTargetId,
        simulationOptimization: input.simulationOptimization,
        exactRouteTrees: input.exactRouteTrees,
        reconciledActiveEffects: releasedEffects,
      }))
      for (const candidate of unlocked) {
        // Releasing is useful only when it unlocks a new action, target, route,
        // or destination. Avoid tie candidates that would drop a grapple for
        // no tactical gain.
        if (currentIds.has(candidate.id)) continue
        const id = `release-grapple:${heldTarget.id}:${root.id}:${candidate.id}`
        candidates.set(id, {
          ...candidate,
          id,
          payload: {
            ...candidate.payload,
            releaseGrapple: { targetId: heldTarget.id, effectId: root.id },
            message: `${input.enemy.label}释放对${heldTarget.label}的擒抱；${candidate.payload.message}`,
          },
        })
      }
    }
  }
  return [...candidates.values()]
}

export function planDnd5eMonsterTurn(
  map: BattleMap,
  enemy: Token,
  characters: readonly Character[] = [],
  options: Dnd5eMonsterTurnPlannerOptions = {},
): Dnd5eMonsterTurnPlan {
  const monster = enemy.poolId ? getDnd5eSrdMonster(enemy.poolId) : undefined
  if (!monster) return { moved: false, attacked: false, message: `${enemy.label} 缺少 SRD 5.1 stat block。` }
  const reconciledActiveEffects = plannerReconciledActiveEffects(map, characters)
  if (enemy.dnd5eCombatState?.turnedByClericId) {
    const source = map.tokens.find((token) => token.id === enemy.dnd5eCombatState?.turnedByClericId)
    if (!source) {
      return { moved: false, attacked: false, message: `${enemy.label} 处于被驱散状态，本回合不能攻击或进行反应。` }
    }
    const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
    const start = tokenAnchorCellFromPixel(enemy.x, enemy.y, enemy, map)
    const sourceCell = tokenAnchorCellFromPixel(source.x, source.y, source, map)
    const movementCells = isMovementLocked(
      targetConditions(enemy, characters, reconciledActiveEffects),
    )
      ? 0
      : Math.max(0, Math.floor(dnd5eMonsterMapSpeed(monster) * 2 / feetPerCell))
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
  const berserk = enemy.dnd5eCombatState?.monsterBerserk === true &&
    dnd5eMonsterBerserkRule(monster)?.target === 'nearest-visible-creature'
  const excludedTargetIds = new Set(options.excludedTargetIds ?? [])
  const targets = map.tokens.filter((target) =>
    target.id !== enemy.id &&
    target.type !== 'obstacle' &&
    (berserk ? target.id === preferredTarget.id : areOpposedCombatTokens(enemy, target)) &&
    !excludedTargetIds.has(target.id) &&
    (
      options.requiredTargetId == null ||
      target.id === options.requiredTargetId
    ) &&
    targetHitPoints(target, characters).current > 0,
  )
  const role = monsterTacticalRole(monster)
  const behaviorStyle = berserk ? 'aggressive' : dnd5eMonsterEffectiveBehaviorStyle(enemy, role)
  const hp = targetHitPoints(enemy, characters)
  const canUseAction = (options.turnEconomy?.action.current ?? 1) > 0
  const canUseBonusAction = (options.turnEconomy?.bonusAction.current ?? 1) > 0
  const reachabilityCache = options.simulationOptimization?.reachabilityCache ?? {
    reachablePositions: new Map(),
  }
  const simulationOptimization = {
    ...options.simulationOptimization,
    reachabilityCache,
  }
  const exactRouteTrees = new Map<string, MapGeometryPathTree>()
  const tacticalCandidates = targets.flatMap((target) => createTacticalCandidates({
    map,
    enemy,
    monster,
    target,
    characters,
    canUseBonusAction,
    canUseAction,
    combatId: options.combatId,
    round: options.round,
    preferredTargetId: preferredTarget.id,
    requiredActionId: options.requiredActionId,
    movementBudgetFeet: options.movementBudgetFeet,
    simulationOptimization,
    exactRouteTrees,
    reconciledActiveEffects,
  }))
  const structuredSpecialCandidates = createMonsterStructuredSpecialActionCandidates({
    map,
    enemy,
    monster,
    target: preferredTarget,
    characters,
    canUseAction,
    requiredActionId: options.requiredActionId,
    role,
    behaviorStyle,
  })
  const candidates = berserk
    ? tacticalCandidates
    : options.requiredActionId
    ? [...tacticalCandidates, ...structuredSpecialCandidates]
    : [
    ...createMonsterEscapeCandidates({
      map,
      enemy,
      monster,
      characters,
      canUseAction,
      reconciledActiveEffects,
    }),
    ...tacticalCandidates,
    ...structuredSpecialCandidates,
    ...createMonsterReleaseCandidates({
      map,
      enemy,
      monster,
      targets,
      characters,
      canUseBonusAction,
      canUseAction,
      combatId: options.combatId,
      round: options.round,
      preferredTargetId: preferredTarget.id,
      simulationOptimization,
      exactRouteTrees,
      reconciledActiveEffects,
      currentTacticalCandidates: tacticalCandidates,
    }),
    ...createMonsterHealingCandidates({
      map,
      enemy,
      monster,
      characters,
      canUseAction,
      canUseBonusAction,
    }),
    ...createMonsterHealingTouchCandidates({
      map,
      enemy,
      monster,
      characters,
      canUseAction,
    }),
    ...createMonsterRestorationCandidates({
      map,
      enemy,
      monster,
      characters,
      canUseAction,
    }),
    ...createMonsterProtectionCandidates({
      map,
      enemy,
      monster,
      characters,
      canUseAction,
      canUseBonusAction,
    }),
  ]
  const provider = options.decisionProvider ?? DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3
  const ranked = rankMonsterDecisionCandidates(provider, {
    monsterId: monster.id,
    actorTokenId: enemy.id,
    currentHp: hp.current,
    maxHp: hp.maximum,
    tacticalRole: role,
    behaviorStyle,
  }, candidates)
  const selected = options.simulationOptimization?.skipFinalRouteValidation
    ? ranked.find((entry) => Number.isFinite(entry.score))
    : ranked.find((entry) =>
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
      metrics: selected.candidate.metrics,
    },
  }
}
