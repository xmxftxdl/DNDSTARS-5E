import {
  publishSharedEvent as publishSharedTransportEvent,
  sampleSharedServerClock,
} from './sharedApi'
import { getRoomRulesSnapshot } from './roomRulesState'
import {
  COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS,
  isCombatPresentationAreaSpellId,
  isCombatPresentationProjectileSpellId,
  isCombatPresentationTargetEffectSpellId,
} from '../../shared/combat-presentation-contract.mjs'
import type {
  CombatPresentationAreaSpellId,
  CombatPresentationProjectileSpellId,
  CombatPresentationTargetEffectSpellId,
} from '../../shared/combat-presentation-contract.mjs'

export const COMBAT_PRESENTATION_CHANNEL = 'combat-presentation'
export const FIRE_BOLT_ANIMATION_DURATION_MS = 980
export const FIREBALL_ANIMATION_DURATION_MS = 1_750
export const SHOCKING_GRASP_ANIMATION_DURATION_MS = 1_000
export const CHILL_TOUCH_ANIMATION_DURATION_MS = 1_000
export const RAY_OF_FROST_ANIMATION_DURATION_MS = 1_000
export const ELDRITCH_BLAST_ANIMATION_DURATION_MS = 900
export const PRODUCE_FLAME_ANIMATION_DURATION_MS = 1_100
export const GUIDANCE_MANIFESTATION_DURATION_MS = 1_000
export const GUIDANCE_ORBIT_RADIUS_FACTOR = 0.52
export const RESISTANCE_MANIFESTATION_DURATION_MS = 1_000
export const RESISTANCE_ORBIT_RADIUS_FACTOR = 0.52
export const SANCTUARY_MANIFESTATION_DURATION_MS = 1_000
export const SANCTUARY_ORBIT_RADIUS_FACTOR = 0.52
export const SACRED_FLAME_ANIMATION_DURATION_MS = 1_200
export const SPARE_THE_DYING_ANIMATION_DURATION_MS = 1_100
export const ACID_SPLASH_ANIMATION_DURATION_MS = 1_050
export const POISON_SPRAY_ANIMATION_DURATION_MS = 1_150
export const VICIOUS_MOCKERY_ANIMATION_DURATION_MS = 1_100
export const MAGIC_MISSILE_ANIMATION_DURATION_MS = 300
// Keep a small server/SSE/frame-scheduling guard between darts. Using a gap
// exactly equal to the animation duration allowed adjacent projectiles to
// overlap for one rendered frame when their independently sampled server
// timestamps differed by a few milliseconds.
export const MAGIC_MISSILE_SEQUENCE_GAP_MS = 340
export const SCORCHING_RAY_ANIMATION_DURATION_MS = 1_000
export const GUIDING_BOLT_ANIMATION_DURATION_MS = 1_050
export const ACID_ARROW_ANIMATION_DURATION_MS = 1_050
export const CURE_WOUNDS_ANIMATION_DURATION_MS = 1_050
export const HEALING_WORD_ANIMATION_DURATION_MS = 1_050
export const INFLICT_WOUNDS_ANIMATION_DURATION_MS = 1_050
export const HELLISH_REBUKE_ANIMATION_DURATION_MS = 1_150
export const BURNING_HANDS_ANIMATION_DURATION_MS = 1_150
export const THUNDERWAVE_ANIMATION_DURATION_MS = 1_100
export const SHATTER_ANIMATION_DURATION_MS = 1_100
export const LIGHTNING_BOLT_ANIMATION_DURATION_MS = 1_150
export const BLIGHT_ANIMATION_DURATION_MS = 1_200
export const FLAME_STRIKE_ANIMATION_DURATION_MS = 1_300
export const SUNBURST_ANIMATION_DURATION_MS = 1_350
export const CONE_OF_COLD_ANIMATION_DURATION_MS = 1_250
export const CIRCLE_OF_DEATH_ANIMATION_DURATION_MS = 1_300
export const ICE_STORM_ANIMATION_DURATION_MS = 1_350
export const FREEZING_SPHERE_ANIMATION_DURATION_MS = 1_350
export const METEOR_SWARM_ANIMATION_DURATION_MS = 1_800
export const FINGER_OF_DEATH_ANIMATION_DURATION_MS = 1_300
export const POWER_WORD_STUN_ANIMATION_DURATION_MS = 1_250
export const POWER_WORD_KILL_ANIMATION_DURATION_MS = 1_300
export const COLOR_SPRAY_ANIMATION_DURATION_MS = 1_200
export const FAERIE_FIRE_ANIMATION_DURATION_MS = 1_300
export const SLEEP_ANIMATION_DURATION_MS = 1_350
export const FALSE_LIFE_ANIMATION_DURATION_MS = 1_250
export const HYPNOTIC_PATTERN_ANIMATION_DURATION_MS = 1_350
export const SLOW_ANIMATION_DURATION_MS = 1_250
export const PHANTASMAL_KILLER_ANIMATION_DURATION_MS = 1_400
export const BANISHMENT_ANIMATION_DURATION_MS = 1_350
export const MISTY_STEP_ANIMATION_DURATION_MS = 1_050
export const HOLD_MONSTER_ANIMATION_DURATION_MS = 1_300
export const COUNTERSPELL_ANIMATION_DURATION_MS = 1_050
export const DISPEL_MAGIC_ANIMATION_DURATION_MS = 1_200
export const SHIELD_ANIMATION_DURATION_MS = 1_000
export const LESSER_RESTORATION_ANIMATION_DURATION_MS = 1_200
export const HEAL_ANIMATION_DURATION_MS = 1_250
export const MASS_CURE_WOUNDS_ANIMATION_DURATION_MS = 1_300
export const MASS_HEAL_ANIMATION_DURATION_MS = 1_400
export const MASS_HEALING_WORD_ANIMATION_DURATION_MS = 1_250
export const PRAYER_OF_HEALING_ANIMATION_DURATION_MS = 1_350
export const DANCING_LIGHTS_ANIMATION_DURATION_MS = 1_250
export const MINOR_ILLUSION_ANIMATION_DURATION_MS = 1_250
export const THAUMATURGY_ANIMATION_DURATION_MS = 1_200
export const SHILLELAGH_ANIMATION_DURATION_MS = 1_200
export const ENTANGLE_ANIMATION_DURATION_MS = 1_300
export const GREASE_ANIMATION_DURATION_MS = 1_250
export const DARKNESS_ANIMATION_DURATION_MS = 1_300
/** Time before Headless settlement may continue after the summon entrance. */
export const FLAMING_SPHERE_ENTRANCE_DURATION_MS = 1_300
/**
 * Atlas playback reaches and holds the mature summon frame at the settlement
 * boundary. The entrance itself may remain projected longer while waiting for
 * the persistent Konva layer to report that it has actually painted.
 */
export const FLAMING_SPHERE_ANIMATION_DURATION_MS = 2_100
/** Safety bound for a failed or abandoned entrance-to-area visual handoff. */
export const FLAMING_SPHERE_HANDOFF_TIMEOUT_MS = 120_000
export const WALL_OF_FIRE_HANDOFF_TIMEOUT_MS = 120_000
export const MOONBEAM_ANIMATION_DURATION_MS = 1_350
export const DAYLIGHT_ANIMATION_DURATION_MS = 1_350
export const BLACK_TENTACLES_ANIMATION_DURATION_MS = 1_400
export const SPIKE_GROWTH_ANIMATION_DURATION_MS = 1_350
export const MAGE_HAND_ANIMATION_DURATION_MS = 1_200
export const SPIRITUAL_WEAPON_ANIMATION_DURATION_MS = 1_250
export const SPIRIT_GUARDIANS_ANIMATION_DURATION_MS = 1_350
export const CALL_LIGHTNING_ANIMATION_DURATION_MS = 1_400
export const CALL_LIGHTNING_STRIKE_ANIMATION_DURATION_MS = 950
export const INSECT_PLAGUE_ANIMATION_DURATION_MS = 1_350
export const WALL_OF_FIRE_ANIMATION_DURATION_MS = 1_400
export const BLADE_BARRIER_ANIMATION_DURATION_MS = 1_350
export const CLOUDKILL_ANIMATION_DURATION_MS = 1_400
export const CHAIN_LIGHTNING_ANIMATION_DURATION_MS = 1_050
export const DISINTEGRATE_ANIMATION_DURATION_MS = 1_150

/** Core spells whose entrance must remain painted until the authoritative area is visible. */
export const PERSISTENT_AREA_PRESENTATION_SPELL_IDS: ReadonlySet<CombatPresentationAreaSpellId> = new Set([
  'mage-hand',
  'darkness',
  'daylight',
  'grease',
  'entangle',
  'black-tentacles',
  'flaming-sphere',
  'spiritual-weapon',
  'spike-growth',
  'spirit-guardians',
  'moonbeam',
  'call-lightning',
  'wall-of-fire',
  'insect-plague',
  'cloudkill',
  'blade-barrier',
  'ice-storm',
])

