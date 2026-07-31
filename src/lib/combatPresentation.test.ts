import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publishSharedEvent, sampleSharedServerClock } from './sharedApi'
import {
  ACID_SPLASH_ANIMATION_DURATION_MS,
  CHILL_TOUCH_ANIMATION_DURATION_MS,
  ELDRITCH_BLAST_ANIMATION_DURATION_MS,
  COMBAT_PRESENTATION_CHANNEL,
  COMBAT_PRESENTATION_EVENT_TTL_MS,
  EMPTY_COMBAT_PRESENTATION_STATE,
  FIRE_BOLT_ANIMATION_DURATION_MS,
  FIREBALL_ANIMATION_DURATION_MS,
  FIREBALL_ANIMATION_START_DELAY_MS,
  FIREBALL_PRESENTATION_EVENT_TTL_MS,
  GUIDANCE_MANIFESTATION_DURATION_MS,
  GUIDANCE_ORBIT_RADIUS_FACTOR,
  KILL_STREAK_BANNER_START_DELAY_MS,
  KILL_STREAK_PRESENTATION_EVENT_TTL_MS,
  MAGIC_MISSILE_ANIMATION_DURATION_MS,
  MAGIC_MISSILE_SEQUENCE_GAP_MS,
  PRODUCE_FLAME_ANIMATION_DURATION_MS,
  POISON_SPRAY_ANIMATION_DURATION_MS,
  RAY_OF_FROST_ANIMATION_DURATION_MS,
  RESISTANCE_MANIFESTATION_DURATION_MS,
  RESISTANCE_ORBIT_RADIUS_FACTOR,
  SAVING_THROW_PENDING_TTL_MS,
  SAVING_THROW_RESULT_HOLD_MS,
  SAVING_THROW_RESULT_TTL_MS,
  SANCTUARY_MANIFESTATION_DURATION_MS,
  SANCTUARY_ORBIT_RADIUS_FACTOR,
  SACRED_FLAME_ANIMATION_DURATION_MS,
  SHOCKING_GRASP_ANIMATION_DURATION_MS,
  SPARE_THE_DYING_ANIMATION_DURATION_MS,
  SPELL_BANNER_TOTAL_DURATION_MS,
  combatPresentationKillStreakForMap,
  combatPresentationProjectilesForMap,
  combatPresentationSavingThrowForMap,
  combatPresentationSpellBannerForMap,
  parseCombatPresentationEvent,
  publishChillTouchPresentation,
  publishDexteritySavingThrowPresentation,
  publishAttackBannerPresentation,
  publishSavingThrowPresentation,
  combatPresentationSavingThrowAbilityLabel,
  subscribeLocalCombatPresentationEvent,
  publishAcidSplashPresentation,
  publishEldritchBlastPresentation,
  publishFireBoltPresentation,
  publishFireballPresentation,
  publishGuidancePresentation,
  publishKillStreakPresentation,
  publishMagicMissilePresentation,
  publishProduceFlamePresentation,
  publishPoisonSprayPresentation,
  publishRayOfFrostPresentation,
  publishResistancePresentation,
  publishSanctuaryPresentation,
  publishSacredFlamePresentation,
  publishShockingGraspPresentation,
  publishSpareTheDyingPresentation,
  publishSpellBannerPresentation,
  reduceCombatPresentationState,
  refreshCombatPresentationClock,
  publishViciousMockeryPresentation,
  VICIOUS_MOCKERY_ANIMATION_DURATION_MS,
} from './combatPresentation'

vi.mock('./sharedApi', () => ({
  publishSharedEvent: vi.fn(async () => undefined),
  sampleSharedServerClock: vi.fn(async () => ({ offsetMs: 500, roundTripMs: 4, sampledAt: Date.now() })),
}))

const fireBolt = {
  schemaVersion: 1 as const,
  id: 'fire-bolt-transaction-1',
  type: 'spell-projectile' as const,
  mapId: 'map-a',
  transactionId: 'transaction-1',
  spellId: 'fire-bolt' as const,
  sourceTokenId: 'wizard',
  targetTokenId: 'goblin',
  createdAt: 1_000,
  expiresAt: 2_500,
}

const fireball = {
  schemaVersion: 1 as const,
  id: 'fireball-transaction-1',
  type: 'spell-area-projectile' as const,
  mapId: 'map-a',
  transactionId: 'transaction-fireball-1',
  spellId: 'fireball' as const,
  sourceTokenId: 'wizard',
  casterName: '星辉法师',
  spellName: '火球术',
  castingClassId: 'wizard',
  targetCell: { col: 5, row: 2 },
  radiusFeet: 20,
  createdAt: 1_000,
  animationStartsAt: 1_000 + FIREBALL_ANIMATION_START_DELAY_MS,
  expiresAt: 1_000 + FIREBALL_PRESENTATION_EVENT_TTL_MS,
}

const rayOfFrost = {
  ...fireBolt,
  id: 'ray-of-frost-transaction-1',
  transactionId: 'transaction-ray-of-frost-1',
  spellId: 'ray-of-frost' as const,
}

