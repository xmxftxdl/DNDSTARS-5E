import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import {
  mapGeometryCoverBetween,
  mapGeometryLineOfSightBlocked,
  mapGeometryMovementBlocked,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
  setMapGeometryRuntime,
  type MapGeometryState,
} from '../../lib/mapGeometry'
import { getClassResource, syncCharacterClassResources } from '../../lib/classResources'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import {
  dnd5eAttacksPerAttackAction,
  dnd5eClassDefinition,
  dnd5ePactSlotLevel,
  type Dnd5eClassId,
} from './classes'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { dnd5eCharacterClassLevel } from './multiclass'
import {
  dnd5eArmorClass,
  dnd5eMonkMartialArtsEligible,
  dnd5eWeaponAttackProfile,
  dnd5eWeaponDamageSource,
} from './equipment'
import {
  DND5E_SRD_MONSTERS,
  getDnd5eSrdMonster,
  type Dnd5eDamageType,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterBehaviorStyle,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterTargetPriority,
  type Dnd5eMonsterWeaponAttack,
} from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import { dnd5eMonsterCoreSpellCompatibility } from './monsterAdvancedAbilities'
import {
  dnd5eMonsterEffectiveWeaponAttack,
  dnd5eMonsterHasMagicResistance,
  dnd5eMonsterLimitedMagicImmunityRule,
  dnd5eMonsterPackTacticsApplies,
  dnd5eMonsterRechargeActions,
  dnd5eMonsterWeaponAttacksAreMagical,
  dnd5eMonsterWeaponAttackAtDistance,
} from './monsterGenericAbilities'
import {
  dnd5eEligibleMonsterMechanics,
  dnd5eMonsterMechanicDiceRequirements,
} from './monsterAutomation'
import {
  resolveDnd5eDamageDefenses,
  type Dnd5eConditionalDamageDefense,
  type Dnd5eDamageSourceContext,
  type Dnd5eMoralAlignment,
} from './damageDefenses'
import { dnd5eConditionIncapacitated, dnd5eStandardConditionId } from './conditions'
import {
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  dnd5eActiveMagicWeaponBonus,
  dnd5eActiveEffectId,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
  type Dnd5eActiveEffectInstance,
  type Dnd5eActiveEffectSavingThrowRoll,
} from './activeEffects'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { resolveDnd5eAttackOutcome } from './attackResolution'
import { dnd5eForcedMovementFall, dnd5eRepellingBlastPushDestination } from './spellAction'
import { dnd5eFallingDamageDice } from './traversal'
import {
  dnd5eSpellDiceCount,
  dnd5eSelectedCombatSpellIds,
  dnd5eSpellcastingClassIdForSpell,
  getDnd5eSrdCombatSpell,
  type Dnd5eSrdSpellDefinition,
} from './spells'
import {
  DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  rankMonsterDecisionCandidates,
  type MonsterDecisionCandidate,
  type MonsterDecisionContext,
  type MonsterDecisionMetrics,
  type MonsterDecisionProvider,
} from './monsterDecisionProvider'
import {
  planDnd5eMonsterTurn,
  type Dnd5eMonsterSimulationRuntimeCache,
} from './monsterTurnPlanner'
import {
  createDnd5eCombatant,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eCombatantPairKey,
  dnd5eDirectedCombatantPairKey,
  dnd5eHitIsAutomaticCritical,
  dnd5eTargetArmorClassForAttack,
  resolveDnd5eHeadlessAction,
  replaceDnd5eCombatantActiveEffects,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatEvent,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterMechanicRoll,
  type Dnd5eMonsterRechargeRoll,
  type Dnd5eSpellForcedMovement,
} from './headlessCombatEngine'
import { setDnd5eRoomMonsterCatalog } from './roomMonsterCatalog'
import {
  createDnd5eStrategyLearningAccumulator,
  createDnd5eLearnedMonsterDecisionProvider,
  finalizeDnd5eLearnedStrategy,
  observeDnd5eStrategyOutcome,
  type Dnd5eLearnedStrategyProfile,
  type Dnd5eStrategyLearningAccumulator,
} from './monsterStrategyLearning'

export const DND5E_COMBAT_SIMULATION_DEFAULT_TRIALS = 1_000
export const DND5E_COMBAT_SIMULATION_MAX_TRIALS = 100_000

export interface Dnd5eCombatSimulationMonsterSelection {
  monsterId: string
  count: number
}

export interface Dnd5eCombatSimulationRequest {
  characters: readonly Character[]
  monsters: readonly Dnd5eCombatSimulationMonsterSelection[]
  customMonsters?: readonly Dnd5eMonsterStatBlock[]
  trials?: number
  seed?: number
  initialDistanceFeet?: number
  maxRounds?: number
  battlefield?: {
    map: BattleMap
    geometry?: MapGeometryState
  }
  strategyTraining?: {
    enabled: boolean
    explorationRate?: number
    terminalRewardWeight?: number
    /** Fraction reserved for a frozen, exploration-free three-way evaluation. */
    evaluationFraction?: number
  }
}

export interface Dnd5eCombatSimulationConvergencePoint {
  trials: number
  playerWinRate: number
  monsterWinRate: number
  drawRate: number
  averageRounds: number
  playerWinRate95PercentInterval: { low: number; high: number }
}

export interface Dnd5eCombatSimulationEvaluationCohort {
  trials: number
  playerWins: number
  monsterWins: number
  draws: number
  playerWinRate: number
  monsterWinRate: number
  drawRate: number
  averageRounds: number
  playerWinRate95PercentInterval: { low: number; high: number }
}

export interface Dnd5eCombatSimulationStrategyEvaluation {
  trainingTrials: number
  evaluationTrials: number
  baseline: Dnd5eCombatSimulationEvaluationCohort
  learnedPlayers: Dnd5eCombatSimulationEvaluationCohort
  learnedMonsters: Dnd5eCombatSimulationEvaluationCohort
  learnedPlayerWinRateDelta: number
  learnedMonsterWinRateDelta: number
}

export interface Dnd5eCombatSimulationTacticalSummary {
  playerSpellUses: number
  monsterSpellUses: number
  areaActionUses: number
  averageEnemiesHitByAreaAction: number
  areaActionsWithFriendlyFireRisk: number
  emergencySupportUses: number
  healingActions: number
  totalHealing: number
  highGroundAttackUses: number
  lowGroundAttackUses: number
}

export interface Dnd5eCombatSimulationProgress {
  completedTrials: number
  totalTrials: number
  phase: 'training' | 'evaluation'
}

/** Hooks used by the Worker to cooperatively yield between complete trials. */
export interface Dnd5eCombatSimulationAsyncOptions {
  onProgress?: (progress: Dnd5eCombatSimulationProgress) => void
  waitForNextBatch?: () => Promise<void>
}

export interface Dnd5eCombatSimulationRoundSummary {
  round: number
  appearances: number
  averagePlayerDamage: number
  averageMonsterDamage: number
  averagePlayerDeaths: number
  averageMonsterDeaths: number
}

export interface Dnd5eCombatSimulationActionUsage {
  actorName: string
  side: 'players' | 'monsters'
  actionId: string
  actionName: string
  uses: number
  attempts: number
  hits: number
  totalDamage: number
  totalHealing: number
  usesPerTrial: number
  hitRate: number
  averageDamage: number
  averageHealing: number
  headlessTransactions: number
}

export interface Dnd5eCombatSimulationDeathCause {
  victimName: string
  killerName: string
  actionName: string
  count: number
}

export interface Dnd5eCombatSimulationDecisionLog {
  round: number
  turn: number
  actorName: string
  controlledByName?: string
  actorHp: number
  actorMaxHp: number
  actorPositionBefore: { x: number; y: number }
  actorPositionAfter: { x: number; y: number }
  actorElevationBeforeFeet: number
  actorElevationAfterFeet: number
  behaviorStyle: Dnd5eMonsterBehaviorStyle
  targetPriority: Dnd5eMonsterTargetPriority
  providerId: string
  candidateCount: number
  targetName?: string
  actionName?: string
  candidateId: string
  score: number
  reasons: readonly string[]
  candidates: readonly Dnd5eCombatSimulationDecisionCandidateLog[]
  executionSteps: readonly Dnd5eCombatSimulationExecutionStep[]
  outcome: {
    executed: boolean
    hits: number
    damage: number
    headlessTransactions: number
    targetHpBefore?: number
    targetHpAfter?: number
  }
}

export interface Dnd5eCombatSimulationExecutionStep {
  kind: 'turn' | 'movement' | 'resource' | 'roll' | 'damage' | 'condition' | 'transaction' | 'result'
  text: string
}

export interface Dnd5eCombatSimulationDecisionCandidateLog {
  rank: number
  candidateId: string
  kind: MonsterDecisionCandidate<unknown>['kind']
  targetId?: string
  targetName?: string
  actionId?: string
  actionName?: string
  nextPosition: { x: number; y: number; elevationFeet?: number }
  score: number
  selected: boolean
  metrics: Readonly<MonsterDecisionMetrics>
  reasons: readonly string[]
}

export interface Dnd5eCombatSimulationParticipantSummary {
  id: string
  name: string
  side: 'players' | 'monsters'
  appearances: number
  survivalRate: number
  averageDamage: number
  averageRemainingHp: number
}

export interface Dnd5eCombatSimulationCoverage {
  mode: 'quick-estimate' | 'mapped-encounter'
  playerBasicAttackProfiles: number
  playerCount: number
  automatedPlayerSpells: number
  totalPlayerSpells: number
  automatedMonsterActions: number
  totalMonsterActions: number
  automatedMonsterSpells: number
  totalMonsterSpells: number
  percentage: number
  limitations: readonly string[]
}

export interface Dnd5eCombatSimulationResult {
  schemaVersion: 1
  mode: 'quick-estimate' | 'mapped-encounter'
  trials: number
  seed: number
  playerWins: number
  monsterWins: number
  draws: number
  playerWinRate: number
  monsterWinRate: number
  drawRate: number
  playerWinRate95PercentInterval: { low: number; high: number }
  averageRounds: number
  averagePlayerSurvivors: number
  averageMonsterSurvivors: number
  participantSummaries: readonly Dnd5eCombatSimulationParticipantSummary[]
  roundSummaries: readonly Dnd5eCombatSimulationRoundSummary[]
  actionUsage: readonly Dnd5eCombatSimulationActionUsage[]
  deathCauses: readonly Dnd5eCombatSimulationDeathCause[]
  decisionLog: readonly Dnd5eCombatSimulationDecisionLog[]
  headlessTransactionCount: number
  coverage: Dnd5eCombatSimulationCoverage
  learnedStrategy: Dnd5eLearnedStrategyProfile
  convergence: readonly Dnd5eCombatSimulationConvergencePoint[]
  strategyEvaluation?: Dnd5eCombatSimulationStrategyEvaluation
  tacticalSummary: Dnd5eCombatSimulationTacticalSummary
}

interface SimulationAttackPart {
  /** Original SRD attack retained so distance-specific damage stays shared with Headless. */
  monsterAttack?: Dnd5eMonsterWeaponAttack
  /** Parent Multiattack may restrict a hybrid child to one concrete mode. */
  attackModeOverride?: 'melee' | 'ranged'
  toHit: number
  damages: readonly { count: number; sides: number; bonus: number; type: Dnd5eDamageType }[]
  damagesAtHalfHp?: readonly { count: number; sides: number; bonus: number; type: Dnd5eDamageType }[]
  criticalThreshold: number
  mode: 'melee' | 'ranged' | 'melee-or-ranged'
  reachFeet: number
  rangeFeet?: { normal: number; long: number }
  /** Player weapon provenance required by Headless and conditional defenses. */
  weaponId?: string
  finesse?: boolean
  strengthBased?: boolean
  monkMartialArtsEligible?: boolean
}

interface SimulationAction {
  id: string
  name: string
  parts: readonly SimulationAttackPart[]
  usage?: Dnd5eMonsterAction['usage']
  control?: {
    rangeFeet: number
    ability: AbilityKey
    saveDc: number
    condition: string
    preventReactions: boolean
    repeatSaveOnDamage: boolean
    changesAllegiance: boolean
  }
  spell?: {
    id: string
    effect: Dnd5eSrdSpellDefinition['effect']
    saveAbility?: AbilityKey
    saveDc?: number
    attackBonus?: number
    damageOnSuccessfulSave?: 'none' | 'half'
    dice: { count: number; sides: number; bonus: number }
    damageType?: Dnd5eDamageType
    rangeFeet: number
    slotLevel: number
    consumesSpellSlot: boolean
    castingClassId?: Dnd5eClassId
    target: Dnd5eSrdSpellDefinition['target']
    castingTime: Dnd5eSrdSpellDefinition['castingTime']
    healing: boolean
  }
}

interface SimulationActor {
  id: string
  name: string
  side: 'players' | 'monsters'
  deathSaves: {
    stable: boolean
    dead: boolean
  }
  controlledById?: string
  controlImmunities: Set<string>
  maxHp: number
  hp: number
  ac: number
  initiativeBonus: number
  speed: number
  position: number
  positionY: number
  elevationFeet: number
  actions: readonly SimulationAction[]
  behaviorStyle: Dnd5eMonsterBehaviorStyle
  targetPriority: Dnd5eMonsterTargetPriority
  resistances: ReadonlySet<Dnd5eDamageType>
  vulnerabilities: ReadonlySet<Dnd5eDamageType>
  immunities: ReadonlySet<Dnd5eDamageType>
  damageDefenseRules: readonly Dnd5eConditionalDamageDefense[]
  weaponDamageSources?: Readonly<Record<string, {
    magical: boolean
    specialMaterial?: 'silvered' | 'adamantine'
  }>>
  weaponAttacksMagical: boolean
  moralAlignment?: Dnd5eMoralAlignment
  conditionImmunities: ReadonlySet<string>
  activeEffects: Dnd5eActiveEffectInstance[]
  monster?: Dnd5eMonsterStatBlock
  character?: Character
  damageDealt: number
  damageTypesSinceTurn: Set<Dnd5eDamageType>
  perDayUses: Map<string, number>
  rechargeReady: Map<string, boolean>
  spellSlots: Map<number, number>
  savingThrowModifiers: Record<AbilityKey, number>
}

interface SimulationDecision {
  targetId?: string
  targetIds?: readonly string[]
  projectileTargetIds?: readonly string[]
  actionId?: string
  nextPosition: number
  nextPositionY?: number
  nextElevationFeet?: number
  dodges?: boolean
  dashes?: boolean
  candidateId?: string
  score?: number
  reasons?: readonly string[]
  providerId?: string
  /** Retained independently of the full log candidates during batch training. */
  candidateCount?: number
  metrics?: Readonly<MonsterDecisionMetrics>
  candidates?: readonly Omit<Dnd5eCombatSimulationDecisionCandidateLog, 'targetName' | 'actionName'>[]
}

interface SimulationTelemetry {
  roundTotals: Map<number, {
    appearances: number
    playerDamage: number
    monsterDamage: number
    playerDeaths: number
    monsterDeaths: number
  }>
  actionUsage: Map<string, {
    actorName: string
    side: 'players' | 'monsters'
    actionId: string
    actionName: string
    uses: number
    attempts: number
    hits: number
    totalDamage: number
    totalHealing: number
    headlessTransactions: number
  }>
  deathCauses: Map<string, Dnd5eCombatSimulationDeathCause>
  decisionLog: Dnd5eCombatSimulationDecisionLog[]
  headlessTransactionCount: number
  strategyLearning: Dnd5eStrategyLearningAccumulator
  tactical: {
    playerSpellUses: number
    monsterSpellUses: number
    areaActionUses: number
    areaEnemyTargets: number
    areaActionsWithFriendlyFireRisk: number
    emergencySupportUses: number
    healingActions: number
    totalHealing: number
    highGroundAttackUses: number
    lowGroundAttackUses: number
  }
}

interface SimulationExecutionResult {
  handled: boolean
  hits: number
  damage: number
  healing?: number
  transactions: number
  steps?: Dnd5eCombatSimulationExecutionStep[]
}

interface SeededRandom {
  next(): number
  die(sides: number): number
}

interface SimulationReachablePosition {
  x: number
  y: number
  elevationFeet: number
  movementFeet: number
}

interface SimulationRuntimeCache {
  playerReachability: Map<string, readonly SimulationReachablePosition[]>
  monsterReachability: Dnd5eMonsterSimulationRuntimeCache
}

type SimulationBattlefield = NonNullable<Dnd5eCombatSimulationRequest['battlefield']> & {
  runtimeCache?: SimulationRuntimeCache
}

function createSimulationRuntimeCache(): SimulationRuntimeCache {
  return {
    playerReachability: new Map(),
    monsterReachability: { reachablePositions: new Map() },
  }
}

function battlefieldPixelsPerFoot(battlefield?: SimulationBattlefield): number {
  if (!battlefield) return 1
  return Math.max(0.01, battlefield.map.gridSize / Math.max(1, battlefield.map.feetPerCell ?? 5))
}

function actorDistanceFeet(
  left: Pick<SimulationActor, 'position' | 'positionY'> & Partial<Pick<SimulationActor, 'elevationFeet'>>,
  right: Pick<SimulationActor, 'position' | 'positionY'> & Partial<Pick<SimulationActor, 'elevationFeet'>>,
  battlefield?: SimulationBattlefield,
): number {
  const planarFeet = Math.hypot(left.position - right.position, left.positionY - right.positionY) /
    battlefieldPixelsPerFoot(battlefield)
  return Math.hypot(planarFeet, (left.elevationFeet ?? 0) - (right.elevationFeet ?? 0))
}

function moveTowardActor(
  actor: SimulationActor,
  target: SimulationActor,
  distanceFeet: number,
  battlefield?: SimulationBattlefield,
): { x: number; y: number } {
  const dx = target.position - actor.position
  const dy = target.positionY - actor.positionY
  const pixelDistance = Math.hypot(dx, dy)
  if (pixelDistance <= 0) return { x: actor.position, y: actor.positionY }
  const pixels = Math.min(pixelDistance, Math.max(0, distanceFeet) * battlefieldPixelsPerFoot(battlefield))
  return {
    x: actor.position + dx / pixelDistance * pixels,
    y: actor.positionY + dy / pixelDistance * pixels,
  }
}

function seededRandom(seed: number): SeededRandom {
  let state = (Math.floor(seed) || 1) >>> 0
  return {
    next() {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      return (state >>> 0) / 0x1_0000_0000
    },
    die(sides) {
      return 1 + Math.floor(this.next() * Math.max(1, Math.floor(sides)))
    },
  }
}

function exploringDecisionProvider(
  random: SeededRandom,
  explorationRate: number,
  baseProvider: MonsterDecisionProvider = DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
): MonsterDecisionProvider {
  const rate = Math.max(0, Math.min(0.5, explorationRate))
  if (rate <= 0) return baseProvider
  return {
    id: `dnd5e:simulation-exploration-v1:${rate}:${baseProvider.id}`,
    schemaVersion: 1,
    scoreCandidate(context, candidate) {
      const base = baseProvider.scoreCandidate(context, candidate)
      const exploration = (random.next() * 2 - 1) * 80 * rate
      return {
        candidateId: candidate.id,
        score: base.score + exploration,
        reasons: [
          ...base.reasons,
          `模拟探索扰动 ${exploration >= 0 ? '+' : ''}${Math.round(exploration * 10) / 10}`,
        ].slice(0, 12),
      }
    },
  }
}

function actionSequence(monster: Dnd5eMonsterStatBlock, action: Dnd5eMonsterAction): readonly Dnd5eMonsterAction[] {
  if (action.kind !== 'multiattack') return [action]
  return (action.sequence ?? []).flatMap((actionId) => {
    const child = monster.actions.find((candidate) => candidate.id === actionId)
    return child ? [child] : []
  })
}