export function isPersistentAreaPresentationSpellId(
  spellId: CombatPresentationAreaSpellId,
): boolean {
  return PERSISTENT_AREA_PRESENTATION_SPELL_IDS.has(spellId)
}
export const BLESS_MANIFESTATION_DURATION_MS = 1_000
export const BANE_MANIFESTATION_DURATION_MS = 1_000
export const SHIELD_OF_FAITH_MANIFESTATION_DURATION_MS = 1_000
export const MAGE_ARMOR_MANIFESTATION_DURATION_MS = 1_000
export const JUMP_MANIFESTATION_DURATION_MS = 1_000
export const DARKVISION_MANIFESTATION_DURATION_MS = 1_000
export const SEE_INVISIBILITY_MANIFESTATION_DURATION_MS = 1_000
export const WARDING_BOND_MANIFESTATION_DURATION_MS = 1_000
export const FLY_MANIFESTATION_DURATION_MS = 1_000
export const HEROISM_MANIFESTATION_DURATION_MS = 1_000
export const ENLARGE_REDUCE_MANIFESTATION_DURATION_MS = 1_000
export const ENHANCE_ABILITY_MANIFESTATION_DURATION_MS = 1_000
export const DIVINE_FAVOR_MANIFESTATION_DURATION_MS = 1_000
export const HUNTERS_MARK_MANIFESTATION_DURATION_MS = 1_000
export const MAGIC_WEAPON_MANIFESTATION_DURATION_MS = 1_000
export const FLAME_BLADE_MANIFESTATION_DURATION_MS = 1_000
export const INVISIBILITY_MANIFESTATION_DURATION_MS = 1_000
export const BLUR_MANIFESTATION_DURATION_MS = 1_000
export const BARKSKIN_MANIFESTATION_DURATION_MS = 1_000
export const PROTECTION_FROM_POISON_MANIFESTATION_DURATION_MS = 1_000
export const LONGSTRIDER_MANIFESTATION_DURATION_MS = 1_000
export const PROTECTION_FROM_ENERGY_MANIFESTATION_DURATION_MS = 1_000
export const DEATH_WARD_MANIFESTATION_DURATION_MS = 1_000
export const GREATER_INVISIBILITY_MANIFESTATION_DURATION_MS = 1_000
export const CHARM_PERSON_MANIFESTATION_DURATION_MS = 1_000
export const HIDEOUS_LAUGHTER_MANIFESTATION_DURATION_MS = 1_000
export const HOLD_PERSON_MANIFESTATION_DURATION_MS = 1_000
export const BLINDNESS_DEAFNESS_MANIFESTATION_DURATION_MS = 1_000
export const COMBAT_PRESENTATION_EVENT_TTL_MS = 1_600
export const FIREBALL_ANIMATION_START_DELAY_MS = 1_000
export const SPELL_BANNER_TOTAL_DURATION_MS = 3_000
export const FIREBALL_PRESENTATION_EVENT_TTL_MS =
  Math.max(
    SPELL_BANNER_TOTAL_DURATION_MS,
    FIREBALL_ANIMATION_START_DELAY_MS + FIREBALL_ANIMATION_DURATION_MS,
  ) + 500
export const KILL_STREAK_EFFECT_DURATION_MS = 4_000
export const KILL_STREAK_BANNER_DURATION_MS = 4_000
export const KILL_STREAK_BANNER_START_DELAY_MS = 650
export const KILL_STREAK_PRESENTATION_EVENT_TTL_MS = 5_800
export const SAVING_THROW_PENDING_TTL_MS = 300_000
export const SAVING_THROW_RESULT_TTL_MS = 3_000
export const SAVING_THROW_RESULT_HOLD_MS = 1_100
export const ATTACK_TARGET_EFFECT_DURATION_MS = 1_600

let combatPresentationClockOffsetMs = 0
let combatPresentationClockSampledAt = 0
let combatPresentationClockPromise: Promise<number> | null = null
const localCombatPresentationListeners = new Set<(event: unknown) => void>()

/**
 * 发布端立即投影表现事件，随后再交给共享事件流同步至其他客户端。
 * 服务器 SSE 会把同一事件回送给发布端；表现 reducer 依靠稳定事件 ID 去重。
 */
async function publishSharedEvent<T>(channel: string, data: T): Promise<void> {
  if (channel === COMBAT_PRESENTATION_CHANNEL) {
    const type = data && typeof data === 'object' && 'type' in data
      ? String((data as { type?: unknown }).type ?? '')
      : ''
    if (
      getRoomRulesSnapshot()?.houseRules.spellAnimationsEnabled === false &&
      [
        'spell-projectile',
        'spell-area-projectile',
        'spell-area-effect',
        'spell-target-effect',
        'spell-persistent-target-effect',
        'spell-save-target-effect',
      ].includes(type)
    ) return
  }
  if (channel === COMBAT_PRESENTATION_CHANNEL) {
    for (const listener of [...localCombatPresentationListeners]) listener(data)
  }
  await publishSharedTransportEvent(channel, data)
}

export function subscribeLocalCombatPresentationEvent(
  listener: (event: unknown) => void,
): () => void {
  localCombatPresentationListeners.add(listener)
  return () => localCombatPresentationListeners.delete(listener)
}

export function combatPresentationServerNow(localNow = Date.now()): number {
  return localNow + combatPresentationClockOffsetMs
}

function combatPresentationLocalTime(serverTimestamp: number): number {
  return serverTimestamp - combatPresentationClockOffsetMs
}

export async function refreshCombatPresentationClock(force = false): Promise<number> {
  if (!force && Date.now() - combatPresentationClockSampledAt < 60_000) {
    return combatPresentationClockOffsetMs
  }
  if (combatPresentationClockPromise) return combatPresentationClockPromise
  combatPresentationClockPromise = sampleSharedServerClock(2)
    .then((sample) => {
      if (sample) {
        combatPresentationClockOffsetMs = sample.offsetMs
        combatPresentationClockSampledAt = sample.sampledAt
      }
      return combatPresentationClockOffsetMs
    })
    .finally(() => {
      combatPresentationClockPromise = null
    })
  return combatPresentationClockPromise
}

export interface CombatPresentationSpellProjectileEventV1 {
  schemaVersion: 1
  id: string
  type: 'spell-projectile'
  mapId: string
  transactionId: string
  spellId: CombatPresentationProjectileSpellId
  sourceTokenId: string
  targetTokenId: string
  accentColor?: string
  glowColor?: string
  /** Legacy field; new presentations deliberately begin before attack resolution. */
  outcome?: 'hit' | 'miss'
  createdAt: number
  expiresAt: number
}

export interface CombatPresentationFireballEventV1 {
  schemaVersion: 1
  id: string
  type: 'spell-area-projectile'
  mapId: string
  transactionId: string
  spellId: 'fireball'
  sourceTokenId: string
  casterName: string
  spellName: string
  castingClassId: string
  targetCell: { col: number; row: number }
  radiusFeet: number
  createdAt: number
  animationStartsAt: number
  expiresAt: number
}

export interface CombatPresentationAreaSpellEventV1 {
  schemaVersion: 1
  id: string
  type: 'spell-area-effect'
  mapId: string
  transactionId: string
  spellId: CombatPresentationAreaSpellId
  sourceTokenId: string
  targetCell: { col: number; row: number }
  shape: 'cone' | 'line' | 'circle' | 'rect'
  lengthFeet?: number
  widthFeet?: number
  heightFeet?: number
  radiusFeet?: number
  wallOfFireShape?: 'line' | 'ring'
  wallOfFireAngleDegrees?: number
  createdAt: number
  expiresAt: number
}

export interface CombatPresentationSpellBannerEventV1 {
  schemaVersion: 1
  id: string
  type: 'spell-banner'
  mapId: string
  transactionId: string
  spellId: string
  sourceTokenId: string
  casterName: string
  spellName: string
  castingClassId: string
  createdAt: number
  expiresAt: number
}

export interface CombatPresentationAttackBannerEventV1 {
  schemaVersion: 1
  id: string
  type: 'attack-banner'
  mapId: string
  transactionId: string
  sourceTokenId: string
  /** Present for single-creature attacks; omitted by legacy banner events. */
  targetTokenId?: string
  actorName: string
  attackName: string
  attackKind: 'melee' | 'ranged' | 'action'
  classId: string
  createdAt: number
  expiresAt: number
}

export interface CombatPresentationShockingGraspEventV1 {
  schemaVersion: 1
  id: string
  type: 'spell-target-effect'
  mapId: string
  transactionId: string
  spellId: CombatPresentationTargetEffectSpellId
  sourceTokenId: string
  targetTokenId: string
  accentColor?: string
  glowColor?: string
  createdAt: number
  expiresAt: number
}

export interface CombatPresentationChillTouchEventV1 {
  schemaVersion: 1
  id: string
  type: 'spell-persistent-target-effect'
  mapId: string
  transactionId: string
  spellId: 'chill-touch'
  sourceTokenId: string
  targetTokenId: string
  createdAt: number
  expiresAt: number
}

export interface CombatPresentationSacredFlameEventV1 {
  schemaVersion: 1
  id: string
  type: 'spell-save-target-effect'
  mapId: string
  transactionId: string
  spellId: 'sacred-flame'
  sourceTokenId: string
  targetTokenId: string
  /** Legacy field; new presentations deliberately begin before save resolution. */
  outcome?: 'failed-save' | 'successful-save'
  createdAt: number
  expiresAt: number
}

export interface CombatPresentationKillStreakEventV1 {
  schemaVersion: 1
  id: string
  type: 'kill-streak'
  mapId: string
  transactionId: string
  sourceTokenId: string
  actorName: string
  classId: string
  style: 'arcane' | 'martial'
  killCount: 3
  createdAt: number
  bannerStartsAt: number
  expiresAt: number
}

export type CombatPresentationSavingThrowAbility = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

const COMBAT_PRESENTATION_SAVING_THROW_ABILITIES: readonly CombatPresentationSavingThrowAbility[] = [
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
]

export function combatPresentationSavingThrowAbilityLabel(
  ability: CombatPresentationSavingThrowAbility,
): string {
  return {
    str: '力量豁免',
    dex: '敏捷豁免',
    con: '体质豁免',
    int: '智力豁免',
    wis: '感知豁免',
    cha: '魅力豁免',
  }[ability]
}

function isCombatPresentationSavingThrowAbility(
  value: unknown,
): value is CombatPresentationSavingThrowAbility {
  return COMBAT_PRESENTATION_SAVING_THROW_ABILITIES.includes(
    value as CombatPresentationSavingThrowAbility,
  )
}

export interface CombatPresentationSavingThrowEventV1 {
  schemaVersion: 1
  id: string
  type: 'saving-throw-status'
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
  targetName: string
  ability: CombatPresentationSavingThrowAbility
  phase: 'rolling' | 'result'
  dc: number
  total?: number
  success?: boolean
  createdAt: number
  expiresAt: number
}

export type CombatPresentationEventV1 =
  | CombatPresentationSpellProjectileEventV1
  | CombatPresentationFireballEventV1
  | CombatPresentationAreaSpellEventV1
  | CombatPresentationSpellBannerEventV1
  | CombatPresentationShockingGraspEventV1
  | CombatPresentationChillTouchEventV1
  | CombatPresentationSacredFlameEventV1
  | CombatPresentationKillStreakEventV1
  | CombatPresentationSavingThrowEventV1
  | CombatPresentationAttackBannerEventV1

