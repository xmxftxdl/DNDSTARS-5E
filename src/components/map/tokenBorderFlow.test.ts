import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DND5E_CLASS_BORDER_BLUR_STD_DEVIATION,
  DND5E_CLASS_BORDER_DEEP_STROKE_OPACITY,
  DND5E_CLASS_BORDER_DEEP_STROKE_WIDTH,
  DND5E_CLASS_BORDER_FLOW_PERIOD_MS,
  DND5E_CLASS_BORDER_GRADIENT_STOPS,
  DND5E_CLASS_BORDER_TOP_STROKE_WIDTH,
} from '../../lib/dnd5eClassBorderVisual'
import {
  TOKEN_BORDER_FLOW_BASE_OPACITY,
  TOKEN_BORDER_FLOW_FPS,
  TOKEN_BORDER_FLOW_GRADIENT_STOPS,
  TOKEN_BORDER_FLOW_PERIOD_MS,
  tokenBorderFlowGradientColorStops,
  tokenBorderFlowGradientColors,
  tokenBorderFlowRotationDegrees,
  tokenBorderFlowWorldMetrics,
} from './tokenBorderFlow'

const WIZARD_PORTRAIT_PALETTE = {
  background: '#3B82F6',
  backgroundDeep: '#071A38',
  accent: '#DBEAFE',
  glow: '#60A5FA',
} as const