function simulationMonsterActions(monster: Dnd5eMonsterStatBlock): SimulationAction[] {
  const weaponActions = monster.actions.flatMap((action) => {
    if (dnd5eMonsterActionAutomation(action) !== 'headless') return []
    const parts = actionSequence(monster, action).flatMap((child): SimulationAttackPart[] => {
      if (!child.attack) return []
      return [{
        monsterAttack: child.attack,
        ...(action.kind === 'multiattack' && action.sequenceAttackMode
          ? { attackModeOverride: action.sequenceAttackMode }
          : {}),
        toHit: child.attack!.toHit,
        damages: child.attack.damage.map((damage) => ({
          count: damage.count,
          sides: damage.sides,
          bonus: damage.bonus,
          type: damage.type,
        })),
        damagesAtHalfHp: child.attack.damageAtHalfHp?.map((damage) => ({
          count: damage.count,
          sides: damage.sides,
          bonus: damage.bonus,
          type: damage.type,
        })),
        criticalThreshold: child.attack.criticalThreshold ?? 20,
        mode: action.kind === 'multiattack' && action.sequenceAttackMode
          ? action.sequenceAttackMode
          : child.attack!.mode,
        reachFeet: child.attack!.reachFeet ?? 5,
        rangeFeet: child.attack!.rangeFeet,
      }]
    })
    return parts.length > 0 ? [{
      id: action.id,
      name: action.name,
      parts,
      usage: action.usage,
    }] : []
  })
  const controlActions = monster.actions.flatMap((action): SimulationAction[] => {
    const rule = action.rule
    if (
      action.kind !== 'other' ||
      dnd5eMonsterActionAutomation(action) !== 'headless' ||
      rule?.kind !== 'saving-throw-condition'
    ) return []
    return [{
      id: action.id,
      name: action.name,
      parts: [],
      usage: action.usage,
      control: {
        rangeFeet: rule.rangeFeet,
        ability: rule.ability,
        saveDc: rule.dc,
        condition: rule.condition,
        preventReactions: rule.preventReactions === true,
        repeatSaveOnDamage: rule.repeatSaveOnDamage === true,
        changesAllegiance:
          monster.id === 'srd-5.1:aboleth' &&
          action.id === 'enslave' &&
          rule.condition === 'charmed',
      },
    }]
  })
  const spellActions = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' ||
      spell.onFailedSaveEffect != null ||
      !['spell-attack', 'saving-throw', 'automatic-damage', 'power-word-kill'].includes(spell.effect) ||
      !['hostile', 'creature'].includes(spell.target)
    ) return []
    const slotLevels = listedSpell.usage?.kind === 'at-will' || listedSpell.level === 0
      ? [listedSpell.level]
      : listedSpell.usage?.kind === 'per-day'
        ? [listedSpell.level]
        : Object.keys(monster.spellcasting?.slots ?? {})
            .map(Number)
            .filter((slotLevel) => slotLevel >= listedSpell.level)
    return slotLevels.map((slotLevel): SimulationAction => ({
      id: `spell:${spell.id}:${slotLevel}`,
      name: spell.name,
      parts: [],
      usage: listedSpell.usage?.kind === 'per-day'
        ? { kind: 'per-day', max: listedSpell.usage.max }
        : undefined,
      spell: {
        id: spell.id,
        effect: spell.effect,
        saveAbility: spell.saveAbility,
        saveDc: monster.spellcasting?.saveDc,
        attackBonus: monster.spellcasting?.attackBonus,
        damageOnSuccessfulSave: spell.damageOnSuccessfulSave,
        dice: {
          count: dnd5eSpellDiceCount(
            spell,
            Math.max(1, monster.spellcasting?.casterLevel ?? 1),
            slotLevel,
          ),
          sides: spell.dice.sides,
          bonus: spell.dice.bonus,
        },
        damageType: spell.damageType,
        rangeFeet: spell.rangeFeet,
        slotLevel,
        consumesSpellSlot: listedSpell.usage == null && listedSpell.level > 0,
        target: spell.target,
        castingTime: spell.castingTime,
        healing: false,
      },
    }))
  })
  return [...weaponActions, ...controlActions, ...spellActions]
}

function simulationPlayerWeaponAction(character: Character): SimulationAction {
  const profile = dnd5eWeaponAttackProfile(character)
  const attacks = dnd5eAttacksPerAttackAction(character)
  if (!profile) {
    const strengthModifier = rules.abilityModifier(character.abilities.str)
    return {
      id: 'unarmed-strike',
      name: '徒手打击',
      parts: Array.from({ length: attacks }, () => ({
        toHit: strengthModifier + rules.proficiencyBonus(character.level),
        damages: [{ count: 0, sides: 4, bonus: Math.max(1, 1 + strengthModifier), type: 'bludgeoning' as const }],
        criticalThreshold: 20,
        mode: 'melee' as const,
        reachFeet: 5,
        finesse: false,
        strengthBased: true,
        monkMartialArtsEligible: dnd5eCharacterClassLevel(character, 'monk') >= 1,
      })),
    }
  }
  return {
    id: profile.weaponId,
    name: profile.weaponName,
    parts: Array.from({ length: attacks }, () => ({
      toHit: profile.attackModifier,
      damages: [{ ...profile.damage }],
      criticalThreshold: profile.criticalThreshold,
      mode: profile.mode,
      reachFeet: profile.reachFeet ?? 5,
      rangeFeet: profile.rangeFeet,
      weaponId: profile.weaponId,
      finesse: profile.finesse,
      strengthBased: profile.attackAbility === 'str',
      monkMartialArtsEligible: dnd5eMonkMartialArtsEligible(character),
    })),
  }
}

function playerSpellSlotLevels(character: Character, spell: Dnd5eSrdSpellDefinition): readonly number[] {
  if (spell.level === 0) return [0]
  const standard = Array.from({ length: 9 }, (_, index) => index + 1)
    .filter((level) =>
      level >= spell.level &&
      (getClassResource(character, `dnd5e-spell-slot-${level}`)?.current ?? 0) > 0)
  const classId = dnd5eSpellcastingClassIdForSpell(character, spell.id, undefined, spell.classes)
  const warlockLevel = dnd5eCharacterClassLevel(character, 'warlock')
  const pactLevel = classId === 'warlock' && warlockLevel > 0 &&
    (getClassResource(character, 'dnd5e-pact-slot')?.current ?? 0) > 0
    ? dnd5ePactSlotLevel(warlockLevel)
    : 0
  return [...new Set([...standard, ...(pactLevel >= spell.level ? [pactLevel] : [])])]
}

function simulationPlayerSpellActions(character: Character): readonly SimulationAction[] {
  return dnd5eSelectedCombatSpellIds(character).flatMap((spellId) => {
    const spell = getDnd5eSrdCombatSpell(spellId)
    if (
      !spell ||
      spell.castingTime === 'reaction' ||
      (dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' &&
        spell.onFailedSaveEffect !== 'thunderwave-push') ||
      (spell.onFailedSaveEffect != null && spell.onFailedSaveEffect !== 'thunderwave-push') ||
      ![
        'spell-attack',
        'saving-throw',
        'automatic-damage',
        'healing',
        'fixed-healing',
        'temporary-hit-points',
        'stabilize',
        'remove-condition',
        'active-effect',
        'armor-class-buff',
        'attack-save-buff',
        'attack-save-debuff',
        'mark',
        'power-word-kill',
        'power-word-stun',
      ].includes(spell.effect)
    ) return []
    const castingClassId = dnd5eSpellcastingClassIdForSpell(
      character,
      spell.id,
      undefined,
      spell.classes,
    )
    if (!castingClassId) return []
    const definition = dnd5eClassDefinition(castingClassId)
    const ability = definition?.spellcasting?.ability
    // Headless receives the migrated character, so candidate scoring must use
    // the same normalized ability scores and total level (legacy sheets can
    // otherwise disagree about a spell's save DC).
    const runtimeCharacter = migrateCharacterToDnd5e(character)
    const modifier = ability ? rules.abilityModifier(runtimeCharacter.abilities[ability]) : 0
    const classLevel = Math.max(1, runtimeCharacter.classLevels?.[castingClassId] ??
      dnd5eCharacterClassLevel(character, castingClassId))
    return playerSpellSlotLevels(character, spell).map((slotLevel): SimulationAction => ({
      id: `spell:${spell.id}:${slotLevel}:${castingClassId}`,
      name: spell.name,
      parts: [],
      spell: {
        id: spell.id,
        effect: spell.effect,
        saveAbility: spell.saveAbility,
        saveDc: 8 + rules.proficiencyBonus(runtimeCharacter.level) + modifier,
        attackBonus: rules.proficiencyBonus(runtimeCharacter.level) + modifier,
        damageOnSuccessfulSave: spell.damageOnSuccessfulSave,
        dice: {
          count: dnd5eSpellDiceCount(spell, classLevel, slotLevel),
          sides: spell.dice.sides,
          bonus: spell.dice.bonus + (spell.addSpellcastingModifier ? modifier : 0),
        },
        damageType: spell.damageType,
        rangeFeet: spell.rangeFeet,
        slotLevel,
        consumesSpellSlot: slotLevel > 0,
        castingClassId,
        target: spell.target,
        castingTime: spell.castingTime,
        healing: ['healing', 'fixed-healing', 'temporary-hit-points', 'stabilize'].includes(spell.effect),
      },
    }))
  })
}

function simulationPlayerActions(character: Character): readonly SimulationAction[] {
  return [simulationPlayerWeaponAction(character), ...simulationPlayerSpellActions(character)]
}

function inferMonsterStyle(monster: Dnd5eMonsterStatBlock): Dnd5eMonsterBehaviorStyle {
  const actions = simulationMonsterActions(monster)
  const parts = actions.flatMap((action) => action.parts)
  const hasMelee = parts.some((part) => part.mode !== 'ranged')
  const hasRanged = parts.some((part) => part.mode !== 'melee' && (part.rangeFeet?.normal ?? 0) >= 20) ||
    actions.some((action) => (action.spell?.rangeFeet ?? 0) >= 20)
  if (hasMelee && hasRanged) return 'skirmisher'
  return hasRanged ? 'defensive' : 'aggressive'
}

