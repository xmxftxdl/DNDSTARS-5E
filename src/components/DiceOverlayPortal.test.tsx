import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DiceOverlayPortal, {
  DICE_OVERLAY_ROOT_CLASS_NAME,
  DICE_OVERLAY_Z_INDEX,
} from './DiceOverlayPortal'

describe('DiceOverlayPortal', () => {
  it('uses a fixed, isolated layer above every authored application layer', () => {
    const html = renderToStaticMarkup(
      <DiceOverlayPortal><span>die</span></DiceOverlayPortal>,
    )

    expect(DICE_OVERLAY_Z_INDEX).toBe(2_147_483_647)
    expect(DICE_OVERLAY_ROOT_CLASS_NAME).toContain('fixed')
    expect(DICE_OVERLAY_ROOT_CLASS_NAME).toContain('isolate')
    expect(html).toContain('data-testid="dice-overlay-top-layer"')
    expect(html).toContain('data-dice-overlay-layer="foreground"')
    expect(html).toContain('z-index:2147483647')
  })

  it('keeps the tray text above the 3D dice and its leather backdrop', () => {
    const backdrop = renderToStaticMarkup(
      <DiceOverlayPortal layer="backdrop"><span>tray</span></DiceOverlayPortal>,
    )
    const dice = renderToStaticMarkup(
      <DiceOverlayPortal layer="dice"><span>dice</span></DiceOverlayPortal>,
    )

    expect(backdrop).toContain('data-dice-overlay-layer="backdrop"')
    expect(backdrop).toContain(`z-index:${DICE_OVERLAY_Z_INDEX - 2}`)
    expect(dice).toContain('data-dice-overlay-layer="dice"')
    expect(dice).toContain(`z-index:${DICE_OVERLAY_Z_INDEX - 1}`)
  })
})