describe('map Token spell-portrait flow frame', () => {
  it('connects the Konva renderer to the shared frame contract', () => {
    const source = readFileSync(new URL('./MapCanvas.tsx', import.meta.url), 'utf8')
    expect(source).toContain('export default function MapCanvas')
    expect(source).toContain("from './tokenBorderFlow'")
  })

  it('reuses the spell portrait stops, opacity and slow shared period', () => {
    expect(TOKEN_BORDER_FLOW_FPS).toBe(60)
    expect(TOKEN_BORDER_FLOW_PERIOD_MS).toBe(DND5E_CLASS_BORDER_FLOW_PERIOD_MS)
    expect(TOKEN_BORDER_FLOW_PERIOD_MS).toBe(14_000)
    expect(TOKEN_BORDER_FLOW_GRADIENT_STOPS).toBe(DND5E_CLASS_BORDER_GRADIENT_STOPS)
    expect(TOKEN_BORDER_FLOW_BASE_OPACITY).toBe(DND5E_CLASS_BORDER_DEEP_STROKE_OPACITY)
  })

  it('maps accent, glow and white stops to the exact wizard portrait palette', () => {
    const colors = tokenBorderFlowGradientColors(WIZARD_PORTRAIT_PALETTE)
    expect(colors).toEqual([
      'rgba(219, 234, 254, 0.7)',
      'rgba(219, 234, 254, 0.74)',
      'rgba(96, 165, 250, 0.86)',
      'rgba(255, 255, 255, 1)',
      'rgba(96, 165, 250, 0.86)',
      'rgba(219, 234, 254, 0.74)',
      'rgba(219, 234, 254, 0.7)',
    ])
    expect(tokenBorderFlowGradientColorStops(WIZARD_PORTRAIT_PALETTE)).toEqual([
      0, colors[0],
      0.2, colors[1],
      0.38, colors[2],
      0.5, colors[3],
      0.62, colors[4],
      0.8, colors[5],
      1, colors[6],
    ])
  })

  it('scales the original 80x80 portrait measurements with the Token', () => {
    expect(tokenBorderFlowWorldMetrics(40)).toEqual({
      baseStrokeWidth: DND5E_CLASS_BORDER_DEEP_STROKE_WIDTH,
      flowStrokeWidth: DND5E_CLASS_BORDER_TOP_STROKE_WIDTH,
      glowBlur: DND5E_CLASS_BORDER_BLUR_STD_DEVIATION,
    })
    expect(tokenBorderFlowWorldMetrics(20)).toEqual({
      baseStrokeWidth: DND5E_CLASS_BORDER_DEEP_STROKE_WIDTH / 2,
      flowStrokeWidth: DND5E_CLASS_BORDER_TOP_STROKE_WIDTH / 2,
      glowBlur: DND5E_CLASS_BORDER_BLUR_STD_DEVIATION / 2,
    })
  })

  it('rotates the full gradient continuously across the loop boundary', () => {
    expect(tokenBorderFlowRotationDegrees(0)).toBe(0)
    expect(tokenBorderFlowRotationDegrees(7_000)).toBe(180)
    expect(tokenBorderFlowRotationDegrees(14_000)).toBe(0)
    expect(tokenBorderFlowRotationDegrees(15_250)).toBeCloseTo(32.142857)

    const before = tokenBorderFlowRotationDegrees(13_999)
    const after = tokenBorderFlowRotationDegrees(14_001)
    const absoluteDistance = Math.abs(before - after)
    const circularDistance = Math.min(absoluteDistance, 360 - absoluteDistance)
    expect(circularDistance).toBeLessThan(0.06)
  })

  it('uses the complete LOG-style gradient without a separate dashed segment', () => {
    const tokenNodeSource = readFileSync(new URL('./MapTokenNode.tsx', import.meta.url), 'utf8')
    const canvasSource = readFileSync(new URL('./MapCanvas.tsx', import.meta.url), 'utf8')
    const ringComponent = tokenNodeSource.slice(
      tokenNodeSource.indexOf('export function TokenBorderFlowRing'),
      tokenNodeSource.indexOf('export function TokenMovementPathLine'),
    )

    expect(`${canvasSource}\n${tokenNodeSource}`).not.toContain('createTokenBorderFlowTexture')
    expect(ringComponent).not.toContain('<KonvaImage')
    expect(ringComponent.match(/radius=\{ringRadius\}/g)).toHaveLength(2)
    expect(ringComponent).toContain('name="token-class-flow-support"')
    expect(ringComponent).toContain('name="token-class-flow-line"')
    expect(ringComponent).not.toContain('name="token-class-flow-highlight"')
    expect(ringComponent).toContain('strokeLinearGradientColorStops={gradientColorStops}')
    expect(ringComponent).toContain('rotation={initialFlowRotation}')
    expect(ringComponent).not.toContain('dashOffset=')
    expect(ringComponent).not.toContain('lineCap="round"')
    expect(canvasSource).toContain('performance.now()')
    expect(canvasSource).toContain('entry.flow.rotation(tokenBorderFlowRotationDegrees(flowNowMs))')
  })

  it('renders the full ring above portraits while keeping status and interactions above it', () => {
    const canvasSource = readFileSync(new URL('./MapCanvas.tsx', import.meta.url), 'utf8')
    const tokenNodeSource = readFileSync(new URL('./MapTokenNode.tsx', import.meta.url), 'utf8')
    const backgroundLayer = canvasSource.indexOf('name="map-background-layer"')
    const tokenBodyLayer = canvasSource.indexOf('name="token-body-layer"')
    const borderFlowLayer = canvasSource.indexOf('name="token-border-flow-layer"')
    const tokenForegroundLayer = canvasSource.indexOf('name="token-foreground-layer"')
    const tokenStatusContent = canvasSource.indexOf('name="token-status-content"')
    const interactionOverlayContent = canvasSource.indexOf('name="map-interaction-overlay-content"')

    expect(backgroundLayer).toBeGreaterThan(-1)
    expect(tokenBodyLayer).toBeGreaterThan(backgroundLayer)
    expect(borderFlowLayer).toBeGreaterThan(tokenBodyLayer)
    expect(tokenForegroundLayer).toBeGreaterThan(borderFlowLayer)
    expect(tokenStatusContent).toBeGreaterThan(tokenForegroundLayer)
    expect(interactionOverlayContent).toBeGreaterThan(tokenStatusContent)
    expect(canvasSource.match(/<Layer(?:\s|>)/g)).toHaveLength(5)
    expect(tokenNodeSource).toContain('const hasPresentationBorder = !!borderColor && !defeated')
    expect(tokenNodeSource).toContain('const bodyStrokeWidth = hasPresentationBorder ? 0 : baseStrokeW')
    expect(tokenNodeSource).toContain('const portraitClipInset = hasPresentationBorder ? 0')
    expect(tokenNodeSource).toContain('currentTurn && !borderColor')
    expect(tokenNodeSource).not.toContain("standardConditions.includes('stunned')")
    expect(tokenNodeSource).not.toContain("standardConditions.includes('poisoned')")
    expect(tokenNodeSource).not.toContain('<StunGlow')
    expect(tokenNodeSource).not.toContain('<PoisonCloud')
  })

  it('does not accidentally throttle a requested 60 fps animation to 30 fps', () => {
    const source = readFileSync(new URL('./mapEffectHooks.ts', import.meta.url), 'utf8')
    expect(source).toContain('fps > 0 && fps < 60 ? 1000 / fps : 0')
    expect(source).toContain('minDelta > 0 && time - lastRender < minDelta) return false')
  })
})