function simulationMoralAlignment(alignment: unknown): Dnd5eMoralAlignment | undefined {
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

function simulationActiveEffects(
  targetId: string,
  conditions: readonly string[] | undefined,
  existing: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveEffectInstance[] {
  const effects = normalizeDnd5eActiveEffects(existing)
  const represented = new Set(effects.flatMap((effect) => [
    effect.standardCondition ? `standard:${effect.standardCondition}` : '',
    effect.legacyCondition ? `custom:${effect.legacyCondition.trim().toLowerCase()}` : '',
  ].filter(Boolean)))
  for (const raw of conditions ?? []) {
    const value = raw.trim()
    if (!value) continue
    const standard = dnd5eStandardConditionId(value)
    const key = standard ? `standard:${standard}` : `custom:${value.toLowerCase()}`
    if (represented.has(key)) continue
    represented.add(key)
    effects.push(standard
      ? createDnd5eConditionEffect({
          id: dnd5eActiveEffectId('simulation-condition', targetId, standard),
          condition: standard,
          source: { kind: 'system', rulesId: 'combat-simulation', label: '战斗模拟' },
          targetId,
          appliedAt: 0,
          duration: { type: 'permanent' },
          stackingPolicy: 'reject',
        })
      : createDnd5eMechanicalEffect({
          id: dnd5eActiveEffectId('simulation-condition', targetId, value),
          definitionId: `simulation-condition:${value}`,
          label: value,
          source: { kind: 'system', rulesId: 'combat-simulation', label: '战斗模拟' },
          targetId,
          appliedAt: 0,
          duration: { type: 'permanent' },
          stackingPolicy: 'reject',
          legacyCondition: value,
        }))
  }
  return effects
}

function playerActor(character: Character, token?: Token): SimulationActor {
  const actions = simulationPlayerActions(character)
  const runtimeCharacter = migrateCharacterToDnd5e(character)
  const maxHp = Math.max(1, Math.floor(character.maxHp))
  const hp = Math.max(0, Math.floor(token?.hp ?? character.currentHp ?? character.maxHp))
  const defenseSnapshot = createCombatantFromDnd5eCharacter({
    character: runtimeCharacter,
    controller: 'player',
    initiativeD20: 10,
    position: { x: token?.x ?? 0, y: token?.y ?? 0 },
  })
  const equippedWeaponSource = dnd5eWeaponDamageSource(character.equipment?.mainWeapon)
  const weaponDamageSources = equippedWeaponSource
    ? {
        [equippedWeaponSource.weaponId]: {
          magical: equippedWeaponSource.magical,
          ...(equippedWeaponSource.specialMaterial
            ? { specialMaterial: equippedWeaponSource.specialMaterial }
            : {}),
        },
      }
    : undefined
  const spellSlots = new Map<number, number>()
  for (const action of actions) {
    const spell = action.spell
    if (!spell || spell.slotLevel < 1) continue
    const resourceKey = spell.castingClassId === 'warlock'
      ? 'dnd5e-pact-slot'
      : `dnd5e-spell-slot-${spell.slotLevel}`
    spellSlots.set(
      spell.slotLevel,
      Math.max(
        spellSlots.get(spell.slotLevel) ?? 0,
        getClassResource(character, resourceKey)?.current ?? 0,
      ),
    )
  }
  return {
    id: token?.id ?? `player:${character.id}`,
    name: character.name,
    side: 'players',
    deathSaves: { stable: false, dead: hp === 0 },
    controlImmunities: new Set(),
    maxHp,
    hp,
    ac: dnd5eArmorClass(character),
    initiativeBonus: rules.abilityModifier(character.abilities.dex) + character.initiativeBonus,
    speed: Math.max(0, character.speed),
    position: token?.x ?? 0,
    positionY: token?.y ?? 0,
    elevationFeet: token?.elevationFeet ?? 0,
    actions,
    behaviorStyle: 'balanced',
    targetPriority: 'lowest-hp-percentage',
    resistances: new Set(defenseSnapshot.damageResistances),
    vulnerabilities: new Set(defenseSnapshot.damageVulnerabilities),
    immunities: new Set(defenseSnapshot.damageImmunities),
    damageDefenseRules: defenseSnapshot.damageDefenseRules.map((rule) => ({
      ...rule,
      damageTypes: rule.damageTypes ? [...rule.damageTypes] : undefined,
    })),
    weaponDamageSources,
    weaponAttacksMagical: false,
    moralAlignment: simulationMoralAlignment(character.alignment),
    conditionImmunities: new Set(defenseSnapshot.conditionImmunities),
    activeEffects: simulationActiveEffects(
      token?.id ?? `player:${character.id}`,
      character.conditions,
      [
        ...(character.dnd5eCombatState?.activeEffects ?? []),
        ...(token?.dnd5eCombatState?.activeEffects ?? []),
      ],
    ),
    character,
    damageDealt: 0,
    damageTypesSinceTurn: new Set(),
    perDayUses: new Map(),
    rechargeReady: new Map(),
    spellSlots,
    savingThrowModifiers: Object.fromEntries(
      Object.entries(character.abilities).map(([ability, score]) => [
        ability,
        rules.abilityModifier(score) +
          (character.savingThrows.includes(ability as AbilityKey)
            ? rules.proficiencyBonus(character.level)
            : 0),
      ]),
    ) as Record<AbilityKey, number>,
  }
}

function monsterActor(
  monster: Dnd5eMonsterStatBlock,
  index: number,
  initialDistanceFeet: number,
  token?: Token,
): SimulationActor {
  const actions = simulationMonsterActions(monster)
  const hp = Math.max(0, Math.floor(token?.hp ?? monster.hitPoints.average))
  const stableAtZero = hp === 0 && token?.dnd5eCombatState?.stableAtZero === true
  return {
    id: token?.id ?? `monster:${monster.id}:${index}`,
    name: monster.name,
    side: 'monsters',
    deathSaves: {
      stable: stableAtZero,
      dead: hp === 0 && !stableAtZero,
    },
    controlImmunities: new Set(),
    maxHp: Math.max(1, monster.hitPoints.average),
    hp,
    ac: monster.armorClass.value,
    initiativeBonus: rules.abilityModifier(monster.abilities.dex),
    speed: Math.max(monster.speed.walk, monster.speed.fly ?? 0, monster.speed.swim ?? 0),
    position: token?.x ?? initialDistanceFeet,
    positionY: token?.y ?? 0,
    elevationFeet: token?.elevationFeet ?? 0,
    actions,
    behaviorStyle: inferMonsterStyle(monster),
    targetPriority: monster.targetingPreference?.priority ?? 'nearest',
    resistances: new Set(monster.damageResistances ?? []),
    vulnerabilities: new Set(monster.damageVulnerabilities ?? []),
    immunities: new Set(monster.damageImmunities ?? []),
    damageDefenseRules: (monster.damageDefenseRules ?? []).map((rule) => ({
      ...rule,
      damageTypes: rule.damageTypes ? [...rule.damageTypes] : undefined,
    })),
    weaponAttacksMagical: dnd5eMonsterWeaponAttacksAreMagical(monster),
    moralAlignment: simulationMoralAlignment(monster.alignment),
    conditionImmunities: new Set(monster.conditionImmunities ?? []),
    activeEffects: simulationActiveEffects(
      token?.id ?? `monster:${monster.id}:${index}`,
      [],
      token?.dnd5eCombatState?.activeEffects,
    ),
    monster,
    damageDealt: 0,
    damageTypesSinceTurn: new Set(),
    perDayUses: new Map(actions.flatMap((action) =>
      action.usage?.kind === 'per-day' ? [[action.id, action.usage.max] as const] : [])),
    rechargeReady: new Map(actions.flatMap((action) =>
      action.usage?.kind === 'recharge' ? [[action.id, true] as const] : [])),
    spellSlots: new Map(Object.entries(monster.spellcasting?.slots ?? {})
      .map(([level, count]) => [Number(level), count])),
    savingThrowModifiers: Object.fromEntries(
      Object.entries(monster.abilities).map(([ability, score]) => [
        ability,
        monster.savingThrows?.[ability as AbilityKey] ?? rules.abilityModifier(score),
      ]),
    ) as Record<AbilityKey, number>,
  }
}

function actionMaximumRange(action: SimulationAction): number {
  if (action.spell) return action.spell.rangeFeet
  if (action.control) return action.control.rangeFeet
  return Math.max(...action.parts.map((part) =>
    part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.long ?? part.reachFeet))
}

function actionNormalRange(action: SimulationAction): number {
  if (action.spell) return action.spell.rangeFeet
  if (action.control) return action.control.rangeFeet
  return Math.max(...action.parts.map((part) =>
    part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.normal ?? part.reachFeet))
}

function simulationAttackPartAtDistance(
  part: SimulationAttackPart,
  distanceFeet: number,
  actorHpRatio: number,
): SimulationAttackPart {
  if (!part.monsterAttack) return part
  const hpAdjusted = dnd5eMonsterEffectiveWeaponAttack(
    part.monsterAttack,
    Math.max(0, actorHpRatio),
    1,
  )
  const adjusted = dnd5eMonsterWeaponAttackAtDistance(
    hpAdjusted,
    distanceFeet,
    part.attackModeOverride,
  )
  return {
    ...part,
    toHit: adjusted.toHit,
    damages: adjusted.damage.map(({ count, sides, bonus, type }) => ({
      count,
      sides,
      bonus,
      type,
    })),
    damagesAtHalfHp: undefined,
    criticalThreshold: adjusted.criticalThreshold ?? 20,
    mode: adjusted.mode,
    reachFeet: adjusted.reachFeet ?? 5,
    rangeFeet: adjusted.rangeFeet,
  }
}

type SimulationDamageSourceDetails = Omit<Dnd5eDamageSourceContext, 'damageType'>

function simulationWeaponDamageSource(
  actor: SimulationActor,
  action: SimulationAction,
): SimulationDamageSourceDetails {
  const equipped = actor.weaponDamageSources?.[action.id]
  const monkMagicUnarmed = action.id === 'unarmed-strike' &&
    actor.character != null &&
    dnd5eCharacterClassLevel(actor.character, 'monk') >= 6
  const activeMagicWeapon = dnd5eActiveMagicWeaponBonus(actor.activeEffects, action.id) > 0
  const activeShillelagh = actor.activeEffects.some((effect) =>
    effect.modifiers?.shillelagh?.weaponId === action.id)
  const sacredWeapon = actor.character?.equipment?.mainWeapon?.id === action.id &&
    (actor.character.dnd5eCombatState?.sacredWeaponTurnsRemaining ?? 0) > 0
  return {
    delivery: 'weapon-attack',
    magical: equipped?.magical === true || actor.weaponAttacksMagical || monkMagicUnarmed ||
      activeMagicWeapon || activeShillelagh || sacredWeapon,
    ...(equipped?.specialMaterial ? { weaponMaterial: equipped.specialMaterial } : {}),
    sourceMoralAlignment: actor.moralAlignment,
  }
}

function simulationSpellDamageSource(
  actor: SimulationActor,
  spellLevel: number,
): SimulationDamageSourceDetails {
  return {
    delivery: 'spell',
    magical: true,
    sourceMoralAlignment: actor.moralAlignment,
    spellLevel,
  }
}

function resolveSimulationDamage(
  target: SimulationActor,
  rawDamage: number,
  type: Dnd5eDamageType,
  source: SimulationDamageSourceDetails,
): number {
  return resolveDnd5eDamageDefenses({
    damage: Math.max(0, rawDamage),
    source: { damageType: type, ...source },
    defenses: {
      immunities: [...target.immunities],
      resistances: [...target.resistances],
      vulnerabilities: [...target.vulnerabilities],
      damageDefenseRules: target.damageDefenseRules,
    },
  }).finalDamage
}

function simulationLimitedMagicImmunityNegates(
  target: SimulationActor,
  spellLevel: number,
): boolean {
  const rule = dnd5eMonsterLimitedMagicImmunityRule(target.monster)
  return rule != null && spellLevel <= rule.maximumSpellLevel
}

function actionExpectedDamage(
  action: SimulationAction,
  actor: SimulationActor,
  target: SimulationActor,
  distanceFeet: number,
  actorHpRatio = 1,
  attackMode: 'normal' | 'advantage' | 'disadvantage' = 'normal',
): {
  expectedDamage: number
  hitProbability: number
} | undefined {
  if (action.control) {
    if (
      distanceFeet > action.control.rangeFeet ||
      target.conditionImmunities.has(action.control.condition)
    ) return undefined
    const modifier = target.savingThrowModifiers[action.control.ability]
    const successProbability = Math.max(
      0.05,
      Math.min(0.95, (21 + modifier - action.control.saveDc) / 20),
    )
    return { expectedDamage: 0, hitProbability: 1 - successProbability }
  }
  if (action.spell) {
    const spell = action.spell
    if (distanceFeet > spell.rangeFeet) return undefined
    if (simulationLimitedMagicImmunityNegates(target, spell.slotLevel)) {
      return { expectedDamage: 0, hitProbability: 0 }
    }
    if (spell.effect === 'power-word-kill') {
      return target.hp <= 100
        ? { expectedDamage: target.hp, hitProbability: 1 }
        : undefined
    }
    if (spell.effect === 'automatic-damage') {
      const average = spell.dice.count * ((spell.dice.sides + 1) / 2 + 1) + spell.dice.bonus
      return {
        expectedDamage: resolveSimulationDamage(
          target,
          average,
          spell.damageType ?? 'force',
          simulationSpellDamageSource(actor, spell.slotLevel),
        ),
        hitProbability: 1,
      }
    }
    const average = spell.dice.count * (spell.dice.sides + 1) / 2 + spell.dice.bonus
    const adjustedAverage = resolveSimulationDamage(
      target,
      average,
      spell.damageType ?? 'force',
      simulationSpellDamageSource(actor, spell.slotLevel),
    )
    if (spell.effect === 'spell-attack' && spell.attackBonus != null) {
      const base = Math.max(0.05, Math.min(0.95, (21 + spell.attackBonus - target.ac) / 20))
      const baseMode = distanceFeet <= 5 ? 'disadvantage' : attackMode
      const hitProbability = baseMode === 'advantage'
        ? 1 - (1 - base) ** 2
        : baseMode === 'disadvantage' ? base ** 2 : base
      return { expectedDamage: adjustedAverage * hitProbability, hitProbability }
    }
    if (spell.effect === 'saving-throw' && spell.saveAbility && spell.saveDc != null) {
      const modifier = target.savingThrowModifiers[spell.saveAbility]
      const successProbability = Math.max(0.05, Math.min(0.95, (21 + modifier - spell.saveDc) / 20))
      const failureProbability = dnd5eMonsterHasMagicResistance(target.monster)
        ? (1 - successProbability) ** 2
        : 1 - successProbability
      const resolvedSuccessProbability = 1 - failureProbability
      const multiplier = failureProbability +
        (spell.damageOnSuccessfulSave === 'half' ? resolvedSuccessProbability / 2 : 0)
      return { expectedDamage: adjustedAverage * multiplier, hitProbability: failureProbability }
    }
    return undefined
  }
  let expectedDamage = 0
  let totalProbability = 0
  for (const sourcePart of action.parts) {
    const part = simulationAttackPartAtDistance(sourcePart, distanceFeet, actorHpRatio)
    const maximum = part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.long ?? 0
    if (distanceFeet > maximum) return undefined
    const base = Math.max(0.05, Math.min(0.95, (21 + part.toHit - target.ac) / 20))
    const normal = part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.normal ?? maximum
    const rangeDisadvantage = distanceFeet > normal || (part.mode !== 'melee' && distanceFeet <= 5)
    const resolvedMode = rangeDisadvantage
      ? attackMode === 'advantage' ? 'normal' : 'disadvantage'
      : attackMode
    const hitProbability = resolvedMode === 'advantage'
      ? 1 - (1 - base) ** 2
      : resolvedMode === 'disadvantage' ? base ** 2 : base
    const damages = actorHpRatio <= 0.5 && part.damagesAtHalfHp
      ? part.damagesAtHalfHp
      : part.damages
    const source = simulationWeaponDamageSource(actor, action)
    const average = damages.reduce((sum, damage) =>
      sum + resolveSimulationDamage(
        target,
        damage.count * (damage.sides + 1) / 2 + damage.bonus,
        damage.type,
        source,
      ), 0)
    expectedDamage += Math.max(0, average) * hitProbability
    totalProbability += hitProbability
  }
  return { expectedDamage, hitProbability: totalProbability / Math.max(1, action.parts.length) }
}

function targetPriorityWeight(
  actor: SimulationActor,
  target: SimulationActor,
  opponents: readonly SimulationActor[],
): number {
  const sorted = [...opponents].sort((left, right) => {
    const primary = (candidate: SimulationActor): number => {
      if (actor.targetPriority === 'lowest-current-hp') return candidate.hp
      if (actor.targetPriority === 'lowest-hp-percentage') return candidate.hp / candidate.maxHp
      if (actor.targetPriority === 'lowest-armor-class') return candidate.ac
      return Math.abs(actor.position - candidate.position)
    }
    return primary(left) - primary(right) ||
      Math.abs(actor.position - left.position) - Math.abs(actor.position - right.position) ||
      left.id.localeCompare(right.id)
  })
  const rank = sorted.findIndex((candidate) => candidate.id === target.id)
  return rank < 0 || opponents.length <= 1 ? 1 : 1 - rank / (opponents.length - 1)
}

function availableAction(actor: SimulationActor, action: SimulationAction): boolean {
  if (
    action.spell?.consumesSpellSlot &&
    (actor.spellSlots.get(action.spell.slotLevel) ?? 0) <= 0
  ) return false
  if (action.usage?.kind === 'per-day') return (actor.perDayUses.get(action.id) ?? 0) > 0
  if (action.usage?.kind === 'recharge') return actor.rechargeReady.get(action.id) !== false
  return true
}

function actionThreatValue(action: SimulationAction): number {
  if (action.control) return 0
  if (action.spell) {
    if (action.spell.effect === 'power-word-kill') return 35
    return Math.max(
      0,
      action.spell.dice.count * (action.spell.dice.sides + 1) / 2 + action.spell.dice.bonus,
    ) * 0.65
  }
  return action.parts.reduce((total, part) =>
    total + part.damages.reduce((sum, damage) =>
      sum + Math.max(0, damage.count * (damage.sides + 1) / 2 + damage.bonus), 0) * 0.65, 0)
}

function controlImmunityKey(sourceId: string, actionId: string): string {
  return `${sourceId}\u0000${actionId}`
}

function effectiveSide(
  actor: SimulationActor,
  actors: readonly SimulationActor[],
): SimulationActor['side'] {
  if (!actor.controlledById) return actor.side
  const controller = actors.find((candidate) =>
    candidate.id === actor.controlledById && candidate.hp > 0)
  return controller?.side ?? actor.side
}

function simulationMonsterPackTacticsAdvantage(
  actor: SimulationActor,
  target: SimulationActor,
  actors: readonly SimulationActor[],
  battlefield?: SimulationBattlefield,
): boolean {
  if (!actor.monster) return false
  const actorSide = effectiveSide(actor, actors)
  return dnd5eMonsterPackTacticsApplies({
    monster: actor.monster,
    actorId: actor.id,
    targetId: target.id,
    candidates: actors.map((candidate) => ({
      id: candidate.id,
      alliedWithActor: effectiveSide(candidate, actors) === actorSide,
      currentHp: candidate.hp,
      incapacitated: dnd5eConditionIncapacitated({
        conditions: dnd5eConditionsFromActiveEffects(candidate.activeEffects),
      }),
      distanceFeetToTarget: actorDistanceFeet(candidate, target, battlefield),
    })),
  })
}

function simulationAttackRollMode(input: {
  baseMode: 'normal' | 'advantage' | 'disadvantage'
  packTacticsAdvantage: boolean
  additionalDisadvantage?: boolean
}): {
  resolvedMode: 'normal' | 'advantage' | 'disadvantage'
  requiresSecondD20: boolean
} {
  const advantage = input.baseMode === 'advantage' || input.packTacticsAdvantage
  const disadvantage =
    input.baseMode === 'disadvantage' ||
    input.additionalDisadvantage === true
  return {
    resolvedMode: advantage === disadvantage
      ? 'normal'
      : advantage ? 'advantage' : 'disadvantage',
    requiresSecondD20: advantage || disadvantage,
  }
}

function elevationAttackMode(
  actor: Pick<SimulationActor, 'elevationFeet'>,
  target: Pick<SimulationActor, 'elevationFeet'>,
  forcedDisadvantage = false,
): 'normal' | 'advantage' | 'disadvantage' {
  const delta = actor.elevationFeet - target.elevationFeet
  const highGround = delta >= 10
  const lowGround = delta <= -10
  if ((highGround && forcedDisadvantage) || (!highGround && !lowGround && !forcedDisadvantage)) {
    return 'normal'
  }
  if (lowGround || forcedDisadvantage) return 'disadvantage'
  return 'advantage'
}

function synchronizeBattlefieldTokens(
  battlefield: NonNullable<SimulationBattlefield>,
  actors: readonly SimulationActor[],
): void {
  battlefield.map.tokens = battlefield.map.tokens.map((token) => {
    const actor = actors.find((candidate) => candidate.id === token.id)
    return actor
      ? {
          ...token,
          x: actor.position,
          y: actor.positionY,
          elevationFeet: actor.elevationFeet,
          hp: actor.hp,
          maxHp: actor.maxHp,
        }
      : token
  })
}

function mappedMonsterDecision(
  actor: SimulationActor,
  actors: readonly SimulationActor[],
  characters: readonly Character[],
  battlefield: NonNullable<SimulationBattlefield>,
  decisionProvider?: MonsterDecisionProvider,
  captureCandidates = true,
): SimulationDecision | undefined {
  if (!actor.monster) return undefined
  synchronizeBattlefieldTokens(battlefield, actors)
  const token = battlefield.map.tokens.find((candidate) => candidate.id === actor.id)
  if (!token) return undefined
  const simulatedCharacters = characters.map((character) => {
    const tokenForCharacter = battlefield.map.tokens.find((candidate) =>
      candidate.characterId === character.id)
    const simulated = tokenForCharacter
      ? actors.find((candidate) => candidate.id === tokenForCharacter.id)
      : undefined
    return simulated
      ? { ...character, currentHp: simulated.hp, maxHp: simulated.maxHp }
      : character
  })
  const plan = planDnd5eMonsterTurn(battlefield.map, token, simulatedCharacters, {
    decisionProvider,
    simulationOptimization: {
      // Representative movement cells are enough for Monte Carlo policy
      // scoring; live monster turns remain exhaustive.
      maxReachablePositions: 40,
      approximateCandidateRoutes: true,
      skipDashWhenAttackAvailable: true,
      skipFinalRouteValidation: true,
      reachabilityCache: battlefield.runtimeCache?.monsterReachability,
    },
  })
  const actionId = plan.spellCast
    ? `spell:${plan.spellCast.spellId}:${plan.spellCast.slotLevel}`
    : plan.actionIndex != null
      ? actor.monster.actions[plan.actionIndex]?.id
      : undefined
  const next = plan.newPosition ?? { x: actor.position, y: actor.positionY }
  const nextElevationFeet = plan.newElevationFeet ??
    mapGeometryTerrainElevationAtPoint(battlefield.geometry, next, actor.elevationFeet)
  const targetId = plan.targetTokenId ?? plan.spellCast?.targetTokenIds[0]
  const targetActor = actors.find((candidate) => candidate.id === targetId)
  const baseMetrics = plan.decision?.metrics
  const metrics = baseMetrics
    ? {
        ...baseMetrics,
        defensiveCoverBonus: Math.max(
          baseMetrics.defensiveCoverBonus,
          targetActor
            ? Math.max(0, Math.min(5, (nextElevationFeet - targetActor.elevationFeet) / 10 * 2))
            : 0,
        ),
      }
    : undefined
  return {
    targetId,
    targetIds: plan.spellCast?.targetTokenIds,
    projectileTargetIds: plan.spellCast?.projectileTargetIds,
    actionId,
    nextPosition: next.x,
    nextPositionY: next.y,
    nextElevationFeet,
    dodges: plan.dodged,
    dashes: plan.dashed,
    candidateId: plan.decision?.candidateId ?? `mapped:${actionId ?? 'dodge'}`,
    score: plan.decision?.score ?? 0,
    reasons: plan.decision?.reasons ?? [plan.message],
    providerId: plan.decision?.providerId ?? decisionProvider?.id ??
      DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3.id,
    candidateCount: metrics ? 1 : 0,
    metrics,
    candidates: captureCandidates && metrics ? [{
      rank: 1,
      candidateId: plan.decision?.candidateId ?? `mapped:${actionId ?? 'dodge'}`,
      kind: plan.spellCast ? 'spell' : plan.dodged ? 'dodge' : plan.dashed ? 'dash' : 'attack',
      targetId: plan.targetTokenId ?? plan.spellCast?.targetTokenIds[0],
      actionId,
      nextPosition: next,
      score: plan.decision?.score ?? 0,
      selected: true,
      metrics,
      reasons: plan.decision?.reasons ?? [],
    }] : [],
  }
}

function monsterDecision(
  actor: SimulationActor,
  opponents: readonly SimulationActor[],
  actors: readonly SimulationActor[],
  characters: readonly Character[],
  battlefield?: SimulationBattlefield,
  decisionProvider: MonsterDecisionProvider = DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  captureCandidates = true,
): SimulationDecision {
  if (battlefield) {
    const mapped = mappedMonsterDecision(
      actor,
      actors,
      characters,
      battlefield,
      decisionProvider,
      captureCandidates,
    )
    if (mapped) return mapped
  }
  const candidates: MonsterDecisionCandidate<SimulationDecision>[] = []
  const hasNimbleEscape = actor.monster?.traits.some((trait) =>
    trait.automation === 'headless' &&
    trait.rule?.kind === 'nimble-escape' &&
    trait.rule.bonusActionOptions.includes('disengage')) === true
  for (const target of opponents) {
    const startDistance = Math.abs(actor.position - target.position)
    for (const action of actor.actions.filter((candidate) => availableAction(actor, candidate))) {
      if (
        action.control?.changesAllegiance &&
        (
          target.controlledById != null ||
          target.controlImmunities.has(controlImmunityKey(actor.id, action.id))
        )
      ) continue
      const preferred = Math.min(40, Math.max(5, actionNormalRange(action) / 2))
      const positions = new Set<number>([actor.position])
      const direction = target.position >= actor.position ? 1 : -1
      positions.add(actor.position + direction * Math.min(actor.speed, Math.max(0, startDistance - preferred)))
      if (actionNormalRange(action) > 5) positions.add(actor.position - direction * actor.speed)
      for (const nextPosition of positions) {
        const distance = Math.abs(nextPosition - target.position)
        const packTacticsAdvantage = simulationMonsterPackTacticsAdvantage(
          actor,
          target,
          actors,
          battlefield,
        )
        const attackMode = simulationAttackRollMode({
          baseMode: 'normal',
          packTacticsAdvantage,
        }).resolvedMode
        const attack = actionExpectedDamage(
          action,
          actor,
          target,
          distance,
          actor.hp / actor.maxHp,
          attackMode,
        )
        if (!attack) continue
        const movementFeet = Math.abs(nextPosition - actor.position)
        const supportCount = opponents.filter((candidate) =>
          candidate.id !== target.id && Math.abs(nextPosition - candidate.position) <= 5).length
        const targetThreat = Math.max(0, ...target.actions.map(actionThreatValue))
        const controlValue = action.control
          ? Math.min(
              420,
              attack.hitProbability * (
                action.control.changesAllegiance
                  ? target.hp * 7 + targetThreat * 21
                  : target.hp * 1.5 + targetThreat * 5
              ),
            )
          : 0
        candidates.push({
          id: `attack:${target.id}:${action.id}:${nextPosition}`,
          kind: action.control
            ? movementFeet > 0
              ? distance > startDistance ? 'retreat-control' : 'move-control'
              : 'control'
            : action.spell
            ? movementFeet > 0
              ? distance > startDistance ? 'retreat-spell' : 'move-spell'
              : 'spell'
            : movementFeet > 0
              ? distance > startDistance ? 'retreat-attack' : 'move-attack'
              : 'attack',
          payload: { targetId: target.id, actionId: action.id, nextPosition },
          metrics: {
            expectedDamage: attack.expectedDamage,
            targetCurrentHp: target.hp,
            targetMaximumHp: target.maxHp,
            targetArmorClass: target.ac,
            targetPriorityWeight: targetPriorityWeight(actor, target, opponents),
            targetThreat,
            targetSupportCount: supportCount,
            hitProbability: attack.hitProbability,
            targetDistanceFeet: distance,
            preferredDistanceFeet: preferred,
            movementFeet,
            distanceImprovementFeet: Math.max(0,
              Math.abs(startDistance - preferred) - Math.abs(distance - preferred)),
            defensiveCoverBonus: 0,
            opportunityAttackRisk: !hasNimbleEscape && movementFeet > 0 && startDistance <= 5 && distance > 5 ? 1 : 0,
            controlValue,
            attacksThisTurn: !action.control,
            consumesAction: true,
            dodges: false,
            dashes: false,
            usesNimbleEscape: hasNimbleEscape && movementFeet > 0 && startDistance <= 5 && distance > 5,
            usesPreciseCoverRoute: false,
            resourceCost: action.spell?.consumesSpellSlot
              ? action.spell.slotLevel * 3
              : action.usage ? 4 : 0,
          },
        })
      }
    }
    const direction = target.position >= actor.position ? 1 : -1
    const nextPosition = actor.position + direction * actor.speed * 2
    candidates.push({
      id: `dash:${target.id}:${nextPosition}`,
      kind: 'dash',
      payload: { targetId: target.id, nextPosition, dashes: true },
      metrics: {
        expectedDamage: 0,
        targetCurrentHp: target.hp,
        targetMaximumHp: target.maxHp,
        targetArmorClass: target.ac,
        targetPriorityWeight: targetPriorityWeight(actor, target, opponents),
        hitProbability: 0,
        targetDistanceFeet: Math.abs(nextPosition - target.position),
        preferredDistanceFeet: 5,
        movementFeet: actor.speed * 2,
        distanceImprovementFeet: Math.min(actor.speed * 2, startDistance),
        defensiveCoverBonus: 0,
        opportunityAttackRisk: 0,
        attacksThisTurn: false,
        consumesAction: true,
        dodges: false,
        dashes: true,
        usesNimbleEscape: false,
        usesPreciseCoverRoute: false,
      },
    })
  }
  candidates.push({
    id: 'dodge',
    kind: 'dodge',
    payload: { nextPosition: actor.position, dodges: true },
    metrics: {
      expectedDamage: 0,
      targetCurrentHp: opponents[0]?.hp ?? 1,
      targetMaximumHp: opponents[0]?.maxHp ?? 1,
      hitProbability: 0,
      targetDistanceFeet: opponents[0] ? Math.abs(actor.position - opponents[0].position) : 0,
      preferredDistanceFeet: 5,
      movementFeet: 0,
      distanceImprovementFeet: 0,
      defensiveCoverBonus: 0,
      opportunityAttackRisk: 0,
      attacksThisTurn: false,
      consumesAction: true,
      dodges: true,
      dashes: false,
      usesNimbleEscape: false,
      usesPreciseCoverRoute: false,
    },
  })
  const context: MonsterDecisionContext = {
    monsterId: actor.monster?.id ?? actor.id,
    actorTokenId: actor.id,
    currentHp: actor.hp,
    maxHp: actor.maxHp,
    tacticalRole: actor.behaviorStyle === 'aggressive'
      ? 'melee'
      : actor.behaviorStyle === 'skirmisher' ? 'skirmisher' : 'ranged',
    behaviorStyle: actor.behaviorStyle,
  }
  const ranked = rankMonsterDecisionCandidates(
    decisionProvider,
    context,
    candidates,
  )
  const selected = ranked[0]
  return selected
    ? {
        ...selected.candidate.payload,
        candidateId: selected.candidate.id,
        score: selected.score,
        reasons: selected.reasons,
        providerId: decisionProvider.id,
        candidateCount: ranked.length,
        metrics: selected.candidate.metrics,
        candidates: captureCandidates ? ranked.map((entry, index) => ({
          rank: index + 1,
          candidateId: entry.candidate.id,
          kind: entry.candidate.kind,
          targetId: entry.candidate.payload.targetId,
          actionId: entry.candidate.payload.actionId,
          nextPosition: {
            x: entry.candidate.payload.nextPosition,
            y: entry.candidate.payload.nextPositionY ?? actor.positionY,
            elevationFeet: entry.candidate.payload.nextElevationFeet ?? actor.elevationFeet,
          },
          score: entry.score,
          selected: index === 0,
          metrics: entry.candidate.metrics,
          reasons: entry.reasons,
        })) : undefined,
      }
    : {
        nextPosition: actor.position,
        dodges: true,
        candidateId: 'fallback:dodge',
        score: 0,
        reasons: ['没有可执行候选，采取闪避。'],
        providerId: decisionProvider.id,
        candidates: [],
      }
}

function playerReachabilityCacheKey(
  actor: SimulationActor,
  map: BattleMap,
  maximumMovementFeet: number,
): string {
  const positions = map.tokens
    .filter((token) => token.type !== 'obstacle')
    .map((token) =>
      `${token.id}:${Math.round(token.x)}:${Math.round(token.y)}:${token.size}:${token.elevationFeet ?? 0}:${token.type}`)
    .sort()
    .join('|')
  return [
    actor.id,
    Math.round(actor.position),
    Math.round(actor.positionY),
    actor.elevationFeet,
    maximumMovementFeet,
    map.width,
    map.height,
    map.gridSize,
    map.gridOffsetX,
    map.gridOffsetY,
    positions,
  ].join(';')
}

function cachePlayerReachability(
  cache: SimulationRuntimeCache | undefined,
  key: string,
  positions: readonly SimulationReachablePosition[],
): void {
  if (!cache) return
  const maximumEntries = 1_024
  if (cache.playerReachability.size >= maximumEntries) {
    const oldest = cache.playerReachability.keys().next().value
    if (oldest) cache.playerReachability.delete(oldest)
  }
  cache.playerReachability.set(key, positions)
}

function reachablePlayerPositions(
  actor: SimulationActor,
  battlefield: NonNullable<SimulationBattlefield>,
  maximumMovementFeet: number,
): SimulationReachablePosition[] {
  const map = battlefield.map
  const cacheKey = playerReachabilityCacheKey(actor, map, maximumMovementFeet)
  const cached = battlefield.runtimeCache?.playerReachability.get(cacheKey)
  if (cached) return [...cached]
  const token = map.tokens.find((candidate) => candidate.id === actor.id)
  if (!token) {
    return [{
      x: actor.position,
      y: actor.positionY,
      elevationFeet: actor.elevationFeet,
      movementFeet: 0,
    }]
  }
  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const start = {
    col: Math.floor((actor.position - map.gridOffsetX) / map.gridSize),
    row: Math.floor((actor.positionY - map.gridOffsetY) / map.gridSize),
  }
  const key = (col: number, row: number) => `${col},${row}`
  const visited = new Map<string, number>([[key(start.col, start.row), 0]])
  type ReachableNode = {
    col: number
    row: number
    elevationFeet: number
    movementFeet: number
  }
  const queue: ReachableNode[] = [{
    ...start,
    elevationFeet: actor.elevationFeet,
    movementFeet: 0,
  }]
  const pushQueue = (node: ReachableNode) => {
    queue.push(node)
    let index = queue.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (queue[parent].movementFeet <= queue[index].movementFeet) break
      const parentNode = queue[parent]
      queue[parent] = queue[index]
      queue[index] = parentNode
      index = parent
    }
  }
  const popQueue = (): ReachableNode | undefined => {
    const first = queue[0]
    const last = queue.pop()
    if (!first || !last || queue.length === 0) return first
    queue[0] = last
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index
      if (left < queue.length && queue[left].movementFeet < queue[smallest].movementFeet) {
        smallest = left
      }
      if (right < queue.length && queue[right].movementFeet < queue[smallest].movementFeet) {
        smallest = right
      }
      if (smallest === index) break
      const currentNode = queue[index]
      queue[index] = queue[smallest]
      queue[smallest] = currentNode
      index = smallest
    }
    return first
  }
  const positions: SimulationReachablePosition[] = [{
    x: actor.position,
    y: actor.positionY,
    elevationFeet: actor.elevationFeet,
    movementFeet: 0,
  }]
  while (queue.length > 0) {
    const current = popQueue()!
    if (current.movementFeet >= maximumMovementFeet) continue
    for (const dc of [-1, 0, 1]) {
      for (const dr of [-1, 0, 1]) {
        if (dc === 0 && dr === 0) continue
        const col = current.col + dc
        const row = current.row + dr
        const nextKey = key(col, row)
        const point = {
          x: map.gridOffsetX + (col + 0.5) * map.gridSize,
          y: map.gridOffsetY + (row + 0.5) * map.gridSize,
        }
        if (point.x < 0 || point.y < 0 || point.x > map.width || point.y > map.height) continue
        const currentPoint = {
          x: map.gridOffsetX + (current.col + 0.5) * map.gridSize,
          y: map.gridOffsetY + (current.row + 0.5) * map.gridSize,
        }
        const projectedToken = { ...token, x: currentPoint.x, y: currentPoint.y }
        if (mapGeometryMovementBlocked({
          geometry: battlefield.geometry,
          map,
          token: projectedToken,
          to: point,
        }).blocked) continue
        const elevationFeet = mapGeometryTerrainElevationAtPoint(
          battlefield.geometry,
          point,
          current.elevationFeet,
        )
        const elevationDelta = elevationFeet - current.elevationFeet
        if (Math.abs(elevationDelta) > 10) continue
        const movementFeet = current.movementFeet + feetPerCell + Math.max(0, elevationDelta)
        if (
          movementFeet > maximumMovementFeet ||
          (visited.get(nextKey) ?? Number.POSITIVE_INFINITY) <= movementFeet
        ) continue
        const occupied = map.tokens.some((candidate) =>
          candidate.id !== actor.id &&
          candidate.type !== 'obstacle' &&
          Math.hypot(candidate.x - point.x, candidate.y - point.y) < map.gridSize * 0.6)
        if (occupied) continue
        visited.set(nextKey, movementFeet)
        pushQueue({ col, row, elevationFeet, movementFeet })
        positions.push({ ...point, elevationFeet, movementFeet })
      }
    }
  }
  cachePlayerReachability(battlefield.runtimeCache, cacheKey, positions)
  return [...positions]
}

