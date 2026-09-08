import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { DiceRoll } from '../components/DiceRollOverlay'
import type { AbilityKey } from './dnd'
import type { GridCell } from './gridCombat'
import type { PlayerActionResultSummary } from './playerActionResult'
import type { CombatSettlementMode } from './combatSettlementMode'
import type { Dnd5eMonsterControlWireStateV1 } from './monsterControlState'
import type { Dnd5eMapInteractionPayload } from '../rulesets/dnd5e/mapInteraction'
import type { Dnd5eTraversalMode } from '../rulesets/dnd5e/traversal'
import type { Dnd5eClassId } from '../rulesets/dnd5e/classes'
import type { Dnd5eEffectiveRulesContextV1 } from '../rulesets/dnd5e/effectiveRulesContext'
import type { Dnd5eMagicMouthConfigV1 } from '../rulesets/dnd5e/magicMouth'
import type { Dnd5eDamageType } from '../rulesets/dnd5e/damageTypes'
import type { Dnd5eCreationDeclarationV1 } from '../rulesets/dnd5e/creation'
import type { Dnd5eCreateOrDestroyWaterDeclarationV1 } from '../rulesets/dnd5e/createOrDestroyWater'

export type { Dnd5eCreationDeclarationV1 } from '../rulesets/dnd5e/creation'
export type { Dnd5eCreateOrDestroyWaterDeclarationV1 } from '../rulesets/dnd5e/createOrDestroyWater'

// Shared DM/player state contracts transported through sharedApi.
// Keep these runtime-free so UI, sync helpers, and headless services can depend
// on the same protocol types without importing page modules.
export type Mode = 'dm' | 'player'
export type SharedJsonValue =
  | null
  | boolean
  | number
  | string
  | SharedJsonValue[]
  | { [key: string]: SharedJsonValue }

export interface Dnd5eTurnEconomyCounts {
  turnKey: string
  /** Host-persisted receipts for declarative requirements that allow one use per turn. */
  usedOncePerTurnKeys?: readonly string[]
  /** 本回合已结算的单次武器攻击数，用于在刷新后继续额外攻击。 */
  attacksUsed: number
  action: { current: number; max: number }
  bonusAction: { current: number; max: number }
  reaction: { current: number; max: number }
  /** 每回合一次与环境物件的免费交互；第二次需改用主动动作。 */
  objectInteraction?: { current: number; max: number }
  /** 5e 移动不是动作，也不消耗 AP；这里记录本回合尚可移动的尺数。 */
  movement: { current: number; max: number; spent?: number }
}

export type Dnd5eTurnEconomyByToken = Record<string, Dnd5eTurnEconomyCounts>

export interface SharedCombatFlowPauseV1 {
  schemaVersion: 1
  reason: 'manual' | 'dm-adjudication'
  phase: 'paused' | 'adjudicating' | 'awaiting-resume'
  pausedAt: number
  interruptId?: string
  label?: string
  resolvedAt?: number
}

export type Dnd5eClassFeaturePayload =
  | { feature: 'barbarian-rage'; frenzy?: boolean; end?: boolean }
  | { feature: 'feature-rage-bonus-dash' }
  | { feature: 'feature-rage-bonus-prone'; targetTokenId: string }
  | { feature: 'barbarian-intimidating-presence'; targetTokenId: string }
  | { feature: 'rogue-cunning-action'; option: 'dash' | 'disengage' | 'hide' }
  | { feature: 'rogue-fast-hands'; option: 'sleight-of-hand' | 'thieves-tools' | 'use-object' }
  | { feature: 'bardic-inspiration'; targetTokenId: string }
  | { feature: 'bard-countercharm' }
  | { feature: 'paladin-lay-on-hands'; targetTokenId: string; amount: number }
  | { feature: 'paladin-lay-on-hands'; targetTokenId: string; cure: 'disease' | 'poisoned' }
  | { feature: 'paladin-cleansing-touch'; targetTokenId: string; sourceTokenId: string; spellId: string }
  | { feature: 'monk-wholeness-of-body' }
  | { feature: 'monk-step-of-the-wind'; option: 'dash' | 'disengage' }
  | { feature: 'monk-patient-defense' }
  | {
      feature: 'monk-unarmed-bonus'
      mode: 'martial-arts' | 'flurry'
      targetTokenIds: string[]
      stunningStrike?: boolean
      /** 散打宗 3 级：按疾风连击的两次攻击分别声明命中后效果。 */
      openHandTechniques?: Array<'prone' | 'push' | 'no-reactions' | undefined>
      /** 散打宗 17 级：指定一次徒手攻击，命中后消耗 3 点气植入渗透劲。 */
      quiveringPalmAttackIndex?: number
    }
  | { feature: 'monk-quivering-palm-release'; targetTokenId: string }
  | { feature: 'monk-quivering-palm-end' }
  | { feature: 'paladin-sacred-weapon' }
  | { feature: 'paladin-divine-sense' }
  | { feature: 'paladin-turn-the-unholy' }
  | { feature: 'paladin-holy-nimbus' }
  | { feature: 'cleric-turn-undead' }
  | { feature: 'cleric-preserve-life'; allocations: Array<{ targetTokenId: string; amount: number }> }
  | { feature: 'cleric-divine-intervention' }
  | { feature: 'sorcerer-create-spell-slot'; slotLevel: 1 | 2 | 3 | 4 | 5 }
  | { feature: 'sorcerer-convert-spell-slot'; slotLevel: number }
  | { feature: 'sorcerer-draconic-wings'; active: boolean }
  | { feature: 'sorcerer-draconic-presence'; mode: 'awe' | 'fear' }
  | { feature: 'ranger-move-hunters-mark'; targetTokenId: string }
  | { feature: 'ranger-primeval-awareness'; slotLevel: 1 | 2 | 3 | 4 | 5 }
  | { feature: 'ranger-hide-in-plain-sight' }
  | { feature: 'ranger-vanish' }
  | { feature: 'monk-stillness-of-mind'; condition: 'charmed' | 'frightened' }
  | { feature: 'monk-empty-body' }
  | { feature: 'druid-wild-shape'; formId: string }
  | { feature: 'druid-creature-form-heal'; slotLevel: number }
  | { feature: 'druid-end-wild-shape' }
  | { feature: 'warlock-hurl-through-hell-ready'; active: boolean }
  | { feature: 'linked-equipment-recall'; weaponId: string }
  | { feature: 'feature-extra-action-teleport'; targetCell: GridCell }

