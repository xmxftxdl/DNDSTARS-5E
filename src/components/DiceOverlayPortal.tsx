import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Highest interoperable signed z-index used by browsers for authored layers. */
export const DICE_OVERLAY_Z_INDEX = 2_147_483_647

export const DICE_OVERLAY_ROOT_CLASS_NAME = 'pointer-events-none fixed inset-0 isolate'

/**
 * Dice must not inherit the map, panel, or modal stacking context. Rendering at
 * document.body also makes its fixed viewport coordinates consistent on every
 * page and every client.
 */
export default function DiceOverlayPortal({ children }: { children: ReactNode }) {
  const layer = (
    <div
      data-testid="dice-overlay-top-layer"
      className={DICE_OVERLAY_ROOT_CLASS_NAME}
      style={{ zIndex: DICE_OVERLAY_Z_INDEX }}
    >
      {children}
    </div>
  )
  return typeof document === 'undefined' ? layer : createPortal(layer, document.body)
}