/** Keep broad movement options without ray-testing every reachable grid cell. */
function boundedPlayerReachablePositions(
  positions: readonly SimulationReachablePosition[],
  target: SimulationActor,
  battlefield: SimulationBattlefield,
): SimulationReachablePosition[] {
  const maximum = 40
  if (positions.length <= maximum) return [...positions]
  const selected = new Map<string, SimulationReachablePosition>()
  const add = (entries: readonly SimulationReachablePosition[], limit: number) => {
    for (const entry of entries.slice(0, limit)) {
      selected.set(`${Math.round(entry.x)},${Math.round(entry.y)},${entry.elevationFeet}`, entry)
    }
  }
  add([...positions].sort((left, right) => left.movementFeet - right.movementFeet), 16)
  add([...positions].sort((left, right) =>
    actorDistanceFeet(leftPosition(left), target, battlefield) -
    actorDistanceFeet(leftPosition(right), target, battlefield)), 16)
  add([...positions].sort((left, right) => right.elevationFeet - left.elevationFeet), 8)
  add([...positions].sort((left, right) => left.elevationFeet - right.elevationFeet), 8)
  return [...selected.values()].slice(0, maximum)
}

function spellAreaActors(
  action: SimulationAction,
  caster: Pick<SimulationActor, 'position' | 'positionY' | 'elevationFeet'>,
  aim: SimulationActor,
  actors: readonly SimulationActor[],
  battlefield?: SimulationBattlefield,
): readonly SimulationActor[] {
  const definition = action.spell ? getDnd5eSrdCombatSpell(action.spell.id) : undefined
  const area = definition?.area
  if (!area) return [aim]
  const feetPerPixel = 1 / battlefieldPixelsPerFoot(battlefield)
  const cx = caster.position
  const cy = caster.positionY
  const ax = aim.position
  const ay = aim.positionY
  const dx = ax - cx
  const dy = ay - cy
  const length = Math.max(0.0001, Math.hypot(dx, dy))
  const ux = dx / length
  const uy = dy / length
  return actors.filter((candidate) => {
    const fromCasterX = (candidate.position - cx) * feetPerPixel
    const fromCasterY = (candidate.positionY - cy) * feetPerPixel
    if (area.shape === 'circle') {
      const origin = area.origin === 'self' ? caster : aim
      return Math.hypot(
        (candidate.position - origin.position) * feetPerPixel,
        (candidate.positionY - origin.positionY) * feetPerPixel,
      ) <= area.radiusFeet
    }
    if (area.shape === 'rect') {
      return Math.abs((candidate.position - ax) * feetPerPixel) <= area.widthFeet / 2 &&
        Math.abs((candidate.positionY - ay) * feetPerPixel) <= area.heightFeet / 2
    }
    const along = fromCasterX * ux + fromCasterY * uy
    const across = Math.abs(fromCasterX * -uy + fromCasterY * ux)
    if (area.shape === 'line') {
      return along >= 0 && along <= area.lengthFeet && across <= area.widthFeet / 2
    }
    return along >= 0 && along <= area.lengthFeet && across <= along
  })
}

interface ThunderwaveEnvironmentalImpact {
  expectedFallDamage: number
  expectedControlValue: number
  pushedTargetCount: number
  expectedFallDistanceFeet: number
}

/**
 * Scores only geometry-validated Thunderwave outcomes. The actual forced move
 * and fall remain a Headless transaction when the candidate is selected.
 */
function thunderwaveEnvironmentalImpact(input: {
  action: SimulationAction
  sourceActor: SimulationActor
  caster: Pick<SimulationActor, 'id' | 'position' | 'positionY' | 'elevationFeet'>
  targets: readonly SimulationActor[]
  actors: readonly SimulationActor[]
  battlefield?: SimulationBattlefield
}): ThunderwaveEnvironmentalImpact {
  if (input.action.spell?.id !== 'thunderwave' || !input.battlefield) {
    return { expectedFallDamage: 0, expectedControlValue: 0, pushedTargetCount: 0, expectedFallDistanceFeet: 0 }
  }
  const map = {
    ...input.battlefield.map,
    tokens: input.battlefield.map.tokens.map((token) => {
      const actor = input.actors.find((candidate) => candidate.id === token.id)
      if (!actor) return token
      const position = actor.id === input.caster.id ? input.caster : actor
      return {
        ...token,
        x: position.position,
        y: position.positionY,
        elevationFeet: position.elevationFeet,
      }
    }),
  }
  const casterToken = map.tokens.find((token) => token.id === input.caster.id)
  if (!casterToken) {
    return { expectedFallDamage: 0, expectedControlValue: 0, pushedTargetCount: 0, expectedFallDistanceFeet: 0 }
  }
  let expectedFallDamage = 0
  let expectedControlValue = 0
  let pushedTargetCount = 0
  let expectedFallDistanceFeet = 0
  for (const target of input.targets) {
    const targetToken = map.tokens.find((token) => token.id === target.id)
    if (!targetToken) continue
    const push = dnd5eRepellingBlastPushDestination(map, casterToken, targetToken)
    if (push.distanceFeet <= 0) continue
    const distance = actorDistanceFeet(input.caster, target, input.battlefield)
    const failureProbability = actionExpectedDamage(
      input.action,
      input.sourceActor,
      target,
      distance,
    )?.hitProbability ?? 0
    const fall = dnd5eForcedMovementFall({
      geometry: input.battlefield.geometry,
      target: targetToken,
      to: push.to,
    })
    const fallDistanceFeet = fall.fallDistanceFeet
    const averageFallDamage = dnd5eFallingDamageDice(fallDistanceFeet) * 3.5
    expectedFallDamage += averageFallDamage * failureProbability
    expectedFallDistanceFeet += fallDistanceFeet * failureProbability
    expectedControlValue += failureProbability * (4 + push.distanceFeet / 2 + fallDistanceFeet / 2)
    pushedTargetCount += 1
  }
  return { expectedFallDamage, expectedControlValue, pushedTargetCount, expectedFallDistanceFeet }
}

/**
 * Builds the exact forced-movement payload required by the Headless spell
 * transaction.  The decision scorer above only estimates the value; this
 * helper rolls the target's actual save mode and lets Headless validate and
 * resolve both the push and any resulting fall.
 */
function simulationThunderwaveForcedMovements(input: {
  actor: SimulationActor
  action: SimulationAction
  actors: readonly SimulationActor[]
  holder: { state: Dnd5eHeadlessCombatState }
  battlefield?: SimulationBattlefield
  targetSavingThrows: readonly { targetId: string; d20: number; d20Second?: number }[]
  random: SeededRandom
}): readonly Dnd5eSpellForcedMovement[] {
  const spell = input.action.spell
  if (
    spell?.id !== 'thunderwave' ||
    !spell.saveAbility ||
    spell.saveDc == null ||
    !input.battlefield
  ) return []
  const saveDc = spell.saveDc
  const map = {
    ...input.battlefield.map,
    tokens: input.battlefield.map.tokens.map((token) => {
      const actor = input.actors.find((candidate) => candidate.id === token.id)
      return actor
        ? { ...token, x: actor.position, y: actor.positionY, elevationFeet: actor.elevationFeet }
        : token
    }),
  }
  const caster = input.holder.state.combatants[input.actor.id]
  const casterToken = map.tokens.find((token) => token.id === input.actor.id)
  if (!caster || !casterToken) return []
  return input.targetSavingThrows.flatMap((saveRoll): Dnd5eSpellForcedMovement[] => {
    const targetActor = input.actors.find((candidate) => candidate.id === saveRoll.targetId)
    const target = input.holder.state.combatants[saveRoll.targetId]
    const targetToken = map.tokens.find((token) => token.id === saveRoll.targetId)
    if (!targetActor || !target || !targetToken) return []
    const saveMode = dnd5eSavingThrowMode(target, spell.saveAbility!, {
      effectVisible: true,
      sourceCreatureType: caster.creatureType,
      sourceIsSpell: true,
    })
    const d20 = saveMode === 'advantage'
      ? Math.max(saveRoll.d20, saveRoll.d20Second ?? 0)
      : saveMode === 'disadvantage'
        ? Math.min(saveRoll.d20, saveRoll.d20Second ?? 0)
        : saveRoll.d20
    const modifier = target.savingThrowBonuses[spell.saveAbility!] ??
      rules.abilityModifier(target.abilities[spell.saveAbility!])
    if (d20 + modifier >= saveDc) return []
    const push = dnd5eRepellingBlastPushDestination(map, casterToken, targetToken)
    if (push.distanceFeet <= 0) return []
    const fall = dnd5eForcedMovementFall({
      geometry: input.battlefield!.geometry,
      target: targetToken,
      to: push.to,
    })
    const toElevationFeet = fall.toElevationFeet
    const fallDistanceFeet = fall.fallDistanceFeet
    const fallingDamageRolls = dnd5eFallingDamageDice(fallDistanceFeet) > 0
      ? Array.from({ length: dnd5eFallingDamageDice(fallDistanceFeet) }, () => input.random.die(6))
      : undefined
    return [{
      targetId: targetActor.id,
      to: push.to,
      distanceFeet: push.distanceFeet,
      toElevationFeet,
      fallingDamageRolls,
    }]
  })
}

function playerDecision(
  actor: SimulationActor,
  opponents: readonly SimulationActor[],
  actors: readonly SimulationActor[],
  battlefield: SimulationBattlefield | undefined,
  decisionProvider: MonsterDecisionProvider,
  captureCandidates = true,
): SimulationDecision {
  const allies = actors.filter((candidate) =>
    effectiveSide(candidate, actors) === effectiveSide(actor, actors) && candidate.hp > 0)
  const reachable = battlefield
    ? reachablePlayerPositions(actor, battlefield, actor.speed)
    : [{
        x: actor.position,
        y: actor.positionY,
        elevationFeet: actor.elevationFeet,
        movementFeet: 0,
      }]
  const candidates: MonsterDecisionCandidate<SimulationDecision>[] = []
  for (const action of actor.actions.filter((candidate) => availableAction(actor, candidate))) {
    const supportSpell = action.spell?.target === 'ally' ||
      action.spell?.healing === true ||
      action.spell?.target === 'creature' && action.spell.effect === 'active-effect'
    const targets = supportSpell ? allies : opponents
    for (const target of targets) {
      const maximum = actionMaximumRange(action)
      const actorToken = battlefield?.map.tokens.find((candidate) => candidate.id === actor.id)
      const targetToken = battlefield?.map.tokens.find((candidate) => candidate.id === target.id)
      const candidatePositions = battlefield
        ? boundedPlayerReachablePositions(reachable, target, battlefield)
        : (() => {
            const distance = actorDistanceFeet(actor, target, battlefield)
            const movementFeet = Math.min(actor.speed, Math.max(0, distance - maximum))
            const next = moveTowardActor(actor, target, movementFeet, battlefield)
            return [
              reachable[0],
              {
                x: next.x,
                y: next.y,
                elevationFeet: actor.elevationFeet,
                movementFeet,
              },
            ]
          })()
      const legalPositions = candidatePositions.filter((position) => {
        const projected = {
          position: position.x,
          positionY: position.y,
          elevationFeet: position.elevationFeet,
        }
        const distance = actorDistanceFeet(projected, target, battlefield)
        if (distance > maximum || (maximum === 0 && target.id !== actor.id)) return false
        if (!battlefield || !actorToken || !targetToken) return true
        return !mapGeometryCoverBetween(
          battlefield.geometry,
          {
            ...actorToken,
            x: position.x,
            y: position.y,
            elevationFeet: position.elevationFeet,
          },
          {
            ...targetToken,
            x: target.position,
            y: target.positionY,
            elevationFeet: target.elevationFeet,
          },
          battlefield.map,
        ).blocksLineOfEffect
      }).sort((left, right) =>
        left.movementFeet - right.movementFeet ||
        right.elevationFeet - left.elevationFeet).slice(0, 2)
      for (const position of legalPositions) {
        const projected = {
          position: position.x,
          positionY: position.y,
          elevationFeet: position.elevationFeet,
        }
        const distance = actorDistanceFeet(projected, target, battlefield)
        const attackMode = elevationAttackMode(projected, target)
        const areaTargets = action.spell?.target === 'area'
          ? spellAreaActors(action, projected, target, actors, battlefield)
          : [target]
        const hostileAreaTargets = areaTargets.filter((candidate) =>
          effectiveSide(candidate, actors) !== effectiveSide(actor, actors) && candidate.hp > 0)
        const friendlyAreaTargets = areaTargets.filter((candidate) =>
          effectiveSide(candidate, actors) === effectiveSide(actor, actors) && candidate.id !== actor.id)
        const attack = supportSpell
          ? { expectedDamage: 0, hitProbability: 1 }
          : actionExpectedDamage(
              action,
              actor,
              target,
              distance,
              actor.hp / actor.maxHp,
              attackMode,
            )
        if (!attack) continue
        const averageHealing = action.spell?.healing
          ? action.spell.dice.count * (action.spell.dice.sides + 1) / 2 + action.spell.dice.bonus
          : 0
        const supportValue = action.spell?.healing
          ? Math.min(Math.max(0, target.maxHp - target.hp), Math.max(1, averageHealing)) * 2 +
            (target.hp <= target.maxHp * 0.3 ? 12 : 0)
          : supportSpell ? 8 : 0
        if (action.spell?.healing && target.hp >= target.maxHp) continue
        const areaDamage = action.spell?.target === 'area'
          ? attack.expectedDamage * hostileAreaTargets.length -
            attack.expectedDamage * friendlyAreaTargets.length * 1.5
          : attack.expectedDamage
        if (action.spell?.target === 'area' && hostileAreaTargets.length === 0) continue
        const thunderwaveImpact = thunderwaveEnvironmentalImpact({
          action,
          sourceActor: actor,
          caster: { id: actor.id, ...projected },
          targets: hostileAreaTargets,
          actors,
          battlefield,
        })
        candidates.push({
          id: `player:${actor.id}:${action.id}:${target.id}:${position.x}:${position.y}`,
          kind: supportSpell ? 'heal' : action.spell ? 'spell' : 'attack',
          payload: {
            targetId: target.id,
            targetIds: action.spell?.target === 'area'
              ? action.spell.id === 'thunderwave'
                ? hostileAreaTargets.map((candidate) => candidate.id)
                : areaTargets.map((candidate) => candidate.id)
              : undefined,
            actionId: action.id,
            nextPosition: position.x,
            nextPositionY: position.y,
            nextElevationFeet: position.elevationFeet,
          },
          metrics: {
            expectedDamage: Math.max(0, areaDamage + thunderwaveImpact.expectedFallDamage),
            targetCurrentHp: target.hp,
            targetMaximumHp: target.maxHp,
            targetArmorClass: target.ac,
            targetPriorityWeight: targetPriorityWeight(actor, target, targets),
            targetSupportCount: 0,
            hitProbability: attack.hitProbability,
            targetDistanceFeet: distance,
            preferredDistanceFeet: Math.min(60, Math.max(5, actionNormalRange(action) / 2)),
            movementFeet: position.movementFeet,
            distanceImprovementFeet: Math.max(0,
              actorDistanceFeet(actor, target, battlefield) - distance),
            defensiveCoverBonus: Math.max(0, Math.min(5, (position.elevationFeet - target.elevationFeet) / 10 * 2)),
            opportunityAttackRisk: 0,
            controlValue: !supportSpell && action.spell &&
              ['saving-throw', 'power-word-stun', 'attack-save-debuff'].includes(action.spell.effect)
              ? attack.hitProbability * 10 + thunderwaveImpact.expectedControlValue
              : 0,
            supportValue,
            affectedEnemyCount: hostileAreaTargets.length,
            affectedAllyCount: friendlyAreaTargets.length,
            allyEmergency: supportSpell
              ? Math.max(0, Math.min(1, 1 - target.hp / Math.max(1, target.maxHp)))
              : 0,
            resourceCost: action.spell?.consumesSpellSlot ? action.spell.slotLevel * 3 : 0,
            attacksThisTurn: !supportSpell,
            consumesAction: action.spell?.castingTime !== 'bonus-action',
            dodges: false,
            dashes: false,
            usesNimbleEscape: false,
            usesPreciseCoverRoute: !!battlefield,
          },
        })
      }
    }
  }
  const context: MonsterDecisionContext = {
    monsterId: `player:${actor.character?.id ?? actor.id}`,
    actorTokenId: actor.id,
    currentHp: actor.hp,
    maxHp: actor.maxHp,
    tacticalRole: actor.actions.some((action) => (action.spell?.rangeFeet ?? 0) >= 30)
      ? 'ranged'
      : 'melee',
    behaviorStyle: 'balanced',
  }
  const ranked = rankMonsterDecisionCandidates(decisionProvider, context, candidates)
  const selected = ranked[0]
  if (selected) {
    return {
      ...selected.candidate.payload,
      candidateId: selected.candidate.id,
      score: selected.score,
      reasons: selected.reasons,
      providerId: decisionProvider.id,
      candidateCount: ranked.length,
      metrics: selected.candidate.metrics,
      candidates: captureCandidates ? ranked.slice(0, 40).map((entry, index) => ({
        rank: index + 1,
        candidateId: entry.candidate.id,
        kind: entry.candidate.kind,
        targetId: entry.candidate.payload.targetId,
        actionId: entry.candidate.payload.actionId,
        nextPosition: {
          x: entry.candidate.payload.nextPosition,
          y: entry.candidate.payload.nextPositionY ?? actor.positionY,
          elevationFeet: entry.candidate.payload.nextElevationFeet ?? actor.elevationFeet,
        },
        score: entry.score,
        selected: index === 0,
        metrics: entry.candidate.metrics,
        reasons: entry.reasons,
      })) : undefined,
    }
  }
  const target = [...opponents].sort((left, right) =>
    actorDistanceFeet(actor, left, battlefield) - actorDistanceFeet(actor, right, battlefield))[0]
  const dash = battlefield && target
    ? boundedPlayerReachablePositions(
        reachablePlayerPositions(actor, battlefield, actor.speed * 2),
        target,
        battlefield,
      )
        .sort((left, right) =>
          actorDistanceFeet(leftPosition(left), target, battlefield) -
          actorDistanceFeet(leftPosition(right), target, battlefield))[0]
    : undefined
  return {
    targetId: target?.id,
    nextPosition: dash?.x ?? actor.position,
    nextPositionY: dash?.y ?? actor.positionY,
    nextElevationFeet: dash?.elevationFeet ?? actor.elevationFeet,
    dashes: true,
    providerId: decisionProvider.id,
    candidateId: 'player:fallback:dash',
    score: 0,
    reasons: ['没有可执行攻击或法术，向最近敌人疾走。'],
    candidates: [],
  }
}

