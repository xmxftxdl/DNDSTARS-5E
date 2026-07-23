import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { DiceRoll } from '../components/DiceRollOverlay'
import type { AbilityKey } from './dnd'
import type { GridCell } from './gridCombat'
import type { PlayerActionResultSummary } from './playerActionResult'
import type { CombatSettlementMode } from './combatSettlementMode'
import type { Dnd5eMapInteractionPayload } from '../rulesets/dnd5e/mapInteraction'
import type { Dnd5eTraversalMode } from '../rulesets/dnd5e/traversal'
import type { Dnd5eClassId } from '../rulesets/dnd5e/classes'
import type { Dnd5eEffectiveRulesContextV1 } from '../rulesets/dnd5e/effectiveRulesContext'

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
  /** 本回合已结算的单次武器攻击数，用于在刷新后继续额外攻击。 */
  attacksUsed: number
  action: { current: number; max: number }
  bonusAction: { current: number; max: number }
  reaction: { current: number; max: number }
  /** 每回合一次与环境物件的免费交互；第二次需改用主动动作。 */
  objectInteraction?: { current: number; max: number }
  /** 5e 移动不是动作，也不消耗 AP；这里记录本回合尚可移动的尺数。 */
  movement: { current: number; max: number }
}

export type Dnd5eTurnEconomyByToken = Record<string, Dnd5eTurnEconomyCounts>

export type Dnd5eClassFeaturePayload =
  | { feature: 'barbarian-rage'; frenzy?: boolean; end?: boolean }
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
  | { feature: 'druid-end-wild-shape' }
  | { feature: 'warlock-hurl-through-hell-ready'; active: boolean }

export interface Dnd5eAbilityCheckPayload {
  ability: AbilityKey
  skill?: string
  mode?: 'normal' | 'advantage' | 'disadvantage'
  dc: number
  /** 部分检定由 DM 判定为一个动作；关闭时只进行检定，不消耗行动经济。 */
  spendAction?: boolean
}

export interface Dnd5ePluginActionPayload {
  /** 完整的插件命名空间特性 ID，例如 com.example.rules:guardian-spark。 */
  featureId: string
  /** 插件自定义的纯 JSON 参数；DM 仍会重建目标、距离与行动经济。 */
  payload?: SharedJsonValue
}

export interface Dnd5eItemUsePayload {
  /** 名称、数量、骰值与效果由 DM 端当前角色快照重建。 */
  instanceId: string
  /** 地图落点仅是玩家请求；合法范围与实际占格由 DM/Headless 重建。 */
  targetCell?: GridCell
  /** 生物目标仅是玩家请求；关系、距离、命中与效果由 DM/Headless 重建。 */
  targetTokenId?: string
}

export interface Dnd5eWeaponAttackOptions {
  /** DM-only, single-transaction cover ruling. The Headless authority rejects this field on player requests. */
  coverOverride?: Dnd5eAttackCoverOverride
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

export interface Dnd5eSpellCastPayload {
  spellId: string
  /** The class whose spellcasting feature authorizes this cast. */
  castingClassId?: Dnd5eClassId
  slotLevel: number
  targetTokenId: string
  targetTokenIds?: string[]
  /** 点起源范围法术的权威落点；DM 会据此重新计算效果线。 */
  areaTargetCell?: GridCell
  /** 可旋转矩形模板的方向；DM 只接受 0–3 并据此重建覆盖格。 */
  areaTargetOrientation?: 0 | 1 | 2 | 3
  /** Ordered per-projectile targets; duplicates allocate multiple projectiles to one creature. */
  projectileTargetIds?: string[]
  /** 塑能学派14级“超限导能”：由DM端重新验证资格并掷后续反噬伤害。 */
  overchannel?: boolean
  /** 塑能学派2级“法术塑形”：必须是本次区域法术所影响、且不含施法者的生物。 */
  sculptedTargetIds?: string[]
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
  /** 群体医疗术的逐目标治疗分配；总和不得超过法术的治疗池。 */
  healingAllocations?: Array<{ targetTokenId: string; amount: number }>
  /** 焰击术等法术升环时，由施法者选择额外伤害加入哪一种法术伤害类型。 */
  higherSlotDamageType?: 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic' | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder'
}

/**
 * 玩家只能声明要施放哪个尚未机械化的法术以及使用的环位。
 * 目标、伤害、治疗与状态效果必须由 DM 通过 dm-adjudication Interrupt 回填，
 * 不能从这个玩家可写的请求载荷进入 Headless。
 */
export interface Dnd5eAdjudicatedSpellPayload {
  spellId: string
  /** The class whose spellcasting feature authorizes this cast. */
  castingClassId?: Dnd5eClassId
  slotLevel: number
}

export interface Dnd5ePersistentAreaMovePayload {
  areaId: string
  targetCell: GridCell
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
  dnd5eTurnEconomyByToken?: Dnd5eTurnEconomyByToken
  /** DM-pinned rules and exact plugin set; active room combat rejects plugin actions when absent. */
  effectiveRules?: Dnd5eEffectiveRulesContextV1
  updatedAt: number
}

export type Dnd5eBasicActionPayload =
  | { kind: 'dash' }
  | { kind: 'hide' }
  | { kind: 'help'; helpKind: 'ability-check' | 'attack'; targetTokenId: string }
  | { kind: 'ready'; trigger: string; actionKind: 'attack' | 'move' | 'interact-object' | 'other'; targetTokenId?: string }
  | { kind: 'use-object'; interactionId: string }
  | { kind: 'grapple'; targetTokenId: string; targetDefense: 'athletics' | 'acrobatics' }
  | { kind: 'shove'; targetTokenId: string; targetDefense: 'athletics' | 'acrobatics'; outcome: 'prone' | 'push' }
  | { kind: 'escape-grapple'; targetTokenId: string }
  | { kind: 'wake'; targetTokenId: string }

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
    | 'dnd5e-plugin-action'
    | 'dnd5e-item-use'
    | 'dnd5e-ability-check'
    | 'dnd5e-spell-cast'
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
  dnd5ePluginAction?: Dnd5ePluginActionPayload
  dnd5eItemUse?: Dnd5eItemUsePayload
  dnd5eAbilityCheck?: Dnd5eAbilityCheckPayload
  dnd5eWeaponAttackOptions?: Dnd5eWeaponAttackOptions
  dnd5eSpellCast?: Dnd5eSpellCastPayload
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
  appliedAt?: number
  result?: PlayerActionResultSummary
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

// Result-broadcast path. DM emits one roll-request carrying the already-decided
// values; each end renders the same terminal face from `values`.
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
  updatedAt: number
}

export type SharedRollRequestPayload = Omit<
  SharedRollRequestEvent,
  'eventId' | 'mapId' | 'sourceMode' | 'updatedAt'
>

export interface SharedCombatLogState {
  mapId: string
  entries: CombatLogEntry[]
  updatedAt: number
}


export interface CombatLogEntry {
  id: number
  round: number
  text: string
  kind: 'system' | 'turn' | 'attack' | 'damage'
  time: string
  /** 由 Headless 结算事件生成的可读过程；旧日志可不包含。 */
  details?: string[]
}
