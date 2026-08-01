import type { AbilityKey } from '../lib/dnd'
import type { Dnd5eActiveEffectInstance } from '../rulesets/dnd5e/activeEffects'
import type { DND5E_COMBAT_STATE_SCHEMA_VERSION } from '../rulesets/dnd5e/activeEffects'
import type { Dnd5eHitPointMaximumReductionLedger } from '../rulesets/dnd5e/hitPointMaximumReductions'
import type { Dnd5eClassId } from '../rulesets/dnd5e/classes'
import type { CharacterEquipment } from './equipment'
import type { Dnd5eInventory } from './inventory'

export type Abilities = Record<AbilityKey, number>

export type Dnd5eAdvancementHitPointMethod = 'fixed' | 'rolled'

export interface Dnd5eAdvancementAbilityScoreChoice {
  kind: 'ability-score'
  increases: Partial<Record<AbilityKey, number>>
}

export interface Dnd5eAdvancementFeatChoice {
  kind: 'feat'
  featId: string
}

export type Dnd5eAdvancementAsiChoice =
  | Dnd5eAdvancementAbilityScoreChoice
  | Dnd5eAdvancementFeatChoice

export interface Dnd5eAdvancementSpellSelectionsV1 {
  /** 本职业升级确认后的完整戏法列表。 */
  cantrips: string[]
  /** “已知法术”职业升级确认后的完整已知法术列表。 */
  knownSpells?: string[]
  /** 法师升级确认后的完整法术书；冒险中抄录的既有法术必须保留。 */
  wizardSpellbook?: string[]
}

export interface Dnd5eLevelAdvancementDecisionV1 {
  schemaVersion: 1
  classId:
    | 'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk'
    | 'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard'
  levelsGained: number
  hitPointMethod: Dnd5eAdvancementHitPointMethod
  hitPointRolls: number[]
  subclassId?: string
  asiChoices: Array<{
    classLevel: number
    choice: Dnd5eAdvancementAsiChoice
  }>
  classChoiceSelections?: Record<string, string[]>
  fighterFightingStyles?: Array<
    'archery' | 'defense' | 'dueling' | 'great-weapon-fighting' | 'protection' | 'two-weapon-fighting'
  >
  fighterSubclassSelections?: Record<string, string[]>
  spellSelections?: Dnd5eAdvancementSpellSelectionsV1
}

export interface Dnd5eLevelAdvancementSnapshotV1 {
  level: number
  dnd5eClassLevels?: Character['dnd5eClassLevels']
  abilities: Abilities
  skills: string[]
  dnd5eClassChoices?: Character['dnd5eClassChoices']
  dnd5eFeatIds?: string[]
  hitPointMaximumMode?: 'fixed' | 'manual'
  hitPointRolls?: number[]
  hitPointDice?: Array<{ sides: number; current: number; max: number }>
  maxHp: number
  currentHp: number
}

export interface Dnd5eLevelAdvancementRevisionV1 {
  revisedAt: number
  revisedBy: 'dm'
  /** 旧记录可能保留修订说明；新修订不再要求 DM 填写。 */
  reason?: string
  previousDecision: Dnd5eLevelAdvancementDecisionV1
}

export interface Dnd5eLevelAdvancementRecordV1 {
  schemaVersion: 1
  id: string
  fromLevel: number
  toLevel: number
  classId: Dnd5eLevelAdvancementDecisionV1['classId']
  fromClassLevel: number
  toClassLevel: number
  completedAt: number
  completedBy: 'player' | 'dm'
  decision: Dnd5eLevelAdvancementDecisionV1
  grantedFeatureIds: string[]
  before: Dnd5eLevelAdvancementSnapshotV1
  after: Dnd5eLevelAdvancementSnapshotV1
  revisions?: Dnd5eLevelAdvancementRevisionV1[]
}

