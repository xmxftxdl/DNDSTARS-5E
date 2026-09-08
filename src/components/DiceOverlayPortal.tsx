import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Highest interoperable signed z-index used by browsers for authored layers. */
export const DICE_OVERLAY_Z_INDEX = 2_147_483_647

export type DiceOverlayLayer = 'backdrop' | 'dice' | 'foreground'

const DICE_OVERLAY_LAYER_Z_INDEX: Record<DiceOverlayLayer, number> = {
  backdrop: DICE_OVERLAY_Z_INDEX - 2,
  dice: DICE_OVERLAY_Z_INDEX - 1,
  foreground: DICE_OVERLAY_Z_INDEX,
}

export const DICE_OVERLAY_ROOT_CLASS_NAME = 'pointer-events-none fixed inset-0 isolate'

/**
 * Dice must not inherit the map, panel, or modal stacking context. Rendering at
 * document.body also makes its fixed viewport coordinates consistent on every
 * page and every client.
 */
export default function DiceOverlayPortal({
  children,
  layer = 'foreground',
}: {
  children: ReactNode
  layer?: DiceOverlayLayer
}) {
  const portalLayer = (
    <div
      data-testid="dice-overlay-top-layer"
      data-dice-overlay-layer={layer}
      className={DICE_OVERLAY_ROOT_CLASS_NAME}
      style={{ zIndex: DICE_OVERLAY_LAYER_Z_INDEX[layer] }}
    >
      {children}
    </div>
  )
  return typeof document === 'undefined' ? portalLayer : createPortal(portalLayer, document.body)
}
