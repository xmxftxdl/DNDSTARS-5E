import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('dice iframe visibility handshake', () => {
  const d20Source = readFileSync(new URL('./DiceBoxD20Overlay.tsx', import.meta.url), 'utf8')
  const rollSource = readFileSync(new URL('./DiceBoxRollOverlay.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

  it('keeps both iframe variants hidden until their own ready message arrives', () => {
    for (const source of [d20Source, rollSource]) {
      expect(source).toContain("frameReady ? 'dice-box-frame--ready' : 'dice-box-frame--pending'")
      expect(source).toContain('event.source !== iframeRef.current?.contentWindow')
      expect(source).toContain('setFrameReady(true)')
    }
  })

  it('removes the browser default white iframe paint from the compositor', () => {
    expect(css).toMatch(/\.dice-box-frame--pending\s*{[^}]*visibility:\s*hidden;[^}]*opacity:\s*0\s*!important;/s)
    expect(css).toMatch(/\.dice-box-frame--ready\s*{[^}]*visibility:\s*visible;/s)
  })
})