function leftPosition(
  position: { x: number; y: number; elevationFeet?: number },
): Pick<SimulationActor, 'position' | 'positionY' | 'elevationFeet'> {
  return {
    position: position.x,
    positionY: position.y,
    elevationFeet: position.elevationFeet ?? 0,
  }
}

function applyDamage(
  target: SimulationActor,
  rawDamage: number,
  type: Dnd5eDamageType,
  source: SimulationDamageSourceDetails,
): number {
  const damage = resolveSimulationDamage(target, rawDamage, type, source)
  target.hp = Math.max(0, target.hp - damage)
  if (target.hp === 0) {
    target.deathSaves = { stable: false, dead: true }
  }
  if (damage > 0) target.damageTypesSinceTurn.add(type)
  return damage
}

function synchronizeSimulationActorFromHeadless(
  actor: SimulationActor,
  combatant: Dnd5eHeadlessCombatState['combatants'][string],
): void {
  actor.hp = Math.max(0, combatant.currentHp)
  actor.deathSaves = {
    stable: combatant.deathSaves.stable,
    dead: combatant.deathSaves.dead,
  }
  actor.activeEffects = normalizeDnd5eActiveEffects(combatant.classState.activeEffects)
}

function synchronizeHeadlessActors(
  holder: { state: Dnd5eHeadlessCombatState },
  actors: readonly SimulationActor[],
  battlefield?: SimulationBattlefield,
): void {
  holder.state.distanceFeetByCombatantPair = {}
  holder.state.coverBonusByCombatantPair = {}
  holder.state.lineOfEffectBlockedByCombatantPair = {}
  holder.state.lineOfSightBlockedByCombatantPair = {}
  holder.state.physicalLineOfSightBlockedByCombatantPair = {}
  for (const actor of actors) {
    const combatant = holder.state.combatants[actor.id]
    if (!combatant) continue
    combatant.currentHp = actor.hp
    combatant.maxHp = actor.maxHp
    combatant.deathSaves = actor.hp > 0
      ? { successes: 0, failures: 0, stable: false, dead: false }
      : {
          successes: 0,
          failures: actor.deathSaves.dead ? 3 : 0,
          stable: actor.deathSaves.stable,
          dead: actor.deathSaves.dead,
        }
    replaceDnd5eCombatantActiveEffects(combatant, actor.activeEffects)
    combatant.position = { x: actor.position, y: actor.positionY }
    combatant.elevationFeet = actor.elevationFeet
  }
  for (let left = 0; left < actors.length; left += 1) {
    for (let right = left + 1; right < actors.length; right += 1) {
      holder.state.distanceFeetByCombatantPair[
        dnd5eCombatantPairKey(actors[left].id, actors[right].id)
      ] = actorDistanceFeet(actors[left], actors[right], battlefield)
      if (battlefield) {
        for (const [attacker, target] of [
          [actors[left], actors[right]],
          [actors[right], actors[left]],
        ] as const) {
          const attackerToken = battlefield.map.tokens.find((token) => token.id === attacker.id)
          const targetToken = battlefield.map.tokens.find((token) => token.id === target.id)
          if (!attackerToken || !targetToken) continue
          const cover = mapGeometryCoverBetween(
            battlefield.geometry,
            { ...attackerToken, x: attacker.position, y: attacker.positionY },
            { ...targetToken, x: target.position, y: target.positionY },
            battlefield.map,
          )
          const key = dnd5eDirectedCombatantPairKey(attacker.id, target.id)
          if (cover.blocksLineOfEffect) holder.state.lineOfEffectBlockedByCombatantPair[key] = true
          else if (cover.armorClassBonus === 2 || cover.armorClassBonus === 5) {
            holder.state.coverBonusByCombatantPair[key] = cover.armorClassBonus
          }
          if (mapGeometryLineOfSightBlocked({
            geometry: battlefield.geometry,
            from: { ...attackerToken, x: attacker.position, y: attacker.positionY },
            to: { ...targetToken, x: target.position, y: target.positionY },
            fromElevationFeet: attackerToken.elevationFeet ?? 0,
            toElevationFeet: targetToken.elevationFeet ?? 0,
          })) {
            holder.state.lineOfSightBlockedByCombatantPair[key] = true
            holder.state.physicalLineOfSightBlockedByCombatantPair[key] = true
          }
        }
      }
    }
  }
}

function synchronizeControlledActors(
  holder: { state: Dnd5eHeadlessCombatState },
  actors: readonly SimulationActor[],
): void {
  for (const actor of actors) {
    const combatant = holder.state.combatants[actor.id]
    const enslave = combatant?.classState.activeEffects?.find((effect) =>
      effect.standardCondition === 'charmed' &&
      effect.source.rulesId === 'monster:srd-5.1:aboleth:enslave' &&
      effect.source.actorId != null &&
      (holder.state.combatants[effect.source.actorId]?.currentHp ?? 0) > 0)
    actor.controlledById = enslave?.source.actorId
  }
}

function combatantName(actors: readonly SimulationActor[], id: string | undefined): string {
  if (!id) return '未知目标'
  return actors.find((actor) => actor.id === id)?.name ?? id
}

function executionStepsFromEvents(
  events: readonly Dnd5eCombatEvent[],
  actors: readonly SimulationActor[],
): Dnd5eCombatSimulationExecutionStep[] {
  return events.flatMap((event): Dnd5eCombatSimulationExecutionStep[] => {
    if (event.type === 'turn-resource-spent') {
      return [{
        kind: 'resource',
        text: `${combatantName(actors, event.actorId)}消耗${event.resource === 'action' ? '动作' : event.resource === 'bonusAction' ? '附赠动作' : event.resource === 'reaction' ? '反应' : `${event.amount ?? 0} 尺移动`}`,
      }]
    }
    if (event.type === 'attack-resolved') {
      const modifier = event.total - event.d20
      return [{
        kind: 'roll',
        text: `${combatantName(actors, event.actorId)}攻击${combatantName(actors, event.targetId)}：D20=${event.d20} ${modifier >= 0 ? '+' : '−'} ${Math.abs(modifier)} = ${event.total}，对抗 AC ${event.armorClass}，${event.hit ? event.critical ? '重击' : '命中' : '未命中'}`,
      }]
    }
    if (event.type === 'damage-applied') {
      return [{
        kind: 'damage',
        text: `${combatantName(actors, event.targetId)}受到 ${event.amount} 点伤害，HP ${event.hpBefore} → ${event.hpAfter}${event.temporaryHpBefore !== event.temporaryHpAfter ? `，临时 HP ${event.temporaryHpBefore} → ${event.temporaryHpAfter}` : ''}`,
      }]
    }
    if (event.type === 'saving-throw-resolved') {
      return [{
        kind: 'roll',
        text: `${combatantName(actors, event.targetId)}进行 ${event.ability.toUpperCase()} 豁免：D20=${event.d20} ${event.modifier >= 0 ? '+' : '−'} ${Math.abs(event.modifier)} = ${event.total}，DC ${event.dc}，${event.success ? '成功' : '失败'}`,
      }]
    }
    if (event.type === 'moved') {
      return [{
        kind: 'movement',
        text: `${combatantName(actors, event.actorId)} 被强制移动 ${event.distance} 尺：(${Math.round(event.from.x)}, ${Math.round(event.from.y)}) → (${Math.round(event.to.x)}, ${Math.round(event.to.y)})`,
      }]
    }
    if (event.type === 'falling-damage-resolved') {
      return [{
        kind: 'damage',
        text: `${combatantName(actors, event.actorId)} 坠落 ${event.distanceFeet} 尺，承受 ${event.dice}d6 坠落伤害 ${event.damage}${event.landedProne ? '，并倒地' : ''}`,
      }]
    }
    if (event.type === 'condition-applied') {
      return [{
        kind: 'condition',
        text: `${combatantName(actors, event.targetId)}获得状态：${event.condition}`,
      }]
    }
    if (event.type === 'condition-ended') {
      return [{
        kind: 'condition',
        text: `${combatantName(actors, event.targetId)}解除状态：${event.condition}`,
      }]
    }
    if (event.type === 'active-effect-applied') {
      return [{
        kind: 'condition',
        text: `${combatantName(actors, event.targetId)}获得效果：${event.definitionId}`,
      }]
    }
    if (event.type === 'active-effect-removed') {
      return [{
        kind: 'condition',
        text: `${combatantName(actors, event.targetId)}移除效果：${event.definitionId}（${event.reason}）`,
      }]
    }
    if (event.type === 'monster-special-action-resolved') {
      return [{
        kind: 'result',
        text: `特殊动作 ${event.actionId} 结算完成${event.targetId ? `，目标 ${combatantName(actors, event.targetId)}` : ''}${event.success != null ? `，目标豁免${event.success ? '成功' : '失败'}` : ''}`,
      }]
    }
    if (event.type === 'monster-core-spell-resolved') {
      return [{
        kind: 'result',
        text: `施放 ${event.spellId}（${event.slotLevel} 环），目标：${event.targetIds.map((id) => combatantName(actors, id)).join('、')}`,
      }]
    }
    if (event.type === 'monster-recharge-resolved') {
      return [{
        kind: 'roll',
        text: `${event.actionId}充能检定：D6=${event.roll}，${event.ready ? '充能完成' : '未充能'}`,
      }]
    }
    return []
  })
}

function transactionStep(committed: boolean): Dnd5eCombatSimulationExecutionStep {
  return {
    kind: 'transaction',
    text: committed ? 'Headless 事务已提交' : 'Headless 事务未提交',
  }
}

function weaponExecutionSteps(
  events: readonly Dnd5eCombatEvent[],
  actors: readonly SimulationActor[],
  parts: readonly SimulationAttackPart[],
  damageGroups: readonly (readonly (readonly number[])[])[],
): Dnd5eCombatSimulationExecutionStep[] {
  const steps: Dnd5eCombatSimulationExecutionStep[] = []
  let attackIndex = -1
  for (const event of events) {
    steps.push(...executionStepsFromEvents([event], actors))
    if (event.type !== 'attack-resolved') continue
    attackIndex += 1
    if (!event.hit) continue
    const part = parts[attackIndex]
    if (!part) continue
    for (const [damageIndex, damage] of part.damages.entries()) {
      const dice = damageGroups[attackIndex]?.[damageIndex] ?? []
      steps.push({
        kind: 'roll',
        text: `伤害骰 ${damage.count}d${damage.sides}${damage.bonus >= 0 ? '+' : ''}${damage.bonus}：[${dice.join(', ')}]${damage.bonus ? ` ${damage.bonus >= 0 ? '+' : '−'} ${Math.abs(damage.bonus)}` : ''} = ${dice.reduce((sum, value) => sum + value, damage.bonus)}`,
      })
    }
  }
  return steps
}

function rollDamageGroups(
  parts: readonly SimulationAttackPart[],
  random: SeededRandom,
): readonly (readonly (readonly number[])[])[] {
  return parts.map((part) => part.damages.map((damage) =>
    Array.from({ length: damage.count }, () => random.die(damage.sides))))
}

function executeHeadlessControlAction(input: {
  actor: SimulationActor
  target: SimulationActor
  action: SimulationAction
  actors: SimulationActor[]
  holder: { state: Dnd5eHeadlessCombatState }
    random: SeededRandom
    captureLog: boolean
    battlefield?: SimulationBattlefield
}): SimulationExecutionResult {
  const { actor, target, action, actors, holder, random } = input
  if (!actor.monster || !action.control) {
    return { handled: false, hits: 0, damage: 0, transactions: 0 }
  }
  synchronizeHeadlessActors(holder, actors, input.battlefield)
  const actorIndex = holder.state.initiativeOrder.indexOf(actor.id)
  const combatant = holder.state.combatants[actor.id]
  if (actorIndex < 0 || !combatant) {
    return { handled: false, hits: 0, damage: 0, transactions: 0 }
  }
  holder.state.initiativeIndex = actorIndex
  combatant.turn.actionAvailable = true
  combatant.turn.bonusActionAvailable = true
  combatant.turn.reactionAvailable = true
  const result = resolveDnd5eHeadlessAction(holder.state, {
    type: 'monster-special-action',
    actorId: actor.id,
    actionId: action.id,
    targetId: target.id,
    d20: random.die(20),
    d20Second: random.die(20),
  }, {
    transactionId: `${holder.state.combatId}:${holder.state.round}:${actor.id}:${action.id}`,
    now: holder.state.round,
  })
  if (!result.ok) return { handled: false, hits: 0, damage: 0, transactions: 0 }
  holder.state = result.state
  for (const candidate of actors) {
    const resolved = holder.state.combatants[candidate.id]
    if (resolved) {
      synchronizeSimulationActorFromHeadless(candidate, resolved)
    }
  }
  synchronizeControlledActors(holder, actors)
  const save = result.events.find((event) =>
    event.type === 'saving-throw-resolved' && event.targetId === target.id)
  if (action.control.changesAllegiance && save?.type === 'saving-throw-resolved' && save.success) {
    target.controlImmunities.add(controlImmunityKey(actor.id, action.id))
  }
  const actionUses = holder.state.combatants[actor.id]?.classState.monsterActionUsesByActionId?.[action.id]
  if (actionUses) actor.perDayUses.set(action.id, actionUses.current)
  const committed = result.transaction?.status === 'committed'
  return {
    handled: true,
    hits: save?.type === 'saving-throw-resolved' && !save.success ? 1 : 0,
    damage: 0,
    transactions: committed ? 1 : 0,
    steps: input.captureLog
      ? [...executionStepsFromEvents(result.events, actors), transactionStep(committed)]
      : undefined,
  }
}

function executeHeadlessWeaponAction(input: {
  actor: SimulationActor
  target: SimulationActor
  action: SimulationAction
  actors: SimulationActor[]
  holder: { state: Dnd5eHeadlessCombatState }
  random: SeededRandom
  attackMode: 'normal' | 'advantage' | 'disadvantage'
    captureLog: boolean
    battlefield?: SimulationBattlefield
}): SimulationExecutionResult {
  const { actor, target, action, actors, holder, random } = input
  if (action.spell || action.parts.length === 0) {
    return { handled: false, hits: 0, damage: 0, transactions: 0 }
  }
  synchronizeHeadlessActors(holder, actors, input.battlefield)
  const actorIndex = holder.state.initiativeOrder.indexOf(actor.id)
  if (actorIndex < 0) return { handled: false, hits: 0, damage: 0, transactions: 0 }
  holder.state.initiativeIndex = actorIndex
  const combatant = holder.state.combatants[actor.id]
  if (!combatant) return { handled: false, hits: 0, damage: 0, transactions: 0 }
  combatant.turn.actionAvailable = true
  combatant.turn.bonusActionAvailable = true
  combatant.turn.reactionAvailable = true
  combatant.turn.movementRemaining = actor.speed
  const hpBefore = target.hp
  let hits = 0
  let transactions = 0
  const attackDistanceFeet = actorDistanceFeet(actor, target, input.battlefield)
  const effectiveParts = action.parts.map((part) =>
    simulationAttackPartAtDistance(part, attackDistanceFeet, actor.hp / actor.maxHp))
  const packTacticsAdvantage = simulationMonsterPackTacticsAdvantage(
    actor,
    target,
    actors,
    input.battlefield,
  )
  const rangeDisadvantage = effectiveParts.some((part) => {
    const normal = part.mode === 'melee'
      ? part.reachFeet
      : part.rangeFeet?.normal ?? part.reachFeet
    return attackDistanceFeet > normal ||
      (part.mode !== 'melee' && attackDistanceFeet <= 5)
  })
  const rollMode = simulationAttackRollMode({
    baseMode: input.attackMode,
    packTacticsAdvantage,
    additionalDisadvantage: rangeDisadvantage,
  })
  const steps: Dnd5eCombatSimulationExecutionStep[] = input.captureLog
    ? [
        ...(input.attackMode !== 'normal'
          ? [{
              kind: 'result' as const,
              text: input.attackMode === 'advantage'
                ? `高地优势：${actor.name}比${target.name}高至少 10 尺，攻击检定具有优势。`
                : `低地劣势：${actor.name}比${target.name}低至少 10 尺，攻击检定具有劣势。`,
            }]
          : []),
        ...(packTacticsAdvantage
          ? [{
              kind: 'result' as const,
              text: `集群战术：${target.name} 5 尺内存在未失能的友方，攻击检定获得优势。`,
            }]
          : []),
      ]
    : []
  if (actor.monster) {
    const damageGroups = rollDamageGroups(effectiveParts, random)
    const targetCombatant = holder.state.combatants[target.id]
    const submittedDamageGroups: Array<readonly (readonly number[])[]> = []
    const submittedRolls = effectiveParts.map((part, index) => {
      const d20 = random.die(20)
      const d20Second = rollMode.requiresSecondD20 ? random.die(20) : undefined
      const targetArmorClass = dnd5eTargetArmorClassForAttack(holder.state, actor.id, target.id)
      const attackRoll = rules.resolveAttack({
        rolls: rollMode.resolvedMode === 'normal'
          ? [d20]
          : [d20, d20Second ?? d20],
        mode: rollMode.resolvedMode,
        modifier: part.toHit,
        targetAc: targetArmorClass,
      })
      const attackOutcome = resolveDnd5eAttackOutcome({
        attack: attackRoll,
        targetArmorClass,
        criticalThreshold: part.criticalThreshold,
        automaticCritical: targetCombatant
          ? dnd5eHitIsAutomaticCritical(holder.state, actor.id, targetCombatant)
          : false,
      })
      const { hit, critical } = attackOutcome
      const damageRolls = damageGroups[index].map((rolls, damageIndex) => {
        const definition = part.damages[damageIndex]
        return critical && definition
          ? [...rolls, ...Array.from({ length: definition.count }, () => random.die(definition.sides))]
          : rolls
      })
      if (critical) {
        for (const definition of part.monsterAttack?.criticalExtraDamage ?? []) {
          damageRolls.push(Array.from(
            { length: definition.count },
            () => random.die(definition.sides),
          ))
        }
      }
      submittedDamageGroups.push(damageRolls)
      const onHitEffectRolls = hit && targetCombatant
        ? (part.monsterAttack?.onHitEffects ?? []).map((effect) => {
            const saveMode = dnd5eSavingThrowMode(targetCombatant, effect.ability, {
              effectVisible: true,
              condition: effect.conditionOnFailedSave?.condition,
              sourceCreatureType: actor.monster?.creatureType,
              sourceIsSpell: false,
            })
            return {
              effectId: effect.id,
              d20: random.die(20),
              d20Second: saveMode !== 'normal' ? random.die(20) : undefined,
              blessRoll: dnd5eCombatantHasConcentrationEffect(holder.state, target.id, 'bless')
                ? random.die(4)
                : undefined,
              baneRoll: dnd5eCombatantHasConcentrationEffect(holder.state, target.id, 'bane')
                ? random.die(4)
                : undefined,
              damageRolls: effect.damage.map((damage) =>
                Array.from({ length: damage.count }, () => random.die(damage.sides))),
            }
          })
        : undefined
      return {
        targetId: target.id,
        d20,
        d20Second,
        mode: input.attackMode,
        damageRolls,
        onHitEffectRolls,
      }
    })
    const result = resolveDnd5eHeadlessAction(holder.state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: action.id,
      rolls: submittedRolls,
    }, {
      transactionId: `${holder.state.combatId}:${holder.state.round}:${actor.id}:${action.id}`,
      now: holder.state.round,
    })
    if (!result.ok) {
      // Catalog monster actions admitted here are declared Headless. Falling
      // through to the legacy average-damage path would silently turn a
      // rolled-back authoritative transaction into fabricated training data.
      return {
        handled: true,
        hits: 0,
        damage: 0,
        transactions: 0,
        steps: input.captureLog
          ? [
              {
                kind: 'result',
                text: `Headless 事务回滚：${action.name}（${result.reason}）`,
              },
              transactionStep(false),
            ]
          : undefined,
      }
    }
    holder.state = result.state
    hits = result.events.filter((event) => event.type === 'attack-resolved' && event.hit).length
    transactions = result.transaction?.status === 'committed' ? 1 : 0
    if (input.captureLog) {
      steps.push(
        ...weaponExecutionSteps(result.events, actors, effectiveParts, submittedDamageGroups),
        transactionStep(transactions > 0),
      )
    }
  } else {
    let state = holder.state
    for (const [index, part] of effectiveParts.entries()) {
      const damage = part.damages[0]
      if (!damage) continue
      const classDamageContext = {
        weaponId: part.weaponId,
        mode: part.mode === 'ranged' ? 'ranged' as const : 'melee' as const,
        distanceFeet: attackDistanceFeet,
        normalRangeFeet: part.rangeFeet?.normal,
        longRangeFeet: part.rangeFeet?.long,
        finesse: part.finesse === true,
        strengthBased: part.strengthBased === true,
        monkMartialArtsEligible: part.monkMartialArtsEligible === true,
        weaponDamageSides: damage.sides,
        damageType: damage.type,
        adjacentEnemyOfTarget: false,
      }
      const d20 = random.die(20)
      const d20Second = rollMode.requiresSecondD20 ? random.die(20) : undefined
      const damageRolls = Array.from({ length: damage.count }, () => random.die(damage.sides))
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'attack',
        actorId: actor.id,
        targetId: target.id,
        attackModifier: part.toHit,
        criticalThreshold: part.criticalThreshold,
        d20,
        d20Second,
        mode: input.attackMode,
        spendAction: index === 0,
        damage: {
          ...damage,
          rolls: damageRolls,
        },
        classDamageContext,
      }, {
        transactionId: `${holder.state.combatId}:${holder.state.round}:${actor.id}:${action.id}:${index}`,
        now: holder.state.round,
      })
      if (!result.ok) return index === 0
        ? { handled: false, hits: 0, damage: 0, transactions: 0 }
        : { handled: true, hits, damage: Math.max(0, hpBefore - target.hp), transactions }
      state = result.state
      holder.state = state
      hits += result.events.some((event) => event.type === 'attack-resolved' && event.hit) ? 1 : 0
      if (result.transaction?.status === 'committed') transactions += 1
      if (input.captureLog) {
        steps.push(
          ...weaponExecutionSteps(result.events, actors, [part], [[damageRolls]]),
          transactionStep(result.transaction?.status === 'committed'),
        )
      }
      const nextTargetHp = state.combatants[target.id]?.currentHp
      if (nextTargetHp != null && nextTargetHp <= 0) break
    }
  }
  for (const candidate of actors) {
    const resolved = holder.state.combatants[candidate.id]
    if (resolved) {
      synchronizeSimulationActorFromHeadless(candidate, resolved)
    }
  }
  const resolvedActor = holder.state.combatants[actor.id]
  const actionUses = resolvedActor?.classState.monsterActionUsesByActionId?.[action.id]
  if (actionUses) actor.perDayUses.set(action.id, actionUses.current)
  const rechargeReady = resolvedActor?.classState.monsterRechargeReadyByActionId?.[action.id]
  if (rechargeReady != null) actor.rechargeReady.set(action.id, rechargeReady)
  return {
    handled: true,
    hits,
    damage: Math.max(0, hpBefore - target.hp),
    transactions,
    steps: input.captureLog ? steps : undefined,
  }
}