const eldritchBlast = {
  ...fireBolt,
  id: 'eldritch-blast-transaction-1',
  transactionId: 'transaction-eldritch-blast-1',
  spellId: 'eldritch-blast' as const,
}

const produceFlame = {
  ...fireBolt,
  id: 'produce-flame-transaction-1',
  transactionId: 'transaction-produce-flame-1',
  spellId: 'produce-flame' as const,
}

const shockingGrasp = {
  schemaVersion: 1 as const,
  id: 'shocking-grasp-transaction-1',
  type: 'spell-target-effect' as const,
  mapId: 'map-a',
  transactionId: 'transaction-shocking-grasp-1',
  spellId: 'shocking-grasp' as const,
  sourceTokenId: 'wizard',
  targetTokenId: 'goblin',
  createdAt: 1_000,
  expiresAt: 2_600,
}

const guidance = {
  ...shockingGrasp,
  id: 'guidance-transaction-1',
  transactionId: 'transaction-guidance-1',
  spellId: 'guidance' as const,
}

const resistance = {
  ...shockingGrasp,
  id: 'resistance-transaction-1',
  transactionId: 'transaction-resistance-1',
  spellId: 'resistance' as const,
  accentColor: '#3b82f6',
  glowColor: '#60a5fa',
}

const sanctuary = {
  ...shockingGrasp,
  id: 'sanctuary-transaction-1',
  transactionId: 'transaction-sanctuary-1',
  spellId: 'sanctuary' as const,
}

const chillTouch = {
  schemaVersion: 1 as const,
  id: 'chill-touch-transaction-1',
  type: 'spell-persistent-target-effect' as const,
  mapId: 'map-a',
  transactionId: 'transaction-chill-touch-1',
  spellId: 'chill-touch' as const,
  sourceTokenId: 'wizard',
  targetTokenId: 'goblin',
  createdAt: 1_000,
  expiresAt: 2_600,
}

const sacredFlame = {
  schemaVersion: 1 as const,
  id: 'sacred-flame-transaction-1',
  type: 'spell-save-target-effect' as const,
  mapId: 'map-a',
  transactionId: 'transaction-sacred-flame-1',
  spellId: 'sacred-flame' as const,
  sourceTokenId: 'wizard',
  targetTokenId: 'goblin',
  createdAt: 1_000,
  expiresAt: 2_600,
}

const killStreak = {
  schemaVersion: 1 as const,
  id: 'combat-1:2:1:wizard:kill-streak',
  type: 'kill-streak' as const,
  mapId: 'map-a',
  transactionId: 'combat-1:2:1:wizard',
  sourceTokenId: 'wizard',
  actorName: '星辉法师',
  classId: 'wizard',
  style: 'arcane' as const,
  killCount: 3 as const,
  createdAt: 1_000,
  bannerStartsAt: 1_000 + KILL_STREAK_BANNER_START_DELAY_MS,
  expiresAt: 1_000 + KILL_STREAK_PRESENTATION_EVENT_TTL_MS,
}

const map = {
  id: 'map-a',
  gridSize: 50,
  gridOffsetX: 0,
  gridOffsetY: 0,
  feetPerCell: 5,
  width: 500,
  height: 500,
  tokens: [
    { id: 'wizard', x: 50, y: 100, size: 1 },
    { id: 'goblin', x: 250, y: 100, size: 1 },
  ],
}

