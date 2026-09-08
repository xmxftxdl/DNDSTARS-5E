import { Circle, Group, Image as KonvaImage } from 'react-konva'
import type { TokenStatusTooltipPoint } from './tokenStatusTooltip'
import type { MapTokenStatusInstance } from './mapTokenStatusInstance'

export const DND5E_CONCENTRATION_TOKEN_IMAGE_SRC =
  '/assets/icons/concentration-status-token.png'

export interface ConcentrationTokenMark {
  instance: MapTokenStatusInstance
  tokenId: string
  spellId: string
  backgroundHighlightColor: string
  backgroundColor: string
  borderColor: string
  glowColor: string
  classId?: string
}

export interface Dnd5eConcentrationTokenBadgeProps {
  x: number
  y: number
  size: number
  image?: HTMLImageElement
  mark: ConcentrationTokenMark
  onClick?: () => void
  onTooltipChange?: (point?: TokenStatusTooltipPoint) => void
}

/**
 * Concentration marker used by both player and monster Tokens. The optional
 * click handler opens the DM's per-instance rule details.
 * The badge is a generated raster asset rather than a Konva vector glyph. Its
 * lifecycle remains driven by the concentrating actor's authoritative state.
 */
export default function Dnd5eConcentrationTokenBadge({
  x,
  y,
  size,
  image,
  mark,
  onClick,
  onTooltipChange,
}: Dnd5eConcentrationTokenBadgeProps) {
  if (!image) return null

  return (
    <Group
      id={`concentration:${mark.tokenId}:${mark.spellId}`}
      name="dnd5e-concentration-token-mark"
      x={x}
      y={y}
      listening={!!onClick || !!onTooltipChange}
      onClick={(event) => {
        if (!onClick) return
        event.cancelBubble = true
        onClick()
      }}
      onTap={(event) => {
        if (!onClick) return
        event.cancelBubble = true
        onClick()
      }}
      onMouseEnter={(event) => onTooltipChange?.({
        clientX: event.evt.clientX,
        clientY: event.evt.clientY,
      })}
      onMouseMove={(event) => onTooltipChange?.({
        clientX: event.evt.clientX,
        clientY: event.evt.clientY,
      })}
      onMouseLeave={() => onTooltipChange?.()}
    >
      <Circle
        name="dnd5e-concentration-token-backdrop"
        radius={size / 2}
        fillRadialGradientStartPoint={{ x: -size * 0.18, y: -size * 0.18 }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndPoint={{ x: 0, y: 0 }}
        fillRadialGradientEndRadius={size / 2}
        fillRadialGradientColorStops={[
          0,
          mark.backgroundHighlightColor,
          1,
          mark.backgroundColor,
        ]}
        stroke={mark.borderColor}
        strokeWidth={Math.max(0.75, size * 0.055)}
        shadowColor={mark.glowColor}
        shadowBlur={Math.max(2, size * 0.12)}
        listening={false}
      />
      <KonvaImage
        image={image}
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        shadowBlur={Math.max(2, size * 0.16)}
        shadowColor={mark.glowColor}
        listening={!!onClick || !!onTooltipChange}
      />
    </Group>
  )
}
