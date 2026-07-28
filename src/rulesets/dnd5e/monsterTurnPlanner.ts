import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { AbilityKey } from '../../lib/dnd'
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
import { areOpposedCombatTokens, dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, tokensInCells, type SkillAoeTargeting } from '../../lib/skillTargeting'
import {
  mapGeometryCoverBetween,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryLineOfEffectBlocked,
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
  dnd5eMonsterAreaSavingThrowVariants,
  dnd5eMonsterMapSpeed,
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eDamageType,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterWeaponAttack,
} from './monsters'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eMonsterCoreSpellCompatibility } from './monsterAdvancedAbilities'
import { dnd5eAvailableMonsterSpellSlotLevels } from './monsterCoreSpellAction'
import {
  dnd5eCharmPersonEligibleCreatureType,
  dnd5eSpellDiceCount,
  getDnd5eSrdCombatSpell,
  type Dnd5eSrdSpellDefinition,
} from './spells'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import {
  dnd5eConditionIncapacitated,
  dnd5eConditionImposesAttackDisadvantage,
  type Dnd5eStandardConditionId,
} from './conditions'
import {
  dnd5eMonsterEffectiveWeaponAttack,
  dnd5eMonsterLimitedMagicImmunityRule,
  dnd5eMonsterPackTacticsApplies,
  dnd5eMonsterWeaponAttacksAreMagical,
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
} from './pluginAreas'

const monsterTraversalGeometryCache = new WeakMap<
  object,
  NonNullable<ReturnType<typeof mapGeometryRuntimeForMap>>
>()

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
  }
  areaAction?: {
    actionId: string
    /** Stable child effect selected from an action-level shared resource pool. */
    variantId?: string
    actionName: string
    targetTokenIds: readonly string[]
    area: SkillAoeTargeting
    areaTargetCell: GridCell
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

function targetConditions(target: Token, characters: readonly Character[]): readonly string[] {
  const character = target.characterId
    ? characters.find((candidate) => candidate.id === target.characterId)
    : undefined
  return [...new Set([
    ...(character?.conditions ?? []),
    ...(character?.dnd5eCombatState?.activeEffects?.flatMap((effect) =>
      effect.standardCondition ? [effect.standardCondition] : []) ?? []),
    ...(target.dnd5eCombatState?.activeEffects?.flatMap((effect) =>
      effect.standardCondition ? [effect.standardCondition] : []) ?? []),
  ])]
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
    !['spell-attack', 'saving-throw', 'automatic-damage', 'power-word-kill', 'power-word-stun'].includes(spell.effect) ||
    !['hostile', 'creature'].includes(spell.target)
  ) return undefined
  if (spell.id === 'charm-person') {
    const targetIsCharacter = target.characterId != null &&
      characters.some((character) => character.id === target.characterId)
    const targetMonster = target.poolId ? getDnd5eSrdMonster(target.poolId) : undefined
    if (!targetIsCharacter && !dnd5eCharmPersonEligibleCreatureType(targetMonster?.creatureType)) {
      return undefined
    }
    if (
      targetMonster?.conditionImmunities?.some((condition) =>
        ['charmed', '魅惑'].includes(condition.trim().toLowerCase())
      ) ||
      target.dnd5eCombatState?.activeEffects?.some((effect) =>
        effect.standardCondition === 'charmed'
      )
    ) return undefined
  }
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
          conditions: targetConditions(candidate, characters),
        }),
        distanceFeetToTarget: tokenThreeDimensionalDistanceFeet(map, geometry, candidate, target),
      }]
    }),
  })
}