export interface Dnd5eAbilityCheckPayload {
  ability: AbilityKey
  skill?: string
  /** Host-validated situational feature context selected before this check. */
  context?: 'push-pull-lift-break' | 'interact-with-dragons'
  /** Host token inspected by a Perception check; required for source-relative obscuration effects. */
  perceivedTargetId?: string
  mode?: 'normal' | 'advantage' | 'disadvantage'
  dc: number
  /** 部分检定由 DM 判定为一个动作；关闭时只进行检定，不消耗行动经济。 */
  spendAction?: boolean
}

export interface Dnd5ePluginActionPayload {
  /** 完整的插件命名空间特性 ID，例如 com.example.rules:guardian-spark。 */
  featureId: string
  /**
   * Player-selected data-only modifiers for this Activity. The Host resolves
   * ownership, delivery, damage type and costs from its registered package;
   * clients can only name a feature that is already installed and owned.
   */
  modifierFeatureIds?: string[]
  /** 插件自定义的纯 JSON 参数；DM 仍会重建目标、距离与行动经济。 */
  payload?: SharedJsonValue
}

export type Dnd5eRacialActionPayload =
  | { feature: 'dragonborn-breath' }

export interface Dnd5eItemUsePayload {
  /** 名称、数量、骰值与效果由 DM 端当前角色快照重建。 */
  instanceId: string
  /** 多动作物品只提交动作 ID；实际动作定义与消耗由 DM 端模板重建。 */
  useActionId?: string
  /** 地图落点仅是玩家请求；合法范围与实际占格由 DM/Headless 重建。 */
  targetCell?: GridCell
  /** 生物目标仅是玩家请求；关系、距离、命中与效果由 DM/Headless 重建。 */
  targetTokenId?: string
  /** Player-selected expended slot; the DM Host validates level and capacity. */
  spellSlotLevel?: number
}

export interface Dnd5eWeaponAttackOptions {
  /** DM-only, single-transaction cover ruling. The Headless authority rejects this field on player requests. */
  coverOverride?: Dnd5eAttackCoverOverride
  /**
   * Player-owned prearmed subclass intents. These are only identifiers:
   * timing, ownership, retention, costs, and effects are rebuilt by the Host.
   */
  declarativeIntentFeatureIds?: string[]
  /** 橡棍术生效时，本次主手近战攻击使用力量或施法关键属性。 */
  shillelaghAbility?: 'str' | 'spellcasting'
  /** 荒野变形后使用当前野兽数据块中的动作序号；由 Headless 重新验证。 */
  wildShapeActionIndex?: number
  /** 仅表示玩家请求；是否可用、法术位与伤害骰均由 DM/Headless 重算。 */
  divineSmiteSlotLevel?: number
  /** 野蛮人只能在本回合第一次力量近战攻击前请求；后续优势由 Headless 状态自动延续。 */
  recklessAttack?: boolean
  /** 狂战士狂乱期间，自狂暴后的下一回合起可请求一次附赠动作近战攻击。 */
  frenzyAttack?: boolean
  /** 2014 双武器战斗：完成轻型近战武器的攻击动作后，以附赠动作用另一把轻型近战武器攻击。 */
  offHandAttack?: boolean
  /** Bonus-action weapon attack entitlement opened by an imported feature. */
  featureBonusWeaponAttack?: boolean
  /** Stable imported feature id for a generic post-Attack bonus weapon attack. */
  featureBonusWeaponAttackId?: string
  /** One-shot Host credential created by a unified Activity trigger. */
  activityWeaponAttackGrantId?: string
  /** Equipped hand selected for that Activity credential; Host rebuilds the weapon profile. */
  activityWeaponAttackWeaponSlot?: 'main-hand' | 'off-hand'
  /** 猎人“灭群者”在同回合对原目标 5 尺内另一生物进行的免费攻击。 */
  hordeBreakerAttack?: boolean
  /** 猎人 11 级多重攻击；点击的 Token 作为万箭齐发中心或旋风攻击的目标确认点。 */
  hunterMultiattack?: 'volley' | 'whirlwind-attack'
  /** 武僧 5 级震慑拳；仅命中时消耗 1 点气并由 DM 掷目标体质豁免。 */
  stunningStrike?: boolean
  /** 游侠 20 级屠灭众敌；对所选宿敌每回合一次，将感知调整值加入命中或伤害。 */
  foeSlayer?: 'attack' | 'damage'
}