export interface CombatPresentationState {
  spellProjectiles: CombatPresentationEventV1[]
}

export interface CombatPresentationMapProjectile {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  kind:
    | 'fire-bolt'
    | 'fireball'
    | 'shocking-grasp'
    | 'chill-touch'
    | 'ray-of-frost'
    | 'eldritch-blast'
    | 'produce-flame'
    | 'guidance'
    | 'resistance'
    | 'sanctuary'
    | 'sacred-flame'
    | 'spare-the-dying'
    | 'acid-splash'
    | 'poison-spray'
    | 'vicious-mockery'
    | 'magic-missile'
    | 'scorching-ray'
    | 'guiding-bolt'
    | 'acid-arrow'
    | 'cure-wounds'
    | 'healing-word'
    | 'inflict-wounds'
    | 'chain-lightning'
    | 'disintegrate'
    | 'hellish-rebuke'
    | 'blight'
    | 'finger-of-death'
    | 'power-word-stun'
    | 'power-word-kill'
    | 'false-life'
    | 'burning-hands'
    | 'thunderwave'
    | 'shatter'
    | 'lightning-bolt'
    | 'flame-strike'
    | 'sunburst'
    | 'cone-of-cold'
    | 'circle-of-death'
    | 'ice-storm'
    | 'freezing-sphere'
    | 'meteor-swarm'
    | 'color-spray'
    | 'faerie-fire'
    | 'sleep'
    | 'entangle'
    | 'grease'
    | 'darkness'
    | 'flaming-sphere'
    | 'moonbeam'
    | 'daylight'
    | 'black-tentacles'
    | 'spike-growth'
    | 'mage-hand'
    | 'spiritual-weapon'
    | 'spirit-guardians'
    | 'call-lightning'
    | 'call-lightning-strike'
    | 'insect-plague'
    | 'wall-of-fire'
    | 'blade-barrier'
    | 'bless'
    | 'bane'
    | 'shield-of-faith'
    | 'mage-armor'
    | 'jump'
    | 'darkvision'
    | 'see-invisibility'
    | 'warding-bond'
    | 'fly'
    | 'heroism'
    | 'enlarge-reduce'
    | 'enhance-ability'
    | 'divine-favor'
    | 'hunters-mark'
    | 'magic-weapon'
    | 'flame-blade'
    | 'invisibility'
    | 'blur'
    | 'barkskin'
    | 'protection-from-poison'
    | 'longstrider'
    | 'protection-from-energy'
    | 'death-ward'
    | 'greater-invisibility'
    | 'charm-person'
    | 'hideous-laughter'
    | 'hold-person'
    | 'blindness-deafness'
    | 'hypnotic-pattern'
    | 'slow'
    | 'phantasmal-killer'
    | 'banishment'
    | 'misty-step'
    | 'hold-monster'
    | 'counterspell'
    | 'dispel-magic'
    | 'shield'
    | 'lesser-restoration'
    | 'heal'
    | 'mass-cure-wounds'
    | 'mass-heal'
    | 'mass-healing-word'
    | 'prayer-of-healing'
    | 'dancing-lights'
    | 'minor-illusion'
    | 'thaumaturgy'
    | 'shillelagh'
    | 'cloudkill'
  hit: boolean
  issuedAt: number
  durationMs: number
  radiusPx?: number
  areaWidthPx?: number
  areaHeightPx?: number
  accentColor?: string
  glowColor?: string
  /** Persistent area whose painted visual explicitly releases this entrance. */
  handoffAreaId?: string
  areaShape?: 'line' | 'ring'
}

export interface CombatPresentationSpellBanner {
  id: string
  casterName: string
  spellId: string
  spellName: string
  castingClassId: string
  createdAt: number
  animationStartsAt: number
  expiresAt: number
}

export interface CombatPresentationAttackBanner {
  id: string
  actorName: string
  attackName: string
  attackKind: 'melee' | 'ranged' | 'action'
  classId: string
  createdAt: number
  expiresAt: number
}

export interface CombatPresentationAttackTargetEffect {
  id: string
  targetTokenId: string
  x: number
  y: number
  radiusPx: number
  attackKind: 'melee' | 'ranged'
  classId: string
  issuedAt: number
  durationMs: number
}

export interface CombatPresentationKillStreak {
  id: string
  actorName: string
  classId: string
  style: 'arcane' | 'martial'
  killCount: 3
  createdAt: number
  bannerStartsAt: number
  expiresAt: number
}

export interface CombatPresentationSavingThrow {
  id: string
  targetTokenId: string
  targetName: string
  ability: CombatPresentationSavingThrowAbility
  phase: 'rolling' | 'result'
  dc: number
  total?: number
  success?: boolean
  createdAt: number
  expiresAt: number
}

interface PresentationMap {
  id: string
  gridSize: number
  gridOffsetX?: number
  gridOffsetY?: number
  feetPerCell?: number
  width?: number
  height?: number
  tokens: readonly {
    id: string
    x: number
    y: number
    size?: number
  }[]
  dnd5ePluginAreas?: readonly {
    id: string
    sourceKind?: string
    coreSpellId?: string
  }[]
}

export const EMPTY_COMBAT_PRESENTATION_STATE: CombatPresentationState = {
  spellProjectiles: [],
}

function boundedId(value: unknown, maximum = 200): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= maximum
}

function hexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

export function parseCombatPresentationEvent(
  value: unknown,
): CombatPresentationEventV1 | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Partial<CombatPresentationEventV1>
  if (
    event.schemaVersion !== 1 ||
    !boundedId(event.id) || !boundedId(event.mapId, 160) ||
    !boundedId(event.transactionId) || !boundedId(event.sourceTokenId, 160) ||
    !Number.isFinite(event.createdAt) || !Number.isFinite(event.expiresAt) ||
    Number(event.createdAt) < 0 || Number(event.expiresAt) <= Number(event.createdAt) ||
    Number(event.expiresAt) - Number(event.createdAt) >
      (event.type === 'saving-throw-status'
        ? SAVING_THROW_PENDING_TTL_MS
        : event.type === 'spell-area-effect' && event.spellId != null && isPersistentAreaPresentationSpellId(event.spellId)
          ? WALL_OF_FIRE_HANDOFF_TIMEOUT_MS
          : Math.max(5_000, KILL_STREAK_PRESENTATION_EVENT_TTL_MS))
  ) return null
  if (event.type === 'spell-projectile') {
    if (
      !isCombatPresentationProjectileSpellId(event.spellId) ||
      !boundedId(event.targetTokenId, 160) ||
      (event.accentColor != null && !hexColor(event.accentColor)) ||
      (event.glowColor != null && !hexColor(event.glowColor)) ||
      event.outcome != null && event.outcome !== 'hit' && event.outcome !== 'miss'
    ) return null
    return event as CombatPresentationSpellProjectileEventV1
  }
  if (event.type === 'spell-area-projectile') {
    const fireball = event as Partial<CombatPresentationFireballEventV1>
    if (
      fireball.spellId !== 'fireball' ||
      !boundedId(fireball.casterName, 80) ||
      !boundedId(fireball.spellName, 80) ||
      !boundedId(fireball.castingClassId, 40) ||
      !fireball.targetCell ||
      !Number.isInteger(fireball.targetCell.col) ||
      !Number.isInteger(fireball.targetCell.row) ||
      fireball.targetCell.col < 0 || fireball.targetCell.row < 0 ||
      fireball.targetCell.col > 10_000 || fireball.targetCell.row > 10_000 ||
      !Number.isFinite(fireball.radiusFeet) ||
      Number(fireball.radiusFeet) <= 0 || Number(fireball.radiusFeet) > 200 ||
      !Number.isFinite(fireball.animationStartsAt) ||
      Number(fireball.animationStartsAt) !==
        Number(fireball.createdAt) + FIREBALL_ANIMATION_START_DELAY_MS
    ) return null
    return fireball as CombatPresentationFireballEventV1
  }
  if (event.type === 'spell-area-effect') {
    const area = event as Partial<CombatPresentationAreaSpellEventV1>
    const expected = isCombatPresentationAreaSpellId(area.spellId)
      ? COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS[area.spellId]
      : undefined
    if (
      !expected ||
      area.shape !== expected.shape ||
      area.lengthFeet !== expected.lengthFeet ||
      area.widthFeet !== expected.widthFeet ||
      area.heightFeet !== expected.heightFeet ||
      area.radiusFeet !== expected.radiusFeet ||
      (area.spellId === 'wall-of-fire' && (
        (area.wallOfFireShape != null && area.wallOfFireShape !== 'line' && area.wallOfFireShape !== 'ring') ||
        (area.wallOfFireAngleDegrees != null && (!Number.isFinite(area.wallOfFireAngleDegrees) || area.wallOfFireAngleDegrees < 0 || area.wallOfFireAngleDegrees >= 360))
      )) ||
      !area.targetCell ||
      !Number.isInteger(area.targetCell.col) ||
      !Number.isInteger(area.targetCell.row) ||
      area.targetCell.col < 0 || area.targetCell.row < 0 ||
      area.targetCell.col > 10_000 || area.targetCell.row > 10_000
    ) return null
    return area as CombatPresentationAreaSpellEventV1
  }
  if (event.type === 'spell-banner') {
    const banner = event as Partial<CombatPresentationSpellBannerEventV1>
    if (
      !boundedId(banner.spellId, 120) ||
      !boundedId(banner.casterName, 80) ||
      !boundedId(banner.spellName, 80) ||
      !boundedId(banner.castingClassId, 40)
    ) return null
    return banner as CombatPresentationSpellBannerEventV1
  }
  if (event.type === 'attack-banner') {
    const banner = event as Partial<CombatPresentationAttackBannerEventV1>
    if (
      !boundedId(banner.actorName, 80) ||
      !boundedId(banner.attackName, 80) ||
      (banner.attackKind !== 'melee' && banner.attackKind !== 'ranged' && banner.attackKind !== 'action') ||
      !boundedId(banner.classId, 40) ||
      (banner.targetTokenId != null && !boundedId(banner.targetTokenId, 160))
    ) return null
    return banner as CombatPresentationAttackBannerEventV1
  }
  if (event.type === 'spell-target-effect') {
    const effect = event as Partial<CombatPresentationShockingGraspEventV1>
    if (
      !isCombatPresentationTargetEffectSpellId(effect.spellId) ||
      !boundedId(effect.targetTokenId, 160) ||
      (effect.spellId === 'resistance' || effect.spellId === 'spare-the-dying') &&
        (!hexColor(effect.accentColor) || !hexColor(effect.glowColor))
    ) return null
    return effect as CombatPresentationShockingGraspEventV1
  }
  if (event.type === 'spell-persistent-target-effect') {
    const effect = event as Partial<CombatPresentationChillTouchEventV1>
    if (
      effect.spellId !== 'chill-touch' ||
      !boundedId(effect.targetTokenId, 160)
    ) return null
    return effect as CombatPresentationChillTouchEventV1
  }
  if (event.type === 'spell-save-target-effect') {
    const effect = event as Partial<CombatPresentationSacredFlameEventV1>
    if (
      effect.spellId !== 'sacred-flame' ||
      !boundedId(effect.targetTokenId, 160) ||
      effect.outcome != null &&
        effect.outcome !== 'failed-save' &&
        effect.outcome !== 'successful-save'
    ) return null
    return effect as CombatPresentationSacredFlameEventV1
  }
  if (event.type === 'kill-streak') {
    const streak = event as Partial<CombatPresentationKillStreakEventV1>
    if (
      !boundedId(streak.actorName, 80) ||
      !boundedId(streak.classId, 40) ||
      (streak.style !== 'arcane' && streak.style !== 'martial') ||
      streak.killCount !== 3 ||
      !Number.isFinite(streak.bannerStartsAt) ||
      Number(streak.bannerStartsAt) !==
        Number(streak.createdAt) + KILL_STREAK_BANNER_START_DELAY_MS
    ) return null
    return streak as CombatPresentationKillStreakEventV1
  }
  if (event.type === 'saving-throw-status') {
    const savingThrow = event as Partial<CombatPresentationSavingThrowEventV1>
    if (
      !boundedId(savingThrow.targetTokenId, 160) ||
      !boundedId(savingThrow.targetName, 80) ||
      !isCombatPresentationSavingThrowAbility(savingThrow.ability) ||
      (savingThrow.phase !== 'rolling' && savingThrow.phase !== 'result') ||
      !Number.isInteger(savingThrow.dc) ||
      Number(savingThrow.dc) < 0 ||
      Number(savingThrow.dc) > 100 ||
      (savingThrow.phase === 'rolling' &&
        (savingThrow.total != null || savingThrow.success != null)) ||
      (savingThrow.phase === 'result' &&
        (!Number.isInteger(savingThrow.total) ||
          Number(savingThrow.total) < -100 ||
          Number(savingThrow.total) > 200 ||
          typeof savingThrow.success !== 'boolean'))
    ) return null
    return savingThrow as CombatPresentationSavingThrowEventV1
  }
  return null
}

