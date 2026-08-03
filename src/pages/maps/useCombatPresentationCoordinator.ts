import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  COMBAT_PRESENTATION_CHANNEL,
  EMPTY_COMBAT_PRESENTATION_STATE,
  combatPresentationAttackTargetEffectsForMap,
  combatPresentationKillStreakForMap,
  combatPresentationAttackBannerForMap,
  combatPresentationProjectilesForMap,
  combatPresentationSavingThrowForMap,
  combatPresentationServerNow,
  combatPresentationSpellBannerForMap,
  reduceCombatPresentationState,
  refreshCombatPresentationClock,
  subscribeLocalCombatPresentationEvent,
  type CombatPresentationMapProjectile,
  type CombatPresentationKillStreak,
  type CombatPresentationAttackBanner,
  type CombatPresentationAttackTargetEffect,
  type CombatPresentationSpellBanner,
  type CombatPresentationSavingThrow,
  type CombatPresentationState,
} from '../../lib/combatPresentation'
import { subscribeSharedEvent } from '../../lib/sharedApi'
import type { BattleMap } from '../../store/maps'

const PRESENTATION_PROJECTION_TICK_MS = 125

export interface CombatPresentationCoordinator {
  state: CombatPresentationState
  projectiles: CombatPresentationMapProjectile[]
  attackTargetEffects: CombatPresentationAttackTargetEffect[]
  spellBanner: CombatPresentationSpellBanner | null
  killStreak: CombatPresentationKillStreak | null
  attackBanner: CombatPresentationAttackBanner | null
  savingThrow: CombatPresentationSavingThrow | null
}

export function useCombatPresentationCoordinator(
  map: BattleMap | null | undefined,
  options: {
    bannersEnabled?: boolean
    spellAnimationsEnabled?: boolean
  } = {},
): CombatPresentationCoordinator {
  const [state, setState] = useState<CombatPresentationState>(EMPTY_COMBAT_PRESENTATION_STATE)
  const [clockRevision, setClockRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    void refreshCombatPresentationClock().then(() => {
      if (!cancelled) setClockRevision((value) => value + 1)
    })
    const unsubscribe = subscribeSharedEvent(COMBAT_PRESENTATION_CHANNEL, (event) => {
      setState((current) => reduceCombatPresentationState(current, event, combatPresentationServerNow()))
    })
    const unsubscribeLocal = subscribeLocalCombatPresentationEvent((event) => {
      flushSync(() => {
        setState((current) => reduceCombatPresentationState(current, event, combatPresentationServerNow()))
      })
    })
    return () => {
      cancelled = true
      unsubscribe()
      unsubscribeLocal()
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((current) => reduceCombatPresentationState(current, null, combatPresentationServerNow()))
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (state.spellProjectiles.length === 0) return
    const timer = window.setInterval(
      () => setClockRevision((value) => value + 1),
      PRESENTATION_PROJECTION_TICK_MS,
    )
    return () => window.clearInterval(timer)
  }, [state.spellProjectiles.length])

  const projectiles = useMemo(
    () => {
      void clockRevision
      return map && options.spellAnimationsEnabled !== false
        ? combatPresentationProjectilesForMap(state, map, combatPresentationServerNow())
        : []
    },
    [clockRevision, map, options.spellAnimationsEnabled, state],
  )

  const attackTargetEffects = useMemo(
    () => {
      void clockRevision
      return map
        ? combatPresentationAttackTargetEffectsForMap(
            state,
            map,
            combatPresentationServerNow(),
          )
        : []
    },
    [clockRevision, map, state],
  )

  const spellBanner = useMemo(
    () => {
      void clockRevision
      return map && options.bannersEnabled !== false
        ? combatPresentationSpellBannerForMap(state, map.id, combatPresentationServerNow())
        : null
    },
    [clockRevision, map, options.bannersEnabled, state],
  )

  const killStreak = useMemo(
    () => {
      void clockRevision
      return map && options.bannersEnabled !== false
        ? combatPresentationKillStreakForMap(state, map.id, combatPresentationServerNow())
        : null
    },
    [clockRevision, map, options.bannersEnabled, state],
  )

  const attackBanner = useMemo(
    () => {
      void clockRevision
      return map && options.bannersEnabled !== false
        ? combatPresentationAttackBannerForMap(state, map.id, combatPresentationServerNow())
        : null
    },
    [clockRevision, map, options.bannersEnabled, state],
  )

  const savingThrow = useMemo(
    () => {
      void clockRevision
      return map
        ? combatPresentationSavingThrowForMap(state, map.id, combatPresentationServerNow())
        : null
    },
    [clockRevision, map, state],
  )

  return {
    state,
    projectiles,
    attackTargetEffects,
    spellBanner,
    killStreak,
    attackBanner,
    savingThrow,
  }
}