function executeHeadlessSpellAction(input: {
  actor: SimulationActor
  target: SimulationActor
  action: SimulationAction
  actors: readonly SimulationActor[]
  holder: { state: Dnd5eHeadlessCombatState }
  random: SeededRandom
  attackMode: 'normal' | 'advantage' | 'disadvantage'
    captureLog: boolean
    battlefield?: SimulationBattlefield
    targetIds?: readonly string[]
    projectileTargetIds?: readonly string[]
}): SimulationExecutionResult {
  const { actor, target, action, actors, holder, random } = input
  const spell = action.spell
  if (!spell) {
    return { handled: false, hits: 0, damage: 0, transactions: 0 }
  }
  synchronizeHeadlessActors(holder, actors, input.battlefield)
  const actorIndex = holder.state.initiativeOrder.indexOf(actor.id)
  const combatant = holder.state.combatants[actor.id]
  if (actorIndex < 0 || !combatant) {
    return { handled: false, hits: 0, damage: 0, transactions: 0 }
  }
  holder.state.initiativeIndex = actorIndex
  combatant.turn.actionAvailable = true
  combatant.turn.bonusActionAvailable = true
  combatant.turn.reactionAvailable = true
  const resolvedTargetIds = [...new Set(input.targetIds?.length ? input.targetIds : [target.id])]
    .filter((targetId) => holder.state.combatants[targetId] != null)
  for (const targetId of resolvedTargetIds) {
    const targetCombatant = holder.state.combatants[targetId]
    if (targetCombatant) targetCombatant.dodging = input.attackMode === 'disadvantage'
  }
  const hpBeforeByTargetId = new Map(resolvedTargetIds.map((targetId) => [
    targetId,
    actors.find((candidate) => candidate.id === targetId)?.hp ?? 0,
  ]))
  const effectRolls = spell.effect === 'automatic-damage'
    ? Array.from({ length: spell.dice.count }, () => [random.die(spell.dice.sides)])
    : ['spell-attack', 'saving-throw', 'healing', 'fixed-healing', 'temporary-hit-points'].includes(spell.effect)
      ? [Array.from({ length: spell.dice.count }, () => random.die(spell.dice.sides))]
      : []
  const targetSavingThrows = spell.effect === 'saving-throw'
    ? resolvedTargetIds.map((targetId) => ({
        targetId,
        d20: random.die(20),
        d20Second: random.die(20),
      }))
    : undefined
  const singleTargetSavingThrow = targetSavingThrows?.length === 1
    ? targetSavingThrows[0]
    : undefined
  const forcedMovements = !actor.monster && targetSavingThrows
    ? simulationThunderwaveForcedMovements({
        actor,
        action,
        actors,
        holder,
        battlefield: input.battlefield,
        targetSavingThrows,
        random,
      })
    : undefined
  const resolution = {
      schemaVersion: 1,
      targetIds: resolvedTargetIds,
      projectileTargetIds: spell.effect === 'automatic-damage'
        ? input.projectileTargetIds ?? Array.from({ length: spell.dice.count }, () => target.id)
        : undefined,
      d20: spell.effect === 'spell-attack' ? random.die(20) : undefined,
      d20Second: spell.effect === 'spell-attack' && input.attackMode !== 'normal'
        ? random.die(20)
        : undefined,
      targetSavingThrows,
      effectRolls,
    } as const
  const result = resolveDnd5eHeadlessAction(holder.state, actor.monster ? {
    type: 'monster-core-spell',
    actorId: actor.id,
    spellId: spell.id,
    slotLevel: spell.slotLevel,
    resolution,
  } : {
    type: 'cast-spell',
    actorId: actor.id,
    castingClassId: spell.castingClassId,
    targetId: target.id,
    targetIds: resolvedTargetIds,
    projectileTargetIds: resolution.projectileTargetIds,
    spellId: spell.id,
    slotLevel: spell.slotLevel,
    d20: resolution.d20,
    d20Second: resolution.d20Second,
    mode: input.attackMode,
    savingThrowD20: singleTargetSavingThrow?.d20,
    savingThrowD20Second: singleTargetSavingThrow?.d20Second,
    targetSavingThrows: targetSavingThrows && targetSavingThrows.length > 1
      ? targetSavingThrows
      : undefined,
    forcedMovements,
    effectRolls: effectRolls.flat(),
  }, {
    transactionId: `${holder.state.combatId}:${holder.state.round}:${actor.id}:${action.id}`,
    now: holder.state.round,
  })
  if (!result.ok) return { handled: false, hits: 0, damage: 0, transactions: 0 }
  holder.state = result.state
  for (const candidate of actors) {
    const resolved = holder.state.combatants[candidate.id]
    if (!resolved) continue
    synchronizeSimulationActorFromHeadless(candidate, resolved)
    candidate.position = resolved.position.x
    candidate.positionY = resolved.position.y
    candidate.elevationFeet = resolved.elevationFeet ?? candidate.elevationFeet
  }
  const resolvedActor = holder.state.combatants[actor.id]
  const listedSpellUses = resolvedActor?.classState.monsterSpellUsesBySpellId?.[spell.id]
  if (listedSpellUses) actor.perDayUses.set(action.id, listedSpellUses.current)
  const slot = resolvedActor?.classState.monsterSpellSlots?.[String(spell.slotLevel)]
  if (slot) actor.spellSlots.set(spell.slotLevel, slot.current)
  if (!actor.monster && spell.slotLevel > 0) {
    const resourceKey = spell.castingClassId === 'warlock'
      ? 'dnd5e-pact-slot'
      : `dnd5e-spell-slot-${spell.slotLevel}`
    const resource = resolvedActor?.classResources[resourceKey]
    if (resource) actor.spellSlots.set(spell.slotLevel, resource.current)
  }
  const hostileDamage = resolvedTargetIds.reduce((sum, targetId) => {
    const candidate = actors.find((entry) => entry.id === targetId)
    if (!candidate || effectiveSide(candidate, actors) === effectiveSide(actor, actors)) return sum
    return sum + Math.max(0, (hpBeforeByTargetId.get(targetId) ?? 0) - candidate.hp)
  }, 0)
  const alliedHealing = resolvedTargetIds.reduce((sum, targetId) => {
    const candidate = actors.find((entry) => entry.id === targetId)
    if (!candidate || effectiveSide(candidate, actors) !== effectiveSide(actor, actors)) return sum
    return sum + Math.max(0, candidate.hp - (hpBeforeByTargetId.get(targetId) ?? 0))
  }, 0)
  const hits = result.events.filter((event) =>
    (event.type === 'attack-resolved' && event.hit) ||
    (event.type === 'saving-throw-resolved' && !event.success)).length ||
    (hostileDamage > 0 ? 1 : 0)
  const committed = result.transaction?.status === 'committed' || !actor.monster
  const rollSteps: Dnd5eCombatSimulationExecutionStep[] = input.captureLog
    ? [
        ...(input.attackMode !== 'normal' && spell.effect === 'spell-attack'
          ? [{
              kind: 'result' as const,
              text: input.attackMode === 'advantage'
                ? `高地优势：${actor.name}的法术攻击检定具有优势。`
                : `低地劣势：${actor.name}的法术攻击检定具有劣势。`,
            }]
          : []),
        ...(effectRolls.flat().length > 0
          ? [{
          kind: 'roll',
          text: `法术效果骰：[${effectRolls.flat().join(', ')}]`,
          } as const]
          : []),
      ]
    : []
  return {
    handled: true,
    hits,
    damage: hostileDamage,
    healing: alliedHealing,
    transactions: committed ? 1 : 0,
    steps: input.captureLog
      ? [...rollSteps, ...executionStepsFromEvents(result.events, actors), transactionStep(committed)]
      : undefined,
  }
}

function executeAction(
  actor: SimulationActor,
  decision: SimulationDecision,
  actors: SimulationActor[],
  random: SeededRandom,
  dodgingIds: ReadonlySet<string>,
  headless: { state: Dnd5eHeadlessCombatState },
  captureLog: boolean,
  battlefield?: SimulationBattlefield,
): {
  action?: SimulationAction
  target?: SimulationActor
  hits: number
  damage: number
  healing?: number
  transactions: number
  steps?: Dnd5eCombatSimulationExecutionStep[]
} {
  actor.position = decision.nextPosition
  actor.positionY = decision.nextPositionY ?? actor.positionY
  actor.elevationFeet = decision.nextElevationFeet ?? actor.elevationFeet
  const action = actor.actions.find((candidate) => candidate.id === decision.actionId)
  let target = actors.find((candidate) => candidate.id === decision.targetId && candidate.hp > 0)
  if (!action || !target || !availableAction(actor, action)) {
    return { hits: 0, damage: 0, transactions: 0 }
  }
  const headlessControlResult = executeHeadlessControlAction({
    actor,
    target,
    action,
    actors,
    holder: headless,
    random,
    captureLog,
    battlefield,
  })
  if (headlessControlResult.handled) return { action, target, ...headlessControlResult }
  const headlessSpellResult = executeHeadlessSpellAction({
    actor,
    target,
    action,
    actors,
    holder: headless,
    random,
    attackMode: elevationAttackMode(actor, target, dodgingIds.has(target.id)),
    captureLog,
    battlefield,
    targetIds: decision.targetIds,
    projectileTargetIds: decision.projectileTargetIds,
  })
  if (headlessSpellResult.handled) return { action, target, ...headlessSpellResult }
  const headlessResult = executeHeadlessWeaponAction({
    actor,
    target,
    action,
    actors,
    holder: headless,
    random,
    attackMode: elevationAttackMode(actor, target, dodgingIds.has(target.id)),
    captureLog,
    battlefield,
  })
  if (headlessResult.handled) return { action, target, ...headlessResult }
  if (action.usage?.kind === 'per-day') {
    actor.perDayUses.set(action.id, Math.max(0, (actor.perDayUses.get(action.id) ?? 0) - 1))
  }
  if (action.usage?.kind === 'recharge') actor.rechargeReady.set(action.id, false)
  if (action.spell?.consumesSpellSlot) {
    actor.spellSlots.set(
      action.spell.slotLevel,
      Math.max(0, (actor.spellSlots.get(action.spell.slotLevel) ?? 0) - 1),
    )
  }

  if (action.spell) {
    const spell = action.spell
    const distance = actorDistanceFeet(actor, target, battlefield)
    if (distance > spell.rangeFeet) return { action, target, hits: 0, damage: 0, transactions: 0 }
    if (simulationLimitedMagicImmunityNegates(target, spell.slotLevel)) {
      return { action, target, hits: 0, damage: 0, transactions: 0 }
    }
    if (spell.effect === 'power-word-kill') {
      if (target.hp <= 100) {
        const dealt = target.hp
        target.hp = 0
        target.deathSaves = { stable: false, dead: true }
        return { action, target, hits: 1, damage: dealt, transactions: 0 }
      }
      return { action, target, hits: 1, damage: 0, transactions: 0 }
    }
    let applies = false
    let halfDamage = false
    let critical = false
    if (spell.effect === 'spell-attack' && spell.attackBonus != null) {
      const mode = elevationAttackMode(actor, target, distance <= 5 || dodgingIds.has(target.id))
      const first = random.die(20)
      const second = mode !== 'normal' ? random.die(20) : first
      const roll = mode === 'advantage'
        ? Math.max(first, second)
        : mode === 'disadvantage' ? Math.min(first, second) : first
      const attack = rules.resolveAttack({
        rolls: [roll],
        mode: 'normal',
        modifier: spell.attackBonus,
        targetAc: target.ac,
      })
      applies = attack.hit
      critical = attack.critical
    } else if (spell.effect === 'saving-throw' && spell.saveAbility && spell.saveDc != null) {
      const total = random.die(20) + target.savingThrowModifiers[spell.saveAbility]
      applies = total < spell.saveDc
      halfDamage = !applies && spell.damageOnSuccessfulSave === 'half'
    }
    if (!applies && !halfDamage) return { action, target, hits: 0, damage: 0, transactions: 0 }
    let rawDamage = spell.dice.bonus
    const count = spell.dice.count * (critical ? 2 : 1)
    for (let dieIndex = 0; dieIndex < count; dieIndex += 1) {
      rawDamage += random.die(spell.dice.sides)
    }
    if (halfDamage) rawDamage = Math.floor(rawDamage / 2)
    const dealt = applyDamage(
      target,
      rawDamage,
      spell.damageType ?? 'force',
      simulationSpellDamageSource(actor, spell.slotLevel),
    )
    return { action, target, hits: applies ? 1 : 0, damage: dealt, transactions: 0 }
  }

  let hits = 0
  let totalDamage = 0
  for (const sourcePart of action.parts) {
    if (!target || target.hp <= 0) {
      const actorSide = effectiveSide(actor, actors)
      target = actors.filter((candidate) =>
        effectiveSide(candidate, actors) !== actorSide && candidate.hp > 0)
        .sort((left, right) =>
          actorDistanceFeet(actor, left, battlefield) - actorDistanceFeet(actor, right, battlefield))[0]
    }
    if (!target) break
    const distance = actorDistanceFeet(actor, target, battlefield)
    const part = simulationAttackPartAtDistance(
      sourcePart,
      distance,
      actor.hp / actor.maxHp,
    )
    const maximum = part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.long ?? 0
    if (distance > maximum) continue
    const normal = part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.normal ?? maximum
    const attackMode = simulationAttackRollMode({
      baseMode: elevationAttackMode(actor, target, dodgingIds.has(target.id)),
      packTacticsAdvantage: simulationMonsterPackTacticsAdvantage(
        actor,
        target,
        actors,
        battlefield,
      ),
      additionalDisadvantage: distance > normal || (part.mode !== 'melee' && distance <= 5),
    })
    const first = random.die(20)
    const second = attackMode.requiresSecondD20 ? random.die(20) : first
    const roll = attackMode.resolvedMode === 'advantage'
      ? Math.max(first, second)
      : attackMode.resolvedMode === 'disadvantage' ? Math.min(first, second) : first
    const attack = rules.resolveAttack({ rolls: [roll], mode: 'normal', modifier: part.toHit, targetAc: target.ac })
    if (!attack.hit) continue
    hits += 1
    const critical = attack.critical || roll >= part.criticalThreshold
    const damages = actor.hp / actor.maxHp <= 0.5 && part.damagesAtHalfHp
      ? part.damagesAtHalfHp
      : part.damages
    for (const damage of damages) {
      let rawDamage = damage.bonus
      const count = damage.count * (critical ? 2 : 1)
      for (let dieIndex = 0; dieIndex < count; dieIndex += 1) rawDamage += random.die(damage.sides)
      const dealt = applyDamage(
        target,
        Math.max(0, rawDamage),
        damage.type,
        simulationWeaponDamageSource(actor, action),
      )
      totalDamage += dealt
    }
  }
  return { action, target, hits, damage: totalDamage, transactions: 0 }
}

function resolveControlRepeatSaves(
  actors: SimulationActor[],
  random: SeededRandom,
  headless: { state: Dnd5eHeadlessCombatState },
  captureLog: boolean,
): { transactions: number; steps: Dnd5eCombatSimulationExecutionStep[] } {
  let transactions = 0
  const steps: Dnd5eCombatSimulationExecutionStep[] = []
  for (const actor of actors) {
    const combatant = headless.state.combatants[actor.id]
    const pendingIds = [...(combatant?.classState.activeEffectDamageSavePendingIds ?? [])]
    for (const effectId of pendingIds) {
      const sourceId = actor.controlledById
      const result = resolveDnd5eHeadlessAction(headless.state, {
        type: 'active-effect-damage-save',
        actorId: actor.id,
        effectId,
        d20: random.die(20),
        d20Second: random.die(20),
      }, {
        transactionId: `${headless.state.combatId}:${headless.state.round}:${headless.state.initiativeIndex}:${actor.id}:repeat-save:${effectId}`,
        now: headless.state.round,
      })
      if (!result.ok) continue
      headless.state = result.state
      const resolvedActor = headless.state.combatants[actor.id]
      if (resolvedActor) {
        synchronizeSimulationActorFromHeadless(actor, resolvedActor)
      }
      const committed = result.transaction?.status === 'committed'
      if (committed) transactions += 1
      if (captureLog) {
        steps.push(...executionStepsFromEvents(result.events, actors), transactionStep(committed))
      }
      synchronizeControlledActors(headless, actors)
      if (sourceId && !actor.controlledById) {
        actor.controlImmunities.add(controlImmunityKey(sourceId, 'enslave'))
      }
    }
  }
  return { transactions, steps }
}

function simulationActiveEffectSavingThrows(
  state: Dnd5eHeadlessCombatState,
  targetId: string,
  timing: 'target-turn-start' | 'target-turn-end',
  random: SeededRandom,
): Dnd5eActiveEffectSavingThrowRoll[] {
  const target = state.combatants[targetId]
  if (!target) return []
  return normalizeDnd5eActiveEffects(target.classState.activeEffects)
    .filter((effect) => effect.repeatSave?.timing === timing)
    .map((effect) => {
      const repeatSave = effect.repeatSave!
      const source = effect.source.actorId ? state.combatants[effect.source.actorId] : undefined
      const mode = dnd5eSavingThrowMode(target, repeatSave.ability, {
        effectVisible: effect.visibility !== 'dm-only',
        condition: effect.standardCondition,
        sourceCreatureType: source?.creatureType,
        sourceIsSpell: effect.source.kind === 'spell',
      })
      const failureDamage = repeatSave.damageOnFailure
      return {
        effectId: effect.id,
        d20: random.die(20),
        d20Second: mode !== 'normal' ? random.die(20) : undefined,
        blessRoll: dnd5eCombatantHasConcentrationEffect(state, target.id, 'bless')
          ? random.die(4)
          : undefined,
        baneRoll: dnd5eCombatantHasConcentrationEffect(state, target.id, 'bane')
          ? random.die(4)
          : undefined,
        damageRolls: failureDamage
          ? Array.from({ length: failureDamage.count }, () => random.die(failureDamage.sides))
          : undefined,
      }
    })
}

