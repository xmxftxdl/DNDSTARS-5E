import { useCallback, useState } from 'react'
import type { Dnd5eTraversalMode } from '../../rulesets/dnd5e/traversal'

const clampElevation = (value: number) => Math.max(-1_000, Math.min(10_000, Math.round(value / 5) * 5))

export function usePlayerMovementController() {
  const [showMoveRange, setShowMoveRange] = useState(false)
  const [dnd5eCarefulMovement, setDnd5eCarefulMovement] = useState(false)
  const [dnd5eStandFromProne, setDnd5eStandFromProne] = useState(true)
  const [dnd5eTraversalMode, setDnd5eTraversalMode] = useState<Dnd5eTraversalMode>('walk')
  const [dnd5eFlightTargetElevationFeet, setDnd5eFlightTargetElevationFeet] = useState<number | null>(null)

  const begin = useCallback((currentElevationFeet = 0) => {
    setShowMoveRange(true)
    setDnd5eFlightTargetElevationFeet(clampElevation(currentElevationFeet))
  }, [])

  const clear = useCallback(() => {
    setShowMoveRange(false)
    setDnd5eCarefulMovement(false)
    setDnd5eStandFromProne(true)
    setDnd5eTraversalMode('walk')
    setDnd5eFlightTargetElevationFeet(null)
  }, [])

  const selectTraversalMode = useCallback((mode: Dnd5eTraversalMode, currentElevationFeet = 0) => {
    setDnd5eTraversalMode(mode)
    if (mode === 'fly') {
      setDnd5eFlightTargetElevationFeet((current) => current ?? clampElevation(currentElevationFeet))
    }
  }, [])

  const adjustFlightElevation = useCallback((deltaFeet: number, currentElevationFeet = 0) => {
    setDnd5eFlightTargetElevationFeet((current) =>
      clampElevation((current ?? currentElevationFeet) + deltaFeet),
    )
  }, [])

  const targetElevationFeet = useCallback((terrainElevationFeet: number, currentElevationFeet = 0) =>
    dnd5eTraversalMode === 'fly'
      ? dnd5eFlightTargetElevationFeet ?? currentElevationFeet
      : terrainElevationFeet,
  [dnd5eFlightTargetElevationFeet, dnd5eTraversalMode])

  return {
    showMoveRange,
    setShowMoveRange,
    dnd5eCarefulMovement,
    setDnd5eCarefulMovement,
    dnd5eStandFromProne,
    setDnd5eStandFromProne,
    dnd5eTraversalMode,
    setDnd5eTraversalMode,
    dnd5eFlightTargetElevationFeet,
    begin,
    clear,
    selectTraversalMode,
    adjustFlightElevation,
    targetElevationFeet,
  }
}