export type Dnd5eAttackCoverOverride = 'none' | 'half' | 'three-quarters' | 'total'

export type Dnd5eMetamagicId =
  | 'careful'
  | 'distant'
  | 'empowered'
  | 'extended'
  | 'heightened'
  | 'quickened'
  | 'subtle'
  | 'twinned'

export interface Dnd5eSpellMetamagicPayload {
  kind: Dnd5eMetamagicId
  /** 谨慎法术：本次受影响生物中被指定为自动通过豁免的其他生物。 */
  carefulTargetIds?: string[]
  /** 升阶法术：本次受影响目标中，第一次对该法术进行豁免时具有劣势的一个目标。 */
  heightenedTargetId?: string
}

/** Stable identifiers for controls granted by an already active spell. */
export type Dnd5eSustainedSpellControlId =
  | 'flame-blade'
  | 'spiritual-weapon'
  | 'call-lightning'
  | 'expeditious-retreat'
  | 'heat-metal'
  | 'vampiric-touch'
  | 'sunbeam'
  | 'produce-flame'

/** Host-normalized open declaration for the two bounded Minor Illusion modes. */
export interface Dnd5eMinorIllusionConfigV1 {
  mode: 'image' | 'sound'
  description: string
  soundVolume?: 'whisper' | 'normal' | 'scream'
  soundPattern?: 'continuous' | 'intermittent' | 'discrete'
}

/** Host-normalized appearance and interior illumination chosen for Tiny Hut. */
export interface Dnd5eTinyHutConfigV1 {
  schemaVersion: 1
  color: string
  interiorIllumination: 'dim' | 'darkness'
}

/** Host-validated open declaration for Antipathy/Sympathy's semantic target. */
export interface Dnd5eAntipathySympathyConfigV1 {
  schemaVersion: 1
  mode: 'antipathy' | 'sympathy'
  targetKind: 'creature' | 'object' | 'area'
  creatureCategory: string
  targetDescription: string
  /** Selected cube side length when targetKind is area (5-foot steps, max 200 feet). */
  areaSizeFeet?: number
}

