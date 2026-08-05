export const FLAMING_SPHERE_VISUAL_DIAMETER_GRID_FACTOR = 1.55

export interface PersistentAreaHandoffProjectile {
  kind?: string
  handoffAreaId?: string
}

/**
 * The transient entrance remains the visual owner until the persistent atlas
 * has loaded and painted. Merely receiving the authoritative area is not a
 * sufficient handoff signal because the two visuals live on different Konva
 * layers and may paint on different browser frames.
 */
export function retainPendingPersistentAreaEntrances<
  T extends PersistentAreaHandoffProjectile,
>(
  projectiles: readonly T[],
  readyAreaIds: ReadonlySet<string>,
): T[] {
  return projectiles.filter((projectile) =>
    !projectile.handoffAreaId ||
    !readyAreaIds.has(projectile.handoffAreaId),
  )
}

/** @deprecated Compatibility name for callers/tests created before the handoff became generic. */
export const retainPendingFlamingSphereEntrances = retainPendingPersistentAreaEntrances

export interface PersistentAreaVisualReadySchedule {
  requestFrame: (callback: FrameRequestCallback) => number
  cancelFrame: (frameId: number) => void
  drawLayer: () => boolean
  onReady: () => void
}

/**
 * Paint the persistent atlas across two animation-frame boundaries before
 * releasing the entrance layer. This makes the cross-layer handoff explicit
 * rather than relying on React commit order to imply canvas paint order.
 */
export function schedulePersistentAreaVisualReady({
  requestFrame,
  cancelFrame,
  drawLayer,
  onReady,
}: PersistentAreaVisualReadySchedule): () => void {
  let cancelled = false
  let firstFrame = 0
  let secondFrame = 0
  let firstPainted = false

  firstFrame = requestFrame(() => {
    if (cancelled) return
    firstPainted = drawLayer()
    secondFrame = requestFrame(() => {
      if (cancelled) return
      const secondPainted = drawLayer()
      if (firstPainted && secondPainted) onReady()
    })
  })

  return () => {
    cancelled = true
    if (firstFrame) cancelFrame(firstFrame)
    if (secondFrame) cancelFrame(secondFrame)
  }
}

/** @deprecated Compatibility name for the original Flaming Sphere-only implementation. */
export const scheduleFlamingSphereVisualReady = schedulePersistentAreaVisualReady
