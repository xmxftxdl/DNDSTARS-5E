import { useEffect, useMemo, useState } from 'react'
import {
  COMBAT_PRESENTATION_CHANNEL,
  EMPTY_COMBAT_PRESENTATION_STATE,
  combatPresentationProjectilesForMap,
  combatPresentationServerNow,
  reduceCombatPresentationState,
  refreshCombatPresentationClock,
  type CombatPresentationMapProjectile,
  type CombatPresentationState,
} from '../../lib/combatPresentation'
import { subscribeSharedEvent } from '../../lib/sharedApi'
import type { BattleMap } from '../../store/maps'

export interface CombatPresentationCoordinator {
  state: CombatPresentationState
  projectiles: CombatPresentationMapProjectile[]
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

  const projectiles = useMemo(
    () => map
      ? combatPresentationProjectilesForMap(state, map, combatPresentationServerNow())
      : [],
    [clockRevision, map, state],
  )

  return { state, projectiles }
}
