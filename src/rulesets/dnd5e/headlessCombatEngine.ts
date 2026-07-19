import { SKILLS, type AbilityKey } from '../../lib/dnd'
import type { Dnd5eSpellMetamagicPayload } from '../../lib/sharedCombatTypes'
import type { AttackResolution, D20RollMode, SavingThrowResolution, TurnEconomy, TurnResource } from '../contracts'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { DND5E_TOTAL_COVER_ARMOR_CLASS, resolveDnd5eAttackOutcome } from './attackResolution'
import {
  dnd5ePluginFeatureDefinition,
  dnd5ePluginHeadlessActionDefinition,
  dnd5ePluginResourceDefinition,
  type Dnd5ePluginAction,
} from './pluginApi'
import type { Dnd5eSandboxCapabilityOperation } from './pluginSandbox'
import type { Dnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { validateDnd5ePluginDiceRolls } from './pluginDice'
import {
  getDnd5eSrdMonster,
  type Dnd5eDamageType,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterWeaponAttack,
} from './monsters'
import { dnd5eBardicInspirationDie, dnd5eClassDefinition, dnd5eMonkMartialArtsDie, dnd5ePactSlotLevel, dnd5eRogueSneakAttackDice, type Dnd5eClassId } from './classes'
import { dnd5eCanEmpowerSpell, dnd5eCanOverchannelSpell, dnd5eCanSculptSpell, dnd5eCarefulSpellMaximumTargets, dnd5eDraconicElementalResistanceType, dnd5eFreeSpellCastSource, dnd5eHeightenedSavingThrowMode, dnd5eMetamagicAvailableForSpell, dnd5eMetamagicCost, dnd5eSculptSpellMaximumTargets, dnd5eSpellAllowsRepeatedTargets, dnd5eSpellConcentrationDurationRounds, dnd5eSpellDiceCount, dnd5eSpellMaximumTargets, dnd5eSpellProjectileCount, dnd5eSpellUsesSequencedAttacks, getDnd5eSrdCombatSpell } from './spells'
import {
  dnd5eCanUseUncannyDodge,
  dnd5eAttackerIsUnseen,
  dnd5eConditionImmuneFromSource,
  dnd5eDamageAfterSavingThrow,
  dnd5eHasViciousMockeryAttackDisadvantage,
  dnd5eIsIncapacitated,
  dnd5ePreventsAttackAdvantage,
  dnd5eReactionsPrevented,
  dnd5eSavingThrowMode,
  dnd5eTargetGrantsAttackAdvantage,
  dnd5eUnseenTargetImposesDisadvantage,
} from './passiveDefenses'
import {
  DND5E_WILD_SHAPE_KNOWN_FORMS_KEY,
  dnd5eWildShapeDurationHours,
  dnd5eWildShapeFormAllowedForLevel,
} from './wildShape'
import {
  dnd5eConditionSetsSpeedToZero,
  dnd5eConditionSavingThrowAutomaticallyFails,
  dnd5eStandardConditionId,
  dnd5eHasStandardCondition,
  dnd5eConditionAbilityCheckDisadvantage,
  dnd5eConditionHitIsAutomaticCritical,
  type Dnd5eStandardConditionId,
} from './conditions'
import {
  applyDnd5eActiveEffect,
  createDnd5eMechanicalEffect,
  createDnd5eConditionEffect,
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eActiveEffectId,
  dnd5eActiveSpeedPenalty,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
  removeDnd5eActiveEffectsForEvent,
  type Dnd5eActiveEffectBreakTrigger,
  type Dnd5eActiveEffectDuration,
  type Dnd5eActiveEffectInstance,
  type Dnd5eActiveEffectSavingThrowRoll,
} from './activeEffects'

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
  armorClass: number
  currentHp: number
  maxHp: number
  temporaryHp: number
  exhaustionLevel: number
  speed: number
  position: { x: number; y: number }
  turn: TurnEconomy
  dodging: boolean
  disengaged: boolean
  concentrating: boolean
  classResources: Record<string, { current: number; max: number }>
  classId?: Dnd5eClassId
  subclassId?: string
  classSelections: Record<string, string[]>
  pluginFeatureIds: readonly string[]
  wearingArmor: boolean
  wearingHeavyArmor: boolean
  wearingMetalArmor: boolean
  hasShield: boolean
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
      condition: Dnd5eStandardConditionId
    }
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
    hiddenCheckTotal?: number
    hideInPlainSightPrepared?: boolean
    bonusActionSpellTurnKey?: string
    leveledSpellTurnKey?: string
    /** The concentration spell currently maintained by this combatant. */
    concentrationSpellId?: string
    /** Combatants currently affected by the maintained concentration spell. */
    concentrationTargetIds?: string[]
    /** Remaining duration in combat rounds for the maintained concentration spell. */
    concentrationRoundsRemaining?: number
    /** Concentration effects applied to this combatant, keyed by caster combatant id. */
    concentrationEffectsBySource?: Record<string, string>
    viciousMockeryAttackDisadvantage?: boolean
    shieldSpellActive?: boolean
    legendaryResistanceUses?: number
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

export interface Dnd5eHeadlessCombatState {
  rulesetId: typeof rules.id
  combatId: string
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
  /** Optional map-scheduler slot identity for creatures with multiple turns. */
  turnSlotId?: string
  combatants: Record<string, Dnd5eCombatant>
}

export function dnd5eCombatantPairKey(leftId: string, rightId: string): string {
  return leftId < rightId ? `${leftId}\u0000${rightId}` : `${rightId}\u0000${leftId}`
}

export function dnd5eDirectedCombatantPairKey(actorId: string, targetId: string): string {
  return `${actorId}\u0000${targetId}`
}

function dnd5eAttackDistanceFeet(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
  targetId: string,
  fallback?: number,
): number {
  const snapshotDistance = state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actorId, targetId)]
  if (Number.isFinite(snapshotDistance) && snapshotDistance! >= 0) return snapshotDistance!
  return Number.isFinite(fallback) && fallback! >= 0 ? fallback! : Number.POSITIVE_INFINITY
}

function dnd5eHitIsAutomaticCritical(
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

export type Dnd5eClassDamageSource =
  | 'sneak-attack'
  | 'colossus-slayer'
  | 'brutal-critical'
  | 'improved-divine-smite'
  | 'divine-smite'
  | 'hunters-mark'
  | 'divine-strike'
  | 'lifedrinker'
  | 'foe-slayer'

export interface Dnd5eClassDamageDefinition {
  source: Dnd5eClassDamageSource
  count: number
  sides: number
  type: Dnd5eDamageType
  doubleOnCritical: boolean
  bonus?: number
}

export interface Dnd5eWeaponClassDamageContext {
  mode: 'melee' | 'ranged'
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
  addCondition?: string
  removeCondition?: string
}

export interface Dnd5eTargetTranquilitySaveRoll {
  targetId: string
  save: Dnd5eTranquilitySaveRoll
}

export type Dnd5eAction =
  | { type: 'attack'; actorId: string; targetId: string; attackModifier: number; criticalThreshold?: number; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; strokeOfLuck?: boolean; cuttingWords?: Dnd5eCuttingWordsUse; cuttingWordsDamage?: Dnd5eCuttingWordsUse; mode?: D20RollMode; spendAction?: boolean; spendBonusAction?: boolean; protectionReactionActorId?: string; shieldSpellReaction?: boolean; uncannyDodge?: boolean; deflectMissilesD10?: number; tranquilitySave?: Dnd5eTranquilitySaveRoll; stunningStrikeSaveD20?: number; stunningStrikeSaveD20Second?: number; stunningStrikeSaveBlessRoll?: number; stunningStrikeSaveBaneRoll?: number; stunningStrikeSaveRerollD20?: number; stunningStrikeSaveRerollD20Second?: number; stunningStrikeBardicInspirationRoll?: number; stunningStrikeDarkOnesOwnLuckRoll?: number; hurlThroughHellDamageRolls?: readonly number[]; standAgainstTide?: Dnd5eStandAgainstTideUse; damage: { count: number; sides: number; bonus: number; rolls: readonly number[]; type?: Dnd5eDamageType }; classDamageContext?: Dnd5eWeaponClassDamageContext; classDamageRolls?: readonly Dnd5eClassDamageRolls[] }
  | { type: 'monster-action'; actorId: string; actionId: string; rolls: readonly Dnd5eMonsterActionRoll[] }
  | { type: 'monster-undead-fortitude-save'; actorId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number }
  | { type: 'monster-on-hit-save'; actorId: string; sourceId: string; actionId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; rerollD20?: number; rerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number }
  | { type: 'ranger-hunter-multiattack'; actorId: string; feature: 'volley' | 'whirlwind-attack'; weaponMode: 'melee' | 'ranged'; attackModifier: number; criticalThreshold?: number; damage: { count: number; sides: number; bonus: number; type?: Dnd5eDamageType }; attacks: readonly Dnd5eHunterMultiattackRoll[] }
  | { type: 'move'; actorId: string; to: { x: number; y: number }; distance: number; movementCost?: number; standFromProne?: boolean; carefulMovement?: boolean }
  | { type: 'item-area-trigger'; actorId: string; areaId: string; areaKind: 'ball-bearings' | 'caltrops' | 'hunting-trap'; d20: number; d20Second?: number; damageRolls?: readonly number[] }
  | { type: 'dash'; actorId: string }
  | { type: 'disengage'; actorId: string }
  | { type: 'dodge'; actorId: string }
  | { type: 'ability-check'; actorId: string; ability: AbilityKey; skill?: string; d20: number; d20Second?: number; mode?: D20RollMode; dc?: number; spendAction?: boolean; bardicInspirationRoll?: number; peerlessSkillRoll?: number; darkOnesOwnLuckRoll?: number; cuttingWords?: Dnd5eCuttingWordsUse; strokeOfLuck?: boolean }
  | { type: 'death-save'; actorId: string; d20: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number }
  | { type: 'concentration-save'; actorId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; rerollD20?: number; rerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; dc: number }
  | { type: 'barbarian-relentless-rage-save'; actorId: string; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; dc: number }
  | { type: 'fighter-second-wind'; actorId: string; resourceKey: string; d10: number }
  | { type: 'fighter-action-surge'; actorId: string; resourceKey: string; alreadyUsedThisTurn: boolean }
  | { type: 'class-resource-use'; actorId: string; resourceKey: string; amount?: number; turnResource?: 'action' | 'bonusAction' | 'reaction' }
  | { type: 'barbarian-rage'; actorId: string; frenzy?: boolean; end?: boolean }
  | { type: 'barbarian-intimidating-presence'; actorId: string; targetId: string; savingThrowD20?: number; savingThrowD20Second?: number; savingThrowBlessRoll?: number; savingThrowBaneRoll?: number; savingThrowRerollD20?: number; savingThrowRerollD20Second?: number; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number }
  | { type: 'rogue-cunning-action'; actorId: string; option: 'dash' | 'disengage' | 'hide'; hideAllowed?: boolean; d20?: number; d20Second?: number }
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
  | { type: 'cast-spell'; actorId: string; targetId: string; targetIds?: readonly string[]; projectileTargetIds?: readonly string[]; sculptedTargetIds?: readonly string[]; forcedMovements?: readonly Dnd5eSpellForcedMovement[]; metamagic?: Dnd5eSpellMetamagicPayload; empowered?: boolean; empoweredRerolls?: readonly Dnd5eEmpoweredSpellReroll[]; draconicResistance?: boolean; repellingBlast?: boolean; counterspellReaction?: Dnd5eCounterspellReaction; shieldSpellReaction?: boolean; shieldSpellReactionTargetIds?: readonly string[]; legendaryResistanceTargetIds?: readonly string[]; spellId: string; slotLevel: number; d20?: number; d20Second?: number; attackBlessRoll?: number; attackBaneRoll?: number; cuttingWords?: Dnd5eCuttingWordsUse; cuttingWordsDamage?: Dnd5eCuttingWordsUse; standAgainstTide?: Dnd5eStandAgainstTideUse; mode?: D20RollMode; targetAttacks?: readonly Dnd5eSpellTargetAttackRoll[]; protectionReactionActorId?: string; tranquilitySave?: Dnd5eTranquilitySaveRoll; targetTranquilitySaves?: readonly Dnd5eTargetTranquilitySaveRoll[]; savingThrowD20?: number; savingThrowD20Second?: number; savingThrowBlessRoll?: number; savingThrowBaneRoll?: number; savingThrowRerollD20?: number; savingThrowRerollD20Second?: number; targetSavingThrows?: readonly Dnd5eSpellTargetSavingThrowRoll[]; bardicInspirationRoll?: number; darkOnesOwnLuckRoll?: number; hurlThroughHellDamageRolls?: readonly number[]; overchannel?: boolean; overchannelSelfDamageRolls?: readonly number[]; uncannyDodge?: boolean; effectRolls: readonly number[] }
  | { type: 'adjudicated-spell'; actorId: string; spellId: string; spellName: string; spellLevel: number; slotLevel: number; castingTime: 'action' | 'bonus-action'; effects: readonly Dnd5eAdjudicatedSpellEffect[]; concentrationRounds?: number }
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
  | { type: 'end-turn'; actorId: string; activeEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]; turnStartActiveEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[] }
  | { type: 'opportunity-attack'; actorId: string; targetId: string; attackModifier: number; d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; strokeOfLuck?: boolean; cuttingWords?: Dnd5eCuttingWordsUse; cuttingWordsDamage?: Dnd5eCuttingWordsUse; shieldSpellReaction?: boolean; uncannyDodge?: boolean; standAgainstTide?: Dnd5eStandAgainstTideUse; mode?: D20RollMode; reactionFeature?: 'berserker-retaliation' | 'hunter-giant-killer'; tranquilitySave?: Dnd5eTranquilitySaveRoll; hurlThroughHellDamageRolls?: readonly number[]; damage: { count: number; sides: number; bonus: number; rolls: readonly number[]; type?: Dnd5eDamageType } }

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
  standAgainstTide?: Dnd5eStandAgainstTideUse
}

