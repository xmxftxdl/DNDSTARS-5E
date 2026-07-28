import {
  publishSharedEvent as publishSharedTransportEvent,
  sampleSharedServerClock,
} from './sharedApi'

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
  spellId:
    | 'fire-bolt'
    | 'ray-of-frost'
    | 'eldritch-blast'
    | 'produce-flame'
    | 'acid-splash'
    | 'poison-spray'
    | 'vicious-mockery'
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
  actorName: string
  attackName: string
  attackKind: 'melee' | 'ranged'
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
  spellId: 'shocking-grasp' | 'guidance' | 'resistance' | 'sanctuary' | 'spare-the-dying'
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
  hit: boolean
  issuedAt: number
  durationMs: number
  radiusPx?: number
  accentColor?: string
  glowColor?: string
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
  attackKind: 'melee' | 'ranged'
  classId: string
  createdAt: number
  expiresAt: number
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
        : Math.max(5_000, KILL_STREAK_PRESENTATION_EVENT_TTL_MS))
  ) return null
  if (event.type === 'spell-projectile') {
    if (
      ![
        'fire-bolt',
        'ray-of-frost',
        'eldritch-blast',
        'produce-flame',
        'acid-splash',
        'poison-spray',
        'vicious-mockery',
      ].includes(String(event.spellId)) ||
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
      (banner.attackKind !== 'melee' && banner.attackKind !== 'ranged') ||
      !boundedId(banner.classId, 40)
    ) return null
    return banner as CombatPresentationAttackBannerEventV1
  }
  if (event.type === 'spell-target-effect') {
    const effect = event as Partial<CombatPresentationShockingGraspEventV1>
    if (
      effect.spellId !== 'shocking-grasp' &&
      effect.spellId !== 'guidance' &&
        effect.spellId !== 'resistance' &&
        effect.spellId !== 'sanctuary' &&
        effect.spellId !== 'spare-the-dying' ||
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
    if (
      event.mapId !== map.id ||
      now < animationStartsAt ||
      animationStartsAt + animationDuration <= now
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
        issuedAt: Date.now() - Math.max(0, now - event.createdAt),
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
        issuedAt: Date.now() - Math.max(0, now - event.createdAt),
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
        issuedAt: Date.now() - Math.max(0, now - event.createdAt),
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
        issuedAt: Date.now() - Math.max(0, now - animationStartsAt),
        durationMs: FIREBALL_ANIMATION_DURATION_MS,
        radiusPx: event.radiusFeet / Math.max(1, map.feetPerCell ?? 5) * gridSize,
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
      issuedAt: Date.now() - Math.max(0, now - event.createdAt),
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
  actorName: string
  attackName: string
  attackKind: 'melee' | 'ranged'
  classId: string
}): Promise<{ completesAt: number }> {
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

export async function publishKillStreakPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  actorName: string
  classId: string
  style: 'arcane' | 'martial'
}): Promise<void> {
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