export interface Character {
  /** 5.2.1 仅用于识别并迁移旧存档；新数据统一写入 2014 / SRD 5.1。 */
  rulesetId?: 'dnd5e-2014-srd-5.1'
  /** 野蛮人20级“原始斗士”已将力量与体质各提高4；用于防止刷新或等级同步时重复叠加。 */
  dnd5ePrimalChampionApplied?: boolean
  id: string
  name: string
  /** 创建该角色的房间；用于大厅成员名册，不参与 D&D 规则结算。 */
  roomId?: string
  /** 创建该角色的房间成员 ID；DM 只读名册据此关联玩家与角色。 */
  roomMemberId?: string
  /** Stable account owner. Unlike roomMemberId this survives rooms, browsers and devices. */
  ownerAccountId?: string
  player: string
  avatar: string // emoji
  accent: string // tailwind 渐变色起点（用于头像底色）
  /** 统一裁切压缩后的 3:4 人物立绘；随角色存档、导出与账号角色迁移。 */
  portrait?: string
  /** 从完整人物立绘裁切生成的先攻栏取景；缺失时回退使用完整人物立绘。 */
  initiativePortrait?: string
  /** 从完整立绘中手动取景生成的地图 Token。 */
  tokenPortrait?: string

  race: string
  /** 可选的完整插件命名空间种族 ID；race 保留可读名称。 */
  dnd5eRaceId?: string
  /** Persistent mechanical choices made for ancestry-specific racial rules. */
  dnd5eRacialChoices?: {
    dragonbornAncestry?: import('../rulesets/dnd5e/racialAutomation').Dnd5eDragonbornAncestryId
  }
  charClass: string
  /**
   * 2014 兼职职业等级。旧存档缺失时由 charClass + level 自动迁移；
   * level 始终是所有职业等级之和，charClass 保留为首要／起始职业。
   */
  dnd5eClassLevels?: Partial<Record<
    'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk' |
    'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard',
    number
  >> & Partial<Record<string, number>>
  level: number
  background: string
  /** 可选的完整插件命名空间背景 ID；background 保留可读名称。 */
  dnd5eBackgroundId?: string
  /** 背景授予技能的存档快照；插件暂时未加载时仍可显示，房间兼容检查仍会阻止缺包结算。 */
  dnd5eBackgroundSkillProficiencies?: string[]
  alignment?: string // D&D 5e 2014 九大阵营
  experience: number // 经验值
  /** DM 战斗结算收据；用于防止同一 combatId 因重试或断线恢复而重复发放经验。 */
  dnd5eExperienceAwards?: Array<{
    combatId: string
    mapId: string
    xp: number
    awardedAt: number
  }>
  reputation: number // 声望

  abilities: Abilities
  /** 创建向导记录的种族调整前基础值与生成方式；实际结算始终使用 abilities。 */
  dnd5eAbilityGeneration?: {
    method: 'beginner-recommended' | 'standard-array' | 'point-buy' | 'roll-4d6' | `${string}:${string}`
    baseScores: Abilities
    racialBonuses: Abilities
    halfElfChoices?: AbilityKey[]
    racialBonusChoices?: AbilityKey[]
    rolls?: Array<{
      dice: number[]
      discardedIndex?: number
      discardedIndices?: number[]
      total: number
      ability: AbilityKey
    }>
  }
  /** 角色创建向导的可解释推荐记录；仅用于回顾构筑思路，不参与规则结算。 */
  dnd5eCreationRecommendation?: {
    source: 'beginner-questionnaire' | 'build-analysis'
    recommendedClass: string
    selectedClass: string
    classMatchPercent?: number
    primaryAbilities: AbilityKey[]
    selectedRace: string
    recommendedRaces: string[]
    reasons: string[]
  }
  /** 仅在首次建立高等级角色时存在；逐级结算完成后清除。 */
  dnd5eCreationTargetLevel?: number
  savingThrows: AbilityKey[] // 熟练的豁免
  skills: string[] // 熟练的技能 key

