import { useEffect, useMemo, useState } from 'react'
import {
  COMBAT_PRESENTATION_CHANNEL,
  EMPTY_COMBAT_PRESENTATION_STATE,
  combatPresentationKillStreakForMap,
  combatPresentationProjectilesForMap,
  combatPresentationServerNow,
  combatPresentationSpellBannerForMap,
  reduceCombatPresentationState,
  refreshCombatPresentationClock,
  type CombatPresentationMapProjectile,
  type CombatPresentationKillStreak,
  type CombatPresentationSpellBanner,
  type CombatPresentationState,
} from '../../lib/combatPresentation'
import { subscribeSharedEvent } from '../../lib/sharedApi'
import type { BattleMap } from '../../store/maps'

export interface CombatPresentationCoordinator {
  state: CombatPresentationState
  projectiles: CombatPresentationMapProjectile[]
  spellBanner: CombatPresentationSpellBanner | null
  killStreak: CombatPresentationKillStreak | null
}

export function useCombatPresentationCoordinator(
  map: BattleMap | null | undefined,
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
    return () => {
      cancelled = true
      unsubscribe()
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
    const timer = window.setInterval(() => setClockRevision((value) => value + 1), 50)
    return () => window.clearInterval(timer)
  }, [state.spellProjectiles.length])

  const projectiles = useMemo(
    () => map
      ? combatPresentationProjectilesForMap(state, map, combatPresentationServerNow())
      : [],
    [clockRevision, map, state],
  )

  const spellBanner = useMemo(
    () => map
      ? combatPresentationSpellBannerForMap(state, map.id, combatPresentationServerNow())
      : null,
    [clockRevision, map, state],
  )

  const killStreak = useMemo(
    () => map
      ? combatPresentationKillStreakForMap(state, map.id, combatPresentationServerNow())
      : null,
    [clockRevision, map, state],
  )

  return { state, projectiles, spellBanner, killStreak }
}