function simulationMonsterMechanicRolls(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  event: 'turn-start' | 'turn-end',
  round: number,
  random: SeededRandom,
): Dnd5eMonsterMechanicRoll[] {
  const actor = state.combatants[actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  if (!actor || !monster) return []
  return dnd5eEligibleMonsterMechanics(monster, event, {
    combatId: state.combatId,
    round,
    actorId,
    currentHp: actor.currentHp,
    maxHp: actor.maxHp,
    usedKeys: actor.classState.declarativeUsedTurnKeys,
  }).map((mechanic) => ({
    actorId,
    mechanicId: mechanic.id,
    effectRolls: dnd5eMonsterMechanicDiceRequirements(mechanic).map((requirement) => ({
      effectId: requirement.effectId,
      rolls: Array.from({ length: requirement.count }, () => random.die(requirement.sides)),
    })),
  }))
}

function simulationMonsterRechargeRolls(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  random: SeededRandom,
): Dnd5eMonsterRechargeRoll[] {
  const actor = state.combatants[actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  if (!actor || !monster) return []
  return dnd5eMonsterRechargeActions(monster).flatMap((action) => {
    const usage = action.usage
    if (
      usage?.kind !== 'recharge' ||
      actor.classState.monsterRechargeReadyByActionId?.[action.id] !== false
    ) return []
    return [{
      actorId,
      actionId: action.id,
      roll: random.die(usage.dieSides),
    }]
  })
}

function settleSimulationEndTurn(input: {
  actor: SimulationActor
  actors: SimulationActor[]
  holder: { state: Dnd5eHeadlessCombatState }
  random: SeededRandom
  captureLog: boolean
  battlefield?: SimulationBattlefield
}): { transactions: number; steps: Dnd5eCombatSimulationExecutionStep[] } {
  const { actor, actors, holder, random } = input
  synchronizeHeadlessActors(holder, actors, input.battlefield)
  const livingActorIds = new Set(
    actors.filter((candidate) => candidate.hp > 0 || candidate.id === actor.id)
      .map((candidate) => candidate.id),
  )
  holder.state.initiativeOrder = holder.state.initiativeOrder.filter((actorId) =>
    livingActorIds.has(actorId))
  const actorIndex = holder.state.initiativeOrder.indexOf(actor.id)
  const actorCombatant = holder.state.combatants[actor.id]
  if (actorIndex < 0 || !actorCombatant) return { transactions: 0, steps: [] }
  holder.state.initiativeIndex = actorIndex

  // Legacy simulation fallbacks record suppression types outside Headless.
  // Fold them back into authoritative state before the next creature starts.
  for (const candidate of actors) {
    if (candidate.damageTypesSinceTurn.size === 0) continue
    const combatant = holder.state.combatants[candidate.id]
    if (!combatant) continue
    combatant.classState.monsterRegenerationSuppressedDamageTypes = [
      ...new Set([
        ...(combatant.classState.monsterRegenerationSuppressedDamageTypes ?? []),
        ...candidate.damageTypesSinceTurn,
      ]),
    ]
  }

  const nextIndex = (actorIndex + 1) % holder.state.initiativeOrder.length
  const nextActorId = holder.state.initiativeOrder[nextIndex]
  const nextRound = nextIndex === 0 ? holder.state.round + 1 : holder.state.round
  const result = resolveDnd5eHeadlessAction(holder.state, {
    type: 'end-turn',
    actorId: actor.id,
    activeEffectSavingThrows: simulationActiveEffectSavingThrows(
      holder.state,
      actor.id,
      'target-turn-end',
      random,
    ),
    turnStartActiveEffectSavingThrows: simulationActiveEffectSavingThrows(
      holder.state,
      nextActorId,
      'target-turn-start',
      random,
    ),
    currentMonsterMechanicRolls: simulationMonsterMechanicRolls(
      holder.state,
      actor.id,
      'turn-end',
      holder.state.round,
      random,
    ),
    nextMonsterMechanicRolls: simulationMonsterMechanicRolls(
      holder.state,
      nextActorId,
      'turn-start',
      nextRound,
      random,
    ),
    nextMonsterRechargeRolls: simulationMonsterRechargeRolls(
      holder.state,
      nextActorId,
      random,
    ),
  }, {
    transactionId: `${holder.state.combatId}:${holder.state.round}:${actor.id}:end-turn`,
    now: holder.state.round,
  })
  if (!result.ok) {
    return {
      transactions: 0,
      steps: input.captureLog
        ? [
            { kind: 'result', text: `Headless 回合结束事务回滚：${actor.name}（${result.reason}）` },
            transactionStep(false),
          ]
        : [],
    }
  }

  holder.state = result.state
  for (const candidate of actors) {
    const resolved = holder.state.combatants[candidate.id]
    if (!resolved) continue
    synchronizeSimulationActorFromHeadless(candidate, resolved)
    candidate.position = resolved.position.x
    candidate.positionY = resolved.position.y
    candidate.elevationFeet = resolved.elevationFeet ?? candidate.elevationFeet
    for (const [actionId, ready] of Object.entries(
      resolved.classState.monsterRechargeReadyByActionId ?? {},
    )) {
      candidate.rechargeReady.set(actionId, ready)
    }
  }
  actors.find((candidate) => candidate.id === nextActorId)?.damageTypesSinceTurn.clear()
  const committed = result.transaction?.status === 'committed'
  return {
    transactions: committed ? 1 : 0,
    steps: input.captureLog
      ? [...executionStepsFromEvents(result.events, actors), transactionStep(committed)]
      : [],
  }
}

function simulationHeadlessCombatant(
  actor: SimulationActor,
  initiative: number,
) {
  if (actor.character) {
    const combatant = createCombatantFromDnd5eCharacter({
      character: migrateCharacterToDnd5e({
        ...syncCharacterClassResources(actor.character),
        currentHp: actor.hp,
        maxHp: actor.maxHp,
      }),
      controller: 'player',
      initiativeD20: Math.max(1, Math.min(20, initiative - actor.initiativeBonus)),
      position: { x: actor.position, y: actor.positionY },
    })
    return {
      ...combatant,
      id: actor.id,
      name: actor.name,
      initiative,
      currentHp: actor.hp,
      maxHp: actor.maxHp,
      classState: {
        ...combatant.classState,
        activeEffects: actor.activeEffects.length > 0 ? actor.activeEffects : undefined,
      },
      conditions: dnd5eConditionsFromActiveEffects(actor.activeEffects),
      elevationFeet: actor.elevationFeet,
      usesDeathSaves: false,
      deathSaves: {
        successes: 0,
        failures: actor.deathSaves.dead ? 3 : 0,
        stable: actor.deathSaves.stable,
        dead: actor.deathSaves.dead,
      },
      mainWeaponId: actor.character.equipment?.mainWeapon?.id,
      weaponDamageSources: actor.weaponDamageSources
        ? Object.fromEntries(Object.entries(actor.weaponDamageSources)
            .map(([weaponId, source]) => [weaponId, { ...source }]))
        : undefined,
      weaponAttacksMagical: actor.weaponAttacksMagical,
      moralAlignment: actor.moralAlignment,
      damageVulnerabilities: [...actor.vulnerabilities],
      damageResistances: [...actor.resistances],
      damageImmunities: [...actor.immunities],
      damageDefenseRules: actor.damageDefenseRules.map((rule) => ({
        ...rule,
        damageTypes: rule.damageTypes ? [...rule.damageTypes] : undefined,
      })),
    }
  }
  const combatant = createDnd5eCombatant({
    id: actor.id,
    name: actor.name,
    controller: actor.side === 'players' ? 'player' : 'dm',
    initiative,
    abilities: actor.monster ? { ...actor.monster.abilities } : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrowBonuses: actor.savingThrowModifiers,
    proficiencyBonus: actor.monster ? rules.proficiencyBonus(Math.max(1, Number(actor.monster.challenge.rating) || 1)) : 2,
    armorClass: actor.ac,
    currentHp: actor.hp,
    maxHp: actor.maxHp,
    temporaryHp: 0,
    speed: actor.speed,
    position: { x: actor.position, y: actor.positionY },
    elevationFeet: actor.elevationFeet,
    concentrating: false,
    usesDeathSaves: false,
    classState: actor.monster ? {
      activeEffects: actor.activeEffects.length > 0 ? actor.activeEffects : undefined,
      monsterRechargeReadyByActionId: Object.fromEntries(actor.actions.flatMap((action) =>
        action.usage?.kind === 'recharge' ? [[action.id, true]] : [])),
      monsterActionUsesByActionId: Object.fromEntries(actor.actions.flatMap((action) =>
        action.usage?.kind === 'per-day'
          ? [[action.id, { current: action.usage.max, max: action.usage.max }]]
          : [])),
      monsterSpellSlots: actor.monster.spellcasting?.slots
        ? Object.fromEntries(Object.entries(actor.monster.spellcasting.slots).map(([level, maximum]) => [
            level,
            { current: maximum, max: maximum },
          ]))
        : undefined,
      monsterSpellUsesBySpellId: actor.monster.spellcasting?.spells
        ? Object.fromEntries(actor.monster.spellcasting.spells.flatMap((spell) =>
            spell.usage?.kind === 'per-day'
              ? [[spell.id, { current: spell.usage.max, max: spell.usage.max }]]
              : []))
        : undefined,
    } : undefined,
    statBlockId: actor.monster?.id,
    creatureType: actor.monster?.creatureType,
    damageVulnerabilities: [...actor.vulnerabilities],
    damageResistances: [...actor.resistances],
    damageImmunities: [...actor.immunities],
    damageDefenseRules: actor.damageDefenseRules,
    weaponAttacksMagical: actor.weaponAttacksMagical,
    moralAlignment: actor.moralAlignment,
    conditionImmunities: actor.monster?.conditionImmunities,
    magicResistance: actor.monster ? dnd5eMonsterHasMagicResistance(actor.monster) : undefined,
  })
  combatant.deathSaves = {
    successes: 0,
    failures: actor.deathSaves.dead ? 3 : 0,
    stable: actor.deathSaves.stable,
    dead: actor.deathSaves.dead,
  }
  return combatant
}

function simulateTrial(
  actors: SimulationActor[],
  random: SeededRandom,
  maxRounds: number,
  telemetry: SimulationTelemetry,
  trialIndex: number,
  characters: readonly Character[],
  battlefield?: SimulationBattlefield,
  strategyTraining?: Dnd5eCombatSimulationRequest['strategyTraining'],
  baseDecisionProvider: MonsterDecisionProvider = DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  recordLearning = true,
): { winner: 'players' | 'monsters' | 'draw'; rounds: number } {
  const explorationRate = strategyTraining?.enabled
    ? Math.max(0, Math.min(0.5, strategyTraining.explorationRate ?? 0.08))
    : 0
  const terminalRewardWeight = strategyTraining?.enabled
    ? Math.max(0, Math.min(4, strategyTraining.terminalRewardWeight ?? 0.75))
    : 0
  const decisionProvider = exploringDecisionProvider(random, explorationRate, baseDecisionProvider)
  const learningSamples: Array<{
    monsterId: string
    side: 'players' | 'monsters'
    metrics: Readonly<MonsterDecisionMetrics>
    damage: number
    healing?: number
    hits: number
    executed: boolean
    defeatedTarget: boolean
  }> = []
  const finish = (
    winner: 'players' | 'monsters' | 'draw',
    rounds: number,
  ): { winner: 'players' | 'monsters' | 'draw'; rounds: number } => {
    if (recordLearning) {
      for (const sample of learningSamples) {
        const terminalReward = winner === 'draw'
          ? 0
          : winner === sample.side ? terminalRewardWeight : -terminalRewardWeight
        observeDnd5eStrategyOutcome(telemetry.strategyLearning, {
          ...sample,
          terminalReward,
        })
      }
    }
    return { winner, rounds }
  }
  const initiativeRolls = new Map(actors.map((actor) => [
    actor.id,
    random.die(20) + actor.initiativeBonus,
  ]))
  const initiative = [...actors].sort((left, right) =>
    (initiativeRolls.get(right.id) ?? 0) - (initiativeRolls.get(left.id) ?? 0) ||
    right.initiativeBonus - left.initiativeBonus ||
    left.id.localeCompare(right.id))
  const headless = {
    state: startDnd5eHeadlessCombat(
      `simulation:${trialIndex}`,
      initiative.map((actor) =>
        simulationHeadlessCombatant(actor, initiativeRolls.get(actor.id) ?? 0)),
    ),
  }
  const dodgingIds = new Set<string>()
  for (let round = 1; round <= maxRounds; round += 1) {
    headless.state.round = round
    const roundTotal = telemetry.roundTotals.get(round) ?? {
      appearances: 0,
      playerDamage: 0,
      monsterDamage: 0,
      playerDeaths: 0,
      monsterDeaths: 0,
    }
    roundTotal.appearances += 1
    telemetry.roundTotals.set(round, roundTotal)
    for (const actor of initiative) {
      if (actor.hp <= 0) continue
      synchronizeControlledActors(headless, actors)
      if (battlefield) synchronizeBattlefieldTokens(battlefield, actors)
      dodgingIds.delete(actor.id)
      const actingSide = effectiveSide(actor, actors)
      const captureExecutionLog = trialIndex === 0 && telemetry.decisionLog.length < 300
      const turnSteps: Dnd5eCombatSimulationExecutionStep[] = captureExecutionLog
        ? [{
            kind: 'turn',
            text: `回合开始：${actor.name}，HP ${actor.hp}/${actor.maxHp}，位置 (${Math.round(actor.position)}, ${Math.round(actor.positionY)})`,
          }]
        : []
      const opponents = actors.filter((candidate) =>
        effectiveSide(candidate, actors) !== actingSide && candidate.hp > 0)
      if (opponents.length === 0) return finish(actingSide, round)
      const actorPositionBefore = { x: actor.position, y: actor.positionY }
      const actorElevationBeforeFeet = actor.elevationFeet
      const decision = actingSide === 'monsters'
        ? monsterDecision(
            actor,
            opponents,
            actors,
            characters,
            battlefield,
            decisionProvider,
            captureExecutionLog,
          )
        : playerDecision(actor, opponents, actors, battlefield, decisionProvider, captureExecutionLog)
      const selectedAction = actor.actions.find((action) => action.id === decision.actionId)
      const selectedTarget = actors.find((candidate) => candidate.id === decision.targetId)
      if (decision.dodges) dodgingIds.add(actor.id)
      const targetHpBefore = selectedTarget?.hp ?? 0
      const deadBeforeByActorId = new Map(actors.map((candidate) => [
        candidate.id,
        candidate.deathSaves.dead,
      ]))
      const executed = executeAction(
        actor,
        decision,
        actors,
        random,
        dodgingIds,
        headless,
        captureExecutionLog,
        battlefield,
      )
      const repeatSaves = resolveControlRepeatSaves(actors, random, headless, captureExecutionLog)
      executed.transactions += repeatSaves.transactions
      if (captureExecutionLog && repeatSaves.steps.length > 0) {
        executed.steps = [...(executed.steps ?? []), ...repeatSaves.steps]
      }
      const actionTransactions = executed.transactions
      const endTurn = settleSimulationEndTurn({
        actor,
        actors,
        holder: headless,
        random,
        captureLog: captureExecutionLog,
        battlefield,
      })
      executed.transactions += endTurn.transactions
      if (captureExecutionLog && endTurn.steps.length > 0) {
        executed.steps = [...(executed.steps ?? []), ...endTurn.steps]
      }
      synchronizeControlledActors(headless, actors)
      if (battlefield) synchronizeBattlefieldTokens(battlefield, actors)
      const selectedMetrics = decision.metrics ??
        decision.candidates?.find((candidate) => candidate.selected)?.metrics
      if (recordLearning && (actor.monster || actor.character) && selectedMetrics) {
        learningSamples.push({
          monsterId: actor.monster?.id ?? `player:${actor.character!.id}`,
          side: actingSide,
          metrics: selectedMetrics,
          damage: executed.damage,
          healing: executed.healing,
          hits: executed.hits,
          executed: Boolean(executed.action),
          defeatedTarget: targetHpBefore > 0 && (selectedTarget?.hp ?? targetHpBefore) <= 0,
        })
      }
      if (executed.action && selectedMetrics) {
        if (executed.action.spell) {
          if (actingSide === 'players') telemetry.tactical.playerSpellUses += 1
          else telemetry.tactical.monsterSpellUses += 1
        }
        const affectedEnemyCount = selectedMetrics.affectedEnemyCount ?? 0
        if (affectedEnemyCount > 1) {
          telemetry.tactical.areaActionUses += 1
          telemetry.tactical.areaEnemyTargets += affectedEnemyCount
          if ((selectedMetrics.affectedAllyCount ?? 0) > 0) {
            telemetry.tactical.areaActionsWithFriendlyFireRisk += 1
          }
        }
        if ((selectedMetrics.allyEmergency ?? 0) > 0) {
          telemetry.tactical.emergencySupportUses += 1
        }
        if ((executed.healing ?? 0) > 0) {
          telemetry.tactical.healingActions += 1
          telemetry.tactical.totalHealing += executed.healing ?? 0
        }
        if (selectedMetrics.attacksThisTurn && selectedTarget) {
          const elevationDelta = actor.elevationFeet - selectedTarget.elevationFeet
          if (elevationDelta >= 10) telemetry.tactical.highGroundAttackUses += 1
          else if (elevationDelta <= -10) telemetry.tactical.lowGroundAttackUses += 1
        }
      }
      if (trialIndex === 0 && telemetry.decisionLog.length < 300) {
        telemetry.decisionLog.push({
          round,
          turn: initiative.findIndex((candidate) => candidate.id === actor.id) + 1,
          actorName: actor.name,
          controlledByName: actor.controlledById
            ? actors.find((candidate) => candidate.id === actor.controlledById)?.name
            : undefined,
          actorHp: actor.hp,
          actorMaxHp: actor.maxHp,
          actorPositionBefore,
          actorPositionAfter: { x: actor.position, y: actor.positionY },
          actorElevationBeforeFeet,
          actorElevationAfterFeet: actor.elevationFeet,
          behaviorStyle: actor.behaviorStyle,
          targetPriority: actor.targetPriority,
          providerId: decision.providerId ?? 'unknown',
          candidateCount: decision.candidateCount ?? decision.candidates?.length ?? 0,
          targetName: selectedTarget?.name,
          actionName: selectedAction?.name,
          candidateId: decision.candidateId ?? 'unknown',
          score: decision.score ?? 0,
          reasons: decision.reasons ?? [],
          executionSteps: [
            ...turnSteps,
            ...(actorPositionBefore.x !== actor.position || actorPositionBefore.y !== actor.positionY
              ? [{
                  kind: 'movement' as const,
                  text: `${actor.name}移动：(${Math.round(actorPositionBefore.x)}, ${Math.round(actorPositionBefore.y)}) → (${Math.round(actor.position)}, ${Math.round(actor.positionY)})`,
                }]
              : []),
            {
              kind: 'result',
              text: selectedAction
                ? `${actor.name}选择动作：${selectedAction.name}${selectedTarget ? `，目标 ${selectedTarget.name}` : ''}`
                : decision.dodges
                  ? `${actor.name}采取闪避`
                  : decision.dashes
                    ? `${actor.name}采取疾走`
                    : `${actor.name}未执行动作`,
            },
            ...(executed.steps ?? []),
          ],
          candidates: (decision.candidates ?? []).map((candidate) => ({
            ...candidate,
            targetName: actors.find((entry) => entry.id === candidate.targetId)?.name,
            actionName: actor.actions.find((entry) => entry.id === candidate.actionId)?.name,
          })),
          outcome: {
            executed: Boolean(executed.action),
            hits: executed.hits,
            damage: executed.damage,
            headlessTransactions: actionTransactions,
            targetHpBefore: selectedTarget ? targetHpBefore : undefined,
            targetHpAfter: selectedTarget?.hp,
          },
        })
      }
      telemetry.headlessTransactionCount += executed.transactions
      actor.damageDealt += executed.damage
      if (executed.action) {
        const key = `${actingSide}:${actor.name}:${executed.action.id}`
        const usage = telemetry.actionUsage.get(key) ?? {
          actorName: actor.name,
          side: actingSide,
          actionId: executed.action.id,
          actionName: executed.action.name,
          uses: 0,
          attempts: 0,
          hits: 0,
          totalDamage: 0,
          totalHealing: 0,
          headlessTransactions: 0,
        }
        usage.uses += 1
        usage.attempts += executed.action.spell || executed.action.control ? 1 : executed.action.parts.length
        usage.hits += executed.hits
        usage.totalDamage += executed.damage
        usage.totalHealing += executed.healing ?? 0
        usage.headlessTransactions += actionTransactions
        telemetry.actionUsage.set(key, usage)
        if (actingSide === 'players') roundTotal.playerDamage += executed.damage
        else roundTotal.monsterDamage += executed.damage
      }
      if (
        executed.target &&
        executed.action &&
        !deadBeforeByActorId.get(executed.target.id) &&
        executed.target.deathSaves.dead
      ) {
        if (executed.target.side === 'players') roundTotal.playerDeaths += 1
        else roundTotal.monsterDeaths += 1
        const key = `${executed.target.name}\u0000${actor.name}\u0000${executed.action.name}`
        const cause = telemetry.deathCauses.get(key) ?? {
          victimName: executed.target.name,
          killerName: actor.name,
          actionName: executed.action.name,
          count: 0,
        }
        cause.count += 1
        telemetry.deathCauses.set(key, cause)
      }
      const postActionSide = effectiveSide(actor, actors)
      const remainingOpponents = actors.some((candidate) =>
        effectiveSide(candidate, actors) !== postActionSide && candidate.hp > 0)
      if (!remainingOpponents) return finish(postActionSide, round)
    }
  }
  return finish('draw', maxRounds)
}

function wilson95(successes: number, total: number): { low: number; high: number } {
  if (total <= 0) return { low: 0, high: 0 }
  const z = 1.959963984540054
  const p = successes / total
  const denominator = 1 + z * z / total
  const center = (p + z * z / (2 * total)) / denominator
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) }
}

interface SimulationCohortAccumulator {
  trials: number
  playerWins: number
  monsterWins: number
  draws: number
  totalRounds: number
}

function createSimulationCohortAccumulator(): SimulationCohortAccumulator {
  return { trials: 0, playerWins: 0, monsterWins: 0, draws: 0, totalRounds: 0 }
}

function observeSimulationCohort(
  cohort: SimulationCohortAccumulator,
  outcome: { winner: 'players' | 'monsters' | 'draw'; rounds: number },
): void {
  cohort.trials += 1
  cohort.totalRounds += outcome.rounds
  if (outcome.winner === 'players') cohort.playerWins += 1
  else if (outcome.winner === 'monsters') cohort.monsterWins += 1
  else cohort.draws += 1
}

function finalizeSimulationCohort(
  cohort: SimulationCohortAccumulator,
): Dnd5eCombatSimulationEvaluationCohort {
  const denominator = Math.max(1, cohort.trials)
  return {
    trials: cohort.trials,
    playerWins: cohort.playerWins,
    monsterWins: cohort.monsterWins,
    draws: cohort.draws,
    playerWinRate: cohort.playerWins / denominator,
    monsterWinRate: cohort.monsterWins / denominator,
    drawRate: cohort.draws / denominator,
    averageRounds: cohort.totalRounds / denominator,
    playerWinRate95PercentInterval: wilson95(cohort.playerWins, cohort.trials),
  }
}

