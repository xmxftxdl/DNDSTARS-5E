import { truncateTokenMovementPath } from '../../lib/tokenMovementAnimation'

export interface Dnd5eMovementHazardTrace {
  tokenId: string
  to: { x: number; y: number }
  path: readonly { x: number; y: number }[]
  /** Absolute token-bottom elevation aligned one-to-one with `path`. */
  pathElevationsFeet?: readonly number[]
}

export interface Dnd5eEffectiveMovementHazardTrace extends Dnd5eMovementHazardTrace {
  plannedTo: { x: number; y: number }
}

/**
 * Settles one simultaneous source/drag movement in deterministic token order.
 *
 * Each settlement receives the context returned by the previous token. If the
 * source is stopped before its planned destination, every attached trace is
 * capped to the same translation instead of continuing past its grappler.
 */
export async function settleDnd5eMovementTracesSequentially<TContext>(input: {
  initialContext: TContext
  movements: readonly Dnd5eMovementHazardTrace[]
  settle: (input: {
    context: TContext
    movement: Dnd5eEffectiveMovementHazardTrace
    index: number
  }) => Promise<{
    context: TContext
    finalPosition: { x: number; y: number }
  }>
}): Promise<{
  context: TContext
  finalPositionByCombatantId: Readonly<Record<string, { x: number; y: number }>>
}> {
  let context = input.initialContext
  let sourceTranslation: { x: number; y: number } | undefined
  const finalPositionByCombatantId: Record<string, { x: number; y: number }> = {}

  for (const [index, movement] of input.movements.entries()) {
    const pathStart = movement.path[0] ?? movement.to
    const to = index > 0 && sourceTranslation
      ? { x: pathStart.x + sourceTranslation.x, y: pathStart.y + sourceTranslation.y }
      : movement.to
    const path = index > 0 && sourceTranslation
      ? truncateTokenMovementPath(movement.path, to)
      : movement.path
    const settled = await input.settle({
      context,
      movement: {
        tokenId: movement.tokenId,
        plannedTo: movement.to,
        to,
        path,
        pathElevationsFeet: movement.pathElevationsFeet?.slice(0, path.length),
      },
      index,
    })
    context = settled.context
    finalPositionByCombatantId[movement.tokenId] = settled.finalPosition
    if (index === 0 && (
      settled.finalPosition.x !== movement.to.x ||
      settled.finalPosition.y !== movement.to.y
    )) {
      sourceTranslation = {
        x: settled.finalPosition.x - pathStart.x,
        y: settled.finalPosition.y - pathStart.y,
      }
    }
  }

  return { context, finalPositionByCombatantId }
}