export interface Dnd5eSpellCastPayload {
  spellId: string
  /** Host-validated ritual protocol; executes the ordinary spell effect but spends no action or slot. */
  ritual?: true
  /**
   * Optional Host-owned persistent projection used only as this cast's
   * geometric origin. Ownership and the projection mechanic's spellOrigin
   * permission are revalidated by the authority Host.
   */
  spellOriginAreaId?: string
  /**
   * Held component focus used by a character/class cast. This is not an item
   * spell source: the Host revalidates the held focus while retaining the
   * caster's class features, spell slots and spellcasting ability.
   */
  focusItemInstanceId?: string
  /**
   * Inventory spell source selected by the player. All spell facts, costs and
   * ownership are resolved again by the DM Host; no client-supplied item
   * statistics are accepted.
   */
  itemInstanceId?: string
  /** Selects one Host-declared action on a multi-action item. */
  itemUseActionId?: string
  /**
   * Inventory instance selected for an audited Activity operation such as
   * Identify. This is separate from itemInstanceId, which means the item is
   * the source of the spell itself.
   */
  activityInventoryInstanceId?: string
  /**
   * Character whose inventory owns activityInventoryInstanceId. Identify may
   * target an unidentified item carried by any player character in the room;
   * the Host revalidates this owner instead of assuming the caster.
   */
  activityInventoryCharacterId?: string
  /** Optimistic-concurrency revision paired with activityInventoryInstanceId. */
  expectedActivityInventoryRevision?: number
  /** Host-validated inventory object targeted by the spell, never the source of the cast. */
  targetInventoryInstanceId?: string
  /** The class whose spellcasting feature authorizes this cast. */
  castingClassId?: Dnd5eClassId
  /** The character's racial spell grant authorizes this cast instead of a class spellcasting feature. */
  racialInnate?: boolean
  /** A Host-registered feature grant authorizes this cast and replaces spell-slot consumption. */
  alternateResourceSpell?: { featureId: string; grantId: string }
  /**
   * Host-owned War Caster reaction credential. A client flag alone never grants
   * an out-of-turn cast; the DM runtime binds it to a live opportunity trigger.
   */
  opportunityAttackSpell?: boolean
  slotLevel: number
  targetTokenId: string
  targetTokenIds?: string[]
  /**
   * An unseen-target spell attack may name only a map cell. The DM Host binds
   * that cell to the current authoritative token snapshot, never the client.
   */
  guessedTargetCell?: GridCell
  /** 点起源范围法术的权威落点；DM 会据此重新计算效果线。 */
  areaTargetCell?: GridCell
  /** Multi-origin area spells submit every distinct origin for Host validation. */
  areaTargetCells?: GridCell[]
  /** Dancing Lights may remain separate or combine all four lights into one vague Medium humanoid. */
  dancingLightsForm?: 'lights' | 'humanoid'
  /** 可旋转矩形模板的方向；DM 只接受 0–3 并据此重建覆盖格。 */
  areaTargetOrientation?: 0 | 1 | 2 | 3
  /** 通用可旋转长方形模板的自由角度；Host 会归一化为 0–359 度后重建覆盖格。 */
  areaTargetAngleDegrees?: number
  /** Casting-time dimensions for adjustable area templates; Host validates their declared min/max bounds. */
  areaTargetRadiusFeet?: number
  areaTargetWidthFeet?: number
  areaTargetHeightFeet?: number
  areaTargetLengthFeet?: number
  /** Wall of Fire uses host-validated geometry independent from the legacy four-way rectangle. */
  wallOfFireShape?: 'line' | 'ring'
  wallOfFireAngleDegrees?: number
  wallOfFireDamagingSide?: 'left' | 'right' | 'inside' | 'outside'
  /** Host validates 5-foot increments up to the spell's 60-foot maximum. */
  wallOfFireLengthFeet?: number
  /** Ring diameter, in 5-foot increments up to the spell's 20-foot maximum. */
  wallOfFireDiameterFeet?: number
  /** Blade Barrier may be a freely rotated line up to 100 feet or a ring up to 60 feet in diameter. */
  bladeBarrierShape?: 'line' | 'ring'
  bladeBarrierAngleDegrees?: number
  bladeBarrierLengthFeet?: number
  bladeBarrierDiameterFeet?: number
  /** Ordered per-projectile targets; duplicates allocate multiple projectiles to one creature. */
  projectileTargetIds?: string[]
  /** 塑能学派14级“超限导能”：由DM端重新验证资格并掷后续反噬伤害。 */
  overchannel?: boolean
  /** 通用声明式伤害骰最大化；Host 会重建特性、伤害类型与资源消耗。 */
  damageMaximizationFeatureId?: string
  /** 塑能学派2级“法术塑形”：必须是本次区域法术所影响、且不含施法者的生物。 */
  sculptedTargetIds?: string[]
  /** Creatures explicitly designated as unaffected by, or unable to trigger, a persistent area. */
  excludedAreaTargetIds?: string[]
  /** 术士超魔法；种类、已知选项、术法点与附加参数都由DM端重新验证。 */
  metamagic?: Dnd5eSpellMetamagicPayload
  /** 强化法术在伤害骰掷出后另行选择重掷；可与另一种超魔法同时使用。 */
  empowered?: boolean
  /** 龙族血脉6级“元素亲和”：消耗1术法点，获得先祖关联伤害抗性1小时。 */
  draconicResistance?: boolean
  /** 斥力魔爆：本次魔能爆每道命中的射线都请求将目标推开至多10尺。 */
  repellingBlast?: boolean
  /** 目盲/耳聋术与次级复原术的受控选择；Headless 会按法术白名单重新验证。 */
  conditionChoice?: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease'
  /** 防护能量伤害等法术的受控伤害类型选择；DM Host 会按法术白名单复核。 */
  effectDamageType?: 'acid' | 'cold' | 'fire' | 'lightning' | 'thunder'
  /** 变巨/缩小术的受控形态选择；DM Host 会按法术白名单复核。 */
  enlargeReduceChoice?: 'enlarge' | 'reduce'
  /** 强化属性的受控分支选择；DM Host 会按法术白名单复核。 */
  enhanceAbilityChoice?:
    | 'bear-endurance'
    | 'bull-strength'
    | 'cat-grace'
    | 'eagle-splendor'
    | 'fox-cunning'
    | 'owl-wisdom'
  /** 安定心神的两种规则分支；Host 只接受该法术声明的闭合选项。 */
  calmEmotionsMode?: 'suppress' | 'indifferent'
  /** 漠然分支中由玩家选定的有界生物组，Host 会重建为当时场上的具体目标。 */
  calmEmotionsIndifferenceScope?: 'caster-allies' | 'caster-enemies' | 'everyone'
  /** 使用一个仍在维持的核心法术效果；不会再次施法或消费新的法术位。 */
  sustainedEffectAttack?: Dnd5eSustainedSpellControlId
  /** 独立法术实体或固定持续区域授予后续动作时，指向 Host 已创建并同步的地图实体。 */
  sustainedEffectAreaId?: string
  /** 群体医疗术的逐目标治疗分配；总和不得超过法术的治疗池。 */
  healingAllocations?: Array<{ targetTokenId: string; amount: number }>
  /** 焰击术等法术升环时，由施法者选择额外伤害加入哪一种法术伤害类型。 */
  higherSlotDamageType?: 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic' | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder'
  /** Closed choices declared by a unified spell Activity; the Host validates every id and option. */
  activityChoices?: Record<string, string>
  /** Optional cast-time phrase for an Activity that explicitly accepts one, such as Arcane Lock. */
  secretPhrase?: string
  /** Spoken creature name required when True Resurrection creates a replacement body. */
  trueResurrectionSpokenName?: string
  /** Host-revalidated Magic Mouth message, observable trigger and repetition policy. */
  magicMouth?: Dnd5eMagicMouthConfigV1
  /** Message cantrip content. The Host trims and bounds it before any private delivery. */
  communicationText?: string
  /** Minor Illusion's bounded player declaration; the Host cross-checks it with the Activity mode. */
  minorIllusion?: Dnd5eMinorIllusionConfigV1
  /** Tiny Hut's bounded color and interior-light declaration. */
  tinyHut?: Dnd5eTinyHutConfigV1
  /** Host-normalized semantic declaration for Antipathy/Sympathy. */
  antipathySympathy?: Dnd5eAntipathySympathyConfigV1
}

