import { Group, Image as KonvaImage } from 'react-konva'

export const DND5E_CONCENTRATION_TOKEN_IMAGE_SRC =
  '/assets/icons/concentration-status-token.png'

export interface ConcentrationTokenMark {
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
}

/**
 * Non-interactive concentration marker used by both player and monster Tokens.
 * The badge is a generated raster asset rather than a Konva vector glyph. Its
 * lifecycle remains driven by the concentrating actor's authoritative state.
 */
export default function Dnd5eConcentrationTokenBadge({
  x,
  y,
  size,
  image,
  mark,
}: Dnd5eConcentrationTokenBadgeProps) {
  if (!image) return null

  return (
    <Group
      id={`concentration:${mark.tokenId}:${mark.spellId}`}
      name="dnd5e-concentration-token-mark"
      x={x}
      y={y}
      listening={false}
    >
      <KonvaImage
        image={image}
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        shadowBlur={Math.max(2, size * 0.16)}
        shadowColor={mark.glowColor}
        listening={false}
      />
    </Group>
  )
}