export function reduceCombatPresentationState(
  current: CombatPresentationState,
  value: unknown,
  now = Date.now(),
): CombatPresentationState {
  const retained = current.spellProjectiles.filter((event) => event.expiresAt > now)
  const event = parseCombatPresentationEvent(value)
  if (!event || event.expiresAt <= now) {
    return retained.length === current.spellProjectiles.length
      ? current
      : { spellProjectiles: retained }
  }
  const existingIndex = retained.findIndex((candidate) => candidate.id === event.id)
  if (existingIndex >= 0) {
    if (event.type !== 'saving-throw-status') return current
    return {
      spellProjectiles: retained
        .map((candidate, index) => index === existingIndex ? event : candidate)
        .slice(-32),
    }
  }
  return { spellProjectiles: [...retained, event].slice(-32) }
}

export function combatPresentationProjectilesForMap(
  state: CombatPresentationState,
  map: PresentationMap,
  now = Date.now(),
): CombatPresentationMapProjectile[] {
  return state.spellProjectiles.flatMap<CombatPresentationMapProjectile>((event) => {
    if (
      event.type === 'kill-streak' ||
      event.type === 'spell-banner' ||
      event.type === 'attack-banner' ||
      event.type === 'saving-throw-status'
    ) return []
    const animationDuration = event.spellId === 'fireball'
      ? FIREBALL_ANIMATION_DURATION_MS
      : event.spellId === 'shocking-grasp'
        ? SHOCKING_GRASP_ANIMATION_DURATION_MS
        : event.spellId === 'guidance'
          ? GUIDANCE_MANIFESTATION_DURATION_MS
          : event.spellId === 'resistance'
            ? RESISTANCE_MANIFESTATION_DURATION_MS
          : event.spellId === 'sanctuary'
            ? SANCTUARY_MANIFESTATION_DURATION_MS
          : event.spellId === 'sacred-flame'
            ? SACRED_FLAME_ANIMATION_DURATION_MS
          : event.spellId === 'spare-the-dying'
            ? SPARE_THE_DYING_ANIMATION_DURATION_MS
          : event.spellId === 'acid-splash'
            ? ACID_SPLASH_ANIMATION_DURATION_MS
          : event.spellId === 'poison-spray'
            ? POISON_SPRAY_ANIMATION_DURATION_MS
          : event.spellId === 'vicious-mockery'
            ? VICIOUS_MOCKERY_ANIMATION_DURATION_MS
          : event.spellId === 'magic-missile'
            ? MAGIC_MISSILE_ANIMATION_DURATION_MS
          : event.spellId === 'scorching-ray'
            ? SCORCHING_RAY_ANIMATION_DURATION_MS
          : event.spellId === 'guiding-bolt'
            ? GUIDING_BOLT_ANIMATION_DURATION_MS
          : event.spellId === 'acid-arrow'
            ? ACID_ARROW_ANIMATION_DURATION_MS
          : event.spellId === 'cure-wounds'
            ? CURE_WOUNDS_ANIMATION_DURATION_MS
          : event.spellId === 'healing-word'
            ? HEALING_WORD_ANIMATION_DURATION_MS
          : event.spellId === 'inflict-wounds'
            ? INFLICT_WOUNDS_ANIMATION_DURATION_MS
          : event.spellId === 'hellish-rebuke'
            ? HELLISH_REBUKE_ANIMATION_DURATION_MS
          : event.spellId === 'burning-hands'
            ? BURNING_HANDS_ANIMATION_DURATION_MS
          : event.spellId === 'thunderwave'
            ? THUNDERWAVE_ANIMATION_DURATION_MS
          : event.spellId === 'shatter'
            ? SHATTER_ANIMATION_DURATION_MS
          : event.spellId === 'lightning-bolt'
            ? LIGHTNING_BOLT_ANIMATION_DURATION_MS
          : event.spellId === 'blight'
            ? BLIGHT_ANIMATION_DURATION_MS
          : event.spellId === 'finger-of-death'
            ? FINGER_OF_DEATH_ANIMATION_DURATION_MS
          : event.spellId === 'power-word-stun'
            ? POWER_WORD_STUN_ANIMATION_DURATION_MS
          : event.spellId === 'power-word-kill'
            ? POWER_WORD_KILL_ANIMATION_DURATION_MS
          : event.spellId === 'flame-strike'
            ? FLAME_STRIKE_ANIMATION_DURATION_MS
          : event.spellId === 'sunburst'
            ? SUNBURST_ANIMATION_DURATION_MS
          : event.spellId === 'cone-of-cold'
            ? CONE_OF_COLD_ANIMATION_DURATION_MS
          : event.spellId === 'circle-of-death'
            ? CIRCLE_OF_DEATH_ANIMATION_DURATION_MS
          : event.spellId === 'ice-storm'
            ? ICE_STORM_ANIMATION_DURATION_MS
          : event.spellId === 'freezing-sphere'
            ? FREEZING_SPHERE_ANIMATION_DURATION_MS
          : event.spellId === 'meteor-swarm'
            ? METEOR_SWARM_ANIMATION_DURATION_MS
          : event.spellId === 'color-spray'
            ? COLOR_SPRAY_ANIMATION_DURATION_MS
          : event.spellId === 'faerie-fire'
            ? FAERIE_FIRE_ANIMATION_DURATION_MS
          : event.spellId === 'sleep'
            ? SLEEP_ANIMATION_DURATION_MS
          : event.spellId === 'entangle'
            ? ENTANGLE_ANIMATION_DURATION_MS
          : event.spellId === 'grease'
            ? GREASE_ANIMATION_DURATION_MS
          : event.spellId === 'darkness'
            ? DARKNESS_ANIMATION_DURATION_MS
          : event.spellId === 'flaming-sphere'
            ? FLAMING_SPHERE_ANIMATION_DURATION_MS
          : event.spellId === 'moonbeam'
            ? MOONBEAM_ANIMATION_DURATION_MS
          : event.spellId === 'daylight'
            ? DAYLIGHT_ANIMATION_DURATION_MS
          : event.spellId === 'black-tentacles'
            ? BLACK_TENTACLES_ANIMATION_DURATION_MS
          : event.spellId === 'spike-growth'
            ? SPIKE_GROWTH_ANIMATION_DURATION_MS
          : event.spellId === 'mage-hand'
            ? MAGE_HAND_ANIMATION_DURATION_MS
          : event.spellId === 'spiritual-weapon'
            ? SPIRITUAL_WEAPON_ANIMATION_DURATION_MS
          : event.spellId === 'spirit-guardians'
            ? SPIRIT_GUARDIANS_ANIMATION_DURATION_MS
          : event.spellId === 'call-lightning'
            ? CALL_LIGHTNING_ANIMATION_DURATION_MS
          : event.spellId === 'call-lightning-strike'
            ? CALL_LIGHTNING_STRIKE_ANIMATION_DURATION_MS
          : event.spellId === 'insect-plague'
            ? INSECT_PLAGUE_ANIMATION_DURATION_MS
          : event.spellId === 'wall-of-fire'
            ? WALL_OF_FIRE_ANIMATION_DURATION_MS
          : event.spellId === 'blade-barrier'
            ? BLADE_BARRIER_ANIMATION_DURATION_MS
          : event.spellId === 'false-life'
            ? FALSE_LIFE_ANIMATION_DURATION_MS
          : event.spellId === 'hypnotic-pattern'
            ? HYPNOTIC_PATTERN_ANIMATION_DURATION_MS
          : event.spellId === 'slow'
            ? SLOW_ANIMATION_DURATION_MS
          : event.spellId === 'phantasmal-killer'
            ? PHANTASMAL_KILLER_ANIMATION_DURATION_MS
          : event.spellId === 'banishment'
            ? BANISHMENT_ANIMATION_DURATION_MS
          : event.spellId === 'misty-step'
            ? MISTY_STEP_ANIMATION_DURATION_MS
          : event.spellId === 'hold-monster'
            ? HOLD_MONSTER_ANIMATION_DURATION_MS
          : event.spellId === 'counterspell'
            ? COUNTERSPELL_ANIMATION_DURATION_MS
          : event.spellId === 'dispel-magic'
            ? DISPEL_MAGIC_ANIMATION_DURATION_MS
          : event.spellId === 'shield'
            ? SHIELD_ANIMATION_DURATION_MS
          : event.spellId === 'lesser-restoration'
            ? LESSER_RESTORATION_ANIMATION_DURATION_MS
          : event.spellId === 'heal'
            ? HEAL_ANIMATION_DURATION_MS
          : event.spellId === 'mass-cure-wounds'
            ? MASS_CURE_WOUNDS_ANIMATION_DURATION_MS
          : event.spellId === 'mass-heal'
            ? MASS_HEAL_ANIMATION_DURATION_MS
          : event.spellId === 'mass-healing-word'
            ? MASS_HEALING_WORD_ANIMATION_DURATION_MS
          : event.spellId === 'prayer-of-healing'
            ? PRAYER_OF_HEALING_ANIMATION_DURATION_MS
          : event.spellId === 'dancing-lights'
            ? DANCING_LIGHTS_ANIMATION_DURATION_MS
          : event.spellId === 'minor-illusion'
            ? MINOR_ILLUSION_ANIMATION_DURATION_MS
          : event.spellId === 'thaumaturgy'
            ? THAUMATURGY_ANIMATION_DURATION_MS
          : event.spellId === 'shillelagh'
            ? SHILLELAGH_ANIMATION_DURATION_MS
          : event.spellId === 'chain-lightning'
            ? CHAIN_LIGHTNING_ANIMATION_DURATION_MS
          : event.spellId === 'disintegrate'
            ? DISINTEGRATE_ANIMATION_DURATION_MS
          : event.spellId === 'bless'
            ? BLESS_MANIFESTATION_DURATION_MS
          : event.spellId === 'bane'
            ? BANE_MANIFESTATION_DURATION_MS
          : event.spellId === 'shield-of-faith'
            ? SHIELD_OF_FAITH_MANIFESTATION_DURATION_MS
          : event.spellId === 'mage-armor'
            ? MAGE_ARMOR_MANIFESTATION_DURATION_MS
          : event.spellId === 'jump'
            ? JUMP_MANIFESTATION_DURATION_MS
          : event.spellId === 'darkvision'
            ? DARKVISION_MANIFESTATION_DURATION_MS
          : event.spellId === 'see-invisibility'
            ? SEE_INVISIBILITY_MANIFESTATION_DURATION_MS
          : event.spellId === 'warding-bond'
            ? WARDING_BOND_MANIFESTATION_DURATION_MS
          : event.spellId === 'fly'
            ? FLY_MANIFESTATION_DURATION_MS
          : event.spellId === 'heroism'
            ? HEROISM_MANIFESTATION_DURATION_MS
          : event.spellId === 'enlarge-reduce'
            ? ENLARGE_REDUCE_MANIFESTATION_DURATION_MS
          : event.spellId === 'enhance-ability'
            ? ENHANCE_ABILITY_MANIFESTATION_DURATION_MS
          : event.spellId === 'divine-favor'
            ? DIVINE_FAVOR_MANIFESTATION_DURATION_MS
          : event.spellId === 'hunters-mark'
            ? HUNTERS_MARK_MANIFESTATION_DURATION_MS
          : event.spellId === 'magic-weapon'
            ? MAGIC_WEAPON_MANIFESTATION_DURATION_MS
          : event.spellId === 'flame-blade'
            ? FLAME_BLADE_MANIFESTATION_DURATION_MS
          : event.spellId === 'invisibility'
            ? INVISIBILITY_MANIFESTATION_DURATION_MS
          : event.spellId === 'blur'
            ? BLUR_MANIFESTATION_DURATION_MS
          : event.spellId === 'barkskin'
            ? BARKSKIN_MANIFESTATION_DURATION_MS
          : event.spellId === 'protection-from-poison'
            ? PROTECTION_FROM_POISON_MANIFESTATION_DURATION_MS
          : event.spellId === 'longstrider'
            ? LONGSTRIDER_MANIFESTATION_DURATION_MS
          : event.spellId === 'protection-from-energy'
            ? PROTECTION_FROM_ENERGY_MANIFESTATION_DURATION_MS
          : event.spellId === 'death-ward'
            ? DEATH_WARD_MANIFESTATION_DURATION_MS
          : event.spellId === 'greater-invisibility'
            ? GREATER_INVISIBILITY_MANIFESTATION_DURATION_MS
          : event.spellId === 'charm-person'
            ? CHARM_PERSON_MANIFESTATION_DURATION_MS
          : event.spellId === 'hideous-laughter'
            ? HIDEOUS_LAUGHTER_MANIFESTATION_DURATION_MS
          : event.spellId === 'hold-person'
            ? HOLD_PERSON_MANIFESTATION_DURATION_MS
          : event.spellId === 'blindness-deafness'
            ? BLINDNESS_DEAFNESS_MANIFESTATION_DURATION_MS
        : event.spellId === 'chill-touch'
          ? CHILL_TOUCH_ANIMATION_DURATION_MS
          : event.spellId === 'ray-of-frost'
            ? RAY_OF_FROST_ANIMATION_DURATION_MS
            : event.spellId === 'eldritch-blast'
              ? ELDRITCH_BLAST_ANIMATION_DURATION_MS
              : event.spellId === 'produce-flame'
                ? PRODUCE_FLAME_ANIMATION_DURATION_MS
      : FIRE_BOLT_ANIMATION_DURATION_MS
    const animationStartsAt = event.type === 'spell-area-projectile'
      ? event.animationStartsAt
      : event.createdAt
    const awaitsPersistentVisual = event.type === 'spell-area-effect' &&
      isPersistentAreaPresentationSpellId(event.spellId)
    if (
      event.mapId !== map.id ||
      now < animationStartsAt ||
      (!awaitsPersistentVisual && animationStartsAt + animationDuration <= now)
    ) return []
    const source = map.tokens.find((token) => token.id === event.sourceTokenId)
    // Missing source generally means the server projection has hidden the caster
    // from this viewer. Never turn a presentation event into a position side channel.
    if (!source) return []
    if (event.type === 'spell-target-effect') {
      const target = map.tokens.find((token) => token.id === event.targetTokenId)
      if (!target) return []
      const gridSize = Math.max(1, map.gridSize)
      return [{
        id: event.id,
        from: { x: target.x, y: target.y },
        to: { x: target.x, y: target.y },
        kind: event.spellId,
        hit: true,
        issuedAt: combatPresentationLocalTime(event.createdAt),
        durationMs: animationDuration,
        radiusPx: gridSize * Math.max(1, target.size ?? 1) * (
          event.spellId === 'guidance'
            ? GUIDANCE_ORBIT_RADIUS_FACTOR
            : event.spellId === 'resistance'
              ? RESISTANCE_ORBIT_RADIUS_FACTOR
            : event.spellId === 'sanctuary'
              ? SANCTUARY_ORBIT_RADIUS_FACTOR
              : 0.62
        ),
        accentColor: event.accentColor,
        glowColor: event.glowColor,
      } satisfies CombatPresentationMapProjectile]
    }
    if (event.type === 'spell-persistent-target-effect') {
      const target = map.tokens.find((token) => token.id === event.targetTokenId)
      if (!target) return []
      const gridSize = Math.max(1, map.gridSize)
      return [{
        id: event.id,
        from: { x: target.x, y: target.y },
        to: { x: target.x, y: target.y },
        kind: 'chill-touch' as const,
        hit: true,
        issuedAt: combatPresentationLocalTime(event.createdAt),
        durationMs: CHILL_TOUCH_ANIMATION_DURATION_MS,
        radiusPx: gridSize * Math.max(1, target.size ?? 1) * 0.58,
      } satisfies CombatPresentationMapProjectile]
    }
    if (event.type === 'spell-save-target-effect') {
      const target = map.tokens.find((token) => token.id === event.targetTokenId)
      if (!target) return []
      const gridSize = Math.max(1, map.gridSize)
      return [{
        id: event.id,
        from: { x: target.x, y: target.y },
        to: { x: target.x, y: target.y },
        kind: 'sacred-flame' as const,
        hit: true,
        issuedAt: combatPresentationLocalTime(event.createdAt),
        durationMs: SACRED_FLAME_ANIMATION_DURATION_MS,
        radiusPx: gridSize * Math.max(1, target.size ?? 1) * 0.64,
      } satisfies CombatPresentationMapProjectile]
    }
    if (event.type === 'spell-area-projectile') {
      const gridSize = Math.max(1, map.gridSize)
      const to = {
        x: (map.gridOffsetX ?? 0) + (event.targetCell.col + 0.5) * gridSize,
        y: (map.gridOffsetY ?? 0) + (event.targetCell.row + 0.5) * gridSize,
      }
      if (
        (map.width != null && (to.x < 0 || to.x > map.width)) ||
        (map.height != null && (to.y < 0 || to.y > map.height))
      ) return []
      const dx = to.x - source.x
      const dy = to.y - source.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      const sourceRadius = gridSize * Math.max(1, source.size ?? 1) * 0.34
      return [{
        id: event.id,
        from: {
          x: source.x + dx / distance * sourceRadius,
          y: source.y + dy / distance * sourceRadius,
        },
        to,
        kind: 'fireball' as const,
        hit: true,
        // Konva uses the local clock. Translate the calibrated server timestamp
        // back into a local issuedAt while preserving elapsed time.
        issuedAt: combatPresentationLocalTime(animationStartsAt),
        durationMs: FIREBALL_ANIMATION_DURATION_MS,
        radiusPx: event.radiusFeet / Math.max(1, map.feetPerCell ?? 5) * gridSize,
      } satisfies CombatPresentationMapProjectile]
    }
    if (event.type === 'spell-area-effect') {
      const gridSize = Math.max(1, map.gridSize)
      const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
      const targetPoint = {
        x: (map.gridOffsetX ?? 0) + (event.targetCell.col + 0.5) * gridSize,
        y: (map.gridOffsetY ?? 0) + (event.targetCell.row + 0.5) * gridSize,
      }
      if (event.shape === 'circle') {
        return [{
          id: event.id,
          from: targetPoint,
          to: targetPoint,
          kind: event.spellId,
          hit: true,
          issuedAt: combatPresentationLocalTime(event.createdAt),
          durationMs: animationDuration,
          // Flaming Sphere is a one-cell effect token. Its presentation size is
          // deliberately independent of a map's feet-per-cell display setting.
          radiusPx: event.spellId === 'flaming-sphere'
            ? gridSize
            : (event.radiusFeet ?? 10) / feetPerCell * gridSize,
          handoffAreaId: isPersistentAreaPresentationSpellId(event.spellId)
            ? `core-spell-area:${event.transactionId}`
            : undefined,
        } satisfies CombatPresentationMapProjectile]
      }
      if (event.shape === 'rect') {
        const widthPx = (event.widthFeet ?? 20) / feetPerCell * gridSize
        const heightPx = (event.heightFeet ?? 20) / feetPerCell * gridSize
        const orientedStrip = event.spellId === 'wall-of-fire' || event.spellId === 'blade-barrier'
        const wallRadians = (event.wallOfFireAngleDegrees ?? 0) * Math.PI / 180
        const wallFrom = event.spellId === 'wall-of-fire'
          ? { x: targetPoint.x - Math.cos(wallRadians), y: targetPoint.y - Math.sin(wallRadians) }
          : source
        return [{
          id: event.id,
          from: orientedStrip ? wallFrom : targetPoint,
          to: targetPoint,
          kind: event.spellId,
          hit: true,
          issuedAt: combatPresentationLocalTime(event.createdAt),
          durationMs: animationDuration,
          radiusPx: event.spellId === 'wall-of-fire' && event.wallOfFireShape === 'ring'
            ? 10 / feetPerCell * gridSize
            : Math.max(widthPx, heightPx) / 2,
          areaWidthPx: widthPx,
          areaHeightPx: heightPx,
          handoffAreaId: isPersistentAreaPresentationSpellId(event.spellId)
            ? `core-spell-area:${event.transactionId}`
            : undefined,
          areaShape: event.wallOfFireShape,
        } satisfies CombatPresentationMapProjectile]
      }
      const aimDx = targetPoint.x - source.x
      const aimDy = targetPoint.y - source.y
      const aimDistance = Math.hypot(aimDx, aimDy)
      // Match skillTargeting.aimVector: selecting the caster's own cell means
      // a valid default direction to the right, never a zero-length texture.
      const aimUnit = aimDistance <= 0.0001
        ? { x: 1, y: 0 }
        : { x: aimDx / aimDistance, y: aimDy / aimDistance }
      const lengthPx = (event.lengthFeet ?? 15) / feetPerCell * gridSize
      return [{
        id: event.id,
        from: { x: source.x, y: source.y },
        to: {
          x: source.x + aimUnit.x * lengthPx,
          y: source.y + aimUnit.y * lengthPx,
        },
        kind: event.spellId,
        hit: true,
        issuedAt: combatPresentationLocalTime(event.createdAt),
        durationMs: animationDuration,
        areaWidthPx: (event.widthFeet ?? 5) / feetPerCell * gridSize,
      } satisfies CombatPresentationMapProjectile]
    }
    const target = map.tokens.find((token) => token.id === event.targetTokenId)
    if (!target) return []
    const dx = target.x - source.x
    const dy = target.y - source.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const ux = dx / distance
    const uy = dy / distance
    const gridSize = Math.max(1, map.gridSize)
    const sourceRadius = gridSize * Math.max(1, source.size ?? 1) * 0.34
    const from = {
      x: source.x + ux * sourceRadius,
      y: source.y + uy * sourceRadius,
    }
    const hit = true
    const to = { x: target.x, y: target.y }
    return [{
      id: event.id,
      from,
      to,
      kind: event.spellId,
      hit,
      issuedAt: combatPresentationLocalTime(event.createdAt),
      durationMs: animationDuration,
      accentColor: event.accentColor,
      glowColor: event.glowColor,
    } satisfies CombatPresentationMapProjectile]
  })
}