export interface Dnd5eSpellWhisperReplyPayload {
  /** The accepted Message cast whose one-time reply channel is being used. */
  originalActionId: string
  text: string
}

export interface Dnd5eSendingDeclarationV1 {
  schemaVersion: 1
  /** A creature personally familiar to the caster; the DM verifies this during adjudication. */
  recipientName: string
  /** The exact player-authored message, bounded to no more than 25 words. */
  message: string
}

export interface Dnd5eSendingResolutionV1 {
  schemaVersion: 1
  targetIntelligenceAtLeastOne: boolean
  plane: 'same' | 'different'
  /** Required only across planes. Rolls 1-5 fail; 6-100 deliver. */
  crossPlaneRoll?: number
  delivered: boolean
  /** The target's optional immediate response, also bounded to 25 words. */
  reply?: string
}

export interface Dnd5eAnimalMessengerDeclarationV1 {
  schemaVersion: 1
  /** Exact current-map token identity; the Host revalidates Tiny beast and 30-foot range. */
  targetTokenId: string
  targetName: string
  /** A place the caster claims to have visited; the DM confirms that claim before settlement. */
  destination: string
  /** General description used by the beast to identify the only eligible recipient. */
  recipientDescription: string
  /** Exact player-authored message, bounded to no more than 25 words. */
  message: string
  /** DM-estimated route distance, used to expose the 25/50 miles-per-day rule in the UI. */
  routeDistanceMiles: number
}

export interface Dnd5eAnimalMessengerResolutionV1 {
  schemaVersion: 1
  /** Confirms the caster has personally visited the declared destination. */
  destinationPreviouslyVisitedConfirmed: boolean
  /** Confirms the selected Tiny beast is currently visible to the caster. */
  targetVisibleConfirmed: boolean
}

export interface Dnd5eAnimateDeadTargetV1 {
  /** Exact current-map identity; the Host re-resolves its kind, name, and 10-foot range. */
  tokenId: string
  targetName: string
  /** Present only while animating remains. Bones become a skeleton; a humanoid corpse becomes a zombie. */
  remainsKind?: 'bone-pile' | 'humanoid-corpse'
}

export type Dnd5eCreateUndeadKindV1 = 'ghoul' | 'ghast' | 'wight' | 'mummy'

export type Dnd5eAnimateDeadDeclarationV1 = {
  schemaVersion: 1
  mode: 'animate' | 'reassert-control'
  /** Create Undead reuses this bounded corpse/control declaration and must name the chosen undead profile. */
  undeadKind?: Dnd5eCreateUndeadKindV1
  targets: Dnd5eAnimateDeadTargetV1[]
}

export interface Dnd5eAnimateDeadResolutionV1 {
  schemaVersion: 1
  /** DM confirms the displayed remains/control targets before the atomic map replacement. */
  targetsConfirmed: boolean
}

export interface Dnd5eAnimateObjectsTargetV1 {
  /** Exact current-map object identity; the Host re-resolves every mutable rule field. */
  tokenId: string
  targetName: string
}

export interface Dnd5eAnimateObjectsDeclarationV1 {
  schemaVersion: 1
  /** Selected unattended nonmagical map objects. Size costs are Host-derived, never player-authored. */
  targets: Dnd5eAnimateObjectsTargetV1[]
}

export interface Dnd5eAnimateObjectsResolutionV1 {
  schemaVersion: 1
  /** DM confirms the displayed weighted-capacity and exact stat-block replacement plan. */
  targetsConfirmed: boolean
}