export type Dnd5eCombatEvent =
  | { type: 'turn-started'; actorId: string; round: number }
  | { type: 'turn-resource-spent'; actorId: string; resource: TurnResource; amount?: number }
  | { type: 'moved'; actorId: string; from: { x: number; y: number }; to: { x: number; y: number }; distance: number }
  | { type: 'item-area-triggered'; actorId: string; areaId: string; areaKind: 'ball-bearings' | 'caltrops' | 'hunting-trap'; success: boolean }
  | { type: 'persistent-area-triggered'; actorId: string; targetId: string; areaId: string; triggerId: string; timing: Dnd5ePersistentAreaTriggerSnapshot['timing']; saveSuccess?: boolean; damage: number; conditionApplied?: Dnd5eStandardConditionId }
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
  | { type: 'monster-on-hit-save-required'; targetId: string; sourceId: string; actionId: string; ability: AbilityKey; dc: number; condition: Dnd5eStandardConditionId }
  | { type: 'exhaustion-gained'; actorId: string; level: number }
  | { type: 'saving-throw-resolved'; targetId: string; ability: AbilityKey; d20: number; modifier: number; total: number; dc: number; success: boolean }
  | { type: 'legendary-resistance-used'; targetId: string; remainingUses: number }
  | { type: 'condition-applied'; actorId: string; targetId: string; condition: string }
  | { type: 'condition-ended'; targetId: string; condition: string }
  | { type: 'active-effect-applied'; targetId: string; effectId: string; definitionId: string }
  | { type: 'active-effect-refreshed'; targetId: string; effectId: string; definitionId: string }
  | { type: 'active-effect-removed'; targetId: string; effectId: string; definitionId: string; reason: 'expired' | 'save-succeeded' | 'concentration-ended' | Dnd5eActiveEffectBreakTrigger | 'dm' | 'healed' | 'death' }
  | { type: 'active-effect-save-required'; targetId: string; effectId: string; ability: AbilityKey; dc: number; timing: 'target-turn-start' | 'target-turn-end' }
  | { type: 'active-effect-save-resolved'; targetId: string; effectId: string; ability: AbilityKey; dc: number; total: number; success: boolean }
  | { type: 'spell-cast'; actorId: string; targetId: string; spellId: string; slotLevel: number }
  | { type: 'counterspell-resolved'; actorId: string; casterId: string; spellId: string; spellLevel: number; slotLevel: number; dc?: number; abilityCheckTotal?: number; success: boolean }
  | { type: 'adjudicated-spell-resolved'; actorId: string; spellId: string; spellName: string; slotLevel: number; effectCount: number }
  | { type: 'spell-sculpted'; actorId: string; targetId: string; spellId: string }
  | { type: 'metamagic-applied'; actorId: string; spellId: string; kind: string; targetId?: string }
  | { type: 'damage-resistance-gained'; actorId: string; damageType: Dnd5eDamageType; source: 'draconic-elemental-affinity'; rounds: number }
  | { type: 'action-surge-granted'; actorId: string }
  | { type: 'damage-applied'; sourceId?: string; targetId: string; amount: number; hpBefore: number; hpAfter: number; temporaryHpBefore: number; temporaryHpAfter: number }
  | { type: 'hit-points-reduced-to-zero'; sourceId: string; targetId: string; hpBefore: number }
  | { type: 'instant-death'; sourceId: string; targetId: string; hpBefore: number }
  | { type: 'hostile-targeting-prevented'; actorId: string; targetId: string; source: 'tranquility' | 'nature-sanctuary' }
  | { type: 'ability-check-resolved'; actorId: string; ability: AbilityKey; skill?: string; d20: number; modifier: number; total: number; mode: D20RollMode; reliableTalentApplied: boolean; indomitableMightApplied?: boolean; bardicInspirationApplied?: number; peerlessSkillApplied?: number; darkOnesOwnLuckApplied?: number; cuttingWordsApplied?: number; strokeOfLuckApplied?: boolean; dc?: number; success?: boolean }
  | { type: 'object-action-taken'; actorId: string; action: 'use-object' }
  | { type: 'concentration-check-required'; targetId: string; dc: number }
  | { type: 'relentless-rage-save-required'; targetId: string; dc: number }
  | { type: 'relentless-rage-resolved'; actorId: string; d20: number; total: number; dc: number; success: boolean }
  | { type: 'death-save-failure'; targetId: string; failures: number }
  | { type: 'death-save-resolved'; actorId: string; d20: number; successes: number; failures: number; stable: boolean; dead: boolean; currentHp: number }
  | { type: 'concentration-resolved'; actorId: string; d20: number; total: number; dc: number; success: boolean }
  | { type: 'combat-ended' }

export type Dnd5eActionFailure =
  | 'combat-ended'
  | 'stale-turn'
  | 'invalid-actor'
  | 'invalid-target'
  | 'action-unavailable'
  | 'reaction-unavailable'
  | 'bonus-action-unavailable'
  | 'class-resource-unavailable'
  | 'invalid-class-feature'
  | 'feature-already-used'
  | 'invalid-plugin-action'
  | 'invalid-monster-action'
  | 'insufficient-movement'
  | 'invalid-dice'

export type Dnd5eActionResult =
  | { ok: true; state: Dnd5eHeadlessCombatState; events: readonly Dnd5eCombatEvent[] }
  | { ok: false; state: Dnd5eHeadlessCombatState; events: readonly Dnd5eCombatEvent[]; reason: Dnd5eActionFailure }