export function combatPresentationSpellBannerForMap(
  state: CombatPresentationState,
  mapId: string,
  now = Date.now(),
): CombatPresentationSpellBanner | null {
  const event = [...state.spellProjectiles].reverse().find((candidate) =>
    (candidate.type === 'spell-area-projectile' || candidate.type === 'spell-banner') &&
    candidate.mapId === mapId &&
    candidate.createdAt <= now &&
    candidate.createdAt + SPELL_BANNER_TOTAL_DURATION_MS > now,
  )
  if (!event || (event.type !== 'spell-area-projectile' && event.type !== 'spell-banner')) return null
  return {
    id: event.id,
    casterName: event.casterName,
    spellId: event.spellId,
    spellName: event.spellName,
    castingClassId: event.castingClassId,
    createdAt: event.createdAt,
    animationStartsAt: event.type === 'spell-area-projectile'
      ? event.animationStartsAt
      : event.createdAt,
    expiresAt: event.expiresAt,
  }
}

export function combatPresentationAttackTargetEffectsForMap(
  state: CombatPresentationState,
  map: PresentationMap,
  now = Date.now(),
): CombatPresentationAttackTargetEffect[] {
  return state.spellProjectiles.flatMap<CombatPresentationAttackTargetEffect>((event) => {
    if (
      event.type !== 'attack-banner' ||
      event.attackKind === 'action' ||
      !event.targetTokenId ||
      event.mapId !== map.id ||
      event.createdAt > now ||
      event.createdAt + ATTACK_TARGET_EFFECT_DURATION_MS <= now
    ) return []
    const target = map.tokens.find((token) => token.id === event.targetTokenId)
    if (!target) return []
    return [{
      id: `${event.id}:target`,
      targetTokenId: target.id,
      x: target.x,
      y: target.y,
      radiusPx: map.gridSize * Math.max(1, target.size ?? 1) * 0.5,
      attackKind: event.attackKind,
      classId: event.classId,
      issuedAt: combatPresentationLocalTime(event.createdAt),
      durationMs: ATTACK_TARGET_EFFECT_DURATION_MS,
    }]
  })
}