export interface Dnd5eSequesterDeclarationV1 {
  schemaVersion: 1
  targetKind: 'creature' | 'object'
  /** Exact map-token identity; the Host re-resolves its kind, name, and touch distance. */
  targetTokenId: string
  targetName: string
  /** Optional observable event chosen by the caster. It must occur/be visible within 1 mile. */
  endingCondition?: string
}

export interface Dnd5eSequesterResolutionV1 {
  schemaVersion: 1
  /** Objects do not require consent; creature casts cannot settle unless the DM confirms this. */
  willingCreatureConfirmed: boolean
}

export interface Dnd5eWordOfRecallTargetV1 {
  /** Exact current-map token identity; the Host re-resolves name, creature kind, and 5-foot distance. */
  tokenId: string
  name: string
}

export type Dnd5eWordOfRecallDeclarationV1 =
  | {
      schemaVersion: 1
      mode: 'designate-sanctuary'
      /** Player-authored human-readable name for the consecrated destination. */
      sanctuaryName: string
      /** Why this place is dedicated to, or strongly linked with, the caster's deity. */
      deityConnection: string
    }
  | {
      schemaVersion: 1
      mode: 'recall'
      /** Up to five willing creatures in addition to the caster. */
      targets: Dnd5eWordOfRecallTargetV1[]
    }

export interface Dnd5eWordOfRecallResolutionV1 {
  schemaVersion: 1
  /** Required while designating a sanctuary; confirms the rules-text location restriction. */
  sanctuaryConsecratedConfirmed: boolean
  /** Required while recalling; confirms every declared companion is willing. */
  willingCreaturesConfirmed: boolean
}

export interface Dnd5eWishTargetV1 {
  /** Exact map-token identity; the Host re-resolves the token and name. */
  tokenId: string
  name: string
}

export type Dnd5eWishDeclarationV1 =
  | {
      schemaVersion: 1
      mode: 'duplicate-spell'
      spellId: string
      spellName: string
      spellLevel: number
    }
  | {
      schemaVersion: 1
      mode: 'create-object'
      objectDescription: string
      valueGp: number
      maximumDimensionFeet: number
      placementDescription: string
    }
  | {
      schemaVersion: 1
      mode: 'heal-and-restore'
      targets: Dnd5eWishTargetV1[]
    }
  | {
      schemaVersion: 1
      mode: 'grant-resistance'
      targets: Dnd5eWishTargetV1[]
      damageType: Dnd5eDamageType
    }
  | {
      schemaVersion: 1
      mode: 'grant-immunity'
      targets: Dnd5eWishTargetV1[]
      namedEffect: string
    }
  | {
      schemaVersion: 1
      mode: 'reroll-last-round'
      rollDescription: string
      rollMode: 'advantage' | 'disadvantage'
    }
  | {
      schemaVersion: 1
      mode: 'open-ended'
      exactWish: string
    }

export interface Dnd5eSpellWhisperEnvelope {
  direction: 'message' | 'reply' | 'sending-result'
  originalActionId: string
  spellId: 'message' | 'sending'
  casterTokenId: string
  casterCharacterId: string
  casterName: string
  targetTokenId: string
  targetCharacterId: string
  targetName: string
  text: string
  allowsImmediateReply: boolean
  expiresAt: number
  sending?: Dnd5eSendingResolutionV1
}

/**
 * 玩家只能声明要施放哪个尚未机械化的法术以及使用的环位。
 * 目标、伤害、治疗与状态效果必须由 DM 通过 dm-adjudication Interrupt 回填，
 * 不能从这个玩家可写的请求载荷进入 Headless。
 */
export type Dnd5eAdjudicatedSpellCastingVariant =
  | 'plant-growth-action'
  | 'plant-growth-8-hours'

export interface Dnd5eAdjudicatedSpellPayload {
  spellId: string
  /** The class whose spellcasting feature authorizes this cast. */
  castingClassId?: Dnd5eClassId
  slotLevel: number
  /**
   * Voice-table narrative protocol. The Host accepts this only for a spell
   * without full automation or for an audited voice-narrative spell. It
   * spends the selected slot without opening a DM-adjudication interrupt and
   * never accepts player-authored target/effect mutations.
   */
  narrativeOnly?: true
  /** Host-audited rules-text mode for spells with mutually exclusive casting times. */
  castingVariant?: Dnd5eAdjudicatedSpellCastingVariant
  /** Requests the class's ritual-casting protocol. Host validates the spell and class; no slot is spent. */
  ritual?: true
  /**
   * A bounded table declaration for a Host-approved environment-narrative
   * spell. It records the player's selected legal mode and scene description,
   * but never authorizes a player to mutate map geometry or creature state.
   */
  narrativeContext?: string
  /** Sending's bounded player declaration. Delivery and reply remain Host-authored. */
  sending?: Dnd5eSendingDeclarationV1
  /** Animal Messenger's bounded target, route, recipient, and message declaration. */
  animalMessenger?: Dnd5eAnimalMessengerDeclarationV1
  /** Animate Dead's bounded mode and exact remains/controlled-undead targets. */
  animateDead?: Dnd5eAnimateDeadDeclarationV1
  /** Animate Objects' exact unattended nonmagical object targets. */
  animateObjects?: Dnd5eAnimateObjectsDeclarationV1
  /** Creation's exact material mix, bounded cube edge and map placement. */
  creation?: Dnd5eCreationDeclarationV1
  /** Create or Destroy Water's exact mode, volume/area and map target. */
  createOrDestroyWater?: Dnd5eCreateOrDestroyWaterDeclarationV1
  /** Sequester's bounded target and optional early-ending declaration. */
  sequester?: Dnd5eSequesterDeclarationV1
  /** Word of Recall's sanctuary-designation or bounded willing-companion declaration. */
  wordOfRecall?: Dnd5eWordOfRecallDeclarationV1
  /** Wish's exact selected rules mode and bounded player-authored declaration. */
  wish?: Dnd5eWishDeclarationV1
}