function actionExpectedValue(input: {
  map: BattleMap
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  attacker: Token
  target: Token
  characters: readonly Character[]
  distanceFeet: number
}): {
  expectedDamage: number
  hitProbability: number
  firstAttack: Dnd5eMonsterWeaponAttack
} | undefined {
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
  const packTacticsAdvantage = monsterPackTacticsAdvantage({
    map,
    monster,
    attacker,
    target,
    characters,
  })
  const elevationDeltaFeet =
    mapGeometryTokenElevation(geometry, attacker) -
    mapGeometryTokenElevation(geometry, target)
  const highGroundAdvantage = elevationDeltaFeet >= 10
  const lowGroundDisadvantage = elevationDeltaFeet <= -10
  const attackerConditionDisadvantage = dnd5eConditionImposesAttackDisadvantage({
    attacker: { conditions: targetConditions(attacker, characters) },
    targetDistanceFeet: distanceFeet,
  })
  const targetDodging = targetIsDodging(target, characters)
  let expectedDamage = 0
  let probabilityTotal = 0
  let firstAttack: Dnd5eMonsterWeaponAttack | undefined
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
  for (const child of sequence) {
    if (!child.attack) return undefined
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
    const attack = dnd5eMonsterWeaponAttackAgainstConditions(
      monster,
      distanceAdjustedAttack,
      targetConditions(target, characters),
    )
    firstAttack ??= attack
    const mode = attackModeAtDistance({ ...child, attack }, distanceFeet)
    if (!mode.legal) return undefined
    const nearbyHostile = mode.ranged && map.tokens.some((candidate) =>
      candidate.id !== attacker.id && candidate.type !== 'obstacle' && areOpposedCombatTokens(attacker, candidate) &&
      tokenThreeDimensionalDistanceFeet(map, geometry, attacker, candidate) <= 5,
    )
    const baseProbability = Math.max(0.05, Math.min(0.95, (21 + attack.toHit - targetAc) / 20))
    const advantaged = packTacticsAdvantage || highGroundAdvantage
    const disadvantaged =
      mode.longRange ||
      nearbyHostile ||
      lowGroundDisadvantage ||
      attackerConditionDisadvantage ||
      targetDodging
    const hitProbability = advantaged === disadvantaged
      ? baseProbability
      : advantaged
        ? 1 - (1 - baseProbability) ** 2
        : baseProbability ** 2
    const weaponDamage = attack.damage.reduce((sum, entry) =>
      sum + resolvePlannerDamage(
        target,
        entry.average,
        entry.type,
        weaponDamageSource,
      ), 0)
    const onHitDamage = (attack.onHitEffects ?? []).reduce((effectSum, effect) => {
      const modifier = targetSavingThrowModifier(target, characters, effect.ability)
      const successProbability = Math.max(
        0.05,
        Math.min(0.95, (21 + modifier - effect.dc) / 20),
      )
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
    expectedDamage += (weaponDamage + onHitDamage) * hitProbability
    probabilityTotal += hitProbability
  }
  if (!firstAttack) return undefined
  return {
    expectedDamage,
    hitProbability: probabilityTotal / sequence.length,
    firstAttack,
  }
}

interface MonsterAreaPlacement {
  targetCell: GridCell
  targetTokenIds: string[]
  hostileCount: number
  expectedDamage: number
}

function bestMonsterAreaPlacement(input: {
  map: BattleMap
  attacker: Token
  focusTarget: Token
  area: SkillAoeTargeting
  areaIncludesSelf?: boolean
  averageDamage: number
  savingThrow: boolean
  minimumHostiles?: number
  characters: readonly Character[]
  canAffectTarget?: (target: Token) => boolean
  expectedDamageForTarget?: (target: Token) => number
}): MonsterAreaPlacement | undefined {
  const { map, attacker, focusTarget, area } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const casterCell = tokenAnchorCellFromPixel(attacker.x, attacker.y, attacker, map)
  const focusCell = tokenAnchorCellFromPixel(focusTarget.x, focusTarget.y, focusTarget, map)
  const columns = Math.max(1, Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize)))
  const rows = Math.max(1, Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize)))
  const livingHostileCells = map.tokens
    .filter((token) =>
      token.type !== 'obstacle' &&
      areOpposedCombatTokens(attacker, token) &&
      targetHitPoints(token, input.characters).current > 0)
    .slice(0, 24)
    .map((token) => tokenAnchorCellFromPixel(token.x, token.y, token, map))
  const candidateCells = [focusCell, ...livingHostileCells]
  if (area.origin === 'point') {
    for (let left = 0; left < livingHostileCells.length; left += 1) {
      for (let right = left + 1; right < livingHostileCells.length; right += 1) {
        const first = livingHostileCells[left]
        const second = livingHostileCells[right]
        candidateCells.push({
          col: Math.round((first.col + second.col) / 2),
          row: Math.round((first.row + second.row) / 2),
        })
      }
    }
  }
  const seenAnchors = new Set<string>()
  const boundedCandidates = candidateCells.filter((cell) => {
    if (cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows) return false
    const key = `${cell.col},${cell.row}`
    if (seenAnchors.has(key)) return false
    seenAnchors.add(key)
    return true
  })
  const anchors: GridCell[] = area.origin === 'self'
    ? area.shape === 'circle'
      ? [casterCell]
      : boundedCandidates
    : boundedCandidates
  const averageDamage = input.averageDamage
  let best: (MonsterAreaPlacement & { score: number; key: string }) | undefined
  for (const targetCell of anchors) {
    if (!canPlaceAoe(area, casterCell, targetCell)) continue
    const orientFrom = aoeOrientFromCell(area, casterCell, targetCell)
    const cells = cellsForAoe(area, orientFrom, targetCell)
    const effectOrigin = area.origin === 'point'
      ? {
          x: map.gridOffsetX + (targetCell.col + 0.5) * map.gridSize,
          y: map.gridOffsetY + (targetCell.row + 0.5) * map.gridSize,
        }
      : attacker
    const effectOriginElevation = area.origin === 'point'
      ? mapGeometryTerrainElevationAtPoint(geometry, effectOrigin)
      : mapGeometryTokenElevation(geometry, attacker)
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
    const affected = tokensInCells(map, map.tokens, cells).filter((token) =>
      token.type !== 'obstacle' &&
      (token.id !== attacker.id || input.areaIncludesSelf) &&
      !mapGeometryLineOfEffectBlocked({
        geometry,
        from: effectOrigin,
        to: token,
        fromElevationFeet: effectOriginElevation,
        toElevationFeet: mapGeometryTokenElevation(geometry, token),
      }))
    const friendlies = affected.filter((token) =>
      token.id !== attacker.id && !areOpposedCombatTokens(attacker, token))
    if (friendlies.length > 0) continue
    const hostiles = affected.filter((token) =>
      areOpposedCombatTokens(attacker, token) &&
      targetHitPoints(token, input.characters).current > 0 &&
      (input.canAffectTarget?.(token) ?? true))
    // Spell slots are normally conserved for clusters, but recharge weapons
    // may be worthwhile against a lone priority target.
    if (hostiles.length < (input.minimumHostiles ?? 2) || !hostiles.some((token) => token.id === focusTarget.id)) continue
    const expectedDamage = hostiles.reduce((sum, hostile) =>
      sum + (input.expectedDamageForTarget?.(hostile) ?? averageDamage), 0) *
      (input.savingThrow ? 0.75 : 1)
    const focusBonus = hostiles.some((token) => token.id === focusTarget.id) ? 24 : 0
    const score = expectedDamage + hostiles.length * 40 + focusBonus
    const key = `${targetCell.col},${targetCell.row}`
    if (!best || score > best.score || (score === best.score && key < best.key)) {
      best = {
        targetCell,
        targetTokenIds: affected.map((token) => token.id),
        hostileCount: hostiles.length,
        expectedDamage,
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
  canUseAction: boolean
  preferredTargetId?: string
  simulationOptimization?: Dnd5eMonsterTurnPlannerOptions['simulationOptimization']
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
  const standFromProne = enemy.dnd5eCombatState?.conditions?.some((condition) =>
    ['prone', '倒地'].includes(condition.toLowerCase())) === true
  const standCostFeet = standFromProne ? Math.floor(movementSpeed / 2) : 0
  const normalHorizontalFeet = canMove
    ? Math.max(0, (shouldFly ? flySpeed : movementSpeed) - verticalCostFeet - standCostFeet)
    : 0
  const dashHorizontalFeet = canMove
    ? Math.max(0, (shouldFly ? flySpeed : movementSpeed) * 2 - verticalCostFeet - standCostFeet)
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
  )
  const hasNimbleEscape = input.canUseBonusAction && monsterHasNimbleEscape(monster)
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
  const exactRoute = (
    plan: Dnd5eMonsterTurnPlan,
    reachableSteps: number,
  ): ExactMonsterRoute | undefined => {
    if (input.simulationOptimization?.approximateCandidateRoutes) {
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
    const route = exactMonsterRouteForPlan(map, enemy, monster, plan)
    routeCache.set(key, route ?? null)
    return route
  }
  const legalActions = (input.canUseAction ? monster.actions : [])
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => dnd5eMonsterActionAutomation(action) === 'headless')
    .filter(({ action }) =>
      action.usage?.kind !== 'recharge' ||
      enemy.dnd5eCombatState?.monsterRechargeReadyByActionId?.[action.id] !== false)
    .filter(({ action }) =>
      action.usage?.kind !== 'per-day' ||
      (enemy.dnd5eCombatState?.monsterActionUsesByActionId?.[action.id]?.current ?? action.usage.max) > 0)
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
      const attackValue = actionExpectedValue({
        map, monster, action, attacker: at, target, characters, distanceFeet,
      })
      if (!attackValue) continue
      const usesNimbleEscape = hasNimbleEscape && opportunityRiskAt > 0
      const plan = {
        ...attackPreview(
          action,
          monster,
          attackValue.firstAttack,
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
      const route = exactRoute(plan, reachable.steps)
      if (!route) continue
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
          targetSupportCount: targetSupportCountAt,
          hitProbability: attackValue.hitProbability,
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
      const areaPlacement = bestMonsterAreaPlacement({
        map,
        attacker: at,
        focusTarget: target,
        area: rule.area,
        averageDamage: rule.damage?.average ?? 0,
        savingThrow: true,
        minimumHostiles: rule.conditionOnFailedSave ? 2 : 1,
        characters,
        expectedDamageForTarget: (candidate) => rule.damage
          ? resolvePlannerDamage(
              candidate,
              rule.damage.average,
              rule.damage.type,
              {
                delivery: 'other',
                magical: false,
                sourceMoralAlignment: plannerMoralAlignment(monster.alignment),
              },
            )
          : 0,
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
        id: `${kind}:${target.id}:${index}:${rule.id}:${areaPlacement.targetCell.col},${areaPlacement.targetCell.row}:${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
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
          controlValue: rule.conditionOnFailedSave
            ? areaPlacement.hostileCount * 15.6
            : areaPlacement.hostileCount > 1 ? areaPlacement.hostileCount * 2 : 0,
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
      const areaPlacement = spell.area ? bestMonsterAreaPlacement({
        map,
        attacker: at,
        focusTarget: target,
        area: spell.area,
        areaIncludesSelf: spell.areaIncludesSelf,
        averageDamage: dnd5eSpellDiceCount(
          spell,
          Math.max(1, monster.spellcasting?.casterLevel ?? 1),
          slotLevel,
        ) * (spell.dice.sides + 1) / 2 + spell.dice.bonus,
        savingThrow: spell.effect === 'saving-throw',
        characters,
        canAffectTarget: (candidate) => {
          const immunity = dnd5eMonsterLimitedMagicImmunityRule(
            plannerTargetMonster(candidate),
          )
          return !immunity || slotLevel > immunity.maximumSpellLevel
        },
        expectedDamageForTarget: (candidate) => resolvePlannerDamage(
          candidate,
          dnd5eSpellDiceCount(
            spell,
            Math.max(1, monster.spellcasting?.casterLevel ?? 1),
            slotLevel,
          ) * (spell.dice.sides + 1) / 2 +
            spell.dice.bonus +
            (spell.bonusPerDie
              ? dnd5eSpellDiceCount(
                  spell,
                  Math.max(1, monster.spellcasting?.casterLevel ?? 1),
                  slotLevel,
                )
              : 0),
          spell.damageType ?? 'force',
          {
            delivery: 'spell',
            magical: true,
            sourceMoralAlignment: plannerMoralAlignment(monster.alignment),
            spellLevel: slotLevel,
          },
        ),
      }) : undefined
      if (spell.area && !areaPlacement) continue
      const spellValue = areaPlacement
        ? {
            expectedDamage: areaPlacement.expectedDamage,
            hitProbability: spell.effect === 'saving-throw' ? 0.75 : 1,
            controlValue: areaPlacement.hostileCount > 1 ? areaPlacement.hostileCount * 2 : 0,
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
          targetTokenIds: areaPlacement?.targetTokenIds ?? [target.id],
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
          diceCount: dnd5eSpellDiceCount(
            spell,
            Math.max(1, monster.spellcasting?.casterLevel ?? 1),
            slotLevel,
          ),
          diceSides: spell.dice.sides,
          castingTime: spell.castingTime,
          saveAbility: spell.saveAbility,
          area: spell.area,
          areaTargetCell: areaPlacement?.targetCell,
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
        id: `${kind}:${target.id}:${spell.id}:${slotLevel}:${areaPlacement ? `${areaPlacement.targetCell.col},${areaPlacement.targetCell.row}` : 'single'}:${reachable.cell.col},${reachable.cell.row}:${desiredElevationFeet}`,
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

/** 规划 SRD 怪物的 5e 回合；所有候选仍须由地图几何与 Headless 权威复核。 */
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
  const sanctuarySpells = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      spell.id !== 'sanctuary' ||
      spell.effect !== 'active-effect' ||
      spell.appliedEffect !== 'sanctuary' ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' ||
      !Number.isInteger(monster.spellcasting?.saveDc) ||
      (monster.spellcasting?.saveDc ?? 0) <= 0 ||
      spell.castingTime === 'reaction' ||
      (spell.castingTime === 'action' && !input.canUseAction) ||
      (spell.castingTime === 'bonus-action' && !input.canUseBonusAction)
    ) return []
    return dnd5eAvailableMonsterSpellSlotLevels({ monster, token: enemy, spell: listedSpell })
      .map((slotLevel) => ({ spell, slotLevel }))
  })
  if (sanctuarySpells.length === 0) return []

  const actorSide = dnd5eCombatTokenSide(enemy)
  const allies = map.tokens.filter((target) => {
    if (
      target.type === 'obstacle' ||
      !actorSide ||
      dnd5eCombatTokenSide(target) !== actorSide ||
      targetHitPoints(target, characters).current <= 0
    ) return false
    return !target.dnd5eCombatState?.activeEffects?.some((effect) =>
      effect.definitionId === 'srd-5.1:spell:sanctuary' &&
      effect.source.rulesId === 'sanctuary')
  })

  return allies.flatMap((target) => sanctuarySpells.flatMap(({ spell, slotLevel }) => {
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
        supportValue: 28 + missingRatio * 38 + Math.min(3, nearbyHostiles) * 6,
        allyEmergency: missingRatio,
        resourceCost: slotLevel * 3,
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
  const candidates = [
    ...targets.flatMap((target) => createTacticalCandidates({
    map,
    enemy,
    monster,
    target,
    characters,
    canUseBonusAction: (options.turnEconomy?.bonusAction.current ?? 1) > 0,
    canUseAction: (options.turnEconomy?.action.current ?? 1) > 0,
    preferredTargetId: preferredTarget.id,
    simulationOptimization: options.simulationOptimization,
    })),
    ...createMonsterHealingCandidates({
      map,
      enemy,
      monster,
      characters,
      canUseAction: (options.turnEconomy?.action.current ?? 1) > 0,
      canUseBonusAction: (options.turnEconomy?.bonusAction.current ?? 1) > 0,
    }),
    ...createMonsterProtectionCandidates({
      map,
      enemy,
      monster,
      characters,
      canUseAction: (options.turnEconomy?.action.current ?? 1) > 0,
      canUseBonusAction: (options.turnEconomy?.bonusAction.current ?? 1) > 0,
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
