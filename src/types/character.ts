import type { AbilityKey } from '../lib/dnd'
import type { Dnd5eActiveEffectInstance } from '../rulesets/dnd5e/activeEffects'
import type { DND5E_COMBAT_STATE_SCHEMA_VERSION } from '../rulesets/dnd5e/activeEffects'
import type { CharacterEquipment } from './equipment'
import type { Dnd5eInventory } from './inventory'

export type Abilities = Record<AbilityKey, number>

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

  race: string
  /** 可选的完整插件命名空间种族 ID；race 保留可读名称。 */
  dnd5eRaceId?: string
  charClass: string
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
  /** 仅由 5e Headless 权威事务写入的战斗中职业状态。 */
  dnd5eCombatState?: {
    schemaVersion?: typeof DND5E_COMBAT_STATE_SCHEMA_VERSION
    /** 权威状态实例；旧 conditions 字符串仅作为兼容投影。 */
    activeEffects?: Dnd5eActiveEffectInstance[]
    /** 铁蒺藜伤势造成的速度减值；恢复至少 1 点生命值时由 Headless 清除。 */
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
      ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
      dc: number
      condition: 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious'
    }
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
    /** 神圣干预成功后的冷却天数；一次长休按经过一天递减。 */
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
    /** 成功躲藏后的检定结果；进行攻击时由 Headless 清除。 */
    hiddenCheckTotal?: number
    /** 游侠10级“隐匿无踪”已完成一分钟伪装；移动或执行其他动作后失效。 */
    hideInPlainSightPrepared?: boolean
    bonusActionSpellTurnKey?: string
    leveledSpellTurnKey?: string
    concentrationSpellId?: string
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
