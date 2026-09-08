import { Children, isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Dnd5eConcentrationTokenBadge, {
  DND5E_CONCENTRATION_TOKEN_IMAGE_SRC,
  type ConcentrationTokenMark,
} from './Dnd5eConcentrationTokenBadge'

function elementProps(node: ReactNode): Record<string, unknown> {
  if (!isValidElement<Record<string, unknown>>(node)) {
    throw new Error('expected-react-element')
  }
  return node.props
}

const concentrationInstance = {
  id: 'concentration:wizard-token:flaming-sphere',
  tokenId: 'wizard-token',
  kind: 'concentration' as const,
  title: '专注：炽焰法球',
  description: '维持专注。',
  statusId: 'flaming-sphere',
  sourceLabel: '法师',
  authority: 'headless' as const,
}

describe('Dnd5eConcentrationTokenBadge', () => {
  it('renders the non-interactive raster concentration asset', () => {
    const mark: ConcentrationTokenMark = {
      instance: concentrationInstance,
      tokenId: 'wizard-token',
      spellId: 'flaming-sphere',
      backgroundHighlightColor: '#3b82f6',
      backgroundColor: '#172554',
      borderColor: '#93c5fd',
      glowColor: '#60a5fa',
      classId: 'wizard',
    }
    const image = {} as HTMLImageElement
    const badge = Dnd5eConcentrationTokenBadge({
      x: 18,
      y: -20,
      size: 24,
      image,
      mark,
    })
    const badgeProps = elementProps(badge)
    const children = Children.toArray(badgeProps.children as ReactNode)

    expect(badgeProps).toMatchObject({
      id: 'concentration:wizard-token:flaming-sphere',
      name: 'dnd5e-concentration-token-mark',
      x: 18,
      y: -20,
      listening: false,
    })
    expect(children).toHaveLength(2)
    expect(elementProps(children[0])).toMatchObject({
      name: 'dnd5e-concentration-token-backdrop',
      radius: 12,
      stroke: '#93c5fd',
      listening: false,
    })
    expect(elementProps(children[1])).toMatchObject({
      image,
      x: -12,
      y: -12,
      width: 24,
      height: 24,
      shadowColor: '#60a5fa',
      listening: false,
    })
    expect(DND5E_CONCENTRATION_TOKEN_IMAGE_SRC)
      .toBe('/assets/icons/concentration-status-token.png')
  })

  it('does not create a blank vector fallback while the bitmap is loading', () => {
    expect(Dnd5eConcentrationTokenBadge({
      x: 0,
      y: 0,
      size: 24,
      mark: {
        instance: concentrationInstance,
        tokenId: 'wizard-token',
        spellId: 'flaming-sphere',
        backgroundHighlightColor: '#3b82f6',
        backgroundColor: '#172554',
        borderColor: '#93c5fd',
        glowColor: '#60a5fa',
      },
    })).toBeNull()
  })

  it('reports pointer coordinates while the concentration marker is hovered', () => {
    const onTooltipChange = vi.fn()
    const badge = Dnd5eConcentrationTokenBadge({
      x: 0,
      y: 0,
      size: 24,
      image: {} as HTMLImageElement,
      mark: {
        instance: concentrationInstance,
        tokenId: 'wizard-token',
        spellId: 'flaming-sphere',
        backgroundHighlightColor: '#3b82f6',
        backgroundColor: '#172554',
        borderColor: '#93c5fd',
        glowColor: '#60a5fa',
      },
      onTooltipChange,
    })
    const badgeProps = elementProps(badge)
    const event = { evt: { clientX: 120, clientY: 80 } }

    expect(badgeProps.listening).toBe(true)
    ;(badgeProps.onMouseEnter as (input: typeof event) => void)(event)
    ;(badgeProps.onMouseMove as (input: typeof event) => void)(event)
    ;(badgeProps.onMouseLeave as () => void)()

    expect(onTooltipChange).toHaveBeenNthCalledWith(1, { clientX: 120, clientY: 80 })
    expect(onTooltipChange).toHaveBeenNthCalledWith(2, { clientX: 120, clientY: 80 })
    expect(onTooltipChange).toHaveBeenNthCalledWith(3)
  })

  it('only captures badge clicks when status inspection is available', () => {
    const mark: ConcentrationTokenMark = {
      instance: concentrationInstance,
      tokenId: 'wizard-token',
      spellId: 'flaming-sphere',
      backgroundHighlightColor: '#3b82f6',
      backgroundColor: '#172554',
      borderColor: '#93c5fd',
      glowColor: '#60a5fa',
    }
    const passiveBadge = Dnd5eConcentrationTokenBadge({
      x: 0,
      y: 0,
      size: 24,
      image: {} as HTMLImageElement,
      mark,
      onTooltipChange: vi.fn(),
    })
    const passiveEvent = { cancelBubble: false }

    ;(elementProps(passiveBadge).onClick as (event: typeof passiveEvent) => void)(passiveEvent)

    expect(passiveEvent.cancelBubble).toBe(false)

    const onClick = vi.fn()
    const inspectableBadge = Dnd5eConcentrationTokenBadge({
      x: 0,
      y: 0,
      size: 24,
      image: {} as HTMLImageElement,
      mark,
      onClick,
      onTooltipChange: vi.fn(),
    })
    const inspectableEvent = { cancelBubble: false }

    ;(elementProps(inspectableBadge).onClick as (event: typeof inspectableEvent) => void)(inspectableEvent)

    expect(inspectableEvent.cancelBubble).toBe(true)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