function clone(state: Dnd5eHeadlessCombatState): Dnd5eHeadlessCombatState {
  return {
    ...state,
    initiativeOrder: [...state.initiativeOrder],
    distanceFeetByCombatantPair: state.distanceFeetByCombatantPair
      ? { ...state.distanceFeetByCombatantPair }
      : undefined,
    coverBonusByCombatantPair: state.coverBonusByCombatantPair ? { ...state.coverBonusByCombatantPair } : undefined,
    lineOfEffectBlockedByCombatantPair: state.lineOfEffectBlockedByCombatantPair
      ? { ...state.lineOfEffectBlockedByCombatantPair }
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
      pluginFeatureIds: [...combatant.pluginFeatureIds],
      countercharmSourceIds: combatant.countercharmSourceIds ? [...combatant.countercharmSourceIds] : undefined,
      holyNimbusSourceIds: combatant.holyNimbusSourceIds ? [...combatant.holyNimbusSourceIds] : undefined,
      draconicPresenceSourceIds: combatant.draconicPresenceSourceIds ? [...combatant.draconicPresenceSourceIds] : undefined,
      classState: {
        ...combatant.classState,
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
      },
      position: { ...combatant.position },
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
  input: Omit<Dnd5eCombatant, 'turn' | 'dodging' | 'disengaged' | 'deathSaves' | 'level' | 'exhaustionLevel' | 'baseSavingThrowBonuses' | 'savingThrowBonuses' | 'savingThrowProficiencies' | 'skillProficiencies' | 'passivePerception' | 'classResources' | 'classSelections' | 'pluginFeatureIds' | 'classState' | 'wearingArmor' | 'wearingHeavyArmor' | 'wearingMetalArmor' | 'hasShield' | 'damageVulnerabilities' | 'damageResistances' | 'damageImmunities' | 'conditionImmunities' | 'conditions'> &
    Partial<Pick<Dnd5eCombatant, 'level' | 'exhaustionLevel' | 'baseSavingThrowBonuses' | 'savingThrowBonuses' | 'savingThrowProficiencies' | 'skillProficiencies' | 'passivePerception' | 'classResources' | 'classSelections' | 'pluginFeatureIds' | 'classState' | 'wearingArmor' | 'wearingHeavyArmor' | 'wearingMetalArmor' | 'hasShield' | 'damageVulnerabilities' | 'damageResistances' | 'damageImmunities' | 'conditionImmunities' | 'conditions' | 'usesDeathSaves'>>,
): Dnd5eCombatant {
  const baseSavingThrowBonuses = { ...(input.baseSavingThrowBonuses ?? input.savingThrowBonuses) }
  const activeEffects = normalizeDnd5eActiveEffects(input.classState?.activeEffects)
  const nativeClassState = input.classState ?? {}
  const usesDeathSaves = input.usesDeathSaves ?? (input.classId != null || input.controller === 'player')
  return {
    ...input,
    level: Math.min(20, Math.max(1, Math.floor(input.level ?? 1))),
    exhaustionLevel: Math.min(6, Math.max(0, Math.floor(input.exhaustionLevel ?? 0))),
    baseSavingThrowBonuses,
    savingThrowBonuses: { ...baseSavingThrowBonuses, ...input.savingThrowBonuses },
    savingThrowProficiencies: [...input.savingThrowProficiencies ?? []],
    skillProficiencies: [...input.skillProficiencies ?? []],
    passivePerception: Math.max(0, Math.floor(input.passivePerception ?? 10)),
    classResources: Object.fromEntries(Object.entries(input.classResources ?? {}).map(([key, resource]) => [key, { ...resource }])),
    classSelections: Object.fromEntries(Object.entries(input.classSelections ?? {}).map(([key, values]) => [key, [...values]])),
    pluginFeatureIds: [...new Set(input.pluginFeatureIds ?? [])],
    classState: {
      ...nativeClassState,
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
    },
    wearingArmor: input.wearingArmor ?? false,
    wearingHeavyArmor: input.wearingHeavyArmor ?? false,
    wearingMetalArmor: input.wearingMetalArmor ?? false,
    hasShield: input.hasShield ?? false,
    turn: rules.createTurn(dnd5eConditionSetsSpeedToZero({ conditions: dnd5eConditionsFromActiveEffects(activeEffects) })
      ? 0
      : Math.max(0, input.speed - dnd5eActiveSpeedPenalty(activeEffects))),
    dodging: false,
    disengaged: false,
    deathSaves: {
      successes: 0,
      failures: input.currentHp === 0 && !usesDeathSaves && !nativeClassState.undeadFortitudePending ? 3 : 0,
      stable: false,
      dead: input.currentHp === 0 && !usesDeathSaves && !nativeClassState.undeadFortitudePending,
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
      Math.max(0, combatant.classState.caltropsSpeedPenaltyFeet ?? 0),
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
    breakOn?: Dnd5eActiveEffectInstance['breakOn']
    sourceKind?: Dnd5eActiveEffectInstance['source']['kind']
    pluginId?: string
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
    },
    targetId: target.id,
    duration: input.duration,
    repeatSave: input.repeatSave,
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
    label: string
    duration: Dnd5eActiveEffectDuration
    appliedTurnKey?: string
    speedPenaltyFeet?: number
    preventReactions?: boolean
  },
  events: Dnd5eCombatEvent[],
): void {
  const incoming = createDnd5eMechanicalEffect({
    id: dnd5eActiveEffectId(input.definitionId, source.id, target.id),
    definitionId: input.definitionId,
    label: input.label,
    source: { kind: 'spell', actorId: source.id, actorName: source.name, rulesId: input.definitionId },
    targetId: target.id,
    duration: input.duration,
    appliedTurnKey: input.appliedTurnKey,
    modifiers: {
      speedPenaltyFeet: input.speedPenaltyFeet,
      preventReactions: input.preventReactions,
    },
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
  expiresAt: 'source-next-turn-start' | 'target-next-turn-start' | 'target-turn-end' | 'target-turn-end-save'
  remainingRounds?: number
}): Dnd5eActiveEffectDuration {
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
    }, events)
  }
  const incoming = createDnd5eMechanicalEffect({
    id: dnd5eActiveEffectId(`rules:${input.rulesId}`, source?.id ?? 'system', target.id, input.condition),
    definitionId: `rules:${input.rulesId}:${input.condition}`,
    label: input.condition,
    kind: 'custom',
    source: {
      kind: input.sourceKind ?? 'feature', actorId: source?.id,
      actorName: source?.name, rulesId: input.rulesId,
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
}

function emitDnd5eAttackResolved(
  state: Dnd5eHeadlessCombatState,
  event: Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>,
  events: Dnd5eCombatEvent[],
): void {
  events.push(event)
  const attacker = state.combatants[event.actorId]
  const target = state.combatants[event.targetId]
  if (attacker) triggerDnd5eActiveEffectBreak(attacker, 'makes-attack', events)
  if (target) {
    triggerDnd5eActiveEffectBreak(target, 'targeted-by-attack', events)
    if (event.hit) triggerDnd5eActiveEffectBreak(target, 'hit-by-attack', events)
  }
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
        !(effect.repeatSave && effect.repeatSave.timing === targetBoundary)
      ) {
        const remainingRounds = Math.max(0, effect.duration.remainingRounds - 1)
        if (remainingRounds === 0) {
          removed.push(effect)
          continue
        }
        next.push({ ...effect, duration: { ...effect.duration, remainingRounds } })
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
        removeDnd5eEffectsByPredicate(input.target, (current) => current.id === effect.id, 'save-succeeded', input.events)
        continue
      }
      if (effect.duration.type !== 'rounds') continue
      const remainingRounds = Math.max(0, effect.duration.remainingRounds - 1)
      if (remainingRounds === 0) {
        removeDnd5eEffectsByPredicate(input.target, (current) => current.id === effect.id, 'expired', input.events)
      } else {
        const current = reconciledDnd5eActiveEffects(input.target)
        commitDnd5eActiveEffects(input.target, current.map((entry) => entry.id === effect.id && entry.duration.type === 'rounds'
          ? { ...entry, duration: { ...entry.duration, remainingRounds } }
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
  return mode === 'advantage' ? 'normal' : 'disadvantage'
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
    !rangedWeaponAttack || target.classId !== 'monk' || target.level < 3 || target.currentHp <= 0 ||
    !target.turn.reactionAvailable || dnd5eIsIncapacitated(target) || dnd5eReactionsPrevented(target) ||
    !Number.isInteger(d10) || d10 < 1 || d10 > 10 || !spendReaction(target, events)
  ) return undefined
  const modifier = rules.abilityModifier(target.abilities.dex) + target.level
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
    !bard || bard.id === affectedCreature.id || bard.classId !== 'bard' || bard.subclassId !== 'lore' || bard.level < 3 ||
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
  combatant: Pick<Dnd5eCombatant, 'classId' | 'classSelections' | 'classResources' | 'classState' | 'currentHp' | 'turn' | 'conditions' | 'level' | 'exhaustionLevel' | 'subclassId'>,
): { level: number; resourceKey?: string } | undefined {
  const selectedNormally = combatant.classId === 'sorcerer'
    ? combatant.classSelections['spell-known']?.includes('shield')
    : combatant.classSelections['spell-prepared']?.includes('shield')
  const selectedBySpellMastery = combatant.classId === 'wizard' &&
    combatant.classSelections['spell-mastery-1']?.includes('shield')
  if (
    combatant.currentHp <= 0 || combatant.classState.shieldSpellActive ||
    (combatant.classId !== 'sorcerer' && combatant.classId !== 'wizard') ||
    (!selectedNormally && !selectedBySpellMastery) ||
    !combatant.turn.reactionAvailable || dnd5eIsIncapacitated(combatant) || dnd5eReactionsPrevented(combatant)
  ) return undefined
  const spell = getDnd5eSrdCombatSpell('shield')
  if (spell && dnd5eFreeSpellCastSource(combatant, spell, 1)?.kind === 'spell-mastery') {
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
  combatant: Pick<Dnd5eCombatant, 'classId' | 'classSelections' | 'classResources' | 'currentHp' | 'turn' | 'conditions' | 'level' | 'exhaustionLevel' | 'subclassId' | 'classState'>,
  requestedSlotLevel: number,
): { level: number; resourceKey: string } | undefined {
  if (!Number.isInteger(requestedSlotLevel) || requestedSlotLevel < 3 || requestedSlotLevel > 9) return undefined
  const selected = combatant.classId === 'sorcerer' || combatant.classId === 'warlock'
    ? combatant.classSelections['spell-known']?.includes('counterspell')
    : combatant.classId === 'wizard'
      ? combatant.classSelections['spell-prepared']?.includes('counterspell')
      : false
  if (
    !selected || combatant.currentHp <= 0 || !combatant.turn.reactionAvailable ||
    dnd5eIsIncapacitated(combatant) || dnd5eReactionsPrevented(combatant)
  ) return undefined
  if (combatant.classId === 'warlock') {
    const pactLevel = dnd5ePactSlotLevel(combatant.level)
    const resource = combatant.classResources['dnd5e-pact-slot']
    return requestedSlotLevel === pactLevel && (resource?.current ?? 0) > 0
      ? { level: pactLevel, resourceKey: 'dnd5e-pact-slot' }
      : undefined
  }
  const resourceKey = `dnd5e-spell-slot-${requestedSlotLevel}`
  return (combatant.classResources[resourceKey]?.current ?? 0) > 0
    ? { level: requestedSlotLevel, resourceKey }
    : undefined
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
  if (!reactor || reactor.controller === input.caster.controller || distance > 60 || !source) return undefined
  const requiresCheck = source.level < input.spellLevel
  if (requiresCheck && !Number.isInteger(input.reaction.abilityCheckTotal)) return undefined
  if (!requiresCheck && input.reaction.abilityCheckTotal != null) return undefined
  if (!spendReaction(reactor, input.events) || !spendClassResource(reactor, source.resourceKey, input.events)) return undefined
  input.events.push({ type: 'turn-resource-spent', actorId: reactor.id, resource: 'reaction' })
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
  target: Dnd5eCombatant,
  requested: boolean | undefined,
  triggeringHit: boolean,
  events: Dnd5eCombatEvent[],
): boolean | undefined {
  if (!requested) return false
  const castingSource = dnd5eShieldSpellCastingSource(target)
  if (!triggeringHit || !castingSource || !spendReaction(target, events)) return undefined
  if (castingSource.resourceKey && !spendClassResource(target, castingSource.resourceKey, events)) return undefined
  target.classState.shieldSpellActive = true
  events.push({ type: 'turn-resource-spent', actorId: target.id, resource: 'reaction' })
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
  if (combatant.classId === 'fighter' && combatant.level >= 9 && (combatant.classResources.fighterIndomitable?.current ?? 0) > 0) {
    return { resourceKey: 'fighterIndomitable', name: '不屈' }
  }
  if (combatant.classId === 'monk' && combatant.level >= 14 && (combatant.classResources['dnd5e-ki']?.current ?? 0) > 0) {
    return { resourceKey: 'dnd5e-ki', name: '金刚魂' }
  }
  return undefined
}

export function dnd5eDarkOnesOwnLuckAvailable(
  combatant: Pick<Dnd5eCombatant, 'classId' | 'subclassId' | 'level' | 'classResources'>,
): boolean {
  return combatant.classId === 'warlock' && combatant.subclassId === 'fiend' && combatant.level >= 6 &&
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

function applyStrokeOfLuckToAttack(
  combatant: Dnd5eCombatant,
  resolution: AttackResolution,
  requested: boolean | undefined,
  events: Dnd5eCombatEvent[],
): AttackResolution {
  if (!requested) return resolution
  const resource = combatant.classResources['dnd5e-stroke-of-luck']
  if (
    resolution.hit || combatant.classId !== 'rogue' || combatant.level < 20 ||
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
      rolls: input.rolls, mode: input.mode, modifier: input.modifier, dc: input.dc,
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
  const rerolls = input.mode === 'normal'
    ? [input.rerollD20]
    : [input.rerollD20, input.rerollD20Second ?? 0]
  const resolved = rules.resolveSavingThrow({
    rolls: rerolls, mode: input.mode, modifier: input.modifier, dc: input.dc,
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
  const valid = combatant.classId === 'druid' && combatant.level >= 2 && !!monster &&
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
  const effectiveAmount = target.deathSaves.dead ? 0 : Math.max(0, amount)
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
  const temporaryHpBefore = target.temporaryHp
  const absorbed = Math.min(target.temporaryHp, amount)
  target.temporaryHp -= absorbed
  const hitPointDamage = amount - absorbed
  let remainingDamageAfterZero = Math.max(0, hitPointDamage - hpBefore)
  if (target.classState.wildShapeFormId && hitPointDamage >= target.currentHp) {
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
  if (amount > 0) triggerDnd5eActiveEffectBreak(target, 'takes-damage', events)
  events.push({ type: 'damage-applied', sourceId: source?.id, targetId: target.id, amount, hpBefore, hpAfter: target.currentHp, temporaryHpBefore, temporaryHpAfter: target.temporaryHp })
  const massiveDamage = target.currentHp === 0 && remainingDamageAfterZero >= target.maxHp
  const undeadFortitudeRule = dnd5eUndeadFortitudeRule(target)
  const undeadFortitudeRequired = target.currentHp === 0 && hpBefore > 0 && amount > 0 && !massiveDamage &&
    !bypassUndeadFortitude &&
    undeadFortitudeRule?.kind === 'undead-fortitude' &&
    !(undeadFortitudeRule.excludedOnCritical && critical) &&
    !damageTypes.some((type) => undeadFortitudeRule.excludedDamageTypes.includes(type))
  if (
    source && source.controller !== target.controller && hpBefore > 0 && target.currentHp === 0 &&
    !undeadFortitudeRequired && source.classId === 'warlock' && source.subclassId === 'fiend' && source.level >= 1
  ) {
    const granted = Math.max(0, source.level + rules.abilityModifier(source.abilities.cha))
    const next = Math.max(source.temporaryHp, granted)
    const gained = next - source.temporaryHp
    source.temporaryHp = next
    if (gained > 0) events.push({ type: 'temporary-hit-points-gained', actorId: source.id, amount: gained, current: next })
  }
  if (undeadFortitudeRequired) {
    const dc = undeadFortitudeRule.dcBase + amount
    target.classState.undeadFortitudePending = { dc, damage: amount, sourceId: source?.id }
    target.deathSaves = { successes: 0, failures: 0, stable: false, dead: false }
    events.push({ type: 'undead-fortitude-save-required', targetId: target.id, dc, damage: amount })
  }
  const relentlessRage = target.currentHp === 0 && hpBefore > 0 && !massiveDamage && target.classState.raging &&
    target.classId === 'barbarian' && target.level >= 11
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
  const relentlessRage = hpBefore > 0 && target.classState.raging && target.classId === 'barbarian' && target.level >= 11
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

function endDnd5eConcentration(
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
  actor.classState.concentrationTargetIds = undefined
  actor.classState.concentrationRoundsRemaining = undefined
  actor.classState.huntersMarkTargetId = undefined
  if (previousSpellId) {
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'concentration', active: false })
  }
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
): void {
  if (actor.concentrating || actor.classState.concentrationSpellId) {
    endDnd5eConcentration(state, actor, events)
  }
  const uniqueTargetIds = [...new Set(targetIds)]
  actor.concentrating = true
  actor.classState.concentrationSpellId = spellId
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
  let adjusted = target.damageVulnerabilities.includes(type) ? amount * 2 : amount
  const rageResistance = target.classState.raging && (type === 'bludgeoning' || type === 'piercing' || type === 'slashing')
  const emptyBodyResistance = (target.classState.emptyBodyRoundsRemaining ?? 0) > 0 && type !== 'force'
  const fiendishResilience = target.classId === 'warlock' && target.subclassId === 'fiend' && target.level >= 10 &&
    target.classSelections['fiendish-resilience']?.includes(type)
  const draconicResistance = (target.classState.draconicResistanceRoundsRemaining ?? 0) > 0 &&
    target.classState.draconicResistanceType === type
  const petrifiedResistance = dnd5eHasStandardCondition(target, 'petrified')
  if (target.damageResistances.includes(type) || rageResistance || emptyBodyResistance || fiendishResilience || draconicResistance || petrifiedResistance) {
    adjusted = Math.floor(adjusted / 2)
  }
  return adjusted
}

function classFeatureTurnKey(state: Dnd5eHeadlessCombatState, actorId: string): string {
  return `${state.combatId}:${state.round}:${state.turnSlotId ?? actorId}`
}

function dnd5eCombatantIsBanished(combatant: Pick<Dnd5eCombatant, 'classState'>): boolean {
  return !!combatant.classState.hurlThroughHellSourceId
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
    actor.classId !== 'warlock' || actor.subclassId !== 'fiend' || actor.level < 14 ||
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
  source: 'tranquility' | 'nature-sanctuary'
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
  const natureSanctuary = includeNatureSanctuary &&
    target.classId === 'druid' && target.subclassId === 'land' && target.level >= 14 &&
    dnd5eNatureSanctuaryAttackerEligible(attacker) &&
    (attacker.classState.natureSanctuaryImmunityRoundsByTarget?.[target.id] ?? 0) <= 0
  const source = target.classState.tranquilityActive
    ? 'tranquility' as const
    : natureSanctuary
      ? 'nature-sanctuary' as const
      : undefined
  if (!source) return undefined
  return {
    source,
    saveDc: 8 + target.proficiencyBonus + rules.abilityModifier(target.abilities.wis),
    saveModifier: attacker.savingThrowBonuses.wis ?? rules.abilityModifier(attacker.abilities.wis),
    saveMode: dnd5eSavingThrowMode(attacker, 'wis', { effectVisible: true }),
    blessed: state ? dnd5eCombatantHasConcentrationEffect(state, attacker.id, 'bless') : false,
    baned: state ? dnd5eCombatantHasConcentrationEffect(state, attacker.id, 'bane') : false,
  }
}

function endTranquilityForHostileAction(actor: Dnd5eCombatant, events: Dnd5eCombatEvent[]): void {
  if (!actor.classState.tranquilityActive) return
  actor.classState.tranquilityActive = undefined
  events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'tranquility', active: false })
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
  const beguilingInfluence = actor.classId === 'warlock' &&
    actor.classSelections['eldritch-invocations']?.includes('beguiling-influence') &&
    (skill === 'deception' || skill === 'persuasion')
  if (actor.skillProficiencies.includes(skill) || actor.classSelections['lore-bonus-skills']?.includes(skill) || beguilingInfluence) return 1
  return 0
}

function unproficientAbilityCheckBonus(actor: Dnd5eCombatant, ability: AbilityKey): number {
  if (actor.classId === 'bard' && actor.level >= 2) return Math.floor(actor.proficiencyBonus / 2)
  if (
    actor.classId === 'fighter' && actor.subclassId === 'champion' && actor.level >= 7 &&
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
  const rageStrengthAdvantage = actor.classId === 'barbarian' && actor.level >= 1 &&
    actor.classState.raging === true && action.ability === 'str'
  const advantage = requestedMode === 'advantage' || rageStrengthAdvantage
  const disadvantage = requestedMode === 'disadvantage' || actor.exhaustionLevel >= 1 ||
    dnd5eConditionAbilityCheckDisadvantage(actor)
  const mode: D20RollMode = advantage === disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage'
  const suppliedRolls = mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? action.d20]
  const rank = abilityCheckProficiencyRank(actor, action.skill)
  const reliableTalent = actor.classId === 'rogue' && actor.level >= 11 && rank > 0
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
    const dieSides = dnd5eBardicInspirationDie(actor.level)
    if (
      actor.classId !== 'bard' || actor.subclassId !== 'lore' || actor.level < 14 ||
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
      actor.classId !== 'rogue' || actor.level < 20 || action.dc == null || roll.total >= action.dc ||
      !resource || resource.current < 1 || !spendClassResource(actor, 'dnd5e-stroke-of-luck', events)
    ) return undefined
    roll = rules.resolveD20({ rolls: [20], mode: 'normal', modifier: roll.modifier })
    strokeOfLuckApplied = true
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'stroke-of-luck', active: true })
  }

  const indomitableMightApplied = actor.classId === 'barbarian' && actor.level >= 18 && action.ability === 'str' &&
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
  const disadvantage = input.actor.exhaustionLevel >= 1 || dnd5eConditionAbilityCheckDisadvantage(input.actor)
  const mode: D20RollMode = advantage === disadvantage ? 'normal' : advantage ? 'advantage' : 'disadvantage'
  const supplied = mode === 'normal'
    ? [input.d20 ?? 0]
    : [input.d20 ?? 0, input.d20Second ?? 0]
  const reliableTalent = input.actor.classId === 'rogue' && input.actor.level >= 11 && rank > 0
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

function dnd5eIsIntimidated(combatant: Dnd5eCombatant): boolean {
  return !!combatant.classState.intimidatingPresenceSourceId &&
    combatant.conditions.some((condition) => ['frightened', '惊惧', '恐慌'].includes(condition.toLowerCase()))
}

export function dnd5eIsFavoredEnemy(
  ranger: Pick<Dnd5eCombatant, 'classId' | 'classSelections'>,
  target: Pick<Dnd5eCombatant, 'creatureType'>,
): boolean {
  if (ranger.classId !== 'ranger') return false
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
    actor.classId !== 'ranger' || actor.level < 20 || !dnd5eIsFavoredEnemy(actor, target) ||
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
  const multiattackDefense = target.classId === 'ranger' && target.subclassId === 'hunter' && target.level >= 7 &&
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
  return target.armorClass + (multiattackDefense ? 4 : 0) + (shieldOfFaith ? 2 : 0) +
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
      !!target.classState.stunnedByActorId || targetProne || dnd5eAttackerIsUnseen(attacker))
  const hasDisadvantage = requestedMode === 'disadvantage' || attackerProne || dnd5eIsIntimidated(attacker) ||
    target.dodging || dnd5eUnseenTargetImposesDisadvantage(attacker, target)
  return hasAdvantage === hasDisadvantage ? 'normal' : hasAdvantage ? 'advantage' : 'disadvantage'
}

function recordHunterMultiattackDefenseHit(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  target: Dnd5eCombatant,
): void {
  if (
    target.classId !== 'ranger' || target.subclassId !== 'hunter' || target.level < 7 ||
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

  const sneakWeapon = context.mode === 'ranged' || context.finesse
  const sneakPosition = input.effectiveMode === 'advantage' || context.adjacentEnemyOfTarget
  if (
    actor.classId === 'rogue' && sneakWeapon && sneakPosition && input.effectiveMode !== 'disadvantage' &&
    actor.classState.sneakAttackTurnKey !== turnKey
  ) {
    definitions.push({ source: 'sneak-attack', count: dnd5eRogueSneakAttackDice(actor.level), sides: 6, type: context.damageType, doubleOnCritical: true })
  }

  if (
    actor.classId === 'ranger' && actor.subclassId === 'hunter' &&
    actor.classSelections['hunters-prey']?.includes('colossus-slayer') &&
    target.currentHp < target.maxHp && actor.classState.colossusSlayerTurnKey !== turnKey
  ) {
    definitions.push({ source: 'colossus-slayer', count: 1, sides: 8, type: context.damageType, doubleOnCritical: true })
  }

  if (actor.classId === 'ranger' && actor.concentrating && actor.classState.huntersMarkTargetId === target.id) {
    definitions.push({ source: 'hunters-mark', count: 1, sides: 6, type: context.damageType, doubleOnCritical: true })
  }

  const brutalDice = actor.level >= 17 ? 3 : actor.level >= 13 ? 2 : actor.level >= 9 ? 1 : 0
  if (actor.classId === 'barbarian' && context.mode === 'melee' && input.critical && brutalDice > 0) {
    definitions.push({ source: 'brutal-critical', count: brutalDice, sides: context.weaponDamageSides, type: context.damageType, doubleOnCritical: false })
  }

  if (actor.classId === 'paladin' && actor.level >= 11 && context.mode === 'melee') {
    definitions.push({ source: 'improved-divine-smite', count: 1, sides: 8, type: 'radiant', doubleOnCritical: true })
  }

  if (
    actor.classId === 'cleric' && actor.subclassId === 'life' && actor.level >= 8 &&
    actor.classState.divineStrikeTurnKey !== turnKey
  ) {
    definitions.push({
      source: 'divine-strike',
      count: actor.level >= 14 ? 2 : 1,
      sides: 8,
      type: 'radiant',
      doubleOnCritical: true,
    })
  }

  if (
    actor.classId === 'warlock' && actor.level >= 12 &&
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
  if (actor.classId === 'paladin' && actor.level >= 2 && context.mode === 'melee' && slotLevel != null) {
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
  const hasFeature = hunter.classId === 'ranger' && hunter.subclassId === 'hunter' && hunter.level >= 15 &&
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
  const shieldSpellApplied = applyShieldSpellReaction(redirectTarget, use.shieldSpellReaction, hit, events)
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

  let totalDamage = 0
  try {
    const components: Array<{ total: number; type?: Dnd5eDamageType; source?: Dnd5eClassDamageSource }> = []
    for (let index = 0; index < input.damage.length; index += 1) {
      const definition = input.damage[index]
      const resolved = rules.resolveDamage({ ...definition, rolls: use.damageRolls[index], critical })
      components.push({ total: resolved.total, type: definition.type })
    }
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
      components.push({ total: resolved.total, type: definition.type, source: definition.source })
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
      const adjusted = adjustDamageForTarget(redirectTarget, component.total - reduction, component.type)
      totalDamage += adjusted
      if (component.source) {
        events.push({
          type: 'class-damage-applied', actorId: attacker.id, targetId: redirectTarget.id,
          source: component.source, amount: adjusted,
        })
      }
    }
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  const finalDamage = applyUncannyDodge(redirectTarget, totalDamage, use.uncannyDodge, events)
  if (finalDamage == null) return fail(state, events, 'invalid-class-feature')
  applyDamage(redirectTarget, finalDamage, critical, events, attacker, state, [
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
  if (action.type === 'attack' && actor.classState.wildShapeFormId) {
    return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.divineSmiteSlotLevel != null) {
    const slotLevel = action.classDamageContext.divineSmiteSlotLevel
    const slot = actor.classResources[`dnd5e-spell-slot-${slotLevel}`]
    if (
      actor.classId !== 'paladin' || actor.level < 2 || action.classDamageContext.mode !== 'melee' ||
      !Number.isInteger(slotLevel) || slotLevel < 1 || slotLevel > 9 || !slot || slot.current < 1
    ) return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.recklessAttack) {
    const turnKey = classFeatureTurnKey(state, actor.id)
    if (
      actor.classId !== 'barbarian' || actor.level < 2 || action.classDamageContext.mode !== 'melee' ||
      !action.classDamageContext.strengthBased || action.mode !== 'advantage' ||
      (actor.classState.recklessAttackTurnKey !== turnKey && !actor.turn.actionAvailable)
    ) return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.frenzyAttack) {
    const turnKey = classFeatureTurnKey(state, actor.id)
    if (
      actor.classId !== 'barbarian' || actor.subclassId !== 'berserker' || actor.level < 3 ||
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
      actor.classId !== 'ranger' || actor.subclassId !== 'hunter' || actor.level < 3 ||
      !actor.classSelections['hunters-prey']?.includes('horde-breaker') ||
      actor.classState.hordeBreakerOpportunityTurnKey !== turnKey ||
      actor.classState.hordeBreakerUsedTurnKey === turnKey ||
      !actor.classState.hordeBreakerSourceTargetId || actor.classState.hordeBreakerSourceTargetId === action.targetId ||
      action.spendAction !== false || action.spendBonusAction === true
    ) return fail(state, events, 'invalid-class-feature')
  }
  if (action.type === 'attack' && action.classDamageContext?.stunningStrike) {
    const ki = actor.classResources['dnd5e-ki']
    if (actor.classId !== 'monk' || actor.level < 5 || action.classDamageContext.mode !== 'melee' || !ki || ki.current < 1) {
      return fail(state, events, 'invalid-class-feature')
    }
  }
  if (
    action.type === 'opportunity-attack' && action.reactionFeature === 'berserker-retaliation' &&
    (actor.classId !== 'barbarian' || actor.subclassId !== 'berserker' || actor.level < 14)
  ) return fail(state, events, 'invalid-class-feature')
  if (
    action.type === 'opportunity-attack' && action.reactionFeature === 'hunter-giant-killer' &&
    (
      actor.classId !== 'ranger' || actor.subclassId !== 'hunter' || actor.level < 3 ||
      !actor.classSelections['hunters-prey']?.includes('giant-killer')
    )
  ) return fail(state, events, 'invalid-class-feature')
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
  endTranquilityForHostileAction(actor, events)
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
    target.classId === 'ranger' && target.subclassId === 'hunter' && target.level >= 7 &&
    target.classSelections['defensive-tactics']?.includes('escape-the-horde')
  const requestedMode = action.mode ?? 'normal'
  const viciousMockeryDisadvantage = consumeViciousMockeryAttackDisadvantage(actor, events)
  const hasAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
    (dnd5eTargetGrantsAttackAdvantage(target) || requestedMode === 'advantage' || attackingFromHidden || !!target.classState.stunnedByActorId || dnd5eAttackerIsUnseen(actor))
  const hasDisadvantage = requestedMode === 'disadvantage' || viciousMockeryDisadvantage || escapeTheHorde || dnd5eIsIntimidated(actor) ||
    target.dodging || dnd5eUnseenTargetImposesDisadvantage(actor, target)
  const mode: D20RollMode = hasAdvantage === hasDisadvantage ? 'normal' : hasAdvantage ? 'advantage' : 'disadvantage'
  const rolls = mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? action.d20]
  let targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
  let attack
  try {
    const inspiredAttack = applyBardicInspirationToAttack(
      actor,
      rules.resolveAttack({
        rolls,
        mode,
        modifier: action.attackModifier + resolveDnd5eBlessRoll(state, actor, action.blessRoll) -
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
  const criticalThreshold = action.type === 'attack' ? Math.min(20, Math.max(18, action.criticalThreshold ?? 20)) : 20
  let attackOutcome = resolveDnd5eAttackOutcome({
    attack,
    targetArmorClass,
    criticalThreshold,
    automaticCritical: dnd5eHitIsAutomaticCritical(state, actor.id, target),
    forceHit: action.strokeOfLuck === true,
  })
  let { hit, critical } = attackOutcome
  const shieldSpellApplied = applyShieldSpellReaction(target, action.shieldSpellReaction, hit, events)
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
  if (action.type === 'attack' && actor.classId === 'monk' && action.spendAction !== false) {
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
      classDamageContext: action.type === 'attack' ? action.classDamageContext : undefined,
    })
  }
  if (hit) {
    let totalDamage = 0
    try {
      const damage = rules.resolveDamage({ ...action.damage, critical })
      const resolvedClassDamage: Array<{ definition: Dnd5eClassDamageDefinition; total: number }> = []
      if (action.type === 'attack') {
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
      totalDamage += adjustDamageForTarget(target, reduceDamageRoll(damage.total), action.damage.type)
      for (const entry of resolvedClassDamage) {
        const adjusted = adjustDamageForTarget(target, reduceDamageRoll(entry.total), entry.definition.type)
        totalDamage += adjusted
        events.push({
          type: 'class-damage-applied', actorId: actor.id, targetId: target.id,
          source: entry.definition.source, amount: adjusted,
        })
      }
      const uncannyDamage = applyUncannyDodge(target, totalDamage, action.uncannyDodge, events)
      if (uncannyDamage == null) return fail(state, events, 'invalid-class-feature')
      const finalDamage = applyDeflectMissiles(
        state,
        actor,
        target,
        uncannyDamage,
        action.type === 'attack' && action.classDamageContext?.mode === 'ranged',
        action.type === 'attack' ? action.deflectMissilesD10 : undefined,
        action.damage.type,
        events,
      )
      if (finalDamage == null) return fail(state, events, 'invalid-class-feature')
      applyDamage(target, finalDamage, critical, events, actor, state, [
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
  const requestedTargetIds = [...new Set(action.targetIds?.length ? action.targetIds : [action.targetId])]
  const legendaryResistanceTargetIds = [...new Set(action.legendaryResistanceTargetIds ?? [])]
  const targets = requestedTargetIds.map((targetId) => state.combatants[targetId])
  const target = targets[0]
  const classDefinition = actor?.classId ? dnd5eClassDefinition(actor.classId) : undefined
  const spellcasting = classDefinition?.spellcasting
  if (
    !actor || actor.currentHp <= 0 || dnd5eCombatantIsBanished(actor) || !target ||
    targets.some((candidate) => !candidate || candidate.deathSaves.dead || dnd5eCombatantIsBanished(candidate)) ||
    !spell || requestedTargetIds.length < 1 ||
    requestedTargetIds.length > (metamagic?.kind === 'twinned' ? 2 : dnd5eSpellMaximumTargets(spell, action.slotLevel, actor.level)) ||
    (metamagic?.kind === 'twinned' && requestedTargetIds.length !== 2) ||
    !spellcasting || !actor.classId
  ) {
    return fail(state, events, 'invalid-class-feature')
  }
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
  if (action.shieldSpellReaction && spell.effect !== 'spell-attack') return fail(state, events, 'invalid-class-feature')
  if ((action.hurlThroughHellDamageRolls?.length ?? 0) > 0 && spell.effect !== 'spell-attack') {
    return fail(state, events, 'invalid-dice')
  }
  if ((action.forcedMovements?.length ?? 0) > 0 && spell.onFailedSaveEffect !== 'thunderwave-push') {
    return fail(state, events, 'invalid-class-feature')
  }
  if (actor.classState.wildShapeFormId && (actor.classId !== 'druid' || actor.level < 18)) {
    return fail(state, events, 'invalid-class-feature')
  }
  const selectionKey = spell.level === 0
    ? 'spell-cantrips'
    : spellcasting.kind === 'full-known' || spellcasting.kind === 'half-known' || spellcasting.kind === 'pact'
      ? 'spell-known'
      : 'spell-prepared'
  const selectedByWizardFeature = actor.classId === 'wizard' && (
    actor.classSelections['spell-mastery-1']?.includes(spell.id) ||
    actor.classSelections['spell-mastery-2']?.includes(spell.id) ||
    actor.classSelections['signature-spells']?.includes(spell.id)
  )
  const selectedByMysticArcanum = actor.classId === 'warlock' &&
    actor.classSelections[`mystic-arcanum-${spell.level}`]?.includes(spell.id)
  if (!spell.classes.includes(actor.classId) || (!actor.classSelections[selectionKey]?.includes(spell.id) && !selectedByWizardFeature && !selectedByMysticArcanum)) {
    return fail(state, events, 'invalid-class-feature')
  }
  const repellingBlast = action.repellingBlast === true
  if (
    repellingBlast &&
    (actor.classId !== 'warlock' || spell.id !== 'eldritch-blast' ||
      !actor.classSelections['eldritch-invocations']?.includes('repelling-blast'))
  ) return fail(state, events, 'invalid-class-feature')
  if (targets.some((candidate) => spell.target === 'hostile'
    ? actor.controller === candidate!.controller
    : spell.target === 'ally'
      ? actor.controller !== candidate!.controller
      : false)) {
    return fail(state, events, 'invalid-target')
  }
  const suppliedSculptedTargetIds = action.sculptedTargetIds ?? []
  const sculptedTargetIds = [...new Set(suppliedSculptedTargetIds)]
  if (
    sculptedTargetIds.length !== suppliedSculptedTargetIds.length ||
    (!dnd5eCanSculptSpell(actor, spell) && sculptedTargetIds.length > 0) ||
    sculptedTargetIds.length > dnd5eSculptSpellMaximumTargets(spell) ||
    sculptedTargetIds.some((targetId) => targetId === actor.id || !requestedTargetIds.includes(targetId))
  ) return fail(state, events, 'invalid-class-feature')
  const sculptedTargetIdSet = new Set(sculptedTargetIds)
  const suppliedCarefulTargetIds = metamagic?.carefulTargetIds ?? []
  const carefulTargetIds = [...new Set(suppliedCarefulTargetIds)]
  if (metamagic) {
    if (
      actor.classId !== 'sorcerer' || actor.level < 3 ||
      !actor.classSelections.metamagic?.includes(metamagic.kind) ||
      !dnd5eMetamagicAvailableForSpell(metamagic.kind, spell, action.slotLevel)
    ) return fail(state, events, 'invalid-class-feature')
  }
  const empoweredRequested = action.empowered === true
  const empoweredRerolls = action.empoweredRerolls ?? []
  const empoweredUsed = empoweredRerolls.length > 0
  if (
    (empoweredRequested && (
      actor.classId !== 'sorcerer' || actor.level < 3 ||
      !actor.classSelections.metamagic?.includes('empowered') ||
      !dnd5eCanEmpowerSpell(spell)
    )) ||
    (!empoweredRequested && empoweredUsed)
  ) return fail(state, events, 'invalid-class-feature')
  const draconicResistance = action.draconicResistance === true
  const draconicResistanceType = dnd5eDraconicElementalResistanceType(actor, spell)
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
    spell.effect === 'healing' &&
    targets.some((candidate) => ['构装体', 'construct', '亡灵', 'undead'].includes(candidate!.creatureType ?? ''))
  ) return fail(state, events, 'invalid-target')

  const slotKey = spellcasting.kind === 'pact' && spell.level <= 5 ? 'dnd5e-pact-slot' : `dnd5e-spell-slot-${action.slotLevel}`
  const freeCastSource = dnd5eFreeSpellCastSource(actor, spell, action.slotLevel)
  if (spell.level === 0) {
    if (action.slotLevel !== 0) return fail(state, events, 'invalid-class-feature')
  } else {
    const slot = actor.classResources[slotKey]
    const invalidPactLevel = spellcasting.kind === 'pact' && (
      freeCastSource?.kind === 'mystic-arcanum'
        ? action.slotLevel !== spell.level
        : action.slotLevel !== dnd5ePactSlotLevel(actor.level)
    )
    if (
      !Number.isInteger(action.slotLevel) || action.slotLevel < spell.level || invalidPactLevel ||
      (!freeCastSource && (!slot || slot.current < 1))
    ) {
      return fail(state, events, 'class-resource-unavailable')
    }
  }

  const overchannel = action.overchannel === true
  if (overchannel && !dnd5eCanOverchannelSpell(actor, spell, action.slotLevel)) {
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
  if (
    (overchannel && action.effectRolls.length > 0) ||
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

  const effectiveCastingTime = metamagic?.kind === 'quickened' ? 'bonus-action' : spell.castingTime
  const turnKey = classFeatureTurnKey(state, actor.id)
  if (
    (effectiveCastingTime === 'bonus-action' && actor.classState.leveledSpellTurnKey === turnKey) ||
    (effectiveCastingTime === 'action' && spell.level > 0 && actor.classState.bonusActionSpellTurnKey === turnKey)
  ) return fail(state, events, 'invalid-class-feature')

  const resource: TurnResource = effectiveCastingTime === 'bonus-action' ? 'bonusAction' : 'action'
  if (!spend(actor, resource)) return fail(state, events, resource === 'bonusAction' ? 'bonus-action-unavailable' : 'action-unavailable')
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource })
  if (spell.level > 0) {
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
  if (effectiveCastingTime === 'bonus-action') actor.classState.bonusActionSpellTurnKey = turnKey
  if (spell.level > 0) actor.classState.leveledSpellTurnKey = turnKey
  events.push({ type: 'spell-cast', actorId: actor.id, targetId: target.id, spellId: spell.id, slotLevel: action.slotLevel })
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
  const attackingFromHidden = spell.effect === 'spell-attack' && actor.classState.hiddenCheckTotal != null
  if (attackingFromHidden) {
    actor.classState.hiddenCheckTotal = undefined
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hidden', active: false })
  }
  const allowedHostileTargetIds = new Set(requestedTargetIds)
  const includeNatureSanctuary = spell.effect === 'spell-attack'
  if (spell.target === 'hostile') {
    endTranquilityForHostileAction(actor, events)
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
    (spell.effect !== 'spell-attack' || !spendProtectionReaction(state, actor, target, action.protectionReactionActorId, events))
  ) return fail(state, events, 'invalid-class-feature')

  const baseConcentrationDurationRounds = dnd5eSpellConcentrationDurationRounds(spell, action.slotLevel)
  const concentrationDurationRounds = metamagic?.kind === 'extended'
    ? Math.min(14_400, baseConcentrationDurationRounds * 2)
    : baseConcentrationDurationRounds

  if (spell.effect === 'mark') {
    if (action.effectRolls.length > 0) return fail(state, events, 'invalid-dice')
    beginDnd5eConcentration(
      state,
      actor,
      spell.id,
      [target.id],
      concentrationDurationRounds,
      events,
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
    )
    for (const affectedTargetId of affectedTargetIds) {
      events.push({ type: 'class-state-changed', actorId: actor.id, targetId: affectedTargetId, stateKey: spell.id, active: true })
    }
    return finishSpellCast()
  }

  const abilityModifier = rules.abilityModifier(actor.abilities[spellcasting.ability])
  const spellSaveDc = 8 + actor.proficiencyBonus + abilityModifier
  const diceCount = dnd5eSpellDiceCount(spell, actor.level, action.slotLevel)
  const draconicAncestor = actor.classSelections['dragon-ancestor']?.[0]
  const draconicDamageType = draconicAncestor?.split('-').at(-1)
  const draconicAffinityBonus = actor.classId === 'sorcerer' && actor.subclassId === 'draconic' && actor.level >= 6 &&
    draconicDamageType === spell.damageType
    ? Math.max(0, rules.abilityModifier(actor.abilities.cha))
    : 0
  const empoweredEvocationBonus = actor.classId === 'wizard' && actor.subclassId === 'evocation' && actor.level >= 10 &&
    spell.school === '塑能'
    ? Math.max(0, rules.abilityModifier(actor.abilities.int))
    : 0
  const agonizingBlastBonus = spell.id === 'eldritch-blast' && actor.classId === 'warlock' &&
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
  const applySpellDamage = (combatant: Dnd5eCombatant, amount: number, critical = false) => {
    applyDamage(
      combatant,
      amount,
      critical,
      events,
      actor,
      state,
      spell.damageType ? [spell.damageType] : [],
      spell.id === 'disintegrate',
    )
    if (spell.id !== 'disintegrate' || combatant.currentHp > 0) return
    const hpBefore = combatant.currentHp
    combatant.currentHp = 0
    combatant.temporaryHp = 0
    combatant.classState.undeadFortitudePending = undefined
    combatant.classState.monsterOnHitSavePending = undefined
    combatant.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
    if (combatant.concentrating) endDnd5eConcentration(state, combatant, events)
    events.push({ type: 'instant-death', sourceId: actor.id, targetId: combatant.id, hpBefore })
  }
  const applySpellOnHitEffect = (affectedTarget: Dnd5eCombatant) => {
    if (!spell.onHitEffect || affectedTarget.deathSaves.dead) return
    if (spell.onHitEffect === 'ray-of-frost') {
      applyDnd5eMechanicalStatusEffect(affectedTarget, actor, {
        definitionId: `srd-5.1:spell:${spell.id}:speed-penalty`,
        label: '冷冻射线：速度降低',
        appliedTurnKey: classFeatureTurnKey(state, actor.id),
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
        preventReactions: true,
        duration: { type: 'until-turn-boundary', boundary: 'target-turn-start', appliedTurnKey: classFeatureTurnKey(state, actor.id) },
      }, events)
      events.push({
        type: 'class-state-changed', actorId: actor.id, targetId: affectedTarget.id,
        stateKey: 'shocking-grasp', active: true,
      })
    }
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
    if (spell.onFailedSaveEffect !== 'sunburst-blindness') return
    applyDnd5eStandardConditionEffect(affectedTarget, actor, {
      id: dnd5eActiveEffectId(`srd-5.1:spell:${spell.id}:blinded`, actor.id, affectedTarget.id),
      rulesId: spell.id,
      appliedTurnKey: classFeatureTurnKey(state, actor.id),
      condition: 'blinded',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'con', dc, timing: 'target-turn-end', onSuccess: 'remove' },
    }, events)
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
    }
    return true
  }

  try {
    if (spell.effect === 'healing') {
      const healing = damageOrHealing(false)
      const lifeDomain = actor.classId === 'cleric' && actor.subclassId === 'life'
      const maximumHealing = lifeDomain && actor.level >= 17
        ? diceCount * spell.dice.sides + baseEffectBonus
        : healing.total
      const domainBonus = lifeDomain && spell.level > 0 ? 2 + spell.level : 0
      for (const affectedTarget of targets) {
        const restored = applyHealing(affectedTarget!, maximumHealing + domainBonus, events)
        if (lifeDomain && actor.level >= 6 && spell.level > 0 && affectedTarget!.id !== actor.id && restored > 0) {
          applyHealing(actor, 2 + spell.level, events)
        }
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
          if (!shieldTarget || applyShieldSpellReaction(shieldTarget, true, true, events) !== true) {
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
        if (affectedTarget!.classState.wildShapeFormId) revertDnd5eWildShape(affectedTarget!, 0, events)
        affectedTarget!.currentHp = 0
        affectedTarget!.temporaryHp = 0
        affectedTarget!.classState.undeadFortitudePending = undefined
        affectedTarget!.classState.monsterOnHitSavePending = undefined
        affectedTarget!.deathSaves = { successes: 0, failures: 3, stable: false, dead: true }
        if (affectedTarget!.concentrating) endDnd5eConcentration(state, affectedTarget!, events)
        events.push({ type: 'instant-death', sourceId: actor.id, targetId: affectedTarget!.id, hpBefore })
      }
      return finishSpellCast()
    }
    if (spell.effect === 'saving-throw') {
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
        const potentCantrip = actor.classId === 'wizard' && actor.subclassId === 'evocation' && actor.level >= 6 && spell.level === 0
        const successfulSave = potentCantrip ? 'half' : spell.damageOnSuccessfulSave ?? 'none'
        const requiresDamageRolls = resolvedTargets.some(({ success, sculpted }) => !sculpted && (!success || successfulSave === 'half'))
        if (requiresDamageRolls) {
          const damage = damageWithCuttingWords(false)
          if (!damage) return fail(state, events, 'invalid-class-feature')
          for (const resolvedTarget of resolvedTargets) {
            if (resolvedTarget.sculpted) continue
            if (spell.id === 'blight' && isBlightImmuneTarget(resolvedTarget.target)) continue
            const adjusted = adjustDamageForTarget(
              resolvedTarget.target,
              blightDamageTotal(resolvedTarget.target, damage.total),
              spell.damageType,
            )
            const finalDamage = dnd5eDamageAfterSavingThrow({
              creature: resolvedTarget.target,
              ability: spell.saveAbility!,
              damage: adjusted,
              success: resolvedTarget.success,
              successfulSave,
            })
            if (finalDamage > 0) applySpellDamage(resolvedTarget.target, finalDamage)
          }
        } else if (action.effectRolls.length > 0) {
          return fail(state, events, 'invalid-dice')
        }
        for (const resolvedTarget of resolvedTargets.filter(({ success, sculpted }) => !success && !sculpted)) {
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
      const potentCantrip = actor.classId === 'wizard' && actor.subclassId === 'evocation' && actor.level >= 6 && spell.level === 0
      const successfulSave = potentCantrip ? 'half' : spell.damageOnSuccessfulSave ?? 'none'
      const requiresDamageRolls = !save.success || successfulSave === 'half'
      if (requiresDamageRolls) {
        const damage = damageWithCuttingWords(false)
        if (!damage) return fail(state, events, 'invalid-class-feature')
        const adjusted = spell.id === 'blight' && isBlightImmuneTarget(target)
          ? 0
          : adjustDamageForTarget(target, blightDamageTotal(target, damage.total), spell.damageType)
        const finalDamage = dnd5eDamageAfterSavingThrow({
          creature: target,
          ability: spell.saveAbility!,
          damage: adjusted,
          success: save.success,
          successfulSave,
        })
        if (finalDamage > 0) applySpellDamage(target, finalDamage)
      } else if (action.effectRolls.length > 0) {
        return fail(state, events, 'invalid-dice')
      }
      if (!save.success) applyFailedSaveSpellEffect(target, spellSaveDc)
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
            dnd5eAttackerIsUnseen(actor))
        const actorHasDisadvantage = requestedMode === 'disadvantage' ||
          (attackIndex === 0 && viciousMockeryDisadvantage) || actor.exhaustionLevel >= 3 ||
          dnd5eIsIntimidated(actor) || dnd5eUnseenTargetImposesDisadvantage(actor, affectedTarget)
        const mode: D20RollMode = targetGrantsAdvantage === actorHasDisadvantage
          ? 'normal'
          : targetGrantsAdvantage ? 'advantage' : 'disadvantage'
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
        const shieldSpellApplied = applyShieldSpellReaction(affectedTarget, supplied.shieldSpellReaction, hit, events)
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
            adjustDamageForTarget(affectedTarget, damage.total, spell.damageType),
            supplied.uncannyDodge,
            events,
          )
          if (finalDamage == null) return fail(state, events, 'invalid-class-feature')
          applySpellDamage(affectedTarget, finalDamage, critical)
          triggerHurlThroughHell({
            state, actor, target: affectedTarget,
            damageRolls: supplied.hurlThroughHellDamageRolls,
            events,
          })
          applySpellOnHitEffect(affectedTarget)
          const pushTo = supplied.repellingBlastPushTo
          const pushDistance = supplied.repellingBlastPushDistanceFeet
          if (!repellingBlast && (pushTo || pushDistance != null)) return fail(state, events, 'invalid-class-feature')
          if ((pushTo == null) !== (pushDistance == null)) return fail(state, events, 'invalid-class-feature')
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
          }
        } else {
          if (
            supplied.effectRolls.length > 0 || (supplied.hurlThroughHellDamageRolls?.length ?? 0) > 0 ||
            supplied.repellingBlastPushTo || supplied.repellingBlastPushDistanceFeet != null
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
        dnd5eAttackerIsUnseen(actor))
    const actorHasDisadvantage = requestedMode === 'disadvantage' || viciousMockeryDisadvantage || actor.exhaustionLevel >= 3 ||
      dnd5eIsIntimidated(actor) || dnd5eUnseenTargetImposesDisadvantage(actor, target)
    const mode: D20RollMode = targetGrantsAdvantage === actorHasDisadvantage
      ? 'normal'
      : targetGrantsAdvantage
        ? 'advantage'
        : 'disadvantage'
    const rolls = mode === 'normal' ? [action.d20 ?? 0] : [action.d20 ?? 0, action.d20Second ?? 0]
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
    const shieldSpellApplied = applyShieldSpellReaction(target, action.shieldSpellReaction, hit, events)
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
    if (hit) recordHunterMultiattackDefenseHit(state, actor, target)
    if (!hit && (action.uncannyDodge || action.cuttingWordsDamage)) return fail(state, events, 'invalid-class-feature')
    if (hit && action.standAgainstTide) return fail(state, events, 'invalid-class-feature')
    if (hit) {
      const damage = damageWithCuttingWords(critical)
      if (!damage) return fail(state, events, 'invalid-class-feature')
      const finalDamage = applyUncannyDodge(
        target,
        adjustDamageForTarget(target, damage.total, spell.damageType),
        action.uncannyDodge,
        events,
      )
      if (finalDamage == null) return fail(state, events, 'invalid-class-feature')
      applySpellDamage(target, finalDamage, critical)
      triggerHurlThroughHell({
        state,
        actor,
        target,
        damageRolls: action.hurlThroughHellDamageRolls,
        events,
      })
      applySpellOnHitEffect(target)
    } else {
      if (action.effectRolls.length > 0 || (action.hurlThroughHellDamageRolls?.length ?? 0) > 0) {
        return fail(state, events, 'invalid-dice')
      }
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
): readonly Dnd5eMonsterWeaponAttack[] | undefined {
  if (monsterAction.kind === 'weapon-attack' && monsterAction.attack) return [monsterAction.attack]
  if (monsterAction.kind !== 'multiattack' || !monsterAction.sequence) return undefined
  const sequence = monsterAction.sequence.map((actionId) => actions.find((candidate) => candidate.id === actionId)?.attack)
  return sequence.every((attack): attack is Dnd5eMonsterWeaponAttack => !!attack) ? sequence : undefined
}

function resolveMonsterAction(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'monster-action' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const monster = actor?.statBlockId ? getDnd5eSrdMonster(actor.statBlockId) : undefined
  const actionDefinition = monster?.actions.find((candidate) => candidate.id === action.actionId)
  const sequence = actionDefinition && monster ? monsterWeaponSequence(actionDefinition, monster.actions) : undefined
  if (!actor || actor.currentHp <= 0 || !monster || !sequence || sequence.length !== action.rolls.length) {
    return fail(state, events, 'invalid-monster-action')
  }
  if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })

  for (let index = 0; index < sequence.length; index += 1) {
    const attackDefinition = sequence[index]
    const supplied = action.rolls[index]
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
    if (!spendProtectionReaction(state, actor, target, supplied.protectionReactionActorId, events)) {
      return fail(state, events, 'invalid-class-feature')
    }
    const requestedMode = supplied.mode ?? 'normal'
    const viciousMockeryDisadvantage = consumeViciousMockeryAttackDisadvantage(actor, events)
    const hasAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
      (dnd5eTargetGrantsAttackAdvantage(target) || requestedMode === 'advantage' || !!target.classState.stunnedByActorId || dnd5eAttackerIsUnseen(actor))
    const hasDisadvantage = requestedMode === 'disadvantage' || viciousMockeryDisadvantage || dnd5eIsIntimidated(actor) ||
      target.dodging || dnd5eUnseenTargetImposesDisadvantage(actor, target)
    const mode: D20RollMode = hasAdvantage === hasDisadvantage ? 'normal' : hasAdvantage ? 'advantage' : 'disadvantage'
    const attackRolls = mode === 'normal' ? [supplied.d20] : [supplied.d20, supplied.d20Second ?? supplied.d20]
    let targetArmorClass = dnd5eTargetArmorClassForAttack(state, actor.id, target.id)
    let attack: AttackResolution | undefined
    try {
      const inspiredAttack = applyBardicInspirationToAttack(
        actor,
        rules.resolveAttack({
          rolls: attackRolls,
          mode,
          modifier: attackDefinition.toHit + resolveDnd5eBlessRoll(state, actor, supplied.blessRoll) -
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
    const shieldSpellApplied = applyShieldSpellReaction(target, supplied.shieldSpellReaction, hit, events)
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
      type: 'attack-resolved',
      actorId: actor.id,
      targetId: target.id,
      d20: attack.roll.d20,
      total: attack.roll.total,
      armorClass: targetArmorClass,
      hit,
      critical,
    }, events)
    if (hit) recordHunterMultiattackDefenseHit(state, actor, target)
    if (!hit && (supplied.uncannyDodge || supplied.deflectMissilesD10 != null || supplied.cuttingWordsDamage)) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (hit && supplied.standAgainstTide) return fail(state, events, 'invalid-class-feature')
    if (supplied.uncannyDodge && supplied.deflectMissilesD10 != null) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!hit) {
      if (supplied.standAgainstTide) {
        if (attackDefinition.mode === 'ranged' || !attackDefinition.reachFeet) {
          return fail(state, events, 'invalid-class-feature')
        }
        const repeated = resolveStandAgainstTideRepeat({
          state,
          attacker: actor,
          hunter: target,
          attackModifier: attackDefinition.toHit,
          reachFeet: attackDefinition.reachFeet,
          damage: attackDefinition.damage,
          use: supplied.standAgainstTide,
          events,
        })
        if (!repeated.ok) return repeated
      }
      continue
    }
    if (supplied.damageRolls.length !== attackDefinition.damage.length) return fail(state, events, 'invalid-dice')
    let totalDamage = 0
    try {
      const rawDamage: Array<{ total: number; type: Dnd5eDamageType }> = []
      for (let damageIndex = 0; damageIndex < attackDefinition.damage.length; damageIndex += 1) {
        const damageDefinition = attackDefinition.damage[damageIndex]
        const resolved = rules.resolveDamage({
          count: damageDefinition.count,
          sides: damageDefinition.sides,
          bonus: damageDefinition.bonus,
          rolls: supplied.damageRolls[damageIndex],
          critical,
        })
        rawDamage.push({ total: resolved.total, type: damageDefinition.type })
      }
      let cuttingWordsReduction = consumeCuttingWords(state, actor, supplied.cuttingWordsDamage, events)
      if (cuttingWordsReduction == null) return fail(state, events, 'invalid-class-feature')
      for (const component of rawDamage) {
        const reduction = Math.min(component.total, cuttingWordsReduction)
        cuttingWordsReduction -= reduction
        totalDamage += adjustDamageForTarget(target, component.total - reduction, component.type)
      }
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    const uncannyDamage = applyUncannyDodge(target, totalDamage, supplied.uncannyDodge, events)
    if (uncannyDamage == null) return fail(state, events, 'invalid-class-feature')
    const finalDamage = applyDeflectMissiles(
      state,
      actor,
      target,
      uncannyDamage,
      attackDefinition.mode === 'ranged',
      supplied.deflectMissilesD10,
      attackDefinition.damage[0]?.type,
      events,
    )
    if (finalDamage == null) return fail(state, events, 'invalid-class-feature')
    applyDamage(target, finalDamage, critical, events, actor, state, attackDefinition.damage.map((entry) => entry.type))
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
  }
  return { ok: true, state, events }
}

function resolveHunterMultiattack(
  state: Dnd5eHeadlessCombatState,
  action: Extract<Dnd5eAction, { type: 'ranger-hunter-multiattack' }>,
  events: Dnd5eCombatEvent[],
): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  if (
    !actor || actor.currentHp <= 0 || actor.classId !== 'ranger' || actor.subclassId !== 'hunter' || actor.level < 11 ||
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
    !actor || actor.classId !== 'monk' || actor.level < (action.mode === 'flurry' ? 2 : 1) ||
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
    (action.mode !== 'flurry' || actor.subclassId !== 'open-hand' || actor.level < 3)
  ) return fail(state, events, 'invalid-class-feature')
  if (
    quiveringPalmAttempts > 1 ||
    (quiveringPalmAttempts > 0 && (actor.subclassId !== 'open-hand' || actor.level < 17))
  ) return fail(state, events, 'invalid-class-feature')
  const committedKi = (action.mode === 'flurry' ? 1 : 0) + stunningStrikeAttempts + quiveringPalmAttempts * 3
  if (
    (action.mode === 'flurry' && (!ki || ki.current < 1)) ||
    ((stunningStrikeAttempts > 0 || quiveringPalmAttempts > 0) && (!ki || ki.current < committedKi)) ||
    (stunningStrikeAttempts > 0 && actor.level < 5)
  ) return fail(state, events, 'class-resource-unavailable')
  if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
  if (action.mode === 'flurry') spendClassResource(actor, 'dnd5e-ki', events)
  endTranquilityForHostileAction(actor, events)
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
        dnd5eAttackerIsUnseen(actor) || targetProne)
    const viciousMockeryDisadvantage = consumeViciousMockeryAttackDisadvantage(actor, events)
    const targetImposesDisadvantage = !!target.classState.dodgingTurnKey || viciousMockeryDisadvantage || actor.exhaustionLevel >= 3 || dnd5eIsIntimidated(actor) ||
      dnd5eUnseenTargetImposesDisadvantage(actor, target) || actorProne
    const mode: D20RollMode = targetGrantsAdvantage === targetImposesDisadvantage
      ? 'normal'
      : targetGrantsAdvantage
        ? 'advantage'
        : 'disadvantage'
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
    const shieldSpellApplied = applyShieldSpellReaction(target, supplied.shieldSpellReaction, hit, events)
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
    !actor || actor.classId !== 'monk' || actor.subclassId !== 'open-hand' || actor.level < 17 ||
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
    actor.classId !== 'monk' || actor.level < 3 ||
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
  endTranquilityForHostileAction(actor, events)

  const requestedMode = action.mode ?? 'normal'
  const targetGrantsAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
    (dnd5eTargetGrantsAttackAdvantage(target) || requestedMode === 'advantage' || !!target.classState.stunnedByActorId || dnd5eAttackerIsUnseen(actor))
  const actorHasDisadvantage = requestedMode === 'disadvantage' || action.distanceFeet > 20 || actor.exhaustionLevel >= 3 ||
    dnd5eHasViciousMockeryAttackDisadvantage(actor) || dnd5eIsIntimidated(actor) ||
    dnd5eUnseenTargetImposesDisadvantage(actor, target)
  const mode: D20RollMode = targetGrantsAdvantage === actorHasDisadvantage
    ? 'normal'
    : targetGrantsAdvantage ? 'advantage' : 'disadvantage'
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
  events.push({
    type: 'class-state-changed', actorId: actor.id, targetId: target.id,
    stateKey: 'deflect-missiles-catch', active: false,
  })
  if (!hit) return { ok: true, state, events }
  let damage
  try {
    damage = rules.resolveDamage({
      count: 1,
      sides: dnd5eMonkMartialArtsDie(actor.level),
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
  const classDefinition = actor?.classId ? dnd5eClassDefinition(actor.classId) : undefined
  const spellcasting = classDefinition?.spellcasting
  if (
    !actor || !actor.classId || !spellcasting ||
    typeof action.spellId !== 'string' || !action.spellId.trim() || action.spellId.length > 160 ||
    typeof action.spellName !== 'string' || !action.spellName.trim() || action.spellName.length > 160 ||
    !Number.isInteger(action.spellLevel) || action.spellLevel < 0 || action.spellLevel > 9 ||
    !Number.isInteger(action.slotLevel) || action.slotLevel < 0 || action.slotLevel > 9 ||
    (action.castingTime !== 'action' && action.castingTime !== 'bonus-action') ||
    action.effects.length > 32 ||
    !Object.values(actor.classSelections).some((ids) => ids.includes(action.spellId))
  ) return fail(state, events, 'invalid-class-feature')
  if (actor.classState.wildShapeFormId && (actor.classId !== 'druid' || actor.level < 18)) {
    return fail(state, events, 'invalid-class-feature')
  }

  const freeCastSource = dnd5eFreeSpellCastSource(
    actor,
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
        : action.slotLevel !== dnd5ePactSlotLevel(actor.level)
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

  for (const effect of action.effects) {
    const target = state.combatants[effect.targetId]!
    if (effect.operation === 'damage') {
      // The DM supplies the final post-save/post-resistance amount.
      applyDamage(target, effect.amount ?? 0, false, events, actor, state)
    } else if (effect.operation === 'healing') {
      applyHealing(target, effect.amount ?? 0, events)
    } else if (effect.operation === 'temporary-hit-points') {
      const before = target.temporaryHp
      target.temporaryHp = Math.max(before, effect.amount ?? 0)
      const gained = target.temporaryHp - before
      if (gained > 0) {
        events.push({ type: 'temporary-hit-points-gained', actorId: target.id, amount: gained, current: target.temporaryHp })
      }
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
        : { type: 'permanent' as const }
      const incoming: Dnd5eActiveEffectInstance = standard
        ? { ...createDnd5eConditionEffect({
            id: `adjudicated:${action.spellId}:${actor.id}:${target.id}:${standard}`,
            condition: standard,
            targetId: target.id,
            source: { kind: 'spell', actorId: actor.id, actorName: actor.name, rulesId: action.spellId, label: action.spellName },
            duration,
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
            stackingKey: `adjudicated:${action.spellId}:${addCondition}`,
            stackingPolicy: 'refresh-duration',
            visibility: 'public',
          })
      const mutation = applyDnd5eActiveEffect({
        effects: reconciledDnd5eActiveEffects(target),
        incoming,
        conditionImmunities: target.conditionImmunities,
      })
      if (mutation.status !== 'rejected-immune') {
        commitDnd5eActiveEffects(target, mutation.effects)
        events.push({ type: mutation.status === 'refreshed' ? 'active-effect-refreshed' : 'active-effect-applied', targetId: target.id, effectId: incoming.id, definitionId: incoming.definitionId })
        events.push({ type: 'condition-applied', actorId: actor.id, targetId: target.id, condition: addCondition })
      }
    }
  }

  const affectedTargetIds = [...new Set(action.effects.map((effect) => effect.targetId))]
  if (concentrationRounds != null) {
    beginDnd5eConcentration(state, actor, action.spellId, affectedTargetIds, concentrationRounds, events)
  }
  events.push({
    type: 'spell-cast', actorId: actor.id,
    targetId: affectedTargetIds[0] ?? actor.id,
    spellId: action.spellId, slotLevel: action.slotLevel,
  })
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
      if (
        targeting.rangeFeet != null &&
        (!Number.isFinite(action.distanceFeet) || (action.distanceFeet ?? -1) < 0 ||
          (action.distanceFeet ?? Number.POSITIVE_INFINITY) > targeting.rangeFeet)
      ) return fail(state, events, 'invalid-target')
      pluginTargets = [pluginTarget]
    } else {
      const uniqueIds = [...new Set(action.targetIds ?? [])]
      if (
        (uniqueIds.length < 1 && !pluginFeature.action.persistentArea) ||
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
        !resource || resource.ownerPluginId !== action.pluginId || resource.classId !== actor.classId ||
        actor.level < (resource.minimumLevel ?? 1) ||
        (resource.subclassId != null && resource.subclassId !== actor.subclassId) ||
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
      const before = target.temporaryHp
      target.temporaryHp = Math.max(before, operation.amount)
      const gained = target.temporaryHp - before
      if (gained > 0) {
        events.push({
          type: 'temporary-hit-points-gained',
          actorId: target.id,
          amount: gained,
          current: target.temporaryHp,
        })
      }
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
  if (!actor || !target || target.currentHp <= 0) return fail(state, events, 'invalid-target')
  if (!input.areaId || !input.trigger.id) return fail(state, events, 'invalid-plugin-action')

  let saveSuccess: boolean | undefined
  if (input.trigger.savingThrow) {
    if (!Number.isInteger(input.d20) || input.d20! < 1 || input.d20! > 20) {
      return fail(state, events, 'invalid-dice')
    }
    const { ability, dc } = input.trigger.savingThrow
    const mode = dnd5eSavingThrowMode(target, ability, { effectVisible: true })
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
      amount = input.trigger.savingThrow?.onSuccess === 'half' ? Math.floor(amount / 2) : 0
    }
    appliedDamage = adjustDamageForTarget(target, amount, damage.type)
    appliedDamage = adjustedPersistentAreaDamage(appliedDamage, input.dmAdjustment?.damage)
    applyDamage(target, appliedDamage, false, events, actor, state, [damage.type])
  } else if ((input.damageRolls?.length ?? 0) > 0 || input.dmAdjustment?.damage) {
    return fail(state, events, 'invalid-dice')
  }

  let conditionApplied: Dnd5eStandardConditionId | undefined
  const condition = input.trigger.condition
  if (
    condition && !saveSuccess &&
    !input.dmAdjustment?.blockedConditionIds?.includes(condition.condition)
  ) {
    const applied = applyDnd5eStandardConditionEffect(target, actor, {
      id: dnd5eActiveEffectId(
        `plugin-area:${input.areaId}:${input.trigger.id}`,
        actor.id,
        target.id,
        condition.condition,
      ),
      rulesId: `plugin-area:${input.areaId}:${input.trigger.id}`,
      appliedTurnKey: classFeatureTurnKey(state, target.id),
      condition: condition.condition,
      duration: dnd5eCapabilityDuration(condition.duration),
      repeatSave: condition.duration.expiresAt === 'target-turn-end-save' && condition.duration.saveAbility && condition.duration.saveDc
        ? {
            ability: condition.duration.saveAbility,
            dc: condition.duration.saveDc,
            timing: 'target-turn-end',
            onSuccess: 'remove',
          }
        : undefined,
      sourceKind: 'plugin',
    }, events)
    if (applied) conditionApplied = condition.condition
  }
  events.push({
    type: 'persistent-area-triggered', actorId: actor.id, targetId: target.id,
    areaId: input.areaId, triggerId: input.trigger.id, timing: input.trigger.timing,
    saveSuccess, damage: appliedDamage, conditionApplied,
  })
  return { ok: true, state, events }
}

function resolveDnd5eHeadlessActionInternal(source: Dnd5eHeadlessCombatState, action: Dnd5eAction): Dnd5eActionResult {
  const state = clone(source)
  const events: Dnd5eCombatEvent[] = []
  if (!state.active) return fail(state, events, 'combat-ended')
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
  const offTurn = action.type === 'opportunity-attack' || action.type === 'concentration-save' ||
    action.type === 'barbarian-relentless-rage-save' || action.type === 'monk-deflect-missiles-return' ||
    action.type === 'monster-undead-fortitude-save' || action.type === 'monster-on-hit-save' ||
    (action.type === 'plugin' && pluginAction?.allowOffTurn === true)
  if (!offTurn && currentActorId(state) !== action.actorId) return fail(state, events, 'stale-turn')
  const actor = state.combatants[action.actorId]
  if (!actor || (
    actor.currentHp <= 0 && action.type !== 'death-save' && action.type !== 'end-turn' &&
    action.type !== 'barbarian-relentless-rage-save' && action.type !== 'monster-undead-fortitude-save'
  )) return fail(state, events, 'invalid-actor')
  if (
    dnd5eIsIncapacitated(actor) &&
    action.type !== 'end-turn' && action.type !== 'death-save' && action.type !== 'concentration-save' &&
    action.type !== 'monster-undead-fortitude-save' && action.type !== 'monster-on-hit-save'
  ) return fail(state, events, 'invalid-actor')
  if (
    dnd5eCombatantIsBanished(actor) &&
    action.type !== 'end-turn' && action.type !== 'death-save' &&
    action.type !== 'monster-undead-fortitude-save' && action.type !== 'monster-on-hit-save'
  ) return fail(state, events, 'invalid-actor')
  if (
    actor.classState.turnedByClericId &&
    action.type !== 'move' && action.type !== 'dash' && action.type !== 'dodge' &&
    action.type !== 'end-turn' && action.type !== 'death-save' && action.type !== 'concentration-save' &&
    action.type !== 'monster-undead-fortitude-save' && action.type !== 'monster-on-hit-save'
  ) return fail(state, events, 'invalid-actor')

  // 地图层按动作重建 Headless 快照，因此回合开始效果也必须能在本回合首个事务中幂等清理；
  // 这样即使上一位是自动怪物或 DM 直接推进先攻，也不会把过期效果带入实际判定。
  advanceDnd5eActiveEffectsAtBoundary({ state, actor, point: 'start', events })

  const usesHideInPlainSight = action.type === 'ranger-vanish' ||
    (action.type === 'rogue-cunning-action' && action.option === 'hide') ||
    (action.type === 'ability-check' && action.skill === 'stealth')
  const preservesHideInPlainSight = action.type === 'ranger-hide-in-plain-sight' || usesHideInPlainSight ||
    action.type === 'end-turn' || action.type === 'death-save' || action.type === 'concentration-save' ||
    action.type === 'barbarian-relentless-rage-save' || action.type === 'monster-undead-fortitude-save' ||
    action.type === 'monster-on-hit-save'
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
          (uniqueIds.length < 1 && !pluginFeature.action.persistentArea) ||
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
          const before = target.temporaryHp
          target.temporaryHp = Math.max(before, Math.max(0, Math.floor(amount)))
          const gained = target.temporaryHp - before
          if (gained > 0) {
            events.push({
              type: 'temporary-hit-points-gained',
              actorId: target.id,
              amount: gained,
              current: target.temporaryHp,
            })
          }
          return gained
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
            !definition || definition.ownerPluginId !== action.pluginId || definition.classId !== actor.classId ||
            actor.level < (definition.minimumLevel ?? 1) ||
            (definition.subclassId != null && definition.subclassId !== actor.subclassId)
          ) return false
          return spendClassResource(actor, resourceId, events, amount)
        },
        restoreResource(resourceId, amount = 1) {
          const definition = dnd5ePluginResourceDefinition(resourceId)
          const resource = actor.classResources[resourceId]
          if (
            !definition || definition.ownerPluginId !== action.pluginId || definition.classId !== actor.classId ||
            actor.level < (definition.minimumLevel ?? 1) ||
            (definition.subclassId != null && definition.subclassId !== actor.subclassId) ||
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
      actor.classId !== 'warlock' || actor.subclassId !== 'fiend' || actor.level < 14 ||
      (action.active && (!resource || resource.current < 1))
    ) return fail(state, events, 'invalid-class-feature')
    actor.classState.hurlThroughHellReady = action.active || undefined
    events.push({
      type: 'class-state-changed', actorId: actor.id,
      stateKey: 'hurl-through-hell-ready', active: action.active,
    })
    return { ok: true, state, events }
  }

  if (action.type === 'item-area-trigger') {
    const dc = action.areaKind === 'ball-bearings' ? 10 : action.areaKind === 'caltrops' ? 15 : 13
    const mode = dnd5eSavingThrowMode(actor, 'dex', { effectVisible: true })
    const rolls = mode === 'normal' ? [action.d20] : [action.d20, action.d20Second ?? 0]
    let save
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

  if (action.type === 'monster-action') return resolveMonsterAction(state, action, events)
  if (action.type === 'cast-spell') return resolveSpellCast(state, action, events)
  if (action.type === 'adjudicated-spell') return resolveAdjudicatedSpell(state, action, events)
  if (action.type === 'monk-unarmed-bonus') return resolveMonkUnarmedBonus(state, action, events)
  if (action.type === 'monk-quivering-palm-release') return resolveMonkQuiveringPalmRelease(state, action, events)
  if (action.type === 'monk-deflect-missiles-return') return resolveMonkDeflectMissilesReturn(state, action, events)
  if (action.type === 'monk-quivering-palm-end') {
    if (
      actor.classId !== 'monk' || actor.subclassId !== 'open-hand' || actor.level < 17 ||
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
      actor.classId !== 'barbarian' || actor.level < 11 || !actor.classState.raging || actor.currentHp !== 0 ||
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
    actor.currentHp = Math.min(actor.maxHp, actor.currentHp + action.d10 + actor.level)
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
    if (
      actor.classId !== 'druid' || actor.level < 2 || !form || !knownForms.includes(form.id) ||
      !dnd5eWildShapeFormAllowedForLevel(actor.level, form)
    ) return fail(state, events, 'invalid-class-feature')
    if (actor.level < 20 && (!uses || uses.current < 1)) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    if (actor.level < 20) spendClassResource(actor, 'dnd5e-wild-shape', events)

    const alreadyShaped = !!actor.classState.wildShapeFormId
    actor.classState = {
      ...actor.classState,
      wildShapeFormId: form.id,
      wildShapeCurrentHp: form.hitPoints.average,
      wildShapeRoundsRemaining: dnd5eWildShapeDurationHours(actor.level) * 600,
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
    if (actor.classId !== 'druid' || !actor.classState.wildShapeFormId) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    revertDnd5eWildShape(actor, 0, events)
    return { ok: true, state, events }
  }
  if (action.type === 'barbarian-rage') {
    if (action.end) {
      if (action.frenzy || actor.classId !== 'barbarian' || !actor.classState.raging) {
        return fail(state, events, 'invalid-class-feature')
      }
      if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
      events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
      endBarbarianRage(actor, events)
      return { ok: true, state, events }
    }
    const rage = actor.classResources['dnd5e-rage']
    if (action.frenzy && (actor.subclassId !== 'berserker' || actor.level < 3)) return fail(state, events, 'invalid-class-feature')
    if (actor.classId !== 'barbarian' || actor.wearingHeavyArmor || actor.classState.raging) return fail(state, events, 'invalid-class-feature')
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
    }
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'rage', active: true, value: 10 })
    return { ok: true, state, events }
  }
  if (action.type === 'barbarian-intimidating-presence') {
    const target = state.combatants[action.targetId]
    if (
      actor.classId !== 'barbarian' || actor.subclassId !== 'berserker' || actor.level < 10 ||
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
      if (actor.classId !== 'rogue' || actor.level < 2) return fail(state, events, 'invalid-class-feature')
    } else if (action.type === 'ranger-vanish') {
      if (actor.classId !== 'ranger' || actor.level < 14) return fail(state, events, 'invalid-class-feature')
    } else {
      if (action.option !== 'dash' && action.option !== 'disengage') return fail(state, events, 'invalid-class-feature')
      const ki = actor.classResources['dnd5e-ki']
      if (actor.classId !== 'monk' || actor.level < 2) return fail(state, events, 'invalid-class-feature')
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
      const supremeSneak = actor.subclassId === 'thief' && actor.level >= 9 && movementSpent <= effectiveSpeed / 2
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
  if (action.type === 'rogue-fast-hands') {
    if (actor.classId !== 'rogue' || actor.subclassId !== 'thief' || actor.level < 3) {
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
      actor.classId !== 'ranger' || actor.level < 2 || !actor.concentrating || !previousTargetId ||
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
    if (actor.classId !== 'monk' || actor.level < 7) return fail(state, events, 'invalid-class-feature')
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
    if (actor.classId !== 'monk' || actor.level < 18 || (actor.classState.emptyBodyRoundsRemaining ?? 0) > 0) {
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
    if (actor.classId !== 'monk' || actor.level < 2) return fail(state, events, 'invalid-class-feature')
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
    if (actor.classId !== 'paladin' || actor.subclassId !== 'devotion' || actor.level < 3) return fail(state, events, 'invalid-class-feature')
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
    if (actor.classId !== 'paladin' || actor.level < 1 || uniqueTargets.size !== action.targetIds.length) {
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
      actor.classId !== 'ranger' || actor.level < 3 ||
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
    if (actor.classId !== 'ranger' || actor.level < 10) return fail(state, events, 'invalid-class-feature')
    actor.classState.hideInPlainSightPrepared = true
    events.push({ type: 'class-state-changed', actorId: actor.id, stateKey: 'hide-in-plain-sight', active: true, value: 10 })
    return { ok: true, state, events }
  }
  if (action.type === 'cleric-turn-undead') {
    const channel = actor.classResources['dnd5e-channel-divinity']
    const uniqueTargets = new Set(action.targets.map((target) => target.targetId))
    if (
      actor.classId !== 'cleric' || actor.level < 2 || uniqueTargets.size !== action.targets.length ||
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

    const destroyThreshold = dnd5eDestroyUndeadMaximumChallenge(actor.level)
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
        clearTurnUndead(save.target, events)
        save.target.currentHp = 0
        save.target.concentrating = false
        save.target.classState.undeadFortitudePending = undefined
        save.target.classState.monsterOnHitSavePending = undefined
        save.target.deathSaves = { successes: 0, failures: 0, stable: false, dead: true }
        save.target.classState.concentrationSpellId = undefined
        save.target.classState.concentrationTargetIds = undefined
        save.target.classState.concentrationRoundsRemaining = undefined
        save.target.classState.huntersMarkTargetId = undefined
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
      actor.classId !== 'paladin' || actor.subclassId !== 'devotion' || actor.level < 3 ||
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
    if (actor.classId !== 'bard' || !target || target.id === actor.id || target.currentHp <= 0 || target.classState.bardicInspirationDie) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!inspiration || inspiration.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    spendClassResource(actor, 'dnd5e-bardic-inspiration', events)
    const die = dnd5eBardicInspirationDie(actor.level)
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
    if (actor.classId !== 'bard' || actor.level < 6 || dnd5eIsIncapacitated(actor)) {
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
      actor.classId !== 'paladin' || !target || target.currentHp <= 0 || target.deathSaves.dead ||
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
      actor.classId !== 'paladin' || actor.level < 14 || !target || !source ||
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
    if (actor.classId !== 'monk' || actor.subclassId !== 'open-hand' || actor.level < 6 || actor.currentHp >= actor.maxHp) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!use || use.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    spendClassResource(actor, 'dnd5e-wholeness-of-body', events)
    applyHealing(actor, actor.level * 3, events)
    return { ok: true, state, events }
  }
  if (action.type === 'cleric-preserve-life') {
    const channel = actor.classResources['dnd5e-channel-divinity']
    const allocations = action.allocations
    const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    const uniqueTargets = new Set(allocations.map((allocation) => allocation.targetId))
    if (
      actor.classId !== 'cleric' || actor.subclassId !== 'life' || actor.level < 2 || allocations.length === 0 ||
      uniqueTargets.size !== allocations.length || !Number.isInteger(total) || total <= 0 || total > actor.level * 5
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
    const automatic = actor.level >= 20
    if (
      actor.classId !== 'cleric' || actor.level < 10 || (actor.classState.divineInterventionCooldownDays ?? 0) > 0 ||
      (!automatic && (!Number.isInteger(action.d100) || (action.d100 ?? 0) < 1 || (action.d100 ?? 0) > 100))
    ) return fail(state, events, 'invalid-class-feature')
    if (!use || use.current < 1) return fail(state, events, 'class-resource-unavailable')
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    const success = automatic || (action.d100 ?? 101) <= actor.level
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
      actor.classId !== 'paladin' || actor.subclassId !== 'devotion' || actor.level < 20 ||
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
    if (actor.classId !== 'sorcerer' || actor.level < 2 || !points || points.current < cost || !slot || slot.current >= slot.max) {
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
      actor.classId !== 'sorcerer' || actor.level < 2 || !Number.isInteger(slotLevel) || slotLevel < 1 || slotLevel > 9 ||
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
      actor.classId !== 'sorcerer' || actor.subclassId !== 'draconic' || actor.level < 14 ||
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
      actor.classId !== 'sorcerer' || actor.subclassId !== 'draconic' || actor.level < 18 ||
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
      !source || !mode || source.classId !== 'sorcerer' || source.subclassId !== 'draconic' || source.level < 18 ||
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
        actor.classState.concentrationEffectsBySource = {
          ...(actor.classState.concentrationEffectsBySource ?? {}),
          [source.id]: effectId!,
        }
        source.classState.concentrationTargetIds = [...new Set([
          ...(source.classState.concentrationTargetIds ?? []), actor.id,
        ])]
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
        if (mutation.status !== 'rejected-immune') commitDnd5eActiveEffects(actor, mutation.effects)
        events.push({ type: 'condition-applied', actorId: source.id, targetId: actor.id, condition })
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
    if (fearSource) {
      const currentDistanceSquared = (actor.position.x - fearSource.position.x) ** 2 + (actor.position.y - fearSource.position.y) ** 2
      const nextDistanceSquared = (action.to.x - fearSource.position.x) ** 2 + (action.to.y - fearSource.position.y) ** 2
      if (nextDistanceSquared < currentDistanceSquared) return fail(state, events, 'invalid-class-feature')
    }
    const isProne = actor.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
    if (!!action.standFromProne !== isProne) return fail(state, events, 'invalid-class-feature')
    const standCost = isProne ? Math.floor(dnd5eEffectiveSpeed(actor) / 2) : 0
    const defaultMovementCost = action.distance * (action.carefulMovement ? 2 : 1) + standCost
    const movementCost = action.movementCost == null ? defaultMovementCost : action.movementCost
    if (!Number.isFinite(movementCost) || movementCost < action.distance || movementCost < standCost) {
      return fail(state, events, 'invalid-class-feature')
    }
    if (!spend(actor, 'movement', movementCost)) return fail(state, events, 'insufficient-movement')
    if (isProne) removeDnd5eConditionEffects(actor, ['prone', '倒地'], 'dm', events)
    const from = { ...actor.position }
    actor.position = { ...action.to }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'movement', amount: movementCost })
    events.push({ type: 'moved', actorId: actor.id, from, to: actor.position, distance: action.distance })
    if (action.distance > 0) triggerDnd5eActiveEffectBreak(actor, 'moves', events)
    return { ok: true, state, events }
  }
  if (action.type === 'dash') {
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    actor.turn = { ...actor.turn, movementRemaining: actor.turn.movementRemaining + dnd5eEffectiveSpeed(actor) }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    return { ok: true, state, events }
  }
  if (action.type === 'disengage' || action.type === 'dodge') {
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    actor.disengaged = action.type === 'disengage'
    actor.dodging = action.type === 'dodge'
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    return { ok: true, state, events }
  }

  if (action.type === 'end-turn' && !resolveDnd5eActiveEffectSaves({
    state,
    target: actor,
    timing: 'target-turn-end',
    supplied: action.activeEffectSavingThrows,
    events,
  })) return fail(state, events, 'invalid-dice')

  if (action.type === 'end-turn' && actor.classState.raging) {
    const remaining = Math.max(0, (actor.classState.rageTurnsRemaining ?? 0) - 1)
    const continues = remaining > 0 && (actor.level >= 15 || actor.classState.rageSustainedThisTurn === true)
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
    advanceDnd5eActiveEffectsAtBoundary({ state, actor, point: 'end', events })
  }

  const wrapped = state.initiativeIndex + 1 >= state.initiativeOrder.length
  state.initiativeIndex = wrapped ? 0 : state.initiativeIndex + 1
  if (wrapped) state.round += 1
  const nextId = currentActorId(state)
  const next = nextId ? state.combatants[nextId] : undefined
  if (next) {
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
    next.disengaged = false
    events.push({ type: 'turn-started', actorId: next.id, round: state.round })
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
        if (!source || !mode || !source.concentrating || source.currentHp <= 0) continue
        events.push({
          type: 'draconic-presence-save-required', targetId: next.id, sourceId: source.id, mode,
          dc: 8 + source.proficiencyBonus + rules.abilityModifier(source.abilities.cha),
        })
      }
    }
    if (
      next.classId === 'fighter' && next.subclassId === 'champion' && next.level >= 18 &&
      next.currentHp > 0 && next.currentHp <= next.maxHp / 2
    ) {
      applyHealing(next, Math.max(0, 5 + rules.abilityModifier(next.abilities.con)), events)
    }
  }
  return { ok: true, state, events }
}

/**
 * 所有 Headless 行动的统一状态后置条件。2014 规则规定失能会立即结束专注；
 * 该检查位于事务边界，因此法术、职业、怪物、DM 与插件状态写入都无法绕过。
 */
export function resolveDnd5eHeadlessAction(source: Dnd5eHeadlessCombatState, action: Dnd5eAction): Dnd5eActionResult {
  const result = resolveDnd5eHeadlessActionInternal(source, action)
  if (!result.ok) return result
  const events = [...result.events]
  for (const combatant of Object.values(result.state.combatants)) {
    if ((combatant.concentrating || combatant.classState.concentrationSpellId) && dnd5eIsIncapacitated(combatant)) {
      endDnd5eConcentration(result.state, combatant, events)
    }
  }
  return { ...result, events }
}