function learnedProviderForSide(
  learned: MonsterDecisionProvider,
  side: 'players' | 'monsters',
): MonsterDecisionProvider {
  return {
    id: `${learned.id}:evaluation:${side}`,
    schemaVersion: 1,
    scoreCandidate(context, candidate) {
      const isPlayer = context.monsterId.startsWith('player:')
      const useLearned = side === 'players' ? isPlayer : !isPlayer
      return (useLearned ? learned : DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3)
        .scoreCandidate(context, candidate)
    },
  }
}

function simulationCoverage(
  characters: readonly Character[],
  monsters: readonly Dnd5eMonsterStatBlock[],
  mappedEncounter: boolean,
): Dnd5eCombatSimulationCoverage {
  const totalMonsterActions = monsters.reduce((sum, monster) => sum + monster.actions.length, 0)
  const automatedMonsterActions = monsters.reduce((sum, monster) => {
    const simulatedActionIds = new Set(
      simulationMonsterActions(monster)
        .filter((action) => !action.spell)
        .map((action) => action.id),
    )
    return sum + monster.actions.filter((action) => simulatedActionIds.has(action.id)).length
  }, 0)
  const totalMonsterSpells = monsters.reduce((sum, monster) =>
    sum + (monster.spellcasting?.spells?.length ?? 0), 0)
  const automatedMonsterSpells = monsters.reduce((sum, monster) =>
    sum + (monster.spellcasting?.spells ?? []).filter((listedSpell) => {
      const spell = getDnd5eSrdCombatSpell(listedSpell.id)
      return !!spell &&
        dnd5eMonsterCoreSpellCompatibility(spell).automation === 'full' &&
        spell.onFailedSaveEffect == null &&
        ['spell-attack', 'saving-throw', 'automatic-damage', 'power-word-kill'].includes(spell.effect)
    }).length, 0)
  const playerBasicAttackProfiles = characters.filter((character) => !!dnd5eWeaponAttackProfile(character)).length
  const totalPlayerSpells = characters.reduce((sum, character) =>
    sum + dnd5eSelectedCombatSpellIds(character).length, 0)
  const automatedPlayerSpells = characters.reduce((sum, character) =>
    sum + new Set(simulationPlayerSpellActions(character)
      .map((action) => action.spell?.id)
      .filter((id): id is string => !!id)).size, 0)
  const denominator = Math.max(
    1,
    totalMonsterActions + totalMonsterSpells + characters.length + totalPlayerSpells,
  )
  return {
    mode: mappedEncounter ? 'mapped-encounter' : 'quick-estimate',
    playerBasicAttackProfiles,
    playerCount: characters.length,
    automatedPlayerSpells,
    totalPlayerSpells,
    automatedMonsterActions,
    totalMonsterActions,
    automatedMonsterSpells,
    totalMonsterSpells,
    percentage: (
      automatedMonsterActions + automatedMonsterSpells + playerBasicAttackProfiles + automatedPlayerSpells
    ) / denominator,
    limitations: [
      '模拟使用平均生命值、当前 AC、武器攻击、多重攻击、单体伤害/控制、射程、豁免、抗性/免疫/易伤、再生、充能与每日次数。',
      '底栖魔鱼奴役会参与 AI 评分；失败豁免会改变目标阵营、禁止反应，并在受伤时自动进行重复豁免。',
      '玩家 AI 会从角色已知/已准备法术、法术位、武器和当前队友状态生成合法候选，并学习集火、范围伤害、控制和治疗配合。',
      mappedEncounter
        ? '地图模式会复用当前 Token 的二维坐标、墙/门、移动阻挡、物理视线、掩护和范围法术选点；每场试验使用独立地图快照。'
        : '快速估算模式只使用初始距离，不包含地图坐标、墙门、掩护与绕路；请加载当前遭遇以进行完整地图模拟。',
      '动态光照、复杂高低差、地图机关、区域持续伤害、传奇/巢穴动作、部分反应、死亡豁免，以及仍需 DM 裁定的自由文本能力尚未计入胜率。',
    ],
  }
}

function configureSimulationMonsterCatalog(request: Dnd5eCombatSimulationRequest): void {
  setDnd5eRoomMonsterCatalog(request.customMonsters ?? [])
}

export function validateDnd5eCombatSimulationRequest(
  request: Dnd5eCombatSimulationRequest,
): readonly string[] {
  configureSimulationMonsterCatalog(request)
  const errors: string[] = []
  if (request.characters.length === 0) errors.push('至少选择一名玩家角色。')
  if (request.characters.length > 8) errors.push('单次模拟最多选择 8 名玩家角色。')
  const count = request.monsters.reduce((sum, entry) => sum + Math.floor(entry.count), 0)
  if (count <= 0) errors.push('至少选择一只怪物。')
  if (count > 24) errors.push('单次模拟最多放入 24 只怪物。')
  for (const entry of request.monsters) {
    if (!getDnd5eSrdMonster(entry.monsterId)) errors.push(`找不到怪物：${entry.monsterId}`)
    if (!Number.isInteger(entry.count) || entry.count < 1 || entry.count > 12) {
      errors.push('每种怪物数量必须是 1 至 12 的整数。')
    }
  }
  const trials = request.trials ?? DND5E_COMBAT_SIMULATION_DEFAULT_TRIALS
  if (!Number.isInteger(trials) || trials < 1 || trials > DND5E_COMBAT_SIMULATION_MAX_TRIALS) {
    errors.push(`模拟次数必须是 1 至 ${DND5E_COMBAT_SIMULATION_MAX_TRIALS} 的整数。`)
  }
  if (request.battlefield) {
    if (
      !request.battlefield.map.id ||
      request.battlefield.map.width <= 0 ||
      request.battlefield.map.height <= 0 ||
      request.battlefield.map.gridSize <= 0
    ) errors.push('地图遭遇快照尺寸或网格无效。')
    if (
      request.battlefield.geometry &&
      request.battlefield.geometry.mapId !== request.battlefield.map.id
    ) errors.push('地图与几何快照不属于同一地图。')
    for (const character of request.characters) {
      if (!request.battlefield.map.tokens.some((token) =>
        token.type === 'player' && token.characterId === character.id)) {
        errors.push(`地图上缺少角色 Token：${character.name}`)
      }
    }
    for (const entry of request.monsters) {
      const mappedCount = request.battlefield.map.tokens.filter((token) =>
        token.type === 'enemy' && token.poolId === entry.monsterId).length
      if (mappedCount < entry.count) {
        errors.push(`地图上缺少怪物 Token：${entry.monsterId}（需要 ${entry.count}，现有 ${mappedCount}）`)
      }
    }
  }
  if (request.strategyTraining?.enabled) {
    const explorationRate = request.strategyTraining.explorationRate ?? 0.08
    const terminalRewardWeight = request.strategyTraining.terminalRewardWeight ?? 0.75
    if (!Number.isFinite(explorationRate) || explorationRate < 0 || explorationRate > 0.5) {
      errors.push('策略探索率必须在 0 到 0.5 之间。')
    }
    if (
      !Number.isFinite(terminalRewardWeight) ||
      terminalRewardWeight < 0 ||
      terminalRewardWeight > 4
    ) errors.push('终局奖励权重必须在 0 到 4 之间。')
  }
  const evaluationFraction = request.strategyTraining?.evaluationFraction ?? 0.3
  if (
    request.strategyTraining?.enabled &&
    (!Number.isFinite(evaluationFraction) ||
      evaluationFraction < 0.1 ||
      evaluationFraction > 0.5)
  ) errors.push('策略留出评估比例必须在 0.1 到 0.5 之间。')
  return [...new Set(errors)]
}

function* simulateDnd5eCombatsGenerator(
  request: Dnd5eCombatSimulationRequest,
  onProgress?: (progress: Dnd5eCombatSimulationProgress) => void,
): Generator<void, Dnd5eCombatSimulationResult, void> {
  configureSimulationMonsterCatalog(request)
  const errors = validateDnd5eCombatSimulationRequest(request)
  if (errors.length > 0) throw new Error(errors.join(' '))
  const trials = Math.floor(request.trials ?? DND5E_COMBAT_SIMULATION_DEFAULT_TRIALS)
  const seed = (Math.floor(request.seed ?? Date.now()) || 1) >>> 0
  const initialDistanceFeet = Math.max(5, Math.min(300, Math.floor(request.initialDistanceFeet ?? 30)))
  const maxRounds = Math.max(1, Math.min(100, Math.floor(request.maxRounds ?? 20)))
  const selectedMonsters = request.monsters.flatMap((entry) => {
    const monster = getDnd5eSrdMonster(entry.monsterId)!
    return Array.from({ length: entry.count }, () => monster)
  })
  const battlefieldTemplate = request.battlefield
    ? structuredClone(request.battlefield)
    : undefined
  const runtimeCache = battlefieldTemplate ? createSimulationRuntimeCache() : undefined
  setMapGeometryRuntime(battlefieldTemplate?.geometry ? [battlefieldTemplate.geometry] : [])
  const coverage = simulationCoverage(request.characters, selectedMonsters, !!battlefieldTemplate)
  const random = seededRandom(seed)
  const requestedEvaluationFraction = request.strategyTraining?.evaluationFraction ?? 0.3
  const evaluationTrials = request.strategyTraining?.enabled && trials >= 90
    ? Math.floor((trials * requestedEvaluationFraction) / 3) * 3
    : 0
  const trainingTrials = trials - evaluationTrials
  const evaluationCohorts = {
    baseline: createSimulationCohortAccumulator(),
    learnedPlayers: createSimulationCohortAccumulator(),
    learnedMonsters: createSimulationCohortAccumulator(),
  }
  const convergence: Dnd5eCombatSimulationConvergencePoint[] = []
  const convergenceInterval = Math.max(1, Math.floor(trials / 20))
  let playerWins = 0
  let monsterWins = 0
  let draws = 0
  let totalRounds = 0
  let totalPlayerSurvivors = 0
  let totalMonsterSurvivors = 0
  const telemetry: SimulationTelemetry = {
    roundTotals: new Map(),
    actionUsage: new Map(),
    deathCauses: new Map(),
    decisionLog: [],
    headlessTransactionCount: 0,
    strategyLearning: createDnd5eStrategyLearningAccumulator(),
    tactical: {
      playerSpellUses: 0,
      monsterSpellUses: 0,
      areaActionUses: 0,
      areaEnemyTargets: 0,
      areaActionsWithFriendlyFireRisk: 0,
      emergencySupportUses: 0,
      healingActions: 0,
      totalHealing: 0,
      highGroundAttackUses: 0,
      lowGroundAttackUses: 0,
    },
  }
  const participantTotals = new Map<string, {
    name: string
    side: 'players' | 'monsters'
    appearances: number
    survivals: number
    damage: number
    remainingHp: number
  }>()
  let learnedDecisionProvider: MonsterDecisionProvider =
    DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3
  let lastProgressAt = 0

  for (let trial = 0; trial < trials; trial += 1) {
    if (
      request.strategyTraining?.enabled &&
      trial > 0 &&
      trial <= trainingTrials &&
      (trial % 25 === 0 || trial === trainingTrials)
    ) {
      learnedDecisionProvider = createDnd5eLearnedMonsterDecisionProvider(
        finalizeDnd5eLearnedStrategy(telemetry.strategyLearning, {
          trials: trial,
          seed,
          trainedAt: 0,
          explorationRate: request.strategyTraining.explorationRate ?? 0.08,
          terminalRewardWeight: request.strategyTraining.terminalRewardWeight ?? 0.75,
        }),
      )
    }
    const evaluationIndex = trial - trainingTrials
    const evaluationCohort = evaluationIndex >= 0
      ? (['baseline', 'learnedPlayers', 'learnedMonsters'] as const)[evaluationIndex % 3]
      : undefined
    const trialDecisionProvider = evaluationCohort === 'learnedPlayers'
      ? learnedProviderForSide(learnedDecisionProvider, 'players')
      : evaluationCohort === 'learnedMonsters'
        ? learnedProviderForSide(learnedDecisionProvider, 'monsters')
        : evaluationCohort === 'baseline'
          ? DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3
          : learnedDecisionProvider
    const trialRandom = evaluationCohort
      ? seededRandom((seed ^ Math.imul(Math.floor(evaluationIndex / 3) + 1, 0x9e3779b1)) >>> 0)
      : random
    const battlefield = battlefieldTemplate
      ? {
          map: structuredClone(battlefieldTemplate.map),
          geometry: battlefieldTemplate.geometry,
          runtimeCache,
        }
      : undefined
    const usedMonsterTokenIds = new Set<string>()
    const actors = [
      ...request.characters.map((character) => playerActor(
        character,
        battlefield?.map.tokens.find((token) =>
          token.type === 'player' && token.characterId === character.id),
      )),
      ...selectedMonsters.map((monster, index) => {
        const token = battlefield?.map.tokens.find((candidate) =>
          candidate.type === 'enemy' &&
          candidate.poolId === monster.id &&
          !usedMonsterTokenIds.has(candidate.id))
        if (token) usedMonsterTokenIds.add(token.id)
        return monsterActor(monster, index, initialDistanceFeet, token)
      }),
    ]
    if (battlefield) {
      for (const actor of actors) {
        const token = battlefield.map.tokens.find((candidate) => candidate.id === actor.id)
        if (token) actor.elevationFeet = mapGeometryTokenElevation(battlefield.geometry, token)
      }
    }
    const outcome = simulateTrial(
      actors,
      trialRandom,
      maxRounds,
      telemetry,
      trial,
      request.characters,
      battlefield,
      evaluationCohort ? { enabled: false } : request.strategyTraining,
      trialDecisionProvider,
      !evaluationCohort,
    )
    if (evaluationCohort) observeSimulationCohort(evaluationCohorts[evaluationCohort], outcome)
    if (outcome.winner === 'players') playerWins += 1
    else if (outcome.winner === 'monsters') monsterWins += 1
    else draws += 1
    totalRounds += outcome.rounds
    totalPlayerSurvivors += actors.filter((actor) =>
      actor.side === 'players' && !actor.deathSaves.dead).length
    totalMonsterSurvivors += actors.filter((actor) =>
      actor.side === 'monsters' && !actor.deathSaves.dead).length
    for (const actor of actors) {
      const key = actor.side === 'players'
        ? actor.id
        : `monster-summary:${actor.monster?.id ?? actor.name}`
      const total = participantTotals.get(key) ?? {
        name: actor.name,
        side: actor.side,
        appearances: 0,
        survivals: 0,
        damage: 0,
        remainingHp: 0,
      }
      total.appearances += 1
      total.survivals += actor.deathSaves.dead ? 0 : 1
      total.damage += actor.damageDealt
      total.remainingHp += actor.hp
      participantTotals.set(key, total)
    }
    const completedTrials = trial + 1
    if (completedTrials % convergenceInterval === 0 || completedTrials === trials) {
      convergence.push({
        trials: completedTrials,
        playerWinRate: playerWins / completedTrials,
        monsterWinRate: monsterWins / completedTrials,
        drawRate: draws / completedTrials,
        averageRounds: totalRounds / completedTrials,
        playerWinRate95PercentInterval: wilson95(playerWins, completedTrials),
      })
    }
    const progressNow = Date.now()
    if (
      onProgress &&
      (completedTrials === 1 || completedTrials === trials || progressNow - lastProgressAt >= 500)
    ) {
      lastProgressAt = progressNow
      onProgress({
        completedTrials,
        totalTrials: trials,
        phase: completedTrials <= trainingTrials ? 'training' : 'evaluation',
      })
    }
    // A completed trial is the smallest safe checkpoint: all Headless
    // transactions have committed and the RNG state is deterministic. The
    // async Worker consumes this yield to process pause/resume commands.
    yield
  }

  const baselineEvaluation = finalizeSimulationCohort(evaluationCohorts.baseline)
  const learnedPlayersEvaluation = finalizeSimulationCohort(evaluationCohorts.learnedPlayers)
  const learnedMonstersEvaluation = finalizeSimulationCohort(evaluationCohorts.learnedMonsters)
  const result: Dnd5eCombatSimulationResult = {
    schemaVersion: 1,
    mode: battlefieldTemplate ? 'mapped-encounter' : 'quick-estimate',
    trials,
    seed,
    playerWins,
    monsterWins,
    draws,
    playerWinRate: playerWins / trials,
    monsterWinRate: monsterWins / trials,
    drawRate: draws / trials,
    playerWinRate95PercentInterval: wilson95(playerWins, trials),
    averageRounds: totalRounds / trials,
    averagePlayerSurvivors: totalPlayerSurvivors / trials,
    averageMonsterSurvivors: totalMonsterSurvivors / trials,
    participantSummaries: [...participantTotals.entries()].map(([id, total]) => ({
      id,
      name: total.name,
      side: total.side,
      appearances: total.appearances,
      survivalRate: total.survivals / total.appearances,
      averageDamage: total.damage / total.appearances,
      averageRemainingHp: total.remainingHp / total.appearances,
    })).sort((left, right) =>
      left.side.localeCompare(right.side) || right.averageDamage - left.averageDamage || left.name.localeCompare(right.name)),
    roundSummaries: [...telemetry.roundTotals.entries()]
      .sort(([left], [right]) => left - right)
      .map(([round, total]) => ({
        round,
        appearances: total.appearances,
        averagePlayerDamage: total.playerDamage / Math.max(1, total.appearances),
        averageMonsterDamage: total.monsterDamage / Math.max(1, total.appearances),
        averagePlayerDeaths: total.playerDeaths / Math.max(1, total.appearances),
        averageMonsterDeaths: total.monsterDeaths / Math.max(1, total.appearances),
      })),
    actionUsage: [...telemetry.actionUsage.values()]
      .map((usage) => ({
        ...usage,
        usesPerTrial: usage.uses / trials,
        hitRate: usage.hits / Math.max(1, usage.attempts),
        averageDamage: usage.totalDamage / Math.max(1, usage.uses),
        averageHealing: usage.totalHealing / Math.max(1, usage.uses),
      }))
      .sort((left, right) => right.uses - left.uses || left.actorName.localeCompare(right.actorName, 'zh-CN')),
    deathCauses: [...telemetry.deathCauses.values()]
      .sort((left, right) => right.count - left.count || left.victimName.localeCompare(right.victimName, 'zh-CN')),
    decisionLog: telemetry.decisionLog,
    headlessTransactionCount: telemetry.headlessTransactionCount,
    coverage,
    learnedStrategy: finalizeDnd5eLearnedStrategy(telemetry.strategyLearning, {
      trials: trainingTrials,
      seed,
      trainedAt: 0,
      explorationRate: request.strategyTraining?.enabled
        ? request.strategyTraining.explorationRate ?? 0.08
        : 0,
      terminalRewardWeight: request.strategyTraining?.enabled
        ? request.strategyTraining.terminalRewardWeight ?? 0.75
        : 0,
    }),
    convergence,
    strategyEvaluation: evaluationTrials > 0 ? {
      trainingTrials,
      evaluationTrials,
      baseline: baselineEvaluation,
      learnedPlayers: learnedPlayersEvaluation,
      learnedMonsters: learnedMonstersEvaluation,
      learnedPlayerWinRateDelta:
        learnedPlayersEvaluation.playerWinRate - baselineEvaluation.playerWinRate,
      learnedMonsterWinRateDelta:
        learnedMonstersEvaluation.monsterWinRate - baselineEvaluation.monsterWinRate,
    } : undefined,
    tacticalSummary: {
      playerSpellUses: telemetry.tactical.playerSpellUses,
      monsterSpellUses: telemetry.tactical.monsterSpellUses,
      areaActionUses: telemetry.tactical.areaActionUses,
      averageEnemiesHitByAreaAction:
        telemetry.tactical.areaEnemyTargets / Math.max(1, telemetry.tactical.areaActionUses),
      areaActionsWithFriendlyFireRisk: telemetry.tactical.areaActionsWithFriendlyFireRisk,
      emergencySupportUses: telemetry.tactical.emergencySupportUses,
      healingActions: telemetry.tactical.healingActions,
      totalHealing: telemetry.tactical.totalHealing,
      highGroundAttackUses: telemetry.tactical.highGroundAttackUses,
      lowGroundAttackUses: telemetry.tactical.lowGroundAttackUses,
    },
  }
  setMapGeometryRuntime([])
  return result
}

/** Synchronous entry point retained for Headless callers and unit tests. */
export function simulateDnd5eCombats(
  request: Dnd5eCombatSimulationRequest,
  onProgress?: (progress: Dnd5eCombatSimulationProgress) => void,
): Dnd5eCombatSimulationResult {
  const iterator = simulateDnd5eCombatsGenerator(request, onProgress)
  let step = iterator.next()
  while (!step.done) step = iterator.next()
  return step.value
}

/**
 * Cooperative Worker entry point. It preserves the same seeded execution as
 * the synchronous function, but yields after each fully resolved trial so a
 * pause can take effect without discarding learning state.
 */
export async function simulateDnd5eCombatsAsync(
  request: Dnd5eCombatSimulationRequest,
  options: Dnd5eCombatSimulationAsyncOptions = {},
): Promise<Dnd5eCombatSimulationResult> {
  const iterator = simulateDnd5eCombatsGenerator(request, options.onProgress)
  let step = iterator.next()
  while (!step.done) {
    await options.waitForNextBatch?.()
    step = iterator.next()
  }
  return step.value
}

/** 供 UI 使用的稳定、已翻译 SRD 目录。 */
export const DND5E_COMBAT_SIMULATION_MONSTERS = DND5E_SRD_MONSTERS