  maxHp: number
  currentHp: number
  tempHp: number
  hitDice: string
  /** 固定值会随职业、等级和体质自动重算；manual 保存逐级生命骰结果并自动应用体质调整值。 */
  hitPointMaximumMode?: 'fixed' | 'manual'
  /** manual 模式下各角色等级的原始生命骰面；第 1 级始终规范化为职业生命骰满值。 */
  hitPointRolls?: number[]
  /** D&D 5e 2014 Hit Dice pools. Legacy hitDice is retained only for save migration. */
  hitPointDice?: Array<{ sides: number; current: number; max: number }>
  deathSaveSuccesses?: number
  deathSaveFailures?: number
  deathSaveStable?: boolean
  concentrating?: boolean
  exhaustionLevel?: number
  /** 最近一次实际获得长休收益的战役分钟；用于执行每 24 小时至多一次。 */
  dnd5eLastLongRestWorldMinute?: number
  /** 已应用到该角色的战役时间；支持刷新或断线后幂等补算黎明与长休事务。 */
  dnd5eWorldTimeAppliedMinute?: number
  dnd5eClassChoices?: {
    fighter?: {
      /** Core uses "champion"; third-party values are namespaced by the rules plugin host. */
      subclass?: string
      fightingStyles?: Array<'archery' | 'defense' | 'dueling' | 'great-weapon-fighting' | 'protection' | 'two-weapon-fighting'>
      /** Declarative, namespaced choices supplied by an installed rules plugin. */
      extensionChoices?: Record<string, string[]>
    }
    /** 其余 SRD 职业的声明式选择；键为稳定职业 ID。 */
    classes?: Record<string, {
      subclass?: string
      selections?: Record<string, string[]>
    }>
  }
  /**
   * 用户主动安装的 Rules Plugin 所提供、并由该角色选择的特性 ID。
   * ID 必须保留完整插件命名空间；插件未安装时仍原样保存，不回退为核心规则内容。
   */
  dnd5ePluginFeatureIds?: string[]
  /** Namespaced feats supplied by installed rules packages. */
  dnd5eFeatIds?: string[]
  /**
   * 已确认的逐级升级事务。玩家不能改写既有记录；DM 可修订任意一次升级并重放后续记录。
   */
  dnd5eLevelAdvancements?: Dnd5eLevelAdvancementRecordV1[]
  /** 仅由 5e Headless 权威事务写入的战斗中职业状态。 */
  dnd5eCombatState?: {
    schemaVersion?: typeof DND5E_COMBAT_STATE_SCHEMA_VERSION
    /** 权威状态实例；旧 conditions 字符串仅作为兼容投影。 */
    activeEffects?: Dnd5eActiveEffectInstance[]
    /** 铁蒺藜伤势造成的速度减值；恢复至少 1 点生命值时由 Headless 清除。 */
    caltropsSpeedPenaltyFeet?: number
    /** Stable per-turn attack count used by effects such as Slowing Breath. */
    attacksMadeTurnKey?: string
    attacksMadeThisTurn?: number
    raging?: boolean
    /** 已权威结算的回合开始键（combatId:round:stable slotId）。 */
    turnStartResolvedTurnKey?: string
    /** 本场战斗由 DM 判定为受突袭；自身首回合结束后失效。 */
    surprisedCombatId?: string
    surpriseResolvedCombatId?: string
    frenzying?: boolean
    frenzyStartedTurnKey?: string
    rageTurnsRemaining?: number
    rageSustainedThisTurn?: boolean
    relentlessRageDc?: number
    relentlessRagePendingDc?: number
    /** 狂战士“反击”的一次性权威触发；由造成伤害的 Headless 事务写入。 */
    berserkerRetaliationTrigger?: { sourceId: string; round: number }
    undeadFortitudePending?: { dc: number; damage: number; sourceId?: string }
    monsterOnHitSavePending?: {
      sourceId: string
      actionId: string
      ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
      dc: number
      condition: 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious' | 'disease'
    }
    activeEffectDamageSavePendingIds?: string[]
    /** 当前临时生命值若由英雄气概提供，记录来源以便法术结束时精确撤销。 */
    temporaryHitPointsSource?: { actorId: string; rulesId: 'heroism' | 'enhance-ability' }
    /** Recoverable maximum-HP reductions applied by authoritative combat. */
    hitPointMaximumReductionLedger?: Dnd5eHitPointMaximumReductionLedger
    intimidatingPresenceSourceId?: string
    intimidatingPresenceRoundsRemaining?: number
    intimidatingPresenceImmunityRoundsBySource?: Record<string, number>
    /** 大地结社“自然庇护”：攻击者对各德鲁伊目标的24小时成功豁免免疫。 */
    natureSanctuaryImmunityRoundsByTarget?: Record<string, number>
    /** 驱散亡灵：效果来源牧师的地图 Token ID。 */
    turnedByClericId?: string
    /** 驱散亡灵剩余自身回合数；受到任意伤害时提前结束。 */
    turnedRoundsRemaining?: number
    bardicInspirationDie?: number
    bardicInspirationSourceId?: string
    bardicInspirationRoundsRemaining?: number
    /** 反魅惑演奏持续至吟游诗人下一回合结束；2 表示发动回合与下个回合。 */
    countercharmRoundsRemaining?: number
    sneakAttackTurnKey?: string
    colossusSlayerTurnKey?: string
    divineStrikeTurnKey?: string
    foeSlayerTurnKey?: string
    recklessAttackTurnKey?: string
    monsterReactiveAvailableTurnKey?: string
    monsterReactiveUsedTurnKey?: string
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
    /** 奉献之誓20级“神圣光轮”剩余自身回合数。 */
    holyNimbusRoundsRemaining?: number
    /** 神圣干预成功后的冷却天数；由战役时钟跨过每日黎明递减。 */
    divineInterventionCooldownDays?: number
    monkAttackActionTurnKey?: string
    monkMartialArtsTurnKey?: string
    /** 拨挡飞弹减伤至 0 后，仅在触发该反应的当前战斗时点可掷回。 */
    deflectMissilesCatchSourceId?: string
    deflectMissilesCatchTurnKey?: string
    deflectMissilesCatchDamageType?: 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic' | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder'
    emptyBodyRoundsRemaining?: number
    hordeBreakerOpportunityTurnKey?: string
    hordeBreakerSourceTargetId?: string
    hordeBreakerUsedTurnKey?: string
    multiattackDefenseAttackerId?: string
    multiattackDefenseTurnKey?: string
    stunnedByActorId?: string
    stunnedAppliedTurnKey?: string
    /** 散打技法“不能进行反应”；值记录各来源施加时的回合键，至来源下一回合结束清除。 */
    openHandNoReactionsAppliedTurnKeysBySource?: Record<string, string>
    /** 散打宗 17 级“渗透劲”当前唯一目标的地图 Token ID。 */
    quiveringPalmTargetId?: string
    /** 散打宗 11 级：长休后获得的庇护术效果，攻击或对敌施法后结束。 */
    tranquilityActive?: boolean
    declarativeUsedTurnKeys?: Record<string, string>
    declarativeTransactionIds?: string[]
    battleMasterDroppedWeaponIds?: string[]
    /** Weapon IDs bonded by the audited Eldritch Knight protocol (maximum two). */
    eldritchKnightBondedWeaponIds?: string[]
    /** Action-cantrip entitlement for the level-7 bonus-action weapon attack. */
    eldritchKnightWarMagicCantripTurnKey?: string
    /** Action-spell entitlement for Improved War Magic. */
    eldritchKnightWarMagicTurnKey?: string
    /** Source fighter IDs and the source-turn boundary after which the effect expires. */
    eldritchStrikeBySource?: Record<string, { appliedTurnKey: string; sourceTurnsRemaining: number }>
    /** Action Surge has opened the level-15 teleport window this turn. */
    eldritchKnightArcaneChargeTurnKey?: string
    eldritchKnightArcaneChargeUsedTurnKey?: string
    /** 14级狼图腾：本回合近战命中后可选择击倒的目标。 */
    totemWarriorWolfAttunementTargetIds?: string[]
    totemWarriorWolfAttunementTurnKey?: string
    /** 成功躲藏后的检定结果；进行攻击时由 Headless 清除。 */
    hiddenCheckTotal?: number
    /** 游侠10级“隐匿无踪”已完成一分钟伪装；移动或执行其他动作后失效。 */
    hideInPlainSightPrepared?: boolean
    /** Host-owned current-turn advantage marker sourced from a movable utility projection. */
    utilityProjectionAttackAdvantage?: {
      featureId: string
      targetId: string
      turnKey: string
    }
    /** Host-owned pending advantage for the next eligible d20 resolution. */
    nextD20Advantage?: {
      featureId: string
      rollKinds: Array<'attack' | 'ability-check' | 'saving-throw'>
    }
    postSpellRandomTableCheck?: {
      featureId: string
      spellId: string
      spellLevel: number
      slotLevel: number
      castingClassId: Dnd5eClassId
      forceTable: boolean
    }
    postSpellRandomTableManualAdjudication?: {
      id: string
      featureId: string
      sourceSpellId: string
      tableRoll: number
      outcomeId?: string
    }
    bonusActionSpellTurnKey?: string
    leveledSpellTurnKey?: string
    concentrationSpellId?: string
    concentrationSpellLevel?: number
    concentrationTargetIds?: string[]
    concentrationRoundsRemaining?: number
    concentrationEffectsBySource?: Record<string, string>
    /** 恶言相加：下回合结束前的下一次攻击检定具有劣势。 */
    viciousMockeryAttackDisadvantage?: boolean
    /** 护盾术：直到自身下回合开始 AC +5，并免疫魔法飞弹。 */
    shieldSpellActive?: boolean
    legendaryResistanceUses?: number
    /** 塑能学派“超限导能”自上次长休后的使用次数；长休时清除。 */
    overchannelUsesSinceLongRest?: number
    /** 龙族血脉“元素亲和”当前获得的先祖元素抗性。 */
    draconicResistanceType?: 'acid' | 'cold' | 'fire' | 'lightning' | 'poison'
    /** 元素亲和抗性的剩余回合；600回合等于1小时。 */
    draconicResistanceRoundsRemaining?: number
    draconicWingsActive?: boolean
    /** 龙威豁免成功后，对各术士来源的24小时免疫。 */
    draconicPresenceImmunityRoundsBySource?: Record<string, number>
    /** 怪物骇人威仪豁免后，对该来源的 24 小时免疫。 */
    monsterFrightfulPresenceImmunityRoundsBySource?: Record<string, number>
    /** 怪物动作免疫，键由来源动作或图鉴动作族稳定派生。 */
    monsterActionImmunityRoundsByKey?: Record<string, number>
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
    wildShapeOriginalAbilities?: Abilities
    wildShapeOriginalSavingThrowBonuses?: Partial<Record<AbilityKey, number>>
    wildShapeOriginalStatBlockId?: string
    wildShapeOriginalCreatureType?: string
    wildShapeOriginalDamageVulnerabilities?: string[]
    wildShapeOriginalDamageResistances?: string[]
    wildShapeOriginalDamageImmunities?: string[]
    wildShapeOriginalConditionImmunities?: string[]
  }

  ac: number
  speed: number
  /** 非步行移动速度；由种族、形态、法术或 DM 权威效果提供。 */
  dnd5eMovementSpeeds?: { climb?: number; swim?: number; fly?: number; hover?: boolean }
  initiativeBonus: number // 额外先攻加值（不含敏捷）

  saveDC: number // 豁免 DC
  passivePerception: number // 被动感知
  inspiration: number // 激励骰数量

  conditions: string[] // 状态效果
  backstory?: string // 玩家编写的角色背景故事
  notes: string // 玩家可见笔记

  /** D&D 5e 职业资源与法术位。 */
  classResources?: Record<string, CharacterResourceState>

  /** 已装备物品（武器 / 护甲 / 戒指） */
  equipment?: CharacterEquipment
  /** SRD 5.1 物品实例、数量与穿戴状态；所有跨端变更均由 DM 权威事务写入。 */
  dnd5eInventory?: Dnd5eInventory

  // —— DM 专属 ——
  dmNotes: string // 仅 DM 可见
  visibleToPlayers: boolean // 是否对玩家公开
}

export interface CharacterResourceState {
  current: number
  max: number
}