export function combatPresentationAttackBannerForMap(
  state: CombatPresentationState,
  mapId: string,
  now = Date.now(),
): CombatPresentationAttackBanner | null {
  const event = [...state.spellProjectiles].reverse().find((candidate) =>
    candidate.type === 'attack-banner' &&
    candidate.mapId === mapId &&
    candidate.createdAt <= now &&
    candidate.createdAt + SPELL_BANNER_TOTAL_DURATION_MS > now,
  )
  if (!event || event.type !== 'attack-banner') return null
  return {
    id: event.id,
    actorName: event.actorName,
    attackName: event.attackName,
    attackKind: event.attackKind,
    classId: event.classId,
    createdAt: event.createdAt,
    expiresAt: event.expiresAt,
  }
}

export function combatPresentationKillStreakForMap(
  state: CombatPresentationState,
  mapId: string,
  now = Date.now(),
): CombatPresentationKillStreak | null {
  const event = [...state.spellProjectiles].reverse().find((candidate) =>
    candidate.type === 'kill-streak' &&
    candidate.mapId === mapId &&
    candidate.createdAt <= now &&
    candidate.expiresAt > now,
  )
  if (!event || event.type !== 'kill-streak') return null
  return {
    id: event.id,
    actorName: event.actorName,
    classId: event.classId,
    style: event.style,
    killCount: event.killCount,
    createdAt: event.createdAt,
    bannerStartsAt: event.bannerStartsAt,
    expiresAt: event.expiresAt,
  }
}

export function combatPresentationSavingThrowForMap(
  state: CombatPresentationState,
  mapId: string,
  now = Date.now(),
): CombatPresentationSavingThrow | null {
  const event = [...state.spellProjectiles].reverse().find((candidate) =>
    candidate.type === 'saving-throw-status' &&
    candidate.mapId === mapId &&
    candidate.createdAt <= now &&
    candidate.expiresAt > now,
  )
  if (!event || event.type !== 'saving-throw-status') return null
  return {
    id: event.id,
    targetTokenId: event.targetTokenId,
    targetName: event.targetName,
    ability: event.ability,
    phase: event.phase,
    dc: event.dc,
    total: event.total,
    success: event.success,
    createdAt: event.createdAt,
    expiresAt: event.expiresAt,
  }
}

export async function publishSpellBannerPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  spellId: string
  casterName: string
  spellName: string
  castingClassId: string
}): Promise<{ completesAt: number }> {
  if (getRoomRulesSnapshot()?.houseRules.combatBannersEnabled === false) {
    return { completesAt: combatPresentationServerNow() }
  }
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-banner',
    ...input,
    createdAt,
    expiresAt: createdAt + SPELL_BANNER_TOTAL_DURATION_MS + 500,
  })
  return { completesAt: createdAt + SPELL_BANNER_TOTAL_DURATION_MS }
}

export async function publishAttackBannerPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId?: string
  actorName: string
  attackName: string
  attackKind: 'melee' | 'ranged' | 'action'
  classId: string
}): Promise<{ completesAt: number }> {
  if (getRoomRulesSnapshot()?.houseRules.combatBannersEnabled === false) {
    return { completesAt: combatPresentationServerNow() }
  }
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'attack-banner',
    ...input,
    createdAt,
    expiresAt: createdAt + SPELL_BANNER_TOTAL_DURATION_MS + 500,
  })
  return { completesAt: createdAt + SPELL_BANNER_TOTAL_DURATION_MS }
}

