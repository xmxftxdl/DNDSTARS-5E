import { SKILLS, type AbilityKey } from '../../lib/dnd'
import type { Dnd5eSpellMetamagicPayload } from '../../lib/sharedCombatTypes'
import type { AttackResolution, D20RollMode, SavingThrowResolution, TurnEconomy, TurnResource } from '../contracts'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { DND5E_TOTAL_COVER_ARMOR_CLASS, resolveDnd5eAttackOutcome } from './attackResolution'
import { imposeDnd5eRollDisadvantage, resolveDnd5eRollMode } from './rollMode'
import {
  dnd5ePluginFeatureDefinition,
  dnd5ePluginHeadlessActionDefinition,
  dnd5ePluginResourceDefinition,
  dnd5eDeclarativeTriggeredActions,
  type Dnd5ePluginAction,
} from './pluginApi'
import type { Dnd5eSandboxCapabilityOperation } from './pluginSandbox'
import type { Dnd5ePersistentAreaSourceKind, Dnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { validateDnd5ePluginDiceRolls } from './pluginDice'
import {
  DND5E_DAMAGE_TYPES,
  getDnd5eSrdMonster,
  type Dnd5eDamageType,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterMechanicEffectV2,
  type Dnd5eMonsterMechanicDurationV2,
  type Dnd5eMonsterMechanicTriggerEventV2,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterWeaponAttack,
} from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import {
  dnd5eMonsterEffectiveWeaponAttack,
  dnd5eMonsterIsSwarm,
  dnd5eMonsterRechargeActions,
  dnd5eMonsterRegenerationRule,
  dnd5eMonsterWeaponAttackAgainstConditions,
} from './monsterGenericAbilities'
import {
  dnd5eEligibleMonsterMechanics,
  dnd5eMonsterMechanicDiceRequirements,
  dnd5eMonsterMechanicEffects,
  dnd5eMonsterMechanicLedgerKey,
  dnd5eMonsterMechanicUsageValue,
} from './monsterAutomation'
import {
  dnd5eMonsterCoreSpellCompatibility,
  dnd5eMonsterHasStructuredShapechange,
  dnd5eMonsterShapechangeFormIds,
  parseDnd5eLegendaryWingAttack,
} from './monsterAdvancedAbilities'
import { dnd5eBardicInspirationDie, dnd5eClassDefinition, dnd5eMonkMartialArtsDie, dnd5ePactSlotLevel, dnd5eRogueSneakAttackDice, type Dnd5eClassId } from './classes'
import { dnd5eCanEmpowerSpell, dnd5eCanOverchannelSpell, dnd5eCanSculptSpell, dnd5eCarefulSpellMaximumTargets, dnd5eCharmPersonEligibleCreatureType, dnd5eDraconicElementalResistanceType, dnd5eFreeSpellCastSource, dnd5eHeightenedSavingThrowMode, dnd5eMetamagicAvailableForSpell, dnd5eMetamagicCost, dnd5eSculptSpellMaximumTargets, dnd5eSpellAllowsRepeatedTargets, dnd5eSpellConcentrationDurationRounds, dnd5eSpellDamageDiceCounts, dnd5eSpellDelayedDamageDiceCount, dnd5eSpellDiceCount, dnd5eSpellHigherSlotDamageChoices, dnd5eSpellMaximumTargets, dnd5eSpellProjectileCount, dnd5eSpellSpecificSavingThrowMode, dnd5eSpellUsesSequencedAttacks, dnd5eSustainedSpellAttackDiceCount, getDnd5eSrdCombatSpell } from './spells'
import { getDnd5eSrdSpellCatalogEntry } from './spellCatalog'
import {
  dnd5eCanUseUncannyDodge,
  dnd5eCanThreatenRangedAttacker,
  dnd5eAttackerIsUnseen,
  dnd5eConditionImmuneFromSource,
  dnd5eDamageAfterSavingThrow,
  dnd5eHasViciousMockeryAttackDisadvantage,
  dnd5eIsIncapacitated,
  dnd5ePreventsAttackAdvantage,
  dnd5eReactionsPrevented,
  dnd5eSavingThrowMode,
  dnd5eTargetGrantsAttackAdvantage,
  dnd5eTargetIsDodging,
  dnd5eUnseenTargetImposesDisadvantage,
} from './passiveDefenses'
import {
  DND5E_WILD_SHAPE_KNOWN_FORMS_KEY,
  dnd5eWildShapeDurationHours,
  dnd5eWildShapeFormAllowedForLevel,
} from './wildShape'
import {
  DND5E_STANDARD_CONDITION_IDS,
  dnd5eConditionSetsSpeedToZero,
  dnd5eConditionSavingThrowAutomaticallyFails,
  dnd5eStandardConditionId,
  dnd5eHasStandardCondition,
  dnd5eConditionAbilityCheckDisadvantage,
  dnd5eConditionHitIsAutomaticCritical,
  dnd5eConditionPreventsApproachingSource,
  dnd5eConditionPreventsAttackingSource,
  type Dnd5eStandardConditionId,
} from './conditions'
import {
  applyDnd5eActiveEffect,
  createDnd5eMechanicalEffect,
  createDnd5eConditionEffect,
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eActiveAbilityCheckAdvantages,
  dnd5eActiveSafeFallFeet,
  dnd5eActiveConditionImmunities,
  dnd5eActiveDarkvisionRangeFeet,
  dnd5eActiveEffectsSeeInvisible,
  dnd5eActiveEffectId,
  dnd5eActiveFlySpeed,
  dnd5eActiveJumpDistanceMultiplier,
  dnd5eActiveMagicWeaponBonus,
  dnd5eActiveSizeRankDelta,
  dnd5eActiveSpeedBonus,
  dnd5eActiveSpeedPenalty,
  dnd5eActiveStrengthRollFlags,
  dnd5eActiveWeaponDamageD4Mode,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
  removeDnd5eActiveEffectsForEvent,
  type Dnd5eActiveEffectBreakTrigger,
  type Dnd5eActiveEffectDuration,
  type Dnd5eActiveEffectInstance,
  type Dnd5eActiveEffectModifiers,
  type Dnd5eActiveEffectRepeatSave,
  type Dnd5eActiveEffectSavingThrowRoll,
} from './activeEffects'
import {
  beginDnd5eHeadlessActionTransaction,
  settleDnd5eHeadlessActionTransaction,
  type Dnd5eHeadlessTransactionOptions,
} from './headlessActionTransaction'
import type { CombatTransaction } from '../../lib/combatTransaction'
import { dnd5eActionAllowedWhileSurprised, dnd5eCombatantIsSurprised } from './surprise'
import {
  dnd5eHasSpecialSenseInRange,
  dnd5eTremorsenseDetects,
  type Dnd5eSpecialSense,
} from './specialSenses'
import { dnd5eTraversalMovementCost, resolveDnd5eFallingDamage, type Dnd5eTraversalMode } from './traversal'
import type { Dnd5eEffectiveRulesContextV1 } from './effectiveRulesContext'

export interface Dnd5eCombatant {
  id: string
  name: string
  level: number
  controller: 'dm' | 'player'
  initiative: number
  abilities: Record<AbilityKey, number>
  baseSavingThrowBonuses: Partial<Record<AbilityKey, number>>
  savingThrowBonuses: Partial<Record<AbilityKey, number>>
  savingThrowProficiencies: readonly AbilityKey[]
  skillProficiencies: readonly string[]
  passivePerception: number
  proficiencyBonus: number
  /** SRD monster challenge rating. Player characters and custom creatures may omit it. */
  challengeRating?: number
  /** Tiny=0, Small=1, Medium=2, Large=3, Huge=4, Gargantuan=5. */
  sizeRank: number
  armorClass: number
  currentHp: number
  maxHp: number
  temporaryHp: number
  exhaustionLevel: number
  speed: number
  movementSpeeds?: { walk: number; climb?: number; swim?: number; fly?: number }
  position: { x: number; y: number }
  elevationFeet?: number
  airborne?: boolean
  /** Innate or equipment-provided darkvision before temporary ActiveEffects. */
  darkvisionRangeFeet?: number
  specialSenses?: readonly Dnd5eSpecialSense[]
  magicResistance?: boolean
  shapechanger?: boolean
  turn: TurnEconomy
  dodging: boolean
  disengaged: boolean
  concentrating: boolean
  classResources: Record<string, { current: number; max: number }>
  classId?: Dnd5eClassId
  subclassId?: string
  classLevels?: Partial<Record<Dnd5eClassId, number>>
  subclassIds?: Partial<Record<Dnd5eClassId, string>>
  classSelections: Record<string, string[]>
  classSelectionsByClass?: Partial<Record<Dnd5eClassId, Record<string, string[]>>>
  pluginFeatureIds: readonly string[]
  wearingArmor: boolean
  wearingUnproficientArmor: boolean
  armorStealthDisadvantage: boolean
  wearingHeavyArmor: boolean
  wearingMetalArmor: boolean
  hasShield: boolean
  /** 地图快照中的主手武器，用于验证只强化施法时所持的武器。 */
  mainWeaponId?: string
  /** 主手武器本身是否已经是魔法武器；魔化武器不能以它为目标。 */
  mainWeaponMagical?: boolean
  /** 快照中按阵营、距离、听觉与来源状态计算；不持久化到目标。 */
  countercharmSourceIds?: readonly string[]
  /** 奉献圣武士神圣光轮来源；由地图桥按敌对关系与30尺距离实时计算。 */
  holyNimbusSourceIds?: readonly string[]
  /** 龙威来源；由地图桥按敌对关系、60尺距离、免疫与现有效果实时计算。 */
  draconicPresenceSourceIds?: readonly string[]
  classState: {
    schemaVersion?: typeof DND5E_COMBAT_STATE_SCHEMA_VERSION
    activeEffects?: Dnd5eActiveEffectInstance[]
    caltropsSpeedPenaltyFeet?: number
    raging?: boolean
    surprisedCombatId?: string
    surpriseResolvedCombatId?: string
    frenzying?: boolean
    frenzyStartedTurnKey?: string
    rageTurnsRemaining?: number
    rageSustainedThisTurn?: boolean
    relentlessRageDc?: number
    relentlessRagePendingDc?: number
    undeadFortitudePending?: { dc: number; damage: number; sourceId?: string }
    monsterOnHitSavePending?: {
      sourceId: string
      actionId: string
      ability: AbilityKey
      dc: number
      condition: Dnd5eStandardConditionId | 'disease'
    }
    /** Host 写入的受伤触发状态豁免；只有列入这里的 effectId 才能提交离回合豁免。 */
    activeEffectDamageSavePendingIds?: string[]
    /** 当前临时生命值的可撤销法术来源；用于英雄气概结束时只移除自身提供的数值。 */
    temporaryHitPointsSource?: { actorId: string; rulesId: 'heroism' | 'enhance-ability' }
    intimidatingPresenceSourceId?: string
    intimidatingPresenceRoundsRemaining?: number
    intimidatingPresenceImmunityRoundsBySource?: Record<string, number>
    natureSanctuaryImmunityRoundsByTarget?: Record<string, number>
    turnedByClericId?: string
    turnedRoundsRemaining?: number
    bardicInspirationDie?: number
    bardicInspirationSourceId?: string
    bardicInspirationRoundsRemaining?: number
    countercharmRoundsRemaining?: number
    sneakAttackTurnKey?: string
    colossusSlayerTurnKey?: string
    divineStrikeTurnKey?: string
    foeSlayerTurnKey?: string
    recklessAttackTurnKey?: string
    weaponAttackActionTurnKey?: string
    dodgingTurnKey?: string
    helpedAbilityCheckSourceId?: string
    helpedAbilityCheckSourceTurnKey?: string
    helpedAttackSourceId?: string
    helpedAttackSourceTurnKey?: string
    readiedAction?: {
      trigger: string
      actionKind: 'attack' | 'move' | 'interact-object' | 'other'
      targetId?: string
      preparedTurnKey: string
    }
    sacredWeaponTurnsRemaining?: number
    holyNimbusRoundsRemaining?: number
    divineInterventionCooldownDays?: number
    monkAttackActionTurnKey?: string
    monkMartialArtsTurnKey?: string
    deflectMissilesCatchSourceId?: string
    deflectMissilesCatchTurnKey?: string
    deflectMissilesCatchDamageType?: Dnd5eDamageType
    emptyBodyRoundsRemaining?: number
    hordeBreakerOpportunityTurnKey?: string
    hordeBreakerSourceTargetId?: string
    hordeBreakerUsedTurnKey?: string
    multiattackDefenseAttackerId?: string
    multiattackDefenseTurnKey?: string
    stunnedByActorId?: string
    stunnedAppliedTurnKey?: string
    openHandNoReactionsAppliedTurnKeysBySource?: Record<string, string>
    quiveringPalmTargetId?: string
    tranquilityActive?: boolean
    /** Host-owned replay protection and per-turn usage ledger for declarative abilities. */
    declarativeUsedTurnKeys?: Record<string, string>
    declarativeTransactionIds?: string[]
    monsterMechanicRollModifiers?: Array<{
      id: string
      mechanicOwnerId: string
      mechanicId: string
      roll: 'attack' | 'damage' | 'saving-throw'
      mode: 'bonus' | 'advantage' | 'disadvantage'
      bonus?: number
    }>
    pendingMonsterMechanicTriggers?: Record<string, Dnd5eMonsterMechanicTriggerSnapshot>
    monsterMechanicTriggerSequence?: number
    hiddenCheckTotal?: number
    hideInPlainSightPrepared?: boolean
    bonusActionSpellTurnKey?: string
    leveledSpellTurnKey?: string
    /** The concentration spell currently maintained by this combatant. */
    concentrationSpellId?: string
    /** Authoritative slot level of the currently maintained spell. */
    concentrationSpellLevel?: number
    /** Combatants currently affected by the maintained concentration spell. */
    concentrationTargetIds?: string[]
    /** Remaining duration in combat rounds for the maintained concentration spell. */
    concentrationRoundsRemaining?: number
    /** Concentration effects applied to this combatant, keyed by caster combatant id. */
    concentrationEffectsBySource?: Record<string, string>
    viciousMockeryAttackDisadvantage?: boolean
    shieldSpellActive?: boolean
    legendaryResistanceUses?: number
    monsterLegendaryActionPoints?: number
    monsterLairActionRoundUsed?: number
    monsterLairActionLastId?: string
    monsterRechargeReadyByActionId?: Record<string, boolean>
    monsterActionUsesByActionId?: Record<string, { current: number; max: number }>
    monsterSpellSlots?: Record<string, { current: number; max: number }>
    monsterSpellUsesBySpellId?: Record<string, { current: number; max: number }>
    monsterShapechangeOriginalStatBlockId?: string
    monsterShapechangeFormId?: string
    monsterRegenerationSuppressedDamageTypes?: Dnd5eDamageType[]
    monsterRegenerationPendingAtZero?: boolean
    monsterThreatByTargetId?: Record<string, number>
    overchannelUsesSinceLongRest?: number
    draconicResistanceType?: Extract<Dnd5eDamageType, 'acid' | 'cold' | 'fire' | 'lightning' | 'poison'>
    draconicResistanceRoundsRemaining?: number
    draconicWingsActive?: boolean
    draconicPresenceImmunityRoundsBySource?: Record<string, number>
    hurlThroughHellReady?: boolean
    hurlThroughHellSourceId?: string
    hurlThroughHellDamage?: number
    hurlThroughHellAppliedTurnKey?: string
    huntersMarkTargetId?: string
    wildShapeFormId?: string
    wildShapeCurrentHp?: number
    wildShapeRoundsRemaining?: number
    wildShapeOriginalCurrentHp?: number
    wildShapeOriginalMaxHp?: number
    wildShapeOriginalArmorClass?: number
    wildShapeOriginalSpeed?: number
    wildShapeOriginalAbilities?: Record<AbilityKey, number>
    wildShapeOriginalSavingThrowBonuses?: Partial<Record<AbilityKey, number>>
    wildShapeOriginalStatBlockId?: string
    wildShapeOriginalCreatureType?: string
    wildShapeOriginalDamageVulnerabilities?: Dnd5eDamageType[]
    wildShapeOriginalDamageResistances?: Dnd5eDamageType[]
    wildShapeOriginalDamageImmunities?: Dnd5eDamageType[]
    wildShapeOriginalConditionImmunities?: string[]
  }
  deathSaves: { successes: number; failures: number; stable: boolean; dead: boolean }
  /** 玩家角色默认进行死亡豁免；普通怪物默认在 0 HP 时死亡。 */
  usesDeathSaves?: boolean
  statBlockId?: string
  creatureType?: string
  damageVulnerabilities: readonly Dnd5eDamageType[]
  damageResistances: readonly Dnd5eDamageType[]
  damageImmunities: readonly Dnd5eDamageType[]
  conditionImmunities: readonly string[]
  conditions: readonly string[]
}

/** 职业特性读取对应职业等级；旧快照仍回退到主职业。 */
export function dnd5eCombatantClassLevel(
  combatant: { classId?: Dnd5eClassId; level: number; classLevels?: Partial<Record<Dnd5eClassId, number>> },
  classId: Dnd5eClassId,
): number {
  const stored = combatant.classLevels?.[classId]
  if (stored != null) return Math.max(0, Math.min(20, Math.floor(stored)))
  return combatant.classId === classId ? Math.max(1, Math.min(20, Math.floor(combatant.level))) : 0
}

export function dnd5eCombatantHasSubclass(
  combatant: { classId?: Dnd5eClassId; subclassId?: string; subclassIds?: Partial<Record<Dnd5eClassId, string>> },
  classId: Dnd5eClassId,
  subclassId: string,
): boolean {
  return (combatant.subclassIds?.[classId] ?? (combatant.classId === classId ? combatant.subclassId : undefined)) === subclassId
}

export interface Dnd5eHeadlessCombatState {
  rulesetId: typeof rules.id
  combatId: string
  mapId?: string
  active: boolean
  round: number
  initiativeIndex: number
  initiativeOrder: readonly string[]
  /** 由 DM 地图快照按 Token 占位与地图比例计算；键使用 dnd5eCombatantPairKey。 */
  distanceFeetByCombatantPair?: Record<string, number>
  /** Host 编译的有向掩护加值；键为 attackerId\0targetId。 */
  coverBonusByCombatantPair?: Record<string, 2 | 5>
  /** Host 编译的全掩护／效果线阻断。 */
  lineOfEffectBlockedByCombatantPair?: Record<string, true>
  /** Host 编译的有向不可见关系；同时包含墙门、照明和视距。 */
  lineOfSightBlockedByCombatantPair?: Record<string, true>
  /** Host 编译的有向魔法黑暗关系；普通黑暗视觉不能覆盖。 */
  magicalDarknessByCombatantPair?: Record<string, true>
  /** 仅墙、关闭的门与高度实体造成的阻挡；特殊感官仍不能穿过该阻挡。 */
  physicalLineOfSightBlockedByCombatantPair?: Record<string, true>
  /** Optional map-scheduler slot identity for creatures with multiple turns. */
  turnSlotId?: string
  /** Host-authoritative, one-shot custom-monster triggers awaiting their declared rolls. */
  pendingMonsterMechanicTriggers?: Record<string, Dnd5eMonsterMechanicTriggerSnapshot>
  monsterMechanicTriggerSequence?: number
  /** Pinned at combat start; room rule edits apply to the next combat id. */
  effectiveRules?: Dnd5eEffectiveRulesContextV1
  combatants: Record<string, Dnd5eCombatant>
}

export interface Dnd5eMonsterMechanicTriggerSnapshot {
  id: string
  mechanicOwnerId: string
  mechanicId: string
  event: Dnd5eMonsterMechanicTriggerEventV2
  subjectId: string
  triggerTargetId?: string
  damageSourceId?: string
  movementDistanceFeet?: number
  savingThrowKind?: 'magic' | 'physical'
  createdRound: number
  chainDepth: number
}

export interface Dnd5ePendingMonsterMechanicResolution {
  snapshot: Dnd5eMonsterMechanicTriggerSnapshot
  ownerName: string
  mechanicName: string
  dice: readonly {
    effectId: string
    effectName: string
    count: number
    sides: number
    bonus: number
  }[]
  attacks: readonly {
    effectId: string
    targetId: string
    toHit: number
    damage: { count: number; sides: number; bonus: number; type: Dnd5eDamageType }
    economy: 'none' | 'reaction'
  }[]
}

export function dnd5ePendingMonsterMechanicResolutions(
  state: Dnd5eHeadlessCombatState,
): readonly Dnd5ePendingMonsterMechanicResolution[] {
  const snapshots = Object.assign(
    {},
    ...Object.values(state.combatants).map((combatant) => combatant.classState.pendingMonsterMechanicTriggers ?? {}),
    state.pendingMonsterMechanicTriggers ?? {},
  ) as Record<string, Dnd5eMonsterMechanicTriggerSnapshot>
  return Object.values(snapshots)
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((snapshot) => {
      const owner = state.combatants[snapshot.mechanicOwnerId]
      const monster = owner?.statBlockId ? getDnd5eSrdMonster(owner.statBlockId) : undefined
      const mechanic = monster?.headlessMechanics?.find((entry) => entry.id === snapshot.mechanicId)
      if (!owner || !mechanic) return []
      return [{
        snapshot,
        ownerName: owner.name,
        mechanicName: mechanic.name,
        dice: dnd5eMonsterMechanicDiceRequirements(mechanic),
        attacks: dnd5eMonsterMechanicEffects(mechanic).flatMap((effect) => {
          if (effect.kind !== 'attack') return []
          const targetId = effect.target === 'self'
            ? owner.id
            : effect.target === 'selected-subject'
              ? snapshot.subjectId
              : effect.target === 'trigger-target'
                ? snapshot.triggerTargetId
                : snapshot.damageSourceId
          return targetId ? [{
            effectId: effect.id,
            targetId,
            toHit: effect.toHit,
            damage: {
              count: effect.damage.count,
              sides: effect.damage.sides,
              bonus: effect.damage.bonus,
              type: effect.damage.type,
            },
            economy: effect.economy ?? 'none',
          }] : []
        }),
      }]
    })
}

export function dnd5eCombatantPairKey(leftId: string, rightId: string): string {
  return leftId < rightId ? `${leftId}\u0000${rightId}` : `${rightId}\u0000${leftId}`
}

export function dnd5eDirectedCombatantPairKey(actorId: string, targetId: string): string {
  return `${actorId}\u0000${targetId}`
}

export function dnd5eCombatantCanSee(
  state: Dnd5eHeadlessCombatState,
  viewerId: string,
  targetId: string,
): boolean {
  const viewer = state.combatants[viewerId]
  const target = state.combatants[targetId]
  if (!viewer || !target || viewer.currentHp <= 0 || viewer.deathSaves.dead) return false
  const distanceFeet = dnd5eAttackDistanceFeet(state, viewerId, targetId)
  const pairKey = dnd5eDirectedCombatantPairKey(viewerId, targetId)
  const hasBlindsight = dnd5eHasSpecialSenseInRange(viewer.specialSenses, 'blindsight', distanceFeet)
  const hasTruesight = dnd5eHasSpecialSenseInRange(viewer.specialSenses, 'truesight', distanceFeet)
  const seesInvisible = dnd5eActiveEffectsSeeInvisible(viewer.classState.activeEffects)
  const hasDarkvision = distanceFeet <= dnd5eEffectiveDarkvisionRangeFeet(viewer)
  if (state.physicalLineOfSightBlockedByCombatantPair?.[pairKey] === true) return false
  if (dnd5eHasStandardCondition(viewer, 'blinded') && !hasBlindsight) return false
  const outlinedByFaerieFire = target.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:faerie-fire',
  ) === true
  if (!outlinedByFaerieFire && (
    (!hasBlindsight && !hasTruesight && !seesInvisible && dnd5eAttackerIsUnseen(target)) ||
    target.classState.hiddenCheckTotal != null
  )) return false
  return hasBlindsight || hasTruesight || (
    state.magicalDarknessByCombatantPair?.[pairKey] !== true &&
    (hasDarkvision || state.lineOfSightBlockedByCombatantPair?.[pairKey] !== true)
  )
}

export function dnd5eEffectiveDarkvisionRangeFeet(
  combatant: Pick<Dnd5eCombatant, 'darkvisionRangeFeet' | 'classState'>,
): number {
  return Math.max(
    0,
    combatant.darkvisionRangeFeet ?? 0,
    dnd5eActiveDarkvisionRangeFeet(combatant.classState.activeEffects),
  )
}

/** 震颤感知能定位但不等同于看见；供隐藏 Token 投影与 DM 提示使用。 */
export function dnd5eCombatantCanDetect(
  state: Dnd5eHeadlessCombatState,
  viewerId: string,
  targetId: string,
): boolean {
  if (dnd5eCombatantCanSee(state, viewerId, targetId)) return true
  const viewer = state.combatants[viewerId]
  const target = state.combatants[targetId]
  if (!viewer || !target || viewer.currentHp <= 0 || viewer.deathSaves.dead) return false
  return dnd5eTremorsenseDetects({
    senses: viewer.specialSenses,
    distanceFeet: dnd5eAttackDistanceFeet(state, viewerId, targetId),
    viewerElevationFeet: viewer.elevationFeet,
    targetElevationFeet: target.elevationFeet,
    targetAirborne: target.airborne,
  })
}

export function dnd5eAttackerIsUnseenForAttack(
  state: Dnd5eHeadlessCombatState,
  attackerId: string,
  targetId: string,
): boolean {
  const attacker = state.combatants[attackerId]
  if (!attacker) return false
  return !dnd5eCombatantCanSee(state, targetId, attackerId)
}

export function dnd5eTargetIsUnseenForAttack(
  state: Dnd5eHeadlessCombatState,
  attackerId: string,
  targetId: string,
): boolean {
  const attacker = state.combatants[attackerId]
  const target = state.combatants[targetId]
  if (!attacker || !target) return false
  const chillTouchDisadvantage = attacker.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:chill-touch:undead-disadvantage' &&
    effect.source.actorId === target.id,
  ) === true
  if (chillTouchDisadvantage) return true
  const targetVisible = dnd5eCombatantCanSee(state, attackerId, targetId)
  if (dnd5eUnseenTargetImposesDisadvantage(attacker, target, { targetVisible })) return true
  if (targetVisible) return false
  const feralSenses = dnd5eCombatantClassLevel(attacker, 'ranger') >= 18 &&
    target.classState.hiddenCheckTotal == null && dnd5eAttackDistanceFeet(state, attackerId, targetId) <= 30
  return !feralSenses
}

function dnd5eAttackDistanceFeet(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  targetId: string,
  fallback?: number,
): number {
  if (actorId === targetId && state.combatants[actorId]) return 0
  const snapshotDistance = state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actorId, targetId)]
  if (Number.isFinite(snapshotDistance) && snapshotDistance! >= 0) return snapshotDistance!
  return Number.isFinite(fallback) && fallback! >= 0 ? fallback! : Number.POSITIVE_INFINITY
}

/**
 * 朦胧术只影响依赖视觉的攻击者。盲视与真实视觉仅在各自感官范围内忽略该效果；
 * 震颤感知并非视觉，不能看穿幻象。
 */
export function dnd5eBlurImposesAttackDisadvantage(
  state: Dnd5eHeadlessCombatState,
  attackerId: string,
  targetId: string,
): boolean {
  const attacker = state.combatants[attackerId]
  const target = state.combatants[targetId]
  if (!attacker || !target || !target.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:blur'
  )) return false
  const distanceFeet = dnd5eAttackDistanceFeet(state, attackerId, targetId)
  return !dnd5eHasSpecialSenseInRange(attacker.specialSenses, 'blindsight', distanceFeet) &&
    !dnd5eHasSpecialSenseInRange(attacker.specialSenses, 'truesight', distanceFeet)
}

function dnd5eHostileWithinFiveFeet(state: Dnd5eHeadlessCombatState, actor: Dnd5eCombatant): boolean {
  return Object.values(state.combatants).some((candidate) =>
    candidate.id !== actor.id && candidate.currentHp > 0 && !candidate.deathSaves.dead &&
    candidate.controller !== actor.controller &&
    dnd5eCanThreatenRangedAttacker(actor, candidate) &&
    dnd5eAttackDistanceFeet(state, actor.id, candidate.id) <= 5,
  )
}

function dnd5eConditionSourceIds(
  combatant: Dnd5eCombatant,
  condition: Dnd5eStandardConditionId,
): readonly string[] {
  return [...new Set((combatant.classState.activeEffects ?? []).flatMap((effect) =>
    effect.standardCondition === condition && effect.source.actorId ? [effect.source.actorId] : [],
  ))]
}

export function dnd5eFrightenedAttackDisadvantage(
  state: Dnd5eHeadlessCombatState,
  combatant: Dnd5eCombatant,
): boolean {
  if (!dnd5eHasStandardCondition(combatant, 'frightened')) return false
  const sourceIds = new Set(dnd5eConditionSourceIds(combatant, 'frightened'))
  if (combatant.classState.intimidatingPresenceSourceId) sourceIds.add(combatant.classState.intimidatingPresenceSourceId)
  return [...sourceIds].some((sourceId) => dnd5eCombatantCanSee(state, combatant.id, sourceId))
}

export function dnd5eHelpAttackApplies(
  state: Dnd5eHeadlessCombatState,
  attacker: Dnd5eCombatant,
  target: Dnd5eCombatant,
): boolean {
  const sourceId = target.classState.helpedAttackSourceId
  const source = sourceId ? state.combatants[sourceId] : undefined
  return !!source && source.controller === attacker.controller && target.controller !== attacker.controller
}

function consumeDnd5eHelpAttack(
  state: Dnd5eHeadlessCombatState,
  attacker: Dnd5eCombatant,
  target: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
): void {
  if (!dnd5eHelpAttackApplies(state, attacker, target)) return
  const sourceId = target.classState.helpedAttackSourceId!
  target.classState.helpedAttackSourceId = undefined
  target.classState.helpedAttackSourceTurnKey = undefined
  events.push({ type: 'class-state-changed', actorId: sourceId, targetId: target.id, stateKey: 'help-attack', active: false })
}

function dnd5eCannotAttackSource(actor: Dnd5eCombatant, targetId: string): boolean {
  return dnd5eConditionPreventsAttackingSource({
    attacker: actor,
    targetId,
    sourceIdsByCondition: { charmed: dnd5eConditionSourceIds(actor, 'charmed') },
  })
}

export function dnd5eHitIsAutomaticCritical(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  target: Dnd5eCombatant,
  fallbackDistanceFeet?: number,
): boolean {
  return dnd5eConditionHitIsAutomaticCritical({
    target,
    distanceFeet: dnd5eAttackDistanceFeet(state, actorId, target.id, fallbackDistanceFeet),
  })
}

export function dnd5eMonsterSpellAttackMode(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  targetId: string,
): D20RollMode {
  const actor = state.combatants[actorId]
  const target = state.combatants[targetId]
  if (!actor || !target) return 'normal'
  const hasAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
    (dnd5eTargetGrantsAttackAdvantage(target) ||
      dnd5eAttackerIsUnseenForAttack(state, actor.id, target.id))
  const hasDisadvantage = dnd5eTargetIsDodging(target) ||
    dnd5eTargetIsUnseenForAttack(state, actor.id, target.id) ||
    dnd5eFrightenedAttackDisadvantage(state, actor)
  return resolveDnd5eRollMode({
    advantage: [{ active: hasAdvantage, reason: 'monster-spell-attack-advantage' }],
    disadvantage: [{ active: hasDisadvantage, reason: 'monster-spell-attack-disadvantage' }],
  }).mode
}

export type Dnd5eClassDamageSource =
  | 'sneak-attack'
  | 'colossus-slayer'
  | 'brutal-critical'
  | 'improved-divine-smite'
  | 'divine-smite'
  | 'hunters-mark'
  | 'divine-favor'
  | 'divine-strike'
  | 'lifedrinker'
  | 'foe-slayer'
  | 'enlarge'
  | 'reduce'

export interface Dnd5eClassDamageDefinition {
  source: Dnd5eClassDamageSource
  count: number
  sides: number
  type: Dnd5eDamageType
  doubleOnCritical: boolean
  bonus?: number
  operation?: 'add' | 'subtract-from-weapon'
}

export interface Dnd5eWeaponClassDamageContext {
  /** 攻击实际使用的稳定装备 ID；Headless 用它匹配武器专属 ActiveEffect。 */
  weaponId?: string
  mode: 'melee' | 'ranged'
  distanceFeet?: number
  normalRangeFeet?: number
  longRangeFeet?: number
  finesse: boolean
  strengthBased: boolean
  monkMartialArtsEligible?: boolean
  weaponDamageSides: number
  damageType: Dnd5eDamageType
  adjacentEnemyOfTarget: boolean
  divineSmiteSlotLevel?: number
  recklessAttack?: boolean
  frenzyAttack?: boolean
  twoWeaponBonusAttack?: boolean
  hordeBreakerEligible?: boolean
  hordeBreakerAttack?: boolean
  stunningStrike?: boolean
  foeSlayer?: 'attack' | 'damage'
}

export interface Dnd5eClassDamageRolls {
  source: Dnd5eClassDamageSource
  rolls: readonly number[]
}

export interface Dnd5eCuttingWordsUse {
  bardId: string
  roll: number
  /** 由 DM 地图桥按 Token 占位重新计算；Headless 仍拒绝超过 60 尺的请求。 */
  distanceFeet: number
}

/**
 * “逆流反击”在原攻击事务内携带的第二次攻击数据。
 * 目标距离由 DM 地图桥按 Token 占位计算，Headless 仍按原攻击触及范围复核。
 */
export interface Dnd5eStandAgainstTideUse {
  targetId: string
  distanceFeet: number
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  strokeOfLuck?: boolean
  mode?: D20RollMode
  protectionReactionActorId?: string
  shieldSpellReaction?: boolean
  uncannyDodge?: boolean
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  hurlThroughHellDamageRolls?: readonly number[]
  damageRolls: readonly (readonly number[])[]
  classDamageRolls?: readonly Dnd5eClassDamageRolls[]
}

export interface Dnd5eCounterspellReaction {
  actorId: string
  slotLevel: number
  /** 反制高于所用法术位环级的法术时，传入已经包含施法属性调整值的检定总值。 */
  abilityCheckTotal?: number
}

export interface Dnd5eHunterMultiattackRoll {
  targetId: string
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  protectionReactionActorId?: string
  shieldSpellReaction?: boolean
  uncannyDodge?: boolean
  deflectMissilesD10?: number
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  mode?: D20RollMode
  damageRolls: readonly number[]
  classDamageContext: Dnd5eWeaponClassDamageContext
  classDamageRolls?: readonly Dnd5eClassDamageRolls[]
  standAgainstTide?: Dnd5eStandAgainstTideUse
}

export interface Dnd5eOpenHandTechniqueRoll {
  effect: 'prone' | 'push' | 'no-reactions'
  savingThrowD20?: number
  savingThrowD20Second?: number
  savingThrowRerollD20?: number
  savingThrowRerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  blessRoll?: number
  baneRoll?: number
  pushTo?: { x: number; y: number }
  pushDistanceFeet?: number
}

export interface Dnd5eTranquilitySaveRoll {
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  rerollD20?: number
  rerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
}

export interface Dnd5eSpellTargetSavingThrowRoll {
  targetId: string
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  rerollD20?: number
  rerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  legendaryResistance?: boolean
}

export interface Dnd5eSpellForcedMovement {
  targetId: string
  to: { x: number; y: number }
  distanceFeet: number
  toElevationFeet?: number
  fallingDamageRolls?: readonly number[]
}

export interface Dnd5eSpellTeleportDestination {
  to: { x: number; y: number }
  distanceFeet: number
  toElevationFeet?: number
}

export interface Dnd5eSpellTargetAttackRoll {
  targetId: string
  d20: number
  d20Second?: number
  attackBlessRoll?: number
  attackBaneRoll?: number
  bardicInspirationRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  mode?: D20RollMode
  protectionReactionActorId?: string
  shieldSpellReaction?: boolean
  uncannyDodge?: boolean
  hurlThroughHellDamageRolls?: readonly number[]
  repellingBlastPushTo?: { x: number; y: number }
  repellingBlastPushDistanceFeet?: number
  repellingBlastPushToElevationFeet?: number
  repellingBlastFallingDamageRolls?: readonly number[]
  effectRolls: readonly number[]
  standAgainstTide?: Dnd5eStandAgainstTideUse
}

export interface Dnd5eEmpoweredSpellReroll {
  group: 'effect' | 'target-attack'
  targetId?: string
  /** 区分同一目标上的多道射线；普通孪生攻击可省略。 */
  attackIndex?: number
  dieIndex: number
  reroll: number
}

export interface Dnd5eAdjudicatedSpellEffect {
  targetId: string
  operation?: 'damage' | 'healing' | 'temporary-hit-points'
  amount?: number
  damageType?: Dnd5eDamageType
  addCondition?: string
  conditionDuration?: Dnd5eActiveEffectDuration
  conditionRepeatSave?: Dnd5eActiveEffectRepeatSave
  removeCondition?: string
}

export interface Dnd5eMonsterRechargeRoll {
  actorId: string
  actionId: string
  roll: number
}

export interface Dnd5eMonsterMechanicRoll {
  actorId: string
  mechanicId: string
  /** V1 单效果兼容字段。 */
  rolls?: readonly number[]
  /** V2 按效果 ID 提供的权威骰值。 */
  effectRolls?: readonly { effectId: string; rolls: readonly number[] }[]
  /** 命中后机制必须绑定 Headless 实际命中的目标。 */
  targetId?: string
  /** Triggered attack effects use their own authoritative attack and damage dice. */
  attackRolls?: readonly {
    effectId: string
    targetId: string
    d20: number
    d20Second?: number
    damageRolls: readonly number[]
  }[]
}

export interface Dnd5eDispelMagicCheck {
  effectId: string
  d20: number
}

export type Dnd5eSceneInteractionOutcomeStep =
  | {
      id: string
      kind: 'damage'
      amount: number
      damageType: Dnd5eDamageType
    }
  | {
      id: string
      kind: 'condition'
      condition: Dnd5eStandardConditionId
      duration: Dnd5eActiveEffectDuration
    }

export type Dnd5eMonsterAdjudicatedEffect = Dnd5eAdjudicatedSpellEffect

export interface Dnd5eMonsterCoreSpellResolutionV1 {
  schemaVersion: 1
  targetIds: readonly string[]
  teleportDestination?: Dnd5eSpellTeleportDestination
  /** 自动命中法术的逐枚投射物目标；允许同一目标重复出现。 */
  projectileTargetIds?: readonly string[]
  /** 接受护盾术反应、从而免疫魔法飞弹的目标。 */
  shieldSpellReactionTargetIds?: readonly string[]
  d20?: number
  d20Second?: number
  targetSavingThrows?: readonly Dnd5eSpellTargetSavingThrowRoll[]
  legendaryResistanceTargetIds?: readonly string[]
  /** One roll group for each SRD damage/healing component. */
  effectRolls: readonly (readonly number[])[]
}

export interface Dnd5eTargetTranquilitySaveRoll {
  targetId: string
  save: Dnd5eTranquilitySaveRoll
}

export type Dnd5eAction =
  | { type: 'attack'; actorId: string; targetId: string; attackModifier: number; criticalThreshold?: number; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; strokeOfLuck?: boolean; cuttingWords?: Dnd5eCuttingWordsUse; cuttingWordsDamage?: Dnd5eCuttingWordsUse; mode?: D20RollMode; spendAction?: boolean; spendBonusAction?: boolean; protectionReactionActorId?: string; shieldSpellReaction?: boolean; uncannyDodge?: boolean; deflectMissilesD10?: number; tranquilitySave?: Dnd5eTranquilitySaveRoll; stunningStrikeSaveD20?: number; stunningStrikeSaveD20Second?: number; stunningStrikeSaveBlessRoll?: number; stunningStrikeSaveBaneRoll?: number; stunningStrikeSaveRerollD20?: number; stunningStrikeSaveRerollD20Second?: number; stunningStrikeBardicInspirationRoll?: number; stunningStrikeDarkOnesOwnLuckRoll?: number; hurlThroughHellDamageRolls?: readonly number[]; standAgainstTide?: Dnd5eStandAgainstTideUse; damage: { count: number; sides: number; bonus: number; rolls: readonly number[]; type?: Dnd5eDamageType }; classDamageContext?: Dnd5eWeaponClassDamageContext; classDamageRolls?: readonly Dnd5eClassDamageRolls[] }
  | { type: 'monster-action'; actorId: string; actionId: string; rolls: readonly Dnd5eMonsterActionRoll[]; mechanicRolls?: readonly Dnd5eMonsterMechanicRoll[] }
  | { type: 'monster-legendary-action'; actorId: string; actionId: string; rolls: readonly Dnd5eMonsterActionRoll[]; mechanicRolls?: readonly Dnd5eMonsterMechanicRoll[] }
  | { type: 'monster-special-action'; actorId: string; actionId: string; targetId?: string; d20?: number; d20Second?: number; blessRoll?: number; baneRoll?: number; rerollD20?: number; rerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; legendaryResistance?: boolean; damageRolls?: readonly number[] }
  | { type: 'monster-legendary-special-action'; actorId: string; actionId: string; targetId?: string; d20?: number; d20Second?: number; blessRoll?: number; baneRoll?: number; rerollD20?: number; rerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; legendaryResistance?: boolean; damageRolls?: readonly number[] }
  | { type: 'monster-adjudicated-action'; actorId: string; actionId: string; legendary?: boolean; effects: readonly Dnd5eMonsterAdjudicatedEffect[]; d20?: number; targetSavingThrows?: readonly Dnd5eSpellTargetSavingThrowRoll[]; damageRolls?: readonly number[] }
  | { type: 'monster-lair-action'; actorId: string; actionId: string; effects: readonly Dnd5eMonsterAdjudicatedEffect[] }
  | { type: 'monster-spell'; actorId: string; spellId: string; slotLevel: number; effects: readonly Dnd5eMonsterAdjudicatedEffect[] }
  | { type: 'monster-core-spell'; actorId: string; spellId: string; slotLevel: number; resolution: Dnd5eMonsterCoreSpellResolutionV1; counterspellReaction?: Dnd5eCounterspellReaction }
  | { type: 'monster-shapechange'; actorId: string; formId: string }
  | { type: 'monster-undead-fortitude-save'; actorId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number }
  | { type: 'monster-on-hit-save'; actorId: string; sourceId: string; actionId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; rerollD20?: number; rerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number }
  | { type: 'resolve-monster-mechanic-trigger'; actorId: string; snapshotId: string; roll: Dnd5eMonsterMechanicRoll }
  | { type: 'active-effect-damage-save'; actorId: string; effectId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; rerollD20?: number; rerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number }
  | { type: 'ranger-hunter-multiattack'; actorId: string; feature: 'volley' | 'whirlwind-attack'; weaponMode: 'melee' | 'ranged'; attackModifier: number; criticalThreshold?: number; damage: { count: number; sides: number; bonus: number; type?: Dnd5eDamageType }; attacks: readonly Dnd5eHunterMultiattackRoll[] }
  | { type: 'move'; actorId: string; to: { x: number; y: number }; distance: number; movementCost?: number; standFromProne?: boolean; carefulMovement?: boolean; traversalMode?: Dnd5eTraversalMode; toElevationFeet?: number; fallingDamageRolls?: readonly number[] }
  | { type: 'move-persistent-area'; actorId: string; areaId: string; economy: 'action' | 'bonusAction' }
  | { type: 'item-area-trigger'; actorId: string; areaId: string; areaKind: 'ball-bearings' | 'caltrops' | 'hunting-trap'; d20: number; d20Second?: number; damageRolls?: readonly number[] }
  | { type: 'dash'; actorId: string }
  | { type: 'hide'; actorId: string; d20: number; d20Second?: number }
  | { type: 'help'; actorId: string; targetId: string; helpKind: 'ability-check' | 'attack' }
  | { type: 'ready'; actorId: string; trigger: string; actionKind: 'attack' | 'move' | 'interact-object' | 'other'; targetId?: string }
  | { type: 'trigger-readied-action'; actorId: string }
  | { type: 'use-object'; actorId: string; interactionId: string }
  | { type: 'grapple'; actorId: string; targetId: string; actorD20: number; actorD20Second?: number; targetD20: number; targetD20Second?: number; targetDefense: 'athletics' | 'acrobatics'; spendAction?: boolean }
  | { type: 'shove'; actorId: string; targetId: string; actorD20: number; actorD20Second?: number; targetD20: number; targetD20Second?: number; targetDefense: 'athletics' | 'acrobatics'; outcome: 'prone' | 'push'; pushTo?: { x: number; y: number }; pushToElevationFeet?: number; fallingDamageRolls?: readonly number[]; spendAction?: boolean }
  | { type: 'escape-grapple'; actorId: string; grapplerId: string; actorD20: number; actorD20Second?: number; targetD20: number; targetD20Second?: number }
  | { type: 'escape-active-effect'; actorId: string; effectId: string; d20: number; d20Second?: number }
  | { type: 'wake-sleeping-creature'; actorId: string; targetId: string }
  | { type: 'disengage'; actorId: string }
  | { type: 'dodge'; actorId: string }
  | { type: 'interact-object'; actorId: string; interactionId: string; useAction?: boolean }
  | {
      type: 'scene-interaction-outcome'
      actorId: string
      interactionId: string
      steps: readonly Dnd5eSceneInteractionOutcomeStep[]
    }
  | { type: 'ability-check'; actorId: string; ability: AbilityKey; skill?: string; d20: number; d20Second?: number; mode?: D20RollMode; dc?: number; spendAction?: boolean; bardicInspirationRoll?: number; peerlessSkillRoll?: number; darkOnesOwnLuckRoll?: number; cuttingWords?: Dnd5eCuttingWordsUse; strokeOfLuck?: boolean }
  | { type: 'death-save'; actorId: string; d20: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number }
  | { type: 'death-save-turn'; actorId: string; d20: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; activeEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]; turnStartActiveEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]; nextMonsterRechargeRolls?: readonly Dnd5eMonsterRechargeRoll[]; nextMonsterMechanicRolls?: readonly Dnd5eMonsterMechanicRoll[] }
  | { type: 'concentration-save'; actorId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; rerollD20?: number; rerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; dc: number }
  | { type: 'barbarian-relentless-rage-save'; actorId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; dc: number }
  | { type: 'fighter-second-wind'; actorId: string; resourceKey: string; d10: number }
  | { type: 'fighter-action-surge'; actorId: string; resourceKey: string; alreadyUsedThisTurn: boolean }
  | { type: 'class-resource-use'; actorId: string; resourceKey: string; amount?: number; turnResource?: 'action' | 'bonusAction' | 'reaction' }
  | { type: 'barbarian-rage'; actorId: string; frenzy?: boolean; end?: boolean }
  | { type: 'barbarian-intimidating-presence'; actorId: string; targetId: string; savingThrowD20?: number; savingThrowD20Second?: number; savingThrowBlessRoll?: number; savingThrowBaneRoll?: number; savingThrowRerollD20?: number; savingThrowRerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number }
  | { type: 'rogue-cunning-action'; actorId: string; option: 'dash' | 'disengage' | 'hide'; hideAllowed?: boolean; d20?: number; d20Second?: number }
  | { type: 'monster-nimble-escape'; actorId: string; option: 'disengage' }
  | { type: 'ranger-vanish'; actorId: string; hideAllowed?: boolean; d20?: number; d20Second?: number }
  | { type: 'rogue-fast-hands'; actorId: string; option: 'sleight-of-hand' | 'thieves-tools' | 'use-object'; d20?: number; d20Second?: number }
  | { type: 'bardic-inspiration'; actorId: string; targetId: string }
  | { type: 'bard-countercharm'; actorId: string }
  | { type: 'paladin-lay-on-hands'; actorId: string; targetId: string; amount?: number; cure?: 'disease' | 'poisoned' }
  | { type: 'paladin-cleansing-touch'; actorId: string; targetId: string; sourceId: string; spellId: string }
  | { type: 'monk-wholeness-of-body'; actorId: string }
  | { type: 'monk-step-of-the-wind'; actorId: string; option: 'dash' | 'disengage' }
  | { type: 'monk-patient-defense'; actorId: string }
  | { type: 'monk-unarmed-bonus'; actorId: string; mode: 'martial-arts' | 'flurry'; attackModifier: number; damage: { count: number; sides: number; bonus: number }; attacks: readonly { targetId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; cuttingWords?: Dnd5eCuttingWordsUse; cuttingWordsDamage?: Dnd5eCuttingWordsUse; mode?: D20RollMode; shieldSpellReaction?: boolean; damageRolls: readonly number[]; tranquilitySave?: Dnd5eTranquilitySaveRoll; stunningStrike?: boolean; stunningStrikeSaveD20?: number; stunningStrikeSaveD20Second?: number; stunningStrikeSaveBlessRoll?: number; stunningStrikeSaveBaneRoll?: number; stunningStrikeSaveRerollD20?: number; stunningStrikeSaveRerollD20Second?: number; stunningStrikeBardicInspirationRoll?: number; stunningStrikeDarkOnesOwnLuckRoll?: number; openHandTechnique?: Dnd5eOpenHandTechniqueRoll; quiveringPalm?: boolean; standAgainstTide?: Dnd5eStandAgainstTideUse }[] }
  | { type: 'monk-quivering-palm-release'; actorId: string; targetId: string; savingThrowD20?: number; savingThrowD20Second?: number; savingThrowBlessRoll?: number; savingThrowBaneRoll?: number; savingThrowRerollD20?: number; savingThrowRerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; damageRolls: readonly number[] }
  | { type: 'monk-quivering-palm-end'; actorId: string }
  | { type: 'monk-deflect-missiles-return'; actorId: string; targetId: string; distanceFeet: number; decline?: boolean; d20: number; d20Second?: number; mode?: D20RollMode; damageRolls: readonly number[] }
  | { type: 'cast-spell'; actorId: string; castingClassId?: Dnd5eClassId; targetId: string; targetIds?: readonly string[]; projectileTargetIds?: readonly string[]; sculptedTargetIds?: readonly string[]; forcedMovements?: readonly Dnd5eSpellForcedMovement[]; teleportDestination?: Dnd5eSpellTeleportDestination; metamagic?: Dnd5eSpellMetamagicPayload; empowered?: boolean; empoweredRerolls?: readonly Dnd5eEmpoweredSpellReroll[]; draconicResistance?: boolean; repellingBlast?: boolean; counterspellReaction?: Dnd5eCounterspellReaction; shieldSpellReaction?: boolean; shieldSpellReactionTargetIds?: readonly string[]; legendaryResistanceTargetIds?: readonly string[]; spellId: string; slotLevel: number; higherSlotDamageType?: Dnd5eDamageType; conditionChoice?: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease'; effectDamageType?: 'acid' | 'cold' | 'fire' | 'lightning' | 'thunder'; enlargeReduceChoice?: 'enlarge' | 'reduce'; enhanceAbilityChoice?: 'bear-endurance' | 'bull-strength' | 'cat-grace' | 'eagle-splendor' | 'fox-cunning' | 'owl-wisdom'; sustainedEffectAttack?: 'flame-blade' | 'spiritual-weapon' | 'call-lightning'; sustainedEffectAreaId?: string; healingAllocations?: readonly { targetId: string; amount: number }[]; dispelMagicChecks?: readonly Dnd5eDispelMagicCheck[]; d20?: number; d20Second?: number; attackBlessRoll?: number; attackBaneRoll?: number; cuttingWords?: Dnd5eCuttingWordsUse; cuttingWordsDamage?: Dnd5eCuttingWordsUse; standAgainstTide?: Dnd5eStandAgainstTideUse; mode?: D20RollMode; targetAttacks?: readonly Dnd5eSpellTargetAttackRoll[]; protectionReactionActorId?: string; tranquilitySave?: Dnd5eTranquilitySaveRoll; targetTranquilitySaves?: readonly Dnd5eTargetTranquilitySaveRoll[]; savingThrowD20?: number; savingThrowD20Second?: number; savingThrowBlessRoll?: number; savingThrowBaneRoll?: number; savingThrowRerollD20?: number; savingThrowRerollD20Second?: number; targetSavingThrows?: readonly Dnd5eSpellTargetSavingThrowRoll[]; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; hurlThroughHellDamageRolls?: readonly number[]; overchannel?: boolean; overchannelSelfDamageRolls?: readonly number[]; uncannyDodge?: boolean; effectRolls: readonly number[]; additionalEffectRolls?: readonly (readonly number[])[]; delayedEffectRolls?: readonly number[] }
  | { type: 'hellish-rebuke'; actorId: string; targetId: string; slotLevel: number; triggerDamageAmount: number; savingThrowD20: number; savingThrowD20Second?: number; savingThrowBlessRoll?: number; savingThrowBaneRoll?: number; effectRolls: readonly number[] }
  | { type: 'adjudicated-spell'; actorId: string; castingClassId?: Dnd5eClassId; spellId: string; spellName: string; spellLevel: number; slotLevel: number; castingTime: 'action' | 'bonus-action'; effects: readonly Dnd5eAdjudicatedSpellEffect[]; concentrationRounds?: number }
  | { type: 'paladin-sacred-weapon'; actorId: string }
  | { type: 'paladin-divine-sense'; actorId: string; targetIds: readonly string[] }
  | { type: 'paladin-turn-the-unholy'; actorId: string; targets: readonly Dnd5eSpellTargetSavingThrowRoll[] }
  | { type: 'paladin-holy-nimbus'; actorId: string }
  | { type: 'cleric-turn-undead'; actorId: string; targets: readonly Dnd5eSpellTargetSavingThrowRoll[] }
  | { type: 'cleric-preserve-life'; actorId: string; allocations: readonly { targetId: string; amount: number }[] }
  | { type: 'cleric-divine-intervention'; actorId: string; d100?: number }
  | { type: 'sorcerer-create-spell-slot'; actorId: string; slotLevel: 1 | 2 | 3 | 4 | 5 }
  | { type: 'sorcerer-convert-spell-slot'; actorId: string; slotLevel: number }
  | { type: 'sorcerer-draconic-wings'; actorId: string; active: boolean }
  | { type: 'sorcerer-draconic-presence'; actorId: string; mode: 'awe' | 'fear' }
  | { type: 'sorcerer-draconic-presence-save'; actorId: string; sourceId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; rerollD20?: number; rerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number }
  | { type: 'ranger-move-hunters-mark'; actorId: string; targetId: string }
  | { type: 'ranger-primeval-awareness'; actorId: string; slotLevel: 1 | 2 | 3 | 4 | 5; targetIds: readonly string[] }
  | { type: 'ranger-hide-in-plain-sight'; actorId: string }
  | { type: 'monk-stillness-of-mind'; actorId: string; condition: 'charmed' | 'frightened' }
  | { type: 'monk-empty-body'; actorId: string }
  | { type: 'druid-wild-shape'; actorId: string; formId: string }
  | { type: 'druid-end-wild-shape'; actorId: string }
  | { type: 'warlock-hurl-through-hell-ready'; actorId: string; active: boolean }
  | Dnd5ePluginAction
  | { type: 'end-turn'; actorId: string; activeEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]; turnStartActiveEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]; currentMonsterMechanicRolls?: readonly Dnd5eMonsterMechanicRoll[]; nextMonsterRechargeRolls?: readonly Dnd5eMonsterRechargeRoll[]; nextMonsterMechanicRolls?: readonly Dnd5eMonsterMechanicRoll[] }
  | { type: 'opportunity-attack'; actorId: string; targetId: string; attackModifier: number; criticalThreshold?: number; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; strokeOfLuck?: boolean; cuttingWords?: Dnd5eCuttingWordsUse; cuttingWordsDamage?: Dnd5eCuttingWordsUse; shieldSpellReaction?: boolean; uncannyDodge?: boolean; standAgainstTide?: Dnd5eStandAgainstTideUse; mode?: D20RollMode; reactionFeature?: 'berserker-retaliation' | 'hunter-giant-killer'; tranquilitySave?: Dnd5eTranquilitySaveRoll; hurlThroughHellDamageRolls?: readonly number[]; damage: { count: number; sides: number; bonus: number; rolls: readonly number[]; type?: Dnd5eDamageType }; classDamageContext?: Dnd5eWeaponClassDamageContext; classDamageRolls?: readonly Dnd5eClassDamageRolls[] }

export interface Dnd5eMonsterActionRoll {
  targetId: string
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  mode?: D20RollMode
  protectionReactionActorId?: string
  shieldSpellReaction?: boolean
  uncannyDodge?: boolean
  deflectMissilesD10?: number
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  damageRolls: readonly (readonly number[])[]
  sizeDamageRolls?: readonly number[]
  standAgainstTide?: Dnd5eStandAgainstTideUse
}

export type Dnd5eCombatEvent =
  | { type: 'turn-started'; actorId: string; round: number }
  | { type: 'turn-resource-spent'; actorId: string; resource: TurnResource; amount?: number }
  | { type: 'moved'; actorId: string; from: { x: number; y: number }; to: { x: number; y: number }; distance: number }
  | { type: 'teleported'; actorId: string; spellId: string; from: { x: number; y: number }; to: { x: number; y: number }; distanceFeet: number; fromElevationFeet: number; toElevationFeet: number }
  | { type: 'elevation-changed'; actorId: string; fromElevationFeet: number; toElevationFeet: number; mode: Dnd5eTraversalMode }
  | { type: 'falling-damage-resolved'; actorId: string; distanceFeet: number; dice: number; damage: number; landedProne: boolean }
  | { type: 'item-area-triggered'; actorId: string; areaId: string; areaKind: 'ball-bearings' | 'caltrops' | 'hunting-trap'; success: boolean }
  | { type: 'persistent-area-triggered'; actorId: string; targetId: string; areaId: string; triggerId: string; timing: Dnd5ePersistentAreaTriggerSnapshot['timing']; saveSuccess?: boolean; damage: number; conditionApplied?: Dnd5eStandardConditionId }
  | { type: 'scene-interaction-outcome-resolved'; actorId: string; interactionId: string; stepCount: number }
  | { type: 'attack-resolved'; actorId: string; targetId: string; d20: number; total: number; armorClass: number; hit: boolean; critical: boolean }
  | { type: 'healing-applied'; targetId: string; amount: number; hpBefore: number; hpAfter: number }
  | { type: 'temporary-hit-points-gained'; actorId: string; amount: number; current: number }
  | { type: 'class-resource-spent'; actorId: string; resourceKey: string; current: number; max: number }
  | { type: 'class-resource-restored'; actorId: string; resourceKey: string; current: number; max: number }
  | { type: 'class-state-changed'; actorId: string; stateKey: string; active: boolean; value?: number; targetId?: string }
  | { type: 'damage-reduced'; targetId: string; source: 'deflect-missiles'; d10: number; modifier: number; amount: number; damageBefore: number; damageAfter: number; caught: boolean }
  | { type: 'class-damage-applied'; actorId: string; targetId: string; source: Dnd5eClassDamageSource; amount: number }
  | { type: 'movement-granted'; actorId: string; amount: number }
  | { type: 'disengage-granted'; actorId: string }
  | { type: 'creatures-sensed'; actorId: string; targetIds: readonly string[] }
  | { type: 'creature-types-sensed'; actorId: string; creatureTypes: readonly string[]; durationRounds: number }
  | { type: 'undead-turned'; actorId: string; targetId: string; rounds: number }
  | { type: 'undead-destroyed'; actorId: string; targetId: string; challengeRating: number }
  | { type: 'unholy-turned'; actorId: string; targetId: string; rounds: number }
  | { type: 'divine-intervention-resolved'; actorId: string; d100?: number; success: boolean; automatic: boolean; cooldownDays?: number }
  | { type: 'draconic-presence-save-required'; targetId: string; sourceId: string; mode: 'awe' | 'fear'; dc: number }
  | { type: 'undead-fortitude-save-required'; targetId: string; dc: number; damage: number }
  | { type: 'undead-fortitude-resolved'; targetId: string; d20: number; total: number; dc: number; success: boolean }
  | { type: 'monster-on-hit-save-required'; targetId: string; sourceId: string; actionId: string; ability: AbilityKey; dc: number; condition: Dnd5eStandardConditionId | 'disease' }
  | { type: 'exhaustion-gained'; actorId: string; level: number }
  | { type: 'saving-throw-resolved'; targetId: string; ability: AbilityKey; d20: number; modifier: number; total: number; dc: number; success: boolean }
  | { type: 'legendary-resistance-used'; targetId: string; remainingUses: number }
  | { type: 'monster-regenerated'; actorId: string; amount: number; hpAfter: number }
  | { type: 'monster-regeneration-suppressed'; actorId: string; damageTypes: readonly Dnd5eDamageType[]; died: boolean }
  | { type: 'monster-recharge-resolved'; actorId: string; actionId: string; roll: number; ready: boolean }
  | { type: 'monster-mechanic-triggered'; actorId: string; mechanicId: string; mechanicName: string; amount: number; hpAfter: number }
  | { type: 'monster-mechanic-trigger-pending'; snapshot: Dnd5eMonsterMechanicTriggerSnapshot }
  | {
      type: 'monster-mechanic-v2-triggered'
      actorId: string
      mechanicId: string
      mechanicName: string
      trigger: Dnd5eMonsterMechanicTriggerEventV2
      outcomes: readonly {
        effectId: string
        kind: 'healing' | 'temporary-hit-points' | 'damage' | 'standard-condition' | 'remove-standard-condition' | 'roll-modifier' | 'attack'
        targetId: string
        amount?: number
        condition?: Dnd5eStandardConditionId
        applied?: boolean
      }[]
    }
  | { type: 'monster-legendary-actions-restored'; actorId: string; points: number }
  | { type: 'monster-legendary-action-used'; actorId: string; actionId: string; cost: number; remaining: number }
  | { type: 'monster-special-action-resolved'; actorId: string; actionId: string; legendary: boolean; targetId?: string; success?: boolean; damage?: number; healing?: number; total?: number }
  | { type: 'monster-legendary-detect-resolved'; actorId: string; actionId: string; d20: number; modifier: number; total: number }
  | { type: 'monster-legendary-wing-attack-resolved'; actorId: string; actionId: string; targetIds: readonly string[]; damage: number; movementGranted: number }
  | { type: 'monster-adjudicated-action-resolved'; actorId: string; actionId: string; legendary: boolean; effectCount: number }
  | { type: 'monster-spell-cast'; actorId: string; spellId: string; slotLevel: number; remainingSlots?: number }
  | { type: 'monster-core-spell-resolved'; actorId: string; spellId: string; slotLevel: number; targetIds: readonly string[] }
  | { type: 'monster-shapechanged'; actorId: string; fromStatBlockId: string; toStatBlockId: string; forced: boolean }
  | { type: 'monster-lair-action-used'; actorId: string; actionId: string; round: number; effectCount: number }
  | { type: 'condition-applied'; actorId: string; targetId: string; condition: string }
  | { type: 'condition-ended'; targetId: string; condition: string }
  | { type: 'sleep-resolved'; actorId: string; spellId: 'sleep'; hitPointPool: number; remainingHitPoints: number; affectedTargetIds: readonly string[] }
  | { type: 'color-spray-resolved'; actorId: string; spellId: 'color-spray'; hitPointPool: number; remainingHitPoints: number; affectedTargetIds: readonly string[] }
  | { type: 'sleeping-creature-awakened'; actorId: string; targetId: string; spellId: 'sleep' }
  | { type: 'declarative-subclass-ability-resolved'; actorId: string; abilityId: string; trigger: string; targetIds: readonly string[] }
  | { type: 'declarative-subclass-trigger-rejected'; actorId: string; abilityId: string; trigger: string; targetIds: readonly string[]; reason: Dnd5eActionFailure }
  | { type: 'active-effect-applied'; targetId: string; effectId: string; definitionId: string }
  | { type: 'active-effect-refreshed'; targetId: string; effectId: string; definitionId: string }
  | { type: 'active-effect-removed'; targetId: string; effectId: string; definitionId: string; reason: 'expired' | 'save-succeeded' | 'concentration-ended' | 'source-incapacitated' | 'out-of-range' | 'harmful-action' | Dnd5eActiveEffectBreakTrigger | 'dm' | 'healed' | 'death' | 'escaped' | 'awakened' }
  | { type: 'active-effect-save-required'; targetId: string; effectId: string; ability: AbilityKey; dc: number; timing: 'target-turn-start' | 'target-turn-end' | 'takes-damage'; mode?: D20RollMode }
  | { type: 'active-effect-save-resolved'; targetId: string; effectId: string; ability: AbilityKey; dc: number; total: number; success: boolean }
  | { type: 'spell-cast'; actorId: string; targetId: string; spellId: string; slotLevel: number }
  | { type: 'counterspell-resolved'; actorId: string; casterId: string; spellId: string; spellLevel: number; slotLevel: number; dc?: number; abilityCheckTotal?: number; success: boolean }
  | { type: 'spell-dispelled'; actorId: string; targetId: string; spellId: string; spellLevel: number; effectId: string; dc?: number; total?: number; success: boolean }
  | { type: 'hellish-rebuke-resolved'; actorId: string; targetId: string; slotLevel: number; dc: number; saveTotal: number; success: boolean; damage: number }
  | { type: 'adjudicated-spell-resolved'; actorId: string; spellId: string; spellName: string; slotLevel: number; effectCount: number }
  | { type: 'spell-sculpted'; actorId: string; targetId: string; spellId: string }
  | { type: 'metamagic-applied'; actorId: string; spellId: string; kind: string; targetId?: string }
  | { type: 'damage-resistance-gained'; actorId: string; damageType: Dnd5eDamageType; source: 'draconic-elemental-affinity'; rounds: number }
  | { type: 'action-surge-granted'; actorId: string }
  | { type: 'damage-applied'; sourceId?: string; targetId: string; amount: number; hpBefore: number; hpAfter: number; temporaryHpBefore: number; temporaryHpAfter: number }
  | { type: 'hit-points-reduced-to-zero'; sourceId: string; targetId: string; hpBefore: number }
  | { type: 'instant-death'; sourceId: string; targetId: string; hpBefore: number }
  | { type: 'death-ward-triggered'; targetId: string; trigger: 'damage' | 'instant-death' }
  | { type: 'hostile-targeting-prevented'; actorId: string; targetId: string; source: 'tranquility' | 'nature-sanctuary' | 'sanctuary' }
  | { type: 'ability-check-resolved'; actorId: string; ability: AbilityKey; skill?: string; d20: number; modifier: number; total: number; mode: D20RollMode; reliableTalentApplied: boolean; indomitableMightApplied?: boolean; bardicInspirationApplied?: number; peerlessSkillApplied?: number; darkOnesOwnLuckApplied?: number; cuttingWordsApplied?: number; strokeOfLuckApplied?: boolean; dc?: number; success?: boolean }
  | { type: 'object-action-taken'; actorId: string; action: 'use-object' | 'interact-object'; interactionId?: string }
  | { type: 'hide-resolved'; actorId: string; d20: number; total: number }
  | { type: 'help-granted'; actorId: string; targetId: string; helpKind: 'ability-check' | 'attack' }
  | { type: 'ready-declared'; actorId: string; trigger: string; actionKind: 'attack' | 'move' | 'interact-object' | 'other'; targetId?: string }
  | { type: 'readied-action-triggered'; actorId: string; trigger: string; actionKind: 'attack' | 'move' | 'interact-object' | 'other'; targetId?: string }
  | { type: 'contest-resolved'; actorId: string; targetId: string; contest: 'grapple' | 'shove' | 'escape-grapple'; actorSkill?: 'athletics' | 'acrobatics'; targetDefense: 'athletics' | 'acrobatics'; actorTotal: number; targetTotal: number; success: boolean; outcome?: 'prone' | 'push' }
  | { type: 'concentration-check-required'; targetId: string; dc: number }
  | { type: 'relentless-rage-save-required'; targetId: string; dc: number }
  | { type: 'relentless-rage-resolved'; actorId: string; d20: number; total: number; dc: number; success: boolean }
  | { type: 'death-save-failure'; targetId: string; failures: number }
  | { type: 'death-save-resolved'; actorId: string; d20: number; successes: number; failures: number; stable: boolean; dead: boolean; currentHp: number }
  | { type: 'creature-stabilized'; actorId: string; targetId: string }
  | { type: 'delayed-spell-damage-triggered'; sourceId?: string; targetId: string; spellId: string; amount: number }
  | { type: 'concentration-resolved'; actorId: string; d20: number; total: number; dc: number; success: boolean }
  | { type: 'combat-ended' }

export type Dnd5eActionFailure =
  | 'combat-ended'
  | 'stale-turn'
  | 'invalid-actor'
  | 'invalid-target'
  | 'action-unavailable'
  | 'reaction-unavailable'
  | 'object-interaction-unavailable'
  | 'bonus-action-unavailable'
  | 'class-resource-unavailable'
  | 'invalid-class-feature'
  | 'feature-already-used'
  | 'invalid-plugin-action'
  | 'invalid-monster-action'
  | 'invalid-scene-interaction-outcome'
  | 'insufficient-movement'
  | 'invalid-dice'

export type Dnd5eActionResult =
  | { ok: true; state: Dnd5eHeadlessCombatState; events: readonly Dnd5eCombatEvent[]; transaction?: CombatTransaction }
  | { ok: false; state: Dnd5eHeadlessCombatState; events: readonly Dnd5eCombatEvent[]; reason: Dnd5eActionFailure; transaction?: CombatTransaction }

export interface Dnd5eHeadlessResolutionObservation {
  source: Dnd5eHeadlessCombatState
  action: Dnd5eAction
  result: Dnd5eActionResult
}

type Dnd5eHeadlessResolutionObserver = (observation: Dnd5eHeadlessResolutionObservation) => void

let headlessResolutionObserver: Dnd5eHeadlessResolutionObserver | undefined
let headlessResolutionDepth = 0

export function setDnd5eHeadlessResolutionObserver(
  observer: Dnd5eHeadlessResolutionObserver | undefined,
): () => void {
  headlessResolutionObserver = observer
  return () => {
    if (headlessResolutionObserver === observer) headlessResolutionObserver = undefined
  }
}

function clone(state: Dnd5eHeadlessCombatState): Dnd5eHeadlessCombatState {
  return {
    ...state,
    effectiveRules: state.effectiveRules ? {
      ...state.effectiveRules,
      sourceOrder: [...state.effectiveRules.sourceOrder],
      houseRules: { ...state.effectiveRules.houseRules },
      requiredPlugins: state.effectiveRules.requiredPlugins.map((plugin) => ({ ...plugin })),
    } : undefined,
    initiativeOrder: [...state.initiativeOrder],
    pendingMonsterMechanicTriggers: state.pendingMonsterMechanicTriggers
      ? Object.fromEntries(Object.entries(state.pendingMonsterMechanicTriggers).map(([id, snapshot]) => [id, { ...snapshot }]))
      : undefined,
    distanceFeetByCombatantPair: state.distanceFeetByCombatantPair
      ? { ...state.distanceFeetByCombatantPair }
      : undefined,
    coverBonusByCombatantPair: state.coverBonusByCombatantPair ? { ...state.coverBonusByCombatantPair } : undefined,
    lineOfEffectBlockedByCombatantPair: state.lineOfEffectBlockedByCombatantPair
      ? { ...state.lineOfEffectBlockedByCombatantPair }
      : undefined,
    lineOfSightBlockedByCombatantPair: state.lineOfSightBlockedByCombatantPair
      ? { ...state.lineOfSightBlockedByCombatantPair }
      : undefined,
    magicalDarknessByCombatantPair: state.magicalDarknessByCombatantPair
      ? { ...state.magicalDarknessByCombatantPair }
      : undefined,
    combatants: Object.fromEntries(Object.entries(state.combatants).map(([id, combatant]) => [id, {
      ...combatant,
      abilities: { ...combatant.abilities },
      baseSavingThrowBonuses: { ...combatant.baseSavingThrowBonuses },
      savingThrowBonuses: { ...combatant.savingThrowBonuses },
      savingThrowProficiencies: [...combatant.savingThrowProficiencies],
      skillProficiencies: [...combatant.skillProficiencies],
      classResources: Object.fromEntries(Object.entries(combatant.classResources).map(([key, resource]) => [key, { ...resource }])),
      classSelections: Object.fromEntries(Object.entries(combatant.classSelections).map(([key, values]) => [key, [...values]])),
      classLevels: combatant.classLevels ? { ...combatant.classLevels } : undefined,
      subclassIds: combatant.subclassIds ? { ...combatant.subclassIds } : undefined,
      classSelectionsByClass: combatant.classSelectionsByClass
        ? Object.fromEntries(Object.entries(combatant.classSelectionsByClass).map(([classId, selections]) => [
            classId,
            Object.fromEntries(Object.entries(selections ?? {}).map(([key, values]) => [key, [...values]])),
          ]))
        : undefined,
      pluginFeatureIds: [...combatant.pluginFeatureIds],
      countercharmSourceIds: combatant.countercharmSourceIds ? [...combatant.countercharmSourceIds] : undefined,
      holyNimbusSourceIds: combatant.holyNimbusSourceIds ? [...combatant.holyNimbusSourceIds] : undefined,
      draconicPresenceSourceIds: combatant.draconicPresenceSourceIds ? [...combatant.draconicPresenceSourceIds] : undefined,
      classState: {
        ...combatant.classState,
        declarativeUsedTurnKeys: combatant.classState.declarativeUsedTurnKeys
          ? { ...combatant.classState.declarativeUsedTurnKeys }
          : undefined,
        declarativeTransactionIds: combatant.classState.declarativeTransactionIds
          ? [...combatant.classState.declarativeTransactionIds]
          : undefined,
        monsterMechanicRollModifiers: combatant.classState.monsterMechanicRollModifiers
          ? combatant.classState.monsterMechanicRollModifiers.map((modifier) => ({ ...modifier }))
          : undefined,
        pendingMonsterMechanicTriggers: combatant.classState.pendingMonsterMechanicTriggers
          ? Object.fromEntries(Object.entries(combatant.classState.pendingMonsterMechanicTriggers).map(([id, snapshot]) => [id, { ...snapshot }]))
          : undefined,
        activeEffects: combatant.classState.activeEffects
          ? combatant.classState.activeEffects.map((effect) => ({
              ...effect,
              source: { ...effect.source },
              duration: { ...effect.duration },
              repeatSave: effect.repeatSave ? { ...effect.repeatSave } : undefined,
              breakOn: effect.breakOn ? [...effect.breakOn] : undefined,
            }))
          : undefined,
        concentrationTargetIds: combatant.classState.concentrationTargetIds
          ? [...combatant.classState.concentrationTargetIds]
          : undefined,
        concentrationEffectsBySource: combatant.classState.concentrationEffectsBySource
          ? { ...combatant.classState.concentrationEffectsBySource }
          : undefined,
        monsterRechargeReadyByActionId: combatant.classState.monsterRechargeReadyByActionId
          ? { ...combatant.classState.monsterRechargeReadyByActionId }
          : undefined,
        monsterActionUsesByActionId: combatant.classState.monsterActionUsesByActionId
          ? Object.fromEntries(Object.entries(combatant.classState.monsterActionUsesByActionId)
            .map(([actionId, resource]) => [actionId, { ...resource }]))
          : undefined,
        monsterThreatByTargetId: combatant.classState.monsterThreatByTargetId
          ? { ...combatant.classState.monsterThreatByTargetId }
          : undefined,
        monsterSpellSlots: combatant.classState.monsterSpellSlots
          ? Object.fromEntries(Object.entries(combatant.classState.monsterSpellSlots).map(([level, resource]) => [level, { ...resource }]))
          : undefined,
        monsterSpellUsesBySpellId: combatant.classState.monsterSpellUsesBySpellId
          ? Object.fromEntries(Object.entries(combatant.classState.monsterSpellUsesBySpellId).map(([spellId, resource]) => [spellId, { ...resource }]))
          : undefined,
        intimidatingPresenceImmunityRoundsBySource: combatant.classState.intimidatingPresenceImmunityRoundsBySource
          ? { ...combatant.classState.intimidatingPresenceImmunityRoundsBySource }
          : undefined,
        natureSanctuaryImmunityRoundsByTarget: combatant.classState.natureSanctuaryImmunityRoundsByTarget
          ? { ...combatant.classState.natureSanctuaryImmunityRoundsByTarget }
          : undefined,
        draconicPresenceImmunityRoundsBySource: combatant.classState.draconicPresenceImmunityRoundsBySource
          ? { ...combatant.classState.draconicPresenceImmunityRoundsBySource }
          : undefined,
        wildShapeOriginalAbilities: combatant.classState.wildShapeOriginalAbilities
          ? { ...combatant.classState.wildShapeOriginalAbilities }
          : undefined,
        wildShapeOriginalSavingThrowBonuses: combatant.classState.wildShapeOriginalSavingThrowBonuses
          ? { ...combatant.classState.wildShapeOriginalSavingThrowBonuses }
          : undefined,
        wildShapeOriginalDamageVulnerabilities: combatant.classState.wildShapeOriginalDamageVulnerabilities
          ? [...combatant.classState.wildShapeOriginalDamageVulnerabilities]
          : undefined,
        wildShapeOriginalDamageResistances: combatant.classState.wildShapeOriginalDamageResistances
          ? [...combatant.classState.wildShapeOriginalDamageResistances]
          : undefined,
        wildShapeOriginalDamageImmunities: combatant.classState.wildShapeOriginalDamageImmunities
          ? [...combatant.classState.wildShapeOriginalDamageImmunities]
          : undefined,
        wildShapeOriginalConditionImmunities: combatant.classState.wildShapeOriginalConditionImmunities
          ? [...combatant.classState.wildShapeOriginalConditionImmunities]
          : undefined,
        undeadFortitudePending: combatant.classState.undeadFortitudePending
          ? { ...combatant.classState.undeadFortitudePending }
          : undefined,
        monsterOnHitSavePending: combatant.classState.monsterOnHitSavePending
          ? { ...combatant.classState.monsterOnHitSavePending }
          : undefined,
        activeEffectDamageSavePendingIds: combatant.classState.activeEffectDamageSavePendingIds
          ? [...combatant.classState.activeEffectDamageSavePendingIds]
          : undefined,
      },
      position: { ...combatant.position },
      movementSpeeds: combatant.movementSpeeds ? { ...combatant.movementSpeeds } : undefined,
      specialSenses: combatant.specialSenses?.map((sense) => ({ ...sense })),
      turn: { ...combatant.turn },
      deathSaves: { ...combatant.deathSaves },
      damageVulnerabilities: [...combatant.damageVulnerabilities],
      damageResistances: [...combatant.damageResistances],
      damageImmunities: [...combatant.damageImmunities],
      conditionImmunities: [...combatant.conditionImmunities],
      conditions: [...combatant.conditions],
    }])),
  }
}

export function createDnd5eCombatant(
  input: Omit<Dnd5eCombatant, 'turn' | 'dodging' | 'disengaged' | 'deathSaves' | 'level' | 'sizeRank' | 'exhaustionLevel' | 'baseSavingThrowBonuses' | 'savingThrowBonuses' | 'savingThrowProficiencies' | 'skillProficiencies' | 'passivePerception' | 'classResources' | 'classSelections' | 'pluginFeatureIds' | 'classState' | 'wearingArmor' | 'wearingUnproficientArmor' | 'armorStealthDisadvantage' | 'wearingHeavyArmor' | 'wearingMetalArmor' | 'hasShield' | 'damageVulnerabilities' | 'damageResistances' | 'damageImmunities' | 'conditionImmunities' | 'conditions'> &
    Partial<Pick<Dnd5eCombatant, 'level' | 'sizeRank' | 'exhaustionLevel' | 'baseSavingThrowBonuses' | 'savingThrowBonuses' | 'savingThrowProficiencies' | 'skillProficiencies' | 'passivePerception' | 'classResources' | 'classSelections' | 'pluginFeatureIds' | 'classState' | 'wearingArmor' | 'wearingUnproficientArmor' | 'armorStealthDisadvantage' | 'wearingHeavyArmor' | 'wearingMetalArmor' | 'hasShield' | 'damageVulnerabilities' | 'damageResistances' | 'damageImmunities' | 'conditionImmunities' | 'conditions' | 'usesDeathSaves'>>,
): Dnd5eCombatant {
  const baseSavingThrowBonuses = { ...(input.baseSavingThrowBonuses ?? input.savingThrowBonuses) }
  const activeEffects = normalizeDnd5eActiveEffects(input.classState?.activeEffects)
  const nativeClassState = input.classState ?? {}
  const usesDeathSaves = input.usesDeathSaves ?? (input.classId != null || input.controller === 'player')
  return {
    ...input,
    level: Math.min(20, Math.max(1, Math.floor(input.level ?? 1))),
    sizeRank: Math.min(5, Math.max(0, Math.floor(input.sizeRank ?? 2))),
    exhaustionLevel: Math.min(6, Math.max(0, Math.floor(input.exhaustionLevel ?? 0))),
    baseSavingThrowBonuses,
    savingThrowBonuses: { ...baseSavingThrowBonuses, ...input.savingThrowBonuses },
    savingThrowProficiencies: [...input.savingThrowProficiencies ?? []],
    skillProficiencies: [...input.skillProficiencies ?? []],
    passivePerception: Math.max(0, Math.floor(input.passivePerception ?? 10)),
    darkvisionRangeFeet: Number.isFinite(input.darkvisionRangeFeet)
      ? Math.max(0, Math.min(10_000, Math.floor(input.darkvisionRangeFeet ?? 0)))
      : undefined,
    classResources: Object.fromEntries(Object.entries(input.classResources ?? {}).map(([key, resource]) => [key, { ...resource }])),
    classSelections: Object.fromEntries(Object.entries(input.classSelections ?? {}).map(([key, values]) => [key, [...values]])),
    classLevels: input.classLevels ? { ...input.classLevels } : input.classId ? { [input.classId]: input.level ?? 1 } : undefined,
    subclassIds: input.subclassIds ? { ...input.subclassIds } : input.classId && input.subclassId ? { [input.classId]: input.subclassId } : undefined,
    classSelectionsByClass: input.classSelectionsByClass
      ? Object.fromEntries(Object.entries(input.classSelectionsByClass).map(([classId, selections]) => [
          classId,
          Object.fromEntries(Object.entries(selections ?? {}).map(([key, values]) => [key, [...values]])),
        ]))
      : undefined,
    pluginFeatureIds: [...new Set(input.pluginFeatureIds ?? [])],
    classState: {
      ...nativeClassState,
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
    },
    wearingArmor: input.wearingArmor ?? false,
    wearingUnproficientArmor: input.wearingUnproficientArmor ?? false,
    armorStealthDisadvantage: input.armorStealthDisadvantage ?? false,
    wearingHeavyArmor: input.wearingHeavyArmor ?? false,
    wearingMetalArmor: input.wearingMetalArmor ?? false,
    hasShield: input.hasShield ?? false,
    turn: rules.createTurn(dnd5eConditionSetsSpeedToZero({ conditions: dnd5eConditionsFromActiveEffects(activeEffects) })
      ? 0
      : Math.max(0, input.speed - dnd5eActiveSpeedPenalty(activeEffects))),
    dodging: input.classState?.dodgingTurnKey != null,
    disengaged: false,
    deathSaves: {
      successes: 0,
      failures: input.currentHp === 0 && !usesDeathSaves &&
        !nativeClassState.undeadFortitudePending && !nativeClassState.monsterRegenerationPendingAtZero ? 3 : 0,
      stable: false,
      dead: input.currentHp === 0 && !usesDeathSaves &&
        !nativeClassState.undeadFortitudePending && !nativeClassState.monsterRegenerationPendingAtZero,
    },
    usesDeathSaves,
    damageVulnerabilities: [...input.damageVulnerabilities ?? []],
    damageResistances: [...input.damageResistances ?? []],
    damageImmunities: [...input.damageImmunities ?? []],
    conditionImmunities: [...input.conditionImmunities ?? []],
    conditions: dnd5eConditionsFromActiveEffects(activeEffects),
  }
}

export function startDnd5eHeadlessCombat(combatId: string, combatants: readonly Dnd5eCombatant[]): Dnd5eHeadlessCombatState {
  const ordered = [...combatants].sort((left, right) => right.initiative - left.initiative)
  const state: Dnd5eHeadlessCombatState = {
    rulesetId: rules.id,
    combatId,
    active: ordered.length > 1,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: ordered.map((combatant) => combatant.id),
    combatants: Object.fromEntries(ordered.map((combatant) => [combatant.id, {
      ...combatant,
      turn: rules.createTurn(dnd5eEffectiveSpeed(combatant)),
    }])),
  }
  return state
}

export function dnd5eEffectiveSpeed(
  combatant: Pick<Dnd5eCombatant, 'speed' | 'classState'> & Partial<Pick<Dnd5eCombatant, 'conditions'>>,
): number {
  if (dnd5eConditionSetsSpeedToZero(combatant)) return 0
  return Math.max(
    0,
    Math.floor(combatant.speed) -
      dnd5eActiveSpeedPenalty(combatant.classState.activeEffects) -
      Math.max(0, combatant.classState.caltropsSpeedPenaltyFeet ?? 0) +
      dnd5eActiveSpeedBonus(combatant.classState.activeEffects),
  )
}

export function dnd5eEffectiveFlySpeed(
  combatant: Pick<Dnd5eCombatant, 'movementSpeeds' | 'classState'>,
): number | undefined {
  const speed = Math.max(
    combatant.movementSpeeds?.fly ?? 0,
    dnd5eActiveFlySpeed(combatant.classState.activeEffects) ?? 0,
  )
  return speed > 0 ? speed : undefined
}

export function dnd5eEffectiveSizeRank(
  combatant: Pick<Dnd5eCombatant, 'sizeRank' | 'classState'>,
): number {
  return Math.min(
    5,
    Math.max(0, Math.floor(combatant.sizeRank) + dnd5eActiveSizeRankDelta(combatant.classState.activeEffects)),
  )
}

/**
 * 标准状态唯一的 Headless 写入口。状态免疫、来源并存、事件与持久化在这里统一处理。
 * 返回 false 表示目标免疫；调用方不得绕过此函数直接写 conditions 或旧 timedEffects。
 */
export function applyDnd5eStandardConditionEffect(
  target: Dnd5eCombatant,
  source: Dnd5eCombatant | undefined,
  input: {
    id?: string
    definitionId?: string
    rulesId: string
    condition: Dnd5eStandardConditionId
    duration: Dnd5eActiveEffectDuration
    appliedTurnKey?: string
    repeatSave?: Dnd5eActiveEffectInstance['repeatSave']
    escapeCheck?: Dnd5eActiveEffectInstance['escapeCheck']
    breakOn?: Dnd5eActiveEffectInstance['breakOn']
    sourceKind?: Dnd5eActiveEffectInstance['source']['kind']
    pluginId?: string
    spellLevel?: number
  },
  events: Dnd5eCombatEvent[],
): boolean {
  if (dnd5eConditionImmuneFromSource(target, input.condition, source)) return false
  const alreadyActive = target.conditions.some((condition) => dnd5eStandardConditionId(condition) === input.condition)
  const incoming = createDnd5eConditionEffect({
    id: input.id,
    condition: input.condition,
    source: {
      kind: input.sourceKind ?? 'spell', actorId: source?.id,
      actorName: source?.name, rulesId: input.rulesId, pluginId: input.pluginId,
      spellLevel: input.spellLevel,
    },
    targetId: target.id,
    duration: input.duration,
    repeatSave: input.repeatSave,
    escapeCheck: input.escapeCheck,
    breakOn: input.breakOn,
    appliedRound: undefined,
    appliedTurnKey: input.appliedTurnKey,
    stackingKey: input.definitionId ?? `condition:${input.condition}:${input.rulesId}`,
  })
  const mutation = applyDnd5eActiveEffect({
    effects: reconciledDnd5eActiveEffects(target), incoming,
    conditionImmunities: target.conditionImmunities,
  })
  if (mutation.status === 'rejected-immune') return false
  commitDnd5eActiveEffects(target, mutation.effects)
  if (!alreadyActive) {
    events.push({
      type: 'condition-applied', actorId: source?.id ?? target.id,
      targetId: target.id, condition: input.condition,
    })
  }
  events.push({
    type: 'active-effect-applied', targetId: target.id,
    effectId: incoming.id, definitionId: incoming.definitionId,
  })
  events.push({
    type: 'class-state-changed', actorId: source?.id ?? target.id, targetId: target.id,
    stateKey: input.rulesId, active: true,
  })
  return true
}

function applyDnd5eMechanicalStatusEffect(
  target: Dnd5eCombatant,
  source: Dnd5eCombatant,
  input: {
    definitionId: string
    rulesId?: string
    label: string
    duration: Dnd5eActiveEffectDuration
    repeatSave?: Dnd5eActiveEffectRepeatSave
    appliedTurnKey?: string
    speedPenaltyFeet?: number
    speedBonusFeet?: number
    darkvisionRangeFeet?: number
    seeInvisible?: boolean
    flySpeedFeet?: number
    jumpDistanceMultiplier?: number
    sizeRankDelta?: -1 | 1
    strengthRollMode?: 'advantage' | 'disadvantage'
    abilityCheckAdvantages?: readonly AbilityKey[]
    carryingCapacityMultiplier?: number
    safeFallFeet?: number
    weaponDamageD4?: 'add' | 'subtract'
    shillelagh?: Dnd5eActiveEffectModifiers['shillelagh']
    magicWeapon?: Dnd5eActiveEffectModifiers['magicWeapon']
    preventReactions?: boolean
    damageResistance?: Dnd5eDamageType
    conditionImmunities?: readonly Dnd5eStandardConditionId[]
    spellLevel?: number
    potency?: number
    stackingPolicy?: Dnd5eActiveEffectInstance['stackingPolicy']
    stackingKey?: string
    instanceKey?: string
    breakOn?: Dnd5eActiveEffectInstance['breakOn']
    sourceKind?: Dnd5eActiveEffectInstance['source']['kind']
  },
  events: Dnd5eCombatEvent[],
): void {
  const incoming = createDnd5eMechanicalEffect({
    id: input.instanceKey
      ? dnd5eActiveEffectId(input.definitionId, source.id, target.id, input.instanceKey)
      : dnd5eActiveEffectId(input.definitionId, source.id, target.id),
    definitionId: input.definitionId,
    label: input.label,
    source: {
      kind: input.sourceKind ?? 'spell',
      actorId: source.id,
      actorName: source.name,
      rulesId: input.rulesId ?? input.definitionId,
      spellLevel: input.spellLevel,
    },
    targetId: target.id,
    duration: input.duration,
    repeatSave: input.repeatSave,
    potency: input.potency,
    stackingPolicy: input.stackingPolicy,
    stackingKey: input.stackingKey,
    appliedTurnKey: input.appliedTurnKey,
    modifiers: {
      speedPenaltyFeet: input.speedPenaltyFeet,
      speedBonusFeet: input.speedBonusFeet,
      darkvisionRangeFeet: input.darkvisionRangeFeet,
      seeInvisible: input.seeInvisible,
      flySpeedFeet: input.flySpeedFeet,
      jumpDistanceMultiplier: input.jumpDistanceMultiplier,
      sizeRankDelta: input.sizeRankDelta,
      strengthRollMode: input.strengthRollMode,
      abilityCheckAdvantages: input.abilityCheckAdvantages,
      carryingCapacityMultiplier: input.carryingCapacityMultiplier,
      safeFallFeet: input.safeFallFeet,
      weaponDamageD4: input.weaponDamageD4,
      shillelagh: input.shillelagh,
      magicWeapon: input.magicWeapon,
      preventReactions: input.preventReactions,
      damageResistance: input.damageResistance,
      conditionImmunities: input.conditionImmunities,
    },
    breakOn: input.breakOn,
  })
  const mutation = applyDnd5eActiveEffect({
    effects: reconciledDnd5eActiveEffects(target), incoming,
    conditionImmunities: target.conditionImmunities,
  })
  commitDnd5eActiveEffects(target, mutation.effects)
  if (input.preventReactions) target.turn = { ...target.turn, reactionAvailable: false }
  events.push({
    type: 'active-effect-applied', targetId: target.id,
    effectId: incoming.id, definitionId: incoming.definitionId,
  })
}

function dnd5eCapabilityDuration(input: {
  expiresAt: 'source-next-turn-start' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save' | 'permanent'
  remainingRounds?: number
}): Dnd5eActiveEffectDuration {
  if (input.expiresAt === 'permanent') return { type: 'permanent' }
  if (input.expiresAt === 'source-next-turn-start') {
    return { type: 'until-turn-boundary', boundary: 'source-turn-start' }
  }
  if (input.expiresAt === 'target-next-turn-start') {
    return { type: 'until-turn-boundary', boundary: 'target-turn-start' }
  }
  return {
    type: 'rounds', remainingRounds: Math.max(1, Math.floor(input.remainingRounds ?? 1)),
    tickOn: 'target-turn-end',
  }
}

function applyDnd5eRulesCondition(
  target: Dnd5eCombatant,
  source: Dnd5eCombatant | undefined,
  input: {
    condition: string
    rulesId: string
    duration?: Dnd5eActiveEffectDuration
    breakOn?: Dnd5eActiveEffectInstance['breakOn']
    appliedTurnKey?: string
    sourceKind?: Dnd5eActiveEffectInstance['source']['kind']
    spellLevel?: number
  },
  events: Dnd5eCombatEvent[],
): boolean {
  const standard = dnd5eStandardConditionId(input.condition)
  if (standard) {
    return applyDnd5eStandardConditionEffect(target, source, {
      rulesId: input.rulesId,
      condition: standard,
      duration: input.duration ?? { type: 'permanent' },
      breakOn: input.breakOn,
      appliedTurnKey: input.appliedTurnKey,
      sourceKind: input.sourceKind ?? 'feature',
      spellLevel: input.spellLevel,
    }, events)
  }
  const incoming = createDnd5eMechanicalEffect({
    id: dnd5eActiveEffectId(`rules:${input.rulesId}`, source?.id ?? 'system', target.id, input.condition),
    definitionId: `rules:${input.rulesId}:${input.condition}`,
    label: input.condition,
    kind: 'custom',
    source: {
      kind: input.sourceKind ?? 'feature', actorId: source?.id,
      actorName: source?.name, rulesId: input.rulesId, spellLevel: input.spellLevel,
    },
    targetId: target.id,
    duration: input.duration ?? { type: 'permanent' },
    breakOn: input.breakOn,
    appliedTurnKey: input.appliedTurnKey,
    legacyCondition: input.condition,
  })
  const mutation = applyDnd5eActiveEffect({ effects: reconciledDnd5eActiveEffects(target), incoming })
  commitDnd5eActiveEffects(target, mutation.effects)
  events.push({
    type: 'active-effect-applied', targetId: target.id,
    effectId: incoming.id, definitionId: incoming.definitionId,
  })
  return true
}

function removeDnd5eConditionEffects(
  target: Dnd5eCombatant,
  aliases: readonly string[],
  reason: Extract<Dnd5eCombatEvent, { type: 'active-effect-removed' }>['reason'],
  events: Dnd5eCombatEvent[],
): Dnd5eActiveEffectInstance[] {
  const rawAliases = new Set(aliases.map((alias) => alias.trim().toLowerCase()))
  const standardAliases = new Set(aliases.flatMap((alias) => {
    const standard = dnd5eStandardConditionId(alias)
    return standard ? [standard] : []
  }))
  return removeDnd5eEffectsByPredicate(target, (effect) =>
    (effect.standardCondition != null && standardAliases.has(effect.standardCondition)) ||
    (effect.legacyCondition != null && rawAliases.has(effect.legacyCondition.trim().toLowerCase())),
  reason, events)
}

function reconciledDnd5eActiveEffects(target: Dnd5eCombatant): Dnd5eActiveEffectInstance[] {
  const effects = normalizeDnd5eActiveEffects(target.classState.activeEffects)
  target.classState.schemaVersion = DND5E_COMBAT_STATE_SCHEMA_VERSION
  target.conditions = dnd5eConditionsFromActiveEffects(effects)
  return effects
}

function commitDnd5eActiveEffects(
  target: Dnd5eCombatant,
  effects: readonly Dnd5eActiveEffectInstance[],
): void {
  const normalized = normalizeDnd5eActiveEffects(effects)
  target.classState.schemaVersion = DND5E_COMBAT_STATE_SCHEMA_VERSION
  target.classState.activeEffects = normalized.length > 0 ? normalized : undefined
  target.conditions = dnd5eConditionsFromActiveEffects(normalized)
  target.turn = {
    ...target.turn,
    movementRemaining: Math.min(target.turn.movementRemaining, dnd5eEffectiveSpeed(target)),
  }
}

function removeDnd5eEffectsByPredicate(
  target: Dnd5eCombatant,
  predicate: (effect: Dnd5eActiveEffectInstance) => boolean,
  reason: Extract<Dnd5eCombatEvent, { type: 'active-effect-removed' }>['reason'],
  events: Dnd5eCombatEvent[],
): Dnd5eActiveEffectInstance[] {
  const effects = reconciledDnd5eActiveEffects(target)
  const removed = effects.filter(predicate)
  if (removed.length === 0) return []
  commitDnd5eActiveEffects(target, effects.filter((effect) => !predicate(effect)))
  clearTemporaryHitPointsFromRemovedEffects(target, removed, events)
  for (const effect of removed) {
    events.push({
      type: 'active-effect-removed', targetId: target.id, effectId: effect.id,
      definitionId: effect.definitionId, reason,
    })
    if (
      effect.standardCondition &&
      !target.conditions.some((condition) => dnd5eStandardConditionId(condition) === effect.standardCondition)
    ) events.push({ type: 'condition-ended', targetId: target.id, condition: effect.standardCondition })
  }
  return removed
}

function triggerDnd5eActiveEffectBreak(
  target: Dnd5eCombatant,
  trigger: Dnd5eActiveEffectBreakTrigger,
  events: Dnd5eCombatEvent[],
  state?: Dnd5eHeadlessCombatState,
): void {
  const resolved = removeDnd5eActiveEffectsForEvent({
    effects: reconciledDnd5eActiveEffects(target),
    trigger,
  })
  if (resolved.removed.length === 0) return
  commitDnd5eActiveEffects(target, resolved.effects)
  for (const effect of resolved.removed) {
    events.push({
      type: 'active-effect-removed', targetId: target.id, effectId: effect.id,
      definitionId: effect.definitionId, reason: trigger,
    })
    if (
      effect.standardCondition &&
      !target.conditions.some((condition) => dnd5eStandardConditionId(condition) === effect.standardCondition)
    ) events.push({ type: 'condition-ended', targetId: target.id, condition: effect.standardCondition })
  }
  if (!state) return
  const concentrationLinks = new Map<string, { sourceActorId: string; spellId: string }>()
  for (const effect of resolved.removed) {
    if (effect.duration.type !== 'concentration') continue
    const spellId = effect.duration.concentrationId ?? effect.source.rulesId
    if (!spellId) continue
    concentrationLinks.set(`${effect.duration.sourceActorId}:${spellId}`, {
      sourceActorId: effect.duration.sourceActorId,
      spellId,
    })
  }
  for (const link of concentrationLinks.values()) {
    const source = state.combatants[link.sourceActorId]
    if (source) endDnd5eSpellEffectOnTarget(state, source, target, link.spellId, events)
  }
}

function endCharmPersonForHarmfulAction(
  state: Dnd5eHeadlessCombatState,
  harmfulActor: Dnd5eCombatant,
  target: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
): void {
  const effects = reconciledDnd5eActiveEffects(target)
  const removed = effects.filter((effect) => {
    if (
      effect.standardCondition !== 'charmed' ||
      effect.source.rulesId !== 'charm-person' ||
      !effect.source.actorId
    ) return false
    const source = state.combatants[effect.source.actorId]
    return harmfulActor.id === effect.source.actorId ||
      (source != null && harmfulActor.controller === source.controller)
  })
  if (removed.length === 0) return
  const removedIds = new Set(removed.map((effect) => effect.id))
  commitDnd5eActiveEffects(target, effects.filter((effect) => !removedIds.has(effect.id)))
  for (const effect of removed) {
    events.push({
      type: 'active-effect-removed',
      targetId: target.id,
      effectId: effect.id,
      definitionId: effect.definitionId,
      reason: 'harmful-action',
    })
  }
  if (!target.conditions.some((condition) => dnd5eStandardConditionId(condition) === 'charmed')) {
    events.push({ type: 'condition-ended', targetId: target.id, condition: 'charmed' })
  }
}

const ABOLETH_ENSLAVE_RULES_ID = 'monster:srd-5.1:aboleth:enslave'

function endAbolethEnslaveEffects(
  state: Dnd5eHeadlessCombatState,
  sourceId: string,
  reason: Extract<Dnd5eCombatEvent, { type: 'active-effect-removed' }>['reason'],
  events: Dnd5eCombatEvent[],
): void {
  for (const combatant of Object.values(state.combatants)) {
    removeDnd5eEffectsByPredicate(
      combatant,
      (effect) =>
        effect.source.actorId === sourceId &&
        effect.source.rulesId === ABOLETH_ENSLAVE_RULES_ID,
      reason,
      events,
    )
  }
}

function emitDnd5eAttackResolved(
  state: Dnd5eHeadlessCombatState,
  event: Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>,
  events: Dnd5eCombatEvent[],
): void {
  events.push(event)
  const attacker = state.combatants[event.actorId]
  const target = state.combatants[event.targetId]
  if (attacker) {
    triggerDnd5eActiveEffectBreak(attacker, 'makes-attack', events, state)
    if (attacker.classState.hiddenCheckTotal != null) {
      attacker.classState.hiddenCheckTotal = undefined
      events.push({ type: 'class-state-changed', actorId: attacker.id, stateKey: 'hidden', active: false })
    }
  }
  if (target) {
    if (attacker) endCharmPersonForHarmfulAction(state, attacker, target, events)
    triggerDnd5eActiveEffectBreak(target, 'targeted-by-attack', events, state)
    if (event.hit) triggerDnd5eActiveEffectBreak(target, 'hit-by-attack', events, state)
  }
}

function emitDnd5eSpellCast(
  state: Dnd5eHeadlessCombatState,
  event: Extract<Dnd5eCombatEvent, { type: 'spell-cast' }>,
  events: Dnd5eCombatEvent[],
): void {
  events.push(event)
  const caster = state.combatants[event.actorId]
  if (caster) triggerDnd5eActiveEffectBreak(caster, 'casts-spell', events, state)
}

function advanceDnd5eActiveEffectsAtBoundary(input: {
  state: Dnd5eHeadlessCombatState
  actor: Dnd5eCombatant
  point: 'start' | 'end'
  events: Dnd5eCombatEvent[]
}): void {
  const actorBoundary = `source-turn-${input.point}` as const
  const targetBoundary = `target-turn-${input.point}` as const
  for (const target of Object.values(input.state.combatants)) {
    const effects = reconciledDnd5eActiveEffects(target)
    const next: Dnd5eActiveEffectInstance[] = []
    const removed: Dnd5eActiveEffectInstance[] = []
    const boundaryTurnKey = classFeatureTurnKey(input.state, input.actor.id)
    for (const effect of effects) {
      if (effect.duration.type === 'until-turn-boundary') {
        const sourceMatches = effect.duration.boundary === actorBoundary && effect.source.actorId === input.actor.id
        const targetMatches = effect.duration.boundary === targetBoundary && target.id === input.actor.id
        if ((sourceMatches || targetMatches) && effect.appliedTurnKey !== boundaryTurnKey) {
          removed.push(effect)
          continue
        }
      }
      if (
        effect.duration.type === 'rounds' &&
        effect.duration.tickOn === targetBoundary &&
        target.id === input.actor.id &&
        !(effect.repeatSave && effect.repeatSave.timing === targetBoundary) &&
        effect.duration.lastTickTurnKey !== boundaryTurnKey
      ) {
        const remainingRounds = Math.max(0, effect.duration.remainingRounds - 1)
        if (remainingRounds === 0) {
          removed.push(effect)
          continue
        }
        next.push({
          ...effect,
          duration: { ...effect.duration, remainingRounds, lastTickTurnKey: boundaryTurnKey },
        })
        continue
      }
      next.push(effect)
    }
    if (removed.length === 0 && JSON.stringify(next) === JSON.stringify(effects)) continue
    commitDnd5eActiveEffects(target, next)
    for (const effect of removed) {
      input.events.push({
        type: 'active-effect-removed', targetId: target.id, effectId: effect.id,
        definitionId: effect.definitionId, reason: 'expired',
      })
      if (
        effect.standardCondition &&
        !target.conditions.some((condition) => dnd5eStandardConditionId(condition) === effect.standardCondition)
      ) input.events.push({ type: 'condition-ended', targetId: target.id, condition: effect.standardCondition })
    }
  }
}

function triggerDnd5eDelayedSpellDamageAtTurnEnd(
  state: Dnd5eHeadlessCombatState,
  target: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
): void {
  const boundaryTurnKey = classFeatureTurnKey(state, target.id)
  const pending = reconciledDnd5eActiveEffects(target).filter((effect) =>
    effect.definitionId === 'srd-5.1:spell:acid-arrow:delayed-damage' &&
    effect.duration.type === 'until-turn-boundary' &&
    effect.duration.boundary === 'target-turn-end' &&
    effect.appliedTurnKey !== boundaryTurnKey,
  )
  for (const effect of pending) {
    const source = effect.source.actorId ? state.combatants[effect.source.actorId] : undefined
    const rawDamage = Math.max(0, Math.floor(effect.potency ?? 0))
    const damage = adjustDamageForTarget(target, rawDamage, 'acid')
    if (damage > 0 && !target.deathSaves.dead) {
      applyDamage(target, damage, false, events, source, state, ['acid'])
    }
    events.push({
      type: 'delayed-spell-damage-triggered',
      sourceId: source?.id,
      targetId: target.id,
      spellId: 'acid-arrow',
      amount: damage,
    })
  }
  if (pending.length > 0) {
    const pendingIds = new Set(pending.map((effect) => effect.id))
    removeDnd5eEffectsByPredicate(target, (effect) => pendingIds.has(effect.id), 'expired', events)
  }
}

function resolveDnd5eActiveEffectSaves(input: {
  state: Dnd5eHeadlessCombatState
  target: Dnd5eCombatant
  timing: 'target-turn-start' | 'target-turn-end'
  supplied?: readonly Dnd5eActiveEffectSavingThrowRoll[]
  events: Dnd5eCombatEvent[]
}): boolean {
  const effects = reconciledDnd5eActiveEffects(input.target).filter((effect) =>
    effect.repeatSave?.timing === input.timing,
  )
  const supplied = input.supplied ?? []
  if (
    supplied.length !== effects.length ||
    new Set(supplied.map((roll) => roll.effectId)).size !== supplied.length ||
    supplied.some((roll) => !effects.some((effect) => effect.id === roll.effectId))
  ) return false
  try {
    for (const effect of effects) {
      const repeatSave = effect.repeatSave!
      const roll = supplied.find((candidate) => candidate.effectId === effect.id)!
      const failureDamage = repeatSave.damageOnFailure
      const failureDamageRolls = roll.damageRolls ?? []
      if (
        failureDamage
          ? failureDamageRolls.length !== failureDamage.count ||
            failureDamageRolls.some((value) =>
              !Number.isInteger(value) || value < 1 || value > failureDamage.sides,
            )
          : failureDamageRolls.length > 0
      ) return false
      const source = effect.source.actorId ? input.state.combatants[effect.source.actorId] : undefined
      let mode = dnd5eSavingThrowMode(input.target, repeatSave.ability, {
        effectVisible: effect.visibility !== 'dm-only',
        sourceCreatureType: source?.creatureType,
        sourceIsSpell: effect.source.kind === 'spell',
      })
      if (effect.source.rulesId === 'sunburst' && dnd5eSunburstSavingThrowDisadvantage(input.target)) {
        mode = imposeDnd5eDisadvantage(mode)
      }
      const rolls = mode === 'normal' ? [roll.d20] : [roll.d20, roll.d20Second ?? 0]
      const modifier = (input.target.savingThrowBonuses[repeatSave.ability] ?? rules.abilityModifier(input.target.abilities[repeatSave.ability])) +
        resolveDnd5eBlessRoll(input.state, input.target, roll.blessRoll) -
        resolveDnd5eBaneRoll(input.state, input.target, roll.baneRoll)
      const save = resolveSavingThrowWithClassReroll({
        combatant: input.target,
        ability: repeatSave.ability,
        rolls,
        rerollD20: roll.rerollD20,
        rerollD20Second: roll.rerollD20Second,
        bardicInspirationRoll: roll.bardicInspirationRoll,
        darkOnesOwnLuckRoll: roll.darkOnesOwnLuckRoll,
        mode,
        modifier,
        dc: repeatSave.dc,
        events: input.events,
      })
      input.events.push({
        type: 'saving-throw-resolved', targetId: input.target.id, ability: repeatSave.ability,
        d20: save.roll.d20, modifier, total: save.roll.total, dc: repeatSave.dc, success: save.success,
      })
      input.events.push({
        type: 'active-effect-save-resolved', targetId: input.target.id, effectId: effect.id,
        ability: repeatSave.ability, dc: repeatSave.dc, total: save.roll.total, success: save.success,
      })
      if (save.success) {
        const sourceActor = effect.duration.type === 'concentration'
          ? input.state.combatants[effect.duration.sourceActorId]
          : undefined
        const spellId = effect.duration.type === 'concentration'
          ? effect.duration.concentrationId ?? effect.source.rulesId
          : undefined
        if (!sourceActor || !spellId || !endDnd5eSpellEffectOnTarget(input.state, sourceActor, input.target, spellId, input.events)) {
          removeDnd5eEffectsByPredicate(input.target, (current) => current.id === effect.id, 'save-succeeded', input.events)
        }
        continue
      }
      if (failureDamage) {
        const damage = rules.resolveDamage({
          count: failureDamage.count,
          sides: failureDamage.sides,
          bonus: failureDamage.modifier ?? 0,
          rolls: failureDamageRolls,
        })
        const applied = adjustDamageForTarget(input.target, damage.total, failureDamage.type)
        applyDamage(
          input.target,
          applied,
          false,
          input.events,
          source,
          input.state,
          [failureDamage.type],
        )
        input.events.push({
          type: 'delayed-spell-damage-triggered',
          sourceId: source?.id,
          targetId: input.target.id,
          spellId: effect.source.rulesId ?? effect.definitionId,
          amount: applied,
        })
      }
      if (effect.duration.type !== 'rounds') continue
      const remainingRounds = Math.max(0, effect.duration.remainingRounds - 1)
      if (remainingRounds === 0) {
        removeDnd5eEffectsByPredicate(input.target, (current) => current.id === effect.id, 'expired', input.events)
      } else {
        const current = reconciledDnd5eActiveEffects(input.target)
        const boundaryTurnKey = classFeatureTurnKey(input.state, input.target.id)
        commitDnd5eActiveEffects(input.target, current.map((entry) => entry.id === effect.id && entry.duration.type === 'rounds'
          ? { ...entry, duration: { ...entry.duration, remainingRounds, lastTickTurnKey: boundaryTurnKey } }
          : entry))
      }
    }
    return true
  } catch {
    return false
  }
}

function dnd5eSunburstSavingThrowDisadvantage(target: Pick<Dnd5eCombatant, 'creatureType'>): boolean {
  const type = (target.creatureType ?? '').trim().toLowerCase()
  return type === 'undead' || type.includes('亡灵') || type === 'ooze' || type.includes('泥怪')
}

function imposeDnd5eDisadvantage(mode: D20RollMode): D20RollMode {
  return imposeDnd5eRollDisadvantage(mode, 'headless-disadvantage').mode
}

function currentActorId(state: Dnd5eHeadlessCombatState): string | undefined {
  return state.initiativeOrder[state.initiativeIndex]
}

function fail(state: Dnd5eHeadlessCombatState, events: readonly Dnd5eCombatEvent[], reason: Dnd5eActionFailure): Dnd5eActionResult {
  return { ok: false, state, events, reason }
}

function spend(combatant: Dnd5eCombatant, resource: TurnResource, amount = 1): boolean {
  const validation = rules.validateTurnCost(combatant.turn, { resource, amount })
  if (!validation.valid) return false
  combatant.turn = rules.spendTurnCost(combatant.turn, { resource, amount })
  return true
}

function spendReaction(combatant: Dnd5eCombatant, events: Dnd5eCombatEvent[]): boolean {
  if (!spend(combatant, 'reaction')) return false
  if (combatant.classState.hideInPlainSightPrepared) {
    combatant.classState.hideInPlainSightPrepared = undefined
    events.push({
      type: 'class-state-changed', actorId: combatant.id,
      stateKey: 'hide-in-plain-sight', active: false,
    })
  }
  return true
}

function applyUncannyDodge(
  target: Dnd5eCombatant,
  damage: number,
  requested: boolean | undefined,
  events: Dnd5eCombatEvent[],
): number | undefined {
  if (!requested) return damage
  if (!dnd5eCanUseUncannyDodge(target) || !spendReaction(target, events)) return undefined
  events.push({ type: 'turn-resource-spent', actorId: target.id, resource: 'reaction' })
  events.push({ type: 'class-state-changed', actorId: target.id, stateKey: 'uncanny-dodge', active: true })
  return Math.floor(damage / 2)
}

function applyDeflectMissiles(
  state: Dnd5eHeadlessCombatState,
  attacker: Dnd5eCombatant,
  target: Dnd5eCombatant,
  damage: number,
  rangedWeaponAttack: boolean,
  d10: number | undefined,
  damageType: Dnd5eDamageType | undefined,
  events: Dnd5eCombatEvent[],
): number | undefined {
  if (d10 == null) return damage
  if (
    !rangedWeaponAttack || dnd5eCombatantClassLevel(target, 'monk') < 3 || target.currentHp <= 0 ||
    !target.turn.reactionAvailable || dnd5eIsIncapacitated(target) || dnd5eReactionsPrevented(target) ||
    !Number.isInteger(d10) || d10 < 1 || d10 > 10 || !spendReaction(target, events)
  ) return undefined
  const modifier = rules.abilityModifier(target.abilities.dex) + dnd5eCombatantClassLevel(target, 'monk')
  const reduction = Math.max(0, d10 + modifier)
  const damageAfter = Math.max(0, damage - reduction)
  const caught = damageAfter === 0
  target.classState.deflectMissilesCatchSourceId = caught ? attacker.id : undefined
  target.classState.deflectMissilesCatchTurnKey = caught
    ? classFeatureTurnKey(state, currentActorId(state) ?? attacker.id)
    : undefined
  target.classState.deflectMissilesCatchDamageType = caught ? (damageType ?? 'piercing') : undefined
  events.push({ type: 'turn-resource-spent', actorId: target.id, resource: 'reaction' })
  events.push({
    type: 'damage-reduced', targetId: target.id, source: 'deflect-missiles', d10, modifier,
    amount: damage - damageAfter, damageBefore: damage, damageAfter, caught,
  })
  events.push({
    type: 'class-state-changed', actorId: target.id, targetId: attacker.id,
    stateKey: 'deflect-missiles-catch', active: caught,
  })
  return damageAfter
}

function spendProtectionReaction(
  state: Dnd5eHeadlessCombatState,
  attacker: Dnd5eCombatant,
  target: Dnd5eCombatant,
  protectorId: string | undefined,
  events: Dnd5eCombatEvent[],
): boolean {
  if (!protectorId) return true
  const protector = state.combatants[protectorId]
  if (
    !protector || protector.id === attacker.id || protector.id === target.id || protector.currentHp <= 0 ||
    protector.controller !== target.controller || protector.controller === attacker.controller ||
    !protector.hasShield || !protector.classSelections['fighting-style']?.includes('protection') ||
    protector.conditions.some((condition) => ['incapacitated', 'stunned', 'unconscious', '失能', '震慑', '昏迷'].includes(condition)) ||
    dnd5eReactionsPrevented(protector) ||
    !spendReaction(protector, events)
  ) return false
  events.push({ type: 'turn-resource-spent', actorId: protector.id, resource: 'reaction' })
  events.push({ type: 'class-state-changed', actorId: protector.id, stateKey: 'protection', active: true, targetId: target.id })
  return true
}

function consumeCuttingWords(
  state: Dnd5eHeadlessCombatState,
  affectedCreature: Dnd5eCombatant,
  use: Dnd5eCuttingWordsUse | undefined,
  events: Dnd5eCombatEvent[],
): number | undefined {
  if (!use) return 0
  const bard = state.combatants[use.bardId]
  const dieSides = bard ? dnd5eBardicInspirationDie(bard.level) : 0
  const affectedCreatureCannotHear = affectedCreature.conditions.some((condition) => ['deafened', '耳聋'].includes(condition.toLowerCase()))
  const affectedCreatureCharmImmune = affectedCreature.conditionImmunities.some((condition) => ['charmed', '魅惑'].includes(condition.toLowerCase()))
  const bardCannotBeHeard = bard?.conditions.some((condition) => ['silenced', '沉默'].includes(condition.toLowerCase()))
  if (
    !bard || bard.id === affectedCreature.id || dnd5eCombatantClassLevel(bard, 'bard') < 3 || !dnd5eCombatantHasSubclass(bard, 'bard', 'lore') ||
    bard.currentHp <= 0 || dnd5eIsIncapacitated(bard) || dnd5eReactionsPrevented(bard) ||
    affectedCreatureCannotHear || affectedCreatureCharmImmune || bardCannotBeHeard || !Number.isFinite(use.distanceFeet) || use.distanceFeet < 0 || use.distanceFeet > 60 ||
    !Number.isInteger(use.roll) || use.roll < 1 || use.roll > dieSides || !bard.turn.reactionAvailable ||
    (bard.classResources['dnd5e-bardic-inspiration']?.current ?? 0) < 1 || !spendReaction(bard, events)
  ) return undefined
  if (!spendClassResource(bard, 'dnd5e-bardic-inspiration', events)) return undefined
  events.push({ type: 'turn-resource-spent', actorId: bard.id, resource: 'reaction' })
  events.push({
    type: 'class-state-changed', actorId: bard.id, targetId: affectedCreature.id,
    stateKey: 'cutting-words', active: true, value: use.roll,
  })
  return use.roll
}

function applyCuttingWordsToAttack(
  state: Dnd5eHeadlessCombatState,
  attacker: Dnd5eCombatant,
  resolution: AttackResolution,
  use: Dnd5eCuttingWordsUse | undefined,
  events: Dnd5eCombatEvent[],
): AttackResolution | undefined {
  const reduction = consumeCuttingWords(state, attacker, use, events)
  if (reduction == null) return undefined
  const total = resolution.roll.total - reduction
  const hit = !resolution.roll.naturalOne && (resolution.roll.naturalTwenty || total >= resolution.targetAc)
  return { ...resolution, roll: { ...resolution.roll, total }, hit }
}

function spendClassResource(combatant: Dnd5eCombatant, resourceKey: string, events: Dnd5eCombatEvent[], amount = 1): boolean {
  const resource = combatant.classResources[resourceKey]
  if (!Number.isInteger(amount) || amount <= 0 || !resource || resource.current < amount) return false
  resource.current -= amount
  events.push({ type: 'class-resource-spent', actorId: combatant.id, resourceKey, current: resource.current, max: resource.max })
  return true
}

function dnd5eShieldSpellCastingSource(
  combatant: Pick<Dnd5eCombatant, 'classId' | 'classLevels' | 'classSelections' | 'classSelectionsByClass' | 'classResources' | 'classState' | 'currentHp' | 'turn' | 'conditions' | 'level' | 'exhaustionLevel' | 'subclassId'>,
): { level: number; resourceKey?: string } | undefined {
  const sorcererSelections = combatant.classSelectionsByClass?.sorcerer ?? combatant.classSelections
  const wizardSelections = combatant.classSelectionsByClass?.wizard ?? combatant.classSelections
  const selectedNormally = (
    dnd5eCombatantClassLevel(combatant, 'sorcerer') > 0 && sorcererSelections['spell-known']?.includes('shield')
  ) || (
    dnd5eCombatantClassLevel(combatant, 'wizard') > 0 && wizardSelections['spell-prepared']?.includes('shield')
  )
  const selectedBySpellMastery = dnd5eCombatantClassLevel(combatant, 'wizard') >= 18 &&
    wizardSelections['spell-mastery-1']?.includes('shield')
  if (
    combatant.currentHp <= 0 || combatant.classState.shieldSpellActive ||
    (dnd5eCombatantClassLevel(combatant, 'sorcerer') < 1 && dnd5eCombatantClassLevel(combatant, 'wizard') < 1) ||
    (!selectedNormally && !selectedBySpellMastery) ||
    !combatant.turn.reactionAvailable || dnd5eIsIncapacitated(combatant) || dnd5eReactionsPrevented(combatant)
  ) return undefined
  const spell = getDnd5eSrdCombatSpell('shield')
  if (spell && dnd5eFreeSpellCastSource({
    ...combatant,
    classId: 'wizard',
    level: dnd5eCombatantClassLevel(combatant, 'wizard'),
    classSelections: wizardSelections,
  }, spell, 1)?.kind === 'spell-mastery') {
    return { level: 1 }
  }
  for (let level = 1; level <= 9; level += 1) {
    const resourceKey = `dnd5e-spell-slot-${level}`
    if ((combatant.classResources[resourceKey]?.current ?? 0) > 0) return { level, resourceKey }
  }
  return undefined
}

export function dnd5eShieldSpellSlotLevel(
  combatant: Parameters<typeof dnd5eShieldSpellCastingSource>[0],
): number | undefined {
  return dnd5eShieldSpellCastingSource(combatant)?.level
}

export function dnd5eCanCastShieldSpell(
  combatant: Parameters<typeof dnd5eShieldSpellSlotLevel>[0],
): boolean {
  return dnd5eShieldSpellSlotLevel(combatant) != null
}

function dnd5eCounterspellCastingSource(
  combatant: Pick<Dnd5eCombatant, 'classId' | 'classLevels' | 'classSelections' | 'classSelectionsByClass' | 'classResources' | 'currentHp' | 'turn' | 'conditions' | 'level' | 'exhaustionLevel' | 'subclassId' | 'classState'>,
  requestedSlotLevel: number,
): { level: number; resourceKey: string; classId: Extract<Dnd5eClassId, 'sorcerer' | 'warlock' | 'wizard'>; ability: Extract<AbilityKey, 'cha' | 'int'> } | undefined {
  if (!Number.isInteger(requestedSlotLevel) || requestedSlotLevel < 3 || requestedSlotLevel > 9) return undefined
  const selectedClasses = (['wizard', 'sorcerer', 'warlock'] as const).filter((classId) => {
    if (dnd5eCombatantClassLevel(combatant, classId) < 1) return false
    const selections = combatant.classSelectionsByClass?.[classId] ?? combatant.classSelections
    return selections[classId === 'wizard' ? 'spell-prepared' : 'spell-known']?.includes('counterspell')
  })
  const selectedClassId = selectedClasses.find((classId) => classId === combatant.classId) ?? selectedClasses[0]
  if (
    !selectedClassId || combatant.currentHp <= 0 || !combatant.turn.reactionAvailable ||
    dnd5eIsIncapacitated(combatant) || dnd5eReactionsPrevented(combatant)
  ) return undefined
  const warlockLevel = dnd5eCombatantClassLevel(combatant, 'warlock')
  if (warlockLevel > 0) {
    const pactLevel = dnd5ePactSlotLevel(warlockLevel)
    const resource = combatant.classResources['dnd5e-pact-slot']
    if (requestedSlotLevel === pactLevel && (resource?.current ?? 0) > 0) {
      return {
        level: pactLevel,
        resourceKey: 'dnd5e-pact-slot',
        classId: selectedClassId,
        ability: selectedClassId === 'wizard' ? 'int' : 'cha',
      }
    }
  }
  const resourceKey = `dnd5e-spell-slot-${requestedSlotLevel}`
  return (combatant.classResources[resourceKey]?.current ?? 0) > 0
    ? { level: requestedSlotLevel, resourceKey, classId: selectedClassId, ability: selectedClassId === 'wizard' ? 'int' : 'cha' }
    : undefined
}

export function dnd5eCounterspellCastingAbility(
  combatant: Parameters<typeof dnd5eCounterspellCastingSource>[0],
  requestedSlotLevel: number,
): Extract<AbilityKey, 'cha' | 'int'> | undefined {
  return dnd5eCounterspellCastingSource(combatant, requestedSlotLevel)?.ability
}

export function dnd5eCounterspellSlotLevels(
  combatant: Parameters<typeof dnd5eCounterspellCastingSource>[0],
): number[] {
  const levels: number[] = []
  for (let level = 3; level <= 9; level += 1) {
    if (dnd5eCounterspellCastingSource(combatant, level)) levels.push(level)
  }
  return levels
}

function dnd5eHellishRebukeCastingSource(
  combatant: Pick<Dnd5eCombatant, 'classId' | 'classSelections' | 'classResources' | 'currentHp' | 'turn' | 'conditions' | 'level' | 'exhaustionLevel' | 'subclassId' | 'classState'>,
  requestedSlotLevel: number,
): { level: number; resourceKey: string } | undefined {
  if (
    dnd5eCombatantClassLevel(combatant, 'warlock') < 1 ||
    !combatant.classSelections['spell-known']?.includes('hellish-rebuke') ||
    combatant.currentHp <= 0 || !combatant.turn.reactionAvailable ||
    dnd5eIsIncapacitated(combatant) || dnd5eReactionsPrevented(combatant)
  ) return undefined
  const pactLevel = dnd5ePactSlotLevel(dnd5eCombatantClassLevel(combatant, 'warlock'))
  const resource = combatant.classResources['dnd5e-pact-slot']
  return requestedSlotLevel === pactLevel && requestedSlotLevel >= 1 && (resource?.current ?? 0) > 0
    ? { level: pactLevel, resourceKey: 'dnd5e-pact-slot' }
    : undefined
}

export function dnd5eHellishRebukeSlotLevel(
  combatant: Parameters<typeof dnd5eHellishRebukeCastingSource>[0],
): number | undefined {
  const warlockLevel = dnd5eCombatantClassLevel(combatant, 'warlock')
  const pactLevel = warlockLevel > 0 ? dnd5ePactSlotLevel(warlockLevel) : 0
  return dnd5eHellishRebukeCastingSource(combatant, pactLevel)?.level
}

function resolveHellishRebuke(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'hellish-rebuke' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const target = state.combatants[action.targetId]
  const spell = getDnd5eSrdCombatSpell('hellish-rebuke')
  const source = actor ? dnd5eHellishRebukeCastingSource(actor, action.slotLevel) : undefined
  if (
    !actor || !target || target.currentHp <= 0 || target.deathSaves.dead || !spell || !source || actor.controller === target.controller ||
    actor.classState.bonusActionSpellTurnKey === classFeatureTurnKey(state, actor.id) ||
    !Number.isFinite(action.triggerDamageAmount) || action.triggerDamageAmount <= 0 ||
    dnd5eAttackDistanceFeet(state, actor.id, target.id) > spell.rangeFeet ||
    state.lineOfEffectBlockedByCombatantPair?.[dnd5eDirectedCombatantPairKey(actor.id, target.id)]
  ) return fail(state, events, 'invalid-class-feature')
  const mode = dnd5eSavingThrowMode(target, 'dex', {
    effectVisible: true,
    sourceCreatureType: actor.creatureType,
    sourceIsSpell: true,
  })
  try {
    const modifier = (target.savingThrowBonuses.dex ?? rules.abilityModifier(target.abilities.dex)) +
      resolveDnd5eBlessRoll(state, target, action.savingThrowBlessRoll) -
      resolveDnd5eBaneRoll(state, target, action.savingThrowBaneRoll)
    const save = rules.resolveSavingThrow({
      rolls: mode === 'normal'
        ? [action.savingThrowD20]
        : [action.savingThrowD20, action.savingThrowD20Second ?? 0],
      mode,
      modifier,
      dc: 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities.cha),
    })
    const diceCount = dnd5eSpellDiceCount(spell, actor.level, action.slotLevel)
    const rolled = rules.resolveDamage({
      count: diceCount,
      sides: spell.dice.sides,
      bonus: 0,
      rolls: action.effectRolls,
      critical: false,
    })
    if (!spendReaction(actor, events) || !spendClassResource(actor, source.resourceKey, events)) {
      return fail(state, events, 'invalid-class-feature')
    }
    actor.classState.leveledSpellTurnKey = classFeatureTurnKey(state, actor.id)
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'reaction' })
    emitDnd5eSpellCast(state, {
      type: 'spell-cast', actorId: actor.id, targetId: target.id,
      spellId: spell.id, slotLevel: action.slotLevel,
    }, events)
    events.push({
      type: 'saving-throw-resolved', targetId: target.id, ability: 'dex',
      d20: save.roll.d20, modifier, total: save.roll.total,
      dc: 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities.cha), success: save.success,
    })
    const rawDamage = save.success ? Math.floor(rolled.total / 2) : rolled.total
    const damage = adjustDamageForTarget(target, rawDamage, 'fire')
    if (damage > 0) applyDamage(target, damage, false, events, actor, state, ['fire'])
    events.push({
      type: 'hellish-rebuke-resolved', actorId: actor.id, targetId: target.id,
      slotLevel: action.slotLevel,
      dc: 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities.cha),
      saveTotal: save.roll.total, success: save.success, damage,
    })
    return { ok: true, state, events }
  } catch {
    return fail(state, events, 'invalid-dice')
  }
}

function applyCounterspellReaction(input: {
  state: Dnd5eHeadlessCombatState
  caster: Dnd5eCombatant
  spellId: string
  spellLevel: number
  reaction?: Dnd5eCounterspellReaction
  events: Dnd5eCombatEvent[]
}): { requested: boolean; success: boolean } | undefined {
  if (!input.reaction) return { requested: false, success: false }
  const reactor = input.state.combatants[input.reaction.actorId]
  const source = reactor ? dnd5eCounterspellCastingSource(reactor, input.reaction.slotLevel) : undefined
  const distance = reactor ? dnd5eAttackDistanceFeet(input.state, reactor.id, input.caster.id) : Number.POSITIVE_INFINITY
  if (
    !reactor || reactor.controller === input.caster.controller || distance > 60 || !source ||
    !dnd5eCombatantCanSee(input.state, reactor.id, input.caster.id) ||
    reactor.classState.bonusActionSpellTurnKey === classFeatureTurnKey(input.state, reactor.id)
  ) return undefined
  const requiresCheck = source.level < input.spellLevel
  if (requiresCheck && !Number.isInteger(input.reaction.abilityCheckTotal)) return undefined
  if (!requiresCheck && input.reaction.abilityCheckTotal != null) return undefined
  if (!spendReaction(reactor, input.events) || !spendClassResource(reactor, source.resourceKey, input.events)) return undefined
  reactor.classState.leveledSpellTurnKey = classFeatureTurnKey(input.state, reactor.id)
  input.events.push({ type: 'turn-resource-spent', actorId: reactor.id, resource: 'reaction' })
  emitDnd5eSpellCast(input.state, {
    type: 'spell-cast', actorId: reactor.id, targetId: input.caster.id,
    spellId: 'counterspell', slotLevel: source.level,
  }, input.events)
  const dc = requiresCheck ? 10 + input.spellLevel : undefined
  const success = !requiresCheck || input.reaction.abilityCheckTotal! >= dc!
  input.events.push({
    type: 'counterspell-resolved', actorId: reactor.id, casterId: input.caster.id,
    spellId: input.spellId, spellLevel: input.spellLevel, slotLevel: source.level,
    dc, abilityCheckTotal: input.reaction.abilityCheckTotal, success,
  })
  return { requested: true, success }
}

function applyShieldSpellReaction(
  state: Dnd5eHeadlessCombatState,
  target: Dnd5eCombatant,
  requested: boolean | undefined,
  triggeringHit: boolean,
  events: Dnd5eCombatEvent[],
): boolean | undefined {
  if (!requested) return false
  const castingSource = dnd5eShieldSpellCastingSource(target)
  if (
    !triggeringHit || !castingSource ||
    target.classState.bonusActionSpellTurnKey === classFeatureTurnKey(state, target.id) ||
    !spendReaction(target, events)
  ) return undefined
  if (castingSource.resourceKey && !spendClassResource(target, castingSource.resourceKey, events)) return undefined
  target.classState.leveledSpellTurnKey = classFeatureTurnKey(state, target.id)
  target.classState.shieldSpellActive = true
  events.push({ type: 'turn-resource-spent', actorId: target.id, resource: 'reaction' })
  emitDnd5eSpellCast(state, {
    type: 'spell-cast', actorId: target.id, targetId: target.id,
    spellId: 'shield', slotLevel: castingSource.level,
  }, events)
  events.push({ type: 'class-state-changed', actorId: target.id, stateKey: 'shield-spell', active: true, value: castingSource.level })
  return true
}

function restoreClassResource(combatant: Dnd5eCombatant, resourceKey: string, amount: number, events: Dnd5eCombatEvent[]): boolean {
  const resource = combatant.classResources[resourceKey]
  if (!Number.isInteger(amount) || amount <= 0 || !resource || resource.current + amount > resource.max) return false
  resource.current += amount
  events.push({ type: 'class-resource-restored', actorId: combatant.id, resourceKey, current: resource.current, max: resource.max })
  return true
}

export function dnd5eSavingThrowRerollFeature(
  combatant: Pick<Dnd5eCombatant, 'classId' | 'level' | 'classResources'>,
): { resourceKey: string; name: string } | undefined {
  if (dnd5eCombatantClassLevel(combatant, 'fighter') >= 9 && (combatant.classResources.fighterIndomitable?.current ?? 0) > 0) {
    return { resourceKey: 'fighterIndomitable', name: '不屈' }
  }
  if (dnd5eCombatantClassLevel(combatant, 'monk') >= 14 && (combatant.classResources['dnd5e-ki']?.current ?? 0) > 0) {
    return { resourceKey: 'dnd5e-ki', name: '金刚魂' }
  }
  return undefined
}

export function dnd5eDarkOnesOwnLuckAvailable(
  combatant: Pick<Dnd5eCombatant, 'classId' | 'subclassId' | 'level' | 'classResources'>,
): boolean {
  return dnd5eCombatantClassLevel(combatant, 'warlock') >= 6 && dnd5eCombatantHasSubclass(combatant, 'warlock', 'fiend') &&
    (combatant.classResources['dnd5e-dark-ones-own-luck']?.current ?? 0) > 0
}

export function dnd5eHeldBardicInspirationDie(
  combatant: Pick<Dnd5eCombatant, 'classState'>,
): number | undefined {
  const die = combatant.classState.bardicInspirationDie
  const roundsRemaining = combatant.classState.bardicInspirationRoundsRemaining
  if (!Number.isInteger(die) || ![6, 8, 10, 12].includes(die ?? 0)) return undefined
  if (roundsRemaining != null && roundsRemaining <= 0) return undefined
  return die
}

function consumeBardicInspiration(
  combatant: Dnd5eCombatant,
  suppliedRoll: number | undefined,
  events: Dnd5eCombatEvent[],
): number {
  if (suppliedRoll == null) return 0
  const die = dnd5eHeldBardicInspirationDie(combatant)
  if (!die || !Number.isInteger(suppliedRoll) || suppliedRoll < 1 || suppliedRoll > die) {
    throw new RangeError('bardic inspiration roll is unavailable')
  }
  const sourceId = combatant.classState.bardicInspirationSourceId
  combatant.classState = {
    ...combatant.classState,
    bardicInspirationDie: undefined,
    bardicInspirationSourceId: undefined,
    bardicInspirationRoundsRemaining: undefined,
  }
  events.push({
    type: 'class-state-changed',
    actorId: combatant.id,
    targetId: sourceId,
    stateKey: 'bardic-inspiration',
    active: false,
    value: suppliedRoll,
  })
  return suppliedRoll
}

function consumeViciousMockeryAttackDisadvantage(
  combatant: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
): boolean {
  if (!dnd5eHasViciousMockeryAttackDisadvantage(combatant)) return false
  combatant.classState.viciousMockeryAttackDisadvantage = undefined
  events.push({ type: 'class-state-changed', actorId: combatant.id, stateKey: 'vicious-mockery', active: false })
  return true
}

function applyBardicInspirationToAttack(
  combatant: Dnd5eCombatant,
  resolution: AttackResolution,
  suppliedRoll: number | undefined,
  events: Dnd5eCombatEvent[],
): AttackResolution {
  const bonus = consumeBardicInspiration(combatant, suppliedRoll, events)
  if (bonus === 0) return resolution
  const roll = {
    ...resolution.roll,
    modifier: resolution.roll.modifier + bonus,
    total: resolution.roll.total + bonus,
  }
  return {
    ...resolution,
    roll,
    hit: roll.naturalTwenty || (!roll.naturalOne && roll.total >= resolution.targetAc),
  }
}

function applyBardicInspirationToSavingThrow(
  combatant: Dnd5eCombatant,
  resolution: SavingThrowResolution,
  suppliedRoll: number | undefined,
  events: Dnd5eCombatEvent[],
): SavingThrowResolution {
  const bonus = consumeBardicInspiration(combatant, suppliedRoll, events)
  if (bonus === 0) return resolution
  const roll = {
    ...resolution.roll,
    modifier: resolution.roll.modifier + bonus,
    total: resolution.roll.total + bonus,
  }
  return { ...resolution, roll, success: roll.total >= resolution.dc }
}

function applyDarkOnesOwnLuckToSavingThrow(
  combatant: Dnd5eCombatant,
  resolution: SavingThrowResolution,
  suppliedRoll: number | undefined,
  events: Dnd5eCombatEvent[],
): SavingThrowResolution {
  const bonus = consumeDarkOnesOwnLuck(combatant, suppliedRoll, events)
  if (bonus === 0) return resolution
  const roll = {
    ...resolution.roll,
    modifier: resolution.roll.modifier + bonus,
    total: resolution.roll.total + bonus,
  }
  return { ...resolution, roll, success: roll.total >= resolution.dc }
}

function consumeDarkOnesOwnLuck(
  combatant: Dnd5eCombatant,
  suppliedRoll: number | undefined,
  events: Dnd5eCombatEvent[],
): number {
  if (suppliedRoll == null) return 0
  if (
    !Number.isInteger(suppliedRoll) || suppliedRoll < 1 || suppliedRoll > 10 ||
    !dnd5eDarkOnesOwnLuckAvailable(combatant) ||
    !spendClassResource(combatant, 'dnd5e-dark-ones-own-luck', events)
  ) throw new RangeError("Dark One's Own Luck is unavailable")
  events.push({
    type: 'class-state-changed', actorId: combatant.id,
    stateKey: 'dark-ones-own-luck', active: true, value: suppliedRoll,
  })
  return suppliedRoll
}

function consumeDnd5eMonsterMechanicRollModifiers(
  combatant: Dnd5eCombatant,
  roll: 'attack' | 'damage' | 'saving-throw',
  events: Dnd5eCombatEvent[],
): { bonus: number; advantage: boolean; disadvantage: boolean } {
  const all = combatant.classState.monsterMechanicRollModifiers ?? []
  const consumed = all.filter((entry) => entry.roll === roll)
  if (consumed.length === 0) return { bonus: 0, advantage: false, disadvantage: false }
  const remaining = all.filter((entry) => entry.roll !== roll)
  combatant.classState.monsterMechanicRollModifiers = remaining.length > 0 ? remaining : undefined
  for (const modifier of consumed) {
    events.push({
      type: 'class-state-changed',
      actorId: combatant.id,
      stateKey: `monster-mechanic-roll-modifier:${modifier.mechanicId}`,
      active: false,
      value: modifier.mode === 'bonus' ? modifier.bonus ?? 0 : undefined,
    })
  }
  return {
    bonus: consumed.reduce((sum, entry) => sum + (entry.mode === 'bonus' ? entry.bonus ?? 0 : 0), 0),
    advantage: consumed.some((entry) => entry.mode === 'advantage'),
    disadvantage: consumed.some((entry) => entry.mode === 'disadvantage'),
  }
}

const dnd5eResolutionStateByEvents = new WeakMap<Dnd5eCombatEvent[], Dnd5eHeadlessCombatState>()
const dnd5eResolutionActionByEvents = new WeakMap<Dnd5eCombatEvent[], Dnd5eAction>()

function dnd5eSuppliedSecondSavingThrowD20(
  action: Dnd5eAction | undefined,
  targetId: string,
): number | undefined {
  if (!action) return undefined
  const raw = action as unknown as Record<string, unknown>
  for (const key of ['d20Second', 'savingThrowD20Second', 'saveD20Second']) {
    if (Number.isInteger(raw[key])) return Number(raw[key])
  }
  for (const collectionKey of ['targetSavingThrows', 'savingThrows']) {
    const collection = raw[collectionKey]
    if (!Array.isArray(collection)) continue
    const supplied = collection.find((entry) =>
      !!entry && typeof entry === 'object' && (entry as Record<string, unknown>).targetId === targetId,
    ) as Record<string, unknown> | undefined
    if (Number.isInteger(supplied?.d20Second)) return Number(supplied!.d20Second)
  }
  const resolution = raw.resolution
  if (resolution && typeof resolution === 'object') {
    const supplied = (resolution as Record<string, unknown>).targetSavingThrows
    if (Array.isArray(supplied)) {
      const targetRoll = supplied.find((entry) =>
        !!entry && typeof entry === 'object' && (entry as Record<string, unknown>).targetId === targetId,
      ) as Record<string, unknown> | undefined
      if (Number.isInteger(targetRoll?.d20Second)) return Number(targetRoll!.d20Second)
    }
  }
  return undefined
}

function consumeImmediateDnd5eSavingThrowMechanics(
  combatant: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
): { bonus: number; advantage: boolean; disadvantage: boolean } {
  const state = dnd5eResolutionStateByEvents.get(events)
  const action = dnd5eResolutionActionByEvents.get(events)
  if (!state || !action) return { bonus: 0, advantage: false, disadvantage: false }
  const event = dnd5eMonsterMechanicSavingThrowKindForAction(action) === 'magic'
    ? 'saving-throw-magic'
    : 'saving-throw-physical'
  const modifiers: Array<{ mode: 'bonus' | 'advantage' | 'disadvantage'; bonus?: number }> = []
  const owners = Object.values(state.combatants)
    .filter((owner) => owner.statBlockId && owner.currentHp > 0 && !owner.deathSaves.dead)
    .sort((left, right) => left.id.localeCompare(right.id))
  for (const owner of owners) {
    const monster = getDnd5eSrdMonster(owner.statBlockId!)
    if (!monster) continue
    for (const mechanic of dnd5eEligibleMonsterMechanics(monster, event, {
      combatId: state.combatId,
      round: state.round,
      actorId: owner.id,
      currentHp: owner.currentHp,
      maxHp: owner.maxHp,
      usedKeys: owner.classState.declarativeUsedTurnKeys,
    })) {
      if (mechanic.schemaVersion !== 2) continue
      const subjectKind = mechanic.trigger.subject ?? 'self'
      const subjectMatches = subjectKind === 'self'
        ? owner.id === combatant.id
        : subjectKind === 'ally-within'
          ? owner.id !== combatant.id && owner.controller === combatant.controller
          : owner.controller !== combatant.controller
      if (!subjectMatches) continue
      if (
        subjectKind !== 'self' &&
        dnd5eAttackDistanceFeet(state, owner.id, combatant.id) > (mechanic.trigger.radiusFeet ?? 0)
      ) continue
      const effects: Extract<Dnd5eMonsterMechanicEffectV2, { kind: 'roll-modifier' }>[] =
        mechanic.effects.flatMap((effect) =>
          effect.kind === 'roll-modifier' &&
          effect.roll === 'saving-throw' &&
          (effect.target === 'selected-subject' || (effect.target === 'self' && owner.id === combatant.id))
            ? [effect]
            : [],
        )
      if (effects.length !== mechanic.effects.length) continue
      modifiers.push(...effects)
      if (mechanic.limit !== 'unlimited') {
        owner.classState.declarativeUsedTurnKeys = {
          ...owner.classState.declarativeUsedTurnKeys,
          [dnd5eMonsterMechanicLedgerKey(mechanic.id)]: dnd5eMonsterMechanicUsageValue(mechanic, {
            combatId: state.combatId,
            round: state.round,
            actorId: owner.id,
          }),
        }
      }
      events.push({
        type: 'monster-mechanic-v2-triggered',
        actorId: owner.id,
        mechanicId: mechanic.id,
        mechanicName: mechanic.name,
        trigger: event,
        outcomes: effects.map((effect) => ({
          effectId: effect.id,
          kind: effect.kind,
          targetId: combatant.id,
          applied: true,
        })),
      })
    }
  }
  return {
    bonus: modifiers.reduce((sum, modifier) => sum + (modifier.mode === 'bonus' ? modifier.bonus ?? 0 : 0), 0),
    advantage: modifiers.some((modifier) => modifier.mode === 'advantage'),
    disadvantage: modifiers.some((modifier) => modifier.mode === 'disadvantage'),
  }
}

function applyStrokeOfLuckToAttack(
  combatant: Dnd5eCombatant,
  resolution: AttackResolution,
  requested: boolean | undefined,
  events: Dnd5eCombatEvent[],
): AttackResolution {
  if (!requested) return resolution
  const resource = combatant.classResources['dnd5e-stroke-of-luck']
  if (
    resolution.hit || dnd5eCombatantClassLevel(combatant, 'rogue') < 20 ||
    !resource || resource.current < 1 || !spendClassResource(combatant, 'dnd5e-stroke-of-luck', events)
  ) throw new RangeError('Stroke of Luck is unavailable')
  events.push({ type: 'class-state-changed', actorId: combatant.id, stateKey: 'stroke-of-luck', active: true })
  return { ...resolution, hit: true }
}

function resolveSavingThrowWithClassReroll(input: {
  combatant: Dnd5eCombatant
  ability?: AbilityKey
  rolls: readonly number[]
  rerollD20?: number
  rerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  mode: D20RollMode
  modifier: number
  dc: number
  events: Dnd5eCombatEvent[]
  legendaryResistance?: boolean
}) {
  const immediateModifier = consumeImmediateDnd5eSavingThrowMechanics(input.combatant, input.events)
  const mechanicModifier = consumeDnd5eMonsterMechanicRollModifiers(input.combatant, 'saving-throw', input.events)
  const mechanicMode = resolveDnd5eRollMode({
    advantage: [{ active: input.mode === 'advantage' || mechanicModifier.advantage || immediateModifier.advantage, reason: 'monster-mechanic-advantage' }],
    disadvantage: [{ active: input.mode === 'disadvantage' || mechanicModifier.disadvantage || immediateModifier.disadvantage, reason: 'monster-mechanic-disadvantage' }],
  }).mode
  const suppliedSecondD20 = dnd5eSuppliedSecondSavingThrowD20(
    dnd5eResolutionActionByEvents.get(input.events),
    input.combatant.id,
  )
  const mechanicRolls = mechanicMode === 'normal'
    ? [input.rolls[0]]
    : [input.rolls[0], input.rolls[1] ?? suppliedSecondD20 ?? 0]
  const finalize = (resolution: SavingThrowResolution): SavingThrowResolution => {
    if (!input.legendaryResistance) return resolution
    const uses = Math.max(0, Math.floor(input.combatant.classState.legendaryResistanceUses ?? 0))
    if (resolution.success || uses < 1) throw new RangeError('legendary resistance is unavailable')
    input.combatant.classState.legendaryResistanceUses = uses - 1
    input.events.push({ type: 'legendary-resistance-used', targetId: input.combatant.id, remainingUses: uses - 1 })
    return { ...resolution, success: true }
  }
  const automaticFailure = input.ability != null &&
    dnd5eConditionSavingThrowAutomaticallyFails(input.combatant, input.ability)
  const initial = applyBardicInspirationToSavingThrow(
    input.combatant,
    applyDarkOnesOwnLuckToSavingThrow(input.combatant, rules.resolveSavingThrow({
      rolls: mechanicRolls, mode: mechanicMode, modifier: input.modifier + mechanicModifier.bonus + immediateModifier.bonus, dc: input.dc,
    }), input.darkOnesOwnLuckRoll, input.events),
    input.bardicInspirationRoll,
    input.events,
  )
  if (automaticFailure) {
    if (input.rerollD20 != null || input.rerollD20Second != null) {
      throw new RangeError('an automatic failed saving throw cannot be rerolled')
    }
    return finalize({ ...initial, success: false })
  }
  const rerollRequested = input.rerollD20 != null || input.rerollD20Second != null
  if (!rerollRequested) return finalize(initial)
  if (initial.success || input.rerollD20 == null) throw new RangeError('saving throw reroll is not available')
  const feature = dnd5eSavingThrowRerollFeature(input.combatant)
  if (!feature || !spendClassResource(input.combatant, feature.resourceKey, input.events)) {
    throw new RangeError('saving throw reroll resource is unavailable')
  }
  const rerolls = mechanicMode === 'normal'
    ? [input.rerollD20]
    : [input.rerollD20, input.rerollD20Second ?? 0]
  const resolved = rules.resolveSavingThrow({
    rolls: rerolls, mode: mechanicMode, modifier: input.modifier + mechanicModifier.bonus + immediateModifier.bonus, dc: input.dc,
  })
  input.events.push({
    type: 'class-state-changed', actorId: input.combatant.id,
    stateKey: feature.resourceKey === 'fighterIndomitable' ? 'indomitable-reroll' : 'diamond-soul-reroll',
    active: true,
  })
  return finalize(resolved)
}

const DND5E_ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function savingThrowAuraBonuses(combatant: Dnd5eCombatant): Partial<Record<AbilityKey, number>> {
  return Object.fromEntries(DND5E_ABILITY_KEYS.flatMap((ability) => {
    const base = combatant.baseSavingThrowBonuses[ability] ?? rules.abilityModifier(combatant.abilities[ability])
    const current = combatant.savingThrowBonuses[ability] ?? base
    const bonus = current - base
    return bonus !== 0 ? [[ability, bonus]] : []
  }))
}

function savingThrowBonusesWithAura(
  base: Partial<Record<AbilityKey, number>>,
  aura: Partial<Record<AbilityKey, number>>,
): Partial<Record<AbilityKey, number>> {
  const result: Partial<Record<AbilityKey, number>> = {}
  for (const ability of DND5E_ABILITY_KEYS) {
    const value = base[ability]
    if (value != null) result[ability] = value + (aura[ability] ?? 0)
  }
  return result
}

function clearWildShapeClassState(classState: Dnd5eCombatant['classState']): Dnd5eCombatant['classState'] {
  return {
    ...classState,
    wildShapeFormId: undefined,
    wildShapeCurrentHp: undefined,
    wildShapeRoundsRemaining: undefined,
    wildShapeOriginalCurrentHp: undefined,
    wildShapeOriginalMaxHp: undefined,
    wildShapeOriginalArmorClass: undefined,
    wildShapeOriginalSpeed: undefined,
    wildShapeOriginalAbilities: undefined,
    wildShapeOriginalSavingThrowBonuses: undefined,
    wildShapeOriginalStatBlockId: undefined,
    wildShapeOriginalCreatureType: undefined,
    wildShapeOriginalDamageVulnerabilities: undefined,
    wildShapeOriginalDamageResistances: undefined,
    wildShapeOriginalDamageImmunities: undefined,
    wildShapeOriginalConditionImmunities: undefined,
  }
}

function wildShapeAbilities(
  original: Record<AbilityKey, number>,
  monster: Dnd5eMonsterStatBlock,
): Record<AbilityKey, number> {
  return {
    ...original,
    str: monster.abilities.str,
    dex: monster.abilities.dex,
    con: monster.abilities.con,
  }
}

function wildShapeBaseSavingThrowBonuses(
  combatant: Dnd5eCombatant,
  monster: Dnd5eMonsterStatBlock,
  originalAbilities: Record<AbilityKey, number>,
  originalBonuses: Partial<Record<AbilityKey, number>>,
  formAbilities: Record<AbilityKey, number>,
): Partial<Record<AbilityKey, number>> {
  const proficient = new Set(combatant.savingThrowProficiencies)
  return Object.fromEntries(DND5E_ABILITY_KEYS.map((ability) => {
    const originalAbilityModifier = rules.abilityModifier(originalAbilities[ability])
    const originalProficiency = proficient.has(ability) ? combatant.proficiencyBonus : 0
    const additionalBonus = (originalBonuses[ability] ?? originalAbilityModifier + originalProficiency) -
      originalAbilityModifier - originalProficiency
    const retainedBonus = rules.abilityModifier(formAbilities[ability]) + originalProficiency + additionalBonus
    const monsterBonus = monster.savingThrows?.[ability] ?? rules.abilityModifier(formAbilities[ability])
    return [ability, Math.max(retainedBonus, monsterBonus)]
  }))
}

function applyWildShapeFormStats(
  combatant: Dnd5eCombatant,
  monster: Dnd5eMonsterStatBlock,
  currentHp: number,
): void {
  const originalAbilities = combatant.classState.wildShapeOriginalAbilities ?? combatant.abilities
  const originalBonuses = combatant.classState.wildShapeOriginalSavingThrowBonuses ?? combatant.baseSavingThrowBonuses
  const auraBonuses = savingThrowAuraBonuses(combatant)
  const formAbilities = wildShapeAbilities(originalAbilities, monster)
  const formSavingThrowBonuses = wildShapeBaseSavingThrowBonuses(
    combatant,
    monster,
    originalAbilities,
    originalBonuses,
    formAbilities,
  )
  const movementSpent = Math.max(0, dnd5eEffectiveSpeed(combatant) - combatant.turn.movementRemaining)
  const maxHp = Math.max(1, monster.hitPoints.average)
  combatant.abilities = formAbilities
  combatant.baseSavingThrowBonuses = formSavingThrowBonuses
  combatant.savingThrowBonuses = savingThrowBonusesWithAura(formSavingThrowBonuses, auraBonuses)
  combatant.armorClass = monster.armorClass.value
  combatant.currentHp = Math.max(0, Math.min(maxHp, currentHp))
  combatant.maxHp = maxHp
  combatant.speed = monster.speed.walk
  combatant.turn = {
    ...combatant.turn,
    movementRemaining: Math.max(0, monster.speed.walk - movementSpent),
  }
  combatant.statBlockId = monster.id
  combatant.creatureType = monster.creatureType
  combatant.damageVulnerabilities = [...monster.damageVulnerabilities ?? []]
  combatant.damageResistances = [...monster.damageResistances ?? []]
  combatant.damageImmunities = [...monster.damageImmunities ?? []]
  combatant.conditionImmunities = [...monster.conditionImmunities ?? []]
  combatant.classState.wildShapeCurrentHp = combatant.currentHp
}

export function hydrateDnd5eWildShapeCombatant(combatant: Dnd5eCombatant): Dnd5eCombatant {
  const formId = combatant.classState.wildShapeFormId
  if (!formId) return combatant
  const monster = getDnd5eSrdMonster(formId)
  const knownForms = combatant.classSelections[DND5E_WILD_SHAPE_KNOWN_FORMS_KEY] ?? []
  const valid = dnd5eCombatantClassLevel(combatant, 'druid') >= 2 && !!monster &&
    knownForms.includes(formId) && dnd5eWildShapeFormAllowedForLevel(combatant.level, monster) &&
    (combatant.classState.wildShapeRoundsRemaining ?? 0) > 0 &&
    combatant.classState.wildShapeOriginalCurrentHp != null &&
    combatant.classState.wildShapeOriginalMaxHp != null &&
    combatant.classState.wildShapeOriginalArmorClass != null &&
    combatant.classState.wildShapeOriginalSpeed != null &&
    !!combatant.classState.wildShapeOriginalAbilities &&
    !!combatant.classState.wildShapeOriginalSavingThrowBonuses
  if (!valid || !monster) {
    combatant.classState = clearWildShapeClassState(combatant.classState)
    return combatant
  }
  applyWildShapeFormStats(combatant, monster, combatant.classState.wildShapeCurrentHp ?? monster.hitPoints.average)
  return combatant
}

function revertDnd5eWildShape(
  combatant: Dnd5eCombatant,
  excessDamage: number,
  events: Dnd5eCombatEvent[],
): void {
  if (!combatant.classState.wildShapeFormId) return
  const auraBonuses = savingThrowAuraBonuses(combatant)
  const originalAbilities = combatant.classState.wildShapeOriginalAbilities ?? combatant.abilities
  const originalSavingThrowBonuses = combatant.classState.wildShapeOriginalSavingThrowBonuses ?? combatant.baseSavingThrowBonuses
  const originalSpeed = combatant.classState.wildShapeOriginalSpeed ?? combatant.speed
  const movementSpent = Math.max(0, dnd5eEffectiveSpeed(combatant) - combatant.turn.movementRemaining)
  combatant.currentHp = Math.max(0, (combatant.classState.wildShapeOriginalCurrentHp ?? combatant.currentHp) - Math.max(0, excessDamage))
  combatant.maxHp = Math.max(1, combatant.classState.wildShapeOriginalMaxHp ?? combatant.maxHp)
  combatant.armorClass = combatant.classState.wildShapeOriginalArmorClass ?? combatant.armorClass
  combatant.speed = originalSpeed
  combatant.turn = { ...combatant.turn, movementRemaining: Math.max(0, originalSpeed - movementSpent) }
  combatant.abilities = { ...originalAbilities }
  combatant.baseSavingThrowBonuses = { ...originalSavingThrowBonuses }
  combatant.savingThrowBonuses = savingThrowBonusesWithAura(originalSavingThrowBonuses, auraBonuses)
  combatant.statBlockId = combatant.classState.wildShapeOriginalStatBlockId
  combatant.creatureType = combatant.classState.wildShapeOriginalCreatureType
  combatant.damageVulnerabilities = [...combatant.classState.wildShapeOriginalDamageVulnerabilities ?? []]
  combatant.damageResistances = [...combatant.classState.wildShapeOriginalDamageResistances ?? []]
  combatant.damageImmunities = [...combatant.classState.wildShapeOriginalDamageImmunities ?? []]
  combatant.conditionImmunities = [...combatant.classState.wildShapeOriginalConditionImmunities ?? []]
  combatant.classState = clearWildShapeClassState(combatant.classState)
  events.push({ type: 'class-state-changed', actorId: combatant.id, stateKey: 'wild-shape', active: false })
}

function dnd5eUsesDeathSavingThrows(target: Dnd5eCombatant): boolean {
  return target.usesDeathSaves ?? (target.classId != null || target.controller === 'player')
}

function removeZeroHitPointUnconscious(target: Dnd5eCombatant, reason: 'healed' | 'death', events: Dnd5eCombatEvent[]): void {
  const removed = removeDnd5eEffectsByPredicate(
    target,
    (effect) => effect.standardCondition === 'unconscious' && effect.source.rulesId === 'zero-hit-points',
    reason,
    events,
  )
  if (removed.length > 0 && !dnd5eHasStandardCondition(target, 'unconscious')) {
    events.push({ type: 'condition-ended', targetId: target.id, condition: 'unconscious' })
  }
}

function applyZeroHitPointConditions(target: Dnd5eCombatant, events: Dnd5eCombatEvent[]): void {
  applyDnd5eRulesCondition(target, undefined, {
    condition: 'unconscious', rulesId: 'zero-hit-points', sourceKind: 'system',
  }, events)
  applyDnd5eRulesCondition(target, undefined, {
    condition: 'prone', rulesId: 'zero-hit-points', sourceKind: 'system',
  }, events)
}

function applyHealing(target: Dnd5eCombatant, amount: number, events: Dnd5eCombatEvent[]): number {
  const hpBefore = target.currentHp
  const monster = target.statBlockId ? getDnd5eSrdMonster(target.statBlockId) : undefined
  const healingPrevented = target.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:chill-touch:no-healing',
  ) === true || dnd5eMonsterIsSwarm(monster)
  const effectiveAmount = target.deathSaves.dead || healingPrevented ? 0 : Math.max(0, amount)
  target.currentHp = Math.min(target.maxHp, target.currentHp + effectiveAmount)
  if (target.classState.wildShapeFormId) target.classState.wildShapeCurrentHp = target.currentHp
  if (target.currentHp > 0) {
    target.deathSaves = { successes: 0, failures: 0, stable: false, dead: false }
    if (hpBefore === 0) removeZeroHitPointUnconscious(target, 'healed', events)
  }
  const healed = target.currentHp - hpBefore
  if (healed > 0 && (target.classState.caltropsSpeedPenaltyFeet ?? 0) > 0) {
    target.classState.caltropsSpeedPenaltyFeet = undefined
    events.push({ type: 'class-state-changed', actorId: target.id, stateKey: 'caltrops-speed-penalty', active: false })
  }
  events.push({ type: 'healing-applied', targetId: target.id, amount: healed, hpBefore, hpAfter: target.currentHp })
  return healed
}

function applyTemporaryHitPoints(
  target: Dnd5eCombatant,
  amount: number,
  events: Dnd5eCombatEvent[],
  source?: { actorId: string; rulesId: 'heroism' | 'enhance-ability' },
): number {
  const monster = target.statBlockId ? getDnd5eSrdMonster(target.statBlockId) : undefined
  if (dnd5eMonsterIsSwarm(monster)) return 0
  const before = target.temporaryHp
  const offered = Math.max(0, Math.floor(amount))
  target.temporaryHp = Math.max(before, offered)
  const gained = target.temporaryHp - before
  if (gained > 0) {
    target.classState.temporaryHitPointsSource = source ? { ...source } : undefined
    events.push({ type: 'temporary-hit-points-gained', actorId: target.id, amount: gained, current: target.temporaryHp })
  } else if (offered === before && before > 0 && target.classState.temporaryHitPointsSource && !source) {
    // Equal pools are numerically interchangeable. Prefer a newly granted
    // non-Heroism pool so ending concentration cannot remove unrelated THP.
    target.classState.temporaryHitPointsSource = undefined
  }
  return gained
}

function clearTemporaryHitPointsFromRemovedEffects(
  target: Dnd5eCombatant,
  removed: readonly Dnd5eActiveEffectInstance[],
  events: Dnd5eCombatEvent[],
): void {
  const source = target.classState.temporaryHitPointsSource
  if (!source || !removed.some((effect) =>
    effect.definitionId === `srd-5.1:spell:${source.rulesId}` &&
    effect.source.actorId === source.actorId
  )) return
  const amount = target.temporaryHp
  target.temporaryHp = 0
  target.classState.temporaryHitPointsSource = undefined
  if (amount > 0) {
    events.push({
      type: 'class-state-changed', actorId: target.id,
      stateKey: `${source.rulesId}-temporary-hit-points`, active: false, value: amount,
    })
  }
}

function applyDnd5eForcedMovementElevation(
  state: Dnd5eHeadlessCombatState,
  target: Dnd5eCombatant,
  toElevationFeet: number | undefined,
  fallingDamageRolls: readonly number[] | undefined,
  events: Dnd5eCombatEvent[],
): boolean {
  if (toElevationFeet == null) return (fallingDamageRolls?.length ?? 0) === 0
  const fromElevationFeet = target.elevationFeet ?? 0
  if (
    !Number.isFinite(toElevationFeet) || toElevationFeet < -1_000 || toElevationFeet > 10_000 ||
    toElevationFeet > fromElevationFeet
  ) return false
  target.elevationFeet = toElevationFeet
  if (toElevationFeet !== fromElevationFeet) {
    events.push({ type: 'elevation-changed', actorId: target.id, fromElevationFeet, toElevationFeet, mode: 'fall' })
  }
  const fallDistanceFeet = Math.max(0, fromElevationFeet - toElevationFeet)
  if (fallDistanceFeet < 10) return (fallingDamageRolls?.length ?? 0) === 0
  const safeFall = fallDistanceFeet <= dnd5eActiveSafeFallFeet(target.classState.activeEffects) &&
    !dnd5eIsIncapacitated(target)
  if (safeFall) {
    if ((fallingDamageRolls?.length ?? 0) > 0) {
      const supplied = resolveDnd5eFallingDamage(fallDistanceFeet, fallingDamageRolls ?? [])
      if (!supplied.ok) return false
    }
    events.push({
      type: 'falling-damage-resolved', actorId: target.id, distanceFeet: fallDistanceFeet,
      dice: Math.min(20, Math.floor(fallDistanceFeet / 10)), damage: 0, landedProne: false,
    })
    return true
  }
  const falling = resolveDnd5eFallingDamage(fallDistanceFeet, fallingDamageRolls ?? [])
  if (!falling.ok) return false
  const adjustedDamage = adjustDamageForTarget(target, falling.damage, 'bludgeoning')
  applyDamage(target, adjustedDamage, false, events, undefined, state, ['bludgeoning'])
  const landedProne = falling.landsProne && adjustedDamage > 0
  if (landedProne && target.currentHp > 0) {
    applyDnd5eStandardConditionEffect(target, undefined, {
      definitionId: `srd-5.1:falling:prone:${target.id}`,
      rulesId: 'srd-5.1:falling',
      condition: 'prone',
      duration: { type: 'permanent' },
      sourceKind: 'system',
    }, events)
  }
  events.push({
    type: 'falling-damage-resolved', actorId: target.id, distanceFeet: fallDistanceFeet,
    dice: falling.dice, damage: adjustedDamage, landedProne,
  })
  return true
}

function clearTurnUndead(target: Dnd5eCombatant, events: Dnd5eCombatEvent[]): void {
  if (!target.classState.turnedByClericId) return
  target.classState.turnedByClericId = undefined
  target.classState.turnedRoundsRemaining = undefined
  removeDnd5eEffectsByPredicate(
    target,
    (effect) => effect.legacyCondition?.toLowerCase() === 'turned' || effect.definitionId === 'condition:turned',
    'takes-damage',
    events,
  )
  events.push({ type: 'condition-ended', targetId: target.id, condition: 'turned' })
}

function endBarbarianRage(actor: Dnd5eCombatant, events: Dnd5eCombatEvent[]): boolean {
  if (!actor.classState.raging) return false
  const frenzyEnded = actor.classState.frenzying === true
  actor.classState = {
    ...actor.classState,
    raging: undefined,
    rageTurnsRemaining: undefined,
    rageSustainedThisTurn: undefined,
    frenzying: undefined,
    frenzyStartedTurnKey: undefined,
    relentlessRagePendingDc: undefined,
  }
  if (frenzyEnded) {
    actor.exhaustionLevel = Math.min(6, actor.exhaustionLevel + 1)
    events.push({ type: 'exhaustion-gained', actorId: actor.id, level: actor.exhaustionLevel })
  }
  events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'rage', active: false })
  return true
}

function dnd5eUndeadFortitudeRule(target: Dnd5eCombatant) {
  const monster = target.statBlockId ? getDnd5eSrdMonster(target.statBlockId) : undefined
  return monster?.traits.find((trait) => trait.rule?.kind === 'undead-fortitude')?.rule
}

function consumeDnd5eDeathWard(
  target: Dnd5eCombatant,
  trigger: 'damage' | 'instant-death',
  events: Dnd5eCombatEvent[],
): boolean {
  const removed = removeDnd5eEffectsByPredicate(
    target,
    (effect) => effect.definitionId === 'srd-5.1:spell:death-ward',
    'expired',
    events,
  )
  if (removed.length === 0) return false
  events.push({ type: 'death-ward-triggered', targetId: target.id, trigger })
  return true
}

function applyDamage(
  target: Dnd5eCombatant,
  amount: number,
  critical: boolean,
  events: Dnd5eCombatEvent[],
  source?: Dnd5eCombatant,
  state?: Dnd5eHeadlessCombatState,
  damageTypes: readonly Dnd5eDamageType[] = [],
  bypassUndeadFortitude = false,
): void {
  const hpBefore = target.currentHp
  const targetMonster = target.statBlockId ? getDnd5eSrdMonster(target.statBlockId) : undefined
  const regenerationRule = dnd5eMonsterRegenerationRule(targetMonster)
  const suppressingDamageTypes = regenerationRule
    ? damageTypes.filter((type) => regenerationRule.suppressedByDamageTypes.includes(type))
    : []
  if (amount > 0 && suppressingDamageTypes.length > 0) {
    target.classState.monsterRegenerationSuppressedDamageTypes = [...new Set([
      ...(target.classState.monsterRegenerationSuppressedDamageTypes ?? []),
      ...suppressingDamageTypes,
    ])]
  }
  const temporaryHpBefore = target.temporaryHp
  const absorbed = Math.min(target.temporaryHp, amount)
  target.temporaryHp -= absorbed
  if (target.temporaryHp === 0) target.classState.temporaryHitPointsSource = undefined
  const hitPointDamage = amount - absorbed
  let remainingDamageAfterZero = Math.max(0, hitPointDamage - hpBefore)
  if (hpBefore > 0 && hitPointDamage >= hpBefore && consumeDnd5eDeathWard(target, 'damage', events)) {
    target.currentHp = 1
    remainingDamageAfterZero = 0
    if (target.classState.wildShapeFormId) target.classState.wildShapeCurrentHp = 1
  } else if (target.classState.wildShapeFormId && hitPointDamage >= target.currentHp) {
    const excessDamage = Math.max(0, hitPointDamage - target.currentHp)
    const originalHpBefore = Math.max(0, target.classState.wildShapeOriginalCurrentHp ?? 0)
    remainingDamageAfterZero = Math.max(0, excessDamage - originalHpBefore)
    revertDnd5eWildShape(target, excessDamage, events)
  } else {
    target.currentHp = Math.max(0, target.currentHp - hitPointDamage)
    if (target.classState.wildShapeFormId) target.classState.wildShapeCurrentHp = target.currentHp
  }
  if (amount > 0 && target.classState.raging) target.classState.rageSustainedThisTurn = true
  if (amount > 0) clearTurnUndead(target, events)
  if (amount > 0 && source && state) endCharmPersonForHarmfulAction(state, source, target, events)
  if (amount > 0) triggerDnd5eActiveEffectBreak(target, 'takes-damage', events, state)
  if (amount > 0 && target.currentHp > 0 && !target.deathSaves.dead) {
    const damageSaves = reconciledDnd5eActiveEffects(target).filter((effect) => effect.repeatSave?.onDamage)
    if (damageSaves.length > 0) {
      target.classState.activeEffectDamageSavePendingIds = [...new Set([
        ...(target.classState.activeEffectDamageSavePendingIds ?? []),
        ...damageSaves.map((effect) => effect.id),
      ])]
      for (const effect of damageSaves) {
        events.push({
          type: 'active-effect-save-required', targetId: target.id, effectId: effect.id,
          ability: effect.repeatSave!.ability, dc: effect.repeatSave!.dc,
          timing: 'takes-damage', mode: effect.repeatSave!.onDamage!.mode,
        })
      }
    }
  }
  events.push({ type: 'damage-applied', sourceId: source?.id, targetId: target.id, amount, hpBefore, hpAfter: target.currentHp, temporaryHpBefore, temporaryHpAfter: target.temporaryHp })
  const effectiveDamage = absorbed + Math.max(0, hpBefore - target.currentHp)
  if (source && source.id !== target.id && source.controller !== target.controller && target.statBlockId && effectiveDamage > 0) {
    target.classState.monsterThreatByTargetId = {
      ...target.classState.monsterThreatByTargetId,
      [source.id]: Math.min(1_000_000_000, (target.classState.monsterThreatByTargetId?.[source.id] ?? 0) + effectiveDamage),
    }
  }
  const massiveDamage = target.currentHp === 0 && remainingDamageAfterZero >= target.maxHp
  const undeadFortitudeRule = dnd5eUndeadFortitudeRule(target)
  const undeadFortitudeRequired = target.currentHp === 0 && hpBefore > 0 && amount > 0 && !massiveDamage &&
    !bypassUndeadFortitude &&
    undeadFortitudeRule?.kind === 'undead-fortitude' &&
    !(undeadFortitudeRule.excludedOnCritical && critical) &&
    !damageTypes.some((type) => undeadFortitudeRule.excludedDamageTypes.includes(type))
  if (
    source && source.controller !== target.controller && hpBefore > 0 && target.currentHp === 0 &&
    !undeadFortitudeRequired && dnd5eCombatantClassLevel(source, 'warlock') >= 1 && dnd5eCombatantHasSubclass(source, 'warlock', 'fiend')
  ) {
    const granted = Math.max(0, dnd5eCombatantClassLevel(source, 'warlock') + rules.abilityModifier(source.abilities.cha))
    applyTemporaryHitPoints(source, granted, events)
  }
  if (undeadFortitudeRequired) {
    const dc = undeadFortitudeRule.dcBase + amount
    target.classState.undeadFortitudePending = { dc, damage: amount, sourceId: source?.id }
    target.deathSaves = { successes: 0, failures: 0, stable: false, dead: false }
    events.push({ type: 'undead-fortitude-save-required', targetId: target.id, dc, damage: amount })
  }
  const relentlessRage = target.currentHp === 0 && hpBefore > 0 && !massiveDamage && target.classState.raging &&
    dnd5eCombatantClassLevel(target, 'barbarian') >= 11
  if (relentlessRage) {
    const dc = Math.max(10, target.classState.relentlessRageDc ?? 10)
    target.classState.relentlessRagePendingDc = dc
    events.push({ type: 'relentless-rage-save-required', targetId: target.id, dc })
  } else if (target.currentHp === 0) {
    if (state && (target.concentrating || target.classState.concentrationSpellId)) {
      endDnd5eConcentration(state, target, events)
    } else {
      target.concentrating = false
      target.classState.concentrationSpellId = undefined
      target.classState.concentrationSpellLevel = undefined
      target.classState.concentrationTargetIds = undefined
      target.classState.concentrationRoundsRemaining = undefined
      target.classState.huntersMarkTargetId = undefined
    }
    endBarbarianRage(target, events)
    if (massiveDamage) {
      target.classState.undeadFortitudePending = undefined
      target.classState.monsterOnHitSavePending = undefined
      target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
      removeZeroHitPointUnconscious(target, 'death', events)
      events.push({ type: 'instant-death', sourceId: source?.id ?? target.id, targetId: target.id, hpBefore })
    } else if (undeadFortitudeRequired) {
      // 等待权威豁免事务；此时僵尸不能行动，但尚未被判定死亡。
    } else if (hpBefore > 0 && dnd5eUsesDeathSavingThrows(target)) {
      target.deathSaves = { successes: 0, failures: 0, stable: false, dead: false }
      applyZeroHitPointConditions(target, events)
    } else if (!dnd5eUsesDeathSavingThrows(target) && regenerationRule?.diesAtZeroWhenSuppressed) {
      target.classState.undeadFortitudePending = undefined
      target.classState.monsterOnHitSavePending = undefined
      target.classState.monsterRegenerationPendingAtZero = true
      target.deathSaves = { successes: 0, failures: 0, stable: false, dead: false }
    } else if (!dnd5eUsesDeathSavingThrows(target)) {
      target.classState.undeadFortitudePending = undefined
      target.classState.monsterOnHitSavePending = undefined
      target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    }
  }
  if (target.concentrating && amount > 0 && (target.currentHp > 0 || relentlessRage)) {
    events.push({ type: 'concentration-check-required', targetId: target.id, dc: rules.concentrationCheckDc(amount) })
  }
  if (hpBefore === 0 && dnd5eUsesDeathSavingThrows(target) && !massiveDamage && !target.deathSaves.dead) {
    const next = rules.applyDamageAtZeroHp({ ...target.deathSaves, currentHp: 0 }, critical)
    target.deathSaves = { successes: next.successes, failures: next.failures, stable: next.stable, dead: next.dead }
    events.push({ type: 'death-save-failure', targetId: target.id, failures: next.failures })
    if (next.dead) removeZeroHitPointUnconscious(target, 'death', events)
  }
  if (state && target.currentHp === 0 && target.statBlockId === 'srd-5.1:aboleth') {
    endAbolethEnslaveEffects(state, target.id, 'source-incapacitated', events)
  }
}

/**
 * Applies effects such as Quivering Palm that reduce hit points to zero without
 * dealing damage. Temporary hit points do not absorb the reduction and no
 * concentration damage check is generated. Wild Shape loses its form pool and
 * reverts without carrying excess damage into the druid's original pool.
 */
function reduceHitPointsToZero(
  target: Dnd5eCombatant,
  source: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
  state?: Dnd5eHeadlessCombatState,
): void {
  const hpBefore = target.currentHp
  if (target.classState.wildShapeFormId) {
    revertDnd5eWildShape(target, 0, events)
  } else {
    target.currentHp = 0
  }
  events.push({ type: 'hit-points-reduced-to-zero', sourceId: source.id, targetId: target.id, hpBefore })
  if (target.currentHp > 0) return
  const relentlessRage = hpBefore > 0 && target.classState.raging && dnd5eCombatantClassLevel(target, 'barbarian') >= 11
  if (relentlessRage) {
    const dc = Math.max(10, target.classState.relentlessRageDc ?? 10)
    target.classState.relentlessRagePendingDc = dc
    events.push({ type: 'relentless-rage-save-required', targetId: target.id, dc })
  } else {
    if (state && (target.concentrating || target.classState.concentrationSpellId)) {
      endDnd5eConcentration(state, target, events)
    } else {
      target.concentrating = false
      target.classState.concentrationSpellId = undefined
      target.classState.concentrationSpellLevel = undefined
      target.classState.concentrationTargetIds = undefined
      target.classState.concentrationRoundsRemaining = undefined
      target.classState.huntersMarkTargetId = undefined
    }
    endBarbarianRage(target, events)
    if (dnd5eUsesDeathSavingThrows(target)) {
      target.deathSaves = { successes: 0, failures: 0, stable: false, dead: false }
      applyZeroHitPointConditions(target, events)
    } else {
      target.classState.undeadFortitudePending = undefined
      target.classState.monsterOnHitSavePending = undefined
      target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    }
  }
}

export function endDnd5eConcentration(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
): void {
  const previousSpellId = actor.classState.concentrationSpellId
  for (const target of Object.values(state.combatants)) {
    removeDnd5eEffectsByPredicate(
      target,
      (effect) => effect.duration.type === 'concentration' &&
        effect.duration.sourceActorId === actor.id &&
        (!effect.duration.concentrationId || effect.duration.concentrationId === previousSpellId),
      'concentration-ended',
      events,
    )
    const effects = target.classState.concentrationEffectsBySource
    if (!effects?.[actor.id]) continue
    const endedEffect = effects[actor.id]
    if (endedEffect.startsWith('class:draconic-presence:')) {
      const mode = endedEffect.endsWith(':fear') ? 'fear' : 'awe'
      const sameConditionStillApplied = Object.entries(effects).some(([sourceId, effect]) =>
        sourceId !== actor.id && effect === endedEffect,
      )
      if (!sameConditionStillApplied) {
        const standardCondition: Dnd5eStandardConditionId = mode === 'fear' ? 'frightened' : 'charmed'
        const removed = removeDnd5eEffectsByPredicate(
          target,
          (effect) => effect.standardCondition === standardCondition,
          'concentration-ended',
          events,
        )
        const alreadyEnded = events.some((event) => event.type === 'active-effect-removed' &&
          event.targetId === target.id && event.definitionId === `condition:${standardCondition}`)
        if (removed.length === 0 && !alreadyEnded) {
          events.push({ type: 'condition-ended', targetId: target.id, condition: standardCondition })
        }
      }
    }
    const remaining = Object.fromEntries(Object.entries(effects).filter(([sourceId]) => sourceId !== actor.id))
    target.classState.concentrationEffectsBySource = Object.keys(remaining).length > 0 ? remaining : undefined
    events.push({
      type: 'class-state-changed', actorId: actor.id, targetId: target.id,
      stateKey: effects[actor.id], active: false,
    })
  }
  actor.concentrating = false
  actor.classState.concentrationSpellId = undefined
  actor.classState.concentrationSpellLevel = undefined
  actor.classState.concentrationTargetIds = undefined
  actor.classState.concentrationRoundsRemaining = undefined
  actor.classState.huntersMarkTargetId = undefined
  if (previousSpellId) {
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'concentration', active: false })
  }
}

function finalizeDnd5eInstantDeath(
  state: Dnd5eHeadlessCombatState,
  target: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
): boolean {
  if (consumeDnd5eDeathWard(target, 'instant-death', events)) return false
  target.currentHp = 0
  target.temporaryHp = 0
  target.classState.temporaryHitPointsSource = undefined
  target.classState.undeadFortitudePending = undefined
  target.classState.monsterOnHitSavePending = undefined
  target.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
  if (target.concentrating || target.classState.concentrationSpellId) {
    endDnd5eConcentration(state, target, events)
  }
  endBarbarianRage(target, events)
  clearTurnUndead(target, events)
  removeZeroHitPointUnconscious(target, 'death', events)
  return true
}

function endDnd5eSpellEffectOnTarget(
  state: Dnd5eHeadlessCombatState,
  source: Dnd5eCombatant,
  target: Dnd5eCombatant,
  spellId: string,
  events: Dnd5eCombatEvent[],
): boolean {
  const appliedSpellId = target.classState.concentrationEffectsBySource?.[source.id]
  if (
    appliedSpellId !== spellId || !source.concentrating ||
    source.classState.concentrationSpellId !== spellId ||
    !source.classState.concentrationTargetIds?.includes(target.id)
  ) return false

  removeDnd5eEffectsByPredicate(
    target,
    (effect) => effect.duration.type === 'concentration' &&
      effect.duration.sourceActorId === source.id &&
      (!effect.duration.concentrationId || effect.duration.concentrationId === spellId),
    'concentration-ended',
    events,
  )

  const remainingEffects = Object.fromEntries(
    Object.entries(target.classState.concentrationEffectsBySource ?? {})
      .filter(([sourceId]) => sourceId !== source.id),
  )
  target.classState.concentrationEffectsBySource = Object.keys(remainingEffects).length > 0
    ? remainingEffects
    : undefined
  source.classState.concentrationTargetIds = source.classState.concentrationTargetIds
    .filter((targetId) => targetId !== target.id)
  if (source.classState.huntersMarkTargetId === target.id) {
    source.classState.huntersMarkTargetId = undefined
  }
  events.push({
    type: 'class-state-changed', actorId: source.id, targetId: target.id,
    stateKey: spellId, active: false,
  })
  if (source.classState.concentrationTargetIds.length === 0) {
    endDnd5eConcentration(state, source, events)
  }
  return true
}

function beginDnd5eConcentration(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  spellId: string,
  targetIds: readonly string[],
  rounds: number,
  events: Dnd5eCombatEvent[],
  spellLevel?: number,
): void {
  if (actor.concentrating || actor.classState.concentrationSpellId) {
    endDnd5eConcentration(state, actor, events)
  }
  const uniqueTargetIds = [...new Set(targetIds)]
  actor.concentrating = true
  actor.classState.concentrationSpellId = spellId
  actor.classState.concentrationSpellLevel = Number.isInteger(spellLevel) && spellLevel! >= 0 && spellLevel! <= 9
    ? spellLevel
    : undefined
  actor.classState.concentrationTargetIds = uniqueTargetIds
  actor.classState.concentrationRoundsRemaining = Math.max(1, Math.floor(rounds))
  for (const targetId of uniqueTargetIds) {
    const target = state.combatants[targetId]
    if (!target) continue
    target.classState.concentrationEffectsBySource = {
      ...(target.classState.concentrationEffectsBySource ?? {}),
      [actor.id]: spellId,
    }
  }
  events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'concentration', active: true })
}

export function dnd5eCombatantHasConcentrationEffect(
  state: Dnd5eHeadlessCombatState,
  combatantId: string,
  spellId: string,
): boolean {
  const target = state.combatants[combatantId]
  if (!target) return false
  return Object.entries(target.classState.concentrationEffectsBySource ?? {}).some(([sourceId, appliedSpellId]) => {
    const source = state.combatants[sourceId]
    return appliedSpellId === spellId && source?.concentrating === true &&
      source.classState.concentrationSpellId === spellId && source.classState.concentrationTargetIds?.includes(target.id)
  })
}

function resolveDnd5eBlessRoll(
  state: Dnd5eHeadlessCombatState,
  combatant: Dnd5eCombatant,
  suppliedRoll: number | undefined,
): number {
  const blessed = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bless')
  if (!blessed) {
    if (suppliedRoll != null) throw new RangeError('Bless roll supplied without an active Bless effect')
    return 0
  }
  if (!Number.isInteger(suppliedRoll) || suppliedRoll! < 1 || suppliedRoll! > 4) {
    throw new RangeError('Bless requires one d4 roll')
  }
  return suppliedRoll!
}

function resolveDnd5eBaneRoll(
  state: Dnd5eHeadlessCombatState,
  combatant: Dnd5eCombatant,
  suppliedRoll: number | undefined,
): number {
  const baned = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bane')
  if (!baned) {
    if (suppliedRoll != null) throw new RangeError('Bane roll supplied without an active Bane effect')
    return 0
  }
  if (!Number.isInteger(suppliedRoll) || suppliedRoll! < 1 || suppliedRoll! > 4) {
    throw new RangeError('Bane requires one d4 roll')
  }
  return suppliedRoll!
}

function adjustDamageForTarget(target: Dnd5eCombatant, amount: number, type?: Dnd5eDamageType): number {
  if (!type) return amount
  if (target.damageImmunities.includes(type)) return 0
  let adjusted = amount
  const rageResistance = target.classState.raging && (type === 'bludgeoning' || type === 'piercing' || type === 'slashing')
  const emptyBodyResistance = (target.classState.emptyBodyRoundsRemaining ?? 0) > 0 && type !== 'force'
  const fiendishResilience = dnd5eCombatantClassLevel(target, 'warlock') >= 10 && dnd5eCombatantHasSubclass(target, 'warlock', 'fiend') &&
    target.classSelections['fiendish-resilience']?.includes(type)
  const draconicResistance = (target.classState.draconicResistanceRoundsRemaining ?? 0) > 0 &&
    target.classState.draconicResistanceType === type
  const petrifiedResistance = dnd5eHasStandardCondition(target, 'petrified')
  const protectionFromPoison = type === 'poison' && target.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:protection-from-poison'
  ) === true
  const protectionFromEnergy = target.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:protection-from-energy' && effect.modifiers?.damageResistance === type
  ) === true
  if (target.damageResistances.includes(type) || rageResistance || emptyBodyResistance || fiendishResilience || draconicResistance || petrifiedResistance || protectionFromPoison || protectionFromEnergy) {
    adjusted = Math.floor(adjusted / 2)
  }
  if (target.damageVulnerabilities.includes(type)) adjusted *= 2
  return adjusted
}

interface Dnd5eDamageComponent {
  total: number
  type?: Dnd5eDamageType
  source?: Dnd5eClassDamageSource
}

function subtractFromWeaponDamage(
  components: Dnd5eDamageComponent[],
  amount: number,
): number {
  const rawTotal = components.reduce((sum, component) => sum + Math.max(0, component.total), 0)
  let remaining = Math.max(0, rawTotal - Math.max(1, rawTotal - Math.max(0, Math.floor(amount))))
  const reduction = remaining
  for (const component of components) {
    if (remaining <= 0) break
    const reduction = Math.min(component.total, remaining)
    component.total -= reduction
    remaining -= reduction
  }
  return reduction
}

/**
 * Attack-wide reductions happen before resistance, vulnerability, and immunity.
 * Preserve the original damage-type proportions so mixed-damage attacks still
 * apply the target's defenses to the correct component after that reduction.
 */
function scaleDnd5eDamageComponents(
  components: readonly Dnd5eDamageComponent[],
  reducedTotal: number,
): Dnd5eDamageComponent[] {
  const rawTotal = components.reduce((sum, component) => sum + Math.max(0, component.total), 0)
  const targetTotal = Math.min(rawTotal, Math.max(0, Math.floor(reducedTotal)))
  if (rawTotal <= 0 || targetTotal <= 0) return components.map((component) => ({ ...component, total: 0 }))
  if (targetTotal === rawTotal) return components.map((component) => ({ ...component }))

  const scaled = components.map((component, index) => {
    const exact = Math.max(0, component.total) * targetTotal / rawTotal
    return { component, index, total: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remainder = targetTotal - scaled.reduce((sum, entry) => sum + entry.total, 0)
  for (const entry of [...scaled].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (remainder <= 0) break
    entry.total += 1
    remainder -= 1
  }
  return scaled.sort((a, b) => a.index - b.index).map(({ component, total }) => ({ ...component, total }))
}

function adjustDnd5eDamageComponents(
  target: Dnd5eCombatant,
  components: readonly Dnd5eDamageComponent[],
): Dnd5eDamageComponent[] {
  return components.map((component) => ({
    ...component,
    total: adjustDamageForTarget(target, component.total, component.type),
  }))
}

function classFeatureTurnKey(state: Dnd5eHeadlessCombatState, actorId: string): string {
  return `${state.combatId}:${state.round}:${state.turnSlotId ?? actorId}`
}

function dnd5eCombatantIsBanished(combatant: Pick<Dnd5eCombatant, 'classState' | 'conditions'>): boolean {
  return !!combatant.classState.hurlThroughHellSourceId || combatant.conditions.some((condition) =>
    ['banished', '放逐'].includes(condition.trim().toLowerCase())
  )
}

function triggerHurlThroughHell(input: {
  state: Dnd5eHeadlessCombatState
  actor: Dnd5eCombatant
  target: Dnd5eCombatant
  damageRolls?: readonly number[]
  events: Dnd5eCombatEvent[]
}): void {
  const { state, actor, target, damageRolls, events } = input
  if (!actor.classState.hurlThroughHellReady) {
    if ((damageRolls?.length ?? 0) > 0) throw new RangeError('Hurl Through Hell is not readied')
    return
  }
  const resource = actor.classResources['dnd5e-hurl-through-hell']
  if (
    dnd5eCombatantClassLevel(actor, 'warlock') < 14 || !dnd5eCombatantHasSubclass(actor, 'warlock', 'fiend') ||
    !resource || resource.current < 1 || dnd5eCombatantIsBanished(target) || !damageRolls
  ) throw new RangeError('Hurl Through Hell is unavailable')
  const damage = rules.resolveDamage({ count: 10, sides: 10, bonus: 0, rolls: damageRolls })
  if (!spendClassResource(actor, 'dnd5e-hurl-through-hell', events)) {
    throw new RangeError('Hurl Through Hell resource is unavailable')
  }
  actor.classState.hurlThroughHellReady = undefined
  target.classState.hurlThroughHellSourceId = actor.id
  target.classState.hurlThroughHellDamage = damage.total
  target.classState.hurlThroughHellAppliedTurnKey = classFeatureTurnKey(state, actor.id)
  applyDnd5eRulesCondition(target, actor, {
    condition: 'banished',
    rulesId: 'hurl-through-hell',
    duration: {
      type: 'until-turn-boundary', boundary: 'source-turn-end',
      appliedTurnKey: target.classState.hurlThroughHellAppliedTurnKey,
    },
    appliedTurnKey: target.classState.hurlThroughHellAppliedTurnKey,
    sourceKind: 'feature',
  }, events)
  events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hurl-through-hell-ready', active: false })
  events.push({
    type: 'class-state-changed', actorId: actor.id, targetId: target.id,
    stateKey: 'hurl-through-hell', active: true, value: damage.total,
  })
  events.push({ type: 'condition-applied', actorId: actor.id, targetId: target.id, condition: 'banished' })
}

export interface Dnd5eTranquilityWardCheck {
  source: 'tranquility' | 'nature-sanctuary' | 'sanctuary'
  saveDc: number
  saveModifier: number
  saveMode: D20RollMode
  blessed: boolean
  baned: boolean
}

function dnd5eNatureSanctuaryAttackerEligible(attacker: Dnd5eCombatant): boolean {
  const creatureType = (attacker.creatureType ?? '').trim().toLowerCase()
  return creatureType === 'beast' || creatureType.includes('野兽') ||
    creatureType === 'plant' || creatureType.includes('植物')
}

/** Returns the SRD targeting save imposed by Tranquility or Nature's Sanctuary. */
export function dnd5eTranquilityWardCheck(
  attacker: Dnd5eCombatant,
  target: Dnd5eCombatant,
  state?: Dnd5eHeadlessCombatState,
  includeNatureSanctuary = true,
): Dnd5eTranquilityWardCheck | undefined {
  const sanctuary = reconciledDnd5eActiveEffects(target).find((effect) =>
    effect.definitionId === 'srd-5.1:spell:sanctuary' &&
    effect.source.rulesId === 'sanctuary' &&
    Number.isInteger(effect.potency) &&
    (effect.potency ?? 0) > 0,
  )
  const natureSanctuary = includeNatureSanctuary &&
    dnd5eCombatantClassLevel(target, 'druid') >= 14 && dnd5eCombatantHasSubclass(target, 'druid', 'land') &&
    dnd5eNatureSanctuaryAttackerEligible(attacker) &&
    (attacker.classState.natureSanctuaryImmunityRoundsByTarget?.[target.id] ?? 0) <= 0
  const source = sanctuary
    ? 'sanctuary' as const
    : target.classState.tranquilityActive
      ? 'tranquility' as const
      : natureSanctuary
        ? 'nature-sanctuary' as const
        : undefined
  if (!source) return undefined
  return {
    source,
    saveDc: source === 'sanctuary'
      ? sanctuary!.potency!
      : 8 + target.proficiencyBonus + rules.abilityModifier(target.abilities.wis),
    saveModifier: attacker.savingThrowBonuses.wis ?? rules.abilityModifier(attacker.abilities.wis),
    saveMode: dnd5eSavingThrowMode(attacker, 'wis', { effectVisible: true }),
    blessed: state ? dnd5eCombatantHasConcentrationEffect(state, attacker.id, 'bless') : false,
    baned: state ? dnd5eCombatantHasConcentrationEffect(state, attacker.id, 'bane') : false,
  }
}

function endTranquilityForHostileAction(
  actor: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
  reason: 'makes-attack' | 'casts-spell',
): void {
  if (actor.classState.tranquilityActive) {
    actor.classState.tranquilityActive = undefined
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'tranquility', active: false })
  }
  const removed = removeDnd5eEffectsByPredicate(
    actor,
    (effect) =>
      effect.definitionId === 'srd-5.1:spell:sanctuary' &&
      effect.source.rulesId === 'sanctuary',
    reason,
    events,
  )
  if (removed.length > 0) {
    events.push({
      type: 'class-state-changed',
      actorId: actor.id,
      targetId: actor.id,
      stateKey: 'sanctuary',
      active: false,
    })
  }
}

function passesTranquilityWard(
  state: Dnd5eHeadlessCombatState,
  attacker: Dnd5eCombatant,
  target: Dnd5eCombatant,
  supplied: Dnd5eTranquilitySaveRoll | undefined,
  events: Dnd5eCombatEvent[],
  includeNatureSanctuary = true,
): boolean {
  const check = dnd5eTranquilityWardCheck(attacker, target, state, includeNatureSanctuary)
  if (!check) return true
  const rolls = check.saveMode === 'normal'
    ? [supplied?.d20 ?? 0]
    : [supplied?.d20 ?? 0, supplied?.d20Second ?? 0]
  const save = resolveSavingThrowWithClassReroll({
    combatant: attacker,
    ability: 'wis',
    rolls,
    rerollD20: supplied?.rerollD20,
    rerollD20Second: supplied?.rerollD20Second,
    bardicInspirationRoll: supplied?.bardicInspirationRoll,
    darkOnesOwnLuckRoll: supplied?.darkOnesOwnLuckRoll,
    mode: check.saveMode,
    modifier: check.saveModifier + resolveDnd5eBlessRoll(state, attacker, supplied?.blessRoll) -
      resolveDnd5eBaneRoll(state, attacker, supplied?.baneRoll),
    dc: check.saveDc,
    events,
  })
  events.push({
    type: 'saving-throw-resolved', targetId: attacker.id, ability: 'wis', d20: save.roll.d20,
    modifier: check.saveModifier + (supplied?.blessRoll ?? 0) - (supplied?.baneRoll ?? 0),
    total: save.roll.total, dc: check.saveDc, success: save.success,
  })
  if (save.success && check.source === 'nature-sanctuary') {
    attacker.classState.natureSanctuaryImmunityRoundsByTarget = {
      ...attacker.classState.natureSanctuaryImmunityRoundsByTarget,
      [target.id]: 14_400,
    }
    events.push({
      type: 'class-state-changed', actorId: attacker.id, targetId: target.id,
      stateKey: 'nature-sanctuary-immunity', active: true, value: 14_400,
    })
  } else if (!save.success) {
    events.push({ type: 'hostile-targeting-prevented', actorId: attacker.id, targetId: target.id, source: check.source })
  }
  return save.success
}

function rogueCheckProficiencyRank(actor: Dnd5eCombatant, skill: 'sleightOfHand' | 'stealth' | 'thievesTools'): 0 | 1 | 2 {
  const expertise = actor.classSelections.expertise?.includes(skill) === true
  if (expertise) return 2
  if (skill === 'thievesTools' || actor.skillProficiencies.includes(skill)) return 1
  return 0
}

function abilityCheckProficiencyRank(actor: Dnd5eCombatant, skill: string | undefined): 0 | 1 | 2 {
  if (!skill) return 0
  if (actor.classSelections.expertise?.includes(skill)) return 2
  const beguilingInfluence = dnd5eCombatantClassLevel(actor, 'warlock') > 0 &&
    actor.classSelections['eldritch-invocations']?.includes('beguiling-influence') &&
    (skill === 'deception' || skill === 'persuasion')
  if (actor.skillProficiencies.includes(skill) || actor.classSelections['lore-bonus-skills']?.includes(skill) || beguilingInfluence) return 1
  return 0
}

export function dnd5eBestGrappleDefense(target: Dnd5eCombatant): {
  skill: 'athletics' | 'acrobatics'
  modifier: number
} {
  const athletics = rules.abilityModifier(target.abilities.str) +
    target.proficiencyBonus * abilityCheckProficiencyRank(target, 'athletics')
  const acrobatics = rules.abilityModifier(target.abilities.dex) +
    target.proficiencyBonus * abilityCheckProficiencyRank(target, 'acrobatics')
  const abilityAdvantages = dnd5eActiveAbilityCheckAdvantages(target.classState.activeEffects)
  const athleticsAdvantage = abilityAdvantages.includes('str')
  const acrobaticsAdvantage = abilityAdvantages.includes('dex')
  if (athleticsAdvantage !== acrobaticsAdvantage) {
    return acrobaticsAdvantage
      ? { skill: 'acrobatics', modifier: acrobatics }
      : { skill: 'athletics', modifier: athletics }
  }
  return acrobatics > athletics
    ? { skill: 'acrobatics', modifier: acrobatics }
    : { skill: 'athletics', modifier: athletics }
}

function unproficientAbilityCheckBonus(actor: Dnd5eCombatant, ability: AbilityKey): number {
  if (dnd5eCombatantClassLevel(actor, 'bard') >= 2) return Math.floor(actor.proficiencyBonus / 2)
  if (
    dnd5eCombatantClassLevel(actor, 'fighter') >= 7 && dnd5eCombatantHasSubclass(actor, 'fighter', 'champion') &&
    (ability === 'str' || ability === 'dex' || ability === 'con')
  ) return Math.ceil(actor.proficiencyBonus / 2)
  return 0
}

function resolveGeneralAbilityCheck(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  action: Extract<Dnd5eAction, { type: 'ability-check' }>,
  events: Dnd5eCombatEvent[],
): true | undefined {
  const skill = action.skill ? SKILLS.find((candidate) => candidate.key === action.skill) : undefined
  if (action.skill && (!skill || skill.ability !== action.ability)) return undefined
  if (action.dc != null && (!Number.isInteger(action.dc) || action.dc < 0 || action.dc > 100)) return undefined
  if (action.spendAction && !spend(actor, 'action')) return undefined
  if (action.spendAction) events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })

  const requestedMode = action.mode ?? 'normal'
  const rageStrengthAdvantage = dnd5eCombatantClassLevel(actor, 'barbarian') >= 1 &&
    actor.classState.raging === true && action.ability === 'str'
  const helped = actor.classState.helpedAbilityCheckSourceId != null
  const enhancedAbilityAdvantage = dnd5eActiveAbilityCheckAdvantages(
    actor.classState.activeEffects,
  ).includes(action.ability)
  const advantage = requestedMode === 'advantage' || rageStrengthAdvantage || helped ||
    enhancedAbilityAdvantage
  const disadvantage = requestedMode === 'disadvantage' || actor.exhaustionLevel >= 1 ||
    dnd5eConditionAbilityCheckDisadvantage(actor) ||
    (actor.wearingUnproficientArmor && (action.ability === 'str' || action.ability === 'dex')) ||
    (actor.armorStealthDisadvantage && action.skill === 'stealth')
  const mode = resolveDnd5eRollMode({
    advantage: [{ active: advantage, reason: 'ability-check-advantage' }],
    disadvantage: [{ active: disadvantage, reason: 'ability-check-disadvantage' }],
  }).mode
  const suppliedRolls = mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? action.d20]
  const rank = abilityCheckProficiencyRank(actor, action.skill)
  const reliableTalent = dnd5eCombatantClassLevel(actor, 'rogue') >= 11 && rank > 0
  const rolls = reliableTalent ? suppliedRolls.map((roll) => Math.max(10, roll)) : suppliedRolls
  const hideInPlainSightApplied = action.skill === 'stealth' && actor.classState.hideInPlainSightPrepared === true
  const modifier = rules.abilityModifier(actor.abilities[action.ability]) +
    (rank > 0 ? actor.proficiencyBonus * rank : unproficientAbilityCheckBonus(actor, action.ability)) +
    (hideInPlainSightApplied ? 10 : 0)
  let roll = rules.resolveD20({ rolls, mode, modifier })
  let bardicInspirationApplied: number | undefined
  let peerlessSkillApplied: number | undefined
  let darkOnesOwnLuckApplied: number | undefined
  let cuttingWordsApplied: number | undefined

  if (action.bardicInspirationRoll != null) {
    try {
      bardicInspirationApplied = consumeBardicInspiration(actor, action.bardicInspirationRoll, events)
    } catch {
      return undefined
    }
    roll = { ...roll, modifier: roll.modifier + bardicInspirationApplied, total: roll.total + bardicInspirationApplied }
  }
  if (action.peerlessSkillRoll != null) {
    const dieSides = dnd5eBardicInspirationDie(dnd5eCombatantClassLevel(actor, 'bard'))
    if (
      dnd5eCombatantClassLevel(actor, 'bard') < 14 || !dnd5eCombatantHasSubclass(actor, 'bard', 'lore') ||
      !Number.isInteger(action.peerlessSkillRoll) || action.peerlessSkillRoll < 1 || action.peerlessSkillRoll > dieSides ||
      !spendClassResource(actor, 'dnd5e-bardic-inspiration', events)
    ) return undefined
    peerlessSkillApplied = action.peerlessSkillRoll
    roll = { ...roll, modifier: roll.modifier + peerlessSkillApplied, total: roll.total + peerlessSkillApplied }
    events.push({
      type: 'class-state-changed', actorId: actor.id,
      stateKey: 'peerless-skill', active: true, value: peerlessSkillApplied,
    })
  }
  if (action.darkOnesOwnLuckRoll != null) {
    try {
      darkOnesOwnLuckApplied = consumeDarkOnesOwnLuck(actor, action.darkOnesOwnLuckRoll, events)
    } catch {
      return undefined
    }
    roll = { ...roll, modifier: roll.modifier + darkOnesOwnLuckApplied, total: roll.total + darkOnesOwnLuckApplied }
  }
  if (action.cuttingWords) {
    cuttingWordsApplied = consumeCuttingWords(state, actor, action.cuttingWords, events)
    if (cuttingWordsApplied == null) return undefined
    roll = { ...roll, modifier: roll.modifier - cuttingWordsApplied, total: roll.total - cuttingWordsApplied }
  }

  let strokeOfLuckApplied = false
  if (action.strokeOfLuck) {
    const resource = actor.classResources['dnd5e-stroke-of-luck']
    if (
      dnd5eCombatantClassLevel(actor, 'rogue') < 20 || action.dc == null || roll.total >= action.dc ||
      !resource || resource.current < 1 || !spendClassResource(actor, 'dnd5e-stroke-of-luck', events)
    ) return undefined
    roll = rules.resolveD20({ rolls: [20], mode: 'normal', modifier: roll.modifier })
    strokeOfLuckApplied = true
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'stroke-of-luck', active: true })
  }

  const indomitableMightApplied = dnd5eCombatantClassLevel(actor, 'barbarian') >= 18 && action.ability === 'str' &&
    roll.total < actor.abilities.str
  if (indomitableMightApplied) roll = { ...roll, total: actor.abilities.str }
  const success = action.dc == null ? undefined : roll.total >= action.dc
  events.push({
    type: 'ability-check-resolved', actorId: actor.id, ability: action.ability, skill: action.skill,
    d20: roll.d20, modifier, total: roll.total, mode,
    reliableTalentApplied: reliableTalent && suppliedRolls.some((value) => value < 10),
    indomitableMightApplied,
    bardicInspirationApplied,
    peerlessSkillApplied,
    darkOnesOwnLuckApplied,
    cuttingWordsApplied,
    strokeOfLuckApplied,
    dc: action.dc,
    success,
  })
  if (hideInPlainSightApplied) {
    actor.classState.hideInPlainSightPrepared = undefined
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hide-in-plain-sight', active: false })
  }
  if (helped) {
    const sourceId = actor.classState.helpedAbilityCheckSourceId!
    actor.classState.helpedAbilityCheckSourceId = undefined
    actor.classState.helpedAbilityCheckSourceTurnKey = undefined
    events.push({ type: 'class-state-changed', actorId: sourceId, targetId: actor.id, stateKey: 'help-ability-check', active: false })
  }
  return true
}

function resolveRogueDexterityCheck(input: {
  actor: Dnd5eCombatant
  skill: 'sleightOfHand' | 'stealth' | 'thievesTools'
  d20?: number
  d20Second?: number
  advantage?: boolean
  events: Dnd5eCombatEvent[]
  dc?: number
}) {
  const rank = rogueCheckProficiencyRank(input.actor, input.skill)
  const advantage = input.advantage === true
  const disadvantage = input.actor.exhaustionLevel >= 1 ||
    dnd5eConditionAbilityCheckDisadvantage(input.actor) ||
    input.actor.wearingUnproficientArmor ||
    (input.actor.armorStealthDisadvantage && input.skill === 'stealth')
  const mode = resolveDnd5eRollMode({
    advantage: [{ active: advantage, reason: 'rogue-check-advantage' }],
    disadvantage: [{ active: disadvantage, reason: 'rogue-check-disadvantage' }],
  }).mode
  const supplied = mode === 'normal'
    ? [input.d20 ?? 0]
    : [input.d20 ?? 0, input.d20Second ?? 0]
  const reliableTalent = dnd5eCombatantClassLevel(input.actor, 'rogue') >= 11 && rank > 0
  const rolls = reliableTalent ? supplied.map((roll) => Math.max(10, roll)) : supplied
  const hideInPlainSightApplied = input.skill === 'stealth' && input.actor.classState.hideInPlainSightPrepared === true
  const modifier = rules.abilityModifier(input.actor.abilities.dex) + input.actor.proficiencyBonus * rank +
    (hideInPlainSightApplied ? 10 : 0)
  const roll = rules.resolveD20({ rolls, mode, modifier })
  const success = input.dc == null ? undefined : roll.total >= input.dc
  input.events.push({
    type: 'ability-check-resolved', actorId: input.actor.id, ability: 'dex', skill: input.skill,
    d20: roll.d20, modifier, total: roll.total, mode,
    reliableTalentApplied: reliableTalent && supplied.some((value) => value < 10),
    dc: input.dc, success,
  })
  if (hideInPlainSightApplied) {
    input.actor.classState.hideInPlainSightPrepared = undefined
    input.events.push({ type: 'class-state-changed', actorId: input.actor.id, stateKey: 'hide-in-plain-sight', active: false })
  }
  return { roll, success }
}

export function dnd5eIsFavoredEnemy(
  ranger: Pick<Dnd5eCombatant, 'classId' | 'level' | 'classLevels' | 'classSelections'>,
  target: Pick<Dnd5eCombatant, 'creatureType'>,
): boolean {
  if (dnd5eCombatantClassLevel(ranger, 'ranger') < 1) return false
  const creatureType = (target.creatureType ?? '').toLowerCase()
  const selected = ranger.classSelections['favored-enemy'] ?? []
  const aliases: Record<string, readonly string[]> = {
    'favored-天界生物': ['天界生物', '天界', 'celestial'],
    'favored-构装生物': ['构装生物', '构装', 'construct'],
    'favored-龙类': ['龙类', '龙', 'dragon'],
    'favored-元素生物': ['元素生物', '元素', 'elemental'],
    'favored-精类': ['精类', '精怪', 'fey'],
    'favored-怪兽': ['怪兽', 'monstrosity'],
    'favored-两种类人生物种族': ['类人生物', 'humanoid'],
  }
  return selected.some((choice) => {
    const values = aliases[choice] ?? [choice.replace(/^favored-/, '')]
    return values.some((value) => creatureType === value.toLowerCase())
  })
}

function foeSlayerBonus(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  target: Dnd5eCombatant,
): number {
  if (
    dnd5eCombatantClassLevel(actor, 'ranger') < 20 || !dnd5eIsFavoredEnemy(actor, target) ||
    actor.classState.foeSlayerTurnKey === classFeatureTurnKey(state, actor.id)
  ) return 0
  return Math.max(0, rules.abilityModifier(actor.abilities.wis))
}

export function dnd5eTargetArmorClassForAttack(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  targetId: string,
): number {
  const actor = state.combatants[actorId]
  const target = state.combatants[targetId]
  if (!actor || !target) return 0
  const multiattackDefense = dnd5eCombatantClassLevel(target, 'ranger') >= 7 && dnd5eCombatantHasSubclass(target, 'ranger', 'hunter') &&
    target.classSelections['defensive-tactics']?.includes('multiattack-defense') &&
    target.classState.multiattackDefenseAttackerId === actor.id &&
    target.classState.multiattackDefenseTurnKey === classFeatureTurnKey(state, actor.id)
  const shieldOfFaith = Object.entries(target.classState.concentrationEffectsBySource ?? {}).some(([sourceId, spellId]) => {
    const source = state.combatants[sourceId]
    return spellId === 'shield-of-faith' && source?.concentrating === true &&
      source.classState.concentrationSpellId === spellId && source.classState.concentrationTargetIds?.includes(target.id)
  })
  const pairKey = dnd5eDirectedCombatantPairKey(actorId, targetId)
  if (state.lineOfEffectBlockedByCombatantPair?.[pairKey]) return DND5E_TOTAL_COVER_ARMOR_CLASS
  const coverBonus = state.coverBonusByCombatantPair?.[pairKey] ?? 0
  const barkskin = target.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:barkskin'
  ) === true
  const mageArmor = !target.wearingArmor && target.classState.activeEffects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:mage-armor'
  ) === true
  const mageArmorClass = 13 + rules.abilityModifier(target.abilities.dex) + (target.hasShield ? 2 : 0)
  const baseArmorClass = Math.max(
    target.armorClass,
    barkskin ? 16 : 0,
    mageArmor ? mageArmorClass : 0,
  )
  return baseArmorClass + (multiattackDefense ? 4 : 0) + (shieldOfFaith ? 2 : 0) +
    (target.classState.shieldSpellActive ? 5 : 0) + coverBonus
}

export function dnd5eRepeatedMeleeAttackMode(
  state: Dnd5eHeadlessCombatState,
  attackerId: string,
  targetId: string,
  requestedMode: D20RollMode = 'normal',
): D20RollMode {
  const attacker = state.combatants[attackerId]
  const target = state.combatants[targetId]
  if (!attacker || !target) return requestedMode
  const targetProne = target.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const attackerProne = attacker.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const hasAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
    (dnd5eTargetGrantsAttackAdvantage(target) || requestedMode === 'advantage' || !!target.classState.recklessAttackTurnKey ||
      !!target.classState.stunnedByActorId || targetProne || dnd5eAttackerIsUnseenForAttack(state, attacker.id, target.id) ||
      dnd5eHelpAttackApplies(state, attacker, target))
  const hasDisadvantage = requestedMode === 'disadvantage' || attackerProne || dnd5eFrightenedAttackDisadvantage(state, attacker) ||
    dnd5eTargetIsDodging(target) || dnd5eBlurImposesAttackDisadvantage(state, attacker.id, target.id) ||
    dnd5eTargetIsUnseenForAttack(state, attacker.id, target.id)
  return resolveDnd5eRollMode({
    advantage: [{ active: hasAdvantage, reason: 'melee-attack-advantage' }],
    disadvantage: [{ active: hasDisadvantage, reason: 'melee-attack-disadvantage' }],
  }).mode
}

function recordHunterMultiattackDefenseHit(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  target: Dnd5eCombatant,
): void {
  if (
    dnd5eCombatantClassLevel(target, 'ranger') < 7 || !dnd5eCombatantHasSubclass(target, 'ranger', 'hunter') ||
    !target.classSelections['defensive-tactics']?.includes('multiattack-defense')
  ) return
  target.classState.multiattackDefenseAttackerId = actor.id
  target.classState.multiattackDefenseTurnKey = classFeatureTurnKey(state, actor.id)
}

export function dnd5eWeaponClassDamageDefinitions(input: {
  state: Dnd5eHeadlessCombatState
  actorId: string
  targetId: string
  context?: Dnd5eWeaponClassDamageContext
  effectiveMode?: D20RollMode
  critical: boolean
}): readonly Dnd5eClassDamageDefinition[] {
  const actor = input.state.combatants[input.actorId]
  const target = input.state.combatants[input.targetId]
  const context = input.context
  if (!actor || !target || !context) return []
  const turnKey = classFeatureTurnKey(input.state, actor.id)
  const definitions: Dnd5eClassDamageDefinition[] = []
  const barbarianLevel = dnd5eCombatantClassLevel(actor, 'barbarian')
  const clericLevel = dnd5eCombatantClassLevel(actor, 'cleric')
  const paladinLevel = dnd5eCombatantClassLevel(actor, 'paladin')
  const rangerLevel = dnd5eCombatantClassLevel(actor, 'ranger')
  const rogueLevel = dnd5eCombatantClassLevel(actor, 'rogue')
  const warlockLevel = dnd5eCombatantClassLevel(actor, 'warlock')
  const sizeDamageMode = dnd5eActiveWeaponDamageD4Mode(actor.classState.activeEffects)
  if (sizeDamageMode) {
    definitions.push({
      source: sizeDamageMode === 'add' ? 'enlarge' : 'reduce',
      count: 1,
      sides: 4,
      type: context.damageType,
      doubleOnCritical: true,
      operation: sizeDamageMode === 'add' ? 'add' : 'subtract-from-weapon',
    })
  }

  const sneakWeapon = context.mode === 'ranged' || context.finesse
  const sneakPosition = input.effectiveMode === 'advantage' || context.adjacentEnemyOfTarget
  if (
    rogueLevel >= 1 && sneakWeapon && sneakPosition && input.effectiveMode !== 'disadvantage' &&
    actor.classState.sneakAttackTurnKey !== turnKey
  ) {
    definitions.push({ source: 'sneak-attack', count: dnd5eRogueSneakAttackDice(rogueLevel), sides: 6, type: context.damageType, doubleOnCritical: true })
  }

  if (
    rangerLevel >= 3 && dnd5eCombatantHasSubclass(actor, 'ranger', 'hunter') &&
    actor.classSelections['hunters-prey']?.includes('colossus-slayer') &&
    target.currentHp < target.maxHp && actor.classState.colossusSlayerTurnKey !== turnKey
  ) {
    definitions.push({ source: 'colossus-slayer', count: 1, sides: 8, type: context.damageType, doubleOnCritical: true })
  }

  if (rangerLevel >= 2 && actor.concentrating && actor.classState.huntersMarkTargetId === target.id) {
    definitions.push({ source: 'hunters-mark', count: 1, sides: 6, type: context.damageType, doubleOnCritical: true })
  }

  if (dnd5eCombatantHasConcentrationEffect(input.state, actor.id, 'divine-favor')) {
    definitions.push({ source: 'divine-favor', count: 1, sides: 4, type: 'radiant', doubleOnCritical: true })
  }

  const brutalDice = barbarianLevel >= 17 ? 3 : barbarianLevel >= 13 ? 2 : barbarianLevel >= 9 ? 1 : 0
  if (barbarianLevel >= 1 && context.mode === 'melee' && input.critical && brutalDice > 0) {
    definitions.push({ source: 'brutal-critical', count: brutalDice, sides: context.weaponDamageSides, type: context.damageType, doubleOnCritical: false })
  }

  if (paladinLevel >= 11 && context.mode === 'melee') {
    definitions.push({ source: 'improved-divine-smite', count: 1, sides: 8, type: 'radiant', doubleOnCritical: true })
  }

  if (
    clericLevel >= 8 && dnd5eCombatantHasSubclass(actor, 'cleric', 'life') &&
    actor.classState.divineStrikeTurnKey !== turnKey
  ) {
    definitions.push({
      source: 'divine-strike',
      count: clericLevel >= 14 ? 2 : 1,
      sides: 8,
      type: 'radiant',
      doubleOnCritical: true,
    })
  }

  if (
    warlockLevel >= 12 &&
    actor.classSelections['pact-boon']?.includes('blade') &&
    actor.classSelections['eldritch-invocations']?.includes('lifedrinker')
  ) {
    definitions.push({
      source: 'lifedrinker', count: 0, sides: 2, bonus: rules.abilityModifier(actor.abilities.cha),
      type: 'necrotic', doubleOnCritical: false,
    })
  }

  const foeSlayer = context.foeSlayer === 'damage' ? foeSlayerBonus(input.state, actor, target) : 0
  if (foeSlayer > 0) {
    definitions.push({
      source: 'foe-slayer', count: 0, sides: 2, bonus: foeSlayer,
      type: context.damageType, doubleOnCritical: false,
    })
  }

  const slotLevel = context.divineSmiteSlotLevel
  if (paladinLevel >= 2 && context.mode === 'melee' && slotLevel != null) {
    const extraAgainstUnholy = target.creatureType === '邪魔' || target.creatureType === '亡灵' ? 1 : 0
    definitions.push({
      source: 'divine-smite',
      count: 1 + Math.min(4, slotLevel) + extraAgainstUnholy,
      sides: 8,
      type: 'radiant',
      doubleOnCritical: true,
    })
  }
  return definitions
}

function applyStunningStrike(input: {
  state: Dnd5eHeadlessCombatState
  actor: Dnd5eCombatant
  target: Dnd5eCombatant
  saveD20?: number
  saveD20Second?: number
  saveBlessRoll?: number
  saveBaneRoll?: number
  saveRerollD20?: number
  saveRerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  events: Dnd5eCombatEvent[]
}) {
  const { state, actor, target, events } = input
  if (!spendClassResource(actor, 'dnd5e-ki', events)) throw new RangeError('Stunning Strike Ki is unavailable')
  const saveModifier = (target.savingThrowBonuses.con ?? rules.abilityModifier(target.abilities.con)) +
    resolveDnd5eBlessRoll(state, target, input.saveBlessRoll) -
    resolveDnd5eBaneRoll(state, target, input.saveBaneRoll)
  const saveDc = 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities.wis)
  const saveMode: D20RollMode = target.exhaustionLevel >= 3 ? 'disadvantage' : 'normal'
  const saveRolls = saveMode === 'normal'
    ? [input.saveD20 ?? 0]
    : [input.saveD20 ?? 0, input.saveD20Second ?? 0]
  const save = resolveSavingThrowWithClassReroll({
    combatant: target,
    ability: 'con',
    rolls: saveRolls,
    rerollD20: input.saveRerollD20,
    rerollD20Second: input.saveRerollD20Second,
    bardicInspirationRoll: input.bardicInspirationRoll,
    darkOnesOwnLuckRoll: input.darkOnesOwnLuckRoll,
    mode: saveMode,
    modifier: saveModifier,
    dc: saveDc,
    events,
  })
  events.push({
    type: 'saving-throw-resolved', targetId: target.id, ability: 'con', d20: save.roll.d20,
    modifier: saveModifier, total: save.roll.total, dc: saveDc, success: save.success,
  })
  if (!save.success && !target.conditionImmunities.includes('震慑') && !target.conditionImmunities.includes('stunned')) {
    target.classState.stunnedByActorId = actor.id
    target.classState.stunnedAppliedTurnKey = classFeatureTurnKey(state, actor.id)
    events.push({ type: 'condition-applied', actorId: actor.id, targetId: target.id, condition: '震慑' })
  }
}

interface Dnd5eRepeatedMeleeDamageDefinition {
  count: number
  sides: number
  bonus: number
  type?: Dnd5eDamageType
}

function resolveStandAgainstTideRepeat(input: {
  state: Dnd5eHeadlessCombatState
  attacker: Dnd5eCombatant
  hunter: Dnd5eCombatant
  attackModifier: number
  criticalThreshold?: number
  reachFeet: number
  damage: readonly Dnd5eRepeatedMeleeDamageDefinition[]
  use: Dnd5eStandAgainstTideUse
  events: Dnd5eCombatEvent[]
  classDamageContext?: Dnd5eWeaponClassDamageContext
}): Dnd5eActionResult {
  const { state, attacker, hunter, use, events } = input
  const redirectTarget = state.combatants[use.targetId]
  const hasFeature = dnd5eCombatantClassLevel(hunter, 'ranger') >= 15 && dnd5eCombatantHasSubclass(hunter, 'ranger', 'hunter') &&
    hunter.classSelections['superior-hunters-defense']?.includes('stand-against-tide')
  if (
    !hasFeature || hunter.currentHp <= 0 || attacker.controller === hunter.controller ||
    !hunter.turn.reactionAvailable || dnd5eIsIncapacitated(hunter) || dnd5eReactionsPrevented(hunter) ||
    !redirectTarget || redirectTarget.currentHp <= 0 || redirectTarget.deathSaves.dead ||
    dnd5eCombatantIsBanished(redirectTarget) || redirectTarget.id === attacker.id || redirectTarget.id === hunter.id ||
    !Number.isFinite(use.distanceFeet) || use.distanceFeet < 0 || use.distanceFeet > input.reachFeet
  ) return fail(state, events, 'invalid-class-feature')

  if (!spendReaction(hunter, events)) return fail(state, events, 'reaction-unavailable')
  events.push({
    type: 'class-state-changed', actorId: hunter.id, targetId: redirectTarget.id,
    stateKey: 'stand-against-tide', active: true,
  })
  try {
    if (!passesTranquilityWard(state, attacker, redirectTarget, use.tranquilitySave, events)) {
      return { ok: true, state, events }
    }
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  if (!spendProtectionReaction(state, attacker, redirectTarget, use.protectionReactionActorId, events)) {
    return fail(state, events, 'invalid-class-feature')
  }
  const mode = dnd5eRepeatedMeleeAttackMode(state, attacker.id, redirectTarget.id, use.mode)
  const rolls = mode === 'normal' ? [use.d20] : [use.d20, use.d20Second ?? use.d20]
  let targetArmorClass = dnd5eTargetArmorClassForAttack(state, attacker.id, redirectTarget.id)
  let attack: AttackResolution | undefined
  try {
    const inspiredAttack = applyBardicInspirationToAttack(
      attacker,
      rules.resolveAttack({
        rolls,
        mode,
        modifier: input.attackModifier + resolveDnd5eBlessRoll(state, attacker, use.blessRoll) -
          resolveDnd5eBaneRoll(state, attacker, use.baneRoll),
        targetAc: targetArmorClass,
      }),
      use.bardicInspirationRoll,
      events,
    )
    const cutAttack = applyCuttingWordsToAttack(state, attacker, inspiredAttack, use.cuttingWords, events)
    attack = cutAttack ? applyStrokeOfLuckToAttack(attacker, cutAttack, use.strokeOfLuck, events) : undefined
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  if (!attack) return fail(state, events, 'invalid-class-feature')
  const criticalThreshold = Math.min(20, Math.max(18, input.criticalThreshold ?? 20))
  let attackOutcome = resolveDnd5eAttackOutcome({
    attack,
    targetArmorClass,
    criticalThreshold,
    automaticCritical: dnd5eHitIsAutomaticCritical(state, attacker.id, redirectTarget, use.distanceFeet),
    forceHit: use.strokeOfLuck === true,
  })
  let { hit, critical } = attackOutcome
  const shieldSpellApplied = applyShieldSpellReaction(state, redirectTarget, use.shieldSpellReaction, hit, events)
  if (shieldSpellApplied == null) return fail(state, events, 'invalid-class-feature')
  if (shieldSpellApplied) {
    targetArmorClass = dnd5eTargetArmorClassForAttack(state, attacker.id, redirectTarget.id)
    attackOutcome = resolveDnd5eAttackOutcome({
      attack,
      targetArmorClass,
      criticalThreshold,
      automaticCritical: dnd5eHitIsAutomaticCritical(state, attacker.id, redirectTarget, use.distanceFeet),
      forceHit: use.strokeOfLuck === true,
    })
    ;({ hit, critical } = attackOutcome)
  }
  emitDnd5eAttackResolved(state, {
    type: 'attack-resolved', actorId: attacker.id, targetId: redirectTarget.id,
    d20: attack.roll.d20, total: attack.roll.total, armorClass: targetArmorClass, hit, critical,
  }, events)
  if (!hit) {
    if (use.cuttingWordsDamage || use.uncannyDodge || (use.hurlThroughHellDamageRolls?.length ?? 0) > 0) {
      return fail(state, events, 'invalid-class-feature')
    }
    return { ok: true, state, events }
  }

  recordHunterMultiattackDefenseHit(state, attacker, redirectTarget)
  const classDefinitions = input.classDamageContext
    ? dnd5eWeaponClassDamageDefinitions({
        state,
        actorId: attacker.id,
        targetId: redirectTarget.id,
        context: input.classDamageContext,
        effectiveMode: mode,
        critical,
      })
    : []
  const classRolls = use.classDamageRolls ?? []
  if (
    use.damageRolls.length !== input.damage.length || classRolls.length !== classDefinitions.length ||
    new Set(classRolls.map((entry) => entry.source)).size !== classRolls.length
  ) return fail(state, events, 'invalid-dice')

  let components: Dnd5eDamageComponent[] = []
  try {
    for (let index = 0; index < input.damage.length; index += 1) {
      const definition = input.damage[index]
      const resolved = rules.resolveDamage({ ...definition, rolls: use.damageRolls[index], critical })
      components.push({ total: resolved.total, type: definition.type })
    }
    let weaponDamageReduction = 0
    for (const definition of classDefinitions) {
      const supplied = classRolls.find((entry) => entry.source === definition.source)
      if (!supplied) return fail(state, events, 'invalid-dice')
      const resolved = rules.resolveDamage({
        count: definition.count,
        sides: definition.sides,
        bonus: definition.bonus ?? 0,
        rolls: supplied.rolls,
        critical: critical && definition.doubleOnCritical,
      })
      if (definition.operation === 'subtract-from-weapon') {
        weaponDamageReduction += resolved.total
      } else {
        components.push({ total: resolved.total, type: definition.type, source: definition.source })
      }
    }
    const appliedWeaponDamageReduction = subtractFromWeaponDamage(
      components.filter((component) => component.source == null),
      weaponDamageReduction,
    )
    if (appliedWeaponDamageReduction > 0) {
      events.push({
        type: 'class-damage-applied', actorId: attacker.id, targetId: redirectTarget.id,
        source: 'reduce', amount: -appliedWeaponDamageReduction,
      })
    }
    const sources = new Set(classDefinitions.map((definition) => definition.source))
    const turnKey = classFeatureTurnKey(state, attacker.id)
    if (sources.has('sneak-attack')) attacker.classState.sneakAttackTurnKey = turnKey
    if (sources.has('colossus-slayer')) attacker.classState.colossusSlayerTurnKey = turnKey
    if (sources.has('divine-strike')) attacker.classState.divineStrikeTurnKey = turnKey
    if (sources.has('foe-slayer')) attacker.classState.foeSlayerTurnKey = turnKey
    if (sources.has('divine-smite')) {
      spendClassResource(attacker, `dnd5e-spell-slot-${input.classDamageContext!.divineSmiteSlotLevel}`, events)
    }

    let cuttingWordsReduction = consumeCuttingWords(state, attacker, use.cuttingWordsDamage, events)
    if (cuttingWordsReduction == null) return fail(state, events, 'invalid-class-feature')
    for (const component of components) {
      const reduction = Math.min(component.total, cuttingWordsReduction)
      cuttingWordsReduction -= reduction
      component.total -= reduction
    }
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  const reducedDamage = applyUncannyDodge(
    redirectTarget,
    components.reduce((sum, component) => sum + component.total, 0),
    use.uncannyDodge,
    events,
  )
  if (reducedDamage == null) return fail(state, events, 'invalid-class-feature')
  components = adjustDnd5eDamageComponents(
    redirectTarget,
    scaleDnd5eDamageComponents(components, reducedDamage),
  )
  for (const component of components) {
    if (component.source) {
      events.push({
        type: 'class-damage-applied', actorId: attacker.id, targetId: redirectTarget.id,
        source: component.source, amount: component.total,
      })
    }
  }
  applyDamage(redirectTarget, components.reduce((sum, component) => sum + component.total, 0), critical, events, attacker, state, [
    ...input.damage.flatMap((entry) => entry.type ? [entry.type] : []),
    ...classDefinitions.map((entry) => entry.type),
  ])
  triggerHurlThroughHell({
    state, actor: attacker, target: redirectTarget,
    damageRolls: use.hurlThroughHellDamageRolls,
    events,
  })
  return { ok: true, state, events }
}

function resolveWeaponAttack(state: Dnd5eHeadlessCombatState, action: Extract<Dnd5eAction, { type: 'attack' | 'opportunity-attack' }>, events: Dnd5eCombatEvent[]): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const target = state.combatants[action.targetId]
  if (!actor || actor.currentHp <= 0 || dnd5eCombatantIsBanished(actor)) return fail(state, events, 'invalid-actor')
  if (!target || target.deathSaves.dead || dnd5eCombatantIsBanished(target)) return fail(state, events, 'invalid-target')
  if (dnd5eCannotAttackSource(actor, target.id)) return fail(state, events, 'invalid-target')
  if (action.type === 'opportunity-attack') {
    const expectedCriticalThreshold = dnd5eCombatantClassLevel(actor, 'fighter') >= 15 &&
      dnd5eCombatantHasSubclass(actor, 'fighter', 'champion')
      ? 18
      : dnd5eCombatantClassLevel(actor, 'fighter') >= 3 &&
          dnd5eCombatantHasSubclass(actor, 'fighter', 'champion')
        ? 19
        : 20
    if (
      (action.criticalThreshold != null && action.criticalThreshold !== expectedCriticalThreshold) ||
      (action.classDamageContext && (
        action.classDamageContext.divineSmiteSlotLevel != null ||
        action.classDamageContext.recklessAttack ||
        action.classDamageContext.frenzyAttack ||
        action.classDamageContext.twoWeaponBonusAttack ||
        action.classDamageContext.hordeBreakerEligible ||
        action.classDamageContext.hordeBreakerAttack ||
        action.classDamageContext.stunningStrike ||
        action.classDamageContext.foeSlayer != null
      ))
    ) return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && actor.classState.wildShapeFormId) {
    return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.divineSmiteSlotLevel != null) {
    const slotLevel = action.classDamageContext.divineSmiteSlotLevel
    const slot = actor.classResources[`dnd5e-spell-slot-${slotLevel}`]
    if (
      dnd5eCombatantClassLevel(actor, 'paladin') < 2 || action.classDamageContext.mode !== 'melee' ||
      !Number.isInteger(slotLevel) || slotLevel < 1 || slotLevel > 9 || !slot || slot.current < 1
    ) return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.recklessAttack) {
    const turnKey = classFeatureTurnKey(state, actor.id)
    if (
      dnd5eCombatantClassLevel(actor, 'barbarian') < 2 || action.classDamageContext.mode !== 'melee' ||
      !action.classDamageContext.strengthBased || action.mode !== 'advantage' ||
      (actor.classState.recklessAttackTurnKey !== turnKey && !actor.turn.actionAvailable)
    ) return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.frenzyAttack) {
    const turnKey = classFeatureTurnKey(state, actor.id)
    if (
      dnd5eCombatantClassLevel(actor, 'barbarian') < 3 || !dnd5eCombatantHasSubclass(actor, 'barbarian', 'berserker') ||
      !actor.classState.raging || !actor.classState.frenzying || actor.classState.frenzyStartedTurnKey === turnKey ||
      action.classDamageContext.mode !== 'melee' || action.spendBonusAction !== true
    ) return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.twoWeaponBonusAttack) {
    const turnKey = classFeatureTurnKey(state, actor.id)
    if (
      action.classDamageContext.mode !== 'melee' || action.spendAction !== false || action.spendBonusAction !== true ||
      actor.classState.weaponAttackActionTurnKey !== turnKey
    ) return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.hordeBreakerAttack) {
    const turnKey = classFeatureTurnKey(state, actor.id)
    if (
      dnd5eCombatantClassLevel(actor, 'ranger') < 3 || !dnd5eCombatantHasSubclass(actor, 'ranger', 'hunter') ||
      !actor.classSelections['hunters-prey']?.includes('horde-breaker') ||
      actor.classState.hordeBreakerOpportunityTurnKey !== turnKey ||
      actor.classState.hordeBreakerUsedTurnKey === turnKey ||
      !actor.classState.hordeBreakerSourceTargetId || actor.classState.hordeBreakerSourceTargetId === action.targetId ||
      action.spendAction !== false || action.spendBonusAction === true
    ) return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.stunningStrike) {
    const ki = actor.classResources['dnd5e-ki']
    if (dnd5eCombatantClassLevel(actor, 'monk') < 5 || action.classDamageContext.mode !== 'melee' || !ki || ki.current < 1) {
      return fail(state, events, 'invalid-class-feature')
    }
  }
  if (
    action.type === 'opportunity-attack' && action.reactionFeature === 'berserker-retaliation' &&
    (dnd5eCombatantClassLevel(actor, 'barbarian') < 14 || !dnd5eCombatantHasSubclass(actor, 'barbarian', 'berserker'))
  ) return fail(state, events, 'invalid-class-feature')
  if (
    action.type === 'opportunity-attack' && action.reactionFeature === 'hunter-giant-killer' &&
    (
      dnd5eCombatantClassLevel(actor, 'ranger') < 3 || !dnd5eCombatantHasSubclass(actor, 'ranger', 'hunter') ||
      !actor.classSelections['hunters-prey']?.includes('giant-killer')
    )
  ) return fail(state, events, 'invalid-class-feature')
  if (action.type === 'opportunity-attack' && !dnd5eCombatantCanSee(state, actor.id, target.id)) {
    return fail(state, events, 'invalid-target')
  }
  const foeSlayerAttackBonus = action.type === 'attack' && action.classDamageContext?.foeSlayer
    ? foeSlayerBonus(state, actor, target)
    : 0
  if (action.type === 'attack' && action.classDamageContext?.foeSlayer && foeSlayerAttackBonus <= 0) {
    return fail(state, events, 'invalid-class-feature')
  }
  if (actor.classState.raging) actor.classState.rageSustainedThisTurn = true
  const attackingFromHidden = actor.classState.hiddenCheckTotal != null
  const resource: TurnResource = action.type === 'opportunity-attack'
    ? 'reaction'
    : action.spendBonusAction
      ? 'bonusAction'
      : 'action'
  const shouldSpendResource = action.type === 'opportunity-attack' || action.spendBonusAction === true || action.spendAction !== false
  if (shouldSpendResource) {
    if (resource === 'reaction' && dnd5eReactionsPrevented(actor)) return fail(state, events, 'reaction-unavailable')
    if (!spend(actor, resource)) return fail(state, events, resource === 'reaction' ? 'reaction-unavailable' : resource === 'bonusAction' ? 'bonus-action-unavailable' : 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource })
  }
  endTranquilityForHostileAction(actor, events, 'makes-attack')
  if (attackingFromHidden) {
    actor.classState.hiddenCheckTotal = undefined
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hidden', active: false })
  }
  try {
    if (!passesTranquilityWard(state, actor, target, action.tranquilitySave, events)) {
      return action.standAgainstTide
        ? fail(state, events, 'invalid-class-feature')
        : { ok: true, state, events }
    }
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  if (!spendProtectionReaction(state, actor, target, action.type === 'attack' ? action.protectionReactionActorId : undefined, events)) {
    return fail(state, events, 'invalid-class-feature')
  }
  const escapeTheHorde = action.type === 'opportunity-attack' && !action.reactionFeature &&
    dnd5eCombatantClassLevel(target, 'ranger') >= 7 && dnd5eCombatantHasSubclass(target, 'ranger', 'hunter') &&
    target.classSelections['defensive-tactics']?.includes('escape-the-horde')
  const requestedMode = action.mode ?? 'normal'
  const magicWeaponBonus = dnd5eActiveMagicWeaponBonus(
    actor.classState.activeEffects,
    action.classDamageContext?.weaponId,
  )
  const rangedContext = action.type === 'attack' && action.classDamageContext?.mode === 'ranged'
    ? action.classDamageContext
    : undefined
  const rangedDistance = rangedContext
    ? dnd5eAttackDistanceFeet(state, actor.id, target.id, rangedContext.distanceFeet)
    : undefined
  if (rangedContext?.longRangeFeet != null && rangedDistance! > rangedContext.longRangeFeet) {
    return fail(state, events, 'invalid-target')
  }
  const rangedDisadvantage = !!rangedContext && (
    rangedDistance! > (rangedContext.normalRangeFeet ?? rangedContext.longRangeFeet ?? 0) ||
    dnd5eHostileWithinFiveFeet(state, actor)
  )
  const viciousMockeryDisadvantage = consumeViciousMockeryAttackDisadvantage(actor, events)
  const hasAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
    (dnd5eTargetGrantsAttackAdvantage(target) || requestedMode === 'advantage' || attackingFromHidden ||
      !!target.classState.stunnedByActorId || dnd5eAttackerIsUnseenForAttack(state, actor.id, target.id) ||
      dnd5eHelpAttackApplies(state, actor, target))
  const hasDisadvantage = requestedMode === 'disadvantage' || rangedDisadvantage || viciousMockeryDisadvantage || escapeTheHorde ||
    (actor.wearingUnproficientArmor && action.classDamageContext != null) ||
    (action.type === 'attack' && action.protectionReactionActorId != null) || dnd5eFrightenedAttackDisadvantage(state, actor) ||
    dnd5eTargetIsDodging(target) || dnd5eBlurImposesAttackDisadvantage(state, actor.id, target.id) ||
    dnd5eTargetIsUnseenForAttack(state, actor.id, target.id)
  const mode = resolveDnd5eRollMode({
    advantage: [{ active: hasAdvantage, reason: 'attack-advantage' }],
    disadvantage: [{ active: hasDisadvantage, reason: 'attack-disadvantage' }],
  }).mode
  const rolls = mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? action.d20]
  let targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
  let attack
  try {
    const inspiredAttack = applyBardicInspirationToAttack(
      actor,
      rules.resolveAttack({
        rolls,
        mode,
        modifier: action.attackModifier + magicWeaponBonus +
          resolveDnd5eBlessRoll(state, actor, action.blessRoll) -
          resolveDnd5eBaneRoll(state, actor, action.baneRoll) +
          (action.type === 'attack' && action.classDamageContext?.foeSlayer === 'attack' ? foeSlayerAttackBonus : 0),
        targetAc: targetArmorClass,
      }),
      action.bardicInspirationRoll,
      events,
    )
    const cutAttack = applyCuttingWordsToAttack(state, actor, inspiredAttack, action.cuttingWords, events)
    attack = cutAttack
      ? applyStrokeOfLuckToAttack(actor, cutAttack, action.strokeOfLuck, events)
      : undefined
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  if (!attack) return fail(state, events, 'invalid-class-feature')
  const criticalThreshold = Math.min(20, Math.max(18, action.criticalThreshold ?? 20))
  let attackOutcome = resolveDnd5eAttackOutcome({
    attack,
    targetArmorClass,
    criticalThreshold,
    automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
    forceHit: action.strokeOfLuck === true,
  })
  let { hit, critical } = attackOutcome
  const shieldSpellApplied = applyShieldSpellReaction(state, target, action.shieldSpellReaction, hit, events)
  if (shieldSpellApplied == null) return fail(state, events, 'invalid-class-feature')
  if (shieldSpellApplied) {
    targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
    attackOutcome = resolveDnd5eAttackOutcome({
      attack,
      targetArmorClass,
      criticalThreshold,
      automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
      forceHit: action.strokeOfLuck === true,
    })
    ;({ hit, critical } = attackOutcome)
  }
  emitDnd5eAttackResolved(state, { type: 'attack-resolved', actorId: actor.id, targetId: target.id, d20: attack.roll.d20, total: attack.roll.total, armorClass: targetArmorClass, hit, critical }, events)
  consumeDnd5eHelpAttack(state, actor, target, events)
  if (action.type === 'attack' && action.classDamageContext?.foeSlayer === 'attack') {
    actor.classState.foeSlayerTurnKey = classFeatureTurnKey(state, actor.id)
  }
  if (!hit && (action.uncannyDodge || action.cuttingWordsDamage || (action.type === 'attack' && action.deflectMissilesD10 != null))) {
    return fail(state, events, 'invalid-class-feature')
  }
  if (hit && action.standAgainstTide) return fail(state, events, 'invalid-class-feature')
  if (action.type === 'attack' && action.uncannyDodge && action.deflectMissilesD10 != null) {
    return fail(state, events, 'invalid-class-feature')
  }
  if (hit) recordHunterMultiattackDefenseHit(state, actor, target)
  if (action.type === 'attack' && action.classDamageContext?.recklessAttack) {
    actor.classState.recklessAttackTurnKey = classFeatureTurnKey(state, actor.id)
  }
  if (action.type === 'attack' && dnd5eCombatantClassLevel(actor, 'monk') >= 1 && action.spendAction !== false) {
    const turnKey = classFeatureTurnKey(state, actor.id)
    actor.classState.monkAttackActionTurnKey = turnKey
    if (action.classDamageContext?.monkMartialArtsEligible) actor.classState.monkMartialArtsTurnKey = turnKey
  }
  if (action.type === 'attack' && action.spendAction !== false) {
    actor.classState.weaponAttackActionTurnKey = classFeatureTurnKey(state, actor.id)
  }
  if (action.type === 'attack' && action.classDamageContext?.hordeBreakerAttack) {
    actor.classState.hordeBreakerUsedTurnKey = classFeatureTurnKey(state, actor.id)
  } else if (action.type === 'attack' && action.classDamageContext?.hordeBreakerEligible) {
    actor.classState.hordeBreakerOpportunityTurnKey = classFeatureTurnKey(state, actor.id)
    actor.classState.hordeBreakerSourceTargetId = target.id
  }
  if (!hit && action.standAgainstTide) {
    const meleeAttack = action.type === 'opportunity-attack' || action.classDamageContext?.mode === 'melee'
    if (!meleeAttack) return fail(state, events, 'invalid-class-feature')
    return resolveStandAgainstTideRepeat({
      state,
      attacker: actor,
      hunter: target,
      attackModifier: action.attackModifier +
        magicWeaponBonus +
        (action.type === 'attack' && action.classDamageContext?.foeSlayer === 'attack' ? foeSlayerAttackBonus : 0),
      criticalThreshold,
      reachFeet: 5,
      damage: [{
        count: action.damage.count,
        sides: action.damage.sides,
        bonus: action.damage.bonus,
        type: action.damage.type,
      }],
      use: action.standAgainstTide,
      events,
      classDamageContext: action.classDamageContext,
    })
  }
  if (hit) {
    let damageComponents: Dnd5eDamageComponent[] = []
    try {
      const damage = rules.resolveDamage({ ...action.damage, critical })
      const resolvedClassDamage: Array<{ definition: Dnd5eClassDamageDefinition; total: number }> = []
      if (action.classDamageContext) {
        const definitions = dnd5eWeaponClassDamageDefinitions({
          state,
          actorId: actor.id,
          targetId: target.id,
          context: action.classDamageContext,
          effectiveMode: mode,
          critical,
        })
        const supplied = action.classDamageRolls ?? []
        if (supplied.length !== definitions.length || new Set(supplied.map((entry) => entry.source)).size !== supplied.length) {
          return fail(state, events, 'invalid-dice')
        }
        for (const definition of definitions) {
          const rollsForSource = supplied.find((entry) => entry.source === definition.source)?.rolls
          if (!rollsForSource) return fail(state, events, 'invalid-dice')
          const resolved = rules.resolveDamage({
            count: definition.count,
            sides: definition.sides,
            bonus: definition.bonus ?? 0,
            rolls: rollsForSource,
            critical: critical && definition.doubleOnCritical,
          })
          resolvedClassDamage.push({ definition, total: resolved.total })
        }
        const sources = new Set(definitions.map((definition) => definition.source))
        const turnKey = classFeatureTurnKey(state, actor.id)
        if (sources.has('sneak-attack')) actor.classState.sneakAttackTurnKey = turnKey
        if (sources.has('colossus-slayer')) actor.classState.colossusSlayerTurnKey = turnKey
        if (sources.has('divine-strike')) actor.classState.divineStrikeTurnKey = turnKey
        if (sources.has('foe-slayer')) actor.classState.foeSlayerTurnKey = turnKey
        if (sources.has('divine-smite')) {
          spendClassResource(actor, `dnd5e-spell-slot-${action.classDamageContext!.divineSmiteSlotLevel}`, events)
        }
      }
      let cuttingWordsReduction = consumeCuttingWords(state, actor, action.cuttingWordsDamage, events)
      if (cuttingWordsReduction == null) return fail(state, events, 'invalid-class-feature')
      const reduceDamageRoll = (rawDamage: number) => {
        const reduction = Math.min(rawDamage, cuttingWordsReduction ?? 0)
        cuttingWordsReduction = Math.max(0, (cuttingWordsReduction ?? 0) - reduction)
        return rawDamage - reduction
      }
      const weaponDamageReduction = resolvedClassDamage
        .filter((entry) => entry.definition.operation === 'subtract-from-weapon')
        .reduce((sum, entry) => sum + entry.total, 0)
      const augmentedWeaponDamage = damage.total + magicWeaponBonus
      const reducedWeaponDamage = Math.max(1, augmentedWeaponDamage - weaponDamageReduction)
      const appliedWeaponDamageReduction = augmentedWeaponDamage - reducedWeaponDamage
      damageComponents.push({
        total: reduceDamageRoll(reducedWeaponDamage),
        type: action.damage.type,
      })
      if (appliedWeaponDamageReduction > 0) {
        events.push({
          type: 'class-damage-applied', actorId: actor.id, targetId: target.id,
          source: 'reduce', amount: -appliedWeaponDamageReduction,
        })
      }
      for (const entry of resolvedClassDamage.filter((candidate) =>
        candidate.definition.operation !== 'subtract-from-weapon',
      )) {
        damageComponents.push({
          total: reduceDamageRoll(entry.total),
          type: entry.definition.type,
          source: entry.definition.source,
        })
      }
      const uncannyDamage = applyUncannyDodge(
        target,
        damageComponents.reduce((sum, component) => sum + component.total, 0),
        action.uncannyDodge,
        events,
      )
      if (uncannyDamage == null) return fail(state, events, 'invalid-class-feature')
      const deflectedDamage = applyDeflectMissiles(
        state,
        actor,
        target,
        uncannyDamage,
        action.type === 'attack' && action.classDamageContext?.mode === 'ranged',
        action.type === 'attack' ? action.deflectMissilesD10 : undefined,
        action.damage.type,
        events,
      )
      if (deflectedDamage == null) return fail(state, events, 'invalid-class-feature')
      damageComponents = adjustDnd5eDamageComponents(
        target,
        scaleDnd5eDamageComponents(damageComponents, deflectedDamage),
      )
      for (const component of damageComponents) {
        if (component.source) {
          events.push({
            type: 'class-damage-applied', actorId: actor.id, targetId: target.id,
            source: component.source, amount: component.total,
          })
        }
      }
      applyDamage(target, damageComponents.reduce((sum, component) => sum + component.total, 0), critical, events, actor, state, [
        ...(action.damage.type ? [action.damage.type] : []),
        ...resolvedClassDamage.map((entry) => entry.definition.type),
      ])
      if (action.type === 'attack' && action.classDamageContext?.stunningStrike) {
        applyStunningStrike({
          state, actor, target, events,
          saveD20: action.stunningStrikeSaveD20,
          saveD20Second: action.stunningStrikeSaveD20Second,
          saveBlessRoll: action.stunningStrikeSaveBlessRoll,
          saveBaneRoll: action.stunningStrikeSaveBaneRoll,
          saveRerollD20: action.stunningStrikeSaveRerollD20,
          saveRerollD20Second: action.stunningStrikeSaveRerollD20Second,
          bardicInspirationRoll: action.stunningStrikeBardicInspirationRoll,
          darkOnesOwnLuckRoll: action.stunningStrikeDarkOnesOwnLuckRoll,
        })
      }
      triggerHurlThroughHell({
        state,
        actor,
        target,
        damageRolls: action.hurlThroughHellDamageRolls,
        events,
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
  } else if ((action.hurlThroughHellDamageRolls?.length ?? 0) > 0) {
    return fail(state, events, 'invalid-dice')
  }
  return { ok: true, state, events }
}

function resolveSpellCast(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'cast-spell' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const spell = getDnd5eSrdCombatSpell(action.spellId)
  const metamagic = action.metamagic
  const sustainedEffectAttack = action.sustainedEffectAttack
  const sustainedAttack = sustainedEffectAttack && spell?.sustainedAttack?.id === sustainedEffectAttack
    ? spell.sustainedAttack
    : undefined
  const sustainedEffectAreaId = action.sustainedEffectAreaId
  const spellUsesEffectEntity = spell?.sustainedAttack?.origin === 'effect-token'
  const sustainedUsesPersistentArea = sustainedAttack?.origin === 'persistent-area'
  const sustainedSavingThrow = sustainedAttack?.resolution === 'saving-throw'
  const usesSpellAttackRoll = spell?.effect === 'spell-attack' ||
    sustainedAttack?.resolution === 'spell-attack' ||
    (sustainedAttack != null && sustainedAttack.resolution == null)
  const persistentArea = spell?.effect === 'persistent-area'
  const teleportDestination = action.teleportDestination
  const requestedTargetIds = persistentArea ? [] : [...new Set(
    action.targetIds !== undefined ? action.targetIds : [action.targetId],
  )]
  const legendaryResistanceTargetIds = [...new Set(action.legendaryResistanceTargetIds ?? [])]
  const targets = requestedTargetIds.map((targetId) => state.combatants[targetId])
  const target = targets[0] ?? actor
  const spellcastingClassId = actor && spell
    ? (action.castingClassId ? [action.castingClassId] : [
        ...spell.classes,
        ...((actor.classLevels?.bard ?? 0) > 0 ? ['bard' as const] : []),
      ]).find((classId) => {
        if (dnd5eCombatantClassLevel(actor, classId) < 1) return false
        const definition = dnd5eClassDefinition(classId)
        if (!definition?.spellcasting) return false
        const selections = actor.classSelectionsByClass?.[classId] ?? actor.classSelections
        const selectionKey = spell.level === 0
          ? 'spell-cantrips'
          : definition?.spellcasting?.kind === 'full-known' || definition?.spellcasting?.kind === 'half-known' || definition?.spellcasting?.kind === 'pact'
            ? 'spell-known'
            : 'spell-prepared'
        const bardMagicalSecret = classId === 'bard' && (
          selections['magical-secrets']?.includes(spell.id) ||
          selections['lore-additional-magical-secrets']?.includes(spell.id)
        )
        return (spell.classes.includes(classId) || bardMagicalSecret) && (selections[selectionKey]?.includes(spell.id) ||
          (classId === 'wizard' && (
            selections['spell-mastery-1']?.includes(spell.id) || selections['spell-mastery-2']?.includes(spell.id) || selections['signature-spells']?.includes(spell.id)
          )) ||
          (classId === 'warlock' && selections[`mystic-arcanum-${spell.level}`]?.includes(spell.id)) || bardMagicalSecret)
      })
    : undefined
  const classDefinition = spellcastingClassId ? dnd5eClassDefinition(spellcastingClassId) : undefined
  const spellcasting = classDefinition?.spellcasting
  const spellcastingClassLevel = actor && spellcastingClassId ? dnd5eCombatantClassLevel(actor, spellcastingClassId) : 0
  const spellcastingSelections = actor && spellcastingClassId
    ? actor.classSelectionsByClass?.[spellcastingClassId] ?? actor.classSelections
    : {}
  if (
    !actor || actor.currentHp <= 0 || dnd5eCombatantIsBanished(actor) || !target ||
    targets.some((candidate) => !candidate ||
      (candidate.deathSaves.dead &&
        spell?.effect !== 'sleep-hit-point-pool' &&
        spell?.effect !== 'color-spray-hit-point-pool') ||
      dnd5eCombatantIsBanished(candidate)) ||
    !spell || (!persistentArea && !spell.area && requestedTargetIds.length < 1) ||
    requestedTargetIds.length > (sustainedAttack
      ? sustainedSavingThrow
        ? dnd5eSpellMaximumTargets(spell, action.slotLevel, actor.level)
        : 1
      : metamagic?.kind === 'twinned' ? 2 : dnd5eSpellMaximumTargets(spell, action.slotLevel, actor.level)) ||
    (metamagic?.kind === 'twinned' && requestedTargetIds.length !== 2) ||
    !spellcasting || !spellcastingClassId
  ) {
    return fail(state, events, 'invalid-class-feature')
  }
  if (
    (spell.effect === 'teleport') !== (teleportDestination != null) ||
    (teleportDestination && (
      requestedTargetIds.length !== 0 ||
      action.targetId !== actor.id ||
      !Number.isFinite(teleportDestination.to.x) ||
      !Number.isFinite(teleportDestination.to.y) ||
      !Number.isFinite(teleportDestination.distanceFeet) ||
      teleportDestination.distanceFeet < 0 ||
      teleportDestination.distanceFeet > 30 ||
      (teleportDestination.toElevationFeet != null &&
        !Number.isFinite(teleportDestination.toElevationFeet))
    ))
  ) return fail(state, events, 'invalid-target')
  if (!sustainedAttack && actor.wearingUnproficientArmor) {
    return fail(state, events, 'invalid-class-feature')
  }
  if (((sustainedAttack && sustainedAttack.relation !== 'any') || spell.target === 'hostile') &&
    requestedTargetIds.some((targetId) => dnd5eCannotAttackSource(actor, targetId))) {
    return fail(state, events, 'invalid-target')
  }
  if (
    ((spellUsesEffectEntity || sustainedUsesPersistentArea) && (
      typeof sustainedEffectAreaId !== 'string' ||
      !sustainedEffectAreaId.startsWith('core-spell-area:') ||
      sustainedEffectAreaId.length > 240
    )) ||
    (!spellUsesEffectEntity && !sustainedUsesPersistentArea && sustainedEffectAreaId != null)
  ) return fail(state, events, 'invalid-class-feature')
  const sustainedEffect = sustainedAttack
    ? reconciledDnd5eActiveEffects(actor).find((effect) =>
        effect.source.kind === 'spell' &&
        effect.source.actorId === actor.id &&
        effect.source.rulesId === spell.id &&
        effect.definitionId === `srd-5.1:spell:${spell.id}` &&
        (sustainedAttack.origin === 'caster' || sustainedAttack.origin === 'persistent-area'
          ? effect.duration.type === 'concentration' && effect.duration.sourceActorId === actor.id
          : effect.duration.type === 'rounds' && effect.stackingKey === sustainedEffectAreaId),
      )
    : undefined
  if (
    (sustainedEffectAttack != null) !== (sustainedAttack != null) ||
    (sustainedAttack && (
      !sustainedEffect || !Number.isInteger(sustainedEffect.potency) ||
      sustainedEffect.potency !== action.slotLevel ||
      action.slotLevel < spell.level || action.slotLevel > 9 ||
      ((sustainedAttack.origin === 'caster' || sustainedAttack.origin === 'persistent-area') &&
        actor.classState.concentrationSpellId !== spell.id) ||
      (!sustainedSavingThrow && action.targetIds != null && (
        action.targetIds.length !== 1 || action.targetId !== action.targetIds[0]
      )) ||
      metamagic != null || action.empowered || action.draconicResistance || action.repellingBlast ||
      action.counterspellReaction != null ||
      (!sustainedSavingThrow && (
        action.legendaryResistanceTargetIds?.length ||
        action.savingThrowD20 != null || action.savingThrowD20Second != null ||
        action.savingThrowBlessRoll != null || action.savingThrowBaneRoll != null ||
        action.savingThrowRerollD20 != null || action.savingThrowRerollD20Second != null ||
        action.targetSavingThrows?.length
      )) ||
      action.forcedMovements?.length ||
      action.higherSlotDamageType != null || action.conditionChoice != null ||
      action.effectDamageType != null || action.enlargeReduceChoice != null ||
      action.enhanceAbilityChoice != null ||
      action.healingAllocations?.length || action.dispelMagicChecks?.length ||
      action.additionalEffectRolls?.length || action.delayedEffectRolls?.length ||
      action.sculptedTargetIds?.length || action.projectileTargetIds?.length ||
      action.targetAttacks?.length
    ))
  ) return fail(state, events, 'invalid-class-feature')
  if (
    legendaryResistanceTargetIds.length !== (action.legendaryResistanceTargetIds?.length ?? 0) ||
    legendaryResistanceTargetIds.some((targetId) => !requestedTargetIds.includes(targetId))
  ) return fail(state, events, 'invalid-class-feature')
  const legendaryResistanceTargetIdSet = new Set(legendaryResistanceTargetIds)
  const projectileTargetIds = action.projectileTargetIds ?? []
  const shieldSpellReactionTargetIds = action.shieldSpellReactionTargetIds ?? []
  if (dnd5eSpellAllowsRepeatedTargets(spell)) {
    const projectileCount = dnd5eSpellProjectileCount(spell, actor.level, action.slotLevel)
    const uniqueProjectileTargetIds = [...new Set(projectileTargetIds)]
    if (
      projectileCount == null || projectileTargetIds.length !== projectileCount ||
      action.targetId !== projectileTargetIds[0] ||
      uniqueProjectileTargetIds.length !== requestedTargetIds.length ||
      uniqueProjectileTargetIds.some((targetId) => !requestedTargetIds.includes(targetId))
    ) return fail(state, events, 'invalid-target')
    if (spell.id === 'magic-missile' && (
      new Set(shieldSpellReactionTargetIds).size !== shieldSpellReactionTargetIds.length ||
      shieldSpellReactionTargetIds.some((targetId) => !uniqueProjectileTargetIds.includes(targetId))
    )) return fail(state, events, 'invalid-target')
    if (spell.id !== 'magic-missile' && shieldSpellReactionTargetIds.length > 0) {
      return fail(state, events, 'invalid-target')
    }
  } else if (projectileTargetIds.length > 0) {
    return fail(state, events, 'invalid-target')
  } else if (shieldSpellReactionTargetIds.length > 0) {
    return fail(state, events, 'invalid-target')
  }
  if (action.shieldSpellReaction && !usesSpellAttackRoll) return fail(state, events, 'invalid-class-feature')
  if ((action.hurlThroughHellDamageRolls?.length ?? 0) > 0 && !usesSpellAttackRoll) {
    return fail(state, events, 'invalid-dice')
  }
  if ((action.forcedMovements?.length ?? 0) > 0 && spell.onFailedSaveEffect !== 'thunderwave-push') {
    return fail(state, events, 'invalid-class-feature')
  }
  if (actor.classState.wildShapeFormId && (spellcastingClassId !== 'druid' || spellcastingClassLevel < 18)) {
    return fail(state, events, 'invalid-class-feature')
  }
  const selectionKey = spell.level === 0
    ? 'spell-cantrips'
    : spellcasting.kind === 'full-known' || spellcasting.kind === 'half-known' || spellcasting.kind === 'pact'
      ? 'spell-known'
      : 'spell-prepared'
  const selectedByWizardFeature = spellcastingClassId === 'wizard' && (
    spellcastingSelections['spell-mastery-1']?.includes(spell.id) ||
    spellcastingSelections['spell-mastery-2']?.includes(spell.id) ||
    spellcastingSelections['signature-spells']?.includes(spell.id)
  )
  const selectedByMysticArcanum = spellcastingClassId === 'warlock' &&
    spellcastingSelections[`mystic-arcanum-${spell.level}`]?.includes(spell.id)
  const selectedByBardMagicalSecrets = spellcastingClassId === 'bard' && (
    spellcastingSelections['magical-secrets']?.includes(spell.id) ||
    spellcastingSelections['lore-additional-magical-secrets']?.includes(spell.id)
  )
  if (!spellcastingSelections[selectionKey]?.includes(spell.id) && !selectedByWizardFeature && !selectedByMysticArcanum && !selectedByBardMagicalSecrets) {
    return fail(state, events, 'invalid-class-feature')
  }
  // 反应法术只能从对应的触发事务进入，不能伪装成回合内主动施法。
  if (spell.castingTime === 'reaction') return fail(state, events, 'invalid-class-feature')
  const repellingBlast = action.repellingBlast === true
  if (
    repellingBlast &&
    (dnd5eCombatantClassLevel(actor, 'warlock') < 1 || spell.id !== 'eldritch-blast' ||
      !actor.classSelections['eldritch-invocations']?.includes('repelling-blast'))
  ) return fail(state, events, 'invalid-class-feature')
  if (targets.some((candidate) => sustainedAttack
    ? sustainedAttack.relation !== 'any' && actor.controller === candidate!.controller
    : spell.target === 'hostile'
    ? actor.controller === candidate!.controller
    : spell.target === 'ally'
      ? actor.controller !== candidate!.controller
      : false)) {
    return fail(state, events, 'invalid-target')
  }
  const normalizedCreatureTypeForSpell = (candidate: Dnd5eCombatant) =>
    (candidate.creatureType ?? '').trim().toLowerCase()
  const isUndeadOrConstructForSpell = (candidate: Dnd5eCombatant) => {
    const type = normalizedCreatureTypeForSpell(candidate)
    return type === 'undead' || type.includes('亡灵') || type === 'construct' || type.includes('构装')
  }
  if (
    ((spell.id === 'false-life' || spell.id === 'blur' || spell.id === 'divine-favor' ||
      spell.id === 'shillelagh' || spell.id === 'see-invisibility') && target.id !== actor.id) ||
    (spell.id === 'spare-the-dying' && (
      target.currentHp !== 0 || target.deathSaves.dead || isUndeadOrConstructForSpell(target)
    )) ||
    ((spell.id === 'hold-person' || spell.id === 'charm-person') && targets.some((candidate) =>
      !dnd5eCharmPersonEligibleCreatureType(normalizedCreatureTypeForSpell(candidate!))
    )) ||
    (spell.id === 'hideous-laughter' && targets.some((candidate) => candidate!.abilities.int <= 4)) ||
    (spell.id === 'hold-monster' && targets.some((candidate) => {
      const type = normalizedCreatureTypeForSpell(candidate!)
      return type === 'undead' || type.includes('亡灵')
    }))
  ) return fail(state, events, 'invalid-target')
  if (
    spell.id === 'shillelagh' &&
    actor.mainWeaponId !== 'dnd5e-club' &&
    actor.mainWeaponId !== 'dnd5e-quarterstaff'
  ) return fail(state, events, 'invalid-class-feature')
  if (
    spell.id === 'magic-weapon' &&
    (!target.mainWeaponId || target.mainWeaponMagical)
  ) return fail(state, events, 'invalid-target')
  if (
    (spell.conditionOptions?.length && (!action.conditionChoice || !spell.conditionOptions.includes(action.conditionChoice))) ||
    (!spell.conditionOptions?.length && action.conditionChoice != null)
  ) return fail(state, events, 'invalid-class-feature')
  if (
    (spell.effectDamageTypeOptions?.length && (!action.effectDamageType || !spell.effectDamageTypeOptions.includes(action.effectDamageType))) ||
    (!spell.effectDamageTypeOptions?.length && action.effectDamageType != null)
  ) return fail(state, events, 'invalid-class-feature')
  if (
    (spell.enlargeReduceOptions?.length &&
      (!action.enlargeReduceChoice || !spell.enlargeReduceOptions.includes(action.enlargeReduceChoice))) ||
    (!spell.enlargeReduceOptions?.length && action.enlargeReduceChoice != null)
  ) return fail(state, events, 'invalid-class-feature')
  if (
    (spell.enhanceAbilityOptions?.length &&
      (!action.enhanceAbilityChoice || !spell.enhanceAbilityOptions.includes(action.enhanceAbilityChoice))) ||
    (!spell.enhanceAbilityOptions?.length && action.enhanceAbilityChoice != null)
  ) return fail(state, events, 'invalid-class-feature')
  const healingAllocations = action.healingAllocations ?? []
  if (spell.effect === 'healing-pool') {
    if (
      healingAllocations.length !== requestedTargetIds.length ||
      new Set(healingAllocations.map((allocation) => allocation.targetId)).size !== healingAllocations.length ||
      healingAllocations.some((allocation) =>
        !requestedTargetIds.includes(allocation.targetId) || !Number.isInteger(allocation.amount) || allocation.amount <= 0
      ) ||
      healingAllocations.reduce((sum, allocation) => sum + allocation.amount, 0) > (spell.healingPool ?? 0)
    ) return fail(state, events, 'invalid-class-feature')
  } else if (healingAllocations.length > 0) return fail(state, events, 'invalid-class-feature')
  const suppliedSculptedTargetIds = action.sculptedTargetIds ?? []
  const sculptedTargetIds = [...new Set(suppliedSculptedTargetIds)]
  if (
    sculptedTargetIds.length !== suppliedSculptedTargetIds.length ||
    (!dnd5eCanSculptSpell({ ...actor, classId: spellcastingClassId, subclassId: actor.subclassIds?.[spellcastingClassId], level: spellcastingClassLevel }, spell) && sculptedTargetIds.length > 0) ||
    sculptedTargetIds.length > dnd5eSculptSpellMaximumTargets(spell) ||
    sculptedTargetIds.some((targetId) => targetId === actor.id || !requestedTargetIds.includes(targetId))
  ) return fail(state, events, 'invalid-class-feature')
  const sculptedTargetIdSet = new Set(sculptedTargetIds)
  const suppliedCarefulTargetIds = metamagic?.carefulTargetIds ?? []
  const carefulTargetIds = [...new Set(suppliedCarefulTargetIds)]
  if (metamagic) {
    if (
      dnd5eCombatantClassLevel(actor, 'sorcerer') < 3 ||
      !actor.classSelections.metamagic?.includes(metamagic.kind) ||
      !dnd5eMetamagicAvailableForSpell(metamagic.kind, spell, action.slotLevel)
    ) return fail(state, events, 'invalid-class-feature')
  }
  const empoweredRequested = action.empowered === true
  const empoweredRerolls = action.empoweredRerolls ?? []
  const empoweredUsed = empoweredRerolls.length > 0
  if (
    (empoweredRequested && (
      dnd5eCombatantClassLevel(actor, 'sorcerer') < 3 ||
      !actor.classSelections.metamagic?.includes('empowered') ||
      !dnd5eCanEmpowerSpell(spell)
    )) ||
    (!empoweredRequested && empoweredUsed)
  ) return fail(state, events, 'invalid-class-feature')
  const draconicResistance = action.draconicResistance === true
  const contextualCaster = {
    ...actor,
    classId: spellcastingClassId,
    subclassId: actor.subclassIds?.[spellcastingClassId],
    level: spellcastingClassLevel,
    classSelections: spellcastingSelections,
  }
  const draconicResistanceType = dnd5eDraconicElementalResistanceType(contextualCaster, spell)
  const totalSorceryPointCost = (metamagic ? dnd5eMetamagicCost(metamagic.kind, action.slotLevel) : 0) +
    (empoweredUsed ? 1 : 0) +
    (draconicResistance ? 1 : 0)
  const sorceryPoints = actor.classResources['dnd5e-sorcery-points']
  if (
    (draconicResistance && !draconicResistanceType) ||
    (totalSorceryPointCost > 0 && (!sorceryPoints || sorceryPoints.current < totalSorceryPointCost))
  ) return fail(state, events, 'invalid-class-feature')
  if (
    carefulTargetIds.length !== suppliedCarefulTargetIds.length ||
    (metamagic?.kind === 'careful' && carefulTargetIds.length < 1) ||
    (metamagic?.kind !== 'careful' && carefulTargetIds.length > 0) ||
    carefulTargetIds.length > dnd5eCarefulSpellMaximumTargets(actor.abilities.cha) ||
    carefulTargetIds.some((targetId) => targetId === actor.id || !requestedTargetIds.includes(targetId))
  ) return fail(state, events, 'invalid-class-feature')
  const carefulTargetIdSet = new Set(carefulTargetIds)
  const heightenedTargetId = metamagic?.heightenedTargetId
  if (
    (metamagic?.kind === 'heightened' && (!heightenedTargetId || !requestedTargetIds.includes(heightenedTargetId))) ||
    (metamagic?.kind !== 'heightened' && heightenedTargetId != null)
  ) return fail(state, events, 'invalid-class-feature')
  if (
    ['healing', 'fixed-healing', 'healing-pool'].includes(spell.effect) &&
    targets.some((candidate) => isUndeadOrConstructForSpell(candidate!))
  ) return fail(state, events, 'invalid-target')

  const slotKey = spellcasting.kind === 'pact' && spell.level <= 5 ? 'dnd5e-pact-slot' : `dnd5e-spell-slot-${action.slotLevel}`
  const freeCastSource = sustainedAttack ? undefined : dnd5eFreeSpellCastSource(contextualCaster, spell, action.slotLevel)
  if (sustainedAttack) {
    if (!Number.isInteger(action.slotLevel) || action.slotLevel < spell.level || action.slotLevel > 9) {
      return fail(state, events, 'invalid-class-feature')
    }
  } else if (spell.level === 0) {
    if (action.slotLevel !== 0) return fail(state, events, 'invalid-class-feature')
  } else {
    const slot = actor.classResources[slotKey]
    const invalidPactLevel = spellcasting.kind === 'pact' && (
      freeCastSource?.kind === 'mystic-arcanum'
        ? action.slotLevel !== spell.level
        : action.slotLevel !== dnd5ePactSlotLevel(spellcastingClassLevel)
    )
    if (
      !Number.isInteger(action.slotLevel) || action.slotLevel < spell.level || invalidPactLevel ||
      (!freeCastSource && (!slot || slot.current < 1))
    ) {
      return fail(state, events, 'class-resource-unavailable')
    }
  }

  const overchannel = action.overchannel === true
  if (overchannel && !dnd5eCanOverchannelSpell(contextualCaster, spell, action.slotLevel)) {
    return fail(state, events, 'invalid-class-feature')
  }
  if (overchannel && (action.cuttingWordsDamage || action.targetAttacks?.some((attack) => attack.cuttingWordsDamage))) {
    return fail(state, events, 'invalid-class-feature')
  }
  const overchannelUses = Math.max(0, Math.floor(actor.classState.overchannelUsesSinceLongRest ?? 0))
  const overchannelSelfDamageDiceCount = overchannel && overchannelUses > 0
    ? (overchannelUses + 1) * action.slotLevel
    : 0
  const overchannelSelfDamageRolls = action.overchannelSelfDamageRolls ?? []
  const additionalEffectRolls = action.additionalEffectRolls ?? []
  if (
    (overchannel && (action.effectRolls.length > 0 || additionalEffectRolls.length > 0)) ||
    (!overchannel && overchannelSelfDamageRolls.length > 0) ||
    overchannelSelfDamageRolls.length !== overchannelSelfDamageDiceCount ||
    overchannelSelfDamageRolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > 12)
  ) return fail(state, events, 'invalid-dice')
  const empoweredMaximumDice = Math.max(1, rules.abilityModifier(actor.abilities.cha))
  const empoweredRerollKeys = empoweredRerolls.map((reroll) =>
    `${reroll.group}:${reroll.targetId ?? ''}:${reroll.attackIndex ?? ''}:${reroll.dieIndex}`,
  )
  if (
    (empoweredRequested && overchannel) ||
    empoweredRerolls.length > empoweredMaximumDice ||
    new Set(empoweredRerollKeys).size !== empoweredRerollKeys.length ||
    empoweredRerolls.some((reroll) => {
      if (!Number.isInteger(reroll.dieIndex) || reroll.dieIndex < 0 ||
        !Number.isInteger(reroll.reroll) || reroll.reroll < 1 || reroll.reroll > spell.dice.sides) return true
      if (reroll.group === 'effect') {
        return reroll.targetId != null || reroll.attackIndex != null || reroll.dieIndex >= action.effectRolls.length
      }
      if (!reroll.targetId) return true
      const targetAttack = reroll.attackIndex == null
        ? action.targetAttacks?.find((attack) => attack.targetId === reroll.targetId)
        : action.targetAttacks?.[reroll.attackIndex]
      if (targetAttack?.targetId !== reroll.targetId) return true
      return !targetAttack || reroll.dieIndex >= targetAttack.effectRolls.length
    })
  ) return fail(state, events, 'invalid-dice')

  const effectiveCastingTime = sustainedAttack
    ? sustainedAttack.economy
    : metamagic?.kind === 'quickened' ? 'bonus-action' : spell.castingTime
  const turnKey = classFeatureTurnKey(state, actor.id)
  if (!sustainedAttack && (
    (effectiveCastingTime === 'bonus-action' && actor.classState.leveledSpellTurnKey === turnKey) ||
    (effectiveCastingTime === 'action' && spell.level > 0 && actor.classState.bonusActionSpellTurnKey === turnKey)
  )) return fail(state, events, 'invalid-class-feature')

  const resource: TurnResource = effectiveCastingTime === 'bonus-action' ? 'bonusAction' : 'action'
  if (!spend(actor, resource)) return fail(state, events, resource === 'bonusAction' ? 'bonus-action-unavailable' : 'action-unavailable')
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource })
  if (spell.level > 0 && !sustainedAttack) {
    if (freeCastSource?.resourceKey) spendClassResource(actor, freeCastSource.resourceKey, events)
    else if (!freeCastSource) spendClassResource(actor, slotKey, events)
    if (freeCastSource) {
      events.push({
        type: 'class-state-changed', actorId: actor.id,
        stateKey: freeCastSource.kind, active: true,
      })
    }
  }
  if (metamagic) {
    spendClassResource(actor, 'dnd5e-sorcery-points', events, dnd5eMetamagicCost(metamagic.kind, action.slotLevel))
    events.push({ type: 'metamagic-applied', actorId: actor.id, spellId: spell.id, kind: metamagic.kind })
  }
  if (empoweredUsed) {
    spendClassResource(actor, 'dnd5e-sorcery-points', events, 1)
    events.push({ type: 'metamagic-applied', actorId: actor.id, spellId: spell.id, kind: 'empowered' })
  }
  if (!sustainedAttack && effectiveCastingTime === 'bonus-action') actor.classState.bonusActionSpellTurnKey = turnKey
  if (!sustainedAttack && spell.level > 0) actor.classState.leveledSpellTurnKey = turnKey
  const castingWhileUnseen = dnd5eAttackerIsUnseen(actor)
  if (!sustainedAttack) {
    emitDnd5eSpellCast(state, {
      type: 'spell-cast', actorId: actor.id, targetId: target.id,
      spellId: spell.id, slotLevel: action.slotLevel,
    }, events)
    if (spell.target === 'hostile') {
      for (const affectedTarget of targets) {
        if (affectedTarget) endCharmPersonForHarmfulAction(state, actor, affectedTarget, events)
      }
    }
  }
  const suppliedDamageCuttingWordsCount = (action.cuttingWordsDamage ? 1 : 0) +
    (action.targetAttacks?.filter((attack) => attack.cuttingWordsDamage).length ?? 0)
  let consumedDamageCuttingWordsCount = 0
  const consumeSpellDamageCuttingWords = (use: Dnd5eCuttingWordsUse | undefined) => {
    const reduction = consumeCuttingWords(state, actor, use, events)
    if (use && reduction != null) consumedDamageCuttingWordsCount += 1
    return reduction
  }
  const finishSpellCast = (): Dnd5eActionResult => {
    if (consumedDamageCuttingWordsCount !== suppliedDamageCuttingWordsCount) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!sustainedAttack && spell.sustainedAttack?.origin === 'persistent-area') {
      if (actor.classState.concentrationSpellId !== spell.id) {
        beginDnd5eConcentration(state, actor, spell.id, [], concentrationDurationRounds, events, action.slotLevel)
      }
      applyDnd5eMechanicalStatusEffect(actor, actor, {
        definitionId: `srd-5.1:spell:${spell.id}`,
        rulesId: spell.id,
        label: `${spell.name}：可再次激活`,
        duration: {
          type: 'concentration',
          sourceActorId: actor.id,
          concentrationId: spell.id,
        },
        appliedTurnKey: turnKey,
        spellLevel: action.slotLevel,
        potency: action.slotLevel,
        stackingPolicy: 'replace',
        stackingKey: `sustained-spell:${spell.id}`,
      }, events)
    }
    if (
      !sustainedAttack &&
      spell.sustainedAttack?.origin === 'effect-token' &&
      spell.sustainedAttack.effectDurationRounds &&
      sustainedEffectAreaId
    ) {
      applyDnd5eMechanicalStatusEffect(actor, actor, {
        definitionId: `srd-5.1:spell:${spell.id}`,
        rulesId: spell.id,
        label: `${spell.name}：场上法术实体可再次攻击`,
        duration: {
          type: 'rounds',
          remainingRounds: spell.sustainedAttack.effectDurationRounds,
          tickOn: 'target-turn-end',
        },
        appliedTurnKey: turnKey,
        spellLevel: action.slotLevel,
        potency: action.slotLevel,
        stackingPolicy: 'stack',
        stackingKey: sustainedEffectAreaId,
        instanceKey: sustainedEffectAreaId,
      }, events)
    }
    if (draconicResistance && draconicResistanceType) {
      spendClassResource(actor, 'dnd5e-sorcery-points', events, 1)
      actor.classState.draconicResistanceType = draconicResistanceType
      actor.classState.draconicResistanceRoundsRemaining = 600
      events.push({
        type: 'damage-resistance-gained', actorId: actor.id,
        damageType: draconicResistanceType, source: 'draconic-elemental-affinity', rounds: 600,
      })
    }
    if (overchannel) {
      const nextUses = overchannelUses + 1
      actor.classState.overchannelUsesSinceLongRest = nextUses
      events.push({
        type: 'class-state-changed', actorId: actor.id,
        stateKey: 'overchannel', active: true, value: nextUses,
      })
      if (overchannelSelfDamageDiceCount > 0) {
        const backlash = rules.resolveDamage({
          count: overchannelSelfDamageDiceCount,
          sides: 12,
          bonus: 0,
          rolls: overchannelSelfDamageRolls,
        })
        applyDamage(actor, backlash.total, false, events, actor, state, ['force'])
      }
    }
    return { ok: true, state, events }
  }
  if (sustainedAttack && action.counterspellReaction) return fail(state, events, 'invalid-class-feature')
  if (!sustainedAttack) {
    const counterspell = applyCounterspellReaction({
      state,
      caster: actor,
      spellId: spell.id,
      spellLevel: action.slotLevel,
      reaction: action.counterspellReaction,
      events,
    })
    if (!counterspell) return fail(state, events, 'invalid-class-feature')
    if (counterspell.success) return { ok: true, state, events }
  }
  const attackingFromHidden = usesSpellAttackRoll && actor.classState.hiddenCheckTotal != null
  if (attackingFromHidden) {
    actor.classState.hiddenCheckTotal = undefined
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hidden', active: false })
  }
  const allowedHostileTargetIds = new Set(requestedTargetIds)
  const includeNatureSanctuary = usesSpellAttackRoll
  if (spell.target === 'hostile' || sustainedAttack) {
    endTranquilityForHostileAction(actor, events, 'casts-spell')
    if (spell.effect !== 'attack-save-debuff' && requestedTargetIds.length > 1) {
      if (action.tranquilitySave) return fail(state, events, 'invalid-dice')
      const wardedTargets = targets.filter((candidate) =>
        !!dnd5eTranquilityWardCheck(actor, candidate!, state, includeNatureSanctuary),
      )
      const suppliedWardSaves = action.targetTranquilitySaves ?? []
      if (
        suppliedWardSaves.length !== wardedTargets.length ||
        new Set(suppliedWardSaves.map((roll) => roll.targetId)).size !== suppliedWardSaves.length ||
        suppliedWardSaves.some((roll) => !wardedTargets.some((candidate) => candidate!.id === roll.targetId))
      ) return fail(state, events, 'invalid-dice')
      try {
        for (const affectedTarget of wardedTargets) {
          const suppliedWard = suppliedWardSaves.find((roll) => roll.targetId === affectedTarget!.id)
          if (!passesTranquilityWard(state, actor, affectedTarget!, suppliedWard?.save, events, includeNatureSanctuary)) {
            allowedHostileTargetIds.delete(affectedTarget!.id)
          }
        }
      } catch {
        return fail(state, events, 'invalid-dice')
      }
    } else if (spell.effect !== 'attack-save-debuff') {
      try {
        if (!passesTranquilityWard(state, actor, target, action.tranquilitySave, events, includeNatureSanctuary)) return finishSpellCast()
      } catch {
        return fail(state, events, 'invalid-dice')
      }
    }
  }
  if (
    action.protectionReactionActorId &&
    (!usesSpellAttackRoll || !spendProtectionReaction(state, actor, target, action.protectionReactionActorId, events))
  ) return fail(state, events, 'invalid-class-feature')

  const baseConcentrationDurationRounds = dnd5eSpellConcentrationDurationRounds(spell, action.slotLevel)
  const concentrationDurationRounds = metamagic?.kind === 'extended'
    ? Math.min(14_400, baseConcentrationDurationRounds * 2)
    : baseConcentrationDurationRounds

  if (spell.effect === 'persistent-area') {
    if (action.effectRolls.length > 0 || requestedTargetIds.length > 0) {
      return fail(state, events, 'invalid-dice')
    }
    if (spell.concentration) {
      beginDnd5eConcentration(state, actor, spell.id, [], concentrationDurationRounds, events, action.slotLevel)
    }
    events.push({
      type: 'class-state-changed', actorId: actor.id,
      stateKey: `persistent-area:${spell.id}`, active: true,
    })
    return finishSpellCast()
  }

  if (spell.effect === 'teleport') {
    if (!teleportDestination || action.effectRolls.length > 0) {
      return fail(state, events, 'invalid-dice')
    }
    const from = { ...actor.position }
    const fromElevationFeet = actor.elevationFeet ?? 0
    const toElevationFeet = teleportDestination.toElevationFeet ?? fromElevationFeet
    actor.position = { ...teleportDestination.to }
    actor.elevationFeet = toElevationFeet
    actor.airborne = toElevationFeet > 0 && actor.airborne
    events.push({
      type: 'teleported',
      actorId: actor.id,
      spellId: spell.id,
      from,
      to: actor.position,
      distanceFeet: teleportDestination.distanceFeet,
      fromElevationFeet,
      toElevationFeet,
    })
    return finishSpellCast()
  }

  if (spell.effect === 'dispel-magic') {
    if (action.effectRolls.length > 0 || requestedTargetIds.length !== 1) return fail(state, events, 'invalid-dice')
    const spellEffects = new Map<string, { spellId: string; spellLevel: number; effectId: string; sourceActorId?: string }>()
    for (const effect of target.classState.activeEffects ?? []) {
      if (effect.source.kind !== 'spell' || !effect.source.rulesId) continue
      const catalog = getDnd5eSrdSpellCatalogEntry(effect.source.rulesId)
      if (!catalog) continue
      const key = `${effect.source.actorId ?? 'unknown'}\u0000${catalog.id}`
      if (!spellEffects.has(key)) {
        spellEffects.set(key, {
          spellId: catalog.id,
          spellLevel: effect.source.spellLevel ?? catalog.level,
          effectId: effect.id,
          sourceActorId: effect.source.actorId,
        })
      }
    }
    for (const [sourceActorId, spellId] of Object.entries(target.classState.concentrationEffectsBySource ?? {})) {
      const catalog = getDnd5eSrdSpellCatalogEntry(spellId)
      if (!catalog) continue
      const key = `${sourceActorId}\u0000${catalog.id}`
      if (!spellEffects.has(key)) {
        const source = state.combatants[sourceActorId]
        spellEffects.set(key, {
          spellId: catalog.id,
          spellLevel: source?.classState.concentrationSpellId === catalog.id
            ? source.classState.concentrationSpellLevel ?? catalog.level
            : catalog.level,
          effectId: `concentration:${sourceActorId}:${catalog.id}`,
          sourceActorId,
        })
      }
    }
    const higherLevelEffects = [...spellEffects.values()].filter((entry) => entry.spellLevel > action.slotLevel)
    const suppliedChecks = action.dispelMagicChecks ?? []
    if (
      suppliedChecks.length !== higherLevelEffects.length ||
      new Set(suppliedChecks.map((check) => check.effectId)).size !== suppliedChecks.length ||
      suppliedChecks.some((check) => !higherLevelEffects.some((entry) => entry.effectId === check.effectId))
    ) return fail(state, events, 'invalid-dice')
    const castingModifier = rules.abilityModifier(actor.abilities[spellcasting.ability])
    for (const entry of spellEffects.values()) {
      const check = suppliedChecks.find((candidate) => candidate.effectId === entry.effectId)
      if (check && (!Number.isInteger(check.d20) || check.d20 < 1 || check.d20 > 20)) {
        return fail(state, events, 'invalid-dice')
      }
      const dc = entry.spellLevel > action.slotLevel ? 10 + entry.spellLevel : undefined
      const total = check ? check.d20 + castingModifier : undefined
      const success = dc == null || (total ?? 0) >= dc
      if (success) {
        const source = entry.sourceActorId ? state.combatants[entry.sourceActorId] : undefined
        const endedConcentrationTarget = source
          ? endDnd5eSpellEffectOnTarget(state, source, target, entry.spellId, events)
          : false
        if (!endedConcentrationTarget) {
          removeDnd5eEffectsByPredicate(
            target,
            (effect) => effect.source.kind === 'spell' && effect.source.rulesId === entry.spellId &&
              effect.source.actorId === entry.sourceActorId,
            'dm',
            events,
          )
        }
      }
      events.push({
        type: 'spell-dispelled', actorId: actor.id, targetId: target.id,
        spellId: entry.spellId, spellLevel: entry.spellLevel, effectId: entry.effectId,
        dc, total, success,
      })
    }
    return finishSpellCast()
  }

  if (spell.effect === 'mark') {
    if (action.effectRolls.length > 0) return fail(state, events, 'invalid-dice')
    beginDnd5eConcentration(
      state,
      actor,
      spell.id,
      [target.id],
      concentrationDurationRounds,
      events,
      action.slotLevel,
    )
    actor.classState.huntersMarkTargetId = target.id
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hunters-mark', active: true, targetId: target.id })
    return finishSpellCast()
  }

  if (spell.effect === 'armor-class-buff') {
    if (!spell.concentration || action.effectRolls.length > 0) return fail(state, events, 'invalid-dice')
    beginDnd5eConcentration(
      state,
      actor,
      spell.id,
      [target.id],
      concentrationDurationRounds,
      events,
      action.slotLevel,
    )
    events.push({ type: 'class-state-changed', actorId: actor.id, targetId: target.id, stateKey: spell.id, active: true })
    return finishSpellCast()
  }

  if (spell.effect === 'attack-save-buff') {
    if (!spell.concentration || action.effectRolls.length > 0) return fail(state, events, 'invalid-dice')
    beginDnd5eConcentration(
      state,
      actor,
      spell.id,
      requestedTargetIds,
      concentrationDurationRounds,
      events,
      action.slotLevel,
    )
    for (const affected of targets) {
      events.push({ type: 'class-state-changed', actorId: actor.id, targetId: affected!.id, stateKey: spell.id, active: true })
    }
    return finishSpellCast()
  }

  if (spell.effect === 'attack-save-debuff') {
    if (!spell.concentration || !spell.saveAbility || action.effectRolls.length > 0) {
      return fail(state, events, 'invalid-dice')
    }
    if (action.tranquilitySave) return fail(state, events, 'invalid-dice')
    const wardedTargets = targets.filter((candidate) =>
      !!dnd5eTranquilityWardCheck(actor, candidate!, state, false),
    )
    const suppliedWardSaves = action.targetTranquilitySaves ?? []
    if (
      suppliedWardSaves.length !== wardedTargets.length ||
      new Set(suppliedWardSaves.map((roll) => roll.targetId)).size !== suppliedWardSaves.length ||
      suppliedWardSaves.some((roll) => !wardedTargets.some((candidate) => candidate!.id === roll.targetId))
    ) return fail(state, events, 'invalid-dice')
    const allowedTargetIds = new Set<string>()
    try {
      for (const affectedTarget of targets) {
        const suppliedWard = suppliedWardSaves.find((roll) => roll.targetId === affectedTarget!.id)
        if (!dnd5eTranquilityWardCheck(actor, affectedTarget!, state, false) ||
          passesTranquilityWard(state, actor, affectedTarget!, suppliedWard?.save, events, false)) {
          allowedTargetIds.add(affectedTarget!.id)
        }
      }
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const suppliedSaves = action.targetSavingThrows ?? []
    if (
      suppliedSaves.length !== targets.length ||
      new Set(suppliedSaves.map((roll) => roll.targetId)).size !== suppliedSaves.length ||
      suppliedSaves.some((roll) => !requestedTargetIds.includes(roll.targetId))
    ) return fail(state, events, 'invalid-dice')
    const affectedTargetIds: string[] = []
    try {
      for (const affectedTarget of targets) {
        if (!allowedTargetIds.has(affectedTarget!.id)) continue
        const supplied = suppliedSaves.find((roll) => roll.targetId === affectedTarget!.id)!
        const saveMode = dnd5eHeightenedSavingThrowMode(
          dnd5eSavingThrowMode(affectedTarget!, spell.saveAbility, {
            effectVisible: true, sourceCreatureType: actor.creatureType, sourceIsSpell: true,
          }),
          heightenedTargetId === affectedTarget!.id,
        )
        const rolls = saveMode === 'normal'
          ? [supplied.d20]
          : [supplied.d20, supplied.d20Second ?? 0]
        const baseModifier = affectedTarget!.savingThrowBonuses[spell.saveAbility] ??
          rules.abilityModifier(affectedTarget!.abilities[spell.saveAbility])
        const saveModifier = baseModifier + resolveDnd5eBlessRoll(state, affectedTarget!, supplied.blessRoll) -
          resolveDnd5eBaneRoll(state, affectedTarget!, supplied.baneRoll)
        const dc = 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities[spellcasting.ability])
        const save = resolveSavingThrowWithClassReroll({
          combatant: affectedTarget!,
          ability: spell.saveAbility,
          rolls,
          rerollD20: supplied.rerollD20,
          rerollD20Second: supplied.rerollD20Second,
          bardicInspirationRoll: supplied.bardicInspirationRoll,
          darkOnesOwnLuckRoll: supplied.darkOnesOwnLuckRoll,
          mode: saveMode,
          modifier: saveModifier,
          dc,
          events,
          legendaryResistance: legendaryResistanceTargetIdSet.has(affectedTarget!.id),
        })
        events.push({
          type: 'saving-throw-resolved', targetId: affectedTarget!.id, ability: spell.saveAbility,
          d20: save.roll.d20, modifier: saveModifier, total: save.roll.total, dc, success: save.success,
        })
        if (!save.success) affectedTargetIds.push(affectedTarget!.id)
      }
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    beginDnd5eConcentration(
      state,
      actor,
      spell.id,
      affectedTargetIds,
      concentrationDurationRounds,
      events,
      action.slotLevel,
    )
    for (const affectedTargetId of affectedTargetIds) {
      events.push({ type: 'class-state-changed', actorId: actor.id, targetId: affectedTargetId, stateKey: spell.id, active: true })
    }
    return finishSpellCast()
  }

  if (spell.effect === 'active-effect' && !sustainedAttack) {
    const enhanceAbilityTempHp = spell.appliedEffect === 'enhance-ability' &&
      action.enhanceAbilityChoice === 'bear-endurance'
    const expectedEffectRolls = enhanceAbilityTempHp ? 2 : 0
    if (
      !spell.appliedEffect ||
      action.effectRolls.length !== expectedEffectRolls ||
      action.effectRolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > 6) ||
      additionalEffectRolls.length > 0 || (action.delayedEffectRolls?.length ?? 0) > 0
    ) return fail(state, events, 'invalid-dice')
    if (spell.appliedEffect === 'mage-armor' && targets.some((candidate) => candidate!.wearingArmor)) {
      return fail(state, events, 'invalid-target')
    }
    const affectedTargetIds = new Set(requestedTargetIds)
    const unwillingTargets = spell.unwillingSaveAbility
      ? targets.filter((candidate): candidate is Dnd5eCombatant =>
          candidate != null && candidate.controller !== actor.controller,
        )
      : []
    if (spell.unwillingSaveAbility) {
      const ability = spell.unwillingSaveAbility
      const dc = 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities[spellcasting.ability])
      if (
        legendaryResistanceTargetIds.some((targetId) => !unwillingTargets.some((candidate) => candidate.id === targetId))
      ) return fail(state, events, 'invalid-class-feature')
      try {
        if (requestedTargetIds.length === 1 && unwillingTargets.length === 1) {
          if ((action.targetSavingThrows?.length ?? 0) > 0) return fail(state, events, 'invalid-dice')
          const affectedTarget = unwillingTargets[0]
          const saveMode = dnd5eHeightenedSavingThrowMode(
            dnd5eSavingThrowMode(affectedTarget, ability, {
              effectVisible: true, sourceCreatureType: actor.creatureType, sourceIsSpell: true,
            }),
            heightenedTargetId === affectedTarget.id,
          )
          const rolls = saveMode === 'normal'
            ? [action.savingThrowD20 ?? 0]
            : [action.savingThrowD20 ?? 0, action.savingThrowD20Second ?? 0]
          const modifier = (affectedTarget.savingThrowBonuses[ability] ??
            rules.abilityModifier(affectedTarget.abilities[ability])) +
            resolveDnd5eBlessRoll(state, affectedTarget, action.savingThrowBlessRoll) -
            resolveDnd5eBaneRoll(state, affectedTarget, action.savingThrowBaneRoll)
          const save = resolveSavingThrowWithClassReroll({
            combatant: affectedTarget,
            ability,
            rolls,
            rerollD20: action.savingThrowRerollD20,
            rerollD20Second: action.savingThrowRerollD20Second,
            bardicInspirationRoll: action.bardicInspirationRoll,
            darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
            mode: saveMode,
            modifier,
            dc,
            events,
            legendaryResistance: legendaryResistanceTargetIdSet.has(affectedTarget.id),
          })
          events.push({
            type: 'saving-throw-resolved', targetId: affectedTarget.id, ability,
            d20: save.roll.d20, modifier, total: save.roll.total, dc, success: save.success,
          })
          if (save.success) affectedTargetIds.delete(affectedTarget.id)
        } else if (requestedTargetIds.length > 1) {
          if (
            action.savingThrowD20 != null || action.savingThrowD20Second != null ||
            action.savingThrowBlessRoll != null || action.savingThrowBaneRoll != null ||
            action.savingThrowRerollD20 != null || action.savingThrowRerollD20Second != null ||
            action.bardicInspirationRoll != null || action.darkOnesOwnLuckRoll != null
          ) return fail(state, events, 'invalid-dice')
          const suppliedSaves = action.targetSavingThrows ?? []
          if (
            suppliedSaves.length !== unwillingTargets.length ||
            new Set(suppliedSaves.map((roll) => roll.targetId)).size !== suppliedSaves.length ||
            suppliedSaves.some((roll) => !unwillingTargets.some((candidate) => candidate.id === roll.targetId))
          ) return fail(state, events, 'invalid-dice')
          for (const affectedTarget of unwillingTargets) {
            const supplied = suppliedSaves.find((roll) => roll.targetId === affectedTarget.id)!
            const saveMode = dnd5eHeightenedSavingThrowMode(
              dnd5eSavingThrowMode(affectedTarget, ability, {
                effectVisible: true, sourceCreatureType: actor.creatureType, sourceIsSpell: true,
              }),
              heightenedTargetId === affectedTarget.id,
            )
            const rolls = saveMode === 'normal'
              ? [supplied.d20]
              : [supplied.d20, supplied.d20Second ?? 0]
            const modifier = (affectedTarget.savingThrowBonuses[ability] ??
              rules.abilityModifier(affectedTarget.abilities[ability])) +
              resolveDnd5eBlessRoll(state, affectedTarget, supplied.blessRoll) -
              resolveDnd5eBaneRoll(state, affectedTarget, supplied.baneRoll)
            const save = resolveSavingThrowWithClassReroll({
              combatant: affectedTarget,
              ability,
              rolls,
              rerollD20: supplied.rerollD20,
              rerollD20Second: supplied.rerollD20Second,
              bardicInspirationRoll: supplied.bardicInspirationRoll,
              darkOnesOwnLuckRoll: supplied.darkOnesOwnLuckRoll,
              mode: saveMode,
              modifier,
              dc,
              events,
              legendaryResistance: legendaryResistanceTargetIdSet.has(affectedTarget.id),
            })
            events.push({
              type: 'saving-throw-resolved', targetId: affectedTarget.id, ability,
              d20: save.roll.d20, modifier, total: save.roll.total, dc, success: save.success,
            })
            if (save.success) affectedTargetIds.delete(affectedTarget.id)
          }
        } else if (
          action.savingThrowD20 != null || action.savingThrowD20Second != null ||
          action.savingThrowBlessRoll != null || action.savingThrowBaneRoll != null ||
          action.savingThrowRerollD20 != null || action.savingThrowRerollD20Second != null ||
          action.bardicInspirationRoll != null || action.darkOnesOwnLuckRoll != null ||
          (action.targetSavingThrows?.length ?? 0) > 0
        ) return fail(state, events, 'invalid-dice')
      } catch {
        return fail(state, events, 'invalid-dice')
      }
    } else if (
      action.savingThrowD20 != null || action.savingThrowD20Second != null ||
      action.savingThrowBlessRoll != null || action.savingThrowBaneRoll != null ||
      action.savingThrowRerollD20 != null || action.savingThrowRerollD20Second != null ||
      action.bardicInspirationRoll != null || action.darkOnesOwnLuckRoll != null ||
      (action.targetSavingThrows?.length ?? 0) > 0
    ) return fail(state, events, 'invalid-dice')
    if (spell.concentration) {
      beginDnd5eConcentration(
        state,
        actor,
        spell.id,
        [...affectedTargetIds],
        concentrationDurationRounds,
        events,
        action.slotLevel,
      )
    }
    for (const affectedTarget of targets) {
      const affected = affectedTarget!
      if (!affectedTargetIds.has(affected.id)) continue
      const duration: Dnd5eActiveEffectDuration = spell.concentration
        ? {
            type: 'concentration', sourceActorId: actor.id,
            concentrationId: spell.id, remainingRounds: concentrationDurationRounds,
          }
        : {
            type: 'rounds',
            remainingRounds: metamagic?.kind === 'extended'
              ? Math.min(14_400, Math.max(1, spell.effectDurationRounds ?? 1) * 2)
              : Math.max(1, spell.effectDurationRounds ?? 1),
            tickOn: 'target-turn-end',
          }
      if (spell.appliedEffect === 'invisibility' || spell.appliedEffect === 'greater-invisibility') {
        applyDnd5eStandardConditionEffect(affected, actor, {
          id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:invisible`, actor.id, affected.id),
          rulesId: spell.id,
          appliedTurnKey: classFeatureTurnKey(state, actor.id),
          spellLevel: action.slotLevel,
          condition: 'invisible',
          duration,
          breakOn: spell.appliedEffect === 'invisibility' ? ['makes-attack', 'casts-spell'] : undefined,
        }, events)
      } else {
        if (spell.appliedEffect === 'protection-from-poison') {
          removeDnd5eConditionEffects(affected, ['poisoned', '中毒'], 'healed', events)
        }
        if (spell.appliedEffect === 'heroism') {
          removeDnd5eConditionEffects(affected, ['frightened', '惊惧', '恐慌'], 'healed', events)
        }
        const labels = {
          blur: '朦胧术：依赖视觉的攻击具有劣势',
          barkskin: '树肤术：AC不低于16',
          'protection-from-poison': '防护毒素：毒素抗性',
          'death-ward': '防死结界',
          'protection-from-energy': `防护能量伤害：${action.effectDamageType ?? ''}抗性`,
          longstrider: '大步奔行：速度+10尺',
          'mage-armor': '法师护甲：基础 AC 为 13＋敏捷调整值',
          'divine-favor': '神恩：武器命中额外造成1d4光耀伤害',
          jump: '跳跃术：跳跃距离变为三倍',
          darkvision: '黑暗视觉：获得60尺黑暗视觉',
          'see-invisibility': '识破隐形：将隐形生物和物件视为可见',
          fly: '飞行术：获得60尺飞行速度',
          heroism: '英雄气概：免疫恐慌，回合开始获得临时生命值',
          'enlarge-reduce': action.enlargeReduceChoice === 'enlarge'
            ? '变巨/缩小术：变巨'
            : '变巨/缩小术：缩小',
          'enhance-ability': ({
            'bear-endurance': '强化属性：熊之坚韧',
            'bull-strength': '强化属性：公牛之力',
            'cat-grace': '强化属性：猫之优雅',
            'eagle-splendor': '强化属性：雄鹰之辉',
            'fox-cunning': '强化属性：狐狸之狡',
            'owl-wisdom': '强化属性：枭之睿',
          } as const)[action.enhanceAbilityChoice ?? 'bear-endurance'],
          'flame-blade': '火焰刀：可用动作进行近战法术攻击',
          shillelagh: '橡棍术：短棒或长棍的伤害骰变为d8，并可使用施法属性攻击',
          'magic-weapon': `魔化武器：命中与伤害+${action.slotLevel >= 6 ? 3 : action.slotLevel >= 4 ? 2 : 1}`,
          sanctuary: '庇护术：成为攻击或有害法术目标前，攻击者须通过感知豁免',
        } as const
        applyDnd5eMechanicalStatusEffect(affected, actor, {
          definitionId: `srd-5.1:spell:${spell.appliedEffect}`,
          rulesId: spell.id,
          label: labels[spell.appliedEffect],
          appliedTurnKey: classFeatureTurnKey(state, actor.id),
          spellLevel: action.slotLevel,
          duration,
          speedBonusFeet: spell.appliedEffect === 'longstrider' ? 10 : undefined,
          darkvisionRangeFeet: spell.appliedEffect === 'darkvision' ? 60 : undefined,
          seeInvisible: spell.appliedEffect === 'see-invisibility' ? true : undefined,
          flySpeedFeet: spell.appliedEffect === 'fly' ? 60 : undefined,
          jumpDistanceMultiplier: spell.appliedEffect === 'jump' ? 3 : undefined,
          sizeRankDelta: spell.appliedEffect === 'enlarge-reduce'
            ? action.enlargeReduceChoice === 'enlarge' ? 1 : -1
            : undefined,
          strengthRollMode: spell.appliedEffect === 'enlarge-reduce'
            ? action.enlargeReduceChoice === 'enlarge' ? 'advantage' : 'disadvantage'
            : undefined,
          abilityCheckAdvantages: spell.appliedEffect === 'enhance-ability'
            ? [({
                'bear-endurance': 'con',
                'bull-strength': 'str',
                'cat-grace': 'dex',
                'eagle-splendor': 'cha',
                'fox-cunning': 'int',
                'owl-wisdom': 'wis',
              } as const)[action.enhanceAbilityChoice ?? 'bear-endurance']]
            : undefined,
          carryingCapacityMultiplier: spell.appliedEffect === 'enhance-ability' &&
            action.enhanceAbilityChoice === 'bull-strength' ? 2 : undefined,
          safeFallFeet: spell.appliedEffect === 'enhance-ability' &&
            action.enhanceAbilityChoice === 'cat-grace' ? 20 : undefined,
          weaponDamageD4: spell.appliedEffect === 'enlarge-reduce'
            ? action.enlargeReduceChoice === 'enlarge' ? 'add' : 'subtract'
            : undefined,
          shillelagh: spell.appliedEffect === 'shillelagh' && actor.mainWeaponId
            ? {
                weaponId: actor.mainWeaponId,
                spellcastingAbility: spellcasting.ability,
                spellcastingModifier: rules.abilityModifier(actor.abilities[spellcasting.ability]),
              }
            : undefined,
          magicWeapon: spell.appliedEffect === 'magic-weapon' && affected.mainWeaponId
            ? {
                weaponId: affected.mainWeaponId,
                bonus: action.slotLevel >= 6 ? 3 : action.slotLevel >= 4 ? 2 : 1,
              }
            : undefined,
          damageResistance: spell.appliedEffect === 'protection-from-energy' ? action.effectDamageType : undefined,
          conditionImmunities: spell.appliedEffect === 'heroism' ? ['frightened'] : undefined,
          potency: spell.appliedEffect === 'heroism'
            ? Math.max(0, rules.abilityModifier(actor.abilities[spellcasting.ability]))
            : spell.appliedEffect === 'flame-blade'
              ? action.slotLevel
              : spell.appliedEffect === 'sanctuary'
                ? 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities[spellcasting.ability])
              : undefined,
          stackingPolicy: spell.appliedEffect === 'heroism' ? 'stack' : undefined,
          stackingKey: spell.appliedEffect === 'enlarge-reduce'
            ? 'srd-5.1:spell:enlarge-reduce'
            : undefined,
        }, events)
        if (enhanceAbilityTempHp) {
          applyTemporaryHitPoints(
            affected,
            action.effectRolls.reduce((sum, roll) => sum + roll, 0),
            events,
            { actorId: actor.id, rulesId: 'enhance-ability' },
          )
        }
      }
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: affected.id,
        stateKey: spell.id, active: true,
      })
    }
    return finishSpellCast()
  }

  if (spell.effect === 'sleep-hit-point-pool' || spell.effect === 'color-spray-hit-point-pool') {
    const diceCount = dnd5eSpellDiceCount(spell, actor.level, action.slotLevel)
    if (
      action.effectRolls.length !== diceCount ||
      action.effectRolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > spell.dice.sides) ||
      additionalEffectRolls.length > 0 || (action.delayedEffectRolls?.length ?? 0) > 0 ||
      action.d20 != null || action.d20Second != null || action.savingThrowD20 != null ||
      action.savingThrowD20Second != null || (action.targetSavingThrows?.length ?? 0) > 0
    ) return fail(state, events, 'invalid-dice')

    const hitPointPool = action.effectRolls.reduce((sum, roll) => sum + roll, spell.dice.bonus)
    let remainingHitPoints = hitPointPool
    const initiativeRank = new Map(state.initiativeOrder.map((id, index) => [id, index]))
    const canSeeColorSpray = (candidate: Dnd5eCombatant) => {
      if (dnd5eHasStandardCondition(candidate, 'blinded')) return false
      const pairKey = dnd5eDirectedCombatantPairKey(candidate.id, actor.id)
      if (state.physicalLineOfSightBlockedByCombatantPair?.[pairKey] === true) return false
      const distanceFeet = dnd5eAttackDistanceFeet(state, candidate.id, actor.id)
      return dnd5eHasSpecialSenseInRange(candidate.specialSenses, 'blindsight', distanceFeet) ||
        dnd5eHasSpecialSenseInRange(candidate.specialSenses, 'truesight', distanceFeet) ||
        state.lineOfSightBlockedByCombatantPair?.[pairKey] !== true
    }
    const eligibleTargets = targets
      .filter((candidate): candidate is Dnd5eCombatant => {
        if (!candidate || candidate.currentHp <= 0 || candidate.deathSaves.dead) return false
        if (dnd5eHasStandardCondition(candidate, 'unconscious')) return false
        if (spell.effect === 'color-spray-hit-point-pool') {
          if (
            dnd5eHasStandardCondition(candidate, 'blinded') ||
            candidate.conditionImmunities.some((condition) => dnd5eStandardConditionId(condition) === 'blinded') ||
            !canSeeColorSpray(candidate)
          ) return false
          return true
        }
        const creatureType = normalizedCreatureTypeForSpell(candidate)
        if (creatureType === 'undead' || creatureType.includes('亡灵')) return false
        return !candidate.conditionImmunities.some((condition) =>
          dnd5eStandardConditionId(condition) === 'charmed' ||
          ['magical-sleep', '魔法睡眠'].includes(condition.trim().toLowerCase()),
        )
      })
      .sort((left, right) =>
        left.currentHp - right.currentHp ||
        (initiativeRank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (initiativeRank.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
      )
    const affectedTargetIds: string[] = []
    const sleepDurationRounds = spell.effect === 'sleep-hit-point-pool'
      ? metamagic?.kind === 'extended'
        ? Math.min(14_400, Math.max(1, spell.effectDurationRounds ?? 10) * 2)
        : Math.max(1, spell.effectDurationRounds ?? 10)
      : 0
    for (const affected of eligibleTargets) {
      if (affected.currentHp > remainingHitPoints) break
      const appliedTurnKey = classFeatureTurnKey(state, actor.id)
      const applied = spell.effect === 'sleep-hit-point-pool'
        ? applyDnd5eStandardConditionEffect(affected, actor, {
            id: dnd5eActiveEffectId('srd-5.1:spell:sleep:unconscious', actor.id, affected.id),
            definitionId: 'srd-5.1:spell:sleep:unconscious',
            rulesId: 'sleep',
            spellLevel: action.slotLevel,
            condition: 'unconscious',
            duration: { type: 'rounds', remainingRounds: sleepDurationRounds, tickOn: 'target-turn-end' },
            appliedTurnKey,
            breakOn: ['takes-damage'],
          }, events)
        : applyDnd5eStandardConditionEffect(affected, actor, {
            id: dnd5eActiveEffectId('srd-5.1:spell:color-spray:blinded', actor.id, affected.id),
            definitionId: 'srd-5.1:spell:color-spray:blinded',
            rulesId: 'color-spray',
            spellLevel: action.slotLevel,
            condition: 'blinded',
            duration: {
              type: 'until-turn-boundary',
              boundary: 'source-turn-end',
              appliedTurnKey,
            },
            appliedTurnKey,
          }, events)
      if (!applied) continue
      if (spell.effect === 'sleep-hit-point-pool') {
        applyDnd5eStandardConditionEffect(affected, actor, {
          id: dnd5eActiveEffectId('srd-5.1:spell:sleep:fall-prone', actor.id, affected.id),
          definitionId: 'srd-5.1:spell:sleep:fall-prone',
          rulesId: 'sleep-fall-prone',
          spellLevel: action.slotLevel,
          condition: 'prone',
          duration: { type: 'permanent' },
          appliedTurnKey,
        }, events)
      }
      remainingHitPoints -= affected.currentHp
      affectedTargetIds.push(affected.id)
    }
    events.push(spell.effect === 'sleep-hit-point-pool'
      ? {
          type: 'sleep-resolved', actorId: actor.id, spellId: 'sleep',
          hitPointPool, remainingHitPoints, affectedTargetIds,
        }
      : {
          type: 'color-spray-resolved', actorId: actor.id, spellId: 'color-spray',
          hitPointPool, remainingHitPoints, affectedTargetIds,
        })
    return finishSpellCast()
  }

  const abilityModifier = rules.abilityModifier(actor.abilities[spellcasting.ability])
  const spellSaveDc = 8 + actor.proficiencyBonus + abilityModifier
  const higherSlotDamageChoices = dnd5eSpellHigherSlotDamageChoices(spell, action.slotLevel)
  if (
    (higherSlotDamageChoices.length > 0 && !action.higherSlotDamageType) ||
    (action.higherSlotDamageType != null && !higherSlotDamageChoices.includes(action.higherSlotDamageType))
  ) return fail(state, events, 'invalid-class-feature')
  const damageDiceCounts = sustainedAttack || spell.sustainedAttack?.immediateAttack
    ? [dnd5eSustainedSpellAttackDiceCount(spell, action.slotLevel)]
    : dnd5eSpellDamageDiceCounts(
        spell,
        actor.level,
        action.slotLevel,
        action.higherSlotDamageType,
      )
  const diceCount = damageDiceCounts[0]
  const additionalDamageComponents = spell.additionalDamageComponents ?? []
  const delayedDamageDiceCount = dnd5eSpellDelayedDamageDiceCount(spell, action.slotLevel)
  const delayedEffectRolls = action.delayedEffectRolls ?? []
  if (
    additionalEffectRolls.length > 0 &&
    (additionalEffectRolls.length !== additionalDamageComponents.length ||
      additionalEffectRolls.some((rolls, index) => rolls.length !== damageDiceCounts[index + 1]))
  ) return fail(state, events, 'invalid-dice')
  if (
    delayedEffectRolls.length > 0 &&
    (!spell.delayedDamage || delayedEffectRolls.length !== delayedDamageDiceCount)
  ) return fail(state, events, 'invalid-dice')
  if (overchannel && delayedEffectRolls.length > 0) return fail(state, events, 'invalid-dice')
  const draconicAncestor = actor.classSelections['dragon-ancestor']?.[0]
  const draconicDamageType = draconicAncestor?.split('-').at(-1)
  const draconicAffinityBonus = !sustainedAttack &&
    dnd5eCombatantClassLevel(actor, 'sorcerer') >= 6 && dnd5eCombatantHasSubclass(actor, 'sorcerer', 'draconic') &&
    draconicDamageType === spell.damageType
    ? Math.max(0, rules.abilityModifier(actor.abilities.cha))
    : 0
  const empoweredEvocationBonus = !sustainedAttack &&
    dnd5eCombatantClassLevel(actor, 'wizard') >= 10 && dnd5eCombatantHasSubclass(actor, 'wizard', 'evocation') &&
    spell.school === '塑能'
    ? Math.max(0, rules.abilityModifier(actor.abilities.int))
    : 0
  const agonizingBlastBonus = spell.id === 'eldritch-blast' && dnd5eCombatantClassLevel(actor, 'warlock') >= 1 &&
    actor.classSelections['eldritch-invocations']?.includes('agonizing-blast')
    ? rules.abilityModifier(actor.abilities.cha)
    : 0
  const baseEffectBonus = spell.dice.bonus + (spell.bonusPerDie ? diceCount : 0) +
    (spell.addSpellcastingModifier ? abilityModifier : 0) + agonizingBlastBonus
  const applyEmpoweredRerolls = (
    group: Dnd5eEmpoweredSpellReroll['group'],
    targetId: string | undefined,
    rolls: readonly number[],
    attackIndex?: number,
  ): readonly number[] => {
    const next = [...rolls]
    for (const reroll of empoweredRerolls) {
      if (reroll.group === group && reroll.targetId === targetId &&
        (reroll.attackIndex == null || reroll.attackIndex === attackIndex)) next[reroll.dieIndex] = reroll.reroll
    }
    return next
  }
  const empoweredEffectRolls = applyEmpoweredRerolls('effect', undefined, action.effectRolls)
  const damageOrHealing = (
    critical = false,
    effectRolls: readonly number[] = empoweredEffectRolls,
    effectDiceCount = diceCount,
    effectBonus = baseEffectBonus,
    classDamageBonus = draconicAffinityBonus + empoweredEvocationBonus,
  ) => rules.resolveDamage({
    count: effectDiceCount,
    sides: spell.dice.sides,
    bonus: effectBonus + (spell.effect === 'healing' ? 0 : classDamageBonus),
    rolls: overchannel
      ? Array.from({ length: effectDiceCount * (critical ? 2 : 1) }, () => spell.dice.sides)
      : effectRolls,
    critical,
  })
  const damageWithCuttingWords = (
    critical = false,
    effectRolls: readonly number[] = empoweredEffectRolls,
    use: Dnd5eCuttingWordsUse | undefined = action.cuttingWordsDamage,
    effectDiceCount = diceCount,
    effectBonus = baseEffectBonus,
    classDamageBonus = draconicAffinityBonus + empoweredEvocationBonus,
  ) => {
    const damage = damageOrHealing(critical, effectRolls, effectDiceCount, effectBonus, classDamageBonus)
    const reduction = consumeSpellDamageCuttingWords(use)
    return reduction == null ? undefined : { ...damage, total: Math.max(0, damage.total - reduction) }
  }
  const damageComponentsWithCuttingWords = (
    use: Dnd5eCuttingWordsUse | undefined = action.cuttingWordsDamage,
  ): Dnd5eDamageComponent[] | undefined => {
    if (additionalDamageComponents.length < 1) return undefined
    if (additionalEffectRolls.length !== additionalDamageComponents.length) throw new RangeError('missing spell damage component rolls')
    const primary = damageOrHealing(false)
    const components: Dnd5eDamageComponent[] = [{ total: primary.total, type: spell.damageType }]
    for (let index = 0; index < additionalDamageComponents.length; index += 1) {
      const definition = additionalDamageComponents[index]
      const count = damageDiceCounts[index + 1]
      const resolved = rules.resolveDamage({
        count,
        sides: definition.dice.sides,
        bonus: definition.dice.bonus,
        rolls: additionalEffectRolls[index],
      })
      components.push({ total: resolved.total, type: definition.damageType })
    }
    const reduction = consumeSpellDamageCuttingWords(use)
    if (reduction == null) return undefined
    return scaleDnd5eDamageComponents(
      components,
      Math.max(0, components.reduce((sum, component) => sum + component.total, 0) - reduction),
    )
  }
  const normalizedCreatureType = (combatant: Dnd5eCombatant) => (combatant.creatureType ?? '').trim().toLowerCase()
  const isPlantTarget = (combatant: Dnd5eCombatant) => {
    const type = normalizedCreatureType(combatant)
    return type === 'plant' || type.includes('植物')
  }
  const isBlightImmuneTarget = (combatant: Dnd5eCombatant) => {
    const type = normalizedCreatureType(combatant)
    return type === 'construct' || type.includes('构装') || type === 'undead' || type.includes('亡灵')
  }
  const blightDamageTotal = (combatant: Dnd5eCombatant, rolledTotal: number) =>
    spell.id === 'blight' && isPlantTarget(combatant)
      ? diceCount * spell.dice.sides + baseEffectBonus + draconicAffinityBonus + empoweredEvocationBonus
      : rolledTotal
  const applySpellDamage = (
    combatant: Dnd5eCombatant,
    amount: number,
    critical = false,
    damageTypes: readonly Dnd5eDamageType[] = spell.damageType ? [spell.damageType] : [],
  ) => {
    const hpBefore = combatant.currentHp
    applyDamage(
      combatant,
      amount,
      critical,
      events,
      actor,
      state,
      damageTypes,
      spell.id === 'disintegrate',
    )
    if (spell.id !== 'disintegrate' || combatant.currentHp > 0) return
    finalizeDnd5eInstantDeath(state, combatant, events)
    events.push({ type: 'instant-death', sourceId: actor.id, targetId: combatant.id, hpBefore })
  }
  const applySpellOnHitEffect = (affectedTarget: Dnd5eCombatant) => {
    if (!spell.onHitEffect || affectedTarget.deathSaves.dead) return
    if (spell.onHitEffect === 'ray-of-frost') {
      applyDnd5eMechanicalStatusEffect(affectedTarget, actor, {
        definitionId: `srd-5.1:spell:${spell.id}:speed-penalty`,
        label: '冷冻射线：速度降低',
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        speedPenaltyFeet: 10,
        duration: { type: 'until-turn-boundary', boundary: 'source-turn-start', appliedTurnKey: classFeatureTurnKey(state, actor.id) },
      }, events)
      // 若目标当前回合尚未花费完移动，立即限制可用上限。
      affectedTarget.turn = {
        ...affectedTarget.turn,
        movementRemaining: Math.min(affectedTarget.turn.movementRemaining, dnd5eEffectiveSpeed(affectedTarget)),
      }
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: affectedTarget.id,
        stateKey: 'ray-of-frost', active: true, value: 10,
      })
    } else if (spell.onHitEffect === 'shocking-grasp') {
      applyDnd5eMechanicalStatusEffect(affectedTarget, actor, {
        definitionId: `srd-5.1:spell:${spell.id}:reaction-lock`,
        label: '电爪：无法执行反应',
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        preventReactions: true,
        duration: { type: 'until-turn-boundary', boundary: 'target-turn-start', appliedTurnKey: classFeatureTurnKey(state, actor.id) },
      }, events)
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: affectedTarget.id,
        stateKey: 'shocking-grasp', active: true,
      })
    } else if (spell.onHitEffect === 'guiding-bolt') {
      applyDnd5eMechanicalStatusEffect(affectedTarget, actor, {
        definitionId: 'srd-5.1:spell:guiding-bolt:attack-advantage',
        label: '曳光弹：下一次攻击具有优势',
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        duration: {
          type: 'until-turn-boundary', boundary: 'source-turn-end',
          appliedTurnKey: classFeatureTurnKey(state, actor.id),
        },
        breakOn: ['targeted-by-attack'],
      }, events)
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: affectedTarget.id,
        stateKey: 'guiding-bolt', active: true,
      })
    } else if (spell.onHitEffect === 'chill-touch') {
      const noHealingDuration: Dnd5eActiveEffectDuration = {
        type: 'until-turn-boundary', boundary: 'source-turn-start',
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
      }
      applyDnd5eMechanicalStatusEffect(affectedTarget, actor, {
        definitionId: 'srd-5.1:spell:chill-touch:no-healing',
        label: '冻寒之触：无法恢复生命值',
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        duration: noHealingDuration,
      }, events)
      const creatureType = (affectedTarget.creatureType ?? '').trim().toLowerCase()
      if (creatureType === 'undead' || creatureType.includes('亡灵')) {
        applyDnd5eMechanicalStatusEffect(affectedTarget, actor, {
          definitionId: 'srd-5.1:spell:chill-touch:undead-disadvantage',
          label: '冻寒之触：对施法者的攻击具有劣势',
          appliedTurnKey: classFeatureTurnKey(state, actor.id),
          spellLevel: action.slotLevel,
          duration: {
            type: 'until-turn-boundary', boundary: 'source-turn-end',
            appliedTurnKey: classFeatureTurnKey(state, actor.id),
          },
        }, events)
      }
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: affectedTarget.id,
        stateKey: 'chill-touch', active: true,
      })
    }
  }
  const queueDelayedSpellDamage = (affectedTarget: Dnd5eCombatant) => {
    const delayed = spell.delayedDamage
    if (!delayed) {
      if (delayedEffectRolls.length > 0) throw new RangeError('unexpected delayed spell damage')
      return
    }
    const damage = rules.resolveDamage({
      count: delayedDamageDiceCount,
      sides: delayed.dice.sides,
      bonus: delayed.dice.bonus,
      rolls: overchannel
        ? Array.from({ length: delayedDamageDiceCount }, () => delayed.dice.sides)
        : delayedEffectRolls,
    })
    const appliedTurnKey = classFeatureTurnKey(state, actor.id)
    const definitionId = `srd-5.1:spell:${spell.id}:delayed-damage`
    const incoming = createDnd5eMechanicalEffect({
      id: dnd5eActiveEffectId(definitionId, actor.id, affectedTarget.id, appliedTurnKey),
      definitionId,
      label: `${spell.name}：后续伤害`,
      kind: 'debuff',
      source: {
        kind: 'spell',
        actorId: actor.id,
        actorName: actor.name,
        rulesId: spell.id,
        spellLevel: action.slotLevel,
      },
      targetId: affectedTarget.id,
      duration: { type: 'until-turn-boundary', boundary: 'target-turn-end', appliedTurnKey },
      appliedTurnKey,
      stackingKey: `${definitionId}:${actor.id}:${appliedTurnKey}`,
      stackingPolicy: 'stack',
      potency: damage.total,
    })
    const mutation = applyDnd5eActiveEffect({ effects: reconciledDnd5eActiveEffects(affectedTarget), incoming })
    commitDnd5eActiveEffects(affectedTarget, mutation.effects)
    events.push({
      type: 'active-effect-applied', targetId: affectedTarget.id,
      effectId: incoming.id, definitionId: incoming.definitionId,
    })
  }
  const applyFailedSaveSpellEffect = (affectedTarget: Dnd5eCombatant, dc: number) => {
    if (spell.onFailedSaveEffect === 'vicious-mockery') {
      affectedTarget.classState.viciousMockeryAttackDisadvantage = true
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: affectedTarget.id,
        stateKey: 'vicious-mockery', active: true,
      })
      return
    }
    if (spell.onFailedSaveEffect === 'sunburst-blindness') {
      applyDnd5eStandardConditionEffect(affectedTarget, actor, {
        id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:blinded`, actor.id, affectedTarget.id),
        rulesId: spell.id,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        condition: 'blinded',
        duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
        repeatSave: { ability: 'con', dc, timing: 'target-turn-end', onSuccess: 'remove' },
      }, events)
      return
    }
    if (spell.onFailedSaveEffect === 'blindness-deafness') {
      const condition = action.conditionChoice
      if (condition !== 'blinded' && condition !== 'deafened') return
      applyDnd5eStandardConditionEffect(affectedTarget, actor, {
        id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:${condition}`, actor.id, affectedTarget.id),
        rulesId: spell.id,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        condition,
        duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
        repeatSave: { ability: 'con', dc, timing: 'target-turn-end', onSuccess: 'remove' },
      }, events)
      return
    }
    if (spell.onFailedSaveEffect === 'hideous-laughter') {
      const duration: Dnd5eActiveEffectDuration = {
        type: 'concentration', sourceActorId: actor.id,
        concentrationId: spell.id, remainingRounds: concentrationDurationRounds,
      }
      applyDnd5eStandardConditionEffect(affectedTarget, actor, {
        id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:prone`, actor.id, affectedTarget.id),
        rulesId: spell.id,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        condition: 'prone',
        duration,
      }, events)
      applyDnd5eStandardConditionEffect(affectedTarget, actor, {
        id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:incapacitated`, actor.id, affectedTarget.id),
        rulesId: spell.id,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        condition: 'incapacitated',
        duration,
      }, events)
      applyDnd5eMechanicalStatusEffect(affectedTarget, actor, {
        definitionId: `srd-5.1:spell:${spell.id}:repeat-save`,
        rulesId: spell.id,
        label: '狂笑术：重复豁免',
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        duration,
        repeatSave: {
          ability: 'wis', dc, timing: 'target-turn-end', onSuccess: 'remove',
          onDamage: { mode: 'advantage' },
        },
      }, events)
      return
    }
    if (spell.onFailedSaveEffect === 'charm-person') {
      applyDnd5eStandardConditionEffect(affectedTarget, actor, {
        id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:charmed`, actor.id, affectedTarget.id),
        rulesId: spell.id,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        condition: 'charmed',
        duration: {
          type: 'rounds',
          remainingRounds: spell.effectDurationRounds ?? 600,
          tickOn: 'target-turn-end',
        },
      }, events)
      return
    }
    if (spell.onFailedSaveEffect === 'hold-person' || spell.onFailedSaveEffect === 'hold-monster') {
      applyDnd5eStandardConditionEffect(affectedTarget, actor, {
        id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:paralyzed`, actor.id, affectedTarget.id),
        rulesId: spell.id,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        condition: 'paralyzed',
        duration: {
          type: 'concentration', sourceActorId: actor.id,
          concentrationId: spell.id, remainingRounds: concentrationDurationRounds,
        },
        repeatSave: { ability: 'wis', dc, timing: 'target-turn-end', onSuccess: 'remove' },
      }, events)
      return
    }
    if (spell.onFailedSaveEffect === 'banishment') {
      applyDnd5eRulesCondition(affectedTarget, actor, {
        condition: 'banished', rulesId: spell.id, sourceKind: 'spell',
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        duration: {
          type: 'concentration', sourceActorId: actor.id,
          concentrationId: spell.id, remainingRounds: concentrationDurationRounds,
        },
      }, events)
      applyDnd5eStandardConditionEffect(affectedTarget, actor, {
        id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:incapacitated`, actor.id, affectedTarget.id),
        rulesId: spell.id,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        condition: 'incapacitated',
        duration: {
          type: 'concentration', sourceActorId: actor.id,
          concentrationId: spell.id, remainingRounds: concentrationDurationRounds,
        },
      }, events)
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: affectedTarget.id,
        stateKey: 'banishment', active: true,
      })
      return
    }
    if (spell.onFailedSaveEffect === 'faerie-fire') {
      applyDnd5eMechanicalStatusEffect(affectedTarget, actor, {
        definitionId: 'srd-5.1:spell:faerie-fire',
        label: '妖火：显形',
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        duration: {
          type: 'concentration', sourceActorId: actor.id,
          concentrationId: spell.id, remainingRounds: concentrationDurationRounds,
        },
      }, events)
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: affectedTarget.id,
        stateKey: 'faerie-fire', active: true,
      })
      return
    }
    if (spell.onFailedSaveEffect === 'phantasmal-killer') {
      applyDnd5eStandardConditionEffect(affectedTarget, actor, {
        id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:frightened`, actor.id, affectedTarget.id),
        rulesId: spell.id,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        condition: 'frightened',
        duration: {
          type: 'concentration', sourceActorId: actor.id,
          concentrationId: spell.id, remainingRounds: concentrationDurationRounds,
        },
        repeatSave: {
          ability: 'wis',
          dc,
          timing: 'target-turn-end',
          damageOnFailure: {
            count: 4 + Math.max(0, action.slotLevel - spell.level),
            sides: 10,
            modifier: 0,
            type: 'psychic',
          },
          onSuccess: 'remove',
        },
      }, events)
    }
  }
  const applyThunderwaveForcedMovements = (
    resolvedTargets: readonly { target: Dnd5eCombatant; success: boolean; sculpted?: boolean }[],
  ): boolean => {
    const supplied = action.forcedMovements ?? []
    if (spell.onFailedSaveEffect !== 'thunderwave-push') return supplied.length === 0
    if (
      new Set(supplied.map((movement) => movement.targetId)).size !== supplied.length ||
      supplied.some((movement) => !resolvedTargets.some((resolved) =>
        resolved.target.id === movement.targetId && !resolved.success && !resolved.sculpted,
      ))
    ) return false
    for (const movement of supplied) {
      const affectedTarget = state.combatants[movement.targetId]
      if (!affectedTarget) return false
      const from = { ...affectedTarget.position }
      const oldDistanceSquared = (from.x - actor.position.x) ** 2 + (from.y - actor.position.y) ** 2
      const newDistanceSquared = (movement.to.x - actor.position.x) ** 2 + (movement.to.y - actor.position.y) ** 2
      if (
        !Number.isFinite(movement.to.x) || !Number.isFinite(movement.to.y) ||
        !Number.isFinite(movement.distanceFeet) || movement.distanceFeet <= 0 || movement.distanceFeet > 10 ||
        newDistanceSquared <= oldDistanceSquared
      ) return false
      affectedTarget.position = { ...movement.to }
      events.push({
        type: 'moved', actorId: affectedTarget.id, from, to: affectedTarget.position,
        distance: movement.distanceFeet,
      })
      if (!applyDnd5eForcedMovementElevation(
        state,
        affectedTarget,
        movement.toElevationFeet,
        movement.fallingDamageRolls,
        events,
      )) return false
    }
    return true
  }

  try {
    if (spell.effect === 'stabilize') {
      if (action.effectRolls.length > 0 || target.currentHp !== 0 || target.deathSaves.dead) {
        return fail(state, events, 'invalid-dice')
      }
      target.deathSaves = { successes: 0, failures: 0, stable: true, dead: false }
      events.push({ type: 'creature-stabilized', actorId: actor.id, targetId: target.id })
      return finishSpellCast()
    }
    if (spell.effect === 'temporary-hit-points') {
      const rolled = damageOrHealing(false, empoweredEffectRolls, diceCount, baseEffectBonus, 0)
      const amount = rolled.total + Math.max(0, action.slotLevel - spell.level) * (spell.fixedHealingPerHigherSlot ?? 0)
      applyTemporaryHitPoints(target, amount, events)
      return finishSpellCast()
    }
    if (spell.effect === 'remove-condition') {
      if (action.effectRolls.length > 0 || !action.conditionChoice) return fail(state, events, 'invalid-dice')
      const aliases = action.conditionChoice === 'disease'
        ? ['disease', '疾病']
        : [action.conditionChoice]
      removeDnd5eConditionEffects(target, aliases, 'healed', events)
      return finishSpellCast()
    }
    const cureHealAilments = (affectedTarget: Dnd5eCombatant) => {
      removeDnd5eConditionEffects(
        affectedTarget,
        ['blinded', 'deafened', 'disease', '疾病'],
        'healed',
        events,
      )
    }
    if (spell.effect === 'fixed-healing') {
      if (action.effectRolls.length > 0) return fail(state, events, 'invalid-dice')
      const amount = (spell.fixedHealing ?? 0) +
        Math.max(0, action.slotLevel - spell.level) * (spell.fixedHealingPerHigherSlot ?? 0)
      const lifeDomain = dnd5eCombatantClassLevel(actor, 'cleric') >= 1 && dnd5eCombatantHasSubclass(actor, 'cleric', 'life')
      const domainBonus = lifeDomain ? 2 + spell.level : 0
      const restored = applyHealing(target, amount + domainBonus, events)
      cureHealAilments(target)
      if (lifeDomain && dnd5eCombatantClassLevel(actor, 'cleric') >= 6 && target.id !== actor.id && restored > 0) {
        applyHealing(actor, 2 + spell.level, events)
      }
      return finishSpellCast()
    }
    if (spell.effect === 'healing-pool') {
      if (action.effectRolls.length > 0) return fail(state, events, 'invalid-dice')
      const lifeDomain = dnd5eCombatantClassLevel(actor, 'cleric') >= 1 && dnd5eCombatantHasSubclass(actor, 'cleric', 'life')
      let restoredOtherCreature = false
      for (const allocation of healingAllocations) {
        const affectedTarget = state.combatants[allocation.targetId]!
        const domainBonus = lifeDomain ? 2 + spell.level : 0
        const restored = applyHealing(affectedTarget, allocation.amount + domainBonus, events)
        cureHealAilments(affectedTarget)
        if (affectedTarget.id !== actor.id && restored > 0) restoredOtherCreature = true
      }
      if (lifeDomain && dnd5eCombatantClassLevel(actor, 'cleric') >= 6 && restoredOtherCreature) {
        applyHealing(actor, 2 + spell.level, events)
      }
      return finishSpellCast()
    }
    if (spell.effect === 'healing') {
      const healing = damageOrHealing(false)
      const lifeDomain = dnd5eCombatantClassLevel(actor, 'cleric') >= 1 && dnd5eCombatantHasSubclass(actor, 'cleric', 'life')
      const maximumHealing = lifeDomain && dnd5eCombatantClassLevel(actor, 'cleric') >= 17
        ? diceCount * spell.dice.sides + baseEffectBonus
        : healing.total
      const domainBonus = lifeDomain && spell.level > 0 ? 2 + spell.level : 0
      let restoredOtherCreature = false
      for (const affectedTarget of targets) {
        const restored = applyHealing(affectedTarget!, maximumHealing + domainBonus, events)
        if (affectedTarget!.id !== actor.id && restored > 0) restoredOtherCreature = true
      }
      if (lifeDomain && dnd5eCombatantClassLevel(actor, 'cleric') >= 6 && spell.level > 0 && restoredOtherCreature) {
        applyHealing(actor, 2 + spell.level, events)
      }
      return finishSpellCast()
    }
    if (spell.effect === 'automatic-damage') {
      if (spell.id === 'magic-missile') {
        if ((!overchannel && action.effectRolls.length !== projectileTargetIds.length) || (overchannel && action.effectRolls.length > 0)) {
          return fail(state, events, 'invalid-dice')
        }
        for (const shieldTargetId of shieldSpellReactionTargetIds) {
          if (!allowedHostileTargetIds.has(shieldTargetId)) continue
          const shieldTarget = state.combatants[shieldTargetId]
          if (!shieldTarget || applyShieldSpellReaction(state, shieldTarget, true, true, events) !== true) {
            return fail(state, events, 'invalid-class-feature')
          }
        }
        const hasDamagingProjectile = projectileTargetIds.some((projectileTargetId) => {
          const projectileTarget = state.combatants[projectileTargetId]
          return !!projectileTarget && allowedHostileTargetIds.has(projectileTarget.id) &&
            !projectileTarget.classState.shieldSpellActive
        })
        let cuttingWordsReduction = 0
        if (hasDamagingProjectile) {
          const reduction = consumeSpellDamageCuttingWords(action.cuttingWordsDamage)
          if (reduction == null) return fail(state, events, 'invalid-class-feature')
          cuttingWordsReduction = reduction
        }
        for (let projectileIndex = 0; projectileIndex < projectileTargetIds.length; projectileIndex += 1) {
          const projectileTarget = state.combatants[projectileTargetIds[projectileIndex]]
          if (!projectileTarget || !allowedHostileTargetIds.has(projectileTarget.id) || projectileTarget.classState.shieldSpellActive) continue
          const damage = rules.resolveDamage({
            count: 1,
            sides: spell.dice.sides,
            bonus: 1 + (projectileIndex === 0 ? draconicAffinityBonus + empoweredEvocationBonus : 0),
            rolls: [overchannel ? spell.dice.sides : empoweredEffectRolls[projectileIndex]],
          })
          const reduction = Math.min(damage.total, cuttingWordsReduction)
          cuttingWordsReduction -= reduction
          applyDamage(
            projectileTarget,
            adjustDamageForTarget(projectileTarget, damage.total - reduction, spell.damageType),
            false,
            events,
            actor,
            state,
            spell.damageType ? [spell.damageType] : [],
          )
        }
        return finishSpellCast()
      }
      const damage = damageWithCuttingWords(false)
      if (!damage) return fail(state, events, 'invalid-class-feature')
      for (const affectedTarget of targets) {
        if (!allowedHostileTargetIds.has(affectedTarget!.id)) continue
        applyDamage(affectedTarget!, adjustDamageForTarget(affectedTarget!, damage.total, spell.damageType), false, events, actor, state, spell.damageType ? [spell.damageType] : [])
      }
      return finishSpellCast()
    }
    if (spell.effect === 'power-word-kill') {
      if (action.effectRolls.length > 0) return fail(state, events, 'invalid-dice')
      for (const affectedTarget of targets) {
        if (!allowedHostileTargetIds.has(affectedTarget!.id) || affectedTarget!.currentHp > 100) continue
        const hpBefore = affectedTarget!.currentHp
        if (!consumeDnd5eDeathWard(affectedTarget!, 'instant-death', events)) {
          if (affectedTarget!.classState.wildShapeFormId) revertDnd5eWildShape(affectedTarget!, 0, events)
          finalizeDnd5eInstantDeath(state, affectedTarget!, events)
        } else {
          continue
        }
        events.push({ type: 'instant-death', sourceId: actor.id, targetId: affectedTarget!.id, hpBefore })
      }
      return finishSpellCast()
    }
    if (spell.effect === 'power-word-stun') {
      if (action.effectRolls.length > 0) return fail(state, events, 'invalid-dice')
      for (const affectedTarget of targets) {
        if (!allowedHostileTargetIds.has(affectedTarget!.id) || affectedTarget!.currentHp > (spell.hitPointThreshold ?? 150)) continue
        applyDnd5eStandardConditionEffect(affectedTarget!, actor, {
          id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:stunned`, actor.id, affectedTarget!.id),
          rulesId: spell.id,
          appliedTurnKey: classFeatureTurnKey(state, actor.id),
          spellLevel: action.slotLevel,
          condition: 'stunned',
          duration: { type: 'permanent' },
          repeatSave: { ability: 'con', dc: spellSaveDc, timing: 'target-turn-end', onSuccess: 'remove' },
        }, events)
      }
      return finishSpellCast()
    }
    if (spell.effect === 'saving-throw') {
      if (targets.length === 0) {
        if (
          action.effectRolls.length > 0 ||
          additionalEffectRolls.length > 0 ||
          (action.targetSavingThrows?.length ?? 0) > 0 ||
          action.savingThrowD20 != null ||
          action.savingThrowD20Second != null
        ) return fail(state, events, 'invalid-dice')
        return finishSpellCast()
      }
      if (targets.length > 1 || sculptedTargetIds.length > 0 || carefulTargetIds.length > 0) {
        const suppliedSaves = action.targetSavingThrows ?? []
        const rolledSaveTargetIds = requestedTargetIds.filter((targetId) =>
          !sculptedTargetIdSet.has(targetId) && !carefulTargetIdSet.has(targetId),
        )
        if (
          suppliedSaves.length !== rolledSaveTargetIds.length ||
          new Set(suppliedSaves.map((roll) => roll.targetId)).size !== suppliedSaves.length ||
          suppliedSaves.some((roll) => !rolledSaveTargetIds.includes(roll.targetId))
        ) return fail(state, events, 'invalid-dice')
        const resolvedTargets: { target: Dnd5eCombatant; success: boolean; sculpted: boolean }[] = []
        for (const affectedTarget of targets) {
          if (!allowedHostileTargetIds.has(affectedTarget!.id)) continue
          if (sculptedTargetIdSet.has(affectedTarget!.id)) {
            events.push({
              type: 'spell-sculpted', actorId: actor.id, targetId: affectedTarget!.id, spellId: spell.id,
            })
            resolvedTargets.push({ target: affectedTarget!, success: true, sculpted: true })
            continue
          }
          if (carefulTargetIdSet.has(affectedTarget!.id)) {
            events.push({
              type: 'metamagic-applied', actorId: actor.id, targetId: affectedTarget!.id,
              spellId: spell.id, kind: 'careful',
            })
            resolvedTargets.push({ target: affectedTarget!, success: true, sculpted: false })
            continue
          }
          const supplied = suppliedSaves.find((roll) => roll.targetId === affectedTarget!.id)!
          const saveModifier = (affectedTarget!.savingThrowBonuses[spell.saveAbility!] ??
            rules.abilityModifier(affectedTarget!.abilities[spell.saveAbility!])) +
            resolveDnd5eBlessRoll(state, affectedTarget!, supplied.blessRoll) -
            resolveDnd5eBaneRoll(state, affectedTarget!, supplied.baneRoll)
          let saveMode = dnd5eHeightenedSavingThrowMode(
            dnd5eSavingThrowMode(affectedTarget!, spell.saveAbility!, {
              effectVisible: true, sourceCreatureType: actor.creatureType, sourceIsSpell: true,
            }),
            heightenedTargetId === affectedTarget!.id,
          )
          saveMode = dnd5eSpellSpecificSavingThrowMode({
            spellId: spell.id,
            mode: saveMode,
            casterAndTargetAreFighting: actor.controller !== affectedTarget!.controller,
          })
          if (spell.id === 'blight' && isPlantTarget(affectedTarget!)) {
            saveMode = dnd5eHeightenedSavingThrowMode(saveMode, true)
          }
          if (spell.id === 'sunburst' && dnd5eSunburstSavingThrowDisadvantage(affectedTarget!)) {
            saveMode = imposeDnd5eDisadvantage(saveMode)
          }
          const rolls = saveMode === 'normal'
            ? [supplied.d20]
            : [supplied.d20, supplied.d20Second ?? 0]
          const dc = spellSaveDc
          const save = resolveSavingThrowWithClassReroll({
            combatant: affectedTarget!,
            ability: spell.saveAbility!,
            rolls,
            rerollD20: supplied.rerollD20,
            rerollD20Second: supplied.rerollD20Second,
            bardicInspirationRoll: supplied.bardicInspirationRoll,
            darkOnesOwnLuckRoll: supplied.darkOnesOwnLuckRoll,
            mode: saveMode,
            modifier: saveModifier,
            dc,
            events,
            legendaryResistance: legendaryResistanceTargetIdSet.has(affectedTarget!.id),
          })
          events.push({
            type: 'saving-throw-resolved', targetId: affectedTarget!.id, ability: spell.saveAbility!,
            d20: save.roll.d20, modifier: saveModifier, total: save.roll.total, dc, success: save.success,
          })
          resolvedTargets.push({ target: affectedTarget!, success: save.success, sculpted: false })
        }
        const potentCantrip = dnd5eCombatantClassLevel(actor, 'wizard') >= 6 && dnd5eCombatantHasSubclass(actor, 'wizard', 'evocation') && spell.level === 0
        const successfulSave = potentCantrip ? 'half' : spell.damageOnSuccessfulSave ?? 'none'
        const requiresDamageRolls = resolvedTargets.some(({ success, sculpted }) => !sculpted && (!success || successfulSave === 'half'))
        if (requiresDamageRolls) {
          const damageComponents = additionalDamageComponents.length > 0
            ? damageComponentsWithCuttingWords()
            : undefined
          const damage = additionalDamageComponents.length > 0 ? undefined : damageWithCuttingWords(false)
          if ((!damage && !damageComponents) || (damage && damageComponents)) {
            return fail(state, events, 'invalid-class-feature')
          }
          for (const resolvedTarget of resolvedTargets) {
            if (resolvedTarget.sculpted) continue
            if (spell.id === 'blight' && isBlightImmuneTarget(resolvedTarget.target)) continue
            const adjustedComponents = damageComponents
              ? adjustDnd5eDamageComponents(resolvedTarget.target, damageComponents)
              : undefined
            const adjusted = adjustedComponents
              ? adjustedComponents.reduce((sum, component) => sum + component.total, 0)
              : adjustDamageForTarget(
                  resolvedTarget.target,
                  blightDamageTotal(resolvedTarget.target, damage!.total),
                  spell.damageType,
                )
            const finalDamage = dnd5eDamageAfterSavingThrow({
              creature: resolvedTarget.target,
              ability: spell.saveAbility!,
              damage: adjusted,
              success: resolvedTarget.success,
              successfulSave,
            })
            if (finalDamage > 0) {
              applySpellDamage(
                resolvedTarget.target,
                finalDamage,
                false,
                adjustedComponents
                  ? adjustedComponents.flatMap((component) => component.type ? [component.type] : [])
                  : spell.damageType ? [spell.damageType] : [],
              )
            }
          }
        } else if (action.effectRolls.length > 0 || additionalEffectRolls.length > 0) {
          return fail(state, events, 'invalid-dice')
        }
        const failedEffectTargets = resolvedTargets.filter(({ success, sculpted }) => !success && !sculpted)
        if (!sustainedAttack && spell.concentration && failedEffectTargets.length > 0) {
          beginDnd5eConcentration(
            state,
            actor,
            spell.id,
            failedEffectTargets.map(({ target: failedTarget }) => failedTarget.id),
            concentrationDurationRounds,
            events,
            action.slotLevel,
          )
        }
        for (const resolvedTarget of failedEffectTargets) {
          applyFailedSaveSpellEffect(resolvedTarget.target, spellSaveDc)
        }
        if (!applyThunderwaveForcedMovements(resolvedTargets)) return fail(state, events, 'invalid-class-feature')
        return finishSpellCast()
      }
      const saveModifier = (target.savingThrowBonuses[spell.saveAbility!] ?? rules.abilityModifier(target.abilities[spell.saveAbility!])) +
        resolveDnd5eBlessRoll(state, target, action.savingThrowBlessRoll) -
        resolveDnd5eBaneRoll(state, target, action.savingThrowBaneRoll)
      let saveMode = dnd5eHeightenedSavingThrowMode(
        dnd5eSavingThrowMode(target, spell.saveAbility!, {
          effectVisible: true, sourceCreatureType: actor.creatureType, sourceIsSpell: true,
        }),
        heightenedTargetId === target.id,
      )
      saveMode = dnd5eSpellSpecificSavingThrowMode({
        spellId: spell.id,
        mode: saveMode,
        casterAndTargetAreFighting: actor.controller !== target.controller,
      })
      if (spell.id === 'blight' && isPlantTarget(target)) {
        saveMode = dnd5eHeightenedSavingThrowMode(saveMode, true)
      }
      if (spell.id === 'sunburst' && dnd5eSunburstSavingThrowDisadvantage(target)) {
        saveMode = imposeDnd5eDisadvantage(saveMode)
      }
      const rolls = saveMode === 'normal'
        ? [action.savingThrowD20 ?? 0]
        : [action.savingThrowD20 ?? 0, action.savingThrowD20Second ?? 0]
      const dc = spellSaveDc
      const save = resolveSavingThrowWithClassReroll({
        combatant: target,
        ability: spell.saveAbility!,
        rolls,
        rerollD20: action.savingThrowRerollD20,
        rerollD20Second: action.savingThrowRerollD20Second,
        bardicInspirationRoll: action.bardicInspirationRoll,
        darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
        mode: saveMode,
        modifier: saveModifier,
        dc,
        events,
        legendaryResistance: legendaryResistanceTargetIdSet.has(target.id),
      })
      events.push({
        type: 'saving-throw-resolved', targetId: target.id, ability: spell.saveAbility!, d20: save.roll.d20,
        modifier: saveModifier, total: save.roll.total, dc, success: save.success,
      })
      const potentCantrip = dnd5eCombatantClassLevel(actor, 'wizard') >= 6 && dnd5eCombatantHasSubclass(actor, 'wizard', 'evocation') && spell.level === 0
      const successfulSave = potentCantrip ? 'half' : spell.damageOnSuccessfulSave ?? 'none'
      const requiresDamageRolls = !save.success || successfulSave === 'half'
      if (requiresDamageRolls) {
        const damageComponents = additionalDamageComponents.length > 0
          ? damageComponentsWithCuttingWords()
          : undefined
        const damage = additionalDamageComponents.length > 0 ? undefined : damageWithCuttingWords(false)
        if ((!damage && !damageComponents) || (damage && damageComponents)) {
          return fail(state, events, 'invalid-class-feature')
        }
        const adjustedComponents = damageComponents
          ? adjustDnd5eDamageComponents(target, damageComponents)
          : undefined
        const adjusted = spell.id === 'blight' && isBlightImmuneTarget(target)
          ? 0
          : adjustedComponents
            ? adjustedComponents.reduce((sum, component) => sum + component.total, 0)
            : adjustDamageForTarget(target, blightDamageTotal(target, damage!.total), spell.damageType)
        const finalDamage = dnd5eDamageAfterSavingThrow({
          creature: target,
          ability: spell.saveAbility!,
          damage: adjusted,
          success: save.success,
          successfulSave,
        })
        if (finalDamage > 0) {
          applySpellDamage(
            target,
            finalDamage,
            false,
            adjustedComponents
              ? adjustedComponents.flatMap((component) => component.type ? [component.type] : [])
              : spell.damageType ? [spell.damageType] : [],
          )
        }
      } else if (action.effectRolls.length > 0 || additionalEffectRolls.length > 0) {
        return fail(state, events, 'invalid-dice')
      }
      if (!save.success) {
        if (!sustainedAttack && spell.concentration) {
          beginDnd5eConcentration(
            state,
            actor,
            spell.id,
            [target.id],
            concentrationDurationRounds,
            events,
            action.slotLevel,
          )
        }
        applyFailedSaveSpellEffect(target, spellSaveDc)
      }
      if (!applyThunderwaveForcedMovements([{ target, success: save.success }])) {
        return fail(state, events, 'invalid-class-feature')
      }
      return finishSpellCast()
    }

    const sequencedSpellAttack = dnd5eSpellUsesSequencedAttacks(spell)
    if (spell.effect === 'spell-attack' && (metamagic?.kind === 'twinned' || sequencedSpellAttack)) {
      const suppliedAttacks = action.targetAttacks ?? []
      const attackTargetIds = requestedTargetIds.filter((targetId) => allowedHostileTargetIds.has(targetId))
      const sequencedAttackTargetIds = projectileTargetIds.filter((targetId) => allowedHostileTargetIds.has(targetId))
      if (
        suppliedAttacks.length !== (sequencedSpellAttack ? sequencedAttackTargetIds.length : attackTargetIds.length) ||
        (sequencedSpellAttack
          ? suppliedAttacks.some((roll, index) => roll.targetId !== sequencedAttackTargetIds[index])
          : new Set(suppliedAttacks.map((roll) => roll.targetId)).size !== suppliedAttacks.length ||
            suppliedAttacks.some((roll) => !attackTargetIds.includes(roll.targetId))) ||
        action.d20 != null || action.d20Second != null || action.attackBlessRoll != null ||
        action.attackBaneRoll != null || action.bardicInspirationRoll != null || action.cuttingWords != null ||
        action.cuttingWordsDamage != null ||
        action.standAgainstTide != null ||
        action.protectionReactionActorId != null || action.shieldSpellReaction != null ||
        action.uncannyDodge != null || action.hurlThroughHellDamageRolls != null || action.effectRolls.length > 0
      ) return fail(state, events, 'invalid-dice')
      const viciousMockeryDisadvantage = suppliedAttacks.length > 0
        ? consumeViciousMockeryAttackDisadvantage(actor, events)
        : false
      for (let attackIndex = 0; attackIndex < suppliedAttacks.length; attackIndex += 1) {
        const supplied = suppliedAttacks[attackIndex]
        const affectedTarget = state.combatants[supplied.targetId]
        if (!affectedTarget) return fail(state, events, 'invalid-target')
        if (
          supplied.protectionReactionActorId &&
          !spendProtectionReaction(state, actor, affectedTarget, supplied.protectionReactionActorId, events)
        ) return fail(state, events, 'invalid-class-feature')
        const requestedMode = supplied.mode ?? 'normal'
        const targetGrantsAdvantage = !dnd5ePreventsAttackAdvantage(affectedTarget) &&
          (dnd5eTargetGrantsAttackAdvantage(affectedTarget) || (spell.id === 'shocking-grasp' && affectedTarget.wearingMetalArmor) || requestedMode === 'advantage' || (attackIndex === 0 && attackingFromHidden) ||
            !!affectedTarget.classState.recklessAttackTurnKey || !!affectedTarget.classState.stunnedByActorId ||
            (attackIndex === 0 && castingWhileUnseen) || dnd5eAttackerIsUnseenForAttack(state, actor.id, affectedTarget.id) ||
            dnd5eHelpAttackApplies(state, actor, affectedTarget))
        const actorHasDisadvantage = requestedMode === 'disadvantage' || supplied.protectionReactionActorId != null ||
          (spell.rangeFeet > 5 && dnd5eHostileWithinFiveFeet(state, actor)) ||
          (attackIndex === 0 && viciousMockeryDisadvantage) || actor.exhaustionLevel >= 3 ||
          dnd5eFrightenedAttackDisadvantage(state, actor) || dnd5eTargetIsDodging(affectedTarget) ||
          dnd5eBlurImposesAttackDisadvantage(state, actor.id, affectedTarget.id) ||
          dnd5eTargetIsUnseenForAttack(state, actor.id, affectedTarget.id)
        const mode = resolveDnd5eRollMode({
          advantage: [{ active: targetGrantsAdvantage, reason: 'spell-attack-advantage' }],
          disadvantage: [{ active: actorHasDisadvantage, reason: 'spell-attack-disadvantage' }],
        }).mode
        const rolls = mode === 'normal'
          ? [supplied.d20]
          : [supplied.d20, supplied.d20Second ?? 0]
        let targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, affectedTarget.id)
        const inspiredAttack = applyBardicInspirationToAttack(
          actor,
          rules.resolveAttack({
            rolls,
            mode,
            modifier: actor.proficiencyBonus + abilityModifier +
              resolveDnd5eBlessRoll(state, actor, supplied.attackBlessRoll) -
              resolveDnd5eBaneRoll(state, actor, supplied.attackBaneRoll),
            targetAc: targetArmorClass,
          }),
          supplied.bardicInspirationRoll,
          events,
        )
        const attack = applyCuttingWordsToAttack(state, actor, inspiredAttack, supplied.cuttingWords, events)
        if (!attack) return fail(state, events, 'invalid-class-feature')
        let attackOutcome = resolveDnd5eAttackOutcome({
          attack,
          targetArmorClass,
          automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, affectedTarget),
        })
        let { hit, critical } = attackOutcome
        const shieldSpellApplied = applyShieldSpellReaction(state, affectedTarget, supplied.shieldSpellReaction, hit, events)
        if (shieldSpellApplied == null) return fail(state, events, 'invalid-class-feature')
        if (shieldSpellApplied) {
          targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, affectedTarget.id)
          attackOutcome = resolveDnd5eAttackOutcome({
            attack,
            targetArmorClass,
            automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, affectedTarget),
          })
          ;({ hit, critical } = attackOutcome)
        }
        emitDnd5eAttackResolved(state, {
          type: 'attack-resolved', actorId: actor.id, targetId: affectedTarget.id, d20: attack.roll.d20,
          total: attack.roll.total, armorClass: targetArmorClass, hit, critical,
        }, events)
        consumeDnd5eHelpAttack(state, actor, affectedTarget, events)
        if (hit) recordHunterMultiattackDefenseHit(state, actor, affectedTarget)
        if (!hit && (supplied.uncannyDodge || supplied.cuttingWordsDamage)) return fail(state, events, 'invalid-class-feature')
        if (hit && supplied.standAgainstTide) return fail(state, events, 'invalid-class-feature')
        if (hit) {
          const damage = damageWithCuttingWords(
            critical,
            applyEmpoweredRerolls('target-attack', supplied.targetId, supplied.effectRolls, attackIndex),
            supplied.cuttingWordsDamage,
            spell.id === 'eldritch-blast' ? 1 : diceCount,
            baseEffectBonus,
            sequencedSpellAttack && attackIndex > 0 ? 0 : draconicAffinityBonus + empoweredEvocationBonus,
          )
          if (!damage) return fail(state, events, 'invalid-class-feature')
          const finalDamage = applyUncannyDodge(
            affectedTarget,
            damage.total,
            supplied.uncannyDodge,
            events,
          )
          if (finalDamage == null) return fail(state, events, 'invalid-class-feature')
          applySpellDamage(affectedTarget, adjustDamageForTarget(affectedTarget, finalDamage, spell.damageType), critical)
          triggerHurlThroughHell({
            state, actor, target: affectedTarget,
            damageRolls: supplied.hurlThroughHellDamageRolls,
            events,
          })
          applySpellOnHitEffect(affectedTarget)
          const pushTo = supplied.repellingBlastPushTo
          const pushDistance = supplied.repellingBlastPushDistanceFeet
          if (!repellingBlast && (
            pushTo || pushDistance != null || supplied.repellingBlastPushToElevationFeet != null ||
            (supplied.repellingBlastFallingDamageRolls?.length ?? 0) > 0
          )) return fail(state, events, 'invalid-class-feature')
          if ((pushTo == null) !== (pushDistance == null)) return fail(state, events, 'invalid-class-feature')
          if (!pushTo && (
            supplied.repellingBlastPushToElevationFeet != null ||
            (supplied.repellingBlastFallingDamageRolls?.length ?? 0) > 0
          )) return fail(state, events, 'invalid-class-feature')
          if (pushTo && pushDistance != null) {
            const from = { ...affectedTarget.position }
            const oldDistanceSquared = (from.x - actor.position.x) ** 2 + (from.y - actor.position.y) ** 2
            const newDistanceSquared = (pushTo.x - actor.position.x) ** 2 + (pushTo.y - actor.position.y) ** 2
            if (
              !Number.isFinite(pushTo.x) || !Number.isFinite(pushTo.y) ||
              !Number.isFinite(pushDistance) || pushDistance <= 0 || pushDistance > 10 ||
              newDistanceSquared <= oldDistanceSquared
            ) return fail(state, events, 'invalid-class-feature')
            affectedTarget.position = { ...pushTo }
            events.push({ type: 'moved', actorId: affectedTarget.id, from, to: affectedTarget.position, distance: pushDistance })
            if (!applyDnd5eForcedMovementElevation(
              state,
              affectedTarget,
              supplied.repellingBlastPushToElevationFeet,
              supplied.repellingBlastFallingDamageRolls,
              events,
            )) return fail(state, events, 'invalid-dice')
          }
        } else {
          if (
            supplied.effectRolls.length > 0 || (supplied.hurlThroughHellDamageRolls?.length ?? 0) > 0 ||
            supplied.repellingBlastPushTo || supplied.repellingBlastPushDistanceFeet != null ||
            supplied.repellingBlastPushToElevationFeet != null ||
            (supplied.repellingBlastFallingDamageRolls?.length ?? 0) > 0
          ) {
            return fail(state, events, 'invalid-dice')
          }
          if (supplied.standAgainstTide) {
            if (spell.rangeFeet > 5) return fail(state, events, 'invalid-class-feature')
            const repeated = resolveStandAgainstTideRepeat({
              state,
              attacker: actor,
              hunter: affectedTarget,
              attackModifier: actor.proficiencyBonus + abilityModifier,
              reachFeet: 5,
              damage: [{
                count: diceCount,
                sides: spell.dice.sides,
                bonus: baseEffectBonus + draconicAffinityBonus + empoweredEvocationBonus,
                type: spell.damageType,
              }],
              use: supplied.standAgainstTide,
              events,
            })
            if (!repeated.ok) return repeated
          }
        }
      }
      return finishSpellCast()
    }
    if ((action.targetAttacks?.length ?? 0) > 0) return fail(state, events, 'invalid-dice')

    const requestedMode = action.mode ?? 'normal'
    const viciousMockeryDisadvantage = consumeViciousMockeryAttackDisadvantage(actor, events)
    const targetGrantsAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
      (dnd5eTargetGrantsAttackAdvantage(target) || (spell.id === 'shocking-grasp' && target.wearingMetalArmor) || requestedMode === 'advantage' || attackingFromHidden || !!target.classState.recklessAttackTurnKey || !!target.classState.stunnedByActorId ||
        castingWhileUnseen || dnd5eAttackerIsUnseenForAttack(state, actor.id, target.id) ||
        dnd5eHelpAttackApplies(state, actor, target))
    const actorHasDisadvantage = requestedMode === 'disadvantage' || action.protectionReactionActorId != null ||
      (spell.rangeFeet > 5 && dnd5eHostileWithinFiveFeet(state, actor)) ||
      viciousMockeryDisadvantage || actor.exhaustionLevel >= 3 ||
      dnd5eFrightenedAttackDisadvantage(state, actor) || dnd5eTargetIsDodging(target) ||
      dnd5eBlurImposesAttackDisadvantage(state, actor.id, target.id) ||
      dnd5eTargetIsUnseenForAttack(state, actor.id, target.id)
    const mode = resolveDnd5eRollMode({
      advantage: [{ active: targetGrantsAdvantage, reason: 'spell-attack-advantage' }],
      disadvantage: [{ active: actorHasDisadvantage, reason: 'spell-attack-disadvantage' }],
    }).mode
    const primaryD20 = action.d20 ?? 0
    const rolls = mode === 'normal' ? [primaryD20] : [primaryD20, action.d20Second ?? primaryD20]
    let targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
    const inspiredAttack = applyBardicInspirationToAttack(
      actor,
      rules.resolveAttack({
        rolls,
        mode,
        modifier: actor.proficiencyBonus + abilityModifier + resolveDnd5eBlessRoll(state, actor, action.attackBlessRoll) -
          resolveDnd5eBaneRoll(state, actor, action.attackBaneRoll),
        targetAc: targetArmorClass,
      }),
      action.bardicInspirationRoll,
      events,
    )
    const attack = applyCuttingWordsToAttack(state, actor, inspiredAttack, action.cuttingWords, events)
    if (!attack) return fail(state, events, 'invalid-class-feature')
    let attackOutcome = resolveDnd5eAttackOutcome({
      attack,
      targetArmorClass,
      automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
    })
    let { hit, critical } = attackOutcome
    const shieldSpellApplied = applyShieldSpellReaction(state, target, action.shieldSpellReaction, hit, events)
    if (shieldSpellApplied == null) return fail(state, events, 'invalid-class-feature')
    if (shieldSpellApplied) {
      targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
      attackOutcome = resolveDnd5eAttackOutcome({
        attack,
        targetArmorClass,
        automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
      })
      ;({ hit, critical } = attackOutcome)
    }
    emitDnd5eAttackResolved(state, {
      type: 'attack-resolved', actorId: actor.id, targetId: target.id, d20: attack.roll.d20,
      total: attack.roll.total, armorClass: targetArmorClass, hit, critical,
    }, events)
    consumeDnd5eHelpAttack(state, actor, target, events)
    if (hit) recordHunterMultiattackDefenseHit(state, actor, target)
    if (!hit && (action.uncannyDodge || (action.cuttingWordsDamage && spell.spellAttackMissDamage !== 'half'))) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (hit && action.standAgainstTide) return fail(state, events, 'invalid-class-feature')
    if (hit) {
      const damage = damageWithCuttingWords(critical)
      if (!damage) return fail(state, events, 'invalid-class-feature')
      const finalDamage = applyUncannyDodge(
        target,
        damage.total,
        action.uncannyDodge,
        events,
      )
      if (finalDamage == null) return fail(state, events, 'invalid-class-feature')
      applySpellDamage(target, adjustDamageForTarget(target, finalDamage, spell.damageType), critical)
      queueDelayedSpellDamage(target)
      triggerHurlThroughHell({
        state,
        actor,
        target,
        damageRolls: action.hurlThroughHellDamageRolls,
        events,
      })
      applySpellOnHitEffect(target)
    } else {
      if (spell.spellAttackMissDamage === 'half') {
        if (delayedEffectRolls.length > 0) return fail(state, events, 'invalid-dice')
        const splash = damageWithCuttingWords(false)
        if (!splash) return fail(state, events, 'invalid-class-feature')
        const halfDamage = Math.floor(splash.total / 2)
        if (halfDamage > 0) {
          applySpellDamage(target, adjustDamageForTarget(target, halfDamage, spell.damageType))
        }
      } else if (action.effectRolls.length > 0 || delayedEffectRolls.length > 0) {
        return fail(state, events, 'invalid-dice')
      }
      if ((action.hurlThroughHellDamageRolls?.length ?? 0) > 0) return fail(state, events, 'invalid-dice')
      if (action.standAgainstTide) {
        if (spell.rangeFeet > 5) return fail(state, events, 'invalid-class-feature')
        const repeated = resolveStandAgainstTideRepeat({
          state,
          attacker: actor,
          hunter: target,
          attackModifier: actor.proficiencyBonus + abilityModifier,
          reachFeet: 5,
          damage: [{
            count: diceCount,
            sides: spell.dice.sides,
            bonus: baseEffectBonus + draconicAffinityBonus + empoweredEvocationBonus,
            type: spell.damageType,
          }],
          use: action.standAgainstTide,
          events,
        })
        if (!repeated.ok) return repeated
      }
    }
    return finishSpellCast()
  } catch {
    return fail(state, events, 'invalid-dice')
  }
}

function monsterWeaponSequence(
  monsterAction: Dnd5eMonsterAction,
  actions: readonly Dnd5eMonsterAction[],
  actor: Pick<Dnd5eCombatant, 'currentHp' | 'maxHp'>,
): readonly Dnd5eMonsterWeaponAttack[] | undefined {
  if (dnd5eMonsterActionAutomation(monsterAction) !== 'headless') return undefined
  if (monsterAction.kind === 'weapon-attack' && monsterAction.attack) {
    return [dnd5eMonsterEffectiveWeaponAttack(monsterAction.attack, actor.currentHp, actor.maxHp)]
  }
  if (monsterAction.kind !== 'multiattack' || !monsterAction.sequence) return undefined
  const sequence = monsterAction.sequence.map((actionId) => {
    const child = actions.find((candidate) => candidate.id === actionId)
    return child?.attack && dnd5eMonsterActionAutomation(child) === 'headless'
      ? dnd5eMonsterEffectiveWeaponAttack(child.attack, actor.currentHp, actor.maxHp)
      : undefined
  })
  return sequence.every((attack): attack is Dnd5eMonsterWeaponAttack => !!attack) ? sequence : undefined
}

function dnd5eMonsterMechanicDuration(
  duration: Dnd5eMonsterMechanicDurationV2,
  state: Dnd5eHeadlessCombatState,
  target: Dnd5eCombatant,
): Dnd5eActiveEffectDuration {
  if (duration.kind === 'permanent') return { type: 'permanent' }
  if (duration.kind === 'until-target-turn-start') {
    return { type: 'until-turn-boundary', boundary: 'target-turn-start' }
  }
  if (duration.kind === 'until-source-turn-start') {
    return { type: 'until-turn-boundary', boundary: 'source-turn-start' }
  }
  return {
    type: 'rounds',
    remainingRounds: Math.max(1, Math.floor(duration.rounds)),
    tickOn: 'target-turn-end',
    ...(currentActorId(state) === target.id ? { lastTickTurnKey: classFeatureTurnKey(state, target.id) } : {}),
  }
}

function resolveDnd5eMonsterMechanics(input: {
  state: Dnd5eHeadlessCombatState
  actor: Dnd5eCombatant
  monster: Dnd5eMonsterStatBlock | undefined
  event: Dnd5eMonsterMechanicTriggerEventV2
  supplied?: readonly Dnd5eMonsterMechanicRoll[]
  triggerTarget?: Dnd5eCombatant
  events: Dnd5eCombatEvent[]
}): boolean {
  const supplied = input.supplied ?? []
  if (!input.monster) return supplied.length === 0
  if (input.event === 'after-hit' && !input.triggerTarget) return supplied.length === 0
  const context = {
    combatId: input.state.combatId,
    round: input.state.round,
    actorId: input.actor.id,
    currentHp: input.actor.currentHp,
    maxHp: input.actor.maxHp,
    usedKeys: input.actor.classState.declarativeUsedTurnKeys,
  }
  const eligible = dnd5eEligibleMonsterMechanics(input.monster, input.event, context)
  if (
    supplied.length !== eligible.length ||
    supplied.some((roll) => roll.actorId !== input.actor.id) ||
    new Set(supplied.map((roll) => roll.mechanicId)).size !== supplied.length
  ) return false

  const resolvedTotals = new Map<string, ReadonlyMap<string, number>>()
  for (const mechanic of eligible) {
    const mechanicRoll = supplied.find((entry) => entry.mechanicId === mechanic.id)
    if (!mechanicRoll) return false
    if (input.event === 'after-hit') {
      if (!input.triggerTarget || mechanicRoll.targetId !== input.triggerTarget.id) return false
    } else if (mechanicRoll.targetId != null) {
      return false
    }
    const requirements = dnd5eMonsterMechanicDiceRequirements(mechanic)
    const provided = mechanic.schemaVersion === 1 && mechanicRoll.rolls
      ? [{ effectId: 'effect-0', rolls: mechanicRoll.rolls }]
      : mechanicRoll.effectRolls ?? []
    if (
      provided.length !== requirements.length ||
      new Set(provided.map((entry) => entry.effectId)).size !== provided.length
    ) return false
    const totals = new Map<string, number>()
    for (const requirement of requirements) {
      const effectRoll = provided.find((entry) => entry.effectId === requirement.effectId)
      if (
        !effectRoll || effectRoll.rolls.length !== requirement.count ||
        effectRoll.rolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > requirement.sides)
      ) return false
      try {
        totals.set(requirement.effectId, rules.resolveDamage({
          count: requirement.count,
          sides: requirement.sides,
          bonus: requirement.bonus,
          rolls: effectRoll.rolls,
          critical: false,
        }).total)
      } catch {
        return false
      }
    }
    resolvedTotals.set(mechanic.id, totals)
  }

  for (const mechanic of eligible) {
    const outcomes: Extract<Dnd5eCombatEvent, { type: 'monster-mechanic-v2-triggered' }>['outcomes'][number][] = []
    const totals = resolvedTotals.get(mechanic.id) ?? new Map<string, number>()
    for (const effect of dnd5eMonsterMechanicEffects(mechanic)) {
      if (
        effect.kind === 'summon' ||
        effect.kind === 'area-attack' ||
        effect.kind === 'roll-modifier' ||
        effect.kind === 'attack'
      ) return false
      const target = effect.kind === 'healing' || effect.kind === 'temporary-hit-points' || effect.target === 'self'
        ? input.actor
        : effect.target === 'trigger-target'
          ? input.triggerTarget
          : undefined
      if (!target) return false
      if (effect.kind === 'healing') {
        outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, amount: applyHealing(target, totals.get(effect.id) ?? 0, input.events) })
      } else if (effect.kind === 'temporary-hit-points') {
        outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, amount: applyTemporaryHitPoints(target, totals.get(effect.id) ?? 0, input.events) })
      } else if (effect.kind === 'damage') {
        const amount = adjustDamageForTarget(target, totals.get(effect.id) ?? 0, effect.damageType)
        applyDamage(target, amount, false, input.events, input.actor, input.state, [effect.damageType])
        outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, amount })
      } else if (effect.kind === 'standard-condition') {
        const relevantBoundaryActorId = effect.duration.kind === 'until-target-turn-start'
          ? target.id
          : effect.duration.kind === 'until-source-turn-start'
            ? input.actor.id
            : undefined
        const appliedTurnKey = relevantBoundaryActorId && currentActorId(input.state) === relevantBoundaryActorId
          ? classFeatureTurnKey(input.state, relevantBoundaryActorId)
          : undefined
        const applied = applyDnd5eRulesCondition(target, input.actor, {
          condition: effect.condition,
          rulesId: `monster-mechanic:${input.monster.id}:${mechanic.id}:${effect.id}`,
          sourceKind: 'monster',
          duration: dnd5eMonsterMechanicDuration(effect.duration, input.state, target),
          appliedTurnKey,
        }, input.events)
        outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, condition: effect.condition, applied })
      } else if (effect.kind === 'remove-standard-condition') {
        const removed = removeDnd5eEffectsByPredicate(
          target,
          (candidate) => candidate.standardCondition === effect.condition,
          'dm',
          input.events,
        )
        outcomes.push({
          effectId: effect.id,
          kind: effect.kind,
          targetId: target.id,
          condition: effect.condition,
          applied: removed.length > 0,
        })
      } else {
        return false
      }
    }
    if (mechanic.limit !== 'unlimited') {
      input.actor.classState.declarativeUsedTurnKeys = {
        ...input.actor.classState.declarativeUsedTurnKeys,
        [dnd5eMonsterMechanicLedgerKey(mechanic.id)]: dnd5eMonsterMechanicUsageValue(mechanic, context),
      }
    }
    if (mechanic.schemaVersion === 1) {
      const outcome = outcomes[0]
      input.events.push({
        type: 'monster-mechanic-triggered', actorId: input.actor.id,
        mechanicId: mechanic.id, mechanicName: mechanic.name,
        amount: outcome?.amount ?? 0, hpAfter: input.actor.currentHp,
      })
    } else {
      input.events.push({
        type: 'monster-mechanic-v2-triggered', actorId: input.actor.id,
        mechanicId: mechanic.id, mechanicName: mechanic.name, trigger: input.event, outcomes,
      })
    }
  }
  return true
}

function resolveDnd5ePendingMonsterMechanicTrigger(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'resolve-monster-mechanic-trigger' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const requestedOwner = state.combatants[action.actorId]
  const snapshot = state.pendingMonsterMechanicTriggers?.[action.snapshotId] ??
    requestedOwner?.classState.pendingMonsterMechanicTriggers?.[action.snapshotId]
  const owner = snapshot ? state.combatants[snapshot.mechanicOwnerId] : undefined
  const monster = owner?.statBlockId ? getDnd5eSrdMonster(owner.statBlockId) : undefined
  const mechanic = monster?.headlessMechanics?.find((entry) => entry.id === snapshot?.mechanicId)
  if (
    !snapshot || !owner || owner.id !== action.actorId || owner.currentHp <= 0 || owner.deathSaves.dead ||
    !monster || !mechanic || mechanic.schemaVersion !== 2 ||
    (mechanic.limit === 'once-per-turn' && snapshot.createdRound !== state.round) ||
    snapshot.chainDepth > DND5E_MONSTER_MECHANIC_MAX_CHAIN_DEPTH ||
    action.roll.actorId !== owner.id || action.roll.mechanicId !== mechanic.id
  ) return fail(state, events, 'invalid-monster-action')

  const subject = state.combatants[snapshot.subjectId]
  const triggerTarget = snapshot.triggerTargetId ? state.combatants[snapshot.triggerTargetId] : undefined
  const damageSource = snapshot.damageSourceId ? state.combatants[snapshot.damageSourceId] : undefined
  if (!subject) return fail(state, events, 'invalid-target')
  if (action.roll.targetId != null && action.roll.targetId !== subject.id) return fail(state, events, 'invalid-target')

  const targetFor = (effect: Dnd5eMonsterMechanicEffectV2): Dnd5eCombatant | undefined => {
    if (!('target' in effect)) return undefined
    if (effect.target === 'self') return owner
    if (effect.target === 'selected-subject') return subject
    if (effect.target === 'trigger-target') return triggerTarget
    return damageSource
  }
  const requirements = dnd5eMonsterMechanicDiceRequirements(mechanic)
  const provided = action.roll.effectRolls ?? []
  if (
    provided.length !== requirements.length ||
    new Set(provided.map((entry) => entry.effectId)).size !== provided.length
  ) return fail(state, events, 'invalid-dice')
  const totals = new Map<string, number>()
  try {
    for (const requirement of requirements) {
      const supplied = provided.find((entry) => entry.effectId === requirement.effectId)
      if (
        !supplied || supplied.rolls.length !== requirement.count ||
        supplied.rolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > requirement.sides)
      ) return fail(state, events, 'invalid-dice')
      totals.set(requirement.effectId, rules.resolveDamage({
        count: requirement.count,
        sides: requirement.sides,
        bonus: requirement.bonus,
        rolls: supplied.rolls,
        critical: false,
      }).total)
    }
  } catch {
    return fail(state, events, 'invalid-dice')
  }

  const attackEffects = mechanic.effects.filter((effect) => effect.kind === 'attack')
  const attackRolls = action.roll.attackRolls ?? []
  if (
    attackRolls.length !== attackEffects.length ||
    new Set(attackRolls.map((entry) => entry.effectId)).size !== attackRolls.length
  ) return fail(state, events, 'invalid-dice')

  const outcomes: Extract<Dnd5eCombatEvent, { type: 'monster-mechanic-v2-triggered' }>['outcomes'][number][] = []
  for (const effect of mechanic.effects) {
    if (effect.kind === 'summon' || effect.kind === 'area-attack') {
      return fail(state, events, 'invalid-monster-action')
    }
    const target = effect.kind === 'healing' || effect.kind === 'temporary-hit-points'
      ? owner
      : targetFor(effect)
    if (!target) return fail(state, events, 'invalid-target')
    if (effect.kind === 'healing') {
      outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, amount: applyHealing(target, totals.get(effect.id) ?? 0, events) })
    } else if (effect.kind === 'temporary-hit-points') {
      outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, amount: applyTemporaryHitPoints(target, totals.get(effect.id) ?? 0, events) })
    } else if (effect.kind === 'damage') {
      const amount = adjustDamageForTarget(target, totals.get(effect.id) ?? 0, effect.damageType)
      applyDamage(target, amount, false, events, owner, state, [effect.damageType])
      outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, amount })
    } else if (effect.kind === 'standard-condition') {
      const applied = applyDnd5eRulesCondition(target, owner, {
        condition: effect.condition,
        rulesId: `monster-mechanic:${monster.id}:${mechanic.id}:${effect.id}`,
        sourceKind: 'monster',
        duration: dnd5eMonsterMechanicDuration(effect.duration, state, target),
      }, events)
      outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, condition: effect.condition, applied })
    } else if (effect.kind === 'remove-standard-condition') {
      const removed = removeDnd5eEffectsByPredicate(
        target,
        (candidate) => candidate.standardCondition === effect.condition,
        'dm',
        events,
      )
      outcomes.push({
        effectId: effect.id, kind: effect.kind, targetId: target.id,
        condition: effect.condition, applied: removed.length > 0,
      })
    } else if (effect.kind === 'roll-modifier') {
      const id = `${snapshot.id}:${effect.id}`
      target.classState.monsterMechanicRollModifiers = [
        ...(target.classState.monsterMechanicRollModifiers ?? []).filter((entry) => entry.id !== id),
        {
          id,
          mechanicOwnerId: owner.id,
          mechanicId: mechanic.id,
          roll: effect.roll,
          mode: effect.mode,
          ...(effect.mode === 'bonus' ? { bonus: effect.bonus ?? 0 } : {}),
        },
      ]
      outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, applied: true })
    } else {
      const supplied = attackRolls.find((entry) => entry.effectId === effect.id)
      if (!supplied || supplied.targetId !== target.id || target.currentHp <= 0 || target.deathSaves.dead) {
        return fail(state, events, 'invalid-target')
      }
      if ((effect.economy ?? 'none') === 'reaction') {
        if (!spend(owner, 'reaction')) return fail(state, events, 'reaction-unavailable')
        events.push({ type: 'turn-resource-spent', actorId: owner.id, resource: 'reaction' })
      }
      const critical = supplied.d20 === 20
      let attack
      let damage = 0
      try {
        const attackModifier = consumeDnd5eMonsterMechanicRollModifiers(owner, 'attack', events)
        const mode = resolveDnd5eRollMode({
          advantage: [{ active: attackModifier.advantage, reason: 'monster-mechanic-attack-advantage' }],
          disadvantage: [{ active: attackModifier.disadvantage, reason: 'monster-mechanic-attack-disadvantage' }],
        }).mode
        const attackDice = mode === 'normal'
          ? [supplied.d20]
          : [supplied.d20, supplied.d20Second ?? 0]
        attack = rules.resolveAttack({
          rolls: attackDice,
          mode,
          modifier: effect.toHit + attackModifier.bonus,
          targetAc: target.armorClass,
        })
        if (attack.hit) {
          const expectedRolls = effect.damage.count * (critical ? 2 : 1)
          if (
            supplied.damageRolls.length !== expectedRolls ||
            supplied.damageRolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > effect.damage.sides)
          ) return fail(state, events, 'invalid-dice')
          damage = rules.resolveDamage({
            count: effect.damage.count,
            sides: effect.damage.sides,
            bonus: effect.damage.bonus,
            rolls: supplied.damageRolls,
            critical,
          }).total
          damage = Math.max(
            0,
            damage + consumeDnd5eMonsterMechanicRollModifiers(owner, 'damage', events).bonus,
          )
        } else if (supplied.damageRolls.length > 0) return fail(state, events, 'invalid-dice')
      } catch {
        return fail(state, events, 'invalid-dice')
      }
      events.push({
        type: 'attack-resolved', actorId: owner.id, targetId: target.id,
        d20: attack.roll.d20, total: attack.roll.total, armorClass: target.armorClass,
        hit: attack.hit, critical: attack.hit && critical,
      })
      if (attack.hit) {
        damage = adjustDamageForTarget(target, damage, effect.damage.type)
        applyDamage(target, damage, critical, events, owner, state, [effect.damage.type])
      }
      outcomes.push({ effectId: effect.id, kind: effect.kind, targetId: target.id, amount: damage })
    }
  }

  owner.classState.declarativeUsedTurnKeys = mechanic.limit === 'unlimited'
    ? owner.classState.declarativeUsedTurnKeys
    : {
        ...owner.classState.declarativeUsedTurnKeys,
        [dnd5eMonsterMechanicLedgerKey(mechanic.id)]: dnd5eMonsterMechanicUsageValue(mechanic, {
          combatId: state.combatId,
          round: state.round,
          actorId: owner.id,
        }),
      }
  const pending = Object.assign(
    {},
    ...Object.values(state.combatants).map((combatant) => combatant.classState.pendingMonsterMechanicTriggers ?? {}),
    state.pendingMonsterMechanicTriggers ?? {},
  ) as Record<string, Dnd5eMonsterMechanicTriggerSnapshot>
  delete pending[snapshot.id]
  state.pendingMonsterMechanicTriggers = Object.keys(pending).length > 0 ? pending : undefined
  const ownerPending = { ...(owner.classState.pendingMonsterMechanicTriggers ?? {}) }
  delete ownerPending[snapshot.id]
  owner.classState.pendingMonsterMechanicTriggers = Object.keys(ownerPending).length > 0 ? ownerPending : undefined
  events.push({
    type: 'monster-mechanic-v2-triggered',
    actorId: owner.id,
    mechanicId: mechanic.id,
    mechanicName: mechanic.name,
    trigger: snapshot.event,
    outcomes,
  })
  return { ok: true, state, events }
}

function resolveMonsterAction(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monster-action' | 'monster-legendary-action' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  const legendary = action.type === 'monster-legendary-action'
  const resourceDefinition = legendary
    ? monster?.legendaryActions?.find((candidate) => candidate.id === action.actionId)
    : monster?.actions.find((candidate) => candidate.id === action.actionId)
  const actionDefinition = resourceDefinition?.referencedActionId
    ? monster?.actions.find((candidate) => candidate.id === resourceDefinition.referencedActionId)
    : resourceDefinition
  const sequence = actionDefinition && monster && actor
    ? monsterWeaponSequence(actionDefinition, monster.actions, actor)
    : undefined
  const sequenceWeaponIds = actionDefinition?.kind === 'weapon-attack'
    ? [actionDefinition.id]
    : actionDefinition?.sequence
  if (!actor || actor.currentHp <= 0 || !monster || !resourceDefinition || !actionDefinition || !sequence || sequence.length !== action.rolls.length) {
    return fail(state, events, 'invalid-monster-action')
  }
  if (legendary && (action.mechanicRolls?.length ?? 0) > 0) return fail(state, events, 'invalid-monster-action')
  if (legendary) {
    if (state.initiativeOrder[state.initiativeIndex] === actor.id) return fail(state, events, 'invalid-monster-action')
    const cost = Math.max(1, resourceDefinition.legendaryCost ?? 1)
    const available = actor.classState.monsterLegendaryActionPoints ?? 0
    if (available < cost) return fail(state, events, 'class-resource-unavailable')
    actor.classState.monsterLegendaryActionPoints = available - cost
    events.push({
      type: 'monster-legendary-action-used', actorId: actor.id, actionId: resourceDefinition.id,
      cost, remaining: actor.classState.monsterLegendaryActionPoints,
    })
  } else {
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
  }
  if (actionDefinition.usage?.kind === 'recharge') {
    if (actor.classState.monsterRechargeReadyByActionId?.[actionDefinition.id] === false) {
      return fail(state, events, 'class-resource-unavailable')
    }
    actor.classState.monsterRechargeReadyByActionId = {
      ...actor.classState.monsterRechargeReadyByActionId,
      [actionDefinition.id]: false,
    }
  } else if (actionDefinition.usage?.kind === 'per-day') {
    const resource = actor.classState.monsterActionUsesByActionId?.[actionDefinition.id]
    if (!resource || resource.current < 1) return fail(state, events, 'class-resource-unavailable')
    resource.current -= 1
  }

  let afterHitMechanicResolved = false
  for (let index = 0; index < sequence.length; index += 1) {
    const supplied = action.rolls[index]
    const target = state.combatants[supplied.targetId]
    if (!target || target.deathSaves.dead || dnd5eCombatantIsBanished(target)) return fail(state, events, 'invalid-target')
    const attackDefinition = dnd5eMonsterWeaponAttackAgainstConditions(
      monster,
      sequence[index],
      target.conditions,
    )
    const magicWeaponBonus = dnd5eActiveMagicWeaponBonus(
      actor.classState.activeEffects,
      sequenceWeaponIds?.[index],
    )
    if (dnd5eCannotAttackSource(actor, target.id)) return fail(state, events, 'invalid-target')
    const distanceFeet = dnd5eAttackDistanceFeet(state, actor.id, target.id)
    const hasKnownDistance = Number.isFinite(distanceFeet)
    const usesRangedAttack = attackDefinition.mode === 'ranged' ||
      (attackDefinition.mode === 'melee-or-ranged' && hasKnownDistance && distanceFeet > (attackDefinition.reachFeet ?? 5))
    if (hasKnownDistance && usesRangedAttack && distanceFeet > (attackDefinition.rangeFeet?.long ?? attackDefinition.rangeFeet?.normal ?? 0)) {
      return fail(state, events, 'invalid-target')
    }
    if (hasKnownDistance && !usesRangedAttack && distanceFeet > (attackDefinition.reachFeet ?? 5)) return fail(state, events, 'invalid-target')
    try {
      if (!passesTranquilityWard(state, actor, target, supplied.tranquilitySave, events)) {
        if (supplied.standAgainstTide) return fail(state, events, 'invalid-class-feature')
        continue
      }
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    if (!spendProtectionReaction(state, actor, target, supplied.protectionReactionActorId, events)) {
      return fail(state, events, 'invalid-class-feature')
    }
    const requestedMode = supplied.mode ?? 'normal'
    const mechanicAttackModifier = consumeDnd5eMonsterMechanicRollModifiers(actor, 'attack', events)
    const viciousMockeryDisadvantage = consumeViciousMockeryAttackDisadvantage(actor, events)
    const hasAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
      (dnd5eTargetGrantsAttackAdvantage(target) || requestedMode === 'advantage' || !!target.classState.stunnedByActorId ||
        dnd5eAttackerIsUnseenForAttack(state, actor.id, target.id) || dnd5eHelpAttackApplies(state, actor, target) ||
        mechanicAttackModifier.advantage)
    const rangedDisadvantage = hasKnownDistance && usesRangedAttack && (
      distanceFeet > (attackDefinition.rangeFeet?.normal ?? 0) || dnd5eHostileWithinFiveFeet(state, actor)
    )
    const hasDisadvantage = requestedMode === 'disadvantage' || supplied.protectionReactionActorId != null ||
      rangedDisadvantage || viciousMockeryDisadvantage || dnd5eFrightenedAttackDisadvantage(state, actor) ||
      dnd5eTargetIsDodging(target) || dnd5eBlurImposesAttackDisadvantage(state, actor.id, target.id) ||
      dnd5eTargetIsUnseenForAttack(state, actor.id, target.id) || mechanicAttackModifier.disadvantage
    const mode = resolveDnd5eRollMode({
      advantage: [{ active: hasAdvantage, reason: 'monster-attack-advantage' }],
      disadvantage: [{ active: hasDisadvantage, reason: 'monster-attack-disadvantage' }],
    }).mode
    const attackRolls = mode === 'normal' ? [supplied.d20] : [supplied.d20, supplied.d20Second ?? supplied.d20]
    let targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
    let attack: AttackResolution | undefined
    try {
      const inspiredAttack = applyBardicInspirationToAttack(
        actor,
        rules.resolveAttack({
          rolls: attackRolls,
          mode,
          modifier: attackDefinition.toHit + magicWeaponBonus + mechanicAttackModifier.bonus +
            resolveDnd5eBlessRoll(state, actor, supplied.blessRoll) -
            resolveDnd5eBaneRoll(state, actor, supplied.baneRoll),
          targetAc: targetArmorClass,
        }),
        supplied.bardicInspirationRoll,
        events,
      )
      attack = applyCuttingWordsToAttack(state, actor, inspiredAttack, supplied.cuttingWords, events)
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    if (!attack) return fail(state, events, 'invalid-class-feature')
    let attackOutcome = resolveDnd5eAttackOutcome({
      attack,
      targetArmorClass,
      criticalThreshold: attackDefinition.criticalThreshold,
      automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
    })
    let { hit, critical } = attackOutcome
    const shieldSpellApplied = applyShieldSpellReaction(state, target, supplied.shieldSpellReaction, hit, events)
    if (shieldSpellApplied == null) return fail(state, events, 'invalid-class-feature')
    if (shieldSpellApplied) {
      targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
      attackOutcome = resolveDnd5eAttackOutcome({
        attack,
        targetArmorClass,
        criticalThreshold: attackDefinition.criticalThreshold,
        automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
      })
      ;({ hit, critical } = attackOutcome)
    }
    emitDnd5eAttackResolved(state, {
      type: 'attack-resolved',
      actorId: actor.id,
      targetId: target.id,
      d20: attack.roll.d20,
      total: attack.roll.total,
      armorClass: targetArmorClass,
      hit,
      critical,
    }, events)
    consumeDnd5eHelpAttack(state, actor, target, events)
    if (hit) recordHunterMultiattackDefenseHit(state, actor, target)
    if (!hit && (supplied.uncannyDodge || supplied.deflectMissilesD10 != null || supplied.cuttingWordsDamage)) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (hit && supplied.standAgainstTide) return fail(state, events, 'invalid-class-feature')
    if (supplied.uncannyDodge && supplied.deflectMissilesD10 != null) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!hit) {
      if ((supplied.sizeDamageRolls?.length ?? 0) > 0) return fail(state, events, 'invalid-dice')
      if (supplied.standAgainstTide) {
        if (attackDefinition.mode === 'ranged' || !attackDefinition.reachFeet) {
          return fail(state, events, 'invalid-class-feature')
        }
        const repeated = resolveStandAgainstTideRepeat({
          state,
          attacker: actor,
          hunter: target,
          attackModifier: attackDefinition.toHit + magicWeaponBonus,
          reachFeet: attackDefinition.reachFeet,
          damage: attackDefinition.damage.map((component, componentIndex) => ({
            ...component,
            bonus: component.bonus + (componentIndex === 0 ? magicWeaponBonus : 0),
          })),
          use: supplied.standAgainstTide,
          events,
        })
        if (!repeated.ok) return repeated
      }
      continue
    }
    const criticalExtraDamage = critical ? attackDefinition.criticalExtraDamage ?? [] : []
    if (supplied.damageRolls.length !== attackDefinition.damage.length + criticalExtraDamage.length) {
      return fail(state, events, 'invalid-dice')
    }
    let damageComponents: Dnd5eDamageComponent[] = []
    try {
      for (let damageIndex = 0; damageIndex < attackDefinition.damage.length; damageIndex += 1) {
        const damageDefinition = attackDefinition.damage[damageIndex]
        const resolved = rules.resolveDamage({
          count: damageDefinition.count,
          sides: damageDefinition.sides,
          bonus: damageDefinition.bonus,
          rolls: supplied.damageRolls[damageIndex],
          critical,
        })
        damageComponents.push({
          total: resolved.total + (damageIndex === 0 ? magicWeaponBonus : 0),
          type: damageDefinition.type,
        })
      }
      for (let extraIndex = 0; extraIndex < criticalExtraDamage.length; extraIndex += 1) {
        const damageDefinition = criticalExtraDamage[extraIndex]
        const resolved = rules.resolveDamage({
          count: damageDefinition.count,
          sides: damageDefinition.sides,
          bonus: damageDefinition.bonus,
          rolls: supplied.damageRolls[attackDefinition.damage.length + extraIndex],
          critical: false,
        })
        damageComponents.push({ total: resolved.total, type: damageDefinition.type })
      }
      const sizeDamageMode = dnd5eActiveWeaponDamageD4Mode(actor.classState.activeEffects)
      const sizeDamageRolls = supplied.sizeDamageRolls ?? []
      const expectedSizeDamageDice = sizeDamageMode ? critical ? 2 : 1 : 0
      if (
        sizeDamageRolls.length !== expectedSizeDamageDice ||
        sizeDamageRolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > 4)
      ) return fail(state, events, 'invalid-dice')
      const sizeDamageTotal = sizeDamageRolls.reduce((sum, roll) => sum + roll, 0)
      if (sizeDamageMode === 'subtract') {
        const appliedReduction = subtractFromWeaponDamage(damageComponents, sizeDamageTotal)
        if (appliedReduction > 0) {
          events.push({
            type: 'class-damage-applied', actorId: actor.id, targetId: target.id,
            source: 'reduce', amount: -appliedReduction,
          })
        }
      } else if (sizeDamageMode === 'add') {
        damageComponents.push({
          total: sizeDamageTotal,
          type: attackDefinition.damage[0]?.type,
          source: 'enlarge',
        })
      }
      let cuttingWordsReduction = consumeCuttingWords(state, actor, supplied.cuttingWordsDamage, events)
      if (cuttingWordsReduction == null) return fail(state, events, 'invalid-class-feature')
      for (const component of damageComponents) {
        const reduction = Math.min(component.total, cuttingWordsReduction)
        cuttingWordsReduction -= reduction
        component.total -= reduction
      }
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const uncannyDamage = applyUncannyDodge(
      target,
      damageComponents.reduce((sum, component) => sum + component.total, 0),
      supplied.uncannyDodge,
      events,
    )
    if (uncannyDamage == null) return fail(state, events, 'invalid-class-feature')
    const deflectedDamage = applyDeflectMissiles(
      state,
      actor,
      target,
      uncannyDamage,
      attackDefinition.mode === 'ranged',
      supplied.deflectMissilesD10,
      attackDefinition.damage[0]?.type,
      events,
    )
    if (deflectedDamage == null) return fail(state, events, 'invalid-class-feature')
    const mechanicDamageModifier = consumeDnd5eMonsterMechanicRollModifiers(actor, 'damage', events)
    if (mechanicDamageModifier.bonus > 0) {
      damageComponents.push({
        total: mechanicDamageModifier.bonus,
        type: attackDefinition.damage[0]?.type,
      })
    } else if (mechanicDamageModifier.bonus < 0) {
      subtractFromWeaponDamage(damageComponents, -mechanicDamageModifier.bonus)
    }
    damageComponents = adjustDnd5eDamageComponents(
      target,
      scaleDnd5eDamageComponents(damageComponents, deflectedDamage),
    )
    for (const component of damageComponents) {
      if (component.source === 'enlarge') {
        events.push({
          type: 'class-damage-applied', actorId: actor.id, targetId: target.id,
          source: component.source, amount: component.total,
        })
      }
    }
    applyDamage(
      target,
      damageComponents.reduce((sum, component) => sum + component.total, 0),
      critical,
      events,
      actor,
      state,
      [...attackDefinition.damage, ...criticalExtraDamage].map((entry) => entry.type),
    )
    const onHitRule = attackDefinition.onHitRule
    if (
      onHitRule?.kind === 'saving-throw-condition' && target.currentHp > 0 && !target.deathSaves.dead &&
      !dnd5eConditionImmuneFromSource(target, onHitRule.condition, actor)
    ) {
      target.classState.monsterOnHitSavePending = {
        sourceId: actor.id,
        actionId: action.actionId,
        ability: onHitRule.ability,
        dc: onHitRule.dc,
        condition: onHitRule.condition,
      }
      events.push({
        type: 'monster-on-hit-save-required',
        targetId: target.id,
        sourceId: actor.id,
        actionId: action.actionId,
        ability: onHitRule.ability,
        dc: onHitRule.dc,
        condition: onHitRule.condition,
      })
    }
    if (!legendary && !afterHitMechanicResolved && (action.mechanicRolls?.length ?? 0) > 0) {
      if (!resolveDnd5eMonsterMechanics({
        state,
        actor,
        monster,
        event: 'after-hit',
        supplied: action.mechanicRolls,
        triggerTarget: target,
        events,
      })) return fail(state, events, 'invalid-dice')
      afterHitMechanicResolved = true
    }
  }
  if (!legendary && !afterHitMechanicResolved && (action.mechanicRolls?.length ?? 0) > 0 && !resolveDnd5eMonsterMechanics({
    state,
    actor,
    monster,
    event: 'after-hit',
    supplied: action.mechanicRolls,
    events,
  })) return fail(state, events, 'invalid-dice')
  return { ok: true, state, events }
}

function resolveMonsterSpecialAction(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monster-special-action' | 'monster-legendary-special-action' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  const legendary = action.type === 'monster-legendary-special-action'
  const definition = legendary
    ? monster?.legendaryActions?.find((candidate) => candidate.id === action.actionId)
    : monster?.actions.find((candidate) => candidate.id === action.actionId)
  const rule = definition?.rule
  if (
    !actor || actor.currentHp <= 0 || !monster || !definition || !rule ||
    definition.kind !== 'other' || dnd5eMonsterActionAutomation(definition) !== 'headless'
  ) return fail(state, events, 'invalid-monster-action')
  if (legendary && state.initiativeOrder[state.initiativeIndex] === actor.id) {
    return fail(state, events, 'invalid-monster-action')
  }

  const target = action.targetId ? state.combatants[action.targetId] : undefined
  if (rule.kind === 'ability-check') {
    if (
      action.targetId != null || action.damageRolls?.length ||
      !Number.isInteger(action.d20) || action.d20! < 1 || action.d20! > 20 ||
      action.d20Second != null || action.blessRoll != null || action.baneRoll != null ||
      action.rerollD20 != null || action.rerollD20Second != null ||
      action.bardicInspirationRoll != null || action.darkOnesOwnLuckRoll != null ||
      action.legendaryResistance != null
    ) return fail(state, events, 'invalid-dice')
  } else if (rule.kind === 'saving-throw-condition') {
    const distanceFeet = target ? dnd5eAttackDistanceFeet(state, actor.id, target.id) : Number.POSITIVE_INFINITY
    if (
      !target || target.id === actor.id || target.currentHp <= 0 || target.deathSaves.dead ||
      dnd5eCombatantIsBanished(target) || distanceFeet > rule.rangeFeet ||
      action.damageRolls?.length || !Number.isInteger(action.d20) ||
      action.d20! < 1 || action.d20! > 20
    ) return fail(state, events, 'invalid-target')
  } else {
    const activeEffects = target ? reconciledDnd5eActiveEffects(target) : []
    const qualifyingCondition = activeEffects.some((effect) =>
      effect.standardCondition === rule.requiredCondition &&
      (!rule.requireSameSource || effect.source.actorId === actor.id),
    )
    if (
      !target || target.id === actor.id || target.currentHp <= 0 || target.deathSaves.dead ||
      dnd5eCombatantIsBanished(target) || !qualifyingCondition ||
      action.d20 != null || action.d20Second != null || action.blessRoll != null ||
      action.baneRoll != null || action.rerollD20 != null || action.rerollD20Second != null ||
      action.bardicInspirationRoll != null || action.darkOnesOwnLuckRoll != null ||
      action.legendaryResistance != null ||
      action.damageRolls?.length !== rule.damage.count ||
      action.damageRolls.some((roll) =>
        !Number.isInteger(roll) || roll < 1 || roll > rule.damage.sides)
    ) return fail(state, events, 'invalid-dice')
  }

  if (legendary) {
    const cost = Math.max(1, definition.legendaryCost ?? 1)
    const available = actor.classState.monsterLegendaryActionPoints ?? 0
    if (available < cost) return fail(state, events, 'class-resource-unavailable')
    actor.classState.monsterLegendaryActionPoints = available - cost
    events.push({
      type: 'monster-legendary-action-used', actorId: actor.id, actionId: definition.id,
      cost, remaining: actor.classState.monsterLegendaryActionPoints,
    })
  } else {
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
  }

  if (definition.usage?.kind === 'per-day') {
    const resource = actor.classState.monsterActionUsesByActionId?.[definition.id]
    if (!resource || resource.current < 1) return fail(state, events, 'class-resource-unavailable')
    resource.current -= 1
  }

  if (rule.kind === 'ability-check') {
    const modifier = rule.skillKey
      ? monster.skills?.find((skill) => skill.key === rule.skillKey)?.bonus ??
        rules.abilityModifier(monster.abilities[rule.ability])
      : rules.abilityModifier(monster.abilities[rule.ability])
    const total = action.d20! + modifier
    events.push({
      type: 'ability-check-resolved', actorId: actor.id, ability: rule.ability,
      skill: rule.skillKey, d20: action.d20!, modifier, total, mode: 'normal',
      reliableTalentApplied: false,
    })
    events.push({
      type: 'monster-special-action-resolved', actorId: actor.id, actionId: definition.id,
      legendary, total,
    })
    if (legendary && definition.id === 'detect') {
      events.push({
        type: 'monster-legendary-detect-resolved', actorId: actor.id,
        actionId: definition.id, d20: action.d20!, modifier, total,
      })
    }
    return { ok: true, state, events }
  }

  if (rule.kind === 'saving-throw-condition') {
    const targetCombatant = target!
    const mode = dnd5eSavingThrowMode(targetCombatant, rule.ability, {
      effectVisible: true,
      condition: rule.condition,
      sourceCreatureType: actor.creatureType,
      sourceIsSpell: false,
    })
    let save: SavingThrowResolution
    try {
      const modifier = (targetCombatant.savingThrowBonuses[rule.ability] ??
        rules.abilityModifier(targetCombatant.abilities[rule.ability])) +
        resolveDnd5eBlessRoll(state, targetCombatant, action.blessRoll) -
        resolveDnd5eBaneRoll(state, targetCombatant, action.baneRoll)
      save = resolveSavingThrowWithClassReroll({
        combatant: targetCombatant,
        ability: rule.ability,
        rolls: mode === 'normal' ? [action.d20!] : [action.d20!, action.d20Second ?? 0],
        rerollD20: action.rerollD20,
        rerollD20Second: action.rerollD20Second,
        bardicInspirationRoll: action.bardicInspirationRoll,
        darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
        mode,
        modifier,
        dc: rule.dc,
        events,
        legendaryResistance: action.legendaryResistance,
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    events.push({
      type: 'saving-throw-resolved', targetId: targetCombatant.id, ability: rule.ability,
      d20: save.roll.d20, modifier: save.roll.modifier, total: save.roll.total,
      dc: rule.dc, success: save.success,
    })
    if (!save.success) {
      const rulesId = `monster:${monster.id}:${definition.id}`
      const applied = applyDnd5eStandardConditionEffect(targetCombatant, actor, {
        rulesId,
        condition: rule.condition,
        duration: { type: 'permanent' },
        repeatSave: rule.repeatSaveOnDamage
          ? {
              ability: rule.ability,
              dc: rule.dc,
              timing: 'on-damage',
              onDamage: { mode: 'normal' },
              onSuccess: 'remove',
            }
          : undefined,
        sourceKind: 'monster',
      }, events)
      if (applied && rule.preventReactions) {
        applyDnd5eMechanicalStatusEffect(targetCombatant, actor, {
          definitionId: `${rulesId}:reaction-lock`,
          rulesId,
          label: `${definition.name}：无法进行反应`,
          duration: { type: 'permanent' },
          preventReactions: true,
          sourceKind: 'monster',
        }, events)
        targetCombatant.turn.reactionAvailable = false
      }
    }
    events.push({
      type: 'monster-special-action-resolved', actorId: actor.id, actionId: definition.id,
      legendary, targetId: targetCombatant.id, success: save.success,
    })
    return { ok: true, state, events }
  }

  const targetCombatant = target!
  let rawDamage: number
  try {
    rawDamage = rules.resolveDamage({
      count: rule.damage.count,
      sides: rule.damage.sides,
      bonus: rule.damage.bonus,
      rolls: action.damageRolls!,
    }).total
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  const temporaryHpBefore = targetCombatant.temporaryHp
  const hpBefore = targetCombatant.currentHp
  const adjustedDamage = adjustDamageForTarget(targetCombatant, rawDamage, rule.damage.type)
  applyDamage(
    targetCombatant,
    adjustedDamage,
    false,
    events,
    actor,
    state,
    [rule.damage.type],
  )
  const damageTaken = Math.max(
    0,
    temporaryHpBefore - targetCombatant.temporaryHp + hpBefore - targetCombatant.currentHp,
  )
  const healing = applyHealing(actor, damageTaken, events)
  events.push({
    type: 'monster-special-action-resolved', actorId: actor.id, actionId: definition.id,
    legendary, targetId: targetCombatant.id, damage: damageTaken, healing,
  })
  return { ok: true, state, events }
}

function applyMonsterAdjudicatedEffects(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  rulesId: string,
  effects: readonly Dnd5eMonsterAdjudicatedEffect[],
  events: Dnd5eCombatEvent[],
): boolean {
  if (effects.length > 128) return false
  for (const effect of effects) {
    const target = state.combatants[effect.targetId]
    if (
      !target ||
      (effect.amount != null && (!Number.isFinite(effect.amount) || effect.amount < 0 || effect.amount > 1_000_000)) ||
      (effect.damageType != null && !DND5E_DAMAGE_TYPES.includes(effect.damageType))
    ) return false
  }
  for (const effect of effects) {
    const target = state.combatants[effect.targetId]!
    const amount = Math.max(0, Math.floor(effect.amount ?? 0))
    if (effect.operation === 'damage') {
      const adjusted = effect.damageType ? adjustDamageForTarget(target, amount, effect.damageType) : amount
      applyDamage(target, adjusted, false, events, actor, state, effect.damageType ? [effect.damageType] : [])
    } else if (effect.operation === 'healing') {
      applyHealing(target, amount, events)
    } else if (effect.operation === 'temporary-hit-points') {
      applyTemporaryHitPoints(target, amount, events)
    }
    const removeCondition = effect.removeCondition?.trim()
    if (removeCondition) removeDnd5eConditionEffects(target, [removeCondition], 'dm', events)
    const addCondition = effect.addCondition?.trim()
    if (addCondition) {
      applyDnd5eRulesCondition(target, actor, {
        condition: addCondition,
        rulesId,
        sourceKind: 'monster',
        duration: effect.conditionDuration,
      }, events)
    }
  }
  return true
}

function resolveDnd5eLegendaryDetect(
  actor: Dnd5eCombatant,
  monster: Dnd5eMonsterStatBlock,
  action: Extract<Dnd5eAction, { type: 'monster-adjudicated-action' }>,
  events: Dnd5eCombatEvent[],
): boolean {
  if (
    action.actionId !== 'detect' ||
    action.effects.length !== 0 ||
    action.targetSavingThrows?.length ||
    action.damageRolls?.length ||
    !Number.isInteger(action.d20) ||
    action.d20! < 1 ||
    action.d20! > 20
  ) return false
  const modifier = monster.skills?.find((skill) => skill.key === 'perception')?.bonus ??
    rules.abilityModifier(monster.abilities.wis)
  events.push({
    type: 'monster-legendary-detect-resolved',
    actorId: actor.id,
    actionId: action.actionId,
    d20: action.d20!,
    modifier,
    total: action.d20! + modifier,
  })
  return true
}

function resolveDnd5eLegendaryWingAttack(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  monster: Dnd5eMonsterStatBlock,
  definition: Dnd5eMonsterAction,
  action: Extract<Dnd5eAction, { type: 'monster-adjudicated-action' }>,
  events: Dnd5eCombatEvent[],
): boolean {
  const rule = parseDnd5eLegendaryWingAttack(definition.id, definition.description)
  if (!rule || action.effects.length !== 0 || action.d20 != null) return false
  const expectedTargets = Object.values(state.combatants).filter((candidate) =>
    candidate.id !== actor.id &&
    candidate.controller !== actor.controller &&
    candidate.currentHp > 0 &&
    !candidate.deathSaves.dead &&
    !dnd5eCombatantIsBanished(candidate) &&
    dnd5eAttackDistanceFeet(state, actor.id, candidate.id) <= rule.rangeFeet
  )
  const supplied = action.targetSavingThrows ?? []
  if (
    supplied.length !== expectedTargets.length ||
    new Set(supplied.map((roll) => roll.targetId)).size !== supplied.length ||
    supplied.some((roll) => !expectedTargets.some((target) => target.id === roll.targetId)) ||
    action.damageRolls?.length !== rule.damage.count ||
    action.damageRolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > rule.damage.sides)
  ) return false
  try {
    const damage = rules.resolveDamage({ ...rule.damage, rolls: action.damageRolls }).total
    for (const target of expectedTargets) {
      const roll = supplied.find((candidate) => candidate.targetId === target.id)!
      const mode = dnd5eSavingThrowMode(target, 'dex', {
        effectVisible: true,
        sourceCreatureType: actor.creatureType,
        sourceIsSpell: false,
      })
      const rolls = mode === 'normal' ? [roll.d20] : [roll.d20, roll.d20Second ?? 0]
      const modifier = (target.savingThrowBonuses.dex ?? rules.abilityModifier(target.abilities.dex)) +
        resolveDnd5eBlessRoll(state, target, roll.blessRoll) -
        resolveDnd5eBaneRoll(state, target, roll.baneRoll)
      const save = resolveSavingThrowWithClassReroll({
        combatant: target,
        ability: 'dex',
        rolls,
        rerollD20: roll.rerollD20,
        rerollD20Second: roll.rerollD20Second,
        bardicInspirationRoll: roll.bardicInspirationRoll,
        darkOnesOwnLuckRoll: roll.darkOnesOwnLuckRoll,
        mode,
        modifier,
        dc: rule.saveDc,
        events,
        legendaryResistance: roll.legendaryResistance,
      })
      events.push({
        type: 'saving-throw-resolved',
        targetId: target.id,
        ability: 'dex',
        d20: save.roll.d20,
        modifier,
        total: save.roll.total,
        dc: rule.saveDc,
        success: save.success,
      })
      if (save.success) continue
      applyDamage(
        target,
        adjustDamageForTarget(target, damage, 'bludgeoning'),
        false,
        events,
        actor,
        state,
        ['bludgeoning'],
      )
      applyDnd5eRulesCondition(target, actor, {
        condition: 'prone',
        rulesId: `monster:${monster.id}:${definition.id}`,
        sourceKind: 'monster',
        duration: { type: 'permanent' },
      }, events)
    }
    const movementGranted = Math.max(0, Math.floor((monster.speed.fly ?? 0) / 2))
    actor.turn.movementRemaining += movementGranted
    if (movementGranted > 0) {
      events.push({ type: 'movement-granted', actorId: actor.id, amount: movementGranted })
    }
    events.push({
      type: 'monster-legendary-wing-attack-resolved',
      actorId: actor.id,
      actionId: definition.id,
      targetIds: expectedTargets.map((target) => target.id),
      damage,
      movementGranted,
    })
    return true
  } catch {
    return false
  }
}

function resolveMonsterAdjudicatedAction(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monster-adjudicated-action' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  const legendary = action.legendary === true
  const definition = legendary
    ? monster?.legendaryActions?.find((candidate) => candidate.id === action.actionId)
    : monster?.actions.find((candidate) => candidate.id === action.actionId)
  if (!actor || actor.currentHp <= 0 || !monster || !definition || dnd5eMonsterActionAutomation(definition) !== 'dm-adjudication') {
    return fail(state, events, 'invalid-monster-action')
  }
  if (legendary) {
    if (state.initiativeOrder[state.initiativeIndex] === actor.id) return fail(state, events, 'invalid-monster-action')
    const cost = Math.max(1, definition.legendaryCost ?? 1)
    const available = actor.classState.monsterLegendaryActionPoints ?? 0
    if (available < cost) return fail(state, events, 'class-resource-unavailable')
    actor.classState.monsterLegendaryActionPoints = available - cost
    events.push({
      type: 'monster-legendary-action-used', actorId: actor.id, actionId: definition.id,
      cost, remaining: actor.classState.monsterLegendaryActionPoints,
    })
  } else {
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
  }
  if (definition.usage?.kind === 'recharge') {
    if (actor.classState.monsterRechargeReadyByActionId?.[definition.id] === false) {
      return fail(state, events, 'class-resource-unavailable')
    }
    actor.classState.monsterRechargeReadyByActionId = {
      ...actor.classState.monsterRechargeReadyByActionId,
      [definition.id]: false,
    }
  } else if (definition.usage?.kind === 'per-day') {
    const resource = actor.classState.monsterActionUsesByActionId?.[definition.id]
    if (!resource || resource.current < 1) return fail(state, events, 'class-resource-unavailable')
    resource.current -= 1
  }
  if (legendary && definition.id === 'detect') {
    if (!resolveDnd5eLegendaryDetect(actor, monster, action, events)) {
      return fail(state, events, 'invalid-monster-action')
    }
    return { ok: true, state, events }
  }
  if (legendary && definition.id === 'wing-attack-costs-2-actions') {
    if (!resolveDnd5eLegendaryWingAttack(state, actor, monster, definition, action, events)) {
      return fail(state, events, 'invalid-monster-action')
    }
    return { ok: true, state, events }
  }
  if (action.d20 != null || action.targetSavingThrows?.length || action.damageRolls?.length) {
    return fail(state, events, 'invalid-monster-action')
  }
  if (!applyMonsterAdjudicatedEffects(state, actor, `monster:${monster.id}:${definition.id}`, action.effects, events)) {
    return fail(state, events, 'invalid-monster-action')
  }
  events.push({
    type: 'monster-adjudicated-action-resolved', actorId: actor.id, actionId: definition.id,
    legendary, effectCount: action.effects.length,
  })
  return { ok: true, state, events }
}

function resolveMonsterSpell(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monster-spell' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  const spell = monster?.spellcasting?.spells?.find((candidate) => candidate.id === action.spellId)
  if (
    !actor || actor.currentHp <= 0 || !monster?.spellcasting || !spell ||
    !Number.isInteger(action.slotLevel) || action.slotLevel < spell.level || action.slotLevel > 9
  ) return fail(state, events, 'invalid-monster-action')
  if (
    monster.spellcasting.componentsRequired?.includes('V') &&
    actor.conditions.some((condition) => ['silenced', '沉默'].includes(condition.toLowerCase()))
  ) return fail(state, events, 'invalid-monster-action')
  const coreSpell = getDnd5eSrdCombatSpell(spell.id)
  if (coreSpell && action.effects.some((effect) => {
    const allowsDamage = ['spell-attack', 'saving-throw', 'automatic-damage', 'persistent-area', 'power-word-kill']
      .includes(coreSpell.effect)
    const allowsHealing = ['healing', 'fixed-healing', 'healing-pool'].includes(coreSpell.effect)
    const allowsTemporaryHitPoints = coreSpell.effect === 'temporary-hit-points'
    const allowsConditionRemoval = coreSpell.effect === 'remove-condition'
    return (
      (effect.operation === 'damage' && !allowsDamage) ||
      (effect.operation === 'healing' && !allowsHealing) ||
      (effect.operation === 'temporary-hit-points' && !allowsTemporaryHitPoints) ||
      (effect.removeCondition != null && !allowsConditionRemoval)
    )
  })) return fail(state, events, 'invalid-monster-action')
  if (!spendDnd5eMonsterSpellEconomy(actor, coreSpell?.castingTime ?? 'action', events)) {
    return fail(state, events, coreSpell?.castingTime === 'reaction'
      ? 'reaction-unavailable'
      : coreSpell?.castingTime === 'bonus-action'
        ? 'bonus-action-unavailable'
        : 'action-unavailable')
  }
  let remainingSlots: number | undefined
  if (spell.usage?.kind === 'per-day') {
    const resource = actor.classState.monsterSpellUsesBySpellId?.[spell.id]
    if (!resource || resource.current < 1) return fail(state, events, 'class-resource-unavailable')
    resource.current -= 1
    remainingSlots = resource.current
  } else if (spell.usage?.kind !== 'at-will' && spell.level > 0) {
    const resource = actor.classState.monsterSpellSlots?.[String(action.slotLevel)]
    if (!resource || resource.current < 1) return fail(state, events, 'class-resource-unavailable')
    resource.current -= 1
    remainingSlots = resource.current
  }
  if (!applyMonsterAdjudicatedEffects(state, actor, `monster-spell:${monster.id}:${spell.id}`, action.effects, events)) {
    return fail(state, events, 'invalid-monster-action')
  }
  events.push({ type: 'monster-spell-cast', actorId: actor.id, spellId: spell.id, slotLevel: action.slotLevel, remainingSlots })
  return { ok: true, state, events }
}

function spendDnd5eMonsterSpellEconomy(
  actor: Dnd5eCombatant,
  castingTime: 'action' | 'bonus-action' | 'reaction',
  events: Dnd5eCombatEvent[],
): boolean {
  const resource: TurnResource = castingTime === 'bonus-action'
    ? 'bonusAction'
    : castingTime === 'reaction'
      ? 'reaction'
      : 'action'
  if (!spend(actor, resource)) return false
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource })
  return true
}

function spendDnd5eMonsterSpellResource(
  actor: Dnd5eCombatant,
  spell: NonNullable<NonNullable<Dnd5eMonsterStatBlock['spellcasting']>['spells']>[number],
  slotLevel: number,
): number | undefined | false {
  if (spell.usage?.kind === 'per-day') {
    const resource = actor.classState.monsterSpellUsesBySpellId?.[spell.id]
    if (!resource || resource.current < 1) return false
    resource.current -= 1
    return resource.current
  }
  if (spell.usage?.kind === 'at-will' || spell.level === 0) return undefined
  const resource = actor.classState.monsterSpellSlots?.[String(slotLevel)]
  if (!resource || resource.current < 1) return false
  resource.current -= 1
  return resource.current
}

function isUndeadOrConstructMonsterSpellTarget(target: Dnd5eCombatant): boolean {
  const creatureType = (target.creatureType ?? '').trim().toLowerCase()
  return creatureType === 'undead' || creatureType.includes('亡灵') ||
    creatureType === 'construct' || creatureType.includes('构装')
}

function resolveMonsterCoreSpell(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monster-core-spell' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  const listedSpell = monster?.spellcasting?.spells?.find((candidate) => candidate.id === action.spellId)
  const spell = listedSpell ? getDnd5eSrdCombatSpell(listedSpell.id) : undefined
  const resolution = action.resolution
  const compatibility = spell ? dnd5eMonsterCoreSpellCompatibility(spell) : undefined
  const targetIds = [...new Set(resolution?.targetIds ?? [])]
  const targets = targetIds.map((targetId) => state.combatants[targetId])
  const casterLevel = Math.max(1, monster?.spellcasting?.casterLevel ?? 1)
  if (
    !actor ||
    actor.currentHp <= 0 ||
    !monster?.spellcasting ||
    !listedSpell ||
    !spell ||
    compatibility?.automation !== 'full' ||
    resolution?.schemaVersion !== 1 ||
    targetIds.length !== resolution.targetIds.length ||
    (spell.effect !== 'teleport' && targetIds.length < 1) ||
    targetIds.length > dnd5eSpellMaximumTargets(spell, action.slotLevel, casterLevel) ||
    targets.some((target) => !target || target.deathSaves.dead || dnd5eCombatantIsBanished(target)) ||
    !Number.isInteger(action.slotLevel) ||
    action.slotLevel < listedSpell.level ||
    action.slotLevel > 9
  ) return fail(state, events, 'invalid-monster-action')
  if (
    (spell.effect === 'teleport') !== (resolution.teleportDestination != null) ||
    (resolution.teleportDestination && (
      targetIds.length !== 0 ||
      !Number.isFinite(resolution.teleportDestination.to.x) ||
      !Number.isFinite(resolution.teleportDestination.to.y) ||
      !Number.isFinite(resolution.teleportDestination.distanceFeet) ||
      resolution.teleportDestination.distanceFeet < 0 ||
      resolution.teleportDestination.distanceFeet > 30 ||
      (resolution.teleportDestination.toElevationFeet != null &&
        !Number.isFinite(resolution.teleportDestination.toElevationFeet))
    ))
  ) return fail(state, events, 'invalid-target')
  if (
    monster.spellcasting.componentsRequired?.includes('V') &&
    actor.conditions.some((condition) => ['silenced', '沉默'].includes(condition.toLowerCase()))
  ) return fail(state, events, 'invalid-monster-action')
  if (targets.some((target) => {
    const hostile = target!.controller !== actor.controller
    if (spell.target === 'hostile' && !hostile) return true
    if (spell.target === 'ally' && hostile) return true
    if (spell.target === 'hostile' && dnd5eCannotAttackSource(actor, target!.id)) return true
    if (!spell.area && dnd5eAttackDistanceFeet(state, actor.id, target!.id) > spell.rangeFeet) return true
    if (!spell.area && state.lineOfEffectBlockedByCombatantPair?.[
      dnd5eDirectedCombatantPairKey(actor.id, target!.id)
    ]) return true
    if (
      ['healing', 'stabilize'].includes(spell.effect) &&
      isUndeadOrConstructMonsterSpellTarget(target!)
    ) return true
    if (
      spell.id === 'charm-person' &&
      !dnd5eCharmPersonEligibleCreatureType(target!.creatureType)
    ) return true
    return spell.target === 'hostile' && dnd5eTranquilityWardCheck(actor, target!, state) != null
  })) return fail(state, events, 'invalid-target')
  const legendaryResistanceTargetIds = new Set(resolution.legendaryResistanceTargetIds ?? [])
  if (
    legendaryResistanceTargetIds.size !== (resolution.legendaryResistanceTargetIds?.length ?? 0) ||
    [...legendaryResistanceTargetIds].some((targetId) => !targetIds.includes(targetId))
  ) return fail(state, events, 'invalid-monster-action')
  const expectedDiceCount = dnd5eSpellDiceCount(spell, casterLevel, action.slotLevel)
  const automaticProjectiles = spell.effect === 'automatic-damage'
    ? [...resolution.projectileTargetIds ?? []]
    : []
  const shieldSpellReactionTargetIds = [...new Set(resolution.shieldSpellReactionTargetIds ?? [])]
  if (
    (spell.effect === 'automatic-damage' && (
      automaticProjectiles.length !== expectedDiceCount ||
      automaticProjectiles.some((targetId) => !targetIds.includes(targetId)) ||
      resolution.effectRolls.length !== expectedDiceCount ||
      resolution.effectRolls.some((rolls) =>
        rolls.length !== 1 || !Number.isInteger(rolls[0]) || rolls[0] < 1 || rolls[0] > spell.dice.sides)
    )) ||
    (spell.effect !== 'automatic-damage' && (
      (resolution.projectileTargetIds?.length ?? 0) > 0 ||
      shieldSpellReactionTargetIds.length > 0
    )) ||
    shieldSpellReactionTargetIds.length !== (resolution.shieldSpellReactionTargetIds?.length ?? 0) ||
    shieldSpellReactionTargetIds.some((targetId) => !targetIds.includes(targetId))
  ) return fail(state, events, 'invalid-dice')
  const expectedRollGroups = (
    ['spell-attack', 'healing'].includes(spell.effect) ||
    (spell.effect === 'saving-throw' && expectedDiceCount > 0)
  ) ? 1 : 0
  const suppliedPrimaryRollCount = resolution.effectRolls[0]?.length ?? 0
  if (
    (spell.effect !== 'automatic-damage' && resolution.effectRolls.length !== expectedRollGroups) ||
    (expectedRollGroups === 1 && (
      (spell.effect === 'spell-attack'
        ? suppliedPrimaryRollCount !== expectedDiceCount && suppliedPrimaryRollCount !== expectedDiceCount * 2
        : suppliedPrimaryRollCount !== expectedDiceCount) ||
      resolution.effectRolls[0].some((roll) => !Number.isInteger(roll) || roll < 1 || roll > spell.dice.sides)
    ))
  ) return fail(state, events, 'invalid-dice')
  if (!spendDnd5eMonsterSpellEconomy(actor, spell.castingTime, events)) {
    return fail(state, events, spell.castingTime === 'reaction'
      ? 'reaction-unavailable'
      : spell.castingTime === 'bonus-action'
        ? 'bonus-action-unavailable'
        : 'action-unavailable')
  }
  const remainingSlots = spendDnd5eMonsterSpellResource(actor, listedSpell, action.slotLevel)
  if (remainingSlots === false) return fail(state, events, 'class-resource-unavailable')
  if (spell.target === 'hostile') {
    endTranquilityForHostileAction(actor, events, 'casts-spell')
    for (const target of targets) {
      if (target) endCharmPersonForHarmfulAction(state, actor, target, events)
    }
  }
  const counterspell = applyCounterspellReaction({
    state,
    caster: actor,
    spellId: spell.id,
    spellLevel: action.slotLevel,
    reaction: action.counterspellReaction,
    events,
  })
  if (!counterspell) return fail(state, events, 'invalid-class-feature')
  if (counterspell.success) {
    events.push({
      type: 'monster-spell-cast',
      actorId: actor.id,
      spellId: spell.id,
      slotLevel: action.slotLevel,
      remainingSlots,
    })
    return { ok: true, state, events }
  }

  try {
    if (spell.effect === 'teleport') {
      const destination = resolution.teleportDestination!
      const from = { ...actor.position }
      const fromElevationFeet = actor.elevationFeet ?? 0
      const toElevationFeet = destination.toElevationFeet ?? fromElevationFeet
      actor.position = { ...destination.to }
      actor.elevationFeet = toElevationFeet
      actor.airborne = toElevationFeet > 0 && actor.airborne
      events.push({
        type: 'teleported',
        actorId: actor.id,
        spellId: spell.id,
        from,
        to: actor.position,
        distanceFeet: destination.distanceFeet,
        fromElevationFeet,
        toElevationFeet,
      })
    } else if (spell.effect === 'stabilize') {
      if (targets.length !== 1 || targets[0]!.currentHp !== 0) return fail(state, events, 'invalid-target')
      targets[0]!.deathSaves = { successes: 0, failures: 0, stable: true, dead: false }
      events.push({ type: 'creature-stabilized', actorId: actor.id, targetId: targets[0]!.id })
    } else if (spell.effect === 'healing') {
      const ability = monster.spellcasting.ability
      const bonus = spell.dice.bonus + (spell.addSpellcastingModifier && ability
        ? rules.abilityModifier(monster.abilities[ability])
        : 0)
      const healing = rules.resolveDamage({
        count: expectedDiceCount,
        sides: spell.dice.sides,
        bonus,
        rolls: resolution.effectRolls[0],
      }).total
      for (const target of targets) applyHealing(target!, healing, events)
    } else if (
      spell.effect === 'active-effect' &&
      (spell.appliedEffect === 'darkvision' || spell.appliedEffect === 'see-invisibility')
    ) {
      if (spell.appliedEffect === 'see-invisibility' && (
        targets.length !== 1 || targets[0]!.id !== actor.id
      )) return fail(state, events, 'invalid-target')
      for (const target of targets) {
        applyDnd5eMechanicalStatusEffect(target!, actor, {
          definitionId: `srd-5.1:spell:${spell.appliedEffect}`,
          rulesId: spell.id,
          label: spell.appliedEffect === 'darkvision'
            ? '黑暗视觉：获得60尺黑暗视觉'
            : '识破隐形：将隐形生物和物件视为可见',
          appliedTurnKey: classFeatureTurnKey(state, actor.id),
          spellLevel: action.slotLevel,
          duration: {
            type: 'rounds',
            remainingRounds: spell.effectDurationRounds ?? 4_800,
            tickOn: 'target-turn-end',
          },
          darkvisionRangeFeet: spell.appliedEffect === 'darkvision' ? 60 : undefined,
          seeInvisible: spell.appliedEffect === 'see-invisibility' ? true : undefined,
        }, events)
      }
    } else if (spell.effect === 'active-effect' && spell.appliedEffect === 'magic-weapon') {
      if (targets.length !== 1 || !targets[0]!.mainWeaponId || targets[0]!.mainWeaponMagical) {
        return fail(state, events, 'invalid-target')
      }
      const target = targets[0]!
      const weaponId = target.mainWeaponId!
      const durationRounds = spell.concentrationDurationRounds ?? 600
      beginDnd5eConcentration(
        state,
        actor,
        spell.id,
        [target.id],
        durationRounds,
        events,
        action.slotLevel,
      )
      const bonus = action.slotLevel >= 6 ? 3 : action.slotLevel >= 4 ? 2 : 1
      applyDnd5eMechanicalStatusEffect(target, actor, {
        definitionId: 'srd-5.1:spell:magic-weapon',
        rulesId: spell.id,
        label: `魔化武器：命中与伤害+${bonus}`,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        spellLevel: action.slotLevel,
        duration: {
          type: 'concentration',
          sourceActorId: actor.id,
          concentrationId: spell.id,
          remainingRounds: durationRounds,
        },
        magicWeapon: {
          weaponId,
          bonus,
        },
      }, events)
    } else if (spell.effect === 'spell-attack') {
      if (targets.length !== 1 || monster.spellcasting.attackBonus == null || resolution.d20 == null) {
        return fail(state, events, 'invalid-monster-action')
      }
      if ((resolution.targetSavingThrows?.length ?? 0) > 0) return fail(state, events, 'invalid-dice')
      const target = targets[0]!
      const mode = dnd5eMonsterSpellAttackMode(state, actor.id, target.id)
      const d20s = mode === 'normal'
        ? [resolution.d20]
        : [resolution.d20, resolution.d20Second ?? 0]
      const targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
      const attack = rules.resolveAttack({
        rolls: d20s,
        mode,
        modifier: monster.spellcasting.attackBonus,
        targetAc: targetArmorClass,
      })
      const { hit, critical } = resolveDnd5eAttackOutcome({
        attack,
        targetArmorClass,
        automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
      })
      emitDnd5eAttackResolved(state, {
        type: 'attack-resolved',
        actorId: actor.id,
        targetId: target.id,
        d20: attack.roll.d20,
        total: attack.roll.total,
        armorClass: targetArmorClass,
        hit,
        critical,
      }, events)
      if (hit) {
        const damage = rules.resolveDamage({
          count: expectedDiceCount,
          sides: spell.dice.sides,
          bonus: spell.dice.bonus,
          rolls: resolution.effectRolls[0],
          critical,
        }).total
        applyDamage(
          target,
          adjustDamageForTarget(target, damage, spell.damageType),
          critical,
          events,
          actor,
          state,
          spell.damageType ? [spell.damageType] : [],
        )
      }
    } else if (spell.effect === 'saving-throw') {
      if (!spell.saveAbility || monster.spellcasting.saveDc == null || resolution.d20 != null) {
        return fail(state, events, 'invalid-monster-action')
      }
      const supplied = resolution.targetSavingThrows ?? []
      if (
        supplied.length !== targets.length ||
        new Set(supplied.map((roll) => roll.targetId)).size !== supplied.length ||
        supplied.some((roll) => !targetIds.includes(roll.targetId))
      ) return fail(state, events, 'invalid-dice')
      const damage = rules.resolveDamage({
        count: expectedDiceCount,
        sides: spell.dice.sides,
        bonus: spell.dice.bonus,
        rolls: resolution.effectRolls[0] ?? [],
      }).total
      for (const target of targets) {
        const suppliedRoll = supplied.find((roll) => roll.targetId === target!.id)!
        const mode = dnd5eSpellSpecificSavingThrowMode({
          spellId: spell.id,
          mode: dnd5eSavingThrowMode(target!, spell.saveAbility, {
            effectVisible: true,
            sourceCreatureType: actor.creatureType,
            sourceIsSpell: true,
          }),
          casterAndTargetAreFighting: actor.controller !== target!.controller,
        })
        const rolls = mode === 'normal'
          ? [suppliedRoll.d20]
          : [suppliedRoll.d20, suppliedRoll.d20Second ?? 0]
        const modifier = (target!.savingThrowBonuses[spell.saveAbility] ??
          rules.abilityModifier(target!.abilities[spell.saveAbility])) +
          resolveDnd5eBlessRoll(state, target!, suppliedRoll.blessRoll) -
          resolveDnd5eBaneRoll(state, target!, suppliedRoll.baneRoll)
        const save = resolveSavingThrowWithClassReroll({
          combatant: target!,
          ability: spell.saveAbility,
          rolls,
          rerollD20: suppliedRoll.rerollD20,
          rerollD20Second: suppliedRoll.rerollD20Second,
          bardicInspirationRoll: suppliedRoll.bardicInspirationRoll,
          darkOnesOwnLuckRoll: suppliedRoll.darkOnesOwnLuckRoll,
          mode,
          modifier,
          dc: monster.spellcasting.saveDc,
          events,
          legendaryResistance: legendaryResistanceTargetIds.has(target!.id),
        })
        events.push({
          type: 'saving-throw-resolved',
          targetId: target!.id,
          ability: spell.saveAbility,
          d20: save.roll.d20,
          modifier,
          total: save.roll.total,
          dc: monster.spellcasting.saveDc,
          success: save.success,
        })
        const finalDamage = dnd5eDamageAfterSavingThrow({
          creature: target!,
          ability: spell.saveAbility,
          damage: adjustDamageForTarget(target!, damage, spell.damageType),
          success: save.success,
          successfulSave: spell.damageOnSuccessfulSave ?? 'none',
        })
        if (finalDamage > 0) {
          applyDamage(
            target!,
            finalDamage,
            false,
            events,
            actor,
            state,
            spell.damageType ? [spell.damageType] : [],
          )
        }
        if (!save.success && spell.onFailedSaveEffect === 'charm-person') {
          applyDnd5eStandardConditionEffect(target!, actor, {
            id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:charmed`, actor.id, target!.id),
            rulesId: spell.id,
            appliedTurnKey: classFeatureTurnKey(state, actor.id),
            spellLevel: action.slotLevel,
            condition: 'charmed',
            duration: {
              type: 'rounds',
              remainingRounds: spell.effectDurationRounds ?? 600,
              tickOn: 'target-turn-end',
            },
          }, events)
        }
      }
    } else if (spell.effect === 'automatic-damage' && spell.id === 'magic-missile') {
      for (const shieldTargetId of shieldSpellReactionTargetIds) {
        const shieldTarget = state.combatants[shieldTargetId]
        if (!shieldTarget || applyShieldSpellReaction(state, shieldTarget, true, true, events) !== true) {
          return fail(state, events, 'invalid-class-feature')
        }
      }
      for (let projectileIndex = 0; projectileIndex < automaticProjectiles.length; projectileIndex += 1) {
        const projectileTarget = state.combatants[automaticProjectiles[projectileIndex]]
        if (!projectileTarget || projectileTarget.classState.shieldSpellActive) continue
        const damage = rules.resolveDamage({
          count: 1,
          sides: spell.dice.sides,
          bonus: spell.bonusPerDie ? 1 : 0,
          rolls: resolution.effectRolls[projectileIndex],
        }).total
        applyDamage(
          projectileTarget,
          adjustDamageForTarget(projectileTarget, damage, spell.damageType),
          false,
          events,
          actor,
          state,
          spell.damageType ? [spell.damageType] : [],
        )
      }
    } else if (spell.effect === 'power-word-kill') {
      if (targets.length !== 1) return fail(state, events, 'invalid-target')
      const target = targets[0]!
      if (target.currentHp <= 100) {
        const hpBefore = target.currentHp
        if (!consumeDnd5eDeathWard(target, 'instant-death', events)) {
          if (target.classState.wildShapeFormId) revertDnd5eWildShape(target, 0, events)
          finalizeDnd5eInstantDeath(state, target, events)
          events.push({ type: 'instant-death', sourceId: actor.id, targetId: target.id, hpBefore })
        }
      }
    } else if (spell.effect === 'power-word-stun') {
      if (targets.length !== 1) return fail(state, events, 'invalid-target')
      const target = targets[0]!
      if (target.currentHp <= (spell.hitPointThreshold ?? 150)) {
        applyDnd5eStandardConditionEffect(target, actor, {
          id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:stunned`, actor.id, target.id),
          rulesId: spell.id,
          appliedTurnKey: classFeatureTurnKey(state, actor.id),
          spellLevel: action.slotLevel,
          condition: 'stunned',
          duration: { type: 'permanent' },
          repeatSave: {
            ability: 'con',
            dc: monster.spellcasting.saveDc ?? 8,
            timing: 'target-turn-end',
            onSuccess: 'remove',
          },
        }, events)
      }
    } else {
      return fail(state, events, 'invalid-monster-action')
    }
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  events.push({
    type: 'monster-spell-cast',
    actorId: actor.id,
    spellId: spell.id,
    slotLevel: action.slotLevel,
    remainingSlots,
  })
  events.push({
    type: 'monster-core-spell-resolved',
    actorId: actor.id,
    spellId: spell.id,
    slotLevel: action.slotLevel,
    targetIds,
  })
  return { ok: true, state, events }
}

function applyDnd5eMonsterShapechangeForm(
  actor: Dnd5eCombatant,
  formId: string,
  events: Dnd5eCombatEvent[],
  forced: boolean,
): boolean {
  const fromId = actor.statBlockId
  const form = getDnd5eSrdMonster(formId)
  if (!fromId || !form || !dnd5eMonsterShapechangeFormIds(fromId).includes(formId)) return false
  if (!actor.classState.monsterShapechangeOriginalStatBlockId) {
    actor.classState.monsterShapechangeOriginalStatBlockId = fromId
  }
  const originalId = actor.classState.monsterShapechangeOriginalStatBlockId
  actor.statBlockId = form.id
  actor.classState.monsterShapechangeFormId = form.id === originalId ? undefined : form.id
  if (!actor.classState.monsterShapechangeFormId) {
    actor.classState.monsterShapechangeOriginalStatBlockId = undefined
  }
  actor.speed = Math.max(form.speed.walk, form.speed.fly ?? 0, form.speed.swim ?? 0, form.speed.climb ?? 0)
  actor.movementSpeeds = {
    walk: form.speed.walk,
    fly: form.speed.fly,
    swim: form.speed.swim,
    climb: form.speed.climb,
  }
  actor.turn.movementRemaining = Math.min(actor.turn.movementRemaining, actor.speed)
  actor.sizeRank = ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[form.size]
  actor.shapechanger = form.capabilities?.shapechanger === true ||
    dnd5eMonsterHasStructuredShapechange(form.id)
  events.push({
    type: 'monster-shapechanged',
    actorId: actor.id,
    fromStatBlockId: fromId,
    toStatBlockId: form.id,
    forced,
  })
  return true
}

function revertDnd5eMonsterShapechange(
  actor: Dnd5eCombatant,
  events: Dnd5eCombatEvent[],
): boolean {
  const originalId = actor.classState.monsterShapechangeOriginalStatBlockId
  return !!originalId && applyDnd5eMonsterShapechangeForm(actor, originalId, events, true)
}

function resolveMonsterShapechange(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monster-shapechange' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  if (
    !actor ||
    actor.currentHp <= 0 ||
    !actor.statBlockId ||
    (!actor.shapechanger && !dnd5eMonsterHasStructuredShapechange(actor.statBlockId)) ||
    !dnd5eMonsterShapechangeFormIds(actor.statBlockId).includes(action.formId)
  ) return fail(state, events, 'invalid-monster-action')
  if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
  if (!applyDnd5eMonsterShapechangeForm(actor, action.formId, events, false)) {
    return fail(state, events, 'invalid-monster-action')
  }
  return { ok: true, state, events }
}

function resolveMonsterLairAction(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monster-lair-action' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  const definition = monster?.lairActions?.find((candidate) => candidate.id === action.actionId)
  if (
    !actor ||
    actor.currentHp <= 0 ||
    !monster ||
    !definition ||
    dnd5eMonsterActionAutomation(definition) !== 'dm-adjudication' ||
    actor.classState.monsterLairActionRoundUsed === state.round ||
    (state.round > 1 && actor.classState.monsterLairActionLastId === definition.id)
  ) return fail(state, events, 'invalid-monster-action')
  if (!applyMonsterAdjudicatedEffects(
    state,
    actor,
    `monster-lair:${monster.id}:${definition.id}`,
    action.effects,
    events,
  )) return fail(state, events, 'invalid-monster-action')
  actor.classState.monsterLairActionRoundUsed = state.round
  actor.classState.monsterLairActionLastId = definition.id
  events.push({
    type: 'monster-lair-action-used',
    actorId: actor.id,
    actionId: definition.id,
    round: state.round,
    effectCount: action.effects.length,
  })
  return { ok: true, state, events }
}

function resolveHunterMultiattack(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'ranger-hunter-multiattack' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  if (
    !actor || actor.currentHp <= 0 || dnd5eCombatantClassLevel(actor, 'ranger') < 11 || !dnd5eCombatantHasSubclass(actor, 'ranger', 'hunter') ||
    !actor.classSelections.multiattack?.includes(action.feature) ||
    (action.feature === 'volley' ? action.weaponMode !== 'ranged' : action.weaponMode !== 'melee') ||
    action.attacks.length < 1 || new Set(action.attacks.map((attack) => attack.targetId)).size !== action.attacks.length
  ) return fail(state, events, 'invalid-class-feature')
  if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
  for (const supplied of action.attacks) {
    if (supplied.classDamageContext.mode !== action.weaponMode) return fail(state, events, 'invalid-class-feature')
    const result = resolveWeaponAttack(state, {
      type: 'attack',
      actorId: actor.id,
      targetId: supplied.targetId,
      attackModifier: action.attackModifier,
      criticalThreshold: action.criticalThreshold,
      spendAction: false,
      d20: supplied.d20,
      d20Second: supplied.d20Second,
      blessRoll: supplied.blessRoll,
      baneRoll: supplied.baneRoll,
      bardicInspirationRoll: supplied.bardicInspirationRoll,
      cuttingWords: supplied.cuttingWords,
      cuttingWordsDamage: supplied.cuttingWordsDamage,
      protectionReactionActorId: supplied.protectionReactionActorId,
      uncannyDodge: supplied.uncannyDodge,
      deflectMissilesD10: supplied.deflectMissilesD10,
      tranquilitySave: supplied.tranquilitySave,
      standAgainstTide: supplied.standAgainstTide,
      mode: supplied.mode,
      damage: { ...action.damage, rolls: supplied.damageRolls },
      classDamageContext: supplied.classDamageContext,
      classDamageRolls: supplied.classDamageRolls,
    }, events)
    if (!result.ok) return result
  }
  return { ok: true, state, events }
}

function resolveMonkUnarmedBonus(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monk-unarmed-bonus' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const turnKey = actor ? classFeatureTurnKey(state, actor.id) : ''
  const expectedAttacks = action.mode === 'flurry' ? 2 : 1
  if (
    !actor || dnd5eCombatantClassLevel(actor, 'monk') < (action.mode === 'flurry' ? 2 : 1) ||
    action.attacks.length !== expectedAttacks ||
    (action.mode === 'flurry'
      ? actor.classState.monkAttackActionTurnKey !== turnKey
      : actor.classState.monkMartialArtsTurnKey !== turnKey)
  ) return fail(state, events, 'invalid-class-feature')
  const ki = actor.classResources['dnd5e-ki']
  const stunningStrikeAttempts = action.attacks.filter((attack) => attack.stunningStrike).length
  const openHandTechniqueAttempts = action.attacks.filter((attack) => attack.openHandTechnique).length
  const quiveringPalmAttempts = action.attacks.filter((attack) => attack.quiveringPalm).length
  if (
    openHandTechniqueAttempts > 0 &&
    (action.mode !== 'flurry' || !dnd5eCombatantHasSubclass(actor, 'monk', 'open-hand') || dnd5eCombatantClassLevel(actor, 'monk') < 3)
  ) return fail(state, events, 'invalid-class-feature')
  if (
    quiveringPalmAttempts > 1 ||
    (quiveringPalmAttempts > 0 && (!dnd5eCombatantHasSubclass(actor, 'monk', 'open-hand') || dnd5eCombatantClassLevel(actor, 'monk') < 17))
  ) return fail(state, events, 'invalid-class-feature')
  const committedKi = (action.mode === 'flurry' ? 1 : 0) + stunningStrikeAttempts + quiveringPalmAttempts * 3
  if (
    (action.mode === 'flurry' && (!ki || ki.current < 1)) ||
    ((stunningStrikeAttempts > 0 || quiveringPalmAttempts > 0) && (!ki || ki.current < committedKi)) ||
    (stunningStrikeAttempts > 0 && dnd5eCombatantClassLevel(actor, 'monk') < 5)
  ) return fail(state, events, 'class-resource-unavailable')
  if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
  if (action.mode === 'flurry') spendClassResource(actor, 'dnd5e-ki', events)
  endTranquilityForHostileAction(actor, events, 'makes-attack')
  const attackingFromHidden = actor.classState.hiddenCheckTotal != null
  if (attackingFromHidden) {
    actor.classState.hiddenCheckTotal = undefined
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hidden', active: false })
  }

  for (let attackIndex = 0; attackIndex < action.attacks.length; attackIndex += 1) {
    const supplied = action.attacks[attackIndex]
    const target = state.combatants[supplied.targetId]
    if (!target || target.deathSaves.dead || dnd5eCombatantIsBanished(target)) return fail(state, events, 'invalid-target')
    try {
      if (!passesTranquilityWard(state, actor, target, supplied.tranquilitySave, events)) {
        if (supplied.standAgainstTide) return fail(state, events, 'invalid-class-feature')
        continue
      }
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const actorProne = actor.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
    const targetProne = target.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
    const targetGrantsAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
      (dnd5eTargetGrantsAttackAdvantage(target) || (attackIndex === 0 && attackingFromHidden) || !!target.classState.recklessAttackTurnKey || !!target.classState.stunnedByActorId ||
        dnd5eAttackerIsUnseenForAttack(state, actor.id, target.id) || targetProne ||
        dnd5eHelpAttackApplies(state, actor, target))
    const viciousMockeryDisadvantage = consumeViciousMockeryAttackDisadvantage(actor, events)
    const targetImposesDisadvantage = dnd5eTargetIsDodging(target) ||
      dnd5eBlurImposesAttackDisadvantage(state, actor.id, target.id) || viciousMockeryDisadvantage ||
      actor.exhaustionLevel >= 3 || dnd5eFrightenedAttackDisadvantage(state, actor) ||
      dnd5eTargetIsUnseenForAttack(state, actor.id, target.id) || actorProne
    const mode = resolveDnd5eRollMode({
      advantage: [{ active: targetGrantsAdvantage, reason: 'unarmed-attack-advantage' }],
      disadvantage: [{ active: targetImposesDisadvantage, reason: 'unarmed-attack-disadvantage' }],
    }).mode
    const d20Rolls = mode === 'normal' ? [supplied.d20] : [supplied.d20, supplied.d20Second ?? supplied.d20]
    let targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
    let attack: AttackResolution | undefined
    try {
      const inspiredAttack = applyBardicInspirationToAttack(
        actor,
        rules.resolveAttack({
          rolls: d20Rolls,
          mode,
          modifier: action.attackModifier + resolveDnd5eBlessRoll(state, actor, supplied.blessRoll) -
            resolveDnd5eBaneRoll(state, actor, supplied.baneRoll),
          targetAc: targetArmorClass,
        }),
        supplied.bardicInspirationRoll,
        events,
      )
      attack = applyCuttingWordsToAttack(state, actor, inspiredAttack, supplied.cuttingWords, events)
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    if (!attack) return fail(state, events, 'invalid-class-feature')
    let attackOutcome = resolveDnd5eAttackOutcome({
      attack,
      targetArmorClass,
      automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
    })
    let { hit, critical } = attackOutcome
    const shieldSpellApplied = applyShieldSpellReaction(state, target, supplied.shieldSpellReaction, hit, events)
    if (shieldSpellApplied == null) return fail(state, events, 'invalid-class-feature')
    if (shieldSpellApplied) {
      targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
      attackOutcome = resolveDnd5eAttackOutcome({
        attack,
        targetArmorClass,
        automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
      })
      ;({ hit, critical } = attackOutcome)
    }
    emitDnd5eAttackResolved(state, {
      type: 'attack-resolved', actorId: actor.id, targetId: target.id, d20: attack.roll.d20,
      total: attack.roll.total, armorClass: targetArmorClass, hit, critical,
    }, events)
    consumeDnd5eHelpAttack(state, actor, target, events)
    if (hit && supplied.standAgainstTide) return fail(state, events, 'invalid-class-feature')
    if (!hit) {
      if (supplied.damageRolls.length > 0 || supplied.cuttingWordsDamage) return fail(state, events, 'invalid-dice')
      if (supplied.standAgainstTide) {
        const repeated = resolveStandAgainstTideRepeat({
          state,
          attacker: actor,
          hunter: target,
          attackModifier: action.attackModifier,
          reachFeet: 5,
          damage: [{ ...action.damage, type: 'bludgeoning' }],
          use: supplied.standAgainstTide,
          events,
        })
        if (!repeated.ok) return repeated
      }
      continue
    }
    let damage
    try {
      damage = rules.resolveDamage({ ...action.damage, rolls: supplied.damageRolls, critical })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const cuttingWordsReduction = consumeCuttingWords(state, actor, supplied.cuttingWordsDamage, events)
    if (cuttingWordsReduction == null) return fail(state, events, 'invalid-class-feature')
    applyDamage(
      target,
      adjustDamageForTarget(target, Math.max(0, damage.total - cuttingWordsReduction), 'bludgeoning'),
      critical,
      events,
      actor,
      state,
      ['bludgeoning'],
    )
    if (supplied.quiveringPalm) {
      if (!spendClassResource(actor, 'dnd5e-ki', events, 3)) return fail(state, events, 'class-resource-unavailable')
      actor.classState.quiveringPalmTargetId = target.id
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: target.id,
        stateKey: 'quivering-palm', active: true,
      })
    }
    if (supplied.stunningStrike) {
      try {
        applyStunningStrike({
          state, actor, target, events,
          saveD20: supplied.stunningStrikeSaveD20,
          saveD20Second: supplied.stunningStrikeSaveD20Second,
          saveBlessRoll: supplied.stunningStrikeSaveBlessRoll,
          saveBaneRoll: supplied.stunningStrikeSaveBaneRoll,
          saveRerollD20: supplied.stunningStrikeSaveRerollD20,
          saveRerollD20Second: supplied.stunningStrikeSaveRerollD20Second,
          bardicInspirationRoll: supplied.stunningStrikeBardicInspirationRoll,
          darkOnesOwnLuckRoll: supplied.stunningStrikeDarkOnesOwnLuckRoll,
        })
      } catch {
        return fail(state, events, 'invalid-dice')
      }
    }
    if (supplied.openHandTechnique) {
      const technique = supplied.openHandTechnique
      if (technique.effect === 'no-reactions') {
        target.classState.openHandNoReactionsAppliedTurnKeysBySource = {
          ...(target.classState.openHandNoReactionsAppliedTurnKeysBySource ?? {}),
          [actor.id]: turnKey,
        }
        events.push({
          type: 'class-state-changed', actorId: actor.id, targetId: target.id,
          stateKey: 'open-hand-no-reactions', active: true,
        })
      } else {
        const ability: AbilityKey = technique.effect === 'prone' ? 'dex' : 'str'
        const mode = dnd5eSavingThrowMode(target, ability, { effectVisible: true, condition: technique.effect === 'prone' ? 'prone' : undefined })
        const d20Rolls = mode === 'normal'
          ? [technique.savingThrowD20 ?? 0]
          : [technique.savingThrowD20 ?? 0, technique.savingThrowD20Second ?? 0]
        let save
        try {
          save = resolveSavingThrowWithClassReroll({
            combatant: target,
            ability,
            rolls: d20Rolls,
            rerollD20: technique.savingThrowRerollD20,
            rerollD20Second: technique.savingThrowRerollD20Second,
            bardicInspirationRoll: technique.bardicInspirationRoll,
            darkOnesOwnLuckRoll: technique.darkOnesOwnLuckRoll,
            mode,
            modifier: (target.savingThrowBonuses[ability] ?? rules.abilityModifier(target.abilities[ability])) +
              resolveDnd5eBlessRoll(state, target, technique.blessRoll) -
              resolveDnd5eBaneRoll(state, target, technique.baneRoll),
            dc: 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities.wis),
            events,
          })
        } catch {
          return fail(state, events, 'invalid-dice')
        }
        events.push({
          type: 'saving-throw-resolved', targetId: target.id, ability,
          d20: save.roll.d20, modifier: save.roll.modifier, total: save.roll.total, dc: save.dc, success: save.success,
        })
        if (!save.success && technique.effect === 'prone') {
          const immune = target.conditionImmunities.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
          if (!immune && !target.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))) {
            applyDnd5eRulesCondition(target, actor, {
              condition: 'prone', rulesId: 'open-hand-technique', sourceKind: 'feature',
            }, events)
          }
        }
        if (!save.success && technique.effect === 'push') {
          const distance = technique.pushDistanceFeet ?? 0
          const destination = technique.pushTo
          if (
            !destination || !Number.isFinite(destination.x) || !Number.isFinite(destination.y) ||
            !Number.isFinite(distance) || distance < 0 || distance > 15
          ) return fail(state, events, 'invalid-class-feature')
          const from = { ...target.position }
          const oldDistanceSquared = (from.x - actor.position.x) ** 2 + (from.y - actor.position.y) ** 2
          const newDistanceSquared = (destination.x - actor.position.x) ** 2 + (destination.y - actor.position.y) ** 2
          if (newDistanceSquared < oldDistanceSquared) return fail(state, events, 'invalid-class-feature')
          target.position = { ...destination }
          events.push({ type: 'moved', actorId: target.id, from, to: target.position, distance })
        }
      }
    }
  }
  return { ok: true, state, events }
}

function resolveMonkQuiveringPalmRelease(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monk-quivering-palm-release' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const target = state.combatants[action.targetId]
  if (
    !actor || dnd5eCombatantClassLevel(actor, 'monk') < 17 || !dnd5eCombatantHasSubclass(actor, 'monk', 'open-hand') ||
    actor.classState.quiveringPalmTargetId !== action.targetId || !target || target.currentHp <= 0 || target.deathSaves.dead
  ) return fail(state, events, 'invalid-class-feature')
  const mode = dnd5eSavingThrowMode(target, 'con', { effectVisible: true })
  const rolls = mode === 'normal'
    ? [action.savingThrowD20 ?? 0]
    : [action.savingThrowD20 ?? 0, action.savingThrowD20Second ?? 0]
  let save
  try {
    save = resolveSavingThrowWithClassReroll({
      combatant: target,
      ability: 'con',
      rolls,
      rerollD20: action.savingThrowRerollD20,
      rerollD20Second: action.savingThrowRerollD20Second,
      bardicInspirationRoll: action.bardicInspirationRoll,
      darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
      mode,
      modifier: (target.savingThrowBonuses.con ?? rules.abilityModifier(target.abilities.con)) +
        resolveDnd5eBlessRoll(state, target, action.savingThrowBlessRoll) -
        resolveDnd5eBaneRoll(state, target, action.savingThrowBaneRoll),
      dc: 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities.wis),
      events,
    })
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
  actor.classState.quiveringPalmTargetId = undefined
  events.push({
    type: 'class-state-changed', actorId: actor.id, targetId: target.id,
    stateKey: 'quivering-palm', active: false,
  })
  events.push({
    type: 'saving-throw-resolved', targetId: target.id, ability: 'con',
    d20: save.roll.d20, modifier: save.roll.modifier, total: save.roll.total, dc: save.dc, success: save.success,
  })
  if (!save.success) {
    if (action.damageRolls.length > 0) return fail(state, events, 'invalid-dice')
    reduceHitPointsToZero(target, actor, events, state)
    return { ok: true, state, events }
  }
  let damage
  try {
    damage = rules.resolveDamage({ count: 10, sides: 10, bonus: 0, rolls: action.damageRolls, critical: false })
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  applyDamage(target, adjustDamageForTarget(target, damage.total, 'necrotic'), false, events, actor, state, ['necrotic'])
  return { ok: true, state, events }
}

function resolveMonkDeflectMissilesReturn(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monk-deflect-missiles-return' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const target = state.combatants[action.targetId]
  const expectedTurnKey = classFeatureTurnKey(state, currentActorId(state) ?? action.actorId)
  if (
    !actor || !target || actor.currentHp <= 0 || target.currentHp <= 0 || actor.controller === target.controller ||
    dnd5eCombatantClassLevel(actor, 'monk') < 3 ||
    actor.classState.deflectMissilesCatchTurnKey !== expectedTurnKey ||
    !actor.classState.deflectMissilesCatchSourceId ||
    !Number.isFinite(action.distanceFeet) || action.distanceFeet < 0 || (!action.decline && action.distanceFeet > 60)
  ) return fail(state, events, 'invalid-class-feature')

  const damageType = actor.classState.deflectMissilesCatchDamageType ?? 'piercing'
  actor.classState.deflectMissilesCatchSourceId = undefined
  actor.classState.deflectMissilesCatchTurnKey = undefined
  actor.classState.deflectMissilesCatchDamageType = undefined
  if (action.decline) {
    events.push({
      type: 'class-state-changed', actorId: actor.id, targetId: target.id,
      stateKey: 'deflect-missiles-catch', active: false,
    })
    return { ok: true, state, events }
  }
  if (!spendClassResource(actor, 'dnd5e-ki', events)) return fail(state, events, 'class-resource-unavailable')
  endTranquilityForHostileAction(actor, events, 'makes-attack')

  const requestedMode = action.mode ?? 'normal'
  const targetGrantsAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
    (dnd5eTargetGrantsAttackAdvantage(target) || requestedMode === 'advantage' || !!target.classState.stunnedByActorId ||
      dnd5eAttackerIsUnseenForAttack(state, actor.id, target.id) || dnd5eHelpAttackApplies(state, actor, target))
  const actorHasDisadvantage = requestedMode === 'disadvantage' || action.distanceFeet > 20 || actor.exhaustionLevel >= 3 ||
    actor.wearingUnproficientArmor ||
    dnd5eHasViciousMockeryAttackDisadvantage(actor) || dnd5eFrightenedAttackDisadvantage(state, actor) ||
    dnd5eTargetIsDodging(target) || dnd5eBlurImposesAttackDisadvantage(state, actor.id, target.id) ||
    dnd5eTargetIsUnseenForAttack(state, actor.id, target.id)
  const mode = resolveDnd5eRollMode({
    advantage: [{ active: targetGrantsAdvantage, reason: 'returned-missile-advantage' }],
    disadvantage: [{ active: actorHasDisadvantage, reason: 'returned-missile-disadvantage' }],
  }).mode
  const rolls = mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? action.d20]
  const attackModifier = actor.proficiencyBonus + rules.abilityModifier(actor.abilities.dex)
  const armorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
  let attack
  try {
    attack = rules.resolveAttack({ rolls, mode, modifier: attackModifier, targetAc: armorClass })
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  const { hit, critical } = resolveDnd5eAttackOutcome({
    attack,
    targetArmorClass: armorClass,
    automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target, action.distanceFeet),
  })
  emitDnd5eAttackResolved(state, {
    type: 'attack-resolved', actorId: actor.id, targetId: target.id, d20: attack.roll.d20,
    total: attack.roll.total, armorClass, hit, critical,
  }, events)
  consumeDnd5eHelpAttack(state, actor, target, events)
  events.push({
    type: 'class-state-changed', actorId: actor.id, targetId: target.id,
    stateKey: 'deflect-missiles-catch', active: false,
  })
  if (!hit) return { ok: true, state, events }
  let damage
  try {
    damage = rules.resolveDamage({
      count: 1,
      sides: dnd5eMonkMartialArtsDie(dnd5eCombatantClassLevel(actor, 'monk')),
      bonus: rules.abilityModifier(actor.abilities.dex),
      rolls: action.damageRolls,
      critical,
    })
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  recordHunterMultiattackDefenseHit(state, actor, target)
  applyDamage(target, adjustDamageForTarget(target, damage.total, damageType), critical, events, actor, state, [damageType])
  return { ok: true, state, events }
}

function dnd5eDestroyUndeadMaximumChallenge(level: number): number | undefined {
  if (level >= 17) return 4
  if (level >= 14) return 3
  if (level >= 11) return 2
  if (level >= 8) return 1
  if (level >= 5) return 0.5
  return undefined
}

function dnd5eCreatureIsUndead(combatant: Dnd5eCombatant): boolean {
  const creatureType = (combatant.creatureType ?? '').toLowerCase()
  return creatureType === '亡灵' || creatureType === 'undead' || creatureType.includes('亡灵')
}

function dnd5eCreatureIsFiend(combatant: Dnd5eCombatant): boolean {
  const creatureType = (combatant.creatureType ?? '').toLowerCase()
  return creatureType === '邪魔' || creatureType === 'fiend' || creatureType.includes('邪魔')
}

function dnd5eCreatureIsConstruct(combatant: Dnd5eCombatant): boolean {
  const creatureType = (combatant.creatureType ?? '').toLowerCase()
  return creatureType === '构装生物' || creatureType === 'construct' || creatureType.includes('构装')
}

function validAdjudicatedSpellConditionDuration(duration: Dnd5eActiveEffectDuration | undefined): boolean {
  if (!duration) return true
  if (duration.type === 'permanent') return true
  if (duration.type === 'rounds') {
    return Number.isInteger(duration.remainingRounds) && duration.remainingRounds >= 1 && duration.remainingRounds <= 14_400 &&
      (duration.tickOn === 'target-turn-start' || duration.tickOn === 'target-turn-end') &&
      (duration.lastTickTurnKey == null || typeof duration.lastTickTurnKey === 'string')
  }
  if (duration.type === 'until-turn-boundary') {
    return ['source-turn-start', 'source-turn-end', 'target-turn-start', 'target-turn-end'].includes(duration.boundary) &&
      (duration.appliedTurnKey == null || typeof duration.appliedTurnKey === 'string')
  }
  return typeof duration.sourceActorId === 'string' && duration.sourceActorId.length > 0 &&
    (duration.concentrationId == null || typeof duration.concentrationId === 'string') &&
    (duration.remainingRounds == null || (
      Number.isInteger(duration.remainingRounds) && duration.remainingRounds >= 1 && duration.remainingRounds <= 14_400
    ))
}

function validAdjudicatedSpellRepeatSave(repeatSave: Dnd5eActiveEffectRepeatSave | undefined): boolean {
  return !repeatSave || (
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(repeatSave.ability) &&
    Number.isInteger(repeatSave.dc) && repeatSave.dc >= 1 && repeatSave.dc <= 40 &&
    (repeatSave.timing === 'target-turn-start' || repeatSave.timing === 'target-turn-end') &&
    (!repeatSave.damageOnFailure || (
      Number.isInteger(repeatSave.damageOnFailure.count) &&
      repeatSave.damageOnFailure.count >= 1 && repeatSave.damageOnFailure.count <= 40 &&
      Number.isInteger(repeatSave.damageOnFailure.sides) &&
      repeatSave.damageOnFailure.sides >= 2 && repeatSave.damageOnFailure.sides <= 100 &&
      Number.isInteger(repeatSave.damageOnFailure.modifier ?? 0) &&
      DND5E_DAMAGE_TYPES.includes(repeatSave.damageOnFailure.type)
    )) &&
    repeatSave.onSuccess === 'remove'
  )
}

/**
 * Commits a DM-approved reference spell as one atomic Headless transaction.
 * The player request contains none of these effects; only the DM authority may
 * construct this action after answering a dm-adjudication Interrupt.
 */
function resolveAdjudicatedSpell(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'adjudicated-spell' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const spellcastingClassId = actor
    ? (action.castingClassId ? [action.castingClassId] : Object.keys(actor.classLevels ?? {}) as Dnd5eClassId[]).find((classId) =>
        !!dnd5eClassDefinition(classId)?.spellcasting &&
        Object.values(actor.classSelectionsByClass?.[classId] ?? {}).some((ids) => ids.includes(action.spellId))) ?? actor.classId
    : undefined
  const classDefinition = spellcastingClassId ? dnd5eClassDefinition(spellcastingClassId) : undefined
  const spellcasting = classDefinition?.spellcasting
  if (
    !actor || !spellcastingClassId || !spellcasting ||
    typeof action.spellId !== 'string' || !action.spellId.trim() || action.spellId.length > 160 ||
    typeof action.spellName !== 'string' || !action.spellName.trim() || action.spellName.length > 160 ||
    !Number.isInteger(action.spellLevel) || action.spellLevel < 0 || action.spellLevel > 9 ||
    !Number.isInteger(action.slotLevel) || action.slotLevel < 0 || action.slotLevel > 9 ||
    (action.castingTime !== 'action' && action.castingTime !== 'bonus-action') ||
    action.effects.length > 32 ||
    !Object.values(actor.classSelectionsByClass?.[spellcastingClassId] ?? actor.classSelections).some((ids) => ids.includes(action.spellId))
  ) return fail(state, events, 'invalid-class-feature')
  if (actor.wearingUnproficientArmor) {
    return fail(state, events, 'invalid-class-feature')
  }
  if (actor.classState.wildShapeFormId && (spellcastingClassId !== 'druid' || dnd5eCombatantClassLevel(actor, 'druid') < 18)) {
    return fail(state, events, 'invalid-class-feature')
  }

  const freeCastSource = dnd5eFreeSpellCastSource(
    {
      ...actor,
      classId: spellcastingClassId,
      level: dnd5eCombatantClassLevel(actor, spellcastingClassId),
      classSelections: actor.classSelectionsByClass?.[spellcastingClassId] ?? actor.classSelections,
    },
    { id: action.spellId, level: action.spellLevel },
    action.slotLevel,
  )
  const slotKey = spellcasting.kind === 'pact' && action.spellLevel <= 5
    ? 'dnd5e-pact-slot'
    : `dnd5e-spell-slot-${action.slotLevel}`
  if (action.spellLevel === 0) {
    if (action.slotLevel !== 0) return fail(state, events, 'invalid-class-feature')
  } else {
    const slot = actor.classResources[slotKey]
    const invalidPactLevel = spellcasting.kind === 'pact' && (
      freeCastSource?.kind === 'mystic-arcanum'
        ? action.slotLevel !== action.spellLevel
        : action.slotLevel !== dnd5ePactSlotLevel(dnd5eCombatantClassLevel(actor, spellcastingClassId))
    )
    if (
      action.slotLevel < action.spellLevel || invalidPactLevel ||
      (!freeCastSource && (!slot || slot.current < 1))
    ) return fail(state, events, 'class-resource-unavailable')
  }

  const concentrationRounds = action.concentrationRounds
  if (
    concentrationRounds != null &&
    (!Number.isInteger(concentrationRounds) || concentrationRounds < 1 || concentrationRounds > 14_400)
  ) return fail(state, events, 'invalid-class-feature')
  for (const effect of action.effects) {
    const target = state.combatants[effect.targetId]
    const hasOperation = effect.operation != null
    const amount = effect.amount
    const addCondition = effect.addCondition?.trim()
    const removeCondition = effect.removeCondition?.trim()
    if (
      !target ||
      (hasOperation && !['damage', 'healing', 'temporary-hit-points'].includes(effect.operation!)) ||
      (hasOperation && (!Number.isInteger(amount) || amount! < 0 || amount! > 1_000_000)) ||
      (!hasOperation && amount != null) ||
      (addCondition?.length ?? 0) > 80 || (removeCondition?.length ?? 0) > 80 ||
      (!addCondition && (effect.conditionDuration != null || effect.conditionRepeatSave != null)) ||
      !validAdjudicatedSpellConditionDuration(effect.conditionDuration) ||
      !validAdjudicatedSpellRepeatSave(effect.conditionRepeatSave) ||
      (dnd5eCannotAttackSource(actor, target.id) && (effect.operation === 'damage' || !!addCondition)) ||
      (!hasOperation && !addCondition && !removeCondition)
    ) return fail(state, events, 'invalid-target')
  }

  const turnKey = classFeatureTurnKey(state, actor.id)
  if (
    (action.castingTime === 'bonus-action' && actor.classState.leveledSpellTurnKey === turnKey) ||
    (action.castingTime === 'action' && action.spellLevel > 0 && actor.classState.bonusActionSpellTurnKey === turnKey)
  ) return fail(state, events, 'invalid-class-feature')
  const turnResource: TurnResource = action.castingTime === 'bonus-action' ? 'bonusAction' : 'action'
  if (!spend(actor, turnResource)) {
    return fail(state, events, turnResource === 'bonusAction' ? 'bonus-action-unavailable' : 'action-unavailable')
  }
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: turnResource })
  if (action.spellLevel > 0) {
    if (freeCastSource?.resourceKey) spendClassResource(actor, freeCastSource.resourceKey, events)
    else if (!freeCastSource) spendClassResource(actor, slotKey, events)
    if (freeCastSource) {
      events.push({
        type: 'class-state-changed', actorId: actor.id,
        stateKey: freeCastSource.kind, active: true,
      })
    }
  }
  if (action.castingTime === 'bonus-action') actor.classState.bonusActionSpellTurnKey = turnKey
  if (action.spellLevel > 0) actor.classState.leveledSpellTurnKey = turnKey
  const affectedTargetIds = [...new Set(action.effects.map((effect) => effect.targetId))]
  emitDnd5eSpellCast(state, {
    type: 'spell-cast', actorId: actor.id,
    targetId: affectedTargetIds[0] ?? actor.id,
    spellId: action.spellId, slotLevel: action.slotLevel,
  }, events)

  for (const effect of action.effects) {
    const target = state.combatants[effect.targetId]!
    if (effect.operation === 'damage') {
      // The DM supplies the final post-save/post-resistance amount.
      applyDamage(target, effect.amount ?? 0, false, events, actor, state)
    } else if (effect.operation === 'healing') {
      applyHealing(target, effect.amount ?? 0, events)
    } else if (effect.operation === 'temporary-hit-points') {
      applyTemporaryHitPoints(target, effect.amount ?? 0, events)
    }
    const removeCondition = effect.removeCondition?.trim()
    if (removeCondition && target.conditions.includes(removeCondition)) {
      const standard = dnd5eStandardConditionId(removeCondition)
      const removed = removeDnd5eEffectsByPredicate(
        target,
        (activeEffect) => standard
          ? activeEffect.standardCondition === standard
          : activeEffect.legacyCondition === removeCondition,
        'dm',
        events,
      )
      if (removed.length === 0) events.push({ type: 'condition-ended', targetId: target.id, condition: removeCondition })
    }
    const addCondition = effect.addCondition?.trim()
    if (addCondition && !target.conditions.includes(addCondition)) {
      const standard = dnd5eStandardConditionId(addCondition)
      const duration = concentrationRounds != null
        ? { type: 'concentration' as const, sourceActorId: actor.id, concentrationId: action.spellId, remainingRounds: concentrationRounds }
        : effect.conditionDuration ?? { type: 'permanent' as const }
      const incoming: Dnd5eActiveEffectInstance = standard
        ? { ...createDnd5eConditionEffect({
            id: `adjudicated:${action.spellId}:${actor.id}:${target.id}:${standard}`,
            condition: standard,
            targetId: target.id,
            source: { kind: 'spell', actorId: actor.id, actorName: actor.name, rulesId: action.spellId, label: action.spellName },
            duration,
            repeatSave: effect.conditionRepeatSave,
            appliedAt: 0,
            appliedRound: state.round,
            appliedTurnKey: turnKey,
          }), legacyCondition: addCondition }
        : createDnd5eMechanicalEffect({
            id: `adjudicated:${action.spellId}:${actor.id}:${target.id}:${encodeURIComponent(addCondition)}`,
            definitionId: `adjudicated:${action.spellId}:${addCondition}`,
            label: addCondition,
            kind: 'custom',
            legacyCondition: addCondition,
            targetId: target.id,
            source: { kind: 'spell', actorId: actor.id, actorName: actor.name, rulesId: action.spellId, label: action.spellName },
            appliedAt: 0,
            appliedRound: state.round,
            appliedTurnKey: turnKey,
            duration,
            repeatSave: effect.conditionRepeatSave,
            stackingKey: `adjudicated:${action.spellId}:${addCondition}`,
            stackingPolicy: 'refresh-duration',
            visibility: 'public',
          })
      const mutation = applyDnd5eActiveEffect({
        effects: reconciledDnd5eActiveEffects(target),
        incoming,
        conditionImmunities: [
          ...target.conditionImmunities,
          ...dnd5eActiveConditionImmunities(target.classState.activeEffects),
        ],
      })
      if (mutation.status !== 'rejected-immune') {
        commitDnd5eActiveEffects(target, mutation.effects)
        events.push({ type: mutation.status === 'refreshed' ? 'active-effect-refreshed' : 'active-effect-applied', targetId: target.id, effectId: incoming.id, definitionId: incoming.definitionId })
        events.push({ type: 'condition-applied', actorId: actor.id, targetId: target.id, condition: addCondition })
      }
    }
  }

  if (concentrationRounds != null) {
    beginDnd5eConcentration(
      state,
      actor,
      action.spellId,
      affectedTargetIds,
      concentrationRounds,
      events,
      action.slotLevel,
    )
  }
  events.push({
    type: 'adjudicated-spell-resolved', actorId: actor.id,
    spellId: action.spellId, spellName: action.spellName,
    slotLevel: action.slotLevel, effectCount: action.effects.length,
  })
  return { ok: true, state, events }
}

/**
 * Applies the narrow, host-owned effect vocabulary returned by a plugin Worker.
 * The Worker never receives this mutable state and cannot bypass these validations.
 */
export function resolveDnd5eSandboxedPluginCapabilities(
  source: Dnd5eHeadlessCombatState,
  action: Dnd5ePluginAction,
  operations: readonly Dnd5eSandboxCapabilityOperation[],
): Dnd5eActionResult {
  const state = clone(source)
  const events: Dnd5eCombatEvent[] = []
  if (operations.length > 64) return fail(state, events, 'invalid-plugin-action')
  if (!state.active) return fail(state, events, 'combat-ended')
  const pluginAction = dnd5ePluginHeadlessActionDefinition(action.pluginId, action.actionId)
  const pluginFeature = action.featureId ? dnd5ePluginFeatureDefinition(action.featureId) : undefined
  if (!pluginAction || pluginAction.execution !== 'worker') return fail(state, events, 'invalid-plugin-action')
  if (
    action.featureId &&
    (!pluginFeature || pluginFeature.ownerPluginId !== action.pluginId || pluginFeature.action?.id !== action.actionId)
  ) return fail(state, events, 'invalid-plugin-action')
  if (!validateDnd5ePluginDiceRolls(pluginAction, action.rolls)) {
    return fail(state, events, 'invalid-dice')
  }
  const interrupt = pluginFeature?.action?.interrupt
  if (
    (interrupt && !interrupt.options.some((option) => option.id === action.interruptChoiceId)) ||
    (!interrupt && action.interruptChoiceId != null)
  ) return fail(state, events, 'invalid-plugin-action')
  if (pluginAction.allowOffTurn !== true && currentActorId(state) !== action.actorId) {
    return fail(state, events, 'stale-turn')
  }
  const actor = state.combatants[action.actorId]
  if (!actor || actor.currentHp <= 0 || dnd5eIsIncapacitated(actor) || dnd5eCombatantIsBanished(actor)) {
    return fail(state, events, 'invalid-actor')
  }
  if (action.featureId && !actor.pluginFeatureIds.includes(action.featureId)) {
    return fail(state, events, 'invalid-plugin-action')
  }

  let pluginTargets: Dnd5eCombatant[]
  let pluginEconomy: 'action' | 'bonusAction' | 'reaction' | 'none' = 'none'
  if (pluginFeature?.action) {
    const { targeting, economy } = pluginFeature.action
    pluginEconomy = economy
    if (targeting.kind === 'self') {
      if (action.targetId && action.targetId !== actor.id) return fail(state, events, 'invalid-target')
      pluginTargets = [actor]
    } else if (targeting.kind === 'single-creature') {
      const pluginTarget = action.targetId ? state.combatants[action.targetId] : undefined
      if (!pluginTarget || pluginTarget.currentHp <= 0) return fail(state, events, 'invalid-target')
      if (pluginTarget.id === actor.id && targeting.includeSelf !== true) return fail(state, events, 'invalid-target')
      const allied = pluginTarget.controller === actor.controller
      if (targeting.relation === 'ally' && !allied) return fail(state, events, 'invalid-target')
      if (targeting.relation === 'enemy' && allied) return fail(state, events, 'invalid-target')
      if (targeting.relation === 'enemy' && dnd5eCannotAttackSource(actor, pluginTarget.id)) {
        return fail(state, events, 'invalid-target')
      }
      if (
        targeting.rangeFeet != null &&
        (!Number.isFinite(action.distanceFeet) || (action.distanceFeet ?? -1) < 0 ||
          (action.distanceFeet ?? Number.POSITIVE_INFINITY) > targeting.rangeFeet)
      ) return fail(state, events, 'invalid-target')
      pluginTargets = [pluginTarget]
    } else {
      const uniqueIds = [...new Set(action.targetIds ?? [])]
      if (
        (uniqueIds.length < 1 && !pluginFeature.action.persistentArea && !pluginFeature.action.summon) ||
        uniqueIds.length > (targeting.maximumTargets ?? 64) ||
        !action.targetCell || !Number.isInteger(action.targetCell.col) || !Number.isInteger(action.targetCell.row) ||
        (action.targetOrientation != null && (
          !Number.isInteger(action.targetOrientation) || action.targetOrientation < 0 || action.targetOrientation > 3
        ))
      ) return fail(state, events, 'invalid-target')
      pluginTargets = uniqueIds.flatMap((targetId) => state.combatants[targetId] ? [state.combatants[targetId]] : [])
      if (pluginTargets.length !== uniqueIds.length || pluginTargets.some((target) => target.currentHp <= 0)) {
        return fail(state, events, 'invalid-target')
      }
      for (const target of pluginTargets) {
        if (target.id === actor.id && targeting.includeSelf !== true) return fail(state, events, 'invalid-target')
        const allied = target.controller === actor.controller
        if (targeting.relation === 'ally' && !allied) return fail(state, events, 'invalid-target')
        if (targeting.relation === 'enemy' && allied) return fail(state, events, 'invalid-target')
        if (targeting.relation === 'enemy' && dnd5eCannotAttackSource(actor, target.id)) {
          return fail(state, events, 'invalid-target')
        }
      }
    }
  } else {
    const pluginTarget = action.targetId ? state.combatants[action.targetId] : undefined
    pluginTargets = pluginTarget ? [pluginTarget] : []
  }

  const allowedTargetIds = new Set([actor.id, ...pluginTargets.map((target) => target.id)])
  for (const operation of operations) {
    if (operation.kind === 'spend-resource' || operation.kind === 'restore-resource') {
      const resource = dnd5ePluginResourceDefinition(operation.resourceId)
      if (
        !resource || resource.ownerPluginId !== action.pluginId ||
        dnd5eCombatantClassLevel(actor, resource.classId) < (resource.minimumLevel ?? 1) ||
        (resource.subclassId != null && !dnd5eCombatantHasSubclass(actor, resource.classId, resource.subclassId)) ||
        !Number.isInteger(operation.amount) || operation.amount < 1 || operation.amount > 1_000_000 ||
        !actor.classResources[resource.id]
      ) return fail(state, events, 'class-resource-unavailable')
      if (operation.kind === 'spend-resource' && actor.classResources[resource.id].current < operation.amount) {
        return fail(state, events, 'class-resource-unavailable')
      }
      continue
    }
    if (!allowedTargetIds.has(operation.targetId)) return fail(state, events, 'invalid-plugin-action')
    if (
      operation.kind !== 'apply-standard-condition' &&
      (!Number.isInteger(operation.amount) || operation.amount < 0 || operation.amount > 1_000_000)
    ) return fail(state, events, 'invalid-plugin-action')
    if (!state.combatants[operation.targetId]) return fail(state, events, 'invalid-target')
  }
  if (pluginEconomy !== 'none') {
    if (pluginEconomy === 'reaction' && dnd5eReactionsPrevented(actor)) {
      return fail(state, events, 'reaction-unavailable')
    }
    if (!spend(actor, pluginEconomy)) {
      return fail(
        state,
        events,
        pluginEconomy === 'action'
          ? 'action-unavailable'
          : pluginEconomy === 'bonusAction'
            ? 'bonus-action-unavailable'
            : 'reaction-unavailable',
      )
    }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: pluginEconomy })
  }
  const persistentArea = pluginFeature?.action?.persistentArea
  if (persistentArea?.concentration) {
    if (!action.transactionId) return fail(state, events, 'invalid-plugin-action')
    beginDnd5eConcentration(
      state,
      actor,
      `plugin-area:${action.transactionId}`,
      pluginTargets.map((target) => target.id),
      persistentArea.durationRounds,
      events,
    )
  }
  const summon = pluginFeature?.action?.summon
  if (summon?.concentration) {
    if (!action.transactionId) return fail(state, events, 'invalid-plugin-action')
    beginDnd5eConcentration(
      state,
      actor,
      `plugin-summon:${action.transactionId}`,
      [],
      summon.durationRounds,
      events,
    )
  }
  for (const operation of operations) {
    if (operation.kind === 'spend-resource') {
      if (!spendClassResource(actor, operation.resourceId, events, operation.amount)) {
        return fail(state, events, 'class-resource-unavailable')
      }
      continue
    }
    if (operation.kind === 'restore-resource') {
      const resource = actor.classResources[operation.resourceId]
      if (!resource) return fail(state, events, 'class-resource-unavailable')
      resource.current = Math.min(resource.max, resource.current + operation.amount)
      events.push({
        type: 'class-resource-restored', actorId: actor.id, resourceKey: operation.resourceId,
        current: resource.current, max: resource.max,
      })
      continue
    }
    const target = state.combatants[operation.targetId]
    if (!target) return fail(state, events, 'invalid-target')
    if (operation.kind === 'grant-temporary-hit-points') {
      applyTemporaryHitPoints(target, operation.amount, events)
    } else if (operation.kind === 'heal') {
      applyHealing(target, operation.amount, events)
    } else if (operation.kind === 'deal-damage') {
      applyDamage(
        target,
        adjustDamageForTarget(target, operation.amount, operation.damageType),
        false,
        events,
        actor,
        state,
        [operation.damageType],
      )
    } else if (operation.kind === 'apply-standard-condition') {
      applyDnd5eStandardConditionEffect(target, actor, {
        id: dnd5eActiveEffectId(`plugin:${action.pluginId}:${action.actionId}`, actor.id, target.id, operation.condition),
        rulesId: `${action.pluginId}:${action.actionId}`,
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
        condition: operation.condition,
        duration: dnd5eCapabilityDuration(operation.duration),
        repeatSave: operation.duration.expiresAt === 'target-turn-end-save' && operation.duration.saveAbility && operation.duration.saveDc
          ? { ability: operation.duration.saveAbility, dc: operation.duration.saveDc, timing: 'target-turn-end', onSuccess: 'remove' }
          : undefined,
        sourceKind: 'plugin',
        pluginId: action.pluginId,
      }, events)
    } else {
      return fail(state, events, 'invalid-plugin-action')
    }
  }
  return { ok: true, state, events }
}

export interface Dnd5ePersistentAreaDmAdjustment {
  damage?: { mode: 'set' | 'add' | 'multiply'; value: number }
  saveSuccessOverride?: boolean
  blockedConditionIds?: readonly Dnd5eStandardConditionId[]
}

function adjustedPersistentAreaDamage(
  amount: number,
  adjustment: Dnd5ePersistentAreaDmAdjustment['damage'],
): number {
  if (!adjustment || !Number.isFinite(adjustment.value)) return amount
  const adjusted = adjustment.mode === 'set'
    ? adjustment.value
    : adjustment.mode === 'add'
      ? amount + adjustment.value
      : amount * adjustment.value
  return Math.max(0, Math.min(1_000_000, Math.floor(adjusted)))
}

/**
 * Authoritative, off-turn transaction for persistent areas. Declarations are
 * snapshotted on the map; all random values and DM adjustments are explicit inputs.
 */
export function resolveDnd5ePersistentAreaTrigger(
  source: Dnd5eHeadlessCombatState,
  input: {
    areaId: string
    areaSourceKind?: Dnd5ePersistentAreaSourceKind
    coreSpellId?: string
    sourceId: string
    targetId: string
    trigger: Dnd5ePersistentAreaTriggerSnapshot
    d20?: number
    d20Second?: number
    blessRoll?: number
    baneRoll?: number
    damageRolls?: readonly number[]
    dmAdjustment?: Dnd5ePersistentAreaDmAdjustment
  },
): Dnd5eActionResult {
  const state = clone(source)
  const events: Dnd5eCombatEvent[] = []
  if (!state.active) return fail(state, events, 'combat-ended')
  const actor = state.combatants[input.sourceId]
  const target = state.combatants[input.targetId]
  if (!actor || !target || target.deathSaves.dead) return fail(state, events, 'invalid-target')
  if (!input.areaId || !input.trigger.id) return fail(state, events, 'invalid-plugin-action')
  const coreSpell = input.areaSourceKind === 'core-spell' && input.coreSpellId
    ? getDnd5eSrdCombatSpell(input.coreSpellId)
    : undefined
  if (input.areaSourceKind === 'core-spell' && coreSpell?.effect !== 'persistent-area') {
    return fail(state, events, 'invalid-plugin-action')
  }

  const skipSaveCondition = input.trigger.skipSaveWhenSourceConditionActive
  const sourceConditionActive = skipSaveCondition
    ? reconciledDnd5eActiveEffects(target).some((effect) =>
        effect.standardCondition === skipSaveCondition &&
        effect.source.actorId === actor.id &&
        effect.source.rulesId === coreSpell?.id,
      )
    : false
  const savingThrow = sourceConditionActive ? undefined : input.trigger.savingThrow
  let saveSuccess: boolean | undefined
  let shapechangerMustRevert = false
  if (savingThrow) {
    if (!Number.isInteger(input.d20) || input.d20! < 1 || input.d20! > 20) {
      return fail(state, events, 'invalid-dice')
    }
    const { ability, dc } = savingThrow
    const baseMode = dnd5eSavingThrowMode(target, ability, { effectVisible: true })
    const mode = savingThrow.shapechangerDisadvantage && target.shapechanger
      ? imposeDnd5eDisadvantage(baseMode)
      : baseMode
    const rolls = mode === 'normal' ? [input.d20!] : [input.d20!, input.d20Second ?? 0]
    if (mode !== 'normal' && (!Number.isInteger(input.d20Second) || input.d20Second! < 1 || input.d20Second! > 20)) {
      return fail(state, events, 'invalid-dice')
    }
    let modifier: number
    try {
      modifier = (target.savingThrowBonuses[ability] ?? rules.abilityModifier(target.abilities[ability])) +
        resolveDnd5eBlessRoll(state, target, input.blessRoll) -
        resolveDnd5eBaneRoll(state, target, input.baneRoll)
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const save = rules.resolveSavingThrow({ rolls, mode, modifier, dc })
    saveSuccess = dnd5eConditionSavingThrowAutomaticallyFails(target, ability) ? false : save.success
    if (input.dmAdjustment?.saveSuccessOverride != null) {
      saveSuccess = input.dmAdjustment.saveSuccessOverride
    }
    events.push({
      type: 'saving-throw-resolved', targetId: target.id, ability,
      d20: save.roll.d20, modifier, total: save.roll.total, dc, success: saveSuccess,
    })
    shapechangerMustRevert = !saveSuccess &&
      savingThrow.revertShapechangerOnFailure === true && target.shapechanger === true
  } else if (input.d20 != null || input.d20Second != null || input.blessRoll != null || input.baneRoll != null) {
    return fail(state, events, 'invalid-dice')
  }

  let appliedDamage = 0
  if (input.trigger.damage) {
    const damage = input.trigger.damage
    const rolls = input.damageRolls ?? []
    if (
      rolls.length !== damage.count ||
      rolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > damage.sides)
    ) return fail(state, events, 'invalid-dice')
    let amount = rules.resolveDamage({
      count: damage.count,
      sides: damage.sides,
      bonus: damage.modifier ?? 0,
      rolls,
    }).total
    if (saveSuccess) {
      amount = savingThrow?.onSuccess === 'half' ? Math.floor(amount / 2) : 0
    }
    appliedDamage = adjustDamageForTarget(target, amount, damage.type)
    appliedDamage = adjustedPersistentAreaDamage(appliedDamage, input.dmAdjustment?.damage)
    applyDamage(target, appliedDamage, false, events, actor, state, [damage.type])
  } else if ((input.damageRolls?.length ?? 0) > 0 || input.dmAdjustment?.damage) {
    return fail(state, events, 'invalid-dice')
  }

  // Moonbeam deals its damage before the failed-save shapechanger rider is resolved.
  // This preserves Wild Shape's own hit-point pool and only then restores the original form.
  if (shapechangerMustRevert) {
    if (target.classState.wildShapeFormId) revertDnd5eWildShape(target, 0, events)
    else if (target.classState.monsterShapechangeFormId) revertDnd5eMonsterShapechange(target, events)
    events.push({
      type: 'class-state-changed', actorId: target.id,
      stateKey: 'shapechanger-reverted', active: false,
    })
  }

  let conditionApplied: Dnd5eStandardConditionId | undefined
  const condition = input.trigger.condition
  if (
    condition && !saveSuccess &&
    !input.dmAdjustment?.blockedConditionIds?.includes(condition.condition)
  ) {
    const effectDuration: Dnd5eActiveEffectDuration = coreSpell?.concentration
      ? {
          type: 'concentration',
          sourceActorId: actor.id,
          concentrationId: coreSpell.id,
          remainingRounds: coreSpell.concentrationDurationRounds,
        }
      : dnd5eCapabilityDuration(condition.duration)
    const applied = applyDnd5eStandardConditionEffect(target, actor, {
      id: dnd5eActiveEffectId(
        coreSpell ? `srd-5.1:spell:${coreSpell.id}:${input.trigger.id}` : `plugin-area:${input.areaId}:${input.trigger.id}`,
        actor.id,
        target.id,
        condition.condition,
      ),
      rulesId: coreSpell?.id ?? `plugin-area:${input.areaId}:${input.trigger.id}`,
      appliedTurnKey: classFeatureTurnKey(state, target.id),
      condition: condition.condition,
      duration: effectDuration,
      repeatSave: condition.duration.expiresAt === 'target-turn-end-save' && condition.duration.saveAbility && condition.duration.saveDc
        ? {
            ability: condition.duration.saveAbility,
            dc: condition.duration.saveDc,
            timing: 'target-turn-end',
            onSuccess: 'remove',
          }
        : undefined,
      escapeCheck: condition.escapeCheck,
      sourceKind: coreSpell ? 'spell' : 'plugin',
    }, events)
    if (applied) {
      conditionApplied = condition.condition
      if (coreSpell?.concentration) {
        target.classState.concentrationEffectsBySource = {
          ...(target.classState.concentrationEffectsBySource ?? {}),
          [actor.id]: coreSpell.id,
        }
        actor.classState.concentrationTargetIds = [...new Set([
          ...(actor.classState.concentrationTargetIds ?? []),
          target.id,
        ])]
      }
    }
  }
  events.push({
    type: 'persistent-area-triggered', actorId: actor.id, targetId: target.id,
    areaId: input.areaId, triggerId: input.trigger.id, timing: input.trigger.timing,
    saveSuccess, damage: appliedDamage, conditionApplied,
  })
  return { ok: true, state, events }
}

function resolveDnd5eMonsterTurnStartLifecycle(input: {
  state: Dnd5eHeadlessCombatState
  actor: Dnd5eCombatant
  action: Extract<Dnd5eAction, { type: 'end-turn' | 'death-save-turn' }>
  events: Dnd5eCombatEvent[]
}): boolean {
  const monster = input.actor.statBlockId ? getDnd5eSrdMonster(input.actor.statBlockId) : undefined
  if (!monster) {
    return (input.action.nextMonsterRechargeRolls?.length ?? 0) === 0 &&
      (input.action.nextMonsterMechanicRolls?.length ?? 0) === 0
  }

  if (!resolveDnd5eMonsterMechanics({
    state: input.state,
    actor: input.actor,
    monster,
    event: 'turn-start',
    supplied: input.action.nextMonsterMechanicRolls,
    events: input.events,
  })) return false

  const regeneration = dnd5eMonsterRegenerationRule(monster)
  if (regeneration) {
    const suppressedTypes = input.actor.classState.monsterRegenerationSuppressedDamageTypes ?? []
    const suppressed = suppressedTypes.some((type) => regeneration.suppressedByDamageTypes.includes(type))
    if (suppressed) {
      const died = input.actor.currentHp === 0 && regeneration.diesAtZeroWhenSuppressed
      if (died) {
        input.actor.classState.monsterRegenerationPendingAtZero = undefined
        input.actor.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
      }
      input.events.push({
        type: 'monster-regeneration-suppressed', actorId: input.actor.id,
        damageTypes: suppressedTypes, died,
      })
    } else if (input.actor.currentHp > 0 || !regeneration.requiresPositiveHp) {
      const healed = applyHealing(input.actor, regeneration.amount, input.events)
      input.actor.classState.monsterRegenerationPendingAtZero = undefined
      if (healed > 0) {
        input.events.push({ type: 'monster-regenerated', actorId: input.actor.id, amount: healed, hpAfter: input.actor.currentHp })
      }
    }
    input.actor.classState.monsterRegenerationSuppressedDamageTypes = undefined
  }

  if ((monster.legendaryActions?.length ?? 0) > 0) {
    const points = monster.legendaryActionPoints ?? 3
    input.actor.classState.monsterLegendaryActionPoints = points
    input.events.push({ type: 'monster-legendary-actions-restored', actorId: input.actor.id, points })
  }

  const rechargeActions = dnd5eMonsterRechargeActions(monster).filter((action) =>
    input.actor.classState.monsterRechargeReadyByActionId?.[action.id] === false,
  )
  const supplied = input.action.nextMonsterRechargeRolls ?? []
  if (
    supplied.length !== rechargeActions.length ||
    supplied.some((roll) => roll.actorId !== input.actor.id) ||
    new Set(supplied.map((roll) => roll.actionId)).size !== supplied.length
  ) return false
  for (const action of rechargeActions) {
    const roll = supplied.find((candidate) => candidate.actionId === action.id)
    const usage = action.usage
    if (!roll || usage?.kind !== 'recharge' || !Number.isInteger(roll.roll) || roll.roll < 1 || roll.roll > usage.dieSides) {
      return false
    }
    const ready = roll.roll >= usage.minimum
    input.actor.classState.monsterRechargeReadyByActionId = {
      ...input.actor.classState.monsterRechargeReadyByActionId,
      [action.id]: ready,
    }
    input.events.push({ type: 'monster-recharge-resolved', actorId: input.actor.id, actionId: action.id, roll: roll.roll, ready })
  }
  return true
}

function resolveDnd5eHeadlessActionInternal(
  source: Dnd5eHeadlessCombatState,
  action: Dnd5eAction,
  options: { skipTurnStartBoundary?: boolean } = {},
): Dnd5eActionResult {
  const state = clone(source)
  const events: Dnd5eCombatEvent[] = []
  dnd5eResolutionStateByEvents.set(events, state)
  dnd5eResolutionActionByEvents.set(events, action)
  const outOfCombatSceneInteraction = !state.active && action.type === 'scene-interaction-outcome'
  if (!state.active && !outOfCombatSceneInteraction) return fail(state, events, 'combat-ended')
  const pluginAction = action.type === 'plugin'
    ? dnd5ePluginHeadlessActionDefinition(action.pluginId, action.actionId)
    : undefined
  const pluginFeature = action.type === 'plugin' && action.featureId
    ? dnd5ePluginFeatureDefinition(action.featureId)
    : undefined
  if (action.type === 'plugin' && !pluginAction) return fail(state, events, 'invalid-plugin-action')
  if (
    action.type === 'plugin' &&
    action.featureId &&
    (
      !pluginFeature ||
      pluginFeature.ownerPluginId !== action.pluginId ||
      pluginFeature.action?.id !== action.actionId
    )
  ) return fail(state, events, 'invalid-plugin-action')
  const offTurn = action.type === 'opportunity-attack' || action.type === 'hellish-rebuke' || action.type === 'concentration-save' ||
    action.type === 'active-effect-damage-save' ||
    action.type === 'barbarian-relentless-rage-save' || action.type === 'monk-deflect-missiles-return' ||
    action.type === 'monster-undead-fortitude-save' || action.type === 'monster-on-hit-save' ||
    action.type === 'resolve-monster-mechanic-trigger' ||
    action.type === 'monster-legendary-action' ||
    action.type === 'monster-legendary-special-action' ||
    (action.type === 'monster-adjudicated-action' && action.legendary === true) ||
    action.type === 'monster-lair-action' ||
    action.type === 'trigger-readied-action' ||
    outOfCombatSceneInteraction ||
    (action.type === 'plugin' && pluginAction?.allowOffTurn === true)
  if (!offTurn && currentActorId(state) !== action.actorId) return fail(state, events, 'stale-turn')
  const actor = state.combatants[action.actorId]
  if (!actor || (
    actor.currentHp <= 0 && action.type !== 'death-save' && action.type !== 'death-save-turn' && action.type !== 'end-turn' &&
    action.type !== 'barbarian-relentless-rage-save' && action.type !== 'monster-undead-fortitude-save'
  )) return fail(state, events, 'invalid-actor')
  if (action.type === 'resolve-monster-mechanic-trigger') {
    return resolveDnd5ePendingMonsterMechanicTrigger(state, action, events)
  }
  if (
    dnd5eIsIncapacitated(actor) &&
    action.type !== 'move' && action.type !== 'end-turn' && action.type !== 'death-save' && action.type !== 'death-save-turn' && action.type !== 'concentration-save' &&
    action.type !== 'monster-undead-fortitude-save' && action.type !== 'monster-on-hit-save' &&
    action.type !== 'active-effect-damage-save'
  ) return fail(state, events, 'invalid-actor')
  if (
    dnd5eCombatantIsBanished(actor) &&
    action.type !== 'end-turn' && action.type !== 'death-save' && action.type !== 'death-save-turn' &&
    action.type !== 'monster-undead-fortitude-save' && action.type !== 'monster-on-hit-save' &&
    action.type !== 'active-effect-damage-save'
  ) return fail(state, events, 'invalid-actor')
  if (!dnd5eActionAllowedWhileSurprised(actor, state.combatId, action)) {
    return fail(state, events, action.type === 'opportunity-attack' || action.type === 'hellish-rebuke'
      ? 'reaction-unavailable'
      : 'action-unavailable')
  }
  if (!offTurn) {
    const activeTurnKey = classFeatureTurnKey(state, actor.id)
    if (actor.classState.readiedAction && actor.classState.readiedAction.preparedTurnKey !== activeTurnKey) {
      actor.classState.readiedAction = undefined
      events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'readied-action', active: false })
    }
    for (const target of Object.values(state.combatants)) {
      if (
        target.classState.helpedAbilityCheckSourceId === actor.id &&
        target.classState.helpedAbilityCheckSourceTurnKey !== activeTurnKey
      ) {
        target.classState.helpedAbilityCheckSourceId = undefined
        target.classState.helpedAbilityCheckSourceTurnKey = undefined
        events.push({ type: 'class-state-changed', actorId: actor.id, targetId: target.id, stateKey: 'help-ability-check', active: false })
      }
      if (
        target.classState.helpedAttackSourceId === actor.id &&
        target.classState.helpedAttackSourceTurnKey !== activeTurnKey
      ) {
        target.classState.helpedAttackSourceId = undefined
        target.classState.helpedAttackSourceTurnKey = undefined
        events.push({ type: 'class-state-changed', actorId: actor.id, targetId: target.id, stateKey: 'help-attack', active: false })
      }
    }
  }
  if (
    actor.classState.turnedByClericId &&
    action.type !== 'move' && action.type !== 'dash' && action.type !== 'dodge' &&
    action.type !== 'end-turn' && action.type !== 'death-save' && action.type !== 'death-save-turn' && action.type !== 'concentration-save' &&
    action.type !== 'monster-undead-fortitude-save' && action.type !== 'monster-on-hit-save' &&
    action.type !== 'active-effect-damage-save'
  ) return fail(state, events, 'invalid-actor')

  // 地图层按动作重建 Headless 快照，因此回合开始效果也必须能在本回合首个事务中幂等清理；
  // 这样即使上一位是自动怪物或 DM 直接推进先攻，也不会把过期效果带入实际判定。
  if (!offTurn && !options.skipTurnStartBoundary) {
    advanceDnd5eActiveEffectsAtBoundary({ state, actor, point: 'start', events })
  }

  const usesHideInPlainSight = action.type === 'ranger-vanish' ||
    (action.type === 'rogue-cunning-action' && action.option === 'hide') ||
    (action.type === 'ability-check' && action.skill === 'stealth')
  const preservesHideInPlainSight = action.type === 'ranger-hide-in-plain-sight' || usesHideInPlainSight ||
    action.type === 'end-turn' || action.type === 'death-save' || action.type === 'death-save-turn' || action.type === 'concentration-save' ||
    action.type === 'barbarian-relentless-rage-save' || action.type === 'monster-undead-fortitude-save' ||
    action.type === 'monster-on-hit-save' || action.type === 'active-effect-damage-save'
  if (actor.classState.hideInPlainSightPrepared && !preservesHideInPlainSight) {
    actor.classState.hideInPlainSightPrepared = undefined
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hide-in-plain-sight', active: false })
  }

  if (action.type === 'plugin' && pluginAction) {
    if (pluginAction.execution === 'worker' || typeof pluginAction.resolve !== 'function') {
      return fail(state, events, 'invalid-plugin-action')
    }
    if (!validateDnd5ePluginDiceRolls(pluginAction, action.rolls)) {
      return fail(state, events, 'invalid-dice')
    }
    const interrupt = pluginFeature?.action?.interrupt
    if (
      (interrupt && !interrupt.options.some((option) => option.id === action.interruptChoiceId)) ||
      (!interrupt && action.interruptChoiceId != null)
    ) return fail(state, events, 'invalid-plugin-action')
    if (action.featureId && !actor.pluginFeatureIds.includes(action.featureId)) {
      return fail(state, events, 'invalid-plugin-action')
    }
    let pluginTarget: Dnd5eCombatant | undefined
    let pluginTargets: Dnd5eCombatant[]
    if (pluginFeature?.action) {
      const { targeting, economy } = pluginFeature.action
      if (targeting.kind === 'self') {
        if (action.targetId && action.targetId !== actor.id) return fail(state, events, 'invalid-target')
        pluginTarget = actor
        pluginTargets = [actor]
      } else if (targeting.kind === 'single-creature') {
        pluginTarget = action.targetId ? state.combatants[action.targetId] : undefined
        if (!pluginTarget || pluginTarget.currentHp <= 0) return fail(state, events, 'invalid-target')
        if (pluginTarget.id === actor.id && targeting.includeSelf !== true) return fail(state, events, 'invalid-target')
        const allied = pluginTarget.controller === actor.controller
        if (targeting.relation === 'ally' && !allied) return fail(state, events, 'invalid-target')
        if (targeting.relation === 'enemy' && allied) return fail(state, events, 'invalid-target')
        if (targeting.relation === 'enemy' && dnd5eCannotAttackSource(actor, pluginTarget.id)) {
          return fail(state, events, 'invalid-target')
        }
        if (
          targeting.rangeFeet != null &&
          (
            !Number.isFinite(action.distanceFeet) ||
            (action.distanceFeet ?? -1) < 0 ||
            (action.distanceFeet ?? Number.POSITIVE_INFINITY) > targeting.rangeFeet
          )
        ) return fail(state, events, 'invalid-target')
        pluginTargets = [pluginTarget]
      } else {
        const uniqueIds = [...new Set(action.targetIds ?? [])]
        if (
          (uniqueIds.length < 1 && !pluginFeature.action.persistentArea && !pluginFeature.action.summon) ||
          uniqueIds.length > (targeting.maximumTargets ?? 64) ||
          !action.targetCell || !Number.isInteger(action.targetCell.col) || !Number.isInteger(action.targetCell.row) ||
          (action.targetOrientation != null && (
            !Number.isInteger(action.targetOrientation) || action.targetOrientation < 0 || action.targetOrientation > 3
          ))
        ) return fail(state, events, 'invalid-target')
        pluginTargets = uniqueIds.flatMap((targetId) => state.combatants[targetId] ? [state.combatants[targetId]] : [])
        if (pluginTargets.length !== uniqueIds.length || pluginTargets.some((target) => target.currentHp <= 0)) {
          return fail(state, events, 'invalid-target')
        }
        for (const target of pluginTargets) {
          if (target.id === actor.id && targeting.includeSelf !== true) return fail(state, events, 'invalid-target')
          const allied = target.controller === actor.controller
          if (targeting.relation === 'ally' && !allied) return fail(state, events, 'invalid-target')
          if (targeting.relation === 'enemy' && allied) return fail(state, events, 'invalid-target')
          if (targeting.relation === 'enemy' && dnd5eCannotAttackSource(actor, target.id)) {
            return fail(state, events, 'invalid-target')
          }
        }
        pluginTarget = pluginTargets[0]
      }
      if (economy !== 'none') {
        if (economy === 'reaction' && dnd5eReactionsPrevented(actor)) {
          return fail(state, events, 'reaction-unavailable')
        }
        if (!spend(actor, economy)) {
          return fail(
            state,
            events,
            economy === 'action'
              ? 'action-unavailable'
              : economy === 'bonusAction'
                ? 'bonus-action-unavailable'
                : 'reaction-unavailable',
          )
        }
        events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: economy })
      }
      if (pluginFeature.action.persistentArea?.concentration) {
        if (!action.transactionId) return fail(state, events, 'invalid-plugin-action')
        beginDnd5eConcentration(
          state,
          actor,
          `plugin-area:${action.transactionId}`,
          pluginTargets.map((target) => target.id),
          pluginFeature.action.persistentArea.durationRounds,
          events,
        )
      }
      if (pluginFeature.action.summon?.concentration) {
        if (!action.transactionId) return fail(state, events, 'invalid-plugin-action')
        beginDnd5eConcentration(
          state,
          actor,
          `plugin-summon:${action.transactionId}`,
          [],
          pluginFeature.action.summon.durationRounds,
          events,
        )
      }
    } else {
      pluginTarget = action.targetId ? state.combatants[action.targetId] : undefined
      pluginTargets = pluginTarget ? [pluginTarget] : []
    }
    try {
      const result = pluginAction.resolve({
        state,
        action,
        events,
        rules,
        actor,
        target: pluginTarget,
        targets: pluginTargets,
        rolls: action.rolls ?? {},
        grantTemporaryHitPoints(targetId, amount) {
          const target = state.combatants[targetId]
          if (!target || !Number.isFinite(amount)) return 0
          return applyTemporaryHitPoints(target, amount, events)
        },
        heal(targetId, amount) {
          const target = state.combatants[targetId]
          if (!target || !Number.isFinite(amount)) return 0
          return applyHealing(target, Math.max(0, Math.floor(amount)), events)
        },
        dealDamage(targetId, amount, damageType) {
          const target = state.combatants[targetId]
          if (!target || !Number.isFinite(amount)) return 0
          const adjusted = adjustDamageForTarget(target, Math.max(0, Math.floor(amount)), damageType)
          const before = target.currentHp + target.temporaryHp
          applyDamage(target, adjusted, false, events, actor, state, damageType ? [damageType] : [])
          return Math.max(0, before - target.currentHp - target.temporaryHp)
        },
        applyStandardCondition(targetId, condition, duration) {
          const target = state.combatants[targetId]
          if (!target) return false
          return applyDnd5eStandardConditionEffect(target, actor, {
            id: dnd5eActiveEffectId(`plugin:${action.pluginId}:${action.actionId}`, actor.id, target.id, condition),
            rulesId: `${action.pluginId}:${action.actionId}`,
            appliedTurnKey: classFeatureTurnKey(state, actor.id),
            condition,
            duration: dnd5eCapabilityDuration(duration),
            repeatSave: duration.expiresAt === 'target-turn-end-save' && duration.saveAbility && duration.saveDc
              ? { ability: duration.saveAbility, dc: duration.saveDc, timing: 'target-turn-end', onSuccess: 'remove' }
              : undefined,
            sourceKind: 'plugin',
            pluginId: action.pluginId,
          }, events)
        },
        spendResource(resourceId, amount = 1) {
          const definition = dnd5ePluginResourceDefinition(resourceId)
          if (
            !definition || definition.ownerPluginId !== action.pluginId ||
            dnd5eCombatantClassLevel(actor, definition.classId) < (definition.minimumLevel ?? 1) ||
            (definition.subclassId != null && !dnd5eCombatantHasSubclass(actor, definition.classId, definition.subclassId))
          ) return false
          return spendClassResource(actor, resourceId, events, amount)
        },
        restoreResource(resourceId, amount = 1) {
          const definition = dnd5ePluginResourceDefinition(resourceId)
          const resource = actor.classResources[resourceId]
          if (
            !definition || definition.ownerPluginId !== action.pluginId ||
            dnd5eCombatantClassLevel(actor, definition.classId) < (definition.minimumLevel ?? 1) ||
            (definition.subclassId != null && !dnd5eCombatantHasSubclass(actor, definition.classId, definition.subclassId)) ||
            !Number.isInteger(amount) || amount < 1 || amount > 1_000_000 || !resource
          ) return false
          resource.current = Math.min(resource.max, resource.current + amount)
          events.push({ type: 'class-resource-restored', actorId: actor.id, resourceKey: resourceId, current: resource.current, max: resource.max })
          return true
        },
        fail: (reason) => fail(state, events, reason),
        succeed: () => ({ ok: true, state, events }),
      })
      if (result.state.rulesetId !== rules.id || result.state.combatId !== source.combatId) {
        return fail(state, events, 'invalid-plugin-action')
      }
      return result
    } catch {
      return fail(state, events, 'invalid-plugin-action')
    }
  }

  if (action.type === 'warlock-hurl-through-hell-ready') {
    const resource = actor.classResources['dnd5e-hurl-through-hell']
    if (
      dnd5eCombatantClassLevel(actor, 'warlock') < 14 || !dnd5eCombatantHasSubclass(actor, 'warlock', 'fiend') ||
      (action.active && (!resource || resource.current < 1))
    ) return fail(state, events, 'invalid-class-feature')
    actor.classState.hurlThroughHellReady = action.active || undefined
    events.push({
      type: 'class-state-changed', actorId: actor.id,
      stateKey: 'hurl-through-hell-ready', active: action.active,
    })
    return { ok: true, state, events }
  }

  if (action.type === 'scene-interaction-outcome') {
    if (
      !action.interactionId ||
      action.interactionId.length > 300 ||
      action.steps.length > 24 ||
      new Set(action.steps.map((step) => step.id)).size !== action.steps.length
    ) return fail(state, events, 'invalid-scene-interaction-outcome')
    for (const step of action.steps) {
      if (!step.id || step.id.length > 180) return fail(state, events, 'invalid-scene-interaction-outcome')
      if (step.kind === 'damage') {
        if (
          !Number.isSafeInteger(step.amount) ||
          step.amount < 0 ||
          step.amount > 1_000_000 ||
          !DND5E_DAMAGE_TYPES.includes(step.damageType)
        ) return fail(state, events, 'invalid-scene-interaction-outcome')
        const adjusted = adjustDamageForTarget(actor, step.amount, step.damageType)
        applyDamage(actor, adjusted, false, events, undefined, state, [step.damageType])
        continue
      }
      if (
        !DND5E_STANDARD_CONDITION_IDS.includes(step.condition) ||
        (
          step.duration.type !== 'permanent' &&
          (
            step.duration.type !== 'rounds' ||
            !Number.isInteger(step.duration.remainingRounds) ||
            step.duration.remainingRounds < 1 ||
            step.duration.remainingRounds > 10_000
          )
        )
      ) return fail(state, events, 'invalid-scene-interaction-outcome')
      applyDnd5eRulesCondition(actor, undefined, {
        condition: step.condition,
        rulesId: `scene-interaction:${action.interactionId}:${step.id}`,
        sourceKind: 'system',
        duration: step.duration,
      }, events)
    }
    events.push({
      type: 'scene-interaction-outcome-resolved',
      actorId: actor.id,
      interactionId: action.interactionId,
      stepCount: action.steps.length,
    })
    return { ok: true, state, events }
  }

  if (action.type === 'item-area-trigger') {
    const dc = action.areaKind === 'ball-bearings' ? 10 : action.areaKind === 'caltrops' ? 15 : 13
    const mode = dnd5eSavingThrowMode(actor, 'dex', { effectVisible: true })
    const rolls = mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? 0]
    let save: SavingThrowResolution
    try {
      save = resolveSavingThrowWithClassReroll({
        combatant: actor,
        ability: 'dex',
        rolls,
        mode,
        modifier: actor.savingThrowBonuses.dex ?? rules.abilityModifier(actor.abilities.dex),
        dc,
        events,
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    events.push({
      type: 'saving-throw-resolved', targetId: actor.id, ability: 'dex', d20: save.roll.d20,
      modifier: save.roll.modifier, total: save.roll.total, dc, success: save.success,
    })
    events.push({
      type: 'item-area-triggered', actorId: actor.id, areaId: action.areaId,
      areaKind: action.areaKind, success: save.success,
    })
    if (save.success) return { ok: true, state, events }
    if (action.areaKind === 'ball-bearings') {
      if (!actor.conditionImmunities.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase())) &&
        !actor.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))) {
        applyDnd5eRulesCondition(actor, undefined, {
          condition: 'prone', rulesId: 'ball-bearings', sourceKind: 'item',
        }, events)
      }
      return { ok: true, state, events }
    }
    let rawDamage = 1
    if (action.areaKind === 'hunting-trap') {
      try {
        rawDamage = rules.resolveDamage({ count: 1, sides: 4, bonus: 0, rolls: action.damageRolls ?? [], critical: false }).total
      } catch {
        return fail(state, events, 'invalid-dice')
      }
    } else if (action.damageRolls?.length) {
      return fail(state, events, 'invalid-dice')
    }
    applyDamage(actor, adjustDamageForTarget(actor, rawDamage, 'piercing'), false, events, undefined, state, ['piercing'])
    if (action.areaKind === 'caltrops') {
      actor.classState.caltropsSpeedPenaltyFeet = Math.max(10, actor.classState.caltropsSpeedPenaltyFeet ?? 0)
      events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'caltrops-speed-penalty', active: true, value: 10 })
      return { ok: true, state, events }
    }
    if (!actor.conditionImmunities.some((condition) => ['restrained', '束缚'].includes(condition.toLowerCase())) &&
      !actor.conditions.some((condition) => ['restrained', '束缚'].includes(condition.toLowerCase()))) {
      applyDnd5eRulesCondition(actor, undefined, {
        condition: 'restrained', rulesId: 'hunting-trap', sourceKind: 'item',
      }, events)
    }
    return { ok: true, state, events }
  }

  if (action.type === 'ability-check') {
    let resolved: true | undefined
    try {
      resolved = resolveGeneralAbilityCheck(state, actor, action, events)
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    return resolved ? { ok: true, state, events } : fail(state, events, 'invalid-class-feature')
  }

  if (action.type === 'active-effect-damage-save') {
    const pendingIds = actor.classState.activeEffectDamageSavePendingIds ?? []
    const effect = reconciledDnd5eActiveEffects(actor).find((candidate) => candidate.id === action.effectId)
    const repeatSave = effect?.repeatSave
    if (!pendingIds.includes(action.effectId) || !effect || !repeatSave?.onDamage) {
      return fail(state, events, 'invalid-class-feature')
    }
    const sourceActor = effect.source.actorId ? state.combatants[effect.source.actorId] : undefined
    const baseMode = dnd5eSavingThrowMode(actor, repeatSave.ability, {
      effectVisible: effect.visibility !== 'dm-only',
      sourceCreatureType: sourceActor?.creatureType,
      sourceIsSpell: effect.source.kind === 'spell',
    })
    const mode = repeatSave.onDamage.mode === 'advantage'
      ? resolveDnd5eRollMode({
          requestedMode: baseMode,
          advantage: [{ active: true, reason: 'active-effect-damage-save' }],
        }).mode
      : baseMode
    let save: SavingThrowResolution
    try {
      const modifier = (actor.savingThrowBonuses[repeatSave.ability] ?? rules.abilityModifier(actor.abilities[repeatSave.ability])) +
        resolveDnd5eBlessRoll(state, actor, action.blessRoll) -
        resolveDnd5eBaneRoll(state, actor, action.baneRoll)
      save = resolveSavingThrowWithClassReroll({
        combatant: actor,
        ability: repeatSave.ability,
        rolls: mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? 0],
        rerollD20: action.rerollD20,
        rerollD20Second: action.rerollD20Second,
        bardicInspirationRoll: action.bardicInspirationRoll,
        darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
        mode,
        modifier,
        dc: repeatSave.dc,
        events,
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const remainingPendingIds = pendingIds.filter((effectId) => effectId !== action.effectId)
    actor.classState.activeEffectDamageSavePendingIds = remainingPendingIds.length > 0 ? remainingPendingIds : undefined
    events.push({
      type: 'saving-throw-resolved', targetId: actor.id, ability: repeatSave.ability,
      d20: save.roll.d20, modifier: save.roll.modifier, total: save.roll.total,
      dc: repeatSave.dc, success: save.success,
    })
    events.push({
      type: 'active-effect-save-resolved', targetId: actor.id, effectId: effect.id,
      ability: repeatSave.ability, dc: repeatSave.dc, total: save.roll.total, success: save.success,
    })
    if (save.success) {
      const spellId = effect.duration.type === 'concentration'
        ? effect.duration.concentrationId ?? effect.source.rulesId
        : undefined
      if (!sourceActor || !spellId || !endDnd5eSpellEffectOnTarget(state, sourceActor, actor, spellId, events)) {
        removeDnd5eEffectsByPredicate(
          actor,
          (candidate) =>
            candidate.id === effect.id ||
            (
              effect.source.rulesId === ABOLETH_ENSLAVE_RULES_ID &&
              candidate.source.actorId === effect.source.actorId &&
              candidate.source.rulesId === effect.source.rulesId
            ),
          'save-succeeded',
          events,
        )
      }
    }
    return { ok: true, state, events }
  }

  if (action.type === 'monster-action' || action.type === 'monster-legendary-action') return resolveMonsterAction(state, action, events)
  if (action.type === 'monster-special-action' || action.type === 'monster-legendary-special-action') {
    return resolveMonsterSpecialAction(state, action, events)
  }
  if (action.type === 'monster-adjudicated-action') return resolveMonsterAdjudicatedAction(state, action, events)
  if (action.type === 'monster-lair-action') return resolveMonsterLairAction(state, action, events)
  if (action.type === 'monster-spell') return resolveMonsterSpell(state, action, events)
  if (action.type === 'monster-core-spell') return resolveMonsterCoreSpell(state, action, events)
  if (action.type === 'monster-shapechange') return resolveMonsterShapechange(state, action, events)
  if (action.type === 'move-persistent-area') {
    if (!action.areaId || !spend(actor, action.economy)) {
      return fail(state, events, action.economy === 'action' ? 'action-unavailable' : 'bonus-action-unavailable')
    }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: action.economy })
    events.push({
      type: 'class-state-changed', actorId: actor.id,
      stateKey: `persistent-area-moved:${action.areaId}`, active: true,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'hellish-rebuke') return resolveHellishRebuke(state, action, events)
  if (action.type === 'cast-spell') return resolveSpellCast(state, action, events)
  if (action.type === 'adjudicated-spell') return resolveAdjudicatedSpell(state, action, events)
  if (action.type === 'monk-unarmed-bonus') return resolveMonkUnarmedBonus(state, action, events)
  if (action.type === 'monk-quivering-palm-release') return resolveMonkQuiveringPalmRelease(state, action, events)
  if (action.type === 'monk-deflect-missiles-return') return resolveMonkDeflectMissilesReturn(state, action, events)
  if (action.type === 'monk-quivering-palm-end') {
    if (
      dnd5eCombatantClassLevel(actor, 'monk') < 17 || !dnd5eCombatantHasSubclass(actor, 'monk', 'open-hand') ||
      !actor.classState.quiveringPalmTargetId
    ) return fail(state, events, 'invalid-class-feature')
    const targetId = actor.classState.quiveringPalmTargetId
    actor.classState.quiveringPalmTargetId = undefined
    events.push({
      type: 'class-state-changed', actorId: actor.id, targetId,
      stateKey: 'quivering-palm', active: false,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'attack' || action.type === 'opportunity-attack') return resolveWeaponAttack(state, action, events)
  if (action.type === 'ranger-hunter-multiattack') return resolveHunterMultiattack(state, action, events)
  if (action.type === 'monster-undead-fortitude-save') {
    const pending = actor.classState.undeadFortitudePending
    if (!pending || actor.currentHp !== 0 || actor.deathSaves.dead) {
      return fail(state, events, 'invalid-monster-action')
    }
    const mode = dnd5eSavingThrowMode(actor, 'con', { effectVisible: true })
    let resolved
    try {
      resolved = rules.resolveSavingThrow({
        rolls: mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? 0],
        mode,
        modifier: (actor.savingThrowBonuses.con ?? rules.abilityModifier(actor.abilities.con)) +
          resolveDnd5eBlessRoll(state, actor, action.blessRoll) -
          resolveDnd5eBaneRoll(state, actor, action.baneRoll),
        dc: pending.dc,
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    actor.classState.undeadFortitudePending = undefined
    if (resolved.success) {
      actor.currentHp = 1
      actor.deathSaves = { successes: 0, failures: 0, stable: false, dead: false }
    } else {
      actor.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    }
    events.push({
      type: 'saving-throw-resolved', targetId: actor.id, ability: 'con', d20: resolved.roll.d20,
      modifier: resolved.roll.modifier, total: resolved.roll.total, dc: pending.dc, success: resolved.success,
    })
    events.push({
      type: 'undead-fortitude-resolved', targetId: actor.id, d20: resolved.roll.d20,
      total: resolved.roll.total, dc: pending.dc, success: resolved.success,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'monster-on-hit-save') {
    const pending = actor.classState.monsterOnHitSavePending
    const sourceActor = state.combatants[action.sourceId]
    if (
      !pending || !sourceActor || actor.currentHp <= 0 || actor.deathSaves.dead ||
      pending.sourceId !== action.sourceId || pending.actionId !== action.actionId
    ) return fail(state, events, 'invalid-monster-action')
    const mode = dnd5eSavingThrowMode(actor, pending.ability, {
      effectVisible: true,
      condition: pending.condition,
    })
    let resolved
    try {
      resolved = resolveSavingThrowWithClassReroll({
        combatant: actor,
        ability: pending.ability,
        rolls: mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? 0],
        rerollD20: action.rerollD20,
        rerollD20Second: action.rerollD20Second,
        bardicInspirationRoll: action.bardicInspirationRoll,
        darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
        mode,
        modifier: (actor.savingThrowBonuses[pending.ability] ?? rules.abilityModifier(actor.abilities[pending.ability])) +
          resolveDnd5eBlessRoll(state, actor, action.blessRoll) -
          resolveDnd5eBaneRoll(state, actor, action.baneRoll),
        dc: pending.dc,
        events,
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    actor.classState.monsterOnHitSavePending = undefined
    events.push({
      type: 'saving-throw-resolved', targetId: actor.id, ability: pending.ability, d20: resolved.roll.d20,
      modifier: resolved.roll.modifier, total: resolved.roll.total, dc: pending.dc, success: resolved.success,
    })
    if (!resolved.success) {
      applyDnd5eRulesCondition(actor, sourceActor, {
        condition: pending.condition,
        rulesId: `monster:${sourceActor.statBlockId ?? sourceActor.id}:${pending.actionId}`,
        sourceKind: 'monster',
      }, events)
    }
    return { ok: true, state, events }
  }
  if (action.type === 'death-save-turn') {
    const saved = resolveDnd5eHeadlessActionInternal(state, {
      type: 'death-save',
      actorId: action.actorId,
      d20: action.d20,
      blessRoll: action.blessRoll,
      baneRoll: action.baneRoll,
      bardicInspirationRoll: action.bardicInspirationRoll,
      darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
    }, { skipTurnStartBoundary: true })
    if (!saved.ok || saved.state.combatants[action.actorId]?.currentHp > 0) {
      return { ...saved, events: [...events, ...saved.events] }
    }
    const ended = resolveDnd5eHeadlessActionInternal(saved.state, {
      type: 'end-turn',
      actorId: action.actorId,
      activeEffectSavingThrows: action.activeEffectSavingThrows,
      turnStartActiveEffectSavingThrows: action.turnStartActiveEffectSavingThrows,
      nextMonsterRechargeRolls: action.nextMonsterRechargeRolls,
      nextMonsterMechanicRolls: action.nextMonsterMechanicRolls,
    }, { skipTurnStartBoundary: true })
    return { ...ended, events: [...events, ...saved.events, ...ended.events] }
  }
  if (action.type === 'death-save') {
    if (actor.currentHp > 0 || actor.deathSaves.dead || actor.deathSaves.stable) return fail(state, events, 'invalid-actor')
    let resolved
    try {
      const inspiration = consumeBardicInspiration(actor, action.bardicInspirationRoll, events)
      const darkOnesOwnLuck = consumeDarkOnesOwnLuck(actor, action.darkOnesOwnLuckRoll, events)
      const bless = resolveDnd5eBlessRoll(state, actor, action.blessRoll)
      const bane = resolveDnd5eBaneRoll(state, actor, action.baneRoll)
      const effectiveD20 = action.d20 === 1 || action.d20 === 20
        ? action.d20
        : action.d20 + inspiration + darkOnesOwnLuck + bless - bane >= 10 ? 10 : 9
      resolved = rules.resolveDeathSave({ ...actor.deathSaves, currentHp: actor.currentHp }, effectiveD20)
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    actor.currentHp = resolved.currentHp
    actor.deathSaves = { successes: resolved.successes, failures: resolved.failures, stable: resolved.stable, dead: resolved.dead }
    if (actor.currentHp > 0) removeZeroHitPointUnconscious(actor, 'healed', events)
    else if (actor.deathSaves.dead) removeZeroHitPointUnconscious(actor, 'death', events)
    events.push({ type: 'death-save-resolved', actorId: actor.id, d20: action.d20, ...actor.deathSaves, currentHp: actor.currentHp })
    return { ok: true, state, events }
  }
  if (action.type === 'concentration-save') {
    if (!actor.concentrating) return fail(state, events, 'invalid-actor')
    let modifier: number
    try {
      modifier = (actor.savingThrowBonuses.con ?? rules.abilityModifier(actor.abilities.con)) +
        resolveDnd5eBlessRoll(state, actor, action.blessRoll) -
        resolveDnd5eBaneRoll(state, actor, action.baneRoll)
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const mode: D20RollMode = actor.exhaustionLevel >= 3 ? 'disadvantage' : 'normal'
    const rolls = mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? 0]
    let resolved
    try {
      resolved = resolveSavingThrowWithClassReroll({
        combatant: actor,
        ability: 'con',
        rolls,
        rerollD20: action.rerollD20,
        rerollD20Second: action.rerollD20Second,
        bardicInspirationRoll: action.bardicInspirationRoll,
        darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
        mode,
        modifier,
        dc: action.dc,
        events,
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    if (!resolved.success) {
      endDnd5eConcentration(state, actor, events)
    }
    events.push({ type: 'concentration-resolved', actorId: actor.id, d20: resolved.roll.d20, total: resolved.roll.total, dc: action.dc, success: resolved.success })
    return { ok: true, state, events }
  }
  if (action.type === 'barbarian-relentless-rage-save') {
    if (
      dnd5eCombatantClassLevel(actor, 'barbarian') < 11 || !actor.classState.raging || actor.currentHp !== 0 ||
      actor.classState.relentlessRagePendingDc !== action.dc || action.dc < 10
    ) return fail(state, events, 'invalid-class-feature')
    const mode: D20RollMode = actor.exhaustionLevel >= 3 ? 'disadvantage' : 'normal'
    const rolls = mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? 0]
    let resolved
    try {
      const modifier = (actor.savingThrowBonuses.con ?? rules.abilityModifier(actor.abilities.con)) +
        resolveDnd5eBlessRoll(state, actor, action.blessRoll) -
        resolveDnd5eBaneRoll(state, actor, action.baneRoll)
      resolved = applyBardicInspirationToSavingThrow(
        actor,
        applyDarkOnesOwnLuckToSavingThrow(
          actor,
          rules.resolveSavingThrow({ rolls, mode, modifier, dc: action.dc }),
          action.darkOnesOwnLuckRoll,
          events,
        ),
        action.bardicInspirationRoll,
        events,
      )
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    actor.classState.relentlessRagePendingDc = undefined
    if (resolved.success) {
      actor.currentHp = 1
      actor.classState.relentlessRageDc = action.dc + 5
    } else {
      endDnd5eConcentration(state, actor, events)
      endBarbarianRage(actor, events)
    }
    events.push({
      type: 'relentless-rage-resolved', actorId: actor.id, d20: resolved.roll.d20,
      total: resolved.roll.total, dc: action.dc, success: resolved.success,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'fighter-second-wind') {
    if (!Number.isInteger(action.d10) || action.d10 < 1 || action.d10 > 10) return fail(state, events, 'invalid-dice')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    if (!spendClassResource(actor, action.resourceKey, events)) return fail(state, events, 'class-resource-unavailable')
    events.unshift({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    const hpBefore = actor.currentHp
    actor.currentHp = Math.min(actor.maxHp, actor.currentHp + action.d10 + dnd5eCombatantClassLevel(actor, 'fighter'))
    if (actor.currentHp > hpBefore && (actor.classState.caltropsSpeedPenaltyFeet ?? 0) > 0) {
      actor.classState.caltropsSpeedPenaltyFeet = undefined
      events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'caltrops-speed-penalty', active: false })
    }
    events.push({ type: 'healing-applied', targetId: actor.id, amount: actor.currentHp - hpBefore, hpBefore, hpAfter: actor.currentHp })
    return { ok: true, state, events }
  }
  if (action.type === 'fighter-action-surge') {
    if (action.alreadyUsedThisTurn) return fail(state, events, 'feature-already-used')
    if (!spendClassResource(actor, action.resourceKey, events)) return fail(state, events, 'class-resource-unavailable')
    actor.turn = { ...actor.turn, actionAvailable: true }
    events.push({ type: 'action-surge-granted', actorId: actor.id })
    return { ok: true, state, events }
  }
  if (action.type === 'class-resource-use') {
    const amount = action.amount ?? 1
    // 核心 SRD 职业资源使用 dnd5e- 命名空间；旧职业的气、AP、冷却资源不能穿过此边界。
    if (!action.resourceKey.startsWith('dnd5e-') || !Number.isInteger(amount) || amount <= 0) {
      return fail(state, events, 'class-resource-unavailable')
    }
    const classResource = actor.classResources[action.resourceKey]
    if (!classResource || classResource.current < amount) return fail(state, events, 'class-resource-unavailable')
    if (action.turnResource && !spend(actor, action.turnResource)) {
      const reason = action.turnResource === 'reaction'
        ? 'reaction-unavailable'
        : action.turnResource === 'bonusAction'
          ? 'bonus-action-unavailable'
          : 'action-unavailable'
      return fail(state, events, reason)
    }
    if (action.turnResource) events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: action.turnResource })
    spendClassResource(actor, action.resourceKey, events, amount)
    return { ok: true, state, events }
  }
  if (action.type === 'druid-wild-shape') {
    const form = getDnd5eSrdMonster(action.formId)
    const knownForms = actor.classSelections[DND5E_WILD_SHAPE_KNOWN_FORMS_KEY] ?? []
    const uses = actor.classResources['dnd5e-wild-shape']
    const druidLevel = dnd5eCombatantClassLevel(actor, 'druid')
    if (
      druidLevel < 2 || !form || !knownForms.includes(form.id) ||
      !dnd5eWildShapeFormAllowedForLevel(druidLevel, form)
    ) return fail(state, events, 'invalid-class-feature')
    if (druidLevel < 20 && (!uses || uses.current < 1)) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    if (druidLevel < 20) spendClassResource(actor, 'dnd5e-wild-shape', events)

    const alreadyShaped = !!actor.classState.wildShapeFormId
    actor.classState = {
      ...actor.classState,
      wildShapeFormId: form.id,
      wildShapeCurrentHp: form.hitPoints.average,
      wildShapeRoundsRemaining: dnd5eWildShapeDurationHours(druidLevel) * 600,
      wildShapeOriginalCurrentHp: alreadyShaped ? actor.classState.wildShapeOriginalCurrentHp : actor.currentHp,
      wildShapeOriginalMaxHp: alreadyShaped ? actor.classState.wildShapeOriginalMaxHp : actor.maxHp,
      wildShapeOriginalArmorClass: alreadyShaped ? actor.classState.wildShapeOriginalArmorClass : actor.armorClass,
      wildShapeOriginalSpeed: alreadyShaped ? actor.classState.wildShapeOriginalSpeed : actor.speed,
      wildShapeOriginalAbilities: alreadyShaped ? actor.classState.wildShapeOriginalAbilities : { ...actor.abilities },
      wildShapeOriginalSavingThrowBonuses: alreadyShaped
        ? actor.classState.wildShapeOriginalSavingThrowBonuses
        : { ...actor.baseSavingThrowBonuses },
      wildShapeOriginalStatBlockId: alreadyShaped ? actor.classState.wildShapeOriginalStatBlockId : actor.statBlockId,
      wildShapeOriginalCreatureType: alreadyShaped ? actor.classState.wildShapeOriginalCreatureType : actor.creatureType,
      wildShapeOriginalDamageVulnerabilities: alreadyShaped
        ? actor.classState.wildShapeOriginalDamageVulnerabilities
        : [...actor.damageVulnerabilities],
      wildShapeOriginalDamageResistances: alreadyShaped
        ? actor.classState.wildShapeOriginalDamageResistances
        : [...actor.damageResistances],
      wildShapeOriginalDamageImmunities: alreadyShaped
        ? actor.classState.wildShapeOriginalDamageImmunities
        : [...actor.damageImmunities],
      wildShapeOriginalConditionImmunities: alreadyShaped
        ? actor.classState.wildShapeOriginalConditionImmunities
        : [...actor.conditionImmunities],
    }
    applyWildShapeFormStats(actor, form, form.hitPoints.average)
    events.push({
      type: 'class-state-changed',
      actorId: actor.id,
      stateKey: 'wild-shape',
      active: true,
      value: actor.currentHp,
      targetId: form.id,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'druid-end-wild-shape') {
    if (dnd5eCombatantClassLevel(actor, 'druid') < 1 || !actor.classState.wildShapeFormId) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    revertDnd5eWildShape(actor, 0, events)
    return { ok: true, state, events }
  }
  if (action.type === 'barbarian-rage') {
    if (action.end) {
      if (action.frenzy || dnd5eCombatantClassLevel(actor, 'barbarian') < 1 || !actor.classState.raging) {
        return fail(state, events, 'invalid-class-feature')
      }
      if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
      events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
      endBarbarianRage(actor, events)
      return { ok: true, state, events }
    }
    const rage = actor.classResources['dnd5e-rage']
    if (action.frenzy && (!dnd5eCombatantHasSubclass(actor, 'barbarian', 'berserker') || dnd5eCombatantClassLevel(actor, 'barbarian') < 3)) return fail(state, events, 'invalid-class-feature')
    if (dnd5eCombatantClassLevel(actor, 'barbarian') < 1 || actor.wearingHeavyArmor || actor.classState.raging) return fail(state, events, 'invalid-class-feature')
    if (!rage || rage.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    spendClassResource(actor, 'dnd5e-rage', events)
    if (actor.concentrating || actor.classState.concentrationSpellId) {
      endDnd5eConcentration(state, actor, events)
    }
    actor.classState = {
      ...actor.classState,
      raging: true,
      rageTurnsRemaining: 10,
      rageSustainedThisTurn: false,
      frenzying: action.frenzy || undefined,
      frenzyStartedTurnKey: action.frenzy ? classFeatureTurnKey(state, actor.id) : undefined,
      surpriseResolvedCombatId: dnd5eCombatantIsSurprised(actor, state.combatId) ? state.combatId : actor.classState.surpriseResolvedCombatId,
    }
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'rage', active: true, value: 10 })
    return { ok: true, state, events }
  }
  if (action.type === 'barbarian-intimidating-presence') {
    const target = state.combatants[action.targetId]
    if (
      dnd5eCombatantClassLevel(actor, 'barbarian') < 10 || !dnd5eCombatantHasSubclass(actor, 'barbarian', 'berserker') ||
      !target || target.id === actor.id || target.currentHp <= 0 || target.controller === actor.controller
    ) return fail(state, events, 'invalid-class-feature')
    const extending = target.classState.intimidatingPresenceSourceId === actor.id &&
      (target.classState.intimidatingPresenceRoundsRemaining ?? 0) > 0
    const immunityRounds = target.classState.intimidatingPresenceImmunityRoundsBySource?.[actor.id] ?? 0
    if (!extending && immunityRounds > 0) return fail(state, events, 'invalid-class-feature')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    if (extending) {
      target.classState.intimidatingPresenceRoundsRemaining = 2
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: target.id,
        stateKey: 'intimidating-presence', active: true, value: 2,
      })
      return { ok: true, state, events }
    }
    const dc = 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities.cha)
    const mode = dnd5eSavingThrowMode(target, 'wis', { effectVisible: true, condition: 'frightened' })
    const rolls = mode === 'normal'
      ? [action.savingThrowD20 ?? 0]
      : [action.savingThrowD20 ?? 0, action.savingThrowD20Second ?? 0]
    let save
    try {
      const modifier = (target.savingThrowBonuses.wis ?? rules.abilityModifier(target.abilities.wis)) +
        resolveDnd5eBlessRoll(state, target, action.savingThrowBlessRoll) -
        resolveDnd5eBaneRoll(state, target, action.savingThrowBaneRoll)
      save = resolveSavingThrowWithClassReroll({
        combatant: target,
        ability: 'wis',
        rolls,
        rerollD20: action.savingThrowRerollD20,
        rerollD20Second: action.savingThrowRerollD20Second,
        bardicInspirationRoll: action.bardicInspirationRoll,
        darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
        mode,
        modifier,
        dc,
        events,
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    events.push({
      type: 'saving-throw-resolved', targetId: target.id, ability: 'wis', d20: save.roll.d20,
      modifier: save.roll.modifier, total: save.roll.total, dc, success: save.success,
    })
    if (save.success) {
      target.classState.intimidatingPresenceImmunityRoundsBySource = {
        ...target.classState.intimidatingPresenceImmunityRoundsBySource,
        [actor.id]: 14_400,
      }
      events.push({
        type: 'class-state-changed', actorId: target.id, targetId: actor.id,
        stateKey: 'intimidating-presence-immunity', active: true, value: 14_400,
      })
      return { ok: true, state, events }
    }
    const fearImmune = ['frightened', '惊惧', '恐慌'].some((condition) =>
      dnd5eConditionImmuneFromSource(target, condition, actor),
    )
    if (!fearImmune) {
      target.classState.intimidatingPresenceSourceId = actor.id
      target.classState.intimidatingPresenceRoundsRemaining = 2
      applyDnd5eRulesCondition(target, actor, {
        condition: 'frightened', rulesId: 'intimidating-presence',
        duration: { type: 'rounds', remainingRounds: 2, tickOn: 'target-turn-end' },
        sourceKind: 'feature',
      }, events)
    }
    return { ok: true, state, events }
  }
  if (action.type === 'rogue-cunning-action' || action.type === 'ranger-vanish' || action.type === 'monk-step-of-the-wind') {
    if (action.type === 'rogue-cunning-action') {
      if (dnd5eCombatantClassLevel(actor, 'rogue') < 2) return fail(state, events, 'invalid-class-feature')
    } else if (action.type === 'ranger-vanish') {
      if (dnd5eCombatantClassLevel(actor, 'ranger') < 14) return fail(state, events, 'invalid-class-feature')
    } else {
      if (action.option !== 'dash' && action.option !== 'disengage') return fail(state, events, 'invalid-class-feature')
      const ki = actor.classResources['dnd5e-ki']
      if (dnd5eCombatantClassLevel(actor, 'monk') < 2) return fail(state, events, 'invalid-class-feature')
      if (!ki || ki.current < 1) return fail(state, events, 'class-resource-unavailable')
    }
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    if (action.type === 'monk-step-of-the-wind') spendClassResource(actor, 'dnd5e-ki', events)
    if (action.type !== 'ranger-vanish' && action.option === 'dash') {
      const effectiveSpeed = dnd5eEffectiveSpeed(actor)
      actor.turn = { ...actor.turn, movementRemaining: actor.turn.movementRemaining + effectiveSpeed }
      events.push({ type: 'movement-granted', actorId: actor.id, amount: effectiveSpeed })
    } else if (action.type !== 'ranger-vanish' && action.option === 'disengage') {
      actor.disengaged = true
      events.push({ type: 'disengage-granted', actorId: actor.id })
    } else {
      if (action.type !== 'rogue-cunning-action' && action.type !== 'ranger-vanish') return fail(state, events, 'invalid-class-feature')
      if (action.hideAllowed !== true) return fail(state, events, 'invalid-class-feature')
      const observers = Object.values(state.combatants).filter((candidate) =>
        candidate.id !== actor.id && candidate.currentHp > 0 && !candidate.deathSaves.dead && candidate.controller !== actor.controller,
      )
      const passivePerception = observers.reduce((maximum, observer) => Math.max(maximum, observer.passivePerception), 0)
      const effectiveSpeed = dnd5eEffectiveSpeed(actor)
      const movementSpent = Math.max(0, effectiveSpeed - actor.turn.movementRemaining)
      const supremeSneak = dnd5eCombatantHasSubclass(actor, 'rogue', 'thief') && dnd5eCombatantClassLevel(actor, 'rogue') >= 9 && movementSpent <= effectiveSpeed / 2
      let check
      try {
        check = resolveRogueDexterityCheck({
          actor, skill: 'stealth', d20: action.d20, d20Second: action.d20Second,
          advantage: supremeSneak, events, dc: passivePerception,
        })
      } catch {
        return fail(state, events, 'invalid-dice')
      }
      if (check.success) {
        actor.classState.hiddenCheckTotal = check.roll.total
        events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hidden', active: true, value: check.roll.total })
      } else {
        actor.classState.hiddenCheckTotal = undefined
        events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hidden', active: false })
      }
    }
    return { ok: true, state, events }
  }
  if (action.type === 'monster-nimble-escape') {
    const monster = actor.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
    const trait = monster?.traits.find((candidate) =>
      candidate.automation === 'headless' && candidate.rule?.kind === 'nimble-escape',
    )
    if (
      !trait || trait.rule?.kind !== 'nimble-escape' ||
      !trait.rule.bonusActionOptions.includes(action.option)
    ) return fail(state, events, 'invalid-class-feature')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    actor.disengaged = true
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    events.push({ type: 'disengage-granted', actorId: actor.id })
    return { ok: true, state, events }
  }
  if (action.type === 'rogue-fast-hands') {
    if (dnd5eCombatantClassLevel(actor, 'rogue') < 3 || !dnd5eCombatantHasSubclass(actor, 'rogue', 'thief')) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    if (action.option === 'use-object') {
      events.push({ type: 'object-action-taken', actorId: actor.id, action: 'use-object' })
      return { ok: true, state, events }
    }
    try {
      resolveRogueDexterityCheck({
        actor,
        skill: action.option === 'sleight-of-hand' ? 'sleightOfHand' : 'thievesTools',
        d20: action.d20,
        d20Second: action.d20Second,
        events,
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    return { ok: true, state, events }
  }
  if (action.type === 'ranger-move-hunters-mark') {
    const target = state.combatants[action.targetId]
    const previousTargetId = actor.classState.huntersMarkTargetId
    const previousTarget = previousTargetId ? state.combatants[previousTargetId] : undefined
    if (
      dnd5eCombatantClassLevel(actor, 'ranger') < 2 || !actor.concentrating || !previousTargetId ||
      previousTargetId === action.targetId || (previousTarget && previousTarget.currentHp > 0) ||
      !target || target.currentHp <= 0 || target.controller === actor.controller
    ) return fail(state, events, 'invalid-class-feature')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    actor.classState.huntersMarkTargetId = target.id
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hunters-mark', active: true, targetId: target.id })
    return { ok: true, state, events }
  }
  if (action.type === 'monk-stillness-of-mind') {
    if (dnd5eCombatantClassLevel(actor, 'monk') < 7) return fail(state, events, 'invalid-class-feature')
    const aliases = action.condition === 'charmed'
      ? new Set(['charmed', '魅惑'])
      : new Set(['frightened', '惊惧', '恐慌'])
    if (!actor.conditions.some((condition) => aliases.has(condition.toLowerCase()))) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    removeDnd5eConditionEffects(actor, [...aliases], 'dm', events)
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    events.push({ type: 'condition-ended', targetId: actor.id, condition: action.condition === 'charmed' ? '魅惑' : '恐慌' })
    return { ok: true, state, events }
  }
  if (action.type === 'monk-empty-body') {
    const ki = actor.classResources['dnd5e-ki']
    if (dnd5eCombatantClassLevel(actor, 'monk') < 18 || (actor.classState.emptyBodyRoundsRemaining ?? 0) > 0) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!ki || ki.current < 4) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-ki', events, 4)
    actor.classState.emptyBodyRoundsRemaining = 10
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'empty-body', active: true, value: 10 })
    return { ok: true, state, events }
  }
  if (action.type === 'monk-patient-defense') {
    const ki = actor.classResources['dnd5e-ki']
    if (dnd5eCombatantClassLevel(actor, 'monk') < 2) return fail(state, events, 'invalid-class-feature')
    if (!ki || ki.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    spendClassResource(actor, 'dnd5e-ki', events)
    actor.dodging = true
    actor.classState.dodgingTurnKey = classFeatureTurnKey(state, actor.id)
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'patient-defense', active: true })
    return { ok: true, state, events }
  }
  if (action.type === 'paladin-sacred-weapon') {
    const channel = actor.classResources['dnd5e-channel-divinity']
    if (dnd5eCombatantClassLevel(actor, 'paladin') < 3 || !dnd5eCombatantHasSubclass(actor, 'paladin', 'devotion')) return fail(state, events, 'invalid-class-feature')
    if (!channel || channel.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-channel-divinity', events)
    actor.classState.sacredWeaponTurnsRemaining = 10
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'sacred-weapon', active: true, value: 10 })
    return { ok: true, state, events }
  }
  if (action.type === 'paladin-divine-sense') {
    const uses = actor.classResources['dnd5e-divine-sense']
    const uniqueTargets = new Set(action.targetIds)
    const sensedTypes = new Set(['天界', '天界生物', '邪魔', '亡灵'])
    if (dnd5eCombatantClassLevel(actor, 'paladin') < 1 || uniqueTargets.size !== action.targetIds.length) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (action.targetIds.some((targetId) => {
      const target = state.combatants[targetId]
      return !target || !sensedTypes.has(target.creatureType ?? '')
    })) return fail(state, events, 'invalid-class-feature')
    if (!uses || uses.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-divine-sense', events)
    events.push({ type: 'creatures-sensed', actorId: actor.id, targetIds: [...action.targetIds] })
    return { ok: true, state, events }
  }
  if (action.type === 'ranger-primeval-awareness') {
    const uniqueTargets = new Set(action.targetIds)
    const slotKey = `dnd5e-spell-slot-${action.slotLevel}`
    const slot = actor.classResources[slotKey]
    const sensedCategory = (creatureType: string | undefined): string | undefined => {
      const normalized = (creatureType ?? '').trim().toLowerCase()
      if (normalized === '异怪' || normalized === 'aberration') return '异怪'
      if (normalized === '天界' || normalized === '天界生物' || normalized === 'celestial') return '天界生物'
      if (normalized === '龙' || normalized === '龙类' || normalized === 'dragon') return '龙类'
      if (normalized === '元素' || normalized === '元素生物' || normalized === 'elemental') return '元素生物'
      if (normalized === '妖精' || normalized === 'fey') return '妖精'
      if (normalized === '邪魔' || normalized === 'fiend') return '邪魔'
      if (normalized === '亡灵' || normalized === 'undead') return '亡灵'
      return undefined
    }
    const categories = action.targetIds.map((targetId) => sensedCategory(state.combatants[targetId]?.creatureType))
    if (
      dnd5eCombatantClassLevel(actor, 'ranger') < 3 ||
      !Number.isInteger(action.slotLevel) || action.slotLevel < 1 || action.slotLevel > 5 ||
      uniqueTargets.size !== action.targetIds.length || categories.some((category) => !category)
    ) return fail(state, events, 'invalid-class-feature')
    if (!slot || slot.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, slotKey, events)
    events.push({
      type: 'creature-types-sensed',
      actorId: actor.id,
      creatureTypes: [...new Set(categories.filter((category): category is string => !!category))],
      durationRounds: action.slotLevel * 10,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'ranger-hide-in-plain-sight') {
    if (dnd5eCombatantClassLevel(actor, 'ranger') < 10) return fail(state, events, 'invalid-class-feature')
    actor.classState.hideInPlainSightPrepared = true
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hide-in-plain-sight', active: true, value: 10 })
    return { ok: true, state, events }
  }
  if (action.type === 'cleric-turn-undead') {
    const channel = actor.classResources['dnd5e-channel-divinity']
    const uniqueTargets = new Set(action.targets.map((target) => target.targetId))
    if (
      dnd5eCombatantClassLevel(actor, 'cleric') < 2 || uniqueTargets.size !== action.targets.length ||
      action.targets.some((roll) => {
        const target = state.combatants[roll.targetId]
        return !target || target.currentHp <= 0 || target.deathSaves.dead || !dnd5eCreatureIsUndead(target)
      })
    ) return fail(state, events, 'invalid-class-feature')
    if (!channel || channel.current < 1) return fail(state, events, 'class-resource-unavailable')

    const dc = 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities.wis)
    const saves: Array<{ target: Dnd5eCombatant; success: boolean; d20: number; modifier: number; total: number }> = []
    try {
      for (const roll of action.targets) {
        const target = state.combatants[roll.targetId]
        const mode = dnd5eSavingThrowMode(target, 'wis', { effectVisible: true })
        const resolved = resolveSavingThrowWithClassReroll({
          combatant: target,
          ability: 'wis',
          rolls: mode === 'normal' ? [roll.d20] : [roll.d20, roll.d20Second ?? 0],
          rerollD20: roll.rerollD20,
          rerollD20Second: roll.rerollD20Second,
          bardicInspirationRoll: roll.bardicInspirationRoll,
          darkOnesOwnLuckRoll: roll.darkOnesOwnLuckRoll,
          mode,
          modifier: (target.savingThrowBonuses.wis ?? rules.abilityModifier(target.abilities.wis)) +
            resolveDnd5eBlessRoll(state, target, roll.blessRoll) -
            resolveDnd5eBaneRoll(state, target, roll.baneRoll),
          dc,
          events,
        })
        saves.push({
          target,
          success: resolved.success,
          d20: resolved.roll.d20,
          modifier: resolved.roll.modifier,
          total: resolved.roll.total,
        })
      }
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-channel-divinity', events)

    const destroyThreshold = dnd5eDestroyUndeadMaximumChallenge(dnd5eCombatantClassLevel(actor, 'cleric'))
    for (const save of saves) {
      events.push({
        type: 'saving-throw-resolved', targetId: save.target.id, ability: 'wis', d20: save.d20,
        modifier: save.modifier, total: save.total, dc, success: save.success,
      })
      if (save.success) continue
      if (
        destroyThreshold != null && save.target.challengeRating != null &&
        save.target.challengeRating <= destroyThreshold
      ) {
        const hpBefore = save.target.currentHp
        if (!finalizeDnd5eInstantDeath(state, save.target, events)) continue
        events.push({ type: 'hit-points-reduced-to-zero', sourceId: actor.id, targetId: save.target.id, hpBefore })
        events.push({
          type: 'undead-destroyed', actorId: actor.id, targetId: save.target.id,
          challengeRating: save.target.challengeRating,
        })
        continue
      }
      save.target.classState.turnedByClericId = actor.id
      save.target.classState.turnedRoundsRemaining = 10
      applyDnd5eRulesCondition(save.target, actor, {
        condition: 'turned', rulesId: 'turn-undead',
        duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
        breakOn: ['takes-damage'], sourceKind: 'feature',
      }, events)
      events.push({ type: 'undead-turned', actorId: actor.id, targetId: save.target.id, rounds: 10 })
    }
    return { ok: true, state, events }
  }
  if (action.type === 'paladin-turn-the-unholy') {
    const channel = actor.classResources['dnd5e-channel-divinity']
    const uniqueTargets = new Set(action.targets.map((target) => target.targetId))
    if (
      dnd5eCombatantClassLevel(actor, 'paladin') < 3 || !dnd5eCombatantHasSubclass(actor, 'paladin', 'devotion') ||
      uniqueTargets.size !== action.targets.length ||
      action.targets.some((roll) => {
        const target = state.combatants[roll.targetId]
        return !target || target.currentHp <= 0 || target.deathSaves.dead ||
          (!dnd5eCreatureIsUndead(target) && !dnd5eCreatureIsFiend(target))
      })
    ) return fail(state, events, 'invalid-class-feature')
    if (!channel || channel.current < 1) return fail(state, events, 'class-resource-unavailable')

    const dc = 8 + actor.proficiencyBonus + rules.abilityModifier(actor.abilities.cha)
    const saves: Array<{ target: Dnd5eCombatant; success: boolean; d20: number; modifier: number; total: number }> = []
    try {
      for (const roll of action.targets) {
        const target = state.combatants[roll.targetId]
        const mode = dnd5eSavingThrowMode(target, 'wis', { effectVisible: true })
        const resolved = resolveSavingThrowWithClassReroll({
          combatant: target,
          ability: 'wis',
          rolls: mode === 'normal' ? [roll.d20] : [roll.d20, roll.d20Second ?? 0],
          rerollD20: roll.rerollD20,
          rerollD20Second: roll.rerollD20Second,
          bardicInspirationRoll: roll.bardicInspirationRoll,
          darkOnesOwnLuckRoll: roll.darkOnesOwnLuckRoll,
          mode,
          modifier: (target.savingThrowBonuses.wis ?? rules.abilityModifier(target.abilities.wis)) +
            resolveDnd5eBlessRoll(state, target, roll.blessRoll) -
            resolveDnd5eBaneRoll(state, target, roll.baneRoll),
          dc,
          events,
        })
        saves.push({
          target,
          success: resolved.success,
          d20: resolved.roll.d20,
          modifier: resolved.roll.modifier,
          total: resolved.roll.total,
        })
      }
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-channel-divinity', events)
    for (const save of saves) {
      events.push({
        type: 'saving-throw-resolved', targetId: save.target.id, ability: 'wis', d20: save.d20,
        modifier: save.modifier, total: save.total, dc, success: save.success,
      })
      if (save.success) continue
      save.target.classState.turnedByClericId = actor.id
      save.target.classState.turnedRoundsRemaining = 10
      applyDnd5eRulesCondition(save.target, actor, {
        condition: 'turned', rulesId: 'turn-the-unholy',
        duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
        breakOn: ['takes-damage'], sourceKind: 'feature',
      }, events)
      events.push({ type: 'unholy-turned', actorId: actor.id, targetId: save.target.id, rounds: 10 })
    }
    return { ok: true, state, events }
  }
  if (action.type === 'bardic-inspiration') {
    const target = state.combatants[action.targetId]
    const inspiration = actor.classResources['dnd5e-bardic-inspiration']
    if (dnd5eCombatantClassLevel(actor, 'bard') < 1 || !target || target.id === actor.id || target.currentHp <= 0 || target.classState.bardicInspirationDie) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!inspiration || inspiration.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    spendClassResource(actor, 'dnd5e-bardic-inspiration', events)
    const die = dnd5eBardicInspirationDie(dnd5eCombatantClassLevel(actor, 'bard'))
    target.classState = {
      ...target.classState,
      bardicInspirationDie: die,
      bardicInspirationSourceId: actor.id,
      bardicInspirationRoundsRemaining: 100,
    }
    events.push({ type: 'class-state-changed', actorId: actor.id, targetId: target.id, stateKey: 'bardic-inspiration', active: true, value: die })
    return { ok: true, state, events }
  }
  if (action.type === 'bard-countercharm') {
    if (dnd5eCombatantClassLevel(actor, 'bard') < 6 || dnd5eIsIncapacitated(actor)) {
      return fail(state, events, 'invalid-class-feature')
    }
    const silenced = actor.conditions.some((condition) => ['silenced', '沉默'].includes(condition.toLowerCase()))
    if (silenced) return fail(state, events, 'invalid-class-feature')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    actor.classState.countercharmRoundsRemaining = 2
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'countercharm', active: true, value: 2 })
    return { ok: true, state, events }
  }
  if (action.type === 'paladin-lay-on-hands') {
    const target = state.combatants[action.targetId]
    const amount = action.amount
    const cure = action.cure
    const pool = actor.classResources['dnd5e-lay-on-hands']
    const cureAliases = cure === 'disease'
      ? new Set(['disease', '疾病'])
      : cure === 'poisoned'
        ? new Set(['poisoned', '中毒'])
        : undefined
    const cureRequested = cureAliases != null
    if (
      dnd5eCombatantClassLevel(actor, 'paladin') < 1 || !target || target.currentHp <= 0 || target.deathSaves.dead ||
      dnd5eCreatureIsUndead(target) || dnd5eCreatureIsConstruct(target) ||
      (cureRequested
        ? amount != null || !target.conditions.some((condition) => cureAliases.has(condition.toLowerCase()))
        : cure != null || !Number.isInteger(amount) || (amount ?? 0) <= 0 || (amount ?? 0) > target.maxHp - target.currentHp)
    ) return fail(state, events, 'invalid-class-feature')
    const cost = cureRequested ? 5 : amount ?? 0
    if (!pool || pool.current < cost) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-lay-on-hands', events, cost)
    if (cureRequested) {
      removeDnd5eEffectsByPredicate(
        target,
        (effect) => effect.standardCondition === (cure === 'poisoned' ? 'poisoned' : undefined) ||
          (!!effect.legacyCondition && cureAliases.has(effect.legacyCondition.toLowerCase())),
        'dm',
        events,
      )
      events.push({ type: 'condition-ended', targetId: target.id, condition: cure === 'disease' ? '疾病' : '中毒' })
    } else {
      applyHealing(target, amount ?? 0, events)
    }
    return { ok: true, state, events }
  }
  if (action.type === 'paladin-cleansing-touch') {
    const target = state.combatants[action.targetId]
    const source = state.combatants[action.sourceId]
    const uses = actor.classResources['dnd5e-cleansing-touch']
    if (
      dnd5eCombatantClassLevel(actor, 'paladin') < 14 || !target || !source ||
      target.currentHp <= 0 || target.deathSaves.dead ||
      (target.id !== actor.id && target.controller !== actor.controller) ||
      !action.spellId ||
      target.classState.concentrationEffectsBySource?.[source.id] !== action.spellId ||
      source.classState.concentrationSpellId !== action.spellId ||
      !source.classState.concentrationTargetIds?.includes(target.id) || !source.concentrating
    ) return fail(state, events, 'invalid-class-feature')
    if (!uses || uses.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    if (!endDnd5eSpellEffectOnTarget(state, source, target, action.spellId, events)) {
      return fail(state, events, 'invalid-class-feature')
    }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-cleansing-touch', events)
    events.push({
      type: 'class-state-changed', actorId: actor.id, targetId: target.id,
      stateKey: 'cleansing-touch', active: true,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'monk-wholeness-of-body') {
    const use = actor.classResources['dnd5e-wholeness-of-body']
    if (dnd5eCombatantClassLevel(actor, 'monk') < 6 || !dnd5eCombatantHasSubclass(actor, 'monk', 'open-hand') || actor.currentHp >= actor.maxHp) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!use || use.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-wholeness-of-body', events)
    applyHealing(actor, dnd5eCombatantClassLevel(actor, 'monk') * 3, events)
    return { ok: true, state, events }
  }
  if (action.type === 'cleric-preserve-life') {
    const channel = actor.classResources['dnd5e-channel-divinity']
    const allocations = action.allocations
    const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    const uniqueTargets = new Set(allocations.map((allocation) => allocation.targetId))
    if (
      dnd5eCombatantClassLevel(actor, 'cleric') < 2 || !dnd5eCombatantHasSubclass(actor, 'cleric', 'life') || allocations.length === 0 ||
      uniqueTargets.size !== allocations.length || !Number.isInteger(total) || total <= 0 || total > dnd5eCombatantClassLevel(actor, 'cleric') * 5
    ) return fail(state, events, 'invalid-class-feature')
    for (const allocation of allocations) {
      const target = state.combatants[allocation.targetId]
      const maximumByFeature = target ? Math.floor(target.maxHp / 2) - target.currentHp : 0
      if (
        !target || target.currentHp <= 0 || target.creatureType === '亡灵' || target.creatureType === '构装生物' ||
        !Number.isInteger(allocation.amount) || allocation.amount <= 0 || allocation.amount > maximumByFeature
      ) {
        return fail(state, events, 'invalid-class-feature')
      }
    }
    if (!channel || channel.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-channel-divinity', events)
    for (const allocation of allocations) applyHealing(state.combatants[allocation.targetId], allocation.amount, events)
    return { ok: true, state, events }
  }
  if (action.type === 'cleric-divine-intervention') {
    const use = actor.classResources['dnd5e-divine-intervention']
    const clericLevel = dnd5eCombatantClassLevel(actor, 'cleric')
    const automatic = clericLevel >= 20
    if (
      dnd5eCombatantClassLevel(actor, 'cleric') < 10 || (actor.classState.divineInterventionCooldownDays ?? 0) > 0 ||
      (!automatic && (!Number.isInteger(action.d100) || (action.d100 ?? 0) < 1 || (action.d100 ?? 0) > 100))
    ) return fail(state, events, 'invalid-class-feature')
    if (!use || use.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    const success = automatic || (action.d100 ?? 101) <= clericLevel
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-divine-intervention', events)
    if (success) actor.classState.divineInterventionCooldownDays = 7
    events.push({
      type: 'divine-intervention-resolved', actorId: actor.id, d100: automatic ? undefined : action.d100,
      success, automatic, cooldownDays: success ? 7 : undefined,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'paladin-holy-nimbus') {
    const use = actor.classResources['dnd5e-holy-nimbus']
    if (
      dnd5eCombatantClassLevel(actor, 'paladin') < 20 || !dnd5eCombatantHasSubclass(actor, 'paladin', 'devotion') ||
      (actor.classState.holyNimbusRoundsRemaining ?? 0) > 0
    ) return fail(state, events, 'invalid-class-feature')
    if (!use || use.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-holy-nimbus', events)
    actor.classState.holyNimbusRoundsRemaining = 10
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'holy-nimbus', active: true, value: 10 })
    return { ok: true, state, events }
  }
  if (action.type === 'sorcerer-create-spell-slot') {
    const pointCosts = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 } as const
    const cost = pointCosts[action.slotLevel]
    const points = actor.classResources['dnd5e-sorcery-points']
    const slotKey = `dnd5e-spell-slot-${action.slotLevel}`
    const slot = actor.classResources[slotKey]
    if (dnd5eCombatantClassLevel(actor, 'sorcerer') < 2 || !points || points.current < cost || !slot || slot.current >= slot.max) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    spendClassResource(actor, 'dnd5e-sorcery-points', events, cost)
    restoreClassResource(actor, slotKey, 1, events)
    return { ok: true, state, events }
  }
  if (action.type === 'sorcerer-convert-spell-slot') {
    const slotLevel = action.slotLevel
    const slotKey = `dnd5e-spell-slot-${slotLevel}`
    const slot = actor.classResources[slotKey]
    const points = actor.classResources['dnd5e-sorcery-points']
    if (
      dnd5eCombatantClassLevel(actor, 'sorcerer') < 2 || !Number.isInteger(slotLevel) || slotLevel < 1 || slotLevel > 9 ||
      !slot || slot.current < 1 || !points || points.current + slotLevel > points.max
    ) return fail(state, events, 'invalid-class-feature')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    spendClassResource(actor, slotKey, events)
    restoreClassResource(actor, 'dnd5e-sorcery-points', slotLevel, events)
    return { ok: true, state, events }
  }
  if (action.type === 'sorcerer-draconic-wings') {
    if (
      dnd5eCombatantClassLevel(actor, 'sorcerer') < 14 || !dnd5eCombatantHasSubclass(actor, 'sorcerer', 'draconic') ||
      actor.classState.draconicWingsActive === action.active || (action.active && actor.wearingArmor)
    ) return fail(state, events, 'invalid-class-feature')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    actor.classState.draconicWingsActive = action.active || undefined
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'draconic-wings', active: action.active })
    return { ok: true, state, events }
  }
  if (action.type === 'sorcerer-draconic-presence') {
    const points = actor.classResources['dnd5e-sorcery-points']
    if (
      dnd5eCombatantClassLevel(actor, 'sorcerer') < 18 || !dnd5eCombatantHasSubclass(actor, 'sorcerer', 'draconic') ||
      (action.mode !== 'awe' && action.mode !== 'fear')
    ) return fail(state, events, 'invalid-class-feature')
    if (!points || points.current < 5) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-sorcery-points', events, 5)
    beginDnd5eConcentration(state, actor, `class:draconic-presence:${action.mode}`, [], 10, events)
    events.push({
      type: 'class-state-changed', actorId: actor.id,
      stateKey: `draconic-presence-${action.mode}`, active: true, value: 10,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'sorcerer-draconic-presence-save') {
    const source = state.combatants[action.sourceId]
    const effectId = source?.classState.concentrationSpellId
    const mode = effectId?.endsWith(':fear') ? 'fear' : effectId?.endsWith(':awe') ? 'awe' : undefined
    if (
      !source || !mode || dnd5eCombatantClassLevel(source, 'sorcerer') < 18 || !dnd5eCombatantHasSubclass(source, 'sorcerer', 'draconic') ||
      !source.concentrating || !actor.draconicPresenceSourceIds?.includes(source.id)
    ) return fail(state, events, 'invalid-class-feature')
    const condition = mode === 'fear' ? 'frightened' : 'charmed'
    if (dnd5eConditionImmuneFromSource(actor, condition, source)) return fail(state, events, 'invalid-class-feature')
    const dc = 8 + source.proficiencyBonus + rules.abilityModifier(source.abilities.cha)
    const saveMode = dnd5eSavingThrowMode(actor, 'wis', { effectVisible: true, condition })
    try {
      const save = resolveSavingThrowWithClassReroll({
        combatant: actor,
        ability: 'wis',
        rolls: saveMode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? 0],
        rerollD20: action.rerollD20,
        rerollD20Second: action.rerollD20Second,
        bardicInspirationRoll: action.bardicInspirationRoll,
        darkOnesOwnLuckRoll: action.darkOnesOwnLuckRoll,
        mode: saveMode,
        modifier: (actor.savingThrowBonuses.wis ?? rules.abilityModifier(actor.abilities.wis)) +
          resolveDnd5eBlessRoll(state, actor, action.blessRoll) -
          resolveDnd5eBaneRoll(state, actor, action.baneRoll),
        dc,
        events,
      })
      events.push({
        type: 'saving-throw-resolved', targetId: actor.id, ability: 'wis', d20: save.roll.d20,
        modifier: save.roll.modifier, total: save.roll.total, dc, success: save.success,
      })
      if (save.success) {
        actor.classState.draconicPresenceImmunityRoundsBySource = {
          ...(actor.classState.draconicPresenceImmunityRoundsBySource ?? {}),
          [source.id]: 14_400,
        }
        events.push({
          type: 'class-state-changed', actorId: source.id, targetId: actor.id,
          stateKey: 'draconic-presence-immunity', active: true, value: 14_400,
        })
      } else {
        const incoming = createDnd5eConditionEffect({
          id: `draconic-presence:${source.id}:${actor.id}:${condition}`,
          condition,
          targetId: actor.id,
          source: { kind: 'feature', actorId: source.id, actorName: source.name, rulesId: effectId, label: '龙威' },
          duration: { type: 'concentration', sourceActorId: source.id, concentrationId: effectId },
          appliedAt: 0,
          appliedRound: state.round,
          appliedTurnKey: classFeatureTurnKey(state, source.id),
        })
        const mutation = applyDnd5eActiveEffect({
          effects: reconciledDnd5eActiveEffects(actor), incoming,
          conditionImmunities: actor.conditionImmunities,
        })
        if (mutation.status !== 'rejected-immune') {
          actor.classState.concentrationEffectsBySource = {
            ...(actor.classState.concentrationEffectsBySource ?? {}),
            [source.id]: effectId!,
          }
          source.classState.concentrationTargetIds = [...new Set([
            ...(source.classState.concentrationTargetIds ?? []), actor.id,
          ])]
          commitDnd5eActiveEffects(actor, mutation.effects)
          events.push({ type: 'condition-applied', actorId: source.id, targetId: actor.id, condition })
          events.push({
            type: 'active-effect-applied', targetId: actor.id,
            effectId: incoming.id, definitionId: incoming.definitionId,
          })
        }
      }
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    return { ok: true, state, events }
  }
  if (action.type === 'move') {
    const turnSource = actor.classState.turnedByClericId
      ? state.combatants[actor.classState.turnedByClericId]
      : undefined
    if (turnSource) {
      const currentDistanceSquared = (actor.position.x - turnSource.position.x) ** 2 + (actor.position.y - turnSource.position.y) ** 2
      const nextDistanceSquared = (action.to.x - turnSource.position.x) ** 2 + (action.to.y - turnSource.position.y) ** 2
      if (nextDistanceSquared < currentDistanceSquared) return fail(state, events, 'invalid-class-feature')
    }
    const fearSource = actor.classState.intimidatingPresenceSourceId
      ? state.combatants[actor.classState.intimidatingPresenceSourceId]
      : undefined
    if (fearSource && dnd5eCombatantCanSee(state, actor.id, fearSource.id)) {
      const currentDistanceSquared = (actor.position.x - fearSource.position.x) ** 2 + (actor.position.y - fearSource.position.y) ** 2
      const nextDistanceSquared = (action.to.x - fearSource.position.x) ** 2 + (action.to.y - fearSource.position.y) ** 2
      if (nextDistanceSquared < currentDistanceSquared) return fail(state, events, 'invalid-class-feature')
    }
    for (const sourceId of dnd5eConditionSourceIds(actor, 'frightened')) {
      const source = state.combatants[sourceId]
      if (!source || source.id === fearSource?.id) continue
      if (!dnd5eCombatantCanSee(state, actor.id, source.id)) continue
      if (dnd5eConditionPreventsApproachingSource({
        mover: actor,
        sourceId,
        sourceIdsByCondition: { frightened: [sourceId] },
        destinationIsCloser:
          (action.to.x - source.position.x) ** 2 + (action.to.y - source.position.y) ** 2 <
          (actor.position.x - source.position.x) ** 2 + (actor.position.y - source.position.y) ** 2,
      })) return fail(state, events, 'invalid-class-feature')
    }
    const isProne = actor.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
    if (action.standFromProne && !isProne) return fail(state, events, 'invalid-class-feature')
    if (
      action.standFromProne &&
      reconciledDnd5eActiveEffects(actor).some((effect) => effect.source.kind === 'spell' && effect.source.rulesId === 'hideous-laughter')
    ) return fail(state, events, 'invalid-class-feature')
    const effectiveSpeed = dnd5eEffectiveSpeed(actor)
    if (action.standFromProne && effectiveSpeed <= 0) return fail(state, events, 'invalid-class-feature')
    const standCost = action.standFromProne ? Math.floor(effectiveSpeed / 2) : 0
    const traversalMode = action.traversalMode ?? 'walk'
    const fromElevationFeet = actor.elevationFeet ?? 0
    const toElevationFeet = Number.isFinite(action.toElevationFeet) ? Math.floor(action.toElevationFeet!) : fromElevationFeet
    const elevationGainFeet = Math.max(0, toElevationFeet - fromElevationFeet)
    const traversal = dnd5eTraversalMovementCost({
      distanceFeet: action.distance,
      elevationGainFeet,
      mode: traversalMode,
      profile: {
        strengthScore: actor.abilities.str,
        strengthModifier: rules.abilityModifier(actor.abilities.str),
        walkSpeed: actor.movementSpeeds?.walk ?? actor.speed,
        climbSpeed: actor.movementSpeeds?.climb,
        swimSpeed: actor.movementSpeeds?.swim,
        flySpeed: dnd5eEffectiveFlySpeed(actor),
        climbWithoutSpeedCostMultiplier: dnd5eCombatantClassLevel(actor, 'rogue') >= 3 &&
          dnd5eCombatantHasSubclass(actor, 'rogue', 'thief') ? 1 : 2,
        runningLongJumpBonusFeet: dnd5eCombatantClassLevel(actor, 'rogue') >= 3 &&
          dnd5eCombatantHasSubclass(actor, 'rogue', 'thief')
          ? Math.max(0, rules.abilityModifier(actor.abilities.dex))
          : dnd5eCombatantClassLevel(actor, 'fighter') >= 7 && dnd5eCombatantHasSubclass(actor, 'fighter', 'champion')
            ? Math.max(0, rules.abilityModifier(actor.abilities.str))
            : 0,
        jumpDistanceMultiplier: dnd5eActiveJumpDistanceMultiplier(actor.classState.activeEffects),
      },
    })
    if (!traversal.ok) return fail(state, events, 'invalid-class-feature')
    const crawlExtra = isProne && !action.standFromProne ? action.distance : 0
    const carefulExtra = action.carefulMovement ? action.distance : 0
    const defaultMovementCost = traversal.movementCostFeet + crawlExtra + carefulExtra + standCost
    const movementCost = action.movementCost == null ? defaultMovementCost : action.movementCost
    if (!Number.isFinite(movementCost) || movementCost < defaultMovementCost) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!spend(actor, 'movement', movementCost)) return fail(state, events, 'insufficient-movement')
    if (action.standFromProne) removeDnd5eConditionEffects(actor, ['prone', '倒地'], 'dm', events)
    const from = { ...actor.position }
    actor.position = { ...action.to }
    actor.elevationFeet = toElevationFeet
    actor.airborne = traversalMode === 'fly' && toElevationFeet > 0
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'movement', amount: movementCost })
    events.push({ type: 'moved', actorId: actor.id, from, to: actor.position, distance: action.distance })
    if (toElevationFeet !== fromElevationFeet) {
      events.push({ type: 'elevation-changed', actorId: actor.id, fromElevationFeet, toElevationFeet, mode: traversalMode })
    }
    const fallDistanceFeet = traversalMode === 'fall' ? Math.max(0, fromElevationFeet - toElevationFeet) : 0
    if (fallDistanceFeet >= 10) {
      const safeFall = fallDistanceFeet <= dnd5eActiveSafeFallFeet(actor.classState.activeEffects) &&
        !dnd5eIsIncapacitated(actor)
      if (safeFall) {
        if ((action.fallingDamageRolls?.length ?? 0) > 0) {
          const supplied = resolveDnd5eFallingDamage(fallDistanceFeet, action.fallingDamageRolls ?? [])
          if (!supplied.ok) return fail(state, events, 'invalid-dice')
        }
        events.push({
          type: 'falling-damage-resolved', actorId: actor.id, distanceFeet: fallDistanceFeet,
          dice: Math.min(20, Math.floor(fallDistanceFeet / 10)), damage: 0, landedProne: false,
        })
      } else {
      const falling = resolveDnd5eFallingDamage(fallDistanceFeet, action.fallingDamageRolls ?? [])
      if (!falling.ok) return fail(state, events, 'invalid-dice')
      const adjustedFallingDamage = adjustDamageForTarget(actor, falling.damage, 'bludgeoning')
      applyDamage(actor, adjustedFallingDamage, false, events, undefined, state, ['bludgeoning'])
      const landedProne = falling.landsProne && adjustedFallingDamage > 0
      if (landedProne && actor.currentHp > 0) {
        applyDnd5eStandardConditionEffect(actor, undefined, {
          definitionId: `srd-5.1:falling:prone:${actor.id}`,
          rulesId: 'srd-5.1:falling',
          condition: 'prone',
          duration: { type: 'permanent' },
          sourceKind: 'system',
        }, events)
      }
      events.push({
        type: 'falling-damage-resolved', actorId: actor.id, distanceFeet: fallDistanceFeet,
        dice: falling.dice, damage: adjustedFallingDamage, landedProne,
      })
      }
    } else if ((action.fallingDamageRolls?.length ?? 0) > 0) return fail(state, events, 'invalid-dice')
    if (action.distance > 0) triggerDnd5eActiveEffectBreak(actor, 'moves', events, state)
    return { ok: true, state, events }
  }
  if (action.type === 'dash') {
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    const grantedMovement = dnd5eEffectiveSpeed(actor)
    actor.turn = { ...actor.turn, movementRemaining: actor.turn.movementRemaining + grantedMovement }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    events.push({ type: 'movement-granted', actorId: actor.id, amount: grantedMovement })
    return { ok: true, state, events }
  }
  if (action.type === 'hide') {
    const seenByHostile = Object.values(state.combatants).some((candidate) =>
      candidate.id !== actor.id && candidate.controller !== actor.controller && candidate.currentHp > 0 &&
      !candidate.deathSaves.dead && dnd5eCombatantCanSee(state, candidate.id, actor.id),
    )
    if (seenByHostile) return fail(state, events, 'invalid-target')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    const mode = resolveDnd5eRollMode({
      advantage: [{
        active: dnd5eActiveAbilityCheckAdvantages(actor.classState.activeEffects).includes('dex'),
        reason: 'ability-check-advantage',
      }],
      disadvantage: [{
        active: actor.exhaustionLevel >= 1 ||
          dnd5eConditionAbilityCheckDisadvantage(actor) ||
          actor.wearingUnproficientArmor ||
          actor.armorStealthDisadvantage,
        reason: 'hide-disadvantage',
      }],
    }).mode
    let check
    try {
      check = rules.resolveD20({
        rolls: mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? 0],
        mode,
        modifier: rules.abilityModifier(actor.abilities.dex) +
          actor.proficiencyBonus * abilityCheckProficiencyRank(actor, 'stealth'),
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    events.push({ type: 'hide-resolved', actorId: actor.id, d20: check.d20, total: check.total })
    const hostilePassivePerception = Math.max(0, ...Object.values(state.combatants).flatMap((candidate) =>
      candidate.id !== actor.id && candidate.controller !== actor.controller && candidate.currentHp > 0 &&
      !candidate.deathSaves.dead
        ? [candidate.passivePerception]
        : [],
    ))
    if (check.total < hostilePassivePerception) {
      actor.classState.hiddenCheckTotal = undefined
      events.push({
        type: 'class-state-changed', actorId: actor.id,
        stateKey: 'hidden', active: false, value: check.total,
      })
      return { ok: true, state, events }
    }
    actor.classState.hiddenCheckTotal = check.total
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hidden', active: true, value: check.total })
    return { ok: true, state, events }
  }
  if (action.type === 'help') {
    const target = state.combatants[action.targetId]
    if (!target || target.currentHp <= 0 || target.deathSaves.dead || target.id === actor.id) {
      return fail(state, events, 'invalid-target')
    }
    if (action.helpKind === 'ability-check' && target.controller !== actor.controller) {
      return fail(state, events, 'invalid-target')
    }
    if (action.helpKind === 'attack') {
      if (target.controller === actor.controller || dnd5eAttackDistanceFeet(state, actor.id, target.id) > 5) {
        return fail(state, events, 'invalid-target')
      }
    }
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    const turnKey = classFeatureTurnKey(state, actor.id)
    if (action.helpKind === 'ability-check') {
      target.classState.helpedAbilityCheckSourceId = actor.id
      target.classState.helpedAbilityCheckSourceTurnKey = turnKey
    } else {
      target.classState.helpedAttackSourceId = actor.id
      target.classState.helpedAttackSourceTurnKey = turnKey
    }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    events.push({ type: 'help-granted', actorId: actor.id, targetId: target.id, helpKind: action.helpKind })
    return { ok: true, state, events }
  }
  if (action.type === 'wake-sleeping-creature') {
    const target = state.combatants[action.targetId]
    const sleepEffects = target?.classState.activeEffects?.filter((effect) =>
      effect.standardCondition === 'unconscious' &&
      effect.source.kind === 'spell' && effect.source.rulesId === 'sleep',
    ) ?? []
    if (
      !target || target.id === actor.id || target.currentHp <= 0 || target.deathSaves.dead ||
      sleepEffects.length < 1 || dnd5eAttackDistanceFeet(state, actor.id, target.id) > 5 ||
      state.lineOfEffectBlockedByCombatantPair?.[dnd5eDirectedCombatantPairKey(actor.id, target.id)]
    ) return fail(state, events, 'invalid-target')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    const sleepEffectIds = new Set(sleepEffects.map((effect) => effect.id))
    removeDnd5eEffectsByPredicate(
      target,
      (effect) => sleepEffectIds.has(effect.id),
      'awakened',
      events,
    )
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    events.push({ type: 'sleeping-creature-awakened', actorId: actor.id, targetId: target.id, spellId: 'sleep' })
    return { ok: true, state, events }
  }
  if (action.type === 'ready') {
    const trigger = action.trigger.trim()
    if (!trigger || trigger.length > 320 || (action.targetId && !state.combatants[action.targetId])) {
      return fail(state, events, 'invalid-target')
    }
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    actor.classState.readiedAction = {
      trigger,
      actionKind: action.actionKind,
      targetId: action.targetId,
      preparedTurnKey: classFeatureTurnKey(state, actor.id),
    }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    events.push({ type: 'ready-declared', actorId: actor.id, trigger, actionKind: action.actionKind, targetId: action.targetId })
    return { ok: true, state, events }
  }
  if (action.type === 'trigger-readied-action') {
    const readied = actor.classState.readiedAction
    if (!readied || dnd5eReactionsPrevented(actor) || !spend(actor, 'reaction')) {
      return fail(state, events, 'reaction-unavailable')
    }
    actor.classState.readiedAction = undefined
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'reaction' })
    events.push({
      type: 'readied-action-triggered', actorId: actor.id, trigger: readied.trigger,
      actionKind: readied.actionKind, targetId: readied.targetId,
    })
    return { ok: true, state, events }
  }
  if (action.type === 'use-object') {
    if (!action.interactionId.trim() || action.interactionId.length > 320) {
      return fail(state, events, 'invalid-target')
    }
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    events.push({ type: 'object-action-taken', actorId: actor.id, action: 'use-object', interactionId: action.interactionId.trim() })
    return { ok: true, state, events }
  }
  if (action.type === 'escape-active-effect') {
    const effect = reconciledDnd5eActiveEffects(actor).find((candidate) => candidate.id === action.effectId)
    const escapeCheck = effect?.escapeCheck
    if (!effect || !escapeCheck || escapeCheck.economy !== 'action') {
      return fail(state, events, 'invalid-target')
    }
    const escapeAbility = escapeCheck.alternativeAbility &&
      rules.abilityModifier(actor.abilities[escapeCheck.alternativeAbility]) >
        rules.abilityModifier(actor.abilities[escapeCheck.ability])
      ? escapeCheck.alternativeAbility
      : escapeCheck.ability
    const resolved = resolveGeneralAbilityCheck(state, actor, {
      type: 'ability-check',
      actorId: actor.id,
      ability: escapeAbility,
      d20: action.d20,
      d20Second: action.d20Second,
      dc: escapeCheck.dc,
      spendAction: true,
    }, events)
    if (!resolved) return fail(state, events, 'invalid-dice')
    const check = [...events].reverse().find((event) =>
      event.type === 'ability-check-resolved' &&
      event.actorId === actor.id &&
      event.ability === escapeAbility &&
      event.dc === escapeCheck.dc
    )
    if (check?.type === 'ability-check-resolved' && check.success) {
      removeDnd5eEffectsByPredicate(
        actor,
        (candidate) => candidate.id === effect.id,
        'escaped',
        events,
      )
      const sourceId = effect.source.actorId
      if (sourceId && actor.classState.concentrationEffectsBySource?.[sourceId] === effect.source.rulesId) {
        const concentrationEffects = actor.classState.concentrationEffectsBySource ?? {}
        const remaining = Object.fromEntries(
          Object.entries(concentrationEffects).filter(([id]) => id !== sourceId),
        )
        actor.classState.concentrationEffectsBySource = Object.keys(remaining).length > 0 ? remaining : undefined
        const sourceActor = state.combatants[sourceId]
        if (sourceActor?.classState.concentrationTargetIds) {
          sourceActor.classState.concentrationTargetIds = sourceActor.classState.concentrationTargetIds
            .filter((targetId) => targetId !== actor.id)
        }
      }
    }
    return { ok: true, state, events }
  }
  if (action.type === 'escape-grapple') {
    const grappler = state.combatants[action.grapplerId]
    const grappleEffect = grappler && reconciledDnd5eActiveEffects(actor).find((effect) =>
      effect.standardCondition === 'grappled' && effect.source.actorId === grappler.id)
    if (!grappler || !grappleEffect || grappler.currentHp <= 0 || grappler.deathSaves.dead) {
      return fail(state, events, 'invalid-target')
    }
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    const actorDefense = dnd5eBestGrappleDefense(actor)
    const actorAbilityAdvantages = dnd5eActiveAbilityCheckAdvantages(actor.classState.activeEffects)
    const actorStrengthEffect = actorDefense.skill === 'athletics'
      ? dnd5eActiveStrengthRollFlags(actor.classState.activeEffects)
      : { advantage: false, disadvantage: false }
    const targetStrengthEffect = dnd5eActiveStrengthRollFlags(grappler.classState.activeEffects)
    const actorMode = resolveDnd5eRollMode({
      advantage: [{
        active: actorDefense.skill === 'athletics' && actor.classState.raging === true ||
          actorStrengthEffect.advantage ||
          actorAbilityAdvantages.includes(actorDefense.skill === 'athletics' ? 'str' : 'dex'),
        reason: 'rage-strength-check',
      }],
      disadvantage: [{
        active: actor.exhaustionLevel >= 1 || dnd5eConditionAbilityCheckDisadvantage(actor) ||
          actorStrengthEffect.disadvantage,
        reason: 'contest-disadvantage',
      }],
    }).mode
    const targetMode = resolveDnd5eRollMode({
      advantage: [{
        active: grappler.classState.raging === true || targetStrengthEffect.advantage ||
          dnd5eActiveAbilityCheckAdvantages(grappler.classState.activeEffects).includes('str'),
        reason: 'rage-strength-check',
      }],
      disadvantage: [{
        active: grappler.exhaustionLevel >= 1 || dnd5eConditionAbilityCheckDisadvantage(grappler) ||
          targetStrengthEffect.disadvantage,
        reason: 'contest-disadvantage',
      }],
    }).mode
    let actorCheck
    let targetCheck
    try {
      actorCheck = rules.resolveD20({
        rolls: actorMode === 'normal' ? [action.actorD20] : [action.actorD20, action.actorD20Second ?? 0],
        mode: actorMode,
        modifier: actorDefense.modifier,
      })
      targetCheck = rules.resolveD20({
        rolls: targetMode === 'normal' ? [action.targetD20] : [action.targetD20, action.targetD20Second ?? 0],
        mode: targetMode,
        modifier: rules.abilityModifier(grappler.abilities.str) +
          grappler.proficiencyBonus * abilityCheckProficiencyRank(grappler, 'athletics'),
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const success = actorCheck.total > targetCheck.total
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    events.push({
      type: 'contest-resolved', actorId: actor.id, targetId: grappler.id,
      contest: 'escape-grapple', actorSkill: actorDefense.skill, targetDefense: 'athletics',
      actorTotal: actorCheck.total, targetTotal: targetCheck.total, success,
    })
    if (success) {
      removeDnd5eEffectsByPredicate(
        actor,
        (effect) => effect.id === grappleEffect.id,
        'escaped',
        events,
      )
    }
    return { ok: true, state, events }
  }
  if (action.type === 'grapple' || action.type === 'shove') {
    const target = state.combatants[action.targetId]
    if (
      !target || target.controller === actor.controller || target.currentHp <= 0 || target.deathSaves.dead ||
      dnd5eEffectiveSizeRank(target) > dnd5eEffectiveSizeRank(actor) + 1 ||
      dnd5eAttackDistanceFeet(state, actor.id, target.id) > 5 ||
      (action.type === 'shove' && action.outcome === 'push' && (
        !action.pushTo || !Number.isFinite(action.pushTo.x) || !Number.isFinite(action.pushTo.y) ||
        (action.pushTo.x - actor.position.x) ** 2 + (action.pushTo.y - actor.position.y) ** 2 <=
          (target.position.x - actor.position.x) ** 2 + (target.position.y - actor.position.y) ** 2
      ))
    ) return fail(state, events, 'invalid-target')
    if (action.spendAction !== false && !spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    const actorStrengthEffect = dnd5eActiveStrengthRollFlags(actor.classState.activeEffects)
    const actorAbilityAdvantages = dnd5eActiveAbilityCheckAdvantages(actor.classState.activeEffects)
    const targetDefense = dnd5eBestGrappleDefense(target).skill
    const defenseAbility: AbilityKey = targetDefense === 'athletics' ? 'str' : 'dex'
    const targetStrengthEffect = defenseAbility === 'str'
      ? dnd5eActiveStrengthRollFlags(target.classState.activeEffects)
      : { advantage: false, disadvantage: false }
    const targetAbilityAdvantages = dnd5eActiveAbilityCheckAdvantages(target.classState.activeEffects)
    const actorMode = resolveDnd5eRollMode({
      advantage: [{
        active: actor.classState.raging === true || actorStrengthEffect.advantage ||
          actorAbilityAdvantages.includes('str'),
        reason: 'rage-strength-check',
      }],
      disadvantage: [{
        active: actor.exhaustionLevel >= 1 || dnd5eConditionAbilityCheckDisadvantage(actor) ||
          actorStrengthEffect.disadvantage,
        reason: 'contest-disadvantage',
      }],
    }).mode
    const targetMode = resolveDnd5eRollMode({
      advantage: [{
        active: targetStrengthEffect.advantage || targetAbilityAdvantages.includes(defenseAbility),
        reason: 'ability-check-advantage',
      }],
      disadvantage: [{
        active: target.exhaustionLevel >= 1 || dnd5eConditionAbilityCheckDisadvantage(target) ||
          targetStrengthEffect.disadvantage,
        reason: 'contest-disadvantage',
      }],
    }).mode
    let actorCheck
    let targetCheck
    try {
      actorCheck = rules.resolveD20({
        rolls: actorMode === 'normal' ? [action.actorD20] : [action.actorD20, action.actorD20Second ?? 0],
        mode: actorMode,
        modifier: rules.abilityModifier(actor.abilities.str) + actor.proficiencyBonus * abilityCheckProficiencyRank(actor, 'athletics'),
      })
      targetCheck = rules.resolveD20({
        rolls: targetMode === 'normal' ? [action.targetD20] : [action.targetD20, action.targetD20Second ?? 0],
        mode: targetMode,
        modifier: rules.abilityModifier(target.abilities[defenseAbility]) +
          target.proficiencyBonus * abilityCheckProficiencyRank(target, targetDefense),
      })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const success = actorCheck.total > targetCheck.total
    if (action.spendAction !== false) events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    events.push({
      type: 'contest-resolved', actorId: actor.id, targetId: target.id, contest: action.type,
      targetDefense, actorTotal: actorCheck.total, targetTotal: targetCheck.total, success,
      outcome: action.type === 'shove' ? action.outcome : undefined,
    })
    if (success && action.type === 'grapple') {
      applyDnd5eStandardConditionEffect(target, actor, {
        id: dnd5eActiveEffectId('basic-action:grapple', actor.id, target.id),
        rulesId: 'basic-action:grapple', condition: 'grappled', duration: { type: 'permanent' }, sourceKind: 'feature',
      }, events)
    }
    if (success && action.type === 'shove' && action.outcome === 'prone') {
      applyDnd5eStandardConditionEffect(target, actor, {
        id: dnd5eActiveEffectId('basic-action:shove-prone', actor.id, target.id),
        rulesId: 'basic-action:shove-prone', condition: 'prone', duration: { type: 'permanent' }, sourceKind: 'feature',
      }, events)
    }
    if (success && action.type === 'shove' && action.outcome === 'push' && action.pushTo) {
      const from = { ...target.position }
      target.position = { ...action.pushTo }
      events.push({ type: 'moved', actorId: target.id, from, to: target.position, distance: 5 })
      if (!applyDnd5eForcedMovementElevation(
        state,
        target,
        action.pushToElevationFeet,
        action.fallingDamageRolls,
        events,
      )) return fail(state, events, 'invalid-dice')
    } else if (
      action.type === 'shove' &&
      (action.pushToElevationFeet != null || (action.fallingDamageRolls?.length ?? 0) > 0)
    ) return fail(state, events, 'invalid-dice')
    return { ok: true, state, events }
  }
  if (action.type === 'disengage' || action.type === 'dodge') {
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    actor.disengaged = action.type === 'disengage'
    actor.dodging = action.type === 'dodge'
    if (action.type === 'dodge') actor.classState.dodgingTurnKey = classFeatureTurnKey(state, actor.id)
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    return { ok: true, state, events }
  }
  if (action.type === 'interact-object') {
    if (!action.interactionId.trim() || action.interactionId.length > 320) {
      return fail(state, events, 'invalid-class-feature')
    }
    const resource: TurnResource = action.useAction ? 'action' : 'objectInteraction'
    if (!spend(actor, resource)) {
      return fail(state, events, action.useAction ? 'action-unavailable' : 'object-interaction-unavailable')
    }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource })
    events.push({ type: 'object-action-taken', actorId: actor.id, action: 'interact-object', interactionId: action.interactionId })
    return { ok: true, state, events }
  }

  if (action.type === 'end-turn' && dnd5eCombatantIsSurprised(actor, state.combatId)) {
    actor.classState.surpriseResolvedCombatId = state.combatId
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'surprise', active: false })
  }

  if (action.type === 'end-turn' && !resolveDnd5eMonsterMechanics({
    state,
    actor,
    monster: actor.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined,
    event: 'turn-end',
    supplied: action.currentMonsterMechanicRolls,
    events,
  })) return fail(state, events, 'invalid-dice')

  if (action.type === 'end-turn' && !resolveDnd5eActiveEffectSaves({
    state,
    target: actor,
    timing: 'target-turn-end',
    supplied: action.activeEffectSavingThrows,
    events,
  })) return fail(state, events, 'invalid-dice')

  if (action.type === 'end-turn' && actor.classState.raging) {
    const remaining = Math.max(0, (actor.classState.rageTurnsRemaining ?? 0) - 1)
    const continues = remaining > 0 && (dnd5eCombatantClassLevel(actor, 'barbarian') >= 15 || actor.classState.rageSustainedThisTurn === true)
    if (continues) {
      actor.classState = { ...actor.classState, raging: true, rageTurnsRemaining: remaining, rageSustainedThisTurn: false }
    } else {
      endBarbarianRage(actor, events)
    }
  }

  if (action.type === 'end-turn' && actor.classState.wildShapeFormId) {
    const remaining = Math.max(0, (actor.classState.wildShapeRoundsRemaining ?? 0) - 1)
    if (remaining <= 0) {
      revertDnd5eWildShape(actor, 0, events)
    } else {
      actor.classState.wildShapeRoundsRemaining = remaining
    }
  }

  if (action.type === 'end-turn' && actor.concentrating && actor.classState.concentrationRoundsRemaining != null) {
    const remaining = Math.max(0, actor.classState.concentrationRoundsRemaining - 1)
    if (remaining > 0) actor.classState.concentrationRoundsRemaining = remaining
    else endDnd5eConcentration(state, actor, events)
  }

  if (action.type === 'end-turn' && (actor.classState.sacredWeaponTurnsRemaining ?? 0) > 0) {
    const remaining = Math.max(0, (actor.classState.sacredWeaponTurnsRemaining ?? 0) - 1)
    actor.classState.sacredWeaponTurnsRemaining = remaining || undefined
    if (remaining === 0) {
      events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'sacred-weapon', active: false })
    }
  }

  if (action.type === 'end-turn' && (actor.classState.holyNimbusRoundsRemaining ?? 0) > 0) {
    const remaining = Math.max(0, (actor.classState.holyNimbusRoundsRemaining ?? 0) - 1)
    actor.classState.holyNimbusRoundsRemaining = remaining || undefined
    if (remaining === 0) {
      events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'holy-nimbus', active: false })
    }
  }

  if (action.type === 'end-turn' && (actor.classState.emptyBodyRoundsRemaining ?? 0) > 0) {
    const remaining = Math.max(0, (actor.classState.emptyBodyRoundsRemaining ?? 0) - 1)
    actor.classState.emptyBodyRoundsRemaining = remaining || undefined
    if (remaining === 0) {
      events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'empty-body', active: false })
    }
  }

  if (action.type === 'end-turn' && (actor.classState.draconicResistanceRoundsRemaining ?? 0) > 0) {
    const remaining = Math.max(0, (actor.classState.draconicResistanceRoundsRemaining ?? 0) - 1)
    actor.classState.draconicResistanceRoundsRemaining = remaining || undefined
    if (remaining === 0) {
      actor.classState.draconicResistanceType = undefined
      events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'draconic-resistance', active: false })
    }
  }

  if (action.type === 'end-turn' && (actor.classState.turnedRoundsRemaining ?? 0) > 0) {
    const remaining = Math.max(0, (actor.classState.turnedRoundsRemaining ?? 0) - 1)
    actor.classState.turnedRoundsRemaining = remaining || undefined
    if (remaining === 0) clearTurnUndead(actor, events)
  }

  if (action.type === 'end-turn' && actor.classState.bardicInspirationDie) {
    const remaining = Math.max(0, (actor.classState.bardicInspirationRoundsRemaining ?? 100) - 1)
    actor.classState.bardicInspirationRoundsRemaining = remaining || undefined
    if (remaining === 0) {
      actor.classState.bardicInspirationDie = undefined
      actor.classState.bardicInspirationSourceId = undefined
      events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'bardic-inspiration', active: false })
    }
  }

  if (action.type === 'end-turn' && (actor.classState.countercharmRoundsRemaining ?? 0) > 0) {
    const remaining = Math.max(0, (actor.classState.countercharmRoundsRemaining ?? 0) - 1)
    actor.classState.countercharmRoundsRemaining = remaining || undefined
    if (remaining === 0) {
      events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'countercharm', active: false })
    }
  }

  if (action.type === 'end-turn' && actor.classState.viciousMockeryAttackDisadvantage) {
    actor.classState.viciousMockeryAttackDisadvantage = undefined
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'vicious-mockery', active: false })
  }

  if (action.type === 'end-turn') {
    const endingTurnKey = classFeatureTurnKey(state, actor.id)
    for (const combatant of Object.values(state.combatants)) {
      if (combatant.classState.deflectMissilesCatchTurnKey !== endingTurnKey) continue
      combatant.classState.deflectMissilesCatchSourceId = undefined
      combatant.classState.deflectMissilesCatchTurnKey = undefined
      combatant.classState.deflectMissilesCatchDamageType = undefined
      events.push({
        type: 'class-state-changed', actorId: combatant.id,
        stateKey: 'deflect-missiles-catch', active: false,
      })
    }
    for (const target of Object.values(state.combatants)) {
      if (
        target.classState.hurlThroughHellSourceId !== actor.id ||
        target.classState.hurlThroughHellAppliedTurnKey === endingTurnKey
      ) continue
      const pendingDamage = target.classState.hurlThroughHellDamage ?? 0
      target.classState.hurlThroughHellSourceId = undefined
      target.classState.hurlThroughHellDamage = undefined
      target.classState.hurlThroughHellAppliedTurnKey = undefined
      removeDnd5eConditionEffects(target, ['banished'], 'expired', events)
      events.push({ type: 'condition-ended', targetId: target.id, condition: 'banished' })
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: target.id,
        stateKey: 'hurl-through-hell', active: false, value: pendingDamage,
      })
      const creatureType = (target.creatureType ?? '').toLowerCase()
      const isFiend = creatureType === 'fiend' || creatureType.includes('邪魔')
      if (!isFiend && pendingDamage > 0) {
        applyDamage(target, adjustDamageForTarget(target, pendingDamage, 'psychic'), false, events, actor, state, ['psychic'])
      }
    }
    for (const target of Object.values(state.combatants)) {
      if (target.classState.stunnedByActorId !== actor.id || target.classState.stunnedAppliedTurnKey === endingTurnKey) continue
      target.classState.stunnedByActorId = undefined
      target.classState.stunnedAppliedTurnKey = undefined
      events.push({ type: 'condition-ended', targetId: target.id, condition: '震慑' })
    }
    for (const target of Object.values(state.combatants)) {
      const appliedBySource = target.classState.openHandNoReactionsAppliedTurnKeysBySource
      if (!appliedBySource?.[actor.id] || appliedBySource[actor.id] === endingTurnKey) continue
      const remaining = Object.fromEntries(Object.entries(appliedBySource).filter(([sourceId]) => sourceId !== actor.id))
      target.classState.openHandNoReactionsAppliedTurnKeysBySource = Object.keys(remaining).length > 0 ? remaining : undefined
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: target.id,
        stateKey: 'open-hand-no-reactions', active: false,
      })
    }
  }

  if (action.type === 'end-turn') {
    const immunity = actor.classState.intimidatingPresenceImmunityRoundsBySource
    if (immunity) {
      const remaining = Object.fromEntries(
        Object.entries(immunity)
          .map(([sourceId, rounds]) => [sourceId, Math.max(0, rounds - 1)] as const)
          .filter(([, rounds]) => rounds > 0),
      )
      actor.classState.intimidatingPresenceImmunityRoundsBySource = Object.keys(remaining).length > 0
        ? remaining
        : undefined
    }
    const natureSanctuaryImmunity = actor.classState.natureSanctuaryImmunityRoundsByTarget
    if (natureSanctuaryImmunity) {
      const expiredTargetIds: string[] = []
      const remaining = Object.fromEntries(
        Object.entries(natureSanctuaryImmunity)
          .map(([targetId, rounds]) => {
            const nextRounds = Math.max(0, rounds - 1)
            if (nextRounds === 0) expiredTargetIds.push(targetId)
            return [targetId, nextRounds] as const
          })
          .filter(([, rounds]) => rounds > 0),
      )
      actor.classState.natureSanctuaryImmunityRoundsByTarget = Object.keys(remaining).length > 0
        ? remaining
        : undefined
      for (const targetId of expiredTargetIds) {
        events.push({
          type: 'class-state-changed', actorId: actor.id, targetId,
          stateKey: 'nature-sanctuary-immunity', active: false,
        })
      }
    }
    const draconicPresenceImmunity = actor.classState.draconicPresenceImmunityRoundsBySource
    if (draconicPresenceImmunity) {
      const remaining = Object.fromEntries(
        Object.entries(draconicPresenceImmunity)
          .map(([sourceId, rounds]) => [sourceId, Math.max(0, rounds - 1)] as const)
          .filter(([, rounds]) => rounds > 0),
      )
      actor.classState.draconicPresenceImmunityRoundsBySource = Object.keys(remaining).length > 0
        ? remaining
        : undefined
    }
    for (const target of Object.values(state.combatants)) {
      if (target.classState.intimidatingPresenceSourceId !== actor.id) continue
      const remaining = Math.max(0, (target.classState.intimidatingPresenceRoundsRemaining ?? 0) - 1)
      target.classState.intimidatingPresenceRoundsRemaining = remaining || undefined
      if (remaining > 0) continue
      target.classState.intimidatingPresenceSourceId = undefined
      removeDnd5eConditionEffects(target, ['frightened', '惊惧', '恐慌'], 'expired', events)
      events.push({ type: 'condition-ended', targetId: target.id, condition: 'frightened' })
    }
  }

  if (action.type === 'end-turn') {
    triggerDnd5eDelayedSpellDamageAtTurnEnd(state, actor, events)
    advanceDnd5eActiveEffectsAtBoundary({ state, actor, point: 'end', events })
  }

  const wrapped = state.initiativeIndex + 1 >= state.initiativeOrder.length
  state.initiativeIndex = wrapped ? 0 : state.initiativeIndex + 1
  if (wrapped) state.round += 1
  const nextId = currentActorId(state)
  const next = nextId ? state.combatants[nextId] : undefined
  if (next) {
    if (
      action.type === 'end-turn' &&
      !resolveDnd5eMonsterTurnStartLifecycle({ state, actor: next, action, events })
    ) return fail(state, events, 'invalid-dice')
    advanceDnd5eActiveEffectsAtBoundary({ state, actor: next, point: 'start', events })
    if (!resolveDnd5eActiveEffectSaves({
      state,
      target: next,
      timing: 'target-turn-start',
      supplied: action.type === 'end-turn' ? action.turnStartActiveEffectSavingThrows : undefined,
      events,
    })) return fail(state, events, 'invalid-dice')
    if (next.classState.shieldSpellActive) {
      next.classState.shieldSpellActive = undefined
      events.push({ type: 'class-state-changed', actorId: next.id, stateKey: 'shield-spell', active: false })
    }
    next.turn = rules.createTurn(dnd5eEffectiveSpeed(next))
    next.dodging = false
    next.classState.dodgingTurnKey = undefined
    next.disengaged = false
    events.push({ type: 'turn-started', actorId: next.id, round: state.round })
    const heroism = reconciledDnd5eActiveEffects(next)
      .filter((effect) => effect.definitionId === 'srd-5.1:spell:heroism' && effect.source.actorId)
      .sort((left, right) => (right.potency ?? 0) - (left.potency ?? 0))[0]
    if (heroism?.source.actorId && !next.deathSaves.dead) {
      applyTemporaryHitPoints(next, Math.max(0, Math.floor(heroism.potency ?? 0)), events, {
        actorId: heroism.source.actorId,
        rulesId: 'heroism',
      })
    }
    const holyNimbusSource = next.holyNimbusSourceIds?.map((sourceId) => state.combatants[sourceId])
      .find((source) => source && source.currentHp > 0 && (source.classState.holyNimbusRoundsRemaining ?? 0) > 0)
    if (holyNimbusSource && next.currentHp > 0) {
      applyDamage(next, adjustDamageForTarget(next, 10, 'radiant'), false, events, holyNimbusSource, state, ['radiant'])
    }
    if (next.currentHp > 0) {
      for (const sourceId of next.draconicPresenceSourceIds ?? []) {
        const source = state.combatants[sourceId]
        const effectId = source?.classState.concentrationSpellId
        const mode = effectId?.endsWith(':fear') ? 'fear' : effectId?.endsWith(':awe') ? 'awe' : undefined
        const condition = mode === 'fear' ? 'frightened' : 'charmed'
        if (
          !source || !mode || !source.concentrating || source.currentHp <= 0 ||
          dnd5eConditionImmuneFromSource(next, condition, source)
        ) continue
        events.push({
          type: 'draconic-presence-save-required', targetId: next.id, sourceId: source.id, mode,
          dc: 8 + source.proficiencyBonus + rules.abilityModifier(source.abilities.cha),
        })
      }
    }
    if (
      dnd5eCombatantClassLevel(next, 'fighter') >= 18 && dnd5eCombatantHasSubclass(next, 'fighter', 'champion') &&
      next.currentHp > 0 && next.currentHp <= next.maxHp / 2
    ) {
      applyHealing(next, Math.max(0, 5 + rules.abilityModifier(next.abilities.con)), events)
    }
  }
  return { ok: true, state, events }
}

function endInvalidDnd5eGrapples(
  state: Dnd5eHeadlessCombatState,
  events: Dnd5eCombatEvent[],
): void {
  for (const target of Object.values(state.combatants)) {
    const grapples = reconciledDnd5eActiveEffects(target).filter((effect) =>
      effect.standardCondition === 'grappled' && effect.source.rulesId === 'basic-action:grapple',
    )
    for (const grapple of grapples) {
      const source = grapple.source.actorId ? state.combatants[grapple.source.actorId] : undefined
      const sourceIncapacitated = !source || source.currentHp <= 0 || source.deathSaves.dead || dnd5eIsIncapacitated(source)
      const outOfRange = !!source && dnd5eAttackDistanceFeet(state, source.id, target.id) > 5
      if (!sourceIncapacitated && !outOfRange) continue
      removeDnd5eEffectsByPredicate(
        target,
        (effect) => effect.id === grapple.id,
        sourceIncapacitated ? 'source-incapacitated' : 'out-of-range',
        events,
      )
    }
  }
}

const DND5E_MONSTER_MECHANIC_MAX_PENDING = 64
const DND5E_MONSTER_MECHANIC_MAX_CHAIN_DEPTH = 8

export function dnd5eMonsterMechanicSavingThrowKindForAction(
  action: Pick<Dnd5eAction, 'type'>,
): 'magic' | 'physical' {
  return [
    'cast-spell', 'adjudicated-spell', 'monster-spell', 'monster-core-spell',
    'hellish-rebuke', 'counterspell',
  ].includes(action.type) ? 'magic' : 'physical'
}

function enqueueDnd5eMonsterMechanicTriggerSnapshots(
  state: Dnd5eHeadlessCombatState,
  sourceState: Dnd5eHeadlessCombatState,
  action: Dnd5eAction,
  sourceEvents: readonly Dnd5eCombatEvent[],
  outputEvents: Dnd5eCombatEvent[],
): void {
  const parentDepth = action.type === 'resolve-monster-mechanic-trigger'
    ? sourceState.pendingMonsterMechanicTriggers?.[action.snapshotId]?.chainDepth ??
      sourceState.combatants[action.actorId]?.classState.pendingMonsterMechanicTriggers?.[action.snapshotId]?.chainDepth ??
      0
    : -1
  if (parentDepth >= DND5E_MONSTER_MECHANIC_MAX_CHAIN_DEPTH) return
  const candidates: Array<{
    event: Dnd5eMonsterMechanicTriggerEventV2
    subjectId: string
    triggerTargetId?: string
    damageSourceId?: string
    movementDistanceFeet?: number
    savingThrowKind?: 'magic' | 'physical'
  }> = []
  for (const event of sourceEvents) {
    if (event.type === 'attack-resolved') {
      candidates.push({
        event: event.hit ? 'after-hit' : 'after-miss',
        subjectId: event.actorId,
        triggerTargetId: event.targetId,
      })
      if (event.hit) {
        candidates.push({
          event: 'when-hit',
          subjectId: event.targetId,
          triggerTargetId: event.actorId,
        })
      }
    } else if (event.type === 'damage-applied' && event.amount > 0) {
      candidates.push({
        event: 'after-damaged',
        subjectId: event.targetId,
        damageSourceId: event.sourceId,
      })
    } else if (event.type === 'moved' && event.distance > 0) {
      candidates.push({
        event: 'movement',
        subjectId: event.actorId,
        movementDistanceFeet: event.distance,
      })
    } else if (event.type === 'saving-throw-resolved') {
      const savingThrowKind = dnd5eMonsterMechanicSavingThrowKindForAction(action)
      candidates.push({
        event: savingThrowKind === 'magic' ? 'saving-throw-magic' : 'saving-throw-physical',
        subjectId: event.targetId,
        savingThrowKind,
      })
    }
  }
  if (candidates.length === 0) return

  const pending = Object.assign(
    {},
    ...Object.values(state.combatants).map((combatant) => combatant.classState.pendingMonsterMechanicTriggers ?? {}),
    state.pendingMonsterMechanicTriggers ?? {},
  ) as Record<string, Dnd5eMonsterMechanicTriggerSnapshot>
  let sequence = Math.max(0, Math.floor(state.monsterMechanicTriggerSequence ?? 0))
  for (const candidate of candidates) {
    const subject = state.combatants[candidate.subjectId]
    if (!subject) continue
    const owners = Object.values(state.combatants)
      .filter((owner) => owner.statBlockId && owner.currentHp > 0 && !owner.deathSaves.dead)
      .sort((left, right) => left.id.localeCompare(right.id))
    for (const owner of owners) {
      const monster = getDnd5eSrdMonster(owner.statBlockId!)
      if (!monster) continue
      const mechanics = dnd5eEligibleMonsterMechanics(monster, candidate.event, {
        combatId: state.combatId,
        round: state.round,
        actorId: owner.id,
        currentHp: owner.currentHp,
        maxHp: owner.maxHp,
        usedKeys: owner.classState.declarativeUsedTurnKeys,
        movementDistanceFeet: candidate.movementDistanceFeet,
      })
      for (const mechanic of [...mechanics].sort((left, right) => left.id.localeCompare(right.id))) {
        if (
          mechanic.limit !== 'unlimited' &&
          Object.values(pending).some((snapshot) =>
            snapshot.mechanicOwnerId === owner.id && snapshot.mechanicId === mechanic.id,
          )
        ) continue
        const configuredSubject = mechanic.schemaVersion === 2 ? mechanic.trigger.subject ?? 'self' : 'self'
        const subjectMatches = configuredSubject === 'self'
          ? owner.id === subject.id
          : configuredSubject === 'ally-within'
            ? owner.id !== subject.id && owner.controller === subject.controller
            : owner.controller !== subject.controller
        if (!subjectMatches) continue
        if (configuredSubject !== 'self') {
          const radiusFeet = mechanic.schemaVersion === 2 ? mechanic.trigger.radiusFeet ?? 0 : 0
          if (dnd5eAttackDistanceFeet(state, owner.id, subject.id) > radiusFeet) continue
        }
        if (
          mechanic.schemaVersion === 2 &&
          (candidate.event === 'saving-throw-magic' || candidate.event === 'saving-throw-physical') &&
          mechanic.effects.every((effect) =>
            effect.kind === 'roll-modifier' &&
            effect.roll === 'saving-throw' &&
            (effect.target === 'selected-subject' || (effect.target === 'self' && owner.id === subject.id)),
          )
        ) continue
        if (Object.keys(pending).length >= DND5E_MONSTER_MECHANIC_MAX_PENDING) return
        sequence += 1
        const ownerSequence = Math.max(0, Math.floor(owner.classState.monsterMechanicTriggerSequence ?? 0)) + 1
        owner.classState.monsterMechanicTriggerSequence = ownerSequence
        const id = `${state.combatId}:${state.round}:${ownerSequence}:${owner.id}:${mechanic.id}`
        const snapshot: Dnd5eMonsterMechanicTriggerSnapshot = {
          id,
          mechanicOwnerId: owner.id,
          mechanicId: mechanic.id,
          event: candidate.event,
          subjectId: subject.id,
          triggerTargetId: candidate.triggerTargetId,
          damageSourceId: candidate.damageSourceId,
          movementDistanceFeet: candidate.movementDistanceFeet,
          savingThrowKind: candidate.savingThrowKind,
          createdRound: state.round,
          chainDepth: parentDepth + 1,
        }
        pending[id] = snapshot
        owner.classState.pendingMonsterMechanicTriggers = {
          ...(owner.classState.pendingMonsterMechanicTriggers ?? {}),
          [id]: snapshot,
        }
        outputEvents.push({ type: 'monster-mechanic-trigger-pending', snapshot })
      }
    }
  }
  state.pendingMonsterMechanicTriggers = pending
  state.monsterMechanicTriggerSequence = sequence
}

/**
 * 所有 Headless 行动的统一状态后置条件。2014 规则规定失能会立即结束专注；
 * 该检查位于事务边界，因此法术、职业、怪物、DM 与插件状态写入都无法绕过。
 */
export function resolveDnd5eHeadlessAction(
  source: Dnd5eHeadlessCombatState,
  action: Dnd5eAction,
  transactionOptions: Dnd5eHeadlessTransactionOptions = {},
): Dnd5eActionResult {
  const isRootResolution = headlessResolutionDepth === 0
  const transaction = isRootResolution
    ? beginDnd5eHeadlessActionTransaction(source, action, transactionOptions)
    : undefined
  headlessResolutionDepth += 1
  let finalResult: Dnd5eActionResult
  try {
    let result = resolveDnd5eHeadlessActionInternal(source, action)
    if (result.ok) {
      let triggeredState = result.state
      const triggeredEvents = [...result.events]
      for (const [eventIndex, event] of result.events.entries()) {
        for (const triggeredAction of dnd5eDeclarativeTriggeredActions(triggeredState, event, eventIndex)) {
          const triggered = resolveDnd5eHeadlessActionInternal(triggeredState, triggeredAction, { skipTurnStartBoundary: true })
          if (!triggered.ok) {
            triggeredEvents.push({
              type: 'declarative-subclass-trigger-rejected',
              actorId: triggeredAction.actorId,
              abilityId: triggeredAction.featureId ?? triggeredAction.actionId,
              trigger: 'after-attack-hit',
              targetIds: triggeredAction.targetIds ?? (triggeredAction.targetId ? [triggeredAction.targetId] : []),
              reason: triggered.reason,
            })
            continue
          }
          triggeredState = triggered.state
          triggeredEvents.push(...triggered.events)
        }
      }
      result = { ...result, state: triggeredState, events: triggeredEvents }
      const mechanicEvents = [...result.events]
      enqueueDnd5eMonsterMechanicTriggerSnapshots(
        result.state,
        source,
        action,
        [...result.events],
        mechanicEvents,
      )
      result = { ...result, events: mechanicEvents }
    }
    if (!result.ok) finalResult = result
    else {
      const events = [...result.events]
      for (const combatant of Object.values(result.state.combatants)) {
        if ((combatant.concentrating || combatant.classState.concentrationSpellId) && dnd5eIsIncapacitated(combatant)) {
          endDnd5eConcentration(result.state, combatant, events)
        }
      }
      endInvalidDnd5eGrapples(result.state, events)
      finalResult = { ...result, events }
    }
  } finally {
    headlessResolutionDepth -= 1
  }
  if (transaction) {
    finalResult = {
      ...finalResult!,
      transaction: settleDnd5eHeadlessActionTransaction(transaction, finalResult!, transactionOptions.now),
    }
  }
  if (isRootResolution && headlessResolutionObserver) {
    try {
      headlessResolutionObserver({ source, action, result: finalResult! })
    } catch {
      // Telemetry is observational and must never alter authoritative settlement.
    }
  }
  return finalResult!
}