describe('combat presentation events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses bounded spell projectile events and rejects unsupported spell effects', () => {
    expect(parseCombatPresentationEvent(fireBolt)).toEqual(fireBolt)
    expect(parseCombatPresentationEvent(rayOfFrost)).toEqual(rayOfFrost)
    expect(parseCombatPresentationEvent(eldritchBlast)).toEqual(eldritchBlast)
    expect(parseCombatPresentationEvent(produceFlame)).toEqual(produceFlame)
    for (const spellId of ['acid-splash', 'poison-spray', 'vicious-mockery'] as const) {
      expect(parseCombatPresentationEvent({
        ...fireBolt,
        spellId,
        accentColor: '#d946ef',
        glowColor: '#e879f9',
      })).toMatchObject({ spellId, accentColor: '#d946ef', glowColor: '#e879f9' })
    }
    expect(parseCombatPresentationEvent({ ...fireBolt, spellId: 'unknown-cantrip' })).toBeNull()
    expect(parseCombatPresentationEvent({ ...fireBolt, expiresAt: fireBolt.createdAt + 6_000 })).toBeNull()
  })

  it('parses a bounded Fireball area projectile and rejects invalid area data', () => {
    expect(parseCombatPresentationEvent(fireball)).toEqual(fireball)
    expect(parseCombatPresentationEvent({
      ...fireball,
      targetCell: { col: -1, row: 2 },
    })).toBeNull()
    expect(parseCombatPresentationEvent({ ...fireball, radiusFeet: 500 })).toBeNull()
  })

  it('deduplicates dual-endpoint delivery and expires transient events', () => {
    const once = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, fireBolt, 1_100)
    expect(reduceCombatPresentationState(once, { ...fireBolt }, 1_100)).toBe(once)
    expect(reduceCombatPresentationState(once, null, 2_501).spellProjectiles).toEqual([])
  })

  it('parses and selects a synchronized three-kill presentation', () => {
    expect(parseCombatPresentationEvent(killStreak)).toEqual(killStreak)
    expect(parseCombatPresentationEvent({ ...killStreak, killCount: 2 })).toBeNull()
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      killStreak,
      1_100,
    )
    expect(combatPresentationKillStreakForMap(state, 'map-a', 1_100)).toMatchObject({
      actorName: '星辉法师',
      style: 'arcane',
      killCount: 3,
    })
    expect(combatPresentationProjectilesForMap(state, map, 1_100)).toEqual([])
  })

  it('uses the same target endpoint before the attack result is known', () => {
    const hitState = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, fireBolt, 1_100)
    const [hit] = combatPresentationProjectilesForMap(hitState, map, 1_100)
    expect(hit).toMatchObject({ kind: 'fire-bolt', hit: true, to: { x: 250, y: 100 } })
    expect(hit.from.x).toBeGreaterThan(50)
    expect(hit.durationMs).toBe(FIRE_BOLT_ANIMATION_DURATION_MS)

    const missState = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, {
      ...fireBolt, id: 'fire-bolt-transaction-2', outcome: 'miss',
    }, 1_100)
    const [miss] = combatPresentationProjectilesForMap(missState, map, 1_100)
    expect(miss).toMatchObject({ hit: true, to: { x: 250, y: 100 } })
  })

  it('projects a one-second Ray of Frost beam to the authoritative endpoint', () => {
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      rayOfFrost,
      1_100,
    )
    const [beam] = combatPresentationProjectilesForMap(state, map, 1_100)
    expect(beam).toMatchObject({
      kind: 'ray-of-frost',
      hit: true,
      to: { x: 250, y: 100 },
      durationMs: RAY_OF_FROST_ANIMATION_DURATION_MS,
    })
    expect(beam.from.x).toBeGreaterThan(50)
  })

  it('projects a purple Eldritch Blast ray to its independent endpoint', () => {
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      eldritchBlast,
      1_100,
    )
    const [beam] = combatPresentationProjectilesForMap(state, map, 1_100)
    expect(beam).toMatchObject({
      kind: 'eldritch-blast',
      hit: true,
      to: { x: 250, y: 100 },
      durationMs: ELDRITCH_BLAST_ANIMATION_DURATION_MS,
    })
  })

  it('projects Produce Flame as an independently-timed thrown orb', () => {
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      produceFlame,
      1_100,
    )
    const [orb] = combatPresentationProjectilesForMap(state, map, 1_100)
    expect(orb).toMatchObject({
      kind: 'produce-flame',
      hit: true,
      to: { x: 250, y: 100 },
      durationMs: PRODUCE_FLAME_ANIMATION_DURATION_MS,
    })
  })

  it('projects Shocking Grasp around the visible target for exactly one second', () => {
    expect(parseCombatPresentationEvent(shockingGrasp)).toEqual(shockingGrasp)
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      shockingGrasp,
      1_100,
    )
    const [effect] = combatPresentationProjectilesForMap(state, map, 1_100)
    expect(effect).toMatchObject({
      kind: 'shocking-grasp',
      from: { x: 250, y: 100 },
      to: { x: 250, y: 100 },
      durationMs: SHOCKING_GRASP_ANIMATION_DURATION_MS,
      radiusPx: 31,
    })
    expect(combatPresentationProjectilesForMap(
      state,
      map,
      shockingGrasp.createdAt + SHOCKING_GRASP_ANIMATION_DURATION_MS,
    )).toEqual([])
  })

  it('projects the Guidance manifestation around its target for one second', () => {
    expect(parseCombatPresentationEvent(guidance)).toEqual(guidance)
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      guidance,
      1_100,
    )
    const [effect] = combatPresentationProjectilesForMap(state, map, 1_100)
    expect(effect).toMatchObject({
      kind: 'guidance',
      to: { x: 250, y: 100 },
      durationMs: GUIDANCE_MANIFESTATION_DURATION_MS,
      radiusPx: 50 * GUIDANCE_ORBIT_RADIUS_FACTOR,
    })
  })

  it('projects a class-colored Resistance shield manifestation', () => {
    expect(parseCombatPresentationEvent(resistance)).toEqual(resistance)
    expect(parseCombatPresentationEvent({
      ...resistance,
      accentColor: 'blue',
    })).toBeNull()
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      resistance,
      1_100,
    )
    const [effect] = combatPresentationProjectilesForMap(state, map, 1_100)
    expect(effect).toMatchObject({
      kind: 'resistance',
      to: { x: 250, y: 100 },
      durationMs: RESISTANCE_MANIFESTATION_DURATION_MS,
      accentColor: '#3b82f6',
      glowColor: '#60a5fa',
      radiusPx: 50 * RESISTANCE_ORBIT_RADIUS_FACTOR,
    })
  })

  it('projects Sanctuary on the shared close status orbit around the target', () => {
    expect(parseCombatPresentationEvent(sanctuary)).toEqual(sanctuary)
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      sanctuary,
      1_100,
    )
    const [effect] = combatPresentationProjectilesForMap(state, map, 1_100)
    expect(effect).toMatchObject({
      kind: 'sanctuary',
      to: { x: 250, y: 100 },
      durationMs: SANCTUARY_MANIFESTATION_DURATION_MS,
      radiusPx: 50 * SANCTUARY_ORBIT_RADIUS_FACTOR,
    })
  })

  it('accepts and projects the next Headless active-effect manifestations', () => {
    for (const spellId of [
      'jump',
      'darkvision',
      'see-invisibility',
      'warding-bond',
      'fly',
      'heroism',
      'enlarge-reduce',
      'enhance-ability',
      'divine-favor',
      'hunters-mark',
      'magic-weapon',
      'flame-blade',
      'invisibility',
      'blur',
      'barkskin',
      'protection-from-poison',
      'longstrider',
      'protection-from-energy',
      'death-ward',
      'greater-invisibility',
      'charm-person',
      'hideous-laughter',
      'hold-person',
      'blindness-deafness',
    ] as const) {
      const event = {
        ...shockingGrasp,
        id: `${spellId}-manifestation`,
        transactionId: `${spellId}-transaction`,
        spellId,
        accentColor: '#8b5cf6',
        glowColor: '#c4b5fd',
      }
      expect(parseCombatPresentationEvent(event)).toEqual(event)
      const state = reduceCombatPresentationState(
        EMPTY_COMBAT_PRESENTATION_STATE,
        event,
        1_100,
      )
      expect(combatPresentationProjectilesForMap(state, map, 1_100)).toEqual([
        expect.objectContaining({
          kind: spellId,
          to: { x: 250, y: 100 },
          durationMs: 1_000,
          accentColor: '#8b5cf6',
          glowColor: '#c4b5fd',
        }),
      ])
    }
  })

  it('projects the same sacred golden flame before the saving throw result is known', () => {
    expect(parseCombatPresentationEvent(sacredFlame)).toEqual(sacredFlame)
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      sacredFlame,
      1_100,
    )
    const [effect] = combatPresentationProjectilesForMap(state, map, 1_100)
    expect(effect).toMatchObject({
      kind: 'sacred-flame',
      hit: true,
      to: { x: 250, y: 100 },
      durationMs: SACRED_FLAME_ANIMATION_DURATION_MS,
    })
    const savedState = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      { ...sacredFlame, id: 'sacred-flame-saved', outcome: 'successful-save' },
      1_100,
    )
    expect(combatPresentationProjectilesForMap(savedState, map, 1_100)[0]).toMatchObject({
      hit: true,
      to: { x: 250, y: 100 },
    })
  })

  it('projects the one-second Chill Touch manifestation at its attached target', () => {
    expect(parseCombatPresentationEvent(chillTouch)).toEqual(chillTouch)
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      chillTouch,
      1_100,
    )
    const [effect] = combatPresentationProjectilesForMap(state, map, 1_100)
    expect(effect).toMatchObject({
      kind: 'chill-touch',
      from: { x: 250, y: 100 },
      to: { x: 250, y: 100 },
      durationMs: CHILL_TOUCH_ANIMATION_DURATION_MS,
    })
    expect(effect.radiusPx).toBeCloseTo(29)
    expect(combatPresentationProjectilesForMap(
      state,
      map,
      chillTouch.createdAt + CHILL_TOUCH_ANIMATION_DURATION_MS,
    )).toEqual([])
  })

  it('does not reveal a projectile endpoint when either projected token is absent', () => {
    const state = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, fireBolt, 1_100)
    expect(combatPresentationProjectilesForMap(state, {
      ...map,
      tokens: map.tokens.filter((token) => token.id !== 'goblin'),
    }, 1_100)).toEqual([])
  })

  it('projects Fireball from the visible caster to the authoritative cell center and 20-foot radius', () => {
    expect(FIREBALL_ANIMATION_START_DELAY_MS).toBe(1_000)
    expect(SPELL_BANNER_TOTAL_DURATION_MS).toBe(3_000)
    const state = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, fireball, 1_100)
    expect(combatPresentationProjectilesForMap(state, map, 1_100)).toEqual([])
    expect(combatPresentationSpellBannerForMap(state, map.id, 1_100)).toMatchObject({
      spellName: '火球术',
      castingClassId: 'wizard',
    })
    const [projectile] = combatPresentationProjectilesForMap(
      state,
      map,
      fireball.animationStartsAt,
    )
    expect(projectile).toMatchObject({
      kind: 'fireball',
      to: { x: 275, y: 125 },
      radiusPx: 200,
      durationMs: FIREBALL_ANIMATION_DURATION_MS,
    })
    expect(projectile.from.x).toBeGreaterThan(map.tokens[0].x)
    expect(combatPresentationSpellBannerForMap(
      state,
      map.id,
      fireball.animationStartsAt + 1_500,
    )).toMatchObject({ spellName: '火球术' })
    expect(combatPresentationSpellBannerForMap(
      state,
      map.id,
      fireball.createdAt + SPELL_BANNER_TOTAL_DURATION_MS,
    )).toBeNull()
    expect(combatPresentationProjectilesForMap(state, {
      ...map,
      tokens: map.tokens.filter((token) => token.id !== 'wizard'),
    }, fireball.animationStartsAt)).toEqual([])
  })

  it('projects same-cell Thunderwave with the Headless default direction', () => {
    const thunderwave = {
      schemaVersion: 1 as const,
      id: 'thunderwave-same-cell',
      type: 'spell-area-effect' as const,
      mapId: map.id,
      transactionId: 'thunderwave-same-cell-transaction',
      spellId: 'thunderwave' as const,
      sourceTokenId: 'wizard',
      targetCell: { col: 0, row: 0 },
      shape: 'line' as const,
      lengthFeet: 15,
      widthFeet: 15,
      createdAt: 1_000,
      expiresAt: 2_600,
    }
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      thunderwave,
      1_100,
    )
    const [effect] = combatPresentationProjectilesForMap(state, {
      ...map,
      gridOffsetX: 25,
      gridOffsetY: 75,
    }, 1_100)
    expect(effect).toMatchObject({
      kind: 'thunderwave',
      from: { x: 50, y: 100 },
      to: { x: 200, y: 100 },
      areaWidthPx: 150,
    })
  })

  it('projects a synchronized banner-only spell without creating a map projectile', () => {
    const shatterBanner = {
      schemaVersion: 1 as const,
      id: 'shatter-banner-1',
      type: 'spell-banner' as const,
      mapId: map.id,
      transactionId: 'shatter-transaction',
      spellId: 'shatter',
      sourceTokenId: 'wizard',
      casterName: '吟游诗人',
      spellName: '粉碎音波',
      castingClassId: 'bard',
      createdAt: 1_000,
      expiresAt: 4_500,
    }
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      shatterBanner,
      1_100,
    )
    expect(combatPresentationSpellBannerForMap(state, map.id, 1_100)).toMatchObject({
      spellId: 'shatter',
      spellName: '粉碎音波',
      castingClassId: 'bard',
    })
    expect(combatPresentationProjectilesForMap(state, map, 1_100)).toEqual([])
    expect(combatPresentationSpellBannerForMap(
      state,
      map.id,
      shatterBanner.createdAt + SPELL_BANNER_TOTAL_DURATION_MS,
    )).toBeNull()
  })

  it('publishes a parser-valid synchronized banner event for Shatter', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(20_000)
    await refreshCombatPresentationClock(true)
    const schedule = await publishSpellBannerPresentation({
      id: 'shatter-banner-live-1',
      mapId: 'map-a',
      transactionId: 'shatter-live-1',
      sourceTokenId: 'bard',
      spellId: 'shatter',
      casterName: '吟游诗人',
      spellName: '粉碎音波',
      castingClassId: 'bard',
    })
    const event = vi.mocked(publishSharedEvent).mock.calls.at(-1)?.[1]
    expect(event).toMatchObject({
      type: 'spell-banner',
      spellId: 'shatter',
      spellName: '粉碎音波',
      castingClassId: 'bard',
    })
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(20_500 + SPELL_BANNER_TOTAL_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes a parser-valid Bard Thunderwave banner', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(21_000)
    await refreshCombatPresentationClock(true)
    await publishSpellBannerPresentation({
      id: 'thunderwave-banner-live-1',
      mapId: 'map-a',
      transactionId: 'thunderwave-live-1',
      sourceTokenId: 'bard',
      spellId: 'thunderwave',
      casterName: '吟游诗人',
      spellName: '雷鸣波',
      castingClassId: 'bard',
    })
    const event = vi.mocked(publishSharedEvent).mock.calls.at(-1)?.[1]
    expect(event).toMatchObject({
      type: 'spell-banner',
      spellId: 'thunderwave',
      spellName: '雷鸣波',
      castingClassId: 'bard',
    })
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    vi.useRealTimers()
  })

  it('publishes and projects melee and ranged attack banners', async () => {
    await publishAttackBannerPresentation({
      id: 'fighter-longbow:banner',
      mapId: map.id,
      transactionId: 'fighter-longbow',
      sourceTokenId: 'fighter',
      actorName: '战士',
      attackName: '长弓',
      attackKind: 'ranged',
      classId: 'fighter',
    })
    const event = vi.mocked(publishSharedEvent).mock.calls.at(-1)?.[1]
    expect(parseCombatPresentationEvent(event)).toEqual(expect.objectContaining({
      type: 'attack-banner',
      attackKind: 'ranged',
      attackName: '长弓',
    }))
  })

  it('publishes a complete server-clock event that the receiving parser accepts', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    await refreshCombatPresentationClock(true)
    const schedule = await publishFireBoltPresentation({
      id: 'fire-bolt-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-live-1',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
    })
    expect(sampleSharedServerClock).toHaveBeenCalled()
    expect(publishSharedEvent).toHaveBeenCalledWith(COMBAT_PRESENTATION_CHANNEL, expect.objectContaining({
      createdAt: 10_500,
      expiresAt: 10_500 + COMBAT_PRESENTATION_EVENT_TTL_MS,
    }))
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(10_500 + FIRE_BOLT_ANIMATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes the four class-colored cantrip animations before settlement', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(12_000)
    await refreshCombatPresentationClock(true)
    const common = {
      mapId: 'map-a',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
      accentColor: '#d946ef',
      glowColor: '#e879f9',
    }
    const schedules = await Promise.all([
      publishSpareTheDyingPresentation({
        ...common,
        id: 'spare-live',
        transactionId: 'spare-tx',
      }),
      publishAcidSplashPresentation({
        ...common,
        id: 'acid-live',
        transactionId: 'acid-tx',
      }),
      publishPoisonSprayPresentation({
        ...common,
        id: 'poison-live',
        transactionId: 'poison-tx',
      }),
      publishViciousMockeryPresentation({
        ...common,
        id: 'mockery-live',
        transactionId: 'mockery-tx',
      }),
    ])
    const events = vi.mocked(publishSharedEvent).mock.calls.map((call) => call[1])
    expect(events.map((event) => (event as { spellId?: string }).spellId)).toEqual([
      'spare-the-dying',
      'acid-splash',
      'poison-spray',
      'vicious-mockery',
    ])
    for (const event of events) {
      expect(parseCombatPresentationEvent(event)).not.toBeNull()
      expect(event).toMatchObject({
        accentColor: '#d946ef',
        glowColor: '#e879f9',
      })
    }
    expect(schedules.map((schedule) => schedule.completesAt - 12_500)).toEqual([
      SPARE_THE_DYING_ANIMATION_DURATION_MS,
      ACID_SPLASH_ANIMATION_DURATION_MS,
      POISON_SPRAY_ANIMATION_DURATION_MS,
      VICIOUS_MOCKERY_ANIMATION_DURATION_MS,
    ])
    vi.useRealTimers()
  })

  it('staggers fast Magic Missile events one dart at a time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(13_000)
    await refreshCombatPresentationClock(true)
    const schedulePromises = [
      publishMagicMissilePresentation({
        id: 'missile-tx:magic-missile:0',
        transactionId: 'missile-tx',
        mapId: 'map-a',
        sourceTokenId: 'wizard',
        targetTokenId: 'goblin',
        sequenceIndex: 0,
      }),
      publishMagicMissilePresentation({
        id: 'missile-tx:magic-missile:1',
        transactionId: 'missile-tx',
        mapId: 'map-a',
        sourceTokenId: 'wizard',
        targetTokenId: 'ogre',
        sequenceIndex: 1,
      }),
      publishMagicMissilePresentation({
        id: 'missile-tx:magic-missile:2',
        transactionId: 'missile-tx',
        mapId: 'map-a',
        sourceTokenId: 'wizard',
        targetTokenId: 'goblin',
        sequenceIndex: 2,
      }),
    ]
    await vi.advanceTimersByTimeAsync(MAGIC_MISSILE_SEQUENCE_GAP_MS * 2)
    const schedules = await Promise.all(schedulePromises)
    const events = vi.mocked(publishSharedEvent).mock.calls.map((call) => call[1])
    expect(events.map((event) => (event as { targetTokenId?: string }).targetTokenId))
      .toEqual(['goblin', 'ogre', 'goblin'])
    expect(events.map((event) => (event as { createdAt: number }).createdAt)).toEqual([
      13_500,
      13_500 + MAGIC_MISSILE_SEQUENCE_GAP_MS,
      13_500 + MAGIC_MISSILE_SEQUENCE_GAP_MS * 2,
    ])
    expect(schedules.map((schedule) => schedule.completesAt)).toEqual([
      13_500 + MAGIC_MISSILE_ANIMATION_DURATION_MS,
      13_500 + MAGIC_MISSILE_SEQUENCE_GAP_MS + MAGIC_MISSILE_ANIMATION_DURATION_MS,
      13_500 + MAGIC_MISSILE_SEQUENCE_GAP_MS * 2 + MAGIC_MISSILE_ANIMATION_DURATION_MS,
    ])
    vi.useRealTimers()
  })

  it('publishes a synchronized Ray of Frost beam', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(15_000)
    await refreshCombatPresentationClock(true)
    const schedule = await publishRayOfFrostPresentation({
      id: 'ray-of-frost-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-ray-of-frost-live-1',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'spell-projectile',
        spellId: 'ray-of-frost',
        createdAt: 15_500,
        expiresAt: 15_500 + COMBAT_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(15_500 + RAY_OF_FROST_ANIMATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes a synchronized Eldritch Blast ray', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(17_000)
    await refreshCombatPresentationClock(true)
    const schedule = await publishEldritchBlastPresentation({
      id: 'eldritch-blast-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-eldritch-blast-live-1',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'spell-projectile',
        spellId: 'eldritch-blast',
        createdAt: 17_500,
        expiresAt: 17_500 + COMBAT_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(17_500 + ELDRITCH_BLAST_ANIMATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes a synchronized Produce Flame orb', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(18_000)
    await refreshCombatPresentationClock(true)
    const schedule = await publishProduceFlamePresentation({
      id: 'produce-flame-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-produce-flame-live-1',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'spell-projectile',
        spellId: 'produce-flame',
        createdAt: 18_500,
        expiresAt: 18_500 + COMBAT_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(18_500 + PRODUCE_FLAME_ANIMATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes Fireball with a server-clock TTL long enough for travel and explosion', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(20_000)
    await refreshCombatPresentationClock(true)
    const schedule = await publishFireballPresentation({
      id: 'fireball-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-fireball-live-1',
      sourceTokenId: 'wizard',
      casterName: '星辉法师',
      spellName: '火球术',
      castingClassId: 'wizard',
      targetCell: { col: 5, row: 2 },
      radiusFeet: 20,
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(COMBAT_PRESENTATION_CHANNEL, expect.objectContaining({
      type: 'spell-area-projectile',
      spellId: 'fireball',
      createdAt: 20_500,
      animationStartsAt: 20_500 + FIREBALL_ANIMATION_START_DELAY_MS,
      expiresAt: 20_500 + FIREBALL_PRESENTATION_EVENT_TTL_MS,
    }))
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(20_500 + Math.max(
      SPELL_BANNER_TOTAL_DURATION_MS,
      FIREBALL_ANIMATION_START_DELAY_MS + FIREBALL_ANIMATION_DURATION_MS,
    ))
    vi.useRealTimers()
  })

  it('publishes a synchronized Shocking Grasp target effect', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(25_000)
    await refreshCombatPresentationClock(true)
    const schedule = await publishShockingGraspPresentation({
      id: 'shocking-grasp-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-shocking-grasp-live-1',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'spell-target-effect',
        spellId: 'shocking-grasp',
        createdAt: 25_500,
        expiresAt: 25_500 + COMBAT_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(25_500 + SHOCKING_GRASP_ANIMATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes a synchronized Guidance manifestation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(26_000)
    await refreshCombatPresentationClock(true)
    const schedule = await publishGuidancePresentation({
      id: 'guidance-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-guidance-live-1',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'spell-target-effect',
        spellId: 'guidance',
        createdAt: 26_500,
        expiresAt: 26_500 + COMBAT_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(26_500 + GUIDANCE_MANIFESTATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes a synchronized class-colored Resistance manifestation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(26_250)
    await refreshCombatPresentationClock(true)
    const schedule = await publishResistancePresentation({
      id: 'resistance-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-resistance-live-1',
      sourceTokenId: 'cleric',
      targetTokenId: 'goblin',
      accentColor: '#22c55e',
      glowColor: '#4ade80',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'spell-target-effect',
        spellId: 'resistance',
        accentColor: '#22c55e',
        glowColor: '#4ade80',
        createdAt: 26_750,
        expiresAt: 26_750 + COMBAT_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(26_750 + RESISTANCE_MANIFESTATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes a synchronized Sanctuary manifestation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(26_400)
    await refreshCombatPresentationClock(true)
    const schedule = await publishSanctuaryPresentation({
      id: 'sanctuary-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-sanctuary-live-1',
      sourceTokenId: 'cleric',
      targetTokenId: 'fighter',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'spell-target-effect',
        spellId: 'sanctuary',
        createdAt: 26_900,
        expiresAt: 26_900 + COMBAT_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    expect(schedule.completesAt).toBe(26_900 + SANCTUARY_MANIFESTATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes Sacred Flame before any saving throw outcome exists', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(26_500)
    await refreshCombatPresentationClock(true)
    const schedule = await publishSacredFlamePresentation({
      id: 'sacred-flame-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-sacred-flame-live-1',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'spell-save-target-effect',
        spellId: 'sacred-flame',
        createdAt: 27_000,
        expiresAt: 27_000 + COMBAT_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(event).not.toHaveProperty('outcome')
    expect(schedule.completesAt).toBe(27_000 + SACRED_FLAME_ANIMATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('publishes a synchronized Chill Touch manifestation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(27_000)
    await refreshCombatPresentationClock(true)
    const schedule = await publishChillTouchPresentation({
      id: 'chill-touch-live-1',
      mapId: 'map-a',
      transactionId: 'transaction-chill-touch-live-1',
      sourceTokenId: 'wizard',
      targetTokenId: 'goblin',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'spell-persistent-target-effect',
        spellId: 'chill-touch',
        createdAt: 27_500,
        expiresAt: 27_500 + COMBAT_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    expect(schedule.completesAt).toBe(27_500 + CHILL_TOUCH_ANIMATION_DURATION_MS)
    vi.useRealTimers()
  })

  it('replaces a pending Dexterity save marker with its final synchronized result', async () => {
    const pending = {
      schemaVersion: 1 as const,
      id: 'save:fireball:goblin',
      type: 'saving-throw-status' as const,
      mapId: 'map-a',
      transactionId: 'fireball-cast',
      sourceTokenId: 'goblin',
      targetTokenId: 'goblin',
      targetName: '地精',
      ability: 'dex' as const,
      phase: 'rolling' as const,
      dc: 15,
      createdAt: 1_000,
      expiresAt: 1_000 + SAVING_THROW_PENDING_TTL_MS,
    }
    const result = {
      ...pending,
      phase: 'result' as const,
      total: 17,
      success: true,
      createdAt: 2_000,
      expiresAt: 2_000 + SAVING_THROW_RESULT_TTL_MS,
    }
    const pendingState = reduceCombatPresentationState(EMPTY_COMBAT_PRESENTATION_STATE, pending, 1_000)
    expect(combatPresentationSavingThrowForMap(pendingState, 'map-a', 1_500)).toEqual(
      expect.objectContaining({ targetTokenId: 'goblin', phase: 'rolling', dc: 15 }),
    )
    const resultState = reduceCombatPresentationState(pendingState, result, 2_000)
    expect(resultState.spellProjectiles).toHaveLength(1)
    expect(combatPresentationSavingThrowForMap(resultState, 'map-a', 2_100)).toEqual(
      expect.objectContaining({ phase: 'result', total: 17, success: true }),
    )
    expect(parseCombatPresentationEvent({ ...result, total: undefined })).toBeNull()
  })

  it('publishes pending and final Dexterity save states using the calibrated server clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(28_000)
    await refreshCombatPresentationClock(true)
    const base = {
      id: 'save:fireball:goblin',
      mapId: 'map-a',
      transactionId: 'fireball-cast',
      targetTokenId: 'goblin',
      targetName: '地精',
      dc: 15,
    }
    await publishDexteritySavingThrowPresentation({ ...base, phase: 'rolling' })
    const resultSchedule = await publishDexteritySavingThrowPresentation({
      ...base,
      phase: 'result',
      total: 17,
      success: true,
    })
    expect(publishSharedEvent).toHaveBeenNthCalledWith(
      1,
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'saving-throw-status',
        ability: 'dex',
        phase: 'rolling',
        createdAt: 28_500,
        expiresAt: 28_500 + SAVING_THROW_PENDING_TTL_MS,
      }),
    )
    expect(publishSharedEvent).toHaveBeenNthCalledWith(
      2,
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'saving-throw-status',
        phase: 'result',
        total: 17,
        success: true,
        expiresAt: 28_500 + SAVING_THROW_RESULT_TTL_MS,
      }),
    )
    expect(resultSchedule.completesAt).toBe(28_500 + SAVING_THROW_RESULT_HOLD_MS)
    vi.useRealTimers()
  })

  it('publishes and labels all six saving-throw abilities', async () => {
    const abilities = [
      ['str', '力量豁免'],
      ['dex', '敏捷豁免'],
      ['con', '体质豁免'],
      ['int', '智力豁免'],
      ['wis', '感知豁免'],
      ['cha', '魅力豁免'],
    ] as const
    for (const [ability, label] of abilities) {
      expect(combatPresentationSavingThrowAbilityLabel(ability)).toBe(label)
      await publishSavingThrowPresentation({
        id: `save:spell:${ability}`,
        mapId: 'map-a',
        transactionId: `cast-${ability}`,
        targetTokenId: `target-${ability}`,
        targetName: '目标',
        ability,
        phase: 'rolling',
        dc: 15,
      })
      const event = vi.mocked(publishSharedEvent).mock.calls.at(-1)?.[1]
      expect(parseCombatPresentationEvent(event)).toEqual(
        expect.objectContaining({ type: 'saving-throw-status', ability }),
      )
    }
  })

  it('projects Dexterity save status locally before the SSE round trip', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(29_000)
    await refreshCombatPresentationClock(true)
    const received: unknown[] = []
    const unsubscribe = subscribeLocalCombatPresentationEvent((event) => received.push(event))
    try {
      await publishDexteritySavingThrowPresentation({
        id: 'save:fireball:local-goblin',
        mapId: 'map-a',
        transactionId: 'fireball-local-cast',
        targetTokenId: 'local-goblin',
        targetName: '地精',
        phase: 'rolling',
        dc: 15,
      })
    } finally {
      unsubscribe()
    }
    expect(received).toContainEqual(expect.objectContaining({
      type: 'saving-throw-status',
      targetTokenId: 'local-goblin',
      phase: 'rolling',
    }))
    vi.useRealTimers()
  })

  it('publishes a server-clock kill-streak event for every room client', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(30_000)
    await refreshCombatPresentationClock(true)
    await publishKillStreakPresentation({
      id: 'kill-streak-live-1',
      mapId: 'map-a',
      transactionId: 'combat:3:1:wizard',
      sourceTokenId: 'wizard',
      actorName: '星辉法师',
      classId: 'wizard',
      style: 'arcane',
    })
    expect(publishSharedEvent).toHaveBeenCalledWith(
      COMBAT_PRESENTATION_CHANNEL,
      expect.objectContaining({
        type: 'kill-streak',
        killCount: 3,
        createdAt: 30_500,
        bannerStartsAt: 30_500 + KILL_STREAK_BANNER_START_DELAY_MS,
        expiresAt: 30_500 + KILL_STREAK_PRESENTATION_EVENT_TTL_MS,
      }),
    )
    const event = vi.mocked(publishSharedEvent).mock.calls[0]?.[1]
    expect(parseCombatPresentationEvent(event)).not.toBeNull()
    vi.useRealTimers()
  })
})