export async function publishFireBoltPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-projectile',
    spellId: 'fire-bolt',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + FIRE_BOLT_ANIMATION_DURATION_MS }
}

export async function publishRayOfFrostPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-projectile',
    spellId: 'ray-of-frost',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + RAY_OF_FROST_ANIMATION_DURATION_MS }
}

export async function publishEldritchBlastPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-projectile',
    spellId: 'eldritch-blast',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + ELDRITCH_BLAST_ANIMATION_DURATION_MS }
}

export async function publishProduceFlamePresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-projectile',
    spellId: 'produce-flame',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + PRODUCE_FLAME_ANIMATION_DURATION_MS }
}

type MaterialProjectilePresentationInput = {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}

type MagicMissilePresentationInput = MaterialProjectilePresentationInput & {
  sequenceIndex?: number
}

async function publishMaterialProjectile(
  spellId:
    | 'magic-missile'
    | 'scorching-ray'
    | 'guiding-bolt'
    | 'acid-arrow'
    | 'healing-word'
    | 'inflict-wounds'
    | 'chain-lightning'
    | 'disintegrate',
  durationMs: number,
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-projectile',
    spellId,
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + durationMs }
}

export function publishMagicMissilePresentation(
  input: MagicMissilePresentationInput,
): Promise<{ completesAt: number }> {
  const sequenceIndex = Math.max(0, Math.min(30, Math.floor(input.sequenceIndex ?? 0)))
  const delayMs = sequenceIndex * MAGIC_MISSILE_SEQUENCE_GAP_MS
  return refreshCombatPresentationClock().then(async () => {
    if (delayMs > 0) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs))
    }
    const createdAt = combatPresentationServerNow()
    await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
      schemaVersion: 1,
      type: 'spell-projectile',
      spellId: 'magic-missile',
      id: input.id,
      mapId: input.mapId,
      transactionId: input.transactionId,
      sourceTokenId: input.sourceTokenId,
      targetTokenId: input.targetTokenId,
      createdAt,
      expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
    })
    return { completesAt: createdAt + MAGIC_MISSILE_ANIMATION_DURATION_MS }
  })
}

export async function publishScorchingRayPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialProjectile('scorching-ray', SCORCHING_RAY_ANIMATION_DURATION_MS, input)
}

export async function publishGuidingBoltPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialProjectile('guiding-bolt', GUIDING_BOLT_ANIMATION_DURATION_MS, input)
}

export async function publishAcidArrowPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialProjectile('acid-arrow', ACID_ARROW_ANIMATION_DURATION_MS, input)
}

export async function publishHealingWordPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialProjectile('healing-word', HEALING_WORD_ANIMATION_DURATION_MS, input)
}

export async function publishInflictWoundsPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialProjectile('inflict-wounds', INFLICT_WOUNDS_ANIMATION_DURATION_MS, input)
}

export async function publishChainLightningPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialProjectile(
    'chain-lightning',
    CHAIN_LIGHTNING_ANIMATION_DURATION_MS,
    input,
  )
}

export async function publishDisintegratePresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialProjectile('disintegrate', DISINTEGRATE_ANIMATION_DURATION_MS, input)
}

type ColoredCantripPresentationInput = {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
  accentColor: string
  glowColor: string
}

async function publishColoredCantripProjectile(
  spellId: 'acid-splash' | 'poison-spray' | 'vicious-mockery',
  durationMs: number,
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-projectile',
    spellId,
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + durationMs }
}

export function publishAcidSplashPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishColoredCantripProjectile(
    'acid-splash',
    ACID_SPLASH_ANIMATION_DURATION_MS,
    input,
  )
}

export function publishPoisonSprayPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishColoredCantripProjectile(
    'poison-spray',
    POISON_SPRAY_ANIMATION_DURATION_MS,
    input,
  )
}

export function publishViciousMockeryPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishColoredCantripProjectile(
    'vicious-mockery',
    VICIOUS_MOCKERY_ANIMATION_DURATION_MS,
    input,
  )
}

export async function publishSpareTheDyingPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-target-effect',
    spellId: 'spare-the-dying',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + SPARE_THE_DYING_ANIMATION_DURATION_MS }
}

async function publishMaterialTargetEffect(
  spellId:
    | 'cure-wounds'
    | 'hellish-rebuke'
    | 'blight'
    | 'finger-of-death'
    | 'power-word-stun'
    | 'power-word-kill'
    | 'false-life'
    | 'hypnotic-pattern'
    | 'slow'
    | 'phantasmal-killer'
    | 'banishment'
    | 'misty-step'
    | 'hold-monster'
    | 'counterspell'
    | 'dispel-magic'
    | 'shield'
    | 'lesser-restoration'
    | 'heal'
    | 'mass-cure-wounds'
    | 'mass-heal'
    | 'mass-healing-word'
    | 'prayer-of-healing'
    | 'dancing-lights'
    | 'minor-illusion'
    | 'thaumaturgy'
    | 'shillelagh',
  durationMs: number,
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-target-effect',
    spellId,
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + durationMs }
}

export async function publishCureWoundsPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialTargetEffect('cure-wounds', CURE_WOUNDS_ANIMATION_DURATION_MS, input)
}

export async function publishHellishRebukePresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialTargetEffect('hellish-rebuke', HELLISH_REBUKE_ANIMATION_DURATION_MS, input)
}

export async function publishBlightPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialTargetEffect('blight', BLIGHT_ANIMATION_DURATION_MS, input)
}

export async function publishFingerOfDeathPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialTargetEffect(
    'finger-of-death',
    FINGER_OF_DEATH_ANIMATION_DURATION_MS,
    input,
  )
}

export async function publishPowerWordStunPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialTargetEffect(
    'power-word-stun',
    POWER_WORD_STUN_ANIMATION_DURATION_MS,
    input,
  )
}

export async function publishPowerWordKillPresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialTargetEffect(
    'power-word-kill',
    POWER_WORD_KILL_ANIMATION_DURATION_MS,
    input,
  )
}

export async function publishFalseLifePresentation(
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialTargetEffect(
    'false-life',
    FALSE_LIFE_ANIMATION_DURATION_MS,
    input,
  )
}

async function publishNewMaterialTargetPresentation(
  spellId:
    | 'hypnotic-pattern'
    | 'slow'
    | 'phantasmal-killer'
    | 'banishment'
    | 'misty-step'
    | 'hold-monster'
    | 'counterspell'
    | 'dispel-magic'
    | 'shield'
    | 'lesser-restoration',
  durationMs: number,
  input: MaterialProjectilePresentationInput,
): Promise<{ completesAt: number }> {
  return publishMaterialTargetEffect(spellId, durationMs, input)
}

export const publishHypnoticPatternPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation('hypnotic-pattern', HYPNOTIC_PATTERN_ANIMATION_DURATION_MS, input)
export const publishSlowPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation('slow', SLOW_ANIMATION_DURATION_MS, input)
export const publishPhantasmalKillerPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation('phantasmal-killer', PHANTASMAL_KILLER_ANIMATION_DURATION_MS, input)
export const publishBanishmentPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation('banishment', BANISHMENT_ANIMATION_DURATION_MS, input)
export const publishMistyStepPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation('misty-step', MISTY_STEP_ANIMATION_DURATION_MS, input)
export const publishHoldMonsterPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation('hold-monster', HOLD_MONSTER_ANIMATION_DURATION_MS, input)
export const publishCounterspellPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation('counterspell', COUNTERSPELL_ANIMATION_DURATION_MS, input)
export const publishDispelMagicPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation('dispel-magic', DISPEL_MAGIC_ANIMATION_DURATION_MS, input)
export const publishShieldPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation('shield', SHIELD_ANIMATION_DURATION_MS, input)
export const publishLesserRestorationPresentation = (input: MaterialProjectilePresentationInput) =>
  publishNewMaterialTargetPresentation(
    'lesser-restoration',
    LESSER_RESTORATION_ANIMATION_DURATION_MS,
    input,
  )
const NEW_TARGET_PRESENTATION_DURATIONS = {
  heal: HEAL_ANIMATION_DURATION_MS, 'mass-cure-wounds': MASS_CURE_WOUNDS_ANIMATION_DURATION_MS,
  'mass-heal': MASS_HEAL_ANIMATION_DURATION_MS, 'mass-healing-word': MASS_HEALING_WORD_ANIMATION_DURATION_MS,
  'prayer-of-healing': PRAYER_OF_HEALING_ANIMATION_DURATION_MS, 'dancing-lights': DANCING_LIGHTS_ANIMATION_DURATION_MS,
  'minor-illusion': MINOR_ILLUSION_ANIMATION_DURATION_MS, thaumaturgy: THAUMATURGY_ANIMATION_DURATION_MS,
  shillelagh: SHILLELAGH_ANIMATION_DURATION_MS,
} as const
export const publishNewTargetSpellPresentation = (
  spellId: keyof typeof NEW_TARGET_PRESENTATION_DURATIONS,
  input: MaterialProjectilePresentationInput,
) => publishMaterialTargetEffect(spellId, NEW_TARGET_PRESENTATION_DURATIONS[spellId], input)

async function publishStatusSpellManifestation(
  spellId:
    | 'bless'
    | 'bane'
    | 'shield-of-faith'
    | 'mage-armor'
    | 'jump'
    | 'darkvision'
    | 'see-invisibility'
    | 'warding-bond'
    | 'fly'
    | 'heroism'
    | 'enlarge-reduce'
    | 'enhance-ability'
    | 'divine-favor'
    | 'hunters-mark'
    | 'magic-weapon'
    | 'flame-blade'
    | 'invisibility'
    | 'blur'
    | 'barkskin'
    | 'protection-from-poison'
    | 'longstrider'
    | 'protection-from-energy'
    | 'death-ward'
    | 'greater-invisibility'
    | 'charm-person'
    | 'hideous-laughter'
    | 'hold-person'
    | 'blindness-deafness',
  durationMs: number,
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-target-effect',
    spellId,
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + durationMs }
}