export interface Dnd5ePersistentAreaMovePayload {
  areaId: string
  targetCell: GridCell
  /**
   * Multi-origin persistent spells (currently Dancing Lights) submit every
   * independently moved origin in stable creation order. `targetCell` remains
   * the first destination for backwards compatibility with older clients.
   */
  targetCells?: GridCell[]
}

export interface SharedCombatState {
  mapId: string
  combatId?: string
  active: boolean
  round: number
  initiativeIndex: number
  initiativeOrder: InitiativeEntry[]
  /** DM 权威的结算策略；旧快照缺失时按 automatic 处理。 */
  settlementMode?: CombatSettlementMode
  /** Legacy-compatible envelope; normalized to permanent DM manual monster control. */
  monsterControl?: Dnd5eMonsterControlWireStateV1
  /** Room-wide gate. DM adjudications remain blocked here until the DM explicitly resumes combat. */
  flowPause?: SharedCombatFlowPauseV1
  dnd5eTurnEconomyByToken?: Dnd5eTurnEconomyByToken
  /** DM-pinned rules and exact plugin set; active room combat rejects plugin actions when absent. */
  effectiveRules?: Dnd5eEffectiveRulesContextV1
  updatedAt: number
  /** Server authority revision. A DM rollback can restore an older domain timestamp at a newer revision. */
  _sync?: {
    schemaVersion: 1
    revision: number
    writerId: string
    writtenAt: number
  }
}

export type Dnd5eBasicActionPayload =
  | { kind: 'dash'; sourceSpellId?: 'expeditious-retreat' }
  | { kind: 'hide' }
  | { kind: 'help'; helpKind: 'ability-check' | 'attack'; targetTokenId: string }
  | { kind: 'ready'; trigger: string; actionKind: 'attack' | 'move' | 'interact-object' | 'other'; targetTokenId?: string }
  | { kind: 'use-object'; interactionId: string }
  | { kind: 'grapple'; targetTokenId: string; targetDefense: 'athletics' | 'acrobatics'; activityBasicActionGrantId?: string }
  | { kind: 'shove'; targetTokenId: string; targetDefense: 'athletics' | 'acrobatics'; outcome: 'prone' | 'push'; activityBasicActionGrantId?: string }
  | { kind: 'release-grapple'; targetTokenId: string }
  | { kind: 'escape-grapple'; targetTokenId: string }
  | { kind: 'escape-effect' }
  | { kind: 'dismiss-effect'; effectId: string }
  | { kind: 'set-flame-blade-manifestation'; effectId: string; manifested: boolean }
  | { kind: 'dismiss-warding-bond' }
  | { kind: 'wake'; targetTokenId: string }
  | { kind: 'command-animate-dead'; targetTokenIds: string[]; command: string }
  | { kind: 'command-animate-objects'; targetTokenIds: string[]; command: string }
  | { kind: 'other-action'; description?: string }
  | { kind: 'other-bonus-action'; description?: string }

