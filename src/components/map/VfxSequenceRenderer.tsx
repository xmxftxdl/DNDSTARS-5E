import { Group } from 'react-konva'
import { memo, useEffect, useMemo, type ComponentType } from 'react'
import {
  AcidSplashEffect,
  EldritchBlastProjectile,
  GuidanceManifestation,
  NewSpellManifestation,
  PoisonSprayEffect,
  RayOfFrostProjectile,
  ResistanceManifestation,
  SacredFlameEffect,
  SanctuaryManifestation,
  StatusSpellManifestation,
} from './MapCantripEffects'
import {
  MagicMissileProjectile,
  MaterialAreaSpellEffect,
  MaterialSpellProjectile,
  MaterialTargetSpellEffect,
  SequenceFireProjectileEffect,
} from './MapLeveledSpellEffects'
import { ProjectileArrow } from './MapEffectPrimitives'
import type { MapProjectile } from './mapCanvasContracts'
import {
  compileMapProjectileVfxSequence,
  preloadVfxSequenceAssets,
  vfxAssetForId,
  type VfxEffectSection,
  type VfxRendererKey,
} from '../../lib/vfxSequence'

const vfxAssetPreloadCache = new Map<string, Promise<void>>()

function preloadBrowserVfxAsset(url: string): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve()
  const cached = vfxAssetPreloadCache.get(url)
  if (cached) return cached
  const pending = new Promise<void>((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
  vfxAssetPreloadCache.set(url, pending)
  return pending
}

type SequenceRendererProps = {
  projectile: MapProjectile
  section: VfxEffectSection
}

const simpleRenderer = (
  Component: ComponentType<{ projectile: MapProjectile }>,
): ComponentType<SequenceRendererProps> => function SimpleSequenceRenderer({ projectile }) {
  return <Component projectile={projectile} />
}

const assetRenderer = (
  Component: ComponentType<{ projectile: MapProjectile; assetUrl?: string }>,
): ComponentType<SequenceRendererProps> => function AssetSequenceRenderer({ projectile, section }) {
  return (
    <Component
      projectile={projectile}
      assetUrl={vfxAssetForId(section.assetId)?.url}
    />
  )
}

function MaterialAreaSequenceRenderer({ projectile, section }: SequenceRendererProps) {
  return (
    <MaterialAreaSpellEffect
      projectile={projectile}
      assetUrl={vfxAssetForId(section.assetId)?.url}
    />
  )
}

function MaterialProjectileSequenceRenderer({ projectile, section }: SequenceRendererProps) {
  return (
    <MaterialSpellProjectile
      projectile={projectile}
      assetUrl={vfxAssetForId(section.assetId)?.url}
    />
  )
}

function MaterialTargetSequenceRenderer({ projectile, section }: SequenceRendererProps) {
  return (
    <MaterialTargetSpellEffect
      projectile={projectile}
      assetUrl={vfxAssetForId(section.assetId)?.url}
    />
  )
}

const VFX_RENDERERS: Readonly<Record<VfxRendererKey, ComponentType<SequenceRendererProps>>> = {
  'projectile-arrow': simpleRenderer(ProjectileArrow),
  'fire-projectile': assetRenderer(SequenceFireProjectileEffect),
  'ray-of-frost': assetRenderer(RayOfFrostProjectile),
  'eldritch-blast': assetRenderer(EldritchBlastProjectile),
  guidance: simpleRenderer(GuidanceManifestation),
  resistance: simpleRenderer(ResistanceManifestation),
  sanctuary: simpleRenderer(SanctuaryManifestation),
  'new-spell': assetRenderer(NewSpellManifestation),
  'status-spell': simpleRenderer(StatusSpellManifestation),
  'sacred-flame': assetRenderer(SacredFlameEffect),
  'acid-splash': assetRenderer(AcidSplashEffect),
  'poison-spray': assetRenderer(PoisonSprayEffect),
  'magic-missile': assetRenderer(MagicMissileProjectile),
  'material-projectile': MaterialProjectileSequenceRenderer,
  'material-target': MaterialTargetSequenceRenderer,
  'material-area': MaterialAreaSequenceRenderer,
}

function VfxSequenceRendererComponent({ projectile }: { projectile: MapProjectile }) {
  const sequence = useMemo(
    () => compileMapProjectileVfxSequence(projectile),
    [projectile],
  )
  useEffect(() => {
    void preloadVfxSequenceAssets(sequence, preloadBrowserVfxAsset)
  }, [sequence])
  const section = sequence.sections.find(
    (candidate): candidate is VfxEffectSection => candidate.type === 'effect',
  )
  if (!section) return null
  const Renderer = VFX_RENDERERS[section.renderer]
  const scheduledProjectile = {
    ...projectile,
    issuedAt: sequence.issuedAt + section.startMs,
    durationMs: section.durationMs,
  }
  return (
    <Group
      name="vfx-sequence"
      id={`vfx-sequence:${sequence.id}`}
      listening={false}
    >
      <Renderer projectile={scheduledProjectile} section={section} />
    </Group>
  )
}

/** Scale/pan changes must transform the existing effect, never replay its initial props. */
function sameMapProjectileVisual(left: MapProjectile, right: MapProjectile): boolean {
  return left.id === right.id
    && left.kind === right.kind
    && left.from.x === right.from.x
    && left.from.y === right.from.y
    && left.to.x === right.to.x
    && left.to.y === right.to.y
    && left.hit === right.hit
    && left.issuedAt === right.issuedAt
    && left.durationMs === right.durationMs
    && left.radiusPx === right.radiusPx
    && left.areaWidthPx === right.areaWidthPx
    && left.areaHeightPx === right.areaHeightPx
    && left.accentColor === right.accentColor
    && left.glowColor === right.glowColor
    && left.handoffAreaId === right.handoffAreaId
    && left.areaShape === right.areaShape
}

export const VfxSequenceRenderer = memo(VfxSequenceRendererComponent, (previous, next) => (
  sameMapProjectileVisual(previous.projectile, next.projectile)
))