export function publishBlessPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation('bless', BLESS_MANIFESTATION_DURATION_MS, input)
}

export function publishBanePresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation('bane', BANE_MANIFESTATION_DURATION_MS, input)
}

export function publishShieldOfFaithPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'shield-of-faith',
    SHIELD_OF_FAITH_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishMageArmorPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'mage-armor',
    MAGE_ARMOR_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishJumpPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation('jump', JUMP_MANIFESTATION_DURATION_MS, input)
}

export function publishDarkvisionPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation('darkvision', DARKVISION_MANIFESTATION_DURATION_MS, input)
}

export function publishSeeInvisibilityPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'see-invisibility',
    SEE_INVISIBILITY_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishWardingBondPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'warding-bond',
    WARDING_BOND_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishFlyPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation('fly', FLY_MANIFESTATION_DURATION_MS, input)
}

export function publishHeroismPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation('heroism', HEROISM_MANIFESTATION_DURATION_MS, input)
}

export function publishEnlargeReducePresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'enlarge-reduce',
    ENLARGE_REDUCE_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishEnhanceAbilityPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'enhance-ability',
    ENHANCE_ABILITY_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishDivineFavorPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'divine-favor',
    DIVINE_FAVOR_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishHuntersMarkPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'hunters-mark',
    HUNTERS_MARK_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishMagicWeaponPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'magic-weapon',
    MAGIC_WEAPON_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishFlameBladePresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'flame-blade',
    FLAME_BLADE_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishInvisibilityPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'invisibility',
    INVISIBILITY_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishBlurPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation('blur', BLUR_MANIFESTATION_DURATION_MS, input)
}

export function publishBarkskinPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation('barkskin', BARKSKIN_MANIFESTATION_DURATION_MS, input)
}

export function publishProtectionFromPoisonPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'protection-from-poison',
    PROTECTION_FROM_POISON_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishLongstriderPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'longstrider',
    LONGSTRIDER_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishProtectionFromEnergyPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'protection-from-energy',
    PROTECTION_FROM_ENERGY_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishDeathWardPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'death-ward',
    DEATH_WARD_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishGreaterInvisibilityPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'greater-invisibility',
    GREATER_INVISIBILITY_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishCharmPersonPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'charm-person',
    CHARM_PERSON_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishHideousLaughterPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'hideous-laughter',
    HIDEOUS_LAUGHTER_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishHoldPersonPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'hold-person',
    HOLD_PERSON_MANIFESTATION_DURATION_MS,
    input,
  )
}

export function publishBlindnessDeafnessPresentation(
  input: ColoredCantripPresentationInput,
): Promise<{ completesAt: number }> {
  return publishStatusSpellManifestation(
    'blindness-deafness',
    BLINDNESS_DEAFNESS_MANIFESTATION_DURATION_MS,
    input,
  )
}

export async function publishShockingGraspPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-target-effect',
    spellId: 'shocking-grasp',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + SHOCKING_GRASP_ANIMATION_DURATION_MS }
}

export async function publishGuidancePresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-target-effect',
    spellId: 'guidance',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + GUIDANCE_MANIFESTATION_DURATION_MS }
}

export async function publishResistancePresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
  accentColor: string
  glowColor: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-target-effect',
    spellId: 'resistance',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + RESISTANCE_MANIFESTATION_DURATION_MS }
}

export async function publishSanctuaryPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-target-effect',
    spellId: 'sanctuary',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + SANCTUARY_MANIFESTATION_DURATION_MS }
}

export async function publishSacredFlamePresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-save-target-effect',
    spellId: 'sacred-flame',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + SACRED_FLAME_ANIMATION_DURATION_MS }
}

export async function publishChillTouchPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-persistent-target-effect',
    spellId: 'chill-touch',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
  return { completesAt: combatPresentationServerNow() + CHILL_TOUCH_ANIMATION_DURATION_MS }
}

export async function publishFireballPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  casterName: string
  spellName: string
  castingClassId: string
  targetCell: { col: number; row: number }
  radiusFeet: number
}): Promise<{ animationStartsAt: number; completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  const animationStartsAt = createdAt + FIREBALL_ANIMATION_START_DELAY_MS
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-area-projectile',
    spellId: 'fireball',
    ...input,
    createdAt,
    animationStartsAt,
    expiresAt: createdAt + FIREBALL_PRESENTATION_EVENT_TTL_MS,
  })
  // The server rewrites the event clock when it accepts the broadcast. Starting
  // the authority wait after the request completes guarantees that settlement
  // cannot overtake a slower client's banner/projectile sequence.
  const authorityWaitStartsAt = combatPresentationServerNow()
  return {
    animationStartsAt: authorityWaitStartsAt + FIREBALL_ANIMATION_START_DELAY_MS,
    completesAt:
      authorityWaitStartsAt +
      Math.max(
        SPELL_BANNER_TOTAL_DURATION_MS,
        FIREBALL_ANIMATION_START_DELAY_MS + FIREBALL_ANIMATION_DURATION_MS,
      ),
  }
}

export async function publishAreaSpellPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  spellId: CombatPresentationAreaSpellId
  targetCell: { col: number; row: number }
  shape: 'cone' | 'line' | 'circle' | 'rect'
  lengthFeet?: number
  widthFeet?: number
  heightFeet?: number
  radiusFeet?: number
  wallOfFireShape?: 'line' | 'ring'
  wallOfFireAngleDegrees?: number
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  const duration = {
    'burning-hands': BURNING_HANDS_ANIMATION_DURATION_MS,
    thunderwave: THUNDERWAVE_ANIMATION_DURATION_MS,
    shatter: SHATTER_ANIMATION_DURATION_MS,
    'lightning-bolt': LIGHTNING_BOLT_ANIMATION_DURATION_MS,
    'flame-strike': FLAME_STRIKE_ANIMATION_DURATION_MS,
    sunburst: SUNBURST_ANIMATION_DURATION_MS,
    'cone-of-cold': CONE_OF_COLD_ANIMATION_DURATION_MS,
    'circle-of-death': CIRCLE_OF_DEATH_ANIMATION_DURATION_MS,
    'ice-storm': ICE_STORM_ANIMATION_DURATION_MS,
    'freezing-sphere': FREEZING_SPHERE_ANIMATION_DURATION_MS,
    'meteor-swarm': METEOR_SWARM_ANIMATION_DURATION_MS,
    'color-spray': COLOR_SPRAY_ANIMATION_DURATION_MS,
    'faerie-fire': FAERIE_FIRE_ANIMATION_DURATION_MS,
    sleep: SLEEP_ANIMATION_DURATION_MS,
    entangle: ENTANGLE_ANIMATION_DURATION_MS,
    grease: GREASE_ANIMATION_DURATION_MS,
    darkness: DARKNESS_ANIMATION_DURATION_MS,
    'flaming-sphere': FLAMING_SPHERE_ANIMATION_DURATION_MS,
    moonbeam: MOONBEAM_ANIMATION_DURATION_MS,
    daylight: DAYLIGHT_ANIMATION_DURATION_MS,
    'black-tentacles': BLACK_TENTACLES_ANIMATION_DURATION_MS,
    'spike-growth': SPIKE_GROWTH_ANIMATION_DURATION_MS,
    'mage-hand': MAGE_HAND_ANIMATION_DURATION_MS,
    'spiritual-weapon': SPIRITUAL_WEAPON_ANIMATION_DURATION_MS,
    'spirit-guardians': SPIRIT_GUARDIANS_ANIMATION_DURATION_MS,
    'call-lightning': CALL_LIGHTNING_ANIMATION_DURATION_MS,
    'call-lightning-strike': CALL_LIGHTNING_STRIKE_ANIMATION_DURATION_MS,
    'insect-plague': INSECT_PLAGUE_ANIMATION_DURATION_MS,
    'wall-of-fire': WALL_OF_FIRE_ANIMATION_DURATION_MS,
    'blade-barrier': BLADE_BARRIER_ANIMATION_DURATION_MS,
    cloudkill: CLOUDKILL_ANIMATION_DURATION_MS,
  }[input.spellId]
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-area-effect',
    ...input,
    createdAt,
    expiresAt: createdAt + (isPersistentAreaPresentationSpellId(input.spellId)
      ? WALL_OF_FIRE_HANDOFF_TIMEOUT_MS
      : Math.max(COMBAT_PRESENTATION_EVENT_TTL_MS, duration + 500)),
  })
  const settlementDelay = input.spellId === 'flaming-sphere'
    ? FLAMING_SPHERE_ENTRANCE_DURATION_MS
    : duration
  return { completesAt: combatPresentationServerNow() + settlementDelay }
}

export async function publishKillStreakPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  actorName: string
  classId: string
  style: 'arcane' | 'martial'
}): Promise<void> {
  if (getRoomRulesSnapshot()?.houseRules.combatBannersEnabled === false) return
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'kill-streak',
    ...input,
    killCount: 3,
    createdAt,
    bannerStartsAt: createdAt + KILL_STREAK_BANNER_START_DELAY_MS,
    expiresAt: createdAt + KILL_STREAK_PRESENTATION_EVENT_TTL_MS,
  })
}

export async function publishSavingThrowPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  targetTokenId: string
  targetName: string
  ability: CombatPresentationSavingThrowAbility
  phase: 'rolling' | 'result'
  dc: number
  total?: number
  success?: boolean
}): Promise<{ completesAt: number }> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'saving-throw-status',
    sourceTokenId: input.targetTokenId,
    ...input,
    createdAt,
    expiresAt: createdAt + (
      input.phase === 'rolling'
        ? SAVING_THROW_PENDING_TTL_MS
        : SAVING_THROW_RESULT_TTL_MS
    ),
  })
  return {
    completesAt: createdAt + (
      input.phase === 'result' ? SAVING_THROW_RESULT_HOLD_MS : 0
    ),
  }
}

export async function publishDexteritySavingThrowPresentation(
  input: Omit<Parameters<typeof publishSavingThrowPresentation>[0], 'ability'>,
): Promise<{ completesAt: number }> {
  return publishSavingThrowPresentation({ ...input, ability: 'dex' })
}
