import { TargetSpriteAtlasEffect } from './MapEffectPrimitives'
import { useTokenBadgeImage } from './mapEffectHooks'
import type { MapProjectile } from './mapCanvasContracts'

const HEALING_MANIFESTATION_IDS = new Set([
  'heal',
  'mass-cure-wounds',
  'mass-heal',
  'mass-healing-word',
  'prayer-of-healing',
])

export function NewSpellManifestation({
  projectile,
  assetUrl,
}: {
  projectile: MapProjectile
  assetUrl?: string
}) {
  const image = useTokenBadgeImage(assetUrl)
  if (!image) return null

  const kind = String(projectile.kind)
  const healing = HEALING_MANIFESTATION_IDS.has(kind)
  const radius = Math.max(24, projectile.radiusPx ?? 38)
    * (kind === 'mass-heal' ? 1.25 : kind.startsWith('mass-') ? 1.12 : 1)
  const shadowColor = projectile.glowColor ?? (
    healing
      ? '#fde68a'
      : kind === 'dancing-lights'
        ? '#60a5fa'
        : kind === 'minor-illusion'
          ? '#a78bfa'
          : kind === 'thaumaturgy'
            ? '#f59e0b'
            : '#84cc16'
  )
  const particleColor = projectile.accentColor ?? (
    healing
      ? '#22c55e'
      : kind === 'dancing-lights'
        ? '#c4b5fd'
        : kind === 'minor-illusion'
          ? '#e9d5ff'
          : kind === 'thaumaturgy'
            ? '#ef4444'
            : '#bef264'
  )

  return (
    <TargetSpriteAtlasEffect
      projectile={projectile}
      image={image}
      diameter={radius * (kind === 'shillelagh' ? 3.1 : 3.35)}
      shadowColor={shadowColor}
      particleColor={particleColor}
      particleHighlight={healing ? '#fef3c7' : '#ffffff'}
    />
  )
}
