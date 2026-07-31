import { renderToStaticMarkup } from 'react-dom/server'
import { Dnd5eClassBackdrop } from './Dnd5eActionIcon'

interface Dnd5eActionIconBackdropImageInput {
  classId: string
  background: string
  backgroundDeep: string
  accent: string
  glow: string
}

const backdropImageCache = new Map<string, string>()

export function dnd5eActionIconBackdropImage(
  input: Dnd5eActionIconBackdropImageInput,
): string {
  const cacheKey = [
    input.classId,
    input.background,
    input.backgroundDeep,
    input.accent,
    input.glow,
  ].join(':')
  const cached = backdropImageCache.get(cacheKey)
  if (cached) return cached

  const gradientId = `status-class-bg-${input.classId.replace(/[^a-z0-9_-]/gi, '-')}`
  const markup = renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      width="80"
      height="80"
      role="presentation"
    >
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="28%" r="82%">
          <stop offset="0" stopColor={input.background} />
          <stop offset="1" stopColor={input.backgroundDeep} />
        </radialGradient>
      </defs>
      <rect width="80" height="80" fill={`url(#${gradientId})`} />
      <g data-class-backdrop={input.classId}>
        <rect width="80" height="80" fill={input.glow} opacity=".035" />
        <Dnd5eClassBackdrop
          classId={input.classId}
          color={input.accent}
          glow={input.glow}
        />
      </g>
    </svg>,
  )
  const image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  backdropImageCache.set(cacheKey, image)
  return image
}