export interface SharedPlayerActionState {
  id: string
  mapId: string
  combatId?: string
  /** Server-stamped room membership used only for private transport routing. */
  roomMemberId?: string
  sourceMode: 'player' | 'dm'
  status: 'pending' | 'done'
  type:
    | 'end-turn'
    | 'dnd5e-death-save'
    | 'dnd5e-weapon-attack'
    | 'dnd5e-fighter-feature'
    | 'dnd5e-class-feature'
    | 'dnd5e-racial-action'
    | 'dnd5e-plugin-action'
    | 'dnd5e-item-use'
    | 'dnd5e-ability-check'
    | 'dnd5e-spell-cast'
    | 'dnd5e-spell-whisper-reply'
    | 'dnd5e-persistent-area-move'
    | 'dnd5e-adjudicated-spell'
    | 'dnd5e-map-interaction'
    | 'move-token'
    | 'disengage'
    | 'dodge'
    | 'dnd5e-basic-action'
  actorTokenId: string
  characterId: string
  targetTokenId?: string
  targetTokenIds?: string[]
  targetCell?: GridCell
  /** 可旋转范围模板的四向朝向；仅作为请求，DM 会重新验证。 */
  targetOrientation?: 0 | 1 | 2 | 3
  targetPosition?: { x: number; y: number }
  /** 穿过滚珠或铁蒺藜时声明半速谨慎移动；DM 按双倍移动消耗复核。 */
  dnd5eCarefulMovement?: boolean
  /** 倒地移动时，true/省略表示先起身；false 表示保持倒地并以匍匐规则移动。 */
  dnd5eStandFromProne?: boolean
  /** 攀爬、游泳与跳跃由玩家声明，DM 按角色速度、力量和海拔重新计算。 */
  dnd5eTraversalMode?: Dnd5eTraversalMode
  targetElevationFeet?: number
  dnd5eFighterFeature?: 'second-wind' | 'action-surge'
  dnd5eClassFeature?: Dnd5eClassFeaturePayload
  dnd5eRacialAction?: Dnd5eRacialActionPayload
  dnd5ePluginAction?: Dnd5ePluginActionPayload
  dnd5eItemUse?: Dnd5eItemUsePayload
  dnd5eAbilityCheck?: Dnd5eAbilityCheckPayload
  dnd5eWeaponAttackOptions?: Dnd5eWeaponAttackOptions
  dnd5eSpellCast?: Dnd5eSpellCastPayload
  dnd5eSpellWhisperReply?: Dnd5eSpellWhisperReplyPayload
  dnd5ePersistentAreaMove?: Dnd5ePersistentAreaMovePayload
  dnd5eAdjudicatedSpell?: Dnd5eAdjudicatedSpellPayload
  dnd5eMapInteraction?: Dnd5eMapInteractionPayload
  dnd5eBasicAction?: Dnd5eBasicActionPayload
  round: number
  initiativeIndex: number
  seq: number
  updatedAt: number
}

export interface SharedPlayerActionRequestQueueState {
  mapId?: string
  combatId?: string
  requests: SharedPlayerActionState[]
  updatedAt: number
}

export interface SharedPlayerActionProcessedState {
  mapId?: string
  combatId?: string
  actionIds: string[]
  updatedAt: number
}

export interface SharedPlayerActionAckState {
  id: string
  mapId: string
  combatId?: string
  actionId: string
  /** Only this room member may receive the acknowledgement projection. */
  recipientMemberId?: string
  status: 'accepted' | 'rejected'
  reason?: string
  acceptedPosition?: { x: number; y: number }
  /** Final authoritative token elevation after a successful movement settlement. */
  acceptedElevationFeet?: number
  appliedAt?: number
  /** Revisions committed atomically with an accepted action ACK. */
  authorityRevisions?: Readonly<Record<string, number>>
  result?: PlayerActionResultSummary
  /** Host result used only to reconcile the player's local prearm toggles. */
  dnd5eDeclarativeAttackIntents?: {
    triggeredFeatureIds: string[]
    consumedFeatureIds: string[]
  }
  /** Private, server-recipient-filtered Message delivery. Never persisted to the public combat log. */
  spellWhisper?: Dnd5eSpellWhisperEnvelope
  round: number
  initiativeIndex: number
  updatedAt: number
}

export interface SharedDiceState {
  id: string
  mapId: string
  sourceMode: Mode
  visibility?: 'public' | 'dm'
  rollerName?: string
  status?: 'rolling' | 'result'
  kind?: 'd20' | 'dice'
  count?: number
  sides?: number
  values?: number[]
  flyIndex?: number
  label?: string
  targetName?: string
  roll?: DiceRoll
  updatedAt: number
}

export interface SharedDiceEventsState {
  mapId: string
  events: SharedDiceState[]
  updatedAt: number
}

// Dice presentation handshake. Ordinary events carry an already-decided result.
// A player-owned d20 uses request -> result so the player's browser generates
// and animates the authoritative face before the Host resumes Headless combat.
export interface SharedRollRequestEvent {
  eventId: string
  mapId: string
  sourceMode: Mode
  requestId: string
  kind: 'd20' | 'dice'
  count: number
  sides: number
  values: number[]
  label: string
  targetName: string
  delivery?: 'broadcast-result' | 'player-roll-request' | 'player-roll-result'
  targetCharacterId?: string
  rollKind?: 'attack' | 'ability-check' | 'saving-throw'
  savingThrowAbility?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
  updatedAt: number
}

export type SharedRollRequestPayload = Omit<
  SharedRollRequestEvent,
  'eventId' | 'mapId' | 'sourceMode' | 'updatedAt'
>

export interface SharedCombatLogState {
  mapId: string
  entries: CombatLogEntry[]
  /** Entries newer than this checkpoint were explicitly removed by a DM rollback. */
  rollbackCutoffEntryId?: number
  updatedAt: number
}


export interface CombatLogEntry {
  id: number
  round: number
  text: string
  kind: 'system' | 'turn' | 'attack' | 'damage'
  time: string
  /** Stable map Token that owns the event; absent on legacy or actor-less rows. */
  actorTokenId?: string
  /** 由 Headless 结算事件生成的可读过程；旧日志可不包含。 */
  details?: string[]
}
